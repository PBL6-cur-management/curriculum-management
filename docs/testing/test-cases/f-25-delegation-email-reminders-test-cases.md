# F-25 — Test cases: ủy quyền duyệt, email, nhắc hạn

| ID | US / MH | Tình huống | Kỳ vọng | Tự động |
|---|---|---|---|---|
| TC-F25-01 | US-114 AC1 / MH-14 | Điều phối nhóm ủy quyền cho đồng nghiệp từ hôm nay | Grant ACTIVE, `isEffectiveNow`; người nhận có thông báo DELEGATION_RECEIVED với liên kết `/approval-delegations` | BE e2e |
| TC-F25-02 | US-114 AC2 | Người được ủy quyền mở hàng đợi và duyệt | Dòng có `delegatedFor` = người ủy quyền; bước cấp 1 `kind: DELEGATED`, ghi người duyệt gốc, người thực hiện và grant | BE e2e, FE vitest |
| TC-F25-03 | US-114 AC5 | Tự ủy quyền cho mình / khoảng ngày trong quá khứ / ngày cuối trước ngày đầu | 400 DELEGATION_SELF / DELEGATION_PAST_RANGE / DELEGATION_INVALID_RANGE | BE e2e |
| TC-F25-04 | US-114 AC1 | R4 ủy quyền thay người khác | 403 DELEGATION_OUT_OF_SCOPE; chỉ R1 thấy ô "Người ủy quyền" | BE e2e, FE vitest |
| TC-F25-05 | US-114 AC5 | Người được ủy quyền là người tạo đề xuất | Đề xuất không có trong hàng đợi; approve → 403 SELF_APPROVAL | BE e2e |
| TC-F25-06 | US-114 AC3 | Thu hồi grant | REVOKED, `canRevoke=false`; lời gọi kế tiếp của người được ủy quyền bị 403 | BE e2e, FE vitest |
| TC-F25-07 | US-114 AC4 | Grant quá ngày cuối | Mất quyền ngay khi đọc; job đêm ghi EXPIRED; bước đã quyết trước đó giữ nguyên bằng chứng | BE e2e, BE unit |
| TC-F25-08 | US-115 AC1 | Sự kiện quan trọng khi bật email | Dòng giao PENDING → SENT; tiêu đề bắt đầu "[CTĐT]"; nhãn "Đã gửi email" | BE e2e, FE vitest |
| TC-F25-09 | US-115 AC2 | SMTP từ chối | FAILED với mã lỗi ngắn; lần pump sau không gửi lại | BE e2e |
| TC-F25-10 | US-115 AC3 | Người dùng tắt "Nhận email" | PATCH preferences; thông báo sau đó là SKIPPED, vẫn có trong ứng dụng | BE e2e, FE vitest |
| TC-F25-11 | US-115 | Tiến trình chết khi đang gửi | Sau 10 phút SENDING → UNKNOWN, không gửi lại | Code review (`markStale`) |
| TC-F25-12 | US-116 AC1 | Đề xuất chờ đúng 7 ngày, rồi 8 ngày | 7 ngày: chưa nhắc; 8 ngày: một nhắc cho điều phối; chạy lại không nhắc trùng | BE e2e, BE unit |
| TC-F25-13 | US-116 AC2 | Chờ 11 ngày | Nhắc lần hai cho điều phối và báo R1; người tạo không bao giờ nhận | BE e2e |
| TC-F25-14 | US-116 AC3 | Đề xuất đã qua cấp | Không nhắc cấp cũ nữa; nếu cấp mới quá hạn thì nhắc cấp mới | BE e2e |
| TC-F25-15 | Kiểm tra giao diện | MH-14 và trang Thông báo ở 1440/1280 px với `ui.viewer` | Chưa chạy: dev server đã dừng | Thủ công (còn nợ) |
