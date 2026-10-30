import { expect, test } from "@playwright/test";
import { accounts, asRole } from "../fixtures/accounts.js";
import {
  approveRequest,
  fixtureApi,
  prepareRequest,
  prepareSyllabusAssessment,
  releaseSemester,
  requestHeading,
  saveRequest,
  submitRequest,
  withRequestRole,
  type ReleaseProgram,
  type RequestRecord,
} from "../fixtures/change-requests.js";
import { creditRow, openConsistency } from "../fixtures/consistency.js";
import { addCurriculumItem, curriculumRow } from "../fixtures/curriculum.js";
import { createProgram, programInfo } from "../fixtures/programs.js";
import {
  confirmFinalRelease,
  confirmInitialRelease,
  fillReleaseDecision,
  openFinalApproval,
  versionPath,
} from "../fixtures/release-versions.js";
import {
  createGroupedCourse,
  createSyllabus,
  fillRichText,
  saveSyllabusContent,
  syllabusSection,
} from "../fixtures/syllabi.js";
import { uniqueSuffix } from "../fixtures/unique.js";

test.describe("MVP CTĐT → khung → nhất quán → đề xuất → duyệt → ban hành → hiệu lực", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use(asRole("R1"));

  let program: ReleaseProgram;
  let request: RequestRecord;
  let originalDescription: string;
  let revisedDescription: string;

  test("MVP-TC_001 Tạo CTĐT và dữ liệu riêng cho toàn bộ luồng", async ({
    page,
  }) => {
    const created = await createProgram(page, {
      code: `MP${uniqueSuffix()}`,
      total: "2.5",
      compulsory: "2.5",
      elective: "0",
    });
    await expect(
      programInfo(page).getByText("Nháp", { exact: true }),
    ).toBeVisible();
    const details = await fixtureApi<{
      id: string;
      currentVersion: { id: string; status: string };
    }>(page, "GET", created.path);
    expect(details.currentVersion.status).toBe("DRAFT");
    const users = await fixtureApi<{
      items: { id: string; username: string }[];
    }>(page, "GET", `/users?q=${encodeURIComponent(accounts.R3)}`);
    const director = users.items.find((user) => user.username === accounts.R3);
    if (!director)
      throw new Error("Thiếu Giám đốc CTĐT e2e: chạy `pnpm --dir ../backend e2e:world`.");
    await fixtureApi(page, "POST", `${created.path}/directors`, {
      directorId: director.id,
      validFrom: "2020-01-01",
    });

    const course = await createGroupedCourse(page);
    const courseDetails = await fixtureApi<{ id: string }>(
      page,
      "GET",
      course.path,
    );
    const syllabus = await createSyllabus(page, course);
    originalDescription = `Mô tả ban đầu ${created.code}`;
    revisedDescription = `Mô tả điều chỉnh ${created.code}`;
    await fillRichText(page, "Mô tả học phần", originalDescription);
    await fillRichText(page, "Mục tiêu học phần", `Mục tiêu ${created.code}`);
    await saveSyllabusContent(page);
    await prepareSyllabusAssessment(page, syllabus);
    program = {
      ...created,
      id: details.id,
      versionId: details.currentVersion.id,
      releasePath: created.curriculumPath.replace(/\/curriculum$/, "/release"),
      course: { ...course, id: courseDetails.id },
      syllabusId: syllabus.syllabusId,
      semester: await releaseSemester(page, true),
    };
  });

  test("MVP-TC_002 Soạn khung, kiểm tra nhất quán và áp dụng bản khởi tạo", async ({
    page,
  }) => {
    await openConsistency(page, program.curriculumPath, program.code);
    await expect(creditRow(page, "Tổng")).toHaveText("Tổng2.50-2.5");
    await addCurriculumItem(page, program.curriculumPath, program.course);
    await expect(curriculumRow(page, program.course)).toBeVisible();
    await openConsistency(page, program.curriculumPath, program.code);
    const checked = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/program-versions/${program.versionId}/consistency` &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Chạy lại" }).click();
    expect(await (await checked).json()).toMatchObject({ passes: true });
    await expect(creditRow(page, "Tổng")).toHaveText("Tổng2.52.50");
    await expect(
      page.getByText(
        "Còn lỗi: chưa gửi duyệt hoặc ban hành được phiên bản này.",
        { exact: true },
      ),
    ).not.toBeVisible();

    await page.goto(program.releasePath);
    await expect(page.getByLabel("Số phiên bản", { exact: true })).toHaveValue(
      "1.0",
    );
    const { decision, semester } = await fillReleaseDecision(page, true);
    expect(semester.id).toBe(program.semester.id);
    await confirmInitialRelease(page);
    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      "phiên bản 1.0",
    );
    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      "Đang hiệu lực",
    );
    await expect(page.locator(".ant-descriptions")).toContainText(decision);
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: program.course.code })
        .getByRole("link", { name: "Bản 1 (đang ban hành)", exact: true }),
    ).toBeVisible();
    const active = await fixtureApi<{ id: string; status: string }>(
      page,
      "GET",
      versionPath(program),
    );
    expect(active).toMatchObject({ id: program.versionId, status: "ACTIVE" });
    const applied = await fixtureApi<{
      currentVersion: { id: string; status: string };
    }>(page, "GET", program.path);
    expect(applied.currentVersion).toMatchObject({
      id: program.versionId,
      status: "ACTIVE",
    });
    await page.goto(program.path);
    await expect(
      page.getByRole("link", { name: "Khung chương trình", exact: true }),
    ).toHaveAttribute("href", program.curriculumPath);
    await page
      .getByRole("link", { name: "Khung chương trình", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${program.curriculumPath}$`));
    await expect(curriculumRow(page, program.course)).toBeVisible();
  });

  test("MVP-TC_003 R5 soạn trên bản sao và gửi đề xuất của cùng CTĐT", async ({
    page,
    browser,
  }) => {
    request = await withRequestRole(browser, "R5", async (creator) => {
      await prepareRequest(creator, program, { course: true });
      const created = await saveRequest(creator);
      await creator
        .getByRole("button", { name: "Sửa nội dung đề cương", exact: true })
        .click();
      await fillRichText(creator, "Mô tả học phần", revisedDescription);
      await saveSyllabusContent(creator);
      await submitRequest(creator, created);
      await expect(requestHeading(creator, created)).toBeVisible();
      await expect(
        creator.getByText("Chờ Điều phối duyệt", { exact: true }),
      ).toBeVisible();
      return created;
    });
    await page.goto(
      `${program.course.path}/syllabus?versionId=${program.versionId}`,
    );
    await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
      originalDescription,
    );
    await expect(syllabusSection(page, "Mô tả học phần")).not.toContainText(
      revisedDescription,
    );
  });

  test("MVP-TC_004 R4 và R3 lần lượt duyệt qua hàng đợi và UI", async ({
    browser,
  }) => {
    for (const { role, waiting, next } of [
      {
        role: "R4",
        waiting: "Chờ Điều phối duyệt",
        next: "Chờ Giám đốc CTĐT duyệt",
      },
      {
        role: "R3",
        waiting: "Chờ Giám đốc CTĐT duyệt",
        next: "Chờ Phòng Đào tạo duyệt",
      },
    ] as const) {
      await withRequestRole(browser, role, async (reviewer) => {
        await reviewer.goto("/approval-queue");
        const row = reviewer
          .getByRole("row")
          .filter({ hasText: request.requestCode });
        await expect(row).toContainText(waiting);
        await row
          .getByRole("link", { name: request.requestCode, exact: true })
          .click();
        await expect(requestHeading(reviewer, request)).toBeVisible();
        await approveRequest(reviewer, request);
        await expect(reviewer.getByText(next, { exact: true })).toBeVisible();
      });
    }
  });

  test("MVP-TC_005 R1 duyệt cuối sinh bản Chờ hiệu lực, giữ bản đang áp dụng", async ({
    page,
  }) => {
    await openFinalApproval(page, request);
    const { decision, semester } = await fillReleaseDecision(page);
    await confirmFinalRelease(page);
    await expect(
      page.getByText("Đã phê duyệt cuối.", { exact: true }),
    ).toBeVisible();
    await page.goto(`/change-requests/${request.id}`);
    await expect(requestHeading(page, request)).toBeVisible();
    await expect(page.getByText("Đã phê duyệt", { exact: true })).toBeVisible();

    const history = await fixtureApi<{
      versions: {
        id: string;
        versionNumber: string;
        status: string;
        originRequest: { id: string } | null;
      }[];
    }>(page, "GET", `${program.path}/versions`);
    const pending = history.versions.find(
      (version) => version.originRequest?.id === request.id,
    );
    if (!pending)
      throw new Error(
        "Không tìm thấy phiên bản sinh từ đề xuất của luồng MVP.",
      );
    expect(pending).toMatchObject({ versionNumber: "1.1", status: "PENDING" });
    expect(
      history.versions
        .filter((version) => version.status === "ACTIVE")
        .map((version) => version.id),
    ).toEqual([program.versionId]);
    await page.goto(`${program.path}/versions`);
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "1.1", exact: true }) });
    await expect(row).toContainText("Chờ hiệu lực");
    await expect(row).toContainText(request.requestCode);
    await expect(row).toContainText(semester.semesterCode);
    await row.getByRole("link", { name: "1.1", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`${versionPath(program, pending.id)}$`),
    );
    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      "Chờ hiệu lực",
    );
    await expect(page.locator(".ant-descriptions")).toContainText(decision);
    await expect(
      page
        .locator(".ant-descriptions")
        .getByRole("link", { name: request.requestCode, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".ant-descriptions")
        .getByRole("link", { name: "1.0", exact: true }),
    ).toBeVisible();
    const released = await fixtureApi<{
      status: string;
      effectiveSemester: { id: string };
      previousVersion: { id: string };
    }>(page, "GET", versionPath(program, pending.id));
    expect(released).toMatchObject({
      status: "PENDING",
      effectiveSemester: { id: semester.id },
      previousVersion: { id: program.versionId },
    });

    await page.goto(`${program.course.path}/syllabus?versionId=${pending.id}`);
    await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
      revisedDescription,
    );
    await page.goto(
      `${program.course.path}/syllabus?versionId=${program.versionId}`,
    );
    await expect(syllabusSection(page, "Mô tả học phần")).toContainText(
      originalDescription,
    );
    await expect(syllabusSection(page, "Mô tả học phần")).not.toContainText(
      revisedDescription,
    );
    const applied = await fixtureApi<{
      currentVersion: { id: string; status: string };
    }>(page, "GET", program.path);
    expect(applied.currentVersion).toMatchObject({
      id: program.versionId,
      status: "ACTIVE",
    });
    await page.goto(program.path);
    await expect(
      page.getByRole("link", { name: "Khung chương trình", exact: true }),
    ).toHaveAttribute("href", program.curriculumPath);
    await page
      .getByRole("link", { name: "Khung chương trình", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${program.curriculumPath}$`));
    await expect(curriculumRow(page, program.course)).toBeVisible();
  });
});
