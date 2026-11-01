import { expect, test } from "@playwright/test";
import { asRole } from "../fixtures/accounts.js";
import { createElectiveGroup } from "../fixtures/curriculum.js";
import {
  buildAdminReleaseProgram,
  buildReleaseProgram,
  fixtureApi,
  prepareSyllabusAssessment,
  seedRequest,
  withRequestRole,
  type RequestRecord,
} from "../fixtures/change-requests.js";
import {
  additionalReleaseCourse,
  attachPublishedFile,
  confirmFinalRelease,
  confirmInitialRelease,
  fillReleaseDecision,
  finalRequest,
  issueCorrection,
  openCorrection,
  openFinalApproval,
  prepareApprovedRelease,
  versionPath,
} from "../fixtures/release-versions.js";
import { attachmentRow, signedPdf } from "../fixtures/syllabi.js";
import { uniqueSuffix } from "../fixtures/unique.js";

test.describe("F-15 Ban hành phiên bản", () => {
  test.describe("R1 xem trước ban hành", () => {
    test.use(asRole("R1"));

    test("F15-TC_001 Vấn đề đề cương phải được diễn đạt tiếng Việt", async ({
      page,
      browser,
    }) => {
      const program = await buildReleaseProgram(page);
      const course = await additionalReleaseCourse(page, program);
      const code = course.code;
      const syllabusPath = `/courses/${course.id}/syllabus`;
      const syllabus = await fixtureApi<{ draft: { id: string } }>(
        page,
        "POST",
        syllabusPath,
      );
      await prepareSyllabusAssessment(page, {
        course: {
          code,
          name: `Học phần thử ${code}`,
          path: `/courses/${course.id}`,
        },
        viewPath: syllabusPath,
        editPath: `${syllabusPath}/edit`,
        syllabusId: syllabus.draft.id,
      });
      const request = await withRequestRole(browser, "R3", async (creator) => {
        const owned = await fixtureApi<RequestRecord>(
          creator,
          "POST",
          "/change-requests",
          {
            requestType: "CURRICULUM",
            targetType: "PROGRAM",
            targetId: program.id,
            title: `Đề xuất ${uniqueSuffix()}`,
            reason: "Bổ sung học phần riêng để kiểm tra nội dung xem trước.",
            origin: "FACULTY",
          },
        );
        if (!owned.workspace)
          throw new Error("Đề xuất khung không có bản sao.");
        await fixtureApi(
          creator,
          "POST",
          `/program-versions/${owned.workspace.copyId}/curriculum-items`,
          {
            courseId: course.id,
            plannedSemester: 2,
            isElective: false,
          },
        );
        await fixtureApi(
          creator,
          "PATCH",
          `/program-versions/${owned.workspace.copyId}/info`,
          {
            totalCredits: "5",
            compulsoryCredits: "5",
            electiveCredits: "0",
          },
        );
        await fixtureApi(
          creator,
          "POST",
          `/change-requests/${owned.id}/submit`,
        );
        return owned;
      });
      await withRequestRole(browser, "R4", (reviewer) =>
        fixtureApi(reviewer, "POST", `/change-requests/${request.id}/approve`),
      );
      await page.goto(`/change-requests/${request.id}/final-approval`);
      await expect(
        page.getByRole("heading", {
          name: "Phê duyệt cuối và ban hành",
          exact: true,
        }),
      ).toBeVisible();
      const row = page.getByRole("row").filter({
        has: page.getByRole("cell", { name: program.code, exact: true }),
      });
      await expect(row).toContainText(code);
      await expect(row).toContainText("Đề cương chưa đủ điều kiện ban hành");
    });
  });

  test.describe("R1 ban hành khởi tạo", () => {
    test.use(asRole("R1"));

    test("F15-TC_002 Ban hành 1.0 vào học kỳ đã bắt đầu", async ({ page }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByLabel("Số phiên bản", { exact: true }),
      ).toHaveValue("1.0");
      const { decision } = await fillReleaseDecision(page, true);
      await confirmInitialRelease(page);
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        "phiên bản 1.0",
      );
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        "Đang hiệu lực",
      );
      await expect(page.locator(".ant-descriptions")).toContainText(decision);
    });

    test("F15-TC_003 Học kỳ tương lai tạo bản Chờ hiệu lực", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await fillReleaseDecision(page);
      await confirmInitialRelease(page);
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        "Chờ hiệu lực",
      );
    });

    test("F15-TC_004 Số quyết định bắt buộc", async ({ page }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await fillReleaseDecision(page);
      await page.getByLabel("Số quyết định", { exact: true }).fill("   ");
      await page.getByRole("button", { name: /Ban hành$/ }).click();
      await expect(
        page.getByText("Nhập số quyết định.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    test("F15-TC_005 Ngày ký bắt buộc", async ({ page }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await page.getByRole("button", { name: /Ban hành$/ }).click();
      await expect(
        page.getByText("Chọn ngày ký.", { exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_006 Học kỳ hiệu lực bắt buộc", async ({ page }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByLabel("Học kỳ hiệu lực", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Ban hành$/ }).click();
      await expect(
        page.getByText("Chọn học kỳ hiệu lực.", { exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_007 Số phiên bản sai định dạng", async ({ page }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await page.getByLabel("Số phiên bản", { exact: true }).fill("1.1000");
      await page.getByRole("button", { name: /Ban hành$/ }).click();
      await expect(
        page.getByText("Số phiên bản có dạng Chính.Phụ, ví dụ 1.0.", {
          exact: true,
        }),
      ).toBeVisible();
    });

    test("F15-TC_008 Thiếu đề cương chặn ban hành", async ({ page }) => {
      const program = await buildReleaseProgram(page, false);
      const course = await additionalReleaseCourse(page, program);
      await fixtureApi(
        page,
        "POST",
        `/program-versions/${program.versionId}/curriculum-items`,
        {
          courseId: course.id,
          plannedSemester: 2,
          isElective: false,
        },
      );
      await fixtureApi(
        page,
        "PATCH",
        `/program-versions/${program.versionId}/info`,
        { totalCredits: "5", compulsoryCredits: "5" },
      );
      await page.goto(program.releasePath);
      const issue = page
        .getByRole("listitem")
        .filter({ hasText: course.code })
        .filter({ hasText: "Chưa có đề cương" });
      await expect(issue).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Ban hành$/ }),
      ).toBeDisabled();
    });

    test("F15-TC_009 Nhóm tự chọn không đủ tối thiểu chặn ban hành", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page, false);
      const group = await createElectiveGroup(
        page,
        program.curriculumPath,
        "1",
      );
      await page.goto(program.releasePath);
      await expect(
        page.getByRole("listitem").filter({
          hasText: `Nhóm ${group.code} yêu cầu tối thiểu 1 tín chỉ, nhưng các học phần trong nhóm chỉ có 0 tín chỉ (0 học phần).`,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Còn lỗi: chưa ban hành được. Sửa các mục dưới đây rồi kiểm tra lại.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Ban hành$/ }),
      ).toBeDisabled();
    });

    test("F15-TC_010 Không ban hành khởi tạo lần hai", async ({ page }) => {
      const program = await buildReleaseProgram(page);
      await page.goto(program.releasePath);
      await expect(
        page.getByText(
          "Không có bản nháp để ban hành (chương trình đã có phiên bản ban hành, hoặc không tìm thấy).",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Ban hành$/ }),
      ).not.toBeVisible();
    });

    test("F15-TC_011 Ban hành khởi tạo công bố đề cương Nháp", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await fillReleaseDecision(page, true);
      await confirmInitialRelease(page);
      const row = page
        .getByRole("row")
        .filter({ hasText: program.course.code });
      await expect(
        row.getByRole("link", { name: "Bản 1 (đang ban hành)", exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_014 Chấp nhận số phiên bản tự chọn ở biên ba chữ số", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page, false);
      await page.goto(program.releasePath);
      await page.getByLabel("Số phiên bản", { exact: true }).fill("999.999");
      await fillReleaseDecision(page, true);
      await confirmInitialRelease(page);
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        "phiên bản 999.999",
      );
    });
  });

  test.describe("R1 phê duyệt cuối", () => {
    test.use(asRole("R1"));

    test("F15-TC_012 Thiếu số quyết định chặn phê duyệt cuối", async ({
      page,
      browser,
    }) => {
      const { request } = await finalRequest(browser);
      await openFinalApproval(page, request);
      await page.getByRole("button", { name: /Phê duyệt cuối$/ }).click();
      await expect(
        page.getByText("Nhập số quyết định.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    test("F15-TC_013 Duyệt đề cương tạo phiên bản phụ Chờ hiệu lực", async ({
      page,
      browser,
    }) => {
      const { program, request } = await finalRequest(browser);
      await openFinalApproval(page, request);
      await fillReleaseDecision(page);
      await confirmFinalRelease(page);
      await expect(
        page.getByText("Đã phê duyệt cuối.", { exact: true }),
      ).toBeVisible();
      await page.goto(`${program.path}/versions`);
      const row = page
        .getByRole("row")
        .filter({ has: page.getByRole("link", { name: "1.1", exact: true }) });
      await expect(row).toContainText("Chờ hiệu lực");
      await expect(row).toContainText(request.requestCode);
    });

    test("F15-TC_015 Đề xuất không do R1 tạo bị chặn học kỳ đã bắt đầu", async ({
      page,
      browser,
    }) => {
      const { request } = await finalRequest(browser);
      await openFinalApproval(page, request);
      await expect(
        page.getByRole("checkbox", {
          name: "Cho phép ban hành vào học kỳ đã bắt đầu",
        }),
      ).not.toBeVisible();
      await fillReleaseDecision(page, true);
      await confirmFinalRelease(page);
      await expect(
        page.getByText(
          "Học kỳ đã bắt đầu; chỉ đề xuất do Phòng Đào tạo tạo mới được ban hành vào học kỳ đã qua.",
          { exact: true },
        ),
      ).toBeVisible();
    });

    test("F15-TC_016 Phiên bản tương lai không thay bản đang áp dụng", async ({
      page,
      browser,
    }) => {
      const { program, request } = await prepareApprovedRelease(page, browser);
      await page.goto(program.path);
      // The program workspace (PR #35): level-3 program heading, sections as tabs.
      await expect(
        page.getByRole("heading", { level: 3 }).first(),
      ).toContainText(program.name);
      await page
        .getByRole("navigation", { name: "Các mục của chương trình", exact: true })
        .getByRole("tab", { name: "Khung chương trình", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/versions/${program.versionId}/curriculum$`),
      );
      await page.goto(`/change-requests/${request.id}`);
      await expect(
        page.getByText("Đã phê duyệt", { exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_026 Phiên bản cũ giữ ghim đề cương trước khi duyệt bản mới", async ({
      page,
      browser,
    }) => {
      const { program, versionId } = await prepareApprovedRelease(
        page,
        browser,
      );
      await page.goto(versionPath(program));
      const oldRow = page
        .getByRole("row")
        .filter({ hasText: program.course.code });
      const oldLink = oldRow.getByRole("link", {
        name: "Bản 1 (đã thay bằng bản mới)",
        exact: true,
      });
      await expect(oldLink).toHaveAttribute(
        "href",
        `${program.course.path}/syllabus?versionId=${program.versionId}`,
      );
      await oldLink.click();
      await expect(
        page.getByText(`Mô tả ${program.course.code}`, { exact: true }),
      ).toBeVisible();
      await page.goto(versionPath(program, versionId));
      await expect(
        page
          .getByRole("row")
          .filter({ hasText: program.course.code })
          .getByRole("link", { name: "Bản 2 (đang ban hành)", exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_028 Phiên bản dẫn tới đề xuất và lịch sử phê duyệt nguồn", async ({
      page,
      browser,
    }) => {
      const { program, request, versionId } = await prepareApprovedRelease(
        page,
        browser,
      );
      await page.goto(versionPath(program, versionId));
      await page
        .locator(".ant-descriptions")
        .getByRole("link", { name: request.requestCode, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/change-requests/${request.id}$`),
      );
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        request.requestCode,
      );
      await expect(
        page.getByText("Lịch sử phê duyệt", { exact: true }),
      ).toBeVisible();
    });
  });

  test.describe("R1 đính chính và lịch sử", () => {
    test.use(asRole("R1"));

    test("F15-TC_017 Ban hành đính chính tăng số phụ và ghi bản gốc", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      await openCorrection(page, program);
      const correctionPath = new URL(page.url()).pathname;
      await page
        .getByRole("link", { name: "Thông tin chương trình", exact: true })
        .click();
      await page
        .getByLabel("Tên chương trình", { exact: true })
        .fill(`Đính chính ${program.code}`);
      await page.getByRole("button", { name: /Lưu$/ }).click();
      await expect(page).toHaveURL(new RegExp(`/programs/${program.id}$`));
      await page.goto(correctionPath);
      await issueCorrection(page);
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        "phiên bản 1.1",
      );
      const header = page.locator(".ant-descriptions");
      await expect(header).toContainText("Đính chính cho");
      const correction = header
        .locator(".ant-descriptions-item")
        .filter({ has: page.getByText("Đính chính cho", { exact: true }) });
      await expect(
        correction.getByRole("link", { name: "1.0", exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_018 Bản bị đính chính vẫn mở được ở Lịch sử", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      await openCorrection(page, program);
      await issueCorrection(page);
      await page.goto(versionPath(program));
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        "Lịch sử",
      );
      await expect(page.locator(".ant-descriptions")).toContainText(
        "Đã được đính chính bởi",
      );
      await expect(
        page
          .locator(".ant-descriptions")
          .getByRole("link", { name: "1.1", exact: true }),
      ).toBeVisible();
    });

    test("F15-TC_019 Đính chính yêu cầu lý do không chỉ khoảng trắng", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      await openCorrection(page, program);
      await page.getByLabel("Lý do đính chính", { exact: true }).fill("   ");
      await page.getByRole("button", { name: /Ban hành đính chính$/ }).click();
      await expect(
        page.getByText("Nhập lý do đính chính.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    test("F15-TC_020 R1 không có thao tác xóa phiên bản đã ban hành", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      await page.goto(versionPath(program));
      await expect(page.getByRole("heading", { level: 2 })).toContainText(
        program.code,
      );
      await expect(page.getByRole("button", { name: /Xóa/ })).not.toBeVisible();
    });

    test("F15-TC_021 Chuyển khóa khi đính chính mặc định được chọn", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      await openCorrection(page, program);
      await expect(
        page.getByRole("checkbox", {
          name: "Chuyển các khóa đang áp dụng sang bản đính chính",
          exact: true,
        }),
      ).toBeChecked();
    });

    test("F15-TC_027 Lịch sử liệt kê ba phiên bản của chương trình riêng", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      let originalId = program.versionId;
      for (const name of [
        `Lần một ${program.code}`,
        `Lần hai ${program.code}`,
      ]) {
        const correction = await fixtureApi<{ id: string }>(
          page,
          "POST",
          `${versionPath(program, originalId)}/corrections`,
        );
        await fixtureApi(
          page,
          "PATCH",
          `/program-versions/${correction.id}/info`,
          { programName: name },
        );
        const issued = await fixtureApi<{ id: string }>(
          page,
          "POST",
          `${versionPath(program, originalId)}/corrections/${correction.id}/issue`,
          {
            reason: "Chuẩn bị lịch sử riêng để kiểm tra giao diện.",
            moveCohorts: false,
          },
        );
        originalId = issued.id;
      }
      await page.goto(`${program.path}/versions`);
      await expect(
        page.getByRole("heading", { name: "Lịch sử phiên bản", exact: true }),
      ).toBeVisible();
      for (const number of ["1.0", "1.1", "1.2"]) {
        const row = page.getByRole("row").filter({
          has: page.getByRole("link", { name: number, exact: true }),
        });
        await expect(row).toContainText(`QĐ-${program.code}`);
        await expect(row).toContainText(program.semester.semesterCode);
      }
    });

    test("F15-TC_022 Thêm bản quét ký vào đề cương đã ban hành", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      const file = signedPdf(uniqueSuffix());
      await attachPublishedFile(page, program, file);
      await page.reload();
      await expect(attachmentRow(page, file.name)).toBeVisible();
    });

    test("F15-TC_023 Không có thao tác gỡ tệp của bản đã ban hành", async ({
      page,
    }) => {
      const program = await buildReleaseProgram(page);
      const file = signedPdf(uniqueSuffix());
      await attachPublishedFile(page, program, file);
      await expect(
        attachmentRow(page, file.name).getByRole("button", { name: /Gỡ tệp/ }),
      ).not.toBeVisible();
    });

    test("F15-TC_024 Bản sao đề cương mới không kế thừa tệp ký", async ({
      page,
      browser,
    }) => {
      const program = await buildReleaseProgram(page);
      const file = signedPdf(uniqueSuffix());
      await attachPublishedFile(page, program, file);
      await withRequestRole(browser, "R5", async (creator) => {
        const request = await seedRequest(creator, program);
        await creator.goto(
          `${program.course.path}/syllabus?requestId=${request.id}`,
        );
        await creator
          .getByRole("tab", { name: "Bản nháp của đề xuất", exact: true })
          .click();
        const panel = creator.getByRole("tabpanel", {
          name: "Bản nháp của đề xuất",
          exact: true,
        });
        await expect(
          panel.getByText("Chưa có tệp đính kèm", { exact: true }),
        ).toBeVisible();
        await expect(attachmentRow(creator, file.name)).not.toBeVisible();
      });
    });
  });

  test.describe("R2 không ban hành", () => {
    test.use(asRole("R2"));
    test("F15-TC_029 Lãnh đạo khoa không được ban hành", async ({
      page,
      browser,
    }) => {
      const program = await buildAdminReleaseProgram(browser, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByText("Bạn không có quyền truy cập trang này", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });

  test.describe("R3 không ban hành", () => {
    test.use(asRole("R3"));
    test("F15-TC_030 Giám đốc của chương trình không được ban hành", async ({
      page,
      browser,
    }) => {
      const program = await buildAdminReleaseProgram(browser, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByText("Bạn không có quyền truy cập trang này", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });

  test.describe("R3b ngoài chương trình không ban hành", () => {
    test.use(asRole("R3b"));
    test("F15-TC_031 Giám đốc không được phân công bị từ chối", async ({
      page,
      browser,
    }) => {
      const program = await buildAdminReleaseProgram(browser, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByText("Bạn không có quyền truy cập trang này", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });

  test.describe("R4b ngoài nhóm không ban hành", () => {
    test.use(asRole("R4b"));
    test("F15-TC_032 Điều phối CNPM không ban hành chương trình KHMT", async ({
      page,
      browser,
    }) => {
      const program = await buildAdminReleaseProgram(browser, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByText("Bạn không có quyền truy cập trang này", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });

  test.describe("R5b ngoài nhóm không ban hành", () => {
    test.use(asRole("R5b"));
    test("F15-TC_033 Giảng viên CNPM không được ban hành", async ({
      page,
      browser,
    }) => {
      const program = await buildAdminReleaseProgram(browser, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByText("Bạn không có quyền truy cập trang này", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });

  test.describe("R6 không ban hành", () => {
    test.use(asRole("R6"));
    test("F15-TC_034 Sinh viên không được ban hành", async ({
      page,
      browser,
    }) => {
      const program = await buildAdminReleaseProgram(browser, false);
      await page.goto(program.releasePath);
      await expect(
        page.getByText("Bạn không có quyền truy cập trang này", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });
});
