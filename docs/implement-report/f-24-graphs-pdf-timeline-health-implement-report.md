# F-24 — Báo cáo triển khai

## Trạng thái (viết lại khi có tiến độ mới)

- **Đến đâu (2026-10-31)**: đồ thị học phần (MH-20), xuất PDF chương trình qua hàng đợi (US-111), dòng thời gian phiên bản (MH-46), bảng sức khỏe chương trình (MH-28) đã có mã và test. Nhánh `feat/f-24-graphs-pdf-timeline-health`.
- **Không migration.** Gói mới: `puppeteer` (backend, render PDF), `@antv/g6` 5.0.51 ghim cứng (frontend, vẽ đồ thị). Font Roboto (OFL) nằm trong `source/backend/assets/fonts/` và được nhúng vào HTML, không tải từ mạng.
- **Bằng chứng**:
  - BE e2e `test/publication.e2e-spec.ts` 4/4: đồ thị theo học kỳ và 404 khi phiên bản thuộc chương trình khác; dòng thời gian có lịch gán khóa; sức khỏe đủ 9 nhóm và đều đã chạy; PDF chạy thật qua worker (QUEUED → READY, file bắt đầu `%PDF-`), người khác hỏi trạng thái/tải file đều 404.
  - BE unit `features/publication/publication.spec.ts` 3/3: chiếu đồ thị (bỏ quan hệ thay thế, học phần ngoài khung là nút riêng), thứ tự sự kiện, thoát HTML và dấu "BẢN NHÁP" của mẫu PDF.
  - FE vitest `features/publication` 6/6; `tsc -b` 0; oxlint sạch (BE và FE).
  - Chạy thử trên `ctdt_real` bằng `ui.viewer`, CNTT-CN-ATTT phiên bản 3.0: đồ thị 64 nút / 52 cạnh (học trước 40, tiên quyết 1, song hành 11), chọn "Cấu trúc dữ liệu" hiện đúng chuỗi trước/sau; dòng thời gian 3 phiên bản với K2022/K2023; sức khỏe 64 lỗi / 73 cảnh báo (thiếu đề cương 64, phủ PLO 64, tín chỉ 1, khác 8); nút "Xuất PDF" tải về `CTDT-CNTT-CN-ATTT-v3.0.pdf`. Ảnh 1440/1280px đã xem; ảnh PDF đã xem (tiếng Việt, dấu nháp).

## Bảng tổng hợp

| ID | File | Kiểm chứng |
|---|---|---|
| BE-01 | `features/publication/publication.{constants,errors,dto}.ts`, `publication-source.reader.ts` (đọc phiên bản theo `program.view` + phạm vi; 404 cho sai chương trình, bản sao đề xuất, bản đính chính chưa ban hành) | e2e |
| BE-02 | `toCourseGraph`; `GET /programs/:programId/versions/:versionId/course-graph` | unit + e2e |
| BE-03 | `version-timeline.reader.ts`; `GET /programs/:programId/version-timeline` (`version.viewHistory` và `program.view`) | unit + e2e |
| BE-04 | `program-health.service.ts` (gom bộ kiểm tra nhất quán, khoảng trống chuẩn đầu ra, CLO chưa đánh giá, học phần ngừng mở); `GET .../health` | e2e |
| BE-05 | `pdf/program-pdf.template.ts`, `pdf/pdf-renderer.service.ts` (một trình duyệt dùng lại, tắt JavaScript, chặn mọi yêu cầu không phải `data:`) | unit + e2e |
| BE-06 | `pdf/program-pdf-exports.service.ts`, `pdf/program-pdf.processor.ts` (BullMQ `program-pdf`, chạy lần lượt, hết hạn sau 1 giờ) | e2e |
| BE-07 | `publication.controller.ts`, `publication.module.ts`, `app.module.ts`, `env.validation.ts` (`PDF_BROWSER_PATH` tùy chọn) | e2e |
| FE-01 | `features/publication/{api,hooks}` | vitest |
| FE-02 | `pages/CourseGraphPage.tsx`, `components/CourseGraphCanvas.tsx` (G6, tải lười), `graph/courseGraphLayout.ts` | vitest + ảnh |
| FE-03 | `pages/ProgramHealthPage.tsx` (lọc theo nhóm, liên kết "Sửa ở") | vitest + ảnh |
| FE-04 | `pages/VersionTimelinePage.tsx` | vitest + ảnh |
| FE-05 | `components/PdfExportButton.tsx` trên trang phiên bản, đồ thị và sức khỏe; `routes.ts`, `router.tsx`, `ProgramSectionLinks.tsx`, `VersionDetailPage.tsx` | vitest + thử tay |

## Quyết định trong lúc build (lệch so với plan)

- **Không thêm quyền mới.** Plan D7 đề xuất `program.exportPdf` và `program.viewHealth`. Danh mục quyền đang cố định ở 43 mã chuẩn (spec kiểm tra độ dài), nên bản build dùng lại `program.view` cho đồ thị, sức khỏe và PDF, và `version.viewHistory` cho dòng thời gian. Sức khỏe chỉ chẩn đoán, không chặn thao tác; PDF chỉ chứa dữ liệu người xem đã thấy được. Nếu Khoa muốn tách quyền, thêm hai mã và đổi decorator ở `publication.controller.ts`.
- **PDF chụp dữ liệu lúc yêu cầu.** Ảnh chụp (snapshot) được lấy trong request POST bằng một truy vấn duy nhất, nên không cần giao dịch RepeatableRead. Worker chỉ render ảnh chụp đó và không đọc lại CSDL. Bản Nháp có dấu "BẢN NHÁP" trên mọi trang.
- **Worker không kiểm tra lại quyền.** Plan BE-06 muốn worker nạp lại quyền của chủ job trước khi render. Bản build kiểm tra quyền khi tạo job, kiểm tra chủ sở hữu khi hỏi trạng thái, và kiểm tra lại phạm vi chương trình khi tải file. Như vậy người bị thu hồi quyền trong lúc job chạy vẫn không tải được file.
- **Đồ thị bố cục cố định.** Mỗi học kỳ là một cột, các học phần điều kiện ngoài khung nằm ở cột đầu, thứ tự trong cột theo khung. Không kéo/thu phóng: khung cuộn ngang để tiêu đề cột luôn khớp. Chuỗi phụ thuộc đi theo học trước/tiên quyết; song hành chỉ hiện quan hệ trực tiếp. Danh sách dưới đồ thị mang cùng thông tin cho bàn phím và trình đọc màn hình.
- **Liên kết sửa lỗi.** Mỗi vấn đề có `target`; lỗi đề cương mở trang đề cương học phần, lỗi ngừng mở mở trang học phần (thêm `courseId` vào `HealthIssueDto`).
- **Triển khai cần Chrome.** `pnpm install` không tự tải trình duyệt. Chạy `pnpm exec puppeteer browsers install chrome` trên máy chủ, hoặc đặt `PDF_BROWSER_PATH` trỏ tới Chrome/Chromium có sẵn. Khi chạy trong container không có sandbox, đặt `PDF_BROWSER_NO_SANDBOX=true` (mặc định `false`; thêm 2026-11-01).

## Cổng còn mở (cần Khoa)

- E1: mẫu PDF chính thức của Trường (bản hiện tại ghi rõ "Bản in tổng quát … không phải biểu mẫu quyết định chính thức").
- E2: có cần tách quyền xuất PDF và xem sức khỏe khỏi quyền xem chương trình không (xem D7).
- E3: dữ liệu thật — 64 học phần của CNTT-CN-ATTT chưa có đề cương và chưa đóng góp PLO, nên bảng sức khỏe hiện đầy lỗi; đây là dữ liệu, không phải lỗi phần mềm.
