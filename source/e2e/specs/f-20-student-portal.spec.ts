import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { fillPasswordChange, login } from "../fixtures/auth.js";
import {
  commitSynthetic,
  profileRow,
  studentWorld,
  uploadSynthetic,
} from "../fixtures/student-records.js";

interface CredentialBook {
  xlsx: { load(buffer: Buffer): Promise<unknown> };
  worksheets: {
    getRow(index: number): { getCell(column: number): { text: string } };
  }[];
}
const requireBackend = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const excel = requireBackend("exceljs") as {
  Workbook: new () => CredentialBook;
};

// The only way a student gets a password: the one-time file handed out at import. Nothing is printed.
async function issueStudent(page: Page) {
  const world = await studentWorld(page);
  await uploadSynthetic(page, "STUDENT_LIST", [profileRow(world)]);
  await commitSynthetic(page);
  await page
    .getByRole("button", {
      name: "Tải mật khẩu ban đầu (một lần)",
      exact: true,
    })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Tải tệp mật khẩu", exact: true })
    .click();
  const file = await (await downloadPromise).path();
  const book = new excel.Workbook();
  await book.xlsx.load(await readFile(file));
  const row = book.worksheets[0]!.getRow(2);
  await uploadSynthetic(page, "ACADEMIC_RESULT", [
    [
      world.code,
      world.program.course.code,
      world.program.semester.semesterCode,
      "8.5",
      "3.7",
      "A",
      "Đạt",
    ],
  ]);
  await commitSynthetic(page);
  return {
    world,
    username: row.getCell(2).text,
    password: row.getCell(3).text,
  };
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("F-20 Cổng sinh viên", () => {
  test.use(asRole("R1"));

  test("F20-TC_001 Sinh viên xem chương trình, tiến độ, tư vấn đăng ký và tốt nghiệp trên màn hình 360px", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const issued = await issueStudent(page);
    const context = await browser.newContext({
      baseURL,
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
      viewport: { width: 360, height: 760 },
      // A fresh session: the R1 state this describe uses must not leak into the student's browser.
      storageState: { cookies: [], origins: [] },
    });
    try {
      const student = await context.newPage();
      await login(student, issued.username, issued.password);
      await fillPasswordChange(
        student,
        issued.password,
        `${issued.password}Moi9`,
      );
      await student.goto("/");
      await expect(student).toHaveURL(/\/student/);
      await expect(
        student.getByText(`Sinh viên tổng hợp ${issued.world.code}`),
      ).toBeVisible();
      await expect(
        student.getByText(`${issued.world.program.code} — `, { exact: false }),
      ).toBeVisible();
      await noSidewaysScroll(student);

      const nav = student.getByRole("navigation", { name: "Cổng sinh viên" });
      await nav
        .getByRole("link", { name: "Chương trình", exact: true })
        .click();
      await expect(
        student.getByText("Đã đạt", { exact: true }).first(),
      ).toBeVisible();
      await expect(student.getByText(/Điểm 8.5/).first()).toBeVisible();
      await noSidewaysScroll(student);

      await nav.getByRole("link", { name: "Tiến độ", exact: true }).click();
      await expect(
        student.getByText("Tiến độ học tập", { exact: true }),
      ).toBeVisible();
      await noSidewaysScroll(student);

      await nav.getByRole("link", { name: "Đăng ký HP", exact: true }).click();
      await expect(
        student.getByText(/Đăng ký thật thực hiện trên hệ thống của Trường/),
      ).toBeVisible();
      await expect(
        student.getByRole("button", { name: /^Đăng ký/ }),
      ).toHaveCount(0);
      await noSidewaysScroll(student);

      await nav.getByRole("link", { name: "Tốt nghiệp", exact: true }).click();
      await expect(
        student.getByText("Tự kiểm tra điều kiện tốt nghiệp", { exact: true }),
      ).toBeVisible();
      await noSidewaysScroll(student);
    } finally {
      await context.close();
    }
  });

  test("F20-TC_002 Tài khoản cán bộ không mở cổng sinh viên", async ({
    page,
  }) => {
    await page.goto("/student");
    await expect(page).not.toHaveURL(/\/student/);
  });
});
