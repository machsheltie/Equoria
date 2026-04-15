# Story 31C.1: Gait Score Generation Service

Status: done

## Story

As a developer,
I want a service that generates gait quality scores for a horse based on breed genetics and conformation influence,
So that every horse has permanent movement quality attributes generated at birth.

## Acceptance Criteria

1. **Given** a horse is being created with conformation scores already generated
   **When** the gait generation service runs
   **Then** 4 standard gait scores are generated: `{ walk, trot, canter, gallop }`, each 0-100

2. **Given** gait scores are being generated
   **When** each standard gait score is calculated
   **Then** score = `clamp(normalRandom(breedGaitMean, breedGaitStdDev) + conformationBonus, 0, 100)`

3. **Given** conformation scores exist on the horse
   **When** conformation bonus is calculated per gait
   **Then** bonus = `(avg of relevant conformation regions - 70) * 0.15` using this mapping:
   - Walk: Shoulders + Back
   - Trot: Shoulders + Hindquarters
   - Canter: Back + Hindquarters
   - Gallop: Legs + Hindquarters
   - Gaited gaits: Legs + Back + Hindquarters

4. **Given** the horse's breed has `is_gaited_breed: true`
   **When** the gait generation service runs
   **Then** additional gaited gait entries are generated with breed-specific names from `gaited_gait_registry`
   **And** gaiting score = `clamp(normalRandom(breedGaitingMean, breedGaitingStdDev) + conformationBonus, 0, 100)`
   **And** the same gaiting base score applies to all named gaits for that breed
   **And** stored as `gaiting: [{ name: "Slow Gait", score: 85 }, { name: "Rack", score: 85 }]`

5. **Given** the horse's breed has `is_gaited_breed: false`
   **When** the gait generation service runs
   **Then** `gaiting` is stored as `null`

6. **Given** gait scores are generated
   **When** stored on the horse
   **Then** they are written to `Horse.gaitScores` JSONB field (added via Prisma migration)

7. **Given** gait scores exist on a horse
   **When** any API request is made
   **Then** no endpoint exists to modify gait scores after creation (immutable)

8. **Given** 1000+ horses generated for the same breed
   **When** scores are analyzed statistically
   **Then** 95% of standard gait scores fall within `breedMean ± 2 * breedStdDev` (normal distribution verification)

## Tasks / Subtasks

- [x] Task 1: Prisma migration — add `gaitScores` JSONB field to Horse model (AC: #6)
  - [x] 1.1 Add `gaitScores Json?` field to Horse model in `packages/database/prisma/schema.prisma` (nullable, no default — existing horses get null)
  - [x] 1.2 Run `npx prisma migrate dev --name add-gait-scores-field` in `packages/database/`
  - [x] 1.3 Run `npx prisma generate` to regenerate client
  - [x] 1.4 Deploy migration to test DB: `DATABASE_URL=postgresql://...equoria_test npx prisma migrate deploy`
  - [x] 1.5 Verify migration: `npx prisma db pull` shows new field, no data loss
- [x] Task 2: Create `gaitService.mjs` (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Implement `STANDARD_GAITS` constant: `['walk', 'trot', 'canter', 'gallop']`
  - [x] 2.2 Implement `CONFORMATION_GAIT_MAPPING` constant (gait → [region1, region2+])
  - [x] 2.3 Implement `calculateConformationBonus(conformationScores, gaitKey)` — `(avg of mapped regions - 70) * 0.15`
  - [x] 2.4 Implement `generateGaitScores(breedId, conformationScores)` — returns `{ walk, trot, canter, gallop, gaiting }` where gaiting is `[{name, score}]` or `null`
  - [x] 2.5 Reuse `normalRandom` and `clampScore` from `conformationService.mjs` (import, do NOT duplicate)
- [x] Task 3: Integrate with horse creation flow (AC: #6, #7)
  - [x] 3.1 Hook into `horseRoutes POST /horses` — call gait generation AFTER conformation generation, pass conformationScores
  - [x] 3.2 Hook into `horseController.createFoal()` — call gait generation AFTER conformation generation, pass conformationScores
  - [x] 3.3 Add `gaitScores` to the `horseData` object passed to `createHorse()`
  - [x] 3.4 Verify `validateHorseUpdatePayload` allowedFields does NOT include `gaitScores` (immutability via existing whitelist)
- [x] Task 4: Implement inherited gait generation for breeding (AC: #2, #4, #5)
  - [x] 4.1 Implement `generateInheritedGaitScores(breedId, sireGaitScores, damGaitScores, conformationScores)` — parentAvg * 0.6 + breedMean * 0.4 + conformationBonus
  - [x] 4.2 Handle cross-breed gaited inheritance: gaited gait availability depends on foal's breed only
  - [x] 4.3 Handle null/missing parent gait scores — fall back to breed-only generation
- [x] Task 5: Write unit tests for gaitService (AC: #1-#5, #8)
  - [x] 5.1 Test standard gait generation produces all 4 standard gaits + gaiting field
  - [x] 5.2 Test all scores are integers in [0, 100]
  - [x] 5.3 Test gaited breed generates named gaiting entries (American Saddlebred → ["Slow Gait", "Rack"])
  - [x] 5.4 Test non-gaited breed generates gaiting: null
  - [x] 5.5 Test conformation bonus calculation (avg regions - 70) * 0.15
  - [x] 5.6 Test conformation-to-gait mapping correctness
  - [x] 5.7 Test inherited gait generation with parent blending
  - [x] 5.8 Test cross-breed gaited inheritance (foal breed determines gaiting, not parents)
  - [x] 5.9 Test null parent fallback to breed-only
  - [x] 5.10 Test unknown breedId graceful degradation
- [x] Task 6: Statistical validation test (AC: #8)
  - [x] 6.1 Generate 1000 horses for Thoroughbred, verify gallop scores center around mean 90 (std_dev ~9)
  - [x] 6.2 95% within [mean - 18, mean + 18] (2 * std_dev = 18, but note conformationBonus shifts mean)
  - [x] 6.3 Verify conformation influence produces measurable correlation (r > 0.3) between relevant conformation regions and gait scores (NFR-05)

## Dev Notes

### CRITICAL: Prisma Migration Required

Unlike Epic 31B (which used an existing `conformationScores` field), **Epic 31C requires a new Prisma migration** to add `gaitScores` to the Horse model.

**Schema change** in `packages/database/prisma/schema.prisma`:

```prisma
  /// Conformation scoring (1-100 scale per body region)
  conformationScores      Json?                 @default("{\"head\": 20, \"neck\": 20, \"shoulders\": 20, \"back\": 20, \"legs\": 20, \"hooves\": 20, \"topline\": 20, \"hindquarters\": 20}")
  /// Gait quality scores (permanent, generated at birth)
  gaitScores              Json?
```

**Add the field right after `conformationScores` (line ~170 in schema.prisma).**

No default value — existing horses return `null` (backward compatible, NFR-06).

**Migration commands** (run from `packages/database/`):

```bash
npx prisma migrate dev --name add-gait-scores-field
npx prisma generate
DATABASE_URL=postgresql://...equoria_test npx prisma migrate deploy
```

**CAUTION:** On Windows, `prisma generate` may fail on the final DLL rename step (EPERM error). The JS/TS client is regenerated before that step — verify by checking that `packages/database/node_modules/.prisma/client/index.js` has a recent timestamp.

### gaitScores JSONB Shape

```json
{
  "walk": 72,
  "trot": 78,
  "canter": 75,
  "gallop": 85,
  "gaiting": [
    { "name": "Slow Gait", "score": 82 },
    { "name": "Rack", "score": 82 }
  ]
}
```

For non-gaited breeds:

```json
{
  "walk": 72,
  "trot": 78,
  "canter": 75,
  "gallop": 85,
  "gaiting": null
}
```

### Service Location and Import Pattern

**New file:** `backend/modules/horses/services/gaitService.mjs`

```javascript
// Import shared utilities from conformationService (do NOT duplicate)
import { normalRandom, clampScore } from './conformationService.mjs';
import { BREED_GENETIC_PROFILES } from '../data/breedGeneticProfiles.mjs';
import logger from '../../../utils/logger.mjs';
```

### Conformation-to-Gait Mapping

```javascript
const CONFORMATION_GAIT_MAPPING = {
  walk: ['shoulders', 'back'],
  trot: ['shoulders', 'hindquarters'],
  canter: ['back', 'hindquarters'],
  gallop: ['legs', 'hindquarters'],
  gaiting: ['legs', 'back', 'hindquarters'],
};
```

### Conformation Bonus Formula

```javascript
function calculateConformationBonus(conformationScores, gaitKey) {
  const regions = CONFORMATION_GAIT_MAPPING[gaitKey];
  const avg = regions.reduce((sum, r) => sum + (conformationScores[r] ?? 70), 0) / regions.length;
  return (avg - 70) * 0.15;
}
```

- If horse conformation average for mapped regions = 70 → bonus = 0
- If average = 80 → bonus = +1.5
- If average = 60 → bonus = -1.5
- Maximum realistic bonus: ~4.5 (scores near 100)

### Gaited Breed Registry

4 gaited breeds with their breed-specific gaits:
- **American Saddlebred (ID 3):** `["Slow Gait", "Rack"]` — gaiting mean: 85
- **National Show Horse (ID 4):** `["Slow Gait", "Rack"]` — gaiting mean: 80
- **Tennessee Walking Horse (ID 7):** `["Flat Walk", "Running Walk"]` — gaiting mean: 90
- **Walkaloosa (ID 10):** `["Indian Shuffle"]` — gaiting mean: 75

All other breeds (IDs 1, 2, 5, 6, 8, 9, 11, 12): `gaiting: null` in gait data, `is_gaited_breed: false`

### Horse Creation Integration Points

**Two paths where gait scores must be generated (same as conformation):**

1. **New horse creation:** `backend/modules/horses/routes/horseRoutes.mjs` — POST `/` handler (~line 451)
   - Conformation is generated first: `const conformationScores = generateConformationScores(req.body.breedId);`
   - Add gait generation immediately after: `const gaitScores = generateGaitScores(req.body.breedId, conformationScores);`
   - Add `gaitScores` to the `horseData` object (~line 455)

2. **Foal birth:** `backend/modules/horses/controllers/horseController.mjs` — `createFoal()` (~line 155-164)
   - Conformation is generated with inheritance logic already
   - Add gait generation after conformation: use `generateInheritedGaitScores()` if both parents have gait scores, else `generateGaitScores()`
   - Add `gaitScores` to the `horseData` object (~line 167)

### Breed Gait Data Access Pattern

```javascript
const profile = BREED_GENETIC_PROFILES[breedId];
const gaits = profile.rating_profiles.gaits;
// gaits.walk = { mean: 65, std_dev: 9 }
// gaits.gaiting = { mean: 85, std_dev: 9 } or null
const isGaited = profile.rating_profiles.is_gaited_breed;
const gaitedNames = profile.rating_profiles.gaited_gait_registry; // string[] or null
```

### Unknown Breed Fallback

If `BREED_GENETIC_PROFILES[breedId]` is undefined:
- Return all 4 standard gaits at score 50 each
- gaiting: null
- Log warning (same pattern as conformationService)

### Immutability Enforcement

FR-14 requires no mutation endpoints. Validated by existing `validateHorseUpdatePayload` allowedFields whitelist — `gaitScores` is NOT in the whitelist, so PUT /horses/:id already rejects it.

### Testing Strategy

**Unit tests (file: `backend/__tests__/gaitScoreGeneration.test.mjs`):**

- `generateGaitScores()` — structure, range, breed-specific means, gaited vs non-gaited
- `calculateConformationBonus()` — formula verification
- `generateInheritedGaitScores()` — parent blending, cross-breed gaiting
- Statistical: 1000+ samples for distribution verification
- Conformation correlation: generate 1000 horses, measure correlation between conformation and gait

**Mock setup:** Use `jest.unstable_mockModule()` for logger (NOT `jest.mock()`).

### Previous Story Intelligence (31B-1, 31B-2, 31B-3)

**Patterns established:**

- Import breed data from `backend/modules/horses/data/breedGeneticProfiles.mjs`
- Access pattern: `BREED_GENETIC_PROFILES[breedId].rating_profiles.gaits`
- `normalRandom()` and `clampScore()` are exported from `conformationService.mjs` — reuse directly
- All files use `.mjs` extension, `import/export` only
- Always use shared Prisma client: `import prisma from '../../../db/index.mjs'` (NOT direct @prisma/client)
- Test naming: descriptive kebab-case `.test.mjs`
- `jest.unstable_mockModule()` for mocking (NOT `jest.mock()`)

**Problems to avoid:**

- Do NOT import Prisma directly from node_modules — use `backend/db/index.mjs`
- Do NOT duplicate `normalRandom` or `clampScore` — import from `conformationService.mjs`
- Test DB must have latest migrations — after adding `gaitScores` field, run `DATABASE_URL=...equoria_test npx prisma migrate deploy`
- Flaky perf benchmarks may block pre-push hook — thresholds already relaxed

**Code review findings from 31B:**

- HIGH: Box-Muller `Math.log(0)` edge case — already fixed in `normalRandom`, no action needed
- Pattern: guard against NaN/Infinity in `clampScore` (already implemented)

### ES Module Requirements

- All files use `.mjs` extension
- `import/export` only — no `require/module.exports`
- Include `.mjs` in all import paths
- `jest.unstable_mockModule()` for mocking in tests (NOT `jest.mock()`)

### Security Patterns

- Rate limiting on new endpoints: `queryRateLimiter` for GET, `mutationRateLimiter` for POST
- `requireOwnership('horse')` middleware for horse-specific endpoints
- Input validation with `express-validator`
- Reject prototype pollution: `rejectPollutedRequest` middleware

### Project Structure Notes

**Existing module structure:**

```
backend/modules/horses/
├── controllers/
│   ├── breedController.mjs
│   ├── horseController.mjs
│   └── horseXpController.mjs
├── routes/
│   ├── breedRoutes.mjs
│   └── horseRoutes.mjs
├── data/
│   └── breedGeneticProfiles.mjs
├── services/
│   └── conformationService.mjs      ← existing (reuse normalRandom, clampScore)
└── tests/
```

**New files to create:**

1. `backend/modules/horses/services/gaitService.mjs` — core gait generation service
2. `backend/__tests__/gaitScoreGeneration.test.mjs` — unit + statistical tests

**Files to modify:**

1. `packages/database/prisma/schema.prisma` — add `gaitScores Json?` to Horse model
2. `backend/modules/horses/controllers/horseController.mjs` — hook gait generation into createFoal
3. `backend/modules/horses/routes/horseRoutes.mjs` — hook gait generation into POST /horses

### References

- [Source: docs/epics-physical-systems.md#Epic-31C] — Story 31C-1 acceptance criteria
- [Source: docs/epics-physical-systems.md#FR-10-FR-14] — Functional requirements
- [Source: docs/epics-physical-systems.md#NFR-01] — Normal distribution verification
- [Source: docs/epics-physical-systems.md#NFR-05] — Conformation correlation r > 0.3
- [Source: docs/epics-physical-systems.md#NFR-07] — Score clamping 0-100
- [Source: backend/modules/horses/data/breedGeneticProfiles.mjs] — Breed rating profiles (gaits + gaited_gait_registry)
- [Source: backend/modules/horses/services/conformationService.mjs] — normalRandom, clampScore to reuse
- [Source: packages/database/prisma/schema.prisma] — Horse model (line ~170, add gaitScores after conformationScores)
- [Source: backend/modules/horses/controllers/horseController.mjs] — createFoal() (line ~75)
- [Source: backend/modules/horses/routes/horseRoutes.mjs] — POST /horses (line ~451)
- [Source: _bmad-output/implementation-artifacts/31b-1-conformation-score-generation.md] — Previous story patterns
- [Source: _bmad-output/implementation-artifacts/epic-31b-retro-2026-03-26.md] — Retrospective learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — all tests passed on first full run after syntax fix.

### Completion Notes List

- Prisma migration `20260326205424_add_gait_scores_field` created and deployed to both dev and test databases
- `gaitService.mjs` created with 5 exports: STANDARD_GAITS, CONFORMATION_GAIT_MAPPING, calculateConformationBonus, generateGaitScores, generateInheritedGaitScores
- Reused `normalRandom` and `clampScore` from `conformationService.mjs` (zero duplication)
- Horse creation integration: POST /horses (horseRoutes) + createFoal (horseController) both generate gait scores after conformation
- Inherited gait generation uses 60/40 parent/breed blend with conformation bonus; cross-breed gaiting uses foal's breed only
- 50 unit + statistical tests all passing; Pearson correlation test validates conformation influence (r > 0.3)
- Full regression: 239 suites / 4066 tests (4049 passed, 17 skipped, 0 failures)
- Known Windows issue: `prisma generate` EPERM on DLL rename — JS/TS client regenerated successfully before failure

### File List

- `packages/database/prisma/schema.prisma` — Added `gaitScores Json?` field to Horse model
- `packages/database/prisma/migrations/20260326205424_add_gait_scores_field/migration.sql` — Auto-generated migration
- `backend/modules/horses/services/gaitService.mjs` — NEW: Core gait generation service
- `backend/modules/horses/routes/horseRoutes.mjs` — Modified: Added gait generation in POST /horses handler
- `backend/modules/horses/controllers/horseController.mjs` — Modified: Added inherited gait generation in createFoal()
- `backend/__tests__/gaitScoreGeneration.test.mjs` — NEW: 50 unit + statistical tests
