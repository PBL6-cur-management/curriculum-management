import { expect, test } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { curriculumRow } from "../fixtures/curriculum.js";
import { dryRunFile, exportedDraft, xlsxMime } from "../fixtures/imports.js";
import { chooseOption } from "../fixtures/select.js";
import { uniqueSuffix } from "../fixtures/unique.js";

test.describe("F-09 Nhập, xuất Excel", () => {
  test.use(asRole("R1"));

  test("F09-TC_001 Kiểm tra tải hai tệp mẫu được cấp quyền", async ({
    page,
  }) => {
    await page.goto("/imports");
    await expect(
      page.getByRole("heading", { name: "Nhập liệu Excel", exact: true }),
    ).toBeVisible();
    for (const [type, label] of [
      ["COURSE_CATALOG", "Danh mục học phần"],
      ["CURRICULUM", "Khung chương trình"],
    ]) {
      await chooseOption(
        page,
        page.getByLabel("Loại dữ liệu", { exact: true }),
        label,
      );
      await page.keyboard.press("Escape");
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Tải tệp mẫu", exact: true })
        .click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`${type}_mau.xlsx`);
      expect(await download.failure()).toBeNull();
    }
    await page.getByLabel("Loại dữ liệu", { exact: true }).click();
    await expect(
      page
        .locator(".ant-select-item-option-content")
        .filter({ hasText: "Danh sách sinh viên" }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".ant-select-item-option-content")
        .filter({ hasText: "Kết quả học tập" }),
    ).toHaveCount(0);
  });

  test("F09-TC_002 Kiểm tra xuất nhập lại, xác nhận và xem lịch sử tệp gốc", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const data = await exportedDraft(page);
    const before = await page.request.get(
      `/api/program-versions/${data.versionId}/curriculum`,
    );
    expect(before.ok()).toBe(true);
    const original = await before.json();
    await dryRunFile(page, data.file);
    await expect(
      page.getByRole("cell", { name: "LỖI", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Tổng: 1 · Hợp lệ: 1 · Lỗi: 0", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Xác nhận nhập", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Ghi 1 dòng vào ${data.program.code}`);
    await expect(dialog).toContainText("Ghi toàn bộ hoặc không ghi dòng nào.");
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Xác nhận nhập", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Ghi dữ liệu", exact: true })
      .click();
    await expect(page.getByText("Đã ghi", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeDisabled();
    const after = await page.request.get(
      `/api/program-versions/${data.versionId}/curriculum`,
    );
    expect(after.ok()).toBe(true);
    expect(
      (await after.json()).items.map((item: { id: string }) => item.id),
    ).toEqual(original.items.map((item: { id: string }) => item.id));
    await page
      .getByRole("main")
      .getByRole("link", { name: "Lịch sử nhập liệu", exact: true })
      .click();
    await page.getByRole("link", { name: data.file.name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Chi tiết lần nhập", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(data.file.name, { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Tải tệp gốc", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(data.file.name);
    expect(await download.failure()).toBeNull();
    await page.goto(data.program.curriculumPath);
    await expect(
      curriculumRow(page, data.course).getByText("ĐC / *", { exact: true }),
    ).toBeVisible();
  });

  test("F09-TC_003 Kiểm tra tệp mẫu loại khác bị từ chối ngay khi sai tiêu đề", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await exportedDraft(page);
    const response = await page.request.get(
      "/api/imports/templates/COURSE_CATALOG",
    );
    expect(response.ok()).toBe(true);
    await page.locator("input[type=file]").setInputFiles({
      name: `Sai-${uniqueSuffix()}.xlsx`,
      mimeType: xlsxMime,
      buffer: await response.body(),
    });
    const uploaded = page.waitForResponse(
      (entry) =>
        entry.url().endsWith("/api/imports") &&
        entry.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Chạy thử", exact: true }).click();
    const result = await uploaded;
    expect(result.status()).toBe(201);
    const batch = await result.json();
    expect(batch.status).toBe("ABORTED");
    expect(batch.report.formatErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ column: "Học kỳ" })]),
    );
    await expect(
      page.getByRole("main").getByText("Không ghi do lỗi", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("alert")
        .filter({ hasText: "Tệp không đúng định dạng" }),
    ).toContainText('Học kỳ: Thiếu cột "Học kỳ" hoặc tên cột không đúng mẫu.');
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeDisabled();
  });

  test("F09-TC_004 Kiểm tra chặn đuôi tệp sai và tệp lớn hơn 5 MB tại trình duyệt", async ({
    page,
  }) => {
    await page.goto("/imports");
    await expect(
      page.getByRole("button", { name: "Chọn tệp Excel", exact: true }),
    ).toBeVisible();
    const uploads: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/imports"))
        uploads.push(request.url());
    });
    await page.locator("input[type=file]").setInputFiles({
      name: `Sai-${uniqueSuffix()}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from("khong phai excel"),
    });
    await expect(
      page.getByText("Chỉ nhận tệp Excel (.xlsx).", { exact: true }),
    ).toBeVisible();
    await page.locator("input[type=file]").setInputFiles({
      name: `Lon-${uniqueSuffix()}.xlsx`,
      mimeType: xlsxMime,
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(
      page.getByText("Tệp Excel không được lớn hơn 5 MB.", { exact: true }),
    ).toBeVisible();
    expect(uploads).toEqual([]);
  });
});

test.describe("F-09 Không có quyền nhập", () => {
  test.use(asRole("R6"));
  test("F09-TC_005 Kiểm tra sinh viên không thấy menu và không mở được trang nhập", async ({
    page,
  }) => {
    await page.goto("/imports");
    await expect(
      page.getByText("Bạn không có quyền truy cập trang này", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nhập liệu", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Chạy thử", exact: true }),
    ).toHaveCount(0);
    const response = await page.request.get("/api/imports/types");
    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe("PERMISSION_DENIED");
  });
});
