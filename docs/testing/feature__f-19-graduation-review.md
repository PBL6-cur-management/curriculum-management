# Feature Xét tốt nghiệp — F-19

**Type:** Feature
**Branch / PR:** Không tạo branch/commit trong lượt triển khai này.
**Source files under test:**
- `source/frontend/src/features/graduation/api/graduation.ts`
- `source/frontend/src/features/graduation/hooks/useGraduation.ts`
- `source/frontend/src/features/graduation/components/GraduationResultView.tsx`
- `source/frontend/src/features/graduation/components/GraduationShortfalls.tsx`
- `source/frontend/src/features/graduation/components/GraduationContextForm.tsx`
- `source/frontend/src/features/graduation/components/GraduationReauditPanel.tsx`
- Bốn page `GraduationReviewPage`, `GraduationAuditPage`, `GraduationBatchesPage`, `GraduationBatchPage` trong `source/frontend/src/features/graduation/pages/`.
- `source/frontend/src/router.tsx`, `source/frontend/src/routes.ts`, `source/frontend/src/shared/layout/menuItems.tsx`.
- Entry route-only trong `source/frontend/src/features/students/pages/StudentDetailPage.tsx`.

Kiểm giao diện cán bộ MH-53/MH-54 và entry MH-52 bằng dữ liệu tổng hợp. Không công nhận tốt nghiệp, thay trạng thái sinh viên, sửa điểm hoặc xây portal R6. Các credit/shortfall/conclusion do backend quyết định; frontend chỉ trình bày. Kế hoạch: `docs/implementation/f-19-graduation-review-implementation-plan.md`. Đối chiếu US-087..091, KB-063..067/074..080, NT-B5-07/08 trong test-plan hiện hành; không thay catalog chấp nhận.

---

## Automated coverage

Các Vitest dưới đây đã được viết, **chưa chạy trong sandbox** vì spawn EPERM đã biết. Backend baseline do orchestrator cung cấp: graduation 19/19, batches 8/8, corrections 10/10, permission table 185/185, unit 363/363; không coi baseline này là frontend verdict.

| Test file | What it covers | Gap (needs manual) |
|---|---|---|
| `source/frontend/src/features/graduation/api/graduation.test.ts` | Generated discriminated branches, credit strings/minima, URL/opaque IDs, CSRF, save replay key, preview/create/retry, export filename/object URL/errors | Cookie thật, Cache-Control private, XLSX bytes và server download headers trên browser |
| `source/frontend/src/features/graduation/hooks/useGraduation.test.tsx` | Context/page/filter key separation, disabled context, late response, scoped invalidation, retained save key, active/terminal/unauthorized polling | Reload, mạng thật, task progression và thu hồi quyền đang mở |
| `source/frontend/src/features/graduation/components/GraduationResultView.test.tsx` | US-087/088/089: bốn nhóm thiếu, điều kiện 0 TC, cả hai minima, warning-only eligibility, mã cũ/tương đương 3→2, free credits, precision strings, advisory minima; không cần staff providers | Chính sách Faculty E2/E3, layout bảng rộng, screen reader/keyboard thật |
| `source/frontend/src/features/graduation/pages/GraduationReviewPage.test.tsx` | Explicit view/save, URL context, returned saved result, save-key retry, CANNOT_AUDIT, context clearing, required selectors; access revocation ẩn saved result/history | Options/pagination/search với dữ liệu phạm vi thật, phản hồi chậm qua mạng |
| `source/frontend/src/features/graduation/pages/GraduationAuditPage.test.tsx` | Immutable detail, null reviewer/system, freshness pending/failed, R1 retry/R3 coarse view, unsupported schema, 403/404 | Re-audit thật sau F-17 import và so sánh các audit IDs |
| `source/frontend/src/features/graduation/pages/GraduationBatchesPage.test.tsx` | US-090: preview tách create, counts song ngành, modal, revision/key, filter reset và 409 drift; R3 phải chọn program, roster rỗng không confirm | Roster mutation giữa preview/confirm, enqueue chậm và tái mở batch sau reload |
| `source/frontend/src/features/graduation/pages/GraduationBatchPage.test.tsx` | Pending/error khác NOT_ELIGIBLE, immutable audit links, server filters/export parity, download failure, nonterminal/FAILED export disabled | Workbook sheets, sort/filter/page lớn, progress live region với screen reader |
| `source/frontend/src/features/graduation/graduationRoutes.test.tsx` | Actual lazy routes, R1/R3/mixed allow, R2/R4/R5/R6/direct-URL denial, missing permission; MH-52 context-only navigation/disabled ambiguity | Browser deep links, back/forward, sidebar focus/selected group, role revocation |
| `source/frontend/src/shared/layout/menuItems.test.tsx` | Permission/role/mixed-identity menu và batch/audit selected path | Menu keyboard/mobile collapse |
| `source/frontend/src/shared/notifications/NotificationBell.test.tsx` | US-091 content-only conclusion-change notice, mark read, không điều hướng ChangeRequest giả; giữ test notification cũ | Notification insertion/delivery từ worker thật |
| `source/backend/test/graduation.e2e-spec.ts`, `graduation-batches.e2e-spec.ts`, `graduation-corrections.e2e-spec.ts`, `permission-table.e2e-spec.ts` | Arithmetic/persistence/scoping/receipts/leases/notices/backend contracts; baseline xanh do orchestrator xác nhận | Không thay browser/manual acceptance; sandbox không chạy lại backend |

Không thêm Playwright spec: FE-06 chỉ định Vitest và manual browser coverage. Các selector/layout helper được kiểm qua page specs; không có spec độc lập cho từng helper trình bày thời gian/credit.

---

## Manual test cases

Chỉ dùng tài khoản và dữ liệu tổng hợp do test fixture tạo. Chuẩn bị R1, R3 có/không có chương trình phụ trách, only-R6 và mixed R3/R6; sinh viên song ngành/chuyển ngành, phiên bản theo khóa/ngoại lệ, học kỳ quá khứ/tương lai có ngày bắt đầu. Không dùng dataset hoặc credential thật.

| # | Precondition | Steps | Expected result | Service action needed | Result |
|---|---|---|---|---|---|
| 1 | R1, MH-52 có chương trình/học kỳ đã chọn | Bấm Xét tốt nghiệp; kiểm URL; bấm Xem kết quả | Chuyển đúng student/program/semester; click entry không save/evaluate; header đúng phiên bản áp dụng, không latest fallback | none | ☐ |
| 2 | R3 giới hạn phạm vi; only-R6; mixed R3/R6 | Mở menu và dán trực tiếp cả bốn URL F-19, thử sinh viên ngoài chương trình phụ trách | Only-R6/role khác không vào staff pages; mixed có quyền vào; scope miss 404, không lộ hồ sơ khác | none | ☐ |
| 3 | Hai sinh viên tổng hợp, mạng chậm | Xem sinh viên A; đổi chương trình/sinh viên khi request chưa về; back/forward URL | Không flash kết quả người cũ trong context mới; student options bị khóa khi thiếu program/semester; không phải nhập UUID | Browser DevTools đặt network throttling; không sửa backend | ☐ |
| 4 | Case thiếu điều kiện 0 TC, hai minima tự chọn, tổng TC | Xem kết quả và từng nhóm thiếu | Bốn heading, nhóm tự chọn hiện cả thiếu TC và số học phần; diagnostic không bị gọi là NOT_ELIGIBLE | none | ☐ |
| 5 | Học phần bắt buộc 3 TC, mã cũ tương đương 2 TC đã đạt | Xem recognition, warning, total gap; thêm case có credit dư/outside frame | Required/studied code/name cạnh nhau; học phần hoàn thành, công nhận 2, warning 1; free credit ghi nguồn, không tính lại ở FE | Chuẩn bị transcript tổng hợp qua F-17 import, không sửa source/schema | ☐ |
| 6 | Case warning-only vẫn ELIGIBLE và catalog block minimum cao hơn | Xem kết luận và khối kiến thức | ELIGIBLE không bị đổi vì warning; catalog minima có nhãn tham khảo, không thêm điều kiện xét riêng; decimals không bị làm tròn | none | ☐ |
| 7 | Source thay đổi sau live preview | Bấm Lưu lần xét, mở link audit, history và reload | Hiện đúng result trả về từ POST, reviewer/time/audit ID; audit cũ còn đọc được, không edit/delete; save là thao tác rõ ràng | Dùng R1 ở phiên khác import kết quả tổng hợp F-17 trước khi save | ☐ |
| 8 | Một save request đã gửi, response bị mất | Gửi Lưu lần xét khi mất mạng rồi thử lại sau phục hồi | Retry giữ requestKey, một audit cho cùng thao tác; save chủ động tiếp theo có key mới | DevTools chặn/mất response POST rồi bỏ chặn; kiểm server history | ☐ |
| 9 | Enrollment TRANSFERRED/ENDED có học kỳ lịch sử | Mở context trước untilSemester và đúng boundary; mở chương trình mới riêng | Lịch sử đọc/lưu được trong `[from,until)`; boundary chương trình cũ 404, không fallback chương trình hiện tại | Chuẩn bị enrollment tổng hợp bằng F-17 API đã có | ☐ |
| 10 | R1 hoặc R3 với roster song ngành | Chọn semester và program/cohort hợp lệ; preview; đổi filter; confirm modal | R3 phải chọn chương trình phụ trách; counts sinh viên khác lượt chương trình; filter reset preview; không create trước confirm; scope giao nhau khi chọn cả hai | none | ☐ |
| 11 | Có preview hợp lệ | Thay roster ở phiên khác, rồi confirm | 409 hiển thị rõ, preview/key bị bỏ, phải xem trước lại; không âm thầm tạo roster mới | R1 dùng enrollment API hiện có thêm/đóng một enrollment tổng hợp trong phạm vi | ☐ |
| 12 | Batch có vài item lỗi và nhiều item hợp lệ | Theo dõi queued/running; reload; lọc q/conclusion/outcome, đổi trang/pageSize | Durable progress denominator=enrollmentCount; lỗi khác chưa đủ điều kiện; terminal dừng poll; filters gửi server và page reset; audit links giữ auditId gốc | Orchestrator chạy workers/Redis thật và fixture dữ liệu lỗi hợp lệ của backend test | ☐ |
| 13 | Batch terminal; một FAILED batch | Xuất cùng bộ lọc, mở XLSX; thử export FAILED; revoke access rồi tải lại | Workbook đúng filter/saved outcomes, filename/header private; FAILED không export như complete; quyền bị thu hồi không được tải | R1 thay quyền tài khoản tổng hợp qua admin UI/API, không sửa DB schema | ☐ |
| 14 | Đã lưu audit, có F-17 correction đổi rồi giữ nguyên conclusion | Import correction, mở old audit/history/tasks và notification | Có audit mới RESULT_CHANGE; old audit bất biến; chỉ conclusion đổi mới gửi R1 notice; null request link không mở ChangeRequest; R3 không có retry panel | R1 nhập hai file kết quả tổng hợp bằng F-17; orchestrator để scanner/worker chạy | ☐ |
| 15 | Task FAILED do lỗi dữ liệu đã biết, dữ liệu đã sửa | R1 Thử xét lại; R3 mở cùng audit; mất kết nối khi đang theo dõi | R1 có tác vụ/retry, R3 chỉ freshness; lỗi vẫn giữ old head, không báo kết luận mới giả; hồi phục bằng read/recovery | Dùng fixture FAILED/retry của backend correction e2e trên môi trường tổng hợp | ☐ |
| 16 | Browser desktop/mobile, reduced motion và screen reader | Tab qua selectors/forms/modal/table links/download; resize ngang/hẹp; nghe progress | Labels/focus rõ, modal hủy an toàn, bảng overflow không che thao tác, progress live region đọc lịch sự, không dựa riêng màu | none | ☐ |

---

## Notes / known issues

- Tất cả manual rows chưa chạy. Không có screenshot/dữ liệu cá nhân và không ghi verdict giả.
- E1 giữ administrative retroactivity/current calendar; E2/E3 dùng defaults đã duyệt, còn nợ Faculty input. Trường hợp allocation/exemption chưa thể quyết định phải là CANNOT_AUDIT/diagnostic, không tự đoán chính sách hay ngưỡng điểm ở FE.
- Result presentation thuần nằm trong feature theo scope lượt này; chưa chuyển thành public shared boundary cho F-20. Portal R6 và Faculty acceptance không thuộc lượt frontend này.
- Chưa có phép đo browser hoặc NFR 500 sinh viên/5 phút trong lượt này; performance benchmark backend là opt-in và do orchestrator chạy riêng.
- Generated `schema.d.ts` thuộc generator/orchestrator, không sửa tay. Live outcome alias lấy generated endpoint oneOf thay base DTO nullable rộng.
- Static check frontend: `pnpm exec tsc -b --pretty false` exit 0 ngày 2026-10-30, stdout/stderr rỗng; không phải verdict cho Vitest hoặc manual cases.
- Index `docs/testing/README.md` và architecture docs ngoài scope chỉnh sửa lần này; orchestrator đồng bộ sau khi duyệt kết quả runtime.
