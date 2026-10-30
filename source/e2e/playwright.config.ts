import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });

for (const variable of ['E2E_ADMIN_PASSWORD', 'E2E_PASSWORD']) {
  if (!process.env[variable]?.trim()) {
    throw new Error(`Thiếu ${variable}: điền mật khẩu trong source/e2e/.env trước khi chạy.`);
  }
}

export default defineConfig({
  testDir: '.',
  testMatch: 'specs/**/*.spec.ts',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
      use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off' },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
