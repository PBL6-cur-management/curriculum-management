# USER STORY v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-12 |
| Đi kèm | `docs/planning/epics.md` (bậc B1..B6, EP-01..EP-25), `docs/design/state-diagrams.md` (S-1..S-14), `docs/design/sequence-diagrams.md` (L-1..L-10) |
| Nguồn | `docs/requirement/REQUIREMENTS.md`; `docs/Bo_so_do_Use_Case_CTDT/Thuyet_minh_Use_Case.md` |
| Phạm vi | Toàn bộ 109 yêu cầu chức năng. Không có lát cắt MVP: mỗi bậc là một phiên bản chạy được |
| Điểm còn hở của tài liệu này | U-1..U-9, mục 9 |

---

## 1. Quy ước

| Mục | Quy ước |
|---|---|
| Mã | US-001..US-116, đánh số liên tục theo thứ tự bậc rồi epic. Mã không đổi khi story bị dời bậc |
| Vai trò | R1 Phòng Đào tạo · R2 Ban lãnh đạo khoa · R3 Giám đốc CTĐT · R4 Điều phối nhóm chuyên môn · R5 Giảng viên · R6 Sinh viên · E1 cơ sở dữ liệu có sẵn · E2 dịch vụ email · E3 ứng dụng dDUT |
| Tiêu chí chấp nhận | Mỗi tiêu chí một dòng theo mẫu **Cho** (bối cảnh) — **Khi** (hành động) — **Thì** (kết quả quan sát được) |
| Bao phủ | Dòng cuối mỗi story liệt kê mã FR, UC, BR, EC và mã khác (NFR, DEC, điểm hở) mà story hiện thực. Dấu — nghĩa là không có |
| Yêu cầu làm nhiều đợt | FR-07, FR-25, FR-47, FR-96, FR-97 được chia theo bậc; mỗi đợt một story, ghi rõ "đợt 1" hoặc "đợt 2" ở tên story |
| Quyền sửa ở B1..B3 | Chương trình chưa có phiên bản nào rời Nháp thì người có ô `Đ` trong ma trận SRS mục 3.4 sửa trực tiếp trong phạm vi của mình (H-4). Từ lúc có phiên bản đầu tiên, mọi thay đổi đi qua đề xuất (US-053) |
| Điều kiện chung | Mọi story đều ngầm định: người dùng đã đăng nhập (US-001), máy chủ kiểm tra quyền và phạm vi (US-005), thao tác ghi sinh một dòng nhật ký (US-002). Các tiêu chí không nhắc lại ba điều này |

### Số story theo bậc và epic

| Bậc | Epic | Story | Số story |
|---|---|---|---|
| B1 | EP-01 Nền tảng, đăng nhập và nhật ký | US-001..US-003 | 3 |
| B1 | EP-02 Tài khoản, vai trò, phạm vi quyền | US-004..US-006 | 3 |
| B1 | EP-03 Cơ cấu tổ chức và nhóm chuyên môn | US-007..US-010 | 4 |
| B1 | EP-04 Danh mục học phần | US-011..US-014 | 4 |
| B1 | EP-05 Quan hệ học phần và nhóm tương đương | US-015..US-017 | 3 |
| B2 | EP-06 Thông tin CTĐT và Giám đốc CTĐT | US-018..US-022 | 5 |
| B2 | EP-07 Khung chương trình và nhóm tự chọn | US-023..US-028 | 6 |
| B2 | EP-08 Kiểm tra nhất quán khung | US-029..US-031 | 3 |
| B2 | EP-09 Nhập và xuất Excel | US-032..US-037 | 6 |
| B3 | EP-10 Đề cương chi tiết | US-038..US-041 | 4 |
| B3 | EP-11 Chuẩn đầu ra: PLO, CLO, ma trận | US-042..US-048 | 7 |
| B3 | EP-12 Công thức điểm và ánh xạ đánh giá–CLO | US-049..US-052 | 4 |
| B4 | EP-13 Đề xuất: soạn, gửi, thu hồi, xung đột | US-053..US-060 | 8 |
| B4 | EP-14 Phê duyệt ba cấp và thông báo | US-061..US-070 | 10 |
| B4 | EP-15 Ban hành và ảnh chụp bất biến | US-071..US-077 | 7 |
| B4 | EP-16 Tra cứu, so sánh phiên bản, gán khóa | US-078..US-080 | 3 |
| B5 | EP-17 Hồ sơ sinh viên và kết quả học tập | US-081..US-084 | 4 |
| B5 | EP-18 Tính điều kiện đăng ký | US-085..US-086 | 2 |
| B5 | EP-19 Xét tốt nghiệp | US-087..US-091 | 5 |
| B5 | EP-20 Cổng sinh viên | US-092..US-097 | 6 |
| B5 | EP-21 API cho dDUT | US-098..US-101 | 4 |
| B6 | EP-22 Đồng bộ cơ sở dữ liệu có sẵn | US-102..US-104 | 3 |
| B6 | EP-23 Báo cáo và xuất kiểm định | US-105..US-109 | 5 |
| B6 | EP-24 Trực quan hóa và xuất bản | US-110..US-113 | 4 |
| B6 | EP-25 Tiện ích quy trình duyệt | US-114..US-116 | 3 |
| | **Tổng** | | **116** |

---

## 2. Bậc B1 — Nền tảng và danh mục học phần (phiên bản 0.1)

### EP-01 — Nền tảng, đăng nhập và nhật ký

### US-001 — Đăng nhập và kết thúc phiên

- **Vai trò:** R1, R2, R3, R4, R5, R6 · **Bậc:** B1 · **Epic:** EP-01
- **Là** người dùng có tài khoản nội bộ, **tôi muốn** đăng nhập bằng tên đăng nhập và mật khẩu, **để** làm việc đúng với vai trò và phạm vi của mình.
- **Tiêu chí chấp nhận**
  1. **Cho** tài khoản ở trạng thái Hoạt động — **Khi** nhập đúng tên đăng nhập và mật khẩu — **Thì** vào trang chính, thấy đúng các mục của vai trò mình.
  2. **Cho** mật khẩu sai hoặc tên đăng nhập không tồn tại — **Khi** bấm đăng nhập — **Thì** bị từ chối bằng một thông báo chung, không cho biết sai phần nào.
  3. **Cho** tài khoản ở trạng thái Vô hiệu hóa — **Khi** đăng nhập đúng mật khẩu — **Thì** bị từ chối và được hướng dẫn liên hệ Phòng Đào tạo.
  4. **Cho** phiên đã không hoạt động 60 phút — **Khi** thực hiện thao tác kế tiếp — **Thì** phải đăng nhập lại; thao tác đó không được thực hiện.
  5. **Cho** cơ sở dữ liệu của hệ thống — **Khi** xem dòng `User` — **Thì** chỉ thấy `passwordHash`, không có mật khẩu dạng rõ.
- **Bao phủ:** FR — · UC-01 · BR — · EC — · khác: NFR-06, NFR-07, NFR-08, Q-13, L-1

### US-002 — Ghi nhật ký bất biến cho mọi thay đổi

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-01
- **Là** Phòng Đào tạo, **tôi muốn** mọi thao tác thêm, sửa, đổi trạng thái đều để lại một dòng nhật ký không sửa được, **để** truy được ai đã đổi gì và khi nào.
- **Tiêu chí chấp nhận**
  1. **Cho** một bản ghi bất kỳ — **Khi** người dùng lưu thay đổi — **Thì** có một dòng `AuditLog` ghi người thực hiện, hành động, loại và mã bản ghi, giá trị trước, giá trị sau, thời điểm.
  2. **Cho** một dòng nhật ký đã ghi — **Khi** bất kỳ vai trò nào, kể cả R1, thử sửa hoặc xóa nó — **Thì** không có chức năng nào cho phép và máy chủ từ chối.
  3. **Cho** thao tác bị từ chối vì thiếu quyền — **Khi** xem nhật ký — **Thì** không có dòng thay đổi dữ liệu nào được ghi cho thao tác đó.
- **Bao phủ:** FR-105 · UC-82 · BR — · EC — · khác: NFR-10

### US-003 — Tra cứu nhật ký hệ thống

- **Vai trò:** R1, R2 · **Bậc:** B1 · **Epic:** EP-01
- **Là** Phòng Đào tạo hoặc Ban lãnh đạo khoa, **tôi muốn** lọc nhật ký theo người dùng, đối tượng và khoảng thời gian, **để** kiểm tra lại một thay đổi cụ thể.
- **Tiêu chí chấp nhận**
  1. **Cho** nhật ký có nhiều dòng — **Khi** lọc theo một người dùng và một khoảng ngày — **Thì** chỉ thấy các dòng khớp, mới nhất trước, có phân trang.
  2. **Cho** một dòng nhật ký sửa học phần — **Khi** mở chi tiết — **Thì** thấy giá trị trước và sau của từng thuộc tính đã đổi.
  3. **Cho** R2 — **Khi** tra cứu — **Thì** chỉ thấy nhật ký của dữ liệu thuộc khoa mình; R1 thấy toàn hệ thống.
  4. **Cho** R3, R4, R5 hoặc R6 — **Khi** gọi chức năng tra cứu nhật ký — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-106 · UC-82 · BR — · EC — · khác: NFR-18, U-4

### EP-02 — Tài khoản, vai trò, phạm vi quyền

### US-004 — Quản lý tài khoản người dùng

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-02
- **Là** Phòng Đào tạo, **tôi muốn** tạo, sửa và vô hiệu hóa tài khoản, **để** chỉ người đang công tác mới dùng được hệ thống mà lịch sử của người cũ vẫn còn.
- **Tiêu chí chấp nhận**
  1. **Cho** tên đăng nhập chưa tồn tại — **Khi** tạo tài khoản với họ tên, email, đơn vị — **Thì** tài khoản ở trạng thái Hoạt động và đăng nhập được.
  2. **Cho** tên đăng nhập đã tồn tại — **Khi** tạo tài khoản trùng — **Thì** bị chặn, thông báo nêu rõ trường trùng.
  3. **Cho** tài khoản đã tham gia duyệt hoặc đã tạo đề xuất — **Khi** tìm chức năng xóa — **Thì** không có; chỉ vô hiệu hóa được, và tên người đó vẫn hiện trong lịch sử duyệt.
  4. **Cho** tài khoản vừa bị vô hiệu hóa đang có phiên mở — **Khi** người đó thao tác tiếp — **Thì** bị buộc đăng nhập lại và không vào được.
  5. **Cho** người tạo đề xuất đã bị vô hiệu hóa — **Khi** đề xuất đang chờ duyệt — **Thì** đề xuất vẫn đi tiếp bình thường.
- **Bao phủ:** FR-06 · UC-05 · BR — · EC-29, EC-51 · khác: NFR-20

### US-005 — Gán vai trò và phạm vi quyền (đợt 1)

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-02
- **Là** Phòng Đào tạo, **tôi muốn** gán cho một người nhiều vai trò, mỗi vai trò một phạm vi và thời hạn, **để** mỗi người chỉ thấy và làm được đúng phần việc của mình.
- **Tiêu chí chấp nhận**
  1. **Cho** một giảng viên — **Khi** gán thêm vai trò thứ hai với phạm vi riêng — **Thì** người đó có quyền của cả hai vai trò, mỗi quyền chỉ đúng trong phạm vi của nó.
  2. **Cho** một vai trò có ngày kết thúc đã qua — **Khi** người dùng đăng nhập — **Thì** vai trò đó không còn tác dụng.
  3. **Cho** giảng viên không có quyền quản trị — **Khi** gửi thẳng yêu cầu của một thao tác quản trị tới máy chủ, không qua giao diện — **Thì** máy chủ từ chối và không đổi dữ liệu.
  4. **Cho** đợt 1 — **Khi** gán phạm vi — **Thì** chọn được Toàn hệ thống, Đơn vị, hoặc Theo phân công với phân công đọc từ thành viên nhóm chuyên môn; phạm vi theo chương trình có ở US-021.
  5. **Cho** ma trận quyền ban đầu đã nạp vào `RolePermission` — **Khi** máy chủ kiểm một thao tác — **Thì** kết quả lấy từ dòng của vai trò ứng với mã quyền của thao tác ấy; vai trò không có dòng thì bị từ chối, kể cả khi có quyền ở thao tác khác trên cùng đối tượng (ví dụ có quyền sửa đề cương nhưng không có quyền ban hành).
  6. **Cho** một dòng có `scope` = Theo phạm vi — **Khi** thao tác trên đối tượng ngoài phạm vi của vai trò — **Thì** bị từ chối; cùng thao tác trên đối tượng trong phạm vi thì được.
  7. **Cho** Phòng Đào tạo — **Khi** mở ma trận quyền — **Thì** thấy mọi vai trò và quyền kèm chế độ và phạm vi, không có thao tác sửa nào.
- **Bao phủ:** FR-07 (đợt 1) · UC-06 · BR — · EC — · khác: NFR-09, M-7, M-10

### US-006 — Nhật ký thay đổi phân quyền

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-02
- **Là** Phòng Đào tạo, **tôi muốn** mọi lần gán, gỡ vai trò hoặc đổi phạm vi đều được ghi lại, **để** giải trình được ai đã cấp quyền gì cho ai.
- **Tiêu chí chấp nhận**
  1. **Cho** một lần gán vai trò — **Khi** lưu — **Thì** nhật ký có dòng nêu người gán, người được gán, vai trò, phạm vi, thời hạn.
  2. **Cho** một lần gỡ vai trò hoặc đổi phạm vi — **Khi** lưu — **Thì** nhật ký có giá trị trước và sau.
  3. **Cho** màn hình tra cứu nhật ký — **Khi** lọc theo loại "phân quyền" và theo một người dùng — **Thì** thấy toàn bộ lịch sử quyền của người đó.
- **Bao phủ:** FR-10 · UC-06, UC-82 · BR — · EC — · khác: —

### EP-03 — Cơ cấu tổ chức và nhóm chuyên môn

### US-007 — Quản lý cây đơn vị

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-03
- **Là** Phòng Đào tạo, **tôi muốn** quản lý cây Trường → Phòng Đào tạo và Trường → Khoa → Nhóm chuyên môn, **để** mọi học phần, người dùng và phạm vi quyền đều gắn được vào đúng đơn vị.
- **Tiêu chí chấp nhận**
  1. **Cho** cây đơn vị — **Khi** mở màn hình — **Thì** thấy Trường ở gốc, Phòng Đào tạo và các Khoa ở cấp dưới, nhóm chuyên môn dưới Khoa.
  2. **Cho** một Khoa mới (ví dụ khoa phụ trách học phần Toán) — **Khi** thêm vào dưới Trường — **Thì** Khoa đó chọn được làm khoa phụ trách học phần.
  3. **Cho** đơn vị đã có người dùng hoặc học phần — **Khi** muốn bỏ — **Thì** chỉ chuyển được sang Ngừng hoạt động, không xóa.
- **Bao phủ:** FR-01 · UC-02 · BR — · EC — · khác: —

### US-008 — Quản lý nhóm chuyên môn

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-03
- **Là** Phòng Đào tạo, **tôi muốn** thêm, sửa và ngừng hoạt động nhóm chuyên môn của Khoa, **để** phản ánh đúng 04 nhóm hiện có và thay đổi sau này.
- **Tiêu chí chấp nhận**
  1. **Cho** Khoa Công nghệ Thông tin — **Khi** khai báo đủ 04 nhóm — **Thì** cả bốn hiện dưới Khoa trong cây đơn vị.
  2. **Cho** mã nhóm đã tồn tại — **Khi** thêm nhóm trùng mã — **Thì** bị chặn.
  3. **Cho** nhóm đang phụ trách học phần — **Khi** chuyển sang Ngừng sử dụng — **Thì** hệ thống liệt kê các học phần đang gắn với nhóm và yêu cầu xác nhận; nhóm không bị xóa.
- **Bao phủ:** FR-02 · UC-02 · BR — · EC — · khác: NFR-20

### US-009 — Gán giảng viên vào nhiều nhóm chuyên môn

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-03
- **Là** Phòng Đào tạo, **tôi muốn** gán một giảng viên vào nhiều nhóm cùng lúc, **để** phạm vi học phần của giảng viên đúng với thực tế phân công.
- **Tiêu chí chấp nhận**
  1. **Cho** một giảng viên — **Khi** gán vào hai nhóm — **Thì** giảng viên là thành viên của cả hai và thấy học phần của cả hai nhóm trong phạm vi của mình.
  2. **Cho** một dòng thành viên — **Khi** nhập ngày kết thúc — **Thì** sau ngày đó giảng viên không còn phạm vi trên học phần của nhóm, lịch sử thành viên vẫn còn.
  3. **Cho** giảng viên đã là thành viên đang hiệu lực của nhóm — **Khi** gán lần nữa vào cùng nhóm — **Thì** bị chặn.
- **Bao phủ:** FR-03 · UC-03 · BR — · EC — · khác: Q-27, U-3

### US-010 — Chỉ định Điều phối nhóm chuyên môn

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-03
- **Là** Phòng Đào tạo, **tôi muốn** chỉ định Điều phối cho từng nhóm kèm thời gian hiệu lực, **để** hệ thống biết ai duyệt cấp 1 cho học phần của nhóm.
- **Tiêu chí chấp nhận**
  1. **Cho** một thành viên của nhóm — **Khi** chỉ định làm Điều phối từ ngày A đến ngày B — **Thì** trong khoảng đó người này là người duyệt cấp 1 của nhóm.
  2. **Cho** thời hạn điều phối đã hết — **Khi** xem nhóm — **Thì** người đó trở lại là thành viên thường; nhóm hiện cảnh báo "chưa có Điều phối" nếu không ai thay.
  3. **Cho** người không phải thành viên của nhóm — **Khi** chỉ định làm Điều phối — **Thì** bị chặn, yêu cầu gán làm thành viên trước.
- **Bao phủ:** FR-04 · UC-04 · BR — · EC — · khác: —

### EP-04 — Danh mục học phần

### US-011 — Tra cứu danh mục học phần

- **Vai trò:** R1, R2, R3, R4, R5, R6 · **Bậc:** B1 · **Epic:** EP-04
- **Là** người dùng bất kỳ, **tôi muốn** tìm và xem học phần trong danh mục dùng chung, **để** biết mã, tên, số tín chỉ, loại, trạng thái và đơn vị phụ trách.
- **Tiêu chí chấp nhận**
  1. **Cho** danh mục có vài trăm học phần — **Khi** tìm theo một phần mã hoặc tên — **Thì** kết quả hiện dưới 2 giây, có phân trang và sắp xếp được.
  2. **Cho** một học phần — **Khi** mở chi tiết — **Thì** thấy mã, tên tiếng Việt, tên tiếng Anh nếu có, số tín chỉ, loại, trạng thái, khoa và nhóm phụ trách.
  3. **Cho** R6 — **Khi** tra cứu — **Thì** chỉ thấy thông tin đã công bố của học phần, không thấy bản đang soạn.
- **Bao phủ:** FR-11 · UC-10 · BR — · EC — · khác: NFR-01, NFR-18

### US-012 — Thêm và sửa học phần

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B1 · **Epic:** EP-04
- **Là** người quản lý danh mục, **tôi muốn** thêm và sửa học phần với mã, tên, số tín chỉ, loại và đơn vị phụ trách, **để** danh mục phản ánh đúng học phần của Khoa.
- **Tiêu chí chấp nhận**
  1. **Cho** mã học phần chưa có — **Khi** thêm học phần 2.5 tín chỉ có tên tiếng Việt — **Thì** lưu được; tên tiếng Anh để trống được.
  2. **Cho** học phần loại Học phần điều kiện — **Khi** nhập 0 tín chỉ — **Thì** lưu được.
  3. **Cho** số tín chỉ âm hoặc không phải số — **Khi** lưu — **Thì** bị chặn, thông báo nêu giá trị hợp lệ.
  4. **Cho** mã học phần đã tồn tại — **Khi** thêm trùng — **Thì** bị chặn; mã không sửa được sau khi tạo.
  5. **Cho** thiếu tên tiếng Việt, loại, khoa phụ trách — **Khi** lưu — **Thì** bị chặn và chỉ rõ trường thiếu.
  6. **Cho** R4 hoặc R5 — **Khi** sửa học phần không thuộc nhóm của mình — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-11, FR-12, FR-13, FR-14, FR-16 · UC-11 · BR-01 · EC-01, EC-02 · khác: H-4, U-1, NFR-19

### US-013 — Ghi nhận học phần của khoa khác

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-04
- **Là** Phòng Đào tạo, **tôi muốn** ghi nhận học phần do khoa khác phụ trách (Toán, Vật lý, Lý luận chính trị, Ngoại ngữ), **để** đưa được chúng vào khung chương trình của Khoa.
- **Tiêu chí chấp nhận**
  1. **Cho** một Khoa khác đã có trong cây đơn vị — **Khi** thêm học phần với khoa phụ trách là khoa đó và không có nhóm chuyên môn — **Thì** lưu được.
  2. **Cho** học phần của khoa khác — **Khi** R3, R4 hoặc R5 thử sửa trực tiếp — **Thì** bị từ chối; chỉ R1 sửa được.
  3. **Cho** danh mục — **Khi** lọc theo khoa phụ trách — **Thì** tách được học phần của Khoa và của khoa khác.
- **Bao phủ:** FR-05 · UC-11 · BR — · EC-24 · khác: Q-06

### US-014 — Đổi trạng thái sử dụng học phần

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-04
- **Là** Phòng Đào tạo, **tôi muốn** chuyển học phần giữa Đang sử dụng, Ngừng mở lớp và Đã hủy, **để** học phần cũ không bị dùng nhầm mà dữ liệu của sinh viên đã học vẫn còn.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần Đang sử dụng chưa khai báo học phần thay thế — **Khi** chuyển sang Ngừng mở lớp — **Thì** bị chặn, yêu cầu khai báo quan hệ thay thế trước.
  2. **Cho** học phần đã có quan hệ thay thế — **Khi** chuyển sang Ngừng mở lớp — **Thì** lưu được và mở lại về Đang sử dụng được.
  3. **Cho** học phần đã nằm trong một phiên bản đã ban hành hoặc đã có kết quả học tập — **Khi** chọn Đã hủy — **Thì** bị chặn; không có chức năng xóa cứng.
  4. **Cho** học phần chưa từng được dùng — **Khi** chuyển Đã hủy — **Thì** có hộp xác nhận nêu rõ không hoàn tác được.
- **Bao phủ:** FR-15 · UC-12 · BR — · EC-12, EC-32, EC-50 · khác: S-10, NFR-20

### EP-05 — Quan hệ học phần và nhóm tương đương

### US-015 — Khai báo quan hệ giữa các học phần

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B1 · **Epic:** EP-05
- **Là** người quản lý danh mục, **tôi muốn** khai báo quan hệ học trước, tiên quyết, song hành và thay thế giữa hai học phần, **để** hệ thống tính được điều kiện đăng ký về sau.
- **Tiêu chí chấp nhận**
  1. **Cho** hai học phần khác nhau — **Khi** khai báo quan hệ học trước, song hành hoặc thay thế — **Thì** lưu được và hiện ở cả hai học phần.
  2. **Cho** quan hệ tiên quyết — **Khi** nhập ngưỡng điểm kèm theo — **Thì** ngưỡng được lưu; để trống được.
  3. **Cho** cặp học phần đã có đúng loại quan hệ đó — **Khi** khai báo lần nữa — **Thì** bị chặn.
  4. **Cho** một học phần — **Khi** khai báo quan hệ với chính nó — **Thì** bị chặn.
- **Bao phủ:** FR-18, FR-19 · UC-13 · BR — · EC — · khác: H-4, E-1

### US-016 — Chặn chu trình học trước và tiên quyết

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B1 · **Epic:** EP-05
- **Là** người khai báo quan hệ, **tôi muốn** hệ thống chặn ngay khi một quan hệ mới tạo thành vòng lặp, **để** không có học phần nào không bao giờ đăng ký được.
- **Tiêu chí chấp nhận**
  1. **Cho** A tiên quyết của B, B học trước của C — **Khi** khai báo C tiên quyết của A — **Thì** bị chặn lưu và hiện đường đi A → B → C → A.
  2. **Cho** đồ thị không có vòng — **Khi** thêm một quan hệ không tạo vòng — **Thì** lưu được.
  3. **Cho** quan hệ song hành hoặc thay thế — **Khi** lưu — **Thì** không bị quy tắc chu trình này chặn.
- **Bao phủ:** FR-20 · UC-13, UC-17 · BR-11 · EC-09 · khác: C06

### US-017 — Khai báo nhóm học phần tương đương

- **Vai trò:** R1 · **Bậc:** B1 · **Epic:** EP-05
- **Là** Phòng Đào tạo, **tôi muốn** gom các học phần thay được cho nhau vào một nhóm tương đương, **để** sinh viên học một học phần trong nhóm được công nhận cho các học phần còn lại.
- **Tiêu chí chấp nhận**
  1. **Cho** hai học phần chưa thuộc nhóm nào — **Khi** tạo nhóm tương đương chứa cả hai — **Thì** mỗi học phần hiện học phần kia là tương đương.
  2. **Cho** A đã cùng nhóm với B — **Khi** thêm C vào nhóm — **Thì** A, B, C tương đương lẫn nhau mà không cần khai báo từng cặp.
  3. **Cho** học phần đã thuộc một nhóm — **Khi** thêm vào nhóm thứ hai — **Thì** bị chặn, đề nghị gộp hai nhóm.
  4. **Cho** hai học phần thuộc hai chương trình hoặc hai khoa khác nhau, khác số tín chỉ — **Khi** đưa vào cùng nhóm — **Thì** lưu được.
- **Bao phủ:** FR-18, FR-21 · UC-14 · BR-09 · EC-15, EC-16, EC-18 · khác: DEC-06, M-4, Q-05

---

## 3. Bậc B2 — Chương trình đào tạo và khung (phiên bản 0.2)

### EP-06 — Thông tin CTĐT và Giám đốc CTĐT

### US-018 — Tra cứu danh sách chương trình đào tạo

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B2 · **Epic:** EP-06
- **Là** cán bộ hoặc giảng viên, **tôi muốn** xem danh sách chương trình đào tạo và mở từng chương trình, **để** tìm đúng chương trình cần làm việc.
- **Tiêu chí chấp nhận**
  1. **Cho** nhiều chương trình — **Khi** mở danh sách — **Thì** thấy mã, tên, trình độ, phiên bản hiện hành, trạng thái; tìm và lọc theo trình độ được.
  2. **Cho** một chương trình — **Khi** mở — **Thì** thấy thông tin chung, Giám đốc CTĐT phụ trách và đường vào khung.
  3. **Cho** R6 — **Khi** gọi danh sách chương trình — **Thì** bị từ chối; sinh viên chỉ xem chương trình của mình ở US-092.
- **Bao phủ:** FR-23 · UC-18 · BR — · EC — · khác: NFR-18

### US-019 — Soạn thông tin chương trình đào tạo

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-06
- **Là** Phòng Đào tạo hoặc Giám đốc CTĐT, **tôi muốn** nhập và sửa thông tin chung của chương trình, **để** có căn cứ đối chiếu với khung.
- **Tiêu chí chấp nhận**
  1. **Cho** R1 — **Khi** thêm bản ghi chương trình với mã, tên, mã ngành, tên ngành, trình độ, số học kỳ, tổng tín chỉ, tín chỉ bắt buộc, tín chỉ tự chọn — **Thì** chương trình được tạo kèm một phiên bản Nháp.
  2. **Cho** tín chỉ bắt buộc cộng tín chỉ tự chọn khác tổng tín chỉ — **Khi** lưu — **Thì** bị chặn và hiện chênh lệch.
  3. **Cho** hai chương trình, một Kỹ sư một Cử nhân, khác tổng tín chỉ và số học kỳ — **Khi** lưu cả hai — **Thì** cả hai cùng tồn tại.
  4. **Cho** R3 — **Khi** sửa chương trình không được phân công — **Thì** máy chủ từ chối.
  5. **Cho** chương trình đã có sinh viên — **Khi** muốn bỏ — **Thì** chỉ chuyển được sang Ngừng sử dụng.
- **Bao phủ:** FR-23, FR-24 · UC-19 · BR-03 · EC-50 · khác: DEC-12, M-3, U-2

### US-020 — Phân công Giám đốc CTĐT

- **Vai trò:** R1 · **Bậc:** B2 · **Epic:** EP-06
- **Là** Phòng Đào tạo, **tôi muốn** phân công một người làm Giám đốc của một hoặc nhiều chương trình kèm thời hạn, **để** hệ thống biết ai sửa và ai duyệt cấp 2 cho từng chương trình.
- **Tiêu chí chấp nhận**
  1. **Cho** một người dùng — **Khi** phân công làm Giám đốc của hai chương trình — **Thì** cả hai chương trình hiện tên người đó.
  2. **Cho** một phân công có ngày kết thúc đã qua — **Khi** mở chương trình — **Thì** người đó không còn là Giám đốc; lịch sử phân công vẫn xem được.
  3. **Cho** một chương trình — **Khi** phân công thêm Giám đốc thứ hai cùng thời gian — **Thì** lưu được và cả hai đều là người duyệt cấp 2.
- **Bao phủ:** FR-08, FR-26 · UC-07 · BR — · EC — · khác: —

### US-021 — Phạm vi quyền theo chương trình được phân công (đợt 2)

- **Vai trò:** R3 · **Bậc:** B2 · **Epic:** EP-06
- **Là** Giám đốc CTĐT, **tôi muốn** quyền sửa của mình tự giới hạn trong các chương trình được phân công, **để** không sửa nhầm chương trình của người khác.
- **Tiêu chí chấp nhận**
  1. **Cho** R3 được phân công chương trình A — **Khi** mở A và B — **Thì** sửa được A, chỉ xem được B.
  2. **Cho** phân công vừa hết hạn — **Khi** R3 lưu một thay đổi trên A — **Thì** máy chủ từ chối.
  3. **Cho** một người vừa là R3 của A vừa là R5 của một nhóm — **Khi** làm việc — **Thì** quyền theo chương trình và quyền theo nhóm áp dụng độc lập; sửa học phần theo `course.edit` toàn trường của R3 (F-04), còn sửa chương trình vẫn giới hạn theo phân công.
- **Bao phủ:** FR-07 (đợt 2) · UC-06 · BR — · EC — · khác: NFR-09, M-7

### US-022 — Nhân bản chương trình cho khóa mới (đợt 1)

- **Vai trò:** R1 · **Bậc:** B2 · **Epic:** EP-06
- **Là** Phòng Đào tạo, **tôi muốn** nhân bản một chương trình hiện có thành chương trình cho khóa mới, **để** không phải nhập lại khung từ đầu.
- **Tiêu chí chấp nhận**
  1. **Cho** chương trình nguồn có khung và nhóm tự chọn — **Khi** nhân bản và nhập mã chương trình mới — **Thì** chương trình mới có một phiên bản Nháp chứa đủ thông tin, dòng khung, nhóm tự chọn và ràng buộc như nguồn.
  2. **Cho** bản nhân bản — **Khi** sửa nó — **Thì** chương trình nguồn không đổi.
  3. **Cho** bản nhân bản — **Khi** xem thông tin — **Thì** thấy chương trình nguồn mà nó được nhân bản từ đó.
  4. **Cho** đợt 1 — **Khi** nhân bản — **Thì** PLO và ma trận chưa được chép; phần này có ở US-048.
- **Bao phủ:** FR-25 (đợt 1) · UC-20 · BR — · EC — · khác: DEC-12, U-7

### EP-07 — Khung chương trình và nhóm tự chọn

### US-023 — Soạn dòng khung chương trình

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B2 · **Epic:** EP-07
- **Là** người soạn khung, **tôi muốn** thêm, sửa, bỏ dòng khung với đủ các cột của bảng Excel hiện dùng, **để** khung trong hệ thống khớp từng cột với bảng của Khoa.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản Nháp — **Khi** thêm một dòng với học kỳ, học phần, Ký hiệu, bắt buộc hay tự chọn, HT ĐA, TQ ĐA, Điểm học, Điểm chuyển, ghi chú — **Thì** dòng được lưu, các ký hiệu giữ nguyên như nhập.
  2. **Cho** học phần đã có trong khung của phiên bản — **Khi** thêm lần nữa — **Thì** bị chặn lưu.
  3. **Cho** chương trình khai báo 8 học kỳ — **Khi** đặt một dòng ở học kỳ 9 — **Thì** bị chặn lưu.
  4. **Cho** dòng khung của một học phần — **Khi** khai báo học phần tiên quyết, học trước, song hành cho riêng khung này — **Thì** ràng buộc được lưu theo phiên bản.
  5. **Cho** R4 hoặc R5 — **Khi** sửa dòng của học phần không thuộc nhóm mình — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-27 · UC-21 · BR — · EC-06, EC-08 · khác: DEC-05, Q-04, Q-08, M-5, H-4, U-1

### US-024 — Xem khung theo học kỳ

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B2 · **Epic:** EP-07
- **Là** người tra cứu, **tôi muốn** xem khung được nhóm theo học kỳ kèm tổng tín chỉ từng học kỳ, **để** đọc khung như đọc bảng kế hoạch học tập.
- **Tiêu chí chấp nhận**
  1. **Cho** khung có dòng ở nhiều học kỳ — **Khi** mở — **Thì** các dòng nằm dưới đúng học kỳ, mỗi học kỳ có dòng tổng tín chỉ.
  2. **Cho** một học kỳ chưa có học phần nào — **Khi** mở khung — **Thì** học kỳ đó vẫn hiện, kèm cảnh báo mức thông tin; không bị chặn.
  3. **Cho** khung khoảng 60 dòng — **Khi** mở — **Thì** hiện dưới 2 giây.
- **Bao phủ:** FR-28 · UC-18 · BR — · EC-07 · khác: NFR-01

### US-025 — Lọc và tìm trong khung

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B2 · **Epic:** EP-07
- **Là** người tra cứu, **tôi muốn** lọc khung theo học kỳ, khối kiến thức, bắt buộc hay tự chọn và tìm theo mã hoặc tên, **để** nhanh chóng tới đúng nhóm học phần cần xem.
- **Tiêu chí chấp nhận**
  1. **Cho** khung đang mở — **Khi** lọc theo một học kỳ và "tự chọn" — **Thì** chỉ còn dòng khớp cả hai điều kiện.
  2. **Cho** bộ lọc khối kiến thức — **Khi** chọn một khối — **Thì** chỉ còn dòng có Ký hiệu thuộc khối đó, kèm tổng tín chỉ của khối.
  3. **Cho** ô tìm — **Khi** gõ một phần tên học phần — **Thì** dòng khớp được giữ lại; xóa ô tìm thì khung trở lại đầy đủ.
- **Bao phủ:** FR-32 · UC-18 · BR — · EC — · khác: E-2, NFR-18

### US-026 — Khai báo nhóm học phần tự chọn

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-07
- **Là** người soạn khung, **tôi muốn** gom học phần tự chọn thành nhóm với số tín chỉ tối thiểu hoặc số học phần tối thiểu, **để** hệ thống biết sinh viên phải học bao nhiêu trong mỗi nhóm.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản Nháp — **Khi** tạo nhóm tự chọn với tín chỉ tối thiểu 6 và gán 5 học phần 3 tín chỉ — **Thì** lưu được, dù tổng tín chỉ danh sách là 15.
  2. **Cho** một nhóm — **Khi** khai báo số học phần tối thiểu thay cho tín chỉ tối thiểu — **Thì** lưu được; phải có ít nhất một trong hai.
  3. **Cho** dòng khung đánh dấu bắt buộc — **Khi** gán vào một nhóm tự chọn — **Thì** bị chặn lưu.
  4. **Cho** một dòng tự chọn — **Khi** gán vào hai nhóm — **Thì** bị chặn; mỗi dòng thuộc tối đa một nhóm.
- **Bao phủ:** FR-29 · UC-22 · BR-04 · EC-04, EC-05 · khác: C09

### US-027 — Sắp xếp dòng và chuyển học phần giữa các học kỳ

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-07
- **Là** người soạn khung, **tôi muốn** đổi thứ tự dòng và chuyển học phần sang học kỳ khác, **để** bố trí lại kế hoạch học tập mà không phải xóa rồi nhập lại.
- **Tiêu chí chấp nhận**
  1. **Cho** hai dòng cùng học kỳ — **Khi** đổi thứ tự — **Thì** thứ tự mới được giữ khi mở lại và khi xuất Excel.
  2. **Cho** một dòng ở học kỳ 3 — **Khi** chuyển sang học kỳ 5 — **Thì** tổng tín chỉ hai học kỳ được tính lại ngay.
  3. **Cho** học phần B có tiên quyết A ở học kỳ 4 — **Khi** chuyển B về học kỳ 3 — **Thì** lưu được nhưng hiện cảnh báo mức cao "tiên quyết xếp sau".
- **Bao phủ:** FR-30 · UC-21 · BR — · EC-10 · khác: —

### US-028 — Xem các chương trình đang dùng một học phần

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B2 · **Epic:** EP-07
- **Là** người sắp sửa một học phần, **tôi muốn** thấy trước danh sách chương trình đang có học phần đó trong khung, **để** biết thay đổi của mình chạm tới đâu.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần nằm trong khung của hai chương trình — **Khi** bấm sửa học phần — **Thì** hệ thống hiện hai chương trình đó kèm phiên bản và học kỳ trước khi mở form sửa.
  2. **Cho** học phần chưa nằm trong khung nào — **Khi** bấm sửa — **Thì** hệ thống báo "chưa được chương trình nào sử dụng" và mở form.
  3. **Cho** màn hình chi tiết học phần — **Khi** mở mục "được dùng ở" — **Thì** thấy cùng danh sách đó mà không cần bấm sửa.
- **Bao phủ:** FR-17 · UC-11, UC-16 · BR — · EC-38 · khác: —

### EP-08 — Kiểm tra nhất quán khung

### US-029 — Tính tổng tín chỉ theo cấu trúc

- **Vai trò:** R1, R2, R3, R4 · **Bậc:** B2 · **Epic:** EP-08
- **Là** người rà soát khung, **tôi muốn** hệ thống tự tính tổng tín chỉ toàn chương trình, từng học kỳ, từng khối và theo bắt buộc hay tự chọn, **để** không phải cộng tay.
- **Tiêu chí chấp nhận**
  1. **Cho** khung có học phần bắt buộc và hai nhóm tự chọn — **Khi** xem tổng — **Thì** tổng toàn chương trình bằng tổng tín chỉ học phần bắt buộc cộng tín chỉ tối thiểu của từng nhóm tự chọn, không cộng cả danh sách tự chọn.
  2. **Cho** khung có học phần 0 tín chỉ và học phần 2.5 tín chỉ — **Khi** tính — **Thì** học phần 0 tín chỉ không làm đổi tổng, phần lẻ được giữ nguyên.
  3. **Cho** một dòng vừa được thêm, bỏ hoặc chuyển kỳ — **Khi** quay lại bảng tổng — **Thì** các tổng đã được tính lại.
- **Bao phủ:** FR-77 · UC-56 · BR-02, BR-03 · EC-01 · khác: M-9, SRS mục 7.1

### US-030 — Cảnh báo lệch tổng tín chỉ và chấp nhận có lý do

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-08
- **Là** người soạn khung, **tôi muốn** được cảnh báo khi tổng tín chỉ tính được khác tổng khai báo và được chấp nhận chênh lệch kèm lý do, **để** xử lý được các chương trình có ngoại lệ thật.
- **Tiêu chí chấp nhận**
  1. **Cho** tổng tính được khác tổng khai báo — **Khi** mở kết quả kiểm tra — **Thì** có cảnh báo nêu hai con số và chênh lệch; việc lưu khung không bị chặn.
  2. **Cho** cảnh báo lệch — **Khi** chọn chấp nhận mà không nhập lý do — **Thì** bị chặn.
  3. **Cho** cảnh báo lệch — **Khi** chấp nhận kèm lý do — **Thì** cảnh báo chuyển thành "đã chấp nhận", lý do và người chấp nhận được lưu và xem lại được.
  4. **Cho** khung bị sửa làm đổi chênh lệch sau khi đã chấp nhận — **Khi** kiểm tra lại — **Thì** cảnh báo hiện lại và cần chấp nhận lần nữa.
- **Bao phủ:** FR-78 · UC-54, UC-55 · BR-05 · EC-03 · khác: —

### US-031 — Kiểm tra tiên quyết xếp sau, chu trình và trùng lặp

- **Vai trò:** R1, R2, R3, R4 · **Bậc:** B2 · **Epic:** EP-08
- **Là** người rà soát khung, **tôi muốn** một bảng kết quả kiểm tra nhất quán của khung, **để** sửa hết lỗi trước khi ban hành.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần tiên quyết nằm ở học kỳ sau học phần cần nó — **Khi** chạy kiểm tra — **Thì** có cảnh báo mức cao nêu hai học phần và hai học kỳ; không chặn lưu.
  2. **Cho** ràng buộc của khung tạo thành vòng học trước hoặc tiên quyết — **Khi** lưu ràng buộc — **Thì** bị chặn và hiện đường đi của vòng.
  3. **Cho** tiên quyết trỏ tới học phần không có trong khung — **Khi** chạy kiểm tra — **Thì** có cảnh báo nêu học phần ngoài khung.
  4. **Cho** dữ liệu có một học phần xuất hiện hai lần trong khung — **Khi** chạy kiểm tra — **Thì** kết quả nêu rõ hai dòng trùng là lỗi chặn.
  5. **Cho** khung không có vấn đề — **Khi** chạy kiểm tra — **Thì** kết quả ghi rõ "không có lỗi, không có cảnh báo".
- **Bao phủ:** FR-79, FR-80, FR-81 · UC-54, UC-17 · BR-11 · EC-06, EC-09, EC-10, EC-13 · khác: —

### EP-09 — Nhập và xuất Excel

### US-032 — Tải tệp mẫu nhập liệu (đợt 1)

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-09
- **Là** người nhập dữ liệu, **tôi muốn** tải tệp Excel mẫu cho danh mục học phần và cho khung chương trình, **để** điền đúng cột ngay từ đầu.
- **Tiêu chí chấp nhận**
  1. **Cho** màn hình nhập liệu — **Khi** chọn loại Danh mục học phần hoặc Khung chương trình và bấm tải mẫu — **Thì** nhận tệp có đúng tên cột mà bước kiểm tra chấp nhận.
  2. **Cho** tệp mẫu khung — **Khi** mở — **Thì** các cột trùng tên và thứ tự với bảng Excel Khoa đang dùng, kể cả Ký hiệu, HT ĐA, TQ ĐA, Điểm học, Điểm chuyển.
  3. **Cho** tệp mẫu để nguyên, chưa điền dòng nào — **Khi** đem chạy thử — **Thì** hệ thống báo "tệp không có dòng dữ liệu", không báo sai định dạng.
- **Bao phủ:** FR-97 (đợt 1) · UC-71 · BR — · EC — · khác: DEC-05

### US-033 — Nhập danh mục học phần từ Excel (đợt 1)

- **Vai trò:** R1 · **Bậc:** B2 · **Epic:** EP-09
- **Là** Phòng Đào tạo, **tôi muốn** nhập danh mục học phần từ tệp Excel, **để** nạp vài trăm học phần mà không nhập tay từng cái.
- **Tiêu chí chấp nhận**
  1. **Cho** tệp đúng mẫu — **Khi** chạy thử — **Thì** nhận báo cáo từng dòng; chưa có học phần nào được ghi.
  2. **Cho** tệp có hai dòng cùng mã học phần — **Khi** chạy thử — **Thì** báo cáo nêu đúng số của hai dòng trùng.
  3. **Cho** tệp có dòng 0 tín chỉ — **Khi** chạy thử — **Thì** dòng đó nhận CẢNH BÁO, không phải LỖI.
  4. **Cho** tệp có mã học phần đã tồn tại trong danh mục — **Khi** chạy thử — **Thì** báo cáo nêu dòng đó sẽ cập nhật học phần hiện có, để người nhập quyết định.
- **Bao phủ:** FR-96 (đợt 1), FR-34 · UC-72, UC-75 · BR-01, BR-02 · EC-46 · khác: SRS mục 6.3

### US-034 — Nhập khung chương trình từ Excel: chạy thử

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-09
- **Là** người nhập khung, **tôi muốn** chạy thử tệp Excel khung và nhận báo cáo lỗi từng dòng, **để** sửa tệp trước khi ghi thật.
- **Tiêu chí chấp nhận**
  1. **Cho** tệp thiếu một cột bắt buộc hoặc sai tên cột — **Khi** tải lên — **Thì** bị từ chối ngay, thông báo nêu cột sai; không có báo cáo từng dòng.
  2. **Cho** tệp có dòng 15 mang mã học phần không có trong danh mục — **Khi** chạy thử — **Thì** báo cáo có dòng "Dòng 15: LỖI — Mã HP … không tồn tại".
  3. **Cho** tệp có ràng buộc tạo thành chu trình tiên quyết — **Khi** chạy thử — **Thì** báo cáo nêu LỖI kèm đường đi của chu trình.
  4. **Cho** tệp chỉ có CẢNH BÁO — **Khi** chạy thử xong — **Thì** nút xác nhận ghi được bật; có LỖI thì nút bị tắt.
  5. **Cho** R3 — **Khi** chạy thử cho chương trình không được phân công — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-33, FR-34, FR-96 (đợt 1) · UC-72, UC-75 · BR-11 · EC-45, EC-46, EC-47 · khác: L-2, NFR-19

### US-035 — Xác nhận ghi: toàn bộ hoặc không gì cả

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-09
- **Là** người nhập dữ liệu, **tôi muốn** bước ghi chỉ thành công khi mọi dòng đều hợp lệ, **để** không bao giờ có dữ liệu nhập dở dang.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên chạy thử không có LỖI — **Khi** xác nhận ghi — **Thì** mọi dòng được ghi trong một lần; phiên chuyển sang Đã ghi.
  2. **Cho** danh mục bị đổi sau lúc chạy thử làm một dòng thành lỗi — **Khi** xác nhận ghi — **Thì** không dòng nào được ghi; phiên chuyển sang Không ghi do lỗi kèm báo cáo mới.
  3. **Cho** sự cố xảy ra giữa lúc ghi — **Khi** kiểm tra dữ liệu sau đó — **Thì** không có dòng nào của tệp nằm lại.
  4. **Cho** tệp 1000 dòng hợp lệ — **Khi** chạy thử rồi ghi — **Thì** mỗi bước xong dưới 60 giây.
  5. **Cho** khung của chương trình đã có phiên bản rời Nháp — **Khi** xác nhận ghi — **Thì** bị từ chối, hướng dẫn tạo đề xuất.
- **Bao phủ:** FR-35 · UC-73, UC-75 · BR — · EC — · khác: NFR-05, S-12, L-2, FR-55

### US-036 — Xem lịch sử phiên nhập liệu

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-09
- **Là** người nhập dữ liệu, **tôi muốn** xem lại các phiên nhập đã chạy, **để** biết ai đã nhập gì, bao nhiêu dòng thành công và lỗi.
- **Tiêu chí chấp nhận**
  1. **Cho** các phiên đã chạy — **Khi** mở lịch sử — **Thì** mỗi phiên hiện loại dữ liệu, tên tệp, người thực hiện, thời điểm, tổng dòng, số dòng thành công, số dòng lỗi, trạng thái.
  2. **Cho** một phiên Không ghi do lỗi — **Khi** mở chi tiết — **Thì** xem lại được báo cáo từng dòng của phiên đó.
  3. **Cho** R3 — **Khi** mở lịch sử — **Thì** chỉ thấy phiên của chương trình mình được phân công.
- **Bao phủ:** FR-101 · UC-74 · BR — · EC — · khác: NFR-18

### US-037 — Xuất khung chương trình ra Excel

- **Vai trò:** R1, R3 · **Bậc:** B2 · **Epic:** EP-09
- **Là** Phòng Đào tạo hoặc Giám đốc CTĐT, **tôi muốn** xuất khung ra tệp Excel có định dạng giống bảng gốc, **để** gửi cho nơi vẫn làm việc bằng Excel.
- **Tiêu chí chấp nhận**
  1. **Cho** khung đã nhập từ một tệp Excel — **Khi** xuất ra — **Thì** tệp xuất có cùng cột, cùng thứ tự dòng, cùng ký hiệu với tệp đã nhập.
  2. **Cho** tệp vừa xuất — **Khi** đem chạy thử nhập lại — **Thì** không có LỖI.
  3. **Cho** bản xuất không gắn với sinh viên nào — **Khi** mở cột "Đăng ký được?" — **Thì** cột để trống.
- **Bao phủ:** FR-36 · UC-23 · BR — · EC — · khác: DEC-05

---

## 4. Bậc B3 — Đề cương và chuẩn đầu ra (phiên bản 0.3)

### EP-10 — Đề cương chi tiết

### US-038 — Tra cứu đề cương dùng chung của học phần

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-10
- **Là** cán bộ hoặc giảng viên, **tôi muốn** mở đề cương của một học phần từ danh mục hoặc từ khung của bất kỳ chương trình nào, **để** luôn đọc cùng một đề cương dù đi từ đâu tới.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần nằm trong khung của hai chương trình — **Khi** mở đề cương từ chương trình A rồi từ chương trình B — **Thì** thấy cùng một đề cương.
  2. **Cho** một đề cương — **Khi** mở — **Thì** thấy mô tả, mục tiêu, CLO, nội dung theo tuần hoặc chương, phương pháp giảng dạy, phương pháp đánh giá, tài liệu tham khảo và công thức điểm.
  3. **Cho** học phần chưa có đề cương — **Khi** mở — **Thì** hệ thống nói rõ "chưa có đề cương" và hiện nút tạo cho người có quyền.
- **Bao phủ:** FR-44 · UC-32 · BR — · EC-44 · khác: DEC-02

### US-039 — Soạn nội dung đề cương

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-10
- **Là** giảng viên phụ trách học phần, **tôi muốn** soạn các phần của đề cương bằng trình soạn văn bản có định dạng, **để** đề cương trong hệ thống thay được tệp Word.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần thuộc nhóm của mình — **Khi** soạn mô tả, mục tiêu, phương pháp giảng dạy, phương pháp đánh giá, tài liệu tham khảo — **Thì** từng phần được lưu, giữ được in đậm, danh sách và bảng.
  2. **Cho** phần nội dung theo tuần — **Khi** thêm một tuần với nội dung, hoạt động dạy học và các CLO liên quan — **Thì** dòng được lưu đúng thứ tự.
  3. **Cho** học phần đang được hai chương trình dùng — **Khi** bấm sửa đề cương — **Thì** thấy danh sách hai chương trình trước khi soạn.
  4. **Cho** R5 — **Khi** sửa đề cương của học phần không thuộc nhóm mình — **Thì** máy chủ từ chối.
  5. **Cho** nội dung dán vào có mã lệnh nhúng — **Khi** lưu rồi mở lại — **Thì** mã lệnh không chạy, chỉ còn văn bản.
- **Bao phủ:** FR-45, FR-46 · UC-33, UC-16 · BR — · EC — · khác: H-4, E-6, Q-27

### US-040 — Đề cương song ngữ

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-10
- **Là** người soạn đề cương, **tôi muốn** nhập thêm bản tiếng Anh cho tên học phần, mô tả và CLO, **để** dùng được cho hồ sơ kiểm định quốc tế.
- **Tiêu chí chấp nhận**
  1. **Cho** đề cương đã có bản tiếng Việt — **Khi** nhập mô tả và CLO tiếng Anh — **Thì** cả hai ngôn ngữ cùng được lưu.
  2. **Cho** đề cương chưa có bản tiếng Anh — **Khi** lưu hoặc gửi duyệt — **Thì** không bị chặn; phần tiếng Anh là tùy chọn.
  3. **Cho** người xem — **Khi** chuyển ngôn ngữ hiển thị của đề cương — **Thì** phần nào chưa có tiếng Anh hiện bản tiếng Việt kèm dấu "chưa dịch".
- **Bao phủ:** FR-48 · UC-33 · BR — · EC — · khác: Q-12

### US-041 — Đính kèm bản đề cương đã ký (đợt 1)

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-10
- **Là** người soạn đề cương, **tôi muốn** đính kèm tệp PDF, Word, Excel hoặc ảnh của bản đề cương đã ký, **để** bản có chữ ký nằm cạnh bản soạn trong hệ thống.
- **Tiêu chí chấp nhận**
  1. **Cho** đề cương ở trạng thái Nháp — **Khi** tải lên một tệp PDF, Word (.docx), Excel (.xlsx) hoặc ảnh (PNG, JPEG) — **Thì** tệp hiện trong danh sách đính kèm với tên, người tải, thời điểm.
  2. **Cho** tệp không thuộc các loại trên, hoặc vượt dung lượng cấu hình (mặc định 20 MB) — **Khi** tải lên — **Thì** bị từ chối, thông báo nêu loại tệp và dung lượng cho phép.
  3. **Cho** tệp đã đính kèm vào bản Nháp — **Khi** người tải bỏ tệp — **Thì** tệp rời danh sách; việc gắn tệp theo phiên bản đã ban hành có ở US-077.
- **Bao phủ:** FR-47 (đợt 1) · UC-34 · BR — · EC — · khác: NFR-24

### EP-11 — Chuẩn đầu ra: PLO, CLO, ma trận

### US-042 — Soạn PLO của chương trình

- **Vai trò:** R1, R3 · **Bậc:** B3 · **Epic:** EP-11
- **Là** Giám đốc CTĐT, **tôi muốn** khai báo các PLO của chương trình với mã, mô tả tiếng Việt, tiếng Anh và nhóm năng lực, **để** có đích cho ma trận chuẩn đầu ra.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản Nháp — **Khi** thêm PLO với mã và mô tả tiếng Việt — **Thì** lưu được; mô tả tiếng Anh và nhóm năng lực là tùy chọn.
  2. **Cho** mã PLO đã có trong phiên bản — **Khi** thêm trùng — **Thì** bị chặn.
  3. **Cho** hai chương trình — **Khi** cả hai có PLO mã "PLO1" — **Thì** đó là hai PLO độc lập, sửa cái này không đổi cái kia.
  4. **Cho** PLO đang có ô ma trận trỏ tới — **Khi** xóa — **Thì** hệ thống nêu số ô ma trận sẽ mất và yêu cầu xác nhận.
- **Bao phủ:** FR-38 · UC-26 · BR-17 · EC — · khác: NFR-20

### US-043 — Soạn CLO của học phần

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-11
- **Là** giảng viên phụ trách học phần, **tôi muốn** khai báo CLO trong đề cương, **để** mọi chương trình dùng học phần cùng dùng một bộ CLO.
- **Tiêu chí chấp nhận**
  1. **Cho** đề cương Nháp — **Khi** thêm CLO với mã, mô tả và mức nhận thức — **Thì** lưu được và hiện trong đề cương theo thứ tự.
  2. **Cho** mã CLO đã có trong đề cương — **Khi** thêm trùng — **Thì** bị chặn.
  3. **Cho** học phần dùng ở hai chương trình — **Khi** mở ma trận của từng chương trình — **Thì** cả hai thấy cùng danh sách CLO.
  4. **Cho** CLO đang được ma trận hoặc thành phần đánh giá dùng — **Khi** xóa — **Thì** hệ thống nêu nơi đang dùng và yêu cầu xác nhận.
- **Bao phủ:** FR-39 · UC-27 · BR-18 · EC — · khác: DEC-03

### US-044 — Soạn ma trận CLO–PLO theo cặp chương trình, học phần

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-11
- **Là** người soạn chuẩn đầu ra, **tôi muốn** gắn từng CLO vào các PLO cho riêng một học phần trong một chương trình, **để** cùng một học phần đóng góp khác nhau ở các chương trình khác nhau.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần trong khung của chương trình A, đã gắn PLO2 ở ma trận học phần–PLO — **Khi** gắn CLO1 vào PLO2 — **Thì** liên kết được lưu cho cặp (A, học phần).
  2. **Cho** cùng học phần ở chương trình B — **Khi** gắn CLO1 vào PLO5 của B — **Thì** lưu được và liên kết của chương trình A không đổi.
  3. **Cho** một PLO học phần chưa gắn ở ma trận học phần–PLO — **Khi** gắn CLO vào PLO đó — **Thì** bị chặn; liên kết CLO–PLO không mang mức.
  4. **Cho** bất kỳ học phần nào trong khung, kể cả học phần của khoa khác — **Khi** mở ma trận — **Thì** khai báo được.
- **Bao phủ:** FR-40 · UC-28 · BR-19, BR-21 · EC — · khác: DEC-03, M-6, Q-25, NFR-24

### US-045 — Tra cứu PLO, CLO và ma trận

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-11
- **Là** người tra cứu, **tôi muốn** xem PLO của một chương trình, CLO của một học phần và ma trận giữa chúng, **để** hiểu học phần đóng góp gì cho chương trình.
- **Tiêu chí chấp nhận**
  1. **Cho** một chương trình — **Khi** mở mục chuẩn đầu ra — **Thì** thấy danh sách PLO và ma trận toàn chương trình, hàng là học phần và CLO, cột là PLO.
  2. **Cho** ma trận lớn — **Khi** lọc theo học kỳ hoặc theo một PLO — **Thì** chỉ còn hàng và cột khớp.
  3. **Cho** người chỉ có quyền xem — **Khi** mở ma trận — **Thì** không có ô nào sửa được.
- **Bao phủ:** FR-38, FR-39, FR-40 · UC-25 · BR — · EC — · khác: NFR-18

### US-046 — Ma trận học phần–PLO kèm trọng số

- **Vai trò:** R1, R3 · **Bậc:** B3 · **Epic:** EP-11
- **Là** Giám đốc CTĐT, **tôi muốn** nhập trực tiếp ma trận học phần–PLO với trọng số đóng góp của từng ô, **để** có bảng tổng quan và giới hạn PLO mà CLO của học phần được gắn.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần trong khung và PLO3 — **Khi** nhập trọng số 0,5 cho ô (học phần, PLO3) — **Thì** ô được lưu với trọng số đó.
  2. **Cho** một ô — **Khi** nhập trọng số ngoài khoảng (0; 1] hoặc quá hai chữ số thập phân — **Thì** bị chặn.
  3. **Cho** ô có CLO đang gắn vào PLO đó — **Khi** xóa ô — **Thì** hệ thống nêu số liên kết CLO–PLO sẽ mất, yêu cầu xác nhận, rồi xóa cả các liên kết đó.
- **Bao phủ:** FR-41 · UC-29, UC-30 · BR — · EC — · khác: E-5, Q-26

### US-047 — Cảnh báo lỗ hổng chuẩn đầu ra

- **Vai trò:** R1, R2, R3, R4 · **Bậc:** B3 · **Epic:** EP-11
- **Là** người rà soát chương trình, **tôi muốn** thấy danh sách các lỗ hổng của ma trận, **để** bổ sung trước khi ban hành và trước đợt kiểm định.
- **Tiêu chí chấp nhận**
  1. **Cho** một PLO chưa có học phần nào đóng góp — **Khi** mở báo cáo độ bao phủ — **Thì** PLO đó nằm trong mục "PLO chưa có học phần đóng góp".
  2. **Cho** một CLO chưa trỏ tới PLO nào trong chương trình — **Khi** mở báo cáo — **Thì** CLO đó nằm trong mục "CLO chưa gắn PLO".
  3. **Cho** một học phần trong khung không đóng góp PLO nào — **Khi** mở báo cáo — **Thì** học phần đó nằm trong mục "học phần chưa đóng góp PLO".
  4. **Cho** các lỗ hổng trên — **Khi** lưu khung hoặc ma trận — **Thì** không bị chặn; đây là cảnh báo.
  5. **Cho** R4 — **Khi** mở báo cáo — **Thì** chỉ thấy lỗ hổng của học phần thuộc nhóm mình.
- **Bao phủ:** FR-42 · UC-31 · BR-20 · EC-41 · khác: —

### US-048 — Nhân bản chương trình kèm PLO và ma trận (đợt 2)

- **Vai trò:** R1 · **Bậc:** B3 · **Epic:** EP-11
- **Là** Phòng Đào tạo, **tôi muốn** bản nhân bản mang theo cả PLO và ma trận của chương trình nguồn, **để** khóa mới không phải khai báo lại chuẩn đầu ra.
- **Tiêu chí chấp nhận**
  1. **Cho** chương trình nguồn có PLO và ma trận CLO–PLO — **Khi** nhân bản — **Thì** bản mới có đủ PLO, đủ ô ma trận CLO–PLO và đủ ô ma trận học phần–PLO.
  2. **Cho** bản nhân bản — **Khi** sửa một PLO của nó — **Thì** PLO cùng mã ở chương trình nguồn không đổi.
  3. **Cho** bản nhân bản — **Khi** mở đề cương của một học phần — **Thì** đó vẫn là đề cương dùng chung, không có bản sao.
- **Bao phủ:** FR-25 (đợt 2) · UC-20 · BR-17, BR-18 · EC — · khác: DEC-02, DEC-03

### EP-12 — Công thức điểm và ánh xạ đánh giá–CLO

### US-049 — Khai báo thành phần đánh giá và trọng số

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-12
- **Là** giảng viên phụ trách học phần, **tôi muốn** khai báo các thành phần đánh giá và trọng số của chúng, **để** công thức điểm của học phần rõ ràng và cộng đúng 100%.
- **Tiêu chí chấp nhận**
  1. **Cho** các thành phần có tổng trọng số 90% — **Khi** lưu — **Thì** bị chặn, thông báo nêu còn thiếu 10%.
  2. **Cho** các thành phần có tổng trọng số đúng 100% — **Khi** lưu — **Thì** lưu được.
  3. **Cho** một thành phần có trọng số 0% hoặc lớn hơn 100% — **Khi** lưu — **Thì** bị chặn.
  4. **Cho** hai thành phần cùng mã trong một đề cương — **Khi** lưu — **Thì** bị chặn.
- **Bao phủ:** FR-49, FR-50 · UC-35, UC-58 · BR-12, BR-13 · EC-39 · khác: NFR-19

### US-050 — Thành phần điều kiện và điểm liệt

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-12
- **Là** giảng viên phụ trách học phần, **tôi muốn** đánh dấu thành phần điều kiện kèm ngưỡng và khai báo điểm liệt, **để** quy tắc "dưới ngưỡng thì không đạt" được ghi lại chính thức.
- **Tiêu chí chấp nhận**
  1. **Cho** thành phần được đánh dấu là điều kiện — **Khi** lưu mà chưa nhập ngưỡng — **Thì** bị chặn.
  2. **Cho** thành phần điều kiện có ngưỡng — **Khi** xem công thức điểm — **Thì** thấy rõ câu "dưới ngưỡng này thì học phần Không đạt".
  3. **Cho** đề cương — **Khi** nhập điểm liệt chung hoặc điểm liệt riêng của một thành phần — **Thì** lưu được; để trống được.
  4. **Cho** hệ thống này — **Khi** tìm chỗ nhập điểm của sinh viên — **Thì** không có; chỉ khai báo quy tắc.
- **Bao phủ:** FR-51, FR-52 · UC-35, UC-58 · BR-15 · EC-42 · khác: SRS mục 12

### US-051 — Ánh xạ thành phần đánh giá với CLO

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-12
- **Là** giảng viên phụ trách học phần, **tôi muốn** chỉ rõ mỗi thành phần đánh giá đo những CLO nào, **để** chứng minh được CLO nào cũng được đánh giá.
- **Tiêu chí chấp nhận**
  1. **Cho** đề cương có thành phần và CLO — **Khi** đánh dấu thành phần "Giữa kỳ" đo CLO1 và CLO2 — **Thì** ánh xạ được lưu.
  2. **Cho** một ánh xạ — **Khi** nhập tỷ trọng của CLO trong thành phần — **Thì** lưu được; tỷ trọng là tùy chọn.
  3. **Cho** bảng ánh xạ — **Khi** xem — **Thì** hàng là thành phần, cột là CLO, thấy ngay CLO nào chưa có dấu.
- **Bao phủ:** FR-53 · UC-36 · BR — · EC — · khác: —

### US-052 — Cảnh báo CLO chưa được đánh giá

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B3 · **Epic:** EP-12
- **Là** người soạn đề cương, **tôi muốn** được cảnh báo khi còn CLO chưa có thành phần đánh giá nào bao phủ, **để** bổ sung trước khi đề cương được dùng.
- **Tiêu chí chấp nhận**
  1. **Cho** CLO3 chưa được thành phần nào đo — **Khi** lưu đề cương Nháp — **Thì** lưu được, kèm cảnh báo nêu tên CLO3.
  2. **Cho** cảnh báo còn tồn tại — **Khi** đề cương được đưa vào ban hành khởi tạo hoặc gửi duyệt — **Thì** bị chặn cho tới khi CLO3 được bao phủ.
  3. **Cho** mọi CLO đã được bao phủ — **Khi** kiểm tra — **Thì** không còn cảnh báo.
- **Bao phủ:** FR-54 · UC-57, UC-36 · BR-14 · EC-40 · khác: —

---

## 5. Bậc B4 — Đề xuất thay đổi và phiên bản (phiên bản 0.4)

### EP-13 — Đề xuất: soạn, gửi, thu hồi, xung đột

### US-053 — Khóa sửa trực tiếp dữ liệu đã ban hành

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người có quyền sửa, **tôi muốn** hệ thống chặn mọi sửa trực tiếp lên dữ liệu đã ban hành và dẫn tôi sang tạo đề xuất, **để** không có thay đổi nào lọt ngoài quy trình duyệt.
- **Tiêu chí chấp nhận**
  1. **Cho** chương trình đã có phiên bản rời Nháp — **Khi** bấm sửa khung, PLO hoặc thông tin chương trình — **Thì** không có form sửa trực tiếp; hệ thống mở form đề xuất với đối tượng đã chọn sẵn.
  2. **Cho** đề cương Đã ban hành — **Khi** gọi thẳng thao tác ghi lên đề cương — **Thì** máy chủ từ chối, kể cả khi người gọi là R1.
  3. **Cho** chương trình chưa có phiên bản nào rời Nháp — **Khi** sửa — **Thì** vẫn sửa trực tiếp được như ở B1..B3.
  4. **Cho** học phần đang nằm trong một phiên bản đã ban hành — **Khi** sửa số tín chỉ hoặc quan hệ — **Thì** phải đi qua đề xuất.
- **Bao phủ:** FR-55 · UC-37 · BR-23 · EC — · khác: H-4, M-2, NFR-09

### US-054 — Tạo, sửa, xóa đề xuất nháp

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người đề xuất, **tôi muốn** soạn một đề xuất thay đổi gồm tiêu đề, lý do và nội dung thay đổi, lưu nháp rồi sửa tiếp, **để** chuẩn bị kỹ trước khi gửi.
- **Tiêu chí chấp nhận**
  1. **Cho** người đề xuất — **Khi** tạo đề xuất và chọn một trong sáu loại: sửa công thức điểm, sửa PLO/CLO, sửa nội dung đề cương, sửa khung chương trình, sửa quan hệ học phần, sửa thông tin chương trình — **Thì** đề xuất được lưu ở trạng thái Nháp với mã riêng.
  2. **Cho** đề xuất Nháp — **Khi** soạn nội dung thay đổi trên bản sao của dữ liệu đang hiệu lực — **Thì** dữ liệu đang hiệu lực không đổi; thay đổi chỉ nằm trong đề xuất.
  3. **Cho** đề xuất Nháp chưa từng gửi — **Khi** người tạo xóa — **Thì** đề xuất biến mất khỏi danh sách.
  4. **Cho** đề xuất Nháp đã từng gửi rồi bị trả lại — **Khi** người tạo muốn xóa — **Thì** không xóa được; chỉ sửa và gửi lại hoặc thu hồi.
  5. **Cho** R5 — **Khi** tạo đề xuất cho học phần không thuộc nhóm mình — **Thì** máy chủ từ chối.
  6. **Cho** đề xuất của người khác — **Khi** tìm cách sửa — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-56 · UC-37 · BR — · EC — · khác: S-2, U-1, E-3

### US-055 — Ghi nguồn phát sinh của đề xuất

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người đề xuất, **tôi muốn** ghi đề xuất xuất phát từ yêu cầu của Trường hay của Khoa và số văn bản căn cứ, **để** về sau truy được vì sao có thay đổi.
- **Tiêu chí chấp nhận**
  1. **Cho** form đề xuất — **Khi** chọn nguồn "Trường" — **Thì** ô số văn bản căn cứ là bắt buộc.
  2. **Cho** form đề xuất — **Khi** chọn nguồn "Khoa" — **Thì** ô số văn bản căn cứ là tùy chọn.
  3. **Cho** Giám đốc CTĐT nhận công văn của Trường — **Khi** tạo đề xuất nguồn "Trường" — **Thì** đề xuất vẫn đi đủ ba cấp như đề xuất nguồn "Khoa".
  4. **Cho** danh sách đề xuất — **Khi** lọc theo nguồn — **Thì** chỉ còn đề xuất của nguồn đã chọn.
- **Bao phủ:** FR-108 · UC-37 · BR — · EC — · khác: H-3, Q-19, SRS mục 6.4

### US-056 — Đính kèm hồ sơ căn cứ

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người đề xuất, **tôi muốn** đính kèm tờ trình, biên bản và công văn vào đề xuất, **để** người duyệt có đủ căn cứ ngay trên màn hình duyệt.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất Nháp — **Khi** tải lên tệp và chọn loại hồ sơ: tờ trình, biên bản, biên bản họp hội đồng, biên bản thẩm định, công văn — **Thì** tệp hiện trong danh sách hồ sơ với loại, tên, người tải, thời điểm.
  2. **Cho** đề xuất đang chờ duyệt — **Khi** người duyệt mở đề xuất — **Thì** tải xuống được từng hồ sơ.
  3. **Cho** đề xuất đã gửi — **Khi** người tạo muốn bỏ một hồ sơ — **Thì** không bỏ được; chỉ thêm được hồ sơ mới.
  4. **Cho** hệ thống này — **Khi** tìm chức năng ký số — **Thì** không có; chỉ lưu bản quét.
- **Bao phủ:** FR-109 · UC-37, UC-40 · BR — · EC — · khác: H-3, Q-18

### US-057 — Gửi duyệt và định tuyến người duyệt

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người đề xuất, **tôi muốn** gửi đề xuất và để hệ thống tự tìm đúng người duyệt ở từng cấp, **để** không phải biết ai phụ trách học phần hay chương trình nào.
- **Tiêu chí chấp nhận**
  1. **Cho** giảng viên thuộc hai nhóm chuyên môn — **Khi** gửi đề xuất cho một học phần — **Thì** đề xuất tới Điều phối của nhóm phụ trách học phần đó, không tới nhóm còn lại.
  2. **Cho** đề xuất chạm học phần của hai nhóm — **Khi** gửi — **Thì** cần cả hai Điều phối đồng ý; màn hình đề xuất hiện tiến độ của từng người.
  3. **Cho** đề xuất chạm học phần nằm trong ba chương trình — **Khi** tới cấp 2 — **Thì** cần cả ba Giám đốc CTĐT đồng ý.
  4. **Cho** đề xuất về học phần do khoa khác phụ trách — **Khi** gửi — **Thì** đề xuất đi thẳng tới Phòng Đào tạo.
  5. **Cho** đề cương còn CLO chưa được thành phần đánh giá nào bao phủ — **Khi** gửi — **Thì** bị chặn, nêu tên CLO.
  6. **Cho** đề xuất bị trả lại đã sửa xong — **Khi** gửi lại — **Thì** quy trình bắt đầu lại từ cấp 1, số lần gửi tăng một.
  7. **Cho** đề xuất sửa đề cương của học phần dùng ở nhiều chương trình — **Khi** bấm gửi — **Thì** danh sách chương trình bị ảnh hưởng hiện ra trước khi xác nhận.
- **Bao phủ:** FR-57 · UC-38, UC-57, UC-16 · BR-29 · EC-21, EC-22, EC-23, EC-24, EC-38, EC-40 · khác: Q-06, Q-07, C04

### US-058 — Cảnh báo xung đột giữa các đề xuất

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người đề xuất, **tôi muốn** được báo khi đối tượng mình định sửa đang có đề xuất khác chưa kết thúc, **để** phối hợp thay vì đè lên nhau.
- **Tiêu chí chấp nhận**
  1. **Cho** đề cương đang có một đề xuất chờ duyệt — **Khi** người khác tạo đề xuất cho cùng đề cương — **Thì** có cảnh báo nêu mã, người tạo và trạng thái của đề xuất kia; vẫn tạo được.
  2. **Cho** hai đề xuất cùng sửa một đề cương, một cái đã được duyệt và sinh phiên bản mới — **Khi** cái còn lại tới bước chấp thuận cuối — **Thì** bị chặn ghi, thông báo nêu đề xuất dựa trên bản đã cũ và phải soạn lại trên bản mới.
  3. **Cho** hai đề xuất sửa hai đối tượng khác nhau — **Khi** tạo — **Thì** không có cảnh báo.
- **Bao phủ:** FR-68 · UC-37, UC-38 · BR-30 · EC-27 · khác: —

### US-059 — Thu hồi đề xuất

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-13
- **Là** người đề xuất, **tôi muốn** rút lại đề xuất khi chưa ai duyệt, **để** sửa sai mà không làm phiền người duyệt.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất đã gửi, chưa cấp nào đồng ý — **Khi** người tạo thu hồi — **Thì** đề xuất chuyển sang Thu hồi và rời hàng đợi của người duyệt.
  2. **Cho** đề xuất đã có một người duyệt đồng ý — **Khi** người tạo thu hồi — **Thì** bị từ chối, nêu lý do.
  3. **Cho** đề xuất mà cấp 1 được tự bỏ qua, cấp 2 chưa ai đồng ý — **Khi** người tạo thu hồi — **Thì** thu hồi được; cấp tự bỏ qua không tính là đã duyệt.
  4. **Cho** đề xuất đã Thu hồi — **Khi** mở lại — **Thì** chỉ xem được; muốn làm lại phải tạo đề xuất mới.
- **Bao phủ:** FR-60 · UC-39 · BR — · EC — · khác: S-3, NFR-20

### US-060 — Đề xuất thay đổi tổ chức và phân công

- **Vai trò:** R2, R4 · **Bậc:** B4 · **Epic:** EP-13
- **Là** Ban lãnh đạo khoa hoặc Điều phối nhóm chuyên môn, **tôi muốn** đề xuất thay đổi thành viên nhóm, Điều phối hoặc phân công Giám đốc CTĐT, **để** Phòng Đào tạo cập nhật mà không cần trao đổi ngoài hệ thống.
- **Tiêu chí chấp nhận**
  1. **Cho** R4 — **Khi** tạo đề xuất loại "Thay đổi tổ chức / phân công" để thêm một giảng viên vào nhóm mình — **Thì** đề xuất đi thẳng tới Phòng Đào tạo, không qua cấp 1 và cấp 2.
  2. **Cho** Phòng Đào tạo đồng ý — **Khi** xử lý xong — **Thì** thay đổi được áp dụng ngay vào dữ liệu tổ chức và có dòng nhật ký; không sinh phiên bản chương trình.
  3. **Cho** R2 — **Khi** tìm cách tạo đề xuất thuộc sáu loại dữ liệu đào tạo — **Thì** không có lựa chọn đó.
  4. **Cho** R4 — **Khi** đề xuất thay đổi cho nhóm không phải của mình — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-56 · UC-09 · BR — · EC — · khác: S-1, E-4, C04, U-3

### EP-14 — Phê duyệt ba cấp và thông báo

### US-061 — Hàng đợi đề xuất chờ duyệt

- **Vai trò:** R1, R3, R4 · **Bậc:** B4 · **Epic:** EP-14
- **Là** người duyệt, **tôi muốn** một danh sách các đề xuất đang chờ chính tôi xử lý, **để** không bỏ sót và biết cái nào đã chờ lâu.
- **Tiêu chí chấp nhận**
  1. **Cho** R4 là Điều phối của một nhóm — **Khi** mở hàng đợi — **Thì** chỉ thấy đề xuất đang ở cấp 1 có học phần thuộc nhóm mình và mình chưa xử lý.
  2. **Cho** R3 — **Khi** mở hàng đợi — **Thì** chỉ thấy đề xuất đang ở cấp 2 chạm tới chương trình mình được phân công.
  3. **Cho** hàng đợi — **Khi** xem — **Thì** mỗi dòng có mã, tiêu đề, loại, người tạo, ngày gửi, số ngày đã chờ; sắp xếp và lọc theo loại được.
  4. **Cho** người duyệt vừa xử lý xong một đề xuất — **Khi** quay lại hàng đợi — **Thì** đề xuất đó không còn ở đó.
- **Bao phủ:** FR-65 · UC-42 · BR — · EC — · khác: NFR-18

### US-062 — Xem đề xuất và bảng so sánh trước–sau

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-14
- **Là** người duyệt hoặc người theo dõi, **tôi muốn** thấy từng thay đổi của đề xuất đặt cạnh giá trị hiện hành, **để** quyết định mà không phải tự dò.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất sửa trọng số của hai thành phần đánh giá — **Khi** mở — **Thì** thấy hai dòng, mỗi dòng có giá trị cũ, giá trị mới, phần đổi được tô nổi.
  2. **Cho** đề xuất thêm một dòng khung và bỏ một dòng khác — **Khi** mở — **Thì** dòng thêm và dòng bỏ được đánh dấu khác nhau.
  3. **Cho** đề xuất sửa đoạn văn dài của đề cương — **Khi** mở — **Thì** phần văn bản thêm và bớt được đánh dấu trong đoạn.
  4. **Cho** R5 không phải người tạo và không thuộc nhóm phụ trách — **Khi** mở đề xuất — **Thì** xem được nội dung nhưng không có nút xử lý.
- **Bao phủ:** FR-58 · UC-40 · BR — · EC — · khác: —

### US-063 — Xử lý ở cấp chuyên môn (cấp 1)

- **Vai trò:** R4 · **Bậc:** B4 · **Epic:** EP-14
- **Là** Điều phối nhóm chuyên môn, **tôi muốn** đồng ý, trả lại hoặc từ chối đề xuất về học phần của nhóm mình, **để** thay đổi được người hiểu chuyên môn xem trước tiên.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất ở Chờ Điều phối nhóm CM — **Khi** Điều phối duy nhất bấm Đồng ý — **Thì** đề xuất chuyển sang Chờ Giám đốc CTĐT.
  2. **Cho** đề xuất cần hai Điều phối — **Khi** mới một người đồng ý — **Thì** đề xuất vẫn ở cấp 1 và ghi nhận người đã đồng ý.
  3. **Cho** người duyệt chọn Trả lại hoặc Từ chối — **Khi** nhập lý do dưới 20 ký tự — **Thì** bị chặn.
  4. **Cho** lý do đủ dài — **Khi** bấm Trả lại — **Thì** đề xuất về Nháp, người tạo nhận lý do.
  5. **Cho** lý do đủ dài — **Khi** bấm Từ chối — **Thì** đề xuất đóng ở trạng thái Từ chối, không gửi lại được.
  6. **Cho** R4 — **Khi** xử lý đề xuất về học phần của nhóm khác — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-57, FR-59 · UC-43 · BR-28, BR-29 · EC-22 · khác: S-6, C02

### US-064 — Xử lý ở cấp chương trình (cấp 2)

- **Vai trò:** R3 · **Bậc:** B4 · **Epic:** EP-14
- **Là** Giám đốc CTĐT, **tôi muốn** đồng ý, trả lại hoặc từ chối đề xuất chạm tới chương trình mình phụ trách, **để** kiểm soát được mọi thay đổi vào chương trình.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất ở Chờ Giám đốc CTĐT chỉ chạm một chương trình — **Khi** Giám đốc đồng ý — **Thì** đề xuất chuyển sang Chờ Phòng Đào tạo.
  2. **Cho** đề xuất chạm ba chương trình — **Khi** hai Giám đốc đã đồng ý — **Thì** đề xuất vẫn ở cấp 2 cho tới khi người thứ ba đồng ý.
  3. **Cho** một trong ba Giám đốc bấm Trả lại kèm lý do — **Khi** xử lý — **Thì** đề xuất về Nháp ngay, không chờ hai người còn lại.
  4. **Cho** R3 — **Khi** xử lý đề xuất không chạm chương trình mình — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-57, FR-59 · UC-44 · BR-28, BR-29 · EC-23 · khác: Q-24, S-6

### US-065 — Trả lại hoặc từ chối ở cấp cuối

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-14
- **Là** Phòng Đào tạo, **tôi muốn** trả lại hoặc từ chối đề xuất đã qua hai cấp dưới, **để** vẫn giữ được quyền quyết định cuối.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất ở Chờ Phòng Đào tạo — **Khi** bấm Trả lại kèm lý do từ 20 ký tự — **Thì** đề xuất về Nháp; lần gửi lại đi lại từ cấp 1 dù hai cấp dưới đã từng đồng ý.
  2. **Cho** đề xuất ở Chờ Phòng Đào tạo — **Khi** bấm Từ chối kèm lý do — **Thì** đề xuất đóng ở trạng thái Từ chối.
  3. **Cho** một trong hai hành động trên — **Khi** hoàn tất — **Thì** người tạo và những người đã duyệt ở cấp dưới đều nhận thông báo kèm lý do.
- **Bao phủ:** FR-59 · UC-45 · BR-28, BR-29 · EC-26 · khác: S-6, C02, Q-07

### US-066 — Tự động bỏ qua cấp của chính người tạo

- **Vai trò:** R3, R4 · **Bậc:** B4 · **Epic:** EP-14
- **Là** người vừa đề xuất vừa có quyền duyệt, **tôi muốn** hệ thống tự bỏ qua lượt duyệt của chính tôi, **để** không ai tự duyệt đề xuất của mình mà quy trình cũng không bị kẹt.
- **Tiêu chí chấp nhận**
  1. **Cho** Điều phối tạo đề xuất về học phần của nhóm mình và là Điều phối duy nhất cần duyệt — **Khi** gửi — **Thì** cấp 1 được bỏ qua, đề xuất vào thẳng Chờ Giám đốc CTĐT, lịch sử ghi "tự động bỏ qua" kèm lý do.
  2. **Cho** Giám đốc CTĐT tạo đề xuất chỉ chạm chương trình của mình — **Khi** đề xuất qua cấp 1 — **Thì** cấp 2 được bỏ qua, đề xuất vào Chờ Phòng Đào tạo.
  3. **Cho** người tạo là một trong hai Điều phối cần duyệt — **Khi** gửi — **Thì** chỉ lượt của người tạo được bỏ qua; Điều phối còn lại vẫn phải duyệt.
  4. **Cho** người tạo là Phòng Đào tạo — **Khi** đề xuất tới cấp 3 — **Thì** cấp 3 không bị bỏ qua; một tài khoản Phòng Đào tạo khác phải xử lý.
  5. **Cho** bất kỳ người nào — **Khi** gọi thẳng thao tác duyệt đề xuất do chính mình tạo — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-61 · UC-38, UC-43, UC-44 · BR-27 · EC-19, EC-20 · khác: DEC-09, S-4, L-4, L-5, C03

### US-067 — Bình luận trên đề xuất

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-14
- **Là** người liên quan tới đề xuất, **tôi muốn** để lại ý kiến trên đề xuất mà không cần là người duyệt, **để** trao đổi nằm ngay cạnh nội dung thay đổi.
- **Tiêu chí chấp nhận**
  1. **Cho** R2 — **Khi** mở một đề xuất thuộc khoa mình — **Thì** bình luận được nhưng không có nút Đồng ý, Trả lại, Từ chối.
  2. **Cho** một bình luận đã gửi — **Khi** xem đề xuất — **Thì** bình luận hiện kèm tên người viết và thời điểm, theo thứ tự thời gian.
  3. **Cho** bình luận đã gửi — **Khi** người viết muốn sửa hoặc xóa — **Thì** không làm được; chỉ viết bình luận mới.
  4. **Cho** đề xuất đang chờ duyệt mà chưa có bình luận nào của R2 — **Khi** người duyệt xử lý — **Thì** không bị chặn; bình luận không phải là một cấp duyệt.
- **Bao phủ:** FR-62 · UC-41 · BR — · EC — · khác: DEC-04

### US-068 — Thông báo trong ứng dụng

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-14
- **Là** người tham gia quy trình, **tôi muốn** được báo ngay trong ứng dụng khi có việc cần tôi làm hoặc khi đề xuất của tôi đổi trạng thái, **để** không phải tự vào kiểm tra.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất vừa tới một cấp — **Khi** chuyển trạng thái — **Thì** mọi người duyệt của cấp đó có một thông báo chưa đọc dẫn tới đề xuất.
  2. **Cho** đề xuất bị trả lại, bị từ chối hoặc được duyệt — **Khi** chuyển trạng thái — **Thì** người tạo nhận thông báo nêu kết quả và lý do nếu có.
  3. **Cho** đề xuất có bình luận mới — **Khi** bình luận được gửi — **Thì** người tạo và người duyệt hiện tại nhận thông báo.
  4. **Cho** thông báo chưa đọc — **Khi** mở — **Thì** nó chuyển sang đã đọc và số đếm ở biểu tượng giảm một.
- **Bao phủ:** FR-63 · UC-47 · BR — · EC — · khác: —

### US-069 — Lịch sử phê duyệt của đề xuất

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-14
- **Là** người theo dõi đề xuất, **tôi muốn** xem toàn bộ các bước đã diễn ra với đề xuất, **để** biết ai đã làm gì, lúc nào, vì sao.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất đã qua nhiều bước — **Khi** mở lịch sử — **Thì** mỗi bước hiện cấp, người xử lý, hành động, ý kiến, thời điểm.
  2. **Cho** đề xuất đã bị trả lại rồi gửi lại — **Khi** mở lịch sử — **Thì** các bước được nhóm theo lần gửi; bước của lần trước vẫn còn.
  3. **Cho** bước do tự động bỏ qua, do người được ủy quyền làm thay hoặc do Phòng Đào tạo can thiệp — **Khi** xem — **Thì** mỗi trường hợp có nhãn riêng nêu rõ ai làm thay ai.
  4. **Cho** lịch sử — **Khi** tìm cách sửa hoặc xóa một bước — **Thì** không có thao tác nào như vậy.
- **Bao phủ:** FR-67 · UC-40 · BR — · EC — · khác: NFR-10

### US-070 — Phòng Đào tạo can thiệp ở cấp dưới

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-14
- **Là** Phòng Đào tạo, **tôi muốn** xử lý thay ở cấp 1 hoặc cấp 2 khi người duyệt vắng hoặc đề xuất tồn đọng, **để** quy trình không bị kẹt vì một người.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất đang ở cấp 1 hoặc cấp 2 — **Khi** R1 chọn can thiệp và đồng ý — **Thì** cấp đó được coi là đã qua; lịch sử ghi rõ đây là can thiệp và ai là người lẽ ra phải duyệt.
  2. **Cho** R1 can thiệp — **Khi** chưa nhập lý do — **Thì** bị chặn.
  3. **Cho** R1 là người tạo đề xuất — **Khi** tìm cách can thiệp vào chính đề xuất đó — **Thì** máy chủ từ chối.
  4. **Cho** danh sách đề xuất toàn hệ thống — **Khi** R1 lọc theo số ngày đã chờ — **Thì** thấy các đề xuất tồn đọng để can thiệp.
- **Bao phủ:** FR-57 · UC-43, UC-44 · BR-31, BR-27 · EC-25, EC-28 · khác: —

### EP-15 — Ban hành và ảnh chụp bất biến

### US-071 — Ban hành phiên bản đầu tiên của chương trình

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-15
- **Là** Phòng Đào tạo, **tôi muốn** ban hành phiên bản đầu tiên của một chương trình vừa nạp xong dữ liệu, **để** chương trình chính thức đi vào chế độ chỉ đổi qua đề xuất.
- **Tiêu chí chấp nhận**
  1. **Cho** chương trình chỉ có phiên bản Nháp — **Khi** R1 nhập số quyết định, ngày ký, học kỳ hiệu lực, các khóa áp dụng và xác nhận — **Thì** phiên bản rời Nháp, mang số 1.0 nếu không nhập số khác.
  2. **Cho** khung còn học phần chưa có đề cương — **Khi** ban hành — **Thì** bị chặn, nêu danh sách học phần thiếu đề cương.
  3. **Cho** khung còn lỗi chặn của bước kiểm tra nhất quán — **Khi** ban hành — **Thì** bị chặn, nêu từng lỗi.
  4. **Cho** học kỳ hiệu lực đã bắt đầu — **Khi** ban hành khởi tạo — **Thì** phiên bản vào thẳng Đang hiệu lực; học kỳ chưa tới thì vào Chờ hiệu lực.
  5. **Cho** chương trình đã ban hành khởi tạo — **Khi** tìm lại thao tác này — **Thì** không còn; mỗi chương trình chỉ làm một lần.
  6. **Cho** ban hành khởi tạo thành công — **Khi** mở đề cương của các học phần trong khung — **Thì** các đề cương đang Nháp đã chuyển sang Đã ban hành.
- **Bao phủ:** FR-70 · UC-49 · BR-22, BR-25 · EC-44 · khác: H-1, L-3, S-5, S-7, S-9, NFR-20

### US-072 — Chấp thuận cuối và sinh phiên bản mới

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-15
- **Là** Phòng Đào tạo, **tôi muốn** khi chấp thuận cuối thì nhập thông tin ban hành và hệ thống tự sinh phiên bản mới là một ảnh chụp đầy đủ, **để** mỗi lần thay đổi đều để lại một bản trọn vẹn.
- **Tiêu chí chấp nhận**
  1. **Cho** đề xuất ở Chờ Phòng Đào tạo — **Khi** R1 đồng ý mà thiếu số quyết định, ngày ký hoặc học kỳ hiệu lực — **Thì** bị chặn.
  2. **Cho** đủ thông tin — **Khi** R1 đồng ý — **Thì** đề xuất chuyển sang Đã duyệt và một phiên bản mới ở Chờ hiệu lực được sinh, chép toàn bộ thông tin, khung, nhóm tự chọn, ràng buộc, PLO, ma trận rồi áp thay đổi của đề xuất.
  3. **Cho** đề xuất sửa khung hoặc PLO — **Khi** sinh phiên bản — **Thì** số Chính tăng một, số Phụ về 0.
  4. **Cho** đề xuất sửa đề cương hoặc công thức điểm — **Khi** sinh phiên bản — **Thì** số Phụ tăng một.
  5. **Cho** học kỳ hiệu lực được chọn đã bắt đầu — **Khi** R1 đồng ý — **Thì** bị chặn; chỉ chọn được học kỳ chưa bắt đầu.
  6. **Cho** phiên bản mới — **Khi** mở — **Thì** thấy số quyết định, ngày ký, học kỳ hiệu lực, người ban hành, thời điểm ban hành, đề xuất nguồn và phiên bản liền trước.
- **Bao phủ:** FR-69, FR-70 · UC-46, UC-49 · BR-24, BR-25 · EC — · khác: DEC-01, DEC-07, Q-22, E-3, C01, S-5, M-1

### US-073 — Kích hoạt phiên bản vào đầu học kỳ

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-15
- **Là** Phòng Đào tạo, **tôi muốn** phiên bản đã duyệt tự có hiệu lực đúng ngày bắt đầu học kỳ, **để** không có thay đổi nào chen vào giữa học kỳ.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản ở Chờ hiệu lực với học kỳ hiệu lực chưa tới — **Khi** xem chương trình — **Thì** phiên bản đang hiệu lực vẫn là bản cũ; đề xuất vẫn ở Đã duyệt.
  2. **Cho** ngày bắt đầu học kỳ hiệu lực đã tới — **Khi** hệ thống chạy bước kích hoạt — **Thì** phiên bản mới chuyển sang Đang hiệu lực, bản cũ sang Lịch sử, đề xuất sang Đang hiệu lực; chương trình không lúc nào có hai phiên bản Đang hiệu lực.
  3. **Cho** hai phiên bản của một chương trình cùng chờ một học kỳ — **Khi** kích hoạt — **Thì** chúng được kích hoạt theo thứ tự tạo; bản tạo sau cùng là bản Đang hiệu lực.
  4. **Cho** đề cương được sửa giữa học kỳ — **Khi** sinh viên xem trong học kỳ đó — **Thì** vẫn thấy công thức điểm cũ; công thức mới chỉ áp từ học kỳ kế tiếp.
  5. **Cho** bước kích hoạt gặp lỗi — **Khi** chạy lại — **Thì** kết quả giống như chạy một lần.
- **Bao phủ:** FR-70 · UC-46 · BR-22, BR-25, BR-16 · EC-30 · khác: DEC-07, L-7

### US-074 — Phiên bản đã ban hành là bất biến

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-15
- **Là** người dùng dữ liệu đã ban hành, **tôi muốn** chắc chắn rằng một phiên bản đã ban hành không bao giờ bị sửa hay xóa, **để** đối chiếu với quyết định ban hành bất kỳ lúc nào.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản ở Chờ hiệu lực, Đang hiệu lực hoặc Lịch sử — **Khi** bất kỳ vai trò nào gọi thao tác sửa hoặc xóa lên phiên bản hay dòng khung, PLO, ma trận của nó — **Thì** máy chủ từ chối.
  2. **Cho** học phần được đổi tên trong danh mục sau khi phiên bản ban hành — **Khi** mở phiên bản cũ — **Thì** vẫn thấy tên và số tín chỉ tại thời điểm ban hành.
  3. **Cho** đề cương có bản mới — **Khi** mở phiên bản chương trình cũ — **Thì** vẫn dẫn tới bản đề cương được ghim lúc ban hành.
  4. **Cho** hệ thống được nâng cấp — **Khi** kiểm tra sau nâng cấp — **Thì** mọi phiên bản đã ban hành còn nguyên nội dung.
- **Bao phủ:** FR-71 · UC-49 · BR-23 · EC — · khác: NFR-14, M-1, M-5

### US-075 — Sửa đề cương dùng chung sinh phiên bản ở mọi chương trình

- **Vai trò:** R1, R3 · **Bậc:** B4 · **Epic:** EP-15
- **Là** Phòng Đào tạo, **tôi muốn** một đề xuất sửa đề cương được duyệt sẽ sinh phiên bản mới cho mọi chương trình đang chứa học phần đó, **để** các chương trình không dùng hai bản đề cương khác nhau mà không ai biết.
- **Tiêu chí chấp nhận**
  1. **Cho** học phần nằm trong phiên bản Đang hiệu lực của ba chương trình — **Khi** đề xuất sửa đề cương được chấp thuận cuối — **Thì** có một bản đề cương mới Đã ban hành và ba phiên bản chương trình mới ở Chờ hiệu lực, mỗi bản tăng số Phụ và trỏ tới bản đề cương mới.
  2. **Cho** màn hình chấp thuận cuối — **Khi** R1 mở — **Thì** thấy trước danh sách ba chương trình sẽ sinh phiên bản.
  3. **Cho** chương trình chỉ có học phần đó ở phiên bản Lịch sử — **Khi** đề xuất được duyệt — **Thì** chương trình đó không sinh phiên bản mới.
  4. **Cho** bản đề cương mới có hiệu lực — **Khi** mở bản đề cương cũ — **Thì** bản cũ ở trạng thái Lịch sử và vẫn xem được.
  5. **Cho** việc sinh một trong ba phiên bản gặp lỗi — **Khi** chấp thuận — **Thì** không phiên bản nào được sinh và đề xuất vẫn ở Chờ Phòng Đào tạo.
- **Bao phủ:** FR-69 · UC-46, UC-49, UC-16 · BR-24 · EC-38 · khác: DEC-02, L-8, S-9

### US-076 — Ban hành phiên bản đính chính

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-15
- **Là** Phòng Đào tạo, **tôi muốn** ban hành một phiên bản đính chính khi phát hiện bản đã ban hành có sai sót, **để** sửa sai mà không xóa dấu vết của bản sai.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản đã ban hành có sai sót — **Khi** R1 tạo bản đính chính, sửa nội dung và nhập lý do đính chính — **Thì** một phiên bản mới được ban hành, tăng số Phụ, ghi rõ nó đính chính cho phiên bản nào.
  2. **Cho** bản đính chính được ban hành — **Khi** xem bản bị đính chính — **Thì** bản đó ở Lịch sử, vẫn mở được, có nhãn "đã được đính chính bởi" kèm số phiên bản.
  3. **Cho** bản đính chính — **Khi** thiếu lý do — **Thì** bị chặn.
  4. **Cho** phiên bản đã ban hành — **Khi** tìm thao tác xóa — **Thì** không có, kể cả với R1.
  5. **Cho** các khóa đang gắn với bản bị đính chính — **Khi** bản đính chính có hiệu lực — **Thì** R1 được hỏi có chuyển các khóa đó sang bản đính chính hay không; mặc định là có.
- **Bao phủ:** FR-75 · UC-53 · BR-23, BR-24 · EC-31 · khác: DEC-08, S-8, U-9

### US-077 — Đính kèm đề cương đã ký theo phiên bản (đợt 2)

- **Vai trò:** R1, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-15
- **Là** người quản lý đề cương, **tôi muốn** mỗi bản đề cương đã ban hành giữ tệp đã ký của riêng nó, **để** mở bản nào cũng thấy đúng tệp có chữ ký của bản đó.
- **Tiêu chí chấp nhận**
  1. **Cho** đề cương có bản 1 và bản 2 đã ban hành, mỗi bản một tệp đính kèm — **Khi** mở bản 1 — **Thì** chỉ thấy tệp của bản 1.
  2. **Cho** bản đề cương Đã ban hành — **Khi** người có quyền tải thêm bản quét đã ký — **Thì** tệp được thêm vào; tệp đã có không bị thay hay xóa.
  3. **Cho** bản đề cương mới được sinh từ đề xuất — **Khi** mở danh sách đính kèm — **Thì** danh sách trống; tệp của bản trước không tự chép sang.
- **Bao phủ:** FR-47 (đợt 2) · UC-34 · BR-23 · EC — · khác: —

### EP-16 — Tra cứu, so sánh phiên bản, gán khóa

### US-078 — So sánh hai phiên bản

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-16
- **Là** người tra cứu, **tôi muốn** chọn hai phiên bản bất kỳ của một chương trình và xem khác biệt, **để** biết chính xác cái gì đã đổi giữa hai lần ban hành.
- **Tiêu chí chấp nhận**
  1. **Cho** hai phiên bản của cùng chương trình — **Khi** so sánh — **Thì** thấy các nhóm khác biệt: thông tin chung, dòng khung thêm, bỏ, đổi học kỳ, nhóm tự chọn, PLO, ma trận, đề cương được ghim.
  2. **Cho** hai phiên bản chỉ khác bản đề cương của một học phần — **Khi** so sánh — **Thì** thấy học phần đó và đường dẫn tới khác biệt giữa hai bản đề cương.
  3. **Cho** hai phiên bản giống hệt ở một nhóm — **Khi** so sánh — **Thì** nhóm đó ghi "không thay đổi".
  4. **Cho** hai phiên bản không liền kề, ví dụ 1.0 và 2.0 — **Khi** so sánh — **Thì** kết quả là khác biệt gộp giữa hai bản.
- **Bao phủ:** FR-72 · UC-50 · BR — · EC — · khác: —

### US-079 — Xem lại phiên bản lịch sử

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B4 · **Epic:** EP-16
- **Là** người tra cứu, **tôi muốn** xem danh sách mọi phiên bản của một chương trình và mở lại bất kỳ bản nào, **để** biết khóa cũ đang học theo cái gì.
- **Tiêu chí chấp nhận**
  1. **Cho** chương trình có ba phiên bản — **Khi** mở lịch sử phiên bản — **Thì** thấy mỗi bản với số phiên bản, số quyết định, học kỳ hiệu lực, trạng thái, các khóa áp dụng.
  2. **Cho** một phiên bản Lịch sử — **Khi** mở — **Thì** xem được đầy đủ khung, PLO, ma trận, đề cương như lúc ban hành; không có nút sửa.
  3. **Cho** phiên bản bất kỳ — **Khi** mở — **Thì** thấy đề xuất đã sinh ra nó và đi tới được lịch sử duyệt của đề xuất đó.
- **Bao phủ:** FR-73 · UC-51 · BR — · EC — · khác: SRS mục 6.2.3

### US-080 — Gán phiên bản cho khóa tuyển sinh

- **Vai trò:** R1 · **Bậc:** B4 · **Epic:** EP-16
- **Là** Phòng Đào tạo, **tôi muốn** chỉ định mỗi khóa tuyển sinh học theo phiên bản nào, **để** khóa cũ giữ chương trình lúc nhập học còn khóa mới theo bản mới.
- **Tiêu chí chấp nhận**
  1. **Cho** phiên bản 1.0 áp cho K2023 và phiên bản 2.0 vừa ban hành — **Khi** R1 gán 2.0 cho K2025 — **Thì** K2023 vẫn theo 1.0, K2025 theo 2.0.
  2. **Cho** phiên bản 1.1 thay 1.0 — **Khi** R1 chọn áp 1.1 cho K2023 và K2024 từ một học kỳ — **Thì** hai khóa đó theo 1.1 kể từ học kỳ đã chọn; trước đó vẫn tính theo 1.0.
  3. **Cho** một phiên bản mới có hiệu lực mà R1 không chọn khóa nào — **Khi** kích hoạt — **Thì** không khóa nào tự chuyển sang bản mới.
  4. **Cho** một khóa và một học kỳ — **Khi** hệ thống xác định phiên bản áp dụng — **Thì** trả về phiên bản được gán có học kỳ bắt đầu gần nhất không vượt học kỳ đang xét.
  5. **Cho** phiên bản còn Nháp — **Khi** gán cho khóa — **Thì** bị chặn.
- **Bao phủ:** FR-74 · UC-52, UC-65 · BR-26 · EC — · khác: E-9, M-8, C07, U-5

---

## 6. Bậc B5 — Sinh viên, điều kiện đăng ký và xét tốt nghiệp (phiên bản 0.5)

### EP-17 — Hồ sơ sinh viên và kết quả học tập

### US-081 — Tải tệp mẫu sinh viên và kết quả học tập (đợt 2)

- **Vai trò:** R1 · **Bậc:** B5 · **Epic:** EP-17
- **Là** Phòng Đào tạo, **tôi muốn** tải tệp Excel mẫu cho danh sách sinh viên và cho kết quả học tập, **để** chuẩn bị dữ liệu đúng cột trước khi nhập.
- **Tiêu chí chấp nhận**
  1. **Cho** màn hình nhập liệu — **Khi** chọn loại Danh sách sinh viên hoặc Kết quả học tập và tải mẫu — **Thì** nhận tệp có đúng tên cột mà bước kiểm tra chấp nhận.
  2. **Cho** tệp mẫu kết quả học tập — **Khi** mở — **Thì** có cột mã sinh viên, mã học phần, học kỳ, điểm thang 10, điểm thang 4, điểm chữ.
  3. **Cho** R3 — **Khi** mở màn hình nhập liệu — **Thì** không thấy hai loại này; chỉ R1 nhập dữ liệu sinh viên.
- **Bao phủ:** FR-97 (đợt 2) · UC-71 · BR — · EC — · khác: U-6

### US-082 — Nhập danh sách sinh viên và tự tạo tài khoản (đợt 2)

- **Vai trò:** R1 · **Bậc:** B5 · **Epic:** EP-17
- **Là** Phòng Đào tạo, **tôi muốn** nhập danh sách sinh viên từ Excel và để hệ thống tự gắn chương trình, tự tạo tài khoản, **để** sinh viên dùng được cổng ngay sau khi nhập.
- **Tiêu chí chấp nhận**
  1. **Cho** tệp sinh viên đúng mẫu — **Khi** chạy thử rồi xác nhận ghi — **Thì** mỗi sinh viên được tạo với mã, họ tên, khóa tuyển sinh, ngành, trạng thái.
  2. **Cho** sinh viên mới thuộc khóa đã được gán phiên bản — **Khi** ghi — **Thì** sinh viên có một ghi danh loại Chính, trỏ tới phiên bản áp dụng cho khóa đó.
  3. **Cho** sinh viên mới — **Khi** ghi — **Thì** một tài khoản vai trò R6 được tạo, tên đăng nhập là mã sinh viên, gắn với hồ sơ sinh viên.
  4. **Cho** dòng có khóa tuyển sinh chưa được gán phiên bản nào — **Khi** chạy thử — **Thì** dòng nhận CẢNH BÁO "chưa xác định được chương trình"; sinh viên vẫn được tạo, chưa có ghi danh.
  5. **Cho** dòng trùng mã sinh viên trong tệp — **Khi** chạy thử — **Thì** báo LỖI đúng hai dòng.
  6. **Cho** mã sinh viên đã có trong hệ thống — **Khi** ghi — **Thì** hồ sơ được cập nhật, không tạo tài khoản thứ hai.
- **Bao phủ:** FR-96 (đợt 2), FR-34, FR-35 · UC-72, UC-73, UC-75 · BR-26 · EC-46 · khác: H-2, E-8, U-6

### US-083 — Nhập kết quả học tập (đợt 2)

- **Vai trò:** R1 · **Bậc:** B5 · **Epic:** EP-17
- **Là** Phòng Đào tạo, **tôi muốn** nhập kết quả học tập của sinh viên từ Excel, **để** hệ thống tính được tiến độ, điều kiện đăng ký và xét tốt nghiệp khi chưa nối được cơ sở dữ liệu của Trường.
- **Tiêu chí chấp nhận**
  1. **Cho** tệp kết quả đúng mẫu — **Khi** ghi — **Thì** mỗi dòng lưu đủ điểm thang 10, thang 4, điểm chữ và trạng thái Đạt, Không đạt, Đang học hoặc Miễn.
  2. **Cho** dòng có mã sinh viên hoặc mã học phần không tồn tại — **Khi** chạy thử — **Thì** báo LỖI đúng dòng.
  3. **Cho** sinh viên học lại một học phần ở học kỳ sau — **Khi** ghi cả hai dòng — **Thì** cả hai kết quả được giữ; khi tính toán hệ thống lấy điểm cao nhất.
  4. **Cho** dòng trùng sinh viên, học phần, học kỳ với dữ liệu đã có — **Khi** chạy thử — **Thì** báo cáo nêu dòng sẽ cập nhật kết quả hiện có.
  5. **Cho** tệp 1000 dòng hợp lệ — **Khi** chạy thử rồi ghi — **Thì** mỗi bước xong dưới 60 giây.
- **Bao phủ:** FR-96 (đợt 2), FR-34, FR-35 · UC-72, UC-73, UC-75 · BR — · EC-36, EC-45 · khác: DEC-10, DEC-11, Q-03, NFR-05, SRS mục 12

### US-084 — Ghi danh riêng cho từng sinh viên và các ngoại lệ

- **Vai trò:** R1 · **Bậc:** B5 · **Epic:** EP-17
- **Là** Phòng Đào tạo, **tôi muốn** gắn lại chương trình cho một sinh viên cụ thể kèm căn cứ, **để** xử lý được chuyển ngành, song ngành, chuyển chương trình và bảo lưu.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên chuyển ngành — **Khi** R1 gắn sinh viên sang phiên bản của chương trình mới kèm căn cứ — **Thì** ghi danh cũ chuyển sang Đã chuyển, ghi danh mới ở Đang theo học và mang dấu ngoại lệ.
  2. **Cho** sinh viên học song ngành — **Khi** R1 thêm ghi danh loại Song ngành — **Thì** sinh viên có hai ghi danh cùng Đang theo học, mỗi cái trỏ một chương trình.
  3. **Cho** sinh viên chuyển từ chương trình Cử nhân sang Kỹ sư — **Khi** gắn lại — **Thì** kết quả đã học được giữ; phần chênh lệch hiện ra ở mục còn thiếu khi xét.
  4. **Cho** sinh viên bảo lưu quay lại học — **Khi** xem ghi danh — **Thì** sinh viên vẫn ở phiên bản của khóa gốc; không tự chuyển sang phiên bản của khóa đang học cùng.
  5. **Cho** một ghi danh ngoại lệ — **Khi** thiếu căn cứ — **Thì** bị chặn.
  6. **Cho** phiên bản mới của chương trình có hiệu lực — **Khi** kiểm tra ghi danh ngoại lệ — **Thì** không ghi danh nào bị đổi.
- **Bao phủ:** FR-74 · UC-52, UC-65 · BR-26 · EC-33, EC-34, EC-35, EC-37 · khác: M-8, C07, U-5

### EP-18 — Tính điều kiện đăng ký

### US-085 — Tính điều kiện đăng ký của từng học phần

- **Vai trò:** R1, R3, R6 · **Bậc:** B5 · **Epic:** EP-18
- **Là** người cần biết sinh viên được đăng ký gì, **tôi muốn** hệ thống xét từng học phần trong khung theo kết quả học tập và ràng buộc, **để** có câu trả lời nhất quán ở cổng sinh viên, ở màn hình cán bộ và ở API.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên đã đạt học phần hoặc một học phần cùng nhóm tương đương — **Khi** xét — **Thì** kết quả là "Đã hoàn thành".
  2. **Cho** học phần có tiên quyết với ngưỡng, sinh viên có điểm cao nhất dưới ngưỡng hoặc chưa có điểm — **Khi** xét — **Thì** kết quả là "Không được" kèm tên học phần tiên quyết còn thiếu.
  3. **Cho** học phần có học phần học trước, sinh viên đã học nhưng không đạt — **Khi** xét — **Thì** điều kiện học trước được coi là thỏa.
  4. **Cho** học phần có song hành chưa hoàn thành nhưng chính học phần song hành đăng ký được — **Khi** xét — **Thì** kết quả là "Được, nếu đăng ký cùng học phần song hành".
  5. **Cho** chuỗi song hành A cần B, B cần C và C chưa đủ điều kiện — **Khi** xét A — **Thì** kết quả là "Không được — học phần song hành chưa đủ điều kiện".
  6. **Cho** học phần tiên quyết đã Ngừng mở lớp và có học phần thay thế — **Khi** xét — **Thì** kết quả của học phần thay thế được dùng; chưa khai báo thay thế thì có cảnh báo cho quản trị.
  7. **Cho** ràng buộc song hành tạo thành vòng — **Khi** xét — **Thì** phép tính dừng, không lặp vô hạn, và không quá 20 cấp.
  8. **Cho** khung khoảng 60 học phần — **Khi** xét toàn khung cho một sinh viên — **Thì** xong dưới 3 giây.
- **Bao phủ:** FR-83 · UC-63 · BR-06, BR-07, BR-08, BR-09 · EC-11, EC-12, EC-36 · khác: NFR-02, C05, C06, E-1, DEC-11, SRS mục 7.3

### US-086 — Cột "Đăng ký được?" trên khung

- **Vai trò:** R1, R3, R6 · **Bậc:** B5 · **Epic:** EP-18
- **Là** người xem khung của một sinh viên, **tôi muốn** thấy cột "Đăng ký được?" tính sẵn cho từng dòng, **để** đọc khung giống bảng Excel mà Khoa vẫn dùng.
- **Tiêu chí chấp nhận**
  1. **Cho** khung đang xem theo một sinh viên — **Khi** mở — **Thì** mỗi dòng có cột "Đăng ký được?" với một trong các giá trị Đã hoàn thành, Được, Được có điều kiện, Không được, tô màu xám, xanh, vàng, đỏ.
  2. **Cho** khung xem không theo sinh viên nào — **Khi** mở — **Thì** cột này không hiện.
  3. **Cho** R3 — **Khi** chọn một sinh viên không thuộc chương trình mình phụ trách — **Thì** máy chủ từ chối.
  4. **Cho** R2, R4 hoặc R5 — **Khi** tìm chức năng xem theo sinh viên — **Thì** không có.
- **Bao phủ:** FR-31 · UC-60, UC-63 · BR — · EC — · khác: DEC-05, L-10, U-8

### EP-19 — Xét tốt nghiệp

### US-087 — Xét điều kiện tốt nghiệp cho một sinh viên

- **Vai trò:** R1, R3, R6 · **Bậc:** B5 · **Epic:** EP-19
- **Là** người cần biết sinh viên đã đủ điều kiện tốt nghiệp chưa, **tôi muốn** hệ thống xét theo đúng phiên bản chương trình của sinh viên, **để** có kết luận rõ ràng và giống nhau ở mọi nơi.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên đã đạt mọi học phần bắt buộc, đủ tín chỉ từng nhóm tự chọn, đủ tổng tín chỉ và đạt mọi học phần điều kiện — **Khi** xét — **Thì** kết luận là "Đủ điều kiện".
  2. **Cho** sinh viên còn một học phần bắt buộc chưa đạt — **Khi** xét — **Thì** kết luận là "Chưa đủ điều kiện".
  3. **Cho** học phần 0 tín chỉ bắt buộc chưa đạt — **Khi** xét — **Thì** kết luận là "Chưa đủ điều kiện" dù tổng tín chỉ đã đủ.
  4. **Cho** sinh viên có hai ghi danh — **Khi** xét — **Thì** mỗi ghi danh được xét độc lập và có kết luận riêng.
  5. **Cho** một lần xét của cán bộ — **Khi** hoàn tất — **Thì** kết quả được lưu kèm thời điểm và người xét, xem lại được.
- **Bao phủ:** FR-84 · UC-61, UC-64 · BR-02 · EC-34 · khác: Q-10, SRS mục 7.4, L-10

### US-088 — Công nhận học phần tương đương khi xét

- **Vai trò:** R1, R3, R6 · **Bậc:** B5 · **Epic:** EP-19
- **Là** người xét tốt nghiệp, **tôi muốn** hệ thống tự công nhận học phần tương đương mà sinh viên đã học, **để** sinh viên không bị coi là thiếu chỉ vì học phần đổi mã.
- **Tiêu chí chấp nhận**
  1. **Cho** A, B, C cùng một nhóm tương đương và khung yêu cầu A — **Khi** sinh viên đã đạt C — **Thì** yêu cầu A được coi là hoàn thành.
  2. **Cho** khung yêu cầu học phần 3 tín chỉ, sinh viên đạt học phần tương đương 2 tín chỉ — **Khi** xét — **Thì** học phần được công nhận hoàn thành, 2 tín chỉ được tính, 1 tín chỉ chênh lệch nằm ở phần còn thiếu kèm cảnh báo.
  3. **Cho** sinh viên đạt cả hai học phần cùng nhóm — **Khi** xét — **Thì** chỉ một học phần được tính cho yêu cầu; học phần còn lại được ghi là tín chỉ tự do.
  4. **Cho** nhóm tương đương gồm học phần của phiên bản cũ và phiên bản mới — **Khi** xét sinh viên theo phiên bản mới — **Thì** kết quả học ở mã cũ vẫn được công nhận.
  5. **Cho** nhóm tương đương gồm học phần của hai chương trình khác nhau — **Khi** xét sinh viên chuyển ngành — **Thì** học phần đã học ở chương trình cũ được công nhận.
- **Bao phủ:** FR-85 · UC-64 · BR-09, BR-10 · EC-14, EC-15, EC-16, EC-17, EC-18, EC-33 · khác: DEC-06, C11, E-11

### US-089 — Danh sách hạng mục còn thiếu

- **Vai trò:** R1, R3, R6 · **Bậc:** B5 · **Epic:** EP-19
- **Là** sinh viên hoặc cán bộ, **tôi muốn** biết cụ thể còn thiếu gì để tốt nghiệp, **để** lên kế hoạch học cho các học kỳ còn lại.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên chưa đủ điều kiện — **Khi** xem kết quả xét — **Thì** thấy danh sách hạng mục thiếu chia bốn loại: học phần bắt buộc chưa đạt, nhóm tự chọn thiếu tín chỉ, tổng tín chỉ còn thiếu, học phần điều kiện chưa đạt.
  2. **Cho** nhóm tự chọn yêu cầu 6 tín chỉ và sinh viên có 3 — **Khi** xem — **Thì** hạng mục ghi tên nhóm, đã có 3, còn thiếu 3.
  3. **Cho** sinh viên đủ điều kiện — **Khi** xem — **Thì** danh sách trống và ghi rõ "không còn thiếu hạng mục nào".
- **Bao phủ:** FR-86 · UC-61, UC-64 · BR-04 · EC — · khác: C09

### US-090 — Xét tốt nghiệp hàng loạt

- **Vai trò:** R1, R3 · **Bậc:** B5 · **Epic:** EP-19
- **Là** Phòng Đào tạo, **tôi muốn** xét tốt nghiệp cho cả một khóa hoặc một chương trình trong một lần, **để** có danh sách đủ và chưa đủ điều kiện mà không mở từng sinh viên.
- **Tiêu chí chấp nhận**
  1. **Cho** một khóa khoảng 500 sinh viên — **Khi** chạy xét lô — **Thì** xong dưới 5 phút và có bảng kết quả với kết luận từng sinh viên.
  2. **Cho** bảng kết quả — **Khi** lọc "chưa đủ điều kiện" — **Thì** mỗi dòng mở được danh sách hạng mục thiếu.
  3. **Cho** bảng kết quả — **Khi** xuất — **Thì** nhận tệp Excel gồm mã sinh viên, họ tên, kết luận, tóm tắt hạng mục thiếu.
  4. **Cho** một sinh viên trong lô gặp lỗi dữ liệu — **Khi** chạy — **Thì** sinh viên đó được ghi là "không xét được" kèm lý do; các sinh viên khác vẫn được xét.
  5. **Cho** R3 — **Khi** chạy xét lô — **Thì** chỉ chọn được chương trình mình phụ trách.
- **Bao phủ:** FR-87 · UC-62, UC-64 · BR — · EC — · khác: NFR-03, NFR-18

### US-091 — Tính lại khi điểm bị sửa sau lúc xét

- **Vai trò:** R1 · **Bậc:** B5 · **Epic:** EP-19
- **Là** Phòng Đào tạo, **tôi muốn** được báo khi kết quả học tập của sinh viên đã xét bị thay đổi, **để** kết luận tốt nghiệp không dựa trên điểm đã cũ.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên đã có kết quả xét được lưu — **Khi** một kết quả học tập của sinh viên đó bị sửa qua nhập liệu hoặc đồng bộ — **Thì** hệ thống xét lại và lưu kết quả mới; kết quả cũ vẫn còn trong lịch sử.
  2. **Cho** kết luận sau khi xét lại khác kết luận trước — **Khi** xét lại xong — **Thì** Phòng Đào tạo nhận thông báo nêu sinh viên, kết luận cũ, kết luận mới.
  3. **Cho** kết luận không đổi — **Khi** xét lại xong — **Thì** không có thông báo.
- **Bao phủ:** FR-84 · UC-64 · BR — · EC-43 · khác: —

### EP-20 — Cổng sinh viên

### US-092 — Sinh viên xem đúng phiên bản chương trình của mình

- **Vai trò:** R6 · **Bậc:** B5 · **Epic:** EP-20
- **Là** sinh viên, **tôi muốn** khi đăng nhập thấy ngay chương trình áp dụng cho khóa của mình, **để** không nhầm với chương trình của khóa khác.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên K2023 và chương trình có phiên bản mới áp cho K2025 — **Khi** sinh viên đăng nhập — **Thì** thấy phiên bản gắn với K2023, kèm số phiên bản và số quyết định.
  2. **Cho** sinh viên A — **Khi** gọi dữ liệu của sinh viên B bằng cách đổi mã trong yêu cầu — **Thì** máy chủ từ chối.
  3. **Cho** sinh viên có hai ghi danh — **Khi** đăng nhập — **Thì** thấy chương trình Chính trước và chuyển được sang chương trình Song ngành.
  4. **Cho** sinh viên chưa có ghi danh — **Khi** đăng nhập — **Thì** thấy thông báo "chưa xác định được chương trình, liên hệ Phòng Đào tạo".
  5. **Cho** sinh viên — **Khi** tìm cách mở chương trình khác hoặc danh sách chương trình — **Thì** không có đường vào và máy chủ từ chối.
- **Bao phủ:** FR-88 · UC-84, UC-65, UC-18 · BR-26 · EC — · khác: NFR-11, L-9

### US-093 — Sinh viên xem khung kèm trạng thái từng học phần

- **Vai trò:** R6 · **Bậc:** B5 · **Epic:** EP-20
- **Là** sinh viên, **tôi muốn** xem khung chương trình theo học kỳ với trạng thái của từng học phần, **để** biết mình đã học gì và còn gì.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên có kết quả học tập — **Khi** mở khung — **Thì** mỗi học phần hiện một trạng thái: Đã đạt, Chưa đạt, Đang học, Chưa học, kèm điểm nếu có.
  2. **Cho** sinh viên đạt học phần tương đương — **Khi** mở khung — **Thì** học phần trong khung hiện "Đã đạt (tương đương …)" kèm mã học phần đã học.
  3. **Cho** sinh viên mới, chưa có kết quả nào — **Khi** mở khung — **Thì** vẫn thấy đủ khung; mọi học phần ở Chưa học; phần tiến độ ghi "chưa có dữ liệu kết quả học tập".
  4. **Cho** khung khoảng 60 dòng — **Khi** mở — **Thì** hiện dưới 2 giây.
- **Bao phủ:** FR-89 · UC-84, UC-59 · BR — · EC-52 · khác: NFR-01

### US-094 — Sinh viên xem tiến độ học tập

- **Vai trò:** R1, R3, R6 · **Bậc:** B5 · **Epic:** EP-20
- **Là** sinh viên, **tôi muốn** thấy mình đã tích lũy bao nhiêu tín chỉ so với yêu cầu, **để** biết mình đang ở đâu trên đường tốt nghiệp.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên có kết quả — **Khi** mở tiến độ — **Thì** thấy tín chỉ đã tích lũy trên tổng tín chỉ yêu cầu, tách bắt buộc và tự chọn, và theo từng khối kiến thức.
  2. **Cho** học phần 0 tín chỉ đã đạt — **Khi** tính tiến độ — **Thì** không cộng vào tín chỉ tích lũy nhưng được đếm ở mục học phần điều kiện đã hoàn thành.
  3. **Cho** sinh viên học lại một học phần — **Khi** tính tiến độ — **Thì** tín chỉ chỉ được tính một lần, theo lần có điểm cao nhất.
  4. **Cho** R1, hoặc R3 phụ trách chương trình của sinh viên — **Khi** mở tiến độ của sinh viên đó — **Thì** thấy cùng nội dung.
- **Bao phủ:** FR-90 · UC-59 · BR-02, BR-10 · EC-36 · khác: L-10, U-8

### US-095 — Sinh viên xem học phần đủ điều kiện và lý do

- **Vai trò:** R6 · **Bậc:** B5 · **Epic:** EP-20
- **Là** sinh viên, **tôi muốn** xem danh sách học phần mình đủ điều kiện đăng ký học kỳ tới và lý do của những học phần chưa đủ, **để** chuẩn bị đăng ký.
- **Tiêu chí chấp nhận**
  1. **Cho** sinh viên có kết quả — **Khi** mở mục học phần đủ điều kiện — **Thì** thấy các học phần có kết quả "Được" và "Được có điều kiện", không gồm học phần đã hoàn thành.
  2. **Cho** học phần chưa đủ điều kiện — **Khi** bấm vào — **Thì** thấy lý do cụ thể, ví dụ "thiếu tiên quyết: … (cần điểm từ …)".
  3. **Cho** học phần "Được có điều kiện" — **Khi** bấm vào — **Thì** thấy tên học phần song hành phải đăng ký cùng.
  4. **Cho** màn hình này — **Khi** tìm nút đăng ký — **Thì** không có; hệ thống chỉ cho biết điều kiện, không đăng ký học phần.
- **Bao phủ:** FR-91, FR-92 · UC-60, UC-63 · BR — · EC — · khác: C05, SRS mục 12

### US-096 — Sinh viên xem đề cương và công thức điểm

- **Vai trò:** R6 · **Bậc:** B5 · **Epic:** EP-20
- **Là** sinh viên, **tôi muốn** mở đề cương và công thức điểm của học phần trong chương trình của mình, **để** biết học phần dạy gì và chấm thế nào.
- **Tiêu chí chấp nhận**
  1. **Cho** một học phần trong khung — **Khi** sinh viên mở — **Thì** thấy bản đề cương được ghim trong phiên bản chương trình của mình: mô tả, CLO, nội dung, thành phần đánh giá, trọng số, thành phần điều kiện và ngưỡng.
  2. **Cho** đề cương vừa có bản mới được duyệt nhưng chưa tới học kỳ hiệu lực — **Khi** sinh viên mở — **Thì** vẫn thấy bản đang hiệu lực.
  3. **Cho** đề cương có tệp đã ký — **Khi** sinh viên mở — **Thì** tải được tệp.
  4. **Cho** sinh viên — **Khi** mở đề cương — **Thì** không thấy bản Nháp, đề xuất hay bình luận nội bộ.
- **Bao phủ:** FR-93 · UC-32, UC-25 · BR-16 · EC-30 · khác: S-9

### US-097 — Cổng sinh viên dùng được trên điện thoại

- **Vai trò:** R6 · **Bậc:** B5 · **Epic:** EP-20
- **Là** sinh viên, **tôi muốn** dùng cổng trên điện thoại, **để** xem chương trình ở bất cứ đâu.
- **Tiêu chí chấp nhận**
  1. **Cho** màn hình rộng 360px — **Khi** mở khung, tiến độ, học phần đủ điều kiện, kết quả xét tốt nghiệp, đề cương — **Thì** không có thanh cuộn ngang ở cấp trang; bảng rộng cuộn trong khung của nó hoặc chuyển thành thẻ.
  2. **Cho** màn hình 360px — **Khi** dùng menu — **Thì** mọi mục của cổng sinh viên tới được trong không quá hai lần chạm.
  3. **Cho** Chrome, Firefox, Edge bản hiện hành — **Khi** mở cổng — **Thì** hiển thị và thao tác như nhau.
- **Bao phủ:** FR-95 · UC-84 · BR — · EC — · khác: NFR-17, NFR-26

### EP-21 — API cho dDUT

### US-098 — Cấp và quản lý khóa truy cập cho bên tích hợp

- **Vai trò:** R1 · **Bậc:** B5 · **Epic:** EP-21
- **Là** Phòng Đào tạo, **tôi muốn** cấp cho mỗi bên tích hợp một khóa truy cập riêng và khóa lại khi cần, **để** kiểm soát ai đang đọc dữ liệu qua API.
- **Tiêu chí chấp nhận**
  1. **Cho** R1 — **Khi** tạo một bên tích hợp — **Thì** khóa truy cập hiện đúng một lần; hệ thống chỉ lưu dạng băm.
  2. **Cho** lời gọi API không có khóa hoặc khóa sai — **Khi** gọi — **Thì** bị từ chối với mã HTTP chuẩn và thông báo tiếng Việt.
  3. **Cho** bên tích hợp bị chuyển sang Đã khóa — **Khi** gọi — **Thì** bị từ chối ngay.
  4. **Cho** bên tích hợp gọi vượt giới hạn tần suất đã cấu hình — **Khi** gọi tiếp — **Thì** bị từ chối với mã báo quá tần suất cho tới hết cửa sổ thời gian.
  5. **Cho** mỗi lời gọi có mã sinh viên — **Khi** hoàn tất — **Thì** có một dòng nhật ký nêu bên gọi, tài nguyên, mã sinh viên, thời điểm.
- **Bao phủ:** FR-94 · UC-66 · BR — · EC — · khác: API-03, API-04, API-05, L-10, NFR-07

### US-099 — API chương trình và đề cương

- **Vai trò:** E3 · **Bậc:** B5 · **Epic:** EP-21
- **Là** ứng dụng dDUT, **tôi muốn** lấy chương trình áp dụng cho một sinh viên, một phiên bản cụ thể và đề cương của một học phần, **để** hiển thị cho sinh viên trong ứng dụng.
- **Tiêu chí chấp nhận**
  1. **Cho** mã sinh viên hợp lệ — **Khi** gọi `GET /api/v1/sinh-vien/{mssv}/chuong-trinh` — **Thì** nhận phiên bản áp dụng cho ghi danh Chính kèm khung theo học kỳ.
  2. **Cho** mã chương trình và số phiên bản — **Khi** gọi `GET /api/v1/chuong-trinh/{maCT}/phien-ban/{soPB}` — **Thì** nhận đúng phiên bản đó; phiên bản Nháp không trả về.
  3. **Cho** mã học phần — **Khi** gọi `GET /api/v1/hoc-phan/{maHP}/de-cuong` — **Thì** nhận bản đề cương đang hiệu lực; kèm tham số chương trình và phiên bản thì nhận bản được ghim trong phiên bản đó.
  4. **Cho** mã không tồn tại — **Khi** gọi — **Thì** nhận mã HTTP "không tìm thấy" kèm thông báo tiếng Việt.
- **Bao phủ:** FR-94 · UC-66, UC-69, UC-65 · BR — · EC — · khác: API-01, API-05, C10, L-9

### US-100 — API tiến độ, điều kiện đăng ký và xét tốt nghiệp

- **Vai trò:** E3 · **Bậc:** B5 · **Epic:** EP-21
- **Là** ứng dụng dDUT, **tôi muốn** lấy tiến độ, danh sách học phần đủ điều kiện và kết quả xét tốt nghiệp của một sinh viên, **để** ứng dụng hiển thị cùng kết quả với cổng sinh viên.
- **Tiêu chí chấp nhận**
  1. **Cho** mã sinh viên — **Khi** gọi `GET /api/v1/sinh-vien/{mssv}/tien-do` — **Thì** nhận cùng số liệu như màn hình tiến độ của cổng.
  2. **Cho** mã sinh viên — **Khi** gọi `GET /api/v1/sinh-vien/{mssv}/hoc-phan-du-dieu-kien` — **Thì** nhận từng học phần kèm kết quả và lý do, trùng với cổng.
  3. **Cho** mã sinh viên — **Khi** gọi `GET /api/v1/sinh-vien/{mssv}/xet-tot-nghiep` — **Thì** nhận kết luận và danh sách hạng mục thiếu.
  4. **Cho** sinh viên chưa có kết quả học tập — **Khi** gọi ba đường dẫn trên — **Thì** nhận phản hồi hợp lệ với dữ liệu rỗng và cờ "chưa có dữ liệu", không phải lỗi.
  5. **Cho** sinh viên có hai ghi danh — **Khi** gọi — **Thì** nhận kết quả của ghi danh Chính.
- **Bao phủ:** FR-94 · UC-67, UC-68, UC-70, UC-63, UC-64 · BR — · EC-52 · khác: API-01, L-9, NFR-02

### US-101 — Tài liệu API theo chuẩn OpenAPI

- **Vai trò:** E3, R1 · **Bậc:** B5 · **Epic:** EP-21
- **Là** nhóm phát triển dDUT, **tôi muốn** có tài liệu API theo OpenAPI 3.0 khớp với hành vi thật, **để** tích hợp mà không phải hỏi lại.
- **Tiêu chí chấp nhận**
  1. **Cho** tài liệu OpenAPI — **Khi** mở — **Thì** có đủ sáu đường dẫn của SRS mục 8, mô tả tham số, cấu trúc phản hồi, mã lỗi.
  2. **Cho** từng đường dẫn — **Khi** gọi thật và đối chiếu phản hồi với tài liệu — **Thì** cấu trúc khớp.
  3. **Cho** một thay đổi không tương thích — **Khi** phát hành — **Thì** nó nằm dưới số phiên bản đường dẫn mới; `/api/v1` giữ nguyên hành vi.
- **Bao phủ:** FR-94 · UC-66, UC-67, UC-68, UC-69, UC-70 · BR — · EC — · khác: API-01, API-02

---

## 7. Bậc B6 — Tích hợp trường, báo cáo và hoàn thiện (phiên bản 1.0)

### EP-22 — Đồng bộ cơ sở dữ liệu có sẵn

### US-102 — Cấu hình kết nối và lịch đồng bộ

- **Vai trò:** R1 · **Bậc:** B6 · **Epic:** EP-22
- **Là** Phòng Đào tạo, **tôi muốn** khai báo kết nối chỉ đọc tới cơ sở dữ liệu của Trường và lịch đồng bộ, **để** dữ liệu sinh viên và kết quả học tập tự cập nhật.
- **Tiêu chí chấp nhận**
  1. **Cho** thông tin kết nối — **Khi** bấm kiểm tra kết nối — **Thì** hệ thống báo thành công hoặc nêu nguyên nhân thất bại; không ghi gì vào nguồn.
  2. **Cho** kết nối đã lưu — **Khi** mở lại cấu hình — **Thì** mật khẩu kết nối không hiện lại dưới dạng đọc được.
  3. **Cho** lịch đồng bộ — **Khi** chọn tần suất và giờ chạy — **Thì** lần chạy kế tiếp được hiển thị.
  4. **Cho** chưa cấu hình kết nối — **Khi** dùng hệ thống — **Thì** mọi chức năng vẫn chạy bằng dữ liệu nhập từ Excel.
- **Bao phủ:** FR-98 · UC-76 · BR — · EC — · khác: DEC-10, Q-09, E-7, NFR-24

### US-103 — Đồng bộ theo lịch và nhật ký đồng bộ

- **Vai trò:** R1, E1 · **Bậc:** B6 · **Epic:** EP-22
- **Là** Phòng Đào tạo, **tôi muốn** mỗi lần đồng bộ để lại một dòng nhật ký và không bao giờ để dữ liệu dở dang, **để** tin được số liệu sau mỗi lần chạy.
- **Tiêu chí chấp nhận**
  1. **Cho** lịch đã tới giờ — **Khi** đồng bộ chạy — **Thì** danh sách sinh viên, kết quả học tập, lớp học phần được đọc từ nguồn và ghi vào hệ thống; nhật ký ghi thời điểm bắt đầu, kết thúc, số bản ghi, trạng thái Thành công.
  2. **Cho** kết nối bị ngắt giữa lúc đồng bộ — **Khi** kiểm tra sau đó — **Thì** không bản ghi nào của lần chạy đó nằm lại; nhật ký ghi Thất bại kèm thông báo lỗi; lần chạy kế tiếp tự thử lại.
  3. **Cho** một lần đồng bộ còn Đang chạy — **Khi** tới giờ lịch kế tiếp — **Thì** không có lần chạy thứ hai chồng lên; lần đang chạy quá thời hạn cấu hình thì bị đánh dấu Thất bại.
  4. **Cho** R1 — **Khi** mở nhật ký đồng bộ — **Thì** xem được từng lần chạy, lọc theo trạng thái, và bấm chạy lại thủ công được.
  5. **Cho** lần đồng bộ thất bại — **Khi** kết thúc — **Thì** R1 nhận thông báo trong ứng dụng.
- **Bao phủ:** FR-99 · UC-77, UC-78 · BR — · EC-49, EC-43 · khác: S-13, S-14, NFR-18

### US-104 — Quy tắc ưu tiên khi hai nguồn mâu thuẫn

- **Vai trò:** R1 · **Bậc:** B6 · **Epic:** EP-22
- **Là** Phòng Đào tạo, **tôi muốn** hệ thống áp một quy tắc ưu tiên cố định khi dữ liệu Excel và dữ liệu của Trường khác nhau, **để** không phải phân xử từng bản ghi.
- **Tiêu chí chấp nhận**
  1. **Cho** kết quả học tập của một sinh viên khác nhau giữa bản đã nhập từ Excel và nguồn của Trường — **Khi** đồng bộ — **Thì** giá trị của nguồn Trường được giữ; mâu thuẫn được đếm trong nhật ký đồng bộ kèm giá trị hai bên.
  2. **Cho** danh mục học phần hoặc khung khác nhau giữa hệ thống này và nguồn của Trường — **Khi** đồng bộ — **Thì** dữ liệu của hệ thống này được giữ; nguồn không ghi đè.
  3. **Cho** bản ghi có nguồn là cơ sở dữ liệu có sẵn — **Khi** nhập Excel cùng bản ghi với giá trị khác — **Thì** chạy thử báo CẢNH BÁO "nguồn Trường được ưu tiên" và dòng đó không ghi đè.
  4. **Cho** mỗi bản ghi sinh viên và kết quả — **Khi** xem — **Thì** thấy nguồn dữ liệu của nó.
- **Bao phủ:** FR-100 · UC-77, UC-78 · BR — · EC-48 · khác: DEC-10, SRS mục 8.2

### EP-23 — Báo cáo và xuất kiểm định

### US-105 — Đối sánh hai chương trình

- **Vai trò:** R1, R2, R3, R4 · **Bậc:** B6 · **Epic:** EP-23
- **Là** người rà soát chương trình, **tôi muốn** đặt hai chương trình cạnh nhau, **để** thấy phần chung và phần riêng, ví dụ giữa chương trình Kỹ sư và Cử nhân.
- **Tiêu chí chấp nhận**
  1. **Cho** hai chương trình — **Khi** đối sánh — **Thì** thấy ba nhóm: học phần chung, học phần chỉ có ở chương trình thứ nhất, học phần chỉ có ở chương trình thứ hai, kèm tín chỉ từng nhóm.
  2. **Cho** học phần chung nằm ở học kỳ khác nhau hoặc khác tính chất bắt buộc, tự chọn — **Khi** đối sánh — **Thì** khác biệt đó được nêu trên dòng.
  3. **Cho** hai học phần khác mã nhưng cùng nhóm tương đương — **Khi** đối sánh — **Thì** chúng được ghép thành một cặp tương đương thay vì hai dòng riêng.
  4. **Cho** kết quả đối sánh — **Khi** xuất — **Thì** nhận tệp Excel.
- **Bao phủ:** FR-102 · UC-79 · BR-09 · EC-18 · khác: —

### US-106 — Báo cáo phân bổ tín chỉ

- **Vai trò:** R1, R2, R3, R4 · **Bậc:** B6 · **Epic:** EP-23
- **Là** người rà soát chương trình, **tôi muốn** bảng phân bổ tín chỉ theo khối kiến thức, theo học kỳ và theo loại học phần, **để** kiểm tra cơ cấu chương trình so với quy định.
- **Tiêu chí chấp nhận**
  1. **Cho** một phiên bản — **Khi** mở báo cáo — **Thì** thấy tín chỉ và tỷ lệ phần trăm theo từng khối kiến thức, từng học kỳ, từng loại học phần, bắt buộc và tự chọn.
  2. **Cho** khối kiến thức có số tín chỉ yêu cầu — **Khi** số tính được khác yêu cầu — **Thì** dòng đó được đánh dấu lệch.
  3. **Cho** báo cáo — **Khi** cộng các dòng của một cách phân bổ — **Thì** tổng bằng tổng tín chỉ tính được của khung.
  4. **Cho** báo cáo — **Khi** xuất — **Thì** nhận tệp Excel.
- **Bao phủ:** FR-103 · UC-80, UC-56 · BR-03 · EC — · khác: E-2

### US-107 — Xuất ma trận chuẩn đầu ra ra Excel

- **Vai trò:** R1, R2, R3 · **Bậc:** B6 · **Epic:** EP-23
- **Là** người chuẩn bị hồ sơ, **tôi muốn** xuất ma trận CLO–PLO và ma trận học phần–PLO ra Excel, **để** đưa vào hồ sơ mà không chép tay.
- **Tiêu chí chấp nhận**
  1. **Cho** một phiên bản có ma trận — **Khi** xuất — **Thì** tệp có một trang ma trận học phần–PLO và một trang ma trận CLO–PLO, giá trị trùng với màn hình.
  2. **Cho** ma trận dùng trọng số số thực trực tiếp — **Khi** xuất — **Thì** giữ đúng giá trị số như trên màn hình theo FR-41/BR-21, không đổi sang I–R–M và không tạo chú thích ghi đè (người dùng chốt 2026-10-26).
  3. **Cho** R3 — **Khi** xuất cho chương trình không được phân công — **Thì** máy chủ từ chối.
- **Bao phủ:** FR-43 · UC-81 · BR-21 · EC — · khác: —

### US-108 — Xuất bộ báo cáo kiểm định

- **Vai trò:** R1, R2, R3 · **Bậc:** B6 · **Epic:** EP-23
- **Là** người chuẩn bị kiểm định, **tôi muốn** xuất một bộ tài liệu của một phiên bản chương trình trong một lần, **để** nộp cho đoàn kiểm định.
- **Tiêu chí chấp nhận**
  1. **Cho** một phiên bản đã ban hành — **Khi** xuất bộ kiểm định — **Thì** nhận khung chương trình, danh sách PLO, hai ma trận, bảng phân bổ tín chỉ và danh sách đề cương kèm công thức điểm.
  2. **Cho** phiên bản Lịch sử — **Khi** xuất — **Thì** chỉ lõi đã đóng băng khi ban hành (tên học phần, tín chỉ, liên kết bản đề cương) là dữ liệu lịch sử; hồ sơ ghi rõ phần bổ sung nào dùng giá trị hiện tại, không cam kết phân loại/ngưỡng chưa được chụp là dữ liệu lúc ban hành (người dùng chốt 2026-10-26).
  3. **Cho** phiên bản còn lỗ hổng chuẩn đầu ra — **Khi** xuất — **Thì** vẫn xuất được, bộ tài liệu có trang liệt kê lỗ hổng.
  4. **Cho** mỗi lần xuất — **Khi** hoàn tất — **Thì** có một dòng nhật ký.
- **Bao phủ:** FR-104 · UC-81 · BR-20 · EC-41 · khác: —

### US-109 — Thống kê đề xuất thay đổi

- **Vai trò:** R1, R2, R3, R4 · **Bậc:** B6 · **Epic:** EP-23
- **Là** người quản lý, **tôi muốn** số liệu về các đề xuất theo thời gian, **để** biết quy trình đang chạy nhanh hay chậm và nghẽn ở đâu.
- **Tiêu chí chấp nhận**
  1. **Cho** một khoảng thời gian — **Khi** mở thống kê — **Thì** thấy số đề xuất theo trạng thái, theo loại, theo nguồn phát sinh.
  2. **Cho** các đề xuất đã kết thúc — **Khi** xem — **Thì** thấy thời gian xử lý trung bình của từng cấp.
  3. **Cho** R3 hoặc R4 — **Khi** mở thống kê — **Thì** số liệu chỉ gồm đề xuất trong phạm vi chương trình hoặc nhóm của mình.
- **Bao phủ:** FR-107 · UC-83 · BR — · EC — · khác: —

### EP-24 — Trực quan hóa và xuất bản

### US-110 — Xem đồ thị quan hệ học phần

- **Vai trò:** R1, R2, R3, R4, R5, R6 · **Bậc:** B6 · **Epic:** EP-24
- **Là** người tra cứu, **tôi muốn** xem quan hệ học trước, tiên quyết, song hành dưới dạng đồ thị, **để** nhìn ra chuỗi học phần phải học theo thứ tự.
- **Tiêu chí chấp nhận**
  1. **Cho** một chương trình — **Khi** mở đồ thị — **Thì** mỗi học phần là một nút xếp theo học kỳ, mỗi loại quan hệ một kiểu đường.
  2. **Cho** một nút — **Khi** chọn — **Thì** chuỗi học phần phải học trước nó và chuỗi phụ thuộc vào nó được làm nổi.
  3. **Cho** R6 — **Khi** mở đồ thị — **Thì** chỉ thấy đồ thị của chương trình mình.
- **Bao phủ:** FR-22 · UC-15 · BR — · EC — · khác: —

### US-111 — Xuất chương trình ra PDF

- **Vai trò:** R1, R3 · **Bậc:** B6 · **Epic:** EP-24
- **Là** Phòng Đào tạo hoặc Giám đốc CTĐT, **tôi muốn** xuất một phiên bản chương trình ra PDF, **để** in và công bố.
- **Tiêu chí chấp nhận**
  1. **Cho** một phiên bản đã ban hành — **Khi** xuất PDF — **Thì** tệp có thông tin chung, số quyết định, khung theo học kỳ, nhóm tự chọn, danh sách PLO.
  2. **Cho** tệp PDF — **Khi** mở — **Thì** tiếng Việt có dấu hiển thị đúng, bảng không bị cắt ngang dòng giữa hai trang.
  3. **Cho** phiên bản Nháp — **Khi** xuất — **Thì** mọi trang có chữ "BẢN NHÁP".
- **Bao phủ:** FR-37 · UC-24 · BR — · EC — · khác: Q-14, NFR-16

### US-112 — Xem dòng thời gian phiên bản

- **Vai trò:** R1, R2, R3, R4, R5 · **Bậc:** B6 · **Epic:** EP-24
- **Là** người tra cứu, **tôi muốn** thấy các phiên bản của một chương trình trên một dòng thời gian, **để** nắm nhanh lịch sử thay đổi.
- **Tiêu chí chấp nhận**
  1. **Cho** chương trình có nhiều phiên bản — **Khi** mở dòng thời gian — **Thì** mỗi phiên bản là một mốc tại học kỳ hiệu lực, ghi số phiên bản, số quyết định, khóa áp dụng.
  2. **Cho** một mốc — **Khi** chọn — **Thì** mở được phiên bản đó hoặc so sánh nó với bản liền trước.
  3. **Cho** phiên bản đính chính — **Khi** xem dòng thời gian — **Thì** mốc của nó có nhãn đính chính và nối với bản bị đính chính.
- **Bao phủ:** FR-76 · UC-51 · BR — · EC — · khác: —

### US-113 — Bảng sức khỏe chương trình

- **Vai trò:** R1, R2, R3 · **Bậc:** B6 · **Epic:** EP-24
- **Là** người quản lý chương trình, **tôi muốn** một bảng gom mọi cảnh báo của một chương trình, **để** biết chương trình còn vấn đề gì mà không mở từng màn hình.
- **Tiêu chí chấp nhận**
  1. **Cho** một chương trình — **Khi** mở bảng sức khỏe — **Thì** thấy số lượng và danh sách: lệch tổng tín chỉ, tiên quyết xếp sau, tiên quyết ngoài khung, học kỳ trống, PLO chưa có học phần đóng góp, CLO chưa được đánh giá, học phần chưa có đề cương, học phần Ngừng mở lớp chưa có thay thế.
  2. **Cho** một dòng cảnh báo — **Khi** bấm — **Thì** tới đúng màn hình xử lý vấn đề đó.
  3. **Cho** chương trình không còn vấn đề — **Khi** mở — **Thì** bảng ghi rõ "không có cảnh báo".
- **Bao phủ:** FR-82 · UC-54, UC-31 · BR-05, BR-20 · EC-07, EC-12, EC-13, EC-41, EC-44 · khác: —

### EP-25 — Tiện ích quy trình duyệt

### US-114 — Ủy quyền phê duyệt

- **Vai trò:** R1, R3, R4 · **Bậc:** B6 · **Epic:** EP-25
- **Là** người duyệt sắp vắng mặt, **tôi muốn** ủy quyền việc duyệt cho người khác trong một khoảng thời gian, **để** đề xuất không phải chờ tôi về.
- **Tiêu chí chấp nhận**
  1. **Cho** R3 hoặc R4 — **Khi** tạo ủy quyền với người nhận, phạm vi, từ ngày, đến ngày — **Thì** trong khoảng đó người nhận thấy các đề xuất của người ủy quyền trong hàng đợi của mình.
  2. **Cho** người được ủy quyền xử lý một đề xuất — **Khi** xem lịch sử — **Thì** bước ghi rõ ai thực hiện thay ai.
  3. **Cho** ủy quyền đã qua ngày kết thúc — **Khi** người nhận mở hàng đợi — **Thì** không còn thấy các đề xuất đó; ủy quyền ở trạng thái Hết hạn.
  4. **Cho** người ủy quyền — **Khi** thu hồi trước hạn — **Thì** ủy quyền chuyển sang Đã thu hồi ngay.
  5. **Cho** người nhận ủy quyền là người tạo đề xuất — **Khi** tìm cách duyệt đề xuất đó — **Thì** máy chủ từ chối.
  6. **Cho** tài khoản của một trong hai bên bị vô hiệu hóa — **Khi** kiểm tra ủy quyền — **Thì** ủy quyền đã tự chuyển sang Đã thu hồi.
- **Bao phủ:** FR-09 · UC-08 · BR-27 · EC-25 · khác: S-11

### US-115 — Gửi thông báo qua email

- **Vai trò:** R1, R3, R4, R5, E2 · **Bậc:** B6 · **Epic:** EP-25
- **Là** người tham gia quy trình, **tôi muốn** nhận email khi có việc cần làm, **để** biết ngay cả khi không mở hệ thống.
- **Tiêu chí chấp nhận**
  1. **Cho** thông báo trong ứng dụng vừa được tạo cho một sự kiện của đề xuất — **Khi** gửi email được bật — **Thì** người nhận có email cùng nội dung, kèm đường dẫn tới đề xuất.
  2. **Cho** dịch vụ email không phản hồi — **Khi** người duyệt bấm Đồng ý — **Thì** thao tác duyệt vẫn thành công; lỗi gửi được ghi lại; thông báo trong ứng dụng vẫn có.
  3. **Cho** người dùng tắt nhận email trong cài đặt cá nhân — **Khi** có sự kiện — **Thì** chỉ nhận thông báo trong ứng dụng.
  4. **Cho** một thông báo — **Khi** xem — **Thì** biết được email đã gửi hay chưa.
- **Bao phủ:** FR-64 · UC-48 · BR — · EC — · khác: L-6, NFR-24

### US-116 — Nhắc hạn đề xuất tồn đọng

- **Vai trò:** R1, R3, R4 · **Bậc:** B6 · **Epic:** EP-25
- **Là** Phòng Đào tạo, **tôi muốn** hệ thống tự nhắc người duyệt khi đề xuất chờ quá số ngày quy định, **để** đề xuất không nằm im.
- **Tiêu chí chấp nhận**
  1. **Cho** số ngày chờ tối đa là một tham số cấu hình — **Khi** một đề xuất chờ ở một cấp quá số ngày đó — **Thì** người duyệt của cấp đó nhận thông báo nhắc hạn.
  2. **Cho** đề xuất tiếp tục chờ — **Khi** qua thêm mỗi chu kỳ nhắc — **Thì** người duyệt được nhắc lại và Phòng Đào tạo cũng nhận thông báo.
  3. **Cho** đề xuất đã được xử lý — **Khi** tới chu kỳ nhắc — **Thì** không có thông báo nhắc nào nữa.
  4. **Cho** tính năng nhắc hạn bị tắt trong cấu hình — **Khi** đề xuất chờ quá hạn — **Thì** không có thông báo nhắc; hàng đợi vẫn hiện số ngày đã chờ.
- **Bao phủ:** FR-66 · UC-42 · BR-31 · EC-28 · khác: Q-17, NFR-24

---

## 8. Bảng truy vết

Các bảng dưới đây được sinh từ dòng "Bao phủ" của từng story. Một mã không có story nào thì ghi rõ nơi nó được xử lý.

### 8.1. Yêu cầu chức năng → story

| FR | Story |
|---|---|
| FR-01 | US-007 |
| FR-02 | US-008 |
| FR-03 | US-009 |
| FR-04 | US-010 |
| FR-05 | US-013 |
| FR-06 | US-004 |
| FR-07 | US-005, US-021 |
| FR-08 | US-020 |
| FR-09 | US-114 |
| FR-10 | US-006 |
| FR-11 | US-011, US-012 |
| FR-12 | US-012 |
| FR-13 | US-012 |
| FR-14 | US-012 |
| FR-15 | US-014 |
| FR-16 | US-012 |
| FR-17 | US-028 |
| FR-18 | US-015, US-017 |
| FR-19 | US-015 |
| FR-20 | US-016 |
| FR-21 | US-017 |
| FR-22 | US-110 |
| FR-23 | US-018, US-019 |
| FR-24 | US-019 |
| FR-25 | US-022, US-048 |
| FR-26 | US-020 |
| FR-27 | US-023 |
| FR-28 | US-024 |
| FR-29 | US-026 |
| FR-30 | US-027 |
| FR-31 | US-086 |
| FR-32 | US-025 |
| FR-33 | US-034 |
| FR-34 | US-033, US-034, US-082, US-083 |
| FR-35 | US-035, US-082, US-083 |
| FR-36 | US-037 |
| FR-37 | US-111 |
| FR-38 | US-042, US-045 |
| FR-39 | US-043, US-045 |
| FR-40 | US-044, US-045 |
| FR-41 | US-046 |
| FR-42 | US-047 |
| FR-43 | US-107 |
| FR-44 | US-038 |
| FR-45 | US-039 |
| FR-46 | US-039 |
| FR-47 | US-041, US-077 |
| FR-48 | US-040 |
| FR-49 | US-049 |
| FR-50 | US-049 |
| FR-51 | US-050 |
| FR-52 | US-050 |
| FR-53 | US-051 |
| FR-54 | US-052 |
| FR-55 | US-035, US-053 |
| FR-56 | US-054, US-060 |
| FR-57 | US-057, US-063, US-064, US-070 |
| FR-58 | US-062 |
| FR-59 | US-063, US-064, US-065 |
| FR-60 | US-059 |
| FR-61 | US-066 |
| FR-62 | US-067 |
| FR-63 | US-068 |
| FR-64 | US-115 |
| FR-65 | US-061 |
| FR-66 | US-116 |
| FR-67 | US-069 |
| FR-68 | US-058 |
| FR-69 | US-072, US-075 |
| FR-70 | US-071, US-072, US-073 |
| FR-71 | US-074 |
| FR-72 | US-078 |
| FR-73 | US-079 |
| FR-74 | US-080, US-084 |
| FR-75 | US-076 |
| FR-76 | US-112 |
| FR-77 | US-029 |
| FR-78 | US-030 |
| FR-79 | US-031 |
| FR-80 | US-031 |
| FR-81 | US-031 |
| FR-82 | US-113 |
| FR-83 | US-085 |
| FR-84 | US-087, US-091 |
| FR-85 | US-088 |
| FR-86 | US-089 |
| FR-87 | US-090 |
| FR-88 | US-092 |
| FR-89 | US-093 |
| FR-90 | US-094 |
| FR-91 | US-095 |
| FR-92 | US-095 |
| FR-93 | US-096 |
| FR-94 | US-098, US-099, US-100, US-101 |
| FR-95 | US-097 |
| FR-96 | US-033, US-034, US-082, US-083 |
| FR-97 | US-032, US-081 |
| FR-98 | US-102 |
| FR-99 | US-103 |
| FR-100 | US-104 |
| FR-101 | US-036 |
| FR-102 | US-105 |
| FR-103 | US-106 |
| FR-104 | US-108 |
| FR-105 | US-002 |
| FR-106 | US-003 |
| FR-107 | US-109 |
| FR-108 | US-055 |
| FR-109 | US-056 |

### 8.2. Use case → story

| UC | Story |
|---|---|
| UC-01 | US-001 |
| UC-02 | US-007, US-008 |
| UC-03 | US-009 |
| UC-04 | US-010 |
| UC-05 | US-004 |
| UC-06 | US-005, US-006, US-021 |
| UC-07 | US-020 |
| UC-08 | US-114 |
| UC-09 | US-060 |
| UC-10 | US-011 |
| UC-11 | US-012, US-013, US-028 |
| UC-12 | US-014 |
| UC-13 | US-015, US-016 |
| UC-14 | US-017 |
| UC-15 | US-110 |
| UC-16 | US-028, US-039, US-057, US-075 |
| UC-17 | US-016, US-031 |
| UC-18 | US-018, US-024, US-025, US-092 |
| UC-19 | US-019 |
| UC-20 | US-022, US-048 |
| UC-21 | US-023, US-027 |
| UC-22 | US-026 |
| UC-23 | US-037 |
| UC-24 | US-111 |
| UC-25 | US-045, US-096 |
| UC-26 | US-042 |
| UC-27 | US-043 |
| UC-28 | US-044 |
| UC-29 | US-046 |
| UC-30 | US-046 |
| UC-31 | US-047, US-113 |
| UC-32 | US-038, US-096 |
| UC-33 | US-039, US-040 |
| UC-34 | US-041, US-077 |
| UC-35 | US-049, US-050 |
| UC-36 | US-051, US-052 |
| UC-37 | US-053, US-054, US-055, US-056, US-058 |
| UC-38 | US-057, US-058, US-066 |
| UC-39 | US-059 |
| UC-40 | US-056, US-062, US-069 |
| UC-41 | US-067 |
| UC-42 | US-061, US-116 |
| UC-43 | US-063, US-066, US-070 |
| UC-44 | US-064, US-066, US-070 |
| UC-45 | US-065 |
| UC-46 | US-072, US-073, US-075 |
| UC-47 | US-068 |
| UC-48 | US-115 |
| UC-49 | US-071, US-072, US-074, US-075 |
| UC-50 | US-078 |
| UC-51 | US-079, US-112 |
| UC-52 | US-080, US-084 |
| UC-53 | US-076 |
| UC-54 | US-030, US-031, US-113 |
| UC-55 | US-030 |
| UC-56 | US-029, US-106 |
| UC-57 | US-052, US-057 |
| UC-58 | US-049, US-050 |
| UC-59 | US-093, US-094 |
| UC-60 | US-086, US-095 |
| UC-61 | US-087, US-089 |
| UC-62 | US-090 |
| UC-63 | US-085, US-086, US-095, US-100 |
| UC-64 | US-087, US-088, US-089, US-090, US-091, US-100 |
| UC-65 | US-080, US-084, US-092, US-099 |
| UC-66 | US-098, US-099, US-101 |
| UC-67 | US-100, US-101 |
| UC-68 | US-100, US-101 |
| UC-69 | US-099, US-101 |
| UC-70 | US-100, US-101 |
| UC-71 | US-032, US-081 |
| UC-72 | US-033, US-034, US-082, US-083 |
| UC-73 | US-035, US-082, US-083 |
| UC-74 | US-036 |
| UC-75 | US-033, US-034, US-035, US-082, US-083 |
| UC-76 | US-102 |
| UC-77 | US-103, US-104 |
| UC-78 | US-103, US-104 |
| UC-79 | US-105 |
| UC-80 | US-106 |
| UC-81 | US-107, US-108 |
| UC-82 | US-002, US-003, US-006 |
| UC-83 | US-109 |
| UC-84 | US-092, US-093, US-097 |

### 8.3. Quy tắc nghiệp vụ → story

| BR | Story |
|---|---|
| BR-01 | US-012, US-033 |
| BR-02 | US-029, US-033, US-087, US-094 |
| BR-03 | US-019, US-029, US-106 |
| BR-04 | US-026, US-089 |
| BR-05 | US-030, US-113 |
| BR-06 | US-085 |
| BR-07 | US-085 |
| BR-08 | US-085 |
| BR-09 | US-017, US-085, US-088, US-105 |
| BR-10 | US-088, US-094 |
| BR-11 | US-016, US-031, US-034 |
| BR-12 | US-049 |
| BR-13 | US-049 |
| BR-14 | US-052 |
| BR-15 | US-050 |
| BR-16 | US-073, US-096 |
| BR-17 | US-042, US-048 |
| BR-18 | US-043, US-048 |
| BR-19 | US-044 |
| BR-20 | US-047, US-108, US-113 |
| BR-21 | US-044, US-107 |
| BR-22 | US-071, US-073 |
| BR-23 | US-053, US-074, US-076, US-077 |
| BR-24 | US-072, US-075, US-076 |
| BR-25 | US-071, US-072, US-073 |
| BR-26 | US-080, US-082, US-084, US-092 |
| BR-27 | US-066, US-070, US-114 |
| BR-28 | US-063, US-064, US-065 |
| BR-29 | US-057, US-063, US-064, US-065 |
| BR-30 | US-058 |
| BR-31 | US-070, US-116 |

### 8.4. Trường hợp biên → story

| EC | Story |
|---|---|
| EC-01 | US-012, US-029 |
| EC-02 | US-012 |
| EC-03 | US-030 |
| EC-04 | US-026 |
| EC-05 | US-026 |
| EC-06 | US-023, US-031 |
| EC-07 | US-024, US-113 |
| EC-08 | US-023 |
| EC-09 | US-016, US-031 |
| EC-10 | US-027, US-031 |
| EC-11 | US-085 |
| EC-12 | US-014, US-085, US-113 |
| EC-13 | US-031, US-113 |
| EC-14 | US-088 |
| EC-15 | US-017, US-088 |
| EC-16 | US-017, US-088 |
| EC-17 | US-088 |
| EC-18 | US-017, US-088, US-105 |
| EC-19 | US-066 |
| EC-20 | US-066 |
| EC-21 | US-057 |
| EC-22 | US-057, US-063 |
| EC-23 | US-057, US-064 |
| EC-24 | US-013, US-057 |
| EC-25 | US-070, US-114 |
| EC-26 | US-065 |
| EC-27 | US-058 |
| EC-28 | US-070, US-116 |
| EC-29 | US-004 |
| EC-30 | US-073, US-096 |
| EC-31 | US-076 |
| EC-32 | US-014 |
| EC-33 | US-084, US-088 |
| EC-34 | US-084, US-087 |
| EC-35 | US-084 |
| EC-36 | US-083, US-085, US-094 |
| EC-37 | US-084 |
| EC-38 | US-028, US-057, US-075 |
| EC-39 | US-049 |
| EC-40 | US-052, US-057 |
| EC-41 | US-047, US-108, US-113 |
| EC-42 | US-050 |
| EC-43 | US-091, US-103 |
| EC-44 | US-038, US-071, US-113 |
| EC-45 | US-034, US-083 |
| EC-46 | US-033, US-034, US-082 |
| EC-47 | US-034 |
| EC-48 | US-104 |
| EC-49 | US-103 |
| EC-50 | US-014, US-019 |
| EC-51 | US-004 |
| EC-52 | US-093, US-100 |

### 8.5. Yêu cầu phi chức năng → story

NFR không có story riêng được kiểm bằng phương pháp ghi trong `docs/planning/test-plan.md`.

| NFR | Story |
|---|---|
| NFR-01 | US-011, US-024, US-093 |
| NFR-02 | US-085, US-100 |
| NFR-03 | US-090 |
| NFR-04 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-05 | US-035, US-083 |
| NFR-06 | US-001 |
| NFR-07 | US-001, US-098 |
| NFR-08 | US-001 |
| NFR-09 | US-005, US-021, US-053 |
| NFR-10 | US-002, US-069 |
| NFR-11 | US-092 |
| NFR-12 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-13 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-14 | US-074 |
| NFR-15 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-16 | US-111 |
| NFR-17 | US-097 |
| NFR-18 | US-003, US-011, US-018, US-025, US-036, US-045, US-061, US-090, US-103 |
| NFR-19 | US-012, US-034, US-049 |
| NFR-20 | US-004, US-008, US-014, US-042, US-059, US-071 |
| NFR-21 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-22 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-23 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-24 | US-041, US-044, US-102, US-115, US-116 |
| NFR-25 | — (không gắn story; xem kế hoạch kiểm thử) |
| NFR-26 | US-097 |
| NFR-27 | — (không gắn story; xem kế hoạch kiểm thử) |

---

## 9. Điểm còn hở

Mỗi điểm dưới đây là một chỗ các tài liệu nguồn không khớp nhau hoặc bỏ trống. Lựa chọn tạm đã được dùng để viết story; đổi lựa chọn thì phải sửa các story ở cột "Ảnh hưởng tới".

| Mã | Vấn đề | Lựa chọn tạm | Ảnh hưởng tới | Cần ai trả lời |
|---|---|---|---|---|
| U-1 | Danh sách tác nhân trong bộ use case không khớp ma trận quyền SRS mục 3.4. UC-11, UC-13, UC-21, UC-37 không có R5 trong khi ma trận cho R5 ô `Đ` ở học phần, quan hệ, khung, CLO, đề cương, công thức điểm. UC-14, UC-19, UC-26 có R2 trong khi ma trận ghi R2 chỉ xem | Theo ma trận SRS: R5 soạn và đề xuất cho học phần thuộc các nhóm mình là thành viên, không đụng PLO và thông tin chương trình. R2 không soạn dữ liệu đào tạo | US-012, US-015, US-016, US-017, US-019, US-023, US-039, US-042, US-043, US-044, US-049..US-052, US-054 | Thầy hướng dẫn, Khoa |
| U-2 | DEC-12 loại quy trình tạo chương trình mới từ đầu ra khỏi phạm vi, nhưng dữ liệu của chương trình hiện có vẫn phải vào hệ thống bằng cách nào đó | R1 thêm bản ghi chương trình (US-019) rồi nhập khung từ Excel (US-034). DEC-12 được hiểu là không có quy trình thiết kế và thẩm định chương trình mới, không cấm thêm bản ghi | US-019, US-034, US-071 | Thầy hướng dẫn |
| U-3 | UC-03 cho R2 phân công thành viên nhóm chuyên môn; ma trận SRS chỉ cho R1 quản lý đơn vị và nhóm | B1..B3: chỉ R1 phân công. Từ B4: R2 và R4 gửi đề xuất loại "Thay đổi tổ chức / phân công", R1 xử lý (S-1, E-4) | US-009, US-010, US-060 | Khoa |
| U-4 | UC-82 cho R3 tra cứu nhật ký; ma trận SRS chỉ cho R1 và R2 xem nhật ký hệ thống | Theo ma trận: chỉ R1 và R2. R3 xem lịch sử của từng đề xuất và từng phiên bản qua US-069, US-079 | US-003 | Khoa |
| U-5 | UC-52 gộp gán phiên bản cho cả khóa và cho từng sinh viên, trong khi hồ sơ sinh viên chỉ có từ B5 | Tách hai story: gán theo khóa ở B4 (US-080), ghi danh riêng từng sinh viên và ngoại lệ ở B5 (US-084) | US-080, US-084 | Không cần hỏi; đổi nếu dời bậc |
| U-6 | FR-96 và FR-97 liệt kê bốn loại dữ liệu nhập nhưng không nói loại nào trước, ai được nhập loại nào | Đợt 1 ở B2: danh mục học phần (R1) và khung (R1, R3 trong phạm vi). Đợt 2 ở B5: danh sách sinh viên và kết quả học tập, chỉ R1 | US-032..US-035, US-081..US-083 | Phòng Đào tạo |
| U-7 | UC-20 cho R1, R2, R3 nhân bản chương trình; SRS không có ô quyền riêng cho nhân bản, và chương trình mới chưa có Giám đốc nào được phân công | Chỉ R1 nhân bản, sau đó phân công Giám đốc CTĐT cho bản mới (US-020) | US-022, US-048 | Khoa |
| U-8 | UC-59, UC-60, UC-61 cho gần như mọi vai trò xem tiến độ, điều kiện đăng ký, kết quả xét của sinh viên; ma trận SRS chỉ ghi R6 xem của chính mình và NFR-11 giới hạn dữ liệu sinh viên | Theo L-10: R1 xem mọi sinh viên; R3 xem sinh viên của chương trình mình phụ trách; R2, R4, R5 không xem dữ liệu từng sinh viên; R6 chỉ xem của mình | US-085, US-086, US-087, US-089, US-090, US-094 | Phòng Đào tạo |
| U-9 | UC-53 mô tả đính chính đi qua luồng phê duyệt; FR-75 và DEC-08 chỉ yêu cầu ban hành phiên bản đính chính, không nói có duyệt | Theo S-8: R1 ban hành đính chính trực tiếp, bắt buộc có lý do, bản bị đính chính chuyển sang Lịch sử. R1 quyết định có chuyển các khóa đang gắn sang bản đính chính, mặc định có | US-076, US-112 | Phòng Đào tạo |
