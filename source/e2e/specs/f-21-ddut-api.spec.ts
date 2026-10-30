import { expect, test } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { uniqueSuffix } from "../fixtures/unique.js";

test.describe("F-21 API dDUT", () => {
  test.use(asRole("R1"));

  test("F21-TC_001 R1 tạo bên tích hợp, nhận khóa một lần, gọi API rồi khóa", async ({
    page,
    playwright,
    baseURL,
  }) => {
    // "E2E" in the name lets the purge remove this client and its call records.
    const name = `E2E dDUT ${uniqueSuffix()}`;
    await page.goto("/integration-clients");
    await expect(
      page.getByRole("heading", { name: "Bên tích hợp dDUT" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Thêm bên tích hợp" }).click();
    const form = page.getByRole("dialog", { name: "Thêm bên tích hợp" });
    await form.getByLabel("Tên bên tích hợp").fill(name);
    await form.getByRole("button", { name: "Tạo và cấp khóa" }).click();
    const keyDialog = page.getByRole("dialog", { name: `Khóa API của ${name}` });
    await expect(keyDialog.getByText("Khóa chỉ hiển thị một lần")).toBeVisible();
    const apiKey = (await keyDialog.locator("code").innerText()).trim();
    expect(apiKey).toMatch(/^ddut_/);
    await keyDialog.getByRole("button", { name: "Tôi đã lưu khóa" }).click();
    await expect(page.getByText(apiKey)).toHaveCount(0);

    // A clean client with no cookie, as dDUT's server would call.
    const partner = await playwright.request.newContext({ baseURL });
    try {
      const unknown = await partner.get(
        "/api/v1/sinh-vien/KHONG-TON-TAI/chuong-trinh",
        { headers: { "X-Api-Key": apiKey } },
      );
      expect(unknown.status()).toBe(404);
      expect((await unknown.json()).code).toBe("API_STUDENT_NOT_FOUND");
      expect(unknown.headers()["set-cookie"]).toBeUndefined();

      const row = page.getByRole("row").filter({ hasText: name });
      await page.reload();
      await expect(row).not.toContainText("Chưa gọi");
      await row.getByRole("button", { name: "Khóa", exact: true }).click();
      await page
        .locator(".ant-popover")
        .getByRole("button", { name: "Khóa", exact: true })
        .click();
      await expect(row).toContainText("Đã khóa");
      const locked = await partner.get(
        "/api/v1/sinh-vien/KHONG-TON-TAI/chuong-trinh",
        { headers: { "X-Api-Key": apiKey } },
      );
      expect(locked.status()).toBe(401);
    } finally {
      await partner.dispose();
    }
  });
});

test.describe("F-21 Quyền", () => {
  test.use(asRole("R6"));

  test("F21-TC_002 Tài khoản không phải R1 không mở được trang bên tích hợp", async ({
    page,
  }) => {
    await page.goto("/integration-clients");
    await expect(
      page.getByRole("button", { name: "Thêm bên tích hợp" }),
    ).toHaveCount(0);
  });
});
