# ĐẶC TẢ YÊU CẦU PHẦN MỀM

**Hệ thống Quản lý Chương trình đào tạo — Khoa Công nghệ Thông tin**

> **[Ghi chú port]** Tài liệu này là bản Markdown của `Requirements.pdf` (51 trang) và **là nguồn chuẩn duy nhất** kể từ nay: mọi thay đổi yêu cầu được thực hiện trên tệp này, không sửa file PDF.
> Nội dung tiếng Việt được giữ **nguyên văn**, không dịch, không diễn đạt lại. Sơ đồ ASCII và mã giả được port nguyên khối.
> Các khối `> **[Ghi chú port]**` là chú thích của quá trình chuyển đổi — **không phải nội dung yêu cầu gốc**.
>
> **Hiệu đính 2026-10-01 — nguồn thứ hai.** 8 trong 80 ảnh bảng của `Requirements.pdf` bị cắt phải ở đúng 1480px (giới hạn cứng của bản xuất), làm mất phần cuối nhiều dòng. `Bo_so_do_Use_Case_CTDT/Thuyet_minh_Use_Case.md` được lập từ **bản nguồn chưa bị cắt**, nên đã dùng để khôi phục:
> - **40 dòng FR** được hiệu đính: 26 ô **Mức** còn bỏ ngỏ nay đã xác định, **5 giá trị Mức sai** đã sửa (FR-09, FR-41, FR-43, FR-47, FR-52 → `NÊN CÓ`), và **30 dòng** được phục hồi đầy đủ văn bản.
> - Mỗi giá trị sửa đã được **đối chiếu lại với ảnh bảng gốc** trong PDF trước khi áp dụng; nơi hai nguồn khác nhau, **bản gốc thắng**.
> - Phần **chưa** khôi phục được ở lần hiệu đính này: bảng thuật ngữ (mục 4.1), bảng thuộc tính `HocPhan` (mục 4.2), bảng ánh xạ Excel (mục 4.3), và cột "Ảnh hưởng nếu thay đổi" của Q-01/Q-02 (mục 13.1) — **cả bốn đã được xử lý ngày 2026-10-11**, xem khối hiệu đính bên dưới.
>
> **Hiệu đính 2026-10-11 — hợp nhất.** Nguồn bổ sung: bản Markdown gốc của tài liệu này (v1.0, 27/08/2026 — cũ hơn `Requirements.pdf`) và các ghi chú phỏng vấn trong `docs/notes/`. Nơi bản port từ PDF đã có nội dung thì giữ bản port; bản Markdown gốc chỉ dùng để lấy phần bị mất.
> - **Khôi phục phần bị cắt:** thuộc tính của toàn bộ thực thể (mục 4.2), 6 dòng và cột ghi chú của bảng ánh xạ Excel (mục 4.3), cột "Ảnh hưởng nếu thay đổi" của Q-01/Q-02 (mục 13.1). Bảng thuật ngữ (mục 4.1) đã đối chiếu: không thiếu dòng nào.
> - **Đổi tên vai trò R4:** "Trưởng nhóm chuyên môn" → "**Điều phối nhóm chuyên môn**" trên toàn tài liệu, kể cả trạng thái "CHỜ ĐIỀU PHỐI NHÓM CM", theo yêu cầu ghi tại `docs/notes/raw-notes-pbl6-zalo.txt`. Đây là ngoại lệ có chủ ý so với nguyên tắc giữ nguyên văn. Bộ sơ đồ Use Case (`Bo_so_do_Use_Case_CTDT/`) đã đổi tên theo trong ba tệp nguồn (`.md`, `.json`, `.drawio`); bản xuất `.pdf` chưa xuất lại nên còn tên cũ.
> - **Chốt:** Q-01 — CLO dùng chung theo học phần (DEC-03); Q-02 — chấp nhận sinh phiên bản mới cho mọi CTĐT liên quan; giữ luồng duyệt **ba cấp** (DEC-04).
> - **Bổ sung từ khảo sát lần 2:** mục 6.4, FR-108, FR-109 (mục 5.6), thực thể `HoSoDeXuat` (mục 4.2.6), các câu hỏi Q-18..Q-28 (mục 13.5). Tổng số FR: **109**.
> - Các khối `> **[Bổ sung 2026-10-11]**` đánh dấu nội dung **không có** trong `Requirements.pdf`.

---

## MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Mô tả tổng quan](#2-mô-tả-tổng-quan)
3. [Các bên liên quan và phân quyền](#3-các-bên-liên-quan-và-phân-quyền)
4. [Mô hình nghiệp vụ và từ điển thuật ngữ](#4-mô-hình-nghiệp-vụ-và-từ-điển-thuật-ngữ)
5. [Yêu cầu chức năng](#5-yêu-cầu-chức-năng)
6. [Quy trình nghiệp vụ trọng tâm](#6-quy-trình-nghiệp-vụ-trọng-tâm)
7. [Quy tắc nghiệp vụ và công thức tính toán](#7-quy-tắc-nghiệp-vụ-và-công-thức-tính-toán)
8. [Yêu cầu dữ liệu và tích hợp](#8-yêu-cầu-dữ-liệu-và-tích-hợp)
9. [Yêu cầu phi chức năng](#9-yêu-cầu-phi-chức-năng)
10. [Các quyết định thiết kế đã chốt](#10-các-quyết-định-thiết-kế-đã-chốt)
11. [Danh mục tình huống biên](#11-danh-mục-tình-huống-biên)
12. [Phạm vi loại trừ](#12-phạm-vi-loại-trừ)
13. [Vấn đề còn treo](#13-vấn-đề-còn-treo)

---

## 1. GIỚI THIỆU

### 1.1. Mục đích tài liệu

Tài liệu này đặc tả đầy đủ các yêu cầu chức năng và phi chức năng của Hệ thống Quản lý Chương trình đào tạo phục vụ Khoa Công nghệ Thông tin — Trường Đại học Bách khoa, Đại học Đà Nẵng.

Tài liệu được sử dụng làm:

- Cơ sở thống nhất yêu cầu giữa nhóm thực hiện đồ án và phía Khoa;
- Đầu vào cho giai đoạn thiết kế cơ sở dữ liệu và kiến trúc hệ thống;
- Căn cứ nghiệm thu sản phẩm cuối kỳ.

### 1.2. Phạm vi sản phẩm

Hệ thống thay thế phương thức quản lý Chương trình đào tạo bằng Microsoft Excel hiện tại, cung cấp:

- Quản lý tập trung Chương trình đào tạo, Khung chương trình, Đề cương chi tiết học phần, Chuẩn đầu ra;
- Quy trình đề xuất — phê duyệt thay đổi theo ba cấp;
- Quản lý phiên bản (versioning) của Chương trình đào tạo;
- Tự động kiểm tra tính nhất quán và tính toán điều kiện đăng ký, điều kiện tốt nghiệp;
- Cổng tra cứu cho sinh viên và giao diện lập trình ứng dụng (API) phục vụ tích hợp với ứng dụng dDUT.

### 1.3. Bối cảnh và vấn đề hiện tại

Hiện trạng quản lý bằng Excel gây ra các vấn đề sau:

| STT | Vấn đề | Hệ quả |
|---|---|---|
| 1 | Không có quản lý phiên bản | Không truy vết được Chương trình đào tạo áp dụng cho từng khóa |
| 2 | Không có quy trình phê duyệt | Thay đổi thực hiện trực tiếp trên file, không có vết trách nhiệm |
| 3 | Không kiểm tra tính nhất quán | Sai sót tổng tín chỉ, chu trình tiên quyết, bỏ sót chuẩn đầu ra |
| 4 | Dữ liệu phân mảnh theo nhiều file | Khung chương trình, đề cương, chuẩn đầu ra không liên kết với nhau |
| 5 | Sinh viên không tra cứu được | Không biết học phần nào đủ điều kiện đăng ký, còn thiếu bao nhiêu tín chỉ |
| 6 | Công việc thủ công lặp lại | Cột "Đăng ký được?" phải tính bằng tay cho từng sinh viên |

### 1.4. Đối tượng sử dụng tài liệu

- Nhóm thực hiện đồ án PBL6;
- Giảng viên hướng dẫn;
- Đại diện Khoa Công nghệ Thông tin (bên đặt hàng nghiệp vụ);
- Hội đồng nghiệm thu đồ án.

---

## 2. MÔ TẢ TỔNG QUAN

### 2.1. Kiến trúc tổng thể

Hệ thống được xây dựng theo kiến trúc **monolith (khối đơn)**, gồm ba tầng:

```
┌──────────────────────────────────────────────────────────────┐
│  TẦNG GIAO DIỆN                                              │
│  ├── Web quản trị (trọng tâm)                                │
│  │     Phòng ĐT · Ban lãnh đạo khoa · GĐ CTĐT ·              │
│  │     Điều phối nhóm CM · Giảng viên                        │
│  └── Cổng tra cứu sinh viên (responsive)                     │
├──────────────────────────────────────────────────────────────┤
│  TẦNG ỨNG DỤNG (Monolith)                                    │
│  ├── Module Quản trị tổ chức & Phân quyền                    │
│  ├── Module Danh mục học phần                                │
│  ├── Module Chương trình đào tạo & Khung chương trình        │
│  ├── Module Chuẩn đầu ra (PLO/CLO)                           │
│  ├── Module Đề cương chi tiết & Công thức điểm               │
│  ├── Module Quy trình phê duyệt (Workflow)                   │
│  ├── Module Quản lý phiên bản (Versioning)                   │
│  ├── Module Bộ quy tắc & Tính toán tự động (Rules Engine)    │
│  ├── Module Tích hợp dữ liệu (Excel Import + DB Sync)        │
│  ├── Module Báo cáo & Kiểm định                              │
│  └── REST API (OpenAPI) ──────────► Ứng dụng dDUT            │
├──────────────────────────────────────────────────────────────┤
│  TẦNG DỮ LIỆU                                                │
│  ├── CSDL quan hệ của hệ thống (đọc/ghi)                     │
│  ├── Kho lưu trữ tệp đính kèm                                │
│  └── Nguồn dữ liệu ngoài: File Excel + CSDL trường (chỉ đọc) │
└──────────────────────────────────────────────────────────────┘
```

### 2.2. Các khối chức năng chính

| Mã | Module |
|---|---|
| M1 | Quản trị tổ chức & Phân quyền |
| M2 | Danh mục học phần |
| M3 | Chương trình đào tạo & Khung chương trình |
| M4 | Chuẩn đầu ra (PLO/CLO) |
| M5 | Đề cương chi tiết & Công thức điểm |
| M6 | Quy trình phê duyệt |
| M7 | Quản lý phiên bản |
| M8 | Bộ quy tắc & Tính toán tự động |
| M9 | Cổng sinh viên & API |
| M10 | Tích hợp dữ liệu |
| M11 | Báo cáo & Kiểm định |

### 2.3. Giả định và ràng buộc

| Mã | Nội dung |
|---|---|
| GĐ-01 | Hệ thống được triển khai trên máy chủ do phía Khoa cung cấp |
| GĐ-02 | Giao diện tiếng Việt; song ngữ ở mức dữ liệu |
| GĐ-03 | Dữ liệu Chương trình đào tạo hiện có được cung cấp dưới dạng file Excel |
| GĐ-04 | Dữ liệu sinh viên và kết quả học tập đến từ **hai nguồn**: file Excel và cơ sở dữ liệu có sẵn |
| GĐ-05 | Hệ thống **không thay thế** hệ thống đăng ký học phần và quản lý điểm hiện hành |
| RB-01 | **Kiến trúc monolith là bắt buộc — không sử dụng microservices** |
| RB-02 | Không xây dựng quy trình khởi tạo Chương trình đào tạo mới từ đầu |

---

## 3. CÁC BÊN LIÊN QUAN VÀ PHÂN QUYỀN

### 3.1. Danh sách vai trò

| Mã | Vai trò | Cấp duyệt |
|---|---|---|
| R1 | **Phòng Đào tạo** | Cấp 3 (cuối cùng) |
| R2 | **Ban lãnh đạo khoa** | Không chặn (chỉ giám sát + bình luận) |
| R3 | **Giám đốc CTĐT** | Cấp 2 |
| R4 | **Điều phối nhóm chuyên môn** | Cấp 1 |
| R5 | **Giảng viên** | Người đề xuất |
| R6 | **Sinh viên** | Chỉ đọc |

### 3.2. Cơ cấu tổ chức

```
Phòng Đào tạo  (cấp Trường — quyền cao nhất)
      │
      ▼
Khoa Công nghệ Thông tin
      │
      ├── Ban lãnh đạo khoa
      │      ├── Trưởng khoa
      │      └── Phó khoa
      │
      ├── Giám đốc Chương trình đào tạo  (1 người phụ trách 1..n CTĐT)
      │
      └── Nhóm chuyên môn  (04 nhóm)
             ├── Điều phối nhóm chuyên môn
             └── Giảng viên  (1 giảng viên có thể thuộc nhiều nhóm)
```

### 3.3. Nguyên tắc phân quyền

Quyền trong hệ thống được xác định bởi cặp **(Vai trò × Phạm vi đối tượng)**, không phải bởi vai trò đơn thuần.

| Vai trò | Phạm vi đối tượng |
|---|---|
| Phòng Đào tạo | Toàn hệ thống |
| Ban lãnh đạo khoa | Toàn bộ dữ liệu thuộc khoa |
| Giám đốc CTĐT | Chỉ các Chương trình đào tạo được phân công |
| Điều phối nhóm chuyên môn | Chỉ học phần thuộc nhóm của mình |
| Giảng viên | Chỉ học phần thuộc các nhóm mà mình là thành viên |
| Sinh viên | Chỉ phiên bản Chương trình đào tạo áp dụng cho khóa của mình |

### 3.4. Ma trận phân quyền chi tiết

**Ký hiệu:** `X` = có quyền · `Đ` = chỉ được đề xuất (phải qua duyệt) · `P` = có quyền trong phạm vi được phân công · `–` = không có quyền

| Chức năng | R1 Phòng ĐT | R2 Ban LĐ khoa | R3 GĐ CTĐT | R4 Điều phối nhóm CM | R5 Giảng viên | R6 Sinh viên |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Quản trị hệ thống** | | | | | | |
| Quản lý đơn vị, nhóm chuyên môn | X | – | – | – | – | – |
| Quản lý người dùng, vai trò | X | – | – | – | – | – |
| Phân công Giám đốc CTĐT | X | – | – | – | – | – |
| **Danh mục học phần** | | | | | | |
| Xem danh mục học phần | X | X | X | X | X | X |
| Thêm/sửa học phần | X | – | Đ | Đ | Đ | – |
| Khai báo quan hệ học phần | X | – | Đ | Đ | Đ | – |
| **Chương trình đào tạo** | | | | | | |
| Xem CTĐT | X | X | X | X | X | P |
| Sửa thông tin CTĐT | X | – | P | – | – | – |
| Sửa khung chương trình | X | – | Đ(P) | Đ | Đ | – |
| Nhập/xuất Excel | X | – | P | – | – | – |
| **Chuẩn đầu ra** | | | | | | |
| Xem PLO/CLO | X | X | X | X | X | X |
| Sửa PLO | X | – | Đ(P) | – | – | – |
| Sửa CLO, ma trận CLO–PLO | X | – | Đ(P) | Đ | Đ | – |
| **Đề cương chi tiết** | | | | | | |
| Xem đề cương | X | X | X | X | X | X |
| Sửa nội dung đề cương | X | – | Đ(P) | Đ | Đ | – |
| Sửa công thức điểm | X | – | Đ(P) | Đ | Đ | – |
| **Quy trình phê duyệt** | | | | | | |
| Tạo đề xuất thay đổi | X | – | X | X | X | – |
| Duyệt cấp 1 | X | – | – | P | – | – |
| Duyệt cấp 2 | X | – | P | – | – | – |
| Duyệt cấp 3 | X | – | – | – | – | – |
| Bình luận trên đề xuất | X | X | X | X | X | – |
| **Phiên bản** | | | | | | |
| Ban hành phiên bản | X | – | – | – | – | – |
| Xem lịch sử phiên bản | X | X | X | X | X | – |
| So sánh hai phiên bản | X | X | X | X | X | – |
| **Dữ liệu và báo cáo** | | | | | | |
| Nhập dữ liệu từ Excel | X | – | P | – | – | – |
| Xem nhật ký hệ thống | X | X | – | – | – | – |
| Xuất báo cáo kiểm định | X | X | P | – | – | – |
| **Tra cứu sinh viên** | | | | | | |
| Xem tiến độ học tập cá nhân | – | – | – | – | – | X |
| Xem điều kiện đăng ký học phần | – | – | – | – | – | X |
| Xem kết quả xét tốt nghiệp | – | – | – | – | – | X |

> **[Ghi chú port]** Ma trận trên được port từ hai ảnh bảng liền nhau (trang 7–8 của bản PDF). Phần nhóm tiêu đề in đậm là dòng phân nhóm trong bản gốc, không phải chức năng.

---

## 4. MÔ HÌNH NGHIỆP VỤ VÀ TỪ ĐIỂN THUẬT NGỮ

### 4.1. Từ điển thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| **CTĐT** | Chương trình đào tạo |
| **Khung chương trình** | Danh sách học phần được bố trí theo học kỳ của một Chương trình đào tạo |
| **HP** | Học phần |
| **ĐCCT** | Đề cương chi tiết học phần |
| **PLO** | Chuẩn đầu ra của Chương trình đào tạo (Program Learning Outcome) |
| **CLO** | Chuẩn đầu ra của học phần (Course Learning Outcome) |
| **TC** | Tín chỉ |
| **Học phần học trước** | Học phần phải **học qua** (đã đăng ký và có kết quả, kể cả không đạt) trước khi học học phần đích |
| **Học phần tiên quyết** | Học phần phải **học đạt** (điểm ≥ ngưỡng quy định) trước khi học học phần đích |
| **Học phần song hành** | Học phần phải học **cùng học kỳ** hoặc đã hoàn thành trước đó |
| **Học phần tương đương** | Học phần được công nhận thay thế cho nhau khi xét tốt nghiệp |
| **Đề xuất thay đổi (CR)** | Yêu cầu thay đổi dữ liệu đã ban hành, phải đi qua quy trình phê duyệt |
| **Phiên bản CTĐT** | Ảnh chụp bất biến toàn bộ Chương trình đào tạo tại thời điểm ban hành |
| **Xét tốt nghiệp** | Quá trình kiểm tra sinh viên đã thỏa mãn mọi điều kiện của Chương trình đào tạo |

> **[Ghi chú port]** Bảng này từng được đánh dấu "chưa khôi phục" (ảnh bảng trong PDF bị cắt phải ở 1480px). **Đã đối chiếu ngày 2026-10-11** với bản nguồn Markdown gốc (v1.0, 27/08/2026): cùng 14 thuật ngữ, không dòng nào bị mất.

### 4.2. Danh sách thực thể nghiệp vụ

> **[Ghi chú port]** Cột thuộc tính của toàn bộ mục 4.2 được **khôi phục ngày 2026-10-11** từ bản nguồn Markdown gốc (v1.0, 27/08/2026). Ở các dòng có dấu "—", phần đứng trước là mô tả đã port từ PDF, phần sau là danh sách thuộc tính lấy từ bản nguồn; các dòng còn lại là danh sách thuộc tính đầy đủ. Tên vai trò R4 trong thuộc tính của `NhomChuyenMon` đã đổi theo tên mới (bản nguồn ghi "trưởng nhóm").

#### 4.2.1. Nhóm Tổ chức và Người dùng

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `DonVi` | Đơn vị trong cây tổ chức — mã đơn vị, tên đơn vị, loại đơn vị (Trường/Khoa/Phòng), đơn vị cha |
| `NhomChuyenMon` | Nhóm chuyên môn thuộc khoa — mã nhóm, tên nhóm, khoa chủ quản, người điều phối |
| `NguoiDung` | Tài khoản người dùng — mã người dùng, họ tên, email, đơn vị, trạng thái hoạt động |
| `VaiTro` | Vai trò trong hệ thống — mã vai trò, tên vai trò, mô tả |
| `PhanQuyen` | Người dùng, vai trò, **phạm vi đối tượng, thời hạn hiệu lực** |
| `ThanhVienNhomCM` | Quan hệ n–n giữa giảng viên và nhóm chuyên môn — nhóm chuyên môn, giảng viên, vai trò trong nhóm |
| `PhanCongGiamDoc` | Phân công Giám đốc CTĐT cho Chương trình đào tạo — Giám đốc CTĐT, Chương trình đào tạo, ngày bắt đầu, ngày kết thúc |
| `UyQuyenDuyet` | Ủy quyền phê duyệt có thời hạn — người ủy quyền, người được ủy quyền, phạm vi, thời hạn |

#### 4.2.2. Nhóm Học phần

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `HocPhan` | Học phần trong danh mục toàn trường — mã HP, tên tiếng Việt, tên tiếng Anh, số tín chỉ (số thực), khoa phụ trách, nhóm chuyên môn phụ trách, loại học phần, trạng thái |
| `QuanHeHocPhan` | Quan hệ giữa hai học phần — học phần nguồn, học phần đích, loại quan hệ, điều kiện điểm kèm theo |
| `NhomHocPhanTuongDuong` | Nhóm các học phần tương đương nhau — mã nhóm, danh sách học phần thành viên, ghi chú |

**Loại học phần:** Lý thuyết · Thực hành · Thí nghiệm · Đồ án · Đồ án tốt nghiệp · Thực tập · Học phần điều kiện (Giáo dục thể chất, Giáo dục quốc phòng, Ngoại ngữ).

**Loại quan hệ học phần:**

| Mã | Loại quan hệ | Điều kiện thỏa mãn |
|---|---|---|
| QH1 | **Học trước** | Đã đăng ký và học qua học phần nguồn (kể cả không đạt) |
| QH2 | **Tiên quyết** | Học đạt học phần nguồn với điểm ≥ ngưỡng quy định |
| QH3 | **Song hành** | Học cùng học kỳ, hoặc đã hoàn thành trước đó |
| QH4 | **Tương đương** | Hai học phần công nhận thay thế được cho nhau |
| QH5 | **Thay thế** | Áp dụng khi học phần nguồn ngừng mở lớp |

#### 4.2.3. Nhóm Chương trình đào tạo

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `ChuongTrinhDaoTao` | Chương trình đào tạo — mã chương trình, tên chương trình, mã ngành, tên ngành, trình độ (Kỹ sư/Cử nhân), khóa áp dụng, số học kỳ, tổng TC yêu cầu, số TC bắt buộc, số TC tự chọn, trạng thái |
| `PhienBanCTDT` | Phiên bản (ảnh chụp bất biến) của Chương trình đào tạo — Chương trình đào tạo, số phiên bản, số quyết định ban hành, ngày ký, học kỳ hiệu lực, khóa áp dụng, người ban hành, trạng thái |
| `DongKhungCTDT` | Phiên bản CTĐT, thứ tự, học kỳ dự kiến, học phần, ký hiệu khối kiến thức, cờ tự chọn, nhóm tự chọn, **cờ HT ĐA, cờ TQ ĐA, điểm học, điểm chuyển**, ghi chú |
| `NhomTuChon` | Phiên bản CTĐT, mã nhóm, tên nhóm, số tín chỉ tối thiểu, số học phần tối thiểu |
| `KhoiKienThuc` | Khối kiến thức — mã khối, tên khối, số tín chỉ yêu cầu |

#### 4.2.4. Nhóm Chuẩn đầu ra

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `PLO` | Chuẩn đầu ra chương trình, thuộc Chương trình đào tạo — mã PLO, mô tả tiếng Việt, mô tả tiếng Anh, nhóm năng lực, thứ tự |
| `CLO` | Chuẩn đầu ra học phần, thuộc **Đề cương chi tiết** — mã CLO, mô tả tiếng Việt, mô tả tiếng Anh, mức nhận thức, thứ tự |
| `MaTranCLO_PLO` | **Chương trình đào tạo, học phần, CLO, PLO** — liên kết trơn, không mang mức độ (cập nhật 2026-10-18, Q-26) |
| `MaTranHP_PLO` | Nhập trực tiếp — Chương trình đào tạo, học phần, PLO, trọng số (cập nhật 2026-10-18, Q-26) |

#### 4.2.5. Nhóm Đề cương chi tiết

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `DeCuongChiTiet` | Đề cương chi tiết học phần — học phần, mô tả học phần, mục tiêu, phương pháp giảng dạy, tài liệu tham khảo, số phiên bản nội bộ, trạng thái |
| `NoiDungTheoTuan` | Nội dung giảng dạy theo tuần — đề cương, tuần/chương, nội dung, hoạt động dạy học, CLO liên quan |
| `ThanhPhanDanhGia` | Đề cương, mã thành phần, tên thành phần, trọng số, hình thức đánh giá, cờ điều kiện, ngưỡng điều kiện |
| `MapThanhPhan_CLO` | Ánh xạ thành phần đánh giá với CLO — thành phần đánh giá, CLO, tỷ trọng |
| `TaiLieuDinhKem` | Tệp đính kèm theo phiên bản — đề cương, tên tệp, loại tệp, đường dẫn lưu trữ, người tải lên, thời điểm |

#### 4.2.6. Nhóm Quy trình phê duyệt

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `DeXuatThayDoi` | Đề xuất thay đổi — mã đề xuất, loại đề xuất, đối tượng tác động, người tạo, tiêu đề, lý do, trạng thái, thời điểm tạo |
| `NoiDungThayDoi` | Đề xuất, thực thể bị tác động, giá trị cũ (JSON), giá trị mới (JSON) |
| `BuocDuyet` | Đề xuất, cấp duyệt, người duyệt, hành động, ý kiến, thời điểm, **cờ bỏ qua** |
| `BinhLuan` | Bình luận trên đề xuất — đề xuất, người bình luận, nội dung, thời điểm |
| `ThongBao` | Thông báo tới người dùng — người nhận, loại thông báo, nội dung, đường dẫn liên kết, trạng thái đọc |

> **[Bổ sung 2026-10-11]** Không có trong `Requirements.pdf`. Theo khảo sát lần 2 (mục 6.4, FR-108, FR-109), nhóm này cần thêm:
>
> | Thực thể | Mô tả — thuộc tính chính |
> |---|---|
> | `DeXuatThayDoi` *(thêm thuộc tính)* | nguồn phát sinh (Trường/Khoa), số văn bản căn cứ |
> | `HoSoDeXuat` *(mới)* | Hồ sơ căn cứ đính kèm đề xuất — đề xuất, loại hồ sơ (tờ trình/biên bản/biên bản họp hội đồng/biên bản thẩm định/công văn), tên tệp, đường dẫn lưu trữ, người tải lên, thời điểm |

#### 4.2.7. Nhóm Sinh viên và Kết quả học tập

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `SinhVien` | Mã sinh viên, họ tên, khóa tuyển sinh, ngành, Chương trình đào tạo, **phiên bản CTĐT áp dụng**, trạng thái |
| `KetQuaHocTap` | Sinh viên, học phần, học kỳ, điểm thang 10, điểm thang 4, điểm chữ, trạng thái (Đạt / Không đạt / Đang học / **Miễn**) |
| `KetQuaXetTotNghiep` | Sinh viên, thời điểm xét, kết luận, **danh sách thiếu hụt (JSON)** |

#### 4.2.8. Nhóm Hệ thống

| Thực thể | Mô tả — thuộc tính chính |
|---|---|
| `NhatKyHeThong` | Nhật ký bất biến toàn bộ thao tác — người thực hiện, hành động, thực thể tác động, giá trị cũ, giá trị mới, địa chỉ IP, thời điểm |
| `PhienNhapLieu` | Phiên nhập liệu từ Excel — loại nhập, tên tệp, người thực hiện, tổng dòng, số dòng thành công, số dòng lỗi, trạng thái |
| `LogDongBo` | Nhật ký đồng bộ với cơ sở dữ liệu ngoài — nguồn dữ liệu, thời điểm bắt đầu, thời điểm kết thúc, số bản ghi, trạng thái, thông báo lỗi |

### 4.3. Diễn giải cấu trúc dữ liệu hiện tại

Bảng dưới đây ánh xạ các cột trong file Excel hiện hành sang thực thể của hệ thống. Các ký hiệu được giữ nguyên như bản Excel gốc theo yêu cầu của bên đặt hàng.

| Cột Excel | Ánh xạ thực thể | Ghi chú |
|---|---|---|
| Mã chương trình | `ChuongTrinhDaoTao.maChuongTrinh` | Ví dụ: 1024034 |
| Tên chương trình đào tạo | `ChuongTrinhDaoTao.tenChuongTrinh` | Ví dụ: Công nghệ Thông tin K2023 Đặc thù_CNPM |
| Số học kỳ | `ChuongTrinhDaoTao.soHocKy` | Ví dụ: 8 |
| Tổng số tín chỉ yêu cầu | `ChuongTrinhDaoTao.tongTinChi` | Ví dụ: 130 |
| Số tín chỉ bắt buộc | `ChuongTrinhDaoTao.tinChiBatBuoc` | Ví dụ: 122 |
| Số tín chỉ tự chọn | `ChuongTrinhDaoTao.tinChiTuChon` | Ví dụ: 8 |
| Mã ngành | `ChuongTrinhDaoTao.maNganh` | Ví dụ: 7480201 |
| TT | `DongKhungCTDT.thuTu` | Số thứ tự dòng trong khung |
| **Ký hiệu** | `DongKhungCTDT.kyHieu` | Mã khối kiến thức. Giữ nguyên ký hiệu gốc, hệ thống không tự đặt lại |
| Mã HP | `HocPhan.maHocPhan` | Ví dụ: 3190111 |
| Tên học phần | `HocPhan.tenHocPhan` | Ví dụ: Giải tích 1 |
| Số tín chỉ | `HocPhan.soTinChi` | **Kiểu số thực: 0 · 1 · 2.5 · 3 · 4** |
| Học kỳ | `DongKhungCTDT.hocKyDuKien` | Học kỳ dự kiến (1–8) |
| Tự chọn | `DongKhungCTDT.laTuChon` | Cờ đánh dấu học phần tự chọn |
| **HT ĐA** | `DongKhungCTDT.htDA` | Cờ liên quan điều kiện đồ án. Giữ nguyên ký hiệu gốc, xem Q-04 |
| **TQ ĐA** | `DongKhungCTDT.tqDA` | Cờ liên quan điều kiện tiên quyết đồ án. Giữ nguyên ký hiệu gốc, xem Q-04 |
| **Điểm học** | `DongKhungCTDT.diemHoc` | Ngưỡng điểm tối thiểu để công nhận đã học học phần. Giá trị mẫu: 3 · 3.5 · 4 |
| **Điểm chuyển** | `DongKhungCTDT.diemChuyen` | Ngưỡng điểm tối thiểu để được chuyển tiếp/miễn |
| **"Đăng ký được?"** | *(cột suy diễn)* | **Không lưu trữ** — tính tự động bởi Bộ quy tắc, xem mục 7.3 |
| HP cần học trước | `QuanHeHocPhan` loại QH1 | Ví dụ: 3190111 – Giải tích 1 |
| HP song hành | `QuanHeHocPhan` loại QH3 | Ví dụ: 1020072 – Phương pháp tính |
| Cần HP tiên quyết | `QuanHeHocPhan` loại QH2 | Ví dụ: 4130501 – Anh văn A2.1 |
| Ghi chú | `DongKhungCTDT.ghiChu` | Ghi chú tự do |

> **[Ghi chú port]** Bảng ánh xạ Excel bị cắt phải trong bản PDF gốc. **Đã khôi phục ngày 2026-10-11** từ bản nguồn Markdown gốc (v1.0, 27/08/2026): bổ sung 6 dòng thông tin chương trình và cột ghi chú của các dòng còn lại. File Excel gốc vẫn chưa có trong kho tài liệu — cần đối chiếu khi nhận được.

---

## 5. YÊU CẦU CHỨC NĂNG

> **[Ghi chú port]** Mọi bảng yêu cầu chức năng trong bản PDF gốc đều có cột **Mức** nhận một trong ba giá trị `BẮT BUỘC` / `NÊN CÓ` / `TÙY CHỌN`. Ở các bảng bị cắt phải (FR-01..22, FR-33..37), cột này không đọc được từ file PDF. **Đã khôi phục đầy đủ** từ `Bo_so_do_Use_Case_CTDT/Thuyet_minh_Use_Case.md` — tài liệu đó được lập từ bản nguồn chưa bị cắt. Toàn bộ 107 FR nay đều có giá trị **Mức** xác định (90 BẮT BUỘC · 15 NÊN CÓ · 2 TÙY CHỌN). **Bổ sung 2026-10-11:** thêm FR-108 và FR-109 (mục 5.6), mức tạm thời NÊN CÓ → tổng **109 FR** (90 BẮT BUỘC · 17 NÊN CÓ · 2 TÙY CHỌN).

### 5.1. M1 — Quản trị tổ chức và Phân quyền

#### 5.1.1. Quản lý cơ cấu tổ chức

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-01 | Hệ thống cho phép quản lý cây đơn vị: Trường → Phòng Đào tạo, Trường → Khoa → Nhóm chuyên môn | BẮT BUỘC |
| FR-02 | Hệ thống cho phép quản lý 04 nhóm chuyên môn của Khoa Công nghệ Thông tin, cho phép thêm/sửa/ngừng sử dụng nhóm | BẮT BUỘC |
| FR-03 | Hệ thống cho phép gán một giảng viên vào **nhiều nhóm chuyên môn** đồng thời (quan hệ n–n) | BẮT BUỘC |
| FR-04 | Hệ thống cho phép chỉ định Điều phối nhóm chuyên môn cho từng nhóm, ghi nhận thời gian hiệu lực | BẮT BUỘC |
| FR-05 | Hệ thống cho phép ghi nhận học phần thuộc khoa khác (Toán, Vật lý, Lý luận chính trị, Ngoại ngữ) | BẮT BUỘC |

#### 5.1.2. Quản lý người dùng và vai trò

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-06 | Hệ thống cho phép tạo, sửa, vô hiệu hóa tài khoản người dùng. Không cho phép xóa cứng tài khoản đã phát sinh giao dịch | BẮT BUỘC |
| FR-07 | Hệ thống cho phép gán một người dùng nhiều vai trò đồng thời, mỗi vai trò gắn với một phạm vi đối tượng cụ thể | BẮT BUỘC |
| FR-08 | Hệ thống cho phép phân công Giám đốc CTĐT phụ trách 1..n Chương trình đào tạo | BẮT BUỘC |
| FR-09 | Hệ thống cho phép ủy quyền phê duyệt có thời hạn khi người duyệt vắng mặt; hết thời hạn tự động thu hồi ủy quyền | NÊN CÓ |
| FR-10 | Hệ thống ghi nhật ký toàn bộ thao tác thay đổi phân quyền | BẮT BUỘC |

### 5.2. M2 — Quản lý danh mục học phần

#### 5.2.1. Danh mục học phần

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-11 | Hệ thống quản lý danh mục học phần dùng chung, khóa chính là mã học phần | BẮT BUỘC |
| FR-12 | Số tín chỉ lưu ở kiểu số thực, hỗ trợ giá trị 0 và giá trị lẻ (0 · 1 · 2.5 · 3 · 4) | BẮT BUỘC |
| FR-13 | Tên học phần tiếng Việt bắt buộc, tên tiếng Anh tùy chọn | BẮT BUỘC |
| FR-14 | Hệ thống phân loại học phần: Lý thuyết · Thực hành · Thí nghiệm · Đồ án · Đồ án tốt nghiệp · Thực tập · Học phần điều kiện | BẮT BUỘC |
| FR-15 | Học phần có trạng thái: Đang sử dụng · Ngừng mở lớp · Đã hủy. Học phần ngừng mở lớp phải khai báo học phần thay thế | BẮT BUỘC |
| FR-16 | Học phần ghi nhận khoa phụ trách và nhóm chuyên môn phụ trách | BẮT BUỘC |
| FR-17 | Hệ thống hiển thị danh sách Chương trình đào tạo đang sử dụng học phần trước khi cho phép sửa | BẮT BUỘC |

#### 5.2.2. Quan hệ giữa học phần

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-18 | Hệ thống cho phép khai báo 05 loại quan hệ: học trước · tiên quyết · song hành · tương đương · thay thế | BẮT BUỘC |
| FR-19 | Quan hệ tiên quyết cho phép khai báo ngưỡng điểm | BẮT BUỘC |
| FR-20 | Hệ thống tự động phát hiện chu trình trong đồ thị quan hệ học trước/tiên quyết và chặn thao tác lưu | BẮT BUỘC |
| FR-21 | Hệ thống cho phép khai báo nhóm học phần tương đương (nhiều học phần cùng một nhóm, thay thế được cho nhau) | BẮT BUỘC |
| FR-22 | Hệ thống hiển thị đồ thị quan hệ học phần dưới dạng sơ đồ trực quan | NÊN CÓ |

### 5.3. M3 — Quản lý Chương trình đào tạo và Khung chương trình

#### 5.3.1. Thông tin Chương trình đào tạo

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-23 | Hệ thống quản lý thông tin CTĐT gồm: mã chương trình, tên chương trình, mã ngành, tên ngành, **trình độ (Kỹ sư / Cử nhân)**, khóa áp dụng, số học kỳ, tổng tín chỉ yêu cầu, số tín chỉ bắt buộc, số tín chỉ tự chọn | BẮT BUỘC |
| FR-24 | Hệ thống hỗ trợ đồng thời chương trình đào tạo **Kỹ sư** và **Cử nhân** với cấu trúc tín chỉ khác nhau | BẮT BUỘC |
| FR-25 | Hệ thống cho phép **nhân bản** một CTĐT hiện có làm nền cho chương trình khóa mới | BẮT BUỘC |
| FR-26 | Hệ thống liên kết CTĐT với Giám đốc CTĐT phụ trách | BẮT BUỘC |
#### 5.3.2. Khung chương trình

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-27 | Hệ thống quản lý khung chương trình dưới dạng danh sách dòng, mỗi dòng gồm đầy đủ các trường tương ứng với bảng Excel hiện tại (xem mục 4.3) | BẮT BUỘC |
| FR-28 | Hệ thống hiển thị khung chương trình **nhóm theo học kỳ**, có tổng tín chỉ từng học kỳ | BẮT BUỘC |
| FR-29 | Hệ thống cho phép khai báo **nhóm học phần tự chọn**, quy định số tín chỉ tối thiểu hoặc số học phần tối thiểu phải chọn trong nhóm | BẮT BUỘC |
| FR-30 | Hệ thống cho phép sắp xếp lại thứ tự dòng và chuyển học phần giữa các học kỳ | BẮT BUỘC |
| FR-31 | Hệ thống hiển thị cột "Đăng ký được?" như bảng Excel hiện tại, giá trị được **tính tự động** | BẮT BUỘC |
| FR-32 | Hệ thống cho phép lọc và tìm kiếm học phần trong khung theo học kỳ, khối kiến thức, trạng thái bắt buộc/tự chọn | BẮT BUỘC |
#### 5.3.3. Nhập và xuất dữ liệu

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-33 | Hệ thống cho phép nhập khung chương trình từ file Excel theo đúng định dạng bảng hiện hành | BẮT BUỘC |
| FR-34 | Chức năng nhập liệu có chế độ chạy thử (dry-run), hiển thị báo cáo lỗi theo từng dòng trước khi ghi vào cơ sở dữ liệu | BẮT BUỘC |
| FR-35 | Chức năng nhập liệu áp dụng nguyên tắc toàn vẹn: hoặc ghi toàn bộ, hoặc không ghi gì | BẮT BUỘC |
| FR-36 | Hệ thống cho phép xuất khung chương trình ra Excel với định dạng giống bản gốc | BẮT BUỘC |
| FR-37 | Hệ thống cho phép xuất Chương trình đào tạo ra PDF phục vụ in ấn và lưu trữ | NÊN CÓ |

### 5.4. M4 — Quản lý Chuẩn đầu ra

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-38 | Hệ thống quản lý danh sách PLO thuộc từng Chương trình đào tạo, gồm mã, mô tả tiếng Việt, mô tả tiếng Anh, nhóm năng lực | BẮT BUỘC |
| FR-39 | Hệ thống quản lý CLO thuộc đề cương chi tiết học phần | BẮT BUỘC |
| FR-40 | Hệ thống quản lý ma trận CLO – PLO theo từng cặp (Chương trình đào tạo, Học phần); một CLO chỉ gắn được PLO mà học phần đã gắn ở ma trận Học phần – PLO. Liên kết không mang mức độ (cập nhật 2026-10-18, Q-26) | BẮT BUỘC |
| FR-41 | Hệ thống quản lý ma trận Học phần – PLO theo từng chương trình: người dùng nhập trực tiếp các PLO mà học phần đóng góp, mỗi ô kèm trọng số (cập nhật 2026-10-18, Q-26; trước đó: suy diễn từ CLO – PLO, cho ghi đè) | NÊN CÓ |
| FR-42 | Hệ thống cảnh báo các lỗ hổng: PLO không được học phần nào đáp ứng · CLO không liên kết PLO nào · Học phần không đóng góp vào PLO nào | BẮT BUỘC |
| FR-43 | Hệ thống cho phép xuất ma trận chuẩn đầu ra ra Excel phục vụ công tác kiểm định | NÊN CÓ |
### 5.5. M5 — Quản lý Đề cương chi tiết và Công thức điểm

#### 5.5.1. Nội dung đề cương

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-44 | **Mỗi học phần có duy nhất một đề cương chi tiết**, dùng chung cho mọi Chương trình đào tạo | BẮT BUỘC |
| FR-45 | Đề cương gồm các phần: thông tin chung · mô tả học phần · mục tiêu · danh sách CLO · nội dung theo tuần/chương · phương pháp giảng dạy · phương pháp đánh giá · tài liệu tham khảo | BẮT BUỘC |
| FR-46 | Hệ thống cho phép soạn thảo nội dung bằng trình soạn thảo văn bản định dạng (rich text) | BẮT BUỘC |
| FR-47 | Hệ thống cho phép đính kèm đề cương đã ký, giáo trình, slide bài giảng và tài liệu khác (PDF, Word…), phân loại khi tải lên; giảng viên tải lên/xóa, không qua duyệt; tệp đính kèm được lưu theo phiên bản | NÊN CÓ |
| FR-48 | Đề cương hỗ trợ song ngữ Việt – Anh ở các trường: tên học phần, mô tả, CLO | NÊN CÓ |
#### 5.5.2. Công thức điểm

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-49 | Hệ thống cho phép khai báo danh sách thành phần đánh giá kèm trọng số (ví dụ: Chuyên cần 10%, Bài tập 20%, Giữa kỳ 20%, Cuối kỳ 50%) | BẮT BUỘC |
| FR-50 | Hệ thống **kiểm tra tổng trọng số bằng đúng 100% và chặn lưu** khi sai | BẮT BUỘC |
| FR-51 | Hệ thống cho phép đánh dấu thành phần điều kiện kèm ngưỡng (ví dụ: chuyên cần dưới ngưỡng thì không được dự thi) | BẮT BUỘC |
| FR-52 | Hệ thống cho phép khai báo điểm liệt của thành phần và của học phần | NÊN CÓ |
| FR-53 | Hệ thống cho phép ánh xạ thành phần đánh giá – CLO, đảm bảo mỗi CLO được đánh giá bởi ít nhất một thành phần | BẮT BUỘC |
| FR-54 | Hệ thống cảnh báo khi có CLO chưa được thành phần đánh giá nào bao phủ | BẮT BUỘC |
### 5.6. M6 — Quy trình đề xuất và phê duyệt

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-55 | Mọi thay đổi đối với dữ liệu đã ban hành phải được thực hiện thông qua **Đề xuất thay đổi**; không cho phép sửa trực tiếp | BẮT BUỘC |
| FR-56 | Hệ thống hỗ trợ các loại đề xuất: sửa công thức điểm · sửa PLO/CLO · sửa nội dung đề cương · sửa khung chương trình · sửa quan hệ học phần · sửa thông tin chương trình | BẮT BUỘC |
| FR-57 | Đề xuất luân chuyển qua **ba cấp duyệt**: Điều phối nhóm chuyên môn → Giám đốc CTĐT → Phòng Đào tạo | BẮT BUỘC |
| FR-58 | Hệ thống hiển thị **bảng so sánh trước/sau** (diff) của nội dung thay đổi tại mọi cấp duyệt | BẮT BUỘC |
| FR-59 | Người duyệt có ba lựa chọn: **Đồng ý** · **Trả lại** (kèm lý do bắt buộc) · **Từ chối** (kèm lý do bắt buộc) | BẮT BUỘC |
| FR-60 | Người tạo đề xuất được phép **thu hồi** đề xuất khi chưa có cấp nào phê duyệt | BẮT BUỘC |
| FR-61 | Khi người tạo đề xuất đồng thời là người duyệt của một cấp, hệ thống **tự động bỏ qua cấp đó** và ghi nhật ký lý do bỏ qua | BẮT BUỘC |
| FR-62 | Ban lãnh đạo khoa có quyền xem và bình luận trên mọi đề xuất thuộc khoa, **không tham gia chuỗi phê duyệt** | BẮT BUỘC |
| FR-63 | Hệ thống gửi thông báo trong ứng dụng cho người duyệt tiếp theo khi đề xuất chuyển cấp | BẮT BUỘC |
| FR-64 | Hệ thống gửi thông báo qua email cho các sự kiện quan trọng | NÊN CÓ |
| FR-65 | Hệ thống hiển thị hàng đợi công việc (danh sách đề xuất chờ duyệt) cho từng người duyệt | BẮT BUỘC |
| FR-66 | Hệ thống nhắc hạn khi đề xuất tồn đọng quá số ngày quy định | TÙY CHỌN |
| FR-67 | Hệ thống lưu **lịch sử đầy đủ** các bước duyệt: ai duyệt, khi nào, ý kiến gì | BẮT BUỘC |
| FR-68 | Hệ thống phát hiện và cảnh báo khi có **hai đề xuất đang mở** cùng tác động lên một đối tượng | BẮT BUỘC |

> **[Bổ sung 2026-10-11 — khảo sát lần 2]** Hai yêu cầu dưới đây không có trong `Requirements.pdf`; bối cảnh ở mục 6.4. Mức ưu tiên là **tạm thời**, chờ trả lời Q-18 và Q-19.
>
> | Mã | Yêu cầu | Mức |
> |---|---|---|
> | FR-108 | Đề xuất thay đổi ghi nhận **nguồn phát sinh** (Trường yêu cầu / Khoa đề nghị) và số văn bản căn cứ (công văn, quyết định) nếu có | NÊN CÓ |
> | FR-109 | Đề xuất thay đổi cho phép đính kèm **hồ sơ căn cứ** (tờ trình, biên bản, biên bản họp hội đồng, biên bản thẩm định, công văn); hồ sơ xem được ở mọi cấp duyệt | NÊN CÓ |

### 5.7. M7 — Quản lý phiên bản

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-69 | Khi Phòng Đào tạo phê duyệt cấp cuối, hệ thống tạo **ảnh chụp bất biến** toàn bộ Chương trình đào tạo (khung chương trình + đề cương liên quan + PLO/CLO + ma trận) | BẮT BUỘC |
| FR-70 | Mỗi phiên bản ghi nhận: số phiên bản, số quyết định ban hành, ngày ký, **học kỳ hiệu lực**, khóa áp dụng, người ban hành | BẮT BUỘC |
| FR-71 | Dữ liệu của phiên bản đã ban hành **không được phép sửa hoặc xóa** dưới bất kỳ hình thức nào | BẮT BUỘC |
| FR-72 | Hệ thống cho phép **so sánh hai phiên bản** bất kỳ của cùng một Chương trình đào tạo, hiển thị các mục thêm mới / bị xóa / bị thay đổi | BẮT BUỘC |
| FR-73 | Hệ thống cho phép xem lại nội dung đầy đủ của bất kỳ phiên bản lịch sử nào | BẮT BUỘC |
| FR-74 | Hệ thống duy trì ánh xạ **Khóa sinh viên → Phiên bản CTĐT áp dụng** | BẮT BUỘC |
| FR-75 | Việc thu hồi phiên bản ban hành nhầm được thực hiện bằng cách **ban hành phiên bản đính chính**, không xóa dữ liệu lịch sử | BẮT BUỘC |
| FR-76 | Hệ thống hiển thị dòng thời gian (timeline) các phiên bản của một Chương trình đào tạo | NÊN CÓ |
### 5.8. M8 — Bộ quy tắc và Tính toán tự động

#### 5.8.1. Kiểm tra tính nhất quán

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-77 | Hệ thống tự động tính tổng tín chỉ theo: toàn chương trình · từng học kỳ · từng khối kiến thức · bắt buộc và tự chọn | BẮT BUỘC |
| FR-78 | Hệ thống **cảnh báo khi tổng tín chỉ tính được khác với số khai báo**, cho phép ghi đè kèm lý do | BẮT BUỘC |
| FR-79 | Hệ thống phát hiện học phần tiên quyết được xếp ở học kỳ **sau** học phần phụ thuộc | BẮT BUỘC |
| FR-80 | Hệ thống phát hiện chu trình trong đồ thị học trước/tiên quyết | BẮT BUỘC |
| FR-81 | Hệ thống phát hiện học phần xuất hiện trùng lặp trong khung chương trình | BẮT BUỘC |
| FR-82 | Hệ thống hiển thị **bảng điều khiển kiểm tra sức khỏe** của Chương trình đào tạo, liệt kê toàn bộ cảnh báo hiện có | NÊN CÓ |
#### 5.8.2. Tính điều kiện đăng ký và xét tốt nghiệp

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-83 | Hệ thống tính cột **"Đăng ký được?"** cho từng học phần dựa trên kết quả học tập của sinh viên, trả về ba trạng thái như bảng Excel hiện hành | BẮT BUỘC |
| FR-84 | Hệ thống thực hiện **xét tốt nghiệp** cho sinh viên: kiểm tra đủ tín chỉ bắt buộc, đủ từng nhóm tự chọn, đủ các học phần điều kiện | BẮT BUỘC |
| FR-85 | Quá trình xét tốt nghiệp **có tính đến học phần tương đương** | BẮT BUỘC |
| FR-86 | Hệ thống liệt kê chi tiết các hạng mục còn thiếu khi sinh viên chưa đủ điều kiện tốt nghiệp | BẮT BUỘC |
| FR-87 | Hệ thống cho phép xét tốt nghiệp **theo lô** cho toàn bộ một khóa | NÊN CÓ |
### 5.9. M9 — Cổng sinh viên và Giao diện lập trình ứng dụng

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-88 | Sinh viên xem được Chương trình đào tạo **đúng phiên bản áp dụng cho khóa của mình** | BẮT BUỘC |
| FR-89 | Sinh viên xem được khung chương trình bố trí theo học kỳ, kèm trạng thái từng học phần: Đã học đạt · Đang học · Chưa học · Không đạt | BẮT BUỘC |
| FR-90 | Sinh viên xem được **tiến độ học tập**: số tín chỉ tích lũy, tỷ lệ hoàn thành, số tín chỉ còn thiếu | BẮT BUỘC |
| FR-91 | Sinh viên xem được **danh sách học phần đủ điều kiện đăng ký** cho học kỳ tới | BẮT BUỘC |
| FR-92 | Sinh viên xem được lý do cụ thể khi một học phần chưa đủ điều kiện đăng ký | BẮT BUỘC |
| FR-93 | Sinh viên xem được đề cương chi tiết và công thức điểm của từng học phần | BẮT BUỘC |
| FR-94 | Hệ thống cung cấp **REST API kèm tài liệu OpenAPI** phục vụ tích hợp với ứng dụng dDUT | BẮT BUỘC |
| FR-95 | Giao diện cổng sinh viên hoạt động tốt trên thiết bị di động (responsive) | BẮT BUỘC |
### 5.10. M10 — Tích hợp dữ liệu

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-96 | Hệ thống nhập dữ liệu từ **file Excel** cho: danh mục học phần · khung chương trình · danh sách sinh viên · kết quả học tập | BẮT BUỘC |
| FR-97 | Hệ thống cung cấp **tệp mẫu** cho từng loại dữ liệu nhập | BẮT BUỘC |
| FR-98 | Hệ thống kết nối **cơ sở dữ liệu có sẵn ở chế độ chỉ đọc** để lấy dữ liệu sinh viên và kết quả học tập | BẮT BUỘC |
| FR-99 | Hệ thống có tác vụ đồng bộ định kỳ, ghi nhật ký từng lần đồng bộ | BẮT BUỘC |
| FR-100 | Khi hai nguồn dữ liệu mâu thuẫn, hệ thống áp dụng quy tắc ưu tiên đã cấu hình và ghi nhận cảnh báo | BẮT BUỘC |
| FR-101 | Hệ thống lưu lịch sử các phiên nhập liệu kèm kết quả (số dòng thành công, số dòng lỗi) | BẮT BUỘC |
### 5.11. M11 — Báo cáo và Kiểm định

| Mã | Yêu cầu | Mức |
|---|---|---|
| FR-102 | Hệ thống cho phép **đối sánh hai Chương trình đào tạo** (ví dụ Kỹ sư và Cử nhân cùng ngành), hiển thị phần chung và phần khác biệt | NÊN CÓ |
| FR-103 | Hệ thống thống kê phân bổ tín chỉ theo khối kiến thức dưới dạng bảng và biểu đồ | NÊN CÓ |
| FR-104 | Hệ thống xuất ma trận PLO/CLO phục vụ kiểm định AUN-QA và báo cáo Bộ Giáo dục và Đào tạo | NÊN CÓ |
| FR-105 | Hệ thống ghi **nhật ký bất biến** toàn bộ thao tác: người thực hiện, hành động, đối tượng, giá trị trước/sau, thời điểm | BẮT BUỘC |
| FR-106 | Hệ thống cho phép tra cứu nhật ký theo người dùng, theo đối tượng, theo khoảng thời gian | BẮT BUỘC |
| FR-107 | Hệ thống thống kê tình hình xử lý đề xuất: số đề xuất theo trạng thái, thời gian xử lý trung bình từng cấp | TÙY CHỌN |
---

## 6. QUY TRÌNH NGHIỆP VỤ TRỌNG TÂM

### 6.1. Quy trình phê duyệt thay đổi ba cấp

#### 6.1.1. Sơ đồ trạng thái

```
                          ┌──────────┐
                          │  NHÁP    │◄──────────────────┐
                          └────┬─────┘                   │
                               │ Gửi duyệt               │ Trả lại
                               ▼                         │ (kèm lý do)
                  ┌────────────────────────┐             │
                  │ CHỜ ĐIỀU PHỐI NHÓM CM  │─────────────┤
                  │      (Cấp 1)           │             │
                  └───────────┬────────────┘             │
                              │ Đồng ý                   │
                              ▼                          │
                  ┌────────────────────────┐             │
                  │ CHỜ GIÁM ĐỐC CTĐT      │─────────────┤
                  │      (Cấp 2)           │             │
                  └───────────┬────────────┘             │
                              │ Đồng ý                   │
                              ▼                          │
                  ┌────────────────────────┐             │
                  │ CHỜ PHÒNG ĐÀO TẠO      │─────────────┘
                  │      (Cấp 3)           │
                  └───────────┬────────────┘
                              │ Đồng ý
                              ▼
                  ┌────────────────────────┐
                  │ ĐÃ DUYỆT               │
                  │ (chờ đến hạn hiệu lực) │
                  └───────────┬────────────┘
                              │ Đến học kỳ hiệu lực
                              ▼
                  ┌────────────────────────┐
                  │ ĐANG HIỆU LỰC          │
                  │ → Sinh phiên bản mới   │
                  └────────────────────────┘

    Nhánh kết thúc khác:
      • TỪ CHỐI  — đóng đề xuất, không thực thi (bất kỳ cấp nào)
      • THU HỒI  — người tạo rút lại khi chưa có cấp nào duyệt
```

#### 6.1.2. Bảng mô tả trạng thái

| Trạng thái | Người thao tác được | Hành động cho phép |
|---|---|---|
| **NHÁP** | Người tạo | Sửa nội dung · Gửi duyệt · Xóa |
| **CHỜ ĐIỀU PHỐI NHÓM CM** | Điều phối nhóm chuyên môn phụ trách học phần | Đồng ý · Trả lại · Từ chối |
| **CHỜ GIÁM ĐỐC CTĐT** | Giám đốc CTĐT phụ trách chương trình | Đồng ý · Trả lại · Từ chối |
| **CHỜ PHÒNG ĐÀO TẠO** | Phòng Đào tạo | Đồng ý · Trả lại · Từ chối |
| **ĐÃ DUYỆT** | Hệ thống | Chờ đến học kỳ hiệu lực |
| **ĐANG HIỆU LỰC** | — | Chỉ đọc |
| **TỪ CHỐI** | — | Chỉ đọc |
| **THU HỒI** | — | Chỉ đọc |

#### 6.1.3. Quy tắc xác định người duyệt

| Cấp | Nguyên tắc xác định |
|---|---|
| Cấp 1 | Điều phối nhóm chuyên môn của nhóm **phụ trách học phần** bị tác động. Nếu đề xuất tác động nhiều học phần thuộc nhiều nhóm, cần sự đồng ý của tất cả người điều phối nhóm liên quan |
| Cấp 2 | Giám đốc CTĐT của Chương trình đào tạo bị tác động. Nếu học phần thuộc nhiều CTĐT, cần sự đồng ý của tất cả Giám đốc liên quan |
| Cấp 3 | Bất kỳ tài khoản nào thuộc Phòng Đào tạo |

#### 6.1.4. Ví dụ luồng thực tế

**Kịch bản:** Giảng viên đề nghị sửa công thức điểm học phần "Cấu trúc dữ liệu"

| Bước | Người thực hiện | Hành động | Trạng thái sau bước |
|---|---|---|---|
| 1 | Giảng viên | Tạo đề xuất: đổi trọng số Cuối kỳ 50% → 40%, thêm Bài tập lớn 10% | NHÁP |
| 2 | Giảng viên | Gửi duyệt | CHỜ ĐIỀU PHỐI NHÓM CM |
| 3 | Điều phối nhóm Công nghệ phần mềm | Xem bảng so sánh, Đồng ý | CHỜ GIÁM ĐỐC CTĐT |
| 4 | Ban lãnh đạo khoa | Bình luận góp ý (không chặn luồng) | CHỜ GIÁM ĐỐC CTĐT |
| 5 | Giám đốc CTĐT | Xem bảng so sánh, Đồng ý | CHỜ PHÒNG ĐÀO TẠO |
| 6 | Phòng Đào tạo | Xem bảng so sánh, Đồng ý, nhập số quyết định và học kỳ hiệu lực | ĐÃ DUYỆT |
| 7 | Hệ thống | Đến học kỳ hiệu lực → sinh phiên bản CTĐT mới | ĐANG HIỆU LỰC |

### 6.2. Quy trình quản lý phiên bản

#### 6.2.1. Nguyên tắc

Hệ thống áp dụng mô hình **ảnh chụp toàn bộ (full snapshot)**:

1. Chỉ tồn tại một phiên bản đang hiệu lực tại mỗi thời điểm cho mỗi Chương trình đào tạo.
2. Khi Phòng Đào tạo phê duyệt, hệ thống sao chép toàn bộ dữ liệu liên quan sang phiên bản mới.
3. Phiên bản cũ chuyển sang trạng thái Lịch sử, dữ liệu giữ nguyên vĩnh viễn.
4. Sinh viên các khóa cũ tiếp tục được gắn với phiên bản cũ.

#### 6.2.2. Nội dung một ảnh chụp phiên bản

| Thành phần | Bao gồm |
|---|---|
| Thông tin chương trình | Toàn bộ trường dữ liệu mô tả tại thời điểm ban hành |
| Khung chương trình | Toàn bộ dòng khung, kèm ràng buộc học trước/tiên quyết/song hành |
| Nhóm tự chọn | Toàn bộ nhóm và quy định số tín chỉ tối thiểu |
| Chuẩn đầu ra | Toàn bộ PLO của chương trình |
| Đề cương chi tiết | Ảnh chụp đề cương của **mọi học phần có trong khung** |
| CLO và ma trận | Toàn bộ CLO và ma trận CLO–PLO tại thời điểm đó |
| Thông tin ban hành | Số phiên bản, số quyết định, ngày ký, học kỳ hiệu lực, khóa áp dụng, người ban hành |

#### 6.2.3. Sơ đồ minh họa

```
CTĐT: Công nghệ Thông tin Đặc thù_CNPM (Mã 1024034)
│
├── Phiên bản 1.0  ── QĐ 145/QĐ-ĐHBK ── HK1 2023-2024 ── Khóa K2023
│   └── [LỊCH SỬ]   Ảnh chụp: khung + 52 đề cương + 11 PLO
│
├── Phiên bản 1.1  ── QĐ 302/QĐ-ĐHBK ── HK1 2024-2025 ── Khóa K2023, K2024
│   └── [LỊCH SỬ]   Thay đổi: công thức điểm 3 học phần
│
└── Phiên bản 2.0  ── QĐ 411/QĐ-ĐHBK ── HK1 2025-2026 ── Khóa K2025
    └── [HIỆU LỰC]  Thay đổi: cập nhật PLO, thay 4 học phần tự chọn

Ánh xạ sinh viên:
    K2023 → Phiên bản 1.1
    K2024 → Phiên bản 1.1
    K2025 → Phiên bản 2.0
```

### 6.3. Quy trình nhập dữ liệu ban đầu từ Excel

```
   ┌──────────────────┐
   │ 1. Tải tệp mẫu   │
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │ 2. Tải lên file  │
   │    Excel dữ liệu │
   └────────┬─────────┘
            ▼
   ┌────────────────────────────────────┐
   │ 3. Hệ thống chạy thử (dry-run)     │
   │    • Kiểm tra định dạng            │
   │    • Kiểm tra mã học phần tồn tại  │
   │    • Kiểm tra trùng lặp            │
   │    • Kiểm tra chu trình tiên quyết │
   └────────┬───────────────────────────┘
            ▼
   ┌────────────────────────────────────┐
   │ 4. Hiển thị báo cáo theo từng dòng │
   │    Dòng 15: LỖI — Mã HP 9999999    │
   │             không tồn tại          │
   │    Dòng 22: CẢNH BÁO — Tín chỉ 0   │
   └────────┬───────────────────────────┘
            │
      ┌─────┴──────┐
      │            │
   Có lỗi      Không lỗi
      │            │
      ▼            ▼
  ┌────────┐  ┌─────────────────────┐
  │ DỪNG   │  │ 5. Xác nhận ghi     │
  │ Không  │  │    (toàn vẹn:       │
  │ ghi gì │  │    all-or-nothing)  │
  └────────┘  └──────────┬──────────┘
                         ▼
              ┌──────────────────────┐
              │ 6. Ghi nhật ký phiên │
              │    nhập liệu         │
              └──────────────────────┘
```

### 6.4. Bối cảnh điều chỉnh thực tế theo khảo sát lần 2

> **[Bổ sung 2026-10-11]** Mục này không có trong `Requirements.pdf`. Nội dung lấy từ ghi chú khảo sát lần 2 (`docs/notes/raw-notes-pbl6-mr-ly.txt`); chính ghi chú đó ghi "thủ tục phải hỏi rõ hơn" và "cần verify lại với thầy Bình". Mọi điểm chưa được xác nhận đều dẫn sang câu hỏi ở mục 13.5. Sơ đồ nháp của các luồng này nằm ở `docs/notes/interview2-workflows.md`, cũng chưa được xác nhận.

#### 6.4.1. Hai nguồn phát sinh thay đổi

| Nguồn | Nội dung điều chỉnh | Hồ sơ căn cứ theo ghi chú |
|---|---|---|
| **Trường** | Trường yêu cầu Khoa thay đổi Chương trình đào tạo, ví dụ đợt rà soát điều chỉnh 5 năm một lần | Công văn quyết định thay đổi CTĐT của Trường; biên bản họp hội đồng, biên bản thẩm định |
| **Khoa** | Cập nhật đề cương (Khoa có quyền cập nhật sau 1 năm); điều chỉnh thời gian của một học phần, ví dụ chuyển từ học kỳ 1 sang học kỳ 2 | Tờ trình và biên bản do Khoa lập |

Ở cả hai nguồn, thay đổi chỉ được thực hiện **sau khi hồ sơ trình được duyệt** — khớp với FR-55 (không sửa trực tiếp dữ liệu đã ban hành).

#### 6.4.2. Phân tầng quản lý

| Cấp | Phạm vi theo ghi chú | Tương ứng trong tài liệu này |
|---|---|---|
| Trường | Toàn bộ khung CTĐT | R1 Phòng Đào tạo — toàn hệ thống (mục 3.3) |
| Khoa | Khung chương trình của khoa mình | R2 Ban lãnh đạo khoa và R3 Giám đốc CTĐT — ai chịu trách nhiệm chính chưa rõ, xem Q-24 |
| Giảng viên | Học phần do mình soạn đề cương | R5 Giảng viên — vẫn phải qua Đề xuất thay đổi (FR-55). Mục 3.3 hiện xác định phạm vi theo **nhóm chuyên môn**, chưa theo người soạn đề cương, xem Q-27 |

#### 6.4.3. Tác động lên tài liệu này

| Nội dung | Xử lý |
|---|---|
| Luồng phê duyệt ba cấp (mục 6.1) | **Không đổi** — DEC-04 |
| Nguồn phát sinh và văn bản căn cứ | FR-108; thuộc tính bổ sung của `DeXuatThayDoi` (mục 4.2.6) |
| Tờ trình, biên bản, công văn | FR-109; thực thể `HoSoDeXuat` (mục 4.2.6). Số hóa hay chỉ đính kèm: Q-18 |
| Người tạo đề xuất khi Trường ra công văn | Q-19 |
| Đợt rà soát 5 năm, hội đồng thẩm định | Q-20 |
| Giảm cấp duyệt cho thay đổi nhỏ, hạn nộp, văn bản quy trình của Trường | Q-21, Q-22, Q-23 |

---

## 7. QUY TẮC NGHIỆP VỤ VÀ CÔNG THỨC TÍNH TOÁN

### 7.1. Quy tắc về tín chỉ

| Mã | Quy tắc |
|---|---|
| BR-01 | Số tín chỉ là **số thực không âm**, cho phép giá trị 0 và giá trị thập phân (0 · 1 · 2.5 · 3 · 4) |
| BR-02 | Học phần 0 tín chỉ **không cộng vào tổng tín chỉ tích lũy**, nhưng **vẫn bắt buộc hoàn thành** để được xét tốt nghiệp |
| BR-03 | Tổng tín chỉ bắt buộc + Tổng tín chỉ tự chọn = Tổng tín chỉ yêu cầu của chương trình |
| BR-04 | Tổng tín chỉ của các học phần trong một nhóm tự chọn **được phép lớn hơn** số tín chỉ tự chọn yêu cầu (sinh viên chọn một phần) |
| BR-05 | Khi tổng tín chỉ tính được khác số khai báo, hệ thống **sinh cảnh báo nhưng không chặn việc lưu** |

**Công thức tính tổng tín chỉ:**

```
TongTC_TinhDuoc = Σ(soTinChi của HP bắt buộc)
                + Σ(soTinChi tối thiểu của mỗi nhóm tự chọn)

Nếu |TongTC_TinhDuoc − TongTC_KhaiBao| > 0  →  Sinh cảnh báo mức CẢNH BÁO
```

### 7.2. Quy tắc về quan hệ học phần

| Mã | Quy tắc |
|---|---|
| BR-06 | Quan hệ **học trước** được thỏa mãn khi sinh viên đã đăng ký và có kết quả học phần nguồn, **kể cả kết quả không đạt** |
| BR-07 | Quan hệ **tiên quyết** được thỏa mãn khi điểm học phần nguồn ≥ ngưỡng Điểm học đã khai báo |
| BR-08 | Quan hệ **song hành** được thỏa mãn khi học phần nguồn đã hoàn thành **hoặc** được đăng ký trong cùng học kỳ |
| BR-09 | Quan hệ **tương đương** là quan hệ **hai chiều và bắc cầu**, được mô hình hóa bằng **nhóm học phần tương đương** |
| BR-10 | Khi các học phần tương đương có số tín chỉ khác nhau, số tín chỉ được công nhận là **số tín chỉ của học phần sinh viên đã học thực tế** |
| BR-11 | Đồ thị quan hệ học trước/tiên quyết **không được phép có chu trình** |

### 7.3. Thuật toán xác định điều kiện đăng ký

```
HÀM XacDinhDieuKienDangKy(sinhVien, hocPhan, hocKyDangXet):

  // Bước 1: Đã hoàn thành chưa
  NẾU sinhVien đã có kết quả đạt cho hocPhan (hoặc học phần tương đương):
      TRẢ VỀ "Đã hoàn thành"

  // Bước 2: Kiểm tra học phần tiên quyết
  VỚI MỖI hp_tq TRONG DanhSachTienQuyet(hocPhan):
      diem = LayDiemCaoNhat(sinhVien, hp_tq hoặc nhóm tương đương)
      NẾU diem KHÔNG TỒN TẠI HOẶC diem < NguongDiemHoc(hp_tq):
          Thêm hp_tq vào danhSachThieu

  // Bước 3: Kiểm tra học phần học trước
  VỚI MỖI hp_ht TRONG DanhSachHocTruoc(hocPhan):
      NẾU sinhVien CHƯA có kết quả nào cho hp_ht (hoặc nhóm tương đương):
          Thêm hp_ht vào danhSachThieu

  NẾU danhSachThieu KHÔNG RỖNG:
      TRẢ VỀ "Không được — thiếu: " + danhSachThieu

  // Bước 4: Kiểm tra học phần song hành
  VỚI MỖI hp_sh TRONG DanhSachSongHanh(hocPhan):
      NẾU sinhVien CHƯA hoàn thành hp_sh:
          ketQua_sh = XacDinhDieuKienDangKy(sinhVien, hp_sh, hocKyDangXet)
          NẾU ketQua_sh BẮT ĐẦU BẰNG "Không được":
              TRẢ VỀ "Không được — học phần song hành chưa đủ điều kiện"
          NGƯỢC LẠI:
              TRẢ VỀ "Được, nếu ĐK được HP song hành"

  // Bước 5: Đủ mọi điều kiện
  TRẢ VỀ "Được"
```

**Giá trị trả về và cách hiển thị:**

| Giá trị | Ý nghĩa | Hiển thị |
|---|---|---|
| **"Được"** | Đủ mọi điều kiện, đăng ký được ngay | Màu xanh |
| **"Được, nếu ĐK được HP song hành"** | Đăng ký được với điều kiện đăng ký kèm học phần song hành | Màu vàng |
| **"Không được — <lý do>"** | Chưa đủ điều kiện, kèm danh sách học phần còn thiếu | Màu đỏ |
| **"Đã hoàn thành"** | Đã học đạt học phần này | Màu xám |

> **Lưu ý phòng lặp vô hạn:** Bước 4 sử dụng đệ quy. Do đồ thị quan hệ đã được bảo đảm không chu trình (BR-11), đệ quy luôn kết thúc. Hệ thống vẫn áp dụng giới hạn độ sâu 20 cấp như biện pháp phòng vệ.

### 7.4. Thuật toán xét tốt nghiệp

```
HÀM XetTotNghiep(sinhVien):

  ctdt = LayPhienBanCTDT(sinhVien.khoa)
  danhSachThieuHut = []

  // Kiểm tra 1: Học phần bắt buộc
  VỚI MỖI hp TRONG ctdt.DanhSachHocPhanBatBuoc:
      NẾU KHÔNG DaDatHocPhan(sinhVien, hp hoặc nhóm tương đương):
          Thêm ("Thiếu học phần bắt buộc", hp) vào danhSachThieuHut

  // Kiểm tra 2: Từng nhóm tự chọn
  VỚI MỖI nhom TRONG ctdt.DanhSachNhomTuChon:
      tcDat = Σ(soTinChi các HP trong nhom mà sinhVien đã đạt)
      NẾU tcDat < nhom.soTinChiToiThieu:
          Thêm ("Thiếu tín chỉ nhóm " + nhom.ten,
                nhom.soTinChiToiThieu − tcDat) vào danhSachThieuHut

  // Kiểm tra 3: Tổng tín chỉ tích lũy
  tongTCTichLuy = Σ(soTinChi các HP sinhVien đã đạt, trừ HP 0 tín chỉ)
  NẾU tongTCTichLuy < ctdt.tongTinChiYeuCau:
      Thêm ("Thiếu tổng tín chỉ",
            ctdt.tongTinChiYeuCau − tongTCTichLuy) vào danhSachThieuHut

  // Kiểm tra 4: Học phần điều kiện (kể cả HP 0 tín chỉ)
  VỚI MỖI hp TRONG ctdt.DanhSachHocPhanDieuKien:
      NẾU KHÔNG DaDatHocPhan(sinhVien, hp):
          Thêm ("Chưa hoàn thành học phần điều kiện", hp) vào danhSachThieuHut

  NẾU danhSachThieuHut RỖNG:
      TRẢ VỀ ("ĐỦ ĐIỀU KIỆN", [])
  NGƯỢC LẠI:
      TRẢ VỀ ("CHƯA ĐỦ ĐIỀU KIỆN", danhSachThieuHut)
```

### 7.5. Quy tắc về công thức điểm

| Mã | Quy tắc |
|---|---|
| BR-12 | Tổng trọng số các thành phần đánh giá phải bằng **đúng 100%** |
| BR-13 | Mỗi trọng số là số thực thuộc khoảng **(0, 100]** |
| BR-14 | **Mọi CLO phải được ít nhất một thành phần đánh giá bao phủ** |
| BR-15 | Thành phần được đánh dấu **"điều kiện"** phải khai báo ngưỡng đạt; không đạt ngưỡng này thì kết quả học phần là **Không đạt** bất kể điểm tổng |
| BR-16 | Thay đổi công thức điểm **có hiệu lực từ học kỳ kế tiếp**, không hồi tố cho lớp đang học |

### 7.6. Quy tắc về chuẩn đầu ra

| Mã | Quy tắc |
|---|---|
| BR-17 | Mỗi PLO thuộc về **đúng một** Chương trình đào tạo |
| BR-18 | Mỗi CLO thuộc về **đúng một** đề cương chi tiết học phần |
| BR-19 | Ma trận CLO–PLO được khai báo theo **cặp (Chương trình đào tạo, Học phần)**, vì một học phần thuộc nhiều chương trình sẽ có bộ PLO khác nhau |
| BR-20 | Mọi PLO phải được **ít nhất một học phần** trong khung chương trình đóng góp; nếu không, sinh cảnh báo |
| BR-21 | Mức đóng góp của học phần vào PLO là **trọng số số thực** trên ma trận Học phần – PLO; liên kết CLO – PLO không mang mức độ (cập nhật 2026-10-18, Q-26; trước đó: thang I–R–M hoặc 1–2–3) |

> **[Ghi chú port — xung đột nội tại]** BR-19 (ma trận CLO–PLO tách theo CTĐT) kết hợp với DEC-02 (một đề cương dùng chung cho mọi CTĐT) dẫn tới hệ quả: **CLO dùng chung nhưng ánh xạ CLO→PLO tách riêng**. DEC-03 giải quyết điều này, và Q-01 ghi nhận rằng nếu Khoa yêu cầu **CLO** cũng phải khác nhau theo từng CTĐT thì DEC-02 phải được xem xét lại. Nội dung trên được port nguyên văn, **không chỉnh sửa**. **Cập nhật 2026-10-11:** Q-01 đã chốt — CLO dùng chung theo học phần, xem DEC-03.

### 7.7. Quy tắc về phiên bản

| Mã | Quy tắc |
|---|---|
| BR-22 | Mỗi Chương trình đào tạo có **tối đa một phiên bản Đang hiệu lực** tại mỗi thời điểm |
| BR-23 | Phiên bản đã ban hành là **bất biến** |
| BR-24 | Số phiên bản theo định dạng `<Chính>.<Phụ>` — thay đổi khung chương trình hoặc PLO tăng số **Chính**; thay đổi đề cương hoặc công thức điểm tăng số **Phụ** |
| BR-25 | Phiên bản mới có hiệu lực **từ đầu học kỳ** được chỉ định, không áp dụng giữa học kỳ |
| BR-26 | Sinh viên được gắn với phiên bản CTĐT tại thời điểm nhập học và **giữ nguyên trong suốt khóa học**, trừ khi có quyết định chuyển đổi cụ thể |

### 7.8. Quy tắc về phê duyệt

| Mã | Quy tắc |
|---|---|
| BR-27 | **Không ai được phê duyệt đề xuất do chính mình tạo**; hệ thống tự động bỏ qua cấp đó |
| BR-28 | Hành động **Trả lại** và **Từ chối** bắt buộc kèm lý do, độ dài tối thiểu **20 ký tự** |
| BR-29 | Đề xuất bị trả lại trở về trạng thái NHÁP và khi gửi lại phải **đi lại từ cấp 1** |
| BR-30 | Tạo đề xuất mới trên đối tượng đang có đề xuất mở sẽ nhận **cảnh báo xung đột** |
| BR-31 | Phòng Đào tạo có quyền **phê duyệt trực tiếp ở bất kỳ cấp nào** (override), có ghi nhật ký |

---

## 8. YÊU CẦU DỮ LIỆU VÀ TÍCH HỢP

### 8.1. Các nguồn dữ liệu

| Nguồn | Vai trò | Dữ liệu | Chiều |
|---|---|---|---|
| Hệ thống CMS | Đọc/Ghi | CTĐT, khung chương trình, đề cương, PLO/CLO, đề xuất, phiên bản | Hai chiều |
| File Excel | Nhập | Danh mục học phần, khung chương trình, sinh viên, kết quả học tập | Vào |
| Cơ sở dữ liệu có sẵn | Chỉ đọc | Sinh viên, kết quả học tập, lớp học phần | Vào |
| Ứng dụng dDUT | API | Chương trình đào tạo, tiến độ học tập, điều kiện đăng ký | Ra |

### 8.2. Quy tắc ưu tiên khi dữ liệu mâu thuẫn

| Loại dữ liệu | Nguồn ưu tiên | Lý do |
|---|---|---|
| Kết quả học tập | Cơ sở dữ liệu có sẵn | Là nguồn chính thức, cập nhật liên tục |
| Danh sách sinh viên | Cơ sở dữ liệu có sẵn | Là nguồn chính thức |
| Danh mục học phần | Hệ thống CMS | Do Phòng Đào tạo quản lý trực tiếp trên hệ thống |
| Khung chương trình | Hệ thống CMS | Do quy trình phê duyệt sinh ra |

### 8.3. Yêu cầu Giao diện lập trình ứng dụng

| Mã | Yêu cầu |
|---|---|
| API-01 | Giao diện theo kiến trúc REST, định dạng dữ liệu JSON |
| API-02 | Có tài liệu OpenAPI 3.0 truy cập được qua giao diện web |
| API-03 | Xác thực bằng token, mỗi bên tích hợp có khóa riêng |
| API-04 | Có giới hạn tần suất gọi (rate limiting) |
| API-05 | Trả về mã lỗi HTTP chuẩn kèm thông báo bằng tiếng Việt |

**Các điểm cuối chính:**

| Phương thức | Đường dẫn | Trả về |
|---|---|---|
| GET | `/api/v1/sinh-vien/{mssv}/chuong-trinh` | CTĐT đúng phiên bản của sinh viên |
| GET | `/api/v1/sinh-vien/{mssv}/tien-do` | Tiến độ học tập |
| GET | `/api/v1/sinh-vien/{mssv}/hoc-phan-du-dieu-kien` | Danh sách học phần đăng ký được |
| GET | `/api/v1/sinh-vien/{mssv}/xet-tot-nghiep` | Kết quả xét tốt nghiệp |
| GET | `/api/v1/hoc-phan/{maHP}/de-cuong` | Đề cương chi tiết học phần |
| GET | `/api/v1/chuong-trinh/{maCT}/phien-ban/{soPB}` | Nội dung một phiên bản CTĐT |

---

## 9. YÊU CẦU PHI CHỨC NĂNG

### 9.1. Hiệu năng

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Thời gian phản hồi các thao tác tra cứu dưới **2 giây** |
| NFR-02 | Tính điều kiện đăng ký cho toàn bộ khung chương trình của một sinh viên dưới **3 giây** |
| NFR-03 | Xét tốt nghiệp theo lô cho một khóa (khoảng 500 sinh viên) dưới **5 phút** |
| NFR-04 | Hệ thống phục vụ đồng thời tối thiểu **200 người dùng** |
| NFR-05 | Nhập file Excel 1000 dòng hoàn thành dưới **60 giây** |

### 9.2. An toàn và bảo mật

| Mã | Yêu cầu |
|---|---|
| NFR-06 | Mật khẩu được băm, **không lưu dạng rõ** |
| NFR-07 | Toàn bộ lưu lượng truyền qua **HTTPS** |
| NFR-08 | Phiên làm việc tự hết hạn sau **60 phút** không hoạt động |
| NFR-09 | Phân quyền được kiểm tra ở **tầng máy chủ**, không chỉ ẩn/hiện trên giao diện |
| NFR-10 | Nhật ký hệ thống chỉ cho phép **ghi thêm** (append-only) |
| NFR-11 | Sinh viên chỉ truy cập được dữ liệu của chính mình |

### 9.3. Độ tin cậy

| Mã | Yêu cầu |
|---|---|
| NFR-12 | Sao lưu cơ sở dữ liệu **tự động hằng ngày**, giữ tối thiểu **30 bản gần nhất** |
| NFR-13 | Có quy trình phục hồi dữ liệu đã được kiểm thử |
| NFR-14 | Dữ liệu phiên bản đã ban hành **không bị mất** trong bất kỳ lần nâng cấp nào |
| NFR-15 | Mục tiêu thời gian hoạt động **99%** trong giờ làm việc |

### 9.4. Khả năng sử dụng

| Mã | Yêu cầu |
|---|---|
| NFR-16 | Toàn bộ giao diện và thông báo bằng **tiếng Việt có dấu** |
| NFR-17 | Cổng sinh viên hoạt động tốt trên màn hình rộng **từ 360px** |
| NFR-18 | Mọi danh sách dài có **phân trang, tìm kiếm và sắp xếp** |
| NFR-19 | Thông báo lỗi nêu rõ **nguyên nhân và cách xử lý**, không hiển thị lỗi kỹ thuật thô |
| NFR-20 | Thao tác không thể hoàn tác phải có **hộp thoại xác nhận** |

### 9.5. Khả năng bảo trì

| Mã | Yêu cầu |
|---|---|
| NFR-21 | Kiến trúc **monolith** với phân tách rõ ràng theo module nghiệp vụ |
| NFR-22 | Quy ước đặt tên thống nhất, có tài liệu mô tả |
| NFR-23 | Thay đổi lược đồ cơ sở dữ liệu thực hiện qua **công cụ migration** |
| NFR-24 | Tham số nghiệp vụ (ngưỡng điểm, số cấp duyệt, thời hạn nhắc) khai báo trong **cấu hình**, không viết cứng trong mã nguồn |

### 9.6. Tính tương thích

| Mã | Yêu cầu |
|---|---|
| NFR-25 | Hệ thống triển khai được trên máy chủ do Khoa cung cấp |
| NFR-26 | Hoạt động trên các phiên bản gần đây của Chrome, Firefox, Edge |
| NFR-27 | Có tài liệu hướng dẫn cài đặt và hướng dẫn sử dụng cho từng vai trò |

---

## 10. CÁC QUYẾT ĐỊNH THIẾT KẾ ĐÃ CHỐT

### DEC-01 — Mô hình quản lý phiên bản: Ảnh chụp toàn bộ

| | |
|---|---|
| **Quyết định** | Mỗi lần ban hành tạo một ảnh chụp bất biến của **toàn bộ** Chương trình đào tạo |
| **Phương án thay thế đã cân nhắc** | Quản lý phiên bản độc lập cho từng thành phần (khung, đề cương, PLO) |
| **Lý do chọn** | Truy vết đơn giản; trả lời trực tiếp câu hỏi "Khóa K2023 theo chương trình nào?"; dễ so sánh hai phiên bản; toàn vẹn lịch sử tuyệt đối |
| **Hệ quả** | Dung lượng lưu trữ tăng theo số phiên bản; mỗi thay đổi nhỏ tạo một phiên bản mới của toàn bộ chương trình |
| **Đánh đổi chấp nhận** | Dung lượng không phải vấn đề ở quy mô vài chục chương trình và vài phiên bản mỗi năm |

### DEC-02 — Đề cương chi tiết dùng chung theo học phần

| | |
|---|---|
| **Quyết định** | Mỗi học phần có **một đề cương chi tiết duy nhất**, dùng chung cho mọi Chương trình đào tạo |
| **Phương án thay thế đã cân nhắc** | Mỗi cặp (CTĐT, Học phần) có một đề cương riêng |
| **Lý do chọn** | Phù hợp thực tế nghiệp vụ đã được xác nhận; tránh trùng lặp và phân kỳ nội dung giữa các bản sao |
| **Hệ quả** | Sửa một đề cương lan tỏa tới mọi CTĐT có chứa học phần đó |
| **Biện pháp xử lý hệ quả** | FR-17 yêu cầu hiển thị danh sách CTĐT bị ảnh hưởng trước khi gửi duyệt; mục 6.1.3 yêu cầu tất cả Giám đốc CTĐT liên quan phải đồng ý |

> **[Ghi chú port — xung đột nội tại]** DEC-02 (đề cương và CLO dùng chung) đứng cạnh BR-19 (ma trận CLO–PLO tách theo CTĐT). Hai điều này **không mâu thuẫn trực tiếp** vì DEC-03 tách riêng phần ánh xạ, nhưng Q-01 ghi nhận đây là điểm **cần Khoa xác nhận**: nếu CLO cũng phải khác nhau theo CTĐT thì DEC-02 không còn đúng. Port nguyên văn, không chỉnh sửa. **Cập nhật 2026-10-11:** Q-01 đã chốt — CLO dùng chung theo học phần, DEC-02 giữ nguyên; xem DEC-03.

### DEC-03 — Ma trận CLO–PLO tách theo Chương trình đào tạo

| | |
|---|---|
| **Vấn đề** | DEC-02 khiến đề cương (và CLO trong đó) dùng chung, nhưng PLO lại thuộc về từng CTĐT. Một học phần thuộc hai chương trình phải ánh xạ CLO tới hai bộ PLO khác nhau |
| **Quyết định** | **Bộ CLO dùng chung theo học phần; bảng ánh xạ CLO→PLO tách theo cặp (CTĐT, Học phần)** |
| **Lý do chọn** | Là cách duy nhất thỏa mãn đồng thời "một đề cương cho một học phần" và "PLO thuộc về từng chương trình" |
| **Hệ quả** | Bảng `MaTranCLO_PLO` có khóa ba phần: Chương trình đào tạo + CLO + PLO |
| **Trạng thái** | **Đã chốt 2026-10-11**, đóng Q-01 — quyết định của nhóm thực hiện, chưa có xác nhận bằng văn bản của Khoa. Trước đó dòng này ghi "Cần xác nhận": nếu Khoa yêu cầu CLO phải khác nhau theo từng CTĐT thì DEC-02 phải được xem xét lại |
| **Căn cứ chốt** | (1) Ghi chú phỏng vấn thầy Bình: mỗi học phần "chỉ có 1 đề cương". (2) Hệ thống PLO/CLO ở kho `plo-clo-backend` dùng đúng mô hình này: CLO gắn với học phần (không gắn với chương trình), PLO gắn với chương trình, liên kết CLO–PLO nhiều–nhiều. Câu "1 CTĐT có PLO, CLO" trong cùng ghi chú được đáp ứng bằng việc mỗi CTĐT có bộ PLO riêng và bảng ánh xạ CLO→PLO riêng |
| **So với `plo-clo-backend`** | Ở đó CLO được định danh theo (học phần, học kỳ); ở đây CLO được phiên bản hóa qua đề cương và ảnh chụp CTĐT (DEC-01) — cùng mục đích, khác cơ chế. Các điểm còn khác nhau được treo ở Q-25, Q-26, Q-28 |
| **Ràng buộc bổ sung** | Khi một học phần bị gỡ khỏi khung của một CTĐT, các dòng `MaTranCLO_PLO` của cặp (CTĐT, Học phần) đó **không được mang sang phiên bản mới**. `plo-clo-backend` để lại liên kết CLO–PLO mồ côi trong trường hợp này |

### DEC-04 — Luồng phê duyệt ba cấp

| | |
|---|---|
| **Quyết định** | Điều phối nhóm chuyên môn (cấp 1) → Giám đốc CTĐT (cấp 2) → Phòng Đào tạo (cấp 3) |
| **Phương án thay thế đã cân nhắc** | Hai cấp (bỏ Điều phối nhóm chuyên môn) · Bốn cấp (thêm Ban lãnh đạo khoa) · Luồng cấu hình hoàn toàn tự do |
| **Lý do chọn** | Ba cấp phản ánh đúng quyền sở hữu chuyên môn thực tế của Điều phối nhóm chuyên môn mà không làm luồng duyệt dài tới mức không khả thi |
| **Vai trò Ban lãnh đạo khoa** | Được xem và bình luận trên mọi đề xuất, **không phải chốt chặn** — tránh làm nghẽn luồng |
| **Cơ chế mở rộng** | Số cấp và người duyệt từng cấp khai báo trong bảng cấu hình (NFR-24), cho phép thêm cấp sau này mà không sửa mã nguồn |
| **Xác nhận 2026-10-11** | **Giữ ba cấp.** Ghi chú phỏng vấn thầy Bình có mô tả luồng hai cấp (Giám đốc CTĐT → Phòng Đào tạo), đồng thời vẫn liệt kê vai trò phụ trách nhóm chuyên môn trong cơ cấu khoa; nhóm thực hiện quyết định giữ cấp 1. Khả năng giảm cấp cho thay đổi nhỏ được treo ở Q-21 |

### DEC-05 — Giữ nguyên ký hiệu của bản Excel gốc

| | |
|---|---|
| **Quyết định** | Toàn bộ ký hiệu, tên cột và từ viết tắt của bản Excel hiện hành được **giữ nguyên**: Ký hiệu · HT ĐA · TQ ĐA · Điểm học · Điểm chuyển · Đăng ký được? |
| **Lý do chọn** | Người dùng đã quen với cách trình bày hiện tại; giảm chi phí đào tạo và rủi ro đọc sai trong giai đoạn chuyển đổi; giữ được khả năng đối chiếu với file Excel cũ |
| **Hệ quả** | Ngữ nghĩa chính xác của HT ĐA, TQ ĐA, Điểm học, Điểm chuyển sẽ được làm rõ ở bước thiết kế chi tiết; hiện tại hệ thống lưu và hiển thị đúng như bản gốc, chưa gắn logic nghiệp vụ đặc biệt vào các cờ này |
| **Cần xác nhận** | Xem **Q-03**, **Q-04**, **Q-08** |

### DEC-06 — Học phần tương đương là quan hệ hai chiều, bắc cầu

| | |
|---|---|
| **Quyết định** | Mô hình hóa bằng **nhóm học phần tương đương** — mọi học phần trong cùng một nhóm thay thế được cho nhau |
| **Phương án thay thế đã cân nhắc** | Quan hệ có hướng theo từng cặp (A thay được B nhưng không ngược lại) |
| **Lý do chọn** | Phù hợp mô tả nghiệp vụ "học cái này hay cái kia đều tốt nghiệp được"; mô hình nhóm đơn giản hơn nhiều so với quản lý từng cặp có hướng và tránh được mâu thuẫn logic khi nhiều học phần tham gia |
| **Hệ quả** | Số tín chỉ công nhận là của học phần đã học thực tế (BR-10); có thể phát sinh chênh lệch tín chỉ khi các học phần trong nhóm khác số tín chỉ |
| **Cần xác nhận** | Xem **Q-05** |

### DEC-07 — Hiệu lực theo học kỳ

| | |
|---|---|
| **Quyết định** | Phiên bản mới chỉ có hiệu lực **từ đầu học kỳ** được chỉ định, không áp dụng giữa học kỳ |
| **Lý do chọn** | Bảo vệ sinh viên đang học — công thức điểm và yêu cầu chương trình không thay đổi khi lớp đang diễn ra |
| **Hệ quả** | Đề xuất đã được phê duyệt giữ trạng thái ĐÃ DUYỆT cho đến khi tới học kỳ hiệu lực |

### DEC-08 — Cơ chế thu hồi phiên bản

| | |
|---|---|
| **Quyết định** | Không bao giờ xóa phiên bản đã ban hành nhầm; thay vào đó **ban hành phiên bản đính chính** kèm ghi chú lý do |
| **Lý do chọn** | Giữ được tính bất biến và toàn vẹn lịch sử — yêu cầu bắt buộc với dữ liệu có giá trị pháp lý |

### DEC-09 — Xử lý người duyệt trùng người đề xuất

| | |
|---|---|
| **Quyết định** | **Tự động bỏ qua cấp duyệt** mà người tạo đề xuất chính là người duyệt, ghi nhật ký lý do bỏ qua |
| **Phương án thay thế đã cân nhắc** | Chuyển lên Ban lãnh đạo khoa duyệt thay |
| **Lý do chọn** | Giữ luồng đơn giản; cấp trên (Phòng Đào tạo) vẫn còn quyền kiểm soát cuối nên rủi ro được giới hạn; tránh kéo Ban lãnh đạo khoa vào chuỗi chốt chặn |

### DEC-10 — Ưu tiên nguồn dữ liệu

| | |
|---|---|
| **Quyết định** | Với kết quả học tập và danh sách sinh viên, **cơ sở dữ liệu có sẵn là nguồn chính**; Excel dùng để nạp dữ liệu ban đầu và bổ sung khi cơ sở dữ liệu chưa sẵn sàng |
| **Lý do chọn** | Cơ sở dữ liệu là nguồn chính thức, cập nhật liên tục; Excel chỉ là ảnh chụp tại một thời điểm |
| **Hệ quả** | Hệ thống phải hoạt động được kể cả khi không có kết nối cơ sở dữ liệu, dùng dữ liệu đã nhập từ Excel |

### DEC-11 — Thang điểm

| | |
|---|---|
| **Quyết định** | Lưu song song **thang 10, thang 4 và điểm chữ** cho mọi kết quả học tập. Việc so sánh điều kiện tiên quyết dùng **thang 4** (khớp với giá trị Điểm học trong bản Excel: 3 · 3.5 · 4) |
| **Lý do chọn** | Giá trị Điểm học trong bản Excel nằm trong khoảng 3–4, phù hợp thang 4; lưu cả ba thang tránh mất thông tin và cho phép đổi quy tắc so sánh sau này mà không phải chuyển đổi dữ liệu |
| **Cần xác nhận** | Xem **Q-03** |

### DEC-12 — Không xây dựng quy trình tạo mới Chương trình đào tạo

| | |
|---|---|
| **Quyết định** | Hệ thống chỉ **quản lý và cập nhật** các Chương trình đào tạo đã có; không xây dựng quy trình khởi tạo chương trình mới từ đầu |
| **Lý do chọn** | Theo yêu cầu phía Khoa; quy trình khởi tạo liên quan nhiều cấp ngoài hệ thống (Hội đồng khoa học, Bộ Giáo dục và Đào tạo) |
| **Bù đắp** | FR-25 cung cấp chức năng **nhân bản** một chương trình hiện có làm nền cho chương trình khóa mới — đủ cho nhu cầu thực tế |

---

## 11. DANH MỤC TÌNH HUỐNG BIÊN

### 11.1. Tình huống về tín chỉ và khung chương trình

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-01 | Học phần 0 tín chỉ (ví dụ TH Kỹ thuật lập trình) | Không cộng vào tổng tín chỉ nhưng vẫn bắt buộc hoàn thành để tốt nghiệp (BR-02) |
| EC-02 | Số tín chỉ thập phân (2.5) | Dùng kiểu số thực ở mọi tầng: cơ sở dữ liệu, xử lý, hiển thị; **cấm dùng kiểu số nguyên** |
| EC-03 | Tổng tín chỉ khai báo (130) khác tổng tính được | Cảnh báo trên bảng điều khiển, cho phép ghi đè kèm lý do bắt buộc (BR-05) |
| EC-04 | Tổng tín chỉ danh sách tự chọn lớn hơn số tín chỉ tự chọn yêu cầu | Hợp lệ — sinh viên chọn một phần; chỉ kiểm tra tổng tín chỉ đã chọn ≥ mức tối thiểu (BR-04) |
| EC-05 | Học phần bắt buộc bị đặt vào nhóm tự chọn | Chặn lưu, báo lỗi xung đột phân loại |
| EC-06 | Học phần xuất hiện nhiều lần trong một khung chương trình | Chặn lưu, trừ trường hợp học phần kéo dài nhiều học kỳ (ví dụ Đồ án 1, Đồ án 2 là hai mã khác nhau) |
| EC-07 | Khung chương trình có học kỳ trống | Cho phép, sinh cảnh báo mức thông tin |
| EC-08 | Số học kỳ khai báo (8) nhỏ hơn học kỳ lớn nhất xuất hiện trong khung | Chặn lưu kèm thông báo lỗi rõ ràng |

### 11.2. Tình huống về quan hệ học phần

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-09 | Chu trình tiên quyết: A cần B, B cần A | Chặn ngay khi lưu, hiển thị đường đi của chu trình (BR-11) |
| EC-10 | Học phần tiên quyết được xếp ở học kỳ **sau** học phần phụ thuộc | Cảnh báo mức cao trên bảng điều khiển sức khỏe, **không chặn** (có thể là cố ý) |
| EC-11 | Song hành bắc cầu: A song hành B, mà B lại chưa đủ điều kiện | Trả về "Không được — học phần song hành chưa đủ điều kiện" (mục 7.3 bước 4) |
| EC-12 | Học phần tiên quyết đã ngừng mở lớp | Tự động dùng học phần thay thế đã khai báo (QH5); nếu chưa khai báo, cảnh báo cho người quản trị |
| EC-13 | Học phần tiên quyết trỏ tới học phần không có trong khung của CTĐT | Cảnh báo — sinh viên có thể phải học một học phần ngoài chương trình |

### 11.3. Tình huống về học phần tương đương

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-14 | Học phần tương đương khác số tín chỉ (A 3TC ↔ B 2TC) | Công nhận số tín chỉ của học phần đã học thực tế (BR-10); nếu thiếu so với yêu cầu, tính vào phần tín chỉ còn thiếu và cảnh báo khi xét tốt nghiệp |
| EC-15 | Tương đương bắc cầu qua nhiều bước (A≡B, B≡C) | Mô hình nhóm xử lý tự nhiên: A, B, C cùng một nhóm (DEC-06) |
| EC-16 | Tương đương giữa các phiên bản (học phần khung cũ ↔ khung mới) | Nhóm tương đương khai báo ở cấp danh mục học phần, độc lập với phiên bản CTĐT — áp dụng cho mọi phiên bản |
| EC-17 | Sinh viên học **cả hai** học phần trong một nhóm tương đương | Tín chỉ chỉ được tính **một lần** vào yêu cầu chương trình; học phần còn lại tính là tín chỉ tự do |
| EC-18 | Tương đương vượt CTĐT (học phần thuộc chương trình khác) | Cho phép, vì nhóm tương đương được khai báo ở phạm vi toàn trường |

### 11.4. Tình huống về phê duyệt

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-19 | Giám đốc CTĐT tự tạo đề xuất | Tự động bỏ qua cấp 2, ghi nhật ký lý do (DEC-09, BR-27) |
| EC-20 | Điều phối nhóm chuyên môn tự tạo đề xuất | Tự động bỏ qua cấp 1, ghi nhật ký lý do |
| EC-21 | Giảng viên thuộc nhiều nhóm chuyên môn | Đề xuất chuyển tới người điều phối của nhóm **phụ trách học phần bị tác động**, không phụ thuộc giảng viên thuộc những nhóm nào |
| EC-22 | Đề xuất tác động nhiều học phần thuộc nhiều nhóm | Cần sự đồng ý của tất cả người điều phối nhóm liên quan; hệ thống hiển thị tiến độ phê duyệt theo từng người |
| EC-23 | Học phần thuộc nhiều Chương trình đào tạo | Cần sự đồng ý của tất cả Giám đốc CTĐT liên quan (mục 6.1.3) |
| EC-24 | Học phần thuộc khoa khác (Toán, Vật lý, Lý luận chính trị) | Khoa CNTT chỉ được **đề xuất**; đề xuất chuyển thẳng lên Phòng Đào tạo, bỏ qua cấp 1 và cấp 2 |
| EC-25 | Người duyệt đi công tác / chuyển công tác | Dùng cơ chế ủy quyền có thời hạn (FR-09); Phòng Đào tạo có quyền override (BR-31) |
| EC-26 | Phòng Đào tạo từ chối sau khi hai cấp dưới đã đồng ý | Đề xuất trở về NHÁP của người tạo; khi gửi lại phải đi lại từ cấp 1 (BR-29) |
| EC-27 | Hai đề xuất song song trên cùng một đề cương | Cảnh báo xung đột khi tạo đề xuất thứ hai; áp dụng khóa lạc quan (optimistic locking) khi ghi (BR-30, FR-68) |
| EC-28 | Đề xuất tồn đọng quá lâu ở một cấp | Hệ thống nhắc hạn tự động (FR-66); Phòng Đào tạo có thể can thiệp |
| EC-29 | Người tạo đề xuất rời hệ thống khi đề xuất đang luân chuyển | Đề xuất tiếp tục xử lý; người tạo được ghi nhận là tài khoản đã vô hiệu hóa |

### 11.5. Tình huống về phiên bản

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-30 | Sửa đề cương giữa học kỳ | Có hiệu lực từ học kỳ kế tiếp, không hồi tố (DEC-07, BR-16) |
| EC-31 | Ban hành nhầm phiên bản | Ban hành phiên bản đính chính, không xóa lịch sử (DEC-08, FR-75) |
| EC-32 | Học phần trong phiên bản cũ đã ngừng mở lớp | Dùng học phần thay thế (QH5); sinh viên khóa cũ được công nhận học phần thay thế |
| EC-33 | Sinh viên chuyển ngành | Gắn lại với phiên bản CTĐT của ngành mới; tín chỉ đã tích lũy được đối chiếu qua nhóm học phần tương đương |
| EC-34 | Sinh viên học song ngành | Gắn với hai Chương trình đào tạo; xét tốt nghiệp độc lập theo từng chương trình |
| EC-35 | Chuyển đổi Cử nhân → Kỹ sư | Gắn lại với phiên bản CTĐT Kỹ sư; công nhận toàn bộ tín chỉ đã tích lũy qua nhóm tương đương; phần chênh lệch tính vào tín chỉ còn thiếu |
| EC-36 | Sinh viên học lại / học cải thiện điểm | Lấy **điểm cao nhất** trong các lần học khi kiểm tra điều kiện tiên quyết và xét tốt nghiệp |
| EC-37 | Sinh viên bảo lưu, nhập học lại sau nhiều năm | Giữ nguyên phiên bản CTĐT của khóa gốc; nếu học phần không còn mở, áp dụng EC-32 |
| EC-38 | Sửa một đề cương dùng chung làm nhiều CTĐT sinh phiên bản mới | Chấp nhận (DEC-01); hệ thống hiển thị danh sách CTĐT bị ảnh hưởng trước khi gửi duyệt (FR-17) |

### 11.6. Tình huống về công thức điểm và chuẩn đầu ra

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-39 | Tổng trọng số các thành phần khác 100% | Chặn lưu, hiển thị chính xác phần chênh lệch (BR-12, FR-50) |
| EC-40 | CLO không được thành phần đánh giá nào bao phủ | Cảnh báo bắt buộc xử lý trước khi gửi duyệt (BR-14, FR-54) |
| EC-41 | PLO không được học phần nào đóng góp | Cảnh báo trên bảng điều khiển sức khỏe chương trình (BR-20, FR-42) |
| EC-42 | Thành phần điều kiện dưới ngưỡng nhưng điểm tổng cao | Kết quả học phần là **Không đạt** (BR-15) |
| EC-43 | Điểm của sinh viên bị sửa hồi tố sau khi đã xét tốt nghiệp | Tính lại kết quả xét tốt nghiệp và thông báo cho Phòng Đào tạo |
| EC-44 | Học phần chưa có đề cương chi tiết | Cho phép tồn tại trong khung nhưng có cảnh báo; **chặn việc ban hành phiên bản** khi còn học phần chưa có đề cương |

### 11.7. Tình huống về nhập dữ liệu và tích hợp

| Mã | Tình huống | Cách xử lý |
|---|---|---|
| EC-45 | File Excel chứa mã học phần không tồn tại | Báo lỗi tại đúng dòng, **không ghi bất kỳ dữ liệu nào** (FR-34, FR-35) |
| EC-46 | File Excel có dòng trùng lặp | Báo các dòng trùng, yêu cầu người dùng sửa trước |
| EC-47 | File Excel sai định dạng (thiếu cột, sai kiểu dữ liệu) | Từ chối file ngay ở bước kiểm tra định dạng, nêu rõ cột nào sai |
| EC-48 | Dữ liệu Excel và cơ sở dữ liệu mâu thuẫn | Áp dụng quy tắc ưu tiên (mục 8.2), ghi cảnh báo vào nhật ký đồng bộ |
| EC-49 | Mất kết nối cơ sở dữ liệu giữa lúc đồng bộ | Hoàn tác toàn bộ giao dịch đồng bộ, ghi nhật ký lỗi, thử lại theo lịch |
| EC-50 | Xóa Chương trình đào tạo / học phần đang có sinh viên theo học | Chỉ cho phép chuyển trạng thái sang Ngừng sử dụng; **cấm xóa cứng** |
| EC-51 | Xóa người dùng đã tham gia phê duyệt | Chỉ vô hiệu hóa tài khoản; lịch sử phê duyệt được giữ nguyên (FR-06) |
| EC-52 | Sinh viên truy cập khi chưa có dữ liệu kết quả học tập | Hiển thị đầy đủ khung chương trình; phần tiến độ hiển thị thông báo chưa có dữ liệu |

---

## 12. PHẠM VI LOẠI TRỪ

| TT | Nội dung không thuộc phạm vi | Lý do |
|---|---|---|
| 1 | Quy trình khởi tạo Chương trình đào tạo mới từ đầu | Theo yêu cầu phía Khoa (DEC-12) |
| 2 | Xếp thời khóa biểu | Thuộc hệ thống khác của trường |
| 3 | Đăng ký học phần thực tế của sinh viên | Thuộc hệ thống đăng ký học phần hiện hành. Hệ thống này chỉ **tính điều kiện** đăng ký |
| 4 | Nhập điểm và quản lý điểm | Thuộc hệ thống quản lý điểm hiện hành. Hệ thống này chỉ **đọc** kết quả |
| 5 | Quản lý lớp học phần, phân công giảng dạy | Thuộc hệ thống khác |
| 6 | Quản lý học phí, công nợ sinh viên | Ngoài phạm vi nghiệp vụ |
| 7 | Xây dựng ứng dụng di động độc lập | Hệ thống cung cấp API; việc tích hợp do phía dDUT thực hiện |
| 8 | Quản lý hồ sơ nhân sự giảng viên | Thuộc hệ thống nhân sự |

---

## 13. VẤN ĐỀ CÒN TREO

Mục này liệt kê các vấn đề đã được **quyết định tạm thời** để không cản trở tiến độ (xem mục 10), nhưng cần phía Khoa xác nhận hoặc điều chỉnh trong quá trình thực hiện.

### 13.1. Nhóm ảnh hưởng mô hình dữ liệu (ưu tiên cao nhất)

| Mã | Vấn đề | Quyết định tạm thời | Ảnh hưởng nếu thay đổi |
|---|---|---|---|
| Q-01 | Khi một học phần thuộc nhiều CTĐT, bộ **CLO** có cần khác nhau theo từng CTĐT không, hay chỉ ma trận CLO–PLO khác nhau? | **ĐÃ CHỐT 2026-10-11:** CLO dùng chung; chỉ ma trận CLO–PLO tách theo CTĐT (DEC-03) | Nếu CLO phải khác nhau, DEC-02 (một đề cương cho một học phần) không còn đúng — phải tách đề cương theo cặp (CTĐT, Học phần). Đây là thay đổi lớn về lược đồ dữ liệu |
| Q-02 | Khi sửa một đề cương dùng chung, có chấp nhận việc **mọi CTĐT chứa học phần đó** đều sinh phiên bản mới không? | **ĐÃ CHỐT 2026-10-11:** Chấp nhận (DEC-01 kết hợp DEC-02) | Nếu không chấp nhận, phải chuyển sang mô hình phiên bản độc lập cho từng thành phần — thay đổi lớn về cách quản lý phiên bản |

> **[Ghi chú port]** Cột "Ảnh hưởng nếu thay đổi" của Q-01 và Q-02 bị cắt phải trong bản PDF gốc; **đã khôi phục ngày 2026-10-11** từ bản nguồn Markdown gốc (v1.0, 27/08/2026). Cả hai câu được chốt cùng ngày (quyết định của nhóm thực hiện) và được giữ lại trong bảng để truy vết; cột "Ảnh hưởng nếu thay đổi" cho biết cái giá phải trả nếu sau này Khoa yêu cầu khác.

### 13.2. Nhóm ảnh hưởng quy tắc nghiệp vụ (ưu tiên cao)

| Mã | Vấn đề | Quyết định tạm thời | Ảnh hưởng nếu thay đổi |
|---|---|---|---|
| Q-03 | Thang điểm áp dụng cho Điểm học và Điểm chuyển là thang 4, thang 10 hay điểm chữ? | Thang 4, đồng thời lưu cả ba thang (DEC-11) | Chỉ cần đổi tham số so sánh trong Bộ quy tắc, không ảnh hưởng lược đồ |
| Q-05 | Học phần tương đương có phải quan hệ hai chiều và bắc cầu không? | Hai chiều, bắc cầu, mô hình hóa bằng nhóm (DEC-06) | Nếu là quan hệ một chiều theo cặp, phải thay `NhomHocPhanTuongDuong` bằng bảng quan hệ có hướng |
| Q-06 | Học phần thuộc **khoa khác** — Khoa CNTT có quyền sửa đề cương không? | Chỉ được đề xuất, chuyển thẳng lên Phòng Đào tạo (EC-24) | Nếu phải mô hình hóa đầy đủ các khoa khác kèm luồng duyệt riêng, phạm vi công việc tăng đáng kể |
| Q-07 | Đề xuất bị **trả lại** có phải đi lại từ cấp 1 không, hay tiếp tục từ cấp bị trả? | Đi lại từ cấp 1 (BR-29) | Chỉ thay đổi logic chuyển trạng thái |

### 13.3. Nhóm ảnh hưởng phạm vi công việc (ưu tiên trung bình)

| Mã | Vấn đề | Quyết định tạm thời | Ảnh hưởng nếu thay đổi |
|---|---|---|---|
| Q-04 | Ngữ nghĩa chính xác của **HT ĐA** và **TQ ĐA** trong bản Excel | Lưu và hiển thị nguyên trạng dưới dạng cờ, chưa gắn logic nghiệp vụ (DEC-05) | Nếu là điều kiện đăng ký đồ án thực sự, cần bổ sung quy tắc vào Bộ quy tắc — công việc vừa phải |
| Q-08 | Danh mục giá trị hợp lệ của cột **Ký hiệu** (mã khối kiến thức) | Lưu tự do dưới dạng chuỗi, giữ nguyên giá trị gốc (DEC-05) | Nếu cần chuẩn hóa thành danh mục có kiểm soát, phải bổ sung bảng danh mục và quy tắc kiểm tra |
| Q-09 | **Cơ sở dữ liệu có sẵn** là cơ sở dữ liệu nào — của hệ thống trường (chỉ đọc, cần cấp quyền), hay cơ sở dữ liệu do nhóm tự tạo và nạp từ Excel? | Thiết kế hỗ trợ cả hai; ưu tiên cơ sở dữ liệu ngoài khi có sẵn (DEC-10) | Nếu là cơ sở dữ liệu trường thật, cần thủ tục xin cấp quyền truy cập và phân tích lược đồ nguồn |
| Q-10 | **Điều kiện tốt nghiệp ngoài tín chỉ** (chuẩn ngoại ngữ, Giáo dục thể chất, Giáo dục quốc phòng, chứng chỉ tin học) có nằm trong phạm vi xét tốt nghiệp không? | Có — mô hình hóa dưới dạng học phần điều kiện, đưa vào thuật toán xét tốt nghiệp (mục 7.4) | Nếu có thêm điều kiện dạng chứng chỉ ngoài học phần, cần bổ sung thực thể quản lý chứng chỉ |
| Q-11 | Có **bao nhiêu Chương trình đào tạo** thực tế cần quản lý, và có file Excel mẫu của cả chương trình Kỹ sư lẫn Cử nhân để đối chiếu cấu trúc không? | Giả định dưới 20 chương trình, cấu trúc giống bản mẫu đã nhận | Nếu chương trình Kỹ sư có cấu trúc khác biệt lớn, cần điều chỉnh mô hình khung chương trình |
| Q-12 | **Song ngữ Việt – Anh** có bắt buộc trong phạm vi đồ án không? | Xếp mức NÊN CÓ (FR-48), thiết kế lược đồ có sẵn trường tiếng Anh | Không ảnh hưởng lược đồ vì đã dự phòng sẵn |

### 13.4. Nhóm chốt sau, không cản trở tiến độ

| Mã | Vấn đề | Quyết định tạm thời |
|---|---|---|
| Q-13 | **Phương thức xác thực**: SSO của trường hay tài khoản nội bộ | Tài khoản nội bộ, thiết kế tầng xác thực tách biệt để có thể thay bằng SSO sau |
| Q-14 | Có cần **xuất PDF theo mẫu quyết định** của trường không (cần file mẫu) | Xếp mức NÊN CÓ (FR-37), dùng mẫu tổng quát nếu chưa có file mẫu chính thức |
| Q-15 | **Số người dùng đồng thời** dự kiến | Giả định 200 người (NFR-04) |
| Q-16 | **Công nghệ triển khai** (ngôn ngữ, framework, hệ quản trị cơ sở dữ liệu) | **ĐÃ CHỐT 2026-10-15:** TypeScript trên Node.js 22; một ứng dụng NestJS với Prisma, PostgreSQL, hàng đợi BullMQ trên Redis; giao diện React + Vite + Ant Design. Vẫn là monolith (RB-01). Chi tiết ở `docs/design/tech-stack.md` |
| Q-17 | Có cần chức năng **nhắc hạn duyệt** không | Xếp mức TÙY CHỌN (FR-66) |

### 13.5. Nhóm phát sinh từ khảo sát lần 2 và từ đối chiếu `plo-clo-backend`

> **[Bổ sung 2026-10-11]** Nhóm này không có trong `Requirements.pdf`. Q-18..Q-24 và Q-27 đến từ khảo sát lần 2 (mục 6.4; danh sách câu hỏi chi tiết ở `docs/notes/interview2-confirm-questions.md`). Q-25, Q-26, Q-28 đến từ việc đối chiếu mô hình PLO/CLO với kho `plo-clo-backend` (DEC-03).

| Mã | Vấn đề | Quyết định tạm thời | Ảnh hưởng nếu thay đổi |
|---|---|---|---|
| Q-18 | **Tờ trình và biên bản** là thủ tục giấy ngoài hệ thống, hay hệ thống phải số hóa và thay thế chúng? | Thủ tục vẫn làm ngoài hệ thống; hệ thống chỉ lưu bản quét đính kèm đề xuất (FR-109) | Nếu phải số hóa toàn bộ, cần biểu mẫu tờ trình/biên bản trong hệ thống — phạm vi công việc tăng đáng kể |
| Q-19 | Khi **Trường ra công văn** yêu cầu thay đổi CTĐT, ai là người tạo đề xuất trong hệ thống? | Giám đốc CTĐT của chương trình bị tác động tạo đề xuất, ghi nguồn "Trường" và số công văn (FR-108) | Nếu Phòng Đào tạo tự tạo và ban hành, cần quy định rõ các cấp được bỏ qua (FR-61 hiện chỉ bỏ qua cấp mà người tạo là người duyệt) |
| Q-20 | Đợt **rà soát 5 năm**: hội đồng thẩm định gồm những ai, và có đi luồng duyệt khác với điều chỉnh thông thường không? | Đi chung luồng ba cấp; biên bản họp hội đồng và biên bản thẩm định là hồ sơ đính kèm (FR-109); thành viên hội đồng không phải người dùng hệ thống | Nếu hội đồng phải cho ý kiến trong hệ thống, cần thêm vai trò và bước duyệt qua bảng cấu hình (NFR-24) |
| Q-21 | Thay đổi nhỏ (ví dụ cập nhật tài liệu tham khảo của đề cương) có được **giảm cấp duyệt** không? Ghi chú phỏng vấn thầy Bình có mô tả luồng hai cấp | Không — mọi đề xuất đi đủ ba cấp (DEC-04) | Nếu được giảm, khai báo số cấp theo loại đề xuất trong bảng cấu hình (NFR-24); không đổi lược đồ |
| Q-22 | Có **hạn nộp** đề xuất trong năm không? "Sau 1 năm" Khoa mới được cập nhật đề cương tính từ mốc nào? | Không ràng buộc hạn nộp hay khoảng cách giữa hai lần cập nhật; học kỳ hiệu lực do Phòng Đào tạo nhập khi duyệt (mục 6.1.4) | Nếu có, bổ sung quy tắc kiểm tra khi gửi duyệt — không ảnh hưởng lược đồ |
| Q-23 | Trường có **văn bản quy định chính thức** về quy trình điều chỉnh CTĐT không? | Chưa có tài liệu; mục 6.1 và 6.4 dựa trên ghi chú phỏng vấn | Khi nhận được văn bản, phải đối chiếu lại mục 6.1, 6.4 và các câu Q-18..Q-22 |
| Q-24 | "Khoa quản lý khung chương trình của mình" — người chịu trách nhiệm chính là **Ban lãnh đạo khoa** hay **Giám đốc CTĐT**? | Giám đốc CTĐT duyệt cấp 2; Ban lãnh đạo khoa chỉ xem và bình luận (FR-62, DEC-04) | Nếu Ban lãnh đạo khoa phải duyệt, thêm một cấp qua bảng cấu hình (NFR-24) |
| Q-25 | Có phải chỉ **học phần cốt lõi** mới đóng góp vào PLO? `plo-clo-backend` chỉ cho gán PLO vào học phần được đánh dấu cốt lõi của chương trình; chưa rõ "cốt lõi" có trùng với "bắt buộc" (không tự chọn) hay không | Mọi học phần trong khung đều khai báo được ma trận CLO–PLO (FR-40) | Nếu chỉ học phần cốt lõi, cần cờ cốt lõi trên `DongKhungCTDT` và ràng buộc khi khai báo ma trận; BR-20 và FR-42 phải tính lại theo tập học phần đó |
| Q-26 | Ma trận **Học phần–PLO** được suy diễn từ CLO–PLO (FR-41), hay nhập trực tiếp như `plo-clo-backend`? Ở đó Học phần–PLO được nhập trước kèm trọng số số thực và giới hạn CLO chỉ được ánh xạ tới PLO mà học phần đã gắn; liên kết CLO–PLO không mang mức độ đóng góp | **ĐÃ CHỐT 2026-10-18** (F11-02 B, F11-03): nhập trực tiếp Học phần–PLO kèm trọng số; CLO chỉ gắn được PLO mà học phần đã gắn; CLO–PLO không mang mức. FR-40, FR-41, BR-21 đã sửa theo | Nếu phải khớp `plo-clo-backend`, Học phần–PLO trở thành dữ liệu nhập và là ràng buộc của CLO–PLO; cần thêm trường trọng số và bỏ hoặc đổi nghĩa mức độ trên `MaTranCLO_PLO` |
| Q-27 | Phạm vi của **giảng viên** xác định theo nhóm chuyên môn (mục 3.3) hay theo "học phần do mình soạn đề cương" như ghi chú khảo sát lần 2? | Giữ theo nhóm chuyên môn (mục 3.3) | Nếu theo người soạn, cần thuộc tính người soạn trên `DeCuongChiTiet` và sửa quy tắc phạm vi của R5 |
| Q-28 | `plo-clo-backend` cũng lưu PLO, CLO và liên kết CLO–PLO. Hệ thống nào là **nguồn chuẩn**, và hai bên có cần đồng bộ không? | Hai hệ thống độc lập, chưa đồng bộ; mô hình ở đây giữ tương thích (CLO theo học phần, PLO theo chương trình) để có thể đồng bộ sau | Nếu phải đồng bộ, bổ sung yêu cầu tích hợp vào M10 và chốt Q-25, Q-26 trước |

---

— Hết tài liệu —
