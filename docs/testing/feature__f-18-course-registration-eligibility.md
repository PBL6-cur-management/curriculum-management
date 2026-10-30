# Feature — Điều kiện đăng ký học phần

**Type:** Feature
**Source files under test:** `source/backend/src/shared/registration-eligibility/`, `source/backend/src/features/registration-eligibility/`, `source/frontend/src/features/curriculum/`, `source/frontend/src/shared/registration-eligibility/`.

Xét điều kiện học tập theo student/program/semester và frozen version F-17 trả về. Không xác nhận mở lớp, đăng ký thực tế, tốt nghiệp hoặc khả năng học cải thiện. Tất cả runtime/manual results trong lượt build này là **Not run**.

## Automated coverage

| Test file | What it covers | Gap (needs manual) |
| --- | --- | --- |
| `source/backend/src/shared/registration-eligibility/eligibility-config.spec.ts`, `eligibility-reasons.spec.ts` | Depth 1..20/default và Vietnamese vocabulary | Faculty chấp nhận default |
| `source/backend/src/shared/registration-eligibility/academic-evidence.spec.ts` | Completion/PRIOR/PREREQUISITE, Decimal/source minimum, equivalent/replacement facts | Faculty recognition/official source semantics |
| `source/backend/src/shared/registration-eligibility/eligibility-context.reader.spec.ts` | Tx-only bulk reads, frozen/empty rules, malformed facts | Dữ liệu đã phát hành hợp lệ của môi trường nghiệm thu |
| `source/backend/src/shared/registration-eligibility/corequisite-graph.spec.ts`, `eligibility-evaluator.spec.ts` | SCC, cycles/diamond, full bundle, leaf/path, external/depth 20/21, deterministic/no mutation | Chấp nhận cách đếm condensed components |
| `source/backend/src/shared/registration-eligibility/registration-eligibility.reader.spec.ts` | Actor/purpose, supplied tx và RepeatableRead, upstream failure propagation | Actual temporal matrix qua F-16/F-17 suites |
| `source/backend/src/features/registration-eligibility/*.spec.ts` | Query validation, whitelist/invariants, scoped paging | Full browser search/paging interaction |
| `source/backend/test/registration-eligibility.e2e-spec.ts` | Actual API/release/group/source-writer, scope/own R6, outside equivalent, null-end integrity, no writes, shared-reader parity | Full official-source and temporal matrix |
| `source/backend/test/registration-eligibility-performance.e2e-spec.ts` | Full HTTP serialization 30/60 rows, ba samples mỗi size | SQL counts/hardware-equivalent NFR sign-off; chưa đo |
| `source/frontend/src/features/curriculum/api/registrationEligibility.test.ts`, `hooks/useRegistrationEligibility.test.tsx` | Encoded complete context, null disabled, key/cleanup/error privacy | Actual browser logout/focus/navigation timing |
| `source/frontend/src/features/curriculum/components/*.test.tsx`, `pages/CurriculumPage.test.tsx` | Scoped selector/context, no-column ordinary view, read-only table/board, redirect/role gates, existing authoring assertions | Keyboard focus, narrow viewport, slow network |
| `source/frontend/src/shared/registration-eligibility/*.test.tsx` | Four server-text states, full bundle/leaf/zero/path/evidence, hostile text escaping | Screen reader and touch layout |

## Manual test cases

Chỉ dùng synthetic account/student/course. R1 chuẩn bị Draft qua giao diện/API hiện có, sửa requisites trước ban hành, hoàn tất đề cương/assessment rồi ban hành và gán cohort. Dùng F-17 import templates hoặc test fixture `createEligibilityFixture`; không sửa dữ liệu production hoặc trạng thái phát hành trực tiếp.

| # | Precondition | Steps | Expected result | Service action needed | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | R1/R3, known-start semester, student đang theo program | Mở MH-25; chọn học kỳ, tìm studentCode/name, chọn sinh viên; đổi view | Resolved version, evaluatedAt/source, cùng verdict ở table/board; không edit/add/drag | none | Not run |
| 2 | A PREREQUISITE B, threshold 2.5; B PASSED | Nhập kết quả B 2.49 rồi 2.5 bằng F-17 ACADEMIC_RESULT; bấm Tính lại mỗi lần | TOO_LOW rồi đủ prerequisite; mark strings không làm tròn | Commit workbook synthetic qua imports; không tự đổi DB | Not run |
| 3 | A PRIOR B | Nhập B FAILED 0 rồi IN_PROGRESS; Tính lại | FAILED đủ học trước; IN_PROGRESS không đủ, không suy pass từ điểm | F-17 result import synthetic | Not run |
| 4 | A COREQUISITE B; B COREQUISITE C, chưa học | Mở Drawer A | Phải đăng ký cùng đầy đủ B/C; mỗi course một reason; CONDITIONAL không khẳng định đã đăng ký | Tạo requisites trong Draft rồi ban hành | Not run |
| 5 | A↔B; B PREREQUISITE C missing | Xét cả A/B rồi bổ sung C PASSED đạt ngưỡng | Cả hai fail trước; leaf C và via/path rõ; sau đó bundle reciprocal hợp lệ | F-17 result import cho C | Not run |
| 6 | External equivalent E ngoài khung của B | Tạo equivalent group bằng course-relation UI/API; nhập E EXEMPT null | B hoàn thành qua E; positive prerequisite vẫn SCORE_MISSING nếu không có numeric proof | Group API và F-17 synthetic result import | Not run |
| 7 | B DISCONTINUED, replacement R ACTIVE | Tạo QH5 source B→R, nhập R PASSED; so với không QH5 và chain R→S | Chỉ one-hop active evidence; thiếu replacement warning không xóa old result | Course catalog/relation API; không đổi frozen requisites | Not run |
| 8 | Out-of-frame unfinished COREQUISITE X | Xét A rồi nhập X PASSED | Ban đầu rules-unavailable + warning; completed X thỏa; không dùng live requisites | Frozen Draft relation trước release; source result import | Not run |
| 9 | 20/21-component chains hoặc SCC lớn | Chạy synthetic evaluator fixture suites; xem payload lý do | 20 allowed; 21 depth blocker/path; SCC size không được coi là depth | Orchestrator chạy named unit suites, không sửa live framework | Not run |
| 10 | Hai sinh viên cùng program; own R6, R3 ngoài scope | Gọi GET với các subject; gọi picker bằng R6; dùng crafted URL | Own only; không lộ người khác hoặc directory; 403/404 theo source policy | Session login từng account synthetic | Not run |
| 11 | Browser slow network, hai subject, bookmarked version khác | Chọn nhanh hai subject; back/forward; clear; logout; refocus | Không verdict/name/evidence của subject trước; redirect trước join; no old focus | Browser devtools throttle only; không tắt server | Not run |
| 12 | Table/board có đủ bốn trạng thái | Tab/Enter Xem lý do, Escape/close; viewport 360px; long Vietnamese/HTML-looking names | Text + semantic colors, đủ evidence/bundle, plain text escaped, không page overflow | none | Not run |
| 13 | 30/60-row synthetic released fixtures | Chạy performance e2e; lưu stdout, CPU/RAM/Node/DB versions, SQL counts nếu có profiler | Full request <3000ms; không chỉ timing evaluator hoặc bỏ authorization | Orchestrator chạy suite ngoài sandbox | Not run |

## Lệnh orchestrator

```powershell
cd source/backend
pnpm exec vitest run src/shared/registration-eligibility src/features/registration-eligibility
pnpm test:e2e -- test/registration-eligibility.e2e-spec.ts test/registration-eligibility-performance.e2e-spec.ts test/permission-table.e2e-spec.ts
cd ../frontend
pnpm exec vitest run src/features/curriculum src/shared/registration-eligibility
```

Không có Playwright filename được F-18 plan chỉ định. Không tạo spec F-18 tùy tiện, không nhân bản `studentWorld`/`prepareSyllabusAssessment`, không sửa `fixtures/select.ts`. Nợ browser walkthrough và Faculty/NFR acceptance không được ghi Passed từ RTL/typecheck.
