# Tài khoản đại diện cho các vai trò

Danh sách tài khoản dùng để đăng nhập thử từng vai trò khi phát triển và kiểm thử. Mật khẩu **cục bộ** của môi trường phát triển ghi ngay dưới đây (người dùng cho phép ngày 2026-10-31). Không dùng chúng ở môi trường thật, và không thêm mật khẩu của môi trường thật vào tệp này.

## Mật khẩu cục bộ (máy phát triển, Playwright)

Đặt trong `source/e2e/.env` (đã gitignore):

```dotenv
E2E_ADMIN_USERNAME=admin
E2E_ADMIN_PASSWORD=0905748953a
E2E_PASSWORD=0905748953a
```

- `E2E_ADMIN_PASSWORD`: mật khẩu hiện tại của `admin`, tức sau lần đổi bắt buộc đầu tiên.
- `E2E_PASSWORD`: mật khẩu chung của mọi tài khoản `e2e.*` ở mục 2. Đặt cùng giá trị khi chạy `pnpm e2e:world`.
- Chạy Playwright: theo [playwright-guide.md](testing/playwright-guide.md).

Ứng dụng chạy tại `http://localhost:5173` (frontend) và `http://localhost:3000` (backend). Cách chạy xem `scripts/README.md`.

## Sáu vai trò

| Mã | Vai trò | Cách có vai trò | Phạm vi |
|---|---|---|---|
| R1 | Phòng Đào tạo | Gán thủ công | Toàn trường (quyền cao nhất) |
| R2 | Ban lãnh đạo khoa | Gán thủ công | Theo đơn vị được gán |
| R3 | Giám đốc CTĐT | **Suy ra** từ việc được chỉ định làm giám đốc một chương trình | Chương trình mình phụ trách |
| R4 | Điều phối nhóm chuyên môn | **Suy ra** từ việc là điều phối của một nhóm chuyên môn | Nhóm chuyên môn mình điều phối |
| R5 | Giảng viên | **Suy ra** từ việc là thành viên một nhóm chuyên môn | Học phần của nhóm mình |
| R6 | Sinh viên | **Suy ra** từ hồ sơ ghi danh (F-17); giao diện từ chối gán tay | Chỉ dữ liệu của chính mình |

R3, R4, R5 không có nút gán trong giao diện: muốn tài khoản có vai trò này, phải tạo dòng chỉ định giám đốc hoặc dòng thành viên nhóm tương ứng.

## 1. Quản trị: R1

| Tên đăng nhập | Vai trò | Mật khẩu | Ghi chú |
|---|---|---|---|
| `admin` | R1, đơn vị Phòng Đào tạo | Biến `SEED_ADMIN_PASSWORD` trong `source/backend/.env` khi chạy `pnpm prisma:seed` | Tạo bởi seed nền. Lần đăng nhập đầu bắt buộc đổi mật khẩu (`mustChangePassword`). Đổi tên đăng nhập bằng `SEED_ADMIN_USERNAME` |
| `ui.viewer` | R1 | Không có trong seed; do người dùng đặt | Đang có một vai trò R1 còn hiệu lực trong `ctdt_real` (kiểm tra ngày 2026-10-31). Không rõ do ai tạo; xác nhận trước khi dùng |

## 2. Thế giới thử nghiệm E2E: R2 đến R6

Mỗi vai trò còn lại có sẵn tài khoản trong "thế giới E2E". Nó **chưa có** trong cơ sở dữ liệu `ctdt_real` cho đến khi chạy:

```powershell
cd source/backend
pnpm prisma:seed        # seed nền (vai trò, đơn vị, quyền); chạy một lần
pnpm e2e:world          # dựng tài khoản e2e.*, nhóm E2E-*, chương trình, học phần mẫu
pnpm e2e:purge          # gỡ toàn bộ thế giới E2E khi không cần nữa
```

Tất cả tài khoản dưới đây dùng **chung một mật khẩu**: biến `E2E_PASSWORD` (đặt trong `source/e2e/.env` và trong môi trường khi chạy `pnpm e2e:world`; tối thiểu 8 ký tự, có chữ và số). Lệnh `e2e:world` chạy lại an toàn, mỗi dòng khóa theo mã tự nhiên.

| Vai trò | Tên đăng nhập | Họ tên mẫu | Cách có vai trò |
|---|---|---|---|
| R1 | `admin` (hoặc biến `E2E_ADMIN_USERNAME`) | Quản trị hệ thống | Seed nền |
| R2 | `e2e.r2.lanhdao` | TS. Lê Văn Minh | Gán thủ công R2 |
| R3 | `e2e.r3.giamdoc` | TS. Trần Thị Hương | Giám đốc một chương trình mẫu |
| R3 (thứ hai) | `e2e.r3.giamdoc2` | TS. Phạm Quốc Bảo | Giám đốc chương trình khác, dùng để kiểm tra không xem được chương trình của nhau |
| R4 | `e2e.r4.dieuphoi` | ThS. Nguyễn Hoàng Anh | Điều phối một nhóm chuyên môn mẫu |
| R4 (thứ hai) | `e2e.r4.dieuphoi2` | ThS. Võ Thanh Tùng | Điều phối nhóm khác |
| R5 | `e2e.r5.giangvien` | ThS. Đặng Thị Lan | Thành viên nhóm mẫu |
| R5 (thứ hai) | `e2e.r5.giangvien2` | ThS. Hồ Minh Khôi | Thành viên nhóm khác |
| R6 | `e2e.r6.sinhvien` | Sinh viên mẫu | Dòng vai trò R6 ghi trực tiếp, phạm vi đơn vị Phòng Đào tạo |

Cặp "thứ hai" của R3, R4, R5 có trong danh sách tài khoản E2E để thử phân quyền theo phạm vi giữa hai người cùng vai trò.

Các tài khoản trên chỉ dùng cho kiểm thử, **không dùng trong môi trường thật**. Khi xóa thế giới E2E bằng `pnpm e2e:purge`, các tài khoản `e2e.*` biến mất theo.

## 3. Dữ liệu thật DUT trong `ctdt_real`

Cơ sở dữ liệu phát triển duy nhất `ctdt_real` được nạp dữ liệu thật của khoa (nạp bằng `pnpm prisma:seed:dut`):

| Nhóm | Số lượng (thời điểm 2026-10-30) | Vai trò đang có | Ghi chú |
|---|---|---|---|
| Giảng viên | 69 | Chưa gán R2 đến R5 | Mật khẩu tạm nằm trong `source/backend/prisma/seed-data/dut/data/private/lecturer-credentials.csv` (thư mục `private/` bị gitignore; không đưa vào repository). Đăng nhập lần đầu phải đổi mật khẩu |
| Sinh viên | 1.731 | R6 (từng người) | Tên đăng nhập dạng `s<chuỗi hex>` (ví dụ có trong bảng người dùng); cách cấp mật khẩu cho sinh viên chưa được ghi trong tài liệu này, hãy hỏi người nạp dữ liệu. Không liệt kê từng người ở đây vì là dữ liệu cá nhân; xem danh sách trong giao diện bằng tài khoản R1 |

Muốn thử R2 đến R5 trên dữ liệu thật: chỉ định giám đốc chương trình, điều phối hoặc thành viên nhóm cho một giảng viên bằng giao diện (R1), hoặc dùng tài khoản E2E ở mục 2.

## 4. Ghi chú vận hành

- Phiên hết hạn sau 60 phút không hoạt động.
- Tài khoản E2E và `admin` mặc định chỉ để phát triển. Trước khi triển khai (F-27) đổi mật khẩu quản trị, không dùng `e2e.*` và đặt `SESSION_SECRET` riêng. Xem `deploy/README.md` và `docs/operations/`.
- Muốn xem ma trận quyền của từng vai trò: đăng nhập R1, mở **Quản trị → Ma trận quyền**.
