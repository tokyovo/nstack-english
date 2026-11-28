// The app's one way to call the API server. On web the API shares the page's origin;
// the native apps reach it through EXPO_PUBLIC_API_URL.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type ApiReply = { status: number; body: unknown } | { status: 'offline' };

/** A server that has not answered by then counts as unreachable, so no screen waits forever. */
const TIMEOUT_MS = 10_000;

type ApiRequest = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; token?: string };

/**
 * Sends a JSON request; a server that cannot be reached, or does not answer within
 * TIMEOUT_MS, answers `offline` instead of throwing.
 */
export async function callApi(path: `/api/${string}`, request: ApiRequest = {}): Promise<ApiReply> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<ApiReply>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: 'offline' });
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([send(path, request, controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function send(
  path: `/api/${string}`,
  { method = 'GET', body, token }: ApiRequest,
  signal: AbortSignal
): Promise<ApiReply> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    return { status: 'offline' };
  }
  const text = await response.text().catch(() => '');
  return { status: response.status, body: parseJson(text) };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
