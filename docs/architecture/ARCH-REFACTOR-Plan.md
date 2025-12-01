# ARCH-REFACTOR-Plan: Equoria Backend & API (Web)

## Goal
Refactor the Express backend into clear domain modules, add /api/v1 versioning, and publish a generated OpenAPI spec consumed by the web frontend.

## Current State (Summary)
- Flat routes/controllers (~30) covering auth, horses, training, competition, breeding/foals, traits/epigenetics/flags, grooms, compatibility, optimization/memory, admin, docs.
- Swagger middleware present; no canonical OpenAPI source checked in.
- Prisma client in packages/database; migrations/seeds present; tests exist but coverage distribution unknown.
- Frontend is Vite/React web; currently mock data and not wired to backend.

## Target Architecture
- **Versioning**: /api/v1 as the public surface. Experimental endpoints move to /api/v1/labs/*.
- **Domain Modules** (under ackend/modules/):
  - uth (auth, tokens, rate-limits, users bootstrap)
  - users (profiles, dashboard)
  - horses (CRUD, lineage)
  - reeding (pairing, foals, cooldowns, lineage recording)
  - 	raits (traits, flags, discovery, ultra-rare)
  - 	raining (sessions, milestones, injuries)
  - competition (events, entries, scoring, rewards)
  - grooms (hire, assign, performance, marketplace, handlers)
  - leaderboards (per-discipline boards)
  - dmin (admin-only ops)
  - docs (serve API docs and user docs)
  - labs (advancedEpigenetic, enhancedReporting, apiOptimization, memoryManagement, environment, personalityEvolution)
- **Module Structure**: outes/, controllers/, services/, schemas/ (validation), models/ (if needed), 	ests/ per module. Central middleware/ for security/logging/resource mgmt.
- **Data Layer**: Single Prisma client import; domain services own queries. Migrations mapped to modules in documentation.

## Refactor Steps (Sequenced)
1) **Routing Layer**
   - Create /api/v1 router; mount existing routes under it.
   - Move experimental/placeholder routes to /api/v1/labs and mark non-SLO-supported.
   - Add 404/health/version endpoints under /api/v1.

2) **Domain Folders**
   - Create modules/{domain} folders; move route/controller/service per domain.
   - Add index.js per module to export router and service contract.
   - Align filenames to exports (no underscore mismatches).

3) **Validation & Schemas**
   - Introduce schema validation per route (zod or express-validator schemas in schemas/).
   - Define request/response DTOs to feed OpenAPI generation.

4) **Middleware Consolidation**
   - Keep helmet, cors, rate-limit; central request/response logging; error handling; resource mgmt. Tune rate-limit for test env separately.

5) **OpenAPI Generation**
   - Choose generator (e.g., express-oas-generator or manual openapi-typescript from zod schemas).
   - Emit docs/api/openapi.yaml; serve via Swagger UI; commit spec.
   - Add docs/api/API-01-Overview.md (usage, auth, pagination, errors, versioning policy).

6) **Testing Alignment**
   - Module-focused integration suites (auth, horses, breeding, traits, training, competition, grooms, leaderboards).
   - Keep jest config; ensure rate-limit relaxed in tests.

7) **Deprecations & Cleanup**
   - Mark deprecated/duplicate routes; remove unused RN/mobile artifacts from backend docs.
   - Document labs endpoints as non-SLO and subject to change.

8) **Frontend Wiring**
   - Generate API client (openapi-typescript or similar); use in React Query hooks.
   - Update nav flows to call /api/v1 for breeding, training, competition, grooms, leaderboards.

## Deliverables
- docs/api/openapi.yaml (generated, versioned)
- docs/api/API-01-Overview.md
- docs/architecture/ARCH-01-Overview.md (update to reference modules)
- Module folder structure under ackend/modules/
- Updated docs/bmm-workflow-status.yaml referencing API spec

## Risks / Mitigations
- Large move churn: tackle module-by-module; keep adapters to old paths until UI wired.
- Hidden coupling: add contract tests per route to detect regressions.
- Spec drift: make spec generation part of CI.

## Sequencing Guidance
- Start with routing/versioning + OpenAPI skeleton to unblock frontend wiring.
- Then module moves (auth → horses → breeding/traits → training → competition → grooms → leaderboards → admin → labs).
- Finish with documentation updates and test hardening.
