import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { createCourse } from "./courses.js";
import { addCurriculumItem } from "./curriculum.js";
import { createProgram } from "./programs.js";
import { uniqueSuffix } from "./unique.js";

export const xlsxMime =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function exportedDraft(page: Page) {
  const suffix = uniqueSuffix();
  const course = await createCourse(page, {
    code: `XI${suffix}`,
    name: `Học phần Excel ${suffix}`,
  });
  const program = await createProgram(page, {
    code: `XP${suffix}`,
    name: `Chương trình Excel ${suffix}`,
    total: "2.5",
    compulsory: "2.5",
    elective: "0",
  });
  await addCurriculumItem(page, program.curriculumPath, course, {
    block: "ĐC / *",
    note: `Ghi chú ${suffix}`,
  });
  const versionId = /\/versions\/([^/]+)\//.exec(program.curriculumPath)?.[1];
  if (!versionId) throw new Error("Thiếu phiên bản bản nháp.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Không tải được tệp Excel đã xuất.");
  const buffer = await readFile(path);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByRole("link", { name: "Nhập từ Excel", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/imports\\?type=CURRICULUM&versionId=${versionId}$`),
  );
  await expect(
    page.getByText(`${program.code} — ${program.name}`, { exact: true }),
  ).toBeVisible();
  return {
    program,
    course,
    versionId,
    file: { name: `Nhap-${suffix}.xlsx`, mimeType: xlsxMime, buffer },
  };
}

export async function dryRunFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page.locator("input[type=file]").setInputFiles(file);
  await page.getByRole("button", { name: "Chạy thử", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
  ).toBeEnabled({ timeout: 30_000 });
}
