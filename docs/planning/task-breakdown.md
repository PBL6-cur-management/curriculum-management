# PHÂN RÃ CÔNG VIỆC v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-12 |
| Đi kèm | `docs/planning/user-stories.md` (US-001..US-116), `docs/planning/epics.md` (bậc B1..B6, EP-01..EP-25) |
| Nguồn | `docs/design/data-dictionary.md` (47 thực thể), `docs/design/state-diagrams.md`, `docs/design/sequence-diagrams.md`, `docs/requirement/REQUIREMENTS.md` |
| Phạm vi | Việc phải làm cho từng user story. Từng việc không nêu ngôn ngữ, bộ khung, hệ quản trị cơ sở dữ liệu; công nghệ đã chốt ở `docs/design/tech-stack.md` (Q-16) |
| Điểm còn hở của tài liệu này | K-1..K-8, mục 11 |

---

## 1. Quy ước

| Mục | Quy ước |
|---|---|
| Mã | CV-001..CV-277, đánh số liên tục theo thứ tự story. Mã không đổi khi việc bị dời |
| Loại | **Dữ liệu**: lập thực thể, ràng buộc, dữ liệu nạp sẵn · **Nghiệp vụ**: quy tắc, thuật toán, kiểm quyền, máy trạng thái · **Giao diện**: màn hình và thao tác của người dùng · **Tích hợp**: tệp Excel, PDF, API cho dDUT, cơ sở dữ liệu có sẵn, email, lưu tệp · **Kiểm thử**: ca kiểm và phép đo · **Tài liệu**: đặc tả, hướng dẫn, quy trình vận hành |
| Cỡ | S, M, L là cỡ tương đối, không phải giờ công. Tỷ lệ quy ước S : M : L = 1 : 2 : 4 điểm; kế hoạch sprint dùng đúng tỷ lệ này (K-3) |
| Phụ thuộc | Việc phải xong trước. Chỉ ghi phụ thuộc trực tiếp. Một việc không bao giờ phụ thuộc việc của bậc sau |
| Story | Story mà việc phục vụ. Mỗi việc đúng một story; mỗi story có ít nhất một việc |
| Việc ngang | Việc phục vụ cả một bậc hoặc một yêu cầu phi chức năng, không riêng story nào. Được gắn vào story đầu hoặc cuối của phần liên quan và mở đầu bằng chữ "Ngang:" (K-2). Danh sách ở mục 9 |
| Tên thực thể | Tên trong dấu `` ` `` là thực thể hoặc thuộc tính của từ điển dữ liệu |
| Mã chuyển trạng thái | DX, HP, GD, DB, UQ kèm số là mã dòng trong `docs/design/state-diagrams.md` |
| Điều không lặp lại | Mọi việc Nghiệp vụ và Giao diện ngầm định: kiểm quyền ở máy chủ, ghi nhật ký cho thao tác ghi, danh sách dài có phân trang. Ba điều này được dựng một lần ở CV-015, CV-007, CV-033 |

## 2. Tổng hợp

Số liệu trong mục này được tính từ các bảng ở mục 3..8.

### 2.1. Số việc theo bậc và loại

| Bậc | Story | Việc | Dữ liệu | Nghiệp vụ | Giao diện | Tích hợp | Kiểm thử | Tài liệu |
|---|---|---|---|---|---|---|---|---|
| B1 | 17 | 53 | 10 | 16 | 17 | 0 | 9 | 1 |
| B2 | 20 | 45 | 5 | 16 | 14 | 3 | 6 | 1 |
| B3 | 15 | 37 | 9 | 10 | 13 | 1 | 4 | 0 |
| B4 | 28 | 65 | 6 | 22 | 24 | 0 | 12 | 1 |
| B5 | 21 | 45 | 4 | 12 | 13 | 3 | 11 | 2 |
| B6 | 15 | 32 | 2 | 7 | 9 | 6 | 7 | 1 |
| **Tổng** | **116** | **277** | **36** | **83** | **90** | **13** | **49** | **6** |

### 2.2. Khối lượng theo bậc

| Bậc | S | M | L | Điểm (S=1, M=2, L=4) | Tỷ lệ |
|---|---|---|---|---|---|
| B1 | 26 | 24 | 3 | 86 | 16% |
| B2 | 17 | 22 | 6 | 85 | 16% |
| B3 | 16 | 18 | 3 | 64 | 12% |
| B4 | 18 | 37 | 10 | 132 | 25% |
| B5 | 13 | 25 | 7 | 91 | 17% |
| B6 | 8 | 18 | 6 | 68 | 13% |
| **Tổng** | **98** | **144** | **35** | **526** | **100%** |

### 2.3. Khối lượng theo epic

| Bậc | Epic | Việc | Điểm |
|---|---|---|---|
| B1 | EP-01 Nền tảng, đăng nhập và nhật ký | 10 | 17 |
| B1 | EP-02 Tài khoản, vai trò, phạm vi quyền | 10 | 18 |
| B1 | EP-03 Cơ cấu tổ chức và nhóm chuyên môn | 11 | 16 |
| B1 | EP-04 Danh mục học phần | 12 | 17 |
| B1 | EP-05 Quan hệ học phần và nhóm tương đương | 10 | 18 |
| B2 | EP-06 Thông tin CTĐT và Giám đốc CTĐT | 12 | 21 |
| B2 | EP-07 Khung chương trình và nhóm tự chọn | 13 | 25 |
| B2 | EP-08 Kiểm tra nhất quán khung | 7 | 11 |
| B2 | EP-09 Nhập và xuất Excel | 13 | 28 |
| B3 | EP-10 Đề cương chi tiết | 9 | 17 |
| B3 | EP-11 Chuẩn đầu ra: PLO, CLO, ma trận | 18 | 30 |
| B3 | EP-12 Công thức điểm và ánh xạ đánh giá–CLO | 10 | 17 |
| B4 | EP-13 Đề xuất: soạn, gửi, thu hồi, xung đột | 21 | 42 |
| B4 | EP-14 Phê duyệt ba cấp và thông báo | 20 | 37 |
| B4 | EP-15 Ban hành và ảnh chụp bất biến | 17 | 36 |
| B4 | EP-16 Tra cứu, so sánh phiên bản, gán khóa | 7 | 17 |
| B5 | EP-17 Hồ sơ sinh viên và kết quả học tập | 11 | 19 |
| B5 | EP-18 Tính điều kiện đăng ký | 3 | 10 |
| B5 | EP-19 Xét tốt nghiệp | 11 | 23 |
| B5 | EP-20 Cổng sinh viên | 11 | 22 |
| B5 | EP-21 API cho dDUT | 9 | 17 |
| B6 | EP-22 Đồng bộ cơ sở dữ liệu có sẵn | 10 | 22 |
| B6 | EP-23 Báo cáo và xuất kiểm định | 8 | 16 |
| B6 | EP-24 Trực quan hóa và xuất bản | 5 | 14 |
| B6 | EP-25 Tiện ích quy trình duyệt | 9 | 16 |

---

## 3. Bậc B1 — Nền tảng và danh mục học phần (phiên bản 0.1)

### EP-01 — Nền tảng, đăng nhập và nhật ký

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-001 | Lập `User` ở mức tối thiểu cho đăng nhập: `username`, `passwordHash`, `status`; mật khẩu chỉ lưu dạng băm (NFR-06) | Dữ liệu | — | S | US-001 |
| CV-002 | Đăng nhập, đăng xuất, phiên hết hạn sau 60 phút lấy từ cấu hình; ghi nhật ký lần đăng nhập sai, không khóa tài khoản (L-1) | Nghiệp vụ | CV-001 | M | US-001 |
| CV-003 | Màn hình đăng nhập, khung trang và menu hiện theo vai trò; toàn bộ giao diện bằng tiếng Việt có dấu (NFR-16) | Giao diện | CV-002 | M | US-001 |
| CV-004 | Ngang: Dựng bộ khung một khối phân module, tài liệu quy ước đặt tên, cơ chế nâng cấp lược đồ theo từng bước, tệp cấu hình tham số nghiệp vụ (NFR-21..24) | Tài liệu | — | L | US-001 |
| CV-005 | Kiểm thử đăng nhập đúng và sai, hết phiên, tài khoản bị vô hiệu hóa, chỉ chấp nhận kết nối mã hóa (NFR-07, NFR-08) | Kiểm thử | CV-002 | S | US-001 |
| CV-006 | Lập `AuditLog` theo kiểu chỉ thêm: không có đường sửa, không có đường xóa | Dữ liệu | — | S | US-002 |
| CV-007 | Cơ chế tự ghi nhật ký cho mọi thao tác ghi: người thực hiện, hành động, thực thể, mã bản ghi, giá trị cũ, giá trị mới, địa chỉ IP, thời điểm | Nghiệp vụ | CV-002, CV-006 | M | US-002 |
| CV-008 | Kiểm thử: mọi vai trò gọi sửa hoặc xóa nhật ký đều bị từ chối (NFR-10) | Kiểm thử | CV-007 | S | US-002 |
| CV-009 | Truy vấn nhật ký theo người, loại thực thể, mã bản ghi, khoảng thời gian; phân trang và sắp xếp | Nghiệp vụ | CV-007 | S | US-003 |
| CV-010 | Màn hình tra cứu nhật ký cho R1 và R2, xem giá trị trước và sau của từng dòng | Giao diện | CV-009, CV-015 | M | US-003 |

### EP-02 — Tài khoản, vai trò, phạm vi quyền

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-011 | Hoàn thiện `User`: `fullName`, `email`, `orgUnit` | Dữ liệu | CV-001, CV-021 | S | US-004 |
| CV-012 | Thêm, sửa, vô hiệu hóa, kích hoạt lại, đặt lại mật khẩu; không xóa cứng (EC-51); công việc của người bị vô hiệu hóa vẫn còn (EC-29) | Nghiệp vụ | CV-011 | M | US-004 |
| CV-013 | Màn hình danh sách tài khoản và form tài khoản, thao tác vô hiệu hóa có hộp xác nhận (NFR-20) | Giao diện | CV-012 | M | US-004 |
| CV-014 | Lập `Role`, `Permission`, `RolePermission`, `RoleAssignment`; nạp sáu vai trò R1..R6 và ma trận quyền ban đầu theo mục 9 của từ điển dữ liệu (M-10) | Dữ liệu | CV-011 | M | US-005 |
| CV-015 | Bộ kiểm quyền và phạm vi ở máy chủ: mỗi thao tác gắn một mã quyền và đọc `RolePermission`, không viết cứng vai trò trong mã; ba loại phạm vi, hợp quyền của nhiều vai trò, hiệu lực theo `validFrom`..`validTo` (NFR-09) | Nghiệp vụ | CV-014 | L | US-005 |
| CV-016 | Màn hình gán vai trò và phạm vi cho người dùng | Giao diện | CV-015 | M | US-005 |
| CV-017 | Bảng kiểm ma trận quyền phần B1, sinh từ `RolePermission`: mỗi ô một lời gọi được phép và một lời gọi bị từ chối | Kiểm thử | CV-015 | M | US-005 |
| CV-018 | Màn hình ma trận quyền chỉ xem (MH-15): vai trò × quyền kèm chế độ và phạm vi, lọc theo vai trò và nhóm chức năng | Giao diện | CV-014 | S | US-005 |
| CV-019 | Ghi nhật ký riêng cho thay đổi phân quyền: ai cấp, cho ai, vai trò, phạm vi, giá trị trước và sau | Nghiệp vụ | CV-007, CV-015 | S | US-006 |
| CV-020 | Mục lịch sử phân quyền trong hồ sơ người dùng | Giao diện | CV-019 | S | US-006 |

### EP-03 — Cơ cấu tổ chức và nhóm chuyên môn

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-021 | Lập `OrgUnit` dạng cây và nạp Trường, Khoa, Phòng Đào tạo | Dữ liệu | — | S | US-007 |
| CV-022 | Thêm, sửa, ngừng hoạt động đơn vị; chặn vòng cha–con; không xóa đơn vị đang được tham chiếu | Nghiệp vụ | CV-021 | S | US-007 |
| CV-023 | Màn hình cây đơn vị | Giao diện | CV-022 | M | US-007 |
| CV-024 | Lập `SubjectGroup` và nạp 04 nhóm chuyên môn của Khoa | Dữ liệu | CV-021 | S | US-008 |
| CV-025 | Màn hình quản lý nhóm chuyên môn: thêm, sửa, ngừng sử dụng có hộp xác nhận | Giao diện | CV-024 | M | US-008 |
| CV-026 | Lập `SubjectGroupMember` | Dữ liệu | CV-011, CV-024 | S | US-009 |
| CV-027 | Gán giảng viên vào nhiều nhóm theo khoảng thời gian; suy ra phạm vi của R5 từ các nhóm đang là thành viên (M-7) | Nghiệp vụ | CV-015, CV-026 | M | US-009 |
| CV-028 | Màn hình thành viên của nhóm và các nhóm của một giảng viên | Giao diện | CV-027 | M | US-009 |
| CV-029 | Chỉ định Điều phối có thời gian hiệu lực; suy ra vai trò R4 và phạm vi theo nhóm; hết hạn thì quyền tự mất | Nghiệp vụ | CV-027 | M | US-010 |
| CV-030 | Form chỉ định Điều phối và lịch sử các lần chỉ định | Giao diện | CV-029 | S | US-010 |
| CV-031 | Kiểm thử giảng viên thuộc hai nhóm và Điều phối đã hết hạn | Kiểm thử | CV-029 | S | US-010 |

### EP-04 — Danh mục học phần

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-032 | Lập `Course` với đủ thuộc tính; `credits` là số thực | Dữ liệu | CV-021, CV-024 | M | US-011 |
| CV-033 | Truy vấn danh mục: tìm theo mã và tên, lọc theo khoa, nhóm, loại, trạng thái; phân trang, sắp xếp (NFR-18) | Nghiệp vụ | CV-032 | S | US-011 |
| CV-034 | Màn hình danh mục học phần và trang chi tiết học phần cho mọi vai trò | Giao diện | CV-033 | M | US-011 |
| CV-035 | Đo thời gian tra cứu danh mục dưới 2 giây trên bộ dữ liệu mẫu cỡ thật (NFR-01) | Kiểm thử | CV-033 | S | US-011 |
| CV-036 | Thêm và sửa học phần: mã duy nhất, tín chỉ số thực không âm, tên Việt và Anh, 7 loại, khoa và nhóm phụ trách; R3..R5 chỉ trong phạm vi (H-4) | Nghiệp vụ | CV-015, CV-027, CV-032 | M | US-012 |
| CV-037 | Form học phần; thông báo lỗi nêu nguyên nhân và cách xử lý (NFR-19) | Giao diện | CV-036 | M | US-012 |
| CV-038 | Kiểm thử BR-01, EC-01, EC-02: tín chỉ 0, tín chỉ 2.5, tín chỉ âm | Kiểm thử | CV-036 | S | US-012 |
| CV-039 | Học phần do khoa khác phụ trách: `ownerFaculty` ngoài Khoa, không có nhóm phụ trách, chỉ R1 nhập và sửa | Nghiệp vụ | CV-036 | S | US-013 |
| CV-040 | Nhãn và bộ lọc "học phần khoa khác" trong danh mục | Giao diện | CV-034, CV-039 | S | US-013 |
| CV-041 | Chuyển trạng thái học phần theo HP-01..HP-04: Ngừng mở lớp đòi học phần thay thế, Đã hủy chỉ khi chưa từng dùng, không xóa (EC-50) | Nghiệp vụ | CV-036, CV-044 | M | US-014 |
| CV-042 | Thao tác đổi trạng thái học phần có hộp xác nhận và ô chọn học phần thay thế | Giao diện | CV-041 | S | US-014 |
| CV-043 | Kiểm thử bốn chuyển trạng thái của học phần và các trường hợp bị chặn | Kiểm thử | CV-041 | S | US-014 |

### EP-05 — Quan hệ học phần và nhóm tương đương

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-044 | Lập `CourseRelation`: học trước, tiên quyết, song hành, thay thế; `minScore` cho tiên quyết | Dữ liệu | CV-032 | S | US-015 |
| CV-045 | Khai báo quan hệ: chặn tự trỏ, chặn trùng, ngưỡng chỉ dùng cho tiên quyết | Nghiệp vụ | CV-036, CV-044 | M | US-015 |
| CV-046 | Mục quan hệ trong trang chi tiết học phần | Giao diện | CV-045 | M | US-015 |
| CV-047 | Phát hiện chu trình trên đồ thị học trước và tiên quyết, trả về đường đi của vòng | Nghiệp vụ | CV-044 | M | US-016 |
| CV-048 | Hiển thị đường đi của chu trình khi lưu quan hệ bị chặn | Giao diện | CV-046, CV-047 | S | US-016 |
| CV-049 | Kiểm thử BR-11, EC-09: vòng hai nút, vòng ba nút, song hành không bị tính là vòng | Kiểm thử | CV-047 | S | US-016 |
| CV-050 | Lập `EquivalentCourseGroup` và liên kết `equivalenceGroup` trên học phần | Dữ liệu | CV-032 | S | US-017 |
| CV-051 | Tạo nhóm, thêm bớt học phần, gộp hai nhóm khi nối bắc cầu; mỗi học phần thuộc tối đa một nhóm | Nghiệp vụ | CV-050 | M | US-017 |
| CV-052 | Màn hình nhóm tương đương | Giao diện | CV-051 | M | US-017 |
| CV-053 | Ngang: Chạy 7 kịch bản chấp nhận của bậc B1 trên Chrome, Firefox, Edge (NFR-26), sửa lỗi, chốt phiên bản 0.1 | Kiểm thử | CV-017, CV-035, CV-043, CV-049 | L | US-017 |

---

## 4. Bậc B2 — Chương trình đào tạo và khung (phiên bản 0.2)

### EP-06 — Thông tin CTĐT và Giám đốc CTĐT

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-054 | Truy vấn danh sách chương trình kèm phiên bản hiện hành và Giám đốc CTĐT | Nghiệp vụ | CV-056 | S | US-018 |
| CV-055 | Màn hình danh sách chương trình và trang tổng quan một chương trình | Giao diện | CV-054 | M | US-018 |
| CV-056 | Lập `Program` và `ProgramVersion`; chương trình mới sinh kèm một phiên bản Nháp (M-3) | Dữ liệu | CV-021 | M | US-019 |
| CV-057 | Thêm và sửa thông tin chương trình: tổng tín chỉ bằng bắt buộc cộng tự chọn, hai trình độ, chỉ ngừng sử dụng chứ không xóa | Nghiệp vụ | CV-015, CV-056 | M | US-019 |
| CV-058 | Form thông tin chương trình | Giao diện | CV-057 | M | US-019 |
| CV-059 | Lập `ProgramDirectorAssignment` | Dữ liệu | CV-011, CV-056 | S | US-020 |
| CV-060 | Phân công Giám đốc cho nhiều chương trình có thời hạn; suy ra vai trò R3 | Nghiệp vụ | CV-015, CV-059 | M | US-020 |
| CV-061 | Mục Giám đốc CTĐT trong trang chương trình, kèm lịch sử phân công | Giao diện | CV-060 | S | US-020 |
| CV-062 | Mở rộng bộ kiểm quyền: phạm vi "Theo phân công" tính theo chương trình đang được phân công | Nghiệp vụ | CV-015, CV-060 | M | US-021 |
| CV-063 | Bảng kiểm ma trận quyền phần B2: R3 trong phạm vi, ngoài phạm vi, phân công hết hạn | Kiểm thử | CV-062 | S | US-021 |
| CV-064 | Nhân bản đợt 1: chép thông tin, dòng khung, nhóm tự chọn, ràng buộc sang chương trình mới ở Nháp; ghi `clonedFrom` | Nghiệp vụ | CV-066, CV-072 | L | US-022 |
| CV-065 | Hộp thoại nhân bản chương trình | Giao diện | CV-064 | S | US-022 |

### EP-07 — Khung chương trình và nhóm tự chọn

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-066 | Lập `CurriculumItem`, `CurriculumRequisite`, `KnowledgeBlock` | Dữ liệu | CV-032, CV-056 | M | US-023 |
| CV-067 | Thêm, sửa, bỏ dòng khung: chặn trùng học phần, chặn học kỳ vượt số học kỳ, ràng buộc riêng của khung, chép tên và tín chỉ vào dòng (M-5) | Nghiệp vụ | CV-062, CV-066 | L | US-023 |
| CV-068 | Màn hình soạn khung dạng dòng với đủ cột của bảng Excel hiện dùng (DEC-05) | Giao diện | CV-067 | L | US-023 |
| CV-069 | Gom khung theo học kỳ, tính tổng tín chỉ từng học kỳ, cảnh báo học kỳ trống | Nghiệp vụ | CV-066 | S | US-024 |
| CV-070 | Chế độ xem khung theo học kỳ | Giao diện | CV-069 | M | US-024 |
| CV-071 | Bộ lọc theo học kỳ, khối kiến thức, bắt buộc hay tự chọn và ô tìm trong khung | Giao diện | CV-070 | M | US-025 |
| CV-072 | Lập `ElectiveGroup` và liên kết `electiveGroup` trên dòng khung | Dữ liệu | CV-066 | S | US-026 |
| CV-073 | Quy tắc nhóm tự chọn: tối thiểu theo tín chỉ hoặc theo số học phần, chặn dòng bắt buộc, mỗi dòng một nhóm | Nghiệp vụ | CV-072 | M | US-026 |
| CV-074 | Màn hình nhóm tự chọn | Giao diện | CV-073 | M | US-026 |
| CV-075 | Đổi thứ tự dòng, chuyển học kỳ, tính lại tổng tín chỉ | Nghiệp vụ | CV-067 | S | US-027 |
| CV-076 | Thao tác sắp xếp và chuyển học kỳ trên màn hình khung | Giao diện | CV-068, CV-075 | M | US-027 |
| CV-077 | Truy vấn các chương trình và phiên bản đang dùng một học phần | Nghiệp vụ | CV-066 | S | US-028 |
| CV-078 | Hộp danh sách chương trình hiện trước khi sửa học phần và mục "được dùng ở" | Giao diện | CV-034, CV-077 | S | US-028 |

### EP-08 — Kiểm tra nhất quán khung

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-079 | Tính tổng tín chỉ theo SRS mục 7.1, theo học kỳ, theo khối, theo bắt buộc và tự chọn; không lưu kết quả (M-9) | Nghiệp vụ | CV-066, CV-072 | M | US-029 |
| CV-080 | Kiểm thử BR-02, BR-03, EC-01, EC-04 bằng khung mẫu có học phần 0 tín chỉ và nhóm tự chọn dư tín chỉ | Kiểm thử | CV-079 | S | US-029 |
| CV-081 | So tổng tính được với tổng khai báo; chấp nhận kèm `creditMismatchReason`; chấp nhận mất hiệu lực khi chênh lệch đổi | Nghiệp vụ | CV-079 | S | US-030 |
| CV-082 | Cảnh báo lệch tín chỉ và form chấp nhận có lý do | Giao diện | CV-081 | S | US-030 |
| CV-083 | Bộ kiểm nhất quán khung: tiên quyết xếp sau, tiên quyết ngoài khung, trùng lặp, chu trình trên ràng buộc của khung | Nghiệp vụ | CV-047, CV-067 | M | US-031 |
| CV-084 | Màn hình kết quả kiểm tra nhất quán, tách lỗi chặn và cảnh báo | Giao diện | CV-082, CV-083 | M | US-031 |
| CV-085 | Kiểm thử EC-06, EC-09, EC-10, EC-13 và trường hợp khung sạch | Kiểm thử | CV-083 | M | US-031 |

### EP-09 — Nhập và xuất Excel

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-086 | Đặc tả cột của tệp mẫu danh mục học phần và tệp mẫu khung, theo đúng bảng Excel hiện dùng | Tài liệu | — | S | US-032 |
| CV-087 | Sinh và cho tải hai tệp mẫu đợt 1 | Tích hợp | CV-086 | S | US-032 |
| CV-088 | Lập `ImportBatch` | Dữ liệu | CV-011 | S | US-033 |
| CV-089 | Bộ đọc tệp Excel và kiểm cấu trúc cột dùng chung cho mọi loại nhập; sai cấu trúc thì từ chối ngay, nêu cột sai | Tích hợp | CV-086 | M | US-033 |
| CV-090 | Kiểm từng dòng danh mục học phần, phân loại LỖI và CẢNH BÁO, lập báo cáo từng dòng | Nghiệp vụ | CV-036, CV-089 | M | US-033 |
| CV-091 | Kiểm từng dòng khung: mã học phần tồn tại, dòng trùng, học kỳ hợp lệ, chu trình, ký hiệu | Nghiệp vụ | CV-067, CV-083, CV-089 | L | US-034 |
| CV-092 | Màn hình nhập liệu: chọn loại, tải tệp, chạy thử, báo cáo từng dòng, nút xác nhận ghi | Giao diện | CV-090, CV-091 | M | US-034 |
| CV-093 | Ghi toàn bộ hoặc không gì cả trong một giao dịch; kiểm lại cả tệp lúc ghi (S-12); từ chối khi chương trình đã có phiên bản rời Nháp (L-2) | Nghiệp vụ | CV-088, CV-090, CV-091 | L | US-035 |
| CV-094 | Kiểm thử hoàn tác khi lỗi giữa lúc ghi và tệp 1000 dòng dưới 60 giây (NFR-05) | Kiểm thử | CV-093 | M | US-035 |
| CV-095 | Màn hình lịch sử phiên nhập và chi tiết báo cáo của từng phiên, lọc theo phạm vi người xem | Giao diện | CV-088, CV-092 | M | US-036 |
| CV-096 | Xuất khung ra Excel với cùng cột, cùng thứ tự dòng, cùng ký hiệu | Tích hợp | CV-066, CV-086 | M | US-037 |
| CV-097 | Kiểm thử vòng nhập, xuất, nhập lại không phát sinh LỖI | Kiểm thử | CV-093, CV-096 | S | US-037 |
| CV-098 | Ngang: Chạy 9 kịch bản chấp nhận của bậc B2 với khung chương trình mã 1024034, sửa lỗi, chốt phiên bản 0.2 | Kiểm thử | CV-063, CV-085, CV-094 | L | US-037 |

---

## 5. Bậc B3 — Đề cương và chuẩn đầu ra (phiên bản 0.3)

### EP-10 — Đề cương chi tiết

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-099 | Lập `Syllabus` và `WeeklyContent`; mỗi học phần một dòng đề cương dùng chung (DEC-02) | Dữ liệu | CV-032 | M | US-038 |
| CV-100 | Màn hình xem đề cương, mở được từ danh mục và từ khung của mọi chương trình | Giao diện | CV-099, CV-103 | M | US-038 |
| CV-101 | Soạn các phần của đề cương và nội dung theo tuần; loại mã nhúng khỏi văn bản có định dạng; kiểm phạm vi theo nhóm | Nghiệp vụ | CV-027, CV-099 | M | US-039 |
| CV-102 | Trình soạn đề cương có định dạng: in đậm, danh sách, bảng | Giao diện | CV-101 | L | US-039 |
| CV-103 | Liên kết `syllabus` trên dòng khung để ghim bản đề cương vào từng phiên bản (M-1) | Dữ liệu | CV-066, CV-099 | S | US-039 |
| CV-104 | Ô nhập bản tiếng Anh cho mô tả và CLO; chuyển ngôn ngữ hiển thị, đánh dấu phần chưa dịch | Giao diện | CV-102 | M | US-040 |
| CV-105 | Lập `SyllabusAttachment` | Dữ liệu | CV-099 | S | US-041 |
| CV-106 | Tải tệp lên và tải xuống; kiểm loại tệp PDF hoặc Word và dung lượng theo cấu hình | Tích hợp | CV-105 | M | US-041 |
| CV-107 | Mục đính kèm trong màn hình đề cương | Giao diện | CV-100, CV-106 | S | US-041 |

### EP-11 — Chuẩn đầu ra: PLO, CLO, ma trận

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-108 | Lập `PLO` gắn với phiên bản chương trình | Dữ liệu | CV-056 | S | US-042 |
| CV-109 | Thêm, sửa, xóa PLO: mã duy nhất trong phiên bản, xóa thì báo số ô ma trận bị ảnh hưởng | Nghiệp vụ | CV-062, CV-108 | S | US-042 |
| CV-110 | Màn hình PLO của chương trình | Giao diện | CV-109 | M | US-042 |
| CV-111 | Lập `CLO` và `WeeklyContentCLO` | Dữ liệu | CV-099 | S | US-043 |
| CV-112 | Thêm, sửa, xóa CLO: mã duy nhất trong đề cương, xóa thì báo nơi đang dùng | Nghiệp vụ | CV-101, CV-111 | S | US-043 |
| CV-113 | Mục CLO trong trình soạn đề cương | Giao diện | CV-102, CV-112 | M | US-043 |
| CV-114 | Lập `CLOPLOMapping` treo trên dòng khung (M-6) | Dữ liệu | CV-066, CV-108, CV-111 | S | US-044 |
| CV-115 | Quy tắc ma trận theo cặp chương trình và học phần; thang mức đóng góp lấy từ cấu hình | Nghiệp vụ | CV-114 | M | US-044 |
| CV-116 | Lưới ma trận CLO–PLO sửa được cho một học phần trong một chương trình | Giao diện | CV-115 | L | US-044 |
| CV-117 | Màn hình tra cứu PLO, CLO và ma trận toàn chương trình, lọc theo học kỳ và theo PLO | Giao diện | CV-110, CV-115 | M | US-045 |
| CV-118 | Lập `CoursePLOMapping` với cờ `isOverridden` | Dữ liệu | CV-114 | S | US-046 |
| CV-119 | Suy diễn mức học phần–PLO bằng mức cao nhất của các CLO; ghi đè và bỏ ghi đè từng ô | Nghiệp vụ | CV-115, CV-118 | M | US-046 |
| CV-120 | Lưới ma trận học phần–PLO có dấu ghi đè | Giao diện | CV-117, CV-119 | M | US-046 |
| CV-121 | Báo cáo độ bao phủ: PLO chưa có học phần đóng góp, CLO chưa gắn PLO, học phần chưa đóng góp PLO; lọc theo phạm vi | Nghiệp vụ | CV-115 | M | US-047 |
| CV-122 | Màn hình báo cáo độ bao phủ chuẩn đầu ra | Giao diện | CV-121 | M | US-047 |
| CV-123 | Kiểm thử BR-20, EC-41 và trường hợp không còn lỗ hổng | Kiểm thử | CV-121 | S | US-047 |
| CV-124 | Nhân bản đợt 2: chép thêm PLO, ô ma trận, ô ghi đè; đề cương vẫn dùng chung, không chép | Nghiệp vụ | CV-064, CV-114, CV-118 | M | US-048 |
| CV-125 | Kiểm thử bản nhân bản độc lập với nguồn ở PLO và ma trận | Kiểm thử | CV-124 | S | US-048 |

### EP-12 — Công thức điểm và ánh xạ đánh giá–CLO

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-126 | Lập `AssessmentComponent` | Dữ liệu | CV-099 | S | US-049 |
| CV-127 | Quy tắc công thức điểm: tổng trọng số 100%, từng trọng số trong khoảng trên 0 tới 100, mã duy nhất trong đề cương | Nghiệp vụ | CV-101, CV-126 | M | US-049 |
| CV-128 | Bảng công thức điểm trong trình soạn đề cương, hiện chênh lệch so với 100% | Giao diện | CV-102, CV-127 | M | US-049 |
| CV-129 | Thành phần điều kiện bắt buộc có ngưỡng; điểm liệt chung và riêng từng thành phần | Nghiệp vụ | CV-127 | S | US-050 |
| CV-130 | Ô điều kiện, ngưỡng, điểm liệt và câu diễn giải quy tắc | Giao diện | CV-128, CV-129 | S | US-050 |
| CV-131 | Lập `AssessmentCLOMapping` | Dữ liệu | CV-111, CV-126 | S | US-051 |
| CV-132 | Lưới ánh xạ thành phần đánh giá với CLO, có tỷ trọng tùy chọn | Giao diện | CV-128, CV-131 | M | US-051 |
| CV-133 | Kiểm độ bao phủ đánh giá: cảnh báo khi lưu nháp, chặn ở bước ban hành và bước gửi duyệt | Nghiệp vụ | CV-131 | M | US-052 |
| CV-134 | Kiểm thử BR-12..15, EC-39, EC-40, EC-42 | Kiểm thử | CV-127, CV-129, CV-133 | S | US-052 |
| CV-135 | Ngang: Chạy 8 kịch bản chấp nhận của bậc B3, sửa lỗi, chốt phiên bản 0.3 | Kiểm thử | CV-123, CV-125, CV-134 | L | US-052 |

---

## 6. Bậc B4 — Đề xuất thay đổi và phiên bản (phiên bản 0.4)

### EP-13 — Đề xuất: soạn, gửi, thu hồi, xung đột

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-136 | Khóa ghi trực tiếp ở máy chủ lên phiên bản, đề cương, học phần đã ban hành; dẫn người dùng sang form đề xuất | Nghiệp vụ | CV-015, CV-056, CV-099 | L | US-053 |
| CV-137 | Kiểm thử mọi đường ghi lên dữ liệu đã ban hành bị từ chối với cả sáu vai trò | Kiểm thử | CV-136 | M | US-053 |
| CV-138 | Lập `ChangeRequest` và `ChangeItem` | Dữ liệu | CV-032, CV-056 | M | US-054 |
| CV-139 | Tạo, sửa, xóa đề xuất nháp; ghi từng thay đổi với giá trị cũ, giá trị mới và `baseVersion`; chỉ xóa được nháp chưa từng gửi (S-2) | Nghiệp vụ | CV-136, CV-138 | L | US-054 |
| CV-140 | Form đề xuất: chọn loại, chọn đối tượng, soạn thay đổi trên bản sao của dữ liệu đang hiệu lực | Giao diện | CV-139 | L | US-054 |
| CV-141 | Danh sách đề xuất của tôi và danh sách chung, lọc theo trạng thái, loại, nguồn | Giao diện | CV-139 | M | US-054 |
| CV-142 | Ô nguồn phát sinh và số văn bản căn cứ, bắt buộc khi nguồn là Trường; bộ lọc theo nguồn | Giao diện | CV-140 | S | US-055 |
| CV-143 | Lập `ChangeRequestDocument` | Dữ liệu | CV-138 | S | US-056 |
| CV-144 | Mục hồ sơ căn cứ: tải lên theo loại hồ sơ, tải xuống, không bỏ được sau khi đã gửi | Giao diện | CV-106, CV-140, CV-143 | M | US-056 |
| CV-145 | Lập `ApprovalStep` và `ApprovalLevelConfig`, nạp ba cấp duyệt | Dữ liệu | CV-138 | S | US-057 |
| CV-146 | Định tuyến người duyệt: Điều phối theo nhóm phụ trách học phần, Giám đốc theo chương trình chứa học phần, học phần khoa khác đi thẳng cấp 3 | Nghiệp vụ | CV-029, CV-060, CV-077, CV-145 | L | US-057 |
| CV-147 | Máy trạng thái đề xuất DX-01..DX-14, tăng `submissionRound` khi gửi lại, chạy kiểm độ bao phủ trước khi gửi | Nghiệp vụ | CV-133, CV-146 | M | US-057 |
| CV-148 | Hộp xác nhận gửi: danh sách chương trình bị ảnh hưởng và người duyệt dự kiến | Giao diện | CV-140, CV-147 | S | US-057 |
| CV-149 | Kiểm thử định tuyến EC-21, EC-22, EC-23, EC-24 | Kiểm thử | CV-146 | M | US-057 |
| CV-150 | Phát hiện đề xuất mở trên cùng đối tượng; khóa lạc quan theo `baseVersion` lúc chấp thuận cuối | Nghiệp vụ | CV-139, CV-147 | M | US-058 |
| CV-151 | Cảnh báo xung đột trên form đề xuất và màn hình chấp thuận | Giao diện | CV-140, CV-150 | S | US-058 |
| CV-152 | Kiểm thử EC-27: hai đề xuất song song cùng một đề cương | Kiểm thử | CV-150 | S | US-058 |
| CV-153 | Thu hồi đề xuất khi chưa có lượt Đồng ý nào; cấp tự bỏ qua không tính (S-3) | Nghiệp vụ | CV-147 | S | US-059 |
| CV-154 | Nút thu hồi có hộp xác nhận | Giao diện | CV-153 | S | US-059 |
| CV-155 | Loại đề xuất tổ chức và phân công: đi thẳng Phòng Đào tạo, đồng ý thì áp vào dữ liệu tổ chức, không sinh phiên bản (E-4) | Nghiệp vụ | CV-027, CV-060, CV-147 | M | US-060 |
| CV-156 | Form đề xuất tổ chức và phân công cho R2 và R4 | Giao diện | CV-155 | M | US-060 |

### EP-14 — Phê duyệt ba cấp và thông báo

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-157 | Truy vấn hàng đợi theo người duyệt và số ngày đã chờ | Nghiệp vụ | CV-146 | M | US-061 |
| CV-158 | Màn hình hàng đợi chờ duyệt | Giao diện | CV-157 | M | US-061 |
| CV-159 | Tính khác biệt trước và sau theo từng thực thể, kể cả văn bản dài và dòng thêm, bỏ | Nghiệp vụ | CV-139 | M | US-062 |
| CV-160 | Màn hình chi tiết đề xuất với bảng so sánh trước và sau | Giao diện | CV-159 | L | US-062 |
| CV-161 | Xử lý cấp 1: qua cấp khi mọi Điều phối đồng ý; Trả lại và Từ chối đòi lý do từ 20 ký tự (S-6) | Nghiệp vụ | CV-147 | M | US-063 |
| CV-162 | Thanh xử lý Đồng ý, Trả lại, Từ chối dùng chung cho ba cấp | Giao diện | CV-160, CV-161 | M | US-063 |
| CV-163 | Xử lý cấp 2: cần mọi Giám đốc của các chương trình bị chạm; một người trả lại là về Nháp ngay | Nghiệp vụ | CV-161 | M | US-064 |
| CV-164 | Trả lại và từ chối ở cấp 3; gửi lại thì đi từ cấp 1 | Nghiệp vụ | CV-163 | S | US-065 |
| CV-165 | Kiểm thử BR-28, BR-29, EC-26 và chuỗi trả lại rồi gửi lại | Kiểm thử | CV-161, CV-163, CV-164 | M | US-065 |
| CV-166 | Tự bỏ qua lượt duyệt của chính người tạo (L-4, L-5); chặn tự duyệt ở máy chủ | Nghiệp vụ | CV-161, CV-163 | M | US-066 |
| CV-167 | Kiểm thử BR-27, EC-19, EC-20 và trường hợp người tạo là Phòng Đào tạo | Kiểm thử | CV-166 | M | US-066 |
| CV-168 | Lập `Comment` | Dữ liệu | CV-138 | S | US-067 |
| CV-169 | Mục bình luận trên đề xuất; chỉ thêm, không sửa, không xóa | Giao diện | CV-160, CV-168 | M | US-067 |
| CV-170 | Lập `Notification` | Dữ liệu | CV-138 | S | US-068 |
| CV-171 | Sinh thông báo theo sự kiện: tới cấp mới, trả lại, từ chối, duyệt, bình luận | Nghiệp vụ | CV-147, CV-170 | M | US-068 |
| CV-172 | Biểu tượng số thông báo chưa đọc và danh sách thông báo | Giao diện | CV-171 | M | US-068 |
| CV-173 | Dòng lịch sử phê duyệt nhóm theo lần gửi, có nhãn tự bỏ qua, ủy quyền, can thiệp | Giao diện | CV-160, CV-161 | M | US-069 |
| CV-174 | Phòng Đào tạo can thiệp ở cấp 1 và cấp 2: cờ `isOverride`, lý do bắt buộc, ghi người lẽ ra phải duyệt | Nghiệp vụ | CV-161, CV-163 | M | US-070 |
| CV-175 | Bộ lọc đề xuất tồn đọng và nút can thiệp cho R1 | Giao diện | CV-141, CV-174 | S | US-070 |
| CV-176 | Kiểm thử BR-31, EC-25, EC-28 phần can thiệp | Kiểm thử | CV-174 | S | US-070 |

### EP-15 — Ban hành và ảnh chụp bất biến

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-177 | Lập `Semester`, `Cohort`, `CohortVersion` | Dữ liệu | CV-056 | S | US-071 |
| CV-178 | Ban hành khởi tạo: kiểm chặn học phần thiếu đề cương, lỗi nhất quán, CLO chưa bao phủ; ghi số quyết định, học kỳ, khóa; chuyển trạng thái phiên bản và đề cương | Nghiệp vụ | CV-083, CV-099, CV-133, CV-177 | L | US-071 |
| CV-179 | Màn hình ban hành khởi tạo có danh sách lỗi chặn và hộp xác nhận | Giao diện | CV-178 | M | US-071 |
| CV-180 | Màn hình học kỳ và khóa tuyển sinh | Giao diện | CV-177 | S | US-071 |
| CV-181 | Sinh ảnh chụp: chép cả phiên bản nguồn rồi áp `ChangeItem`; đánh số Chính và Phụ; cùng một giao dịch với chấp thuận cuối | Nghiệp vụ | CV-147, CV-177 | L | US-072 |
| CV-182 | Form chấp thuận cuối: số quyết định, ngày ký, học kỳ hiệu lực, khóa áp dụng | Giao diện | CV-162, CV-181 | M | US-072 |
| CV-183 | Kiểm thử đối chiếu ảnh chụp với nguồn và quy tắc đánh số BR-24 | Kiểm thử | CV-181 | M | US-072 |
| CV-184 | Tác vụ kích hoạt đầu học kỳ: chạy lại cho cùng kết quả, kích hoạt theo thứ tự tạo, không bao giờ có hai bản Đang hiệu lực | Nghiệp vụ | CV-181 | M | US-073 |
| CV-185 | Kiểm thử BR-16, BR-22, BR-25, EC-30 bằng cách dời ngày bắt đầu học kỳ | Kiểm thử | CV-184 | M | US-073 |
| CV-186 | Bộ kiểm bất biến: mọi đường ghi bị từ chối; đổi danh mục không làm đổi bản đã chụp | Kiểm thử | CV-136, CV-181 | M | US-074 |
| CV-187 | Ngang: Quy trình sao lưu hằng ngày giữ ít nhất 30 bản, diễn tập phục hồi, kiểm phiên bản đã ban hành còn nguyên sau nâng cấp (NFR-12..14) | Tài liệu | CV-181 | M | US-074 |
| CV-188 | Lan sửa đề cương: một bản đề cương mới và một phiên bản mới cho mỗi chương trình có học phần trong bản Đang hiệu lực hoặc Chờ hiệu lực; lỗi một nơi thì không sinh gì | Nghiệp vụ | CV-077, CV-181 | L | US-075 |
| CV-189 | Danh sách chương trình sẽ sinh phiên bản trên form chấp thuận cuối | Giao diện | CV-182, CV-188 | S | US-075 |
| CV-190 | Kiểm thử EC-38 với học phần dùng ở ba chương trình | Kiểm thử | CV-188 | M | US-075 |
| CV-191 | Đính chính: tạo bản mới từ bản sai, lý do bắt buộc, ghi `correctionOf`, bản sai sang Lịch sử, hỏi chuyển khóa | Nghiệp vụ | CV-181 | M | US-076 |
| CV-192 | Màn hình ban hành đính chính | Giao diện | CV-191 | M | US-076 |
| CV-193 | Đính kèm gắn theo từng bản đề cương; bản đã ban hành chỉ thêm được tệp | Giao diện | CV-107, CV-181 | S | US-077 |

### EP-16 — Tra cứu, so sánh phiên bản, gán khóa

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-194 | So sánh hai phiên bản bất kỳ theo nhóm: thông tin, khung, nhóm tự chọn, PLO, ma trận, đề cương được ghim | Nghiệp vụ | CV-159, CV-181 | L | US-078 |
| CV-195 | Màn hình so sánh hai phiên bản | Giao diện | CV-194 | M | US-078 |
| CV-196 | Màn hình lịch sử phiên bản và chế độ chỉ đọc cho một phiên bản | Giao diện | CV-181 | M | US-079 |
| CV-197 | Gán phiên bản cho khóa từ một học kỳ; hàm xác định phiên bản áp dụng cho một khóa tại một học kỳ | Nghiệp vụ | CV-177, CV-181 | M | US-080 |
| CV-198 | Màn hình gán phiên bản cho khóa | Giao diện | CV-197 | M | US-080 |
| CV-199 | Kiểm thử BR-26 bằng ví dụ SRS mục 6.2.3 với chương trình mã 1024034 | Kiểm thử | CV-197 | S | US-080 |
| CV-200 | Ngang: Chạy 12 kịch bản chấp nhận của bậc B4, sửa lỗi, chốt phiên bản 0.4 | Kiểm thử | CV-137, CV-165, CV-167, CV-185, CV-190, CV-199 | L | US-080 |

---

## 7. Bậc B5 — Sinh viên, điều kiện đăng ký và xét tốt nghiệp (phiên bản 0.5)

### EP-17 — Hồ sơ sinh viên và kết quả học tập

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-201 | Đặc tả cột của tệp mẫu danh sách sinh viên và tệp mẫu kết quả học tập | Tài liệu | CV-086 | S | US-081 |
| CV-202 | Sinh và cho tải hai tệp mẫu đợt 2 | Tích hợp | CV-087, CV-201 | S | US-081 |
| CV-203 | Lập `Student` và `ProgramEnrollment` | Dữ liệu | CV-011, CV-177 | M | US-082 |
| CV-204 | Kiểm dòng và ghi danh sách sinh viên: tạo hoặc cập nhật hồ sơ, ghi danh Chính theo khóa, tự tạo tài khoản R6 (H-2) | Nghiệp vụ | CV-089, CV-093, CV-197, CV-203 | L | US-082 |
| CV-205 | Mở rộng màn hình nhập liệu cho hai loại dữ liệu đợt 2, chỉ R1 thấy | Giao diện | CV-092, CV-204 | S | US-082 |
| CV-206 | Lập `AcademicResult` | Dữ liệu | CV-032, CV-203 | S | US-083 |
| CV-207 | Kiểm dòng và ghi kết quả học tập: ba thang điểm, giữ mọi lần học | Nghiệp vụ | CV-089, CV-093, CV-206 | M | US-083 |
| CV-208 | Kiểm thử EC-36, EC-45 và tệp kết quả 1000 dòng | Kiểm thử | CV-207 | M | US-083 |
| CV-209 | Ghi danh riêng từng sinh viên theo GD-01..GD-04: chuyển chương trình, song ngành, ngoại lệ có căn cứ | Nghiệp vụ | CV-197, CV-203 | M | US-084 |
| CV-210 | Màn hình hồ sơ sinh viên và các ghi danh | Giao diện | CV-209 | M | US-084 |
| CV-211 | Kiểm thử EC-33, EC-34, EC-35, EC-37 | Kiểm thử | CV-209 | S | US-084 |

### EP-18 — Tính điều kiện đăng ký

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-212 | Thuật toán điều kiện đăng ký theo SRS mục 7.3: năm bước, nhóm tương đương, học phần thay thế, đệ quy song hành có tập đã thăm và giới hạn 20 cấp | Nghiệp vụ | CV-050, CV-066, CV-197, CV-206 | L | US-085 |
| CV-213 | Bảng ca kiểm BR-06, BR-07, BR-08, EC-11, EC-12 và đo toàn khung một sinh viên dưới 3 giây (NFR-02) | Kiểm thử | CV-212 | L | US-085 |
| CV-214 | Cột "Đăng ký được?" có màu trên khung; ô chọn sinh viên cho R1 và R3 trong phạm vi | Giao diện | CV-070, CV-212 | M | US-086 |

### EP-19 — Xét tốt nghiệp

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-215 | Lập `GraduationAudit` | Dữ liệu | CV-203 | S | US-087 |
| CV-216 | Thuật toán xét tốt nghiệp theo SRS mục 7.4: bốn kiểm tra, xét riêng từng ghi danh, lưu kết quả lần xét của cán bộ | Nghiệp vụ | CV-079, CV-206, CV-215 | L | US-087 |
| CV-217 | Màn hình kết quả xét tốt nghiệp của một sinh viên | Giao diện | CV-216 | M | US-087 |
| CV-218 | Công nhận tương đương khi xét: theo nhóm, tín chỉ theo học phần đã học, mỗi yêu cầu tính một lần, phần dư là tín chỉ tự do | Nghiệp vụ | CV-050, CV-216 | L | US-088 |
| CV-219 | Kiểm thử BR-09, BR-10, EC-14..18 | Kiểm thử | CV-218 | M | US-088 |
| CV-220 | Danh sách hạng mục còn thiếu chia bốn loại, kèm số đã có và số còn thiếu | Giao diện | CV-217 | M | US-089 |
| CV-221 | Xét lô theo khóa hoặc chương trình; lỗi của một sinh viên không dừng cả lô | Nghiệp vụ | CV-216 | M | US-090 |
| CV-222 | Bảng kết quả xét lô, lọc, xuất Excel | Giao diện | CV-221 | M | US-090 |
| CV-223 | Đo xét lô 500 sinh viên dưới 5 phút (NFR-03) | Kiểm thử | CV-221 | S | US-090 |
| CV-224 | Xét lại khi kết quả học tập của sinh viên đã xét bị đổi; thông báo Phòng Đào tạo khi kết luận đổi | Nghiệp vụ | CV-171, CV-216 | M | US-091 |
| CV-225 | Kiểm thử EC-43 | Kiểm thử | CV-224 | S | US-091 |

### EP-20 — Cổng sinh viên

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-226 | Xác định ghi danh và phiên bản của sinh viên đang đăng nhập; chặn ở máy chủ mọi truy cập dữ liệu của sinh viên khác | Nghiệp vụ | CV-015, CV-197, CV-203 | M | US-092 |
| CV-227 | Trang chủ cổng sinh viên, chuyển giữa chương trình Chính và Song ngành | Giao diện | CV-226 | M | US-092 |
| CV-228 | Kiểm thử NFR-11: sinh viên A gọi dữ liệu sinh viên B | Kiểm thử | CV-226 | S | US-092 |
| CV-229 | Trạng thái từng học phần theo kết quả học tập, kể cả đạt nhờ tương đương | Nghiệp vụ | CV-206, CV-218 | S | US-093 |
| CV-230 | Khung của sinh viên kèm trạng thái và điểm | Giao diện | CV-227, CV-229 | M | US-093 |
| CV-231 | Tính tiến độ: tín chỉ tích lũy theo tổng, theo bắt buộc và tự chọn, theo khối; học lại tính một lần | Nghiệp vụ | CV-079, CV-206 | M | US-094 |
| CV-232 | Màn hình tiến độ học tập | Giao diện | CV-227, CV-231 | M | US-094 |
| CV-233 | Danh sách học phần đủ điều kiện và lý do của học phần chưa đủ | Giao diện | CV-212, CV-227 | M | US-095 |
| CV-234 | Sinh viên xem bản đề cương được ghim và công thức điểm; không lộ nháp, đề xuất, bình luận | Giao diện | CV-100, CV-226 | M | US-096 |
| CV-235 | Bố cục co giãn từ 360px cho mọi màn hình của cổng sinh viên | Giao diện | CV-227, CV-230, CV-232, CV-233, CV-234 | L | US-097 |
| CV-236 | Kiểm ở 360px và trên Chrome, Firefox, Edge (NFR-17, NFR-26) | Kiểm thử | CV-235 | M | US-097 |

### EP-21 — API cho dDUT

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-237 | Lập `IntegrationClient`, chỉ lưu `keyHash` | Dữ liệu | — | S | US-098 |
| CV-238 | Xác thực khóa truy cập, giới hạn tần suất theo `rateLimit`, ghi nhật ký từng lời gọi kèm mã sinh viên | Nghiệp vụ | CV-007, CV-237 | M | US-098 |
| CV-239 | Màn hình quản lý bên tích hợp: cấp khóa hiện một lần, khóa và mở lại | Giao diện | CV-238 | S | US-098 |
| CV-240 | Ba đường dẫn của SRS mục 8 cho chương trình của sinh viên, một phiên bản cụ thể, đề cương của học phần | Tích hợp | CV-099, CV-197, CV-238 | M | US-099 |
| CV-241 | Ba đường dẫn của SRS mục 8 cho tiến độ, học phần đủ điều kiện, xét tốt nghiệp | Tích hợp | CV-212, CV-216, CV-231, CV-238 | M | US-100 |
| CV-242 | Kiểm thử đối chiếu kết quả API với cổng sinh viên trên cùng dữ liệu | Kiểm thử | CV-240, CV-241 | M | US-100 |
| CV-243 | Tài liệu API theo API-02 cho đủ sáu đường dẫn | Tài liệu | CV-240, CV-241 | M | US-101 |
| CV-244 | Kiểm thử phản hồi thật khớp tài liệu API | Kiểm thử | CV-243 | S | US-101 |
| CV-245 | Ngang: Chạy 9 kịch bản chấp nhận của bậc B5, sửa lỗi, chốt phiên bản 0.5 | Kiểm thử | CV-208, CV-213, CV-219, CV-228, CV-236, CV-242 | L | US-101 |

---

## 8. Bậc B6 — Tích hợp trường, báo cáo và hoàn thiện (phiên bản 1.0)

### EP-22 — Đồng bộ cơ sở dữ liệu có sẵn

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-246 | Lập `SyncLog` và nơi lưu cấu hình kết nối, lịch chạy (E-7) | Dữ liệu | — | S | US-102 |
| CV-247 | Kết nối chỉ đọc tới cơ sở dữ liệu có sẵn và chức năng kiểm tra kết nối | Tích hợp | CV-246 | M | US-102 |
| CV-248 | Màn hình cấu hình kết nối và lịch đồng bộ; không hiện lại mật khẩu kết nối | Giao diện | CV-247 | M | US-102 |
| CV-249 | Ngang: Triển khai lên máy chủ của Khoa, tài liệu cài đặt, hướng dẫn sử dụng theo từng vai trò (NFR-25, NFR-27) | Tài liệu | — | L | US-102 |
| CV-250 | Ngang: Đo 200 người dùng đồng thời và thiết lập theo dõi thời gian hoạt động (NFR-04, NFR-15) | Kiểm thử | CV-249 | M | US-102 |
| CV-251 | Tác vụ đồng bộ theo lịch theo DB-01..DB-04: đọc sinh viên và kết quả, một giao dịch, hoàn tác khi lỗi, không chạy chồng, quá hạn thì Thất bại | Tích hợp | CV-203, CV-206, CV-247 | L | US-103 |
| CV-252 | Màn hình nhật ký đồng bộ, lọc theo trạng thái, chạy lại thủ công | Giao diện | CV-251 | M | US-103 |
| CV-253 | Kiểm thử EC-49 bằng cách ngắt kết nối giữa lúc đồng bộ | Kiểm thử | CV-251 | M | US-103 |
| CV-254 | Quy tắc ưu tiên nguồn theo SRS mục 8.2; đếm `conflictCount`; cảnh báo khi Excel đụng bản ghi có nguồn là cơ sở dữ liệu có sẵn | Nghiệp vụ | CV-207, CV-251 | M | US-104 |
| CV-255 | Kiểm thử EC-48 theo cả hai chiều ưu tiên | Kiểm thử | CV-254 | S | US-104 |

### EP-23 — Báo cáo và xuất kiểm định

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-256 | Đối sánh hai chương trình: phần chung, phần riêng, cặp tương đương, khác học kỳ và tính chất | Nghiệp vụ | CV-050, CV-066 | M | US-105 |
| CV-257 | Màn hình đối sánh và xuất Excel | Giao diện | CV-256 | M | US-105 |
| CV-258 | Phân bổ tín chỉ theo khối, học kỳ, loại học phần; đánh dấu khối lệch `requiredCredits` | Nghiệp vụ | CV-079 | S | US-106 |
| CV-259 | Màn hình báo cáo phân bổ tín chỉ và xuất Excel | Giao diện | CV-258 | M | US-106 |
| CV-260 | Xuất ma trận CLO–PLO và ma trận học phần–PLO ra Excel, giữ trọng số số thực trực tiếp theo FR-41/BR-21, không I–R–M hay chú thích ghi đè (chốt 2026-10-26) | Tích hợp | CV-119 | M | US-107 |
| CV-261 | Bộ xuất kiểm định của một phiên bản: khung, PLO, hai ma trận, phân bổ tín chỉ, đề cương kèm công thức điểm, trang lỗ hổng | Tích hợp | CV-096, CV-121, CV-258, CV-260 | L | US-108 |
| CV-262 | Thống kê đề xuất theo trạng thái, loại, nguồn và thời gian xử lý trung bình từng cấp; giới hạn theo phạm vi | Nghiệp vụ | CV-147 | S | US-109 |
| CV-263 | Màn hình thống kê đề xuất | Giao diện | CV-262 | M | US-109 |

### EP-24 — Trực quan hóa và xuất bản

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-264 | Đồ thị quan hệ học phần xếp theo học kỳ, làm nổi chuỗi phụ thuộc của một nút | Giao diện | CV-044, CV-066 | L | US-110 |
| CV-265 | Xuất một phiên bản chương trình ra PDF theo mẫu tổng quát; bản Nháp có dấu "BẢN NHÁP" | Tích hợp | CV-181 | L | US-111 |
| CV-266 | Dòng thời gian phiên bản, có nhãn đính chính | Giao diện | CV-195, CV-196 | M | US-112 |
| CV-267 | Gom cảnh báo của một chương trình từ các bộ kiểm đã có | Nghiệp vụ | CV-083, CV-121, CV-133 | M | US-113 |
| CV-268 | Bảng sức khỏe chương trình, mỗi dòng dẫn tới màn hình xử lý | Giao diện | CV-267 | M | US-113 |

### EP-25 — Tiện ích quy trình duyệt

| Mã | Việc | Loại | Phụ thuộc | Cỡ | Story |
|---|---|---|---|---|---|
| CV-269 | Lập `ApprovalDelegation` | Dữ liệu | CV-145 | S | US-114 |
| CV-270 | Ủy quyền theo UQ-01..UQ-04: hàng đợi và xử lý tính cả người được ủy quyền, hết hạn và thu hồi tự động, vẫn chặn tự duyệt | Nghiệp vụ | CV-157, CV-161, CV-269 | M | US-114 |
| CV-271 | Màn hình ủy quyền của tôi | Giao diện | CV-270 | M | US-114 |
| CV-272 | Kiểm thử ủy quyền hết hạn, thu hồi, tài khoản bị vô hiệu hóa | Kiểm thử | CV-270 | S | US-114 |
| CV-273 | Gửi email qua dịch vụ email ngoài; lỗi gửi không làm hỏng thao tác duyệt; cờ `emailSent`; người dùng tắt nhận được | Tích hợp | CV-171 | M | US-115 |
| CV-274 | Kiểm thử dịch vụ email không phản hồi (L-6) | Kiểm thử | CV-273 | S | US-115 |
| CV-275 | Tác vụ nhắc hạn theo số ngày và chu kỳ trong cấu hình; bật tắt được | Nghiệp vụ | CV-157, CV-171 | M | US-116 |
| CV-276 | Kiểm thử nhắc hạn: quá hạn, đã xử lý, tính năng tắt | Kiểm thử | CV-275 | S | US-116 |
| CV-277 | Ngang: Chạy 9 kịch bản chấp nhận của bậc B6, sửa lỗi, chốt phiên bản 1.0 | Kiểm thử | CV-250, CV-253, CV-255, CV-272, CV-274, CV-276 | L | US-116 |

---

## 9. Việc ngang

Các việc dưới đây không thuộc riêng story nào. Bỏ một việc ngang không làm story nào "chưa xong" trên giấy, nên chúng được liệt kê riêng để không bị sót khi xếp sprint.

| Mã | Bậc | Việc | Cỡ | Gắn vào story |
|---|---|---|---|---|
| CV-004 | B1 | Dựng bộ khung một khối phân module, tài liệu quy ước đặt tên, cơ chế nâng cấp lược đồ theo từng bước, tệp cấu hình tham số nghiệp vụ (NFR-21..24) | L | US-001 |
| CV-053 | B1 | Chạy 7 kịch bản chấp nhận của bậc B1 trên Chrome, Firefox, Edge (NFR-26), sửa lỗi, chốt phiên bản 0.1 | L | US-017 |
| CV-098 | B2 | Chạy 9 kịch bản chấp nhận của bậc B2 với khung chương trình mã 1024034, sửa lỗi, chốt phiên bản 0.2 | L | US-037 |
| CV-135 | B3 | Chạy 8 kịch bản chấp nhận của bậc B3, sửa lỗi, chốt phiên bản 0.3 | L | US-052 |
| CV-187 | B4 | Quy trình sao lưu hằng ngày giữ ít nhất 30 bản, diễn tập phục hồi, kiểm phiên bản đã ban hành còn nguyên sau nâng cấp (NFR-12..14) | M | US-074 |
| CV-200 | B4 | Chạy 12 kịch bản chấp nhận của bậc B4, sửa lỗi, chốt phiên bản 0.4 | L | US-080 |
| CV-245 | B5 | Chạy 9 kịch bản chấp nhận của bậc B5, sửa lỗi, chốt phiên bản 0.5 | L | US-101 |
| CV-249 | B6 | Triển khai lên máy chủ của Khoa, tài liệu cài đặt, hướng dẫn sử dụng theo từng vai trò (NFR-25, NFR-27) | L | US-102 |
| CV-250 | B6 | Đo 200 người dùng đồng thời và thiết lập theo dõi thời gian hoạt động (NFR-04, NFR-15) | M | US-102 |
| CV-277 | B6 | Chạy 9 kịch bản chấp nhận của bậc B6, sửa lỗi, chốt phiên bản 1.0 | L | US-116 |

---

## 10. Bảng truy vết

### 10.1. Story → việc

| Story | Tên story | Việc | Điểm |
|---|---|---|---|
| US-001 | Đăng nhập và kết thúc phiên | CV-001, CV-002, CV-003, CV-004, CV-005 | 10 |
| US-002 | Ghi nhật ký bất biến cho mọi thay đổi | CV-006, CV-007, CV-008 | 4 |
| US-003 | Tra cứu nhật ký hệ thống | CV-009, CV-010 | 3 |
| US-004 | Quản lý tài khoản người dùng | CV-011, CV-012, CV-013 | 5 |
| US-005 | Gán vai trò và phạm vi quyền (đợt 1) | CV-014, CV-015, CV-016, CV-017, CV-018 | 11 |
| US-006 | Nhật ký thay đổi phân quyền | CV-019, CV-020 | 2 |
| US-007 | Quản lý cây đơn vị | CV-021, CV-022, CV-023 | 4 |
| US-008 | Quản lý nhóm chuyên môn | CV-024, CV-025 | 3 |
| US-009 | Gán giảng viên vào nhiều nhóm chuyên môn | CV-026, CV-027, CV-028 | 5 |
| US-010 | Chỉ định Điều phối nhóm chuyên môn | CV-029, CV-030, CV-031 | 4 |
| US-011 | Tra cứu danh mục học phần | CV-032, CV-033, CV-034, CV-035 | 6 |
| US-012 | Thêm và sửa học phần | CV-036, CV-037, CV-038 | 5 |
| US-013 | Ghi nhận học phần của khoa khác | CV-039, CV-040 | 2 |
| US-014 | Đổi trạng thái sử dụng học phần | CV-041, CV-042, CV-043 | 4 |
| US-015 | Khai báo quan hệ giữa các học phần | CV-044, CV-045, CV-046 | 5 |
| US-016 | Chặn chu trình học trước và tiên quyết | CV-047, CV-048, CV-049 | 4 |
| US-017 | Khai báo nhóm học phần tương đương | CV-050, CV-051, CV-052, CV-053 | 9 |
| US-018 | Tra cứu danh sách chương trình đào tạo | CV-054, CV-055 | 3 |
| US-019 | Soạn thông tin chương trình đào tạo | CV-056, CV-057, CV-058 | 6 |
| US-020 | Phân công Giám đốc CTĐT | CV-059, CV-060, CV-061 | 4 |
| US-021 | Phạm vi quyền theo chương trình được phân công (đợt 2) | CV-062, CV-063 | 3 |
| US-022 | Nhân bản chương trình cho khóa mới (đợt 1) | CV-064, CV-065 | 5 |
| US-023 | Soạn dòng khung chương trình | CV-066, CV-067, CV-068 | 10 |
| US-024 | Xem khung theo học kỳ | CV-069, CV-070 | 3 |
| US-025 | Lọc và tìm trong khung | CV-071 | 2 |
| US-026 | Khai báo nhóm học phần tự chọn | CV-072, CV-073, CV-074 | 5 |
| US-027 | Sắp xếp dòng và chuyển học phần giữa các học kỳ | CV-075, CV-076 | 3 |
| US-028 | Xem các chương trình đang dùng một học phần | CV-077, CV-078 | 2 |
| US-029 | Tính tổng tín chỉ theo cấu trúc | CV-079, CV-080 | 3 |
| US-030 | Cảnh báo lệch tổng tín chỉ và chấp nhận có lý do | CV-081, CV-082 | 2 |
| US-031 | Kiểm tra tiên quyết xếp sau, chu trình và trùng lặp | CV-083, CV-084, CV-085 | 6 |
| US-032 | Tải tệp mẫu nhập liệu (đợt 1) | CV-086, CV-087 | 2 |
| US-033 | Nhập danh mục học phần từ Excel (đợt 1) | CV-088, CV-089, CV-090 | 5 |
| US-034 | Nhập khung chương trình từ Excel: chạy thử | CV-091, CV-092 | 6 |
| US-035 | Xác nhận ghi: toàn bộ hoặc không gì cả | CV-093, CV-094 | 6 |
| US-036 | Xem lịch sử phiên nhập liệu | CV-095 | 2 |
| US-037 | Xuất khung chương trình ra Excel | CV-096, CV-097, CV-098 | 7 |
| US-038 | Tra cứu đề cương dùng chung của học phần | CV-099, CV-100 | 4 |
| US-039 | Soạn nội dung đề cương | CV-101, CV-102, CV-103 | 7 |
| US-040 | Đề cương song ngữ | CV-104 | 2 |
| US-041 | Đính kèm bản đề cương đã ký (đợt 1) | CV-105, CV-106, CV-107 | 4 |
| US-042 | Soạn PLO của chương trình | CV-108, CV-109, CV-110 | 4 |
| US-043 | Soạn CLO của học phần | CV-111, CV-112, CV-113 | 4 |
| US-044 | Soạn ma trận CLO–PLO theo cặp chương trình, học phần | CV-114, CV-115, CV-116 | 7 |
| US-045 | Tra cứu PLO, CLO và ma trận | CV-117 | 2 |
| US-046 | Ma trận học phần–PLO suy diễn và ghi đè | CV-118, CV-119, CV-120 | 5 |
| US-047 | Cảnh báo lỗ hổng chuẩn đầu ra | CV-121, CV-122, CV-123 | 5 |
| US-048 | Nhân bản chương trình kèm PLO và ma trận (đợt 2) | CV-124, CV-125 | 3 |
| US-049 | Khai báo thành phần đánh giá và trọng số | CV-126, CV-127, CV-128 | 5 |
| US-050 | Thành phần điều kiện và điểm liệt | CV-129, CV-130 | 2 |
| US-051 | Ánh xạ thành phần đánh giá với CLO | CV-131, CV-132 | 3 |
| US-052 | Cảnh báo CLO chưa được đánh giá | CV-133, CV-134, CV-135 | 7 |
| US-053 | Khóa sửa trực tiếp dữ liệu đã ban hành | CV-136, CV-137 | 6 |
| US-054 | Tạo, sửa, xóa đề xuất nháp | CV-138, CV-139, CV-140, CV-141 | 12 |
| US-055 | Ghi nguồn phát sinh của đề xuất | CV-142 | 1 |
| US-056 | Đính kèm hồ sơ căn cứ | CV-143, CV-144 | 3 |
| US-057 | Gửi duyệt và định tuyến người duyệt | CV-145, CV-146, CV-147, CV-148, CV-149 | 10 |
| US-058 | Cảnh báo xung đột giữa các đề xuất | CV-150, CV-151, CV-152 | 4 |
| US-059 | Thu hồi đề xuất | CV-153, CV-154 | 2 |
| US-060 | Đề xuất thay đổi tổ chức và phân công | CV-155, CV-156 | 4 |
| US-061 | Hàng đợi đề xuất chờ duyệt | CV-157, CV-158 | 4 |
| US-062 | Xem đề xuất và bảng so sánh trước–sau | CV-159, CV-160 | 6 |
| US-063 | Xử lý ở cấp chuyên môn (cấp 1) | CV-161, CV-162 | 4 |
| US-064 | Xử lý ở cấp chương trình (cấp 2) | CV-163 | 2 |
| US-065 | Trả lại hoặc từ chối ở cấp cuối | CV-164, CV-165 | 3 |
| US-066 | Tự động bỏ qua cấp của chính người tạo | CV-166, CV-167 | 4 |
| US-067 | Bình luận trên đề xuất | CV-168, CV-169 | 3 |
| US-068 | Thông báo trong ứng dụng | CV-170, CV-171, CV-172 | 5 |
| US-069 | Lịch sử phê duyệt của đề xuất | CV-173 | 2 |
| US-070 | Phòng Đào tạo can thiệp ở cấp dưới | CV-174, CV-175, CV-176 | 4 |
| US-071 | Ban hành phiên bản đầu tiên của chương trình | CV-177, CV-178, CV-179, CV-180 | 8 |
| US-072 | Chấp thuận cuối và sinh phiên bản mới | CV-181, CV-182, CV-183 | 8 |
| US-073 | Kích hoạt phiên bản vào đầu học kỳ | CV-184, CV-185 | 4 |
| US-074 | Phiên bản đã ban hành là bất biến | CV-186, CV-187 | 4 |
| US-075 | Sửa đề cương dùng chung sinh phiên bản ở mọi chương trình | CV-188, CV-189, CV-190 | 7 |
| US-076 | Ban hành phiên bản đính chính | CV-191, CV-192 | 4 |
| US-077 | Đính kèm đề cương đã ký theo phiên bản (đợt 2) | CV-193 | 1 |
| US-078 | So sánh hai phiên bản | CV-194, CV-195 | 6 |
| US-079 | Xem lại phiên bản lịch sử | CV-196 | 2 |
| US-080 | Gán phiên bản cho khóa tuyển sinh | CV-197, CV-198, CV-199, CV-200 | 9 |
| US-081 | Tải tệp mẫu sinh viên và kết quả học tập (đợt 2) | CV-201, CV-202 | 2 |
| US-082 | Nhập danh sách sinh viên và tự tạo tài khoản (đợt 2) | CV-203, CV-204, CV-205 | 7 |
| US-083 | Nhập kết quả học tập (đợt 2) | CV-206, CV-207, CV-208 | 5 |
| US-084 | Ghi danh riêng cho từng sinh viên và các ngoại lệ | CV-209, CV-210, CV-211 | 5 |
| US-085 | Tính điều kiện đăng ký của từng học phần | CV-212, CV-213 | 8 |
| US-086 | Cột "Đăng ký được?" trên khung | CV-214 | 2 |
| US-087 | Xét điều kiện tốt nghiệp cho một sinh viên | CV-215, CV-216, CV-217 | 7 |
| US-088 | Công nhận học phần tương đương khi xét | CV-218, CV-219 | 6 |
| US-089 | Danh sách hạng mục còn thiếu | CV-220 | 2 |
| US-090 | Xét tốt nghiệp hàng loạt | CV-221, CV-222, CV-223 | 5 |
| US-091 | Tính lại khi điểm bị sửa sau lúc xét | CV-224, CV-225 | 3 |
| US-092 | Sinh viên xem đúng phiên bản chương trình của mình | CV-226, CV-227, CV-228 | 5 |
| US-093 | Sinh viên xem khung kèm trạng thái từng học phần | CV-229, CV-230 | 3 |
| US-094 | Sinh viên xem tiến độ học tập | CV-231, CV-232 | 4 |
| US-095 | Sinh viên xem học phần đủ điều kiện và lý do | CV-233 | 2 |
| US-096 | Sinh viên xem đề cương và công thức điểm | CV-234 | 2 |
| US-097 | Cổng sinh viên dùng được trên điện thoại | CV-235, CV-236 | 6 |
| US-098 | Cấp và quản lý khóa truy cập cho bên tích hợp | CV-237, CV-238, CV-239 | 4 |
| US-099 | API chương trình và đề cương | CV-240 | 2 |
| US-100 | API tiến độ, điều kiện đăng ký và xét tốt nghiệp | CV-241, CV-242 | 4 |
| US-101 | Tài liệu API theo chuẩn OpenAPI | CV-243, CV-244, CV-245 | 7 |
| US-102 | Cấu hình kết nối và lịch đồng bộ | CV-246, CV-247, CV-248, CV-249, CV-250 | 11 |
| US-103 | Đồng bộ theo lịch và nhật ký đồng bộ | CV-251, CV-252, CV-253 | 8 |
| US-104 | Quy tắc ưu tiên khi hai nguồn mâu thuẫn | CV-254, CV-255 | 3 |
| US-105 | Đối sánh hai chương trình | CV-256, CV-257 | 4 |
| US-106 | Báo cáo phân bổ tín chỉ | CV-258, CV-259 | 3 |
| US-107 | Xuất ma trận chuẩn đầu ra ra Excel | CV-260 | 2 |
| US-108 | Xuất bộ báo cáo kiểm định | CV-261 | 4 |
| US-109 | Thống kê đề xuất thay đổi | CV-262, CV-263 | 3 |
| US-110 | Xem đồ thị quan hệ học phần | CV-264 | 4 |
| US-111 | Xuất chương trình ra PDF | CV-265 | 4 |
| US-112 | Xem dòng thời gian phiên bản | CV-266 | 2 |
| US-113 | Bảng sức khỏe chương trình | CV-267, CV-268 | 4 |
| US-114 | Ủy quyền phê duyệt | CV-269, CV-270, CV-271, CV-272 | 6 |
| US-115 | Gửi thông báo qua email | CV-273, CV-274 | 3 |
| US-116 | Nhắc hạn đề xuất tồn đọng | CV-275, CV-276, CV-277 | 7 |

### 10.2. Thực thể → việc lập thực thể

Mỗi thực thể của từ điển dữ liệu được lập ở đúng một việc loại Dữ liệu. Bậc ghi ở đây là bậc thực thể xuất hiện lần đầu.

| Thực thể | Việc lập | Bậc | Story |
|---|---|---|---|
| `AcademicResult` | CV-206 | B5 | US-083 |
| `ApprovalDelegation` | CV-269 | B6 | US-114 |
| `ApprovalLevelConfig` | CV-145 | B4 | US-057 |
| `ApprovalStep` | CV-145 | B4 | US-057 |
| `AssessmentCLOMapping` | CV-131 | B3 | US-051 |
| `AssessmentComponent` | CV-126 | B3 | US-049 |
| `AuditLog` | CV-006 | B1 | US-002 |
| `CLO` | CV-111 | B3 | US-043 |
| `CLOPLOMapping` | CV-114 | B3 | US-044 |
| `ChangeItem` | CV-138 | B4 | US-054 |
| `ChangeRequest` | CV-138 | B4 | US-054 |
| `ChangeRequestDocument` | CV-143 | B4 | US-056 |
| `Cohort` | CV-177 | B4 | US-071 |
| `CohortVersion` | CV-177 | B4 | US-071 |
| `Comment` | CV-168 | B4 | US-067 |
| `Course` | CV-032 | B1 | US-011 |
| `CoursePLOMapping` | CV-118 | B3 | US-046 |
| `CourseRelation` | CV-044 | B1 | US-015 |
| `CurriculumItem` | CV-066 | B2 | US-023 |
| `CurriculumRequisite` | CV-066 | B2 | US-023 |
| `ElectiveGroup` | CV-072 | B2 | US-026 |
| `EquivalentCourseGroup` | CV-050 | B1 | US-017 |
| `GraduationAudit` | CV-215 | B5 | US-087 |
| `ImportBatch` | CV-088 | B2 | US-033 |
| `IntegrationClient` | CV-237 | B5 | US-098 |
| `KnowledgeBlock` | CV-066 | B2 | US-023 |
| `Notification` | CV-170 | B4 | US-068 |
| `OrgUnit` | CV-021 | B1 | US-007 |
| `PLO` | CV-108 | B3 | US-042 |
| `Permission` | CV-014 | B1 | US-005 |
| `Program` | CV-056 | B2 | US-019 |
| `ProgramDirectorAssignment` | CV-059 | B2 | US-020 |
| `ProgramEnrollment` | CV-203 | B5 | US-082 |
| `ProgramVersion` | CV-056 | B2 | US-019 |
| `Role` | CV-014 | B1 | US-005 |
| `RoleAssignment` | CV-014 | B1 | US-005 |
| `RolePermission` | CV-014 | B1 | US-005 |
| `Semester` | CV-177 | B4 | US-071 |
| `Student` | CV-203 | B5 | US-082 |
| `SubjectGroup` | CV-024 | B1 | US-008 |
| `SubjectGroupMember` | CV-026 | B1 | US-009 |
| `Syllabus` | CV-099 | B3 | US-038 |
| `SyllabusAttachment` | CV-105 | B3 | US-041 |
| `SyncLog` | CV-246 | B6 | US-102 |
| `User` | CV-001 | B1 | US-001 |
| `WeeklyContent` | CV-099 | B3 | US-038 |
| `WeeklyContentCLO` | CV-111 | B3 | US-043 |

---

## 11. Điểm còn hở

Mỗi điểm là một chỗ tài liệu nguồn bỏ trống hoặc một quy ước riêng của tài liệu này. Lựa chọn tạm đã được dùng để lập bảng; đổi lựa chọn thì phải sửa các việc ở cột "Ảnh hưởng tới".

| Mã | Vấn đề | Lựa chọn tạm | Ảnh hưởng tới | Phụ thuộc vào |
|---|---|---|---|---|
| K-1 | Sáu loại việc được giao không có loại cho hạ tầng và vận hành: dựng bộ khung ứng dụng, sao lưu và phục hồi, triển khai lên máy chủ Khoa | Xếp ba việc này vào loại Tài liệu, vì thứ bàn giao kiểm được là quy ước, quy trình và hướng dẫn. Cỡ L là ước lượng thô, chỉnh sau sprint đầu (K-3) | CV-004, CV-187, CV-249; tải của sprint đầu và sprint cuối | Không cần hỏi; công nghệ ở `docs/design/tech-stack.md` |
| K-2 | Quy ước "mỗi việc phục vụ đúng một story" không khớp với việc ngang: chạy kịch bản chấp nhận của cả bậc, đo hiệu năng, sao lưu | Gắn việc ngang vào story đầu hoặc cuối của phần liên quan và đánh dấu "Ngang:". Một story được coi là xong khi các việc không ngang của nó xong | Mục 9; cách đọc cột Điểm ở mục 10.1 | Không cần hỏi |
| K-3 | Cỡ S, M, L chưa được hiệu chỉnh bằng số liệu thật: chưa có nhóm, chưa có sprint nào đã chạy | Dùng tỷ lệ 1 : 2 : 4 và không quy ra giờ. Sau sprint đầu, đo lại và chỉnh hệ số trong kế hoạch sprint, không sửa cỡ từng việc | Mục 2.2, 2.3; `docs/planning/sprint-plan.md` | Số liệu của sprint đầu |
| K-4 | `Semester` và `Cohort` chỉ được lập ở B4 (CV-177) trong khi `ProgramVersion.effectiveSemester` đã có từ B2 (CV-056) | Chấp nhận: ở B2 và B3 mọi phiên bản đều ở Nháp nên `effectiveSemester` còn trống. Phương án khác là dời CV-177 và CV-180 về B2 | CV-056, CV-177, CV-180 | Không cần hỏi; đổi nếu B2 cần hiển thị học kỳ |
| K-5 | Tham số nghiệp vụ (thời hạn phiên, thang mức đóng góp, dung lượng tệp, số ngày nhắc hạn) và cấu hình đồng bộ không có thực thể trong từ điển dữ liệu (E-7) | Tham số nghiệp vụ nằm trong tệp cấu hình dựng ở CV-004; cấu hình kết nối và lịch đồng bộ có nơi lưu riêng dựng ở CV-246, sửa được trên màn hình | CV-004, CV-115, CV-106, CV-246, CV-275 | E-7 |
| K-6 | Nơi lưu tệp đính kèm và hồ sơ căn cứ (`SyllabusAttachment.filePath`, `ChangeRequestDocument.filePath`) chưa được nêu | Một cơ chế tải lên và tải xuống dùng chung, dựng ở CV-106, dùng lại ở CV-144. Tệp nằm trên máy chủ của Khoa cùng với ứng dụng và thuộc phạm vi sao lưu của CV-187 | CV-106, CV-144, CV-187 | Dung lượng máy chủ Khoa |
| K-7 | Bốn việc cần chạy theo lịch (kích hoạt đầu học kỳ, đồng bộ, nhắc hạn, hết hạn ủy quyền) nhưng chưa có mô tả cơ chế chạy định kỳ | Một cơ chế chạy định kỳ dùng chung nằm trong khối ứng dụng, dựng lần đầu ở CV-184; ba việc sau dùng lại. Mỗi tác vụ phải chạy lại được mà không sinh kết quả kép | CV-184, CV-251, CV-270, CV-275 | Không cần hỏi; cơ chế ở `docs/design/tech-stack.md` |
| K-8 | Chưa có bộ dữ liệu mẫu cho kiểm thử: khung thật của chương trình mã 1024034, 500 sinh viên kèm kết quả học tập, tệp 1000 dòng | Khung lấy từ tệp Excel Khoa đang dùng; sinh viên và kết quả học tập là dữ liệu giả tự sinh. Việc chuẩn bị dữ liệu nằm trong các việc chạy kịch bản chấp nhận của từng bậc | CV-053, CV-098, CV-200, CV-245, CV-223, CV-094 | Khoa cung cấp tệp Excel khung; Phòng Đào tạo cho phép dùng dữ liệu thật hay không |
