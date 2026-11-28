import { expect, test } from '@playwright/test';

test('the welcome screen shows the app name and the Vietnamese tagline', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Học Tiếng Anh' })).toBeVisible();
  await expect(page.getByText('Học tiếng Anh từ con số không, mỗi ngày một chút.')).toBeVisible();
  await expect(page.getByTestId('word-card')).toContainText('Hello');
});
