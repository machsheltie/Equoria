# Equoria Documentation Index

**Last Updated:** 2025-12-04 (Project Overview added; legacy claude docs referenced)
**Version:** 2.2.0
**Scan Level:** Exhaustive

---

## Files

- **[architecture-backend.md](./architecture-backend.md)** - Express.js/Prisma backend architecture diagrams
- **[architecture-frontend.md](./architecture-frontend.md)** - React/Vite frontend architecture diagrams
- **[bmm-workflow-status.yaml](./bmm-workflow-status.yaml)** - BMAD workflow tracking and state
- **[data-models.md](./data-models.md)** - Prisma entity relationships (29 models)
- **[development-guide.md](./development-guide.md)** - Quick start setup for development
- **[devops-cicd.md](./devops-cicd.md)** - CI/CD pipelines and DevOps documentation
- **[integration-patterns.md](./integration-patterns.md)** - Frontend-backend integration patterns
- **[project-scan-report.json](./project-scan-report.json)** - Automated project analysis data
- **[README.md](./README.md)** - Legacy documentation overview
- **[source-tree-analysis.md](./source-tree-analysis.md)** - Complete monorepo structure documentation

---

## Subdirectories

### product/

Product Requirements Documents (PRDs)

#### Core PRDs

- **[PRD-00-Brief.md](./product/PRD-00-Brief.md)** - Web-only product brief with personas and scope
- **[PRD-01-Overview.md](./product/PRD-01-Overview.md)** - Executive summary, vision, and KPIs
- **[PRD-02-Core-Features.md](./product/PRD-02-Core-Features.md)** - User auth and horse management systems
- **[PRD-03-Gameplay-Systems.md](./product/PRD-03-Gameplay-Systems.md)** - Training, competition, grooms, breeding
- **[PRD-04-Advanced-Systems.md](./product/PRD-04-Advanced-Systems.md)** - Epigenetic traits and ultra-rare mechanics

#### Technical PRDs (Sharded)

- **[PRD-05-Deployment-Guide/](./product/PRD-05-Deployment-Guide/index.md)** - Docker, CI/CD, monitoring (16 sections)
- **[PRD-06-Testing-Strategy/](./product/PRD-06-Testing-Strategy/index.md)** - TDD, coverage, quality gates (16 sections)
- **[PRD-09-Development-Standards/](./product/PRD-09-Development-Standards/index.md)** - Code style, database practices (14 sections)

#### Reference PRDs

- **[PRD-07-Player-Guide.md](./product/PRD-07-Player-Guide.md)** - Comprehensive player guide with strategy
- **[PRD-08-Security-Architecture.md](./product/PRD-08-Security-Architecture.md)** - JWT security, exploit prevention
- **[PRD-10-Project-Milestones.md](./product/PRD-10-Project-Milestones.md)** - Development timeline and roadmap

#### Archive

- **[PRD-05-Deployment-Guide.md](./product/archive/PRD-05-Deployment-Guide.md)** - Original deployment guide (pre-sharding)
- **[PRD-06-Testing-Strategy.md](./product/archive/PRD-06-Testing-Strategy.md)** - Original testing strategy (pre-sharding)
- **[PRD-09-Development-Standards.md](./product/archive/PRD-09-Development-Standards.md)** - Original development standards (pre-sharding)

---

### api/

API Specification and Generation

- **[API-01-Overview.md](./api/API-01-Overview.md)** - API versioning, auth, and base URL info
- **[openapi.yaml](./api/openapi.yaml)** - OpenAPI 3.0 specification for all endpoints
- **[SCHEMA-GENERATION-NOTES.md](./api/SCHEMA-GENERATION-NOTES.md)** - Plan for Zod schema generation

---

### api-contracts-backend/

Backend API Contracts (23 sharded sections)

- **[index.md](./api-contracts-backend/index.md)** - Complete table of contents
- **[overview.md](./api-contracts-backend/overview.md)** - API structure and conventions
- **[authentication-endpoints.md](./api-contracts-backend/authentication-endpoints.md)** - Login, register, token refresh
- **[user-endpoints.md](./api-contracts-backend/user-endpoints.md)** - User profile and settings
- **[horse-endpoints.md](./api-contracts-backend/horse-endpoints.md)** - Horse CRUD and lineage
- **[training-endpoints.md](./api-contracts-backend/training-endpoints.md)** - Training sessions and skills
- **[competition-endpoints.md](./api-contracts-backend/competition-endpoints.md)** - Event entry, scoring, rewards
- **[groom-endpoints.md](./api-contracts-backend/groom-endpoints.md)** - Groom hiring and assignment
- **[foal-breeding-endpoints.md](./api-contracts-backend/foal-breeding-endpoints.md)** - Breeding and foal development
- **[trait-endpoints.md](./api-contracts-backend/trait-endpoints.md)** - Trait discovery and management
- **[milestone-endpoints.md](./api-contracts-backend/milestone-endpoints.md)** - Achievement tracking
- **[leaderboard-endpoints.md](./api-contracts-backend/leaderboard-endpoints.md)** - Per-discipline rankings
- **[admin-endpoints.md](./api-contracts-backend/admin-endpoints.md)** - Admin-only operations
- **[xp-endpoints.md](./api-contracts-backend/xp-endpoints.md)** - Experience points and leveling
- **[health-check-endpoints.md](./api-contracts-backend/health-check-endpoints.md)** - Server health and status
- **[breed-endpoints.md](./api-contracts-backend/breed-endpoints.md)** - Breed information and statistics
- **[input-validation-rules.md](./api-contracts-backend/input-validation-rules.md)** - Request validation requirements
- **[error-responses.md](./api-contracts-backend/error-responses.md)** - Error codes and formats
- **[rate-limiting.md](./api-contracts-backend/rate-limiting.md)** - Rate limit configuration
- **[security-features.md](./api-contracts-backend/security-features.md)** - Security headers and protections
- **[performance-headers.md](./api-contracts-backend/performance-headers.md)** - Request tracing headers
- **[cross-references.md](./api-contracts-backend/cross-references.md)** - Links to related docs
- **[document-history.md](./api-contracts-backend/document-history.md)** - Version history

---

### architecture/

Architecture Planning and Design

- **[ARCH-01-Overview.md](./architecture/ARCH-01-Overview.md)** - High-level web stack architecture
- **[ARCH-REFACTOR-Plan.md](./architecture/ARCH-REFACTOR-Plan.md)** - Domain module refactoring roadmap

---

### implementation/

Implementation Guides

- **[API-CLIENT-PLAN.md](./implementation/API-CLIENT-PLAN.md)** - React Query client with OpenAPI types
- **[API-ISSUES-TRIAGE-PLAN.md](./implementation/API-ISSUES-TRIAGE-PLAN.md)** - API issue triage and remediation plan
- **[SCALE-CONFIG.md](./implementation/SCALE-CONFIG.md)** - Cluster and DB pool sizing guidance
- **[IMPL-01-Backend-Guide.md](./implementation/IMPL-01-Backend-Guide.md)** - Backend developer setup (scaffold)
- **[IMPL-02-Frontend-Guide.md](./implementation/IMPL-02-Frontend-Guide.md)** - Frontend developer setup (scaffold)

---

## Issue Tracking

Use the `bd` command for all issue tracking instead of markdown TODOs:

- Create issues: `bd create "Task description" -p 1 --json`
- Find work: `bd ready --json`
- Update status: `bd update <id> --status in_progress --json`
- View details: `bd show <id> --json`

Use `--json` flags for programmatic parsing.

---

### project/

Project Management

- **[PROJECT-OVERVIEW.md](./project/PROJECT-OVERVIEW.md)** - High-level project orientation
- **[PM-01-Roadmap.md](./project/PM-01-Roadmap.md)** - Near-term milestones (scaffold)

---

### archive/

Archived Documents

- **[api-contracts-backend.md](./archive/api-contracts-backend.md)** - Original API contracts (pre-sharding)
- **[.claude/docs/AUTH_IMPLEMENTATION_PLAN.md](../.claude/docs/AUTH_IMPLEMENTATION_PLAN.md)** - Legacy auth rollout plan (reference only)
- **[.claude/docs/OPTIMIZATION_SUMMARY.md](../.claude/docs/OPTIMIZATION_SUMMARY.md)** - Legacy performance optimization summary (reference only)
- **[.claude/docs/TECH_STACK_DOCUMENTATION.md](../.claude/docs/TECH_STACK_DOCUMENTATION.md)** - Legacy stack notes prior to consolidation
- **[.claude/docs/PROJECT_MILESTONES.md](../.claude/docs/PROJECT_MILESTONES.md)** - Legacy milestones (see current `product/PRD-10-Project-Milestones.md`)

---

### history/

Historical Documentation (Archived)

- **[README.md](./history/README.md)** - Archive notice with consolidation mapping

Content consolidated into PRD structure:

| Historical Location | Consolidated Into |
|---------------------|-------------------|
| `claude-systems/` | PRD-03, PRD-04 |
| `claude-api/` | api-contracts-backend/ |
| `backend-docs/user-guide/` | PRD-07 |
| `backend-docs/` | PRD-09 |
| `claude-guides/` | PRD-06, PRD-09 |
| `claude-rules/` | PRD-08 |
| `claude-docs/` | PRD-09, PRD-10 |
| `claude-planning/` | PRD-05 |

---

### tasks/

Reserved for task tracking files (empty)

---

### technical/

Technical Specifications (Implementation-Ready)

- **[TECH-SPEC-01-Authentication.md](./technical/TECH-SPEC-01-Authentication.md)** - 3-week auth implementation (HttpOnly cookies, token rotation, social login)
- **[TECH-SPEC-02-Frontend-Completion.md](./technical/TECH-SPEC-02-Frontend-Completion.md)** - Frontend completion plan (auth UI, training UI, breeding UI, API integration)
- **[TECH-SPEC-03-Test-Infrastructure.md](./technical/TECH-SPEC-03-Test-Infrastructure.md)** - Babel/Jest ES Modules fix for test infrastructure
- **[TECH-SPEC-04-Systems-Enhancement.md](./technical/TECH-SPEC-04-Systems-Enhancement.md)** - Shows & Breeding systems enhancement

### sprint-artifacts/

Sprint Implementation Documents

- **[sprint-status.yaml](./sprint-artifacts/sprint-status.yaml)** - Current sprint status
- **[tech-spec-comprehensive-frontend-completion.md](./sprint-artifacts/tech-spec-comprehensive-frontend-completion.md)** - **NEW** Comprehensive frontend completion (Auth UI, Training UI, Breeding UI, API integration, Tests) - 14 tasks, 27-35 hours
- **[tech-spec-elicitation-addendum.md](./sprint-artifacts/tech-spec-elicitation-addendum.md)** - **NEW** Advanced implementation details (types, schemas, constants, test examples)

---

## Quick Reference

| Category | Location | Description |
|----------|----------|-------------|
| PRDs | `product/PRD-*.md` | Product requirements |
| API Contracts | `api-contracts-backend/` | REST API documentation (130+ endpoints) |
| Architecture | `architecture*.md` | System design |
| **Tech Specs** | `technical/TECH-SPEC-*.md` | Implementation-ready specifications |
| **Sprint Artifacts** | `sprint-artifacts/` | Active sprint implementation docs |
| Integration | `integration-patterns.md` | Frontend-backend communication |
| DevOps | `devops-cicd.md` | CI/CD and deployment |
| Data Models | `data-models.md` | Database schema (29 models) |
| Implementation | `implementation/` | Developer guides |
| Historical | `history/` | Archived docs |

---

## Codebase Statistics (2025-12-01 Scan)

| Component | Count |
|-----------|-------|
| Backend .mjs Files | 471 |
| Backend Controllers | 23 |
| Backend Routes | 35 |
| Backend Services | 45 |
| Backend Tests | 229 |
| Frontend Components | 19 |
| Frontend UI Primitives | 9 |
| Database Models | 29 |
| API Endpoints | 130+ |

---

## Conventions

- Keep documents under 500 lines; shard larger files
- Use relative links (e.g., `./product/PRD-01.md`)
- Update this index when adding or moving files
- Sharded documents use `index.md` as entry point

---

*Generated: 2025-12-01*
*Last Updated: 2025-12-02 (Comprehensive Frontend Tech Spec)*
*Workflow: BMAD tech-spec creation*
