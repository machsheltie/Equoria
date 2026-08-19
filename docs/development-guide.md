# Equoria Development Guide

**Status:** active command and local-setup index
**Last verified:** 2026-08-19

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
npm run test:backend
npm run test:frontend
npm run typecheck
npm run lint
npm run test:e2e:beta-readiness
bash scripts/doctrine-checks/run-all.sh
```

The backend suite is serial by design. Use package scripts rather than reconstructing long Jest/Vitest/Playwright command lines from old reports.

## Source ownership

| Question                       | Current owner                                   |
| ------------------------------ | ----------------------------------------------- |
| Root commands and Node floor   | `package.json`                                  |
| Backend commands/dependencies  | `backend/package.json`                          |
| Frontend commands/dependencies | `frontend/package.json`                         |
| Database schema                | `packages/database/prisma/schema.prisma`        |
| Database history               | `packages/database/prisma/migrations/`          |
| Environment variables          | `backend/.env.example`, `frontend/.env.example` |
| CI                             | `.github/workflows/`                            |
| Railway deployment             | `railway.toml`, `Dockerfile`                    |
| Test doctrine                  | `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`      |
| Product and visual direction   | `PRODUCT.md`, `DESIGN.md`                       |

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
