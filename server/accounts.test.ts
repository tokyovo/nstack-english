import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

import { startServer, type RunningServer } from './server.ts';

/** The body of a signup, signin or /api/me answer. */
type AccountBody = {
  token: string;
  user: { id: string; email: string };
  profiles: { id: string; kind: string; name: string }[];
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;


describe('accounts', () => {
  let dir: string;
  let dbPath: string;
  let server: RunningServer;
  let clock = Date.parse('2026-11-28T09:00:00Z');
  let emailCounter = 0;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'accounts-test-'));
    dbPath = join(dir, 'app.sqlite');
    server = await startServer({ port: 0, dbPath, now: () => new Date(clock) });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function freshEmail() {
    emailCounter += 1;
    return `learner${emailCounter}@example.com`;
  }

  function post(path: string, body: unknown, token?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(`${server.url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  function me(token?: string) {
    return fetch(`${server.url}/api/me`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  }

  async function signUp(email = freshEmail(), password = 'correct horse') {
    const response = await post('/api/auth/signup', { email, password });
    assert.equal(response.status, 201);
    const body = (await response.json()) as AccountBody;
    return { email, password, token: body.token, body };
  }

  function countRows(table: string): number {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n);
    } finally {
      db.close();
    }
  }

  function countAttempts(email: string): number {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return Number(db.prepare('SELECT count(*) AS n FROM signin_failures WHERE email = ?').get(email)?.n);
    } finally {
      db.close();
    }
  }

  describe('POST /api/auth/signup', () => {
    test('creates the user with one owner profile and returns a session token', async () => {
      const { body, email } = await signUp();

      assert.match(body.token, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(body.user.email, email);
      assert.equal(body.profiles.length, 1);
      assert.equal(body.profiles[0].kind, 'owner');
    });

    test('the token signs the new user in for GET /api/me', async () => {
      const { token, email, body } = await signUp();

      const response = await me(token);

      assert.equal(response.status, 200);
      const account = (await response.json()) as AccountBody;
      assert.equal(account.user.email, email);
      assert.deepEqual(account.profiles, body.profiles);
    });

    test('stores the email trimmed and lowercased', async () => {
      const { body } = await signUp('  Lan.Nguyen@Example.COM ');

      assert.equal(body.user.email, 'lan.nguyen@example.com');
    });

    test('stores the password hashed, never as written, and the token only hashed', async () => {
      const { email, token } = await signUp(freshEmail(), 'plain-text-password');

      const db = new DatabaseSync(dbPath, { readOnly: true });
      try {
        const user = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email);
        assert.match(String(user?.password_hash), /^scrypt\$/);
        assert.doesNotMatch(String(user?.password_hash), /plain-text-password/);
        const raw = db.prepare('SELECT count(*) AS n FROM sessions WHERE token_hash = ?').get(token);
        assert.equal(raw?.n, 0);
      } finally {
        db.close();
      }
    });

    test('a duplicate email answers 409, whatever its case, and creates nothing', async () => {
      const { email } = await signUp();
      const usersBefore = countRows('users');

      const response = await post('/api/auth/signup', { email: email.toUpperCase(), password: 'another password' });

      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: 'email_taken', field: 'email' });
      assert.equal(countRows('users'), usersBefore);
    });

    test('a password under 8 characters answers 400 and creates nothing', async () => {
      const usersBefore = countRows('users');

      const response = await post('/api/auth/signup', { email: freshEmail(), password: '1234567' });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'weak_password', field: 'password' });
      assert.equal(countRows('users'), usersBefore);
    });

    test('a password of exactly 8 characters is accepted', async () => {
      await signUp(freshEmail(), '12345678');
    });

    test('an email that is not an address answers 400', async () => {
      for (const email of ['', 'lan', 'lan@', '@example.com', 'lan @example.com', 42]) {
        const response = await post('/api/auth/signup', { email, password: 'correct horse' });
        assert.equal(response.status, 400, JSON.stringify(email));
        assert.deepEqual(await response.json(), { error: 'invalid_email', field: 'email' });
      }
    });

    test('a body that is not JSON answers 400', async () => {
      const response = await fetch(`${server.url}/api/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'invalid_body' });
    });
  });

  describe('POST /api/auth/signin', () => {
    test('the right password returns a new token that signs in', async () => {
      const { email, password, token: signupToken } = await signUp();

      const response = await post('/api/auth/signin', { email: ` ${email.toUpperCase()} `, password });

      assert.equal(response.status, 200);
      const body = (await response.json()) as AccountBody;
      assert.equal(body.user.email, email);
      assert.notEqual(body.token, signupToken);
      assert.equal((await me(body.token)).status, 200);
    });

    test('a wrong password answers 401 with the same body as an unknown email', async () => {
      const { email } = await signUp();

      const wrong = await post('/api/auth/signin', { email, password: 'not the password' });
      const unknown = await post('/api/auth/signin', { email: freshEmail(), password: 'not the password' });

      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      const wrongBody = await wrong.json();
      assert.deepEqual(wrongBody, { error: 'invalid_credentials' });
      assert.deepEqual(await unknown.json(), wrongBody);
    });

    test('a failed sign-in creates no session', async () => {
      const { email } = await signUp();
      const sessionsBefore = countRows('sessions');

      await post('/api/auth/signin', { email, password: 'not the password' });

      assert.equal(countRows('sessions'), sessionsBefore);
    });
  });

  describe('sign-in rate limit', () => {
    async function failSignIn(email: string, times: number) {
      for (let i = 0; i < times; i += 1) {
        const response = await post('/api/auth/signin', { email, password: 'not the password' });
        assert.equal(response.status, 401, `failure ${i + 1}`);
      }
    }

    test('after 10 failures for an email, even the right password answers 429', async () => {
      const { email, password } = await signUp();
      await failSignIn(email, 10);

      const response = await post('/api/auth/signin', { email, password });

      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), { error: 'too_many_attempts' });
    });

    test('counts failures per email, whatever its case', async () => {
      const limited = await signUp();
      const other = await signUp();
      await failSignIn(limited.email.toUpperCase(), 10);

      assert.equal((await post('/api/auth/signin', { email: limited.email, password: limited.password })).status, 429);
      assert.equal((await post('/api/auth/signin', { email: other.email, password: other.password })).status, 200);
    });

    test('counts failures for unknown emails too', async () => {
      const email = freshEmail();
      await failSignIn(email, 10);

      assert.equal((await post('/api/auth/signin', { email, password: 'anything at all' })).status, 429);
    });

    test('9 failures still allow the right password, which clears the count', async () => {
      const { email, password } = await signUp();
      await failSignIn(email, 9);
      assert.equal((await post('/api/auth/signin', { email, password })).status, 200);

      await failSignIn(email, 9);

      assert.equal((await post('/api/auth/signin', { email, password })).status, 200);
    });

    test('60 wrong passwords at once: at most 10 are checked, the rest answer 429', async () => {
      const { email } = await signUp();

      const responses = await Promise.all(
        Array.from({ length: 60 }, () => post('/api/auth/signin', { email, password: 'not the password' })),
      );

      const statuses = responses.map((response) => response.status);
      assert.equal(statuses.filter((status) => status === 401).length, 10);
      assert.equal(statuses.filter((status) => status === 429).length, 50);
    });

    test('the right password inside a flood, after 10 attempts are counted, answers 429', async () => {
      const { email, password } = await signUp();
      const flood = Array.from({ length: 59 }, () => post('/api/auth/signin', { email, password: 'not the password' }));
      while (countAttempts(email) < 10) await new Promise((resolve) => setImmediate(resolve));

      const response = await post('/api/auth/signin', { email, password });
      await Promise.all(flood);

      assert.equal(response.status, 429);
    });

    test('failures older than 15 minutes no longer count', async () => {
      const { email, password } = await signUp();
      await failSignIn(email, 10);
      clock += 15 * MINUTE - 1;
      assert.equal((await post('/api/auth/signin', { email, password })).status, 429);

      clock += 1;

      assert.equal((await post('/api/auth/signin', { email, password })).status, 200);
    });
  });

  describe('POST /api/auth/signout', () => {
    test('ends that session only, and answers 204', async () => {
      const { email, password, token } = await signUp();
      const other = (await (await post('/api/auth/signin', { email, password })).json()) as AccountBody;

      const response = await post('/api/auth/signout', {}, token);

      assert.equal(response.status, 204);
      assert.equal((await me(token)).status, 401);
      assert.equal((await me(other.token)).status, 200);
    });

    test('signed out answers 401', async () => {
      const response = await post('/api/auth/signout', {});

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'unauthorized' });
    });
  });

  describe('GET /api/me', () => {
    test('a session expires after 90 days', async () => {
      const { token } = await signUp();
      clock += 90 * DAY - 1;
      assert.equal((await me(token)).status, 200);

      clock += 1;

      assert.equal((await me(token)).status, 401);
    });

    test('signed out answers 401', async () => {
      const response = await me();

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'unauthorized' });
    });

    test('an unknown token answers 401', async () => {
      const response = await me('not-a-real-token-at-all-not-a-real-token-xx');

      assert.equal(response.status, 401);
    });

    test('a malformed Authorization header answers 401', async () => {
      const { token } = await signUp();

      const response = await fetch(`${server.url}/api/me`, { headers: { authorization: `Basic ${token}` } });

      assert.equal(response.status, 401);
    });
  });
});
