import { createRequire } from "node:module";
import { expect, type Page } from "@playwright/test";
import type { components } from "../../frontend/src/shared/api/schema.js";
import { buildReleaseProgram, fixtureApi } from "./change-requests.js";
import {
  comparisonCohort,
  assignComparisonCohorts,
} from "./version-comparison.js";
import { uniqueSuffix } from "./unique.js";
import { xlsxMime } from "./imports.js";

interface Workbook {
  addWorksheet(name: string): { addRow(values: string[]): unknown };
  xlsx: { writeBuffer(): Promise<Uint8Array> };
}

const requireBackend = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const excel = requireBackend("exceljs") as { Workbook: new () => Workbook };
type Schemas = components["schemas"];
export async function studentWorld(page: Page) {
  const program = await buildReleaseProgram(page);
  const cohort = await comparisonCohort(page, "F17");
  await assignComparisonCohorts(
    page,
    program.id,
    program.versionId,
    program.semester.id,
    [cohort.id],
  );
  return { program, cohort, code: `S17${uniqueSuffix()}`.slice(0, 32) };
}
export async function syntheticWorkbook(
  type: "STUDENT_LIST" | "ACADEMIC_RESULT",
  rows: string[][],
) {
  const workbook = new excel.Workbook();
  const sheet = workbook.addWorksheet(
    type === "STUDENT_LIST" ? "Sinh viên" : "Kết quả học tập",
  );
  sheet.addRow(
    type === "STUDENT_LIST"
      ? [
          "Mã sinh viên",
          "Họ tên",
          "Khóa tuyển sinh",
          "Mã ngành",
          "Mã chương trình",
          "Học kỳ nhập học",
          "Học kỳ trạng thái",
          "Trạng thái",
        ]
      : [
          "Mã sinh viên",
          "Mã học phần",
          "Học kỳ",
          "Điểm thang 10",
          "Điểm thang 4",
          "Điểm chữ",
          "Trạng thái",
        ],
  );
  rows.forEach((row) => sheet.addRow(row));
  return {
    name: `Tong-hop-${uniqueSuffix()}.xlsx`,
    mimeType: xlsxMime,
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
}
export function profileRow(world: Awaited<ReturnType<typeof studentWorld>>) {
  return [
    world.code,
    `Sinh viên tổng hợp ${world.code}`,
    world.cohort.cohortCode,
    "7480201",
    world.program.code,
    world.program.semester.semesterCode,
    world.program.semester.semesterCode,
    "Đang học",
  ];
}
export async function uploadSynthetic(
  page: Page,
  type: "STUDENT_LIST" | "ACADEMIC_RESULT",
  rows: string[][],
) {
  await page.goto(`/imports?type=${type}`);
  await page
    .locator("input[type=file]")
    .setInputFiles(await syntheticWorkbook(type, rows));
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/imports" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Chạy thử", exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const batch = (await response.json()) as Schemas["ImportBatchDetailDto"];
  await expect
    .poll(
      async () =>
        (
          await fixtureApi<Schemas["ImportBatchDetailDto"]>(
            page,
            "GET",
            `/imports/${batch.id}`,
          )
        ).status,
      { timeout: 30_000 },
    )
    .not.toBe("VALIDATING");
  return batch.id;
}
export async function commitSynthetic(page: Page) {
  await expect(
    page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
  ).toBeEnabled({ timeout: 30_000 });
  await page
    .getByRole("button", { name: "Xác nhận nhập", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ghi dữ liệu", exact: true })
    .click();
  await expect(page.getByText("Đã ghi", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
export async function importedStudent(
  page: Page,
  world: Awaited<ReturnType<typeof studentWorld>>,
) {
  const result = await fixtureApi<Schemas["StudentPageDto"]>(
    page,
    "GET",
    `/students?${new URLSearchParams({ semesterId: world.program.semester.id, programId: world.program.id, q: world.code })}`,
  );
  const student = result.items.find(
    (entry) => entry.studentCode === world.code,
  );
  if (!student) throw new Error("Không tìm thấy sinh viên tổng hợp vừa nhập.");
  return student;
}
