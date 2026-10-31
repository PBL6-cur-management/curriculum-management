# TỪ ĐIỂN DỮ LIỆU v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-11 |
| Đi kèm | `docs/design/erd.md` (quan hệ, quyết định mô hình M-1..M-10, điểm hở E-1..E-13) |
| Nguồn | `docs/requirement/REQUIREMENTS.md` mục 4.2, 4.3, 6, 7, 11 |
| Mức | Logic — kiểu dữ liệu ở đây là kiểu nghiệp vụ, không phải kiểu của hệ quản trị cơ sở dữ liệu |

---

## Quy ước

- **Khóa.** Mọi thực thể có một khóa đại diện `id`, không liệt kê trong bảng. Dòng "Duy nhất" dưới mỗi thực thể ghi khóa tự nhiên.
- **Tên lập trình** là tên tiếng Anh dùng ở mọi tài liệu thiết kế và kế hoạch: thực thể viết hoa chữ đầu mỗi từ (`ProgramVersion`), thuộc tính viết thường chữ đầu (`courseCode`), từ viết tắt giữ chữ hoa (`PLO`, `CLOPLOMapping`). Phần giải thích vẫn viết tiếng Việt.
- **Tên SRS** là tên tương ứng trong SRS mục 4.2, 4.3, dùng để đối chiếu với SRS và bộ use case. Tên thực thể SRS ghi ở tiêu đề mỗi thực thể và ở mục 10; tên thuộc tính SRS ghi ở cột Tên SRS. `—` nghĩa là SRS không có tên này (thực thể hoặc thuộc tính bổ sung). Bảng tra gộp tên thực thể, thuộc tính và giá trị liệt kê: `docs/design/naming-map.md`, sinh từ tài liệu này.
- **Một từ SRS, một tên lập trình.** Cùng một tên thuộc tính SRS luôn ứng với cùng một tên lập trình ở mọi thực thể (trangThai → `status`).
- **Cột BB:** `C` = bắt buộc · `K` = được để trống.
- **Dấu ⊕** trước tên: thực thể hoặc thuộc tính không có trong SRS mục 4.2, được thêm ở mô hình này.
- **Kiểu:**

| Kiểu | Nghĩa |
|---|---|
| Chuỗi | Văn bản ngắn một dòng |
| Văn bản | Văn bản dài, có thể có định dạng (FR-46) |
| Số nguyên · Số thực | Số thực dùng cho tín chỉ và điểm; **cấm lưu tín chỉ bằng số nguyên** (EC-02) |
| Logic | Có / không |
| Ngày · Thời điểm | Ngày lịch · ngày kèm giờ |
| Liệt kê | Một giá trị trong danh sách cố định. Cột mô tả ghi từng giá trị dạng mã lập trình rồi nhãn tiếng Việt hiển thị cho người dùng (`DRAFT` Nháp). Giá trị vốn đã là ký hiệu thì mã trùng nhãn (`PDF`, `I`) |
| JSON | Dữ liệu có cấu trúc lưu nguyên khối |
| → `X` | Tham chiếu tới một dòng của thực thể `X` |

---

## 1. Tổ chức và người dùng

### `OrgUnit` — SRS: DonVi

Đơn vị trong cây tổ chức Trường → Phòng Đào tạo, Trường → Khoa (FR-01). Nhóm chuyên môn là thực thể riêng.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| unitCode | maDonVi | Chuỗi | C | |
| unitName | tenDonVi | Chuỗi | C | |
| unitType | loaiDonVi | Liệt kê | C | `UNIVERSITY` Trường · `FACULTY` Khoa · `OFFICE` Phòng |
| parentUnit | donViCha | → `OrgUnit` | K | Chỉ nút Trường được để trống. Khoa và Phòng nằm ngay dưới Trường; máy chủ từ chối đổi cha tạo vòng |
| ⊕ status | — | Liệt kê | C | `ACTIVE` Đang hoạt động · `INACTIVE` Ngừng hoạt động. Không xóa đơn vị đã có dữ liệu. Không ngừng được khi còn đơn vị con hoặc nhóm chuyên môn đang hoạt động |

Duy nhất: `unitCode`. `unitCode` và `unitType` không đổi sau khi tạo.

### `SubjectGroup` — SRS: NhomChuyenMon

Nhóm chuyên môn thuộc khoa (FR-02). Người điều phối không lưu ở đây — xem `SubjectGroupMember`.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| groupCode | maNhom | Chuỗi | C | |
| groupName | tenNhom | Chuỗi | C | |
| faculty | khoa | → `OrgUnit` | C | Đơn vị loại Khoa |
| ⊕ status | — | Liệt kê | C | `ACTIVE` Đang sử dụng · `INACTIVE` Ngừng sử dụng. Ngừng sử dụng giữ nguyên các dòng `SubjectGroupMember` nhưng thành viên, Điều phối mất phạm vi trên nhóm |

Duy nhất: `groupCode`; không đổi sau khi tạo.

### `User` — SRS: NguoiDung

Tài khoản của mọi vai trò, kể cả sinh viên. Không xóa cứng tài khoản đã phát sinh giao dịch (FR-06, EC-51).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| userCode | maNguoiDung | Chuỗi | C | Mã cán bộ hoặc mã sinh viên |
| fullName | hoTen | Chuỗi | C | |
| email | email | Chuỗi | K | Bắt buộc với người nhận thông báo qua email (FR-64) |
| orgUnit | donVi | → `OrgUnit` | K | Trống với sinh viên |
| status | trangThai | Liệt kê | C | `ACTIVE` Hoạt động · `DISABLED` Vô hiệu hóa |
| ⊕ username | — | Chuỗi | C | Tài khoản nội bộ (quyết định tạm của Q-13) |
| ⊕ passwordHash | — | Chuỗi | C | Không lưu mật khẩu dạng rõ (NFR-06) |
| ⊕ mustChangePassword | — | Logic | C | Mặc định sai; đúng với tài khoản khởi tạo và sau khi R1 đặt lại mật khẩu — chỉ gọi được `me`, đổi mật khẩu, đăng xuất cho tới khi đổi (F00-16, F01-04) |

Duy nhất: `userCode`; `username` (lưu đã cắt khoảng trắng, chữ thường).

### `Role` — SRS: VaiTro

Sáu vai trò R1..R6 của SRS mục 3.1. Vai trò được làm gì ghi ở `RolePermission` (M-10).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| roleCode | maVaiTro | Chuỗi | C | |
| roleName | tenVaiTro | Chuỗi | C | |
| description | moTa | Chuỗi | K | |
| ⊕ isSystemRole | — | Logic | C | Có với R1..R6: không xóa, không đổi mã. Để dành cho vai trò tự định nghĩa (E-13); hiện chưa có đường tạo vai trò mới (F02-03) |
| ⊕ scopeSource | — | Liệt kê | C | `NONE` gán tay qua `RoleAssignment` · `PROGRAM_DIRECTOR` suy ra từ `ProgramDirectorAssignment` · `SUBJECT_GROUP_COORDINATOR` suy ra từ `SubjectGroupMember` vai trò Điều phối · `SUBJECT_GROUP_MEMBER` suy ra từ mọi dòng `SubjectGroupMember` · `OWN_ENROLLMENT` suy ra từ `ProgramEnrollment` của chính sinh viên. R1, R2 = `NONE`; R3..R6 lần lượt bốn giá trị còn lại. Người dùng giữ vai trò suy ra đúng khi bảng nguồn có dòng còn hiệu lực (M-7) — không gán tay lần thứ hai |

Duy nhất: `roleCode`.

### ⊕ `Permission`

Danh mục chức năng mà máy chủ kiểm quyền (M-10). Danh sách ban đầu ở mục 9.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| permissionCode | — | Chuỗi | C | Dạng đối tượng.hành động, ví dụ syllabus.edit. Mã kiểm quyền tham chiếu tới mã này nên không đổi mã sau khi đã dùng |
| permissionName | — | Chuỗi | C | |
| functionGroup | — | Liệt kê | C | `SYSTEM_ADMIN` Quản trị hệ thống · `COURSE_CATALOG` Danh mục học phần · `PROGRAM` Chương trình đào tạo · `LEARNING_OUTCOME` Chuẩn đầu ra · `SYLLABUS` Đề cương chi tiết · `APPROVAL` Quy trình phê duyệt · `VERSION` Phiên bản · `DATA_REPORT` Dữ liệu và báo cáo · `STUDENT_LOOKUP` Tra cứu sinh viên (các nhóm của SRS mục 3.4) |
| description | — | Chuỗi | K | |
| source | — | Chuỗi | K | Dòng SRS mục 3.4 hoặc mã yêu cầu sinh ra quyền này |

Duy nhất: `permissionCode`. Ràng buộc: không xóa quyền còn dòng `RolePermission`.

### ⊕ `RolePermission`

Vai trò nào có quyền nào, ghi thẳng hay phải qua đề xuất, trên mọi đối tượng hay chỉ trong phạm vi (M-10). Không có dòng nghĩa là không có quyền. R1 sửa ô của sáu vai trò có sẵn trên MH-15 (F02-02); mỗi lần sửa ghi `updatedBy` và một dòng nhật ký ứng dụng có giá trị trước/sau (nhật ký kiểm toán hoãn theo F01-07). Ô R1 × `permission.manage` và R1 × `user.manage` bị khóa để R1 không tự mất đường quản trị.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| role | — | → `Role` | C | |
| permission | — | → `Permission` | C | |
| mode | — | Liệt kê | C | `DIRECT` Trực tiếp · `VIA_REQUEST` Qua đề xuất. Qua đề xuất là ô `Đ` của SRS. Dữ liệu đã ban hành vẫn chỉ đổi qua đề xuất với mọi chế độ (FR-55); bản Nháp thì cả hai chế độ đều sửa trực tiếp (H-4) |
| scope | — | Liệt kê | C | `ALL` Toàn bộ · `SCOPED` Theo phạm vi. Theo phạm vi là ô `P` của SRS; phạm vi đọc ở chỗ M-7 chỉ ra, với Sinh viên là các dòng `ProgramEnrollment` của chính mình |

| ⊕ updatedBy | — | → `User` | K | Người sửa ô gần nhất; trống với ô nạp sẵn |

Duy nhất: (`role`, `permission`).

### `RoleAssignment` — SRS: PhanQuyen

Một người dùng giữ một vai trò trong một phạm vi, có thời hạn (FR-07). Chỉ chứa vai trò có `scopeSource` = `NONE` (R1, R2), phạm vi `SYSTEM` hoặc `UNIT`; vai trò suy ra (R3..R6) không có dòng ở đây. Dòng không bao giờ bị xóa hay sửa vai trò, phạm vi, thời hạn: thu hồi ghi `revokedAt`/`revokedBy`, đổi phạm vi = thu hồi dòng cũ + thêm dòng mới. Các dòng này chính là lịch sử phân quyền của FR-10 / US-006 khi nhật ký kiểm toán còn hoãn (F01-07).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| user | nguoiDung | → `User` | C | |
| role | vaiTro | → `Role` | C | |
| scopeType | loaiPhamVi | Liệt kê | C | `SYSTEM` Toàn hệ thống · `UNIT` Đơn vị · `ASSIGNMENT` Theo phân công. Dòng lưu chỉ có `SYSTEM` hoặc `UNIT`; `ASSIGNMENT` chỉ xuất hiện khi hiển thị vai trò suy ra (M-7) |
| scopeUnit | donViPhamVi | → `OrgUnit` | K | Bắt buộc khi `scopeType` = Đơn vị; phạm vi gồm đơn vị đó và mọi đơn vị con |
| validFrom | tuNgay | Ngày | C | Ngày lịch theo giờ Việt Nam |
| validTo | denNgay | Ngày | K | Trống = không thời hạn; còn hiệu lực trọn ngày `validTo` |
| ⊕ assignedBy | — | → `User` | K | Người gán; trống với dòng nạp sẵn |
| ⊕ revokedAt | — | Ngày giờ | K | Có = đã thu hồi, không còn hiệu lực |
| ⊕ revokedBy | — | → `User` | K | Bắt buộc khi có `revokedAt` |

Duy nhất: (`user`, `role`, `scopeUnit`, `validFrom`). PostgreSQL coi `scopeUnit` trống là khác nhau, nên máy chủ còn kiểm không chồng thời hạn giữa các dòng chưa thu hồi cùng (`user`, `role`, `scopeUnit`).

### `SubjectGroupMember` — SRS: ThanhVienNhomCM

Giảng viên thuộc nhóm chuyên môn, quan hệ n–n (FR-03). Dòng có vai trò "Điều phối" chính là việc chỉ định Điều phối nhóm chuyên môn (FR-04).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| subjectGroup | nhomChuyenMon | → `SubjectGroup` | C | |
| lecturer | giangVien | → `User` | C | |
| memberRole | vaiTroTrongNhom | Liệt kê | C | `MEMBER` Thành viên · `COORDINATOR` Điều phối |
| ⊕ validFrom | — | Ngày | C | Thời gian hiệu lực mà FR-04 yêu cầu; ngày lịch theo giờ Việt Nam |
| ⊕ validTo | — | Ngày | K | Trống = không thời hạn; còn hiệu lực trọn ngày `validTo` |
| ⊕ assignedBy | — | → `User` | K | Người gán |
| ⊕ revokedAt | — | Ngày giờ | K | Có = dòng nhập nhầm, đã thu hồi, không còn hiệu lực |
| ⊕ revokedBy | — | → `User` | K | Bắt buộc khi có `revokedAt` |

Ràng buộc:
- Một nhóm có thể có nhiều Điều phối cùng lúc; mọi Điều phối đang hiệu lực đều duyệt cấp 1 (F03-04).
- Không có hai dòng chưa thu hồi cùng (`subjectGroup`, `lecturer`, `memberRole`) chồng thời hạn (US-009 AC3).
- Dòng `COORDINATOR` phải nằm trọn trong thời hạn của một dòng `MEMBER` chưa thu hồi của cùng người, cùng nhóm (US-010 AC3).
- Dòng còn hiệu lực = chưa thu hồi, `validFrom` ≤ hôm nay ≤ `validTo` (hoặc `validTo` trống), **và** nhóm đang `ACTIVE`.
- Không xóa, không kéo dài tại chỗ: "kết thúc" chỉ đặt hoặc rút ngắn `validTo`; kéo dài = thêm dòng mới. Kết thúc dòng `MEMBER` thì các dòng `COORDINATOR` bên trong kết thúc theo (thu hồi nếu chưa bắt đầu). Thu hồi dòng `MEMBER` bị từ chối khi còn dòng `COORDINATOR` dựa vào.

### `ProgramDirectorAssignment` — SRS: PhanCongGiamDoc

Giám đốc CTĐT phụ trách 1..n chương trình (FR-08, FR-26).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| director | giamDoc | → `User` | C | |
| program | chuongTrinh | → `Program` | C | |
| validFrom | ngayBatDau | Ngày | C | Tên SRS `startDate`; đổi tên để dùng chung quy tắc thời hạn với `SubjectGroupMember` |
| validTo | ngayKetThuc | Ngày | K | Tên SRS `endDate`. Trống = không thời hạn |
| ⊕ assignedBy | — | → `User` | K | R1 phân công |
| ⊕ revokedAt | — | Thời điểm | K | Thu hồi dòng nhập nhầm |
| ⊕ revokedBy | — | → `User` | K | |

Ràng buộc (F06-06, US-020):
- Một chương trình có thể có nhiều Giám đốc CTĐT cùng lúc; mọi người đang hiệu lực đều duyệt cấp 2.
- Không có hai dòng chưa thu hồi cùng (`program`, `director`) chồng thời hạn. Người được phân công phải là tài khoản đang hoạt động.
- Dòng còn hiệu lực = chưa thu hồi, `validFrom` ≤ hôm nay ≤ `validTo` (hoặc `validTo` trống), **và** chương trình đang `ACTIVE`. Phạm vi R3 tính từ các dòng này ở mỗi yêu cầu.
- Không xóa, không kéo dài tại chỗ: "kết thúc" chỉ đặt hoặc rút ngắn `validTo`; kéo dài = thêm dòng mới. Dòng hết hạn vẫn hiện trong lịch sử.
- Chỉ R1 phân công, kết thúc, thu hồi.

### `ApprovalDelegation` — SRS: UyQuyenDuyet

Ủy quyền phê duyệt có thời hạn; hết hạn tự thu hồi (FR-09, EC-25).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| delegator | nguoiUyQuyen | → `User` | C | |
| delegate | nguoiDuocUyQuyen | → `User` | C | Khác `delegator` |
| scope | phamVi | → `ApprovalLevelConfig` | K | Cấp duyệt được ủy quyền. Trống = mọi cấp mà người ủy quyền đang duyệt |
| ⊕ validFrom | — | Ngày | C | |
| validTo | denNgay | Ngày | C | "Thời hạn" trong SRS |
| ⊕ status | — | Liệt kê | C | `ACTIVE` Hiệu lực · `EXPIRED` Hết hạn · `REVOKED` Đã thu hồi |

---

## 2. Học phần

### `Course` — SRS: HocPhan

Học phần trong danh mục dùng chung (FR-11..16). Không gắn phiên bản; thông tin của học phần tại thời điểm ban hành được chép vào dòng khung (M-5).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| courseCode | maHocPhan | Chuỗi | C | Ví dụ 3190111. Cắt khoảng trắng, viết hoa khi ghi; không sửa được sau khi tạo (F04-04) |
| courseName | tenHocPhan | Chuỗi | C | Tên tiếng Việt (FR-13) |
| englishName | tenTiengAnh | Chuỗi | K | |
| credits | soTinChi | Số thực | C | ≥ 0; nhận 0 và số lẻ như 2.5 (BR-01) |
| ownerFaculty | khoaPhuTrach | → `OrgUnit` | C | Có thể là khoa khác (FR-05) |
| ownerGroup | nhomPhuTrach | → `SubjectGroup` | K | Trống với học phần của khoa khác. Khi có, phải là nhóm đang hoạt động thuộc chính `ownerFaculty` |
| courseType | loaiHocPhan | Liệt kê | C | `THEORY` Lý thuyết · `PRACTICE` Thực hành · `LAB` Thí nghiệm · `PROJECT` Đồ án · `CAPSTONE` Đồ án tốt nghiệp · `INTERNSHIP` Thực tập · `CONDITIONAL` Học phần điều kiện |
| status | trangThai | Liệt kê | C | `ACTIVE` Đang sử dụng · `DISCONTINUED` Ngừng mở lớp · `CANCELLED` Đã hủy. "Ngừng mở lớp" đòi một quan hệ QH5 trỏ tới học phần thay thế đang sử dụng (FR-15). "Đã hủy" là trạng thái cuối, chỉ cho học phần chưa từng nằm trong phiên bản đã ban hành và chưa có kết quả học tập; "Ngừng mở lớp" mở lại được (F04-02). Chỉ R1 đổi trạng thái |
| ⊕ equivalenceGroup | — | → `EquivalentCourseGroup` | K | Một học phần thuộc nhiều nhất một nhóm (M-4) |

Duy nhất: `courseCode`.

Quyền sửa (F04-01, F04-05): học phần của khoa khác chỉ R1 sửa; Khoa CNTT chỉ đề xuất. Học phần đã nằm trong một phiên bản không còn Nháp thì thông tin danh mục chỉ sửa qua đề xuất thay đổi; trước đó sửa trực tiếp theo ô quyền `course.edit`. Học phần "khoa khác" = khoa phụ trách khác `KHOA_CNTT`.

### `CourseRelation` — SRS: QuanHeHocPhan

Quan hệ có hướng giữa hai học phần ở cấp danh mục (FR-18..20).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| sourceCourse | hocPhanNguon | → `Course` | C | Học phần phải học trước / đạt trước / học cùng; hoặc học phần ngừng mở lớp (QH5) |
| targetCourse | hocPhanDich | → `Course` | C | Khác `sourceCourse` |
| relationType | loaiQuanHe | Liệt kê | C | `PRIOR` QH1 Học trước · `PREREQUISITE` QH2 Tiên quyết · `COREQUISITE` QH3 Song hành · `REPLACEMENT` QH5 Thay thế |
| minScore | nguongDiem | Số thập phân (4,2) | K | "Điều kiện điểm kèm theo"; chỉ dùng với QH2 (FR-19); thang 4, từ 0 đến 4 (F05-03, DEC-11). Trống = không yêu cầu điểm; khi đó lấy `minStudiedScore` của mục khung (F05-02). Xem E-1 |

Duy nhất: (`sourceCourse`, `targetCourse`, `relationType`). Ràng buộc: `sourceCourse` khác `targetCourse`; không quan hệ với học phần Đã hủy; đồ thị QH1 và QH2 không có chu trình (BR-11) — QH3 được khai báo cả hai chiều, QH3 và QH5 không xét chu trình (F05-04). Khi báo chu trình, thông báo nêu đường đi của vòng theo mã học phần.

Quyền sửa: quan hệ thuộc về học phần đích với QH1, QH2, QH3 và học phần nguồn với QH5; phạm vi và đường sửa (trực tiếp hay qua đề xuất) xét theo học phần đó, như thông tin danh mục của `Course`. Không gỡ được quan hệ QH5 cuối cùng còn hiệu lực của một học phần Ngừng mở lớp.

### `EquivalentCourseGroup` — SRS: NhomHocPhanTuongDuong

Nhóm học phần thay thế được cho nhau khi xét tốt nghiệp (FR-21, DEC-06). Thành viên là các học phần có `equivalenceGroup` trỏ tới nhóm. Không gắn phiên bản (EC-16; xem E-11).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| groupCode | maNhom | Chuỗi | C | |
| note | ghiChu | Chuỗi | K | |

Duy nhất: `groupCode` (lưu đã cắt khoảng trắng, chữ hoa). Ràng buộc: ít nhất 2 học phần; mỗi học phần thuộc nhiều nhất một nhóm — thêm học phần đã thuộc nhóm khác bị chặn và đề nghị gộp hai nhóm (F05-01). Bớt thành viên khi còn 2 bị chặn; kết thúc nhóm bằng "giải thể". Chỉ R1 tạo, sửa, gộp, giải thể; sửa trực tiếp kể cả sau ban hành vì nhóm nằm ngoài ảnh chụp phiên bản (M-4, E-11).

---

## 3. Chương trình đào tạo

### `Program` — SRS: ChuongTrinhDaoTao

Danh tính của một chương trình. Phần mô tả nằm ở `ProgramVersion` (M-3).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| programCode | maChuongTrinh | Chuỗi | C | Ví dụ 1024034 |
| ⊕ faculty | — | → `OrgUnit` | C | Khoa quản lý |
| degreeLevel | trinhDo | Liệt kê | C | `ENGINEER` Kỹ sư · `BACHELOR` Cử nhân (FR-24) |
| status | trangThai | Liệt kê | C | `ACTIVE` Đang sử dụng · `INACTIVE` Ngừng sử dụng. Cấm xóa cứng (EC-50) |
| ⊕ clonedFrom | — | → `ProgramVersion` | K | Phiên bản được dùng làm nền khi nhân bản (FR-25) |

Duy nhất: `programCode` (cắt khoảng trắng; không sửa được sau khi tạo).

Quyền sửa (F06-02, F06-03): chỉ R1 tạo chương trình, đổi trạng thái và nhân bản. Thông tin mô tả (trên phiên bản Nháp) và `degreeLevel` sửa trực tiếp theo ô quyền `program.editInfo` (R1 toàn trường, R3 chương trình mình phụ trách) cho đến khi chương trình có phiên bản rời Nháp; sau đó chỉ sửa qua đề xuất thay đổi. Chương trình mới luôn kèm một phiên bản Nháp. Nhân bản tạo chương trình mới với phiên bản Nháp chép từ phiên bản nguồn, chưa có Giám đốc CTĐT.

### `ProgramVersion` — SRS: PhienBanCTDT

Một phiên bản của chương trình. Bất biến từ khi rời trạng thái Nháp (FR-71, BR-23).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| program | chuongTrinh | → `Program` | C | |
| versionNumber | soPhienBan | Chuỗi | K | Dạng `<Chính>.<Phụ>` (BR-24). Trống khi còn Nháp |
| status | trangThai | Liệt kê | C | `DRAFT` Nháp · `PENDING` Chờ hiệu lực · `ACTIVE` Đang hiệu lực · `HISTORICAL` Lịch sử (M-2) |
| programName | tenChuongTrinh | Chuỗi | C | |
| majorCode | maNganh | Chuỗi | C | Ví dụ 7480201 |
| majorName | tenNganh | Chuỗi | C | |
| semesterCount | soHocKy | Số nguyên | C | Ví dụ 8 |
| totalCredits | tongTinChi | Số thực | C | Tổng tín chỉ yêu cầu, ví dụ 130 |
| compulsoryCredits | tinChiBatBuoc | Số thực | C | Ví dụ 122 |
| electiveCredits | tinChiTuChon | Số thực | C | Ví dụ 8. `compulsoryCredits` + `electiveCredits` = `totalCredits` (BR-03) |
| decisionNumber | soQuyetDinh | Chuỗi | K | Số quyết định ban hành. Bắt buộc khi rời Nháp |
| signedDate | ngayKy | Ngày | K | Bắt buộc khi rời Nháp |
| effectiveSemester | hocKyHieuLuc | → `Semester` | K | Bắt buộc khi rời Nháp; hiệu lực từ đầu học kỳ (BR-25) |
| publishedBy | nguoiBanHanh | → `User` | K | Bắt buộc khi rời Nháp |
| ⊕ publishedAt | — | Thời điểm | K | |
| ⊕ previousVersion | — | → `ProgramVersion` | K | Phiên bản làm nền; trống ở phiên bản đầu tiên |
| ⊕ correctionOf | — | → `ProgramVersion` | K | Phiên bản ban hành nhầm mà bản này đính chính (FR-75) |
| ⊕ correctionReason | — | Chuỗi | K | Bắt buộc khi có `correctionOf` (DEC-08) |
| ⊕ sourceRequest | — | → `ChangeRequest` | K | Trống ở phiên bản khởi tạo và bản đính chính. Xem E-3 |
| ⊕ creditMismatchReason | — | Chuỗi | K | Lý do ghi đè khi tổng tín chỉ tính được khác số khai báo (FR-78) |
| ⊕ creditMismatchCompulsoryGap | — | Số thực | K | Chênh lệch tín chỉ bắt buộc (tính từ khung − khai báo) tại lúc chấp nhận; có thể âm |
| ⊕ creditMismatchElectiveGap | — | Số thực | K | Chênh lệch tín chỉ tự chọn tại lúc chấp nhận; có thể âm |
| ⊕ creditMismatchAcceptedBy | — | → `User` | K | Người chấp nhận chênh lệch (US-030 AC3) |
| ⊕ creditMismatchAcceptedAt | — | Thời điểm | K | Thời điểm chấp nhận |

Năm cột `creditMismatch*` hoặc cùng có giá trị, hoặc cùng rỗng. Việc chấp nhận chỉ còn hiệu lực khi chênh lệch bắt buộc và tự chọn hiện tại đúng bằng hai giá trị đã lưu; chênh lệch đổi thì cảnh báo hiện lại mà không cần xóa (US-030 AC4). Chỉ chấp nhận trên phiên bản Nháp; nhân bản chương trình không chép các cột này. Kết quả kiểm tra nhất quán không lưu (F08-03), chỉ việc chấp nhận được lưu.

Duy nhất: (`program`, `versionNumber`). Ràng buộc: mỗi chương trình có nhiều nhất một phiên bản Đang hiệu lực (BR-22) và nhiều nhất một phiên bản Nháp — cả hai giữ bằng chỉ mục duy nhất có điều kiện. Số tín chỉ lưu Số thập phân (5,2). Khóa áp dụng ghi ở `CohortVersion`.

### `CurriculumItem` — SRS: DongKhungCTDT

Một dòng của khung chương trình, tương ứng một dòng trong bảng Excel hiện hành (FR-27). Đồng thời là cặp (phiên bản chương trình, học phần) mà các ma trận chuẩn đầu ra bám vào (M-6).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| programVersion | phienBan | → `ProgramVersion` | C | |
| sortOrder | thuTu | Số nguyên | C | Thứ tự trong một học kỳ (từ 1). Cột TT của Excel không lưu: suy ra khi đọc theo (`plannedSemester`, `sortOrder`) |
| plannedSemester | hocKyDuKien | Số nguyên | C | 1..`semesterCount` của phiên bản (EC-08) |
| course | hocPhan | → `Course` | C | |
| blockSymbol | kyHieu | Chuỗi | K | Mã khối kiến thức, giữ nguyên giá trị gốc (DEC-05). Xem E-2 |
| isElective | laTuChon | Logic | C | Cột Tự chọn |
| electiveGroup | nhomTuChon | → `ElectiveGroup` | K | Chỉ có khi `isElective` (EC-05); cùng phiên bản với dòng khung |
| htDa | htDA | Logic | C | Cột HT ĐA. Lưu nguyên trạng, chưa gắn logic (Q-04) |
| tqDa | tqDA | Logic | C | Cột TQ ĐA. Như trên |
| minStudiedScore | diemHoc | Số thực | K | Cột Điểm học, thang 4, `Decimal(4,2)`. Giá trị mẫu 3 · 3.5 · 4 |
| minTransferScore | diemChuyen | Số thực | K | Cột Điểm chuyển, thang 4, `Decimal(4,2)` |
| note | ghiChu | Chuỗi | K | |
| ⊕ syllabus | — | → `Syllabus` | K | Bản đề cương được ghim (M-1); phải thuộc đúng `course`. Bắt buộc khi phiên bản rời Nháp (EC-44) |
| ⊕ courseNameSnapshot | — | Chuỗi | K | Tên học phần tại thời điểm ban hành (M-5). Ghi khi phiên bản rời Nháp |
| ⊕ creditsSnapshot | — | Số thực | K | Số tín chỉ tại thời điểm ban hành (M-5). Ghi khi phiên bản rời Nháp |

Duy nhất: (`programVersion`, `course`) — một học phần không xuất hiện hai lần trong một khung (EC-06, FR-81).

### `ElectiveGroup` — SRS: NhomTuChon

Nhóm học phần tự chọn của một phiên bản (FR-29).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| programVersion | phienBan | → `ProgramVersion` | C | |
| groupCode | maNhom | Chuỗi | C | |
| groupName | tenNhom | Chuỗi | C | |
| minCredits | soTinChiToiThieu | Số thực | K | `Decimal(5,2)` như tín chỉ học phần |
| minCourses | soHocPhanToiThieu | Số nguyên | K | ≥ 1 |

Duy nhất: (`programVersion`, `groupCode`). Ràng buộc: có ít nhất một trong hai mức tối thiểu; có cả hai thì sinh viên phải đạt cả hai. Tổng tín chỉ các học phần trong nhóm được phép lớn hơn mức tối thiểu (BR-04).

### `KnowledgeBlock` — SRS: KhoiKienThuc

Danh mục khối kiến thức. Xem E-2.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| blockCode | maKhoi | Chuỗi | C | Khớp với `CurriculumItem.blockSymbol` khi có |
| blockName | tenKhoi | Chuỗi | C | |
| requiredCredits | soTinChiYeuCau | Số thực | K | |

Duy nhất: `blockCode`. Danh mục dùng chung cho mọi chương trình, nạp bằng seed; ký hiệu trên dòng khung là chuỗi tự do, không khóa ngoại tới bảng này (F07-02).

### ⊕ `CurriculumRequisite`

Ràng buộc học trước / tiên quyết / song hành của một dòng khung (M-5). Chép từ `CourseRelation` của danh mục ngay khi thêm dòng vào khung (bỏ quan hệ thay thế và học phần nguồn đã hủy), sau đó sửa riêng cho khung này khi phiên bản còn Nháp; đóng băng cùng phiên bản khi ban hành. Bảng này tương ứng ba cột "HP cần học trước", "HP song hành", "Cần HP tiên quyết" của file Excel.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| curriculumItem | — | → `CurriculumItem` | C | Dòng của học phần đích |
| sourceCourse | — | → `Course` | C | Có thể không nằm trong khung (EC-13) |
| relationType | — | Liệt kê | C | `PRIOR` QH1 · `PREREQUISITE` QH2 · `COREQUISITE` QH3 |
| minScore | — | Số thực | K | Chỉ dùng với QH2, thang 4, `Decimal(4,2)`. Xem E-1 |

Duy nhất: (`curriculumItem`, `sourceCourse`, `relationType`). Đồ thị học trước + tiên quyết gồm cạnh của danh mục và cạnh riêng của khung không được có chu trình (BR-11, EC-09).

### ⊕ `Cohort`

Khóa sinh viên, ví dụ K2023.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| cohortCode | — | Chuỗi | C | |
| intakeYear | — | Số nguyên | C | |

Duy nhất: `cohortCode`.

### ⊕ `Semester`

Học kỳ, ví dụ HK1 2023-2024.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| semesterCode | — | Chuỗi | C | |
| academicYear | — | Chuỗi | C | Ví dụ 2023-2024 |
| termInYear | — | Số nguyên | C | 1, 2, hoặc học kỳ hè |
| startDate | — | Ngày | K | Mốc để chuyển phiên bản Chờ hiệu lực → Đang hiệu lực (DEC-07) |
| startDateEstimated | — | Logic | C | Mặc định `false`. `true` khi ngày bắt đầu là ngày **ước lượng** theo quy ước vì lịch của Trường không có ngày cho kỳ này (seed dữ liệu thật). Lưu ngày trên MH-10 đặt lại `false`. CHECK: chỉ `true` khi có `startDate`. Giao diện gắn nhãn "Ngày ước lượng" |

Duy nhất: `semesterCode`; (`academicYear`, `termInYear`).

### ⊕ `CohortVersion`

Ánh xạ Khóa sinh viên → Phiên bản CTĐT áp dụng (FR-74).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| cohort | — | → `Cohort` | C | |
| programVersion | — | → `ProgramVersion` | C | Không ở trạng thái Nháp |
| fromSemester | — | → `Semester` | C | Học kỳ bắt đầu áp dụng cho khóa này |

Duy nhất: (`cohort`, `programVersion`). Ràng buộc: với một khóa và một chương trình, dòng có `fromSemester` muộn nhất chưa vượt quá học kỳ đang xét là dòng có hiệu lực. Xem E-9.

---

## 4. Chuẩn đầu ra

### `PLO` — SRS: PLO

Chuẩn đầu ra của chương trình, khai báo theo phiên bản (FR-38, BR-17).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| programVersion | phienBan | → `ProgramVersion` | C | |
| ploCode | maPLO | Chuỗi | C | Ổn định qua các phiên bản để so sánh được |
| description | moTa | Văn bản | C | Tiếng Việt |
| englishDescription | moTaTiengAnh | Văn bản | K | |
| competencyGroup | nhomNangLuc | Chuỗi | K | |
| sortOrder | thuTu | Số nguyên | C | |

Duy nhất: (`programVersion`, `ploCode`).

### `CLO` — SRS: CLO

Chuẩn đầu ra của học phần, thuộc một bản đề cương (FR-39, BR-18). Dùng chung cho mọi chương trình có học phần đó (DEC-03).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| syllabus | deCuong | → `Syllabus` | C | |
| cloCode | maCLO | Chuỗi | C | Ổn định qua các bản đề cương (M-1) |
| description | moTa | Văn bản | C | Tiếng Việt |
| englishDescription | moTaTiengAnh | Văn bản | K | FR-48 |
| cognitiveLevel | mucNhanThuc | Chuỗi | K | |
| sortOrder | thuTu | Số nguyên | C | |

Duy nhất: (`syllabus`, `cloCode`).

### `CLOPLOMapping` — SRS: MaTranCLO_PLO

Liên kết một CLO với một PLO, khai báo theo cặp (chương trình, học phần) (FR-40, BR-19). Không mang mức độ (F11-03).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| curriculumItem | dongKhung | → `CurriculumItem` | C | Cặp (phiên bản chương trình, học phần) |
| clo | clo | → `CLO` | C | Thuộc bản đề cương mà `curriculumItem` đang ghim |
| plo | plo | → `PLO` | C | Cùng phiên bản với `curriculumItem`; phải có dòng `CoursePLOMapping` (`curriculumItem`, `plo`) |

Duy nhất: (`curriculumItem`, `clo`, `plo`). Xóa dòng `CoursePLOMapping` thì các dòng CLO–PLO của cùng (`curriculumItem`, `plo`) bị xóa theo.

### `CoursePLOMapping` — SRS: MaTranHP_PLO

Học phần đóng góp vào PLO nào, với trọng số bao nhiêu, nhập trực tiếp theo chương trình (FR-41, F11-02). Xem E-5.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| curriculumItem | dongKhung | → `CurriculumItem` | C | |
| plo | plo | → `PLO` | C | Cùng phiên bản với `curriculumItem` |
| ⊕ weight | mucDoDongGop | Số thực | C | Thuộc (0, 1], hai chữ số thập phân (BR-21) |

Duy nhất: (`curriculumItem`, `plo`).

---

## 5. Đề cương chi tiết

### `Syllabus` — SRS: DeCuongChiTiet

Một bản đề cương của một học phần. Mỗi học phần có một đề cương dùng chung (FR-44, DEC-02), được lưu thành chuỗi các bản đánh số; bản đã ban hành là bất biến (M-1).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| course | hocPhan | → `Course` | C | |
| revisionNumber | soPhienBanNoiBo | Số nguyên | C | Tăng dần theo học phần |
| status | trangThai | Liệt kê | C | `DRAFT` Nháp · `PUBLISHED` Đã ban hành · `HISTORICAL` Lịch sử (M-2) |
| courseDescription | moTaHocPhan | Văn bản | K | Bắt buộc khi ban hành |
| ⊕ englishDescription | — | Văn bản | K | FR-48 |
| objectives | mucTieu | Văn bản | K | Bắt buộc khi ban hành |
| teachingMethods | phuongPhapGiangDay | Văn bản | K | |
| ⊕ assessmentMethods | — | Văn bản | K | Phần "phương pháp đánh giá" của FR-45 |
| references | taiLieuThamKhao | Văn bản | K | |
| ⊕ failingScore | — | Số thực | K | Điểm liệt của học phần (FR-52) |
| ⊕ previousVersion | — | → `Syllabus` | K | Bản làm nền |
| ⊕ sourceRequest | — | → `ChangeRequest` | K | Đề xuất sinh ra bản này |
| ⊕ publishedAt | — | Thời điểm | K | |

Duy nhất: (`course`, `revisionNumber`). Ràng buộc: mỗi học phần có nhiều nhất một bản Nháp và nhiều nhất một bản Đã ban hành (chỉ mục duy nhất một phần theo `status`). Phần "thông tin chung" của FR-45 lấy từ `Course`. Các phần văn bản lưu HTML đã lọc theo danh sách thẻ cho phép. `failingScore` được tạo cùng F-12, `sourceRequest` cùng F-13.

### `WeeklyContent` — SRS: NoiDungTheoTuan

Nội dung giảng dạy theo tuần hoặc chương (FR-45).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| syllabus | deCuong | → `Syllabus` | C | |
| weekLabel | tuanChuong | Chuỗi | C | Nhãn tuần hoặc chương |
| ⊕ sortOrder | — | Số nguyên | C | |
| content | noiDung | Văn bản | C | |
| teachingActivities | hoatDongDayHoc | Văn bản | K | |

### ⊕ `WeeklyContentCLO`

CLO mà một tuần / chương hướng tới.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| weeklyContent | — | → `WeeklyContent` | C | |
| clo | — | → `CLO` | C | Cùng bản đề cương |

Duy nhất: (`weeklyContent`, `clo`).

### `AssessmentComponent` — SRS: ThanhPhanDanhGia

Một thành phần của công thức điểm (FR-49..52).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| syllabus | deCuong | → `Syllabus` | C | |
| componentCode | maThanhPhan | Chuỗi | C | |
| componentName | tenThanhPhan | Chuỗi | C | Ví dụ Chuyên cần, Giữa kỳ |
| weight | trongSo | Số thực | C | Thuộc (0, 100] (BR-13). Tổng theo đề cương bằng đúng 100 (BR-12) |
| assessmentForm | hinhThucDanhGia | Chuỗi | K | |
| isConditional | laDieuKien | Logic | C | Thành phần điều kiện (FR-51) |
| conditionThreshold | nguongDieuKien | Số thực | K | Bắt buộc khi `isConditional` (BR-15) |
| ⊕ failingScore | — | Số thực | K | Điểm liệt của thành phần (FR-52) |

Duy nhất: (`syllabus`, `componentCode`).

### `AssessmentCLOMapping` — SRS: MapThanhPhan_CLO

Thành phần đánh giá đo CLO nào (FR-53). Mỗi CLO phải có ít nhất một dòng (BR-14).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| assessmentComponent | thanhPhanDanhGia | → `AssessmentComponent` | C | |
| clo | clo | → `CLO` | C | Cùng bản đề cương |
| cloWeight | tyTrong | Số thực | K | |

Duy nhất: (`assessmentComponent`, `clo`).

### `SyllabusAttachment` — SRS: TaiLieuDinhKem

Đề cương đã ký, giáo trình, slide bài giảng và tài liệu khác, đính kèm theo bản đề cương và phân loại khi tải lên (FR-47).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| syllabus | deCuong | → `Syllabus` | C | |
| ⊕ materialKind | — | `SyllabusMaterialKind` | C | `SIGNED_SYLLABUS` Đề cương đã ký · `TEXTBOOK` Giáo trình · `LECTURE_SLIDES` Slide bài giảng · `OTHER` Tài liệu khác; bắt buộc chọn khi tải lên, không có mặc định |
| fileName | tenTep | Chuỗi | C | |
| fileType | loaiTep | Liệt kê | C | `PDF` · `DOCX` Word · `XLSX` Excel · `IMAGE` Ảnh (PNG, JPEG). Nhận diện theo đuôi tệp và chữ ký nội dung |
| ⊕ sizeBytes | — | Số nguyên | C | Tối đa `ATTACHMENT_MAX_MB` (mặc định 50 MB) |
| filePath | duongDan | Chuỗi | C | Đường dẫn tương đối dưới `FILES_ROOT`; duy nhất |
| uploadedBy | nguoiTaiLen | → `User` | C | |
| recordedAt | thoiDiem | Thời điểm | C | |

---

## 6. Quy trình phê duyệt

### `ChangeRequest` — SRS: DeXuatThayDoi

Đề xuất thay đổi dữ liệu đã ban hành (FR-55..60, FR-108).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| requestCode | maDeXuat | Chuỗi | C | |
| requestType | loaiDeXuat | Liệt kê | C | `GRADING_FORMULA` Sửa công thức điểm · `OUTCOME` Sửa PLO/CLO · `SYLLABUS_CONTENT` Sửa nội dung đề cương · `CURRICULUM` Sửa khung chương trình · `COURSE_RELATION` Sửa quan hệ học phần · `PROGRAM_INFO` Sửa thông tin chương trình (FR-56) · ⊕ `ORGANIZATION` Thay đổi tổ chức / phân công (UC-09; xem E-4) |
| targetType | loaiDoiTuong | Liệt kê | C | `COURSE` Học phần · `PROGRAM` Chương trình đào tạo · `SUBJECT_GROUP` Nhóm chuyên môn. Nửa đầu của "đối tượng tác động" (E-4) |
| targetCode | maDoiTuong | Chuỗi | C | `courseCode`, `programCode` hoặc `groupCode` của đối tượng chính |
| createdBy | nguoiTao | → `User` | C | |
| title | tieuDe | Chuỗi | C | |
| reason | lyDo | Văn bản | C | |
| status | trangThai | Liệt kê | C | `DRAFT` Nháp · `PENDING_COORDINATOR` Chờ Điều phối nhóm CM · `PENDING_DIRECTOR` Chờ Giám đốc CTĐT · `PENDING_ACADEMIC_OFFICE` Chờ Phòng Đào tạo · `APPROVED` Đã duyệt · `EFFECTIVE` Đang hiệu lực · `REJECTED` Từ chối · `WITHDRAWN` Thu hồi (SRS mục 6.1.2) |
| createdAt | thoiDiemTao | Thời điểm | C | |
| origin | nguonPhatSinh | Liệt kê | C | `UNIVERSITY` Trường · `FACULTY` Khoa (FR-108) |
| basisDocumentNumber | soVanBanCanCu | Chuỗi | K | Số công văn / quyết định căn cứ (FR-108) |
| ⊕ submissionRound | — | Số nguyên | C | Số lần đã gửi duyệt; tăng mỗi lần gửi lại sau khi bị trả (BR-29) |
| ⊕ decisionNumber | — | Chuỗi | K | Phòng Đào tạo nhập khi duyệt cấp cuối (SRS mục 6.1.4) |
| ⊕ signedDate | — | Ngày | K | Như trên |
| ⊕ effectiveSemester | — | → `Semester` | K | Như trên |

Duy nhất: `requestCode`.

### `ChangeItem` — SRS: NoiDungThayDoi

Một thay đổi trong đề xuất, lưu giá trị trước và sau để dựng bảng so sánh (FR-58).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| changeRequest | deXuat | → `ChangeRequest` | C | |
| entityType | loaiThucThe | Chuỗi | C | Tên thực thể bị tác động. Nửa đầu của "thực thể bị tác động" (E-4) |
| recordId | maBanGhi | Chuỗi | K | Dòng bị sửa hoặc xóa; trống khi thêm mới |
| oldValue | giaTriCu | JSON | K | Trống khi thêm mới |
| newValue | giaTriMoi | JSON | K | Trống khi xóa |
| ⊕ baseVersion | — | Chuỗi | K | Dấu phiên bản của đối tượng lúc soạn; dùng để phát hiện đối tượng đã đổi trước khi ghi (EC-27) |

### `ApprovalStep` — SRS: BuocDuyet

Một lượt duyệt của một người ở một cấp. Một cấp có thể cần nhiều người (EC-22, EC-23), mỗi người một dòng. Là lịch sử duyệt mà FR-67 yêu cầu.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| changeRequest | deXuat | → `ChangeRequest` | C | |
| ⊕ submissionRound | — | Số nguyên | C | Thuộc lần gửi nào của đề xuất |
| approvalLevel | capDuyet | → `ApprovalLevelConfig` | C | |
| approver | nguoiDuyet | → `User` | C | Người phải duyệt theo SRS mục 6.1.3 |
| action | hanhDong | Liệt kê | C | `PENDING` Chờ · `APPROVE` Đồng ý · `RETURN` Trả lại · `REJECT` Từ chối (FR-59) |
| remark | yKien | Văn bản | K | Bắt buộc, tối thiểu 20 ký tự khi Trả lại hoặc Từ chối (BR-28) |
| recordedAt | thoiDiem | Thời điểm | K | Trống khi còn Chờ |
| isSkipped | coBoQua | Logic | C | Cấp được bỏ qua vì người duyệt là người tạo đề xuất (FR-61, BR-27) |
| ⊕ skipReason | — | Chuỗi | K | Bắt buộc khi `isSkipped` |
| ⊕ performedBy | — | → `User` | K | Người thực sự bấm duyệt khi khác `approver` |
| ⊕ delegation | — | → `ApprovalDelegation` | K | Căn cứ khi duyệt thay theo ủy quyền (FR-09) |
| ⊕ isOverride | — | Logic | C | Phòng Đào tạo duyệt thay ở cấp này (BR-31) |

### ⊕ `ApprovalLevelConfig`

Các cấp duyệt và vai trò duyệt ở từng cấp (DEC-04).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| approvalLevel | — | Số nguyên | C | 1, 2, 3 |
| levelName | — | Chuỗi | C | |
| approverRole | — | → `Role` | C | |
| isActive | — | Logic | C | |

Duy nhất: `approvalLevel`.

### `Comment` — SRS: BinhLuan

Bình luận trên đề xuất, không ảnh hưởng luồng duyệt (FR-62).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| changeRequest | deXuat | → `ChangeRequest` | C | |
| author | nguoiBinhLuan | → `User` | C | |
| content | noiDung | Văn bản | C | |
| recordedAt | thoiDiem | Thời điểm | C | |

### `Notification` — SRS: ThongBao

Thông báo trong ứng dụng (FR-63).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| recipient | nguoiNhan | → `User` | C | |
| notificationType | loaiThongBao | Chuỗi | C | |
| content | noiDung | Chuỗi | C | |
| link | duongDanLienKet | Chuỗi | K | |
| readStatus | trangThaiDoc | Liệt kê | C | `UNREAD` Chưa đọc · `READ` Đã đọc |
| ⊕ changeRequest | — | → `ChangeRequest` | K | Đề xuất mà thông báo nói tới |
| ⊕ recordedAt | — | Thời điểm | C | |
| ⊕ emailSent | — | Logic | C | Đã gửi kèm qua email (FR-64) |

### `ChangeRequestDocument` — SRS: HoSoDeXuat

Hồ sơ căn cứ đính kèm đề xuất, xem được ở mọi cấp duyệt (FR-109).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| changeRequest | deXuat | → `ChangeRequest` | C | |
| documentType | loaiHoSo | Liệt kê | C | `SUBMISSION` Tờ trình · `MINUTES` Biên bản · `COUNCIL_MINUTES` Biên bản họp hội đồng · `REVIEW_MINUTES` Biên bản thẩm định · `OFFICIAL_LETTER` Công văn |
| fileName | tenTep | Chuỗi | C | |
| filePath | duongDan | Chuỗi | C | Đường dẫn lưu trữ |
| uploadedBy | nguoiTaiLen | → `User` | C | |
| recordedAt | thoiDiem | Thời điểm | C | |

---

## 7. Sinh viên và kết quả học tập

### `Student` — SRS: SinhVien

Sinh viên, đến từ Excel hoặc cơ sở dữ liệu có sẵn (FR-96, FR-98).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| studentCode | maSinhVien | Chuỗi | C | |
| fullName | hoTen | Chuỗi | C | |
| cohort | khoaTuyenSinh | → `Cohort` | C | |
| major | nganh | Chuỗi | C | Mã ngành |
| status | trangThai | Liệt kê | C | `STUDYING` Đang học · `ON_LEAVE` Bảo lưu · `WITHDRAWN` Thôi học · `GRADUATED` Đã tốt nghiệp. Xem E-10 |
| ⊕ user | — | → `User` | K | Tài khoản đăng nhập. Xem E-8 |
| ⊕ dataSource | — | Liệt kê | C | `EXCEL` Excel · `SCHOOL_DB` Cơ sở dữ liệu có sẵn (FR-100) |

Duy nhất: `studentCode`.

### ⊕ `ProgramEnrollment`

Sinh viên theo một chương trình, ở một phiên bản cụ thể (FR-74, FR-88, BR-26; M-8).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| student | — | → `Student` | C | |
| appliedVersion | — | → `ProgramVersion` | C | "Phiên bản CTĐT áp dụng" trong SRS; không ở trạng thái Nháp |
| enrollmentType | — | Liệt kê | C | `PRIMARY` Chính · `SECOND_MAJOR` Song ngành (EC-34) |
| fromSemester | — | → `Semester` | K | |
| isException | — | Logic | C | Có = phiên bản được gán riêng cho sinh viên, không đổi theo `CohortVersion` của khóa (EC-33, EC-35, EC-37) |
| basisDecision | — | Chuỗi | K | Số quyết định chuyển đổi. Bắt buộc khi `isException` (BR-26) |
| status | — | Liệt kê | C | `ACTIVE` Đang theo học · `TRANSFERRED` Đã chuyển · `ENDED` Đã kết thúc |

Ràng buộc: mỗi sinh viên có nhiều nhất một dòng "Đang theo học" cho một chương trình.

### `AcademicResult` — SRS: KetQuaHocTap

Kết quả một lần học một học phần. Hệ thống chỉ đọc, không nhập điểm (SRS mục 12).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| student | sinhVien | → `Student` | C | |
| course | hocPhan | → `Course` | C | |
| semester | hocKy | → `Semester` | C | |
| score10 | diemThang10 | Số thực | K | Trống khi Đang học hoặc Miễn |
| score4 | diemThang4 | Số thực | K | Thang dùng để so điều kiện tiên quyết (DEC-11) |
| letterGrade | diemChu | Chuỗi | K | |
| status | trangThai | Liệt kê | C | `PASSED` Đạt · `FAILED` Không đạt · `IN_PROGRESS` Đang học · `EXEMPT` Miễn |
| ⊕ dataSource | — | Liệt kê | C | `EXCEL` Excel · `SCHOOL_DB` Cơ sở dữ liệu có sẵn (FR-100) |

Duy nhất: (`student`, `course`, `semester`). Học lại tạo dòng mới ở học kỳ khác; quy tắc lấy điểm cao nhất (EC-36).

### `GraduationAudit` — SRS: KetQuaXetTotNghiep

Kết quả một lần xét tốt nghiệp (FR-84..87).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| enrollment | ghiDanh | → `ProgramEnrollment` | C | Xét theo từng chương trình (EC-34) |
| auditedAt | thoiDiemXet | Thời điểm | C | |
| conclusion | ketLuan | Liệt kê | C | `ELIGIBLE` Đủ điều kiện · `NOT_ELIGIBLE` Chưa đủ điều kiện |
| shortfalls | danhSachThieuHut | JSON | K | Các hạng mục còn thiếu (FR-86); trống khi đủ điều kiện |
| ⊕ auditedBy | — | → `User` | K | Trống khi hệ thống tự tính lại (EC-43) |

---

## 8. Hệ thống

### `AuditLog` — SRS: NhatKyHeThong

Nhật ký mọi thao tác. Chỉ ghi thêm, không sửa, không xóa (FR-105, NFR-10).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| performedBy | nguoiThucHien | → `User` | K | Trống khi hệ thống tự thực hiện |
| action | hanhDong | Chuỗi | C | |
| entityType | loaiThucThe | Chuỗi | C | Nửa đầu của "thực thể tác động" |
| recordId | maBanGhi | Chuỗi | K | |
| oldValue | giaTriCu | JSON | K | |
| newValue | giaTriMoi | JSON | K | |
| ipAddress | diaChiIP | Chuỗi | K | |
| recordedAt | thoiDiem | Thời điểm | C | |

### `ImportBatch` — SRS: PhienNhapLieu

Một lần nhập Excel, kể cả lần chạy thử (FR-34, FR-101).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| importType | loaiNhap | Liệt kê | C | `COURSE_CATALOG` Danh mục học phần · `CURRICULUM` Khung chương trình · `STUDENT_LIST` Danh sách sinh viên · `ACADEMIC_RESULT` Kết quả học tập (FR-96) |
| fileName | tenTep | Chuỗi | C | |
| performedBy | nguoiThucHien | → `User` | C | |
| totalRows | tongDong | Số nguyên | C | |
| successRows | soDongThanhCong | Số nguyên | C | |
| errorRows | soDongLoi | Số nguyên | C | Khác 0 thì không ghi dòng nào (FR-35) |
| status | trangThai | Liệt kê | C | ⊕ `VALIDATING` Đang chạy thử · `DRY_RUN` Chạy thử · ⊕ `COMMITTING` Đang ghi · `COMMITTED` Đã ghi · `ABORTED` Không ghi do lỗi. Hai trạng thái ⊕ là lúc tác vụ nền đang xử lý tệp (`state-diagrams.md` §8) |
| ⊕ programId | — | → `Program` | K | Bắt buộc khi `importType` = `CURRICULUM`, để trống với loại khác; dùng để lọc lịch sử theo phạm vi chương trình |
| ⊕ versionId | — | → `ProgramVersion` | K | Bản nháp nhận dữ liệu khi nhập khung; về rỗng nếu bản nháp đó bị xóa (bản nháp của đề xuất bị hủy), phiên nhập vẫn còn trong lịch sử |
| ⊕ recordedAt | — | Thời điểm | C | |
| ⊕ finishedAt | — | Thời điểm | K | Lúc phiên rời trạng thái đang xử lý lần gần nhất |
| ⊕ errorReport | — | JSON | K | Lỗi định dạng của tệp và lỗi, cảnh báo, lưu ý theo từng dòng (FR-34) |

### ⊕ `ImportBatchFile`

Tệp gốc của một phiên nhập, giữ 30 ngày để tải lại và để kiểm tra lại khi xác nhận ghi (F09-05). Tách khỏi `ImportBatch` để danh sách lịch sử không phải đọc nội dung tệp.

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| batchId | — | → `ImportBatch` | C | Khóa chính; xóa phiên thì xóa tệp |
| content | — | Nhị phân | C | Tối đa 5 MB |
| sizeBytes | — | Số nguyên | C | |
| expiresAt | — | Thời điểm | C | Hết hạn thì tác vụ dọn hằng ngày xóa dòng này; phiên vẫn còn, không tải lại hay xác nhận ghi được nữa |

### `SyncLog` — SRS: LogDongBo

Một lần đồng bộ với cơ sở dữ liệu có sẵn (FR-99).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| dataSource | nguonDuLieu | Chuỗi | C | |
| startedAt | thoiDiemBatDau | Thời điểm | C | |
| finishedAt | thoiDiemKetThuc | Thời điểm | K | |
| recordCount | soBanGhi | Số nguyên | C | |
| status | trangThai | Liệt kê | C | `RUNNING` Đang chạy · `SUCCEEDED` Thành công · `FAILED` Thất bại. Thất bại thì hoàn tác toàn bộ (EC-49) |
| errorMessage | thongBaoLoi | Chuỗi | K | |
| ⊕ conflictCount | — | Số nguyên | C | Số bản ghi mâu thuẫn giữa hai nguồn đã xử lý theo quy tắc ưu tiên (FR-100, EC-48) |

### ⊕ `IntegrationClient`

Bên gọi API, ví dụ ứng dụng dDUT (FR-94).

| Tên lập trình | Tên SRS | Kiểu | BB | Mô tả, ràng buộc |
|---|---|---|---|---|
| clientName | — | Chuỗi | C | |
| keyHash | — | Chuỗi | C | Khóa truy cập riêng của bên này, lưu dạng băm (API-03) |
| rateLimit | — | Số nguyên | K | Số lần gọi tối đa trong một đơn vị thời gian (API-04) |
| status | — | Liệt kê | C | `ACTIVE` Hoạt động · `LOCKED` Đã khóa |

Duy nhất: `clientName`.

---

## 9. Ma trận quyền ban đầu

Các dòng `Permission` và `RolePermission` nạp sẵn khi khởi tạo (M-10). 41 quyền: 28 chép từ SRS mục 3.4, 13 bổ sung cho chức năng mà ma trận SRS không có dòng (E-12, F02-02). Nạp lại không tạo lại ô R1 đã xóa: ô chỉ được tạo cùng lúc quyền của nó được tạo lần đầu.

| Ký hiệu | `mode` | `scope` |
|---|---|---|
| X | `DIRECT` Trực tiếp | `ALL` Toàn bộ |
| P | `DIRECT` Trực tiếp | `SCOPED` Theo phạm vi |
| Đ | `VIA_REQUEST` Qua đề xuất | `ALL` Toàn bộ |
| Đ(P) | `VIA_REQUEST` Qua đề xuất | `SCOPED` Theo phạm vi |
| – | không có dòng | |

Cột Nguồn: "3.4" là dòng cùng tên của SRS mục 3.4; mã khác là yêu cầu, story hoặc điểm hở đã quyết ô đó. Ba dòng "Duyệt cấp 1/2/3" của SRS không có ở đây: ai duyệt cấp nào đọc từ `ApprovalLevelConfig` và `ApprovalDelegation` (M-10).

| Mã quyền | Chức năng | Nguồn | R1 | R2 | R3 | R4 | R5 | R6 |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Quản trị hệ thống** | | | | | | | | |
| orgUnit.manage | Quản lý đơn vị, nhóm chuyên môn | 3.4 | X | – | – | – | – | – |
| subjectGroup.view | Xem nhóm chuyên môn và thành viên | G-2 | X | P | – | P | – | – |
| user.manage | Quản lý người dùng, gán vai trò | 3.4 | X | – | – | – | – | – |
| permission.view | Xem ma trận quyền | M-10 | X | – | – | – | – | – |
| permission.manage | Sửa ma trận quyền của vai trò có sẵn | F02-02 | X | – | – | – | – | – |
| director.assign | Phân công Giám đốc CTĐT | 3.4 | X | – | – | – | – | – |
| delegation.manage | Ủy quyền phê duyệt | FR-09, US-114 | X | – | P | P | – | – |
| integrationClient.manage | Quản lý bên tích hợp và khóa truy cập | FR-94, US-098 | X | – | – | – | – | – |
| sync.configure | Cấu hình kết nối và lịch đồng bộ, xem nhật ký đồng bộ | FR-98, FR-99, FR-100, US-102 | X | – | – | – | – | – |
| auditLog.view | Xem nhật ký hệ thống | 3.4 | X | X | – | – | – | – |
| **Danh mục học phần** | | | | | | | | |
| course.view | Xem danh mục học phần | 3.4 | X | X | X | X | X | X |
| course.edit | Thêm/sửa học phần | 3.4, U-1 | X | – | Đ | Đ(P) | Đ(P) | – |
| courseRelation.edit | Khai báo quan hệ học phần, nhóm tương đương | 3.4, U-1 | X | – | Đ | Đ(P) | Đ(P) | – |
| **Chương trình đào tạo** | | | | | | | | |
| program.view | Xem CTĐT | 3.4, G-8 | X | X | X | X | X | P |
| program.editInfo | Sửa thông tin CTĐT | 3.4 | X | – | P | – | – | – |
| program.clone | Nhân bản CTĐT | FR-25, US-022 | X | – | – | – | – | – |
| curriculum.edit | Sửa khung chương trình | 3.4 | X | – | Đ(P) | Đ(P) | Đ(P) | – |
| curriculum.importExportExcel | Nhập/xuất Excel khung chương trình | 3.4 | X | – | P | – | – | – |
| version.assignCohort | Gán phiên bản cho khóa tuyển sinh | FR-74, US-080 | X | – | – | – | – | – |
| **Chuẩn đầu ra** | | | | | | | | |
| outcome.view | Xem PLO/CLO | 3.4, G-3 | X | X | X | X | X | P |
| plo.edit | Sửa PLO | 3.4 | X | – | Đ(P) | – | – | – |
| clo.edit | Sửa CLO, ma trận CLO–PLO | 3.4, U-1 | X | – | Đ(P) | Đ(P) | Đ(P) | – |
| **Đề cương chi tiết** | | | | | | | | |
| syllabus.view | Xem đề cương | 3.4, G-8 | X | X | X | X | X | X |
| syllabus.edit | Sửa nội dung đề cương | 3.4, U-1 | X | – | Đ(P) | Đ(P) | Đ(P) | – |
| gradingFormula.edit | Sửa công thức điểm | 3.4, U-1 | X | – | Đ(P) | Đ(P) | Đ(P) | – |
| **Quy trình phê duyệt** | | | | | | | | |
| changeRequest.view | Xem đề xuất và lịch sử duyệt | FR-62, FR-65 | X | P | P | P | P | – |
| changeRequest.create | Tạo đề xuất thay đổi dữ liệu đào tạo | 3.4 | X | – | X | X | X | – |
| changeRequest.createOrganizational | Tạo đề xuất thay đổi tổ chức / phân công | S-1, E-4 | – | P | – | P | – | – |
| changeRequest.override | Duyệt thay ở cấp 1 và 2 | 3.4, BR-31 | X | – | – | – | – | – |
| changeRequest.comment | Bình luận trên đề xuất | 3.4 | X | X | X | X | X | – |
| changeRequest.statistics | Thống kê đề xuất | FR-107, US-109 | X | X | P | P | – | – |
| **Phiên bản** | | | | | | | | |
| version.publish | Ban hành phiên bản | 3.4 | X | – | – | – | – | – |
| version.viewHistory | Xem lịch sử phiên bản | 3.4 | X | X | X | X | X | – |
| version.compare | So sánh hai phiên bản | 3.4 | X | X | X | X | X | – |
| **Dữ liệu và báo cáo** | | | | | | | | |
| data.importExcel | Nhập dữ liệu từ Excel | 3.4 | X | – | P | – | – | – |
| report.exportAccreditation | Xuất báo cáo kiểm định | 3.4 | X | X | P | – | – | – |
| report.benchmark | Đối sánh chương trình, phân bổ tín chỉ | FR-102, FR-103, US-105 | X | X | X | X | – | – |
| **Tra cứu sinh viên** | | | | | | | | |
| student.viewProgress | Xem tiến độ học tập | 3.4, L-10 | X | – | P | – | – | P |
| student.viewRegistrationEligibility | Xem điều kiện đăng ký học phần | 3.4, L-10 | X | – | P | – | – | P |
| graduation.view | Xem kết quả xét tốt nghiệp | 3.4, L-10 | X | – | P | – | – | P |
| graduation.audit | Xét tốt nghiệp một sinh viên hoặc theo lô | FR-84, FR-87, US-087, US-090 | X | – | P | – | – | – |

---

## 10. Đối chiếu tên thực thể

Tên thuộc tính SRS ghi ở cột Tên SRS của từng thực thể, không chép lại ở đây.

| Tên SRS | Tên lập trình |
|---|---|
| DonVi | `OrgUnit` |
| NhomChuyenMon | `SubjectGroup` |
| NguoiDung | `User` |
| VaiTro | `Role` |
| — | `Permission` |
| — | `RolePermission` |
| PhanQuyen | `RoleAssignment` |
| ThanhVienNhomCM | `SubjectGroupMember` |
| PhanCongGiamDoc | `ProgramDirectorAssignment` |
| UyQuyenDuyet | `ApprovalDelegation` |
| HocPhan | `Course` |
| QuanHeHocPhan | `CourseRelation` |
| NhomHocPhanTuongDuong | `EquivalentCourseGroup` |
| ChuongTrinhDaoTao | `Program` |
| PhienBanCTDT | `ProgramVersion` |
| DongKhungCTDT | `CurriculumItem` |
| NhomTuChon | `ElectiveGroup` |
| KhoiKienThuc | `KnowledgeBlock` |
| — | `CurriculumRequisite` |
| — | `Cohort` |
| — | `Semester` |
| — | `CohortVersion` |
| PLO | `PLO` |
| CLO | `CLO` |
| MaTranCLO_PLO | `CLOPLOMapping` |
| MaTranHP_PLO | `CoursePLOMapping` |
| DeCuongChiTiet | `Syllabus` |
| NoiDungTheoTuan | `WeeklyContent` |
| — | `WeeklyContentCLO` |
| ThanhPhanDanhGia | `AssessmentComponent` |
| MapThanhPhan_CLO | `AssessmentCLOMapping` |
| TaiLieuDinhKem | `SyllabusAttachment` |
| DeXuatThayDoi | `ChangeRequest` |
| NoiDungThayDoi | `ChangeItem` |
| BuocDuyet | `ApprovalStep` |
| — | `ApprovalLevelConfig` |
| BinhLuan | `Comment` |
| ThongBao | `Notification` |
| HoSoDeXuat | `ChangeRequestDocument` |
| SinhVien | `Student` |
| — | `ProgramEnrollment` |
| KetQuaHocTap | `AcademicResult` |
| KetQuaXetTotNghiep | `GraduationAudit` |
| NhatKyHeThong | `AuditLog` |
| PhienNhapLieu | `ImportBatch` |
| LogDongBo | `SyncLog` |
| — | `IntegrationClient` |
