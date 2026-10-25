# Báo cáo triển khai DUT legacy curriculum seed

> **Status: DONE — build E-01…L-04 và V-01 seed/database verification + documentation — 2026-10-23**
> - Branch: `main`.
> - Build E-01…L-04 và V-01 đã hoàn tất; đã tách extract/load/data và thêm runner/scripts cho môi trường dữ liệu thật, caller đã kiểm chứng runner trên database dùng một lần sau refactor; giữ nguyên D1–D14 và totals 224 retained pairs / 2 conflicts, 3.135 requisites, 12 excluded pairs, 1 kept requisite có source ngoài frame.
> - Caller đã chạy V-01 trên PostgreSQL 18 ICU `vi-VN` dùng một lần, không phải database Playwright `ctdt-dev-pg`; base/demo/DUT seed thành công, lần hai DUT created 0 ở mọi loại.
> - Caller xác nhận typecheck exit 0, `vitest run prisma` 52 passed, extractor deterministic và sensitive-pattern grep trên JSON sạch. Prettier/type-aware oxlint ở vòng build trước exit 0.
> - Database riêng của người dùng chưa được chạm tới. Runtime effect trên database đó chỉ có sau khi người dùng chạy `pnpm prisma:seed:dut` sau migration và base seed.
> - Lượt hiện tại chỉ đồng bộ tám tài liệu từ kết quả caller cung cấp; không chạy lại database hoặc Prisma commands. Năm defaulted questions vẫn chờ xác nhận.
> - Các phần cũ bên dưới giữ nguyên như nhật ký; phần “V-01 — Kiểm chứng và đồng bộ tài liệu” ở cuối là kết quả hiện tại.

## Tổng hợp deliverable

Số dòng gần đúng, không tính dòng trống. Các file bên dưới thuộc `source/backend/` nếu không ghi khác.

| ID | Files | Dòng | Kiểm chứng |
|---|---|---:|---|
| E-01 | `prisma/seed-data/dut/legacy-tables.ts`, `legacy-tables.spec.ts` | 83 + 79 | Typecheck exit 0; extractor đọc sáu bảng với 0 malformed lines; caller chạy `vitest run prisma`: 52 passed toàn suite |
| E-02 | `prisma/seed-data/dut/legacy-mapping.ts`, `legacy-mapping.spec.ts` | 138 + 148 | Typecheck exit 0; mapping dùng trong extraction thành công; caller chạy `vitest run prisma`: 52 passed toàn suite |
| E-03 | `prisma/seed-data/dut/program-map.ts` | 130 | Extractor xác nhận 24 programs bao phủ đúng một lần 46 frames; typecheck exit 0; SQL khớp 24 programs / 46 versions |
| E-04 | `prisma/seed-data/dut/extract-catalog.ts` | 125 | Extraction thành công: 173 courses, 9 units, 5 semesters, 5 cohorts; loader giữ ngày semester hiện hữu và lần hai created 0 |
| E-05 | `prisma/seed-data/dut/extract-frames.ts` | 270 | Extraction thành công; SQL trên `CNTT-%` xác nhận 46 versions, 3.295 items, 156 groups, 3.135 requisites, 38 CohortVersion links |
| E-06 | `prisma/seed-data/dut/extract-relations.ts` | 76 | Approved totals: 224 retained pairs, 2 conflicts, 12 excluded pairs; loader tạo 224 relations, 0 cycle skips; lần hai created 0 |
| E-07 | `prisma/seed-data/dut/extract.ts`, `dut-data.ts`, `catalog.json`, `programs.json`, `report.json`, `package.json` | 292 + 50; 3 JSON sinh tự động; thêm 1 script | Caller đã chạy extractor; hashes giống hệt khi chạy lại, sensitive-pattern grep trên JSON sạch; typecheck, Prettier, type-aware oxlint exit 0 |
| L-02 | `prisma/seed-data/dut/read-dut-data.ts`, `seed-catalog.ts` | 19 + 188 | Ba static checks exit 0; loader chạy hai lần trên throwaway PostgreSQL: lần đầu tạo 9 units / 173 courses / 224 relations / 4 semesters / 2 cohorts; lần hai created 0; ngày semester cũ được giữ |
| L-03 | `prisma/seed-data/dut/seed-programs.ts` | 191 | Ba static checks exit 0; SQL: 24 programs, 46 versions (19 ACTIVE / 22 HISTORICAL / 5 DRAFT), không program nào có hơn một ACTIVE; lần hai skip whole 24 programs |
| L-01 | `prisma/seed-dut.ts`, `package.json` | 73; thêm `prisma:seed:dut` | Ba static checks exit 0; caller chạy migration → base seed → demo seed → DUT seed hai lần thành công trên throwaway PostgreSQL |
| L-04 | Summary trong `prisma/seed-dut.ts` | Trong 73 dòng của entry point | Runtime summary xác nhận lần hai created 0 ở mọi loại; skipped 9 units / 173 courses / 224 relations / 5 semesters / 5 cohorts / 24 programs; in conflict ngày semester |
| V-01 | `docs/architecture/database_and_models.md`, `docs/technical/technical_reference.md`, `docs/progress/{handoff,todo,current_work,progress_log}.md`, `docs/implement-report/dut-legacy-seed-implement-report.md`, `docs/implementation/dut-legacy-seed-implementation-plan.md` | 8 tài liệu đồng bộ | Caller kiểm chứng database trên throwaway PostgreSQL 18 ICU `vi-VN`, không phải `ctdt-dev-pg`; seed lần hai created 0; typecheck exit 0, prisma tests 52 passed; database riêng của người dùng chưa chạm tới |
| DUT-SPLIT | `prisma/seed-data/dut/{extract,load,data}/`, root `dut-data.ts`, `legacy-mapping.ts`, `legacy-mapping.spec.ts`, `prisma/seed-dut.ts`, `package.json` | 13 files di chuyển; sửa imports và 2 JSON URLs | Không đổi functions/logic; ba JSON giữ nguyên hashes khi di chuyển; kiểm tra static và layout trong phần follow-up cuối báo cáo |
| REAL-ENV | `scripts/with-env.ts`, `.env.real.example`, `.gitignore`, `package.json`, `README.md` | Runner nhỏ; template 4 dòng; thêm 4 scripts | Môi trường riêng `ctdt_real` / `files-real` / `ctdt-real`; không tạo `.env.real`, không đọc cấu hình thật, không chạy seed/app trong sandbox |

## Số liệu thực tế

Các số dưới đây lấy từ cùng các hàm extraction đã viết, chạy bằng TypeScript in-process loader chỉ để chẩn đoán. Không bỏ qua assertion của entry point để tạo JSON. Chỉ xuất counts và codes, không xuất legacy rows.

| Metric | Expected | Actual |
|---|---:|---:|
| Frames | 46 | 46 |
| Programs | 24 | 24 |
| Versions | 46 | 46 |
| Released / DRAFT | 41 / 5 | 41 / 5 |
| Used course codes | 181 | 181 |
| Courses / missing codes | 173 / 8 | 173 / 8 |
| New units | 8 + unassigned | 8 + unassigned |
| Semesters / cohorts | 5 / 5 | 5 / 5 |
| Merged frame rows | 3.316 | 3.316 |
| Skipped missing-course rows | 21 | 21 |
| Items | 3.295 | 3.295 |
| Requisite input rows | 3.389 | 3.389 |
| Requisites skipped: target outside | 253 | 253 |
| Retained row requisites | ≈ 3.136 | 3.135 |
| Retained requisites: source outside frame | Không chốt | 1 |
| Distinct pairs: raw input | 236 | 236 |
| Conflicting pairs: raw input | 3 | 3 |
| Distinct pairs: retained requisites | 236 theo assertion | 224 |
| Conflicting pairs: retained requisites | 3 theo assertion | 2 |
| Accepted catalog relations / cycle skips | Không chốt | 224 / 0 |
| Compulsory credit mismatches | 14 | 14 |
| Elective keys / parsed groups | 227 / ≈ 156 | 227 / 156 |
| Elective rows without group | Không chốt | 213 |
| Group-count mismatches | Không chốt | 14 |
| Malformed lines | 0 | 0 |

Owner counts: `KHOA_CNTT` 123; `DUT-UNASSIGNED` 22; `DUT-013` 1; `DUT-118` 2; `DUT-209` 5; `DUT-210` 1; `DUT-305` 3; `DUT-319` 4; `DUT-413` 5; `DUT-507` 7.

## E-01

### Decision during build

Dùng exact allow-list với regex timestamp là digits, kiểm tra cả snapshot và table ở runtime. Khi một snapshot có nhiều file cùng table, fail vì không thể tự chọn phiên bản. Không dùng prefix rộng có thể nhận `tmHocPhan_PT_*`.

### Incident

Vitest baseline và targeted run đều không khởi động do `Error: spawn EPERM` trong Vite dependency externalization. Không có test case nào được chạy; không xem đây là test đỏ của code.

## E-02

### Decision during build

Dùng `Prisma.Decimal` cho numeric normalization và so sánh giờ học. Không sao chép constants hoặc graph/date helpers từ app. Giữ thứ tự ưu tiên course type và majority/strength tie-break của plan.

## E-03

### Decision during build

Giữ nguyên 24 synthetic program codes, degree levels và frame membership đã được duyệt. Kiểm tra thêm program-code uniqueness; không suy đoán nhóm program từ tên legacy.

## E-04

### Deviation

`snapshotConflicts` được entry point điền từ hai snapshot trước khi serialize report; `extractCatalog` chỉ nhận merged courses nên không đủ thông tin để tự so sánh. Không thay đổi output fields.

## E-05

### Deviation

Thêm `courseCredits` vào input của `extractFrames`, vì chỉ có `catalogCodes` không thể tính `summedCompulsory` bằng `Prisma.Decimal`. Output schema không đổi.

Số requisite sau lọc là 3.135: 3.389 trừ 253 target skips, trừ thêm một row có source `1023940` không nằm trong extracted catalog, thuộc frame `1024006`. Đã điều chỉnh assertion retained-row count từ 3.136 sang 3.135 theo mức chênh nhỏ được brief cho phép. Không tạo course ngoài tập used course codes.

## E-06

### Incident

Assertion exact pair count không đúng sau filtering bắt buộc. Input thô có 236 pairs / 3 conflicts, nhưng output frame có 224 pairs / 2 conflicts. Có 12 pairs biến mất: 11 do target filtering và một pair `1023940` → `1024120` do source không thuộc extracted catalog. Hàm relation vẫn nhận retained version requisites đúng theo plan; không đổi sang raw rows để ép đủ count.

### Lesson worth keeping

Cần tách rõ raw-input totals và retained-output totals trong acceptance assertions. Một aggregate đo trước filtering không thể dùng làm invariant của output sau filtering.

## E-07

### Incident

`pnpm dut:extract` đã được gọi ba lần, tất cả đều exit 1 với `Error: spawn EPERM` từ esbuild/tsx. Dùng `node --input-type=module` cùng `node:module.registerHooks` và TypeScript hiện có để chạy cùng source trong process, không thêm dependency, không mở rộng quyền và không ghi transpiled files. Shared imports hoạt động với loader này; khả năng chạy trực tiếp dưới tsx chưa được xác nhận vì lỗi sandbox.

Lần chạy entry point trong process dừng ở `AssertionError [ERR_ASSERTION]: Unexpected relation pair count`, actual 224, expected 236, trước khi write. Lần chẩn đoán tiếp theo chỉ gọi các hàm pure extraction để lấy đầy đủ counts. Không tạo `catalog.json`, `programs.json`, `report.json` khi contract chưa được giải quyết.

## L-02

### Incident

Chưa bắt đầu vì escalation E-06/E-07; không tự thay contract để tiếp tục loader.

## L-03

### Incident

Chưa bắt đầu vì escalation E-06/E-07.

## L-01

### Incident

Chưa bắt đầu vì escalation E-06/E-07. Chưa có seed command để người dùng vô tình chạy bản loader chưa hoàn chỉnh.

## L-04

### Incident

Chưa bắt đầu vì escalation E-06/E-07.

## Verification

- Baseline `pnpm exec tsc --noEmit -p tsconfig.json`: exit 0.
- Baseline `pnpm exec vitest run prisma`: exit 1; startup error `Error: spawn EPERM`; không chạy test case.
- Targeted `pnpm exec vitest run prisma/seed-data/dut`: exit 1; cùng lỗi startup; không có green case count.
- Final `pnpm exec tsc --noEmit -p tsconfig.json`: exit 0.
- `pnpm dut:extract`: ba lần exit 1; tsx/esbuild không spawn được trong sandbox.
- In-process shared-import check: exit 0. In-process extractor: exit 1 vì invariant 236 pairs không đạt. In-process diagnostic: exit 0; counts như bảng trên.
- `git status --porcelain prisma/seed-data/dut`: exit 0; folder mới là untracked. `git diff --stat prisma/seed-data/dut`: exit 0, không output vì file mới chưa tracked.
- `Get-FileHash prisma/seed-data/dut/*.json`: không output vì không có JSON; chưa chứng minh determinism.
- `Select-String -Path prisma/seed-data/dut/*.json -Pattern 'tmHoSoSV|tmHosoGV|HocPhi|tmHocvu|tmDiemMien|Bearer|x-api-key'`: không output vì không có JSON; không coi đây là kiểm tra an toàn output thành công.
- `pnpm exec prettier --write prisma/seed-data/dut`: exit 0.
- `pnpm exec prettier --check prisma/seed-dut.ts prisma/seed-data/dut`: exit 2 vì chưa có `prisma/seed-dut.ts`; matched files clean.
- `pnpm exec prettier --check prisma/seed-data/dut`: exit 0, `All matched files use Prettier code style!`.
- Không chạy seed, migration, database command hoặc V-01. Không đọc file legacy ngoài allow-list.

## Escalations

### Catalog pair invariant

Đã hoàn thành extraction helpers và xác minh dữ liệu thật; bị chặn bởi assertion của plan, không phải bởi schema. Đã cập nhật mismatch log §2c trong plan theo brief. Không thay D1–D14.

Lựa chọn:
1. Giữ nguyên input của E-06 là retained frame requisites; duyệt expected totals thành 224 pairs / 2 conflicts, và giữ raw totals 236 / 3 làm diagnostic.
2. Đổi E-06 sang raw requisites; cần quyết định cách xử lý source không thuộc extracted catalog và xác định lại contract của catalog/course set trước khi build tiếp.

Khuyến nghị lựa chọn 1: phù hợp thuật toán và tập course hiện đã duyệt, không tạo thêm course hoặc relation không thể resolve. Chờ caller quyết định; không sửa assertion này hoặc tạo JSON để ép qua gate.

### Sandbox verification

tsx và Vitest đều bị `spawn EPERM`. Caller cần chạy lại các command chính thức trong môi trường cho phép spawn, sau khi quyết định catalog-pair contract. Không xem chẩn đoán in-process là Vitest pass hoặc tsx pass.

## Chưa thực hiện

- Hoàn tất E-07 và ba JSON committed-ready.
- Loader L-02 → L-03 → L-01 → L-04 và script `prisma:seed:dut`.
- Hai successful extractor runs, hash comparison, output safety scan trên JSON thật và full formatting check có loader.
- V-01 và database verification, được brief loại trừ có chủ ý.

## Tiếp tục sau approval — 2026-10-23

Caller đã duyệt giữ thuật toán relation dựa trên filtered requisites, đổi expected totals, và tự chạy extraction/runtime checks. Không chạy lại tsx/Vitest, không ghi workaround loader vào repo. Các escalation trước đây không còn chặn implementation.

| ID | Files dưới `source/backend/` | Dòng gần đúng, không tính dòng trống | Kiểm chứng hiện tại |
|---|---|---:|---|
| E-07 | `prisma/seed-data/dut/extract.ts`, `dut-data.ts` | 292 + 50 | Typecheck, Prettier, type-aware oxlint exit 0; caller chạy extraction |
| L-02 | `prisma/seed-data/dut/read-dut-data.ts`, `seed-catalog.ts` | 19 + 188 | Cả ba static checks exit 0; chưa chạy database |
| L-03 | `prisma/seed-data/dut/seed-programs.ts` | 191 | Cả ba static checks exit 0; chưa chạy database |
| L-01 | `prisma/seed-dut.ts`, `package.json` | 73; thêm seed script | Cả ba static checks exit 0; guard chưa được chạy với database |
| L-04 | Summary trong `prisma/seed-dut.ts` | Trong 73 dòng của entry point | Cả ba static checks exit 0; chưa có runtime summary |

## E-07 — Tiếp tục sau approval

### Decision during build

Giữ nguyên nguồn relation là requisites đã lọc. Assertion hiện yêu cầu 224 retained pairs, 2 conflicting pairs và 12 excluded pairs. `report.json.excludedRelationPairs` là số lượng raw pairs không xuất hiện trong retained requisites, tính trước cycle filtering; không xuất danh sách pairs. Entry point vẫn chỉ ghi `catalog.json`, `programs.json`, `report.json` sau khi toàn bộ assertions qua được, với key order cố định, hai-space indentation và LF cuối file.

### Deviation

Expected totals trong plan §0, §2a và verification của E-05/E-06/E-07/L-03 đã được đồng bộ theo approval; thêm mismatch-log row §2c. Không đổi D1–D14. Lần này không tạo JSON: caller đã nhận việc chạy `pnpm dut:extract` ngoài sandbox.

### Lesson worth keeping

Đã kiểm tra counter source-outside bằng phân tích PowerShell chỉ trên ba bảng allow-listed `tmKhungCT`, `tmHocPhan`, `tmHocphanDK`, không in legacy rows. Có 28 merged requisite rows có source không thuộc frame trước filtering: 26 bị loại bởi target filter, 1 bởi source không thuộc extracted catalog, còn 1 được giữ. `FrameReport.requisitesSourceOutside` hiện tăng sau target/catalog filtering và dedupe, đúng nghĩa “source không là row của frame trong kept requisites”; không cần đổi code hoặc keep/skip rule.

Số liệu extraction từ lần chẩn đoán trước vẫn là: 46 frames, 24 programs, 46 versions (41 released + 5 DRAFT), 181 used course codes, 173 courses, 8 missing codes, 3.316 merged frame rows, 21 missing-course row skips, 3.295 items, 3.389 requisite input rows, 253 target skips, 3.135 retained requisites, 224 retained pairs, 2 conflicts, 12 excluded pairs, 0 cycle skips, 156 groups và 14 compulsory-credit mismatches. Không tuyên bố đây là một lần extraction mới thành công.

## L-02 — Tiếp tục sau approval

### Decision during build

Loader chỉ đọc hai JSON cạnh module, không đọc legacy dump. Unit/course/cohort/relation dùng natural-key upsert với `update: {}`; semester hiện hữu giữ nguyên cả ngày null và báo chênh lệch ngày. Unique-pair collision của semester fail với code rõ ràng. Missing owner hoặc relation course code fail thay vì bỏ qua.

Relation writes nằm trong một interactive transaction, lấy shared graph lock trước khi đọc existing PRIOR/PREREQUISITE edges, kiểm tra cycle và thêm accepted edges vào graph trong cùng transaction. Existing relation được giữ nguyên; cycle skip chỉ áp dụng cho edge mới.

### Deviation

Mở rộng `CatalogSeedResult` bằng counters created/skipped cho units, courses, relations, semesters, cohorts để L-04 có số liệu thật; giữ các maps, date differences và relation counters đã có trong plan. Thêm timeout có tên 60.000 ms cho relation transaction để không phụ thuộc default timeout ngắn khi xử lý cả batch. Relation skipped count bao gồm existing và cycle skips; cycle count được in riêng.

## L-03 — Tiếp tục sau approval

### Decision during build

Mỗi program mới được ghi nguyên tử trong transaction timeout 60.000 ms; program đã tồn tại được skip whole. Released versions được sắp theo start date thực tế của semester trong database, rồi dùng `releasedStatuses` với `todayDate()`. Ghi version number, previous-version chain, publisher, effective semester, published/created time và cohort pins; DRAFT chỉ nhận description fields và defaults.

Groups/items dùng `createManyAndReturn`, requisites dùng `createMany`. Mọi course/group/item/cohort reference bắt buộc đều fail nếu không resolve được. Không tạo syllabi, không pin snapshots hoặc syllabusId, không gọi publisher service và không bỏ requisite trong loader.

### Incident

Lần typecheck đầu phát hiện TS7022 tại biến version trong vòng previous-version chain. Đã khai báo rõ kiểu `{ id: string }` cho kết quả cần dùng, rồi chạy lại typecheck thành công; không sửa file ngoài scope.

## L-01 — Tiếp tục sau approval

### Decision during build

Entry point theo seed-demo: PrismaPg adapter, guard university/faculty và active SYSTEM R1 publisher trước mọi write, đọc JSON, gọi catalog rồi programs, luôn disconnect trong `finally`. Publisher chọn user tạo sớm nhất, dùng userId làm deterministic tie-break khi createdAt bằng nhau. Thêm `prisma:seed:dut` ngay cạnh `dut:extract` trong package scripts; không đổi base/demo seed.

## L-04 — Tiếp tục sau approval

### Decision during build

Summary in created/skipped counts cho units, courses, relations, semesters, cohorts và programs; relation cycle skips được tách riêng. Mỗi semester date difference in code cùng existing → legacy, không in tên. Existing-program skip không đụng vào versions của người dùng.

## Verification — Lần tiếp tục

Chỉ chạy ba check được caller chỉ định, sau khi format các source files trong scope:

| Command trong `source/backend` | Exit code cuối | Output nguyên văn |
|---|---:|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | Không có output |
| `pnpm exec prettier --check prisma/seed-dut.ts prisma/seed-data/dut` | 0 | `Checking formatting...` rồi `All matched files use Prettier code style!` |
| `pnpm exec oxlint --type-aware prisma/seed-dut.ts prisma/seed-data/dut` | 0 | Không có output |

Caller thông báo đã chạy `pnpm exec vitest run prisma/seed-data/dut`: 2 files, 49 tests passed. Đây là kết quả caller cung cấp, không phải test run của lần tiếp tục này. Không chạy tsx, Vitest, extractor, seed hoặc database commands; không thêm workaround loader hay dependency.

## Escalations — Lần tiếp tục

Không còn escalation cần quyết định. Approval đã được áp dụng; static checks đều qua.

## Chưa chạy — Caller tiếp nhận

- `pnpm dut:extract` và phát sinh `catalog.json`, `programs.json`, `report.json`; kiểm tra output và determinism trên JSON thực tế.
- Seed guard/runtime, created/skipped summary, database counts, release status và idempotency qua hai lần seed.
- V-01 tiếp tục nằm ngoài scope.

## V-01 — Kiểm chứng và đồng bộ tài liệu — 2026-10-23

### Decision during build

Kết quả dưới đây do caller quan sát trên PostgreSQL 18 ICU `vi-VN` dùng một lần, **không phải `ctdt-dev-pg` và không phải database riêng của người dùng**. Lượt này chỉ nhận kết quả để cập nhật tài liệu; không chạy lại database, Prisma hoặc test commands và không suy ra kết quả UI walkthrough.

Thứ tự caller đã thực hiện: `prisma migrate deploy` áp toàn bộ migrations → `pnpm prisma:seed` thành công → `pnpm prisma:seed:demo` in `Demo seed done.` → `pnpm prisma:seed:dut` hai lượt. DUT seed lần đầu mất khoảng 9 giây.

| Loại | Lần đầu: created | Lần hai: created | Lần hai: skipped |
|---|---:|---:|---:|
| OrgUnit | 9 | 0 | 9 |
| Course | 173 | 0 | 173 |
| CourseRelation | 224 | 0 | 224 |
| Semester | 4 | 0 | 5 |
| Cohort | 2 | 0 | 5 |
| Program | 24 | 0 | 24 |

Lần đầu Semester skipped 1, Cohort skipped 3; relation cycle skips là 0. Summary in conflict `2025-2026-1: 2025-09-08 → 2025-08-04`; SQL xác nhận database vẫn giữ `2025-09-08`, không ghi đè ngày legacy. Lần hai created 0 ở mọi loại chứng minh no-op đối với dữ liệu đã seed trong lượt kiểm chứng này.

SQL chỉ trên programs có `programCode` khớp `CNTT-%`:

| Metric | Actual |
|---|---:|
| Program | 24 |
| ProgramVersion | 46 |
| ACTIVE / HISTORICAL / DRAFT | 19 / 22 / 5 |
| CurriculumItem | 3.295 |
| CurriculumRequisite | 3.135 |
| ElectiveGroup | 156 |
| CohortVersion | 38 |
| Program có hơn một ACTIVE | 0 |

38 CohortVersion links khớp số versions có `cohortCode` trong `programs.json`. Lịch sử `CNTT-KS-DT`: `1.0` K2022 `HISTORICAL`, `2.0` K2023 `HISTORICAL`, `3.0` K2024 `HISTORICAL`, `4.0` K2025 `ACTIVE`.

Phạm vi **toàn database sau base + demo + DUT**, không chỉ DUT: 190 courses, 230 course relations, 13 org units.

Caller cung cấp thêm: `tsc --noEmit` exit 0; `vitest run prisma` 52 passed; extractor cho hashes giống hệt khi chạy lại; sensitive-pattern grep trên ba JSON sạch. Không thay các số này bằng kết quả của sandbox ở những phần nhật ký trước.

### Deviation

Migrations được caller áp bằng `prisma migrate deploy`, không dùng đường migrate dev trong hướng dẫn V-01 ban đầu. Không thay schema và không sửa base/demo seed. Việc chạy database là kết quả caller cung cấp; agent ở lượt này chỉ làm phần documentation theo phạm vi đã duyệt.

Đã đồng bộ `database_and_models.md` (bảng được ghi, idempotency, version status, giữ ngày semester), `technical_reference.md` (hai scripts, JSON-only boundary), `handoff.md` §3.3, `todo.md`, snapshot `current_work.md`, append-only `progress_log.md`; plan Status chuyển `Complete`. Không sửa `error_log.md` hoặc docs-sync marker ngoài scope.

### Lesson worth keeping

Luôn tách phạm vi counts của DUT khỏi toàn database và tách database kiểm chứng khỏi database Playwright/người dùng. Seed mới thêm dữ liệu CTĐT thật nhưng không thay `1024034`/`DEMO*`, `KnowledgeBlock` hoặc semester/cohort hiện hữu. Năm câu hỏi vẫn dùng defaults: ý nghĩa `LoaiDK`, degree level K2026, course-type mapping, synthetic program codes và ngày semester không ghi đè; cần xác nhận và tự nạp database riêng trước khi coi phần dữ liệu của người dùng đã hoàn tất.

## Tách thư mục và môi trường dữ liệu thật — 2026-10-23

### Decision during build

Đã di chuyển 7 files vào `prisma/seed-data/dut/extract/`, 3 files vào `load/` và 3 JSON vào `data/` bằng `Move-Item`. Root giữ `dut-data.ts`, `legacy-mapping.ts`, `legacy-mapping.spec.ts`; chỉ sửa import/re-export paths và hai JSON URLs sang `../data/`, không chuyển functions hoặc đổi logic. `DEFAULT_LEGACY_ROOT` vẫn tương đối với working directory nên không đổi. Hashes của ba JSON giữ nguyên sau di chuyển; các đường dẫn cũ trong phần deliverable lịch sử được giữ lại, layout hiện tại nằm trong hai dòng summary mới và phần này.

Thêm `scripts/with-env.ts` dùng `dotenv.parse`, merge file values đè `process.env`, rồi spawn một command string với `shell: true`, `stdio: 'inherit'`; thiếu arguments exit 2, thiếu override file báo sao chép từ template rồi exit 1, không fallback database. Child exit code được truyền lại; signal hoặc spawn error exit 1. Không dùng Node env-file APIs và không thêm dependency.

Thêm template `.env.real.example` chỉ chứa ba overrides `DATABASE_URL`, `FILES_ROOT`, `BULLMQ_PREFIX`; ignore override files và `/files-real/`, giữ template được theo dõi. Thêm `real:migrate`, `real:seed`, `real:seed:dut`, `real:dev`, không có `real:seed:demo`. Người dùng tự tạo `.env.real`, tạo database đúng ICU, chạy `pnpm real:migrate; pnpm real:seed; pnpm real:seed:dut`, rồi `pnpm real:dev`. Hai môi trường tách database/files/queue prefix nhưng vẫn chia sẻ Redis và port mặc định 3000; chạy một app tại một thời điểm nếu chưa override `PORT`.

Đã cập nhật README và current references trong database architecture, technical reference, handoff, snapshot; append progress log. Typecheck, Prettier check và type-aware oxlint đều exit 0. Layout khớp yêu cầu; các matches còn lại của kiểm tra import là sibling modules hợp lệ trong `extract/`, sibling `seed-catalog` trong `load/` và re-exports `./extract/...` ở root. Không chạy tsx, Vitest, extractor, loader, Prisma hoặc database trong lượt này; kết quả runtime V-01 trước đó không phải kiểm chứng lại sau refactor. Không đọc cấu hình thật, không tạo `.env.real`; năm defaults vẫn chờ người dùng xác nhận.

## Kiểm chứng runner môi trường dữ liệu thật — 2026-10-23

Caller kiểm chứng sau refactor bằng PostgreSQL 18 ICU `vi-VN` và Redis containers dùng một lần; cả hai đã được gỡ sau kiểm chứng. Container database mặc định dừng suốt lượt chạy, nên fallback về cấu hình database mặc định sẽ thất bại. Các kết quả dưới đây do caller cung cấp, không phải agent chạy lại.

- Chạy `tsx scripts/with-env.ts <throwaway vars file> ...` với cùng commands như `real:migrate`, `real:seed`, `real:seed:dut` và `nest start -b swc` (tương đương `real:dev` không watch). Không gọi scripts `real:*` theo tên vì chúng cố định `.env.real`, do người dùng tự tạo.
- `prisma migrate deploy` áp toàn bộ migrations và tự tạo database còn thiếu; `datlocprovider=i`, `datlocale=vi-VN` kế thừa server default. Người dùng không cần tạo `ctdt_real` bằng tay; ICU phù hợp trong lượt này đến từ server default.
- Base seed thành công. DUT seed: 9 units, 173 courses, 224 relations, cycle skipped 0; semesters 4 created / 1 skipped; cohorts 2 created / 3 skipped; 24 programs. Conflict `2025-2026-1` giữ ngày hiện hữu `2025-09-08`.
- Database có 24 programs `CNTT-%` và 1 base-seed placeholder `1024034`, 46 versions, 179 courses, 1 user; không có demo data.
- App qua runner trả health `{"status":"ok","database":"up","redis":"up"}` trên `PORT` override; login bằng throwaway admin password trả 200, session row được ghi vào database dùng một lần. Redis keys có `BULLMQ_PREFIX` override; app tạo thư mục `FILES_ROOT` khi startup.

**Not verified**:
- `GET /api/programs` với `admin` trả 403; chưa điều tra nguyên nhân, chưa xác nhận endpoint thành công.
- `.env.real` được git-ignore: chỉ suy từ pattern, chưa kiểm chứng thực tế.

**Lesson worth keeping**: Dừng database mặc định trong kiểm thử env override để fallback âm thầm thất bại rõ ràng thay vì vô tình vượt qua kiểm chứng.
