import AsyncStorage from '@react-native-async-storage/async-storage';
import { userEvent } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import { signIn } from '@/account';
import AccountScreen from '@/app/account';
import HomeScreen from '@/app/index';
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

const demo = { email: 'demo@hocenglish.test', password: 'hoc-english-demo' };
const signedInBody = {
  token: 'tok-1',
  user: { id: 'u1', email: demo.email },
  profiles: [{ id: 'p1', kind: 'owner', name: '' }],
};

/**
 * A stand-in for the API server (server/accounts.ts, server/progress.ts): one demo account, sign-up
 * of a new email works, a taken email answers 409, a wrong password 401; `online` switches the network.
 */
function fakeServer() {
  const server = { online: true };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === '/api/auth/signup') {
      if (body.email === demo.email) return json(409, { error: 'email_taken', field: 'email' });
      return json(201, { ...signedInBody, user: { id: 'u2', email: body.email } });
    }
    if (path === '/api/auth/signin') {
      if (body.email === demo.email && body.password === demo.password) return json(200, signedInBody);
      return json(401, { error: 'invalid_credentials' });
    }
    if (path === '/api/me') return json(200, signedInBody);
    if (path === '/api/auth/signout') return new Response(null, { status: 204 });
    if (path === '/api/profiles/p1/progress' && init?.method === 'PUT') return json(200, { ...body, profileId: 'p1' });
    return json(404, { error: 'not_found' });
  });
  return server;
}

const store = createProgressStore();
const lesson = { unitId: 'everyday-a0-u1', correct: 8, total: 10 };

function StackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function renderApp(initialUrl: string) {
  return renderRouter({ _layout: StackLayout, index: HomeScreen, account: AccountScreen }, { initialUrl });
}

async function fillIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Mật khẩu'), password);
  return user;
}

let server: ReturnType<typeof fakeServer>;

beforeEach(async () => {
  (jest.requireMock('expo-secure-store') as { clear: () => void }).clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  server = fakeServer();
});

describe('Account screen (/account)', () => {
  it('signs in and then shows who is signed in', async () => {
    await renderApp('/account');
    const user = await fillIn(demo.email, demo.password);

    await user.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText(`Bạn đã đăng nhập bằng ${demo.email}.`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeOnTheScreen();
  });

  it('shows a wrong password next to the password field and keeps what was typed', async () => {
    await renderApp('/account');
    const user = await fillIn(demo.email, 'not-the-password');

    await user.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    const error = await screen.findByText('Email hoặc mật khẩu không đúng. Hãy thử lại.');
    expect(error.props.nativeID).toBe('account-password-error');
    expect(screen.getByLabelText('Mật khẩu').props['aria-describedby']).toBe('account-password-error');
    expect(screen.getByLabelText('Email').props.value).toBe(demo.email);
    expect(screen.getByLabelText('Mật khẩu').props.value).toBe('not-the-password');
  });

  it('creates an account, and shows a taken email next to the email field', async () => {
    await renderApp('/account');
    await userEvent.press(await screen.findByRole('button', { name: 'Chưa có tài khoản? Tạo tài khoản mới' }));
    const user = await fillIn(demo.email, 'a-long-password');

    await user.press(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    const error = await screen.findByText('Email này đã có tài khoản. Hãy đăng nhập.');
    expect(error.props.nativeID).toBe('account-email-error');
    expect(screen.getByLabelText('Email').props['aria-invalid']).toBe(true);

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'lan@example.com');
    await user.press(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText('Bạn đã đăng nhập bằng lan@example.com.')).toBeOnTheScreen();
  });

  it('signs out back to the sign-in form', async () => {
    await renderApp('/account');
    const user = await fillIn(demo.email, demo.password);
    await user.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    await user.press(await screen.findByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    expect(screen.queryByText(/Bạn đã đăng nhập/)).not.toBeOnTheScreen();
  });

  it('says signing out sends the progress to the account and removes it from this device', async () => {
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, lesson);
    await renderApp('/account');

    expect(
      await screen.findByText('Khi đăng xuất, tiến độ được lưu vào tài khoản rồi xoá khỏi thiết bị này.')
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    expect((await store.load(LOCAL_PROFILE_ID)).lessons).toEqual({});
  });

  it('offline, asks before signing out and discarding unsaved progress, and staying keeps everything', async () => {
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, lesson);
    await renderApp('/account');
    server.online = false;

    await userEvent.press(await screen.findByRole('button', { name: 'Đăng xuất' }));

    expect(
      await screen.findByText(
        'Đang ngoại tuyến nên chưa lưu được tiến độ vào tài khoản. Nếu đăng xuất bây giờ, những bài học và câu trả lời chưa lưu trên thiết bị này sẽ bị xoá.'
      )
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Ở lại, lưu tiến độ sau' }));

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    expect(screen.getByText(`Bạn đã đăng nhập bằng ${demo.email}.`)).toBeOnTheScreen();
    expect(Object.keys((await store.load(LOCAL_PROFILE_ID)).lessons)).toEqual([lesson.unitId]);
  });

  it('offline, signs out and removes the device progress when the learner confirms', async () => {
    await signIn(demo.email, demo.password);
    await store.completeLesson(LOCAL_PROFILE_ID, lesson);
    await renderApp('/account');
    server.online = false;
    await userEvent.press(await screen.findByRole('button', { name: 'Đăng xuất' }));

    await userEvent.press(await screen.findByRole('button', { name: 'Vẫn đăng xuất và xoá tiến độ chưa lưu' }));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    expect((await store.load(LOCAL_PROFILE_ID)).lessons).toEqual({});
  });
});

describe('Home account state (/)', () => {
  it('invites a signed-out learner to sign in', async () => {
    await renderApp('/');

    const row = await screen.findByRole('link', { name: /^Tài khoản\. Chưa đăng nhập/ });
    await userEvent.press(row);
    expect(screen).toHavePathname('/account');
  });

  it('shows the email of a signed-in learner', async () => {
    await renderApp('/account');
    const user = await fillIn(demo.email, demo.password);
    await user.press(screen.getByRole('button', { name: 'Đăng nhập' }));
    await screen.findByText(`Bạn đã đăng nhập bằng ${demo.email}.`);

    await user.press(screen.getByRole('link', { name: 'Về trang chủ' }));

    expect(await screen.findByRole('link', { name: `Tài khoản. Đã đăng nhập: ${demo.email}` })).toBeOnTheScreen();
  });
});
