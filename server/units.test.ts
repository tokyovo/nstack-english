import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

import { grantPremium } from './entitlements.ts';
import { startServer, type RunningServer } from './server.ts';

// The first 3 units of each track are free (FREE_UNITS_PER_TRACK), so everyday u4 needs Premium.
const PREMIUM_UNIT = 'everyday-a0-u4';
const FREE_UNIT = 'everyday-a0-u1';

function exerciseIdsInFile(path: string): string[] {
  const unit = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'content', path), 'utf8')) as {
    exercises: { id: string }[];
  };
  return unit.exercises.map((e) => e.id);
}

describe('GET /api/units/:id', () => {
  let dir: string;
  let dbPath: string;
  let server: RunningServer;
  const clock = Date.parse('2026-11-28T09:00:00Z');
  let emailCounter = 0;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'units-test-'));
    dbPath = join(dir, 'app.sqlite');
    server = await startServer({ port: 0, dbPath, now: () => new Date(clock) });
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
    const email = `learner${emailCounter}@example.com`;
    const response = await request('POST', '/api/auth/signup', undefined, { email, password: 'correct horse' });
    assert.equal(response.status, 201);
    return { email, token: ((await response.json()) as { token: string }).token };
  }

  async function premiumUser() {
    const user = await signUp();
    const db = new DatabaseSync(dbPath);
    try {
      grantPremium(db, { email: user.email, days: 30, source: 'manual', ref: `units-${user.email}` }, new Date(clock));
    } finally {
      db.close();
    }
    return user;
  }

  async function childTokenOf(parent: { token: string }) {
    const added = await request('POST', '/api/profiles', parent.token, { name: 'Bé Na', picture: '🐱' });
    const { profile } = (await added.json()) as { profile: { id: string } };
    const session = await request('POST', `/api/profiles/${profile.id}/session`, parent.token);
    return ((await session.json()) as { token: string }).token;
  }

  async function exerciseIdsOf(response: Response): Promise<string[]> {
    const { unit } = (await response.json()) as { unit: { exercises: { id: string }[] } };
    return unit.exercises.map((e) => e.id);
  }

  describe('a premium unit', () => {
    test('signed out answers 401 without the unit', async () => {
      const response = await request('GET', `/api/units/${PREMIUM_UNIT}`);

      assert.equal(response.status, 401);
      assert.doesNotMatch(await response.text(), /exercises/);
    });

    test('a free user answers 403 without the unit', async () => {
      const free = await signUp();

      const response = await request('GET', `/api/units/${PREMIUM_UNIT}`, free.token);

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'premium_required' });
    });

    test("a free user's child answers 403", async () => {
      const childToken = await childTokenOf(await signUp());

      const response = await request('GET', `/api/units/${PREMIUM_UNIT}`, childToken);

      assert.equal(response.status, 403);
    });

    test('a Premium user gets its words and exercises', async () => {
      const premium = await premiumUser();

      const response = await request('GET', `/api/units/${PREMIUM_UNIT}`, premium.token);

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.deepEqual(await exerciseIdsOf(response), exerciseIdsInFile('everyday/a0/u4.json'));
    });

    test("a Premium user's child gets it too", async () => {
      const childToken = await childTokenOf(await premiumUser());

      const response = await request('GET', `/api/units/${PREMIUM_UNIT}`, childToken);

      assert.equal(response.status, 200);
      assert.deepEqual(await exerciseIdsOf(response), exerciseIdsInFile('everyday/a0/u4.json'));
    });
  });

  test('a free unit answers 200 to anyone, signed out too', async () => {
    const response = await request('GET', `/api/units/${FREE_UNIT}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await exerciseIdsOf(response), exerciseIdsInFile('everyday/a0/u1.json'));
  });

  test('an unknown unit answers 404', async () => {
    const response = await request('GET', '/api/units/everyday-a0-u999');

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'not_found' });
  });
});
