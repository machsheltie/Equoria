# Equoria Development Guide

**Status:** active command and local-setup index
**Last verified:** 2026-11-20

This guide helps a developer start and verify the repository. It does not define product behavior, player-facing design, architecture, test philosophy, or current project status. `AGENTS.md`, `CLAUDE.md`, package scripts, environment templates, and live configuration take precedence.

## Loading rule

Load this file only for local setup, developer onboarding, environment configuration, or command discovery. For an implementation task with a known command, do not load it.

## Prerequisites

- Node.js `>=22.13.0` (enforced by package engines)
- npm
- PostgreSQL suitable for the current Prisma schema
- Redis for production-equivalent distributed behavior; local configuration is documented in `backend/.env.example`

Do not copy version numbers from prose into code or CI. Read the relevant `package.json`, lockfile, workflow, or platform configuration.

## Install

From the repository root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix packages/database install
npm --prefix packages/database exec prisma generate
```

Use `backend/.env.example` and `frontend/.env.example` as the complete environment-variable references. Never commit real `.env` files or secrets.

Apply migrations only to the intended database:

```bash
npm --prefix packages/database exec prisma migrate deploy
```

Before any reset, purge, destructive migration, or data rewrite, resolve and verify the exact database target. Test cleanup must use an intended disposable test database. Never infer permission to mutate production or shared data from this guide.

## Run locally

Use separate terminals:

```bash
npm run dev-backend
npm --prefix frontend run dev
```

The current ports, proxy, public routes, and health endpoints live in `backend/.env.example`, `frontend/vite.config.ts`, `backend/app.mjs`, and `backend/server.mjs`.

## Authoritative verification commands

Run from the repository root unless the task says otherwise:

```bash
npm run test:backend:targeted -- <path-to-test>
npm run test:backend:full
npm run test:frontend
npm run typecheck
npm run lint
npm run test:e2e:beta-readiness
bash scripts/doctrine-checks/run-all.sh
```

Use the targeted backend command while working. `test:backend:full` is the full suite: eight shards over two serial lanes, each lane on its own disposable database. The pre-push hook runs only the changed tests; the full gate runs on GitHub. The plain serial `npm run test:backend` runs out of its 1536 MB heap on the dev machine before it reports. Use package scripts rather than reconstructing long Jest/Vitest/Playwright command lines from old reports.

## Local test database

Backend tests create, change and delete rows, so they never use the game database. `backend/.env.test` points `DATABASE_URL` at a separate local database, `equoria_test`, on the same local PostgreSQL (`backend/.env.test.example` shows the shape). Create and migrate it once, and again after pulling new migrations:

```bash
npm run test:db:setup
```

`backend/scripts/test-db-setup.mjs` creates the database if it is missing (it never drops anything), applies migrations with `prisma migrate deploy`, and loads the breed seed data the suite needs. It is safe to repeat.

Every backend Jest run refuses to start, before any test touches the database, unless its database is local (localhost, 127.0.0.1 or ::1), named `*_test` or a sharded-gate lane (`equoria_lane_*`), and not the database `backend/.env` uses. Remote hosts (Supabase, Railway) are always refused. The guard is `backend/tests/config/testDatabaseGuard.mjs`; it runs in both Jest global setups and in the shared test environment, so CI (`equoria_test` on its localhost service) and the gate's lanes pass through it too.

Local runs also check free memory first. `test:backend:targeted` needs 1536 MB free and `test:backend:full` 3072 MB (checked once the gate admits the run). Below that a run waits up to 60 seconds for memory to come back, then refuses with a message instead of starting. `EQUORIA_TEST_MIN_FREE_MB` and `EQUORIA_TEST_MEMORY_WAIT_SECONDS` override the limits (`backend/scripts/test-memory-preflight.mjs`). Worker and heap limits are unchanged. After an interrupted run, `npm --prefix backend run test:reap` stops orphaned Jest workers.

## Source ownership

| Question                       | Current owner                                            |
| ------------------------------ | -------------------------------------------------------- |
| Root commands and Node floor   | `package.json`                                           |
| Backend commands/dependencies  | `backend/package.json`                                   |
| Frontend commands/dependencies | `frontend/package.json`                                  |
| Database schema                | `packages/database/prisma/schema.prisma`                 |
| Database history               | `packages/database/prisma/migrations/`                   |
| Environment variables          | `backend/.env.example`, `frontend/.env.example`          |
| CI                             | `.github/workflows/`                                     |
| Deployment configuration       | `.railway/railway.ts`, Netlify config, platform settings |
| Test doctrine                  | `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`               |
| Product and visual direction   | `PRODUCT.md`, `DESIGN.md`                                |

## Repository invariants

- Backend files use ESM; production backend modules do not use `require()`.
- Player-state mutations belong inside Prisma transactions.
- Frontend code must follow current Equoria design-system rules; this guide grants no permission to introduce Radix/shadcn, generic dashboard structure, toast libraries, chart libraries, or other prebuilt UI conventions.
- Do not weaken, skip, bypass, or replace a real-path test to obtain a green result.
- Do not treat a mock-backed test as backend integration or beta-readiness evidence.

The shared authentication limiter currently permits **200 failed** attempts per 15-minute window and skips successful requests. `backend/middleware/rateLimiting.mjs`, `.claude/rules/SECURITY.md`, and the drift sentinel own that fact.

## Troubleshooting discipline

1. Read the failing command and its current package script.
2. Reproduce the smallest real failure without changing configuration.
3. Check live source/configuration rather than a dated report.
4. Preserve the original failure evidence before editing.
5. Fix the cause and rerun the focused check plus the appropriate repository gate.

Do not raise timeouts, reduce workers, add ignores, or change test profiles merely because a failure is inconvenient; establish the actual resource or correctness cause first.
