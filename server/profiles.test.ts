import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

import { startServer, type RunningServer } from './server.ts';

type Profile = { id: string; kind: 'owner' | 'child'; name: string; picture: string | null };
type Parent = { token: string; owner: Profile };

describe('family profiles', () => {
  let dir: string;
  let dbPath: string;
  let server: RunningServer;
  let emailCounter = 0;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'profiles-test-'));
    dbPath = join(dir, 'app.sqlite');
    server = await startServer({ port: 0, dbPath });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function request(method: string, path: string, token?: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${server.url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  async function signUp(): Promise<Parent> {
    emailCounter += 1;
    const response = await request('POST', '/api/auth/signup', undefined, {
      email: `parent${emailCounter}@example.com`,
      password: 'correct horse',
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { token: string; profiles: Profile[] };
    return { token: body.token, owner: body.profiles[0] };
  }

  async function addChild(parent: Parent, name = 'Bé Na', picture = '🐱'): Promise<Profile> {
    const response = await request('POST', '/api/profiles', parent.token, { name, picture });
    assert.equal(response.status, 201);
    return ((await response.json()) as { profile: Profile }).profile;
  }

  async function profilesOf(parent: Parent): Promise<Profile[]> {
    const response = await request('GET', '/api/me', parent.token);
    assert.equal(response.status, 200);
    return ((await response.json()) as { profiles: Profile[] }).profiles;
  }

  function countRows(sql: string, ...params: string[]): number {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return Number(db.prepare(sql).get(...params)?.n);
    } finally {
      db.close();
    }
  }

  function progressDocument(profileId: string) {
    return {
      schemaVersion: 1,
      profileId,
      lessons: {
        'kids-a0-u1': {
          firstCompletedAt: '2026-11-27T08:00:00.000Z',
          lastCompletedAt: '2026-11-27T08:00:00.000Z',
          bestCorrect: 8,
          total: 10,
          timesCompleted: 1,
        },
      },
      answers: { 'kids-a0-u1-1': [{ at: '2026-11-27T07:59:00.000Z', correct: true }] },
    };
  }

  describe('POST /api/profiles', () => {
    test('creates a child with a nickname and a picture, listed after the owner', async () => {
      const parent = await signUp();

      const response = await request('POST', '/api/profiles', parent.token, { name: '  Bé Na ', picture: '🐱' });

      assert.equal(response.status, 201);
      const { profile } = (await response.json()) as { profile: Profile };
      assert.equal(profile.kind, 'child');
      assert.equal(profile.name, 'Bé Na');
      assert.equal(profile.picture, '🐱');
      assert.deepEqual(
        (await profilesOf(parent)).map((p) => [p.kind, p.name, p.picture]),
        [
          ['owner', '', null],
          ['child', 'Bé Na', '🐱'],
        ],
      );
    });

    test('a nickname of 20 characters is accepted, 21 or blank answers 400 next to the name', async () => {
      const parent = await signUp();
      await addChild(parent, 'Nguyễn Thị Minh Khai'.padEnd(20, 'a'));

      for (const name of ['a'.repeat(21), '   ', '', 42, undefined]) {
        const response = await request('POST', '/api/profiles', parent.token, { name, picture: '🐶' });
        assert.equal(response.status, 400, String(name));
        assert.deepEqual(await response.json(), { error: 'invalid_name', field: 'name' });
      }
      assert.equal((await profilesOf(parent)).length, 2);
    });

    test('a picture outside the fixed set answers 400 next to the picture', async () => {
      const parent = await signUp();

      for (const picture of ['🦄', 'https://example.com/me.jpg', '', undefined]) {
        const response = await request('POST', '/api/profiles', parent.token, { name: 'Bin', picture });
        assert.equal(response.status, 400, String(picture));
        assert.deepEqual(await response.json(), { error: 'invalid_picture', field: 'picture' });
      }
      assert.equal((await profilesOf(parent)).length, 1);
    });

    test('a body that is not JSON answers 400', async () => {
      const parent = await signUp();

      const response = await request('POST', '/api/profiles', parent.token, '{not json');

      assert.equal(response.status, 400);
    });

    test('stores only the nickname and picture, whatever else is sent', async () => {
      const parent = await signUp();
      const response = await request('POST', '/api/profiles', parent.token, {
        name: 'Bin',
        picture: '🐶',
        kind: 'owner',
        email: 'child@example.com',
        birthday: '2019-01-01',
      });

      assert.equal(response.status, 201);
      const { profile } = (await response.json()) as { profile: Profile };
      assert.deepEqual(Object.keys(profile).sort(), ['id', 'kind', 'name', 'picture']);
      assert.equal(profile.kind, 'child');
    });

    test('a fifth child answers 409 and creates nothing', async () => {
      const parent = await signUp();
      for (const name of ['An', 'Bình', 'Chi', 'Dũng']) await addChild(parent, name);

      const response = await request('POST', '/api/profiles', parent.token, { name: 'Em', picture: '🐼' });

      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: 'too_many_children' });
      assert.equal((await profilesOf(parent)).length, 5);
    });

    test('signed out answers 401 and creates nothing', async () => {
      const before = countRows('SELECT count(*) AS n FROM profiles');

      const response = await request('POST', '/api/profiles', undefined, { name: 'Bin', picture: '🐶' });

      assert.equal(response.status, 401);
      assert.equal(countRows('SELECT count(*) AS n FROM profiles'), before);
    });
  });

  describe('PATCH /api/profiles/:id', () => {
    test('renames a child or changes its picture', async () => {
      const parent = await signUp();
      const child = await addChild(parent, 'Bé Na', '🐱');

      const renamed = await request('PATCH', `/api/profiles/${child.id}`, parent.token, { name: 'Na' });
      assert.equal(renamed.status, 200);
      assert.deepEqual(await renamed.json(), { profile: { ...child, name: 'Na' } });

      const repictured = await request('PATCH', `/api/profiles/${child.id}`, parent.token, { picture: '🦊' });
      assert.equal(repictured.status, 200);
      assert.deepEqual(await repictured.json(), { profile: { ...child, name: 'Na', picture: '🦊' } });
    });

    test('an invalid name or picture, or neither, answers 400 and changes nothing', async () => {
      const parent = await signUp();
      const child = await addChild(parent);

      const cases: [unknown, object][] = [
        [{ name: '' }, { error: 'invalid_name', field: 'name' }],
        [{ picture: '🦄' }, { error: 'invalid_picture', field: 'picture' }],
        [{ name: 'Na', picture: '🦄' }, { error: 'invalid_picture', field: 'picture' }],
        [{}, { error: 'invalid_body' }],
      ];
      for (const [body, error] of cases) {
        const response = await request('PATCH', `/api/profiles/${child.id}`, parent.token, body);
        assert.equal(response.status, 400, JSON.stringify(body));
        assert.deepEqual(await response.json(), error);
      }
      assert.deepEqual((await profilesOf(parent))[1], child);
    });

    test("another user's child answers 404 and changes nothing", async () => {
      const parent = await signUp();
      const child = await addChild(parent);
      const stranger = await signUp();

      const response = await request('PATCH', `/api/profiles/${child.id}`, stranger.token, { name: 'Mine' });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'not_found' });
      assert.deepEqual((await profilesOf(parent))[1], child);
    });

    test('signed out answers 401 and changes nothing', async () => {
      const parent = await signUp();
      const child = await addChild(parent);

      const response = await request('PATCH', `/api/profiles/${child.id}`, undefined, { name: 'Mine' });

      assert.equal(response.status, 401);
      assert.deepEqual((await profilesOf(parent))[1], child);
    });
  });

  describe('DELETE /api/profiles/:id', () => {
    test('deletes a child and its progress', async () => {
      const parent = await signUp();
      const child = await addChild(parent);
      const saved = await request('PUT', `/api/profiles/${child.id}/progress`, parent.token, progressDocument(child.id));
      assert.equal(saved.status, 200);

      const response = await request('DELETE', `/api/profiles/${child.id}`, parent.token);

      assert.equal(response.status, 204);
      assert.deepEqual(await profilesOf(parent), [parent.owner]);
      assert.equal(countRows('SELECT count(*) AS n FROM progress WHERE profile_id = ?', child.id), 0);
      assert.equal((await request('GET', `/api/profiles/${child.id}/progress`, parent.token)).status, 404);
    });

    test('the owner profile cannot be deleted: 400', async () => {
      const parent = await signUp();

      const response = await request('DELETE', `/api/profiles/${parent.owner.id}`, parent.token);

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'owner_profile' });
      assert.deepEqual(await profilesOf(parent), [parent.owner]);
    });

    test("another user's child answers 404 and keeps the child and its progress", async () => {
      const parent = await signUp();
      const child = await addChild(parent);
      await request('PUT', `/api/profiles/${child.id}/progress`, parent.token, progressDocument(child.id));
      const stranger = await signUp();

      const response = await request('DELETE', `/api/profiles/${child.id}`, stranger.token);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'not_found' });
      assert.deepEqual((await profilesOf(parent))[1], child);
      assert.equal(countRows('SELECT count(*) AS n FROM progress WHERE profile_id = ?', child.id), 1);
    });

    test('signed out answers 401 and keeps the child', async () => {
      const parent = await signUp();
      const child = await addChild(parent);

      const response = await request('DELETE', `/api/profiles/${child.id}`);

      assert.equal(response.status, 401);
      assert.deepEqual((await profilesOf(parent))[1], child);
    });

    test('an unknown id answers 404', async () => {
      const parent = await signUp();

      const response = await request('DELETE', '/api/profiles/no-such-profile', parent.token);

      assert.equal(response.status, 404);
    });
  });
});
