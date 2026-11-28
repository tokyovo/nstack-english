// Progress follows the account: two browsers stand for two devices of one learner.
import { expect, test, type Page } from '@playwright/test';

import { button, collectErrors, loadUnit, withoutSpeech } from './learner';
import type { Exercise } from '../src/content/schema';

const unit = loadUnit('everyday/a0/u1.json');
const offlineNotice = 'Đang ngoại tuyến, tiến độ sẽ được đồng bộ sau';
const completedRow = /^Bài 1: .*\. Đã học xong$/;

async function answerRight(page: Page, exercise: Exercise) {
  switch (exercise.type) {
    case 'choose_meaning':
    case 'choose_english':
    case 'listen_choose':
      await button(page, exercise.answer).click();
      return;
    case 'build_sentence':
      for (const tile of exercise.answer) await button(page, tile).first().click();
      await button(page, 'Kiểm tra').click();
      return;
    case 'type_answer': {
      const input = page.getByLabel('Câu trả lời bằng tiếng Anh');
      await input.fill(exercise.answer);
      await input.press('Enter');
    }
  }
}

async function completeUnit(page: Page) {
  await page.goto(`/lesson/${unit.id}`);
  await button(page, 'Bắt đầu học').click();
  for (let i = 0; i < unit.words.length; i++) await button(page, 'Tiếp tục').click();
  for (const exercise of unit.exercises) {
    await answerRight(page, exercise);
    await button(page, 'Tiếp tục').click();
  }
  await expect(page.getByRole('heading', { name: 'Xong bài học!' })).toBeVisible();
}

async function fillIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
}

/** The account's progress as the server has it, read with the session this browser saved. */
async function accountLessons(page: Page): Promise<string[]> {
  const session = JSON.parse((await page.evaluate(() => localStorage.getItem('hocenglish.session'))) ?? '{}') as {
    token: string;
    profiles: { id: string }[];
  };
  const response = await page.request.get(`/api/profiles/${session.profiles[0].id}/progress`, {
    headers: { authorization: `Bearer ${session.token}` },
  });
  return Object.keys(((await response.json()) as { lessons: Record<string, unknown> }).lessons);
}

test('a lesson completed on one device shows as completed after signing in on another', async ({ browser }) => {
  const email = `sync-${Date.now()}@example.com`;
  const password = 'a-long-password';

  const deviceA = await browser.newContext();
  const a = await deviceA.newPage();
  const errorsA = collectErrors(a);
  await withoutSpeech(a);
  await a.goto('/account');
  await button(a, 'Chưa có tài khoản? Tạo tài khoản mới').click();
  await fillIn(a, email, password);
  await button(a, 'Tạo tài khoản').click();
  await expect(a.getByText(`Bạn đã đăng nhập bằng ${email}.`)).toBeVisible();
  await completeUnit(a);
  await expect.poll(() => accountLessons(a)).toEqual([unit.id]);

  const deviceB = await browser.newContext();
  const b = await deviceB.newPage();
  const errorsB = collectErrors(b);
  await b.goto('/track/everyday');
  await expect(b.getByRole('link', { name: /^Bài 1: .*\. Chưa học$/ })).toBeVisible();
  await b.goto('/account');
  await fillIn(b, email, password);
  await button(b, 'Đăng nhập').click();
  await expect(b.getByText(`Bạn đã đăng nhập bằng ${email}.`)).toBeVisible();
  await b.getByRole('link', { name: 'Về trang chủ' }).click();
  await b.getByRole('link', { name: /^Đời sống\./ }).click();
  await expect(b.getByRole('link', { name: completedRow })).toBeVisible();
  await expect(b.getByText(offlineNotice)).toHaveCount(0);

  expect(errorsA).toEqual([]);
  expect(errorsB).toEqual([]);
  await deviceA.close();
  await deviceB.close();
});

test('a signed-in learner offline is told progress will sync later', async ({ page, context }) => {
  const email = `offline-${Date.now()}@example.com`;
  await page.goto('/account');
  await button(page, 'Chưa có tài khoản? Tạo tài khoản mới').click();
  await fillIn(page, email, 'a-long-password');
  await button(page, 'Tạo tài khoản').click();
  await expect(page.getByText(`Bạn đã đăng nhập bằng ${email}.`)).toBeVisible();
  // Open home and a track while online, so the web app has every screen this test visits.
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await page.getByRole('link', { name: /^Đời sống\./ }).click();
  await expect(page.getByRole('heading', { name: 'Đời sống', level: 1 })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('link', { name: 'Về danh sách chủ đề' }).click();
  await expect(page.getByRole('status').getByText(offlineNotice)).toBeVisible();
  await page.getByRole('link', { name: /^Đời sống\./ }).click();
  await expect(page.getByRole('heading', { name: 'Đời sống', level: 1 })).toBeVisible();
  await expect(page.getByText(offlineNotice)).toBeVisible();

  await context.setOffline(false);
  await page.getByRole('link', { name: 'Về danh sách chủ đề' }).click();
  await expect(page.getByText(offlineNotice)).toHaveCount(0);
});
