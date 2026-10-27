# F-14 Duyệt ba cấp và thông báo — Implement Report

Kế hoạch: `docs/implementation/f-14-three-level-approval-notifications-implementation-plan.md`. Tệp này ghi những gì **đã dựng**. F-15 (phê duyệt cuối đề xuất dữ liệu, ban hành) chưa dựng.

## Status

| Mục | Trạng thái |
|---|---|
| Tiến độ | BE-01..BE-09, FE-01..FE-07 xong (2026-10-19); DOC-01 theo yêu cầu chỉ làm báo cáo, nhật ký, todo, current_work |
| Migration | `20261019122753_approval_comments_notifications` (`--create-only`; hai enum, hai bảng, cột `levelEnteredAt`, bốn chỉ mục); **đã áp** lên `ctdt-dev-pg`, `migrate dev` lần hai báo "in sync"; không cần seed mới |
| Còn nợ | Đi thử bằng trình duyệt (USER ACTIONS) |

| Dự án | tsc | Lint | Đơn vị | Đầu-cuối |
|---|---|---|---|---|
| backend | 0 lỗi | oxlint 0 | 707/707 | 330/330 |
| frontend | 0 lỗi | oxlint 0 | 376/376 | — |

Prettier và build sạch ở cả hai.

## Đã dựng

- Backend: `Comment`, `Notification`, `ChangeRequest.levelEnteredAt`; `@PassiveRequest()` và đồng hồ `lastActivityAt` trong `AuthenticatedGuard`; `membership.writer` / `director.writer` dùng chung (F-03, F-06 gọi lại, mã lỗi giữ nguyên); `ApprovalRecorder`, `RequestNotifier`, `NotificationService`, `approval-rules` ở `shared/`; `ApprovalService` (Đồng ý, Trả lại, Từ chối, Duyệt thay), `OrganizationalApplier`, bình luận, lịch sử, hàng chờ `GET /approval-queue`, bộ lọc `minDaysWaiting`, feature `notifications`.
- Frontend: `ApprovalPanel` + `RemarkModal` + `OverrideModal`, `ApprovalHistory`, `CommentsCard`, `StepLine` dùng lại cho cả lịch sử, MH-42 `ApprovalQueuePage`, chuông + MH-04, cột và bộ lọc "Số ngày chờ" ở MH-38, menu "Chờ tôi duyệt" và "Thông báo".

## Lệch kế hoạch

1. Tên cấp lấy từ hằng số `APPROVAL_LEVEL_NAMES`, không đọc `ApprovalLevelConfig` (theo F-13).
2. Từ chối và Rút **xóa bản làm việc** (`WorkingCopyService.discard`, cùng giao dịch); kế hoạch §8 để F-15 quyết. Rút đề xuất nay chạy trong `$transaction` và đặt `levelEnteredAt = null`.
3. `academic-office.ts` đã có từ F-13 (dựa trên `RoleAssignment`); chỉ thêm `academicOfficeHolderIds`, `RoutingPlanner` không đổi. `REQUEST_CORE_SELECT` thêm `requestCode`, `title` cho thông báo. Hàm `findVisibleRequest` dùng lại nguyên.
4. `STEP_INCLUDE` / `toStepDto` ở `change-request.mapper.ts` (không tách `approval-step.mapper.ts`); `endDirector` bỏ tham số `actorId` không dùng.
5. Bộ lọc `minDaysWaiting = N` lấy "N ngày trở lên" theo ngày lịch giờ Việt Nam (`waitingBefore`), không so với nửa đêm UTC như kế hoạch.
6. Thêm chỉ mục `Notification(changeRequestId)` cho khóa ngoại.
7. Kiểm thử hết hạn phiên không ngủ 70 giây: lùi `lastActivityAt` trong bảng `session` (nhanh, xác định).
8. Menu phẳng "Chờ tôi duyệt" cho người có `changeRequest.view` (R2, R5 thấy hàng chờ trống); không có `useListQuery`, `PageContainer`, `ApiErrorResult` nên dùng `useState`, `Flex`, `Result`. `Space.Addon` thay `addonBefore` ở bộ lọc.
9. Đề xuất dữ liệu ở cấp 3 trả `FINAL_APPROVAL_REQUIRED` (kế hoạch D5), kể cả `COURSE_RELATION`.

## Test của tính năng trước đã đổi

- `test/change-requests.e2e-spec.ts`: `returnForTest` và `approveFirstRowForTest` thay bằng Trả lại / Đồng ý thật; ca "rút đề xuất" nay kiểm tra bản làm việc đã bị xóa (PATCH trả 404), không còn `REQUEST_NOT_DRAFT`.
- `test/users.e2e-spec.ts`: bốn tuyến `/api/notifications*` vào danh sách tuyến "chỉ cần đăng nhập".
- `subject-group-members.service.spec.ts`: `$transaction` kiểu tương tác. `submission.service.spec.ts`: thêm notifier, copies, `levelEnteredAt`. `authenticated.guard.spec.ts`: thêm `ConfigService`. `testFixtures.ts`, `ChangeRequestDetailPage.test.tsx`: quyền mới.
- `test/permission-table.ts`: tám dòng mới (hàng chờ, Đồng ý, Trả lại, Từ chối, Duyệt thay, lịch sử, hai tuyến bình luận).

## Possible enhancements

- Giới hạn số thông báo lưu giữ / xóa thông báo cũ; email (F-25); nhắc hạn (FR-66); ủy quyền duyệt (B6).
- Nhóm hóa thông báo cùng một đề xuất; phân trang hàng chờ nếu vượt vài chục dòng.

## USER ACTIONS

- Không cần áp migration (đã áp lên `ctdt-dev-pg`); môi trường khác chạy `pnpm prisma:migrate`.
- Đi thử NT-B4-04: R5 gửi → R4 đồng ý → R3 đồng ý → R1 Trả lại ở cấp 3 → gửi lại, lần 2 ở lịch sử; thử Duyệt thay, bình luận, chuông (đếm giảm khi mở), MH-42, đề xuất tổ chức do R1 duyệt, và để tab mở 61 phút.
- Xác nhận các mặc định của kế hoạch cho câu hỏi mở và lệch số 2 (xóa bản làm việc khi Từ chối / Rút).

## Hooks cho F-15

- Ghi dòng cấp 3 bằng `ApprovalRecorder` (`claim`, `actionableRows`, `record`, `close`); chạy lại `StaleChecker`; áp mục tác giả trước khi ghi duyệt như `OrganizationalApplier`; `canFinalApprove` thêm vào `RequestActionsDto` (`canApprove` đang false cho đề xuất dữ liệu ở cấp 3).
- `RequestNotifier`: thêm `effective` và `REQUEST_EFFECTIVE` (§2c của F-15); không tự tính người nhận. `levelEnteredAt` xóa qua `close`.
- Mọi đường đưa đề xuất vào hoặc ra `PENDING_*` phải qua recorder hoặc `submit` / `withdraw` của F-13 để `levelEnteredAt` không lệch.
- Bản làm việc của đề xuất bị Từ chối / Rút đã bị xóa; mục đã lưu ở `ChangeItem` vẫn đọc được.

## Quyết định bổ sung — bản làm việc khi Từ chối/Thu hồi

- **Ngày**: 2026-10-25. **Người quyết định**: người dùng.
- Chốt lệch số 2: giữ hành vi hiện tại, **xóa bản làm việc** khi đề xuất chuyển sang `REJECTED` hoặc `WITHDRAWN`; không giữ bản sao chỉ đọc. `WorkingCopyService.discard` chạy cùng giao dịch đóng đề xuất (`source/backend/src/features/change-requests/approval.service.ts:228`, `source/backend/src/features/change-requests/submission.service.ts:235`).
- Diff từng thay đổi vẫn lưu trong `ChangeItem`; `RequestItemsService.current` đọc các mục đã lưu cho đề xuất không còn Nháp (`source/backend/src/features/change-requests/request-items.service.ts:45`). Vì vậy vẫn xem được nội dung bị từ chối; giữ bản làm việc đã đóng chỉ thêm việc dọn dẹp mà không có nơi đọc.
- F-15 đã dựng mà không triển khai D14 cũ về giữ bản sao chỉ đọc. Đã sửa tại chỗ D14 và gotcha của kế hoạch F-15, cùng dòng phạm vi kế hoạch F-14 để phản ánh quyết định; phương án giữ bản sao chỉ đọc vẫn nằm trong cột phương án bị loại của D14. Không thay đổi mã nguồn.
