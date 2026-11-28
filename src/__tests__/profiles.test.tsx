import AsyncStorage from '@react-native-async-storage/async-storage';
import { userEvent } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen, within } from 'expo-router/testing-library';

import { signIn } from '@/account';
import AccountScreen from '@/app/account';
import ProfilesScreen from '@/app/profiles';

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

type Profile = { id: string; kind: 'owner' | 'child'; name: string; picture: string | null };

const user = { id: 'u1', email: 'demo@hocenglish.test' };
const finishedAt = '2026-11-20T08:00:00.000Z';
const finishedUnit1 = {
  'everyday-a0-u1': {
    firstCompletedAt: finishedAt,
    lastCompletedAt: finishedAt,
    bestCorrect: 10,
    total: 12,
    timesCompleted: 1,
  },
};

/**
 * A stand-in for the API server (server/accounts.ts, server/profiles.ts, server/progress.ts):
 * one account with an owner profile and the child Bé Na, who finished everyday unit 1.
 */
function fakeServer(children: Profile[] = [{ id: 'c1', kind: 'child', name: 'Bé Na', picture: '🐱' }]) {
  let profiles: Profile[] = [{ id: 'p1', kind: 'owner', name: '', picture: null }, ...children];
  let nextId = 2;
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === '/api/auth/signin' || path === '/api/me') return json(200, { token: 'tok-1', user, profiles });
    if (path === '/api/profiles' && method === 'POST') {
      if (body.name === 'Quá dài') return json(400, { error: 'invalid_name', field: 'name' });
      const profile: Profile = { id: `c${nextId++}`, kind: 'child', name: body.name, picture: body.picture };
      profiles = [...profiles, profile];
      return json(201, { profile });
    }
    const progress = /^\/api\/profiles\/([^/]+)\/progress$/.exec(path);
    if (progress) {
      const lessons = progress[1] === 'c1' ? finishedUnit1 : {};
      return json(200, { schemaVersion: 1, profileId: progress[1], lessons, answers: {} });
    }
    const one = /^\/api\/profiles\/([^/]+)$/.exec(path);
    const target = one && profiles.find((profile) => profile.id === one[1]);
    if (target && method === 'PATCH') {
      profiles = profiles.map((profile) => (profile === target ? { ...profile, ...body } : profile));
      return json(200, { profile: { ...target, ...body } });
    }
    if (target && method === 'DELETE') {
      profiles = profiles.filter((profile) => profile !== target);
      return new Response(null, { status: 204 });
    }
    return json(404, { error: 'not_found' });
  });
}

function StackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function renderApp(initialUrl: string) {
  return renderRouter({ _layout: StackLayout, account: AccountScreen, profiles: ProfilesScreen }, { initialUrl });
}

async function signedIn() {
  await signIn(user.email, 'hoc-english-demo');
  await renderApp('/profiles');
}

beforeEach(async () => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  // The words of unit 1 waited past their 10 minutes in box 1 long ago.
  jest.useFakeTimers({ now: new Date('2026-11-28T08:00:00.000Z'), advanceTimers: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Profiles screen (/profiles)', () => {
  it('asks a signed-out visitor to sign in first', async () => {
    fakeServer();
    await renderApp('/profiles');

    expect(await screen.findByText('Đăng nhập để thêm hồ sơ cho con và xem bé học đến đâu.')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('link', { name: 'Đăng nhập' }));
    expect(screen).toHavePathname('/account');
  });

  it('lists the parent and each child with lessons finished and words due', async () => {
    fakeServer();
    await signedIn();

    const parent = await screen.findByTestId('profile-p1');
    expect(within(parent).getByText('Bạn')).toBeOnTheScreen();
    expect(await within(parent).findByText('Đã học xong 0 bài, chưa có từ cần ôn')).toBeOnTheScreen();
    const child = screen.getByTestId('profile-c1');
    expect(within(child).getByText('Bé Na')).toBeOnTheScreen();
    // Everyday unit 1 has 9 words, none answered since the lesson, so all of them are due.
    expect(await within(child).findByText('Đã học xong 1 bài, 9 từ cần ôn')).toBeOnTheScreen();
  });

  it('adds a child with a nickname and a picture', async () => {
    fakeServer();
    await signedIn();
    const press = userEvent.setup();

    await press.type(await screen.findByLabelText('Tên gọi của bé'), 'Bi');
    await press.press(screen.getByRole('radio', { name: 'Gấu trúc' }));
    expect(screen.getByRole('radio', { name: 'Gấu trúc' })).toBeChecked();
    await press.press(screen.getByRole('button', { name: 'Thêm hồ sơ' }));

    const added = await screen.findByTestId('profile-c2');
    expect(within(added).getByText('Bi')).toBeOnTheScreen();
    expect(within(added).getByText('🐼', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Tên gọi của bé').props.value).toBe('');
  });

  it('shows a refused nickname next to the field and keeps what was typed', async () => {
    fakeServer();
    await signedIn();
    const press = userEvent.setup();

    await press.type(await screen.findByLabelText('Tên gọi của bé'), 'Quá dài');
    await press.press(screen.getByRole('button', { name: 'Thêm hồ sơ' }));

    const error = await screen.findByText('Hãy nhập tên gọi cho bé, từ 1 đến 20 ký tự.');
    expect(error.props.nativeID).toBe('profile-new-name-error');
    expect(screen.getByLabelText('Tên gọi của bé').props['aria-describedby']).toBe('profile-new-name-error');
    expect(screen.getByLabelText('Tên gọi của bé').props.value).toBe('Quá dài');
    expect(screen.queryByTestId('profile-c2')).not.toBeOnTheScreen();
  });

  it('offers no add form once there are four children', async () => {
    const four = ['A', 'B', 'C', 'D'].map((name, i): Profile => ({ id: `k${i}`, kind: 'child', name, picture: '🐶' }));
    fakeServer(four);
    await signedIn();

    expect(await screen.findByText('Đã có đủ 4 hồ sơ cho con. Xóa một hồ sơ nếu muốn thêm bé khác.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Tên gọi của bé')).not.toBeOnTheScreen();
  });

  it('renames a child and changes the picture', async () => {
    fakeServer();
    await signedIn();
    const press = userEvent.setup();

    await press.press(await screen.findByRole('button', { name: 'Sửa hồ sơ Bé Na' }));
    const name = screen.getByLabelText('Tên gọi mới của Bé Na');
    expect(name.props.value).toBe('Bé Na');
    await press.clear(name);
    await press.type(name, 'Na');
    await press.press(within(screen.getByTestId('profile-c1')).getByRole('radio', { name: 'Thỏ' }));
    await press.press(screen.getByRole('button', { name: 'Lưu' }));

    const child = screen.getByTestId('profile-c1');
    expect(await within(child).findByText('Na')).toBeOnTheScreen();
    expect(within(child).getByText('🐰', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Tên gọi mới của Bé Na')).not.toBeOnTheScreen();
  });

  it('deletes a child only after a confirmation that names the child and the lost progress', async () => {
    fakeServer();
    await signedIn();
    const press = userEvent.setup();

    await press.press(await screen.findByRole('button', { name: 'Xóa hồ sơ Bé Na' }));
    const warning = 'Xóa hồ sơ của Bé Na? Toàn bộ tiến độ học của Bé Na sẽ bị xóa và không lấy lại được.';
    expect(screen.getByText(warning)).toBeOnTheScreen();
    await press.press(screen.getByRole('button', { name: 'Giữ lại' }));
    expect(screen.queryByText(warning)).not.toBeOnTheScreen();
    expect(screen.getByTestId('profile-c1')).toBeOnTheScreen();

    await press.press(screen.getByRole('button', { name: 'Xóa hồ sơ Bé Na' }));
    await press.press(screen.getByRole('button', { name: 'Xóa hồ sơ' }));

    expect(await screen.findByText('Đã xóa hồ sơ của Bé Na.')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-c1')).not.toBeOnTheScreen();
  });

  it('is reached from the account screen', async () => {
    fakeServer();
    await signIn(user.email, 'hoc-english-demo');
    await renderApp('/account');

    await userEvent.press(await screen.findByRole('link', { name: /^Hồ sơ học trong gia đình/ }));
    expect(screen).toHavePathname('/profiles');
  });
});
