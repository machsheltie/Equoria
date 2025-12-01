# ARCH-01: Architecture Overview (Web)

## Purpose
Document the Equoria architecture at a high level for the web stack: Express API, Prisma/PostgreSQL, and Vite/React frontend.

## System Overview
- Backend: Express (ESM) with domain modules (auth, horses, breeding, traits, training, competition, grooms, leaderboards, admin, docs, labs), backed by PostgreSQL via Prisma.
- Frontend: Vite + React + Tailwind, consuming /api/v1.
- API: Versioned /api/v1 with generated OpenAPI (docs/api/openapi.yaml). Swagger UI serves the spec.
- Infra: TBD (CI/CD, hosting, logging) - to be added.
- Reference sources to merge: docs/history/claude-architecture/TECH_STACK_DOCUMENTATION.md, BACKEND_DOCUMENTATION_VERIFICATION.md, FRONTEND_ARCHITECTURE.md.

## Integration Notes
- Use schemas in backend/schemas to generate OpenAPI for Swagger UI.
- Align data model and migrations with documents in docs/history/backend-docs (imported legacy backend docs).

## Key Responsibilities
- Keep API contracts in sync with OpenAPI.
- Maintain clear ownership per domain module.
- Keep labs/experimental endpoints separate from stable surface.

## Next Steps
- Fill in deployment topology, environments, and data flow diagrams.
- Add data model overview (Prisma schema) and caching strategy.
- Link module-level docs once modules are moved under ackend/modules/*.
