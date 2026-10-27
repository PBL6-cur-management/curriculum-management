# F-09 Nhập, xuất Excel — Implement Report

Kế hoạch: `docs/implementation/f-09-excel-import-export-implementation-plan.md`. Ngày 2026-10-26: tiếp nối backend đã kiểm chứng, dựng FE-01..FE-05, test-case doc và Playwright spec. Không sửa backend trong lượt frontend.

## Status

| Mục | Trạng thái |
|---|---|
| Tiến độ | Done — BE-01..BE-07 + FE-01..FE-05 + browser walk + DOC-01, ngày 2026-10-26; còn 3 ca Manual và flake chooseOption đã biết |
| Migration | Orchestrator đã tạo, áp `20261026091026_import_batches`, thêm ImportBatch_program_for_curriculum và ImportBatch_row_counts, chạy prisma format và generate thành công; lượt này không sửa schema/migration |
| Kiểm chứng | Orchestrator 2026-10-26: backend unit 1134/1134 (có F-16 trong tree), health + imports e2e 16/16 sau shutdown fix; imports + permission-table + users 171/171 trước fix. Frontend nhóm rerun 2 workers đạt 99/99; Playwright lượt 1 đạt 14/14, lượt 2 13/14 do flake TC_001 |
| Frontend gates | Orchestrator: tsc -b 0, oxlint 0; mọi file unit F-09 xanh. 19 lỗi ở full run trước là load timeout, không ở F-09; nhóm rerun đạt 99/99. Spec Playwright giữ format do orchestrator áp; không chạy lại gate ứng dụng trong lượt docs-only |
| Formatting | Escalation parser Prisma đã được orchestrator giải quyết bằng prisma format; không còn yêu cầu xử lý schema formatting |
| Còn nợ | F09-TC_015 (sự cố DB thật), 016 (NFR-05 đầy đủ), 025 (file Khoa thật, mặc định nhãn SRS 4.3) chưa chạy. TC_001 Passed kèm Failed 1/2 lượt do chooseOption chưa sửa; không coi các lượt Passed là flake đã hết |

| Deliverable | Đã dựng | Kiểm chứng |
|---|---|---|
| BE-01 | Hai enum, `ImportBatch`, `ImportBatchFile`, ba back-relation; cuid2, indexes, Restrict / SetNull / Cascade đúng kế hoạch | Đối chiếu schema đang có và DD; không sửa mô hình khác; chưa kiểm bằng Prisma CLI |
| BE-02 | Pure owner/semester/addable rules; batched released ids; shared field limits với DTO re-export tương thích | Specs pure rules/reader/writer + regression services; tất cả đạt |
| BE-03 | Hai sheet spec, reader ExcelJS, writer template/sheet, constants | Workbooks thật trong bộ nhớ; format, header row 9, kiểu cell, 2001 rows, column order |
| BE-04 | Hai context loader, hai validator, issue collector, report và write plans | Duplicates, release guard, owners, cycles, requisites, flags, groups, removal, totals, 1000 rows < 1 giây |
| BE-05 | API upload/template/history/file/commit, BullMQ worker/sweep, scoped access, transaction writers | Specs access/mapping/DTO/reader/service/validation/processor/writers; không dùng DB thật trong unit |
| BE-06 | Export cùng layout, phiên bản bất kỳ, facts đóng băng, flags/scores/requisites | Workbook thật trong unit; DRAFT/PENDING/ACTIVE/HISTORICAL, scope, tên tệp |
| BE-07 | Suite e2e thật, helper workbook/polling và 10 permission rows bao phủ 9 method/path F-09 | Orchestrator xác nhận imports + permission-table + users 171/171; lượt frontend không chạy Docker/e2e |
| FE-01 | Quyền, ba route lazy có guard, hai menu, nhãn type/status/severity | Tái dùng generated schema, không regenerate/chỉnh sửa schema.d.ts |
| FE-02 | API multipart/download, query/mutation, polling và cache sau COMMITTED | Client cũ được tái dùng, thêm regression hết phiên; không thêm dependency |
| FE-03 | Form upload, bản Nháp theo scope, report phân trang/lọc severity, modal xác nhận | Unit thật với Form/Query/Router và fetch stub; không dùng MSW |
| FE-04 | Lịch sử lọc URL/phân trang và chi tiết/tệp gốc/báo cáo | Loading/error/empty/retry; expiry và quyền ghi theo server |
| FE-05 | Xuất mọi trạng thái; link nhập preselect bản Nháp thường | Không nhập feature imports vào curriculum; test quyền/trạng thái/URL/lỗi scope |
| Test cases | 30 ca, đủ 23 AC US-032..037, KB/NT/NFR/DL và walk 1..8 | 27 Passed ngày 10/26/26: 5 Playwright, 17 Backend e2e, 1 Backend unit, 4 Frontend unit; 3 Manual để trống |
| Playwright | 5 ca dùng auth state demo, dữ liệu riêng và xlsx tải từ ứng dụng | Orchestrator: lượt 1 14/14 gồm 9 setup + 5 TC; lượt 2 13/14 do flake TC_001. Không thêm dependency hoặc sửa fixture |
| DOC-01 | Đồng bộ kiến trúc, CSDL, technical reference, chỉ mục và snapshot tiến độ; kiểm DD/sơ đồ trạng thái | Kiểm đường dẫn bằng Test-Path; đếm lại chỉ mục 789 = 408 Passed + 381 Manual chưa chạy; không sửa tài liệu F-16 |

## BE-01 — Lưu phiên nhập và tệp gốc

- Chỉ sửa `source/backend/prisma/schema.prisma`: không tạo migration, không generate, không gọi DB. `ProgramVersion` bị xóa làm rỗng `versionId`, không xóa lịch sử; xóa batch mới cascade sang file.
- Rule 13: `Program` / `ProgramVersion` hiện đã có vòng đời PENDING / ACTIVE / HISTORICAL và đính chính. Không sửa các cột đó. F-11 đã cascade `CurriculumItem → CoursePLOMapping → CLOPLOMapping`; không thêm cascade mới.
- **Decision during build**: giữ đúng ranh giới schema-only do người dùng giao; hai SQL CHECK của kế hoạch phải được orchestrator thêm vào migration sau khi tạo. Không thể biểu diễn hai CHECK bằng Prisma schema hiện tại.
- **Deviation**: migration là đầu ra bị hoãn có chủ đích, không phải migration đã áp dụng. Không tuyên bố DB đã đồng bộ.

## BE-02 — Tách quy tắc dùng chung, giữ hợp đồng cũ

- `ownerProblem` dùng chung cho import và `assertCourseOwners` đang có. Faculty được kiểm trước khi truy vấn group như cũ; mã lỗi, `details`, `HOME_FACULTY_CODE` và chữ ký export giữ nguyên.
- `assertSemesterInRange` thật nằm ở `features/curriculum/curriculum-access.ts`, không phải service. Giữ vị trí export và exception mapping; bên trong gọi `isSemesterInRange`, nhận chỉ số nguyên từ 1 đến số học kỳ. `createItem` dùng `isCourseAddable`.
- `inReleasedVersion` gọi `releasedCourseIds`; vẫn dùng `status: { not: DRAFT }`, bao gồm PENDING / ACTIVE / HISTORICAL; cho phép client transaction, không query khi danh sách rỗng.
- `COURSE_FIELD_LIMITS` và `CURRICULUM_LIMITS` chuyển nguyên giá trị sang shared; DTO import và re-export cùng tên cũ. Validator không import DTO của feature khác, không sao chép giới hạn.
- **Deviation**: sửa thân shared writer và curriculum-access thay vì bọc lại service theo vị trí trong kế hoạch cũ. `courses.service.ts` không cần đổi. Thêm hai shared constant files và hai DTO re-export; cập nhật mock `releasedCourseIds` ở courses/course-relations vì chúng khai báo `Record<keyof CourseUsageReader, Mock>`.
- **Incident**: lượt tsc đầu phát hiện hai mock thiếu method mới; đã sửa trong phạm vi, không đổi assertion nghiệp vụ.
- **Lesson**: khi thêm public method, tìm cả mock kiểu `keyof`, không chỉ production callers.

### Disposition của các call site cũ

| Hàm | Call site thực tế | Disposition |
|---|---|---|
| `CoursesService.assertOwners` | `courses.service.ts:86`, `:142` | Giữ nguyên create/update và delegation tại `:364` |
| `assertCourseOwners` | `courses.service.ts:364`; `course.writer.ts:109` | Cùng chữ ký, vẫn kiểm cả catalog write và approved field write; chỉ thay quyết định thuần bên trong |
| `assertSemesterInRange` | `curriculum.service.ts:64`, `:121` | Giữ create/move call site, chữ ký và lỗi; đổi predicate bên trong export tại `curriculum-access.ts:64` |
| Active-course predicate | `curriculum.service.ts:61` | Gọi pure `isCourseAddable`; thông báo lỗi không đổi |
| `inReleasedVersion` | `courses.service.ts:354`; `shared/courses/course-edit-state.ts:11` | Giữ hợp đồng boolean; một query dùng chung predicate với batched reader |
| Batched/pure APIs mới | Hai import validators và context loader | Caller mới; không thay contract cũ của feature khác |

## BE-03 — Sheet specs, đọc và ghi Excel

- Spec SRS 4.3 là nguồn chung của thứ tự cột, template và reader; program header là label/value, header bảng ở dòng 9; flags, separator và requisite token là constants.
- Reader tìm header trong 20 dòng, chuẩn hóa NFC/case/khoảng trắng, chỉ tên cột thiếu, ghi nhận cột lạ; giữ số dòng thật, đọc number/rich-text/formula cached result/hyperlink/date, bỏ ô phụ của merged cell, giới hạn 2000 dòng và từ chối dữ liệu không phải workbook.
- Writer trả `Uint8Array`, giữ chữ Việt, bold/frozen header và width theo spec; nhận string cell để không biến text thành formula. `TT` và `Đăng ký được?` không được đọc ngược.
- **Decision during build**: P1 được người dùng miễn dừng; giữ nhãn cột SRS 4.3 (D6 default). Mẫu thật của Khoa vẫn còn nợ, không giả định đã đối chiếu.
- **Deviation**: không sửa package/lockfile, không install. ExcelJS đã cài trước; kiểu `xlsx.load` của bản đang cài đòi `ArrayBuffer`, nên truyền `new Uint8Array(content).buffer` thay vì Node Buffer. Không ép kiểu.
- **Incident**: tsc phát hiện khác biệt kiểu Buffer của ExcelJS; đã sửa cả reader và workbook specs; lần tsc cuối 0 lỗi.

## BE-04 — Context và kiểm tra chạy thử

- Catalog: ba query bảng gốc, tối đa một query released ids; không query theo từng dòng. Check required/format/type/owners/duplicates/cancelled/released, Decimal equality, ZERO_CREDITS, WILL_UPDATE và UNCHANGED. Plan có creates/updates, không ghi DB.
- Curriculum: năm query cố định qua client được truyền; `programName` / `majorCode` đọc từ version, `programCode` từ program. Course query còn lấy graph vertices để đường cycle có mã HP cho cả đỉnh trung gian ngoài file.
- So sánh header nhưng không ghi; course lookup và active/semester rules; giữ item id và group nếu còn elective, cảnh báo khi rời nhóm/xóa dòng; sortOrder theo thứ tự file trong từng học kỳ; parse flags/scores/requisite tokens và copy minScore PREREQUISITE từ catalog.
- Gọi trực tiếp F-08 `curriculumCycles`, `curriculumWarnings`, `programCredits`, không chép thuật toán. Chỉ lần xuất hiện course đầu tiên đi vào would-be curriculum; các lần sau báo DUPLICATE_COURSE và nêu dòng đầu.
- Issue collector giữ thứ tự file trước / row sau, ERROR trước HIGH trước INFO, đếm mỗi dòng lỗi một lần; file ERROR tính mọi dòng lỗi. Chỉ row không có row ERROR nằm trong write plan; caller tương lai phải từ chối toàn bộ nếu errorRows khác 0.
- **Decision during build**: thêm đường optional cho unknownColumns (catalog tham số thứ ba, curriculum thuộc parsed input), phát một file INFO mỗi cột. Các cách gọi hai tham số vẫn hợp lệ.
- **Deviation**: loader theo chủ sở hữu dữ liệu thật, `relationType` thay `type`, không gọi kiểu `PrismaClientLike` chưa tồn tại. Cycle catalog A → B + file B → A trả A → B → A theo target của closing edge, không dùng vòng xoay B → A → B trong ví dụ cũ. Không thay quyết định §3.
- **Lesson**: F-15 release snapshots không phải dữ liệu nguồn cho import Draft; dùng live catalog credits. Cùng một transaction client phải đi qua cả loader lẫn released reader khi BE-05 được dựng.

## Kiểm chứng và sự cố môi trường — lượt BE-01..BE-04

| Lệnh cuối (trong `source/backend`) | Exit | Kết quả |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | Không có lỗi; riêng nhóm lỗi do Prisma chưa generate: không có (BE-02..BE-04 chưa tham chiếu enum/model import mới) |
| `pnpm exec oxlint src` | 0 | Không có output chẩn đoán |
| `pnpm exec prettier --check src prisma/schema.prisma` | 2 | `No parser could be inferred for file "E:\PBL6\curriculum-management\source\backend\prisma\schema.prisma".` Không có cảnh báo src ở lượt cuối; đây là thiếu parser, không phải verdict schema sai |
| `pnpm exec vitest run` + 11 spec paths + `--configLoader native --pool threads` | 0 | 11 files / 162 tests passed; gồm courses.service, curriculum.service, course-relations.service, course.writer, usage reader và mọi spec mới BE-02..BE-04 |

- **Incident**: Vitest mặc định không load config được: `Error: Build failed with 1 error:` / `[plugin externalize-deps]` / `Error: spawn EPERM`. Dùng native config loader và thread pool ngay trong sandbox chạy được thật, không xin hay mở rộng quyền. Không sửa config repo.
- **Incident (đã giải quyết)**: Prettier không có parser Prisma ở lượt đầu. Orchestrator đã chạy prisma format thành công sau đó; escalation này đóng, không cần dependency/config mới.

## Lệch kế hoạch

Các drift source, vị trí helper/constant, F-15 worker/prefix/close, fixture release, permission catalog và F-11 cascade đã ghi tại §2/§2c của kế hoạch. Không thay quyết định D1..D16, không đổi API của feature đã dựng. BE-05..BE-07 được dựng ở lượt tiếp nối đã phê duyệt.

## USER ACTIONS

- Orchestrator chạy suite imports và permission-table với Docker/Testcontainers; migration/CHECK/generate/format đã xong, không còn blocker Prisma.
- Khoa cung cấp sheet thật để đối chiếu sau; D6 hiện vẫn là nhãn SRS.

## BE-05 — API, hàng đợi và ghi dữ liệu

- Rule 13: đọc worker/module/scheduler F-15 và QueueModule trước khi dựng. ImportsModule đăng ký queue imports, kế thừa BULLMQ_PREFIX; lịch sweep đăng ký không chặn bootstrap, lỗi được log. Đóng worker sau tối đa 10 giây rồi close(true), đóng cả queue.
- API dùng session/RequirePermission và guard hiện có. Danh mục yêu cầu DATA_IMPORT_EXCEL ALL; khung CTĐT kiểm programTarget, chỉ Nháp thường của chương trình chưa từng rời DRAFT. Không mở đường nhập vào Nháp đề xuất hoặc đính chính.
- Tệp và batch tạo trong một nested write nguyên tử; kiểm layout ngay, rồi worker chạy dry-run. File 5 MB, tối đa 2000 dòng, TTL 30 ngày; lịch sử không tải report/blob trong list. Detail/file dùng cùng predicate visibility, file kiểm expiry tại thời điểm đọc.
- Commit kiểm owner/quyền/report/TTL, claim DRY_RUN bằng updateMany rồi enqueue job id cố định. Worker khóa graph, khóa batch và đọc lại trạng thái; khóa version hoặc catalog advisory lock; revalidate và ghi COMMITTED trong cùng transaction. Lỗi nghiệp vụ ghi ABORTED trước khi đụng dữ liệu miền; writer lỗi thì rollback và retry.
- **Decision during build**: tách ImportsReader và import-validation để giảm service và kiểm riêng query/same-client flow; thêm unit specs tương ứng. Claim COMMITTING đặt finishedAt thành giờ bắt đầu xử lý để sweep không coi lần dry-run cũ là job bị treo; schema không đổi.
- **Deviation**: dùng sendFile/uploadedFileName, UserRefDto ở shared/dtos, pagination helpers và mapping 413 đã có, không tạo lại. Enum/status/correction gate theo source F-15. Giữ global any-of guard cho history, sau đó cộng visibility của owner; không ngầm nới quyền khi người dùng mất mọi import permission.
- **Incident**: phiên trước bị provider 429 ngắt; code được đọc và kiểm lại trước khi nối tiếp, không coi gián đoạn là lỗi feature. tsc bắt InputJsonValue/JsonValue trong spec mapping và kiểu ExcelJS load của e2e; sửa test với đúng kiểu dữ liệu, không ép kiểu Prisma mới.
- **Lesson**: chỉ kiểm trạng thái trước transaction chưa đủ chống replay đồng thời; phải đọc lại dưới khóa batch. Validation và released-course lookup phải cùng transaction client với writer.
- **Incident (orchestrator đã sửa, lượt tiếp nối giữ nguyên)**: e2e không boot do controller import memoryStorage từ multer không phải dependency trực tiếp; @types/multer chỉ bảo đảm kiểu, pnpm strict không resolve runtime module. Orchestrator bỏ import và storage option, dùng default FileInterceptor; không thêm dependency. Đã thêm Rule 11 entry trong error_log.md. Unit specs trước đó không load controller/AppModule nên không phát hiện.
- **Lesson (sau e2e)**: service unit xanh không chứng minh ứng dụng boot được. Đường upload vẫn gọi assertVersion → assertCurriculumImport → assertDirectEdit → AccessContext.assertCan trước parse/create; regression mới xác nhận OUT_OF_SCOPE không tạo batch/job. Không sửa service hoặc semantics SYSTEM đã có của F-02 để bù fixture sai.

- **Incident (2026-10-26, treo tắt ứng dụng khi Redis đã dừng)**: orchestrator báo health e2e đạt 3/3 nhưng `afterAll` chờ `app.close()` quá 180 giây; tháo ImportsModule thì hết. Bỏ riêng `queue.close()` trong processor không đủ: `node_modules/@nestjs/bullmq/dist/bull.providers.js:49` vẫn tự gọi `await this.close()` ở `onApplicationShutdown`, trước cả tùy chọn forceDisconnectOnShutdown. BullMQ 6.3.15 đi qua `dist/cjs/classes/queue.js:276` → `queue-base.js:106` → `redis-queue-backend.js:209` → `redis-connection.js:515`, chờ `await this._client.quit()` khi Redis mất. Scheduler của phiên bản này dùng chung backend của queue (`queue.js:102`), không phải một kết nối scheduler riêng; ImportsService cũng chỉ inject cùng queue. Sửa riêng processor: giữ grace 10 giây và `worker.close(true)` như F-15, thay close queue mềm bằng `queue.getBackend().close(true)` để ngắt kết nối sở hữu ngay; hook Nest sau đó dùng lại promise đóng backend nên không gửi QUIT. Không đổi QueueModule, cấu hình module, lịch cleanup, attempts/backoff hay giao dịch/trạng thái chống ghi lặp. Unit spec kiểm thứ tự đóng cưỡng bức, đủ grace khi job treo, job hoàn tất sớm được chờ và timer được xóa, scheduler còn chờ không chặn shutdown. Không chạy Docker/e2e; orchestrator cần chạy lại health e2e để xác nhận trên Redis thật.

## BE-06 — Xuất khung chương trình

- Rule 13: đọc rowCourse của F-15, dữ liệu ProgramVersion, CurriculumRequisite và sheet spec thực tế. Dùng ảnh chụp tên/tín chỉ khi có; không làm nội dung bản ban hành thay đổi theo danh mục hiện hành.
- Export kiểm scope, đọc mọi status DRAFT/PENDING/ACTIVE/HISTORICAL; sắp học kỳ/sortOrder/id, sắp requisites ổn định; giữ Decimal, flags x, scores và ô Đăng ký được? rỗng. Tên tệp được làm sạch, gửi qua helper RFC 5987 dùng chung.
- **Deviation**: plan trước F-15 gọi Released/Superseded và lấy tên/tín chỉ live; thay bằng vòng đời và snapshot helper thật. Không đổi D6/D13, không import service từ feature curriculum.
- **Lesson**: layout nhập/xuất chung không có nghĩa là dữ liệu lịch sử được phép đọc từ catalog live.

## BE-07 — E2E thật và permission table

- Rule 13: đọc fixtures accounts/programs/courses/curriculum/outcomes/syllabi/releases, containers/test-app/test-env và permission catalog thực tế. Dùng releaseViaApi, không khôi phục releaseVersionForTest. Harness có PostgreSQL ICU và Redis thật, prefix ngẫu nhiên theo suite; không cần sửa harness.
- Suite covers missing header, empty template tải qua API, unknown row 15, duplicate catalog và curriculum/cycle, fractional/zero credits, 30-row order, thay đổi sau dry-run không ghi một phần, 2000-row commit once, round trip sang bản copy và giữ id khi nhập lại, ROW_REMOVED cùng cascade matrix, NFR-05 1000 dòng dưới 30 giây, scope/history/owner, 6 MB, TTL/sweep và released catalog/program.
- **Decision during build**: fixture 1000/2000 dòng dùng bulk seed ngoài khoảng đo; upload, worker và polling nằm trong khoảng đo NFR. Copy round trip thay đúng programCode/programName đích, giữ nguyên các ô dòng và declarations để không sinh HIGH do khác header.
- **Deviation**: đường dẫn thật là test/permission-table.ts và test/permission-table.e2e-spec.ts, không phải test/permissions.e2e-spec.ts. R3 có cả hai P cells; catalog bị OUT_OF_SCOPE, không phải thiếu permission. Table dùng R4 denied, suite multipart kiểm R3 own/outside thật; denied write counter đếm ImportBatch.
- **Decision during build**: không chạy Docker/e2e theo chỉ định. Các ca e2e là đầu ra đã viết và type-check, không tuyên bố runtime đạt hoặc số đo NFR đạt. Orchestrator chạy và phản hồi lỗi nếu có.
- **Incident (kết quả orchestrator)**: boot crash multer thuộc BE-05 nêu trên che đường e2e trước đó; giữ nguyên fix của orchestrator. Sau boot, lệnh imports + permission-table báo 2 failed / 11 passed / 140 skipped; ba nguyên nhân được xử lý dưới đây, không coi suite đã xanh.
- **Incident (fixture role)**: export permission row dùng R7, nhưng seed chỉ R1..R6; fixture createAccount gọi role.findUniqueOrThrow làm cả suite setup dừng. Đổi deniedRole thành R6, có seed và không có permission curriculum.importExportExcel theo catalog; không thêm role hoặc sửa catalog.
- **Incident (fixture round trip)**: Prisma seed trực tiếp minTransferScore 5, ngoài thang DEC-11 0..4. Export giữ nguyên 5; validator đúng khi ABORTED/VALUE_INVALID ở cột Điểm chuyển. Header đích, programCode, token code – name, semester và registrable không phải nguyên nhân. Đổi fixture sang 2.5, không nới validator/clamp exporter. Thêm regression exporter → XLSX → reader → validator cho 2.5 không ERROR và 5 có đúng lỗi score; e2e assertion in batch.report khi thất bại.
- **Incident (fixture scope)**: createAccount(..., R3) không có unit tạo manual RoleAssignment SYSTEM; ScopeService hợp manual ALL với derived program scope nên outside upload 201 là đúng quyền thật của fixture. Bỏ role khi tạo account director; assignDirector sinh R3 derived chỉ own. Upload outside vẫn phải 403 OUT_OF_SCOPE, không dời gate; bổ sung assertion không có batch ngoài scope và unit kiểm từ chối trước persistence/queue.
- **Deviation (sau Rule 13)**: cả lỗi round-trip và scope là dữ liệu/quyền fixture sai, không phải bug exporter/validator/service. Sửa test để biểu diễn đúng hợp đồng nguồn; §2c plan ghi rõ manual SYSTEM, R1..R6 và score 0..4. Không đổi quyết định §3 hay hợp đồng feature khác.
- **Incident (full-suite route coverage)**: sau khi orchestrator xác nhận imports + permission-table đạt 153/153, users.e2e-spec.ts:140-166 báo GET /api/imports/types chưa có authorization coverage. Ba rows ban đầu chỉ bao phủ POST /imports (hai loại) và export; thiếu 7 method/path khác. Bổ sung GET types, curriculum-targets, templates/COURSE_CATALOG, list, detail, file và POST commit. R1 allowed / R6 denied theo permission-catalog.ts:159, :292; R6 không có cả hai permission nên không lọt any-of guard.
- **Decision during build (route coverage)**: giữ nguyên authenticated-only list và infrastructure. Matcher coi parameter của OpenAPI là wildcard nên dùng COURSE_CATALOG và placeholder-id cụ thể; route test vẫn gửi HTTP thật. POST commit đã được countWrites nhánh /api/imports đếm ImportBatch, không cần sửa counter. Full-run connection capacity là việc của orchestrator, không sửa trong lượt này.
- **Kiểm chứng (route coverage)**: pnpm exec tsc --noEmit -p tsconfig.json, pnpm exec oxlint src test và pnpm exec prettier --check src test đều exit 0; tsc/oxlint không có chẩn đoán, Prettier báo All matched files use Prettier code style! Không chạy e2e/Docker; orchestrator cần chạy lại users + permission-table với rows mới.

## Kiểm chứng — lượt BE-05..BE-07

| Lệnh (trong source/backend) | Exit | Kết quả |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | Không có chẩn đoán, gồm src và test; Prisma types đã generate, không còn lỗi được miễn |
| `pnpm exec oxlint src test` | 0 | Không có chẩn đoán |
| `pnpm exec prettier --check src test` | 0 | All matched files use Prettier code style! |
| `pnpm exec vitest run src/features/imports src/features/courses/courses.service.spec.ts src/features/curriculum/curriculum.service.spec.ts --configLoader native --pool threads` | 0 | 16 files / 164 tests passed; riêng 10 spec mới có 56 test. ERROR logs của processor là các nhánh retry/final failure/scheduler được chủ động mô phỏng |

- **Incident (đã sửa)**: lượt check đầu phát hiện hai unit specs cần thêm một pass Prettier; đã format hai tệp, check src/test sau đó đạt. Không sửa cấu hình formatter.
- E2E không chạy: đúng ranh giới Docker của brief, không phải verdict code đỏ. Orchestrator xác minh round trip, transaction rollback, NFR-05 và permission rows trên hạ tầng thật.
- Health full-suite flaky test do orchestrator báo là ngoài phạm vi; không đụng vào.

## Kiểm chứng — lượt sửa sau e2e

| Lệnh (trong source/backend) | Exit | Kết quả |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | Không có chẩn đoán |
| `pnpm exec oxlint src test` | 0 | Không có chẩn đoán |
| `pnpm exec prettier --check src test` | 0 | All matched files use Prettier code style! |
| `pnpm exec vitest run src/features/imports --configLoader native --pool threads` | 0 | 14 specs / 115 tests passed; có 3 ca regression mới cho upload scope và workbook score round trip |

- Không chạy e2e/Docker; kết quả Testcontainers mới sau chỉnh sửa vẫn do orchestrator cung cấp. Giữ nguyên controller đã được orchestrator sửa; không sửa code runtime trong lượt này, không thêm dependency.

## FE-01 — Quyền, routes, menu và nhãn

- Đã thêm dataImportExcel/curriculumImportExportExcel, ba route lazy /imports, /imports/history, /imports/history/:batchId và hai menu được RequirePermission bảo vệ. Không đổi hợp đồng guard/menu hay session state.
- Rule 13: đọc shared/auth/RequirePermission.tsx:11, useCan.ts:4, shared/layout/menuItems.tsx:18, routes.ts và router.tsx. useCan chỉ biết danh sách permission, không biết phạm vi; backend vẫn quyết định scope. Mọi holder data.importExcel hiện cũng có curriculum.importExportExcel, giữ guard một permission theo D đã duyệt.
- **Deviation**: schema.d.ts đã sinh sẵn, không chạy api:types hoặc sửa file. Wire WarningSeverity là ERROR/HIGH/INFO (schema.d.ts:2745), khác tên WARNING/NOTE trong context brief; nhãn LỖI/CẢNH BÁO/LƯU Ý không đổi. §2/§2c plan đã sửa theo nguồn, không đổi quyết định §3.
- **Decision during build**: dùng nhãn trạng thái đúng plan, không cung cấp sinh viên/kết quả học tập nếu GET /imports/types không trả về.

## FE-02 — API, query/mutation và tải tệp

- API response/query lấy alias từ components/operations đã generate; chỉ kiểu input File và giá trị Form là kiểu UI riêng, không viết lại response interface. Upload dùng FormData, không đặt Content-Type; download dùng helper đang có, giữ CSRF và tên tệp server.
- Rule 13: shared/api/client.ts:9/94/115 đã có withQuery/sendForm/downloadFile; client.test.ts đã kiểm multipart boundary, CSRF, UTF-8 filename, ApiError. Bổ sung regression sendForm khi phiên hết hạn; không thay runtime helper.
- **Deviation**: toSearchParams và shared/api/queryRoots.ts trong plan không tồn tại. Tái dùng withQuery và roots ở shared/courses, shared/curriculum, shared/outcomes; dùng PROGRAM_QUERY_KEYS có sẵn, không di chuyển export/call site feature khác. Ghi §2/§2c.
- **Decision during build**: useImportBatch giữ polling 1500 ms chỉ VALIDATING/COMMITTING. Effect trong hook invalidates lists/targets/courses/curriculum/outcomes/programs khi thấy COMMITTED (không phải lúc POST commit trả COMMITTING), nên trang detail cũng cập nhật cache đúng. Ref tránh lặp invalidation cho cùng batch đã hoàn tất.
- **Lesson**: kiểm từng import đối chiếu package.json của đúng project. FE chỉ dùng react/react-router/AntD/Query/dayjs và test dependencies trực tiếp; e2e chỉ @playwright/test và node built-ins. Không import transitive dependency, không thêm package/lockfile.

## FE-03 — Nhập và báo cáo chạy thử (MH-29)

- ImportPage dùng DetailPageLayout/PageHeader; ImportUploadForm dùng Form rules, chọn type từ server, chọn bản Nháp qua endpoint scoped, tải mẫu và giữ Upload trước khi gửi multipart. URL preselect không hợp lệ bị validator chặn; đổi type xóa version/file cũ. Chặn đuôi khác .xlsx và >5 MB trước request.
- ImportReport có trạng thái, loading không giả số 0, tổng/hợp lệ/lỗi, format errors, dòng worksheet và Toàn tệp. Table lọc severity, phân trang 50 để không dựng 2000 alerts. Cột lỗi và câu Dòng 15: LỖI được giữ đúng source.
- CommitImportButton kết hợp canCommit với status/report/errorRows/fileAvailable; tooltip khi bị khóa, modal nêu số dòng/chương trình và cảnh báo toàn bộ hoặc không gì cả/xóa dòng bỏ. Hủy không ghi. Sau COMMITTED có thông báo/link tới dữ liệu, không cho ghi lần hai.
- Rule 13: generated schema.d.ts:3775 là authority cho canCommit/fileAvailable/report; shared/forms/applyFieldErrors.ts cung cấp errorMessage. Dùng PageHeader/DetailPageLayout/EmptyState/StatusTag đang built; PageContainer/ApiErrorAlert của plan không tồn tại.
- **Deviation**: dùng fetch stub/fireEvent theo CurriculumPage.test.tsx thay MSW vì package.json không có MSW/user-event. Không thêm dependency. Report dùng Table lọc severity theo plan, không diễn giải HIGH thành ERROR.
- **Incident (unit, đã sửa)**: test gửi form ngay sau fireEvent.change khi AntD Upload chưa phát onChange bất đồng bộ, nên không có request/batch. Chờ filename xuất hiện trước submit; không thay runtime để chiều test. Sửa một assertion trùng text Người nhập bằng selector đúng số phần tử.
- **Decision during build**: P3 được người dùng miễn; không mở browser hoặc tuyên bố browser walk đạt. Nút ghi dùng nhãn Xác nhận nhập và modal Ghi dữ liệu, cùng nghiệp vụ xác nhận của plan.

## FE-04 — Lịch sử và chi tiết (MH-30)

- ListPageLayout/DataTable với loại, trạng thái, chỉ của tôi, page/pageSize trong URL; chuẩn hóa query không hợp lệ, thay filter đặt lại trang. Hiển thị đủ tên tệp/người nhập/thời điểm/program/count/status, link chi tiết; chỉ polling khi có hàng transient.
- Chi tiết dùng lại report/confirm, mô tả người nhập/chương trình/thời điểm, retry lỗi và nút tệp gốc. Hết hạn chỉ khóa file; báo cáo vẫn còn. canCommit của server kiểm chủ phiên, UI không tự suy diễn quyền từ role.
- Rule 13: CourseListPage.tsx:63 thực tế dùng useState, không dùng URL như plan nói; pagination.ts cung cấp default/options. Backend imports.reader.ts:22 dùng visibleBatches, recordedAt/id giảm dần, mine chỉ lọc người nhập hiện tại; không tự thêm userId query không có trong generated contract.
- **Deviation**: giữ yêu cầu URL filters của F-09 bằng useSearchParams thay sao chép local state của courses; §2c đã ghi. Detail ngoài scope hiển thị message 404 từ ApiError, không đổi thành quyền frontend giả.
- **Decision during build**: server authoritative khi file hết hạn hoặc quyền thay đổi sau khi mở trang; thao tác lỗi giữ report để người dùng biết cần thử lại, không tải error JSON thành xlsx.

## FE-05 — Toolbar khung chương trình

- Tái dùng PageHeader tại toolbar, thêm Xuất Excel khi có permission cho mọi version status. Nhập từ Excel chỉ ordinary Draft không sourceRequest; link truyền type/versionId qua constants dùng chung trong routes.ts, không phụ thuộc feature imports.
- Rule 13: CurriculumPage có version.status và sourceRequest, các canEdit flags do backend tính; courseLabels.ts:3 đã map đủ bảy CourseType, không khai lại hay sửa nhãn. API curriculum.ts có versionPath encode id; hook useExportCurriculum dùng downloadFile hiện có.
- **Deviation**: source dùng DRAFT/PENDING/ACTIVE/HISTORICAL, không còn Released/Superseded trong ví dụ plan. Target endpoint vẫn từ chối correction/ever-released programs; không tạo đường import Draft của đề xuất hoặc đính chính. Toolbar không có thông tin lịch sử release đầy đủ nên chỉ shortcut; server/target list là gate cuối.
- **Decision during build**: đưa lỗi xuất/scope vào Alert trên khung; không ẩn theo scope suy đoán vì Me không trả phạm vi. Unit kiểm permission, Draft/ACTIVE, link preselect, request đúng export URL và lỗi 403 có message.

## Test-case doc — Hợp đồng nghiệm thu F-09

- Tạo docs/testing/test-cases/f-09-excel-import-export-test-cases.md và thêm chỉ mục README. Đủ 23 AC của US-032..037, KB-022..025, NT-B2-01/02/03/09, NFR-05/20, DL-2/4 và walk 1..8; giữ 14 cột, tiếng Việt, Is Test? No, trạng thái chưa chạy.
- Rule 13: đọc README.md:27 và mẫu F-15, user-stories.md:418..485, test-plan.md:176..179/294..302/384. Mapping Automated chỉ trỏ spec/test có thật; không coi chứng minh mock rollback là sự cố DB thật.
- **Decision during build**: 30 ca: 001..014, 017..024, 026..030 có automation theo tầng; 015 sự cố DB, 016 NFR đầy đủ hai bước/hai loại, 025 DL-2 thật là Manual. Backend NFR test chỉ chứng minh dry-run khung 1000 dòng dưới 30 giây, không nói đã đo cả commit và catalog.
- **Deviation**: mặc định P1 cột SRS 4.3 vẫn được giữ do waiver trước; tương thích tệp Khoa thật chưa khẳng định. Không đọc vùng dữ liệu nhạy cảm để tạo chứng cứ DL-2 giả.

## Playwright — Tệp thật từ ứng dụng, không thêm dependency

- Tạo specs/f-09-excel-import-export.spec.ts và fixtures/imports.ts. Năm test bắt đầu F09-TC_001..005: hai mẫu; export/import/confirm/hủy/history/file; sai header bằng mẫu khác loại; đuôi/size; R6 menu/route/API bị từ chối.
- Rule 13: theo playwright-guide.md, F-07/F-15 specs, accounts.ts (asRole/stored auth), programs.ts:41/courses.ts/curriculum.ts, unique.ts. Tạo program/course XP/XI riêng với suffix từng test; không đếm tổng records, không sửa demo seed; dùng chooseOption cũ và không sửa fixture select.ts.
- **Deviation**: round trip browser vào cùng ordinary Draft từ bản xuất nguyên trạng. Khi nhập sang chương trình sao chép phải chỉnh metadata mã chương trình; backend e2e đã có ca thực và việc chỉnh workbook không có dependency trực tiếp ở e2e. TC_026 trỏ backend; không thêm ExcelJS hoặc workbook thủ công giả.
- **Decision during build**: timeout riêng 120 giây cho ca chuẩn bị dữ liệu qua UI, chờ terminal worker tối đa 30 giây; kiểm id giữ nguyên bằng API đọc cùng phiên. Không chạy Playwright/Docker trong sandbox theo brief.
- **Incident (tooling)**: e2e không có prettier trong package.json/node_modules, lệnh pnpm exec prettier trả Command not found. Không cài dependency; format đúng hai tệp mới bằng formatter trực tiếp đã có của frontend, không format specs/fixtures khác.

- **Incident (Playwright, lỗi test-only sau browser run)**: orchestrator chạy được 12 ca, còn 2 ca thất bại. F09-TC_002 dùng link Lịch sử nhập liệu không scope nên trùng menu và nội dung; giới hạn locator trong main để đi theo shortcut trên trang nhập rồi mở lịch sử/chi tiết. F09-TC_003 nhầm lỗi header là HTTP 400, trái plan §2a và imports.service.ts:143..159: máy chủ tạo batch ABORTED với formatErrors, trả 201. Sửa test kiểm 201/ABORTED, trạng thái Không ghi do lỗi, thông báo định dạng nêu cột Học kỳ và nút xác nhận bị tắt; sửa Expected Result của TC_003 tương ứng. Không sửa backend/frontend hoặc error_log. Orchestrator cũng đã xác minh tsc/oxlint exit 0 và mọi frontend unit file xanh sau rerun giới hạn 2 workers; các timeout full-suite là do tải. Lượt sửa này không chạy Playwright, chờ orchestrator chạy lại hai ca.

- **Kiểm chứng lượt sửa Playwright**: pnpm typecheck trong source/e2e exit 0; pnpm exec prettier --check ../e2e/specs/f-09-excel-import-export.spec.ts ../e2e/fixtures/imports.ts trong source/frontend exit 0 (All matched files use Prettier code style!). Giữ fixture imports.ts nguyên trạng; không chạy browser.

## Kiểm chứng — lượt FE-01..FE-05, TC và Playwright

| Project / lệnh | Exit | Kết quả |
|---|---|---|
| Frontend: pnpm exec tsc -b | 0 | Không có chẩn đoán; dùng Prisma/OpenAPI types đã được orchestrator sinh sẵn |
| Frontend: pnpm exec oxlint src | 0 | Không warning/error sau khi bỏ optional-chain cast không an toàn trong test |
| Frontend: pnpm exec prettier --check src | 1 | Còn 10 tệp không sửa: users/pages/UserListPage.test.tsx, users/pages/UserListPage.tsx, shared/api/schema.d.ts, shared/design-system/{DataTable.tsx, DESIGN_SYSTEM.md, EmptyState.tsx, ListPageLayout.tsx, motion.css, PageHeader.tsx, theme.ts}. Tất cả tệp thay đổi ở lượt này đã format |
| Frontend: pnpm exec vitest run --configLoader native --pool threads | 1 | Lượt unrestricted đầu spawn 86 workers, 22 failed/407 passed (có test mới được sửa sau đó và nhiều timeout 5000 ms). Whole suite rerun thêm --maxWorkers 2: 85 files passed, 1 failed; 439/440 tests đạt, chỉ CloneProgramModal.test.tsx:71 timeout 5000 ms |
| E2E: pnpm typecheck | 0 | tsc --noEmit thành công; không chạy Playwright |
| E2E: pnpm exec prettier --check specs fixtures | 1 / không có tool | Command prettier not found; không cài package |

- **Incident (môi trường, chưa tuyên bố full suite xanh)**: whole suite dưới tải có nhiều timeout ở các test cũ. Không sửa config, không tăng timeout hay sửa test feature khác để che lỗi. Rerun riêng 5 spec mới/đổi và CloneProgramModal với --maxWorkers 1 đạt 59/59 (55 ca ở các file thay đổi + 4 ca clone). Vì vậy hiện chưa có bằng chứng regression F-09, nhưng full-suite gate vẫn đỏ, cần orchestrator xác minh lại trên môi trường đủ tài nguyên; nếu tái hiện ổn định phải mở việc riêng.
- **Incident (formatting boundary)**: client.test.ts cần thêm một pass formatter sau sửa; đã format và kiểm lại toàn src. Mười cảnh báo cuối đều ngoài write-set của thay đổi này; schema.d.ts còn bị brief cấm chỉnh. Không format các tệp không liên quan chỉ để làm xanh gate. Orchestrator quyết định lượt format baseline riêng hoặc ghi nhận ngoại lệ; khuyến nghị xử lý tách biệt.
- **Escalation**: backend không cần sửa, không có dependency mới hay thay đổi quyết định §3. Còn full-suite timeout/baseline Prettier, browser walk/5 Playwright tests do orchestrator chạy, và ba ca Manual 015/016/025. Không chạy Docker, không chỉnh hạ tầng e2e, không sửa tài liệu ngoài scope.

## DOC-01 — Chốt tài liệu và bàn giao, 2026-10-26

- Đã cập nhật general_architecture, features_architecture, database_and_models và technical_reference theo mã thật: hai bảng/hai enum/hai CHECK, đủ 9 method/path, worker, idempotency, sweep, giới hạn XLSX, quyền/phạm vi và client helpers. Data dictionary đã chứa ImportBatchFile, programId/versionId, VALIDATING/COMMITTING; không sửa lại. Sơ đồ §8 đã đủ các trạng thái/nhánh stale sweep, chỉ số đếm tổng còn 3 được sửa thành 5.
- **Deviation (Rule 13)**: DOC-01 còn gọi imports là worker đầu tiên dù F-15 đã có release-activation. Sửa thân bước và §2c theo source: BULLMQ_PREFIX dùng chung; lifecycle hiện tại chờ tối đa 10 giây, force-close worker và queue backend, không mô tả close mềm có thể treo. Không đổi quyết định §3 hay source.
- **Incident (xác nhận đóng lỗi shutdown)**: orchestrator đã sửa ImportsProcessor dùng queue.getBackend().close(true) sau worker.close(true); hook Nest không còn chờ Redis QUIT vô hạn khi Redis mất. health + imports e2e sau sửa đạt 16/16; giữ bằng chứng 171/171 trước fix riêng, không gọi đó là kết quả rerun sau fix.
- TC doc ghi 27 Passed và ngày/layer thực thi theo kết quả orchestrator; ba ca Manual 015/016/025 giữ trống. Số ca theo tầng chính: 5 Playwright, 17 Backend e2e, 1 Backend unit, 4 Frontend unit; không đếm trùng coverage. Chỉ mục đếm từ từng dòng: 789 ca = 408 tự động Passed + 381 thủ công chưa chạy trên 14 tính năng; 5 ca MVP xuyên tính năng theo dõi riêng.
- **Incident (flake còn mở, không phải bug mới F-09)**: sau hai lỗi test-only TC_002/003 đã sửa, lượt Playwright đầu 14/14 trong 1,6 phút; lượt hai 13/14 vì TC_001 gặp chooseOption tại fixtures/select.ts:22, combobox Loại dữ liệu còn mở/value rỗng sau 10 giây. Flake từng gặp qua curriculum.ts:27, nay xuất hiện ở spec thứ hai. TC_001 giữ Passed kèm Failed 1/2 lần chạy ngày 10/26/26, chưa sửa. Không sửa fixture hoặc error_log ở lượt docs-only.
- **Decision during build**: Done nghĩa là BE + FE + browser walk và tài liệu đã giao, không phải đã nghiệm thu ba ca Manual hay tương thích tệp thật của Khoa. Plan/index/status được chốt kèm caveat này; current_work bàn giao F-16 FE đang triển khai → F-12 → F-17, không đánh dấu F-16 hoàn tất. Giữ mọi khoản nợ cũ và thêm file Excel thật của Khoa (nhãn SRS 4.3 mặc định).

## Kiểm chứng chốt F-09 — kết quả orchestrator ngày 2026-10-26

| Tầng / phạm vi | Kết quả | Giới hạn / diễn giải |
|---|---|---|
| Backend whole unit suite | 1134/1134 Passed | Bao gồm công việc F-16 trong tree; không suy F-16 đã hoàn tất |
| Backend e2e health + imports | 16/16 Passed | PostgreSQL/Redis thật trên Testcontainers, sau shutdown fix |
| Backend e2e imports + permission-table + users | 171/171 Passed | Trước shutdown fix; đủ kiểm route authorization |
| Frontend tsc -b | Exit 0 | Kết quả do orchestrator cung cấp |
| Frontend oxlint | Exit 0 | Kết quả do orchestrator cung cấp |
| Frontend unit rerun giới hạn 2 workers | 99/99 Passed | Mọi file F-09 xanh cùng nhóm file timeout; 19 failures full run trước là load timeout, không thuộc F-09 |
| Playwright F-09 lượt 1 sau sửa | 14 Passed, 1,6 phút | 9 auth setup + F09-TC_001..005 trên dev app |
| Playwright F-09 lượt 2 | 13 Passed, 1 Failed | TC_001 do flake chooseOption chưa sửa; không hạ TC thành bug nghiệp vụ |
| Playwright trước sửa | 12 Passed, 2 Failed | Hai lỗi test-only TC_002/003 đã ghi Incident ở phần Playwright; không thay lịch sử |
| TC nghiệp vụ theo bảng | 27 tự động Passed; 3 Manual chưa chạy | Auth setup không là TC nghiệp vụ; TC_001 có ghi chú flake |

Lượt chốt chỉ sửa docs: Test-Path trả True cho 18/18 đường dẫn nguồn/migration bổ sung trong ba tài liệu kiến trúc và technical reference. Không chạy lại unit/e2e/Playwright và không sửa source, fixture, F-16 hoặc dependency. Các kết quả ứng dụng trên là xác nhận của orchestrator, không là lệnh chạy mới trong sandbox. Tài liệu thay đổi dùng UTF-8 không BOM, LF; features_architecture được chuẩn hóa CRLF cũ về LF theo brief.
