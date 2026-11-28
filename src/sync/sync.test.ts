import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';

import { loadAccount, signIn, signOut, startChildSession, syncSession } from '@/account';
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
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: LOCAL_PROFILE_ID, ownerProfileId: 'p1' });
  });

  it('reports a failed sync rather than signing out when the server answers with something unreadable', async () => {
    fakeServer();
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"lessons":"nope"}', { status: 200 }));

    expect(await signOutOfDevice()).toBe('failed');

    expect(isCompletedOnDevice(await store.load(LOCAL_PROFILE_ID))).toBe(true);
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: LOCAL_PROFILE_ID, ownerProfileId: 'p1' });
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
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: LOCAL_PROFILE_ID, ownerProfileId: 'p1' });
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

/**
 * Two accounts, A (profile pa, child ca) and B (profile pb, child cb). Each sign-in or child
 * session gets a new token; `expire` ends every session of an account, its children's included,
 * as the server does after 90 days or a revoke.
 */
function twoAccountServer() {
  const accounts = {
    a: { email: 'a@example.com', profileId: 'pa', childId: 'ca' },
    b: { email: 'b@example.com', profileId: 'pb', childId: 'cb' },
  };
  const server = {
    online: true,
    puts: [] as { profileId: string; body: Progress }[],
    expire: (name: 'a' | 'b') => {
      for (const [token, owner] of sessions) if (owner === name) sessions.delete(token);
    },
  };
  const sessions = new Map<string, 'a' | 'b'>();
  let issued = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    const owner = sessions.get(new Headers(init?.headers).get('authorization')?.replace('Bearer ', '') ?? '');
    const body = (name: 'a' | 'b') => ({
      user: { id: name, email: accounts[name].email },
      profiles: [
        { id: accounts[name].profileId, kind: 'owner', name: '', picture: null },
        { id: accounts[name].childId, kind: 'child', name: 'Bé', picture: '🐱' },
      ],
    });
    const child = (name: 'a' | 'b') => body(name).profiles[1];
    if (path === '/api/auth/signin') {
      const { email } = JSON.parse(String(init?.body)) as { email: string };
      const name = email === accounts.a.email ? 'a' : 'b';
      const token = `tok-${name}-${(issued += 1)}`;
      sessions.set(token, name);
      return json(200, { token, ...body(name) });
    }
    if (path === '/api/auth/signout') return new Response(null, { status: 204 });
    if (!owner) return json(401, { error: 'unauthorized' });
    if (path === '/api/me') return json(200, body(owner));
    if (path === `/api/profiles/${accounts[owner].childId}/session`) {
      const token = `tok-${owner}-child-${(issued += 1)}`;
      sessions.set(token, owner);
      return json(201, { token, profile: child(owner) });
    }
    const profileId = [accounts[owner].profileId, accounts[owner].childId].find(
      (id) => path === `/api/profiles/${id}/progress`
    );
    if (profileId && init?.method === 'PUT') {
      const sent = JSON.parse(String(init.body)) as Progress;
      server.puts.push({ profileId, body: sent });
      return json(200, sent);
    }
    return json(404, { error: 'not_found' });
  });
  return { server, accounts };
}

describe('a session that ends without signing out (expired or revoked)', () => {
  async function aExpiresWithAnUnsyncedLesson() {
    const { server, accounts } = twoAccountServer();
    await signIn(accounts.a.email, 'password a');
    expect(await syncProgress()).toBe('synced');
    server.online = false;
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });
    expect(await syncProgress()).toBe('offline');
    server.online = true;
    server.expire('a');
    expect(await loadAccount()).toEqual({ status: 'signedOut' });
    return { server, accounts };
  }

  it("does not add A's progress to B's account when B signs in next", async () => {
    const { server, accounts } = await aExpiresWithAnUnsyncedLesson();

    await signIn(accounts.b.email, 'password b');
    expect(await syncProgress()).toBe('synced');

    const toB = server.puts.filter((put) => put.profileId === 'pb');
    expect(toB.length).toBeGreaterThan(0);
    for (const put of toB) expect(put.body.lessons).toEqual({});
    expect((await store.load(LOCAL_PROFILE_ID)).lessons).toEqual({});
  });

  it("sends A's unsynced lesson when A signs back in", async () => {
    const { server, accounts } = await aExpiresWithAnUnsyncedLesson();

    await signIn(accounts.a.email, 'password a');
    expect(await syncProgress()).toBe('synced');

    const toA = server.puts.filter((put) => put.profileId === 'pa');
    expect(Object.keys(toA[toA.length - 1].body.lessons)).toEqual(['everyday-a0-u1']);
  });

  it('still adds guest progress made before any sign-in to the first account', async () => {
    const { server, accounts } = twoAccountServer();
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 8, total: 10 });

    await signIn(accounts.b.email, 'password b');
    expect(await syncProgress()).toBe('synced');

    expect(Object.keys(server.puts[0].body.lessons)).toEqual(['everyday-a0-u1']);
  });
});

function isCompletedOnDevice(progress: Progress): boolean {
  return 'everyday-a0-u1' in progress.lessons;
}

describe("a session that ends without signing out while a child's copy is on the device", () => {
  async function aExpiresWithAChildsUnsyncedLesson() {
    const { server, accounts } = twoAccountServer();
    await signIn(accounts.a.email, 'password a');
    expect(await syncProgress()).toBe('synced');
    expect(await startChildSession('ca')).toEqual({ ok: true });
    server.online = false;
    await store.completeLesson('ca', { unitId: 'kids-a0-u1', correct: 8, total: 10 });
    expect(await syncProgress()).toBe('offline');
    server.online = true;
    server.expire('a');
    expect(await loadAccount()).toEqual({ status: 'signedOut' });
    return { server, accounts };
  }

  it("leaves none of A's child's progress on the device once B signs in, and sends none of it to B", async () => {
    const { server, accounts } = await aExpiresWithAChildsUnsyncedLesson();

    await signIn(accounts.b.email, 'password b');
    expect(await syncProgress()).toBe('synced');
    expect(await startChildSession('cb')).toEqual({ ok: true });
    expect(await syncProgress()).toBe('synced');

    expect((await store.load('ca')).lessons).toEqual({});
    const toB = server.puts.filter((put) => put.profileId === 'pb' || put.profileId === 'cb');
    expect(toB.length).toBeGreaterThan(1);
    for (const put of toB) expect(put.body.lessons).toEqual({});
  });

  it("sends A's child's unsynced lesson when A signs back in and hands the device to the child", async () => {
    const { server, accounts } = await aExpiresWithAChildsUnsyncedLesson();

    await signIn(accounts.a.email, 'password a');
    expect(await syncProgress()).toBe('synced');
    expect(await startChildSession('ca')).toEqual({ ok: true });
    expect(await syncProgress()).toBe('synced');

    const toChild = server.puts.filter((put) => put.profileId === 'ca');
    expect(Object.keys(toChild[toChild.length - 1].body.lessons)).toEqual(['kids-a0-u1']);
  });
});
