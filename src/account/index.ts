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
 * What progress sync needs: the token to send, the account profile to sync, and the device copy
 * that profile learns in (LOCAL_PROFILE_ID for the parent, the child's id for a child), so a
 * child's and a parent's progress never mix on the device.
 */
export type SyncSession = { token: string; profileId: string; deviceProfileId: string };

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

/** Forgets the session on this device; the server is told when it can be reached. */
export async function signOut(): Promise<void> {
  const session = await savedSession();
  if (!session) return;
  await deleteSession();
  sessionChanged();
  const tokens = session.child ? [session.child.token, session.token] : [session.token];
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
  await writeSession(JSON.stringify({ ...session, child } satisfies Session));
  sessionChanged();
  return { ok: true };
}

/** The parent learns on this device again; the child's token is ended on the server when it can be reached. */
export async function endChildSession(): Promise<void> {
  const session = await savedSession();
  if (!session?.child) return;
  const { child, ...parent } = session;
  await writeSession(JSON.stringify(parent satisfies Session));
  sessionChanged();
  await callApi('/api/auth/signout', { method: 'POST', token: child.token });
}

/** The child learning on this device, or undefined while the parent (or nobody) is. */
export async function activeChild(): Promise<Profile | undefined> {
  return (await savedSession())?.child?.profile;
}

/** The saved session's token and learning profile, read on the device without asking the server. */
export async function syncSession(): Promise<SyncSession | undefined> {
  const session = await savedSession();
  if (session?.child) {
    const { token, profile } = session.child;
    return { token, profileId: profile.id, deviceProfileId: profile.id };
  }
  const owner = session?.profiles.find((profile) => profile.kind === 'owner');
  return session && owner && { token: session.token, profileId: owner.id, deviceProfileId: LOCAL_PROFILE_ID };
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
  if (reply.status === 401) {
    await deleteSession();
    sessionChanged();
    return { status: 'signedOut' };
  }
  const fresh = reply.status === 200 ? parseAccount(reply.body) : undefined;
  if (!fresh) return { status: 'signedIn', user: session.user, profiles: session.profiles };
  // A child deleted on another device has no session left on the server either.
  const { child, ...parent } = session;
  const childKept = child && fresh.profiles.some((profile) => profile.id === child.profile.id);
  await writeSession(JSON.stringify({ ...parent, ...fresh, ...(childKept && { child }) } satisfies Session));
  if (child && !childKept) sessionChanged();
  return { status: 'signedIn', user: fresh.user, profiles: fresh.profiles };
}

async function startSession(path: `/api/${string}`, email: string, password: string): Promise<AccountResult> {
  const reply = await callApi(path, { method: 'POST', body: { email, password } });
  const session = reply.status === 200 || reply.status === 201 ? parseSession(reply.body) : undefined;
  if (!session) return { ok: false, error: errorOf(reply) };
  await writeSession(JSON.stringify(session));
  sessionChanged();
  return { ok: true, user: session.user, profiles: session.profiles };
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
