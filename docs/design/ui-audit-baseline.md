# UI audit baseline — 2026-10-30

Đo sau Giai đoạn 1–3 (PR #3, #4, #5). Dùng làm mốc để so với các cụm màn hình ở Giai đoạn 4.

## Detector Impeccable (`impeccable detect --json source/frontend/src`)

| Phát hiện | Vị trí | Xử lý |
|---|---|---|
| side-tab (border-inline-start 3px) | `shared/components/rich-text/RichText.module.css:19` | Chấp nhận: đây là blockquote trong nội dung đề cương, viền màu trung tính (`colorBorder`), không phải thẻ có sọc màu. |

Tổng: 1 cảnh báo, 0 lỗi.

Cùng lúc phát hiện `RichText.module.css` còn dùng biến `--ant-*`, trong khi theme đặt `cssVar.prefix = 'ctdt'`, nên các biến đó rỗng. Đã đổi sang `--ctdt-*`.

## Nháy (bản production, `vite preview`)

Đếm `document.getAnimations()` ngay sau mỗi tương tác:

| Tương tác | Kết quả |
|---|---|
| Mở Select | 1 keyframe `antSlideUpIn` cho dropdown (trước đây 2: AntD + `motion.css`) |
| Hover menu | Chỉ transition màu, không keyframe |
| Hover nút tài khoản | Chỉ transition `background-color` |
| Chuyển route | 0 spinner; mỗi route có Suspense riêng, fallback skeleton |

## Bundle (`pnpm build`)

Chunk lớn nhất: `SyllabusEditorPage` 481 kB (151 kB gzip, chứa tiptap, chỉ tải khi mở trình soạn đề cương), `client` 415 kB (139 kB gzip), `index` 250 kB. AntD đã tách theo component; không cần `manualChunks`.

## Hiện trạng theo cụm (đánh giá trực quan)

| Cụm | Trạng thái |
|---|---|
| Shell, trang chính, menu | Đã làm lại (PR #3, #5) |
| Ma trận quyền | Đã làm lại (PR #4) |
| B–H (quản trị, danh mục, CTĐT, CĐR/đề cương, đề xuất/duyệt, phiên bản, sinh viên) | Đã nhận theme mới qua token; bố cục, mật độ và copy chưa rà. Cần kế hoạch chi tiết từng cụm. |
