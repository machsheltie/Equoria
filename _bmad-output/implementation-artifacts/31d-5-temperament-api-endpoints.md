# Story 31D.5: Temperament Definitions Endpoint

Status: review

## Story

As a player,
I want to see all temperament types with their descriptions and game effects,
So that I understand how temperament affects my horse's performance.

## Acceptance Criteria

1. **Given** the system has 11 temperament types defined
   **When** `GET /api/v1/horses/temperament-definitions` is called
   **Then** the response includes all 11 types, each with: name, description, prevalence note, training modifiers (xpModifier%, scoreModifier%), competition modifiers (riddenModifier%, conformationModifier%), and best groom personality matches
   **And** response time is <200ms
   **And** response is HTTP 200 with `success: true`

2. **Given** the endpoint is called
   **When** the request is processed
   **Then** `data.count` equals 11
   **And** `data.definitions` is an array of 11 objects in TEMPERAMENT_TYPES order

3. **Given** the endpoint is called
   **When** training modifier data is returned
   **Then** `Spirited` returns `xpModifier: 0.1, scoreModifier: 0.05`
   **And** `Lazy` returns `xpModifier: -0.2, scoreModifier: -0.15`
   **And** all 11 values exactly match `TEMPERAMENT_TRAINING_MODIFIERS` in temperamentService.mjs

4. **Given** the endpoint is called
   **When** competition modifier data is returned
   **Then** `Bold` returns `riddenModifier: 0.05, conformationModifier: 0.02`
   **And** `Nervous` returns `riddenModifier: -0.05, conformationModifier: -0.05`
   **And** all 11 values exactly match `TEMPERAMENT_COMPETITION_MODIFIERS` in temperamentService.mjs

5. **Given** the endpoint is called
   **When** groom personality data is returned
   **Then** `Nervous` returns `bestGroomPersonalities: ["patient", "gentle"]` (strict is negative — excluded)
   **And** `Calm` returns `bestGroomPersonalities: ["gentle", "energetic", "patient", "strict"]` (universal `_any` = all personalities)
   **And** `Steady` returns `bestGroomPersonalities: ["gentle", "energetic", "patient", "strict"]` (universal `_any`)
   **And** `Spirited` returns `bestGroomPersonalities: ["energetic"]`
   **And** temperaments with no positive synergy (e.g., none that only have negative) return `bestGroomPersonalities: []`

6. **Given** rate limiting is applied
   **When** the request is processed
   **Then** `queryRateLimiter` middleware is applied
   **And** NO authentication is required (public definitions endpoint — static game data)

## Tasks / Subtasks

- [x] Task 1: Add `getTemperamentDefinitions` to `horseController.mjs` (AC: #1, #2, #3, #4, #5)

  - [x] 1.1 Import `TEMPERAMENT_TYPES`, `TEMPERAMENT_TRAINING_MODIFIERS`, `TEMPERAMENT_COMPETITION_MODIFIERS`, `TEMPERAMENT_GROOM_SYNERGY` from `../services/temperamentService.mjs` at the top of `horseController.mjs`
  - [x] 1.2 Create `TEMPERAMENT_DESCRIPTIONS` constant (inline in the function or at module scope) mapping each of the 11 temperament names to `{ description: string, prevalenceNote: string }`
  - [x] 1.3 Implement `getTemperamentDefinitions(req, res)` — iterates `TEMPERAMENT_TYPES`, assembles definition for each from the 4 constants, returns 200 with `{ success, message, data: { count: 11, definitions: [...] } }`
  - [x] 1.4 For `bestGroomPersonalities`: filter `TEMPERAMENT_GROOM_SYNERGY[name]` entries with value > 0; if the map contains `_any` key, return all 4 canonical personalities (`['gentle', 'energetic', 'patient', 'strict']`)
  - [x] 1.5 Export `getTemperamentDefinitions` from horseController.mjs

- [x] Task 2: Add route in `horseRoutes.mjs` (AC: #6)

  - [x] 2.1 Add `getTemperamentDefinitions` to the existing import from `../controllers/horseController.mjs` (line 4-10)
  - [x] 2.2 Add `GET /temperament-definitions` route with `queryRateLimiter` only (no auth middleware)
  - [x] 2.3 Place route BEFORE the `GET /:id/conformation` route (before line 365) — CRITICAL for Express route matching

- [x] Task 3: Write unit tests (AC: #1–#6)

  - [x] 3.1 Test returns 200 with `success: true` and all 11 definitions
  - [x] 3.2 Test `data.count` equals 11
  - [x] 3.3 Test each definition has all required fields: `name`, `description`, `prevalenceNote`, `trainingModifiers`, `competitionModifiers`, `bestGroomPersonalities`
  - [x] 3.4 Test Spirited training modifiers: `xpModifier: 0.1, scoreModifier: 0.05`
  - [x] 3.5 Test Lazy training modifiers: `xpModifier: -0.2, scoreModifier: -0.15`
  - [x] 3.6 Test Bold competition modifiers: `riddenModifier: 0.05, conformationModifier: 0.02`
  - [x] 3.7 Test Nervous competition modifiers: `riddenModifier: -0.05, conformationModifier: -0.05`
  - [x] 3.8 Test Spirited best groom personalities: `["energetic"]`
  - [x] 3.9 Test Nervous best groom personalities: `["patient", "gentle"]` (strict excluded — it's -0.15)
  - [x] 3.10 Test Calm best groom personalities: all 4 `["gentle", "energetic", "patient", "strict"]` (universal `_any`)
  - [x] 3.11 Test Steady best groom personalities: all 4 (universal `_any`)
  - [x] 3.12 Test definitions order matches `TEMPERAMENT_TYPES` array order

- [x] Task 4: Update Swagger documentation (AC: #1)
  - [x] 4.1 Add `GET /api/v1/horses/temperament-definitions` endpoint to `backend/docs/swagger.yaml`

## Dev Notes

### CRITICAL: Route Placement in Express

`/horses/temperament-definitions` is a **static path** (no `:id` parameter). In `horseRoutes.mjs`, it MUST be placed BEFORE any `/:id` routes. Express matches routes in order — if `/:id` comes first, it will treat `temperament-definitions` as `id = "temperament-definitions"`.

**Current route order** (horseRoutes.mjs):

- Line 240: `GET /` — list horses (auth required)
- Line 310: `GET /trait-trends` — static path (auth required)
- **→ INSERT HERE (after /trait-trends, before the /:id/\* routes)**
- Line 365: `GET /:id/conformation`
- Line 389: `GET /:id/conformation/analysis`
- Line 413: `GET /:id/gaits`
- Line 437: `GET /:id` — catch-all

Place the new route between line 357 and line 359 (after the `/trait-trends` block ends).

### Endpoint: GET /horses/temperament-definitions

**Response shape (FR-23):**

```javascript
{
  success: true,
  message: 'Temperament definitions retrieved successfully',
  data: {
    count: 11,
    definitions: [
      {
        name: 'Spirited',
        description: 'High-energy and excitable. Responds well to stimulation and performs impressively when engaged.',
        prevalenceNote: 'Common in hot-blooded racing and performance breeds',
        trainingModifiers: {
          xpModifier: 0.1,       // +10% XP gain
          scoreModifier: 0.05    // +5% discipline score gain
        },
        competitionModifiers: {
          riddenModifier: 0.03,        // +3% ridden competition score
          conformationModifier: -0.02  // -2% conformation show score
        },
        bestGroomPersonalities: ['energetic']
      },
      // ... 10 more
    ]
  }
}
```

### Authentication Decision: NO AUTH REQUIRED

This endpoint returns static game definitions — the same data for every player. It does NOT return any user-specific or horse-specific data. Pattern follows `GET /api/traits/definitions` (traitRoutes.mjs line 235-245) which also has no `authenticateToken` middleware.

Apply only `queryRateLimiter` (100 req/15min per IP).

### TEMPERAMENT_DESCRIPTIONS Inline Constant

Add this constant inside the `getTemperamentDefinitions` function body (or at module scope as a frozen const above it):

```javascript
const TEMPERAMENT_DESCRIPTIONS = Object.freeze({
  Spirited: {
    description:
      'High-energy and excitable. Responds well to stimulation and performs impressively when engaged.',
    prevalenceNote: 'Common in hot-blooded racing and performance breeds',
  },
  Nervous: {
    description:
      'Easily startled and prone to anxiety. Requires calm, patient handling to reach full potential.',
    prevalenceNote: 'More common in sensitive light horse breeds',
  },
  Calm: {
    description:
      'Easygoing and unflappable. Performs consistently under pressure with minimal coaching.',
    prevalenceNote: 'Common in draft and stock horse breeds',
  },
  Bold: {
    description:
      'Confident and courageous. Takes on challenges without hesitation and excels in ridden competition.',
    prevalenceNote: 'Common in sport and jumping breeds',
  },
  Steady: {
    description:
      'Reliable and predictable. Rarely has exceptional or poor days — always performs as expected.',
    prevalenceNote: 'Well-distributed across working and sport horse breeds',
  },
  Independent: {
    description:
      "Self-reliant and strong-willed. Doesn't always respond to rider cues, but thinks for itself.",
    prevalenceNote: 'More common in gaited and semi-feral lineage breeds',
  },
  Reactive: {
    description:
      'Highly attuned to the environment. Quick to respond but easily distracted during training.',
    prevalenceNote: 'Common in Arabians and sensitive hot-blood breeds',
  },
  Stubborn: {
    description:
      'Willful and resistant to direction. Training progress is slow but gains are permanent once made.',
    prevalenceNote: 'More common in pony and mule-influenced breeds',
  },
  Playful: {
    description:
      'Enthusiastic and spirited, but struggles to maintain focus during structured training.',
    prevalenceNote: 'Common in younger-spirited light horse breeds',
  },
  Lazy: {
    description:
      'Low energy and unmotivated. Requires consistent encouragement but is easy to handle.',
    prevalenceNote: 'Common in easy-keeping draft and pony breeds',
  },
  Aggressive: {
    description:
      'Dominant and combative. Challenging to manage but can excel competitively with the right handler.',
    prevalenceNote: 'Rare; more common in stallions and certain warmbloods',
  },
});
```

### Controller Implementation Pattern

```javascript
/**
 * Get all temperament type definitions with training/competition modifiers and groom synergy.
 * Returns static game data — no DB query, no auth required.
 * All data sourced from temperamentService constants.
 */
export async function getTemperamentDefinitions(req, res) {
  try {
    const CANONICAL_PERSONALITIES = ['gentle', 'energetic', 'patient', 'strict'];

    const definitions = TEMPERAMENT_TYPES.map((name) => {
      const desc = TEMPERAMENT_DESCRIPTIONS[name] ?? {
        description: name,
        prevalenceNote: '',
      };
      const trainingMods = TEMPERAMENT_TRAINING_MODIFIERS[name];
      const competitionMods = TEMPERAMENT_COMPETITION_MODIFIERS[name];
      const synergyMap = TEMPERAMENT_GROOM_SYNERGY[name] ?? {};

      let bestGroomPersonalities;
      if ('_any' in synergyMap) {
        bestGroomPersonalities = CANONICAL_PERSONALITIES;
      } else {
        bestGroomPersonalities = Object.entries(synergyMap)
          .filter(([, v]) => v > 0)
          .map(([k]) => k);
      }

      return {
        name,
        description: desc.description,
        prevalenceNote: desc.prevalenceNote,
        trainingModifiers: {
          xpModifier: trainingMods.xpModifier,
          scoreModifier: trainingMods.scoreModifier,
        },
        competitionModifiers: {
          riddenModifier: competitionMods.riddenModifier,
          conformationModifier: competitionMods.conformationModifier,
        },
        bestGroomPersonalities,
      };
    });

    logger.info('[horseController.getTemperamentDefinitions] Returned 11 temperament definitions');

    res.status(200).json({
      success: true,
      message: 'Temperament definitions retrieved successfully',
      data: {
        count: definitions.length,
        definitions,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getTemperamentDefinitions] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving temperament definitions',
      data: null,
    });
  }
}
```

### Route Registration Pattern

```javascript
// In horseRoutes.mjs — add to existing import (lines 4-10):
import {
  getHorseOverview,
  getHorsePersonalityImpact,
  getConformation,
  getConformationAnalysis,
  getGaits,
  getTemperamentDefinitions, // ADD THIS
} from '../controllers/horseController.mjs';

// Add route AFTER /trait-trends block (line 357) and BEFORE /:id/conformation (line 365):
/**
 * GET /horses/temperament-definitions
 * Get all temperament type definitions with modifiers and groom synergy
 * Public endpoint — no auth required (static game data)
 */
router.get('/temperament-definitions', queryRateLimiter, async (req, res) => {
  try {
    await getTemperamentDefinitions(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});
```

### Controller Import: Add to Existing `temperamentService` Import

`horseRoutes.mjs` already imports `generateTemperament` from `temperamentService.mjs` (line 22). The controller `horseController.mjs` will need its own import of the 4 constants — add at the top of `horseController.mjs`:

```javascript
import {
  TEMPERAMENT_TYPES,
  TEMPERAMENT_TRAINING_MODIFIERS,
  TEMPERAMENT_COMPETITION_MODIFIERS,
  TEMPERAMENT_GROOM_SYNERGY,
} from '../services/temperamentService.mjs';
```

**Do NOT add these to `horseRoutes.mjs`** — they belong in the controller, not the route file.

### No Prisma Query Needed

`getTemperamentDefinitions` is **pure in-memory** — it only reads JS constants. No DB call. No `async/await` on Prisma. This makes it extremely fast (<5ms expected, well under 200ms NFR-02).

The function is still declared `async` for consistency with the existing controller export pattern, but no `await` expressions are needed.

### Test File Pattern

Follow `gaitApiEndpoint.test.mjs` (7 tests) pattern exactly:

```javascript
// File: backend/__tests__/temperamentApiEndpoints.test.mjs

import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// Must mock BEFORE any await import()
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// No Prisma mock needed — this function does no DB queries

const { getTemperamentDefinitions } = await import(
  '../modules/horses/controllers/horseController.mjs'
);

function createMockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('getTemperamentDefinitions', () => {
  it('returns 200 with 11 definitions', async () => {
    const req = {};
    const res = createMockRes();
    await getTemperamentDefinitions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(11);
    expect(payload.data.definitions).toHaveLength(11);
  });
  // ... etc.
});
```

**Key test: no Prisma mock needed.** The function only reads module-level constants.

### All 11 Modifier Values (Developer Reference)

| Temperament | xpMod | scoreMod | riddenMod | conformMod | bestGrooms        |
| ----------- | ----- | -------- | --------- | ---------- | ----------------- |
| Spirited    | +0.10 | +0.05    | +0.03     | -0.02      | energetic         |
| Nervous     | -0.10 | -0.05    | -0.05     | -0.05      | patient, gentle   |
| Calm        | +0.05 | +0.10    | +0.02     | +0.05      | all 4 (universal) |
| Bold        | +0.05 | +0.05    | +0.05     | +0.02      | energetic, strict |
| Steady      | +0.05 | +0.10    | +0.03     | +0.03      | all 4 (universal) |
| Independent | -0.05 | 0        | -0.02     | -0.03      | patient           |
| Reactive    | 0     | -0.05    | -0.03     | -0.04      | patient, gentle   |
| Stubborn    | -0.15 | -0.10    | -0.04     | -0.03      | strict            |
| Playful     | +0.05 | -0.05    | +0.01     | -0.01      | energetic         |
| Lazy        | -0.20 | -0.15    | -0.05     | 0          | energetic, strict |
| Aggressive  | -0.10 | -0.05    | -0.03     | -0.05      | strict, patient   |

**Note:** `bestGroomPersonalities` is derived only from **positive** synergy modifiers. `Nervous + strict = -0.15` → `strict` is NOT in Nervous's best grooms list.

### Swagger Documentation Pattern

Add to `backend/docs/swagger.yaml` under `/paths`, following the gait endpoint as a model:

```yaml
/api/v1/horses/temperament-definitions:
  get:
    summary: Get all temperament type definitions with game effects
    tags:
      - Horses
    description: Returns all 11 temperament types with descriptions, training modifiers, competition modifiers, and best groom personality matches. Public endpoint — no authentication required.
    responses:
      '200':
        description: Temperament definitions retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                message:
                  type: string
                  example: Temperament definitions retrieved successfully
                data:
                  type: object
                  properties:
                    count:
                      type: integer
                      example: 11
                    definitions:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                            example: Spirited
                          description:
                            type: string
                          prevalenceNote:
                            type: string
                          trainingModifiers:
                            type: object
                            properties:
                              xpModifier:
                                type: number
                                example: 0.1
                              scoreModifier:
                                type: number
                                example: 0.05
                          competitionModifiers:
                            type: object
                            properties:
                              riddenModifier:
                                type: number
                                example: 0.03
                              conformationModifier:
                                type: number
                                example: -0.02
                          bestGroomPersonalities:
                            type: array
                            items:
                              type: string
                            example: ['energetic']
      '500':
        description: Internal server error
```

### Files to Create

| File                                                 | Purpose                                 |
| ---------------------------------------------------- | --------------------------------------- |
| `backend/__tests__/temperamentApiEndpoints.test.mjs` | Unit tests for the definitions endpoint |

### Files to Modify

| File                                                     | Change                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `backend/modules/horses/controllers/horseController.mjs` | Add 4 imports from temperamentService + `TEMPERAMENT_DESCRIPTIONS` constant + `getTemperamentDefinitions()` export |
| `backend/modules/horses/routes/horseRoutes.mjs`          | Add `getTemperamentDefinitions` to import; add `GET /temperament-definitions` route before `/:id/conformation`     |
| `backend/docs/swagger.yaml`                              | Add `GET /api/v1/horses/temperament-definitions` endpoint                                                          |

### Files NOT to Modify

| File                                                     | Reason                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `backend/modules/horses/services/temperamentService.mjs` | All constants are already correct — do NOT add descriptions here (they belong in the controller layer) |
| `backend/modules/horses/data/breedGeneticProfiles.mjs`   | No changes to data layer                                                                               |
| `backend/constants/schema.mjs`                           | `GROOM_PERSONALITIES` already canonical                                                                |
| Any other routes file                                    | Only `horseRoutes.mjs` for this story                                                                  |

### Project Structure Notes

- All files use `.mjs` extension, ES modules only (`import/export`)
- All import paths include `.mjs` extension
- Shared Prisma client: `import prisma from '../../../db/index.mjs'` (NOT used in this story — no DB query)
- `jest.unstable_mockModule()` for mocking in tests (NOT `jest.mock()`)
- `jest.unstable_mockModule()` MUST be called BEFORE any `await import()` — non-negotiable ESM constraint

### Run Tests

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js temperamentApiEndpoints --no-coverage
```

### Previous Story Intelligence (31D-4 + 31C-3)

- `jest.unstable_mockModule()` must be called BEFORE any `await import()` — non-negotiable
- All mock variables must be declared BEFORE `jest.unstable_mockModule()` calls
- This story has NO Prisma calls — simplest test setup in the 31D series
- ESLint: use `_` prefix for unused destructured vars in `.map()` callbacks
- Route ordering is Express-critical: static paths BEFORE parameterized `/:id` paths
- Pattern for no-auth endpoints: `router.get('/path', queryRateLimiter, async (req, res) => {...})`
- Previous test counts: 37 (31D-4), 30 (31D-3), 31 (31D-2) — expect ~12-15 tests here
- Existing regression baseline: 159 temperament tests + 43 groomBondingSystem tests must not break
- `getGaits` (31C-3) is the closest pattern — follow it for controller function structure

### References

- [Source: docs/epics-physical-systems.md — Epic 31D, Story 31D-5]
- [Source: docs/epics-physical-systems.md#FR-23] — `GET /api/v1/horses/temperament-definitions` requirement
- [Source: backend/modules/horses/services/temperamentService.mjs] — All 4 constants to read
- [Source: backend/modules/horses/data/breedGeneticProfiles.mjs:104] — `TEMPERAMENT_TYPES` array (11 types, canonical order)
- [Source: backend/modules/horses/controllers/horseController.mjs:854] — `getGaits` pattern to follow
- [Source: backend/modules/horses/routes/horseRoutes.mjs:1-24] — Imports + route ordering
- [Source: backend/modules/horses/routes/horseRoutes.mjs:413-429] — `GET /:id/gaits` route pattern
- [Source: backend/modules/traits/routes/traitRoutes.mjs:235-245] — `GET /definitions` (no-auth pattern)
- [Source: backend/__tests__/gaitApiEndpoint.test.mjs] — Test file structure to follow
- [Source: _bmad-output/implementation-artifacts/31d-4-temperament-groom-synergy.md] — Previous story patterns
- [Source: _bmad-output/implementation-artifacts/31c-3-gait-api-endpoint.md] — Most similar story (definitions endpoint via controller)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Duplicate `breedGeneticProfiles.mjs` import resolved by merging `TEMPERAMENT_TYPES` into existing `{ BREED_GENETIC_PROFILES, CANONICAL_BREEDS }` import line
- `TEMPERAMENT_DESCRIPTIONS` placed as frozen module-scope constant above `getTemperamentDefinitions` (controller layer, not service layer per story spec)
- Route inserted between `/trait-trends` block (line 357) and `/:id/conformation` (line 365) — Express static-before-parametric order respected
- swagger.yaml auto-reformatted by project linter to single-line format; content preserved correctly

### Completion Notes List

- Task 1: Added 4 constants from temperamentService + TEMPERAMENT_TYPES from breedGeneticProfiles to horseController.mjs imports; added TEMPERAMENT_DESCRIPTIONS frozen const + getTemperamentDefinitions() export — pure in-memory function, no Prisma calls
- Task 2: Added getTemperamentDefinitions to horseRoutes.mjs import; GET /temperament-definitions route added with queryRateLimiter only (no auth), correctly placed before /:id/conformation
- Task 3: 13 tests written in backend/**tests**/temperamentApiEndpoints.test.mjs — all pass (no Prisma mock needed)
- Task 4: swagger.yaml updated with full GET /api/v1/horses/temperament-definitions spec including response schema
- Regression: 57/57 tests pass across temperamentApiEndpoints, conformationApiEndpoints, gaitApiEndpoint, temperamentAssignment suites

### File List

- `backend/__tests__/temperamentApiEndpoints.test.mjs` (created)
- `backend/modules/horses/controllers/horseController.mjs` (modified — imports + TEMPERAMENT_DESCRIPTIONS + getTemperamentDefinitions)
- `backend/modules/horses/routes/horseRoutes.mjs` (modified — import + GET /temperament-definitions route)
- `backend/docs/swagger.yaml` (modified — GET /api/v1/horses/temperament-definitions endpoint)

## Change Log

- 2026-03-30: Implemented GET /api/v1/horses/temperament-definitions endpoint — getTemperamentDefinitions controller function, route registration, 13 unit tests, Swagger documentation (Story 31D-5)
