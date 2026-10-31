# Technical Reference

<!--
  FILE PURPOSE   : Configuration, setup, and usage patterns for every library and technical
                   concern in the project.

  WHAT BELONGS   : Library versions, initialization, configuration, code patterns, and
                   constraints to follow.

  WHAT DOES NOT  : Implementation status (→ todo.md), feature design
                   (→ features_architecture.md), schema details (→ database_and_models.md),
                   active work (→ current_work.md).

  UPDATE WHEN    : A new library is added, a configuration changes, or a usage pattern is
                   established.

  FORMAT:
            ## N. Library / Concern Name
            **Library**: `package-name` **Version**: x.y.z
            ### Configuration
            ### Usage Pattern
-->

Lý do chọn và bảng phiên bản: `docs/design/tech-stack.md` §2 và §6. Số chính xác của mọi gói nằm trong `package.json` và `pnpm-lock.yaml` của từng dự án. Tệp này chỉ ghi **cách dùng** đã thiết lập trong mã.

---

## 1. Node.js và pnpm

**Version**: Node.js ≥ 22.22 < 23 (`engines`, `.nvmrc`), pnpm 10.23.0 (`packageManager`)

### Usage Pattern

- Chạy mọi lệnh bên trong `source/backend` hoặc `source/frontend`; không có lệnh ở gốc repo.
- Volta trên máy phát triển đang gắn pnpm 10.23.0 với Node 20 nên in cảnh báo `engines`. Sửa bằng `volta install pnpm@10.23.0` (chưa chạy).

---

## 2. Cấu hình môi trường của máy chủ

**Library**: `@nestjs/config`, `class-validator`, `class-transformer`

### Configuration

`src/shared/config/env.validation.ts` khai báo lớp `Env`; `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`.

### Usage Pattern

- Mỗi biến mới: thêm vào `Env` **kèm kiểu tường minh** (xem error log 2026-10-15), thêm dòng vào bảng biến trong `source/backend/README.md`.
- Đọc bằng `config.get('NAME', { infer: true })` trên `ConfigService<Env, true>`.

| Biến                       | Mặc định                       | Ràng buộc                                                                                                                                                       |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `development`                  | `development` / `test` / `production`                                                                                                                           |
| `PORT`                     | 3000                           | 1..65535                                                                                                                                                        |
| `DATABASE_URL`             | —                              | bắt buộc                                                                                                                                                        |
| `REDIS_HOST`, `REDIS_PORT` | `localhost`, 6379              |                                                                                                                                                                 |
| `SESSION_SECRET`           | —                              | bắt buộc, ≥ 32 ký tự (F-01)                                                                                                                                     |
| `SESSION_IDLE_MINUTES`     | 60                             | số nguyên ≥ 1 (F-01, NFR-08); `AuthenticatedGuard` cũng đo `lastActivityAt` trên phiên, tuyến `@PassiveRequest()` (đếm thông báo chưa đọc) không làm mới (F-14) |
| `FILES_ROOT`               | `files`                        | thư mục tệp đính kèm đề cương và văn bản đề xuất (F-10, F-13); đặt vào ổ bền, sao lưu cùng cơ sở dữ liệu; `/files/` nằm trong `.gitignore`                      |
| `ATTACHMENT_MAX_MB`        | 20                             | giới hạn một tệp đính kèm (F-10)                                                                                                                                |
| `BULLMQ_PREFIX`            | không đặt (BullMQ dùng `bull`) | tiền tố khóa Redis của hàng đợi; chỉ đặt khi dùng chung Redis (F-15)                                                                                            |

`SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` chỉ dành cho `prisma/seed.ts`, đọc trực tiếp từ `process.env`, không có trong `Env`.

---

## 3. Prisma

**Library**: `prisma`, `@prisma/client`, `@prisma/adapter-pg` **Version**: 7.10.0 (ghim cứng)

### Configuration

- Generator `prisma-client`, `moduleFormat = "esm"`, sinh vào `src/generated/prisma`; import từ `../generated/prisma/client.js`.
- `prisma.config.ts` đọc `process.env.DATABASE_URL` trực tiếp, không qua `env()` (xem error log 2026-10-15).
- `PrismaService extends PrismaClient`, nối qua `PrismaPg`; `onModuleInit` kiểm cơ sở dữ liệu dùng ICU `vi-VN`, sai thì dừng.

### Usage Pattern

- Model `PascalCase` số ít, trường `camelCase`, tên theo `docs/design/naming-map.md`.
- Thay đổi lược đồ: sửa `schema.prisma` → `pnpm prisma:migrate` → ghi vào `docs/architecture/database_and_models.md`.
- Nhiều bảng trong một thao tác: `$transaction`.
- Seed: `pnpm prisma:seed` chạy `tsx prisma/seed.ts` (khai ở `migrations.seed` trong `prisma.config.ts`); `tsx` là phụ thuộc phát triển.
- Không có cơ sở dữ liệu chạy sẵn thì migration có thể sinh bằng `prisma migrate diff --from-empty` (cách làm của `20261018141101_auth_session`); một thư mục migration rỗng làm `migrate deploy` lỗi P3015.

### Usage Pattern — DUT legacy seed

Chạy trong `source/backend`:

| Script                 | Input / output                                                                                                                                                                                       | Điều kiện                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dut:extract`     | Chạy `prisma/seed-data/dut/extract/extract.ts`, đọc sáu bảng curriculum/danh mục allow-listed trong legacy dump; ghi `catalog.json`, `programs.json`, `report.json` tại `prisma/seed-data/dut/data/` | Chỉ máy có legacy dump mới cần chạy; không chạm database                                                    |
| `pnpm prisma:seed:dut` | Chỉ đọc `catalog.json`, `programs.json` đã sinh, nạp catalog và CTĐT; không đọc dump                                                                                                                 | Áp migrations và chạy `pnpm prisma:seed` trước; cần university/faculty và publisher R1 SYSTEM của base seed |

Ba JSON tại `source/backend/prisma/seed-data/dut/data/` là **artefact duy nhất từ legacy dump được mang ra ngoài**: chỉ dữ liệu CTĐT và danh mục hỗ trợ, không có dữ liệu cá nhân hoặc credentials. Không sao chép markdown dump hay các bảng hồ sơ sinh viên/giảng viên; `report.json` phục vụ rà soát counts/codes và các record bị bỏ. Máy chạy loader chỉ cần JSON, không cần giữ dump. Các module đọc/nạp JSON nằm tại `prisma/seed-data/dut/load/`; `dut-data.ts` và `legacy-mapping.ts` ở root `dut/` để dùng chung cho extract/load. `DEFAULT_LEGACY_ROOT` vẫn tương đối với working directory `source/backend`, không phải vị trí module.

Giữ database Playwright `ctdt-dev-pg` tách khỏi lượt thử DUT seed vì dữ liệu thêm có thể đổi counts/pagination. Base/demo seed không bị thay thế; ngày semester hiện hữu và program đã có được giữ nguyên. Chi tiết quy tắc ghi tại `docs/architecture/database_and_models.md` §Seed CTĐT DUT legacy.

### Usage Pattern — Runner cho môi trường dữ liệu thật

`tsx scripts/with-env.ts <env-file> <command> [args...]` dùng `dotenv.parse` và merge `{ ...process.env, ...fileValues }` (file thắng), rồi spawn một command string với `shell: true`, `stdio: 'inherit'`; trả child exit code, signal → 1. Thiếu args → usage / exit 2; thiếu tệp → thông báo sao chép `<env-file>.example` / exit 1, không fallback database. `dotenv/config` của child không ghi đè biến có sẵn; `@nestjs/config` cũng ưu tiên environment nên chỉ cần override các khóa khác mặc định.

Người dùng tự sao chép `.env.real.example` thành `.env.real`: `DATABASE_URL` trỏ `ctdt_real`, `FILES_ROOT=files-real`, `BULLMQ_PREFIX=ctdt-real`; các biến khác kế thừa cấu hình mặc định. `.env.real` và `/files-real/` bị gitignore; các example vẫn có thể tracked. Chạy `pnpm real:migrate` → `pnpm real:seed` → `pnpm real:seed:dut`, rồi `pnpm real:dev`; không chạy demo seed trên database thật và không có `real:seed:demo`. Database phải dùng ICU `vi-VN`; Redis dùng chung nhưng queue prefix/tệp đính kèm tách riêng, port 3000 dùng chung trừ khi override thêm `PORT` nên mặc định chỉ chạy một app tại một thời điểm. Lệnh chi tiết ở `source/backend/README.md`.

---

## 4. HTTP, kiểm dữ liệu vào, OpenAPI

**Library**: `@nestjs/platform-express`, `@nestjs/swagger`, `class-validator`

### Configuration

`configureApp` (`src/app.setup.ts`): tiền tố `api`, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, Swagger ở `/api/docs`, JSON ở `/api/docs-json`.

### Usage Pattern

- `configureApp` dùng chung cho `main.ts` và kiểm thử đầu-cuối — thêm cấu hình toàn cục vào đó, không vào `main.ts`.
- Mọi DTO trả về có `@ApiProperty`, kể cả `enum`, để `openapi-typescript` sinh đúng kiểu hợp.

---

## 5. Phiên, CSRF, mật khẩu

**Library**: `express-session` 1.19, `connect-pg-simple` 10, `pg` 8, `argon2` 0.45

### Configuration

- `SessionStoreService` (`src/shared/session/`) dựng một handler `express-session` dùng chung: store `connect-pg-simple`, bảng `session` (`createTableIfMissing: false`), cookie `ctdt.sid` HttpOnly, `rolling: true`, `maxAge` = `SESSION_IDLE_MINUTES` phút; `configureApp` gắn handler và đặt `trust proxy` 1 bước.
- `PasswordService` băm Argon2id; `argon2` là gói native.

### Usage Pattern

- Đăng nhập dùng `regenerate`, đăng xuất dùng `destroy` qua `session-lifecycle.ts` — không gọi callback của `express-session` trực tiếp.
- Route công khai đánh `@Public()`; route phải gọi được khi đang bị buộc đổi mật khẩu đánh `@AllowPendingPasswordChange()`.
- Giao diện gửi `X-Requested-With: XMLHttpRequest` trên mọi yêu cầu (`src/shared/api/client.ts`); kiểm thử đầu-cuối gửi yêu cầu ghi phải tự thêm header này.
- Thân yêu cầu chỉ chứa trường của DTO: `forbidNonWhitelisted` trả 400 cho trường thừa, kể cả trong kiểm thử.

---

## 6. Hàng đợi

**Library**: `@nestjs/bullmq`, `bullmq` 6.3, `ioredis`

### Configuration

`QueueModule`: `BullModule.forRootAsync` lấy `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB` (mặc định 0; e2e dùng database 1 riêng). Redis chạy `noeviction` và AOF (`compose.yaml`).

### Usage Pattern

- Redis chỉ chứa hàng đợi; mọi job phải chạy lại được mà không sinh kết quả kép.
- Tên hàng đợi là hằng số; một processor cho một hàng đợi.
- `release-activation` (F-15, `src/features/releases/`): `ReleaseActivationScheduler` đăng ký lịch lặp cron `RELEASE_ACTIVATION_CRON` (00:05) theo `APP_TIME_ZONE` (`Asia/Ho_Chi_Minh`) và một tác vụ lúc khởi động; `ReleaseActivationProcessor` gọi `VersionActivator` chuyển phiên bản `PENDING` đến học kỳ hiệu lực thành `ACTIVE` — idempotent, chạy lại không đổi gì. Khi tắt, worker chờ tác vụ đang chạy tối đa 10 giây rồi `close(true)` (đóng nhẹ treo vô hạn khi Redis chết).

---

## 7. Giao diện

**Library**: React 19.3, Vite 8.3, `antd` 6.6, `@tanstack/react-query` 5, `react-router` 8.4, `openapi-typescript` 7.13; `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2 (cố định phiên bản; kéo thả dòng khung bằng chuột và bàn phím, AntD 6 `Table` không có sẵn — D15 của F-07)

### Usage Pattern

- `getJson<T>(path, acceptedStatuses)` và `sendJson<T>` trong `src/shared/api/client.ts`; mã lỗi khác ném `ApiError` mang `ErrorResponseDto`. 401 `SESSION_REQUIRED` được `queryClient.ts` bắt chung và đặt `me` về `null`.
- Sau khi máy chủ đổi DTO: chạy máy chủ, `pnpm api:types` (đọc `http://localhost:3000/api/docs-json`), đưa `src/shared/api/schema.d.ts` vào git.
- Thông báo, hộp xác nhận: dùng `App.useApp()` của Ant Design (đã bọc `AntApp` ở `main.tsx`).
- Tệp: `sendForm` (multipart), `downloadFile`, `fileNameFromHeader` trong `client.ts` (F-10; F-09 dùng lại).

---

## 7a. Văn bản định dạng, tệp tải lên (F-10)

**Library**: frontend `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/pm` 3.31.4 (cố định); backend `sanitize-html` 2.18.0 (+ `@types/sanitize-html`), `@types/multer` 2.3.0 (khai trong `types` của `tsconfig.json`)

### Usage Pattern

- Trình soạn thảo dùng chung ở `src/shared/components/rich-text/` (`RichTextEditor`, `RichTextToolbar`, `richTextExtensions`): đậm, nghiêng, danh sách, bảng, liên kết.
- Máy chủ lọc **mọi** văn bản định dạng bằng `sanitizeRichText` (`src/shared/rich-text/`, chính sách `RICH_TEXT_POLICY`, cho phép `rel`, `target` trên `a`) trước khi ghi; `richTextToPlain` khi cần chữ thuần (so sánh, thông báo). Không ghi HTML chưa lọc.
- Tải lên: `FileInterceptor` của Multer giữ tệp trong bộ nhớ (không truyền `storage`, vì pnpm không cho import `multer` trực tiếp); `FileStorageService` (`src/shared/files/`) ghi dưới `FILES_ROOT` với đường dẫn tương đối dùng `/`; `uploadedFileName` sửa tên tệp UTF-8; `sendFile` trả tệp kèm `Content-Disposition`. Quá `ATTACHMENT_MAX_MB` → 413 `PAYLOAD_TOO_LARGE`.

---

## 8. Kiểm thử

| Dự án                     | Công cụ                                                                               | Lệnh                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| backend, đơn vị           | Vitest                                                                                | `pnpm test`                                                                                                         |
| backend, đầu-cuối         | Vitest + Supertest, PostgreSQL/Redis của `compose.yaml`                        | `pnpm services:up` rồi `pnpm test:e2e`                                                                                      |
| frontend                  | Vitest + React Testing Library, jsdom                                                 | `pnpm test`                                                                                                         |
| `source/e2e`, trình duyệt | Playwright; dự án pnpm độc lập thứ ba, `package.json`, lockfile, `node_modules` riêng | Tại `source/e2e`: `pnpm typecheck`; chạy một spec: `pnpm exec playwright test specs/<file>.spec.ts --reporter=list` |

Playwright chạy trên app dev đang hoạt động, có demo seed: backend `http://localhost:3000/api`, frontend `http://localhost:5173`; không thay thế kiểm thử e2e backend. Auth setup một lần cho mỗi vai R1..R6 (+R3b, R4b, R5b), lưu phiên qua `storageState`. Chỉ mục ca kiểm thử: `docs/testing/test-cases/README.md`; cài đặt và cách chạy: `docs/testing/playwright-guide.md`.

### Usage Pattern

- Kiểm thử đầu-cuối tạo cơ sở dữ liệu ICU `vi-VN` qua `test/containers.ts`; kiểm thử mới dùng lại hàm ở đó.
- Một PostgreSQL và một Redis cho cả lượt chạy (`test/global-setup.ts`, `globalSetup` của Vitest): migrate một lần vào cơ sở dữ liệu mẫu, mỗi tệp spec nhận cơ sở dữ liệu riêng chép từ mẫu; `test/test-env.ts` đặt biến môi trường (kể cả `FILES_ROOT` tạm cho từng tệp). Fixture dùng chung ở `test/fixtures/`; bảng quyền theo tuyến ở `test/permission-table.ts` — thêm dòng cho mỗi tuyến mới.
- Kiểm thử giao diện giả `fetch` bằng `vi.stubGlobal` và bọc `QueryClientProvider` với `retry: false` (mẫu: `HealthPage.test.tsx`).
- `src/test/setup.ts` giả `ResizeObserver` (jsdom không có, AntD `Select` cần); kiểm thử mới dùng `Select` không phải tự giả.
- AntD `Typography.Link` không có `href` thì không mang vai trò `link`; tìm bằng chữ hoặc `td a`, không `getByRole('link')`.
- Tương tác người dùng trong kiểm thử giao diện dùng `fireEvent`; `@testing-library/user-event` không phải phụ thuộc.
- Cổng 6379 trên máy phát triển có thể đã bị dự án khác chiếm; khi đó `docker compose up` cần đặt `REDIS_PORT` khác.

---

## 9. Kiểm tra mã

oxlint (`pnpm lint`; máy chủ bật `--type-aware`, lời hứa bị bỏ quên là lỗi), Prettier (`pnpm format`). Kiểm kiểu: `pnpm exec tsc --noEmit -p tsconfig.json` (backend), `pnpm exec tsc -b` (frontend).

## 10. Excel XLSX và truyền tệp (F-09)

- Backend dùng dependency trực tiếp exceljs 4.4.0 (CommonJS), nạp bằng `import ExcelJS from 'exceljs'` trong `source/backend/src/features/imports/sheets/sheet-reader.ts` và `source/backend/src/features/imports/sheets/sheet-writer.ts`. Khi đọc, tạo ArrayBuffer sở hữu từ bytes bằng new Uint8Array(content).buffer; không ép kiểu để vượt khác biệt Buffer của types.
- `source/backend/src/features/imports/import.constants.ts` quy định FILE_MAX_BYTES = 5 * 1024 * 1024, tối đa 2000 dòng; phía frontend `source/frontend/src/features/imports/constants/importLabels.ts` giữ IMPORT_FILE_MAX_BYTES cùng giá trị và chỉ nhận .xlsx. Kiểm phía client để tránh upload vô ích; giới hạn backend và HTTP 413 mới có tính quyết định.
- FileInterceptor của @nestjs/platform-express dùng lưu trữ bộ nhớ mặc định, một file mỗi request. @types/multer chỉ cung cấp kiểu Express.Multer.File; multer không là dependency trực tiếp, không import memoryStorage từ gói bắc cầu (pnpm strict layout).
- Mẫu mặc định dùng nhãn SRS 4.3, chưa xác nhận tệp Excel thật của Khoa. Giữ tên cột ở SheetSpec; header sai tạo batch ABORTED/report và trả HTTP 201, không đổi thành HTTP 400. Content-Disposition giữ tên UTF-8 để tải lại không hỏng tiếng Việt.
- Client dùng sendForm/downloadFile hiện có; không tự đặt multipart Content-Type để browser gắn boundary. Playwright tải mẫu/bản xuất từ app, không thêm thư viện sửa XLSX; round trip sang bản sao được backend e2e chuẩn bị metadata khớp đích.
- Queue imports dùng chung BULLMQ_PREFIX; shutdown phải force-close cả worker và backend queue sau grace tối đa 10 giây, trước hook close của Nest, để Redis QUIT không treo khi Redis đã dừng.

## 11. Số thập phân tỷ trọng (F-12)

- API truyền tỷ trọng, ngưỡng và điểm liệt dạng chuỗi thập phân (`toWireDecimal`), không dùng số JSON.
- Frontend (`features/syllabi/utils/gradeFormulaValues.ts`) cộng tỷ trọng theo phần trăm nguyên (hundredths) để tổng 100 chính xác, nhận dấu phẩy khi nhập và gửi chuỗi chuẩn hóa; không thêm thư viện.
- Form tải lại từ máy chủ dùng khóa dựng lại gắn với `updatedAt` (`hooks/useEditorRemountKey.ts`): chỉ dựng lại khi trình sửa chưa có dữ liệu nhập.

## 12. Mã hóa bàn giao tài khoản và đối soát sinh viên (F-17)

**Library**: `node:crypto` (Node.js tích hợp), `exceljs`, `bullmq`; không thêm thư viện mã hóa riêng.

### Configuration

- `STUDENT_CREDENTIAL_ENCRYPTION_KEY` là biến tùy chọn, chuỗi base64 giải mã thành đúng 32 byte. `Env` dùng `@IsOptional()` và `@Matches(CREDENTIAL_KEY_PATTERN)`: thiếu biến vẫn khởi động được, nhưng giá trị có mặt sai định dạng bị chặn lúc kiểm môi trường. Không ghi giá trị khóa vào tài liệu, log hoặc báo cáo import.
- `credentialKeyFrom` kiểm lại độ dài sau giải mã khi sử dụng; thiếu khóa hoặc độ dài không hợp lệ ném HTTP 503 `STUDENT_CREDENTIALS_UNAVAILABLE`. `ImportsService.create` kiểm ngay với mọi `STUDENT_LIST` trước khi đọc sheet/tạo batch; `commit` kiểm lại trước khi đổi sang `COMMITTING`, không chỉ khi tệp có sinh viên mới. `ACADEMIC_RESULT` không phụ thuộc khóa này. Worker chỉ gọi mã hóa khi thực sự có tài khoản mới; không được bỏ qua phát hành thông tin tài khoản để nhập hồ sơ thành công một phần.
- `STUDENT_CREDENTIALS` quy định AES-256-GCM, IV ngẫu nhiên 12 byte, authentication tag 16 byte, TTL 24 giờ. AAD gắn `batchId` với người thực hiện; `keyId` là 16 ký tự hex đầu của SHA-256 khóa, chỉ là fingerprint, không phải khóa dự phòng.
- Queue `student-enrollment` dùng chung cấu hình Redis/BullMQ; scheduler `student-enrollment-daily` chạy `10 0 * * *` theo `Asia/Ho_Chi_Minh`, thêm một job khởi động với ID mới mỗi lần để job hoàn tất cũ không nuốt lượt chạy. Retry 3 lần, backoff 5 giây; Redis chỉ giữ lịch/job, dữ liệu quyết định đọc từ PostgreSQL.

### Usage Pattern

- `StudentAccountProvisioner` chuẩn hóa mã sinh viên, dùng username chữ thường, sinh mật khẩu tạm và hash bằng `PasswordService` trước khi khóa transaction. XLSX bàn giao chỉ chứa mã sinh viên, username và mật khẩu tạm; `StudentCredentialDelivery` giữ bản mã, không giữ khóa.
- Tải bản bàn giao là POST có CSRF, không dùng GET/prefetch. `consume` kiểm chủ phiên và quyền hiện tại, khóa hàng `FOR UPDATE`, rồi xóa `ciphertext`/`iv`/`authTag`/`keyId` và ghi `downloadedAt` trong transaction. HTTP response đặt `Cache-Control: no-store`; đã tiêu thụ thì không có cơ chế tải lại nếu truyền tệp thất bại phía client.
- Bản đã tải trả `CREDENTIALS_ALREADY_DOWNLOADED`; hết hạn hoặc thiếu thành phần payload trả `CREDENTIALS_EXPIRED`. Thiếu khóa lúc giải mã vẫn trả `STUDENT_CREDENTIALS_UNAVAILABLE`; khóa khác nhưng hợp lệ, AAD sai hoặc bản mã bị sửa trả `CREDENTIALS_UNREADABLE`. Không có vòng khóa cũ để giải mã sau xoay khóa. API trạng thái chỉ xét payload, hạn và dấu tải, không thử giải mã để bảo đảm khóa hiện tại dùng được.
- Quét `imports-sweep` gọi `purgeExpired`, chỉ xóa payload mã hóa và giữ metadata bàn giao. Không dùng tệp XLSX mật khẩu rõ làm báo cáo import hay lưu dưới `FILES_ROOT`.
- Ghi quá trình học dùng khóa chương trình/sinh viên/quá trình học cùng token thời gian; `EnrollmentReconciler` chạy transaction `Serializable`, còn bộ đọc kết quả dùng `RepeatableRead` khi không nhận transaction từ caller. Điểm nguồn gửi Decimal dạng chuỗi; miễn học và đang học giữ nguyên trạng thái, không tự chuyển thành điểm hoặc trượt.

## 13. Script khám phá CSDL Trường (school-discovery)

**Library**: `mssql` (dependency sẵn có), `bcp` CLI, Docker (container `dut-mirror`, SQL Server 2022, volume `dut-mirror-mssql`).

### Usage Pattern

- Mục đích: khám phá chỉ đọc SQL Server đào tạo của Trường, sao lưu cục bộ để thiết kế lại schema. Script độc lập tại `source/backend/scripts/school-discovery/` (`connection`, `catalog`, `classify`, `mirror`, `export-csv`, `profile`), không thuộc `src/`.
- Chạy từ `source/backend`: `pnpm exec tsx scripts/school-discovery/<tên>.ts`. Cấu hình (kết nối, tài khoản A/B) đọc từ `D:\dut-mirror\.env` ngoài repo; không ghi thông tin kết nối vào repo hay tài liệu.
- Cần `bcp` CLI và Docker. Dữ liệu (bản sao, CSV) chỉ nằm ở `D:\dut-mirror`, không bao giờ commit. Chỉ `tmDiemkyhoc` được lọc theo sinh viên Khoa CNTT. Kết quả: [dut-school-db-discovery](../reference/dut-school-db-discovery.md).
