import { signIn, signOut } from '@/account';
import { addChild, deleteChild, loadProgressSummary, updateChild } from '@/account/profiles';
import { createProgressStore } from '@/progress';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// The device keychain is not available in Jest: an in-memory stand-in with the same API.
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void values.set(key, value),
    deleteItemAsync: async (key: string) => void values.delete(key),
  };
});

const signedInBody = {
  token: 'tok-1',
  user: { id: 'u1', email: 'demo@hocenglish.test' },
  profiles: [{ id: 'p1', kind: 'owner', name: '', picture: null }],
};
const child = { id: 'c1', kind: 'child', name: 'Bé Na', picture: '🐱' };

type Reply = { status: number; body?: unknown } | 'offline';

/** The API server answers each request in turn with the given replies. */
function serverReplies(...replies: Reply[]) {
  jest.restoreAllMocks();
  const fetchMock = jest.spyOn(global, 'fetch');
  for (const reply of replies) {
    if (reply === 'offline') {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    } else {
      const body = reply.body === undefined ? null : JSON.stringify(reply.body);
      fetchMock.mockResolvedValueOnce(new Response(body, { status: reply.status }));
    }
  }
  return fetchMock;
}

/** Signs in, then lets the server answer the next requests with `replies`. */
async function signedInThen(...replies: Reply[]) {
  serverReplies({ status: 200, body: signedInBody });
  await signIn('demo@hocenglish.test', 'hoc-english-demo');
  return serverReplies(...replies);
}

function sent(fetchMock: jest.SpyInstance, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit | undefined];
  return {
    url,
    method: init?.method,
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    authorization: new Headers(init?.headers).get('authorization'),
  };
}

afterEach(async () => {
  serverReplies({ status: 204 });
  await signOut();
  jest.restoreAllMocks();
});

describe('adding a child profile', () => {
  it('sends the nickname and picture with the parent token', async () => {
    const fetchMock = await signedInThen({ status: 201, body: { profile: child } });

    expect(await addChild({ name: 'Bé Na', picture: '🐱' })).toEqual({ ok: true });
    expect(sent(fetchMock)).toEqual({
      url: '/api/profiles',
      method: 'POST',
      body: { name: 'Bé Na', picture: '🐱' },
      authorization: 'Bearer tok-1',
    });
  });

  it('reports an empty nickname against the name field without asking the server', async () => {
    const fetchMock = await signedInThen();

    expect(await addChild({ name: '   ', picture: '🐱' })).toEqual({
      ok: false,
      error: { code: 'invalid_name', field: 'name' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 400, body: { error: 'invalid_name', field: 'name' } }, { code: 'invalid_name', field: 'name' }],
    [{ status: 400, body: { error: 'invalid_picture', field: 'picture' } }, { code: 'invalid_picture', field: 'picture' }],
    [{ status: 409, body: { error: 'too_many_children' } }, { code: 'too_many_children' }],
    [{ status: 401, body: { error: 'unauthorized' } }, { code: 'signed_out' }],
    ['offline', { code: 'offline' }],
    [{ status: 500 }, { code: 'unknown' }],
  ] as const)('turns the answer %j into the error %j', async (reply, error) => {
    await signedInThen(reply);

    expect(await addChild({ name: 'Bé Na', picture: '🐱' })).toEqual({ ok: false, error });
  });

  it('is refused on the device when signed out', async () => {
    const fetchMock = serverReplies();

    expect(await addChild({ name: 'Bé Na', picture: '🐱' })).toEqual({ ok: false, error: { code: 'signed_out' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('changing and deleting a child profile', () => {
  it('sends the new nickname and picture for that profile', async () => {
    const fetchMock = await signedInThen({ status: 200, body: { profile: { ...child, name: 'Na' } } });

    expect(await updateChild('c1', { name: 'Na', picture: '🐼' })).toEqual({ ok: true });
    expect(sent(fetchMock)).toEqual({
      url: '/api/profiles/c1',
      method: 'PATCH',
      body: { name: 'Na', picture: '🐼' },
      authorization: 'Bearer tok-1',
    });
  });

  it('deletes that profile', async () => {
    const fetchMock = await signedInThen({ status: 204 });

    expect(await deleteChild('c1')).toEqual({ ok: true });
    expect(sent(fetchMock)).toEqual({
      url: '/api/profiles/c1',
      method: 'DELETE',
      body: undefined,
      authorization: 'Bearer tok-1',
    });
  });

  it("leaves none of the deleted child's progress on this device", async () => {
    const store = createProgressStore();
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });
    await signedInThen({ status: 204 });

    expect(await deleteChild('c1')).toEqual({ ok: true });
    expect((await store.load('c1')).lessons).toEqual({});
  });

  it("keeps the child's device progress when the server does not delete the profile", async () => {
    const store = createProgressStore();
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });
    await signedInThen('offline');

    expect(await deleteChild('c1')).toEqual({ ok: false, error: { code: 'offline' } });
    expect(Object.keys((await store.load('c1')).lessons)).toEqual(['kids-a0-u1']);
  });

  it('reports a profile the server does not know', async () => {
    await signedInThen({ status: 404, body: { error: 'not_found' } });

    expect(await deleteChild('c1')).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('a profile progress summary', () => {
  const finishedAt = new Date('2026-11-20T08:00:00.000Z');
  const progress = {
    schemaVersion: 1,
    profileId: 'c1',
    lessons: {
      'everyday-a0-u1': {
        firstCompletedAt: finishedAt.toISOString(),
        lastCompletedAt: finishedAt.toISOString(),
        bestCorrect: 10,
        total: 12,
        timesCompleted: 1,
      },
    },
    // Answered right a minute after the lesson: box 2, not due again for a day.
    answers: { 'everyday-a0-u1-hello': [{ at: '2026-11-20T08:01:00.000Z', correct: true }] },
  };

  it('counts finished lessons and the words due, read with the parent token', async () => {
    const fetchMock = await signedInThen({ status: 200, body: progress });
    const anHourLater = new Date('2026-11-20T09:00:00.000Z');

    // Unit 1 has 9 words; all but "hello" waited past their 10 minutes in box 1.
    expect(await loadProgressSummary('c1', anHourLater)).toEqual({ lessonsCompleted: 1, wordsDue: 8 });
    expect(sent(fetchMock)).toMatchObject({ url: '/api/profiles/c1/progress', authorization: 'Bearer tok-1' });
  });

  it('is nothing learned yet for a new profile', async () => {
    await signedInThen({ status: 200, body: { ...progress, lessons: {}, answers: {} } });

    expect(await loadProgressSummary('c1', new Date())).toEqual({ lessonsCompleted: 0, wordsDue: 0 });
  });

  it('is unavailable while offline or when the answer is not progress', async () => {
    await signedInThen('offline', { status: 200, body: { nope: true } });

    expect(await loadProgressSummary('c1', new Date())).toBeUndefined();
    expect(await loadProgressSummary('c1', new Date())).toBeUndefined();
  });
});
