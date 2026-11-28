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
    server = await startServer({ port: 0, dbPath, signupsPerAddress: 1000 });
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
      answers: { 'kids-a0-u1-cat': [{ at: '2026-11-27T07:59:00.000Z', correct: true }] },
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

    test('a nickname of only invisible or control characters answers 400 next to the name', async () => {
      const parent = await signUp();

      for (const name of ['​', '‮⁦', '\n\t', '​ ‍']) {
        const response = await request('POST', '/api/profiles', parent.token, { name, picture: '🐶' });
        assert.equal(response.status, 400, JSON.stringify(name));
        assert.deepEqual(await response.json(), { error: 'invalid_name', field: 'name' });
      }
      assert.equal((await profilesOf(parent)).length, 1);
    });

    test('control and direction-override characters are removed from a stored nickname', async () => {
      const parent = await signUp();

      const child = await addChild(parent, 'a\n‮b⁩ c\u0000');

      assert.equal(child.name, 'ab c');
      assert.equal((await profilesOf(parent))[1].name, 'ab c');
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

    test('the owner profile cannot be changed: 400, and it keeps no name or picture', async () => {
      const parent = await signUp();

      const response = await request('PATCH', `/api/profiles/${parent.owner.id}`, parent.token, {
        name: 'Mẹ',
        picture: '🐼',
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'owner_profile' });
      assert.deepEqual((await profilesOf(parent))[0], parent.owner);
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

  describe('POST /api/profiles/:id/session and child-scoped tokens', () => {
    async function childSession(parent: Parent, child: Profile): Promise<string> {
      const response = await request('POST', `/api/profiles/${child.id}/session`, parent.token);
      assert.equal(response.status, 201);
      const body = (await response.json()) as { token: string; profile: Profile };
      assert.deepEqual(body.profile, child);
      assert.match(body.token, /^[A-Za-z0-9_-]{43}$/);
      return body.token;
    }

    async function family() {
      const parent = await signUp();
      const child = await addChild(parent, 'Bé Na', '🐱');
      const sibling = await addChild(parent, 'Bin', '🐶');
      for (const profile of [parent.owner, sibling]) {
        const saved = await request('PUT', `/api/profiles/${profile.id}/progress`, parent.token, progressDocument(profile.id));
        assert.equal(saved.status, 200);
      }
      return { parent, child, sibling, childToken: await childSession(parent, child) };
    }

    test("a child's token reads and saves that child's progress", async () => {
      const { parent, child, childToken } = await family();

      const saved = await request('PUT', `/api/profiles/${child.id}/progress`, childToken, progressDocument(child.id));
      assert.equal(saved.status, 200);
      const read = await request('GET', `/api/profiles/${child.id}/progress`, childToken);

      assert.equal(read.status, 200);
      assert.deepEqual(await read.json(), progressDocument(child.id));
      const asParent = await request('GET', `/api/profiles/${child.id}/progress`, parent.token);
      assert.deepEqual(await asParent.json(), progressDocument(child.id));
    });

    test("a child's token gets 404 for the owner's and a sibling's progress, and changes neither", async () => {
      const { parent, sibling, childToken } = await family();
      const empty = (id: string) => ({ schemaVersion: 1, profileId: id, lessons: {}, answers: {} });

      for (const profile of [parent.owner, sibling]) {
        const path = `/api/profiles/${profile.id}/progress`;
        const read = await request('GET', path, childToken);
        assert.equal(read.status, 404);
        assert.deepEqual(await read.json(), { error: 'not_found' });
        const write = await request('PUT', path, childToken, { ...empty(profile.id), lessons: { 'work-a0-u1': {} } });
        assert.equal(write.status, 404);
        assert.deepEqual(await (await request('GET', path, parent.token)).json(), progressDocument(profile.id));
      }
    });

    test("a child's token is refused with 403 by the account and profile endpoints, which change nothing", async () => {
      const { parent, child, childToken } = await family();
      const profilesBefore = await profilesOf(parent);
      const sessionsBefore = countRows('SELECT count(*) AS n FROM sessions');

      const refused = [
        await request('GET', '/api/me', childToken),
        await request('POST', '/api/profiles', childToken, { name: 'Em', picture: '🐼' }),
        await request('PATCH', `/api/profiles/${child.id}`, childToken, { name: 'Boss' }),
        await request('PATCH', `/api/profiles/${parent.owner.id}`, childToken, { name: 'Boss' }),
        await request('DELETE', `/api/profiles/${child.id}`, childToken),
        await request('POST', `/api/profiles/${child.id}/session`, childToken),
      ];

      for (const response of refused) {
        assert.equal(response.status, 403, response.url);
        assert.deepEqual(await response.json(), { error: 'forbidden' });
      }
      assert.deepEqual(await profilesOf(parent), profilesBefore);
      assert.equal(countRows('SELECT count(*) AS n FROM sessions'), sessionsBefore);
    });

    test("deleting the child ends its token; signing the child out leaves the parent's", async () => {
      const { parent, child, childToken } = await family();
      const secondToken = await childSession(parent, child);

      const signedOut = await request('POST', '/api/auth/signout', secondToken);
      assert.equal(signedOut.status, 204);
      assert.equal((await request('GET', `/api/profiles/${child.id}/progress`, secondToken)).status, 401);
      assert.equal((await request('GET', '/api/me', parent.token)).status, 200);

      assert.equal((await request('DELETE', `/api/profiles/${child.id}`, parent.token)).status, 204);
      assert.equal((await request('GET', `/api/profiles/${child.id}/progress`, childToken)).status, 401);
    });

    test('the owner profile gets no child session: 400', async () => {
      const parent = await signUp();

      const response = await request('POST', `/api/profiles/${parent.owner.id}/session`, parent.token);

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'owner_profile' });
    });

    test("another user's child answers 404 and starts no session", async () => {
      const { child } = await family();
      const stranger = await signUp();
      const sessionsBefore = countRows('SELECT count(*) AS n FROM sessions');

      const response = await request('POST', `/api/profiles/${child.id}/session`, stranger.token);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'not_found' });
      assert.equal(countRows('SELECT count(*) AS n FROM sessions'), sessionsBefore);
    });

    test('signed out answers 401', async () => {
      const { child } = await family();

      const response = await request('POST', `/api/profiles/${child.id}/session`);

      assert.equal(response.status, 401);
    });
  });
});
