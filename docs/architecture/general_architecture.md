# General Architecture

<!--
  FILE PURPOSE   : Single source of truth for overall app structure, layers, patterns, and wiring.

  WHAT BELONGS   : Package/module layout, layer rules, state-management pattern, navigation
                   structure, DI setup.

  WHAT DOES NOT  : Feature-level detail (→ features_architecture.md), tech config
                   (→ technical_reference.md), implementation status or TODOs
                   (→ todo.md / current_work.md).

  UPDATE WHEN    : A new layer convention is introduced, navigation structure changes,
                   or a project-wide architectural decision is made.

  FORMAT:
            ## <Section Name>
            Brief description of what this section establishes.
            ```
            code block or diagram if needed
            ```
-->

Ghi những gì **đã dựng** trong `source/`. Lựa chọn công nghệ và lý do ở `docs/design/tech-stack.md`; quy ước chung ở `.claude/rules/*-rules.md` và mục Deviations của `CLAUDE.md`. Các điểm kiến trúc nền (bố cục `features/` + `shared/`, `@RequirePermission`, AntD `Form`, `/api/auth/me` làm trạng thái phiên phía giao diện, khóa `cuid`) đã trả lời ở `docs/planning/feature-questions.md` §F-00; mã đã chuyển sang bố cục mới cùng F-01 (`docs/implementation/f-01-auth-session-implementation-plan.md`).

---

## Bộ đọc phiên bản áp dụng (F-16)

`source/backend/src/shared/releases/releases-shared.module.ts` cung cấp và export `AppliedProgramVersionReader`; `source/backend/src/features/releases/releases.module.ts` import `ReleasesSharedModule` và nối `VersionComparisonController` / `VersionComparisonService`, `CohortVersionsController` / `CohortVersionsService`. Tính năng tiêu thụ không import service riêng của `features/releases`.

- Hợp đồng tại `source/backend/src/shared/releases/applied-program-version.reader.ts:15` và `source/backend/src/shared/releases/applied-version.types.ts`: `forCohort({ programId, cohortId, semesterId }, tx?)`, `forCohorts({ programId, cohortIds, semesterId }, tx?)`; nhận `Prisma.TransactionClient` để đọc cùng giao dịch của bên gọi. Không truyền transaction thì reader tự mở `RepeatableRead`; batch loại ID khóa trùng và giữ thứ tự lần xuất hiện đầu. Reader không thay lớp phân quyền của bên gọi.
- Nguồn chọn: `source/backend/src/shared/releases/cohort-version-schedule.ts`. As-of dùng `Semester.startDate`, không so mã học kỳ hay trạng thái `ProgramVersion.ACTIVE`: lấy dòng cùng khóa/chương trình có ngày bắt đầu áp dụng ≤ ngày bắt đầu học kỳ truy vấn, chọn `fromSemester.startDate` giảm dần, rồi `createdAt` giảm dần, cuối cùng `id` giảm dần. Không có dòng đủ điều kiện trả `assignment: null`, không fallback sang ACTIVE. Thiếu ngày học kỳ hoặc lịch gán không hợp lệ là lỗi, không coi như chưa gán.
- Lịch chỉ chấp nhận bản thực sự đã ban hành: không `DRAFT`, không `sourceRequestId`, có số phiên bản, số quyết định, `publishedAt`, học kỳ hiệu lực có ngày bắt đầu; ngày áp dụng không sớm hơn ngày hiệu lực. Trạng thái `PENDING` / `ACTIVE` / `HISTORICAL` không thay quy tắc as-of. Tie-break ổn định phục vụ dữ liệu đã có; ghi mới từ chối hai điểm bắt đầu cùng ngày cho một khóa trong một chương trình.
- `readProgramCohortSchedule` tạo revision SHA-256 từ phiên bản định dạng, ID chương trình, toàn bộ dòng gán của chương trình và ID/ngày bắt đầu của toàn bộ học kỳ; revision là token tính lại, không phải cột database. POST/PATCH bắt buộc `expectedRevision`, kiểm lại bên trong giao dịch; thay lịch hoặc ngày học kỳ có thể làm xác nhận cũ mất hiệu lực.
- `source/backend/src/features/releases/cohort-versions.service.ts` khóa hàng `Program` bằng `lockPrograms` (`SELECT … FOR UPDATE`) trước khi kiểm và ghi, trong giao dịch `Serializable`, dùng giới hạn `RELEASE_TRANSACTION` hiện hữu ở `source/backend/src/shared/releases/release-locks.ts`. Batch ghi tất cả hoặc không ghi; xung đột revision/serialization trả `409 ASSIGNMENT_STATE_CHANGED`, client phải tải và xác nhận lại. Không thêm khóa hay hàng đợi mới cho F-16.
- B5 phải dùng cùng reader với học kỳ tường minh; dữ liệu sinh viên, ngoại lệ, đăng ký, xét tốt nghiệp và tích hợp không được tự suy từ ACTIVE. Đây là hợp đồng tích hợp, **adapter sinh viên F-17 vẫn chưa dựng**, không phải bằng chứng các bên tiêu thụ đã được nối.
- Frontend nối lazy routes trong `source/frontend/src/router.tsx:385`, tên đường tại `source/frontend/src/routes.ts:32`: so sánh và drilldown pin (`version.compare`), bộ chọn `/cohort-versions` và lịch theo chương trình (`version.assignCohort`). Màn hình và API cụ thể ở `features_architecture.md` §16. Dùng lại TanStack Query, kiểm quyền và giao dịch hiện hữu; F-16 không thêm dependency, permission seed hoặc schema/migration.

## 1. Bố cục repo

Ba dự án pnpm **độc lập**: `source/backend`, `source/frontend` và `source/e2e`; mỗi dự án có `package.json`, lockfile và `node_modules` riêng, không có workspace và không có gói dùng chung. Giao diện lấy kiểu dữ liệu từ đặc tả OpenAPI của máy chủ.

```
curriculum-management/
├── docs/                  tài liệu (tiếng Việt, định danh tiếng Anh)
├── source/
│   ├── backend/           NestJS — package.json, pnpm-lock.yaml, node_modules riêng
 │   ├── frontend/          React + Vite — package.json, pnpm-lock.yaml, node_modules riêng
 │   └── e2e/               Playwright — package.json, pnpm-lock.yaml, node_modules riêng
├── .claude/               cấu hình Claude Code (rules, agents, hooks)
└── CLAUDE.md
```

---

## 2. Máy chủ — `source/backend`

Một ứng dụng NestJS duy nhất (RB-01), ESM: mọi import tương đối có đuôi `.js`.

```
src/
├── main.ts                khởi động: tạo app → configureApp → lắng nghe PORT
├── app.setup.ts           tiền tố /api, trust proxy, middleware phiên, ValidationPipe, AllExceptionsFilter, Swagger ở /api/docs
├── app.module.ts          gom các module; CsrfGuard → AuthenticatedGuard → PermissionGuard là APP_GUARD, theo thứ tự đó
├── features/
│   ├── auth/              đăng nhập, đăng xuất, me, đổi mật khẩu (F-01)
│   ├── users/             tài khoản, gán vai trò (F-02)
│   ├── permissions/       vai trò, ma trận vai trò × quyền (F-02)
│   ├── org-units/         danh sách đơn vị cho ô chọn (F-02); thêm, sửa, chuyển, ngừng, kích hoạt đơn vị (F-03)
│   ├── subject-groups/    nhóm chuyên môn, thành viên, Điều phối (F-03)
│   ├── courses/           danh mục học phần, trạng thái HP-01..HP-04 (F-04); ngừng mở lớp kèm học phần thay thế (F-05)
│   ├── course-relations/  quan hệ học trước / tiên quyết / song hành / thay thế, chống chu trình (F-05)
│   ├── equivalence-groups/ nhóm học phần tương đương: tạo, thêm, bớt, gộp, giải thể (F-05)
│   ├── curriculum/        khung chương trình, nhóm tự chọn, điều kiện riêng của khung (F-07)
│   ├── programs/          chương trình đào tạo: danh sách, tổng quan, thông tin ở bản Nháp, ngừng/dùng lại, nhân bản; phân công Giám đốc CTĐT có thời hạn (F-06); `GET/PATCH /program-versions/:id/info` (F-13)
│   ├── consistency/       báo cáo kiểm tra nhất quán, chấp nhận chênh lệch tín chỉ (F-08)
│   ├── syllabi/           đề cương theo bản số, tuần, tệp đính kèm (F-10); CLO (F-11)
│   ├── outcomes/          PLO, ma trận học phần–PLO, CLO–PLO, kiểm tra phủ (F-11)
│   ├── change-requests/   đề xuất thay đổi, bản làm việc, so sánh, gửi, rút, văn bản (F-13); duyệt ba cấp, Duyệt thay, bình luận, hàng chờ (F-14); phê duyệt cuối (F-15)
│   ├── notifications/     thông báo trong ứng dụng, đếm chưa đọc (F-14)
│   ├── releases/          ban hành khởi tạo, lịch sử phiên bản, đính chính, hàng đợi `release-activation` (F-15)
│   ├── semesters/         học kỳ và khóa tuyển sinh (F-15)
│   ├── students/          hồ sơ, kết quả nguồn, quá trình học; queue `student-enrollment` (F-17)
│   ├── graduation/        xét tốt nghiệp, đợt xét, xét lại khi đổi điểm; queue `graduation-review` (F-19)
│   └── health/            trạng thái hệ thống
├── shared/
│   ├── config/            env.validation.ts — lớp Env (class-validator); sai thì dừng khi khởi động
│   ├── prisma/            PrismaModule (@Global) + PrismaService (kiểm ICU vi-VN lúc khởi động)
│   ├── queue/             QueueModule: BullModule.forRootAsync nối Redis
│   ├── session/           SessionStoreService: express-session + connect-pg-simple (bảng session); regenerate/destroy
│   ├── password/          PasswordService (Argon2id), chính sách mật khẩu
│   ├── auth/              @Public, @AllowPendingPasswordChange, @CurrentUser, CsrfGuard, AuthenticatedGuard
│   ├── authz/             @RequirePermission, @AnyAuthenticated, @CurrentAccess, PermissionGuard, ScopeService, AccessContext, PERMISSIONS, LOCKED_CELLS, edit-path.ts (editPathFor, resolveEditPath, assertDirectEdit, assertSchoolWideDirect)
│   ├── pagination/        PageQueryDto + Page<T>
│   ├── courses/           CourseUsageReader (`hasActiveReplacement` do F-05 điền; F-07, F-15, F-17 điền các hàm còn lại), CoursesSharedModule, courseTarget, courseEditState, RelatedCourseDto, requisite-graph.ts (findRequisiteCycle, khóa đồ thị)
│   ├── curriculum/        curriculum-warnings.ts, curriculum-facts.reader.ts (F-07); ConsistencyChecker (`check`, `assertPasses` → 409 `CONSISTENCY_FAILED`), curriculum-cycles.ts, program-credits.ts (F-08); CurriculumSharedModule
│   ├── programs/          active-director.ts, program-target.ts, VersionContentCopier (chép nhóm, dòng, điều kiện, PLO, hai ma trận), director.writer.ts (F-06, F-14) + ProgramsSharedModule
│   ├── syllabi/           revision-for-items.ts (bản đề cương theo dòng khung: bản ghim, không thì Đã ban hành, không thì Nháp), syllabus-revision.copier.ts, syllabus-sections.ts (F-10, F-13, F-15)
│   ├── outcomes/          OutcomeGapsReader + OutcomesSharedModule (F-11)
│   ├── change-requests/   StaleChecker, released-base.ts, academic-office.ts, ApprovalRecorder, approval-rules.ts, RequestNotifier, diff/ (F-13, F-14) + ChangeRequestsSharedModule
│   ├── notifications/     NotificationService + NotificationsSharedModule (F-14)
│   ├── releases/          VersionPublisher, VersionActivator, SyllabusPublisher, version-number.ts (`major.minor`), release-locks.ts, correction-access.ts + ReleasesSharedModule (F-15)
│   ├── students/          StudentsSharedModule: StudentAppliedVersionReader, AcademicResultsReader, EnrollmentReconciler, StudentAccountProvisioner; writer/khóa/phạm vi/mã hóa dùng chung (F-17)
│   ├── files/             FileStorageService (dưới `FILES_ROOT`), sendFile, uploadedFileName, attachment-types.ts (F-10)
│   ├── rich-text/         sanitizeRichText, richTextToPlain (F-10)
│   ├── collections/       group-by.ts (thay `Map.groupBy`, target ES2023)
│   ├── decimal/           CREDITS_PATTERN, GRADE_POINT_PATTERN, toWireDecimal — số thập phân gửi dạng chuỗi
│   ├── org-units/         home-faculty.ts — HOME_FACULTY_CODE, định nghĩa "khoa khác"
│   ├── time/              todayDate() — ngày hôm nay theo Asia/Ho_Chi_Minh; validity.ts — validityState, parsePeriod, overlapsPeriod dùng chung cho mọi bảng có khoảng hiệu lực
│   ├── subject-groups/    active-membership.ts — một bộ dựng điều kiện "hàng thành viên đang hiệu lực" cho bộ đọc phạm vi, tóm tắt nhóm
│   ├── exception/         AppException, ErrorDefinition, COMMON_ERRORS, validation-exception.factory
│   ├── filter/            AllExceptionsFilter — mọi lỗi ra dạng ErrorResponseDto
│   └── dtos/              ErrorResponseDto, RefDto (OrgUnit, User, Role, SubjectGroup, Course), transforms.ts (trimString, emptyToNull, trimUpperCase)
└── generated/prisma/      Prisma Client sinh ra (không sửa tay, không đưa vào git)
prisma/
├── schema.prisma          tài khoản, quyền, đơn vị, học phần, chương trình, khung, đề cương, PLO/CLO, đề xuất, duyệt, thông báo, học kỳ, khóa — danh sách bảng ở database_and_models.md
├── migrations/            migration của Prisma
├── seed-data/             đơn vị, vai trò, danh mục 43 quyền (41 từ F-02, F-15 thêm 2) + ma trận ban đầu, ba cấp duyệt (approval-levels.ts), chương trình mẫu 1024034 kèm khung mẫu (programs.ts), khối kiến thức, học kỳ và khóa giữ chỗ
└── seed.ts                tài khoản R1 đầu tiên, quyền và vai trò (`pnpm prisma:seed`)
test/                      đầu-cuối: global-setup.ts dựng một PostgreSQL + một Redis (Testcontainers) cho cả lượt, migrate cơ sở dữ liệu mẫu một lần, mỗi spec một bản chép; test-app.ts, test-env.ts, fixtures/, permission-table.ts
```

### Quy tắc đang áp dụng

| Quy tắc                     | Cách làm hiện tại                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module                      | Tính năng ở `src/features/<f>/`, hạ tầng dùng chung ở `src/shared/`; tính năng không import tính năng khác; module khác chỉ dùng provider được `exports`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Lớp trong module            | `*.controller.ts` nhận và trả, `*.service.ts` xử lý, `*.dto.ts` vào/ra. Không có tầng repository: service gọi `PrismaService` trực tiếp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Dữ liệu ra                  | DTO có `@ApiProperty` để Swagger sinh đúng kiểu cho giao diện; không trả model Prisma thô                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Cấu hình                    | `ConfigService<Env, true>` với `{ infer: true }`; không đọc `process.env` trong mã ứng dụng (ngoại lệ: `prisma.config.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Việc nặng                   | Worker BullMQ; Redis chỉ chứa hàng đợi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Lỗi                         | Service ném `AppException(<định nghĩa>)` (mã + câu tiếng Việt) hoặc ngoại lệ Nest; `AllExceptionsFilter` trả `ErrorResponseDto { statusCode, code, message, details?, path, timestamp }`; lỗi kiểm dữ liệu có `details` theo trường                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Xác thực                    | Mọi route cần phiên trừ `@Public()`; `AuthenticatedGuard` nạp lại người dùng mỗi yêu cầu, tài khoản DISABLED → 401 `SESSION_REQUIRED`; `mustChangePassword` → 403 `PASSWORD_CHANGE_REQUIRED` trừ route `@AllowPendingPasswordChange()`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Phiên                       | Cookie HttpOnly `ctdt.sid`, hàng trong bảng `session` (PostgreSQL), `rolling`, hết hạn sau `SESSION_IDLE_MINUTES` không hoạt động; đăng nhập gọi `regenerate`. `AuthenticatedGuard` giữ `lastActivityAt` trong phiên; tuyến `@PassiveRequest()` (chuông thông báo hỏi định kỳ) không làm mới để tab mở không giữ phiên sống mãi (F-14)                                                                                                                                                                                                                                                                                                                       |
| CSRF                        | `CsrfGuard`: phương thức khác GET/HEAD/OPTIONS phải có `X-Requested-With: XMLHttpRequest`, thiếu → 403 `CSRF_HEADER_MISSING`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Phân quyền                  | `PermissionGuard` từ chối mặc định: route không `@Public` phải có `@RequirePermission(...codes)` (đủ một trong các mã) hoặc `@AnyAuthenticated()`, thiếu cả hai → 403. Quyền nạp lại mỗi yêu cầu, không cache                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Phạm vi                     | `ScopeService.loadAccess()` dựng `AccessContext` một lần mỗi yêu cầu, gắn vào `request.access`; service lấy bằng `@CurrentAccess()` và kiểm phạm vi đồng bộ trên đó. Vai trò `scopeSource = NONE` lấy từ hàng `RoleAssignment` (`SYSTEM`/`UNIT`); vai trò khác suy ra qua `ScopeSourceReader`: F-03 đã điền `SUBJECT_GROUP_MEMBER` (R5) và `SUBJECT_GROUP_COORDINATOR` (R4) từ hàng đang hiệu lực trong nhóm `ACTIVE`; F-06 điền `PROGRAM_DIRECTOR` (R3) từ `ProgramDirectorAssignment` đang hiệu lực trong chương trình `ACTIVE` qua `activeDirectorWhere`, trả `programIds`; F-17 điền tiếp `OWN_ENROLLMENT` (R6)                                          |
| Đường sửa                   | `src/shared/authz/edit-path.ts` quyết định một đối tượng được sửa trực tiếp (`DIRECT`) hay chỉ qua đề xuất (`VIA_REQUEST`) từ chế độ ô quyền và trạng thái đối tượng `{ released, draftOpenToRequestHolders }` (H-4, FR-55): đã ban hành → luôn qua đề xuất; chưa ban hành → ô `DIRECT` sửa thẳng, ô `VIA_REQUEST` sửa thẳng khi dữ liệu mở cho họ (với học phần: của Khoa CNTT). Service ghi gọi `assertDirectEdit`, ném 409 `CHANGE_REQUEST_REQUIRED`. F-06, F-07, F-10, F-11 dùng lại. Từ F-13, đường `VIA_REQUEST` là sửa trên **bản làm việc** của đề xuất (`ProgramVersion`/`Syllabus` có `sourceRequestId`); tuyến ghi nhận bản làm việc như bản Nháp |
| Sự thật của tính năng sau   | `CourseUsageReader` (`src/shared/courses/`): `programsUsing` và `inReleasedVersion` đọc từ khung từ F-07; `hasStudyResults` trả "không có" đến khi F-17 điền; `hasActiveReplacement` đã thật từ F-05 (nhận thêm `tx` để thấy hàng vừa ghi trong cùng giao dịch); tính năng không import nhau                                                                                                                                                                                                                                                                                                                                                                 |
| Đồ thị tiên quyết           | Mọi nơi ghi cạnh `PRIOR`/`PREREQUISITE` (quan hệ học phần F-05, `CurriculumRequisite` F-07, nhập Excel F-09) phải mở giao dịch, gọi `lockRequisiteGraph(tx)` (khóa `pg_advisory_xact_lock(REQUISITE_GRAPH_LOCK_KEY = 5001)`), rồi `findRequisiteCycle(cạnh, cạnhMới)` trên hợp các cạnh cần xét (`CYCLE_CHECKED_TYPES`); dùng đúng hằng khóa, không tự chọn khóa khác. Khóa dùng `$executeRaw` vì `pg_advisory_xact_lock` trả `void`, bộ điều hợp trình điều khiển không đọc được qua `$queryRaw`                                                                                                                                                            |
| Dữ liệu toàn trường         | `assertSchoolWideDirect(access, code)`: dữ liệu không thuộc đơn vị hay nhóm nào (nhóm tương đương) chỉ sửa được khi có ô `DIRECT` + `ALL` (R1); ô `Đ` hoặc ô theo phạm vi → 403 `PERMISSION_DENIED`                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Chương trình và phiên bản   | `programTarget(program)` = `{ programIds: [id], orgUnitIds: [facultyId] }` (phạm vi R3 theo mã chương trình, phạm vi theo đơn vị của gán tay phủ cả khoa); `programEditState`: "đã ban hành" = có phiên bản khác `DRAFT`, `draftOpenToRequestHolders = true`. Thông tin chương trình sửa trên **bản Nháp**; không có Nháp thì 409 `CHANGE_REQUEST_REQUIRED`. Trạng thái chương trình và phân công Giám đốc là việc R1 (`assertSchoolWideDirect`, `director.assign`), luôn trực tiếp, không phải nội dung phiên bản                                                                                                                                           |
| Sao chép nội dung phiên bản | Mọi nơi sao một phiên bản (nhân bản chương trình F-06; bản Nháp của đề xuất F-13; đính chính F-15) gọi `VersionContentCopier.copy(tx, fromVersionId, toVersionId)` (`src/shared/programs/`) trong giao dịch của người gọi. Bảng thuộc phiên bản thêm bước vào hàm này: F-07 đã thêm nhóm tự chọn → dòng khung → điều kiện (ánh xạ lại id, tra ngược qua khóa tự nhiên vì `createMany` không trả hàng); F-11 đã thêm PLO, ma trận sau điều kiện                                                                                                                                                                                                               |
| Đề xuất, duyệt              | Trạng thái `ChangeRequest` đi `DRAFT` → `PENDING_COORDINATOR` → `PENDING_DIRECTOR` → `PENDING_ACADEMIC_OFFICE` → `APPROVED`/`EFFECTIVE`, hoặc `REJECTED`/`WITHDRAWN`. `RoutingPlanner` tạo dòng `ApprovalStep` mỗi lượt gửi (cấp không có người duyệt thì `isSkipped`). Mọi đường vào/ra `PENDING_*` phải qua `ApprovalRecorder` hoặc `submit`/`withdraw` để `levelEnteredAt` đúng. Từ chối và Rút xóa bản làm việc (`WorkingCopyService.discard`); `ChangeItem` vẫn còn. Đề xuất dữ liệu ở cấp 3 phải đi phê duyệt cuối (F-15)                                                                                                                              |
| Ban hành                    | Ban hành khởi tạo (H-1) và phê duyệt cuối gọi `ConsistencyChecker.assertPasses` + `StaleChecker` trong giao dịch, rồi `VersionPublisher` đánh số `major.minor`, ghi ảnh chụp tên và tín chỉ (chỉ khi còn null) và ghim đề cương (`CurriculumItem.syllabusId`); bản sao làm việc được nâng (`sourceRequestId` → `originRequestId`). Phiên bản `PENDING` thành `ACTIVE` khi tới học kỳ hiệu lực qua hàng đợi `release-activation` (cron 00:05 giờ Việt Nam + lúc khởi động). Đính chính là Nháp riêng (`correctionOfId`), chỉ R1                                                                                                                               |
| Mã quyền                    | Hằng `PERMISSIONS` (`shared/authz/permission-codes.ts`); không viết cứng mã vai trò trong mã                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Người dùng hiện tại         | `@CurrentUser()`; không đọc `req.session` trong controller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Kiểm thử                    | Đơn vị `*.spec.ts` cạnh tệp; đầu-cuối `test/*.e2e-spec.ts` dùng `configureApp` chung với `main.ts`; Playwright tại `source/e2e/` (dự án pnpm độc lập thứ ba), chạy trên app dev có demo seed: backend `:3000/api`, frontend `:5173`; auth setup một lần/vai R1..R6 (+R3b/R4b/R5b) qua `storageState`. Tại `source/e2e`: `pnpm typecheck`, `pnpm exec playwright test specs/<file>.spec.ts --reporter=list`; xem `docs/testing/playwright-guide.md`                                                                                                                                                                                                           |

### Chưa dựng

Bộ đọc phạm vi suy ra cho sinh viên (`OWN_ENROLLMENT`, F-17) đã nối `Student.userId` để trả `studentIds` và `programIds` từ toàn bộ lịch sử quá trình học; tài khoản chưa liên kết hồ sơ không có phạm vi suy ra. Nhóm chuyên môn có từ F-03, Giám đốc CTĐT từ F-06. Nhật ký kiểm toán hoãn (F01-07, `docs/planning/deferred-scope.md` §2).

### Module sinh viên và nhập dữ liệu (F-17)

- `AppModule` nạp `StudentsModule`; module này nạp `StudentsSharedModule` và đăng ký BullMQ queue `student-enrollment`, cung cấp controller đọc hồ sơ/ghi quá trình học cùng scheduler/processor đối soát. `ImportsModule` cũng nạp `StudentsSharedModule` và cung cấp `StudentCredentialsService`; không import trực tiếp `StudentsModule` hay service của feature khác.
- `StudentsSharedModule` nạp `ReleasesSharedModule` để dùng lịch gán khóa/bản đã ban hành, xuất bốn provider đọc phiên bản, đọc kết quả, đối soát và chuẩn bị tài khoản. Nguồn sự thật vẫn ở PostgreSQL, Redis chỉ điều phối công việc.
- Frontend thêm route lazy `/students`, `/students/:studentId` dưới `RequireStudentStaff` (R1/R3 và `student.viewProgress`). Feature imports tái sử dụng pipeline và trang lịch sử hiện có; `shared/students/studentQueryRoot.ts` là gốc cache dùng chung để invalidate hồ sơ sau nhập thành công.

---

## 3. Giao diện — `source/frontend`

```
src/
├── main.tsx               ConfigProvider (vi_VN) → AntApp → QueryClientProvider → RouterProvider
├── router.tsx             createBrowserRouter; /login ngoài khung; RequireAuth → AppLayout → các trang (lazy, trừ Login); mọi `/programs/:programId/...` là route con của `ProgramWorkspaceLayout` (features/programs/components: link về danh sách, tên + trạng thái, Select phiên bản, 5 nhóm tab: Tổng quan / Khung chương trình / Chuẩn đầu ra / Phân tích / Phiên bản, kèm hàng tab thứ hai)
├── routes.ts              ROUTES — mọi đường dẫn
├── features/<f>/
│   ├── api/               hàm gọi + khóa truy vấn của tài nguyên
│   ├── hooks/             useQuery / useMutation
│   ├── pages/<Name>Page.tsx   một tệp cho mỗi màn hình, test cạnh tệp
│   └── schema/            `rules` cho AntD Form
│   (auth, health, home, users, permissions, org-units, subject-groups, courses, equivalence-groups, programs, curriculum, consistency, syllabi, outcomes, change-requests, notifications, releases)
├── shared/
│   ├── api/               client.ts (getJson, sendJson, ApiError, header CSRF), queryClient.ts, errorCodes.ts, schema.d.ts (sinh từ OpenAPI, có trong git)
│   ├── auth/              me.ts, useMe, useLogout, RequireAuth, permissions.ts, useCan, RequirePermission
│   ├── org-units/         orgUnits.ts, useOrgUnits, OrgUnitSelect — dùng chung cho mọi ô chọn đơn vị
│   ├── subject-groups/    subjectGroups.ts, useSubjectGroups — danh sách nhóm dùng chung (cây đơn vị, trang nhóm, bộ lọc và biểu mẫu học phần)
│   ├── constants/         versionLabels.ts (nhãn trạng thái phiên bản); `editPath.ts` cũ đã bỏ ở F-13 — nút "Tạo đề xuất" nay là liên kết thật (`shared/change-requests/`)
│   ├── forms/             applyFieldErrors.ts — đặt lỗi nghiệp vụ của máy chủ dưới ô theo `details.field`; errorMessage; credits.ts — `CREDITS_PATTERN`, `CREDITS_MESSAGE` cho mọi biểu mẫu nhập tín chỉ
│   ├── users/             userOptions.ts, UserSelect — ô tìm tài khoản đang hoạt động
│   ├── courses/           courseSearch.ts, CourseSelect, CourseMultiSelect — ô tìm học phần đang sử dụng (F-05; F-07 dùng lại)
│   ├── hooks/             useDebouncedValue — trễ giá trị cho ô tìm kiếm từ xa; useUrlQuery — giữ bộ lọc/trang danh sách trên URL (ProgramListPage, CourseListPage, ChangeRequestListPage, ApprovalQueuePage)
│   ├── components/        SortableRow (@dnd-kit, dùng cho khung, tuần, CLO, PLO); rich-text/ — trình soạn Tiptap (F-10)
│   ├── decimal/           cộng, so sánh số thập phân dạng chuỗi (F-07)
│   ├── curriculum/, outcomes/  gốc khóa truy vấn dùng chung; useSeesMatrices (ẩn thẻ ma trận với người chỉ có R6)
│   ├── change-requests/   CreateRequestButton, RequestDraftBanner, RequestStatusTag, requestFormLink — nút "Tạo đề xuất" ở mọi màn hình có `editPath` (F-13)
│   ├── notifications/     NotificationBell ở Header, useNotifications (F-14)
│   ├── releases/          SemesterSelect, CohortSelect, useReleaseOptions (F-15)
│   ├── validity/          nhãn, màu và định dạng ngày của trạng thái hiệu lực
│   └── layout/            navigationMemory.ts (AppLayout ghi pathname+search; BackLink về URL cuối của đích; `preferHistory` dùng navigate(-1)); AppLayout.tsx (Header, Sider, Content), menuItems.tsx (mục menu kèm quyền cần; mục có `children` thành nhóm, ví dụ "Học phần" › Danh mục học phần, Nhóm tương đương; mục có `hideForRoles` ẩn khi mọi vai trò người gọi nằm trong danh sách — "Chương trình đào tạo" ẩn với người chỉ có R6, chỉ để hiển thị)
└── test/setup.ts          jest-dom, bản giả ResizeObserver cho Vitest
```

| Quy tắc              | Cách làm hiện tại                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dữ liệu từ máy chủ   | TanStack Query; khóa truy vấn đặt cạnh hàm gọi trong `api/`                                                                                                                                           |
| Phiên phía giao diện | Chỉ truy vấn `GET /api/auth/me`; 401 `SESSION_REQUIRED` ở bất kỳ đâu đặt `me` về `null` (`queryClient.ts`); `RequireAuth` chuyển về `/login` kèm trang đang mở, `mustChangePassword` ép về `/account` |
| Quyền phía giao diện | `MeDto.permissions` là union kiểu (enum OpenAPI); `useCan(code)` đọc từ `useMe`; menu chỉ hiện mục người dùng có quyền; route bọc `RequirePermission`. Chỉ để ẩn hiện — máy chủ vẫn kiểm              |
| Phân trang           | `withQuery` + `shared/api/pagination.ts` khớp `PageQueryDto`/`Page<T>`                                                                                                                                |
| Lỗi API              | `ApiError` mang `ErrorResponseDto`; hiển thị `message` của máy chủ                                                                                                                                    |
| Biểu mẫu             | AntD `Form` với `rules`                                                                                                                                                                               |
| Kiểu API             | `components['schemas'][...]` từ `schema.d.ts`; không viết tay                                                                                                                                         |
| Đường dẫn            | Lấy từ `ROUTES`                                                                                                                                                                                       |
| Thành phần giao diện | Ant Design 6; ngôn ngữ `vi_VN`, dayjs `vi`                                                                                                                                                            |
| Phát triển           | Vite chuyển `/api` sang `http://localhost:3000` — cùng một nguồn như khi Caddy phục vụ                                                                                                                |

---

## 4. Luồng một yêu cầu

```
Trình duyệt ──/api/...──► (Vite proxy | Caddy) ──► NestJS
                                                   ├─ ValidationPipe (DTO)
                                                   ├─ Controller → Service
                                                   ├─ PrismaService ──► PostgreSQL 18 (ICU vi-VN)
                                                   └─ Queue ──► Redis 8 ──► Worker BullMQ
```

## Nhập, xuất Excel (F-09)

### Module và hàng đợi

- `source/backend/src/features/imports/imports.module.ts` được AppModule nạp, đăng ký queue `imports`, hai controller nhập/xuất và ImportsProcessor. Đây là processor tiếp nối release-activation của F-15, không phải worker đầu tiên.
- `source/backend/src/shared/queue/queue.module.ts` cấp cấu hình Redis và `BULLMQ_PREFIX` dùng chung. Job validate/commit có id `<name>-<batchId>`, 3 lần thử với exponential backoff 5 giây; kiểm trạng thái và đọc lại batch dưới khóa làm retry không ghi trùng.
- `source/backend/src/features/imports/imports.processor.ts` đọc Excel, chạy thử không ghi nghiệp vụ, rồi kiểm lại và ghi toàn bộ trong một transaction khi chủ phiên xác nhận. Scheduler `imports-sweep` dùng upsertJobScheduler lúc 02:00 Asia/Ho_Chi_Minh: xóa tệp hết hạn 30 ngày và chuyển phiên đang xử lý quá 1 giờ sang ABORTED, không xóa lịch sử.
- Khi shutdown, chờ tác vụ hiện tại tối đa 10 giây, đóng worker bằng close(true), rồi queue.getBackend().close(true). Đóng backend cưỡng bức trước hook queue tự động của Nest tránh chờ Redis QUIT vô hạn khi Redis mất; không bỏ grace hoặc thay đổi retry.

### Quy tắc dùng chung và giao diện

- `source/backend/src/shared/courses/course-owners.ts` tập trung kiểm đơn vị/nhóm sở hữu; `source/backend/src/shared/curriculum/curriculum-row-rules.ts` tập trung kiểm học kỳ và dữ liệu dòng. Luồng nhập tái sử dụng quy tắc với CRUD thay vì phụ thuộc service feature khác.
- `source/frontend/src/shared/api/client.ts` cung cấp sendForm (multipart, cookie/CSRF, không tự đặt Content-Type) và downloadFile (tệp tải về, tên từ response). `source/frontend/src/features/imports/hooks/useImports.ts` chỉ polling VALIDATING/COMMITTING và làm mới cache liên quan khi quan sát COMMITTED.
- Quyền đặt trên route; service kiểm loại nhập, phạm vi, trạng thái và chủ phiên. Chỉ nhập khung vào Nháp thông thường của chương trình chưa từng ban hành; không mở đường nhập vào Nháp của đề xuất/đính chính. Lịch sử vẫn đọc được khi tệp gốc hết hạn.

## Công thức điểm (F-12) — hợp đồng chung

- Thứ tự khóa khi ghi công thức hoặc ánh xạ: yêu cầu thay đổi rồi bản đề cương (`syllabus-assessment-lock.ts`), cùng thứ tự với gửi duyệt và ban hành để không đua tranh.
- `gradingEditPath` là năng lực riêng với đường sửa nội dung: null khi người gọi không có ô quyền `gradingFormula.edit` trên bản sao yêu cầu.
- GRADING_FORMULA nay đi qua duyệt cuối như các loại đề cương khác; chỉ ORGANIZATION nằm ngoài duyệt cuối.
- Trình sửa đề cương vào được khi có một trong ba quyền (nội dung, CLO, công thức); guard route dùng `RequireAnyPermission`.

## Điều kiện đăng ký (F-18) — transaction và privacy boundary

- HTTP `features/registration-eligibility/` chỉ giữ concrete DTO/controller, whitelist mapper và scoped picker. Domain `shared/registration-eligibility/` giữ vocabulary, bulk frozen context, academic evidence, iterative SCC evaluator và actor-bound reader. Shared module nhập StudentsSharedModule, không nhập StudentsModule/service của feature khác.
- Mỗi answer dùng một RepeatableRead snapshot; supplied tx được truyền nguyên vẹn cho F-17 và context reader, không nested transaction. Input bắt buộc studentId/programId/semesterId, không nhận version override hoặc transcript do client cung cấp. evaluatedAt là thời điểm bắt đầu phép tính trên current authoritative facts, không chứng nhận immutable historical replay.
- Main GET hỗ trợ R1/R3 trong scope và own R6; staff picker riêng dùng SQL temporal membership cùng purpose ELIGIBILITY. Hai route no-store/private, không public/system bypass. Không table/migration, worker, Redis cache, dependency hoặc write path mới.
- Client shared registration-eligibility components chỉ nhập shared primitives/generated schema. Curriculum feature sở hữu request/query/context composition; F-20 có thể dùng presentation chung và server facade sau này. Logout giữ clear toàn bộ QueryClient; đổi subject/context hủy và xóa query cá nhân, kiểm identity/version/item set trước render.

## Xét tốt nghiệp (F-19) — wiring

- `AppModule` nạp `GraduationModule`; module này nạp `GraduationSharedModule` (`src/shared/graduation/`: vocabulary, access/capability, input reader/codec, engine/allocation, audit writer, notification writer) và đăng ký BullMQ queue `graduation-review`. Không import trực tiếp feature module khác.
- Queue có bốn job: `run-batch`, `scan-result-changes` (lặp mỗi 5 giây), `run-reaudit`, `recover-graduation`; 3 lần thử, exponential backoff 5 giây. Batch và task xét lại giữ lease 60 giây trong DB, gia hạn/rào bằng `clock_timestamp()`; bộ phục hồi đọc trạng thái DB để chạy tiếp, không dựa vào job còn trong Redis.
- Xung đột serialization 40001/40P01 được thử tối đa 4 lần trong job (1 lần đầu + `GRADUATION_LIMITS.TRANSACTION_RETRIES` = 3), hết lượt thì hoãn ở mức WARN; `Error` không phân loại mang mã `UNCLASSIFIED_EXECUTION`, log đã khử dữ liệu sinh viên.
- Producer F-17 không đổi: scanner đọc `AcademicResultChange`, ghi `GraduationResultChangeReceipt` bền rồi tạo task cho các context đã có audit.

## Sao lưu và diễn tập phục hồi (F-26) — wiring

- `AppModule` nạp `BackupsModule` (`src/features/backups/`: controller chỉ đọc, service tính trạng thái, scheduler, processor BullMQ). Phần lõi nằm ở `src/shared/backups/`: `backup-engine` (dump + sao tệp + chụp nội dung đã ban hành), `backup-store` (danh mục trên đĩa), `backup-retention` (giữ 30 bộ), `restore-drill`, `restore-verifier`, `upgrade-verifier`. Không import feature module khác.
- Hàng đợi `backup` dùng job scheduler của BullMQ, cron `0 2 * * *` múi giờ `Asia/Ho_Chi_Minh`; tối đa 6 lần thử, backoff mũ bắt đầu 60 giây. Khi khởi động chỉ bù **một** lần hẹn gần nhất đã đến hạn. Mọi thao tác chạy dưới một khóa cố định (`OPERATION_LOCK_KEY`) và giới hạn an toàn 30 phút.
- Nguồn sự thật là **danh mục JSON trên đĩa dưới `BACKUP_ROOT`**, không có bảng hay migration mới. Một bộ gồm `database.dump`, `files/`, `released-content.json`, `manifest.json`; ghi vào thư mục tạm rồi công bố bằng đổi tên. Bộ hỏng không bao giờ đẩy bộ tốt ra khỏi 30 bộ.
- API chỉ đọc dưới `/api/operations/` (`backups/status`, `backups`, `restore-drills`), quyền `backup.view` (mặc định R1). Trang không phục hồi, không tải bản sao, không chạy hay xóa.
- Phục hồi là CLI `pnpm backup:drill` (`scripts/backup-restore-drill.ts`) chạy ngoài tiến trình ứng dụng: chỉ ghi vào cơ sở dữ liệu có tên khớp `ctdt_restore_drill_*` và thư mục mới, không `DROP`, `--clean` hay xóa đệ quy trên đường dẫn do người vận hành đưa vào. Lệnh `inspect` kiểm một bộ đã tách chỉ bằng Node.
- Cần PostgreSQL client **18** (`PG_DUMP_PATH`, `PG_RESTORE_PATH`) trên máy chạy backend. Quy trình đầy đủ: `docs/technical/backup-restore-runbook.md`.
