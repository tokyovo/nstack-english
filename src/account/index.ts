// The learner's account on this device: sign up, sign in, sign out, and the saved session.
// The server's answers (server/accounts.ts) are checked here and turned into typed values.
import { callApi, type ApiReply } from '@/api/client';
import { LOCAL_PROFILE_ID } from '@/progress/schema';
import { isProfilePicture, type ProfilePicture } from '@/profiles/child-profile';

import { deleteSession, readSession, writeSession } from './session-storage';

export type User = { id: string; email: string };
/** A child's `picture` is one of PROFILE_PICTURES; the owner has none. */
export type Profile = { id: string; kind: 'owner' | 'child'; name: string; picture: ProfilePicture | null };

export type AccountState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; profiles: Profile[] };

export type AccountField = 'email' | 'password';

const errorCodes = [
  'invalid_email',
  'email_taken',
  'weak_password',
  'invalid_credentials',
  'too_many_attempts',
  'offline',
  'unknown',
] as const;
export type AccountErrorCode = (typeof errorCodes)[number];

/** `field` names the input that caused the error; without it the error is about the whole form. */
export type AccountError = { code: AccountErrorCode; field?: AccountField };

export type AccountResult = { ok: true; user: User; profiles: Profile[] } | { ok: false; error: AccountError };

/** A child learning on this device: its own profile-scoped token, kept beside the parent's. */
type ChildSession = { token: string; profile: Profile };

type Session = { token: string; user: User; profiles: Profile[]; child?: ChildSession };

/**
 * What progress sync needs: the token to send, the account profile to sync, the device copy
 * that profile learns in (LOCAL_PROFILE_ID for the parent, the child's id for a child), so a
 * child's and a parent's progress never mix on the device, and the account's owner profile,
 * which every copy on the device belongs to (a child's included).
 */
export type SyncSession = { token: string; profileId: string; deviceProfileId: string; ownerProfileId: string };

export type ChildSessionResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'signed_out' | 'offline' | 'unknown' };

const sessionListeners = new Set<() => void>();

/** Calls `listener` after a sign-in, sign-up or sign-out on this device; returns the unsubscribe. */
export function onSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function sessionChanged() {
  for (const listener of sessionListeners) listener();
}

const fieldOf: Partial<Record<AccountErrorCode, AccountField>> = {
  invalid_email: 'email',
  email_taken: 'email',
  weak_password: 'password',
  // Wrong password and unknown email get the same answer; the password is what to retype.
  invalid_credentials: 'password',
};

export function signUp(email: string, password: string): Promise<AccountResult> {
  return startSession('/api/auth/signup', email, password);
}

export function signIn(email: string, password: string): Promise<AccountResult> {
  return startSession('/api/auth/signin', email, password);
}

/**
 * Forgets the session on this device; the server is told when it can be reached. Screens sign out
 * through signOutOfDevice (src/sync), which also saves and clears the device progress.
 */
export async function signOut(): Promise<void> {
  let ended: Session | undefined;
  await changeSession((current) => {
    ended = current;
    return undefined;
  });
  if (!ended) return;
  const tokens = ended.child ? [ended.child.token, ended.token] : [ended.token];
  await Promise.all(tokens.map((token) => callApi('/api/auth/signout', { method: 'POST', token })));
}

/**
 * Hands the device to one of the parent's children: the server gives a token that reaches only
 * that child's progress, and from now on the device learns as the child.
 */
export async function startChildSession(profileId: string): Promise<ChildSessionResult> {
  const session = await savedSession();
  if (!session) return { ok: false, error: 'signed_out' };
  const reply = await callApi(`/api/profiles/${encodeURIComponent(profileId)}/session`, {
    method: 'POST',
    token: session.token,
  });
  const child = reply.status === 201 ? parseChildSession(reply.body) : undefined;
  if (!child) return { ok: false, error: childSessionError(reply) };
  const started = await changeSession((current) =>
    current?.token === session.token ? { ...current, child } : current
  );
  return started?.child === child ? { ok: true } : { ok: false, error: 'signed_out' };
}

/** The parent learns on this device again; the child's token is ended on the server when it can be reached. */
export async function endChildSession(): Promise<void> {
  let ended: ChildSession | undefined;
  await changeSession((current) => {
    if (!current?.child) return current;
    const { child, ...parent } = current;
    ended = child;
    return parent;
  });
  if (ended) await callApi('/api/auth/signout', { method: 'POST', token: ended.token });
}

/** The child learning on this device, or undefined while the parent (or nobody) is. */
export async function activeChild(): Promise<Profile | undefined> {
  return (await savedSession())?.child?.profile;
}

/** The device copy of progress the learner uses: the child's own, or LOCAL_PROFILE_ID for everyone else. */
export function deviceProfileIdOf(child: Profile | undefined): string {
  return child?.id ?? LOCAL_PROFILE_ID;
}

/** The saved session's token and learning profile, read on the device without asking the server. */
export async function syncSession(): Promise<SyncSession | undefined> {
  const session = await savedSession();
  const owner = session?.profiles.find((profile) => profile.kind === 'owner');
  if (!session || !owner) return undefined;
  if (session.child) {
    const { token, profile } = session.child;
    return { token, profileId: profile.id, deviceProfileId: deviceProfileIdOf(profile), ownerProfileId: owner.id };
  }
  return { token: session.token, profileId: owner.id, deviceProfileId: deviceProfileIdOf(undefined), ownerProfileId: owner.id };
}

/**
 * Every learner's sync target on this device (the parent's and each child's), all reached with the
 * parent's account token; undefined while signed out.
 */
export async function familySyncSessions(): Promise<SyncSession[] | undefined> {
  const session = await savedSession();
  const owner = session?.profiles.find((profile) => profile.kind === 'owner');
  if (!session || !owner) return undefined;
  return session.profiles.map((profile) => ({
    token: session.token,
    profileId: profile.id,
    deviceProfileId: deviceProfileIdOf(profile.kind === 'child' ? profile : undefined),
    ownerProfileId: owner.id,
  }));
}

/** The saved session's token, for calls made as the parent's whole account. */
export async function accountToken(): Promise<string | undefined> {
  return (await savedSession())?.token;
}

/**
 * The saved account, checked with the server: a session the server no longer knows is
 * forgotten; while offline the saved one is trusted.
 */
export async function loadAccount(): Promise<AccountState> {
  const session = await savedSession();
  if (!session) return { status: 'signedOut' };
  const reply = await callApi('/api/me', { token: session.token });
  const fresh = reply.status === 200 ? parseAccount(reply.body) : undefined;
  // Applied to the session saved now, which may have changed while the server answered.
  const current = await changeSession((latest) => {
    if (latest?.token !== session.token) return latest;
    if (reply.status === 401) return undefined;
    if (!fresh) return latest;
    // A child deleted on another device has no session left on the server either.
    const { child, ...parent } = latest;
    const childKept = child && fresh.profiles.some((profile) => profile.id === child.profile.id);
    return { ...parent, ...fresh, ...(childKept && { child }) };
  });
  return current ? { status: 'signedIn', user: current.user, profiles: current.profiles } : { status: 'signedOut' };
}

async function startSession(path: `/api/${string}`, email: string, password: string): Promise<AccountResult> {
  const reply = await callApi(path, { method: 'POST', body: { email, password } });
  const session = reply.status === 200 || reply.status === 201 ? parseSession(reply.body) : undefined;
  if (!session) return { ok: false, error: errorOf(reply) };
  await changeSession(() => session);
  return { ok: true, user: session.user, profiles: session.profiles };
}

/** The last pending session change; each waits for it, so none overwrites another. */
let sessionChanges: Promise<unknown> = Promise.resolve();

/**
 * Saves `change(latest saved session)`, or forgets the session when it returns undefined. Listeners
 * hear about it when the learner's token changed: a sign-in, a sign-out or a switch of profile.
 */
function changeSession(change: (current: Session | undefined) => Session | undefined): Promise<Session | undefined> {
  const run = async () => {
    const current = await savedSession();
    const next = change(current);
    if (next === current) return current;
    if (next) await writeSession(JSON.stringify(next));
    else await deleteSession();
    if (learnerToken(next) !== learnerToken(current)) sessionChanged();
    return next;
  };
  const result = sessionChanges.then(run, run);
  sessionChanges = result.catch(() => undefined);
  return result;
}

function learnerToken(session: Session | undefined): string | undefined {
  return session?.child?.token ?? session?.token;
}

function errorOf(reply: ApiReply): AccountError {
  if (reply.status === 'offline') return { code: 'offline' };
  const reported = isRecord(reply.body) ? reply.body.error : undefined;
  const code = errorCodes.find((known) => known === reported) ?? 'unknown';
  const field = fieldOf[code];
  return field ? { code, field } : { code };
}

async function savedSession(): Promise<Session | undefined> {
  const stored = await readSession();
  if (stored === null) return undefined;
  try {
    return parseSession(JSON.parse(stored));
  } catch {
    return undefined;
  }
}

function parseSession(value: unknown): Session | undefined {
  if (!isRecord(value) || !isToken(value.token)) return undefined;
  const account = parseAccount(value);
  const child = parseChildSession(value.child);
  return account && { token: value.token, ...account, ...(child && { child }) };
}

function parseAccount(value: unknown): Omit<Session, 'token' | 'child'> | undefined {
  if (!isRecord(value) || !isRecord(value.user) || !Array.isArray(value.profiles)) return undefined;
  const { id, email } = value.user;
  if (typeof id !== 'string' || typeof email !== 'string') return undefined;
  return { user: { id, email }, profiles: value.profiles.flatMap((profile) => parseProfile(profile) ?? []) };
}

/** A child session from the server's `{token, profile}` answer or the saved session. */
function parseChildSession(value: unknown): ChildSession | undefined {
  if (!isRecord(value) || !isToken(value.token)) return undefined;
  const profile = parseProfile(value.profile);
  return profile?.kind === 'child' ? { token: value.token, profile } : undefined;
}

function parseProfile(value: unknown): Profile | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  return {
    id: value.id,
    kind: value.kind === 'child' ? 'child' : 'owner',
    name: String(value.name ?? ''),
    picture: isProfilePicture(value.picture) ? value.picture : null,
  };
}

function childSessionError(reply: ApiReply): Extract<ChildSessionResult, { ok: false }>['error'] {
  if (reply.status === 'offline') return 'offline';
  if (reply.status === 401) return 'signed_out';
  if (reply.status === 404) return 'not_found';
  return 'unknown';
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
