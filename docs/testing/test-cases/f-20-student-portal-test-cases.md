# F-20 Cổng sinh viên — Test Cases

| Mục | Nội dung |
| --- | --- |
| User stories | US-092..097 |
| Màn hình | MH-55 tổng quan, MH-56 chương trình + PLO + đề cương, MH-57 tiến độ, MH-58 tư vấn đăng ký, MH-59 xét tốt nghiệp |
| Phạm vi dữ liệu | Chỉ sinh viên tổng hợp. |
| Quy ước kết quả | Lượt chạy 2026-10-31: BE e2e 6/6, FE vitest 7/7, Playwright 2/2. |

## Test cases

| TC | Mô tả | Kết quả mong đợi | Automated? | Kết quả | Note |
| --- | --- | --- | --- | --- | --- |
| F20-TC_001 | Sinh viên đăng nhập, xem 5 màn hình ở 360px | Đúng tên, chương trình, "Đã đạt" + điểm; không cuộn ngang; không có nút đăng ký | Yes | Passed | Playwright |
| F20-TC_002 | Cán bộ mở `/student` | Bị chuyển về trang cán bộ | Yes | Passed | Playwright |
| F20-TC_003 | `/portal/me` theo phiên | Đúng sinh viên, ngành chính trước, phiên bản áp dụng; `no-store` | Yes | Passed | BE e2e + FE vitest |
| F20-TC_004 | Bốn trạng thái học phần | Chưa học / Đã đạt / Chưa đạt / Đang học, điểm đúng; GET không ghi | Yes | Passed | BE e2e |
| F20-TC_005 | Trùng khớp với F-18/F-19 | Tập đã đạt = `completed` của F-18; tín chỉ sinh viên = R1 | Yes | Passed | BE e2e |
| F20-TC_006 | Đọc của sinh viên khác / đọc chương trình kiểu cán bộ | 404 / 403 | Yes | Passed | BE e2e |
| F20-TC_007 | Tài khoản không có hồ sơ | `student: null`; giao diện báo liên hệ Phòng Đào tạo | Yes | Passed | BE e2e + FE vitest |
| F20-TC_008 | Đề cương không được ghim | 404 `PORTAL_SYLLABUS_NOT_ISSUED`; không lộ trường nội bộ | Yes | Passed | BE e2e |
| F20-TC_009 | Tư vấn đăng ký | Tách "Có thể đăng ký"/"Chưa đủ điều kiện", lý do và học phần song hành | Yes | Passed | FE vitest |
| F20-TC_010 | Trình duyệt Firefox/Edge, thiết bị thật | Hiển thị đúng | No | Not run | Manual (US-097 AC3) |
