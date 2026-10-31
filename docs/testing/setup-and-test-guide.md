# Hướng dẫn cài đặt và kiểm thử — bản MVP

Một chỗ để bắt đầu: dựng hệ thống trên máy, chạy kiểm thử tự động, rồi đi thử bằng trình duyệt theo từng tính năng. Kịch bản chi tiết không chép lại ở đây — tài liệu này **trỏ tới** nơi chúng đã có.

| Cần gì | Ở đâu |
|---|---|
| Bước đi thử từng tính năng (nguồn chính) | §7 "Kiểm chứng" của `docs/implementation/f-xx-*-implementation-plan.md`, tóm tắt lại ở mục USER ACTIONS / đi thử của `docs/implement-report/f-xx-*-implement-report.md` |
| Kịch bản nghiệm thu theo bậc (NT-Bx-yy) | `docs/planning/test-plan.md` §7 |
| Kịch bản quy tắc nghiệp vụ và trường hợp biên (KB-xxx) | `docs/planning/test-plan.md` §6 |
| Kiểm chứng yêu cầu phi chức năng | `docs/planning/test-plan.md` §8 |
| Mẫu ghi kết quả kiểm thử tay | `docs/testing/_TEMPLATE.md`, quy ước ở `docs/testing/README.md` |

---

## 1. Cài đặt lần đầu

**Cần có:** Node.js 22 (≥ 22.22), pnpm 10, Docker.

### 1.0. Một lệnh cho máy mới

Trong `source/backend`: `pnpm dev:setup`. Script `scripts/dev-setup.mjs` kiểm Node/pnpm/Docker, tạo `source/backend/.env` và `source/e2e/.env` từ mẫu nếu chưa có, dựng PostgreSQL 18 (ICU `vi-VN`) + Redis 8 + Mailpit (`compose.yaml`, profile `mail`), cài thư viện ba project, `prisma migrate deploy`, `prisma:seed` rồi `prisma:seed:dut`. Chạy lại không sinh trùng. Sau đó `pnpm dev` ở `source/backend` và `source/frontend`; email cục bộ xem ở `http://127.0.0.1:8025`. Thêm `--skip-seed` (`node scripts/dev-setup.mjs --skip-seed`) nếu chỉ cần hạ tầng. Dữ liệu cá nhân DUT không có trong git; thiếu thì chỉ nạp chương trình và học phần. Các bước dưới đây là bản làm tay.

### 1.1. Backend — `source/backend`

1. `pnpm install` (tự chạy `prisma generate`).
2. `pnpm services:up` — dựng PostgreSQL 18 (ICU `vi-VN`) và Redis 8. Nếu cổng 6379 đã bị chiếm, đặt `REDIS_PORT` khác trước khi chạy.
3. Tạo `.env` cạnh `package.json` (mẫu đầy đủ ở §1.3). Tối thiểu cần `DATABASE_URL`, `SESSION_SECRET` và `SEED_ADMIN_PASSWORD`.
4. `pnpm prisma:migrate` — áp 13 migration (`auth_session` … `release_versions`).
5. `SEED_ADMIN_PASSWORD=<≥ 8 ký tự, có chữ và số> pnpm prisma:seed` — chạy lại nhiều lần không sinh trùng.
6. (Tùy chọn, để đi thử bằng trình duyệt) `SEED_DEMO_PASSWORD=<≥ 8 ký tự, có chữ và số> pnpm prisma:seed:demo` — nạp tài khoản các vai, nhóm chuyên môn, học phần, khung 1024034 và một CTĐT thứ hai (§3.1). Chạy **sau** `pnpm prisma:seed` (thiếu thì báo lỗi rõ); chạy lại nhiều lần không đổi gì.
7. `pnpm dev` → API `http://localhost:3000/api`, tài liệu API `http://localhost:3000/api/docs`. Biên dịch bằng SWC nên lên trong vài giây nhưng không kiểm kiểu; kiểm kiểu bằng `pnpm typecheck`. Nếu dừng ở `Watching for file changes` mà không thấy `Nest application successfully started`: kiểm tra PostgreSQL/Redis đã chạy và `DATABASE_URL`, `REDIS_PORT` đúng.
8. Kiểm tra: `GET /api/health` trả `{"status":"ok","database":"up","redis":"up"}`.

### 1.2. Frontend — `source/frontend`

1. `pnpm install`
2. `pnpm dev` → `http://localhost:5173` (Vite chuyển `/api` sang `localhost:3000`).
3. Đăng nhập `admin` / mật khẩu seed → hệ thống buộc đổi mật khẩu lần đầu.

Khi API đổi: chạy backend rồi `pnpm api:types` để sinh lại `src/shared/api/schema.d.ts`.

### 1.3. Mẫu `.env`

**Backend** — `source/backend/.env`. `docker compose` (`pnpm services:up`) và `prisma` (migrate, seed) đọc cùng tệp này, nên các giá trị `POSTGRES_*` phải khớp `DATABASE_URL`.

```env
# --- Bắt buộc ---
DATABASE_URL=postgresql://ctdt:ctdt@localhost:5432/ctdt
# ≥ 32 ký tự. Sinh: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=

# --- Chỉ cho seed (pnpm prisma:seed) ---
# Mật khẩu tài khoản R1 đầu tiên: ≥ 8 ký tự, có chữ và số
SEED_ADMIN_PASSWORD=
# SEED_ADMIN_USERNAME=admin

# --- Chỉ cho dữ liệu mẫu (pnpm prisma:seed:demo, tùy chọn) ---
# Mật khẩu chung của các tài khoản mẫu: ≥ 8 ký tự, có chữ và số
SEED_DEMO_PASSWORD=

# --- Tùy chọn (giá trị mặc định) ---
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
# Đổi nếu 6379 đã bị chiếm; compose cũng mở Redis ở cổng này
REDIS_PORT=6379
# Phiên hết hạn sau số phút không thao tác (NFR-08)
SESSION_IDLE_MINUTES=60
# Thư mục tệp đính kèm đề cương và đề xuất; ở máy chủ thật đặt trên ổ bền, có sao lưu
FILES_ROOT=files
# Dung lượng tối đa một tệp đính kèm (MB)
ATTACHMENT_MAX_MB=20
# Tiền tố khóa Redis của hàng đợi BullMQ; chỉ đặt khi nhiều ứng dụng dùng chung một Redis
# BULLMQ_PREFIX=ctdt

# --- docker compose (pnpm services:up) ---
POSTGRES_USER=ctdt
POSTGRES_PASSWORD=ctdt
POSTGRES_DB=ctdt
POSTGRES_PORT=5432
```

Thiếu `DATABASE_URL` hoặc `SESSION_SECRET`, hay một biến sai kiểu, thì máy chủ dừng ngay lúc khởi động (`src/shared/config/env.validation.ts`).

**Frontend** — không cần `.env`. Vite chuyển `/api` sang `http://localhost:3000`, giá trị này viết cứng trong `vite.config.ts`. Nếu backend chạy ở cổng khác thì sửa `BACKEND_URL` ở đó.

### 1.4. Seed tạo sẵn gì

| Dữ liệu | Ghi chú |
|---|---|
| Tài khoản `admin` (R1) | Tài khoản duy nhất; các vai khác tạo ở §3.1 |
| 3 đơn vị: Trường ĐHBK (`DHBK`), Khoa CNTT, Phòng Đào tạo (`PDT`) | |
| 6 vai trò R1..R6, 43 quyền, ma trận quyền | |
| Cấp duyệt, danh mục khối kiến thức (rỗng) | |
| CTĐT 1024034 (bản Nháp) + 6 học phần `DEMO*` + khung mẫu | **Dữ liệu giữ chỗ** — thay bằng Excel thật của Khoa |
| Học kỳ, khóa | **Giữ chỗ** — thay bằng lịch thật |

`pnpm prisma:seed:demo` (tùy chọn) bổ sung: 8 tài khoản mẫu, khoa `KHOA_KHCB` (chỉ để có một học phần của khoa khác), 4 nhóm chuyên môn, 17 học phần, quan hệ học phần, một nhóm tương đương, khung + PLO + ma trận + đề cương Nháp cho 1024034 (thay sáu học phần `DEMO*` giữ chỗ nếu khung chưa bị sửa) và CTĐT thứ hai 1024035. Không tạo bản ban hành, đề xuất hay phê duyệt.

---

## 2. Kiểm thử tự động

| Lệnh | Ở đâu | Ghi chú |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` · `pnpm lint` · `pnpm format:check` | backend | |
| `pnpm test` | backend | Đơn vị, không cần Docker (853 ca lúc bàn giao) |
| `pnpm test:e2e` | backend | Cần Docker đang chạy. Dựng một PostgreSQL + một Redis cho cả lượt (`test/global-setup.ts`), mỗi tệp một cơ sở dữ liệu riêng (391 ca, ~1–2 phút) |
| `pnpm exec tsc -b` · `pnpm lint` · `pnpm format:check` · `pnpm build` | frontend | |
| `pnpm -s test --run` | frontend | 411 ca |

Ma trận quyền được kiểm tự động ở `source/backend/test/permission-table.ts` (mỗi ô: một lời gọi được phép, một lời gọi bị từ chối).

---

## 3. Đi thử bằng trình duyệt

### 3.1. Chuẩn bị tài khoản cho các vai

**Cách nhanh:** chạy `pnpm prisma:seed:demo` (§1.1 bước 6). Tất cả tài khoản dưới đây dùng chung mật khẩu `SEED_DEMO_PASSWORD`, không bị buộc đổi mật khẩu lần đầu. Các bước tạo tay ở bảng sau đó **không còn bắt buộc**; chỉ cần khi muốn thử chính màn hình Tài khoản (MH-05), nhóm chuyên môn hay phân công Giám đốc.

| Tài khoản | Vai | Có hiệu lực nhờ | Làm được gì |
|---|---|---|---|
| `r2.lanhdao` | R2 Ban lãnh đạo khoa | Gán vai, toàn hệ thống | Xem toàn khoa theo ma trận quyền R2 (MH-06) |
| `r3.giamdoc` | R3 | Giám đốc CTĐT 1024034 | Sửa khung, PLO, ma trận, đề cương của 1024034; tạo đề xuất |
| `r3.giamdoc2` | R3 | Giám đốc CTĐT 1024035 | Như trên nhưng cho CTĐT thứ hai; ngoài 1024034 là ngoài phạm vi |
| `r4.dieuphoi` | R4 | Điều phối nhóm Khoa học máy tính (`KHMT`) | Quản lý học phần, quan hệ của nhóm `KHMT`; đồng ý đề xuất ở cấp nhóm |
| `r4.dieuphoi2` | R4 | Điều phối nhóm Công nghệ phần mềm (`CNPM`) | Như trên cho nhóm `CNPM` |
| `r5.giangvien` | R5 | Thành viên nhóm `KHMT` | Soạn đề cương, CLO của học phần nhóm `KHMT` |
| `r5.giangvien2` | R5 | Thành viên nhóm `CNPM` | Như trên cho nhóm `CNPM`; học phần `KHMT` là ngoài nhóm |
| `r6.sinhvien` | R6 | Gán vai, phạm vi đơn vị Phòng Đào tạo | Chỉ thấy bản đã ban hành, **không thấy bản Nháp** |

R1 vẫn là `admin`. R3, R4, R5 là vai **suy ra** từ phân công, R6 gán tay bằng seed (giao diện không gán R6; phạm vi đơn vị phải khác khoa của CTĐT, nếu không sẽ đọc được bản Nháp). Nhóm còn lại `HTTT`, `MMT` chưa có người điều phối — thử bằng `admin`.

Dữ liệu mẫu đã có **một giảng viên ở nhóm khác** (`r5.giangvien2`) và **một Giám đốc của CTĐT khác** (`r3.giamdoc2`); với tài khoản tự tạo, nên có để thử các trường hợp bị từ chối do ngoài phạm vi.

### 3.2. Thứ tự đi thử

Đi theo thứ tự dưới đây — mỗi tính năng dùng dữ liệu tạo ở tính năng trước. Bước cụ thể nằm trong báo cáo dựng của tính năng (cột cuối). Nếu đã chạy `pnpm prisma:seed:demo`, các bước **tạo** tài khoản, nhóm, học phần, quan hệ, khung, PLO, ma trận và đề cương Nháp (xem bảng dưới) có thể bỏ qua — dùng dữ liệu mẫu; vẫn làm các bước **sửa, xóa, thử lỗi**. Xong tính năng nào thì đổi 🔄 → ✅ ở `docs/progress/todo.md`.

| # | Tính năng | Vai | Nghiệm thu | Bước chi tiết |
|---|---|---|---|---|
| 1 | F-02 Tài khoản, vai trò, quyền | R1, R5 | NT-B1-02, NT-B1-07 | `implement-report/f-02-*` (6 bước) |
| 2 | F-03 Đơn vị, nhóm chuyên môn | R1, R4 | NT-B1-01, NT-B1-02 | `implement-report/f-03-*` |
| 3 | F-04 Danh mục học phần | R1, R4, R5 | NT-B1-03 | `implement-report/f-04-*` (9 bước) |
| 4 | F-05 Quan hệ học phần, nhóm tương đương | R1, R4 | NT-B1-04, NT-B1-05 | `implement-report/f-05-*` (6 bước) |
| 5 | F-06 CTĐT, Giám đốc CTĐT | R1, R3 | NT-B2-08 | `implement-report/f-06-*` (6 bước) |
| 6 | F-07 Khung, nhóm tự chọn | R1, R4 | NT-B2-04, NT-B2-05, NT-B2-07 | `implement-report/f-07-*` (9 bước) |
| 7 | F-08 Kiểm tra nhất quán | R1, R2, R3 | NT-B2-06 | `implement-report/f-08-*` (8 bước) |
| 8 | F-10 Đề cương | R3, R5, R6 | NT-B3-01, NT-B3-02 | `implement-report/f-10-*` (7 bước) |
| 9 | F-11 PLO, CLO, ma trận | R1, R3, R4, R6 | NT-B3-03, NT-B3-04, NT-B3-05 | `implement-report/f-11-*` (8 bước) |
| 10 | F-15 phần 1 — ban hành khởi tạo | R1 | NT-B4-01 | `implement-report/f-15-*` |
| 11 | F-13 Đề xuất thay đổi | R1..R5 | NT-B4-03, NT-B4-09 | `implement-report/f-13-*` |
| 12 | F-14 Duyệt ba cấp, thông báo | R1, R2, R3, R4, R5 | NT-B4-04, NT-B4-07, NT-B4-08 | `implement-report/f-14-*` |
| 13 | F-15 phần 2 — duyệt cuối, kích hoạt, đính chính | R1, R3 | NT-B4-05, NT-B4-06, NT-B4-10, NT-B4-12 | `implement-report/f-15-*` |

**Dữ liệu mẫu đã có sẵn cho các bước tạo (`pnpm prisma:seed:demo`):**

| Tính năng | Đã có | Còn phải tự làm |
|---|---|---|
| F-02 | 8 tài khoản và vai ở §3.1 | Thử tạo, khóa, gán vai, đổi mật khẩu |
| F-03 | 4 nhóm `KHMT`, `CNPM`, `HTTT`, `MMT`; điều phối và thành viên của `KHMT`, `CNPM` | Thêm thành viên, thu hồi, nhóm `HTTT`/`MMT` |
| F-04 | 17 học phần, có học phần 0 tín chỉ (`ITS100`) và học phần khoa khác (`MAT101`) | Tạo, sửa, ngừng, thử tín chỉ sai |
| F-05 | Tiên quyết có ngưỡng 2 (`PRG101` → `DSA201`), học trước, song hành (`DBS201` ~ `DBS202`), nhóm tương đương `TD-CSDL` | Thử vòng: `WEB301`, `SWE302`, `SWE301` chưa có quan hệ nào, đặt A → B → C → A |
| F-06 | CTĐT 1024034 (Giám đốc `r3.giamdoc`) và 1024035 (`r3.giamdoc2`) | Thêm CTĐT lệch tín chỉ, đổi Giám đốc, nhân bản, ngừng |
| F-07 | Khung 1024034: 16 dòng, học kỳ 1–6, nhóm tự chọn `TC1`, điều kiện xếp sau; khung nhỏ của 1024035 | Thêm trùng, học kỳ 9, kéo thả, thêm nhóm |
| F-08 | Tín chỉ khai báo 28 + 6 = 34 khớp khung; kiểm tra chỉ còn 4 mục thông tin (học kỳ 7–10 trống) | Làm lệch rồi chấp nhận kèm lý do, tạo vòng |
| F-10 | Đề cương Nháp cho cả 17 học phần; `PRG101`, `DSA201`, `DBS201` có đủ mục, tuần và CLO | Soạn, kéo thả tuần, tệp đính kèm, bản EN |
| F-11 | 6 PLO, ma trận học phần–PLO có trọng số, liên kết CLO–PLO của ba học phần trên | Nhập trọng số `0,5`, xóa ô có liên kết, kiểm tra phủ |
| F-15, F-13, F-14 | Không có — chỉ có bản Nháp, chưa ban hành | Toàn bộ: ban hành, đề xuất, duyệt |

**Không kiểm ở MVP** (tính năng sau MVP): NT-B1-06 (nhật ký kiểm toán), NT-B2-01..03, NT-B2-09 (Excel, F-09), NT-B3-06..08 (công thức điểm, F-12), NT-B4-02 (đề xuất sửa công thức điểm, F-12), NT-B4-11 (gán khóa, F-16), toàn bộ B5, B6.

### 3.3. Luồng xuyên suốt (kiểm tra chức năng tổng thể)

Sau khi từng tính năng đạt, chạy một lượt nối liền để thấy các tính năng ăn khớp:

1. R1 tạo CTĐT, phân công Giám đốc (R3).
2. R1/R4 dựng khung, nhóm tự chọn, điều kiện tiên quyết; R5 soạn đề cương và CLO; R3 khai báo PLO và ma trận.
3. Kiểm tra nhất quán sạch lỗi (hoặc chấp nhận chênh lệch tín chỉ kèm lý do).
4. R1 ban hành phiên bản khởi tạo → sửa trực tiếp dữ liệu đã ban hành bị từ chối, nút đổi thành "Tạo đề xuất".
5. R5 tạo đề xuất sửa đề cương / khung, sửa bản làm việc, xem so sánh, gửi duyệt.
6. R4 → R3 → R1 duyệt (thử Trả lại một lần, gửi lại); chuông thông báo đếm đúng.
7. R1 duyệt cuối, chọn học kỳ hiệu lực → phiên bản mới chờ kích hoạt; khi tới học kỳ, phiên bản cũ thành Lịch sử.
8. R6 chỉ thấy bản đã ban hành.

### 3.4. Ghi kết quả

Mỗi lượt kiểm tay ghi một tệp `docs/testing/feature__<slug>.md` theo `_TEMPLATE.md`. Lỗi tìm thấy: ghi vào `docs/troubleshooting/error_log.md` khi đã sửa.
