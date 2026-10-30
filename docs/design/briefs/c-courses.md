# Cụm C — Học phần, nhóm tương đương

Mode: Operate. Flows unchanged.

| Screen | Change |
|---|---|
| `CourseListPage` | `PageHeader`; pagination shows "N học phần"; empty owner group reads "Chưa gán". Kept AntD `Table`, not `DataTable`: the list sorts on the server through the table's sorter, which `DataTable` does not carry |
| `CourseDetailPage` | `BackLink` "Danh mục học phần"; actions sit directly in the header. No `SummaryStrip`: the info card already holds credits, unit and status right below, so a strip would only repeat them |
| `CourseFormPage` | `PageHeader`, `PageSkeleton` |
| `EquivalenceGroupsPage` | Empty note reads "Không có". The 4 row buttons stay: e2e specs and keyboard users reach each by name, and a dropdown would hide the destructive one behind a menu |

Real-data test fixes: the faculty pickers search before choosing (the org tree is longer than the virtual list's first screen), and the catalog filter tests search by code because real courses fill several pages.

Checks: vitest courses + equivalence 48 passed; Playwright f-04 + f-05 93 passed after the fixture fix.
