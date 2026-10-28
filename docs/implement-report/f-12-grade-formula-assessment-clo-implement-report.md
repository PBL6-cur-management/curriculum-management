# F-12 — Báo cáo triển khai

## Trạng thái (cập nhật 2026-10-27)

- **Tiến độ**: BE-01..BE-08 và FE-01..FE-06 đã có mã và đã kiểm chứng; không còn quyết định chờ. 21 ca tự động trong TC doc Passed, 5 ca thủ công F12-TC_022..026 chưa chạy.
- **Nhánh**: main, không thao tác git ghi.
- **Cơ sở dữ liệu**: migration `20261027154125_grade_formula_assessment_clo` đã áp dụng vào DB phát triển; `migrate status` báo up to date.
- **Ảnh hưởng runtime hiện tại**: hai endpoint PUT `grading-formula` và `assessment-clo-mappings`; yêu cầu GRADING_FORMULA đi hết ba cấp duyệt và ban hành bản mới; ba cổng (gửi duyệt, ban hành, duyệt cuối) chặn CLO chưa được đánh giá; công thức không có ngoại lệ học kỳ đã bắt đầu (E1). Trình sửa đề cương có sáu tab.
- **Kiểm chứng cuối**: backend tsc 0, oxlint src test 0, unit 135 file / 1192 test Passed, e2e đầy đủ trước đó 27 file / 455 Passed (sau Prettier chạy lại `grade-formula` + `permission-table` 170/170); frontend `tsc -b` 0, `oxlint src` 0, vitest `syllabi change-requests releases auth` 45 file / 213 test Passed với `--testTimeout=30000` (ở timeout mặc định 5000 ms có 5-6 test không liên quan timeout khi máy tải); Playwright F-12 4/4 Passed.

## Bảng tổng hợp

| ID    | File chính                                                                                                                                                                                                                                      | Kiểm chứng                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| BE-01 | `prisma/schema.prisma`, migration `20261027154125_...` (5 CHECK)                                                                                                                                                                                | `migrate dev` áp dụng, `migrate status` up to date, `prisma generate` |
| BE-02 | `shared/syllabi/grade-formula.{errors,rules}.ts`, `syllabus-assessment-lock.ts` + 2 spec                                                                                                                                                        | vitest 13/13                                                          |
| BE-03 | `features/syllabi/grade-formula.{dto,service}.ts`, controller, module, `grade-formula.service.spec.ts`                                                                                                                                          | vitest 22/22                                                          |
| BE-04 | `clo.dto.ts`, `syllabus.dto.ts`, `syllabi.service.ts`, `clos.service.ts` + sửa fixture 2 spec, thêm ca mới                                                                                                                                      | `vitest run src/features/syllabi` 4 file Passed; tsc 0                |
| BE-05 | `shared/change-requests/request-kinds.ts`, `change-request.constants.ts`, copier/snapshot/diff, `final-approval.service.ts`, `change-request-detail.reader.ts`                                                                                  | tsc 0; spec liên quan Passed; `final-approval` 32/32                  |
| BE-06 | `shared/releases/syllabus-release-issues.ts`, `assessment-blockers.ts`, `submission.service.ts`, releases                                                                                                                                       | `src/features/releases` 111/111; e2e releases                         |
| BE-07 | `change-requests/grading-changes.ts`, `final-approval.service.ts` (`assertSemesterAllowed`), `final-approval.preview.ts`                                                                                                                        | `final-approval` 32/32; e2e F12-TC_017                                |
| BE-08 | `test/grade-formula.e2e-spec.ts` (15 test), `test/fixtures/assessments.ts`, `test/fixtures/releases.ts`, `test/permission-table.ts`                                                                                                             | e2e đầy đủ 27 file / 455 Passed                                       |
| FE-01 | `shared/api/schema.d.ts`, `shared/auth/permissions.ts`, alias API, `testFixtures.ts`                                                                                                                                                            | `tsc -b` 0                                                            |
| FE-02 | `api/syllabi.ts`, `hooks/useGradeFormula.ts`, `utils/gradeFormulaValues.ts`, `constants/gradeFormulaLabels.ts`                                                                                                                                  | `gradeFormulaValues.test.ts`, `useGradeFormula.test.tsx` Passed       |
| FE-03 | `GradeFormulaTab.tsx`, `StaleAssessmentAlert.tsx`, `hooks/useEditorRemountKey.ts`                                                                                                                                                               | `GradeFormulaTab.test.tsx` 5/5                                        |
| FE-04 | `AssessmentCloTab.tsx`, `AssessmentCoverageAlert.tsx`                                                                                                                                                                                           | `AssessmentCloTab.test.tsx` 4/4                                       |
| FE-05 | `SyllabusEditorPage.tsx`, `SyllabusActions.tsx`, `GradeFormulaView.tsx`, `SyllabusSections.tsx`, `RequireAnyPermission.tsx`, `router.tsx`, `requestTypes.ts`, `workspaceLinks.ts`, `FinalApprovalPreview.tsx`, `releaseLabels.ts`, `CloTab.tsx` | vitest các file tương ứng Passed                                      |
| FE-06 | Test điều chỉnh (AttachmentPanel, SyllabusEditorPage, SyllabusPage, ChangeRequestFormPage, prefill, WorkspaceCard, InitialReleasePage), TC doc, Playwright spec                                                                                 | Playwright 4/4; vitest 213/213                                        |

## BE-01

- **Deviation**: tên thư mục migration là `20261027154125_grade_formula_assessment_clo` (kế hoạch ghi `20261025000000`); không trùng.
- **Decision during build**: `prisma format` căn lại khoảng trắng toàn schema (nhiễu định dạng trong diff), giữ nguyên.

## BE-04

- **Decision during build**: `gradingEditPath` trả `null` (không phải `VIA_REQUEST`) khi bản sao yêu cầu mà người gọi không có ô quyền chỉnh công thức; đường nội dung vẫn rơi về `VIA_REQUEST`.
- **Deviation**: không tạo lớp `GradingAccessDto` như đoạn mã trong kế hoạch; hai trường thêm thẳng vào `CourseSyllabusDto` theo văn bản kế hoạch.
- Fixture `syllabi.service.spec.ts` và `clos.service.spec.ts` được bổ sung cộng thêm (`failingScore`, `assessmentComponents`, `_count`, `$queryRaw`), không đổi assertion cũ.

## BE-05 — dừng (lượt đầu, giữ nguyên)

- **Incident / mismatch**: `final-approval.service.ts:35` (`NOT_FINAL_TYPES`) và `change-request-detail.reader.ts:50` (`NO_FINAL_APPROVAL`) xếp GRADING_FORMULA vào nhóm kết thúc ở cấp 3 bằng "Đồng ý" thường; `finalLevelRequest` (`final-approval.service.ts:160`) trả `FINAL_APPROVAL_NOT_APPLICABLE`. Test hiện có `final-approval.service.spec.ts:317` ("keeps organisational and grading-formula requests on the plain approve") khẳng định hành vi đó. Kế hoạch (§BE-07, dòng 678) giả định yêu cầu công thức điểm đi qua phê duyệt cuối và xuất bản như đề cương; không nhắc hai hằng này. Bật GRADING_FORMULA mà giữ hai hằng thì yêu cầu không bao giờ được áp dụng; gỡ chúng làm test cũ đỏ nên không tự sửa.
- **Lesson worth keeping**: kế hoạch cần liệt kê mọi nơi mã hóa "loại X là loại đặc biệt" (grep tên enum), không chỉ các điểm bật tính năng.

## BE-05 — giải quyết

- **Deviation**: theo quyết định Option 1 của orchestrator (2026-10-27), bỏ GRADING_FORMULA khỏi `NOT_FINAL_TYPES` và `NO_FINAL_APPROVAL`; chỉ ORGANIZATION còn nằm ngoài duyệt cuối. Spec "ai được gọi" thu hẹp về ORGANIZATION và thêm spec dương: GRADING_FORMULA tới được duyệt cuối. Bị loại: giữ ngoại lệ và để công thức dừng ở cấp 3 (không ban hành được).
- Test e2e `change-requests` "từ chối loại công thức" đảo thành chấp nhận (kế hoạch yêu cầu bật loại này).

## BE-06

- **Decision during build**: `collectSyllabusIssues` kiểm cả bản ghim và bản kế thừa; fixture e2e cũ (releases, change-requests, final-approval) cần dữ liệu đánh giá nên thêm `makeAssessmentReady`. Hành vi ghim/ban hành đổi có chủ ý theo kế hoạch; `syllabus-release-issues.spec` và `syllabus.publisher.spec` cập nhật (publisher viết lại).
- **Decision during build**: tách `assessment-blockers.ts` dùng chung cho gửi duyệt, ban hành và duyệt cuối thay vì lặp ba chỗ.

## BE-07

- **Decision during build**: thêm `grading-changes.ts` (`hasGradingChanges`) và tham số `changesGrading` cho `assertSemesterAllowed`; thay đổi công thức bị từ chối học kỳ đã bắt đầu trước ngoại lệ Phòng đào tạo; `canAllowPastSemester` của bản xem trước là false với công thức. Thay đổi chỉ điểm liệt vẫn tính là thay đổi công thức.
- Số dòng `assertSemesterAllowed` hiện ở `final-approval.service.ts:143-152` (kế hoạch ghi `:145`); đã sửa trong kế hoạch.

## BE-08

- 15 test e2e trong `grade-formula.e2e-spec.ts`; `permission-table.ts` thêm hai route PUT. **Lesson worth keeping**: khi cổng kiểm tra phát hành mở rộng sang bản ghim/kế thừa, mọi fixture e2e tạo bản ban hành đều phải có dữ liệu mới; grep các helper tạo bản ban hành trước khi chạy suite đầy đủ.

## FE-01..FE-05

- **Decision during build**: `useReplaceGradeFormula` và `useReplaceAssessmentMappings` chờ làm mới (Promise.all) khóa đề cương, `CHANGE_REQUEST_QUERY_ROOT` và `['releases']` trước khi mutation kết thúc; khóa `['releases']` lặp lại cục bộ vì feature không import lẫn nhau.
- **Decision during build**: `GradeFormulaTab` dùng trường `id` ẩn trong `Form.Item` để giữ id dòng đã lưu. **Lesson worth keeping**: `Form.List` bỏ giá trị không có `Form.Item` đăng ký, nên id server phải có field ẩn, nếu không lần lưu sau tạo lại thành phần và mất ánh xạ.
- **Deviation**: thêm `StaleAssessmentAlert.tsx` và các prop tùy chọn `onNavigateTab`, `onDirtyChange`, `canEditContent`, `canEditGradingFormula` trong `EditorTabProps` (kế hoạch không liệt kê); `COVERAGE_HINT` chỉ hiện trong cảnh báo phủ CLO để tránh lặp.
- **Decision during build**: `SyllabusEditorPage` vào được khi có một trong ba quyền (nội dung, CLO, công thức) qua `RequireAnyPermission`; test "kết quả info" của trang truyền `canEditClos:false` vì người chỉ có quyền CLO nay vào được trình sửa.
- `GradeFormulaView` không in tiêu đề khi chưa có thành phần (chỉ một dòng chữ phụ) để ca F10-TC_001 "chưa có công thức điểm" vẫn đúng.

## FE-06

- **Incident**: Playwright F12-TC_004 lượt 1 Failed: sau khi lưu ánh xạ, lưới dựng lại bằng dữ liệu cũ (checkbox bỏ chọn, thẻ Chưa được đánh giá còn). Cơ chế: tab dựng lại ngay khi mutation kết thúc, trước khi query đề cương đẩy dữ liệu mới xuống props; `cells` là `useState` nên không cập nhật theo props sau đó. Sửa: `hooks/useEditorRemountKey.ts` thêm `updatedAt` vào khóa dựng lại khi trình sửa sạch, giữ nguyên khi đang có dữ liệu nhập (lời hứa của cảnh báo dữ liệu cũ); dùng cho cả hai tab. Lượt sau 4/4 Passed (lượt trung gian có chèn log gỡ lỗi cũng Passed và cho thấy server đã lưu ánh xạ).
- **Incident**: F12-TC_001..004 lượt 1 Failed vì nút "Thêm thành phần" có icon nên tên truy cập không khớp `exact: true`; bỏ `exact`. F12-TC_003 ban đầu giả định nút lưu tắt với mã trùng; thực tế nút lưu bấm được và lỗi hiện trên dòng, spec sửa cho đúng hành vi.
- **Lesson worth keeping**: state khởi tạo từ props bằng `useState` cộng khóa dựng lại theo số lần lưu là không đủ; khóa phải gắn với phiên bản dữ liệu server, vì mutation có thể kết thúc trước khi props mới tới.
- vitest ở timeout 5000 ms có 5-6 test không liên quan (CohortVersionAssignmentForm, CohortVersionAssignmentsPage, VersionHistoryPage, OrganizationalItemsEditor, InitialReleasePage) và một lần GradeFormulaTab timeout khi máy tải; chạy lại với `--testTimeout=30000` toàn bộ 213/213.
- Đường dẫn TC doc theo orchestrator: `docs/testing/test-cases/f-12-grade-formula-assessment-clo-test-cases.md` (kế hoạch ghi `docs/testing/feature__f-12-...md`; kế hoạch đã sửa).
- Công cụ: heredoc Bash dài nhiều dấu nháy nhiều lần lỗi "unexpected EOF"; dùng Write/Edit cho file nhiều dòng.
