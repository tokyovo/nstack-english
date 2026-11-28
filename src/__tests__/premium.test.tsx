import AsyncStorage from '@react-native-async-storage/async-storage';
import { userEvent, within } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { join } from 'node:path';

import { signIn, startChildSession } from '@/account';
import HomeScreen from '@/app/index';
import LessonScreen from '@/app/lesson/[unitId]';
import PremiumScreen from '@/app/premium';
import ReviewScreen from '@/app/review';
import TrackScreen from '@/app/track/[track]';
import { readUnits } from '@/content/files';
import { loadPremiumUnit } from '@/premium';
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
const premiumUnit = readUnits(join(__dirname, '../../content')).find((unit) => unit.id === 'everyday-a0-u4');

/**
 * A stand-in for the API server (server/accounts.ts, server/units.ts): the account's plan is
 * `server.plan`; a premium unit answers 200 to a Premium account's tokens and 403 otherwise.
 */
function fakeServer(plan: 'free' | 'premium') {
  const server = { plan, online: true, unitRequests: 0 };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '') ?? '';
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    const planBody =
      server.plan === 'premium' ? { kind: 'premium', until: '2027-11-28T12:00:00.000Z' } : { kind: 'free', until: null };
    if (path === '/api/auth/signin' || path === '/api/me') {
      return json(200, { token: 'tok-1', user, profiles: [owner, na], plan: planBody });
    }
    if (path === '/api/plan') return token ? json(200, { plan: planBody }) : json(401, { error: 'unauthorized' });
    if (path === '/api/profiles/c1/session') return json(201, { token: 'child-tok', profile: na });
    if (path === '/api/units/everyday-a0-u4') {
      server.unitRequests += 1;
      if (!token) return json(401, { error: 'unauthorized' });
      return server.plan === 'premium' ? json(200, { unit: premiumUnit }) : json(403, { error: 'premium_required' });
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
      premium: PremiumScreen,
      review: ReviewScreen,
      'track/[track]': TrackScreen,
      'lesson/[unitId]': LessonScreen,
    },
    { initialUrl }
  );
}

beforeEach(async () => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  // Every gate question is "bảy nhân bảy" (7 × 7 = 49).
  jest.spyOn(Math, 'random').mockReturnValue(0.3);
});

describe('premium units on the track screen', () => {
  it('marks units 4 and 5 Premium and locked for a free learner, and opens /premium from one', async () => {
    fakeServer('free');
    await renderApp('/track/everyday');

    const locked = await screen.findByRole('link', { name: 'Bài 4: Đồ ăn và đồ uống. Premium, chưa mở khoá' });
    expect(within(locked).getByText('Premium')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Bài 5: Màu sắc và đồ vật. Premium, chưa mở khoá' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Bài 3: Gia đình. Chưa học' })).toBeOnTheScreen();

    await userEvent.press(locked);

    expect(screen).toHavePathname('/premium');
  });

  it('opens a premium unit for a Premium learner, with no lock', async () => {
    fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    await renderApp('/track/everyday');

    await userEvent.press(await screen.findByRole('link', { name: 'Bài 4: Đồ ăn và đồ uống. Premium. Chưa học' }));

    expect(screen).toHavePathname('/lesson/everyday-a0-u4');
    expect(await screen.findByRole('heading', { name: 'Đồ ăn và đồ uống' })).toBeOnTheScreen();
  });
});

describe('a premium lesson', () => {
  it('opens offline from the copy kept on the device after the first open', async () => {
    const server = fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    expect((await loadPremiumUnit('everyday-a0-u4')).status).toBe('ready');

    server.online = false;
    await renderApp('/lesson/everyday-a0-u4');

    expect(await screen.findByRole('heading', { name: 'Đồ ăn và đồ uống' })).toBeOnTheScreen();
  });

  it('says it needs the network the first time, when offline with no copy on the device', async () => {
    const server = fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    server.online = false;
    await renderApp('/lesson/everyday-a0-u4');

    expect(
      await screen.findByText('Cần kết nối mạng để tải bài này lần đầu. Hãy kiểm tra mạng rồi thử lại.')
    ).toBeOnTheScreen();
    server.online = true;
    await userEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { name: 'Đồ ăn và đồ uống' })).toBeOnTheScreen();
  });

  it('shows /premium instead, to a free learner who opens it by its address', async () => {
    fakeServer('free');
    await signIn(user.email, 'hoc-english-demo');
    await renderApp('/lesson/everyday-a0-u4');

    expect(await screen.findByRole('heading', { name: 'Premium' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/premium');
  });

  it('is not opened from the device copy once the account is no longer Premium', async () => {
    const server = fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    expect((await loadPremiumUnit('everyday-a0-u4')).status).toBe('ready');

    server.plan = 'free';
    await renderApp('/lesson/everyday-a0-u4');

    expect(await screen.findByRole('heading', { name: 'Premium' })).toBeOnTheScreen();
    server.online = false;
    expect(await loadPremiumUnit('everyday-a0-u4')).toEqual({ status: 'offline' });
  });
});

const DAY = 24 * 60 * 60 * 1000;

/** Finishes `unitId` on this device a day ago, as a sync from another device leaves it: its words are due now. */
function finishedADayAgo(unitId: string) {
  return createProgressStore({ now: () => new Date(Date.now() - DAY) }).completeLesson(LOCAL_PROFILE_ID, {
    unitId,
    correct: 10,
    total: 10,
  });
}

describe('premium words in review', () => {
  it('fetches a finished premium unit missing from the device, so home and the review count its words alike', async () => {
    fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    await finishedADayAgo('everyday-a0-u4');
    await renderApp('/');

    expect(await screen.findByText('10 từ cần ôn')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('link', { name: 'Ôn tập ngay' }));

    expect(await screen.findByText('Từ 1/10')).toBeOnTheScreen();
    // The first word is asked by its English, not by its id.
    expect(screen.getByText('water')).toBeOnTheScreen();
    expect(screen.queryByText('everyday-a0-u4-water')).toBeNull();
  });

  it('reviews the words of a premium unit kept on the device while offline', async () => {
    const server = fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    expect((await loadPremiumUnit('everyday-a0-u4')).status).toBe('ready');
    await finishedADayAgo('everyday-a0-u4');
    server.online = false;
    await renderApp('/review');

    expect(await screen.findByText('Từ 1/10')).toBeOnTheScreen();
  });

  it('leaves out, without an error, a finished premium unit a free learner cannot fetch', async () => {
    fakeServer('free');
    await signIn(user.email, 'hoc-english-demo');
    await finishedADayAgo('everyday-a0-u1');
    await finishedADayAgo('everyday-a0-u4');
    await renderApp('/');

    expect(await screen.findByText('9 từ cần ôn')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('link', { name: 'Ôn tập ngay' }));

    expect(await screen.findByText('Từ 1/9')).toBeOnTheScreen();
  });

  it('leaves out the kept copy of a finished premium unit once Premium has ended, online, and drops it', async () => {
    const server = fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    await finishedADayAgo('everyday-a0-u1');
    expect((await loadPremiumUnit('everyday-a0-u4')).status).toBe('ready');
    await finishedADayAgo('everyday-a0-u4');
    server.plan = 'free';
    await renderApp('/');

    expect(await screen.findByText('9 từ cần ôn')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('link', { name: 'Ôn tập ngay' }));

    expect(await screen.findByText('Từ 1/9')).toBeOnTheScreen();
    expect(await AsyncStorage.getItem('hocenglish.premiumUnit.everyday-a0-u4')).toBeNull();
  });

  it('leaves out a finished premium unit with no copy on the device while offline', async () => {
    const server = fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    await finishedADayAgo('everyday-a0-u1');
    await finishedADayAgo('everyday-a0-u4');
    server.online = false;
    await renderApp('/');

    expect(await screen.findByText('9 từ cần ôn')).toBeOnTheScreen();
  });
});

describe('/premium', () => {
  it('says what Premium includes, that the price is to be announced, and that payment is not open yet', async () => {
    fakeServer('free');
    await renderApp('/premium');

    expect(await screen.findByRole('heading', { name: 'Premium' })).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Premium có gì' })).toBeOnTheScreen();
    expect(screen.getByText('Mọi bài học của cả ba chủ đề, không chỉ 3 bài đầu.')).toBeOnTheScreen();
    expect(screen.getByText('Giá: sẽ công bố.')).toBeOnTheScreen();
    expect(screen.getByText('Hiện chưa thanh toán được trong ứng dụng.')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeOnTheScreen();
  });

  it("tells a Premium learner until when the account has it", async () => {
    fakeServer('premium');
    await signIn(user.email, 'hoc-english-demo');
    await renderApp('/premium');

    expect(await screen.findByText('Tài khoản của bạn đang có Premium đến 28/11/2027.')).toBeOnTheScreen();
  });

  it('is behind the parent gate while a child is learning, and shows after the right answer', async () => {
    fakeServer('free');
    await signIn(user.email, 'hoc-english-demo');
    await startChildSession('c1');
    await renderApp('/premium');

    expect(await screen.findByRole('heading', { name: 'Dành cho bố mẹ' })).toBeOnTheScreen();
    expect(screen.queryByText('Giá: sẽ công bố.')).toBeNull();

    await userEvent.type(screen.getByLabelText('Bố mẹ hãy tính: bảy nhân bảy bằng bao nhiêu?'), '49');
    await userEvent.press(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Giá: sẽ công bố.')).toBeOnTheScreen();
  });
});
