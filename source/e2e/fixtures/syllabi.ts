import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { asRole } from "./accounts.js";
import { courseData, createCourse, prepareCourse } from "./courses.js";
import { addCurriculumItem } from "./curriculum.js";
import { createProgram } from "./programs.js";
import { chooseOption } from "./select.js";

type TestCourse = Awaited<ReturnType<typeof createCourse>>;

export async function createGroupedCourse(
  page: Page,
  group = courseData.homeGroup as string,
) {
  const course = await prepareCourse(page);
  await chooseOption(
    page,
    page.getByLabel("Nhóm phụ trách", { exact: true }),
    group,
  );
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: `${course.code} — ${course.name}`,
      exact: true,
    }),
  ).toBeVisible();
  return { ...course, path: new URL(page.url()).pathname };
}

export async function createSyllabus(page: Page, course?: TestCourse) {
  const owned = course ?? (await createCourse(page));
  const viewPath = `${owned.path}/syllabus`;
  await page.goto(viewPath);
  await page.getByRole("button", { name: "Tạo đề cương", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: `Sửa đề cương — ${owned.code} ${owned.name}`,
      exact: true,
    }),
  ).toBeVisible();
  const editPath = new URL(page.url()).pathname;
  const response = await page.request.get(`/api${viewPath}`);
  expect(response.status()).toBe(200);
  const data = await response.json();
  if (!data.draft?.id) throw new Error("Thiếu bản đề cương nháp riêng.");
  return {
    course: owned,
    viewPath,
    editPath,
    syllabusId: data.draft.id as string,
  };
}

export async function createAdminSyllabus(browser: Browser) {
  const context = await browser.newContext(asRole("R1"));
  try {
    const page = await context.newPage();
    const course = await createGroupedCourse(page);
    const syllabus = await createSyllabus(page, course);
    return { ...syllabus, context };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function createSharedSyllabus(page: Page) {
  const course = await createCourse(page);
  const first = await createProgram(page);
  const second = await createProgram(page);
  await addCurriculumItem(page, first.curriculumPath, course);
  await addCurriculumItem(page, second.curriculumPath, course);
  const syllabus = await createSyllabus(page, course);
  return { ...syllabus, programs: [first, second] };
}

export async function fillRichText(
  scope: Page | Locator,
  label: string,
  text: string,
) {
  const editor = scope.getByRole("textbox", { name: label, exact: true });
  await editor.fill(text);
  await expect(editor).toHaveText(text);
}

export async function pasteRichText(
  scope: Page | Locator,
  label: string,
  html: string,
) {
  const editor = scope.getByRole("textbox", { name: label, exact: true });
  await editor.focus();
  await editor.evaluate((element, markup) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", markup);
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, html);
}

export async function saveSyllabusContent(page: Page) {
  await page.getByRole("button", { name: "Lưu nội dung", exact: true }).click();
  await expect(page.getByText("Đã lưu.", { exact: true })).toBeVisible();
}

export function syllabusSection(page: Page, title: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

export function weeklyRow(page: Page, label: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: label, exact: true }) });
}

export async function prepareWeek(page: Page) {
  await page
    .getByRole("tab", { name: "Nội dung theo tuần", exact: true })
    .click();
  await page.getByRole("button", { name: /Thêm tuần$/ }).click();
  return page.getByRole("dialog");
}

export async function addWeek(page: Page, label: string) {
  const dialog = await prepareWeek(page);
  await dialog.getByLabel("Tuần", { exact: true }).fill(label);
  await fillRichText(dialog, "Nội dung", `Nội dung ${label}`);
  await fillRichText(dialog, "Hoạt động dạy học", "Thảo luận và thực hành");
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(weeklyRow(page, label)).toBeVisible();
}

export function attachmentRow(page: Page, fileName: string) {
  return page.getByRole("listitem").filter({ hasText: fileName });
}

export async function uploadAttachment(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Loại tài liệu" }),
    "Đề cương đã ký",
  );
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(attachmentRow(page, file.name)).toBeVisible();
}

export function signedPdf(code: string) {
  return {
    name: `Đề cương đã ký ${code}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
    ),
  };
}

export async function expectSyllabusWriteDenied(
  page: Page,
  owned: { syllabusId: string; viewPath: string; context: BrowserContext },
  message: string,
) {
  const response = await page.request.patch(
    `/api/syllabi/${owned.syllabusId}`,
    {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: { courseDescription: "<p>Nội dung không được ghi</p>" },
    },
  );
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ message });
  const stored = await owned.context.request.get(`/api${owned.viewPath}`);
  expect(stored.status()).toBe(200);
  expect((await stored.json()).draft.courseDescription).toBeNull();
}
