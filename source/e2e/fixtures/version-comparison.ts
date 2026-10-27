import {
  expect,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import type { components } from "../../frontend/src/shared/api/schema.js";
import { fixtureApi } from "./change-requests.js";
import { prepareApprovedRelease } from "./release-versions.js";
import { uniqueSuffix } from "./unique.js";

type Schemas = components["schemas"];
export async function buildComparisonProgram(page: Page, browser: Browser) {
  const released = await prepareApprovedRelease(page, browser);
  const correction = await fixtureApi<Schemas["VersionDetailDto"]>(
    page,
    "POST",
    `${released.program.path}/versions/${released.versionId}/corrections`,
  );
  await fixtureApi(page, "PATCH", `/program-versions/${correction.id}/info`, {
    programName: `So sánh ${uniqueSuffix()}`,
  });
  const after = await fixtureApi<Schemas["VersionDetailDto"]>(
    page,
    "POST",
    `${released.program.path}/versions/${released.versionId}/corrections/${correction.id}/issue`,
    {
      reason: "Đính chính tên trên chương trình kiểm thử riêng.",
      moveCohorts: false,
    },
  );
  const comparison = await fixtureApi<Schemas["VersionComparisonDto"]>(
    page,
    "GET",
    `${released.program.path}/version-comparison?${new URLSearchParams({ beforeVersionId: released.program.versionId, afterVersionId: after.id })}`,
  );
  return {
    ...released,
    after,
    comparison,
    beforeVersionId: released.program.versionId,
    pair: new URLSearchParams({
      beforeVersionId: released.program.versionId,
      afterVersionId: after.id,
    }).toString(),
  };
}
export async function comparisonCohort(page: Page, label: string) {
  return fixtureApi<Schemas["CohortDto"]>(page, "POST", "/cohorts", {
    cohortCode: `${label}-${uniqueSuffix()}`,
    intakeYear: 2026,
  });
}
export async function selectComparisonOption(
  page: Page,
  control: Locator,
  label: string,
) {
  await control.click();
  await control.fill(label);
  const dropdown = page.locator(".ant-select-dropdown:visible");
  await expect(dropdown).toBeVisible();
  await dropdown.getByText(label, { exact: true }).click();
  await control.press("Tab");
  await expect(control).toHaveAttribute("aria-expanded", "false");
}
export async function scheduleFor(page: Page, programId: string) {
  return fixtureApi<Schemas["CohortVersionListDto"]>(
    page,
    "GET",
    `/programs/${programId}/cohort-versions`,
  );
}
export async function assignComparisonCohorts(
  page: Page,
  programId: string,
  versionId: string,
  semesterId: string,
  cohortIds: string[],
) {
  const schedule = await scheduleFor(page, programId);
  return fixtureApi<Schemas["CohortVersionListDto"]>(
    page,
    "POST",
    `/programs/${programId}/cohort-versions`,
    {
      cohortIds,
      programVersionId: versionId,
      fromSemesterId: semesterId,
      expectedRevision: schedule.revision,
    },
  );
}
