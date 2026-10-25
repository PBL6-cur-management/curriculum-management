# Bàn giao — bản MVP

**Ngày**: 2026-10-22 · **Nhánh**: `claude/keen-meitner-2y7yf1` (chưa gộp vào `main`, chưa mở PR)

Đọc kèm: `docs/system-overview.md` (hệ thống làm gì, ai dùng), `docs/testing/setup-and-test-guide.md` (cài đặt, kiểm thử, thứ tự đi thử), `docs/progress/todo.md` (trạng thái từng tính năng), `docs/implement-report/f-*-implement-report.md` (chi tiết, lệch kế hoạch, bước đi thử của từng tính năng).

## 1. Đã xong

Mã của cả 13 tính năng MVP đã dựng: F-01..F-08, F-10, F-11, F-13, F-14, F-15. Tài liệu ca kiểm thử (bảng 14 cột) và suite Playwright đã có cho đủ 13 tính năng: 759 ca, gồm 381 tự động (381 Passed; ba ca Failed lần đầu đã Passed sau khi sửa lỗi ứng dụng ngày 2026-10-22) và 378 thủ công chưa chạy. Kết quả tự động ngày 2026-10-21 cho F-01..F-11 (không gồm F-09), ngày 2026-10-22 cho F-13..F-15; không phải kết luận toàn bộ MVP đã đạt. Chỉ mục: `docs/testing/README.md`, `docs/testing/test-cases/README.md`; cách chạy: `docs/testing/playwright-guide.md`.

| Kiểm tra (2026-10-19, sau F-15) | Backend | Frontend |
|---|---|---|
| tsc, oxlint (0 cảnh báo), Prettier | sạch | sạch |
| Kiểm thử đơn vị | 853/853 | 411/411 |
| Kiểm thử đầu-cuối (Testcontainers) | 391/391 | — |
| Build | ok | ok |

Kiểm thử đầu-cuối dùng chung một PostgreSQL + một Redis cho cả lượt (`test/global-setup.ts`); mỗi tệp nhận một cơ sở dữ liệu sao từ mẫu đã migrate.

## 2. Chạy trên máy

Trong `source/backend`: `pnpm install` → `pnpm services:up` (đặt `REDIS_PORT` khác nếu 6379 bận) → tạo `.env` (README backend) → `pnpm prisma:migrate` → `SEED_ADMIN_PASSWORD=... pnpm prisma:seed` → `pnpm dev`. Trong `source/frontend`: `pnpm install` → `pnpm dev`.

Biến mới so với README: `FILES_ROOT` (tệp đính kèm đề cương, mặc định `files/`), `BULLMQ_PREFIX` (chỉ khi dùng chung Redis), `SESSION_IDLE_MINUTES`.

## 3. Việc của người dùng

### 3.1. Kiểm thử còn lại
- 378 ca thủ công chưa chạy; xem `docs/testing/test-cases/README.md`. Không còn giao lại toàn bộ bước thử trình duyệt từng tính năng đã được suite tự động bao phủ.
- Ba lỗi ứng dụng phát hiện khi chạy suite (F11-TC_063 tìm CLO, F11-TC_026 xác nhận xóa trọng số, F15-TC_001 nhãn vấn đề đề cương) đã sửa 2026-10-22, ghi `docs/troubleshooting/error_log.md`; ba test bỏ `test.fixme` và đều Passed.
- Lỗi `UserFormModal.tsx` hiển thị `unique` đã sửa và đã ghi ở `docs/troubleshooting/error_log.md`; không có sửa lỗi mới trong lượt đồng bộ này.

### 3.2. Xác nhận các lựa chọn mặc định đã lấy
- **F-06**: số học kỳ tối đa 12; mọi tài khoản không phải sinh viên làm được Giám đốc CTĐT; nhân bản lấy phiên bản hiện hành.
- **F-06 — cần quyết định**: US-021 AC3 bỏ nửa "học phần ngoài nhóm → 403" vì ma trận quyền cho R3 `course.edit` Đ trên mọi học phần trước khi ban hành. Sửa ma trận hay sửa tiêu chí?
- **F-07**: nhóm có cả hai mức tối thiểu thì đòi cả hai; tổng học kỳ tính cả học phần tự chọn; ký hiệu khối kiến thức nhập tự do.
- **F-08**: D3 (nhóm chỉ có số học phần → tính tín chỉ các học phần ít tín chỉ nhất), D4 (tự chọn ngoài nhóm cộng 0 + cảnh báo), D7 (R1, R3 chấp nhận chênh lệch; R4 không), R5 mở được MH-27.
- **F-10**: bản Nháp hiện cho R1..R5; R3/R4/R5 sửa trực tiếp Nháp học phần của Khoa, học phần Khoa khác chỉ R1; giới hạn 20 MB, 10 tệp/bản, 60 tuần, 100.000 ký tự/mục.
- **F-11**: CTĐT lấy CLO từ bản đề cương đã ban hành, chưa có thì bản Nháp; R5 xem báo cáo độ phủ trong nhóm mình; R6 chỉ xem PLO CTĐT của mình.
- **F-13, F-14, F-15**: các câu hỏi mở của từng kế hoạch nhận phương án mặc định (xem báo cáo dựng).
- **F-14 — cần quyết định**: bản làm việc bị **xóa** khi đề xuất bị Từ chối hoặc Thu hồi (kế hoạch để F-15 chọn); phần so sánh vẫn giữ trong `ChangeItem`. Cần chốt xóa hay giữ; xem `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md:28` và `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md:53`.
- **F-15**: xem lại ghi chú §8 kế hoạch về `ChangeRequest.createdByAcademicOffice`.

### 3.3. Dữ liệu và môi trường
- DUT legacy seed và môi trường dữ liệu thật đã có: trong `source/backend`, tự tạo `.env.real` từ `.env.real.example`, rồi chạy `pnpm real:migrate; pnpm real:seed; pnpm real:seed:dut` để nạp từ ba JSON tại `prisma/seed-data/dut/data/`; không cần dump trên máy chạy seed. Dùng `pnpm real:dev` để chạy app; tệp đính kèm và Redis queue prefix tách riêng, không chạy demo seed trên database thật. Caller đã kiểm chứng seed trước khi tách thư mục trên PostgreSQL 18 ICU `vi-VN` dùng một lần, không phải `ctdt-dev-pg`: 24 programs, 46 versions; lần hai created 0. Người dùng vẫn cần tự nạp database riêng; runner mới chưa được chạy runtime trong sandbox.
- Cần Khoa/Phòng Đào tạo xác nhận defaults DUT: `LoaiDK` 0 → `PRIOR`, 1 → `PREREQUISITE`, 2 → `COREQUISITE`; K2026 mặc định `BACHELOR`, riêng `1024046` là `ENGINEER`; course-type mapping theo `LoaiHP`/`DATN`/giờ học; synthetic program codes `CNTT-*`; ngày semester legacy không ghi đè ngày hiện hữu (đã giữ `2025-2026-1` ở `2025-09-08`, legacy là `2025-08-04`). Chi tiết mapping trong kế hoạch DUT §3; xác nhận trước khi nạp database riêng.
- Thay dữ liệu giả bằng dữ liệu thật từ Excel của Khoa (Q-11): CTĐT 1024034 trong `prisma/seed-data/programs.ts`, học phần `DEMO101..DEMO302`, danh mục `KnowledgeBlock`, học kỳ và khóa trong `prisma/seed-data/semesters.ts`.
- Các mục giữ chỗ trên vẫn còn: DUT seed thêm `CNTT-*`, không thay `1024034`/`DEMO*` hoặc nạp `KnowledgeBlock`; semester/cohort trùng natural key giữ nguyên. Không coi seed mới là hoàn tất việc thay toàn bộ dữ liệu Excel/lịch thật.
- Áp các migration mới lên cơ sở dữ liệu phát triển của mình (`pnpm prisma:migrate`); seed F-06/F-07/F-13 và học kỳ/khóa F-15 bằng `pnpm prisma:seed`. F-14/F-15 đã áp trên `ctdt-dev-pg`, không suy ra trạng thái máy khác; danh sách migration còn nợ tại `docs/progress/current_work.md`.
- Triển khai: `FILES_ROOT` nằm trên ổ bền và được sao lưu cùng cơ sở dữ liệu.
- Xóa thư mục thừa `source/node_modules/` (không theo dõi bởi git, do một lượt dựng tạo nhầm).
- Thư viện thêm ngoài kế hoạch: `@dnd-kit` (kéo thả, F-07). Tiptap, `sanitize-html` có trong kế hoạch F-10.

## 4. Giới hạn đã biết

- `/api/auth/me` chỉ trả mã quyền, không trả chế độ và phạm vi → nút sửa hiện cho cả người giữ quyền có phạm vi (R3..R5), máy chủ trả 403 (F-05, F-06, F-15).
- Tên các cấp duyệt là hằng số, chưa có bảng `ApprovalLevelConfig`.
- Ảnh chụp tên/tín chỉ chỉ ghi khi còn trống, chưa có thao tác làm mới.
- CTĐT ngừng hoạt động bị bỏ qua khi lan truyền thay đổi.
- Chưa đo hiệu năng ma trận 200 × 30 ô; sắp xếp lại khung không cập nhật lạc quan; tên tiếng Anh trong trình sửa dòng khung không xóa trắng được.
- Tuyến `/program-versions/:id/info` lặp lại kiểm tra tín chỉ/học kỳ của `ProgramsService.update`.
- Bảy DTO của F-02, F-03 còn bản sao `trim`/`emptyToNull` riêng, chưa chuyển sang `shared/dtos/transforms.ts`.

## 5. Tiếp theo

1. **Kiểm tra chức năng xuyên tính năng**: phần tự động theo tính năng đã chạy (381 ca: 381 Passed); còn chốt F-06/F-14 (§3.2), 378 ca thủ công và `source/e2e/specs/mvp-flow.spec.ts` cho chuỗi CTĐT → khung → nhất quán → đề xuất → duyệt ba cấp → ban hành → kích hoạt. Chưa có kết quả cho chuỗi liền mạch này.
2. **Tài liệu**: kiến trúc đã đồng bộ tới F-15 (2026-10-19); tiến độ, bàn giao và thông tin dự án Playwright `source/e2e/` đã đồng bộ ngày 2026-10-22.
3. Hoàn tất phần kiểm thử còn lại (§3.1), dữ liệu/môi trường (§3.3) và các quyết định trước khi đổi toàn bộ tính năng 🔄 → ✅ trong `todo.md`.
4. Sau MVP: F-09 (Excel), F-12 (công thức điểm — bổ sung điều kiện đánh giá vào DC-03), F-16 (so sánh phiên bản, gán khóa), F-26 (sao lưu), rồi B5, B6.
5. Gộp nhánh vào `main` (mở PR) khi đã đi thử xong.
