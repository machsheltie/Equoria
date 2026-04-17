# Story 21S-8: Require Admin Role on `POST /api/memory/cleanup`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P1
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change G / Finding P1-9
**Owner:** BackendSpecialistAgent + SecurityArchitect

## Problem

`backend/modules/labs/routes/memoryManagementRoutes.mjs:254-290` registers `POST /api/memory/cleanup` behind `authenticateToken` only. Any authenticated beta tester can call it and trigger `memoryManager.cleanupAllResources()`. This is not a `/test/cleanup` route so it wasn't in 21R-4 scope, but the spirit of that story applies: operational cleanup endpoints must not be callable by any authenticated user in beta.

## Acceptance Criteria

Pick one:

### Option A — Gate by admin role (preferred if an admin-only surface is valuable)

- [ ] Add role-guard middleware (existing pattern if present, otherwise a small new `requireRole('admin')`).
- [ ] Apply it to the `POST /api/memory/cleanup` route (and any sibling operational routes in the same file that should be admin-only).
- [ ] Integration test: non-admin user → 403, admin user → 200.

### Option B — Remove the HTTP route entirely

- [ ] Extract the cleanup logic into a standalone Node script under `scripts/` or `backend/scripts/`.
- [ ] Unregister the route; keep the `memoryManager.cleanupAllResources()` function callable only from the script.
- [ ] Confirm nothing else in the frontend or tests POSTs to `/api/memory/cleanup`.

## Verification

```bash
curl -X POST -H "Cookie: <non-admin session>" http://localhost:3000/api/memory/cleanup
# Expected: 403 (Option A) or 404 (Option B)
```

## Out of Scope

- Broader RBAC refactor — this story is scoped to this one endpoint. Any adjacent memoryManagement routes (`/memory/report`, `/memory/gc`) may be reviewed but not required here.
