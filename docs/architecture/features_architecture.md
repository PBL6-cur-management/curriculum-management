# Features Architecture

<!--
  FILE PURPOSE   : Per-feature breakdown of layers, contracts, components, and design decisions.

  WHAT BELONGS   : Backend module, endpoints, services, screens and key design decisions per
                   feature.

  WHAT DOES NOT  : Implementation status (→ todo.md), active work detail (→ current_work.md),
                   tech configuration (→ technical_reference.md), overall layer rules
                   (→ general_architecture.md).

  UPDATE WHEN    : A new module, endpoint, screen, or contract is added or changed.

  FORMAT:
            ## N. <Feature Name>
            ### Backend — `src/<module>/`
            ### Frontend
            #### `<Page>` — Screen Name
            - bullet: key behavior or contract
-->

Ghi những gì **đã dựng**. Danh sách 27 tính năng dự kiến và thứ tự ở `docs/implementation/README.md`; thiết kế màn hình đích ở `docs/design/screen-inventory.md`.

---

## 0. Trạng thái hệ thống (F-00, khung)

### Backend — `src/features/health/`

- `GET /api/health` → `HealthDto { status: 'ok' | 'error', database: 'up' | 'down', redis: 'up' | 'down' }`.
- `@Public()` — gọi được khi chưa đăng nhập.
- 200 khi cả hai phụ thuộc hoạt động; 503 kèm cùng thân khi một trong hai mất kết nối — controller đặt mã qua `response.status(...)`, không ném lỗi, nên thân vẫn là `HealthDto` chứ không phải `ErrorResponseDto`.
- `HealthService` hỏi PostgreSQL bằng `SELECT 1` và Redis bằng `PING` trên một kết nối `ioredis` riêng (hết giờ sau 1 giây), không qua kết nối của BullMQ.

### Frontend

#### `HealthPage` — Trạng thái hệ thống (`/health`)

- Gọi `fetchHealth` (`src/features/health/api/health.ts`), nhận cả 503 như một kết quả có thân.
- Mỗi phụ thuộc một dòng: thẻ "Hoạt động" hoặc "Mất kết nối"; lỗi khác hiện "Không kết nối được máy chủ ứng dụng".
- Nằm sau `RequireAuth` như mọi trang trong khung; `/` là `HomePage`, không còn chuyển hướng về `/health`.

---

## 1. Đăng nhập, phiên (F-01)

Kế hoạch: `docs/implementation/f-01-auth-session-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-01-auth-session-implement-report.md`. Hạ tầng dùng chung (phiên, guard, mật khẩu, lỗi) tả ở `general_architecture.md` §2.

### Backend — `src/features/auth/`

- `POST /api/auth/login` (`@Public`) — `LoginDto { username, password }` → 200 `MeDto`. Tên đăng nhập chuẩn hóa (`shared/auth/username.ts`) trước khi tìm. Sai tên hoặc sai mật khẩu cùng một lỗi 401 `INVALID_CREDENTIALS`; tài khoản DISABLED → 403 `ACCOUNT_DISABLED`. Thành công thì `regenerate` phiên rồi lưu `userId`.
- `POST /api/auth/logout` (`@Public`) — 204; hủy phiên nếu có, xóa cookie `ctdt.sid`.
- `GET /api/auth/me` (`@AllowPendingPasswordChange`) — `MeDto` của người dùng hiện tại, gồm `mustChangePassword`.
- `POST /api/auth/change-password` (`@AllowPendingPasswordChange`) — `ChangePasswordDto { currentPassword, newPassword }` → 204. Mật khẩu hiện tại sai → 400 `CURRENT_PASSWORD_WRONG`; trùng mật khẩu cũ → 400 `PASSWORD_UNCHANGED`; thành công thì xóa `mustChangePassword`.
- Chính sách mật khẩu (`shared/password/password-policy.ts`): 8..128 ký tự, có chữ và số; băm Argon2id.
- Mã lỗi của tính năng ở `auth.errors.ts`; đăng nhập thất bại chỉ ghi nhật ký ứng dụng, chưa có `AuditLog` (F01-07).
- Seed `prisma/seed.ts`: upsert tài khoản R1 (`SEED_ADMIN_USERNAME`, mặc định `admin`; `SEED_ADMIN_PASSWORD` bắt buộc) với `mustChangePassword = true`.

### Frontend

#### `LoginPage` — MH-01 Đăng nhập (`/login`)

- Nạp ngay (không lazy). Đã đăng nhập thì chuyển đi; đăng nhập xong quay về trang trong `state.from` hoặc `/`.
- Lỗi hiện `message` của máy chủ trong `Alert`.

#### `AccountPage` — MH-03 Tài khoản của tôi (`/account`)

- Thông tin người dùng và biểu mẫu đổi mật khẩu (`rules` ở `features/auth/schema/authRules.ts`); thành công báo "Đã đổi mật khẩu".
- Khi `mustChangePassword`, `RequireAuth` giữ người dùng ở trang này và hiện cảnh báo; mọi trang khác trả về đây.

#### `HomePage` — MH-02 Trang chính (`/`)

- "Xin chào, <họ tên>"; menu lọc theo quyền từ F-02.

#### Dùng chung — `src/shared/auth/`

- `useMe` — trạng thái phiên duy nhất phía giao diện; `useLogout` gọi đăng xuất rồi `queryClient.clear()`.
- `RequireAuth` bọc `AppLayout`; chưa đăng nhập → `/login` kèm `state.from`.

---

## 2. Tài khoản, vai trò, phạm vi quyền (F-02)

Kế hoạch: `docs/implementation/f-02-accounts-roles-permissions-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-02-accounts-roles-permissions-implement-report.md`. Guard, `AccessContext` và quyền phía giao diện tả ở `general_architecture.md` §2, §3. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/users/`

- Cả controller cần `user.manage`.
- `GET /api/users` (`PageQueryDto` + lọc) → `UserPageDto`; `GET /api/users/:userId` → `UserDto`.
- `POST /api/users` → tài khoản mới kèm mật khẩu tạm do máy chủ sinh, trả một lần; `mustChangePassword = true`. Trùng tên đăng nhập → 409 `USERNAME_TAKEN`, trùng mã → 409 `USER_CODE_TAKEN`; đơn vị không có → 400 `ORG_UNIT_NOT_FOUND`.
- `PATCH /api/users/:userId`; `POST .../disable`, `.../enable` (lặp lại không lỗi); `POST .../reset-password` → mật khẩu tạm mới. Tự vô hiệu hóa → 400 `CANNOT_DISABLE_SELF`.
- `GET|POST /api/users/:userId/role-assignments`, `POST .../role-assignments/:assignmentId/revoke` — chỉ gán vai trò `scopeSource = NONE`, phạm vi `SYSTEM` hoặc `UNIT`; kiểm trùng khoảng hiệu lực; thu hồi ghi `revokedAt`/`revokedBy`, không sửa hàng; không tự thu hồi vai trò của mình.

### Backend — `src/features/permissions/`

- `GET /api/roles` (`user.manage` hoặc `permission.view`).
- `GET /api/permissions/matrix` (`permission.view`) — 6 vai trò × 43 quyền (41 lúc F-02), mỗi ô `mode` + `scope`, kèm ô khóa.
- `PUT|DELETE /api/roles/:roleCode/permissions/:permissionCode` (`permission.manage`) — đặt hoặc bỏ ô; ghi `updatedBy` và một dòng nhật ký ứng dụng. Ô khóa (`LOCKED_CELLS`: R1 × `permission.manage`, R1 × `user.manage`) không đổi được.

### Backend — `src/features/org-units/`

- `GET /api/org-units` (`@AnyAuthenticated`) — danh sách đơn vị cho ô chọn. Ghi đơn vị và màn hình cây thuộc F-03 (§3).

### Frontend

#### `UserListPage` — MH-05 Danh sách tài khoản (`/users`)

- Bảng phân trang, lọc; tạo, sửa qua `UserFormModal`; mật khẩu tạm hiện một lần trong `TemporaryPasswordModal`.

#### `UserDetailPage` — MH-06 Chi tiết tài khoản (`/users/:userId`)

- `UserInfoCard` (sửa, vô hiệu hóa/mở lại, đặt lại mật khẩu; nút tự vô hiệu hóa bị tắt); `RoleAssignmentsCard` liệt kê cả hàng đã thu hồi làm lịch sử; `AssignRoleModal` chọn vai trò, phạm vi, ngày hiệu lực.

#### `PermissionMatrixPage` — MH-15 Ma trận quyền (`/permissions`)

- Cần `permission.view`; `MatrixCell` sửa được khi có `permission.manage` và ô không khóa.

---

## 3. Đơn vị và nhóm chuyên môn (F-03)

Kế hoạch: `docs/implementation/f-03-org-units-subject-groups-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-03-org-units-subject-groups-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/org-units/`

- Ghi đơn vị cần `orgUnit.manage`: `POST /api/org-units` (chỉ `FACULTY`/`OFFICE`, cha phải đang hoạt động và đúng loại), `PATCH /api/org-units/:unitId` (mã, loại không sửa; đổi cha chạy kiểm chu trình), `POST .../deactivate`, `POST .../activate` (lặp lại không lỗi). Không có route xóa.
- Lỗi: `UNIT_CODE_TAKEN` 409, `PARENT_INVALID`, `PARENT_CYCLE`, `PARENT_INACTIVE`, `ROOT_UNIT_LOCKED`, `UNIT_HAS_ACTIVE_CHILDREN`, `UNIT_HAS_ACTIVE_GROUPS`. Đơn vị còn tài khoản vẫn ngừng được.

### Backend — `src/features/subject-groups/`

- `GET /api/subject-groups` (`subjectGroup.view`, lọc theo phạm vi, `?facultyId&status`) và `GET /api/subject-groups/:groupId` (404 trước, ngoài phạm vi → 403 `OUT_OF_SCOPE`; kèm mọi hàng thành viên đã có). Tóm tắt có `activeMemberCount`, `activeCoordinators`, `hasActiveCoordinator`.
- Ghi nhóm cần `orgUnit.manage`: tạo, sửa (`groupCode` không sửa), `GET .../deactivation-impact` (thành viên, Điều phối, các học phần chưa hủy của nhóm theo mã — đọc bảng `Course` qua Prisma, không import tính năng học phần), `.../deactivate`, `.../activate` (từ chối khi khoa ngừng). Nhóm ngừng giữ nguyên hàng; thành viên mất phạm vi ngay.
- Thành viên: `POST .../members` (nhóm và người đang hoạt động; chồng thời gian → 409 `MEMBERSHIP_OVERLAP`; Điều phối không phủ bởi thành viên → 400 `COORDINATOR_NOT_MEMBER`), `POST .../members/:memberId/end` (trả mọi hàng bị đổi; cắt hoặc thu hồi hàng Điều phối bên trong), `.../revoke` (từ chối khi còn Điều phối phụ thuộc → 409 `MEMBER_HAS_COORDINATOR`). `GET /api/subject-group-memberships?userId=` (`orgUnit.manage` hoặc `user.manage`) cho MH-06.
- Vai trò R4, R5 tự theo hàng: hết kỳ Điều phối thì `me.roles` mất R4 ở yêu cầu kế tiếp, R5 giữ.

### Frontend

#### `OrgUnitTreePage` — MH-07 Cây đơn vị (`/org-units`)

- Cần `orgUnit.manage`. Cây dựng bằng `buildOrgTree` từ `GET /org-units` và `GET /subject-groups` (nhóm nằm dưới khoa, bấm sang MH-08); mọi nút mở sẵn trừ nút người dùng thu lại. `OrgUnitDetailPanel` sửa, thêm đơn vị con, ngừng (hộp xác nhận), kích hoạt lại; mọi thao tác làm mất hiệu lực khóa `org-units` dùng chung nên ô chọn đơn vị ở nơi khác thấy ngay.

#### `SubjectGroupListPage` — MH-08 Nhóm chuyên môn (`/subject-groups`)

- Cần `subjectGroup.view`; lọc khoa, trạng thái; thẻ "Chưa có Điều phối". Có `orgUnit.manage` thì thêm, sửa, kích hoạt lại, và ngừng sau khi `DeactivateGroupModal` nạp danh sách ảnh hưởng.

#### `SubjectGroupDetailPage` — MH-08 chi tiết (`/subject-groups/:groupId`)

- Bảng Điều phối và Thành viên (`MemberTable`), ẩn hàng hết hạn/thu hồi trừ khi bật lịch sử; `AddMemberModal` (Thành viên hoặc Điều phối, ô chọn `UserSelect`), `EndMemberModal`, thu hồi. 403 hiện "Nhóm này nằm ngoài phạm vi của bạn".

#### MH-06 — `UserSubjectGroupsCard`

- Thẻ nhóm chuyên môn của một tài khoản trên trang chi tiết tài khoản.

---

## 4. Danh mục học phần (F-04)

Kế hoạch: `docs/implementation/f-04-course-catalog-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-04-course-catalog-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/courses/`

- `GET /api/courses` (`course.view`, mọi vai trò xem cả danh mục, không lọc phạm vi): `?q` (không phân biệt hoa thường, không bỏ dấu, trên mã và tên), `ownerFacultyId`, `ownerGroupId`, `courseType`, `status`, `foreign`, `sort` (`courseCode|courseName|credits|updatedAt`) và `order`, kèm `page`, `pageSize`; mã luôn là khóa phụ để phân trang ổn định. Học phần `CANCELLED` chỉ hiện cho người có `course.edit`.
- `GET /api/courses/:courseId` trả `CourseDetailDto`: `editPath` (`DIRECT` | `VIA_REQUEST` | `null`) và `canChangeStatus` tính cho người gọi, `programsUsing` (từ F-07: mỗi phiên bản chưa lịch sử của chương trình đang dùng, kèm `plannedSemester`), `equivalenceGroup` (`{ id, groupCode, members }` với `members` không gồm chính học phần, hoặc `null`). Học phần đã hủy → 404 `COURSE_NOT_FOUND` với người không có `course.edit`, trước khi kiểm phạm vi.
- `POST /api/courses`, `PATCH /api/courses/:courseId` (cần `course.edit`; `UpdateCourseDto` không có `courseCode`, gửi vào → 400 `VALIDATION_FAILED`). Mục tiêu phạm vi của học phần là `{ subjectGroupIds: [nhóm], orgUnitIds: [khoa] }`; nhóm chuyên môn phải đang hoạt động và thuộc khoa (`OWNER_GROUP_INVALID`), khoa phải đang hoạt động (`OWNER_FACULTY_INVALID`), mã trùng → 409 `COURSE_CODE_TAKEN`. Chỉ kiểm lại chủ sở hữu khi giá trị thật sự đổi. Tín chỉ là chuỗi khớp `CREDITS_PATTERN`.
- `POST /api/courses/:courseId/{discontinue,reopen,cancel}`: bảng `COURSE_TRANSITIONS`; chỉ khi chế độ gốc của người gọi trên học phần là `DIRECT` (R1), nếu không → 409 `CHANGE_REQUEST_REQUIRED`. Ngừng mở lớp nhận thân yêu cầu tùy chọn `{ replacementCourseId }` (F-05): quan hệ `REPLACEMENT` được tạo và trạng thái đổi trong cùng một giao dịch, rồi `CourseUsageReader.hasActiveReplacement(courseId, tx)` phải thấy một học phần thay thế `ACTIVE`, nếu không → 409 `REPLACEMENT_REQUIRED`; học phần thay thế là chính nó, không có hoặc không `ACTIVE` → 400 `REPLACEMENT_INVALID`; hủy bị chặn bởi `inReleasedVersion` / `hasStudyResults` (→ 409 `COURSE_IN_USE`); `CANCELLED` là cuối (409 `COURSE_CANCELLED`). Không có route xóa.
- Quy tắc sửa: học phần của khoa khác chỉ R1 sửa trực tiếp (R3 → `CHANGE_REQUEST_REQUIRED`, R4/R5 → 403 `OUT_OF_SCOPE`); học phần của Khoa CNTT chưa ban hành thì R3..R5 sửa trực tiếp trong phạm vi; đã ban hành (F-15) thì mọi người qua đề xuất.
- Dùng chung (`src/shared/`): `authz/edit-path.ts` (`editPathFor`, `resolveEditPath`, `assertDirectEdit`), `courses/` (`CourseUsageReader`, `CoursesSharedModule`), `org-units/home-faculty.ts`, `decimal/decimal.ts`, `dtos/ref.dto.ts` (`SubjectGroupRefDto`, `CourseRefDto`), `dtos/transforms.ts`.

### Frontend — `src/features/courses/`

#### `CourseListPage` — MH-16 Danh mục học phần (`/courses`)

- Cần `course.view`. Ô tìm kiếm (trễ 300 ms), lọc khoa, nhóm (chỉ khi có `subjectGroup.view`), loại, trạng thái (`Đã hủy` chỉ khi có `course.edit`), và "Tất cả / Của Khoa / Khoa khác"; sắp xếp theo mã, tên, tín chỉ; mọi lần đổi bộ lọc về trang 1. Thẻ "Khoa khác" cạnh tên. "Thêm học phần" khi có `course.edit`.

#### `CourseDetailPage` — MH-17 (`/courses/:courseId`)

- `CourseInfoCard`, `CourseRelationsSection` + `EquivalentCoursesCard` (F-05, xem mục 5), `ProgramsUsingList` (ẩn khi rỗng), `CourseEditButton` (từ `editPath`: "Sửa", "Tạo đề xuất" bị khóa kèm chú thích đến F-13, hoặc ẩn) và `CourseStatusActions` (menu "Đổi trạng thái"; "Mở lại" và "Hủy" dùng hộp xác nhận `App.useApp().modal`, hủy có cảnh báo không hoàn tác; "Ngừng mở lớp" mở `DiscontinueCourseModal` của F-05). Quyền lấy từ máy chủ, không suy từ vai trò.

#### `CourseFormPage` — MH-18 (`/courses/new`, `/courses/:courseId/edit`)

- Trang, không phải hộp thoại. AntD `rules` (`schema/courseRules.ts`, khớp bản phía máy chủ), tín chỉ là ô chữ gửi nguyên chuỗi; mã bị khóa khi sửa; đổi khoa xóa nhóm; ô nhóm chỉ hiện khi có `subjectGroup.view` và khi đó mới gửi `ownerGroupId`. Lỗi nghiệp vụ có `details.field` (`COURSE_CODE_TAKEN`, `OWNER_GROUP_INVALID`) đặt dưới ô tương ứng qua `shared/forms/applyFieldErrors.ts`.

---

## 5. Quan hệ học phần, nhóm tương đương (F-05)

Kế hoạch: `docs/implementation/f-05-course-relations-equivalence-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-05-course-relations-equivalence-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/course-relations/`

- `GET /api/courses/:courseId/relations` (`course.view`): mọi quan hệ mà học phần là nguồn hoặc đích, kèm `editPath` cho người gọi; học phần đã hủy → 404 `COURSE_NOT_FOUND` với người không có `course.edit`.
- `POST /api/course-relations`, `PATCH /api/course-relations/:relationId` (chỉ `minScore`, chỉ `PREREQUISITE`), `DELETE /api/course-relations/:relationId` (204); cần `courseRelation.edit`. Quyền, phạm vi và đường sửa kiểm trên **học phần sở hữu** (đích của `PRIOR`/`PREREQUISITE`/`COREQUISITE`, nguồn của `REPLACEMENT`) bằng `courseTarget` + `courseEditState` + `assertDirectEdit` (R1 mọi nơi; R3..R5 trên học phần của Khoa CNTT chưa ban hành trong phạm vi; còn lại 409 `CHANGE_REQUEST_REQUIRED` hoặc 403 `OUT_OF_SCOPE`).
- Kiểm theo thứ tự: tự quan hệ (400 `RELATION_SELF`), ngưỡng sai loại (400 `MIN_SCORE_NOT_ALLOWED`), học phần không có (400 `RELATION_COURSE_NOT_FOUND`), học phần đã hủy (409 `RELATION_COURSE_CANCELLED`), quyền, rồi trong một giao dịch: `lockRequisiteGraph` → chống chu trình (chỉ cạnh `PRIOR` + `PREREQUISITE`) → ghi; trùng → 409 `RELATION_EXISTS`; vòng → 409 `REQUISITE_CYCLE` với đường đi ghi vào `message` (`… : A → B → C → A.`, mã học phần). Song hành được khai báo hai chiều, thay thế không bị kiểm vòng.
- Xóa quan hệ `REPLACEMENT` cuối cùng còn hiệu lực của học phần đang `DISCONTINUED` → 409 `REPLACEMENT_STILL_NEEDED`. Ngừng mở lớp hay hủy học phần thay thế không bị chặn (T-2; F-24 cảnh báo).

### Backend — `src/features/equivalence-groups/`

- `GET /api/equivalence-groups?q` (mã nhóm hoặc mã học phần thành viên) và `GET /:groupId` (`course.view`); ghi cần `courseRelation.edit` **và** `assertSchoolWideDirect` (chỉ R1): `POST /` (mã, ghi chú, ≥ 2 học phần), `PATCH /:groupId`, `POST /:groupId/members`, `DELETE /:groupId/members/:courseId` (không xuống dưới 2: 409 `GROUP_MIN_MEMBERS`), `POST /:groupId/merge` (giữ mã và ghi chú của nhóm gọi; nhóm kia bị xóa), `POST /:groupId/dissolve` (204).
- Thêm học phần đã ở nhóm khác → 409 `COURSE_ALREADY_GROUPED`, `message` nêu mã học phần và nhóm đó; ghi `updateMany` có điều kiện (`equivalenceGroupId: null`, chưa hủy) nên hai yêu cầu tranh nhau thì một bên thua gọn.

### Frontend

- `src/shared/courses/` — `CourseSelect` (một học phần) và `CourseMultiSelect` (nhiều): tìm từ xa theo mã hoặc tên trong `GET /courses?status=ACTIVE`, trễ 300 ms qua `shared/hooks/useDebouncedValue`, nhớ nhãn đã chọn; nhận `id` từ `Form.Item`.
- MH-17 thêm `CourseRelationsSection` (bảng quan hệ đọc từ phía học phần hiện tại — nhãn theo loại **và** phía, `relationLabel`; ngưỡng điểm sửa tại chỗ `MinScoreCell`; xóa kèm xác nhận khi `editPath = DIRECT`, nút "Tạo đề xuất" bị khóa khi `VIA_REQUEST`), `AddRelationModal` (bảy lựa chọn `RELATION_CHOICES`, ô ngưỡng chỉ khi tiên quyết, thông điệp `REQUISITE_CYCLE` của máy chủ hiện nguyên văn trong `Alert`), `EquivalentCoursesCard` (mã nhóm liên kết tới MH-19 `?q=`, danh sách thành viên khác) và `DiscontinueCourseModal` (hiện học phần thay thế sẵn có hoặc đòi chọn một; gửi `{ replacementCourseId }`).
- MH-19 `EquivalenceGroupsPage` (`/equivalence-groups`, cần `course.view`; menu "Học phần" › "Nhóm tương đương"): bảng nhóm, thẻ thành viên (liên kết MH-17, nút xóa kèm xác nhận), "Tạo nhóm" (≥ 2 học phần chặn ở biểu mẫu), "Thêm học phần" (khi 409 `COURSE_ALREADY_GROUPED` hiện nút "Gộp nhóm" mở `MergeGroupsModal` với hai nhóm chọn sẵn), "Gộp với nhóm…", "Sửa", "Giải thể" (xác nhận). Nút sửa hiện cho người có `courseRelation.edit` (`useCanEditSchoolWide`; `/api/auth/me` chưa có chế độ và phạm vi nên máy chủ từ chối R3..R5 bằng 403).

---

## 6. Chương trình đào tạo, Giám đốc CTĐT (F-06)

Kế hoạch: `docs/implementation/f-06-programs-directors-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-06-programs-directors-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/programs/`

- `ProgramsController` gom cả route chương trình lẫn route Giám đốc; `ProgramsService` (chương trình, thông tin ở bản Nháp, nhân bản) và `ProgramDirectorsService` (phân công).
- `GET /api/programs?q&degreeLevel&status&page&pageSize` (`program.view`): service đòi ô `program.view` không theo phạm vi (`scopeFor(...).all`) nên sinh viên (ô `P`) bị 403 `PERMISSION_DENIED` (US-018 AC3); `q` tìm mã hoặc tên ở **bất kỳ** phiên bản; `programName` và `currentVersion` lấy từ phiên bản hiện hành (bản `ACTIVE`, không có thì bản mới nhất — trước phát hành là Nháp); `directors` là người đang hiệu lực hôm nay.
- `POST /api/programs` (`program.editInfo` + `assertSchoolWideDirect`, chỉ R1): ghi `Program` và một `ProgramVersion` `DRAFT` trong một lần; tổng khác bắt buộc + tự chọn → 400 `CREDITS_MISMATCH` với `message` nêu "chênh lệch N tín chỉ" và `details` trỏ `totalCredits` (KB-011); mã trùng → 409 `PROGRAM_CODE_TAKEN`; khoa mặc định là Khoa CNTT, phải là `FACULTY` đang hoạt động (400 `PROGRAM_FACULTY_INVALID`).
- `GET /api/programs/:programId` (`program.view`, `assertCan` trên `programTarget`): `ProgramDetailDto` có `currentVersionInfo`, `draftVersion` (hoặc `null`), `versions`, `clonedFrom`, `editPath`, `canManage` (có `director.assign` trực tiếp), `canClone`.
- `PATCH /api/programs/:programId` (`program.editInfo`): `assertDirectEdit` với `programEditState`; sửa **bản Nháp** (và `degreeLevel` trên chương trình) trong một giao dịch; không có Nháp hoặc đã có phiên bản rời Nháp → 409 `CHANGE_REQUEST_REQUIRED`; chỉ gửi một phần thì tổng tín chỉ kiểm với giá trị đã lưu; R3 chỉ sửa chương trình mình phụ trách (khác → 403 `OUT_OF_SCOPE`; hết hạn phân công → 403 `PERMISSION_DENIED` vì không còn R3). Không có route xóa chương trình.
- `POST /:programId/deactivate`, `/reactivate` (`program.editInfo` + `assertSchoolWideDirect`): R1; cùng trạng thái → 409 `PROGRAM_STATUS_UNCHANGED`. Chương trình `INACTIVE` rời phạm vi R3 và không nhận phân công mới (409 `PROGRAM_INACTIVE`) nhưng vẫn đọc được.
- `POST /:programId/clone` (`program.clone`, R1): một giao dịch tạo `Program` mới (cùng khoa và trình độ, `clonedFromId` = phiên bản nguồn) với bản Nháp chép mô tả, rồi `VersionContentCopier.copy`; nguồn mặc định là phiên bản hiện hành, `sourceVersionId` của chương trình khác → 400 `SOURCE_VERSION_INVALID`; bản sao không có Giám đốc và không dùng chung hàng với nguồn.
- Giám đốc: `GET /:programId/directors` (`program.view`, kiểm `assertCan` ngay trong service) trả mọi dòng kể cả lịch sử, `validFrom` mới nhất trước, kèm `state`; `POST /:programId/directors` (`director.assign`): người phải là tài khoản `ACTIVE` (400 `DIRECTOR_INVALID`), khoảng ngày hợp lệ, **cùng một người** không chồng thời hạn trên cùng chương trình (409 `DIRECTOR_PERIOD_OVERLAP`) còn hai người khác nhau thì được; `POST /…/:assignmentId/end` chỉ rút ngắn (400 `END_DATE_NOT_EARLIER`, 400 `VALIDITY_INVALID`); `POST /…/revoke` cho dòng nhập nhầm; dòng đã thu hồi → 404 `DIRECTOR_ASSIGNMENT_NOT_FOUND`.
- `ProgramsSharedModule` (`src/shared/programs/`) xuất `VersionContentCopier`; `ScopeSourceReader` trả `{ programIds }` cho `PROGRAM_DIRECTOR`. R3 xuất hiện trong `/api/auth/me` (`derived: true`) từ yêu cầu kế tiếp sau khi có dòng phân công hiệu lực.

### Frontend

- Tuyến `ROUTES.programs`, `programNew`, `programDetail`, `programEdit`; menu "Chương trình đào tạo" (`program.view`, ẩn với người chỉ có R6 qua `hideForRoles`).
- `api/programs.ts`, `hooks/usePrograms.ts` (mọi ghi làm mới toàn bộ `['programs']`), `constants/programLabels.ts`, `schema/programRules.ts` (`PROGRAM_RULES`, `CREDITS_EPSILON`).

#### `ProgramListPage` — MH-21 (`/programs`)

- Bảng mã (liên kết MH-22), tên, trình độ, phiên bản hiện hành (`versionLabel`: số phiên bản hoặc "Nháp"), Giám đốc CTĐT, trạng thái; tìm có trễ 300 ms qua `useDebouncedValue`, lọc trình độ, lọc trạng thái (mặc định "Đang sử dụng", có "Tất cả" = không gửi `status`); phân trang phía máy chủ. "Thêm chương trình" hiện theo `useCanEditSchoolWide(programEditInfo)` (cũng hiện với R3, máy chủ trả 403).

#### `ProgramOverviewPage` — MH-22 (`/programs/:programId`)

- `ProgramInfoCard` (mô tả của bản Nháp nếu có, không thì bản hiện hành; "Nhân bản từ" liên kết chương trình nguồn), `ProgramDirectorsSection` (bảng cả lịch sử, dòng đang hiệu lực lên trước; chỉ khi `canManage`: "Phân công" qua `AssignDirectorModal` = `UserSelect` + hai `DatePicker`, "Kết thúc" qua `EndDirectorModal` chỉ cho dòng `ACTIVE`/`SCHEDULED`, "Thu hồi" kèm xác nhận "Chỉ dùng khi phân công nhập nhầm"), (`ProgramSectionLinks` đã xóa 2026-10-31: điều hướng nay ở `ProgramWorkspaceLayout`, xem `general_architecture.md`; F-15 thêm `ReleaseCard`, `ProgramVersionsSection`).
- `ProgramEditButton` theo `editPath` (`DIRECT` → "Sửa thông tin"; `VIA_REQUEST` → "Tạo đề xuất" (từ F-13 là liên kết tới MH-39); `null` → ẩn), `CloneProgramButton` khi `canClone`, `ProgramStatusActions` ("Ngừng sử dụng"/"Dùng lại", hộp xác nhận `App.useApp().modal`) khi `canManage`.

#### `ProgramFormPage` — MH-23 (`/programs/new`, `/programs/:programId/edit`)

- Trang với AntD `rules`; tín chỉ là ô chữ gửi nguyên chuỗi, số học kỳ là `InputNumber` 1..12; `CreditsGapHint` hiện "Chênh lệch N tín chỉ." / "Khớp tổng tín chỉ." khi gõ nhưng vẫn cho gửi — máy chủ quyết định (`Number()` chỉ để hiển thị). Sửa: điền từ bản Nháp, mã bị khóa; `editPath` khác `DIRECT` → cảnh báo và chuyển về tổng quan. Lỗi nghiệp vụ có `details.field` đặt dưới ô qua `applyFieldErrors`.

#### `CloneProgramModal` — MH-24

- Chọn phiên bản nguồn (mặc định hiện hành), mã và tên mới; thành công chuyển tới tổng quan bản sao; `PROGRAM_CODE_TAKEN` hiện dưới ô mã. Ghi chú phạm vi nhân bản (`CLONE_SCOPE_NOTE`) nói bản sao chép "thông tin chương trình và khung" — phần khung đúng sau F-07.

---

## 7. Khung chương trình, nhóm tự chọn (F-07)

Kế hoạch: `docs/implementation/f-07-curriculum-elective-groups-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-07-curriculum-elective-groups-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/curriculum/`

- Ba controller theo gốc tuyến: `program-versions/:versionId` (đọc khung, thêm dòng, sắp xếp, tạo nhóm), `curriculum-items/:itemId` (sửa, xóa, thay điều kiện), `elective-groups/:groupId` (sửa, xóa, gán dòng). Năm service: `CurriculumReadService` (đọc + tra cứu cho mọi ghi), `CurriculumService` (dòng, sắp xếp), `CurriculumRequisitesService`, `ElectiveGroupsService`; `curriculum-access.ts` (`itemTarget`, `assertCurriculumWrite`), `curriculum-totals.ts`.
- Thứ tự mọi lần ghi: tìm phiên bản (404) → phải là `DRAFT` (409 `VERSION_NOT_EDITABLE`) → `assertDirectEdit` với `programEditState` (sau phát hành: 409 `CHANGE_REQUEST_REQUIRED`). Đối tượng quyền của một dòng là chương trình **và** nhóm chuyên môn của học phần (R4/R5 chỉ dòng của nhóm mình); sắp xếp và nhóm tự chọn dùng đối tượng chương trình (R1, R3).
- `GET /api/program-versions/:id/curriculum` (`program.view`) trả một `CurriculumDto`: dòng (đã có `displayOrder`, `canEdit`), tổng theo học kỳ và khối, khối kiến thức, nhóm, cảnh báo, `editPath`, `canEditStructure`, `canAddItems`. Tổng cộng mọi dòng như bảng Excel; tín chỉ cộng bằng `Prisma.Decimal`.
- Điều kiện riêng của khung: chép từ danh mục khi thêm dòng; `PUT …/requisites` thay toàn bộ, chạy `findRequisiteCycle` trên hợp cạnh danh mục `PRIOR`/`PREREQUISITE` và cạnh của cùng phiên bản dưới `lockRequisiteGraph` (khóa này nay có hai nơi ghi).
- `src/shared/curriculum/`: `curriculumWarnings` (hàm thuần: `EMPTY_SEMESTER` INFO, `REQUISITE_NOT_EARLIER` HIGH; F-08 đã mở rộng chữ ký), `CurriculumFactsReader.maxPlannedSemester` (cho `ProgramsService.update`), `CurriculumSharedModule`. `VersionContentCopier.copy` chép nhóm → dòng → điều kiện, trả ánh xạ id cũ → mới cho F-11.
- `ProgramCloneService` (tách khỏi `ProgramsService` cho gọn); `SEMESTERS_BELOW_CURRICULUM` khi giảm `semesterCount` dưới học kỳ đã xếp; `GET /api/courses` nhận `status` lặp lại.

### Frontend — `src/features/curriculum/`

- Tuyến `ROUTES.curriculum`, `ROUTES.electiveGroups` (`/programs/:programId/versions/:versionId/…`, quyền `program.view`); không có mục menu — vào từ tab "Khung chương trình" của `ProgramWorkspaceLayout`.
- `CurriculumPage` (MH-25): chuyển "Dạng dòng" / "Theo học kỳ", lọc phía máy khách (`applyCurriculumFilters`), cảnh báo, tổng theo học kỳ và khối (tổng chung cộng bằng `shared/decimal`), kéo thả trong học kỳ (`@dnd-kit`, tắt khi đang lọc hoặc không có quyền cấu trúc; tay cầm mang thuộc tính `role` của dnd-kit để hàng bảng giữ vai trò `row`), `CurriculumItemModal`, `RequisitesModal` (lỗi vòng hiện trong hộp thoại).
- `ElectiveGroupsPage` (MH-26): bảng nhóm, thẻ "Ít hơn yêu cầu" (so sánh thập phân), `ElectiveGroupFormModal`, `AssignItemsModal` (`Transfer`: chỉ dòng tự chọn chưa nhóm hoặc của nhóm này).
- Dùng chung mới: `shared/decimal`, `shared/courses/{gradePoint,courseQueryKeys}`, `shared/constants/versionLabels`, `CourseSelect` nhận `statuses`, `initialLabels`; `withQuery` nhận mảng (khóa lặp lại). `ProgramsUsingList` có liên kết, học kỳ và câu "chưa được chương trình nào sử dụng".

---

## 8. Kiểm tra nhất quán (F-08)

Kế hoạch: `docs/implementation/f-08-consistency-check-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-08-consistency-check-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/consistency/`

- `GET /api/program-versions/:versionId/consistency`: báo cáo tín chỉ (bắt buộc, tự chọn, tổng; theo nhóm tự chọn — nhóm chỉ đặt số học phần tính theo thành viên rẻ nhất) và danh sách lỗi có mức, `itemId` để "Tới chỗ sửa".
- `PUT …/credit-mismatch-acceptance`: R1, R3 chấp nhận chênh lệch kèm lý do; ghi năm cột `creditMismatch*` một lần (CHECK năm-hoặc-không); chênh lệch đã đổi từ lúc xem → 409 `CREDIT_GAP_CHANGED`. Sửa khung làm chênh lệch khác đi thì cảnh báo trở lại.
- Lõi ở `src/shared/curriculum/consistency-checker.ts`: `ConsistencyChecker.check(versionId, db?)` và `assertPasses(versionId, db)` (409 `CONSISTENCY_FAILED`, `details` mỗi lỗi một `field` = mã); F-13 gọi khi gửi, F-15 khi ban hành (sau `lockRequisiteGraph(tx)`). Có `REQUISITE_CYCLE` (vòng danh mục–khung, `curriculumCycleHits`) và, từ F-15, `MISSING_SYLLABUS`. Dòng tự chọn không thuộc nhóm không tính vào tổng (cảnh báo HIGH).

### Frontend — `src/features/consistency/`

#### `ConsistencyPage` — MH-27 (`ROUTES.consistency`)

- Thẻ tín chỉ, dòng tổng chương trình, bảng lỗi kèm "Tới chỗ sửa" (mở khung, xóa bộ lọc nếu dòng bị lọc ẩn); modal chấp nhận khóa nút và tải lại báo cáo khi gặp `CREDIT_GAP_CHANGED`. Thẻ tóm tắt ở tổng quan chương trình.

---

## 10. Đề cương (F-10)

Kế hoạch: `docs/implementation/f-10-syllabus-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-10-syllabus-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

Tệp đính kèm bắt buộc có `materialKind` khi tải lên: `SIGNED_SYLLABUS` (Đề cương đã ký), `TEXTBOOK` (Giáo trình), `LECTURE_SLIDES` (Slide bài giảng), `OTHER` (Tài liệu khác). DTO từ chối loại thiếu hoặc không hợp lệ trước khi lưu tệp. `ATTACHMENT_MAX_MB` mặc định 50 MB, dùng chung cho tệp đề cương và văn bản đề xuất; vẫn giới hạn 10 tệp mỗi bản đề cương. `AttachmentUploader` yêu cầu chọn loại, không chọn sẵn và khóa bộ chọn tệp trước khi chọn loại. `AttachmentList` dùng chung cho trình sửa và trang chỉ đọc, nhóm theo thứ tự trên với nhãn và số lượng, ẩn nhóm rỗng; giữ nguyên tải xuống và xóa.

### Backend — `src/features/syllabi/`

- Một đề cương mỗi học phần, đánh bản số (`revisionNumber`); nhiều nhất một Nháp và một Đã ban hành (chỉ mục từng phần). `GET/POST /api/courses/:courseId/syllabus`, `PATCH /syllabi/:id` (sáu mục văn bản đi qua `sanitizeRichText`, ≤ 100 000 ký tự), tuần (`POST`, `PUT …/order`, `PATCH`, `DELETE`, ≤ 60 dòng), tệp đính kèm (`POST` multipart, `GET …/file`, `DELETE`; PDF, DOCX, XLSX, ảnh; ≤ `ATTACHMENT_MAX_MB`, ≤ 10 tệp).
- `syllabus-access.ts`: `assertDraftWrite(…, permission)` — Nháp chỉ hiện với người có `program.view` phạm vi ALL (R1..R5); R3/R4/R5 sửa thẳng Nháp học phần Khoa CNTT, học phần khoa khác chỉ R1; `touchSyllabus` đổi `updatedAt` khi sửa tuần, CLO.
- Bản đề cương đọc theo dòng khung qua `revisionForItems` (`src/shared/syllabi/`); bản đã ban hành bị khóa sửa tệp (`ATTACHMENT_LOCKED`).

### Frontend — `src/features/syllabi/`

#### `SyllabusPage` (`ROUTES.syllabus`), `SyllabusEditorPage` (`ROUTES.syllabusEdit`)

- Vào từ học phần hoặc dòng khung, không có mục menu. Trình soạn có tab (`EDITOR_TABS`, tab có `enabled`, `disabledHint`): Nội dung (Tiptap, bật EN, "Chưa dịch"), Tuần (`WeeklyContentTable`, kéo thả qua tay nắm, cột CLO), Tệp, CLO. Lưu không remount biểu mẫu nên không mất chữ đang gõ. Banner phiên bản khi xem bản đã ban hành (F-15).

---

## 11. PLO, CLO, ma trận (F-11)

Kế hoạch: `docs/implementation/f-11-plo-clo-matrices-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-11-plo-clo-matrices-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/outcomes/`, CLO ở `src/features/syllabi/`

- PLO theo phiên bản: `GET/POST /program-versions/:id/plos`, `PUT …/plos/order`, `PATCH/DELETE /plos/:id` (xóa trả số ô và liên kết bị mất; trùng mã không phân biệt hoa thường).
- Ma trận học phần–PLO: `GET /program-versions/:id/course-plo-matrix`, `PUT/DELETE /curriculum-items/:itemId/plo-weights/:ploId` (trọng số trong (0, 1], hai chữ số thập phân; xóa ô xóa liên kết CLO bên dưới).
- CLO theo bản đề cương (dùng chung mọi chương trình): `POST /syllabi/:id/clos`, `PUT …/clos/order`, `PATCH/DELETE /clos/:id`, gắn vào tuần.
- Ma trận CLO–PLO: `GET /program-versions/:id/clo-plo-matrix`, `GET/PUT /curriculum-items/:itemId/clo-plo-matrix|clo-plo-links` (chỉ PLO có ô học phần mới mở). Kiểm tra phủ `GET /program-versions/:id/outcome-coverage` (R4, R5 lọc theo nhóm mình); `OutcomeGapsReader` ở `src/shared/outcomes/` cho F-24/F-26.
- Ghi qua `assertOutcomeWrite` / `assertDraftWrite`; `VersionContentCopier` chép PLO và hai ma trận.

### Frontend — `src/features/outcomes/`

- `PloListPage`, `CoursePloMatrixPage` (một ô `Input` tại một lúc, nhập `0,5`), `ProgramCloPloPage` (lọc học kỳ, PLO), `ItemCloPloPage` (cột chưa gắn bị khóa), `OutcomeCoveragePage`; vào từ thẻ ở tổng quan chương trình, R6 chỉ thấy PLO. Sắp xếp dùng `useSortableReorder` chung với tuần, CLO.

---

## 13. Đề xuất thay đổi (F-13)

Kế hoạch: `docs/implementation/f-13-change-requests-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-13-change-requests-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/change-requests/`

- Bảy loại (`ChangeRequestType`); mã đề xuất từ dãy `change_request_code_seq`. Loại có không gian làm việc (khung, đề cương, PLO, thông tin chương trình) được **bản làm việc** — `ProgramVersion`/`Syllabus` có `sourceRequestId`, chép từ bản đã ban hành mới nhất (`WorkingCopyService`, `released-base.ts`); loại học phần, quan hệ, tổ chức soạn mục trong `ChangeItem` (`AuthoredItemsService`).
- `/api/change-requests`: danh sách, `conflicts` (cảnh báo chồng đề xuất, BR-30), `user-options`, tạo, chi tiết, `PATCH`, `DELETE` (Nháp), `rebase`, `PUT :id/items`, `diff`, `submit-preview` (thấy các cấp bị bỏ qua), `submit` (chạy `ConsistencyChecker`, ghi `ChangeItem`, `RoutingPlanner` tạo `ApprovalStep`), `withdraw`, văn bản (`POST :id/documents`, `/change-request-documents/:id[/file]`).
- `createdByAcademicOffice` ghi lúc tạo (`isAcademicOfficeHolder`) cho F-15. `StaleChecker` báo bản gốc đã đổi.

### Frontend — `src/features/change-requests/`

- `ChangeRequestListPage` MH-38 (cột, bộ lọc "Số ngày chờ"), `ChangeRequestFormPage` MH-39, `OrganizationalRequestPage` MH-40, `ChangeRequestDetailPage` MH-41 (`StepProgress`, `DiffView`), `ChangeRequestEditPage` (mở màn hình sửa sẵn có trên bản làm việc, `RequestDraftBanner`). `CreateRequestButton` dùng ở mọi màn hình có `editPath`.

---

## 14. Duyệt ba cấp, thông báo (F-14)

Kế hoạch: `docs/implementation/f-14-three-level-approval-notifications-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/change-requests/`, `src/features/notifications/`

- `ApprovalService`: `POST /change-requests/:id/approve|return|reject|override` (Duyệt thay); ghi qua `ApprovalRecorder` (`claim`, `actionableRows`, `record`, `close`), giữ `levelEnteredAt`. Tên cấp từ hằng `APPROVAL_LEVEL_NAMES`, không đọc `ApprovalLevelConfig`. Từ chối, Rút xóa bản làm việc. Đề xuất tổ chức áp dụng khi duyệt xong (`OrganizationalApplier`, qua `membership.writer`, `director.writer` dùng chung); đề xuất dữ liệu ở cấp 3 → `FINAL_APPROVAL_REQUIRED`.
- `GET :id/history`, `GET/POST :id/comments` (bình luận không sửa, không xóa), `GET /approval-queue` (`minDaysWaiting` theo ngày lịch giờ Việt Nam).
- `/api/notifications`: danh sách, `unread-count` (`@PassiveRequest()`), `read-all`, `:id/read`. `RequestNotifier` (`src/shared/change-requests/`) dựng câu tiếng Việt lúc sự kiện xảy ra.

### Frontend

- `ApprovalPanel` + `RemarkModal` + `OverrideModal`, `ApprovalHistory`, `CommentsCard` trong MH-41; `ApprovalQueuePage` MH-42 (menu "Chờ tôi duyệt" cho người có `changeRequest.view`); `NotificationBell` ở Header, `NotificationsPage` MH-04 (menu "Thông báo").

---

## 15. Ban hành, ảnh chụp phiên bản (F-15)

Kế hoạch: `docs/implementation/f-15-release-version-snapshots-implementation-plan.md`; báo cáo dựng: `docs/implement-report/f-15-release-version-snapshots-implement-report.md`. Mã xong, chưa đi thử bằng trình duyệt.

### Backend — `src/features/releases/`, `src/features/semesters/`, phê duyệt cuối ở `src/features/change-requests/`

- Ban hành khởi tạo (H-1): `GET /programs/:programId/versions/:versionId/release-check`, `POST …/release` (số quyết định, ngày ký, học kỳ hiệu lực, khóa áp dụng → `CohortVersion`).
- Phê duyệt cuối: `GET /change-requests/:id/final-approval` (xem trước, chương trình bị ảnh hưởng — `FinalApprovalProgramDto`), `POST :id/final-approve` (`FinalApprovalService`, `FinalApprovalApplier`; `canFinalApprove` trong `RequestActionsDto`; thông báo `REQUEST_EFFECTIVE`). Đề xuất đề cương lan ra mọi chương trình đang dùng học phần (bỏ chương trình INACTIVE). Học kỳ đã bắt đầu chỉ cho đề xuất có `createdByAcademicOffice`; học kỳ hiệu lực trước bản gốc → `EFFECTIVE_BEFORE_BASE`.
- `VersionPublisher` (số `major.minor`, ảnh chụp tên và tín chỉ chỉ ghi khi còn null, ghim `CurriculumItem.syllabusId`), `SyllabusPublisher` (chuyển bản Đã ban hành cũ sang HISTORICAL trước khi công bố), `VersionActivator` (PENDING → ACTIVE, cũ → HISTORICAL) chạy trực tiếp và qua hàng đợi `release-activation`; sửa học kỳ kích hoạt ngay bản đến hạn.
- Lịch sử: `GET /programs/:programId/versions`, `GET …/:versionId` (bảng dòng đóng băng). Đính chính (R1): `POST …/corrections`, `POST …/corrections/:id/issue`, `DELETE …/corrections/:id`; Nháp đính chính sống cạnh Nháp thường, thừa kế `originRequestId`.
- Học kỳ, khóa: `GET/POST/PATCH /semesters`, `/cohorts`; menu "Học kỳ và khóa tuyển sinh".

### Frontend — `src/features/releases/`, `FinalApprovalPage` ở `change-requests`

- `SemestersPage` MH-10, `FinalApprovalPage` MH-43, `InitialReleasePage` MH-45, `VersionHistoryPage` MH-46, `VersionDetailPage` MH-47 (liên kết tới màn hình chỉ đọc sẵn có), `CorrectionPage` MH-49; `ReleaseCard`, `ProgramVersionsSection` ở tổng quan chương trình; `SemesterSelect`, `CohortSelect` ở `shared/releases/`.

## 16. So sánh phiên bản và gán khóa (F-16)

### Backend — `src/features/releases/`, `src/shared/releases/`

- Nguồn: `source/backend/src/features/releases/releases.module.ts`, `version-comparison.controller.ts`, `version-comparison.service.ts`, `released-version-snapshot.reader.ts`, `version-comparison.presenter.ts`, `version-comparison.constants.ts` (các tệp sau cùng thuộc thư mục `source/backend/src/features/releases/`). Các route dưới đây có tiền tố `/api`.
- `GET /programs/:programId/version-comparison?beforeVersionId=…&afterVersionId=…`: kiểm `program.view` và `version.compare` theo phạm vi chương trình; đọc hai bản đã ban hành cùng chương trình trong giao dịch `RepeatableRead`, không dựng lại từ chuỗi đề xuất. Cho phép hai bản không liền nhau; đối chiếu theo natural key trên dữ liệu đóng băng.
- Luôn trả đủ sáu nhóm: `INFO` (thông tin chương trình), `CURRICULUM` (khung và điều kiện học), `ELECTIVE_GROUPS`, `PLOS`, `MATRICES` (Course–PLO, CLO–PLO), `SYLLABI` (đề cương được ghim). Phân biệt Thêm / Bớt / Sửa; nhóm rỗng vẫn hiển thị “Không thay đổi”. Không suy ảnh chụp thiếu từ danh mục đang sống.
- `GET /programs/:programId/version-comparison/syllabi/:courseId` dùng cùng cặp query; suy hai `syllabusId` từ pin của hai phiên bản, không nhận tùy ý hai đề cương. Kiểm thêm `syllabus.view` theo phạm vi học phần; trả ba nhóm `SYLLABUS_FIELD`, `WEEKLY_CONTENTS`, `CLO`, kể cả nhóm rỗng. Không có pin ở một bên trả `404 PINNED_SYLLABUS_NOT_FOUND`; bản chưa ban hành hoặc ảnh chụp không đầy đủ trả `409 VERSION_NOT_ISSUED` / `VERSION_SNAPSHOT_INCOMPLETE`.
- Nguồn gán khóa: `source/backend/src/features/releases/cohort-versions.controller.ts`, `source/backend/src/features/releases/cohort-versions.service.ts`, `source/backend/src/features/releases/dto/cohort-version.dto.ts`. Cả bốn route yêu cầu `version.assignCohort`; service giới hạn đường sửa trực tiếp toàn trường (R1) và kiểm `program.view` theo phạm vi.
- `GET /programs/:programId/cohort-versions` trả lịch cùng `revision`; `POST` cùng route nhận `programVersionId`, danh sách `cohortIds` được chọn rõ, `fromSemesterId`, `expectedRevision`, ghi cả batch nguyên tử. `PATCH /programs/:programId/cohort-versions/:assignmentId` chỉ sửa `fromSemesterId` với `expectedRevision`, không thay khóa hoặc phiên bản của dòng. Không tự chuyển các khóa khác hoặc sinh số sinh viên bị ảnh hưởng.
- `GET /programs/:programId/cohorts/:cohortId/applied-version?semesterId=…` trả `ASSIGNED` cùng dòng thắng hoặc `UNASSIGNED` với `assignment: null`. Học kỳ bắt buộc; quy tắc as-of, tie, revision và khóa giao dịch ở `general_architecture.md` §Bộ đọc phiên bản áp dụng; ràng buộc lưu trữ ở `database_and_models.md` §F-16 — lịch áp dụng trên lược đồ hiện hữu.
- Lỗi gán: `404 COHORT_ASSIGNMENT_NOT_FOUND` hoặc không tìm thấy chương trình/phiên bản/khóa/học kỳ; `409 COHORT_VERSION_EXISTS`, `ASSIGNMENT_START_CONFLICT`, `ASSIGNMENT_BEFORE_VERSION`, `ASSIGNMENT_STATE_CHANGED`, `INVALID_COHORT_ASSIGNMENT`, `SEMESTER_START_UNKNOWN`. Nguồn mã lỗi: `source/backend/src/shared/releases/applied-version.errors.ts`, `release.errors.ts` trong cùng thư mục. `P2002` ánh xạ trùng khóa–phiên bản; `P2034` ánh xạ lịch thay đổi, không che lỗi khác.

### Frontend

Nguồn route: `source/frontend/src/routes.ts:32`, `source/frontend/src/router.tsx:385`; các trang thuộc `source/frontend/src/features/releases/pages/`, thành phần thuộc `source/frontend/src/features/releases/components/`.

#### `VersionComparisonPage` — MH-48 (`/programs/:programId/version-comparison`)

- Cặp chọn lưu bằng query `beforeVersionId` / `afterVersionId`; `VersionComparisonSections` trình bày đủ sáu nhóm và liên kết drilldown pin. `PinnedSyllabusComparisonPage` ở `/programs/:programId/version-comparison/syllabi/:courseId` giữ cùng cặp phiên bản, trình bày ba nhóm đề cương. Route dùng `version.compare`; backend vẫn kiểm quyền xem và phạm vi.

#### `VersionHistoryPage`, `VersionDetailPage` — MH-46/47

- Các route `/programs/:programId/versions` và `/programs/:programId/versions/:versionId` đã nối chọn so sánh và điều hướng các nhóm nội dung; xem phiên bản cũ từ dữ liệu đóng băng, không chuyển sang bản hiện hành để thay lịch sử.

#### `CohortVersionAssignmentsPage` — MH-50

- `/cohort-versions` mở bộ chọn chương trình; `/programs/:programId/cohort-versions` hiển thị lịch, tạo batch và sửa học kỳ từng dòng; route dùng `version.assignCohort`. `AppliedCohortVersionPanel` tra cứu theo khóa và học kỳ, phân biệt chưa có gán với lỗi tải.
- `CohortVersionAssignmentForm` xác nhận chương trình, phiên bản, từng khóa và học kỳ trước khi ghi; giữ revision lúc xác nhận, hủy xác nhận đã cũ và yêu cầu tải/xác nhận lại khi dữ liệu đổi. Không diễn giải batch là chuyển toàn bộ sinh viên; adapter sinh viên F-17 vẫn chưa dựng.

## Nhập, xuất Excel (F-09) — MH-29, MH-30 và MH-25

### Backend

Mã tại `source/backend/src/features/imports/`. ImportsController dùng PermissionGuard; quyền data.import_excel cho danh mục, curriculum.import_export_excel cho khung. Các route chung chấp nhận một trong hai quyền rồi service kiểm đúng loại/phạm vi; không phải authenticated-only. GET /api/imports/types quyết định loại UI được cung cấp; hiện chỉ COURSE_CATALOG và CURRICULUM. R3 giới hạn chương trình được phân công, kiểm ngay khi upload (ngoài phạm vi trả 403 OUT_OF_SCOPE).

| Method | Route                                              | Hành vi                                                                                              |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | /api/imports/types                                 | Loại nhập khả dụng theo quyền                                                                        |
| GET    | /api/imports/curriculum-targets                    | Nháp hợp lệ trong phạm vi                                                                            |
| GET    | /api/imports/templates/:importType                 | Tải mẫu XLSX                                                                                         |
| POST   | /api/imports                                       | Multipart file/importType/versionId; tạo batch HTTP 201; sai header vẫn tạo ABORTED với formatErrors |
| GET    | /api/imports                                       | Lịch sử có lọc, phân trang và phạm vi                                                                |
| GET    | /api/imports/:batchId                              | Chi tiết và báo cáo theo dòng                                                                        |
| POST   | /api/imports/:batchId/commit                       | Chỉ chủ phiên DRY_RUN, tệp còn hạn và đích còn hợp lệ; kiểm lại trước transaction                    |
| GET    | /api/imports/:batchId/file                         | Tải tệp gốc trong hạn 30 ngày                                                                        |
| GET    | /api/program-versions/:versionId/curriculum/export | Xuất khung cùng định dạng nhập; không giới hạn trạng thái Nháp                                       |

Báo cáo giữ số dòng worksheet và tên cột. Severity trên wire là ERROR/HIGH/INFO tương ứng LỖI/CẢNH BÁO/LƯU Ý; chỉ ERROR chặn ghi. Trạng thái VALIDATING → DRY_RUN → COMMITTING → COMMITTED; lỗi định dạng, kiểm dữ liệu, tái kiểm hoặc job thất bại kết thúc ABORTED. Xác nhận lại không ghi trùng; nhập lại khung giữ id dòng còn tồn tại. Xuất/nhập vào bản sao cần metadata chương trình đích khớp, không áp metadata tệp vào phiên bản.

### Frontend và kiểm chứng

- `source/frontend/src/features/imports/`: /imports (MH-29), /imports/history và /imports/:batchId (MH-30); chọn loại từ API, tải mẫu, kiểm .xlsx/5 MB, upload, báo cáo severity, xác nhận minh thị, polling, lỗi/rỗng riêng. Lịch sử giữ bộ lọc và phân trang trên URL; hết hạn chỉ khóa tệp/ghi, không mất báo cáo.
- `source/frontend/src/features/curriculum/pages/CurriculumPage.tsx`: nút xuất theo quyền; shortcut nhập cho Nháp thông thường, backend vẫn là nguồn quyết định đích được phép.
- `source/backend/test/imports.e2e-spec.ts`: PostgreSQL + BullMQ/Redis thật trên Testcontainers, round trip sang bản sao, giữ id, phân quyền, hết hạn và NFR dry-run khung. `source/e2e/specs/f-09-excel-import-export.spec.ts`: tải mẫu, round trip cùng Nháp, lịch sử, lỗi header, giới hạn tệp và sinh viên bị chặn. Ba ca thủ công còn nợ: sự cố DB thật, NFR-05 đủ hai bước/hai loại và tệp Khoa thật.

## Công thức điểm, ánh xạ đánh giá–CLO (F-12)

### Backend — `src/features/syllabi/`, `src/shared/syllabi/`, `src/features/change-requests/`

- `GradeFormulaService` (`grade-formula.service.ts`, DTO `grade-formula.dto.ts`) thay toàn bộ công thức và toàn bộ lưới ánh xạ của một bản đề cương trong một giao dịch. Hai route: `PUT /api/syllabi/:syllabusId/grading-formula` và `PUT /api/syllabi/:syllabusId/assessment-clo-mappings`, cùng quyền `gradingFormula.edit`, cùng token `expectedUpdatedAt`.
- Luật kiểm tra dùng chung ở `shared/syllabi/grade-formula.rules.ts` và `grade-formula.errors.ts`: tổng tỷ trọng đúng 100, mã duy nhất, ngưỡng bắt buộc với thành phần điều kiện, ô ánh xạ không trùng. Khóa `syllabus-assessment-lock.ts` khóa yêu cầu rồi bản đề cương.
- DTO đề cương thêm `gradingEditPath`, `canEditGradingFormula`, `gradingFormula` (kèm cảnh báo `ASSESSMENT_CLO_UNCOVERED`); CLO thêm `assessmentLinkCount`.
- Yêu cầu GRADING_FORMULA dùng workspace đề cương: bản sao chép thành phần và ánh xạ, diff theo khóa tự nhiên, đi hết ba cấp duyệt và ban hành bản mới. Ba cổng chặn CLO chưa được đánh giá: gửi duyệt, ban hành, duyệt cuối (`change-requests/assessment-blockers.ts`); kiểm tra phát hành cũng xét bản ghim và bản kế thừa.
- Thay đổi công thức (`change-requests/grading-changes.ts`) bị từ chối ở học kỳ đã bắt đầu, kể cả Phòng đào tạo có cờ; thay đổi loại khác giữ ngoại lệ F-15.

### Frontend — `src/features/syllabi/`

- Trình sửa đề cương có sáu tab; mỗi tab bật theo quyền nội dung, CLO hoặc công thức. Route dùng `shared/auth/RequireAnyPermission`.
- `GradeFormulaTab`, `AssessmentCloTab`, `GradeFormulaView` (trang xem); hook `useGradeFormula`, `useEditorRemountKey`; tiện ích số thập phân `utils/gradeFormulaValues.ts`.
- `SyllabusActions` có hành động công thức riêng: qua yêu cầu (`Đề xuất sửa công thức điểm`) hoặc trực tiếp (`Sửa công thức điểm`).

## 17. Hồ sơ sinh viên và nhập kết quả học tập (F-17)

### Backend — `src/features/students/`, `src/features/imports/`

- `StudentsController` cung cấp `GET /api/students/program-options`, `GET /api/students`, `GET /api/students/:studentId`, cùng các tuyến con `results`, `applied-version`, `enrollment-targets`. `StudentsReadService` đọc theo ngữ cảnh học kỳ/chương trình; các tuyến đọc hồ sơ dùng `student.viewProgress`, riêng danh sách đích gán dùng `version.assignCohort`.
- `studentReadWhere` giới hạn R1, R3 theo chương trình phụ trách và R6 theo `Student.userId`; không suy quyền đọc sinh viên từ vai trò R2/R4/R5. R1 và chính sinh viên có thể đọc kết quả khi chưa có quá trình học; R3 phải có quá trình học trong chương trình phụ trách bao phủ học kỳ được chọn. `program-options` kiểm học kỳ có ngày bắt đầu và dùng `staffStudentScope`: R1 thấy toàn bộ chương trình, R3 chỉ thấy chương trình trong phạm vi, không yêu cầu chương trình đã có sinh viên theo học.
- `POST /api/students/:studentId/enrollments` nhận `ASSIGN_EXCEPTION`, `TRANSFER`, `ADD_SECOND_MAJOR`; `POST /api/students/:studentId/reconcile-enrollments` đối soát thủ công. Cả hai yêu cầu R1 có grant `version.assignCohort` ở chế độ `DIRECT`, phạm vi `ALL` trong chính assignment R1; có khóa bản ghi, transaction và token `expectedStudentUpdatedAt` (thêm `expectedEnrollmentUpdatedAt` khi áp dụng).
- `StudentsSharedModule` xuất `StudentAppliedVersionReader`, `AcademicResultsReader`, `EnrollmentReconciler`, `StudentAccountProvisioner`. Bộ đọc phiên bản áp dụng dùng lịch gán khóa và chuỗi quá trình học; bộ đọc kết quả lấy toàn bộ bảng điểm đến học kỳ chọn, không chỉ các học phần trong chương trình hiện tại. `bestAcademicResults` chọn lần có `score4` cao nhất trong `PASSED`/`FAILED`, hòa thì học kỳ mới hơn, rồi `id` nhỏ hơn; giữ riêng cờ miễn học và đang học, không suy lại trạng thái từ điểm.
- `ImportsModule` mở rộng pipeline Excel sẵn có với `STUDENT_LIST` và `ACADEMIC_RESULT`, không nhận `versionId`. Quyền nhập bắt buộc R1 có `data.importExcel` với `DIRECT`/`ALL` trong assignment R1. Chạy thử không ghi nghiệp vụ; commit kiểm lại quyền, tệp, dữ liệu và kế hoạch trong transaction trước khi ghi toàn bộ. Kết quả nguồn có khóa `(studentId, courseId, semesterId)`, revision và lịch sử `AcademicResultChange`.
- Sinh viên mới được chuẩn bị tài khoản trước transaction để không giữ khóa trong lúc hash mật khẩu; commit chỉ dùng tài khoản còn cần sau khi kiểm lại. `StudentCredentialsService.store` chỉ tạo bản bàn giao cho tài khoản thực sự mới, trong cùng transaction với hồ sơ. `STUDENT_LIST` được kiểm khóa mã hóa tại cả upload và commit, kể cả tệp chỉ cập nhật hồ sơ; `ACADEMIC_RESULT` không có bước kiểm khóa này.
- Chủ phiên R1 dùng `GET /api/imports/:batchId/student-credentials` xem trạng thái và `POST /api/imports/:batchId/student-credentials/download` tải XLSX một lần. Chỉ nhận phiên `STUDENT_LIST` đã `COMMITTED`, đúng người thực hiện và còn quyền nhập; download dùng CSRF, `Cache-Control: no-store`, khóa hàng `FOR UPDATE`, giải mã rồi xóa payload trước khi trả tệp. Hết hạn sau 24 giờ; quét `imports-sweep` dọn payload hết hạn nhưng giữ số lượng và dấu thời gian.
- Queue `student-enrollment` chạy job `reconcile-enrollments` lúc khởi động và mỗi ngày 00:10 `Asia/Ho_Chi_Minh`; đối soát chuỗi không ngoại lệ theo lịch gán khóa. Trường hợp hồi tố cần xử lý riêng có mã `RETROACTIVE_COHORT_RECONCILIATION_REQUIRED`, không âm thầm ghi lại lịch sử.
- `ScopeSourceReader.OWN_ENROLLMENT` đã suy `studentIds` và `programIds` từ liên kết tài khoản, giữ cả chương trình trong lịch sử. Riêng `CourseUsageReader.hasStudyResults` vẫn trả `false`; không coi chặn sửa học phần theo kết quả học tập là đã được nối vào F-17.

### Frontend — `src/features/students/`, `src/features/imports/`

#### `StudentListPage`, `StudentDetailPage` — Hồ sơ sinh viên (`/students`, `/students/:studentId`)

- Route lazy-load bọc `RequireStudentStaff`; màn hình nhân viên không thay thế giao diện tự phục vụ R6. Danh sách có bộ lọc và phân trang; chi tiết giữ `semesterId`/`programId` trên URL, yêu cầu chọn học kỳ trước khi đọc hồ sơ.
- Chi tiết hiển thị thông tin sinh viên, cảnh báo quá trình học, lịch sử gán và kết quả nguồn. `EnrollmentCommandModal` và đối soát chỉ bật khi R1 có quyền và khả năng quản lý do backend trả; không bật thao tác cho `WITHDRAWN`/`GRADUATED`. Liên kết tài khoản chỉ hiển thị cho R1 có `user.manage`.
- Màn hình nhập Excel dùng chung hỗ trợ hai loại mới, mẫu tải về, chạy thử, xác nhận và lịch sử; `StudentCredentialDownload` hiển thị trạng thái bản bàn giao và tải bằng POST, không đưa mật khẩu ban đầu vào dữ liệu bảng báo cáo. Hook làm mới cache sinh viên sau commit.

## 18. Điều kiện đăng ký học phần (F-18)

- `RegistrationEligibilityModule` cung cấp GET `/api/students/:studentId/registration-eligibility?programId&semesterId` và GET `/api/programs/:programId/registration-eligibility/students?semesterId&q&page&pageSize`. Cả hai dùng `student.viewRegistrationEligibility`, cookie/session guards và `Cache-Control: no-store, private`.
- `RegistrationEligibilitySharedModule` xuất `RegistrationEligibilityReader.forAccess(access).evaluate(input, tx?)`. Reader ràng buộc F-17 resolution/results với purpose ELIGIBILITY, dùng đúng returned programVersionId trong cùng tx hoặc một RepeatableRead transaction. R1/R3 scope và own-R6 policy do F-17 thực thi; picker chỉ R1/R3, SQL intersection program/enrollment/semester, không thay F-17 program-options.
- Frozen CurriculumRequisite là nguồn quy tắc duy nhất, kể cả empty snapshot. Credits/name snapshot bắt buộc, zero được giữ; malformed facts trả lỗi conflict. PASSED/EXEMPT hoàn thành; FAILED đủ PRIOR nhưng không đủ prerequisite. Điểm so sánh exact Decimal; unscored EXEMPT không chứng minh positive threshold. Equivalent student-wide và one-hop ACTIVE replacement cho DISCONTINUED prerequisite không tạo co-registration substitution.
- Pure evaluator dùng iterative SCC, dependency-first condensed depth tối đa ELIGIBILITY_MAX_DEPTH (1..20, default 20). Completed node bỏ khỏi graph; CONDITIONAL có full transitive concurrent bundle; INELIGIBLE có own/transitive leaf blockers, viaCourse/causeCode và simple paths; không persist verdict hoặc cache server.
- MH-25 thêm context staff-only, scoped remote picker, table/board `Đăng ký được?`, shared EligibilityStatus/EligibilityReasons. Navigate tới applied version trước join itemId, kiểm exact item set và refetch một lần khi mismatch. Student mode không add/edit/requisites-edit/drag; syllabus links pin version. Không chọn sinh viên thì ordinary behavior và không có eligibility column.
- Client query keys đủ student/program/semester hoặc picker query; staleTime/gcTime=0, cancel trước remove khi đổi context, không previous-data placeholder. Server messages/score strings là display facts, không client evaluator. F-20 tự chọn authorized enrollment và sở hữu MH-58; F-21 phải có principal adapter độc lập, không giả R1. Chưa tuyên bố các consumer đó được build.

## 19. Xét tốt nghiệp (F-19)

### Backend — `src/features/graduation/`, `src/shared/graduation/`

Quyền `graduation.view` (xem) và `graduation.audit` (lưu lần xét, đợt xét, tác vụ xét lại). Mọi phản hồi chứa dữ liệu sinh viên gửi `Cache-Control: no-store, private`, như F-18.

| Method | Route | Quyền | Hành vi |
| --- | --- | --- | --- |
| GET | /api/students/:studentId/graduation | view | Xét trực tiếp theo program/semester, không ghi |
| POST | /api/students/:studentId/graduation-audits | audit | Lưu lần xét; `requestKey` idempotent, key dùng cho context khác bị từ chối |
| GET | /api/students/:studentId/graduation-audits | view | Lịch sử audit của context |
| GET | /api/graduation-audits/:auditId | view | Chi tiết audit đã lưu; schema lưu không hỗ trợ bị từ chối, không tính lại |
| GET | /api/graduation/program-options, /api/graduation/student-options | view hoặc audit | Picker trong phạm vi |
| GET | /api/students/:studentId/graduation-reaudit-tasks | audit | Tác vụ xét lại của context |
| POST | /api/graduation-reaudit-tasks/:taskId/retry | audit | Thử lại tác vụ FAILED, không xóa lịch sử |
| POST | /api/graduation-batches/preview | audit | Xem trước roster, không ghi |
| POST | /api/graduation-batches | audit | Xác nhận theo `previewRevision`; roster lệch trả 409, không tạo roster dở dang |
| GET | /api/graduation-batches, `/:id`, `/:id/items`, `/:id/export` | audit | Danh sách, tiến độ, item lọc phía server, xuất XLSX |

- Phạm vi: R1/R3 theo scope chương trình, R6 chỉ đọc của mình; vai khác bị chặn. Context độc lập theo `(studentId, programId, semesterId)`, gồm song ngành và khoảng nửa mở `[from, until)` của enrollment; không fallback chương trình hiện hành.
- Engine dùng `bestAcademicResults` của F-17 và khung đã ban hành của phiên bản áp dụng; tin trạng thái PASSED, không suy từ điểm. Kết quả gồm năm mã thiếu (bắt buộc, tự chọn theo tín chỉ/số học phần, tổng TC, điều kiện), warning và tín chỉ tự do; giá trị là decimal string, không làm tròn. Trường hợp không quyết định được (miễn học chưa xác nhận, bucket tương đương tranh chấp) trả diagnostic với result null, không phải NOT_ELIGIBLE. Quy tắc phân bổ/miễn học theo mặc định của plan (E2/E3), còn nợ Khoa C4.
- Audit append-only; head của context trỏ audit mới nhất, audit cũ không sửa/xóa qua API. Đợt xét đóng băng roster khi xác nhận và chạy nền theo chunk; item lỗi là ERROR, khác NOT_ELIGIBLE; requester được kiểm lại trước khi chạy nền.
- Thay đổi kết quả F-17 tạo receipt và task xét lại; audit mới mang trigger RESULT_CHANGE, reviewer null. Thông báo `GRADUATION_CONCLUSION_CHANGED` chỉ gửi R1 khi kết luận đổi, ghi cùng transaction với audit/head; task cũ hơn được đánh COVERED. Export đợt cũ giữ outcome đã đóng băng. Wiring queue: `general_architecture.md` §F-19.

### Frontend — `src/features/graduation/`

- Routes lazy-load bọc `RequireGraduationStaff` (R1/R3, kể cả tài khoản mixed): `/graduation` (MH-53), `/graduation/audits/:auditId`, `/graduation/batches` (MH-54), `/graduation/batches/:batchId`. Menu trong `shared/layout/menuItems.tsx`; MH-52 (`StudentDetailPage`) có entry chỉ điều hướng với context hiện tại, không lưu/đánh giá.
- MH-53 xem trực tiếp rồi lưu rõ ràng, hiển thị đúng kết quả POST trả về; retry giữ requestKey. Chi tiết audit chỉ đọc; R1 thấy panel tác vụ xét lại và retry, R3 chỉ thấy trạng thái freshness. MH-54 tách preview khỏi tạo, theo dõi tiến độ bền (mẫu số enrollmentCount), lọc phía server và xuất XLSX; export tắt khi batch chưa terminal hoặc FAILED. Lỗi xác nhận batch hiển thị qua state của trang, `onOk` không reject.
- Frontend chỉ trình bày credit/shortfall/conclusion của backend, không tính lại. View kết quả (`GraduationResultView`) giữ trong feature; tách sang shared để F-20 dùng còn hoãn.

## 20. Sao lưu và diễn tập phục hồi (F-26)

### Backend — `src/features/backups/`, `src/shared/backups/`

- `GET /api/operations/backups/status`, `GET /api/operations/backups`, `GET /api/operations/restore-drills`: chỉ đọc, `@ApiCookieAuth` + `@ApiOkResponse`, quyền `backup.view`. `BackupsService.computeStatus` là hàm thuần suy ra `DISABLED | READY | RUNNING | OVERDUE | FAILED` từ cấu hình, các lần chạy và giờ hiện tại (quá hạn sau 2 giờ kể từ giờ hẹn).
- `shared/backups/`: `backup-engine` (BE-04), `backup-retention` (BE-05, giữ 30 bộ hoàn tất, bộ lỗi không tính), `restore-drill` + `restore-verifier` (BE-06, bảy kiểm tra: `DUMP_HASH`, `DB_RESTORE`, `FILE_HASHES`, `DB_FILE_REFERENCES`, `RELEASED_CONTENT`, `LOCALE`, `MIGRATIONS`), `upgrade-verifier` (BE-07, chụp và so sánh trước/sau nâng cấp).
- Lỗi bền vững trên bản ghi là `{code, message}`; chỉ lỗi danh mục mới thành HTTP 503.
- Spec: `backups.service.spec.ts`, `backup-files.spec.ts`, `backup-retention.spec.ts`, `restore-verifier.spec.ts`, `scripts/backup-restore-drill.spec.ts`; e2e `test/backups.e2e-spec.ts` (9 ca). Engine và phục hồi thật cần PostgreSQL client 18 native nên chưa có e2e.

### Frontend — `src/features/backups/`

- `BackupsPage` (`/operations/backups`, menu "Quản trị → Sao lưu và phục hồi"): trạng thái, danh sách bộ sao lưu, biên bản diễn tập. Hooks TanStack Query tải ba route trên; không có hành động ghi.
