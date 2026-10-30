# Backend — Quản lý Chương trình đào tạo

Một ứng dụng NestJS (TypeScript, ESM), Prisma trên PostgreSQL, hàng đợi BullMQ trên Redis. Lựa chọn công nghệ và lý do ở `docs/design/tech-stack.md`.

## Chạy lần đầu

Cần Node.js 22 (≥ 22.22), pnpm 10, Docker.

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
| `pnpm test:e2e`                           | Kiểm thử đầu-cuối (`test/**/*.e2e-spec.ts`), tự dựng PostgreSQL và Redis bằng Testcontainers — cần Docker đang chạy. Một PostgreSQL + một Redis cho cả lượt chạy (`test/global-setup.ts`): migrate một lần vào cơ sở dữ liệu mẫu, mỗi tệp spec dùng cơ sở dữ liệu riêng chép từ mẫu |
| `pnpm lint`                               | oxlint, có kiểm theo kiểu (lời hứa bị bỏ quên là lỗi)                                                                                                                                                                                                                               |
| `pnpm format` · `pnpm format:check`       | Prettier                                                                                                                                                                                                                                                                            |
| `pnpm prisma:migrate`                     | Tạo và áp migration từ `prisma/schema.prisma`                                                                                                                                                                                                                                       |
| `pnpm prisma:seed`                        | Nạp tài khoản R1, đơn vị, vai trò, quyền, chương trình mẫu, học kỳ và khóa (chạy lại an toàn)                                                                                                                                                                                       |
| `pnpm real:migrate`                       | Áp migrations cho `ctdt_real` qua `.env.real`; thiếu tệp thì dừng |
| `pnpm real:seed`                          | Chạy base seed trong môi trường dữ liệu thật |
| `pnpm real:seed:dut`                      | Nạp JSON DUT vào database thật, không chạy demo seed |
| `pnpm real:dev`                           | Chạy app với database, attachment folder và queue prefix riêng |
| `pnpm services:up` · `pnpm services:down` | Bật · tắt PostgreSQL và Redis                                                                                                                                                                                                                                                       |

## Dữ liệu thật (môi trường riêng)

Trong `source/backend`, sao chép `.env.real.example` thành `.env.real` trên máy mình. Tệp này chỉ override `DATABASE_URL` sang database `ctdt_real`, `FILES_ROOT=files-real` và `BULLMQ_PREFIX=ctdt-real`; các biến khác vẫn lấy từ tệp môi trường mặc định. Không đưa `.env.real` hoặc tệp đính kèm vào git. Thiếu tệp override thì runner dừng, không tự dùng database mặc định.

Database `ctdt_real` phải dùng ICU `vi-VN` như mục bên dưới. Tạo/migrate bằng `pnpm real:migrate`, rồi chạy lần lượt `pnpm real:seed` → `pnpm real:seed:dut`; khởi động bằng `pnpm real:dev`. Đây là chuỗi migrate → base seed → DUT seed, **không chạy `prisma:seed:demo` trên database thật**. JSON được đọc từ `prisma/seed-data/dut/data/`; không cần legacy dump trên máy chạy seed.

Hai môi trường dùng chung Redis nhưng tách queue bằng prefix, tách tệp đính kèm bằng `files-real`. Cùng mặc định port 3000 nên chỉ chạy một app tại một thời điểm, trừ khi override thêm `PORT` trong `.env.real`. Không có script `real:seed:demo`.

## Cơ sở dữ liệu phải dùng quy tắc so sánh tiếng Việt

Lúc khởi động, `PrismaService` kiểm cơ sở dữ liệu được tạo với ICU `vi-VN`; sai thì **dừng hẳn**. `compose.yaml` và Testcontainers đã tạo đúng. Tự tạo cơ sở dữ liệu ở nơi khác thì dùng:

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
