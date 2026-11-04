# Kế hoạch: Cụ thể hóa yêu cầu — Hệ thống Quản lý Chương trình đào tạo (PBL6)

## Context

Khoa CNTT hiện quản lý Chương trình đào tạo (CTĐT) bằng Excel: khung chương trình, đề cương chi tiết,
công thức điểm, PLO/CLO, quan hệ học trước/tiên quyết/song hành đều nằm rải rác trong file. Hệ quả:
không có versioning, không có quy trình duyệt, không kiểm tra được tính nhất quán (tổng tín chỉ, chu
trình tiên quyết, độ phủ PLO), và sinh viên không tra cứu được tiến độ học tập theo đúng phiên bản
CTĐT của khóa mình.

Yêu cầu hiện đang là các note rời rạc. Việc cần làm ở bước này **không phải viết code**, mà là biến
note thành một bộ tài liệu đặc tả đủ chặt để bắt đầu thiết kế CSDL và chia task — kèm danh sách edge
case và danh sách câu hỏi còn treo cần chốt với giảng viên hướng dẫn / phía khoa.

Thư mục dự án hiện trống, `REQUIREMENTS.md` là file rỗng. Đây là greenfield.

## Quyết định đã chốt (từ Q&A)

| Vấn đề | Chốt |
|---|---|
| Versioning | **Snapshot toàn CTĐT** — mỗi lần Phòng ĐT ban hành tạo 1 bản bất biến của cả khung + đề cương + PLO/CLO |
| Đề cương chi tiết | **1 học phần = 1 đề cương**, dùng chung mọi CTĐT |
| Nguồn dữ liệu sinh viên/điểm | **Cả hai**: import Excel *và* kết nối DB có sẵn → cần lớp ingestion 2 nguồn |
| Luồng duyệt | **3 cấp**: Trưởng nhóm CM → Giám đốc CTĐT → Phòng Đào tạo |

> ⚠️ Mâu thuẫn cần bạn xử lý: "1 đề cương dùng chung" + "CLO map vào PLO của CTĐT" là xung đột trực
> tiếp — cùng một học phần nằm trong 2 CTĐT sẽ có 2 bộ PLO khác nhau để map. Xem câu hỏi **Q1** ở mục
> Câu hỏi cần chốt. Tôi sẽ đặc tả theo hướng: **đề cương (gồm CLO) dùng chung; riêng bảng map
> CLO→PLO gắn với cặp (CTĐT, học phần)** — đây là cách duy nhất giữ được cả hai ràng buộc.

## Deliverables

| File | Nội dung |
|---|---|
| `REQUIREMENTS.md` | Tài liệu chính: bối cảnh, phạm vi, actor + ma trận phân quyền, danh mục tính năng FR, quy trình duyệt, versioning, NFR, out-of-scope |
| `docs/DOMAIN-MODEL.md` | Thực thể + quan hệ, giải nghĩa từng cột trong bảng Excel hiện tại, đặc tả rules engine |
| `docs/EDGE-CASES.md` | Edge case + hướng xử lý đề xuất, đánh dấu cái nào phải quyết định nghiệp vụ |
| `docs/OPEN-QUESTIONS.md` | Câu hỏi còn treo, phân loại theo mức độ chặn tiến độ |

Toàn bộ viết bằng **tiếng Việt**, có mã định danh (FR-xx, EC-xx, Q-xx) để tham chiếu chéo và đưa vào
báo cáo đồ án.

---

## Nội dung sẽ đưa vào `REQUIREMENTS.md`

### 1. Actors & phân quyền

6 actor: **Phòng Đào tạo** (quyền cao nhất, chốt cuối) · **Ban lãnh đạo khoa** (Trưởng/Phó khoa) ·
**Giám đốc CTĐT** (phụ trách 1..n CTĐT) · **Trưởng nhóm chuyên môn** (4 nhóm) · **Giảng viên** (thuộc
n nhóm CM) · **Sinh viên** (chỉ đọc).

Nguyên tắc đặc tả: quyền là **(vai trò × phạm vi đối tượng)**, không phải vai trò toàn cục. Ví dụ
Giám đốc CTĐT chỉ duyệt được CR thuộc CTĐT mình phụ trách; Trưởng nhóm CM chỉ duyệt CR của học phần
thuộc nhóm mình. Tài liệu sẽ có 1 bảng ma trận `vai trò × hành động × phạm vi`.

### 2. Danh mục tính năng

**M1 — Quản trị tổ chức & phân quyền**
- Cây đơn vị: Khoa → Nhóm chuyên môn; giảng viên ↔ nhóm CM là quan hệ n–n.
- Gán Giám đốc CTĐT ↔ CTĐT (1 GĐ phụ trách n CTĐT); gán Trưởng nhóm CM.
- Ủy quyền duyệt khi người duyệt vắng mặt (có thời hạn).

**M2 — Danh mục học phần**
- Mã HP, tên VI/EN, số tín chỉ **kiểu số thực** (0 / 1 / 2.5 / 4), khoa phụ trách, loại HP
  (lý thuyết / thực hành / thí nghiệm / đồ án / ĐATN), trạng thái (đang dùng / ngưng).
- 5 loại quan hệ giữa học phần: **học trước**, **tiên quyết**, **song hành**, **tương đương**,
  **thay thế**.
- Học phần có thể thuộc khoa khác (Toán, Lý, Lý luận chính trị) → khoa CNTT không sửa được đề cương.

**M3 — Chương trình đào tạo & khung chương trình**
- Metadata: mã CT, tên, ngành + mã ngành, **trình độ (kỹ sư / cử nhân)**, khóa áp dụng, số học kỳ,
  tổng TC yêu cầu / TC bắt buộc / TC tự chọn.
- Dòng khung: (học phần, học kỳ, ký hiệu khối kiến thức, bắt buộc|tự chọn, nhóm tự chọn, điểm học,
  điểm chuyển, cờ HT ĐA / TQ ĐA, ghi chú).
- **Nhóm học phần tự chọn**: chọn đủ N tín chỉ (hoặc M học phần) trong danh sách — không phải quan hệ
  1-1 giữa 8 TC tự chọn và 8 TC học phần.
- Nhân bản CTĐT để làm nền cho khóa mới (không phải quy trình tạo mới chính thức — cái đó out of scope).
- Import Excel (phục vụ migration dữ liệu hiện có), export Excel/PDF bản in.

**M4 — PLO / CLO & ma trận**
- PLO thuộc CTĐT; CLO thuộc đề cương học phần.
- Ma trận **CLO ↔ PLO** theo cặp (CTĐT, học phần), mức đóng góp (I/R/M hoặc thang 1–3).
- Ma trận **học phần ↔ PLO** suy ra từ CLO↔PLO, cho phép override thủ công.
- Báo cáo lỗ hổng: PLO không học phần nào cover · CLO không map PLO nào · HP không đóng góp PLO nào.

**M5 — Đề cương chi tiết & công thức điểm**
- Nội dung: mô tả HP, mục tiêu, CLO, nội dung theo tuần/chương, phương pháp dạy-học, phương pháp
  đánh giá, tài liệu tham khảo. Song ngữ VI/EN (phục vụ kiểm định).
- **Công thức điểm**: danh sách thành phần đánh giá (chuyên cần, bài tập, giữa kỳ, thực hành, cuối kỳ)
  × trọng số, ràng buộc tổng = 100%.
- Thành phần **điều kiện** (ví dụ chuyên cần dưới ngưỡng → cấm thi) và **điểm liệt**.
- Map thành phần đánh giá ↔ CLO (mỗi CLO phải được đánh giá ≥ 1 lần).
- Đính kèm file bản ký (PDF/Word), file cũng được version theo đề cương.

**M6 — Quy trình đề xuất & phê duyệt (3 cấp)**
- Đơn vị luân chuyển là **Change Request (CR)**, không ai sửa trực tiếp bản đang hiệu lực.
- Loại CR: sửa công thức điểm · sửa PLO/CLO · sửa nội dung đề cương · sửa khung CTĐT · sửa quan hệ HP.
- Vòng đời: `NHÁP → CHỜ TRƯỞNG NHÓM CM → CHỜ GĐ CTĐT → CHỜ PHÒNG ĐT → ĐÃ DUYỆT (chờ hiệu lực) → HIỆU LỰC`
  Nhánh phụ: `TRẢ LẠI` (kèm lý do bắt buộc, quay về nháp) · `TỪ CHỐI` (đóng) · `THU HỒI` (người tạo rút).
- **Auto-skip**: nếu người tạo CR chính là người duyệt cấp đó thì bỏ qua cấp, ghi log lý do bỏ qua.
- **Ban lãnh đạo khoa**: quyền xem + bình luận trên mọi CR của khoa, không phải chốt chặn.
- Xem **diff** trước/sau trước khi bấm duyệt.
- Thông báo in-app + email; nhắc hạn khi CR treo quá lâu.

**M7 — Versioning & ban hành**
- Phòng ĐT duyệt xong → sinh **snapshot bất biến**: toàn bộ khung + đề cương + PLO/CLO tại thời điểm đó.
- Metadata ban hành: số phiên bản, số quyết định, ngày ký, **ngày/học kỳ hiệu lực**, khóa áp dụng,
  người ban hành.
- So sánh 2 phiên bản bất kỳ (diff ở cấp học phần và cấp đề cương).
- Thu hồi phiên bản ban hành nhầm: chỉ Phòng ĐT, bắt buộc nêu lý do, thực hiện bằng cách ban hành
  phiên bản đính chính — **không xóa lịch sử**.
- Ánh xạ khóa sinh viên → phiên bản CTĐT áp dụng.

**M8 — Rules engine & tự động hóa** *(phần "công thức" trong note)*
- Tự tính tổng TC theo học kỳ / khối kiến thức / bắt buộc–tự chọn, đối chiếu với số khai báo (130 /
  122 / 8) → **cảnh báo khi lệch**.
- Tính cột **"Đăng ký được?"** từ bảng điểm sinh viên, trả về 3 trạng thái như file Excel hiện tại:
  `Được` · `Không được (thiếu HP X)` · `Được, nếu ĐK được HP song hành`.
- Kiểm tra tính hợp lệ khung: **phát hiện chu trình** tiên quyết; phát hiện HP tiên quyết bị xếp ở
  học kỳ **sau** học phần phụ thuộc.
- **Degree audit**: đủ TC bắt buộc, đủ từng nhóm tự chọn, **có tính học phần tương đương**, cộng các
  điều kiện phụ (chuẩn ngoại ngữ, GDTC, GDQP, chứng chỉ).
- Validate đề cương: tổng trọng số = 100%, mọi CLO được đánh giá, mọi PLO được cover.

**M9 — Cổng sinh viên & API cho dDUT**
- Sinh viên xem CTĐT **đúng phiên bản theo khóa của mình**, bố cục theo học kỳ.
- Tiến độ học tập: đã học / đang học / còn thiếu, % hoàn thành, HP nào đang chặn HP nào.
- Xem đề cương chi tiết + công thức điểm của từng HP.
- Gợi ý học phần đủ điều kiện đăng ký cho học kỳ tới.
- REST API + tài liệu OpenAPI để dDUT tích hợp. **Web là trọng tâm**, app chỉ tiêu thụ API.
- F-28: ứng dụng di động độc lập mô phỏng dDUT chỉ dùng cho trình diễn, ở repo riêng `dut_curriculum_app`, tiêu thụ API hiện có bằng phiên cookie; không thay thế ứng dụng dDUT của Trường. Tài khoản `demo.sinhvien` dùng hồ sơ và kết quả tổng hợp, không gắn với sinh viên thật.

**M10 — Tích hợp dữ liệu (Excel + DB)**
- Import Excel: danh mục HP, khung CTĐT, bảng điểm SV. Bắt buộc có **dry-run** và báo lỗi theo từng
  dòng trước khi ghi.
- Kết nối DB có sẵn (read-only): sinh viên, bảng điểm, lớp học phần.
- Job đồng bộ định kỳ + nhật ký đồng bộ + chính sách khi 2 nguồn mâu thuẫn.

**M11 — Tra cứu, báo cáo, kiểm định**
- Đối sánh 2 CTĐT (ví dụ cử nhân vs kỹ sư cùng ngành) để thấy phần chênh.
- Thống kê TC theo khối kiến thức.
- Xuất ma trận PLO/CLO phục vụ AUN-QA / báo cáo Bộ.
- **Audit log bất biến**: ai sửa gì, khi nào, CR nào, phiên bản nào.

### 3. Yêu cầu phi chức năng
Monolith (đã chốt) · toàn bộ UI tiếng Việt · audit log không cho sửa/xóa · phân trang & tìm kiếm cho
mọi danh sách · degree audit phải chạy được cho cả khóa chứ không chỉ 1 SV · backup + khôi phục ·
xác thực (cân nhắc SSO trường) · responsive cho phần tra cứu của sinh viên.

### 4. Ngoài phạm vi
Quy trình **tạo mới** CTĐT từ đầu (đã chốt bỏ) · xếp thời khóa biểu · đăng ký học phần thực tế ·
nhập điểm · quản lý lớp học phần · thanh toán học phí.

---

## Nội dung sẽ đưa vào `docs/DOMAIN-MODEL.md`

Thực thể chính: `DonVi`, `NguoiDung`, `VaiTro`, `NhomChuyenMon`, `HocPhan`, `QuanHeHocPhan`,
`DeCuongChiTiet`, `CLO`, `ThanhPhanDanhGia`, `ChuongTrinhDaoTao`, `PhienBanCTDT`, `DongKhungCTDT`,
`NhomTuChon`, `PLO`, `MaTranCLO_PLO`, `ChangeRequest`, `BuocDuyet`, `SinhVien`, `KetQuaHocTap`,
`NhatKyHeThong`.

Tài liệu này cũng **giải nghĩa các cột trong file Excel hiện tại** — đây là chỗ tôi đang phải suy đoán
và cần bạn xác nhận (xem Q3, Q4):

| Cột | Suy đoán của tôi | Cần xác nhận |
|---|---|---|
| Ký hiệu | Mã khối kiến thức (đại cương / cơ sở ngành / chuyên ngành) | ✅ |
| HT ĐA | Học phần được tính là "đã hoàn thành" cho điều kiện làm đồ án | ✅ |
| TQ ĐA | Học phần là tiên quyết của đồ án | ✅ |
| Điểm học | Điểm tối thiểu (thang 4?) để coi là đã học xong, dùng cho ràng buộc học trước | ✅ |
| Điểm chuyển | Điểm tối thiểu để được chuyển tiếp / miễn học | ✅ |
| Đăng ký được? | **Cột suy diễn** — kết quả rules engine, không phải dữ liệu nhập tay | ✅ |

Phần rules engine sẽ đặc tả bằng bảng quyết định (điều kiện → kết quả) chứ không mô tả bằng văn xuôi.

---

## Edge cases sẽ đưa vào `docs/EDGE-CASES.md`

**Dữ liệu & khung chương trình**
1. Học phần **0 tín chỉ** (TH Kỹ thuật lập trình) — không cộng vào tổng nhưng vẫn bắt buộc hoàn thành.
2. Tín chỉ **lẻ 2.5** — cấm dùng kiểu integer ở mọi tầng.
3. Tổng TC khai báo (130) **≠** tổng cộng thực tế từ khung → cảnh báo, cho override kèm lý do.
4. Tổng TC của danh sách HP tự chọn **lớn hơn** hạn mức tự chọn (chọn 8 TC trong 20 TC).
5. Ràng buộc song hành dây chuyền: A song hành B, B chưa đủ điều kiện → A cũng không đăng ký được.
6. **Chu trình** tiên quyết (A cần B, B cần A) — phải chặn khi lưu, không phải khi hiển thị.
7. HP tiên quyết bị xếp ở học kỳ **sau** HP phụ thuộc.
8. Học phần dùng chung nhiều CTĐT (Giải tích 1) → sửa đề cương ảnh hưởng dây chuyền, phải cảnh báo
   danh sách CTĐT bị ảnh hưởng trước khi trình duyệt.
9. Học phần thuộc **khoa khác** → khoa CNTT chỉ được đề xuất, không được tự duyệt.

**Học phần tương đương**
10. Tương đương có **đối xứng** không? Có **bắc cầu** không? (A≡B, B≡C ⇒ A≡C?)
11. Tương đương **khác số tín chỉ** (A 3TC ↔ B 2TC) → xử lý phần TC thiếu thế nào.
12. Tương đương **xuyên CTĐT / xuyên phiên bản** (HP của khung cũ ↔ HP của khung mới).

**Phân quyền & luồng duyệt**
13. Giám đốc CTĐT **tự tạo CR** → ai duyệt cấp của chính mình (auto-skip).
14. Giảng viên thuộc **nhiều nhóm CM** → CR của họ đi qua trưởng nhóm nào.
15. Người duyệt nghỉ / chuyển công tác → ủy quyền, CR treo vô thời hạn.
16. Phòng ĐT **từ chối sau khi 2 cấp dưới đã duyệt** → CR quay về đâu, có phải duyệt lại từ đầu.
17. **Hai CR song song** đụng cùng một đề cương → phát hiện xung đột, khóa lạc quan (optimistic lock).

**Versioning**
18. Sửa đề cương khi **đang giữa học kỳ**, lớp đang học → hiệu lực từ học kỳ sau, không hồi tố.
19. Sinh viên khóa cũ, CTĐT ra phiên bản mới → giữ nguyên phiên bản cũ; nhưng nếu HP cũ **không còn
    mở lớp** thì phải có HP thay thế.
20. Ban hành nhầm phiên bản → thu hồi thế nào mà không phá vỡ tính bất biến của lịch sử.
21. Sinh viên **chuyển ngành / học song ngành / học lại** → áp dụng phiên bản CTĐT nào.
22. Chuyển đổi **cử nhân → kỹ sư** (khác tổng TC) → công nhận TC đã học.

**Đề cương & điểm**
23. Tổng trọng số điểm **không tròn 100%**.
24. Thang điểm: **thang 4, thang 10, hay điểm chữ A/B/C**? "Điểm học = 4" hiện chưa rõ thang nào.
25. Điều kiện tốt nghiệp **ngoài tín chỉ**: chuẩn ngoại ngữ (Anh văn A2.1/A2.2), GDTC, GDQP, tin học.
26. Điều kiện đăng ký **đồ án tốt nghiệp** (thường là "tích lũy đủ X tín chỉ").

**Tích hợp & vận hành**
27. Import Excel gặp mã HP không tồn tại / trùng / sai định dạng → báo lỗi theo dòng, **không ghi
    một phần**.
28. Excel và DB **mâu thuẫn** về cùng một bản ghi → nguồn nào thắng.
29. Xóa CTĐT/HP **đã có sinh viên theo học** → chỉ archive, cấm xóa cứng.
30. Kết quả degree audit **thay đổi** sau khi trường sửa điểm hồi tố.

---

## Câu hỏi cần chốt — `docs/OPEN-QUESTIONS.md`

### 🔴 Chặn thiết kế CSDL — cần trả lời trước khi code

- **Q1.** Đã chốt "1 học phần = 1 đề cương dùng chung", nhưng CLO phải map vào PLO — mà PLO thuộc từng
  CTĐT. Vậy khi Giải tích 1 nằm trong cả CTĐT CNTT lẫn CTĐT Điện tử: **bộ CLO là chung, còn bảng map
  CLO→PLO tách theo từng CTĐT** — xác nhận đúng không? Nếu khoa muốn CLO cũng khác nhau theo CTĐT thì
  quyết định "1 đề cương" phải xem lại.
- **Q2.** Snapshot toàn CTĐT gồm cả đề cương. Nhưng đề cương dùng chung nhiều CTĐT → sửa 1 đề cương
  sẽ đẻ phiên bản mới cho **tất cả** CTĐT chứa nó. Chấp nhận, hay đề cương có chuỗi version riêng và
  CTĐT chỉ trỏ tới?
- **Q3.** "Điểm học" và "Điểm chuyển" trong file Excel thực chất là gì, và **thang điểm nào** (4 / 10
  / chữ)?
- **Q4.** "HT ĐA" và "TQ ĐA" nghĩa chính xác là gì?
- **Q5.** Học phần tương đương: **một chiều hay hai chiều**? có bắc cầu không? khai báo ở cấp toàn
  trường hay cấp từng CTĐT?
- **Q6.** "Ký hiệu" (cột đang trống trong file) là mã khối kiến thức đúng không, và danh mục giá trị
  hợp lệ gồm những gì?

### 🟠 Chặn thiết kế luồng nghiệp vụ

- **Q7.** Khi Giám đốc CTĐT tự tạo đề xuất, luồng 3 cấp xử lý ra sao — bỏ qua cấp của chính mình, hay
  đẩy lên Ban lãnh đạo khoa?
- **Q8.** Giảng viên thuộc nhiều nhóm CM: CR của họ đi qua **trưởng nhóm nào** — nhóm sở hữu học phần,
  hay để người tạo tự chọn?
- **Q9.** Phòng ĐT từ chối ở cấp cuối → CR quay về **người tạo** hay về **Giám đốc CTĐT**?
- **Q10.** Có cần **hiệu lực theo học kỳ** (phiên bản mới chỉ áp dụng từ HK tới) hay hiệu lực ngay khi
  duyệt?
- **Q11.** Học phần thuộc khoa khác (Toán, Lý, Chính trị) — khoa CNTT có được sửa đề cương không, hay
  chỉ được đề nghị? Nếu chỉ đề nghị thì hệ thống có mô hình hóa các khoa khác không?

### 🟡 Ảnh hưởng phạm vi công việc

- **Q12.** DB có sẵn mà bạn nói tới là DB nào — DB của hệ thống trường (chỉ đọc), hay DB dự án tự tạo
  rồi bơm dữ liệu từ Excel vào? Có được cấp quyền truy cập thật không, hay chỉ có bản dump?
- **Q13.** Xác thực: dùng **SSO của trường** hay tự làm tài khoản trong hệ thống?
- **Q14.** Nhóm có phải **tự làm app mobile** không, hay chỉ cần cung cấp API và phía dDUT tự tích hợp?
  **Đã chốt (F-28, 2026-11-01):** tự làm ứng dụng mô phỏng dDUT trong repo riêng `dut_curriculum_app`, chỉ để trình diễn qua API hiện có và phiên cookie; không thay thế dDUT của Trường, không bổ sung đăng nhập Microsoft/Office 365.
- **Q15.** Cần hỗ trợ **song ngữ Việt/Anh** cho tên học phần, PLO, CLO (phục vụ kiểm định AUN) trong
  phạm vi PBL6, hay để sau?
- **Q16.** Có bao nhiêu CTĐT thực tế cần quản lý, và có file Excel mẫu của **cả CTĐT kỹ sư lẫn cử
  nhân** để đối chiếu cấu trúc không?
- **Q17.** Điều kiện tốt nghiệp ngoài tín chỉ (ngoại ngữ, GDTC, GDQP) có nằm trong phạm vi degree
  audit không?

### 🟢 Chốt sau, không chặn

- **Q18.** Tech stack (backend/frontend/DB) — note mới chỉ nói "monolith".
- **Q19.** Có cần xuất **bản in PDF theo mẫu quyết định** của trường không (cần file mẫu)?
- **Q20.** Số lượng người dùng đồng thời dự kiến, để quyết định mức đầu tư cho hiệu năng.

---

## Verification

Bộ tài liệu coi là đạt khi:

1. Mỗi tính năng trong 4 file có mã định danh và **truy ngược được** về một dòng note gốc của bạn —
   không có tính năng nào tôi tự bịa thêm mà không đánh dấu là đề xuất.
2. Mọi thực thể trong `DOMAIN-MODEL.md` **phủ hết** các cột trong ảnh chụp bảng Excel bạn gửi.
3. Đọc `REQUIREMENTS.md` xong dựng được sơ đồ ERD và chia được task, không cần hỏi lại — trừ đúng
   những câu trong `OPEN-QUESTIONS.md`.
4. Bạn (hoặc giảng viên hướng dẫn) rà `OPEN-QUESTIONS.md` và trả lời hết nhóm 🔴 trước khi bước sang
   giai đoạn thiết kế CSDL.

Không có code trong bước này nên không có test tự động. Kiểm tra bằng cách đọc soát 4 file.
