# UI/UX Rules — Frontend (Impeccable + Ant Design 6)

Áp dụng cho mọi thay đổi trong `source/frontend` có chạm tới thứ người dùng nhìn thấy.

## Nguồn sự thật

- `PRODUCT.md` (gốc repo) — người dùng, mục đích, nguyên tắc sản phẩm.
- `DESIGN.md` (gốc repo) — hệ hình ảnh: màu, chữ, khoảng cách, component, motion.
- Hệ hình ảnh được **ghim** theo hệ thống chuẩn đầu ra của Trường (`chuandaura.dut.udn.vn`): brand `#0071a6`, Roboto Variable, thang slate, header gradient xanh có logo DUT. Không tự đổi sang hướng khác.
- Token code: `src/shared/design-system/tokens.ts` → `theme.ts`. Không hardcode hex trong component.

## Quy trình bắt buộc (plugin `impeccable`)

1. Màn hình/luồng mới: `/impeccable shape <màn hình>` trước khi code.
2. Trước bất kỳ sửa UI nào: đọc `craft-floor.md` của skill Impeccable (skill tự nạp).
3. Hook detector đang bật (`.impeccable/config.json`): xử lý mọi phát hiện ngay, không để dồn.
4. Trước khi mở PR có UI: `/impeccable polish <target>` rồi `/impeccable audit <target>`; detector phải sạch.
5. Thay đổi hệ thống (token, component dùng chung): cập nhật `DESIGN.md` qua `/impeccable document` hoặc `extract`.

## Mode

Toàn bộ app là **Operate**: quen thuộc, chính xác, tiết chế. Bảng là bề mặt chính. Motion 120–200 ms, chỉ để báo trạng thái.

## Bắt buộc / cấm (bổ sung cho craft-floor)

- Không gắn keyframe CSS lên component AntD (AntD có motion riêng → nháy hai lần).
- Không spinner toàn trang khi chuyển route; dùng skeleton đúng hình dạng trang.
- Trạng thái, phạm vi, lý do khóa phải đọc được không cần hover; không mã hóa trạng thái chỉ bằng màu.
- Không eyebrow/kicker trên heading, không card icon+tiêu đề+mô tả lặp, không gradient text, không border-left màu dày.
- Query danh sách dùng `placeholderData: keepPreviousData`; bảng không được trắng khi đổi filter.
- Copy tiếng Việt hành chính, cụ thể: nút = động từ + danh từ; lỗi nêu vấn đề và cách khắc phục; empty state chỉ hành động tiếp theo.

## Component dùng chung

Dùng `src/shared/design-system/` trước khi tạo mới (catalog: `DESIGN_SYSTEM.md`). Pattern lặp ≥ 2 lần thì đưa vào đó.
