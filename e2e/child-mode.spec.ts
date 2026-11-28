// A parent hands the device to a child, the child learns with its own progress, and the parent
// gate stands in front of the account until a grown-up answers it. Runs against the drive server
// and its real API; each test signs up its own account, so tests never share children.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { answerRight, button, collectErrors, expectNoSeriousAxeViolations, loadUnit, withoutSpeech } from './learner';

type Session = { token: string; user: { id: string; email: string }; profiles: { id: string; kind: string }[] };
type SavedSession = Session & { child?: { token: string; profile: { id: string } } };

const kidsUnit = loadUnit('kids/a0/u1.json');
const gateQuestion = /^Bố mẹ hãy tính: /;
const numbers: Record<string, number> = { sáu: 6, bảy: 7, tám: 8, chín: 9 };

async function signUp(request: APIRequestContext): Promise<Session> {
  const email = `family-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const response = await request.post('/api/auth/signup', { data: { email, password: 'a-long-password' } });
  expect(response.status()).toBe(201);
  return (await response.json()) as Session;
}

async function addChild(request: APIRequestContext, session: Session, name: string): Promise<string> {
  const response = await request.post('/api/profiles', {
    data: { name, picture: '🐱' },
    headers: { authorization: `Bearer ${session.token}` },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { profile: { id: string } }).profile.id;
}

/** The learner `profileId` finished `unitId` on another device: the account already has it. */
async function finishedOnAnotherDevice(request: APIRequestContext, session: Session, profileId: string, unitId: string) {
  const at = new Date().toISOString();
  const lesson = { firstCompletedAt: at, lastCompletedAt: at, bestCorrect: 12, total: 12, timesCompleted: 1 };
  const response = await request.put(`/api/profiles/${profileId}/progress`, {
    data: { schemaVersion: 1, profileId, lessons: { [unitId]: lesson }, answers: {} },
    headers: { authorization: `Bearer ${session.token}` },
  });
  expect(response.status()).toBe(200);
}

async function parentFinishedEverydayUnit1(request: APIRequestContext, session: Session) {
  await finishedOnAnotherDevice(request, session, session.profiles[0].id, 'everyday-a0-u1');
}

/** The lessons in every device copy of progress this browser keeps, by copy. */
function deviceLessons(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith('hocenglish.progress.'))
        .map((key) => [key, Object.keys((JSON.parse(localStorage.getItem(key) ?? '{}') as { lessons?: object }).lessons ?? {})])
    )
  );
}

async function signInOnPage(page: Page, email: string) {
  await page.goto('/account');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('a-long-password');
  await button(page, 'Đăng nhập').click();
}

async function lessonsOf(request: APIRequestContext, token: string, profileId: string): Promise<string[]> {
  const response = await request.get(`/api/profiles/${profileId}/progress`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  return Object.keys(((await response.json()) as { lessons: Record<string, unknown> }).lessons);
}

function savedSession(page: Page): Promise<SavedSession> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('hocenglish.session') ?? 'null') as SavedSession);
}

/** Answers the gate's question the way a parent would: reads the words and types the product. */
async function gateAnswer(input: Locator): Promise<string> {
  const question = (await input.getAttribute('aria-label')) ?? '';
  const [, a, b] = /: (\S+) nhân (\S+) bằng/.exec(question) ?? [];
  expect(numbers[a] && numbers[b]).toBeTruthy();
  return String(numbers[a] * numbers[b]);
}

function trackRow(page: Page, name: string) {
  return page.getByRole('link', { name: new RegExp(`^${name}\\.`) });
}

test('a parent hands the device to a child, the child learns, and the gate returns it to the parent', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page);
  await withoutSpeech(page);
  const session = await signUp(request);
  const naId = await addChild(request, session, 'Bé Na');
  await parentFinishedEverydayUnit1(request, session);

  // The parent signs in on this device and sees their own progress.
  await page.goto('/account');
  await page.getByLabel('Email', { exact: true }).fill(session.user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('a-long-password');
  await button(page, 'Đăng nhập').click();
  await page.getByRole('link', { name: /^Hồ sơ học trong gia đình/ }).click();

  // Hand the device to Bé Na.
  await button(page, 'Cho bé học trên máy này: Bé Na').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Chào Bé Na!')).toBeVisible();
  const rows = page.getByRole('link', { name: /^(Trẻ em|Đời sống|Công việc)\./ });
  await expect(rows.first()).toHaveAccessibleName(/^Trẻ em\./);
  await expect(trackRow(page, 'Đời sống')).toContainText('Đã học xong 0/');
  const childToken = (await savedSession(page)).child?.token ?? '';
  expect(childToken).not.toBe('');
  expect(childToken).not.toBe(session.token);

  // Bé Na learns kids unit 1.
  await trackRow(page, 'Trẻ em').click();
  await page.getByRole('link', { name: /^Bài 1: / }).click();
  await button(page, 'Bắt đầu học').click();
  for (let i = 0; i < kidsUnit.words.length; i++) await button(page, 'Tiếp tục').click();
  for (const exercise of kidsUnit.exercises) {
    await answerRight(page, exercise);
    await button(page, 'Tiếp tục').click();
  }
  await expect(page.getByRole('heading', { name: 'Xong bài học!' })).toBeVisible();
  await expect.poll(() => lessonsOf(request, childToken, naId)).toEqual(['kids-a0-u1']);

  // The account is behind the gate; a wrong answer keeps Bé Na where she is.
  await page.goto('/');
  await page.getByRole('link', { name: /^Dành cho bố mẹ/ }).click();
  await expect(page.getByRole('heading', { name: 'Dành cho bố mẹ' })).toBeVisible();
  await expect(button(page, 'Đăng xuất')).toHaveCount(0);
  const answer = page.getByLabel(gateQuestion);
  await expect(answer).toHaveAttribute('inputmode', 'numeric');
  await expectNoSeriousAxeViolations(page);
  const wrong = String(Number(await gateAnswer(answer)) + 1);
  await answer.fill(wrong);
  await button(page, 'Xác nhận').click();
  await expect(answer).toHaveAccessibleDescription('Chưa đúng. Bố mẹ hãy trả lời câu hỏi mới.');
  await expect(answer).toBeFocused();
  await expect(button(page, 'Đăng xuất')).toHaveCount(0);
  expect((await savedSession(page)).child?.token).toBe(childToken);

  // The right answer gives the device back to the parent and ends Bé Na's session.
  await answer.fill(await gateAnswer(answer));
  await answer.press('Enter');
  await expect(button(page, 'Đăng xuất')).toBeVisible();
  expect((await savedSession(page)).child).toBeUndefined();
  const ended = await request.get(`/api/profiles/${naId}/progress`, { headers: { authorization: `Bearer ${childToken}` } });
  expect(ended.status()).toBe(401);

  // Both progress sets stay apart, on the device and on the server.
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page.getByText('Chào Bé Na!')).toHaveCount(0);
  await expect(trackRow(page, 'Đời sống')).toContainText('Đã học xong 1/');
  await expect(trackRow(page, 'Trẻ em')).toContainText('Đã học xong 0/');
  expect(await lessonsOf(request, session.token, session.profiles[0].id)).toEqual(['everyday-a0-u1']);
  expect(await lessonsOf(request, session.token, naId)).toEqual(['kids-a0-u1']);
  expect(errors).toEqual([]);
});

test('/profiles is behind the parent gate while a child is learning', async ({ page, request }) => {
  const session = await signUp(request);
  const naId = await addChild(request, session, 'Bé Na');
  const started = await request.post(`/api/profiles/${naId}/session`, {
    headers: { authorization: `Bearer ${session.token}` },
  });
  const child = (await started.json()) as { token: string; profile: unknown };
  await page.goto('/');
  await page.evaluate((saved) => localStorage.setItem('hocenglish.session', saved), JSON.stringify({ ...session, child }));

  await page.goto('/profiles');

  await expect(page.getByRole('heading', { name: 'Dành cho bố mẹ' })).toBeVisible();
  await expect(page.getByLabel(gateQuestion)).toBeVisible();
  await expect(page.getByText('Người học', { exact: true })).toHaveCount(0);
  await expect(button(page, 'Thêm hồ sơ')).toHaveCount(0);
});

test('a parent with a child learning signs out; the next sign-in on the device finds neither one\'s lessons', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page);
  const session = await signUp(request);
  const naId = await addChild(request, session, 'Bé Na');
  await parentFinishedEverydayUnit1(request, session);
  await finishedOnAnotherDevice(request, session, naId, 'kids-a0-u1');
  const next = await signUp(request);

  // The parent signs in and hands the device to Bé Na, whose lessons come to the device.
  await signInOnPage(page, session.user.email);
  await page.getByRole('link', { name: /^Hồ sơ học trong gia đình/ }).click();
  await button(page, 'Cho bé học trên máy này: Bé Na').click();
  await expect(trackRow(page, 'Trẻ em')).toContainText('Đã học xong 1/');
  const onDevice = await savedSession(page);
  const deviceTokens = [onDevice.token, onDevice.child?.token ?? ''];
  expect(deviceTokens.every(Boolean)).toBe(true);

  // Signing out goes through the parent gate while Bé Na is learning.
  await page.goto('/');
  await page.getByRole('link', { name: /^Dành cho bố mẹ/ }).click();
  const answer = page.getByLabel(gateQuestion);
  await answer.fill(await gateAnswer(answer));
  await answer.press('Enter');
  await button(page, 'Đăng xuất').click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();

  // Nothing of the parent's or Bé Na's is left on the device, and both sessions are over.
  expect(Object.values(await deviceLessons(page)).flat()).toEqual([]);
  for (const token of deviceTokens) {
    const ended = await request.get(`/api/profiles/${naId}/progress`, { headers: { authorization: `Bearer ${token}` } });
    expect(ended.status()).toBe(401);
  }

  // The next person signs in on the device and starts from their own account only.
  await signInOnPage(page, next.user.email);
  await expect(page.getByText(`Bạn đã đăng nhập bằng ${next.user.email}.`)).toBeVisible();
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(trackRow(page, 'Đời sống')).toContainText('Đã học xong 0/');
  await expect(trackRow(page, 'Trẻ em')).toContainText('Đã học xong 0/');
  expect(Object.values(await deviceLessons(page)).flat()).toEqual([]);

  // Both sets of lessons were kept in the first account.
  const signIn = await request.post('/api/auth/signin', {
    data: { email: session.user.email, password: 'a-long-password' },
  });
  const again = (await signIn.json()) as Session;
  expect(await lessonsOf(request, again.token, again.profiles[0].id)).toEqual(['everyday-a0-u1']);
  expect(await lessonsOf(request, again.token, naId)).toEqual(['kids-a0-u1']);
  expect(errors).toEqual([]);
});
