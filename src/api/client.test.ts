import { callApi } from '@/api/client';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('callApi', () => {
  it('answers offline after 10 seconds when the server never answers, and cancels the request', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    let reply: unknown;
    const pending = callApi('/api/plan').then((value) => (reply = value));

    await jest.advanceTimersByTimeAsync(9_999);
    expect(reply).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    await pending;

    expect(reply).toEqual({ status: 'offline' });
    expect(signal?.aborted).toBe(true);
  });

  it('gives the server reply when it comes in time', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    expect(await callApi('/api/health')).toEqual({ status: 200, body: { ok: true } });
  });
});
