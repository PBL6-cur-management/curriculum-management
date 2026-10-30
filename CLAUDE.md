# PBL6 — Hệ thống Quản lý Chương trình đào tạo

Quản lý chương trình đào tạo, đề cương, PLO/CLO, đề xuất thay đổi qua ba cấp duyệt, phiên bản ban hành và xét tốt nghiệp cho Khoa CNTT, Trường Đại học Bách khoa – ĐH Đà Nẵng.

## Stack

- `source/backend` — NestJS 12 (ESM), Prisma 7 trên PostgreSQL 18 (ICU `vi-VN`), BullMQ trên Redis 8, Vitest + Testcontainers
- `source/frontend` — React 19 + Vite 8, Ant Design 6 (`vi_VN`), TanStack Query, React Router, kiểu API sinh bằng `openapi-typescript`
- Two **independent** pnpm projects: each has its own `package.json`, lockfile and `node_modules`. No workspace. Run every command from inside the project.
- Node.js 22 (≥ 22.22). Versions and reasons: `docs/design/tech-stack.md` §6.

## Language

- Docs: Vietnamese prose, English identifiers. UTF-8 without BOM, LF.
- Code, tables, columns: English, per `docs/design/naming-map.md` and `docs/design/data-dictionary.md`. User-facing text: Vietnamese.

## Rules in effect

- `~/.claude/rules/ai-rules.md` (user-level) — universal collaboration rules.
- `.claude/rules/nestjs-rules.md` — applies to `source/backend`.
- `.claude/rules/react-vite-rules.md` — applies to `source/frontend`.

All load automatically every session. Don't duplicate their content here.

### Deviations from the stack rules — decided

These override the stack rule files. Reviewers check against the deviation, not the rule.

| Stack rule | This project | Source |
|---|---|---|
| npm, `npm run typecheck`, Biome | pnpm; type check `pnpm exec tsc --noEmit -p tsconfig.json` (backend) / `pnpm exec tsc -b` (frontend); oxlint + Prettier | `tech-stack.md` §2 |
| Jest | Vitest; backend end-to-end with Testcontainers | `tech-stack.md` §2 |
| react-vite §4 Tailwind, `cn()`, shadcn | Ant Design 6 components and theme tokens; no Tailwind, no shadcn | `tech-stack.md` §1 |
| nestjs §5 JWT guard | Server session: HttpOnly cookie, session rows in PostgreSQL, 60-minute idle expiry | `tech-stack.md` §2, NFR-08 |
| nestjs §8 Joi/Zod config schema | `class-validator` env class (`src/config/env.validation.ts`) | skeleton |
| react-vite §6 hand-written response types | Types generated from the backend OpenAPI spec (`pnpm api:types`) | `tech-stack.md` §2 |
| Redis for cache/session | Redis holds queues only; jobs must be safe to re-run | `tech-stack.md` §3 |

### Deviations — foundation answers (2026-10-18)

Answered in `docs/planning/feature-questions.md` §F-00; the code moves to this layout with F-01 (`docs/implementation/f-01-auth-session-implementation-plan.md`).

| Stack rule | This project | Source |
|---|---|---|
| react-vite §1 folder set (`services/`, `routes/`, `types/`) | `src/features/<f>/{api,components,hooks,pages,schema}` + `src/shared/`; app composition (`main.tsx`, `router.tsx`, `routes.ts`) stays in `src/` | F00-02 |
| nestjs §5 `@Roles` + `RolesGuard` | `@RequirePermission(...)` + `PermissionGuard` (F-02); scope checked in services via a shared `ScopeService` | F00-03 |
| react-vite §5 react-hook-form + Zod | AntD `Form` with `rules` | F00-04 |
| react-vite §3 Zustand for session | TanStack Query `GET /api/auth/me` is the only client session state | F00-05 |
| react-vite §4 `const` arrow components | `function Foo()` | F00-06 |
| react-vite §4 no inline styles | AntD theme tokens + layout components; inline `style` allowed for one-off spacing | F00-07 |
| — | Primary keys `String @id @default(cuid(2))` | F00-10 |
| ui-ux / react-vite §4 styling | UI work goes through Impeccable; `DESIGN.md` is the visual source of truth (pinned to chuandaura.dut.udn.vn) | 2026-10-30 |

## Project knowledge — read before you guess

| Doc | Read this before... |
|---|---|
| `docs/requirement/REQUIREMENTS.md` | Any behaviour question — FR / BR / NFR / EC / Q-xx |
| `docs/planning/epics.md`, `docs/planning/user-stories.md` | Scoping a feature — stories and acceptance criteria |
| `docs/design/data-dictionary.md`, `docs/design/erd.md` | Adding a table or column — the target schema |
| `docs/design/state-diagrams.md`, `docs/design/sequence-diagrams.md` | Any status field or multi-step flow |
| `docs/design/screen-inventory.md` | Building a screen |
| `docs/planning/feature-questions.md` | Starting a feature — its open questions and answers |
| `docs/architecture/general_architecture.md` | Touching folder layout, module wiring, auth, routing |
| `docs/architecture/features_architecture.md` | Working on any feature's backend module or screens |
| `docs/architecture/database_and_models.md` | Changing `prisma/schema.prisma` — what is actually migrated |
| `docs/technical/technical_reference.md` | Adding a library or touching config |
| `docs/implementation/` | Building a planned feature — the plan names every file and how to verify it |
| `docs/progress/todo.md` | Picking up new work |
| `docs/troubleshooting/error_log.md` | Debugging — check whether the symptom was already diagnosed |

## Design system

Every UI change goes through the **impeccable** plugin (rule: `.claude/rules/ui-ux-skill.md`).
Visual truth: `DESIGN.md` + `PRODUCT.md` at the repo root, pinned to the school's outcome system (chuandaura.dut.udn.vn).
New screen → `/impeccable shape`; before a UI PR → `/impeccable polish` + `/impeccable audit`, detector clean.
Tokens live in `source/frontend/src/shared/design-system/tokens.ts` → `theme.ts`; components catalog in `DESIGN_SYSTEM.md` there.

## Before building a feature

Non-trivial features get a written implementation plan **before** any code (`ai-rules.md` Rule 1), written with the **feature-implementation-plan** skill into `docs/implementation/`. A feature spanning backend and frontend gets one plan covering both projects, with the API contract between them.

```
requirement → design → implementation plan → code → test cases
 docs/requirement  docs/design  docs/implementation  source/  docs/planning/test-plan.md, docs/testing/
```

## Active work

@docs/progress/current_work.md

## After any significant change

Update the docs per `ai-rules.md` Rule 4 and append to `docs/progress/progress_log.md`, using the **docs-sync** subagent:

```
Use the docs-sync subagent to update the docs for what we just did
```

## Before considering a task done

Use the **build-verifier** subagent (type check, lint, unit tests on the side that changed) rather than reading raw build output.
