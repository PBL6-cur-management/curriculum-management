# Kế hoạch triển khai — Cải tổ UI theo Impeccable

Nguồn: plan đã duyệt ngày 2026-10-30. Hình ảnh ghim theo chuandaura.dut.udn.vn; chi tiết trong `/DESIGN.md`, bối cảnh sản phẩm trong `/PRODUCT.md`.

## Đã xong

| Giai đoạn | Nhánh / PR | Nội dung |
|---|---|---|
| 0 | `chore/remove-school-dump` / #2 | Gỡ dump trường khỏi git (commit mới), gitignore thư mục dữ liệu riêng |
| 1 | `chore/impeccable-setup` / #3 | PRODUCT.md, cấu hình và hook Impeccable, token/theme theo chuandaura, font Roboto, header gradient + logo, rule UI, xóa skill mâu thuẫn |
| 2 | #3, #5 | Bỏ keyframe chồng AntD, Suspense theo route + skeleton, `staleTime` 30s, đã kiểm trên `vite preview` (xem `docs/design/ui-audit-baseline.md`) |
| 3 | `feat/permission-matrix-redesign` / #4 | Ma trận đọc không cần hover, nhóm thu gọn, tìm kiếm, lọc khác biệt, drawer soạn theo vai trò, một lần xác nhận |
| 4A | `fix/ui-flicker-perf` / #5 | Menu theo nhiệm vụ, trang chính có lối tắt theo quyền, DESIGN.md |

## Chưa có kế hoạch chi tiết (cần người dùng)

- **Giai đoạn 4, cụm B–H:** với từng màn hình cần biết nhiệm vụ chính của người dùng, dữ liệu ưu tiên hiển thị và thao tác hay dùng, trước khi chạy `/impeccable shape`/`critique`.
- **Giai đoạn 5, seed dữ liệu thật:** ánh xạ từng bảng dump → model Prisma, cách đọc stream file điểm 160 MB, tách tài khoản e2e khỏi seed thật.
- **Giai đoạn 6, Taiga:** biến môi trường `TAIGA_USERNAME`/`TAIGA_PASSWORD`, slug project, duyệt bảng phân công.

## Kiểm tra mỗi PR UI

`pnpm exec tsc -b`, `pnpm lint`, `pnpm test`, detector Impeccable sạch (hoặc ngoại lệ có ghi lý do), ảnh chụp 1440 px.
