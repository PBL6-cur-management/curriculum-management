# Báo cáo triển khai: seed lại dữ liệu thật DUT từ bản sao CSDL Trường

> **Status: DONE: mã, migration, dựng lại `ctdt_real` và kiểm chứng. Ngày 2026-10-31.**
> - Nhánh `feat/dut-real-reseed`. Kế hoạch: [dut-real-reseed-implementation-plan](../implementation/dut-real-reseed-implementation-plan.md). Các chỗ lệch nằm ở §9 của kế hoạch.
> - Nguồn: bản sao CSV cục bộ của CSDL Trường (`tmProxDUT` và `DHBK_CDS.tmKehoach`), chép chỉ đọc. Lần dựng này không kết nối máy Trường.
> - Kiểm chứng: BE unit 1856/1856, BE e2e 131/131 (13 file bị chạm), FE 697/697; tsc, lint, Prettier sạch.
> - Đã chạy Playwright trên `ctdt_real` ngày 2026-11-01 (Playwright 1.64, 1 worker): F-01..F-05 152/152; F-07+F-08 48/48; F-09..F-12 96 đạt + 7 ca cũ đã sửa; F-13..F-16 101 đạt + 5 ca cũ đã sửa; F-17, F-20, F-21 đạt hết; mvp-flow 14/14; F-06 chưa chạy lại (4 ca cũ do ô bảng nay hiện tên + mã, người dùng đang sửa spec). Chưa chạy smoke vòng 1 và chưa đi tay UI qua màn Học kỳ và xét tốt nghiệp. Đính chính: báo cáo trước ghi thiếu `source/e2e/.env` là sai, tệp đã có.

## Deliverable

| Phần | Nội dung |
|---|---|
| Migration | `20261031124933_semester_start_date_estimated` thêm `Semester.startDateEstimated` (mặc định `false`) và CHECK `Semester_estimated_needs_date` |
| BE luồng | Phiên bản đã ban hành không còn bắt buộc có số quyết định. Bỏ điều kiện này ở `issuedVersionFact`, `readReleasedVersionSnapshot`, `GraduationInputReader` và bộ lọc phiên bản của `students-read.service`. Đính chính sao nguyên `decisionNumber`/`signedDate`, kể cả khi NULL. Lưu ngày trên MH-10 đặt `startDateEstimated = false` |
| FE | `SemesterStartDate` hiện ngày kèm Tag "Ngày ước lượng". `formatDecisionNumber` hiện "Chưa có số quyết định". Áp dụng ở MH-10, đầu trang chi tiết phiên bản, lịch sử, so sánh, gán khóa và `SemesterForm`. Kiểu API đã sinh lại |
| Seed | `extract/mirror-tables.ts` đọc CSV có allow-list. `program-map.ts` gom khung thành CTĐT theo quy tắc. `elective-groups.ts` dựng nhóm tự chọn theo SRS. `extract-catalog`, `extract-frames` và `extract-people` được viết lại, chạy bằng một lệnh `pnpm dut:extract [gốc]`. Seed nền không còn tạo học kỳ hay khóa giữ chỗ. Đã bỏ `DUT-UNASSIGNED` và số quyết định `DUT-…` |
| Lệnh | `pnpm db:rebuild:real --yes`: chạy `pg_dump`, reset, seed nền, extract rồi seed DUT |
| Test | Các spec mới: `mirror-tables`, `program-map`, `elective-groups`, `seed-people` (`resultStatus`). Viết lại `seed-programs`. Mở rộng `legacy-mapping`. BE unit cho cờ ước lượng và cho số quyết định NULL ở 4 bộ đọc. FE: `SemesterStartDate.test.tsx` |

## Số liệu sau khi dựng (`ctdt_real`, 2026-10-31)

| Mục | Số |
|---|---|
| Khung trong phạm vi | 89. Bị loại 24 khung có SV: 348 SV thạc sĩ (CD02), 15 SV tiến sĩ (CD03) |
| CTĐT / phiên bản | 42 / 89 (42 ACTIVE, 47 HISTORICAL). Cả 89 phiên bản không có số quyết định |
| Học phần / đơn vị | 449 học phần (41 học phần lấy đơn vị phụ trách từ mã) / 26 đơn vị (23 đơn vị phụ trách) |
| Học kỳ | 40 kỳ. Ngày thật lấy từ `DHBK_CDS.tmKehoach`. 5 kỳ hè ước lượng: 2014-2015-3, 2015-2016-3, 2016-2017-3, 2017-2018-3, 2020-2021-3. Kỳ kế tiếp là 2026-2027-2 (04/01/2027) |
| Khóa | 14 khóa (K2013..K2026) |
| Dòng khung / nhóm tự chọn | 6 956 dòng / 329 nhóm. 0 dòng tự chọn không thuộc nhóm (DEBT-05 đóng). 98 dòng hướng chuyển thành tự chọn |
| Cân tín chỉ | 52/89 khung có tổng bắt buộc cộng tối thiểu nhóm đúng bằng tổng tín chỉ. Mọi khung 1024 cân, trừ KHDL KS (nguồn dư 2 TC) và K2026 1024042-046 (khung chưa đủ). Khung lệch phần lớn là khung trước 2020. Chi tiết trong `data/report.json` |
| Quan hệ học phần | 554. 0 bỏ vì chu trình, 35 cặp mâu thuẫn, 20 cặp loại, 1 điều kiện tự tham chiếu bị bỏ |
| Giảng viên | 332 (13 khóa vì đơn vị 990, 320 hoạt động). Tên đăng nhập là mã cán bộ. Mật khẩu tạm ở `data/private/lecturer-credentials.csv` (gitignore) |
| Sinh viên | 1 923 (8 ON_LEAVE, 1 915 STUDYING), 1 923 ghi danh |
| Kết quả | 75 180: PASSED 59 536, FAILED 2 988, IN_PROGRESS 12 612 (kỳ 2610 đang mở), EXEMPT 44. Bỏ 5 936 dòng của kỳ đã qua mà không có điểm chữ |

Truy vấn kiểm chứng đều ra 0: `decisionNumber LIKE 'DUT-%'`, đơn vị `DUT-UNASSIGNED`, học kỳ thiếu `startDate`, dòng tự chọn không nhóm, dòng của phiên bản đã ban hành thiếu ảnh chụp, CTĐT giữ chỗ `1024034`/`DEMO*`.

## E-01: Prisma chặn `migrate reset` khi agent gọi

### Incident
Prisma 7 phát hiện lệnh được Claude Code gọi và từ chối `prisma migrate reset --force`. Lệnh chỉ chạy lại được khi có `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`, mang đúng câu đồng ý của người dùng. Bản sao lưu `pg_dump` chạy trước bước reset nên dữ liệu chưa bị xóa. Agent đã hỏi người dùng, người dùng trả lời "Đồng ý reset ctdt_real", rồi agent chạy lại.

### Lesson worth keeping
Agent phải hỏi người dùng trước khi chạy `db:rebuild:real`. Người dùng tự chạy trong terminal thì không gặp chặn này. Prisma 7 không còn cờ `--skip-seed`, và `migrate reset` cũng không tự chạy seed.

## E-02: 551 kết quả nằm ngoài danh mục

### Decision during build
Lần dựng đầu chỉ lấy học phần có trong khung, nên mất 551 kết quả của học phần SV học ngoài khung (tự do, mã cũ). Danh mục nay lấy thêm những học phần đó, miễn là chúng có trong `tmHocPhan`, thành 449 học phần. Không cần reset lần nữa: lượt `prisma:seed:dut` chạy lại đã thêm 5 đơn vị, 68 học phần và 551 kết quả nhờ `skipDuplicates`.

## E-03: `scripts/local/` bị gitignore

### Decision during build
`scripts/local/` dành cho script chỉ chạy cục bộ và bị gitignore. Lệnh dựng lại được `package.json` tham chiếu nên chuyển sang `scripts/rebuild-real.ts`.

## E-04: Số quyết định NULL

### Deviation
Kế hoạch chỉ nêu các bộ đọc "đã ban hành". Khi build còn tìm thêm `students-read.service.ts`, nơi lọc `decisionNumber: { not: null }` khi chọn phiên bản cho SV. Nếu giữ bộ lọc này, mọi phiên bản seed sẽ bị ẩn. Từ nay "đã ban hành" chỉ dựa vào trạng thái khác DRAFT, không có `sourceRequestId`, có `versionNumber`, `publishedAt` và học kỳ hiệu lực. Luồng ban hành qua UI (F-15) vẫn bắt buộc nhập số quyết định.

## Câu hỏi mở cho Khoa

- **Trạng thái tốt nghiệp và thôi học**: không suy ra được từ nguồn. `tmHocvu.Thoihoc` không bao giờ bằng 1. `tmSoluubang` không có SV CNTT. `tmHoSoSV.Tinhtrang1` có 127 SV mang cờ nhưng chưa rõ nghĩa.
- Mã CTĐT sinh theo quy tắc. Khung K2026 được xếp ENGINEER (`CNTT-KS-K26…`) theo `SoHK = 9`.
- Số quyết định ban hành thật của các phiên bản.
- Ý nghĩa `LoaiDK` 0/1/2. Hai dòng `Hoac = 1` vẫn hiểu là AND.
- 37 khung lệch tín chỉ: cần Khoa xác nhận tổng tín chỉ hoặc nhóm.
