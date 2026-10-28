# Current Work — F-12 hoàn tất

**Start here**: **F-17** — đối chiếu `AdmissionEnrollmentInput.actorId: string | null` với source trước khi build (một executor khác đang dựng F-17 song song). Sau đó chạy lại các suite đầy đủ BE e2e, frontend và Playwright. Kế hoạch được người dùng chấp nhận với mặc định ngày **2026-10-26**; vẫn giữ các đầu vào Khoa chưa có.

## F-12 đã hoàn tất — bằng chứng ngày 2026-10-27

- BE-01..BE-08 và FE-01..FE-06 đã có mã; migration `20261027154125_grade_formula_assessment_clo` đã áp dụng vào DB phát triển. Chi tiết: [báo cáo triển khai](../implement-report/f-12-grade-formula-assessment-clo-implement-report.md).
- Backend: tsc 0, oxlint 0, unit 1192/1192, e2e đầy đủ 455/455. Frontend: `tsc -b` 0, oxlint 0, vitest 213/213 với `--testTimeout=30000` (ở 5000 ms có 5-6 timeout không liên quan khi máy tải). Playwright F-12 4/4.
- Còn nợ riêng F-12: **Manual F12-TC_022..026** và **C1** (đơn vị/ngưỡng công thức). F-23 có thể bắt đầu về phía F-12 nhưng vẫn chưa build.
- F-16: còn Manual TC_023..027 và C9 (lịch học kỳ chính thức/fixture nghiệm thu đã khử dữ liệu nhạy cảm).

## Session Context

- **Last updated**: 2026-10-27.
- 16 tính năng đã có mã hoàn tất: F-01..F-09, F-10, F-11, F-12, F-13, F-14, F-15, F-16 (13 MVP + F-09 + F-12 + F-16). Kế hoạch sau MVP được chấp nhận với giới hạn §8; không còn gate quyết định A1..A12/B1/B2. Hoàn tất mã không thay thế các ca thủ công hoặc nghiệm thu Khoa còn nợ.
- F-15 `createdByAcademicOffice` đã chốt; đính chính là thay thế hành chính hồi tố và lịch học kỳ theo chính sách hiện tại. Không hứa lịch sử bất biến trước đính chính, không lên kế hoạch history/freeze; mỗi lần xét F-19 chụp đúng đầu vào.
- Công thức điểm không có ngoại lệ học kỳ đã bắt đầu (E1, người dùng chốt 2026-10-26); GRADING_FORMULA đi hết ba cấp duyệt như các loại đề cương khác.
- F-21 dùng `PortalProgressReader` của F-20, không có engine tiến độ thứ hai. SCHOOL_DB dùng actor hệ thống nullable và ghi nguồn; hồ sơ mới không tự tạo tài khoản.

## Còn nợ MVP, F-09, F-12 và F-16

- **391 ca thủ công** chưa chạy, đếm lại từ [chỉ mục kiểm thử](../testing/test-cases/README.md): 842 ca = 451 tự động Passed + 391 thủ công (MVP 378 + F-09 3: F09-TC_015/016/025 + F-16 5: F16-TC_023..027 + F-12 5: F12-TC_022..026). [Bàn giao](handoff.md) giữ kết quả MVP lịch sử; không cộng 9 auth setup hoặc đếm trùng 5 ca xuyên tính năng.
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

**F-17 → các suite đầy đủ BE e2e / frontend / Playwright** (BE e2e giữ cấu hình max_connections=300 hiện hữu). Sau đó **F-23 → F-25 → F-24 → F-18 → F-19 → F-22 → F-20 → F-21**. Các tính năng phía sau vẫn chưa build; kiểm lại source/hợp đồng dependency khi triển khai.

**F-26/F-27: hoãn theo người dùng ngày 2026-10-26, không xếp lịch; giữ nguyên kế hoạch.**
