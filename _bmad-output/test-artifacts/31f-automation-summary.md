---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
lastStep: step-03-generate-tests
lastSaved: '2026-04-10'
epic: 31F
stories:
  - 31F-1
  - 31F-2
  - 31F-3
mode: retroactive-create
inputDocuments:
  - _bmad-output/implementation-artifacts/31f-2-show-entry-and-eligibility.md
  - _bmad-output/implementation-artifacts/epic-31f-retro-2026-04-09.md
  - backend/__tests__/conformationShowScoring.test.mjs
  - backend/__tests__/conformationShowEntry.test.mjs
  - backend/__tests__/conformationShowExecution.test.mjs
---

# Epic 31F — Test Automation Summary (TEA:TA Retroactive)

**Epic:** 31F — Conformation Show Handling
**Date:** 2026-04-10
**Mode:** Retroactive Create (implementation already shipped; TEA was skipped during delivery)
**Stack:** backend (Node.js + Express + Prisma, Jest --experimental-vm-modules)
**Execution Mode:** sequential

---

## Step 1 — Preflight & Context

### Framework Verification

| Check | Status |
|---|---|
| Jest config (`jest.config.mjs`) | ✅ found |
| `--experimental-vm-modules` flag | ✅ in `package.json` test script |
| Test directory (`backend/__tests__/`) | ✅ exists, 3 conformation test files found |
| Source files | ✅ `conformationShowService.mjs`, `conformationShowController.mjs`, `conformationShowRoutes.mjs` |

### Context Loaded

- Story 31F-1 ACs: scoring formula, synergy table, entry validation, age class, handler map
- Story 31F-2 ACs: POST /enter, GET /eligibility, auth/ownership, duplicate-entry 409, show type guard
- Story 31F-3 ACs: POST /execute idempotency, GET /titles, no prize money, title thresholds, breedingValueBoost cap
- Retro findings: TEA completely skipped; idempotency gap; N+1 in Promise.all; stale read in $transaction; test co-location violation

---

## Step 2 — Coverage Targets & Gap Analysis

### Existing Test Coverage

| Story | Test File | Count | Verdict |
|---|---|---|---|
| 31F-1 | `conformationShowScoring.test.mjs` | 60+ | ✅ Comprehensive — all 6 ACs covered |
| 31F-2 | `conformationShowEntry.test.mjs` | 14 (pre-TA) | ⚠️ Good core coverage; 5 integration gaps |
| 31F-3 | `conformationShowExecution.test.mjs` | 37 | ✅ Full AC coverage per retro; idempotency, N+1, stale-read all fixed and tested |

### Gap Register

| ID | Story | Description | AC | Priority | Disposition |
|---|---|---|---|---|---|
| G1 | 31F-2 | `className` whitespace trimming verified through controller | AC1 | P1 | ✅ Test added |
| G2 | 31F-2 | Groom assigned < 2 days returns 400 via controller path | AC5 | P1 | ✅ Test added |
| G3 | 31F-2 | Invalid `className` (non-conformation) returns 400 via controller | AC1/AC5 | P1 | ✅ Test added |
| G4 | 31F-2 | Non-P2002 `showEntry.create` error propagates as 500 | AC1 | P1 | ✅ Test added |
| G5 | 31F-2 | GET /eligibility — missing `conformationScores` returns `eligible: true` + warning | AC2 | P2 | ✅ Test added |
| G6 | 31F-1 | null-groom vs groom-owned-by-wrong-user distinction | AC3 | P2 | ✅ Already adequate (both paths tested) |
| G7 | 31F-1/2/3 | Test files in `backend/__tests__/` — violates CONTRIBUTING.md 21-1 co-location rule | structural | P2 | ⚠️ Noted — do not move without permission |

### Test Level Assignments

| Level | Scope | Stories | Status |
|---|---|---|---|
| Unit | Pure scoring logic — `calculateConformationScore`, `getHandlerScore`, `getConformationAgeClass`, `calculateSynergy`, `calculateConformationShowScore`, `validateConformationEntry` | 31F-1 | ✅ |
| API/Integration | Controller endpoints — POST /enter, GET /eligibility, POST /execute, GET /titles | 31F-2, 31F-3 | ✅ |
| E2E | N/A — backend only | — | Skipped (correct) |

---

## Step 3 — Test Generation Results

### New Tests Written

**File:** `backend/__tests__/conformationShowEntry.test.mjs`
**Before:** 14 tests | **After:** 20 tests (+6)
**Run result:** 20/20 PASS ✅

#### G5 — `checkConformationEligibility` suite (appended)

```
describe('AC5 — horse with no conformationScores returns eligible but with warning')
  it('returns 200 with eligible=true and a conformation scores warning')
```

**Why:** Missing `conformationScores` is a warning, not a blocking error (per FR-38 neutral fallback to 50). The service-level test confirmed this; the controller integration path was not exercised.

#### G1–G4 — `enterConformationShow — TEA:TA gap coverage` suite (new describe block)

```
describe('G1 — className with surrounding whitespace is accepted after trim')
  it('creates entry when className has leading/trailing whitespace')

describe('G2 — groom assigned too recently returns 400 via controller')
  it('returns 400 with assignment timing error when groom was assigned < 2 days ago')

describe('G3 — invalid className (non-conformation) returns 400 via controller')
  it('returns 400 with class error when className is not a valid conformation class')

describe('G4 — non-P2002 showEntry.create error propagates as 500')
  it('returns 500 when showEntry.create throws an unexpected error')
```

**G1 rationale:** The `.trim()` fix was added in 31F-2 review pass 2 (retro finding "Pass 2 Review Findings"). A test must exist verifying the correct value flows to the service after trim.

**G2 rationale:** The 2-day minimum assignment duration is the most likely real-world rejection reason. Testing only in the service (31F-1) leaves the controller path unverified.

**G3 rationale:** `className: 'Dressage'` is the primary mistake a frontend consumer would make when routing a ridden show entry to the conformation endpoint. The 400 path through the controller was exercised for groom/show/health failures but not class-name failures.

**G4 rationale:** The P2002 catch is tested (test: "returns 409 when Prisma throws P2002"). The `throw err` re-throw for non-P2002 errors must be verified to not silently swallow DB connectivity failures.

---

## DoD Summary

### Definition of Done — Epic 31F Test Coverage

| Criterion | Status |
|---|---|
| All FRs have at least one passing test | ✅ (8/8 FRs — per retro coverage gate) |
| All P0/P1 acceptance criteria have tests | ✅ (all ACs covered across 31F-1/2/3) |
| All P1 gaps from this TA closed | ✅ (G1–G4 added, all passing) |
| P2 eligibility warning gap closed | ✅ (G5 added) |
| No flaky tests (deterministic, no random factors) | ✅ (scoring confirmed deterministic in 31F-1; mock queues use resetAllMocks in beforeEach) |
| Balanced mocking enforced (DB + logger only) | ✅ (real service logic runs; only prisma + logger + ownership mocked) |
| All new tests pass in isolation | ✅ (20/20 conformationShowEntry.test.mjs) |

### Outstanding Items (not blocking DoD)

| Item | Priority | Action |
|---|---|---|
| G7: Test co-location (files in `__tests__/` root vs `modules/competition/__tests__/`) | P2 | File story to migrate; do not move files inline |
| 31F-3 idempotency test — verify `$transaction` is used for atomic status update | P1 | Already exists in `conformationShowExecution.test.mjs` per retro; verify explicitly in TR step |

---

## Fixture Needs

No new fixtures required. The `VALID_HORSE`, `VALID_GROOM`, `VALID_SHOW`, `VALID_ASSIGNMENT` constants in `conformationShowEntry.test.mjs` were reused for all new tests. The `buildReq`/`buildRes` helpers are shared within the file.

---

## Next TEA Steps

Per the retroactive TEA sequence recommended in the retro:

1. **TA** — ✅ this document (complete)
2. **RV** — Run `bmad-testarch-test-review` against `conformationShowScoring.test.mjs`, `conformationShowEntry.test.mjs`, and `conformationShowExecution.test.mjs`
3. **TR** — Run `bmad-testarch-trace` to produce formal FR → test traceability map and make the quality gate decision

---

*Generated by: Murat (TEA) — retroactive pass for Epic 31F*
*Model: claude-sonnet-4-6*
