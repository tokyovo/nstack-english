import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

import { grantPremium } from './entitlements.ts';
import { startServer, type RunningServer } from './server.ts';

type Plan = { kind: 'free'; until: null } | { kind: 'premium'; until: string };

const DAY = 24 * 60 * 60 * 1000;
const GRANT_CLI = join(import.meta.dirname, 'grant.ts');

describe('plans and entitlements', () => {
  let dir: string;
  let dbPath: string;
  let server: RunningServer;
  let clock = Date.parse('2026-11-28T09:00:00Z');
  let emailCounter = 0;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'entitlements-test-'));
    dbPath = join(dir, 'app.sqlite');
    server = await startServer({ port: 0, dbPath, now: () => new Date(clock), signupsPerAddress: 1000 });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function request(method: string, path: string, token?: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${server.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async function signUp() {
    emailCounter += 1;
    const email = `parent${emailCounter}@example.com`;
    const response = await request('POST', '/api/auth/signup', undefined, { email, password: 'correct horse' });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { token: string; user: { id: string } };
    return { email, token: body.token, userId: body.user.id };
  }

  async function childTokenOf(parent: { token: string }) {
    const added = await request('POST', '/api/profiles', parent.token, { name: 'Bé Na', picture: '🐱' });
    const { profile } = (await added.json()) as { profile: { id: string } };
    const session = await request('POST', `/api/profiles/${profile.id}/session`, parent.token);
    return ((await session.json()) as { token: string }).token;
  }

  async function planFromMe(token: string): Promise<Plan> {
    const response = await request('GET', '/api/me', token);
    assert.equal(response.status, 200);
    return ((await response.json()) as { plan: Plan }).plan;
  }

  async function planFromPlan(token: string): Promise<Plan> {
    const response = await request('GET', '/api/plan', token);
    assert.equal(response.status, 200);
    return ((await response.json()) as { plan: Plan }).plan;
  }

  function withDb<T>(work: (db: DatabaseSync) => T): T {
    const db = new DatabaseSync(dbPath);
    try {
      return work(db);
    } finally {
      db.close();
    }
  }

  function entitlementRows(userId: string) {
    return withDb((db) =>
      db
        .prepare('SELECT source, starts_at, expires_at, external_ref FROM entitlements WHERE user_id = ?')
        .all(userId)
        .map((row) => ({ ...row })),
    );
  }

  function runGrant(...args: string[]) {
    return spawnSync(process.execPath, [GRANT_CLI, ...args], { encoding: 'utf8' });
  }

  describe('GET /api/me plan', () => {
    test('a new account is on the free plan', async () => {
      const parent = await signUp();

      assert.deepEqual(await planFromMe(parent.token), { kind: 'free', until: null });
    });

    test('is premium until the grant expires, then free again', async () => {
      const parent = await signUp();
      withDb((db) => grantPremium(db, { email: parent.email, days: 30, source: 'manual', ref: 'test-1' }, new Date(clock)));

      assert.deepEqual(await planFromMe(parent.token), { kind: 'premium', until: '2026-12-28T09:00:00.000Z' });
      clock += 30 * DAY - 1;
      assert.equal((await planFromMe(parent.token)).kind, 'premium');
      clock += 1;
      assert.deepEqual(await planFromMe(parent.token), { kind: 'free', until: null });
    });

    test('a grant that has not started yet does not count', async () => {
      const parent = await signUp();
      withDb((db) =>
        grantPremium(db, { email: parent.email, days: 10, source: 'card', ref: 'later' }, new Date(clock + DAY)),
      );

      assert.deepEqual(await planFromMe(parent.token), { kind: 'free', until: null });
    });

    test('with overlapping grants, premium lasts until the latest one ends', async () => {
      const parent = await signUp();
      withDb((db) => {
        grantPremium(db, { email: parent.email, days: 7, source: 'manual', ref: 'short' }, new Date(clock));
        grantPremium(db, { email: parent.email, days: 365, source: 'app_store', ref: 'yearly' }, new Date(clock));
      });

      assert.deepEqual(await planFromMe(parent.token), {
        kind: 'premium',
        until: new Date(clock + 365 * DAY).toISOString(),
      });
    });

    test("another user's grant does not make this account premium", async () => {
      const premium = await signUp();
      const other = await signUp();
      withDb((db) => grantPremium(db, { email: premium.email, days: 30, source: 'manual', ref: 'mine' }, new Date(clock)));

      assert.deepEqual(await planFromMe(other.token), { kind: 'free', until: null });
    });
  });

  describe('GET /api/plan', () => {
    test("a child's token reads its parent's plan: free, then premium", async () => {
      const parent = await signUp();
      const childToken = await childTokenOf(parent);

      assert.deepEqual(await planFromPlan(childToken), { kind: 'free', until: null });
      withDb((db) => grantPremium(db, { email: parent.email, days: 30, source: 'manual', ref: 'family' }, new Date(clock)));
      assert.deepEqual(await planFromPlan(childToken), await planFromMe(parent.token));
      assert.equal((await planFromPlan(childToken)).kind, 'premium');
    });

    test('the parent reads the same plan as /api/me', async () => {
      const parent = await signUp();
      withDb((db) => grantPremium(db, { email: parent.email, days: 3, source: 'google_play', ref: 'gp' }, new Date(clock)));

      assert.deepEqual(await planFromPlan(parent.token), await planFromMe(parent.token));
    });

    test('signed out answers 401', async () => {
      const response = await request('GET', '/api/plan');

      assert.equal(response.status, 401);
    });
  });

  describe('grantPremium', () => {
    test('the same source and reference twice stores one entitlement', async () => {
      const parent = await signUp();
      const input = { email: parent.email, days: 30, source: 'manual', ref: 'same' } as const;

      const first = withDb((db) => grantPremium(db, input, new Date(clock)));
      const second = withDb((db) => grantPremium(db, input, new Date(clock + DAY)));

      assert.deepEqual(first, { status: 'granted', until: new Date(clock + 30 * DAY) });
      assert.deepEqual(second, { status: 'exists', until: new Date(clock + 30 * DAY) });
      assert.deepEqual(entitlementRows(parent.userId), [
        { source: 'manual', starts_at: clock, expires_at: clock + 30 * DAY, external_ref: 'same' },
      ]);
    });

    test('an unknown email grants nothing', () => {
      const result = withDb((db) =>
        grantPremium(db, { email: 'nobody@example.com', days: 30, source: 'manual', ref: 'x' }, new Date(clock)),
      );

      assert.deepEqual(result, { status: 'unknown_email' });
      assert.equal(withDb((db) => db.prepare('SELECT count(*) AS n FROM entitlements WHERE external_ref = ?').get('x')?.n), 0);
    });
  });

  describe('npm run grant (server/grant.ts)', () => {
    test('grants Premium to an account by email, and a rerun changes nothing', async () => {
      const parent = await signUp();

      const first = runGrant('--db', dbPath, parent.email.toUpperCase(), '30', '--ref', 'cli-1');
      assert.equal(first.status, 0, first.stderr);
      clock = Date.now(); // the CLI grants from the real clock
      assert.match(first.stdout, /Granted Premium to parent\d+@example\.com until \d{4}-\d\d-\d\dT/);
      assert.equal((await planFromMe(parent.token)).kind, 'premium');
      const rowsAfterFirst = entitlementRows(parent.userId);

      const second = runGrant('--db', dbPath, parent.email, '30', '--ref', 'cli-1');
      assert.equal(second.status, 0, second.stderr);
      assert.match(second.stdout, /already granted/);
      assert.deepEqual(entitlementRows(parent.userId), rowsAfterFirst);
      assert.equal(rowsAfterFirst.length, 1);
      assert.equal(rowsAfterFirst[0].source, 'manual');
    });

    test('without --ref, a rerun on the same day is still one entitlement', async () => {
      const parent = await signUp();
      const run = () => runGrant('--db', dbPath, parent.email, '7');

      assert.equal(run().status, 0);
      assert.equal(run().status, 0);
      assert.equal(entitlementRows(parent.userId).length, 1);
    });

    test('refuses to run without an explicit --db, and touches no default database', () => {
      const result = spawnSync(process.execPath, [GRANT_CLI, 'parent1@example.com', '30'], {
        encoding: 'utf8',
        cwd: dir,
        env: { ...process.env, DB_PATH: dbPath },
      });

      assert.equal(result.status, 2);
      assert.match(result.stderr, /--db <path> is required/);
      assert.equal(existsSync(join(dir, 'data')), false);
    });

    test('refuses a --db path that does not exist instead of creating it', () => {
      const missing = join(dir, 'typo.sqlite');

      const result = runGrant('--db', missing, 'parent1@example.com', '30');

      assert.equal(result.status, 2);
      assert.match(result.stderr, /does not exist/);
      assert.equal(existsSync(missing), false);
    });

    test('refuses, with a clear message, a database the server has not set up', () => {
      const bare = join(dir, 'bare.sqlite');
      new DatabaseSync(bare).close();

      const result = runGrant('--db', bare, 'parent1@example.com', '30');

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Database .*bare\.sqlite is not set up for accounts; start the server on it first\./);
      assert.doesNotMatch(result.stderr, /at .*\.ts:\d+/);
    });

    test('rejects bad days, an unknown source and an unknown email with a non-zero exit', () => {
      const cases = [
        { args: ['parent1@example.com', '0'], message: /days must be a whole number from 1 to 3650/ },
        { args: ['parent1@example.com', '2.5'], message: /days must be a whole number/ },
        { args: ['parent1@example.com', '30', '--source', 'paypal'], message: /source must be one of manual, app_store, google_play, card/ },
        { args: ['parent1@example.com'], message: /Usage/ },
        { args: ['parent1@example.com', '30', '--ref', ''], message: /--ref must not be empty/ },
        { args: ['parent1@example.com', '30', '--ref', '   '], message: /--ref must not be empty/ },
      ];
      for (const { args, message } of cases) {
        const result = runGrant('--db', dbPath, ...args);
        assert.equal(result.status, 2, args.join(' '));
        assert.match(result.stderr, message);
      }

      const unknown = runGrant('--db', dbPath, 'nobody@example.com', '30');
      assert.equal(unknown.status, 1);
      assert.match(unknown.stderr, /No account with email nobody@example\.com/);
    });
  });
});
