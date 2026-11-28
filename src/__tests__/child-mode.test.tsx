import AsyncStorage from '@react-native-async-storage/async-storage';
import { userEvent, within } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import { signIn, startChildSession } from '@/account';
import AccountScreen from '@/app/account';
import HomeScreen from '@/app/index';
import LessonScreen from '@/app/lesson/[unitId]';
import ProfilesScreen from '@/app/profiles';
import ReviewScreen from '@/app/review';
import TrackScreen from '@/app/track/[track]';
import { createProgressStore, LOCAL_PROFILE_ID } from '@/progress';

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

const user = { id: 'u1', email: 'demo@hocenglish.test' };
const owner = { id: 'p1', kind: 'owner', name: '', picture: null };
const na = { id: 'c1', kind: 'child', name: 'Bé Na', picture: '🐱' };

/**
 * A stand-in for the API server (server/accounts.ts, server/profiles.ts, server/progress.ts): the
 * parent (tok-1) owns Bé Na, whose session token is child-tok; progress comes back as it was sent.
 */
function fakeServer() {
  const server = { signedOut: [] as string[], online: true };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '') ?? '';
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === '/api/auth/signin' || path === '/api/me') {
      return json(200, { token: 'tok-1', user, profiles: [owner, na] });
    }
    if (path === '/api/auth/signout') {
      server.signedOut.push(token);
      return new Response(null, { status: 204 });
    }
    if (path === '/api/profiles/c1/session') return json(201, { token: 'child-tok', profile: na });
    const progress = /^\/api\/profiles\/([^/]+)\/progress$/.exec(path);
    if (progress) {
      const empty = { schemaVersion: 1, profileId: progress[1], lessons: {}, answers: {} };
      return json(200, init?.body ? JSON.parse(String(init.body)) : empty);
    }
    return json(404, { error: 'not_found' });
  });
  return server;
}

function StackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function renderApp(initialUrl: string) {
  return renderRouter(
    {
      _layout: StackLayout,
      index: HomeScreen,
      account: AccountScreen,
      profiles: ProfilesScreen,
      'track/[track]': TrackScreen,
      'lesson/[unitId]': LessonScreen,
      review: ReviewScreen,
    },
    { initialUrl }
  );
}

/** The parent signs in and hands the device to Bé Na from the profiles screen. */
async function switchToNa() {
  await signIn(user.email, 'hoc-english-demo');
  await renderApp('/profiles');
  await userEvent.press(await screen.findByRole('button', { name: 'Cho bé học trên máy này: Bé Na' }));
  expect(await screen.findByText('Chào Bé Na!')).toBeOnTheScreen();
}

beforeEach(async () => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  // Every gate question is "bảy nhân bảy" (7 × 7 = 49).
  jest.spyOn(Math, 'random').mockReturnValue(0.3);
});

describe('child mode', () => {
  it("shows the child's name on home and lists the kids track first", async () => {
    fakeServer();
    await switchToNa();

    expect(screen).toHavePathname('/');
    const tracks = screen.getAllByRole('link').filter((link) => /^track-/.test(String(link.props.testID)));
    expect(tracks.map((link) => link.props.testID)).toEqual(['track-kids', 'track-everyday', 'track-work']);
  });

  it("shows the child's own progress, not the parent's", async () => {
    fakeServer();
    const store = createProgressStore();
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 10, total: 12 });
    await store.completeLesson('c1', { unitId: 'kids-a0-u1', correct: 10, total: 12 });
    await switchToNa();

    const kids = screen.getByRole('link', { name: /^Trẻ em/ });
    expect(await within(kids).findByText(/^Đã học xong 1\/\d+ bài$/)).toBeOnTheScreen();
    const everyday = screen.getByRole('link', { name: /^Đời sống/ });
    expect(within(everyday).getByText(/^Đã học xong 0\/\d+ bài$/)).toBeOnTheScreen();
  });

  it("opens a lesson with the child's progress", async () => {
    fakeServer();
    await createProgressStore().completeLesson('c1', { unitId: 'kids-a0-u1', correct: 10, total: 12 });
    await switchToNa();

    await userEvent.press(screen.getByRole('link', { name: /^Trẻ em/ }));
    await userEvent.press(await screen.findByRole('link', { name: /^Bài 1: .*Đã học xong$/ }));

    expect(await screen.findByText('Bạn đã học xong bài này.')).toBeOnTheScreen();
  });

  it("reviews the child's own words, not the words the parent has due", async () => {
    fakeServer();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await createProgressStore({ now: () => yesterday }).completeLesson(LOCAL_PROFILE_ID, {
      unitId: 'everyday-a0-u1',
      correct: 10,
      total: 12,
    });
    await switchToNa();

    await renderApp('/review');

    expect(await screen.findByRole('heading', { name: 'Chưa có từ cần ôn' })).toBeOnTheScreen();
  });

  it.each(['/account', '/profiles'])('puts %s behind the parent gate while a child is learning', async (path) => {
    fakeServer();
    await signIn(user.email, 'hoc-english-demo');
    await startChildSession('c1');
    await renderApp(path);

    expect(await screen.findByRole('heading', { name: 'Dành cho bố mẹ' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Bố mẹ hãy tính: bảy nhân bảy bằng bao nhiêu?').props.keyboardType).toBe('number-pad');
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
    expect(screen.queryByText('Người học')).toBeNull();
  });

  it('keeps the child learning after a wrong answer', async () => {
    const server = fakeServer();
    await switchToNa();
    await userEvent.press(screen.getByRole('link', { name: /^Dành cho bố mẹ/ }));
    const press = userEvent.setup();

    await press.type(await screen.findByLabelText('Bố mẹ hãy tính: bảy nhân bảy bằng bao nhiêu?'), '48');
    await press.press(screen.getByRole('button', { name: 'Xác nhận' }));

    const answer = screen.getByLabelText('Bố mẹ hãy tính: bảy nhân bảy bằng bao nhiêu?');
    expect(await screen.findByText('Chưa đúng. Bố mẹ hãy trả lời câu hỏi mới.')).toBeOnTheScreen();
    expect(answer.props.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
    expect(server.signedOut).toEqual([]);
  });

  it('returns to the parent after a right answer and ends the child session', async () => {
    const server = fakeServer();
    await switchToNa();
    await userEvent.press(screen.getByRole('link', { name: /^Dành cho bố mẹ/ }));
    const press = userEvent.setup();

    await press.type(await screen.findByLabelText('Bố mẹ hãy tính: bảy nhân bảy bằng bao nhiêu?'), '49');
    await press.press(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByRole('button', { name: 'Đăng xuất' })).toBeOnTheScreen();
    expect(server.signedOut).toEqual(['child-tok']);
    await press.press(screen.getByRole('link', { name: 'Về trang chủ' }));
    expect(await screen.findByText('Đã đăng nhập: demo@hocenglish.test')).toBeOnTheScreen();
    expect(screen.queryByText('Chào Bé Na!')).toBeNull();
  });

  it('says so next to the child when the device cannot be handed over offline', async () => {
    const server = fakeServer();
    await signIn(user.email, 'hoc-english-demo');
    await renderApp('/profiles');
    server.online = false;

    await userEvent.press(await screen.findByRole('button', { name: 'Cho bé học trên máy này: Bé Na' }));

    const row = screen.getByTestId('profile-c1');
    expect(
      await within(row).findByText('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.')
    ).toBeOnTheScreen();
    expect(screen).toHavePathname('/profiles');
  });
});
