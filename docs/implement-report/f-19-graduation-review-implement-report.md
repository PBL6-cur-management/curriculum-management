# F-19 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Status**: **CÓ MÃ HOÀN TẤT VÀ XANH — 2026-10-30**. BE-01..BE-12, FE-01..FE-06, DOC-01 đã có. Orchestrator xác nhận: BE tsc 0, unit 363/363, e2e graduation 19/19, batches 8/8, corrections 10/10, permission-table 185/185; FE tsc -b 0, oxlint 0, vitest 11 file 85/85. Docs kiến trúc, database và chỉ mục test case (F19-TC_001..035) đã đồng bộ. Còn mở: 16 ca Manual F19-TC_020..035, nghiệm thu Khoa C4, tách view kết quả sang shared khi build F-20.
- **Đến đâu**: backend evaluator/audit/batch/correction đã xanh; thêm MH-53/MH-54, immutable history/detail, export, task retry, staff navigation và entry MH-52 chỉ điều hướng. Generated API đã có từ orchestrator và được đối chiếu, không regenerate/sửa tay. Không đổi F-17 producer hoặc schema/migration đã đóng băng.
- **Quyết định đã duyệt**: E1 giữ administrative retroactivity/current calendar; E2/E3 dùng defaults trong plan, còn nợ Faculty input. Blocker mới không liên quan Faculty.
- **Kiểm chứng**: lượt frontend chạy `pnpm exec tsc -b --pretty false` từ source/frontend, exit 0, stdout/stderr rỗng. Đã format các source/spec thay đổi bằng Prettier của frontend. Không thử Vitest/Playwright vì spawn EPERM đã biết; orchestrator chạy runtime. Kết quả cũ giữ nguyên trong lịch sử; không chạy backend, Prisma, migration, codegen, Docker hay servers ở lượt frontend.
- **Không thay đổi trong lượt frontend**: backend, F-16/F-17/F-18 contracts, generated schema.d.ts, package/lockfile, design-system, shared auth registry, Playwright fixtures/select.ts, progress docs. Ngoài feature mới chỉ có route/menu wiring, test menu/notification và route-only MH-52 entry được phép. Giữ nguyên các user edits có trước; không đọc sensitive trees/dotenv.

## Bảng tổng hợp

| ID | Trạng thái | File / lý do |
| --- | --- | --- |
| Dependency gate | Đã giải quyết U3 Option A | Identity qua immutable academicResult relation, không sửa producer |
| BE-01 | Đã giao mã/spec; static checks đạt | Bốn file shared/graduation; Vitest chưa chạy |
| BE-02 schema | Đã giao; orchestrator đã validate | Năm enum, sáu model, back-fields và một notification member |
| BE-02 migration/codegen | Orchestrator đã apply/generate | 20261030050730_graduation_review; lượt này không sửa |
| BE-03 | Đã giao | Access/capabilities, additive task facades và specs |
| BE-04 | Đã giao | Transactional reader, canonical input codec/digest và specs |
| BE-05 | Đã giao | Decimal allocation/four checks và specs |
| BE-06 | Đã giao | Live, immutable saves/history, result codec và specs |
| BE-07 | Đã giao | Preview/frozen roster/batch APIs và specs |
| BE-08 | Đã giao | Queue processor/scheduler, leases/recovery và specs |
| BE-09 | Đã giao | Durable receipt scanner, re-audit/retry và specs |
| BE-10 | Đã giao | Transactional notification writer và specs |
| BE-11 | Đã giao | Module, controllers, Swagger DTOs và options |
| BE-12 | Orchestrator xác nhận baseline xanh | Ba e2e suites + permission matrix và unit xanh; opt-in benchmark chưa được cung cấp verdict |
| FE-01 | Đã đối chiếu generated contract | Generation do orchestrator; frontend không sửa schema.d.ts |
| FE-02 | Đã giao; tsc đạt | Adapters/generated aliases, keys/hooks, exhaustive labels |
| FE-03 | Đã giao; chờ runtime | MH-53/context/result/history/audit detail và R1-only retry |
| FE-04 | Đã giao; chờ runtime | Preview/confirm, durable progress, server filters và XLSX export |
| FE-05 | Đã giao; chờ runtime | Bốn lazy staff routes, menu và entry MH-52 |
| FE-06 | Đã viết; chưa chạy | Tám feature specs + menu/notification regressions; không có Playwright spec mới |
| DOC-01 | Đã giao report/manual trong scope | Plan đối chiếu source; architecture/index sync để orchestrator |

## Dependency gate — U1..U9 và §2

- **Decision during build**: source thắng baseline plan. U1/U2 khớp identity/interval/as-of/GRADUATION/transcript; U5 xác nhận exceljs ^4.4.0 đã cài và F-09 ghi literal string, không có public safe-text helper; U6 xác nhận F-12 chỉ formula/assessment, không official transcript; U7 không tái dùng F-18 completionEvidence vì khác context/allocation/credit policy, tái dùng bestAcademicResults chung của F-17. U8/U9 là tương lai, không giả vờ runtime đã có. Evidence từng dòng ở plan §2/§8.
- **Decision during build**: U4 thiết kế hai task facades nhận taskId/leaseToken/tx, helper restricted ở student-access.ts và private authorized cores trong hai reader; không sửa shared/students trong lượt này.
- **Deviation**: sửa giả định lock: academic-result.writer.ts:84 chỉ khóa Students sorted. F-19 vẫn khóa Program → Student; giao nhau ở Student lock, không buộc producer đổi thứ tự hoặc contract.
- **Incident**: chỉ sau khi thêm BE-01/schema mới đối chiếu hết nội dung snapshot với thuật toán scanner. academic-result.writer.ts:41 và :49 chỉ xuất score10, score4, letterGrade, status, dataSource. Không có studentId/courseId/semesterId để thực hiện BE-09 bước 2 như viết. Gate vì vậy chưa đạt; đã sửa lại Status/§6/U3 và dừng, không che bằng kết quả static xanh.
- **Lesson**: kiểm từng key JSON producer trước khi cho downstream gate qua; tên/comment “full snapshots” không chứng minh identity có trong payload.

## BE-01 — Vocabulary, shortfalls, diagnostics

- **Decision during build**: constants giữ đúng versions/limits/queue của plan; types không import generated Prisma. CourseShortfall dùng discriminated union để cấm code/category lệch nhau ở compile time. Tách diagnostics khỏi academic shortfalls và tái dùng đúng object F-17/F-16; thêm diagnostic unsupported stored schema theo Gotchas của plan.
- **Decision during build**: spec dùng synthetic fixtures cho năm code/bốn category, nullable/non-null provenance/minima, decimal-string JSON, hai outcome branches, warning-only ELIGIBLE và diagnostic identity/status. Đây là contract/type fixtures, không phải decoder/evaluator tests; decoder/evaluator còn thuộc các bước sau.
- **Deviation**: none; private decomposition/literal naming nằm trong quyền quyết định của lượt này.
- **Incident**: native argument passing PowerShell bỏ quote trong patch schema; đã sửa quoting của patch invocation và relation names. Không chạy Prisma để chữa/format schema.
- **Lesson**: type-check vocabulary độc lập generated models cho phép bàn giao schema trước codegen, nhưng không thay runtime validation/migration review.

## BE-02 — Schema only

- **Decision during build**: thêm GraduationConclusion, GraduationAuditTrigger, GraduationBatchStatus, GraduationBatchItemStatus, GraduationReauditStatus; sáu model đúng shape plan; named relations có quotes; Restrict delete, composite keys/indexes, optional head/receipt/batch audit links. Chỉ thêm back-fields vào bảy model hiện hữu và GRADUATION_CONCLUSION_CHANGED vào NotificationType.
- **Deviation**: migration/generation do orchestrator, không tạo migration SQL hoặc sửa generated output trong lượt này, đúng brief. Chưa cập nhật architecture/database docs để không mô tả schema này như đã migrate; DOC-01/orchestrator đồng bộ khi apply.
- **Incident**: gate U3 phát hiện muộn; schema edits đang có nhưng không được coi là đã qua dependency acceptance hoặc DB validation.
- **Lesson**: giữ audit/context/batch/receipt/task riêng để không đổi student status hoặc producer ownership; CHECK/cross-row writer invariants vẫn phải kiểm chứng sau generation.

### SQL bàn giao — chưa áp dụng

Chỉ append vào migration được Prisma sinh sau khi orchestrator giải quyết U3, review schema và SQL. Không cần thêm partial index nào cho F-19 theo plan; uniques/indexes đã nằm trong schema. Null rosterEnrollmentId kèm rosterDiagnostic, duplicated shortfalls, chain/head/context identity là writer/decoder/transaction invariants, không tạo cross-row CHECK.

```sql
ALTER TABLE "GraduationAudit"
  ADD CONSTRAINT "GraduationAudit_schemaVersion_check" CHECK ("schemaVersion" > 0),
  ADD CONSTRAINT "GraduationAudit_reviewer_check" CHECK (
    ("trigger" IN ('STAFF', 'BATCH') AND "auditedById" IS NOT NULL)
    OR ("trigger" = 'RESULT_CHANGE' AND "auditedById" IS NULL)
  );

ALTER TABLE "GraduationBatch"
  ADD CONSTRAINT "GraduationBatch_roster_counts_check" CHECK (
    "studentCount" > 0 AND "enrollmentCount" > 0 AND "studentCount" <= "enrollmentCount"
  ),
  ADD CONSTRAINT "GraduationBatch_running_lease_check" CHECK (
    "status" <> 'RUNNING' OR ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
  );

ALTER TABLE "GraduationBatchItem"
  ADD CONSTRAINT "GraduationBatchItem_outcome_check" CHECK (
    ("status" = 'REVIEWED' AND "auditId" IS NOT NULL AND "rosterEnrollmentId" IS NOT NULL
      AND "errorCode" IS NULL AND "errorMessage" IS NULL)
    OR ("status" = 'ERROR' AND "auditId" IS NULL
      AND "errorCode" IS NOT NULL AND "errorMessage" IS NOT NULL)
    OR ("status" = 'PENDING' AND "auditId" IS NULL
      AND "errorCode" IS NULL AND "errorMessage" IS NULL)
  );

ALTER TABLE "GraduationResultChangeReceipt"
  ADD CONSTRAINT "GraduationResultChangeReceipt_targetCount_check" CHECK ("targetCount" >= 0);

ALTER TABLE "GraduationReauditTask"
  ADD CONSTRAINT "GraduationReauditTask_attempts_check" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "GraduationReauditTask_running_lease_check" CHECK (
    "status" <> 'RUNNING' OR ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
  );
```

## Lịch sử — kiểm chứng lượt đầu

Từ source/backend; stdout của tsc và oxlint rỗng, wrapper ghi nhận exit code 0. Không có generated F-19 model import. Schema.prisma không chạy Prettier hoặc bất kỳ Prisma command nào.

| Command | Exit | Output |
| --- | --- | --- |
| pnpm exec tsc --noEmit -p tsconfig.json | 0 | Không có stdout/stderr; marker TSC_EXIT_CODE=0 |
| pnpm exec oxlint src/shared/graduation/graduation.constants.ts src/shared/graduation/graduation.types.ts src/shared/graduation/graduation.errors.ts src/shared/graduation/graduation-contract.spec.ts | 0 | Không có stdout/stderr; marker OXLINT_EXIT_CODE=0 |
| pnpm exec prettier --write src/shared/graduation/graduation.constants.ts src/shared/graduation/graduation.types.ts src/shared/graduation/graduation.errors.ts src/shared/graduation/graduation-contract.spec.ts | 0 | graduation.constants.ts 345ms; graduation.types.ts 21ms; graduation.errors.ts 11ms; graduation-contract.spec.ts 61ms (đều prefix src/shared/graduation/) |
| pnpm exec prettier --check src/shared/graduation/graduation.constants.ts src/shared/graduation/graduation.types.ts src/shared/graduation/graduation.errors.ts src/shared/graduation/graduation-contract.spec.ts | 0 | Checking formatting... / All matched files use Prettier code style! |

Spec giao orchestrator: `source/backend/src/shared/graduation/graduation-contract.spec.ts`. Chưa chạy, không khẳng định test xanh.

## Lịch sử — escalation lượt đầu (U3 đã giải quyết)

### U3 — Snapshot không có identity cho scanner

- **Đã hoàn tất**: reverify và sửa §2/§8, U4 design, BE-01 source/spec, BE-02 schema; static checks đạt. Các edits downstream đã có trước khi phát hiện blocker, không phải gate đã pass.
- **Điểm vướng**: BE-09 scanner bước 2 yêu cầu derive student/changed semester từ validated before/after. Source snapshot tại academic-result.writer.ts:41/:49 không có các key đó; schema.prisma:1157 chỉ liên kết academicResultId. Đây là dependency contract không hỗ trợ plan step như viết.
- **Lựa chọn A — khuyến nghị**: orchestrator duyệt scanner/task-capability lấy identity bằng join AcademicResultChange.academicResult; validate before/after chỉ theo năm field thực có. Attempt student/course/semester không đổi qua writer hiện có (academic-result.writer.ts:172 chỉ update scores/status/source/revision), feed FK Restrict bảo toàn parent. Tiếp tục receipt/no-watermark strategy; bổ sung regression cho identity/cutoff. Không cần đổi producer/endpoint/schema hoặc dependency.
- **Lựa chọn B**: giao F-17 owner mở rộng before/after snapshot với identity, cùng policy cho feed đã tồn tại và consumer compatibility. Đây là thay contract producer, không tự thực hiện trong F-19.
- **Chưa chọn**: không join ngầm, không lấy identity từ current enrollment, không sửa producer hay backfill feed. Chờ orchestrator quyết định trước migration/codegen/resume.

## Lịch sử — chưa làm ở cuối lượt đầu

- Quyết định U3; gate chưa pass.
- Vitest spec nói trên; không chạy test runner theo fence.
- Prisma validate/create-only/review/apply/generate; SQL ở trên chưa được thực thi.
- BE-03 trở đi, frontend, runtime/DB acceptance, manual/Faculty certification và DOC-01 đồng bộ toàn bộ sau feature.

## Tiếp tục 2026-10-30 — U3 Option A

- **Decision during build**: người dùng duyệt Option A. Identity lấy từ AcademicResultChange.academicResult (studentId/courseId/semesterId); validate before/after theo năm field score10/score4/letterGrade/status/dataSource. Orchestrator xác nhận writer không đổi identity, không có delete path và FK Restrict. Không sửa F-17 producer.
- **Decision during build**: orchestrator đã validate schema, chạy BE-01 unit 13/13, sinh/apply migration 20261030050730_graduation_review với CHECK SQL bàn giao và generate; tsc 0. Lượt này không chạy lại Prisma hoặc sửa schema/migration.
- **Deviation**: none về quyết định nghiệp vụ; U3 không còn blocker. Không xóa lịch sử escalation ở phần đầu báo cáo.
- **Incident**: pipe-mode PowerShell đồng loạt không khởi tạo được (exit -1073741502). PTY với login:false chạy được; tiếp tục cùng shell/quyền, không restart server hoặc mở rộng sandbox. Không coi failed shell là code verdict.
- **Lesson**: kiểm chứng mode thực thi trước khi coi DLL-init là blocker cần đổi môi trường.

## BE-03 — Access và restricted capabilities

- **Decision during build**: giữ nguyên mọi actor facade/caller; tách private authorized core trong hai reader, task facade pin lookup và recheck token/status/expiry/context/baseline/source identity trong supplied tx. Role/permission cùng assignment; R3 program scope, owning R6 đi qua reader identity proof, write DIRECT chỉ R1/R3.
- **Deviation**: private resolver nhận thêm optional cached semester map để actor path giữ thứ tự validation và không lặp truy vấn; public signatures không đổi.
- **Incident**: none trong hành vi F-17; specs cũ không sửa. Các caller PROGRESS ở students-read.service.ts và ELIGIBILITY ở registration-eligibility.reader.ts giữ nguyên; constructors/DI của reader cũng giữ nguyên.
- **Lesson**: task ID không phải authority; leaseToken và khóa/recheck thuộc capability lẫn final worker fence.

## BE-06 — Live, audit history và persistence

- **Decision during build**: một evaluator chung, result codec kiểm schema/rule và nested contracts, decimal arithmetic exact; writer append/head trong supplied Serializable tx với operation-key replay và khóa Program → Student → context. Live không ghi; diagnostic409 trả CANNOT_AUDIT, auth/404 vẫn transport error. Freshness so IDs/revisions cả attempts mới trước scanner và task state.
- **Deviation**: GraduationAuditValue nằm ở shared/graduation/graduation.types.ts, không để shared writer import feature DTO. History không resolve lại current mapping để audit cũ còn đọc được sau administrative change; authorization vẫn staff program scope.
- **Incident**: tsc integration phát hiện type mismatches trong code mới khi các parallel slices chưa hoàn tất; sửa ở owner, không đổi existing consumer contract.
- **Lesson**: idempotency lookup phải đi trước reevaluation; codec/history không được dùng latest result thay snapshot.

## BE-07 — Preview, roster, batches và SQL-filtered outcomes

- **Decision during build**: roster giữ một student/program/semester item kể cả overlap/unknown boundary/missing mapping; counts distinct students tách contexts; preview digest gồm filters, labels, interval/updatedAt và resolved mapping facts. R3 không tạo cross-program whole-cohort review. Create/replay atomically rồi mới enqueue; queue outage để QUEUED phục hồi.
- **Decision during build**: items/export lọc theo original item.auditId và frozen JSON labels; pagination/count trong DB, error không giả conclusion. Export helper duyệt bounded pages và decode saved results, kiểm creator/current direct scope/terminal status.
- **Deviation**: khi bulk version resolution gặp domain error, fallback từng context trong chunk tối đa 50 để giữ diagnostic riêng, không làm rớt cả roster. Program label lấy resolved version name; selector label theo latest published name giống F-17, tuyệt đối không dùng label để chọn applied version.
- **Incident**: Program không có programName column; sửa new selectors/roster dùng ProgramVersion, không thay schema.
- **Lesson**: malformed data vẫn là durable context outcome, không silently shrink roster.

## BE-11 — Composition, controllers và safe options

- **Decision during build**: GraduationSharedModule export evaluator/writer/notifier; GraduationModule wire StudentsSharedModule, feature queue, concrete correction handler token và toàn bộ routes. Live cho owning R6, staff pages/history/batches không cho R6; options dùng view hoặc audit scope, không đòi student.viewProgress. Background polling dùng PassiveRequest; export no-store/sendFile.
- **Deviation**: export filters dùng PickType bỏ page/pageSize khỏi item query; giữ validation và oneOf HTTP outcome schema cụ thể. Không sửa existing guards hoặc seed.
- **Incident**: none; permission inventory/spec thuộc BE-12 integration cùng harness.
- **Lesson**: Swagger oneOf nằm ở response schema và nested shortfall schemas, không dùng Object/any hoặc frontend hand-written aliases.

## BE-04 — Transactional input và reproducible evidence

- **Decision during build**: capability được resolve trong supplied transaction; đọc issued frame với name/credit snapshots bắt buộc, version identity, groups, toàn bộ attempts đến cutoff, current equivalence members và catalog provenance. Codec kiểm nested fields, enum, dates, decimal strings và identity; canonical JSON/digest SHA-256 giữ revision và policy-relevant facts, không persist Prisma.Decimal.
- **Deviation**: codec/types tách file để reader chỉ chịu trách nhiệm DB; không tái dùng F-18 completionEvidence vì F-19 cần allocation và credit provenance khác. Tái dùng F-17 bestAcademicResults và supplied-tx facades.
- **Incident**: none; không fallback thiếu snapshot về current catalog cho frame, không đoán ngày học kỳ.
- **Lesson**: name/credit snapshot không có nghĩa equivalence/courseType/calendar cũng immutable; E1/current-catalog provenance phải đi cùng input history.

## BE-05 — Allocation và bốn checks

- **Decision during build**: dùng Prisma.Decimal; PASSED completion độc lập numeric best, chọn completion bằng bestAcademicResults trên PASSED attempts. Một class có một destination; distinct surplus course là free credit, retake không là free credit. Ambiguous buckets trả diagnostic E3; necessary EXEMPT và conditional/elective classification chưa rõ trả diagnostic E2.
- **Decision during build**: required 3 / studied 2 nhận completion với 2 credits, warning gap 1 và vẫn kiểm group/global deficits. Group minima độc lập, unknown blocks advisory, kết luận chỉ phụ thuộc shortfalls. Shortfall order đúng mandatory → elective → total → conditional, rồi frame chronology/groupCode và stable code; thêm regression spec thay vì sort category alphabetically.
- **Deviation**: evaluator nội bộ nhận ISO timestamp string (optional, mặc định thời điểm hiện tại) thay Date trong pseudocode; fixed timestamp specs bảo đảm determinism của cùng input/time. Public contract không đổi.
- **Incident**: sau host interruption phát hiện alphabetical sorting không đúng contract; sửa trong engine và thêm spec. Không chạy Vitest trong sandbox.
- **Lesson**: các evidence/codes có thứ tự deterministic chưa đủ nếu UI contract quy định business order.

## BE-08 — Queue, leases và recovery

- **Decision during build**: ID-only jobs, scheduler đăng ký recurrent scan/recovery và bootstrap recovery; outage startup có bounded retry timer, không chặn app. Batch worker claim/reclaim qua DB clock và leaseToken, recheck active requester/current DIRECT scope mỗi chunk; mỗi item transaction atomic audit/link/outcome và final fence. Domain error lưu ERROR riêng; infrastructure retry/recovery không duplicate audit.
- **Deviation**: transaction/retry helper nằm shared audit writer, jobs constants re-export; concrete correction handlers được inject qua token để processor không phụ thuộc vòng. Unit worker scenarios nằm graduation.processor.spec.ts, integration nằm graduation-batches.e2e-spec.ts.
- **Incident**: host OOM làm lượt trước mất report, không coi là code/test verdict; lượt tiếp tục chạy sequential, không khởi động agent/server/container.
- **Lesson**: Redis delivery không thay durable SQL state; fence cuối transaction phải rollback toàn bộ khi hết quyền lease.

## BE-09 — Correction scanner và restricted re-audit

- **Decision during build**: thực hiện U3 Option A đã duyệt: scanner join AcademicResultChange.academicResult để lấy immutable studentId/courseId/semesterId; validate before/after đúng score10/score4/letterGrade/status/dataSource và before-null iff revision 1. Không sửa producer F-17.
- **Decision during build**: quét missing receipt, không timestamp watermark; SKIP LOCKED source row, receipt+toàn bộ target tasks cùng Serializable transaction. Historical/dual-major contexts theo cutoff, ngày thiếu là diagnostic/retry. Re-audit restricted capability pin task/lease/tx, independent of former reviewer; latest head covers every revision thì COVERED, còn lại append RESULT_CHANGE và transactional notices. FAILED/current pending freshness và R1-only retry/list có HTTP/spec coverage.
- **Deviation**: schema giữ nguyên; receipt identity dựa relation theo quyết định, không đòi source payload chứa identity hoặc backfill. Failed enqueue được recovery từ SQL durable state.
- **Incident**: U3 escalation cũ đã đóng; FK Restrict/no-delete/identity immutability do orchestrator xác nhận, không suy luận từ payload.
- **Lesson**: recordedAt chỉ để thứ tự quét; acknowledgement là receipt, không phải cursor theo commit-order không được bảo đảm.

## BE-10 — Notifications

- **Decision during build**: GraduationNotificationsWriter nhận supplied tx; chỉ notice khi conclusion đổi, lấy active R1 recipients qua existing shared predicate, deduplicate userId; không suppress former reviewer hoặc sinh actor giả. Notification là GRADUATION_CONCLUSION_CHANGED với null changeRequestId; zero recipient được log và không rollback audit.
- **Deviation**: không đổi existing NotificationService signature/callers; dedicated writer đồng transaction với audit/head/task completion.
- **Incident**: none; retry rollback behavior có cả unit/e2e specs, chưa chạy trong lượt này.
- **Lesson**: exactly-once effect dựa task fence/transaction, không dựa Redis delivery hoặc notification best-effort ngoài transaction.

## BE-12 — Acceptance specs và bàn giao runtime

- **Decision during build**: seed synthetic issued releases bằng existing HTTP/helpers, source corrections qua shared F-17 writer; không dùng real-data trees. graduation.e2e-spec.ts kiểm academic/security/history/schema constraints; graduation-batches.e2e-spec.ts kiểm preview/roster/filter/queue/export/recovery; graduation-corrections.e2e-spec.ts kiểm durable receipts/rollback/restricted task/retry/notifications và old batch immutability. Permission inventory bổ sung toàn bộ routes, denied attempts kiểm sáu F-19 tables và Notification.
- **Decision during build**: performance suite chỉ chạy khi RUN_GRADUATION_PERFORMANCE=1, 500 students với multisemester retakes/groups/equivalence; đo confirmation-to-terminal, counts, query count, peak RSS, progress và idempotent recovery. Test-only opt-in không cần production Env field/dependency mới.
- **Deviation**: không chạy runtime suites, Prisma hoặc DB checks theo fence. Chỉ giao code/specs; không khẳng định 500 students đạt 5 phút hoặc existing tests còn green trước orchestrator execution. No frontend/codegen.
- **Incident**: máy thiếu RAM; tiếp tục sequential và static checks, không chạy thêm agents/heavy infrastructure để tái hiện.
- **Lesson**: type/lint/format là static verdict, không chứng minh queue/transaction/SQL CHECK hoặc performance acceptance.

## Handoff hiện hành — không còn escalation mới

- **Unit paths** (từ source/backend): src/shared/graduation/graduation-contract.spec.ts; src/shared/graduation/graduation-access.spec.ts; src/shared/graduation/graduation-capability.spec.ts; src/shared/graduation/graduation-input.reader.spec.ts; src/shared/graduation/graduation-allocation.spec.ts; src/shared/graduation/graduation-engine.spec.ts; src/shared/graduation/graduation-notifications.writer.spec.ts; src/features/graduation/graduation.service.spec.ts; src/features/graduation/graduation-batches.service.spec.ts; src/features/graduation/graduation.processor.spec.ts; src/features/graduation/graduation-result-change.scanner.spec.ts; src/features/graduation/graduation-reaudit.runner.spec.ts; src/features/graduation/graduation-export.service.spec.ts.
- **Compatibility paths**: src/shared/students/academic-results.reader.spec.ts; src/shared/students/student-applied-version.reader.spec.ts (không sửa nội dung các specs có trước).
- **E2E paths**: test/graduation.e2e-spec.ts; test/graduation-batches.e2e-spec.ts; test/graduation-corrections.e2e-spec.ts; test/permission-table.e2e-spec.ts; opt-in test/graduation-performance.e2e-spec.ts. Dùng vitest.config.e2e.ts và isolated PostgreSQL/Redis của harness, orchestrator thực thi.
- **Borderline calls**: bulk-resolution domain error fallback từng context/chunk giữ durable diagnostic; ProgramName lấy ProgramVersion không đổi schema; history không re-resolve current applied version; unknown schema từ chối; codecs từ chối duplicate recognized class, attempt/course reused như free retake và inconsistent equivalence provenance. Không thay existing consumers.
- **Not done**: runtime unit/e2e/performance/OpenAPI inspection; frontend FE-01..06; DOC-01 architecture/manual acceptance synchronization; Faculty E2/E3 certification. Không SQL mới, không migration/schema change.

## Kiểm chứng static cuối lượt tiếp tục — 2026-10-30

Tất cả chạy từ source/backend, tuần tự, không servers/Vitest/Prisma/Docker. Tập $files gồm toàn bộ 46 TypeScript files trong src/features/graduation và src/shared/graduation (kể cả ba file BE-01 không đổi), cộng src/app.module.ts; src/shared/students/academic-results.reader.ts; src/shared/students/student-access.ts; src/shared/students/student-applied-version.reader.ts; test/fixtures/graduation.ts; test/graduation.e2e-spec.ts; test/graduation-batches.e2e-spec.ts; test/graduation-corrections.e2e-spec.ts; test/graduation-performance.e2e-spec.ts; test/permission-table.ts; test/permission-table.e2e-spec.ts. Tổng 57 files; schema.prisma không nằm trong tập format/lint.

| Command | Exit | Verbatim output |
| --- | --- | --- |
| pnpm exec tsc --noEmit -p tsconfig.json | 0 | Không có stdout/stderr |
| pnpm exec oxlint @files | 0 | Không có stdout/stderr; 0 errors |
| pnpm exec prettier --write @files | 0 | Danh sách files, 30 dòng cuối dưới đây |
| pnpm exec prettier --check @files | 0 | Checking formatting... / All matched files use Prettier code style! |

```text
src/features/graduation/graduation.controller.ts 5ms (unchanged)
src/features/graduation/graduation.dto.ts 19ms (unchanged)
src/features/graduation/graduation.module.ts 3ms (unchanged)
src/features/graduation/graduation.processor.spec.ts 24ms (unchanged)
src/features/graduation/graduation.processor.ts 6ms (unchanged)
src/features/graduation/graduation.scheduler.ts 4ms (unchanged)
src/features/graduation/graduation.service.spec.ts 16ms
src/features/graduation/graduation.service.ts 7ms (unchanged)
src/shared/graduation/graduation-access.spec.ts 11ms (unchanged)
src/shared/graduation/graduation-access.ts 4ms (unchanged)
src/shared/graduation/graduation-allocation.spec.ts 11ms (unchanged)
src/shared/graduation/graduation-allocation.ts 11ms (unchanged)
src/shared/graduation/graduation-audit.writer.ts 9ms (unchanged)
src/shared/graduation/graduation-capability.spec.ts 19ms (unchanged)
src/shared/graduation/graduation-capability.ts 2ms (unchanged)
src/shared/graduation/graduation-contract.spec.ts 11ms (unchanged)
src/shared/graduation/graduation-engine.spec.ts 26ms (unchanged)
src/shared/graduation/graduation-engine.ts 19ms (unchanged)
src/shared/graduation/graduation-evaluator.ts 2ms (unchanged)
src/shared/graduation/graduation-input.codec.ts 15ms (unchanged)
src/shared/graduation/graduation-input.reader.spec.ts 14ms (unchanged)
src/shared/graduation/graduation-input.reader.ts 8ms (unchanged)
src/shared/graduation/graduation-input.types.ts 2ms (unchanged)
src/shared/graduation/graduation-notifications.writer.spec.ts 6ms (unchanged)
src/shared/graduation/graduation-notifications.writer.ts 3ms (unchanged)
src/shared/graduation/graduation-result.codec.ts 16ms
src/shared/graduation/graduation-shared.module.ts 2ms (unchanged)
src/shared/graduation/graduation.constants.ts 2ms (unchanged)
src/shared/graduation/graduation.errors.ts 2ms (unchanged)
src/shared/graduation/graduation.types.ts 5ms (unchanged)
```

```text
Checking formatting...
All matched files use Prettier code style!
```

Runtime acceptance chưa thực thi; không có kết luận tests green hoặc performance đạt. Handoff dừng đúng sau BE-12, không đổi frontend/schema/migration/dependencies/progress docs.

## Debug e2e — 2026-10-30

### Bằng chứng do orchestrator cung cấp

- graduation.e2e-spec.ts: 16 failed / 3 passed; graduation-batches.e2e-spec.ts: 4 failed / 4 passed; graduation-corrections.e2e-spec.ts: 10 failed / 10. Đã grep cả ba logs trong scratchpad/build-f19, không đọc real-data trees hoặc dotenv.
- Permission-table 185/185 và units 332/332 đã đạt trước patch theo orchestrator; lượt này không sửa permission inventory, guards, source F-16/F-17/F-18, schema/migration hoặc connection configuration. Không tuyên bố các baseline vẫn green sau patch khi chưa chạy lại.

### Failure class 1 — Private cache headers (product bug)

- **Cause**: GraduationController không khai báo Cache-Control trên JSON GET; GraduationBatchesController export setHeader chỉ no-store. Fixture tại test/fixtures/graduation.ts:229 và export assertion yêu cầu no-store, private đúng quyết định mới; không phải assertion sai.
- **Fix / Decision during build**: thêm @Header('Cache-Control', 'no-store, private') cho toàn bộ GET của hai controllers và POST trả audit/task/batch; export dùng cùng decorator, bỏ manual no-store override. Giữ sendFile và quyền truy cập nguyên trạng. Plan API contract bổ sung quy tắc bằng tiếng Việt, export contract sửa no-store, private.
- **Deviation**: áp dụng cùng header cho POST chứa dữ liệu để nhất quán quyết định bảo mật; không nới assertion.
- **Incident**: none mới; runtime header verification chờ orchestrator.
- **Lesson**: private DTO không đủ nếu response vẫn có thể nằm trong cache chia sẻ.
- **Confidence**: cao về cause và patch; chưa có lượt e2e xác nhận mới.

### Failure class 2 — Save trả 409 (test-fixture bug)

- **Cause**: setGraduationResult chỉ gán score4 cho PASSED/FAILED nhưng để score10/letterGrade null. BE-05 yêu cầu đủ scales/letterGrade, graduation-input.codec.ts từ chối với GRADUATION_INPUT_INVALID. Corrections chết ở baseline save dù chưa có concurrency; cùng helper cũng làm concurrent replay case thất bại trước khi kiểm idempotency. Đây không phải bằng chứng operation-key/head lock sai.
- **Fix / Decision during build**: supplied synthetic PASSED có score10=8, letterGrade=B; FAILED có score10=2, letterGrade=F; score4 tiếp tục nhận override để giữ test nguồn status độc lập grade cao/thấp. IN_PROGRESS/EXEMPT vẫn có null grades. Cập nhật exact before/after expectations của corrections và các scored rows của opt-in performance fixture tương ứng.
- **Deviation**: không nới codec, không suy status từ điểm, không đổi producer hoặc idempotency contract. Concurrency assertion vẫn phải trả cùng audit ID.
- **Incident**: log Supertest chỉ có status che mất diagnostic body; cause được truy từ payload helper → strict codec → 409 đúng plan. Không thêm retry domain errors để làm test qua.
- **Lesson**: shared low-level writer không thay validator của source import; synthetic fixture phải tuân cả producer contract đã được duyệt.
- **Confidence**: cao; actual score contract đối chiếu F-17 academic-result-validator.ts và plan BE-05.

### Failure class 3 — TRANSFER trả 400 (test bug)

- **Cause**: graduation.e2e-spec.ts không gửi sourceEnrollmentId/expectedEnrollmentUpdatedAt; StudentEnrollmentCommandDto và enrollment.writer assertCommandShape yêu cầu cả hai riêng cho TRANSFER. expectedStudentUpdatedAt không thay enrollment token.
- **Fix / Decision during build**: đọc source enrollment thật rồi gửi ID cùng updatedAt ISO token; giữ expectedStudentUpdatedAt và body còn lại.
- **Deviation**: none; không sửa endpoint/DTO/service F-17.
- **Incident**: none mới.
- **Lesson**: dùng đúng hai optimistic tokens của operation, không giả current enrollment thay explicit source ID.
- **Confidence**: cao; source assertCommandShape xác định trực tiếp nhánh 400.

### Failure class 4 — Batch statuses/filter/export (fixture/test bugs và class 1)

- **Cause**: completed student dùng cùng malformed scores của class 2 nên thành item ERROR; batch đúng trả COMPLETED_WITH_ERRORS với eligibleCount=0, filtered ELIGIBLE page rỗng. Không sửa SQL filter hoặc đổi expected status để che error. Test enrollment drift còn set untilSemesterId trong khi status vẫn ACTIVE, vi phạm ProgramEnrollment_closed_interval CHECK có trước. Export header là class 1.
- **Fix / Decision during build**: sửa chung grade fixture; drift fixture đóng enrollment bằng status=ENDED cùng untilSemesterId trong một update, vẫn kết thúc đúng requested-semester boundary để worker phát hiện context không còn hợp lệ. Header dùng private no-store. Giữ nguyên các expected COMPLETED/count/filter/error assertions.
- **Deviation**: none; CHECK và schema giữ nguyên.
- **Incident**: none mới.
- **Lesson**: trước khi kết luận query/filter sai, kiểm persisted item error và đảm bảo fault fixture vẫn là trạng thái DB hợp lệ.
- **Confidence**: cao về cause của các assertion được log; runtime rerun còn thiếu.

### Failure class 5 — Scanner/repeat-job failure (product retry/observability gaps)

- **Cause xác định trong source**: scanner và processor chỉ log change/job ID rồi bỏ exception. graduationTransaction chỉ nhận P2034, trong khi raw FOR UPDATE có thể trả P2010 với SQLSTATE 40001/40P01, nên serialization/deadlock raw-query không được retry như plan yêu cầu. Log cũ không giữ Prisma code/message; không thể chứng minh từng event trong log đã vướng SQLSTATE nào. Các change IDs thất bại khác nhau không đủ kết luận malformed feed hoặc migration lỗi.
- **Fix / Decision during build**: helper nhận ORM P2034 và raw P2010/40001/40P01, gồm cả Prisma 7 driverAdapterError.cause.originalCode, vẫn bounded TRANSACTION_RETRIES. Không retry P2002, CHECK/FK, auth/domain hoặc arbitrary SQL errors. Scanner và processor dùng chung formatter log error name, Prisma code/SQLSTATE và static safe message; domain message lấy từ catalog, raw Prisma invocation/driver body/SQL parameters/unknown exception body không được log.
- **Regression specs**: graduation-execution-error.spec.ts thêm 16 cases cho direct/adapter metadata, recognized transaction failures, retry bound, permanent/domain/unique no-retry và private-body redaction. Không thay receipt, target, lease hoặc producer contracts.
- **Deviation**: với unknown exceptions, message ghi rõ private details omitted thay raw message để không lộ dữ liệu sinh viên. Chi tiết nguyên nhân cũ vẫn cần lượt orchestrator mới; không khẳng định patch đã chứng minh source failure thực tế.
- **Incident**: Vitest chưa thể kiểm các specs mới do sandbox startup spawn EPERM; không nâng quyền hoặc thay Vite/dependencies để né giới hạn.
- **Lesson**: error code normalization của ORM không bao phủ mọi raw-query path; logs phải phân biệt domain, SQLSTATE và execution infrastructure mà không lộ payload.
- **Confidence**: cao về retry/observability defects và intended fix; trung bình về liên hệ với background failures đã log, vì exception gốc đã mất.

### Kiểm chứng lượt debug

- `pnpm exec tsc --noEmit -p tsconfig.json`: exit 0, compiler không có output.
- `pnpm exec vitest run src/shared/graduation src/features/graduation src/shared/students --maxWorkers=1`: exit 1, Vite không load được config; `[plugin externalize-deps] Error: spawn EPERM`. Không chạy test assertion nào; không phải code verdict. Thêm maxWorkers=1 chỉ để hạn chế RAM, không đổi tập test.
- Đã format 12 source/spec files trong scope bằng backend Prettier. Không thực thi e2e, Prisma, Docker hoặc thay cấu hình Postgres.

### Bàn giao / Escalation bằng chứng còn thiếu

- Đã hoàn tất patches xác định cho classes 1–4 và raw-transaction retry/privacy logging cho class 5; tsc đạt. Exception gốc trong ba log không thể phục dựng chắc chắn.
- Lựa chọn: orchestrator chạy lại targeted unit/e2e với log mới để xác nhận; hoặc đoán tiếp và nới retry/transaction/contract không có evidence. Khuyến nghị chọn chạy lại, giữ nguyên schema/producer/permission behavior. Nếu scanner vẫn lỗi, gửi các dòng name/code/sqlState/message mới; không cần raw student/input bodies.
- Chưa làm: runtime pass verdict của 332 baseline + 16 new unit cases, ba graduation e2e suites và permission-table compatibility rerun; xác nhận SQLSTATE thực tế của các background failures cũ. Không có đề nghị migration hoặc thay API feature khác.

## Debug e2e lượt hai — 2026-10-30

| Mục | Phân loại | Kết quả lượt này |
| --- | --- | --- |
| Login R2/R4/R5 trả 401 | Test bug | Username fixture đã lowercase trước createAccount; không sửa auth/helper chung |
| Chương trình cũ tại học kỳ chuyển trả 404 | Test bug | Giữ historical read/save trước boundary; assert 404 tại exclusive boundary và đọc riêng chương trình mới |
| Scanner/re-audit conflict và plain Error | Product policy/observability gap; một fault Error cố tình inject bởi test | Bounded retry, WARN/defer không tiêu budget; phase/code an toàn; bổ sung regression specs |

### Mục 1 — Login của role-denial test

- **Cause**: `test/graduation.e2e-spec.ts:476` từng truyền username `gradR2`/`gradR4`/`gradR5`. `test/fixtures/accounts.ts:26` tạo username nguyên trạng và password `${username}Pass1`; LoginDto normalize username qua `src/shared/auth/username.ts:2` thành lowercase trước AuthService lookup tại `src/features/auth/auth.service.ts:29`. Vì không có hàng username lowercase tương ứng, 401 đúng. Không có bằng chứng lỗi password, account status, throttle hoặc session; 401 xuất hiện trước các graduation authorization assertions.
- **Decision during build / Fix**: lowercase phần role khi tạo username, tiếp tục truyền nguyên TestAccount trả về cho loginAgent để password khớp hash. Giữ mọi kiểm tra R6/R3/R2/R4/R5 và write-count denial; không bỏ login hoặc đổi expected 403. Auth module và helper dùng chung giữ nguyên.
- **Deviation**: none; chỉ sửa input test trái canonical username contract.
- **Incident**: runtime mới chưa chạy được trong sandbox; không nhận 348 baseline là verdict cho patch mới.
- **Lesson**: helper ghi trực tiếp DB không thay thế normalization của public create/login contract.

### Mục 2 — Historical interval và exclusive transfer boundary

- **Cause**: historical live/save trước chuyển đã thành công; assertion lỗi thực tế truy vấn chương trình cũ đúng học kỳ `untilSemesterId`, ngoài interval `[from, until)`. `src/shared/students/enrollment-period.ts:23` loại exclusive boundary; `academic-results.reader.ts:83` trả STUDENT_NOT_FOUND khi explicit program/semester không có enrollment cover. Live service chỉ chuyển graduation diagnostics 409 thành CANNOT_AUDIT, không đổi scope-filtered 404. Đây không phải mất historical TRANSFERRED data.
- **Decision during build / Fix**: giữ assertions historical GET/save và enrollment/version cũ; thay assertion ở boundary thành GET 404, rồi GET explicit chương trình mới tại cùng học kỳ, assert program/version mới và enrollment khác. Không fallback implicit, không đổi shared readers hoặc scope policy. Plan API ghi rõ TRANSFERRED/ENDED còn đọc được trong interval, không bao gồm học kỳ kết thúc.
- **Deviation**: làm rõ API contract trong plan, không đổi product lookup hay F-16/F-17 API.
- **Incident**: none mới; e2e mới chờ orchestrator.
- **Lesson**: trạng thái hiện tại của interval và việc học kỳ nằm trong interval là hai điều kiện khác nhau; historical readability không làm inclusive boundary.

### Mục 3 — Expected transaction conflicts và an toàn diagnostic

- **Cause**: log mới xác nhận P2034/40001 trong scanner và P2010/40001 trong runner. Retry transaction cũ đã bounded nhưng sau khi hết giới hạn scanner vẫn log ERROR/throw failed job; runner còn tính conflict vào attempts và có thể FAILED dù không có thay đổi học vụ commit. Claim/list/recovery ngoài transaction cũng chưa có cùng chính sách retry/defer.
- **Decision during build / Fix**: dùng chung retry helper, tối đa ba retry sau lần đầu. Nhận P2034, SQLSTATE 40001/40P01 trong Prisma metadata và error/driver cause có cấu trúc; không suy đoán conflict từ raw message. Scanner rollback receipt/targets rồi WARN và tiếp tục các feed rows; query feed hết retry trả zero để lần schedule kế tiếp thử lại. Real domain/validation/queue failures vẫn ERROR và fail như trước.
- **Decision during build / Fix**: runner claim lease chưa tiêu attempts; tăng attempts trong fenced COMPLETED/COVERED transaction hoặc khi persist lỗi thật sau rollback. Hết conflict retry thì release đúng token về PENDING và WARN; nếu release cũng hết conflict retry, giữ RUNNING với budget chưa tiêu để recovery sau lease expiry. Token fence không cho release lease của successor. Nhờ chưa tiêu budget, kể cả khi đang còn đúng một attempt vẫn không bị recovery biến thành FAILED vì conflict. Claim, failure-state persistence và recovery có retry bound; conflict cuối được absorb, lỗi thật vẫn ERROR/propagate theo semantics cũ.
- **Cause plain Error**: scanner consume gọi transaction callback; `test/graduation-corrections.e2e-spec.ts:493` cố tình ném `new Error('Synthetic crash before receipt transaction commit')` ngay sau work(tx) để chứng minh receipt/targets rollback. Test này gọi scanner và expect reject, tạo đúng một ERROR tổng hợp hợp lệ; một fault notifier khác tại dòng 273 cũng cố tình ném Error. Log cũ chỉ có tên Error không giữ message/phase nên không thể chứng minh tuyệt đối dòng nào sinh ra nó, nhưng path inject đã xác định, không phải bằng chứng về một SQLSTATE thứ ba. Không nuốt arbitrary Error như conflict và không bỏ rollback fault test.
- **Decision during build / Fix**: plain Error luôn có static safe code `UNCLASSIFIED_EXECUTION`; scanner log thêm SELECT/CONSUME/ENQUEUE để phân biệt rollback/fan-out với postcommit queue delivery. Driver error có SQLSTATE log safe name/code/state và static message; unknown message/driver body/SQL/input/student data vẫn bị redacted. Generic fault từ rollback test sẽ là ERROR với phase=CONSUME, không bị gán nhầm là database conflict; runner cũng dùng cùng safe formatter cho lỗi thật.
- **Regression specs**: mở rộng `graduation-execution-error.spec.ts`, `graduation-result-change.scanner.spec.ts`, `graduation-reaudit.runner.spec.ts` cho direct/adapter SQLSTATE, retry bound/transient success, receipt/audit/notice rollback, WARN thay ERROR cho exhausted conflicts, last-attempt preservation, release-conflict lease recovery, successor fencing và generic Error phase/code. Không execute các specs trong sandbox.
- **Deviation / Borderline call**: chuyển attempt accounting từ claim sang outcome để conflict hoặc failed cleanup không tiêu budget; process crash trước outcome cũng để lại lease chưa tiêu budget. Lỗi thực được ghi nhận vẫn bị JOB_ATTEMPTS giới hạn. Đây là lựa chọn bảo toàn durable retryability theo yêu cầu, đã ghi rõ trong plan; không sửa schema/migration hay bỏ budget cho lỗi thực.
- **Incident**: runtime verification không khả dụng trong sandbox; không thử lại Vitest sau spawn EPERM đã biết.
- **Lesson**: bounded transaction retry không tự đồng nghĩa với bounded job failure; expected contention phải được defer bằng durable source of truth, không đốt operational failure budget.

### Kiểm chứng và bàn giao lượt hai

- Từ `source/backend`, `pnpm exec tsc --noEmit -p tsconfig.json`: exit 0, stdout/stderr rỗng. Đã format tám TypeScript source/spec files sửa bằng backend Prettier.
- Chưa chạy unit/e2e; orchestrator cần chạy lại `src/shared/graduation`, `src/features/graduation`, `src/shared/students` và bốn e2e graduation/graduation-batches/graduation-corrections/permission-table để xác nhận không regression. Các baseline 348/348, 8/8, 10/10, 185/185 là kết quả orchestrator trước patch này.
- Escalations: none. Không thay schema/migration, auth hoặc feature khác, shared/students, dependencies, frontend hoặc progress docs.

## FE-01 — Đối chiếu generated wire contract

- **Decision during build**: giữ schema.d.ts do orchestrator generate từ backend live; không chạy api:types hoặc sửa generated output. Đối chiếu live/save/history/detail, batch preview/create/list/items/export, tasks/retry và selectors với BE-06/07/09/11: credit là string, năm shortfall codes/bốn categories, nullable minima, audit/freshness, status và notification enum khớp.
- **Decision during build**: live alias lấy từ operations.GraduationController_live.responses.200 vì endpoint oneOf có discriminator; GraduationOutcomeDto component là base nullable rộng. Query DTOs được Swagger inline nên dùng generated operation parameters, không giả định có component query DTO. Backend hợp lệ; đã sửa ví dụ alias trong plan, không đổi contract.
- **Deviation**: generation là phần orchestrator đã làm trước lượt này; chỉ thực hiện đối chiếu còn lại. Backend yêu cầu semester + program hoặc cohort và R3 luôn phải chỉ program; form dùng đúng contract đó.
- **Incident**: none. **Lesson**: endpoint response type có thể chính xác hơn base DTO được generator xuất cùng lúc.

## FE-02 — Adapters, query boundaries và nhãn

- **Decision during build**: schema/graduation.ts alias trực tiếp generated schemas/operations; api/graduation.ts dùng getJson/sendJson/downloadFile hiện hữu, encode opaque IDs, giữ CSRF header/session flow và server filename. Không đổi HTTP client, không thêm dependency hay transport envelope.
- **Decision during build**: keys gồm đầy đủ student/program/semester, filters/page/pageSize; query dữ liệu riêng gcTime=0, không persist localStorage. Poll chỉ active batches/tasks, dừng terminal, 401/403/404 và unmount. Save/create giữ requestKey khi network retry; mutation/invalidation theo context, không evict sinh viên khác. Nhãn trạng thái, conclusion, shortfalls và warnings exhaustive theo generated types; không tính tín chỉ/kết luận ở FE.
- **Deviation**: theo danh sách scope, generated aliases và pure presentation ở feature thay vì tạo shared/graduation. Chưa công bố reusable boundary cho F-20; việc chuyển sang shared cần lượt có scope tương ứng. Request q nằm trong key để tách cache bộ lọc, không nhét response PII/transcript vào key.
- **Incident**: none. **Lesson**: phân biệt metadata phục vụ cache và snapshot học vụ, giữ cơ chế quyền/HTTP dùng chung không đổi.

## FE-03 — MH-53, immutable history và freshness

- **Decision during build**: form AntD dùng rules, explicit semester/program/student và Xem kết quả; deep link chỉ prefill, không auto-save. Context đổi thì bỏ view/key cũ; query key độc lập bỏ qua response muộn. Không phải nhập UUID hoặc chọn latest program version ở client.
- **Decision during build**: result-only view có bốn nhóm thiếu, credit string không làm tròn, hai minima nhóm, knowledge-block minima advisory, mã yêu cầu/đã học, equivalence/credit basis và free credits. CANNOT_AUDIT là Chưa thể kết luận, unsupported stored version có cảnh báo riêng. POST save hiển thị result trả về thay live preview; history link immutable auditId, null reviewer là Hệ thống.
- **Decision during build**: R1 có task panel/retry, R3 chỉ coarse freshness; không lộ feed bodies. Access revocation 401/403/404 ẩn cả result lưu và history thay vì giữ snapshot cá nhân cạnh scope error. Live/audit/history có loading, empty và lỗi riêng.
- **Deviation**: thêm GraduationAuditSummary/GraduationError để dùng chung trong feature; result-only components chưa chuyển public shared boundary theo scope. **Incident**: none. **Lesson**: dữ liệu lưu là snapshot riêng, không được biến live preview cũ thành bằng chứng save thành công.

## FE-04 — MH-54 preview, confirm, progress và export

- **Decision during build**: dùng SemesterSelect và single AntD program/cohort Select; không thay CohortSelect nhiều giá trị hiện hữu. Preview hiển thị studentCount khác enrollmentCount cho song ngành; không tạo batch khi mount/preview, roster rỗng không confirm. R3 không được preview cohort-only.
- **Decision during build**: modal qua App.useApp, giữ revision/key khi retry, đổi filter hoặc 409 bỏ preview; revision guard ngăn modal cũ gửi filter mới. List/detail dùng durable batch IDs, progress denominator enrollmentCount, live region polite, lỗi item tách NOT_ELIGIBLE, reviewed rows link auditId gốc. Detail hiện filters/timestamps/counters; option đã không còn trong phạm vi có thông báo, không âm thầm đổi filter.
- **Decision during build**: q debounce, server pagination/conclusion/outcome; filter đổi reset page. Chọn conclusion tự đặt REVIEWED; chọn ERROR/PENDING xóa conclusion để không gửi tổ hợp backend cấm. Export chỉ COMPLETED/COMPLETED_WITH_ERRORS, dùng đúng committed filters không pagination, disabled khi q còn debounce; download lỗi không thay kết quả lưu.
- **Deviation**: preview/confirm orchestration ở GraduationBatchesPage, progress/results ở GraduationBatchPage; chỉ tách GraduationBatchFilters cho form, không tạo các wrapper một-use dự kiến trong plan. Card tạo đợt luôn có sẵn nên dùng hai action preview/confirm thay nút Tạo đợt xét thứ ba. **Incident**: none. **Lesson**: frozen roster không đồng nghĩa atomic input snapshot toàn khóa.

## FE-05 — Staff routes, menu và entry MH-52

- **Decision during build**: bốn named-export lazy routes dưới RequireAuth/AppLayout, local RequireGraduationStaff kiểm R1/R3 cùng permission; R6 hoặc R2/R4/R5 không vào staff URL dù có coarse permission. Mixed staff/R6 vẫn dùng staff capabilities; backend vẫn là nơi thực thi ownership/program scope.
- **Decision during build**: menu Xét tốt nghiệp có hai leaves theo view/audit; batch leaf đứng trước generic graduation leaf để selectedMenuPath prefix matcher hiện hữu chọn đúng mà không sửa matcher. MH-52 link chỉ điều hướng IDs đang chọn, cần applied version đã resolve; context thiếu/ambiguous có disabled tooltip, không evaluate/save trên click và không đổi F-17 flows.
- **Deviation**: dùng generated PermissionCode literals như student records, không sửa shared/auth/permissions.ts ngoài scope. Không xây R6 portal hoặc import page/hook graduation vào feature students.
- **Incident**: none. **Lesson**: menu visibility không thay server authorization; role check vẫn cần thiết với direct URL.

## FE-06 — Adapter/page/hook/navigation regression specs

- **Decision during build**: viết tám Vitest specs trong feature, thêm coverage menu và notification bell. Harness tạo QueryClient/router/App mới, synthetic generated DTOs và captured writes; không dùng private data, casts che wire mismatch hoặc test runtime packages mới. Các specs bao phủ generated literals/null branches, encoded URLs, request-key retry, returned save result, stale context/access revoke, four shortfalls/equivalence, freshness, R1 retry, preview/409/empty roster/R3 scope, server filter-export parity và actual lazy routes/MH-52 entry.
- **Decision during build**: content-only GRADUATION_CONCLUSION_CHANGED notice được đánh dấu đọc, không dựng ChangeRequest URL giả. Pure result spec không cần staff providers. Fake timers được trả về real timers; polling spec kiểm terminal/unmount không fetch thêm.
- **Deviation**: không có Playwright spec được FE-06 chỉ định; giữ manual browser suite, không chạm fixtures/select.ts. Orchestrator cần chạy `pnpm exec vitest run src/features/graduation src/shared/layout/menuItems.test.tsx src/shared/notifications/NotificationBell.test.tsx` từ frontend; nên chạy lại StudentDetailPage.test.tsx hiện hữu cho nonregression entry.
- **Incident**: khi tiếp quản sau context handoff, test typing còn dùng ByRoleOptions.exact không tồn tại và mock.instances kiểu unknown; đã dùng string name matching/captured anchor filename đúng kiểu, không sửa library types. `pnpm exec tsc -b --pretty false` cuối lượt exit 0, stdout/stderr rỗng; không thử Vitest/Playwright do sandbox spawn EPERM đã biết. **Lesson**: static type pass không phải runtime verdict; toàn bộ frontend specs chờ orchestrator.

## DOC-01 — Report và manual acceptance

- **Decision during build**: đồng bộ Status/summary và một section mỗi FE step; sửa plan alias/path/decomposition theo generated/source hiện hữu. Thêm docs/testing/feature__f-19-graduation-review.md với mười frontend test paths, backend baseline có attribution và mười sáu manual cases; tất cả manual cases chưa chạy.
- **Decision during build**: manual coverage gồm live/save/history, historical intervals/dual majors, 0-credit, 3→2 equivalent, catalog advisory, preview drift/progress/errors/export, F-17 correction/notices/retry, role denial và keyboard/reduced-motion/resize. E1 giữ nguyên, E2/E3 còn nợ Faculty input; không tuyên bố công nhận tốt nghiệp hoặc thay Student.status.
- **Deviation**: không sửa architecture docs hoặc testing index vì ngoài scope hiện tại; plan ghi rõ orchestrator đồng bộ sau. Shared extraction cho F-20 và opt-in backend performance measurement cũng chưa có verdict trong lượt này.
- **Incident**: frontend runtime/manual checks không khả dụng trong sandbox; không tạo screenshot/verdict giả. **Lesson**: phân tách đã giao mã, static checks đạt, baseline backend được cung cấp và acceptance còn chờ.

## Sửa lỗi frontend Vitest — lượt một, 2026-10-30

- **Baseline do orchestrator cung cấp**: 11 files, 82 tests; 74 pass, 8 fail. Đã đọc fe-vitest.log bằng lọc dòng và bỏ ANSI; không chạy lại Vitest trong sandbox.
- **Lỗi 1 — R1 retry, test bug**: test tìm button toàn trang ngay từ đầu, trong khi audit → auth/me → tasks tải nối tiếp; query role trên DOM audit lớn dùng timeout Testing Library mặc định, không phải CLI testTimeout=30000. Fixture context/role/permission, task URL và nhánh FAILED của component khớp plan; không có bằng chứng cần đổi product. Sửa test đợi title task panel, tìm đúng failed row bằng within(panel), kiểm trạng thái/method URL và button enabled trước khi click trong row. Giữ nguyên assertion POST retry và không lộ score10; không tăng timeout hoặc mock bỏ chuỗi tải thật. Runtime xác nhận vẫn chờ orchestrator.
- **Lỗi 2 — bốn test batch program option, test bug**: helper mouseDown không đồng bộ trạng thái enabled/expanded của Select phụ thuộc semester và không đóng popup trước đó. Tái dùng đúng pattern trong students/components/EnrollmentCommandModal.test.tsx: findByLabelText, đợi enabled, ArrowDown, đợi aria-expanded=true, chọn đúng option-content, Escape. Không bỏ assertion nhãn option, preview/create counts, request key, empty roster hoặc 409 drift; không đổi component.
- **Lỗi 3 — ba test export QUEUED/RUNNING/FAILED, test bug**: fixture có studentCount=1 và processedCount=1 với enrollmentCount=2, vì vậy hai mô tả hợp lệ cùng hiện 1 / 2. Sửa query lấy đúng description item container qua label Đã xử lý rồi within(container).getByText('1 / 2'); giữ assertion export disabled và exact processed count, không dùng getAllByText/first-match để né ambiguity.
- **Decision during build**: chỉ sửa ba spec files trong graduation; không đổi hành vi product, plan, shared helpers, auth hoặc feature khác. **Deviation / Escalations**: none. **Lesson**: đợi đúng tầng dữ liệu phụ thuộc và scope assertion theo vùng UI có ý nghĩa; tăng test timeout toàn cục không chữa query race/ambiguity.
- **Verification**: từ source/frontend, `pnpm exec tsc -b --pretty false` exit 0; stdout/stderr rỗng. Đã format ba spec files bằng Prettier frontend. Vitest không chạy theo fence spawn EPERM; orchestrator chạy lại cùng command 11 files để xác nhận, không coi tsc là runtime verdict.

## Sửa lỗi frontend Vitest — lượt hai, 2026-10-30

- **Baseline do orchestrator cung cấp**: cùng 11 files với maxWorkers=1/testTimeout=30000, 82 tests: 80 pass, 2 fail; ba lớp lỗi lượt trước đã qua. Đã lọc fe-vitest2.log và bỏ ANSI; không chạy Vitest trong sandbox. Lỗi GRADUATION_STATE_CHANGED của drift test là phản hồi được chủ động mô phỏng, không sửa product vì log này.
- **Lỗi 1 — cold lazy route, test timing bug**: failure DOM có AppLayout/sidebar của R1 và main là Spin aria-busy=true, đúng Suspense fallback; không phải guard đang chờ me hay 403. RequireAuth đã cho qua, fixture me có R1 cùng graduation.view/audit. GraduationReviewPage truyền chính xác title Xét tốt nghiệp vào PageHeader/Typography.Title level=2, không đổi accessible name hoặc ẩn heading bằng logic khác. Lần đầu lazy import vượt findBy timeout mặc định khi máy tải nặng, dù tổng testTimeout=30000. Thêm LAZY_ROUTE_TIMEOUT_MS=15000 cho findBy heading/guard trong nhóm actual lazy routes; vẫn import route thật và giữ nguyên exact role/name assertions, không preload/mock hoặc sửa product.
- **Lỗi 2 — title lặp trong một AntD confirm, test query bug**: log nêu hai node khác loại: div.ant-modal-title và span.ant-modal-confirm-title, không phải bằng chứng hai modal. Source AntD đang cài (es/modal/ConfirmDialog.js) truyền title vào Modal và render lại title trong ConfirmContent; es/modal/style/confirm.js ẩn modal-header bằng display:none. findByText vẫn khớp cả DOM title ẩn và title hiển thị. Page chỉ gọi modal.confirm ở một onClick, không mở từ effect; đã có destroy trên unmount. Hai test đứng trước trong file không mở confirm, nên không có cơ sở gán leak từ chúng. Đây không phải duplicate handler hoặc missing cleanup; không sửa lifecycle của product.
- **Fix / Decision during build**: tìm đúng dialog theo accessible name Bắt đầu xét tốt nghiệp?, assert đúng một dialog kể cả hidden để bắt duplicate/leak thật, kiểm nội dung frozen roster và click button qua within(dialog). Giữ revision/key body assertion và thêm đúng hai writes tổng cộng (một preview, một create). Không dùng findAllByText hoặc bỏ kiểm tra title/roster để né ambiguity. **Deviation / Escalations**: none; nguyên nhân thứ hai nằm ngoài hai giả thuyết duplicate-open/leak nhưng có evidence trực tiếp từ DOM và source thư viện. **Lesson**: text query bao gồm node CSS-hidden; accessible dialog contract mới là assertion đúng cho modal confirm.
- **Verification**: từ source/frontend, `pnpm exec tsc -b --pretty false` exit 0; stdout/stderr rỗng. Đã format hai specs bằng Prettier frontend. Không chạy Vitest theo fence; orchestrator cần rerun cùng command maxWorkers=1 để xác nhận, không coi static pass là runtime verdict.

## Sửa lỗi frontend — rejected confirmation callback, 2026-10-30

- **Baseline do orchestrator cung cấp**: 11 files, 82/82 tests pass nhưng Vitest exit 1 vì một unhandled rejection GRADUATION_STATE_CHANGED/409 trong drift test. HTTP 409 là dữ liệu lỗi được mô phỏng hợp lệ; việc callback để promise rejection thoát ra ngoài mới là product bug, không phải lỗi shared/api/client.ts hoặc lý do để tắt unhandled-error checking.
- **Cause / evidence**: đã đối chiếu AntD đang cài. es/modal/components/ConfirmOkBtn.js chuyển onOk thành ActionButton.actionFn; es/_util/ActionButton.js:59 trả Promise.reject(e) khi action promise reject và isSilent không bật. es/modal/useModal/index.js:39 mặc định silent=false, chỉ bật khi consume then của modal handle. GraduationBatchesPage chỉ giữ handle để destroy, nên throw error trong catch và throw của revision guard làm reject callback mà đường button không await/catch. Không đổi AntD hay HTTP client để che lỗi.
- **Fix — product bug**: onOk không rethrow request failures; luôn đóng confirmation qua finally. 409 bỏ preview và requestKey, nhưng giữ create mutation error để người dùng thấy mã GRADUATION_STATE_CHANGED và lý do cần xem trước lại. Lỗi network/server khác vẫn hiện qua GraduationError, giữ preview/requestKey để lần xác nhận lại cùng thao tác tái dùng idempotency key. Revision mismatch đóng dialog, hiện warning Bộ lọc đã thay đổi. Xem trước lại danh sách. và return bình thường, không gửi create. Warning được xóa khi đổi bộ lọc, xem trước hoặc bắt đầu confirmation mới.
- **Regression tests**: drift test giữ real App/modal/HTTP adapters, kiểm dialog đóng, preview mất, confirmation disabled, lý do 409 còn hiển thị và callback promise resolves. Một probe cục bộ bọc onOk theo kiểu pass-through để kiểm trực tiếp promise trả về; callback reject sẽ làm assertion resolves fail thay vì chỉ còn lỗi ngoài test. Không đăng ký handler nuốt unhandled rejections, không bật isSilent hoặc mock ActionButton. Thêm case callback cũ sau filter change và hai case network/503: close + visible error + resolved promise; confirm lại không preview mới, body/key giữ nguyên, rồi điều hướng khi thành công.
- **Decision during build / Deviation**: thêm state UI warning cho stale revision vì không có mutation error ở nhánh không gửi request; các lỗi request tiếp tục dùng presentation sẵn có. Plan không yêu cầu giữ modal mở khi lỗi; thay đổi phù hợp explicit retry/request-key contract. Không sửa ngoài graduation và report; Escalations: none. **Lesson**: test assertions xanh không đủ nếu runner còn unhandled errors; lỗi đã hiện trên UI vẫn cần được consume ở callback boundary.
- **Verification**: từ source/frontend, `pnpm exec tsc -b --pretty false` exit 0; stdout/stderr rỗng. Đã format hai files thay đổi bằng Prettier frontend. Không chạy Vitest theo fence; orchestrator cần chạy lại 11 files với maxWorkers=1/testTimeout=30000 và xác nhận cả tests pass lẫn unhandled errors=0/exit 0.
