# F-17 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu (2026-10-29)**: BE-01..BE-10 và FE-01..FE-06 đã có mã; TC doc, Playwright và đồng bộ tài liệu F-17 hoàn tất. F-09 imports được mở rộng, không có pipeline thứ hai.
- **Nhánh**: `main` (không thao tác git ghi).
- **Cơ sở dữ liệu dev**: migration `20261027165710_student_records_results` và generate đã được ghi nhận ở lượt build; browser dùng dữ liệu tổng hợp. Lượt tài liệu không đọc DB hay xác nhận trạng thái DB máy người dùng.
- **Ảnh hưởng runtime**: StudentsModule/StudentsSharedModule, MH-51/52 `/students`, `/students/:studentId`; STUDENT_LIST và ACADEMIC_RESULT được bật trong imports với cổng R1. R6 bị từ chối tại các route staff; self-reader giữ phạm vi cá nhân.
- **Bằng chứng orchestrator**: live dev servers ngày 2026-10-29, mỗi spec chạy riêng: F-17 14/14 (gồm auth setup và 5 TC), F-16 14/14, F-15 42/42, F-13 37/37, mvp-flow 14/14. E2E tsc 0; frontend tsc -b 0. Không coi số gồm setup là số TC nghiệp vụ.
- **Bằng chứng trước đó**: backend unit 1350/1350 và F-17 e2e xanh; sau sửa options, targeted backend 15 file 109/109, targeted frontend 12 file 58/58 với --testTimeout=30000. Không chạy lại full suites trong lượt chốt này.
- **TC và còn nợ**: 32 TC = 28 tự động Passed + 4 Manual Not run (029..032). Các khoảng trống ma trận BE-10 đã liệt kê bên dưới vẫn còn, không được suy ra đã phủ từ lượt browser xanh.
- **NFR-05**: quyết định 2026-10-28 dùng ngân sách test 100 giây đã ghi; chưa chạy lại phép đo với ngưỡng mới, mục tiêu yêu cầu 60 giây chưa đạt/không được tự sửa thành 100 giây. Giữ quyết định ngân sách và giới hạn nghiệm thu riêng với hoàn tất mã.
- **Cấu hình người dùng còn nợ**: người dùng tự thêm STUDENT_CREDENTIAL_ENCRYPTION_KEY hợp lệ (base64 của 32 byte) vào dotenv cục bộ; lượt browser chỉ dùng khóa tạm trong process env, không chứng minh cấu hình đã lưu. Không đọc dotenv hoặc ghi giá trị khóa trong tài liệu.

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

## FE-01 — Đối chiếu hợp đồng (2026-10-29)

- **Decision during build / Rule 13**: giữ nguyên `schema.d.ts` đã được orchestrator phát sinh; không chạy lại api:types. Kiểm tra `schema.d.ts:4333`/`:4334` xác nhận điểm thập phân là chuỗi nullable; `:8274`/`:8275` và `:8300`/`:8301` bắt buộc kỳ/chương trình cho kết quả và phân giải; `:4289`/`:4356` cho phép cohortAssignmentId null ở ngoại lệ. Enum StudentStatus, StudentDataSource, EnrollmentType/Status, AcademicResultStatus và AppliedVersionSource được dùng trực tiếp qua generated DTO.
- **Rule 13**: `imports/import-mapping.ts:93` tính canCommit từ trạng thái/chủ sở hữu/lỗi/file; `imports.service.ts` và route wave 2 vẫn kiểm tra quyền hiện tại phía server. `imports.controller.ts:176` là POST nhận byte riêng cho mật khẩu; không biến GET tệp gốc thành endpoint tiêu thụ credential. Trạng thái không có delivery theo `student-credentials.service.ts:85` có ngày null.
- **Deviation**: §2b ghi versionLabel nhưng wire dùng versionId nullable (`import-response.dto.ts:56`, `schema.d.ts:4207`); ví dụ StudentListQueryDto không được generator sinh thành schema, nên alias query từ operations. Chỉ ghi đính chính trong §2c, không sửa hợp đồng BE hoặc generated file.

## FE-02 — API và query (2026-10-29)

- **Decision during build**: alias DTO/operations; encode mọi studentId; query key chứa chương trình, học kỳ, mọi filter, page và pageSize. Detail của R1 không ghi danh không gửi programId giả. Root `shared/students/studentQueryRoot.ts` dùng chung để imports không import feature students.
- Mutation ghi danh chỉ trả row/count và invalidate root; không ép thành StudentDetail. Khóa token snapshot trong form; mutation không retry. Quan sát COMMITTED wave 2 invalidate students/users/credential status một lần theo batch ở observer.
- **Rule 13**: kiểm tra `shared/api/client.ts:70`/`:77`/`:94` trước khi dùng getJson/sendJson/sendForm; GET downloadFile giữ nguyên toàn bộ call site template/tệp gốc. Chỉ thêm hàm POST credential riêng (`features/imports/api/imports.ts:57`) có same-origin cookie, no-store và revoke URL trong finally.
- **Incident**: lần apply patch đầu có dấu nháy JSX bị PowerShell truyền sai, không file nào đổi; chuyển escape dấu nháy cho cùng binary `codex.exe --codex-run-as-apply-patch`. Không thử công cụ hay biến thể patch khác.

## FE-03 — Danh sách và điều hướng (2026-10-29)

- Có MH-51 dùng ListPageLayout/DataTable/PageHeader/StatusTag, debounce 300 ms, phân trang/bộ lọc trong URL, yêu cầu chọn học kỳ và vô hiệu kỳ thiếu ngày; link profile mang context, có import link cho R1.
- **Rule 13**: RequirePermission hiện hữu chỉ kiểm tra permission presence; thêm RequireStudentStaff tại feature, kết hợp R1/R3 và student.viewProgress; không đổi chữ ký guard chung. Menu áp dụng hideForRoles và test R1/R3/R6, đa vai trò (`shared/layout/menuItems.test.tsx:11`).
- **Decision during build**: giữ danh sách trống có lời hướng dẫn cụ thể; lỗi server có nút thử lại thay vì kết luận không có sinh viên. Không thêm màn nhập/sửa sinh viên thủ công.

## FE-04 — Hồ sơ, kết quả và ghi danh (2026-10-29)

- Có profile/info/history/result tabs; điểm null là —, giữ từng lần học; phân biệt pin đã lưu với đáp án theo học kỳ. Không có tab/luồng tính toán hay nhập điểm ngoài phạm vi.
- Modal có căn cứ bắt buộc/trim/giới hạn 1000 theo BE, chọn kỳ biết ngày không tương lai, issued target, xác nhận tóm tắt, token student/source enrollment, khóa gửi lặp, giữ input khi 409 và nút tải lại để xác nhận lại. R3 không có thao tác ghi; terminal status ẩn điều khiển ghi danh.
- **Escalation / STOP**: khi đối chiếu sâu nguồn options sau kiểm tra tĩnh, phát hiện `students-read.service.ts:79`/`:89` chỉ trả chương trình có enrollment phủ học kỳ, kể cả R1. Modal đang dùng endpoint này tại `EnrollmentCommandModal.tsx:51`; chương trình mới chưa có sinh viên không thể được chọn làm đích gán ngoại lệ/chuyển/song ngành. Đây là khác biệt ngữ nghĩa hợp đồng, không phải lỗi kiểu TypeScript. Đã dừng ngay, không tự sửa BE hoặc đổi sang GET /programs trái với quyết định §2b về DTO tiêu thụ.
- Các phương án cần orchestrator duyệt: mở rộng options dành R1 quản lý ghi danh để bao gồm chương trình có issued targets; hoặc cho phép nguồn options R1 hiện hữu khác và bổ sung alias/plan/test tương ứng. **Khuyến nghị**: endpoint/options quản lý riêng hoặc mode R1 rõ ràng, giữ nguyên thu hẹp danh sách cho R3. Chưa chọn thay người dùng.

## FE-05 — Mở rộng pipeline F-09 và credential (2026-10-29)

- Tái sử dụng imports upload/report/commit/poll/history; STUDENT_LIST/ACADEMIC_RESULT không gửi versionId, hướng dẫn cột/trạng thái và cảnh báo không ghi danh. Type preselection giả bị đưa về loại server cho phép trước khi tải mẫu; không tạo pipeline thứ hai.
- Credential chỉ xuất hiện sau COMMITTED STUDENT_LIST cho R1 có quyền; GET metadata riêng, hộp cảnh báo rồi POST một lần; byte không vào query cache. Lỗi 410 hướng tới đặt lại mật khẩu tại Tài khoản. Ẩn report cũ khi detail query lỗi; lịch sử lỗi không giữ tên file/row cũ trên màn hình.
- **Deviation đã được plan nêu tại U1**: ba guard imports và hai menu chuyển sang any-of curriculum.importExportExcel/data.importExcel; không mở rộng quyền backend hoặc tự cấp wave 2 theo permission R3. Label bốn import type đã đúng nên không sửa importLabels.ts vô ích.
- **Rule 13**: đọc pipeline và helper F-09 trước khi nối; import hook quan sát COMMITTED tại `features/imports/hooks/useImports.ts:78`; detail chỉ render khi không lỗi tại `pages/ImportDetailPage.tsx:35`.

## FE-06 — Test phía khách (2026-10-29)

- Có fixtures tổng hợp dùng satisfies generated DTO; test API/context keys, list/guard/R6, profile/null/retake/unassigned/R3, modal căn cứ/token/409, hai loại import không version, invalidation một lần, template URL giả, credential POST/cleanup/410/cache và menu đa vai trò. Đây là mã test, chưa phải bằng chứng chạy đạt.
- **Incident**: tsc đầu phát hiện exact không thuộc Testing Library ByRoleOptions; đã sửa test, lượt kiểm tra cuối tsc exit 0. Prettier đã --write toàn bộ 33 file FE thay đổi/tạo mới trước --check.
- **Incident môi trường**: Vitest với --testTimeout=30000 không nạp được Vite config, externalize-deps báo spawn EPERM từ windows safe-realpath/net use. Không test nào chạy; không gọi đây là test đỏ của mã nguồn và không mở rộng quyền để né sandbox.
- **Lesson worth keeping**: kiểm tra static/API shape không thay thế kiểm tra tập options nghiệp vụ. Fetch fixture có sẵn program đã che trường hợp chương trình đích chưa có enrollment; cần thêm case options rỗng/chương trình chưa có sinh viên sau khi chốt escalation.

## Tài liệu test và Playwright (2026-10-29)

- Tạo `docs/testing/test-cases/f-17-student-records-results-import-test-cases.md` theo cột/ID/tiếng Việt của F-12: 32 ca; Playwright 5, BE e2e 17, FE unit 6, Manual 4. Chỉ 17 ca BE ghi Passed theo bằng chứng orchestrator đã cung cấp và tên test thật đã grep; 15 ca còn lại chưa chạy. Không sửa README totals.
- Tạo spec F-17 có 5 ca: nhập rồi điều hướng đúng context; tải credential một lần; trùng mã chặn commit; kết quả null không sửa điểm; R6 bị từ chối. Dùng fixture auth sẵn có và chooseOption nguyên bản; workbook tổng hợp được dựng trong test qua ExcelJS đã cài ở backend, không thêm package.
- **Incident**: source/e2e không cài executable prettier; dùng pnpm exec prettier của frontend với đường dẫn ../e2e cho hai file mới, --write và --check đạt.
- **Chưa xong trước STOP**: E2E typecheck exit 2 vì import type ExcelJS qua index.js bị TypeScript trỏ index.ts thay vì declaration: TS7016 ./dist/es5, TS2614 không export Workbook. Chưa sửa sau khi chạm cổng dừng hợp đồng; phải sửa type resolution trong fixture sau quyết định tiếp tục, không thêm dependency hoặc sửa backend.

## Bảng tổng hợp FE cập nhật

| ID | Mã/tài liệu | Kiểm chứng / mức hoàn tất |
| --- | --- | --- |
| FE-01 | Đối chiếu generated schema, §2c | Wire shape đạt; semantic program-options chặn FE-04; không sinh lại schema |
| FE-02 | students API/hooks/root/labels/rules; imports credential API | Có mã; tsc/oxlint/Prettier đạt; unit chưa chạy |
| FE-03 | MH-51, staff guard, menu/routes | Có mã; kiểm tra tĩnh đạt; browser chưa chạy |
| FE-04 | MH-52, history/results/modal | Có mã nhưng chưa hoàn tất: cổng options chương trình đích cần quyết định BE/plan |
| FE-05 | F-09 wave 2, metadata/POST credential | Có mã; kiểm tra tĩnh đạt; test runner chặn môi trường |
| FE-06 | FE unit/fixtures/menu/import tests | Có mã; chưa có verdict unit vì spawn EPERM |
| TC doc | 32 ca, 17 Passed BE evidence, 15 chưa chạy | Có tài liệu; không tăng tổng README |
| Playwright | 5 spec cases + fixture workbook | Có mã; chưa chạy; typecheck còn TS7016/TS2614 |

## Kiểm chứng FE cập nhật

Build-verifier theo CLAUDE.md chạy độc lập các lệnh, không sửa file:

| Lệnh | Exit | Kết quả |
| --- | --- | --- |
| frontend: pnpm exec tsc -b | 0 | Không output |
| frontend: pnpm exec oxlint src | 0 | Không output |
| frontend: pnpm exec prettier --check (33 file FE mới/đổi, không schema.d.ts) | 0 | Checking formatting... / All matched files use Prettier code style! |
| frontend: pnpm exec vitest run --testTimeout=30000 src/features/students src/features/imports src/shared/layout src/shared/auth | 1 | Startup Error; plugin externalize-deps; spawn EPERM; chưa chạy test |
| e2e: pnpm exec tsc --noEmit -p tsconfig.json | 2 | TS7016 trong ExcelJS index.ts và TS2614 tại fixture mới dòng 3 |
| frontend: pnpm exec prettier --check ../e2e/specs/f-17-student-records-results-import.spec.ts ../e2e/fixtures/student-records.ts | 0 | Checking formatting... / All matched files use Prettier code style! |

## Trạng thái cập nhật (thay thế khối trạng thái cũ, append-only)

- **BLOCKED**: cần quyết định hợp đồng nguồn chương trình đích cho FE-04. Không kết luận F-17 FE đã hoàn thành.
- FE-01..FE-06 có mã trong working tree; chưa commit, chưa push; không đổi backend, package/lockfile, generated schema, server, Docker, Prisma hoặc dữ liệu thật.
- Tsc FE, oxlint và formatting đạt. Unit chưa khởi động được do môi trường; typecheck E2E còn lỗi của fixture mới; Playwright chưa chạy theo chỉ dẫn.
- Các quyết định E1/E2/E3/E4 và nghĩa vụ F-19 vẫn giữ nguyên. Không chứng nhận quy trình Khoa, môi trường sản xuất hoặc NFR ngoài bằng chứng đã có.

## Điểm dừng (cập nhật lần 5)

1. Orchestrator quyết định nguồn options R1 quản lý ghi danh (khuyến nghị không dùng tập chỉ có sinh viên đã ghi danh); duyệt cập nhật BE/plan nếu cần. Chưa tự đổi hợp đồng.
2. Sau quyết định, nối modal tới nguồn được duyệt, bổ sung regression chương trình đích chưa có sinh viên và trường hợp options rỗng; rà phần điều khiển terminal/closed theo lý do cụ thể.
3. Sửa import type ExcelJS của `source/e2e/fixtures/student-records.ts:3` trong scope; chạy lại typecheck E2E và formatting. Không thêm dependency.
4. Chạy targeted FE unit --testTimeout=30000 ở môi trường runner hoạt động; hoàn thiện các khoảng trống FE-06 theo kết quả thật. Không đánh Passed cho unit hiện tại.
5. Orchestrator chạy 5 Playwright cases rồi điền TC doc. TC doc hiện 32 ca: 17 Passed BE evidence, 15 chưa chạy. Không sửa README totals trong lượt này.

Ghi nhận **Deviation về phạm vi đọc**: lần chọn range ban đầu vô tình bao gồm một phần các bước BE trong implementation plan và sau đó đã đọc khối trạng thái đầu implement report, ngoài giới hạn chỉ FE/tail của brief. Không thay đổi backend hoặc dùng dữ liệu nhạy cảm; không thể hoàn tác thao tác đọc. Các lần triển khai sau phải chọn range theo heading FE trước khi in nội dung.

## Tiếp tục ba mục mở theo quyết định 2026-10-29

### 1. Nguồn chương trình đích — đã triển khai quyết định

- **Deviation được duyệt**: bỏ điều kiện enrollment trong `StudentsReadService.programOptions` của endpoint hiện hữu. R1 nhận mọi chương trình, R3 chỉ chương trình trong staff scope; vẫn gọi requireSemesterStart để kiểm tra học kỳ tồn tại/có ngày bắt đầu. Không đổi DTO, không thêm endpoint, không thay nguồn options ở modal.
- **Rule 13**: đã grep `source/backend/test/students.e2e-spec.ts`; ca `lists the program options by scope` chỉ kiểm tra R1 có ít nhất hai chương trình và R3 đúng worldA, không khẳng định loại chương trình chưa có enrollment. Không cần sửa file e2e đó, không chạy BE e2e.
- Unit spec sửa kỳ vọng SQL thành scope-only, thêm dữ liệu chương trình mới không có enrollment và danh sách options rỗng. Query danh sách sinh viên vẫn giữ lọc enrollment theo ngữ cảnh; thay đổi chỉ nằm tại nguồn options.
- Modal vốn dùng useStudentPrograms rồi enrollment-targets nên tiếp tục nối đúng endpoint đã mở rộng. Thêm regression chọn chương trình mới cho sinh viên chưa ghi danh và xác nhận ASSIGN_EXCEPTION, options chương trình rỗng không gửi lệnh, issued targets rỗng có cảnh báo và khóa xác nhận. Fixtures cho phép override chính xác response program-options, kể cả mảng rỗng.
- Plan §2c ghi resolved; contract row đổi thành all programs in staff scope; no enrollment filter. Quyết định dừng cũ đã được giải quyết, không tự thêm endpoint hoặc GET /programs.

### 2. Test Select — sửa tương tác, chưa tuyên bố chạy đạt

- **Bằng chứng orchestrator trước sửa**: 12 file, 54/55 test đạt; ca lỗi duy nhất tại EnrollmentCommandModal.test.tsx khi chọn học kỳ đầu tiên. Không coi kết quả cũ là bằng chứng cho mã vừa sửa.
- **Rule 13**: đã grep helper hiện hữu; `features/releases/testRender.tsx` dùng mouseDown vào control và Escape sau chọn, helper ở AddRelationModal cũng dùng mouseDown. Không tìm thấy helper .ant-select-selector trong các file test hiện tại. Mock /api/semesters đã có s1 ngày 2025-08-01, không phải danh sách học kỳ trống.
- Thay riêng helper choose trong test modal: chờ control xuất hiện và enabled; gửi ArrowDown với key/code/keyCode/which, chờ aria-expanded=true rồi chọn option; gửi Escape sau chọn theo pattern release helper. Keyboard open được hỗ trợ bởi SelectInput của rc-select đang cài. Không sửa component sản xuất hoặc thêm timeout để che lỗi.
- Theo brief, không chạy lại frontend Vitest trong sandbox; orchestrator chạy lại lệnh targeted sau lượt này, gồm ba regression mới. Các assertion căn cứ/token/409 cũ được giữ nguyên.

### 3. Kiểu ExcelJS của fixture — bỏ import declaration xuyên project

- Giữ runtime createRequire nạp ExcelJS đã cài ở backend. Thay import type từ backend/node_modules bằng interface Workbook cục bộ chỉ có addWorksheet(name), worksheet.addRow(string[]) và xlsx.writeBuffer(): Promise<Uint8Array>.
- Không dùng any/ts-ignore, không thêm dependency, không sửa package/lockfile hay mã backend của ExcelJS. Chỉ đổi mô tả cấu trúc các member fixture thực sự gọi; workbook vẫn chỉ dùng dữ liệu tổng hợp.

### Kiểm chứng lượt tiếp tục

Build-verifier chạy các lệnh độc lập; không chạy frontend Vitest, Playwright, server, Docker hoặc Prisma.

| Lệnh | Exit | Bằng chứng |
| --- | --- | --- |
| backend: pnpm exec tsc --noEmit -p tsconfig.json | 0 | Không output |
| backend: pnpm exec vitest run src/features/students | 1 | Startup Error; externalize-deps; spawn EPERM trước khi chạy test. Các dòng System.Management.Automation.RemoteException là wrapper capture PowerShell, không phải assertion failure |
| backend: pnpm exec prettier --write src/features/students/students-read.service.ts src/features/students/students-read.service.spec.ts | 0 | Đã format hai file code backend |
| backend: pnpm exec prettier --check src/features/students/students-read.service.ts src/features/students/students-read.service.spec.ts | 0 | Checking formatting...; All matched files use Prettier code style! |
| frontend: pnpm exec tsc -b | 0 | Không output |
| frontend: pnpm exec oxlint src | 0 | Không output |
| frontend: pnpm exec prettier --write src/features/students/components/EnrollmentCommandModal.test.tsx src/features/students/testRender.tsx ../e2e/fixtures/student-records.ts | 0 | Đã format hai file FE và fixture e2e |
| frontend: pnpm exec prettier --check src/features/students/components/EnrollmentCommandModal.test.tsx src/features/students/testRender.tsx ../e2e/fixtures/student-records.ts | 0 | Checking formatting...; All matched files use Prettier code style! |
| e2e: pnpm exec tsc --noEmit -p tsconfig.json | 0 | Không output; TS7016/TS2614 đã hết |
| frontend: pnpm exec prettier --check ../../docs/implementation/f-17-student-records-results-import-implementation-plan.md ../../docs/implement-report/f-17-student-records-results-import-implement-report.md | 1 | Hai file Markdown có cảnh báo formatting toàn file |

- **Deviation kiểm chứng tài liệu**: không chạy --write toàn plan/report vì nó có thể sửa ngoài §2c/contract row và viết lại lịch sử report, vi phạm fence section-only/append-only. Code đã --write rồi --check đạt. Nếu cần toàn bộ Markdown đạt Prettier, phải có quyền chuẩn hóa riêng; khuyến nghị giữ nguyên fence của lượt này.
- Không sửa TC doc hoặc README vì ngoài scope lượt tiếp tục. Không ghi Passed cho unit mới; số 54/55 là bằng chứng orchestrator trước lần sửa này.

## Trạng thái cập nhật lần 6

- Ba mục mã nguồn đã được xử lý: nguồn options mở rộng đúng quyết định; helper Select chuyển sang keyboard và có ba regression mới; fixture ExcelJS dùng structural type và E2E tsc đạt.
- Không còn blocker quyết định API hoặc lỗi kiểu E2E của lần trước. Chưa chứng nhận unit xanh: BE runner bị chặn môi trường; frontend unit chờ orchestrator chạy lại theo brief.
- Còn cảnh báo Prettier toàn file Markdown, chưa chuẩn hóa do fence phạm vi. Không tự thay đổi các phần tài liệu lịch sử hoặc phần kế hoạch khác.

## Điểm dừng (cập nhật lần 6)

1. Orchestrator chạy lại backend unit students và frontend targeted unit với --testTimeout=30000 trong môi trường runner hoạt động; xác nhận ca căn cứ/token/409 và ba ca mới về chương trình chưa có sinh viên/options rỗng/issued targets rỗng.
2. Chạy Playwright theo kế hoạch hiện hữu rồi cập nhật kết quả thật tại TC doc; không suy ra browser acceptance từ tsc.
3. Chỉ chuẩn hóa toàn bộ plan/report bằng Prettier khi có quyền riêng cho thay đổi ngoài section và lịch sử append-only; không có thay đổi chuẩn hóa đó trong lượt này.

## Incident — 2026-10-29: fixture ban hành dùng chung thiếu công thức điểm

- **Triệu chứng**: orchestrator chạy Playwright với dev server thật: F-17 đạt 10 ca, hỏng F17-TC_001..004; F-16 đạt 9 ca, hỏng TC_015, TC_014, TC_001, TC_004, TC_008. Các ca dừng tại release-check của buildReleaseProgram vì canRelease=false, trước luồng nghiệp vụ cần kiểm.
- **Cơ chế**: F-12 bổ sung assessmentIssues vào syllabusPublishIssues, gồm điều kiện công thức không rỗng, tổng trọng số, ngưỡng và độ phủ CLO. Builder dùng chung vẫn chỉ tạo mô tả/mục tiêu, chưa tạo công thức hoặc ánh xạ. Spec F-12 dùng createSyllabus, không gọi buildReleaseProgram nên không phát hiện fixture ban hành đã lỗi thời.
- **Sửa**: buildReleaseProgram tái sử dụng createClo từ outcomes.ts (helper mà spec F-12 đang dùng), tạo CLO1 tổng hợp. Lưu công thức qua PUT grading-formula với một thành phần CK trọng số 100%, không có điều kiện, ngưỡng điều kiện và điểm liệt null hợp lệ; ánh xạ CK tới CLO1 với trọng số CLO 100% qua PUT assessment-clo-mappings. Đọc lại updatedAt trước mỗi lần lưu để không dùng token cũ. Assertion release-check kèm JSON issues để lỗi kế tiếp nêu nguyên nhân.
- **Kiểm tra phạm vi**: release-versions.ts không tạo đề cương riêng, chỉ gọi builder hoặc thao tác đề cương đã ban hành; student-records.ts tiếp tục nhận fixture qua buildReleaseProgram. Không tạo pipeline hay helper công thức trùng với helper sẵn có; không sửa backend/frontend hoặc select.ts.
- **Bài học**: mỗi điều kiện publish/release mới phải được rà soát trên mọi shared e2e builder đi tới ban hành, không chỉ spec của feature thêm điều kiện. Type-check không chứng nhận release-check xanh trên server thật.
- **Kiểm chứng**: lượt này chỉ chạy E2E TypeScript và frontend Prettier trên fixture sửa; không chạy Playwright theo fence. Kết quả browser sau sửa chờ orchestrator; không ghi các ca đang hỏng thành Passed.
- **Chi tiết contract**: ReleaseCheckDto trả hai mảng consistencyIssues và syllabusIssues, không có thuộc tính issues chung. Assertion tuần tự hóa cả hai mảng dưới nhãn Issues, giữ nguyên dữ liệu phản hồi để nhận diện điều kiện lỗi tiếp theo.
- **Kết quả kiểm chứng cuối**: build-verifier xác nhận pnpm exec tsc --noEmit -p tsconfig.json tại source/e2e exit 0 (không output); frontend Prettier --write và --check trên fixtures/change-requests.ts đều exit 0, check báo All matched files use Prettier code style! Lượt check formatting đầu có cảnh báo, đã chạy lại --write rồi --check đạt; không coi cảnh báo ban đầu là lỗi browser.

### Incident tiếp nối — cổng submit cũng yêu cầu assessment sẵn sàng

- **Triệu chứng**: orchestrator ngày 2026-10-29 ghi nhận F15-TC_001 gửi đề xuất khung bị 409 ASSESSMENT_NOT_READY / ASSESSMENT_FORMULA_EMPTY; lượt browser bị cắt do thiếu bộ nhớ, không có kết quả hoàn chỉnh.
- **Cơ chế**: ngoài builder ban hành, spec F15-TC_001 còn tự tạo đề cương bổ sung; setup serial MVP cũng tự tạo đề cương trước ban hành/gửi đề xuất. Hai đường này không chạy khối assessment của buildReleaseProgram. Cổng submit kiểm assessment nên sửa release-check đơn lẻ chưa đủ.
- **Sửa**: tách/export prepareSyllabusAssessment trong change-requests.ts, giữ createClo và hai PUT công thức/ánh xạ với token mới. Builder, F15-TC_001 và MVP-TC_001 dùng chung helper: CLO1, CK 100%, ánh xạ CK–CLO1 100%, không điều kiện, ngưỡng/điểm liệt null. Không thêm dependency hay sửa select.ts.
- **Giữ test âm**: F15-TC_001 vẫn thiếu mô tả/mục tiêu để kiểm thông báo tiếng Việt; F15-TC_008 vẫn thiếu đề cương. F12-TC_002/003 vẫn giữ trọng số/mã sai và F12-TC_004 vẫn bắt đầu chưa ánh xạ. Không thêm readiness tự động vào createSyllabus, seedRequest hoặc submitRequest để tránh che lỗi nghiệp vụ.
- **Rà soát**: grep toàn fixtures/specs cho submit, syllabus creation, release và các builder. F-10/F-11/F-12 không submit/release. F-13/F-14 lấy bản sao từ builder; copier backend giữ công thức và remap CLO/mapping (syllabus-revision.copier.ts:78). F-16 qua prepareApprovedRelease; F-17 qua studentWorld, không có factory đề cương khác.
- **Bài học**: mọi điều kiện mới phải rà cả submit và release, kể cả setup MVP và course bổ sung trực tiếp trong spec. Không suy diễn Playwright đạt từ type-check hoặc một lượt browser bị cắt.

Các điểm tạo dữ liệu và submit bên dưới được phân loại riêng; các test chỉ gọi lại cùng builder kế thừa cùng cách chuẩn bị, không thêm setup assessment lần hai.

| Điểm gọi (từ source/e2e/) | Xử lý | Lý do |
| --- | --- | --- |
| fixtures/change-requests.ts:216 | Migrated | Builder gọi helper export thay setup inline |
| specs/f-15-release-version-snapshots.spec.ts:46 | Migrated | Đề cương bổ sung có assessment trước submit |
| specs/mvp-flow.spec.ts:84 | Migrated | Setup trước cả release và submit |
| fixtures/change-requests.ts:395 | Left | Chuyển tiếp buildReleaseProgram đã migrated |
| fixtures/change-requests.ts:406 | Left | seedRequest lấy bản sao từ builder đã sẵn sàng |
| fixtures/change-requests.ts:349 | Left | Helper submit thuần, không tự che lỗi assessment |
| fixtures/release-versions.ts:31 | Left | Dùng buildReleaseProgram |
| fixtures/release-versions.ts:34 | Left | Submit bản sao giữ assessment từ builder |
| fixtures/release-versions.ts:49 | Left | finalRequest đã có dữ liệu sẵn sàng |
| fixtures/release-versions.ts:75 | Left | Course factory thuần; TC_008 cần không có syllabus |
| fixtures/version-comparison.ts:14 | Left | prepareApprovedRelease giữ assessment qua ban hành/đính chính |
| fixtures/student-records.ts:23 | Left | studentWorld dùng buildReleaseProgram |
| specs/f-13-change-requests.spec.ts:91 | Left | Submit bản sao từ seedRequest/builder |
| specs/f-13-change-requests.spec.ts:180 | Left | Submit bản sao từ seedRequest/builder |
| specs/f-13-change-requests.spec.ts:224 | Left | PROGRAM_INFO trên chương trình đã sẵn sàng |
| specs/f-14-three-level-approval-notifications.spec.ts:92 | Left | Submit bản sao từ seedRequest/builder |
| specs/f-14-three-level-approval-notifications.spec.ts:160 | Left | PROGRAM_INFO trên chương trình đã sẵn sàng |
| specs/f-14-three-level-approval-notifications.spec.ts:174 | Left | Gửi lại bản sao sẵn sàng sau trả lại |
| specs/f-14-three-level-approval-notifications.spec.ts:285 | Left | Gửi lại bản sao sẵn sàng sau trả lại |
| specs/f-15-release-version-snapshots.spec.ts:95 | Left | Nhận assessment từ setup mới tại dòng 46 |
| specs/f-15-release-version-snapshots.spec.ts:194 | Left | TC_008 cố ý thiếu syllabus để kiểm chặn ban hành |
| specs/mvp-flow.spec.ts:126 | Left | Release nhận setup mới tại dòng 84 |
| specs/mvp-flow.spec.ts:176 | Left | Submit bản sao từ syllabus đã chuẩn bị |
| specs/mvp-flow.spec.ts:230 | Left | Final release nhận bản sao đã sẵn sàng |
| fixtures/syllabi.ts:18 | Left | Factory nháp cho editor/test âm, không submit/release |
| fixtures/syllabi.ts:37 | Left | Admin wrapper chỉ tạo nháp |
| fixtures/syllabi.ts:51 | Left | Shared syllabus chỉ phục vụ editor/matrix |
| fixtures/outcomes.ts:111 | Left | CLO/PLO/matrix, không submit/release |
| specs/f-12-grade-formula-assessment-clo.spec.ts:36 | Left | TC_001 tự nhập công thức, không submit |
| specs/f-12-grade-formula-assessment-clo.spec.ts:61 | Left | TC_002 cố ý tổng thiếu 100% |
| specs/f-12-grade-formula-assessment-clo.spec.ts:74 | Left | TC_003 cố ý mã thành phần trùng |
| specs/f-12-grade-formula-assessment-clo.spec.ts:95 | Left | TC_004 cố ý bắt đầu chưa ánh xạ |
| specs/f-16-version-compare-cohort-assignment.spec.ts:22 | Left | Qua buildComparisonProgram đã sẵn sàng |
| specs/f-16-version-compare-cohort-assignment.spec.ts:59 | Left | Qua buildComparisonProgram đã sẵn sàng |
| specs/f-16-version-compare-cohort-assignment.spec.ts:148 | Left | Qua buildComparisonProgram đã sẵn sàng |
| specs/f-16-version-compare-cohort-assignment.spec.ts:199 | Left | Qua buildComparisonProgram đã sẵn sàng |
| specs/f-16-version-compare-cohort-assignment.spec.ts:229 | Left | Qua buildComparisonProgram đã sẵn sàng |
| specs/f-17-student-records-results-import.spec.ts:17 | Left | studentWorld kế thừa builder đã sẵn sàng |
| specs/f-17-student-records-results-import.spec.ts:49 | Left | studentWorld kế thừa builder đã sẵn sàng |
| specs/f-17-student-records-results-import.spec.ts:82 | Left | studentWorld kế thừa builder đã sẵn sàng |
| specs/f-17-student-records-results-import.spec.ts:93 | Left | studentWorld kế thừa builder đã sẵn sàng |
| fixtures/change-requests.ts:261 | Left | Release sau readiness helper và release-check |
| fixtures/release-versions.ts:22 | Left | UI release nhận dữ liệu từ builder hoặc setup MVP đã migrated |
| fixtures/release-versions.ts:41 | Left | UI final release nhận bản sao đã sẵn sàng |
| fixtures/release-versions.ts:51 | Left | API final-approve dùng finalRequest đã sẵn sàng |
| fixtures/version-comparison.ts:26 | Left | Correction kế thừa snapshot có assessment |
| specs/f-15-release-version-snapshots.spec.ts:127 | Left | Initial release từ builder đã sẵn sàng |
| specs/f-15-release-version-snapshots.spec.ts:143 | Left | Initial release từ builder đã sẵn sàng |
| specs/f-15-release-version-snapshots.spec.ts:270 | Left | Initial release từ builder đã sẵn sàng |
| specs/f-15-release-version-snapshots.spec.ts:286 | Left | Initial release từ builder đã sẵn sàng |
| specs/f-15-release-version-snapshots.spec.ts:316 | Left | Final release từ finalRequest đã sẵn sàng |
| specs/f-15-release-version-snapshots.spec.ts:340 | Left | Final release từ finalRequest đã sẵn sàng |
| specs/f-15-release-version-snapshots.spec.ts:538 | Left | Correction kế thừa snapshot có assessment |

- **Kiểm chứng tiếp nối**: build-verifier chạy frontend Prettier --write rồi --check trên change-requests.ts, f-15-release-version-snapshots.spec.ts và mvp-flow.spec.ts: cả hai exit 0, check báo All matched files use Prettier code style! E2E pnpm exec tsc --noEmit -p tsconfig.json exit 0, không output. Không chạy Playwright theo fence; kết quả browser chờ orchestrator.

## Incidents nghiệm thu Playwright — 2026-10-29 (orchestrator đã sửa)

### 1. Enum nội bộ không phải nhãn trạng thái trên Excel

- **Triệu chứng**: dry-run báo VALUE_INVALID tại cột Trạng thái; Xác nhận nhập bị khóa. profileRow từng ghi STUDYING, dòng kết quả từng ghi IN_PROGRESS.
- **Cơ chế và sửa**: STUDENT_STATUS_TEXT (student-list.sheet.ts:34) và RESULT_STATUS_TEXT (academic-result.sheet.ts:31) chỉ nhận nhãn tiếng Việt. Orchestrator sửa source/e2e/fixtures/student-records.ts và spec F-17 để cả hai loại workbook ghi Đang học, giữ nguyên enum API/Prisma. Lượt tài liệu chỉ ghi nhận, không sửa lại source.
- **Lesson**: fixture workbook phải tuân hợp đồng tệp mẫu tại sheet adapter, không sao chép enum của API dù ý nghĩa giống nhau; phân biệt nhãn nhập với trạng thái đã chuẩn hóa.

### 2. Program Select dài sau khi mở rộng staff scope

- **Triệu chứng**: chương trình đích của TC_001 không được render trong virtual list; chọn bằng helper không tới được option.
- **Cơ chế và sửa**: quyết định bỏ enrollment filter khiến programOptions trả mọi chương trình trong staff scope. Orchestrator bật showSearch và optionFilterProp="label" tại StudentFilters.tsx theo CourseFilters; TC_001 truyền { search: world.program.code } cho chooseOption. Không sửa fixtures/select.ts hoặc thu hẹp lại endpoint đã chốt.
- **Lesson**: khi mở rộng tập options cần rà khả năng tìm chọn trong danh sách ảo, không chỉ DTO; dùng tìm kiếm theo mã tổng hợp riêng thay vì giả định option luôn có trong DOM.

### 3. Thiếu khóa mã hóa mật khẩu ban đầu trong môi trường browser

- **Triệu chứng**: nhập sinh viên trả STUDENT_CREDENTIALS_UNAVAILABLE khi STUDENT_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình.
- **Cơ chế và sửa môi trường**: biến optional để giữ startup/auth/release hiện hữu nhưng phải có base64 giải mã thành đúng 32 byte cho nhập sinh viên/phát tài khoản. Orchestrator truyền khóa dùng một lần trong process env để chạy browser. Không có giá trị khóa nào được ghi tại đây; người dùng phải tự thêm cấu hình hợp lệ vào dotenv cục bộ. Lượt này không mở dotenv, không tạo/lưu khóa và không khẳng định cấu hình đã được lưu lâu dài.
- **Lesson**: điều kiện cấu hình optional của ứng dụng vẫn có thể là bắt buộc cho một capability; checklist nghiệm thu phải phân biệt process env tạm với cấu hình vận hành bền vững.

## Chốt F-17 và đồng bộ tài liệu — 2026-10-29

- Orchestrator xác nhận mỗi spec chạy riêng trên dev server thật: F-17 14/14, F-16 14/14, F-15 42/42, F-13 37/37, mvp-flow 14/14; e2e tsc 0 và frontend tsc -b 0. Đây là bằng chứng bên ngoài, không chạy lại trong lượt docs và không phải full suites.
- F17-TC_001..005: Passed, 10/29/26, Playwright (auto). F17-TC_023..028 lấy bằng chứng targeted frontend 12 file 58/58 đã được orchestrator xác nhận trước đó, không suy từ browser. F17-TC_029..032 giữ Not run. F-17: 32 ca = 28 tự động Passed + 4 Manual.
- Đếm dòng TC trong 17 file tính năng: 874 = 479 tự động Passed + 395 Manual; mvp-flow và auth setup không cộng vào tổng tính năng. BE-10 matrix gaps, giới hạn NFR-05/ngân sách test 100 giây và cấu hình khóa máy người dùng vẫn là nợ đã ghi, không bị xóa bởi hoàn tất mã.
- Ba Incident trên là vướng fixture/môi trường kiểm thử và hệ quả UI của quyết định đã chấp nhận; không thêm entry error_log. Điểm tiếp tục: chờ người dùng chọn tính năng tiếp theo; không tự chạy full suites hoặc triển khai feature mới.
