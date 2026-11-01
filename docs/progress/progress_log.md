# Progress Log

Append-only. Each entry records what was completed for a task, with a timestamp.
Never edit or delete past entries. Newest entries go at the bottom.

Format:

```
## [TASK_ID] Task Name
**Date**: YYYY-MM-DD
**Files changed**: list of files
- bullet: what was done / added / decided
```

---

## [DOCS] Yêu cầu, thiết kế, kế hoạch

**Date**: 2026-10-01 .. 2026-10-15
**Files changed**: `docs/requirement/REQUIREMENTS.md`, `docs/Bo_so_do_Use_Case_CTDT/*`, `docs/design/*`, `docs/planning/*`, `docs/notes/*`, `docs/reference/*`

- Gộp yêu cầu về một SRS (`REQUIREMENTS.md`): 109 FR, NFR, BR, EC, câu hỏi Q-01..Q-28.
- Thiết kế: ERD, từ điển dữ liệu, sơ đồ trạng thái, sơ đồ tuần tự, danh mục màn hình, bảng tên SRS ↔ tên lập trình (`naming-map.md`).
- RBAC theo từng quyền: `Permission`, `RolePermission` (ghi thẳng / qua đề xuất, toàn bộ / theo phạm vi), 40 quyền khởi tạo; vai trò tự định nghĩa để sau (E-13).
- Kế hoạch: sáu bậc B1..B6, 116 story, 277 việc, kế hoạch sprint, kế hoạch kiểm thử.
- Quy định của Trường (tệp docx mới): các yêu cầu chưa làm ghi ở `docs/planning/deferred-scope.md` (R-1..R-7).

## [F-00] Khung mã nguồn

**Date**: 2026-10-15
**Files changed**: `source/backend/**`, `source/frontend/**`, `docs/design/tech-stack.md`, `docs/requirement/REQUIREMENTS.md`

- Chốt công nghệ (Q-16): TypeScript, Node.js 22, NestJS + Prisma + PostgreSQL 18, BullMQ trên Redis 8, React + Vite + Ant Design.
- Backend: cấu hình kiểm khi khởi động, PrismaService kiểm ICU `vi-VN`, QueueModule, `GET /api/health`, Swagger; kiểm thử đơn vị và đầu-cuối bằng Testcontainers.
- Frontend: Ant Design `vi_VN`, TanStack Query, React Router, kiểu sinh từ OpenAPI, trang Trạng thái hệ thống kèm kiểm thử.
- Hai dự án pnpm độc lập, mỗi bên `node_modules` riêng.

## [INIT] Thiết lập Claude Code và tài liệu dự án

**Date**: 2026-10-17
**Files changed**: `.claude/settings.json`, `.claude/agents/*`, `.claude/hooks/*`, `.claude/commands/sync-docs.md`, `.claude/rules/*`, `CLAUDE.md`, `docs/architecture/*`, `docs/technical/technical_reference.md`, `docs/implementation/README.md`, `docs/progress/*`, `docs/testing/*`, `docs/troubleshooting/error_log.md`, `docs/planning/feature-questions.md`

- Áp mẫu `claude-code-templates` (universal + nestjs + react-vite). Ba agent build-verifier, architecture-reviewer, debugger gộp hai phía, dùng lệnh pnpm và đường dẫn `source/*`.
- `CLAUDE.md` ghi các điểm lệch đã chốt so với rule của stack (Ant Design, pnpm, oxlint, Vitest, phiên cookie thay JWT).
- Tài liệu kiến trúc ghi đúng khung đã dựng; danh sách 27 tính năng ở `docs/implementation/README.md`.
- Câu hỏi của từng tính năng kèm phương án đề xuất: `docs/planning/feature-questions.md`.

## [Q-FEAT] Trả lời câu hỏi theo tính năng

**Date**: 2026-10-18
**Files changed**: `docs/planning/feature-questions.md`, `docs/progress/current_work.md`, `docs/progress/todo.md`

- 22 câu trả lời trực tiếp; các câu còn lại nhận phương án A.
- Khác đề xuất: khóa chính `cuid`; chưa làm nhật ký kiểm toán (US-002, US-003); Học phần–PLO nhập trực tiếp kèm trọng số, CLO–PLO không mang mức.

## [PLANS] Kế hoạch triển khai F-01..F-11

**Date**: 2026-10-18
**Files changed**: `docs/implementation/f-01..f-11-*-implementation-plan.md`, `docs/implementation/README.md`, `docs/planning/test-plan.md`, `docs/planning/user-stories.md`, `docs/design/naming-map.md`

- Mười một kế hoạch, mỗi kế hoạch phủ cả backend và frontend, kèm hợp đồng API, quyết định, ràng buộc cho tính năng sau (§8).
- Sửa tài liệu theo trả lời F11-02, F11-03: US-044, US-046, US-048; KB-033, NT-B3-03, NT-B3-04; `mucDoDongGop` → `weight`.

## [MVP] Chốt bản MVP

**Date**: 2026-10-18
**Files changed**: `docs/planning/epics.md`, `docs/implementation/README.md`, `docs/progress/todo.md`, `docs/progress/current_work.md`

- MVP = F-01..F-08, F-10, F-11, F-13, F-14, F-15 (298 / 519 điểm); phần còn lại làm sau, phạm vi không đổi.
- F-08 được thêm vào đề xuất ban đầu vì F-13, F-15 phải gọi `ConsistencyChecker.assertPasses`.

## [PLANS] Kế hoạch triển khai F-13, F-14, F-15 — đủ MVP

**Date**: 2026-10-18
**Files changed**: `docs/implementation/f-13-change-requests-implementation-plan.md`, `docs/implementation/f-14-three-level-approval-notifications-implementation-plan.md`, `docs/implementation/f-15-release-version-snapshots-implementation-plan.md`, `docs/implementation/README.md`, `docs/progress/todo.md`, `docs/progress/current_work.md`

- Đủ 13 kế hoạch MVP; chưa dựng mã.
- F-15: bảng `Semester`, `Cohort`, `CohortVersion`; số phiên bản `major.minor`; ảnh chụp tên và tín chỉ học phần lúc ban hành; kích hoạt đầu học kỳ bằng hàng đợi `release-activation`; đính chính phiên bản.
- F-15 thêm `ChangeRequest.createdByAcademicOffice` vào mô hình F-13 và đổi vài hành vi của F-13, F-14 (ghi ở §2c của kế hoạch F-15).

## [F-01] Đăng nhập, phiên — dựng mã

**Date**: 2026-10-18
**Files changed**: `source/backend/src/features/{auth,health}/*`, `source/backend/src/shared/{config,prisma,queue,exception,dtos,filter,session,password,auth}/*`, `source/backend/prisma/{schema.prisma,seed.ts,migrations/20261018141101_auth_session}`, `source/backend/test/*`, `source/backend/package.json`, `source/frontend/src/features/{auth,health,home}/*`, `source/frontend/src/shared/{api,auth,layout}/*`, `source/frontend/src/{main.tsx,router.tsx,routes.ts}`, `docs/architecture/*`, `docs/technical/technical_reference.md`, `docs/implementation/{README.md,f-01-auth-session-implementation-plan.md}`, `docs/implement-report/f-01-auth-session-implement-report.md`, `docs/progress/*`

- Chuyển cả hai dự án sang bố cục `features/` + `shared/`; bộ lọc lỗi toàn cục `ErrorResponseDto`; `CsrfGuard`, `AuthenticatedGuard` toàn cục; phiên cookie `ctdt.sid` trong bảng `session` (PostgreSQL), hết hạn sau `SESSION_IDLE_MINUTES`.
- `User`, `session`, `UserStatus` — migration `20261018141101_auth_session` sinh bằng `migrate diff --from-empty`; seed tài khoản R1 (`pnpm prisma:seed`, chưa chạy trên cơ sở dữ liệu thật).
- API `/api/auth/{login,logout,me,change-password}`; màn hình MH-01, MH-02, MH-03; `RequireAuth` và ép đổi mật khẩu lần đầu.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 26/26, đầu-cuối 14/14; frontend tsc 0, oxlint 0, đơn vị 20/20, `vite build` ổn; Prettier sạch. Dựng qua Codex (6 lượt), bộ điều phối chạy Vitest/Prisma.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7). Sự cố lúc dựng và lệch kế hoạch ở báo cáo dựng.

## [2026-10-18] [F-01] Đi thử bằng trình duyệt — xong

- Áp migration `20261018141101_auth_session` lên cơ sở dữ liệu phát triển, chạy seed (`admin`); người dùng đi thử 6 bước của kế hoạch §7, đạt. F-01 ✅.

## [F-02] Tài khoản, vai trò, phạm vi quyền — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,seed.ts,seed-data/*,migrations/20261018151319_access_control}`, `source/backend/src/shared/{authz,pagination,time,password,dtos}/*`, `source/backend/src/features/{users,permissions,org-units}/*`, `source/backend/src/app.module.ts`, `source/backend/test/*`, `source/frontend/src/shared/{api,auth,org-units,layout}/*`, `source/frontend/src/features/{users,permissions}/*`, `source/frontend/src/{router.tsx,routes.ts,test/setup.ts}`, `docs/architecture/*`, `docs/technical/technical_reference.md`, `docs/implementation/{README.md,f-02-accounts-roles-permissions-implementation-plan.md}`, `docs/implement-report/f-02-accounts-roles-permissions-implement-report.md`, `docs/progress/*`

- `PermissionGuard` toàn cục, từ chối mặc định; `@RequirePermission` / `@AnyAuthenticated`; `AccessContext` nạp mỗi yêu cầu qua `ScopeService`; vai trò suy ra theo `Role.scopeSource`.
- Bảng `OrgUnit` (tối thiểu), `Role`, `Permission`, `RolePermission`, `RoleAssignment`, `User.orgUnitId` — migration `access_control` đã áp; seed 3 đơn vị, 6 vai trò, 41 quyền, 123 ô, chạy lại không đổi.
- API tài khoản, gán/thu hồi vai trò, ma trận quyền; màn hình MH-05, MH-06, MH-15; menu và route lọc theo quyền.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 66/66, đầu-cuối 39/39; frontend tsc 0, oxlint 0, đơn vị 35/35, `vite build` ổn; Prettier sạch. Dựng qua Codex (4 lượt), bộ điều phối sinh migration và chạy kiểm thử.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7). Sự cố lúc dựng ở báo cáo dựng; không có lỗi đã phát hành nên không ghi `error_log.md`.

## [F-03] Đơn vị và nhóm chuyên môn — hoàn thiện mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,migrations/20261019024639_subject_groups}`, `source/backend/src/shared/{time,subject-groups,authz}/*`, `source/backend/src/features/{org-units,subject-groups,users}/*`, `source/backend/test/*`, `source/frontend/src/shared/{api,auth,layout,subject-groups,users,validity}/*`, `source/frontend/src/features/{org-units,subject-groups,users}/*`, `source/frontend/src/{router.tsx,routes.ts}`, `docs/architecture/*`, `docs/implementation/README.md`, `docs/implement-report/f-03-org-units-subject-groups-implement-report.md`, `docs/progress/*`

- Quản lý cây đơn vị (thêm, sửa, chuyển, ngừng, kích hoạt lại; không xóa), nhóm chuyên môn kèm danh sách ảnh hưởng khi ngừng, thành viên và Điều phối có khoảng hiệu lực; R4, R5 suy ra từ hàng đang hiệu lực trong nhóm `ACTIVE`; `validity.ts` dùng chung thay hàm riêng của F-02.
- Màn hình MH-07, MH-08 (danh sách, chi tiết), thẻ nhóm trên MH-06; ô chọn `UserSelect` dùng chung; menu và route theo quyền.
- Hoàn thiện: sửa 6 ca kiểm thử giao diện hỏng (`UserSelect` đẩy thừa đối số, kiểm thử trang thiếu router/`retry:false`, cây đơn vị không mở nút cha vừa có con), bỏ mục menu trùng.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 101/101, đầu-cuối 69/69 (Testcontainers); frontend tsc 0, oxlint 0, đơn vị 44/44, `vite build` ổn; Prettier sạch ở cả hai.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7); áp migration lên cơ sở dữ liệu phát triển. Chi tiết sự cố ở báo cáo dựng.

## [F-04] Danh mục học phần — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,seed-data/org-units.ts,migrations/20261019072717_courses}`, `source/backend/src/shared/{authz/edit-path*,courses,decimal,org-units,dtos,exception}/*`, `source/backend/src/features/{courses,subject-groups}/*`, `source/backend/src/app.module.ts`, `source/backend/test/*`, `source/frontend/src/shared/{api,auth,layout,forms}/*`, `source/frontend/src/features/courses/*`, `source/frontend/src/{router.tsx,routes.ts}`, `docs/architecture/*`, `docs/implementation/{README.md,f-04-course-catalog-implementation-plan.md}`, `docs/implement-report/f-04-course-catalog-implement-report.md`, `docs/progress/*`

- Bảng `Course` (`Decimal(5,2)`, mã duy nhất, không sửa mã), `CourseType`, `CourseStatus` — migration `20261019072717_courses` sinh bằng `prisma migrate dev` trên PostgreSQL 18 thật; seed chạy hai lần không đổi.
- Quy tắc "sửa trực tiếp hay qua đề xuất" lần đầu viết thành hàm dùng chung `resolveEditPath` / `assertDirectEdit` (`shared/authz/edit-path.ts`) và lỗi 409 `CHANGE_REQUEST_REQUIRED`; `CourseUsageReader` trả "không có" cho bốn sự thật của F-05, F-07, F-15, F-17; `HOME_FACULTY_CODE` định nghĩa "khoa khác".
- API danh mục (tìm, lọc, sắp xếp, phân trang), chi tiết kèm `editPath` / `canChangeStatus`, thêm, sửa, ngừng mở lớp / mở lại / hủy (không xóa); danh sách ảnh hưởng khi ngừng nhóm nay liệt kê học phần chưa hủy của nhóm. `SubjectGroupRefDto`, `CourseRefDto` chuyển sang `shared/dtos/ref.dto.ts`.
- Màn hình MH-16 (danh sách), MH-17 (chi tiết, đổi trạng thái có hộp xác nhận), MH-18 (biểu mẫu); menu "Học phần", route theo quyền; `applyFieldErrors` dùng chung.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 149/149 (24 tệp), đầu-cuối 97/97 (8 tệp, Testcontainers, gồm ca đo 500 học phần dưới 2 giây); frontend tsc 0, oxlint 0, đơn vị 65/65 (19 tệp), `vite build` ổn; Prettier sạch ở cả hai.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7) và áp migration lên cơ sở dữ liệu phát triển. Điểm lệch kế hoạch ở báo cáo dựng.

## [F-05] Quan hệ học phần, nhóm tương đương — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,migrations/20261019075207_course_relations}`, `source/backend/src/shared/{courses,authz/edit-path*,decimal}/*`, `source/backend/src/features/{course-relations,equivalence-groups,courses}/*`, `source/backend/src/app.module.ts`, `source/backend/test/*`, `source/frontend/src/shared/{api,auth,courses,hooks,layout,users}/*`, `source/frontend/src/features/{courses,equivalence-groups}/*`, `source/frontend/src/{router.tsx,routes.ts}`, `docs/architecture/*`, `docs/implementation/{README.md,f-05-course-relations-equivalence-implementation-plan.md}`, `docs/implement-report/f-05-course-relations-equivalence-implement-report.md`, `docs/progress/*`

- Bảng `CourseRelation` (bốn loại, `minScore Decimal(4,2)`, duy nhất theo bộ ba, hai `CHECK` viết tay), `EquivalentCourseGroup`, cột `Course.equivalenceGroupId` — migration `20261019075207_course_relations` sinh bằng `prisma migrate dev` trên PostgreSQL 18 thật.
- Chống chu trình BR-11: hàm thuần `findRequisiteCycle` (`shared/courses/requisite-graph.ts`, F-07 và F-09 dùng lại) chạy dưới khóa `pg_advisory_xact_lock`; thông điệp nêu đường đi `A → B → C → A`; song hành và thay thế không bị kiểm. Hai yêu cầu song song B→A và A→B: đúng một bên thành công.
- Điền hai móc của F-04: `CourseUsageReader.hasActiveReplacement` (đọc quan hệ `REPLACEMENT` tới học phần `ACTIVE`, nhận `tx`) và ngừng mở lớp nhận `replacementCourseId`, tạo quan hệ cùng giao dịch; ngừng mở lớp nay đi được đường thành công (KB-008). Chi tiết học phần thêm `equivalenceGroup`.
- Nhóm tương đương (tạo, sửa, thêm, bớt, gộp, giải thể) chỉ R1 qua `assertSchoolWideDirect`; học phần ở nhóm khác → 409 kèm lời mời gộp.
- Giao diện: mục "Quan hệ học phần" và thẻ "Học phần tương đương" trên MH-17, hộp thoại ngừng mở lớp chọn học phần thay thế, MH-19 `/equivalence-groups`, menu "Học phần" thành nhóm; `CourseSelect`, `CourseMultiSelect`, `useDebouncedValue` dùng chung.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 223/223 (28 tệp), đầu-cuối 130/130 (10 tệp, Testcontainers); frontend tsc 0, oxlint 0, đơn vị 93/93 (24 tệp), `vite build` ổn; Prettier sạch ở cả hai.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7) và áp migration lên cơ sở dữ liệu phát triển. Điểm lệch kế hoạch ở báo cáo dựng.

## [F-06] Thông tin chương trình, Giám đốc CTĐT — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,seed.ts,seed-data/programs.ts,migrations/20261019082727_programs}`, `source/backend/src/shared/{programs,authz/scope-source.reader*,dtos/ref.dto.ts}/*`, `source/backend/src/features/programs/*`, `source/backend/src/app.module.ts`, `source/backend/test/*`, `source/frontend/src/shared/{api,auth,constants,forms,layout}/*`, `source/frontend/src/features/{programs,courses}/*`, `source/frontend/src/{router.tsx,routes.ts}`, `docs/architecture/*`, `docs/implementation/{README.md,f-06-programs-directors-implementation-plan.md}`, `docs/implement-report/f-06-programs-directors-implement-report.md`, `docs/progress/*`

- Bảng `Program`, `ProgramVersion` (mô tả ở phiên bản, tín chỉ `Decimal(5,2)`), `ProgramDirectorAssignment`, ba enum — migration `20261019082727_programs` sinh bằng `prisma migrate dev` trên PostgreSQL 18 thật, nối tay hai chỉ mục duy nhất từng phần (một Nháp, một Đang hiệu lực mỗi chương trình); chạy lại báo "Already in sync".
- Danh sách, tổng quan, thêm (kèm bản Nháp trong một lần ghi), sửa thông tin ở bản Nháp, ngừng/dùng lại (không xóa), nhân bản; tổng tín chỉ lệch bị chặn kèm "chênh lệch N tín chỉ" (BR-03, KB-011); sinh viên bị từ chối danh sách.
- Giám đốc CTĐT có thời hạn: phân công, kết thúc (chỉ rút ngắn), thu hồi, lịch sử; nhiều người cùng lúc, cùng một người không chồng thời hạn. `ScopeSourceReader` điền `PROGRAM_DIRECTOR` qua `activeDirectorWhere`: R3 chỉ sửa chương trình mình phụ trách và mất quyền ngay khi hết hạn.
- `VersionContentCopier` (shared) là chỗ cắm cho F-07, F-11, F-13, F-15; `programTarget`, `programEditState` dùng chung. Dời tooltip đề xuất và mẫu tín chỉ sang `shared/`.
- Màn hình MH-21..MH-24 (danh sách, tổng quan kèm Giám đốc, biểu mẫu kèm gợi ý chênh lệch, hộp nhân bản); menu "Chương trình đào tạo" ẩn với người chỉ có R6. Seed chương trình 1024034 với số liệu giữ chỗ.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 269/269 (31 tệp), đầu-cuối 158/158 (11 tệp, Testcontainers); frontend tsc 0, oxlint 0, đơn vị 119/119 (28 tệp), `vite build` ổn; Prettier sạch ở cả hai.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7), áp migration lên cơ sở dữ liệu phát triển, thay số liệu giữ chỗ của 1024034. Điểm lệch kế hoạch ở báo cáo dựng.

## [F-07] Khung chương trình, nhóm tự chọn — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,seed.ts,seed-data/{programs,knowledge-blocks}.ts,migrations/20261019085325_curriculum}`, `source/backend/src/shared/{curriculum,programs,courses,dtos}/*`, `source/backend/src/features/{curriculum,programs,courses,course-relations}/*`, `source/backend/src/app.module.ts`, `source/backend/test/*`, `source/frontend/package.json`, `source/frontend/src/shared/{api,auth,constants,courses,decimal}/*`, `source/frontend/src/features/{curriculum,programs,courses}/*`, `source/frontend/src/{router.tsx,routes.ts}`, `docs/architecture/*`, `docs/technical/technical_reference.md`, `docs/implementation/{README.md,f-07-curriculum-elective-groups-implementation-plan.md}`, `docs/implement-report/f-07-curriculum-elective-groups-implement-report.md`, `docs/progress/*`

- Bảng `KnowledgeBlock`, `ElectiveGroup`, `CurriculumItem`, `CurriculumRequisite` và sáu `CHECK` viết tay — migration `20261019085325_curriculum` sinh bằng `prisma migrate dev --create-only` trên PostgreSQL 18 thật (ICU `vi-VN`); chạy lại báo "Already in sync"; seed chạy hai lần không trùng.
- Feature `curriculum`: đọc khung (dòng, tổng theo học kỳ và khối, cảnh báo học kỳ trống / điều kiện xếp sau), thêm-sửa-xóa dòng (trùng học phần, học kỳ vượt số học kỳ, R4/R5 chỉ dòng của nhóm mình), sắp xếp trong học kỳ, điều kiện riêng của khung (chép từ danh mục lúc thêm dòng; chống vòng trên hợp cạnh danh mục và khung dưới `lockRequisiteGraph`), nhóm tự chọn (tối thiểu tín chỉ hoặc học phần, dòng bắt buộc bị chặn).
- Điền các móc của F-04..F-06: `VersionContentCopier.copy` chép nhóm, dòng, điều kiện (ánh xạ lại id); `ProgramsService.update` chặn `semesterCount` thấp hơn học kỳ đã xếp (`SEMESTERS_BELOW_CURRICULUM`); `CourseUsageReader.programsUsing` / `inReleasedVersion` đọc từ khung; `GET /courses?status=` nhận danh sách. `ProgramsService.clone` tách sang `ProgramCloneService`.
- Giao diện: MH-25 (dòng / theo học kỳ, lọc, tổng, cảnh báo, kéo thả bằng `@dnd-kit` có bàn phím, hộp thoại dòng và điều kiện), MH-26 (nhóm tự chọn, `Transfer`), "Chương trình đang sử dụng" ở chi tiết và sửa học phần, các thẻ tổng quan chương trình thành liên kết; `CourseSelect` nhận `statuses`; `withQuery` nhận mảng.
- Kiểm tra: backend tsc 0, oxlint 0, đơn vị 358/358 (41 tệp), đầu-cuối 193/193 (12 tệp, Testcontainers); frontend tsc 0, oxlint 0, đơn vị 173/173 (35 tệp), `vite build` ổn; Prettier sạch ở cả hai.
- Còn nợ: đi thử bằng trình duyệt (kế hoạch §7), áp migration lên cơ sở dữ liệu phát triển, bảng khối kiến thức còn rỗng (chưa có tệp Excel). Điểm lệch kế hoạch ở báo cáo dựng.

## [F-08] Kiểm tra nhất quán — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,migrations/20261019092846_credit_mismatch_acceptance}`, `source/backend/src/shared/curriculum/*`, `source/backend/src/features/{consistency,curriculum}/*`, `source/backend/src/app.module.ts`, `source/backend/test/*`, `source/frontend/src/features/{consistency,curriculum,programs}/*`, `source/frontend/src/{router.tsx,routes.ts}`, `source/frontend/src/shared/api/schema.d.ts`, `docs/{implement-report,progress,implementation}/*`

- Năm cột chấp nhận chênh lệch trên `ProgramVersion` (một `CHECK` năm-hoặc-không), `programCredits` (nhóm tự chọn tính theo mức tối thiểu), `curriculumWarnings` mở rộng (6 mã mới, mức `ERROR`), `ConsistencyChecker.check` / `assertPasses` dùng chung, hai route `GET …/consistency` và `PUT …/credit-mismatch-acceptance`.
- Giao diện MH-27, dòng tổng chương trình ở MH-25, nút và thẻ "Kiểm tra nhất quán", `?focus=` làm nổi dòng/nhóm.
- Kiểm tra: backend đơn vị 391, đầu-cuối 207; frontend 190; tsc, oxlint, Prettier, build sạch.
- Còn nợ: đi thử bằng trình duyệt, áp migration lên cơ sở dữ liệu phát triển.

## [TEST] Kiểm thử đầu-cuối dùng chung một PostgreSQL và một Redis

**Date**: 2026-10-19
**Files changed**: `source/backend/test/{global-setup.ts,containers.ts,test-env.ts,*.e2e-spec.ts}`, `source/backend/vitest.config.e2e.ts`

- `globalSetup` dựng một PostgreSQL (ICU `vi-VN`) và một Redis cho cả lượt chạy, migrate một lần vào cơ sở dữ liệu mẫu `ctdt_template`; mỗi tệp kiểm thử nhận một cơ sở dữ liệu riêng sao từ mẫu (`startPostgres`), xóa khi xong. Tệp mới không gọi `applyMigrations` nữa.
- `health.e2e-spec.ts` vẫn dựng container riêng vì nó tắt Redis (`startPostgresContainer`, `startRedisContainer`).
- 207/207 đạt; thời gian chạy 116 s → 66 s.

## [F-10] Đề cương — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,migrations/20261019095730_syllabi}`, `source/backend/src/features/{syllabi,curriculum,courses}/*`, `source/backend/src/shared/{files,rich-text,courses,config,exception}/*`, `source/backend/{src/app.module.ts,src/app.setup.ts,tsconfig.json,package.json,README.md,.gitignore}`, `source/backend/test/*`, `source/frontend/src/features/{syllabi,curriculum,courses}/*`, `source/frontend/src/shared/{components,courses,curriculum,api,auth}/*`, `source/frontend/{package.json,src/router.tsx,src/routes.ts}`, `docs/{implement-report,progress,implementation}/*`

- Bảng `Syllabus`, `WeeklyContent`, `SyllabusAttachment` (hai chỉ mục duy nhất từng phần "một Nháp, một Ban hành" và bốn `CHECK` viết tay); feature `syllabi`: đọc theo học phần (Nháp chỉ cho người có `program.view` ALL), tạo bản Nháp đầu, lưu từng mục, dòng tuần (thêm, sửa, xóa, sắp xếp), tệp đính kèm trên đĩa (`FILES_ROOT`, kiểm đuôi và chữ ký tệp, 20 MB); `hasSyllabus` ở dòng khung.
- Dùng chung: `sanitizeRichText` (`sanitize-html`), `FileStorageService`, `sendFile`, `uploadedFileName`, `CourseUsageDto`; frontend: `RichTextEditor` / `RichTextView` (TipTap 3.31.4), `ProgramsUsingList`, `SortableRow`, `sendForm`, `downloadFile`.
- Giao diện MH-36 (xem, bật VI/EN, "Chưa dịch"), MH-37 (ba tab: Nội dung, Nội dung theo tuần, Đính kèm), liên kết "Đề cương" từ học phần và từng dòng khung kèm thẻ "Chưa có đề cương".
- Kiểm tra: backend đơn vị 465, đầu-cuối 238; frontend 240; tsc, oxlint, Prettier, build sạch.
- Còn nợ: đi thử bằng trình duyệt, áp migration lên cơ sở dữ liệu phát triển. Điểm lệch kế hoạch ở báo cáo dựng.

## [F-11] PLO, CLO và ma trận chuẩn đầu ra — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,migrations/20261019102707_outcomes}`, `source/backend/src/features/{outcomes,syllabi,curriculum}/*`, `source/backend/src/shared/{outcomes,syllabi,curriculum,programs,collections,prisma}/*`, `source/backend/test/*`, `source/frontend/src/features/{outcomes,syllabi,programs,curriculum}/*`, `source/frontend/src/shared/{outcomes,hooks,api}/*`

- Bảng `PLO`, `CLO`, `WeeklyContentCLO`, `CoursePLOMapping`, `CLOPLOMapping` (khóa ngoại ghép từ liên kết CLO–PLO tới ô học phần–PLO, `CHECK` trọng số 0 < w ≤ 1); feature `outcomes` (PLO, ma trận học phần–PLO có trọng số, liên kết CLO–PLO theo học phần và theo chương trình, báo cáo phủ), CLO và liên kết tuần–CLO trong feature `syllabi`.
- Dùng chung: `itemTarget`, `currentRevisionByCourse`, `outcomeGaps` + `OutcomeGapsReader`, `groupBy`, `isForeignKeyViolation`, `useSortableReorder`, `useSeesMatrices`; `VersionContentCopier` chép PLO và hai ma trận khi nhân bản.
- Giao diện MH-31..MH-35, tab CLO, cột CLO ở dòng tuần, mục CLO có bật VI/EN, thẻ ở tổng quan chương trình.
- Kiểm tra: backend đơn vị 543, đầu-cuối 267; frontend 291; tsc, oxlint, Prettier, build sạch.
- Còn nợ: đi thử bằng trình duyệt, áp migration lên cơ sở dữ liệu phát triển.

## [F-13] Đề xuất thay đổi — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,seed.ts,seed-data,migrations/20261019110535_change_requests}`, `source/backend/src/features/{change-requests,programs,curriculum,outcomes,syllabi,consistency}/*`, `source/backend/src/shared/{change-requests,syllabi,rich-text,curriculum}/*`, `source/backend/test/*`, `source/frontend/src/features/{change-requests,programs,courses,curriculum,outcomes,syllabi}/*`, `source/frontend/src/shared/*`, `docs/{implement-report,progress,implementation}/*`

- Bảng `ChangeRequest`, `ChangeItem`, `ApprovalStep`, `ApprovalLevelConfig`, `ChangeRequestDocument`; bản làm việc (`ProgramVersion` / `Syllabus` Nháp có `sourceRequestId`) sửa qua cùng các màn hình cũ nhờ `assertEditPath`; so sánh theo khóa tự nhiên; định tuyến ba cấp, bỏ qua dòng của người tạo; gửi duyệt trong một giao dịch (khóa đồ thị, `ConsistencyChecker`, kiểm tra bản gốc cũ); rút, xóa Nháp, hồ sơ đính kèm, cảnh báo chồng đề xuất.
- Giao diện MH-38..MH-41, banner bản nháp, `CreateRequestButton` thay cho nút "Tạo đề xuất" bị khóa.
- Kiểm tra: backend đơn vị 638, đầu-cuối 304; frontend 344; tsc, oxlint, Prettier, build sạch.
- Còn nợ: đi thử bằng trình duyệt, áp migration. Chi tiết ở báo cáo dựng.

## [F-14] Duyệt ba cấp và thông báo — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,migrations/20261019122753_approval_comments_notifications}`, `source/backend/src/features/{change-requests,notifications,subject-groups,programs}/*`, `source/backend/src/shared/{change-requests,notifications,session,auth,subject-groups,programs,time}/*`, `source/backend/test/*`, `source/frontend/src/features/{change-requests,notifications}/*`, `source/frontend/src/shared/{notifications,layout,api,auth}/*`, `source/frontend/src/{routes.ts,router.tsx}`

- Bảng `Comment`, `Notification`, cột `ChangeRequest.levelEnteredAt`; Đồng ý / Trả lại / Từ chối / Duyệt thay qua `ApprovalRecorder` (giành dòng đề xuất trước, cấp qua khi hết dòng PENDING), duyệt cấp 3 đề xuất tổ chức áp ngay qua `membership.writer` / `director.writer` rút từ F-03 và F-06; Từ chối và Rút xóa bản làm việc.
- Thông báo ghi trong cùng giao dịch (`RequestNotifier`); `@PassiveRequest()` và `lastActivityAt` để thăm dò số chưa đọc không giữ phiên; hàng chờ, lịch sử theo lần gửi, bình luận, lọc "chờ từ N ngày".
- Giao diện: bảng xử lý và hộp lý do ở MH-41, lịch sử và bình luận, MH-42, chuông và MH-04, cột "Số ngày chờ" ở MH-38.
- Kiểm tra: backend đơn vị 707, đầu-cuối 330; frontend 376; tsc, oxlint, Prettier, build sạch. Migration đã áp lên `ctdt-dev-pg`.
- Còn nợ: đi thử bằng trình duyệt. Điểm lệch kế hoạch ở báo cáo dựng.

## [F-15] Ban hành, ảnh chụp phiên bản — dựng mã

**Date**: 2026-10-19
**Files changed**: `source/backend/prisma/{schema.prisma,seed.ts,seed-data,migrations/20261019131021_release_versions}`, `source/backend/src/features/{semesters,releases,change-requests,programs,curriculum,outcomes,syllabi,consistency}/*`, `source/backend/src/shared/{releases,courses,curriculum,syllabi,programs,change-requests,authz,config,queue}/*`, `source/backend/test/*`, `source/frontend/src/features/{releases,change-requests,programs,syllabi}/*`, `source/frontend/src/shared/*`, `docs/{implement-report,progress,implementation}/*`

- Bảng `Semester`, `Cohort`, `CohortVersion`; ban hành khởi tạo và phê duyệt cuối, đánh số `major.minor`, ảnh chụp tên và tín chỉ, ghim đề cương; kích hoạt đầu học kỳ qua hàng đợi `release-activation`; đính chính phiên bản; `MISSING_SYLLABUS`.
- Giao diện MH-10/43/45/46/47/49.
- Kiểm tra: backend đơn vị 853, đầu-cuối 391; frontend 411; tsc, oxlint, Prettier, build sạch. Migration đã áp lên `ctdt-dev-pg`.
- Còn nợ: đi thử bằng trình duyệt. Mã MVP đã đủ.

## [DOCS] Đồng bộ tài liệu kiến trúc cuối MVP (F-07..F-15)

**Date**: 2026-10-19
**Files changed**: `docs/architecture/{general_architecture,features_architecture,database_and_models}.md`, `docs/technical/technical_reference.md`, `docs/implementation/README.md`, `source/backend/README.md`, `docs/progress/{progress_log,current_work}.md`

- `database_and_models.md`: lược đồ hiện tại `20261019131021_release_versions`; bảng migration F-08..F-15 kèm phần viết tay; bảng đề cương, PLO/CLO, đề xuất/duyệt/thông báo, học kỳ/khóa; cột mới của `ProgramVersion`, `CurriculumItem`; `ProgramVersion_one_draft` nay loại bản làm việc và Nháp đính chính; enum mới.
- `features_architecture.md`: thêm §8, §10, §11, §13, §14, §15; sửa chỗ còn tả nút "Tạo đề xuất" bị khóa.
- `general_architecture.md`: module, thư mục `shared/` mới ở cả hai phía; quy tắc đề xuất/duyệt, ban hành, `@PassiveRequest()`; e2e dùng `global-setup.ts`.
- `technical_reference.md`: Tiptap, `sanitize-html`, `@types/multer` (§7a), hàng đợi `release-activation`, biến `FILES_ROOT`, `ATTACHMENT_MAX_MB`, `BULLMQ_PREFIX`.
- `implementation/README.md`: F-08..F-15 vào mục Active. `source/backend/README.md`: ghi chú e2e, lệnh `prisma:seed`.

## [TEST] Kiểm tra chức năng MVP — tài liệu ca kiểm thử và Playwright

**Date**: 2026-10-22
**Files changed**: `docs/testing/{README.md,playwright-guide.md,test-cases/*}`, `source/e2e/`, `docs/progress/{todo,current_work,handoff,progress_log}.md`, `docs/architecture/general_architecture.md`, `docs/technical/technical_reference.md`

- Phạm vi đợt kiểm tra: tài liệu ca kiểm thử đủ 13 tính năng MVP (bảng 14 cột) và suite Playwright độc lập tại `source/e2e/`; F-01..F-11 (không gồm F-09) chạy ngày 2026-10-21, F-13..F-15 ngày 2026-10-22. Lượt đồng bộ này chỉ sửa sáu tài liệu tiến độ/kiến trúc/tham chiếu nêu trên, không sửa suite hay tài liệu kiểm thử.

| Phạm vi          | Ca  | Tự động | Passed | Failed | Thủ công chưa chạy |
| ---------------- | --- | ------- | ------ | ------ | ------------------ |
| 13 tính năng MVP | 759 | 381     | 378    | 3      | 378                |

- Lỗi: `UserFormModal.tsx` hiện thô `unique` đã sửa trước lượt đồng bộ, đã ghi `docs/troubleshooting/error_log.md`. Ba lỗi nghi vấn chưa sửa, chờ phê duyệt: F11-TC_063 (tìm CLO thiếu `optionFilterProp`), F11-TC_026 (xác nhận xóa trọng số không bấm được; nghi `commit` hai lần, chưa chứng minh), F15-TC_001 (`SYLLABUS_INCOMPLETE` hiện thô thay vì nhãn). Ba ca là `test.fixme`, dòng ca kiểm thử giữ Failed.
- Để sau: `source/e2e/specs/mvp-flow.spec.ts` (CTĐT → khung → nhất quán → đề xuất → duyệt ba cấp → ban hành → kích hoạt), 378 ca thủ công; chờ người dùng chốt F-06 US-021 AC3 và F-14 xóa/giữ bản làm việc khi Từ chối/Thu hồi. F-09/F-12/F-16 vẫn sau MVP; không coi phần tự động đã chạy là toàn bộ MVP đạt.

## [FIX] Sửa ba lỗi ứng dụng từ suite Playwright

**Date**: 2026-10-22
**Files changed**: `source/frontend/src/features/{syllabi/components/WeeklyContentModal.tsx,change-requests/components/FinalApprovalPreview.tsx,outcomes/components/WeightCell.tsx}`, `source/e2e/specs/{f-11-plo-clo-matrices,f-15-release-version-snapshots}.spec.ts`, `docs/testing/{playwright-guide.md,test-cases/f-11-plo-clo-matrices-test-cases.md,test-cases/f-15-release-version-snapshots-test-cases.md}`, `docs/troubleshooting/error_log.md`, `docs/progress/{todo,current_work,handoff,progress_log}.md`

- F11-TC_063: ô “CLO đạt được” thêm `optionFilterProp="label"`, tìm theo mã CLO thay vì cuid.
- F15-TC_001: “Phê duyệt cuối” hiện nhãn tiếng Việt cho `MISSING_SYLLABUS`/`SYLLABUS_INCOMPLETE` kèm điều kiện thiếu, thay mã thô.
- F11-TC_026: `onPressEnter` của ô trọng số gọi `preventDefault()`; trước đó Enter bấm luôn nút “Hủy” mà xác nhận vừa focus. Giả thuyết Enter + blur gọi `commit` hai lần đã bị loại bằng ghi sự kiện DOM.
- Bỏ `test.fixme` ba ca; suite F-11 (49) và F15-TC_001 Passed; Vitest outcomes/change-requests/syllabi 156/156; `tsc -b` sạch. Tổng tự động: 381/381 Passed.

## [DUT-LEGACY-SEED] Hoàn tất seed CTĐT DUT và đồng bộ tài liệu V-01

**Date**: 2026-10-23
**Files changed**: `docs/architecture/database_and_models.md`, `docs/technical/technical_reference.md`, `docs/progress/{handoff,todo,current_work,progress_log}.md`, `docs/implement-report/dut-legacy-seed-implement-report.md`, `docs/implementation/dut-legacy-seed-implementation-plan.md`

- Ghi nhận extractor/loader đã dựng và caller kiểm chứng trên PostgreSQL 18 ICU `vi-VN` dùng một lần, không phải `ctdt-dev-pg`: migrate deploy, base seed, demo seed và DUT seed đều thành công; DUT seed lần hai created 0 ở mọi loại.
- SQL cho `CNTT-%`: 24 programs, 46 versions (19 ACTIVE + 22 HISTORICAL + 5 DRAFT), 3.295 items, 3.135 requisites, 156 elective groups, 38 CohortVersion links; không program nào có hơn một ACTIVE. Giữ ngày hiện hữu `2025-2026-1 = 2025-09-08`, không ghi đè bằng legacy `2025-08-04`.
- Caller xác nhận typecheck exit 0, `vitest run prisma` 52 passed, extractor deterministic và sensitive-pattern grep trên JSON sạch. Lượt đồng bộ này chỉ sửa tám tài liệu, không chạy lại database/Prisma commands và không sửa `error_log.md` vì không có bug được sửa.
- Còn việc của người dùng: xác nhận năm defaults DUT và nạp database riêng; seed không thay `1024034`/`DEMO*`, `KnowledgeBlock` hoặc các semester/cohort giữ chỗ đã tồn tại. Giữ nguyên các việc MVP khác còn mở trong snapshot và TODO.

## [DUT-REAL-ENV] Tách extractor/loader và thêm môi trường dữ liệu thật

**Date**: 2026-10-23
**Files changed**: `source/backend/prisma/seed-data/dut/{extract,load,data}/`, `source/backend/prisma/seed-data/dut/dut-data.ts`, `source/backend/prisma/seed-dut.ts`, `source/backend/scripts/with-env.ts`, `source/backend/{.env.real.example,.gitignore,package.json,README.md}`, `docs/architecture/database_and_models.md`, `docs/technical/technical_reference.md`, `docs/progress/{handoff,current_work,progress_log}.md`, `docs/implement-report/dut-legacy-seed-implement-report.md`

- Di chuyển DUT thành `extract/`, `load/`, `data/`; giữ modules dùng chung ở root, chỉ sửa import/JSON paths, giữ nguyên logic và hashes ba JSON.
- Thêm runner `with-env.ts`, template ba overrides và scripts `real:migrate`, `real:seed`, `real:seed:dut`, `real:dev`; thiếu override file thì dừng, không fallback database mặc định và không có script demo cho môi trường thật. Tách database/files/queue prefix; Redis và port 3000 vẫn dùng chung mặc định.
- Typecheck, Prettier check và type-aware oxlint exit 0; không chạy tsx, Vitest hoặc database/Prisma commands. Kết quả runtime V-01 là kết quả trước refactor, chưa chạy lại trong lượt này.
- Người dùng tự tạo `.env.real`, tạo database ICU `vi-VN`, chạy `pnpm real:migrate; pnpm real:seed; pnpm real:seed:dut`; vẫn cần xác nhận năm defaults DUT. Không sửa spent plan hoặc các phần report lịch sử.

## [DOCS-MVP-DECISIONS] Chốt quyết định F-06/F-14 và viết 5 ca xuyên tính năng MVP

**Date**: 2026-10-25
**Files changed**: `docs/implementation/{f-15-release-version-snapshots,f-14-three-level-approval-notifications}-implementation-plan.md`, `docs/planning/user-stories.md`, `docs/testing/test-cases/f-06-programs-directors-test-cases.md`, `docs/implement-report/{f-14-three-level-approval-notifications,f-06-programs-directors}-implement-report.md`, `docs/progress/{todo,current_work,handoff,progress_log}.md`, `source/e2e/specs/mvp-flow.spec.ts`, `docs/testing/test-cases/mvp-flow-test-cases.md`, `docs/testing/test-cases/README.md`, `docs/testing/README.md`

- Người dùng quyết định giữ xóa bản làm việc khi Từ chối/Thu hồi bằng `WorkingCopyService.discard`; diff vẫn đọc từ `ChangeItem`. Sửa D14 và gotcha kế hoạch F-15 tại chỗ, giữ phương án chỉ đọc trong cột bị loại; cập nhật phạm vi kế hoạch F-14, chỉ nối thêm báo cáo lịch sử.
- Người dùng quyết định sửa US-021 AC3, không đổi ma trận quyền: sửa học phần trong G được, PATCH chương trình B không phân công trả 403; không yêu cầu học phần ngoài G trả 403 vì R3 có `course.edit` D toàn trường theo F-04. Dòng kiểm thử trong kế hoạch F-06 đã khớp nên không sửa.
- Ghi nhận PR #1 đã gộp vào `main` tại `181af11`. Phần A chỉ ghi quyết định và đồng bộ tài liệu; phần B thêm `source/e2e/specs/mvp-flow.spec.ts` với 5 ca serial MVP-TC_001..005, tài liệu ca kiểm thử bảng 14 cột và liên kết tại cả `docs/testing/test-cases/README.md` lẫn `docs/testing/README.md`. Không sửa backend/frontend hoặc fixtures, không ghi sync marker.
- MVP-TC_001 tạo CTĐT qua UI, dựng học phần/đề cương riêng bằng fixtures, phân công Giám đốc qua API; MVP-TC_002 đi UI khung, nhất quán và ban hành đầu tiên vào học kỳ đã bắt đầu, kiểm tra `1.0` là `ACTIVE` và `currentVersion` đang áp dụng qua HTTP/UI.
- MVP-TC_003 để R5 sửa nội dung đề cương trên bản sao và gửi đề xuất qua UI; MVP-TC_004 cho R4 rồi R3 duyệt thật qua UI; MVP-TC_005 để R1 duyệt cuối vào học kỳ tương lai, kiểm tra `1.1` là `PENDING`, `1.0` vẫn là bản `ACTIVE` duy nhất/đang áp dụng và nội dung ghim cũ/mới giữ đúng phiên bản.
- Build-verifier xác nhận `pnpm typecheck` trong `source/e2e` exit 0; **chỉ xác minh kiểu**, không chạy Playwright. Output:

```text
> ctdt-e2e@ typecheck E:\PBL6\curriculum-management\source\e2e
> tsc --noEmit
```

- **5 ca mới chưa thực thi**; cột kết quả thực thi để trống, không cộng thêm ca Passed hoặc thay kết quả kiểm thử cũ. Bước tiếp theo là chạy đầy đủ 5 ca và hoàn tất kiểm chứng `mvp-flow.spec.ts`, rồi các ca thủ công.
- Chưa bao phủ việc chuyển bản `1.1` từ `PENDING` sang `ACTIVE` khi đến ngày bắt đầu học kỳ; khuyến nghị kiểm chứng worker kích hoạt thật khi đến ngày (`source/backend/src/features/releases/release-activation.processor.ts:38`, scheduler chạy khi khởi động và hằng ngày). F-15 `createdByAcademicOffice` vẫn chờ người dùng quyết định.

## [DOCS-MVP-LIVE-RESULTS] Ghi kết quả caller chạy luồng MVP và các giới hạn còn mở

**Date**: 2026-10-25
**Files changed**: `docs/testing/test-cases/mvp-flow-test-cases.md`, `docs/progress/{todo,current_work,handoff,progress_log}.md`

- Nguồn kết quả là caller chạy trên app dev ngày 2026-10-25; lượt này chỉ cập nhật tài liệu, không chạy lại Playwright hoặc sửa source.
- Lần 1: MVP-TC_002 không tìm được nút vì accessible name “reload Chạy lại” khác locator exact. Caller đã sửa `source/e2e/specs/mvp-flow.spec.ts:56` thành `{ name: 'Chạy lại' }` (bỏ exact); lỗi test, không phải lỗi ứng dụng, không ghi vào `error_log.md`.
- Lần 2: MVP-TC_002 thất bại sớm hơn tại `fixtures/select.ts:22` (`chooseOption`), qua `fixtures/curriculum.ts:27` (`prepareCurriculumItem`): combobox Học kỳ (`plannedSemester`) vẫn `aria-expanded=true` sau 10 giây dù đã chọn option. Cùng bước đạt ở lần 1/3/4; ghi flake fixture dùng chung 1/4 lần chạy, nguyên nhân chưa xác định, chưa sửa.
- Lần 3 và 4 đều **14 Passed = 9 setup + MVP-TC_001..005**, **1.7 phút/lần**. Cập nhật cả 5 dòng ca thành Yes / Passed / 10/25/26 / Playwright (auto), giữ lịch sử hai lần đầu và ghi chú flake ở TC_002; không tính setup vào ca nghiệp vụ hoặc coi flake đã hết.
- Đánh dấu luồng đã Passed; bước tiếp theo là 378 ca thủ công và xác nhận F-15 `createdByAcademicOffice` (vẫn mở). Chưa bao phủ bản `1.1` từ `PENDING → ACTIVE` qua `release-activation.processor.ts`; cần đúng ngày đầu học kỳ với worker thật đang chạy, rồi kiểm bản đang áp dụng đổi.
- Ghi nhận implementation plan F-16, F-12, F-23, F-25 đang được các lượt khác viết song song; không đọc nội dung hoặc sửa `docs/implementation/`. Hai README chỉ mục không có số đếm kết quả cần đổi nên giữ nguyên; không sửa sync marker hoặc nhật ký trước lượt này.

## [DOCS-POST-MVP-PLANS] Ghi nhận đủ 13 kế hoạch triển khai sau MVP

**Date**: 2026-10-26 (đêm 2026-10-25/26)
**Files changed**: `docs/implementation/README.md`, `docs/progress/{todo,current_work,progress_log}.md`

- 13 implementation plan sau MVP đã được viết bằng các lượt Codex song song theo các đợt phụ thuộc: F-12/F-16/F-23/F-25/F-26/F-27 → F-17/F-24 → F-18/F-19/F-22 → F-20/F-21. F-09 đã có kế hoạch từ trước.
- Mỗi lượt chỉ tạo tệp kế hoạch của chính tính năng đó; chưa được người dùng review/phê duyệt, chưa triển khai và không có mã nguồn thay đổi trong đợt viết kế hoạch này.
- Bổ sung liên kết chỉ mục/TODO, giữ 13 tính năng ở trạng thái chưa build; gom câu hỏi lịch sử, thư viện, chính sách/hạ tầng, thiết kế và hai hợp đồng liên kế hoạch để người dùng quyết định. Không sửa tệp kế hoạch hoặc kết quả MVP.

## [DOCS-POST-MVP-DECISIONS] Chấp nhận kế hoạch với mặc định và chốt hợp đồng sau MVP

**Date**: 2026-10-26
**Files changed**: `docs/implementation/{README,f-12,f-15..f-25}-*-implementation-plan.md` (README là chỉ mục), `docs/design/{tech-stack,screen-inventory}.md`, `docs/planning/{feature-questions,user-stories,task-breakdown,test-plan}.md`, `docs/progress/{todo,current_work,handoff,progress_log}.md`

- Người dùng chốt A1..A12/B1/B2: xác nhận cờ F-15; giữ thay thế hành chính hồi tố/lịch hiện tại, không hứa lịch sử bất biến và không thêm history/freeze; F-19 chụp đúng đầu vào mỗi lần xét.
- Sửa tại chỗ BE-07 F-12: công thức mới chỉ học kỳ tương lai do người dùng chọn, dùng minor version và lỗi SEMESTER_ALREADY_STARTED hiện có; giữ ngoại lệ F-15 cho đề xuất không sửa công thức. F-21 dùng PortalProgressReader F-20; F-17 cho actor nullable/ghi nguồn trên đường SCHOOL_DB, không tự tạo tài khoản sync.
- Duyệt @antv/g6 (F-24 build ghim phiên bản); chỉ ủy quyền cấp 1/2; xác nhận căn cứ gán khóa; từ chối tái kích hoạt/hồi tố sinh viên kết thúc; mirror lớp không tác dụng học vụ; PDF chương trình sinh viên ngoài phạm vi, giữ tải đề cương ký.
- Đối soát US-107 AC2/CV-260/KB-093 về trọng số số thực, US-108 AC2 về lõi đóng băng/phần bổ sung hiện tại, MH-62/MH-44 về phạm vi quyền đã seed. C1..C9 chưa có câu trả lời của Khoa: build với mặc định, đầu vào vẫn còn nợ.
- Đợt build kế tiếp F-09 → F-16 → F-12 → F-17; sau đó F-23, F-25, F-24 → F-18 → F-19 → F-22 → F-20 → F-21. F-26/F-27 hoãn theo người dùng, giữ nguyên kế hoạch, không xếp lịch. Chưa tính tính năng nào là đã build; giữ 378 ca thủ công, kiểm kích hoạt 1.1 và flake chooseOption.
- Chỉ sửa tài liệu; không sửa source, không chạy build/test ứng dụng, không truy cập dữ liệu nhạy cảm hay dotenv. Kiểm tra bằng ba lệnh VERIFY được giao; output trong báo cáo lượt này.

## 2026-10-26 — Hoàn tất F-09 Nhập, xuất Excel

- Đã giao BE-01..BE-07 và FE-01..FE-05: mẫu XLSX danh mục/khung, upload 5 MB, chạy thử BullMQ với báo cáo theo dòng, xác nhận tái kiểm rồi ghi nguyên tử, lịch sử/tệp gốc 30 ngày, xuất khung để nhập lại giữ id; quyền và phạm vi R3 kiểm cả upload. Không mở loại sinh viên/kết quả hoặc Nháp của chương trình từng ban hành.
- Orchestrator đã áp migration import_batches kèm hai CHECK và generate Prisma. Shutdown ImportsProcessor được sửa giữ grace 10 giây, worker.close(true), rồi queue.getBackend().close(true) trước hook Nest để tránh chờ Redis QUIT khi Redis đã dừng; health + imports e2e sau sửa đạt 16/16.
- Kết quả orchestrator ngày 2026-10-26: backend whole unit 1134/1134 (có công việc F-16 trong tree, không có nghĩa F-16 đã xong); imports + permission-table + users e2e 171/171 trước shutdown fix. Frontend tsc -b/oxlint exit 0; F-09 cùng nhóm file chạy lại giới hạn 2 workers đạt 99/99; 19 lỗi full run trước là load timeout, không thuộc F-09.
- Playwright F-09 lượt 1 sau sửa đạt 14/14 (9 auth setup + F09-TC_001..005), 1,6 phút; lượt 2 đạt 13/14, TC_001 vướng flake chooseOption đã biết ở select.ts:22 (spec thứ hai sau curriculum). Giữ TC_001 Passed kèm ghi Failed 1/2 lượt, chưa sửa fixture. Hai lỗi test-only TC_002/003 trước sửa (locator trùng; nhầm 400 thay vì 201/ABORTED) giữ trong Incident lịch sử.
- TC doc: 27 Passed = 5 Playwright + 17 Backend e2e + 1 Backend unit + 4 Frontend unit; 3 Manual chưa chạy (015/016/025). Chỉ mục 14 tính năng được đếm lại: 789 ca = 408 Passed + 381 thủ công; 5 ca MVP xuyên tính năng theo dõi riêng. Còn nợ file Excel thật của Khoa, đang dùng nhãn SRS 4.3.
- DOC-01 đã đồng bộ kiến trúc, CSDL và technical reference theo source. Data dictionary đã đủ hai bảng/trạng thái; sơ đồ §8 đã có transient/stale sweep, chỉ sửa số đếm 3 → 5. Bàn giao: F-16 FE đang triển khai → F-12 → F-17; giữ mọi đầu vào Khoa, kiểm kích hoạt 1.1 và việc hoãn F-26/F-27.
- Lượt chốt này chỉ sửa tài liệu trong scope; không chạy lại ứng dụng/tests, không sửa source/fixture hoặc tài liệu F-16; kiểm Test-Path từng đường dẫn bổ sung vào tài liệu kiến trúc.

## 2026-10-27 — Hoàn tất F-16 So sánh phiên bản và gán khóa, chốt DOC-01

- Hoàn tất BE-01..BE-07, FE-01..FE-06 và DOC-01: so sánh sáu nhóm của hai ảnh chụp ban hành, drill-down hai pin đề cương, lịch sử chỉ đọc, batch gán đúng khóa R1 chọn, PATCH riêng mốc học kỳ và tra cứu as-of qua AppliedProgramVersionReader. Không có schema/migration/permission seed/dependency mới; F-12 assessment và F-17 student adapter chưa dựng.
- Orchestrator quan sát ngày 2026-10-27: backend unit 1134/1134, hai e2e F-16 18/18; releases/corrections/permission-table/users Passed. Frontend scoped 81/81. Full vitest dưới tải chỉ 469/478 (8 timeout 5000 ms, 1 findByText timeout ở OrgUnitTreePage); tám file lỗi chạy lại độc lập 58/58. Không nhận whole frontend suite Passed trong một lượt.
- Playwright F-16 lượt 1 đạt 12 passed / 2 failed do helper fixture selectComparisonOption của TC_008/014, không phải lỗi app. Sau sửa ARIA-scoped dropdown, kiểm tag multiple và Escape, lượt 2 đạt 14/14 (9 auth setup + TC_001/004/008/014/015), 1,3 phút; giữ lịch sử Failed/Passed trong Note, không suy shared chooseOption đã hết flake.
- Đối chiếu đủ 22 automated TC với test thật và ghi Yes/Passed/10/27/26; tầng chính 5 Playwright + 7 Backend e2e + 10 Frontend unit. Manual F16-TC_023..027 chưa chạy. Đếm lại 15 tài liệu tính năng: 816 ca = 430 Passed + 386 Manual chưa chạy; 5 ca MVP xuyên tính năng theo dõi riêng, không cộng setup hoặc đếm trùng tầng automation.
- DOC-01 đồng bộ features_architecture, general_architecture, database_and_models và plan/report/index/progress; không sửa technical_reference vì không thêm thư viện/pattern tổng quát, không sửa state-diagrams vì plan không yêu cầu và F-15 lifecycle giữ nguyên. Tài liệu Markdown được định dạng và kiểm bằng Prettier frontend đã cài; không chạy lại source/test suite trong lượt chốt docs.
- Bàn giao snapshot: F-16 done, còn Manual TC_023..027 và C9. Start here F-12, sửa drift BE-07 SEMESTER_ALREADY_STARTED trước; sau đó F-17, đối chiếu AdmissionEnrollmentInput.actorId nullable; rồi các suite đầy đủ. Giữ C1..C10, kiểm kích hoạt bản 1.1, flake chooseOption và việc hoãn F-26/F-27.

## 2026-10-27 — Hoàn tất F-12 Công thức điểm và ánh xạ đánh giá–CLO

- Hoàn tất BE-01..BE-08 và FE-01..FE-06: bảng `AssessmentComponent`, `AssessmentCLOMapping`, cột `Syllabus.failingScore` (migration `20261027154125_grade_formula_assessment_clo`, 5 CHECK); hai endpoint PUT `/api/syllabi/:id/grading-formula` và `/assessment-clo-mappings`; yêu cầu GRADING_FORMULA đi hết ba cấp duyệt (bỏ khỏi `NOT_FINAL_TYPES`/`NO_FINAL_APPROVAL` theo quyết định của orchestrator); CLO chưa được đánh giá chặn gửi duyệt, ban hành và duyệt cuối; thay đổi công thức bị từ chối ở học kỳ đã bắt đầu, kể cả Phòng đào tạo (E1).
- Kiểm chứng: backend tsc 0, oxlint 0, unit 135 file / 1192 Passed, e2e đầy đủ 27 file / 455 Passed (sau Prettier chạy lại `grade-formula` + `permission-table` 170/170); frontend `tsc -b` 0, oxlint 0, vitest 45 file / 213 Passed với `--testTimeout=30000` (ở 5000 ms có 5-6 timeout không liên quan khi máy tải); Playwright F-12 4/4 Passed.
- Lỗi bắt được bằng Playwright: lưới ánh xạ dựng lại bằng dữ liệu cũ sau khi lưu; sửa bằng `useEditorRemountKey` (khóa dựng lại theo `updatedAt` khi trình sửa sạch). Chi tiết trong báo cáo triển khai.
- TC doc 26 ca: 21 tự động Passed + 5 Manual (F12-TC_022..026). Đếm lại 16 tài liệu: 842 ca = 451 Passed + 391 thủ công.
- Còn nợ: Manual F12-TC_022..026; đầu vào Khoa C1 (đơn vị và ngưỡng công thức, mặc định không đơn vị). Tiếp theo F-17.

## 2026-10-29 — Hoàn tất F-17 Hồ sơ sinh viên và nhập kết quả học tập

- BE-01..BE-10, FE-01..FE-06 và docs đã hoàn tất: Student, ProgramEnrollment, AcademicResult/AcademicResultChange, StudentCredentialDelivery trong migration `20261027165710_student_records_results`; StudentsModule/StudentsSharedModule, MH-51/52 và hai loại nhập STUDENT_LIST/ACADEMIC_RESULT mở rộng pipeline F-09 hiện hữu. Không dựng pipeline thứ hai hoặc cổng sinh viên.
- Bằng chứng orchestrator trên dev server thật, mỗi spec chạy riêng ngày 2026-10-29: F-17 14/14 gồm auth setup và 5 TC nghiệp vụ; F-16 14/14; F-15 42/42; F-13 37/37; mvp-flow 14/14. E2E tsc 0 và frontend tsc -b 0. Targeted unit trước đó: BE 15 file 109/109, FE 12 file 58/58 với --testTimeout=30000. Lượt docs không chạy lại test, server hoặc full suites.
- Ghi nhận ba Incident orchestrator đã xử lý, không sửa lại source và không thêm error_log: workbook dùng nhãn Đang học thay enum STUDYING/IN_PROGRESS; program Select có tìm theo label/mã để xử lý tập options dài trong staff scope; nhập sinh viên cần STUDENT_CREDENTIAL_ENCRYPTION_KEY base64 của 32 byte. Browser dùng process env tạm, không ghi giá trị khóa; người dùng tự cấu hình dotenv cục bộ.
- TC F-17: 32 ca = 28 tự động Passed (5 Playwright, 17 BE e2e, 6 FE unit) + 4 Manual Not run (029..032). Đếm lại từng dòng TC trong 17 file tính năng: **874 = 479 tự động Passed + 395 Manual**; không cộng auth setup, không đếm trùng tầng automation; 5 ca MVP xuyên tính năng theo dõi riêng.
- Đồng bộ plan/report, test-case/index, database_and_models, features_architecture, general_architecture (wiring mới), technical_reference và snapshot/todo. Không sửa source hoặc cấu hình; không dùng kết quả browser để xóa khoảng trống ma trận BE-10 hay chứng nhận NFR-05.
- Còn nợ: 4 Manual F-17 và đầu vào Khoa C2; BE-10 matrix gaps; ngân sách test 100 giây đã chốt nhưng chưa đo lại, không thay mục tiêu NFR-05 60 giây; khóa cục bộ người dùng; full suites chưa chạy lại. C1..C10 và các Manual/flake/lịch sử trước đó tiếp tục giữ.
- Start here: chờ người dùng chọn **F-23 → F-25 → F-24 → F-18 → F-19 → F-22 → F-20 → F-21**. F-26/F-27 hoãn, không xếp lịch.

## 2026-10-29 — Hoãn F-24 và F-25

- Người dùng hoãn F-24 (đồ thị, PDF, dòng thời gian, bảng sức khỏe) và F-25 (ủy quyền, email, nhắc hạn): chưa cần. Không xếp lịch; kế hoạch giữ nguyên. `todo.md` đánh dấu ⏸️.
- Khóa `STUDENT_CREDENTIAL_ENCRYPTION_KEY` của người dùng hợp lệ: backend khởi động, F17-TC_002 Passed (10 passed gồm 9 auth setup).
- Start here: chờ người dùng chọn **F-23 → F-18 → F-19 → F-22 → F-20 → F-21**. F-24/F-25/F-26/F-27 hoãn.

## 2026-10-29 — Phân loại tài liệu đính kèm đề cương và nâng giới hạn mặc định

- Theo phê duyệt ngày 2026-10-29, `SyllabusAttachment.materialKind` bắt buộc với enum `SyllabusMaterialKind`: `SIGNED_SYLLABUS`, `TEXTBOOK`, `LECTURE_SLIDES`, `OTHER`. Migration `20261029155453_syllabus_material_kind` đã áp và gán dữ liệu cũ thành `OTHER`, không giữ mặc định cho dòng mới.
- Backend nhận loại qua DTO multipart, kiểm tra trước khi lưu tệp và trả loại trong dữ liệu đính kèm. Frontend yêu cầu chọn loại trước khi chọn tệp; danh sách trình sửa và chỉ đọc nhóm theo thứ tự Đề cương đã ký, Giáo trình, Slide bài giảng, Tài liệu khác, có số lượng và ẩn nhóm rỗng; giữ nguyên tải xuống/xóa.
- `ATTACHMENT_MAX_MB` mặc định tăng từ 20 lên 50 MB; giới hạn dùng chung cũng áp dụng cho văn bản đề xuất. Đồng bộ FR-47, từ điển dữ liệu, kiến trúc và một dòng US-096 AC3 của kế hoạch cổng sinh viên để giữ `materialKind` trong phép chiếu và nhóm cùng cách.
- Bổ sung kiểm thử loại tài liệu, từ chối thiếu/sai loại mà không tạo dòng hoặc lưu tệp, nhóm danh sách và điều chỉnh luồng tải tệp Playwright. Không chạy Vitest, kiểm thử đầu-cuối hoặc Playwright trong lượt bàn giao này; orchestrator chạy các bộ kiểm thử trước khi chốt.
- Kiểm tra khi tiếp tục ngày 2026-10-30: backend `tsc --noEmit -p tsconfig.json`, frontend `tsc -b`, e2e `tsc --noEmit -p tsconfig.json` đều exit 0; oxlint và Prettier trên các tệp nguồn thay đổi đều đạt. Dự án e2e không có oxlint/Prettier riêng nên dùng bản đã cài của frontend, không thêm dependency. Kiểu API đã sinh từ lượt trước có đủ `materialKind`; không chạy lại `api:types` khi backend đã dừng.
- Orchestrator chạy kiểm thử ngày 2026-10-30: backend unit syllabi 35/35; frontend `src/features/syllabi` 68/68 sau khi `chooseKind` trong `AttachmentPanel.test.tsx` chờ vùng tải mở khóa (`Form.useWatch` báo lựa chọn ở lượt render sau); backend e2e `syllabi`, `corrections`, `permission-table` 203/203; Playwright F-10 44/46 rồi F10-TC_017/020 Passed khi chạy lại (cả hai lỗi là flake `chooseOption` đã biết: combobox còn `aria-expanded=true` sau 10 giây).
- Sửa khi kiểm thử: route tải lên trả 400 `whitelistValidation` trên `file` vì lớp DTO khai báo `file` nên instance luôn có trường đó; tách `UploadAttachmentDto` (chỉ `materialKind`, dùng cho `@Body()`) khỏi `UploadAttachmentFormDto` (thêm `file`, chỉ cho Swagger), cùng cách `UploadChangeRequestDocumentDto`. `test/test-env.ts` ghim `ATTACHMENT_MAX_MB=50` vì dotenv cục bộ có thể còn giá trị cũ; `source/backend/README.md` đổi mặc định thành 50.
- Còn nợ: nếu dotenv cục bộ của người dùng còn `ATTACHMENT_MAX_MB=20`, ứng dụng đang chạy vẫn giới hạn 20 MB; người dùng tự đổi thành 50.

## 2026-10-29 — Hoãn F-23

- Người dùng hoãn F-23 (báo cáo kiểm định): vượt phạm vi cần lúc này. Không xếp lịch; kế hoạch giữ nguyên, `todo.md` đánh dấu ⏸️. Thứ tự: **F-18 → F-19 → F-22 → F-20 → F-21**.

## 2026-10-30 — F-18 Điều kiện đăng ký học phần

- Sửa lỗ hổng mốc kết thúc ghi danh của F-17 trước F-18 (người dùng duyệt): đổi ngày bắt đầu học kỳ bị chặn nếu có ghi danh dùng học kỳ đó làm mốc đầu hoặc cuối; mốc cuối có học kỳ nhưng thiếu ngày là khoảng không hợp lệ, không phải khoảng mở. Ghi tại `error_log.md` mục 2026-10-29.
- F-18 build bằng Codex theo kế hoạch: `shared/registration-eligibility` (ngữ cảnh khung đã đóng băng, bằng chứng học tập, đồ thị song hành SCC lặp, giới hạn độ sâu `ELIGIBILITY_MAX_DEPTH` mặc định 20), `features/registration-eligibility` (hai route GET riêng tư, bộ chọn sinh viên theo phạm vi); MH-25 thêm cột "Đăng ký được?" và ngăn lý do ở chế độ theo sinh viên, chỉ đọc. Không có migration. Hệ thống chỉ tính điều kiện, không có nút đăng ký (GĐ-05).
- Chặn khi build: env F-18 cần sửa `env.validation.ts` do lượt tài liệu đính kèm giữ; lấy phương án A (thêm biến, giữ `ATTACHMENT_MAX_MB` 50) theo quy tắc bị chặn thì lấy mặc định.
- Kiểm chứng của orchestrator: BE unit 179/179, BE e2e 226/226 (gồm spec fix F-17), FE 75/75, Playwright F-07 35/35. Sửa bốn lỗi chỉ nằm trong spec mới (thiếu `reflect-metadata`, mock catalog lệch, vi phạm CHECK `ProgramEnrollment_closed_interval`, tiêu đề cột ẩn của AntD); mã sản phẩm không đổi.
- TC F-18: 16 ca = 14 tự động Passed + 2 Manual (015/016). Chỉ mục: **890 = 493 tự động Passed + 397 Manual**.
- Môi trường: container dev Postgres/Redis dừng (exit 255) giữa lượt; đã khởi động lại cùng BE/FE dev server.
- Còn nợ: Manual F18-TC_015/016, đầu vào Khoa C3, số đo NFR-02 trên phần cứng triển khai.
- Start here: **F-19** theo mặc định của kế hoạch, rồi F-22 → F-20 → F-21.


## 2026-10-30 — F-19 Xét tốt nghiệp

- Build bằng Codex theo kế hoạch: BE-01..BE-12 (migration `20261030050730_graduation_review`), FE-01..FE-06, DOC-01. `schema.d.ts` sinh lại từ BE dev server.
- Quyết định khi build (lấy mặc định): mọi phản hồi F-19 chứa dữ liệu sinh viên gửi `Cache-Control: no-store, private`, theo F-18.
- Sửa trong lượt kiểm chứng: fixture điểm thiếu `score10/letterGrade`, body TRANSFER, fixture enrollment ENDED, username chữ hoa và biên nửa mở `[from, until)` là lỗi test; retry tối đa 4 lần cho xung đột serialization 40001/40P01 rồi hoãn ở mức WARN, `Error` thường mang mã `UNCLASSIFIED_EXECUTION` là thay đổi sản phẩm. Frontend: ba lỗi truy vấn trong test, chờ lazy route, tiêu đề AntD confirm lặp trong một dialog (lỗi test); `onOk` của xác nhận đợt xét ném lại lỗi thành unhandled rejection (lỗi sản phẩm, đã sửa).
- Kiểm chứng của orchestrator: BE tsc 0, unit 363/363; BE e2e graduation 19/19, batches 8/8, corrections 10/10 (chạy riêng; lượt chung 8/10 do `Memory allocation error`), permission-table 185/185 (lượt 2). FE tsc -b 0, oxlint 0, vitest 11 file 85/85 (`--maxWorkers=1`).
- Còn nợ: 16 ca Manual trong `docs/testing/feature__f-19-graduation-review.md`; chưa có file test case F-19 trong chỉ mục `docs/testing/test-cases/`; đồng bộ `features_architecture.md`/`database_and_models.md`; tách view kết quả sang shared cho F-20; đầu vào Khoa C4.
- Start here: **F-22**, rồi F-20 → F-21.
- Đồng bộ docs (2026-10-30): features/database/general architecture, error_log (onOk xác nhận đợt xét), test case `f-19-graduation-review-test-cases.md` 35 ca = 19 Passed + 16 Manual; chỉ mục 925 = 512 Passed + 413 Manual.

## 2026-10-30 — Cải tổ UI theo Impeccable, ma trận quyền, dữ liệu thật DUT

- PR #2–#5 (đã merge): theme chuandaura (`tokens.ts`, `theme.ts`, tiền tố `--ctdt-*`), PRODUCT.md/DESIGN.md, menu theo tác vụ + prefetch khi hover, Suspense từng route, ma trận quyền thiết kế lại (ô có hình + chữ, nhóm thu gọn, lọc khác biệt, Drawer sửa vai trò). F-02 Playwright 30/31 (TC_031 chập chờn, chạy lại 4/4).
- PR #6 (đã merge): chỉ một DB `ctdt_real`; bỏ seed demo. Nạp thật 69 giảng viên, 1.731 sinh viên, 1.731 ghi danh, 51.896 kết quả; seed lần 2 tạo 0. E2E Playwright dựng `e2e:world` trước và `e2e:purge` sau. Báo cáo: [dut-real-seed](../implement-report/dut-real-seed-implement-report.md).
- Chưa chạy: bộ test đầy đủ BE/FE/Playwright sau PR #6 (người dùng yêu cầu tắt chạy test).
- Chờ người dùng: Taiga (biến môi trường `TAIGA_USERNAME`/`TAIGA_PASSWORD`, slug dự án, duyệt bảng phân công).
- Start here: Phase 4 thiết kế lại màn hình, cụm D (CTĐT) → E → F → G → C → H → B; sau đó F-22 → F-20 → F-21.

## 2026-10-31 — Điều hướng CTĐT, dev:setup, Taiga, F-20..F-25 đã merge

- F-20..F-25 đã merge vào main (PR #26–#31); `todo.md` được sửa theo. Còn lại chưa build: F-26, F-27 (hoãn). Người dùng ưu tiên rà soát nghiệp vụ và UI CTĐT / học phần / phê duyệt, test để sau cùng.
- PR #34 `chore(dev)`: `pnpm dev:setup` (trong `source/backend`) kiểm Node/pnpm/Docker, tạo `.env` từ `.env.example`, `docker compose --profile mail up -d --wait`, cài backend/frontend/e2e, `prisma migrate deploy` + seed + `seed:dut`; cờ `--skip-seed`. Docker chỉ chạy hạ tầng (PostgreSQL, Redis, Mailpit), mã chạy trên máy.
- PR #35 `refactor(nav)`: `features/programs/components/ProgramWorkspaceLayout.tsx` là route layout lồng bọc mọi `/programs/:programId/...` (router.tsx): link về danh sách, tên + trạng thái CTĐT, một Select phiên bản, 5 tab nhóm (Tổng quan; Khung chương trình; Chuẩn đầu ra; Phân tích; Phiên bản) kèm hàng tab thứ hai cho nhóm đang mở. Xóa `ProgramSectionLinks.tsx` và `outcomes/components/OutcomeNav.tsx`; trang con bỏ link quay lại, nút điều hướng chéo, phụ đề. `CurriculumWarningsPanel` gộp cảnh báo thành một Alert (mở rộng khi > 3). Thêm `shared/hooks/useUrlQuery.ts` (bộ lọc/trang trên URL cho ProgramListPage, CourseListPage, ChangeRequestListPage, ApprovalQueuePage) và `shared/layout/navigationMemory.ts` (AppLayout ghi pathname+search; BackLink về URL cuối của đích). `BackLink` có `preferHistory` (navigate(-1) nếu có mục trước) dùng ở tạo/sửa/chi tiết đề xuất và trang yêu cầu tổ chức. Bỏ SectionNav của Approvals (sidebar đã có).
- PR #36 `chore(taiga)`: `source/backend/scripts/taiga/{taiga-client.ts,reschedule-backlog.ts}`; Taiga 13 sprint hai tuần 15/06–15/12/2026, người phụ trách Hieu Nguyen / Manh Kien / Tien (180/180/188 điểm); `sprint-plan.md` §0 đã cập nhật.
- PR #37 `refactor(courses)`: dòng quan hệ học phần bỏ nút "Tạo đề xuất" từng dòng; thẻ trạng thái chỉ cho học phần liên quan không ACTIVE; `ProgramsUsingList` bỏ AntD `List` đã deprecated.
- Chưa chạy lại bộ test đầy đủ. Start here: đi luồng phê duyệt theo vai trò R5→R4→R3→R1 trên UI, tiếp tục chỉnh UI.

## 2026-10-31 — F-26 sao lưu và diễn tập phục hồi (một phần)

- Rebase `feat/f-26-backup-restore-drill` lên main; thêm `spec` cho `computeStatus`, e2e API `test/backups.e2e-spec.ts` (9 ca), 3 hàng `backup.view` trong bảng quyền (188/188).
- Thêm CLI `pnpm backup:drill` (`restore`, `verify`, `accept`, `inspect`, `capture-upgrade`, `compare-upgrade`) và spec; sửa lỗi tùy chọn lặp lại không bị từ chối do spec phát hiện.
- Frontend: `OpenAPI` đã có DTO (thêm `@ApiOkResponse` vào controller), trang `BackupsPage`, route, menu, 14 test.
- Docs: `docs/technical/backup-restore-runbook.md`, `docs/testing/feature__f-26-backup-restore-drill.md`.
- **Chưa làm / bị chặn**: e2e engine và phục hồi thật (máy chưa cài PostgreSQL client 18 native), spec cho restore-drill/restore-verifier/upgrade-verifier/backup-store, cập nhật architecture docs, nghiệm thu vận hành thật.
- Ghi chú: `todo.md`/`current_work.md` cũ cho F-20..F-25; git log cho thấy F-20..F-25 đã merge vào main.

## 2026-10-31 — F-26/F-27 hoàn tất mã, đổi chiến lược e2e

- Rebase `feat/f-27-deployment-monitoring` (chứa cả F-26) lên main, cherry-pick 3 commit `feat/f-26-leftovers`, gộp stash các dòng bảng quyền F-20..F-25. Sửa 6 dòng `program.view` sang `NO_ROLE`, vì R6 có `program.view`.
- **E2E backend bỏ Testcontainers** theo yêu cầu người dùng (tốn RAM/ổ đĩa).
  - Nay dùng PostgreSQL/Redis của `compose.yaml`: DB tên `ctdt_e2e_*` sao từ template ICU `ctdt_e2e_template`; Redis logical DB 1, dọn trước và sau mỗi lượt; mặc định 2 worker (`E2E_WORKERS`).
  - Thêm biến `REDIS_DB` (mặc định 0).
  - Kết quả: 42 file, 677/677 (4 skip), khoảng 266 giây.
- **F-27 BE-02 không dùng pino** (người dùng chốt): `src/shared/logging/{app-logger,http-logger,log-levels}.ts`.
  - Ghi JSON một dòng cho mỗi request, chỉ gồm method, route template, status, thời gian và ID do server tạo. Route không khớp ghi `unmatched`.
  - Chỉ bật khi `NODE_ENV=production`.
  - Bỏ Uptime Kuma khỏi `deploy/compose.yaml` và docs; bộ thu health là nguồn bằng chứng uptime.
- **F-26 diễn tập cục bộ** bằng pg_dump/pg_restore 18.6 trên DB demo seed `ctdt_drill_source`: B4 RESTORED 7/7, `verify` 5/5, nghiệm thu SUCCEEDED (runbook §8).
  - Sửa: `copyFiles` luôn tạo `files/`. Trước đó `FILES_ROOT` trống làm mọi lần phục hồi báo `BACKUP_CHECKSUM_MISMATCH`.
  - Sửa: tách mã `DRILL_ALREADY_DECIDED` và `DRILL_NOT_ACCEPTABLE` khỏi `DRILL_ACCEPTANCE_FAILED`.
  - Thêm `restore-drill.spec.ts` (8 ca).
  - `ctdt_real` trên máy này bị từ chối sao lưu với `BACKUP_FILE_MISSING`: 1 `ChangeRequestDocument` trỏ tới tệp không có.
- F-27 BE-06: điền đường dẫn đọc sinh viên/nhân sự đã xác minh vào `scripts/load/fixture-contract.example.json` và bảng §2a của kế hoạch.
- Nợ:
  - Fixture tổng hợp 300 học phần/500 sinh viên.
  - k6 canonical trên stack `deploy/` thật.
  - 7 đêm sao lưu, diễn tập B5/B6, sao chép ngoài máy, uptime dài hạn.

## 2026-10-31 — sửa lỗi nghiệp vụ, smoke checklist, kiểm chứng

- PR #39 (F-26 + F-27), #40 (spec BackupStore 14 ca), #41 (seed), #42 (menu), #43 (smoke checklist và audit UI) đã gộp vào `main`.
- **#41**: bản ban hành DUT có số quyết định giữ chỗ `DUT-<programCode>-<version>`; trước đó 38 phân khóa báo `INVALID_COHORT_ASSIGNMENT` khi đối soát ghi danh. Chạy lại `pnpm prisma:seed:dut` điền 41 số trên `ctdt_real`, còn 0 phân khóa sai. Phải thay bằng số thật của Khoa.
- **#42**: `MeDto.canApprove` (R1/R3/R4 hoặc ủy quyền dùng được hôm nay) ẩn "Chờ tôi duyệt" khi sai; "Trạng thái hệ thống" cần quyền vận hành nên R5/R6 không còn thấy nhóm "Quản trị".
- **#43**: `docs/testing/smoke-checklist.md` (29 kịch bản theo vai) thay việc chạy từng ca trong 413 ca thủ công (người dùng chốt 2026-10-31). Audit Impeccable tĩnh cho CTĐT, học phần, đề xuất, sao lưu: detector sạch; sửa hàng chờ duyệt dùng `keepPreviousData` và `CourseItemsEditor` hex → `token.colorErrorBg`.
- **Kiểm chứng trên main**: BE unit 1797/1797; BE e2e 679/679 (4 skip), 43 file, khoảng 302 giây; FE 693/693, tsc 0, lint 0 lỗi.
- Dọn nhánh: `refactor/program-workspace-tabs` (PR #35 đã thay thế), các nhánh tính năng đã gộp, worktree `cm-f26-leftovers`.
- **Nợ**: Playwright và duyệt luồng R5→R4→R3→R1 trên trình duyệt chưa chạy (thiếu `source/e2e/.env`); `REDIS_DB=0` chưa có trong `.env.example`; `ctdt_real` từ chối sao lưu `BACKUP_FILE_MISSING`; 213 dòng tự chọn chưa thuộc nhóm (C10); nợ vận hành (7 đêm sao lưu, B5/B6, ngoài máy, k6 canonical, uptime, NFR-02, bản 1.1); flake `chooseOption`; Taiga MCP không kết nối.

## 2026-10-31 — khám phá CSDL đào tạo của Trường (chỉ đọc)

- Khám phá chỉ đọc SQL Server đào tạo của Trường qua đường hầm SSH, dùng hai tài khoản chỉ đọc (tài khoản A/B). Báo cáo: [dut-school-db-discovery](../reference/dut-school-db-discovery.md).
- Kết luận chính: `tmProxDUT` là DB chính, mới hơn bản dump `DHBK_CDS` mà seed DUT đang dùng; không có bảng PLO/CLO; nhóm tự chọn dựng lại được từ `tmKhungCT.Note` + `Hocky` + `tmKhungTC` (có nguồn dữ liệu cho C10); `tmKehoach` cũ (dừng ở 2020); `MalopHP` = `MaHP` + `IDCode` + hậu tố; hậu tố học kỳ `11` và `30` tồn tại nhưng `semesterFromLegacyCode` từ chối; cột mật khẩu bị DENY ở mức cột.
- Mã mới (độc lập, không đụng `src/`, không migration): `source/backend/scripts/school-discovery/{connection,catalog,classify,mirror,export-csv,profile}.ts`, cấu hình từ `D:\dut-mirror\.env` (ngoài repo).
- Bản sao cục bộ ngoài repo `D:\dut-mirror`: 98 bảng / 2.049.332 dòng, đã sao vào container Docker `dut-mirror` (SQL Server 2022) và xuất CSV, số dòng khớp; chỉ `tmDiemkyhoc` lọc theo sinh viên Khoa CNTT.
- Kiểm chứng: backend tsc 0 lỗi, oxlint 0 cảnh báo, prettier sạch trên các script mới.
- Việc kế: viết kế hoạch triển khai thiết kế lại schema từ báo cáo; trả lời câu hỏi mở §10.

## 2026-10-31 — seed lại dữ liệu thật DUT từ bản sao CSDL Trường

- Nhánh `feat/dut-real-reseed`. Kế hoạch: [dut-real-reseed-implementation-plan](../implementation/dut-real-reseed-implementation-plan.md) (lệch ở §9). Báo cáo: [dut-real-reseed-implement-report](../implement-report/dut-real-reseed-implement-report.md).
- Migration `20261031124933_semester_start_date_estimated`: thêm `Semester.startDateEstimated` (mặc định `false`) và CHECK `Semester_estimated_needs_date`.
- Seed đọc CSV từ `D:\dut-mirror` qua allow-list (`extract/mirror-tables.ts`); `pnpm dut:extract [gốc]` chạy một lệnh. Nhóm tự chọn dựng theo quy tắc SRS (`elective-groups.ts`), CTĐT gom khung theo `program-map.ts`.
- Bỏ giá trị giữ chỗ: seed nền không còn tạo học kỳ/khóa giữ chỗ (4 học kỳ/4 khóa); bỏ số quyết định `DUT-<programCode>-<version>` (nay NULL, chờ số thật của Khoa) và đơn vị `DUT-UNASSIGNED`.
- Phiên bản đã ban hành không còn bắt buộc số quyết định: sửa 4 bộ đọc (`issuedVersionFact`, `readReleasedVersionSnapshot`, `GraduationInputReader`) cùng bộ lọc phiên bản của `students-read.service`; đính chính sao nguyên `decisionNumber`/`signedDate` kể cả NULL; luồng ban hành F-15 vẫn bắt buộc nhập. FE: `SemesterStartDate` (Tag "Ngày ước lượng"), `formatDecisionNumber` ("Chưa có số quyết định").
- Lệnh dựng lại: `pnpm db:rebuild:real --yes` (`pg_dump`, reset, seed nền, extract, seed DUT). Agent cần đồng ý của người dùng cho Prisma reset.
- Số liệu `ctdt_real`: 42 CTĐT / 89 phiên bản, 449 học phần, 40 học kỳ (ngày thật từ `DHBK_CDS.tmKehoach`, 5 kỳ hè ước lượng), 14 khóa, 6 956 dòng khung / 329 nhóm tự chọn (0 dòng không nhóm), 554 quan hệ học phần, 332 giảng viên, 1 923 sinh viên, 75 180 kết quả. Chi tiết trong báo cáo.
- Kiểm chứng: BE unit 1856/1856, FE 697/697. BE e2e: 131/131 trên 13 file (semesters, releases, cohort-versions, corrections, version-comparison, publication, ddut-api, students, student-version-resolution, student-portal, graduation, graduation-batches, graduation-corrections, reports).
- Chưa làm: Playwright và smoke (thiếu `source/e2e/.env`); chưa đi tay UI với dữ liệu mới. Đóng DEBT-04 và DEBT-05; câu hỏi mở cho Khoa ghi ở báo cáo.

## 2026-11-01 — Playwright trên dữ liệu thật DUT

- Chạy trên `ctdt_real`, dev server cục bộ, Playwright 1.64, 1 worker. Đính chính: báo cáo trước nói thiếu `source/e2e/.env` là sai; tệp đã có (đã sửa ở report reseed, current_work, handoff, todo).
- Kết quả theo nhóm sau khi sửa: F-01..F-05 152/152; F-07+F-08 48/48; F-09..F-12 96 đạt + 7 ca cũ đã sửa; F-13..F-16 101 đạt + 5 ca cũ đã sửa; F-17, F-20, F-21 đạt hết; mvp-flow 14/14. F-06 chưa chạy lại: người dùng đang tự sửa spec/fixture (4 ca cũ, ô bảng nay hiện tên + mã).
- Lượt chạy đầy đủ đầu tiên (1,2 giờ) gặp 100 lỗi `SESSION_REQUIRED` do phiên hết hạn sau 60 phút không hoạt động; chạy theo nhóm dưới 60 phút.
- PR #47 `fix(frontend)`: `SortableRow` gán id `undefined` cho hàng giữ chỗ bảng rỗng của AntD, dnd-kit coi là đang kéo và nâng z-index 9999, che hộp thoại "Thêm học phần vào khung". Hàng không khóa nay render `<tr>` thường, hàng đang kéo z-index 1; thêm `SortableRow.test.tsx`. Kèm e2e: `chooseOption` thu hẹp select ảo có tìm kiếm, fixture consistency đọc tiêu đề workspace, helper `curriculumWarning` mở bảng cảnh báo gập (gập khi trên 3 từ PR #35).
- PR #48, #49, #50 `test(e2e)`: sửa spec cũ sau PR #35 (tab thay liên kết, tiêu đề chương trình cấp 3, từ chối ngoài phạm vi "Bạn không có quyền xem chương trình này") và sau F-17 (R1 thấy cả bốn loại nhập); F10-TC_023 ghi tệp trên 50 MB ra đĩa vì Playwright từ chối tải lên trong bộ nhớ trên 50 MB.
- Nợ mới: DEBT-09 (F12-TC_004 flaky), DEBT-10 (F09-TC_001 flaky), DEBT-11 (a11y nút "Tiếp tục xác nhận"). Còn: smoke vòng 1 và duyệt luồng R5→R4→R3→R1 trên UI (DEBT-01).

## 2026-11-01 — triển khai demo trên Oracle Cloud Always Free

- Nhánh `chore/demo-oracle`, commit `2b0d1ea`. Terraform `deploy/terraform/oci/`: VCN, subnet, security list 22/80/443, một VM.Standard.A1.Flex 2 OCPU/12 GB Ubuntu 24.04 ARM, IP công khai tạm (tùy chọn `use_reserved_ip`), cảnh báo ngân sách 1 USD, cloud-init cài Docker và mở iptables. Vùng `ap-singapore-1`; tên `ctdt.oguri-lab.io.vn` (bản ghi A thêm tay ở tenten.vn).
- Một VM chạy `deploy/compose.yaml` hiện có; `deploy/demo.env.example` ghim ảnh `node:24.22.2-bookworm-slim`, `postgres:18.6-bookworm`, `redis:8.2.11-bookworm`, `caddy:2.11.7-alpine`.
- Sửa Dockerfile backend khi chạy stack F-27 thật lần đầu: sao chép `assets/` (phông PDF), `pnpm prune --prod --ignore-scripts`, stage `runtime-chromium`. `compose.yaml`: `API_BUILD_TARGET`, `shm_size: 256m`.
- Biến môi trường mới `PDF_BROWSER_NO_SANDBOX` (`true|false`, mặc định `false`) trong `env.validation.ts`; `pdf-renderer.service.ts` thêm `--no-sandbox` khi `true`; thêm `pdf-renderer.service.spec.ts`.
- CI/CD `.github/workflows/ci-cd.yml` (tsc, lint, test chọn lọc, terraform fmt/validate; job deploy khi push main qua SSH chạy `deploy/scripts/deploy-release.sh`, kiểm tra sức khỏe qua Caddy, có rollback). Script: `deploy-release.sh`, `restore-demo-data.sh`, `export-demo-data.ps1`, `apply-until-capacity.sh`, `set-ci-secrets.sh`.
- Tài liệu: `deploy/DEPLOY_INFRA.md`, `deploy/COST.md`, `deploy/COMMANDS.md`, [demo-oracle-free](../operations/demo-oracle-free.md); `deploy/README.md` liên kết.
- Kiểm chứng: stack production dựng và chạy cục bộ (project compose `ctdt-localcheck`, đã gỡ): migrate 23 migration, `/api/health` ok, `/api/docs` 404, deep link SPA 200, HTTP→HTTPS 308, `ctdt_real` khôi phục bằng `pg_restore` (337 user, 0 tài khoản `e2e.*`), đăng nhập qua Caddy 200 với cookie HttpOnly; Secure; SameSite=Lax, `/api/auth/me` 200, Chromium xuất PDF trong container api chỉ đọc. BE unit 1859/1859, tsc và lint sạch; FE build, lint, test LoginPage đạt.
- Chưa làm: `terraform apply`, bản ghi DNS, lần deploy thật, chạy CI trên GitHub, GitHub secrets.

