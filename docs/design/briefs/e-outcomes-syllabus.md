# Brief cụm E: Chuẩn đầu ra và đề cương

Chế độ: Operate. Người dùng: R3/R4 soạn PLO và ma trận, R5 soạn đề cương, R1 xem.

| Màn | Tác vụ chính | Thay đổi |
|---|---|---|
| PLO, ma trận HP–PLO, CLO–PLO, CLO–PLO theo học phần | Ghi và gắn chuẩn đầu ra | `PageHeader` chung; dòng hướng dẫn thành `subtitle` ngay dưới tiêu đề, không còn đoạn chữ rời |
| Kiểm tra phủ | Tìm chỗ thiếu | `SummaryStrip` 4 số (PLO chưa có HP, CLO chưa gắn, HP chưa gắn, HP chưa có đề cương) lên đầu; số > 0 tô cảnh báo |
| Xem đề cương | Đọc đề cương đúng phiên bản | Liên kết về học phần thành `BackLink`; tiêu đề chứa thẻ "chưa dịch"; header chỉ còn chọn ngôn ngữ và hành động |
| Sửa đề cương | Sửa theo mục | `BackLink`; danh sách CTĐT dùng chung gập lại khi quá 3 chương trình, để trình soạn nằm trong màn đầu |
| Công thức điểm | Khai báo thành phần | Giữ nguyên: tổng trọng số đã hiện trực tiếp (live status) cạnh nút thêm thành phần, nơi người dùng đang sửa; thêm dải tổng ở đầu chỉ lặp lại |

Thay đổi chung toàn ứng dụng trong PR này: `Alert message=` → `title=` (AntD 6) ở 19 tệp; `BackLink` ẩn mũi tên khỏi tên truy cập.
