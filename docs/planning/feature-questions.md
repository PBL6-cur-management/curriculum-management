# CÂU HỎI THEO TÍNH NĂNG

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-17 |
| Danh sách tính năng | `docs/implementation/README.md` |
| Nguồn câu hỏi | SRS mục 13 (Q-xx), `Thuyet_minh_Use_Case.md` (C01..C11), `docs/design/*` (E-, L-, S-, G-, CN-), `docs/planning/*` (H-, U-, T-, K-, P-, R-) |

---

## Trạng thái

**Đã trả lời 2026-10-18.** 22 câu trả lời trực tiếp; mọi câu còn trống nhận **A**. Câu 🏫 vẫn là rủi ro, ghi ở §8 kế hoạch của tính năng tương ứng, và đổi được ở đây trước khi kế hoạch đó được viết.

Bốn trả lời khác A; tài liệu nguồn đã sửa theo (2026-10-18):

| Câu | Trả lời | Tài liệu phải sửa |
|---|---|---|
| F00-10 | Khóa chính `cuid` | `docs/architecture/database_and_models.md` (quy ước), khi viết kế hoạch F-01 |
| F01-07 | Chưa làm nhật ký kiểm toán | `docs/planning/deferred-scope.md` (thêm mục), `docs/implementation/README.md` (điểm F-01) |
| F11-02, F11-03 | Học phần–PLO nhập trực tiếp kèm trọng số; CLO–PLO không mang mức | SRS Q-26, FR-41, BR-21; `erd.md` E-5; `data-dictionary.md` `CoursePLOMapping`, `CLOPLOMapping`; `screen-inventory.md` MH-32..MH-34 — trước kế hoạch F-11 |

## Cách trả lời

- Mỗi câu có phương án **A là đề xuất**. Điền cột **Trả lời** bằng `A`, `B`, `C` hoặc ý của bạn. **Để trống = nhận A.**
- **⛔** — câu chặn kế hoạch của tính năng: kế hoạch viết theo trả lời này và đổi sau thì phải làm lại phần lớn.
- **🏫** — chỉ Khoa / Phòng Đào tạo / thầy hướng dẫn trả lời được. Trong lúc chờ, kế hoạch dùng A và ghi rủi ro.
- Câu đã có mã ở tài liệu khác giữ mã đó trong cột Nguồn; khi trả lời khác A, tài liệu nguồn được sửa theo (Rule 4).
- Kế hoạch sinh viên (P-1..P-10: số người, độ dài sprint, hạn nộp) không chặn kế hoạch tính năng nên không hỏi ở đây; xem `docs/planning/sprint-plan.md` mục cuối.

---

## F-00 — Nền tảng dùng chung

Trả lời một lần, áp cho mọi tính năng. Phần lớn là chỗ khung hiện tại lệch rule của stack (`.claude/rules/`), `CLAUDE.md` mục "Open deviations" trỏ về đây.

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F00-01 ⛔ | Bố cục thư mục backend | nestjs-rules §1 | `src/features/<f>/` + `src/shared/` như rule; dời `health/` sang `features/`, `prisma/`, `queue/`, `config/` sang `shared/` ngay ở F-01 | Giữ phẳng `src/<module>/` như hiện tại | | A |
| F00-02 ⛔ | Bố cục thư mục frontend | react-vite-rules §1 | `src/features/<f>/{api,components,hooks,pages,schema}` + `src/shared/`; dời `api/`, `layout/`, `pages/` hiện có | Giữ `api/ pages/ layout/` theo loại tệp | | A |
| F00-03 ⛔ | Cơ chế kiểm quyền | nestjs-rules §5; data-dictionary §9 | `@RequirePermission('PROGRAM_EDIT')` + `PermissionGuard` đọc `RolePermission` (nạp một lần mỗi phiên); kiểm **phạm vi** (đơn vị, chương trình, nhóm) ở service qua một `ScopeService` dùng chung vì cần dữ liệu của bản ghi | `@Roles(...)` + `RolesGuard` như rule — không tách được "sửa nhưng không ban hành" mà bạn đã yêu cầu | Guard kiểm cả quyền lẫn phạm vi (guard tự nạp bản ghi theo tham số đường dẫn) | A |
| F00-04 ⛔ | Form ở frontend | react-vite-rules §5 | `Form` của Ant Design với `rules`; thông báo tiếng Việt sẵn có của `vi_VN` | react-hook-form + Zod, bọc từng ô AntD bằng `Controller` (đúng rule, nhiều mã hơn) | AntD `Form` + Zod qua một hàm chuyển schema → `rules` | A |
| F00-05 | Trạng thái phía client (người dùng hiện tại, quyền) | react-vite-rules §3 | TanStack Query `GET /api/auth/me` là nguồn duy nhất; không thêm Zustand cho tới khi có trạng thái thuần giao diện cần dùng chung | Zustand cho phiên đăng nhập như rule | React context | A |
| F00-06 | Kiểu khai báo component | react-vite-rules §4 | Giữ `function Foo()` như mã hiện có | `const Foo = () => {}` như rule, sửa mã hiện có | | A |
| F00-07 | Cách tạo kiểu | react-vite-rules §4 | `theme` token của AntD (`ConfigProvider`) + `Flex`/`Space`/`Row`; cho phép `style` nội dòng cho căn lề lẻ | Cấm `style` nội dòng, dùng CSS Modules | Thêm Tailwind song song AntD | A |
| F00-08 ⛔ | Khuôn lỗi trả về | nestjs-rules §6 | Bộ lọc lỗi toàn cục trả `{ statusCode, code, message, details?, path, timestamp }`; `code` là mã nghiệp vụ `SCREAMING_SNAKE` cố định (`COURSE_CODE_TAKEN`), `message` tiếng Việt; `details` mang lỗi từng trường của ValidationPipe | Mặc định của Nest `{ statusCode, message, error }` | RFC 9457 `application/problem+json` | A |
| F00-09 | Ngôn ngữ thông báo lỗi | — | Backend trả cả `code` và `message` tiếng Việt; frontend hiện `message`, chỉ dùng `code` khi cần rẽ nhánh | Backend chỉ trả `code`, frontend tra bảng thông báo | | |
| F00-10 ⛔ | Kiểu khóa chính | data-dictionary "Quy ước" (chỉ ghi `id` đại diện) | `Int` tự tăng (`autoincrement`) — gọn khi xem URL và nhật ký, dữ liệu dưới 1 triệu dòng | UUID v7 | `cuid` | **C** — `cuid` |
| F00-11 ⛔ | Kiểu lưu tín chỉ và điểm | EC-02 (cấm số nguyên) | `Decimal(5,2)` cho tín chỉ, `Decimal(4,2)` cho điểm; trả về JSON dạng **chuỗi** để không mất chính xác | `Float` (`double precision`) | `Decimal` nhưng trả về JSON dạng số | A |
| F00-12 | Lưu kiểu Liệt kê | data-dictionary "Kiểu" | `enum` của Prisma (enum PostgreSQL), giá trị `SCREAMING_SNAKE` như từ điển dữ liệu; nhãn tiếng Việt ở frontend | Cột `text` + kiểm ở tầng ứng dụng (dễ thêm giá trị) | | |
| F00-13 | Phân trang | NFR-17 | Offset: `?page=&pageSize=` (mặc định 20, tối đa 100) trả `{ items, total, page, pageSize }` | Cursor | | |
| F00-14 | Tiền tố và phiên bản API | — | `/api/<tài nguyên>` cho giao diện nội bộ; riêng API cho dDUT (F-21) ở `/api/v1/...` | Mọi đường dẫn `/api/v1/...` | | |
| F00-15 | Tham số nghiệp vụ (thời hạn phiên, thang đóng góp, dung lượng tệp, số ngày nhắc hạn) | E-7, CN-4, K-5, G-7, NFR-24 | Biến môi trường qua `@nestjs/config`, kiểm khi khởi động; không có màn hình sửa. Riêng cấu hình đồng bộ ở bảng (MH-12) | Bảng `SystemSetting` + màn hình cho R1 | Bảng, giá trị mặc định lấy từ biến môi trường | A |
| F00-16 | Dữ liệu khởi tạo (vai trò, quyền, đơn vị gốc, tài khoản R1 đầu tiên) | data-dictionary §9 | `prisma/seed.ts` chạy `upsert` (chạy lại không sinh trùng); mật khẩu R1 đầu tiên lấy từ biến môi trường, bắt đổi ở lần đăng nhập đầu | Migration SQL chứa dữ liệu | | |
| F00-17 | Chữ trên giao diện | Q-12 (song ngữ là của **dữ liệu**) | Chuỗi tiếng Việt viết thẳng trong mã, gom thành hằng số theo tính năng | i18next ngay từ đầu | | |
| F00-18 | Tải trang theo tuyến | react-vite-rules §7 | `React.lazy` cho mọi trang trừ đăng nhập, bắt đầu từ F-01 | Tải hết, bật lazy khi gói vượt 500 KB | | |
| F00-19 | Lịch chạy định kỳ | K-7, tech-stack §2 | Job scheduler của BullMQ (`upsertJobScheduler`), mỗi tác vụ chạy lại được không sinh kết quả kép | `@nestjs/schedule` trong tiến trình | | |
| F00-20 | Nơi lưu tệp đính kèm | K-6 | Thư mục trên đĩa máy chủ (volume `files/`), đường dẫn tương đối lưu trong DB, nằm trong phạm vi sao lưu F-26 | `bytea` trong PostgreSQL | Kho S3 tương thích (MinIO) | |
| F00-21 | Mức tự động hóa kiểm thử | T-9, T-10 | Mỗi tính năng: kiểm thử đơn vị (Vitest) + API đầu-cuối (Testcontainers) tự động; Playwright cho các kịch bản nghiệm thu NT của mỗi bậc | Chỉ tự động mức đơn vị, còn lại làm tay | | |
| F00-22 🏫 | Phiên bản Node khi triển khai | CN-1 | Dựng trên Node 22; nâng lên Node 24 trước khi cài lên máy chủ Khoa (F-27) | Chuyển sang Node 24 ngay | | |
| F00-23 🏫 | Máy chủ của Khoa | CN-3, T-6 | Linux chạy Docker (Compose + Caddy) | Windows Server không có Docker: chạy Node trực tiếp, PostgreSQL và Redis cài riêng | | |
| F00-24 🏫 | Dữ liệu mẫu | K-8 | Khung thật của chương trình 1024034 từ tệp Excel của Khoa; sinh viên và kết quả học tập là dữ liệu giả tự sinh | Toàn bộ dữ liệu giả | Dữ liệu thật (cần Phòng Đào tạo cho phép) | |

---

## B1

### F-01 — Đăng nhập, phiên, nhật ký kiểm toán

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F01-01 ⛔🏫 | Xác thực nội bộ hay SSO của Trường | Q-13, CN-2 | Tài khoản nội bộ (Argon2id); tầng xác thực tách riêng để thêm Entra ID qua `openid-client` sau | SSO ngay từ đầu | Cả hai từ đầu | A |
| F01-02 | Thời hạn phiên | NFR-07 | Hết hạn sau 60 phút không thao tác, gia hạn mỗi lần gọi; không có hạn tuyệt đối | 60 phút không thao tác + tối đa 12 giờ kể cả khi có thao tác | | |
| F01-03 | Khóa tài khoản khi đăng nhập sai nhiều lần | L-1, NFR-06 | Không khóa; ghi nhật ký từng lần sai | Khóa 15 phút sau 5 lần sai liên tiếp | Giới hạn tốc độ theo IP (10 lần/phút) | |
| F01-04 | Đổi và đặt lại mật khẩu | G-1 | Người dùng tự đổi (MH-03); bắt đổi ở lần đăng nhập đầu; quên thì R1 đặt lại (MH-06) | Thêm "quên mật khẩu" qua email (cần F-25 sớm) | | |
| F01-05 | Quy tắc mật khẩu | NFR-06 | Tối thiểu 8 ký tự, có chữ và số; không bắt đổi định kỳ | Tối thiểu 12 ký tự, không quy tắc ký tự | | |
| F01-06 | Ai xem nhật ký hệ thống | U-4 | R1 và R2 như ma trận SRS; R3 xem lịch sử từng đề xuất / phiên bản ở màn hình của chúng | Thêm R3 xem nhật ký trong phạm vi | | |
| F01-07 ⛔ | Nhật ký ghi những gì | NFR-08, NFR-10 | Ghi ở service, trong cùng giao dịch với thay đổi: người, thời điểm, hành động, loại + mã đối tượng, giá trị trước/sau (JSON, chỉ các trường đổi). Ghi cả đăng nhập đúng/sai, đăng xuất. Không ghi lượt xem | Interceptor ghi mọi request ghi (không có giá trị trước/sau) | Trigger PostgreSQL | **Chưa làm nhật ký kiểm toán lúc này** — F-01 bỏ US-002, US-003 và bảng `AuditLog`; NFR-08, NFR-10 để sau |
| F01-08 | Bảo vệ CSRF cho phiên cookie | tech-stack §2 | Cookie `SameSite=Lax` + bắt header `X-Requested-With` trên mọi request ghi | Token CSRF đồng bộ (`csrf-csrf`) | | |

### F-02 — Tài khoản, vai trò, phạm vi quyền

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F02-01 ⛔ | Độ mịn của quyền | E-12, C08, yêu cầu "sửa nhưng không ban hành" | Một quyền cho mỗi hành động (xem / sửa / gửi đề xuất / duyệt / ban hành …) như 40 quyền ở data-dictionary §9; mỗi ô `RolePermission` mang kiểu ghi (thẳng / qua đề xuất) và phạm vi (toàn bộ / theo phạm vi) | Gom theo màn hình (xem / quản lý) | | A |
| F02-02 | Màn hình sửa ma trận quyền | E-12, NFR-09 | Có màn hình cho R1 bật/tắt ô của **vai trò có sẵn**; đổi ghi nhật ký. Không thêm vai trò mới | Chỉ sửa bằng dữ liệu khởi tạo, không có màn hình | | A |
| F02-03 | Vai trò tự định nghĩa | E-13 | Chưa làm (bảng đã chừa chỗ) | Làm ở F-02, phạm vi chỉ Toàn hệ thống hoặc Đơn vị | | |
| F02-04 | Một người nhiều vai trò | data-dictionary `RoleAssignment` | Được; quyền là hợp của các vai trò, phạm vi tính riêng theo từng phân công | Mỗi người một vai trò | | |
| F02-05 | Đọc các ô ma trận SRS không khớp use case | U-1, G-2, G-3, G-8 | Theo ma trận SRS (R5 soạn trong nhóm mình; R2 chỉ xem) và các lựa chọn tạm G-2, G-3, G-8 đã ghi | Theo danh sách tác nhân của use case | | |
| F02-06 | Nghĩa của ô `Đ` trước khi có phiên bản đầu tiên | H-4 | `Đ` = sửa thẳng trong phạm vi cho tới khi chương trình có phiên bản đầu tiên; sau đó `Đ` = chỉ qua đề xuất | Chỉ R1 nhập dữ liệu cho tới B4 | | |
| F02-07 | Bảng đơn vị cho phạm vi | README "Thứ tự phụ thuộc" | F-02 dựng `OrgUnit` tối thiểu (mã, tên, loại, cha) và seed Trường → Khoa CNTT + Phòng Đào tạo; F-03 thêm màn hình quản lý | Làm F-03 trước F-02 | | |
| F02-08 | Vô hiệu hóa tài khoản | FR-06 | Vô hiệu hóa (không xóa); phiên đang mở bị hủy ngay; ủy quyền liên quan bị thu hồi (S-11) | Cho xóa tài khoản chưa có dữ liệu | | |

### F-03 — Đơn vị và nhóm chuyên môn

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F03-01 🏫 | Ai phân công thành viên nhóm chuyên môn | U-3 | B1..B3 chỉ R1; từ B4 R2 và R4 gửi đề xuất "Thay đổi tổ chức / phân công", R1 xử lý | R2 phân công trực tiếp | | |
| F03-02 🏫 | Ai xem nhóm chuyên môn | G-2 | B1..B3 chỉ R1; từ B4 R2 và R4 xem (R4 chỉ nhóm mình) | Mọi cán bộ đều xem | | |
| F03-03 | Phạm vi giảng viên | Q-27, E-6 | Theo nhóm chuyên môn (SRS 3.3); không lưu người soạn đề cương | Theo đề cương mình soạn (thêm cột người soạn) | | |
| F03-04 | Một nhóm nhiều điều phối | EC-22 | Được; mọi điều phối của nhóm đều duyệt cấp 1 (F-14 xét theo L-4) | Mỗi nhóm đúng một điều phối | | |
| F03-05 | Một giảng viên ở nhiều nhóm | data-dictionary `SubjectGroupMember` | Được | Một nhóm | | |

### F-04 — Danh mục học phần

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F04-01 | Học phần của khoa khác | Q-06 | Lưu trong danh mục với `ownerUnit` là khoa đó; Khoa CNTT chỉ đề xuất, chuyển thẳng Phòng Đào tạo (EC-24) | Mô hình hóa đầy đủ khoa khác và luồng duyệt riêng | | |
| F04-02 | Chuyển trạng thái học phần | S-10 | Đã hủy: chỉ khi chưa từng trong phiên bản đã ban hành và chưa có kết quả học tập; là trạng thái cuối. Ngừng mở lớp: mở lại được | Cho mở lại cả Đã hủy | | |
| F04-03 🏫 | Ngừng mở lớp khi chưa có học phần thay thế | T-2, EC-12 | Chặn; dữ liệu đi vào bằng nhập/đồng bộ thì cảnh báo trên bảng sức khỏe | Cho phép, chỉ cảnh báo | | |
| F04-04 | Định dạng mã học phần | — | Chuỗi tự do, cắt khoảng trắng, chữ hoa, duy nhất | Mẫu cố định (vd. 7 chữ số) | | |
| F04-05 | Sửa học phần đã nằm trong phiên bản đã ban hành | FR-55 | Thông tin danh mục (tên, tín chỉ) chỉ sửa qua đề xuất khi học phần đã ở phiên bản rời Nháp; trước đó sửa thẳng | Luôn sửa thẳng, ảnh chụp phiên bản giữ giá trị cũ | | |

### F-05 — Quan hệ học phần, nhóm tương đương

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F05-01 | Tương đương hai chiều, bắc cầu | Q-05, DEC-06 | Có, mô hình bằng nhóm tương đương | Quan hệ có hướng theo cặp | | |
| F05-02 | Ngưỡng điểm tiên quyết ở hai chỗ | E-1 | Dùng ngưỡng trên ràng buộc nếu có, nếu trống dùng `minStudiedScore` của dòng khung | Chỉ dùng ngưỡng trên ràng buộc | | |
| F05-03 | Thang điểm | Q-03, DEC-11 | So sánh trên thang 4; lưu cả ba thang | Thang 10 | | |
| F05-04 | Song hành và chống lặp | C06, BR-11 | Cấm chu trình trên học trước + tiên quyết; song hành được phép hai chiều, khi xét dùng tập đã thăm | Cấm chu trình trên cả ba loại | | |
| F05-05 | Quan hệ cấp danh mục và cấp khung | data-dictionary `CourseRelation`, `CurriculumRequisite` | Hai bảng: quan hệ chung ở danh mục, khung được ghi đè riêng | Chỉ ở khung | | |

---

## B2

### F-06 — Thông tin chương trình, Giám đốc CTĐT

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F06-01 🏫 | Số chương trình, cấu trúc Kỹ sư vs Cử nhân | Q-11 | Dưới 20 chương trình, cấu trúc như bản mẫu | | | |
| F06-02 | Đưa chương trình hiện có vào hệ thống | U-2, DEC-12 | Không thêm chương trình trên UI; chương trình hiện có vào qua seed/nhập dữ liệu, chương trình mới chỉ bằng nhân bản (đổi 2026-11-06, người dùng quyết định; xem U-2) | | | |
| F06-03 | Ai nhân bản chương trình | U-7 | Chỉ R1, sau đó phân công Giám đốc CTĐT cho bản mới | R1, R2, R3 như UC-20 | | |
| F06-04 🏫 | "CTĐT mới" sau đánh giá tổng thể | R-5 | Nhân bản thành chương trình khác | Phiên bản Chính mới của cùng chương trình | | |
| F06-05 | Mục tiêu chương trình | R-2 | Chưa làm (deferred-scope) | Thêm `ProgramObjective` ngay | | |
| F06-06 | Một chương trình nhiều Giám đốc CTĐT | — | Được (phân công qua `RoleAssignment` phạm vi chương trình) | Đúng một | | |

### F-07 — Khung chương trình, nhóm tự chọn

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F07-01 | HT ĐA, TQ ĐA | Q-04, DEC-05 | Lưu, hiển thị dạng cờ; không gắn logic | Thành quy tắc đăng ký đồ án | | |
| F07-02 | Cột Ký hiệu khối kiến thức | Q-08, E-2 | Chuỗi tự do, khớp `blockCode` nếu có, không ép | Danh mục có kiểm soát | | |
| F07-03 | Hạn mức nhóm tự chọn | C09, FR-29 | Mỗi nhóm khai báo tối thiểu tín chỉ **hoặc** số học phần; không đếm trùng nhóm tương đương | Chỉ tín chỉ | | |
| F07-04 | Học kỳ hiệu lực ở B2 | K-4 | Để trống ở B2..B3 (mọi phiên bản còn Nháp); `Semester` dựng ở B4 | Dời `Semester` về B2 | | |
| F07-05 | Sửa khung | — | Bảng sửa từng dòng (thêm/sửa/xóa, kéo thả thứ tự trong học kỳ) | Sửa dạng lưới như Excel | | |

### F-08 — Kiểm tra nhất quán

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F08-01 | Khi nào chạy kiểm tra | FR-30..32 | Bấm nút trên khung Nháp + chạy bắt buộc trước khi gửi đề xuất / ban hành | Chạy sau mỗi lần lưu | | |
| F08-02 | Kết quả có chặn không | — | Hai mức: Lỗi chặn gửi/ban hành, Cảnh báo chỉ hiện | Mọi vi phạm đều chặn | | |
| F08-03 | Lưu kết quả kiểm tra | — | Không lưu; tính lại mỗi lần | Lưu lần chạy gần nhất | | |

### F-09 — Nhập, xuất Excel

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F09-01 | Nhập vào chương trình đã ban hành | L-2 | Chỉ vào phiên bản Nháp; chương trình có phiên bản rời Nháp thì từ chối | Nhập thành nội dung một đề xuất | | |
| F09-02 | Xác nhận sau chạy thử | S-12 | Xác nhận kiểm lại toàn bộ tệp; có lỗi thì không ghi gì | | | |
| F09-03 | Đợt nhập và người nhập | U-6 | Đợt 1 (B2): danh mục học phần (R1), khung (R1, R3 trong phạm vi). Đợt 2 (B5): sinh viên, kết quả học tập (R1) | | | |
| F09-04 🏫 | Mẫu tệp | K-8 | Theo đúng tệp Excel Khoa đang dùng (cần tệp); xuất ra cùng mẫu đó | Mẫu riêng của hệ thống | | |
| F09-05 | Giữ tệp đã tải lên | — | Giữ 30 ngày cùng phiên nhập để tra lỗi | Không giữ | | |

---

## B3

### F-10 — Đề cương

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F10-01 | Song ngữ | Q-12, FR-48 | Có trường tiếng Anh, không bắt buộc nhập | Bắt buộc song ngữ | | |
| F10-02 | Trạng thái đề cương đã duyệt chưa tới hiệu lực | S-9 | Đã ban hành ngay khi duyệt cuối; bản áp dụng xác định qua `CurriculumItem.syllabus` của phiên bản đang hiệu lực | Thêm trạng thái Chờ hiệu lực | | |
| F10-03 | Soạn thảo nội dung dài | FR-46 | Trình soạn văn bản có định dạng, lưu HTML đã lọc | Markdown | Văn bản thuần | |
| F10-04 | Tệp đính kèm | K-6, F00-20 | Tối đa 20 MB mỗi tệp, PDF/DOCX/XLSX/ảnh | | | |

### F-11 — PLO, CLO, ma trận

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F11-01 | Chỉ học phần cốt lõi đóng góp PLO? | Q-25 | Mọi học phần trong khung khai báo được CLO–PLO | Chỉ học phần đánh dấu cốt lõi | | |
| F11-02 ⛔ | Ma trận Học phần–PLO | Q-26, E-5 | Suy diễn từ CLO–PLO, cho ghi đè bằng cờ `isOverridden` | Nhập trực tiếp như `plo-clo-backend` (trọng số số thực) | | **B** — nhập trực tiếp kèm trọng số; CLO chỉ gắn được PLO mà học phần đã gắn |
| F11-03 | Thang mức đóng góp | BR-21 | I–R–M | 1–2–3 | Cả hai, chọn theo chương trình | **Không áp dụng** — CLO–PLO là liên kết trơn, không mang mức; đóng góp là trọng số trên Học phần–PLO |
| F11-04 | Đồng bộ với `plo-clo-backend` | Q-28 | Độc lập, giữ mô hình tương thích để đồng bộ sau | Đồng bộ ngay | | |
| F11-05 🏫 | Sinh viên xem PLO / CLO | G-3 | Xem PLO của phiên bản áp dụng (MH-31) và CLO trong đề cương; không vào màn hình ma trận | | | |
| F11-06 | PI (chỉ số đo lường) | R-1 | Chưa làm (deferred-scope) | Làm ngay | | |
| F11-07 | Đo mức đạt PLO hai lần một chu kỳ | R-6 | Ngoài phạm vi (việc của repo PLO-CLO) | | | |
| F11-08 | Công khai chuẩn đầu ra | R-7 | Website Trường tự lấy qua API (F-21) | Trang xem công khai không đăng nhập | | |

### F-12 — Công thức điểm, đánh giá–CLO

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F12-01 | Thành phần dưới ngưỡng | T-1, EC-42 | Khai báo và hiển thị quy tắc; khi tính dùng Đạt/Không đạt từ nguồn, không suy lại từ điểm | Lưu điểm thành phần và tự kết luận | | A — người dùng chốt 2026-10-26 |
| F12-02 | Áp dụng công thức mới | BR-16 | Từ học kỳ kế tiếp sau duyệt, qua phiên bản chương trình | | | Chốt 2026-10-26: phiên bản Phụ cho học kỳ tương lai do người dùng chọn; sửa công thức không được ngoại lệ học kỳ đã bắt đầu |
| F12-03 | Tổng trọng số | — | Bắt buộc đúng 100% mới lưu được | Cảnh báo, vẫn lưu | | A — người dùng chốt 2026-10-26 |

---

## B4

### F-13 — Đề xuất thay đổi

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F13-01 🏫 | R1 là người tạo | C03, L-5 | Một R1 khác phải duyệt cuối; chỉ có một R1 thì báo rõ, không đi tiếp | R1 tự ban hành | | A |
| F13-02 | Loại đề xuất | C04, E-4 | Bảy loại (sáu loại FR-56 + "Thay đổi tổ chức / phân công" chuyển thẳng R1); đề xuất không gắn nhóm bỏ cấp 1 có ghi nhật ký | | | |
| F13-03 🏫 | R2 tạo đề xuất | S-1 | R2, R4 chỉ tạo loại tổ chức / phân công | R2 tạo mọi loại | | |
| F13-04 | Xóa đề xuất nháp | S-2 | Chỉ nháp chưa từng gửi | Mọi nháp | | |
| F13-05 🏫 | Tờ trình, biên bản | Q-18, H-3 | Thủ tục ngoài hệ thống; chỉ đính kèm bản quét | Số hóa biểu mẫu | | |
| F13-06 🏫 | Công văn của Trường | Q-19 | Giám đốc CTĐT tạo, ghi nguồn "Trường" + số công văn | R1 tạo và ban hành | | |
| F13-07 | Loại hồ sơ đính kèm | R-3 | Năm loại hiện có | Thêm Báo cáo lấy ý kiến, Báo cáo đánh giá, Quyết định ban hành ngay | | |
| F13-08 | Nội dung đề xuất lưu thế nào | E-4 | `ChangeItem` theo từng trường (giá trị cũ / mới) trên bản sao Nháp của đối tượng | Lưu nguyên khối JSON của đối tượng | | |

### F-14 — Duyệt ba cấp, thông báo

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F14-01 🏫 | Trả lại và Từ chối | C02, S-6, T-3 | Hai nút ở cả ba cấp: Trả lại → Nháp, Từ chối → đóng | Chỉ có Trả lại | | A |
| F14-02 | Gửi lại sau trả lại | Q-07, BR-29 | Đi lại từ cấp 1 | Tiếp từ cấp đã trả | | |
| F14-03 🏫 | Giảm cấp cho thay đổi nhỏ | Q-21 | Không, mọi đề xuất đủ ba cấp | Số cấp theo loại đề xuất (bảng cấu hình) | | |
| F14-04 🏫 | Ban lãnh đạo khoa duyệt | Q-24 | Không, chỉ xem và bình luận | Thêm một cấp | | |
| F14-05 🏫 | Hội đồng rà soát 5 năm | Q-20 | Chung luồng ba cấp; biên bản là hồ sơ đính kèm | Hội đồng cho ý kiến trong hệ thống | | |
| F14-06 🏫 | Hạn nộp đề xuất | Q-22 | Không ràng buộc | Có hạn trong năm | | |
| F14-07 | Người tạo là một trong nhiều người duyệt | L-4 | Chỉ bỏ lượt của người tạo | Bỏ cả cấp | | |
| F14-08 | Thu hồi khi một người đã đồng ý | S-3 | Một người đã Đồng ý là không thu hồi được | | | |
| F14-09 | Cấp bị bỏ qua | S-4 | Ghi Đồng ý + `isSkipped` | Thêm giá trị "Bỏ qua" | | |
| F14-10 | Thông báo trong ứng dụng | FR-63 | Kéo định kỳ 60 giây + khi đổi trang | WebSocket / SSE đẩy ngay | | A |
| F14-11 🏫 | Văn bản quy định chính thức | Q-23 | Chưa có; theo ghi chú phỏng vấn và quy định mới ở `deferred-scope.md` | | | |

### F-15 — Ban hành, ảnh chụp phiên bản

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F15-01 🏫 | Thời điểm ảnh chụp | C01, E-3, T-5 | Tạo khi duyệt cuối ở Chờ hiệu lực; kích hoạt ở ngày bắt đầu học kỳ | Tạo khi tới học kỳ | | A |
| F15-02 | Phiên bản đầu tiên | H-1, L-3 | Thao tác "ban hành khởi tạo", số mặc định 1.0 sửa được | | | A — người dùng chốt 2026-10-26 |
| F15-03 | Nạp các phiên bản cũ | S-7 | Ban hành khởi tạo cho bản cũ nhất; bản sau qua đề xuất của R1, được bỏ điều kiện học kỳ chưa tới có ghi nhật ký | | | Chốt 2026-10-26: chỉ đề xuất do Phòng Đào tạo tạo, lưu createdByAcademicOffice khi tạo; sửa công thức vẫn phải chọn học kỳ tương lai |
| F15-04 | Hai đề xuất cùng học kỳ | L-7, E-3 | Mỗi đề xuất một phiên bản; bản sau chép từ bản mới nhất đã rời Nháp | Gộp một phiên bản | | A — người dùng chốt 2026-10-26 |
| F15-05 | Học kỳ hiệu lực | S-5 | Phải có `startDate` chưa tới (trừ ban hành khởi tạo) | | | Chốt 2026-10-26: giữ quy tắc F-15; riêng sửa công thức không có ngoại lệ học kỳ đã bắt đầu |
| F15-06 🏫 | Đính chính | S-8, U-9 | R1 ban hành trực tiếp, bắt buộc lý do, tăng số Phụ | Qua ba cấp | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |
| F15-07 | Hình thức ảnh chụp | M-1 | Bảng con sao chép (phiên bản sở hữu dòng khung, liên kết đề cương theo bản) | Một cột JSON chứa toàn bộ | | A — người dùng chốt 2026-10-26 |
| F15-08 | Đề cương thiếu khi ban hành | EC-44 | Chặn ban hành khi còn học phần chưa có đề cương | Cảnh báo | | A — người dùng chốt 2026-10-26 |

### F-16 — So sánh phiên bản, gán khóa

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F16-01 🏫 | Khóa cũ nhận phiên bản mới | C07, E-9, L-8 | R1 chọn khóa áp dụng khi ban hành; khóa cũ chỉ đổi khi R1 chọn | Khóa cũ luôn giữ phiên bản lúc nhập học | | Chốt 2026-10-26: quyết định ban hành đích + R1 chọn khóa là đủ căn cứ, không có kho bằng chứng riêng |
| F16-02 | Gán theo khóa vs từng sinh viên | U-5 | Theo khóa ở B4; từng sinh viên và ngoại lệ ở B5 | | | A — người dùng chốt 2026-10-26 |
| F16-03 | Cách hiện so sánh | FR-74 | Bảng ba nhóm Thêm / Bớt / Sửa theo dòng khung, kèm giá trị cũ → mới | Hai cột song song | | A — người dùng chốt 2026-10-26 |

### F-26 — Sao lưu, diễn tập phục hồi

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F26-01 | Lịch và số bản giữ | tech-stack §2 | `pg_dump` hằng ngày lúc 02:00, giữ 30 bản; sao thư mục tệp cùng lúc | | | |
| F26-02 🏫 | Nơi để bản sao lưu | — | Ổ khác trên cùng máy chủ + chép tay ra ngoài hằng tuần | Máy / dịch vụ khác của Trường | | |
| F26-03 | Diễn tập phục hồi | NFR-13 | Mỗi bậc một lần, ghi thời gian phục hồi | Chỉ một lần ở B6 | | |

---

## B5

### F-17 — Hồ sơ sinh viên, kết quả học tập

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F17-01 🏫 | Tài khoản sinh viên | H-2, E-8 | Tạo tự động khi nhập danh sách, tên đăng nhập là mã sinh viên; tài khoản không bắt buộc | Tạo tay | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |
| F17-02 🏫 | Phát mật khẩu ban đầu | H-2, G-1 | Hệ thống sinh mật khẩu ngẫu nhiên, R1 tải tệp danh sách để phát; bắt đổi ở lần đầu | Mật khẩu ban đầu = ngày sinh | Gửi email (cần F-25) | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |
| F17-03 | Danh mục trạng thái | E-10 | Đang học · Bảo lưu · Thôi học · Đã tốt nghiệp | | | A — người dùng chốt 2026-10-26 |
| F17-04 | Ai đặt "Đã tốt nghiệp" | S-14 | Chỉ theo nguồn dữ liệu; kết quả xét không tự đổi | Xét Đủ điều kiện thì tự đổi | | A — người dùng chốt 2026-10-26 |
| F17-05 | Hai ghi danh | L-9 | Cổng và API dùng ghi danh Chính; cổng cho chọn ghi danh còn lại | | | A — người dùng chốt 2026-10-26 |

### F-18 — Điều kiện đăng ký học phần

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F18-01 | Ba hay bốn kết quả | C05 | Ba kết quả đủ điều kiện + trạng thái Đã hoàn thành riêng | Bốn kết quả | | A — người dùng chốt 2026-10-26 |
| F18-02 | Ngưỡng và thang | E-1, Q-03 | Như F05-02, F05-03 | | | A — người dùng chốt 2026-10-26 |
| F18-03 | Tính khi nào | NFR-02 | Tính khi xem, không lưu | Lưu sẵn, tính lại khi dữ liệu đổi | | A — người dùng chốt 2026-10-26 |

### F-19 — Xét tốt nghiệp

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F19-01 🏫 | Điều kiện ngoài tín chỉ | Q-10 | Mô hình là học phần điều kiện | Thêm thực thể chứng chỉ | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |
| F19-02 | Nhóm tương đương khi xét lại | C11, E-11 | Dùng nhóm hiện tại; mỗi lần xét một dòng `GraduationAudit` | Chụp nhóm theo phiên bản | | A — chốt 2026-10-26: dữ liệu hành chính hiện tại; mỗi GraduationAudit chụp đúng đầu vào, không hứa lịch sử bất biến trước đính chính |
| F19-03 | Tín chỉ tự chọn | C09 | Như F07-03, không đếm trùng | | | A — người dùng chốt 2026-10-26 |
| F19-04 | Xét hàng loạt | NFR-03 | Job BullMQ, tiến độ hiện trên màn hình, xuất Excel kết quả | Chạy đồng bộ | | A — người dùng chốt 2026-10-26 |

### F-20 — Cổng sinh viên

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F20-01 | Sinh viên xem danh mục, đề cương | G-8 | Mọi học phần, chỉ bản đề cương đã ban hành; khung và PLO chỉ của phiên bản mình | | | A — người dùng chốt 2026-10-26 |
| F20-02 | Tên bốn trạng thái tiến độ | T-4 | Theo US-093: Đã đạt, Chưa đạt, Đang học, Chưa học | | | A — người dùng chốt 2026-10-26 |
| F20-03 | Giao diện | — | Cùng ứng dụng React, bố cục riêng cho vai trò sinh viên, ưu tiên màn hình điện thoại | Ứng dụng riêng | | A — người dùng chốt 2026-10-26 |

### F-21 — API cho dDUT

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F21-01 | Xác thực | FR-94 | Khóa API trong header `X-Api-Key`, lưu băm, R1 tạo/thu hồi | OAuth2 client credentials | | A — người dùng chốt 2026-10-26 |
| F21-02 | Ai xem dữ liệu sinh viên | L-10, U-8, G-4 | R1 mọi sinh viên, R3 sinh viên chương trình mình, R6 của mình; bên tích hợp được tin, ghi nhật ký từng lời gọi | | | A — người dùng chốt 2026-10-26 |
| F21-03 | Phiên bản đề cương qua API | C10 | Tham số `programVersion` hoặc `semester`; mặc định bản áp dụng cho sinh viên | Luôn bản mới nhất | | A — người dùng chốt 2026-10-26 |
| F21-04 | Hai ghi danh qua API | L-9 | Chỉ ghi danh Chính | Trả cả hai | | A — người dùng chốt 2026-10-26 |
| F21-05 | Giới hạn tốc độ | — | 60 lời gọi/phút mỗi khóa | Không giới hạn | | A — người dùng chốt 2026-10-26 |

---

## B6

### F-22 — Đồng bộ cơ sở dữ liệu Trường

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F22-01 ⛔🏫 | Cơ sở dữ liệu có sẵn là gì | Q-09, T-11 | Hỗ trợ cả hai; giả lập DB Trường (SQL Server) cho tới khi có quyền | Chỉ nạp từ Excel | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |
| F22-02 | Lần đồng bộ bị treo | S-13 | Quá thời hạn cấu hình thì đánh Thất bại ở lần kế | | | A — người dùng chốt 2026-10-26 |
| F22-03 | Xung đột dữ liệu | FR-98 | Nguồn Trường thắng cho sinh viên và kết quả; dữ liệu đào tạo không đồng bộ ngược | Hỏi người dùng từng dòng | | A — người dùng chốt 2026-10-26 |

### F-23 — Báo cáo kiểm định

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F23-01 | Yêu cầu từ quy định mới | R-1, R-2, R-4 | Chưa làm (bạn đã chốt "chưa có lúc này") | | | A — người dùng chốt 2026-10-26 |
| F23-02 🏫 | Mẫu báo cáo | FR-105..107 | Mẫu tổng quát xuất Excel; đổi theo mẫu AUN/MOET khi có | | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |

### F-24 — Đồ thị, PDF, dòng thời gian, bảng sức khỏe

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F24-01 🏫 | PDF theo mẫu quyết định | Q-14 | Mẫu tổng quát, đổi khi có mẫu chính thức | | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |
| F24-02 | Xem lại phiên bản đã ban hành | G-6 | Màn hình riêng MH-47, dùng lại phần hiển thị | | | A — người dùng chốt 2026-10-26 |
| F24-03 | Công cụ PDF | CN-3 | Puppeteer (ảnh máy chủ nặng thêm ~300 MB) | pdfmake (nhẹ, phải dựng bố cục bằng mã) | | A — người dùng chốt 2026-10-26 |
| F24-04 | Thư viện đồ thị tiên quyết | FR-38 | `@antv/g6` (cùng hệ AntD) | React Flow | | A — @antv/g6 được duyệt 2026-10-26, đã ghi tech-stack; ghim phiên bản khi build F-24 |

### F-25 — Ủy quyền, email, nhắc hạn

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F25-01 | Nhắc hạn | Q-17 | Làm (mức tùy chọn), số ngày là tham số cấu hình | Bỏ | | A — người dùng chốt 2026-10-26 |
| F25-02 | Email hỏng | L-6 | Trong ứng dụng là kênh chính; email hỏng ghi lỗi, không gửi lại | Thử lại 3 lần qua BullMQ | | A — người dùng chốt 2026-10-26 |
| F25-03 | Ủy quyền ngày tương lai | S-11 | Hiệu lực khi tạo, chỉ dùng trong `validFrom..validTo` | | | A — người dùng chốt 2026-10-26 |
| F25-04 🏫 | Máy chủ email | — | SMTP của Trường; giả lập bằng Mailpit khi phát triển | Gmail SMTP | | Mặc định A có hiệu lực 2026-10-26; đầu vào Khoa còn nợ, không phải trả lời của Khoa |

### F-27 — Triển khai, thử tải, theo dõi hoạt động

| # | Câu hỏi | Nguồn | A (đề xuất) | B | C | Trả lời |
|---|---|---|---|---|---|---|
| F27-01 | Kịch bản thử tải | Q-15, T-7 | 200 phiên trong 15 phút: 160 sinh viên đọc, 40 cán bộ tra cứu, không ghi; công cụ k6 | | | |
| F27-02 🏫 | Máy đo hiệu năng | T-6 | Máy chủ Khoa hoặc tương đương; 300 học phần, 500 sinh viên | | | |
| F27-03 | Theo dõi hoạt động | T-8, NFR-15 | Uptime Kuma gọi `/api/health` mỗi phút; báo cáo 4 tuần vận hành thử | | | |
| F27-04 | Ghi log ứng dụng | — | `pino` JSON ra stdout, Docker xoay vòng | Ghi tệp | | |
