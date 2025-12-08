# ARCH-01: Architecture Overview (Web)

**Last Updated:** 2025-12-01 (Full Rescan)

## Purpose
Document the Equoria architecture at a high level for the web stack: Express API, Prisma/PostgreSQL, and Vite/React frontend.

## System Overview
- Backend: Express (ESM) with domain modules (auth, horses, breeding, traits, training, competition, grooms, leaderboards, admin, docs, labs), backed by PostgreSQL via Prisma.
- Frontend: Vite + React + Tailwind, consuming /api/v1.
- API: Versioned /api/v1 with generated OpenAPI (docs/api/openapi.yaml). Swagger UI serves the spec.
- Infra: GitHub Actions CI/CD with 9-job pipeline.
- Reference sources: docs/architecture-backend.md, docs/architecture-frontend.md

## Integration Notes
- Use schemas in backend/schemas to generate OpenAPI for Swagger UI.
- Align data model and migrations with Prisma schema.
- Frontend proxies /api to backend via Vite dev server.

## Key Responsibilities
- Keep API contracts in sync with OpenAPI.
- Maintain clear ownership per domain module.
- Keep labs/experimental endpoints separate from stable surface.

## Component Counts (2025-12-01 Scan)

| Component | Count |
|-----------|-------|
| Backend Controllers | 23 |
| Backend Routes | 35 (130+ endpoints) |
| Backend Services | 45 |
| Backend Middleware | 12 |
| Backend Test Files | 229 |
| Frontend Components | 19 |
| Frontend UI Primitives | 9 |
| Database Models | 29 |

## CI/CD Pipeline

GitHub Actions workflows:
- `ci-cd.yml` - Main pipeline (9 jobs)
- `codeql.yml` - Security scanning
- `test-auth-cookies.yml` - Auth-specific tests

## Next Steps
- Fill in deployment topology, environments, and data flow diagrams.
- Add data model overview (Prisma schema) and caching strategy.
- Link module-level docs once modules are moved under backend/modules/*.
