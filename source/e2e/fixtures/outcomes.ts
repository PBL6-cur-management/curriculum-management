import { expect, type Browser, type Page } from '@playwright/test';
import { asRole } from './accounts.js';
import { createCourse } from './courses.js';
import { addCurriculumItem } from './curriculum.js';
import { cloneProgram, createProgram } from './programs.js';
import { createGroupedCourse, createSyllabus } from './syllabi.js';

type TestProgram = Awaited<ReturnType<typeof createProgram>>;
type TestSyllabus = Awaited<ReturnType<typeof createSyllabus>>;

export function outcomePath(program: TestProgram, screen: string) {
  return program.curriculumPath.replace(/\/curriculum$/, `/${screen}`);
}

export function outcomeVersionId(program: TestProgram) {
  const match = /\/versions\/([^/]+)\/curriculum$/.exec(program.curriculumPath);
  if (!match) throw new Error('Thiếu mã phiên bản chương trình riêng.');
  return match[1];
}

export function outcomeRow(page: Page, code: string) {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: code, exact: true }) });
}

export async function preparePlo(page: Page, program: TestProgram, code = 'PLO1', description = 'Mô tả PLO1') {
  await page.goto(outcomePath(program, 'plos'));
  await page.getByRole('button', { name: 'Thêm PLO', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mã PLO', { exact: true }).fill(code);
  await dialog.getByLabel('Mô tả (tiếng Việt)', { exact: true }).fill(description);
  return dialog;
}

export async function createPlo(page: Page, program: TestProgram, code = 'PLO1', description = 'Mô tả PLO1') {
  const dialog = await preparePlo(page, program, code, description);
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const normalized = code.trim().toUpperCase();
  await expect(outcomeRow(page, normalized)).toBeVisible();
  const response = await page.request.get(`/api/program-versions/${outcomeVersionId(program)}/plos`);
  expect(response.status()).toBe(200);
  const plo = (await response.json()).plos.find((item: { ploCode: string }) => item.ploCode === normalized);
  if (!plo) throw new Error('Không tìm được PLO vừa tạo trên chương trình riêng.');
  return { id: plo.id as string, code: normalized, description };
}

export async function prepareClo(page: Page, syllabus: TestSyllabus, code = 'CLO1', description = 'Mô tả CLO1') {
  await page.goto(syllabus.editPath);
  await page.getByRole('tab', { name: 'CLO', exact: true }).click();
  await page.getByRole('button', { name: /Thêm CLO$/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mã CLO', { exact: true }).fill(code);
  await dialog.getByLabel('Mô tả (tiếng Việt)', { exact: true }).fill(description);
  return dialog;
}

export async function createClo(page: Page, syllabus: TestSyllabus, code = 'CLO1', description = 'Mô tả CLO1') {
  const dialog = await prepareClo(page, syllabus, code, description);
  await dialog.getByLabel('Mức nhận thức', { exact: true }).fill('Áp dụng');
  await dialog.getByLabel('Mức nhận thức', { exact: true }).press('Escape');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const normalized = code.trim().toUpperCase();
  await expect(outcomeRow(page, normalized)).toBeVisible();
  const response = await page.request.get(`/api${syllabus.viewPath}`);
  expect(response.status()).toBe(200);
  const clo = (await response.json()).draft.clos.find((item: { cloCode: string }) => item.cloCode === normalized);
  if (!clo) throw new Error('Không tìm được CLO vừa tạo trên đề cương riêng.');
  return { id: clo.id as string, code: normalized, description };
}

export async function curriculumItemId(page: Page, program: TestProgram, courseCode: string) {
  const response = await page.request.get(`/api/program-versions/${outcomeVersionId(program)}/curriculum`);
  expect(response.status()).toBe(200);
  const item = (await response.json()).items.find((row: { course: { courseCode: string } }) => row.course.courseCode === courseCode);
  if (!item) throw new Error('Không tìm được học phần riêng trong khung riêng.');
  return item.id as string;
}

export function itemMatrixPath(program: TestProgram, itemId: string) {
  return outcomePath(program, `items/${itemId}/clo-plo`);
}

export async function matrixCell(page: Page, rowCode: string, ploCode: string) {
  const header = page.getByRole('columnheader', { name: new RegExp(`^${ploCode}(?: \\(|$)`) });
  await expect(header).toHaveCount(1);
  const column = await header.evaluate((element) => (element as HTMLTableCellElement).cellIndex + 1);
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: new RegExp(`^${rowCode} — `) }) });
  await expect(row).toHaveCount(1);
  return row.locator(`td:nth-child(${column})`);
}

export async function editWeight(page: Page, courseCode: string, ploCode: string, value: string) {
  const cell = await matrixCell(page, courseCode, ploCode);
  await cell.getByLabel(/^(Nhập trọng số|Trọng số )/).click();
  await cell.getByRole('textbox', { name: 'Trọng số', exact: true }).fill(value);
  await cell.getByRole('textbox', { name: 'Trọng số', exact: true }).press('Enter');
  return cell;
}

export async function setWeight(page: Page, program: TestProgram, courseCode: string, ploCode: string, value = '0,5') {
  await page.goto(outcomePath(program, 'course-plo-matrix'));
  const cell = await editWeight(page, courseCode, ploCode, value);
  await expect(cell).toHaveText(Number(value.replace(',', '.')).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));
}

export async function createOutcomeFixture(page: Page, options: { foreign?: boolean } = {}) {
  const program = await createProgram(page);
  const course = options.foreign ? await createCourse(page, { foreign: true }) : await createGroupedCourse(page);
  await addCurriculumItem(page, program.curriculumPath, course);
  const syllabus = await createSyllabus(page, course);
  const clo = await createClo(page, syllabus);
  const plo = await createPlo(page, program);
  const itemId = await curriculumItemId(page, program, course.code);
  return { program, course, syllabus, clo, plo, itemId, itemPath: itemMatrixPath(program, itemId), versionId: outcomeVersionId(program) };
}

export async function createAdminOutcome(browser: Browser) {
  const context = await browser.newContext(asRole('R1'));
  try {
    const page = await context.newPage();
    const owned = await createOutcomeFixture(page);
    return { ...owned, context };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function linkClo(page: Page, path: string, cloCode = 'CLO1', ploCode = 'PLO1') {
  await page.goto(path);
  const cell = await matrixCell(page, cloCode, ploCode);
  const checkbox = cell.getByRole('checkbox', { name: `${cloCode} – ${ploCode}`, exact: true });
  if (!(await checkbox.isChecked())) await checkbox.click();
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu.', { exact: true })).toBeVisible();
  await page.reload();
  await expect((await matrixCell(page, cloCode, ploCode)).getByRole('checkbox', { name: `${cloCode} – ${ploCode}`, exact: true })).toBeChecked();
}

export function coverageSection(page: Page, title: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

export async function cloneOutcomeProgram(page: Page, program: TestProgram) {
  await page.goto(program.path);
  const cloned = await cloneProgram(page);
  // The program workspace navigates by tabs (PR #35); the clone's frame path is the URL its tab opens.
  await page.getByRole('navigation', { name: 'Các mục của chương trình', exact: true }).getByRole('tab', { name: 'Khung chương trình', exact: true }).click();
  await expect(page).toHaveURL(/\/curriculum$/);
  const curriculumPath = new URL(page.url()).pathname;
  await page.goto(cloned.path);
  return { ...cloned, curriculumPath };
}
