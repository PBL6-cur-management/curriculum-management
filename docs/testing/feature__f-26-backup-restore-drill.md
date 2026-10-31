# Feature F-26 Sao lưu và diễn tập phục hồi

**Type:** Feature
**Branch / PR:** `feat/f-26-backup-restore-drill`
**Source files under test:**
- `source/backend/src/shared/backups/` (engine, store, config, verifier, drill)
- `source/backend/src/features/backups/` (scheduler, processor, API)
- `source/backend/scripts/backup-restore-drill.ts` (CLI `pnpm backup:drill`)
- `source/frontend/src/features/backups/pages/BackupsPage.tsx`

F-26 sao lưu cơ sở dữ liệu và thư mục tệp mỗi ngày, giữ 30 bộ, cho phép diễn tập phục hồi vào môi trường tách biệt và chỉ **đọc** kết quả trên trang `/operations/backups`. Quy trình vận hành đầy đủ ở [sổ tay](../technical/backup-restore-runbook.md).

---

## Automated coverage

| Test file | What it covers | Gap (needs manual) |
|---|---|---|
| `source/backend/src/features/backups/backups.service.spec.ts` | `computeStatus`: tắt, sẵn sàng, quá hạn, đang chạy, quá hạn thời gian, lỗi cũ/mới hơn lần thành công, bộ chưa công bố, lỗi dọn bộ cũ, bậc/thời gian phục hồi đã nghiệm thu | Giờ thật, 7 đêm liên tiếp |
| `source/backend/test/backups.e2e-spec.ts` | API trên PostgreSQL + Redis thật: R1 đọc được, R2/ẩn danh bị chặn; sắp xếp, lọc, phân trang; số byte chính xác dạng chuỗi; DTO không lộ cơ sở dữ liệu/máy chủ/đường dẫn đích; GET không ghi gì; 503 khi danh mục hỏng | Không chạy `pg_dump`/`pg_restore` thật (BACKUP_ENABLED=false) |
| `source/backend/test/permission-table.e2e-spec.ts` | 3 điểm cuối `backup.view`: R1 được, R2 bị từ chối | Cấp quyền theo phạm vi/VIA_REQUEST |
| `source/backend/prisma/seed-data/permission-catalog.spec.ts` | Danh mục quyền có `backup.view` | |
| `source/backend/scripts/backup-restore-drill.spec.ts` | CLI: phân tích tham số chặt, thiếu biến môi trường, `--help` không cần thông tin đăng nhập, `inspect` chạy không cần môi trường | Lệnh `restore`/`verify`/`accept` thật |
| `source/frontend/src/features/backups/utils/format.test.ts` | `null` khác `0`, mốc ms/giây/phút, byte vượt `Number.MAX_SAFE_INTEGER`, chuỗi không hợp lệ | |
| `source/frontend/src/features/backups/pages/BackupsPage.test.tsx` | Tóm tắt, không có nút phục hồi/chạy/tải/xóa, cảnh báo khi tắt, mã lỗi, RESTORED khác SUCCEEDED, lọc đặt lại về trang 1, lỗi tải lại được, 403 | Khoảng trống dưới |
| `source/frontend/src/shared/layout/menuItems.test.tsx` | Mục menu chỉ hiện với `backup.view` | |

**Chưa có test tự động (khoảng trống đã biết, không tính là đạt):**
- Chạy engine thật: `pg_dump`/`pg_restore`, ranh giới ảnh chụp, khóa tư vấn, giữ 30 bộ, crash giữa công bố và dọn bộ, hai engine cùng một gốc.
- Phục hồi thật vào cơ sở dữ liệu trống và so sánh nội dung phiên bản đã ban hành (BE-08 mục 1 đến 7 của kế hoạch).
- Spec cho `restore-drill`, `restore-verifier`, `upgrade-verifier`, `backup-store`, `backup-config`.
- **Lý do:** máy phát triển hiện chưa cài bộ công cụ khách PostgreSQL 18 bản native (chỉ có trong container). Đây là **chặn do môi trường**, không phải kết quả đạt hay không đạt của mã. Cần cài PostgreSQL 18 client rồi viết `test/backup-restore.e2e-spec.ts`.

---

## Manual test cases

Điều kiện chung: `BACKUP_ENABLED=true`, `BACKUP_ROOT` trên ổ khác `FILES_ROOT`, PostgreSQL client 18, tài khoản R1 và một tài khoản R2.

| # | Precondition | Steps | Expected result | Service action needed | Result |
|---|---|---|---|---|---|
| 1 | Mới cài, chưa bật sao lưu | Mở `/operations/backups` bằng R1 | Trạng thái **Đã tắt**, có cảnh báo "Dữ liệu chưa được bảo vệ", bảng trống "Chưa có bản sao lưu nào" | none | ☐ |
| 2 | Bật sao lưu, khởi động lại backend | Đợi lần chạy khi khởi động hoàn tất, tải lại trang | Có một dòng **Đã sao lưu** với số tệp, dung lượng, số phiên bản đã ban hành; trạng thái **Sẵn sàng**; số bộ `1 / 30` | none | ☐ |
| 3 | Đã có bộ sao lưu | Mở rộng một dòng | Hiện mã bộ, giờ bắt đầu, dung lượng tệp, "Lỗi: Không có" | none | ☐ |
| 4 | Tài khoản R2 | Vào thẳng `/operations/backups` và gọi `GET /api/operations/backups/status` | Trang báo không có quyền; API trả 403; menu không có mục | none | ☐ |
| 5 | Gỡ quyền `backup.view` của một vai trò đã có | Tải lại trang bằng tài khoản đó | Trang báo không có quyền, không còn dữ liệu cũ | none | ☐ |
| 6 | Làm đầy ổ `BACKUP_ROOT` | Đợi tới 02:00 | Lần chạy **Sao lưu thất bại** có mã và thông báo, bộ cũ vẫn nguyên, trạng thái **Sao lưu thất bại** | giả lập ổ đầy | ☐ |
| 7 | Tắt backend qua 02:00 rồi bật lại sau hơn 2 giờ | Mở trang | Có lần chạy bù cho giờ hẹn gần nhất; trong lúc chưa xong trạng thái **Quá hạn sao lưu** | none | ☐ |
| 8 | Bảy đêm liên tiếp thật | Mỗi sáng mở trang | Bảy dòng liên tiếp **Đã sao lưu**, không có ngày thiếu | none | ☐ |
| 9 | Đã có 31 bộ | Đếm số bộ sau lần chạy thứ 31 | Còn đúng 30 bộ mới nhất; bộ cũ nhất chuyển **Đã hết thời hạn lưu**; bằng chứng được giữ | none | ☐ |
| 10 | Có một bộ tốt, đã chuẩn bị cơ sở dữ liệu `ctdt_restore_drill_*` trống và thư mục trống | `pnpm backup:drill restore --backup-id … --tier B4 --operator …` | Mã thoát 0, trạng thái **Đã phục hồi — chờ nghiệm thu**, có `recoveryMs` và thời gian từng giai đoạn; cơ sở dữ liệu và tệp thật không đổi | none | ☐ |
| 11 | Như 10 nhưng đích có bảng sẵn, hoặc tên không khớp mẫu, hoặc trùng cơ sở dữ liệu thật | Chạy `restore` | Bị từ chối với thông báo đích không an toàn; kiểm tra đích không bị ghi thêm gì và cơ sở dữ liệu thật không đổi | none | ☐ |
| 12 | Biên bản ở trạng thái **chờ nghiệm thu** | Đi thử B4 trên ứng dụng cách ly, rồi `pnpm backup:drill accept … --result passed --note …` | Trạng thái **Đã nghiệm thu phục hồi**, `acceptedAt` khác thời gian phục hồi, `recoveryMs` không đổi | none | ☐ |
| 13 | Đã nghiệm thu | Làm hỏng một tệp trong thư mục đích, chạy `pnpm backup:drill verify --drill-id …` | Mã thoát 1; biên bản chuyển **Phục hồi thất bại** | none | ☐ |
| 14 | Có một bộ đã sao chép ra ngoài | `pnpm backup:drill inspect --set-directory …` khi **tắt** cơ sở dữ liệu và Redis | Mã thoát 0, in `valid: true`; sửa một byte trong `database.dump` thì lỗi `checksum` | tắt PostgreSQL và Redis | ☐ |
| 15 | Trước một lần nâng cấp bậc | `capture-upgrade`, chạy migration mới, `compare-upgrade` | `PASSED` khi chỉ thêm migration; `FAILED` (mã thoát 1) khi sửa nội dung phiên bản đã ban hành | none | ☐ |
| 16 | Người vận hành khác chưa từng làm | Chỉ dùng sổ tay để phục hồi vào máy thay thế từ bộ đã tách (mục 6) | Hoàn tất không cần lệnh nào ngoài sổ tay | none | ☐ |
| 17 | Mỗi bậc B4, B5, B6 | Một diễn tập đã nghiệm thu cho từng bậc | Bảng diễn tập có đủ biên bản; bậc chưa làm được ghi vào nợ phát hành | none | ☐ |
| 18 | Đã sao chép hằng tuần | Hoàn tất mục 4 của sổ tay | Có phiếu ghi ngày, người thực hiện, mã bộ, nhãn nơi đích, kết quả `inspect` | none | ☐ |

---

## Notes / known issues

- Ca 6 đến 9, 16 đến 18 là nghiệm thu vận hành thật, **không** thể đóng bằng chạy test. Chưa có ca nào được chạy.
- Ca 10 đến 15 cần PostgreSQL client 18 và một cơ sở dữ liệu diễn tập; chưa thực hiện trên máy phát triển.
- Chưa có RTO được duyệt. Con số 30 phút là giới hạn an toàn của một thao tác.
- Nơi lưu ngoài hằng tuần là nghĩa vụ vận hành chưa có tự động hóa; cần Khoa duyệt nơi đích và cách truyền.
