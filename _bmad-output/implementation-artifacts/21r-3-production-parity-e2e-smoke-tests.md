# Story 21R-3: Production-Parity E2E Smoke Tests for Beta-Live Routes

**Epic:** 21R - Beta Deployment Readiness Remediation  
**Source:** `docs/sprint-change-proposal-2026-04-11.md`, `docs/beta-route-truth-table.md`, `_bmad-output/sprint-change-proposal-2026-04-13.md`  
**Priority:** P0  
**Status:** backlog

---

## Story

**As a** project lead,  
**I want** every beta-live route covered by a production-parity Playwright E2E test that uses real credentials and real backend data,  
**So that** the beta readiness gate can be unlocked with confidence that the actual game works end-to-end for a new player.

---

## Acceptance Criteria

- **AC1:** Every beta-live route in `docs/beta-route-truth-table.md` is covered by at least one Playwright E2E test.
- **AC2:** No E2E test uses test-only bypass headers, skip annotations, or hardcoded session tokens to avoid the real auth flow.
- **AC3:** The first and required E2E path is the new-player critical path: `register → login → onboarding (pick breed, gender, name) → POST /api/horses creates the horse → /stable renders that horse`. This path must pass before any other E2E path is considered.
- **AC4:** The critical path test asserts that `GET /api/horses` returns the starter horse after onboarding completes (not just that the stable page renders without crashing).
- **AC5:** All E2E tests pass without flakiness in CI on at least two consecutive runs.
- **AC6:** `beta-deployment-readiness` in `sprint-status.yaml` remains `blocked` until this story is marked done by the user.

---

## Tasks / Subtasks

- [ ] **Task 1 - Critical path: new-player onboarding E2E (AC1, AC2, AC3, AC4)**

  > **This task must be implemented first. All other tasks depend on a working new-player flow.**

  - [ ] 1.1 Create Playwright spec `e2e/beta-critical-path.spec.ts` (or update an existing beta-flow spec if one exists at the right path).
  - [ ] 1.2 Implement Path 1 — new-player critical path:
    - Register a fresh account with a unique test email
    - Log in with those credentials (no bypass headers — real cookie auth)
    - Complete the onboarding wizard: select a breed, pick a gender, enter a horse name, and submit
    - Assert that the response from `POST /api/horses` (or `horsesApi.create`) returns a horse ID
    - Assert that `GET /api/horses` returns an array containing a horse matching the name entered in onboarding
    - Assert that `/stable` renders a horse card with the correct name
  - [ ] 1.3 Confirm the test does not use any of the following: `--bypass-auth`, `x-test-user` header, `test-cleanup` route for pre-seeding horses, or any `test.skip()` annotation.
  - [ ] 1.4 Run the test against the local dev stack (backend + frontend running). Record the full pass output in the Dev Agent Record.

- [ ] **Task 2 - Login and stable smoke (AC1, AC2)**
  - [ ] 2.1 Implement Path 2 — returning-player login smoke:
    - Log in as an existing beta account (use the account created in Task 1, or a separately seeded beta test account)
    - Assert `/` (hub) renders without error
    - Assert `/stable` renders the horse list with at least one horse
  - [ ] 2.2 Confirm no bypass headers are used.

- [ ] **Task 3 - Horse detail smoke (AC1, AC2)**
  - [ ] 3.1 Implement Path 3 — horse detail:
    - From the stable, navigate to `/horses/:id` for the starter horse
    - Assert the horse name and breed are visible
    - Assert the page does not render `BetaExcludedNotice` for the core detail section (only for vet history, which is intentionally excluded in beta)
  - [ ] 3.2 Confirm no bypass headers are used.

- [ ] **Task 4 - Remove or replace any existing E2E skips on beta-critical flows (AC2)**
  - [ ] 4.1 Search existing Playwright specs for `test.skip`, `test.fixme`, and `--bypass-auth` / `x-test-user` usage in flows that overlap with beta-live routes.
  - [ ] 4.2 For each skip found: either implement the real test (preferred) or document why the skip is intentional and outside beta-live scope, then assign a follow-up story.
  - [ ] 4.3 Do not leave any `test.skip` on the critical path (Path 1) or the login/stable smoke (Path 2).

- [ ] **Task 5 - CI integration and gate (AC5, AC6)**
  - [ ] 5.1 Confirm that `beta-critical-path.spec.ts` runs in the existing GitHub Actions Playwright job without new configuration.
  - [ ] 5.2 Run two consecutive CI executions or local reruns to confirm no flakiness.
  - [ ] 5.3 Keep `beta-deployment-readiness: blocked` in `sprint-status.yaml` until this story passes user review.
  - [ ] 5.4 After this story is accepted, update `sprint-status.yaml` and remove the `blocked` status only with explicit user approval.

- [ ] **Task 6 - Verification (AC1-AC6)**
  - [ ] 6.1 Run `rg -n "test\.skip|test\.fixme|bypass-auth|x-test-user" e2e/` and confirm no matches in beta-critical paths.
  - [ ] 6.2 Confirm Playwright report shows green for all new tests.
  - [ ] 6.3 Confirm `docs/beta-route-truth-table.md` beta-live routes are all covered by at least one test.

---

## Dev Notes

### Critical Path Ordering

Path 1 (new-player onboarding) **must be implemented first** and must pass before any other E2E work is started. The rationale: if register → onboarding → stable is broken, the entire beta loop is broken and every other E2E test is irrelevant.

The 21R-2 Task 10 fix (horse persistence in `OnboardingPage`) must be complete and in the codebase before this story can be started. Confirm `horsesApi.create` exists in `api-client.ts` and `OnboardingPage.tsx` navigates to `/stable` before writing the E2E test.

### Path 1 Detailed Flow

```
1. POST /api/auth/register   { email, password, name }   → 201
2. POST /api/auth/login      { email, password }         → 200 + cookie
3. GET  /api/auth/profile                                → completedOnboarding: false
4. Navigate to /onboarding
5. Step 0: Welcome — click Next
6. Step 1: Select breed (pick any from dropdown), select gender, enter name → click Next
7. Step 2: Ready — click "Begin"
   → POST /api/horses  { name, breedId, sex, age: 1, userId }   → 201 { id: <horseId> }
   → POST /api/auth/advance-onboarding                           → 200
   → navigate to /stable
8. GET  /api/horses                                      → [ { id: <horseId>, name: <entered name>, ... } ]
9. Assert stable renders horse card with correct name
```

### No Bypass Headers Policy

Per the original Epic 21R scope, production-parity E2E tests must not use:
- `x-test-user` or `x-bypass-auth` headers
- Hardcoded session tokens or cookies
- `test-cleanup` seeding routes to pre-create horses
- Any `test.skip()` on the critical path

These bypasses were introduced in earlier E2E work to work around unimplemented auth flows. This story eliminates them from beta-critical paths.

### Existing E2E Infrastructure

Check these locations before creating new files:
- `e2e/` — Playwright test root
- `playwright.config.ts` — base URL, browser config, reporter settings
- Any existing `auth.spec.ts` or `core-game-flows.spec.ts` that may already cover parts of the login flow

Reuse existing `page.goto`, `page.fill`, `page.click`, `expect(page)` patterns already established in the project.

### Architecture Compliance

- Keep tests in `e2e/` — do not put Playwright tests inside `frontend/src`
- Use Playwright's `test` and `expect` from `@playwright/test` only
- Do not import frontend source files directly into E2E tests
- Network assertion pattern: use `page.waitForResponse` or `APIRequestContext` to assert API calls, not component internals

### Anti-Patterns to Avoid

- Do not seed test data via `DELETE /api/grooms/test/cleanup` or equivalent test-only routes — the point is to test the real creation flow
- Do not assert page text that could change; assert structural testids or API response shapes
- Do not mark tests as passing if they pass due to a beta-excluded fallback (e.g., `BetaExcludedNotice`) rather than the real feature

---

## Dev Agent Record

### Implementation Plan

*(to be filled in during development)*

### Debug Log

*(to be filled in during development)*

### Change Log

- 2026-04-13: Story created from Epic 21R planning. Onboarding critical path added as Path 1 requirement per `_bmad-output/sprint-change-proposal-2026-04-13.md`. Story pre-populated by SM; development begins after 21R-2 Task 10 is complete.

### Completion Notes List

*(to be filled in during development)*

### File List

*(to be filled in during development)*
