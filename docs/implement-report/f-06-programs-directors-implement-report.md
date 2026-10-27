# F-06 Thông tin chương trình, Giám đốc CTĐT — Implement Report

Kế hoạch: `docs/implementation/f-06-programs-directors-implementation-plan.md`. Tệp này ghi những gì **đã dựng**; kế hoạch ghi những gì định dựng.

## Status

| Mục | Trạng thái |
|---|---|
| Tiến độ | BE-01..BE-06, FE-01..FE-06, DOC-01 xong (2026-10-19) |
| Nhánh | `claude/keen-meitner-2y7yf1` |
| Cơ sở dữ liệu | Migration `20261019082727_programs` sinh bằng `prisma migrate dev --create-only --name programs` trên PostgreSQL 18 thật (ICU `vi-VN`, container Docker), nối tay hai chỉ mục duy nhất từng phần rồi `prisma migrate dev` áp; chạy lại báo "Already in sync". `\d "ProgramVersion"` cho `numeric(5,2)`, `ProgramVersion_one_draft`, `ProgramVersion_one_active` (`WHERE status = …`). Áp được lên cơ sở dữ liệu trống trong bộ kiểm thử đầu-cuối (6 migration). `prisma db seed` chạy hai lần: `Program` 1, `ProgramVersion` 1 |
| Hiệu lực lúc chạy | R1 thêm chương trình (kèm một bản Nháp), sửa thông tin Nháp, ngừng/dùng lại, nhân bản, phân công/kết thúc/thu hồi Giám đốc CTĐT; R3 (suy ra từ dòng phân công đang hiệu lực trong chương trình `ACTIVE`) sửa thông tin Nháp của đúng chương trình mình phụ trách; mọi vai trò nhân viên xem danh sách và tổng quan; sinh viên bị từ chối danh sách |
| Còn nợ | Đi thử 6 bước bằng trình duyệt (kế hoạch §7, chưa làm); chưa áp migration lên cơ sở dữ liệu phát triển của người dùng; thay giá trị giữ chỗ của chương trình 1024034 bằng số liệu từ tệp Excel khung của Khoa |

### Kết quả kiểm tra (2026-10-19)

| Dự án | Kiểu | Lint | Đơn vị | Đầu-cuối | Khác |
|---|---|---|---|---|---|
| backend | `tsc --noEmit` 0 lỗi | oxlint 0 | 269/269 (31 tệp) | 158/158 (11 tệp, Testcontainers) | Prettier sạch |
| frontend | `tsc -b` 0 lỗi | oxlint 0 | 119/119 (28 tệp) | — | `vite build` ổn; Prettier sạch |

So với F-05: backend đơn vị +46, đầu-cuối +28 (17 ca của `programs.e2e-spec.ts` và 11 dòng bảng kiểm tuyến); frontend đơn vị +26.

---

## Summary

| ID | Phạm vi | Kiểm bằng | Ghi chú |
|---|---|---|---|
| BE-01 | `prisma/schema.prisma`, migration `20261019082727_programs` | tsc, đầu-cuối (áp migration), `\d`, hai ca chạm thẳng chỉ mục từng phần (`P_INDEX`) | Không lệch. Không thêm chỉ mục `Program.clonedFromId` (kế hoạch không có) |
| BE-02 | `shared/programs/{active-director,program-target,version-content.copier,programs-shared.module}.ts`, `ScopeSourceReader` | đơn vị (`scope-source.reader.spec`: ca `PROGRAM_DIRECTOR` thật thay ca "để trống") | Không lệch |
| BE-03 | `features/programs/program-directors.service.ts`, `program-director.dto.ts`, `assign-director.dto.ts` | đơn vị (13 ca), đầu-cuối | Xem Lệch 3 |
| BE-04 | `features/programs/{programs.module,controller,service,errors}`, `program.dto.ts`, `create-/update-/program-query.dto.ts`, `credits-check.ts` | đơn vị (`programs.service.spec` 29 ca gồm 6 ca nhân bản, `credits-check.spec` 4 ca), đầu-cuối | Xem Lệch 2, 3, 4, 5 |
| BE-05 | `clone-program.dto.ts`, `ProgramsService.clone` | đơn vị (6 ca), đầu-cuối (nhân bản, sửa bản sao, nguồn không đổi) | Không lệch |
| BE-06 | `prisma/seed-data/programs.ts`, `seed.ts`, `test/fixtures/programs.ts`, `test/programs.e2e-spec.ts`, `test/permission-table.ts` (+11 dòng), `test/permission-table.e2e-spec.ts` (đếm ghi) | `pnpm test:e2e` 158/158 | Xem Lệch 1, 6, 7 |
| FE-01 | `schema.d.ts` (sinh lại), `permissions.ts`, `routes.ts`, `router.tsx`, `menuItems.tsx`, `AppLayout.tsx` | tsc, `vite build`, `menuItems.test.tsx` (+1 ca) | Xem Lệch 8 |
| FE-02 | `features/programs/{api,hooks,constants}`, `shared/constants/editPath.ts`, `shared/forms/credits.ts` | tsc | Xem Lệch 9 |
| FE-03 | `ProgramListPage`, `ProgramStatusTag` | đơn vị (6 ca) | Xem Lệch 10 |
| FE-04 | `ProgramOverviewPage` và các thành phần `ProgramInfoCard`, `ProgramDirectorsSection`, `AssignDirectorModal`, `EndDirectorModal`, `ProgramStatusActions`, `ProgramSectionLinks`, `ProgramEditButton` | đơn vị (7 ca) | Xem Lệch 10 |
| FE-05 | `ProgramFormPage`, `CreditsGapHint`, `schema/programRules.ts` | đơn vị (8 ca) | Không lệch |
| FE-06 | `CloneProgramButton`, `CloneProgramModal` | đơn vị (4 ca) | Không lệch |
| DOC-01 | `docs/architecture/*`, `docs/progress/*`, `docs/implementation/README.md`, trạng thái kế hoạch, tệp này | đối chiếu đường dẫn với mã | `data-dictionary.md` đã mang `ProgramDirectorAssignment`, `Program`, `ProgramVersion` từ lúc viết kế hoạch nên không đổi thêm; `technical_reference.md` không đổi (không thêm thư viện) |

### Cách điền các móc đã để lại

- **`ScopeSourceReader` cho `PROGRAM_DIRECTOR`** (F-02): trả `{ programIds }` từ `ProgramDirectorAssignment` của người dùng với `activeDirectorWhere(today)` (chưa thu hồi, trong khoảng ngày, chương trình `ACTIVE`), `distinct: ['programId']`. Phạm vi tính lại mỗi yêu cầu nên hết hạn phân công mất quyền ngay (US-021 AC2), và R3 hiện trong `/api/auth/me` với `derived: true`.
- **`resolveEditPath`/`assertDirectEdit`** (F-04): `programEditState` coi "đã ban hành" là có phiên bản khác `DRAFT`, `draftOpenToRequestHolders: true`; trước F-15 không phiên bản nào rời Nháp nên mọi sửa thông tin đều trực tiếp. Không có Nháp mà vẫn qua được `assertDirectEdit` là trường hợp không xảy ra khi chỉ mục "một Nháp" còn; service vẫn trả 409 `CHANGE_REQUEST_REQUIRED` cho chắc.
- **`assertSchoolWideDirect`** (F-05) dùng cho thêm chương trình và ngừng/dùng lại: ô `program.editInfo` của R3 là `P` (trực tiếp, theo phạm vi) nên R3 bị 403 `PERMISSION_DENIED`.
- **`useCanEditSchoolWide`** (F-05) dùng cho nút "Thêm chương trình"; vì `me` chưa có chế độ và phạm vi nên nút cũng hiện với R3 (xem Lệch 10).
- **`VersionContentCopier`** là chỗ cắm cho tính năng sau; rỗng (các dòng `void` giữ oxlint yên lặng đến khi bước đầu tiên được thêm).

Ràng buộc các kế hoạch trước đặt lên F-06 đều đã thực hiện: bộ đọc phạm vi R3, dùng lại `edit-path`/`assertSchoolWideDirect`/`validity`/`today`/`ref.dto`/`transforms`/`applyFieldErrors`/`useDebouncedValue`/`UserSelect`/`useCan`, hàng bảng kiểm tuyến cho R3 trong và ngoài phạm vi (e2e), seed chương trình 1024034.

---

## Lệch kế hoạch

1. **Seed ở `prisma/seed-data/programs.ts`, không phải `prisma/seed/programs.ts`.** Theo bố cục đang có (`prisma/seed-data/`). Hàm `seedPrograms(prisma)` được `seed.ts` gọi sau `seedAccessControl` và được ca đầu-cuối chạy hai lần. **Kế hoạch F-07 (BE) nhắc `prisma/seed/program-1024034.ts`** — F-07 nên sửa `seed-data/programs.ts`. Tên chương trình, mã ngành, 10 học kỳ và 150 = 140 + 10 tín chỉ là **giá trị giữ chỗ** vì chưa có tệp Excel khung của Khoa (Q-11); đã ghi chú trong tệp.
2. **Mã quyền và ô bảng quyền không đổi.** `program.view`, `program.editInfo`, `program.clone`, `director.assign` và các ô R1..R6 (`program.view` R6 `P`, `program.editInfo` R3 `P`) đã có trong `permission-catalog.ts` từ F-02 (`permission-catalog.spec.ts` giữ nguyên). Việc "mã quyền và hàng bảng quyền" của F-06 chỉ gồm 11 dòng mới ở `test/permission-table.ts`.
3. **Người gọi lấy từ `@CurrentAccess()`**, không dùng `@CurrentUser()`: `AccessContext.userId` là người gọi, đỡ thêm một tham số (`AuthenticatedUser`). `listDirectors` chuyển phần kiểm xem vào `ProgramDirectorsService.list(programId, access)` như ghi chú của kế hoạch, không dùng `.then` ở controller.
4. **Thêm `ORG_UNIT_REF_SELECT` và `USER_REF_SELECT`** vào `shared/dtos/ref.dto.ts` (kế hoạch dùng chúng nhưng chưa có), cho `program.dto.ts` và `program-director.dto.ts`.
5. **`programs.service.ts` dài 329 dòng**, quá ngưỡng ~250 của `nestjs-rules.md` §2: dạng mã của kế hoạch (danh sách, tạo, sửa, trạng thái, nhân bản) đã vượt. Không tách thêm vì các phần chia sẻ `findOrThrow`/`toDetail`; `ProgramDirectorsService` đã tách riêng như D1. Nên tách nhân bản khi F-07 thêm kiểm tra `semesterCount`.
6. **Ca đầu-cuối US-018 AC3 (R6)**: tài khoản R6 gán tay bằng Prisma với phạm vi `UNIT` ở Phòng Đào tạo. Gán R6 với phạm vi `SYSTEM` (như `createAccount(app, name, 'R6')` mặc định) làm `assignment.scope = { all: true }` nên ô `P` thành toàn trường và không bị từ chối; phạm vi `UNIT` ở đơn vị khác với khoa của chương trình mô phỏng đúng "phạm vi không phải toàn trường". Phạm vi theo đơn vị **của khoa chương trình** sẽ cho xem chi tiết (D2) — cố ý.
7. **Ca đầu-cuối US-021 AC3 đổi cách chứng minh.** Kế hoạch: "R3 và R5 độc lập — sửa học phần trong nhóm G được, PATCH chương trình B vẫn 403". Giữ nguyên hai vế đó, **bỏ vế "học phần ngoài nhóm bị 403"**: ô `course.edit` của R3 là `D` (toàn trường, qua đề xuất) mà F-04 cho sửa thẳng học phần Khoa CNTT chưa ban hành, nên người vừa là Giám đốc CTĐT vừa thành viên nhóm sửa được cả học phần ngoài nhóm — đúng hành vi F-04, không phải lỗi F-06.
8. **Menu ẩn cho sinh viên bằng `hideForRoles`.** `AppMenuItem` thêm `hideForRoles?` và `toMenuItems(items, permissions, roleCodes = [])`; mục "Chương trình đào tạo" ẩn khi **mọi** vai trò người gọi nằm trong danh sách (`R6`). Người có vai trò khác kèm R6 vẫn thấy. Đây là phương án dự phòng của kế hoạch, nhưng đọc `me.roles` trực tiếp trong `AppLayout`, không qua hook `useIsStudent`. Chỉ để hiển thị; máy chủ vẫn từ chối danh sách.
9. **Hằng dùng chung dời sang `shared/`** để không import chéo tính năng: `CHANGE_REQUEST_PENDING_TOOLTIP` sang `src/shared/constants/editPath.ts` (gọi ở `CourseEditButton`, `CourseRelationsSection`, `ProgramEditButton`); `CREDITS_PATTERN`/`CREDITS_MESSAGE` sang `src/shared/forms/credits.ts` (`courseRules.ts` import và xuất lại để kiểm thử cũ không đổi đường dẫn). Kế hoạch cho phép "sao" mẫu tín chỉ từ `courseRules.ts`; dời tốt hơn một bản sao thứ hai.
10. **Không có `PageContainer`, `ApiErrorAlert`, `ValidityStateTag`** (đã ghi từ F-04/F-05): dùng `Flex`, `Result`, `Skeleton`, `Tag` và `formatPeriod`/nhãn của `shared/validity/validity.ts` như `SubjectGroupDetailPage`. `ProgramSectionLinks` là thẻ vô hiệu có chú thích, không phải liên kết, đến khi F-07, F-08 thêm tuyến. Nút "Thêm chương trình" cũng hiện với R3 vì `me` thiếu chế độ/phạm vi (như Lệch 10 của F-05); máy chủ trả 403.
11. **`CreateProgramDto` trim mã bằng `trimString`** (không viết hoa), đúng kế hoạch; mã chương trình là số nên không cần hoa. Màn hình cũng cắt khoảng trắng mã trước khi gửi.

Không có lệch về hợp đồng API, tên lỗi, DTO hay thứ tự tuyến.

## Còn nợ

- Đi thử 6 bước bằng trình duyệt (§7) chưa làm; ghi ở `docs/progress/todo.md`.
- Áp migration `20261019082727_programs` lên cơ sở dữ liệu phát triển: `pnpm prisma:migrate` trong `source/backend`, rồi `pnpm prisma:seed` để có chương trình 1024034.
- Thay giá trị giữ chỗ của 1024034 bằng số liệu thật từ tệp Excel khung của Khoa (Q-11).
- Ràng buộc cho tính năng sau (đã nằm ở kế hoạch §8): F-07 thêm bước vào `VersionContentCopier.copy` (khung, nhóm tự chọn, điều kiện — ánh xạ lại id), kiểm `semesterCount` thấp hơn học kỳ đã xếp trong `ProgramsService.update` (EC-08) và bật ba thẻ ở tổng quan; F-11 thêm PLO/ma trận vào phép sao; F-13/F-15 dùng `VersionContentCopier`, F-15 thêm cột ban hành vào `ProgramVersion`; F-14 dùng `activeDirectorWhere` để tìm người duyệt cấp 2 và bỏ qua tài khoản bị vô hiệu; F-17 trả `programIds` trong bộ đọc `OWN_ENROLLMENT` và lọc sinh viên khỏi ô chọn Giám đốc.
- `/api/auth/me` chưa có chế độ và phạm vi (xem F-05 Lệch 10): nút "Thêm chương trình" hiện với R3.

---

## Incidents

### 1. Lệnh `pnpm test:e2e -- <tệp>` chạy mọi tệp
- **Triệu chứng**: muốn chạy riêng `programs.e2e-spec.ts` nhưng vitest chạy cả 11 tệp (≈ 90 giây).
- **Cơ chế**: đối số sau `--` không còn được vitest dùng làm bộ lọc tên tệp khi `pnpm test:e2e` đã gắn sẵn `--config`.
- **Sửa**: chạy trực tiếp `pnpm exec vitest run --config ./vitest.config.e2e.ts test/programs.e2e-spec.ts`. Không đổi mã.

### 2. Hai ca đầu-cuối đoán sai về phạm vi
- **Triệu chứng**: ca R6 xem chi tiết và ca "học phần ngoài nhóm" trả 200 thay vì 403.
- **Cơ chế**: xem Lệch 6, 7 — R6 theo đơn vị của khoa chương trình được phủ (D2), và `course.edit` ô `D` của R3 phủ học phần Khoa CNTT.
- **Sửa**: kiểm thử — đổi dữ liệu ca (đơn vị khác) và bỏ vế sai; điều kiện kiểm còn lại không đổi.

### 3. Cảnh báo lint `no-misused-spread`
- **Triệu chứng**: oxlint cảnh báo trải (`...`) thể hiện lớp ở `program.dto.ts`.
- **Cơ chế**: `toVersionRef` và `toProgramSummaryDto` trả kiểu lớp DTO.
- **Sửa**: mã — liệt kê trường của phiên bản và dùng `Object.assign` như `CoursesService.toDetail`.

---

## Lessons worth keeping

- Gán tay vai trò suy ra (R6) bằng phạm vi `SYSTEM` làm ô theo phạm vi thành toàn trường; kiểm thử "bị từ chối vì phạm vi" phải gán phạm vi `UNIT` ở đơn vị không liên quan.
- Phạm vi theo đơn vị của một gán tay phủ cả chương trình thuộc khoa đó, nhờ `programTarget` mang cả `orgUnitIds` (D2).
- `ProgramVersion` có hai chỉ mục duy nhất từng phần viết tay; mọi migration sau phải giữ chúng, và kiểm thử đầu-cuối chạm thẳng chúng để lỡ ai "dọn" thì hỏng.
- Một tệp hằng chỉ một tính năng dùng rồi tính năng thứ hai cần thì dời lên `shared/` ngay (tooltip đề xuất, mẫu tín chỉ) thay vì import chéo hoặc sao chép.
- Kiểm thử trang có `Select` của AntD: dùng `findByTitle` để chọn mục trong danh sách thả khi cùng chữ đã có trong bảng.

## Quyết định bổ sung — US-021 AC3

- **Ngày**: 2026-10-25. **Người quyết định**: người dùng.
- Chốt cách chứng minh tại **Lệch 7** (dòng 64): **sửa tiêu chí chấp nhận, không đổi ma trận quyền**. Người vừa là R3 của chương trình A vừa là R5 của nhóm G sửa học phần trong G được, nhưng PATCH chương trình B không được phân công vẫn trả 403; đây là hai vế chứng minh phạm vi chương trình và phạm vi nhóm độc lập.
- Bỏ vế “học phần ngoài nhóm → 403” khỏi tiêu chí: `course.edit` của R3 là `D` toàn trường (`source/backend/prisma/seed-data/permission-catalog.ts:117`), F-04 cho sửa trực tiếp học phần của Khoa chưa ban hành (`source/backend/src/shared/courses/course-edit-state.ts:10`, `source/backend/src/shared/authz/edit-path.ts:79`). Vì vậy R3 kiêm R5 sửa học phần ngoài G trong trường hợp đó là đúng hành vi, không phải lỗi cần thu hẹp quyền.
- Đã bổ sung điều khoản làm rõ US-021 AC3 và cập nhật ghi chú F06-TC_014. Dòng US-021 AC3 trong kế hoạch F-06 đã đúng hai vế nên giữ nguyên. Không thay đổi mã nguồn, ma trận quyền hoặc kết quả kiểm thử đã ghi.
