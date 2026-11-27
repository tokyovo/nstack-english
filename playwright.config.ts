import { defineConfig, devices } from '@playwright/test';

// The suite runs against the drive server that e2e/global-setup.ts starts: it
// serves the exported web app and the API on one free port. Workers load this
// config after global setup, so they see its E2E_BASE_URL.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.E2E_BASE_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
