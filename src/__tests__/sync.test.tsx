import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderRouter, screen } from 'expo-router/testing-library';

import { signIn } from '@/account';
import RootLayout from '@/app/_layout';
import HomeScreen from '@/app/index';
import TrackScreen from '@/app/track/[track]';

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

const signedInBody = {
  token: 'tok-1',
  user: { id: 'u1', email: 'demo@hocenglish.test' },
  profiles: [{ id: 'p1', kind: 'owner', name: '' }],
};

/** The account's progress on the server: everyday A0 u1 completed on another device. */
const accountProgress = {
  schemaVersion: 1,
  profileId: 'p1',
  lessons: {
    'everyday-a0-u1': {
      firstCompletedAt: '2026-11-27T08:00:00.000Z',
      lastCompletedAt: '2026-11-27T08:00:00.000Z',
      bestCorrect: 9,
      total: 10,
      timesCompleted: 1,
    },
  },
  answers: {},
};

/** A stand-in for the API server; `online` switches the network. */
function fakeServer() {
  const server = { online: true };
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === '/api/auth/signin' || path === '/api/me') return json(200, signedInBody);
    if (path === '/api/profiles/p1/progress') return json(200, accountProgress);
    return json(404, { error: 'not_found' });
  });
  return server;
}

function renderApp(initialUrl: string) {
  return renderRouter(
    { _layout: RootLayout, index: HomeScreen, 'track/[track]': TrackScreen },
    { initialUrl }
  );
}

const offlineNotice = 'Đang ngoại tuyến, tiến độ sẽ được đồng bộ sau';

beforeEach(async () => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('progress sync in the app', () => {
  it('shows a lesson completed on another device once the app has synced', async () => {
    fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');

    await renderApp('/track/everyday');

    expect(await screen.findByRole('link', { name: /^Bài 1: .*\. Đã học xong$/ })).toBeOnTheScreen();
  });

  it('says so when the device is offline while signed in', async () => {
    const server = fakeServer();
    await signIn('demo@hocenglish.test', 'hoc-english-demo');
    server.online = false;

    await renderApp('/');

    expect(await screen.findByText(offlineNotice)).toBeOnTheScreen();
  });

  it('says nothing about being offline to a learner who is not signed in', async () => {
    const server = fakeServer();
    server.online = false;

    await renderApp('/');

    expect(await screen.findByRole('link', { name: /^Đời sống\./ })).toBeOnTheScreen();
    expect(screen.queryByText(offlineNotice)).not.toBeOnTheScreen();
  });
});
