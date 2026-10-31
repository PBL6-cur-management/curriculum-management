# Sổ tay vận hành: sao lưu và diễn tập phục hồi (F-26)

Dành cho người vận hành hệ thống. Chỉ dùng được sau khi F-26 đã được triển khai (`BACKUP_ENABLED=true`).
Mọi lệnh chạy từ `source/backend`, trong PowerShell, với **biến môi trường đặt trong tiến trình**: không truyền mật khẩu qua tham số dòng lệnh và không đưa mật khẩu vào ảnh chụp màn hình.

## Phạm vi và giới hạn

| Hệ thống làm | Hệ thống không làm |
|---|---|
| Mỗi ngày 02:00 (giờ `Asia/Ho_Chi_Minh`) sao lưu **cơ sở dữ liệu và thư mục tệp đính kèm** thành một bộ không đổi, giữ 30 bộ gần nhất | Không sao chép ra nơi ngoài; không chứng nhận ổ đĩa khác nhau |
| Trang `/operations/backups` (quyền `backup.view`, mặc định R1) chỉ **đọc** trạng thái và biên bản diễn tập | Trang không phục hồi, không tải bản sao, không chạy hay xóa sao lưu |
| CLI `pnpm backup:drill` phục hồi vào **cơ sở dữ liệu diễn tập trống** và thư mục mới, rồi kiểm tra tự động | Không bao giờ ghi vào cơ sở dữ liệu thật; không `DROP`, `--clean` hay xóa đệ quy trên đường dẫn do người vận hành đưa vào |

Chính sách cố định (không phải tùy chọn cấu hình): lịch `0 2 * * *`, giữ 30 bộ, tối đa 6 lần thử mỗi lần chạy (chờ tăng gấp đôi dần, bắt đầu từ 60 giây), giới hạn an toàn 30 phút cho một thao tác, cảnh báo **Quá hạn** sau 2 giờ kể từ giờ hẹn mà chưa có bộ hoàn tất. Con số 30 phút là mức chặn an toàn, **không phải** mục tiêu thời gian phục hồi (RTO) đã được duyệt.

`recoveryMs` trên trang được đo từ lúc bắt đầu kiểm tra bộ sao lưu đến khi kiểm tra tự động xác nhận dữ liệu sẵn sàng. Thời gian đi thử B4 bằng tay (nghiệm thu) có mốc riêng `acceptedAt`, không cộng vào `recoveryMs`.

## Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `BACKUP_ENABLED` | `true` để bật lịch sao lưu | `false` |
| `BACKUP_ROOT` | Thư mục lưu các bộ sao lưu: đường dẫn tuyệt đối, **khác ổ đĩa** với `FILES_ROOT` | không có |
| `FILES_ROOT` | Thư mục tệp đính kèm đang chạy | theo `.env` của ứng dụng |
| `PG_DUMP_PATH`, `PG_RESTORE_PATH` | Đường dẫn công cụ PostgreSQL **18** | `pg_dump`, `pg_restore` |
| `RESTORE_DRILL_DATABASE_URL` | Cơ sở dữ liệu diễn tập (chỉ cho `restore`, `verify`) | **không có mặc định** |
| `RESTORE_DRILL_FILES_ROOT` | Thư mục cha trống cho tệp diễn tập (chỉ cho `restore`) | **không có mặc định** |

## 1. Chuẩn bị máy chủ

1. Cài bộ công cụ khách PostgreSQL **18** trên máy chạy backend và kiểm tra:
   ```powershell
   & $env:PG_DUMP_PATH --version
   & $env:PG_RESTORE_PATH --version
   ```
   Cả hai phải báo phiên bản 18. Khác phiên bản, trang báo `BACKUP_TOOL_VERSION_MISMATCH`.
2. Tạo `BACKUP_ROOT` trên **ổ đĩa vật lý khác** `FILES_ROOT`. Ghi lại ổ nào chứa thư mục nào; đừng suy ra từ tên đường dẫn. Hệ thống từ chối gốc ổ đĩa, liên kết (junction/symlink) và thư mục nằm trong `FILES_ROOT`.
3. Cấp quyền: tài khoản dịch vụ có đọc/ghi `BACKUP_ROOT` và đọc `FILES_ROOT`; không ai khác. Trên Windows dùng ACL, trên Linux `chmod 700`.
4. Còn trống ít nhất bằng 2 lần dung lượng cơ sở dữ liệu cộng thư mục tệp (một bộ đang ghi dở và một bộ cũ chờ xóa).
5. Đặt biến môi trường trong tiến trình dịch vụ. Không ghi mật khẩu vào tài liệu hay lịch sử lệnh.

## 2. Bật lịch và quan sát bộ đầu tiên

1. Đặt `BACKUP_ENABLED=true` và `BACKUP_ROOT`, khởi động lại backend. Khi đã bật mà thiếu `BACKUP_ROOT` hoặc công cụ sai, lịch không chạy và trang báo lý do.
2. Mở `/operations/backups` bằng tài khoản R1. Các trạng thái:

   | Trạng thái | Nghĩa | Việc cần làm |
   |---|---|---|
   | Đã tắt | `BACKUP_ENABLED` không phải `true` | Bật theo bước 1; dữ liệu **chưa** được bảo vệ |
   | Sẵn sàng | Giờ hẹn gần nhất đã có bộ hoàn tất | Không |
   | Đang sao lưu | Một lần chạy còn trong giới hạn thời gian | Chờ |
   | Quá hạn sao lưu | Quá 2 giờ sau giờ hẹn mà chưa có bộ | Xem mục 3 |
   | Sao lưu thất bại | Lần lỗi mới hơn lần thành công gần nhất | Xem mục 3 |

   Những ngày đầu số bộ đang lưu dưới 30 là bình thường (đang đầy dần), không phải lỗi.
3. Mở một dòng trong bảng **Bản sao lưu**: có số tệp, dung lượng, số phiên bản đã ban hành và mã lỗi nếu có.
4. Mở trang chỉ để xem không bao giờ kích hoạt sao lưu, xóa hay phục hồi.

## 3. Xử lý khi sao lưu lỗi

Đừng xóa bộ tốt nào. Đọc `code` và `message` trên dòng lỗi:

| Mã | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `BACKUP_TOOL_UNAVAILABLE` / `BACKUP_TOOL_VERSION_MISMATCH` | Chưa cài hoặc sai bản PostgreSQL client | Cài bản 18, sửa `PG_DUMP_PATH`, `PG_RESTORE_PATH` |
| `BACKUP_ROOT_INVALID` | Thư mục là liên kết, gốc ổ đĩa, hoặc nằm trong `FILES_ROOT` | Chọn thư mục riêng trên ổ khác |
| `BACKUP_NOT_CONFIGURED` | Bật mà chưa đặt `BACKUP_ROOT` | Đặt biến rồi khởi động lại |
| `DUMP_FAILED` | `pg_dump` thoát lỗi (hết dung lượng, mất kết nối) | Kiểm tra ổ đĩa và kết nối, lần chạy sau tự thử lại |
| Hết dung lượng | Ổ `BACKUP_ROOT` đầy | Giải phóng chỗ hoặc mở rộng ổ; **không** xóa tay thư mục `sets/` |

Cách hệ thống tự hồi phục:
- **Thử lại**: mỗi lần chạy thử tối đa 6 lần. Lần lỗi vẫn để lại bản ghi, không làm mất bộ tốt.
- **Bù giờ hẹn**: mỗi lần backend khởi động có thêm một lần chạy tính giờ hẹn gần nhất đã đến hạn; nếu bộ của giờ hẹn đó đã có thì giữ nguyên, nếu chưa có thì tạo (chỉ giờ hẹn gần nhất, không chạy bù nhiều ngày).
- **Gián đoạn**: tiến trình chết giữa chừng thì lần chạy bị đánh dấu *Bị gián đoạn* khi hệ thống dọn dẹp có khóa; thư mục tạm `.staging` chỉ được hệ thống tự xóa.
- **Giữ 30 bộ**: bộ thứ 31 chỉ được loại sau khi bộ mới đã công bố. Lỗi khi loại bộ cũ không làm bộ mới mất giá trị.

## 4. Sao chép hằng tuần ra nơi ngoài (nghĩa vụ vận hành)

Hệ thống **không** tự sao chép ra ngoài và không biết nơi đích. Cho đến khi Khoa duyệt nơi lưu và cách truyền, đây là việc người vận hành làm bằng tay.

1. Chọn **một bộ đã hoàn tất** (trạng thái *Đã sao lưu*) trong `BACKUP_ROOT\sets\daily-YYYY-MM-DD`. Không sao chép thư mục `.staging`.
2. Sao chép nguyên thư mục bộ đó, kèm `manifest.json`, và các biên bản `drills\` liên quan sang nơi lưu đã duyệt. Không dùng chế độ "đồng bộ có xóa" (mirror/delete) và không xóa nguồn.
3. Chạy `inspect` trên **bản đã sao chép** để chắc nó nguyên vẹn:
   ```powershell
   pnpm backup:drill inspect --set-directory "<thư mục bộ đã sao chép>"
   ```
4. Ghi phiếu: ngày, người thực hiện, mã bộ (`daily-…`), nhãn nơi đích, kết quả `inspect`.

## 5. Diễn tập phục hồi vào môi trường tách biệt

Mục đích: chứng minh một bộ sao lưu thực sự phục hồi được. Một bản sao lưu thành công **chưa phải** là diễn tập.

1. Chuẩn bị đích (việc của người vận hành, hệ thống không tự tạo):
   - Cơ sở dữ liệu PostgreSQL 18 **trống**, collation ICU `vi-VN`, tên khớp `ctdt_restore_drill_<tên>` và **khác** cơ sở dữ liệu thật.
   - Một thư mục **trống**, đường dẫn tuyệt đối, tách rời `FILES_ROOT` và `BACKUP_ROOT` (không là cha hay con của chúng, không phải liên kết).
2. Đặt biến đích trong tiến trình:
   ```powershell
   $env:RESTORE_DRILL_DATABASE_URL = "<postgresql://người-dùng-diễn-tập@máy-chủ/ctdt_restore_drill_b4>"
   $env:RESTORE_DRILL_FILES_ROOT   = "<đường dẫn thư mục cha trống>"
   ```
3. Phục hồi (chọn bậc đang nghiệm thu, ví dụ `B4`):
   ```powershell
   pnpm backup:drill restore --backup-id daily-2026-10-25 --tier B4 --operator "Người vận hành"
   ```
   Kết quả `RESTORED` nghĩa là phục hồi và kiểm tra tự động đạt, **chưa phải** nghiệm thu. Lệnh in `recoveryMs` và thời gian từng giai đoạn (cơ sở dữ liệu, tệp, kiểm tra). Thất bại thì giữ nguyên đích để chẩn đoán; hệ thống không tự dọn.
4. Chạy lại kiểm tra bất cứ lúc nào (ví dụ sau nâng cấp), không đặt lại đồng hồ phục hồi:
   ```powershell
   pnpm backup:drill verify --drill-id <mã-diễn-tập>
   ```
   Nếu kiểm tra lại thất bại trên biên bản đã nghiệm thu, biên bản chuyển sang `FAILED`.
5. Đi thử B4 trên ứng dụng cách ly: `FILES_ROOT` trỏ vào **thư mục con do diễn tập tạo ra** (xem trong biên bản), cơ sở dữ liệu trỏ vào đích diễn tập, Redis riêng, chỉ lắng nghe loopback. Kiểm tra **trước khi** khởi động ứng dụng cách ly nếu cần so dấu vân tay chính xác, vì lúc khởi động hệ thống có thể kích hoạt các phiên bản đến hạn.
6. Nghiệm thu bằng tay, ghi bằng chứng thực:
   ```powershell
   pnpm backup:drill accept --drill-id <mã-diễn-tập> --operator "Người nghiệm thu" --result passed --note "Đã đi thử các kịch bản B4; biên bản lưu tại <nơi quy định>"
   ```
   Chỉ nghiệm thu được biên bản `RESTORED` có mọi kiểm tra đạt. `--result failed` đưa biên bản sang `FAILED`. Không suy ra nghiệm thu từ mã thoát bằng 0.
7. Dọn đích là việc **riêng, có chủ đích** của người vận hành: kiểm tra lại tên cơ sở dữ liệu và đường dẫn đã giải quyết rồi mới xóa. Tài liệu này không đưa lệnh xóa tự động.

## 6. Sự cố thật: phục hồi từ bộ đã tách rời

Khi cơ sở dữ liệu, Redis hoặc API gốc không còn dùng được. Làm trên **máy thay thế** đã chuẩn bị riêng.

1. Lấy bộ đã sao chép ra ngoài (mục 4) và xác thực **không cần cơ sở dữ liệu, Redis hay bí mật ứng dụng**:
   ```powershell
   pnpm backup:drill inspect --set-directory "<thư mục bộ>"
   ```
   Không qua được thì dùng bộ gần nhất khác; không sửa tay nội dung bộ.
2. Dựng PostgreSQL 18 trống (ICU `vi-VN`), tạo vai trò ứng dụng ít đặc quyền. `pg_dump` không mang theo vai trò toàn cụm hay bí mật; phải cấp phát riêng.
3. Phục hồi cơ sở dữ liệu bằng biến libpq của máy đích, không thêm cờ `--clean` hay `--create`:
   ```powershell
   $env:PGHOST="<máy-chủ>"; $env:PGPORT="5432"; $env:PGDATABASE="<csdl-trống>"; $env:PGUSER="<người-dùng>"; $env:PGPASSWORD="<đặt-trong-tiến-trình>"
   & $env:PG_RESTORE_PATH --single-transaction --no-owner "<thư mục bộ>\database.dump"
   Remove-Item Env:PGPASSWORD
   ```
4. Chép thư mục tệp giữ nguyên đường dẫn tương đối vào `FILES_ROOT` mới (rỗng):
   ```powershell
   Copy-Item -Recurse "<thư mục bộ>\files\*" "<FILES_ROOT mới>"
   ```
5. Đối chiếu số phiên bản đã ban hành, tệp được tham chiếu, bộ sắp xếp ICU và migration: dùng cùng quy trình mục 5 trên cơ sở dữ liệu vừa dựng, hoặc chạy `verify` nếu đã có biên bản diễn tập tương ứng.
6. Khôi phục cấu hình và bí mật từ nơi cất riêng; khởi động **chỉ** ứng dụng thay thế, đi thử B4, hủy phiên đăng nhập cũ theo quy trình sự cố đã duyệt, rồi chuyển lưu lượng khi người vận hành đồng ý. Tính năng này không tự thay thế môi trường sản xuất.

## 7. Trước và sau mỗi lần nâng cấp bậc

Dừng ghi và dừng worker của ứng dụng trước khi chụp.

1. Chụp đường cơ sở **ngay trước** nâng cấp (không dùng bộ sao lưu ngày hôm qua thay thế):
   ```powershell
   pnpm backup:drill capture-upgrade --operator "Người vận hành"
   ```
   Ghi lại `id` bản ghi (`BASELINE`).
2. Chạy migration đã duyệt, **chưa** bật lại ghi/worker.
3. So sánh:
   ```powershell
   pnpm backup:drill compare-upgrade --evidence-id <mã>
   ```
   `PASSED` cho phép thêm migration đã hoàn tất; thất bại nếu checksum nền thay đổi hoặc thiếu, có migration dở, hoặc nội dung đã ban hành đổi (kể cả khi số bản ghi bằng nhau). Mã thoát 1 khi không đạt.
4. Giữ nguyên bản sao lưu gốc cho đến khi so sánh và đi thử xong. Đường cơ sở không bao giờ bị ghi đè bằng dữ liệu sau nâng cấp.

## 8. Biên bản theo bậc triển khai

- Mỗi bậc đã giao (B1…B6) cần **một biên bản diễn tập đã nghiệm thu** của chính bậc đó. Bắt đầu bằng B4 hiện tại, lặp lại ở B5 và B6.
- Không điền ngược biên bản B1/B2/B3 chỉ vì các tính năng đó đã có. Bậc chưa diễn tập ghi vào **nợ phát hành** kèm người chịu trách nhiệm.
- Bảng *Diễn tập phục hồi* hiển thị bậc, người thực hiện, trạng thái, `recoveryMs` (kèm nhãn "Thời gian phục hồi dữ liệu và kiểm tra tự động"), các giai đoạn, kết quả kiểm tra và thông tin nghiệm thu. Hệ thống không có bảng nhật ký kiểm toán riêng cho tính năng này; bằng chứng là các bản ghi JSON trong `BACKUP_ROOT` và nhật ký ứng dụng đã lọc.
