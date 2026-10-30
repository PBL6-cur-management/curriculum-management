# Cụm B — Quản trị

Mode: Operate. Flows unchanged.

| Screen | Change |
|---|---|
| `OrgUnitTreePage` | `PageHeader` "Đơn vị" with "Thêm đơn vị" replaces the left Card's title |
| `SubjectGroupListPage` | `PageHeader` "Nhóm chuyên môn" with "Thêm nhóm" replaces the Card title |
| `HealthPage` | `PageHeader` with "Kiểm tra lại" above the status card |
| `AccountPage` | `PageHeader` "Tài khoản của tôi"; the info card is "Thông tin tài khoản"; missing email reads "Chưa có" |
| `UserListPage` | Unit not set reads "Chưa gán" |
| `UserDetailPage`, `SubjectGroupDetailPage`, `OrgUnitTreePage` | `PageSkeleton` |
| `LoginPage` | Unchanged; it already follows the tokens |

Not done: merging the two add-member buttons on `SubjectGroupDetailPage`. They open different forms (member vs coordinator) with different permissions, so one button with a role choice adds a step without saving one.

E2E fixes for older UI changes: the header logo is also a "Trang chính" link; the account button's name ends with the caret icon's label; real org-tree nodes carry their type tag.

Checks: vitest 30 passed; Playwright f-01..f-03 68 passed.
