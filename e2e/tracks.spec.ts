// Track picker and track screen, against the exported web app (`npx expo export --platform web`)
// served with a fallback to index.html. Uses the project's Playwright `baseURL`.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PROGRESS_KEY = 'hocenglish.progress.local';

/** Saved progress in the store's version 1 shape, as the lesson player leaves it. */
const everydayUnit1Completed = {
  schemaVersion: 1,
  profileId: 'local',
  lessons: {
    'everyday-a0-u1': {
      firstCompletedAt: '2026-11-27T08:00:00.000Z',
      lastCompletedAt: '2026-11-27T08:00:00.000Z',
      bestCorrect: 10,
      total: 12,
      timesCompleted: 1,
    },
  },
  answers: {},
};

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test('a learner picks a track and sees its units by level', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Học Tiếng Anh' })).toBeVisible();

  await page.getByRole('link', { name: /^Đời sống/ }).click();

  await expect(page).toHaveURL(/\/track\/everyday$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Đời sống' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Bắt đầu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bài 1: Chào hỏi. Chưa học' })).toHaveAttribute(
    'href',
    '/lesson/everyday-a0-u1'
  );
});

test('a completed lesson shows as completed after a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PROGRESS_KEY, JSON.stringify(everydayUnit1Completed)]
  );

  await page.goto('/track/everyday');

  await expect(page.getByRole('link', { name: 'Bài 1: Chào hỏi. Đã học xong' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Đời sống/ })).toContainText(/Đã học xong 1\/\d+ bài/);
});

test('the track picker can be used with the keyboard', async ({ page }) => {
  await page.goto('/');
  const everyday = page.getByRole('link', { name: /^Đời sống/ });
  await expect(everyday).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(everyday).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/track\/everyday$/);
});

for (const scheme of ['light', 'dark'] as const) {
  for (const path of ['/', '/track/everyday', '/track/nope']) {
    test(`${path} has no serious axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
    });
  }
}
