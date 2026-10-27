# Implementation Plans

Repo-local, build-ready plans. Each file covers **one feature** or **one user-story cluster**
and answers: *which files do I create or change in this repo, in what order, shaped how, and
how do I know each step worked?*

This is the document that sits between the solution design and the code.

---

## Why these live here and not in the workspace docs

The upstream docs (requirement analysis, solution design) are consumed by **every** repo — a
requirement is a requirement regardless of stack. An implementation plan is consumed by
**exactly one** repo and is written in that repo's vocabulary: its ORM, its state pattern, its
codegen, its migration discipline. None of that is meaningful to a sibling repo.

So plans live next to the architecture docs they will eventually cause updates to. A feature
spanning two repos gets **two plans** — one per repo, each covering only its own side and
referencing the other by contract, never by internals.

---

## Where this sits in the doc workflow

```
1  requirement analysis    workspace docs    what the user needs
2  solution design         workspace docs    how the system will work
3  implementation plan     ← HERE (per repo) what you build, file by file
4  test cases              workspace docs    how we verify it
```

Steps 1, 2, and 4 describe the product. Step 3 describes the work.

---

## File-naming convention

```
<feature>-implementation-plan.md
```

**The `-implementation-plan.md` suffix is fixed** — every file in this folder ends with it, no
variations. That is what makes the folder scannable and greppable.

`<feature>` is `kebab-case`, derived from the epic/US identifier plus the feature name. No date,
no version suffix, no repo name — the folder already establishes the repo. The document is
updated in place rather than superseded, and git already tracks when.

```
srprs-us4-us6-implementation-plan.md          ✓
notification-reminders-implementation-plan.md ✓
srprs-us4-us6-plan.md                         ✗ suffix truncated
srprs_us4_us6_implementation_plan.md          ✗ snake_case
mobile-srprs-us4-us6-implementation-plan.md   ✗ repo name is redundant
```

---

## What every plan contains

| § | Section | Purpose |
|---|---|---|
| — | Title + companion docs + **Status** | Orientation; status updated as deliverables land |
| 1 | **Scope** | In / out / deferred, plus an `AC → deliverable` coverage table |
| 2 | **Contract verification** | Every consumed endpoint traced to `file:line`, with behavioral notes |
| 3 | **Decisions** | `D1…Dn` — Decision / Why / Rejected alternative |
| 4 | **Deliberate divergences** | Where this repo differs from a shipped sibling, and why |
| 5 | **Deliverables** | The bulk — every file, shaped, rationalized, verified |
| 6 | **Sequencing** | Dependency DAG + ordered build list with **pause points** |
| 7 | **Verification strategy** | Unit vs. manual vs. build gate |
| 8 | **Risks and open items** | `Risk / Impact / Mitigation` |

### The seven-element deliverable rule

Every deliverable in §5 carries all seven, without exception:

**Header** · **Files** (marked `NEW`/`MODIFY`/`DELETE`) · **Shape** (real code, not
pseudocode) · **Rationale** (naming the existing file it mirrors, by path) · **Gotchas** ·
**Verify** (the command or observable outcome) · **Depends on**

Write full depth even for deliverables that follow an existing pattern. "Mirror the existing
repository pattern" is only actionable to a reader who already knows *which* pattern — and
transferring that knowledge is the entire point of the document. Write for a competent
engineer who has never opened this repo.

### Contract verification is not optional

§2 records **behavioral** facts about consumed endpoints, not just response shapes: side
effects on GET, silent-empty conditions, lazily derived fields, numeric types that serialize
differently than they are declared. These are the facts that make a plan wrong *after* it is
written, so they are traced to `file:line` and re-checkable.

---

## Index

**Ở repo này:** `source/backend` và `source/frontend` là hai dự án trong **cùng một repo**, nên mỗi tính năng có **một** kế hoạch phủ cả hai phía; hợp đồng API giữa hai phía nằm ở §2 của kế hoạch. Tên tệp: `f-NN-<tên>-implementation-plan.md`.

Câu hỏi còn mở của từng tính năng: `docs/planning/feature-questions.md`. Kế hoạch của một tính năng chỉ được viết khi các câu của nó đã có trả lời.

### Danh sách tính năng

Điểm lấy từ `docs/planning/task-breakdown.md`; tổng 519 điểm (7 điểm của US-002, US-003 hoãn theo F01-07 — `docs/planning/deferred-scope.md` §2).

| Bậc | Tính năng | Epic | Story | Điểm | Kế hoạch |
|---|---|---|---|---|---|
| — | F-00 Khung dự án, trạng thái hệ thống | CV-004 | — | — | Đã dựng, không có kế hoạch |
| B1 | F-01 Đăng nhập, phiên | EP-01 | US-001 | 10 | [f-01](f-01-auth-session-implementation-plan.md) |
| B1 | F-02 Tài khoản, vai trò, phạm vi quyền | EP-02 | US-004..006 | 18 | [f-02](f-02-accounts-roles-permissions-implementation-plan.md) |
| B1 | F-03 Đơn vị và nhóm chuyên môn | EP-03 | US-007..010 | 16 | [f-03](f-03-org-units-subject-groups-implementation-plan.md) |
| B1 | F-04 Danh mục học phần | EP-04 | US-011..014 | 17 | [f-04](f-04-course-catalog-implementation-plan.md) |
| B1 | F-05 Quan hệ học phần, nhóm tương đương | EP-05 | US-015..017 | 18 | [f-05](f-05-course-relations-equivalence-implementation-plan.md) |
| B2 | F-06 Thông tin chương trình, Giám đốc CTĐT | EP-06 | US-018..022 | 21 | [f-06](f-06-programs-directors-implementation-plan.md) |
| B2 | F-07 Khung chương trình, nhóm tự chọn | EP-07 | US-023..028 | 25 | [f-07](f-07-curriculum-elective-groups-implementation-plan.md) |
| B2 | F-08 Kiểm tra nhất quán | EP-08 | US-029..031 | 11 | [f-08](f-08-consistency-check-implementation-plan.md) |
| B2 | F-09 Nhập, xuất Excel | EP-09 | US-032..037 | 28 | [f-09](f-09-excel-import-export-implementation-plan.md) — Done BE + FE + browser walk 2026-10-26; còn 3 ca Manual và flake chooseOption |
| B3 | F-10 Đề cương | EP-10 | US-038..041 | 17 | [f-10](f-10-syllabus-implementation-plan.md) |
| B3 | F-11 PLO, CLO, ma trận | EP-11 | US-042..048 | 30 | [f-11](f-11-plo-clo-matrices-implementation-plan.md) |
| B3 | F-12 Công thức điểm, đánh giá–CLO | EP-12 | US-049..052 | 17 | [f-12](f-12-grade-formula-assessment-clo-implementation-plan.md) |
| B4 | F-13 Đề xuất thay đổi | EP-13 | US-053..060 | 42 | [f-13](f-13-change-requests-implementation-plan.md) |
| B4 | F-14 Duyệt ba cấp, thông báo | EP-14 | US-061..070 | 37 | [f-14](f-14-three-level-approval-notifications-implementation-plan.md) |
| B4 | F-15 Ban hành, ảnh chụp phiên bản | EP-15 | US-071..077 | 36 | [f-15](f-15-release-version-snapshots-implementation-plan.md) |
| B4 | F-16 So sánh phiên bản, gán khóa | EP-16 | US-078..080 | 17 | [f-16](f-16-version-compare-cohort-assignment-implementation-plan.md) |
| B4 | F-26 Sao lưu, diễn tập phục hồi | CV-187 | — | 2 | [f-26](f-26-backup-restore-drill-implementation-plan.md) — **hoãn, 2026-10-26** (người dùng); không xếp lịch |
| B5 | F-17 Hồ sơ sinh viên, kết quả học tập | EP-17 | US-081..084 | 19 | [f-17](f-17-student-records-results-import-implementation-plan.md) |
| B5 | F-18 Điều kiện đăng ký học phần | EP-18 | US-085..086 | 10 | [f-18](f-18-course-registration-eligibility-implementation-plan.md) |
| B5 | F-19 Xét tốt nghiệp | EP-19 | US-087..091 | 23 | [f-19](f-19-graduation-review-implementation-plan.md) |
| B5 | F-20 Cổng sinh viên | EP-20 | US-092..097 | 22 | [f-20](f-20-student-portal-implementation-plan.md) |
| B5 | F-21 API cho dDUT | EP-21 | US-098..101 | 17 | [f-21](f-21-ddut-api-implementation-plan.md) |
| B6 | F-22 Đồng bộ cơ sở dữ liệu Trường | EP-22 | US-102..104 | 22 | [f-22](f-22-school-db-sync-implementation-plan.md) |
| B6 | F-23 Báo cáo kiểm định | EP-23 | US-105..109 | 16 | [f-23](f-23-accreditation-reports-implementation-plan.md) |
| B6 | F-24 Đồ thị, PDF, dòng thời gian, bảng sức khỏe | EP-24 | US-110..113 | 14 | [f-24](f-24-graphs-pdf-timeline-health-implementation-plan.md) |
| B6 | F-25 Ủy quyền, email, nhắc hạn | EP-25 | US-114..116 | 16 | [f-25](f-25-delegation-email-reminders-implementation-plan.md) |
| B6 | F-27 Triển khai, thử tải, theo dõi hoạt động | CV-249, CV-250 | — | 6 | [f-27](f-27-deployment-load-test-monitoring-implementation-plan.md) — **hoãn, 2026-10-26** (người dùng); không xếp lịch |

Các kế hoạch được người dùng chấp nhận với mặc định ngày 2026-10-26. F-09 đã xong BE + FE + browser walk (3 ca Manual còn nợ); F-16 FE đang triển khai, tiếp theo F-12 → F-17. F-26/F-27 hoãn, không xếp lịch.

**MVP (chốt 2026-10-18, `docs/planning/epics.md` §0):** F-01..F-08, F-10, F-11, F-13, F-14, F-15 — 13 tính năng, 298 điểm. Làm trước; F-09, F-12, F-16, F-26 và B5, B6 làm sau MVP.

Thứ tự phụ thuộc đáng chú ý: F-02 cần `OrgUnit` của F-03 (CV-011 → CV-021) — kế hoạch F-02 dựng bảng đơn vị tối thiểu và nạp Trường → Khoa CNTT + Phòng Đào tạo (F02-07); F-03 mở rộng.

### Active
- [F-01 Đăng nhập, phiên](f-01-auth-session-implementation-plan.md) — xong 2026-10-18
- [F-02 Tài khoản, vai trò, phạm vi quyền](f-02-accounts-roles-permissions-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt (§7)
- [F-03 Đơn vị và nhóm chuyên môn](f-03-org-units-subject-groups-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-04 Danh mục học phần](f-04-course-catalog-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-05 Quan hệ học phần, nhóm tương đương](f-05-course-relations-equivalence-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-06 Thông tin chương trình, Giám đốc CTĐT](f-06-programs-directors-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-07 Khung chương trình, nhóm tự chọn](f-07-curriculum-elective-groups-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-08 Kiểm tra nhất quán](f-08-consistency-check-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-10 Đề cương](f-10-syllabus-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-11 PLO, CLO, ma trận](f-11-plo-clo-matrices-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-13 Đề xuất thay đổi](f-13-change-requests-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-14 Duyệt ba cấp, thông báo](f-14-three-level-approval-notifications-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-15 Ban hành, ảnh chụp phiên bản](f-15-release-version-snapshots-implementation-plan.md) — mã xong 2026-10-19; còn nợ đi thử bằng trình duyệt
- [F-16 So sánh phiên bản, gán khóa](f-16-version-compare-cohort-assignment-implementation-plan.md) — FE đang triển khai; chưa hoàn tất.
- Đã đủ 13 tính năng MVP và F-09 (14 tính năng có mã hoàn tất). Tiếp theo F-16 FE → F-12 → F-17; sau đó F-23 (cần F-12), F-25, F-24 → F-18 → F-19 → F-22 → F-20 → F-21. F-26/F-27 hoãn theo người dùng 2026-10-26, không xếp lịch.

### Completed
- [F-09 Nhập, xuất Excel](f-09-excel-import-export-implementation-plan.md) — Done BE + FE + browser walk ngày 2026-10-26; 27 ca tự động Passed, 3 ca Manual F09-TC_015/016/025 chưa chạy; flake chooseOption vẫn theo dõi.

---

## Adding a new plan

Invoke the **feature-implementation-plan** skill — it gathers the upstream design, verifies
the API contract against real backend code, surfaces open questions in one batch, and writes
the document to this folder.

Writing one by hand instead: follow the section table above, and keep the seven-element rule
for every deliverable.

---

## Keeping plans current

A plan is a working document until its feature ships.

- Update the **Status** line as deliverables land.
- When the implementation contradicts the plan, **fix the plan in the same change**. A stale
  plan is worse than no plan.
- After shipping, the plan stays as the record of *how it was built*. It does not replace the
  architecture docs, which record *what exists now* and are updated separately.
