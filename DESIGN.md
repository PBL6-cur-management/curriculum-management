---
name: Quản lý Chương trình đào tạo
description: Công cụ vận hành dày đặc, sáng, cùng ngôn ngữ thị giác với hệ thống chuẩn đầu ra của Trường (chuandaura.dut.udn.vn).
colors:
  primary: "#0071a6"
  primary-strong: "#005b86"
  primary-soft: "#e6f1f7"
  header-from: "#1e40af"
  header-to: "#2563eb"
  ink: "#1e293b"
  ink-nav: "#334155"
  ink-muted: "#64748b"
  ink-faint: "#94a3b8"
  border: "#cbd5e1"
  divider: "#e2e8f0"
  fill: "#f1f5f9"
  canvas: "#f8fafc"
  surface: "#ffffff"
  pass: "#059669"
  pass-strong: "#047857"
  pass-soft: "#ecfdf5"
  fail: "#ef4444"
  fail-strong: "#b91c1c"
  fail-soft: "#fef2f2"
  warn: "#d97706"
  warn-soft: "#fffbeb"
  info: "#1d4ed8"
  info-soft: "#eff6ff"
typography:
  heading-1:
    fontFamily: "Roboto Variable, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.5
  page-title:
    fontFamily: "Roboto Variable, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.5
  section-title:
    fontFamily: "Roboto Variable, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Roboto Variable, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Roboto Variable, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  page-x: "32px"
components:
  app-header:
    backgroundColor: "{colors.header-from}"
    textColor: "{colors.surface}"
    height: "64px"
    padding: "0 24px"
  logo-square:
    backgroundColor: "{colors.surface}"
    size: "44px"
  nav-item:
    textColor: "{colors.ink-nav}"
    rounded: "{rounded.md}"
    height: "38px"
  nav-item-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-strong}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "36px"
  table-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    padding: "10px 12px"
  table-row-selected:
    backgroundColor: "{colors.primary-soft}"
  tag-default:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink-nav}"
    rounded: "{rounded.xs}"
---

# Design System: Quản lý Chương trình đào tạo

## Overview

**Creative North Star: "Hồ sơ của Trường"** (the school's own paperwork, made tidy)

Đây là công cụ vận hành cho sáu vai trò cán bộ và sinh viên của Trường Đại học Bách khoa, dùng trên máy văn phòng (từ 1280 px), thường mở cạnh Excel và công văn. Hệ thống thị giác không tự tạo bản sắc: nó nối tiếp hệ thống chuẩn đầu ra của Trường (chuandaura.dut.udn.vn) để cán bộ không phải học lại. Cùng xanh thương hiệu, cùng chữ Roboto, cùng thanh đầu trang gradient xanh với logo DUT trong ô vuông trắng.

Mật độ cao nhưng quét được: bảng là bề mặt chính, nền xám-xanh rất nhạt, thẻ trắng, đường kẻ mảnh. Màu chỉ mang nghĩa (thương hiệu, trạng thái); độ sâu gần như phẳng. Chỉ có chế độ sáng. Giao diện hoàn toàn tiếng Việt.

Nguồn token duy nhất là `source/frontend/src/shared/design-system/tokens.ts` và `theme.ts` (AntD 6, `cssVar` prefix `ctdt`). Giá trị trong frontmatter phản chiếu hai file này.

**Key Characteristics:**
- Một màu thương hiệu xanh dương (`primary`) cho hành động, liên kết, vùng chọn; xanh đậm hơn (`primary-strong`) cho hover và mục điều hướng đang chọn.
- Chữ Roboto Variable 14 px làm nền; tiêu đề 600, không có display font.
- Bán kính 4 / 6 / 8 / 12; điều khiển cao 36 px.
- Trạng thái luôn có hình hoặc chữ đi kèm màu, không bao giờ chỉ màu.
- Chuyển động 120-200 ms, một easing.

## Colors

Bảng màu hẹp: một xanh thương hiệu, gradient xanh cho thanh đầu trang, thang slate cho mọi chữ và bề mặt, bốn màu ngữ nghĩa.

### Primary
- **Xanh Bách khoa** (`primary`): nút chính, liên kết, focus ring, dấu "trực tiếp" trong ma trận quyền.
- **Xanh Bách khoa đậm** (`primary-strong`): hover của liên kết, chữ mục menu đang chọn, tab/segmented đang chọn.
- **Xanh sương** (`primary-soft`): nền mục menu đang chọn, hàng bảng được chọn, dòng thay đổi chưa áp dụng trong drawer.

### Secondary
- **Gradient đầu trang** (`header-from` đến `header-to`, trái sang phải): chỉ dùng cho thanh đầu trang của app. `header-from` cũng là `headerBg` của Layout.

### Neutral
- **Mực slate** (`ink`): chữ chính và tiêu đề. `ink-nav` cho mục menu và nhãn form; `ink-muted` cho chữ phụ, tiêu đề cột bảng; `ink-faint` cho chữ bậc ba và biểu tượng khóa.
- **Viền** (`border`) cho điều khiển; **đường kẻ** (`divider`) cho phân cách bảng, sider, hàng drawer.
- **Nền trang** (`canvas`), **nền điền** (`fill`, hover menu, Tag mặc định), **bề mặt** (`surface`, thẻ, sider, drawer).

### Semantic
- **Đạt** (`pass`, `pass-strong`, `pass-soft`), **Lỗi** (`fail`, `fail-strong`, `fail-soft`), **Cảnh báo** (`warn`, `warn-soft`), **Thông tin** (`info`, `info-soft`). Ánh xạ vào `colorSuccess/Error/Warning/Info` của AntD. Trong ma trận quyền, `warn` đánh dấu đường "qua đề xuất".

### Named Rules
**The Tokens-Only Rule.** Không hardcode hex trong component. Màu đi qua `palette` (tokens.ts) hoặc token AntD (`theme.useToken()`).

**The Never-Color-Alone Rule.** Mọi trạng thái, phạm vi, khóa phải đọc được khi không thấy màu: có hình dạng, chữ ngắn hoặc biểu tượng đi kèm (PRODUCT.md: WCAG 2.1 AA).

**The Meaning-Only Rule.** Xanh thương hiệu và bốn màu ngữ nghĩa mang nghĩa; không dùng để trang trí.

## Typography

**Display Font:** không có. **Body Font:** Roboto Variable (dự phòng ui-sans-serif, system-ui, Segoe UI, sans-serif). **Mono:** ui-monospace, SFMono-Regular, Menlo, Consolas (đã khai báo `fontFamilyCode`).

**Character:** Roboto là chữ của hệ thống chuẩn đầu ra; giữ nguyên để hai hệ thống nhìn như một. Thứ bậc đến từ cỡ và độ đậm 600, không từ đổi họ chữ.

### Hierarchy
- **Heading 1** (600, 24 px, 1.5): token có sẵn, chưa dùng ở trang nào.
- **Page title** (600, 20 px, 1.5): `PageHeader` render `Typography.Title level={2}`, mỗi trang một tiêu đề.
- **Section title** (600, 16 px, 1.5): tiêu đề Card, tên ứng dụng trên đầu trang (16 px, trắng).
- **Group title** (600, 14 px): `Title level={5}` trong drawer, tiêu đề nhóm chức năng.
- **Body** (400, 14 px, 1.5): bảng, form, đoạn văn. Số trong bảng, Statistic, Descriptions dùng `tabular-nums` (lớp `.tabular` cho chỗ khác).
- **Label** (400, 12 px): mã quyền dưới tên quyền, chữ ngắn trong ô ma trận, dòng phụ trên đầu trang (trắng 85%).

### Named Rules
**The Fourteen Floor Rule.** Nội dung đọc chính không nhỏ hơn 14 px; 12 px chỉ cho mã, nhãn phụ và chữ ngắn đi kèm biểu tượng.

**The Tabular Rule.** Cột số, điểm, tín chỉ dùng chữ số thẳng cột.

## Layout

Khung kinh điển: thanh đầu trang dính cao 64 px; sider trắng rộng 248 px dính dưới đầu trang, ẩn hẳn dưới breakpoint `lg`; vùng nội dung nền `canvas`, đệm `24px 32px 48px`. Mỗi trang có Suspense riêng với skeleton, không thay cả layout bằng spinner. Điều khiển cao 36 px (nhỏ 28, lớn 44). Nhịp dọc giữa khối: 16 px (`PageHeader`, Flex `middle`) đến 20-24 px. Trang chi tiết giới hạn rộng 1200 px; trang bảng (ma trận quyền) dùng hết chiều rộng và cuộn ngang trong bảng với cột đầu cố định.

Ô bảng đệm 10 px dọc, 12 px ngang. Thanh lọc nằm ngay dưới tiêu đề trang, trên bảng.

## Elevation & Depth

Gần như phẳng: thẻ và bảng phân tầng bằng viền mảnh (`divider`) trên nền `canvas`, không bóng. Bóng chỉ cho thứ nổi thật.

- **Floating** (`box-shadow: 0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.06)`): token `boxShadow`, dropdown nhỏ.
- **Overlay** (`0 10px 15px -3px rgba(15,23,42,0.10), 0 4px 6px -4px rgba(15,23,42,0.08)`): token `boxShadowSecondary`, modal, popover.
- **Header** (`0 4px 6px -1px rgba(15,23,42,0.18)`): riêng thanh đầu trang dính.
- Nút không có bóng (`primaryShadow`, `defaultShadow` = none).

**The Flat-Until-Floating Rule.** Bề mặt tĩnh không bóng; bóng chỉ cho thanh dính và lớp phủ.

## Shapes

Góc bo vừa phải, thân thiện nhưng nghiêm túc: 4 px (Tag, ô nhỏ), 6 px (phần tử nhỏ), 8 px (nút, input, mục menu, dòng đã đổi), 12 px (Card, modal lớn). Viền 1 px slate. Ngoại lệ có chủ ý: ô vuông trắng 44 px đựng logo DUT trên đầu trang không bo góc, theo hệ thống chuẩn đầu ra (logo 36 px bên trong).

### Ma trận quyền: mã hóa bằng hình dạng và chữ
Mỗi ô là một dấu 10 px + chữ ngắn 12 px, đọc được không cần hover.
- **Chế độ**: hình tròn = trực tiếp (DIRECT, màu `primary`); hình thoi (ô vuông xoay 45 độ) = qua đề xuất (VIA_REQUEST, màu `warn`).
- **Phạm vi**: đặc = toàn bộ (ALL); rỗng viền 2 px = theo phạm vi (SCOPED).
- **Chữ ngắn**: "Toàn bộ", "Phạm vi", "Đề xuất", "Đề xuất · phạm vi". Không có quyền: chữ phụ "Không" (nhãn đầy đủ trong `aria-label`).
- **Khóa**: biểu tượng ổ khóa 12 px (`ink-faint`) sau chữ, lý do trong `aria-label`/tooltip. Chú giải `MatrixLegend` luôn hiện trên bảng.

## Components

### Buttons
- **Shape:** bo 8 px, cao 36 px, chữ 500. Không bóng.
- **Primary:** nền `primary`, chữ trắng; một nút chính cho mỗi vùng (ví dụ "Áp dụng thay đổi").
- **Text/link:** nút `type="text"` chữ trắng trên đầu trang; `type="link"` nhỏ trong tiêu đề cột ("Sửa quyền").
- **Focus:** viền 2 px `primary`, offset 2 px (`:focus-visible` toàn cục).

### Tags / Status
- `StatusTag` bọc `Tag` của AntD; nền mặc định `fill`, chữ `ink-nav`, màu ngữ nghĩa qua `colorMap` theo enum. Luôn có nhãn chữ tiếng Việt.

### Cards / Containers
- Nền `surface`, bo 12 px, viền mảnh, không bóng; tiêu đề 16 px (14 px ở cỡ nhỏ), đệm 20 px.

### Tables
- Tiêu đề cột nền `canvas`, chữ `ink-muted`, không vạch dọc; hover hàng `canvas`; hàng chọn `primary-soft`. Phân trang `showTotal` "N kết quả". Bảng nhiều nhóm dùng `Collapse` với thân đệm 0 và bảng bên trong (ma trận quyền: nhóm đầu mở sẵn, mở hết khi đang lọc).

### Inputs / Fields
- Form dọc, nhãn `ink-nav`, khoảng cách mục 16 px. Ô tìm kiếm `Input.Search` rộng 300 px với `allowClear`. Công tắc nhỏ kèm nhãn chữ.

### Navigation
- Menu inline trong sider trắng: mục cao 38 px, bo 8 px, lề ngang 8 px, chữ `ink-nav`; hover `fill`; chọn: nền `primary-soft`, chữ `primary-strong`. Tiêu đề nhóm 12 px `ink-muted`. Menu lọc theo quyền và vai trò của người dùng.
- Đầu trang: gradient xanh, logo DUT trong ô trắng 44 px, hai dòng chữ trắng (12 px dòng đơn vị 85%, 16 px tên ứng dụng 600), chuông thông báo và menu người dùng bên phải.

### Drawer chỉnh quyền vai trò (signature)
Drawer 720 px, tiêu đề "Quyền của {mã} · {tên}". Nhóm chức năng với tiêu đề cấp 5; mỗi quyền một dòng (tên + mã 12 px bên trái, `Segmented` nhỏ bên phải với đúng bốn nhãn ngắn của ô và "Không"). Dòng đã sửa nền `primary-soft` và bo 8 px. Dòng khóa hiện ổ khóa, trạng thái hiện tại và "đã khóa", không có điều khiển. Chân drawer: số thay đổi chưa áp dụng bên trái, "Hủy" và "Áp dụng thay đổi" (disabled khi chưa có thay đổi) bên phải. Áp dụng qua hộp xác nhận liệt kê từng thay đổi "cũ → mới" và nêu hiệu lực ngay.

### Motion
Thời lượng 120 / 160 / 200 ms (fast/mid/slow), một easing `cubic-bezier(0.4, 0, 0.2, 1)`. Không gắn keyframe lên component AntD (chạy hai lần gây nháy). `prefers-reduced-motion` ép về ~0 ms.

## Do's and Don'ts

### Do:
- **Do** lấy mọi màu từ `palette` hoặc token AntD; thêm màu mới vào `tokens.ts` trước.
- **Do** ghép màu trạng thái với hình dạng, chữ hoặc biểu tượng.
- **Do** dùng component AntD trực tiếp; chỉ tạo component dùng chung khi mẫu lặp từ hai lần (xem `DESIGN_SYSTEM.md` ở `shared/design-system`).
- **Do** viết chữ giao diện tiếng Việt, cụ thể và có thể hành động ("Chưa có thành viên nào", "Thêm tài khoản").
- **Do** giữ trạng thái, phạm vi và lý do khóa hiển thị mà không cần hover.
- **Do** chỉ dùng chế độ sáng.

### Don't:
- **Don't** thêm display font hay họ chữ thứ hai; Roboto là chữ của Trường.
- **Don't** chồng animation tự viết lên component AntD (lỗi "nháy hai lần").
- **Don't** thêm bóng lên thẻ, nút hoặc bề mặt tĩnh.
- **Don't** dùng gradient ngoài thanh đầu trang.
- **Don't** thêm chế độ tối hoặc bảng màu thứ hai.
- **Don't** bỏ quy ước đầu trang (logo DUT trong ô vuông trắng, gradient xanh) khi thêm khung trang mới.

### Not canonized (defects the build carries)
- `AppLayout.tsx` hardcode bóng đầu trang và `MatrixCell.tsx` hardcode kích thước dấu (10 px) và `rotate(45deg) scale(0.85)` inline; giá trị bóng đầu trang được ghi ở trên vì dùng thật, nhưng cách viết inline không phải mẫu để lặp.
- `warn` (`#d97706`) trên nền trắng khoảng 3.2:1: đạt cho dấu hình khối có chữ đi kèm, không dùng làm màu chữ.
- `ListPageLayout` dùng `Space direction` (API cũ của AntD 6); `EmptyState`/`PageHeader` chưa dùng token spacing.
