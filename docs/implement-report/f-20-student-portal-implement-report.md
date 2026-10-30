# F-20 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu (2026-10-31)**: cổng sinh viên `/student` (MH-55..59) và API `/api/portal/*` đã có mã và test. Nhánh `feat/f-20-student-portal`.
- **Không migration, không gói mới.** Mọi GET của cổng chỉ đọc.
- **Bằng chứng**:
  - BE e2e `test/student-portal.e2e-spec.ts` 6/6; cùng lượt chạy 12 suite liên quan (programs, outcomes, graduation, students, registration-eligibility, courses, course-relations, equivalence-groups, releases, student-version-resolution, syllabi, permission-table): tổng 358 test xanh sau khi sửa kỳ vọng outcomes.
  - BE unit `src/shared/{authz,students,graduation}` 281/281.
  - FE vitest `features/student-portal` 7/7; `tsc -b` 0; oxlint sạch.
  - Playwright `f-20-student-portal.spec.ts` 2/2 (sinh viên tổng hợp nhập qua F-17, đăng nhập bằng mật khẩu một lần, đổi mật khẩu, duyệt 5 màn hình ở 360px không cuộn ngang). F-17 spec 5/5 chạy lại xanh.

## Bảng tổng hợp

| ID | File | Kiểm chứng |
|---|---|---|
| BE-01..05 | `features/student-portal/*` (`/portal/me`, `/curriculum`, `/plos`, `/curriculum-items/:itemId/syllabus`, tệp đính kèm) | e2e 6/6 |
| BE-06 | `shared/authz/scope-source.reader.ts`, `shared/authz/scope.service.ts` | unit + e2e outcomes/programs |
| FE-01..08 | `features/student-portal/*`, `routes.ts`, `router.tsx`, `shared/auth/permissions.ts` | vitest 7/7; Playwright 360px |

## Quyết định trong lúc build (lệch so với plan)

- **Đọc theo phiên, không theo mã sinh viên trên URL** cho phần mới (`/portal/*`). Tiến độ, kết quả, tư vấn đăng ký và xét tốt nghiệp dùng lại đúng các endpoint dùng chung `/students/:id/...` (đã kiểm tra quyền sở hữu R6), nên kết quả của sinh viên và của R1/R3 cùng một cách tính (US-094 AC4).
- **Trạng thái học phần**: hoàn thành lấy từ F-18 (`completed`, có học phần tương đương); lần học lấy từ F-17. Không có bộ tính thứ hai. `PASSED_EQUIVALENT` không nêu mã học phần tương đương đã học (F-18 chưa trả bằng chứng cho dòng đã hoàn thành) — còn nợ US-093 AC2 phần "nêu mã".
- **Tiến độ** hiển thị tín chỉ từ F-19 `GraduationEvaluator`; khi không tính được thì báo, không vẽ 0.
- **BE-06 rộng hơn plan**: tài khoản R6 thật được tạo với gán vai trò phạm vi SYSTEM, khiến mọi quyền SCOPED (program.view, outcome.view, graduation.view…) thành ALL. Giờ gán vai trò tường minh của vai trò có `scopeSource = OWN_ENROLLMENT` không mở phạm vi nào; phạm vi của sinh viên chỉ đến từ gán vai trò suy ra (hồ sơ của chính mình). `OWN_ENROLLMENT` cũng không còn suy ra `programIds`. Quyền ALL (course.view, syllabus.view — danh mục) giữ nguyên.
- **Đề cương**: chỉ bản được ghim của dòng chương trình; bản ghim là DRAFT hoặc không có thì 404. Phản hồi theo danh sách cho phép, không có trường yêu cầu/người duyệt.
- **Không có trang danh mục học phần riêng trong cổng**; sinh viên vẫn đọc danh mục qua quyền course.view ALL hiện có.

## Phát hiện môi trường

- `.env` cục bộ thiếu `STUDENT_CREDENTIAL_ENCRYPTION_KEY` nên mọi lần nhập STUDENT_LIST bị từ chối; đây là nguyên nhân các lỗi F17-TC_001..004 và F09 trước đó. Đã thêm khóa ngẫu nhiên vào `.env` cục bộ (gitignored, không in giá trị) và khởi động lại backend.
- Log backend có nhiều lỗi `EnrollmentReconciliationProcessor` "Dữ liệu gán khóa chưa hợp lệ" trên dữ liệu thật: cần Phòng Đào tạo rà soát gán khóa–phiên bản.

## Cổng còn mở

- Quyết định cấp tài khoản cho 1.731 sinh viên thật (hiện chưa có tài khoản nào).
- E1..E4 của plan (lịch sử trước đính chính, chính sách miễn/điều kiện của Khoa, thiết bị nghiệm thu, PDF cho sinh viên).
