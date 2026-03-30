# Story 31B.2: Conformation Breeding Inheritance

Status: done

## Story

As a developer,
I want foal conformation scores to blend parent scores with breed mean,
So that selective breeding has meaningful impact while regressing toward breed averages.

## Acceptance Criteria

1. **Given** a foal is being born with known sire and dam
   **When** the conformation generation service runs for the foal
   **Then** each region score is generated using:

   - `baseValue = (sire.region * 0.5 + dam.region * 0.5) * 0.6 + breedMean * 0.4`
   - `foalScore = clamp(normalRandom(baseValue, breedStdDev), 0, 100)`

2. **Given** the inheritance formula
   **When** parent contribution is calculated
   **Then** parent average contributes 60% and breed mean regression contributes 40%

3. **Given** 1000+ foals generated from two high-scoring parents (head=95, head=90)
   **When** scores are analyzed statistically
   **Then** foal head scores average significantly higher than breed mean (verifiable)

4. **Given** 1000+ foals generated from two low-scoring parents
   **When** scores are analyzed statistically
   **Then** foal scores still regress toward breed mean (not as low as parents)

5. **Given** foals generated via breeding inheritance
   **When** stored on the horse
   **Then** foals still exhibit natural variance from the breed std_dev (not all identical)

6. **Given** a foal is born from parents whose `conformationScores` are null or missing (legacy horses)
   **When** the conformation generation service runs
   **Then** it falls back to breed-only generation (same as 31B-1 behavior — `generateConformationScores(breedId)`)

## Tasks / Subtasks

- [x] Task 1: Add `generateInheritedConformationScores()` to conformationService.mjs (AC: #1, #2, #5)

  - [x] 1.1 Create function `generateInheritedConformationScores(breedId, sireScores, damScores)` that computes `baseValue = (sire * 0.5 + dam * 0.5) * 0.6 + breedMean * 0.4` per region then `clampScore(normalRandom(baseValue, breedStdDev))`
  - [x] 1.2 Reuse existing `normalRandom`, `clampScore`, `calculateOverallConformation` from conformationService
  - [x] 1.3 Handle edge cases: missing/null sireScores or damScores → fallback to `generateConformationScores(breedId)`
  - [x] 1.4 Export the new function

- [x] Task 2: Update `createFoal()` in horseController.mjs to use inheritance (AC: #1, #6)

  - [x] 2.1 Import `generateInheritedConformationScores` alongside existing `generateConformationScores`
  - [x] 2.2 At line ~150 in createFoal, replace `generateConformationScores(breedId)` with logic: if sire.conformationScores AND dam.conformationScores exist → call `generateInheritedConformationScores(breedId, sire.conformationScores, dam.conformationScores)`, else fallback to `generateConformationScores(breedId)`
  - [x] 2.3 Add logger.info for which generation path was used (inheritance vs breed-only)

- [x] Task 3: Write unit tests for inheritance (AC: #1, #2, #3, #4, #5, #6)

  - [x] 3.1 Test `generateInheritedConformationScores` returns all 8 regions + overallConformation
  - [x] 3.2 Test all scores are integers in [0, 100]
  - [x] 3.3 Test formula: with known sire/dam/breed mean inputs, verify baseValue calculation is correct (mock `normalRandom` for deterministic test)
  - [x] 3.4 Test high-scoring parents (both 95) produce foals averaging above breed mean over 1000 samples
  - [x] 3.5 Test low-scoring parents (both 30) produce foals averaging higher than parent avg (regression to mean) over 1000 samples
  - [x] 3.6 Test variance: 1000 foals from identical parents are NOT all identical (natural variance from std_dev)
  - [x] 3.7 Test null sireScores → falls back to breed-only generation
  - [x] 3.8 Test null damScores → falls back to breed-only generation
  - [x] 3.9 Test both parents null → falls back to breed-only generation
  - [x] 3.10 Test all 12 breeds produce valid inherited scores
  - [x] 3.11 Test unknown breed with valid parents → fallback to default scores (50)

- [x] Task 4: Statistical validation (AC: #3, #4)
  - [x] 4.1 Generate 1000 foals with Thoroughbred parents (both head=95), verify average head score > breed mean (78) by at least 5 points
  - [x] 4.2 Generate 1000 foals with Thoroughbred parents (both head=40), verify average head score > 40 (regression toward breed mean of 78)
  - [x] 4.3 Verify 95% of inherited scores fall within baseValue ± 2\*breedStdDev

## Dev Notes

### CRITICAL: Inheritance Formula

From PRD-02 §3.1 / FR-07:

```javascript
// Per region:
baseValue = (sireScore * 0.5 + damScore * 0.5) * 0.6 + breedMean * 0.4;
foalScore = clampScore(normalRandom(baseValue, breedStdDev));
```

**Breakdown:** Parent average contributes 60%, breed mean contributes 40%. This ensures:

- Selective breeding matters (high-score parents → higher-than-average foals)
- Regression to mean prevents runaway inflation (breed mean pulls scores back)
- Natural variance from `normalRandom` ensures foals aren't clones

### Function Signature

```javascript
export function generateInheritedConformationScores(breedId, sireScores, damScores) {
  // sireScores/damScores = { head, neck, shoulders, back, hindquarters, legs, hooves, topline }
  // Returns same shape as generateConformationScores: { head, ..., overallConformation }
}
```

### Integration Point: horseController.createFoal()

Currently at `backend/modules/horses/controllers/horseController.mjs` line ~150:

```javascript
// CURRENT (31B-1):
const conformationScores = generateConformationScores(breedId);

// NEW (31B-2) — replace with:
const sireConformation = sire.conformationScores;
const damConformation = dam.conformationScores;
const conformationScores =
  sireConformation && damConformation
    ? generateInheritedConformationScores(breedId, sireConformation, damConformation)
    : generateConformationScores(breedId);
```

**Note:** `sire` and `dam` are already fetched at line ~97 via `Promise.all([getHorseById(sireId), getHorseById(damId)])`. Their `conformationScores` JSONB field is available.

### POST /horses Route — NO CHANGE

The `POST /horses` route in `horseRoutes.mjs` creates NEW horses (not foals from breeding). It does NOT have sire/dam. Leave its `generateConformationScores(breedId)` call unchanged.

### Existing Functions to Reuse (DO NOT DUPLICATE)

From `backend/modules/horses/services/conformationService.mjs`:

- `normalRandom(mean, stdDev)` — Box-Muller normal distribution
- `clampScore(value)` — Round + clamp [0, 100], NaN/Infinity → 50
- `calculateOverallConformation(scores)` — Arithmetic mean of 8 regions
- `CONFORMATION_REGIONS` — `['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline']`
- `BREED_GENETIC_PROFILES` — Imported from `../data/breedGeneticProfiles.mjs`

### Breed Genetic Profile Access Pattern

```javascript
const profile = BREED_GENETIC_PROFILES[breedId];
const conformation = profile.rating_profiles.conformation;
const regionMean = conformation[region].mean; // e.g., 78
const regionStdDev = conformation[region].std_dev; // e.g., 8
```

### Edge Case: Legacy Horses Without conformationScores

Legacy horses have default conformationScores `{ head: 20, neck: 20, ... }` from the Prisma schema default. These are REAL values (not null), so breeding two legacy horses would use inheritance formula with parent scores of 20. This is acceptable — their foals would regress toward breed mean.

However, if a horse's `conformationScores` is explicitly `null` (e.g., created before the JSONB field existed), fall back to breed-only generation.

### Test File Location

Add tests to existing file: `backend/__tests__/conformationScoreGeneration.test.mjs`

Or create a separate file: `backend/__tests__/conformationBreedingInheritance.test.mjs`

**Recommended:** Separate file to keep concerns isolated, following the pattern of one test file per story.

### Test Execution

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js conformationBreedingInheritance
```

### Project Structure Notes

**Files to modify:**

1. `backend/modules/horses/services/conformationService.mjs` — Add `generateInheritedConformationScores()`
2. `backend/modules/horses/controllers/horseController.mjs` — Update `createFoal()` to use inheritance

**Files to create:**

1. `backend/__tests__/conformationBreedingInheritance.test.mjs` — Unit + statistical tests

**No new routes, no Prisma migration, no schema changes.**

### Previous Story Intelligence (31B-1)

**Patterns established:**

- Import breed data from `backend/modules/horses/data/breedGeneticProfiles.mjs`
- Access pattern: `BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation`
- Each region: `{ mean: number, std_dev: 8 }` (Lusitano uses 6-7)
- Use shared Prisma client: `import prisma from '../../../db/index.mjs'` (NOT direct @prisma/client)
- Test naming: descriptive kebab-case `.test.mjs`
- Statistical tests use 1000+ samples with generous tolerances to avoid flakiness

**Code review fixes from 31B-1:**

- Box-Muller `Math.log(0)` edge case: `u1 === 0` guard + `clampScore` NaN fallback
- These guards are already in place — no need to re-add

**Problems to avoid:**

- Do NOT import Prisma directly from node_modules — use `backend/db/index.mjs`
- Test DB must have latest migrations
- Flaky perf benchmarks may block pre-push hook — thresholds already relaxed

### ES Module Requirements

- All files use `.mjs` extension
- `import/export` only — no `require/module.exports`
- Include `.mjs` in all import paths
- `jest.unstable_mockModule()` for mocking in tests (NOT `jest.mock()`)

### Security Patterns

No new endpoints in this story. Existing security middleware (rate limiting, ownership, validation) already applies to the `createFoal()` flow.

### References

- [Source: docs/epics-physical-systems.md#Story-31B-2] — Acceptance criteria and inheritance formula
- [Source: docs/epics-physical-systems.md#FR-07] — FR-07: Breeding inheritance: 60% parent avg + 40% breed mean + variance
- [Source: docs/epics-physical-systems.md#NFR-01] — Normal distribution verification
- [Source: docs/epics-physical-systems.md#NFR-07] — Score clamping 0-100
- [Source: backend/modules/horses/services/conformationService.mjs] — Existing generation functions
- [Source: backend/modules/horses/controllers/horseController.mjs#createFoal] — Foal creation flow (line ~150)
- [Source: backend/modules/horses/data/breedGeneticProfiles.mjs] — Breed rating profiles
- [Source: _bmad-output/implementation-artifacts/31b-1-conformation-score-generation.md] — Previous story patterns and learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — all 52 tests passed (26 original + 26 added in adversarial review pass).

### Completion Notes List

- All 52 unit + statistical tests pass (conformationBreedingInheritance.test.mjs)
- Full regression: 237 suites / 3986 tests (3969 passed, 17 skipped, 0 failures)
- No Prisma migration needed — uses existing conformationScores JSONB field
- Inheritance formula: baseValue = (sire*0.5 + dam*0.5)*0.6 + breedMean*0.4, then normalRandom(baseValue, breedStdDev)
- Null parent fallback uses breed-only generation (same as 31B-1)
- Unknown breed with valid parents returns default 50s (graceful degradation)
- POST /horses route unchanged — only createFoal() uses inheritance
- Statistical validation confirms: high-scoring parents → above-mean foals, low-scoring parents → regression toward mean

### File List

**New files:**

1. `backend/__tests__/conformationBreedingInheritance.test.mjs` — 52 unit + statistical validation tests

**Modified files:**

1. `backend/modules/horses/services/conformationService.mjs` — Added `generateInheritedConformationScores(breedId, sireScores, damScores)`
2. `backend/modules/horses/controllers/horseController.mjs` — Updated `createFoal()` to use inheritance when both parents have conformationScores
