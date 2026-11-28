// The learner's account on this device: sign up, sign in, sign out, and the saved session.
// The server's answers (server/accounts.ts) are checked here and turned into typed values.
import { callApi, type ApiReply } from '@/api/client';

import { deleteSession, readSession, writeSession } from './session-storage';

export type User = { id: string; email: string };
export type Profile = { id: string; kind: 'owner' | 'child'; name: string };

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

type Session = { token: string; user: User; profiles: Profile[] };

/** What progress sync needs: the session token and the account profile this device learns as. */
export type SyncSession = { token: string; profileId: string };

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
  await callApi('/api/auth/signout', { method: 'POST', token: session.token });
}

/** The saved session's token and owner profile, read on the device without asking the server. */
export async function syncSession(): Promise<SyncSession | undefined> {
  const session = await savedSession();
  const owner = session?.profiles.find((profile) => profile.kind === 'owner');
  return session && owner && { token: session.token, profileId: owner.id };
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
  const current = fresh ? { ...session, ...fresh } : session;
  if (fresh) await writeSession(JSON.stringify(current));
  return { status: 'signedIn', user: current.user, profiles: current.profiles };
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
  if (!isRecord(value) || typeof value.token !== 'string' || value.token === '') return undefined;
  const account = parseAccount(value);
  return account && { token: value.token, ...account };
}

function parseAccount(value: unknown): Omit<Session, 'token'> | undefined {
  if (!isRecord(value) || !isRecord(value.user) || !Array.isArray(value.profiles)) return undefined;
  const { id, email } = value.user;
  if (typeof id !== 'string' || typeof email !== 'string') return undefined;
  const profiles = value.profiles.flatMap((profile): Profile[] =>
    isRecord(profile) && typeof profile.id === 'string'
      ? [{ id: profile.id, kind: profile.kind === 'child' ? 'child' : 'owner', name: String(profile.name ?? '') }]
      : []
  );
  return { user: { id, email }, profiles };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
