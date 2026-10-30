# Cụm H — Sinh viên, nhập liệu, xét tốt nghiệp

Mode: Operate. Flows unchanged.

| Screen | Change |
|---|---|
| `StudentDetailPage` | Enrollment warnings and "Chưa xác định được chương trình" become one grouped warning (a list) instead of a stack of Alerts; filters sit in `FilterBar`; back link via `BackLink` |
| `GraduationBatchPage` | `BackLink` "Danh sách đợt xét" above the header; a `SummaryStrip` "Kết quả đợt xét" (sinh viên, lượt chương trình, đủ, chưa đủ, lỗi dữ liệu with tones) replaces two count rows of the Descriptions card. Processing progress stays in the card |
| `ImportDetailPage` | Back link above the header, not as a header action. Already covered by `ImportHistoryPage.test.tsx` |
| Imports, graduation tables | "—" replaced by "Không gắn chương trình", "Chưa xét", "Không lỗi", "Chưa có lần xét" |

Checks: vitest students + imports + graduation 110 passed. Playwright f-09 + f-17: 12 passed, 7 failed; the same failures happen on main (real-data and account differences), so they are logged for the final run, not caused here.
