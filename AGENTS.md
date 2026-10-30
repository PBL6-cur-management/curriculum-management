# PBL6 — Hệ thống Quản lý Chương trình đào tạo

Quản lý chương trình đào tạo, đề cương, PLO/CLO, quy trình đề xuất–phê duyệt 3 cấp,
versioning, và xét tốt nghiệp — Khoa CNTT, ĐH Bách khoa Đà Nẵng.

## Cấu trúc repo

```
curriculum-management/        ← repo root
├── scripts/
│   └── dev.sh                ← Chạy BE + FE song song
├── source/
│   ├── backend/              ← NestJS 12 (ESM), Prisma 7, PostgreSQL, BullMQ/Redis
│   └── frontend/             ← React 19, Vite 8, Ant Design 6 (vi_VN), TanStack Query
├── docs/
│   ├── requirement/REQUIREMENTS.md  ← NGUỒN DUY NHẤT cho mọi quy tắc nghiệp vụ
│   ├── design/               ← ERD, sequence/state diagram, màn hình
│   ├── architecture/         ← Module wiring, folder layout, DB migrations
│   ├── implementation/       ← Kế hoạch triển khai từng feature
│   └── planning/             ← Epics, user stories, câu hỏi thiết kế
├── .claude/                  ← Cấu hình Claude Code (rules, agents, hooks)
├── .agent/                   ← Rules + agents cho Antigravity/Gemini
├── CLAUDE.md                 ← Hướng dẫn dành riêng cho Claude
└── AGENTS.md                 ← File này — tổng quan agnostic cho mọi AI agent
```

## Quick Start

```bash
# 1. Khởi động infrastructure (PostgreSQL + Redis via Docker)
cd source/backend && pnpm services:up

# 2. Khởi động BE + FE song song (từ project root)
bash scripts/dev.sh

# Hoặc từng cái riêng:
cd source/backend  && pnpm dev   # → http://localhost:3000
cd source/frontend && pnpm dev   # → http://localhost:5173
```

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Backend | NestJS 12 (ESM), Prisma 7, PostgreSQL 18 (vi-VN ICU) |
| Auth | express-session, HttpOnly cookie, connect-pg-simple |
| Queue | BullMQ on Redis 8 |
| Frontend | React 19, Vite 8, Ant Design 6 (vi_VN), TanStack Query |
| API types | openapi-typescript (generated: `pnpm api:types` in frontend) |
| Node | 22.x (≥ 22.22) |
| Package manager | pnpm 10 (2 independent projects — không dùng workspace) |

## Vai trò trong hệ thống

| Mã | Vai trò | Cấp duyệt |
|----|---------|-----------|
| R1 | Phòng Đào tạo | Cấp 3 (cuối) |
| R2 | Ban lãnh đạo khoa | Giám sát (không duyệt) |
| R3 | Giám đốc CTĐT | Cấp 2 |
| R4 | Điều phối nhóm chuyên môn | Cấp 1 |
| R5 | Giảng viên | Người đề xuất |
| R6 | Sinh viên | Chỉ đọc |

## Tài liệu quan trọng — đọc trước khi đoán

| Tài liệu | Khi nào cần đọc |
|----------|----------------|
| `docs/requirement/REQUIREMENTS.md` | Mọi câu hỏi nghiệp vụ — FR / NFR / BR / Q-xx |
| `docs/architecture/general_architecture.md` | Cấu trúc folder, module wiring, auth |
| `docs/architecture/features_architecture.md` | Module hoặc màn hình của bất kỳ feature nào |
| `docs/architecture/database_and_models.md` | Thay đổi `prisma/schema.prisma` |
| `docs/design/erd.md` | Quan hệ giữa các bảng |
| `docs/design/data-dictionary.md` | Tên cột, enum values |
| `docs/design/state-diagrams.md` | Trường trạng thái, luồng nhiều bước |
| `docs/design/screen-inventory.md` | Xây dựng bất kỳ màn hình nào |
| `docs/planning/feature-questions.md` | Câu hỏi mở và quyết định theo feature |
| `docs/implementation/` | Kế hoạch chi tiết từng feature (danh sách file + cách verify) |
| `docs/progress/todo.md` | Hàng đợi công việc hiện tại |
| `docs/troubleshooting/error_log.md` | Lỗi đã gặp và cách xử lý |

## Trước khi build feature

Mọi feature không tầm thường cần có **implementation plan** trước khi code, lưu tại `docs/implementation/`.
Luồng chuẩn: `requirement → design → implementation plan → code → test`.

## Design System

Mọi thay đổi UI đi qua plugin **impeccable** (`.claude/rules/ui-ux-skill.md`). Nguồn hình ảnh: `DESIGN.md`, `PRODUCT.md` ở gốc repo (ghim theo chuandaura.dut.udn.vn). Màn hình mới: `/impeccable shape`; trước PR: `/impeccable polish` + `audit`.

## Rules áp dụng

- `.agent/rules/nestjs-rules.md` — Backend (NestJS, Prisma)
- `.agent/rules/react-antd-rules.md` — Frontend (React, Ant Design 6)
- `.agent/rules/ui-ux-skill.md` — Thiết kế UI/UX (Emil Kowalski + Impeccable Design)

## Agent chuyên biệt (`.agent/agents/`)

| Agent | Khi nào dùng |
|-------|-------------|
| `architecture-reviewer` | Sau khi viết code non-trivial — review conventions |
| `build-verifier` | Trước khi kết thúc task — type-check + lint + test |
| `debugger` | Khi có bug khó hiểu — isolate và diagnose |
| `docs-sync` | Sau khi hoàn thành feature — đồng bộ docs/ |
| `design-critic` | Sau khi build UI — review design quality |
