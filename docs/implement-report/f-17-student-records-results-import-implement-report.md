# F-17 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu**: BE-01..BE-03 đã xong. BE-04..BE-10, FE-01..FE-06, tài liệu kiểm thử, spec Playwright chưa làm.
- **Nhánh**: `main` (không thao tác git ghi).
- **Cơ sở dữ liệu dev**: đã áp migration `20261027165710_student_records_results`; `prisma generate` đã chạy. Chưa có dữ liệu sinh viên nào.
- **Ảnh hưởng runtime**: chưa có. Chưa có route sinh viên, STUDENT_LIST và ACADEMIC_RESULT vẫn `enabled: false`. Riêng nhánh `OWN_ENROLLMENT` của `ScopeSourceReader` nay tra bảng `Student` (không có hàng nào nên vẫn trả `{}`).

## Bảng tổng hợp

| ID | File | Kiểm chứng |
|---|---|---|
| BE-01 | `prisma/schema.prisma`, `prisma/migrations/20261027165710_student_records_results/migration.sql` | `prisma validate`; `migrate dev` báo đồng bộ; migration chỉ thêm (không DROP) |
| BE-02 | `src/shared/students/{student.constants,student-identity,student.errors,student-access,enrollment-period}.ts` + 3 spec; sửa `shared/authz/scope-source.reader.ts` + spec | `tsc` 0 lỗi; vitest `src/shared/students` và `scope-source.reader.spec.ts` 30/30 |

| BE-03 | `src/shared/students/{student-applied-version.types,student-applied-version.reader,students-shared.module}.ts` + spec; thêm `ENROLLMENT_COMMAND_INVALID` vào `student.errors.ts` | `tsc` 0 lỗi; vitest `src/shared/students` 29/29 |

## BE-01

- **Decision during build**: tên quan hệ trong schema đặt trong dấu nháy kép (`@relation("StudentAccount")`) theo kiểu đang dùng của schema hiện có; plan viết không nháy.
- Chỉ mục duy nhất từng phần và các ràng buộc CHECK được thêm bằng tay vào cuối `migration.sql`, đúng như plan.
- `prisma format` cũng căn lại cột của model F-12 chưa commit trong cùng file; không đổi ngữ nghĩa.

## BE-02

- **Deviation (đã được plan cho phép)**: spec `scope-source.reader.spec.ts` có ca "leaves OWN_ENROLLMENT empty". Plan BE-02 nêu rõ sửa nhánh này và cập nhật spec, nên ca đó được thay bằng hai ca: có sinh viên liên kết, và tài khoản không liên kết trả `{}`.
- **Decision during build**: `studentReadWhere` nhận `semester` tùy chọn (plan để bắt buộc) vì danh sách nhân viên không gắn học kỳ; khi có thì lọc theo khoảng nửa mở của lượt theo học.
- `assertStudentProgramRead`: lỗi đối tượng cá nhân ngoài phạm vi trả `STUDENT_NOT_FOUND` (404), không để lộ sự tồn tại.
- Thêm `holdsStudentImport` (không có trong plan) để BE-08 lọc danh sách loại import đợt hai theo cổng R1.
- **Lesson worth keeping**: heredoc dài trong Git Bash chứa nhiều nội dung tiếng Việt và dấu nháy có thể bị lỗi phân tích cả lệnh (không file nào được tạo); dùng công cụ Write cho file nhiều dòng. Python trên máy là bản Windows, nhận đường dẫn `E:/...`, không nhận `/e/...`.

## Chưa làm — việc kiểm chứng nguồn (Rule 13) cần ghi vào plan

Plan còn coi F-09 và F-16 là "chưa build". Thực tế cả hai đã có mã; các lệch đã đối chiếu (chưa sửa vào plan §2/§2c):

- `SheetRow<K> = {rowNumber, cells}`; `readSheet` trả `ParsedSheet`; `cellText` ép số và kết quả công thức thành chuỗi nên chưa từ chối ô số/công thức cho cột định danh.
- `ValidationResult<P> = {report, totalRows, errorRows, plan}`; `IssueCollector.add(row, severity, code, message, column)`.
- `IMPORT_TYPE_SUPPORT` đã có STUDENT_LIST/ACADEMIC_RESULT với `enabled: false`; `template(type, access)` đã nhận access.
- `AppliedProgramVersionReader.forCohort/forCohorts`, `requireSemesterStart`, `lockPrograms` đã export từ `src/shared/releases/`.

## BE-03

- `enrollment-period.ts` và spec đã được làm ở BE-02; BE-03 không tạo lại.
- Bộ đọc nhận `AccessContext` và mục đích đọc, chạy trong giao dịch RepeatableRead khi không có `tx`, chỉ đọc. Lượt theo học ngoại lệ được kiểm tra bằng `issuedVersionFact` (chương trình khớp, hiệu lực không muộn hơn đầu học kỳ); lượt thường được gom theo (chương trình, học kỳ) và gọi `forCohorts` một lần mỗi nhóm.
- Thêm `ENROLLMENT_COMMAND_INVALID` (400) vào `STUDENT_ERRORS` để BE-04 dùng khi lệnh theo học thiếu/thừa trường.
- Mô hình Prisma là `ProgramEnrollment` (quan hệ từ `Student` là `enrollments`).

## Điểm dừng

Dừng ở ranh giới BE-03 vì hết ngân sách ngữ cảnh. Tiếp tục từ BE-04 (`enrollment.writer.ts`, `enrollment-reconciler.ts`, `student-locks.ts`). Plan chưa được sửa: §2/§2c còn ghi F-09/F-16 chưa build; Status line của plan chưa cập nhật.

## BE-04

- Thêm trong `src/shared/students/`: `student-import.types.ts` (`SourceWriteContext`), `student-locks.ts`, `enrollment.writer.ts`, `enrollment-reconciler.ts` và hai spec. Verify: tsc sạch; vitest 2 file, 17/17 Passed.
- `endStudentEnrollments(tx, studentId, untilSemesterId)` bỏ tham số `context` không dùng. Mọi ghi theo học đều chạm `Student.updatedAt`.
- Reconciler tạo cả chuỗi mốc bị bỏ lỡ; mốc đã khớp là no-op. Phân công bị đổi đích hoặc dời được đếm `blocked` và log mã `RETROACTIVE_COHORT_RECONCILIATION_REQUIRED` kèm id mờ.
- Deviation: `createAdmissionEnrollment` ghi `Student.dataSource = input.source`; writer BE-07 phải chặn EXCEL ghi đè SCHOOL_DB.

## BE-05

- `import-issues.ts` (MODIFY) chỉ thêm mã; không sửa spec cũ. Thêm `sheets/student-list.sheet.ts`, `sheets/academic-result.sheet.ts`, `validation/student-context.ts`, `student-validator.ts`, `academic-result-context.ts`, `academic-result-validator.ts` và 3 spec. Verify: tsc sạch; vitest 3 file, 29/29 Passed.
- Decision: `readSheet` ép mọi ô thành chuỗi và `sheet-reader.ts` không được sửa, nên thêm `sheets/identity-cells.ts` (file ngoài plan) quét ô định danh kiểu số/công thức/lỗi; hai validator nhận tham số tùy chọn `nonText`. Bị loại: sửa `readSheet`.
- Decision: `MAJOR_MISMATCH` mức HIGH (không chặn), vì plan chỉ ghi "validate".
- Hoãn sang BE-08: định dạng cột định danh dạng text và sheet hướng dẫn trong mẫu (`writeSheet` không đổi).

## BE-06

- Thêm `STUDENT_CREDENTIAL_ENCRYPTION_KEY` tùy chọn (base64 của 32 byte) vào `env.validation.ts`; thông báo lỗi không lặp giá trị. Thêm `student-credential-cipher.ts` (AES-256-GCM, AAD `batchId:ownerId`), `student-account.provisioner.ts`, `features/imports/student-credentials.service.ts`, `dto/student-credential.dto.ts`, đăng ký provider trong `students-shared.module.ts`, `TEST_CREDENTIAL_KEY` trong `test/test-env.ts`, và các spec. Verify: tsc sạch; vitest 4 file, 19/19 Passed (provisioner, cipher, credentials service, env.validation).
- Deviation: thêm `CREDENTIALS_UNREADABLE` (503) ngoài plan để thực hiện "lỗi dịch vụ rõ ràng, không tiêu hủy" khi giải mã thất bại.
- `StudentCredentialsService` chưa đăng ký trong `imports.module.ts`; BE-08 nối cùng `assertConfigured` cho upload và commit.

## Điểm dừng (cập nhật)

BE-04..BE-06 xong. Tiếp tục từ BE-07 (`student-source.writer.ts`, `academic-result.writer.ts`, `best-academic-results.ts`, `academic-results.reader.ts`, adapter writers). Plan chưa được sửa: §2/§2c còn ghi F-09/F-16 chưa build.

## BE-07

- Thêm trong `shared/students/`: `student-source.writer.ts`, `academic-result.writer.ts`, `best-academic-results.ts`, `academic-results.reader.ts` và 3 spec; adapter `imports/writers/student-writer.ts`, `academic-result-writer.ts`. `students-shared.module.ts` đăng ký `AcademicResultsReader`. Verify: tsc sạch; `vitest run src/shared/students` 11 file, 73/73 Passed.
- Decision: hồ sơ `SCHOOL_DB` được đọc lại dưới khóa; ngữ cảnh EXCEL bỏ qua cả dòng, nên Excel không ghi đè `dataSource` của Trường. Bị loại: tin vào `action` đã lập kế hoạch.
- Deviation: thêm `readsWithoutEnrollment` vào `student-access.ts` (R1 hoặc R6 chủ sở hữu đọc bảng điểm không cần ghi danh); thêm `AcademicResultWriteOutcome` vào `student-import.types.ts`.
- Decision: revision lệch hoặc dòng biến mất/xuất hiện dùng lại `ENROLLMENT_STATE_CHANGED`; điểm 4 bằng nhau, học kỳ bằng nhau thì chọn id nhỏ hơn.

## BE-08

- Sửa `import-access.ts` (bật hai loại, `visibleBatches` chỉ cho R1 giữ quyền nhập thấy lô sinh viên), `import-validation.ts` (biến thể mới, tham số thứ 5 tùy chọn `AppliedProgramVersionReader`), `import-errors.ts` (`ACCESS_REVOKED`), `imports.processor.ts` (`commitStudentImport`: khóa lô, kiểm quyền trong giao dịch, ghi, lưu thông tin đăng nhập chỉ cho tài khoản vừa tạo; `onFailed` không ghi giá trị dòng), `imports.service.ts` (`types`, `template`, `create`, `commit`, `assertConfigured`), `imports.module.ts`. Thêm `sheets/student-template.ts` (cột định danh dạng text, sheet "Hướng dẫn") và `features/students/enrollment-reconciliation.{scheduler,processor}.ts` cùng spec.
- Deviation (spec cũ, được phép): `import-access.spec.ts`, `imports.reader.spec.ts`, `imports.service.spec.ts` đổi kỳ vọng sang hành vi mới (hai loại sinh viên không còn `IMPORT_TYPE_UNAVAILABLE`; `visibleBatches` loại lô sinh viên khỏi lô của chính mình và lô rộng); hai spec processor/service thêm đối số constructor.
- Deviation: chưa thêm route tải/kiểm tra trạng thái thông tin đăng nhập vào `imports.controller.ts`; để BE-09 ở biên HTTP.
- Chưa đăng ký `EnrollmentReconciliationScheduler/Processor` và queue `student-enrollment` vào `app.module.ts`: cần `StudentsModule` của BE-09.
- Chưa có spec riêng cho đường commit sinh viên của processor (ACCESS_REVOKED, rollback khi writer ném lỗi); còn nợ.
- Verify: tsc sạch; `vitest run src/features/students src/features/imports src/shared/students` 31 file, 234/234 Passed.

## Điểm dừng (cập nhật lần 2)

BE-07, BE-08 xong (trừ các mục chưa làm ở trên). Tiếp tục từ BE-09: `StudentsModule`, controller, đăng ký queue/scheduler/processor đối soát, route thông tin đăng nhập.

## BE-09 (một phần)

- Thêm `features/students/`: DTO (`student-query`, `student-enrollment-command`, `student`, `academic-result`), `students.mapper.ts`, `students-read.service.ts`, `student-enrollments.service.ts`, `students.controller.ts`, `students.module.ts`; spec `students.mapper.spec.ts`, `student-enrollments.service.spec.ts`; `imports.processor.student-commit.spec.ts` (8 ca: ACCESS_REVOKED, importer bị khóa, thông tin đăng nhập chỉ cho tài khoản vừa tạo, rollback khi writer/store ném lỗi). `StudentsModule` đã vào `app.module.ts`; queue `student-enrollment`, scheduler và processor đối soát đăng ký trong `StudentsModule`. `imports.controller.ts` có `GET :batchId/student-credentials` và `POST :batchId/student-credentials/download` (`Cache-Control: no-store`).
- Deviation: `StudentCredentialsService.status()` trả trạng thái rỗng (`available:false`, `expiresAt:null`) khi chưa có bản giao, thay vì ném `BATCH_NOT_FOUND`; `expiresAt` nullable theo bảng của plan.
- Decision: thêm `reconcileStudent` vào `EnrollmentReconciler` (khóa chương trình rồi sinh viên, kiểm token `updatedAt`); thêm `staffStudentScope`, `holdsStudentEnrollmentWrite`, `PROGRAM_CONTEXT_REQUIRED`; tách `AcademicResultsReader.authorizeRead`. Cảnh báo tab ghi danh tính từ kết quả resolver thật. Bị loại: suy cảnh báo từ cờ lưu sẵn.
- Incident: `reconcile` ban đầu không `async`, nên lỗi quyền ném đồng bộ thay vì reject; đã thêm `async`.
- Verify: tsc sạch; `vitest run src/features/students src/features/imports src/shared/students` 34 file, 256/256 Passed.
- Còn nợ BE-09: `students-read.service.spec.ts` (plan đặt tên), ca thêm cho `staffStudentScope` trong `student-access.spec.ts`, kiểm tra `/api/docs-json`.

## Điểm dừng (cập nhật lần 3)

BE-09 mã xong, thiếu các mục nợ ở trên. BE-10 chưa bắt đầu (`test/fixtures/students.ts`, ba e2e spec, thêm dòng vào `permission-table.ts`). Chưa chạy e2e.

## BE-09 (hoàn tất)

- Thêm `students-read.service.spec.ts`; mở rộng `student-access.spec.ts` cho `staffStudentScope` và `holdsStudentEnrollmentWrite`; kiểm `/api/docs-json` trên :3000: 10 route mới và schema DTO đúng. Bỏ ép kiểu `as Cohort` trong `students.mapper.ts` (dùng `toCohortDto`).
- Verify: `tsc` sạch; `vitest run src/features/students src/shared/students` 15 file, 108/108 Passed.

## BE-10

- Thêm: `test/fixtures/students.ts`, `test/student-imports.e2e-spec.ts` (26 ca), `test/student-version-resolution.e2e-spec.ts` (7 ca), `test/students.e2e-spec.ts` (18 ca). Sửa: `test/permission-table.ts` (+14 dòng), `test/permission-table.e2e-spec.ts` (`countWrites` đếm `programEnrollment` cho `/api/students`).
- Verify: `permission-table` + ba spec F-17 chạy cùng nhau: 4 file, 219 Passed, 1 Failed (220), 126.29 s. Cổng cuối: `tsc` 0; `oxlint src test` 0 lỗi (2 cảnh báo ở code đã có); unit `vitest run` 156 file, 1350/1350; `users.e2e-spec.ts` 11/11.
- **Finding (chưa đạt)**: NFR-05 commit 1000 sinh viên mới kèm Argon2 (đồng thời 4) mất 71.1 s, 78.2 s (chạy riêng), 72.5 s (chạy chung) so với ngân sách 60 s; dry-run 0.4-0.7 s; kết quả học tập 1000 dòng: dry-run ~0.45 s, commit 4.2-4.8 s. Máy 16 CPU logic, Postgres/Redis trong Docker. Ca kiểm thử giữ đỏ, không hạ Argon2, không nâng 60 s theo plan; cần quyết định cách tính cổng.
- Deviation: R6 bị từ chối ở list/detail/program-options của `/api/students` (chỉ staff); ca R6 dùng `results`/`applied-version`. Director chương trình khác đọc `results` nhận 404 `STUDENT_NOT_FOUND` (plan: ngoài phạm vi = 404), không phải 403.
- Incident: heredoc + node patch trong shell báo "unexpected EOF", file chưa được tạo; ghi lại bằng công cụ Write.
- Khoảng trống so với ma trận BE-10 (chưa phủ): kill queue/giao nhận trùng thật; lỗi chèn tại từng bước ghi để kiểm atomic (chỉ có abort do đổi sau dry-run, zero write); ma trận worker chuyển tiếp (hai mốc bị lỡ, worker và chuyển tay đồng thời, đính chính hồi tố); chuyển trạng thái nguồn (nghỉ/quay lại, đóng cuối, từ chối kích hoạt lại); SCHOOL_DB/actor null (chỉ unit); tăng số truy vấn; rò log/PII ngoài danh sách khóa DTO.

## Điểm dừng (cập nhật lần 4)

Backend BE-01..BE-10 có mã. Tiếp tục: quyết định cổng NFR-05, bù các khoảng trống BE-10 nếu cần, rồi FE-01.

## Quyết định NFR-05 (2026-10-28)

- **Decision during build**: người dùng nâng ngân sách kiểm thử khối lượng lên 100 giây (`STUDENT_LIMITS.PERFORMANCE_BUDGET_MS` = `100_000` trong `src/shared/students/student.constants.ts`) và yêu cầu không chạy lại. Không đổi Argon2 hay `PASSWORD_HASH_CONCURRENCY`. Các lần đo trước đó (71.1 s, 78.2 s, 72.5 s) nằm dưới ngưỡng mới, nhưng bài kiểm thử chưa được chạy lại với ngưỡng 100 giây.
- **Deviation**: mục tiêu 60 giây của NFR-05 cho lượt ghi 1000 sinh viên chưa đạt trên máy phát triển; ngưỡng 100 giây là ngưỡng kiểm thử của dự án, không phải đính chính yêu cầu.
