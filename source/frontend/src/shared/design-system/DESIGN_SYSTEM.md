# Design System: Component Catalog

Quy tắc thị giác (màu, chữ, bo góc, bóng, chuyển động, điều hướng) nằm ở **[/DESIGN.md](../../../../../DESIGN.md)**. Token nằm ở `tokens.ts` và `theme.ts` cùng thư mục. File này chỉ liệt kê component dùng chung.

Import từ `src/shared/design-system` (index.ts).

## Khi nào tạo component mới

1. AntD 6 có sẵn: dùng trực tiếp, không wrap.
2. Chưa có và mẫu lặp từ 2 lần trở lên: thêm vào thư mục này.
3. Còn lại: giữ inline.

## Catalog

| Component | Lớp | Dùng khi | Props chính |
|-----------|-----|----------|-------------|
| `StatusTag` | Molecule | Hiển thị enum trạng thái có màu | `status`, `colorMap`, `labelMap` |
| `PageHeader` | Molecule | Tiêu đề mọi trang (`Title level={2}` + nút bên phải) | `title`, `actions?` |
| `EmptyState` | Molecule | Danh sách rỗng, có thể kèm hành động tạo mới | `description`, `actionLabel?`, `onAction?` |
| `DataTable<T>` | Organism | Bảng có phân trang phía server | `columns`, `dataSource`, `total`, `page`, `pageSize?`, `loading?`, `emptyText?`, `onPageChange` |
| `DetailPageLayout` | Template | Trang chi tiết, nhiều Card xếp dọc (rộng tối đa 1200 px) | `children` |
| `ListPageLayout` | Template | Trang danh sách: header, bộ lọc, bảng | `header`, `filters`, `table` |

### StatusTag
```tsx
<StatusTag status={user.status} colorMap={USER_STATUS_COLORS} labelMap={USER_STATUS_LABELS} />
```
Màu không đứng một mình: luôn có nhãn chữ. Không viết `<Tag color=...>` inline cho enum trạng thái.

### PageHeader
```tsx
<PageHeader title="Tài khoản" actions={<Button type="primary">Thêm tài khoản</Button>} />
```

### EmptyState
```tsx
<EmptyState description="Chưa có thành viên nào" actionLabel="Thêm thành viên" onAction={open} />
```
Mô tả cụ thể ("Chưa có [đối tượng]"); nút là động từ + danh từ.

### DataTable
```tsx
<DataTable<UserSummary>
  rowKey="id" columns={columns} dataSource={data?.items ?? []}
  total={data?.total ?? 0} page={params.page} pageSize={params.pageSize}
  loading={isPending} emptyText="Chưa có tài khoản nào"
  onPageChange={(page, pageSize) => setParams((p) => ({ ...p, page, pageSize }))}
/>
```
Phân trang hiển thị "N kết quả". Bảng không phân trang phía server (ví dụ ma trận quyền) dùng `Table` của AntD trực tiếp.

### DetailPageLayout / ListPageLayout
```tsx
<DetailPageLayout><UserInfoCard /><RoleAssignmentsCard /></DetailPageLayout>

<ListPageLayout
  header={<PageHeader title="Tài khoản" actions={...} />}
  filters={<><Input.Search /><Select /></>}
  table={<DataTable ... />}
/>
```

## Checklist trước khi lưu UI

- Không hardcode hex; dùng `palette` hoặc token AntD.
- Trạng thái dùng `StatusTag`; trang danh sách dùng `DataTable`; tiêu đề dùng `PageHeader`.
- Chữ giao diện tiếng Việt, cụ thể (xem Do's and Don'ts trong DESIGN.md).
