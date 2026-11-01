import { expect, type Page } from '@playwright/test';

export async function openConsistency(page: Page, curriculumPath: string, code: string) {
  await page.goto(curriculumPath.replace(/\/curriculum$/, '/consistency'));
  // The program workspace (PR #35) names the program in its own heading; the page heading is the check alone.
  await expect(page.getByRole('heading', { level: 3, name: new RegExp(`^${code} — `) })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kiểm tra nhất quán', exact: true })).toBeVisible();
}

export function creditRow(page: Page, label: 'Bắt buộc' | 'Tự chọn' | 'Tổng') {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: label, exact: true }) });
}

export async function acceptMismatch(page: Page, reason: string) {
  await page.getByRole('button', { name: 'Chấp nhận chênh lệch', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lý do', { exact: true }).fill(reason);
  await dialog.getByRole('button', { name: 'Chấp nhận', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Đã chấp nhận chênh lệch.', { exact: true })).toBeVisible();
}
