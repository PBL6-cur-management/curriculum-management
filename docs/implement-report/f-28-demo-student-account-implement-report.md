# F-28 — Báo cáo triển khai tài khoản sinh viên demo

## Trạng thái (viết lại khi có tiến độ mới)

**2026-11-01: DONE — S-01, S-02, S-03 đã triển khai; type-check, lint script và Prettier đạt. Chỉ kiểm tra tĩnh, chưa tạo tài khoản trên CSDL.**

- Người dùng đã sửa dependency và Prisma client trước khi giao tiếp; baseline đo lại sạch. Không chạy lại install hoặc generate.
- Đã tạo script, thêm lệnh package và đồng bộ đủ sáu tài liệu của S-03; Status của plan đã cập nhật. Không sửa schema, migration, frontend hoặc source khác.
- Các phần từ Bảng tổng hợp đến Chưa hoàn thành bên dưới giữ nguyên lịch sử lần bị chặn, không phải trạng thái hiện tại. Phần đính chính và kết quả tiếp tục được nối ở cuối báo cáo.
- Không chạy script demo, migration, seed hay lệnh cần PostgreSQL/Redis; không mở các thư mục dữ liệu nhạy cảm.

## Bảng tổng hợp

| Hạng mục | Kết quả |
|---|---|
| S-01 — `prisma/demo-student.ts` | Chưa tạo; bị chặn bởi baseline type-check |
| S-02 — `db:demo-student` | Chưa thêm script vào `package.json` |
| S-03 — Tài liệu phạm vi và vận hành | Chưa sửa; không ghi nhận triển khai khi chưa có mã |
| Báo cáo | Chỉ tạo báo cáo blocker này |

## S-01 — Script sinh viên demo

Chưa triển khai. `tsconfig.json` không có `include`/`exclude`, nên lệnh kiểm tra đã bao phủ `prisma/`, gồm script mẫu `demo-account.ts`; không cần một lệnh TypeScript riêng cho script.

Baseline chạy từ `source/backend`, trước mọi chỉnh sửa:

| Lệnh | Exit code | Kết quả |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 2 | Lỗi có sẵn: thiếu `mssql` và nhiều kiểu/model Prisma không khớp các file đang dùng, gồm `ApprovalDelegationStatus`, `EmailDeliveryStatus`, `canSelfApprove`, `integrationClient`, `schoolSyncConfiguration` |
| `pnpm exec oxlint prisma/demo-student.ts` | 1 | `No files found to lint. Please check your paths and ignore patterns.` |
| `pnpm exec prettier --check prisma/demo-student.ts package.json` | 2 | Không tìm thấy `prisma/demo-student.ts`; các file khớp pattern hiện có đúng định dạng |

Lần chạy lại đúng lệnh TypeScript để lấy 30 dòng cuối vẫn lỗi, shell ghi exit code 1. Các lỗi này xuất hiện trước khi tạo bất kỳ source mới nào, không phải kết luận về chất lượng script chưa được viết. Lint/Prettier chưa thể xác minh file chưa tồn tại.

## S-02 — Lệnh package

Chưa triển khai. Giữ nguyên `source/backend/package.json`; không chạy `pnpm db:demo-student` vì chưa có script và môi trường không có PostgreSQL.

## S-03 — Tài liệu phạm vi

Chưa triển khai. Giữ nguyên REQUIREMENTS §12, plan.md Q14/M9, hướng dẫn vận hành và ba tài liệu tiến độ. Status của implementation plan vẫn là `Not started`.

## Deviations

- Dừng trước S-01 theo điều kiện STOP AND REPORT khi type-check lỗi ở các file không thuộc phạm vi chỉnh sửa; không bỏ qua baseline đỏ để tiếp tục.
- Chưa phát hiện mâu thuẫn làm thay đổi hành vi giữa plan và schema/script mẫu trong phần đối chiếu trước khi dừng.

## Borderline calls

- Vẫn tạo báo cáo blocker được cho phép trong scope; không đổi Status của plan vì chưa bắt đầu triển khai.
- Chạy baseline lint và Prettier dù file mới chưa tồn tại để ghi nhận đúng trạng thái ban đầu; lỗi thiếu file không được trình bày như lỗi source.

## Escalations

- **Đã làm:** đọc plan/script mẫu, đối chiếu model, đo baseline và ghi báo cáo. **Vướng:** type-check có sẵn lỗi ở source ngoài scope. **Lựa chọn:** chủ repo sửa môi trường/dependency/Prisma client rồi giao chạy lại; hoặc phê duyệt riêng việc tiếp tục trên baseline đỏ. **Đề xuất:** kiểm tra dependency và đồng bộ Prisma client với schema trong một tác vụ riêng, chạy lại baseline cho sạch rồi tiếp tục S-01–S-03. Không tự thêm dependency, generate client hay sửa các file ngoài scope.

## Chưa hoàn thành

- Toàn bộ S-01, S-02, S-03 và các kiểm tra sau triển khai.
- Chạy script hai lần, kiểm tra học kỳ thực tế, đăng nhập và xác minh portal/eligibility/graduation: người dùng thực hiện sau khi có mã và PostgreSQL hoạt động.

## Đính chính baseline và kết quả tiếp tục — 2026-11-01

### Đính chính blocker trước đó

Phiên điều phối xác nhận lỗi baseline xuất phát từ `node_modules` và Prisma client được sinh đã lỗi thời; đã chạy `pnpm install --frozen-lockfile` và `pnpm exec prisma generate` trong backend trước khi giao tiếp. Đợt này không chạy lại hai lệnh đó. Đo lại trước chỉnh sửa: `pnpm exec tsc --noEmit -p tsconfig.json` exit 0, không có output. Blocker cũ đã được gỡ, không phải lỗi source cần sửa trong F-28.

Baseline lint vẫn exit 1 do chưa có file mới, output `No files found to lint. Please check your paths and ignore patterns.`; baseline Prettier exit 2 với output:

```text
Checking formatting...
[error] No files matching the pattern were found: "prisma/demo-student.ts".
All matched files use Prettier code style!
```

### Bảng tổng hợp hiện tại

| Hạng mục | Kết quả |
|---|---|
| S-01 | Đã có `source/backend/prisma/demo-student.ts`; kiểm tra tĩnh đạt |
| S-02 | Đã thêm đúng một dòng `db:demo-student` sau `db:demo-syllabi` trong `package.json` |
| S-03 | Đã cập nhật REQUIREMENTS §12 mục 7, plan.md M9/Q14, hướng dẫn vận hành và ba tài liệu tiến độ |
| Status của plan | Implemented; ghi rõ chưa kiểm tra CSDL/API |
| Runtime/deploy | Không chạy; người vận hành thực hiện sau |

### S-01 — Kết quả triển khai

- Mirror `demo-account.ts`: `dotenv/config`, adapter `PrismaPg`, chuẩn hóa username, hash bằng `PasswordService`, ngày Việt Nam qua `todayDate`, log tiếng Việt, lỗi được throw và luôn disconnect. Mặc định `demo.sinhvien` / `demo`, `DEMO_SV`, `DEMOSV001`, tên/email tổng hợp; không thêm RoleAssignment, vai trò sinh viên đi qua `Student.userId`.
- Bốn biến môi trường giữ nguyên tên theo plan. Mẫu là ACTIVE PRIMARY không ngoại lệ, học kỳ bắt đầu đã đến; loại hồ sơ demo khỏi tập mẫu để lần chạy sau không tự lấy mẫu. Chỉ select bốn trường `cohortId`, `admissionSemesterId`, `statusSemesterId`, `major` của sinh viên mẫu, không đọc tên/mã/email/kết quả thật.
- Mặc định cần ít nhất 4 kỳ thường đã bắt đầu, ưu tiên mã chứa `CNTT`, rồi số sinh viên trong nhóm chương trình/khóa, hòa thì mã chương trình/khóa. Cache danh sách học kỳ theo `fromSemesterId`; thêm ID để chọn một đăng ký ổn định khi cùng nhóm. Khi có biến chọn chương trình hoặc khóa, lọc mã chính xác và cần ít nhất một kỳ đã bắt đầu; thông báo không có mẫu liệt kê các mã chương trình đang có.
- Chỉ kỳ thường 1/2, có ngày, không sớm hơn học kỳ bắt đầu; chỉ lấy môn bắt buộc, sắp `plannedSemester`/ID. Kỳ mới nhất đã bắt đầu có IN_PROGRESS/null điểm; môn đầu tiên kỳ đầu có FAILED/3.5; các môn còn lại dùng dãy điểm và bảng DUT đúng plan, lưu Decimal; tự chọn/tương lai không có hàng.
- User/Student upsert và xóa/tạo lại toàn bộ kết quả/đăng ký trong một transaction. Lỗi P2003 báo rõ audit, lịch sử kết quả hoặc bản ghi tham chiếu khác và rollback. Kiểm tra trùng username/mã liên kết trước ghi để không ghi đè tài khoản không phải demo; không xóa dữ liệu tham chiếu.

### S-02 — Kết quả triển khai

`db:demo-student` ánh xạ `tsx prisma/demo-student.ts`, đặt ngay sau `db:demo-syllabi`. Không thay dòng package khác, không thêm dependency/lockfile. Không chạy lệnh này vì cần PostgreSQL.

### S-03 — Kết quả triển khai

- REQUIREMENTS chỉ đổi hàng §12 mục 7: phần thay thế dDUT vẫn ngoài phạm vi, ngoại lệ F-28 chỉ demo qua API/cookie, app ở repo riêng `dut_curriculum_app`.
- plan.md chỉ bổ sung quyết định ở M9 và Q14; không thêm nghiệp vụ backend hoặc Microsoft/Office 365 login.
- Hướng dẫn vận hành bổ sung lệnh, bốn biến môi trường, quy tắc mẫu/điểm, cảnh báo mật khẩu công khai, rollback khi có tham chiếu, chạy lại sau rebuild/restore và các bước kiểm tra thủ công.
- progress_log nối thêm mục mới; current_work và todo ghi backend hoàn tất nhưng chưa chạy CSDL/API, app thuộc repo khác. Không ghi nhận đã deploy hoặc đã tạo tài khoản.

### Kiểm tra sau triển khai

Chạy từ `source/backend`:

| Lệnh | Exit code | Output |
|---|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | Không có output; bao phủ `prisma/` và script mẫu |
| `pnpm exec oxlint prisma/demo-student.ts` | 0 | Không có output |
| `pnpm exec prettier --check prisma/demo-student.ts package.json` | 0 | `Checking formatting...` rồi `All matched files use Prettier code style!` |

Lần kiểm tra đầu sau tạo script phát hiện lỗi suy luận kiểu `flatMap` chỉ ở file mới và một số định dạng; đã khai báo generic `Prisma.AcademicResultCreateManyInput` và áp dụng định dạng Prettier qua patch, sau đó cả ba lệnh đều qua. Không có lỗi mới ở file ngoài scope.

### Deviations hiện tại

- Các bước xác minh CSDL và điểm dừng sau S-02 của plan được hoãn theo brief chỉ kiểm tra tĩnh; S-03 hoàn tất mà không chờ CSDL.
- Không ghi marker `.codex/.last-docs-sync` của skill đồng bộ tài liệu vì ngoài allowlist; không sửa error_log vì blocker đã được người dùng xử lý ngoài tác vụ này.
- Không có mâu thuẫn schema/script mẫu cần đổi hành vi, không cần migration hay dependency mới.

### Borderline calls hiện tại

- Biến mã tường minh có thể chọn mẫu mới hơn bốn kỳ: ngưỡng bốn kỳ là quy tắc mặc định; vẫn phải có kỳ thường đã bắt đầu. Nếu chỉ có một kỳ, nhánh IN_PROGRESS được ưu tiên đúng thứ tự generator trong plan, nên chưa có môn FAILED/PASSED.
- Đếm độ đông theo nhóm chương trình/khóa trong tập đăng ký đủ điều kiện; hòa hoàn toàn thì dùng ID đăng ký ổn định.
- Từ chối ghi đè khi username hiện có không mang `DEMO_SV` hoặc hồ sơ demo đang liên kết tài khoản khác. Giữ mã tài khoản cố định: đổi username sau lần tạo đầu có thể bị unique constraint chặn an toàn thay vì âm thầm chuyển tài khoản.
- Giữ hàng 7 trong bảng loại trừ, đổi tên thành phần thay thế dDUT (vẫn bị loại trừ) và diễn đạt ngoại lệ demo ở cột lý do để không mâu thuẫn tiêu đề bảng.

### Escalations hiện tại

Không có blocker cần quyết định mới. Kiểm tra dữ liệu thực tế thuộc bước vận hành tiếp theo, không được tự chạy trong tác vụ này.

### Chưa làm hiện tại

- Truy vấn kiểm tra `termInYear` trong CSDL, chạy script hai lần, đăng nhập và gọi portal/registration-eligibility/graduation, xác nhận số kết quả và khả năng sống qua curate/rebuild trên CSDL thật.
- Deploy VM và triển khai app mobile ở repo riêng không thuộc tác vụ này.
