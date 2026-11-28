// Sign up, sign in and sign out on /account against the drive server and its real API.
// Axe runs for /account in a11y.spec.ts.
import { expect, test, type Page } from '@playwright/test';

const demo = { email: 'demo@hocenglish.test', password: 'hoc-english-demo' };

test.beforeAll(async ({ request }) => {
  // The same demo account `drive seed` creates; 409 means it is already there.
  const response = await request.post('/api/auth/signup', { data: demo });
  expect([201, 409]).toContain(response.status());
});

async function fillIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
}

test('a learner creates an account, stays signed in after a reload, and signs out', async ({ page }) => {
  const email = `lan-${Date.now()}@example.com`;
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Tài khoản\. Chưa đăng nhập/ })).toBeVisible();
  await page.getByRole('link', { name: /^Tài khoản/ }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole('button', { name: 'Chưa có tài khoản? Tạo tài khoản mới' }).click();
  await fillIn(page, email, 'a-long-password');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await expect(page.getByText(`Bạn đã đăng nhập bằng ${email}.`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Bạn đã đăng nhập bằng ${email}.`)).toBeVisible();
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('link', { name: `Tài khoản. Đã đăng nhập: ${email}` })).toBeVisible();

  await page.getByRole('link', { name: /^Tài khoản/ }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Tài khoản\. Chưa đăng nhập/ })).toBeVisible();
});

test('a wrong password is shown next to the password field, which gets focus', async ({ page }) => {
  await page.goto('/account');
  await fillIn(page, demo.email, 'not-the-password');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  const password = page.getByLabel('Mật khẩu', { exact: true });
  await expect(password).toHaveAccessibleDescription('Email hoặc mật khẩu không đúng. Hãy thử lại.');
  await expect(password).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(demo.email);

  await password.fill(demo.password);
  await password.press('Enter');
  await expect(page.getByText(`Bạn đã đăng nhập bằng ${demo.email}.`)).toBeVisible();
});

test('a taken email is shown next to the email field when creating an account', async ({ page }) => {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Chưa có tài khoản? Tạo tài khoản mới' }).click();
  await fillIn(page, demo.email, 'another-long-password');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  const email = page.getByLabel('Email', { exact: true });
  await expect(email).toHaveAccessibleDescription('Email này đã có tài khoản. Hãy đăng nhập.');
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('autocomplete', 'email');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
});
