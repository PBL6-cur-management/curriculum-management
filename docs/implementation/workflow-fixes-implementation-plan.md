# Workflow fixes — implementation plan

Six workflow defects confirmed against source on 2026-11-07, after the workflow survey. Decisions taken by the user on 2026-11-07: defaults for fixes 1, 3, 4 and 5; fix 2 routes to both ends of a relation; fix 6 is option B (label and warning, no fan-out).

Backend and frontend, one plan. No migration. No git writes: build in the working tree on the current branch.

## 1. Scope

| # | Defect | Fix |
|---|---|---|
| F1 | R4/R5 cannot create a CURRICULUM request: the PROGRAM target scope carries no subject group, so `assertCanCreate` refuses them though they may edit their group's rows inside a copy | Creation scope and curriculum-page edit path for a programme include the subject groups of courses listed in its in-force versions |
| F2 | A COURSE_RELATION request routes only to the request course's coordinator and the directors of programmes that list it; the other end of the relation is never asked | Affected courses = request course + both ends of every relation item, home faculty only |
| F3 | A PROGRAM_INFO request's working copy accepts curriculum, requisite and PLO edits, which then ship under a minor version number | A PROGRAM_INFO copy accepts only PROGRAM_EDIT_INFO writes |
| F4 | CLO pages show "Tạo đề xuất" (OUTCOME on PROGRAM), but creation checks only PLO_EDIT, so R4/R5 are refused | OUTCOME on PROGRAM accepts PLO_EDIT or CLO_EDIT; scope from F1 |
| F5 | A group without a coordinator, or a programme without a director, is silently skipped at submit | Submit (and its preview) refuses with 409 naming the group or programme |
| F6 | A COURSE / COURSE_RELATION request closes as "Đã có hiệu lực", but released versions keep their snapshot; only REPLACEMENT relations apply live | Warning on the final-approval form and on the request detail once EFFECTIVE |

Out of scope, logged as debt (§6): fan-out of course changes into programme versions (option C), ORGANIZATION scope, CURRICULUM copy limits on PLO edits, survey items #4 (refuted), #9 (by design), #10 (low).

## 2. Contracts

### F1 — programme content scope

New `source/backend/src/shared/programs/program-content-target.ts`:

```ts
export async function programContentTarget(
  db: Db,
  program: { id: string; facultyId: string },
): Promise<ScopeTarget>
// = programTarget(program) + subjectGroupIds: distinct non-null course.ownerGroupId
//   over curriculumItems of versions with sourceRequestId null and status in ACTIVE_OR_PENDING.
```

Used in exactly two places:

| Call site | Change |
|---|---|
| `features/change-requests/change-requests.service.ts` `assertCanCreate` | When `type` is CURRICULUM, or OUTCOME with `targetType` PROGRAM, check permissions against `programContentTarget(...)` instead of `target.scope`. ORGANIZATION and every other type unchanged |
| `features/curriculum/curriculum-read.service.ts:95–111` | The version's `editPath` uses `programContentTarget(...)` so R4/R5 see the VIA_REQUEST notice and the request button. `canEditStructure` stays on `programTarget` (structure is R1/R3) |

`request-target.resolver.ts` is not changed: `target.scope` stays the narrow scope used for conflicts and display. The resolver result needs `facultyId` reachable for the helper; take it from the PROGRAM case's existing lookup (add it to the returned object only if not already derivable).

### F2 — relation routing

`features/change-requests/routing-planner.ts`:

- `affectedHomeCourses` (202–231): for `requestType` COURSE_RELATION, collect the request course plus `newValue.sourceCourseId` and `newValue.targetCourseId` of every item with `entityType` COURSE_RELATION (fall back to `oldValue` for removals), dedupe, keep home-faculty courses only.
- `plan()` (109–174): the FOREIGN_COURSE early return applies only when the affected home-course set is empty.
- `coordinatorSteps` / `directorSteps` already iterate the affected courses and `programsUsing` per course; dedupe of approvers stays as is.

### F3 — copy type guard

`shared/change-requests/request-draft.ts`:

- `REQUEST_DRAFT_SELECT.sourceRequest.select` gains `requestType: true`; `RequestDraftRef` gains `requestType: ChangeRequestType`.
- `assertCopyWritable(access, code, target, request)`: first check — if `request.requestType === PROGRAM_INFO` and `code !== PROGRAM_EDIT_INFO`, throw `REQUEST_DRAFT_ERRORS.WRONG_REQUEST_TYPE`.
- `canEditCopy`: same condition returns false.
- `shared/change-requests/change-request.errors.ts` `REQUEST_DRAFT_ERRORS.WRONG_REQUEST_TYPE`: 409, message `'Đề xuất sửa thông tin chương trình chỉ sửa được thông tin chung. Hãy tạo đề xuất khung chương trình hoặc chuẩn đầu ra cho thay đổi này.'`

Every consumer of the select (`curriculum-access.ts:34`, `outcome-access.ts:44`, `version-info.dto.ts:48`, `syllabus-access.ts:42`, `syllabus.dto.ts:151`) gets the field for free; spec fixtures that build a `RequestDraftRef` by hand add `requestType`.

### F4 — CLO creation path

`shared/change-requests/request-kinds.ts:54–78` `editPermissionsFor`: OUTCOME with PROGRAM target returns `[PLO_EDIT, CLO_EDIT]`. Version bump unchanged (major, BR-24).

### F5 — refuse missing approvers

- `features/change-requests/change-request-feature.errors.ts` `SUBMISSION_ERRORS` gains `NO_COORDINATOR` and `NO_DIRECTOR` (409), with base messages `'Nhóm chuyên môn chưa có Điều phối nên chưa gửi duyệt được. Liên hệ Phòng Đào tạo để phân công.'` and `'Chương trình chưa có Giám đốc CTĐT nên chưa gửi duyệt được. Liên hệ Phòng Đào tạo để phân công.'`. The thrown error spreads the definition and puts the group code / programme code into the message (same mechanism as other dynamic messages).
- `routing-planner.ts` line 280 and 334: replace the skip with the throw. NO_GROUP, NO_PROGRAM, NO_COURSE, FOREIGN_COURSE and CREATOR skips stay.
- The preview path (`submission.service.ts:~94–104`) already turns an AppException into an `issue`; no change there.
- `SKIP_REASONS.NO_COORDINATOR` / `NO_DIRECTOR` stay defined: plans submitted before this change still carry them and the detail page must keep labelling them.

### F6 — label the snapshot rule

Backend: `FinalApprovalPreviewDto` gains `requestType` (enum ChangeRequestType), filled in `final-approval.service.ts` from the request already loaded.

Frontend:

| File | Change |
|---|---|
| `src/shared/api/schema.d.ts` | Regenerate with `pnpm api:types` against a running backend; if the backend cannot start, add the one field by hand |
| `src/features/change-requests/constants/` (existing labels file, or new `courseChangeNotice.ts`) | `COURSE_CHANGE_NOTICE = 'Phiên bản chương trình đã ban hành giữ nguyên tên, tín chỉ và tiên quyết đã chụp; thay đổi này vào khung khi tạo phiên bản sau. Riêng học phần thay thế áp dụng ngay cho mọi sinh viên.'` and the set `COURSE_CHANGE_TYPES = ['COURSE', 'COURSE_RELATION']` |
| `pages/FinalApprovalPage.tsx` | AntD `Alert type="warning" showIcon` with the notice, above the form, when `data.requestType` is in the set |
| `pages/ChangeRequestDetailPage.tsx` | Same Alert (type info) when the request is EFFECTIVE and its type is in the set |

The status label "Đã có hiệu lực" is not renamed: it is correct for every other type.

## 3. Build order

1. F3 (shared guard; touches most spec fixtures, so land first).
2. F4 + F1 (both in creation scope).
3. F2, then F5 (same file; F5 last so F2's tests are written against throwing behaviour).
4. F6 backend DTO, then frontend.
5. Unit tests per fix (§4), then the checks in §5.

## 4. Tests to add or change (unit, Vitest)

| Fix | Spec | Cases |
|---|---|---|
| F1 | `program-content-target.spec.ts` (new) | groups collected from ACTIVE/PENDING non-copy versions; copies and DRAFT/ARCHIVED ignored; null ownerGroupId dropped |
| F1 | `change-requests.service.spec.ts` | R5 with a group in the programme may create CURRICULUM; R5 with no course in the programme refused; ORGANIZATION unchanged |
| F1 | `curriculum-read.service.spec.ts` | R4 sees VIA_REQUEST on a released version of a programme with their group; `canEditStructure` false |
| F2 | `routing-planner.spec.ts` | relation A→B with different groups: both coordinators at level 1; directors of programmes using A or B at level 2; request course foreign but B home → not skipped |
| F3 | `request-draft.spec.ts` | PROGRAM_INFO copy: PROGRAM_EDIT_INFO passes, CURRICULUM_EDIT / PLO_EDIT throw WRONG_REQUEST_TYPE; `canEditCopy` false |
| F4 | `request-kinds.spec.ts` | OUTCOME/PROGRAM returns both codes |
| F5 | `routing-planner.spec.ts` | group without coordinator → throws NO_COORDINATOR with the group code; programme without director → NO_DIRECTOR with the code; existing skip-expectations for these two rewritten |
| F6 | `FinalApprovalPage.test.tsx`, `ChangeRequestDetailPage.test.tsx` | notice shown for COURSE_RELATION, hidden for CURRICULUM; detail notice only when EFFECTIVE |

Existing tests that assert the NO_COORDINATOR / NO_DIRECTOR skip are updated to expect the refusal, not deleted.

## 5. Verification

- Backend: `pnpm exec tsc --noEmit -p tsconfig.json`, lint script, `pnpm test` (unit).
- Frontend: `pnpm exec tsc -b`, oxlint, `pnpm test`.
- **Deferred while Docker is down**: backend e2e (change-requests, routing, permission-table suites may assert the old skip and the old creation refusal) and Playwright. Record as debt; run when PostgreSQL/Redis are up.
- `demo-org.ts` assigns a coordinator to all five groups and a director to every programme, so F5 does not block the demo data.

## 6. Debt to record in `docs/progress/todo.md`

- Option C: fan course changes (name, credits, requisites) out into new programme versions, like syllabus releases.
- Backend e2e + Playwright re-run for these fixes.
- Survey #10: a request returned after final approval can be resubmitted but not abandoned (low).
- Survey #4 refuted, #9 by design (school-wide equivalence groups): note only.

## 7. Docs

`docs/troubleshooting/error_log.md`: one entry per fix (F1–F5 are wrong-state / silent-failure bugs; F6 a misleading label). `features_architecture.md` (change-request routing and creation scope), `progress_log.md`, `current_work.md`, `todo.md` via docs-sync. Implement report at `docs/implement-report/workflow-fixes-implement-report.md`.
