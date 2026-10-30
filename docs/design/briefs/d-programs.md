# Brief cụm D: Chương trình đào tạo

Chế độ: Operate. Người dùng chính: R1 (tạo CTĐT, gán Giám đốc), R3 (làm việc trên CTĐT mình phụ trách), R4/R5 (tra cứu).

## Danh sách CTĐT `/programs` (US-018)
- Tác vụ chính: tìm đúng CTĐT để mở. Dữ liệu thật: 24 CTĐT, nên tìm kiếm và lọc quan trọng hơn phân trang.
- Ưu tiên dữ liệu: tên (đọc trước) + mã (đọc sau, dạng mã số), phiên bản hiện hành, Giám đốc. CTĐT chưa có Giám đốc là việc R1 phải làm, nên hiện rõ bằng chữ cảnh báo "Chưa gán", không phải gạch ngang.
- Hành động: tìm, lọc trình độ/trạng thái, mở, tạo (R1).
- Thay đổi so với cũ: dùng `PageHeader` + `DataTable` chung (có tổng kết quả); ô tên gộp tên + mã, cả ô là liên kết; cột Giám đốc báo thiếu.

## Các màn còn lại của cụm
Tổng quan, biểu mẫu, khung chương trình theo kỳ, nhóm tự chọn, kiểm tra nhất quán, thông tin phiên bản: làm lần lượt theo bảng trong kế hoạch Phase 4 (bảng cụm D).
