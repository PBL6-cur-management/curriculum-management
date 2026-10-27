# Current Work — In Progress

**Start here**: kiểm chứng lượt Codex **F-16 FE** (FE-02..FE-06 + TC doc + Playwright spec) rồi tiếp **F-12 → F-17**, theo kế hoạch được người dùng chấp nhận với mặc định ngày **2026-10-26**. F-09 đã xong BE + FE + browser walk; F-16 chưa xong, không đánh dấu hoàn tất.

### Điểm tiếp tục F-16 (dừng 2026-10-26 23:40)

- **BE đã kiểm chứng**: tsc/oxlint/Prettier sạch, unit 1134/1134, e2e `version-comparison` + `cohort-versions` 18/18, hồi quy `releases`/`corrections`/`permission-table`/`users` Passed. `schema.d.ts` đã sinh lại (FE-01), frontend `tsc -b` 0.
- **FE đã có mã, kiểm chứng một phần**: lượt Codex (session `01a17878-5ac1-77d3-9e8f-e6d6edc4c696`) xong lúc 23:48, PARTIAL — FE-02..FE-06, TC doc 27 ca (chưa chạy) và Playwright spec 5 test đã có; 40 file đổi khớp report. Orchestrator chạy lại: frontend `tsc -b` 0, `oxlint src` 0, `source/e2e` typecheck 0; vitest `src/features/releases` + `ProgramOverviewPage.test.tsx` lần 1 có 3 test Failed (không lấy tên, chạy ngay sau tsc/oxlint khi máy thiếu bộ nhớ), lần 2 81/81 Passed — chưa loại trừ flake. Prettier 4 file Markdown F-16 + README chưa sạch.
- **Còn nợ F-16**: chạy toàn bộ suite FE, chạy Playwright F-16 (cần khởi động lại dev server BE :3000 và FE :5173 — cả hai bị Claude Code dừng vì thiếu bộ nhớ lúc 23:05), ghi kết quả TC, cập nhật tổng README, DOC-01, TC_023..027 thủ công.
- Sau F-16: F-12 (lệch BE-07 `SEMESTER_ALREADY_STARTED`) → F-17 (lệch `AdmissionEnrollmentInput.actorId: string | null`), rồi suite đầy đủ BE e2e (`max_connections=300` trong `test/containers.ts`), FE và luồng Playwright đầy đủ.

## Session Context

- **Last updated**: 2026-10-26.
- 14 tính năng đã có mã hoàn tất: F-01..F-09, F-10, F-11, F-13, F-14, F-15 (13 MVP + F-09). F-16 FE đang triển khai, chưa cộng vào số hoàn tất. Kế hoạch sau MVP được chấp nhận với giới hạn §8; không còn gate quyết định A1..A12/B1/B2.
- F-15 `createdByAcademicOffice` đã chốt; đính chính là thay thế hành chính hồi tố và lịch học kỳ theo chính sách hiện tại. Không hứa lịch sử bất biến trước đính chính, không lên kế hoạch history/freeze; mỗi lần xét F-19 chụp đúng đầu vào.
- F-21 dùng `PortalProgressReader` của F-20, không có engine tiến độ thứ hai. SCHOOL_DB dùng actor hệ thống nullable và ghi nguồn; hồ sơ mới không tự tạo tài khoản.

## Còn nợ MVP và F-09

- **381 ca thủ công** chưa chạy, đếm lại từ [chỉ mục kiểm thử](../testing/test-cases/README.md): 789 ca = 408 tự động Passed + 381 thủ công (MVP 378 + F-09 3: F09-TC_015/016/025). [Bàn giao](handoff.md) giữ kết quả MVP lịch sử; không cộng 9 auth setup hoặc đếm trùng 5 ca xuyên tính năng.
- Luồng MVP-TC_001..005 đã Passed ở lần 3 và 4 ngày 2026-10-25 (14 Passed gồm 9 setup + 5 ca nghiệp vụ, 1.7 phút/lần); không cộng setup vào số ca nghiệp vụ.
- Chưa kiểm chứng đúng bản **1.1 từ PENDING → ACTIVE** vào ngày đầu học kỳ với worker thật đang chạy, cùng thay đổi bản đang áp dụng; không đổi ngày seed hay dùng endpoint test để thay bằng chứng này.
- **Flake `chooseOption` chưa sửa**: lần 2/4 tại `fixtures/select.ts:22`, qua `fixtures/curriculum.ts:27`, combobox `plannedSemester` còn `aria-expanded=true` sau 10 giây. Ngày 10/26/26 cũng gặp ở F09-TC_001 qua `specs/f-09-excel-import-export.spec.ts:22`: Loại dữ liệu vẫn aria-expanded=true, value rỗng sau 10 giây (Failed 1/2 lần, TC giữ Passed theo lượt thành công). Đã xuất hiện ở spec thứ hai; các lượt Passed không chứng minh hết flake. Không sửa fixture.
- Migration/seed trên máy người dùng, dữ liệu giữ chỗ, năm mặc định DUT cần xác nhận và môi trường dữ liệu thật riêng vẫn theo [handoff §3.3](handoff.md); không suy trạng thái máy người dùng từ database kiểm chứng. `FILES_ROOT` cần ổ bền và sao lưu cùng DB.

## Chờ người dùng quyết định

Không còn quyết định sản phẩm/hợp đồng A1..A12/B1/B2. Việc ngoài đợt build vẫn cần đồng ý riêng: sửa template `E:\claude-code-templates` và cài pnpm qua Volta; không thực hiện trong lượt này.

### Đầu vào Khoa còn nợ (đang build theo mặc định)

- **C1**: đơn vị/ngưỡng công thức — [F-12 §8, E2](../implementation/f-12-grade-formula-assessment-clo-implementation-plan.md#8-risks-and-open-items).
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

Sau F-16 FE → F-12 → F-17: **F-23 (cần F-12) → F-25 → F-24 → F-18 → F-19 → F-22 → F-20 → F-21**. Các tính năng phía sau vẫn chưa build; kiểm lại source/hợp đồng dependency khi triển khai.

**F-26/F-27: hoãn theo người dùng ngày 2026-10-26, không xếp lịch; giữ nguyên kế hoạch.**
