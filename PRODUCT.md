# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Six roles of Trường Đại học Bách khoa – ĐH Đà Nẵng, Khoa Công nghệ Thông tin, weighted equally (user decision 2026-10-30):

- R1 Phòng Đào tạo — final (level 3) approval, releases program versions, manages semesters, cohorts, accounts and permissions.
- R2 Ban lãnh đạo khoa — oversight and comments; does not block approvals.
- R3 Giám đốc CTĐT — owns a program: curriculum frame, PLO, level-2 approval.
- R4 Điều phối nhóm chuyên môn — level-1 approval for a subject group's courses and syllabi.
- R5 Giảng viên — drafts syllabi, CLO, grade formulas, and change requests.
- R6 Sinh viên — read-only: program, progress, eligibility.

Mostly middle-aged university staff on office desktops (≥1280 px), working in Vietnamese, often with long tables open beside Excel and official documents.

## Product Purpose

Manage training programs (CTĐT), course catalog, curriculum frames, syllabi, PLO/CLO, change requests through three approval levels, released versions per cohort, student records, registration eligibility and graduation review. Success: staff stop reconciling Excel files by hand and every published number traces to an approved, versioned record.

## Positioning

One versioned source of truth: frames, syllabi and outcomes live in one place; every change goes through a proposal and three-level approval and is released as an immutable version assigned to cohorts. Spreadsheets and the legacy school database cannot show who changed what, under which approved request, effective from which semester.

## Operating Context

- Regulation: "Quy định xây dựng, cập nhật CTĐT" (docs/requirement). Approval chain R4 → R3 → R1.
- Data comes from the legacy school database (SQL Server dumps in `source/current-data-dut`, personal data, never committed) and Khoa Excel files (F-09).
- A sibling school system for outcome scores exists (`chuandaura.dut.udn.vn`, backend `plo-clo-backend`).

## Capabilities and Constraints

- Stack: NestJS + Prisma/PostgreSQL backend, React 19 + Vite + Ant Design 6 frontend (`source/frontend`), Vietnamese UI (`vi_VN`).
- Light mode only (user decision 2026-10-30).
- Permission model: per role × permission cell, mode DIRECT / VIA_REQUEST, scope ALL / SCOPED; some cells locked.
- Open: whether PLO/CLO should be read from the existing outcome system instead of managed here.

## Brand Commitments

- Binding visual reference: the school's outcome system `https://chuandaura.dut.udn.vn` (user decision 2026-10-30). Its tokens are captured in `.impeccable-ref/chuandaura.css`; the visual system itself is recorded in DESIGN.md, not here.
- Official names: "Đại học Đà Nẵng", "Trường Đại học Bách khoa", DUT logo (`logo-dut.webp`).

## Evidence on Hand

- Real curriculum data: 24 programs, 46 versions, 173 courses (`source/backend/prisma/seed-data/dut/data`).
- Real dumps of lecturers, students, grades, exemptions, grade formulas (local only).
- Absent and must not be fabricated: PLO/CLO content, structured syllabus content, real role holders, approval history.

## Product Principles

1. Traceability over convenience: every value shows its source, request and version.
2. Show state before action: status, scope and lock reasons are visible without hovering.
3. Dense but scannable: tables are the primary surface; summarize first, detail on demand.
4. Vietnamese administrative language, specific and actionable.
5. Familiar over novel: match the school's existing systems so staff need no training.

## Accessibility & Inclusion

WCAG 2.1 AA contrast; keyboard operable tables and forms; readable at 14 px for middle-aged users; never rely on color alone for status.
