# ARCH-01: Architecture Overview (Web)

**Last Updated:** 2026-03-05 (Epic 20 — Backend Architecture Refactor complete)

## Purpose

Document the Equoria architecture at a high level for the web stack: Express API, Prisma/PostgreSQL, and Vite/React frontend.

## System Overview

- **Backend:** Express (ESM) with 18 domain modules under `backend/modules/`, backed by PostgreSQL via Prisma.
- **Frontend:** Vite + React + Tailwind, consuming `/api/v1`.
- **API:** Versioned `/api/v1` (dual-mounted with `/api` for backward compat). Canonical OpenAPI spec at `backend/docs/swagger.yaml`. Swagger UI at `/api-docs`.
- **Infra:** GitHub Actions CI/CD with 9-job pipeline. Railway production deploy.
- **Reference sources:** `docs/architecture-backend.md`, `docs/architecture-frontend.md`

## Domain Modules (backend/modules/)

| Module         | Domain                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `auth`         | Authentication, JWT, registration, login, onboarding                                                                               |
| `users`        | User profiles, dashboard, progress                                                                                                 |
| `horses`       | Horse CRUD, breeds, lineage, foals                                                                                                 |
| `breeding`     | Pairing, genetic probability, cooldowns                                                                                            |
| `traits`       | Trait discovery, epigenetic flags, ultra-rare traits                                                                               |
| `training`     | Training sessions, cooldowns, milestones, injuries                                                                                 |
| `competition`  | Events, entries, scoring, rewards                                                                                                  |
| `grooms`       | Hire, assign, interact, marketplace, salary                                                                                        |
| `riders`       | Rider assignments, marketplace                                                                                                     |
| `trainers`     | Trainer assignments, marketplace                                                                                                   |
| `community`    | Forum threads/posts, direct messages, clubs/elections                                                                              |
| `services`     | Inventory, tack shop, farrier, vet, feed shop                                                                                      |
| `leaderboards` | Per-discipline rankings, statistics                                                                                                |
| `admin`        | Admin-only operations, user management                                                                                             |
| `docs`         | API documentation, user documentation                                                                                              |
| `health`       | Health check, ping endpoints                                                                                                       |
| `labs`         | Experimental: api-optimization, dynamic-compatibility, enhanced-reporting, environmental, memory-management, personality-evolution |

Each module follows the structure: `routes/`, `controllers/`, and optionally `tests/`.
Cross-cutting concerns (middleware, utils, db, config, services, models) live at `backend/` root.

## Backward Compatibility

Shim files at old paths (`backend/routes/`, `backend/controllers/`) re-export from the module implementation. Zero test files required changes.

```
backend/routes/horsesRoutes.mjs
  └── export { default } from '../modules/horses/routes/horsesRoutes.mjs'

backend/controllers/horsesController.mjs
  └── export * from '../modules/horses/controllers/horsesController.mjs'
```

## API Versioning

Both `/api/v1/auth/login` and `/api/auth/login` work (dual-mounted). `/api/v1` is the canonical surface. Labs endpoints at `/api/v1/labs/*` are non-SLO.

Frontend `api-client.ts` uses `/api/v1/` prefix throughout.

## Integration Notes

- Prisma client at `packages/database/prismaClient.mjs` — single shared instance
- OpenAPI spec: `backend/docs/swagger.yaml` — committed, served by Swagger UI
- Frontend proxies `/api` to backend via Vite dev server in development
- Production: monolithic Docker (Express serves Vite static build from `public/`)

## Key Responsibilities

- Keep API contracts in sync with `backend/docs/swagger.yaml`
- Maintain clear ownership per domain module
- Keep labs/experimental endpoints separate from stable `/api/v1` surface
- All modules use ES Modules only (`.mjs`, `import`/`export`)

## Component Counts (2026-03-05)

| Component                   | Count         |
| --------------------------- | ------------- |
| Domain Modules              | 18            |
| Route Files (modules/)      | 43            |
| Controller Files (modules/) | 35            |
| Services                    | 76            |
| Middleware                  | 28            |
| Backend Test Suites         | 229           |
| Backend Tests               | 3,651 passing |
| Frontend Components         | 80+           |
| Database Models (Prisma)    | 35+           |

## CI/CD Pipeline

GitHub Actions workflows:

- `ci-cd.yml` — Main pipeline (9 jobs: lint, test, security, docker, lighthouse)
- `codeql.yml` — Security scanning
- `test-auth-cookies.yml` — Auth-specific cookie tests

## Deployment

- **Production:** Railway (`railway.toml`) — Docker multi-stage build, `prisma migrate deploy` before start
- **Dev:** `npm run dev` in `backend/` + `frontend/` simultaneously
- **Docker:** `Dockerfile` — `frontend-builder` → `production` (Express + embedded SPA)
