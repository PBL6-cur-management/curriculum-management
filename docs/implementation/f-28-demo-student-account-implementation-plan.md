# F-28 Demo Student Account — Backend Implementation Plan

Builds one idempotent seed script, `prisma/demo-student.ts`, that creates a **synthetic** student account `demo.sinhvien` linked to a real program/cohort in `ctdt_real`, with synthetic academic results, so the F-28 Flutter app (and the web student portal) can be demonstrated end to end without exposing any real student's data. No `src/` change, no migration, no new endpoint. Excludes: Microsoft/Office 365 login, any change to the portal, eligibility or graduation engines, and any link to a real `Student` row.

> **Companion documents**
> - App plan (consumer of this account): `E:\PBL6\dut_curriculum_app\docs\implementation\f-28-ddut-replica-curriculum-app-implementation-plan.md`
> - Web sibling of the screens the account feeds: [F-20 student portal plan](f-20-student-portal-implementation-plan.md)
> - Pattern mirrored: `source/backend/prisma/demo-account.ts`
> - Scope decision to record: `docs/requirement/REQUIREMENTS.md` §12 item 7 and `docs/requirement/plan.md` Q14/M9 (mobile app now in scope as a standalone demo client)

**Status**: Implemented — 2026-11-01; S-01, S-02, S-03 hoàn tất, kiểm tra tĩnh đạt; kiểm tra CSDL/API do người vận hành chạy sau.

## 0. Plan at a glance

Everything below in one table. Read this; the rest is detail for whoever builds it.

| What | Why | How and where |
|---|---|---|
| **A student login `demo.sinhvien` that sees a real curriculum** | The mobile demo needs a student whose portal, eligibility and graduation screens are populated; real students' data must not be shown | `prisma/demo-student.ts`, run with `pnpm db:demo-student`; mirrors `prisma/demo-account.ts` (S-01, S-02) |
| **Student role with no manual role assignment** | The student role is derived from `Student.userId`; linking the user to a `Student` row is enough | User upsert + `Student.userId` link (S-01) |
| **Enrolled in a real program, cohort and applied version** | Portal, eligibility and graduation all resolve through `ProgramEnrollment`; copying a real enrolment's IDs guarantees they resolve | Copy IDs (never personal fields) from a template ACTIVE PRIMARY enrolment chosen by env or by a default rule (S-01) |
| **Synthetic results for terms already started** | Progress, "Đã đạt/Chưa đạt/Đang học" states, prerequisites and the graduation shortfall list need results | Deterministic generator: passed required items in past terms, one failed, latest started term in progress, electives untouched (S-01) |
| **Safe to re-run; survives `db:demo-curate`** | The demo site is rebuilt and curated repeatedly | Delete-and-recreate the demo student's enrolment and results in one transaction; username and student code avoid curate's hex/`e2e.` patterns (S-01) |
| **Docs record that a mobile client is now in scope** | REQUIREMENTS §12 item 7 says a standalone mobile app is out of scope | Amend REQUIREMENTS §12 and plan.md Q14/M9 (S-03) |

**Key behaviours worth knowing**

| Behaviour | Why it is this way |
|---|---|
| Re-running replaces the demo student's enrolment and every result | Deterministic state is what a demo needs; nothing else references these rows unless someone saved a graduation audit for the demo student, in which case the run stops with a clear message |
| The account bypasses the password policy (`demo`/`demo` default) | Same choice as `demo-account.ts`: public, short, typed on a phone |
| The chosen program can differ between databases | Default selection reads what exists; the script logs the program, cohort and version it used |
| Scores are synthetic and labelled so in the student's name | "Sinh viên Demo" makes the account unmistakable on screen |

**Not included**

| Excluded | Why |
|---|---|
| Linking the account to a real student | Real records are personal data (memory rule; F-17 C2 unanswered) |
| Second-major enrolment | One PRIMARY enrolment is enough to demo the switch's empty state; can be added by env later |
| Running the script on the demo VM | Deploy is the user's call; §7 gives the one-line command |

**Open questions**

| Question | Resolved when | Default if unanswered |
|---|---|---|
| Which program should the demo student follow? | User names a program code | Default rule in D2 (CNTT program if present, else the most populated cohort with ≥ 4 started terms) |

## 1. Scope

| In scope | Why |
|---|---|
| `prisma/demo-student.ts` + `db:demo-student` script | The only backend need of F-28 |
| REQUIREMENTS / plan.md amendment | Recorded scope change |
| Docs sync (progress_log, current_work, operations note) | Rule 4 |

| Out of scope | Deferred until |
|---|---|
| Any `src/` change (CORS, token auth, new endpoint) | Not needed — native clients send cookies and the CSRF header directly (§2a) |
| Unit/e2e test for the script | Scripts in `prisma/` have no test harness (`demo-account.ts` has none); verified by running it |

| Requirement | Covered by |
|---|---|
| Demo student can log in and `GET /api/portal/me` returns ≥ 1 program | S-01, S-02 |
| Progress / eligibility / graduation return data, not `PORTAL_NO_STUDENT` | S-01 |
| Scope change documented | S-03 |

## 2. Contract verification

### 2a. What the script writes into and what reads it

| Target | Verified at | Fact the script relies on |
|---|---|---|
| Student role derivation | `src/shared/authz/scope-source.reader.ts:41`, `src/shared/authz/scope.service.ts:80` | Self-scoped student role reaches its record only through `Student.userId`; no `RoleAssignment` row is needed |
| R6 permissions | `prisma/seed-data/permission-catalog.ts:324,331,338` | `student.viewProgress`, `student.viewRegistrationEligibility`, `graduation.view` all granted to R6 |
| Self read check | `src/shared/students/student-access.ts:197-222` | Passes when `student.userId === access.userId` |
| Portal `me` | `src/features/student-portal/student-portal.service.ts:106` | Empty programs when no linked student or no started semester; unresolvable versions dropped |
| Login | `src/features/auth/auth.controller.ts:48-59`, `src/shared/password/password-policy.ts:4` | `username` ≤ 64 chars, normalized; password only length-checked at login |
| Demo curate | `prisma/demo-curate.ts:6,60` | Deletes roots whose `*Code` holds 16 hex digits, hex usernames, `e2e.` usernames |
| Enrolment uniqueness | `prisma/migrations/20261027165710_student_records_results/migration.sql:196-199` | One ACTIVE enrolment per (student, program); one ACTIVE PRIMARY per student |
| Result uniqueness | `prisma/schema.prisma:1240-1260` | `@@unique([studentId, courseId, semesterId])`; `score10 Decimal(4,2)`, `score4 Decimal(3,2)` |

### 2b. Rows written

`User` (`prisma/schema.prisma:207`)

| Field | Value | Note |
|---|---|---|
| `username` | `normalizeUsername(DEMO_STUDENT_USERNAME ?? 'demo.sinhvien')` | not hex, not `e2e.` |
| `userCode` | `DEMO_SV` | `@unique` |
| `fullName` | `Sinh viên Demo` | |
| `email` | `demo.sinhvien@example.com` | RFC 2606 reserved domain; nullable column |
| `passwordHash` | `PasswordService.hash(DEMO_STUDENT_PASSWORD ?? 'demo')` | |
| `mustChangePassword` | `false` | |
| `status` | `UserStatus.ACTIVE` | |
| `orgUnitId` | `null` | students carry none |

`Student` (`prisma/schema.prisma:1179`): `studentCode = 'DEMOSV001'`, `fullName = 'Sinh viên Demo'`, `cohortId`/`admissionSemesterId`/`statusSemesterId`/`major` copied from the template student, `status = STUDYING`, `dataSource = EXCEL`, `userId = user.id`.

`ProgramEnrollment` (`prisma/schema.prisma:1205`): `programId`, `cohortId`, `appliedVersionId`, `admissionVersionId`, `cohortAssignmentId`, `fromSemesterId` copied from the template enrolment; `enrollmentType = PRIMARY`, `isException = false`, `status = ACTIVE`, `untilSemesterId = null`, `createdById = null`.

`AcademicResult` (`prisma/schema.prisma:1240`): one row per generated result, `dataSource = EXCEL`, `revision = 1`.

### 2c. Mismatch log

| Deliverable | What the plan said | What the source does | Found at |
|---|---|---|---|

## 3. Decisions

- **D1 — Synthetic student, copied IDs only.** Why: shows real curriculum data while no personal value of a real student is read into the new rows. Rejected: linking `demo.sinhvien` to a real `Student` (exposes a real transcript).
- **D2 — Template selection.** Env `DEMO_STUDENT_PROGRAM_CODE` / `DEMO_STUDENT_COHORT_CODE` pick the template enrolment. Default: among ACTIVE PRIMARY non-exception enrolments whose `fromSemester` has started and that have ≥ 4 started regular terms, prefer program codes containing `CNTT`, then the cohort with the most students, tie-break by `programCode`, `cohortCode`. Why: a mid-course student shows every state at once. Rejected: hard-coding a program ID (differs between databases).
- **D3 — Term mapping.** `plannedSemester k` maps to the k-th semester, ordered by `startDate`, with `startDate` not null and `termInYear ∈ {1, 2}`, starting at the enrolment's `fromSemester`. Why: matches how the portal orders terms; summer terms are not curriculum terms. Build-time check in S-01 Verify confirms `termInYear` values in `ctdt_real`.
- **D4 — Result generation.** For required items (`isElective = false`) with mapped term started before today: PASSED with a deterministic score; exactly one item in the earliest started term gets FAILED (score10 3.5); items in the latest started term get IN_PROGRESS (no scores). Electives and future terms get no row (portal shows NOT_TAKEN). Scores come from a fixed list cycled by item index (no `Math.random`). Why: deterministic, every course state and the graduation shortfall list appear.
- **D5 — Grade conversion table local to the script.** DUT scale: A ≥ 8.5 → 4.0; B+ ≥ 8.0 → 3.5; B ≥ 7.0 → 3.0; C+ ≥ 6.5 → 2.5; C ≥ 5.5 → 2.0; D+ ≥ 5.0 → 1.5; D ≥ 4.0 → 1.0; F → 0. Why: no backend converter exists; the table is synthetic display data only. Rejected: importing an F-17 parser (it reads given values, it does not convert).
- **D6 — Delete-and-recreate in one transaction.** Existing demo student's results and enrolments are deleted, then recreated. A foreign-key failure (e.g. a saved graduation audit) aborts with a Vietnamese message naming the cause. Why: deterministic demo state. Rejected: upsert-and-diff (more code, same outcome).

## 5. Deliverables

### S-01 — `prisma/demo-student.ts`

What/Why: creates or refreshes the synthetic demo student (D1–D6).

**Files**: `source/backend/prisma/demo-student.ts` NEW

**Shape**

```ts
// Public demo only: creates or refreshes the synthetic student `demo.sinhvien` for the mobile app demo.
//   DATABASE_URL=... pnpm db:demo-student
//   DEMO_STUDENT_USERNAME / DEMO_STUDENT_PASSWORD override "demo.sinhvien"/"demo";
//   DEMO_STUDENT_PROGRAM_CODE / DEMO_STUDENT_COHORT_CODE pick the program and cohort to copy.
// Copies only IDs from a real enrolment; every personal value and every score is synthetic.
// Re-running replaces the demo student's enrolment and results. Never run it against a database real users depend on.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AcademicResultStatus,
  EnrollmentStatus,
  EnrollmentType,
  Prisma,
  PrismaClient,
  StudentDataSource,
  StudentStatus,
  UserStatus,
} from '../src/generated/prisma/client.js';
import { normalizeUsername } from '../src/shared/auth/username.js';
import { PasswordService } from '../src/shared/password/password.service.js';
import { todayDate } from '../src/shared/time/today.js';

const username = normalizeUsername(process.env.DEMO_STUDENT_USERNAME ?? 'demo.sinhvien');
const password = process.env.DEMO_STUDENT_PASSWORD ?? 'demo';
const DEMO_USER_CODE = 'DEMO_SV';
const DEMO_STUDENT_CODE = 'DEMOSV001';
const DEMO_FULL_NAME = 'Sinh viên Demo';
const DEMO_EMAIL = 'demo.sinhvien@example.com';
const PREFERRED_PROGRAM_HINT = 'CNTT';
const MIN_STARTED_TERMS = 4;
const REGULAR_TERMS = [1, 2];
const FAILED_SCORE10 = 3.5;
const PASS_SCORES10 = [8.7, 7.4, 6.8, 9.1, 5.9, 7.9, 8.2, 6.3, 7.1, 5.2];
// DUT ten-point to letter/four-point scale.
const GRADE_SCALE = [
  { min: 8.5, letter: 'A', score4: 4 },
  { min: 8.0, letter: 'B+', score4: 3.5 },
  { min: 7.0, letter: 'B', score4: 3 },
  { min: 6.5, letter: 'C+', score4: 2.5 },
  { min: 5.5, letter: 'C', score4: 2 },
  { min: 5.0, letter: 'D+', score4: 1.5 },
  { min: 4.0, letter: 'D', score4: 1 },
  { min: 0, letter: 'F', score4: 0 },
] as const;

function grade(score10: number) { /* first GRADE_SCALE row with score10 >= min */ }

async function pickTemplate(prisma: PrismaClient, today: Date) {
  // env codes → filter; else D2 default rule. Returns { enrollment, student } (IDs only used).
  // Throws a Vietnamese message listing available program codes when nothing matches.
}

async function regularTerms(prisma: PrismaClient, fromSemesterId: string) {
  // Semesters with startDate not null, termInYear in REGULAR_TERMS, startDate >= fromSemester.startDate,
  // ordered by startDate; index 0 = planned semester 1.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const today = todayDate();
  const template = await pickTemplate(prisma, today);
  const terms = await regularTerms(prisma, template.enrollment.fromSemesterId);
  const started = terms.filter((term) => term.startDate! <= today);
  const items = await prisma.curriculumItem.findMany({
    where: { versionId: template.enrollment.appliedVersionId, isElective: false },
    orderBy: [{ plannedSemester: 'asc' }, { id: 'asc' }],
    select: { id: true, courseId: true, plannedSemester: true },
  });
  const passwordHash = await new PasswordService().hash(password);

  await prisma.$transaction(async (tx) => {
    const account = { fullName: DEMO_FULL_NAME, email: DEMO_EMAIL, passwordHash,
      mustChangePassword: false, status: UserStatus.ACTIVE, orgUnitId: null };
    const user = await tx.user.upsert({ where: { username },
      create: { username, userCode: DEMO_USER_CODE, ...account }, update: account });
    const studentData = { fullName: DEMO_FULL_NAME, cohortId: template.student.cohortId,
      admissionSemesterId: template.student.admissionSemesterId,
      statusSemesterId: template.student.statusSemesterId, major: template.student.major,
      status: StudentStatus.STUDYING, dataSource: StudentDataSource.EXCEL, userId: user.id };
    const student = await tx.student.upsert({ where: { studentCode: DEMO_STUDENT_CODE },
      create: { studentCode: DEMO_STUDENT_CODE, ...studentData }, update: studentData });
    await tx.academicResult.deleteMany({ where: { studentId: student.id } });
    await tx.programEnrollment.deleteMany({ where: { studentId: student.id } });
    await tx.programEnrollment.create({ data: { studentId: student.id, /* copied IDs per §2b */
      enrollmentType: EnrollmentType.PRIMARY, isException: false, status: EnrollmentStatus.ACTIVE } });
    await tx.academicResult.createMany({ data: buildResults(student.id, items, started) });
  });
  console.log(`Sinh viên demo "${username}": ${programCode} / khóa ${cohortCode} / phiên bản ${versionNumber}; ${n} kết quả.`);
} catch (error) {
  // Prisma P2003 (FK) → explain that a saved graduation audit or result change references the demo student.
  throw error;
} finally {
  await prisma.$disconnect();
}
```

`buildResults` (same file): for each required item whose `plannedSemester - 1 < started.length`, the term is `started[plannedSemester - 1]`; latest started term → IN_PROGRESS with null scores; first item of `started[0]` → FAILED with `FAILED_SCORE10`; others → PASSED with `PASS_SCORES10[index % length]` and `grade()`. Decimals written as `new Prisma.Decimal(value)`.

**Rationale**: mirrors `prisma/demo-account.ts` (dotenv, `PrismaPg` adapter, `normalizeUsername`, `PasswordService`, `todayDate`, Vietnamese console line, `finally` disconnect).

**Gotchas**
- Never select `fullName`, `studentCode` or any personal field of the template student beyond the four IDs/`major` listed in §2b (memory rule: real DUT data).
- `ProgramEnrollment_one_active_primary` — delete before create, inside the transaction.
- A curriculum item whose course already has a result row for the same semester cannot exist here (all rows deleted first), so `createMany` has no unique conflict.
- `DEMO_SV` / `DEMOSV001` contain no 16-hex run, so `demo-curate.ts` leaves them.
- Interactive transaction timeout: default 5 s is enough for ~60 items; pass `{ timeout: 30_000 }` if the build sees P2028.

**Verify**
1. `pnpm exec tsc --noEmit -p tsconfig.json` → 0 errors (the `prisma/` folder is in the project).
2. Read-only check of D3 before the first run: `SELECT DISTINCT "termInYear" FROM "Semester" WHERE "startDate" IS NOT NULL;` → confirms `{1,2}` regular terms (plus 3 if summer exists).
3. `pnpm db:demo-student` against local `ctdt_real` → console line with program/cohort/version and result count > 0.
4. Run it twice → same counts, no error.
5. Log in: `curl -c c.txt -H "x-requested-with: XMLHttpRequest" -H "content-type: application/json" -d "{\"username\":\"demo.sinhvien\",\"password\":\"demo\"}" http://localhost:3000/api/auth/login` then `curl -b c.txt -H "x-requested-with: XMLHttpRequest" http://localhost:3000/api/portal/me` → `student` not null, `programs.length ≥ 1`.
6. With that cookie, `GET /api/students/<id>/graduation?programId&semesterId` and `/registration-eligibility` → 200.

**Depends on**: —

### S-02 — `db:demo-student` script

**Files**: `source/backend/package.json` MODIFY

**Shape**: add `"db:demo-student": "tsx prisma/demo-student.ts"` after `"db:demo-syllabi"`.

**Rationale**: mirrors `"db:demo-account": "tsx prisma/demo-account.ts"` (`package.json:36`).

**Verify**: `pnpm db:demo-student` resolves the script.

**Depends on**: S-01

### S-03 — Scope documentation

**Files**: `docs/requirement/REQUIREMENTS.md` MODIFY (§12 item 7); `docs/requirement/plan.md` MODIFY (Q14, M9); `docs/operations/demo-oracle-free.md` MODIFY (add the demo student command); `docs/progress/progress_log.md`, `docs/progress/current_work.md`, `docs/progress/todo.md` MODIFY.

**Shape** (Vietnamese): §12 item 7 becomes "Ứng dụng di động độc lập mô phỏng dDUT (F-28) chỉ dùng cho trình diễn, tiêu thụ API hiện có bằng phiên cookie; không thay thế ứng dụng dDUT của Trường." Q14/M9 note the same and that the app lives in its own repo `dut_curriculum_app`.

**Verify**: the three files mention F-28 and the separate repo; no other requirement row changes.

**Depends on**: —

## 6. Sequencing

```
S-01 → S-02 → (pause: run Verify 3–6 on local ctdt_real) → S-03
```

Pause point after S-02: the app plan's networking deliverables need this account to exist.

## 7. Verification strategy

- Build gate: backend `tsc --noEmit` + `oxlint` (build-verifier). No unit/e2e (no harness for `prisma/` scripts).
- Manual: S-01 Verify 3–6 locally. On the demo VM the user runs, inside the backend container: `pnpm db:demo-student` (deploy is the user's decision).

## 8. Risks and open items

| Risk | Impact | Mitigation |
|---|---|---|
| Default rule picks a program with sparse syllabi | Syllabus screens show "chưa ban hành" | Set `DEMO_STUDENT_PROGRAM_CODE`; `db:demo-syllabi` publishes demo syllabi |
| Graduation returns `CANNOT_AUDIT` (C4 inputs missing for the program) | Graduation/progress screens show the diagnostic instead of figures | App shows `error.message` (same as web); choose another program via env |
| Someone saves a graduation audit for the demo student | Re-run aborts on FK | Clear message; staff delete the audit or skip re-run |
| `ctdt_real` rebuild (`db:rebuild:real`) wipes the account | Demo login fails | Re-run `db:demo-student` after every rebuild; note added in S-03 |
