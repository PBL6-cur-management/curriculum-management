# Cụm G — Phiên bản, ban hành, học kỳ và khóa

Mode: Operate. Flows unchanged.

| Screen | Change |
|---|---|
| Every page | `PageHeader`, `PageSkeleton`, `BackLink` (8 pages wrote "← X" by hand) |
| `VersionDetailPage` | Major and credit line becomes a `SummaryStrip` (ngành, số học kỳ, tổng/bắt buộc/tự chọn tín chỉ). The six screen links become one labelled nav row "Xem:" right above `FrozenRowsTable`. The correction action sits alone in the header |
| `CorrectionPage` | The issue form comes before the frozen rows; the edit links are a labelled nav row "Sửa:" |
| `InitialReleasePage` | Kept the check panel above the form: it is the gate (blockers disable release), so the author must read it first |
| `SemestersPage` | "Gán phiên bản cho khóa" is the primary action in the header |
| `VersionHistoryPage` | Empty cells say what they mean: "Chưa có", "Chưa gán", "Ban hành trực tiếp", "Không" |

Checks: vitest releases 68 passed; Playwright f-15 + f-16 46/47. The failing test is F16-TC_014, which also fails on main when repeated: after the 409 the confirm button stays loading. Logged in docs/progress for the final run. The e2e fixture `attachPublishedFile` now picks "Loại tài liệu" before uploading, as the form requires.
