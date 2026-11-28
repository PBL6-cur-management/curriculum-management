# Kế hoạch Triển khai Tổng thể — Nâng cấp theo `FEEDBACK.md` & Khắc phục Lỗi Kiểm toán SRS

> **Ngày lập:** 2026-11-28  
> **Cơ sở:** `FEEDBACK.md`, kết quả kiểm toán SRS/Code (`REQUIREMENTS.md`, `dut-school-db-discovery.md`), và 5 quyết định kiến trúc người dùng đã chốt (A1–A5).

---

## 1. Kiến trúc & Quyết định đã chốt

1. **Đa phiên bản CTĐT linh hoạt (A1):**
   - Nhãn UI của phiên bản `ACTIVE` đổi từ *"Đang hiệu lực"* / *"Đang áp dụng"* → **"Mới nhất"**.
   - Bất kỳ phiên bản nào đã ban hành (`ACTIVE` hoặc `HISTORICAL`) có gắn khóa tuyển sinh / sinh viên đang theo học đều hiển thị rõ danh sách khóa đang áp dụng (ví dụ: `K23, K24`) + `Số QĐ / Số văn bản` đi kèm số phiên bản ở mọi màn hình.
   - `CorrectionsService` mở rộng cho phép **Đính chính** không chỉ trên bản `ACTIVE`/`PENDING`, mà cả trên bản `HISTORICAL` còn khóa/sinh viên đang theo học (với cơ chế cập nhật khóa gắn sang bản đính chính mà không ép đẩy bản `ACTIVE` mới hơn xuống lịch sử nếu bản đính chính dành cho khóa cũ).
2. **Luồng phê duyệt 2 nhánh + Bổ sung Lãnh đạo Khoa R2 (A2):**
   - Số cấp duyệt thống nhất toàn hệ thống (1..4):
     - **Cấp 1:** Điều phối nhóm chuyên môn (`R4`, `PENDING_COORDINATOR`) — duyệt song song mọi nhóm CM phụ trách HP.
     - **Cấp 2:** Giám đốc CTĐT (`R3`, `PENDING_DIRECTOR`) — **duyệt song song tất cả Giám đốc CTĐT** của các CTĐT có chứa học phần.
     - **Cấp 3:** Ban Lãnh đạo Khoa (`R2`, `PENDING_FACULTY_LEADERSHIP`) — **duyệt kiểu Pool theo Khoa** (bất kỳ 1 người trong Ban LĐ Khoa duyệt là qua, giống PĐT `R1`; hỗ trợ ủy quyền `scopeLevel = 3`).
     - **Cấp 4:** Phòng Đào tạo (`R1`, `PENDING_ACADEMIC_OFFICE`) — duyệt cuối kiểu Pool.
   - **Luồng 1 — Thay đổi Học phần / Đề cương / Công thức điểm / CLO HP / Quan hệ HP (4 cấp):**
     `Giảng viên (R5) / R4 / R3 / R1 → Cấp 1 (R4) → Cấp 2 (R3 song song) → Cấp 3 (R2 Pool) → Cấp 4 (R1)`.
     - Học phần khoa khác (`EC-24`): mở quyền cho R3/R4/R5 Khoa tạo đề xuất thay đổi ĐCCT/CLO/CTĐ cho học phần khoa khác, định tuyến thẳng lên Cấp 4 (R1) theo quy tắc `FOREIGN_COURSE`.
   - **Luồng 2 — Thay đổi CTĐT: Khung CT / PLO / Thông tin CTĐT (2 cấp: R2 → R1):**
     - Chỉ **Giám đốc CTĐT (R3)** (cho CTĐT mình phụ trách) và **Phòng Đào tạo (R1)** (khi nguồn Trường / nhập hồi tố) được khởi tạo. **Chặn R4/R5** tạo đề xuất CTĐT.
     - Bỏ qua Cấp 1 & Cấp 2 (không sinh bước R4/R3), đi thẳng: `Cấp 3 (R2 Pool của Khoa quản lý CTĐT) → Cấp 4 (R1)`.
   - **Thông tin đề xuất:**
     - Đổi nhãn trường thành **"Số văn bản"** trong form đề xuất.
     - Đưa **Học kỳ áp dụng (`effectiveSemesterId`)** và **Khóa áp dụng (`cohortIds`)** lên ngay bước **tạo/sửa đề xuất** (tùy chọn hoặc theo loại đề xuất), cho phép chọn ngày ban hành và học kỳ lùi về quá khứ khi cần nhập dữ liệu lịch sử; các cấp duyệt thấy rõ thông tin này khi xét duyệt, và Phòng Đào tạo có thể xác nhận/điều chỉnh ở bước duyệt cuối.
   - **Lịch sử Đề cương chi tiết & Fan-out bền vững:**
     - `Syllabus` lưu thêm `effectiveSemesterId`, `documentNumber`, `signedDate`; cung cấp API & UI xem toàn bộ **Lịch sử phiên bản ĐCCT** (`DRAFT` / `PUBLISHED` / `HISTORICAL`), đồng thời giữ nguyên tệp đính kèm (`SyllabusAttachment`) khi sao chép bản làm việc CR và ban hành bản mới.
     - Fan-out khi duyệt ĐCCT dùng chung nhiều CTĐT: cho phép chọn khóa áp dụng kể cả khi có >1 CTĐT, và khi ban hành ĐCCT cho học phần dùng chung nhiều CTĐT (38–40 CTĐT), xử lý **bền vững theo từng CTĐT** (không để 1 CTĐT có cảnh báo/lỗi nhất quán cũ hay bản PENDING sau hơn làm sập toàn bộ việc ban hành ĐCCT gốc; ghi nhận chi tiết CTĐT nào được sinh phiên bản mới và CTĐT nào giữ nguyên kèm cảnh báo).
3. **Mô hình 3 tầng: Level 0 Ngành (`Major`) → CTĐT (`Program`) → Phiên bản có Định hướng con (`ProgramTrack`) (A3):**
   - `Major` (Level 0, R1 quản lý): `majorCode`, `majorName`, `englishName`, `degreeGroup`, `facultyId`, `status`; seed đủ 56 ngành quốc gia DUT từ `tmNganhQG`.
   - `Program.majorId` → `Major`. `DegreeLevel` mở rộng thành `BACHELOR | ENGINEER | MASTER | DOCTORATE`.
   - `ProgramTrack` thuộc `ProgramVersion` (`trackCode`, `trackName`, `englishName`, `description`, `sortOrder`, `compulsoryCredits`, `electiveCredits`).
   - `CurriculumItem.trackId` (`null` = khung chung; non-null = định hướng con). Unique đổi sang partial unique `(versionId, courseId) WHERE trackId IS NULL` + `(versionId, trackId, courseId)` — cho phép **cùng 1 học phần là Bắt buộc ở CNPM và Tự chọn ở HTTT**.
   - `ElectiveGroup.trackId` (`null` = tự chọn chung; non-null = tự chọn của định hướng).
   - Clone `ProgramVersion` & Clone `Program` sao chép đầy đủ toàn bộ `ProgramTrack` cùng các `CurriculumItem` và `ElectiveGroup` gắn track.
   - `ProgramEnrollment.trackId` gắn định hướng sinh viên chọn → `ConsistencyChecker` (kiểm tra Khung chung + từng Định hướng riêng), `RegistrationEligibility`, `GraduationEngine`, `VersionComparison`, `StudentPortal`, `ddut-api` lọc đúng theo `Khung chung + Định hướng của sinh viên`.
4. **Chuyển CTĐT hàng loạt, Phân quyền động (Dynamic Role) & API chuẩn Mã học phần (A4):**
   - **Chuyển CTĐT sinh viên:** API & UI chuyển hàng loạt nhiều sinh viên (`POST /students/enrollments/bulk-transfer`), hỗ trợ Import Excel (`ImportType.PROGRAM_TRANSFER`) và Export Excel danh sách lịch sử chuyển CTĐT (hỗ trợ cả học kỳ tương lai gần khi chuẩn bị chuyển đầu kỳ).
   - **Dynamic Role:** CRUD đầy đủ `POST /roles`, `PATCH /roles/:roleCode`, `DELETE /roles/:roleCode` (khóa xóa `isSystemRole = true` hoặc role đang có người dùng/approval level), tạo/sửa/xóa vai trò ngay trên trang Ma trận phân quyền, gỡ các đoạn hardcode `'R1'..'R6'` không cần thiết (dùng permission thay vì roleCode cho UI/staff guards nơi thích hợp).
   - **API tích hợp (`ddut-api` v1):** Chuẩn hóa DTO trả về chỉ dùng **mã tự nhiên** (`courseCode`, `programCode`, `studentCode`, `versionNumber`, `semesterCode`, `trackCode`), **loại bỏ CUID nội bộ** (`enrollmentId`, `programVersionId`, `itemId`, `courseId`, `evidenceResultId`, `curriculumItemId`...) ở tầng DTO công khai, và bổ sung `GET /api/v1/hoc-phan` + `GET /api/v1/hoc-phan/:maHP` phục vụ hệ thống Quản lý lớp học phần.
5. **Sửa lỗi SRS / Rules Engine nghiêm trọng (A4):**
   - **Thang điểm `DEC-11`:** Chấp nhận ngưỡng điểm tiên quyết trên thang 10 (`0..10`, mặc định đạt `4.0/10` hoặc `status === PASSED` khi không khai báo ngưỡng riêng); so sánh `score10 >= threshold` (nếu `threshold > 4` hoặc thang 10 chuẩn), tránh lỗi bắt đạt điểm A `4.0/4.0`!
   - **Xét tốt nghiệp (`GraduationEngine`):**
     - Kiểm tra **GPA tích lũy tối thiểu** (`>= version.minGraduationGpa ?? 2.00` trên thang 4, tính có trọng số theo tín chỉ các môn tính điểm đạt).
     - Xử lý **`EXEMPT`** (miễn học phần): công nhận hoàn thành & cộng tín chỉ miễn (không tính vào mẫu số GPA), **không crash 409 `EXEMPTION_POLICY_UNCONFIRMED`** và **không lỗi `PREREQUISITE_SCORE_MISSING`** khi xét ĐKHP.
     - Xử lý **`CONDITIONAL` + `isElective`** không crash 409.
     - Chặn lỗ hổng `freeCredits` cộng nhầm vào `recognizedTotal` của CTĐT.
     - Bổ sung kiểm tra **`HT ĐA`** (Học trước Đồ án TN) và **`TQ ĐA`** (Tiên quyết Đồ án TN) khi xét đăng ký học phần `CAPSTONE` (`Đồ án Tốt nghiệp`).
   - **Sửa stub `CourseUsageReader.hasStudyResults`:** Query thật `prisma.academicResult.count({ where: { courseId } }) > 0`.

---

## 2. Lược đồ Migration (Nền tảng chung)

Thực hiện **1 migration thống nhất** tại `source/backend/prisma/migrations/<ts>_feedback_enhancements/`:
- `DegreeLevel`: thêm `MASTER`, `DOCTORATE`
- `ChangeRequestStatus`: thêm `PENDING_FACULTY_LEADERSHIP`
- `ImportType`: thêm `PROGRAM_TRANSFER`
- `MajorStatus` enum + bảng `Major` + `Program.majorId`
- Bảng `ProgramTrack` + `CurriculumItem.trackId` + `ElectiveGroup.trackId` + `ProgramEnrollment.trackId`
- Đổi constraint `CurriculumItem`: bỏ `CurriculumItem_versionId_courseId_key`, thêm partial unique `("versionId", "courseId") WHERE "trackId" IS NULL` và unique `("versionId", "trackId", "courseId")`
- Bảng `ChangeRequestCohort` (`changeRequestId`, `cohortId`)
- `Syllabus`: thêm `effectiveSemesterId`, `documentNumber`, `signedDate`
- `OrgUnit`: thêm `isExternal Boolean @default(false)`
- `ProgramVersion`: thêm `minGraduationGpa Decimal? @db.Decimal(3, 2)`
- Nới CHECK SQL:
  - `ApprovalStep_level_range`: `"approvalLevel" BETWEEN 1 AND 4`
  - `ApprovalDelegation_scope_level`: `"scopeLevel" IS NULL OR "scopeLevel" IN (1, 2, 3)`

---

## 3. Kế hoạch chia Wave & Điều phối Multi-Agent qua `control-agents`

- **Nền tảng (Coordinator):** Áp dụng schema + migration + `prisma generate` + seed cập nhật (`approval-levels`, `roles/permissions` cho R2 duyệt cấp 3, `majors` 56 ngành từ `tmNganhQG`, chuẩn hóa tên đơn vị).
- **Wave 1 (`pro6` / `pro2` song song):**
  - BE: `DegreeLevel` (`MASTER`/`DOCTORATE`), `OrgUnit.isExternal` & chuẩn hóa tên đơn vị, `CourseUsageReader.hasStudyResults`, thêm `decisionNumber` vào mọi DTO version thiếu, 1-click promote/demote coordinator.
  - FE: Đổi thuật ngữ `"Đồ thị học phần"` → `"Cây chương trình đào tạo"`, `"Sức khỏe chương trình"` → `"Rà soát chất lượng CTĐT"`, `"Đang hiệu lực"` → `"Mới nhất"` (+ hiển thị khóa áp dụng), hiển thị `Số QĐ / Số văn bản` đi kèm version ở tất cả 15 vị trí, nhãn `Thạc sĩ`/`Tiến sĩ`.
- **Wave 2 (`pro6` + `pro2`):**
  - BE + FE: Luồng phê duyệt 2 nhánh (4 cấp HP/ĐCCT, 2 cấp CTĐT) + cấp R2 Pool + ủy quyền cấp 3 + chặn R4/R5 tạo CR CTĐT + mở học phần khoa khác + chuyển `Khóa áp dụng` & `Học kỳ áp dụng` lên form tạo đề xuất + đổi nhãn `Số văn bản` + cho phép chọn ngày/kỳ quá khứ + Đính chính linh hoạt trên bản cũ còn khóa học + Lịch sử phiên bản ĐCCT & giữ attachments + fan-out ĐCCT bền vững.
- **Wave 3 (`pro4` + `pro6`):**
  - BE + FE: Module `majors` (Level 0 CRUD + lọc CTĐT theo Ngành), `ProgramTrack` CRUD trong `ProgramVersion` (khung chung + tab/nhóm định hướng, cùng 1 HP thuộc nhiều định hướng), cập nhật `Clone`, `ConsistencyChecker`, `RegistrationEligibility`, `GraduationEngine`, `VersionComparison`, `StudentPortal`, `ProgramEnrollment` gắn `trackId`.
- **Wave 4 (`pro2` + `pro4`):**
  - BE + FE: Chuyển CTĐT hàng loạt (`bulk-transfer`) + Import/Export Excel chuyển CTĐT; Dynamic Role CRUD (`POST/PATCH/DELETE /roles`) + UI trên trang Ma trận phân quyền + gỡ hardcode `R1..R6`; chuẩn hóa `ddut-api` bỏ CUID nội bộ + bổ sung endpoint `GET /api/v1/hoc-phan` & `GET /api/v1/hoc-phan/:maHP`.
- **Wave 5 (`pro6` + Verification):**
  - Sửa `DEC-11` thang điểm 10, `GraduationEngine` (GPA ≥ 2.0, `EXEMPT`, `CONDITIONAL+Elective`, bỏ lỗ hổng `freeCredits`, `HTDA`/`TQDA` cho ĐATN).
  - Đồng bộ `docs/requirement/REQUIREMENTS.md` và regenerate OpenAPI `pnpm api:types`.
  - Chạy `tsc`, `oxlint`, unit tests BE & FE, và tổng hợp báo cáo nghiệm thu.
