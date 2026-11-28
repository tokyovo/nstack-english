import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { planOf } from './entitlements.ts';

export type User = { id: string; email: string };
export type Profile = { id: string; kind: 'owner' | 'child'; name: string; picture: string | null };
/** What a session may reach: the whole account (the parent), or one profile (a child's token). */
export type SessionScope = { kind: 'account' } | { kind: 'profile'; profileId: string };
export type AuthEnv = { Variables: { user: User; token: string; scope: SessionScope } };

type Credentials = { email: string; password: string };
type ErrorBody = { error: string; field?: 'email' | 'password' };

const SESSION_DAYS = 90;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;
const MAX_EMAIL = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 24 * 60 * 60 * 1000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW = 15 * 60 * 1000;

const unauthorized: ErrorBody = { error: 'unauthorized' };
const forbidden: ErrorBody = { error: 'forbidden' };
const invalidCredentials: ErrorBody = { error: 'invalid_credentials' };

/**
 * Sign-up, sign-in, sign-out and `GET /api/me`, mounted at `/api`.
 * `now` is injected so tests can move the clock.
 */
export function accountRoutes(db: DatabaseSync, now: () => Date) {
  const app = new Hono<AuthEnv>();
  const requireUser = requireUserMiddleware(db, now);
  const requireAccount = requireAccountMiddleware(db, now);
  app.use('/auth/*', bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ error: 'invalid_body' }, 413) }));

  app.post('/auth/signup', async (c) => {
    const input = await readCredentials(c);
    if ('error' in input) return c.json(input, 400);
    if (input.password.length < MIN_PASSWORD || input.password.length > MAX_PASSWORD) {
      return c.json({ error: 'weak_password', field: 'password' } satisfies ErrorBody, 400);
    }
    const passwordHash = await hashPassword(input.password);
    const user = createUser(db, input.email, passwordHash, now());
    if (!user) return c.json({ error: 'email_taken', field: 'email' } satisfies ErrorBody, 409);
    return c.json(signedIn(db, user, now()), 201);
  });

  app.post('/auth/signin', async (c) => {
    const input = await readCredentials(c);
    if ('error' in input) return c.json(invalidCredentials, 401);
    if (!countAttempt(db, input.email, now())) {
      return c.json({ error: 'too_many_attempts' } satisfies ErrorBody, 429);
    }
    const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(input.email);
    // An unknown email still pays for one scrypt, so timing does not reveal which emails exist.
    const matches = await verifyPassword(input.password, row ? String(row.password_hash) : await dummyHash());
    if (!row || !matches) return c.json(invalidCredentials, 401);
    db.prepare('DELETE FROM signin_failures WHERE email = ?').run(input.email);
    return c.json(signedIn(db, { id: String(row.id), email: String(row.email) }, now()));
  });

  app.post('/auth/signout', requireUser, (c) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(c.get('token')));
    return c.body(null, 204);
  });

  app.get('/me', requireAccount, (c) => {
    const user = c.get('user');
    return c.json({ user, profiles: profilesOf(db, user.id), plan: planOf(db, user.id, now()) });
  });

  // Any session, a child's too: a child's plan is its parent's, since its session belongs to the parent's user.
  app.get('/plan', requireUser, (c) => c.json({ plan: planOf(db, c.get('user').id, now()) }));

  return app;
}

/**
 * Sets `user`, `token` and `scope` from a valid `Authorization: Bearer` session token, or
 * answers 401. Any session passes, including a child's profile-scoped one.
 */
export function requireUserMiddleware(db: DatabaseSync, now: () => Date): MiddlewareHandler<AuthEnv> {
  return sessionMiddleware(db, now, { accountOnly: false });
}

/** Like `requireUserMiddleware`, but a child's profile-scoped session answers 403. */
export function requireAccountMiddleware(db: DatabaseSync, now: () => Date): MiddlewareHandler<AuthEnv> {
  return sessionMiddleware(db, now, { accountOnly: true });
}

function sessionMiddleware(db: DatabaseSync, now: () => Date, { accountOnly }: { accountOnly: boolean }) {
  const middleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
    const token = /^Bearer ([A-Za-z0-9_-]+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    const session = token === undefined ? undefined : sessionForToken(db, token, now());
    if (!token || !session) return c.json(unauthorized, 401);
    if (accountOnly && session.scope.kind !== 'account') return c.json(forbidden, 403);
    c.set('user', session.user);
    c.set('token', token);
    c.set('scope', session.scope);
    await next();
  };
  return middleware;
}

/** Starts a session that reaches only `profileId`, one of `user`'s child profiles. */
export function startProfileSession(db: DatabaseSync, user: User, profileId: string, at: Date): string {
  return insertSession(db, user.id, profileId, at);
}

async function readCredentials(c: Context): Promise<Credentials | ErrorBody> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { error: 'invalid_body' };
  }
  if (typeof body !== 'object' || body === null) return { error: 'invalid_body' };
  const { email, password } = body as Record<string, unknown>;
  const normalised = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalised.length > MAX_EMAIL || !EMAIL_SHAPE.test(normalised)) {
    return { error: 'invalid_email', field: 'email' };
  }
  if (typeof password !== 'string') return { error: 'weak_password', field: 'password' };
  return { email: normalised, password };
}

/** Inserts the user and their owner profile; undefined when the email is taken. */
function createUser(db: DatabaseSync, email: string, passwordHash: string, at: Date): User | undefined {
  const user = { id: randomUUID(), email };
  db.exec('BEGIN IMMEDIATE');
  try {
    const inserted = db
      .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING')
      .run(user.id, email, passwordHash, at.getTime());
    if (inserted.changes === 0) {
      db.exec('ROLLBACK');
      return undefined;
    }
    db.prepare("INSERT INTO profiles (id, user_id, kind, created_at) VALUES (?, ?, 'owner', ?)").run(
      randomUUID(),
      user.id,
      at.getTime(),
    );
    db.exec('COMMIT');
    return user;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function signedIn(db: DatabaseSync, user: User, at: Date) {
  const token = insertSession(db, user.id, null, at);
  return { token, user, profiles: profilesOf(db, user.id) };
}

/** Returns the new token; only its hash is stored. `profileId` null means the whole account. */
function insertSession(db: DatabaseSync, userId: string, profileId: string | null, at: Date): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, profile_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(sha256(token), userId, profileId, at.getTime(), at.getTime() + SESSION_DAYS * DAY);
  return token;
}

function sessionForToken(db: DatabaseSync, token: string, at: Date): { user: User; scope: SessionScope } | undefined {
  const row = db
    .prepare(
      `SELECT users.id, users.email, sessions.profile_id FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(sha256(token), at.getTime());
  if (!row) return undefined;
  const scope: SessionScope =
    row.profile_id === null ? { kind: 'account' } : { kind: 'profile', profileId: String(row.profile_id) };
  return { user: { id: String(row.id), email: String(row.email) }, scope };
}

/**
 * Counts a sign-in attempt for `email` as a failure before its password is checked, so parallel
 * attempts cannot all pass the limit while scrypt runs (a right password clears the count).
 * False when 10 attempts in the last 15 minutes already failed; older ones are deleted.
 * Synchronous from check to insert, so no other request runs in between.
 */
function countAttempt(db: DatabaseSync, email: string, at: Date): boolean {
  db.prepare('DELETE FROM signin_failures WHERE failed_at <= ?').run(at.getTime() - FAILURE_WINDOW);
  const row = db.prepare('SELECT count(*) AS n FROM signin_failures WHERE email = ?').get(email);
  if (Number(row?.n) >= MAX_FAILURES) return false;
  db.prepare('INSERT INTO signin_failures (email, failed_at) VALUES (?, ?)').run(email, at.getTime());
  return true;
}

export function profilesOf(db: DatabaseSync, userId: string): Profile[] {
  return db
    .prepare('SELECT id, kind, name, picture FROM profiles WHERE user_id = ? ORDER BY created_at, rowid')
    .all(userId)
    .map(toProfile);
}

/** One of `userId`'s profiles by id, or undefined (also for another user's profile). */
export function profileOf(db: DatabaseSync, userId: string, profileId: string): Profile | undefined {
  const row = db.prepare('SELECT id, kind, name, picture FROM profiles WHERE id = ? AND user_id = ?').get(profileId, userId);
  return row ? toProfile(row) : undefined;
}

function toProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    kind: row.kind === 'child' ? 'child' : 'owner',
    name: String(row.name),
    picture: row.picture === null ? null : String(row.picture),
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// scrypt with N=2^14, r=8, p=1 (the OWASP minimum), 16-byte salt, 64-byte key.
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };

function deriveKey(password: string, salt: Buffer, params = SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, params.keyLength, { N: params.N, r: params.r, p: params.p }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const { N, r, p } = SCRYPT;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

let dummy: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  return dummy;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  const params = { N: Number(N), r: Number(r), p: Number(p), keyLength: expected.length };
  const actual = await deriveKey(password, Buffer.from(salt, 'base64url'), params);
  return timingSafeEqual(actual, expected);
}
