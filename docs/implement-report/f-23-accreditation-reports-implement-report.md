# F-23 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu (2026-10-31)**: so sánh hai chương trình (MH-60), phân bổ tín chỉ (MH-61), xuất ma trận và hồ sơ kiểm định (MH-62), thống kê đề xuất (MH-44) đã có mã và test. Nhánh `feat/f-23-accreditation-reports`.
- **Không migration, không gói mới.** Dùng `exceljs` đã có.
- **Bằng chứng**:
  - BE e2e `test/reports.e2e-spec.ts` 5/5 (so sánh + Excel, phân bổ cộng đúng tổng, ma trận, hồ sơ 13 trang, thống kê, phân quyền R5 → 403).
  - BE unit `features/reports/report-calculations.spec.ts` 4/4 (ghép tương đương, phân bổ không thổi phồng tự chọn, tính lượt duyệt).
  - FE vitest `features/reports` 5/5; `tsc -b` 0; oxlint sạch (BE và FE).
  - Chạy thử trên `ctdt_real` bằng `ui.viewer`: so sánh 53 chung / 11 / 9; phân bổ phát hiện yêu cầu 122 TC ≠ công bố 130 TC; hồ sơ bị chặn `REPORT_GRADING_UNAVAILABLE` vì học phần thật chưa có thành phần đánh giá. Ảnh MH-60/61/44 1280px đã xem.

## Bảng tổng hợp

| ID | File | Kiểm chứng |
|---|---|---|
| BE-01 | `features/reports/report-source.reader.ts` (đọc phiên bản theo quyền + phạm vi; bỏ bản sao đề xuất và bản đính chính chưa ban hành) | e2e |
| BE-02/03 | `report-calculations.ts` `compareVersions`; `GET /reports/program-comparison` (+ `/export`) — `report.benchmark` | unit + e2e |
| BE-04 | `creditDistribution`; `GET /reports/credit-distribution` (+ `/export`) | unit + e2e |
| BE-05 | `change-request-statistics.service.ts`; `GET /reports/change-request-statistics` — `changeRequest.statistics`, R3/R4 theo phạm vi | unit + e2e |
| BE-06/07 | `report-workbooks.service.ts`; `GET /reports/versions/:id/matrices/export`, `/accreditation/export` — `report.exportAccreditation` | e2e |
| FE-01..06 | `features/reports/*` (4 trang, `VersionPicker`), `routes.ts`, `router.tsx`, `menuItems.tsx` (nhóm "Báo cáo"), `prefetchRoute.ts`, `permissions.ts` | vitest 5/5 |

## Quyết định trong lúc build (lệch so với plan)

- **Đồng bộ thay vì hàng đợi.** Plan đề xuất xuất qua BullMQ và bảng `ReportExport` lưu bản ghi hoàn tất (US-108 AC4). Bản build tạo file ngay trong yêu cầu (vài trăm dòng mỗi phiên bản, dưới 1 giây trên dữ liệu thật) và **không** lưu bản ghi hoàn tất. Nếu Khoa cần lịch sử xuất hồ sơ, thêm bảng và hàng đợi ở bước sau — đã ghi vào cổng mở.
- **Hồ sơ chỉ lập cho phiên bản đã ban hành** (Chờ hiệu lực/Đang hiệu lực/Lịch sử) và **bị chặn** (`409 REPORT_GRADING_UNAVAILABLE`, `details[].field` = mã học phần) khi có dòng chưa ghim đề cương ban hành hoặc đề cương chưa có thành phần đánh giá — hồ sơ thiếu không được trông như đủ.
- **Tương đương**: cùng `courseId` là học phần chung; hai học phần khác nhau cùng một nhóm tương đương ghép cặp theo thứ tự mã học phần ở mỗi bên; phần dư là riêng.
- **Phân bổ**: mọi dòng được tính một lần ở mỗi bảng (khối/học kỳ/loại), tổng mỗi bảng = `allRows`. Tối thiểu nhóm tự chọn chỉ cộng vào "yêu cầu tốt nghiệp", không chia vào học kỳ (BR-04). Nhóm thiếu tối thiểu → `requiredIsPartial`.
- **Thời gian xử lý**: một lượt = một cấp đã ra quyết định trong một vòng nộp; bắt đầu khi vòng được nộp (cấp đầu) hoặc khi cấp trước quyết định; kết thúc ở lần trả lại/từ chối đầu tiên, nếu không thì lần duyệt cuối. Cấp bỏ qua, cấp còn người song song đang chờ, `updatedAt` không được dùng.
- **Mẫu tổng quát**: trang `ThongTin` ghi rõ "Mẫu tổng quát — chưa phải biểu mẫu chính thức". Biểu mẫu chính thức của Trường là cổng Khoa.

## Cổng còn mở (cần Khoa)

- E1: biểu mẫu hồ sơ kiểm định chính thức (cột, thứ tự trang).
- E2: có cần lưu lịch sử các lần xuất hồ sơ (US-108 AC4) không.
- E3: dữ liệu thật — các học phần chưa có thành phần đánh giá nên hồ sơ của mọi phiên bản thật hiện đều bị chặn; khối kiến thức chưa được gán cho dòng của dữ liệu nhập.
