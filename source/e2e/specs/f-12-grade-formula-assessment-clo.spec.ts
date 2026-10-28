import { expect, test, type Page } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { createClo } from "../fixtures/outcomes.js";
import { createSyllabus, syllabusSection } from "../fixtures/syllabi.js";

async function addComponent(
  page: Page,
  index: number,
  code: string,
  name: string,
  weight: string,
) {
  await page.getByRole("button", { name: "Thêm thành phần" }).click();
  await page.getByLabel("Mã", { exact: true }).nth(index).fill(code);
  await page
    .getByLabel("Tên thành phần", { exact: true })
    .nth(index)
    .fill(name);
  await page
    .getByLabel("Tỷ trọng (%)", { exact: true })
    .nth(index)
    .fill(weight);
}

async function openFormulaTab(page: Page, editPath: string) {
  await page.goto(editPath);
  await page.getByRole("tab", { name: "Công thức điểm", exact: true }).click();
}

test.describe("F-12 Công thức điểm và ánh xạ CLO", () => {
  test.use(asRole("R1"));

  test("F12-TC_001 Lưu công thức điểm đủ 100% và xem lại ở trang đề cương", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    await openFormulaTab(page, syllabus.editPath);
    await addComponent(page, 0, "GK", "Giữa kỳ", "40");
    await addComponent(page, 1, "CK", "Cuối kỳ", "60");
    await expect(page.getByRole("status")).toContainText("đủ 100%");
    await page
      .getByRole("button", { name: "Lưu công thức điểm", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu công thức điểm", { exact: true }),
    ).toBeVisible();

    await page.goto(syllabus.viewPath);
    await expect(
      page.getByRole("heading", { name: "Công thức điểm" }),
    ).toBeVisible();
    await expect(syllabusSection(page, "Phương pháp đánh giá")).toBeVisible();
    await expect(
      page.getByText("Giữa kỳ", { exact: true }).first(),
    ).toBeVisible();
  });

  test("F12-TC_002 Tổng tỷ trọng khác 100% giữ nút lưu tắt và nêu phần thiếu", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    await openFormulaTab(page, syllabus.editPath);
    await addComponent(page, 0, "GK", "Giữa kỳ", "40");
    await addComponent(page, 1, "CK", "Cuối kỳ", "50");
    await expect(page.getByRole("status")).toContainText("còn thiếu 10%");
    await expect(
      page.getByRole("button", { name: "Lưu công thức điểm", exact: true }),
    ).toBeDisabled();
  });

  test("F12-TC_003 Mã thành phần trùng bị chỉ ra ngay trên dòng", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    await openFormulaTab(page, syllabus.editPath);
    await addComponent(page, 0, "GK", "Giữa kỳ", "40");
    await addComponent(page, 1, "GK", "Cuối kỳ", "60");
    await expect(
      page.getByText("Mã thành phần bị trùng.").first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Lưu công thức điểm", exact: true })
      .click();
    await expect(
      page.getByText("Mã thành phần bị trùng.").first(),
    ).toBeVisible();
    await expect(
      page.getByText("Đã lưu công thức điểm", { exact: true }),
    ).toHaveCount(0);
  });

  test("F12-TC_004 Ánh xạ thành phần với CLO làm biến mất cảnh báo chưa được đánh giá", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    await createClo(page, syllabus);
    await openFormulaTab(page, syllabus.editPath);
    await addComponent(page, 0, "GK", "Giữa kỳ", "100");
    await page
      .getByRole("button", { name: "Lưu công thức điểm", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu công thức điểm", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("tab", { name: "Ánh xạ đánh giá–CLO", exact: true })
      .click();
    await expect(page.getByText("Chưa được đánh giá").first()).toBeVisible();
    await page
      .getByRole("checkbox", { name: "GK – CLO1", exact: true })
      .check();
    await page.getByRole("button", { name: "Lưu ánh xạ", exact: true }).click();
    await expect(
      page.getByText("Đã lưu ánh xạ đánh giá–CLO", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Chưa được đánh giá")).toHaveCount(0);
  });
});
