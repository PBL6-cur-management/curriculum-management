# UI audit after Phase 4 — 2026-10-31

Measured after the seven screen clusters (D, E, F, G, C, H, B; PRs #8–#14, #16, #19–#23). Compare with `ui-audit-baseline.md`.

## Detector (`impeccable detect --json source/frontend/src`)

Same as the baseline: 1 warning, 0 errors. The only finding is the accepted blockquote rule in `shared/components/rich-text/RichText.module.css:19` (side-tab, neutral `colorBorder`, content styling inside the syllabus, not a card).

## Page frame (counted in `src/features/**/pages`)

| Pattern | Before Phase 4 | After |
|---|---|---|
| Pages using `PageHeader` | 15 | 45 |
| Hand-rolled `Typography.Title level={2}` page headers | 23 | 3 (nested section headers in panels, not page titles) |
| Card title used as the page header | 7 | 0 |
| Hand-written `← X` back links in pages | 10 | 0 (4 remain inside components) |
| Alert `message=` (deprecated in AntD 6) | 19 files | 0 |
| Bare `return <Skeleton active />` page loads | ~28 | 12 (in-panel loading states, not page loads) |

Literal `'—'` still appears in 42 component cells (tables inside shared components and panels). Pages now say what is missing ("Chưa có", "Chưa gán", "Không chờ", "Chính mình"…). The component cells are the next pass; they are asserted by many unit tests and change no flow.

## Per-cluster briefs

`docs/design/briefs/`: `d-programs.md`, `e-outcomes-syllabus.md`, `f-change-requests.md`, `g-releases.md`, `c-courses.md`, `h-students.md`, `b-admin.md`. Each lists what changed, what was deliberately kept, and the checks.

## Tests

Every cluster ran its vitest suite and the Playwright specs of its features on `ctdt_real`. Failures that also failed on main were logged, not hidden. They are listed in `docs/progress/progress_log.md` (2026-10-31) for the final full run.

## Visual check

Screens were checked by screenshot on the real data at 1280 px during the Playwright runs; a full 1440/1280 screenshot sweep as `ui.viewer` is part of the final verification.
