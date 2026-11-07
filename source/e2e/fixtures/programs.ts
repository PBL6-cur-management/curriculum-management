import { expect, type Page } from '@playwright/test';
import { chooseOption } from './select.js';
import { uniqueSuffix } from './unique.js';

interface ProgramInput {
  code?: string;
  name?: string;
  degree?: string;
  semesters?: string;
  total?: string;
  compulsory?: string;
  elective?: string;
}

export async function prepareProgram(page: Page, input: ProgramInput = {}) {
  const code = input.code ?? `EP${uniqueSuffix()}`;
  const name = input.name ?? `Chương trình thử ${code}`;
  await page.goto('/programs/new');
  await expect(page.getByRole('heading', { name: 'Thêm chương trình', exact: true })).toBeVisible();
  await page.getByLabel('Mã chương trình', { exact: true }).fill(code);
  await page.getByLabel('Tên chương trình', { exact: true }).fill(name);
  await chooseOption(page, page.getByLabel('Trình độ', { exact: true }), input.degree ?? 'Kỹ sư');
  await page.getByLabel('Mã ngành', { exact: true }).fill('7480201');
  await page.getByLabel('Tên ngành', { exact: true }).fill('Công nghệ thông tin');
  await page.getByLabel('Số học kỳ', { exact: true }).fill(input.semesters ?? '8');
  await page.getByLabel('Tổng số tín chỉ', { exact: true }).fill(input.total ?? '10');
  await page.getByLabel('Tín chỉ bắt buộc', { exact: true }).fill(input.compulsory ?? '5');
  await page.getByLabel('Tín chỉ tự chọn', { exact: true }).fill(input.elective ?? '5');
  return { code, name };
}

export async function createProgram(page: Page, input: ProgramInput = {}) {
  const program = await prepareProgram(page, input);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(programHeading(page)).toContainText(`${program.code} — ${program.name}`);
  const path = new URL(page.url()).pathname;
  // The workspace navigates by tabs (PR #35), so the frame path is read from the URL the tab opens.
  await openProgramTab(page, 'Khung chương trình');
  await expect(page).toHaveURL(/\/curriculum$/);
  const curriculumPath = new URL(page.url()).pathname;
  await openProgramTab(page, 'Tổng quan');
  await expect(page).toHaveURL((url) => url.pathname === path);
  return { ...program, path, curriculumPath };
}

// The program workspace (ProgramWorkspaceLayout) names the program in an h3 above two rows of tabs.
export function programHeading(page: Page) {
  return page.getByRole('heading', { level: 3 }).first();
}

export async function openProgramTab(page: Page, group: string, subPage?: string) {
  const nav = page.getByRole('navigation', { name: 'Các mục của chương trình', exact: true });
  await nav.getByRole('tab', { name: group, exact: true }).click();
  if (subPage) await nav.getByRole('tab', { name: subPage, exact: true }).click();
}

export function programInfo(page: Page) {
  return page.locator('table').filter({ has: page.getByText('Mã chương trình', { exact: true }) });
}

export function programRow(page: Page, code: string) {
  return page.getByRole('row').filter({ has: page.getByRole('link', { name: code, exact: true }) });
}

export async function assignDirector(page: Page, user: { username: string; userCode: string; name: string }) {
  await page.getByRole('button', { name: 'Phân công', exact: true }).click();
  const dialog = page.getByRole('dialog');
  // UserSelect does not forward Form.Item's id to its combobox.
  await chooseOption(page, dialog.getByRole('combobox'), `${user.userCode} — ${user.name}`, { search: user.username });
  await dialog.getByRole('button', { name: 'Phân công', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: user.name, exact: true }) }).getByText('Đang hiệu lực', { exact: true })).toBeVisible();
}

export async function cloneProgram(page: Page) {
  const code = `EC${uniqueSuffix()}`;
  const name = `Bản sao thử ${code}`;
  await page.getByRole('button', { name: 'Nhân bản', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mã chương trình mới', { exact: true }).fill(code);
  await dialog.getByLabel('Tên chương trình mới', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Nhân bản', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(programHeading(page)).toContainText(`${code} — ${name}`);
  return { code, name, path: new URL(page.url()).pathname };
}
