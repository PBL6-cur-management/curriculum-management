# Program list overview — implement report

Plan: [program-list-overview-implementation-plan](../implementation/program-list-overview-implementation-plan.md)

## Status

- Backend §2 and frontend §3 built; unit and component tests added. Backend e2e and Playwright not run (Docker down).
- Branch: `main`, working tree only, nothing committed. No migration, no `schema.prisma` change.
- `schema.d.ts` was hand-edited (no backend to run `pnpm api:types`); regenerate when a backend is up (DEBT-22).

## Summary

| Deliverable | Files | Verified by |
|---|---|---|
| Query filters `facultyId`, `releaseYear`, `intakeYear` | `program-query.dto.ts`, `programs.service.ts` | service spec, `program-query.dto.spec.ts` |
| Release-year rule | `program-release-year.ts` (+ spec) | spec |
| Response `majorCode`, `majorName`, `releasedVersions` | `program.dto.ts` | service spec |
| Types | `schema.d.ts`, `features/programs/api/programs.ts` | `tsc -b` |
| List page columns, filters | `ProgramListPage.tsx`, `ReleasedVersionLinks.tsx`, `CohortLinks.tsx`, `programLabels.ts`, `OrgUnitSelect.tsx` | `ProgramListPage.test.tsx` |

## Decisions during build

- **Cohort label**: seed convention is `K<intakeYear>` (e.g. `K2025`), so the code already carries the year. Rule: show `cohortCode`; append ` (intakeYear)` only when the code does not contain the year. Real DUT codes were not inspected (private data).
- **Release-year timezone**: `signedDate` is a DATE column, so its UTC calendar year is the year. `publishedAt` is an instant, read in Asia/Ho_Chi_Minh through `todayDate()`. The filter bounds `publishedAt` with a fixed `+07:00` offset (no DST) and `signedDate` with UTC midnights.
- **Both year filters on one version**: when `releaseYear` and `intakeYear` are both sent they must hold on the same released version (single `versions.some` with `AND`). The plan said "some released version" for each; this reading ties a cohort to the year it was released in. Rejected: two independent `some` clauses.
- **Cohort link target**: `ProgramCohortRefDto` carries no semester, so a cohort attached to several released versions links to the newest one in the list's order (release year, then version number).
- **`cohortVersions` select**: added only to `programInclude`'s version select, not to `VERSION_INFO_SELECT`, which `version-info.dto.ts` also spreads. `toVersionInfo` now takes `Prisma.ProgramVersionGetPayload<{ select: typeof VERSION_INFO_SELECT }>` instead of `VersionInfoRow`.
- **`OrgUnitSelect`** gained an optional `placeholder` (default unchanged) and uses it as `aria-label`, so the faculty filter is addressable; other callers now also carry `aria-label="Chọn đơn vị"`.
- Faculty unit type is `FACULTY` (schema enum `UNIVERSITY | FACULTY | OFFICE`).

## Deviations

- Existing test helper `version()` in `programs.service.spec.ts` and `program-clone.service.spec.ts` gained the three new row fields (type requirement, no assertion changed).
- Existing list test selected the degree combobox by index; now by name, because the faculty select precedes it. Fixture `currentVersion` of the second programme changed to 2.0 and the "1.0" assertion moved to the new version-cell test.
- Fixture `majorName` values differ from `programName` in the list test so `findByText` stays unambiguous.

## Not done

- Backend e2e for `GET /api/programs`, Playwright f-06 (may assert the removed "Phiên bản hiện hành" column), `/impeccable polish` + `audit`, docs listed in plan §5 (out of this build's scope).
