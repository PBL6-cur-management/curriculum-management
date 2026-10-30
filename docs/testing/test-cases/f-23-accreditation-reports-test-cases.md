# F-23 Báo cáo kiểm định — Test Cases

| Mục | Nội dung |
| --- | --- |
| User stories | US-105..109 |
| Màn hình | MH-60 So sánh chương trình, MH-61 Phân bổ tín chỉ, MH-62 Hồ sơ kiểm định, MH-44 Thống kê đề xuất |
| Phạm vi dữ liệu | BE e2e dùng CSDL tạm; chạy thử chỉ đọc trên `ctdt_real`. |
| Quy ước kết quả | Lượt chạy 2026-10-31: BE e2e 5/5, BE unit 4/4, FE vitest 5/5. |

## Test cases

| TC | Mô tả | Kết quả mong đợi | Automated? | Kết quả | Note |
| --- | --- | --- | --- | --- | --- |
| F23-TC_001 | So sánh hai phiên bản của hai chương trình | Chung/tương đương/riêng đúng; khác nhau ghi Học kỳ/Tín chỉ/Bắt buộc–tự chọn/Khối | Yes | Passed | BE unit + e2e |
| F23-TC_002 | So sánh hai phiên bản cùng chương trình | 400 `REPORT_SAME_PROGRAM` | Yes | Passed | BE e2e |
| F23-TC_003 | Xuất Excel so sánh | 5 trang `TomTat, HocPhanChung, TuongDuong, RiengTrai, RiengPhai` | Yes | Passed | BE e2e |
| F23-TC_004 | Phân bổ tín chỉ | Mỗi bảng cộng đúng tổng các dòng; tối thiểu tự chọn chỉ vào "yêu cầu" | Yes | Passed | BE unit + e2e |
| F23-TC_005 | MH-61 cảnh báo yêu cầu ≠ tổng công bố | Hiện cảnh báo và lý do | Yes | Passed | FE vitest |
| F23-TC_006 | Xuất ma trận | 2 trang `HocPhan_PLO`, `CLO_PLO`, ô trống = không đóng góp | Yes | Passed | BE e2e |
| F23-TC_007 | Hồ sơ kiểm định phiên bản đủ dữ liệu | 13 trang, có `LoHong` | Yes | Passed | BE e2e |
| F23-TC_008 | Hồ sơ khi thiếu đánh giá | 409 `REPORT_GRADING_UNAVAILABLE`, MH-62 liệt kê học phần cần bổ sung | Yes | Passed | FE vitest; chạy thử trên `ctdt_real` |
| F23-TC_009 | MH-62 chỉ cho chọn phiên bản đã ban hành | Không có lựa chọn Nháp | Yes | Passed | FE vitest |
| F23-TC_010 | Thống kê đề xuất | Đếm theo trạng thái/loại/nguồn; thời gian theo lượt, bỏ cấp bị bỏ qua và lượt còn chờ | Yes | Passed | BE unit + e2e |
| F23-TC_011 | Khoảng thời gian ngược | 400 `REPORT_INTERVAL_INVALID` | Yes | Passed | BE e2e |
| F23-TC_012 | Vai trò không có quyền báo cáo (R5) | 403 cho cả ba nhóm báo cáo | Yes | Passed | BE e2e |
| F23-TC_013 | Biểu mẫu kiểm định chính thức | Khoa nghiệm thu | No | Not run | Cổng E1 |
