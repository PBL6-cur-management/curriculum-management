import { expect, test } from '@playwright/test';
import { accounts, asRole } from '../fixtures/accounts.js';
import { fillPasswordChange, login } from '../fixtures/auth.js';
import { createUserWithPassword } from '../fixtures/users.js';
import { uniqueSuffix } from '../fixtures/unique.js';

test.describe('F-01 Đăng nhập, phiên', () => {
  test.describe('Chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('F01-TC_002 Kiểm tra tên đăng nhập không tồn tại', async ({ page }) => {
      await login(page, `absent.${uniqueSuffix()}`, 'Invalid12345');
      await expect(page.getByText('Tên đăng nhập hoặc mật khẩu không đúng.', { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    });

    test('F01-TC_007 Kiểm tra tên đăng nhập bắt buộc', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await expect(page.getByText('Nhập tên đăng nhập', { exact: true })).toBeVisible();
    });

    test('F01-TC_008 Kiểm tra mật khẩu bắt buộc', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Tên đăng nhập', { exact: true }).fill(`absent.${uniqueSuffix()}`);
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await expect(page.getByText('Nhập mật khẩu', { exact: true })).toBeVisible();
    });

    test('F01-TC_009 Kiểm tra trang được bảo vệ khi chưa đăng nhập', async ({ page }) => {
      await page.goto('/account');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
    });
  });

  test.describe('Tài khoản riêng', () => {
    test.use(asRole('R1'));

    test('F01-TC_001 Kiểm tra đăng nhập lần đầu', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, user.password);
        await expect(guest).toHaveURL(/\/account$/);
        await expect(guest.getByText('Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.', { exact: true })).toBeVisible();
        await guest.goto('/courses');
        await expect(guest).toHaveURL(/\/account$/);
      } finally {
        await context.close();
      }
    });

    test('F01-TC_003 Kiểm tra mật khẩu sai trên tài khoản riêng', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, 'Invalid12345');
        await expect(guest.getByText('Tên đăng nhập hoặc mật khẩu không đúng.', { exact: true })).toBeVisible();
        await expect(guest).toHaveURL(/\/login$/);
      } finally {
        await context.close();
      }
    });

    test('F01-TC_010 Kiểm tra đổi mật khẩu và đăng nhập lại', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const password = `Next${uniqueSuffix()}1`;
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, user.password);
        await expect(guest).toHaveURL(/\/account$/);
        await fillPasswordChange(guest, user.password, password);
        await expect(guest.getByText('Đã đổi mật khẩu', { exact: true })).toBeVisible();
        await expect(guest.getByText('Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.', { exact: true })).toHaveCount(0);
      } finally {
        await context.close();
      }
      const fresh = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await fresh.newPage();
        await login(guest, user.username, password);
        await expect(guest).not.toHaveURL(/\/login$/);
        await guest.goto('/account');
        await expect(guest.getByText(user.username, { exact: true })).toBeVisible();
        await expect(guest.getByText('Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.', { exact: true })).toHaveCount(0);
      } finally {
        await fresh.close();
      }
    });

    test('F01-TC_011 Kiểm tra kết thúc phiên riêng và nút quay lại', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, user.password);
        await expect(guest).toHaveURL(/\/account$/);
        await fillPasswordChange(guest, user.password, `Next${uniqueSuffix()}1`);
        await expect(guest.getByText('Đã đổi mật khẩu', { exact: true })).toBeVisible();
        await expect(guest.getByText('Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.', { exact: true })).not.toBeVisible();
        await expect(guest.getByText('Tài khoản của tôi', { exact: true })).toBeVisible();
        // The logo is also labelled "Trang chính"; click the menu entry that shows the words.
        await guest.getByRole('link', { name: 'Trang chính', exact: true }).filter({ hasText: 'Trang chính' }).click();
        await expect(guest).toHaveURL(new URL('/', baseURL).href);
        await expect(guest.getByRole('heading', { name: `Xin chào, ${user.name}`, exact: true })).toBeVisible();
        await guest.getByRole('button', { name: new RegExp(user.name) }).click();
        await guest.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
        await expect(guest).toHaveURL(/\/login$/);
        await guest.goBack();
        await expect(guest).toHaveURL(/\/login$/);
        await expect(guest.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
        await expect(guest.getByText('Tài khoản của tôi', { exact: true })).not.toBeVisible();
        await expect(guest.getByRole('heading', { name: `Xin chào, ${user.name}`, exact: true })).not.toBeVisible();
        await guest.goto('/account');
        await expect(guest).toHaveURL(/\/login$/);
      } finally {
        await context.close();
      }
    });

    test('F01-TC_012 Kiểm tra xác nhận mật khẩu không khớp', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, user.password);
        await expect(guest).toHaveURL(/\/account$/);
        await fillPasswordChange(guest, user.password, 'Newpass123', 'Otherpass123');
        await expect(guest.getByText('Mật khẩu nhập lại không khớp', { exact: true })).toBeVisible();
      } finally {
        await context.close();
      }
    });

    test('F01-TC_013 Kiểm tra mật khẩu dưới tám ký tự', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, user.password);
        await expect(guest).toHaveURL(/\/account$/);
        await fillPasswordChange(guest, user.password, 'Abc1234');
        await expect(guest.getByText('Mật khẩu có ít nhất 8 ký tự', { exact: true })).toBeVisible();
      } finally {
        await context.close();
      }
    });

    test('F01-TC_014 Kiểm tra mật khẩu thiếu số', async ({ page, browser, baseURL }) => {
      const user = await createUserWithPassword(page);
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const guest = await context.newPage();
        await login(guest, user.username, user.password);
        await expect(guest).toHaveURL(/\/account$/);
        await fillPasswordChange(guest, user.password, 'abcdefgh');
        await expect(guest.getByText('Mật khẩu phải có cả chữ và số', { exact: true })).toBeVisible();
      } finally {
        await context.close();
      }
    });
  });

  test.describe('R1', () => {
    test.use(asRole('R1'));
    test('F01-TC_020 Kiểm tra danh tính R1', async ({ page }) => {
      await page.goto('/account');
      await expect(page.getByText(accounts.R1, { exact: true })).toBeVisible();
    });
  });
  test.describe('R2', () => {
    test.use(asRole('R2'));
    test('F01-TC_021 Kiểm tra danh tính R2', async ({ page }) => {
      await page.goto('/account');
      await expect(page.getByText(accounts.R2, { exact: true })).toBeVisible();
    });
  });
  test.describe('R3', () => {
    test.use(asRole('R3'));
    test('F01-TC_022 Kiểm tra danh tính R3', async ({ page }) => {
      await page.goto('/account');
      await expect(page.getByText(accounts.R3, { exact: true })).toBeVisible();
    });
  });
  test.describe('R4', () => {
    test.use(asRole('R4'));
    test('F01-TC_023 Kiểm tra danh tính R4', async ({ page }) => {
      await page.goto('/account');
      await expect(page.getByText(accounts.R4, { exact: true })).toBeVisible();
    });
  });
  test.describe('R5', () => {
    test.use(asRole('R5'));
    test('F01-TC_024 Kiểm tra danh tính R5', async ({ page }) => {
      await page.goto('/account');
      await expect(page.getByText(accounts.R5, { exact: true })).toBeVisible();
    });
  });
  test.describe('R6', () => {
    test.use(asRole('R6'));
    test('F01-TC_025 Kiểm tra danh tính R6', async ({ page }) => {
      await page.goto('/account');
      await expect(page.getByText(accounts.R6, { exact: true })).toBeVisible();
    });
  });
});
