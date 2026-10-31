# Seed lại dữ liệu thật DUT từ bản sao CSDL Trường — Kế hoạch triển khai

Thay pipeline seed DUT (`pnpm dut:extract` + `pnpm prisma:seed:dut`) đang đọc dump Markdown cũ bằng pipeline đọc bản sao cục bộ `D:\dut-mirror\csv` (PR #45). Kế hoạch này cũng bỏ các dữ liệu giả định, chỉnh schema và luồng ở những chỗ dữ liệu thật đòi hỏi, và thêm một lệnh dựng lại `ctdt_real` từ đầu.

> **Tài liệu đi kèm**
> - Báo cáo khám phá: `docs/reference/dut-school-db-discovery.md`
> - Kế hoạch seed cũ (bị thay thế một phần): `dut-legacy-seed-implementation-plan.md`
> - Yêu cầu: `docs/requirement/REQUIREMENTS.md` FR-84, BR-04, EC-04 (nhóm tự chọn có tín chỉ/số học phần tối thiểu, không có thực thể chuyên ngành)
> - Quy tắc dữ liệu cá nhân: chỉ đọc cột trong allow-list; dữ liệu cá nhân chỉ ghi vào `prisma/seed-data/dut/data/private/` (gitignore)

**Trạng thái**: Đang triển khai (2026-10-31), nhánh `feat/dut-real-reseed`.

---

## 0. Tóm tắt

| Việc | Lý do | Cách làm |
|---|---|---|
| Đọc bản sao CSV thay dump Markdown | Bản sao mới hơn khoảng 14 tháng, có đủ bảng người học và kết quả | `extract/mirror-tables.ts`: đọc CSV RFC 4180 với allow-list bảng và cột. Root lấy từ `DUT_MIRROR_ROOT`, mặc định `D:/dut-mirror/csv` |
| Phạm vi: khung đại học của Khoa CNTT | Người dùng chọn "khung có SV + 1024" | Gồm khung `1024xxx` cộng các khung `1021xxx` đang có SV (bậc đại học, `CapDT=CD01`). Khung `1022xxx`/`1023xxx` (thạc sĩ CD02, tiến sĩ CD03) **bị loại** vì SRS và `DegreeLevel` chỉ có ENGINEER/BACHELOR; số SV bị loại ghi vào report |
| Nhóm khung thành CTĐT bằng quy tắc | Danh sách tay 24 CTĐT không phủ được các khung 1021 | `groupFramesIntoPrograms()` lập mã từ: bậc, thời kỳ (`CU` trước K2020, `K26` từ K2026), CLC, hướng (NHAT, KHDL, ATKGS, KSTN, ANH, DT) và chuyên ngành (CNPM, ATTT, HTTT, KTMT, HTN, MANG). Ánh xạ khung → CTĐT ghi vào report để Khoa xác nhận |
| Bậc đào tạo lấy từ dữ liệu | Trước đây gán tay | Theo thứ tự: `LoaiCTDT` (KS/CN), tên khung chứa "Kỹ sư", rồi `SoHK ≥ 9` thì ENGINEER, còn lại BACHELOR |
| `majorName` thật | Trước đây là hằng "Công nghệ thông tin" | `tmNganhQG.TenNganhQG` theo 7 chữ số đầu của `Kyhieu`. Nếu thiếu thì dùng `TenNganhMoi`. `majorCode` = `Kyhieu` |
| Nhóm tự chọn theo SRS, không đổi schema | DEBT-05: 213 dòng tự chọn chưa có nhóm | Quy tắc ở §3. Bất biến: 0 dòng tự chọn không có nhóm |
| Học kỳ có ngày thật, đánh dấu ngày ước lượng | `tmProxDUT.tmKehoach` dừng ở 2020, nhưng `DHBK_CDS.tmKehoach` có `NgayDau` đến kỳ 2620 | Ngày lấy từ `DHBK_CDS.tmKehoach`, sau đó từ `tmProxDUT.tmKehoach`. Kỳ không có ngày (vài kỳ hè) dùng ngày ước lượng theo quy ước và ghi `Semester.startDateEstimated = true`. Học kỳ là mọi kỳ dữ liệu dùng tới, cộng một kỳ kế tiếp |
| Bỏ số quyết định giữ chỗ | DEBT-04: `DUT-<mã>-<phiên bản>` là dữ liệu bịa | `decisionNumber` và `signedDate` để NULL. Các bộ đọc "phiên bản đã ban hành" không còn đòi số quyết định (§4). UI và PDF hiển thị "Chưa có số quyết định" |
| Bỏ đơn vị `DUT-UNASSIGNED` | 22 học phần bị gán vào đơn vị bịa | Đơn vị phụ trách lấy từ `KhoaPC`. Nếu trống thì lấy 3 chữ số đầu `MaHP` (đúng 93% ở các dòng có `KhoaPC`). Tên đơn vị từ `tmDonVi`. Loại đơn vị: `MaBP=100` là OFFICE, còn lại FACULTY |
| Snapshot dòng như một lần ban hành thật | Seed cũ để `courseNameSnapshot`/`creditsSnapshot` NULL, khiến xét tốt nghiệp trên dữ liệu seed báo `SNAPSHOT_INCOMPLETE` | Seed ghi snapshot tên và tín chỉ cho dòng của phiên bản đã ban hành (giống `VersionPublisher.freezeRows`). `syllabusId` vẫn NULL vì nguồn không có đề cương |
| Người học và kết quả từ `tmProxDUT` | Bản dump cũ chỉ có SV 1024 | Trạng thái SV lấy từ `tmHocvu` (dòng mới nhất `ngunghoc = 1` → ON_LEAVE, còn lại STUDYING). GRADUATED/WITHDRAWN **không suy ra được** (xem §9). Kết quả lấy từ `tmDiemkyhoc` cộng `tmDiemMien` → EXEMPT |
| Xoá dữ liệu giả định ở seed nền | 4 học kỳ và 4 khóa giữ chỗ trong `prisma/seed.ts` | Gỡ `seedSemesters`. Học kỳ và khóa chỉ đến từ dữ liệu |
| Một lệnh dựng lại DB | Người dùng chọn dựng lại từ đầu | `pnpm db:rebuild:real --yes` (§5) |

### Ngoài phạm vi

| Không làm | Lý do |
|---|---|
| Đề cương, nội dung tuần, công thức điểm (`DATA_GVien1`, `congthucdiem`) | Chỉ 33 học phần CNTT có nội dung tuần và không có CLO. Để làm sau |
| PLO/CLO | Nguồn không có |
| Nhánh "hoặc" trong điều kiện (`tmHocphanDK.Hoac`) | Chỉ có 2 dòng; SRS không có. Giữ ngữ nghĩa AND và ghi vào report |
| Khung sau đại học (1022/1023) | Nằm ngoài SRS (§0) |
| Dữ liệu e2e world của Playwright | Vẫn do `pnpm e2e:world` tạo và xoá |

### Câu hỏi mở (đang build theo mặc định)

| Câu hỏi | Mặc định |
|---|---|
| Ý nghĩa `LoaiDK` 0/1/2 | Giữ như cũ: PRIOR / PREREQUISITE / COREQUISITE |
| Bậc của khung K2026 (150 TC, 9 HK, không có `LoaiCTDT`) | ENGINEER theo quy tắc `SoHK ≥ 9`; ghi vào report |
| Mã CTĐT chính thức | Mã sinh theo quy tắc ở §0; Khoa đổi được sau |
| Số quyết định ban hành thật | NULL cho đến khi Khoa cung cấp |

---

## 1. Schema (migration `semester_start_date_estimated`)

- `Semester.startDateEstimated Boolean @default(false)`. Ý nghĩa: `startDate` là ngày ước lượng, không lấy từ lịch của Trường. Ràng buộc CHECK: `startDateEstimated` chỉ được true khi `startDate IS NOT NULL`.
- Lệch so với plan mode: plan mode đề xuất enum `SemesterDateSource`. Cột boolean đủ dùng và đơn giản hơn.
- Không đổi gì khác: `decisionNumber` vốn đã nullable, và `ElectiveGroup`, `AcademicResultStatus.EXEMPT`, `StudentStatus` đã có sẵn.

## 2. Hợp đồng API

- `SemesterDto` (dùng chung ở `shared/releases/semester.dto.ts`): thêm `startDateEstimated: boolean`.
- `PATCH /api/semesters/:id`: khi gửi `startDate`, server đặt `startDateEstimated = false` vì PĐT đã nhập ngày chính thức. `POST` luôn tạo với `false`.
- Các DTO đang khai báo `decisionNumber: string` cho phiên bản đã ban hành chuyển sang `string | null`: `version-comparison.dto.ts`, `IssuedVersionFact`. DTO của change request và DTO quyết định ban hành vẫn bắt buộc có số, vì ban hành qua ứng dụng vẫn phải nhập số quyết định.
- FE: chạy `pnpm api:types`. Hiển thị nhãn "Ngày ước lượng" cạnh ngày bắt đầu (màn Học kỳ, đầu trang phiên bản). Hiển thị "Chưa có số quyết định" ở chỗ in số quyết định.

## 3. Quy tắc nhóm tự chọn

Áp dụng cho từng khung, từng học kỳ. Chỉ xét các dòng có `Tuchon=1`.

1. **Neo**: ghi chú khớp `chọn k trong n`, `chọn k/n` hoặc `chọn x tc`. Mỗi ghi chú (không phân biệt hoa thường) tạo một nhóm: `minCourses=k` với cỡ dự kiến n, hoặc `minCredits=x`.
2. **Dòng trống hoặc ghi chú rác** (rỗng, `x`, `ko`, `mở`): gán vào neo đầu tiên của học kỳ còn chỗ, nghĩa là số dòng nhỏ hơn n, hoặc là neo tín chỉ. Nếu không có neo nào còn chỗ thì dòng vào nhóm dư của học kỳ.
3. **Ghi chú là tên hướng** (ATTT, HTTT, Mạng, Công nghệ PM…): dòng vào nhóm dư `Tự chọn HKx` của học kỳ.
4. **Khung gộp nhiều hướng**: nếu tổng tín chỉ dòng bắt buộc lớn hơn `SoTinChi − Sotuchon` và học kỳ có từ 2 nhãn hướng trở lên, thì các dòng `Tuchon=0` mang nhãn hướng của học kỳ đó cũng chuyển vào nhóm dư, thành dòng tự chọn có ghi chú giữ nguyên. Ví dụ: 1024031 HK7 có khối "chọn một hướng". Khi đó `compulsoryCredits` và `electiveCredits` khai báo của phiên bản lấy từ phép tính, còn số gốc ghi vào report.
5. **Tối thiểu của nhóm dư**: lấy `tmKhungTC.SoTC` của học kỳ nếu lớn hơn 0. Nếu không, nhóm dư không phải cuối cùng lấy `minCourses=1`, còn nhóm cuối lấy `minCredits = max(SoTinChi − bắt buộc − Σ tối thiểu các nhóm khác, 0)`.
6. Report ghi: số khung cân tín chỉ, khung lệch (do nguồn), nhóm tối thiểu bằng 0, nhóm neo có số dòng khác n, các khung có dòng bị chuyển ở bước 4.

## 4. Luồng cần chỉnh

| Chỗ | Thay đổi |
|---|---|
| `shared/releases/cohort-version-schedule.ts` `issuedVersionFact` | Bỏ điều kiện `!decisionNumber`. `IssuedVersionFact.decisionNumber` thành `string \| null` |
| `features/releases/released-version-snapshot.reader.ts` | Bỏ điều kiện `!decisionNumber` |
| `shared/graduation/graduation-input.reader.ts` | Bỏ điều kiện `!decisionNumber` |
| `features/releases/corrections.service.ts` | Đính chính một phiên bản không có số quyết định thì giữ NULL. `PromoteVersionInput.decisionNumber` và `signedDate` thành nullable |
| `features/releases/dto/version-comparison.dto.ts` | `decisionNumber` nullable |
| `features/semesters/*`, `shared/releases/semester.dto.ts` | `startDateEstimated` (§2) |
| FE `SemestersPage`, `VersionHeader`, `VersionComparisonPage`, PDF template | Nhãn "Ngày ước lượng" / "Chưa có số quyết định" |

## 5. Lệnh dựng lại DB — `scripts/rebuild-real.ts`

1. Từ chối chạy nếu thiếu `--yes`, hoặc nếu `DATABASE_URL` không trỏ tới `localhost`/`127.0.0.1` với tên DB `ctdt_real`.
2. `pg_dump -Fc` chạy trong container `postgres` của compose (máy không có `pg_dump`) vào `D:/pg-backups/ctdt_real-<timestamp>.dump`. Thư mục backup lấy từ `DUT_PG_BACKUP_DIR`, mặc định `<gốc bản sao>/../pg-backups`.
3. `prisma migrate reset --force` (Prisma 7 không còn `--skip-seed` và không tự seed), rồi `prisma:seed`, `dut:extract`, `prisma:seed:dut`. Prisma chặn reset khi do AI agent gọi; agent phải hỏi người dùng và truyền `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
4. Ghi lệnh vào `technical_reference.md` và `D:\dut-mirror\README.md`.

## 6. Kiểm thử

- Unit (prisma seed-data): `mirror-tables.spec.ts` (CSV, allow-list), `program-map.spec.ts` (quy tắc mã và bậc), `elective-groups.spec.ts` (các ca 1024031, 1024034, neo "Chọn 1/3", "Chọn 6 tc"), `legacy-mapping.spec.ts` (ước lượng ngày, đơn vị phụ trách), `seed-programs.spec.ts` (không còn số quyết định giữ chỗ).
- BE unit: semesters service (cờ ước lượng), cohort-version-schedule, snapshot reader, graduation input khi số quyết định NULL.
- FE: nhãn ngày ước lượng, "Chưa có số quyết định".

## 7. Kiểm chứng

1. `pnpm dut:extract` chạy sạch và in các bất biến.
2. `pnpm db:rebuild:real --yes`, sau đó truy vấn: 0 phiên bản có `decisionNumber LIKE 'DUT-%'`, 0 đơn vị `DUT-UNASSIGNED`, 0 học kỳ `startDate IS NULL`; số SV và kết quả khớp report; đối chiếu 1024031 với CSV.
3. build-verifier: BE tsc + oxlint + unit; FE tsc -b + oxlint + vitest; BE e2e các spec bị chạm.
4. Chạy app: màn Học kỳ, chi tiết phiên bản, xét tốt nghiệp thử 1 SV.

## 8. Rủi ro

- Quy tắc nhóm CTĐT và nhóm tự chọn là suy luận. Report liệt kê đầy đủ để Khoa duyệt; đổi lại chỉ cần sửa một file rồi chạy lại lệnh dựng DB.
- Dựng lại DB làm mất dữ liệu tạo tay trên `ctdt_real`. Đã có bước `pg_dump` trước khi reset.

## 9. Lệch khi triển khai (2026-10-31)

| Kế hoạch | Thực tế | Lý do |
|---|---|---|
| Khung K2026 `CNTT-K26-CNTT` bậc BACHELOR (bản đồ tay cũ) | `CNTT-KS-K26[-KSTN/ATKGS/KHDL]`, ENGINEER | Khung K2026 có 9 học kỳ, 150 TC, không có `LoaiCTDT`; quy tắc `SoHK ≥ 9`. Khoa cần xác nhận |
| Trạng thái SV: `Thoihoc` → WITHDRAWN, `Tinhtrang1`/`NamTN` → GRADUATED | Chỉ ON_LEAVE/STUDYING | Trong bản sao `tmHocvu.Thoihoc` không bao giờ bằng 1; `tmSoluubang` không có SV CNTT; ý nghĩa `Tinhtrang1` (127 SV) chưa xác nhận. Đếm vào `people-report.json` (`studentsFlaggedTinhtrang1`). Câu hỏi mở cho Khoa |
| Kết quả "lần tốt nhất" | Mỗi dòng `tmDiemkyhoc` theo (SV, học phần, học kỳ) | Bảng kết quả có khóa theo học kỳ; giữ đủ các lần học. Dòng không có điểm chữ của kỳ đã qua bị bỏ (5 936), của kỳ đang mở thành IN_PROGRESS |
| Danh mục học phần = học phần trong khung | Thêm học phần SV trong phạm vi đã học ngoài khung (có trong `tmHocPhan`) | Không bỏ mất 551 kết quả (tự chọn tự do, mã cũ). Danh mục 449 học phần, 23 đơn vị phụ trách |
| Email giảng viên thật | `email` chỉ ghi khi là địa chỉ đầy đủ hợp lệ; gần như mọi dòng trống | Nguồn hầu như không có email. Tên đăng nhập = mã cán bộ (`MaHS`) |
| `extract-catalog/frames/people` là ba lệnh | Một lệnh `pnpm dut:extract [gốc bản sao]` | Đơn giản hơn; bất biến kiểm trong `extract/extract.ts` |
| Gốc bản sao `D:/dut-mirror/csv` | `D:/dut-mirror` (thư mục `csv/` nằm bên trong) | Khớp bố cục bản sao |

### Kết quả lần dựng 2026-10-31

89 khung → 42 CTĐT, 89 phiên bản (42 ACTIVE, 47 HISTORICAL, đều không có số quyết định); 449 học phần; 26 đơn vị; 40 học kỳ (5 kỳ hè ước lượng: 2014-2015-3, 2015-2016-3, 2016-2017-3, 2017-2018-3, 2020-2021-3) và kỳ kế tiếp 2026-2027-2; 14 khóa K2013..K2026; 6 956 dòng khung, 329 nhóm tự chọn, 0 dòng tự chọn không nhóm; 52/89 khung cân tín chỉ; 554 quan hệ; 332 giảng viên (13 khóa); 1 923 SV (8 tạm ngừng); 75 180 kết quả (PASSED 59 536, FAILED 2 988, IN_PROGRESS 12 612, EXEMPT 44). Khung sau đại học bị loại: 348 SV thạc sĩ, 15 SV tiến sĩ.
