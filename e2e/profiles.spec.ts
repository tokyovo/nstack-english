// A parent manages the family's profiles on /profiles against the drive server and its real API.
// Each test signs up its own account, so tests never share children. Axe for the signed-out
// screen runs in a11y.spec.ts; the signed-in states are scanned here.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { button, collectErrors, expectNoSeriousAxeViolations } from './learner';

type Session = { token: string; user: { id: string; email: string }; profiles: { id: string; kind: string }[] };

async function signUp(request: APIRequestContext): Promise<Session> {
  const email = `parent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const response = await request.post('/api/auth/signup', { data: { email, password: 'a-long-password' } });
  expect(response.status()).toBe(201);
  return (await response.json()) as Session;
}

/** Signs this browser in as `session`, the way the app saves a session on web. */
async function openSignedIn(page: Page, session: Session, path: string) {
  await page.goto('/');
  await page.evaluate((saved) => localStorage.setItem('hocenglish.session', saved), JSON.stringify(session));
  await page.goto(path);
}

async function addChild(request: APIRequestContext, session: Session, name: string): Promise<string> {
  const response = await request.post('/api/profiles', {
    data: { name, picture: '🐱' },
    headers: { authorization: `Bearer ${session.token}` },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { profile: { id: string } }).profile.id;
}

test('a parent sees each learner with lessons finished and words due', async ({ page, request }) => {
  const errors = collectErrors(page);
  const session = await signUp(request);
  const childId = await addChild(request, session, 'Bé Na');
  // Bé Na finished everyday unit 1 two days ago and has answered nothing since: its 9 words are due.
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const lesson = { firstCompletedAt: twoDaysAgo, lastCompletedAt: twoDaysAgo, bestCorrect: 10, total: 12, timesCompleted: 1 };
  const saved = await request.put(`/api/profiles/${childId}/progress`, {
    data: { schemaVersion: 1, profileId: childId, lessons: { 'everyday-a0-u1': lesson }, answers: {} },
    headers: { authorization: `Bearer ${session.token}` },
  });
  expect(saved.status()).toBe(200);

  await openSignedIn(page, session, '/account');
  await page.getByRole('link', { name: /^Hồ sơ học trong gia đình/ }).click();
  await expect(page).toHaveURL(/\/profiles$/);

  const parent = page.getByTestId(`profile-${session.profiles[0].id}`);
  await expect(parent.getByText('Bạn', { exact: true })).toBeVisible();
  await expect(parent.getByText('Đã học xong 0 bài, chưa có từ cần ôn')).toBeVisible();
  const child = page.getByTestId(`profile-${childId}`);
  await expect(child.getByText('Bé Na')).toBeVisible();
  await expect(child.getByText('Đã học xong 1 bài, 9 từ cần ôn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a parent adds, renames and deletes a child profile', async ({ page, request }) => {
  const errors = collectErrors(page);
  const session = await signUp(request);
  await openSignedIn(page, session, '/profiles');

  await page.getByLabel('Tên gọi của bé', { exact: true }).fill('Bi');
  await page.getByRole('radio', { name: 'Gấu trúc' }).click();
  await button(page, 'Thêm hồ sơ').click();
  await expect(page.getByText('Bi', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên gọi của bé', { exact: true })).toHaveValue('');

  await page.reload();
  await expect(page.getByText('Bi', { exact: true })).toBeVisible();
  await button(page, 'Sửa hồ sơ Bi').click();
  const newName = page.getByLabel('Tên gọi mới của Bi', { exact: true });
  await expect(newName).toHaveValue('Bi');
  await newName.fill('Bin');
  await button(page, 'Lưu').click();
  await expect(page.getByText('Bin', { exact: true })).toBeVisible();

  await button(page, 'Xóa hồ sơ Bin').click();
  await expect(
    page.getByText('Xóa hồ sơ của Bin? Toàn bộ tiến độ học của Bin sẽ bị xóa và không lấy lại được.')
  ).toBeVisible();
  await button(page, 'Xóa hồ sơ').click();
  await expect(page.getByText('Đã xóa hồ sơ của Bin.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Đã học xong 0 bài, chưa có từ cần ôn')).toBeVisible();
  await expect(page.getByText('Bin', { exact: true })).toHaveCount(0);

  const me = await request.get('/api/me', { headers: { authorization: `Bearer ${session.token}` } });
  expect(((await me.json()) as Session).profiles).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a nickname with only spaces is refused next to the field, and what was typed stays', async ({ page, request }) => {
  const session = await signUp(request);
  await openSignedIn(page, session, '/profiles');

  const name = page.getByLabel('Tên gọi của bé', { exact: true });
  await name.fill('   ');
  await button(page, 'Thêm hồ sơ').click();

  await expect(name).toHaveAccessibleDescription('Hãy nhập tên gọi cho bé, từ 1 đến 20 ký tự.');
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('   ');
});

test('a signed-out visitor is asked to sign in', async ({ page }) => {
  await page.goto('/profiles');
  await expect(page.getByText('Đăng nhập để thêm hồ sơ cho con và xem bé học đến đâu.')).toBeVisible();
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the signed-in screen, its edit form and delete confirmation pass axe (${colorScheme})`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ colorScheme });
    const session = await signUp(request);
    await addChild(request, session, 'Bé Na');
    await openSignedIn(page, session, '/profiles');
    await expect(page.getByText('Đã học xong 0 bài, chưa có từ cần ôn')).toHaveCount(2);
    await expectNoSeriousAxeViolations(page);

    await button(page, 'Sửa hồ sơ Bé Na').click();
    await expectNoSeriousAxeViolations(page);
    await button(page, 'Hủy').click();

    await button(page, 'Xóa hồ sơ Bé Na').click();
    await expectNoSeriousAxeViolations(page);
  });
}
