# Dữ liệu thật DUT: báo cáo triển khai

Ngày: 2026-10-30. Nhánh `feat/dut-real-seed`.

## Đã làm

- Chỉ còn một cơ sở dữ liệu `ctdt_real` (ICU `vi-VN`). Đã xóa `ctdt` cũ, seed demo, các script `real:*`.
- Trích xuất người và kết quả: `pnpm dut:extract` đọc bản dump theo danh sách bảng **và cột** được phép (`extract/people-tables.ts`), đọc luồng từng dòng nên bảng điểm 160 MB không nằm trong RAM. Dữ liệu cá nhân ghi vào `prisma/seed-data/dut/data/private/` (gitignore); chỉ `people-report.json` (số đếm) được commit.
- Nạp: `pnpm prisma:seed:dut` tạo giảng viên, 2 nhóm chuyên môn tạm, sinh viên, ghi danh CTĐT, kết quả học tập. Chạy lại tạo 0 bản ghi.
- E2E chạy thẳng trên dữ liệu thật: `globalSetup` gọi `pnpm e2e:world` (tài khoản `e2e.*`, nhóm/đơn vị `E2E-*`, học phần và CTĐT thử), `globalTeardown` gọi `pnpm e2e:purge`. Đặt `E2E_KEEP_WORLD=1` để giữ lại khi gỡ lỗi.

## Số liệu

| Bảng | Số bản ghi | Ghi chú |
|---|---|---|
| Giảng viên (`KhoaPC=102`) | 69 | 9 tài khoản lưu trữ (`MaBP=990`) bị khóa, không vào nhóm |
| Thành viên nhóm (R5) | 60 | 27 Khoa CNTT, 33 thỉnh giảng/đơn vị khác |
| Sinh viên | 1.731 | 1 bảo lưu; 390 khóa 2026 chưa có `IDCodeVao`, lấy năm nhập học từ MSSV |
| Ghi danh CTĐT | 1.731 | Phiên bản chọn theo `MaNganh` = mã khung |
| Kết quả đọc | 57.531 | Gộp còn 57.526 (giữ lần điểm 4 cao nhất mỗi học phần–kỳ) |
| Kết quả nạp | 51.896 | 39.947 đạt, 1.743 không đạt, 10.206 đang học (kỳ 2610) |
| Bỏ qua | 4.013 + 1.617 | Kỳ cũ không có điểm; học phần không có trong danh mục |

Đã kiểm: 0 email ngoài `@dut.udn.vn`, không đọc cột mật khẩu, CMND, địa chỉ, điện thoại, gia đình, ngân hàng, Gmail sinh viên.

## Khoảng trống cần Khoa cung cấp

- PLO/CLO thật và nội dung đề cương có cấu trúc.
- Người giữ vai trò R2, R3, R4 (admin gán sau).
- Nhóm chuyên môn thật (hiện là 2 nhóm tạm).
- Lịch sử phê duyệt, số quyết định ban hành.
- Email của 37 giảng viên còn thiếu.
- Ý nghĩa `Tinhtrang1`, `MaChucvu`; cách xác định tốt nghiệp.
- Công thức điểm theo lớp học phần (`congthucdiem`) không khớp F-12, chưa nạp.
- 1.617 kết quả thuộc học phần ngoài danh mục.

## Chưa chạy

Theo yêu cầu "tắt chạy test", chưa chạy bộ Playwright đầy đủ và BE e2e trên nhánh này; chỉ chạy typecheck BE/E2E và chạy thử `e2e:world` → `e2e:purge` (sạch, dữ liệu thật giữ nguyên).
