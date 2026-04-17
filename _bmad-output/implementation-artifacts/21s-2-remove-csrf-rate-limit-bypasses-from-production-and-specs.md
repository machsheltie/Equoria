# Story 21S-2: Remove CSRF / Rate-Limit Bypasses from Production Code and Beta-Critical Specs

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change B / Findings P0-2 + P0-3
**Owner:** FrontendSpecialistAgent + QualityAssuranceAgent + SecurityArchitect
**Reopens:** Story `21r-3` (was marked done prematurely)

## Problem

Story 21R-3 is marked `done`, but its own acceptance command still returns matches:

```
rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts
```

returns hits in:

- `frontend/src/lib/api-client.ts:614` — production API client ships the CSRF bypass branch whenever `VITE_E2E_TEST=true`.
- `tests/e2e/global-setup.ts:30`
- `tests/e2e/auth.spec.ts:31`
- `tests/e2e/beta-critical-path.spec.ts:33`
- `tests/e2e/core-game-flows.spec.ts:47`
- `tests/e2e/onboarding-flow.spec.ts:27`

With these bypasses, Playwright never exercises the CSRF or rate-limit paths real beta users will hit, so readiness signal is false.

## Acceptance Criteria

### Frontend

- [ ] Delete the `isTestEnv` branch in `frontend/src/lib/api-client.ts:614`. The client always acquires CSRF via the same path as beta users.
- [ ] Confirm CSRF token fetch works correctly in Playwright-driven browser sessions.

### E2E specs

- [ ] Remove `x-test-bypass-rate-limit` header injection from:
  - `tests/e2e/global-setup.ts`
  - `tests/e2e/auth.spec.ts`
  - `tests/e2e/beta-critical-path.spec.ts`
  - `tests/e2e/core-game-flows.spec.ts`
  - `tests/e2e/onboarding-flow.spec.ts`
- [ ] Replace with realistic pacing: unique per-suite accounts, or pre-emptive rate-limit reset via a test-only harness (not HTTP), or reduced request count.
- [ ] `tests/e2e/readiness/` support tooling may continue to exist but must be documented as support-only, not readiness evidence.

### Backend middleware defence in depth

- [ ] `backend/middleware/csrf.mjs` — when `NODE_ENV === 'production' || NODE_ENV === 'beta'`, the `x-test-skip-csrf` header MUST be treated as normal (not a bypass).
- [ ] `backend/middleware/rateLimiting.mjs` — same defence for `x-test-bypass-rate-limit`.
- [ ] Add unit test asserting the bypass headers do nothing in beta/production.

### Verification

```powershell
rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts
# Expected: 0 matches
```

- [ ] Full beta-critical-path E2E passes with headers removed.
- [ ] Story `21r-3` status reverts to `in-progress` until this story lands, then both may advance together.

## Out of Scope

- `tests/e2e/readiness/production-parity.guard.spec.ts` already rejects these headers — leave it in place.
