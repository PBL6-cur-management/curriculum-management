# Danh sách chương trình đào tạo dạng tổng quan — implementation plan

Request from the supervising lecturer (2026-11-07): the "Chương trình đào tạo" list should show major, major code, released versions (year), intake cohorts and the managing faculty. Filtering by faculty, version year, cohort and degree level should lead to the curriculum each cohort follows. The lecturer's sketch is a reference, not a spec.

User decisions (2026-11-07):

| Question | Decision |
|---|---|
| TT 74/2026 major code | Not added. Show the one stored `majorCode` only ("show what is available") |
| Layout | One row per programme; versions and cohorts listed inside the row as links |
| Filters | Faculty, degree level, release year, intake year |
| Existing columns | Keep "Giám đốc CTĐT" and "Trạng thái" |

No migration. No git writes.

## 1. Scope

In: `GET /api/programs` gains three filters and per-row version/cohort data; `ProgramListPage` gains columns, filters and links.

Out: a second major code field; an ARCHITECT degree level (the schema has ENGINEER and BACHELOR only); changes to programme detail or workspace; the teammate's "Đang sử dụng next to a Draft" item (DEBT-18).

## 2. Backend contract

### 2.1 Query — `features/programs/program-query.dto.ts`

| Param | Type | Validation | Filter |
|---|---|---|---|
| `facultyId` | string, optional | `@IsString()` | `program.facultyId = facultyId` |
| `releaseYear` | int, optional | `@Type(() => Number) @IsInt() @Min(1900) @Max(2100)` | some released version (see 2.3) whose release year = value |
| `intakeYear` | int, optional | same as above | some released version with a `cohortVersions` row whose `cohort.intakeYear` = value |

Bounds go in a named constant (`PROGRAM_YEAR_MIN` / `PROGRAM_YEAR_MAX`) in the same file, not inline.

### 2.2 Response — `features/programs/program.dto.ts`

`ProgramSummaryDto` gains:

```ts
@ApiProperty() majorCode!: string;            // from currentVersion(row)
@ApiProperty() majorName!: string;            // from currentVersion(row)
@ApiProperty({ type: [ProgramReleasedVersionDto] })
releasedVersions!: ProgramReleasedVersionDto[];

export class ProgramCohortRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() intakeYear!: number;
}

export class ProgramReleasedVersionDto extends ProgramVersionRefDto {
  @ApiProperty({ nullable: true, type: Number }) releaseYear!: number | null;
  @ApiProperty({ type: [ProgramCohortRefDto] }) cohorts!: ProgramCohortRefDto[];
}
```

`ProgramDetailDto` extends the summary, so it carries the new fields too. Accept that, no separate shape.

### 2.3 Rules

- **Released version** = `status` in PENDING, ACTIVE, HISTORICAL, non-copy (`sourceRequestId: null`). It must not be an unissued correction draft; `programInclude` already excludes those, so reuse its `where`. Drafts are not listed.
- **Release year** = year of `signedDate`, else year of `publishedAt`, else `null`. Use the calendar year in the Asia/Ho_Chi_Minh zone: reuse the date helper the codebase already uses for `todayDate()`; check source before writing a new one. The filter uses the same rule. Prisma: `OR: [{ signedDate: { gte: Jan 1, lt: Jan 1 next } }, { signedDate: null, publishedAt: { gte, lt } }]`, with the year bounds as dates in that zone.
- **Cohorts per version** = `cohortVersions → cohort { id, cohortCode, intakeYear }`, distinct by cohort, ordered by `intakeYear` ascending.
- `releasedVersions` are ordered by release year ascending, then `versionNumber`, nulls last.
- `VERSION_INFO_SELECT` gains `signedDate`, `publishedAt` and `cohortVersions: { select: { cohort: { select: { id, cohortCode, intakeYear } } } }`. If adding `cohortVersions` there would bloat other callers, add it only to `programInclude`'s version select and note the choice in the report.

### 2.4 Tests — `programs.service.spec.ts` (and a `program.dto.spec.ts` if the mapper gets its own)

- Each new filter builds the expected `where` (facultyId; releaseYear with the signedDate/publishedAt OR; intakeYear through cohortVersions).
- Mapper: Draft excluded from `releasedVersions`; `releaseYear` falls back from `signedDate` to `publishedAt` to `null`; cohorts deduped and sorted.
- DTO validation: `releaseYear=abc` → 400; out of bounds → 400.

## 3. Frontend

### 3.1 Types

Regenerate `src/shared/api/schema.d.ts` with `pnpm api:types` when the backend runs. Otherwise hand-add the three DTO changes, matching the generated style. `features/programs/api/programs.ts` re-exports `ProgramReleasedVersion` and `ProgramCohortRef`, and `ProgramListQuery` gains `facultyId?`, `releaseYear?`, `intakeYear?`.

### 3.2 `features/programs/pages/ProgramListPage.tsx`

Columns, in order:

| Column | Content |
|---|---|
| Chương trình | unchanged (name link + code) |
| Ngành | `majorName` |
| Mã ngành | `majorCode`, tabular numerals |
| Trình độ | unchanged |
| Phiên bản (năm ban hành) | one line per released version: link `"{versionNumber} · {releaseYear}"` to `ROUTES.curriculum` of that version. Year missing → number only. The ACTIVE version is followed by the text "đang áp dụng" (status readable without colour). No released version → secondary text "Chưa ban hành" |
| Khóa tuyển sinh | one link per cohort `cohortCode` (intake year in `title` is not enough; show `"{cohortCode} ({intakeYear})"` only if `cohortCode` does not already contain the year: decide from real codes in seed fixtures, record in report) to `ROUTES.curriculum` of the version that cohort follows. None → "Chưa gán khóa" |
| Khoa quản lý | `faculty.unitName` (check the field name on `OrgUnitRefDto`) |
| Giám đốc CTĐT | unchanged |
| Trạng thái | unchanged |

"Phiên bản hiện hành" is removed: the version column replaces it.

Render the version and cohort lists as small components in `features/programs/components/` (`ReleasedVersionLinks.tsx`, `CohortLinks.tsx`), one per file. The table gets horizontal scroll (`scroll={{ x: 'max-content' }}` or whatever `DataTable` exposes) so nine columns stay usable.

Filters bar, after search and before status:

| Filter | Control | Query param |
|---|---|---|
| Khoa quản lý | `OrgUnitSelect` from `shared/org-units`, `types` limited to the faculty unit type, `allowClear` | `facultyId` |
| Trình độ | existing | `degreeLevel` |
| Năm ban hành | AntD `DatePicker picker="year"`, `allowClear` | `releaseYear` |
| Khóa tuyển sinh | AntD `DatePicker picker="year"` labelled "Năm tuyển sinh", `allowClear` | `intakeYear` |

Filters live in the URL like the existing ones (`useUrlQuery`), reset `page` to 1, and the list query keeps `placeholderData: keepPreviousData` (check `useProgramList` already does).

Vietnamese labels go in `features/programs/constants/programLabels.ts` (existing file) as named constants.

### 3.3 Tests — `ProgramListPage.test.tsx`

- Version cell: two released versions render two links to the right curriculum paths; "đang áp dụng" only on the ACTIVE one; empty → "Chưa ban hành".
- Cohort cell: link goes to the curriculum of the version the cohort is attached to; empty → "Chưa gán khóa".
- Each new filter writes its param and resets page.
- Existing tests updated for the removed "Phiên bản hiện hành" column.

## 4. Verification

- Backend: `pnpm exec tsc --noEmit -p tsconfig.json`, `pnpm lint`, `pnpm test`.
- Frontend: `pnpm exec tsc -b`, `pnpm lint`, `pnpm exec vitest run --testTimeout=30000 --maxWorkers=4`.
- Deferred while Docker is down: backend e2e for `GET /api/programs`, Playwright f-06 (the list page is covered there; it may assert the removed column). Add to DEBT-16/19.
- UI review: `/impeccable polish` + `audit` on the list page is owed with the existing screenshot round (current_work "Up Next" 1).

## 5. Docs

`features_architecture.md` (F-06 list: columns, filters, release-year rule), `screen-inventory.md` (programme list row), `progress_log.md`, `current_work.md`, `todo.md` (deferred e2e/Playwright; TT 74/2026 major code as a Khoa input item). Implement report at `docs/implement-report/program-list-overview-implement-report.md`.
