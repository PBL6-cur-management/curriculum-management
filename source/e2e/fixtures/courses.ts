import { expect, type Page } from '@playwright/test';
import { chooseOption } from './select.js';
import { uniqueSuffix } from './unique.js';

export const courseData = {
  homeFaculty: 'Khoa Công nghệ Thông tin',
  foreignFaculty: 'Khoa Khoa học cơ bản',
  homeGroup: 'E2E-KHMT — Khoa học máy tính',
  creditError: 'Số tín chỉ phải là số từ 0 đến 999.99, tối đa 2 chữ số thập phân (ví dụ 3, 2.5 hoặc 0).',
  cancelWarning: 'Học phần đã hủy không mở lại được và không sửa được. Chỉ hủy học phần chưa từng dùng trong phiên bản đã ban hành và chưa có kết quả học tập.',
} as const;

interface CourseInput {
  code?: string;
  name?: string;
  englishName?: string;
  credits?: string;
  type?: string;
  foreign?: boolean;
}

export async function prepareCourse(page: Page, input: CourseInput = {}) {
  const code = input.code ?? `E2E${uniqueSuffix()}`;
  const name = input.name ?? `Học phần thử ${code}`;
  await page.goto('/courses/new');
  await expect(page.getByRole('heading', { name: 'Thêm học phần', exact: true })).toBeVisible();
  await page.getByLabel('Mã học phần', { exact: true }).fill(code);
  await page.getByLabel('Tên tiếng Việt', { exact: true }).fill(name);
  await page.getByLabel('Số tín chỉ', { exact: true }).fill(input.credits ?? '2.5');
  if (input.englishName !== undefined) {
    await page.getByLabel('Tên tiếng Anh', { exact: true }).fill(input.englishName);
  }
  await chooseOption(page, page.getByLabel('Loại học phần', { exact: true }), input.type ?? 'Lý thuyết');
  // OrgUnitSelect does not forward Form.Item's id, so the faculty has no accessible label; type precedes faculty.
  await chooseOption(
    page,
    page.getByRole('combobox').nth(1),
    input.foreign ? courseData.foreignFaculty : courseData.homeFaculty,
  );
  return { code: code.trim().toUpperCase(), name: name.trim() };
}

export async function createCourse(page: Page, input: CourseInput = {}) {
  const course = await prepareCourse(page, input);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${course.code} — ${course.name}`, exact: true })).toBeVisible();
  return { ...course, path: new URL(page.url()).pathname };
}

export async function openSeedCourse(page: Page, code: string) {
  await page.goto('/courses');
  await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(code);
  await page.getByRole('link', { name: code, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText(`${code} —`);
}

export async function openStatusAction(page: Page, action: string) {
  await page.getByRole('button', { name: 'Đổi trạng thái', exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
  return page.getByRole('dialog');
}

export async function cancelCourse(page: Page) {
  const dialog = await openStatusAction(page, 'Hủy học phần');
  await dialog.getByRole('button', { name: 'Hủy học phần', exact: true }).click();
  await expect(page.getByText('Đã chuyển sang Đã hủy.', { exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
}

export async function discontinueCourse(page: Page) {
  const dialog = await openStatusAction(page, 'Ngừng mở lớp');
  await chooseOption(
    page,
    dialog.getByRole('combobox'),
    'ITS100 — Định hướng ngành Công nghệ thông tin (0 TC)',
    { search: 'ITS100' },
  );
  await dialog.getByRole('button', { name: 'Ngừng mở lớp', exact: true }).click();
  await expect(page.getByText('Đã chuyển sang Ngừng mở lớp.', { exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
}
