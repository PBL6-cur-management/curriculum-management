import { expect, type Browser, type Page } from "@playwright/test";
import { accounts, asRole, type AccountRole } from "./accounts.js";
import { courseData } from "./courses.js";
import { createClo } from "./outcomes.js";
import { chooseOption } from "./select.js";
import { uniqueSuffix } from "./unique.js";

interface ProgramRecord {
  id: string;
  faculty: { id: string };
  currentVersion: { id: string };
}

interface SemesterRecord {
  id: string;
  semesterCode: string;
  startDate: string | null;
}

export interface RequestRecord {
  id: string;
  requestCode: string;
  title: string;
  workspace: { copyId: string } | null;
}

export interface ReleaseProgram {
  id: string;
  code: string;
  name: string;
  versionId: string;
  path: string;
  curriculumPath: string;
  releasePath: string;
  course: { id: string; code: string; name: string; path: string };
  syllabusId: string;
  semester: SemesterRecord;
}

export async function fixtureApi<Response>(
  page: Page,
  method: "GET" | "POST" | "PATCH" | "PUT",
  path: string,
  data?: unknown,
): Promise<Response> {
  const response = await page.request.fetch(`/api${path}`, {
    method,
    headers: { "X-Requested-With": "XMLHttpRequest" },
    ...(data === undefined ? {} : { data }),
  });
  expect(
    response.ok(),
    `${method} ${path}: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as Response;
}

export async function withRequestRole<Result>(
  browser: Browser,
  role: AccountRole,
  action: (page: Page) => Promise<Result>,
) {
  const context = await browser.newContext({
    ...asRole(role),
    baseURL: "http://localhost:5173",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  try {
    return await action(await context.newPage());
  } finally {
    await context.close();
  }
}

export async function releaseSemester(page: Page, started: boolean) {
  const semesters = await fixtureApi<SemesterRecord[]>(
    page,
    "GET",
    "/semesters",
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const semester = semesters.find(
    (entry) =>
      entry.startDate !== null &&
      (started ? entry.startDate <= today : entry.startDate > today),
  );
  if (!semester)
    throw new Error(
      `Không có học kỳ ${started ? "đã bắt đầu" : "tương lai"}; không sửa học kỳ seed.`,
    );
  return semester;
}

export async function prepareSyllabusAssessment(
  page: Page,
  syllabus: Parameters<typeof createClo>[1],
) {
  const clo = await createClo(page, syllabus);
  const revision = await fixtureApi<{ draft: { updatedAt: string } }>(
    page,
    "GET",
    syllabus.viewPath,
  );
  const formula = await fixtureApi<{ components: { id: string }[] }>(
    page,
    "PUT",
    `/syllabi/${syllabus.syllabusId}/grading-formula`,
    {
      expectedUpdatedAt: revision.draft.updatedAt,
      failingScore: null,
      components: [
        {
          componentCode: "CK",
          componentName: "Cuối kỳ",
          weight: "100",
          assessmentForm: "Bài kiểm tra tổng hợp",
          isConditional: false,
          conditionThreshold: null,
          failingScore: null,
        },
      ],
    },
  );
  const updated = await fixtureApi<{ draft: { updatedAt: string } }>(
    page,
    "GET",
    syllabus.viewPath,
  );
  await fixtureApi(
    page,
    "PUT",
    `/syllabi/${syllabus.syllabusId}/assessment-clo-mappings`,
    {
      expectedUpdatedAt: updated.draft.updatedAt,
      mappings: [
        {
          assessmentComponentId: formula.components[0].id,
          cloId: clo.id,
          cloWeight: "100",
        },
      ],
    },
  );
}

export async function buildReleaseProgram(
  page: Page,
  released = true,
): Promise<ReleaseProgram> {
  const code = `EP${uniqueSuffix()}`;
  const name = `Chương trình thử ${code}`;
  const program = await fixtureApi<ProgramRecord>(page, "POST", "/programs", {
    programCode: code,
    programName: name,
    degreeLevel: "ENGINEER",
    majorCode: "7480201",
    majorName: "Công nghệ thông tin",
    semesterCount: 8,
    totalCredits: "2.5",
    compulsoryCredits: "2.5",
    electiveCredits: "0",
  });
  const users = await fixtureApi<{ items: { id: string; username: string }[] }>(
    page,
    "GET",
    `/users?q=${encodeURIComponent(accounts.R3)}`,
  );
  const director = users.items.find((user) => user.username === accounts.R3);
  if (!director)
    throw new Error("Thiếu Giám đốc CTĐT demo; không đổi tài khoản seed.");
  await fixtureApi(page, "POST", `/programs/${program.id}/directors`, {
    directorId: director.id,
    validFrom: "2020-01-01",
  });
  const groups = await fixtureApi<
    { id: string; groupCode: string; groupName: string }[]
  >(page, "GET", "/subject-groups");
  const group = groups.find(
    (entry) =>
      `${entry.groupCode} — ${entry.groupName}` === courseData.homeGroup,
  );
  if (!group) throw new Error("Thiếu nhóm KHMT demo; không sửa nhóm seed.");
  const courseCode = `E2E${uniqueSuffix()}`;
  const courseName = `Học phần thử ${courseCode}`;
  const course = await fixtureApi<{ id: string }>(page, "POST", "/courses", {
    courseCode,
    courseName,
    credits: "2.5",
    courseType: "THEORY",
    ownerFacultyId: program.faculty.id,
    ownerGroupId: group.id,
  });
  const versionId = program.currentVersion.id;
  await fixtureApi(
    page,
    "POST",
    `/program-versions/${versionId}/curriculum-items`,
    { courseId: course.id, plannedSemester: 1, isElective: false },
  );
  const syllabus = await fixtureApi<{ draft: { id: string } }>(
    page,
    "POST",
    `/courses/${course.id}/syllabus`,
  );
  await fixtureApi(page, "PATCH", `/syllabi/${syllabus.draft.id}`, {
    courseDescription: `<p>Mô tả ${courseCode}</p>`,
    objectives: `<p>Mục tiêu ${courseCode}</p>`,
  });
  const syllabusPath = `/courses/${course.id}/syllabus`;
  await prepareSyllabusAssessment(page, {
    course: {
      code: courseCode,
      name: courseName,
      path: `/courses/${course.id}`,
    },
    viewPath: syllabusPath,
    editPath: `${syllabusPath}/edit`,
    syllabusId: syllabus.draft.id,
  });
  const check = await fixtureApi<{
    canRelease: boolean;
    consistencyIssues: unknown[];
    syllabusIssues: unknown[];
  }>(
    page,
    "GET",
    `/programs/${program.id}/versions/${versionId}/release-check`,
  );
  expect(
    check.canRelease,
    `Khung riêng và đề cương phải đủ điều kiện ban hành. Issues: ${JSON.stringify({ consistencyIssues: check.consistencyIssues, syllabusIssues: check.syllabusIssues })}`,
  ).toBeTruthy();
  const semester = await releaseSemester(page, true);
  const result = {
    id: program.id,
    code,
    name,
    versionId,
    path: `/programs/${program.id}`,
    curriculumPath: `/programs/${program.id}/versions/${versionId}/curriculum`,
    releasePath: `/programs/${program.id}/versions/${versionId}/release`,
    course: {
      id: course.id,
      code: courseCode,
      name: courseName,
      path: `/courses/${course.id}`,
    },
    syllabusId: syllabus.draft.id,
    semester,
  };
  if (released)
    await fixtureApi(
      page,
      "POST",
      `/programs/${program.id}/versions/${versionId}/release`,
      {
        decisionNumber: `QĐ-${code}`,
        signedDate: "2026-10-01",
        effectiveSemesterId: semester.id,
        cohortIds: [],
      },
    );
  return result;
}

export async function prepareRequest(
  page: Page,
  program: ReleaseProgram,
  options: { university?: boolean; course?: boolean; title?: string } = {},
) {
  const title = options.title ?? `Đề xuất ${uniqueSuffix()}`;
  const query = new URLSearchParams({
    type: options.course ? "SYLLABUS_CONTENT" : "PROGRAM_INFO",
    targetType: options.course ? "COURSE" : "PROGRAM",
    targetId: options.course ? program.course.id : program.id,
  });
  await page.goto(`/change-requests/new?${query}`);
  await expect(
    page.getByRole("heading", { name: "Tạo đề xuất thay đổi", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tiêu đề", { exact: true }).fill(title);
  await page
    .getByLabel("Lý do", { exact: true })
    .fill(`Cập nhật phục vụ kiểm thử ${title}`);
  if (options.university)
    await page
      .getByRole("radio", { name: "Theo yêu cầu của Trường", exact: true })
      .click();
  return title;
}

export async function saveRequest(page: Page): Promise<RequestRecord> {
  const response = page.waitForResponse(
    (entry) =>
      entry.request().method() === "POST" &&
      new URL(entry.url()).pathname === "/api/change-requests",
  );
  await page.getByRole("button", { name: /Tạo đề xuất$/ }).click();
  const result = await response;
  expect(result.ok()).toBeTruthy();
  const request = (await result.json()) as RequestRecord;
  await expect(page).toHaveURL(
    new RegExp(`/change-requests/${request.id}/edit$`),
  );
  await expect(page.getByRole("heading", { level: 2 })).toContainText(
    request.requestCode,
  );
  return request;
}

export async function seedRequest(
  page: Page,
  program: ReleaseProgram,
  course = true,
): Promise<RequestRecord> {
  const request = await fixtureApi<RequestRecord>(
    page,
    "POST",
    "/change-requests",
    {
      requestType: course ? "SYLLABUS_CONTENT" : "PROGRAM_INFO",
      targetType: course ? "COURSE" : "PROGRAM",
      targetId: course ? program.course.id : program.id,
      title: `Đề xuất ${uniqueSuffix()}`,
      reason: "Cập nhật nội dung phục vụ kiểm thử độc lập.",
      origin: "FACULTY",
    },
  );
  if (!request.workspace) throw new Error("Đề xuất riêng không có bản sao.");
  await fixtureApi(
    page,
    "PATCH",
    course
      ? `/syllabi/${request.workspace.copyId}`
      : `/program-versions/${request.workspace.copyId}/info`,
    course
      ? { courseDescription: `<p>Nội dung ${request.title}</p>` }
      : { programName: `Điều chỉnh ${program.code}` },
  );
  return request;
}

export async function submitRequest(page: Page, request: RequestRecord) {
  await page.goto(`/change-requests/${request.id}/edit`);
  await page.getByRole("button", { name: /Gửi duyệt$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Gửi đề xuất đi duyệt" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/change-requests/${request.id}$`));
}

export function requestHeading(page: Page, request: RequestRecord) {
  return page
    .getByRole("heading", { level: 2 })
    .filter({ hasText: request.requestCode });
}

export async function uploadRequestDocument(page: Page, fileName: string) {
  await page
    .getByRole("button", { name: "Tải hồ sơ lên", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Tải hồ sơ lên" });
  await chooseOption(
    page,
    dialog.getByRole("combobox", { name: "Loại hồ sơ" }),
    "Công văn",
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: fileName }),
  ).toBeVisible();
}

export async function buildAdminReleaseProgram(
  browser: Browser,
  released = true,
) {
  return await withRequestRole(browser, "R1", (page) =>
    buildReleaseProgram(page, released),
  );
}

export async function buildPendingRequest(
  browser: Browser,
  creator: AccountRole = "R5",
) {
  const program = await buildAdminReleaseProgram(browser);
  const request = await withRequestRole(browser, creator, async (page) => {
    const result = await seedRequest(page, program);
    await fixtureApi(page, "POST", `/change-requests/${result.id}/submit`);
    return result;
  });
  return { program, request };
}

export async function withdrawRequest(page: Page, request: RequestRecord) {
  await page.goto(`/change-requests/${request.id}`);
  await page.getByRole("button", { name: "Rút đề xuất", exact: true }).click();
  const confirm = page.locator(".ant-popconfirm:visible").filter({
    hasText:
      "Rút đề xuất? Đề xuất sẽ rời khỏi hàng chờ của mọi người duyệt và không gửi lại được.",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Rút", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  await expect(page.getByText("Đã rút", { exact: true })).toBeVisible();
}

export const decisionRemark =
  "Nội dung cần được rà soát lại trước khi tiếp tục.";

export async function advanceRequest(
  browser: Browser,
  request: RequestRecord,
  through: "coordinator" | "director",
) {
  await withRequestRole(browser, "R4", (page) =>
    fixtureApi(page, "POST", `/change-requests/${request.id}/approve`),
  );
  if (through === "director")
    await withRequestRole(browser, "R3", (page) =>
      fixtureApi(page, "POST", `/change-requests/${request.id}/approve`),
    );
}

export async function approveRequest(page: Page, request: RequestRecord) {
  await page.goto(`/change-requests/${request.id}`);
  await expect(requestHeading(page, request)).toBeVisible();
  await page.getByRole("button", { name: "Đồng ý", exact: true }).click();
  const confirm = page.locator(".ant-popconfirm:visible");
  await expect(
    confirm.getByText("Đồng ý đề xuất này?", { exact: true }),
  ).toBeVisible();
  await confirm.getByRole("button", { name: "Đồng ý", exact: true }).click();
  await expect(page.getByText("Đã đồng ý.", { exact: true })).toBeVisible();
  await expect(confirm).not.toBeVisible();
}

export async function decideRequest(
  page: Page,
  request: RequestRecord,
  action: "Trả lại" | "Từ chối",
  remark = decisionRemark,
) {
  await page.goto(`/change-requests/${request.id}`);
  await page.getByRole("button", { name: action, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `${action} đề xuất` });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Lý do", { exact: true }).fill(remark);
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

export async function openRequestHistory(page: Page) {
  const panel = page
    .locator(".ant-collapse-item")
    .filter({ has: page.getByText("Lịch sử phê duyệt", { exact: true }) });
  await panel.getByRole("button", { name: /Lịch sử phê duyệt$/ }).click();
  await expect(panel.getByText(/Lần gửi 1 —/)).toBeVisible();
  return panel;
}

export async function addRequestComment(page: Page, content: string) {
  await page
    .getByRole("textbox", { name: "Nội dung bình luận", exact: true })
    .fill(content);
  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  const item = page.getByRole("listitem").filter({ hasText: content });
  await expect(item).toBeVisible();
  return item;
}
