# Story 21S-3: Switch Playwright Webserver Off `NODE_ENV=test` to a Beta Profile

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change B.2 / Finding P0-4
**Owner:** BackendSpecialistAgent + QualityAssuranceAgent

## Problem

`playwright.config.ts:30-31` launches the backend with `NODE_ENV=test`:

```
process.platform === 'win32'
  ? 'set "PORT=3001" && set "NODE_ENV=test" && node backend/server.mjs'
  : 'PORT=3001 NODE_ENV=test node backend/server.mjs'
```

The 2026-04-11 proposal explicitly requires: _"Run E2E backend in a beta-like environment, not generic `NODE_ENV=test`."_ Any middleware path branching on `NODE_ENV === 'test'` (CSRF, rate-limit, logging, seed data) runs differently in E2E than in beta, so production parity is not established.

## Acceptance Criteria

- [ ] Introduce `NODE_ENV=beta` profile in backend config. Config should:
  - Use real CSRF middleware (no skip branch).
  - Use real rate-limit middleware (no bypass branch).
  - Point at a throwaway Postgres database (reuses existing `.env.test` pattern but distinct env name).
  - Emit production-parity logging.
- [ ] Update `playwright.config.ts` webServer for backend:
  - Windows: `set "PORT=3001" && set "NODE_ENV=beta" && node backend/server.mjs`
  - Unix: `PORT=3001 NODE_ENV=beta node backend/server.mjs`
- [ ] Remove `VITE_E2E_TEST: 'true'` from the frontend webServer env block (only `VITE_BETA_MODE: 'true'` should remain).
- [ ] `backend/server.mjs` must start cleanly when `NODE_ENV=beta` is set without any missing-env-var errors.
- [ ] `.env.beta` template created or documented in `docs/deployment/RAILWAY_SETUP.md` or a new `docs/testing/BETA_PROFILE.md`.
- [ ] Full beta-critical-path E2E still passes under the new profile.

## Verification

```bash
grep -n "NODE_ENV" playwright.config.ts
# Expected: NODE_ENV=beta (not test)

grep -n "VITE_E2E_TEST" playwright.config.ts
# Expected: 0 matches
```

## Dependencies

- Blocks Story 21S-6 (readiness gate) — that gate cannot be made non-skippable until this profile exists.
- Pairs with Story 21S-2 — removing bypass headers is only meaningful if the backend actually enforces them, which this story guarantees.

## Out of Scope

- Staging/production Railway config — those already exist; this story is only the Playwright profile.
