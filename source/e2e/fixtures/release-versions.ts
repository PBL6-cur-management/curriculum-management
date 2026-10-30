import { expect, type Browser, type Page } from '@playwright/test';
import {
  advanceRequest, buildReleaseProgram, fixtureApi, releaseSemester, seedRequest, withRequestRole,
  type ReleaseProgram, type RequestRecord,
} from './change-requests.js';
import { chooseOption } from './select.js';
import { uniqueSuffix } from './unique.js';
import { attachmentRow, syllabusSection } from './syllabi.js';

export const versionPath = (program: ReleaseProgram, versionId = program.versionId) => `${program.path}/versions/${versionId}`;

export async function fillReleaseDecision(page: Page, started = false) {
  const semester = await releaseSemester(page, started);
  const decision = `QĐ-${uniqueSuffix()}`;
  await page.getByLabel('Số quyết định', { exact: true }).fill(decision);
  await page.getByLabel('Ngày ký', { exact: true }).fill('01/10/2026');
  await page.getByLabel('Ngày ký', { exact: true }).press('Enter');
  await chooseOption(page, page.getByLabel('Học kỳ hiệu lực', { exact: true }), `${semester.semesterCode} · ${semester.startDate}`);
  return { decision, semester };
}

export async function confirmInitialRelease(page: Page) {
  await page.getByRole('button', { name: /Ban hành$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Ban hành phiên bản này?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Ban hành$/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('· phiên bản');
}

export async function finalRequest(browser: Browser) {
  const program = await withRequestRole(browser, 'R1', (page) => buildReleaseProgram(page));
  const request = await withRequestRole(browser, 'R5', async (page) => {
    const created = await seedRequest(page, program);
    await fixtureApi(page, 'POST', `/change-requests/${created.id}/submit`);
    return created;
  });
  await advanceRequest(browser, request, 'director');
  return { program, request };
}

export async function confirmFinalRelease(page: Page) {
  await page.getByRole('button', { name: /Phê duyệt cuối$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chấp thuận và ban hành?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Phê duyệt cuối$/ }).click();
}

export async function prepareApprovedRelease(page: Page, browser: Browser) {
  const { program, request } = await finalRequest(browser);
  const semester = await releaseSemester(page, false);
  await fixtureApi(page, 'POST', `/change-requests/${request.id}/final-approve`, {
    decisionNumber: `QĐ-${program.code}`, signedDate: '2026-10-01', effectiveSemesterId: semester.id,
  });
  const history = await fixtureApi<{ versions: { id: string; originRequest: { id: string } | null }[] }>(page, 'GET', `${program.path}/versions`);
  const released = history.versions.find((entry) => entry.originRequest?.id === request.id);
  if (!released) throw new Error('Không tìm thấy phiên bản sinh từ đề xuất riêng.');
  return { program, request, versionId: released.id, semester };
}

export async function openCorrection(page: Page, program: ReleaseProgram) {
  await page.goto(versionPath(program));
  await page.getByRole('button', { name: /Đính chính$/ }).click();
  await expect(page.getByRole('heading', { name: 'Ban hành đính chính', exact: true })).toBeVisible();
}

export async function issueCorrection(page: Page, reason = 'Đính chính nội dung trên chương trình kiểm thử riêng.') {
  await page.getByLabel('Lý do đính chính', { exact: true }).fill(reason);
  await page.getByRole('button', { name: /Ban hành đính chính$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Ban hành đính chính?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Ban hành$/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('phiên bản');
}

export async function additionalReleaseCourse(page: Page, program: ReleaseProgram) {
  const original = await fixtureApi<{ ownerFaculty: { id: string }; ownerGroup: { id: string } }>(page, 'GET', program.course.path);
  const code = `E2E${uniqueSuffix()}`;
  const course = await fixtureApi<{ id: string }>(page, 'POST', '/courses', {
    courseCode: code, courseName: `Học phần thử ${code}`, credits: '2.5', courseType: 'THEORY',
    ownerFacultyId: original.ownerFaculty.id, ownerGroupId: original.ownerGroup.id,
  });
  return { ...course, code };
}

export async function openFinalApproval(page: Page, request: RequestRecord) {
  await page.goto(`/change-requests/${request.id}/final-approval`);
  await expect(page.getByRole('heading', { name: 'Phê duyệt cuối và ban hành', exact: true })).toBeVisible();
}

export async function attachPublishedFile(page: Page, program: ReleaseProgram, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(`${program.course.path}/syllabus?versionId=${program.versionId}`);
  const section = syllabusSection(page, 'Tệp đính kèm');
  await chooseOption(page, section.getByRole('combobox', { name: 'Loại tài liệu' }), 'Đề cương đã ký');
  await section.locator('input[type=file]').setInputFiles(file);
  await expect(attachmentRow(page, file.name)).toBeVisible();
}
