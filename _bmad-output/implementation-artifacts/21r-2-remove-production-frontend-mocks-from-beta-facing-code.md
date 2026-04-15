# Story 21R-2: Remove Production Frontend Mocks from Beta-Facing Code

**Epic:** 21R - Beta Deployment Readiness Remediation  
**Priority:** P0  
**Status:** done  
**Corrected:** 2026-04-14

## Current Truth

The previous implementation record contained false completion claims. The corrected source now follows the active beta policy: features in scope must be real working surfaces, not hidden or read-only substitutes.

## Corrected Contract

- Registration creates the starter horse.
- Onboarding customizes that starter horse through `POST /api/auth/advance-onboarding`.
- `advanceOnboarding` persists selected horse name, breed, and gender transactionally.
- If the starter horse is missing, `advanceOnboarding` creates one in the same transaction.
- Onboarding failure keeps the player on onboarding, preserves selections, shows an error, and does not clear storage or navigate.

## Completed Corrections

- [x] `frontend/src/pages/OnboardingPage.tsx` submits selected starter horse data through `authApi.advanceOnboarding`.
- [x] `backend/modules/auth/controllers/authController.mjs` customizes or transactionally creates the starter horse and completes onboarding.
- [x] `frontend/src/pages/__tests__/OnboardingPage.test.tsx` covers selected data submission and failure behavior.
- [x] `frontend/src/App.tsx` no longer blocks active beta routes behind beta-exclusion notices.
- [x] `frontend/src/config/betaRouteScope.ts` classifies active beta routes as `beta-live`.
- [x] `frontend/src/components/layout/NavPanel.tsx` exposes active beta navigation.
- [x] `frontend/src/pages/StableView.tsx` exposes live empty-state CTAs.
- [x] `frontend/src/pages/LoginPage.tsx` exposes password recovery.
- [x] `frontend/src/pages/WorldHubPage.tsx` exposes live world routes including crafting.
- [x] `frontend/src/pages/CraftingPage.tsx` renders the real crafting page in beta.
- [x] Community write surfaces render live actions in beta: message board post, thread reply, club join/create/vote/nominate, direct message compose.
- [x] `frontend/src/components/hub/NextActionsBar.tsx` renders live next actions in beta.
- [x] `frontend/src/components/competition/CompetitionDetailModal.tsx` no longer hides entry in beta.
- [x] `frontend/src/components/beta/BetaExcludedNotice.tsx` and its test were removed.

## Production Mock Removals

- [x] `MOCK_RECENT_ACTIVITY` removed from `CommunityPage`.
- [x] `MOCK_STABLE` and `MOCK_HALL_OF_FAME` removed from `MyStablePage`.
- [x] `MOCK_VET_HISTORY` removed from `HorseDetailPage`.
- [x] In-component `mockApi` usage removed from breeding, foal, and trait surfaces.
- [x] Production frontend scan is clean:

```powershell
rg -n "MOCK_|mockApi|allMockHorses|mockSummary" frontend/src --glob "!**/__tests__/**"
```

## Verification

- [x] Focused frontend suite passed: 11 files, 53 tests.
- [x] Backend starter/onboarding integration suite passed: 2 suites, 10 tests.
- [x] Production mock scan passed with no matches.
- [x] Runtime beta-exclusion scan passed with no production matches.
- [x] Required Playwright beta-critical command passed in real beta mode: 3 tests passed.

## Completion Evidence

21R-2 is complete for the 21R-1 through 21R-3 correction scope. Broader beta deployment readiness remains blocked until the later 21R hardening stories are completed.
