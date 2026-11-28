// Free and Premium units against the drive server and its real API. The demo account is the one
// `drive seed` creates and grants Premium (e2e/global-setup.ts seeds); free learners are signed out.
import { expect, test, type Page } from '@playwright/test';

import { answerRight, button, collectErrors, expectNoSeriousAxeViolations, loadUnit, withoutSpeech } from './learner';

const demo = { email: 'demo@hocenglish.test', password: 'hoc-english-demo' };
const premiumUnit = loadUnit('everyday/a0/u4.json');
const gateQuestion = /^Bố mẹ hãy tính: /;
const numbers: Record<string, number> = { sáu: 6, bảy: 7, tám: 8, chín: 9 };

async function signInAsDemo(page: Page) {
  await page.goto('/account');
  await page.getByLabel('Email', { exact: true }).fill(demo.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(demo.password);
  await button(page, 'Đăng nhập').click();
  await expect(page.getByText(`Bạn đã đăng nhập bằng ${demo.email}.`)).toBeVisible();
}

test('a free learner sees units 4 and 5 locked as Premium, and opening one shows what Premium is', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/track/everyday');

  const locked = page.getByRole('link', { name: 'Bài 4: Đồ ăn và đồ uống. Premium, chưa mở khoá' });
  await expect(locked).toBeVisible();
  await expect(locked.getByTestId('premium-lock')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bài 5: Màu sắc và đồ vật. Premium, chưa mở khoá' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bài 3: Gia đình. Chưa học' })).toBeVisible();

  await locked.click();
  await expect(page).toHaveURL(/\/premium$/);
  await expect(page.getByRole('heading', { name: 'Premium', level: 1 })).toBeVisible();
  await expect(page.getByText('Giá: sẽ công bố.')).toBeVisible();
  await expect(page.getByText('Hiện chưa thanh toán được trong ứng dụng.')).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  // Typing the address of a premium lesson leads to the same place; its words never reach the page.
  await page.goto(`/lesson/${premiumUnit.id}`);
  await expect(page).toHaveURL(/\/premium$/);
  await expect(page.getByText(premiumUnit.words[0].vi)).toHaveCount(0);
  expect(errors.filter((e) => !/401|403/.test(e))).toEqual([]);
});

test('the Premium demo account finishes a premium lesson, then opens it again offline', async ({ page, context }) => {
  await withoutSpeech(page);
  await signInAsDemo(page);
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await page.getByRole('link', { name: /^Đời sống\./ }).click();

  const row = page.getByRole('link', { name: /^Bài 4: Đồ ăn và đồ uống\. Premium\. / });
  await expect(row).toBeVisible();
  await expect(row.getByTestId('premium-lock')).toHaveCount(0);
  await row.click();
  await expect(page.getByRole('heading', { name: premiumUnit.title, level: 1 })).toBeVisible();
  await button(page, 'Bắt đầu học').click();
  for (let i = 0; i < premiumUnit.words.length; i++) await button(page, 'Tiếp tục').click();
  for (const exercise of premiumUnit.exercises) {
    await answerRight(page, exercise);
    await button(page, 'Tiếp tục').click();
  }
  await expect(page.getByRole('heading', { name: 'Xong bài học!' })).toBeVisible();

  // Offline, the copy kept on the device opens the lesson again.
  await context.setOffline(true);
  await page.getByTestId('back-to-track').click();
  await page.getByRole('link', { name: /^Bài 4: Đồ ăn và đồ uống\. Premium/ }).click();
  await expect(page.getByRole('heading', { name: premiumUnit.title, level: 1 })).toBeVisible();
  await expect(page.getByTestId('completed')).toBeVisible();
  await context.setOffline(false);
});

test('while a child of the Premium account learns, premium units open but /premium is behind the parent gate', async ({
  page,
}) => {
  await signInAsDemo(page);
  await page.getByRole('link', { name: /^Hồ sơ học trong gia đình/ }).click();
  await button(page, 'Cho bé học trên máy này: Bé Na').click();
  await expect(page.getByText('Chào Bé Na!')).toBeVisible();

  await page.goto('/lesson/kids-a0-u4');
  await expect(page.getByRole('heading', { name: 'Hoa quả', level: 1 })).toBeVisible();

  await page.goto('/premium');
  await expect(page.getByRole('heading', { name: 'Dành cho bố mẹ' })).toBeVisible();
  await expect(page.getByText('Giá: sẽ công bố.')).toHaveCount(0);
  const answer = page.getByLabel(gateQuestion);
  const [, a, b] = /: (\S+) nhân (\S+) bằng/.exec((await answer.getAttribute('aria-label')) ?? '') ?? [];
  await answer.fill(String(numbers[a] * numbers[b]));
  await button(page, 'Xác nhận').click();
  await expect(page.getByText('Giá: sẽ công bố.')).toBeVisible();
  await expect(page.getByText(/^Tài khoản của bạn đang có Premium đến \d{2}\/\d{2}\/\d{4}\.$/)).toBeVisible();
});
