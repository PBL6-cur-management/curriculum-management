# Tóm tắt góp ý nghiệp vụ Hệ thống Quản lý CTĐT

Dưới đây là bản tóm tắt đầy đủ nội dung tệp ghi âm `C:/Users/Admin/Downloads/Note.m4a` (thời lượng 62 phút).

---

## 1. Tổng quan buổi họp

- **Chủ đề:** Demo và góp ý hoàn thiện nghiệp vụ Hệ thống Quản lý Chương trình Đào tạo (CTĐT) & Đề cương chi tiết học phần (trường ĐH Bách khoa – ký hiệu QĐ-ĐHBK).
- **Thành phần chính:**
  - **Thầy (chủ trì kỹ thuật/kiến trúc):** Định hướng cấu trúc dữ liệu, phân quyền, luồng phê duyệt và tích hợp API giữa các hệ thống.
  - **Cô (phụ trách nghiệp vụ Đào tạo):** Góp ý chi tiết về quản lý phiên bản CTĐT, quyết định ban hành, đề cương chi tiết, chuyên ngành/định hướng và chuyển CTĐT cho sinh viên.
  - **Nhóm phát triển (Dev):** 1 bạn nam trình bày demo (phụ trách phần phân quyền; 2 thành viên khác vắng mặt do việc gia đình) và 1 bạn ngồi ghi chú để gửi lại nhóm Zalo.
  - **Đại diện bộ phận khác (cuối buổi):** Trao đổi về đào tạo Thạc sĩ/Tiến sĩ và tích hợp API quản lý lớp học phần.

---

## 2. Tóm tắt diễn biến theo nội dung chính

### A. Quản lý Đơn vị (Khoa) & Nhóm chuyên môn (00:00 – 05:00)

- **Chuẩn hóa dữ liệu đơn vị:** Dữ liệu từ bên Tổ chức Cán bộ chỉ quản lý các đơn vị hành chính nội bộ trong trường, không có các khoa/đơn vị ngoài trường. Do đó, hệ thống Đào tạo giữ danh mục quản lý riêng làm gốc và liên kết sang các phân hệ khác, nhưng cần thống nhất tên chuẩn (tránh viết tắt tùy tiện như CNTT).
- **Nhóm chuyên môn:** Mỗi khoa có mã đơn vị duy nhất (không đổi). Trong từng nhóm chuyên môn có Điều phối (có thể có nhiều điều phối) và các thành viên; admin có thể thêm thành viên, chỉ định hoặc thu hồi quyền điều phối.

### B. Quản lý CTĐT, Phiên bản & Quyết định ban hành (05:00 – 19:00)

- **Hiệu lực của các phiên bản CTĐT:** Hiện tại hệ thống hiển thị chỉ phiên bản mới nhất là "Đang áp dụng / Đang hiệu lực". Cô góp ý điều này sai nghiệp vụ vì tại một thời điểm có nhiều khóa sinh viên học song song theo các phiên bản CTĐT khác nhau (vd: K26 học bản 155 tín chỉ, K27 học bản 156 tín chỉ) nên nhiều phiên bản cùng đang có hiệu lực. Đề xuất đổi nhãn thành **"Mới nhất"**.
- **Gắn Khóa tuyển sinh & Quyết định ban hành:**
  - Một CTĐT ban hành năm 2026 có thể giữ ổn định và áp dụng cho nhiều khóa liên tiếp (K26, K27, K28...) mà không cần mỗi năm tạo mới. Nếu năm sau có điều chỉnh nhỏ (1–2 môn) thì mới tạo phiên bản mới (2.0).
  - Bổ sung thông tin ban hành: Số Quyết định (vd: `1234/QĐ-ĐHBK/2026`), Ngày ban hành (bắt buộc cho chọn ngày lùi về quá khứ để nhập dữ liệu lịch sử), Hiệu lực từ học kỳ nào, Khóa áp dụng (cho chọn nhiều khóa).
  - Hiển thị Số Quyết định/Số văn bản đi kèm với số phiên bản (1.0, 2.0) ở mọi nơi (danh sách CTĐT, màn hình gắn khóa, dòng thời gian lịch sử).

### C. Đề xuất thay đổi CTĐT, Đề cương chi tiết & Ma trận CLO–PLO (19:00 – 34:30)

- **Đổi tên trường "Số quyết định" khi đề xuất:** Cấp Khoa/Bộ môn không ban hành Quyết định (chỉ cấp Trường mới ra Quyết định) mà chỉ có Tờ trình / Giấy đề nghị. Chốt đổi nhãn trường này trong form đề xuất thành **"Số văn bản"**.
- **Chuyển vị trí nhập Khóa & Học kỳ áp dụng:** Hiện tại hệ thống để bước cuối (Phòng Đào tạo duyệt) mới chọn khóa/học kỳ áp dụng. Yêu cầu đưa ngay vào bước tạo đề xuất để người đề xuất (Khoa/Giám đốc CTĐT) khai báo rõ thay đổi áp dụng từ khóa nào, học kỳ nào; các cấp trên căn cứ vào đó để xét duyệt.
- **Nội dung cuốn CTĐT & Đề cương chi tiết học phần:**
  - CTĐT cần thể hiện đủ khung theo khối kiến thức, theo học kỳ và chuẩn đầu ra (PLO).
  - Đề cương chi tiết là phần thay đổi thường xuyên nhất: cần lưu đầy đủ nội dung (CLO, công thức điểm, tài liệu đính kèm PDF/Word...) và lưu lịch sử theo từng phiên bản/năm học.
  - Quan hệ Học phần – CTĐT: 1 mã học phần (vd: Triết học, Cơ lý thuyết) chỉ có 1 nội dung đề cương chi tiết gốc, nhưng khi dùng chung cho nhiều CTĐT sẽ ánh xạ tới các PLO khác nhau tùy CTĐT.
  - Ma trận CLO–PLO hiện còn thiếu dữ liệu và chức năng nối trực tiếp; trước mắt ưu tiên hoàn thiện quản lý học phần và quy trình điều chỉnh đề cương chi tiết.

### D. Quy trình phê duyệt nhiều cấp & Duyệt song song (34:30 – 38:35)

Thầy và Cô chốt lại 2 luồng duyệt chuẩn (bổ sung cấp Lãnh đạo Khoa đang bị thiếu):

1. **Thay đổi Học phần / Đề cương chi tiết (4 cấp duyệt):**
   > Giảng viên (khởi tạo) → Điều phối nhóm chuyên môn → Giám đốc CTĐT → Lãnh đạo Khoa → Phòng Đào tạo.
2. **Thay đổi Chương trình Đào tạo (2 cấp duyệt):**
   > Chỉ Giám đốc CTĐT (khởi tạo) → Lãnh đạo Khoa → Phòng Đào tạo.
3. **Cơ chế duyệt song song (cho học phần dùng chung nhiều CTĐT):** Nếu 1 học phần nằm trong 5 CTĐT khác nhau, đề xuất thay đổi phải gửi song song (đồng thời) đến cả 5 Giám đốc CTĐT; khi tất cả đều duyệt xong thì mới chuyển lên cấp tiếp theo.

### E. Điều chỉnh thuật ngữ giao diện (38:35 – 40:33)

- Đổi "Đồ thị học phần" (quan hệ tiên quyết/song hành) thành **"Cây chương trình đào tạo"**.
- Đổi cụm từ "Sức khỏe chương trình" (tính năng rà soát thiếu sót CLO/PLO, liên kết) sang thuật ngữ học vụ phù hợp hơn.

### F. Bài toán Chuyên ngành/Định hướng & Chuyển CTĐT sinh viên (40:33 – 57:20)

- **Chuyên ngành / Định hướng con:** Ví dụ ngành CNTT có 1 cuốn CTĐT chung nhưng đến các học kỳ cuối (vd: HK 9–10) phân nhánh thành các định hướng (An toàn thông tin, Công nghệ phần mềm, Hệ thống thông tin) dùng chung 1 quyết định ban hành. Hệ thống hiện chưa hỗ trợ cấu trúc nhánh con này (cách cũ phải nhân bản thành rất nhiều CTĐT cồng kềnh). Thầy sẽ bàn lại với nhóm để chốt cấu trúc dữ liệu tối ưu.
- **Chuyển CTĐT cho sinh viên (vd: Kỹ sư ↔ Cử nhân):**
  - Thực tế sinh viên nhập học mặc định đổ vào hệ Kỹ sư, đến cuối năm 2 có thể chuyển sang Cử nhân (2 cuốn CTĐT tồn tại song song).
  - Yêu cầu hệ thống phải: (1) Lưu đầy đủ lịch sử chuyển đổi (kể cả khi sinh viên xin quay lại CTĐT cũ); (2) Hỗ trợ chọn nhiều sinh viên chuyển hàng loạt và Import/Export danh sách bằng file Excel.

### G. Sau đại học (Thạc sĩ/Tiến sĩ), Tích hợp API & Phân quyền động (57:20 – 62:01)

- **Bổ sung trình độ đào tạo:** Thêm trình độ Thạc sĩ và Tiến sĩ vào hệ thống (hiện mới có Cử nhân, Kỹ sư).
- **Tích hợp API với hệ thống Quản lý lớp học phần:**
  - Hệ thống bên ngoài chỉ cần gọi API query dữ liệu từ hệ thống này để nhận thông tin mới nhất (không cần gọi ngược lại để sửa).
  - Khóa liên kết giữa các hệ thống phải dùng **Mã học phần**, tuyệt đối không dùng UUID nội bộ của database.
- **Phân quyền động (Dynamic Role):** Hiện tại hệ thống đang cố định 6 role cứng. Thầy yêu cầu bổ sung chức năng tạo Role mới động và cho phép tùy chọn quyền (permissions) gắn vào role đó.

---

## 3. Danh sách đầu việc cần chỉnh sửa (Action Items cho nhóm Dev)

| Nhóm | Yêu cầu chỉnh sửa chi tiết |
| --- | --- |
| **Giao diện & Thuật ngữ** | - Đổi nhãn "Đang hiệu lực" thành "Mới nhất" (hoặc cách hiển thị cho phép nhiều phiên bản cùng hiệu lực theo khóa).<br>- Đổi nhãn "Số quyết định" trong form đề xuất thành "Số văn bản".<br>- Hiển thị Số Quyết định / Số văn bản kèm theo số phiên bản ở danh sách CTĐT, màn hình gắn khóa và lịch sử phiên bản.<br>- Đổi "Đồ thị học phần" → "Cây chương trình đào tạo".<br>- Đổi thuật ngữ "Sức khỏe chương trình" sang từ học vụ phù hợp hơn. |
| **Nghiệp vụ CTĐT & Đề cương** | - Cho phép chọn ngày ban hành lùi về quá khứ để cập nhật dữ liệu cũ.<br>- Đưa trường chọn Khóa áp dụng & Học kỳ áp dụng lên ngay bước tạo đề xuất thay đổi (cả CTĐT lẫn Đề cương chi tiết).<br>- Bổ sung trình độ Thạc sĩ, Tiến sĩ.<br>- Sửa lỗi khi gắn khóa / tạo đề xuất thiếu Giám đốc CTĐT và hoàn thiện lưu lịch sử phiên bản đề cương chi tiết. |
| **Luồng phê duyệt** | - Bổ sung cấp Lãnh đạo Khoa vào cả 2 luồng duyệt (trước Phòng Đào tạo).<br>- Giới hạn chỉ Giám đốc CTĐT mới được khởi tạo đề xuất thay đổi CTĐT.<br>- Cài đặt duyệt song song ở cấp Giám đốc CTĐT đối với học phần dùng chung cho nhiều CTĐT. |
| **Chuyển CTĐT Sinh viên** | - Lưu toàn bộ lịch sử chuyển CTĐT của sinh viên.<br>- Bổ sung chuyển hàng loạt (chọn nhiều sinh viên) và Import/Export file Excel. |
| **Phân quyền & Tích hợp** | - Nâng cấp phần phân quyền hỗ trợ tạo Role mới động (Dynamic Role) thay vì fix cứng 6 role.<br>- Chuẩn hóa API đồng bộ liên hệ thống sử dụng Mã học phần (không dùng UUID nội bộ). |
| **Vấn đề chờ chốt thêm** | - Thiết kế cấu trúc quản lý Chuyên ngành / Định hướng con nằm trong 1 CTĐT (Thầy sẽ trao đổi lại với nhóm). |

---

## 4. Lịch họp tiếp theo

- **Thời gian:** Thứ Năm tuần sau (yêu cầu nhóm hoàn thiện các góp ý trên và tham gia đầy đủ thành viên).
