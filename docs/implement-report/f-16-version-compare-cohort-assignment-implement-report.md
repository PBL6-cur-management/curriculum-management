# F-16 So sánh phiên bản và phân bổ khóa — Implement Report

Kế hoạch: `docs/implementation/f-16-version-compare-cohort-assignment-implementation-plan.md`. Ngày 2026-10-26: BE-01..BE-07 đã được orchestrator kiểm chứng; FE-01 do orchestrator sinh; lượt tiếp theo dựng FE-02..FE-06, test-case doc và Playwright. DOC-01 chưa thực hiện. Người dùng đã chấp thuận toàn bộ quyết định/default §8 và miễn các pause P1..P3.

## Status

| Mục | Trạng thái |
|---|---|
| Tiến độ | In progress — BE done, FE-01..FE-06 built, browser walk pending |
| Phạm vi | Lượt BE trước và lượt FE tiếp theo tách biệt; lượt FE chỉ sửa frontend, spec/fixture F-16, plan/report/TC/index được giao; không sửa backend, generated schema hoặc F-09 |
| Schema, seed, dependency | Không migration, Prisma CLI, seed quyền, package, lockfile, queue hoặc runtime dependency mới |
| Kiểm chứng | Backend đã đạt 131 files / 1134 tests; frontend tsc/oxlint/source Prettier exit 0, 15 files / 81 tests; e2e typecheck/spec-format exit 0. Check bổ sung bốn Markdown còn warning căn bảng, xem bàn giao FE |
| E2E | Orchestrator xác nhận releases, corrections, permission-table, users đạt; version-comparison và cohort-versions đạt 18/18 sau hai incident fixture bên dưới. Playwright F-16 đã viết, chưa chạy |
| Ranh giới | Giữ nguyên production F-13 và publisher/correction/activation F-15. U1/F-17 và U2/F-12 không dựng, không stub |

| Deliverable | Đã dựng | Kiểm chứng |
|---|---|---|
| BE-01 | DTO so sánh/phân bổ, vocabulary, giới hạn/hash và chín lỗi miền dùng lại lỗi F-15 | Hai DTO specs: opaque IDs, query bắt buộc, list rỗng/trùng/quá giới hạn, hash, whitelist PATCH |
| BE-02 | Reader strict cho ảnh chụp ban hành, tám loại entry/natural key, presenter sáu nhóm và pin links | Reader/presenter specs: facts đóng băng, decimal, null/rỗng, copy IDs, thêm/bớt/sửa, pins-only, nhóm rỗng |
| BE-03 | Hai GET so sánh với giao dịch RepeatableRead và kiểm PROGRAM_VIEW/VERSION_COMPARE; drill-down kiểm SYLLABUS_VIEW | Service spec: scope, context, derive pin, ba nhóm syllabus và read-only; HTTP chờ orchestrator |
| BE-04 | AppliedProgramVersionReader và facts dùng chung; bulk/tx, chronology/tie, normalize timeline, schedule/calendar revision | Hai shared specs: PENDING/HISTORICAL, không ACTIVE fallback, malformed/missing, deterministic hash, tx độc quyền |
| BE-05 | List/POST/PATCH/diagnostic; Program lock + Serializable; stale revision, pair/start conflicts, rollback; mapper tường minh | Hai service/mapper specs: lỗi, quyền/scope, batch, PATCH chỉ semester, no-op, P2002/P2034 |
| BE-06 | Đăng ký hai controllers/two services; export AppliedProgramVersionReader; sáu rows quyền và counter mapping | Type-check; quyền seed đối chiếu trực tiếp; discover/OpenAPI và permission harness chưa chạy |
| BE-07 | Hai suite HTTP/Testcontainers, hai fixtures release thật, regression release/correction | Type-check toàn bộ test; Testcontainers chưa chạy, không nhận là DB/concurrency đã đạt |

## BE-01 — DTO và lỗi miền

- **Rule 13**: đọc `src/shared/change-requests/diff/change-diff.dto.ts:3`, `src/shared/releases/release.errors.ts:4`, `src/features/releases/dto/release-version.dto.ts:18`, `src/shared/releases/semester.dto.ts:5`, `src/features/releases/dto/version-detail.dto.ts:49`, `src/app.setup.ts:30`. Các path `src/` trong báo cáo này tính từ `source/backend/`.
- Giữ literal ADDED/REMOVED/CHANGED và base DiffRowDto, dùng các DTO Semester/Cohort/SyllabusPin đã có. ID là chuỗi opaque; không đổi sang UUID. Global validation tiếp tục reject thuộc tính thừa.
- **Decision during build**: constants và errors riêng của F-16; không kéo DTO của feature vào shared facts. Các header chỉ mô tả phiên bản issued, không dùng status làm entitlement.
- **Deviation**: không có thay đổi wire contract so với §2/BE-01; cập nhật vị trí source trong kế hoạch thay cho nhãn NEW/UNVERIFIED của backend đã dựng.

## BE-02 — So sánh ảnh chụp ban hành

- **Rule 13**: đọc `src/shared/change-requests/diff/program-snapshot.reader.ts:20`, `src/shared/change-requests/diff/snapshot-differ.ts:40`, `src/shared/change-requests/diff/diff-presenter.ts:61`, `src/shared/change-requests/diff/snapshot-scalar.ts:8`, `src/shared/syllabi/revision-for-items.ts:29`. Reader F-13 dùng tên live và không có frozen credits/pins; fallback của detail không phù hợp với phép so sánh strict.
- Reader mới dùng tên/tín chỉ frozen, version-owned requisites, PLO, hai tầng mapping và pin theo courseCode; JSON tuple cho key nhiều thành phần. Không đọc ChangeItem hoặc replay lineage; không sửa reader/presenter F-13.
- Gồm sáu section kể cả rỗng; thêm/bớt/sửa theo natural key, nhãn tiếng Việt, decimal chuỗi, pin link chỉ khi cả hai phía có course và pin khác nhau. Status/timestamp/decision/cohort không phải nội dung học thuật.
- **Decision during build**: query snapshot chỉ chọn metadata pin, không đọc text syllabus trước kiểm scope của drill-down. Chỉ các trường info được liệt kê tường minh mới đi vào snapshot.
- **Deviation**: không; không hứa so sánh assessment chưa tồn tại của F-12.

## BE-03 — API so sánh có scope

- **Rule 13**: đọc `src/features/releases/version-history.controller.ts:10`, `src/features/releases/version-history.reader.ts:117`, `src/shared/authz/permission.guard.ts:34`, `src/shared/courses/course-target.ts:4`, `src/shared/change-requests/diff/syllabus-snapshot.reader.ts:13`. Decorator nhiều quyền là OR nên service kiểm hai quyền riêng biệt trước đọc nội dung.
- Mỗi operation dùng một RepeatableRead transaction; version phải thuộc đúng program, issued đầy đủ. Course và hai pin do backend derive; không nhận syllabus ID từ caller. Trước text, kiểm course scope cho SYLLABUS_VIEW; metadata và text được đọc với query count cố định, không query theo từng curriculum row.
- Drill-down dùng reader syllabus F-13 không đổi; trả đủ SYLLABUS_FIELD/WEEKLY_CONTENTS/CLO, kể cả hai pin cùng ID hoặc hai revision có text giống nhau.
- **Deviation**: không đổi helper/export của feature cũ; giữ private scopedProgram trong service mới như kế hoạch.

## BE-04 — Resolver dùng chung và revision

- **Rule 13**: đọc `src/shared/releases/semester-start.ts:11`, `src/shared/outcomes/outcome-gaps.reader.ts:10`, `src/shared/releases/version.activator.spec.ts:1`, `prisma/schema.prisma:470`, `prisma/schema.prisma:480`, `src/features/releases/corrections.service.ts:143`, `src/features/semesters/semesters.service.ts:87`.
- Semester startDate hiện hành là chronology duy nhất; không parse academicYear/cohortCode/versionNumber và không dùng ngày chạy hay Program.currentVersion. Chọn from-start mới nhất không sau semester yêu cầu, rồi createdAt desc và ID codepoint desc.
- forCohorts deduplicate giữ thứ tự input, kiểm thiếu IDs theo batch; một lần đọc timeline theo program/cohorts. Nếu được truyền tx thì không mở giao dịch con/đọc default client. UNASSIGNED là null có chủ ý; timeline malformed/null date ném lỗi thay vì bỏ qua.
- SHA-256 canonical hóa tất cả link của program và tất cả calendar IDs/start dates, kể cả null; không chứa lifecycle status. Revision là concurrency token, không phải authorization/signature.
- **Deviation**: F-09 đã đẩy vị trí schema sang 470/480/490; semantics pair uniqueness và createdAt không đổi. Kế hoạch §2c đã sửa citation. E1/E3 là accepted administrative retroactivity, không phải công việc history/freeze bị lén bổ sung.

## BE-05 — Phân bổ khóa nguyên tử

- **Rule 13**: đọc `src/features/releases/releases.service.ts:75`, `src/features/releases/corrections.service.ts:95`, `src/shared/releases/release-locks.ts:5`, `src/shared/releases/release-locks.ts:32`, `src/shared/authz/edit-path.ts:66`, `src/shared/releases/semester.dto.ts:30`.
- School-wide DIRECT VERSION_ASSIGN_COHORT và PROGRAM_VIEW scope bắt buộc. POST/PATCH lock Program, reauthorize/re-read trong Serializable với timeout/maxWait hiện hữu, kiểm expectedRevision, issued facts/date/cohorts trước ghi.
- POST chỉ một createMany, không skipDuplicates. PATCH chỉ đổi fromSemesterId, giữ cohort/version/createdAt; cùng semester là no-op. Không delete/replace ngầm; lỗi P2002 → COHORT_VERSION_EXISTS, P2034 → ASSIGNMENT_STATE_CHANGED, lỗi DB khác giữ nguyên.
- **Deviation**: toCohortDto yêu cầu full Prisma Cohort trong khi fact cố ý chỉ có ba trường. Mapper mới chọn tường minh id/cohortCode/intakeYear; không nới chữ ký exported của helper cũ, không bịa timestamp để gọi helper. §2c đã ghi mismatch này.
- Không student count/chuyển enrollment/exception/decision store. Quyết định ban hành có sẵn là evidence theo E2; tác động quá khứ của PATCH hiển thị/xác nhận ở FE-05, chưa dựng trong lượt backend.

## BE-06 — Wiring và bảng quyền

- **Rule 13**: đọc `src/features/releases/releases.module.ts:18`, `src/shared/releases/releases-shared.module.ts:1`, `src/app.module.ts:58`, `prisma/seed-data/permission-catalog.ts:166`, `prisma/seed-data/permission-catalog.ts:271`, `src/shared/authz/scope.service.ts:70`, `test/fixtures/accounts.ts:44`, `test/permission-table.e2e-spec.ts:123`.
- Không sửa AppModule vì ReleasesModule đã nối; giữ toàn bộ BullMQ registration có sẵn. Chỉ thêm provider/exports và hai controller/service mới.
- **Deviation**: counter `/api/programs` hiện còn đếm director assignments; thêm nhánh cohort trước nhánh đó, không thay logic cũ. Harness dùng placeholder và chỉ bảo đảm allowed không 403; success/rollback thật nằm ở hai suite F-16. Các account ngoài R1 trong fixture mới dùng UNIT, không vô tình nhận SYSTEM scope.

| Route (prefix /api) | Permission | PERMISSION_TABLE | Allowed / denied |
|---|---|---|---|
| GET /programs/:programId/version-comparison | VERSION_COMPARE | `test/permission-table.ts:19` | R1 / R6 |
| GET /programs/:programId/version-comparison/syllabi/:courseId | VERSION_COMPARE | `test/permission-table.ts:26` | R1 / R6 |
| GET /programs/:programId/cohort-versions | VERSION_ASSIGN_COHORT | `test/permission-table.ts:33` | R1 / R2 |
| POST /programs/:programId/cohort-versions | VERSION_ASSIGN_COHORT | `test/permission-table.ts:40` | R1 / R3 |
| PATCH /programs/:programId/cohort-versions/:assignmentId | VERSION_ASSIGN_COHORT | `test/permission-table.ts:53` | R1 / R4 |
| GET /programs/:programId/cohorts/:cohortId/applied-version | VERSION_ASSIGN_COHORT | `test/permission-table.ts:61` | R1 / R5 |

## BE-07 — HTTP, dữ liệu tổng hợp và regression

- **Rule 13**: đọc `test/fixtures/releases.ts:124`, `test/fixtures/change-requests.ts:152`, `test/releases.e2e-spec.ts:29`, `test/corrections.e2e-spec.ts:223`, `test/corrections.e2e-spec.ts:325`, `test/imports.e2e-spec.ts:1`, `test/users.e2e-spec.ts:140` và fixture accounts/scope. Không dùng helper correction mặc định moveCohorts=true để tuyên bố khóa được giữ nguyên.
- Fixtures tạo Draft tổng hợp, release đầu bằng releaseViaApi với một khóa được chọn và một khóa có sẵn không được chọn; hai phiên bản tiếp qua request CURRICULUM/SYLLABUS_CONTENT, submit/final-approve thật với R1 khác người tạo và không chọn khóa. Suite kiểm khóa cũ vẫn giữ version nhập học, khóa không được chọn không tự nhận version. Không update immutable released rows để dựng diff. Các thay đổi group/PLO/tuần/CLO trực tiếp chỉ nằm trong Draft/request copy tổng hợp, không phải dữ liệu ban hành.
- Suite comparison: non-adjacent, sáu nhóm, pins-only, same-version, syllabus text/weeks/CLO, scope/quyền/ownership, wrong IDs, working/correction drafts, read-only counts/timestamps, origin/history/frozen rows. Chỉnh live catalog sau release chỉ để chứng minh freeze.
- Suite cohort: program `1024034`, K2023/K2024/K2025 và calendar tổng hợp; batch rollback, pair/start conflicts, PATCH/no-op/ownership, unknown dates, calendar revision, hai admin cùng revision, CSRF/quyền + so sánh toàn bộ mapping, cross-program isolation, legacy tie, malformed timeline, activation và concurrent correction locking.
- Chỉ integrity test tạo link legacy/malformed mà API mới cố ý không thể tạo; dọn link malformed trong DB Testcontainers riêng. Hai regression F-15 xác nhận correction true giữ nguyên ID/fromSemesterId/createdAt nhưng đổi version retroactively; false giữ nguyên toàn bộ mapping. Release không chọn khóa không thêm mapping.
- **Decision during build**: dùng fixture release thật, allowPastSemester tường minh cho release giữa trong quá khứ; seedApprovalLevels chỉ ở setup DB test, không đổi seed catalog.
- **Deviation**: không có thay đổi §3/§8; E4 vẫn chỉ là fixture tổng hợp, không phải chứng nhận chương trình thực của Khoa. Không chạy Docker/e2e trong sandbox theo chỉ định.

### Incident — fixture vi phạm CHECK của WeeklyContent (2026-10-26)

- **Phát hiện**: orchestrator chạy Testcontainers; releases, corrections, permission-table và users đạt, nhưng hai suite F-16 lỗi setup, 18 test chưa chạy. `test/fixtures/version-comparison.ts:94` tạo WeeklyContent với sortOrder=0, vi phạm `WeeklyContent_order_positive` trong `prisma/migrations/20261019095730_syllabi/migration.sql:88` (sortOrder >= 1). Type-check và unit test không thay thế kiểm chứng constraint PostgreSQL.
- **Sửa test-only**: đổi sortOrder thành 1 tại `test/fixtures/version-comparison.ts:98`; không sửa migration, production, seed hoặc dữ liệu ban hành.
- **Rà soát**: đối chiếu mọi direct Prisma write trong bốn file được giao với CREATE TABLE, CHECK, UNIQUE và ALTER TABLE của toàn bộ migrations; kiểm thêm default cuid2, timestamp và updatedAt của Prisma cho trường bắt buộc không truyền tường minh. Không phát hiện vi phạm SQL nào khác.

| Bảng | Vị trí direct write (trong test/) | Constraint và kết luận |
|---|---|---|
| WeeklyContent | fixtures/version-comparison.ts:94, :192 | CHECK order_positive: đã sửa 0 thành 1; NOT NULL id/syllabusId/weekLabel/sortOrder/content đầy đủ qua data hoặc cuid2. Update chỉ đổi content không null; không có UNIQUE ngoài PK. |
| ElectiveGroup | fixtures/version-comparison.ts:66, :136 | CHECK has_minimum đạt (minCredits=3, minCourses=1); UNIQUE versionId/groupCode đạt (G1 trong Draft mới); NOT NULL id/versionId/groupCode/groupName/createdAt/updatedAt đủ qua data/default Prisma. Update chỉ đổi groupName không null. |
| CurriculumItem | fixtures/version-comparison.ts:75 | CHECK group_needs_elective đạt vì item được tạo isElective=true; semester_positive/sort_positive và UNIQUE versionId/courseId không đổi; NOT NULL giữ nguyên, updatedAt do Prisma quản lý. |
| PLO | fixtures/version-comparison.ts:143 | Description không null; UNIQUE versionId/ploCode và các NOT NULL khác giữ nguyên; không có CHECK cho bảng này. |
| CLO | fixtures/version-comparison.ts:196 | Description không null; UNIQUE syllabusId/cloCode và các NOT NULL khác giữ nguyên; không có CHECK cho bảng này. |
| Course | version-comparison.e2e-spec.ts:133 | CourseName không null, credits=4; UNIQUE courseCode và các NOT NULL khác giữ nguyên; không có CHECK cho bảng này. |
| Role | version-comparison.e2e-spec.ts:308 | UNIQUE roleCode đạt (CMP_SCOPED được tạo một lần trong DB riêng); NOT NULL id/roleCode/roleName/isSystemRole/scopeSource/createdAt/updatedAt đủ qua data/default Prisma; không có CHECK. |
| RolePermission | version-comparison.e2e-spec.ts:314, :333 | Nested create: ba permission khác nhau trên role mới, UNIQUE roleId/permissionId đạt; NOT NULL id/roleId/permissionId/mode/scope/createdAt/updatedAt đủ qua nested relation/data/default Prisma. Update chỉ đổi scope sang ALL; không có CHECK. |
| Cohort | cohort-versions.e2e-spec.ts:123 | UNIQUE cohortCode đạt: K2023/K2024/K2025 khác nhau và không trùng prefix CMP hoặc K-TEST trong DB riêng; NOT NULL id/cohortCode/intakeYear/createdAt/updatedAt đủ; không có CHECK. |
| CohortVersion | cohort-versions.e2e-spec.ts:518, :536, :550 | UNIQUE cohortId/programVersionId đạt: hai version khác nhau cho cohort mới và một cohort mới riêng cho malformed link; NOT NULL id/cohortId/programVersionId/fromSemesterId/createdAt đủ qua data/default. Delete chỉ dọn malformed link. Không có CHECK về chronology hoặc UNIQUE theo fromSemesterId/createdAt. |

- `test/fixtures/cohort-versions.ts` chỉ gọi HTTP, không có direct Prisma write. Mọi PK mới dùng cuid2 do Prisma sinh; update không đổi PK. Các FK dùng record đã tạo hoặc permission đã seed, không tạo reference giả.
- **Borderline**: giữ nguyên legacy tie (cùng fromSemesterId/createdAt, khác version) và malformed chronology để kiểm resolver; đây là dữ liệu integrity cố ý mà SQL hiện tại cho phép, không phải lỗi constraint cần sửa.
- **Kiểm chứng sau sửa**: `pnpm exec tsc --noEmit -p tsconfig.json` và `pnpm exec oxlint test` đều exit 0, không có output; `pnpm exec prettier --check test` exit 0, output: Checking formatting... / All matched files use Prettier code style! Không chạy Docker, Prisma CLI hoặc e2e trong sandbox. Orchestrator cần chạy lại hai suite để xác nhận setup và 18 test thực sự đạt; chưa tuyên bố e2e xanh.

### Incident — ngưỡng điểm requisites và chẩn đoán HTTP setup (2026-10-26)

- **Phát hiện tiếp theo từ orchestrator**: sau sửa sortOrder, cả hai suite vẫn dừng ở setup, 18 test chưa chạy. PUT requisites của working copy trả 400 nhưng Supertest không in body.
- **Nguyên nhân xác định từ source**: `RequisiteInputDto.minScore` dùng `@Matches(GRADE_POINT_PATTERN)` tại `src/features/curriculum/replace-requisites.dto.ts:43`; pattern tại `src/shared/decimal/decimal.ts:14` chỉ nhận chuỗi điểm thang 4 (0..4, tối đa hai chữ số thập phân). Giá trị 5 bị DTO từ chối trước service. Không phải lỗi plannedSemester, thiếu học phần trong working copy hoặc thiếu quan hệ catalog. `CurriculumRequisitesService.replace` kiểm quyền Draft/creator, self-edge, duplicate, course tồn tại/không CANCELLED và cycle catalog + curriculum; không bắt buộc có global relation hay source nằm trong cùng version. Thứ tự học kỳ sai được cảnh báo HIGH, không phải 400 ở endpoint này (`src/shared/curriculum/curriculum-warnings.ts:163`).
- **Sửa test-only**: giữ ngưỡng gốc 4, đổi ngưỡng copy từ 5 thành 3; hai version ban hành vẫn có requisite khác nhau và đều hợp lệ. Bổ sung assertion e2e xác nhận field minScore của comparison là 4 → 3 (`test/version-comparison.e2e-spec.ts:125`). Đối chiếu mẫu e2e sẵn có: `test/curriculum.e2e-spec.ts:294` dùng minScore=2, `:391` PUT hợp lệ, `:408` kiểm input lỗi; `test/consistency.e2e-spec.ts:243` và `:307` xác nhận ordering/outside-curriculum là cảnh báo.
- **Diagnostics**: grep toàn bộ `test/fixtures` không có helper status/body dùng chung. Thêm `expectFixtureStatus` tại `test/fixtures/version-comparison.ts:22`, dùng callback `.expect(...)` cho mọi status check viết trực tiếp trong hai fixture được giao; mismatch ném Error chứa expected status, actual status, JSON response body và raw response text. `test/fixtures/cohort-versions.ts` import cùng helper; không thêm file hay dependency. Những helper dùng chung ngoài scope giữ nguyên status check nội bộ.
- **Rà soát HTTP**: bảng dưới ghi mọi call có status expectation của fixture và setup hai suite, gồm endpoint ẩn trong helper sẵn có. Prefix route là `/api`; vị trí tương đối với `source/backend/`. Kết luận ok là kiểm tra tĩnh theo DTO/service, không tuyên bố đã chạy e2e.

| Call site | Route / status | Kết luận và rule quyết định |
|---|---|---|
| test/fixtures/version-comparison.ts:90 | PUT /curriculum-items/:itemId/requisites → 200 | ok: minScore=4 đúng pattern, PREREQUISITE, source ACTIVE khác target, không duplicate/cycle; R1 sửa plain Draft. |
| test/fixtures/version-comparison.ts:114 | PUT /curriculum-items/:itemId/clo-plo-links → 200 | ok: CLO thuộc revision đang dùng; PLO cùng version đã có weight; một link không duplicate. |
| test/fixtures/version-comparison.ts:137 | PATCH /program-versions/:versionId/info → 200 | ok: tên ngắn không rỗng; creator sửa request Draft; 120=110+10, không giảm semesterCount. |
| test/fixtures/version-comparison.ts:142 | PATCH /curriculum-items/:itemId → 200 | ok: semester=3 trong 1..8, note ngắn; không đổi course hoặc bỏ isElective của item có group. |
| test/fixtures/version-comparison.ts:158 | PUT /curriculum-items/:itemId/clo-plo-links → 200 | ok: mảng rỗng được phép để clear; creator sửa request Draft. |
| test/fixtures/version-comparison.ts:160 | PUT /curriculum-items/:itemId/requisites → 200 | fixed: minScore=3 thay 5, đúng thang 4; copy có prerequisite ở semester 1, target semester 3, không self/duplicate/cycle. |
| test/fixtures/version-comparison.ts:172 | POST /change-requests/:id/submit → 200 | ok: creator, Draft có diff, base chưa stale; hai syllabus tồn tại, group đủ 3 credits/1 course, không duplicate/cycle. Credit mismatch HIGH không chặn; không có group coordinator/director nên hai cấp đầu skipped, chờ R1. |
| test/fixtures/version-comparison.ts:174 | POST /change-requests/:id/final-approve → 200 | ok: R1 khác creator, chờ cấp 3; decision/date đúng DTO, semester giữa có start và sau base, allowPastSemester=true cho request do R1 tạo; không chọn cohort; consistency/syllabus đủ. |
| test/fixtures/version-comparison.ts:198 | PATCH /syllabi/:syllabusId → 200 | ok: objectives HTML ngắn; creator sửa syllabus request Draft của course ACTIVE; sanitizer không làm rỗng nội dung. |
| test/fixtures/version-comparison.ts:210 | POST /change-requests/:id/submit → 200 | ok: creator, Draft có diff objectives/week/CLO, base Published hiện tại, không stale; không có coordinator/director, chờ R1. |
| test/fixtures/version-comparison.ts:212 | POST /change-requests/:id/final-approve → 200 | ok: R1 khác creator; semester tương lai sau base giữa; copy giữ courseDescription/objectives đầy đủ, baseRevision còn Published; fan-out một program, không chọn cohort, consistency hợp lệ. |
| test/fixtures/cohort-versions.ts:17 | GET /programs/:programId/cohort-versions → 200 | ok: helper dành cho R1 school-wide direct VERSION_ASSIGN_COHORT + PROGRAM_VIEW, program tồn tại; không có body/query cần DTO. |
| test/fixtures/cohort-versions.ts:28 | POST /programs/:programId/cohort-versions → 201 | ok: caller truyền 1..50 cohort IDs riêng biệt, revision SHA-256 hiện tại, issued version đúng program, start không trước effective semester, không trùng pair/start; có CSRF header. Negative tests gọi HTTP trực tiếp, không ép helper này nhận lỗi. |
| test/fixtures/cohort-versions.ts:40 | GET /programs/:programId/cohorts/:cohortId/applied-version → 200 | ok: semesterId không rỗng, các record tồn tại và có start; R1 có quyền; không có mapping trả UNASSIGNED, không tự fallback ACTIVE. Malformed timeline test gọi HTTP trực tiếp để chờ 409. |

Các HTTP call qua helper sẵn có (không sửa helper ngoài scope):

| Call site | Route / status | Kết luận và rule quyết định |
|---|---|---|
| test/version-comparison.e2e-spec.ts:50 | POST /auth/login → 200 | ok: account ACTIVE vừa tạo, mật khẩu đúng hash; LoginDto hợp lệ, session cookie được giữ bởi agent. |
| test/version-comparison.e2e-spec.ts:51 | POST /auth/login → 200 | ok: R6 ACTIVE, credentials đúng; login không đòi permission nghiệp vụ; UNIT PDT được chỉ định. |
| test/version-comparison.e2e-spec.ts:57 | POST /auth/login → 200 (mỗi R2..R5) | ok: account ACTIVE, credentials đúng; UNIT KHOA_CNTT tường minh, không vô tình SYSTEM. |
| test/cohort-versions.e2e-spec.ts:56 | POST /auth/login → 200 | ok: admin R1 ACTIVE, credentials đúng. |
| test/cohort-versions.e2e-spec.ts:60 | POST /auth/login → 200 | ok: admin R1 thứ hai ACTIVE, username riêng, credentials đúng. |
| test/cohort-versions.e2e-spec.ts:66 | POST /auth/login → 200 (mỗi R2..R6) | ok: account ACTIVE, credentials đúng; UNIT PDT tường minh, không vô tình SYSTEM. |
| test/fixtures/version-comparison.ts:55 | POST /auth/login → 200 | ok: approver R1 mới, username riêng, khác creator; credentials đúng. |
| test/fixtures/version-comparison.ts:67 | POST /program-versions/:versionId/curriculum-items → 201 | ok: source ACTIVE, chưa có trong Draft mới, semester=1 trong 1..8, isElective=false, R1 direct. |
| test/fixtures/version-comparison.ts:71 | POST /program-versions/:versionId/curriculum-items → 201 | ok: target ACTIVE khác source, semester=2 trong 1..8, isElective=true; chưa có course trùng. |
| test/fixtures/version-comparison.ts:102 | GET /courses/:courseId/syllabus → 200 | ok: course tồn tại/ACTIVE, R1 thấy được draft và có quyền đọc. |
| test/fixtures/version-comparison.ts:102 | POST /courses/:courseId/syllabus → 201 (khi chưa có revision) | ok: course mới chưa có syllabus, R1 direct; không trùng draft/published. |
| test/fixtures/version-comparison.ts:102 | PATCH /syllabi/:syllabusId → 200 | ok: plain Draft của course ACTIVE; READY_SYLLABUS có courseDescription/objectives HTML ngắn. |
| test/fixtures/version-comparison.ts:103 | POST /syllabi/:syllabusId/clos → 201 | ok: Draft writable, CLO1 mới, description không rỗng/đúng giới hạn, chưa chạm CLO limit. |
| test/fixtures/version-comparison.ts:112 | POST /program-versions/:versionId/plos → 201 | ok: Draft writable, PLO1 mới, description không rỗng/đúng giới hạn, chưa chạm PLO limit. |
| test/fixtures/version-comparison.ts:113 | PUT /curriculum-items/:itemId/plo-weights/:ploId → 200 | ok: weight=0.25 thuộc (0,1], tối đa hai chữ số thập phân, PLO cùng version, R1 sửa Draft. |
| test/fixtures/version-comparison.ts:120 | GET /courses/:courseId/syllabus → 200 (cả hai course) | ok: releaseViaApi chuẩn bị syllabus từng course ACTIVE; target Draft có sẵn, prerequisite chưa có revision. |
| test/fixtures/version-comparison.ts:120 | POST /courses/:courseId/syllabus → 201 (prerequisite) | ok: chỉ tạo khi chưa có draft/published; course mới và R1 direct. |
| test/fixtures/version-comparison.ts:120 | PATCH /syllabi/:syllabusId → 200 (cả hai Draft) | ok: bổ sung READY_SYLLABUS; không xóa CLO hoặc WeeklyContent đã tạo. |
| test/fixtures/version-comparison.ts:120 | POST /programs/:programId/versions/:versionId/release → 201 | ok: plain first Draft, decision/date đúng DTO, semester đầu có start; cohort tồn tại/duy nhất, chỉ chọn preserved; group đủ minimum, syllabus đầy đủ, không cycle. Không áp quy tắc allowPastSemester của final-approve cho first release. |
| test/fixtures/version-comparison.ts:127 | POST /change-requests → 201 | ok: CURRICULUM/PROGRAM đúng TYPE_TARGETS; R1 có create/edit, target đã release; title/reason mặc định hợp lệ, origin FACULTY không cần basis; copy từ newest released version. |
| test/fixtures/version-comparison.ts:157 | PUT /curriculum-items/:itemId/plo-weights/:ploId → 200 | ok: weight=0.50 đúng DTO; item và copiedPlo cùng copy version; creator sửa request Draft. |
| test/fixtures/version-comparison.ts:191 | POST /change-requests → 201 | ok: SYLLABUS_CONTENT/COURSE đúng TYPE_TARGETS; target có Published revision sau first release; creator có create/edit; title/reason/origin hợp lệ; copy lấy Published revision hiện tại. |

- **Kết quả rà soát**: ngoài minScore=5 không tìm thấy HTTP setup request nào khác trái DTO/refusal branch. Không sửa production hoặc hai spec để né business rule; chỉ thêm assertion requisite trong comparison spec. Không thay grant của account hoặc trạng thái ban hành bằng Prisma.
- **Kiểm chứng**: `pnpm exec tsc --noEmit -p tsconfig.json` exit 0, không output; `pnpm exec oxlint test` exit 0, không output; `pnpm exec prettier --check test` exit 0, output: Checking formatting... / All matched files use Prettier code style! Không chạy Docker, Prisma CLI/e2e. Orchestrator cần chạy lại hai suite; kết quả setup và 18 test vẫn chưa được xác nhận trong sandbox.

## Disposition của call site cũ

Không thay thế hàm dùng chung nào. Giữ nguyên mọi caller của readProgramSnapshot, readSyllabusSnapshot, diffSnapshots, toDiffSections, revisionForItems, toCohortDto, VersionPublisher.promote và VersionActivator.activate. F-16 thêm caller cho các pure diff/syllabus primitives; không đổi exported contracts mà feature đã dựng phụ thuộc.

## Kiểm chứng

| Lệnh trong source/backend | Exit | Kết quả cuối |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | Không có output/chẩn đoán; gồm cả test/e2e source sau chỉnh fixtures cuối |
| `pnpm exec oxlint src test` | 0 | Không có output/chẩn đoán |
| `pnpm exec prettier --check src test` | 0 | Checking formatting... / All matched files use Prettier code style!; chỉ format file sở hữu |
| `pnpm exec vitest run --configLoader native --pool threads` | 0 | Lượt độc lập cuối: 131 files / 1134 tests passed, 38.09 s; toàn bộ unit F-13/F-15 vẫn đạt |

- **Incident (đã sửa trong code mới)**: lượt đầu có bốn failure ở new specs: Vitest it.each spread array thay vì truyền một list; JSON-key expectation bị PowerShell native argument quoting bỏ dấu quote. Đổi table sang object và dựng expected tuple bằng JSON.stringify. Không có test cũ đỏ trong lượt đó.
- **Incident môi trường/check**: một lượt full unit chạy đồng thời với các checks khác exit 1: `HealthController > returns the result when every dependency is up`, `beforeEach` tại `src/features/health/health.controller.spec.ts:24` timeout 10000 ms; 1133 test khác đạt. Không đổi health test, timeout hoặc cấu hình để che lỗi. Chạy lại đúng lệnh whole suite độc lập exit 0, 1134/1134. Lượt timeout không được xem là verdict code F-16; nguyên nhân tài nguyên đồng thời chỉ là khả năng, không được khẳng định đã chẩn đoán.
- **Dependency check**: đã đọc package.json và đối chiếu mọi bare import trong production/test F-16 với dependency trực tiếp. Runtime @nestjs/common, @nestjs/swagger, class-validator, @nestjs/bullmq đều direct; node:crypto là built-in. Test imports dùng devDependencies/direct đã có; không import multer hoặc package transitive, không sửa manifest/lockfile.
- Không chạy Prisma CLI, Docker, e2e, browser hoặc OpenAPI codegen. Các ERROR logs do unit fault injection (imports retry, Redis offline, activation failure...) không phải verdict DB/e2e.

## Lệch kế hoạch

- F-09 backend đã dựng, trái các câu planned/not built của bản kế hoạch; đã sửa §2, §2c và các dòng F-09 liên quan, không thêm dependency.
- Source line drift do F-09: Cohort/CohortVersion/schema uniqueness và AppModule/permission-table locations. Counter program có nhánh director phải bảo toàn.
- toCohortDto nhận full model; mapper mới giữ Pick contract bằng chọn ba trường tường minh. Không đổi helper cũ.
- E1/E3 đã accepted ngày 2026-10-26; sửa những câu còn coi E1 là open/history pending. Không đổi default hoặc nhận làm history/freeze.

## Borderline calls

- Dùng thêm account R1 để final-approve fixture, không tự duyệt; account scoped khác dùng UNIT. Dữ liệu Draft tổng hợp qua Prisma không là bypass release production: snapshots vẫn được publisher/approval API thật tạo.
- Bảng quyền chung giữ convention placeholder của harness hiện hữu, còn hai suite F-16 sở hữu fixtures thành công/nguyên tử thật. Chưa nhận HTTP coverage đã chạy.
- Calendar token cố ý coarse: chỉnh calendar không liên quan cũng buộc reload/reconfirm. Lifecycle activation không làm đổi token.

## Escalations

Không có quyết định mới cần chặn build. Faculty còn nợ acceptance E2/E4; U1/U2 chưa dựng. Đây là giới hạn đã chấp thuận, không phải lý do thêm schema/stub hoặc đổi F-15.

## USER ACTIONS — lượt BE ban đầu

- Orchestrator chạy hai suite F-16, releases, corrections, final-approval, users/OpenAPI route coverage và permission-table trên Testcontainers, rồi whole e2e nếu đạt; không xem type-check/unit là bằng chứng transaction thật.
- Browser walk và FE-01..FE-06, DOC-01 ở lượt sau. Giữ trạng thái kế hoạch e2e pending cho đến có kết quả thật; không nhận toàn bộ CV-200 hoặc integration F-12/F-17 đã hoàn tất.

## FE-02 — Kiểu sinh, API adapters và cache

- **Rule 13**: đọc lại `source/frontend/src/shared/api/client.ts:9`, `:44`, `features/releases/api/releases.ts:1`, `features/releases/hooks/useReleases.ts:38`, `:185`, `:261` và `shared/api/schema.d.ts:5239`. Shared client đã cấp session/CSRF, root releases đã được release/correction/semester invalidation dùng; không đổi chữ ký hook cũ.
- Sáu adapters alias trực tiếp generated DTO/operation, keys gồm program/cặp có thứ tự/course/cohort/semester; lookup thiếu ID không fetch. Schedule/as-of staleTime 0; mutation không retry/optimistic entitlement. Picker có phân trang và query q, không đọc currentVersion làm quyền lợi khóa.
- **Decision during build**: tái dùng broad release/program invalidation có sẵn, thêm test chứng minh release, correction và semester edit chạm các key mới. Không thêm một cache phiên hay fetch wrapper khác.
- **Incident**: triển khai picker đầu tiên dùng search; TypeScript generated contract chỉ nhận q như §2a. Sửa adapter consumer và test, không sửa backend/generated schema. Test invalidation mới cũng bị tsc bắt thiếu versionNumber/cohortIds của release DTO; bổ sung fixture đúng contract.

## FE-03 — Lịch sử, quyền và lối vào

- **Rule 13**: đọc lại `features/releases/pages/VersionHistoryPage.tsx:21`, `VersionDetailPage.tsx:15`, `SemestersPage.tsx:23`, `features/programs/components/ProgramVersionsSection.tsx:18`, `src/routes.ts:33`, `src/router.tsx:386`, `shared/auth/permissions.ts:7`, `shared/layout/menuItems.tsx:21`.
- Giữ Draft và origin/correction links của history nhưng không cho chọn Draft; đúng hai issued IDs mới bật so sánh, không tự thay lựa chọn thứ ba. Thêm link nhóm tự chọn đúng version ở detail. MH-10 và overview có link gán khóa gated bằng quyền; bốn routes lazy có Permission wrapper. Giữ nguyên routes/menu F-09; không cần thêm sidebar.
- **Deviation**: một số line anchors trong plan cũ đã dịch sau F-15/F-09; sửa §2c theo nguồn hiện tại, không đổi §3 hoặc quyết định đã chấp thuận.

## FE-04 — So sánh và drill-down hai pin

- **Rule 13**: đọc lại `features/change-requests/components/DiffView.tsx:75` và các trang/history API/hook F-15 trước khi tạo renderer. DiffView import API/constants riêng change-requests; không import ngang feature, không di chuyển component dùng bởi F-14.
- URL là nguồn cặp đã chạy; selectors AntD Form giữ cặp dự kiến, nút đổi chiều giữ ngữ cảnh. Sáu section/bộ ba pin luôn hiện, Thêm/Bớt/Sửa theo thứ tự, số lượng và trạng thái Không thay đổi. Metadata lấy server; pin hiển thị revision/ID thực, quay lại đúng cặp, không fetch đề cương mới nhất.
- Text được React escape, giữ xuống dòng và em dash; table cuộn ngang, selectors wrap; loading/403/404/error có thông báo cụ thể và retry. Dùng PageHeader/DetailPageLayout và AntD theme, không HTML injection hay màu hex.

## FE-05 — Gán khóa và tra cứu theo học kỳ

- **Rule 13**: đọc lại `features/releases/components/CorrectionIssueForm.tsx:1`, `components/FrozenRowsTable.tsx:1`, `shared/releases/SemesterSelect.tsx:1`, `shared/releases/CohortSelect.tsx:1` và endpoints/generated DTO trước khi dựng màn hình.
- Picker releases-owned dùng ListPageLayout/DataTable/PageHeader, phân trang server, giữ cohortId khi có. Lịch hiển thị mọi mapping; as-of bắt chọn khóa và học kỳ, không đoán hôm nay/ACTIVE. Semester không ngày bị disabled.
- POST chọn tường minh nhiều khóa; PATCH chỉ mốc học kỳ của đúng mapping. Confirmation chụp đúng revision, quyết định, khóa và ngày; cảnh báo thay đổi câu trả lời quá khứ. Stale 409 giữ choices, đóng confirmation, không retry, yêu cầu nạp lại và xác nhận mới. Revision nền thay đổi hủy xác nhận cũ; các mutation khác không bị thay chữ ký.
- **Decision during build**: giữ lịch sử correction/calendar đã chấp thuận; chỉ giải thích gán khóa, không dựng student count, exception adapter F-17, basis field hoặc công thức F-12 giả.

## FE-06 — Unit/regression và build gate

- **Rule 13**: đọc harness `features/releases/testRender.tsx:1`, tests history/detail/semester và `features/programs/pages/ProgramOverviewPage.test.tsx:1` trước khi mở rộng. Giữ mọi trường hợp release/correction cũ; không thay cấu hình Vitest hay tests ngoài phạm vi.
- Thêm adapter/pure utility/hook specs, so sánh sáu nhóm, ba nhóm pin, URL/pair/swap, không fetch latest; form POST/PATCH/confirm/cancel/Draft/unknown date/stale/background revision; picker/search/page/as-of/error. Cache test xác nhận mutation release/correction/semester edit invalidates cả bốn projection mới.
- **Incident**: AntD test ID trùng giữa hai dialog khiến locator theo accessible name không phân biệt được; test scope từ confirm title đến dialog. jsdom không kết thúc CSS leave transition như browser; harness release đặt theme token motion:false, không đổi runtime motion. Một lượt có timeout 5 giây trong hai test mới khi máy bận; chạy lại nguyên lệnh độc lập, không nới timeout toàn suite. Test link overview mới dùng async timeout 3 giây cho session query.
- **Incident**: stale confirmation bị destroy rồi ném lại rejected promise gây unhandled rejection của AntD ActionButton. Sau lỗi đã hiển thị, đóng riêng confirmation và giữ form/choices editable; không rethrow. Bổ sung test server refusal không stale để không mắc lại cùng lỗi.
- **Incident kiểm chứng**: Prettier cần lượt định dạng thứ hai cho hai file JSX trước khi check sạch. PowerShell non-TTY có DLL initialization exit -1073741502; dùng PTY, không xem lượt môi trường đó là verdict mã nguồn.
- **Lesson**: kiểm contract bằng generated types trước, kiểm trạng thái dialog thực thay vì ID giả của môi trường test; confirmation là snapshot dữ liệu, không phải quyền retry mutation tự động.

## Test-case doc — Truy vết nghiệm thu

- Đã tạo `docs/testing/test-cases/f-16-version-compare-cohort-assignment-test-cases.md`: 27 ca, đúng 14 cột và tiếng Việt, trạng thái chưa chạy. US-078 AC1..4, US-079 AC1..3, US-080 AC1..5, CV-194..199, KB-059 và NT-B4-10/11/12 được liên kết tới ca cụ thể.
- F16-TC_001..022 Automated, ghi tầng/spec/tên test thật; F16-TC_023..027 Manual (accessibility/mobile, F-12 chưa xây, dữ liệu Khoa, F-17 chưa xây, browser walk correction/calendar). Không nhận toàn bộ CV-200/B5 hoặc dữ liệu Khoa đã nghiệm thu từ synthetic fixture.
- Chỉ thêm dòng F-16 vào README index ở cuối lượt, đọc lại ngay trước patch; giữ nguyên dòng F-09 do tác nhân khác cập nhật.

## Playwright — Hành trình HTTP/browser thật

- **Rule 13**: đọc `source/e2e/fixtures/release-versions.ts:1`, `change-requests.ts:39`, `accounts.ts:25`, `unique.ts:1` và specs F-15/F-09; tái dùng stored auth và release/approval helper thật. Fixture mới tạo program/course/cohort/semester riêng với uniqueSuffix, không dựa số dòng seed.
- Năm test F16-TC_001/004/008/014/015: so sánh không liền kề/pin/back/swap; lịch sử read-only; POST batch giữ khóa không chọn/PATCH riêng mốc/as-of; stale bằng request cạnh tranh thật rồi reload/reconfirm; R6 direct route/API bị chặn. Scoped main/dialog, exact labels và link theo version ID tránh trùng tên decision.
- **Borderline call**: fixture tạo ba phiên bản qua initial release, đề xuất syllabus đã duyệt, đính chính tên program không moveCohorts; so sánh first/third để chứng minh không phụ thuộc adjacent proposals. Chỉ nội dung tổng hợp, không sửa demo catalog hoặc helper Select chung.
- **Lesson**: helper Select riêng phải lọc label trước (danh mục nhiều option có virtualization), Tab sau chọn và assert aria-expanded=false; không sao chép flake popup còn mở.
- Không chạy Playwright/browser trong sandbox. Orchestrator chịu trách nhiệm execution và điền kết quả TC.

## Contract, phạm vi và bàn giao FE

- Đã đối chiếu mọi external import mới với direct dependencies trong `source/frontend/package.json` và `source/e2e/package.json`: React, AntD, react-router, TanStack Query, Vitest/testing-library, Playwright đều có trực tiếp; schema import chỉ là type local. Không dependency/package/lockfile mới.
- **Deviation**: sửa line anchors và ghi §2c cho program query q/generated operation; giữ §2a q vốn đúng. Đây là sửa triển khai/citation, không đổi quyết định §3/§8. DiffView vẫn ở change-requests; renderer mới thuộc releases như plan.
- Không sửa backend hoặc generated schema; không chạy api:types, Docker, Prisma CLI, e2e/browser. Không đọc dotenv hay dữ liệu nhạy cảm; giữ F-09 routes/menu và mọi chữ ký hook cũ. DOC-01/progress/architecture ngoài phạm vi.
- **Escalations**: không có blocker mới; Faculty acceptance E2/E4 và U1/U2 vẫn là giới hạn đã chấp thuận.
- **USER ACTIONS**: orchestrator chạy spec Playwright F-16 và browser walk §7; kiểm responsive/accessibility, liên tính năng correction/calendar; điền trạng thái TC. DOC-01 là lượt riêng.

### Kiểm chứng FE cuối lượt (2026-10-26)

| Project | Lệnh | Exit | Output/kết quả |
|---|---|---|---|
| frontend | `pnpm exec tsc -b` | 0 | Không có chẩn đoán |
| frontend | `pnpm exec oxlint src` | 0 | Không có chẩn đoán |
| frontend | `pnpm exec prettier --check` với 34 source/test files được tạo/sửa | 0 | Checking formatting... / All matched files use Prettier code style! |
| frontend | `pnpm exec vitest run --configLoader native --pool threads src/features/releases src/features/programs/pages/ProgramOverviewPage.test.tsx` | 0 | 15 files / 81 tests passed, 22.45 s; jsdom vẫn in cảnh báo getComputedStyle pseudo-elements |
| e2e | `pnpm typecheck` | 0 | tsc --noEmit |
| frontend | `pnpm exec prettier --check ../e2e/specs/f-16-*.spec.ts ../e2e/fixtures/version-comparison.ts` | 0 | All matched files use Prettier code style! |
| frontend | `pnpm exec prettier --check` với F-16 TC doc, plan, report và test-cases README | 1 | Bốn Markdown dùng style bảng hiện tại không căn theo Prettier; không đổi hàng loạt bảng/citation cũ hoặc format README ngoài dòng F-16 |

- **Borderline call**: giữ định dạng tài liệu theo mẫu hiện hành thay vì mass-format plan/report/index; check Markdown bổ sung chưa sạch được báo tường minh, không đánh đồng với source-format gate đã đạt. README có chỉnh sửa F-09 đồng thời và chỉ cho phép thêm dòng F-16.
- Kết quả trên chỉ là kiểm chứng frontend/unit/typecheck. Năm ca Playwright vẫn chưa thực thi, test-case doc giữ chưa chạy và không có ghi nhận Passed do suy diễn.
