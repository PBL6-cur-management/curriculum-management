# Cheat sheet trình diễn hệ thống — F-01..F-28

Tài liệu cầm tay khi demo cho giảng viên: tính năng nào ở đâu, bấm gì, và **vì sao nó được thiết kế như vậy**. Trạng thái kiểm tra trên bản demo công khai: 2026-11-04.

- Link: https://ctdt.oguri-lab.io.vn
- Mỗi mục "Vì sao" có nguồn trong ngoặc để tra khi bị hỏi sâu.
- Nhãn menu/nút viết đúng như trên giao diện.

---

## 0. Trước buổi demo (làm trước 30 phút)

| # | Việc | Trạng thái 2026-11-04 |
|---|---|---|
| 1 | Mở `/api/health`, phải thấy `database: up`, `redis: up` | OK |
| 2 | Đăng nhập `demo` / `demo` | OK |
| 3 | Đăng nhập `demo.sinhvien` / `demo` | **Lỗi 401: tài khoản chưa được tạo trên VM.** Cần chạy `pnpm db:demo-student` trên VM trước khi demo cổng sinh viên (§F-20, §F-28) |
| 4 | **Chờ tôi duyệt** của `demo` có 5 đề xuất | OK (xem §4) |
| 5 | DX-2026-0095 "Thay đổi nội dung Đề cương" là đề xuất thử bị sót | Từ chối hoặc tránh mở khi demo |
| 6 | Phiên hết hạn sau **60 phút không thao tác** | Nếu demo dài, đăng nhập lại trước phần duyệt |

Mẹo: mở sẵn 2 tab, gồm tab nhân viên (`demo`) và một tab ẩn danh cho sinh viên (`demo.sinhvien`). Cookie phiên tách nhau nên không phải đăng xuất qua lại.

## 1. Tài khoản dùng khi demo

| Tài khoản | Vai trò | Dùng để |
|---|---|---|
| `demo` / `demo` | R1–R5, phạm vi toàn hệ thống, **được tự duyệt** (`canSelfApprove`) | Đi hết luồng một mình |
| `demo.sinhvien` / `demo` | R6 | Cổng sinh viên; dữ liệu điểm hoàn toàn tổng hợp |
| `dp.httt`, `dp.khmt`, `dp.mmt`, `dp.ktmt` | R4 điều phối nhóm mẫu | Tác giả/người duyệt trong kịch bản mẫu |
| `gd.httt`, `gd.attt`, `gd.khdl`, `gd.ktmt`, `gd.nn`, `gd.cntt` | R3 giám đốc CTĐT mẫu | Người duyệt cấp 2 |
| `gv.cnpm` | R5 giảng viên mẫu | Tác giả đề xuất |

Câu nói trước: "Tài khoản `demo` gom đủ vai trò cho tiện trình diễn. Người dùng thật chỉ có vai trò theo phân công, và **không ai được tự duyệt đề xuất của mình**" (`source/backend/src/shared/change-requests/self-approval.ts`).

Sáu vai trò:

| Mã | Vai trò | Ghi nhớ |
|---|---|---|
| R1 | Phòng Đào tạo | Quản trị, duyệt cấp 3 (cuối), ban hành |
| R2 | Ban lãnh đạo khoa | **Chỉ theo dõi và bình luận, không duyệt** |
| R3 | Giám đốc CTĐT | Duyệt cấp 2; suy ra từ phân công giám đốc |
| R4 | Điều phối nhóm chuyên môn | Duyệt cấp 1; suy ra từ phân công điều phối |
| R5 | Giảng viên | Soạn đề cương, tạo đề xuất; suy ra từ thành viên nhóm |
| R6 | Sinh viên | Cổng sinh viên riêng |

## 2. Kịch bản gợi ý (khoảng 25–30 phút)

1. **Đăng nhập và tổng quan** (2'): đăng nhập `demo` > Trang chính > lướt menu bên trái.
2. **Danh mục** (4'): Học phần > một học phần > quan hệ học trước/tiên quyết > Nhóm tương đương.
3. **Chương trình** (5'): Danh sách chương trình > một CTĐT CNPM > Khung chương trình > Nhóm tự chọn > Kiểm tra nhất quán > Chuẩn đầu ra (ma trận).
4. **Đề cương** (3'): đề cương một học phần > CLO > công thức điểm > tài liệu đính kèm.
5. **Đề xuất và ba cấp duyệt** (7'): §4 bên dưới. Đây là phần quan trọng nhất.
6. **Phiên bản** (3'): Lịch sử > So sánh > Dòng thời gian > Gán cho khóa.
7. **Sinh viên** (4'): Hồ sơ sinh viên > Xét tốt nghiệp; rồi tab ẩn danh với `demo.sinhvien` > cổng sinh viên.
8. **Báo cáo và vận hành** (2'): Báo cáo > Phân bổ tín chỉ, Hồ sơ kiểm định; Quản trị > Trạng thái hệ thống; giải thích các trang "Sắp có".

## 3. Vòng đời dữ liệu (vẽ lên bảng nếu được hỏi "hệ thống làm gì")

```
Nháp (sửa trực tiếp) ──Ban hành lần đầu──▶ Bản phát hành (KHÓA)
                                              │
                         Tạo đề xuất (bản làm việc) ──Gửi──▶ R4 ▶ R3 ▶ R1
                                              │                       │
                                       Trả lại → Nháp           Duyệt cuối: số QĐ,
                                       Từ chối → Đóng           ngày ký, học kỳ hiệu lực
                                                                      │
                                     Phiên bản mới major.minor (CHỜ HIỆU LỰC)
                                                                      │
                                     Ngày đầu học kỳ hiệu lực → ĐANG ÁP DỤNG (job BullMQ)
                                                                      │
                                     Gán cho khóa → sinh viên thấy đúng phiên bản của mình
```

## 4. Luồng phê duyệt trên dữ liệu demo (đã kiểm tra 2026-11-04)

Đề xuất của CTĐT `CNTT-KS-CNPM` mà `demo` thấy:

| Mã | Trạng thái | Nội dung | Dùng để demo |
|---|---|---|---|
| DX-2026-0100 | Chờ cấp 1 (điều phối) | Viết lại mục tiêu học phần Lập trình hướng đối tượng | Duyệt cấp 1 rồi đi tiếp |
| DX-2026-0096 | Chờ cấp 2 (giám đốc) | Chuyển Toán rời rạc lên học kỳ sớm hơn | Duyệt cấp 2; diff khung chương trình |
| DX-2026-0098 | Chờ cấp 2 | Bổ sung Cấu trúc dữ liệu làm học trước của Cơ sở dữ liệu | Diff quan hệ học phần |
| DX-2026-0099 | Chờ cấp 3 (Phòng Đào tạo) | Bổ sung Git và kiểm thử đơn vị vào Kỹ thuật lập trình | **Duyệt cuối**: nhập số QĐ, ngày ký, học kỳ hiệu lực |
| DX-2026-0103 | Nháp (bị trả lại) | Chuyển Xác suất thống kê sang học kỳ sau | Cho thấy "Trả lại" đưa về Nháp kèm lý do |
| DX-2026-0102 | Bị từ chối | Đổi tên chương trình sang "Kỹ thuật phần mềm" | "Từ chối" là đóng hẳn |
| DX-2026-0105 | Đã có hiệu lực | Chuẩn hóa tên tiếng Anh học phần Nhập môn ngành | Kết quả cuối: phiên bản mới |
| DX-2026-0095 | Chờ cấp 2 | Đề xuất thử bị sót | **Tránh**, hoặc từ chối trước buổi demo |

Các bước:

1. **Đề xuất và phê duyệt > Chờ tôi duyệt** sẽ thấy 5 mục (menu này chỉ hiện với người có quyền duyệt).
2. Mở DX-2026-0096: chỉ cho thấy diff trước/sau, các bước định tuyến (bước nào bỏ qua và lý do), lịch sử. Bấm **Duyệt** và nó chuyển lên cấp 3.
3. Mở DX-2026-0099 (cấp 3): màn duyệt cuối có số quyết định, ngày ký, học kỳ hiệu lực, khóa áp dụng. Nhấn mạnh: **duyệt xong chưa áp dụng ngay**, phiên bản mới ở trạng thái chờ đến đầu học kỳ.
4. Mở DX-2026-0103 và DX-2026-0102 để so sánh **Trả lại** với **Từ chối**.
5. Mở **Thông báo** để xem thông báo trong ứng dụng sinh ra từ các bước duyệt.
6. (Tùy chọn) tạo một đề xuất mới: vào một học phần đã ban hành, chỗ trước đây là **Sửa** nay là **Tạo đề xuất**, sửa trên bản làm việc, xem trước định tuyến rồi gửi.

Quy tắc định tuyến (`source/backend/src/features/change-requests/routing-planner.ts`):

| Trường hợp | Định tuyến |
|---|---|
| Thông thường | R4 (nhóm sở hữu học phần) > R3 (giám đốc CTĐT) > R1 |
| Người tạo đã giữ cấp đó | Bỏ qua cấp của chính họ, ghi lý do `CREATOR` |
| Chỉ chạm học phần của khoa khác | Bỏ qua cấp 1 và 2 (`FOREIGN_COURSE`), vào thẳng R1 |
| Đề xuất tổ chức (đơn vị, nhóm) | Vào thẳng R1 |
| Không có nhóm/điều phối/giám đốc | Bỏ qua kèm lý do (`NO_GROUP`, `NO_COORDINATOR`, `NO_DIRECTOR`) |
| Người tạo là R1 | Cấp 3 vẫn cần **một R1 khác**; không có thì báo lỗi `NO_OTHER_ACADEMIC_OFFICE` |
| Nhiều nhóm/CTĐT bị ảnh hưởng | Mọi người duyệt cùng cấp phải xong mới lên cấp sau |

---

## 5. Từng tính năng

Ký hiệu: **Mục đích** = tính năng giải quyết việc gì; **Ở đâu** = đường menu > route; **Ai** = vai trò; **Demo** = các bước bấm; **Vì sao**; **Giới hạn**.

### F-01 Đăng nhập và phiên

- **Mục đích:** Xác thực người dùng và giữ phiên làm việc an toàn, để mỗi thao tác đều biết ai đang làm.
- **Ở đâu:** `/login`; menu tài khoản > Tài khoản của tôi (`/account`).
- **Demo:** đăng nhập, mở trang tài khoản (đổi mật khẩu), đăng xuất.
- **Vì sao:**
  - Dùng **phiên máy chủ** (cookie HttpOnly, bảng phiên trong PostgreSQL), **không dùng JWT** vì ứng dụng cùng origin. Khóa tài khoản có hiệu lực ngay ở request kế tiếp, còn JWT thì vẫn sống tới khi hết hạn (`docs/design/tech-stack.md` §2, F-01 plan D1–D2).
  - Hết hạn sau 60 phút không thao tác (NFR-08). Việc poll thông báo **không** tính là hoạt động, nên để tab mở không làm phiên sống mãi (F-14 plan D15–D16).
- **Giới hạn:** chưa có SSO Microsoft của Trường; nhật ký nghiệp vụ tổng quát còn hoãn (`docs/planning/deferred-scope.md`).

### F-02 Tài khoản, vai trò, ma trận quyền

- **Mục đích:** Quản lý ai được làm gì, ở phạm vi nào, để mỗi người chỉ thấy và sửa đúng phần mình phụ trách.
- **Ở đâu:** Quản trị > Tài khoản (`/users`); Quản trị > Ma trận quyền (`/permissions`).
- **Ai:** R1.
- **Demo:** mở một tài khoản mẫu, xem lịch sử vai trò, rồi mở Ma trận quyền và chỉ ra các cột xem / sửa / duyệt.
- **Vì sao:**
  - Quyền = **ma trận quyền × phạm vi** (toàn trường / khoa / CTĐT / nhóm). Chỉ tên vai trò thì không diễn tả được kiểu quyền "sửa nháp của nhóm mình, đề xuất sau ban hành, nhưng không ban hành" (feature-questions F00-03).
  - R3/R4/R5 **được suy ra** từ phân công giám đốc và thành viên nhóm, không gán tay. Hết nhiệm kỳ thì tự mất quyền, không còn vai trò "treo" (`features_architecture.md` F-02).
  - Một số ô quyền của R1 bị khóa, và không cho tự vô hiệu hóa mình, để quản trị viên không tự cắt đường phục hồi.
  - Ẩn nút chỉ là giao diện. **Máy chủ kiểm quyền ở mọi request.**
- **Giới hạn:** đừng dùng tài khoản `demo` (đủ vai trò) để giải thích việc cô lập vai trò; nó là ngoại lệ có chủ đích.

### F-03 Đơn vị và nhóm chuyên môn

- **Mục đích:** Mô tả cơ cấu Khoa, bộ môn và nhóm chuyên môn, là gốc để biết học phần thuộc nhóm nào và ai duyệt cấp 1.
- **Ở đâu:** Quản trị > Đơn vị (`/org-units`); Quản trị > Nhóm chuyên môn (`/subject-groups`).
- **Demo:** mở cây đơn vị, rồi mở nhóm CNTT-CNPM xem thành viên và giai đoạn điều phối.
- **Vì sao:**
  - Thành viên và điều phối là **hai bản ghi có ngày** riêng. Hết nhiệm kỳ điều phối thì người đó vẫn là thành viên (F-03 plan D1).
  - Nhiệm kỳ điều phối phải nằm trong thời gian là thành viên; một nhóm có thể có nhiều điều phối viên.
  - "Kết thúc" khác "Thu hồi" (kết thúc là hết hạn hợp lệ, thu hồi là sửa nhập sai), và không xóa bản ghi để giữ lịch sử.
- **Giới hạn:** 5 nhóm (KTMT/KHMT/HTTT/MMT/CNPM) và các phân công `dp.*`/`gd.*` là **dữ liệu mẫu** từ `db:demo-org`, vì CSDL Trường không có thông tin này.

### F-04 Danh mục học phần

- **Mục đích:** Một danh mục học phần duy nhất cho toàn trường, để mọi CTĐT dùng chung cùng mã, tên, tín chỉ.
- **Ở đâu:** Chương trình đào tạo > Học phần (`/courses`).
- **Demo:** tìm theo mã/tên, lọc khoa/trạng thái, mở một học phần (nhóm sở hữu, nơi đang dùng, nút hành động).
- **Vì sao:**
  - Cùng màn hình có lúc hiện **Sửa**, có lúc hiện **Tạo đề xuất**, có lúc không hiện gì. Backend tính đường sửa dựa trên quyền, phạm vi và học phần đã nằm trong bản phát hành chưa (`features_architecture.md` F-04).
  - Ngừng học phần thì phải có học phần thay thế; không hủy được học phần đã có trong bản phát hành hoặc đã có điểm, vì sinh viên và chương trình cũ phải còn diễn giải được.
  - Mã học phần không sửa được (là định danh ổn định). Tín chỉ là số thập phân, truyền dạng chuỗi, nên không có sai số dấu phẩy động.
- **Giới hạn:** quyền sửa danh mục của R3 rộng hơn R4/R5 theo seed; đừng nói "R3 chỉ sửa nhóm mình".

### F-05 Quan hệ học phần và nhóm tương đương

- **Mục đích:** Ghi điều kiện học (học trước, tiên quyết, song hành) và học phần nào thay được học phần nào, làm đầu vào cho xét đăng ký và tốt nghiệp.
- **Ở đâu:** chi tiết học phần (`/courses/:id`); tab Nhóm tương đương (`/equivalence-groups`).
- **Demo:** xem học trước / tiên quyết / song hành, ngưỡng điểm tiên quyết, rồi mở nhóm tương đương.
- **Vì sao:**
  - **Tương đương là nhóm, không phải cặp**: đối xứng và bắc cầu (A≡B, B≡C thì A≡C). Định nghĩa bằng cặp dễ mâu thuẫn (`REQUIREMENTS.md` ~dòng 1127).
  - **Thay thế là một chiều** (học phần cũ đã ngừng → học phần mới), khác với tương đương.
  - Chặn vòng lặp học trước/tiên quyết vì vòng lặp làm không ai học được. Song hành thì được hai chiều vì học cùng lúc là hợp lý.
- **Giới hạn:** học phần thay thế sau này có thể bị ngừng; Sức khỏe chương trình báo lỗi đó chứ không chặn.

### F-06 Chương trình và giám đốc CTĐT

- **Mục đích:** Quản lý danh sách CTĐT và người chịu trách nhiệm (giám đốc CTĐT) cho từng chương trình.
- **Ở đâu:** Chương trình đào tạo > Danh sách chương trình (`/programs`), rồi tab Tổng quan.
- **Demo:** lọc CTĐT đang hoạt động, mở một CTĐT CNPM, xem lịch sử giám đốc, mở hộp nhân bản (không gửi).
- **Vì sao:**
  - Giám đốc có phân công theo ngày, và R3 suy ra từ phân công đó.
  - Nhân bản tạo **CTĐT mới độc lập**, là điểm khởi đầu nhanh; nó không phải quy trình mở ngành chính thức.
  - Thông tin CTĐT đã ban hành chỉ đổi được qua đề xuất, không ghi đè.
- **Giới hạn:** thủ tục mở ngành mới chính thức nằm ngoài phạm vi.

### F-07 Khung chương trình và nhóm tự chọn

- **Mục đích:** Xây khung chương trình: học phần nào, học kỳ nào, bắt buộc hay tự chọn, là nội dung chính của một CTĐT.
- **Ở đâu:** CTĐT > Khung chương trình > Học phần trong khung; Nhóm tự chọn.
- **Demo:** đổi **Dạng dòng / Theo học kỳ**, xem điều kiện một dòng, mở Nhóm tự chọn và so tổng tín chỉ với yêu cầu tối thiểu.
- **Vì sao:**
  - Nhóm tự chọn là **kho để chọn**, có thể liệt kê nhiều tín chỉ hơn số sinh viên phải học (EC-04).
  - Mỗi dòng khung **chép riêng điều kiện tiên quyết**, để phiên bản CTĐT giữ diễn giải ổn định khi danh mục sống thay đổi.
  - Sắp xếp và cấu trúc nhóm tự chọn cần quyền cấp CTĐT; sửa từng dòng chỉ cần quyền nhóm.
  - Ký hiệu nguồn như HT ĐA/TQ ĐA được giữ nguyên, không tự suy luật, vì Khoa chưa xác nhận nghĩa (Q-04, Q-08).
- **Giới hạn:** C10, nhóm tự chọn dựng lại từ dữ liệu Trường, chưa được Khoa nghiệm thu.

### F-08 Kiểm tra nhất quán

- **Mục đích:** Tự phát hiện lỗi trong khung (lệch tín chỉ, vòng lặp tiên quyết, thiếu đề cương) trước khi gửi duyệt hay ban hành.
- **Ở đâu:** CTĐT > Khung chương trình > Kiểm tra nhất quán; tóm tắt có ở Tổng quan.
- **Demo:** so tín chỉ khai báo với tín chỉ tính được, mở một lỗi, bấm **Tới chỗ sửa**, quay lại và làm mới.
- **Vì sao:**
  - **Chỉ mức ERROR chặn** gửi đề xuất và ban hành; HIGH/INFO chỉ cảnh báo, vì không phải bất thường nào cũng làm chương trình sai (F-08 plan D1).
  - Tổng tín chỉ = bắt buộc + **mức tối thiểu** của các nhóm tự chọn, không cộng mọi môn tự chọn.
  - Chấp nhận chênh lệch tín chỉ phải có lý do và **gắn với đúng mức chênh đã thấy**. Chấp nhận lệch 2 tín chỉ không tự cho phép lệch 5 (D5–D6).
  - Khi gửi và khi ban hành, hệ thống chạy lại kiểm tra trong transaction, vì màn hình "sạch" lúc trước có thể đã cũ (D9).

### F-09 Nhập / xuất Excel

- **Mục đích:** Đưa dữ liệu Excel sẵn có của Khoa vào hệ thống và xuất khung ra Excel, không phải nhập tay.
- **Ở đâu:** Dữ liệu và tích hợp > Nhập liệu Excel (`/imports`); lịch sử `/imports/history/:batchId`; xuất khung từ Học phần trong khung.
- **Demo:** chọn loại dữ liệu, tải mẫu, tải lên file mẫu, xem **báo cáo chạy thử**, xem lịch sử. Không xác nhận nếu không cần.
- **Vì sao:**
  - Tải lên chỉ **chạy thử** (dry-run), không ghi gì, để thấy lỗi trước khi ghi một lô lớn.
  - Khi xác nhận, hệ thống kiểm lại quyền, file và đích, vì báo cáo có thể đã cũ.
  - Lỗi chỉ đúng sheet, dòng, cột; lịch sử còn giữ sau khi file hết hạn.
- **Giới hạn:** C10, chưa thử với file Excel thật của Khoa.

### F-10 Đề cương và tài liệu đính kèm

- **Mục đích:** Soạn và lưu đề cương chi tiết học phần (mục tiêu, nội dung theo tuần, tài liệu), dùng chung cho mọi CTĐT.
- **Ở đâu:** Học phần > đề cương (`/courses/:id/syllabus`), trình soạn `/edit`.
- **Demo:** banner phiên bản đề cương, các tab nội dung / theo tuần / đính kèm, chọn loại tài liệu.
- **Vì sao:**
  - **Đề cương và CLO thuộc học phần**, dùng chung cho mọi CTĐT có học phần đó, nên nội dung giảng dạy không bị nhân bản rồi lệch nhau (`REQUIREMENTS.md` ~1082).
  - Phiên bản CTĐT **ghim đúng bản đề cương**, nên CTĐT cũ không tự hiện đề cương mới.
  - Tệp phải chọn loại (đề cương có chữ ký, giáo trình, slide, khác) vì chúng mang nghĩa khác nhau.
  - Bản không còn nháp **không xóa được tệp** nhưng vẫn thêm được, để bổ sung bản ký sau mà không mất bằng chứng cũ.
- **Giới hạn:** đừng nói "đã ban hành thì tệp đóng băng hoàn toàn". CLO và nội dung mẫu là **tổng hợp** (`db:demo-syllabi`), không phải bản Khoa duyệt.

### F-11 PLO, CLO, ma trận chuẩn đầu ra

- **Mục đích:** Định nghĩa chuẩn đầu ra CTĐT (PLO) và học phần (CLO), nối chúng bằng ma trận để chứng minh CTĐT đạt chuẩn đầu ra, phục vụ kiểm định.
- **Ở đâu:** CTĐT > Chuẩn đầu ra > PLO / Ma trận học phần–PLO / Ma trận CLO–PLO / Kiểm tra phủ.
- **Demo:** xem PLO, trọng số học phần–PLO, ma trận CLO–PLO của một học phần, rồi Kiểm tra phủ.
- **Vì sao:**
  - **CLO dùng chung, nhưng liên kết CLO→PLO thuộc từng CTĐT**: cùng một học phần có thể đóng góp vào chuẩn đầu ra khác nhau ở các ngành khác nhau (`REQUIREMENTS.md` ~1094).
  - Trọng số học phần→PLO **nhập trực tiếp trước**; CLO chỉ được nối tới các PLO mà học phần đã đóng góp (Q-26).
  - Kiểm tra phủ tách riêng vì PLO không ai phủ, CLO chưa nối và học phần không đóng góp là ba lỗi khác nhau, cách sửa khác nhau.
- **Giới hạn:** `plan.md` cũ ghi học phần–PLO suy ra từ CLO; quyết định Q-26 thay thế điều đó. Chưa có PI và đo mức đạt PLO của sinh viên (`deferred-scope.md`).

### F-12 Công thức điểm và ánh xạ đánh giá–CLO

- **Mục đích:** Khai báo cách tính điểm học phần và thành phần đánh giá nào đo CLO nào.
- **Ở đâu:** trình soạn đề cương, tab công thức và tab đánh giá–CLO.
- **Demo:** các thành phần đánh giá, tổng trọng số 100%, ngưỡng điều kiện, lưới đánh giá–CLO.
- **Vì sao:**
  - Trọng số phải đúng 100%; lưu đồng thời dùng token phiên bản nên không ghi đè người khác.
  - **Mọi CLO phải có đánh giá** trước khi gửi/ban hành, vì dạy mà không đánh giá thì không chứng minh được chuẩn đầu ra.
  - Công thức điểm **không được hiệu lực trong học kỳ đã bắt đầu**, kể cả ngoại lệ của Phòng Đào tạo, vì không đổi luật chấm giữa chừng (E1, người dùng chốt 2026-10-26). Công thức điểm vẫn đi đủ ba cấp duyệt.
- **Giới hạn:** C1, đơn vị/ngưỡng chưa được Khoa xác nhận. Đây không phải máy tính bảng điểm chính thức.

### F-13 Đề xuất thay đổi

- **Mục đích:** Cách duy nhất để thay đổi dữ liệu đã ban hành: soạn thay đổi trên bản làm việc, xem diff, gửi duyệt.
- **Ở đâu:** Đề xuất và phê duyệt > Đề xuất thay đổi (`/change-requests`); tạo mới `/new`, đề xuất tổ chức `/new-organizational`.
- **Demo:** mở nháp, vào bản làm việc, xem diff trước/sau, xem trước định tuyến.
- **Vì sao:**
  - Đề xuất sửa trên **bản làm việc bằng chính các màn hình sửa sẵn có**, không làm editor thứ hai, nên không trùng logic kiểm tra (F-13 plan D1).
  - Diff của nháp là diff sống; khi gửi, các thay đổi **được lưu cố định**, nên người duyệt thấy đúng thứ đã gửi.
  - Nếu bản gốc đã đổi (một đề xuất khác vừa có hiệu lực), hệ thống báo **base cũ** và cho rebase, không ghi đè im lặng.
  - Mất quyền nhóm thì cũng mất quyền sửa bản làm việc, vì là tác giả không có nghĩa có quyền vĩnh viễn.
- **Giới hạn:** các kịch bản mẫu được tạo qua API thật (`deploy/scripts/demo-change-requests.mjs`), nhưng không chứng minh Khoa đã chấp nhận quy trình.

### F-14 Ba cấp duyệt và thông báo

- **Mục đích:** Đưa đề xuất qua đúng người duyệt ở ba cấp và báo cho người liên quan, thay cho trình ký giấy.
- **Ở đâu:** Chờ tôi duyệt (`/approval-queue`); Thông báo (`/notifications`). Xem §4.
- **Vì sao:**
  - Chuỗi là **Điều phối nhóm → Giám đốc CTĐT → Phòng Đào tạo**; R2 chỉ giám sát (`REQUIREMENTS.md` ~1107).
  - Mọi người duyệt cùng cấp phải xong mới lên cấp sau, vì một đề xuất có thể chạm nhiều nhóm/CTĐT.
  - Bỏ qua cấp của chính người tạo; R1 tạo thì vẫn cần R1 khác duyệt cuối, để luôn có một kiểm soát độc lập.
  - **Trả lại** về Nháp (sửa tiếp), **Từ chối** là đóng, **Can thiệp (override)** phải có lý do. Ba quyết định khác nhau nên lịch sử phân biệt được.
- **Giới hạn:** `demo` tự duyệt được là ngoại lệ demo. Email là kênh phụ; kênh chính là thông báo trong ứng dụng.

### F-15 Ban hành, snapshot, hiệu lực, đính chính

- **Mục đích:** Biến đề xuất đã duyệt thành phiên bản CTĐT chính thức có số quyết định, và tự áp dụng từ học kỳ hiệu lực.
- **Ở đâu:** CTĐT > Tổng quan (thẻ ban hành); ban hành lần đầu `/release`; duyệt cuối `/final-approval`; Phiên bản > Lịch sử; Học kỳ và khóa tuyển sinh (`/semesters`).
- **Demo:** mở Lịch sử phiên bản, xem các kiểm tra trước ban hành, mở duyệt cuối DX-2026-0099, xem phiên bản chờ hiệu lực.
- **Vì sao:**
  - **Ban hành là khóa**: nội dung đóng băng, đề cương được ghim, nên văn bản pháp lý tái hiện được mà không phải chạy lại chuỗi sửa.
  - **Duyệt khác áp dụng**: ký hôm nay nhưng chỉ có hiệu lực từ **ngày đầu học kỳ hiệu lực** (job BullMQ chuyển trạng thái CHỜ → ĐANG ÁP DỤNG), để sinh viên không đổi luật giữa kỳ.
  - Số phiên bản `major.minor`: đổi khung chương trình hoặc PLO cấp CTĐT tăng **major** (2.0); còn lại tăng **minor** (1.1) (`version-number.ts`, BR-24).
  - Một đề cương dùng chung thay đổi sẽ sinh phiên bản mới cho **mọi CTĐT đang dùng nó**, vì mỗi CTĐT phải có phiên bản đầy đủ ghim đúng đề cương.
  - Sai thì ra **phiên bản đính chính**, không xóa, để giữ lịch sử quyết định.
- **Giới hạn:** ngoại lệ Phòng Đào tạo cho phép một số thay đổi (không phải công thức điểm) dùng học kỳ đã bắt đầu, nên đừng nói "tuyệt đối không bao giờ". C9: lịch học kỳ chính thức chưa có.

### F-16 So sánh phiên bản và gán khóa

- **Mục đích:** Thấy hai phiên bản khác nhau ở đâu, và quyết định khóa tuyển sinh nào học theo phiên bản nào.
- **Ở đâu:** CTĐT > Phiên bản > So sánh; Gán cho khóa.
- **Demo:** chọn hai phiên bản, xem khác biệt khung / PLO / đề cương, rồi mở Gán cho khóa.
- **Vì sao:**
  - So sánh đọc **nội dung đã đóng băng**, không dựng lại từ lịch sử đề xuất.
  - Khóa cũ **chỉ nhận phiên bản mới khi R1 chọn**; ban hành không tự chuyển mọi khóa (F16-01).
  - Gán theo học kỳ, có kiểm tra revision, nên hộp thoại cũ không ghi đè lịch đã đổi.
  - "Chưa gán" là kết quả riêng, không tự lấy phiên bản mới nhất.

### F-17 Hồ sơ sinh viên và kết quả học tập

- **Mục đích:** Lưu hồ sơ sinh viên, CTĐT đang học và kết quả học tập, làm dữ liệu đầu vào cho xét đăng ký và tốt nghiệp.
- **Ở đâu:** Sinh viên > Hồ sơ sinh viên (`/students`).
- **Ai:** R1; R3 trong CTĐT mình phụ trách; R2/R4/R5 **không** xem được hồ sơ.
- **Demo:** chọn ngữ cảnh học kỳ/CTĐT, mở một sinh viên, xem đăng ký, phiên bản áp dụng, các lần học lại.
- **Vì sao:**
  - Ngữ cảnh = sinh viên + CTĐT + học kỳ, vì có chuyển ngành, học song ngành, đổi phiên bản.
  - Giữ nguyên trạng thái đạt/không đạt và thang điểm do Trường cung cấp; **không tự quy đổi** khi chưa có quy định.
  - Giữ mọi lần học; bộ đọc chung chọn kết quả tốt nhất áp dụng.
  - CSDL Trường **ưu tiên hơn** Excel khi xung đột (DEC-10).
- **Giới hạn:** C2, chính sách cấp tài khoản. Đồng bộ tạo hồ sơ mới nhưng không tự tạo tài khoản đăng nhập.

### F-18 Điều kiện đăng ký học phần

- **Mục đích:** Cho biết sinh viên có đủ điều kiện đăng ký một học phần ở học kỳ tới không, và nếu không thì vì sao.
- **Ở đâu:** nhân viên dùng Học phần trong khung (chọn sinh viên + học kỳ); sinh viên dùng Đăng ký HP (`/student/registration`).
- **Demo:** xem cột **Đăng ký được?**, mở lý do không đủ điều kiện, xem nhóm song hành có điều kiện.
- **Vì sao:**
  - Ba kết quả: được / không được / **có điều kiện**. "Đã hoàn thành" hiện riêng, không phải một kết quả đăng ký.
  - Trượt vẫn tính là "đã học trước" nhưng không tính là "đã qua tiên quyết".
  - Điều kiện lấy từ **khung đóng băng của sinh viên**, không lấy danh mục hôm nay.
  - Kết quả có điều kiện liệt kê **cả nhóm song hành bắc cầu** phải đăng ký cùng.
- **Giới hạn:** chỉ là tư vấn điều kiện, không xếp chỗ hay xếp lịch. C3: chính sách miễn học.

### F-19 Xét tốt nghiệp

- **Mục đích:** Tự đối chiếu kết quả học tập với khung chương trình để kết luận sinh viên đủ điều kiện tốt nghiệp chưa, còn thiếu gì.
- **Ở đâu:** Sinh viên > Xét tốt nghiệp (`/graduation`); đợt `/graduation/batches`.
- **Demo:** chọn sinh viên/CTĐT/học kỳ, bấm **Xem kết quả**, xem thiếu hụt bắt buộc / tự chọn / tổng / điều kiện, mở một lần xét đã lưu.
- **Vì sao:**
  - **Xem thử khác Lưu**: khám phá không tạo quyết định chính thức.
  - Lần xét đã lưu là **snapshot chỉ thêm**: đính chính điểm sau này không viết lại kết luận cũ, mà đính chính sẽ lên lịch xét lại.
  - Phân biệt "không đủ điều kiện" với "**không xác định được**", vì thiếu dữ liệu không phải là sinh viên trượt.
  - Học phần tương đương không tính hai lần; học phần bắt buộc 0 tín chỉ vẫn phải hoàn thành.
  - Đợt xét chốt danh sách và chạy theo khối bền vững, nên chạy lại không bị trùng.
- **Giới hạn:** C4, điều kiện tốt nghiệp của Khoa chưa chốt.

### F-20 Cổng sinh viên

- **Mục đích:** Cho sinh viên tự xem CTĐT của mình, tiến độ, điều kiện đăng ký và tình trạng tốt nghiệp.
- **Ở đâu:** đăng nhập `demo.sinhvien`; menu Tổng quan / Chương trình / Tiến độ / Đăng ký HP / Tốt nghiệp.
- **Demo:** Chương trình > mở đề cương; Tiến độ; Đăng ký HP; Tốt nghiệp.
- **Vì sao:**
  - Khung giao diện gọn, hợp điện thoại, vì sinh viên chỉ cần vài việc cá nhân.
  - Endpoint cổng **lấy sinh viên từ phiên**, không nhận mã sinh viên từ URL, nên không xem trộm được người khác.
  - Tiến độ, điều kiện, tốt nghiệp **dùng đúng engine của nhân viên**, nên cùng ngữ cảnh luôn cùng câu trả lời.
  - Link đề cương mở **bản được ghim** trong phiên bản của sinh viên.
- **Trước demo:** phải tạo `demo.sinhvien` trên VM (§0).

### F-21 API dDUT (chỉ đọc)

- **Mục đích:** Cho ứng dụng dDUT của Trường đọc dữ liệu CTĐT và tiến độ sinh viên qua API, không phải nhập lại.
- **Ở đâu:** Dữ liệu và tích hợp > Bên tích hợp dDUT, trên demo hiện **Sắp có**. API ở `/api/v1/...`.
- **Vì sao:**
  - Xác thực bằng **API key băm**, tách khỏi phiên web: mỗi bên tích hợp có danh tính riêng, thu hồi được, giới hạn tốc độ riêng.
  - Lời gọi chạy dưới principal tổng hợp có giới hạn, **không giả làm R1**.
  - Dùng lại bộ đọc của cổng sinh viên, nên dDUT và web trả cùng kết quả. Có ghi log và giới hạn tốc độ.
- **Giới hạn:** C6. **Không bao giờ nhúng key vào app di động.** Chưa có UI xoay key hay xem log.

### F-22 Đồng bộ CSDL Trường

- **Mục đích:** Tự kéo sinh viên và kết quả học tập từ CSDL đào tạo của Trường, để dữ liệu luôn mới mà không cần Excel.
- **Ở đâu:** Dữ liệu và tích hợp > Đồng bộ CSDL Trường, trên demo hiện **Sắp có**.
- **Vì sao:**
  - **Chỉ đọc** từ Trường, không ghi ngược, vì Trường là nguồn chính thức của sinh viên và điểm.
  - Dòng nhập dùng lại kiểm tra/ghi của F-17, nên không có hai bộ luật điểm.
  - Mã ánh xạ được kiểm lúc cấu hình và mỗi lần chạy; lỗi thì không áp dụng nửa vời.
- **Giới hạn:** C5. Hợp đồng `cms_sync_v1` là do dự án định nghĩa, chưa phải hợp đồng thật của Trường; cần mạng nội bộ Trường.

### F-23 Báo cáo

- **Mục đích:** Tổng hợp số liệu phục vụ quản lý và kiểm định: so sánh CTĐT, phân bổ tín chỉ, hồ sơ kiểm định, thống kê đề xuất.
- **Ở đâu:** Báo cáo > So sánh chương trình / Phân bổ tín chỉ / Hồ sơ kiểm định / Thống kê đề xuất.
- **Demo:** so hai CTĐT (chung / riêng / tương đương), Phân bổ tín chỉ, độ sẵn sàng của Hồ sơ kiểm định.
- **Vì sao:**
  - Tín chỉ liệt kê khác tín chỉ yêu cầu tốt nghiệp, vì kho tự chọn lớn hơn số phải học.
  - Xuất hồ sơ kiểm định cần phiên bản đã ban hành có đề cương ghim và thành phần điểm, để không xuất ra file thiếu trông như đầy đủ.
  - Thời gian xử lý tính từ các vòng duyệt thật, không lấy `updatedAt`.
  - Xuất đồng bộ (không qua hàng đợi) vì dữ liệu mỗi phiên bản nhỏ.
- **Giới hạn:** mẫu workbook là chung, chưa phải mẫu AUN/Bộ/Trường.

### F-24 Đồ thị, PDF, dòng thời gian, sức khỏe

- **Mục đích:** Giúp nhìn nhanh CTĐT: đồ thị quan hệ học phần, bản PDF để in/ký, lịch sử phiên bản theo thời gian, danh sách vấn đề cần sửa.
- **Ở đâu:** CTĐT > Phân tích > Đồ thị học phần / Sức khỏe chương trình; Phiên bản > Dòng thời gian; PDF từ công cụ ban hành.
- **Vì sao:**
  - Đồ thị xếp cột theo học kỳ, không kéo thả tự do; có danh sách tương đương cho trình đọc màn hình.
  - **Sức khỏe chỉ chẩn đoán, không chặn**; việc chặn là của Kiểm tra nhất quán.
  - PDF render từ dữ liệu chụp lúc yêu cầu; bản nháp có watermark. Lúc tải xuống hệ thống kiểm lại quyền.
- **Giới hạn:** C7, mẫu PDF chính thức; PDF cần Chromium trên máy chủ.

### F-25 Ủy quyền duyệt, email, nhắc quá hạn

- **Mục đích:** Giữ luồng duyệt không bị tắc khi người duyệt vắng (ủy quyền), và nhắc người duyệt khi đề xuất quá hạn.
- **Ở đâu:** Đề xuất và phê duyệt > Ủy quyền duyệt (`/approval-delegations`); thông báo email hiện dòng **Sắp có** trên trang.
- **Vì sao:**
  - Chỉ ủy quyền được trách nhiệm **đang thật sự giữ** (phân công điều phối/giám đốc).
  - Ủy quyền không độc quyền: người gốc vẫn duyệt được, và lịch sử ghi "ai duyệt thay ai".
  - **Cấp 3 không ủy quyền được.**
  - Email lỗi không gửi lại, vì thà thiếu một email (thấy được) còn hơn gửi trùng.
- **Giới hạn:** C8, SMTP; email mặc định tắt.

### F-26 Sao lưu và phục hồi

- **Mục đích:** Bảo đảm dữ liệu và tệp đính kèm khôi phục được khi có sự cố.
- **Ở đâu:** Quản trị > Sao lưu và phục hồi, trên demo hiện **Sắp có**.
- **Vì sao:**
  - Một bộ sao lưu gồm **CSDL + tệp đính kèm** kèm hash, vì CSDL phục hồi mà thiếu tệp thì vô dụng.
  - Giữ 30 bộ **hoàn chỉnh**, không phải 30 lần thử.
  - Danh mục sao lưu nằm ngoài CSDL được phục hồi.
  - Phục hồi là lệnh CLI có người nghiệm thu, không có nút trên web.
- **Giới hạn:** demo không cấp ổ lưu trữ; chưa diễn tập phục hồi thật nhiều đêm.

### F-27 Triển khai, thử tải, giám sát

- **Mục đích:** Đưa hệ thống lên máy chủ thật, kiểm chứng chịu tải và theo dõi tình trạng hoạt động.
- **Ở đâu:** Quản trị > Trạng thái hệ thống (`/health`).
- **Vì sao:**
  - Chỉ Caddy mở cổng và làm HTTPS; CSDL và Redis không ra ngoài.
  - Migration phải thành công trước khi thay API.
  - Tiêu chí tải: 160 phiên sinh viên + 40 phiên nhân viên trong 15 phút.
  - Demo trên Oracle Cloud (VM x86 dùng tín dụng trial tới khoảng 2026-12-01, vì A1 Always Free hết chỗ), tự deploy khi merge `main`.
- **Giới hạn:** trang xanh không chứng minh chịu tải hay uptime; thử tải chuẩn còn chờ fixture.

### F-28 Tài khoản sinh viên demo

- **Mục đích:** Có một sinh viên mẫu không chứa dữ liệu thật, để trình diễn cổng sinh viên và app dDUT an toàn.
- `demo.sinhvien` / `demo`, mã `DEMOSV001`, đăng ký PRIMARY theo mẫu thật, **điểm hoàn toàn tổng hợp**, không gắn vào sinh viên thật.
- Có cả môn đạt, trượt và đang học, để demo được lý do chặn và phần còn thiếu.
- App di động kiểu dDUT nằm ở repo riêng `dut_curriculum_app` (Flutter), dùng API hiện có qua cookie phiên; trỏ được về `https://ctdt.oguri-lab.io.vn/api`. Nó chỉ minh họa việc tiêu thụ API, không thay app dDUT chính thức.
- **Trạng thái:** chưa tạo trên VM (§0).

---

## 6. Trang "Sắp có" trên demo

Bật bằng `VITE_COMING_SOON`. Đây **không phải "chưa làm"**: mã đã có và đã test, nhưng cần hạ tầng mà demo không có.

| Tính năng | Kiểu ẩn | Thiếu gì |
|---|---|---|
| Đồng bộ CSDL Trường (F-22) | Cả trang | Mạng và tài khoản đọc CSDL Trường |
| Bên tích hợp dDUT (F-21) | Cả trang | Thỏa thuận máy chủ tin cậy phía Trường |
| Sao lưu và phục hồi (F-26) | Cả trang | Ổ lưu trữ bền |
| Email nhắc việc (F-25) | Chỉ dòng thông báo trên trang | SMTP của Trường |

## 7. Quyết định xuyên suốt

| Quyết định | Vì sao |
|---|---|
| Monolith module hóa: NestJS 12 + Prisma 7 + PostgreSQL 18; React 19 + Vite 8 + Ant Design 6; Node 24 | Ranh giới tính năng rõ mà không tốn vận hành microservice; dùng chung bộ đọc học vụ |
| Phiên máy chủ trong PostgreSQL, không JWT | Khóa tài khoản có hiệu lực ngay; Redis mất không đăng xuất mọi người |
| Ma trận quyền × phạm vi × trạng thái ban hành | Tên vai trò không đủ diễn tả quyền thật |
| Redis **chỉ** cho hàng đợi; job chạy lại an toàn | Mất Redis không mất quyết định học vụ |
| Collation ICU `vi-VN`, kiểm khi khởi động | Sắp xếp và tìm kiếm tiếng Việt đúng; sai thì báo ngay, không âm thầm |
| Khóa chính `cuid2` + mã nghiệp vụ ổn định | Định danh dòng tách khỏi nội dung sửa được |
| Thập phân truyền dạng chuỗi | Tín chỉ, điểm, trọng số không sai số float |
| Kiểu FE sinh từ OpenAPI backend | Một hợp đồng, không viết tay hai lần |
| Ant Design `vi_VN`, giao diện ghim theo chuandaura.dut.udn.vn | Bảng/form hành chính nhất quán, nhận diện Trường |
| Excel = đường nhập phụ, luôn chạy thử trước | Không vượt qua kiểm tra, không đè dữ liệu Trường |
| Tính toán ở backend, không ở React/app | Web, cổng SV, dDUT trả cùng một đáp án |
| Ngoại lệ demo: `demo` R1–R5 + `canSelfApprove`; script `db:demo-org/fixtures/syllabi/curate/student` | Một người khách đi hết luồng; người dùng thường vẫn bị chặn tự duyệt |

## 8. Câu hỏi thầy/cô có thể hỏi

| Hỏi | Trả lời ngắn |
|---|---|
| Sao học phần này sửa được, học phần kia phải "Tạo đề xuất"? | Backend xét quyền + phạm vi + đã ban hành chưa. Đã ban hành thì phải đi đề xuất |
| Sao Ban lãnh đạo khoa không duyệt? | R2 là vai trò giám sát/bình luận; chuỗi được chốt là Điều phối → Giám đốc → Phòng Đào tạo |
| Sao có cấp bị bỏ qua? | Định tuyến theo trách nhiệm bị ảnh hưởng, có ghi lý do (người tạo, học phần khoa khác, đề xuất tổ chức). Cấp cuối luôn cần R1 độc lập |
| Sao `demo` tự duyệt được? | Cờ `canSelfApprove` chỉ có ở tài khoản demo; người dùng thật bị chặn |
| Sao đề cương dùng chung mà ma trận PLO lại riêng? | Nội dung dạy thuộc học phần; đóng góp vào chuẩn đầu ra tùy ngành |
| Sửa một đề cương sao nhiều CTĐT ra phiên bản mới? | Mỗi CTĐT phải có phiên bản đầy đủ ghim đúng bản đề cương mới |
| Sao duyệt rồi chưa áp dụng ngay? | Áp dụng từ đầu học kỳ hiệu lực, không đổi luật giữa kỳ |
| Sai thì sao không xóa phiên bản? | Ra phiên bản đính chính để giữ lịch sử pháp lý |
| Sao nhóm tự chọn liệt kê nhiều tín chỉ hơn yêu cầu? | Đó là kho chọn; chỉ tính mức tối thiểu |
| Sao sinh viên thấy phiên bản khác bản mới nhất? | Phiên bản áp dụng theo khóa và lịch học kỳ, không phải bản mới nhất |
| Tương đương và thay thế khác gì? | Tương đương: đối xứng, bắc cầu. Thay thế: một chiều cho học phần đã ngừng |
| Sao tốt nghiệp có "không xác định được"? | Thiếu dữ liệu hay chính sách không phải là sinh viên trượt |
| Sao không tính trên app di động? | Mọi nơi dùng chung engine backend, nên cùng một câu trả lời |
| "Sắp có" là chưa làm? | Không: đã có mã, chỉ thiếu hạ tầng (CSDL Trường, SMTP, ổ sao lưu, máy chủ tin cậy) |
| Đã dùng chính thức được chưa? | Chưa: còn chờ Khoa trả lời C1..C10, mẫu kiểm định chưa chính thức, chưa có PI |
| Sao không dùng JWT? | Cùng origin; phiên máy chủ cho khóa tài khoản và hết hạn tức thì |
| Dữ liệu ở đâu ra? | Dựng lại từ bản sao CSDL đào tạo của Trường (`ctdt_real`); nhóm chuyên môn, đề cương mẫu và sinh viên demo là tổng hợp |

## 9. Giới hạn cần nói thẳng (đầu vào Khoa còn chờ)

| Mã | Chờ gì |
|---|---|
| C1 | Đơn vị và ngưỡng công thức điểm |
| C2 | Cấp tài khoản sinh viên, phát mật khẩu, lưu trữ |
| C3 | Miễn học và chính sách điều kiện đăng ký |
| C4 | Điều kiện tốt nghiệp, phân bổ tín chỉ tự do |
| C5 | Hợp đồng CSDL Trường và quyền đọc |
| C6 | Giữ/phát khóa dDUT |
| C7 | Mẫu PDF, font |
| C8 | SMTP |
| C9 | Lịch học kỳ chính thức |
| C10 | File Excel thật, nhóm tự chọn |

Ngoài ra: trạng thái GRADUATED/WITHDRAWN không suy ra được từ nguồn; số quyết định thật để NULL; 37 khung lệch tín chỉ so với khai báo, và Kiểm tra nhất quán sẽ hiện chúng (có thể dùng làm ví dụ demo F-08).
