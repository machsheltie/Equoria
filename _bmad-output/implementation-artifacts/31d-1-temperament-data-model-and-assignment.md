# Story 31D.1: Temperament Assignment Service + Migration

Status: done

## Story

As a developer,
I want each horse to receive a temperament at birth from a weighted random selection based on breed profile,
So that horses have distinct personality traits that affect gameplay.

## Acceptance Criteria

1. **Given** a horse is created (new or foal birth), **When** the creation flow runs, **Then** one of 11 temperaments is assigned: Spirited, Nervous, Calm, Bold, Steady, Independent, Reactive, Stubborn, Playful, Lazy, Aggressive
2. **And** selection uses `weightedRandomSelect(breed.temperament_weights)` from `BREED_GENETIC_PROFILES[breedId]`
3. **And** temperament is permanent — no mutation endpoint exists
4. **And** existing horses without temperament return `null` in API responses (backward compatible)
5. **And** temperament appears in the existing `GET /api/v1/horses/:id` response (already selected by horseModel)
6. **And** over 1000+ horses of the same breed, temperament distribution matches breed weights within statistical tolerance (chi-squared test, p > 0.05)
7. **And** store-bought horses (POST /horses) receive temperament from breed-only generation
8. **And** foals (createFoal) receive temperament from breed-only weighted random (temperament is NOT inherited from parents — it's always a fresh breed-weighted roll per FR-18)

## Tasks / Subtasks

- [x] Task 1: Create temperament service (AC: #1, #2, #6)
  - [x] 1.1 Create `backend/modules/horses/services/temperamentService.mjs`
  - [x] 1.2 Implement `generateTemperament(breedId)` — weighted random from `BREED_GENETIC_PROFILES[breedId].temperament_weights`
  - [x] 1.3 Implement `weightedRandomSelect(weights)` — generic weighted selection utility
  - [x] 1.4 Validate breed exists and has temperament_weights, throw if missing
- [x] Task 2: Integrate into horse creation flows (AC: #1, #7, #8)
  - [x] 2.1 Add temperament generation to `createFoal` in `horseController.mjs` (after gait scores, line ~183)
  - [x] 2.2 Add temperament generation to POST /horses in `horseRoutes.mjs` (after gait scores, line ~481)
  - [x] 2.3 Verify temperament is passed through to `createHorse()` in horseModel (confirmed: line 24 destructures, line 173 persists)
- [x] Task 3: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6)
  - [x] 3.1 Unit tests for `generateTemperament()` — returns valid temperament for each breed (12 breeds tested)
  - [x] 3.2 Statistical distribution test — 2000 horses per breed, chi-squared test p > 0.05 (4 breeds tested)
  - [x] 3.3 Edge case tests — breedId 0, -1, 999, null, undefined all throw
  - [x] 3.4 Integration test — breed data integrity verified (weights sum 100, canonical types, non-negative integers)
  - [x] 3.5 Backward compatibility test — existing horses without temperament return null
- [x] Task 4: Verify no mutation path exists (AC: #3)
  - [x] 4.1 Confirm `validateHorseUpdatePayload` allowedFields = ['name', 'sex', 'gender', 'dateOfBirth', 'breedId'] — temperament NOT included

## Dev Notes

### CRITICAL: No Prisma Migration Needed

The `temperament String?` field **already exists** in the Horse model at `packages/database/prisma/schema.prisma` line 118. No migration is required. The field is nullable and will return null for existing horses.

### CRITICAL: temperamentDrift.mjs Conflict

`backend/utils/temperamentDrift.mjs` defines 6 old temperament types: `Calm, Spirited, Nervous, Aggressive, Docile, Unpredictable`. Our 11-type system from `breedGeneticProfiles.mjs` is the canonical source (per PRD-03 §7). **Do NOT import from or modify temperamentDrift.mjs** — it's a legacy utility. Our new `temperamentService.mjs` is the authoritative temperament assignment source. The drift utility will be reconciled in a future story if needed.

### CRITICAL: Temperament Is NOT Inherited

Unlike conformation (60% parent / 40% breed mean) and gaits (same), temperament assignment is a fresh breed-weighted random roll every time. Per FR-18: "Assign one of 11 temperaments at birth via weighted random from breed profile." No parent blending. Foals and store horses use the exact same `generateTemperament(breedId)` function.

### Service Pattern to Follow

Mirror `conformationService.mjs` and `gaitService.mjs` structure:

- Export named functions (not a class)
- Import `BREED_GENETIC_PROFILES` from `../data/breedGeneticProfiles.mjs`
- Clamp/validate outputs
- JSDoc all exports

### Integration Points (Exact Locations)

**Foal creation:** `backend/modules/horses/controllers/horseController.mjs`

- Lines 157-169: conformation scores generated
- Lines 171-180: gait scores generated
- **Insert after line 180:** `const temperament = generateTemperament(breedId);`
- Lines 183-202: add `temperament` to horseData object

**Store purchase:** `backend/modules/horses/routes/horseRoutes.mjs`

- Lines 477-479: conformation and gait scores generated
- **Insert after line 479:** `const temperament = generateTemperament(req.body.breedId);`
- Lines 483-494: add `temperament` to horseData object

**Persistence:** `backend/models/horseModel.mjs`

- Line 24: `temperament` already destructured from horseData
- Line 173: `...(temperament && { temperament })` — already persists if provided
- No changes needed to horseModel.

### Breed Data Location

`backend/modules/horses/data/breedGeneticProfiles.mjs` exports:

- `TEMPERAMENT_TYPES` (array of 11 strings, line 104)
- `BREED_GENETIC_PROFILES` (keyed by breed ID 1-12, each has `.temperament_weights` object)

Example (Thoroughbred, ID 1):

```javascript
temperament_weights: {
  Spirited: 30, Nervous: 15, Calm: 3, Bold: 15, Steady: 5,
  Independent: 5, Reactive: 15, Stubborn: 3, Playful: 5, Lazy: 3, Aggressive: 1
}
// Sum = 100
```

### Weighted Random Selection Algorithm

```javascript
function weightedRandomSelect(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return entries[entries.length - 1][0]; // fallback
}
```

### Test File Pattern

Follow `backend/__tests__/gaitScoreGeneration.test.mjs` structure:

- File: `backend/__tests__/temperamentAssignment.test.mjs`
- Mock only: Prisma client, logger
- Test real service logic with real breed data
- Statistical tests use chi-squared from manual calculation (no external stats library)

### Chi-Squared Test Implementation

For statistical validation (AC #6):

```javascript
// For each breed, generate 1000+ temperaments
// Calculate observed vs expected frequencies
// chi-squared = Σ((observed - expected)² / expected)
// Degrees of freedom = numTypes - 1
// Compare against critical value for p > 0.05
// df=10 → critical value = 18.307
```

### Files to Create

| File                                                     | Purpose                                                   |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `backend/modules/horses/services/temperamentService.mjs` | `generateTemperament(breedId)` + `weightedRandomSelect()` |
| `backend/__tests__/temperamentAssignment.test.mjs`       | Unit + statistical + edge case tests                      |

### Files to Modify

| File                                                     | Change                                              |
| -------------------------------------------------------- | --------------------------------------------------- |
| `backend/modules/horses/controllers/horseController.mjs` | Import temperamentService, add to createFoal flow   |
| `backend/modules/horses/routes/horseRoutes.mjs`          | Import temperamentService, add to POST /horses flow |

### Files NOT to Modify

| File                                                   | Reason                                   |
| ------------------------------------------------------ | ---------------------------------------- |
| `packages/database/prisma/schema.prisma`               | `temperament String?` already exists     |
| `backend/models/horseModel.mjs`                        | Already accepts and persists temperament |
| `backend/utils/temperamentDrift.mjs`                   | Legacy — do not touch                    |
| `backend/modules/horses/data/breedGeneticProfiles.mjs` | Data already complete                    |

### Project Structure Notes

- New service goes in `backend/modules/horses/services/` alongside `conformationService.mjs` and `gaitService.mjs`
- Test file goes in `backend/__tests__/` following existing naming convention
- ES modules only (`.mjs` extension, import/export)
- All imports must include `.mjs` extension

### References

- [Source: docs/epics-physical-systems.md — Epic 31D, Story 31D-1] FR-18, FR-19, FR-24, FR-25
- [Source: docs/epics-physical-systems.md — NFR-04] Statistical distribution validation
- [Source: docs/epics-physical-systems.md — NFR-06] Backward compatibility for null temperament
- [Source: _bmad-output/implementation-artifacts/epic-31c-retro-2026-03-27.md] Pattern reuse, zero-deferral policy
- [Source: backend/modules/horses/data/breedGeneticProfiles.mjs] TEMPERAMENT_TYPES, BREED_GENETIC_PROFILES
- [Source: packages/database/prisma/schema.prisma line 118] temperament field already exists

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Completion Notes List

- Created temperamentService.mjs with `generateTemperament(breedId)` and `weightedRandomSelect(weights)` — follows conformationService/gaitService pattern
- Integrated temperament generation into both horse creation flows (createFoal controller + POST /horses route)
- No Prisma migration needed — `temperament String?` field already exists in schema (line 118)
- Did NOT touch legacy `temperamentDrift.mjs` (6-type system) — our 11-type canonical system is independent
- Temperament is NOT inherited from parents — always a fresh breed-weighted random roll per FR-18
- 27 tests written: 8 weightedRandomSelect unit tests, 9 generateTemperament tests, 4 breed data integrity tests, 4 chi-squared statistical distribution tests (2000 samples each), 1 backward compat test, 1 immutability test
- All 27 tests pass in isolation; full regression: 238/241 suites pass (3 pre-existing failures unrelated to our changes)

### Change Log

- 2026-03-28: Story 31D-1 implemented — temperament assignment service + integration into horse creation

### File List

**Created:**

- `backend/modules/horses/services/temperamentService.mjs` — temperament assignment service
- `backend/__tests__/temperamentAssignment.test.mjs` — 27 tests (unit, statistical, edge case)

**Modified:**

- `backend/modules/horses/controllers/horseController.mjs` — import + call generateTemperament in createFoal
- `backend/modules/horses/routes/horseRoutes.mjs` — import + call generateTemperament in POST /horses
