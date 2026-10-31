# Current Work — F-20..F-25 đã merge; rà soát nghiệp vụ và UI CTĐT/học phần/phê duyệt

**Start here**: đi luồng phê duyệt theo vai trò R5→R4→R3→R1 trên UI, rà nghiệp vụ và tiếp tục chỉnh UI CTĐT / học phần / phê duyệt; test để sau cùng. Chưa build: F-26, F-27 (hoãn). Taiga (Phase 6) đã lập lại 13 sprint (PR #36).

## Việc đã merge 2026-10-31

- F-20..F-25 đã có trên main (PR #26–#31); các mục "Up Next" bên dưới về F-22 → F-20 → F-21 và việc hoãn F-23/24/25 là lịch sử, không còn đúng.
- PR #34 `pnpm dev:setup` (hạ tầng Docker PostgreSQL/Redis/Mailpit, mã chạy trên máy); PR #35 `ProgramWorkspaceLayout` lồng mọi route `/programs/:programId/...` + `useUrlQuery` + `navigationMemory`/`BackLink preferHistory`; PR #36 Taiga 13 sprint; PR #37 dọn quan hệ học phần. Chi tiết: progress_log 2026-10-31.

## Dữ liệu thật DUT và cải tổ UI — 2026-10-30

- DB duy nhất `ctdt_real`: `prisma:migrate` → `prisma:seed` → `dut:extract` → `prisma:seed:dut`. Dữ liệu cá nhân ở `prisma/seed-data/dut/data/private/` (gitignore). Mật khẩu tạm giảng viên: `lecturer-credentials.csv` trong thư mục đó.
- E2E: điền `E2E_PASSWORD` trong `source/e2e/.env`; setup/teardown tự dựng và dọn thế giới `e2e.*`.
- Chưa chạy lại bộ test đầy đủ sau PR #6.

## F-19 có mã hoàn tất — 2026-10-30

- BE-01..BE-12, FE-01..FE-06, DOC-01 đã có; migration `20261030050730_graduation_review`. BE unit 363/363; BE e2e graduation 19/19, batches 8/8, corrections 10/10, permission-table 185/185; FE tsc 0, oxlint 0, vitest 85/85. Chi tiết: [báo cáo F-19](../implement-report/f-19-graduation-review-implement-report.md), progress_log 2026-10-30.
- Còn nợ: 16 ca Manual F19-TC_020..035 (`docs/testing/test-cases/f-19-graduation-review-test-cases.md`), đầu vào Khoa C4, tách view kết quả sang shared khi build F-20.
- BE và FE dev server đang tắt (bị dừng do thiếu bộ nhớ); khởi động lại khi cần.

## F-18 và loại tài liệu đính kèm đã hoàn tất — 2026-10-30

- F-18: BE unit 179/179, BE e2e 226/226, FE 75/75, Playwright F-07 35/35; không migration. Còn Manual F18-TC_015/016, C3, số đo NFR-02 trên phần cứng thật. Chi tiết: [báo cáo F-18](../implement-report/f-18-course-registration-eligibility-implement-report.md).
- Loại tài liệu đính kèm (`materialKind`, 50 MB): kiểm chứng xong; người dùng cần đổi `ATTACHMENT_MAX_MB=20` trong dotenv cục bộ thành 50 nếu còn. Chi tiết: progress_log 2026-10-29/30.

## F-17 đã hoàn tất — bằng chứng ngày 2026-10-29

- BE-01..BE-10, FE-01..FE-06, TC doc/spec và docs đã có; migration `20261027165710_student_records_results`. Chi tiết: [báo cáo triển khai](../implement-report/f-17-student-records-results-import-implement-report.md).
- Orchestrator chạy từng spec riêng trên dev server thật: F-17 14/14 (gồm auth setup), F-16 14/14, F-15 42/42, F-13 37/37, mvp-flow 14/14; e2e tsc 0, frontend tsc -b 0. Targeted unit đã xác nhận trước đó: BE 109/109, FE 58/58 với --testTimeout=30000; không coi là full suites chạy lại.
- Còn nợ F-17: **Manual F17-TC_029..032**, matrix gaps BE-10 trong report, NFR-05 (ngân sách test 100 giây đã chốt nhưng không đính chính mục tiêu 60 giây; chưa đo lại), người dùng tự thêm STUDENT_CREDENTIAL_ENCRYPTION_KEY base64 của 32 byte vào dotenv cục bộ. Browser dùng process env tạm, không có khóa nào được ghi vào docs.
- **F-12 đã hoàn tất 2026-10-27**; còn Manual F12-TC_022..026 + C1; bằng chứng chi tiết giữ tại [báo cáo F-12](../implement-report/f-12-grade-formula-assessment-clo-implement-report.md).

## Session Context

- **Last updated**: 2026-10-31.
- 18 tính năng đã có mã hoàn tất: F-01..F-18 (13 MVP + F-09 + F-12 + F-16 + F-17 + F-18). Kế hoạch sau MVP được chấp nhận với giới hạn §8; không còn gate quyết định A1..A12/B1/B2. Hoàn tất mã không thay thế các ca thủ công hoặc nghiệm thu Khoa còn nợ.
- F-15 `createdByAcademicOffice` đã chốt; đính chính là thay thế hành chính hồi tố và lịch học kỳ theo chính sách hiện tại. Không hứa lịch sử bất biến trước đính chính, không lên kế hoạch history/freeze; mỗi lần xét F-19 chụp đúng đầu vào.
- Công thức điểm không có ngoại lệ học kỳ đã bắt đầu (E1, người dùng chốt 2026-10-26); GRADING_FORMULA đi hết ba cấp duyệt như các loại đề cương khác.
- F-21 dùng `PortalProgressReader` của F-20, không có engine tiến độ thứ hai. SCHOOL_DB dùng actor hệ thống nullable và ghi nguồn; hồ sơ mới không tự tạo tài khoản.

## Còn nợ MVP, F-09, F-12, F-16, F-17 và F-18

- **413 ca thủ công** chưa chạy, đếm lại từng dòng trong 19 file từ [chỉ mục kiểm thử](../testing/test-cases/README.md): 925 ca = 512 tự động Passed + 413 thủ công (MVP 378 + F-09 3: F09-TC_015/016/025 + F-16 5: F16-TC_023..027 + F-12 5: F12-TC_022..026 + F-17 4: F17-TC_029..032 + F-18 2: F18-TC_015/016 + F-19 16: F19-TC_020..035). [Bàn giao](handoff.md) giữ kết quả MVP lịch sử; không cộng auth setup hoặc đếm trùng 5 ca xuyên tính năng.
- Luồng MVP-TC_001..005 đã Passed ở lần 3 và 4 ngày 2026-10-25 (14 Passed gồm 9 setup + 5 ca nghiệp vụ, 1.7 phút/lần); không cộng setup vào số ca nghiệp vụ.
- Chưa kiểm chứng đúng bản **1.1 từ PENDING → ACTIVE** vào ngày đầu học kỳ với worker thật đang chạy, cùng thay đổi bản đang áp dụng; không đổi ngày seed hay dùng endpoint test để thay bằng chứng này.
- **Flake `chooseOption` chưa sửa**: lần 2/4 tại `fixtures/select.ts:22`, qua `fixtures/curriculum.ts:27`, combobox `plannedSemester` còn `aria-expanded=true` sau 10 giây. Ngày 10/26/26 cũng gặp ở F09-TC_001 qua `specs/f-09-excel-import-export.spec.ts:22`: Loại dữ liệu vẫn aria-expanded=true, value rỗng sau 10 giây (Failed 1/2 lần, TC giữ Passed theo lượt thành công). Đã xuất hiện ở spec thứ hai; các lượt Passed không chứng minh hết flake. Không sửa fixture.
- Migration/seed trên máy người dùng, dữ liệu giữ chỗ, năm mặc định DUT cần xác nhận và môi trường dữ liệu thật riêng vẫn theo [handoff §3.3](handoff.md); không suy trạng thái máy người dùng từ database kiểm chứng. `FILES_ROOT` cần ổ bền và sao lưu cùng DB.

## Chờ người dùng quyết định

Không còn quyết định sản phẩm/hợp đồng A1..A12/B1/B2. Việc ngoài đợt build vẫn cần đồng ý riêng: sửa template `E:\claude-code-templates` và cài pnpm qua Volta; không thực hiện trong lượt này.

### Đầu vào Khoa còn nợ (đang build theo mặc định)

- **C1**: đơn vị/ngưỡng công thức — [F-12 §8, E2](../implementation/f-12-grade-formula-assessment-clo-implementation-plan.md#8-risks-and-open-items); F-12 đã build theo mặc định không đơn vị.
- **C2**: tài khoản, phát mật khẩu, mẫu nhập, retention — [F-17 §8, E3](../implementation/f-17-student-records-results-import-implementation-plan.md#8-risks-and-open-items).
- **C3**: miễn học và chính sách điều kiện — [F-18 §8, E3](../implementation/f-18-course-registration-eligibility-implementation-plan.md#8-risks-and-open-items).
- **C4**: điều kiện tốt nghiệp, miễn học, phân bổ/tín chỉ tự do — [F-19 §8, E2/E3](../implementation/f-19-graduation-review-implementation-plan.md#8-risks-and-open-items), [F-20 §8, E2](../implementation/f-20-student-portal-implementation-plan.md#8-risks-and-open-items).
- **C5**: hợp đồng DB Trường, quyền đọc và nguồn thật — [F-22 §8, E1](../implementation/f-22-school-db-sync-implementation-plan.md#8-risks-and-open-items).
- **C6**: giữ/phát khóa dDUT và retention nhật ký — [F-21 §8, E1/E4](../implementation/f-21-ddut-api-implementation-plan.md#8-risks-and-open-items).
- **C7**: mẫu PDF, font có phép, Chromium/host — [F-24 §8, E2/E3](../implementation/f-24-graphs-pdf-timeline-health-implementation-plan.md#8-risks-and-open-items).
- **C8**: SMTP, danh tính gửi và TLS — [F-25 §8, E1](../implementation/f-25-delegation-email-reminders-implementation-plan.md#8-risks-and-open-items).
- **C9**: lịch học kỳ chính thức và fixture nghiệm thu đã khử dữ liệu nhạy cảm — [F-16 §8, E4](../implementation/f-16-version-compare-cohort-assignment-implementation-plan.md#8-risks-and-open-items).

- **C10**: file Excel thật của Khoa cho F-09 (mặc định nhãn SRS 4.3); TC_025 chưa kiểm được tương thích DL-2.

Các mục trên **chưa được Khoa trả lời**. Người dùng cho phép build bằng mặc định của từng kế hoạch, không coi đó là chứng nhận dữ liệu/chính sách hay sẵn sàng bật tích hợp thật.

## Up Next

**F-22 → F-20 → F-21**. Các tính năng này chưa build; kiểm lại source/hợp đồng dependency khi bắt đầu. Full suites BE e2e/frontend/Playwright chưa chạy lại; đây là nợ kiểm chứng, không tự chạy hoặc đặt làm gate chọn feature trong lượt docs. BE e2e giữ cấu hình max_connections=300 hiện hữu khi có lượt chạy được giao.

**F-26/F-27: hoãn theo người dùng ngày 2026-10-26, không xếp lịch; giữ nguyên kế hoạch.**

**F-23: hoãn theo người dùng ngày 2026-10-29 (vượt phạm vi cần lúc này), không xếp lịch; giữ nguyên kế hoạch.**

**F-24/F-25: hoãn theo người dùng ngày 2026-10-29 (chưa cần), không xếp lịch; giữ nguyên kế hoạch. C7/C8 không còn chặn tính năng đang xếp lịch.**
