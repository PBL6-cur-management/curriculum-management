# NỀN TẢNG CÔNG NGHỆ v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-15 |
| Trả lời | Q-16 — công nghệ triển khai (ngôn ngữ, bộ khung, hệ quản trị cơ sở dữ liệu). Dòng Q-16 trong `docs/requirement/REQUIREMENTS.md` ghi đã chốt và trỏ về đây |
| Ràng buộc | RB-01 (một khối), NFR-21..NFR-25 |
| Trạng thái | Mục 1 do người dùng chốt. Mục 2 là mặc định đi kèm, đổi được mà không cần hỏi lại, nhưng đổi thì sửa tài liệu này. Khung dựng ngày 2026-10-15 ở `source/`; phiên bản đã cài ở mục 6 |
| Điểm còn hở của tài liệu này | CN-1..CN-4, mục 5 |

---

## 1. Đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Ngôn ngữ | TypeScript, cho cả máy chủ và giao diện |
| Môi trường chạy | Node.js 22 LTS |
| Máy chủ | NestJS, **một ứng dụng duy nhất**; mỗi module nghiệp vụ là một module của NestJS |
| Truy cập dữ liệu và migration | Prisma |
| Hệ quản trị cơ sở dữ liệu | PostgreSQL |
| Giao diện | React + Vite, thư viện thành phần Ant Design |
| Hàng đợi và tác vụ nền | BullMQ trên Redis — **tách khỏi cơ sở dữ liệu** |
| Bố cục mã nguồn | Nằm trong repo này: `source/backend` (NestJS) và `source/frontend` (React) — **hai dự án độc lập**, mỗi dự án có `package.json`, tệp khóa và `node_modules` riêng |

## 2. Mặc định đi kèm

| Hạng mục | Lựa chọn | Phục vụ |
|---|---|---|
| Quản lý gói | pnpm, cài và chạy riêng trong từng dự án; không dùng workspace. Không có gói dùng chung: kiểu dữ liệu của giao diện sinh từ đặc tả API | — |
| Nền HTTP của NestJS | Express, mặc định của NestJS | `express-session` chỉ chạy trên Express |
| Đặc tả API | `@nestjs/swagger` sinh đặc tả OpenAPI; `openapi-typescript` sinh kiểu cho `source/frontend` | Giao diện và máy chủ luôn cùng kiểu; bên tích hợp có đặc tả để đọc (FR-94) |
| Kiểm dữ liệu vào | `ValidationPipe` với `class-validator` | NFR-19 |
| Cấu hình kỹ thuật | `@nestjs/config`, biến môi trường được kiểm khi khởi động | NFR-24 (phần kỹ thuật; tham số nghiệp vụ xem CN-4) |
| Phiên đăng nhập | Cookie HttpOnly, phiên lưu trong PostgreSQL (`express-session` + `connect-pg-simple`), tự gia hạn, hết sau 60 phút không thao tác | NFR-08 |
| Mật khẩu | `argon2` (Argon2id) | NFR-06 |
| Đăng nhập Microsoft | `openid-client` với Microsoft Entra ID — chỉ khi Q-13 chọn SSO (CN-2) | Q-13 |
| Phân quyền | Guard đọc `RolePermission` ở máy chủ cho mọi endpoint; guard riêng cho khóa API của bên tích hợp | NFR-09, FR-94 |
| Nhật ký kiểm toán | Tài khoản cơ sở dữ liệu mà ứng dụng dùng không có quyền UPDATE, DELETE trên bảng nhật ký; migration chạy bằng tài khoản khác | NFR-10 |
| Đọc cơ sở dữ liệu của Trường | Thư viện `mssql`, câu SQL viết tay, chỉ đọc, chạy trong tác vụ đồng bộ | FR-98..FR-100 |
| Tác vụ nền | `@nestjs/bullmq`. Một cơ chế chung cho bốn việc chạy theo lịch (K-7) dùng job scheduler của BullMQ, xét tốt nghiệp hàng loạt, nhập Excel, gửi thư | NFR-03, NFR-05, B6 |
| Excel | ExcelJS | NFR-05, xuất khung và báo cáo |
| PDF | Puppeteer: dựng HTML rồi in ra PDF, nhúng phông chữ tiếng Việt | Xuất đề cương, khung chương trình |
| Đồ thị tiên quyết | `@antv/g6` (cùng hệ Ant Design), được người dùng duyệt 2026-10-26; ghim phiên bản khi build F-24 | FR-38, US-110 |
| Thư điện tử | Nodemailer qua SMTP của Trường | Thông báo (B6) |
| Tệp đính kèm | Thư mục trên đĩa máy chủ, gắn vào container của máy chủ ứng dụng, nằm trong phạm vi sao lưu | K-6 |
| Giao diện — dữ liệu và điều hướng | TanStack Query, React Router; `ConfigProvider` của Ant Design đặt ngôn ngữ `vi_VN` | NFR-16, NFR-17, NFR-18, NFR-20 |
| Kiểm thử máy chủ | Vitest, Supertest; e2e chạy trên PostgreSQL và Redis thật của `compose.yaml` (cơ sở dữ liệu `ctdt_e2e_*` riêng, Redis database 1). Bỏ Testcontainers ngày 2026-10-31 để bớt container và RAM trên máy nhóm. Không dùng Jest: NestJS bản ESM chỉ chạy được Jest với cờ thử nghiệm `--experimental-vm-modules` của Node; mẫu ESM chính thức của NestJS dùng Vitest | `docs/planning/test-plan.md` |
| Kiểm thử giao diện | Vitest, React Testing Library | như trên |
| Kiểm tra mã | oxlint (máy chủ bật kiểm theo kiểu, lời hứa bị bỏ quên là lỗi), Prettier | — |
| Môi trường phát triển | `source/backend/compose.yaml` chỉ dựng PostgreSQL và Redis; máy chủ ứng dụng và giao diện chạy trên máy. Vite chuyển `/api` sang máy chủ ứng dụng, cùng một nguồn như khi Caddy phục vụ | — |
| Kiểm thử đầu-cuối | Playwright, chạy trên Chrome, Firefox, Edge | NFR-26 |
| Triển khai | Docker Compose, bốn thành phần: máy chủ ứng dụng, PostgreSQL, Redis, Caddy. Caddy phục vụ bản dựng của giao diện, chuyển `/api` vào máy chủ ứng dụng và cấp HTTPS | NFR-07, NFR-25 |
| Sao lưu | `pg_dump` hằng ngày, giữ 30 bản, kèm thư mục tệp đính kèm; diễn tập phục hồi | NFR-12, NFR-13 |

## 3. Quy tắc phải giữ khi dựng khung

| Quy tắc | Vì sao |
|---|---|
| Cơ sở dữ liệu tạo với quy tắc so sánh tiếng Việt (ICU `vi-VN`). Máy chủ ứng dụng kiểm điều này lúc khởi động và **dừng hẳn nếu sai** | Sai quy tắc so sánh thì sắp xếp, tìm kiếm tên tiếng Việt sai mà không báo lỗi. Prisma không khai báo được quy tắc so sánh của cả cơ sở dữ liệu, nên phải kiểm bằng câu SQL. Repo PLO-CLO dùng đúng cách này |
| Ảnh container của PostgreSQL là bản Debian, không dùng bản Alpine | Bản Alpine thiếu thư viện ICU cần cho tiếng Việt |
| Redis đặt `maxmemory-policy noeviction` và bật ghi AOF | BullMQ đòi Redis không tự xóa khóa; AOF giữ được hàng đợi qua một lần khởi động lại |
| Redis chỉ chứa hàng đợi. Không dữ liệu nghiệp vụ, không phiên đăng nhập | Mất Redis chỉ mất các việc đang chờ, không mất dữ liệu và không đăng xuất mọi người. Vì vậy mọi tác vụ phải chạy lại được mà không sinh kết quả kép (K-7) |
| Việc nặng (xét tốt nghiệp hàng loạt, nhập Excel, xuất PDF) chạy trong worker của BullMQ, không chạy trong lúc xử lý yêu cầu | Node chạy mã trên một luồng; vòng lặp dài trong lúc xử lý yêu cầu làm chậm mọi người dùng khác (NFR-01, NFR-04) |
| Module nghiệp vụ chỉ dùng module khác qua provider mà module đó xuất ra | NFR-21 |

## 4. Đối chiếu yêu cầu phi chức năng

Chỉ các yêu cầu mà lựa chọn công nghệ trả lời trực tiếp. Cách kiểm từng yêu cầu ở `docs/planning/test-plan.md`.

| NFR | Nhờ đâu |
|---|---|
| NFR-03, NFR-05 | Worker BullMQ |
| NFR-06 | Argon2id |
| NFR-07 | Caddy cấp HTTPS |
| NFR-08 | Phiên cookie hết sau 60 phút không thao tác |
| NFR-09 | Guard phân quyền ở máy chủ |
| NFR-10 | Tài khoản ứng dụng không sửa, xóa được bảng nhật ký |
| NFR-12, NFR-13 | `pg_dump` hằng ngày và diễn tập phục hồi |
| NFR-16, NFR-17, NFR-18, NFR-20 | Ant Design với ngôn ngữ `vi_VN`, lưới co giãn, bảng có phân trang, hộp xác nhận |
| NFR-21 | Một ứng dụng NestJS chia module |
| NFR-23 | Migration của Prisma |
| NFR-25 | Docker Compose trên máy chủ của Khoa |
| NFR-26 | Playwright chạy trên ba trình duyệt |

## 5. Điểm còn hở

| Mã | Vấn đề | Lựa chọn tạm | Phụ thuộc vào |
|---|---|---|---|
| CN-1 | Node.js 22 hết hỗ trợ ngày 30/04/2027. Nếu bắt đầu trong tháng 11/2026, 34 tuần của kế hoạch sprint kết thúc khoảng tháng 7/2027, sau ngày đó | Dựng và chạy trên Node.js 22; nâng lên Node.js 24 trước khi cài lên máy chủ Khoa ở B6 | Ngày bắt đầu thật (P-4) |
| CN-2 | Q-13 còn mở: xác thực nội bộ hay SSO của Trường | Luôn có tài khoản nội bộ với Argon2id; thêm Entra ID qua `openid-client` nếu Q-13 chọn SSO | Q-13 |
| CN-3 | Máy chủ của Khoa chưa biết hệ điều hành, bộ nhớ, có chạy được Docker hay không | Docker Compose như mục 2. Puppeteer làm ảnh của máy chủ ứng dụng nặng thêm vì kèm trình duyệt | Khoa cho biết cấu hình máy chủ |
| CN-4 | Tham số nghiệp vụ lưu ở tệp cấu hình hay trong bảng (E-7) | Biến môi trường qua `@nestjs/config`, như K-5 | E-7 |
| CN-5 | ~~Tài liệu này không ghi số phiên bản của từng thư viện~~ | **Đã đóng 2026-10-15:** phiên bản đã cài ở mục 6 | — |

## 6. Phiên bản đã dựng

Bản ổn định mới nhất chạy được trên Node.js 22 tại ngày dựng khung. Số chính xác của mọi gói nằm trong `package.json` và `pnpm-lock.yaml` của từng dự án; bảng này chỉ ghi các bản không lấy bản mới nhất và lý do.

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| NestJS | 12.1 | Chỉ có bản ESM |
| Prisma | 7.10.0, ghim cứng | Bản `latest` trên npm là 8.0.0-rc, chưa phát hành chính thức |
| TypeScript | ~6.0.3 | Không dùng 7.x: `@nestjs/cli` và `@nestjs/swagger` chưa nhận TypeScript 7 |
| PostgreSQL | 18 (ảnh Debian) | |
| Redis | 8 | |
| BullMQ | 6.3 | Dùng Redis qua `ioredis` |
| React | 19.3 | |
| Vite | 8.3 | |
| Ant Design | 6.6 | |
| React Router | 8.4 | Đòi Node.js ≥ 22.22, nên cả hai dự án ghi `engines` là `>=22.22.0 <23` |
| Vitest | 5.0 | Đã kiểm: tiêm phụ thuộc theo kiểu của NestJS chạy đúng dưới Vitest |
