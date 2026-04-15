---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-04-10'
scope: suite
stack: fullstack
executionMode: sequential
---

# Equoria — Test Quality Review Report

**Date:** 2026-04-10  
**Reviewer:** Murat (TEA — Master Test Architect)  
**Scope:** Full suite — backend (270 .mjs), frontend (220 Vitest), E2E (10 Playwright specs)  
**Stack:** Node.js/Express (Jest ESM) + React 19 (Vitest) + Playwright

---

## Overall Score

| Score | Grade | Assessment |
|---|---|---|
| **77 / 100** | **C** | Solid foundation, two real blockers, nine fixable warnings |

---

## Dimension Scores

| Dimension | Score | Grade | Weight | Contribution |
|---|---|---|---|---|
| Determinism | 65/100 | D+ | 30% | 19.5 |
| Isolation | 88/100 | B+ | 30% | 26.4 |
| Maintainability | 75/100 | C | 25% | 18.75 |
| Performance | 85/100 | B | 15% | 12.75 |
| **Overall** | **77/100** | **C** | — | — |

> Coverage is excluded from `test-review` scoring. Use **TR (Trace)** for coverage gate analysis.

---

## Critical Findings (HIGH Severity)

### H-01 · `foalEnrichment.test.mjs:44–47` — Unmocked `Math.random()` in Test Helper

**Dimension:** Determinism  
**Risk:** Test outcomes vary between runs depending on random bonding/stress values

```javascript
// foalEnrichment.test.mjs — calculateActivityOutcome()
const bondingChange =
  Math.floor(Math.random() * (activity.bondingRange[1] - activity.bondingRange[0] + 1)) + activity.bondingRange[0];
const stressChange =
  Math.floor(Math.random() * (activity.stressRange[1] - activity.stressRange[0] + 1)) + activity.stressRange[0];
```

**Fix:** Mock `Math.random` before tests that call this helper:
```javascript
beforeEach(() => {
  jest.spyOn(Math, 'random').mockReturnValue(0.5); // deterministic midpoint
});
afterEach(() => jest.restoreAllMocks());
```
Or extract `calculateActivityOutcome` from the test file into production code and mock it at the module boundary.

---

### H-02 · `integration/api-response-integration.test.mjs:491–506` — Wall-Clock Performance Assertions

**Dimension:** Determinism + Performance  
**Risk:** `expect(responseTime).toBeLessThan(1000)` will flake on loaded CI runners; creates false failures unrelated to code quality

```javascript
const startTime = Date.now();
const response = await request(app).get('/api/test/success')...;
const responseTime = Date.now() - startTime;
expect(responseTime).toBeLessThan(1000); // ← non-deterministic
```

**Fix:** Remove wall-clock assertions from unit/integration tests. If response time SLAs matter, move them to the `performance-tests` job (advisory, `continue-on-error: true` in `test.yml`) using k6 or a dedicated benchmark suite. Replace with structural assertions:
```javascript
expect(response.status).toBe(200);
expect(response.headers['x-response-size']).toBeDefined();
// Remove timing assertions from integration tests
```

---

## Warnings (MEDIUM Severity)

### M-01 · `unit/breedingAnalyticsService.test.mjs:127–136` — Random Stats in DB Seed

**Dimension:** Determinism + Maintainability  
10 horse stats seeded with `Math.random()`. Analytics aggregation tests may produce edge-case failures when random values cluster at extremes.

**Fix:** Use fixed values or a seeded range:
```javascript
// Replace Math.random() seed with fixed values
speed: 75, stamina: 80, agility: 72, balance: 68, precision: 85,
intelligence: 70, boldness: 77, flexibility: 73, obedience: 81, focus: 79,
```

---

### M-02 · `tests/e2e/breeding.spec.ts:136` — Hard Wait 2000ms

**Dimension:** Performance  
`await page.waitForTimeout(2000)` — adds dead time to every CI E2E run.

**Fix:**
```typescript
// Replace:
await page.waitForTimeout(2000);

// With:
await page.waitForResponse(resp => resp.url().includes('/api/foals') && resp.status() === 200);
// or:
await expect(page.getByTestId('foal-name')).toBeVisible();
```

---

### M-03 · `tests/e2e/celestial-night-navigation.spec.ts:78` — Hard Wait 2000ms

Same pattern as M-02. Replace with `waitForResponse` or element condition.

---

### M-04 · `integration/advancedBreedingGeneticsAPI.test.mjs` — Known Parallel DB Flake

**Dimension:** Isolation  
Passes in isolation, fails under parallel suite load — a pre-existing confirmed issue (identified in prior sprint). Root cause: shared DB state across concurrent test workers during genetics API setup.

**Fix:** Add `testEnvironment` override to run this file serially in the Jest shard config, or add the `UNIQUE` timestamp suffix used by other integration tests throughout its fixtures. Track in: `bd create --title="Fix parallel isolation in advancedBreedingGeneticsAPI" --type=bug`

---

### M-05 · `foalEnrichment.test.mjs` — Production Logic Embedded in Test File

**Dimension:** Maintainability  
`calculateActivityOutcome()` performs real algorithmic computation inside a test file. Unclear whether it's testing the production function or re-implementing it.

**Fix:** If this is testing production logic: import the actual function from the service. If it's test-only scaffolding: extract to `backend/tests/helpers/` and make the random calls injectable.

---

### M-06 · `auth-working.test.mjs` — Manual State Tracking Instead of Fixtures

**Dimension:** Maintainability  
`createdUserIds` Set tracked manually across 350+ lines. Works, but is fragile — if a test throws before the Set is populated, cleanup may miss records.

**Fix:** Consider extracting a `createTestUser()` helper that registers for cleanup automatically:
```javascript
// tests/helpers/userFixture.mjs
export function makeUserFactory(prisma) {
  const ids = [];
  const create = async (data) => {
    const user = await prisma.user.create({ data });
    ids.push(user.id);
    return user;
  };
  const cleanup = async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    ids.length = 0;
  };
  return { create, cleanup };
}
```
This is a refactor, not a blocker — flag for Epic 22 test quality sprint.

---

### M-07 · `integration/api-response-integration.test.mjs:130` — Random Value in Payload

`value: Math.random() * 100` in test payload. If any assertion depends on this value, test is non-deterministic. Use a fixed value (`value: 42.5`).

---

## Notices (LOW Severity)

| ID | File | Finding |
|---|---|---|
| L-01 | `groomHiringWorkflow.test.mjs` (893 ln) | Consider splitting into hiring/assignment/interaction concerns |
| L-02 | `resultModel.test.mjs` (849 ln) | Large but structured; no action required unless adding tests |
| L-03 | `atBirthTraits.test.mjs` (812 ln) | Overlaps with `applyEpigenetic*.test.mjs` — may have duplicate coverage |
| L-04 | `core-game-flows.spec.ts` (320 ln) | Marginally over E2E 300-line guidance; justified by test count |
| L-05 | `horseAgingSystem.test.mjs:67` | ID uses `Math.random()` — unguessable, but harder to reproduce on failure |
| L-06 | `playwright.config.ts` | `workers: 1` on CI limits parallel E2E — acceptable for DB isolation, intentional |

---

## What's Working Well

| Area | Observation |
|---|---|
| **Describe grouping** | 0 backend test files lack `describe()` structure — 100% organised |
| **Cleanup discipline** | All integration files using Prisma have `afterAll` — no orphaned DB records |
| **Cross-VM realm pattern** | `threw = true` / try-catch pattern established for Prisma errors under `--experimental-vm-modules` |
| **Math.random mocking** | `applyEpigenetic*` tests correctly mock `Math.random` via `jest.spyOn` |
| **UNIQUE suffix convention** | `Date.now() + random` for unique naming is project-wide convention — parallel-safe |
| **CI pipeline** | New `test.yml` with 3 shards + coverage gate + advisory performance job is solid |

---

## Prioritised Fix List (Top 5)

| Priority | Item | Effort | Impact |
|---|---|---|---|
| P1 | Fix H-01: Mock `Math.random` in `foalEnrichment.test.mjs` | 15 min | Eliminates true non-determinism |
| P1 | Fix H-02: Remove wall-clock assertions from `api-response-integration.test.mjs` | 20 min | Prevents CI flake on busy runners |
| P2 | Fix M-01: Replace random stats with fixed values in `breedingAnalyticsService.test.mjs` | 10 min | Deterministic seed data |
| P2 | Fix M-02/M-03: Replace `waitForTimeout` with network/element waits in 2 E2E specs | 30 min | Reliable E2E, ~4s faster per run |
| P3 | Fix M-04: Isolate `advancedBreedingGeneticsAPI` from parallel workers | 1–2 hr | Eliminates known flaky suite |

---

## AT and TA Decision

**Short answer: AT is not applicable now; TA is optional but low priority.**

| Workflow | Applicable? | Reasoning |
|---|---|---|
| **AT (ATDD)** | No | AT generates failing acceptance tests *before* implementation. Equoria Epics 1–20 are complete. AT only applies to future stories (e.g. a new Epic 22 story) before a developer starts work. |
| **TA (Test Automation)** | Low priority | TA expands test coverage for a specific story/epic. With 3651+ backend tests and the 70% coverage gate now enforced in `test.yml`, coverage is unlikely to be the bottleneck. The gaps surfaced by this RV are *quality* issues (determinism, performance) not *coverage* gaps. Fix the P1/P2 violations above before running TA. |

**When to reconsider TA:** If the Traceability run (TR) surfaces specific acceptance criteria with no test coverage — particularly for the new conformation show system (Epic 31B/C/F) — TA would be the right next step scoped to those epics.

---

## Recommended Next Steps

1. **Fix P1 violations** (H-01, H-02) — 35 minutes of work, eliminates the two real CI risks
2. **Fix P2 violations** (M-01, M-02, M-03) — deterministic data + faster E2E
3. **Run TR (Traceability)** — map requirements from Epics 31B/C/F to existing tests and get a gate decision on those new systems
4. **Fix M-04** — track as a bug in beads, resolve in next available sprint slot

---

*Generated by Murat — TEA Master Test Architect | Score methodology: Determinism 30%, Isolation 30%, Maintainability 25%, Performance 15%*
