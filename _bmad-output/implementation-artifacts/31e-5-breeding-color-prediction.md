# Story 31E-5: Breeding Color Prediction

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-5-breeding-color-prediction
**Status:** review

---

## Story

As a player,
I want to see a probability chart of possible offspring colors before breeding,
So that I can make informed breeding decisions based on genetics.

---

## Acceptance Criteria

**AC1 — Prediction endpoint**
Given two horses with known genotypes,
When `POST /api/v1/horses/breeding/color-prediction` is called with `{ sireId, damId }`,
Then the response includes a probability chart listing all possible offspring phenotypes with percentage likelihood.

**AC2 — Mendelian probability calculation**
Given sire and dam genotypes across all 17 CORE_LOCI,
When probabilities are calculated,
Then each locus uses independent Mendelian segregation (each parent contributes one allele with 50/50 probability),
And all locus combinations are enumerated to produce the full set of possible offspring genotypes,
And each genotype is run through `calculatePhenotype()` to get the color name,
And identical color names are aggregated into a single entry with summed probability.

**AC3 — Lethal combinations excluded**
Given the set of all possible offspring genotypes,
When lethal combinations exist (e.g., O/O Frame Overo, W homozygotes),
Then those genotypes are removed from the output,
And remaining probabilities are renormalized to sum to 100%.

**AC4 — Breed restrictions applied**
Given the predicted foal breed has `allowed_alleles` restrictions in its `breedGeneticProfile`,
When a possible genotype contains a restricted allele pair for any locus,
Then that locus is replaced with the breed's default (allowed[0]) before phenotype calculation.

**AC5 — Ownership enforcement**
Given a user who does not own both horses,
When the prediction endpoint is called,
Then it returns 404 (ownership disclosure prevention — same pattern as other horse endpoints).

**AC6 — Legacy horse handling**
Given one or both parent horses have no `colorGenotype` (legacy horses),
When the prediction endpoint is called,
Then it returns 200 with `{ success: true, data: null, message: 'Color prediction requires both parents to have genetics data' }`.

**AC7 — Performance constraint**
Given the prediction involves enumerating genotype combinations across 17 loci,
When probabilities are calculated,
Then response time is <500ms,
And the calculation uses an efficient per-locus probability approach (not brute-force 2^17 enumeration).

**AC8 — Response format**
The response data shape is:

```json
{
  "sireId": 1,
  "damId": 2,
  "possibleColors": [
    { "colorName": "Bay", "probability": 0.375, "percentage": "37.5%" },
    { "colorName": "Chestnut", "probability": 0.25, "percentage": "25.0%" }
  ],
  "totalCombinations": 128,
  "lethalCombinationsFiltered": 4
}
```

**AC9 — Tests**

- Unit: breedingColorPredictionService pure function tests
- Unit: per-locus probability generation (Ee x Ee → 25/50/25)
- Unit: lethal exclusion + renormalization
- Unit: breed restriction application
- Unit: phenotype aggregation (multiple genotypes → same color name)
- Unit: legacy null parent handling
- Controller: mock req/res tests for the endpoint
- Statistical: known Mendelian cross probabilities match expected ratios

---

## Tasks / Subtasks

- [x] T1: Create `breedingColorPredictionService.mjs` — pure-function service

  - [x] T1.1 `generateLocusProbabilities(sireAllelePair, damAllelePair)`
  - [x] T1.2 `generateAllGenotypeProbabilities(sireGenotype, damGenotype)`
  - [x] T1.3 `filterLethalGenotypes(genotypeProbabilities)`
  - [x] T1.4 `applyBreedRestrictions(genotypeProbabilities, foalBreedProfile)`
  - [x] T1.5 `aggregateByPhenotype(genotypeProbabilities, shadeBias)`
  - [x] T1.6 `predictBreedingColors(sireGenotype, damGenotype, foalBreedProfile)`

- [x] T2: Add controller function to horseController.mjs

  - [x] T2.1 `getBreedingColorPrediction(req, res)` — ownership check, JSONB guard, breed profile resolution, service call

- [x] T3: Wire route into horseRoutes.mjs

  - [x] T3.1 `POST /horses/breeding/color-prediction` with body `{ sireId, damId, foalBreedId? }`
  - [x] T3.2 Middleware: `mutationRateLimiter`, `rejectPollutedRequest`, `authenticateToken`, body validation
  - [x] T3.3 Ownership validation for both sire and dam (in controller)

- [x] T4: Write tests — 25 total (19 service + 6 controller)
  - [x] T4.1 Unit: generateLocusProbabilities — Ee x Ee, EE x ee, ee x ee, multi-char alleles
  - [x] T4.2 Unit: filterLethalGenotypes — O/O removed, probabilities renormalized, no lethals passthrough
  - [x] T4.3 Unit: applyBreedRestrictions — restricted allele replaced, null profile, allowed passthrough
  - [x] T4.4 Unit: aggregateByPhenotype — same color aggregated, sorted descending, percentage format
  - [x] T4.5 Unit: predictBreedingColors — full pipeline, response shape, lethal filtering
  - [x] T4.6 Unit: legacy null genotype handling (minimal genotype objects)
  - [x] T4.7 Controller: mock req/res — success, 404 sire/dam/ownership, legacy null, JSONB guard
  - [x] T4.8 Statistical: Ee x Ee → 25/50/25 at Extension and Agouti loci

---

## Dev Notes

### Architecture Decision: Per-Locus Probability (NOT Brute Force)

AC7 requires <500ms. With 17 loci, brute-force enumeration would require 2^17 × 2^17 = 17 billion combinations. Instead, use **per-locus independent probability**:

1. For each locus independently, compute the 2×2 Punnett square (at most 4 outcomes per locus)
2. Group by phenotype contribution at each locus
3. Use Cartesian product of per-locus phenotype-relevant groups only

**Optimization strategy**: Since `calculatePhenotype()` processes loci in a fixed priority order (base color → dilutions → patterns → gray/roan/white), many loci are binary (present/absent). Group loci by phenotype impact:

- **Base color loci**: E, A (4 combos max → 3 base colors)
- **Dilution loci**: Cr, D, Z, Ch, Mushroom (each independently modifies base)
- **Pattern loci**: G, Rn, W, TO, O, SB1, SW, LP, PATN1, EDXW (each is present/absent flag)

Total unique phenotypes is bounded by `3 × dilution_combos × pattern_combos`, which is manageable.

**Implementation approach**: Generate per-locus probability distributions, compute Cartesian product of all loci, then pass each resulting genotype through `calculatePhenotype()`. With deduplication and caching, this is tractable in <500ms.

### Existing Services to Reuse (DO NOT REINVENT)

| Service               | File                                  | Functions to Import                                              |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Allele splitting      | `breedingColorInheritanceService.mjs` | `splitAlleles()`, `isLethalCombination()`, `LETHAL_COMBINATIONS` |
| Phenotype calculation | `phenotypeCalculationService.mjs`     | `calculatePhenotype()`                                           |
| Locus constants       | `genotypeGenerationService.mjs`       | `CORE_LOCI`, `GENERIC_DEFAULTS`                                  |
| Breed profiles        | `breedGeneticProfileData.mjs`         | `BREED_GENETIC_PROFILES`                                         |

### Pure Function Pattern (AC7 — no DB calls in service)

Like all other 31E services, `breedingColorPredictionService.mjs` must be a **pure function service**:

- No Prisma imports
- No HTTP calls
- `rng` parameter for deterministic testing (not needed here since this is probability calculation, not random sampling — but keep consistent signature)
- All DB fetching happens in the controller/route layer

### Allele Pair Format

Allele pairs are stored as `"allele1/allele2"` strings (e.g., `"E/e"`, `"Cr/Cr"`, `"nd2/nd2"`).
Use `splitAlleles()` from breedingColorInheritanceService to parse.

### Controller Pattern (from 31E-4)

```javascript
export async function getBreedingColorPrediction(req, res) {
  try {
    // Validate and fetch both horses
    const { sireId, damId } = req.body;
    const [sire, dam] = await Promise.all([
      prisma.horse.findUnique({ where: { id: sireId }, select: { id: true, name: true, colorGenotype: true, userId: true } }),
      prisma.horse.findUnique({ where: { id: damId }, select: { id: true, name: true, colorGenotype: true, userId: true } }),
    ]);

    // Ownership check — 404 for both not-found and not-owned (disclosure prevention)
    if (!sire || sire.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }
    if (!dam || dam.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    // JSONB type guard for both genotypes
    if (!isValidGenotype(sire.colorGenotype) || !isValidGenotype(dam.colorGenotype)) {
      return res.status(200).json({
        success: true,
        message: 'Color prediction requires both parents to have genetics data',
        data: null,
      });
    }

    // Fetch breed profile for foal (use sire's breed or dam's breed — TBD)
    const foalBreedProfile = ...; // resolve from breed

    // Pure function call
    const prediction = predictBreedingColors(
      sire.colorGenotype,
      dam.colorGenotype,
      foalBreedProfile,
    );

    return res.status(200).json({
      success: true,
      message: 'Breeding color prediction calculated successfully',
      data: {
        sireId: sire.id,
        damId: dam.id,
        ...prediction,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getBreedingColorPrediction] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while calculating breeding color prediction',
      data: null,
    });
  }
}
```

### Route Placement Decision

The endpoint `POST /horses/breeding/color-prediction` should go in `horseRoutes.mjs` since it follows the horse domain pattern. However, there's also `advancedBreedingGeneticsRoutes.mjs` which already has `POST /api/breeding/genetic-probability`. **Recommend placing in horseRoutes.mjs** for consistency with the 31E-4 endpoints, but the dev should check if the existing `genetic-probability` endpoint in advancedBreedingGeneticsRoutes overlaps and consider colocating.

### Foal Breed Determination

The AC says "breed restrictions of the predicted foal breed are applied." The foal's breed is typically the dam's breed in this system (from the POST /horses handler). The prediction should accept an optional `foalBreedId` parameter, defaulting to the dam's breedId.

### Test Pattern (from 31E-4)

```javascript
import { jest } from '@jest/globals';
jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));
const { predictBreedingColors } = await import(
  '../modules/horses/services/breedingColorPredictionService.mjs'
);
```

### File Locations

- Service: `backend/modules/horses/services/breedingColorPredictionService.mjs`
- Tests: `backend/__tests__/breedingColorPredictionService.test.mjs`
- Controller: `backend/modules/horses/controllers/horseController.mjs` (append)
- Route: `backend/modules/horses/routes/horseRoutes.mjs` (new POST route)
- Controller test: `backend/__tests__/breedingColorPredictionApi.test.mjs`

### Previous Story Learnings (31E-3 and 31E-4)

- **lint-staged + Windows**: The locked `rollup.win32-x64-msvc.node` can cause stash pop failures. Ensure all lint passes before committing.
- **catch blocks**: Use `catch (error)` and reference `error.message` in logger call to avoid unused-variable lint errors. Do NOT use `catch (_error)`.
- **JSONB type guard**: Always check `!== null && !== undefined && typeof === 'object' && !Array.isArray()` for Prisma `Json?` columns.
- **Route ordering**: Place specific routes (like `/:id/genetics`) BEFORE catch-all `/:id` routes.
- **req.horse null guard**: Add explicit check for middleware contract violation.
- **rejectPollutedRequest**: Add to all new routes for HTTP parameter pollution prevention.
- **eqeqeq**: Use strict equality (`!==`) not loose (`!=`).

### References

- [Source: docs/epics-physical-systems.md#31E-5]
- [Source: backend/modules/horses/services/breedingColorInheritanceService.mjs — splitAlleles, isLethalCombination, LETHAL_COMBINATIONS]
- [Source: backend/modules/horses/services/phenotypeCalculationService.mjs — calculatePhenotype]
- [Source: backend/modules/horses/services/genotypeGenerationService.mjs — CORE_LOCI, GENERIC_DEFAULTS]
- [Source: docs/sprint-artifacts/31E-4-color-genetics-api-endpoints.md — previous story]
- [Source: docs/sprint-artifacts/31E-3-marking-system.md — marking service pattern]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Implementation Plan

1. Created `breedingColorPredictionService.mjs` with 6 pure functions: per-locus Punnett square probability, Cartesian product enumeration, lethal filtering with renormalization, breed restriction enforcement, phenotype aggregation, and full pipeline orchestrator.
2. Added `getBreedingColorPrediction` controller to `horseController.mjs` with ownership enforcement (404 disclosure prevention), JSONB type guards, breed profile resolution (defaults to dam's breed), and dynamic service import.
3. Wired `POST /horses/breeding/color-prediction` route with `mutationRateLimiter`, `rejectPollutedRequest`, `authenticateToken`, and express-validator body validation.
4. Wrote 25 tests across 2 test files: 19 service unit tests + 6 controller mock req/res tests.

### Debug Log References

- No issues encountered during implementation.

### Completion Notes List

- AC1: POST endpoint returns probability chart with color names, probabilities, and percentages
- AC2: Mendelian segregation via 2x2 Punnett square per locus, Cartesian product for all combinations
- AC3: Lethal combinations (O/O, W homozygotes, etc.) filtered and probabilities renormalized
- AC4: Breed restrictions applied via allowed_alleles replacement before phenotype calculation
- AC5: Ownership enforcement returns 404 for both not-found and not-owned horses
- AC6: Legacy horses without colorGenotype return 200 with null data and descriptive message
- AC7: Per-locus probability approach avoids brute-force 2^17 enumeration; response is fast
- AC8: Response shape matches spec: possibleColors array with colorName/probability/percentage, totalCombinations, lethalCombinationsFiltered
- AC9: 25 tests total — service unit, controller mock, statistical validation — all passing
- Pre-existing indent lint errors auto-fixed in horseController.mjs

### Change Log

| Date       | Change                                                  |
| ---------- | ------------------------------------------------------- |
| 2026-04-03 | Implementation complete — all tasks done, status review |

### File List

- `backend/modules/horses/services/breedingColorPredictionService.mjs` — new (pure-function service)
- `backend/modules/horses/controllers/horseController.mjs` — modified (getBreedingColorPrediction + isValidGenotype appended)
- `backend/modules/horses/routes/horseRoutes.mjs` — modified (import + POST route added)
- `backend/__tests__/breedingColorPredictionService.test.mjs` — new (19 service tests)
- `backend/__tests__/breedingColorPredictionApi.test.mjs` — new (6 controller tests)
