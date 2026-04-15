# Equoria — Epic 21: Test Architecture Quality Sprint

**Author:** Heirr + Murat (TEA)
**Date:** 2026-04-07
**Source:** TD audit `_bmad-output/test-artifacts/test-design/TD-equoria-test-architecture-2026-04-07.md`
**Context:** Backfill epic between Epics 20 (Backend Refactor ✅) and 22 (Celestial Night).
Addresses coverage gaps and structural test debt found during full TD audit of 3617 tests / 226 suites.

---

## Overview

The TD audit identified a BLOCK-level structural gap (18 domain modules with zero tests),
5 HIGH-risk findings (confirmed flaky tests, missing API coverage for 3 modules, E2E quality issues,
47 untested React Query hooks, and misclassified E2E-scope tests), and 4 MONITOR-level findings.

This sprint resolves all BLOCK and HIGH risks before production launch on Railway.

**Gate decision from TD:** CONCERNS → must resolve R-01 and R-04 before deploying.

**Course correction amendment (2026-04-11):** Selected-user beta is blocked until Epic 21R passes. Graceful skips, test-only security bypass headers, and mock-backed beta-critical player journeys are no longer acceptable for readiness evidence.

---

## Pre-Sprint TEA Steps (Required Before Story 21-1)

| Step   | Capability       | Goal                                                                    |
| ------ | ---------------- | ----------------------------------------------------------------------- |
| TEA:TR | `/bmad-tea` → TR | Map all PRD requirements to existing tests; produce traceability matrix |
| TEA:CI | `/bmad-tea` → CI | Audit GitHub Actions pipeline; identify missing quality gates           |

Both must complete before Story 21-1 begins.

---

## Stories

### Story 21-1: Establish Module-Level Test Convention

**Risk:** R-01 (Score 9 — BLOCK)
**Priority:** P0

**Goal:** Co-locate unit tests with the domain modules they cover. Establish the `backend/modules/<domain>/__tests__/` pattern starting with the three zero-coverage domains.

**Acceptance Criteria:**

- AC1: `backend/modules/community/__tests__/` exists with at least unit tests for `clubController.mjs`, `forumController.mjs`, `messageController.mjs`
- AC2: `backend/modules/trainers/__tests__/` exists with at least unit tests for the trainer controller(s)
- AC3: `backend/modules/riders/__tests__/` exists with at least unit tests for `riderController.mjs` and `riderMarketplaceController.mjs`
- AC4: All new tests pass CI
- AC5: A `CONTRIBUTING.md` note or CLAUDE.md rule documents the co-location convention for future epics

**Test Notes:** TEA:AT must produce failing acceptance tests for AC1–AC3 before dev begins.

---

### Story 21-2: Fix Redis Circuit Breaker Flaky Tests

**Risk:** R-02 (Score 6 — MITIGATE)
**Priority:** P0

**Goal:** Remove all `.skip` annotations from `backend/__tests__/integration/redis-circuit-breaker.test.mjs`. Fix state transition tests using deterministic timer control.

**Acceptance Criteria:**

- AC1: All tests in `redis-circuit-breaker.test.mjs` are unskipped and passing
- AC2: OPEN → HALF_OPEN → CLOSED circuit state transition is explicitly tested
- AC3: Tests use `jest.useFakeTimers()` + `jest.advanceTimersByTime()` (no real `setTimeout` in test body)
- AC4: No async event timing assumptions remain in the test file

**Test Notes:** TEA:AT writes the failing state-transition tests first. No real Redis dependency in these unit-scope tests.

---

### Story 21-3: Add Community / Trainers / Riders API Integration Tests

**Risk:** R-04 (Score 6 — MITIGATE)
**Priority:** P0

**Goal:** Add supertest integration tests for all three zero-coverage module groups.

**Acceptance Criteria:**

- AC1: `community` — tests cover happy path + auth guard + validation error for club create/list, forum create/list, message send
- AC2: `trainers` — tests cover happy path + auth guard + validation error for trainer hire/list/assign
- AC3: `riders` — tests cover happy path + auth guard + validation error for rider hire/list/assign, marketplace browse
- AC4: All tests placed in `backend/modules/<domain>/__tests__/` (co-location from 21-1)
- AC5: All tests pass CI

**Test Notes:** TEA:AT before dev for each module group.

---

### Story 21-4: Fix E2E Breeding Spec Quality

**Risk:** R-03 (Score 6 — MITIGATE)
**Priority:** P1

**Goal:** Eliminate try/catch flow control, console log noise, and unregistered event listeners from `tests/e2e/breeding.spec.ts`.

**Acceptance Criteria:**

- AC1: No `try/catch` blocks used for test flow control in `breeding.spec.ts`
- AC2: `console.log` debug statements removed; `page.on('console')` redirected to `test.info()` if kept
- AC3: `page.on('pageerror')` listener registered inside `test.use()` or fixture, not raw `beforeEach`
- AC4: Existing breeding test scenarios still pass
- AC5: `expect.soft()` used where non-critical continuation is needed (instead of catch-and-swallow)

---

### Story 21-5: React Query Hook Tests

**Risk:** R-06 (Score 6 — MITIGATE)
**Priority:** P1

**Goal:** Add `renderHook` Vitest tests for the 10 highest-risk React Query hooks.

**Target hooks (by impact):**

1. `useLogin` / `useLogout` / `useRegister` (auth — P0)
2. `useEnterCompetition` (game-critical mutation)
3. `useBreedHorses` (game-critical mutation)
4. `useTrainHorse` (game-critical mutation)
5. `useEquipItem` / `useUnequipItem` (inventory)
6. `useHorseById` (cache invalidation after training/competition)

**Acceptance Criteria:**

- AC1: Each target hook has a `.test.ts` file in `frontend/src/hooks/api/__tests__/`
- AC2: Tests cover: successful call, error state, cache invalidation after mutation
- AC3: Tests use `@testing-library/react` `renderHook` + React Query test wrapper
- AC4: MSW used for API mocking (`onUnhandledRequest: 'error'` strict mode)
- AC5: All tests pass `npm test` in frontend

**Test Notes:** TEA:AT produces the failing test stubs first.

---

### Story 21-6: Reclassify Supertest Integration Tests

**Risk:** R-05 (Score 6 — MITIGATE)
**Priority:** P1

**Goal:** Slim `systemWideIntegration.test.mjs` and `crossSystemValidation.test.mjs` to true integration tests; promote the user journey scenarios to Playwright E2E specs.

**Acceptance Criteria:**

- AC1: `systemWideIntegration.test.mjs` covers only 3–5 cross-system data integrity checks (no full user journeys)
- AC2: `crossSystemValidation.test.mjs` covers only system boundary assertions (not full workflows)
- AC3: The extracted user journeys are represented as new Playwright specs in `tests/e2e/`
- AC4: Total test execution time for the integration suite decreases measurably
- AC5: No coverage regression (all former assertions either preserved or replaced by E2E spec)

---

### Story 21-7: Performance Test Pipeline Separation

**Risk:** R-07 (Score 4 — MONITOR)
**Priority:** P2

**Goal:** Extract performance benchmarks from the normal Jest suite and run them in a dedicated pipeline step with SLA gates.

**Acceptance Criteria:**

- AC1: `jest.performance.config.mjs` exists with `--testTimeout=30000` and `--testPathPattern=performance`
- AC2: Normal `npm test` does NOT run performance tests
- AC3: A GitHub Actions job `test-performance` runs performance tests separately with explicit `< 100ms` SLA assertions
- AC4: Pipeline fails if response time targets are exceeded

---

### Story 21-8: E2E Credential Strategy Migration

**Risk:** R-08, R-09 (Score 4 — MONITOR)
**Priority:** P2

**Goal:** Replace `test-credentials.json` file-based auth with Playwright `storageState` throughout all E2E specs. Replace `Math.random()` test IDs with deterministic alternatives.

**Acceptance Criteria:**

- AC1: `test-credentials.json` reading removed from `core-game-flows.spec.ts`
- AC2: All E2E tests load auth via `storageState` (from global-setup or fixture)
- AC3: `Math.random()` usage in test ID generation replaced with `Date.now()` + suite-name suffix throughout integration tests
- AC4: E2E suite still passes fully

---

### Story 21-9: E2E Coverage for Missing P1 Features

**Risk:** R-10 (Score 4 — MONITOR)
**Priority:** P2

**Goal:** Add Playwright E2E specs for features with zero E2E coverage.

**Target scenarios:**

- Groom lifecycle: hire → assign to foal → record interaction
- Inventory: equip item to horse
- Community: view clubs list, create a post in a forum
- Conformation show: browse shows → enter horse → view results

**Acceptance Criteria:**

- AC1: `tests/e2e/groom-lifecycle.spec.ts` — 3+ passing tests covering hire/assign/interact
- AC2: `tests/e2e/inventory.spec.ts` — happy-path equip flow tested
- AC3: `tests/e2e/community.spec.ts` — browse clubs + forum post if community is in beta scope; if backend is not wired, the feature must be removed from beta navigation instead of gracefully skipped
- AC4: `tests/e2e/conformation-shows.spec.ts` — browse + enter + result check
- AC5: All new specs use `storageState` auth (no file I/O), network-first wait patterns

**Test Notes:** TEA:AT produces failing test stubs before coding.

---

## Definition of Done (Epic Level)

- [ ] All 9 stories reach `done` status
- [ ] TEA:TR traceability matrix produced and gap-free for P0/P1 requirements
- [ ] TEA:CI audit complete; all identified pipeline gaps resolved
- [ ] No `.skip` tests remain in `redis-circuit-breaker.test.mjs`
- [ ] No beta-critical Playwright spec uses `test.skip()` for unwired gameplay
- [ ] No beta-critical Playwright spec or frontend client path uses `x-test-skip-csrf` or `x-test-bypass-rate-limit`
- [ ] Zero coverage for community/trainers/riders eliminated
- [ ] E2E flakiness patterns removed from breeding spec
- [ ] Performance pipeline separated
- [ ] TD gate decision upgrades from CONCERNS → PASS

---

## Retrospective

Scheduled after all stories are done: `/bmad-retrospective`
