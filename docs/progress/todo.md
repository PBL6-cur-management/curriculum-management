# Project TODO

Legend: ✅ Done | 🔄 In Progress | ⚠️ Stub/Partial | ❌ Not Started | ⏸️ Deferred (hoãn)

ENTRY FORMAT: `| XX | Item description | ❌ | Short approach note — what the implementation should do |`

**MVP (2026-10-18):** F-01..F-08, F-10, F-11, F-13, F-14, F-15 làm trước (`docs/planning/epics.md` §0); các tính năng khác ghi `sau MVP`.

Một dòng cho mỗi tính năng; việc chi tiết (CV-xxx) ở `docs/planning/task-breakdown.md`, câu hỏi ở `docs/planning/feature-questions.md`, kế hoạch ở `docs/implementation/`.

---

## Core / Infrastructure

| #    | Item                                          | Status | Notes                                                                                                                                                                                                                           |
| ---- | --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-00 | Khung backend + frontend, trạng thái hệ thống | ✅     | `GET /api/health`, `HealthPage`; kiểm thử đơn vị và đầu-cuối                                                                                                                                                                    |
| C-01 | Thiết lập Claude Code + tài liệu dự án        | ✅     | `.claude/`, `CLAUDE.md`, `docs/architecture`, `docs/progress`                                                                                                                                                                   |
| C-02 | Câu hỏi theo tính năng                        | ✅     | Trả lời 2026-10-18; câu trống nhận A; bốn trả lời khác A đã sửa vào tài liệu nguồn                                                                                                                                              |
| C-04 | Kế hoạch triển khai tính năng | ✅ | F-09/F-12/F-16/F-17/F-18 đã build theo kế hoạch; F-18 BE/FE/docs hoàn tất 2026-10-30; F-19..F-25 đã merge (PR #26–#31); F-26/F-27 có mã hoàn tất 2026-10-31; BE e2e chạy lại 677/677 trên PostgreSQL/Redis của compose |
| C-03 | Sửa lỗi mẫu `claude-code-templates`           | ❌     | Bốn lỗi; sửa ở mẫu và bản đang dùng cùng lúc; cần đồng ý                                                                                                                                                                        |

## Kiểm tra chức năng MVP, F-09, F-12, F-16 và F-17

| Hạng mục                                                          | Trạng thái | Ghi chú                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tài liệu ca kiểm thử và kiểm tra chức năng tự động theo tính năng | ✅ | 17 tính năng đã có mã; đếm trực tiếp 874 ca = 479 tự động Passed + 395 Manual chưa chạy (MVP 759/381/378 + F-09 30/27/3 + F-16 27/22/5 + F-12 26/21/5 + F-17 32/28/4). Không đồng nghĩa nghiệm thu đầy đủ — `docs/testing/test-cases/README.md` |
| Ba lỗi ứng dụng từ suite (F11-TC_063, F11-TC_026, F15-TC_001)     | ✅         | Đã sửa 2026-10-22, ghi `docs/troubleshooting/error_log.md`; ba test bỏ `test.fixme`, Passed                                                                                                                                                         |
| F-06 — quyết định US-021 AC3                                      | ✅         | Người dùng chốt 2026-10-25: sửa tiêu chí, giữ ma trận; sửa học phần trong G được, PATCH chương trình B không phân công trả 403 — `docs/progress/handoff.md` §3.2                                                                                    |
| F-14 — quyết định bản làm việc                                    | ✅         | Người dùng chốt 2026-10-25: xóa khi Từ chối/Thu hồi bằng `WorkingCopyService.discard`; diff vẫn đọc từ `ChangeItem` — báo cáo F-14, phần quyết định bổ sung                                                                                         |
| Chuỗi `mvp-flow.spec.ts`                                          | ✅         | Caller chạy ngày 2026-10-25: lần 3 và 4 đều 14 Passed (9 setup + 5 ca MVP), 1.7 phút/lần; ghi Passed cho MVP-TC_001..005. Đã kiểm đường ban hành đầu tiên thành `ACTIVE` và bản từ duyệt ba cấp là `PENDING`; không bao gồm kích hoạt bản tương lai |
| Kích hoạt bản 1.1 vào học kỳ tương lai                            | ❌         | Chưa bao phủ `PENDING → ACTIVE` qua `release-activation.processor.ts`; cần đúng ngày bắt đầu học kỳ với worker thật đang chạy, rồi kiểm đổi bản đang áp dụng                                                                                        |
| Flake `chooseOption` trong MVP và F-09                            | ⚠️         | `fixtures/select.ts:22`: trước qua curriculum.ts:27; ngày 10/26/26 cũng gặp F09-TC_001 qua spec F-09:22 (Loại dữ liệu vẫn aria-expanded=true, value rỗng sau 10 giây). Failed 1/2 lượt F-09, chưa sửa; Passed không chứng minh hết flake            |
| 395 ca thủ công | ❌ | MVP 378 + F-09 3 + F-16 5 (023..027) + F-12 5 (022..026) + F-17 4 (029..032); không được thay bằng tự động. Đầu vào Khoa C1..C10 và lịch/fixture nghiệm thu vẫn còn — `docs/testing/test-cases/README.md` |

## DUT legacy seed

| Hạng mục                                 | Trạng thái | Ghi chú                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extractor + loader dữ liệu CTĐT DUT      | ✅         | Hoàn tất 2026-10-23; caller kiểm chứng migrate + base/demo/DUT seed trên PostgreSQL dùng một lần: 24 programs, 46 versions, 3.295 items, 3.135 requisites; lần hai created 0; `vitest run prisma` 52 passed; JSON deterministic và sensitive-pattern grep sạch — `docs/implement-report/dut-legacy-seed-implement-report.md` §V-01 |
| Xác nhận `LoaiDK`                        | ❌         | Default 0 → `PRIOR`, 1 → `PREREQUISITE`, 2 → `COREQUISITE`; chờ Phòng Đào tạo                                                                                                                                                                                                                                                      |
| Xác nhận degree level K2026              | ❌         | Default `BACHELOR`, riêng frame `1024046` → `ENGINEER`; chờ Khoa                                                                                                                                                                                                                                                                   |
| Xác nhận course-type mapping             | ❌         | Default: `LoaiHP = 1` → `CONDITIONAL`, `LoaiHP = 3` → `LAB`, `DATN = 1` → `CAPSTONE`; không có giờ lý thuyết thì `ThucTap > 0` → `INTERNSHIP`, tiếp đến `DoAn > 0` → `PROJECT`; còn lại `THEORY`                                                                                                                                   |
| Xác nhận synthetic program codes         | ❌         | Default `CNTT-*` theo program map; chờ mã chính thức của Khoa                                                                                                                                                                                                                                                                      |
| Xác nhận chính sách ngày semester legacy | ❌         | Default không ghi đè ngày hiện hữu; conflict `2025-2026-1` đã giữ `2025-09-08` thay vì legacy `2025-08-04`                                                                                                                                                                                                                         |

## B1 — Nền tảng và danh mục học phần

| #    | Item                               | Status | Notes                                                                                                                                                                                  |
| ---- | ---------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Đăng nhập, phiên                   | ✅     | Dựng 2026-10-18; kiểm thử xanh, seed đã chạy, người dùng đi thử 6 bước bằng trình duyệt đạt                                                                                            |
| F-02 | Tài khoản, vai trò, phạm vi quyền  | 🔄     | Mã xong; Playwright 22/22 Passed. Migration và seed đã chạy; còn ca thủ công. — `docs/implement-report/f-02-accounts-roles-permissions-implement-report.md`                            |
| F-03 | Đơn vị và nhóm chuyên môn          | 🔄     | Mã xong; Playwright 20/20 Passed. Còn migration `subject_groups` trên máy người dùng và ca thủ công. — `docs/implement-report/f-03-org-units-subject-groups-implement-report.md`       |
| F-04 | Danh mục học phần                  | 🔄     | Mã xong; Playwright 58/58 Passed. Còn migration `courses` trên máy người dùng và ca thủ công. — `docs/implement-report/f-04-course-catalog-implement-report.md`                        |
| F-05 | Quan hệ học phần, nhóm tương đương | 🔄     | Mã xong; Playwright 26/26 Passed. Còn migration `course_relations` trên máy người dùng và ca thủ công. — `docs/implement-report/f-05-course-relations-equivalence-implement-report.md` |

## B2 — Chương trình đào tạo và khung

| #    | Item                                  | Status | Notes                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-06 | Thông tin chương trình, Giám đốc CTĐT | 🔄     | Mã xong; Playwright 21/21 Passed. Còn migration `programs` + seed, thay dữ liệu 1024034, quyết định US-021 AC3 và ca thủ công. — `docs/implement-report/f-06-programs-directors-implement-report.md`                                                                       |
| F-07 | Khung chương trình, nhóm tự chọn      | 🔄     | Mã xong; Playwright 26/26 Passed. Còn migration `curriculum` + seed, dữ liệu Excel/DEMO* và ca thủ công. — `docs/implement-report/f-07-curriculum-elective-groups-implement-report.md`                                                                                     |
| F-08 | Kiểm tra nhất quán                    | 🔄     | Mã xong; Playwright 13/13 Passed. Còn migration `credit_mismatch_acceptance` trên máy người dùng và ca thủ công. — `docs/implement-report/f-08-consistency-check-implement-report.md`                                                                                      |
| F-09 | Nhập, xuất Excel                      | ✅     | Xong BE + FE + browser walk 2026-10-26; 27 ca tự động Passed, 3 Manual chưa chạy; TC_001 Failed 1/2 lượt do flake chooseOption chưa sửa. Mẫu mặc định nhãn SRS 4.3; còn nợ file Excel thật của Khoa — `docs/implement-report/f-09-excel-import-export-implement-report.md` |

## B3 — Đề cương và chuẩn đầu ra

| #    | Item                         | Status | Notes                                                                                                                                                                                                                                                                                              |
| ---- | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-10 | Đề cương                     | 🔄     | Mã xong; Playwright 37/37 Passed. Còn migration `syllabi`, `FILES_ROOT` bền vững và ca thủ công. — `docs/implement-report/f-10-syllabus-implement-report.md`                                                                                                                                       |
| F-11 | PLO, CLO, ma trận            | 🔄     | Mã xong; Playwright 49/49 Passed (F11-TC_063/F11-TC_026 sửa 2026-10-22); còn migration `outcomes` và ca thủ công. — `docs/implement-report/f-11-plo-clo-matrices-implement-report.md`                                                                                                              |
| F-12 | Công thức điểm, đánh giá–CLO | ✅     | Hoàn tất BE-01..BE-08, FE-01..FE-06 ngày 2026-10-27; còn Manual F12-TC_022..026 và đầu vào Khoa C1 (đơn vị/ngưỡng). — [Kế hoạch](../implementation/f-12-grade-formula-assessment-clo-implementation-plan.md); [Báo cáo](../implement-report/f-12-grade-formula-assessment-clo-implement-report.md) |

## B4 — Đề xuất thay đổi và phiên bản

| #    | Item                         | Status | Notes                                                                                                                                                                                                                                |
| ---- | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-13 | Đề xuất thay đổi             | 🔄     | Mã xong; Playwright 28/28 Passed. Còn migration `change_requests` + seed trên máy người dùng và ca thủ công. — `docs/implement-report/f-13-change-requests-implement-report.md`                                                      |
| F-14 | Duyệt ba cấp, thông báo      | 🔄     | Mã xong; Playwright 31/31 Passed. Migration đã áp trên `ctdt-dev-pg`; còn quyết định xóa/giữ bản làm việc và ca thủ công. — `docs/implement-report/f-14-three-level-approval-notifications-implement-report.md`                      |
| F-15 | Ban hành, ảnh chụp phiên bản | 🔄     | Mã xong; Playwright 33/33 Passed (F15-TC_001 sửa 2026-10-22); migration đã áp trên `ctdt-dev-pg`; còn seed học kỳ/khóa và ca thủ công. — `docs/implement-report/f-15-release-version-snapshots-implement-report.md`                  |
| F-16 | So sánh phiên bản, gán khóa  | ✅     | Hoàn tất BE-01..BE-07, FE-01..FE-06 và DOC-01 ngày 2026-10-27 — [Kế hoạch](../implementation/f-16-version-compare-cohort-assignment-implementation-plan.md); 22 Automated Passed, 5 Manual TC_023..027 + C9 còn nợ; F-12/F-17 đã hoàn tất, chờ chọn feature tiếp theo |
| F-26 | Sao lưu, diễn tập phục hồi   | ✅     | Mã xong BE-01..07 + CLI `pnpm backup:drill` + trang `/operations/backups`; spec restore-drill/verifier/files có. Diễn tập cục bộ 2026-10-31 với pg_dump 18.6: RESTORED 7/7, nghiệm thu SUCCEEDED, sửa 2 lỗi (bộ thiếu `files/`, mã lỗi nghiệm thu). Nợ vận hành: 7 đêm sao lưu, diễn tập B5/B6, sao chép ngoài máy, dữ liệu có bản ban hành; `ctdt_real` máy này thiếu 1 tệp `ChangeRequestDocument` — [Sổ tay](../technical/backup-restore-runbook.md), [Kế hoạch](../implementation/f-26-backup-restore-drill-implementation-plan.md) |

## B5 — Sinh viên, điều kiện đăng ký, xét tốt nghiệp

| #    | Item                             | Status | Notes                                                                                                                                                                        |
| ---- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-17 | Hồ sơ sinh viên, kết quả học tập | ✅ | BE-01..BE-10, FE-01..FE-06 và docs hoàn tất 2026-10-29; 28 Automated Passed + 4 Manual Not run. Playwright 14/14 gồm auth setup; còn matrix gaps BE-10, NFR-05/ngân sách test 100 giây, cấu hình khóa cục bộ và full suites chưa chạy lại — [Kế hoạch](../implementation/f-17-student-records-results-import-implementation-plan.md); [Báo cáo](../implement-report/f-17-student-records-results-import-implement-report.md) |
| F-18 | Điều kiện đăng ký học phần       | ✅     | [Kế hoạch](../implementation/f-18-course-registration-eligibility-implementation-plan.md); được người dùng chấp nhận với mặc định 2026-10-26; BE/FE/docs hoàn tất 2026-10-30 — [báo cáo](../implement-report/f-18-course-registration-eligibility-implement-report.md); còn Manual TC_015/016, C3 |
| F-19 | Xét tốt nghiệp                   | ✅     | Xét hàng loạt trong worker — [Kế hoạch](../implementation/f-19-graduation-review-implementation-plan.md); BE+FE có mã 2026-10-30: BE unit 363/363, BE e2e graduation 19/19 + batches 8/8 + corrections 10/10 + permission-table 185/185, FE 85/85; docs + test case F19 (35 = 19 Passed + 16 Manual) đồng bộ 2026-10-30; còn 16 ca Manual, đầu vào Khoa C4 — [Báo cáo](../implement-report/f-19-graduation-review-implement-report.md) |
| UI-01 | Điều hướng không gian làm việc CTĐT (`ProgramWorkspaceLayout`, `useUrlQuery`, `navigationMemory`) | ✅ | PR #35, 2026-10-31 |
| UI-02 | Dọn quan hệ học phần và `ProgramsUsingList` | ✅ | PR #37, 2026-10-31 |
| UI-03 | Rà soát nghiệp vụ và UI CTĐT / học phần / phê duyệt theo vai trò R5→R4→R3→R1 | 🔄 | Đang làm; test để sau cùng |
| DEV-01 | `pnpm dev:setup` dựng hạ tầng Docker một lệnh | ✅ | PR #34, 2026-10-31 |
| TAIGA-01 | Lập lại backlog Taiga: 13 sprint 15/06–15/12/2026 | ✅ | PR #36, 2026-10-31 |
| SMOKE-01 | Smoke checklist 29 kịch bản theo vai (`docs/testing/smoke-checklist.md`) thay cho 413 ca thủ công | ✅ | PR #43; chưa chạy vòng 1 (cần `source/e2e/.env`) |
| DEBT-01 | Tạo `source/e2e/.env` (`E2E_ADMIN_PASSWORD`, `E2E_PASSWORD`), chạy Playwright, duyệt luồng R5→R4→R3→R1, smoke vòng 1, chụp màn hình cho impeccable polish | ❌ | Người dùng tạo file |
| DEBT-02 | Thêm `REDIS_DB=0` vào `source/backend/.env.example` | ❌ | Người dùng làm (sửa của trợ lý bị từ chối quyền) |
| DEBT-03 | `ctdt_real` bị từ chối sao lưu `BACKUP_FILE_MISSING`: 1 `ChangeRequestDocument` trỏ tới tệp mất | ❌ | Khôi phục tệp hoặc xóa tài liệu trước khi bật sao lưu |
| DEBT-04 | Thay số quyết định giữ chỗ `DUT-<programCode>-<version>` (41 bản ban hành, PR #41) bằng số thật của Khoa | ❌ | Nợ Khoa |
| DEBT-05 | 213 dòng tự chọn ở 27/46 phiên bản chưa thuộc nhóm nào (nguồn không có tối thiểu; chưa mô hình quy tắc "chọn 1 trong N hướng") | ❌ | Nợ Khoa (C10) |
| DEBT-06 | Vận hành: 7 đêm sao lưu, diễn tập B5/B6, sao chép ngoài máy, fixture 300 học phần/500 sinh viên + k6 canonical, uptime dài hạn, NFR-02 trên phần cứng thật, bản 1.1 PENDING→ACTIVE ngày đầu học kỳ | ❌ | |
| DEBT-07 | Flake `chooseOption` chưa sửa; Taiga MCP không kết nối được trong phiên 2026-10-31 | ❌ | |
| F-20 | Cổng sinh viên                   | ✅     | Cổng sinh viên đã merge (PR #26–#31) vào main; còn Manual và đầu vào Khoa C4 (cập nhật 2026-10-31) |
| F-21 | API cho dDUT                     | ✅     | API dDUT đã merge (PR #26–#31) vào main; còn đầu vào Khoa C6 (cập nhật 2026-10-31) |

## B6 — Tích hợp, báo cáo, hoàn thiện

| #    | Item                                       | Status | Notes                                                                                                                                                                                    |
| ---- | ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-22 | Đồng bộ cơ sở dữ liệu Trường               | ✅     | Đồng bộ DB Trường đã merge (PR #26–#31) vào main; còn đầu vào Khoa C5 (cập nhật 2026-10-31) |
| F-23 | Báo cáo kiểm định | ✅ | [Kế hoạch](../implementation/f-23-accreditation-reports-implementation-plan.md); đã merge PR #29 (2026-10-31 xác nhận trong `git log`), còn ca thủ công |
| F-24 | Đồ thị, PDF, dòng thời gian, bảng sức khỏe | ✅     | Đã merge (PR #26–#31) vào main; còn đầu vào Khoa C7 (cập nhật 2026-10-31) |
| F-25 | Ủy quyền, email, nhắc hạn                  | ✅     | Đã merge (PR #26–#31) vào main; còn đầu vào Khoa C8 (cập nhật 2026-10-31) |
| F-27 | Triển khai, thử tải, theo dõi hoạt động    | ✅     | Xong: Node 24, Dockerfile BE/FE, `deploy/compose.yaml` + Caddyfile, bộ thu health, logger JSON tự viết (không pino, không Uptime Kuma — người dùng chốt 2026-10-31), kịch bản k6 chỉ-đọc + preflight với đường dẫn sinh viên đã xác minh. Nợ: fixture tổng hợp 300 học phần/500 sinh viên, chạy k6 canonical trên stack thật, bằng chứng uptime dài hạn — [Triển khai](../operations/deployment.md), [Kế hoạch](../implementation/f-27-deployment-load-test-monitoring-implementation-plan.md) |
