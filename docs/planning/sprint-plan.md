# KẾ HOẠCH SPRINT v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-12 |
| Đi kèm | `docs/planning/task-breakdown.md` (CV-001..CV-277, cỡ S / M / L), `docs/planning/user-stories.md`, `docs/planning/epics.md` (bậc B1..B6), `docs/planning/test-plan.md` (tiêu chí vào và ra của từng bậc) |
| Nguồn | Cỡ việc và quan hệ phụ thuộc trong bảng phân rã công việc. Không tài liệu nào của dự án nêu số người, độ dài sprint hay ngày tháng: `docs/notes` không có, `docs/requirement/plan.md` không có |
| Phạm vi | Xếp 277 việc vào các sprint theo thứ tự bậc, dưới các giả định có tên ở mục 2. Không nêu ngày lịch, không phân việc cho từng người |
| Điểm còn hở của tài liệu này | P-1..P-10, mục 9 |

> **Đọc trước:** mọi con số tuần và số sprint trong tài liệu này là kết quả tính từ bốn giả định GĐ-1..GĐ-4. Chưa giả định nào được người dùng xác nhận. Đổi giả định thì tính lại theo mục 7.

## 0. Lịch thực tế trên Taiga — chốt 2026-10-31

Người dùng chốt ngày 2026-10-31. Mục này **thay thế** số sprint, ngày và người làm ở mục 3–4. Mục 3–4 chỉ còn giá trị lịch sử: đó là cách xếp việc ban đầu, tính theo giả định.

- **Đội thật:** 3 người: Hieu Nguyen (`ens-hieu-nguyen`), Manh Kien (`4ut15t1ck`), Tien (`vantien8105`).
- **Lịch:** 13 sprint × 2 tuần, từ 15/06/2026 đến 15/12/2026. Sprint cuối kéo tới hết 15/12.
- **Giao việc:** theo mảng chuyên môn và cân tải. Mỗi user story có một chủ, người đó nhận cả 4 task (phân tích, thiết kế, lập trình, kiểm thử).
- **Trạng thái:** theo thực tế ngày 31/10.
  - SP-01..SP-09 đã đóng.
  - Story F-01..F-25: "Ready for test", vì còn ca kiểm thử thủ công.
  - Task AR/SD/DEV: "Closed". Task ST: "In progress".

| Sprint | Ngày | Nội dung | Hieu | Kien | Tien |
|---|---|---|---|---|---|
| SP-01 | 15/06–28/06 | Nền tảng, tài khoản và quyền | 0 | 20 | 16 |
| SP-02 | 29/06–12/07 | Tổ chức, học phần và quan hệ học phần | 20 | 18 | 15 |
| SP-03 | 13/07–26/07 | Chương trình đào tạo và khung chương trình | 24 | 25 | 0 |
| SP-04 | 27/07–09/08 | Kiểm tra nhất quán, nhập xuất Excel | 13 | 0 | 28 |
| SP-05 | 10/08–23/08 | Đề cương, chuẩn đầu ra, công thức điểm | 33 | 33 | 0 |
| SP-06 | 24/08–06/09 | Đề xuất thay đổi và phê duyệt ba cấp | 47 | 0 | 43 |
| SP-07 | 07/09–20/09 | Ban hành, so sánh phiên bản, gán khóa | 0 | 15 | 37 |
| SP-08 | 21/09–04/10 | Sinh viên, điều kiện đăng ký, xét tốt nghiệp | 26 | 10 | 20 |
| SP-09 | 05/10–18/10 | Cổng sinh viên, API dDUT, đồng bộ DB Trường | 0 | 41 | 15 |
| SP-10 | 19/10–01/11 | Báo cáo, xuất bản, tiện ích duyệt, giao diện và dữ liệu thật (**đang chạy**) | 17 | 18 | 14 |
| SP-11 | 02/11–15/11 | Rà nghiệp vụ module chính, sao lưu (F-26), triển khai (F-27) | | | |
| SP-12 | 16/11–29/11 | Kiểm thử theo vai trò và nghiệm thu từng bậc | | | |
| SP-13 | 30/11–15/12 | Ca thủ công, nghiệm thu Khoa (C1..C10), bàn giao | | | |
| **Tổng** | | | **180** | **180** | **188** |

Điểm ở bảng trên là điểm story. SP-11..SP-13 chỉ có task không gắn story (DEV-xx, REV-xx, E2E-xx, MAN-01, ACC-01, HND-01), nên không có điểm.

Người làm theo epic:
- **Hieu:** EP-04, EP-06, EP-08, EP-11, EP-13, EP-19, EP-24.
- **Kien:** EP-02, EP-03, EP-07, EP-10, EP-12, EP-16, EP-18, EP-20, EP-22, EP-23.
- **Tien:** EP-01, EP-05, EP-09, EP-14, EP-15, EP-17, EP-21, EP-25.

Đồng bộ lại bằng `source/backend/scripts/taiga/reschedule-backlog.ts`:
- `--dry-run` để xem khác biệt;
- `--apply` để ghi lên Taiga.

Script idempotent: chạy lại sau khi ghi xong phải báo 0 thay đổi.

---

## 1. Quy ước

| Mục | Quy ước |
|---|---|
| SP-01..SP-17 | Sprint, đánh số liên tục qua các bậc |
| Điểm | Cỡ việc đổi ra điểm: S = 1, M = 2, L = 4 (K-3 của bảng phân rã công việc). Tổng 526 điểm cho 277 việc |
| Tuần n | Tuần thứ n kể từ ngày bắt đầu SP-01. Không gắn với ngày lịch (P-4) |
| Sức chứa | Số điểm tối đa một sprint nhận, tính từ GĐ-1..GĐ-4 |
| Dự phòng | Sức chứa trừ đi số điểm đã xếp. Được san đều giữa các sprint của cùng một bậc (mục 7.1, bước 5). Dùng cho sửa lỗi, chạy lại kịch bản các bậc trước, và việc phát sinh khi một câu hỏi được trả lời khác với lựa chọn tạm |
| Story xong | Mọi việc của story đã nằm trong sprint này hoặc sprint trước. Việc cắt ngang (K-2) không tính vào story mà nó được gắn |
| Việc chốt bậc | Việc kiểm thử chạy toàn bộ kịch bản nghiệm thu của bậc; luôn là việc cuối cùng của bậc |

---

## 2. Giả định có tên

| Mã | Giả định | Giá trị dùng | Vì sao chọn giá trị này | Đổi thì ảnh hưởng gì |
|---|---|---|---|---|
| GĐ-1 | Số người trong nhóm | 4 người | Không có nguồn; cỡ nhóm đồ án thường gặp (P-1) | Sức chứa tỷ lệ thuận |
| GĐ-2 | Độ dài một sprint | 2 tuần | Không có nguồn; đủ dài để xong một story cỡ lớn, đủ ngắn để có nhiều lần xem lại (P-2) | Sức chứa tỷ lệ thuận; số lần trình diễn thay đổi |
| GĐ-3 | Số ngày công mỗi người dành cho dự án mỗi tuần | 2,5 ngày | Không có nguồn; sinh viên làm đồ án song song với các học phần khác (P-3) | Sức chứa tỷ lệ thuận |
| GĐ-4 | Số điểm một ngày công làm được | 2 điểm, tức việc cỡ S mất nửa ngày, M một ngày, L hai ngày | Không có nguồn; cỡ việc chưa được hiệu chỉnh (K-3, P-3) | Sức chứa tỷ lệ thuận. Thay bằng số đo thật sau SP-01 |
| GĐ-5 | Sức chứa một sprint | GĐ-1 × GĐ-2 × GĐ-3 × GĐ-4 = **40 điểm** | Tính ra, không chọn | Xem bảng ở mục 7.2 |
| GĐ-6 | Một bậc không dùng chung sprint với bậc kế | Sprint cuối của bậc kết thúc bằng việc chốt bậc; bậc kế bắt đầu ở sprint mới | Khớp tiêu chí vào của kế hoạch kiểm thử: bậc trước phải đạt tiêu chí ra rồi mới vào bậc sau | Bỏ giả định này thì bớt được 3 sprint (P-5) |
| GĐ-7 | Ai cũng làm được mọi loại việc | Không chia người theo loại việc | Chưa biết thành phần nhóm (P-6) | Nếu chỉ một người làm được một loại việc, sprint dồn nhiều điểm loại đó sẽ trễ; xem mục 5 |
| GĐ-8 | Không có tuần nghỉ | Mọi tuần đều là tuần làm việc | Chưa có lịch (P-7) | Mỗi tuần nghỉ đẩy lùi mọi mốc sau nó một tuần |
| GĐ-9 | Lựa chọn tạm của các tài liệu trước được giữ nguyên | S-1..S-14, L-1..L-10, U-1..U-9, K-1..K-8, G-1..G-8, T-1..T-12 | Chỉ dẫn của người dùng: câu hỏi để trả lời sau | Câu trả lời khác đi thì phát sinh việc làm lại, lấy từ dự phòng (P-8) |

---

## 3. Tóm tắt

| Bậc | Phiên bản | Nội dung | Việc | Điểm | Sprint | Số sprint | Tuần | Dự phòng | Phiên bản ra cuối |
|---|---|---|---|---|---|---|---|---|---|
| B1 | 0.1 | Nền tảng và danh mục học phần | 53 | 86 | SP-01..SP-03 | 3 | Tuần 1–6 | 34 điểm (28%) | Tuần 6 |
| B2 | 0.2 | Chương trình đào tạo và khung | 45 | 85 | SP-04..SP-06 | 3 | Tuần 7–12 | 35 điểm (29%) | Tuần 12 |
| B3 | 0.3 | Đề cương và chuẩn đầu ra | 37 | 64 | SP-07..SP-08 | 2 | Tuần 13–16 | 16 điểm (20%) | Tuần 16 |
| B4 | 0.4 | Đề xuất thay đổi và phiên bản | 65 | 132 | SP-09..SP-12 | 4 | Tuần 17–24 | 28 điểm (18%) | Tuần 24 |
| B5 | 0.5 | Sinh viên, điều kiện đăng ký và xét tốt nghiệp | 45 | 91 | SP-13..SP-15 | 3 | Tuần 25–30 | 29 điểm (24%) | Tuần 30 |
| B6 | 1.0 | Tích hợp trường, báo cáo và hoàn thiện | 32 | 68 | SP-16..SP-17 | 2 | Tuần 31–34 | 12 điểm (15%) | Tuần 34 |
| **Tổng** |  |  | **277** | **526** |  | **17** | **Tuần 1–34** | **154 điểm (23%)** |  |

| Câu hỏi | Trả lời theo các giả định ở mục 2 |
|---|---|
| Bao lâu thì có phiên bản đầu tiên chạy được | Cuối tuần 6, phiên bản 0.1 |
| Bao lâu thì xong cả sáu bậc | 17 sprint, 34 tuần; sau đó 4 tuần vận hành thử để đo NFR-15 (P-9) |
| Khối lượng thuần, không tính dự phòng | 526 điểm, tức 263 ngày công theo GĐ-4, tức 26,3 tuần với 4 người theo GĐ-3 |
| Nếu đồ án chỉ có một học kỳ 15 tuần | Với sprint 2 tuần chỉ có 7 sprint; cần sức chứa từ 91 điểm mỗi sprint, gấp 2,3 lần giả định. Xem P-4 và mục 7.3 |

---

## 4. Kế hoạch theo sprint

### 4.0. Bảng tổng

| Sprint | Bậc | Tuần | Việc | Điểm | Dự phòng | Epic | Story xong trong sprint | Kịch bản nghiệm thu chạy được từ cuối sprint | Mốc |
|---|---|---|---|---|---|---|---|---|---|
| SP-01 | B1 | Tuần 1–2 | 16 | 29 | 11 | EP-01 xong, EP-02, EP-03 | 4: US-001, US-002, US-003, US-004 | NT-B1-06 |  |
| SP-02 | B1 | Tuần 3–4 | 20 | 29 | 11 | EP-02 xong, EP-03 xong, EP-04, EP-05 | 7: US-005, US-006, US-007, US-008, US-009, US-010, US-011 | NT-B1-01, NT-B1-02, NT-B1-07 |  |
| SP-03 | B1 | Tuần 5–6 | 17 | 28 | 12 | EP-04 xong, EP-05 xong | 6: US-012, US-013, US-014, US-015, US-016, US-017 | NT-B1-03, NT-B1-04, NT-B1-05 | **Phiên bản 0.1** — chốt bậc B1 bằng CV-053 |
| SP-04 | B2 | Tuần 7–8 | 15 | 29 | 11 | EP-06, EP-07 | 6: US-018, US-019, US-020, US-021, US-023, US-024 | — |  |
| SP-05 | B2 | Tuần 9–10 | 18 | 29 | 11 | EP-06 xong, EP-07 xong, EP-08 xong, EP-09 | 8: US-022, US-025, US-026, US-027, US-028, US-029, US-030, US-031 | NT-B2-04, NT-B2-05, NT-B2-06, NT-B2-07, NT-B2-08 |  |
| SP-06 | B2 | Tuần 11–12 | 12 | 27 | 13 | EP-09 xong | 6: US-032, US-033, US-034, US-035, US-036, US-037 | NT-B2-01, NT-B2-02, NT-B2-03, NT-B2-09 | **Phiên bản 0.2** — chốt bậc B2 bằng CV-098 |
| SP-07 | B3 | Tuần 13–14 | 18 | 32 | 8 | EP-10 xong, EP-11 | 7: US-038, US-039, US-040, US-041, US-042, US-043, US-044 | NT-B3-01, NT-B3-02, NT-B3-03 |  |
| SP-08 | B3 | Tuần 15–16 | 19 | 32 | 8 | EP-11 xong, EP-12 xong | 8: US-045, US-046, US-047, US-048, US-049, US-050, US-051, US-052 | NT-B3-04, NT-B3-05, NT-B3-06, NT-B3-07, NT-B3-08 | **Phiên bản 0.3** — chốt bậc B3 bằng CV-135 |
| SP-09 | B4 | Tuần 17–18 | 15 | 33 | 7 | EP-13 | 5: US-053, US-054, US-055, US-056, US-057 | NT-B4-02 |  |
| SP-10 | B4 | Tuần 19–20 | 18 | 33 | 7 | EP-13 xong, EP-14 | 9: US-058, US-059, US-060, US-061, US-062, US-063, US-064, US-065, US-066 | NT-B4-03, NT-B4-08, NT-B4-09 |  |
| SP-11 | B4 | Tuần 21–22 | 17 | 33 | 7 | EP-14 xong, EP-15 | 7: US-067, US-068, US-069, US-070, US-071, US-072, US-073 | NT-B4-01, NT-B4-04, NT-B4-05, NT-B4-07 |  |
| SP-12 | B4 | Tuần 23–24 | 15 | 33 | 7 | EP-15 xong, EP-16 xong | 7: US-074, US-075, US-076, US-077, US-078, US-079, US-080 | NT-B4-06, NT-B4-10, NT-B4-11, NT-B4-12 | **Phiên bản 0.4** — chốt bậc B4 bằng CV-200 |
| SP-13 | B5 | Tuần 25–26 | 16 | 31 | 9 | EP-17 xong, EP-18 xong, EP-19, EP-21 | 6: US-081, US-082, US-083, US-084, US-085, US-086 | NT-B5-01 |  |
| SP-14 | B5 | Tuần 27–28 | 15 | 30 | 10 | EP-19 xong, EP-20 | 7: US-087, US-088, US-089, US-090, US-091, US-092, US-093 | NT-B5-06, NT-B5-07, NT-B5-08 |  |
| SP-15 | B5 | Tuần 29–30 | 14 | 30 | 10 | EP-20 xong, EP-21 xong | 8: US-094, US-095, US-096, US-097, US-098, US-099, US-100, US-101 | NT-B5-02, NT-B5-03, NT-B5-04, NT-B5-05, NT-B5-09 | **Phiên bản 0.5** — chốt bậc B5 bằng CV-245 |
| SP-16 | B6 | Tuần 31–32 | 17 | 34 | 6 | EP-22 xong, EP-23 | 7: US-102, US-103, US-104, US-105, US-106, US-107, US-109 | NT-B6-01, NT-B6-02, NT-B6-03, NT-B6-04, NT-B6-06 |  |
| SP-17 | B6 | Tuần 33–34 | 15 | 34 | 6 | EP-23 xong, EP-24 xong, EP-25 xong | 8: US-108, US-110, US-111, US-112, US-113, US-114, US-115, US-116 | NT-B6-05, NT-B6-07, NT-B6-08, NT-B6-09 | **Phiên bản 1.0** — chốt bậc B6 bằng CV-277 |

Cột "Kịch bản nghiệm thu chạy được" cho biết từ lúc nào một kịch bản đã đủ story để trình diễn. Lượt nghiệm thu chính thức vẫn là việc chốt bậc, chạy mọi kịch bản của bậc trong một lượt.

### 4.1. SP-01 — bậc B1, tuần 1–2

16 việc, 29 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 6 · Nghiệp vụ 11 · Giao diện 6 · Kiểm thử 2 · Tài liệu 4. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 10 điểm, kết thúc ở CV-010.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-001 | Đăng nhập và kết thúc phiên | EP-01 | CV-001 (S), CV-002 (M), CV-003 (M), CV-005 (S) | 6 | SP-01 |
| US-002 | Ghi nhật ký bất biến cho mọi thay đổi | EP-01 | CV-006 (S), CV-007 (M), CV-008 (S) | 4 | SP-01 |
| US-003 | Tra cứu nhật ký hệ thống | EP-01 | CV-009 (S), CV-010 (M) | 3 | SP-01 |
| US-007 | Quản lý cây đơn vị | EP-03 | CV-021 (S) | 1 | SP-02 |
| US-004 | Quản lý tài khoản người dùng | EP-02 | CV-011 (S), CV-012 (M), CV-013 (M) | 5 | SP-01 |
| US-005 | Gán vai trò và phạm vi quyền (đợt 1) | EP-02 | CV-014 (M), CV-015 (L) | 6 | SP-02 |
| — | Việc cắt ngang, phục vụ cả bậc | EP-01 | CV-004 (L) | 4 | — |

### 4.2. SP-02 — bậc B1, tuần 3–4

20 việc, 29 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 5 · Nghiệp vụ 7 · Giao diện 13 · Kiểm thử 4. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 7 điểm, kết thúc ở CV-030.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-005 | Gán vai trò và phạm vi quyền (đợt 1) | EP-02 | CV-016 (M), CV-017 (M), CV-018 (S) | 5 | SP-02 |
| US-006 | Nhật ký thay đổi phân quyền | EP-02 | CV-019 (S), CV-020 (S) | 2 | SP-02 |
| US-007 | Quản lý cây đơn vị | EP-03 | CV-022 (S), CV-023 (M) | 3 | SP-02 |
| US-008 | Quản lý nhóm chuyên môn | EP-03 | CV-024 (S), CV-025 (M) | 3 | SP-02 |
| US-009 | Gán giảng viên vào nhiều nhóm chuyên môn | EP-03 | CV-026 (S), CV-027 (M), CV-028 (M) | 5 | SP-02 |
| US-010 | Chỉ định Điều phối nhóm chuyên môn | EP-03 | CV-029 (M), CV-030 (S), CV-031 (S) | 4 | SP-02 |
| US-011 | Tra cứu danh mục học phần | EP-04 | CV-032 (M), CV-033 (S), CV-034 (M), CV-035 (S) | 6 | SP-02 |
| US-015 | Khai báo quan hệ giữa các học phần | EP-05 | CV-044 (S) | 1 | SP-03 |

### 4.3. SP-03 — bậc B1, tuần 5–6

17 việc, 28 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 1 · Nghiệp vụ 11 · Giao diện 9 · Kiểm thử 7. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 9 điểm, kết thúc ở CV-053.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-012 | Thêm và sửa học phần | EP-04 | CV-036 (M), CV-037 (M), CV-038 (S) | 5 | SP-03 |
| US-013 | Ghi nhận học phần của khoa khác | EP-04 | CV-039 (S), CV-040 (S) | 2 | SP-03 |
| US-014 | Đổi trạng thái sử dụng học phần | EP-04 | CV-041 (M), CV-042 (S), CV-043 (S) | 4 | SP-03 |
| US-015 | Khai báo quan hệ giữa các học phần | EP-05 | CV-045 (M), CV-046 (M) | 4 | SP-03 |
| US-016 | Chặn chu trình học trước và tiên quyết | EP-05 | CV-047 (M), CV-048 (S), CV-049 (S) | 4 | SP-03 |
| US-017 | Khai báo nhóm học phần tương đương | EP-05 | CV-050 (S), CV-051 (M), CV-052 (M) | 5 | SP-03 |
| — | Việc chốt bậc B1 | EP-05 | CV-053 (L) | 4 | — |

### 4.4. SP-04 — bậc B2, tuần 7–8

15 việc, 29 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 5 · Nghiệp vụ 12 · Giao diện 11 · Kiểm thử 1. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 15 điểm, kết thúc ở CV-068.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-019 | Soạn thông tin chương trình đào tạo | EP-06 | CV-056 (M), CV-057 (M), CV-058 (M) | 6 | SP-04 |
| US-018 | Tra cứu danh sách chương trình đào tạo | EP-06 | CV-054 (S), CV-055 (M) | 3 | SP-04 |
| US-020 | Phân công Giám đốc CTĐT | EP-06 | CV-059 (S), CV-060 (M), CV-061 (S) | 4 | SP-04 |
| US-021 | Phạm vi quyền theo chương trình được phân công (đợt 2) | EP-06 | CV-062 (M), CV-063 (S) | 3 | SP-04 |
| US-023 | Soạn dòng khung chương trình | EP-07 | CV-066 (M), CV-067 (L), CV-068 (L) | 10 | SP-04 |
| US-024 | Xem khung theo học kỳ | EP-07 | CV-069 (S), CV-070 (M) | 3 | SP-04 |

### 4.5. SP-05 — bậc B2, tuần 9–10

18 việc, 29 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 1 · Nghiệp vụ 13 · Giao diện 11 · Kiểm thử 3 · Tài liệu 1. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 7 điểm, kết thúc ở CV-084.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-025 | Lọc và tìm trong khung | EP-07 | CV-071 (M) | 2 | SP-05 |
| US-026 | Khai báo nhóm học phần tự chọn | EP-07 | CV-072 (S), CV-073 (M), CV-074 (M) | 5 | SP-05 |
| US-022 | Nhân bản chương trình cho khóa mới (đợt 1) | EP-06 | CV-064 (L), CV-065 (S) | 5 | SP-05 |
| US-027 | Sắp xếp dòng và chuyển học phần giữa các học kỳ | EP-07 | CV-075 (S), CV-076 (M) | 3 | SP-05 |
| US-028 | Xem các chương trình đang dùng một học phần | EP-07 | CV-077 (S), CV-078 (S) | 2 | SP-05 |
| US-029 | Tính tổng tín chỉ theo cấu trúc | EP-08 | CV-079 (M), CV-080 (S) | 3 | SP-05 |
| US-030 | Cảnh báo lệch tổng tín chỉ và chấp nhận có lý do | EP-08 | CV-081 (S), CV-082 (S) | 2 | SP-05 |
| US-031 | Kiểm tra tiên quyết xếp sau, chu trình và trùng lặp | EP-08 | CV-083 (M), CV-084 (M), CV-085 (M) | 6 | SP-05 |
| US-032 | Tải tệp mẫu nhập liệu (đợt 1) | EP-09 | CV-086 (S) | 1 | SP-06 |

### 4.6. SP-06 — bậc B2, tuần 11–12

12 việc, 27 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 1 · Nghiệp vụ 10 · Giao diện 4 · Tích hợp 5 · Kiểm thử 7. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 16 điểm, kết thúc ở CV-098.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-032 | Tải tệp mẫu nhập liệu (đợt 1) | EP-09 | CV-087 (S) | 1 | SP-06 |
| US-033 | Nhập danh mục học phần từ Excel (đợt 1) | EP-09 | CV-088 (S), CV-089 (M), CV-090 (M) | 5 | SP-06 |
| US-034 | Nhập khung chương trình từ Excel: chạy thử | EP-09 | CV-091 (L), CV-092 (M) | 6 | SP-06 |
| US-035 | Xác nhận ghi: toàn bộ hoặc không gì cả | EP-09 | CV-093 (L), CV-094 (M) | 6 | SP-06 |
| US-036 | Xem lịch sử phiên nhập liệu | EP-09 | CV-095 (M) | 2 | SP-06 |
| US-037 | Xuất khung chương trình ra Excel | EP-09 | CV-096 (M), CV-097 (S) | 3 | SP-06 |
| — | Việc chốt bậc B2 | EP-09 | CV-098 (L) | 4 | — |

### 4.7. SP-07 — bậc B3, tuần 13–14

18 việc, 32 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 7 · Nghiệp vụ 6 · Giao diện 17 · Tích hợp 2. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 10 điểm, kết thúc ở CV-104.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-038 | Tra cứu đề cương dùng chung của học phần | EP-10 | CV-099 (M), CV-100 (M) | 4 | SP-07 |
| US-039 | Soạn nội dung đề cương | EP-10 | CV-101 (M), CV-102 (L), CV-103 (S) | 7 | SP-07 |
| US-040 | Đề cương song ngữ | EP-10 | CV-104 (M) | 2 | SP-07 |
| US-041 | Đính kèm bản đề cương đã ký (đợt 1) | EP-10 | CV-105 (S), CV-106 (M), CV-107 (S) | 4 | SP-07 |
| US-042 | Soạn PLO của chương trình | EP-11 | CV-108 (S), CV-109 (S), CV-110 (M) | 4 | SP-07 |
| US-043 | Soạn CLO của học phần | EP-11 | CV-111 (S), CV-112 (S), CV-113 (M) | 4 | SP-07 |
| US-044 | Soạn ma trận CLO–PLO theo cặp chương trình, học phần | EP-11 | CV-114 (S), CV-115 (M), CV-116 (L) | 7 | SP-07 |

### 4.8. SP-08 — bậc B3, tuần 15–16

19 việc, 32 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 3 · Nghiệp vụ 11 · Giao diện 11 · Kiểm thử 7. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 9 điểm, kết thúc ở CV-135.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-045 | Tra cứu PLO, CLO và ma trận | EP-11 | CV-117 (M) | 2 | SP-08 |
| US-046 | Ma trận học phần–PLO suy diễn và ghi đè | EP-11 | CV-118 (S), CV-119 (M), CV-120 (M) | 5 | SP-08 |
| US-047 | Cảnh báo lỗ hổng chuẩn đầu ra | EP-11 | CV-121 (M), CV-122 (M), CV-123 (S) | 5 | SP-08 |
| US-048 | Nhân bản chương trình kèm PLO và ma trận (đợt 2) | EP-11 | CV-124 (M), CV-125 (S) | 3 | SP-08 |
| US-049 | Khai báo thành phần đánh giá và trọng số | EP-12 | CV-126 (S), CV-127 (M), CV-128 (M) | 5 | SP-08 |
| US-050 | Thành phần điều kiện và điểm liệt | EP-12 | CV-129 (S), CV-130 (S) | 2 | SP-08 |
| US-051 | Ánh xạ thành phần đánh giá với CLO | EP-12 | CV-131 (S), CV-132 (M) | 3 | SP-08 |
| US-052 | Cảnh báo CLO chưa được đánh giá | EP-12 | CV-133 (M), CV-134 (S) | 3 | SP-08 |
| — | Việc chốt bậc B3 | EP-12 | CV-135 (L) | 4 | — |

### 4.9. SP-09 — bậc B4, tuần 17–18

15 việc, 33 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 4 · Nghiệp vụ 15 · Giao diện 10 · Kiểm thử 4. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 14 điểm, kết thúc ở CV-144.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-053 | Khóa sửa trực tiếp dữ liệu đã ban hành | EP-13 | CV-136 (L), CV-137 (M) | 6 | SP-09 |
| US-054 | Tạo, sửa, xóa đề xuất nháp | EP-13 | CV-138 (M), CV-139 (L), CV-140 (L), CV-141 (M) | 12 | SP-09 |
| US-055 | Ghi nguồn phát sinh của đề xuất | EP-13 | CV-142 (S) | 1 | SP-09 |
| US-056 | Đính kèm hồ sơ căn cứ | EP-13 | CV-143 (S), CV-144 (M) | 3 | SP-09 |
| US-057 | Gửi duyệt và định tuyến người duyệt | EP-13 | CV-145 (S), CV-146 (L), CV-147 (M), CV-148 (S), CV-149 (M) | 10 | SP-09 |
| US-059 | Thu hồi đề xuất | EP-13 | CV-153 (S) | 1 | SP-10 |

### 4.10. SP-10 — bậc B4, tuần 19–20

18 việc, 33 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 1 · Nghiệp vụ 15 · Giao diện 12 · Kiểm thử 5. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 8 điểm, kết thúc ở CV-162.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-058 | Cảnh báo xung đột giữa các đề xuất | EP-13 | CV-150 (M), CV-151 (S), CV-152 (S) | 4 | SP-10 |
| US-059 | Thu hồi đề xuất | EP-13 | CV-154 (S) | 1 | SP-10 |
| US-060 | Đề xuất thay đổi tổ chức và phân công | EP-13 | CV-155 (M), CV-156 (M) | 4 | SP-10 |
| US-061 | Hàng đợi đề xuất chờ duyệt | EP-14 | CV-157 (M), CV-158 (M) | 4 | SP-10 |
| US-062 | Xem đề xuất và bảng so sánh trước–sau | EP-14 | CV-159 (M), CV-160 (L) | 6 | SP-10 |
| US-063 | Xử lý ở cấp chuyên môn (cấp 1) | EP-14 | CV-161 (M), CV-162 (M) | 4 | SP-10 |
| US-064 | Xử lý ở cấp chương trình (cấp 2) | EP-14 | CV-163 (M) | 2 | SP-10 |
| US-065 | Trả lại hoặc từ chối ở cấp cuối | EP-14 | CV-164 (S), CV-165 (M) | 3 | SP-10 |
| US-066 | Tự động bỏ qua cấp của chính người tạo | EP-14 | CV-166 (M), CV-167 (M) | 4 | SP-10 |
| US-067 | Bình luận trên đề xuất | EP-14 | CV-168 (S) | 1 | SP-11 |

### 4.11. SP-11 — bậc B4, tuần 21–22

17 việc, 33 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 2 · Nghiệp vụ 14 · Giao diện 12 · Kiểm thử 5. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 9 điểm, kết thúc ở CV-185.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-067 | Bình luận trên đề xuất | EP-14 | CV-169 (M) | 2 | SP-11 |
| US-068 | Thông báo trong ứng dụng | EP-14 | CV-170 (S), CV-171 (M), CV-172 (M) | 5 | SP-11 |
| US-069 | Lịch sử phê duyệt của đề xuất | EP-14 | CV-173 (M) | 2 | SP-11 |
| US-070 | Phòng Đào tạo can thiệp ở cấp dưới | EP-14 | CV-174 (M), CV-175 (S), CV-176 (S) | 4 | SP-11 |
| US-071 | Ban hành phiên bản đầu tiên của chương trình | EP-15 | CV-177 (S), CV-178 (L), CV-179 (M), CV-180 (S) | 8 | SP-11 |
| US-072 | Chấp thuận cuối và sinh phiên bản mới | EP-15 | CV-181 (L), CV-182 (M), CV-183 (M) | 8 | SP-11 |
| US-073 | Kích hoạt phiên bản vào đầu học kỳ | EP-15 | CV-184 (M), CV-185 (M) | 4 | SP-11 |

### 4.12. SP-12 — bậc B4, tuần 23–24

15 việc, 33 điểm trên sức chứa 40. Theo loại việc: Nghiệp vụ 12 · Giao diện 10 · Kiểm thử 9 · Tài liệu 2. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 10 điểm, kết thúc ở CV-200.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-074 | Phiên bản đã ban hành là bất biến | EP-15 | CV-186 (M) | 2 | SP-12 |
| US-075 | Sửa đề cương dùng chung sinh phiên bản ở mọi chương trình | EP-15 | CV-188 (L), CV-189 (S), CV-190 (M) | 7 | SP-12 |
| US-076 | Ban hành phiên bản đính chính | EP-15 | CV-191 (M), CV-192 (M) | 4 | SP-12 |
| US-077 | Đính kèm đề cương đã ký theo phiên bản (đợt 2) | EP-15 | CV-193 (S) | 1 | SP-12 |
| US-078 | So sánh hai phiên bản | EP-16 | CV-194 (L), CV-195 (M) | 6 | SP-12 |
| US-079 | Xem lại phiên bản lịch sử | EP-16 | CV-196 (M) | 2 | SP-12 |
| US-080 | Gán phiên bản cho khóa tuyển sinh | EP-16 | CV-197 (M), CV-198 (M), CV-199 (S) | 5 | SP-12 |
| — | Việc cắt ngang, phục vụ cả bậc | EP-15 | CV-187 (M) | 2 | — |
| — | Việc chốt bậc B4 | EP-16 | CV-200 (L) | 4 | — |

### 4.13. SP-13 — bậc B5, tuần 25–26

16 việc, 31 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 5 · Nghiệp vụ 12 · Giao diện 5 · Tích hợp 1 · Kiểm thử 7 · Tài liệu 1. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 11 điểm, kết thúc ở CV-213.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-081 | Tải tệp mẫu sinh viên và kết quả học tập (đợt 2) | EP-17 | CV-201 (S), CV-202 (S) | 2 | SP-13 |
| US-082 | Nhập danh sách sinh viên và tự tạo tài khoản (đợt 2) | EP-17 | CV-203 (M), CV-204 (L), CV-205 (S) | 7 | SP-13 |
| US-083 | Nhập kết quả học tập (đợt 2) | EP-17 | CV-206 (S), CV-207 (M), CV-208 (M) | 5 | SP-13 |
| US-084 | Ghi danh riêng cho từng sinh viên và các ngoại lệ | EP-17 | CV-209 (M), CV-210 (M), CV-211 (S) | 5 | SP-13 |
| US-085 | Tính điều kiện đăng ký của từng học phần | EP-18 | CV-212 (L), CV-213 (L) | 8 | SP-13 |
| US-086 | Cột "Đăng ký được?" trên khung | EP-18 | CV-214 (M) | 2 | SP-13 |
| US-087 | Xét điều kiện tốt nghiệp cho một sinh viên | EP-19 | CV-215 (S) | 1 | SP-14 |
| US-098 | Cấp và quản lý khóa truy cập cho bên tích hợp | EP-21 | CV-237 (S) | 1 | SP-15 |

### 4.14. SP-14 — bậc B5, tuần 27–28

15 việc, 30 điểm trên sức chứa 40. Theo loại việc: Nghiệp vụ 15 · Giao diện 10 · Kiểm thử 5. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 11 điểm, kết thúc ở CV-230.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-087 | Xét điều kiện tốt nghiệp cho một sinh viên | EP-19 | CV-216 (L), CV-217 (M) | 6 | SP-14 |
| US-088 | Công nhận học phần tương đương khi xét | EP-19 | CV-218 (L), CV-219 (M) | 6 | SP-14 |
| US-089 | Danh sách hạng mục còn thiếu | EP-19 | CV-220 (M) | 2 | SP-14 |
| US-090 | Xét tốt nghiệp hàng loạt | EP-19 | CV-221 (M), CV-222 (M), CV-223 (S) | 5 | SP-14 |
| US-091 | Tính lại khi điểm bị sửa sau lúc xét | EP-19 | CV-224 (M), CV-225 (S) | 3 | SP-14 |
| US-092 | Sinh viên xem đúng phiên bản chương trình của mình | EP-20 | CV-226 (M), CV-227 (M), CV-228 (S) | 5 | SP-14 |
| US-093 | Sinh viên xem khung kèm trạng thái từng học phần | EP-20 | CV-229 (S), CV-230 (M) | 3 | SP-14 |

### 4.15. SP-15 — bậc B5, tuần 29–30

14 việc, 30 điểm trên sức chứa 40. Theo loại việc: Nghiệp vụ 4 · Giao diện 11 · Tích hợp 4 · Kiểm thử 9 · Tài liệu 2. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 14 điểm, kết thúc ở CV-245.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-094 | Sinh viên xem tiến độ học tập | EP-20 | CV-231 (M), CV-232 (M) | 4 | SP-15 |
| US-095 | Sinh viên xem học phần đủ điều kiện và lý do | EP-20 | CV-233 (M) | 2 | SP-15 |
| US-096 | Sinh viên xem đề cương và công thức điểm | EP-20 | CV-234 (M) | 2 | SP-15 |
| US-097 | Cổng sinh viên dùng được trên điện thoại | EP-20 | CV-235 (L), CV-236 (M) | 6 | SP-15 |
| US-098 | Cấp và quản lý khóa truy cập cho bên tích hợp | EP-21 | CV-238 (M), CV-239 (S) | 3 | SP-15 |
| US-099 | API chương trình và đề cương | EP-21 | CV-240 (M) | 2 | SP-15 |
| US-100 | API tiến độ, điều kiện đăng ký và xét tốt nghiệp | EP-21 | CV-241 (M), CV-242 (M) | 4 | SP-15 |
| US-101 | Tài liệu API theo chuẩn OpenAPI | EP-21 | CV-243 (M), CV-244 (S) | 3 | SP-15 |
| — | Việc chốt bậc B5 | EP-21 | CV-245 (L) | 4 | — |

### 4.16. SP-16 — bậc B6, tuần 31–32

17 việc, 34 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 1 · Nghiệp vụ 6 · Giao diện 10 · Tích hợp 8 · Kiểm thử 5 · Tài liệu 4. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 10 điểm, kết thúc ở CV-255.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-102 | Cấu hình kết nối và lịch đồng bộ | EP-22 | CV-246 (S), CV-247 (M), CV-248 (M) | 5 | SP-16 |
| US-103 | Đồng bộ theo lịch và nhật ký đồng bộ | EP-22 | CV-251 (L), CV-252 (M), CV-253 (M) | 8 | SP-16 |
| US-104 | Quy tắc ưu tiên khi hai nguồn mâu thuẫn | EP-22 | CV-254 (M), CV-255 (S) | 3 | SP-16 |
| US-105 | Đối sánh hai chương trình | EP-23 | CV-256 (M), CV-257 (M) | 4 | SP-16 |
| US-106 | Báo cáo phân bổ tín chỉ | EP-23 | CV-258 (S), CV-259 (M) | 3 | SP-16 |
| US-107 | Xuất ma trận chuẩn đầu ra ra Excel | EP-23 | CV-260 (M) | 2 | SP-16 |
| US-109 | Thống kê đề xuất thay đổi | EP-23 | CV-262 (S), CV-263 (M) | 3 | SP-16 |
| — | Việc cắt ngang, phục vụ cả bậc | EP-22 | CV-249 (L) | 4 | — |
| — | Việc cắt ngang, phục vụ cả bậc | EP-22 | CV-250 (M) | 2 | — |

### 4.17. SP-17 — bậc B6, tuần 33–34

15 việc, 34 điểm trên sức chứa 40. Theo loại việc: Dữ liệu 1 · Nghiệp vụ 6 · Giao diện 10 · Tích hợp 10 · Kiểm thử 7. Chuỗi phụ thuộc dài nhất nằm gọn trong sprint: 8 điểm, kết thúc ở CV-277.

| Story | Tên story | Epic | Việc (cỡ) | Điểm | Story xong ở |
|---|---|---|---|---|---|
| US-108 | Xuất bộ báo cáo kiểm định | EP-23 | CV-261 (L) | 4 | SP-17 |
| US-110 | Xem đồ thị quan hệ học phần | EP-24 | CV-264 (L) | 4 | SP-17 |
| US-111 | Xuất chương trình ra PDF | EP-24 | CV-265 (L) | 4 | SP-17 |
| US-112 | Xem dòng thời gian phiên bản | EP-24 | CV-266 (M) | 2 | SP-17 |
| US-113 | Bảng sức khỏe chương trình | EP-24 | CV-267 (M), CV-268 (M) | 4 | SP-17 |
| US-114 | Ủy quyền phê duyệt | EP-25 | CV-269 (S), CV-270 (M), CV-271 (M), CV-272 (S) | 6 | SP-17 |
| US-115 | Gửi thông báo qua email | EP-25 | CV-273 (M), CV-274 (S) | 3 | SP-17 |
| US-116 | Nhắc hạn đề xuất tồn đọng | EP-25 | CV-275 (M), CV-276 (S) | 3 | SP-17 |
| — | Việc chốt bậc B6 | EP-25 | CV-277 (L) | 4 | — |

---

## 5. Điểm theo loại việc trong từng sprint

Bảng này dùng để kiểm giả định GĐ-7. Sprint nào dồn quá nửa sức chứa vào một loại việc thì cần hơn một người làm được loại việc đó.

| Sprint | Bậc | Dữ liệu | Nghiệp vụ | Giao diện | Tích hợp | Kiểm thử | Tài liệu | Tổng | Loại nhiều nhất | Chuỗi phụ thuộc dài nhất |
|---|---|---|---|---|---|---|---|---|---|---|
| SP-01 | B1 | 6 | 11 | 6 | 0 | 2 | 4 | 29 | Nghiệp vụ 11 | 10 điểm |
| SP-02 | B1 | 5 | 7 | 13 | 0 | 4 | 0 | 29 | Giao diện 13 | 7 điểm |
| SP-03 | B1 | 1 | 11 | 9 | 0 | 7 | 0 | 28 | Nghiệp vụ 11 | 9 điểm |
| SP-04 | B2 | 5 | 12 | 11 | 0 | 1 | 0 | 29 | Nghiệp vụ 12 | 15 điểm |
| SP-05 | B2 | 1 | 13 | 11 | 0 | 3 | 1 | 29 | Nghiệp vụ 13 | 7 điểm |
| SP-06 | B2 | 1 | 10 | 4 | 5 | 7 | 0 | 27 | Nghiệp vụ 10 | 16 điểm |
| SP-07 | B3 | 7 | 6 | 17 | 2 | 0 | 0 | 32 | Giao diện 17 | 10 điểm |
| SP-08 | B3 | 3 | 11 | 11 | 0 | 7 | 0 | 32 | Nghiệp vụ 11 | 9 điểm |
| SP-09 | B4 | 4 | 15 | 10 | 0 | 4 | 0 | 33 | Nghiệp vụ 15 | 14 điểm |
| SP-10 | B4 | 1 | 15 | 12 | 0 | 5 | 0 | 33 | Nghiệp vụ 15 | 8 điểm |
| SP-11 | B4 | 2 | 14 | 12 | 0 | 5 | 0 | 33 | Nghiệp vụ 14 | 9 điểm |
| SP-12 | B4 | 0 | 12 | 10 | 0 | 9 | 2 | 33 | Nghiệp vụ 12 | 10 điểm |
| SP-13 | B5 | 5 | 12 | 5 | 1 | 7 | 1 | 31 | Nghiệp vụ 12 | 11 điểm |
| SP-14 | B5 | 0 | 15 | 10 | 0 | 5 | 0 | 30 | Nghiệp vụ 15 | 11 điểm |
| SP-15 | B5 | 0 | 4 | 11 | 4 | 9 | 2 | 30 | Giao diện 11 | 14 điểm |
| SP-16 | B6 | 1 | 6 | 10 | 8 | 5 | 4 | 34 | Giao diện 10 | 10 điểm |
| SP-17 | B6 | 1 | 6 | 10 | 10 | 7 | 0 | 34 | Giao diện 10 | 8 điểm |
| **Tổng** |  | **43** | **180** | **172** | **30** | **87** | **14** | **526** |  |  |

Không sprint nào dồn quá nửa sức chứa (20 điểm) vào một loại việc.

Một người làm được 10 điểm mỗi sprint theo GĐ-3 và GĐ-4. Sprint có chuỗi phụ thuộc dài hơn con số đó thì chuỗi ấy phải được chuyền tay giữa ít nhất hai người mới kịp: SP-04 (15 điểm), SP-06 (16 điểm), SP-09 (14 điểm), SP-13 (11 điểm), SP-14 (11 điểm), SP-15 (14 điểm).

---

## 6. Mốc và điều kiện bên ngoài

### 6.1. Mốc bàn giao

| Mốc | Cuối sprint | Tuần | Điều kiện đạt | Kịch bản nghiệm thu | Việc chốt bậc |
|---|---|---|---|---|---|
| Phiên bản 0.1 (bậc B1) | SP-03 | Tuần 6 | Tiêu chí ra của bậc B1 trong kế hoạch kiểm thử, mục 5 | 7 kịch bản NT-B1 | CV-053 |
| Phiên bản 0.2 (bậc B2) | SP-06 | Tuần 12 | Tiêu chí ra của bậc B2 trong kế hoạch kiểm thử, mục 5 | 9 kịch bản NT-B2 | CV-098 |
| Phiên bản 0.3 (bậc B3) | SP-08 | Tuần 16 | Tiêu chí ra của bậc B3 trong kế hoạch kiểm thử, mục 5 | 8 kịch bản NT-B3 | CV-135 |
| Phiên bản 0.4 (bậc B4) | SP-12 | Tuần 24 | Tiêu chí ra của bậc B4 trong kế hoạch kiểm thử, mục 5 | 12 kịch bản NT-B4 | CV-200 |
| Phiên bản 0.5 (bậc B5) | SP-15 | Tuần 30 | Tiêu chí ra của bậc B5 trong kế hoạch kiểm thử, mục 5 | 9 kịch bản NT-B5 | CV-245 |
| Phiên bản 1.0 (bậc B6) | SP-17 | Tuần 34 | Tiêu chí ra của bậc B6 trong kế hoạch kiểm thử, mục 5 | 9 kịch bản NT-B6 | CV-277 |
| Hết vận hành thử | — | Tuần 35–38 | Đọc được số liệu NFR-15 của 4 tuần (T-8) | — | — |

### 6.2. Điều kiện phải có từ bên ngoài nhóm

Mỗi dòng là một thứ nhóm không tự tạo ra được. "Chậm nhất" là tuần cuối cùng trước sprint đầu của bậc cần nó.

| Cần gì | Từ ai | Cho bậc | Chậm nhất | Nếu không có đúng hạn |
|---|---|---|---|---|
| Tệp Excel khung của chương trình mã 1024034 (Q-11) | Khoa CNTT | B2 | Cuối tuần 6 (trước SP-04) | Nhóm tự soạn một khung giả; kịch bản NT-B2-01 không chạy trên dữ liệu thật |
| Mẫu đề cương của Khoa và thang mức đóng góp CLO–PLO (Q-25, Q-26) | Khoa CNTT | B3 | Cuối tuần 12 (trước SP-07) | Dùng cấu trúc đề cương trong SRS và thang đặt trong cấu hình |
| Trả lời C01, C02, C03, C04 về thời điểm ban hành, trả lại, ủy quyền | Khoa CNTT và Phòng Đào tạo | B4 | Cuối tuần 16 (trước SP-09) | Làm theo lựa chọn tạm S-5, S-6, S-9, S-11; trả lời khác thì làm lại một phần EP-14 và EP-15 |
| Quy tắc xét tốt nghiệp và điều kiện đăng ký còn mở (Q-03, Q-05, Q-10, C05, C06, C07) | Phòng Đào tạo | B5 | Cuối tuần 24 (trước SP-13) | Làm theo SRS mục 7.3 và 7.4 như đang viết |
| Quyền đọc cơ sở dữ liệu có sẵn của Trường, hoặc xác nhận rằng nhóm tự dựng (Q-09) | Trường | B6 | Cuối tuần 30 (trước SP-16) | Kiểm với nguồn giả lập DL-8 (T-11) |
| Máy chủ của Khoa để cài đặt (NFR-25) | Khoa CNTT | B6 | Cuối tuần 30 (trước SP-16) | Cài trên máy tương đương và ghi lại cấu hình (T-6) |

### 6.3. Câu hỏi phải chốt trước từng bậc

Lấy từ dòng "Cần chốt trước khi làm" của từng bậc trong `docs/planning/epics.md`. Q-16 đã chốt ở `docs/design/tech-stack.md` nên không còn trong bảng; các câu còn lại chưa có trả lời; kế hoạch dùng lựa chọn tạm (GĐ-9).

| Bậc | Sprint đầu | Chậm nhất | Câu hỏi | Số câu |
|---|---|---|---|---|
| B1 | SP-01 | Trước tuần 1 | Q-13, Q-27, Q-06 | 3 |
| B2 | SP-04 | Cuối tuần 6 | Q-11, Q-04, Q-08, C09 | 4 |
| B3 | SP-07 | Cuối tuần 12 | Q-25, Q-26, Q-28, Q-12 | 4 |
| B4 | SP-09 | Cuối tuần 16 | H-1, C01, C02, C03, C04, Q-07, Q-19, Q-20, Q-21, Q-22, Q-24, Q-18, Q-23 | 13 |
| B5 | SP-13 | Cuối tuần 24 | H-2, Q-03, Q-05, Q-10, C05, C06, C07, C10, C11 | 9 |
| B6 | SP-16 | Cuối tuần 30 | Q-09, Q-14, Q-17 | 3 |

---

## 7. Cách tính lại

### 7.1. Công thức

| Bước | Cách tính |
|---|---|
| 1 | Sức chứa = số người × số tuần mỗi sprint × số ngày công mỗi người mỗi tuần × số điểm mỗi ngày công |
| 2 | Xét từng bậc theo thứ tự B1..B6. Mở một sprint mới cho bậc |
| 3 | Duyệt các việc của bậc theo thứ tự trong bảng phân rã công việc. Nhận việc đầu tiên thỏa cả ba điều kiện: mọi việc nó phụ thuộc đã được xếp; điểm của nó không vượt phần sức chứa còn lại; nếu là việc chốt bậc thì mọi việc khác của bậc đã được xếp |
| 4 | Lặp lại bước 3 cho tới khi không còn việc nào nhận được, rồi mở sprint kế. Hết việc của bậc thì sang bậc sau ở một sprint mới (GĐ-6) |
| 5 | San đều trong bậc: hạ mức trần của riêng bậc đó xuống giá trị nhỏ nhất mà số sprint của bậc không tăng, rồi xếp lại bậc đó theo bước 3 và 4. Nhờ vậy dự phòng chia ra các sprint của bậc thay vì dồn vào sprint cuối |
| 6 | Số tuần = số sprint × số tuần mỗi sprint |

Sau SP-01, thay GĐ-4 bằng số đo thật: số điểm đã xong chia cho số ngày công đã bỏ ra. Nếu tỷ lệ S : M : L thực tế khác 1 : 2 : 4 thì sửa điểm ở bảng phân rã công việc trước, rồi mới tính lại (K-3).

### 7.2. Số sprint theo sức chứa

Mỗi dòng là kết quả chạy lại đúng các bước ở mục 7.1 với một sức chứa khác. Dòng in đậm là kế hoạch của tài liệu này.

| Sức chứa (điểm mỗi sprint) | B1 | B2 | B3 | B4 | B5 | B6 | Tổng số sprint | Số tuần nếu sprint 2 tuần | Số sprint nếu bỏ GĐ-6 |
|---|---|---|---|---|---|---|---|---|---|
| 20 | 5 | 5 | 4 | 7 | 5 | 4 | 30 | 60 | 27 |
| 30 | 3 | 3 | 3 | 5 | 4 | 3 | 21 | 42 | 18 |
| **40** | **3** | **3** | **2** | **4** | **3** | **2** | **17** | **34** | **14** |
| 50 | 2 | 2 | 2 | 3 | 2 | 2 | 13 | 26 | 11 |
| 60 | 2 | 2 | 2 | 3 | 2 | 2 | 13 | 26 | 9 |
| 80 | 2 | 2 | 1 | 2 | 2 | 1 | 10 | 20 | 7 |
| 100 | 1 | 1 | 1 | 2 | 1 | 1 | 7 | 14 | 6 |
| 120 | 1 | 1 | 1 | 2 | 1 | 1 | 7 | 14 | 5 |

Đổi sức chứa ra số người, giữ GĐ-2, GĐ-3, GĐ-4: mỗi người góp 10 điểm mỗi sprint, nên sức chứa 20 là 2 người, 40 là 4 người, 60 là 6 người.

### 7.3. Sức chứa cần có cho một thời hạn cho trước

Tính ngược: với sprint 2 tuần và giữ GĐ-6, sức chứa nhỏ nhất để xong cả sáu bậc trong thời hạn. Không tính 4 tuần vận hành thử.

| Thời hạn | Số sprint tối đa | Sức chứa nhỏ nhất | Mỗi người mỗi sprint nếu nhóm 4 người | Số người nếu mỗi người 10 điểm | So với giả định |
|---|---|---|---|---|---|
| 12 tuần | 6 | 132 điểm | 33,0 điểm | 14 | gấp 3,3 lần |
| 15 tuần | 7 | 91 điểm | 22,8 điểm | 10 | gấp 2,3 lần |
| 18 tuần | 9 | 85 điểm | 21,2 điểm | 9 | gấp 2,1 lần |
| 24 tuần | 12 | 64 điểm | 16,0 điểm | 7 | gấp 1,6 lần |
| 30 tuần | 15 | 43 điểm | 10,8 điểm | 5 | gấp 1,1 lần |
| 36 tuần | 18 | 33 điểm | 8,2 điểm | 4 | trong giả định |

---

## 8. Rủi ro về lịch

| Rủi ro | Căn cứ | Cách giảm |
|---|---|---|
| Cỡ việc sai lệch cả loạt | Cả 277 việc được ước lượng một lần, chưa có số đo nào (K-3) | Đo sau SP-01 rồi tính lại; dự phòng 23% là chỗ đệm đầu tiên |
| Bậc B4 kéo dài | Bậc lớn nhất: 132 điểm, 4 sprint, và có nhiều câu hỏi chưa chốt nhất (13 câu) | Hỏi các câu của B4 ngay từ khi đang làm bậc trước; chậm nhất cuối tuần 16 |
| Việc chốt bậc phình ra | Mỗi lần chốt phải chạy lại kịch bản của mọi bậc trước; tới B6 là 94 kịch bản KB và 54 kịch bản NT (T-10) | Tự động hóa mức đơn vị ngay từ B1; dùng dự phòng của sprint cuối bậc |
| Chờ bên ngoài | 6 điều kiện ở mục 6.2, chưa cái nào được xác nhận | Mỗi điều kiện đã có phương án thay; hỏi sớm theo cột "Chậm nhất" |
| Thời hạn thật ngắn hơn 34 tuần | Chưa biết hạn của đồ án (P-4); người dùng đã quyết định không cắt phạm vi | Dùng bảng 7.3 để biết sức chứa phải có; các bậc đã xếp theo thứ tự nên phần làm được luôn là một phiên bản chạy được |

---

## 9. Điểm còn hở

| Mã | Vấn đề | Lựa chọn tạm | Ảnh hưởng tới | Phụ thuộc vào |
|---|---|---|---|---|
| P-1 | Không biết nhóm có mấy người | 4 người (GĐ-1) | Sức chứa; mọi con số tuần | Người dùng |
| P-2 | Không biết độ dài sprint | 2 tuần (GĐ-2) | Số sprint, số lần trình diễn | Người dùng và thầy hướng dẫn |
| P-3 | Không biết mỗi người làm được bao nhiêu; cỡ S / M / L chưa có số đo nào đứng sau | 2,5 ngày công mỗi người mỗi tuần và 2 điểm mỗi ngày công (GĐ-3, GĐ-4), tức 10 điểm mỗi người mỗi sprint | Sức chứa 40 điểm; toàn bộ mục 3 và mục 4 | Số đo của SP-01; K-3 |
| P-4 | Không biết ngày bắt đầu và hạn nộp. Theo các giả định, cả sáu bậc cần 34 tuần, dài hơn một học kỳ 15 tuần; người dùng đã quyết định làm hết 109 yêu cầu chức năng, không cắt phạm vi | Tính theo tuần tương đối, không cắt bậc nào. Nếu hạn là 15 tuần thì sức chứa phải từ 91 điểm mỗi sprint (mục 7.3) | Mọi mốc ở mục 6.1; rủi ro cuối của mục 8 | Người dùng: hạn của đồ án |
| P-5 | Có cho hai bậc dùng chung một sprint hay không | Không (GĐ-6): 17 sprint. Nếu cho phép thì còn 14 sprint, nhưng bậc sau bắt đầu khi bậc trước chưa nghiệm thu | Tổng số sprint; tiêu chí vào ở kế hoạch kiểm thử mục 5.1 | Thầy hướng dẫn |
| P-6 | Không biết ai trong nhóm làm được loại việc nào | Coi như ai cũng làm được mọi loại (GĐ-7); mục 5 nêu các sprint dồn việc | Khả năng làm song song trong một sprint | Người dùng: thành phần nhóm |
| P-7 | Chưa tính tuần nghỉ, tuần thi | Không có tuần nghỉ (GĐ-8) | Mọi mốc sau tuần nghỉ | Lịch học của Trường |
| P-8 | Các câu hỏi ở mục 6.3 chưa có trả lời khi bậc bắt đầu | Làm theo lựa chọn tạm đã ghi ở các tài liệu trước (GĐ-9); việc làm lại lấy từ dự phòng, không có điểm riêng | Dự phòng của từng bậc | Khoa CNTT, Phòng Đào tạo, thầy hướng dẫn |
| P-9 | NFR-15 cần một thời gian vận hành mới đo được (T-8) | 4 tuần vận hành thử sau SP-17, không tính vào số sprint | Mốc cuối ở mục 6.1 | Hạn của đồ án (P-4) |
| P-10 | Họp lập kế hoạch, xem lại, cải tiến của mỗi sprint không có trong 277 việc | Không tính điểm; coi là nằm ngoài 2,5 ngày công của GĐ-3. Cuối mỗi sprint trình diễn các kịch bản ở cột tương ứng của mục 4.0 | GĐ-3 | Thầy hướng dẫn: nhịp gặp |
