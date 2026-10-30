# Cụm F — Đề xuất thay đổi, phê duyệt, thông báo

Mode: Operate. Flows unchanged; only the order and the page frame change.

## What changed

| Screen | Change |
|---|---|
| Every page | `PageHeader`, `PageSkeleton`, Alert `title=` |
| `ChangeRequestDetailPage` | `BackLink` "Về danh sách" above the header; the status tag sits in the title. Order: conflicts → **ApprovalPanel** → approval progress → diff → request info → release → history → documents → comments. The approver lands on the decision, then reads what is being decided |
| `ApprovalQueuePage` | `SummaryStrip` "Tóm tắt hàng chờ": total, one count per level, longest wait. Filter in `FilterBar`. "Thay mặt" empty shows "Chính mình" |
| `ChangeRequestListPage` | `DataTable` (shows the total); "Số ngày chờ" empty shows "Không chờ". The two create buttons stay separate: they need different permissions, so merging them into a dropdown would hide one for most users |
| `FinalApprovalPage` | `BackLink` to the request; new `FinalApprovalPage.test.tsx` (back link, approve after confirm, stale blocks, unreadable preview) |
| `NotificationsPage` | List without border; subtitle with the total (and "chưa đọc" when filtered) |

## Checks

- vitest change-requests + notifications: 78 passed
- Playwright f-13 + f-14: 68 passed
- detector: 0 findings
