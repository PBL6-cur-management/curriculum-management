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

| Phạm vi | Ca | Tự động | Passed | Failed | Thủ công chưa chạy |
|---|---|---|---|---|---|
| 13 tính năng MVP | 759 | 381 | 378 | 3 | 378 |

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
