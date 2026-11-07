# Workflow fixes — implement report

Plan: [workflow-fixes-implementation-plan](../implementation/workflow-fixes-implementation-plan.md). Built 2026-11-07 in the working tree on `main`; no git writes, no migration.

## Status

- Landed: F1–F6, backend and frontend, unit tests per plan §4.
- Not run (Docker down): backend e2e (change-requests, routing, permission-table suites), Playwright. They may still assert the old NO_COORDINATOR / NO_DIRECTOR skip and the old creation refusal; recorded as debt in plan §6.
- `schema.d.ts` edited by hand (`requestType` on `FinalApprovalPreviewDto`); regenerate with `pnpm api:types` when a backend runs.

## Summary

| Fix | Files | Verified by |
|---|---|---|
| F3 copy guard | `shared/change-requests/request-draft.ts`, `change-request.errors.ts`, `request-draft.spec.ts` | unit |
| F4 CLO path | `shared/change-requests/request-kinds.ts`, new `request-kinds.spec.ts` | unit |
| F1 content scope | new `shared/programs/program-content-target.ts` + spec, `change-requests.service.ts` + spec, `curriculum-read.service.ts` + spec | unit |
| F2 relation routing | `routing-planner.ts`, `routing-planner.spec.ts` | unit |
| F5 missing approvers | `change-request-feature.errors.ts`, `routing-planner.ts`, `routing-planner.spec.ts` | unit |
| F6 snapshot notice | `final-approval.dto.ts`, `final-approval.preview.ts`, `schema.d.ts`, `constants/courseChangeNotice.ts`, `FinalApprovalPage.tsx`, `ChangeRequestDetailPage.tsx` + two tests | unit |

## F3 — PROGRAM_INFO copy guard

Landed as planned. `isOutsideProgramInfoCopy` is shared by `assertCopyWritable` (throws `REQUEST_COPY_WRONG_TYPE`, checked before the permission) and `canEditCopy`. Existing hand-built fixtures were typed loosely; only `request-draft.spec.ts` needed `requestType`.

## F4 — CLO creation path

Landed as planned: OUTCOME on PROGRAM returns `[PLO_EDIT, CLO_EDIT]`; OUTCOME on COURSE stays `[CLO_EDIT]`.

## F1 — programme content scope

- Decision: `ResolvedTarget` is not extended. `assertCanCreate` takes the programme's faculty from `target.scope.orgUnitIds[0]` (set by `programTarget`), and became async with the Prisma client as first argument.
- Decision: programme-info requests keep the narrow scope (a spec case proves a group member holding only `PROGRAM_EDIT_INFO` is still refused).
- Deviation (existing test changed): `curriculum-read.service.spec.ts` "lets R4 add and edit only rows of its group" asserted `editPath: null` for an unreleased Draft. That value encoded the defect (R4 could add rows while the page reported no path). With the programme's groups in scope it is `DIRECT`, the same value R1 gets on a Draft. Expectation updated; two cases added (released version gives R4 `VIA_REQUEST`; no group course gives `null`).

## F2 — relation routing

- Deviation: the plan says `programsUsing` is already per affected course. In source it is called once with `request.courseId`. Added `programsUsingAny` (union over the affected home courses, sorted by programme code) and used it for COURSE_RELATION only.
- Deviation: the plan says to fall back to `oldValue` for removals. Neither `oldValue` nor the REMOVE/UPDATE `newValue` carries course ids (`{ minScore }` / `{ operation, relationId }`). Ends of an update or removal are read from `CourseRelation` through `ChangeItem.recordId`; added relations read both ids from `newValue`.
- The FOREIGN_COURSE early return now applies only when a COURSE_RELATION request has no home course among the request course and relation ends.

## F5 — refuse missing approvers

Landed. Message = base message + ` Mã nhóm: <code>.` / ` Mã chương trình: <code>.` Existing spec cases that expected the skip were rewritten as refusals, and the two cases that incidentally routed through a programme without a director (`noCourse`, `foreignOnly`) now give that programme a director. `SKIP_REASONS.NO_COORDINATOR` / `NO_DIRECTOR` kept for old plans.

## F6 — snapshot notice

- Deviation: the DTO is filled in `final-approval.preview.ts` (where the preview is built), not `final-approval.service.ts`.
- Deviation: the plan's type set `['COURSE', 'COURSE_RELATION']` names a value that is not a `ChangeRequestType`. Course fields and relations both travel as COURSE_RELATION, so the set holds that one type.
- Notice constant lives in `constants/courseChangeNotice.ts`. Final-approval page: warning Alert under the preview, above the form. Detail page: info Alert when EFFECTIVE.

## Verification

See the hand-back message for commands and counts.

## Lesson worth keeping

A plan line that says "already iterates X" for a function needs a source read: `programsUsing` looked per-course in the plan and was single-course in code, which would have left the second end's directors unasked.
