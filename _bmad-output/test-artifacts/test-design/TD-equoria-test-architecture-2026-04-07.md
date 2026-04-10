# Test Design — Equoria Full Test Architecture Audit

**Author:** Murat (TEA — Test Excellence Advisor)
**Date:** 2026-04-07 · **Last Updated:** 2026-04-10
**Scope:** 3617 backend tests (226 suites) · 220 Vitest frontend tests · 7 Playwright E2E specs
**Capability:** TD — Risk Assessment + Coverage Strategy
**Output Location:** `_bmad-output/test-artifacts/test-design/`

---

## Revision History

| Date | Change |
|---|---|
| 2026-04-07 | Initial audit — 11 risks, Epic 21 story map |
| 2026-04-10 | R-02 resolved; R-04 resolved; Story 21-1 and 21-2 complete; R-01 partially mitigated (4/18 modules); groomBonusTraits FK fix added |

---

## 1. Test Distribution Analysis

| Layer | Files | Tests (est.) | % Share | Target |
|---|---|---|---|---|
| Backend Jest (`backend/__tests__/`) | 86 | ~3,617 | 87% | ≤ 60% |
| Frontend Vitest (component/integration) | 220 | ~1,200 | 12% | 25–30% |
| E2E Playwright (`tests/e2e/`) | 7 | ~35 | <1% | 5–10% |

**Verdict: Inverted pyramid.** The backend carries full user-journey validation inside Jest/supertest.
E2E coverage is critically under-represented pre-launch.

---

## 2. Risk Register (Probability × Impact Matrix)

| ID | Finding | Category | Prob | Impact | Score | Action | Status |
|---|---|---|---|---|---|---|---|
| R-01 | 18 domain modules — only 4 have co-located tests | TECH | 2 | 3 | **6** | MITIGATE | ⚠️ Partial |
| R-02 | Confirmed flaky tests in `redis-circuit-breaker` | TECH | 3 | 2 | **6** | MITIGATE | ✅ Resolved |
| R-03 | `breeding.spec.ts` E2E — `try/catch` flow control swallows assertion failures | TECH | 3 | 2 | **6** | MITIGATE | 🔴 Open |
| R-04 | No API/integration tests for community, trainers, riders modules | BUS | 2 | 3 | **6** | MITIGATE | ✅ Resolved |
| R-05 | `systemWideIntegration` & `crossSystemValidation` misclassified as integration | TECH | 3 | 2 | **6** | MITIGATE | 🔴 Open |
| R-06 | 47 React Query hooks — zero dedicated hook-level tests | TECH | 3 | 2 | **6** | MITIGATE | 🔴 Open |
| R-07 | Performance tests in normal Jest suite — no SLA gate | PERF | 2 | 2 | **4** | MONITOR | 🔴 Open |
| R-08 | `Math.random()` in test IDs — parallel collision risk | TECH | 2 | 2 | **4** | MONITOR | 🔴 Open |
| R-09 | E2E credential loading via file I/O — fragile across CI agents | OPS | 2 | 2 | **4** | MONITOR | 🔴 Open |
| R-10 | No E2E coverage for inventory/groom lifecycle/community/conformation | BUS | 2 | 2 | **4** | MONITOR | 🔴 Open |
| R-11 | `owasp-comprehensive` tests do real DB writes without isolated schema | SEC | 1 | 3 | **3** | DOCUMENT | 🔴 Open |
| R-12 | `groomBonusTraits` afterEach FK race condition (userId FK on groomAssignment) | TECH | 2 | 1 | **2** | — | ✅ Resolved |

---

## 3. Critical Findings — Score 9 (BLOCK)

~~**R-01: 18 Domain Modules — Zero Module-Level Tests**~~ — **Downgraded to Score 6 (MITIGATE)**

Original score was 9 (3×3). As of 2026-04-10, 4 of 18 modules now have co-located tests:

| Module | Co-located Tests | Notes |
|---|---|---|
| `community/` | 3 files (club, forum, message controllers) | ✅ Added |
| `competition/` | 1 file (conformationShowExecution) | ✅ Added |
| `riders/` | 2 files (riderController, riderMarketplace) | ✅ Added |
| `trainers/` | 1 file (trainerController) | ✅ Added |

**14 modules still have zero co-located tests:** admin, auth, breeding, docs, grooms, health, horses, labs, leaderboards, marketplace, services, training, traits, users.

The convention is now established. Probability reduced (2 → from 3) because the pattern exists. Score: **6**.

**Required next action:** Extend the convention to the remaining 14 modules. Priority order: `grooms`, `training`, `horses`, `breeding`, `auth` (highest business risk first).

---

## 4. High-Risk Findings — Score 6–8 (MITIGATE)

### ✅ R-02: Confirmed Flaky Tests — Redis Circuit Breaker — RESOLVED

**Resolved via:** `fc96d972` (2026-04-07) — `fix(21-2): deterministic circuit breaker tests — replace setTimeout with fake timers`

All `.skip` annotations removed. `jest.useFakeTimers()` + `jest.advanceTimersByTime()` now controls circuit timeout deterministically. The OPEN→HALF_OPEN→CLOSED path is fully tested.

Verification: `grep -c "skip" redis-circuit-breaker.test.mjs` → 0.

---

### R-03: Breeding E2E — try/catch Flow Control (OPEN)

File: `tests/e2e/breeding.spec.ts`

```typescript
try {
  await expect(page.getByRole('heading', { name: 'Breeding Hall' })).toBeVisible({ timeout: 30000 });
} catch (e) {
  // silently continues
}
```

This pattern causes tests to pass silently when assertions fail. Also:
- `page.on('console')` + `page.on('pageerror')` registered in `beforeEach` without cleanup
- Abundant `console.log` debug noise in CI output

**Fix:** Remove `try/catch` flow control. Use `expect.soft()` if you need to continue after non-critical failures. Remove or redirect console hooks.

---

### ✅ R-04: Community, Trainers, Riders — No API Tests — RESOLVED

**Resolved via Epic 21 Story 21-1 + module test additions.**

Co-located tests now exist:
- `backend/modules/community/__tests__/clubController.test.mjs`
- `backend/modules/community/__tests__/forumController.test.mjs`
- `backend/modules/community/__tests__/messageController.test.mjs`
- `backend/modules/riders/__tests__/riderController.test.mjs`
- `backend/modules/riders/__tests__/riderMarketplaceController.test.mjs`
- `backend/modules/trainers/__tests__/trainerController.test.mjs`

---

### R-05: Supertest "Integration" Tests Doing E2E Work (OPEN)

Files: `systemWideIntegration.test.mjs`, `crossSystemValidation.test.mjs`

Both declare "NO MOCKING" and orchestrate full user journeys (create user → create horse → run breeding → training → competition). This is E2E scope running inside Jest/supertest, incurring real-DB cost without delivering browser-level signal.

**Fix:** Slim these to 3–5 cross-system assertions each. Promote the full journey tests to Playwright E2E specs.

---

### R-06: 47 React Query Hooks — Zero Dedicated Hook Tests (OPEN)

`frontend/src/hooks/api/` contains 47 hooks. All testing is indirect via component tests.
Hook-level logic (error handling, cache invalidation, mutation side effects) is invisible to the suite.

**Fix:** Add `renderHook` Vitest tests for the 10 highest-risk hooks using `@testing-library/react`:
auth hooks, competition entry mutation, breeding mutation, training mutation, inventory equip/unequip.

---

## 5. Monitor-Level Findings — Score 4–5

| ID | Finding | Recommended Action | Status |
|---|---|---|---|
| R-07 | Performance tests in normal Jest suite | Move to `jest.performance.config.mjs` + dedicated CI job | 🔴 Open |
| R-08 | `Math.random()` in test IDs | Replace with `Date.now()` + suite-name suffix | 🔴 Open |
| R-09 | File-based E2E credential loading | Migrate fully to Playwright `storageState` | 🔴 Open |
| R-10 | E2E coverage gaps (inventory, grooms, community, conformation) | Add P1 Playwright specs | 🔴 Open |

---

## 6. New Finding (2026-04-10) — Resolved

### ✅ R-12: groomBonusTraits afterEach FK Race Condition

**File:** `backend/tests/groomBonusTraits.test.mjs`

**Pattern:** `afterEach` deleted horse → groom → user → breed without first removing `groomAssignment` and `groomInteraction` child records. Groom was also deleted after user despite holding a `userId` FK. Under parallel test execution this triggered `Foreign key constraint violated on groom_assignments_userId_fkey`.

**Resolved via:** `0ee95282` (2026-04-10) — `fix(tests): prevent groomBonusTraits FK race condition in afterEach`

Fix: deleteMany for `groomInteraction` + `groomAssignment` before horse/groom/user deletion; reordered groom before user; each step wrapped in `try/catch` to prevent cascade abort.

---

## 7. Coverage Gap Matrix

| Domain | Unit | Integration | E2E | Priority | Gap Severity |
|---|---|---|---|---|---|
| Auth / JWT | ✅ | ✅ | ✅ | P0 | None |
| Horses (CRUD) | ✅ | ✅ | ✅ | P0 | None |
| Breeding genetics | ✅ | ✅ | Partial | P0 | Low |
| Training system | ✅ | ✅ | ✅ | P0 | None |
| Competition / Shows | ✅ | ✅ | ✅ | P0 | None |
| Conformation scoring | ✅ | ✅ | ❌ | P1 | Medium |
| Groom lifecycle | ✅ | Partial | ❌ | P1 | High |
| Community (clubs/forums) | ✅ | ✅ | ❌ | P1 | Medium ↓ |
| Trainers | ✅ | ✅ | ❌ | P1 | Medium ↓ |
| Riders | ✅ | ✅ | ❌ | P1 | Medium ↓ |
| Inventory / Tack shop | Partial | Partial | ❌ | P1 | High |
| React Query hooks | ❌ | — | — | P1 | High |
| Security (OWASP) | ✅ | ✅ | ❌ | P0 | Low |
| Rate limiting | ✅ | ✅ | ❌ | P0 | Low |

*(Community/trainers/riders downgraded from Critical → Medium after module test additions)*

---

## 8. Wrong Test Level Summary

| File | Current Level | Correct Level | Rationale | Status |
|---|---|---|---|---|
| `systemWideIntegration.test.mjs` | Integration (Jest) | E2E or slim integration | Full user journey, real DB | 🔴 Open |
| `crossSystemValidation.test.mjs` | Integration (Jest) | E2E or slim integration | Multi-system user workflows | 🔴 Open |
| `databaseOptimization.test.mjs` | Integration (Jest) | Performance (separate pipeline) | Benchmark needs isolated SLA gates | 🔴 Open |
| `redis-circuit-breaker.test.mjs` | Integration | Unit with fakeTimers | Tests internal state machine, not HTTP boundary | ✅ Fixed |
| `security/auth-bypass-attempts.test.mjs` | Integration | Unit (middleware) | Tests Express middleware in isolation | 🔴 Open |

---

## 9. Flakiness Risk Register

| File | Flakiness Pattern | Severity | Status |
|---|---|---|---|
| `redis-circuit-breaker.test.mjs` | Async event timing — confirmed skipped, self-documented | **P0** | ✅ Resolved (`fc96d972`) |
| `groomBonusTraits.test.mjs` | FK constraint race in afterEach | **P0** | ✅ Resolved (`0ee95282`) |
| `tests/e2e/breeding.spec.ts` | `try/catch` flow control swallows failures | **P1** | 🔴 Open |
| `tests/e2e/core-game-flows.spec.ts` | File I/O credential loading — CI ordering dependency | P1 | 🔴 Open |
| `databaseOptimization.test.mjs` | `Math.random()` in IDs + no cleanup guarantee | P2 | 🔴 Open |
| `systemWideIntegration.test.mjs` | Real DB shared state, no schema isolation | P2 | 🔴 Open |

---

## 10. Epic 21 Story Map (Sprint Plan)

| Story | Title | Risk IDs | Priority | TEA Step | Status |
|---|---|---|---|---|---|
| 21-1 | Establish module-level test convention + remove internal service mocks | R-01, R-04 | P0 | AT before dev | ✅ Complete |
| 21-2 | Fix redis circuit breaker flaky tests | R-02 | P0 | AT before dev | ✅ Complete |
| 21-3 | Add community/trainers/riders API tests | R-04 | P0 | AT before dev | ✅ Complete (via 21-1) |
| 21-4 | Fix E2E breeding spec quality | R-03 | P1 | AT before dev | 🔴 Open |
| 21-5 | React Query hook tests | R-06 | P1 | AT before dev | 🔴 Open |
| 21-6 | Reclassify supertest integration tests | R-05 | P1 | AT before dev | 🔴 Open |
| 21-7 | Performance test pipeline separation | R-07 | P2 | — | 🔴 Open |
| 21-8 | E2E credential strategy migration | R-08, R-09 | P2 | — | 🔴 Open |
| 21-9 | E2E coverage for missing features | R-10 | P2 | AT before dev | 🔴 Open |

---

## 11. Pre-Epic TEA Steps Required

Before remaining Epic 21 stories begin:

1. **TEA:CI** — Audit the GitHub Actions pipeline for quality gate gaps (missing steps, no coverage threshold, no SLA gate on performance tests). `Equoria-7ga` — ready to run now that TD is complete.
2. **TEA:AT** — Write failing acceptance tests before coding each remaining story (21-4 through 21-9).

---

## 12. Gate Decision

**Overall: CONCERNS** (downgraded from BLOCK)

The original BLOCK condition (zero module tests for community/trainers/riders) has been resolved. Two P0 flaky test sources eliminated.

Remaining gate concerns:
- R-01 still partially open: 14 of 18 modules lack co-located tests
- R-03: `breeding.spec.ts` try/catch swallows failures — unreliable E2E signal
- R-06: 47 React Query hooks untested at hook level

**Upgrade to FAIL condition:** If E2E breeding spec (R-03) is not fixed before Railway production deploy, E2E coverage is unreliable.

**Next steps in canonical order:**
1. `TEA:CI` → pipeline audit (`Equoria-7ga`) — run now
2. Stories 21-4, 21-5, 21-6 → P1 mitigations (in that order)
3. Stories 21-7, 21-8, 21-9 → P2 cleanup
