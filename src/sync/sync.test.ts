import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';

import { signIn, signOut } from '@/account';
import { createProgressStore, LOCAL_PROFILE_ID, type Progress } from '@/progress';
import { mergeProgress } from '@/progress/merge';
import { startSync, syncProgress, syncState } from '@/sync';

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
    clear: () => values.clear(),
  };
});

const demo = { email: 'demo@hocenglish.test', password: 'hoc-english-demo' };
const signedInBody = {
  token: 'tok-1',
  user: { id: 'u1', email: demo.email },
  profiles: [{ id: 'p1', kind: 'owner', name: '' }],
};

const completion = (at: string) => ({
  firstCompletedAt: at,
  lastCompletedAt: at,
  bestCorrect: 8,
  total: 10,
  timesCompleted: 1,
});

/**
 * A stand-in for the API server (server/accounts.ts, server/progress.ts): the demo account owns
 * profile p1, whose progress PUT merges like the real server; `online` switches the network.
 */
function fakeServer(stored: Progress = { schemaVersion: 1, profileId: 'p1', lessons: {}, answers: {} }) {
  const server = { stored, online: true, puts: [] as unknown[] };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === '/api/auth/signin') return json(200, signedInBody);
    if (path === '/api/auth/signout') return new Response(null, { status: 204 });
    if (path === '/api/profiles/p1/progress' && init?.method === 'PUT') {
      if (new Headers(init.headers).get('authorization') !== 'Bearer tok-1') return json(401, {});
      const body = JSON.parse(String(init.body)) as Progress;
      server.puts.push(body);
      if (body.profileId !== 'p1') return json(400, { error: 'invalid_progress' });
      server.stored = mergeProgress(server.stored, body);
      return json(200, server.stored);
    }
    return json(404, { error: 'not_found' });
  });
  return server;
}

const store = createProgressStore({ now: () => new Date('2026-11-28T08:00:00.000Z') });
let stopSync: (() => void) | undefined;

beforeEach(async () => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

afterEach(() => {
  stopSync?.();
  stopSync = undefined;
});

describe('progress sync', () => {
  it('sends nothing and reports signed out when nobody is signed in', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });

    expect(await syncProgress()).toBe('signedOut');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds the device progress to the account on sign-in and brings back what the account had', async () => {
    const server = fakeServer({
      schemaVersion: 1,
      profileId: 'p1',
      lessons: { 'everyday-a0-u2': completion('2026-11-20T08:00:00.000Z') },
      answers: {},
    });
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    stopSync = startSync();

    await signIn(demo.email, demo.password);

    await waitFor(() => expect(syncState()).toBe('synced'));
    expect(Object.keys(server.stored.lessons).sort()).toEqual(['everyday-a0-u1', 'everyday-a0-u2']);
    const device = await store.load(LOCAL_PROFILE_ID);
    expect(Object.keys(device.lessons).sort()).toEqual(['everyday-a0-u1', 'everyday-a0-u2']);
    expect(device.profileId).toBe(LOCAL_PROFILE_ID);
  });

  it('pushes an answer saved while signed in', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    stopSync = startSync();

    await store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-3', correct: true });

    await waitFor(() =>
      expect(server.stored.answers['everyday-a0-u1-3']).toEqual([{ at: '2026-11-28T08:00:00.000Z', correct: true }])
    );
  });

  it('keeps progress on the device while offline and pushes it once the server answers again', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    server.online = false;
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });

    expect(await syncProgress()).toBe('offline');
    expect(syncState()).toBe('offline');
    expect(isCompletedOnDevice(await store.load(LOCAL_PROFILE_ID))).toBe(true);

    server.online = true;
    expect(await syncProgress()).toBe('synced');
    expect(Object.keys(server.stored.lessons)).toEqual(['everyday-a0-u1']);
  });

  it('keeps the device copy unchanged when the server answers with something unreadable', async () => {
    fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"lessons":"nope"}', { status: 200 }));

    expect(await syncProgress()).toBe('failed');
    expect(isCompletedOnDevice(await store.load(LOCAL_PROFILE_ID))).toBe(true);
  });

  it('stops syncing after sign-out', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    stopSync = startSync();
    await signOut();
    await waitFor(() => expect(syncState()).toBe('signedOut'));
    const putsBefore = server.puts.length;

    await store.recordAnswer(LOCAL_PROFILE_ID, { itemId: 'everyday-a0-u1-3', correct: true });

    expect(await syncProgress()).toBe('signedOut');
    expect(server.puts.length).toBe(putsBefore);
  });
});

function isCompletedOnDevice(progress: Progress): boolean {
  return 'everyday-a0-u1' in progress.lessons;
}
