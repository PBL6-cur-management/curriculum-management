# Current Work — In Progress

**Start here**: người dùng chốt F-06 US-021 AC3 và F-14 xóa/giữ bản làm việc trước khi chạy chuỗi xuyên tính năng; phần dữ liệu CTĐT thật đã có seed, xem dòng DUT bên dưới để xác nhận defaults và nạp database riêng, không suy từ database kiểm chứng sang máy người dùng.

## Session Context

- **Last updated**: 2026-10-23
- **Active area**: kiểm tra chức năng MVP và phần còn nợ — `docs/progress/handoff.md`.
- Mã đủ 13 tính năng MVP: F-01..F-08, F-10, F-11, F-13, F-14, F-15; F-09/F-12/F-16/F-26, B5, B6 vẫn sau MVP.

## Kết quả hiện tại

- **DUT legacy seed — shipped, có môi trường dữ liệu thật riêng**: caller đã kiểm chứng seed trước refactor và runner flow (migrate → base seed → DUT seed → app) sau refactor trên PostgreSQL dùng một lần, 24 programs / 46 versions, lần hai created 0; còn xác nhận 5 defaults (`LoaiDK`, degree level K2026, course-type mapping, synthetic program codes, ngày semester không ghi đè), tự tạo `.env.real` từ example và chạy `pnpm real:migrate; pnpm real:seed; pnpm real:seed:dut` trên database riêng — `docs/progress/handoff.md` §3.3.
- Đã có tài liệu ca kiểm thử 13 tính năng, bảng 14 cột — `docs/testing/README.md`, `docs/testing/test-cases/README.md`.
- Playwright chạy F-01..F-11 ngày 2026-10-21 (không gồm F-09), F-13..F-15 ngày 2026-10-22: **759 ca = 381 tự động + 378 thủ công; 381 Passed trong phần tự động**. 378 ca thủ công chưa chạy.
- Dự án pnpm độc lập thứ ba `source/e2e/` chạy trên app dev có demo seed, backend `:3000/api`, frontend `:5173` — `docs/testing/playwright-guide.md`.
- Bốn lỗi ứng dụng tìm ra khi chạy suite đã sửa và ghi `docs/troubleshooting/error_log.md`: `UserFormModal.tsx` hiện `unique`; F11-TC_063, F11-TC_026, F15-TC_001 (2026-10-22).

## Chờ người dùng quyết định

- **F-06 — US-021 AC3**: chọn sửa ma trận quyền hay tiêu chí “học phần ngoài nhóm → 403” (R3 đang có `course.edit` Đ trên mọi học phần trước ban hành) — `docs/progress/handoff.md` §3.2.
- **F-14**: chọn xóa hay giữ bản làm việc khi Từ chối/Thu hồi; mã hiện xóa, so sánh vẫn giữ trong `ChangeItem` — `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md:28`, `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md:53`.
- **F-15**: xác nhận `ChangeRequest.createdByAcademicOffice` cho phép chỉ đề xuất do Phòng Đào tạo tạo được ban hành vào học kỳ đã bắt đầu — `docs/implementation/f-15-release-version-snapshots-implementation-plan.md` §8.

## Còn nợ

- Migration trên máy người dùng: F-03 `subject_groups`, F-04 `courses`, F-05 `course_relations`, F-06 `programs`, F-07 `curriculum`, F-08 `credit_mismatch_acceptance`, F-10 `syllabi`, F-11 `outcomes`, F-13 `change_requests`; chạy `pnpm prisma:migrate`, không suy từ máy chạy suite ra máy khác — `docs/progress/handoff.md` §3.3.
- Seed trên máy người dùng: sau migration F-06/F-07/F-13 và học kỳ/khóa F-15, chạy `pnpm prisma:seed`; migration F-14/F-15 đã áp trên `ctdt-dev-pg`, không đồng nghĩa đã áp mọi máy — `docs/progress/handoff.md` §3.3.
- Thay dữ liệu giữ chỗ từ Excel của Khoa: CTĐT 1024034, DEMO101..DEMO302, `KnowledgeBlock`, học kỳ/khóa vẫn chưa được seed mới thay thế — `docs/progress/handoff.md` §3.3.
- Đặt `FILES_ROOT` trên ổ bền và sao lưu cùng cơ sở dữ liệu — `docs/implement-report/f-10-syllabus-implement-report.md`.
- Thực hiện 378 ca thủ công chưa chạy, không coi 381 Passed tự động là thay thế phần này — `docs/testing/test-cases/README.md`.
- Viết và chạy `source/e2e/specs/mvp-flow.spec.ts`: CTĐT → khung → nhất quán → đề xuất → duyệt ba cấp → ban hành → kích hoạt — `docs/progress/todo.md`.

### Lưu ý khi chạy trên máy

- Cổng 6379 đang bị container valkey của dự án khác giữ: `docker compose up` cần đặt `REDIS_PORT` khác.
- Seed cần `SEED_ADMIN_PASSWORD` (≥ 8 ký tự, có chữ và số): `pnpm prisma:migrate` rồi `pnpm prisma:seed` trong `source/backend`.

## Up Next

1. **Xử lý phần còn nợ MVP** — chốt hai quyết định F-06/F-14, rồi chạy lại ca liên quan; tiếp tục chuỗi xuyên tính năng và ca thủ công.
2. **Template** — sửa bốn lỗi của `E:\claude-code-templates` đã ghi ở báo cáo khởi tạo (hook chỉ dùng jq, sai đường dẫn migration, agent dùng npm/Biome, trùng tên agent giữa hai stack); cần người dùng đồng ý.
3. **Volta** — `volta install pnpm@10.23.0` để pnpm chạy trên Node 22; cần người dùng đồng ý.
