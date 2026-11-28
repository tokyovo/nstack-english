import {
  activeChild,
  endChildSession,
  loadAccount,
  onSessionChange,
  signIn,
  signOut,
  startChildSession,
  syncSession,
} from '@/account';

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

const owner = { id: 'p1', kind: 'owner', name: '', picture: null } as const;
const na = { id: 'c1', kind: 'child', name: 'Bé Na', picture: '🐱' } as const;

/**
 * A stand-in for the API server (server/accounts.ts, server/profiles.ts): the parent signs in with
 * tok-1 and owns the child Bé Na, whose session token is child-tok. `online` switches the network.
 */
function fakeServer() {
  const server = { online: true, profiles: [owner, na] as unknown[], signedOut: [] as string[] };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '');
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    const account = { user: { id: 'u1', email: 'demo@hocenglish.test' }, profiles: server.profiles };
    if (path === '/api/auth/signin') return json(200, { token: 'tok-1', ...account });
    if (path === '/api/me') return token === 'tok-1' ? json(200, account) : json(403, { error: 'forbidden' });
    if (path === '/api/auth/signout') {
      server.signedOut.push(token ?? '');
      return new Response(null, { status: 204 });
    }
    if (path === '/api/profiles/c1/session' && init?.method === 'POST' && token === 'tok-1') {
      return json(201, { token: 'child-tok', profile: na });
    }
    return json(404, { error: 'not_found' });
  });
  return server;
}

beforeEach(() => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  jest.restoreAllMocks();
});

describe('handing the device to a child', () => {
  it("makes the child the learner: sync then uses the child's token, profile and own device copy", async () => {
    fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    const changed = jest.fn();
    const stop = onSessionChange(changed);

    expect(await startChildSession('c1')).toEqual({ ok: true });
    stop();

    expect(await activeChild()).toEqual(na);
    expect(await syncSession()).toEqual({ token: 'child-tok', profileId: 'c1', deviceProfileId: 'c1' });
    expect(changed).toHaveBeenCalled();
  });

  it('keeps the parent the learner when the server cannot be reached or has no such child', async () => {
    const server = fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');

    expect(await startChildSession('c9')).toEqual({ ok: false, error: 'not_found' });
    server.online = false;
    expect(await startChildSession('c1')).toEqual({ ok: false, error: 'offline' });

    expect(await activeChild()).toBeUndefined();
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: 'local' });
  });

  it('needs a signed-in parent', async () => {
    fakeServer();
    expect(await startChildSession('c1')).toEqual({ ok: false, error: 'signed_out' });
  });
});

describe('returning to the parent', () => {
  it("ends the child token's session on the server and makes the parent the learner again", async () => {
    const server = fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    await startChildSession('c1');

    await endChildSession();

    expect(server.signedOut).toEqual(['child-tok']);
    expect(await activeChild()).toBeUndefined();
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: 'local' });
  });

  it('returns to the parent while offline too', async () => {
    const server = fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    await startChildSession('c1');
    server.online = false;

    await endChildSession();

    expect(await activeChild()).toBeUndefined();
    expect(await syncSession()).toEqual({ token: 'tok-1', profileId: 'p1', deviceProfileId: 'local' });
  });

  it("signing out ends the child's session and the parent's", async () => {
    const server = fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    await startChildSession('c1');

    await signOut();

    expect(server.signedOut.sort()).toEqual(['child-tok', 'tok-1']);
    expect(await activeChild()).toBeUndefined();
    expect(await syncSession()).toBeUndefined();
  });

  it('stays with the parent when an account check that started during child mode answers late', async () => {
    fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    await startChildSession('c1');
    const realFetch = global.fetch;
    let answerMe: () => void = () => undefined;
    jest.spyOn(global, 'fetch').mockImplementationOnce(
      (input, init) => new Promise((resolve) => (answerMe = () => resolve(realFetch(input, init))))
    );
    const checking = loadAccount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await endChildSession();
    answerMe();
    await checking;

    expect(await activeChild()).toBeUndefined();
  });

  it('forgets an active child that the account no longer has (deleted on another device)', async () => {
    const server = fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    await startChildSession('c1');
    server.profiles = [owner];

    await loadAccount();

    expect(await activeChild()).toBeUndefined();
  });
});
