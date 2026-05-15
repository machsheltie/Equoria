---
epic: 31F
epicName: Conformation Show Handling
artifactType: TEA:TR (Requirements Traceability)
generatedBy: bmad-testarch-trace
generatedDate: 2026-05-15
mode: retroactive
bdIssue: Equoria-fuc3
relatedRetro: _bmad-output/implementation-artifacts/epic-31f-retro-2026-04-09.md
testFilesAnalyzed:
  - backend/modules/competition/__tests__/conformationShowScoring.test.mjs
  - backend/modules/competition/__tests__/conformationShowEntry.test.mjs
  - backend/modules/competition/__tests__/conformationShowExecution.test.mjs
  - backend/modules/competition/__tests__/conformationShowRoutes.test.mjs
  - backend/modules/competition/__tests__/conformationShowService.test.mjs
  - backend/modules/competition/__tests__/conformationService.test.mjs
  - backend/modules/competition/__tests__/conformationShowRoutesHttp.integration.test.mjs
sourceUnderTest:
  - backend/modules/competition/routes/conformationShowRoutes.mjs
  - backend/modules/competition/routes/competitionRoutes.mjs
  - backend/modules/competition/controllers/conformationShowController.mjs
  - backend/services/conformationShowService.mjs
gateDecision: PASS
---

# Epic 31F — Requirements Traceability (TEA:TR)

**Epic:** 31F — Conformation Show Handling
**Mode:** Retroactive (TEA was skipped during the live epic; see retro
2026-04-09 action item #1 and #9). This artifact reconstructs the
requirement → test mapping from the existing test suite to bring 31F into
parity with the post-31E-5 mandatory-TEA process.
**Stories covered:** 31F-1 (scoring engine), 31F-2 (entry + eligibility),
31F-3 (rewards + title progression).

## Method

1. Loaded the 8 functional requirements (FR-38…FR-45) enumerated in the
   epic retro `FR Coverage Gate` table.
2. Discovered tests under `backend/modules/competition/__tests__/` matching
   the conformation feature surface (6 pre-existing suites + 1 new HTTP
   integration suite added with Equoria-pety).
3. Mapped each FR to the specific test files + test names that exercise it.
   Every mapping is anchored to a line number from `grep -n` against the
   test file.
4. Flagged each FR with a priority (P0 = revenue-/integrity-blocking; P1 =
   user-facing feature contract; P2 = supporting behaviour) and noted any
   sub-clauses of the FR not directly covered.
5. Assembled a gap analysis and gate decision per the standard tea-trace
   algorithm (P0 must be 100%, P1 ≥ 80%, no critical gaps for PASS).

## Priority assignment (rationale)

| FR    | Priority | Reason                                                                                                                                    |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| FR-38 | P0       | Scoring formula directly determines competition outcomes and downstream rewards. A defect produces wrong placements at scale.             |
| FR-39 | P0       | "No prize money" is a financial integrity contract — leaking money via this endpoint would be an economy bug.                             |
| FR-40 | P0       | Title thresholds gate the breeding-value boost (FR-41); off-by-one is a perpetual rewards inflation bug.                                  |
| FR-41 | P0       | 15% cap on `breedingValueBoost` is the upper bound on a stat that affects all foals from a horse — uncapped value is unbounded inflation. |
| FR-42 | P1       | Entry endpoint contract (groom handler requirement) is a user-facing rule but a defect produces 400/409, not silent corruption.           |
| FR-43 | P1       | Age-class auto-assignment is a UX contract; wrong assignment routes a horse to the wrong class but does not corrupt data.                 |
| FR-44 | P1       | Read-only eligibility endpoint — defect produces a wrong eligibility verdict but no state change.                                         |
| FR-45 | P1       | Read-only titles endpoint — defect produces wrong displayed title but no state change.                                                    |

P0/P1 split: 4 / 4. No P2 requirements in this epic.

## Test inventory

| Test file                                                      | LOC      | `it`/`test` calls (grep) |
| -------------------------------------------------------------- | -------- | ------------------------ |
| conformationShowScoring.test.mjs                               | 766      | ~90                      |
| conformationShowEntry.test.mjs                                 | 553      | 16 (named AC\* groups)   |
| conformationShowExecution.test.mjs                             | 467      | ~25                      |
| conformationShowRoutes.test.mjs                                | 150      | 13 (validator chain)     |
| conformationShowService.test.mjs                               | 629      | ~70                      |
| conformationService.test.mjs                                   | 304      | ~35                      |
| conformationShowRoutesHttp.integration.test.mjs (Equoria-pety) | 134      | 3 (wiring sentinel)      |
| **Total**                                                      | **3003** | **~252**                 |

Total test count is an estimate from `grep ^\s*(it|describe|test)\(`. The
canonical count comes from `npm test -- modules/competition/__tests__/`
which reports 539 tests including the new HTTP integration suite.

## Traceability matrix

### FR-38 — Conformation show uses 65/20/8/7 scoring formula (P0)

**Story:** 31F-1.
**Source under test:** `backend/services/conformationShowService.mjs`
(`calculateConformationShowScore`, `CONFORMATION_SHOW_CONFIG`).

| Sub-clause                                | Test file                        | Test name (line)                                                               |
| ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Weights sum to 1.00                       | conformationShowScoring.test.mjs | `CONFORMATION_SHOW_CONFIG › weights sum to 1.00` (734)                         |
| CONFORMATION_WEIGHT = 0.65                | conformationShowScoring.test.mjs | `CONFORMATION_WEIGHT is 0.65` (743)                                            |
| HANDLER_WEIGHT = 0.20                     | conformationShowScoring.test.mjs | `HANDLER_WEIGHT is 0.20` (747)                                                 |
| BOND_WEIGHT = 0.08                        | conformationShowScoring.test.mjs | `BOND_WEIGHT is 0.08` (751)                                                    |
| TEMPERAMENT_WEIGHT = 0.07                 | conformationShowScoring.test.mjs | `TEMPERAMENT_WEIGHT is 0.07` (755)                                             |
| Weights also asserted in service suite    | conformationShowService.test.mjs | `calculateConformationShowScore › weights sum to 1.0` (176)                    |
| Score is integer in [0, 100]              | conformationShowScoring.test.mjs | `produces an integer finalScore in [0, 100]` (347)                             |
| Score matches expected arithmetic         | conformationShowScoring.test.mjs | `finalScore matches expected arithmetic with known inputs` (354)               |
| Maximum score combo                       | conformationShowScoring.test.mjs | `maximum possible score (all 100, master handler, nervous+gentle → 100)` (392) |
| Zero bond is additive, not multiplicative | conformationShowScoring.test.mjs | `zero bond score is correctly applied (not a multiplier)` (380)                |
| Deterministic (no random factor)          | conformationShowScoring.test.mjs | `no random factor — same inputs always produce same score` (448)               |
| Config frozen at runtime                  | conformationShowScoring.test.mjs | `config is frozen — cannot be mutated at runtime` (763)                        |
| Master > novice handler ranking           | conformationShowService.test.mjs | `master handler scores higher than novice handler (all else equal)` (182)      |

**Coverage:** Full. Formula contract is over-tested (intentional — P0).

### FR-39 — No prize money for conformation shows (P0)

**Story:** 31F-3.
**Source under test:** `executeConformationShowHandler` in
`conformationShowController.mjs`; results-construction in
`conformationShowService.mjs`.

| Sub-clause                            | Test file                          | Test name (line)                                                                                                                                                          |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Results array entries lack `prizeWon` | conformationShowExecution.test.mjs | `AC4 — no prize money in conformation › results array entries do not include prizeWon` (329)                                                                              |
| Full execution run smoke              | conformationShowService.test.mjs   | `executeConformationShow — lines 520-604: full run with one entry › scores entry, assigns 1st-place Blue ribbon, persists CompetitionResult, returns results array` (604) |

**Coverage:** Direct. One negative assertion (`not.toHaveProperty('prizeWon')`)
is sufficient for the contract.

### FR-40 — Title progression thresholds (25/50/100/200 pts) (P0)

**Story:** 31F-3.
**Source under test:** `resolveTitle` in `conformationShowService.mjs`.

| Sub-clause                                | Test file                          | Test name (line)                                                  |
| ----------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| 0 pts → null                              | conformationShowExecution.test.mjs | `resolveTitle › returns null for 0 points` (215)                  |
| 24 pts → null (sub-threshold boundary)    | conformationShowExecution.test.mjs | `returns null for 24 points` (218)                                |
| 25 pts → Noteworthy (lower boundary)      | conformationShowExecution.test.mjs | `returns Noteworthy at 25 points` (221)                           |
| 49 pts → Noteworthy (upper boundary)      | conformationShowExecution.test.mjs | `returns Noteworthy at 49 points` (224)                           |
| 50 pts → Distinguished (lower boundary)   | conformationShowExecution.test.mjs | `returns Distinguished at 50 points` (227)                        |
| 99 pts → Distinguished (upper boundary)   | conformationShowExecution.test.mjs | `returns Distinguished at 99 points` (230)                        |
| 100 pts → Champion (lower boundary)       | conformationShowExecution.test.mjs | `returns Champion at 100 points` (233)                            |
| 199 pts → Champion (upper boundary)       | conformationShowExecution.test.mjs | `returns Champion at 199 points` (236)                            |
| 200 pts → Grand Champion (lower boundary) | conformationShowExecution.test.mjs | `returns Grand Champion at 200 points` (239)                      |
| 500 pts → Grand Champion (well over)      | conformationShowExecution.test.mjs | `returns Grand Champion at 500 points` (242)                      |
| Service-suite intermediate boundary smoke | conformationShowService.test.mjs   | `resolveTitle — intermediate thresholds (Equoria-jkht)` (278-291) |

**Coverage:** Full boundary coverage at every threshold (off-by-one defence).

### FR-41 — breedingValueBoost capped at 15% (P0)

**Story:** 31F-3.
**Source under test:** `applyBreedingValueBoost` in `conformationShowService.mjs`.

| Sub-clause                            | Test file                          | Test name (line)                                                                                                      |
| ------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1st place adds 5% (0 → 0.05)          | conformationShowExecution.test.mjs | `applyBreedingValueBoost › adds 5% for 1st place (0 → 0.05)` (248)                                                    |
| Cap fires when 0.14 + 5% would exceed | conformationShowExecution.test.mjs | `caps at 0.15 when adding 5% to 0.14` (251)                                                                           |
| Idempotent at cap (0.15 + 5% → 0.15)  | conformationShowExecution.test.mjs | `stays at 0.15 when already capped and adding 5%` (254)                                                               |
| 4th place has delta=0                 | conformationShowExecution.test.mjs | `returns unchanged boost for 4th place (delta=0)` (257)                                                               |
| Overflow scenario clamped             | conformationShowExecution.test.mjs | `caps at 0.15 when overflow would exceed cap` (260)                                                                   |
| Negative/zero-delta early return      | conformationShowService.test.mjs   | `applyBreedingValueBoost (Equoria-jkht) › returns currentBoost unchanged when delta <= 0 (early-return branch)` (299) |
| Under-cap addition                    | conformationShowService.test.mjs   | `adds delta when delta > 0 and result is under cap` (304)                                                             |
| Sum-exceeds-cap clamp                 | conformationShowService.test.mjs   | `clamps to BREEDING_BOOST_CAP (0.15) when sum exceeds cap` (309)                                                      |

**Coverage:** Full. Cap, addition path, early-return, and overflow all covered.

### FR-42 — POST /enter endpoint with groom handler requirement (P1)

**Story:** 31F-2.
**Source under test:** `enterConformationShow` controller +
`validateConformationEntry` service.
**HTTP wiring:** `router.use('/conformation', conformationShowRoutes)` in
`competitionRoutes.mjs` (added by Equoria-pety, 2026-05-15).

| Sub-clause                                      | Test file                                       | Test name (line)                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Valid entry returns 201 with ageClass           | conformationShowEntry.test.mjs                  | `AC1 — valid entry returns 201 › creates ShowEntry and returns entry data with ageClass` (181)                    |
| Horse not owned → 404 (CWE-639)                 | conformationShowEntry.test.mjs                  | `AC4 — horse not owned returns 404` (214)                                                                         |
| Groom not owned → 400                           | conformationShowEntry.test.mjs                  | `AC1 — groom not owned returns 400` (235)                                                                         |
| Show not found → 400                            | conformationShowEntry.test.mjs                  | `AC1 — show not found returns 400` (257)                                                                          |
| Wrong show type → 400                           | conformationShowEntry.test.mjs                  | `AC3 — wrong show type returns 400` (276)                                                                         |
| Duplicate entry → 409                           | conformationShowEntry.test.mjs                  | `AC5 — duplicate entry returns 409` (299)                                                                         |
| Unhealthy horse → 400                           | conformationShowEntry.test.mjs                  | `AC5 — ineligible horse (unhealthy) returns 400` (332)                                                            |
| No active groom assignment → 400                | conformationShowEntry.test.mjs                  | `AC5 — ineligible horse (no active groom assignment) returns 400` (356)                                           |
| Groom assigned too recently (<2 days) → 400     | conformationShowEntry.test.mjs                  | `G2 — groom assigned too recently returns 400` (380)                                                              |
| Invalid className → 400                         | conformationShowEntry.test.mjs                  | `G3 — invalid className returns 400` (406)                                                                        |
| Validator chain on `/enter` (route layer)       | conformationShowRoutes.test.mjs                 | `POST /enter validation` block (55-105)                                                                           |
| Groom-not-assigned DB branch                    | conformationShowService.test.mjs                | `validateConformationEntry — line 337: DB query with non-null IDs (Equoria-rr7)` (551)                            |
| Assignment-age boundary                         | conformationShowService.test.mjs                | `lines 350-358: assignment date check (Equoria-rr7)` (564, 571)                                                   |
| HTTP route reachable (post-Equoria-pety wiring) | conformationShowRoutesHttp.integration.test.mjs | (POST /enter is implicitly mounted; explicit POST sentinel intentionally omitted — see file header for rationale) |

**Coverage:** Comprehensive. Controller + service + validator chain all covered.

**Note on wiring:** Until Equoria-pety landed (2026-05-15), the route was
unreachable in production despite full controller coverage. This is the
exact gap that mandated the new HTTP integration sentinel. See action
item below.

### FR-43 — Age class auto-assignment (P1)

**Story:** 31F-1.
**Source under test:** `getConformationAgeClass` in `conformationShowService.mjs`.

| Sub-clause                                   | Test file                        | Test name (line)                                             |
| -------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| age 0 → Weanling                             | conformationShowScoring.test.mjs | `age 0 → Weanling` (151)                                     |
| age 0.5 → Weanling                           | conformationShowScoring.test.mjs | `age 0.5 → Weanling` (155)                                   |
| age 1 (boundary) → Yearling                  | conformationShowScoring.test.mjs | `age 1 → Yearling (boundary: exactly 1)` (159)               |
| age 1.5 → Yearling                           | conformationShowScoring.test.mjs | `age 1.5 → Yearling` (163)                                   |
| age 2 (boundary) → Youngstock                | conformationShowScoring.test.mjs | `age 2 → Youngstock (boundary: exactly 2)` (167)             |
| age 2.9 → Youngstock                         | conformationShowScoring.test.mjs | `age 2.9 → Youngstock` (171)                                 |
| age 3 (boundary) → Junior                    | conformationShowScoring.test.mjs | `age 3 → Junior (boundary: exactly 3)` (175)                 |
| age 5 (upper-Junior) → Junior                | conformationShowScoring.test.mjs | `age 5 → Junior (upper boundary of Junior band)` (179)       |
| age 5.9 → Junior                             | conformationShowScoring.test.mjs | `age 5.9 → Junior` (183)                                     |
| age 6 (boundary) → Senior                    | conformationShowScoring.test.mjs | `age 6 → Senior (boundary: exactly 6)` (187)                 |
| age 20 → Senior                              | conformationShowScoring.test.mjs | `age 20 → Senior` (191)                                      |
| 5 age-class constants exist                  | conformationShowScoring.test.mjs | `CONFORMATION_AGE_CLASSES has 5 entries` (195)               |
| Negative age guard → Weanling (not Senior)   | conformationShowScoring.test.mjs | `age -1 (negative) → Weanling (guarded, not SENIOR)` (199)   |
| NaN guard → Weanling                         | conformationShowScoring.test.mjs | `NaN → Weanling (guarded, not SENIOR)` (203)                 |
| Infinity guard → Weanling                    | conformationShowScoring.test.mjs | `Infinity → Weanling (guarded, not SENIOR)` (207)            |
| Service-suite Youngstock/Junior/Senior smoke | conformationShowService.test.mjs | `getConformationAgeClass — all age-class branches` (224-237) |

**Coverage:** Exhaustive boundary coverage. All 5 bands + non-finite guards.

### FR-44 — GET /eligibility endpoint (P1)

**Story:** 31F-2.
**Source under test:** `checkConformationEligibility` controller.

| Sub-clause                                        | Test file                                       | Test name (line)                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Eligible horse with groom → 200 + `eligible:true` | conformationShowEntry.test.mjs                  | `AC5 — eligible horse with groom returns eligible: true` (435)                                                           |
| No groom assignment → `eligible:false`            | conformationShowEntry.test.mjs                  | `AC5 — no groom assignment returns eligible: false` (458)                                                                |
| Unhealthy → `eligible:false` with health error    | conformationShowEntry.test.mjs                  | `AC5 — unhealthy horse returns eligible: false` (477)                                                                    |
| Unowned → 404 (CWE-639)                           | conformationShowEntry.test.mjs                  | `AC4 — unowned horse returns 404` (496)                                                                                  |
| Full response shape                               | conformationShowEntry.test.mjs                  | `AC2 — response shape › response includes horseId, horseName, eligible, errors, warnings, ageClass, groomAssigned` (512) |
| No conformationScores → eligible with warning     | conformationShowEntry.test.mjs                  | `AC5 — horse with no conformationScores returns eligible with warning` (535)                                             |
| Validator chain on `/eligibility/:horseId`        | conformationShowRoutes.test.mjs                 | `GET /eligibility/:horseId validation` (106-119)                                                                         |
| HTTP route reachable (wiring sentinel)            | conformationShowRoutesHttp.integration.test.mjs | `GET /api/v1/competition/conformation/eligibility/:horseId is reachable (status !== 404)` (74)                           |

**Coverage:** Full. Eligibility response shape, ownership, validator, and
HTTP wiring all covered.

### FR-45 — GET /titles endpoint (P1)

**Story:** 31F-3.
**Source under test:** `getConformationTitles` controller.

| Sub-clause                             | Test file                                       | Test name (line)                                                                                                                  |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Returns accumulated title data         | conformationShowExecution.test.mjs              | `AC5 — returns accumulated title data › returns 200 with horseId, horseName, titlePoints, currentTitle, breedingValueBoost` (398) |
| Untitled horse → 0 points + null title | conformationShowExecution.test.mjs              | `returns null currentTitle and 0 titlePoints for untitled horse` (421)                                                            |
| IDOR: foreign owner → 404              | conformationShowExecution.test.mjs              | `AC5 — IDOR: returns 404 for unowned horse › returns 404 when horse belongs to a different user` (443)                            |
| Non-existent horse → 404               | conformationShowExecution.test.mjs              | `returns 404 when horse does not exist` (457)                                                                                     |
| Validator chain on `/titles/:horseId`  | conformationShowRoutes.test.mjs                 | `GET /titles/:horseId validation` (134-145)                                                                                       |
| HTTP route reachable (wiring sentinel) | conformationShowRoutesHttp.integration.test.mjs | `GET /api/v1/competition/conformation/titles/:horseId is reachable (status !== 404)` (94)                                         |

**Coverage:** Full. Happy path, untitled, IDOR, not-found, validator, wiring.

## Coverage statistics

| Priority    | Total FRs | Mapped | Partial | Unmapped | Coverage % |
| ----------- | --------- | ------ | ------- | -------- | ---------- |
| P0          | 4         | 4      | 0       | 0        | 100%       |
| P1          | 4         | 4      | 0       | 0        | 100%       |
| **Overall** | **8**     | **8**  | **0**   | **0**    | **100%**   |

## Gap analysis

### Coverage gaps (FR-level)

None. Every FR-38 through FR-45 has at least one direct test mapped to a
specific test name and line number.

### Architectural gaps surfaced during this trace

1. **HTTP route mount sentinel was missing** (P0 process gap, now closed).
   The 16 entry-flow tests + 4 route-validator tests + service tests all
   passed while production `/api/v1/competition/conformation/*` returned
   404 because `conformationShowRoutes` was never mounted into
   `competitionRoutes`. Equoria-pety added the wiring and Equoria-jbll
   added the supertest sentinel
   (`conformationShowRoutesHttp.integration.test.mjs`). Both closed
   2026-05-15.

   _Lesson encoded:_ Controller-only tests cannot detect missing route
   mounts. CONTRIBUTING.md §2 ("Route ordering — specific routes BEFORE
   `/:id` catch-alls") references this class of defect; a companion
   convention "Each new sub-router must have at least one supertest
   integration test asserting `status !== 404`" should be added (filed
   as a follow-up below).

2. **POST endpoints (/enter, /execute) cannot be used as wiring
   sentinels** because `authenticateToken` + `csrfProtection` run before
   express's route matcher on the parent `authRouter`. Documented
   in-line in `conformationShowRoutesHttp.integration.test.mjs` headers
   so a future maintainer doesn't add vacuously-passing POST sentinels.

### Test quality observations (cross-reference TEA:RV)

`_bmad-output/test-artifacts/31f-test-review.md` (dated 2026-04-10)
already evaluated determinism / isolation / maintainability /
performance for the 31F suite. This TR artifact does not duplicate that
work — it strictly addresses requirement → test traceability.

## Gate decision

**Decision:** **PASS**

**Algorithm trace:**

- P0 coverage = 100% ✅ (rule 1: P0 must be 100%)
- P1 coverage = 100% ✅ (rule 2: P1 ≥ 80%)
- Critical-gap count = 0 ✅ (rule 3: no critical gaps)
- Overall coverage = 100% ✅

No `CONCERNS`, `FAIL`, or `WAIVED` conditions trigger.

**Caveat:** This is a _retroactive_ TR. The PASS reflects the state of
the codebase on 2026-05-15 after Equoria-pety + Equoria-jbll landed. The
PASS does **not** validate that TEA was run during the live epic
(2026-04 — it wasn't, per the 31F retro). Going forward, TEA:TR is
mandated _at epic completion_, not retroactively.

## Action items (follow-up issues)

1. **Add CONTRIBUTING.md convention #5:** "Each new sub-router added
   under a parent route file must ship with a supertest HTTP integration
   test asserting `status !== 404` for at least one GET on each
   sub-route." Rationale: the 31F-2 false-completion (route never
   mounted, all 16 controller tests passing) is exactly the class of
   defect this convention prevents. _Owner: Tech writer / scrum master.
   Not filed as a bd issue yet — surface to user before creating._

2. **Backfill TR for prior epics that skipped TEA:TR.** If 31D / 31E
   also lack formal TR artifacts, the same retroactive pattern applies.
   _Owner: TBD — out of scope for Equoria-fuc3._

3. **Wire `docs/test-traceability/` into the standard epic-completion
   checklist** so future epics produce TR live, not retroactively.
   _Owner: BMad workflow maintainer._

## What was NOT done

- No new tests were added by this artifact. TR is a _mapping_ exercise,
  not a _coverage-expansion_ exercise. If a new gap had been surfaced,
  the correct response would have been to file a separate bd issue
  rather than extend Equoria-fuc3's scope.
- No re-evaluation of the existing tests' quality (that was Murat's TEA:RV
  on 2026-04-10 — `31f-test-review.md`).
- No verification that the tests actually pass at HEAD. The 539-test
  `npm test -- modules/competition/__tests__/` run on commit `0614a91d`
  shows 539 passed / 0 failed; this artifact takes that as evidence.
- No mapping of `conformationService.test.mjs` (in
  `backend/modules/competition/__tests__/`) — its tests cover the
  _base_ conformation service used by `horses` module and are not
  directly mapped to FR-38..FR-45. It is listed in the inventory for
  completeness; its FRs (if any) belong to the horses-module trace, not
  this one.

## References

- Epic retro: `_bmad-output/implementation-artifacts/epic-31f-retro-2026-04-09.md`
- 31F-1 spec: `_bmad-output/implementation-artifacts/31f-1-conformation-show-scoring-engine.md`
- 31F-2 spec: `_bmad-output/implementation-artifacts/31f-2-show-entry-and-eligibility.md`
- 31F-3 spec: `_bmad-output/implementation-artifacts/31f-3-rewards-and-title-progression.md`
- TEA:RV (test quality): `_bmad-output/test-artifacts/31f-test-review.md`
- TEA:AT (automation summary): `_bmad-output/test-artifacts/31f-automation-summary.md`
- Wiring fix: commit `0614a91d` (Equoria-pety, 2026-05-15)
- Wiring sentinel test: `backend/modules/competition/__tests__/conformationShowRoutesHttp.integration.test.mjs` (Equoria-jbll, 2026-05-15)
