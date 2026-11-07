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

const DEGREE_LEVELS: Record<string, string> = { 'Kỹ sư': 'ENGINEER', 'Cử nhân': 'BACHELOR' };

// The UI has no "Thêm chương trình" form: programmes are only ever cloned there, so test data goes in through the API.
async function postProgram(page: Page, input: ProgramInput) {
  const code = input.code ?? `EP${uniqueSuffix()}`;
  const name = input.name ?? `Chương trình thử ${code}`;
  const response = await page.request.post('/api/programs', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: {
      programCode: code,
      programName: name,
      degreeLevel: DEGREE_LEVELS[input.degree ?? 'Kỹ sư'],
      majorCode: '7480201',
      majorName: 'Công nghệ thông tin',
      semesterCount: Number(input.semesters ?? '8'),
      totalCredits: input.total ?? '10',
      compulsoryCredits: input.compulsory ?? '5',
      electiveCredits: input.elective ?? '5',
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return { code, name, id };
}

export async function createProgram(page: Page, input: ProgramInput = {}) {
  const program = await postProgram(page, input);
  await page.goto(`/programs/${program.id}`);
  await expect(page.getByRole('heading', { level: 2 })).toContainText(`${program.code} — ${program.name}`);
  const path = new URL(page.url()).pathname;
  await expect(page.getByRole('link', { name: 'Khung chương trình', exact: true })).toBeVisible();
  const curriculumPath = await page.getByRole('link', { name: 'Khung chương trình', exact: true }).getAttribute('href');
  if (!curriculumPath) throw new Error('Thiếu đường dẫn khung chương trình riêng.');
  return { code: program.code, name: program.name, path, curriculumPath };
}

export async function openProgramEdit(page: Page, input: ProgramInput = {}) {
  const program = await postProgram(page, input);
  await page.goto(`/programs/${program.id}/edit`);
  await expect(page.getByRole('heading', { name: `Sửa thông tin chương trình ${program.code}`, exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên chương trình', { exact: true })).toHaveValue(program.name);
  return program;
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
  await expect(page.getByRole('heading', { level: 2 })).toContainText(`${code} — ${name}`);
  return { code, name, path: new URL(page.url()).pathname };
}
