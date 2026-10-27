# KẾ HOẠCH KIỂM THỬ v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-12 |
| Đi kèm | `docs/planning/user-stories.md` (US-001..US-116), `docs/planning/task-breakdown.md` (CV-001..CV-277), `docs/planning/epics.md` (kịch bản nghiệm thu từng bậc), `docs/design/screen-inventory.md` |
| Nguồn | `docs/requirement/REQUIREMENTS.md`: quy tắc nghiệp vụ BR-01..BR-31, yêu cầu phi chức năng NFR-01..NFR-27, trường hợp biên EC-01..EC-52 |
| Phạm vi | Kiểm cái gì, ở mức nào, khi nào một bậc được coi là xong, và mỗi quy tắc, mỗi trường hợp biên, mỗi yêu cầu phi chức năng được kiểm bằng cách nào. Công cụ kiểm thử ở `docs/design/tech-stack.md`, không nhắc lại ở đây |
| Điểm còn hở của tài liệu này | T-1..T-12, mục 10 |

---

## 1. Quy ước

| Mục | Quy ước |
|---|---|
| KB-001..KB-094 | Kịch bản kiểm một quy tắc nghiệp vụ hoặc một trường hợp biên. Mỗi kịch bản nêu điều kiện đầu, thao tác, kết quả mong đợi, và các mã BR, EC mà nó kiểm |
| NT-Bx-nn | Kịch bản nghiệm thu thứ nn của bậc Bx, chép nguyên văn từ `docs/planning/epics.md` mục 3. Có 54 kịch bản |
| Tiêu chí chấp nhận của story | 469 tiêu chí Cho / Khi / Thì trong `user-stories.md` là ca kiểm mức hệ thống của chính story đó. Tài liệu này không chép lại chúng; nó chỉ thêm các kịch bản KB và NT |
| Mức | **ĐV** đơn vị · **TH** tích hợp · **HT** hệ thống; định nghĩa ở mục 3 |
| Việc kiểm thử | Mã CV của việc loại Kiểm thử trong `task-breakdown.md` mà kịch bản được chạy trong đó. Kịch bản không có việc riêng thì chạy trong việc chốt bậc |
| DL-1..DL-8 | Bộ dữ liệu kiểm thử, mục 4 |
| Đạt | Mọi kết quả mong đợi của kịch bản đều quan sát được. Một phần không đúng thì kịch bản không đạt |

---

## 2. Phạm vi

### 2.1. Trong phạm vi

| Đối tượng | Số lượng | Kiểm bằng |
|---|---|---|
| Yêu cầu chức năng FR-01..FR-109 | 109 | Tiêu chí chấp nhận của 116 story; mỗi FR có ít nhất một story (xem `user-stories.md` mục 8) |
| Quy tắc nghiệp vụ BR-01..BR-31 | 31 | Kịch bản KB, mục 6; truy vết ở mục 9.1 |
| Trường hợp biên EC-01..EC-52 | 52 | Kịch bản KB, mục 6; truy vết ở mục 9.2 |
| Yêu cầu phi chức năng NFR-01..NFR-27 | 27 | Một phương pháp kiểm chứng cho mỗi yêu cầu, mục 8 |
| Kịch bản nghiệm thu của sáu bậc | 54 | Mục 7 |
| Ma trận quyền (`RolePermission`, M-10) | 40 quyền × 6 vai trò, nạp từ mục 9 của từ điển dữ liệu | Bảng kiểm ở NFR-09, làm dần theo bậc |
| Giao tiếp với bên ngoài | 3 | E1 cơ sở dữ liệu có sẵn, E2 dịch vụ email, E3 ứng dụng dDUT: kiểm phần của hệ thống này, bên kia được giả lập (T-11) |

### 2.2. Ngoài phạm vi

| Không kiểm | Lý do |
|---|---|
| Tạo chương trình mới từ đầu, xếp thời khóa biểu, đăng ký học phần thật, nhập và quản lý điểm, lớp học phần và phân công giảng dạy, học phí, ứng dụng di động riêng, hồ sơ nhân sự | SRS mục 12 loại khỏi phạm vi sản phẩm |
| Hoạt động bên trong của E1, E2, E3 | Không thuộc hệ thống này; chỉ kiểm dữ liệu vào và ra ở ranh giới |
| Tính đúng của nội dung học thuật trong đề cương, PLO, CLO | Là việc của Khoa; hệ thống chỉ lưu và kiểm cấu trúc |
| Kiểm thử xâm nhập và đánh giá an toàn thông tin độc lập | SRS chỉ đặt NFR-06..NFR-11; kế hoạch này kiểm đúng sáu yêu cầu đó |
| Tải vượt 200 người đồng thời, khả năng mở rộng nhiều máy chủ | NFR-04 dừng ở 200; NFR-21 đặt kiến trúc một khối |
| Việc sơ đồ Mermaid trong các tài liệu thiết kế có vẽ được hay không | Là kiểm tài liệu, không phải kiểm sản phẩm |

---

## 3. Mức kiểm thử

| Mức | Kiểm cái gì | Ví dụ trong hệ thống này | Ai làm | Khi nào |
|---|---|---|---|---|
| ĐV — Đơn vị | Một quy tắc hoặc một phép tính, tách khỏi giao diện và nguồn dữ liệu ngoài | Chặn chu trình (BR-11); tổng tín chỉ (SRS mục 7.1); điều kiện đăng ký (mục 7.3); xét tốt nghiệp (mục 7.4) | Người làm việc Nghiệp vụ tương ứng | Cùng lúc với việc đó; chạy lại mỗi lần sửa |
| TH — Tích hợp | Nhiều phần cùng chạy qua kho dữ liệu hoặc qua một ranh giới ngoài | Nhập Excel chạy thử rồi ghi; định tuyến người duyệt; sinh phiên bản và ảnh chụp; đồng bộ với E1; API cho E3 | Người làm việc Kiểm thử của story | Khi các việc mà nó phụ thuộc đã xong |
| HT — Hệ thống | Một luồng trọn vẹn qua giao diện, bằng đúng vai trò | Tiêu chí chấp nhận của story; kịch bản KB mức HT | Người không viết phần được kiểm | Khi story xong |
| Hồi quy (T-10) | Mọi kịch bản KB và NT của các bậc trước | Sau B4, sửa trực tiếp ở B2 và B3 đổi thành tạo đề xuất: các kịch bản cũ phải chạy lại trên phiên bản Nháp | Cả nhóm | Trước khi chốt mỗi bậc |
| Phi chức năng | NFR-01..NFR-27 theo phương pháp ở mục 8 | Đo thời gian, bảng kiểm quyền, diễn tập phục hồi | Theo việc ghi ở mục 8 | Từ bậc mà yêu cầu bắt đầu ràng buộc |
| Nghiệm thu | Kịch bản NT của bậc, chạy liền một mạch trên dữ liệu của bậc | Mục 7 | Cả nhóm, có người hướng dẫn chứng kiến (T-9) | Việc chốt bậc |

---

## 4. Môi trường và dữ liệu kiểm thử

### 4.1. Môi trường

| Môi trường | Dùng cho | Yêu cầu |
|---|---|---|
| Phát triển | Mức ĐV và TH | Mỗi người tự dựng được từ kho mã và các bước thay đổi cấu trúc (NFR-23) |
| Kiểm thử chung | Mức HT, hồi quy, nghiệm thu B1..B5 | Một bản cài chung, nạp được các bộ DL; dữ liệu được nạp lại trước mỗi lần nghiệm thu |
| Máy chủ của Khoa hoặc máy tương đương | Nghiệm thu B6, NFR-04, NFR-12, NFR-13, NFR-15, NFR-25 | Cấu hình ghi lại cùng kết quả đo (T-6) |

### 4.2. Bộ dữ liệu

| Mã | Tên | Nội dung | Nguồn | Từ bậc |
|---|---|---|---|---|
| DL-1 | Tổ chức và tài khoản | Cây Trường, Khoa CNTT, 04 nhóm chuyên môn, một khoa khác; hai tài khoản cho mỗi vai trò R1..R5; một giảng viên thuộc hai nhóm; một Điều phối có thời hạn đã hết | Tự lập | B1 |
| DL-2 | Danh mục và khung thật | Tệp Excel khung của chương trình mã 1024034 và danh mục học phần rút ra từ tệp đó | Khoa cung cấp (Q-11) | B2 |
| DL-3 | Chương trình thứ hai và thứ ba | Hai chương trình tạo bằng nhân bản từ DL-2, một Cử nhân một Kỹ sư, dùng chung phần lớn học phần; cần cho các kịch bản nhiều chương trình | Tự lập từ DL-2 | B2 |
| DL-4 | Tệp Excel kiểm thử | Các tệp cố ý lỗi: thiếu cột, mã không tồn tại, dòng trùng, chu trình tiên quyết; và tệp hợp lệ 1000 dòng cho từng loại nhập | Tự lập | B2 |
| DL-5 | Đề cương và chuẩn đầu ra | Đề cương đủ các phần cho mọi học phần của khung DL-2, PLO của từng chương trình, ma trận CLO–PLO; nội dung do nhóm soạn, không phải đề cương thật | Tự lập | B3 |
| DL-6 | Học kỳ, khóa và phiên bản | Các học kỳ và các khóa K2023, K2024, K2025 theo ví dụ SRS mục 6.2.3: phiên bản 1.0, 1.1, 2.0 | Tự lập theo SRS | B4 |
| DL-7 | Sinh viên và kết quả học tập | 500 sinh viên tổng hợp của một khóa kèm kết quả; thêm các sinh viên đặc biệt: học lại, chuyển ngành, song ngành, bảo lưu, đạt học phần tương đương, chưa có kết quả. Không dùng dữ liệu sinh viên thật | Tự lập (K-8) | B5 |
| DL-8 | Nguồn giả lập cơ sở dữ liệu có sẵn | Một kho dữ liệu chỉ đọc do nhóm dựng, chứa danh sách sinh viên, kết quả học tập, lớp học phần, có bản ghi cố ý khác với DL-7 | Tự lập (Q-09, T-11) | B6 |

---

## 5. Tiêu chí vào và ra theo bậc

### 5.1. Tiêu chí chung cho mọi bậc

| Loại | Tiêu chí |
|---|---|
| Vào | Bậc liền trước đã đạt tiêu chí ra (không áp dụng cho B1) |
| Vào | Các câu hỏi ghi ở cột "Phải chốt" của mục 5.2 đã có câu trả lời, hoặc lựa chọn tạm đã ghi trong tài liệu được người hướng dẫn chấp nhận |
| Vào | Bộ dữ liệu của bậc đã sẵn sàng và nạp được vào môi trường kiểm thử chung |
| Ra | Mọi tiêu chí chấp nhận của mọi story thuộc bậc đều đạt |
| Ra | Mọi kịch bản KB của bậc đều đạt; mọi kịch bản KB và NT của các bậc trước chạy lại vẫn đạt |
| Ra | Mọi kịch bản NT của bậc đạt trên Chrome, Firefox, Edge (NFR-26) |
| Ra | Các NFR bắt đầu ràng buộc từ bậc này đã được kiểm theo mục 8; các NFR của bậc trước không bị vi phạm |
| Ra | Không còn lỗi mức 1 hay mức 2 đang mở; lỗi mức 3 và 4 còn lại được ghi thành danh sách kèm bậc sẽ sửa |

### 5.2. Tiêu chí riêng của từng bậc

| Bậc | Phiên bản | Phải chốt trước khi vào | Dữ liệu | Story | Tiêu chí chấp nhận | KB | NT | NFR kiểm từ bậc này | Tiêu chí ra riêng | Việc chốt bậc |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 | 0.1 | Q-13, Q-27, Q-06 | DL-1 | 17 | 66 | 10 | 7 | NFR-01, NFR-06, NFR-07, NFR-08, NFR-09, NFR-10, NFR-16, NFR-18, NFR-19, NFR-20, NFR-21, NFR-22, NFR-23, NFR-24, NFR-26 | Bảng kiểm ma trận quyền phần B1 đạt ở mọi ô (CV-017) | CV-053 |
| B2 | 0.2 | Q-11, Q-04, Q-08, C09 | DL-2, DL-3, DL-4 | 20 | 74 | 16 | 9 | NFR-05 | Bảng kiểm ma trận quyền phần B2 đạt (CV-063); vòng nhập, xuất, nhập lại khung mã 1024034 không phát sinh LỖI (CV-097) | CV-098 |
| B3 | 0.3 | Q-25, Q-26, Q-28, Q-12 | DL-5 | 15 | 54 | 10 | 8 | — | Bản nhân bản độc lập với nguồn ở PLO và ma trận (CV-125) | CV-135 |
| B4 | 0.4 | H-1, C01, C02, C03, C04, Q-07, Q-18, Q-19, Q-20, Q-21, Q-22, Q-23, Q-24 | DL-6 | 28 | 124 | 23 | 12 | NFR-12, NFR-13, NFR-14 | Mọi đường ghi lên dữ liệu đã ban hành bị từ chối với cả sáu vai trò (CV-137); bộ kiểm bất biến đạt (CV-186); diễn tập phục hồi đạt (CV-187) | CV-200 |
| B5 | 0.5 | H-2, Q-03, Q-05, Q-10, C05, C06, C07, C10, C11 | DL-7 | 21 | 94 | 25 | 9 | NFR-02, NFR-03, NFR-11, NFR-17 | Kết quả API trùng với cổng sinh viên trên cùng dữ liệu (CV-242); phản hồi thật khớp tài liệu API (CV-244) | CV-245 |
| B6 | 1.0 | Q-09, Q-14, Q-17 | DL-8 | 15 | 57 | 10 | 9 | NFR-04, NFR-15, NFR-25, NFR-27 | Cài đặt được trên máy chủ của Khoa theo tài liệu, có hướng dẫn cho đủ sáu vai trò (CV-249); đo 200 người đồng thời đạt và việc theo dõi thời gian hoạt động đã chạy (CV-250) | CV-277 |
| **Tổng** |  |  |  | **116** | **469** | **94** | **54** | **27** |  |  |

### 5.3. Phân mức lỗi

| Mức | Tên | Dấu hiệu | Xử lý |
|---|---|---|---|
| 1 | Chặn | Mất hoặc đổi dữ liệu của phiên bản đã ban hành; sai kết luận xét tốt nghiệp hoặc điều kiện đăng ký; một vai trò làm được việc ngoài quyền; không đăng nhập được | Sửa ngay, không chốt bậc khi còn |
| 2 | Nặng | Một chức năng của story không chạy hoặc cho kết quả sai, có cách làm vòng | Sửa trước khi chốt bậc |
| 3 | Vừa | Sai ở thông báo, cảnh báo, sắp xếp, lọc; không làm sai dữ liệu | Được chuyển sang bậc kế nếu đã ghi lại |
| 4 | Nhẹ | Trình bày, chính tả, căn chỉnh | Sửa khi tiện |

---

## 6. Kịch bản kiểm quy tắc nghiệp vụ và trường hợp biên

### 6.0. Số kịch bản theo bậc và mức

| Bậc | ĐV | TH | HT | Tổng |
|---|---|---|---|---|
| B1 | 6 | 0 | 4 | 10 |
| B2 | 6 | 4 | 6 | 16 |
| B3 | 5 | 0 | 5 | 10 |
| B4 | 1 | 8 | 14 | 23 |
| B5 | 12 | 4 | 9 | 25 |
| B6 | 0 | 3 | 7 | 10 |
| **Tổng** | **30** | **19** | **45** | **94** |

### 6.1. Bậc B1 — Nền tảng và danh mục học phần

| Mã | Kịch bản | Mức | Điều kiện đầu | Thao tác | Kết quả mong đợi | BR / EC | Story | Việc kiểm thử |
|---|---|---|---|---|---|---|---|---|
| KB-001 | Tín chỉ là số thập phân | ĐV | Danh mục học phần đang mở, người thao tác là R1 | Tạo học phần với số tín chỉ 2.5; mở lại học phần vừa tạo | Lưu được; danh mục và trang chi tiết đều hiện 2.5, không bị làm tròn thành 2 hay 3 | BR-01, EC-02 | US-012 | CV-038 |
| KB-002 | Tín chỉ âm bị chặn | ĐV | Danh mục học phần đang mở, người thao tác là R1 | Tạo học phần với số tín chỉ -1 | Bị chặn lưu; thông báo nêu số tín chỉ phải từ 0 trở lên | BR-01 | US-012 | CV-038 |
| KB-003 | Học phần 0 tín chỉ lưu được | ĐV | Danh mục học phần đang mở, người thao tác là R1 | Tạo học phần với số tín chỉ 0 | Lưu được; học phần hiện trong danh mục với 0 tín chỉ | BR-01, EC-01 | US-012 | CV-038 |
| KB-004 | Chu trình tiên quyết giữa hai học phần | ĐV | A đã là tiên quyết của B | Khai báo B là tiên quyết của A | Bị chặn lưu; thông báo hiện đường đi của chu trình: A, B, A | BR-11, EC-09 | US-016 | CV-049 |
| KB-005 | Chu trình ba học phần trộn tiên quyết và học trước; song hành không tính là chu trình | ĐV | A là tiên quyết của B; B là học trước của C | Khai báo C là tiên quyết của A; sau đó khai báo D song hành E và E song hành D | Quan hệ C với A bị chặn kèm đường đi; hai quan hệ song hành lưu được | BR-11, EC-09 | US-016 | CV-049 |
| KB-006 | Tương đương hai chiều và bắc cầu qua nhóm | ĐV | Nhóm tương đương đang gồm A và B | Thêm C vào nhóm; mở chi tiết C rồi mở chi tiết A | C hiện A và B là tương đương; A hiện B và C; không phải khai báo từng cặp. Thêm C vào một nhóm thứ hai thì bị chặn và được đề nghị gộp nhóm | BR-09, EC-15 | US-017 | CV-053 |
| KB-007 | Nhóm tương đương nằm ở cấp danh mục, không theo chương trình | HT | Có học phần mã cũ, học phần mã mới và một học phần do khoa khác phụ trách, số tín chỉ khác nhau | Tạo một nhóm tương đương chứa cả ba | Lưu được; nhóm không gắn với chương trình hay phiên bản nào và hiện ở chi tiết của cả ba học phần | EC-16, EC-18 | US-017 | CV-053 |
| KB-008 | Ngừng mở lớp đòi khai báo học phần thay thế | HT | Học phần X ở Đang sử dụng, chưa có quan hệ thay thế | Chuyển X sang Ngừng mở lớp; khai báo Y thay thế X; chuyển lần nữa; mở lại X | Lần đầu bị chặn và được yêu cầu khai báo học phần thay thế; lần sau lưu được; X mở lại về Đang sử dụng được | EC-12, EC-32 | US-014 | CV-043 |
| KB-009 | Tài khoản không có chức năng xóa | HT | Tài khoản giảng viên đã có thao tác ghi trong nhật ký | R1 tìm chức năng xóa tài khoản; vô hiệu hóa tài khoản; tra nhật ký theo người đó | Không có chức năng xóa; tài khoản bị vô hiệu hóa không đăng nhập được; các dòng nhật ký cũ vẫn hiện tên người đó | EC-51 | US-004 | CV-053 |
| KB-010 | Ghi nhận học phần do khoa khác phụ trách | HT | Cây đơn vị có một khoa khác | R1 thêm học phần với khoa phụ trách là khoa đó, không chọn nhóm chuyên môn; R5 thử sửa học phần đó | Lưu được; lọc danh mục theo khoa phụ trách tách được học phần này; R5 bị máy chủ từ chối | EC-24 | US-013 | CV-053 |

### 6.2. Bậc B2 — Chương trình đào tạo và khung

| Mã | Kịch bản | Mức | Điều kiện đầu | Thao tác | Kết quả mong đợi | BR / EC | Story | Việc kiểm thử |
|---|---|---|---|---|---|---|---|---|
| KB-011 | Tín chỉ bắt buộc cộng tự chọn phải bằng tổng | ĐV | Form thông tin chương trình đang mở | Lưu chương trình với tổng 150 tín chỉ, bắt buộc 120, tự chọn 25 | Bị chặn lưu; thông báo hiện chênh lệch 5 tín chỉ | BR-03 | US-019 | CV-080 |
| KB-012 | Tổng tín chỉ tính được không cộng học phần 0 tín chỉ | ĐV | Khung có học phần bắt buộc tổng 100 tín chỉ, thêm một học phần bắt buộc 0 tín chỉ, hai nhóm tự chọn tối thiểu 6 và 9 tín chỉ | Mở tổng tín chỉ tính được của khung | Tổng là 115; học phần 0 tín chỉ vẫn hiện trong khung là bắt buộc | BR-02, BR-03, EC-01 | US-029 | CV-080 |
| KB-013 | Danh sách tự chọn dư tín chỉ là hợp lệ | ĐV | Phiên bản Nháp | Tạo nhóm tự chọn tối thiểu 6 tín chỉ và gán 5 học phần 3 tín chỉ | Lưu được dù danh sách có 15 tín chỉ; tổng tín chỉ tính được chỉ cộng 6 cho nhóm này | BR-04, EC-04 | US-026 | CV-080 |
| KB-014 | Học phần bắt buộc không vào được nhóm tự chọn | ĐV | Khung có một dòng đánh dấu bắt buộc | Gán dòng đó vào một nhóm tự chọn | Bị chặn lưu; thông báo nêu xung đột giữa bắt buộc và tự chọn | EC-05 | US-026 | CV-098 |
| KB-015 | Học phần trùng trong một khung | ĐV | Khung đã có học phần X; danh mục có Đồ án 1 và Đồ án 2 là hai mã khác nhau | Thêm X lần nữa; sau đó thêm Đồ án 1 và Đồ án 2 | X bị chặn lưu, thông báo nêu dòng đã có; hai đồ án lưu được vì khác mã | EC-06 | US-023, US-031 | CV-085 |
| KB-016 | Học kỳ trống được phép | HT | Chương trình 8 học kỳ, học kỳ 7 chưa có dòng nào | Mở khung theo học kỳ | Học kỳ 7 vẫn hiện, kèm cảnh báo mức thông tin; không thao tác nào bị chặn | EC-07 | US-024 | CV-098 |
| KB-017 | Dòng khung vượt số học kỳ khai báo | ĐV | Chương trình khai báo 8 học kỳ | Đặt một dòng ở học kỳ 9 | Bị chặn lưu; thông báo nêu số học kỳ khai báo là 8 | EC-08 | US-023 | CV-098 |
| KB-018 | Lệch tổng tín chỉ: cảnh báo, chấp nhận kèm lý do | HT | Tổng khai báo 150, tổng tính được 148 | Mở kết quả kiểm tra; chấp nhận không nhập lý do; chấp nhận kèm lý do; sửa khung để chênh lệch thành 5 | Cảnh báo nêu 150, 148 và lệch 2, việc lưu khung không bị chặn; thiếu lý do thì bị chặn; có lý do thì cảnh báo thành "đã chấp nhận" kèm người chấp nhận; chênh lệch đổi thì cảnh báo hiện lại | BR-05, EC-03 | US-030 | CV-098 |
| KB-019 | Tiên quyết bị xếp sau học phần phụ thuộc | HT | A là tiên quyết của B; B ở học kỳ 2, A ở học kỳ 1 | Chuyển A sang học kỳ 3; mở kết quả kiểm tra nhất quán | Chuyển được; có cảnh báo mức cao nêu A và B; không bị chặn | EC-10 | US-027, US-031 | CV-085 |
| KB-020 | Chu trình sinh ra từ ràng buộc riêng của khung | HT | Khung có ràng buộc A là tiên quyết của B | Thêm ràng buộc B là tiên quyết của A cho riêng khung này | Bị chặn lưu; kết quả kiểm tra nêu đường đi của chu trình | BR-11, EC-09 | US-031 | CV-085 |
| KB-021 | Tiên quyết trỏ tới học phần ngoài khung | HT | Học phần B trong khung có tiên quyết A; A không nằm trong khung | Mở kết quả kiểm tra nhất quán | Có cảnh báo nêu A nằm ngoài chương trình; không bị chặn | EC-13 | US-031 | CV-085 |
| KB-022 | Excel sai định dạng bị từ chối ngay | TH | Tệp khung thiếu một cột bắt buộc | Tải tệp lên | Bị từ chối trước khi kiểm từng dòng; thông báo nêu tên cột sai; không có phiên nào ở trạng thái Đã ghi | EC-47 | US-034 | CV-098 |
| KB-023 | Excel có mã học phần không tồn tại | TH | Tệp khung đúng mẫu, dòng 15 mang mã không có trong danh mục | Chạy thử | Báo cáo có dòng 15 mang LỖI nêu mã học phần; không dòng nào được ghi; nút xác nhận ghi bị tắt | EC-45 | US-034 | CV-098 |
| KB-024 | Excel danh mục có dòng trùng và tín chỉ thập phân | TH | Tệp danh mục có hai dòng cùng mã học phần, một dòng 2.5 tín chỉ và một dòng 0 tín chỉ | Chạy thử; sửa dòng trùng; chạy thử lại và ghi | Lần đầu báo cáo nêu đúng số của hai dòng trùng; lần sau dòng 0 tín chỉ nhận CẢNH BÁO chứ không phải LỖI, học phần 2.5 tín chỉ được ghi đúng 2.5 | BR-01, EC-46 | US-033 | CV-098 |
| KB-025 | Excel khung có dòng trùng và có chu trình | TH | Tệp khung có hai dòng cùng học phần và hai dòng tạo chu trình tiên quyết | Chạy thử | Báo cáo nêu LỖI ở các dòng trùng và LỖI kèm đường đi của chu trình; không dòng nào được ghi | BR-11, EC-46 | US-034 | CV-098 |
| KB-026 | Thấy các chương trình đang dùng học phần trước khi sửa | HT | Học phần nằm trong khung của hai chương trình | Bấm sửa học phần | Hệ thống hiện hai chương trình kèm phiên bản và học kỳ trước khi mở form sửa | EC-38 | US-028 | CV-098 |

### 6.3. Bậc B3 — Đề cương và chuẩn đầu ra

| Mã | Kịch bản | Mức | Điều kiện đầu | Thao tác | Kết quả mong đợi | BR / EC | Story | Việc kiểm thử |
|---|---|---|---|---|---|---|---|---|
| KB-027 | Tổng trọng số phải bằng 100% | ĐV | Đề cương Nháp có ba thành phần 20%, 30%, 40% | Lưu; sửa thành phần cuối thành 50% rồi lưu | Lần đầu bị chặn, thông báo nêu còn thiếu 10%; lần sau lưu được | BR-12, EC-39 | US-049 | CV-134 |
| KB-028 | Trọng số từng thành phần nằm trong khoảng lớn hơn 0 đến 100 | ĐV | Đề cương Nháp | Nhập một thành phần 0%; nhập một thành phần 120% | Cả hai bị chặn lưu, thông báo nêu khoảng hợp lệ | BR-13 | US-049 | CV-134 |
| KB-029 | Thành phần điều kiện phải có ngưỡng | ĐV | Đề cương Nháp có một thành phần đánh dấu là điều kiện | Lưu khi chưa nhập ngưỡng; nhập ngưỡng rồi lưu; mở công thức điểm | Lần đầu bị chặn; lần sau lưu được và công thức điểm hiện câu "dưới ngưỡng này thì học phần Không đạt"; không có chỗ nhập điểm sinh viên | BR-15, EC-42 | US-050 | CV-134 |
| KB-030 | CLO chưa được thành phần đánh giá nào đo | HT | Đề cương Nháp có CLO3 không gắn thành phần nào | Lưu đề cương; gắn CLO3 vào một thành phần; kiểm tra lại | Lưu được kèm cảnh báo nêu CLO3; sau khi gắn thì hết cảnh báo | BR-14, EC-40 | US-052 | CV-134 |
| KB-031 | PLO thuộc đúng một chương trình | ĐV | Hai chương trình đều có PLO mã PLO1 | Sửa mô tả PLO1 của chương trình thứ nhất | PLO1 của chương trình thứ hai không đổi; thêm PLO1 lần nữa trong cùng phiên bản thì bị chặn | BR-17 | US-042 | CV-135 |
| KB-032 | CLO thuộc đúng một đề cương và dùng chung cho mọi chương trình | ĐV | Học phần nằm trong khung của hai chương trình | Thêm CLO vào đề cương; mở ma trận của từng chương trình | Cả hai chương trình thấy cùng danh sách CLO; thêm trùng mã CLO trong cùng đề cương thì bị chặn | BR-18 | US-043 | CV-135 |
| KB-033 | Liên kết CLO–PLO theo cặp chương trình, học phần và chỉ tới PLO học phần đã gắn | HT | Học phần nằm trong khung của chương trình A và B; ở A học phần đã gắn PLO2, ở B đã gắn PLO5 trong ma trận học phần–PLO | Ở A gắn CLO1 với PLO2; ở B gắn CLO1 với PLO5; ở A gắn CLO1 với PLO3 mà học phần chưa gắn | Hai liên kết đầu lưu được và không ảnh hưởng nhau; liên kết thứ ba bị chặn, thông báo nêu học phần chưa gắn PLO3 | BR-19 | US-044 | CV-135 |
| KB-034 | PLO không có học phần nào đóng góp | HT | Chương trình có PLO6 chưa được ô ma trận nào trỏ tới | Mở báo cáo độ bao phủ; lưu ma trận | PLO6 nằm trong mục "PLO chưa có học phần đóng góp"; việc lưu không bị chặn | BR-20, EC-41 | US-047 | CV-123 |
| KB-035 | Bản nhân bản có PLO riêng, đề cương vẫn dùng chung | HT | Chương trình nguồn có PLO và ma trận | Nhân bản; sửa một PLO của bản mới; mở đề cương của một học phần từ bản mới | PLO cùng mã ở nguồn không đổi; đề cương là bản dùng chung, không có bản sao | BR-17, BR-18 | US-048 | CV-125 |
| KB-036 | Học phần chưa có đề cương vẫn nằm trong khung được | HT | Khung có học phần X chưa có đề cương | Mở đề cương của X từ khung | Hệ thống nói rõ "chưa có đề cương" và hiện nút tạo cho người có quyền; X vẫn ở trong khung | EC-44 | US-038 | CV-135 |

### 6.4. Bậc B4 — Đề xuất thay đổi và phiên bản

| Mã | Kịch bản | Mức | Điều kiện đầu | Thao tác | Kết quả mong đợi | BR / EC | Story | Việc kiểm thử |
|---|---|---|---|---|---|---|---|---|
| KB-037 | Chặn ban hành khi còn học phần chưa có đề cương | HT | Chương trình chỉ có phiên bản Nháp; học phần X trong khung chưa có đề cương | R1 ban hành phiên bản đầu tiên; tạo đề cương cho X; ban hành lại | Lần đầu bị chặn, nêu X trong danh sách thiếu đề cương; lần sau phiên bản rời Nháp | EC-44 | US-071 | CV-200 |
| KB-038 | Ban hành lần đầu theo học kỳ hiệu lực | HT | Hai chương trình chỉ có phiên bản Nháp; một học kỳ đã bắt đầu, một học kỳ chưa tới | Ban hành chương trình thứ nhất với học kỳ đã bắt đầu; ban hành chương trình thứ hai với học kỳ chưa tới | Phiên bản thứ nhất vào thẳng Đang hiệu lực; phiên bản thứ hai ở Chờ hiệu lực; mỗi chương trình có không quá một phiên bản Đang hiệu lực | BR-22, BR-25 | US-071 | CV-185 |
| KB-039 | Sửa trực tiếp dữ liệu đã ban hành bị từ chối | HT | Chương trình đã có phiên bản Đang hiệu lực | Lần lượt bằng sáu vai trò, gọi thẳng thao tác sửa khung, PLO, đề cương, công thức điểm | Mọi lời gọi bị máy chủ từ chối; giao diện chỉ còn lối tạo đề xuất | BR-23 | US-053 | CV-137 |
| KB-040 | Định tuyến theo nhóm phụ trách học phần | TH | Giảng viên thuộc nhóm N1 và N2; học phần X do N1 phụ trách | Giảng viên gửi đề xuất sửa đề cương X | Đề xuất vào hàng đợi của Điều phối N1; Điều phối N2 không thấy | EC-21 | US-057 | CV-149 |
| KB-041 | Đề xuất chạm học phần của hai nhóm | TH | Đề xuất gồm thay đổi trên học phần của N1 và của N2 | Gửi; Điều phối N1 đồng ý; xem đề xuất; Điều phối N2 đồng ý | Sau lượt đồng ý thứ nhất đề xuất vẫn ở Chờ Điều phối nhóm CM và hiện tiến độ từng người; sau lượt thứ hai mới sang Chờ Giám đốc CTĐT | EC-22 | US-057, US-063 | CV-149 |
| KB-042 | Học phần thuộc ba chương trình cần cả ba Giám đốc | TH | Học phần X nằm trong phiên bản Đang hiệu lực của ba chương trình | Đề xuất sửa đề cương X qua cấp 1; hai Giám đốc đồng ý; Giám đốc thứ ba đồng ý | Sau hai lượt đề xuất vẫn ở Chờ Giám đốc CTĐT; sau lượt thứ ba mới sang Chờ Phòng Đào tạo | EC-23 | US-057, US-064 | CV-149 |
| KB-043 | Đề xuất về học phần của khoa khác đi thẳng Phòng Đào tạo | TH | Học phần T do khoa khác phụ trách | R5 gửi đề xuất sửa T | Đề xuất vào thẳng Chờ Phòng Đào tạo; lịch sử ghi cấp 1 và cấp 2 không áp dụng | EC-24 | US-057 | CV-149 |
| KB-044 | Chặn gửi duyệt khi còn CLO chưa được đánh giá | HT | Nội dung đề xuất để CLO3 không gắn thành phần nào | Bấm gửi duyệt | Bị chặn; thông báo nêu tên CLO3; đề xuất vẫn ở Nháp | EC-40 | US-057 | CV-149 |
| KB-045 | Sửa đề cương dùng chung sinh phiên bản ở mọi chương trình | HT | Học phần X nằm trong phiên bản Đang hiệu lực của ba chương trình và trong phiên bản Lịch sử của chương trình thứ tư | Soạn đề xuất sửa đề cương X và bấm gửi; đi hết ba cấp | Trước khi xác nhận gửi, danh sách ba chương trình bị ảnh hưởng hiện ra; sau chấp thuận cuối có một bản đề cương mới Đã ban hành và ba phiên bản chương trình mới ở Chờ hiệu lực; chương trình thứ tư không sinh phiên bản | EC-38 | US-057, US-075 | CV-190 |
| KB-046 | Hai đề xuất song song trên cùng một đề cương | HT | Đề cương X đang có đề xuất D1 chờ duyệt | Người khác tạo đề xuất D2 cho X; D1 được chấp thuận cuối; đưa D2 tới bước chấp thuận cuối | Khi tạo D2 có cảnh báo nêu mã, người tạo và trạng thái của D1, vẫn tạo được; D2 bị chặn ghi ở bước cuối với thông báo đề xuất dựa trên bản đã cũ | BR-30, EC-27 | US-058 | CV-152 |
| KB-047 | Lý do trả lại hoặc từ chối tối thiểu 20 ký tự | ĐV | Đề xuất đang chờ ở cấp của người duyệt | Trả lại với lý do 19 ký tự; trả lại với lý do 20 ký tự; lặp lại với Từ chối | Lý do 19 ký tự bị chặn; lý do 20 ký tự được nhận, ở cả hai hành động | BR-28 | US-063, US-064 | CV-165 |
| KB-048 | Trả lại ở cấp 1 rồi gửi lại | HT | Đề xuất ở Chờ Điều phối nhóm CM | Điều phối trả lại kèm lý do; người tạo sửa và gửi lại | Đề xuất về Nháp, người tạo nhận thông báo kèm lý do; gửi lại thì quy trình bắt đầu từ cấp 1 và số lần gửi tăng một | BR-29 | US-057, US-063 | CV-165 |
| KB-049 | Phòng Đào tạo trả lại sau khi hai cấp dưới đã đồng ý | HT | Đề xuất ở Chờ Phòng Đào tạo, cấp 1 và cấp 2 đã đồng ý | R1 trả lại kèm lý do; người tạo gửi lại | Đề xuất về Nháp; gửi lại thì đi lại từ cấp 1, hai lượt đồng ý cũ không còn hiệu lực nhưng vẫn nằm trong lịch sử | BR-28, BR-29, EC-26 | US-065 | CV-165 |
| KB-050 | Điều phối tự tạo đề xuất: bỏ qua cấp 1 | HT | R4 là Điều phối duy nhất của nhóm phụ trách học phần | R4 tạo và gửi đề xuất | Đề xuất vào thẳng Chờ Giám đốc CTĐT; lịch sử ghi "tự động bỏ qua" kèm lý do | BR-27, EC-20 | US-066 | CV-167 |
| KB-051 | Giám đốc CTĐT tự tạo đề xuất: bỏ qua cấp 2 | HT | R3 phụ trách chương trình duy nhất bị ảnh hưởng | R3 tạo và gửi đề xuất; cấp 1 đồng ý | Đề xuất vào thẳng Chờ Phòng Đào tạo; lịch sử ghi cấp 2 được bỏ qua kèm lý do | BR-27, EC-19 | US-066 | CV-167 |
| KB-052 | Không ai duyệt được đề xuất của chính mình | TH | Một đề xuất do R4 tạo, cần hai Điều phối; một đề xuất do một tài khoản R1 tạo | R4 gọi thẳng thao tác duyệt đề xuất của mình; đề xuất của R1 tới cấp 3 | Lời gọi của R4 bị máy chủ từ chối và Điều phối còn lại vẫn phải duyệt; cấp 3 không bị bỏ qua, phải do một tài khoản R1 khác xử lý | BR-27 | US-066 | CV-167 |
| KB-053 | Phòng Đào tạo can thiệp ở cấp dưới | HT | Một đề xuất chờ ở cấp 1 đã nhiều ngày vì người duyệt vắng | R1 lọc danh sách theo số ngày đã chờ; can thiệp không nhập lý do; can thiệp kèm lý do | Đề xuất tồn đọng hiện trong danh sách; thiếu lý do thì bị chặn; có lý do thì cấp đó được coi là đã qua, lịch sử ghi đây là can thiệp và ai là người lẽ ra phải duyệt | BR-31, EC-25, EC-28 | US-070 | CV-176 |
| KB-054 | Người tạo hoặc người duyệt bị vô hiệu hóa giữa chừng | HT | Đề xuất đang ở cấp 2; cấp 1 đã đồng ý | Vô hiệu hóa tài khoản người tạo và tài khoản người đã duyệt cấp 1; cấp 2 và cấp 3 đồng ý | Đề xuất đi tiếp tới Đã duyệt; lịch sử duyệt vẫn hiện tên hai người kèm nhãn tài khoản đã vô hiệu hóa; không tài khoản nào bị xóa | EC-29, EC-51 | US-004 | CV-200 |
| KB-055 | Quy tắc đánh số phiên bản | TH | Chương trình đang ở phiên bản 1.0 | Chấp thuận cuối một đề xuất sửa đề cương; sau đó chấp thuận cuối một đề xuất sửa khung | Phiên bản sinh ra lần lượt là 1.1 rồi 2.0 | BR-24 | US-072, US-075 | CV-183 |
| KB-056 | Ảnh chụp không đổi khi danh mục đổi | TH | Phiên bản 1.0 đã ban hành, chứa học phần X | Đổi tên X trong danh mục; mở lại phiên bản 1.0; gọi thẳng thao tác ghi lên phiên bản 1.0 | Phiên bản 1.0 vẫn hiện tên X như lúc ban hành; mọi lời gọi ghi bị từ chối | BR-23 | US-074 | CV-186 |
| KB-057 | Hiệu lực từ đầu học kỳ, không hồi tố | TH | Phiên bản 1.1 ở Chờ hiệu lực cho học kỳ kế tiếp; phiên bản 1.0 Đang hiệu lực | Xem chương trình giữa học kỳ; dời ngày bắt đầu học kỳ kế tiếp về hôm nay và chạy bước kích hoạt; chạy bước kích hoạt lần nữa | Trước ngày bắt đầu: 1.0 vẫn Đang hiệu lực, đề xuất ở Đã duyệt, công thức điểm cũ vẫn áp dụng. Sau kích hoạt: 1.1 Đang hiệu lực, 1.0 sang Lịch sử, đề xuất sang Đang hiệu lực. Chạy lại không đổi gì thêm | BR-16, BR-22, BR-25, EC-30 | US-073 | CV-185 |
| KB-058 | Ban hành đính chính thay vì xóa | HT | Phiên bản 1.1 đã ban hành có sai sót | R1 tìm thao tác xóa; tạo bản đính chính thiếu lý do; tạo lại kèm lý do | Không có thao tác xóa; thiếu lý do thì bị chặn; có lý do thì phiên bản 1.2 được ban hành, ghi rõ đính chính cho 1.1; bản 1.1 sang Lịch sử, vẫn mở được, mang nhãn "đã được đính chính bởi" | BR-24, EC-31 | US-076 | CV-183 |
| KB-059 | Khóa cũ giữ phiên bản cũ | HT | Chương trình mã 1024034 có phiên bản 1.0 áp dụng cho K2023 và phiên bản 2.0 vừa có hiệu lực | Gán 2.0 cho K2025; mở danh sách khóa và phiên bản | K2025 dùng 2.0; K2023 vẫn dùng phiên bản đã gán trước, không tự chuyển sang 2.0 | BR-26 | US-080 | CV-199 |

### 6.5. Bậc B5 — Sinh viên, điều kiện đăng ký và xét tốt nghiệp

| Mã | Kịch bản | Mức | Điều kiện đầu | Thao tác | Kết quả mong đợi | BR / EC | Story | Việc kiểm thử |
|---|---|---|---|---|---|---|---|---|
| KB-060 | Excel danh sách sinh viên có mã trùng | TH | Tệp sinh viên có hai dòng cùng mã sinh viên | Chạy thử | Báo cáo nêu LỖI ở đúng hai dòng; không sinh viên nào được ghi | EC-46 | US-082 | CV-245 |
| KB-061 | Sinh viên được gắn phiên bản áp dụng cho khóa mình | HT | K2023 đã được gán phiên bản 1.0; phiên bản đang hiệu lực của chương trình là 2.0 | Nhập một sinh viên K2023; sinh viên đó đăng nhập cổng | Sinh viên có ghi danh loại Chính trỏ tới 1.0; cổng hiện chương trình theo 1.0, không phải 2.0 | BR-26 | US-082, US-092 | CV-228 |
| KB-062 | Excel kết quả có mã không tồn tại | TH | Tệp kết quả có một dòng mang mã học phần không có trong danh mục | Chạy thử | Báo cáo nêu LỖI ở đúng dòng đó; không kết quả nào được ghi | EC-45 | US-083 | CV-208 |
| KB-063 | Học lại: lấy điểm cao nhất, tín chỉ tính một lần | TH | Sinh viên học A hai lần: lần đầu không đạt, lần sau đạt; A là tiên quyết của B với ngưỡng | Ghi cả hai dòng kết quả; xét điều kiện đăng ký B; mở tiến độ | Cả hai kết quả được giữ; điều kiện tiên quyết dùng điểm cao nhất nên B là "Được"; tín chỉ của A chỉ cộng một lần | EC-36 | US-083, US-085, US-094 | CV-208 |
| KB-064 | Sinh viên chuyển ngành | HT | Sinh viên đã đạt học phần M ở chương trình cũ; M cùng nhóm tương đương với N trong chương trình mới | R1 gắn sinh viên sang phiên bản của chương trình mới kèm căn cứ; xét tốt nghiệp | Ghi danh cũ sang Đã chuyển, ghi danh mới ở Đang theo học và mang dấu ngoại lệ; yêu cầu N được coi là hoàn thành nhờ M | EC-33 | US-084, US-088 | CV-211 |
| KB-065 | Sinh viên học song ngành | HT | Sinh viên có ghi danh Chính ở chương trình A | R1 thêm ghi danh loại Song ngành ở chương trình B; xét tốt nghiệp | Hai ghi danh cùng ở Đang theo học; mỗi ghi danh có một kết luận xét riêng | EC-34 | US-084, US-087 | CV-211 |
| KB-066 | Chuyển từ Cử nhân sang Kỹ sư | HT | Sinh viên đã tích lũy tín chỉ ở chương trình Cử nhân | R1 gắn lại sang phiên bản chương trình Kỹ sư; xét tốt nghiệp | Kết quả đã học được giữ và được công nhận; phần chênh lệch hiện ở mục còn thiếu | EC-35 | US-084 | CV-211 |
| KB-067 | Sinh viên bảo lưu quay lại học | HT | Sinh viên K2021 bảo lưu, quay lại khi phiên bản mới đã có hiệu lực | Mở ghi danh của sinh viên; kích hoạt một phiên bản mới của chương trình rồi mở lại | Sinh viên vẫn ở phiên bản của khóa gốc cả trước và sau khi phiên bản mới có hiệu lực | BR-26, EC-37 | US-084 | CV-211 |
| KB-068 | Học trước thỏa khi đã có kết quả, kể cả không đạt | ĐV | B có học phần học trước A; sinh viên đã học A và không đạt | Xét điều kiện đăng ký B | Điều kiện học trước được coi là thỏa; B là "Được". Sinh viên chưa từng học A thì B là "Không được" kèm tên A | BR-06 | US-085 | CV-213 |
| KB-069 | Tiên quyết thỏa khi điểm đạt ngưỡng | ĐV | B có tiên quyết A với ngưỡng; ba sinh viên: điểm trên ngưỡng, dưới ngưỡng, chưa có điểm | Xét điều kiện đăng ký B cho từng người | Người thứ nhất "Được"; hai người còn lại "Không được" kèm tên A | BR-07 | US-085 | CV-213 |
| KB-070 | Song hành: đã hoàn thành hoặc đăng ký cùng kỳ | ĐV | B song hành với A; một sinh viên đã đạt A, một sinh viên chưa học A nhưng A đăng ký được | Xét điều kiện đăng ký B cho từng người | Người thứ nhất "Được"; người thứ hai "Được, nếu đăng ký cùng học phần song hành" | BR-08 | US-085 | CV-213 |
| KB-071 | Song hành bắc cầu chưa đủ điều kiện | ĐV | A cần song hành B, B cần song hành C; C chưa đủ điều kiện vì thiếu tiên quyết | Xét điều kiện đăng ký A; tạo vòng song hành rồi xét lại | Kết quả là "Không được — học phần song hành chưa đủ điều kiện"; với vòng song hành phép tính dừng, không quá 20 cấp | EC-11 | US-085 | CV-213 |
| KB-072 | Tiên quyết đã Ngừng mở lớp | ĐV | B có tiên quyết A; A ở Ngừng mở lớp và có học phần thay thế A2; sinh viên đã đạt A2 | Xét điều kiện đăng ký B | Kết quả của A2 được dùng thay cho A nên B là "Được" | EC-12 | US-085 | CV-213 |
| KB-073 | Đã đạt học phần tương đương thì coi là đã hoàn thành | ĐV | X và X2 cùng nhóm tương đương; sinh viên đã đạt X2 | Xét điều kiện đăng ký X | Kết quả là "Đã hoàn thành" | BR-09 | US-085 | CV-219 |
| KB-074 | Học phần 0 tín chỉ bắt buộc chưa đạt | ĐV | Sinh viên đủ tổng tín chỉ, còn một học phần 0 tín chỉ bắt buộc chưa đạt | Xét tốt nghiệp | Kết luận Chưa đủ điều kiện; học phần đó nằm trong danh sách còn thiếu | BR-02 | US-087 | CV-245 |
| KB-075 | Nhóm tự chọn thiếu tín chỉ | ĐV | Nhóm tự chọn yêu cầu 6 tín chỉ; sinh viên đã đạt một học phần 3 tín chỉ của nhóm | Xét tốt nghiệp và mở danh sách còn thiếu | Hạng mục ghi tên nhóm, đã có 3, còn thiếu 3; đạt thêm một học phần 3 tín chỉ thì hạng mục biến mất | BR-04 | US-089 | CV-245 |
| KB-076 | Công nhận tương đương bắc cầu khi xét | ĐV | A, B, C cùng một nhóm tương đương; khung yêu cầu A; sinh viên đã đạt C | Xét tốt nghiệp | Yêu cầu A được coi là hoàn thành | BR-09, EC-15 | US-088 | CV-219 |
| KB-077 | Tương đương khác số tín chỉ | ĐV | Khung yêu cầu học phần 3 tín chỉ; sinh viên đạt học phần tương đương 2 tín chỉ | Xét tốt nghiệp | Học phần được công nhận hoàn thành; chỉ 2 tín chỉ được tính; 1 tín chỉ chênh lệch nằm ở phần còn thiếu kèm cảnh báo | BR-10, EC-14 | US-088 | CV-219 |
| KB-078 | Đạt cả hai học phần cùng nhóm tương đương | ĐV | A và B cùng nhóm; khung yêu cầu A; sinh viên đạt cả A và B | Xét tốt nghiệp | Chỉ một học phần được tính cho yêu cầu; học phần còn lại được ghi là tín chỉ tự do | EC-17 | US-088 | CV-219 |
| KB-079 | Tương đương giữa mã cũ và mã mới, giữa hai chương trình | ĐV | Nhóm tương đương gồm mã cũ, mã mới và một học phần của chương trình khác | Xét sinh viên theo phiên bản mới khi đã đạt mã cũ; xét sinh viên chuyển ngành đã đạt học phần của chương trình cũ | Cả hai trường hợp đều được công nhận | EC-16, EC-18 | US-088 | CV-219 |
| KB-080 | Điểm bị sửa sau khi đã xét tốt nghiệp | TH | Sinh viên có kết quả xét Đủ điều kiện đã lưu | Nhập lại tệp kết quả với một học phần bắt buộc đổi thành Không đạt; lặp lại với thay đổi không làm đổi kết luận | Hệ thống xét lại và lưu kết quả mới, kết quả cũ còn trong lịch sử; Phòng Đào tạo nhận thông báo nêu kết luận cũ và mới; lần thứ hai không có thông báo | EC-43 | US-091 | CV-225 |
| KB-081 | Sinh viên chưa có kết quả học tập | HT | Sinh viên vừa nhập, chưa có kết quả nào | Sinh viên mở khung và tiến độ; gọi ba đường dẫn tiến độ, điều kiện đăng ký, xét tốt nghiệp của API | Cổng hiện đủ khung, mọi học phần ở "Chưa học", tiến độ ghi chưa có dữ liệu; API trả phản hồi hợp lệ với dữ liệu rỗng và cờ chưa có dữ liệu, không phải lỗi | EC-52 | US-093, US-100 | CV-242 |
| KB-082 | Tiến độ: 0 tín chỉ không cộng, tín chỉ tính theo học phần đã học | HT | Sinh viên đã đạt một học phần 0 tín chỉ và một học phần tương đương 2 tín chỉ thay cho học phần 3 tín chỉ | Mở tiến độ | Học phần 0 tín chỉ không cộng vào tín chỉ tích lũy nhưng được đếm là học phần điều kiện đã hoàn thành; học phần tương đương cộng 2 tín chỉ | BR-02, BR-10 | US-094 | CV-219 |
| KB-083 | Sinh viên thấy công thức điểm đang hiệu lực, không phải bản vừa duyệt | HT | Đề cương có bản mới đã duyệt, học kỳ hiệu lực chưa tới | Sinh viên mở đề cương của học phần | Thấy bản đang hiệu lực được ghim trong phiên bản của mình; không thấy bản Nháp, đề xuất hay bình luận nội bộ | BR-16, EC-30 | US-096 | CV-245 |
| KB-084 | Không xóa được chương trình hay học phần đang có sinh viên | HT | Chương trình có sinh viên ghi danh; học phần đã có kết quả học tập | R1 tìm cách bỏ chương trình; chuyển học phần sang Đã hủy | Chương trình chỉ chuyển được sang Ngừng sử dụng; học phần bị chặn chuyển Đã hủy; không có chức năng xóa cứng | EC-50 | US-014, US-019 | CV-245 |

### 6.6. Bậc B6 — Tích hợp trường, báo cáo và hoàn thiện

| Mã | Kịch bản | Mức | Điều kiện đầu | Thao tác | Kết quả mong đợi | BR / EC | Story | Việc kiểm thử |
|---|---|---|---|---|---|---|---|---|
| KB-085 | Mất kết nối giữa lúc đồng bộ | TH | Kết nối chỉ đọc đã cấu hình; nguồn có dữ liệu mới | Chạy đồng bộ và ngắt kết nối giữa chừng; nối lại và chờ lần chạy theo lịch | Không bản ghi nào của lần chạy lỗi nằm lại; nhật ký ghi Thất bại kèm thông báo lỗi; R1 nhận thông báo; lần chạy kế tiếp ghi Thành công | EC-49 | US-103 | CV-253 |
| KB-086 | Excel và cơ sở dữ liệu có sẵn mâu thuẫn | TH | Một kết quả học tập đã nhập từ Excel khác với giá trị ở nguồn của Trường; một học phần khác tên giữa hai bên | Chạy đồng bộ; sau đó nhập Excel cùng bản ghi với giá trị khác | Kết quả học tập lấy theo nguồn Trường, mâu thuẫn được đếm trong nhật ký đồng bộ kèm giá trị hai bên; tên học phần giữ theo hệ thống này; chạy thử Excel báo CẢNH BÁO "nguồn Trường được ưu tiên" và không ghi đè | EC-48 | US-104 | CV-255 |
| KB-087 | Đồng bộ làm đổi điểm sau khi đã xét | TH | Sinh viên có kết quả xét đã lưu; nguồn của Trường sửa một điểm làm đổi kết luận | Chạy đồng bộ | Hệ thống xét lại; Phòng Đào tạo nhận thông báo nêu kết luận cũ và mới | EC-43 | US-103 | CV-253 |
| KB-088 | Ủy quyền phê duyệt có thời hạn | HT | R3 sắp vắng mặt | R3 tạo ủy quyền cho người nhận từ hôm nay tới ngày mai; người nhận duyệt một đề xuất; người nhận thử duyệt đề xuất do chính mình tạo; qua ngày kết thúc | Người nhận thấy đề xuất trong hàng đợi và lịch sử ghi ai làm thay ai; đề xuất do chính người nhận tạo thì máy chủ từ chối; sau ngày kết thúc ủy quyền ở Hết hạn và hàng đợi của người nhận không còn các đề xuất đó | BR-27, EC-25 | US-114 | CV-272 |
| KB-089 | Nhắc hạn đề xuất tồn đọng | HT | Số ngày chờ tối đa được cấu hình; một đề xuất chờ quá số ngày đó | Chạy bước nhắc hạn; chạy lại sau một chu kỳ; xử lý đề xuất rồi chạy lại; tắt tính năng rồi chạy lại | Lần đầu người duyệt nhận thông báo nhắc; lần sau cả người duyệt và Phòng Đào tạo nhận; sau khi xử lý không còn nhắc; khi tắt không có nhắc nhưng hàng đợi vẫn hiện số ngày đã chờ | BR-31, EC-28 | US-116 | CV-276 |
| KB-090 | Bảng sức khỏe gom mọi cảnh báo của một chương trình | HT | Chương trình có: lệch tổng tín chỉ, học kỳ trống, tiên quyết ngoài khung, PLO chưa có học phần đóng góp, học phần chưa có đề cương, học phần Ngừng mở lớp chưa có học phần thay thế | Mở bảng sức khỏe; bấm một dòng cảnh báo | Bảng hiện đủ sáu loại kèm số lượng; bấm một dòng thì tới đúng màn hình xử lý | BR-05, BR-20, EC-07, EC-12, EC-13, EC-41, EC-44 | US-113 | CV-277 |
| KB-091 | Đối sánh ghép cặp học phần tương đương | HT | Hai chương trình có hai học phần khác mã nhưng cùng nhóm tương đương | Đối sánh hai chương trình | Hai học phần được ghép thành một cặp tương đương, không nằm ở mục "chỉ có ở một chương trình" | BR-09, EC-18 | US-105 | CV-277 |
| KB-092 | Phân bổ tín chỉ cộng lại bằng tổng | HT | Một phiên bản có khung đầy đủ | Mở báo cáo phân bổ theo khối kiến thức, theo học kỳ, theo bắt buộc và tự chọn | Tổng các dòng của mỗi cách phân bổ bằng tổng tín chỉ tính được của khung | BR-03 | US-106 | CV-277 |
| KB-093 | Xuất ma trận giữ nguyên trọng số số thực trực tiếp | HT | Phiên bản có ma trận dùng trọng số số thực trực tiếp theo FR-41/BR-21 | Xuất ma trận ra Excel | Giá trị số trong tệp trùng với màn hình; không đổi sang I–R–M hoặc tạo chú thích ghi đè (chốt 2026-10-26) | BR-21 | US-107 | CV-277 |
| KB-094 | Bộ kiểm định nêu lỗ hổng chuẩn đầu ra | HT | Phiên bản đã ban hành còn một PLO chưa có học phần đóng góp | Xuất bộ báo cáo kiểm định | Vẫn xuất được; bộ tài liệu có trang liệt kê PLO đó | BR-20, EC-41 | US-108 | CV-277 |

---

## 7. Kịch bản nghiệm thu theo bậc

Cột "Kịch bản" chép nguyên văn từ `docs/planning/epics.md` mục 3. Một bậc đạt nghiệm thu khi mọi dòng của bậc đó đạt trong cùng một lượt chạy, trên dữ liệu vừa nạp lại. Cột "KB liên quan" là các kịch bản KB cùng bậc kiểm sâu hơn cùng story.

### 7.1. Bậc B1 — Nền tảng và danh mục học phần (phiên bản 0.1)

| Mã | Kịch bản | Story | KB liên quan | Ghi chú |
|---|---|---|---|---|
| NT-B1-01 | Phòng Đào tạo đăng nhập, tạo cây Trường → Khoa CNTT → 04 nhóm chuyên môn. | US-001, US-007, US-008 | — |  |
| NT-B1-02 | Tạo tài khoản giảng viên, gán một giảng viên vào hai nhóm, chỉ định Điều phối nhóm chuyên môn có thời gian hiệu lực. | US-004, US-009, US-010 | KB-009 |  |
| NT-B1-03 | Tạo học phần 2.5 tín chỉ và học phần 0 tín chỉ; ghi nhận một học phần thuộc khoa khác. | US-012, US-013 | KB-001, KB-002, KB-003, KB-010 |  |
| NT-B1-04 | Khai báo A là tiên quyết của B với ngưỡng điểm; khai báo B là tiên quyết của A → hệ thống chặn lưu vì tạo chu trình. | US-015, US-016 | KB-004, KB-005 |  |
| NT-B1-05 | Chuyển một học phần sang "Ngừng mở lớp" → hệ thống đòi khai báo học phần thay thế. | US-014 | KB-008 | Trường hợp học phần đã Ngừng mở lớp mà thiếu học phần thay thế: xem T-2 |
| NT-B1-06 | Tra nhật ký theo người dùng và theo đối tượng, thấy đủ các thao tác trên kèm giá trị trước/sau. | US-002, US-003 | — |  |
| NT-B1-07 | Đăng nhập bằng tài khoản giảng viên, gọi thẳng thao tác quản trị → máy chủ từ chối (NFR-09). | US-005 | — |  |

Việc chốt bậc: CV-053.

### 7.2. Bậc B2 — Chương trình đào tạo và khung (phiên bản 0.2)

| Mã | Kịch bản | Story | KB liên quan | Ghi chú |
|---|---|---|---|---|
| NT-B2-01 | Tải tệp mẫu, nhập danh mục học phần từ Excel. | US-032, US-033 | KB-024 |  |
| NT-B2-02 | Nhập file khung của chương trình mẫu (mã 1024034) ở chế độ chạy thử; cố tình để một mã học phần không tồn tại → báo lỗi đúng dòng, không ghi gì. | US-034 | KB-022, KB-023, KB-025 |  |
| NT-B2-03 | Sửa file, nhập lại → ghi toàn bộ; lịch sử phiên nhập liệu ghi số dòng thành công và số dòng lỗi. | US-035, US-036 | — |  |
| NT-B2-04 | Xem khung nhóm theo học kỳ, có tổng tín chỉ từng học kỳ; lọc theo khối kiến thức và theo bắt buộc/tự chọn. | US-024, US-025 | KB-016 |  |
| NT-B2-05 | Khai báo một nhóm tự chọn với số tín chỉ tối thiểu; chuyển một học phần sang học kỳ khác. | US-026, US-027 | KB-013, KB-014, KB-019 |  |
| NT-B2-06 | Xếp học phần tiên quyết sau học phần phụ thuộc → có cảnh báo; tổng tín chỉ tính được lệch số khai báo → có cảnh báo, ghi đè được kèm lý do. | US-030, US-031 | KB-015, KB-018, KB-019, KB-020, KB-021 |  |
| NT-B2-07 | Mở màn hình sửa một học phần → thấy danh sách chương trình đang dùng học phần đó. | US-028 | KB-026 |  |
| NT-B2-08 | Phân công Giám đốc CTĐT; nhân bản chương trình làm nền cho khóa mới. | US-020, US-022 | — |  |
| NT-B2-09 | Xuất khung ra Excel, đối chiếu với file gốc: cùng cột, cùng thứ tự, cùng ký hiệu (DEC-05). | US-037 | — |  |

Việc chốt bậc: CV-098.

### 7.3. Bậc B3 — Đề cương và chuẩn đầu ra (phiên bản 0.3)

| Mã | Kịch bản | Story | KB liên quan | Ghi chú |
|---|---|---|---|---|
| NT-B3-01 | Soạn đề cương cho một học phần đủ các phần của FR-45 bằng trình soạn thảo định dạng; nhập tên, mô tả và CLO bằng cả tiếng Việt và tiếng Anh; đính kèm bản đề cương đã ký. | US-039, US-040, US-041 | — |  |
| NT-B3-02 | Mở học phần đó từ hai chương trình khác nhau → cùng một đề cương, cùng bộ CLO (DEC-02). | US-038 | KB-036 |  |
| NT-B3-03 | Khai báo PLO cho từng chương trình; gắn cùng học phần vào các PLO khác nhau ở hai chương trình rồi gắn CLO của nó vào các PLO đó (DEC-03). | US-042, US-044 | KB-031, KB-033 |  |
| NT-B3-04 | Nhập trực tiếp ma trận học phần–PLO kèm trọng số; nhập 1,5 → bị chặn; xóa một ô đã có CLO gắn → hệ thống nêu số liên kết sẽ mất, xác nhận rồi xóa. | US-046 | — |  |
| NT-B3-05 | Để một PLO không có học phần nào đáp ứng và một CLO không gắn PLO nào → có cảnh báo. | US-047 | KB-034 |  |
| NT-B3-06 | Khai báo công thức điểm tổng 90% → bị chặn lưu; sửa thành 100% → lưu được. | US-049 | KB-027, KB-028 |  |
| NT-B3-07 | Đánh dấu thành phần điều kiện kèm ngưỡng; khai báo điểm liệt. | US-050 | KB-029 |  |
| NT-B3-08 | Để một CLO chưa có thành phần đánh giá nào → có cảnh báo. | US-052 | KB-030 |  |

Việc chốt bậc: CV-135.

### 7.4. Bậc B4 — Đề xuất thay đổi và phiên bản (phiên bản 0.4)

| Mã | Kịch bản | Story | KB liên quan | Ghi chú |
|---|---|---|---|---|
| NT-B4-01 | Ban hành phiên bản khởi tạo cho chương trình đã nhập ở B2–B3 (xem H-1). Sau bước này, sửa trực tiếp dữ liệu đã ban hành bị từ chối. | US-071, US-053 | KB-037, KB-038, KB-039 |  |
| NT-B4-02 | Giảng viên tạo đề xuất sửa công thức điểm một học phần, ghi nguồn phát sinh và số văn bản, đính kèm tờ trình, gửi duyệt. | US-054, US-055, US-056, US-057 | KB-040, KB-041, KB-042, KB-043, KB-044, KB-045, KB-048 |  |
| NT-B4-03 | Người thứ hai tạo đề xuất trên cùng học phần → nhận cảnh báo xung đột. | US-058 | KB-046 |  |
| NT-B4-04 | Điều phối nhóm chuyên môn nhận thông báo, thấy đề xuất trong hàng đợi, xem bảng so sánh trước/sau, **Trả lại** kèm lý do → đề xuất về NHÁP; gửi lại → đi lại từ cấp 1. | US-061, US-062, US-063, US-068 | KB-041, KB-047, KB-048 | Trả lại và Từ chối là hai hành động khác nhau: xem T-3 |
| NT-B4-05 | Cấp 1 đồng ý → Giám đốc CTĐT đồng ý → Phòng Đào tạo đồng ý, nhập số quyết định và học kỳ hiệu lực → đề xuất ĐÃ DUYỆT. | US-064, US-072 | KB-042, KB-047, KB-055 |  |
| NT-B4-06 | Phiên bản mới được sinh ra kèm ảnh chụp bất biến — ngay khi duyệt (FR-69) hay khi đến học kỳ hiệu lực (mục 6.1.4 của SRS), tùy kết luận C01; phiên bản cũ chuyển sang Lịch sử; mọi chương trình chứa học phần đó đều sinh phiên bản mới (DEC-01 kết hợp DEC-02). | US-073, US-074, US-075 | KB-045, KB-055, KB-056, KB-057 | Thời điểm sinh phiên bản và chụp: kiểm theo lựa chọn tạm ở T-5 |
| NT-B4-07 | Ban lãnh đạo khoa xem và bình luận trên đề xuất nhưng không duyệt được. | US-067 | — |  |
| NT-B4-08 | Người tạo đề xuất đồng thời là người duyệt cấp 1 → cấp đó được bỏ qua, nhật ký ghi lý do. | US-066 | KB-050, KB-051, KB-052 |  |
| NT-B4-09 | Thu hồi một đề xuất chưa có cấp nào duyệt. | US-059 | — |  |
| NT-B4-10 | So sánh hai phiên bản, thấy mục thêm / xóa / thay đổi; mở lại đầy đủ nội dung phiên bản cũ; thử sửa phiên bản cũ → bị từ chối. | US-078, US-079 | — |  |
| NT-B4-11 | Gán khóa K2023 giữ phiên bản cũ, khóa mới nhận phiên bản mới. | US-080 | KB-059 |  |
| NT-B4-12 | Ban hành phiên bản đính chính cho một phiên bản ban hành nhầm; dữ liệu lịch sử còn nguyên. | US-076 | KB-058 |  |

Việc chốt bậc: CV-200.

### 7.5. Bậc B5 — Sinh viên, điều kiện đăng ký và xét tốt nghiệp (phiên bản 0.5)

| Mã | Kịch bản | Story | KB liên quan | Ghi chú |
|---|---|---|---|---|
| NT-B5-01 | Nhập danh sách sinh viên và kết quả học tập từ Excel theo tệp mẫu, qua chạy thử rồi mới ghi. | US-081, US-082, US-083 | KB-060, KB-061, KB-062, KB-063 |  |
| NT-B5-02 | Sinh viên khóa K2023 đăng nhập trên điện thoại màn hình 360px, thấy chương trình đúng phiên bản của khóa mình, không phải phiên bản đang hiệu lực mới nhất. | US-092, US-097 | KB-061 |  |
| NT-B5-03 | Khung theo học kỳ hiển thị trạng thái từng học phần: Đã học đạt · Đang học · Chưa học · Không đạt; có số tín chỉ tích lũy, tỷ lệ hoàn thành, số tín chỉ còn thiếu. | US-093, US-094 | KB-063, KB-081, KB-082 | Tên bốn trạng thái kiểm theo US-093: xem T-4 |
| NT-B5-04 | Danh sách học phần đủ điều kiện đăng ký cho học kỳ tới; mỗi học phần chưa đủ điều kiện có lý do cụ thể. Cột "Đăng ký được?" trả ba trạng thái như bảng Excel hiện hành. | US-095, US-086 | — |  |
| NT-B5-05 | Sinh viên mở đề cương và công thức điểm của một học phần, đúng bản thuộc phiên bản của mình. | US-096 | KB-083 |  |
| NT-B5-06 | Sinh viên A gọi dữ liệu của sinh viên B → bị từ chối (NFR-11). | US-092 | KB-061 |  |
| NT-B5-07 | Phòng Đào tạo xét tốt nghiệp một sinh viên đã học một học phần tương đương thay cho học phần trong khung → được tính; sinh viên thiếu một nhóm tự chọn → liệt kê đúng hạng mục thiếu. | US-087, US-088, US-089 | KB-064, KB-065, KB-074, KB-075, KB-076, KB-077, KB-078, KB-079 | Tương đương khác số tín chỉ kiểm ở kịch bản KB của US-088 |
| NT-B5-08 | Xét tốt nghiệp theo lô cho cả một khóa. | US-090 | — |  |
| NT-B5-09 | Gọi API theo tài liệu OpenAPI, lấy được chương trình, tiến độ, điều kiện đăng ký, đề cương, kết quả xét tốt nghiệp. | US-099, US-100, US-101 | KB-081 |  |

Việc chốt bậc: CV-245.

### 7.6. Bậc B6 — Tích hợp trường, báo cáo và hoàn thiện (phiên bản 1.0)

| Mã | Kịch bản | Story | KB liên quan | Ghi chú |
|---|---|---|---|---|
| NT-B6-01 | Cấu hình kết nối chỉ đọc và lịch đồng bộ; chạy đồng bộ, xem nhật ký từng lần. | US-102, US-103 | KB-085, KB-087 | Chạy với nguồn giả lập DL-8 nếu chưa có quyền vào cơ sở dữ liệu của Trường: xem T-11 |
| NT-B6-02 | Tạo mâu thuẫn giữa kết quả học tập trong Excel và trong cơ sở dữ liệu → hệ thống lấy theo nguồn ưu tiên đã cấu hình và ghi cảnh báo. | US-104 | KB-086 |  |
| NT-B6-03 | Ngắt kết nối giữa lúc đồng bộ → hoàn tác toàn bộ, ghi lỗi, thử lại theo lịch (EC-49). | US-103 | KB-085, KB-087 |  |
| NT-B6-04 | Đối sánh chương trình Kỹ sư và Cử nhân cùng ngành; xem phân bổ tín chỉ theo khối kiến thức dạng bảng và biểu đồ. | US-105, US-106 | KB-091, KB-092 |  |
| NT-B6-05 | Xuất ma trận chuẩn đầu ra ra Excel; xuất ma trận PLO/CLO phục vụ kiểm định. | US-107, US-108 | KB-093, KB-094 |  |
| NT-B6-06 | Xem thống kê đề xuất theo trạng thái và thời gian xử lý trung bình từng cấp. | US-109 | — |  |
| NT-B6-07 | Xem đồ thị quan hệ học phần; xuất chương trình ra PDF; xem timeline phiên bản; mở bảng sức khỏe liệt kê mọi cảnh báo của một chương trình. | US-110, US-111, US-112, US-113 | KB-090 |  |
| NT-B6-08 | Người duyệt ủy quyền có thời hạn; hết hạn → ủy quyền tự thu hồi. | US-114 | KB-088 |  |
| NT-B6-09 | Nhận email khi đề xuất chuyển cấp; nhận nhắc hạn khi đề xuất tồn quá số ngày cấu hình. | US-115, US-116 | KB-089 | Chạy với dịch vụ email thử: xem T-11 |

Việc chốt bậc: CV-277.

---

## 8. Kiểm chứng yêu cầu phi chức năng

Mỗi yêu cầu có đúng một phương pháp chính. Cột "Việc" là các việc trong `task-breakdown.md` có nêu yêu cầu đó. Một yêu cầu đã đạt ở bậc bắt đầu vẫn phải được kiểm lại ở mỗi bậc sau, trong lượt hồi quy.

| NFR | Yêu cầu (SRS) | Loại | Phương pháp kiểm chứng | Đạt khi | Từ bậc | Việc |
|---|---|---|---|---|---|---|
| NFR-01 | Thời gian phản hồi các thao tác tra cứu dưới 2 giây | Đo | Đo thời gian phản hồi của ba thao tác tra cứu: danh mục học phần, khung khoảng 60 dòng, khung trên cổng sinh viên; chạy trên bộ dữ liệu DL-2 và DL-7; mỗi thao tác đo 10 lần | Mỗi thao tác có ít nhất 9 trên 10 lần dưới 2 giây | B1 | CV-035 |
| NFR-02 | Tính điều kiện đăng ký cho toàn bộ khung chương trình của một sinh viên dưới 3 giây | Đo | Xét điều kiện đăng ký cho toàn khung khoảng 60 học phần của một sinh viên có đủ kết quả; đo 10 lần ở cổng sinh viên và 10 lần qua API | Ít nhất 9 trên 10 lần dưới 3 giây ở cả hai nơi | B5 | CV-213 |
| NFR-03 | Xét tốt nghiệp theo lô cho một khóa (khoảng 500 sinh viên) dưới 5 phút | Đo | Xét tốt nghiệp theo lô cho 500 sinh viên của bộ DL-7; chạy 3 lần | Cả 3 lần dưới 5 phút; 20 sinh viên lấy mẫu có kết luận trùng với khi xét từng người | B5 | CV-223 |
| NFR-04 | Hệ thống phục vụ đồng thời tối thiểu 200 người dùng | Đo tải | Giả lập 200 phiên đồng thời trong 15 phút theo tỷ lệ thao tác ghi ở T-7 | Không có lỗi máy chủ; ngưỡng của NFR-01 vẫn giữ trong lúc tải | B6 | CV-250 |
| NFR-05 | Nhập file Excel 1000 dòng hoàn thành dưới 60 giây | Đo | Tệp 1000 dòng hợp lệ của bộ DL-4: đo riêng bước chạy thử và bước ghi. Làm với tệp danh mục và tệp khung ở B2, lặp lại với tệp kết quả học tập ở B5 | Mỗi bước dưới 60 giây | B2 | CV-094 |
| NFR-06 | Mật khẩu được băm, không lưu dạng rõ | Rà soát | Đọc dữ liệu tài khoản đã lưu sau khi tạo hai tài khoản có cùng mật khẩu | Không chỗ nào chứa mật khẩu ở dạng đọc được; hai tài khoản có giá trị lưu khác nhau | B1 | CV-001 |
| NFR-07 | Toàn bộ lưu lượng truyền qua HTTPS | Kiểm thử | Gọi ứng dụng web và API qua kết nối không mã hóa | Không dữ liệu nào được trả về qua kết nối không mã hóa | B1 | CV-005 |
| NFR-08 | Phiên làm việc tự hết hạn sau 60 phút không hoạt động | Kiểm thử | Để một phiên không hoạt động 59 phút rồi thao tác; để một phiên khác không hoạt động 61 phút rồi thao tác | Phiên thứ nhất dùng tiếp được; phiên thứ hai bị buộc đăng nhập lại | B1 | CV-005 |
| NFR-09 | Phân quyền được kiểm tra ở tầng máy chủ, không chỉ ẩn/hiện trên giao diện | Kiểm thử | Bảng kiểm ma trận quyền sinh từ `RolePermission` (từ điển dữ liệu mục 9): với mỗi ô, một lời gọi thẳng tới máy chủ bằng vai trò được phép và một lời gọi bằng vai trò không được phép, không đi qua giao diện. Làm phần B1, bổ sung phần của từng bậc sau | Mọi lời gọi không được phép bị máy chủ từ chối; mọi ô của ma trận đã được kiểm | B1 | CV-015 |
| NFR-10 | Nhật ký hệ thống chỉ cho phép ghi thêm (append-only) | Kiểm thử | Bằng cả sáu vai trò gọi thẳng thao tác sửa và xóa dòng nhật ký; đếm số dòng nhật ký trước và sau | Mọi lời gọi bị từ chối; số dòng chỉ tăng | B1 | CV-008 |
| NFR-11 | Sinh viên chỉ truy cập được dữ liệu của chính mình | Kiểm thử | Sinh viên A gọi mọi màn hình nhóm I và mọi đường dẫn API có mã sinh viên bằng mã của sinh viên B | Mọi lời gọi bị từ chối và được ghi nhật ký | B5 | CV-228 |
| NFR-12 | Sao lưu cơ sở dữ liệu tự động hằng ngày, giữ tối thiểu 30 bản gần nhất | Diễn tập | Theo dõi việc sao lưu trong 7 ngày liên tiếp và đọc cấu hình số bản giữ lại | Có đủ 7 bản, mỗi ngày một bản; cấu hình giữ từ 30 bản trở lên | B4 | CV-187 |
| NFR-13 | Có quy trình phục hồi dữ liệu đã được kiểm thử | Diễn tập | Phục hồi một bản sao lưu lên môi trường sạch, chỉ dựa vào tài liệu quy trình; sau đó chạy các kịch bản nghiệm thu của B4 | Hệ thống sau phục hồi chạy được; mọi phiên bản đã ban hành mở lại đủ nội dung; thời gian phục hồi được ghi lại | B4 | CV-187 |
| NFR-14 | Dữ liệu phiên bản đã ban hành không bị mất trong bất kỳ lần nâng cấp nào | Kiểm thử | Trước và sau mỗi lần nâng cấp từ bậc này lên bậc kế, so nội dung mọi phiên bản đã ban hành: số phiên bản, số dòng khung, số PLO, số ô ma trận, bản đề cương được ghim | Không có khác biệt nào | B4 | CV-187 |
| NFR-15 | Mục tiêu thời gian hoạt động 99% trong giờ làm việc | Theo dõi | Lập cơ chế theo dõi tự động thời gian hoạt động trong giờ làm việc; đọc số liệu sau kỳ quan sát ghi ở T-8 | Tỷ lệ hoạt động trong giờ làm việc từ 99% trở lên | B6 | CV-250 |
| NFR-16 | Toàn bộ giao diện và thông báo bằng tiếng Việt có dấu | Rà soát | Đi qua mọi màn hình của danh mục màn hình và mọi tệp xuất với dữ liệu có dấu | Không có chữ mất dấu, chữ lỗi mã hóa hay nhãn chưa dịch; các ký hiệu giữ nguyên theo DEC-05 không tính là lỗi | B1 | CV-003 |
| NFR-17 | Cổng sinh viên hoạt động tốt trên màn hình rộng từ 360px | Kiểm thử | Mở các màn hình nhóm I, MH-55 đến MH-59, ở bề rộng 360px | Không phải cuộn ngang; mọi thao tác bấm được; khung theo học kỳ đọc được | B5 | CV-236 |
| NFR-18 | Mọi danh sách dài có phân trang, tìm kiếm và sắp xếp | Rà soát | Với mỗi màn hình danh sách: nạp nhiều hơn một trang dữ liệu rồi thử phân trang, tìm kiếm, sắp xếp | Cả ba có mặt và cho kết quả đúng | B1 | CV-033 |
| NFR-19 | Thông báo lỗi nêu rõ nguyên nhân và cách xử lý, không hiển thị lỗi kỹ thuật thô | Rà soát | Gây lần lượt các lỗi chặn trong bộ kịch bản KB và đọc thông báo | Mỗi thông báo nêu nguyên nhân và cách xử lý; không hiện thông tin kỹ thuật thô | B1 | CV-037 |
| NFR-20 | Thao tác không thể hoàn tác phải có hộp thoại xác nhận | Rà soát | Lập danh sách thao tác không hoàn tác: vô hiệu hóa tài khoản, chuyển Đã hủy, thu hồi đề xuất, ban hành, xóa PLO đang được dùng, xác nhận ghi Excel; thực hiện từng thao tác | Mỗi thao tác có hộp xác nhận nêu hậu quả; bấm hủy thì không có gì thay đổi | B1 | CV-013 |
| NFR-21 | Kiến trúc monolith với phân tách rõ ràng theo module nghiệp vụ | Rà soát | Rà cấu trúc sản phẩm theo danh sách module của SRS và kiểm tra số đơn vị triển khai | Mỗi module có ranh giới riêng; chỉ có một đơn vị triển khai | B1 | CV-004 |
| NFR-22 | Quy ước đặt tên thống nhất, có tài liệu mô tả | Rà soát | Lấy ngẫu nhiên 20 tên trong sản phẩm và đối chiếu với tài liệu quy ước đặt tên | Tài liệu quy ước tồn tại; không tên nào trong mẫu vi phạm | B1 | CV-004 |
| NFR-23 | Thay đổi lược đồ cơ sở dữ liệu thực hiện qua công cụ migration | Diễn tập | Dựng kho dữ liệu trống rồi áp toàn bộ các bước thay đổi cấu trúc theo thứ tự; áp các bước của bậc mới lên bản dữ liệu của bậc trước | Cả hai lần chạy không lỗi và cho cùng một cấu trúc | B1 | CV-004 |
| NFR-24 | Tham số nghiệp vụ (ngưỡng điểm, số cấp duyệt, thời hạn nhắc) khai báo trong cấu hình, không viết cứng trong mã nguồn | Kiểm thử | Đổi lần lượt từng tham số nghiệp vụ trong cấu hình: thang mức đóng góp, giới hạn tệp đính kèm, lịch đồng bộ, bật tắt email, số ngày chờ tối đa; quan sát hành vi | Hành vi đổi theo cấu hình mà không phải sửa sản phẩm | B1 | CV-004 |
| NFR-25 | Hệ thống triển khai được trên máy chủ do Khoa cung cấp | Trình diễn | Cài đặt lên máy chủ của Khoa, hoặc một máy tương đương nếu chưa có quyền, chỉ dựa vào tài liệu cài đặt | Cài xong; các kịch bản nghiệm thu của B6 chạy được trên máy đó | B6 | CV-249 |
| NFR-26 | Hoạt động trên các phiên bản gần đây của Chrome, Firefox, Edge | Kiểm thử | Chạy các kịch bản nghiệm thu của từng bậc trên bản hiện hành của Chrome, Firefox, Edge | Mọi kịch bản đạt trên cả ba trình duyệt | B1 | CV-053, CV-236 |
| NFR-27 | Có tài liệu hướng dẫn cài đặt và hướng dẫn sử dụng cho từng vai trò | Rà soát | Một người chưa tham gia dự án cài đặt theo tài liệu; với mỗi vai trò, một người làm ba việc chính của vai trò đó chỉ dựa vào hướng dẫn sử dụng | Làm được mà không phải hỏi nhóm phát triển; có hướng dẫn cho đủ sáu vai trò | B6 | CV-249 |

Số yêu cầu theo loại phương pháp: Kiểm thử 9 · Rà soát 8 · Đo 4 · Diễn tập 3 · Đo tải 1 · Theo dõi 1 · Trình diễn 1.

---

## 9. Ma trận truy vết

### 9.1. Quy tắc nghiệp vụ → kịch bản

| BR | Quy tắc (SRS) | Kịch bản | Số kịch bản |
|---|---|---|---|
| BR-01 | Số tín chỉ là số thực không âm, cho phép giá trị 0 và giá trị thập phân (0 · 1 · 2.5 · 3 · 4) | KB-001, KB-002, KB-003, KB-024 | 4 |
| BR-02 | Học phần 0 tín chỉ không cộng vào tổng tín chỉ tích lũy, nhưng vẫn bắt buộc hoàn thành để được xét tốt nghiệp | KB-012, KB-074, KB-082 | 3 |
| BR-03 | Tổng tín chỉ bắt buộc + Tổng tín chỉ tự chọn = Tổng tín chỉ yêu cầu của chương trình | KB-011, KB-012, KB-092 | 3 |
| BR-04 | Tổng tín chỉ của các học phần trong một nhóm tự chọn được phép lớn hơn số tín chỉ tự chọn yêu cầu (sinh viên chọn một phần) | KB-013, KB-075 | 2 |
| BR-05 | Khi tổng tín chỉ tính được khác số khai báo, hệ thống sinh cảnh báo nhưng không chặn việc lưu | KB-018, KB-090 | 2 |
| BR-06 | Quan hệ học trước được thỏa mãn khi sinh viên đã đăng ký và có kết quả học phần nguồn, kể cả kết quả không đạt | KB-068 | 1 |
| BR-07 | Quan hệ tiên quyết được thỏa mãn khi điểm học phần nguồn ≥ ngưỡng Điểm học đã khai báo | KB-069 | 1 |
| BR-08 | Quan hệ song hành được thỏa mãn khi học phần nguồn đã hoàn thành hoặc được đăng ký trong cùng học kỳ | KB-070 | 1 |
| BR-09 | Quan hệ tương đương là quan hệ hai chiều và bắc cầu, được mô hình hóa bằng nhóm học phần tương đương | KB-006, KB-073, KB-076, KB-091 | 4 |
| BR-10 | Khi các học phần tương đương có số tín chỉ khác nhau, số tín chỉ được công nhận là số tín chỉ của học phần sinh viên đã học thực tế | KB-077, KB-082 | 2 |
| BR-11 | Đồ thị quan hệ học trước/tiên quyết không được phép có chu trình | KB-004, KB-005, KB-020, KB-025 | 4 |
| BR-12 | Tổng trọng số các thành phần đánh giá phải bằng đúng 100% | KB-027 | 1 |
| BR-13 | Mỗi trọng số là số thực thuộc khoảng (0, 100] | KB-028 | 1 |
| BR-14 | Mọi CLO phải được ít nhất một thành phần đánh giá bao phủ | KB-030 | 1 |
| BR-15 | Thành phần được đánh dấu "điều kiện" phải khai báo ngưỡng đạt; không đạt ngưỡng này thì kết quả học phần là Không đạt bất kể điểm tổng | KB-029 | 1 |
| BR-16 | Thay đổi công thức điểm có hiệu lực từ học kỳ kế tiếp, không hồi tố cho lớp đang học | KB-057, KB-083 | 2 |
| BR-17 | Mỗi PLO thuộc về đúng một Chương trình đào tạo | KB-031, KB-035 | 2 |
| BR-18 | Mỗi CLO thuộc về đúng một đề cương chi tiết học phần | KB-032, KB-035 | 2 |
| BR-19 | Ma trận CLO–PLO được khai báo theo cặp (Chương trình đào tạo, Học phần), vì một học phần thuộc nhiều chương trình sẽ có bộ PLO khác nhau | KB-033 | 1 |
| BR-20 | Mọi PLO phải được ít nhất một học phần trong khung chương trình đóng góp; nếu không, sinh cảnh báo | KB-034, KB-090, KB-094 | 3 |
| BR-21 | Mức độ đóng góp dùng trọng số số thực trực tiếp theo FR-41/BR-21 (đối soát 2026-10-26) | KB-033, KB-093 | 2 |
| BR-22 | Mỗi Chương trình đào tạo có tối đa một phiên bản Đang hiệu lực tại mỗi thời điểm | KB-038, KB-057 | 2 |
| BR-23 | Phiên bản đã ban hành là bất biến | KB-039, KB-056 | 2 |
| BR-24 | Số phiên bản theo định dạng `<Chính>.<Phụ>` — thay đổi khung chương trình hoặc PLO tăng số Chính; thay đổi đề cương hoặc công thức điểm tăng số Phụ | KB-055, KB-058 | 2 |
| BR-25 | Phiên bản mới có hiệu lực từ đầu học kỳ được chỉ định, không áp dụng giữa học kỳ | KB-038, KB-057 | 2 |
| BR-26 | Sinh viên được gắn với phiên bản CTĐT tại thời điểm nhập học và giữ nguyên trong suốt khóa học, trừ khi có quyết định chuyển đổi cụ thể | KB-059, KB-061, KB-067 | 3 |
| BR-27 | Không ai được phê duyệt đề xuất do chính mình tạo; hệ thống tự động bỏ qua cấp đó | KB-050, KB-051, KB-052, KB-088 | 4 |
| BR-28 | Hành động Trả lại và Từ chối bắt buộc kèm lý do, độ dài tối thiểu 20 ký tự | KB-047, KB-049 | 2 |
| BR-29 | Đề xuất bị trả lại trở về trạng thái NHÁP và khi gửi lại phải đi lại từ cấp 1 | KB-048, KB-049 | 2 |
| BR-30 | Tạo đề xuất mới trên đối tượng đang có đề xuất mở sẽ nhận cảnh báo xung đột | KB-046 | 1 |
| BR-31 | Phòng Đào tạo có quyền phê duyệt trực tiếp ở bất kỳ cấp nào (override), có ghi nhật ký | KB-053, KB-089 | 2 |

### 9.2. Trường hợp biên → kịch bản

| EC | Tình huống (SRS) | Cách xử lý (SRS) | Kịch bản | Số kịch bản |
|---|---|---|---|---|
| EC-01 | Học phần 0 tín chỉ (ví dụ TH Kỹ thuật lập trình) | Không cộng vào tổng tín chỉ nhưng vẫn bắt buộc hoàn thành để tốt nghiệp (BR-02) | KB-003, KB-012 | 2 |
| EC-02 | Số tín chỉ thập phân (2.5) | Dùng kiểu số thực ở mọi tầng: cơ sở dữ liệu, xử lý, hiển thị; cấm dùng kiểu số nguyên | KB-001 | 1 |
| EC-03 | Tổng tín chỉ khai báo (130) khác tổng tính được | Cảnh báo trên bảng điều khiển, cho phép ghi đè kèm lý do bắt buộc (BR-05) | KB-018 | 1 |
| EC-04 | Tổng tín chỉ danh sách tự chọn lớn hơn số tín chỉ tự chọn yêu cầu | Hợp lệ — sinh viên chọn một phần; chỉ kiểm tra tổng tín chỉ đã chọn ≥ mức tối thiểu (BR-04) | KB-013 | 1 |
| EC-05 | Học phần bắt buộc bị đặt vào nhóm tự chọn | Chặn lưu, báo lỗi xung đột phân loại | KB-014 | 1 |
| EC-06 | Học phần xuất hiện nhiều lần trong một khung chương trình | Chặn lưu, trừ trường hợp học phần kéo dài nhiều học kỳ (ví dụ Đồ án 1, Đồ án 2 là hai mã khác nhau) | KB-015 | 1 |
| EC-07 | Khung chương trình có học kỳ trống | Cho phép, sinh cảnh báo mức thông tin | KB-016, KB-090 | 2 |
| EC-08 | Số học kỳ khai báo (8) nhỏ hơn học kỳ lớn nhất xuất hiện trong khung | Chặn lưu kèm thông báo lỗi rõ ràng | KB-017 | 1 |
| EC-09 | Chu trình tiên quyết: A cần B, B cần A | Chặn ngay khi lưu, hiển thị đường đi của chu trình (BR-11) | KB-004, KB-005, KB-020 | 3 |
| EC-10 | Học phần tiên quyết được xếp ở học kỳ sau học phần phụ thuộc | Cảnh báo mức cao trên bảng điều khiển sức khỏe, không chặn (có thể là cố ý) | KB-019 | 1 |
| EC-11 | Song hành bắc cầu: A song hành B, mà B lại chưa đủ điều kiện | Trả về "Không được — học phần song hành chưa đủ điều kiện" (mục 7.3 bước 4) | KB-071 | 1 |
| EC-12 | Học phần tiên quyết đã ngừng mở lớp | Tự động dùng học phần thay thế đã khai báo (QH5); nếu chưa khai báo, cảnh báo cho người quản trị | KB-008, KB-072, KB-090 | 3 |
| EC-13 | Học phần tiên quyết trỏ tới học phần không có trong khung của CTĐT | Cảnh báo — sinh viên có thể phải học một học phần ngoài chương trình | KB-021, KB-090 | 2 |
| EC-14 | Học phần tương đương khác số tín chỉ (A 3TC ↔ B 2TC) | Công nhận số tín chỉ của học phần đã học thực tế (BR-10); nếu thiếu so với yêu cầu, tính vào phần tín chỉ còn thiếu và cảnh báo khi xét tốt nghiệp | KB-077 | 1 |
| EC-15 | Tương đương bắc cầu qua nhiều bước (A≡B, B≡C) | Mô hình nhóm xử lý tự nhiên: A, B, C cùng một nhóm (DEC-06) | KB-006, KB-076 | 2 |
| EC-16 | Tương đương giữa các phiên bản (học phần khung cũ ↔ khung mới) | Nhóm tương đương khai báo ở cấp danh mục học phần, độc lập với phiên bản CTĐT — áp dụng cho mọi phiên bản | KB-007, KB-079 | 2 |
| EC-17 | Sinh viên học cả hai học phần trong một nhóm tương đương | Tín chỉ chỉ được tính một lần vào yêu cầu chương trình; học phần còn lại tính là tín chỉ tự do | KB-078 | 1 |
| EC-18 | Tương đương vượt CTĐT (học phần thuộc chương trình khác) | Cho phép, vì nhóm tương đương được khai báo ở phạm vi toàn trường | KB-007, KB-079, KB-091 | 3 |
| EC-19 | Giám đốc CTĐT tự tạo đề xuất | Tự động bỏ qua cấp 2, ghi nhật ký lý do (DEC-09, BR-27) | KB-051 | 1 |
| EC-20 | Điều phối nhóm chuyên môn tự tạo đề xuất | Tự động bỏ qua cấp 1, ghi nhật ký lý do | KB-050 | 1 |
| EC-21 | Giảng viên thuộc nhiều nhóm chuyên môn | Đề xuất chuyển tới người điều phối của nhóm phụ trách học phần bị tác động, không phụ thuộc giảng viên thuộc những nhóm nào | KB-040 | 1 |
| EC-22 | Đề xuất tác động nhiều học phần thuộc nhiều nhóm | Cần sự đồng ý của tất cả người điều phối nhóm liên quan; hệ thống hiển thị tiến độ phê duyệt theo từng người | KB-041 | 1 |
| EC-23 | Học phần thuộc nhiều Chương trình đào tạo | Cần sự đồng ý của tất cả Giám đốc CTĐT liên quan (mục 6.1.3) | KB-042 | 1 |
| EC-24 | Học phần thuộc khoa khác (Toán, Vật lý, Lý luận chính trị) | Khoa CNTT chỉ được đề xuất; đề xuất chuyển thẳng lên Phòng Đào tạo, bỏ qua cấp 1 và cấp 2 | KB-010, KB-043 | 2 |
| EC-25 | Người duyệt đi công tác / chuyển công tác | Dùng cơ chế ủy quyền có thời hạn (FR-09); Phòng Đào tạo có quyền override (BR-31) | KB-053, KB-088 | 2 |
| EC-26 | Phòng Đào tạo từ chối sau khi hai cấp dưới đã đồng ý | Đề xuất trở về NHÁP của người tạo; khi gửi lại phải đi lại từ cấp 1 (BR-29) | KB-049 | 1 |
| EC-27 | Hai đề xuất song song trên cùng một đề cương | Cảnh báo xung đột khi tạo đề xuất thứ hai; áp dụng khóa lạc quan (optimistic locking) khi ghi (BR-30, FR-68) | KB-046 | 1 |
| EC-28 | Đề xuất tồn đọng quá lâu ở một cấp | Hệ thống nhắc hạn tự động (FR-66); Phòng Đào tạo có thể can thiệp | KB-053, KB-089 | 2 |
| EC-29 | Người tạo đề xuất rời hệ thống khi đề xuất đang luân chuyển | Đề xuất tiếp tục xử lý; người tạo được ghi nhận là tài khoản đã vô hiệu hóa | KB-054 | 1 |
| EC-30 | Sửa đề cương giữa học kỳ | Có hiệu lực từ học kỳ kế tiếp, không hồi tố (DEC-07, BR-16) | KB-057, KB-083 | 2 |
| EC-31 | Ban hành nhầm phiên bản | Ban hành phiên bản đính chính, không xóa lịch sử (DEC-08, FR-75) | KB-058 | 1 |
| EC-32 | Học phần trong phiên bản cũ đã ngừng mở lớp | Dùng học phần thay thế (QH5); sinh viên khóa cũ được công nhận học phần thay thế | KB-008 | 1 |
| EC-33 | Sinh viên chuyển ngành | Gắn lại với phiên bản CTĐT của ngành mới; tín chỉ đã tích lũy được đối chiếu qua nhóm học phần tương đương | KB-064 | 1 |
| EC-34 | Sinh viên học song ngành | Gắn với hai Chương trình đào tạo; xét tốt nghiệp độc lập theo từng chương trình | KB-065 | 1 |
| EC-35 | Chuyển đổi Cử nhân → Kỹ sư | Gắn lại với phiên bản CTĐT Kỹ sư; công nhận toàn bộ tín chỉ đã tích lũy qua nhóm tương đương; phần chênh lệch tính vào tín chỉ còn thiếu | KB-066 | 1 |
| EC-36 | Sinh viên học lại / học cải thiện điểm | Lấy điểm cao nhất trong các lần học khi kiểm tra điều kiện tiên quyết và xét tốt nghiệp | KB-063 | 1 |
| EC-37 | Sinh viên bảo lưu, nhập học lại sau nhiều năm | Giữ nguyên phiên bản CTĐT của khóa gốc; nếu học phần không còn mở, áp dụng EC-32 | KB-067 | 1 |
| EC-38 | Sửa một đề cương dùng chung làm nhiều CTĐT sinh phiên bản mới | Chấp nhận (DEC-01); hệ thống hiển thị danh sách CTĐT bị ảnh hưởng trước khi gửi duyệt (FR-17) | KB-026, KB-045 | 2 |
| EC-39 | Tổng trọng số các thành phần khác 100% | Chặn lưu, hiển thị chính xác phần chênh lệch (BR-12, FR-50) | KB-027 | 1 |
| EC-40 | CLO không được thành phần đánh giá nào bao phủ | Cảnh báo bắt buộc xử lý trước khi gửi duyệt (BR-14, FR-54) | KB-030, KB-044 | 2 |
| EC-41 | PLO không được học phần nào đóng góp | Cảnh báo trên bảng điều khiển sức khỏe chương trình (BR-20, FR-42) | KB-034, KB-090, KB-094 | 3 |
| EC-42 | Thành phần điều kiện dưới ngưỡng nhưng điểm tổng cao | Kết quả học phần là Không đạt (BR-15) | KB-029 | 1 |
| EC-43 | Điểm của sinh viên bị sửa hồi tố sau khi đã xét tốt nghiệp | Tính lại kết quả xét tốt nghiệp và thông báo cho Phòng Đào tạo | KB-080, KB-087 | 2 |
| EC-44 | Học phần chưa có đề cương chi tiết | Cho phép tồn tại trong khung nhưng có cảnh báo; chặn việc ban hành phiên bản khi còn học phần chưa có đề cương | KB-036, KB-037, KB-090 | 3 |
| EC-45 | File Excel chứa mã học phần không tồn tại | Báo lỗi tại đúng dòng, không ghi bất kỳ dữ liệu nào (FR-34, FR-35) | KB-023, KB-062 | 2 |
| EC-46 | File Excel có dòng trùng lặp | Báo các dòng trùng, yêu cầu người dùng sửa trước | KB-024, KB-025, KB-060 | 3 |
| EC-47 | File Excel sai định dạng (thiếu cột, sai kiểu dữ liệu) | Từ chối file ngay ở bước kiểm tra định dạng, nêu rõ cột nào sai | KB-022 | 1 |
| EC-48 | Dữ liệu Excel và cơ sở dữ liệu mâu thuẫn | Áp dụng quy tắc ưu tiên (mục 8.2), ghi cảnh báo vào nhật ký đồng bộ | KB-086 | 1 |
| EC-49 | Mất kết nối cơ sở dữ liệu giữa lúc đồng bộ | Hoàn tác toàn bộ giao dịch đồng bộ, ghi nhật ký lỗi, thử lại theo lịch | KB-085 | 1 |
| EC-50 | Xóa Chương trình đào tạo / học phần đang có sinh viên theo học | Chỉ cho phép chuyển trạng thái sang Ngừng sử dụng; cấm xóa cứng | KB-084 | 1 |
| EC-51 | Xóa người dùng đã tham gia phê duyệt | Chỉ vô hiệu hóa tài khoản; lịch sử phê duyệt được giữ nguyên (FR-06) | KB-009, KB-054 | 2 |
| EC-52 | Sinh viên truy cập khi chưa có dữ liệu kết quả học tập | Hiển thị đầy đủ khung chương trình; phần tiến độ hiển thị thông báo chưa có dữ liệu | KB-081 | 1 |

### 9.3. Story chỉ được kiểm bằng tiêu chí chấp nhận của chính nó

Các story dưới đây không nằm trong kịch bản KB hay NT nào. Chúng vẫn được kiểm: bằng tiêu chí chấp nhận ghi trong `user-stories.md` (xem T-12).

| Story | Tên | Bậc | Số tiêu chí chấp nhận |
|---|---|---|---|
| US-006 | Nhật ký thay đổi phân quyền | B1 | 3 |
| US-011 | Tra cứu danh mục học phần | B1 | 3 |
| US-018 | Tra cứu danh sách chương trình đào tạo | B2 | 3 |
| US-021 | Phạm vi quyền theo chương trình được phân công (đợt 2) | B2 | 3 |
| US-045 | Tra cứu PLO, CLO và ma trận | B3 | 3 |
| US-051 | Ánh xạ thành phần đánh giá với CLO | B3 | 3 |
| US-060 | Đề xuất thay đổi tổ chức và phân công | B4 | 4 |
| US-069 | Lịch sử phê duyệt của đề xuất | B4 | 4 |
| US-077 | Đính kèm đề cương đã ký theo phiên bản (đợt 2) | B4 | 3 |
| US-098 | Cấp và quản lý khóa truy cập cho bên tích hợp | B5 | 5 |

### 9.4. Tổng hợp độ phủ

| Đối tượng | Tổng | Có kịch bản hoặc phương pháp | Còn thiếu |
|---|---|---|---|
| BR | 31 | 31 | 0 |
| EC | 52 | 52 | 0 |
| NFR | 27 | 27 | 0 |
| Kịch bản nghiệm thu trong `docs/planning/epics.md` | 54 | 54 | 0 |
| Story có kịch bản KB | 116 | 63 | — |
| Story có kịch bản NT | 116 | 95 | — |
| Story có KB hoặc NT | 116 | 106 | 10 (mục 9.3) |
| Kịch bản KB có việc kiểm thử riêng | 94 | 65 | 29 chạy trong việc chốt bậc |

---

## 10. Điểm còn hở

Mỗi điểm là một chỗ tài liệu nguồn bỏ trống hoặc không khớp nhau. Lựa chọn tạm đã được dùng để lập kế hoạch này.

| Mã | Vấn đề | Lựa chọn tạm | Ảnh hưởng tới | Phụ thuộc vào |
|---|---|---|---|---|
| T-1 | EC-42 nói thành phần điều kiện dưới ngưỡng thì học phần Không đạt, nhưng hệ thống không giữ điểm từng thành phần (SRS mục 12 loại việc nhập điểm), nên không tự kết luận được | Kiểm hai điều: quy tắc được khai báo và hiển thị đúng (KB-029); và khi tính toán, hệ thống dùng trạng thái Đạt hay Không đạt đi kèm kết quả từ nguồn, không tự suy lại từ điểm tổng | EC-42, BR-15; US-050, US-083 | Không cần hỏi, trừ khi phạm vi nhập điểm thay đổi |
| T-2 | EC-12 có hai nhánh: dùng học phần thay thế, hoặc cảnh báo người quản trị khi chưa khai báo. US-014 lại chặn việc chuyển sang Ngừng mở lớp khi chưa có học phần thay thế, nên nhánh thứ hai chỉ xảy ra với dữ liệu đi vào bằng nhập liệu hoặc đồng bộ | Kiểm cả hai: việc chặn (KB-008), việc dùng học phần thay thế (KB-072), và cảnh báo trên bảng sức khỏe (KB-090) | EC-12, EC-32; US-014, US-085, US-113 | Khoa: có cho phép ngừng mở lớp khi chưa có học phần thay thế hay không |
| T-3 | EC-26 viết "Phòng Đào tạo từ chối" rồi đề xuất về NHÁP; theo S-6 và C02, Trả lại mới đưa về Nháp còn Từ chối thì đóng đề xuất | KB-049 kiểm hành động Trả lại. Nếu Khoa xác nhận Từ chối cũng đưa về Nháp thì kịch bản này và kịch bản về lý do 20 ký tự phải viết lại | EC-26, BR-28, BR-29; US-065 | Khoa trả lời C02 |
| T-4 | Kịch bản nghiệm thu thứ ba của B5 trong `docs/planning/epics.md` gọi bốn trạng thái là "Đã học đạt, Đang học, Chưa học, Không đạt"; US-093 gọi là "Đã đạt, Chưa đạt, Đang học, Chưa học" | Kiểm theo tên trong US-093. Số trạng thái và ý nghĩa giống nhau ở hai nơi nên không ảnh hưởng tới kết quả kiểm | NT-B5-03; MH-56 | Không cần hỏi |
| T-5 | Kịch bản nghiệm thu thứ sáu của B4 để ngỏ thời điểm sinh phiên bản: ngay khi duyệt hay khi tới học kỳ hiệu lực (C01) | Kiểm theo US-072 và US-073: phiên bản mới được sinh ở Chờ hiệu lực ngay khi chấp thuận cuối, và chuyển Đang hiệu lực vào ngày bắt đầu học kỳ | NT-B4-06; KB-057 | Khoa trả lời C01 |
| T-6 | Các ngưỡng thời gian NFR-01, 02, 03, 05 không nói đo trên máy nào và với lượng dữ liệu nào | Đo trên máy chủ của Khoa hoặc máy tương đương, ghi cấu hình máy cùng kết quả. Lượng dữ liệu: khung khoảng 60 dòng, 500 sinh viên, tệp 1000 dòng như SRS nêu; danh mục khoảng 300 học phần là giả định của tài liệu này | NFR-01, NFR-02, NFR-03, NFR-05; DL-2, DL-7 | Khoa cho biết cấu hình máy chủ |
| T-7 | NFR-04 nêu 200 người dùng đồng thời nhưng không nói họ làm gì | Giả lập 200 phiên trong 15 phút: 160 phiên sinh viên xem khung, tiến độ, điều kiện đăng ký; 40 phiên cán bộ tra cứu danh mục và khung. Không có thao tác ghi | NFR-04; CV-250 | Thầy hướng dẫn |
| T-8 | NFR-15 đòi hoạt động 99% trong giờ làm việc; con số này chỉ đo được sau một thời gian vận hành | Ở B6 chỉ kiểm rằng việc theo dõi đã chạy và đọc số liệu của 4 tuần vận hành thử. Nếu đồ án kết thúc trước 4 tuần thì báo cáo số liệu của khoảng thời gian có được | NFR-15; tiêu chí ra của B6 | Lịch của đồ án (xem kế hoạch sprint) |
| T-9 | Không tài liệu nào nói ai chạy kiểm thử và ai chứng kiến nghiệm thu | Nhóm tự chạy; người không viết phần được kiểm thì chạy mức HT; người hướng dẫn chứng kiến lượt nghiệm thu của mỗi bậc. Đại diện Khoa và Phòng Đào tạo chỉ cần cho B6 | Mục 3; mọi việc chốt bậc | Thầy hướng dẫn; quy mô nhóm (xem kế hoạch sprint) |
| T-10 | Công cụ đã chọn (`docs/design/tech-stack.md`) nhưng chưa quyết định mức nào tự động, mức nào làm tay; số kịch bản phải chạy lại tăng dần theo bậc | Kế hoạch chỉ nêu mức và kịch bản. Giả định: mức ĐV tự động được; các mức còn lại có thể làm tay. Khối lượng hồi quy của B6 là toàn bộ 94 kịch bản KB và 54 kịch bản NT | Mức Hồi quy ở mục 3; cỡ của sáu việc chốt bậc (K-3) | Quyết định của nhóm |
| T-11 | E1, E2, E3 đều là hệ thống ngoài mà nhóm chưa có quyền truy cập; Q-09 còn hỏi cơ sở dữ liệu có sẵn là của Trường hay do nhóm tự tạo | Giả lập cả ba: DL-8 thay E1, một dịch vụ email thử thay E2, một bộ lời gọi theo tài liệu API thay E3. Khi có quyền thật thì chạy lại các kịch bản của B6 và kịch bản API của B5 | NT-B6-01, NT-B6-02, NT-B6-03, NT-B6-09, NT-B5-09; EC-48, EC-49 | Q-09; Trường cấp quyền |
| T-12 | 10 story không nằm trong kịch bản KB hay NT nào (mục 9.3) | Chấp nhận: tiêu chí chấp nhận của chính story là ca kiểm của nó và nằm trong tiêu chí ra của bậc. Không viết thêm kịch bản chỉ để lấp bảng | Mục 9.3 | Không cần hỏi |
