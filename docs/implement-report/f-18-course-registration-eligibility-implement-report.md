# F-18 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Status**: **DONE — mã và automation đã chạy xanh (orchestrator, 2026-10-30)**: BE unit 179/179, BE e2e 226/226, FE 75/75, Playwright F-07 35/35. Còn Manual TC_015/016, nghiệm thu Khoa (C3) và số đo NFR-02 trên phần cứng triển khai. Dòng "Not run" trong bảng bên dưới là lịch sử lượt build; kết quả chạy nằm ở mục cuối.
- **Đến đâu (2026-10-30, tiếp tục sau Option A)**: mã BE-01..BE-07, FE-01..FE-05 và tài liệu DOC-01 đã được bổ sung. Không còn blocker Env. Các phần lịch sử phía dưới giữ bằng chứng của lượt bị chặn, không mô tả trạng thái build hiện tại.
- **Quyết định người dùng**: cho phép thêm ELIGIBILITY_MAX_DEPTH vào Env; giữ DEFAULT_ATTACHMENT_MAX_MB = 50 và mọi cấu hình attachments. Không đổi kiến trúc cấu hình hoặc hợp đồng F-17.
- **F-17**: orchestrator xác nhận 104/104 targeted unit tests passed. Lượt F-18 này không sửa thêm fix A/B, specs hoặc error_log.
- **Kiểm chứng**: chỉ chạy typecheck, targeted oxlint và Prettier; schema được sinh từ backend watch đang chạy bằng pnpm api:types, exit 0. Không chạy Vitest/Testcontainers/Playwright, không giả lập kết quả NFR-02. Chi tiết static gate của lượt này nằm ở phần cuối.
- **Không thay đổi**: Prisma schema/migration, package/lockfile, F-16/F-17 endpoints/DTOs, F-17 program-options, attachments, dev servers và các chỉnh sửa có sẵn. Không sửa progress_log/current_work/todo; không đọc dữ liệu bị cấm hoặc dotenv.

## Bảng tổng hợp

| ID | Trạng thái | File / lý do |
| --- | --- | --- |
| Fix A | Đã giao mã/spec; Not run | Semester guard cho cả from/until; unit branches và một e2e trong releases.e2e-spec.ts |
| Fix B | Đã giao mã/spec; Not run | Shared nullable-boundary predicate và cả hai reader; predicate/resolver/academic reader specs |
| error_log | Đã append | Entry 2026-10-29, ghi rõ latent defect từ static review |
| BE-01 | Đã giao mã/spec; Not run | Vocabulary, Vietnamese reasons, errors, typed Env depth 1..20/default 20 |
| BE-02 | Đã giao mã/spec; Not run | Tx-only frozen context, bulk metadata/equivalence, rule-specific exact Decimal evidence |
| BE-03 | Đã giao mã/spec; Not run | Iterative SCC, condensed depth, complete bundles, direct/leaf blockers and simple paths |
| BE-04 | Đã giao mã/spec; Not run | Actor-bound shared reader, ELIGIBILITY purpose and one RepeatableRead snapshot |
| BE-05 | Đã giao mã/spec; Not run | Concrete DTOs, whitelist mapper, scoped SQL picker and query validation |
| BE-06 | Đã giao mã; API types generated | Two no-store/private GET routes, root module and permission inventory |
| BE-07 | Đã giao specs; Not run | Synthetic API/source-writer fixtures, HTTP privacy/read-only/parity/integrity and 30/60-row performance suites |
| FE-01 | Đã giao | Generated schema.d.ts from actual routes, existing permission alias |
| FE-02 | Đã giao mã/spec; Not run | Encoded adapters, context-complete keys, zero cache lifetime, cancel-before-remove cleanup |
| FE-03 | Đã giao mã/spec; Not run | Scoped/debounced/paged picker, semester context, shared status and structured reason Drawer |
| FE-04 | Đã giao mã/spec; Not run | Applied-version redirect, exact item-set check, one reload, table/board read-only overlay |
| FE-05 | Đã giao specs; Not run | API/hooks/picker/context/status/reason/table/board/page regressions; existing assertions retained |
| DOC-01 | Đã giao tài liệu | Report, QA cases, manual supplement, append-only architecture and corrected plan |

## Prerequisite integration checklist

**Reverification sau fix 2026-10-29 (thay thế kết luận mismatch của lượt trước):**

- **U1 khớp source**: schema hiện tại `source/backend/prisma/schema.prisma:1042`, `:1058`, `:1065`, `:1089`, `:1123`; userId unique nullable `:1078`. Line anchors đổi do schema attachments của run kia, không phải schema change của task này.
- **U1a khớp source**: `source/backend/src/shared/students/student-applied-version.reader.ts:39` giữ facade; `:115` giữ nullable end relation; `:119` báo INVALID_ENROLLMENT_INTERVAL trước khi lọc. Exception `:128`, normal F-16 `:165`, RepeatableRead `:58`, supplied tx và exact result type không đổi.
- **U1b khớp source**: `source/backend/src/shared/students/academic-results.reader.ts:30`, `:74`, `:102`, `:105`; unknown end không covered ở R3, actual open end vẫn covered; giữ inclusive attempt cutoff/status/scales/tx và R1/own-R6 transcript policy. Thêm reader spec riêng vì trước đó chưa có file này.
- **U1c khớp source**: `source/backend/src/shared/students/enrollment-period.ts:9`, `:19`, `:26`; JS membership và SQL predicate cùng phân biệt absent end với unknown end. `student-access.ts:89`, `:126`, `:156` không sửa. Resolver intentionally trả lỗi interval rõ ràng; transcript/picker không đưa interval thiếu ngày vào phạm vi.
- **U2 khớp source**: `source/backend/src/shared/releases/applied-program-version.reader.ts:17`, `:33`; `cohort-version-schedule.ts:34`, `:89`, `:100`, `:114`; F-17 call `student-applied-version.reader.ts:165`. Không sửa F-16.
- **Giới hạn**: source gate cũ đã giải quyết, chưa có test execution xanh; orchestrator phải chạy các regression mới. Bảng dưới giữ evidence của lượt đầu như lịch sử, không phải trạng thái hiện tại.

| ID | Bằng chứng source thực tế | Kết luận |
| --- | --- | --- |
| U1 | `source/backend/prisma/schema.prisma:1034`, `:1050`, `:1057`, `:1081`, `:1115`; `source/backend/src/shared/students/student-import.types.ts:38` | Schema/enums/nullable score strings khớp. Known-boundary behavior không khớp; không đề xuất hoặc tạo migration |
| U1a | `source/backend/src/shared/students/students-shared.module.ts:16`; `student-applied-version.types.ts:3`; `student-applied-version.reader.ts:36`, `:52`, `:126`, `:162` | Export, facade, tx, exception pin và F-16 normal resolution khớp. Mismatch tại `student-applied-version.reader.ts:106`, `:113`, `:124`: thiếu end start thành open end; thiếu from start bị lọc trước khi kiểm tra |
| U1b | `source/backend/src/shared/students/academic-results.reader.ts:18`, `:30`, `:97`, `:102`, `:105`; `best-academic-results.ts:5`, `:39` | Raw attempts, cutoff inclusive, status/scale, tx và helper khớp. Enrollment authorization có cùng mismatch tại `academic-results.reader.ts:71`, `:74` |
| U1c | `source/backend/src/shared/students/student-access.ts:14`, `:18`, `:89`, `:126`, `:156`; `enrollment-period.ts:16` | Role/permission cùng assignment, R6 identity và staff scope khớp. SQL predicate phân biệt end ID vắng với end date thiếu, còn resolver/read predicate không phân biệt; integration chưa khớp |
| U2 | `source/backend/src/shared/releases/applied-program-version.reader.ts:17`, `:33`; `cohort-version-schedule.ts:34`, `:89`, `:100`, `:114`; F-17 call tại `source/backend/src/shared/students/student-applied-version.reader.ts:162` | Khớp: issued/known dates, deterministic ties, requested semester, supplied tx, không ACTIVE fallback. Giữ E1/E2 |

## Escalations

### Đang mở: BE-01 cần file đang thuộc no-edit fence

- **Đã hoàn tất**: fix A/B, error_log, reverify source và regression specs; không sửa file concurrent-run nào bị cấm.
- **Điểm vướng**: BE-01 chỉ định thêm `@IsInt() @Min(1) @Max(20) ELIGIBILITY_MAX_DEPTH: number = 20` qua constants của feature vào Env, đọc bằng typed ConfigService và test qua validateEnv. Brief mới cấm sửa file Env, chỉ ngoại lệ schema generation và append sections architecture/database docs. Setting chưa có trong source.
- **Lựa chọn A — khuyến nghị**: run attachments đã xong; orchestrator cần ghi rõ ngoại lệ cho một patch additive F-18 vào Env, giữ nguyên thay đổi attachments (gồm ATTACHMENT_MAX_MB = 50). Ngoại lệ chỉ cần cho property/import/validation đã được BE-01 chỉ định, không phải quyền sửa lại các file của feature kia; sau đó resume BE-01..DOC-01.
- **Lựa chọn B**: chủ sở hữu Env áp dụng đúng phần cấu hình của BE-01 cùng constants/imports khi phối hợp với task F-18, rồi bàn giao source để tiếp tục.
- **Không tự chọn**: sửa Env bất chấp fence, ghi đè thay đổi đồng thời, bỏ startup validation, hoặc tự chuyển sang config module thứ hai. Mọi phương án đó đổi ràng buộc hoặc thiết kế đã duyệt.
- **Khuyến nghị**: A; không cần thay nghiệp vụ, dependency hoặc schema. Sau handoff re-read Env, thêm đúng property/validation theo plan rồi build feature đầy đủ. Đây là gate ownership, không phải yêu cầu kiến thức Faculty mới.

### Đã giải quyết trong source: F-17 unknown enrollment boundary

Người dùng chọn sửa cả prevent và fail-closed ngày 2026-10-29. Mã/spec đã giao ở các mục Fix A/B bên dưới; các options của lượt đầu sau đây chỉ giữ làm lịch sử. Không còn yêu cầu quyết định F-17 trước khi tiếp tục F-18; chỉ chờ orchestrator chạy regression và xử lý gate Env mới.

- **Đã hoàn tất**: xác minh source và ghi evidence vào plan; không giả lập reader hoặc tự sửa chủ sở hữu F-17.
- **Điểm vướng**: `student-applied-version.reader.ts:113` truyền `row.untilSemester?.startDate ?? null` vào `coversSemester`. `enrollment-period.ts:13` coi null là không giới hạn. `academic-results.reader.ts:74` làm tương tự trong kiểm tra enrollment của R3. `enrollmentCoversWhere` tại `enrollment-period.ts:16` lại yêu cầu `untilSemesterId:null` hoặc một end start lớn hơn query start.
- **Tình huống tổng hợp để tái hiện sau khi được phép**: lượt học có from start 2025-09-01, có untilSemesterId trỏ đến học kỳ 2026-02-01, query start 2026-09-01 và cohort assignment hợp lệ. Sau đó ngày bắt đầu của học kỳ until được đặt null. SQL picker loại lượt đó, nhưng resolver có thể coi lượt cũ vẫn bao phủ query. Nếu còn một lượt mới, có thể phát sinh ENROLLMENT_AMBIGUOUS thay vì lỗi chronology rõ ràng. Chưa chạy tình huống này.
- **Tính khả đạt**: `source/backend/prisma/schema.prisma:472` cho phép Semester.startDate null. `source/backend/src/features/semesters/dto/semester.dto.ts:47` nhận null; `semesters.service.ts:87` chỉ chặn ngày hiệu lực của ACTIVE/HISTORICAL releases, không chặn mọi end boundary; `:189` ghi null. Không cần chạm DB để xác định nhánh này tồn tại.
- **Phạm vi E2**: chấp nhận lịch hiện hành và sửa ngày hồi tố không có nghĩa được suy diễn ngày chưa biết thành không có mốc kết thúc. Plan yêu cầu giữ lỗi chronology của F-17 và cấm F-18 tự diễn giải interval lần hai.
- **Lựa chọn A — khuyến nghị**: giao chủ F-17 sửa/kiểm thử validation chronology nhất quán cho resolution/results và xác định policy của picker trên interval thiếu ngày. Giữ phân biệt `untilSemesterId:null` (open thật) với end semester có start null (không đủ dữ kiện). Chủ F-17 chọn ErrorDefinition phù hợp và xác nhận source contract trước khi tiếp tục F-18; không tự chọn thay ở task này.
- **Lựa chọn B**: phê duyệt thay đổi plan để F-18 tự preflight chronology hoặc chấp nhận reader hiện tại. Không khuyến nghị vì tạo cách diễn giải thời gian thứ hai hoặc làm yếu hợp đồng fail-closed. Cần phê duyệt ngoài brief hiện tại.
- **Điều kiện tiếp tục**: source owner giải quyết A hoặc người dùng phê duyệt B; bổ sung regression cho end-start null, from-start null, open end thật, interval hợp lệ, picker/direct-read parity và supplied tx. Sau đó reverify U1..U1c trước BE-02/04.

## Fix A — Prevent

- **Decision during build**: trong đúng điều kiện startDate thay đổi hiện có, query thêm ProgramEnrollment với OR fromSemesterId/untilSemesterId. Giữ khóa semester và transaction hiện có, giữ SEMESTER_IN_USE, không đổi endpoint/DTO.
- **Đã giao**: `source/backend/src/features/semesters/semesters.service.ts:102`; unit trong `semesters.service.spec.ts` parameterize cả hai boundary và thử cả đổi/xóa ngày; giữ positive case cùng ngày/metadata-only. Backend e2e trong `source/backend/test/releases.e2e-spec.ts:222` dựng enrollment ENDED, end semester không phải effective semester của ACTIVE/HISTORICAL, thử xóa ngày và kiểm tra startDate/updatedAt giữ nguyên.
- **Deviation**: không có semester e2e file riêng; group semester hiện có nằm trong releases.e2e-spec.ts nên thêm case tại đó, không tạo suite trùng. Dùng lại createSyntheticStudentFixture và createSemester.
- **Incident / Lesson**: writer yêu cầu known start không bảo vệ khỏi một calendar edit về sau. Guard phải nhìn cả các referrer không thuộc release feature. Không tuyên bố đã chạy regression hoặc đã kiểm chứng thêm interleaving concurrency ngoài scope được duyệt.

## Fix B — Fail closed

- **Decision during build**: PeriodRow giữ `untilSemester: { startDate: Date | null } | null` thay vì flatten thành nullable untilStart. `hasKnownEnrollmentBoundaries` tại `source/backend/src/shared/students/enrollment-period.ts:9` tập trung phân biệt absent relation với unknown date.
- **Đã giao**: resolver dùng helper trước lọc và báo INVALID_ENROLLMENT_INTERVAL cho unknown from/end; academic reader dùng cùng coversSemester và coi interval đó không covered, giữ STUDENT_NOT_FOUND của R3. Không đổi SQL predicate hoặc quyền transcript R1/own-R6.
- **Disposition mọi caller cũ**: student-applied-version.reader.ts truyền nguyên nullable end relation và validate trước selection; academic-results.reader.ts truyền nguyên relation vào predicate; enrollment-period.spec.ts đổi toàn bộ fixture/call cũ sang shape mới. Không có caller khác theo tìm kiếm source.
- **Specs**: predicate thêm nhánh unknown end; resolver thêm unknown from/end và assert không gọi cohort reader; tạo academic-results.reader.spec.ts với unknown from/end, absent end, exclusive end, một interval hợp lệ cạnh interval invalid và supplied/default transaction. Tất cả Not run.
- **Incident**: đây là latent defect từ static review đã được người dùng xác nhận, không phải sự cố người dùng báo. Lượt đầu test mới dùng sai literal PermissionScope, tsc phát hiện; đã đổi sang SCOPED theo enum source. Không sửa test attachment đang lỗi của run kia.
- **Lesson**: một nullable boundary dùng ở JS và SQL phải có một nghĩa thống nhất và giữ đủ thông tin để phân biệt missing relation với missing date. Predicate trả false cho dữ kiện không đủ không ngăn resolver báo lỗi chronology rõ ràng khi nghiệp vụ cần fail-closed.

## error_log

- **Đã giao**: append entry ngày 2026-10-29 trong `docs/troubleshooting/error_log.md`, đúng format Symptom / Possible cause / Resolution / How to avoid. Không sửa entry trước hoặc dòng của run khác.
- **Decision during build / Deviation**: chỉ ghi static finding, fix và specs đã viết; không gán Passed cho test chưa chạy.
- **Incident / Lesson**: calendar edit phải kiểm tra mọi referrer trước khi xóa ngày; shared nullable-boundary semantics phải được rà cùng SQL predicate.

## Decision during build / Deviation / Incident / Lesson (lượt đầu)

- **Decision during build**: dừng toàn bộ triển khai ngay khi prerequisite mismatch được xác định, đúng STOP AND REPORT; không hỏi giữa lượt non-interactive.
- **Deviation**: chỉ giao tài liệu điểm dừng, không giao F-18 runtime. DOC-01 vẫn chưa hoàn tất. Không đổi sản phẩm, kiến trúc, schema hoặc các default Faculty.
- **Incident**: một patch đầu tiên không khớp nguyên văn tiêu đề §2b và không áp dụng; đã áp dụng lại patch nhỏ đúng anchor. Không có thay đổi source từ lỗi patch.
- **Lesson**: cần kiểm tra cả normalization trong reader lẫn predicate SQL; tên helper/kiểu dữ liệu khớp không chứng minh temporal semantics khớp. Typecheck xanh cũng không chứng minh chronology đúng.

## Kiểm chứng 2026-10-29 (lịch sử, không phải kết quả lượt hiện tại)

| Working directory | Lệnh | Exit code | Output nguyên văn |
| --- | --- | --- | --- |
| `source/backend` | `pnpm exec tsc --noEmit -p tsconfig.json` | 1 | `src/features/syllabi/syllabus-attachments.service.spec.ts(214,17): error TS2554: Expected 4 arguments, but got 3.` |
| `source/frontend` | `pnpm exec tsc -b` | 0 | Không có output (stdout/stderr rỗng) |

Backend diagnostic còn lại thuộc run attachments; không sửa theo fence. Lượt tsc đầu phát hiện thêm scope IN_SCOPE trong test mới, đã sửa sang SCOPED và chạy lại, không còn diagnostic ở code task này. Pipe shell ban đầu phát sinh Win32 console error; các lượt kiểm chứng cuối chạy bằng PowerShell PTY thành công, không lấy lượt bị hỏng shell làm verdict code.

Targeted source list cho cả ba lệnh dưới (working directory `source/backend`):

```text
src/features/semesters/semesters.service.ts
src/features/semesters/semesters.service.spec.ts
src/shared/students/enrollment-period.ts
src/shared/students/enrollment-period.spec.ts
src/shared/students/student-applied-version.reader.ts
src/shared/students/student-applied-version.reader.spec.ts
src/shared/students/academic-results.reader.ts
src/shared/students/academic-results.reader.spec.ts
test/releases.e2e-spec.ts
```

- `pnpm exec oxlint` với đúng chín path trên: exit 0, stdout/stderr rỗng.
- `pnpm exec prettier --write` với đúng chín path trên: exit 0; output lượt cuối (bỏ control codes vẽ lại terminal):

```text
src/features/semesters/semesters.service.ts 82ms (unchanged)
src/features/semesters/semesters.service.spec.ts 59ms (unchanged)
src/shared/students/enrollment-period.ts 7ms (unchanged)
src/shared/students/enrollment-period.spec.ts 10ms (unchanged)
src/shared/students/student-applied-version.reader.ts 31ms (unchanged)
src/shared/students/student-applied-version.reader.spec.ts 21ms (unchanged)
src/shared/students/academic-results.reader.ts 15ms (unchanged)
src/shared/students/academic-results.reader.spec.ts 16ms (unchanged)
test/releases.e2e-spec.ts 97ms (unchanged)
```

- `pnpm exec prettier --check` với đúng chín path trên: exit 0; output cuối:

```text
Checking formatting...
All matched files use Prettier code style!
```

Không sửa frontend source nên không có targeted frontend oxlint/Prettier. Không sửa `source/e2e` nên không chạy e2e-project typecheck; backend typecheck đã bao gồm backend test source mới. Không chạy Vitest/backend e2e/Playwright. Không có test execution/result F-18 hoặc phép đo NFR-02. Test-case doc có 16 ca thiết kế, tất cả Not run; F-17 regression đã viết không được gán thành automation F-18 hoàn chỉnh.

## Lệnh bàn giao orchestrator

Các lệnh dưới đây **chưa chạy**. Regression predicate/resolver/academic reader/semester và một releases backend e2e đã viết trong lượt tiếp tục; orchestrator chạy để xác nhận hành vi, không suy ra Passed từ tsc/lint:

```powershell
Set-Location E:\PBL6\curriculum-management\source\backend
pnpm exec vitest run src/shared/students/student-applied-version.reader.spec.ts src/shared/students/enrollment-period.spec.ts src/shared/students/student-access.spec.ts
pnpm exec vitest run src/features/semesters/semesters.service.spec.ts src/shared/students/enrollment-period.spec.ts src/shared/students/student-applied-version.reader.spec.ts src/shared/students/academic-results.reader.spec.ts
pnpm test:e2e -- test/releases.e2e-spec.ts test/student-version-resolution.e2e-spec.ts test/students.e2e-spec.ts
```

Sau khi unblock **và sau khi build đủ các file F-18**, chạy đúng gate của plan; hiện các đường dẫn F-18 này chưa tồn tại, không chạy bây giờ:

```powershell
Set-Location E:\PBL6\curriculum-management\source\backend
pnpm exec vitest run src/shared/registration-eligibility src/features/registration-eligibility
pnpm test:e2e -- test/registration-eligibility.e2e-spec.ts test/registration-eligibility-performance.e2e-spec.ts test/permission-table.e2e-spec.ts
Set-Location E:\PBL6\curriculum-management\source\frontend
pnpm exec vitest run src/features/curriculum/api/registrationEligibility.test.ts src/features/curriculum/hooks/useRegistrationEligibility.test.tsx src/features/curriculum/components/EligibilityStudentSelect.test.tsx src/shared/registration-eligibility/EligibilityStatus.test.tsx src/shared/registration-eligibility/EligibilityReasons.test.tsx src/features/curriculum/components/EligibilityContextBar.test.tsx src/features/curriculum/components/CurriculumTable.test.tsx src/features/curriculum/components/SemesterBoard.test.tsx src/features/curriculum/pages/CurriculumPage.test.tsx
```

Plan FE-05 không chỉ định tên Playwright spec. Chưa tạo spec ở điểm dừng này; không có lệnh Playwright F-18 khả dụng để chứng minh build. Khi resume, spec mới phải dùng lại `studentWorld` và `prepareSyllabusAssessment`, không sửa `fixtures/select.ts`. Không chạy một spec trống để lấy kết quả xanh.

## Tiếp tục sau host interruption — 2026-10-30

- **Decision during build**: đọc lại source và report hiện có thay vì tạo lại fix. Giữ backend e2e trong releases.e2e-spec.ts vì file này đã có group cập nhật semester và các assertions SEMESTER_IN_USE. Giữ entry error_log ngày 2026-10-29, không append trùng cho cùng một defect.
- **Deviation**: F-18 vẫn chưa build do ràng buộc no-edit Env trong brief mới; không sửa những phần attachments đã hoàn tất. Không thay enrollment.writer.ts/spec: source đã yêu cầu requireSemesterStart và steps 1–3 không chỉ định thêm writer behavior. Không nhận các thay đổi ngoài task làm công của lượt này.
- **Incident**: theo orchestrator, lượt trước bị host gián đoạn vì OOM. Đã xác nhận source/spec/report còn tồn tại và chạy typecheck tuần tự trong lượt này; không tự khởi động hay dừng server.
- **Lesson**: sau một lượt gián đoạn phải kiểm tra trạng thái file và phân biệt phần đã viết với phần chưa làm. Trạng thái một concurrent run đã hoàn tất không tự hủy lệnh cấm sửa file trong brief tiếp tục.

### Reverification U-rows

U1..U2 vẫn khớp source tại các file:line đã ghi trong plan/report; không có source change mới làm dịch chuyển anchor. Guard tại semesters.service.ts:102 kiểm tra cả fromSemesterId/untilSemesterId. Shared boundary meaning tại enrollment-period.ts:9; resolver báo lỗi tại student-applied-version.reader.ts:119; academic reader truyền nguyên end relation tại academic-results.reader.ts:74; SQL predicate tại enrollment-period.ts:26 không đổi. Đây là static verification, không phải test execution.

### Kiểm chứng thực tế 2026-10-30

| Working directory | Lệnh | Exit code | Output |
| --- | --- | --- | --- |
| `source/backend` | `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | stdout/stderr rỗng |
| `source/frontend` | `pnpm exec tsc -b` | 0 | stdout/stderr rỗng |
| `source/backend` | `pnpm exec oxlint` với đúng chín path trong targeted source list phía trên | 0 | stdout/stderr rỗng |
| `source/backend` | `pnpm exec prettier --write` với đúng chín path đó | 0 | Nguyên văn bên dưới; tất cả unchanged |
| `source/backend` | `pnpm exec prettier --check` với đúng chín path đó | 0 | Nguyên văn bên dưới |

Prettier write:

```text
src/features/semesters/semesters.service.ts 312ms (unchanged)
src/features/semesters/semesters.service.spec.ts 49ms (unchanged)
src/shared/students/enrollment-period.ts 7ms (unchanged)
src/shared/students/enrollment-period.spec.ts 8ms (unchanged)
src/shared/students/student-applied-version.reader.ts 24ms (unchanged)
src/shared/students/student-applied-version.reader.spec.ts 19ms (unchanged)
src/shared/students/academic-results.reader.ts 13ms (unchanged)
src/shared/students/academic-results.reader.spec.ts 14ms (unchanged)
test/releases.e2e-spec.ts 84ms (unchanged)
```

Prettier check:

```text
Checking formatting...
All matched files use Prettier code style!
```

Đoạn kiểm chứng phía trên thuộc lượt bị chặn trước Option A: khi đó chưa có sửa frontend và chưa có artifact F-18. Option A đã giải quyết gate Env. Bằng chứng của lượt triển khai tiếp theo được ghi riêng dưới đây; không dùng kết quả cũ để xác nhận source mới.

## Tiếp tục sau Option A — 2026-10-30

### Incident — enrollment boundary đã xử lý ở F-17

- **Symptom**: latent defect tìm qua static review, không phải user report: untilSemester có thể còn tồn tại nhưng startDate bị xóa qua semester editor, khiến một JS predicate hiểu thành open end trong khi SQL loại bỏ.
- **Resolution**: fix A kiểm cả fromSemesterId/untilSemesterId khi đổi startDate; fix B giữ nullable end relation trong shared predicate, resolver fail closed và academic reader not-covered. Orchestrator đã xác nhận 104/104 targeted unit tests. Không chỉnh lại fix trong lượt này.
- **Lesson**: boundary nullable dùng chung JS/SQL phải có một nghĩa được chốt ở một nơi; thao tác xóa referenced date phải kiểm mọi referrer. Không xây temporal adapter F-18 để che lỗi nguồn.

## BE-01 — Vocabulary và cấu hình

- **Decision during build**: domain types reuse F-17 types; contractVersion=1; typed Env integer 1..20/default 20; mười reason codes và bốn warning codes có Vietnamese templates và priority tường minh.
- **Deviation**: none; Option A cho phép additive Env change, attachment default 50 được giữ.
- **Incident**: gate Env của lượt trước đã được người dùng giải quyết, không tự vượt fence.
- **Lesson**: configuration ceiling không phải Faculty passing mark. Specs config/reasons có thật, chưa chạy.

## BE-02 — Frozen context và evidence

- **Decision during build**: `source/backend/src/shared/registration-eligibility/eligibility-context.reader.ts:33` chỉ dùng supplied tx, exact resolved version, issuedVersionFact; metadata/replacements/equivalence bulk theo bounded phases. Empty frozen requisites authoritative, zero credits hợp lệ. Evidence exact Decimal, source-row fallback, PASSED/EXEMPT vs FAILED/IN_PROGRESS phân biệt theo từng rule.
- **Deviation**: thêm private score parser đổi malformed input thành ELIGIBILITY_DATA_INVALID; thêm test-only fixture module dùng chung, không production endpoint/dependency.
- **Incident**: không có contract mismatch mới với F-16/F-17.
- **Lesson**: original/equivalent historical evidence vẫn hợp lệ khi catalog thiếu replacement; không follow QH5 chains.

## BE-03 — SCC, bundles và explanations

- **Decision during build**: `source/backend/src/shared/registration-eligibility/eligibility-evaluator.ts:38`; iterative Kosaraju và dependency-first condensed graph. Depth đếm component, origin=1; all members/edges được xét. Mỗi origin dùng BFS path index, complete transitive bundle hoặc every direct/leaf blocker; no recursive nested messages/mutable singleton state.
- **Deviation**: thêm exported pure `corequisitePaths` để dựng một BFS index cho mỗi origin/via; `corequisitePath` giữ signature của plan. Tránh BFS lặp lại cho từng leaf; không đổi verdict/depth contract.
- **Incident**: none.
- **Lesson**: visited không có nghĩa là eligible; reciprocal SCC vẫn là concurrent bundle và không được che blocker của thành viên.

## BE-04 — Actor-bound facade

- **Decision during build**: `source/backend/src/shared/registration-eligibility/registration-eligibility.reader.ts:31` cung cấp forAccess(access): RegistrationEligibilityQuery với evaluate(input, tx?). F-17 resolution/results cùng purpose ELIGIBILITY/cùng tx; không tx thì một RepeatableRead; evaluatedAt chụp trước đọc. Shared module xuất reader, không nhập StudentsModule.
- **Deviation**: none; dùng returned programVersionId, không current/stored pin override.
- **Incident**: none.
- **Lesson**: supplied tx là capability cho trusted server composition, không phải public transcript endpoint hoặc fake-R1 bypass.

## BE-05 — DTO, whitelist và picker

- **Decision during build**: concrete nested Swagger DTOs, required nullable fields, decimal strings, query validators. Mapper fresh whitelist objects và transport invariants. Picker staffStudentScope(ELIGIBILITY), exact-program half-open membership intersect studentReadWhere; một predicate cho count/page, deterministic fullName/id order, q trim.
- **Deviation**: program không tồn tại dùng Nest NotFoundException với Vietnamese message, đi qua error mapping hiện có; không thêm lỗi vào module F-17 hoặc sửa consumed DTO.
- **Incident**: none.
- **Lesson**: directory permission không được suy từ own-student read permission; R6 bị từ chối trước query picker.

## BE-06 — Wiring và route inventory

- **Decision during build**: hai GET routes ở §2a của plan được register trong RegistrationEligibilityModule/AppModule, permission hiện có và no-store/private headers. permission-table.ts bổ sung hai entries theo convention placeholder-ID sẵn có; actual success/ownership dùng riêng BE-07 synthetic fixtures.
- **Deviation**: inventory giữ convention của harness hiện có, không claim placeholder assertions chứng minh business success; actual HTTP suite là bằng chứng cần chạy.
- **Incident**: backend typecheck đã phát hiện một nonexistent generic error constant lúc viết; đổi sang NotFoundException trước gate cuối, không sửa API khác.
- **Lesson**: generated schema xác nhận registration/DTO shape, không xác nhận authorization hay test pass.

## BE-07 — Integration và performance artifacts

- **Decision during build**: fixture tái dùng course/program/curriculum/release/synthetic-student helpers và transactional writeAcademicResultSource. HTTP suite phủ own/same-program other R6, R3 scope, picker, anonymous/override, thresholds/PRIOR/EXEMPT, outside equivalent API, no business writes, supplied-tx consumer parity và named integrity corruption. Performance suite chuẩn bị 30/60 rows cùng mixed rules/statuses ngoài phép đo rồi đo ba complete HTTP requests mỗi size, budget 3000ms.
- **Deviation**: không chạy Testcontainers/Vitest theo fence. Timings, actual SQL query counts và deployment-hardware equivalence đều **Not run / chưa đo**, không ghi số giả. Context unit kiểm bounded metadata phase calls, không đánh đồng với actual SQL statements.
- **Incident**: none.
- **Lesson**: mã performance test đã giao không tự chứng nhận NFR-02; runtime/temporal/Faculty acceptance vẫn là phần nghiệm thu orchestrator.

## FE-01 — Generated API

- **Decision during build**: pnpm api:types đọc actual /api/docs-json sau backend compile, exit 0; frontend aliases dùng generated schemas. Thêm alias studentViewRegistrationEligibility cho permission sẵn có.
- **Deviation**: không đổi response contract hoặc attachment vocabulary. Mandatory Prettier trên generated schema tạo whitespace churn toàn file sau pnpm api:types; không phải thay DTO attachments bằng tay.
- **Incident**: none.
- **Lesson**: generation phải sau route registration, không dựng handwritten response interface để qua typecheck.

## FE-02 — Private query lifecycle

- **Decision during build**: encoded API adapters, keys đủ lookup/picker context, staleTime/gcTime=0, no retries/previous-data placeholder, refetch mount/focus. Context cleanup cancel-before-remove; generation guard giữ React StrictMode effect replay không xóa query đang được dùng lại. Logout vẫn clear toàn QueryClient.
- **Deviation**: no retries cho mọi lỗi thay vì chỉ 4xx; người dùng có Tính lại. Không sửa cross-feature invalidation/import hooks theo plan.
- **Incident**: none.
- **Lesson**: no-store không bảo đảm server push; UI hiển thị labeled snapshot với evaluatedAt và explicit recompute.

## FE-03 — Context và reason presentation

- **Decision during build**: known-start SemesterSelect, scoped debounced remote student search, Pagination, neutral bookmark label, context reset. Shared StatusTag dùng server statusText và transport invariants, Drawer plain React text hiển thị every reason/full bundle/path/evidence/leaf/null-vs-zero; warnings xuất hiện một lần.
- **Deviation**: none; chỉ presentation validation, không client academic evaluator.
- **Incident**: PowerShell 5 native argument quoting làm hai JSX files mất quote trong patch đầu; tsc phát hiện, đã sửa bằng escaped native arguments trước gate cuối. Một số file cần Prettier pass thứ hai; final check đã sạch.
- **Lesson**: dùng real apply_patch binary và escape native quote trên PowerShell 5; không coi patch success là parser/typecheck pass.

## FE-04 — MH-25 student overlay

- **Decision during build**: staff role+permission affordance, no crafted-context query cho R2/R4/R5/R6; missing semester không đoán. Redirect replace tới returned version, bỏ old focus; exact identity/program/version/item-set gate, một reload khi mismatch. Table/board cùng status props, no edit/add/requisites-edit/drag, syllabus links pin version. Clear context giữ ordinary framework và behavior cũ.
- **Deviation**: effect đồng bộ program-selection state với external router tạo một oxlint warning react(set-state-in-effect), 0 errors; giữ explicit reset thay vì che bằng lint suppression hoặc bỏ privacy guard.
- **Incident**: đã xử lý curriculum-fetch error riêng để không giữ skeleton vô hạn khi applied version không tải được.
- **Lesson**: authoritative answer không được join theo row index hoặc route version do người dùng đang browse.

## FE-05 — Regression artifacts

- **Decision during build**: typed generated fixtures, API/hooks/context/select/status/reasons/table/board specs và thêm page regressions; không xóa assertions ordinary authoring/reorder/filter/focus cũ.
- **Deviation**: plan không chỉ định Playwright filename/spec; không tự dựng browser spec hoặc nhân bản F-17 fixtures. Runtime suites/browser walkthrough **Not run**.
- **Incident**: none.
- **Lesson**: RTL fetch spies không chứng minh SQL scope/NFR, chỉ BE-07 real app suites mới bổ sung bằng chứng đó.

## DOC-01 — Đồng bộ và handoff

- **Decision during build**: plan §2a/§2c/§8 và Status cập nhật theo source; architecture chỉ append F-18 sections, không rewrite attachments; thêm manual supplement và 16 QA cases có actual test paths, mọi result Not run.
- **Deviation**: không sửa progress/index/current_work/todo hoặc database docs vì không có migration/table và orchestrator giữ ownership các file tiến độ.
- **Incident**: none.
- **Lesson**: F-20/MH-58 và F-21 principal adapter chưa build; downstream phải reuse vocabulary/server facade, không fake staff identity hoặc parse reasons để tự tính.

### Ví dụ downstream

```ts
const answer = await registrationEligibility.forAccess(access).evaluate({
  studentId, programId, semesterId,
}, tx);
```

COHORT answer có cohortAssignmentId; EXCEPTION answer giữ source EXCEPTION và cohortAssignmentId null. Cả hai chỉ dùng answer.context.programVersionId làm nguồn frozen rules; input không có versionId. Các phép sửa source/mapping/calendar về sau có thể đổi kết quả lần tính sau theo E1/E2 đã chấp nhận; không có historical replay guarantee.

## Static gate cuối — 2026-10-30

Phạm vi format/lint: **34 backend source/spec files** (toàn bộ hai thư mục registration-eligibility, Env, AppModule, permission-table và ba backend e2e/fixture files); **24 frontend source/spec files** (API/schema/permission, curriculum adapters/hooks/fixtures/context/table/board/page và sáu shared eligibility files). Không format hoặc sửa lại F-17. Không có source/e2e file được sửa nên không chạy tsc của project đó.

| Working directory | Command | Exit | Actual output |
| --- | --- | --- | --- |
| source/backend | pnpm exec tsc --noEmit -p tsconfig.json | 0 | stdout/stderr rỗng; chạy lại sau depth-path shortcut regression và explicit RegistrationEligibilityQuery interface, vẫn 0 |
| source/backend | pnpm exec oxlint trên 34 files nêu trên | 0 | stdout/stderr rỗng; không errors/warnings; hai evaluator files và reader kiểm lại sau patch cuối, vẫn 0 |
| source/backend | pnpm exec prettier --write rồi --check trên 34 files | 0 / 0 | Write ghi từng path; check: Checking formatting... / All matched files use Prettier code style!; hai evaluator files và reader cũng write/check lại 0 sau patch cuối |
| source/frontend | pnpm exec tsc -b | 0 | stdout/stderr rỗng |
| source/frontend | pnpm exec oxlint trên 24 files nêu trên | 0 | 0 errors; một warning nguyên văn bên dưới |
| source/frontend | pnpm exec prettier --write rồi --check trên 24 files | 0 / 0 | Write ghi từng path; check: Checking formatting... / All matched files use Prettier code style! |

```text
src/features/curriculum/pages/CurriculumPage.tsx:134:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
```

Warning này là explicit program-context reset khi router đổi program. Giữ vì external-router synchronization/privacy, không lint suppression hoặc nới rule. Initial formatting check có ba backend/frontend files cần pass thứ hai; final check đều exit 0, không coi check chưa hoàn tất là code verdict. API generation exit 0 trước frontend build; không chạy browser/server/infrastructure commands.

Lượt format/lint cuối dùng `pnpm exec prettier --write --log-level error` trên cùng 34/24 files rồi `--check`: write output rỗng, exits 0/0; check vẫn đúng hai dòng ở bảng trên. Backend oxlint rỗng, frontend giữ đúng warning đã chép. Không có source edit sau lượt kiểm này.

## Runtime handoff — chưa chạy trong sandbox

```powershell
cd source/backend
pnpm exec vitest run src/shared/registration-eligibility/eligibility-config.spec.ts src/shared/registration-eligibility/eligibility-reasons.spec.ts src/shared/registration-eligibility/eligibility-context.reader.spec.ts src/shared/registration-eligibility/academic-evidence.spec.ts src/shared/registration-eligibility/corequisite-graph.spec.ts src/shared/registration-eligibility/eligibility-evaluator.spec.ts src/shared/registration-eligibility/registration-eligibility.reader.spec.ts src/features/registration-eligibility/registration-eligibility-query.dto.spec.ts src/features/registration-eligibility/registration-eligibility.mapper.spec.ts src/features/registration-eligibility/eligibility-students.service.spec.ts
pnpm test:e2e -- test/registration-eligibility.e2e-spec.ts test/registration-eligibility-performance.e2e-spec.ts test/permission-table.e2e-spec.ts
cd ../frontend
pnpm exec vitest run src/features/curriculum src/shared/registration-eligibility
```

F-17 regression commands nếu orchestrator muốn xác nhận lại sau integration (không sửa code fix):

```powershell
cd source/backend
pnpm exec vitest run src/features/semesters/semesters.service.spec.ts src/shared/students
pnpm test:e2e -- test/releases.e2e-spec.ts test/students.e2e-spec.ts test/student-version-resolution.e2e-spec.ts
```

Playwright F-18: **none — plan không chỉ định spec**. Không claim kiểm chứng actual browser/keyboard/mobile, full temporal/official-source matrix hoặc SQL count/hardware measurement từ typecheck/RTL artifacts. Faculty defaults vẫn provisional, F-20/F-21 vẫn downstream. Không có Escalation mới; các lựa chọn nội bộ theo defaults được ghi trong từng deliverable ở trên.

## Kiểm chứng của orchestrator — 2026-10-30

Chạy sau khi Codex báo DONE. Mã sản phẩm không đổi; bốn lỗi đều nằm trong spec mới viết chưa từng chạy.

| Bộ | Lệnh | Kết quả |
| --- | --- | --- |
| BE type check | `pnpm exec tsc --noEmit -p tsconfig.json` | exit 0 |
| BE unit | `vitest run src/shared/registration-eligibility src/features/registration-eligibility src/features/semesters src/shared/students src/shared/config` | 24 file, 179/179 (lần đầu 6 failed) |
| BE e2e | `vitest run --config ./vitest.config.e2e.ts` registration-eligibility, registration-eligibility-performance, permission-table, releases, students, student-version-resolution | 6 file, 226/226 (lần đầu 1 failed) |
| FE | `tsc -b`; `vitest run src/features/curriculum src/shared/registration-eligibility --testTimeout=30000` | exit 0; 14 file, 75/75 (lần đầu 2 failed, rồi 1) |
| Playwright | `specs/f-07-curriculum-elective-groups.spec.ts` | 35/35 |

### Incident — spec chưa chạy mang lỗi giả định

- `eligibility-config.spec.ts`: thiếu `import 'reflect-metadata'` nên `validateEnv` ném `Reflect.getMetadata is not a function`; thêm import như `env.validation.spec.ts`.
- `eligibility-context.reader.spec.ts`: ca snapshot thiếu cắt danh sách dòng còn một, nhưng mock catalog vẫn trả mọi học phần, nên reader dừng sớm ở kiểm tra số học phần (`ELIGIBILITY_DATA_INVALID`) thay vì `ELIGIBILITY_SNAPSHOT_INCOMPLETE`; giữ đủ dòng và chỉ xóa `creditsSnapshot` dòng đầu.
- `registration-eligibility.e2e-spec.ts`: gán `untilSemesterId` mà giữ `status: ACTIVE` vi phạm ràng buộc `ProgramEnrollment_closed_interval`; gán kèm `ENDED` và khôi phục `ACTIVE`.
- `CurriculumTable.test.tsx`, `CurriculumPage.test.tsx`: bảng AntD vẽ thêm một tiêu đề ẩn để đo cột nên `getByText('Đăng ký được?')` thấy hai phần tử; đổi sang `getByRole('columnheader')`. Sau khi bỏ chọn sinh viên trang vẫn ở chế độ theo học kỳ, nơi mã và tên học phần nằm chung một dòng; đổi sang đợi nhãn trạng thái biến mất rồi khớp tên theo regex.

**Lesson worth keeping**: spec viết trong sandbox không chạy được là giả thuyết, không phải bằng chứng — mỗi lỗi ở đây là một giả định về môi trường (metadata polyfill, ràng buộc CHECK của DB, DOM đo cột của AntD) mà chỉ lượt chạy thật mới lộ ra. Một mock phải nhất quán với mọi kiểm tra đứng trước nhánh muốn thử, nếu không ca kiểm thử chứng minh nhầm nhánh khác.

### Môi trường

Container dev `ctdt-postgres-1`/`ctdt-redis-1` dừng (exit 255) trong lượt chạy; orchestrator `docker start` lại và khởi động lại BE/FE dev server trước Playwright.
