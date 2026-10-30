# F-21 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu (2026-10-31)**: API chỉ đọc `/api/v1` (6 tài nguyên), xác thực bằng khóa riêng, giới hạn theo phút, nhật ký gọi chỉ-ghi-thêm, tài liệu OpenAPI riêng và màn hình MH-11 cho R1 đã có mã và test. Nhánh `feat/f-21-ddut-api`.
- **Migration** `20261030192718_ddut_integration_api`: chỉ thêm 3 bảng mới (`IntegrationClient`, `IntegrationRateWindow`, `IntegrationCallLog`), enum `IntegrationClientStatus`, các CHECK và trigger chặn UPDATE/DELETE trên nhật ký gọi. Không đổi bảng học vụ. **Không gói mới.**
- **Bằng chứng**:
  - BE e2e `test/ddut-api.e2e-spec.ts` 6/6; chạy cùng student-portal, graduation, registration-eligibility, students, student-version-resolution: 65/65.
  - BE unit `src/shared/{integration-access,students,graduation,authz}` + `features/{student-portal,graduation}`: 396/396.
  - FE vitest `features/integration-clients` 6/6; `tsc -b` 0; oxlint sạch.
  - Playwright `f-21-ddut-api.spec.ts` 2/2 (R1 tạo, nhận khóa một lần, gọi API không cookie, khóa → 401); purge dọn sạch bên tích hợp và nhật ký của nó.
  - Ảnh MH-11 1280px kiểm tra bằng `ui.viewer`.

## Bảng tổng hợp

| ID | File | Kiểm chứng |
|---|---|---|
| BE-01 | `prisma/schema.prisma`, migration, `shared/integration-access/integration.constants.ts`, `integration.errors.ts` | e2e (CHECK, trigger) |
| BE-02 | `features/integration-clients/*` (`GET/POST /integration-clients`, `PATCH :id`, `POST :id/lock|unlock`) | e2e + vitest |
| BE-03 | `shared/integration-access/integration.interceptor.ts`, `integration-key.ts`, `app.setup.ts` (bỏ session cho `/api/v1`) | e2e 401/429/nhật ký |
| BE-04 | `shared/integration-access/integration-access.ts`; nhánh INTEGRATION trong `shared/students/student-access.ts`, `shared/graduation/graduation-access.ts` | unit + e2e |
| BE-05/06 | `features/ddut-api/*`; `features/student-portal/student-portal.service.ts` (tách `curriculumFor`, `syllabusProjection`, `issuedPin`, `defaultSemester`) | e2e trùng khớp với web |
| BE-07 | `/api/v1/docs`, `/api/v1/docs-json`, `source/backend/openapi/ddut-v1.json` | e2e so sánh hợp đồng |
| FE-01..04 | `features/integration-clients/*`, `routes.ts`, `router.tsx`, `menuItems.tsx`, `prefetchRoute.ts`, `permissions.ts` | vitest 6/6, Playwright |

## Sáu tài nguyên

| Đường dẫn | Tài nguyên | Nguồn trả lời |
|---|---|---|
| `GET /api/v1/sinh-vien/{mssv}/chuong-trinh?semester=` | STUDENT_PROGRAM | `StudentAppliedVersionReader` (ngành chính) |
| `GET /api/v1/chuong-trinh/{maCT}/phien-ban/{soPB}` | PROGRAM_VERSION | Dòng đã đóng băng của phiên bản đã ban hành |
| `GET /api/v1/hoc-phan/{maHP}/de-cuong?mssv=&semester=` hoặc `?program=&programVersion=` | SYLLABUS | Bản ghim của dòng; cùng phép chiếu với cổng sinh viên |
| `GET /api/v1/sinh-vien/{mssv}/tien-do` | PROGRESS | Cổng F-20 `curriculumFor` + tín chỉ từ F-19 |
| `GET /api/v1/sinh-vien/{mssv}/hoc-phan-du-dieu-kien` | ELIGIBILITY | `RegistrationEligibilityReader` (F-18) |
| `GET /api/v1/sinh-vien/{mssv}/xet-tot-nghiep` | GRADUATION | `GraduationService.live` (F-19), không lưu |

## Quyết định trong lúc build (lệch so với plan)

- **Định danh tích hợp** là một `AccessContext` tổng hợp có vai trò `INTEGRATION` (không phải vai trò trong CSDL), chỉ có 3 quyền đọc và phạm vi đúng **một** sinh viên của lời gọi. Các bộ đọc dùng chung tự kiểm tra như với web; không giả R1, không giả người dùng.
- **Xác thực, hạn mức, nhật ký** gộp trong một interceptor (guard chạy trước interceptor nên không ghi được lời gọi bị từ chối). Thân trả về 200 chỉ được gửi sau khi nhật ký đã ghi. Lời gọi bằng khóa đã khóa vẫn ghi `clientId` để truy vết; khóa thiếu/sai ghi `clientId = null`.
- **Hạn mức**: một câu `INSERT … ON CONFLICT … WHERE used < rateLimit RETURNING` trên cửa sổ phút cố định, dùng chung giữa các tiến trình; không Redis.
- **DTO v1** dùng lại DTO web cho tư vấn đăng ký (`RegistrationEligibilityDto`), xét tốt nghiệp (`GraduationOutcome`), học kỳ trong tiến độ (`PortalTermDto`) và đề cương (`PortalSyllabusDto`) thay vì khai báo lại toàn bộ. Rủi ro: đổi DTO web là đổi hợp đồng dDUT — được chặn bởi test so sánh `openapi/ddut-v1.json` (muốn đổi phải chạy lại với `UPDATE_DDUT_OPENAPI=1`).
- **Không trả họ tên sinh viên** trong ngữ cảnh (tối thiểu hóa); dDUT đã biết sinh viên.
- **Bảo trì nhật ký**: trigger chỉ cho DELETE khi giao dịch đặt `SET LOCAL ctdt.integration_log_maintenance = 'on'`; e2e purge là đường bảo trì duy nhất. Không có route xóa.
- **Không có** route xem lại/xoay vòng/xóa khóa; tên bên tích hợp chứa "E2E" được purge dọn.

## Phát hiện

- Trong e2e, `GraduationResultChangeReceipt` có thể tăng do bộ quét nền sau khi seed kết quả; test "không ghi" loại bộ đếm này (không phải do lời gọi đọc).

## Cổng còn mở

- E1: dDUT thật có giữ khóa trên máy chủ tin cậy và tự xác thực từng sinh viên không (chưa có hợp đồng phía dDUT; không đưa khóa vào app di động).
- E2: tính tái lập lịch sử sau đính chính/đổi lịch (giữ hành vi hiện tại).
- E4: chính sách lưu giữ/xem nhật ký gọi (hiện chỉ ghi thêm, chưa có màn hình xem).
- Chưa có bên tích hợp thật nào được tạo trên `ctdt_real`.
