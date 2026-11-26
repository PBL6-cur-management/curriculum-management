# F-13 Đề xuất thay đổi — Implement Report

Kế hoạch: `docs/implementation/f-13-change-requests-implementation-plan.md`. Tệp này ghi những gì **đã dựng**. F-14 (phê duyệt, thông báo) và F-15 (ban hành) chưa dựng.

## Status

| Mục | Trạng thái |
|---|---|
| Tiến độ | BE-xx, FE-xx xong (2026-10-19) |
| Migration | `20261019110535_change_requests` (`--create-only`, nối tay `CHECK`, dãy `change_request_code_seq`, chỉ mục Nháp chỉ tính bản không thuộc đề xuất); đã áp lên `ctdt-dev-pg`, `migrate dev` báo "in sync" |
| Còn nợ | Đi thử bằng trình duyệt (USER ACTIONS) |

| Dự án | tsc | Lint | Đơn vị | Đầu-cuối |
|---|---|---|---|---|
| backend | 0 lỗi | oxlint 0 | 638/638 | 304/304 |
| frontend | 0 lỗi | oxlint 0 | 344/344 | — |

Prettier và build sạch ở cả hai.

## Sửa bộ chọn đối tượng (2026-11-26)

- Form tạo đề xuất lấy mã và tên theo đúng loại và ID đang chọn. Nhãn cho đối tượng điền sẵn ngoài trang đầu được cập nhật khi truy vấn chi tiết hoàn tất. Khi đổi loại đề xuất hoặc loại đối tượng rồi quay lại, form khôi phục ID và hiện nhãn của đúng đối tượng đó.
- Bộ chọn học phần và chương trình tải tiếp kết quả qua API danh mục khi cuộn đến cuối hoặc bấm **Tải thêm lựa chọn**. Từ khóa mới bắt đầu lại ở trang đầu. Form dùng ID đối tượng để lưu đề xuất.
- Khi sửa thông tin bản nháp, ô đối tượng chỉ đọc hiển thị mã và tên. Có ca hồi quy cho nhãn đến sau, chọn ngoài trang đầu, giữ đúng lựa chọn khi đổi loại và hiển thị đối tượng của bản nháp.

## Lệch kế hoạch

1. Vai trò dùng `ROLE_CODES` R1..R6 (kế hoạch ghi tên như `SUBJECT_GROUP_COORDINATOR`); fixture ở `test/fixtures/change-requests.ts` (không phải `test/helpers/`).
2. `assertEditPath` dùng `assertCan` nên lỗi là `OUT_OF_SCOPE` / `PERMISSION_DENIED`, không có mã riêng.
3. `ProgramsService.update` giữ nguyên; tuyến `GET/PATCH /program-versions/:id/info` có service riêng nên kiểm tra tín chỉ và học kỳ lặp lại một lần.
4. Tên ba cấp lấy từ hằng số, không đọc bảng `ApprovalLevelConfig`.
5. `useListQuery` là truy vấn `useState` đơn giản; không dùng `Map.groupBy` (dùng `groupBy` chung).
6. `CourseSelect` và `UserSelect` thêm prop `onPick(value, label)`; `ElectiveGroupsPage` có `CreateRequestButton`.
7. F-10 không có tuyến "xóa Nháp" nên không thêm bảo vệ; ô "Tên tiếng Anh" trong trình soạn học phần chưa xóa trắng được.
8. Làm sẵn từ F-15 §2c: cột `ChangeRequest.createdByAcademicOffice` ghi lúc tạo (`isAcademicOfficeHolder`), `ChangeRequestsSharedModule` xuất `StaleChecker`, `released-base.ts`, `copySyllabusRevision`.

## Test của tính năng trước đã đổi (hành vi CHANGE_REQUEST_REQUIRED)

- Frontend: `CourseDetailPage.test`, `CurriculumPage.test`, `ProgramOverviewPage.test`, `SyllabusPage.test` (nút "Tạo đề xuất" thành liên kết, stub `auth/me` có `permissions`), thêm ca `UserSelect`.
- Backend: `course-usage.reader.spec` (where có `sourceRequestId: null`), các fixture thêm `sourceRequest: null`; `permission-table` thêm dòng cho tuyến mới.

## Possible enhancements

- Kiểm tra lại mục tác giả (quan hệ, tổ chức) bằng feature sở hữu khi áp dụng (ràng buộc cho F-14/F-15).
- Bộ lọc hàng chờ cho MH-38; riêng tư nháp theo người đọc (D18); giới hạn bản sao theo loại.
- Nhập Excel vào bản sao (F-09).

## USER ACTIONS

- Áp migration: `pnpm prisma:migrate` rồi `pnpm prisma:seed` trong `source/backend`.
- Đi thử NT-B4-01/03/09 với R1–R5: tạo đề xuất từng loại, sửa bản nháp làm việc (khung, đề cương, PLO, thông tin), xem so sánh, gửi duyệt (thấy các cấp bị bỏ qua), rút, thử chồng đề xuất (cảnh báo BR-30).
- Xác nhận các mặc định của kế hoạch cho câu hỏi mở.

## Hooks cho tính năng sau

- F-14: các dòng `ApprovalStep` theo `submissionRound` do `RoutingPlanner` tạo (`isSkipped` lưu `APPROVE`; cấp 3 `approverId` null); `PENDING_STATUS_BY_LEVEL`; thay `returnForTest` bằng Trả lại thật; đếm lọc `isSkipped:false`; `visibleWhere`; thêm bảng duyệt vào `ChangeRequestDetailPage`, dùng lại `StepProgress`, `DiffView`; `WorkingCopyService.discard` khi từ chối / rút.
- F-15: `StaleChecker`, `newestReleasedVersion`, nâng bản sao (`sourceRequestId` → `originRequestId`), payload mục tác giả trong `ChangeItem.newValue`, `createdByAcademicOffice`, `ConsistencyChecker` khi ban hành.
