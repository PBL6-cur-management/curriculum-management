# Database & Models

<!--
  FILE PURPOSE   : Schema definitions, entity columns, relationships, domain models, and DAO/
                   repository contracts for local storage.

  WHAT BELONGS   : DB engine config, entity/table specs, column specs, enums, DAOs, seed
                   strategy, non-trivial domain model design, and migration rules.

  WHAT DOES NOT  : Implementation status (→ todo.md), feature-level screen design
                   (→ features_architecture.md), tech library config (→ technical_reference.md).

  UPDATE WHEN    : Any entity column, relationship, enum value, DAO method, or domain model
                   changes. Always write a migration alongside the schema change — never drop
                   and recreate in production.

  FORMAT:
            ### `EntityName` — table `table_name`
            | Column | Type | Notes |
            |---|---|---|
            FK / relationship note if any.
-->

Tệp này ghi những gì **đã có migration** trong `source/backend/prisma/`. Lược đồ đích (toàn bộ thực thể, cột, liệt kê) ở `docs/design/data-dictionary.md` và `docs/design/erd.md`; tên tiếng Anh ở `docs/design/naming-map.md`. Một bảng chỉ được chép vào đây khi migration tạo ra nó đã chạy.

---

## Database Configuration

| Mục                        | Giá trị                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| Hệ quản trị                | PostgreSQL 18, ảnh Debian                                                     |
| Quy tắc so sánh            | ICU `vi-VN`, đặt lúc tạo cơ sở dữ liệu; `PrismaService` dừng ứng dụng nếu sai |
| Truy cập                   | Prisma 7.10.0, `@prisma/adapter-pg`                                           |
| Lược đồ                    | `source/backend/prisma/schema.prisma`                                         |
| Migration                  | `source/backend/prisma/migrations/` (`prisma.config.ts`)                      |
| Phiên bản lược đồ hiện tại | `20261029155453_syllabus_material_kind` (17 migration)                       |

### Migration Rule

Không xóa tạo lại cơ sở dữ liệu khi đổi lược đồ. Mỗi thay đổi:

1. Sửa `schema.prisma`.
2. `pnpm prisma:migrate` sinh và áp một migration có tên; đưa thư mục migration vào git.
3. Ghi thay đổi vào tệp này.

Nhật ký kiểm toán (NFR-10, bảng `AuditLog`) hoãn theo F01-07 — `docs/planning/deferred-scope.md` §2; quy định quyền trên bảng đó viết lại khi làm.

### Quy ước lược đồ (quyết định, áp từ migration đầu tiên)

| Mục            | Quy ước                                                                                                                                  | Nguồn                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Khóa chính     | `id String @id @default(cuid(2))`; khóa do Prisma Client sinh, `INSERT` thô phải tự cấp `id`                                             | F00-10                     |
| Tên bảng, cột  | Model PascalCase số ít, trường camelCase, không `@map` (trừ bảng `session` của `connect-pg-simple`)                                      | `source/backend/README.md` |
| Dấu thời gian  | Mọi bảng nghiệp vụ có `createdAt @default(now())`, `updatedAt @updatedAt`                                                                | F-01 D11                   |
| Khóa ngoại     | Cột vô hướng `<quanHệ>Id` cạnh trường quan hệ đặt tên như từ điển dữ liệu (`parentUnit` + `parentUnitId`); mặc định `onDelete: Restrict` | F-02 D1                    |
| Ngày không giờ | `@db.Date`, gửi `YYYY-MM-DD`, so với hôm nay theo `Asia/Ho_Chi_Minh` (`todayDate()`)                                                     | F-02 D13                   |
| Liệt kê        | `enum` của Prisma, giá trị `SCREAMING_SNAKE`                                                                                             | F00-12                     |
| Tín chỉ, điểm  | `Decimal(5,2)` tín chỉ, `Decimal(4,2)` điểm; trả JSON dạng chuỗi                                                                         | F00-11                     |

---

## Entities

Migration `20261029155453_syllabus_material_kind` đã áp ngày 2026-10-29: thêm enum `SyllabusMaterialKind` (`SIGNED_SYLLABUS`, `TEXTBOOK`, `LECTURE_SLIDES`, `OTHER`) và cột bắt buộc `SyllabusAttachment.materialKind`, không có mặc định. Các dòng cũ được gán `OTHER` trong migration; tải lên mới phải truyền loại tài liệu.

Migration `20261018141101_auth_session` (F-01) sinh bằng `prisma migrate diff --from-empty` vì lúc dựng không có cơ sở dữ liệu chạy sẵn; đã áp trên PostgreSQL 18 của Testcontainers trong kiểm thử đầu-cuối (`test/migrations.ts`), đã áp trên cơ sở dữ liệu phát triển ngày 2026-10-18.

Migration `20261019024639_subject_groups` (F-03) thêm `SubjectGroup`, `SubjectGroupMember` và hai enum; chỉ thêm, không đụng hàng của F-02.

Migration `20261019072717_courses` (F-04) sinh bằng `prisma migrate dev --name courses` trên PostgreSQL 18 thật (ICU `vi-VN`); thêm `Course` và hai enum `CourseType`, `CourseStatus`; chỉ thêm, không đụng bảng cũ. Đã áp trên PostgreSQL của Testcontainers trong kiểm thử đầu-cuối (4 migration); chưa áp lên cơ sở dữ liệu phát triển của người dùng.

Migration `20261019075207_course_relations` (F-05) sinh bằng `prisma migrate dev --create-only --name course_relations` trên PostgreSQL 18 thật (ICU `vi-VN`, container Docker), rồi nối tay hai ràng buộc `CHECK` ở cuối `migration.sql` và áp bằng `prisma migrate dev`; thêm `CourseRelation`, `EquivalentCourseGroup`, enum `CourseRelationType` và cột `Course.equivalenceGroupId`; chỉ thêm. Đã áp trên PostgreSQL của Testcontainers trong kiểm thử đầu-cuối (5 migration); chưa áp lên cơ sở dữ liệu phát triển của người dùng.

Migration `20261019082727_programs` (F-06) sinh bằng `prisma migrate dev --create-only --name programs` trên PostgreSQL 18 thật (ICU `vi-VN`, container Docker), rồi nối tay hai chỉ mục duy nhất từng phần ở cuối `migration.sql` và áp bằng `prisma migrate dev`; chạy lại báo "Already in sync". Thêm `Program`, `ProgramVersion`, `ProgramDirectorAssignment` và ba enum `DegreeLevel`, `ProgramStatus`, `ProgramVersionStatus`; chỉ thêm. Đã áp trên PostgreSQL của Testcontainers trong kiểm thử đầu-cuối (6 migration); chưa áp lên cơ sở dữ liệu phát triển của người dùng.

Migration `20261019085325_curriculum` (F-07) sinh bằng `prisma migrate dev --create-only --name curriculum` trên PostgreSQL 18 thật (ICU `vi-VN`, container Docker), rồi nối tay sáu ràng buộc `CHECK` ở cuối `migration.sql` và áp bằng `prisma migrate dev`; chạy lại báo "Already in sync". Thêm `KnowledgeBlock`, `ElectiveGroup`, `CurriculumItem`, `CurriculumRequisite`; chỉ thêm. Đã áp trên PostgreSQL của Testcontainers trong kiểm thử đầu-cuối (7 migration); chưa áp lên cơ sở dữ liệu phát triển của người dùng.

Sáu migration sau (F-08..F-15) đều sinh bằng `prisma migrate dev --create-only` trên PostgreSQL 18 thật (container `ctdt-dev-pg`, ICU `vi-VN`), nối tay phần Prisma không mô hình hóa, áp bằng `migrate dev` (lần hai "Already in sync"); đã áp trên Testcontainers. `ctdt-dev-pg` đã có F-11, F-13, F-14, F-15; cơ sở dữ liệu phát triển của người dùng cần `pnpm prisma:migrate` rồi `pnpm prisma:seed`.

| Migration                                        | Tính năng | Thêm                                                                                                                                                                                                                                | Viết tay (đừng "dọn" khỏi `migration.sql`)                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261019092846_credit_mismatch_acceptance`      | F-08      | 5 cột `ProgramVersion.creditMismatch*`                                                                                                                                                                                              | `CHECK ProgramVersion_credit_acceptance_complete` (năm cột cùng có hoặc cùng trống)                                                                                                                                                                                                                                                                                                                            |
| `20261019095730_syllabi`                         | F-10      | `Syllabus`, `WeeklyContent`, `SyllabusAttachment`; enum `SyllabusStatus`, `AttachmentFileType`                                                                                                                                      | chỉ mục từng phần `Syllabus_one_draft`, `Syllabus_one_published`; `CHECK` `Syllabus_revision_positive`, `Syllabus_published_has_time`, `WeeklyContent_order_positive`, `SyllabusAttachment_size_positive`                                                                                                                                                                                                      |
| `20261019102707_outcomes`                        | F-11      | `PLO`, `CLO`, `WeeklyContentCLO`, `CoursePLOMapping`, `CLOPLOMapping`                                                                                                                                                               | `CHECK CoursePLOMapping_weight_range` (0 < trọng số ≤ 1)                                                                                                                                                                                                                                                                                                                                                       |
| `20261019110535_change_requests`                 | F-13      | `ChangeRequest`, `ChangeItem`, `ApprovalLevelConfig`, `ApprovalStep`, `ChangeRequestDocument`; cột `sourceRequestId`, `baseVersionId`/`baseRevisionId` trên `ProgramVersion`, `Syllabus`; `Syllabus.revisionNumber` thành null được | dãy `change_request_code_seq`; `CHECK` `ChangeRequest_target_key` (đúng một khóa đối tượng), `ChangeRequest_basis_required`, `ChangeRequest_round_nonneg`, `ApprovalStep_level_range`, `ApprovalStep_skip_reason`, `ChangeRequestDocument_size_positive`, `Syllabus_number_unless_copy`; tạo lại `ProgramVersion_one_draft`, `Syllabus_one_draft` chỉ tính bản không thuộc đề xuất (`sourceRequestId IS NULL`) |
| `20261019122753_approval_comments_notifications` | F-14      | `Comment`, `Notification`; enum `NotificationType`, `NotificationReadStatus`; cột `ChangeRequest.levelEnteredAt`                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                                                                                              |
| `20261031124933_semester_start_date_estimated`   | Seed thật | `Semester.startDateEstimated` (Boolean, mặc định `false`) | CHECK `Semester_estimated_needs_date`: cờ chỉ bật khi có `startDate` |
| `20261019131021_release_versions`                | F-15      | `Semester`, `Cohort`, `CohortVersion`; cột ban hành trên `ProgramVersion`, `ChangeRequest`; `CurriculumItem.courseNameSnapshot`, `creditsSnapshot`, `syllabusId`; `Syllabus.originRequestId`, `ProgramVersion.correctionOfId`       | tạo lại `ProgramVersion_one_draft` thêm `AND "correctionOfId" IS NULL`; `CHECK` `ProgramVersion_published_has_time` (bản rời Nháp có `publishedAt`; điền ngược từ `updatedAt`), `Semester_term_positive`                                                                                                                                                                                                       |

Migration `20261018151319_access_control` (F-02) sinh bằng `prisma migrate dev --create-only --name access_control`; đã áp trên cơ sở dữ liệu phát triển. Thêm `OrgUnit` tối thiểu, `Role`, `Permission`, `RolePermission`, `RoleAssignment` và `User.orgUnitId`.

### `User` — table `User`

| Column                    | Type         | Notes                                                                             |
| ------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `id`                      | `String`     | `cuid(2)`                                                                         |
| `userCode`                | `String`     | Duy nhất (`User_userCode_key`)                                                    |
| `fullName`                | `String`     |                                                                                   |
| `email`                   | `String?`    |                                                                                   |
| `status`                  | `UserStatus` | Mặc định `ACTIVE`; `DISABLED` không đăng nhập được và mất phiên ở yêu cầu kế tiếp |
| `username`                | `String`     | Duy nhất (`User_username_key`); lưu dạng đã chuẩn hóa (`shared/auth/username.ts`) |
| `passwordHash`            | `String`     | Argon2id                                                                          |
| `mustChangePassword`      | `Boolean`    | Mặc định `false`; `true` thì chỉ gọi được `me`, đổi mật khẩu, đăng xuất           |
| `canSelfApprove`          | `Boolean`    | Mặc định `false`; chỉ tài khoản demo (`pnpm db:demo-account`) bật để tự duyệt đề xuất của mình qua cả ba cấp. Migration `20261101130000_user_can_self_approve` |
| `orgUnitId`               | `String?`    | FK `OrgUnit`; chỉ mục                                                             |
| `createdAt` / `updatedAt` | `DateTime`   | `now()` / `@updatedAt`                                                            |

### `OrgUnit` — table `OrgUnit`

| Column                    | Type            | Notes                       |
| ------------------------- | --------------- | --------------------------- |
| `id`                      | `String`        | `cuid(2)`                   |
| `unitCode`                | `String`        | Duy nhất                    |
| `unitName`                | `String`        |                             |
| `unitType`                | `OrgUnitType`   |                             |
| `parentUnitId`            | `String?`       | FK `OrgUnit` (cây), chỉ mục |
| `status`                  | `OrgUnitStatus` | Mặc định `ACTIVE`           |
| `createdAt` / `updatedAt` | `DateTime`      |                             |

Cột không đổi từ F-02; F-03 thêm quan hệ ngược `subjectGroups`, F-04 thêm `ownedCourses`. Loại đơn vị cha hợp lệ là hằng `ALLOWED_PARENT_TYPES` (`features/org-units/org-unit-hierarchy.ts`): `FACULTY` và `OFFICE` chỉ nằm dưới `UNIVERSITY`; đổi cha chạy kiểm chu trình ở service. Không có thao tác xóa đơn vị — chỉ `INACTIVE` / `ACTIVE`.

### `SubjectGroup` — table `SubjectGroup`

| Column                    | Type                 | Notes                                                            |
| ------------------------- | -------------------- | ---------------------------------------------------------------- |
| `id`                      | `String`             | `cuid(2)`                                                        |
| `groupCode`               | `String`             | Duy nhất, không sửa sau khi tạo                                  |
| `groupName`               | `String`             |                                                                  |
| `facultyId`               | `String`             | FK `OrgUnit`, chỉ mục; phải là đơn vị `FACULTY` (kiểm ở service) |
| `status`                  | `SubjectGroupStatus` | Mặc định `ACTIVE`                                                |
| `createdAt` / `updatedAt` | `DateTime`           |                                                                  |

### `SubjectGroupMember` — table `SubjectGroupMember`

| Column                      | Type                     | Notes                                        |
| --------------------------- | ------------------------ | -------------------------------------------- |
| `id`                        | `String`                 | `cuid(2)`                                    |
| `subjectGroupId`            | `String`                 | FK `SubjectGroup`, chỉ mục                   |
| `lecturerId`                | `String`                 | FK `User`, chỉ mục                           |
| `memberRole`                | `SubjectGroupMemberRole` | `MEMBER` hoặc `COORDINATOR` — hai hàng riêng |
| `validFrom` / `validTo`     | `Date` / `Date?`         | `@db.Date`                                   |
| `assignedById`              | `String?`                | FK `User`                                    |
| `revokedAt` / `revokedById` | `DateTime?` / `String?`  | Thu hồi chỉ ghi hai cột này                  |
| `createdAt` / `updatedAt`   | `DateTime`               |                                              |

Không có ràng buộc duy nhất hay loại trừ ở cơ sở dữ liệu: service chặn hai hàng chưa thu hồi cùng (nhóm, người, vai trò) chồng thời gian (`MEMBERSHIP_OVERLAP`) và đòi hàng `COORDINATOR` nằm trọn trong một hàng `MEMBER` cùng người, cùng nhóm (`COORDINATOR_NOT_MEMBER`). Một nhóm có thể có nhiều Điều phối. Kết thúc thành viên chỉ rút ngắn `validTo` và cắt các hàng Điều phối bên trong; hàng không bị xóa hay kéo dài.

### `Course` — table `Course`

| Column                    | Type           | Notes                                                                                                                       |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | `String`       | `cuid(2)`                                                                                                                   |
| `courseCode`              | `String`       | Duy nhất (`Course_courseCode_key`); cắt khoảng trắng, viết hoa khi ghi; không sửa sau khi tạo (DTO sửa không có trường này) |
| `courseName`              | `String`       | Tiếng Việt; chỉ mục (`Course_courseName_idx`) cho sắp xếp                                                                   |
| `englishName`             | `String?`      | Rỗng lưu `null`                                                                                                             |
| `credits`                 | `Decimal(5,2)` | `numeric(5,2)`; gửi và nhận dạng chuỗi (`"2.5"`, `"0"`), `toWireDecimal` bỏ số 0 thừa                                       |
| `courseType`              | `CourseType`   |                                                                                                                             |
| `status`                  | `CourseStatus` | Mặc định `ACTIVE`; `CANCELLED` là trạng thái cuối                                                                           |
| `ownerFacultyId`          | `String`       | FK `OrgUnit` (`Restrict`), chỉ mục; phải là `FACULTY` đang hoạt động (kiểm ở service)                                       |
| `ownerGroupId`            | `String?`      | FK `SubjectGroup` (`Restrict`), chỉ mục; nếu có phải là nhóm `ACTIVE` của chính `ownerFaculty` (kiểm ở service)             |
| `equivalenceGroupId`      | `String?`      | FK `EquivalentCourseGroup` (`SetNull`), chỉ mục (F-05); một học phần thuộc nhiều nhất một nhóm tương đương                  |
| `createdAt` / `updatedAt` | `DateTime`     |                                                                                                                             |

Không có thao tác xóa học phần — chỉ chuyển trạng thái. Quan hệ ngược: `OrgUnit.ownedCourses`, `SubjectGroup.ownedCourses`. "Học phần khoa khác" = `ownerFaculty.unitCode` khác `HOME_FACULTY_CODE` (`KHOA_CNTT`, `src/shared/org-units/home-faculty.ts`); không lưu thành cột. Quan hệ ngược `relationsAsSource`, `relationsAsTarget` (F-05). Tìm kiếm: `ILIKE '%q%'` trên mã và tên không dùng được chỉ mục; chấp nhận ở quy mô vài trăm dòng (đo 500 dòng trong đầu-cuối).

### `CourseRelation` — table `CourseRelation` (F-05)

| Column                    | Type                 | Notes                                                                                                                                     |
| ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | `String`             | `cuid(2)`                                                                                                                                 |
| `sourceCourseId`          | `String`             | FK `Course` (`Restrict`): học phần học trước / tiên quyết / song hành, hoặc học phần bị ngừng (với `REPLACEMENT`)                         |
| `targetCourseId`          | `String`             | FK `Course` (`Restrict`), chỉ mục: học phần **có** yêu cầu, hoặc học phần thay thế                                                        |
| `relationType`            | `CourseRelationType` | `PRIOR`, `PREREQUISITE`, `COREQUISITE`, `REPLACEMENT`; quan hệ "tương đương" (loại thứ năm của FR-18) là thành viên nhóm, không nằm ở đây |
| `minScore`                | `Decimal(4,2)?`      | Ngưỡng điểm thang 4 (0..4, tối đa 2 số lẻ), chỉ `PREREQUISITE`; gửi và nhận dạng chuỗi                                                    |
| `createdAt` / `updatedAt` | `DateTime`           |                                                                                                                                           |

Duy nhất `(sourceCourseId, targetCourseId, relationType)` (`CourseRelation_sourceCourseId_targetCourseId_relationType_key`). **Hai ràng buộc `CHECK` viết tay trong `migration.sql`** (Prisma không mô hình hóa `CHECK` và không diff chúng nên giữ qua các migration sau — đừng "dọn" khỏi SQL): `CourseRelation_not_self` (`sourceCourseId <> targetCourseId`) và `CourseRelation_minScore_prerequisite_only` (`minScore IS NULL OR relationType = 'PREREQUISITE'`). Xóa quan hệ là xóa thật, không xóa mềm (D12). Quan hệ thuộc về một học phần ("học phần sở hữu"): đích với `PRIOR`/`PREREQUISITE`/`COREQUISITE`, nguồn với `REPLACEMENT`; phạm vi và đường sửa kiểm trên học phần đó. Chu trình trên các cạnh `PRIOR` + `PREREQUISITE` do service chặn (BR-11), không phải cơ sở dữ liệu.

### `EquivalentCourseGroup` — table `EquivalentCourseGroup` (F-05)

| Column                    | Type       | Notes                                                         |
| ------------------------- | ---------- | ------------------------------------------------------------- |
| `id`                      | `String`   | `cuid(2)`                                                     |
| `groupCode`               | `String`   | Duy nhất; cắt khoảng trắng, viết hoa khi ghi; tối đa 20 ký tự |
| `note`                    | `String?`  | Tối đa 500 ký tự; rỗng lưu `null`                             |
| `createdAt` / `updatedAt` | `DateTime` |                                                               |

Thành viên là `Course.equivalenceGroupId` (không có bảng nối, M-4). Nhóm có ít nhất 2 học phần (service giữ); giải thể xóa nhóm sau khi xóa `equivalenceGroupId` của các thành viên (`SetNull` là lưới an toàn). Nhóm nằm ngoài ảnh chụp phiên bản nên R1 sửa trực tiếp bất cứ lúc nào (EC-16, E-11).

### `Program` — table `Program` (F-06)

| Column                    | Type            | Notes                                                                                          |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `id`                      | `String`        | `cuid(2)`                                                                                      |
| `programCode`             | `String`        | Duy nhất (`Program_programCode_key`); cắt khoảng trắng, không sửa sau khi tạo; tối đa 20 ký tự |
| `facultyId`               | `String`        | FK `OrgUnit` (`Restrict`), chỉ mục; mặc định Khoa CNTT khi tạo                                 |
| `degreeLevel`             | `DegreeLevel`   | `ENGINEER` Kỹ sư, `BACHELOR` Cử nhân (FR-24)                                                   |
| `status`                  | `ProgramStatus` | Mặc định `ACTIVE`; không xóa chương trình, chỉ `INACTIVE` / `ACTIVE` (EC-50)                   |
| `clonedFromId`            | `String?`       | FK `ProgramVersion` (`Restrict`): phiên bản được dùng làm nền khi nhân bản (FR-25)             |
| `createdAt` / `updatedAt` | `DateTime`      |                                                                                                |

Quan hệ: `faculty` (`ProgramFaculty`), `clonedFrom` (`ProgramClonedFrom`), `versions` (`ProgramVersions`), `directors`. `OrgUnit` thêm `programs`, `User` thêm `programDirectorships`, `grantedDirectorships`, `revokedDirectorships`. Đối tượng phân quyền của chương trình là `{ programIds: [id], orgUnitIds: [facultyId] }` (`programTarget`).

### `ProgramVersion` — table `ProgramVersion` (F-06)

| Column                                                 | Type                   | Notes                                                                           |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------- |
| `id`                                                   | `String`               | `cuid(2)`                                                                       |
| `programId`                                            | `String`               | FK `Program` (`Restrict`)                                                       |
| `versionNumber`                                        | `String?`              | Trống khi còn Nháp; F-15 điền khi ban hành                                      |
| `status`                                               | `ProgramVersionStatus` | `DRAFT`, `PENDING`, `ACTIVE`, `HISTORICAL`; mặc định `DRAFT`                    |
| `programName`, `majorCode`, `majorName`                | `String`               | Mô tả nằm ở phiên bản (M-3) để bản đã ban hành giữ mô tả riêng                  |
| `semesterCount`                                        | `Int`                  | 1..12 (`PROGRAM_LIMITS.SEMESTERS_MAX`, mặc định kế hoạch)                       |
| `totalCredits`, `compulsoryCredits`, `electiveCredits` | `Decimal(5,2)`         | Gửi và nhận dạng chuỗi; bắt buộc + tự chọn = tổng (BR-03, `assertCreditsAddUp`) |
| `createdAt` / `updatedAt`                              | `DateTime`             |                                                                                 |

Duy nhất `(programId, versionNumber)` (nhiều `NULL` được qua, vì PostgreSQL coi `NULL` là khác nhau) và chỉ mục `(programId, status)`. **Hai chỉ mục duy nhất từng phần viết tay trong `migration.sql`** (Prisma không mô hình hóa và không diff chúng nên giữ qua các migration sau — đừng "dọn" khỏi SQL): `ProgramVersion_one_draft` và `ProgramVersion_one_active` (`WHERE "status" = 'ACTIVE'`) — mỗi chương trình có nhiều nhất một bản Nháp thường và một bản Đang hiệu lực (BR-22). `ProgramVersion_one_draft` đã tạo lại hai lần, nay là `("programId") WHERE "status" = 'DRAFT' AND "sourceRequestId" IS NULL AND "correctionOfId" IS NULL` — bản làm việc của đề xuất (F-13) và Nháp đính chính (F-15) nằm cạnh Nháp thường.

Cột thêm sau F-06:

| Cột                                                                                                                                                                     | Tính năng | Ghi chú                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `creditMismatchReason`, `creditMismatchCompulsoryGap`, `creditMismatchElectiveGap` (`Decimal(5,2)?`), `creditMismatchAcceptedById` → `User`, `creditMismatchAcceptedAt` | F-08      | Chấp nhận chênh lệch tín chỉ; năm cột cùng có hoặc cùng trống (CHECK)                                                                                              |
| `sourceRequestId?` (duy nhất) → `ChangeRequest`, `baseVersionId?` → `ProgramVersion`                                                                                    | F-13      | Có `sourceRequestId` = bản làm việc của đề xuất; `baseVersion` = bản đã ban hành nó chép từ                                                                        |
| `decisionNumber?`, `signedDate Date?`, `effectiveSemesterId?` → `Semester`, `publishedById?` → `User`, `publishedAt?`, `previousVersionId?` → `ProgramVersion`          | F-15      | Thông tin ban hành; `publishedAt` có đúng khi `status <> DRAFT` (CHECK)                                                                                            |
| `originRequestId?` → `ChangeRequest`                                                                                                                                    | F-15      | Đề xuất sinh ra phiên bản này; không duy nhất (một đề xuất đề cương sinh nhiều phiên bản). Khi ban hành, bản làm việc chuyển `sourceRequestId` → `originRequestId` |
| `correctionOfId?` (duy nhất) → `ProgramVersion`, `correctionReason?`                                                                                                    | F-15      | Nháp đính chính và bản đính chính đã ban hành                                                                                                                      |

`versionNumber` dạng `major.minor` (`src/shared/releases/version-number.ts`). Chỉ mục thêm: `(originRequestId, status)`, `(status, effectiveSemesterId, createdAt)`. Quan hệ ngược `clones` (các chương trình nhân bản từ phiên bản này).

### Khung chương trình (F-07)

| Bảng                  | Cột chính                                                                                                                                                                                                                                                                                                                                                             | Ghi chú                                                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KnowledgeBlock`      | `blockCode` (duy nhất), `blockName`, `requiredCredits Decimal(5,2)?`                                                                                                                                                                                                                                                                                                  | Danh mục dùng chung, nạp bằng seed (hiện rỗng: chưa có tệp Excel); ký hiệu trên dòng khung là chuỗi tự do, không khóa ngoại (F07-02)                                                                           |
| `ElectiveGroup`       | `versionId` → `ProgramVersion` (`Cascade`), `groupCode`, `groupName`, `minCredits Decimal(5,2)?`, `minCourses Int?`                                                                                                                                                                                                                                                   | Duy nhất `(versionId, groupCode)`; có cả hai mức thì phải đạt cả hai                                                                                                                                           |
| `CurriculumItem`      | `versionId` (`Cascade`), `plannedSemester`, `sortOrder` (trong một học kỳ, TT suy ra), `courseId` (`Restrict`), `blockSymbol?`, `isElective`, `electiveGroupId?` (`SetNull`), `htDa`, `tqDa`, `minStudiedScore`, `minTransferScore` (`Decimal(4,2)?`), `note?`; F-15: `courseNameSnapshot?`, `creditsSnapshot Decimal(5,2)?`, `syllabusId?` → `Syllabus` (`Restrict`) | Duy nhất `(versionId, courseId)`; bản Nháp đọc tên, tín chỉ trực tiếp từ `Course` và đề cương Đã ban hành-không-thì-Nháp; khi ban hành `VersionPublisher` ghi ảnh chụp (chỉ khi còn null) và ghim bản đề cương |
| `CurriculumRequisite` | `itemId` (`Cascade`), `sourceCourseId` (`Restrict`), `relationType` (dùng lại `CourseRelationType`), `minScore Decimal(4,2)?`                                                                                                                                                                                                                                         | Duy nhất `(itemId, sourceCourseId, relationType)`; chép từ `CourseRelation` lúc thêm dòng, sửa riêng cho khung, đóng băng cùng phiên bản                                                                       |

Sáu `CHECK` viết tay (Prisma không mô hình hóa; không xóa khi dọn `migration.sql`): `CurriculumItem_group_needs_elective` (có nhóm thì phải tự chọn), `CurriculumItem_semester_positive`, `CurriculumItem_sort_positive`, `ElectiveGroup_has_minimum` (ít nhất một mức tối thiểu), `CurriculumRequisite_not_replacement`, `CurriculumRequisite_min_score_prerequisite` (chỉ `PREREQUISITE` có ngưỡng). Dòng phải cùng phiên bản với nhóm của nó: service kiểm (`ITEM_NOT_IN_VERSION`), SQL không diễn đạt được. Xóa nhóm để dòng còn tự chọn, không nhóm.

Seed (F-07): `seed-data/knowledge-blocks.ts` (danh sách rỗng) và, trong `seed-data/programs.ts`, sáu học phần mẫu `DEMO101..DEMO302`, một quan hệ tiên quyết, nhóm `TC1` và sáu dòng khung cho bản Nháp 1024034 (≤ 10 học kỳ, 140 + 10 tín chỉ); chỉ ghi khi bản Nháp chưa có dòng nào. Là dữ liệu giữ chỗ như phần còn lại của 1024034.

### Đề cương (F-10)

| Bảng                 | Cột chính                                                                                                                                                                                                                                                                                                                                                                      | Ghi chú                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Syllabus`           | `courseId` (`Restrict`), `revisionNumber Int?`, `status SyllabusStatus`, sáu mục văn bản HTML đã lọc (`courseDescription`, `englishDescription`, `objectives`, `teachingMethods`, `assessmentMethods`, `references`; null = trống), `previousVersionId?` (duy nhất, chuỗi bản), `publishedAt?`; F-13 `sourceRequestId?` (duy nhất), `baseRevisionId?`; F-15 `originRequestId?` | Duy nhất `(courseId, revisionNumber)`; một Nháp thường, một Đã ban hành mỗi học phần (chỉ mục từng phần). `revisionNumber` null chỉ ở bản làm việc của đề xuất (CHECK). Công bố: chuyển bản Đã ban hành sang `HISTORICAL` **trước** khi đặt Nháp thành `PUBLISHED` |
| `WeeklyContent`      | `syllabusId` (`Cascade`), `weekLabel`, `sortOrder` ≥ 1, `content`, `teachingActivities?`                                                                                                                                                                                                                                                                                       | Chỉ mục `(syllabusId, sortOrder)`                                                                                                                                                                                                                                  |
| `SyllabusAttachment` | `syllabusId` (`Restrict`), `fileName`, `materialKind SyllabusMaterialKind` (bắt buộc, không có mặc định), `fileType AttachmentFileType`, `filePath` (duy nhất, tương đối dưới `FILES_ROOT`, dấu `/`), `sizeBytes` > 0, `uploadedById` → `User`, `recordedAt`                                                                                                                                                                                      | Tệp nằm trên đĩa; xóa hàng không tự xóa tệp                                                                                                                                                                                                                        |

### Chuẩn đầu ra (F-11)

| Bảng               | Cột chính                                                                                                                    | Ghi chú                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PLO`              | `versionId` → `ProgramVersion` (`Cascade`), `ploCode`, `description`, `englishDescription?`, `competencyGroup?`, `sortOrder` | Duy nhất `(versionId, ploCode)`                                                                            |
| `CLO`              | `syllabusId` → `Syllabus` (`Cascade`), `cloCode`, `description`, `englishDescription?`, `cognitiveLevel?`, `sortOrder`       | Thuộc bản đề cương nên mọi chương trình dùng học phần chung CLO (DEC-03); duy nhất `(syllabusId, cloCode)` |
| `WeeklyContentCLO` | `weeklyContentId`, `cloId` (cả hai `Cascade`)                                                                                | Duy nhất cặp                                                                                               |
| `CoursePLOMapping` | `curriculumItemId` → `CurriculumItem`, `ploId` → `PLO` (cả hai `Cascade`), `weight Decimal(3,2)`                             | Duy nhất `(curriculumItemId, ploId)`; 0 < `weight` ≤ 1 (CHECK)                                             |
| `CLOPLOMapping`    | `(curriculumItemId, ploId)` → `CoursePLOMapping` (khóa ngoại ghép, `Cascade`), `cloId` → `CLO` (`Cascade`)                   | Duy nhất `(curriculumItemId, cloId, ploId)`; liên kết không sống lâu hơn ô học phần–PLO                    |

### Đề xuất, duyệt, thông báo (F-13, F-14)

| Bảng                    | Cột chính                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Ghi chú                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ChangeRequest`         | `requestCode` (duy nhất, từ `change_request_code_seq`), `requestType`, `targetType`, `targetCode`, đúng một trong `courseId`/`programId`/`subjectGroupId` (CHECK), `createdById`, `title`, `reason`, `status ChangeRequestStatus`, `origin RequestOrigin`, `basisDocumentNumber?` (bắt buộc khi `UNIVERSITY`), `submissionRound` ≥ 0, `createdByAcademicOffice` (F-15 dùng), F-14 `levelEnteredAt?`; F-15 `decisionNumber?`, `signedDate?`, `effectiveSemesterId?`, `pastSemesterAllowed` | Bản làm việc qua quan hệ ngược `programCopy`/`syllabusCopy`; chỉ mục theo `status`, người tạo, từng khóa đối tượng                |
| `ChangeItem`            | `changeRequestId` (`Cascade`), `sortOrder`, `entityType`, `itemKey`, `label`, `recordId?`, `oldValue`/`newValue Json?`, `baseVersion?`                                                                                                                                                                                                                                                                                                                                                    | Duy nhất `(changeRequestId, entityType, itemKey)`; ghi lúc gửi (loại có bản làm việc) hoặc soạn khi Nháp (loại học phần, tổ chức) |
| `ApprovalLevelConfig`   | `approvalLevel` (duy nhất), `levelName`, `roleId` → `Role`                                                                                                                                                                                                                                                                                                                                                                                                                                | Có bảng nhưng mã đọc tên cấp từ hằng `APPROVAL_LEVEL_NAMES`                                                                       |
| `ApprovalStep`          | `changeRequestId` (`Cascade`), `submissionRound`, `approvalLevel` 1..3, `approverId?`, `forSubjectGroupId?`, `forProgramId?`, `action ApprovalAction`, `remark?`, `recordedAt?`, `isSkipped` + `skipReason` (CHECK), `performedById?`, `isOverride`                                                                                                                                                                                                                                       | Một dòng mỗi người duyệt mỗi cấp mỗi lượt gửi; cấp 3 không có `approverId`                                                        |
| `ChangeRequestDocument` | `changeRequestId` (`Restrict`), `documentType ChangeDocumentType`, `fileName`, `fileType`, `filePath` (duy nhất, dưới `FILES_ROOT`), `sizeBytes` > 0, `uploadedById`, `seenInRound?`                                                                                                                                                                                                                                                                                                      | Văn bản quét kèm đề xuất                                                                                                          |
| `Comment`               | `changeRequestId` (`Cascade`), `authorId`, `content`, `createdAt`                                                                                                                                                                                                                                                                                                                                                                                                                         | Không có `updatedAt`: không sửa, không xóa (US-067 AC3)                                                                           |
| `Notification`          | `recipientId` (`Cascade`), `notificationType`, `content` (câu tiếng Việt dựng lúc sự kiện), `changeRequestId?` (`Cascade`), `readStatus`, `readAt?`                                                                                                                                                                                                                                                                                                                                       | Chỉ trong ứng dụng; chỉ mục `(recipientId, readStatus, createdAt)`, `(changeRequestId)`                                           |

### Học kỳ, khóa (F-15)

| Bảng            | Cột chính                                                                      | Ghi chú                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Semester`      | `semesterCode` (duy nhất), `academicYear`, `termInYear` ≥ 1, `startDate Date?`, `startDateEstimated Boolean @default(false)` (migration `20261031124933_semester_start_date_estimated`, CHECK `Semester_estimated_needs_date`) | Duy nhất `(academicYear, termInYear)`; seed nền không còn tạo học kỳ; seed DUT tạo học kỳ có ngày thật (`DHBK_CDS.tmKehoach`) hoặc ngày ước lượng có cờ |
| `Cohort`        | `cohortCode` (duy nhất), `intakeYear`                                          | Seed giữ chỗ                                                                                                                          |
| `CohortVersion` | `cohortId`, `programVersionId`, `fromSemesterId` (đều `Restrict`), `createdAt` | Khóa học theo phiên bản nào từ học kỳ nào; F-15 ghi khi ban hành và đính chính, F-16 gán lại. Duy nhất `(cohortId, programVersionId)` |

### `ProgramDirectorAssignment` — table `ProgramDirectorAssignment` (F-06)

| Column                      | Type                    | Notes                                                                                                                     |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `String`                | `cuid(2)`                                                                                                                 |
| `programId`                 | `String`                | FK `Program` (`Restrict`), chỉ mục                                                                                        |
| `directorId`                | `String`                | FK `User` (`Restrict`), chỉ mục                                                                                           |
| `validFrom` / `validTo`     | `Date` / `Date?`        | `@db.Date`; `validTo` trống = không thời hạn (tên SRS `startDate`, `endDate` đổi để dùng chung `shared/time/validity.ts`) |
| `assignedById`              | `String?`               | FK `User`                                                                                                                 |
| `revokedAt` / `revokedById` | `DateTime?` / `String?` | Thu hồi dòng nhập nhầm; dòng thu hồi vẫn nằm trong lịch sử                                                                |
| `createdAt`                 | `DateTime`              | Không có `updatedAt` (theo kế hoạch)                                                                                      |

Dòng "còn hiệu lực" do `activeDirectorWhere(today)` (`src/shared/programs/active-director.ts`) định nghĩa: chưa thu hồi, trong khoảng ngày, **và** chương trình `ACTIVE`; bộ đọc phạm vi R3, tóm tắt chương trình và (sau này) tra người duyệt cấp 2 của F-14 cùng dùng. Không có ràng buộc cơ sở dữ liệu cho việc chồng thời hạn của cùng một người — `ProgramDirectorsService.assign` giữ (`overlapsPeriod`), hai Giám đốc khác nhau cùng thời gian là hợp lệ (US-020 AC3). Không xóa, không kéo dài tại chỗ.

### `Role` — table `Role`

| Column                    | Type          | Notes                                                                          |
| ------------------------- | ------------- | ------------------------------------------------------------------------------ |
| `id`                      | `String`      | `cuid(2)`                                                                      |
| `roleCode`                | `String`      | Duy nhất (R1..R6)                                                              |
| `roleName`                | `String`      |                                                                                |
| `description`             | `String?`     |                                                                                |
| `isSystemRole`            | `Boolean`     | Mặc định `false`                                                               |
| `scopeSource`             | `ScopeSource` | Mặc định `NONE`; khác `NONE` là vai trò suy ra, không có hàng `RoleAssignment` |
| `createdAt` / `updatedAt` | `DateTime`    |                                                                                |

### `Permission` — table `Permission`

| Column                    | Type            | Notes                             |
| ------------------------- | --------------- | --------------------------------- |
| `id`                      | `String`        | `cuid(2)`                         |
| `permissionCode`          | `String`        | Duy nhất; khớp hằng `PERMISSIONS` |
| `permissionName`          | `String`        |                                   |
| `functionGroup`           | `FunctionGroup` |                                   |
| `description` / `source`  | `String?`       |                                   |
| `createdAt` / `updatedAt` | `DateTime`      |                                   |

### `RolePermission` — table `RolePermission`

| Column                    | Type              | Notes                                       |
| ------------------------- | ----------------- | ------------------------------------------- |
| `id`                      | `String`          | `cuid(2)`                                   |
| `roleId`                  | `String`          | FK `Role`                                   |
| `permissionId`            | `String`          | FK `Permission`, chỉ mục                    |
| `mode`                    | `PermissionMode`  |                                             |
| `scope`                   | `PermissionScope` |                                             |
| `updatedById`             | `String?`         | FK `User` — người sửa ô gần nhất trên MH-15 |
| `createdAt` / `updatedAt` | `DateTime`        |                                             |

Duy nhất (`roleId`, `permissionId`). Không có hàng = vai trò không có quyền đó.

### `RoleAssignment` — table `RoleAssignment`

| Column                      | Type                    | Notes                                                                                     |
| --------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `id`                        | `String`                | `cuid(2)`                                                                                 |
| `userId`                    | `String`                | FK `User`, chỉ mục                                                                        |
| `roleId`                    | `String`                | FK `Role`                                                                                 |
| `scopeType`                 | `ScopeType`             | Hàng chỉ mang `SYSTEM` hoặc `UNIT`; `ASSIGNMENT` chỉ xuất hiện lúc đọc cho vai trò suy ra |
| `scopeUnitId`               | `String?`               | FK `OrgUnit`; có khi `UNIT`                                                               |
| `validFrom` / `validTo`     | `Date` / `Date?`        | `@db.Date`                                                                                |
| `assignedById`              | `String?`               | FK `User`                                                                                 |
| `revokedAt` / `revokedById` | `DateTime?` / `String?` | Thu hồi chỉ ghi hai cột này                                                               |
| `createdAt` / `updatedAt`   | `DateTime`              |                                                                                           |

Duy nhất (`userId`, `roleId`, `scopeUnitId`, `validFrom`) — PostgreSQL coi `NULL` là khác nhau, nên kiểm trùng khoảng hiệu lực ở service mới là chặn thật. Hàng không bị sửa vai trò, phạm vi hay ngày; đây là lịch sử phân quyền (FR-10) thay cho bảng kiểm toán đã hoãn.

### `Session` — table `session`

| Column   | Type           | Notes                        |
| -------- | -------------- | ---------------------------- |
| `sid`    | `VARCHAR`      | Khóa chính (`session_pkey`)  |
| `sess`   | `JSON`         | Dữ liệu phiên (`userId`)     |
| `expire` | `TIMESTAMP(6)` | Chỉ mục `IDX_session_expire` |

Hình dạng do `connect-pg-simple` quy định (`createTableIfMissing: false`, bảng do migration tạo); mã ứng dụng không đọc ghi bảng này qua Prisma.

---

## Supporting Enums

| Enum                     | Giá trị                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserStatus`             | `ACTIVE`, `DISABLED`                                                                                                                               |
| `OrgUnitType`            | `UNIVERSITY`, `FACULTY`, `OFFICE`                                                                                                                  |
| `OrgUnitStatus`          | `ACTIVE`, `INACTIVE`                                                                                                                               |
| `ScopeSource`            | `NONE`, `PROGRAM_DIRECTOR`, `SUBJECT_GROUP_COORDINATOR`, `SUBJECT_GROUP_MEMBER`, `OWN_ENROLLMENT`                                                  |
| `FunctionGroup`          | `SYSTEM_ADMIN`, `COURSE_CATALOG`, `PROGRAM`, `LEARNING_OUTCOME`, `SYLLABUS`, `APPROVAL`, `VERSION`, `DATA_REPORT`, `STUDENT_LOOKUP`                |
| `PermissionMode`         | `DIRECT`, `VIA_REQUEST`                                                                                                                            |
| `PermissionScope`        | `ALL`, `SCOPED`                                                                                                                                    |
| `ScopeType`              | `SYSTEM`, `UNIT`, `ASSIGNMENT`                                                                                                                     |
| `SubjectGroupStatus`     | `ACTIVE`, `INACTIVE`                                                                                                                               |
| `SubjectGroupMemberRole` | `MEMBER`, `COORDINATOR`                                                                                                                            |
| `CourseType`             | `THEORY`, `PRACTICE`, `LAB`, `PROJECT`, `CAPSTONE`, `INTERNSHIP`, `CONDITIONAL`                                                                    |
| `CourseStatus`           | `ACTIVE`, `DISCONTINUED`, `CANCELLED`                                                                                                              |
| `CourseRelationType`     | `PRIOR`, `PREREQUISITE`, `COREQUISITE`, `REPLACEMENT`                                                                                              |
| `DegreeLevel`            | `ENGINEER`, `BACHELOR`                                                                                                                             |
| `ProgramStatus`          | `ACTIVE`, `INACTIVE`                                                                                                                               |
| `ProgramVersionStatus`   | `DRAFT`, `PENDING`, `ACTIVE`, `HISTORICAL`                                                                                                         |
| `SyllabusStatus`         | `DRAFT`, `PUBLISHED`, `HISTORICAL`                                                                                                                 |
| `AttachmentFileType`     | `PDF`, `DOCX`, `XLSX`, `IMAGE`                                                                                                                     |
| `ChangeRequestType`      | `GRADING_FORMULA`, `OUTCOME`, `SYLLABUS_CONTENT`, `CURRICULUM`, `COURSE_RELATION`, `PROGRAM_INFO`, `ORGANIZATION`                                  |
| `ChangeTargetType`       | `COURSE`, `PROGRAM`, `SUBJECT_GROUP`                                                                                                               |
| `ChangeRequestStatus`    | `DRAFT`, `PENDING_COORDINATOR`, `PENDING_DIRECTOR`, `PENDING_ACADEMIC_OFFICE`, `APPROVED`, `EFFECTIVE`, `REJECTED`, `WITHDRAWN`                    |
| `RequestOrigin`          | `UNIVERSITY`, `FACULTY`                                                                                                                            |
| `ApprovalAction`         | `PENDING`, `APPROVE`, `RETURN`, `REJECT`                                                                                                           |
| `NotificationType`       | `REQUEST_AWAITING_YOU`, `REQUEST_RETURNED`, `REQUEST_REJECTED`, `REQUEST_APPROVED`, `REQUEST_OVERRIDDEN`, `REQUEST_COMMENTED`, `REQUEST_EFFECTIVE` |
| `NotificationReadStatus` | `UNREAD`, `READ`                                                                                                                                   |
| `ChangeDocumentType`     | `SUBMISSION`, `MINUTES`, `COUNCIL_MINUTES`, `REVIEW_MINUTES`, `OFFICIAL_LETTER`                                                                    |

Các enum sau Giá trị liệt kê lưu ở dạng `SCREAMING_SNAKE` như từ điển dữ liệu ghi (ví dụ `DRAFT`, `PENDING`, `ACTIVE`, `HISTORICAL`).

---

## Seed

`prisma/seed.ts`, chạy bằng `pnpm prisma:seed` (`prisma db seed` → `tsx prisma/seed.ts`, khai ở `prisma.config.ts`). Upsert một tài khoản R1: tên đăng nhập `SEED_ADMIN_USERNAME` (mặc định `admin`), mã `ADMIN`, mật khẩu `SEED_ADMIN_PASSWORD` (bắt buộc, theo chính sách mật khẩu), `mustChangePassword = true`; tài khoản đã có thì không đổi.

`prisma/demo-account.ts` (`pnpm db:demo-account`), chỉ cho bản demo công khai: upsert tài khoản `demo` (mật khẩu `DEMO_PASSWORD`, mặc định `demo`, cố ý ngoài chính sách mật khẩu), đơn vị Phòng Đào tạo, `mustChangePassword = false`, `canSelfApprove = true`, vai trò R1–R5 phạm vi SYSTEM. Chạy lại an toàn. Không chạy trên CSDL có người dùng thật.

`prisma/demo-fixtures.ts` (`pnpm db:demo-fixtures`, chạy sau `db:demo-account`), cũng chỉ cho bản demo: CSDL Trường không có Giám đốc CTĐT, Điều phối nhóm hay nội dung đề cương, nên script gán tài khoản demo làm Giám đốc CTĐT cho mọi chương trình ACTIVE chưa có ai, làm Điều phối cho mọi nhóm chuyên môn chưa có ai, và tạo đề cương Nháp (bản 1, mô tả ghi rõ "Đề cương mẫu cho bản demo") cho mọi học phần chưa có đề cương. Không đụng vào chương trình, nhóm, học phần đã có người hoặc có đề cương; chạy lại không thêm gì.

Quyền và vai trò (F-02, `prisma/seed-data/*`): đơn vị Trường → Khoa CNTT + Phòng Đào tạo, 6 vai trò, 41 quyền (từ điển dữ liệu mục 9, thêm `permission.manage`), ma trận ban đầu 123 ô, gán R1 hệ thống cho tài khoản quản trị. Ô `RolePermission` chỉ được tạo cho quyền seed chèn lần đầu, nên chạy lại seed không hoàn tác thay đổi R1 làm trên MH-15 — ô đã xóa vẫn mất. Đã chạy hai lần trên cơ sở dữ liệu phát triển: `OrgUnit` 3, `Role` 6, `Permission` 41, `RolePermission` 123, `RoleAssignment` 1.

Chương trình mẫu (F-06, `prisma/seed-data/programs.ts`, gọi từ `seed.ts` sau `seedAccessControl`): chương trình `1024034` (Kỹ sư, Khoa CNTT) kèm một phiên bản Nháp; upsert theo `programCode`, chỉ tạo bản Nháp khi chương trình chưa có phiên bản nào nên chạy lại không đổi (kiểm bằng đầu-cuối và chạy `prisma db seed` hai lần: `Program` 1, `ProgramVersion` 1). **Tên, mã ngành và tổng tín chỉ là giá trị giữ chỗ** (Kỹ thuật máy tính, 7480106, 10 học kỳ, 150 = 140 + 10) cho đến khi đọc tệp Excel khung của Khoa (Q-11, F00-24).

Học kỳ và khóa: từ 2026-10-31 seed nền **không** tạo học kỳ hay khóa giữ chỗ (đã xóa `prisma/seed-data/semesters.ts`); học kỳ và khóa thật đến từ seed DUT. Quyền: F-15 thêm hai mã, danh mục nay 43 quyền.

### Seed CTĐT DUT legacy

> **Thay thế 2026-10-31** (`docs/implementation/dut-real-reseed-implementation-plan.md`): extractor đọc bản sao CSV `D:\dut-mirror` (`DUT_MIRROR_ROOT`; bảng `tmProxDUT` + `DHBK_CDS.tmKehoach`) qua allow-list cột ở `extract/mirror-tables.ts`, không còn đọc dump Markdown `source/current-data-dut`. Phạm vi: mọi khung `1024xxx` cùng khung `102xxxx` có sinh viên, chỉ bậc đại học (`CapDT = CD01`). CTĐT gom theo quy tắc ở `extract/program-map.ts`; nhóm tự chọn dựng theo SRS ở `extract/elective-groups.ts`; phiên bản đã ban hành **không có** số quyết định (NULL, bỏ giữ chỗ `DUT-…`) và có ảnh chụp tên/tín chỉ; đơn vị phụ trách lấy từ `tmDonVi` (bỏ `DUT-UNASSIGNED`); học kỳ có ngày thật hoặc `startDateEstimated`. Dựng lại toàn bộ: `pnpm db:rebuild:real --yes`. Các gạch đầu dòng bên dưới là lịch sử của lần seed đầu.

`pnpm prisma:seed:dut` chạy sau migration và `pnpm prisma:seed`, đọc JSON tại `prisma/seed-data/dut/data/` qua loader trong `prisma/seed-data/dut/load/`; extractor nằm ở `prisma/seed-data/dut/extract/`, hai module dùng chung ở root `dut/`. Môi trường dữ liệu thật dùng chuỗi `pnpm real:migrate` → `pnpm real:seed` → `pnpm real:seed:dut`; **không đổi schema hoặc thêm migration**. Seed ghi `OrgUnit`, `Course`, `CourseRelation`, `Semester`, `Cohort`, `Program`, `ProgramVersion`, `ElectiveGroup`, `CurriculumItem`, `CurriculumRequisite`, `CohortVersion`.

- Unit/course/relation/semester/cohort đã có được giữ nguyên theo natural key; các upsert dùng `update: {}`. `Program` đã có `programCode` thì skip whole, không sửa versions hoặc khung; mỗi program mới được ghi trong một transaction.
- Released versions sắp theo `Semester.startDate` thực tế trong database: bản cuối có ngày bắt đầu ≤ `todayDate()` là `ACTIVE`, bản cũ hơn `HISTORICAL`, bản tương lai `PENDING`; không có học kỳ bắt đầu thì `DRAFT`. Version number tăng `1.0`, `2.0`, …, nối `previousVersionId`. Legacy versions không ghim syllabus hoặc snapshots.
- Ngày học kỳ legacy **không bao giờ ghi đè** ngày hiện hữu, kể cả null; summary báo khác biệt. Lượt kiểm chứng giữ `2025-2026-1` ở `2025-09-08`, không đổi thành `2025-08-04`.
- Không thay `1024034`, `DEMO*`, `KnowledgeBlock` hoặc đề cương giữ chỗ. Kết quả caller kiểm chứng trên PostgreSQL 18 ICU `vi-VN` dùng một lần: 24 programs, 46 versions, 3.295 items, 3.135 requisites, 156 groups; chạy lần hai created 0. Không suy ra database của người dùng đã nạp; chi tiết tại `docs/implement-report/dut-legacy-seed-implement-report.md` §V-01.

## F-16 — lịch áp dụng trên lược đồ hiện hữu

Nguồn: `source/backend/prisma/schema.prisma:453` (`Semester`, `Cohort`, `CohortVersion`), `source/backend/src/shared/releases/cohort-version-schedule.ts`, `source/backend/src/features/releases/cohort-versions.service.ts`. F-16 dùng lại dữ liệu F-15; **không thêm entity, cột, enum, migration, permission seed hoặc dependency**; không có bước reset/migrate database riêng cho F-16.

- `CohortVersion` giữ `cohortId`, `programVersionId`, `fromSemesterId`, `createdAt`; ba FK `Restrict`, duy nhất `(cohortId, programVersionId)`, chỉ mục `programVersionId`. Một khóa không được có hai dòng cho cùng một phiên bản; sửa học kỳ dùng PATCH trên dòng hiện có, không tạo dòng lặp. Không có cột `toSemesterId`: khoảng áp dụng suy từ điểm bắt đầu kế tiếp theo chương trình/khóa.
- Không có unique constraint database cho `(programId, cohortId, ngày bắt đầu)`: chương trình được suy qua `ProgramVersion`. Service kiểm trùng ngày `Semester.startDate` kể cả hai ID học kỳ khác nhau, dưới khóa hàng chương trình và giao dịch `Serializable`. Batch POST chỉ ghi các khóa được chọn, nguyên tử; PATCH chỉ đổi `fromSemesterId`, không đổi `createdAt` làm mốc tie.
- Ngày áp dụng phải không sớm hơn `ProgramVersion.effectiveSemester.startDate`; thiếu ngày không được đoán từ `semesterCode`. Lịch gán sai hoặc tham chiếu bản chưa ban hành trả lỗi thay vì ngầm bỏ qua. As-of chọn ngày bắt đầu ≤ học kỳ hỏi, rồi phá tie bằng `createdAt` và `id` giảm dần; không có dòng phù hợp là chưa gán, không fallback ACTIVE (hợp đồng đầy đủ ở `general_architecture.md` §Bộ đọc phiên bản áp dụng).
- `revision` là SHA-256 tính lúc đọc trên các dòng gán của chương trình và toàn bộ ID/ngày bắt đầu học kỳ, không lưu thành model mới; `expectedRevision` bảo vệ POST/PATCH khỏi xác nhận cũ. Ràng buộc duy nhất hiện hữu vẫn là hàng rào cuối (`P2002` → `COHORT_VERSION_EXISTS`); xung đột serialization (`P2034`) → `ASSIGNMENT_STATE_CHANGED`.
- So sánh dùng lại tên/tín chỉ đóng băng, pin `CurriculumItem.syllabusId` và các nội dung phiên bản hiện hữu; không bổ sung bảng diff, không backfill snapshot từ dữ liệu sống. Ảnh chụp legacy thiếu dữ liệu phải báo `VERSION_SNAPSHOT_INCOMPLETE`, không coi là dữ liệu đầy đủ. F-17 chưa có adapter sinh viên; lịch này chưa chứng minh việc áp dụng ngoại lệ từng sinh viên.

## Nhập Excel (F-09) — lược đồ đã áp dụng

Nguồn: `source/backend/prisma/schema.prisma`; migration `source/backend/prisma/migrations/20261026091026_import_batches/migration.sql`. Orchestrator xác nhận đã áp migration trên dev database và Testcontainers; prisma format/generate đã hoàn tất ngày 2026-10-26. Không suy ra mọi máy người dùng đã migrate.

| Thành phần                         | Dữ liệu / ràng buộc                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ImportType                         | COURSE_CATALOG, CURRICULUM, STUDENT_LIST, ACADEMIC_RESULT; F-09 chỉ mở API cho hai loại đầu                                                                          |
| ImportBatchStatus                  | VALIDATING, DRY_RUN, COMMITTING, COMMITTED, ABORTED                                                                                                                  |
| ImportBatch                        | id cuid2; importType, fileName, performedById, programId?, versionId?, status; totalRows/successRows/errorRows mặc định 0; errorReport JSON; recordedAt, finishedAt? |
| ImportBatchFile                    | batchId vừa PK vừa FK; content Bytes, sizeBytes, expiresAt. Tách nội dung khỏi truy vấn lịch sử; giữ 30 ngày                                                         |
| Khóa ngoại                         | performedById → User và programId → Program: Restrict; versionId → ProgramVersion: SetNull; xóa batch cascade tệp                                                    |
| Chỉ mục                            | batch: (performedById, recordedAt), (programId, recordedAt), (status, recordedAt); file: expiresAt                                                                   |
| ImportBatch_program_for_curriculum | (importType = CURRICULUM) tương đương (programId IS NOT NULL)                                                                                                        |
| ImportBatch_row_counts             | Ba bộ đếm không âm; successRows + errorRows = totalRows                                                                                                              |

Hai CHECK được nối tay trong migration, không được bỏ khi sinh lại SQL. Dọn tệp không xóa batch/report; việc xóa phiên bản không làm mất lịch sử nhập. Ma trận liên quan dòng khung đã cascade từ CurriculumItem theo F-11; F-09 không thêm thay đổi lược đồ ngoài hai bảng và hai enum này.

## Công thức điểm, ánh xạ đánh giá–CLO (F-12) — lược đồ đã áp dụng

Migration `20261027154125_grade_formula_assessment_clo`, chỉ thêm, không sửa dữ liệu cũ. Nguồn: `source/backend/prisma/schema.prisma` (`AssessmentComponent`, `AssessmentCLOMapping`).

| Đối tượng               | Cột chính                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Syllabus.failingScore` | `Decimal(9,2)` null: điểm liệt học phần                                                                                                                                                                                       |
| `AssessmentComponent`   | `syllabusId` (Cascade), `componentCode`, `componentName`, `weight Decimal(5,2)`, `assessmentForm?`, `isConditional`, `conditionThreshold? Decimal(9,2)`, `failingScore? Decimal(9,2)`; duy nhất `(syllabusId, componentCode)` |
| `AssessmentCLOMapping`  | `assessmentComponentId` và `cloId` (đều Cascade), `cloWeight? Decimal`; duy nhất `(assessmentComponentId, cloId)`; ô null vẫn là đã ánh xạ                                                                                    |

Năm CHECK nối tay trong migration, không được bỏ khi sinh lại SQL: `Syllabus_failingScore_nonnegative`, `AssessmentComponent_weight_range` (0 < w ≤ 100), `AssessmentComponent_threshold_shape` (điều kiện thì có ngưỡng ≥ 0), `AssessmentComponent_failingScore_nonnegative`, `AssessmentCLOMapping_weight_range`. Tổng 100 và độ phủ CLO kiểm ở dịch vụ, không ở CHECK. Bản đề cương cũ không được điền công thức tự động. `prisma format` căn lại khoảng trắng toàn schema trong cùng lượt.

## Hồ sơ sinh viên, quá trình học và kết quả nguồn (F-17)

Migration `20261027165710_student_records_results` tạo năm bảng dưới đây. Các FK mặc định `Restrict`; riêng dữ liệu bàn giao tài khoản đi theo `ImportBatch` với `Cascade`.

### `Student` — table `Student`

| Column | Type | Notes |
|---|---|---|
| `id`, `studentCode`, `fullName` | `String` | `id` CUID2; `studentCode` duy nhất |
| `cohortId`, `admissionSemesterId`, `statusSemesterId` | `String` | FK tới `Cohort`, học kỳ nhập học và học kỳ trạng thái trong `Semester` |
| `major`, `status`, `dataSource` | `String`, `StudentStatus`, `StudentDataSource` | Trạng thái `STUDYING` / `ON_LEAVE` / `WITHDRAWN` / `GRADUATED`; nguồn `EXCEL` / `SCHOOL_DB` |
| `userId` | `String?` | FK `User`, duy nhất; tài khoản có thể chưa liên kết |
| `createdAt`, `updatedAt` | `DateTime` | `updatedAt` cũng là token chống ghi đè khi đổi quá trình học |

Index `(cohortId, status)` và `(fullName, id)` phục vụ danh sách.

### `ProgramEnrollment` — table `ProgramEnrollment`

| Column | Type | Notes |
|---|---|---|
| `id`, `studentId`, `programId`, `cohortId` | `String` | FK sinh viên, chương trình và khóa |
| `appliedVersionId`, `admissionVersionId` | `String` | FK `ProgramVersion`: bản áp dụng và bản tại thời điểm nhập học |
| `cohortAssignmentId` | `String?` | FK `CohortVersion` làm căn cứ |
| `fromSemesterId`, `untilSemesterId` | `String`, `String?` | FK `Semester`; khoảng học kỳ bắt đầu đóng, kết thúc mở |
| `previousEnrollmentId` | `String?` | FK tự tham chiếu duy nhất, nối chuỗi lịch sử không phân nhánh |
| `enrollmentType`, `status` | `EnrollmentType`, `EnrollmentStatus` | `PRIMARY` / `SECOND_MAJOR`; `ACTIVE` / `TRANSFERRED` / `ENDED` |
| `isException`, `basisDecision`, `createdById` | `Boolean`, `String?`, `String?` | Ngoại lệ phải có quyết định không rỗng; người tạo FK `User` |
| `createdAt`, `updatedAt` | `DateTime` | Dấu thời gian và token kiểm tra thay đổi |

SQL có hai unique index có điều kiện: tối đa một hàng `ACTIVE` cho `(studentId, programId)` và một hàng `ACTIVE` loại `PRIMARY` cho mỗi sinh viên. CHECK `ProgramEnrollment_exception_basis` yêu cầu căn cứ ngoại lệ; `ProgramEnrollment_closed_interval` buộc `ACTIVE` tương đương `untilSemesterId IS NULL`. Index thường `(studentId, programId)` và `(programId, cohortId, status, isException)`.

### `AcademicResult` — table `AcademicResult`

| Column | Type | Notes |
|---|---|---|
| `id`, `studentId`, `courseId`, `semesterId` | `String` | FK `Student`, `Course`, `Semester`; duy nhất `(studentId, courseId, semesterId)` |
| `score10`, `score4`, `letterGrade` | `Decimal(4,2)?`, `Decimal(3,2)?`, `String?` | Điểm nguồn; CHECK giới hạn lần lượt 0..10 và 0..4; API gửi Decimal dạng chuỗi |
| `status`, `dataSource`, `revision` | `AcademicResultStatus`, `StudentDataSource`, `Int` | `PASSED` / `FAILED` / `IN_PROGRESS` / `EXEMPT`; revision mặc định 1, CHECK > 0 |
| `createdAt`, `updatedAt` | `DateTime` | Index `(studentId, semesterId)` |

### `AcademicResultChange` — table `AcademicResultChange`

| Column | Type | Notes |
|---|---|---|
| `id`, `academicResultId`, `revision` | `String`, `String`, `Int` | FK kết quả; duy nhất `(academicResultId, revision)` |
| `before`, `after`, `recordedAt` | `Json?`, `Json`, `DateTime` | Ảnh dữ liệu nguồn trước/sau; index `(recordedAt, id)` |

### `StudentCredentialDelivery` — table `StudentCredentialDelivery`

| Column | Type | Notes |
|---|---|---|
| `batchId` | `String` | PK đồng thời FK `ImportBatch`, một bản bàn giao cho mỗi phiên |
| `accountCount` | `Int` | CHECK > 0; không tạo hàng nếu không phát sinh tài khoản mới |
| `ciphertext`, `iv`, `authTag`, `keyId` | `Bytes?`, `Bytes?`, `Bytes?`, `String?` | XLSX mã hóa và fingerprint khóa; không lưu khóa giải mã |
| `expiresAt`, `downloadedAt`, `createdAt` | `DateTime`, `DateTime?`, `DateTime` | Hết hạn sau 24 giờ; index `expiresAt`; tải một lần hoặc dọn hết hạn sẽ xóa payload mã hóa, giữ metadata |

## Xét tốt nghiệp (F-19) — lược đồ đã áp dụng

Migration `20261030050730_graduation_review` (áp dụng vào DB dev 2026-10-30) thêm năm enum, sáu model và giá trị `GRADUATION_CONCLUSION_CHANGED` cho `NotificationType`. Mọi FK `Restrict`; khóa chính `cuid(2)`, riêng receipt dùng `changeId`.

| Enum | Giá trị |
| --- | --- |
| `GraduationConclusion` | ELIGIBLE, NOT_ELIGIBLE |
| `GraduationAuditTrigger` | STAFF, BATCH, RESULT_CHANGE |
| `GraduationBatchStatus` | QUEUED, RUNNING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED |
| `GraduationBatchItemStatus` | PENDING, REVIEWED, ERROR |
| `GraduationReauditStatus` | PENDING, RUNNING, COMPLETED, COVERED, FAILED |

| Model | Khóa / index | Ghi chú |
| --- | --- | --- |
| `GraduationAuditContext` | unique `(studentId, programId, semesterId)`; `lastAuditId` unique; index `studentId` | Head trỏ audit mới nhất của context |
| `GraduationAudit` | `operationKey` unique; `supersedesId` unique (chuỗi audit) | `enrollmentId`, `programVersionId`, `auditedById` nullable, `trigger`, `conclusion`, `schemaVersion`, `ruleVersion`, JSON `shortfalls`/`result`/`inputs`, `inputDigest`. Writer chỉ thêm, không cập nhật |
| `GraduationBatch` | unique `(requestedById, requestKey)`; index `(status, leaseUntil, createdAt)` | `filters` JSON, `previewRevision`, `rosterDigest`, `studentCount`, `enrollmentCount`, `leaseToken`/`leaseUntil`, `failureCode` |
| `GraduationBatchItem` | unique `(batchId, studentId, programId, semesterId)`; `auditId` unique; index `(batchId, status, id)` | `rosterEnrollmentId` nullable, `rosterIdentity` JSON, `errorCode`/`errorMessage` |
| `GraduationResultChangeReceipt` | PK `changeId` → `AcademicResultChange` | `targetCount`, `reason` nullable |
| `GraduationReauditTask` | unique `(changeId, contextId)`; index `(status, leaseUntil, createdAt)` | `baselineAuditId`, `completedAuditId` nullable, `attempts`, `leaseToken`/`leaseUntil`, `errorCode` |

- Tám CHECK trong SQL migration: `schemaVersion > 0`; reviewer bắt buộc khi trigger STAFF/BATCH và null khi RESULT_CHANGE; `studentCount`/`enrollmentCount` dương và `studentCount <= enrollmentCount`; RUNNING phải có lease (batch và task); outcome item nhất quán với status; `targetCount >= 0`; `attempts >= 0`.
- Back-relation thêm vào `User`, `Student`, `Program`, `Semester`, `ProgramEnrollment`, `ProgramVersion`, `AcademicResultChange`; không đổi cột hiện hữu.
