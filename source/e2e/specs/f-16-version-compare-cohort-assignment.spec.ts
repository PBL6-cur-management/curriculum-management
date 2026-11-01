import { expect, test } from "@playwright/test";
import type { components } from "../../frontend/src/shared/api/schema.js";
import { asRole } from "../fixtures/accounts.js";
import { fixtureApi, withRequestRole } from "../fixtures/change-requests.js";
import {
  assignComparisonCohorts,
  buildComparisonProgram,
  comparisonCohort,
  scheduleFor,
  selectComparisonOption,
} from "../fixtures/version-comparison.js";
import { uniqueSuffix } from "../fixtures/unique.js";

type Schemas = components["schemas"];
test.describe("F-16 Giới hạn quyền sinh viên", () => {
  test.use(asRole("R6"));
  test("F16-TC_015 R6 không mở hoặc gọi API so sánh và gán khóa", async ({
    page,
    browser,
  }) => {
    const data = await withRequestRole(browser, "R1", (admin) =>
      buildComparisonProgram(admin, browser),
    );
    for (const path of [
      `${data.program.path}/version-comparison?${data.pair}`,
      `${data.program.path}/cohort-versions`,
    ]) {
      await page.goto(path);
      // The program workspace (PR #35) refuses the whole program before the page renders.
      await expect(page.getByRole("main")).toContainText(
        "Bạn không có quyền xem chương trình này",
      );
    }
    for (const path of [
      `${data.program.path}/version-comparison?${data.pair}`,
      `${data.program.path}/cohort-versions`,
    ]) {
      expect((await page.request.get(`/api${path}`)).status()).toBe(403);
    }
    const response = await page.request.post(
      `/api${data.program.path}/cohort-versions`,
      {
        data: {
          cohortIds: [],
          programVersionId: data.after.id,
          fromSemesterId: data.semester.id,
          expectedRevision: "0".repeat(64),
        },
        headers: { "X-Requested-With": "XMLHttpRequest" },
      },
    );
    expect(response.status()).toBe(403);
  });
});
test.describe("F-16 So sánh và gán phiên bản", () => {
  test("F16-TC_014 Revision cũ giữ lựa chọn và buộc nạp lại, xác nhận lại", async ({
    page,
    browser,
  }) => {
    const data = await buildComparisonProgram(page, browser);
    const target = await comparisonCohort(page, "TARGET");
    const concurrent = await comparisonCohort(page, "OTHER");
    await page.goto(`${data.program.path}/cohort-versions`);
    await page
      .getByRole("main")
      .getByRole("button", { name: "Gán phiên bản", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "Gán phiên bản",
      exact: true,
    });
    await selectComparisonOption(
      page,
      form.getByLabel("Phiên bản ban hành", { exact: true }),
      `${data.after.versionNumber} · ${data.after.decisionNumber}`,
    );
    await selectComparisonOption(
      page,
      form.getByLabel("Các khóa được chọn", { exact: true }),
      `${target.cohortCode} (tuyển sinh 2026)`,
    );
    await selectComparisonOption(
      page,
      form.getByLabel("Từ học kỳ", { exact: true }),
      `${data.semester.semesterCode} · ${data.semester.startDate}`,
    );
    await form
      .getByRole("button", { name: "Tiếp tục xác nhận", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "Xác nhận gán phiên bản",
      exact: true,
    });
    await expect(confirm).toBeVisible();
    await assignComparisonCohorts(
      page,
      data.program.id,
      data.after.id,
      data.semester.id,
      [concurrent.id],
    );
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api${data.program.path}/cohort-versions`,
    );
    await confirm
      .getByRole("button", { name: "Xác nhận gán phiên bản", exact: true })
      .click();
    expect((await rejected).status()).toBe(409);
    await expect(confirm).not.toBeVisible();
    // AntD keeps the hidden loading icon inside the disabled button, so its name reads "loading Tiếp tục xác nhận".
    await expect(
      form.getByRole("button", { name: /Tiếp tục xác nhận$/ }),
    ).toBeDisabled();
    await expect(form).toContainText(target.cohortCode);
    expect(
      (await scheduleFor(page, data.program.id)).assignments.some(
        (row) => row.cohort.id === target.id,
      ),
    ).toBe(false);
    await form
      .getByRole("button", { name: "Nạp lại dữ liệu", exact: true })
      .click();
    await expect(
      form.getByRole("button", { name: /Tiếp tục xác nhận$/ }),
    ).toBeEnabled();
    await form
      .getByRole("button", { name: /Tiếp tục xác nhận$/ })
      .click();
    await confirm
      .getByRole("button", { name: "Xác nhận gán phiên bản", exact: true })
      .click();
    await expect(form).not.toBeVisible();
    const schedule = await scheduleFor(page, data.program.id);
    for (const cohort of [target, concurrent])
      expect(
        schedule.assignments.some(
          (row) =>
            row.cohort.id === cohort.id && row.version.id === data.after.id,
        ),
      ).toBe(true);
  });
  test.use(asRole("R1"));
  test("F16-TC_001 So sánh không liền kề, mở hai pin và quay lại đúng cặp", async ({
    page,
    browser,
  }) => {
    const data = await buildComparisonProgram(page, browser);
    await page.goto(`${data.program.path}/versions`);
    const main = page.getByRole("main");
    await main.getByLabel("Chọn phiên bản 1.0", { exact: true }).check();
    await main
      .getByLabel(`Chọn phiên bản ${data.after.versionNumber}`, { exact: true })
      .check();
    await main
      .getByRole("button", { name: "So sánh hai phiên bản", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/version-comparison\\?${data.pair}$`),
    );
    for (const section of data.comparison.sections)
      // Sections are collapse headers; "Khung chương trình" is also a workspace tab.
      await expect(
        main.getByRole("button", { name: section.title, exact: true }),
      ).toBeVisible();
    await main
      .getByRole("link", { name: "Xem khác biệt đề cương", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/syllabi/${data.program.course.id}\\?${data.pair}$`),
    );
    await expect(
      main.getByRole("heading", {
        name: "Khác biệt đề cương đã ghim",
        exact: true,
      }),
    ).toBeVisible();
    await expect(main.getByText(/Bản trước: đề cương lần/)).toContainText(
      "Bản sau: đề cương lần",
    );
    await main
      .getByRole("link", { name: "So sánh phiên bản", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/version-comparison\\?${data.pair}$`),
    );
    await main
      .getByRole("button", { name: "Đổi chiều so sánh", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `beforeVersionId=${data.after.id}&afterVersionId=${data.beforeVersionId}$`,
      ),
    );
  });
  test("F16-TC_004 Xem lịch sử chỉ đọc và mở nhóm tự chọn, đề cương đúng version", async ({
    page,
    browser,
  }) => {
    const data = await buildComparisonProgram(page, browser);
    await page.goto(`${data.program.path}/versions/${data.beforeVersionId}`);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: "Nhóm tự chọn", exact: true }),
    ).toHaveAttribute(
      "href",
      `${data.program.path}/versions/${data.beforeVersionId}/elective-groups`,
    );
    await expect(main.getByRole("link", { name: /Bản 1/ })).toHaveAttribute(
      "href",
      `/courses/${data.program.course.id}/syllabus?versionId=${data.beforeVersionId}`,
    );
    await expect(
      main.getByRole("button", { name: "Lưu", exact: true }),
    ).toHaveCount(0);
    await expect(
      main.getByRole("button", { name: "Sửa thông tin", exact: true }),
    ).toHaveCount(0);
    await page.goto(
      `${data.program.path}/version-comparison?beforeVersionId=${data.beforeVersionId}&afterVersionId=${data.beforeVersionId}`,
    );
    await expect(main.getByText("Không thay đổi", { exact: true })).toHaveCount(
      6,
    );
  });
  test("F16-TC_008 Gán batch tường minh, giữ khóa khác và sửa riêng học kỳ áp dụng", async ({
    page,
    browser,
  }) => {
    const data = await buildComparisonProgram(page, browser);
    const old = await comparisonCohort(page, "OLD");
    const keep = await comparisonCohort(page, "KEEP");
    const fresh = await comparisonCohort(page, "NEW");
    await assignComparisonCohorts(
      page,
      data.program.id,
      data.beforeVersionId,
      data.program.semester.id,
      [old.id, keep.id],
    );
    await page.goto(`${data.program.path}/cohort-versions`);
    const main = page.getByRole("main");
    await main
      .getByRole("button", { name: "Gán phiên bản", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "Gán phiên bản",
      exact: true,
    });
    await selectComparisonOption(
      page,
      form.getByLabel("Phiên bản ban hành", { exact: true }),
      `${data.after.versionNumber} · ${data.after.decisionNumber}`,
    );
    for (const cohort of [old, fresh])
      await selectComparisonOption(
        page,
        form.getByLabel("Các khóa được chọn", { exact: true }),
        `${cohort.cohortCode} (tuyển sinh 2026)`,
      );
    await selectComparisonOption(
      page,
      form.getByLabel("Từ học kỳ", { exact: true }),
      `${data.semester.semesterCode} · ${data.semester.startDate}`,
    );
    await form
      .getByRole("button", { name: "Tiếp tục xác nhận", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "Xác nhận gán phiên bản",
      exact: true,
    });
    await expect(confirm).toContainText(old.cohortCode);
    await expect(confirm).toContainText(fresh.cohortCode);
    await expect(confirm).not.toContainText(keep.cohortCode);
    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api${data.program.path}/cohort-versions`,
    );
    await confirm
      .getByRole("button", { name: "Xác nhận gán phiên bản", exact: true })
      .click();
    const response = await posted;
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.request().postDataJSON().cohortIds.sort()).toEqual(
      [old.id, fresh.id].sort(),
    );
    await expect(form).not.toBeVisible();
    const schedule = await scheduleFor(page, data.program.id);
    expect(
      schedule.assignments
        .filter((row) => row.cohort.id === keep.id)
        .map((row) => row.version.id),
    ).toEqual([data.beforeVersionId]);
    for (const [cohort, semesterId, expectedVersionId] of [
      [old, data.program.semester.id, data.beforeVersionId],
      [old, data.semester.id, data.after.id],
      [keep, data.semester.id, data.beforeVersionId],
    ] as const) {
      const result = await fixtureApi<Schemas["AppliedCohortVersionDto"]>(
        page,
        "GET",
        `${data.program.path}/cohorts/${cohort.id}/applied-version?semesterId=${semesterId}`,
      );
      expect(result.assignment?.version.id).toBe(expectedVersionId);
    }
    await selectComparisonOption(
      page,
      main.getByLabel("Khóa tra cứu", { exact: true }),
      old.cohortCode,
    );
    await selectComparisonOption(
      page,
      main.getByLabel("Học kỳ tra cứu", { exact: true }),
      `${data.semester.semesterCode} · ${data.semester.startDate}`,
    );
    const panel = main
      .locator(".ant-card")
      .filter({ hasText: "Tra cứu phiên bản theo học kỳ" });
    await expect(
      panel.getByRole("link", { name: data.after.versionNumber!, exact: true }),
    ).toBeVisible();
    const suffix = uniqueSuffix();
    const later = await fixtureApi<Schemas["SemesterDto"]>(
      page,
      "POST",
      "/semesters",
      {
        semesterCode: `F16-${suffix}`,
        academicYear: `F16-${suffix}`,
        termInYear: 1,
        startDate: new Date(
          Date.parse(`${data.semester.startDate}T00:00:00Z`) + 86_400_000,
        )
          .toISOString()
          .slice(0, 10),
      },
    );
    await page.reload();
    const row = main
      .getByRole("row")
      .filter({ hasText: old.cohortCode })
      .filter({
        has: page.locator(
          `a[href='${data.program.path}/versions/${data.after.id}']`,
        ),
      });
    await row
      .getByRole("button", { name: "Sửa học kỳ áp dụng", exact: true })
      .click();
    const edit = page.getByRole("dialog", {
      name: "Sửa học kỳ áp dụng",
      exact: true,
    });
    await selectComparisonOption(
      page,
      edit.getByLabel("Từ học kỳ", { exact: true }),
      `${later.semesterCode} · ${later.startDate}`,
    );
    await edit
      .getByRole("button", { name: "Tiếp tục xác nhận", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Xác nhận sửa học kỳ áp dụng", exact: true })
      .getByRole("button", { name: "Xác nhận sửa học kỳ áp dụng", exact: true })
      .click();
    await expect(edit).not.toBeVisible();
    const updated = await scheduleFor(page, data.program.id);
    const original = schedule.assignments.find(
      (mapping) =>
        mapping.cohort.id === old.id && mapping.version.id === data.after.id,
    )!;
    expect(
      updated.assignments.find((mapping) => mapping.id === original.id),
    ).toEqual({ ...original, fromSemester: later });
    expect(
      updated.assignments.filter((mapping) => mapping.id !== original.id),
    ).toEqual(
      schedule.assignments.filter((mapping) => mapping.id !== original.id),
    );
  });
});
