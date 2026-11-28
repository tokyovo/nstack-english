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

/** The parent finished everyday unit 1 on another device: the account already has it. */
async function parentFinishedEverydayUnit1(request: APIRequestContext, session: Session) {
  const at = new Date().toISOString();
  const lesson = { firstCompletedAt: at, lastCompletedAt: at, bestCorrect: 12, total: 12, timesCompleted: 1 };
  const owner = session.profiles[0].id;
  const response = await request.put(`/api/profiles/${owner}/progress`, {
    data: { schemaVersion: 1, profileId: owner, lessons: { 'everyday-a0-u1': lesson }, answers: {} },
    headers: { authorization: `Bearer ${session.token}` },
  });
  expect(response.status()).toBe(200);
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
