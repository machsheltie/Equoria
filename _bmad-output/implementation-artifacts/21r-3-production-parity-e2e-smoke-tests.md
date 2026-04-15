# Story 21R-3: Production-Parity E2E Smoke Tests for Beta-Live Routes

**Epic:** 21R - Beta Deployment Readiness Remediation  
**Priority:** P0  
**Status:** done  
**Corrected:** 2026-04-14

## Current Truth

The required Playwright command now completes in real beta mode and proves the corrected starter-horse persistence contract.

## Corrected E2E Contract

Path 1 must prove the preferred starter-horse contract:

1. Register a fresh account through the real auth flow.
2. Complete onboarding in beta mode.
3. Submit selected horse name, breed, and gender through `POST /api/auth/advance-onboarding`.
4. Assert `GET /api/horses` returns the customized starter horse.
5. Assert `/stable` renders that exact backend horse with name, breed, and gender.
6. Fail if onboarding ignores the selected horse data.

## Completed Corrections

- [x] `tests/e2e/beta-critical-path.spec.ts` now waits for `POST /api/auth/advance-onboarding`, not `POST /api/horses`.
- [x] The E2E asserts selected `horseName`, `breedId`, and `gender` in the submitted request payload.
- [x] The E2E asserts backend horse name, breed, and gender after onboarding.
- [x] The E2E asserts `/stable` renders the selected horse name, breed, and gender.
- [x] `playwright.config.ts` starts the frontend with `VITE_BETA_MODE: 'true'`.
- [x] `/horses/:id` is no longer blocked in beta routing.
- [x] `tests/e2e/global-setup.ts` reuses the real registration/onboarding starter horse instead of creating a duplicate through a stale test-only API mutation.
- [x] `playwright.config.ts` streams runner progress and writes HTML reports without opening them, preventing silent local hangs.

## Verification

- [x] Backend integration tests for starter registration and onboarding persistence passed.
- [x] Focused frontend tests for onboarding, nav, route scope, and corrected beta assertions passed.
- [x] Required command passed:

```powershell
npx playwright test tests/e2e/beta-critical-path.spec.ts --project=chromium
```

Observed results:

- Real beta-mode Chromium run: 3 tests passed.
- Path 1 proves register -> onboarding -> `POST /api/auth/advance-onboarding` -> backend horse persistence -> `/stable` render.
- Path 3 proves `/horses/:id` opens from `/stable` without a core beta exclusion notice.

## Completion Evidence

21R-3 is complete for the 21R-1 through 21R-3 correction scope. Broader beta deployment readiness remains blocked until the later 21R hardening stories are completed.
