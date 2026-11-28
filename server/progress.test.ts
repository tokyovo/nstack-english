import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

import { startServer, type RunningServer } from './server.ts';

type Account = { token: string; profileId: string };

describe('profile progress', () => {
  let dir: string;
  let server: RunningServer;
  let emailCounter = 0;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'progress-test-'));
    server = await startServer({ port: 0, dbPath: join(dir, 'app.sqlite') });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function signUp(): Promise<Account> {
    emailCounter += 1;
    const response = await fetch(`${server.url}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `learner${emailCounter}@example.com`, password: 'correct horse' }),
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { token: string; profiles: { id: string }[] };
    return { token: body.token, profileId: body.profiles[0].id };
  }

  function getProgress(profileId: string, token?: string) {
    return fetch(`${server.url}/api/profiles/${profileId}/progress`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  function putProgress(profileId: string, body: unknown, token?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return fetch(`${server.url}/api/profiles/${profileId}/progress`, { method: 'PUT', headers, body: text });
  }

  function document(profileId: string, unitId = 'everyday-a0-u1', bestCorrect = 8) {
    return {
      schemaVersion: 1,
      profileId,
      lessons: {
        [unitId]: {
          firstCompletedAt: '2026-11-27T08:00:00.000Z',
          lastCompletedAt: '2026-11-27T08:00:00.000Z',
          bestCorrect,
          total: 10,
          timesCompleted: 1,
        },
      },
      answers: { [`${unitId}-e01`]: [{ at: '2026-11-27T07:59:00.000Z', correct: true }] },
    };
  }

  describe('GET /api/profiles/:id/progress', () => {
    test('a profile with nothing saved answers empty progress', async () => {
      const { token, profileId } = await signUp();

      const response = await getProgress(profileId, token);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { schemaVersion: 1, profileId, lessons: {}, answers: {} });
    });

    test('answers what was saved with PUT', async () => {
      const { token, profileId } = await signUp();
      await putProgress(profileId, document(profileId), token);

      const response = await getProgress(profileId, token);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), document(profileId));
    });

    test('signed out answers 401', async () => {
      const { profileId } = await signUp();

      const response = await getProgress(profileId);

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'unauthorized' });
    });

    test("another user's profile answers 404", async () => {
      const owner = await signUp();
      await putProgress(owner.profileId, document(owner.profileId), owner.token);
      const other = await signUp();

      const response = await getProgress(owner.profileId, other.token);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'not_found' });
    });

    test('an unknown profile id answers 404', async () => {
      const { token } = await signUp();

      const response = await getProgress('no-such-profile', token);

      assert.equal(response.status, 404);
    });
  });

  describe('PUT /api/profiles/:id/progress', () => {
    test('merges with what the server has and returns the merged document', async () => {
      const { token, profileId } = await signUp();
      await putProgress(profileId, document(profileId, 'everyday-a0-u1', 8), token);
      const second = document(profileId, 'everyday-a0-u1', 6);
      second.lessons['everyday-a0-u1'].lastCompletedAt = '2026-11-28T08:00:00.000Z';
      second.answers['everyday-a0-u1-e01'] = [{ at: '2026-11-28T07:59:00.000Z', correct: false }];

      const response = await putProgress(profileId, second, token);

      assert.equal(response.status, 200);
      const merged = {
        schemaVersion: 1,
        profileId,
        lessons: {
          'everyday-a0-u1': {
            firstCompletedAt: '2026-11-27T08:00:00.000Z',
            lastCompletedAt: '2026-11-28T08:00:00.000Z',
            bestCorrect: 8,
            total: 10,
            timesCompleted: 1,
          },
        },
        answers: {
          'everyday-a0-u1-e01': [
            { at: '2026-11-27T07:59:00.000Z', correct: true },
            { at: '2026-11-28T07:59:00.000Z', correct: false },
          ],
        },
      };
      assert.deepEqual(await response.json(), merged);
      assert.deepEqual(await (await getProgress(profileId, token)).json(), merged);
    });

    test('sending the same document twice leaves the same progress', async () => {
      const { token, profileId } = await signUp();
      const first = await (await putProgress(profileId, document(profileId), token)).json();

      const again = await putProgress(profileId, document(profileId), token);

      assert.equal(again.status, 200);
      assert.deepEqual(await again.json(), first);
    });

    test('signed out answers 401 and changes nothing', async () => {
      const { token, profileId } = await signUp();
      await putProgress(profileId, document(profileId, 'everyday-a0-u1'), token);

      const response = await putProgress(profileId, document(profileId, 'work-a0-u1'));

      assert.equal(response.status, 401);
      assert.deepEqual(await (await getProgress(profileId, token)).json(), document(profileId, 'everyday-a0-u1'));
    });

    test("another user's profile answers 404 and changes nothing", async () => {
      const owner = await signUp();
      await putProgress(owner.profileId, document(owner.profileId, 'everyday-a0-u1'), owner.token);
      const other = await signUp();

      const response = await putProgress(owner.profileId, document(owner.profileId, 'work-a0-u1'), other.token);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'not_found' });
      assert.deepEqual(
        await (await getProgress(owner.profileId, owner.token)).json(),
        document(owner.profileId, 'everyday-a0-u1'),
      );
      assert.deepEqual(await (await getProgress(other.profileId, other.token)).json(), {
        schemaVersion: 1,
        profileId: other.profileId,
        lessons: {},
        answers: {},
      });
    });

    test('a document that is not valid progress answers 400 and changes nothing', async () => {
      const { token, profileId } = await signUp();
      await putProgress(profileId, document(profileId), token);
      const broken = document(profileId);
      const invalid = [
        '{not json',
        [],
        { ...broken, schemaVersion: 99 },
        { ...broken, lessons: { 'everyday-a0-u1': { bestCorrect: 'many' } } },
        { ...broken, answers: { item: [{ at: 'yesterday', correct: true }] } },
      ];

      for (const body of invalid) {
        const response = await putProgress(profileId, body, token);
        assert.equal(response.status, 400, JSON.stringify(body));
        assert.deepEqual(await response.json(), { error: 'invalid_progress' });
      }
      assert.deepEqual(await (await getProgress(profileId, token)).json(), document(profileId));
    });

    test('a document for a different profile id than the path answers 400', async () => {
      const mine = await signUp();
      const other = await signUp();

      const response = await putProgress(mine.profileId, document(other.profileId), mine.token);

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'invalid_progress' });
    });

    test('drops units and items that are not in the content, keeping the rest, premium units too', async () => {
      const { token, profileId } = await signUp();
      const sent = document(profileId);
      sent.lessons['made-up-unit'] = { ...sent.lessons['everyday-a0-u1'] };
      sent.lessons['kids-a2-u10'] = { ...sent.lessons['everyday-a0-u1'] };
      sent.answers['everyday-a0-u1-hello'] = [{ at: '2026-11-27T08:01:00.000Z', correct: true }];
      sent.answers['kids-a2-u10-happy'] = [{ at: '2026-11-27T08:03:00.000Z', correct: true }];
      sent.answers['junk-000001'] = [{ at: '2026-11-27T08:02:00.000Z', correct: false }];

      const response = await putProgress(profileId, sent, token);

      const expected = document(profileId);
      expected.lessons['kids-a2-u10'] = { ...expected.lessons['everyday-a0-u1'] };
      expected.answers['everyday-a0-u1-hello'] = [{ at: '2026-11-27T08:01:00.000Z', correct: true }];
      expected.answers['kids-a2-u10-happy'] = [{ at: '2026-11-27T08:03:00.000Z', correct: true }];
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
      assert.deepEqual(await (await getProgress(profileId, token)).json(), expected);
    });

    test('many PUTs of new answers keep at most 7 answers per item stored', async () => {
      const { token, profileId } = await signUp();
      for (let day = 1; day <= 12; day += 1) {
        const sent = document(profileId);
        sent.answers['everyday-a0-u1-e01'] = [{ at: `2026-11-${String(day).padStart(2, '0')}T08:00:00.000Z`, correct: true }];
        await putProgress(profileId, sent, token);
      }

      const stored = (await (await getProgress(profileId, token)).json()) as { answers: Record<string, unknown[]> };

      assert.equal(stored.answers['everyday-a0-u1-e01'].length, 7);
    });

    test('a body over 1 MB answers 413', async () => {
      const { token, profileId } = await signUp();
      const huge = document(profileId);
      huge.answers['everyday-a0-u1-e01'] = Array.from({ length: 30_000 }, (_, i) => ({
        at: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
        correct: true,
      }));

      const response = await putProgress(profileId, huge, token);

      assert.equal(response.status, 413);
    });
  });
});
