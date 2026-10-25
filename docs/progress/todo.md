# Project TODO

Legend: ✅ Done | 🔄 In Progress | ⚠️ Stub/Partial | ❌ Not Started

ENTRY FORMAT: `| XX | Item description | ❌ | Short approach note — what the implementation should do |`

**MVP (2026-10-18):** F-01..F-08, F-10, F-11, F-13, F-14, F-15 làm trước (`docs/planning/epics.md` §0); các tính năng khác ghi `sau MVP`.

Một dòng cho mỗi tính năng; việc chi tiết (CV-xxx) ở `docs/planning/task-breakdown.md`, câu hỏi ở `docs/planning/feature-questions.md`, kế hoạch ở `docs/implementation/`.

---

## Core / Infrastructure

| # | Item | Status | Notes |
|---|---|---|---|
| F-00 | Khung backend + frontend, trạng thái hệ thống | ✅ | `GET /api/health`, `HealthPage`; kiểm thử đơn vị và đầu-cuối |
| C-01 | Thiết lập Claude Code + tài liệu dự án | ✅ | `.claude/`, `CLAUDE.md`, `docs/architecture`, `docs/progress` |
| C-02 | Câu hỏi theo tính năng | ✅ | Trả lời 2026-10-18; câu trống nhận A; bốn trả lời khác A đã sửa vào tài liệu nguồn |
| C-04 | Kế hoạch triển khai tính năng | ✅ | F-01..F-11, F-13, F-14, F-15 — đủ 13 kế hoạch MVP; tính năng sau MVP viết kế hoạch khi tới lượt |
| C-03 | Sửa lỗi mẫu `claude-code-templates` | ❌ | Bốn lỗi; sửa ở mẫu và bản đang dùng cùng lúc; cần đồng ý |

## Kiểm tra chức năng MVP

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Tài liệu ca kiểm thử và kiểm tra chức năng tự động theo tính năng | ✅ | Đủ 13 tính năng, bảng 14 cột; đã chạy 2026-10-21/22: 759 ca = 381 tự động (381 Passed) + 378 thủ công chưa chạy; không đồng nghĩa toàn MVP đạt — `docs/testing/README.md`, `docs/testing/test-cases/README.md` |
| Ba lỗi ứng dụng từ suite (F11-TC_063, F11-TC_026, F15-TC_001) | ✅ | Đã sửa 2026-10-22, ghi `docs/troubleshooting/error_log.md`; ba test bỏ `test.fixme`, Passed |
| F-06 — quyết định US-021 AC3 | ❌ | Người dùng chọn sửa ma trận quyền hay tiêu chí “học phần ngoài nhóm → 403” — `docs/progress/handoff.md` §3.2 |
| F-14 — quyết định bản làm việc | ❌ | Người dùng chọn xóa hay giữ khi Từ chối/Thu hồi; mã hiện xóa — `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md:28`, `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md:53` |
| Chuỗi `mvp-flow.spec.ts` | ❌ | Chưa viết/chạy: CTĐT → khung → nhất quán → đề xuất → duyệt ba cấp → ban hành → kích hoạt; dự kiến `source/e2e/specs/mvp-flow.spec.ts` |
| 378 ca thủ công | ❌ | Chưa thực hiện — `docs/testing/test-cases/README.md`; không gộp với 381 Passed tự động |

## DUT legacy seed

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Extractor + loader dữ liệu CTĐT DUT | ✅ | Hoàn tất 2026-10-23; caller kiểm chứng migrate + base/demo/DUT seed trên PostgreSQL dùng một lần: 24 programs, 46 versions, 3.295 items, 3.135 requisites; lần hai created 0; `vitest run prisma` 52 passed; JSON deterministic và sensitive-pattern grep sạch — `docs/implement-report/dut-legacy-seed-implement-report.md` §V-01 |
| Xác nhận `LoaiDK` | ❌ | Default 0 → `PRIOR`, 1 → `PREREQUISITE`, 2 → `COREQUISITE`; chờ Phòng Đào tạo |
| Xác nhận degree level K2026 | ❌ | Default `BACHELOR`, riêng frame `1024046` → `ENGINEER`; chờ Khoa |
| Xác nhận course-type mapping | ❌ | Default: `LoaiHP = 1` → `CONDITIONAL`, `LoaiHP = 3` → `LAB`, `DATN = 1` → `CAPSTONE`; không có giờ lý thuyết thì `ThucTap > 0` → `INTERNSHIP`, tiếp đến `DoAn > 0` → `PROJECT`; còn lại `THEORY` |
| Xác nhận synthetic program codes | ❌ | Default `CNTT-*` theo program map; chờ mã chính thức của Khoa |
| Xác nhận chính sách ngày semester legacy | ❌ | Default không ghi đè ngày hiện hữu; conflict `2025-2026-1` đã giữ `2025-09-08` thay vì legacy `2025-08-04` |

## B1 — Nền tảng và danh mục học phần

| # | Item | Status | Notes |
|---|---|---|---|
| F-01 | Đăng nhập, phiên | ✅ | Dựng 2026-10-18; kiểm thử xanh, seed đã chạy, người dùng đi thử 6 bước bằng trình duyệt đạt |
| F-02 | Tài khoản, vai trò, phạm vi quyền | 🔄 | Mã xong; Playwright 22/22 Passed. Migration và seed đã chạy; còn ca thủ công. — `docs/implement-report/f-02-accounts-roles-permissions-implement-report.md` |
| F-03 | Đơn vị và nhóm chuyên môn | 🔄 | Mã xong; Playwright 20/20 Passed. Còn migration `subject_groups` trên máy người dùng và ca thủ công. — `docs/implement-report/f-03-org-units-subject-groups-implement-report.md` |
| F-04 | Danh mục học phần | 🔄 | Mã xong; Playwright 58/58 Passed. Còn migration `courses` trên máy người dùng và ca thủ công. — `docs/implement-report/f-04-course-catalog-implement-report.md` |
| F-05 | Quan hệ học phần, nhóm tương đương | 🔄 | Mã xong; Playwright 26/26 Passed. Còn migration `course_relations` trên máy người dùng và ca thủ công. — `docs/implement-report/f-05-course-relations-equivalence-implement-report.md` |

## B2 — Chương trình đào tạo và khung

| # | Item | Status | Notes |
|---|---|---|---|
| F-06 | Thông tin chương trình, Giám đốc CTĐT | 🔄 | Mã xong; Playwright 21/21 Passed. Còn migration `programs` + seed, thay dữ liệu 1024034, quyết định US-021 AC3 và ca thủ công. — `docs/implement-report/f-06-programs-directors-implement-report.md` |
| F-07 | Khung chương trình, nhóm tự chọn | 🔄 | Mã xong; Playwright 26/26 Passed. Còn migration `curriculum` + seed, dữ liệu Excel/DEMO* và ca thủ công. — `docs/implement-report/f-07-curriculum-elective-groups-implement-report.md` |
| F-08 | Kiểm tra nhất quán | 🔄 | Mã xong; Playwright 13/13 Passed. Còn migration `credit_mismatch_acceptance` trên máy người dùng và ca thủ công. — `docs/implement-report/f-08-consistency-check-implement-report.md` |
| F-09 | Nhập, xuất Excel | ❌ | Sau MVP. ExcelJS trong worker; chạy thử → xác nhận |

## B3 — Đề cương và chuẩn đầu ra

| # | Item | Status | Notes |
|---|---|---|---|
| F-10 | Đề cương | 🔄 | Mã xong; Playwright 37/37 Passed. Còn migration `syllabi`, `FILES_ROOT` bền vững và ca thủ công. — `docs/implement-report/f-10-syllabus-implement-report.md` |
| F-11 | PLO, CLO, ma trận | 🔄 | Mã xong; Playwright 49/49 Passed (F11-TC_063/F11-TC_026 sửa 2026-10-22); còn migration `outcomes` và ca thủ công. — `docs/implement-report/f-11-plo-clo-matrices-implement-report.md` |
| F-12 | Công thức điểm, đánh giá–CLO | ❌ | Sau MVP |

## B4 — Đề xuất thay đổi và phiên bản

| # | Item | Status | Notes |
|---|---|---|---|
| F-13 | Đề xuất thay đổi | 🔄 | Mã xong; Playwright 28/28 Passed. Còn migration `change_requests` + seed trên máy người dùng và ca thủ công. — `docs/implement-report/f-13-change-requests-implement-report.md` |
| F-14 | Duyệt ba cấp, thông báo | 🔄 | Mã xong; Playwright 31/31 Passed. Migration đã áp trên `ctdt-dev-pg`; còn quyết định xóa/giữ bản làm việc và ca thủ công. — `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md` |
| F-15 | Ban hành, ảnh chụp phiên bản | 🔄 | Mã xong; Playwright 33/33 Passed (F15-TC_001 sửa 2026-10-22); migration đã áp trên `ctdt-dev-pg`; còn seed học kỳ/khóa và ca thủ công. — `docs/implement-report/f-15-release-version-snapshots-implement-report.md` |
| F-16 | So sánh phiên bản, gán khóa | ❌ | Sau MVP |
| F-26 | Sao lưu, diễn tập phục hồi | ❌ | Sau MVP. `pg_dump` hằng ngày + thư mục tệp |

## B5 — Sinh viên, điều kiện đăng ký, xét tốt nghiệp

| # | Item | Status | Notes |
|---|---|---|---|
| F-17 | Hồ sơ sinh viên, kết quả học tập | ❌ | |
| F-18 | Điều kiện đăng ký học phần | ❌ | |
| F-19 | Xét tốt nghiệp | ❌ | Xét hàng loạt trong worker |
| F-20 | Cổng sinh viên | ❌ | |
| F-21 | API cho dDUT | ❌ | Khóa API, nhật ký từng lời gọi |

## B6 — Tích hợp, báo cáo, hoàn thiện

| # | Item | Status | Notes |
|---|---|---|---|
| F-22 | Đồng bộ cơ sở dữ liệu Trường | ❌ | `mssql`, chỉ đọc, theo lịch |
| F-23 | Báo cáo kiểm định | ❌ | |
| F-24 | Đồ thị, PDF, dòng thời gian, bảng sức khỏe | ❌ | Puppeteer |
| F-25 | Ủy quyền, email, nhắc hạn | ❌ | Nodemailer |
| F-27 | Triển khai, thử tải, theo dõi hoạt động | ❌ | Docker Compose + Caddy |
