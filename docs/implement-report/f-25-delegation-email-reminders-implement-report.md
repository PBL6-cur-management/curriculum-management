# F-25 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

**2026-10-31: đã build xong và kiểm thử tự động.**

- Backend: ủy quyền duyệt (US-114), hàng đợi email một lần gửi (US-115) và nhắc hạn duyệt (US-116).
- Frontend: màn MH-14 "Ủy quyền duyệt"; công tắc email và nhãn trạng thái email ở trang Thông báo; nhãn "Duyệt thay …" trong hàng đợi; dòng "duyệt thay (ủy quyền)" trong lịch sử duyệt.

**Chưa có kiểm tra giao diện bằng mắt:** hệ thống đã dừng dev server vì thiếu bộ nhớ, và chúng chưa được bật lại.

## Bảng tổng hợp

| Hạng mục | Kết quả |
|---|---|
| Migration `20261031004022_delegation_email_reminders` | Chỉ thêm, không đổi dữ liệu cũ. CHECK: hai người khác nhau, khoảng ngày hợp lệ, `scopeLevel` ∈ {1,2}, `cycleIndex` ≥ 0, bằng chứng ủy quyền trên bước duyệt |
| Thẩm quyền ủy quyền | `delegation-authority.ts`: một định nghĩa "grant dùng được hôm nay" (ACTIVE, ngày nằm trong khoảng, cả hai tài khoản ACTIVE), dùng chung cho hàng đợi, quyết định, xem chi tiết và guard |
| Quyết định | `ApprovalRecorder.actionableRows` thêm các dòng của người ủy quyền; `recordRows` ghi theo từng grant với `delegationId` → `kind: DELEGATED` |
| Guard | `@AllowDelegate()` trên hàng đợi, chi tiết, diff, tài liệu, lịch sử, bình luận và approve/return/reject. Chỉ mở cửa khi người gọi có grant dùng được; service vẫn giới hạn ở đề xuất grant phủ |
| Email | Bảng outbox `NotificationEmailDelivery` ghi cùng transaction với thông báo. Pump BullMQ chạy mỗi 30 giây, mỗi dòng gửi tối đa một lần (PENDING → SENDING → SENT/FAILED/SKIPPED); dòng kẹt quá 10 phút thành UNKNOWN, không gửi lại |
| Nhắc hạn | Job hằng đêm (00:10 giờ VN, thêm một lần khi khởi động). Nhắc lần đầu khi chờ **quá** `REMINDER_MAX_DAYS` ngày, sau đó mỗi `REMINDER_REPEAT_DAYS` ngày. Sổ `ApprovalReminderDispatch` có khóa duy nhất nên không nhắc trùng. Từ chu kỳ thứ hai báo thêm R1 |
| Bảo trì grant | Cùng job: grant quá ngày cuối thành EXPIRED; grant có tài khoản bị vô hiệu hóa thành REVOKED |
| Test | BE unit 1680/1680 (thêm reminderCycle, subjectOf, derivedStatus và recorder); BE e2e `delegations` 5/5; approvals 14, notifications 4, final-approval 11, change-requests 18, permission-table 185 đều qua; FE vitest delegation 3, notifications, queue (thêm 1), change-requests; tsc/oxlint sạch ở phần mới |

## Quyết định trong lúc build (lệch so với plan)

1. **`scopeLevel Int?` thay vì khóa ngoại tới cấu hình cấp.** Null nghĩa là mọi cấp người ủy quyền đang giữ. Chỉ cho phép cấp 1 và 2.
2. **Cấp đang giữ lấy từ dữ liệu định tuyến, không lấy từ mã vai trò.** Người ủy quyền phải là điều phối nhóm (thành viên COORDINATOR còn hiệu lực) hoặc giám đốc chương trình (phân công còn hiệu lực), cùng nguồn mà routing planner dùng. Giữ vai trò R3/R4 mà không có phân công thì không ủy quyền được.
3. **Grant không độc quyền.** Người ủy quyền vẫn duyệt được. Người được ủy quyền nếu có cả dòng của mình lẫn dòng ủy quyền thì quyết định chung một lần; mỗi dòng ghi đúng `delegationId` của nó.
4. **Không ủy quyền cấp cuối (R1).** Đây là cổng E-2 bên dưới.
5. **Thu hồi khi vô hiệu hóa tài khoản được xử lý ở thời điểm đọc**, cộng với job đêm ghi trạng thái REVOKED. Không thêm hook vào luồng khóa tài khoản.
6. **Email và nhắc hạn mặc định TẮT** (`EMAIL_ENABLED=false`, `REMINDERS_ENABLED=false`). Môi trường dev dùng Mailpit (`pnpm mail:start`, compose profile `mail`, cổng loopback 1025/8025).
7. **Một delegate không có vai trò nào vẫn vào được hàng đợi và chi tiết qua `@AllowDelegate`.** Tuy vậy, mục menu "Chờ tôi duyệt" và route FE vẫn yêu cầu `changeRequest.view`. Trên thực tế người được ủy quyền là giảng viên R4/R5 nên đều có quyền này. Nếu Khoa cần ủy quyền cho người không có vai trò, phải sửa thêm FE.
8. **Không retry email.** Theo F25-02, gửi trùng tệ hơn gửi thiếu. Thông báo trong ứng dụng vẫn luôn có, và lỗi được hiển thị dưới dạng nhãn "Gửi email lỗi".

## Cổng còn mở (cần Khoa)

- **E-1 SMTP:** máy chủ SMTP thật, địa chỉ người gửi (`MAIL_FROM`) và chính sách gửi tới email cá nhân. Hiện chỉ có Mailpit.
- **E-2:** có cho phép ủy quyền cấp Phòng Đào tạo (phê duyệt cuối) không. Hiện tại là không.
- **Ngưỡng nhắc:** 7 ngày và lặp mỗi 3 ngày là giá trị mặc định, cần Khoa xác nhận.
