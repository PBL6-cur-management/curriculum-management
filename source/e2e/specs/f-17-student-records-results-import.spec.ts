import { expect, test } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { chooseOption } from "../fixtures/select.js";
import {
  commitSynthetic,
  importedStudent,
  profileRow,
  studentWorld,
  uploadSynthetic,
} from "../fixtures/student-records.js";

test.describe("F-17 Hồ sơ sinh viên và nhập kết quả", () => {
  test.use(asRole("R1"));
  test("F17-TC_001 Nhập sinh viên rồi mở hồ sơ với đúng ngữ cảnh", async ({
    page,
  }) => {
    const world = await studentWorld(page);
    await uploadSynthetic(page, "STUDENT_LIST", [profileRow(world)]);
    await commitSynthetic(page);
    await page.goto("/students");
    await expect(page.getByText("Chọn học kỳ để xem sinh viên")).toBeVisible();
    await chooseOption(
      page,
      page.getByRole("combobox", { name: "Học kỳ", exact: true }),
      `${world.program.semester.semesterCode} · ${world.program.semester.startDate}`,
    );
    await chooseOption(
      page,
      page.getByRole("combobox", { name: "Chương trình", exact: true }),
      `${world.program.code} — ${world.program.name}`,
      { search: world.program.code },
    );
    await page.getByRole("textbox", { name: "Tìm sinh viên" }).fill(world.code);
    await page.getByRole("link", { name: world.code, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `semesterId=${world.program.semester.id}.*programId=${world.program.id}`,
      ),
    );
    await expect(
      page.getByText("Hồ sơ sinh viên", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Theo khóa", exact: true }),
    ).toBeVisible();
  });
  test("F17-TC_002 Tải mật khẩu một lần qua xác nhận riêng", async ({
    page,
  }) => {
    const world = await studentWorld(page);
    const batchId = await uploadSynthetic(page, "STUDENT_LIST", [
      profileRow(world),
    ]);
    await commitSynthetic(page);
    await page
      .getByRole("button", {
        name: "Tải mật khẩu ban đầu (một lần)",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "Tệp chứa mật khẩu ban đầu. Chỉ tải được một lần; hãy bảo quản và phát qua kênh an toàn.",
      ),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Tải tệp mật khẩu", exact: true })
      .click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/\.xlsx$/);
    await page.goto(`/imports/history/${batchId}`);
    await expect(
      page.getByText(/Tệp mật khẩu ban đầu không còn khả dụng/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Tải mật khẩu ban đầu (một lần)",
        exact: true,
      }),
    ).toHaveCount(0);
  });
  test("F17-TC_003 Mã sinh viên trùng chặn xác nhận ghi", async ({ page }) => {
    const world = await studentWorld(page);
    const row = profileRow(world);
    await uploadSynthetic(page, "STUDENT_LIST", [row, row]);
    await expect(
      page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText("LỖI", { exact: true }).first()).toBeVisible();
  });
  test("F17-TC_004 Nhập kết quả giữ điểm trống và không có thao tác sửa điểm", async ({
    page,
  }) => {
    const world = await studentWorld(page);
    await uploadSynthetic(page, "STUDENT_LIST", [profileRow(world)]);
    await commitSynthetic(page);
    const student = await importedStudent(page, world);
    await uploadSynthetic(page, "ACADEMIC_RESULT", [
      [
        world.code,
        world.program.course.code,
        world.program.semester.semesterCode,
        "",
        "",
        "",
        "Đang học",
      ],
    ]);
    await commitSynthetic(page);
    await page.goto(
      `/students/${student.id}?semesterId=${world.program.semester.id}&programId=${world.program.id}`,
    );
    await page
      .getByRole("tab", { name: "Kết quả học tập", exact: true })
      .click();
    await expect(
      page.getByRole("cell", {
        name: `${world.program.course.code} — ${world.program.course.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "—", exact: true }),
    ).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: /Sửa điểm|Xóa kết quả/ }),
    ).toHaveCount(0);
  });
});
test.describe("F-17 Quyền sinh viên", () => {
  test.use(asRole("R6"));
  test("F17-TC_005 R6 không mở được danh sách sinh viên của cán bộ", async ({
    page,
  }) => {
    await page.goto("/students");
    await expect(
      page.getByText("Bạn không có quyền truy cập hồ sơ sinh viên"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sinh viên", exact: true }),
    ).toHaveCount(0);
  });
});
