# Demo CTĐT — đánh bóng cho giảng viên, báo cáo Drive, săn A1 bền hơn

## Context

Demo đang chạy tại https://ctdt.oguri-lab.io.vn (VM x86 trial, CD tự deploy `main`). Người dùng duyệt thử và muốn trước khi gửi thầy cô: login đẹp + tài khoản `demo/demo` toàn quyền, sửa vài lỗi UI (tiêu đề dài tràn bảng, nút dính ở Xét tốt nghiệp, bảng Phân bố tín chỉ lệch, So sánh CT không highlight), trực quan hóa quy trình đề xuất, gắn "Sắp có" cho tính năng không chạy được trên demo, dọn dữ liệu rác test + tạo dữ liệu mẫu, và một báo cáo + hướng dẫn sử dụng trên Google Drive. Đồng thời vòng săn A1 đã chết (lỗi mạng EOF 12:41) — cần viết lại theo nhịp 120 s.

Quyết định đã chốt (grill): demo toàn quyền, không reset dữ liệu; gợi ý + nút "Dùng tài khoản demo" trên login; demo tự đi hết luồng duyệt; dọn rác + dữ liệu mẫu; quy trình ở cả chi tiết + cột danh sách + khung giải thích; "Sắp có" cho F-21/F-22/F-25 email/F-26, giữ menu + trang mô tả, bật bằng biến môi trường; ellipsis mọi cột text tự do; so sánh tô dòng + ô + nhãn chữ; login chia đôi, ít chữ, dùng hình/animation; Phân bố TC hai cột cân; Google Docs có ảnh 8–12 trang; săn 120 s + jitter, 2/12 & 1/6, Oracle chọn FD; nhiều PR nhỏ; sửa chỗ đã nêu + quét lỗi cùng loại.

Làm trong worktree `D:\Workspace\Nam5\PBL6\cm-demo`, mỗi PR một nhánh từ `origin/main`, commit/PR không có dòng attribution Claude, self-merge bằng `flyingdoggoo`, CI xanh mới merge (CD tự lên demo). UI theo rule `.claude/rules/ui-ux-skill.md`: `/impeccable shape` cho màn mới (login, quy trình), `/impeccable polish` + `audit` trước mỗi PR có UI, token từ `src/shared/design-system/tokens.ts`, `Alert title=`. Ghi kế hoạch này vào `docs/implementation/demo-polish-implementation-plan.md` trước khi code (ai-rules Rule 1).

---

## PR-0 — Săn A1 bền hơn (`chore/a1-hunt-v2`, làm đầu tiên: nhỏ, cho vòng săn chạy lại sớm)

`deploy/scripts/apply-until-capacity.sh` viết lại:
- Mỗi chu kỳ **1 lần gọi** `terraform apply -target=oci_core_instance.demo -refresh=false`, luân phiên `2:12` / `1:6`, `fault_domain=""` (Oracle chọn). Nghỉ `120 s + jitter 0–30 s` (`$RANDOM`). Thành công → `terraform apply` đầy đủ để có output, in IP, nhắc ghi `ocpus/memory_gb` vào tfvars, exit 0.
- Phân loại lỗi từ log: *hết máy* → chu kỳ kế; *tạm* (`EOF|TooManyRequests|429|timeout|connection reset|refused|TLS handshake|no such host|502|503|504|state lock`) → backoff ngẫu nhiên 300–600 s; *khác* (401/404 auth, `LimitExceeded`/quota, validation) → dừng exit 1.
- Chống VM trùng: thêm vào `main.tf` data source `oci_core_instances` lọc `display_name = var.name`, state PROVISIONING/STARTING/RUNNING + output `demo_instances_in_oci`. Sau mỗi lỗi tạm: `apply -refresh-only` + đọc output; > 0 mà state không có `oci_core_instance.demo` → in OCID, dừng, hướng dẫn `terraform import` (không tự import).
- `MAX_HOURS` mặc định 0 = không giới hạn. Mỗi chu kỳ in 1 dòng có số lần thử/lỗi tạm.
- COMMANDS.md §1 cập nhật dòng lệnh. Chạy lại nền `bash deploy/scripts/apply-until-capacity.sh`.

## PR-1 — Tài khoản demo, login mới, "Sắp có" (`feat/demo-access`)

**Backend**
- Migration `user_can_self_approve`: `User.canSelfApprove Boolean @default(false)` (ghi `database_and_models.md`).
- Bỏ qua luật tự duyệt **chỉ khi** `creator.canSelfApprove`: `features/change-requests/approval.service.ts:239-248` (`decidable`), `shared/change-requests/approval-recorder.ts:78` (`actionableRows`), `routing-planner.ts:150-153` (không skip CREATOR) và `:164-181` (`NO_OTHER_ACADEMIC_OFFICE`). Unit test cả hai nhánh mỗi chỗ (spec hiện có cạnh từng file).
- Script `prisma/demo-account.ts` + `pnpm db:demo-account` (idempotent): upsert user `demo` (họ tên "Tài khoản demo", org unit ACADEMIC_OFFICE), `passwordHash = PasswordService.hash(DEMO_PASSWORD ?? 'demo')` (bỏ qua password-policy có chủ đích, chỉ trong script này), `mustChangePassword=false`, `canSelfApprove=true`, `RoleAssignment` R1–R5 `ScopeType.SYSTEM` (không R6: phạm vi sinh viên luôn rỗng và đổi menu). Cấp 1–2 demo đi qua `override()` sẵn có của R1 (lịch sử ghi "Ghi đè"), cấp 3 duyệt bình thường.
- Chạy trên VM qua đường hầm: `ssh -L 15432:<ip container postgres>:5432`, `DATABASE_URL` lấy từ `/srv/ctdt/demo.env` vào biến shell (không in), chạy script từ máy dev.

**Frontend**
- Cờ build: `src/shared/config/demoFlags.ts` đọc `import.meta.env.VITE_DEMO_LOGIN` (`"demo:demo"`) và `VITE_COMING_SOON` (danh sách: `school-sync,integration-clients,email-reminders,backups`); thêm `src/vite-env.d.ts`. Truyền qua build arg frontend Dockerfile + `deploy/compose.yaml` + `deploy/demo.env.example` (máy dev/production thật không đặt → hành vi cũ).
- `features/auth/pages/LoginPage.tsx`: chia đôi (`/impeccable shape login` trước). Trái: nền gradient `headerFrom→headerTo`, logo `/logo-dut.webp`, tên hệ thống 1 dòng, hình SVG inline "đồ thị học phần" (node + cạnh) có animation nhẹ CSS trên SVG của mình (không lên component AntD), tắt khi `prefers-reduced-motion`. Phải: form giữ nguyên nhãn/nút/Alert (test hiện có không đổi) + khối "Tài khoản demo · demo / demo" với nút "Dùng tài khoản demo" (điền và đăng nhập) chỉ khi có `VITE_DEMO_LOGIN`. ≤ 768 px: panel thành dải trên. Test: nút demo điền + gửi; không cờ thì không hiện.
- "Sắp có": `src/shared/components/ComingSoon.tsx` (trang mô tả: tính năng làm gì, vì sao chưa bật trên demo) + tag "Sắp có" trong `shared/layout/menuItems.tsx` cho `ROUTES.schoolSync`, `integrationClients`, `backups` (route bọc gate khi cờ bật, gồm `schoolSyncRuns*`). Email nhắc việc (không có menu): `Alert` info "Gửi email nhắc việc: Sắp có" trên trang Thông báo + Ủy quyền duyệt. Test gate on/off.

## PR-2 — Sửa UI (`fix/demo-ui-polish`)

- **Ellipsis**: helper `src/shared/design-system/textColumn.tsx` → cột `{ width, ellipsis: { showTitle: false }, render: Typography.Text ellipsis tooltip }`; thêm vào DESIGN_SYSTEM.md. Áp cho ~20 cột text tự do (đại diện: `ChangeRequestListPage.tsx:77`, `ApprovalQueuePage.tsx:38`, `CourseListPage.tsx:99`, `EquivalenceGroupsPage.tsx:123`, `CurriculumTable.tsx:144`, `PloTable.tsx:37`, `ProgramComparisonPage.tsx:66`; danh sách đủ ở báo cáo khảo sát). Bảng Đề xuất: cột Đối tượng cũng cắt 2 dòng. Test helper.
- **Xét tốt nghiệp** `features/graduation/components/GraduationContextForm.tsx:152-159`: Alert + nút trong `Flex vertical gap={16}`.
- **Phân bố tín chỉ** `features/reports/pages/CreditDistributionPage.tsx:116-154`: hàng 1 "Khối kiến thức" | "Loại học phần" (`Col xs=24 xl=12`, Row `align="stretch"`, Card `height:100%`); hàng 2 "Nhóm tự chọn" full; hàng 3 "Theo học kỳ" full. Cột số cùng width (90) căn phải ở mọi bảng, dòng "Tổng" bằng `Table.summary`.
- **So sánh CT** `features/reports/pages/ProgramComparisonPage.tsx`: tab đầu mới "Tất cả" gộp `shared/equivalent/leftOnly/rightOnly` với cột "Khác biệt" là tag chữ ("Chỉ A", "Chỉ B", "Tương đương", "Khác: HK/TC/…"), nền dòng nhạt theo loại (token Soft), ô có giá trị khác in đậm + nền `warnSoft`; công tắc "Chỉ hiện khác biệt"; đếm số khác biệt trên SummaryStrip; hiện `blockSymbol`; sửa tiêu đề cột thừa dấu cách. Test tô/lọc.
- **Quét cùng loại**: `/impeccable audit` các màn chính (CTĐT, đề cương, đề xuất, sinh viên, báo cáo, quản trị) — chỉ sửa nút dính, bảng lệch, chữ tràn; không thiết kế lại.

## PR-3 — Trực quan hóa quy trình đề xuất (`feat/request-progress`)

`/impeccable shape` trước. Cấp thật trong code: Nháp → Cấp 1 Điều phối nhóm (R4) → Cấp 2 Giám đốc CTĐT (R3) → Cấp 3 Phòng Đào tạo (R1) → Đã duyệt → Có hiệu lực (`seed-data/approval-levels.ts`).
- `src/shared/change-requests/requestProgress.ts`: status (+ các bước duyệt nếu có) → danh sách bước {trạng thái: xong/đang/chờ/bỏ qua/dừng}. REJECTED/WITHDRAWN dừng đỏ ở cấp đang xử lý; trả lại = quay về Nháp, ghi "lần N"; đề xuất ORGANIZATION chỉ cấp 3, cấp 1–2 "Bỏ qua". Unit test mọi trạng thái.
- **Chi tiết** (`ChangeRequestDetailPage.tsx:115`): AntD `Steps` ngang trên đầu, mỗi bước có người duyệt/ngày/ghi chú (lấy từ dữ liệu `StepProgress` hiện có); giữ `StepProgress` + `ApprovalHistory` bên dưới.
- **Danh sách** (`ChangeRequestListPage.tsx`, `ApprovalQueuePage.tsx`): cột "Tiến độ" = thanh 6 đoạn nhỏ + nhãn chữ bước hiện tại (không chỉ màu).
- **Khung giải thích**: `Collapse` "Quy trình duyệt hoạt động thế nào?" trên trang danh sách: sơ đồ Steps tĩnh với vai trò từng cấp + 3 dòng (Trả lại → về Nháp; Từ chối → kết thúc; Phòng Đào tạo có thể ghi đè cấp 1–2).

## Dữ liệu demo (sau khi PR-1 lên demo; chạy qua đường hầm, dump trước)

1. `pg_dump -Fc` trên VM → `/srv/ctdt/incoming/before-curate-<time>.dump`.
2. `prisma/demo-curate.ts` (`pnpm db:demo-curate`, có `--dry-run` in số dòng sẽ xóa): xóa con-trước-cha các thực thể do test sinh: CR tiêu đề `^Đề xuất [0-9A-F]{16}$`, `Testing`, `^[0-9A-F]{16}a+$`; Program `^E[PC][0-9A-F]{16}$` + version/director/enrollment/CR/step liên quan; nhóm tương đương rỗng mà tạo bởi test (kiểm `createdBy`/ghi chú trước — nhóm nhập từ dữ liệu Trường thì giữ). Dựa theo thứ tự FK của `prisma/e2e-purge.ts`. Chạy `--dry-run`, xem, rồi chạy thật.
3. Dữ liệu mẫu qua **API thật** (`deploy/scripts/demo-sample-data.mjs`, đăng nhập `demo`, header `X-Requested-With`): 6 đề xuất có tiêu đề nghiệp vụ thật trên 1–2 CTĐT thật, dừng ở Nháp / chờ cấp 1 / cấp 2 / cấp 3 / Đã duyệt / Từ chối (+1 bị trả lại lần 2); 2 nhóm tương đương có học phần thật (cặp học phần cùng nội dung khác mã trong dữ liệu DUT).

## Báo cáo + hướng dẫn trên Google Drive (sau PR-1..3 lên demo)

- Ảnh: Playwright MCP trên link công khai, đăng nhập bằng nút demo, viewport 1440×900, lưu vào scratchpad: login, trang chính, danh sách CTĐT, khung CTĐT, đề cương (CLO/công thức điểm), ma trận PLO–CLO, danh sách đề xuất + tiến độ, chi tiết đề xuất (Steps), phiên bản ban hành/so sánh, phân bố tín chỉ, nhóm tương đương, xét tốt nghiệp, cổng sinh viên, trang "Sắp có".
- Nội dung 8–12 trang, ít chữ: (1) hệ thống làm gì + sơ đồ vai trò R1–R6; (2) đăng nhập demo; (3) mỗi tính năng 1 ảnh + 2–4 gạch "dùng để / bấm ở đâu"; (4) quy trình đề xuất 3 cấp (sơ đồ); (5) thuật ngữ: CTĐT, phiên bản/ban hành, khối kiến thức, PLO/CLO, **Nhóm học phần tương đương** (các học phần được công nhận thay nhau khi xét tốt nghiệp, ví dụ thật), nhóm tự chọn; (6) hạ tầng demo (1 sơ đồ, 0 đ); (7) tính năng "Sắp có".
- Dựng `.docx` bằng skill `anthropic-skills:docx` (ảnh nhúng), tải lên Drive qua `mcp__claude_ai_Google_Drive__create_file` dạng Google Docs, tên "PBL6 – Hệ thống Quản lý CTĐT – Báo cáo & Hướng dẫn sử dụng"; trả link.

## Verification

- Mỗi PR: build-verifier (BE tsc/lint/vitest, FE `tsc -b`/oxlint/vitest), detector impeccable sạch, CI xanh; sau merge CD xanh, `/api/health` ok.
- Playwright MCP trên link công khai: nút "Dùng tài khoản demo" vào được; demo tạo đề xuất → đi hết 3 cấp tới Đã duyệt; Steps/cột tiến độ đúng từng trạng thái mẫu; tiêu đề dài bị "…" có tooltip; Xét tốt nghiệp có khoảng cách; Phân bố TC thẳng hàng 1440 px và 390 px; So sánh có tô + lọc; 4 mục "Sắp có" mở trang mô tả.
- Dữ liệu: `--dry-run` khớp mong đợi; sau curate không còn `Đề xuất <hex>`/`Chương trình thử`; dump trước curate còn trên VM.
- Săn A1: log có dòng chu kỳ ~2–2,5 phút; giả lỗi (`TF_LOG` không cần) — kiểm phân loại bằng 3 log mẫu (capacity/EOF/401) chạy hàm phân loại offline.
- docs-sync sau cùng (progress_log, current_work, todo DEBT-13/15, DESIGN_SYSTEM.md, database_and_models.md).

## Rủi ro

- `demo/demo` toàn quyền trên link công khai: ai cũng có thể sửa/xóa, đổi mật khẩu demo hoặc admin — người dùng chấp nhận; dump trước curate là đường lùi.
- Nhãn "Ghi đè" ở cấp 1–2 khi demo tự đi luồng (dùng cơ chế override sẵn có thay vì gán demo làm điều phối/giám đốc mọi nhóm/CTĐT).
