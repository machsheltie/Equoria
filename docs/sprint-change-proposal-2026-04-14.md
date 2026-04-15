# Sprint Change Proposal - 21R Active Beta Completion Correction

**Date:** 2026-04-14  
**Project:** Equoria  
**Source:** Adversarial review of 21R-1 through 21R-3  
**Change Type:** Major course correction blocking active beta readiness  
**Scope:** Moderate to major - beta-live routes are exposed but several are still missing live behavior, production-parity verification, or backend support

## 1. Issue Summary

An adversarial review of 21R-1 through 21R-3 found that the current implementation corrected some route-level beta gating, but it did not fully satisfy the active beta policy:

- No production mocks in beta-facing code.
- No beta-read-only substitutes for in-scope routes.
- No beta-hidden substitutes for in-scope routes.
- No "coming soon", disabled, or missing backend behavior on beta-live surfaces.
- Beta testers must be able to actively test all exposed features, and those features must work.

The current artifacts claim 21R-1 through 21R-3 are complete or corrected, but several beta-live routes still contain missing endpoints, disabled query paths, unpassed mutation handlers, stale beta-exclusion tests, and production-parity E2E gaps.

## 2. Evidence From Review

### High - Forgot/reset password are beta-live but backend routes do not exist

`/forgot-password` and `/reset-password` are exposed from the login flow and classified as beta-live. The frontend posts to `/api/auth/forgot-password` and `/api/auth/reset-password`, but the auth hooks still state these backend endpoints are not implemented, and `authRoutes.mjs` does not register those routes.

Evidence:

- `frontend/src/pages/LoginPage.tsx:154`
- `frontend/src/lib/api-client.ts:2042`
- `frontend/src/lib/api-client.ts:2050`
- `frontend/src/hooks/useAuth.ts:200`
- `backend/modules/auth/routes/authRoutes.mjs:700`

### High - Competition entry is still not wired from the beta-live browser

`CompetitionDetailModal` can render an enter button only when `onEnter` is passed, but `CompetitionBrowserPage` opens it without an `onEnter` handler. The `/competitions` route is beta-live, but testers can browse only and cannot enter from the main flow. That is beta-read-only behavior.

Evidence:

- `frontend/src/pages/CompetitionBrowserPage.tsx:151`
- `frontend/src/components/competition/CompetitionDetailModal.tsx:120`
- `frontend/src/components/competition/CompetitionDetailModal.tsx:136`

### High - Bank transaction history is explicitly beta-excluded

`useTransactionHistory` is permanently disabled and throws if enabled. `BankPage` tells testers full transaction history is not available in beta. This violates the beta-live `/bank` contract.

Evidence:

- `frontend/src/hooks/api/useTransactionHistory.ts:6`
- `frontend/src/hooks/api/useTransactionHistory.ts:59`
- `frontend/src/hooks/api/useTransactionHistory.ts:65`
- `frontend/src/pages/BankPage.tsx:194`

### High - 21R-3 is not production-parity proof

The E2E file claims every beta-live route is covered and that no critical path uses `test.skip`, but it covers only three paths and contains skip branches. `playwright.config.ts` sets `VITE_E2E_TEST=true`, which causes mutations to send the `x-test-skip-csrf` header. That is useful for support tests, but it is not production-parity beta readiness evidence.

Evidence:

- `tests/e2e/beta-critical-path.spec.ts:4`
- `tests/e2e/beta-critical-path.spec.ts:11`
- `tests/e2e/beta-critical-path.spec.ts:203`
- `tests/e2e/beta-critical-path.spec.ts:251`
- `tests/e2e/beta-critical-path.spec.ts:280`
- `playwright.config.ts:47`
- `frontend/src/lib/api-client.ts:614`

### Medium - Competition modal tests are stale and currently failing

Focused modal tests still assert that beta competition entry is excluded. The implementation no longer renders `competition-entry-beta-notice`, and the beta test file fails three assertions looking for that removed notice.

Verification result:

```powershell
npm --prefix frontend run test:run -- --run src/components/competition/__tests__/CompetitionDetailModal.test.tsx src/components/competition/__tests__/CompetitionDetailModal.nonbeta.test.tsx
```

Result: `CompetitionDetailModal.nonbeta.test.tsx` passed, `CompetitionDetailModal.test.tsx` failed 3 tests.

Evidence:

- `frontend/src/components/competition/__tests__/CompetitionDetailModal.test.tsx:99`
- `frontend/src/components/competition/__tests__/CompetitionDetailModal.test.tsx:266`

### Medium - Trainer management still allows disabled/pending-auth behavior

The trainer assignment component still documents unassign as disabled pending auth wire-up. Runtime may work when a handler is passed, but the component still accepts a disabled no-op state on a beta-live route.

Evidence:

- `frontend/src/components/trainer/TrainerAssignmentCard.tsx:6`
- `frontend/src/components/trainer/TrainerAssignmentCard.tsx:62`

### Medium - My Stable has a permanent coming-soon control

`/my-stable` is beta-live, but the stable profile edit button is disabled with a "coming soon" title. The page copy says customization exists in profile settings, but the feature is not testable.

Evidence:

- `frontend/src/pages/MyStablePage.tsx:70`
- `frontend/src/pages/MyStablePage.tsx:72`

### Low - Documentation still contradicts active beta policy

The truth table still contains language such as "do not expose", "hide write actions", and beta-excluded notes. This creates permission for future agents to defer live behavior again.

Evidence:

- `docs/beta-route-truth-table.md:26`
- `docs/beta-route-truth-table.md:63`
- `docs/beta-route-truth-table.md:117`

## 3. Good Implementation Found

The review also found real progress:

- `betaRouteScope.ts` now exposes only `beta-live`.
- `App.tsx` no longer wraps active routes in beta exclusion.
- `NavPanel` exposes the primary beta route set.
- Onboarding now sends `horseName`, `breedId`, and `gender` through `advanceOnboarding`.
- The focused 21R frontend suite passed: 11 files, 53 tests.
- The old production mock patterns reviewed for 21R-2 were largely removed from the reviewed production paths.

These fixes are not enough to mark active beta complete because missing live behavior remains on exposed routes.

## 4. Recommended Approach

Direct adjustment inside Epic 21R. Do not reopen broad product scope. Do not hide routes or make them read-only. Fix the exposed beta-live surfaces and expand production-parity verification.

The beta readiness gate remains blocked until these tasks pass.

## 5. Detailed Change Proposals

### Change A - Implement real forgot/reset password support

Add backend support for:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- Secure reset token generation, hashing, expiry, and single-use invalidation.
- Email dispatch path using the existing email service.
- Tests for success, unknown email privacy behavior, expired token, reused token, invalid token, password validation, and login with the new password.

Remove all "not yet implemented" comments from frontend auth hooks and API client once the endpoints are real.

### Change B - Wire competition entry in beta-live browser

Update `/competitions` so testers can enter competitions from the main browser flow:

- Use the existing competition entry mutation.
- Pass `onEnter` into `CompetitionDetailModal`.
- Surface eligibility and mutation errors.
- Refresh competitions and user balance after entry.
- Add focused tests that prove beta mode shows a live entry action, not a beta-excluded notice.
- Update stale `CompetitionDetailModal.test.tsx` assertions.

### Change C - Replace disabled bank transaction history with a real ledger

Implement a real transaction ledger:

- Add backend transaction model or use the existing economy/event source if already available.
- Write ledger rows for weekly claims, purchases, competition entries, prize claims, marketplace transactions, and service bookings.
- Add `GET /api/v1/users/transactions` or equivalent.
- Wire `useTransactionHistory` to the endpoint.
- Remove permanently disabled query behavior and beta-excluded copy from `BankPage`.

### Change D - Rebuild 21R-3 as true production-parity E2E

Split E2E into two categories:

- Production-parity beta readiness: no `test.skip` on critical paths, no `VITE_E2E_TEST` CSRF bypass, no test-only auth bypass, no pre-seeded horses for the new-player path.
- Support smoke tests: may use controlled bypasses, but cannot be used as readiness evidence.

The readiness suite must cover all exposed beta-live route families:

- Auth: register, login, forgot password, reset password, verification behavior where applicable.
- Onboarding: selected starter horse persists and renders in stable.
- Stable and horse detail: view, edit, list/delist, rider assignment, training tab.
- Training: check eligibility and start a real training session.
- Breeding and foal: pair selection, foal creation, foal development actions.
- Competitions: browse, eligibility, enter, result/prize path where supported.
- Bank: claim reward and view persisted ledger entry.
- World services: vet, farrier, feed, tack, crafting.
- Marketplace: buy/list/delist.
- Staff: grooms, riders, trainers hire/assign/unassign.
- Community: message board, clubs, messages write flows.

### Change E - Remove remaining disabled or coming-soon beta-live controls

Audit and fix beta-live pages for:

- `coming soon`
- `not available in this beta`
- `beta-excluded`
- permanently disabled mutation controls
- "pending auth wire-up"
- local-only state where persistence is advertised

Initial known targets:

- `frontend/src/components/trainer/TrainerAssignmentCard.tsx`
- `frontend/src/pages/MyStablePage.tsx`
- `frontend/src/pages/BankPage.tsx`
- `frontend/src/components/competition/CompetitionDetailModal.tsx`

### Change F - Clean truth table language

Update `docs/beta-route-truth-table.md` so every beta-live row states one of:

- Implemented and verified.
- Implemented, but verification is pending with a concrete test/task.
- Blocked by a named implementation task that must be fixed before readiness.

Remove language that instructs future agents to hide, read-only, beta-exclude, or defer exposed route behavior.

## 6. Implementation Handoff

**Scope Classification:** Major beta-readiness correction with direct implementation tasks.

Recommended ownership:

- BackendSpecialistAgent: forgot/reset password endpoints; bank ledger endpoint; transaction persistence.
- FrontendSpecialistAgent: competition entry wiring; bank ledger UI; stale beta-exclusion tests; disabled/coming-soon control cleanup.
- QualityAssuranceAgent: production-parity E2E rebuild; no-skip enforcement; no-bypass readiness mode.
- LeadArchitect: update truth table, sprint status, and Epic 21R story statuses so the gate stays blocked until all fixes pass.

## 7. Success Criteria

The correction is complete only when:

- No production beta-live path uses mock data as the source of truth.
- No beta-live route hides write actions behind beta mode.
- No beta-live route is read-only unless the product explicitly removes the write feature from beta scope.
- No beta-live route contains "coming soon", "not available in beta", "pending wire-up", or permanently disabled queries for in-scope behavior.
- Forgot/reset password works end to end.
- Competition entry works from `/competitions`.
- Bank transaction history is persisted and visible.
- Production-parity beta E2E passes without critical-path skips and without CSRF/auth bypass headers.
- Focused unit/integration tests pass for each corrected feature.
- `docs/beta-route-truth-table.md` and sprint status accurately reflect blocked or complete status.

## 8. Immediate Task List

- [ ] Implement forgot/reset password backend routes and tests.
- [ ] Wire frontend forgot/reset flow to real backend behavior and remove stale "not implemented" comments.
- [ ] Wire `/competitions` entry flow with real mutation and error handling.
- [ ] Replace stale beta-excluded competition modal tests with live-entry tests.
- [ ] Implement persisted bank transaction ledger and frontend history hook.
- [ ] Remove beta-excluded/session-only transaction copy from `BankPage`.
- [ ] Fix trainer unassign pending-auth/disabled contract.
- [ ] Implement or remove My Stable disabled "Edit Profile" placeholder from beta-live UI.
- [ ] Rebuild 21R-3 readiness E2E with no critical skips and no production-parity bypasses.
- [ ] Update `docs/beta-route-truth-table.md` to remove defer/hide/read-only language for beta-live routes.
- [ ] Keep beta deployment readiness blocked until all above items pass.

## 9. Verification Already Performed

Passed:

```powershell
npm --prefix frontend run test:run -- --run src/pages/__tests__/OnboardingPage.test.tsx src/components/layout/__tests__/NavPanel.test.tsx src/components/layout/__tests__/NavPanel.beta.test.tsx src/config/__tests__/betaRouteScopeSync.test.ts src/config/__tests__/betaRouteScope.test.ts src/pages/__tests__/LoginPage.beta.test.tsx src/pages/__tests__/StableView.beta.test.tsx src/pages/breeding/__tests__/BreedingPredictionsPanel.test.tsx src/components/foal/__tests__/EnrichmentActivityPanel.test.tsx src/components/foal/__tests__/MilestoneEvaluationDisplay.test.tsx src/components/traits/__tests__/EpigeneticTraitDisplay.test.tsx
```

Result: 11 files passed, 53 tests passed.

Failed:

```powershell
npm --prefix frontend run test:run -- --run src/components/competition/__tests__/CompetitionDetailModal.test.tsx src/components/competition/__tests__/CompetitionDetailModal.nonbeta.test.tsx
```

Result: 1 file failed, 1 file passed, 3 stale beta-exclusion tests failed.

Not accepted as complete:

```powershell
npx playwright test tests/e2e/beta-critical-path.spec.ts --project=chromium
```

Reason: Existing story records show this command did not complete locally, and the current suite is not sufficient production-parity evidence because it uses skips and test-mode bypass behavior.

## 10. Routing

Route this proposal to the course-correction implementer before any beta readiness sign-off. The implementer should treat the immediate task list as the correction backlog and should not resolve these findings by hiding controls, making surfaces read-only, or deferring beta-live behavior to a later unspecified story.
