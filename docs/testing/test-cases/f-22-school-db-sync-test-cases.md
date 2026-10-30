# F-22 Đồng bộ CSDL Trường — Test Cases

| Mục | Nội dung |
| --- | --- |
| User stories | US-101..104: cấu hình nguồn, kiểm tra kết nối, chạy theo lịch/chạy tay/chạy lại, xử lý xung đột với Excel. |
| Màn hình | MH-12 cấu hình đồng bộ (`/school-db-sync`); MH-13 lịch sử (`/school-db-sync/runs`) và chi tiết lần đồng bộ. |
| Nguồn | `docs/implementation/f-22-school-db-sync-implementation-plan.md`; DTO sinh từ OpenAPI. |
| Phạm vi dữ liệu | Chỉ dữ liệu tổng hợp trên bản mô phỏng SQL Server 2022. Không kết nối CSDL thật của Trường. |
| Quy ước kết quả | Passed theo lượt chạy 2026-10-30/31: BE e2e 14/14 + 3/3 (SQL Server), FE vitest 8/8. |

## Truy vết

| Nội dung | TC |
| --- | --- |
| US-101/102: cấu hình, mật khẩu chỉ ghi, allowlist, kiểm tra kết nối | F22-TC_001..005 |
| US-103: chạy tay, theo lịch, chồng lần chạy, lỗi kết nối, chạy lại, quá hạn | F22-TC_006..012 |
| US-104: xung đột trước/sau, dữ liệu sai không ghi gì | F22-TC_013..015 |
| Màn hình MH-12/13 | F22-TC_016..019 |

## Test cases

| TC | Mô tả | Kết quả mong đợi | Automated? | Kết quả | Note |
| --- | --- | --- | --- | --- | --- |
| F22-TC_001 | Người không phải R1 gọi API đồng bộ | 403 | Yes | Passed | BE e2e `access` |
| F22-TC_002 | Cấu hình mặc định | Chỉ Excel; chạy đồng bộ trả 409 | Yes | Passed | BE e2e + FE vitest |
| F22-TC_003 | Lưu mật khẩu rồi đọc cấu hình | Chỉ có `passwordConfigured`, không lộ mật khẩu | Yes | Passed | BE e2e + FE vitest |
| F22-TC_004 | Máy chủ ngoài allowlist | Bị từ chối | Yes | Passed | BE e2e |
| F22-TC_005 | Kiểm tra kết nối bằng tài khoản sa / sai mật khẩu / tài khoản chỉ đọc | READ_ONLY_REQUIRED / CONNECTION_FAILED / CONNECTED | Yes | Passed | BE e2e SQL Server |
| F22-TC_006 | Chạy tay thành công | Đếm sinh viên, kết quả, lớp đúng; commit một lần | Yes | Passed | BE e2e cả hai reader |
| F22-TC_007 | Lịch hằng ngày/hằng tuần | `nextRunAt` đúng theo giờ Việt Nam | Yes | Passed | BE unit + e2e |
| F22-TC_008 | Một ô lịch chỉ chạy một lần | Đúng một lần SCHEDULED | Yes | Passed | BE e2e |
| F22-TC_009 | Hai lần chạy chồng nhau; cùng requestId | 409; cùng requestId trả cùng lần | Yes | Passed | BE e2e |
| F22-TC_010 | Mất kết nối giữa chừng | FAILED, 0 thay đổi, thông báo R1 | Yes | Passed | BE e2e |
| F22-TC_011 | Chạy lại lần thất bại | Lần mới RETRY liên kết lần cũ | Yes | Passed | BE e2e + FE vitest |
| F22-TC_012 | Lần chạy quá hạn | Bị chặn, không ghi | Yes | Passed | BE e2e |
| F22-TC_013 | Kết quả Excel khác dữ liệu Trường | Dữ liệu Trường được chọn; ghi xung đột trước/sau | Yes | Passed | BE e2e + FE vitest |
| F22-TC_014 | Dòng nguồn sai | FAILED, không ghi dòng nào, thông điệp không chứa giá trị cá nhân | Yes | Passed | BE e2e |
| F22-TC_015 | Học phần không bị đồng bộ sửa | Danh mục học phần giữ nguyên | Yes | Passed | BE e2e |
| F22-TC_016 | MH-12 khi đang có lần chạy | Form và ánh xạ bị khóa | Yes | Passed | FE vitest |
| F22-TC_017 | MH-12 Đồng bộ ngay | Mở trang chi tiết lần mới | Yes | Passed | FE vitest |
| F22-TC_018 | MH-13 lọc trạng thái | Bộ lọc lưu trong URL | Yes | Passed | FE vitest |
| F22-TC_019 | Kết nối CSDL thật của Trường | Chờ cổng E1 | No | Not run | Manual, cần quyền truy cập |
