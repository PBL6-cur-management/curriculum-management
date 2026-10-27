# DANH MỤC MÀN HÌNH v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-12 |
| Đi kèm | `docs/planning/user-stories.md` (US-001..US-116), `docs/planning/task-breakdown.md` (các việc loại Giao diện), `docs/design/data-dictionary.md` |
| Nguồn | `docs/requirement/REQUIREMENTS.md` mục 3.3, 3.4 (phạm vi và ma trận quyền); `docs/Bo_so_do_Use_Case_CTDT/Thuyet_minh_Use_Case.md` |
| Phạm vi | Mọi màn hình của ứng dụng web ở mức logic: màn hình nào, ai vào được, hiện gì, làm được gì. Không vẽ bố cục, không chọn thư viện giao diện |
| Điểm còn hở của tài liệu này | G-1..G-8, mục 7 |

---

## 1. Quy ước

| Mục | Quy ước |
|---|---|
| Mã | MH-01..MH-62. Một màn hình là một nơi người dùng tới được và có mục đích riêng; hộp xác nhận và thông báo lỗi không tính là màn hình |
| Vai trò | R1 Phòng Đào tạo · R2 Ban lãnh đạo khoa · R3 Giám đốc CTĐT · R4 Điều phối nhóm chuyên môn · R5 Giảng viên · R6 Sinh viên |
| Mức truy cập | **T**: làm được mọi thao tác của màn hình · **P**: làm được thao tác ghi, nhưng chỉ trên dữ liệu trong phạm vi được phân công · **X**: chỉ xem. Vai trò không được liệt kê thì không vào được, kể cả khi gõ thẳng địa chỉ: máy chủ từ chối |
| Phạm vi dữ liệu | Cả ba mức đều bị giới hạn bởi phạm vi của vai trò theo SRS mục 3.3: R2 dữ liệu thuộc khoa; R3 chương trình được phân công; R4 học phần thuộc nhóm mình; R5 học phần thuộc các nhóm mình là thành viên; R6 phiên bản áp dụng cho khóa mình |
| Dữ liệu chính | Tên thực thể trong từ điển dữ liệu mà màn hình đọc hoặc ghi. Giá trị tính ra (tổng tín chỉ, tiến độ, điều kiện đăng ký) không phải thực thể nên không liệt kê |
| Bậc | Bậc mà màn hình xuất hiện lần đầu. Phần được thêm ở bậc sau ghi trong cột Thao tác bằng cụm "Từ Bx:" |
| Quyền sửa trước và sau B4 | Ở B1..B3 người có ô `Đ` trong ma trận SRS sửa trực tiếp trong phạm vi (H-4). Từ B4, dữ liệu đã ban hành không sửa trực tiếp được: nút sửa dẫn sang MH-39 |
| Yêu cầu chung của mọi màn hình | Tiếng Việt có dấu (NFR-16); danh sách dài có phân trang, tìm kiếm, sắp xếp (NFR-18); lỗi nêu nguyên nhân và cách xử lý (NFR-19); thao tác không hoàn tác có hộp xác nhận (NFR-20); chạy trên Chrome, Firefox, Edge (NFR-26). Nhóm I còn phải dùng được từ bề rộng 360px (NFR-17) |

### Số màn hình theo nhóm và bậc

| Nhóm | B1 | B2 | B3 | B4 | B5 | B6 | Tổng |
|---|---|---|---|---|---|---|---|
| A. Chung | 3 | — | — | 1 | — | — | 4 |
| B. Quản trị hệ thống | 6 | — | — | 1 | 1 | 3 | 11 |
| C. Học phần | 4 | — | — | — | — | 1 | 5 |
| D. Chương trình đào tạo và khung | — | 9 | — | — | — | 1 | 10 |
| E. Chuẩn đầu ra và đề cương | — | — | 7 | — | — | — | 7 |
| F. Đề xuất và phê duyệt | — | — | — | 6 | — | 1 | 7 |
| G. Phiên bản | — | — | — | 6 | — | — | 6 |
| H. Sinh viên và xét tốt nghiệp | — | — | — | — | 4 | — | 4 |
| I. Cổng sinh viên | — | — | — | — | 5 | — | 5 |
| J. Báo cáo | — | — | — | — | — | 3 | 3 |
| **Tổng** | **13** | **9** | **7** | **14** | **10** | **9** | **62** |

---

## 2. Danh mục màn hình

### 2.1. Nhóm A — Chung

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-01 | Đăng nhập | R1 T, R2 T, R3 T, R4 T, R5 T, R6 T | Xác thực người dùng bằng tài khoản nội bộ và mở phiên làm việc | `User` | Đăng nhập. Sai thông tin thì hiện một thông báo chung, không nói sai phần nào | UC-01 | B1 |
| MH-02 | Trang chính | R1 T, R2 T, R3 T, R4 T, R5 T | Điểm vào của cán bộ và giảng viên sau khi đăng nhập | `Notification`, `ChangeRequest`, `ApprovalStep` | Mở các mục menu của vai trò; đăng xuất. Từ B4: thấy số đề xuất của tôi, số đề xuất chờ tôi duyệt, số thông báo chưa đọc | UC-01, UC-47 · FR-63 | B1 |
| MH-03 | Tài khoản của tôi | R1 T, R2 T, R3 T, R4 T, R5 T, R6 T | Cho người dùng xem thông tin, vai trò và phạm vi của chính mình | `User`, `RoleAssignment`, `SubjectGroupMember`, `ProgramDirectorAssignment` | Xem vai trò và phạm vi đang có hiệu lực; đổi mật khẩu của mình (G-1). Từ B6: bật hoặc tắt nhận email | UC-01, UC-48 · FR-07, FR-64 | B1 |
| MH-04 | Thông báo | R1 T, R2 T, R3 T, R4 T, R5 T | Danh sách thông báo trong ứng dụng của người đang đăng nhập | `Notification` | Lọc chưa đọc; đánh dấu đã đọc; bấm vào thông báo để mở đề xuất liên quan | UC-47 · FR-63 | B4 |

### 2.2. Nhóm B — Quản trị hệ thống

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-05 | Danh sách tài khoản | R1 T | Tìm và quản lý tài khoản người dùng | `User`, `OrgUnit` | Tìm theo tên, tên đăng nhập, đơn vị, trạng thái; thêm tài khoản; mở chi tiết | UC-05 · FR-06 | B1 |
| MH-06 | Chi tiết tài khoản | R1 T | Sửa một tài khoản, gán vai trò kèm phạm vi, xem lịch sử phân quyền | `User`, `RoleAssignment`, `Role` | Sửa thông tin; vô hiệu hóa hoặc kích hoạt lại (có hộp xác nhận); đặt lại mật khẩu; thêm và thu hồi vai trò kèm phạm vi và thời hạn; xem ai đã cấp quyền gì, khi nào — đọc từ các dòng `RoleAssignment` (không xóa, thu hồi có người và thời điểm) vì nhật ký kiểm toán hoãn (F01-07) | UC-05, UC-06 · FR-06, FR-07, FR-10 | B1 |
| MH-07 | Cây đơn vị | R1 T | Quản lý cây Trường, Khoa, Phòng | `OrgUnit` | Thêm, sửa, ngừng hoạt động đơn vị; đổi đơn vị cha | UC-02 · FR-01 | B1 |
| MH-08 | Nhóm chuyên môn | R1 T, R2 X, R4 X | Quản lý nhóm chuyên môn, thành viên và Điều phối của từng nhóm | `SubjectGroup`, `SubjectGroupMember`, `User` | R1: thêm, sửa, ngừng sử dụng nhóm; thêm và bớt thành viên theo khoảng thời gian; chỉ định Điều phối có thời hạn. R2, R4 (từ B4): chỉ xem, và mở form đề xuất tổ chức (G-2) | UC-02, UC-03, UC-04 · FR-02, FR-03, FR-04 | B1 |
| MH-09 | Tra cứu nhật ký hệ thống | R1 X, R2 X | Tra ai đã làm gì, lúc nào, giá trị trước và sau | `AuditLog` | Lọc theo người, loại thực thể, mã bản ghi, khoảng thời gian; xem chi tiết một dòng. Không có thao tác sửa hay xóa | UC-82 · FR-105, FR-106 | B1 |
| MH-10 | Học kỳ và khóa tuyển sinh | R1 T | Danh mục học kỳ kèm ngày bắt đầu và danh mục khóa tuyển sinh | `Semester`, `Cohort` | Thêm, sửa học kỳ và ngày bắt đầu; thêm khóa tuyển sinh; mở màn hình gán phiên bản cho khóa | UC-52 · FR-74 | B4 |
| MH-11 | Bên tích hợp | R1 T | Quản lý các bên được gọi API và khóa truy cập của từng bên | `IntegrationClient` | Thêm bên tích hợp; cấp khóa (chỉ hiện một lần); đặt giới hạn tần suất; khóa và mở lại | UC-66 · FR-94 | B5 |
| MH-12 | Cấu hình đồng bộ | R1 T | Khai báo kết nối chỉ đọc tới cơ sở dữ liệu có sẵn và lịch đồng bộ | `SyncLog` | Nhập thông tin kết nối; kiểm tra kết nối; đặt lịch chạy; bật hoặc tắt đồng bộ; mở nhật ký đồng bộ. Không hiện lại mật khẩu kết nối | UC-76 · FR-98 | B6 |
| MH-13 | Nhật ký đồng bộ | R1 T | Xem từng lần đồng bộ, lỗi và số bản ghi mâu thuẫn giữa hai nguồn | `SyncLog` | Lọc theo trạng thái và thời gian; xem thông báo lỗi; xem số mâu thuẫn; chạy lại thủ công | UC-77, UC-78 · FR-99, FR-100 | B6 |
| MH-14 | Ủy quyền phê duyệt | R1 T, R3 P, R4 P | Người duyệt giao quyền duyệt của mình cho người khác trong một khoảng thời gian | `ApprovalDelegation`, `User` | Tạo ủy quyền với phạm vi và thời hạn; thu hồi; xem ủy quyền đã hết hạn. R1 xem và thu hồi được ủy quyền của mọi người | UC-08 · FR-09 | B6 |
| MH-15 | Ma trận quyền | R1 X | Xem vai trò nào được làm gì: ghi thẳng hay qua đề xuất, trên mọi đối tượng hay trong phạm vi | `Role`, `Permission`, `RolePermission` | Lọc theo vai trò, theo nhóm chức năng; xem từng ô. Người có permission.manage (R1) đổi một ô sang X / P / Đ / Đ(P) / không có quyền, qua hộp xác nhận; hai ô của R1 bị khóa (F02-02) | UC-06 · FR-07 | B1 |

### 2.3. Nhóm C — Học phần

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-16 | Danh mục học phần | R1 T, R2 X, R3 P, R4 P, R5 P, R6 X | Tra cứu toàn bộ học phần, kể cả học phần do khoa khác phụ trách | `Course`, `SubjectGroup`, `OrgUnit` | Tìm theo mã và tên; lọc theo khoa, nhóm, loại, trạng thái, "học phần khoa khác"; sắp xếp; thêm học phần (R1, R3..R5 trong phạm vi); mở chi tiết | UC-10 · FR-11, FR-05 | B1 |
| MH-17 | Chi tiết học phần | R1 T, R2 X, R3 P, R4 P, R5 P, R6 X | Xem một học phần cùng quan hệ, nhóm tương đương và nơi đang dùng | `Course`, `CourseRelation`, `EquivalentCourseGroup`, `CurriculumItem`, `Syllabus` | Xem thông tin; thêm, sửa, bỏ quan hệ kèm ngưỡng điểm tiên quyết; khi bị chặn vì chu trình thì hiện đường đi của vòng. Từ B2: mục "được dùng ở" liệt kê chương trình và phiên bản. Từ B3: mở đề cương. Từ B4: dữ liệu đã ban hành thì nút sửa dẫn sang form đề xuất | UC-10, UC-13, UC-16, UC-17 · FR-11, FR-17, FR-18, FR-19, FR-20 | B1 |
| MH-18 | Form học phần | R1 T, R3 P, R4 P, R5 P | Thêm hoặc sửa thông tin một học phần | `Course` | Nhập mã, tên Việt và Anh, tín chỉ số thực, loại, khoa và nhóm phụ trách; lưu. Chỉ R1: nhập học phần khoa khác; đổi trạng thái, Ngừng mở lớp đòi chọn học phần thay thế (có hộp xác nhận) | UC-11, UC-12 · FR-05, FR-12, FR-13, FR-14, FR-15, FR-16 | B1 |
| MH-19 | Nhóm học phần tương đương | R1 T, R2 X, R3 X, R4 X, R5 X | Quản lý các nhóm học phần được coi là tương đương nhau | `EquivalentCourseGroup`, `Course` | R1: tạo nhóm; thêm và bớt học phần; gộp hai nhóm. Vai trò khác: chỉ xem | UC-14 · FR-21 | B1 |
| MH-20 | Đồ thị quan hệ học phần | R1 X, R2 X, R3 X, R4 X, R5 X, R6 X | Nhìn quan hệ học trước, tiên quyết, song hành dưới dạng đồ thị xếp theo học kỳ | `CourseRelation`, `CurriculumRequisite`, `CurriculumItem` | Chọn chương trình và phiên bản; bấm một học phần để làm nổi chuỗi phụ thuộc; phóng to, thu nhỏ | UC-15 · FR-22 | B6 |

### 2.4. Nhóm D — Chương trình đào tạo và khung

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-21 | Danh sách chương trình đào tạo | R1 T, R2 X, R3 P, R4 X, R5 X | Tra cứu các chương trình cùng phiên bản hiện hành và Giám đốc CTĐT | `Program`, `ProgramVersion`, `ProgramDirectorAssignment` | Tìm và lọc theo trình độ, trạng thái; thêm chương trình (R1); mở tổng quan | UC-18 · FR-23 | B2 |
| MH-22 | Tổng quan chương trình | R1 T, R2 X, R3 P, R4 X, R5 X | Trang gốc của một chương trình: thông tin, Giám đốc, phiên bản đang xem, lối vào các phần | `Program`, `ProgramVersion`, `ProgramDirectorAssignment` | Xem thông tin; phân công Giám đốc CTĐT có thời hạn (R1); ngừng sử dụng chương trình (R1); đi tới khung, nhóm tự chọn, kiểm tra nhất quán. Từ B3: tới PLO và ma trận. Từ B4: tới ban hành, lịch sử phiên bản. Từ B6: xuất PDF, đồ thị, bảng sức khỏe | UC-07, UC-18, UC-24 · FR-08, FR-23, FR-24, FR-26, FR-37 | B2 |
| MH-23 | Form thông tin chương trình | R1 T, R3 P | Thêm chương trình hoặc sửa thông tin của phiên bản đang Nháp | `Program`, `ProgramVersion` | Nhập mã, tên, ngành, trình độ, số học kỳ, tổng tín chỉ, tín chỉ bắt buộc và tự chọn; lưu. Từ B4: phiên bản đã ban hành thì dẫn sang form đề xuất | UC-19 · FR-23, FR-24 | B2 |
| MH-24 | Nhân bản chương trình | R1 T | Tạo một chương trình mới ở Nháp từ một chương trình có sẵn | `Program`, `ProgramVersion` | Nhập mã và tên chương trình mới; xác nhận. Từ B3: chép cả PLO và ma trận | UC-20 · FR-25 | B2 |
| MH-25 | Khung chương trình | R1 T, R2 X, R3 P, R4 P, R5 P | Xem và soạn khung của một phiên bản, dạng dòng hoặc theo học kỳ | `CurriculumItem`, `CurriculumRequisite`, `ElectiveGroup`, `KnowledgeBlock`, `Course` | Chuyển giữa hai chế độ xem; lọc theo học kỳ, khối kiến thức, bắt buộc hay tự chọn; tìm; thêm, sửa, bỏ dòng; đổi thứ tự và chuyển học kỳ; xuất Excel. Từ B5: R1 và R3 chọn một sinh viên để thấy cột "Đăng ký được?" | UC-18, UC-21, UC-23, UC-60 · FR-27, FR-28, FR-30, FR-31, FR-32, FR-36 | B2 |
| MH-26 | Nhóm tự chọn | R1 T, R2 X, R3 P, R4 X, R5 X | Quản lý nhóm tự chọn và yêu cầu tối thiểu của từng nhóm | `ElectiveGroup`, `CurriculumItem` | Tạo nhóm; đặt tối thiểu theo tín chỉ hoặc theo số học phần; gán và gỡ dòng khung | UC-22 · FR-29 | B2 |
| MH-27 | Kết quả kiểm tra nhất quán | R1 T, R2 X, R3 P, R4 X, R5 X | Liệt kê lỗi chặn và cảnh báo của một phiên bản khung | `ProgramVersion`, `CurriculumItem`, `CurriculumRequisite`, `ElectiveGroup` | Chạy kiểm tra; xem tổng tín chỉ tính được so với khai báo; chấp nhận chênh lệch kèm lý do (R1, R3); bấm một dòng để tới chỗ cần sửa | UC-54, UC-55, UC-56 · FR-77, FR-78, FR-79, FR-80, FR-81 | B2 |
| MH-28 | Bảng sức khỏe chương trình | R1 T, R2 X, R3 P | Gom mọi cảnh báo của một chương trình về một nơi | `ProgramVersion`, `CurriculumItem`, `PLO`, `Syllabus` | Xem cảnh báo theo nhóm: tín chỉ, tiên quyết, học phần thiếu đề cương, PLO chưa được đóng góp, học phần ngừng mở lớp chưa có thay thế; bấm để tới màn hình xử lý | UC-31, UC-54 · FR-82 | B6 |
| MH-29 | Nhập liệu từ Excel | R1 T, R3 P | Nhập dữ liệu theo hai bước: chạy thử rồi xác nhận ghi | `ImportBatch` | Chọn loại dữ liệu; tải tệp mẫu; tải tệp lên; chạy thử; xem báo cáo từng dòng với LỖI và CẢNH BÁO; xác nhận ghi khi không còn LỖI. B2: danh mục học phần (R1), khung (R1, R3). Từ B5: danh sách sinh viên và kết quả học tập (chỉ R1) | UC-71, UC-72, UC-73, UC-75 · FR-33, FR-34, FR-35, FR-96, FR-97 | B2 |
| MH-30 | Lịch sử phiên nhập | R1 X, R3 X | Xem lại các lần chạy thử và các lần đã ghi | `ImportBatch` | Lọc theo loại, trạng thái, người thực hiện; mở báo cáo lỗi của một phiên | UC-74 · FR-101 | B2 |

### 2.5. Nhóm E — Chuẩn đầu ra và đề cương

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-31 | Chuẩn đầu ra chương trình (PLO) | R1 T, R2 X, R3 P, R4 X, R5 X, R6 X | Xem và soạn danh sách PLO của một phiên bản | `PLO`, `ProgramVersion` | R1, R3: thêm, sửa, xóa PLO (xóa có hộp xác nhận), sắp thứ tự, nhập bản tiếng Anh. Vai trò khác: chỉ xem; R6 chỉ thấy PLO của phiên bản áp dụng cho mình (G-3) | UC-25, UC-26 · FR-38 | B3 |
| MH-32 | Ma trận CLO–PLO của chương trình | R1 X, R2 X, R3 X, R4 X, R5 X | Tra cứu liên kết CLO–PLO trên toàn chương trình | `CLOPLOMapping`, `CLO`, `PLO`, `CurriculumItem` | Lọc theo học kỳ và theo PLO; mở ma trận của một học phần; mở ma trận học phần–PLO; mở báo cáo độ bao phủ | UC-25 · FR-39, FR-40 | B3 |
| MH-33 | Ma trận CLO–PLO của một học phần | R1 T, R3 P, R4 P, R5 P | Gắn từng CLO với các PLO cho một học phần trong một chương trình | `CLOPLOMapping`, `CoursePLOMapping`, `CLO`, `PLO`, `CurriculumItem` | Đánh dấu ô; chỉ các cột PLO mà học phần đã gắn ở MH-34 bấm được; lưu. Từ B4: phiên bản đã ban hành thì dẫn sang form đề xuất | UC-28 · FR-40 | B3 |
| MH-34 | Ma trận học phần–PLO | R1 T, R2 X, R3 P, R4 X, R5 X | Nhập học phần đóng góp vào PLO nào, với trọng số bao nhiêu | `CoursePLOMapping`, `PLO`, `CurriculumItem` | Xem lưới; R1, R3: nhập trọng số một ô, xóa một ô (xóa kéo theo liên kết CLO–PLO của ô đó, có hộp xác nhận) | UC-29, UC-30 · FR-41 | B3 |
| MH-35 | Báo cáo độ bao phủ chuẩn đầu ra | R1 X, R2 X, R3 X, R4 X | Chỉ ra lỗ hổng: PLO chưa có học phần đóng góp, CLO chưa gắn PLO | `PLO`, `CLO`, `CLOPLOMapping`, `CurriculumItem` | Xem ba danh sách lỗ hổng; bấm một dòng để tới ma trận tương ứng | UC-31 · FR-42 | B3 |
| MH-36 | Xem đề cương | R1 X, R2 X, R3 X, R4 X, R5 X, R6 X | Đọc đề cương dùng chung của một học phần: nội dung, CLO, công thức điểm, tệp đã ký | `Syllabus`, `WeeklyContent`, `CLO`, `AssessmentComponent`, `AssessmentCLOMapping`, `SyllabusAttachment` | Chuyển ngôn ngữ hiển thị; tải tệp đính kèm; mở trình soạn (người có quyền). R6 thấy bản đề cương được ghim trong phiên bản của mình, không thấy nháp, đề xuất, bình luận | UC-32 · FR-44, FR-48, FR-93 | B3 |
| MH-37 | Trình soạn đề cương | R1 T, R3 P, R4 P, R5 P | Soạn mọi phần của đề cương trên một màn hình nhiều thẻ | `Syllabus`, `WeeklyContent`, `WeeklyContentCLO`, `CLO`, `AssessmentComponent`, `AssessmentCLOMapping`, `SyllabusAttachment` | Thẻ Nội dung: soạn văn bản có định dạng, nội dung theo tuần, bản tiếng Anh. Thẻ CLO: thêm, sửa, xóa. Thẻ Công thức điểm: thành phần, trọng số, điều kiện, ngưỡng, điểm liệt; hiện chênh lệch so với 100%. Thẻ Ánh xạ: thành phần với CLO; cảnh báo CLO chưa được đánh giá. Thẻ Đính kèm: tải lên PDF hoặc Word. Từ B4: đề cương đã ban hành thì soạn trong một đề xuất | UC-27, UC-33, UC-34, UC-35, UC-36, UC-57, UC-58 · FR-39, FR-45, FR-46, FR-47, FR-48, FR-49, FR-50, FR-51, FR-52, FR-53, FR-54 | B3 |

### 2.6. Nhóm F — Đề xuất và phê duyệt

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-38 | Danh sách đề xuất | R1 T, R2 P, R3 P, R4 P, R5 P | Xem đề xuất của tôi và các đề xuất trong phạm vi của mình | `ChangeRequest` | Lọc theo trạng thái, loại, nguồn phát sinh, người tạo; tạo đề xuất; mở chi tiết. R1 có thêm bộ lọc "tồn đọng" | UC-40 · FR-56, FR-108 | B4 |
| MH-39 | Form đề xuất thay đổi | R1 T, R3 P, R4 P, R5 P | Soạn một đề xuất trên bản sao của dữ liệu đang hiệu lực rồi gửi duyệt | `ChangeRequest`, `ChangeItem`, `ChangeRequestDocument` | Chọn loại và đối tượng; soạn thay đổi; nhập tiêu đề, lý do, nguồn phát sinh, số văn bản căn cứ; tải hồ sơ căn cứ; lưu nháp; xóa nháp chưa từng gửi; gửi duyệt (hộp xác nhận hiện chương trình bị ảnh hưởng và người duyệt dự kiến). Hiện cảnh báo khi đối tượng đang có đề xuất mở khác | UC-16, UC-37, UC-38 · FR-55, FR-56, FR-57, FR-68, FR-108, FR-109 | B4 |
| MH-40 | Form đề xuất tổ chức và phân công | R2 P, R4 P | Đề nghị thay đổi thành viên nhóm chuyên môn hoặc phân công, gửi thẳng Phòng Đào tạo | `ChangeRequest`, `ChangeItem`, `SubjectGroup`, `SubjectGroupMember` | Chọn nhóm; nêu thay đổi và lý do; lưu nháp; gửi | UC-09 · FR-56 | B4 |
| MH-41 | Chi tiết đề xuất | R1 T, R2 P, R3 P, R4 P, R5 P | Xem một đề xuất: khác biệt trước và sau, tiến độ từng người duyệt, lịch sử, bình luận, hồ sơ | `ChangeRequest`, `ChangeItem`, `ApprovalStep`, `Comment`, `ChangeRequestDocument` | Mọi vai trò có quyền xem: đọc bảng so sánh, lịch sử phê duyệt theo từng lần gửi, bình luận. Người tạo: thu hồi (có hộp xác nhận). Người duyệt của cấp hiện tại: Đồng ý, Trả lại, Từ chối; hai thao tác sau đòi lý do từ 20 ký tự. R1: can thiệp ở cấp 1 và 2 kèm lý do; mở form chấp thuận cuối. R2: chỉ xem và bình luận | UC-39, UC-40, UC-41, UC-43, UC-44, UC-45 · FR-57, FR-58, FR-59, FR-60, FR-61, FR-62, FR-67 | B4 |
| MH-42 | Hàng đợi chờ duyệt | R1 T, R3 P, R4 P | Danh sách đề xuất đang chờ chính người này xử lý | `ApprovalStep`, `ChangeRequest` | Sắp theo số ngày đã chờ; lọc theo loại; mở chi tiết. Từ B6: hiện cả đề xuất được ủy quyền và dấu quá hạn | UC-42 · FR-65, FR-66 | B4 |
| MH-43 | Form chấp thuận cuối | R1 T | Phòng Đào tạo chấp thuận lần cuối và cung cấp thông tin ban hành | `ChangeRequest`, `ProgramVersion`, `Semester`, `Cohort`, `CohortVersion` | Nhập số quyết định, ngày ký, học kỳ hiệu lực, khóa áp dụng; xem danh sách chương trình sẽ sinh phiên bản mới; xác nhận (không hoàn tác) | UC-46, UC-49 · FR-69, FR-70 | B4 |
| MH-44 | Thống kê đề xuất | R1 X, R2 X, R3 P, R4 P | Số đề xuất theo trạng thái, loại, nguồn và thời gian xử lý trung bình từng cấp | `ChangeRequest`, `ApprovalStep` | Chọn khoảng thời gian; lọc theo chương trình, nhóm chuyên môn; xem bảng số liệu | UC-83 · FR-107 | B6 |

### 2.7. Nhóm G — Phiên bản

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-45 | Ban hành phiên bản đầu tiên | R1 T | Đưa phiên bản Nháp đầu tiên của một chương trình vào hiệu lực | `ProgramVersion`, `CohortVersion`, `Semester`, `Cohort`, `Syllabus` | Xem danh sách lỗi chặn (học phần thiếu đề cương, lỗi nhất quán, CLO chưa được đánh giá); nhập số phiên bản, số quyết định, ngày ký, học kỳ hiệu lực, khóa áp dụng; xác nhận (không hoàn tác) | UC-49 · FR-70 | B4 |
| MH-46 | Lịch sử phiên bản | R1 X, R2 X, R3 X, R4 X, R5 X | Danh sách mọi phiên bản của một chương trình kèm quyết định, học kỳ hiệu lực, khóa áp dụng | `ProgramVersion`, `CohortVersion` | Mở một phiên bản ở chế độ chỉ đọc; chọn hai phiên bản để so sánh. Từ B6: xem dạng dòng thời gian có nhãn đính chính | UC-51 · FR-73, FR-76 | B4 |
| MH-47 | Phiên bản chỉ đọc | R1 X, R2 X, R3 X, R4 X, R5 X | Xem lại nguyên trạng một phiên bản đã ban hành | `ProgramVersion`, `CurriculumItem`, `ElectiveGroup`, `PLO`, `CLOPLOMapping`, `Syllabus` | Xem thông tin, khung, nhóm tự chọn, PLO, ma trận, các bản đề cương được ghim. Không có nút sửa. R1: mở ban hành đính chính | UC-51 · FR-69, FR-71, FR-73 | B4 |
| MH-48 | So sánh hai phiên bản | R1 X, R2 X, R3 X, R4 X, R5 X | Chỉ ra khác biệt giữa hai phiên bản bất kỳ của cùng một chương trình | `ProgramVersion`, `CurriculumItem`, `ElectiveGroup`, `PLO`, `CLOPLOMapping`, `Syllabus` | Chọn hai phiên bản; xem khác biệt theo nhóm: thông tin, khung, nhóm tự chọn, PLO, ma trận, đề cương | UC-50 · FR-72 | B4 |
| MH-49 | Ban hành đính chính | R1 T | Thay một phiên bản đã ban hành sai bằng một phiên bản đính chính, không xóa bản sai | `ProgramVersion`, `CohortVersion` | Sửa nội dung sai trên bản sao; nhập lý do đính chính (bắt buộc); chọn có chuyển các khóa đang gắn sang bản mới; xác nhận (không hoàn tác) | UC-53 · FR-75 | B4 |
| MH-50 | Gán phiên bản cho khóa | R1 T | Quy định khóa tuyển sinh nào học theo phiên bản nào, từ học kỳ nào | `CohortVersion`, `Cohort`, `ProgramVersion`, `Semester` | Thêm, sửa dòng áp dụng; xem phiên bản áp dụng của từng khóa theo từng học kỳ | UC-52 · FR-74 | B4 |

### 2.8. Nhóm H — Sinh viên và xét tốt nghiệp

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-51 | Danh sách sinh viên | R1 T, R3 X | Tìm sinh viên theo mã, tên, khóa, chương trình | `Student`, `ProgramEnrollment`, `Cohort` | Tìm, lọc theo khóa, chương trình, trạng thái; mở hồ sơ. R3 chỉ thấy sinh viên của chương trình mình phụ trách (G-4) | UC-52 · FR-74 | B5 |
| MH-52 | Hồ sơ sinh viên | R1 T, R3 X | Xem một sinh viên: ghi danh, kết quả học tập, tiến độ, điều kiện đăng ký | `Student`, `ProgramEnrollment`, `AcademicResult`, `ProgramVersion` | Xem các thẻ Ghi danh, Kết quả học tập, Tiến độ, Điều kiện đăng ký. R1: thêm ghi danh song ngành, chuyển chương trình, đặt ngoại lệ kèm căn cứ; mở xét tốt nghiệp | UC-52, UC-59, UC-60 · FR-74, FR-83, FR-90 | B5 |
| MH-53 | Xét tốt nghiệp một sinh viên | R1 T, R3 P | Chạy và xem kết quả xét tốt nghiệp cho một ghi danh của một sinh viên | `GraduationAudit`, `ProgramEnrollment`, `AcademicResult` | Chọn ghi danh; chạy xét; xem kết luận và danh sách hạng mục thiếu chia bốn loại; xem học phần được công nhận nhờ tương đương; xem các lần xét trước | UC-61, UC-64 · FR-84, FR-85, FR-86 | B5 |
| MH-54 | Xét tốt nghiệp theo lô | R1 T, R3 P | Xét cả một khóa hoặc một chương trình trong một lần chạy | `GraduationAudit`, `ProgramEnrollment`, `Cohort` | Chọn khóa và chương trình; chạy; xem bảng kết quả; lọc đủ hoặc chưa đủ; mở chi tiết một sinh viên; xuất Excel | UC-62 · FR-87 | B5 |

### 2.9. Nhóm I — Cổng sinh viên

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-55 | Trang chủ cổng sinh viên | R6 X | Cho sinh viên thấy mình đang học theo chương trình và phiên bản nào | `Student`, `ProgramEnrollment`, `ProgramVersion` | Xem chương trình, phiên bản, số quyết định, khóa; chuyển giữa chương trình Chính và Song ngành; đi tới khung, tiến độ, học phần kỳ tới, xét tốt nghiệp, PLO | UC-65, UC-84 · FR-88, FR-95 | B5 |
| MH-56 | Chương trình của tôi | R6 X | Khung của phiên bản áp dụng cho sinh viên, kèm trạng thái từng học phần | `CurriculumItem`, `ElectiveGroup`, `AcademicResult` | Xem theo học kỳ; thấy trạng thái Đã đạt, Chưa đạt, Đang học, Chưa học và điểm; học phần đạt nhờ tương đương ghi rõ mã học phần đã học; mở chi tiết học phần và đề cương. Chưa có kết quả thì vẫn hiện đủ khung | UC-59, UC-84 · FR-89, FR-95 | B5 |
| MH-57 | Tiến độ học tập | R6 X | Số tín chỉ đã tích lũy so với yêu cầu của chương trình | `AcademicResult`, `ProgramEnrollment`, `ProgramVersion` | Xem tổng, bắt buộc, tự chọn theo từng nhóm, theo khối kiến thức; chưa có kết quả thì báo chưa có dữ liệu | UC-59 · FR-90, FR-95 | B5 |
| MH-58 | Học phần đủ điều kiện kỳ tới | R6 X | Học phần nào sinh viên được đăng ký ở học kỳ tới và vì sao chưa được | `CurriculumItem`, `CurriculumRequisite`, `AcademicResult` | Xem học phần có kết quả Được và Được có điều kiện, không gồm học phần đã hoàn thành; bấm một học phần chưa đủ điều kiện để thấy lý do và học phần còn thiếu; với Được có điều kiện thì thấy học phần song hành phải đăng ký cùng. Không có nút đăng ký | UC-60, UC-63 · FR-83, FR-91, FR-92, FR-95 | B5 |
| MH-59 | Kết quả xét tốt nghiệp của tôi | R6 X | Sinh viên tự xem mình đã đủ điều kiện tốt nghiệp chưa | `GraduationAudit`, `ProgramEnrollment` | Xem kết luận và danh sách hạng mục còn thiếu; kết quả tính tại lúc xem, không lưu | UC-61, UC-64 · FR-84, FR-86, FR-95 | B5 |

### 2.10. Nhóm J — Báo cáo

| Mã | Tên | Vai trò | Mục đích | Dữ liệu chính | Thao tác | UC / FR | Bậc |
|---|---|---|---|---|---|---|---|
| MH-60 | Đối sánh hai chương trình | R1 X, R2 X, R3 X, R4 X | So hai chương trình: phần chung, phần riêng, cặp học phần tương đương | `CurriculumItem`, `ProgramVersion`, `EquivalentCourseGroup` | Chọn hai chương trình và phiên bản; xem ba danh sách; xuất Excel | UC-79 · FR-102 | B6 |
| MH-61 | Phân bổ tín chỉ | R1 X, R2 X, R3 X, R4 X | Tín chỉ của một phiên bản chia theo khối kiến thức, học kỳ, loại học phần | `CurriculumItem`, `KnowledgeBlock`, `ProgramVersion` | Chọn chương trình và phiên bản; xem bảng; khối lệch yêu cầu được đánh dấu; xuất Excel | UC-80 · FR-103 | B6 |
| MH-62 | Xuất hồ sơ kiểm định | R1 T, R2 X, R3 P | Xuất ma trận chuẩn đầu ra và bộ tài liệu kiểm định của một phiên bản | `ProgramVersion`, `PLO`, `CLOPLOMapping`, `CoursePLOMapping`, `Syllabus` | Chọn chương trình và phiên bản; chọn thành phần cần xuất; xuất ma trận ra Excel; xuất cả bộ | UC-81 · FR-43, FR-104 | B6 |

---

## 3. Ma trận màn hình × vai trò

Sinh từ cột Vai trò của mục 2. Dấu — nghĩa là vai trò không vào được màn hình.

| Mã | Tên | R1 | R2 | R3 | R4 | R5 | R6 |
|---|---|---|---|---|---|---|---|
| MH-01 | Đăng nhập | T | T | T | T | T | T |
| MH-02 | Trang chính | T | T | T | T | T | — |
| MH-03 | Tài khoản của tôi | T | T | T | T | T | T |
| MH-04 | Thông báo | T | T | T | T | T | — |
| MH-05 | Danh sách tài khoản | T | — | — | — | — | — |
| MH-06 | Chi tiết tài khoản | T | — | — | — | — | — |
| MH-07 | Cây đơn vị | T | — | — | — | — | — |
| MH-08 | Nhóm chuyên môn | T | X | — | X | — | — |
| MH-09 | Tra cứu nhật ký hệ thống | X | X | — | — | — | — |
| MH-10 | Học kỳ và khóa tuyển sinh | T | — | — | — | — | — |
| MH-11 | Bên tích hợp | T | — | — | — | — | — |
| MH-12 | Cấu hình đồng bộ | T | — | — | — | — | — |
| MH-13 | Nhật ký đồng bộ | T | — | — | — | — | — |
| MH-14 | Ủy quyền phê duyệt | T | — | P | P | — | — |
| MH-15 | Ma trận quyền | X | — | — | — | — | — |
| MH-16 | Danh mục học phần | T | X | P | P | P | X |
| MH-17 | Chi tiết học phần | T | X | P | P | P | X |
| MH-18 | Form học phần | T | — | P | P | P | — |
| MH-19 | Nhóm học phần tương đương | T | X | X | X | X | — |
| MH-20 | Đồ thị quan hệ học phần | X | X | X | X | X | X |
| MH-21 | Danh sách chương trình đào tạo | T | X | P | X | X | — |
| MH-22 | Tổng quan chương trình | T | X | P | X | X | — |
| MH-23 | Form thông tin chương trình | T | — | P | — | — | — |
| MH-24 | Nhân bản chương trình | T | — | — | — | — | — |
| MH-25 | Khung chương trình | T | X | P | P | P | — |
| MH-26 | Nhóm tự chọn | T | X | P | X | X | — |
| MH-27 | Kết quả kiểm tra nhất quán | T | X | P | X | X | — |
| MH-28 | Bảng sức khỏe chương trình | T | X | P | — | — | — |
| MH-29 | Nhập liệu từ Excel | T | — | P | — | — | — |
| MH-30 | Lịch sử phiên nhập | X | — | X | — | — | — |
| MH-31 | Chuẩn đầu ra chương trình (PLO) | T | X | P | X | X | X |
| MH-32 | Ma trận CLO–PLO của chương trình | X | X | X | X | X | — |
| MH-33 | Ma trận CLO–PLO của một học phần | T | — | P | P | P | — |
| MH-34 | Ma trận học phần–PLO | T | X | P | X | X | — |
| MH-35 | Báo cáo độ bao phủ chuẩn đầu ra | X | X | X | X | — | — |
| MH-36 | Xem đề cương | X | X | X | X | X | X |
| MH-37 | Trình soạn đề cương | T | — | P | P | P | — |
| MH-38 | Danh sách đề xuất | T | P | P | P | P | — |
| MH-39 | Form đề xuất thay đổi | T | — | P | P | P | — |
| MH-40 | Form đề xuất tổ chức và phân công | — | P | — | P | — | — |
| MH-41 | Chi tiết đề xuất | T | P | P | P | P | — |
| MH-42 | Hàng đợi chờ duyệt | T | — | P | P | — | — |
| MH-43 | Form chấp thuận cuối | T | — | — | — | — | — |
| MH-44 | Thống kê đề xuất | X | X | P | P | — | — |
| MH-45 | Ban hành phiên bản đầu tiên | T | — | — | — | — | — |
| MH-46 | Lịch sử phiên bản | X | X | X | X | X | — |
| MH-47 | Phiên bản chỉ đọc | X | X | X | X | X | — |
| MH-48 | So sánh hai phiên bản | X | X | X | X | X | — |
| MH-49 | Ban hành đính chính | T | — | — | — | — | — |
| MH-50 | Gán phiên bản cho khóa | T | — | — | — | — | — |
| MH-51 | Danh sách sinh viên | T | — | X | — | — | — |
| MH-52 | Hồ sơ sinh viên | T | — | X | — | — | — |
| MH-53 | Xét tốt nghiệp một sinh viên | T | — | P | — | — | — |
| MH-54 | Xét tốt nghiệp theo lô | T | — | P | — | — | — |
| MH-55 | Trang chủ cổng sinh viên | — | — | — | — | — | X |
| MH-56 | Chương trình của tôi | — | — | — | — | — | X |
| MH-57 | Tiến độ học tập | — | — | — | — | — | X |
| MH-58 | Học phần đủ điều kiện kỳ tới | — | — | — | — | — | X |
| MH-59 | Kết quả xét tốt nghiệp của tôi | — | — | — | — | — | X |
| MH-60 | Đối sánh hai chương trình | X | X | X | X | — | — |
| MH-61 | Phân bổ tín chỉ | X | X | X | X | — | — |
| MH-62 | Xuất hồ sơ kiểm định | T | X | P | — | — | — |
|  | **Số màn hình vào được** | **56** | **31** | **41** | **34** | **25** | **12** |

---

## 4. Bản đồ điều hướng theo vai trò

Mỗi bảng liệt kê các mục menu mà vai trò thấy và những màn hình tới được từ đó. Cột "Đi tiếp tới" chỉ gồm màn hình mà chính vai trò ấy vào được. MH-01 là trang mở đầu của mọi vai trò và không lặp lại trong các bảng.

### 4.1. R1 — Phòng Đào tạo

| Mục menu | Màn hình | Mức | Bậc | Đi tiếp tới |
|---|---|---|---|---|
| Trang chính | MH-02 Trang chính | T | B1 | MH-41 |
| Tài khoản của tôi | MH-03 Tài khoản của tôi | T | B1 | — |
| Thông báo | MH-04 Thông báo | T | B4 | MH-41 |
| Quản trị › Tài khoản | MH-05 Danh sách tài khoản | T | B1 | MH-06 |
| Quản trị › Đơn vị | MH-07 Cây đơn vị | T | B1 | — |
| Quản trị › Nhóm chuyên môn | MH-08 Nhóm chuyên môn | T | B1 | — |
| Quản trị › Nhật ký hệ thống | MH-09 Tra cứu nhật ký hệ thống | X | B1 | — |
| Quản trị › Học kỳ và khóa tuyển sinh | MH-10 Học kỳ và khóa tuyển sinh | T | B4 | MH-50 |
| Quản trị › Bên tích hợp | MH-11 Bên tích hợp | T | B5 | — |
| Quản trị › Đồng bộ dữ liệu | MH-12 Cấu hình đồng bộ | T | B6 | MH-13 |
| Phê duyệt › Ủy quyền | MH-14 Ủy quyền phê duyệt | T | B6 | — |
| Quản trị › Ma trận quyền | MH-15 Ma trận quyền | X | B1 | — |
| Học phần | MH-16 Danh mục học phần | T | B1 | MH-17, MH-18 |
| Học phần › Nhóm tương đương | MH-19 Nhóm học phần tương đương | T | B1 | — |
| Chương trình đào tạo | MH-21 Danh sách chương trình đào tạo | T | B2 | MH-22 |
| Nhập liệu › Nhập từ Excel | MH-29 Nhập liệu từ Excel | T | B2 | — |
| Nhập liệu › Lịch sử phiên nhập | MH-30 Lịch sử phiên nhập | X | B2 | — |
| Đề xuất | MH-38 Danh sách đề xuất | T | B4 | MH-39, MH-41 |
| Phê duyệt › Chờ tôi duyệt | MH-42 Hàng đợi chờ duyệt | T | B4 | MH-41 |
| Báo cáo › Thống kê đề xuất | MH-44 Thống kê đề xuất | X | B6 | — |
| Sinh viên | MH-51 Danh sách sinh viên | T | B5 | MH-52 |
| Sinh viên › Xét tốt nghiệp theo lô | MH-54 Xét tốt nghiệp theo lô | T | B5 | — |
| Báo cáo › Đối sánh chương trình | MH-60 Đối sánh hai chương trình | X | B6 | — |
| Báo cáo › Phân bổ tín chỉ | MH-61 Phân bổ tín chỉ | X | B6 | — |
| Báo cáo › Xuất kiểm định | MH-62 Xuất hồ sơ kiểm định | T | B6 | — |

Màn hình không có mục menu riêng, vào từ màn hình khác:

| Màn hình | Mức | Bậc | Vào từ | Đi tiếp tới |
|---|---|---|---|---|
| MH-06 Chi tiết tài khoản | T | B1 | MH-05 | — |
| MH-13 Nhật ký đồng bộ | T | B6 | MH-12 | — |
| MH-17 Chi tiết học phần | T | B1 | MH-16, MH-25 | MH-18, MH-20, MH-36, MH-39 |
| MH-18 Form học phần | T | B1 | MH-16, MH-17 | — |
| MH-20 Đồ thị quan hệ học phần | X | B6 | MH-17, MH-22 | — |
| MH-22 Tổng quan chương trình | T | B2 | MH-21 | MH-20, MH-23, MH-24, MH-25, MH-27, MH-28, MH-31, MH-32, MH-35, MH-45, MH-46, MH-50 |
| MH-23 Form thông tin chương trình | T | B2 | MH-22 | MH-39 |
| MH-24 Nhân bản chương trình | T | B2 | MH-22 | — |
| MH-25 Khung chương trình | T | B2 | MH-22 | MH-17, MH-26, MH-27, MH-33, MH-36, MH-39 |
| MH-26 Nhóm tự chọn | T | B2 | MH-25 | — |
| MH-27 Kết quả kiểm tra nhất quán | T | B2 | MH-25, MH-22 | — |
| MH-28 Bảng sức khỏe chương trình | T | B6 | MH-22 | — |
| MH-31 Chuẩn đầu ra chương trình (PLO) | T | B3 | MH-22 | MH-32 |
| MH-32 Ma trận CLO–PLO của chương trình | X | B3 | MH-22, MH-31 | MH-33, MH-34, MH-35 |
| MH-33 Ma trận CLO–PLO của một học phần | T | B3 | MH-32, MH-25 | MH-39 |
| MH-34 Ma trận học phần–PLO | T | B3 | MH-32 | — |
| MH-35 Báo cáo độ bao phủ chuẩn đầu ra | X | B3 | MH-22, MH-32 | — |
| MH-36 Xem đề cương | X | B3 | MH-17, MH-25 | MH-37 |
| MH-37 Trình soạn đề cương | T | B3 | MH-36 | MH-39 |
| MH-39 Form đề xuất thay đổi | T | B4 | MH-38, MH-17, MH-23, MH-25, MH-33, MH-37 | — |
| MH-41 Chi tiết đề xuất | T | B4 | MH-38, MH-42, MH-04, MH-02 | MH-43 |
| MH-43 Form chấp thuận cuối | T | B4 | MH-41 | — |
| MH-45 Ban hành phiên bản đầu tiên | T | B4 | MH-22 | — |
| MH-46 Lịch sử phiên bản | X | B4 | MH-22 | MH-47, MH-48 |
| MH-47 Phiên bản chỉ đọc | X | B4 | MH-46 | MH-49 |
| MH-48 So sánh hai phiên bản | X | B4 | MH-46 | — |
| MH-49 Ban hành đính chính | T | B4 | MH-47 | — |
| MH-50 Gán phiên bản cho khóa | T | B4 | MH-22, MH-10 | — |
| MH-52 Hồ sơ sinh viên | T | B5 | MH-51 | MH-53 |
| MH-53 Xét tốt nghiệp một sinh viên | T | B5 | MH-52 | — |

### 4.2. R2 — Ban lãnh đạo khoa

| Mục menu | Màn hình | Mức | Bậc | Đi tiếp tới |
|---|---|---|---|---|
| Trang chính | MH-02 Trang chính | T | B1 | MH-41 |
| Tài khoản của tôi | MH-03 Tài khoản của tôi | T | B1 | — |
| Thông báo | MH-04 Thông báo | T | B4 | MH-41 |
| Quản trị › Nhóm chuyên môn | MH-08 Nhóm chuyên môn | X | B1 | MH-40 |
| Quản trị › Nhật ký hệ thống | MH-09 Tra cứu nhật ký hệ thống | X | B1 | — |
| Học phần | MH-16 Danh mục học phần | X | B1 | MH-17 |
| Học phần › Nhóm tương đương | MH-19 Nhóm học phần tương đương | X | B1 | — |
| Chương trình đào tạo | MH-21 Danh sách chương trình đào tạo | X | B2 | MH-22 |
| Đề xuất | MH-38 Danh sách đề xuất | P | B4 | MH-40, MH-41 |
| Báo cáo › Thống kê đề xuất | MH-44 Thống kê đề xuất | X | B6 | — |
| Báo cáo › Đối sánh chương trình | MH-60 Đối sánh hai chương trình | X | B6 | — |
| Báo cáo › Phân bổ tín chỉ | MH-61 Phân bổ tín chỉ | X | B6 | — |
| Báo cáo › Xuất kiểm định | MH-62 Xuất hồ sơ kiểm định | X | B6 | — |

Màn hình không có mục menu riêng, vào từ màn hình khác:

| Màn hình | Mức | Bậc | Vào từ | Đi tiếp tới |
|---|---|---|---|---|
| MH-17 Chi tiết học phần | X | B1 | MH-16, MH-25 | MH-20, MH-36 |
| MH-20 Đồ thị quan hệ học phần | X | B6 | MH-17, MH-22 | — |
| MH-22 Tổng quan chương trình | X | B2 | MH-21 | MH-20, MH-25, MH-27, MH-28, MH-31, MH-32, MH-35, MH-46 |
| MH-25 Khung chương trình | X | B2 | MH-22 | MH-17, MH-26, MH-27, MH-36 |
| MH-26 Nhóm tự chọn | X | B2 | MH-25 | — |
| MH-27 Kết quả kiểm tra nhất quán | X | B2 | MH-25, MH-22 | — |
| MH-28 Bảng sức khỏe chương trình | X | B6 | MH-22 | — |
| MH-31 Chuẩn đầu ra chương trình (PLO) | X | B3 | MH-22 | MH-32 |
| MH-32 Ma trận CLO–PLO của chương trình | X | B3 | MH-22, MH-31 | MH-34, MH-35 |
| MH-34 Ma trận học phần–PLO | X | B3 | MH-32 | — |
| MH-35 Báo cáo độ bao phủ chuẩn đầu ra | X | B3 | MH-22, MH-32 | — |
| MH-36 Xem đề cương | X | B3 | MH-17, MH-25 | — |
| MH-40 Form đề xuất tổ chức và phân công | P | B4 | MH-38, MH-08 | — |
| MH-41 Chi tiết đề xuất | P | B4 | MH-38, MH-04, MH-02 | — |
| MH-46 Lịch sử phiên bản | X | B4 | MH-22 | MH-47, MH-48 |
| MH-47 Phiên bản chỉ đọc | X | B4 | MH-46 | — |
| MH-48 So sánh hai phiên bản | X | B4 | MH-46 | — |

### 4.3. R3 — Giám đốc CTĐT

| Mục menu | Màn hình | Mức | Bậc | Đi tiếp tới |
|---|---|---|---|---|
| Trang chính | MH-02 Trang chính | T | B1 | MH-41 |
| Tài khoản của tôi | MH-03 Tài khoản của tôi | T | B1 | — |
| Thông báo | MH-04 Thông báo | T | B4 | MH-41 |
| Phê duyệt › Ủy quyền | MH-14 Ủy quyền phê duyệt | P | B6 | — |
| Học phần | MH-16 Danh mục học phần | P | B1 | MH-17, MH-18 |
| Học phần › Nhóm tương đương | MH-19 Nhóm học phần tương đương | X | B1 | — |
| Chương trình đào tạo | MH-21 Danh sách chương trình đào tạo | P | B2 | MH-22 |
| Nhập liệu › Nhập từ Excel | MH-29 Nhập liệu từ Excel | P | B2 | — |
| Nhập liệu › Lịch sử phiên nhập | MH-30 Lịch sử phiên nhập | X | B2 | — |
| Đề xuất | MH-38 Danh sách đề xuất | P | B4 | MH-39, MH-41 |
| Phê duyệt › Chờ tôi duyệt | MH-42 Hàng đợi chờ duyệt | P | B4 | MH-41 |
| Báo cáo › Thống kê đề xuất | MH-44 Thống kê đề xuất | P | B6 | — |
| Sinh viên | MH-51 Danh sách sinh viên | X | B5 | MH-52 |
| Sinh viên › Xét tốt nghiệp theo lô | MH-54 Xét tốt nghiệp theo lô | P | B5 | — |
| Báo cáo › Đối sánh chương trình | MH-60 Đối sánh hai chương trình | X | B6 | — |
| Báo cáo › Phân bổ tín chỉ | MH-61 Phân bổ tín chỉ | X | B6 | — |
| Báo cáo › Xuất kiểm định | MH-62 Xuất hồ sơ kiểm định | P | B6 | — |

Màn hình không có mục menu riêng, vào từ màn hình khác:

| Màn hình | Mức | Bậc | Vào từ | Đi tiếp tới |
|---|---|---|---|---|
| MH-17 Chi tiết học phần | P | B1 | MH-16, MH-25 | MH-18, MH-20, MH-36, MH-39 |
| MH-18 Form học phần | P | B1 | MH-16, MH-17 | — |
| MH-20 Đồ thị quan hệ học phần | X | B6 | MH-17, MH-22 | — |
| MH-22 Tổng quan chương trình | P | B2 | MH-21 | MH-20, MH-23, MH-25, MH-27, MH-28, MH-31, MH-32, MH-35, MH-46 |
| MH-23 Form thông tin chương trình | P | B2 | MH-22 | MH-39 |
| MH-25 Khung chương trình | P | B2 | MH-22 | MH-17, MH-26, MH-27, MH-33, MH-36, MH-39 |
| MH-26 Nhóm tự chọn | P | B2 | MH-25 | — |
| MH-27 Kết quả kiểm tra nhất quán | P | B2 | MH-25, MH-22 | — |
| MH-28 Bảng sức khỏe chương trình | P | B6 | MH-22 | — |
| MH-31 Chuẩn đầu ra chương trình (PLO) | P | B3 | MH-22 | MH-32 |
| MH-32 Ma trận CLO–PLO của chương trình | X | B3 | MH-22, MH-31 | MH-33, MH-34, MH-35 |
| MH-33 Ma trận CLO–PLO của một học phần | P | B3 | MH-32, MH-25 | MH-39 |
| MH-34 Ma trận học phần–PLO | P | B3 | MH-32 | — |
| MH-35 Báo cáo độ bao phủ chuẩn đầu ra | X | B3 | MH-22, MH-32 | — |
| MH-36 Xem đề cương | X | B3 | MH-17, MH-25 | MH-37 |
| MH-37 Trình soạn đề cương | P | B3 | MH-36 | MH-39 |
| MH-39 Form đề xuất thay đổi | P | B4 | MH-38, MH-17, MH-23, MH-25, MH-33, MH-37 | — |
| MH-41 Chi tiết đề xuất | P | B4 | MH-38, MH-42, MH-04, MH-02 | — |
| MH-46 Lịch sử phiên bản | X | B4 | MH-22 | MH-47, MH-48 |
| MH-47 Phiên bản chỉ đọc | X | B4 | MH-46 | — |
| MH-48 So sánh hai phiên bản | X | B4 | MH-46 | — |
| MH-52 Hồ sơ sinh viên | X | B5 | MH-51 | MH-53 |
| MH-53 Xét tốt nghiệp một sinh viên | P | B5 | MH-52 | — |

### 4.4. R4 — Điều phối nhóm chuyên môn

| Mục menu | Màn hình | Mức | Bậc | Đi tiếp tới |
|---|---|---|---|---|
| Trang chính | MH-02 Trang chính | T | B1 | MH-41 |
| Tài khoản của tôi | MH-03 Tài khoản của tôi | T | B1 | — |
| Thông báo | MH-04 Thông báo | T | B4 | MH-41 |
| Quản trị › Nhóm chuyên môn | MH-08 Nhóm chuyên môn | X | B1 | MH-40 |
| Phê duyệt › Ủy quyền | MH-14 Ủy quyền phê duyệt | P | B6 | — |
| Học phần | MH-16 Danh mục học phần | P | B1 | MH-17, MH-18 |
| Học phần › Nhóm tương đương | MH-19 Nhóm học phần tương đương | X | B1 | — |
| Chương trình đào tạo | MH-21 Danh sách chương trình đào tạo | X | B2 | MH-22 |
| Đề xuất | MH-38 Danh sách đề xuất | P | B4 | MH-39, MH-40, MH-41 |
| Phê duyệt › Chờ tôi duyệt | MH-42 Hàng đợi chờ duyệt | P | B4 | MH-41 |
| Báo cáo › Thống kê đề xuất | MH-44 Thống kê đề xuất | P | B6 | — |
| Báo cáo › Đối sánh chương trình | MH-60 Đối sánh hai chương trình | X | B6 | — |
| Báo cáo › Phân bổ tín chỉ | MH-61 Phân bổ tín chỉ | X | B6 | — |

Màn hình không có mục menu riêng, vào từ màn hình khác:

| Màn hình | Mức | Bậc | Vào từ | Đi tiếp tới |
|---|---|---|---|---|
| MH-17 Chi tiết học phần | P | B1 | MH-16, MH-25 | MH-18, MH-20, MH-36, MH-39 |
| MH-18 Form học phần | P | B1 | MH-16, MH-17 | — |
| MH-20 Đồ thị quan hệ học phần | X | B6 | MH-17, MH-22 | — |
| MH-22 Tổng quan chương trình | X | B2 | MH-21 | MH-20, MH-25, MH-27, MH-31, MH-32, MH-35, MH-46 |
| MH-25 Khung chương trình | P | B2 | MH-22 | MH-17, MH-26, MH-27, MH-33, MH-36, MH-39 |
| MH-26 Nhóm tự chọn | X | B2 | MH-25 | — |
| MH-27 Kết quả kiểm tra nhất quán | X | B2 | MH-25, MH-22 | — |
| MH-31 Chuẩn đầu ra chương trình (PLO) | X | B3 | MH-22 | MH-32 |
| MH-32 Ma trận CLO–PLO của chương trình | X | B3 | MH-22, MH-31 | MH-33, MH-34, MH-35 |
| MH-33 Ma trận CLO–PLO của một học phần | P | B3 | MH-32, MH-25 | MH-39 |
| MH-34 Ma trận học phần–PLO | X | B3 | MH-32 | — |
| MH-35 Báo cáo độ bao phủ chuẩn đầu ra | X | B3 | MH-22, MH-32 | — |
| MH-36 Xem đề cương | X | B3 | MH-17, MH-25 | MH-37 |
| MH-37 Trình soạn đề cương | P | B3 | MH-36 | MH-39 |
| MH-39 Form đề xuất thay đổi | P | B4 | MH-38, MH-17, MH-25, MH-33, MH-37 | — |
| MH-40 Form đề xuất tổ chức và phân công | P | B4 | MH-38, MH-08 | — |
| MH-41 Chi tiết đề xuất | P | B4 | MH-38, MH-42, MH-04, MH-02 | — |
| MH-46 Lịch sử phiên bản | X | B4 | MH-22 | MH-47, MH-48 |
| MH-47 Phiên bản chỉ đọc | X | B4 | MH-46 | — |
| MH-48 So sánh hai phiên bản | X | B4 | MH-46 | — |

### 4.5. R5 — Giảng viên

| Mục menu | Màn hình | Mức | Bậc | Đi tiếp tới |
|---|---|---|---|---|
| Trang chính | MH-02 Trang chính | T | B1 | MH-41 |
| Tài khoản của tôi | MH-03 Tài khoản của tôi | T | B1 | — |
| Thông báo | MH-04 Thông báo | T | B4 | MH-41 |
| Học phần | MH-16 Danh mục học phần | P | B1 | MH-17, MH-18 |
| Học phần › Nhóm tương đương | MH-19 Nhóm học phần tương đương | X | B1 | — |
| Chương trình đào tạo | MH-21 Danh sách chương trình đào tạo | X | B2 | MH-22 |
| Đề xuất | MH-38 Danh sách đề xuất | P | B4 | MH-39, MH-41 |

Màn hình không có mục menu riêng, vào từ màn hình khác:

| Màn hình | Mức | Bậc | Vào từ | Đi tiếp tới |
|---|---|---|---|---|
| MH-17 Chi tiết học phần | P | B1 | MH-16, MH-25 | MH-18, MH-20, MH-36, MH-39 |
| MH-18 Form học phần | P | B1 | MH-16, MH-17 | — |
| MH-20 Đồ thị quan hệ học phần | X | B6 | MH-17, MH-22 | — |
| MH-22 Tổng quan chương trình | X | B2 | MH-21 | MH-20, MH-25, MH-31, MH-32, MH-46 |
| MH-25 Khung chương trình | P | B2 | MH-22 | MH-17, MH-26, MH-27, MH-33, MH-36, MH-39 |
| MH-26 Nhóm tự chọn | X | B2 | MH-25 | — |
| MH-27 Kết quả kiểm tra nhất quán | X | B2 | MH-25 | — |
| MH-31 Chuẩn đầu ra chương trình (PLO) | X | B3 | MH-22 | MH-32 |
| MH-32 Ma trận CLO–PLO của chương trình | X | B3 | MH-22, MH-31 | MH-33, MH-34 |
| MH-33 Ma trận CLO–PLO của một học phần | P | B3 | MH-32, MH-25 | MH-39 |
| MH-34 Ma trận học phần–PLO | X | B3 | MH-32 | — |
| MH-36 Xem đề cương | X | B3 | MH-17, MH-25 | MH-37 |
| MH-37 Trình soạn đề cương | P | B3 | MH-36 | MH-39 |
| MH-39 Form đề xuất thay đổi | P | B4 | MH-38, MH-17, MH-25, MH-33, MH-37 | — |
| MH-41 Chi tiết đề xuất | P | B4 | MH-38, MH-04, MH-02 | — |
| MH-46 Lịch sử phiên bản | X | B4 | MH-22 | MH-47, MH-48 |
| MH-47 Phiên bản chỉ đọc | X | B4 | MH-46 | — |
| MH-48 So sánh hai phiên bản | X | B4 | MH-46 | — |

### 4.6. R6 — Sinh viên

| Mục menu | Màn hình | Mức | Bậc | Đi tiếp tới |
|---|---|---|---|---|
| Tài khoản của tôi | MH-03 Tài khoản của tôi | T | B1 | — |
| Học phần | MH-16 Danh mục học phần | X | B1 | MH-17 |
| Trang chủ | MH-55 Trang chủ cổng sinh viên | X | B5 | MH-31 |
| Chương trình của tôi | MH-56 Chương trình của tôi | X | B5 | MH-17, MH-20, MH-36 |
| Tiến độ học tập | MH-57 Tiến độ học tập | X | B5 | — |
| Học phần kỳ tới | MH-58 Học phần đủ điều kiện kỳ tới | X | B5 | — |
| Xét tốt nghiệp | MH-59 Kết quả xét tốt nghiệp của tôi | X | B5 | — |

Màn hình không có mục menu riêng, vào từ màn hình khác:

| Màn hình | Mức | Bậc | Vào từ | Đi tiếp tới |
|---|---|---|---|---|
| MH-17 Chi tiết học phần | X | B1 | MH-16, MH-56 | MH-20, MH-36 |
| MH-20 Đồ thị quan hệ học phần | X | B6 | MH-17, MH-56 | — |
| MH-31 Chuẩn đầu ra chương trình (PLO) | X | B3 | MH-55 | — |
| MH-36 Xem đề cương | X | B3 | MH-17, MH-56 | — |

---

## 5. Bảng truy vết

### 5.1. Use case → màn hình

| UC | Màn hình | Ghi chú |
|---|---|---|
| UC-01 | MH-01, MH-02, MH-03 |  |
| UC-02 | MH-07, MH-08 |  |
| UC-03 | MH-08 |  |
| UC-04 | MH-08 |  |
| UC-05 | MH-05, MH-06 |  |
| UC-06 | MH-06, MH-15 |  |
| UC-07 | MH-22 |  |
| UC-08 | MH-14 |  |
| UC-09 | MH-40 |  |
| UC-10 | MH-16, MH-17 |  |
| UC-11 | MH-18 |  |
| UC-12 | MH-18 |  |
| UC-13 | MH-17 |  |
| UC-14 | MH-19 |  |
| UC-15 | MH-20 |  |
| UC-16 | MH-17, MH-39 |  |
| UC-17 | MH-17 |  |
| UC-18 | MH-21, MH-22, MH-25 |  |
| UC-19 | MH-23 |  |
| UC-20 | MH-24 |  |
| UC-21 | MH-25 |  |
| UC-22 | MH-26 |  |
| UC-23 | MH-25 |  |
| UC-24 | MH-22 |  |
| UC-25 | MH-31, MH-32 |  |
| UC-26 | MH-31 |  |
| UC-27 | MH-37 |  |
| UC-28 | MH-33 |  |
| UC-29 | MH-34 |  |
| UC-30 | MH-34 |  |
| UC-31 | MH-28, MH-35 |  |
| UC-32 | MH-36 |  |
| UC-33 | MH-37 |  |
| UC-34 | MH-37 |  |
| UC-35 | MH-37 |  |
| UC-36 | MH-37 |  |
| UC-37 | MH-39 |  |
| UC-38 | MH-39 |  |
| UC-39 | MH-41 |  |
| UC-40 | MH-38, MH-41 |  |
| UC-41 | MH-41 |  |
| UC-42 | MH-42 |  |
| UC-43 | MH-41 |  |
| UC-44 | MH-41 |  |
| UC-45 | MH-41 |  |
| UC-46 | MH-43 |  |
| UC-47 | MH-02, MH-04 |  |
| UC-48 | MH-03 | Hệ thống gửi email qua dịch vụ ngoài; người dùng chỉ thấy công tắc bật tắt ở MH-03 |
| UC-49 | MH-43, MH-45 |  |
| UC-50 | MH-48 |  |
| UC-51 | MH-46, MH-47 |  |
| UC-52 | MH-10, MH-50, MH-51, MH-52 |  |
| UC-53 | MH-49 |  |
| UC-54 | MH-27, MH-28 |  |
| UC-55 | MH-27 |  |
| UC-56 | MH-27 |  |
| UC-57 | MH-37 |  |
| UC-58 | MH-37 |  |
| UC-59 | MH-52, MH-56, MH-57 |  |
| UC-60 | MH-25, MH-52, MH-58 |  |
| UC-61 | MH-53, MH-59 |  |
| UC-62 | MH-54 |  |
| UC-63 | MH-58 |  |
| UC-64 | MH-53, MH-59 |  |
| UC-65 | MH-55 |  |
| UC-66 | MH-11 | API cho dDUT; phía quản trị chỉ có MH-11 |
| UC-67 | — | API cho dDUT, không có màn hình |
| UC-68 | — | API cho dDUT, không có màn hình |
| UC-69 | — | API cho dDUT, không có màn hình |
| UC-70 | — | API cho dDUT, không có màn hình |
| UC-71 | MH-29 |  |
| UC-72 | MH-29 |  |
| UC-73 | MH-29 |  |
| UC-74 | MH-30 |  |
| UC-75 | MH-29 |  |
| UC-76 | MH-12 |  |
| UC-77 | MH-13 | Tác vụ chạy theo lịch; kết quả xem ở MH-13 |
| UC-78 | MH-13 |  |
| UC-79 | MH-60 |  |
| UC-80 | MH-61 |  |
| UC-81 | MH-62 |  |
| UC-82 | MH-09 |  |
| UC-83 | MH-44 |  |
| UC-84 | MH-55, MH-56 |  |

### 5.2. Yêu cầu chức năng → màn hình

| FR | Màn hình | Ghi chú |
|---|---|---|
| FR-01 | MH-07 |  |
| FR-02 | MH-08 |  |
| FR-03 | MH-08 |  |
| FR-04 | MH-08 |  |
| FR-05 | MH-16, MH-18 |  |
| FR-06 | MH-05, MH-06 |  |
| FR-07 | MH-03, MH-06, MH-15 |  |
| FR-08 | MH-22 |  |
| FR-09 | MH-14 |  |
| FR-10 | MH-06 |  |
| FR-11 | MH-16, MH-17 |  |
| FR-12 | MH-18 |  |
| FR-13 | MH-18 |  |
| FR-14 | MH-18 |  |
| FR-15 | MH-18 |  |
| FR-16 | MH-18 |  |
| FR-17 | MH-17 |  |
| FR-18 | MH-17 |  |
| FR-19 | MH-17 |  |
| FR-20 | MH-17 |  |
| FR-21 | MH-19 |  |
| FR-22 | MH-20 |  |
| FR-23 | MH-21, MH-22, MH-23 |  |
| FR-24 | MH-22, MH-23 |  |
| FR-25 | MH-24 |  |
| FR-26 | MH-22 |  |
| FR-27 | MH-25 |  |
| FR-28 | MH-25 |  |
| FR-29 | MH-26 |  |
| FR-30 | MH-25 |  |
| FR-31 | MH-25 |  |
| FR-32 | MH-25 |  |
| FR-33 | MH-29 |  |
| FR-34 | MH-29 |  |
| FR-35 | MH-29 |  |
| FR-36 | MH-25 |  |
| FR-37 | MH-22 |  |
| FR-38 | MH-31 |  |
| FR-39 | MH-32, MH-37 |  |
| FR-40 | MH-32, MH-33 |  |
| FR-41 | MH-34 |  |
| FR-42 | MH-35 |  |
| FR-43 | MH-62 |  |
| FR-44 | MH-36 |  |
| FR-45 | MH-37 |  |
| FR-46 | MH-37 |  |
| FR-47 | MH-37 |  |
| FR-48 | MH-36, MH-37 |  |
| FR-49 | MH-37 |  |
| FR-50 | MH-37 |  |
| FR-51 | MH-37 |  |
| FR-52 | MH-37 |  |
| FR-53 | MH-37 |  |
| FR-54 | MH-37 |  |
| FR-55 | MH-39 |  |
| FR-56 | MH-38, MH-39, MH-40 |  |
| FR-57 | MH-39, MH-41 |  |
| FR-58 | MH-41 |  |
| FR-59 | MH-41 |  |
| FR-60 | MH-41 |  |
| FR-61 | MH-41 |  |
| FR-62 | MH-41 |  |
| FR-63 | MH-02, MH-04 |  |
| FR-64 | MH-03 |  |
| FR-65 | MH-42 |  |
| FR-66 | MH-42 |  |
| FR-67 | MH-41 |  |
| FR-68 | MH-39 |  |
| FR-69 | MH-43, MH-47 |  |
| FR-70 | MH-43, MH-45 |  |
| FR-71 | MH-47 |  |
| FR-72 | MH-48 |  |
| FR-73 | MH-46, MH-47 |  |
| FR-74 | MH-10, MH-50, MH-51, MH-52 |  |
| FR-75 | MH-49 |  |
| FR-76 | MH-46 |  |
| FR-77 | MH-27 |  |
| FR-78 | MH-27 |  |
| FR-79 | MH-27 |  |
| FR-80 | MH-27 |  |
| FR-81 | MH-27 |  |
| FR-82 | MH-28 |  |
| FR-83 | MH-52, MH-58 |  |
| FR-84 | MH-53, MH-59 |  |
| FR-85 | MH-53 |  |
| FR-86 | MH-53, MH-59 |  |
| FR-87 | MH-54 |  |
| FR-88 | MH-55 |  |
| FR-89 | MH-56 |  |
| FR-90 | MH-52, MH-57 |  |
| FR-91 | MH-58 |  |
| FR-92 | MH-58 |  |
| FR-93 | MH-36 |  |
| FR-94 | MH-11 | API cho dDUT; phía quản trị có MH-11 |
| FR-95 | MH-55, MH-56, MH-57, MH-58, MH-59 |  |
| FR-96 | MH-29 |  |
| FR-97 | MH-29 |  |
| FR-98 | MH-12 |  |
| FR-99 | MH-13 | Tác vụ đồng bộ chạy theo lịch; kết quả xem ở MH-13 |
| FR-100 | MH-13 |  |
| FR-101 | MH-30 |  |
| FR-102 | MH-60 |  |
| FR-103 | MH-61 |  |
| FR-104 | MH-62 |  |
| FR-105 | MH-09 | Việc ghi nhật ký diễn ra ở máy chủ; kết quả xem ở MH-09 |
| FR-106 | MH-09 |  |
| FR-107 | MH-44 |  |
| FR-108 | MH-38, MH-39 |  |
| FR-109 | MH-39 |  |

### 5.3. Thực thể → màn hình

Thực thể không có màn hình nào đọc hoặc ghi trực tiếp được ghi rõ lý do.

| Thực thể | Màn hình | Ghi chú |
|---|---|---|
| `AcademicResult` | MH-52, MH-53, MH-56, MH-57, MH-58 |  |
| `ApprovalDelegation` | MH-14 |  |
| `ApprovalLevelConfig` | — | Ba cấp duyệt được nạp sẵn và cố định (DEC-04); không có màn hình sửa |
| `ApprovalStep` | MH-02, MH-41, MH-42, MH-44 |  |
| `AssessmentCLOMapping` | MH-36, MH-37 |  |
| `AssessmentComponent` | MH-36, MH-37 |  |
| `AuditLog` | MH-06, MH-09 |  |
| `CLO` | MH-32, MH-33, MH-35, MH-36, MH-37 |  |
| `CLOPLOMapping` | MH-32, MH-33, MH-34, MH-35, MH-47, MH-48, MH-62 |  |
| `ChangeItem` | MH-39, MH-40, MH-41 |  |
| `ChangeRequest` | MH-02, MH-38, MH-39, MH-40, MH-41, MH-42, MH-43, MH-44 |  |
| `ChangeRequestDocument` | MH-39, MH-41 |  |
| `Cohort` | MH-10, MH-43, MH-45, MH-50, MH-51, MH-54 |  |
| `CohortVersion` | MH-43, MH-45, MH-46, MH-49, MH-50 |  |
| `Comment` | MH-41 |  |
| `Course` | MH-16, MH-17, MH-18, MH-19, MH-25 |  |
| `CoursePLOMapping` | MH-34, MH-62 |  |
| `CourseRelation` | MH-17, MH-20 |  |
| `CurriculumItem` | MH-17, MH-20, MH-25, MH-26, MH-27, MH-28, MH-32, MH-33, MH-34, MH-35, MH-47, MH-48, MH-56, MH-58, MH-60, MH-61 |  |
| `CurriculumRequisite` | MH-20, MH-25, MH-27, MH-58 |  |
| `ElectiveGroup` | MH-25, MH-26, MH-27, MH-47, MH-48, MH-56 |  |
| `EquivalentCourseGroup` | MH-17, MH-19, MH-60 |  |
| `GraduationAudit` | MH-53, MH-54, MH-59 |  |
| `ImportBatch` | MH-29, MH-30 |  |
| `IntegrationClient` | MH-11 |  |
| `KnowledgeBlock` | MH-25, MH-61 |  |
| `Notification` | MH-02, MH-04 |  |
| `OrgUnit` | MH-05, MH-07, MH-16 |  |
| `PLO` | MH-28, MH-31, MH-32, MH-33, MH-34, MH-35, MH-47, MH-48, MH-62 |  |
| `Permission` | MH-15 |  |
| `Program` | MH-21, MH-22, MH-23, MH-24 |  |
| `ProgramDirectorAssignment` | MH-03, MH-21, MH-22 |  |
| `ProgramEnrollment` | MH-51, MH-52, MH-53, MH-54, MH-55, MH-57, MH-59 |  |
| `ProgramVersion` | MH-21, MH-22, MH-23, MH-24, MH-27, MH-28, MH-31, MH-43, MH-45, MH-46, MH-47, MH-48, MH-49, MH-50, MH-52, MH-55, MH-57, MH-60, MH-61, MH-62 |  |
| `Role` | MH-06, MH-15 |  |
| `RoleAssignment` | MH-03, MH-06 |  |
| `RolePermission` | MH-15 |  |
| `Semester` | MH-10, MH-43, MH-45, MH-50 |  |
| `Student` | MH-51, MH-52, MH-55 |  |
| `SubjectGroup` | MH-08, MH-16, MH-40 |  |
| `SubjectGroupMember` | MH-03, MH-08, MH-40 |  |
| `Syllabus` | MH-17, MH-28, MH-36, MH-37, MH-45, MH-47, MH-48, MH-62 |  |
| `SyllabusAttachment` | MH-36, MH-37 |  |
| `SyncLog` | MH-12, MH-13 |  |
| `User` | MH-01, MH-03, MH-05, MH-06, MH-08, MH-14 |  |
| `WeeklyContent` | MH-36, MH-37 |  |
| `WeeklyContentCLO` | MH-37 |  |

---

## 6. Màn hình theo bậc

Dùng để biết mỗi phiên bản phát hành có những màn hình nào. Màn hình của bậc trước vẫn còn ở bậc sau.

| Bậc | Màn hình mới | Số mới | Cộng dồn |
|---|---|---|---|
| B1 | MH-01, MH-02, MH-03, MH-05, MH-06, MH-07, MH-08, MH-09, MH-15, MH-16, MH-17, MH-18, MH-19 | 13 | 13 |
| B2 | MH-21, MH-22, MH-23, MH-24, MH-25, MH-26, MH-27, MH-29, MH-30 | 9 | 22 |
| B3 | MH-31, MH-32, MH-33, MH-34, MH-35, MH-36, MH-37 | 7 | 29 |
| B4 | MH-04, MH-10, MH-38, MH-39, MH-40, MH-41, MH-42, MH-43, MH-45, MH-46, MH-47, MH-48, MH-49, MH-50 | 14 | 43 |
| B5 | MH-11, MH-51, MH-52, MH-53, MH-54, MH-55, MH-56, MH-57, MH-58, MH-59 | 10 | 53 |
| B6 | MH-12, MH-13, MH-14, MH-20, MH-28, MH-44, MH-60, MH-61, MH-62 | 9 | 62 |

---

## 7. Điểm còn hở

Mỗi điểm là một chỗ tài liệu nguồn bỏ trống hoặc không khớp nhau. Lựa chọn tạm đã được dùng để lập danh mục; đổi lựa chọn thì phải sửa các màn hình ở cột "Ảnh hưởng tới".

| Mã | Vấn đề | Lựa chọn tạm | Ảnh hưởng tới | Phụ thuộc vào |
|---|---|---|---|---|
| G-1 | SRS không có yêu cầu nào cho việc người dùng tự đổi mật khẩu, trong khi tài khoản là tài khoản nội bộ (Q-13) và tài khoản sinh viên được tạo tự động khi nhập danh sách (H-2) | MH-03 cho mọi người dùng đổi mật khẩu của chính mình. Sinh viên đăng nhập lần đầu bằng mật khẩu khởi tạo thì bị buộc đổi. Quên mật khẩu thì Phòng Đào tạo đặt lại ở MH-06 | MH-03, MH-06, MH-01 | Khoa trả lời H-2: mật khẩu khởi tạo của sinh viên được phát bằng cách nào |
| G-2 | Ma trận SRS mục 3.4 chỉ cho R1 quản lý đơn vị và nhóm chuyên môn và không có dòng "xem nhóm chuyên môn"; nhưng R2 và R4 phải thấy nhóm thì mới lập được đề xuất tổ chức (UC-09) | Từ B4, R2 và R4 vào MH-08 ở mức chỉ xem; R4 chỉ thấy nhóm mình điều phối. Ở B1..B3 chỉ R1 vào MH-08 | MH-08, MH-40 | Khoa (cùng câu hỏi với U-3) |
| G-3 | Ma trận SRS cho R6 quyền xem PLO và CLO, nhưng phần cổng sinh viên của SRS (FR-88..93) không nhắc tới PLO hay ma trận | Sinh viên xem danh sách PLO của phiên bản áp dụng cho mình ở MH-31 và xem CLO trong đề cương ở MH-36. Sinh viên không vào các màn hình ma trận MH-32, MH-33, MH-34 | MH-31, MH-36, MH-55 | Thầy hướng dẫn |
| G-4 | Bộ use case cho gần như mọi vai trò xem tiến độ và kết quả xét của sinh viên (UC-59, UC-60, UC-61); ma trận SRS chỉ ghi R6 xem của chính mình | Theo L-10 và U-8: nhóm H chỉ mở cho R1 (mọi sinh viên) và R3 (sinh viên của chương trình mình phụ trách). R2, R4, R5 không có màn hình nào hiện dữ liệu của từng sinh viên | MH-51, MH-52, MH-53, MH-54, MH-25 | Phòng Đào tạo |
| G-5 | SRS không mô tả trang chính sau đăng nhập gồm những gì | MH-02 là trang lối tắt theo vai trò. Từ B4 có thêm ba con số: đề xuất của tôi, đề xuất chờ tôi duyệt, thông báo chưa đọc. Không có biểu đồ | MH-02 | Không cần hỏi |
| G-6 | Xem lại một phiên bản đã ban hành (FR-73) có thể là một màn hình riêng hoặc là các màn hình soạn thảo ở chế độ khóa | Ghi thành một màn hình riêng MH-47 để việc "không có nút sửa" kiểm được. Khi hiện thực, MH-47 được phép dùng lại các phần hiển thị của MH-22, MH-25, MH-31, MH-32 | MH-47, MH-46; số màn hình của nhóm G | Không cần hỏi |
| G-7 | NFR-24 yêu cầu tham số nghiệp vụ nằm trong cấu hình, nhưng không nói có màn hình để sửa hay không; từ điển dữ liệu cũng không có thực thể cấu hình (E-7) | Không có màn hình sửa tham số nghiệp vụ: người triển khai sửa trong tệp cấu hình (K-5). Riêng kết nối và lịch đồng bộ có màn hình MH-12 vì FR-98 nêu rõ Phòng Đào tạo cấu hình | MH-12; mọi màn hình dùng tham số (MH-33, MH-37, MH-42) | E-7 |
| G-8 | Ma trận SRS cho R6 xem danh mục học phần và đề cương không giới hạn, nhưng cho xem chương trình chỉ trong phạm vi (ô P) | Sinh viên vào được MH-16, MH-17, MH-36 cho mọi học phần, nhưng chỉ thấy bản đề cương đã ban hành. Khung và PLO thì chỉ của phiên bản áp dụng cho mình; không có đường vào MH-21 | MH-16, MH-17, MH-36, MH-20 | Thầy hướng dẫn |
