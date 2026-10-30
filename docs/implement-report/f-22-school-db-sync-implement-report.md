# F-22 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu (2026-10-31)**: BE (schema, migration, runner, scheduler, reader SQL Server, applier, API) và FE (MH-12 cấu hình, MH-13 lịch sử, chi tiết lần đồng bộ) đã có mã và test. Nhánh `feat/f-22-school-db-sync`.
- **Nguồn dữ liệu**: chỉ bản mô phỏng SQL Server 2022 (compose profile `school-db-sim`) với dữ liệu tổng hợp. Chưa kết nối CSDL thật của Trường.
- **Cơ sở dữ liệu dev**: migration `20261030184024_school_db_sync` và `20261030184500_school_db_sync_checks` đã áp dụng lên `ctdt_real`. Không chạy đồng bộ thật trên `ctdt_real` (sẽ ghi sinh viên tổng hợp vào dữ liệu thật).
- **Bằng chứng**:
  - BE e2e `test/school-db-sync.e2e-spec.ts` 14/14 (reader giả lập).
  - BE e2e `test/school-db-sync-sqlserver.e2e-spec.ts` 3/3 trên bản mô phỏng thật (sa → READ_ONLY_REQUIRED, sai mật khẩu → CONNECTION_FAILED, tài khoản chỉ đọc commit 25 sinh viên + 25 kết quả + 1 lớp). Test này tự bỏ qua khi thiếu biến `SCHOOL_DB_SIM_*`.
  - BE unit lịch chạy (`school-sync.schedule.spec.ts`), tsc 0, oxlint sạch.
  - FE vitest `features/school-db-sync` 8/8, `tsc -b` 0, oxlint sạch; ảnh chụp MH-12/MH-13 bằng `ui.viewer` ở 1280 px.

## Bảng tổng hợp

| ID | File | Kiểm chứng |
|---|---|---|
| BE-01 | `prisma/schema.prisma`, 2 migration | `migrate dev` đồng bộ; CHECK + unique từng phần cho một lần chạy |
| BE-02 | `school-sync.{constants,errors,schedule,cipher}.ts` | unit lịch chạy; AES-256-GCM cho mật khẩu |
| BE-03 | `school-source.reader.ts` (`mssql`) | e2e SQL Server 3/3 |
| BE-04 | `school-snapshot.{translator,applier}.ts` | e2e: thành công, xung đột, dữ liệu sai không ghi gì |
| BE-05 | `school-sync.runner.ts`, `school-sync.processor.ts` | e2e: chồng lần chạy 409, quá hạn bị chặn, lịch chạy đúng một lần |
| BE-06 | `school-sync.service.ts`, `school-sync.controller.ts`, DTO | e2e: 403 ngoài R1, mật khẩu chỉ ghi, allowlist máy chủ |
| BE-07 | `compose.yaml` profile, `scripts/school-db-sim/*` | seed dữ liệu tổng hợp; dừng container sau test |
| FE-01..03 | `features/school-db-sync/*`, route, menu, quyền `sync.configure` | vitest 8/8; ảnh chụp |

## Quyết định trong lúc build (lệch so với plan)

- **Tái dùng pipeline F-17**: dòng của Trường được dịch sang `SheetRow` dạng Excel rồi chạy qua validator và writer dùng chung với nguồn `SCHOOL_DB`, actor null. Không có pipeline ghi thứ hai.
- **Ánh xạ**: lưu `targetCode` thay vì 4 khóa ngoại; mã đích được kiểm khi lưu và trong mỗi lần chạy. Mã không có ánh xạ được dùng nguyên văn; mã không tồn tại làm lần chạy thất bại.
- **Không có `SchoolStudentLink`/`SchoolResultLink`**: khóa tự nhiên là mã sinh viên và bộ (sinh viên, học phần, học kỳ).
- **Import liên feature** từ `features/imports/validation` (validator, loader).
- **Hồ sơ mới từ CSDL Trường không có tài khoản** (`userId` null), chờ quyết định cấp tài khoản sinh viên.

## Cổng còn mở (cần Khoa/Trường)

- **E1**: lược đồ thật của CSDL Trường; hiện dùng hợp đồng view `cms_sync_v1` tự định nghĩa.
- **E2**: chính sách tài khoản cho sinh viên được đồng bộ.
- **E3**: nguồn lớp học phần thật.
- **E4**: Khoa nghiệm thu luồng ưu tiên dữ liệu Trường hơn Excel.
- Cấp quyền truy cập máy chủ thật: thêm host vào `SCHOOL_SYNC_EXTERNAL_HOSTS` và đặt `SCHOOL_SYNC_ENCRYPTION_KEY` trong `.env` cục bộ.
