import { loadAccount, signIn, signOut, signUp } from '@/account';

// The device keychain is not available in Jest: an in-memory stand-in with the same API.
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void values.set(key, value),
    deleteItemAsync: async (key: string) => void values.delete(key),
  };
});

const demo = { email: 'demo@hocenglish.test', password: 'hoc-english-demo' };
const signedInBody = {
  token: 'tok-1',
  user: { id: 'u1', email: 'demo@hocenglish.test' },
  profiles: [{ id: 'p1', kind: 'owner', name: '' }],
};

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

afterEach(async () => {
  serverReplies({ status: 204 });
  await signOut();
  jest.restoreAllMocks();
});

describe('signing up and in', () => {
  it('sends the email and password and keeps the session after sign-up', async () => {
    const fetchMock = serverReplies({ status: 201, body: signedInBody }, { status: 200, body: signedInBody });

    const result = await signUp(demo.email, demo.password);

    expect(result).toEqual({ ok: true, user: signedInBody.user, profiles: signedInBody.profiles });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/signup');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(demo);
    expect(await loadAccount()).toEqual({ status: 'signedIn', user: signedInBody.user, profiles: signedInBody.profiles });
  });

  it('sends the session token as a bearer token when checking the account', async () => {
    const fetchMock = serverReplies({ status: 200, body: signedInBody }, { status: 200, body: signedInBody });
    await signIn(demo.email, demo.password);

    await loadAccount();

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/me');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok-1');
  });

  it.each([
    [409, 'email_taken', 'email'],
    [400, 'invalid_email', 'email'],
    [400, 'weak_password', 'password'],
  ] as const)('reports a %i %s from sign-up against the %s field', async (status, code, field) => {
    serverReplies({ status, body: { error: code, field } });

    expect(await signUp(demo.email, 'short')).toEqual({ ok: false, error: { code, field } });
    expect(await loadAccount()).toEqual({ status: 'signedOut' });
  });

  it('reports wrong credentials against the password field', async () => {
    serverReplies({ status: 401, body: { error: 'invalid_credentials' } });

    expect(await signIn(demo.email, 'wrong-password')).toEqual({
      ok: false,
      error: { code: 'invalid_credentials', field: 'password' },
    });
  });

  it('reports too many attempts and an unreachable server for the whole form', async () => {
    serverReplies({ status: 429, body: { error: 'too_many_attempts' } }, 'offline', { status: 500 });

    expect(await signIn(demo.email, demo.password)).toEqual({ ok: false, error: { code: 'too_many_attempts' } });
    expect(await signIn(demo.email, demo.password)).toEqual({ ok: false, error: { code: 'offline' } });
    expect(await signIn(demo.email, demo.password)).toEqual({ ok: false, error: { code: 'unknown' } });
  });
});

describe('the saved account', () => {
  it('is signed out when nothing is saved, without asking the server', async () => {
    const fetchMock = serverReplies();

    expect(await loadAccount()).toEqual({ status: 'signedOut' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is signed out and forgotten when the server no longer knows the session', async () => {
    serverReplies({ status: 200, body: signedInBody }, { status: 401, body: { error: 'unauthorized' } });
    await signIn(demo.email, demo.password);

    expect(await loadAccount()).toEqual({ status: 'signedOut' });
    const fetchMock = serverReplies();
    expect(await loadAccount()).toEqual({ status: 'signedOut' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays signed in from the saved session while offline', async () => {
    serverReplies({ status: 200, body: signedInBody }, 'offline');
    await signIn(demo.email, demo.password);

    expect(await loadAccount()).toEqual({ status: 'signedIn', user: signedInBody.user, profiles: signedInBody.profiles });
  });

  it('signs out on the server and forgets the session, even when offline', async () => {
    serverReplies({ status: 200, body: signedInBody });
    await signIn(demo.email, demo.password);

    const fetchMock = serverReplies('offline');
    await signOut();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/signout');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok-1');
    expect(await loadAccount()).toEqual({ status: 'signedOut' });
  });
});
