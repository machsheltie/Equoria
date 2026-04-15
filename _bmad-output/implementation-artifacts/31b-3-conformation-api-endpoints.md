# Story 31B.3: Conformation API Endpoints

Status: done

## Story

As a player,
I want to view my horse's conformation scores and see how it compares to its breed,
So that I can evaluate my horse's physical quality and make informed breeding decisions.

## Acceptance Criteria

1. **Given** a horse exists with conformation scores
   **When** `GET /api/v1/horses/:id/conformation` is called
   **Then** the response includes all 8 region scores + overall conformation average
   **And** response time is <200ms

2. **Given** a horse exists with conformation scores
   **When** `GET /api/v1/horses/:id/conformation/analysis` is called
   **Then** the response includes percentile rankings per region compared to the horse's breed
   **And** percentile is calculated against all horses of the same breed in the database
   **And** response time is <200ms

3. **Given** a horse exists without conformation scores (legacy horse)
   **When** either endpoint is called
   **Then** the response returns `null` or empty conformation data with 200 status (not an error)

## Tasks / Subtasks

- [x] Task 1: Add controller functions to horseController.mjs (AC: #1, #2, #3)
  - [x] 1.1 Create `getConformation(req, res)` — reads `req.horse.conformationScores` (already attached by `requireOwnership` middleware), returns scores + overallConformation
  - [x] 1.2 Create `getConformationAnalysis(req, res)` — queries all horses of same breed, calculates percentile per region, returns analysis
  - [x] 1.3 Both functions handle null/missing conformationScores → return 200 with `data: null`

- [x] Task 2: Add routes to horseRoutes.mjs (AC: #1, #2)
  - [x] 2.1 Add `GET /:id/conformation` route with middleware chain: `queryRateLimiter` → `validateHorseId` → `requireOwnership('horse')` → handler
  - [x] 2.2 Add `GET /:id/conformation/analysis` route with same middleware chain
  - [x] 2.3 Place routes BEFORE the `/:id` catch-all route (Express matches first defined)

- [x] Task 3: Write unit/integration tests (AC: #1, #2, #3)
  - [x] 3.1 Test GET /conformation returns all 8 regions + overallConformation for a horse with scores
  - [x] 3.2 Test GET /conformation returns 200 with null data for legacy horse without scores
  - [x] 3.3 Test GET /conformation/analysis returns percentile per region
  - [x] 3.4 Test percentile calculation: a horse with max scores should have high percentiles
  - [x] 3.5 Test GET /conformation/analysis returns 200 with null data for legacy horse
  - [x] 3.6 Test 400 for invalid horse ID (non-integer) — covered by validateHorseId middleware (existing middleware tests)
  - [x] 3.7 Test ownership middleware is enforced (403 for non-owner) — covered by requireOwnership middleware (existing middleware tests)
  - [x] 3.8 Test rate limiting is applied — covered by queryRateLimiter middleware (existing middleware tests)

## Dev Notes

### CRITICAL: Route Ordering in Express

Routes with `/:id/conformation` and `/:id/conformation/analysis` MUST be defined BEFORE the generic `/:id` route in `horseRoutes.mjs`. Express uses first-match routing — if `/:id` is first, it will catch `/123/conformation` as `id = "123"` with leftover path.

**Insert new routes at line ~357** (before the existing `GET /:id` block) in `horseRoutes.mjs`.

### Endpoint 1: GET /horses/:id/conformation

**Response shape (FR-08):**

```javascript
{
  success: true,
  message: 'Conformation scores retrieved successfully',
  data: {
    horseId: 123,
    horseName: 'Midnight Star',
    breedId: 1,
    conformationScores: {
      head: 82,
      neck: 75,
      shoulders: 70,
      back: 68,
      hindquarters: 78,
      legs: 72,
      hooves: 71,
      topline: 74,
      overallConformation: 74
    }
  }
}
```

**Legacy horse (null scores) response:**

```javascript
{
  success: true,
  message: 'No conformation scores available for this horse',
  data: null
}
```

### Endpoint 2: GET /horses/:id/conformation/analysis

**Response shape (FR-09):**

```javascript
{
  success: true,
  message: 'Conformation analysis retrieved successfully',
  data: {
    horseId: 123,
    horseName: 'Midnight Star',
    breedId: 1,
    breedName: 'Thoroughbred',
    totalHorsesInBreed: 47,
    analysis: {
      head: { score: 82, breedMean: 78, percentile: 72 },
      neck: { score: 75, breedMean: 76, percentile: 48 },
      shoulders: { score: 70, breedMean: 72, percentile: 38 },
      back: { score: 68, breedMean: 70, percentile: 35 },
      hindquarters: { score: 78, breedMean: 75, percentile: 62 },
      legs: { score: 72, breedMean: 71, percentile: 55 },
      hooves: { score: 71, breedMean: 72, percentile: 45 },
      topline: { score: 74, breedMean: 72, percentile: 58 }
    },
    overallConformation: {
      score: 74,
      breedMean: 73,
      percentile: 52
    }
  }
}
```

### Percentile Calculation

Percentile = percentage of same-breed horses that score LOWER than this horse in a given region.

```javascript
// Per region:
const sameBreedHorses = await prisma.horse.findMany({
  where: { breedId: horse.breedId },
  select: { conformationScores: true },
});

// Filter out horses without scores
const validHorses = sameBreedHorses.filter(h => h.conformationScores != null);

// For each region, count how many score lower
const lowerCount = validHorses.filter(
  h => h.conformationScores[region] < thisHorse.conformationScores[region]
).length;
const percentile = Math.round((lowerCount / validHorses.length) * 100);
```

**Edge case:** If only 1 horse of that breed exists → percentile = 50 (median by default).

**Edge case:** Breed mean should come from BREED_GENETIC_PROFILES (the design profile mean), NOT the database average. This is the breed's *designed* mean, not the sampled mean.

### Middleware Chain (copy existing pattern)

```javascript
// Pattern from GET /:id/overview, /:id/xp, etc.
router.get(
  '/:id/conformation',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    // req.horse is pre-attached by requireOwnership — NO additional DB query needed
    await getConformation(req, res);
  },
);
```

### requireOwnership Pre-Fetches Horse

The `requireOwnership('horse')` middleware already fetches the horse from DB and attaches it to `req.horse`. The handler does NOT need another `prisma.horse.findUnique()` call for the basic horse data.

However, the analysis endpoint DOES need an additional query to get all same-breed horses for percentile calculation. Only the percentile comparison query is new.

### Controller Import Pattern

Export from `horseController.mjs` and import at the top of `horseRoutes.mjs`:

```javascript
// horseRoutes.mjs line 4 — add to existing import
import { getHorseOverview, getHorsePersonalityImpact, getConformation, getConformationAnalysis } from '../controllers/horseController.mjs';
```

### Existing Functions to Reuse (DO NOT DUPLICATE)

From `backend/modules/horses/services/conformationService.mjs`:
- `CONFORMATION_REGIONS` — `['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline']`
- `calculateOverallConformation(scores)` — arithmetic mean of 8 regions

From `backend/modules/horses/data/breedGeneticProfiles.mjs`:
- `BREED_GENETIC_PROFILES` — for breed mean lookup per region

### POST /horses Route — NO CHANGE

The `POST /horses` route creates NEW horses (not related to this story). Leave unchanged.

### Test File Location

Create: `backend/__tests__/conformationApiEndpoints.test.mjs`

### Test Strategy

Tests need to mock the ownership middleware and Prisma calls. Follow the established pattern from existing API tests:

```javascript
// Use jest.unstable_mockModule for ESM mocking
const mockPrisma = { horse: { findMany: jest.fn() } };
jest.unstable_mockModule('../../../db/index.mjs', () => ({ default: mockPrisma }));
```

For integration tests, use the auth helper pattern from `backend/tests/helpers/authHelper.mjs` to get real JWT tokens.

### Test Execution

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js conformationApiEndpoints
```

### Project Structure Notes

**Files to modify:**
1. `backend/modules/horses/controllers/horseController.mjs` — Add `getConformation()` and `getConformationAnalysis()`
2. `backend/modules/horses/routes/horseRoutes.mjs` — Add 2 GET routes before `/:id`

**Files to create:**
1. `backend/__tests__/conformationApiEndpoints.test.mjs` — API endpoint tests

**No new routes files, no Prisma migration, no schema changes.**

### Previous Story Intelligence (31B-1 + 31B-2)

**Patterns established:**
- Import breed data from `backend/modules/horses/data/breedGeneticProfiles.mjs`
- Access pattern: `BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation[region].mean`
- Each region: `{ mean: number, std_dev: 8 }` (Lusitano uses 6-7)
- Use shared Prisma client: `import prisma from '../../../db/index.mjs'` (NOT direct @prisma/client)
- Test naming: descriptive kebab-case `.test.mjs`
- conformationScores is a JSONB field on Horse — can be null for legacy horses
- Horse has `.breedId` and `.breed` (when included) for breed lookup

**Code review fixes from 31B-1:**
- Box-Muller `Math.log(0)` edge case: `u1 === 0` guard + `clampScore` NaN fallback
- These guards are already in place — no need to re-add

**Problems to avoid:**
- Do NOT import Prisma directly from node_modules — use `backend/db/index.mjs`
- Test DB must have latest migrations
- Route ordering matters in Express — put specific routes before parameterized ones

### ES Module Requirements

- All files use `.mjs` extension
- `import/export` only — no `require/module.exports`
- Include `.mjs` in all import paths
- `jest.unstable_mockModule()` for mocking in tests (NOT `jest.mock()`)

### Security Patterns

Both new endpoints are GET (read-only) and use the established security middleware chain:
- `queryRateLimiter` — 100 req/15min per IP
- `validateHorseId` — rejects non-integer IDs
- `requireOwnership('horse')` — verifies authenticated user owns the horse

No new security middleware needed. No mutation. No user input beyond the horse ID (already validated).

### Performance Notes

- `GET /conformation` — O(1), just reads `req.horse.conformationScores`. No additional DB query.
- `GET /conformation/analysis` — O(N) where N = same-breed horses. For <1000 horses per breed, this is <200ms. If breeds grow large, consider indexing `Horse.breedId` + caching percentiles.
- Prisma `select: { conformationScores: true }` reduces data transfer for the analysis query.

### References

- [Source: docs/epics-physical-systems.md#Story-31B-3] — Acceptance criteria
- [Source: docs/epics-physical-systems.md#FR-08] — GET /horses/:id/conformation endpoint
- [Source: docs/epics-physical-systems.md#FR-09] — GET /horses/:id/conformation/analysis endpoint
- [Source: docs/epics-physical-systems.md#NFR-06] — Backward compatible — existing horses without new fields return null
- [Source: backend/modules/horses/routes/horseRoutes.mjs] — Existing route patterns and middleware chain
- [Source: backend/modules/horses/controllers/horseController.mjs] — Existing controller patterns
- [Source: backend/modules/horses/services/conformationService.mjs] — CONFORMATION_REGIONS, calculateOverallConformation
- [Source: backend/modules/horses/data/breedGeneticProfiles.mjs] — Breed rating profiles for breed mean
- [Source: _bmad-output/implementation-artifacts/31b-2-conformation-breeding-inheritance.md] — Previous story patterns
- [Source: _bmad-output/implementation-artifacts/31b-1-conformation-score-generation.md] — Original story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — all 10 tests passed on first run.

### Completion Notes List

- All 10 unit tests pass (conformationApiEndpoints.test.mjs)
- Full regression: 238 suites / 3991 passed / 17 skipped / 0 failures
- No Prisma migration needed — reads existing conformationScores JSONB field
- `getConformation()` is O(1) — reads from `req.horse` pre-attached by middleware
- `getConformationAnalysis()` queries same-breed horses for percentile calculation
- Breed mean comes from BREED_GENETIC_PROFILES (designed mean), not database average
- Edge case: single horse in breed → percentile defaults to 50
- Edge case: legacy horses without scores → 200 with `data: null`
- Routes placed before `/:id` catch-all for correct Express route matching
- Middleware chain: `queryRateLimiter` → `validateHorseId` → `requireOwnership('horse')` → handler
- Tests 3.6/3.7/3.8 covered by existing middleware test suites (no duplication needed)

### File List

**New files:**

1. `backend/__tests__/conformationApiEndpoints.test.mjs` — 10 unit tests for API endpoints

**Modified files:**

1. `backend/modules/horses/controllers/horseController.mjs` — Added `getConformation()` and `getConformationAnalysis()` exports + imports for CONFORMATION_REGIONS, calculateOverallConformation, BREED_GENETIC_PROFILES, CANONICAL_BREEDS
2. `backend/modules/horses/routes/horseRoutes.mjs` — Added `GET /:id/conformation` and `GET /:id/conformation/analysis` routes before `/:id` catch-all + import for getConformation, getConformationAnalysis
