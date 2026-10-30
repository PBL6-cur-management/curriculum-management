# F-21 API dDUT — Test Cases

| Mục | Nội dung |
| --- | --- |
| User stories | US-098..101 |
| Màn hình | MH-11 Bên tích hợp dDUT |
| Phạm vi dữ liệu | Chỉ dữ liệu tổng hợp; khóa thử bị purge. |
| Quy ước kết quả | Lượt chạy 2026-10-31: BE e2e 6/6, BE unit 3 (integration-access), FE vitest 6/6, Playwright 2/2. |

## Test cases

| TC | Mô tả | Kết quả mong đợi | Automated? | Kết quả | Note |
| --- | --- | --- | --- | --- | --- |
| F21-TC_001 | R1 tạo bên tích hợp, nhận khóa, gọi API, khóa | Khóa hiện một lần; gọi không cookie được trả lời; sau khi khóa → 401 | Yes | Passed | Playwright |
| F21-TC_002 | Tài khoản không phải R1 mở MH-11 | Không có thao tác quản lý | Yes | Passed | Playwright |
| F21-TC_003 | Khóa chỉ lưu bản băm | `keyHash` 64 hex; danh sách không chứa khóa/băm; R3 → 403; trùng tên → 409 | Yes | Passed | BE e2e |
| F21-TC_004 | Khóa thiếu/sai/đã khóa/chỉ có cookie | Cùng 401 `API_KEY_INVALID`; không `Set-Cookie`; lời gọi bằng khóa đã khóa vẫn ghi nhật ký có `clientId` | Yes | Passed | BE e2e |
| F21-TC_005 | Sáu tài nguyên trùng khớp với web | Ngữ cảnh đúng phiên bản; tư vấn đăng ký và xét tốt nghiệp bằng đúng câu trả lời web; không ghi dữ liệu học vụ; nhật ký đủ 4 lời gọi theo sinh viên | Yes | Passed | BE e2e |
| F21-TC_006 | Trạng thái rõ ràng | Sinh viên lạ 404; chưa có kết quả → `NO_ACADEMIC_RESULTS` vẫn đủ khung; đề cương thiếu/thừa bộ chọn → 400; phiên bản không có/sai định dạng → 404 | Yes | Passed | BE e2e |
| F21-TC_007 | Hạn mức và nhật ký chỉ-ghi-thêm | Lần 3 với giới hạn 2/phút → 429 + `Retry-After`; UPDATE/DELETE nhật ký bị từ chối; `lastCalledAt` hiện ở danh sách | Yes | Passed | BE e2e |
| F21-TC_008 | Hợp đồng OpenAPI riêng | `/api/v1/docs-json` đúng 6 đường dẫn; trùng `openapi/ddut-v1.json` | Yes | Passed | BE e2e |
| F21-TC_009 | Phạm vi tích hợp đúng một sinh viên | Đọc được sinh viên được gọi, không đọc được sinh viên khác; không lưu được xét tốt nghiệp | Yes | Passed | BE unit |
| F21-TC_010 | MH-11: danh sách, rỗng, tạo, trùng tên, khóa, lọc | Theo mô tả màn hình | Yes | Passed | FE vitest |
| F21-TC_011 | dDUT thật gọi qua máy chủ tin cậy | Nghiệm thu với đối tác | No | Not run | Cổng E1 |
