import { expect, type Page } from '@playwright/test';
import { chooseOption } from './select.js';
import { uniqueSuffix } from './unique.js';

export interface CurriculumCourse {
  code: string;
  name: string;
}

interface ItemInput {
  credits?: string;
  semester?: string;
  elective?: boolean;
  block?: string;
  note?: string;
}

export function curriculumRow(page: Page, course: CurriculumCourse) {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: course.code, exact: true }) });
}

export async function prepareCurriculumItem(page: Page, path: string, course: CurriculumCourse, input: ItemInput = {}) {
  await page.goto(path);
  await page.getByRole('button', { name: 'Thêm học phần', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseOption(page, dialog.getByLabel('Học phần', { exact: true }), `${course.code} — ${course.name} (${input.credits ?? '2.5'} TC)`, { search: course.code });
  await chooseOption(page, dialog.getByLabel('Học kỳ', { exact: true }), `Học kỳ ${input.semester ?? '1'}`);
  if (input.elective) await dialog.getByRole('radio', { name: 'Tự chọn', exact: true }).check();
  if (input.block !== undefined) await dialog.getByLabel('Khối kiến thức', { exact: true }).fill(input.block);
  if (input.note !== undefined) await dialog.getByLabel('Ghi chú', { exact: true }).fill(input.note);
  return dialog;
}

export async function addCurriculumItem(page: Page, path: string, course: CurriculumCourse, input: ItemInput = {}) {
  const dialog = await prepareCurriculumItem(page, path, course, input);
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(curriculumRow(page, course)).toBeVisible();
}

export function electiveGroupRow(page: Page, code: string) {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: code, exact: true }) });
}

export async function prepareElectiveGroup(page: Page, path: string, minimum?: string) {
  const code = `EG${uniqueSuffix()}`;
  const name = `Nhóm tự chọn ${code}`;
  await page.goto(path.replace(/\/curriculum$/, '/elective-groups'));
  await page.getByRole('button', { name: 'Thêm nhóm', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mã nhóm', { exact: true }).fill(code);
  await dialog.getByLabel('Tên nhóm', { exact: true }).fill(name);
  if (minimum !== undefined) await dialog.getByLabel('Số tín chỉ tối thiểu', { exact: true }).fill(minimum);
  return { code, name };
}

export async function createElectiveGroup(page: Page, path: string, minimum = '6') {
  const group = await prepareElectiveGroup(page, path, minimum);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(electiveGroupRow(page, group.code)).toBeVisible();
  return group;
}

export async function assignElectiveItems(page: Page, code: string, courses: CurriculumCourse[], credits = '2.5') {
  await electiveGroupRow(page, code).getByRole('button', { name: 'Chọn học phần', exact: true }).click();
  const dialog = page.getByRole('dialog');
  // Transfer is not a Select: its visible list items hold checkboxes and arrow buttons.
  for (const course of courses) {
    await dialog.getByRole('listitem').filter({ hasText: `${course.code} — ${course.name} (${credits} TC)` }).getByRole('checkbox').check();
  }
  await dialog.getByRole('button', { name: 'right', exact: true }).click();
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

export async function chooseCurriculumFilter(page: Page, placeholder: string, label: string) {
  // These Selects lack accessible labels, and the placeholder text repeats in column headers, so scope to the Select
  // wrapper; capture the input ID before the placeholder disappears on selection.
  const input = page.locator('.ant-select').filter({ has: page.getByText(placeholder, { exact: true }) })
    .getByRole('combobox');
  await expect(input).toHaveAttribute('id', /.+/);
  const inputId = await input.getAttribute('id');
  await chooseOption(page, page.getByRole('combobox').and(page.locator(`[id=${inputId}]`)), label);
}

export async function chooseCurriculumSegment(page: Page, label: 'Theo học kỳ' | 'Dạng dòng' | 'Tất cả' | 'Bắt buộc' | 'Tự chọn') {
  await chooseSegment(page, label);
}

export async function chooseSegment(page: Page, label: string) {
  const group = page.getByRole('radiogroup').filter({ has: page.getByRole('radio', { name: label, exact: true }) });
  await group.getByText(label, { exact: true }).click();
  await expect(group.getByRole('radio', { name: label, exact: true })).toBeChecked();
}

export function semesterCard(page: Page, semester: number) {
  // Semester cards have no landmark role; scope by their unique visible semester title.
  return page.locator('.ant-card').filter({ has: page.getByText(new RegExp(`^Học kỳ ${semester} — `)) });
}

export async function setRequisite(page: Page, target: CurriculumCourse, source: CurriculumCourse, type = 'Tiên quyết') {
  await curriculumRow(page, target).getByRole('button', { name: 'Điều kiện', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Thêm điều kiện', exact: true }).click();
  await chooseOption(page, dialog.getByLabel('Học phần điều kiện', { exact: true }), `${source.code} — ${source.name} (2.5 TC)`, { search: source.code });
  await chooseOption(page, dialog.getByLabel('Loại', { exact: true }), type);
  if (type === 'Tiên quyết') await dialog.getByLabel('Ngưỡng điểm', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

// The warnings panel folds behind "Xem chi tiết" once it holds more than three warnings; open it before reading one.
export async function curriculumWarning(page: Page, text: string) {
  const expand = page.getByRole('button', { name: 'Xem chi tiết', exact: true });
  if (await expand.isVisible().catch(() => false)) await expand.click();
  // A panel mixing severities prefixes each line with its severity ("Cảnh báo: …"), so match the line, not the whole text.
  return page.getByRole('list', { name: 'Cảnh báo của khung', exact: true }).getByRole('listitem').filter({ hasText: text });
}
