import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { accounts, authStatePath, type AccountRole } from './fixtures/accounts.js';

for (const role of Object.keys(accounts) as AccountRole[]) {
  setup(`Đăng nhập ${role}`, async ({ page }) => {
    const password = process.env[role === 'R1' ? 'E2E_ADMIN_PASSWORD' : 'E2E_PASSWORD'];
    if (!password) throw new Error(`Thiếu mật khẩu E2E cho ${role}.`);
    await page.goto('/login');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(accounts[role]);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page, `Đăng nhập ${role} thất bại: kiểm tra seed và mật khẩu E2E.`).not.toHaveURL(/\/login(?:\?|$)/);
    await page.goto('/courses');
    await expect(
      page.getByRole('heading', { name: 'Danh mục học phần', exact: true }),
      'Chưa vào được danh mục: kiểm tra quyền; R1 phải hoàn tất đổi mật khẩu lần đầu bằng tay và cập nhật E2E_ADMIN_PASSWORD.',
    ).toBeVisible();
    const statePath = authStatePath(role);
    await mkdir(dirname(statePath), { recursive: true });
    await page.context().storageState({ path: statePath });
  });
}
