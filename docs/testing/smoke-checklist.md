# Checklist kiểm thử thủ công rút gọn (smoke theo vai)

Từ 2026-10-31, người dùng chốt giảm thiểu kiểm thử thủ công. Checklist này **thay cho việc chạy lần lượt 413 ca Manual** trong `test-cases/*.md`; các file đó giữ lại làm tài liệu tham chiếu khi một kịch bản dưới đây thất bại.

- Phần đã có test tự động (BE unit/e2e, FE vitest, Playwright) **không** lặp lại ở đây. Checklist chỉ giữ những gì máy không kiểm được: nhìn, đọc chữ, cảm giác luồng, email thật, file thật.
- Mỗi lượt phát hành: một người chạy hết bảng, khoảng 60–90 phút, ghi Passed / Failed / Blocked kèm ngày và ghi chú.
- Tài khoản: theo [`docs/ACCOUNTS.md`](../ACCOUNTS.md), gồm thế giới `e2e.*` (`pnpm e2e:world`) và tài khoản thật đã phân vai. Mật khẩu lấy từ biến môi trường nêu ở đó (`E2E_ADMIN_PASSWORD`, `E2E_PASSWORD` trong `source/e2e/.env`), không ghi vào tài liệu.
- Gặp lỗi: ghi hết một lượt vào `docs/troubleshooting/error_log.md` rồi mới sửa theo nhóm.

## Trạng thái lượt gần nhất

| Lượt | Ngày | Người chạy | Kết quả |
|---|---|---|---|
| 1 | — | — | Chưa chạy: máy MSI chưa có `source/e2e/.env` (`E2E_ADMIN_PASSWORD`, `E2E_PASSWORD`) |

## Chung — mọi vai

| # | Kịch bản | Thay cho | Kết quả |
|---|---|---|---|
| S-01 | Đăng nhập sai mật khẩu → thông báo chung, không lộ tài khoản tồn tại; đăng nhập đúng → về trang chính | F01 Manual | Not run |
| S-02 | Bỏ máy 60 phút → phiên hết hạn, quay lại đăng nhập; bấm Đăng xuất → không quay lại được bằng nút Back | F01, NFR-08 | Not run |
| S-03 | Đổi mật khẩu lần đầu bắt buộc; mật khẩu yếu bị từ chối với lý do đọc được | F01/F02 Manual | Not run |
| S-04 | Menu chỉ hiện đúng nhóm theo vai: R5 không thấy "Chờ tôi duyệt" (trừ khi được ủy quyền) và "Quản trị"; R6 chỉ thấy Cổng sinh viên | F02, lỗi 2026-10-31 | Not run |
| S-05 | Giao diện đúng `DESIGN.md`: header xanh logo DUT, Roboto, bảng không trắng khi đổi bộ lọc, trạng thái đọc được không cần màu | UI/UX rule | Not run |

## R1 — Phòng Đào tạo

| # | Kịch bản | Thay cho | Kết quả |
|---|---|---|---|
| S-10 | Tạo tài khoản, gán vai có phạm vi, khóa/mở tài khoản; ma trận quyền khóa đúng ô bị khóa | F02 | Not run |
| S-11 | Tạo đơn vị, nhóm chuyên môn, gán điều phối; R4 suy ra đúng | F03 | Not run |
| S-12 | Danh mục học phần: thêm, sửa, tìm tiếng Việt có dấu, sắp xếp ICU | F04 | Not run |
| S-13 | Nhập Excel danh mục và khung với file thật của Khoa; xuất lại mở được bằng Excel | F09 TC_015/016/025, C10 | Blocked: chờ file thật (C10) |
| S-14 | Duyệt cấp 3 rồi ban hành phiên bản: nhập số quyết định, học kỳ hiệu lực; lịch sử phiên bản hiện đúng | F14/F15 | Not run |
| S-15 | Gán khóa tuyển sinh cho phiên bản; so sánh hai phiên bản hiển thị đúng khác biệt | F16 TC_023..027 | Not run |
| S-16 | Bản 1.1 PENDING → ACTIVE đúng ngày đầu học kỳ khi worker đang chạy | Nợ MVP | Blocked: cần đúng ngày đầu học kỳ thật |
| S-17 | Trang Sao lưu: trạng thái, danh sách bộ, diễn tập; chữ đọc được khi chưa cấu hình | F26 | Not run |
| S-18 | Ủy quyền duyệt cho người khác; người nhận thấy "Chờ tôi duyệt" và email đến Mailpit | F25 | Not run |

## R3 — Giám đốc CTĐT / R4 — Điều phối nhóm

| # | Kịch bản | Thay cho | Kết quả |
|---|---|---|---|
| S-20 | Khung chương trình: thêm học phần vào học kỳ, nhóm tự chọn có điều kiện tối thiểu, cảnh báo hiện đúng | F07 | Not run |
| S-21 | Kiểm tra nhất quán: thiếu tiên quyết, vượt tín chỉ, tự chọn chưa vào nhóm (dữ liệu DUT) | F08 | Not run |
| S-22 | PLO/CLO: ma trận học phần–PLO, CLO–PLO, độ phủ | F11 | Not run |
| S-23 | R4 duyệt cấp 1: duyệt, trả về có lý do, từ chối; bình luận hiện đúng người/giờ | F14 | Not run |
| S-24 | R3 duyệt cấp 2 trên đề xuất đã qua cấp 1; thông báo trong app đến đúng người | F14 | Not run |
| S-25 | Đồ thị học phần, sức khỏe CTĐT, dòng thời gian phiên bản | F24 | Not run |

## R5 — Giảng viên

| # | Kịch bản | Thay cho | Kết quả |
|---|---|---|---|
| S-30 | Soạn đề cương: mục tiêu, CLO, tuần, đánh giá 100%, tài liệu đính kèm ≤ 50 MB | F10 | Not run |
| S-31 | Công thức điểm và ánh xạ đánh giá–CLO | F12 TC_022..026, C1 | Not run (đơn vị/ngưỡng chờ C1) |
| S-32 | Tạo đề xuất thay đổi, thêm hồ sơ căn cứ (FR-109), nộp; thu hồi rồi nộp lại | F13 | Not run |
| S-33 | Đề xuất bị trả về: sửa và nộp lại, vòng mới hiện đúng | F13/F14 | Not run |

## R2 — Ban lãnh đạo khoa

| # | Kịch bản | Thay cho | Kết quả |
|---|---|---|---|
| S-40 | Chỉ bình luận được, không có nút duyệt; thống kê đề xuất | F14 | Not run |
| S-41 | Báo cáo kiểm định, xuất file | F23 | Not run |

## R6 — Sinh viên

| # | Kịch bản | Thay cho | Kết quả |
|---|---|---|---|
| S-50 | Cổng sinh viên: khung đúng phiên bản được gán, trạng thái từng học phần, PLO | F20 | Not run |
| S-51 | Điều kiện đăng ký học phần: lý do không đủ điều kiện đọc được | F18 TC_015/016, C3 | Not run (chính sách miễn học chờ C3) |
| S-52 | Kết quả xét tốt nghiệp của chính mình | F19 TC_020..035, C4 | Not run (điều kiện chờ C4) |

## Vận hành — không chạy trong lượt smoke

Các mục này cần thời gian thật, phần cứng thật hoặc đầu vào Khoa. Theo dõi ở `docs/progress/todo.md`, không tính là Failed.

- Sao lưu 7 đêm liên tục, diễn tập B5/B6, sao chép ra ngoài máy (F-26).
- k6 canonical 200 người dùng / 15 phút trên stack `deploy/`, uptime dài hạn (F-27).
- NFR-02 trên phần cứng thật.
- Hợp đồng DB Trường (C5), khóa dDUT (C6), mẫu PDF (C7), SMTP thật (C8).
