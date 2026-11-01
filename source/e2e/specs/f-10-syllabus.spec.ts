import { truncateSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { createCourse } from "../fixtures/courses.js";
import { chooseSegment, curriculumRow } from "../fixtures/curriculum.js";
import { chooseOption } from "../fixtures/select.js";
import {
  addWeek,
  attachmentRow,
  createAdminSyllabus,
  createSharedSyllabus,
  createSyllabus,
  expectSyllabusWriteDenied,
  fillRichText,
  pasteRichText,
  prepareWeek,
  saveSyllabusContent,
  signedPdf,
  syllabusSection,
  uploadAttachment,
  weeklyRow,
} from "../fixtures/syllabi.js";

test.describe("F-10 Đề cương", () => {
  test.use(asRole("R1"));

  test("F10-TC_001 Kiểm tra phạm vi đề cương chưa có công thức điểm", async ({
    page,
  }) => {
    const course = await createCourse(page);
    await page.goto(`${course.path}/syllabus`);
    await page
      .getByRole("button", { name: "Tạo đề cương", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Sửa đề cương — ${course.code} ${course.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Về trang đề cương", exact: true })
      .click();
    await expect(syllabusSection(page, "Mô tả học phần")).toBeVisible();
    await expect(syllabusSection(page, "Phương pháp đánh giá")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Công thức điểm/i }),
    ).toHaveCount(0);
  });
  test("F10-TC_002 Kiểm tra cùng đề cương từ hai chương trình", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const syllabus = await createSharedSyllabus(page);
    const text = `Mô tả dùng chung ${syllabus.course.code}`;
    await fillRichText(page, "Mô tả học phần", text);
    await saveSyllabusContent(page);
    for (const program of syllabus.programs) {
      await page.goto(program.curriculumPath);
      await curriculumRow(page, syllabus.course)
        .getByRole("link", { name: /Đề cương$/ })
        .click();
      await expect(syllabusSection(page, "Mô tả học phần")).toContainText(text);
      expect(new URL(page.url()).pathname).toBe(syllabus.viewPath);
    }
  });

  test("F10-TC_003 Kiểm tra các phần đã triển khai", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await page.goto(syllabus.viewPath);
    for (const title of [
      "Mô tả học phần",
      "Mục tiêu học phần",
      "Chuẩn đầu ra học phần (CLO)",
      "Nội dung theo tuần",
      "Phương pháp giảng dạy",
      "Phương pháp đánh giá",
      "Tài liệu tham khảo",
    ]) {
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
    }
  });

  test("F10-TC_004 Kiểm tra học phần chưa có đề cương", async ({ page }) => {
    const course = await createCourse(page);
    await page.getByRole("button", { name: /Đề cương$/ }).click();
    await expect(
      page.getByText("Học phần chưa có đề cương", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tạo đề cương", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`${course.path}/syllabus`);
  });

  test("F10-TC_005 Kiểm tra nội dung và in đậm được lưu", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await pasteRichText(
      page,
      "Mô tả học phần",
      "<p><strong>Mô tả in đậm</strong></p>",
    );
    const sections = [
      "Mục tiêu học phần",
      "Phương pháp giảng dạy",
      "Phương pháp đánh giá",
      "Tài liệu tham khảo",
    ];
    for (const title of sections)
      await fillRichText(page, title, `${title} có dấu`);
    await saveSyllabusContent(page);
    await page.goto(syllabus.viewPath);
    await expect(
      syllabusSection(page, "Mô tả học phần").locator("strong"),
    ).toHaveText("Mô tả in đậm");
    for (const title of sections)
      await expect(syllabusSection(page, title)).toContainText(
        `${title} có dấu`,
      );
  });

  test("F10-TC_006 Kiểm tra giữ danh sách", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await pasteRichText(
      page,
      "Mục tiêu học phần",
      "<ul><li><p>Phân tích</p></li><li><p>Thiết kế</p></li></ul>",
    );
    await saveSyllabusContent(page);
    await page.goto(syllabus.viewPath);
    await expect(
      syllabusSection(page, "Mục tiêu học phần").getByRole("listitem"),
    ).toHaveText(["Phân tích", "Thiết kế"]);
  });

  test("F10-TC_007 Kiểm tra giữ bảng", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await pasteRichText(
      page,
      "Tài liệu tham khảo",
      "<table><tbody><tr><td><p>Giáo trình thử nghiệm</p></td></tr></tbody></table>",
    );
    await saveSyllabusContent(page);
    await page.goto(syllabus.viewPath);
    await expect(
      syllabusSection(page, "Tài liệu tham khảo").getByRole("cell", {
        name: "Giáo trình thử nghiệm",
        exact: true,
      }),
    ).toBeVisible();
  });
  test("F10-TC_008 Kiểm tra thêm tuần và hoạt động", async ({ page }) => {
    await createSyllabus(page);
    await addWeek(page, "Tuần 1");
    await page.reload();
    await page
      .getByRole("tab", { name: "Nội dung theo tuần", exact: true })
      .click();
    await expect(weeklyRow(page, "Tuần 1")).toContainText("Nội dung Tuần 1");
    await expect(weeklyRow(page, "Tuần 1")).toContainText(
      "Thảo luận và thực hành",
    );
  });

  test("F10-TC_010 Kiểm tra thông báo chương trình dùng chung", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const syllabus = await createSharedSyllabus(page);
    await expect(
      page.getByText(
        "Đề cương này dùng chung cho các chương trình sau; thay đổi áp dụng cho tất cả:",
        { exact: true },
      ),
    ).toBeVisible();
    for (const program of syllabus.programs) {
      await expect(
        page
          .getByRole("listitem")
          .filter({ hasText: program.code })
          .getByRole("link", {
            name: `${program.code} — ${program.name}`,
            exact: true,
          }),
      ).toBeVisible();
    }
  });

  test("F10-TC_012 Kiểm tra lưu nội dung không chứa mã nhúng", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    await pasteRichText(
      page,
      "Mô tả học phần",
      "<p>Nội dung an toàn</p><script>alert(1)</script><iframe src=about:blank></iframe><p><a href=javascript:alert(1)>Liên kết</a></p>",
    );
    await expect(
      page.getByRole("textbox", { name: "Mô tả học phần", exact: true }),
    ).toContainText("Nội dung an toàn");
    await saveSyllabusContent(page);
    await page.goto(syllabus.viewPath);
    const section = syllabusSection(page, "Mô tả học phần");
    await expect(section).toContainText("Nội dung an toàn");
    await expect(
      section.locator(
        'script, iframe, [onerror], [onclick], a[href^="javascript:"]',
      ),
    ).toHaveCount(0);
    const response = await page.request.get(`/api${syllabus.viewPath}`);
    expect(response.status()).toBe(200);
    const html = (await response.json()).draft.courseDescription as string;
    expect(html).not.toMatch(/<script|<iframe|javascript:|onerror=|onclick=/i);
  });

  test("F10-TC_013 Kiểm tra mô tả hai ngôn ngữ", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await fillRichText(page, "Mô tả học phần", "Mô tả tiếng Việt");
    await fillRichText(
      page,
      "Mô tả học phần (tiếng Anh)",
      "English description",
    );
    await saveSyllabusContent(page);
    await page.goto(syllabus.viewPath);
    await chooseSegment(page, "English");
    await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
      "English description",
    );
    await chooseSegment(page, "Tiếng Việt");
    await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
      "Mô tả tiếng Việt",
    );
  });

  test("F10-TC_015 Kiểm tra không bắt buộc tiếng Anh", async ({ page }) => {
    await createSyllabus(page);
    await fillRichText(page, "Mô tả học phần", "Mô tả Việt có dấu");
    await saveSyllabusContent(page);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Mô tả học phần", exact: true }),
    ).toHaveText("Mô tả Việt có dấu");
    await expect(
      page.getByRole("textbox", {
        name: "Mô tả học phần (tiếng Anh)",
        exact: true,
      }),
    ).toBeEmpty();
  });

  test("F10-TC_016 Kiểm tra fallback chưa dịch", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await fillRichText(page, "Mô tả học phần", "Mô tả Việt có dấu");
    await saveSyllabusContent(page);
    await page.goto(syllabus.viewPath);
    await chooseSegment(page, "English");
    const section = syllabusSection(page, "Mô tả học phần");
    await expect(section).toContainText("Mô tả Việt có dấu");
    await expect(section.getByText("Chưa dịch", { exact: true })).toBeVisible();
  });
  test("F10-TC_017 Kiểm tra tải PDF tên tiếng Việt và metadata", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    const file = signedPdf(syllabus.course.code);
    await uploadAttachment(page, file);
    const response = await page.request.get(`/api${syllabus.viewPath}`);
    expect(response.status()).toBe(200);
    const attachment = (await response.json()).draft.attachments.find(
      (item: { fileName: string }) => item.fileName === file.name,
    );
    expect(attachment).toBeTruthy();
    const row = attachmentRow(page, file.name);
    await expect(row.getByText("PDF", { exact: true })).toBeVisible();
    await expect(row).toContainText(attachment.uploadedBy.fullName);
    await expect(row).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  });

  test("F10-TC_020 Kiểm tra tải ảnh PNG", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    const file = {
      name: `Bản ký ${syllabus.course.code}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
        "base64",
      ),
    };
    await uploadAttachment(page, file);
    await expect(
      attachmentRow(page, file.name).getByText("Ảnh", { exact: true }),
    ).toBeVisible();
  });

  test("F10-TC_022 Kiểm tra từ chối ZIP", async ({ page }) => {
    await createSyllabus(page);
    await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
    const hint = await page.getByText(/^Nhận tệp /).innerText();
    await chooseOption(
      page,
      page.getByRole("combobox", { name: "Loại tài liệu" }),
      "Tài liệu khác",
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "Không hợp lệ.zip",
      mimeType: "application/zip",
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    });
    await expect(
      page.getByText(`Không nhận tệp "Không hợp lệ.zip". ${hint}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(attachmentRow(page, "Không hợp lệ.zip")).toHaveCount(0);
  });

  test("F10-TC_023 Kiểm tra từ chối quá dung lượng", async ({ page }, testInfo) => {
    await createSyllabus(page);
    await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
    const hint = await page.getByText(/^Nhận tệp /).innerText();
    const matched = /tối đa (\d+(?:\.\d+)?) MB/.exec(hint);
    if (!matched) throw new Error("Không đọc được giới hạn tệp từ giao diện.");
    // Playwright caps in-memory uploads at 50 MB, the limit itself, so the oversize file goes through disk.
    const oversize = testInfo.outputPath("Quá dung lượng.pdf");
    writeFileSync(oversize, "%PDF-1.4");
    truncateSync(oversize, Number(matched[1]) * 1024 * 1024 + 1);
    await chooseOption(
      page,
      page.getByRole("combobox", { name: "Loại tài liệu" }),
      "Đề cương đã ký",
    );
    await page.locator('input[type="file"]').setInputFiles(oversize);
    await expect(
      page.getByText(`Không nhận tệp "Quá dung lượng.pdf". ${hint}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(attachmentRow(page, "Quá dung lượng.pdf")).toHaveCount(0);
  });

  test("F10-TC_024 Kiểm tra chữ ký tệp giả PDF", async ({ page }) => {
    await createSyllabus(page);
    await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
    await chooseOption(
      page,
      page.getByRole("combobox", { name: "Loại tài liệu" }),
      "Đề cương đã ký",
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "Giả PDF.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("MZ không phải PDF"),
    });
    await expect(
      page.getByText(
        "Chỉ nhận tệp PDF, Word (.docx), Excel (.xlsx) hoặc ảnh PNG/JPEG.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(attachmentRow(page, "Giả PDF.pdf")).toHaveCount(0);
  });

  test("F10-TC_025 Kiểm tra người tải gỡ tệp", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    const file = signedPdf(syllabus.course.code);
    await uploadAttachment(page, file);
    await attachmentRow(page, file.name)
      .getByRole("button", { name: `Gỡ tệp ${file.name}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Gỡ", exact: true }).click();
    await expect(attachmentRow(page, file.name)).toHaveCount(0);
    await page.reload();
    await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
    await expect(attachmentRow(page, file.name)).toHaveCount(0);
  });

  test("F10-TC_026 Kiểm tra tải xuống giữ tên tiếng Việt", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    const file = signedPdf(syllabus.course.code);
    await uploadAttachment(page, file);
    const downloaded = page.waitForEvent("download");
    await attachmentRow(page, file.name)
      .getByRole("button")
      .filter({ hasText: file.name })
      .click();
    expect((await downloaded).suggestedFilename()).toBe(file.name);
  });

  test("F10-TC_027 Kiểm tra danh sách tệp trống", async ({ page }) => {
    await createSyllabus(page);
    await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
    await expect(
      page.getByText("Chưa có tệp đính kèm", { exact: true }),
    ).toBeVisible();
  });

  test("F10-TC_028 Kiểm tra nội dung tuần trống", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await page.goto(syllabus.viewPath);
    await expect(
      syllabusSection(page, "Nội dung theo tuần").getByText(
        "Chưa có dòng nội dung theo tuần",
        { exact: true },
      ),
    ).toBeVisible();
  });
  test("F10-TC_029 Kiểm tra bắt buộc nhãn tuần", async ({ page }) => {
    await createSyllabus(page);
    const dialog = await prepareWeek(page);
    await fillRichText(dialog, "Nội dung", "Nội dung hợp lệ");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(
      dialog.getByText("Nhập nhãn tuần.", { exact: true }),
    ).toBeVisible();
  });

  test("F10-TC_030 Kiểm tra bắt buộc nội dung tuần", async ({ page }) => {
    await createSyllabus(page);
    const dialog = await prepareWeek(page);
    await dialog.getByLabel("Tuần", { exact: true }).fill("Tuần 1");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(
      dialog.getByText("Nội dung tuần không được để trống.", { exact: true }),
    ).toBeVisible();
  });

  test("F10-TC_037 Kiểm tra không tạo hai đề cương đầu tiên", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    const response = await page.request.post(`/api${syllabus.viewPath}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "Học phần đã có đề cương. Tải lại trang để xem bản hiện có.",
    });
  });

  test("F10-TC_038 Kiểm tra xóa dòng tuần", async ({ page }) => {
    await createSyllabus(page);
    await addWeek(page, "Tuần 1");
    await weeklyRow(page, "Tuần 1")
      .getByRole("button", { name: "Xóa", exact: true })
      .click();
    await page
      .locator(".ant-popconfirm:visible")
      .getByRole("button", { name: "Xóa", exact: true })
      .click();
    await expect(weeklyRow(page, "Tuần 1")).toHaveCount(0);
    await page.reload();
    await page
      .getByRole("tab", { name: "Nội dung theo tuần", exact: true })
      .click();
    await expect(weeklyRow(page, "Tuần 1")).toHaveCount(0);
  });

  test("F10-TC_039 Kiểm tra đổi thứ tự tuần bằng bàn phím", async ({
    page,
  }) => {
    const syllabus = await createSyllabus(page);
    await addWeek(page, "Tuần 1");
    await addWeek(page, "Tuần 2");
    const handle = weeklyRow(page, "Tuần 2").getByRole("button", {
      name: "Kéo để đổi thứ tự",
      exact: true,
    });
    await handle.focus();
    await handle.press("Space");
    await handle.press("ArrowUp");
    const saved = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/syllabi/${syllabus.syllabusId}/weekly-contents/order`) &&
        response.request().method() === "PUT" &&
        response.ok(),
    );
    await handle.press("Space");
    await saved;
    await page.reload();
    await page
      .getByRole("tab", { name: "Nội dung theo tuần", exact: true })
      .click();
    await expect(page.getByRole("cell", { name: /^Tuần [12]$/ })).toHaveText([
      "Tuần 2",
      "Tuần 1",
    ]);
  });

  test("F10-TC_055 Kiểm tra mục chưa có nội dung", async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await page.goto(syllabus.viewPath);
    await expect(
      syllabusSection(page, "Mục tiêu học phần").getByText("Chưa có nội dung", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("F10-TC_056 Kiểm tra lưu khi không thay đổi", async ({ page }) => {
    await createSyllabus(page);
    await page
      .getByRole("button", { name: "Lưu nội dung", exact: true })
      .click();
    await expect(
      page.getByText("Chưa có thay đổi để lưu.", { exact: true }),
    ).toBeVisible();
  });

  test.describe("R2", () => {
    test.use(asRole("R2"));
    test("F10-TC_040 Kiểm tra R2 không sửa nội dung", async ({
      page,
      browser,
    }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await page.goto(owned.viewPath);
        await expect(
          page.getByRole("button", { name: "Sửa đề cương", exact: true }),
        ).toHaveCount(0);
        await expectSyllabusWriteDenied(
          page,
          owned,
          "Bạn không có quyền thực hiện thao tác này.",
        );
      } finally {
        await owned.context.close();
      }
    });
  });

  test.describe("R3b", () => {
    test.use(asRole("R3b"));
    test("F10-TC_041 Kiểm tra R3 ngoài phạm vi", async ({ page, browser }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await expectSyllabusWriteDenied(
          page,
          owned,
          "Đối tượng này nằm ngoài phạm vi được phân công của bạn.",
        );
      } finally {
        await owned.context.close();
      }
    });
  });

  test.describe("R4b", () => {
    test.use(asRole("R4b"));
    test("F10-TC_042 Kiểm tra R4 ngoài nhóm", async ({ page, browser }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await expectSyllabusWriteDenied(
          page,
          owned,
          "Đối tượng này nằm ngoài phạm vi được phân công của bạn.",
        );
      } finally {
        await owned.context.close();
      }
    });
  });

  test.describe("R5b", () => {
    test.use(asRole("R5b"));
    test("F10-TC_011 Kiểm tra R5 ngoài nhóm", async ({ page, browser }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await page.goto(owned.viewPath);
        await expect(
          page.getByRole("button", { name: "Sửa đề cương", exact: true }),
        ).toHaveCount(0);
        await expectSyllabusWriteDenied(
          page,
          owned,
          "Đối tượng này nằm ngoài phạm vi được phân công của bạn.",
        );
      } finally {
        await owned.context.close();
      }
    });
  });
  test.describe("R5", () => {
    test.use(asRole("R5"));
    test("F10-TC_043 Kiểm tra R5 cùng nhóm sửa Nháp", async ({
      page,
      browser,
    }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await page.goto(owned.editPath);
        await fillRichText(
          page,
          "Mô tả học phần",
          `Mô tả R5 ${owned.course.code}`,
        );
        await saveSyllabusContent(page);
        await page.goto(owned.viewPath);
        await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
          `Mô tả R5 ${owned.course.code}`,
        );
      } finally {
        await owned.context.close();
      }
    });

    test("F10-TC_046 Kiểm tra không gỡ tệp của người khác", async ({
      page,
      browser,
    }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        const adminPage = await owned.context.newPage();
        await adminPage.goto(owned.editPath);
        const file = signedPdf(owned.course.code);
        await uploadAttachment(adminPage, file);
        const response = await owned.context.request.get(
          `/api${owned.viewPath}`,
        );
        expect(response.status()).toBe(200);
        const attachment = (await response.json()).draft.attachments.find(
          (item: { fileName: string }) => item.fileName === file.name,
        );
        expect(attachment).toBeTruthy();
        await page.goto(owned.editPath);
        await page
          .getByRole("tab", { name: "Tệp đính kèm", exact: true })
          .click();
        await expect(
          attachmentRow(page, file.name).getByRole("button", {
            name: `Gỡ tệp ${file.name}`,
            exact: true,
          }),
        ).toHaveCount(0);
        const denied = await page.request.delete(
          `/api/syllabus-attachments/${attachment.id}`,
          { headers: { "X-Requested-With": "XMLHttpRequest" } },
        );
        expect(denied.status()).toBe(403);
        expect(await denied.json()).toMatchObject({
          message: "Chỉ người đã tải tệp lên mới gỡ được tệp này.",
        });
        await page.reload();
        await page
          .getByRole("tab", { name: "Tệp đính kèm", exact: true })
          .click();
        await expect(attachmentRow(page, file.name)).toBeVisible();
      } finally {
        await owned.context.close();
      }
    });
  });

  test.describe("R4", () => {
    test.use(asRole("R4"));
    test("F10-TC_044 Kiểm tra R4 cùng nhóm sửa Nháp", async ({
      page,
      browser,
    }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await page.goto(owned.editPath);
        await fillRichText(
          page,
          "Mô tả học phần",
          `Mô tả R4 ${owned.course.code}`,
        );
        await saveSyllabusContent(page);
        await page.goto(owned.viewPath);
        await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
          `Mô tả R4 ${owned.course.code}`,
        );
      } finally {
        await owned.context.close();
      }
    });
  });

  test.describe("R6", () => {
    test.use(asRole("R6"));
    test("F10-TC_045 Kiểm tra R6 không thấy hoặc sửa Nháp", async ({
      page,
      browser,
    }) => {
      test.setTimeout(90_000);
      const owned = await createAdminSyllabus(browser);
      try {
        await page.goto(owned.viewPath);
        await expect(
          page.getByText("Học phần chưa có đề cương", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Tạo đề cương", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Sửa đề cương", exact: true }),
        ).toHaveCount(0);
        await expectSyllabusWriteDenied(
          page,
          owned,
          "Bạn không có quyền thực hiện thao tác này.",
        );
      } finally {
        await owned.context.close();
      }
    });
  });
});
