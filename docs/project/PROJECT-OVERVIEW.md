# Equoria Project Overview

**Purpose:** Web-based horse management sim covering training, breeding, and competitions.  
**Audience:** Engineers and agents needing a fast orientation.  
**Last Updated:** 2025-12-04

---

## What This Project Is
- Frontend: React 18 + Vite 5, TailwindCSS 3, Radix UI, TanStack Query v5, Zod.
- Backend: Node 20 + Express 4, Prisma 5 on PostgreSQL 15.
- Auth: HttpOnly cookies with automatic token refresh; all calls flow through the centralized API client in `frontend/src/lib/api-client.ts` (credentials included).
- State: Server data via React Query; form state via `useState` + Zod validation; no `any` types or `@ts-ignore`.
- Issue tracking: bd (beads) only—no markdown TODOs.

## Architecture Snapshot
- Frontend structure: feature folders under `frontend/src/components/` (`training/`, `breeding/`, `auth/`, `shared/`, `ui/`), route shells in `frontend/src/pages/`, hooks in `frontend/src/hooks/api/`, utilities in `frontend/src/lib/`, types in `frontend/src/types/`.
- Backend structure: Express app in `backend/app.mjs`; routes in `backend/routes/`, controllers in `backend/controllers/`, services in `backend/services/`, schemas in `backend/schemas/`, Prisma client in `packages/database/`.
- API response contract (frontend-facing): `{ status: 'success' | 'error', message, data?, errors? }`.
- Query key guidance: `['horses']`, `['horses', horseId]`, `['training', horseId, 'status']`, `['currentUser']`.

## Development Setup
- Requirements: Node 18+, PostgreSQL 15+, npm.
- Install: `npm install` at root, then in `backend/`, `frontend/`, and `packages/database/`.
- Database: `npx prisma generate --schema=prisma/schema.prisma`; run `npx prisma migrate deploy`; seed via `npm run seed:test` from `backend/`.
- Run: backend `npm run dev` on port 3001; frontend `npm run dev` on port 3000. API docs at `/api-docs`, health at `/health`.
- Config: `.env` in `backend/` with `DATABASE_URL`, JWT secrets, `PORT`, and CORS origins.

## Testing & Quality
- Frontend: Jest setup with MSW; colocate tests as `*.test.tsx`; lint/format via `npm run lint` and `npm run format`.
- Backend: Jest unit/integration/performance suites; commands `npm test`, `npm run test:integration`, `npm run test:performance`.
- Coverage target: 80%+ statements/lines/functions; no inline styles or console logging in production code.

## Documentation Map
- Index: `docs/index.md`
- Architecture: `docs/architecture.md`, `docs/architecture-frontend.md`, `docs/architecture-backend.md`
- Product requirements: `docs/product/PRD-*.md`
- APIs: `docs/api/openapi.yaml`, backend contracts in `docs/api-contracts-backend/`
- Implementation guides: `docs/implementation/IMPL-02-Frontend-Guide.md`, `docs/implementation/IMPL-01-Backend-Guide.md`
- Sprint artifacts: `docs/sprint-artifacts/tech-spec-comprehensive-frontend-completion.md`, `docs/sprint-artifacts/tech-spec-elicitation-addendum.md`
- Context & rules: `docs/project_context.md`, `AGENTS.md` (bd usage, agent rules)

## Active Work (bd ready)
- Training epic (`Equoria-jft`): dashboard (`Equoria-jft.1`), session modal (`Equoria-jft.2`).
- Breeding epic (`Equoria-dwj`): center (`Equoria-dwj.1`), pair selector (`Equoria-dwj.2`), foal tracker (`Equoria-dwj.3`).

## Conventions & Guardrails
- Use the centralized API client; never raw `fetch`.
- Stick to strict TypeScript; avoid `any` and `@ts-ignore`.
- Server state: React Query; forms: `useState` + Zod.
- Tailwind for styling; keep components under 500 lines and shard when needed.
- Track work exclusively in bd; update status as you pick up or finish tasks.
