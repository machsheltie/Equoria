---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03a-determinism
  - step-03b-isolation
  - step-03c-maintainability
  - step-03e-performance
  - step-03f-aggregate
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-04-10'
epic: 31F
reviewScope: suite
inputDocuments:
  - backend/__tests__/conformationShowScoring.test.mjs
  - backend/__tests__/conformationShowEntry.test.mjs
  - backend/__tests__/conformationShowExecution.test.mjs
  - _bmad-output/implementation-artifacts/31f-2-show-entry-and-eligibility.md
  - _bmad-output/implementation-artifacts/epic-31f-retro-2026-04-09.md
  - _bmad-output/test-artifacts/31f-automation-summary.md
---

# Epic 31F — Test Quality Review (TEA:RV)

**Epic:** 31F — Conformation Show Handling
**Date:** 2026-04-10
**Reviewer:** Murat (TEA — retroactive RV)
**Scope:** suite (3 files, 117+ tests across all 3 stories)
**Stack:** backend (Jest --experimental-vm-modules, Node.js, Prisma mocked)
**Execution Mode:** sequential

> **Coverage boundary:** This review assesses test quality (determinism, isolation, maintainability, performance). Requirements → test traceability and coverage gate decisions are handled by TEA:TR (next step).

---

## Score Summary

| Dimension | Weight | Score | Grade |
|-----------|--------|-------|-------|
| Determinism | 30% | 94 | A |
| Isolation | 30% | 91 | A- |
| Maintainability | 20% | 81 | B- |
| Performance | 20% | 97 | A+ |
| **Overall** | | **91.1** | **A-** |

**Verdict: PASS** — Suite is production-quality with no blocking issues. All findings are improvements, not defects.

---

## Files Reviewed

| File | Lines | Tests | Stories |
|------|-------|-------|---------|
| `conformationShowScoring.test.mjs` | 643 | 60+ | 31F-1 |
| `conformationShowEntry.test.mjs` | ~640 | 20 | 31F-2 |
| `conformationShowExecution.test.mjs` | 529 | 37 | 31F-3 |

---

## Findings by Severity

### MEDIUM (2 findings — address in next story)

#### [RV-M1] `clearAllMocks()` vs `resetAllMocks()` inconsistency

- **File:** `conformationShowScoring.test.mjs:507` (`beforeEach`)
- **Dimension:** Isolation
- **Risk:** `clearAllMocks()` preserves `mockResolvedValueOnce` queue values across tests. If any future test in the scoring file adds a `mockResolvedValueOnce` call, values will leak silently into subsequent tests — exactly the bug documented in the 31F-2 retro debug log ("Mock queue leakage"). The other two files correctly use `resetAllMocks()`.
- **Fix:**

```js
// conformationShowScoring.test.mjs — change beforeEach from:
beforeEach(() => {
  jest.clearAllMocks();
  prisma.groomAssignment.findFirst.mockResolvedValue(mockAssignment);
});

// to:
beforeEach(() => {
  jest.resetAllMocks();
  prisma.groomAssignment.findFirst.mockResolvedValue(mockAssignment);
});
```

- **Note:** `resetAllMocks()` wipes `mockResolvedValue` too — you must re-apply the default in the same `beforeEach`. The existing code already does this (`prisma.groomAssignment.findFirst.mockResolvedValue(mockAssignment)` on the next line), so the fix is a one-word swap.

---

#### [RV-M2] Test file co-location violates CONTRIBUTING.md 21-1 rule

- **Files:** All 3 (`backend/__tests__/conformationShowScoring.test.mjs`, `conformationShowEntry.test.mjs`, `conformationShowExecution.test.mjs`)
- **Dimension:** Maintainability
- **Risk:** CONTRIBUTING.md rule 21-1 specifies module-level tests belong in `backend/modules/<domain>/__tests__/`. These are competition-module tests and should be at `backend/modules/competition/__tests__/`. The retro noted this violation was caught and corrected for 31F-3, then apparently reverted or was committed at the wrong path.
- **Fix:** File story to migrate these 3 files to `backend/modules/competition/__tests__/` in a non-breaking move (update any path references). Do NOT move inline — requires permission per CONTRIBUTING.md.
- **Impact:** CI still finds and runs them; this is structural debt, not a functional defect.

---

### LOW (4 findings — fix opportunistically)

#### [RV-L1] `Date.now()` in fixture data — latent flakiness risk

- **Files:** `conformationShowScoring.test.mjs:504`, `conformationShowEntry.test.mjs:109`, `conformationShowEntry.test.mjs` (G2 test)
- **Dimension:** Determinism
- **Risk:** Fixtures create relative timestamps (`Date.now() - 5 days`, `Date.now() - 3 days`, `Date.now() - 12 hours`) that work reliably against the 2-day business-rule threshold. If the threshold is ever raised above 5 days, the "5 days ago" fixture would silently flip from passing to failing validation. Not currently flaky — risk is deferred to future threshold changes.
- **Fix (optional):** Extract to named constants that document the intent:

```js
// Instead of inline magic:
const FIVE_DAYS_AGO = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

// Or use a helper that's clearly above the business rule threshold:
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SAFELY_OLD_ASSIGNMENT_DATE = new Date(Date.now() - 5 * MS_PER_DAY); // 5 days >> 2-day minimum
const RECENTLY_ASSIGNED_DATE = new Date(Date.now() - 0.5 * MS_PER_DAY);  // 12 hours << 2-day minimum
```

---

#### [RV-L2] `buildReq`/`buildRes` helpers duplicated across 2 files

- **Files:** `conformationShowEntry.test.mjs`, `conformationShowExecution.test.mjs`
- **Dimension:** Maintainability / Isolation
- **Risk:** Copy-paste duplication means changes to the helper pattern must be made in 2 places. Low impact now; scales poorly as more controller tests are added.
- **Fix (optional):** Create `backend/__tests__/helpers/expressTestHelpers.mjs` with shared `buildReq`/`buildRes`. Import in both files. Only worth doing when adding a 3rd or 4th controller test file.

---

#### [RV-L3] Inline time-constant expressions without named values

- **Files:** All 3 files
- **Dimension:** Maintainability
- **Pattern:** `5 * 24 * 60 * 60 * 1000`, `3 * 24 * 60 * 60 * 1000`, `12 * 60 * 60 * 1000`
- **Fix:** Extract to `MS_PER_DAY` constant at file top. See RV-L1 for example.

---

#### [RV-L4] Closure-based mock state pattern requires careful onboarding

- **File:** `conformationShowExecution.test.mjs`
- **Dimension:** Maintainability
- **Pattern:** `_mockExecuteResult` and `_mockExecuteError` are module-level `let` variables captured by the `jest.unstable_mockModule` factory closure. This is a valid and necessary workaround for the Jest VM modules isolation model, but it's non-obvious.
- **Fix:** The existing inline comment (`// set per test`) is helpful. Add a one-line header comment explaining the closure pattern:

```js
// _mockExecuteResult and _mockExecuteError are set PER TEST (see beforeEach reset).
// The mock factory closes over these let variables — reassigning them before calling
// the handler is picked up by the mock because JS closures capture by reference.
let _mockExecuteResult = null;
let _mockExecuteError = null;
```

---

### PASS (positive findings — no action needed)

| Check | Files | Finding |
|-------|-------|---------|
| `jest.resetAllMocks()` in `beforeEach` | Entry, Execution | ✅ Prevents queue leakage |
| No real DB I/O in any test | All 3 | ✅ Balanced mocking enforced |
| AC-to-describe traceability | All 3 | ✅ `describe('AC1 —', ...)` pattern makes failures immediately traceable to requirements |
| No test order dependencies | All 3 | ✅ Each test is self-contained |
| No `Math.random()` or unseeded randomness | All 3 | ✅ All test data is deterministic |
| No hard waits | All 3 | ✅ N/A for unit/integration tests |
| Assertion explicitness | All 3 | ✅ No hidden assertions in helpers |
| `resolveReward`, `resolveTitle`, `calculateSynergy` tested with real logic | Scoring, Execution | ✅ Service math is not mocked — validates real business rules |
| Individual test block length | All 3 | ✅ No single test exceeds ~35 lines |
| P2002 race condition handled | Entry | ✅ Both explicit duplicate guard AND constraint-catch tested |
| Scoring determinism (`no random factor` test) | Scoring | ✅ Explicitly verifies score is repeatable across 3 runs |
| Title threshold boundary values | Execution | ✅ Tests at 24/25/49/50/99/100/199/200 — all boundaries covered |
| `breedingValueBoost` cap at 0.15 | Execution | ✅ Tests overflow (0.14 + 0.05), exact cap (0.15 + 0.05), and zero delta |

---

## One-Fix Priority Order

If only one finding can be actioned before TR:

1. **RV-M1** — `clearAllMocks()` → `resetAllMocks()` in `conformationShowScoring.test.mjs` (1-word change, eliminates latent queue-leak risk, 30 seconds to fix)

---

## Quality Strengths

This suite exhibits several practices that should be promoted to project conventions:

**1. AC-tagged describe blocks** (`describe('AC1 — valid entry returns 201', ...)`) — makes failed tests immediately traceable to the specific acceptance criterion. Strongly recommended for all future endpoint test files.

**2. Closure-based configurable mock state** (execution file) — the `_mockExecuteResult`/`_mockExecuteError` + `jest.unstable_mockModule` pattern correctly handles the Jest VM modules constraint while keeping the mock configurable per test. Superior to `mockResolvedValueOnce` for module-level service mocks.

**3. `resolveReward`/`resolveTitle`/`applyBreedingValueBoost` tested with real service logic** — the execution test file deliberately re-exports the pure helpers inline in the mock but keeps the real implementations, then imports and tests them directly. This ensures business rules (threshold values, cap logic) are validated without mocking away the logic under test. Model pattern for service-with-controller test files.

**4. Scoring determinism test** — `it('no random factor — same inputs always produce same score')` is an explicit test that runs the scoring function 3 times and compares results. This test would catch any future regression where a random factor is accidentally introduced into the scoring formula. Should be added to any game-mechanic scoring function.

---

## Next TEA Step

**TR** — Trace Requirements: map all 8 FRs to specific tests and make the formal quality gate decision for Epic 31F.

```
Input:
- FR-38 through FR-45 (from epics-physical-systems.md)
- This RV report (test quality: A-)
- 31f-automation-summary.md (gap closure)
- All 3 test files (117+ tests)

Expected output:
- FR → test traceability table
- Per-AC pass/fail by story
- Quality gate decision: PASS / CONDITIONAL / FAIL
```

---

*Generated by: Murat (TEA) — retroactive RV for Epic 31F*
*Model: claude-sonnet-4-6*
