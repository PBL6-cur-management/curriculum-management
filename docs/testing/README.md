# Testing Docs

> Bắt đầu ở [`setup-and-test-guide.md`](./setup-and-test-guide.md): cài đặt, kiểm thử tự động, thứ tự đi thử bằng trình duyệt cho bản MVP.

Per-change test documentation. Each file here covers **one feature** or **one refactor**,
opens by listing the **automated tests** that already cover it, and then tabulates the
**manual** cases a human still has to walk — with the exact backend/service action needed to
trigger each one, where an action is needed.

This is the standing home for manual test docs. Prefer it over a single flat checklist: split
by feature/flow so a reader finds the tests for the thing they changed instead of scrolling
one long list.

---

## File-naming convention

```
feature__<slug>.md     a shipped feature — tests NEW behavior
refactor__<slug>.md     a refactor / internal change — tests PRESERVED behavior
```

- **`feature__`** — the behavior is new. Manual cases assert it does the right thing.
- **`refactor__`** — the behavior should be unchanged. Manual cases assert nothing regressed,
  plus any *newly surfaced* difference the refactor introduced on purpose.

`<slug>` is `kebab-case`, named after the flow or the change, not the ticket number. One file
= one feature or one refactor.

---

## What every file contains

Copy [`_TEMPLATE.md`](./_TEMPLATE.md) and fill it in. The fixed shape:

1. **Header** — type (Feature/Refactor), the branch/PR, and the source files under test.
2. **Automated coverage** — a table mapping each test file to what it covers and, crucially,
   the **gap it leaves for manual testing** (real UI, real network, real service errors —
   things a unit test mocks away).
3. **Manual test cases** — a numbered table: precondition → steps → expected result →
   **service action needed** → result checkbox. The action column is only filled where a case
   needs an external system driven into a state; most rows say `none`.
4. **Notes / known issues** — links to open code-review findings or error-log entries. A case
   documenting a **known-open bug** is marked `⚠️ known-issue`, not left as if it passes.

### Automated-coverage-first rule

The automated table comes **before** the manual table on purpose. A manual case a unit test
already covers deterministically is wasted human time — listing automated coverage first
scopes the manual walk down to what machines *can't* check.

### The Result column

- `☐` not run · `☑` pass · `✗` fail (explain in Notes) · `⚠️ known-issue` (link the finding —
  a *tracked* defect, not a pass, not a fresh failure).

---

## Backend / service actions

When a case needs an external system (API, DB, auth provider) driven into a state the app UI
can't produce on its own, the row names the action. Common ones for a client app talking to a
REST backend:

| Needed state | Action | Typical effect |
|---|---|---|
| Server unreachable | Stop the backend process, then act in-app | connection/server failure surface |
| 500 | Temporarily throw in the target endpoint | server-error surface |
| 401 | Expire/rotate the stored token | unauthorized / session-expired surface |
| 400 / 422 | Temporarily tighten request validation | validation-error surface (shows server message) |

Device-side states (airplane mode, low storage) need no backend action.

---

## Index

<!-- List each test-doc here, grouped Features / Refactors, one line each. -->

### Features
- [Test case theo tính năng — quy ước và chỉ mục](./test-cases/README.md)
- [F-26 Sao lưu và diễn tập phục hồi — hướng dẫn kiểm thử](./feature__f-26-backup-restore-drill.md)
- [F-01 Đăng nhập, phiên — Test Cases](./test-cases/f-01-auth-session-test-cases.md)
- [F-02 Tài khoản, vai trò, phạm vi quyền — Test Cases](./test-cases/f-02-accounts-roles-permissions-test-cases.md)
- [F-03 Đơn vị và nhóm chuyên môn — Test Cases](./test-cases/f-03-org-units-subject-groups-test-cases.md)
- [F-04 Danh mục học phần — Test Cases](./test-cases/f-04-course-catalog-test-cases.md)
- [F-05 Quan hệ học phần, nhóm tương đương — Test Cases](./test-cases/f-05-course-relations-equivalence-test-cases.md)
- [F-06 Thông tin chương trình, Giám đốc CTĐT — Test Cases](./test-cases/f-06-programs-directors-test-cases.md)
- [F-07 Khung chương trình, nhóm tự chọn — Test Cases](./test-cases/f-07-curriculum-elective-groups-test-cases.md)
- [F-08 Kiểm tra nhất quán — Test Cases](./test-cases/f-08-consistency-check-test-cases.md)
- [F-10 Đề cương — Test Cases](./test-cases/f-10-syllabus-test-cases.md)
- [F-11 PLO, CLO, ma trận — Test Cases](./test-cases/f-11-plo-clo-matrices-test-cases.md)
- [F-13 Đề xuất thay đổi — Test Cases](./test-cases/f-13-change-requests-test-cases.md)
- [F-14 Duyệt ba cấp, bình luận, thông báo — Test Cases](./test-cases/f-14-three-level-approval-notifications-test-cases.md)
- [F-15 Ban hành phiên bản — Test Cases](./test-cases/f-15-release-version-snapshots-test-cases.md)
- [MVP Luồng xuyên tính năng — Test Cases](./test-cases/mvp-flow-test-cases.md)
- [Playwright — hướng dẫn chạy và mở rộng pilot](./playwright-guide.md)
- …

### Refactors
- …

---

## Adding a new test-doc

1. Copy `_TEMPLATE.md` to `feature__<slug>.md` or `refactor__<slug>.md`.
2. Fill the header + source files.
3. List automated coverage first — scan the test suite for the feature's tests.
4. Write only the manual cases automation *can't* cover.
5. Add a line to the Index above.

(If the `test-doc` skill is installed, it scaffolds steps 1–2 and pre-seeds the
automated-coverage table by scanning the test suite.)
