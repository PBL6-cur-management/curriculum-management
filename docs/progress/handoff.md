# Bàn giao — bản MVP

**Ngày**: 2026-10-25 · **Nhánh**: `main` (PR #1 từ `claude/keen-meitner-2y7yf1` đã gộp, commit `181af11`)

Đọc kèm: `docs/system-overview.md` (hệ thống làm gì, ai dùng), `docs/testing/setup-and-test-guide.md` (cài đặt, kiểm thử, thứ tự đi thử), `docs/progress/todo.md` (trạng thái từng tính năng), `docs/implement-report/f-*-implement-report.md` (chi tiết, lệch kế hoạch, bước đi thử của từng tính năng).

## 1. Đã xong

Mã của cả 13 tính năng MVP đã dựng: F-01..F-08, F-10, F-11, F-13, F-14, F-15. Tài liệu ca kiểm thử (bảng 14 cột) và suite Playwright đã có cho đủ 13 tính năng: 759 ca, gồm 381 tự động (381 Passed; ba ca Failed lần đầu đã Passed sau khi sửa lỗi ứng dụng ngày 2026-10-22) và 378 thủ công chưa chạy. Kết quả tự động ngày 2026-10-21 cho F-01..F-11 (không gồm F-09), ngày 2026-10-22 cho F-13..F-15; không phải kết luận toàn bộ MVP đã đạt. Chỉ mục: `docs/testing/README.md`, `docs/testing/test-cases/README.md`; cách chạy: `docs/testing/playwright-guide.md`.

Luồng `source/e2e/specs/mvp-flow.spec.ts` cũng đã Passed theo caller chạy ngày 2026-10-25: lần 3 và 4 đều **14 Passed (9 setup + MVP-TC_001..005)**, **1.7 phút/lần**. Năm ca nghiệp vụ bổ sung đã ghi kết quả trong `docs/testing/test-cases/mvp-flow-test-cases.md`; không tính setup thành ca nghiệp vụ hoặc coi kết quả này thay thế 378 ca thủ công. Hai lần đầu và flake còn mở được giữ ở §3.1.

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
- Kích hoạt bản `1.1` từ đề xuất vẫn chưa được bao phủ: `PENDING → ACTIVE` qua `source/backend/src/features/releases/release-activation.processor.ts:38` cần đúng ngày bắt đầu học kỳ với worker thật đang chạy; sau đó kiểm bản cũ sang Lịch sử, đề xuất có hiệu lực và bản đang áp dụng đổi. Passed của đường ban hành đầu tiên thành `ACTIVE` không thay thế kiểm chứng này.
- Flake fixture dùng chung chưa sửa: lần 2/4 của luồng MVP, `fixtures/select.ts:22` (`chooseOption`), qua `fixtures/curriculum.ts:27` (`prepareCurriculumItem`), combobox Học kỳ (`plannedSemester`) vẫn `aria-expanded=true` sau 10 giây dù đã chọn option. Cùng bước đạt ở lần 1/3/4; nguyên nhân chưa xác định, cần tiếp tục theo dõi, không kết luận đã hết flake.
- Lần 1 của luồng MVP hỏng do locator Chạy lại khớp exact trong khi accessible name là “reload Chạy lại”; caller đã bỏ exact tại `source/e2e/specs/mvp-flow.spec.ts:56`. Đây là lỗi test đã sửa, không phải lỗi app và không thêm vào `error_log.md`.
- Ba lỗi ứng dụng phát hiện khi chạy suite (F11-TC_063 tìm CLO, F11-TC_026 xác nhận xóa trọng số, F15-TC_001 nhãn vấn đề đề cương) đã sửa 2026-10-22, ghi `docs/troubleshooting/error_log.md`; ba test bỏ `test.fixme` và đều Passed.
- Lỗi `UserFormModal.tsx` hiển thị `unique` đã sửa và đã ghi ở `docs/troubleshooting/error_log.md`; không có sửa lỗi mới trong lượt đồng bộ này.

### 3.2. Xác nhận các lựa chọn mặc định đã lấy
- **F-06**: số học kỳ tối đa 12; mọi tài khoản không phải sinh viên làm được Giám đốc CTĐT; nhân bản lấy phiên bản hiện hành.
- **F-06 — đã quyết định bởi người dùng 2026-10-25**: sửa US-021 AC3, giữ nguyên ma trận quyền. Sửa học phần trong nhóm G được, PATCH chương trình B không phân công trả 403 chứng minh phạm vi độc lập; không yêu cầu “học phần ngoài nhóm → 403” vì R3 có `course.edit` D toàn trường và F-04 cho sửa trực tiếp học phần của Khoa chưa ban hành.
- **F-07**: nhóm có cả hai mức tối thiểu thì đòi cả hai; tổng học kỳ tính cả học phần tự chọn; ký hiệu khối kiến thức nhập tự do.
- **F-08**: D3 (nhóm chỉ có số học phần → tính tín chỉ các học phần ít tín chỉ nhất), D4 (tự chọn ngoài nhóm cộng 0 + cảnh báo), D7 (R1, R3 chấp nhận chênh lệch; R4 không), R5 mở được MH-27.
- **F-10**: bản Nháp hiện cho R1..R5; R3/R4/R5 sửa trực tiếp Nháp học phần của Khoa, học phần Khoa khác chỉ R1; giới hạn 20 MB, 10 tệp/bản, 60 tuần, 100.000 ký tự/mục.
- **F-11**: CTĐT lấy CLO từ bản đề cương đã ban hành, chưa có thì bản Nháp; R5 xem báo cáo độ phủ trong nhóm mình; R6 chỉ xem PLO CTĐT của mình.
- **F-13, F-14, F-15**: các câu hỏi mở của từng kế hoạch nhận phương án mặc định (xem báo cáo dựng).
- **F-14 — đã quyết định bởi người dùng 2026-10-25**: giữ xóa bản làm việc khi Từ chối/Thu hồi bằng `WorkingCopyService.discard`; diff vẫn đọc được từ `ChangeItem`, không giữ bản sao chỉ đọc. D14 và gotcha kế hoạch F-15 đã sửa tại chỗ; xem phần quyết định bổ sung trong báo cáo F-14.
- **F-15 — người dùng đã chốt 2026-10-26**: xác nhận `ChangeRequest.createdByAcademicOffice` được lưu khi tạo; chỉ đề xuất do Phòng Đào tạo tạo có thể ban hành vào học kỳ đã bắt đầu. Giữ hành vi đã build; riêng sửa công thức áp dụng quy tắc F-12 chỉ học kỳ tương lai.

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

1. **Kiểm thử và xác nhận còn lại**: thực hiện 378 ca thủ công; F-15 `createdByAcademicOffice` đã chốt 2026-10-26 (§3.2). Luồng xuyên tính năng đã Passed đủ 5 ca ở lần 3 và 4 ngày 2026-10-25; vẫn cần kiểm kích hoạt đúng bản 1.1 vào ngày đầu học kỳ với worker thật đang chạy và theo dõi flake `chooseOption` chưa sửa (§3.1). F-06/F-14 đã chốt.
2. **Tài liệu**: kiến trúc đã đồng bộ tới F-15 (2026-10-19); tiến độ, bàn giao, hai quyết định F-06/F-14 và kết quả caller chạy luồng MVP đã đồng bộ ngày 2026-10-25; giữ lịch sử thất bại và giới hạn chưa bao phủ.
3. Hoàn tất phần kiểm thử còn lại (§3.1), dữ liệu/môi trường (§3.3) và các quyết định trước khi đổi toàn bộ tính năng 🔄 → ✅ trong `todo.md`.
4. Sau MVP: F-09 (Excel), F-12 (công thức điểm — bổ sung điều kiện đánh giá vào DC-03), F-16 (so sánh phiên bản, gán khóa), F-26 (sao lưu), rồi B5, B6.
   Các lượt khác đang viết song song implementation plan F-16, F-12, F-23, F-25; lượt này không đọc, đánh giá nội dung hoặc sửa các kế hoạch đó.
5. **Đã xong**: PR #1 từ `claude/keen-meitner-2y7yf1` đã gộp vào `main` tại `181af11`; phần kiểm thử còn lại không còn chặn việc gộp PR này.
