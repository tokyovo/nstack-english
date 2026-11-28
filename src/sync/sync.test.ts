import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';

import { signIn, signOut, startChildSession, syncSession } from '@/account';
import { createProgressStore, LOCAL_PROFILE_ID, type Progress } from '@/progress';
import { mergeProgress } from '@/progress/merge';
import { leaveChildProfile, signOutOfDevice, startSync, syncProgress, syncState } from '@/sync';

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
  profiles: [
    { id: 'p1', kind: 'owner', name: '', picture: null },
    { id: 'c1', kind: 'child', name: 'Bé Na', picture: '🐱' },
  ],
};

const completion = (at: string) => ({
  firstCompletedAt: at,
  lastCompletedAt: at,
  bestCorrect: 8,
  total: 10,
  timesCompleted: 1,
});

/**
 * A stand-in for the API server (server/accounts.ts, server/profiles.ts, server/progress.ts): the
 * demo account owns profile p1, whose progress PUT merges like the real server, and the child c1,
 * whose progress the child's token child-tok and the parent's tok-1 reach; `online` switches the network
 * and `childFails` makes the child's progress answer 500.
 */
function fakeServer(stored: Progress = { schemaVersion: 1, profileId: 'p1', lessons: {}, answers: {} }) {
  const server = {
    stored,
    child: { schemaVersion: 1, profileId: 'c1', lessons: {}, answers: {} } as Progress,
    online: true,
    childFails: false,
    puts: [] as unknown[],
    signedOut: [] as string[],
  };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === '/api/auth/signin') return json(200, signedInBody);
    if (path === '/api/auth/signout') {
      server.signedOut.push(new Headers(init?.headers).get('authorization') ?? '');
      return new Response(null, { status: 204 });
    }
    if (path === '/api/profiles/c1/session') {
      return json(201, { token: 'child-tok', profile: signedInBody.profiles[1] });
    }
    if (path === '/api/profiles/c1/progress' && init?.method === 'PUT') {
      // The child's own token and the parent's whole-account token both reach the child's progress.
      const auth = new Headers(init.headers).get('authorization');
      if (auth !== 'Bearer child-tok' && auth !== 'Bearer tok-1') return json(404, {});
      if (server.childFails) return json(500, { error: 'internal' });
      server.child = mergeProgress(server.child, JSON.parse(String(init.body)) as Progress);
      return json(200, server.child);
    }
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

describe('progress sync for a child learning on the device', () => {
  it("keeps the child's progress in its own device copy and sends it with the child's token", async () => {
    const server = fakeServer();
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    await signIn(demo.email, demo.password);
    expect(await syncProgress()).toBe('synced');
    await startChildSession('c1');
    stopSync = startSync();

    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });

    await waitFor(() => expect(Object.keys(server.child.lessons)).toEqual(['kids-a0-u1']));
    expect(Object.keys(server.stored.lessons)).toEqual(['everyday-a0-u1']);
    expect(Object.keys((await store.load(LOCAL_PROFILE_ID)).lessons)).toEqual(['everyday-a0-u1']);
    expect(Object.keys((await store.load('c1')).lessons)).toEqual(['kids-a0-u1']);
  });

  it("brings the child's account progress to the device when the child starts", async () => {
    const server = fakeServer();
    server.child.lessons = { 'kids-a0-u2': completion('2026-11-20T08:00:00.000Z') };
    await signIn(demo.email, demo.password);
    stopSync = startSync();

    await startChildSession('c1');

    await waitFor(async () => expect(Object.keys((await store.load('c1')).lessons)).toEqual(['kids-a0-u2']));
    expect((await store.load(LOCAL_PROFILE_ID)).lessons).toEqual({});
  });

  it("saves the child's progress, then ends the child's session, when the parent takes the device back", async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await startChildSession('c1');
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });

    await leaveChildProfile();

    expect(Object.keys(server.child.lessons)).toEqual(['kids-a0-u1']);
    expect(server.signedOut).toEqual(['Bearer child-tok']);
    expect(await syncProgress()).toBe('synced');
    expect(server.stored.lessons).toEqual({});
  });
});

describe('signing out of this device', () => {
  it('sends the device progress to the account first, then leaves none on the device', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });

    expect(await signOutOfDevice()).toBe('signedOut');

    expect(Object.keys(server.stored.lessons)).toEqual(['everyday-a0-u1']);
    expect(await store.load(LOCAL_PROFILE_ID)).toEqual({
      schemaVersion: 1,
      profileId: LOCAL_PROFILE_ID,
      lessons: {},
      answers: {},
    });
    expect(await syncSession()).toBeUndefined();
  });

  it('stays signed in with the device progress kept when the progress cannot be sent', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    server.online = false;

    expect(await signOutOfDevice()).toBe('offline');

    expect(isCompletedOnDevice(await store.load(LOCAL_PROFILE_ID))).toBe(true);
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: LOCAL_PROFILE_ID });
  });

  it('reports a failed sync rather than signing out when the server answers with something unreadable', async () => {
    fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"lessons":"nope"}', { status: 200 }));

    expect(await signOutOfDevice()).toBe('failed');

    expect(isCompletedOnDevice(await store.load(LOCAL_PROFILE_ID))).toBe(true);
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: LOCAL_PROFILE_ID });
  });

  it('signs out and discards the unsent progress when the learner chooses to', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    server.online = false;

    expect(await signOutOfDevice({ discardUnsynced: true })).toBe('signedOut');

    expect(isCompletedOnDevice(await store.load(LOCAL_PROFILE_ID))).toBe(false);
    expect(await syncSession()).toBeUndefined();
    server.online = true;
    expect(server.stored.lessons).toEqual({});
  });

  it('lets the next sign-in on the device start from that account only', async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    stopSync = startSync();
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    expect(await signOutOfDevice()).toBe('signedOut');

    // The next person's account has only everyday A0 u2.
    server.stored = {
      schemaVersion: 1,
      profileId: 'p1',
      lessons: { 'everyday-a0-u2': completion('2026-11-20T08:00:00.000Z') },
      answers: {},
    };
    await signIn(demo.email, demo.password);

    await waitFor(() => expect(syncState()).toBe('synced'));
    expect(Object.keys((await store.load(LOCAL_PROFILE_ID)).lessons)).toEqual(['everyday-a0-u2']);
    expect(Object.keys(server.stored.lessons)).toEqual(['everyday-a0-u2']);
  });
});

describe('signing out of a family device', () => {
  it("saves the parent's and the active child's progress, ends both sessions and leaves neither on the device", async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    await startChildSession('c1');
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });

    expect(await signOutOfDevice()).toBe('signedOut');

    expect(Object.keys(server.stored.lessons)).toEqual(['everyday-a0-u1']);
    expect(Object.keys(server.child.lessons)).toEqual(['kids-a0-u1']);
    expect(server.signedOut.sort()).toEqual(['Bearer child-tok', 'Bearer tok-1']);
    expect((await store.load(LOCAL_PROFILE_ID)).lessons).toEqual({});
    expect((await store.load('c1')).lessons).toEqual({});
    expect(await syncSession()).toBeUndefined();
  });

  it("saves a child's progress left unsent when the parent took the device back offline, then clears it", async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await startChildSession('c1');
    server.online = false;
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });
    await leaveChildProfile();
    server.online = true;

    expect(await signOutOfDevice()).toBe('signedOut');

    expect(Object.keys(server.child.lessons)).toEqual(['kids-a0-u1']);
    expect((await store.load('c1')).lessons).toEqual({});
  });

  it("stays signed in with the child's device copy kept when it cannot be sent", async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await startChildSession('c1');
    server.online = false;
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });
    await leaveChildProfile();
    server.online = true;
    server.childFails = true;

    expect(await signOutOfDevice()).toBe('failed');

    expect(Object.keys((await store.load('c1')).lessons)).toEqual(['kids-a0-u1']);
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: LOCAL_PROFILE_ID });
  });

  it("clears the children's copies too when the parent chooses to discard what could not be sent", async () => {
    const server = fakeServer();
    await signIn(demo.email, demo.password);
    await startChildSession('c1');
    server.online = false;
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 8, total: 10 });

    expect(await signOutOfDevice({ discardUnsynced: true })).toBe('signedOut');

    expect((await store.load('c1')).lessons).toEqual({});
    expect(await syncSession()).toBeUndefined();
  });
});

function isCompletedOnDevice(progress: Progress): boolean {
  return 'everyday-a0-u1' in progress.lessons;
}
