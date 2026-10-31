# Backend — Quản lý Chương trình đào tạo

Một ứng dụng NestJS (TypeScript, ESM), Prisma trên PostgreSQL, hàng đợi BullMQ trên Redis. Lựa chọn công nghệ và lý do ở `docs/design/tech-stack.md`.

## Chạy lần đầu

Cần Node.js 22 (≥ 22.22), pnpm 10, Docker.

**Một lệnh (khuyên dùng):** `pnpm dev:setup` trong `source/backend` (chạy được cả trước `pnpm install`). Script `scripts/dev-setup.mjs` tạo `.env` từ `.env.example` (sinh `SESSION_SECRET`), dựng PostgreSQL 18 + Redis 8 + Mailpit bằng Docker, cài thư viện backend/frontend/e2e, áp migration, seed vai trò/admin và danh mục DUT công khai. Chạy lại an toàn. Hạ tầng chạy trong Docker; ứng dụng chạy trên máy bằng `pnpm dev`. Dữ liệu cá nhân (`prisma/seed-data/dut/data/private/`) không có trong git — thiếu thì seed bỏ qua phần giảng viên/sinh viên.

Làm tay từng bước:

1. `pnpm install` — tự chạy `prisma generate`.
2. `pnpm services:up` — dựng PostgreSQL 18 và Redis 8 từ `compose.yaml`, chờ đến khi cả hai sẵn sàng.
3. Tạo tệp `.env` cạnh `package.json` với các biến ở bảng dưới (giá trị mẫu khớp `compose.yaml`).
4. `pnpm dev` — API ở `http://localhost:3000/api`, tài liệu API ở `http://localhost:3000/api/docs`.
5. Kiểm tra: `GET /api/health` trả `200 {"status":"ok","database":"up","redis":"up"}`.

| Biến                   | Giá trị mẫu                                  | Bắt buộc                            |
| ---------------------- | -------------------------------------------- | ----------------------------------- |
| `NODE_ENV`             | `development`                                | Không, mặc định `development`       |
| `PORT`                 | `3000`                                       | Không, mặc định `3000`              |
| `DATABASE_URL`         | `postgresql://ctdt:ctdt@localhost:5432/ctdt` | Có                                  |
| `REDIS_HOST`           | `localhost`                                  | Không, mặc định `localhost`         |
| `REDIS_PORT`           | `6379`                                       | Không, mặc định `6379`              |
| `REDIS_DB`             | `0`                                          | Không, mặc định `0`; e2e dùng `1`   |
| `SESSION_SECRET`       | chuỗi ngẫu nhiên ≥ 32 ký tự                  | Có                                  |
| `SESSION_IDLE_MINUTES` | `60`                                         | Không, mặc định `60`                |
| `FILES_ROOT`           | `files` (thư mục tệp đính kèm; cần sao lưu)  | Không, mặc định `files`             |
| `ATTACHMENT_MAX_MB`    | `50`                                         | Không, mặc định `50`                |
| `BULLMQ_PREFIX`        | `ctdt` (tiền tố khóa Redis của hàng đợi)     | Không, mặc định `bull` của BullMQ   |
| `SEED_ADMIN_USERNAME`  | `admin`                                      | Chỉ khi chạy seed, mặc định `admin` |
| `SEED_ADMIN_PASSWORD`  | mật khẩu tạm ≥ 8 ký tự, có chữ và số         | Chỉ khi chạy seed                   |

Biến sai kiểu hoặc thiếu giá trị bắt buộc thì ứng dụng dừng ngay khi khởi động (`src/shared/config/env.validation.ts`).

## Lệnh

| Lệnh                                      | Việc                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                | Chạy và tự nạp lại khi sửa mã. Biên dịch bằng SWC (dưới 1 giây), **không kiểm kiểu** — chạy `pnpm typecheck` hoặc xem lỗi trong trình soạn thảo                                                                                                                                     |
| `pnpm typecheck`                          | Kiểm kiểu toàn bộ `src` bằng `tsc` (~15 s)                                                                                                                                                                                                                                          |
| `pnpm dev:tsc`                            | Như `pnpm dev` nhưng biên dịch bằng `tsc` có kiểm kiểu (chậm, 20 s – vài phút)                                                                                                                                                                                                      |
| `pnpm build` · `pnpm start`               | Biên dịch ra `dist/` · chạy bản đã biên dịch                                                                                                                                                                                                                                        |
| `pnpm test`                               | Kiểm thử đơn vị (`src/**/*.spec.ts`), không cần Docker                                                                                                                                                                                                                              |
| `pnpm test:e2e`                           | Kiểm thử đầu-cuối (`test/**/*.e2e-spec.ts`), dùng chung PostgreSQL và Redis của `compose.yaml` — chạy `pnpm services:up` trước. `test/global-setup.ts` migrate một lần vào cơ sở dữ liệu mẫu `ctdt_e2e_template`, mỗi tệp spec dùng cơ sở dữ liệu `ctdt_e2e_*` chép từ mẫu; Redis dùng database 1 riêng. Trước và sau lượt chạy xóa hết `ctdt_e2e_*` và database Redis 1; không đụng `ctdt_real`. Mặc định 2 tệp song song (`E2E_WORKERS` để tăng). Ghi đè nơi kết nối: `E2E_POSTGRES_ADMIN_URL`, `E2E_REDIS_HOST`, `E2E_REDIS_PORT` |
| `pnpm lint`                               | oxlint, có kiểm theo kiểu (lời hứa bị bỏ quên là lỗi)                                                                                                                                                                                                                               |
| `pnpm format` · `pnpm format:check`       | Prettier                                                                                                                                                                                                                                                                            |
| `pnpm prisma:migrate`                     | Tạo và áp migration từ `prisma/schema.prisma`                                                                                                                                                                                                                                       |
| `pnpm prisma:seed`                        | Nạp tài khoản R1, đơn vị, vai trò, quyền, học kỳ và khóa (chạy lại an toàn)                                                                                                                                                                                                         |
| `pnpm services:up` · `pnpm services:down` | Bật · tắt PostgreSQL và Redis                                                                                                                                                                                                                                                       |

## Dữ liệu thật

Chỉ có một database: `ctdt_real`, dùng ICU `vi-VN` như mục dưới. Thứ tự dựng: `pnpm prisma:migrate` → `pnpm prisma:seed` (base) → `pnpm dut:extract` (cần dump trường ở `source/current-data-dut/`, không có trong git) → `pnpm prisma:seed:dut`. Không có seed demo. Dữ liệu cá nhân trích ra nằm trong `prisma/seed-data/dut/data/private/` (gitignored). Test e2e Playwright chạy trên chính database này bằng tài khoản `e2e.*` và tự dọn sau khi chạy: `globalSetup` gọi `pnpm e2e:world` (cần `E2E_PASSWORD`), `globalTeardown` gọi `pnpm e2e:purge`.

## Cơ sở dữ liệu phải dùng quy tắc so sánh tiếng Việt

Lúc khởi động, `PrismaService` kiểm cơ sở dữ liệu được tạo với ICU `vi-VN`; sai thì **dừng hẳn**. `compose.yaml` đã tạo đúng; e2e tạo cơ sở dữ liệu mẫu cũng với ICU `vi-VN`. Tự tạo cơ sở dữ liệu ở nơi khác thì dùng:

```sql
CREATE DATABASE ctdt LOCALE_PROVIDER icu ICU_LOCALE 'vi-VN' LOCALE 'C.UTF-8' TEMPLATE template0;
```

Quy tắc so sánh chỉ đặt được lúc tạo cơ sở dữ liệu. Cơ sở dữ liệu cũ tạo sai phải xóa đi tạo lại (`pnpm services:down -v` xóa cả dữ liệu).

## Quy ước

| Mục                         | Quy ước                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tên trong mã, bảng, cột     | Tiếng Anh, theo `docs/design/naming-map.md` và `docs/design/data-dictionary.md`. Model Prisma `PascalCase` số ít, trường `camelCase`                            |
| Chữ hiển thị cho người dùng | Tiếng Việt                                                                                                                                                      |
| Tệp                         | `kebab-case.<vai-trò>.ts`: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, kiểm thử `*.spec.ts` cạnh tệp được kiểm, đầu-cuối `test/*.e2e-spec.ts` |
| Module nghiệp vụ            | Một thư mục dưới `src/` cho mỗi module. Module khác chỉ dùng provider mà module đó `exports`                                                                    |
| Import                      | Đường dẫn tương đối có đuôi `.js` (ESM của Node đòi)                                                                                                            |
| Hằng số                     | Không viết số hay chuỗi lặp lại trực tiếp; đặt tên hằng hoặc dùng đối tượng `as const` như `HealthStatus`                                                       |
| Bảng mới                    | Thêm model vào `prisma/schema.prisma` cùng việc đầu tiên cần nó, rồi `pnpm prisma:migrate`                                                                      |
| Việc nặng                   | Chạy trong worker BullMQ, không chạy trong lúc xử lý yêu cầu HTTP                                                                                               |
