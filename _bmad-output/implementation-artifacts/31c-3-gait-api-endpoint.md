# Story 31C.3: Gait API Endpoint

Status: done

## Story

As a player,
I want to view my horse's gait quality scores including any breed-specific gaited gaits,
So that I can understand my horse's movement abilities.

## Acceptance Criteria

1. **Given** a horse exists with gait scores
   **When** `GET /api/v1/horses/:id/gaits` is called
   **Then** the response includes walk, trot, canter, gallop scores (0-100)
   **And** for gaited breeds: response includes `gaiting` array with `{ name, score }` entries (e.g., `[{ name: "Slow Gait", score: 85 }, { name: "Rack", score: 85 }]`)
   **And** for non-gaited breeds: `gaiting: null`

2. **Given** a legacy horse exists without gait scores (`gaitScores` is null)
   **When** `GET /api/v1/horses/:id/gaits` is called
   **Then** the response returns 200 with `data: null` and a descriptive message

3. **Given** any `GET /api/v1/horses/:id/gaits` request
   **When** the request is processed
   **Then** horse ownership is validated via `requireOwnership('horse')` middleware
   **And** rate limiting is applied via `queryRateLimiter`
   **And** horse ID is validated via `validateHorseId`

4. **Given** the endpoint is called with an invalid horse ID
   **When** the request is processed
   **Then** appropriate error response is returned (400 for invalid format, 404 for not found)

## Tasks / Subtasks

- [x] Task 1: Implement `getGaits` controller function (AC: #1, #2)
  - [x] 1.1 Add `getGaits` async function in `horseController.mjs` — reads `req.horse.gaitScores`
  - [x] 1.2 Handle null/missing gait scores (legacy horses) — return 200 with `data: null`
  - [x] 1.3 Return structured response: `{ success, message, data: { horseId, horseName, breedId, gaitScores } }`
  - [x] 1.4 Export `getGaits` from horseController
- [x] Task 2: Add route in `horseRoutes.mjs` (AC: #3, #4)
  - [x] 2.1 Add `GET /:id/gaits` route with `queryRateLimiter`, `validateHorseId`, `requireOwnership('horse')`
  - [x] 2.2 Import `getGaits` from horseController in the import block at top of file
  - [x] 2.3 Place route BEFORE the `GET /:id` catch-all route (same position as conformation routes)
- [x] Task 3: Write unit tests (AC: #1, #2, #3, #4)
  - [x] 3.1 Test returns all 4 standard gait scores + gaiting for a horse with gait scores
  - [x] 3.2 Test returns gaiting array with `{ name, score }` entries for gaited breed
  - [x] 3.3 Test returns `gaiting: null` for non-gaited breed
  - [x] 3.4 Test returns 200 with `data: null` for legacy horse without gait scores
  - [x] 3.5 Test returns 200 with `data: null` for horse with undefined gait scores
  - [x] 3.6 Test response includes horseId, horseName, breedId metadata
  - [x] 3.7 Test error handling (500 on internal error)
- [x] Task 4: Update Swagger documentation (AC: #1)
  - [x] 4.1 Add `GET /api/v1/horses/{id}/gaits` endpoint to `backend/docs/swagger.yaml`

## Dev Notes

### CRITICAL: Follow Conformation Endpoint Pattern Exactly

The gait endpoint mirrors `getConformation` in structure. Copy the pattern from `horseController.mjs:656-700`.

### Controller Implementation Pattern

```javascript
// In horseController.mjs — add after getConformationAnalysis function

/**
 * Get gait quality scores for a specific horse.
 * Returns walk, trot, canter, gallop scores + gaiting entries for gaited breeds.
 * Horse is pre-attached to req.horse by requireOwnership middleware.
 */
export async function getGaits(req, res) {
  try {
    const horse = req.horse;
    const gaitScores = horse.gaitScores;

    // Legacy horse without gait scores
    if (!gaitScores) {
      return res.status(200).json({
        success: true,
        message: 'No gait scores available for this horse',
        data: null,
      });
    }

    logger.info(
      `[horseController.getGaits] Retrieved gait scores for horse ${horse.id}`,
    );

    res.status(200).json({
      success: true,
      message: 'Gait scores retrieved successfully',
      data: {
        horseId: horse.id,
        horseName: horse.name,
        breedId: horse.breedId,
        gaitScores,
      },
    });
  } catch (error) {
    logger.error(`[horseController.getGaits] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving gait scores',
      data: null,
    });
  }
}
```

### Route Registration Pattern

```javascript
// In horseRoutes.mjs — add import at top
import {
  getHorseOverview,
  getHorsePersonalityImpact,
  getConformation,
  getConformationAnalysis,
  getGaits,  // ADD THIS
} from '../controllers/horseController.mjs';

// Add route BEFORE the GET /:id catch-all (after conformation routes, ~line 403)
/**
 * GET /horses/:id/gaits
 * Get gait quality scores for a specific horse
 */
router.get(
  '/:id/gaits',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getGaits(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);
```

**CRITICAL PLACEMENT:** The `/:id/gaits` route MUST be placed BEFORE `/:id` (the generic horse detail route at ~line 405). Express matches routes in order — if `/:id` comes first, it will catch `/123/gaits` as `id = "123"` with path `/gaits` being unmatched. Place it right after the conformation routes.

### Test File Pattern

Follow `conformationApiEndpoints.test.mjs` exactly:

```javascript
// File: backend/__tests__/gaitApiEndpoint.test.mjs

import { jest } from '@jest/globals';

// Mock prisma and logger BEFORE importing controller
jest.unstable_mockModule('../db/index.mjs', () => ({ default: { horse: { findMany: jest.fn(), findUnique: jest.fn() } } }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

// Import AFTER mocking
const { getGaits } = await import('../modules/horses/controllers/horseController.mjs');

// Helper: create mock req/res
function createMockReqRes(horseOverrides = {}) {
  const horse = {
    id: 123,
    name: 'Midnight Star',
    breedId: 1,
    gaitScores: {
      walk: 72, trot: 78, canter: 75, gallop: 85,
      gaiting: null,
    },
    ...horseOverrides,
  };
  const req = { horse, params: { id: String(horse.id) } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return { req, res, horse };
}
```

### gaitScores JSONB Shape Reference

Non-gaited breed:
```json
{ "walk": 72, "trot": 78, "canter": 75, "gallop": 85, "gaiting": null }
```

Gaited breed (American Saddlebred):
```json
{
  "walk": 72, "trot": 78, "canter": 75, "gallop": 85,
  "gaiting": [
    { "name": "Slow Gait", "score": 82 },
    { "name": "Rack", "score": 82 }
  ]
}
```

### Previous Story Intelligence (31C-1)

**Patterns established:**
- `gaitService.mjs` already exports `STANDARD_GAITS` and `CONFORMATION_GAIT_MAPPING` (not needed by this endpoint — it just reads stored JSONB)
- The endpoint does NOT need to import gaitService — gait scores are pre-stored on the Horse model
- `jest.unstable_mockModule()` for mocking (NOT `jest.mock()`) — ESM requirement
- Direct import pattern after mocking: `const { fn } = await import('...')`
- `clampScore` handles NaN with fallback to 50 — gaitScores in DB are always valid integers

**Problems avoided:**
- `jest.fn is not a function` — must import `{ jest }` from `@jest/globals` in ESM
- Route ordering — parameterized routes must come AFTER specific sub-routes

### Swagger Documentation Pattern

Add to `backend/docs/swagger.yaml` under paths, following the conformation endpoint pattern:

```yaml
  /api/v1/horses/{id}/gaits:
    get:
      summary: Get gait quality scores for a horse
      tags:
        - Horses
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: integer
          description: Horse ID
      responses:
        '200':
          description: Gait scores retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  data:
                    type: object
                    nullable: true
                    properties:
                      horseId:
                        type: integer
                      horseName:
                        type: string
                      breedId:
                        type: integer
                      gaitScores:
                        type: object
                        properties:
                          walk:
                            type: integer
                          trot:
                            type: integer
                          canter:
                            type: integer
                          gallop:
                            type: integer
                          gaiting:
                            nullable: true
                            type: array
                            items:
                              type: object
                              properties:
                                name:
                                  type: string
                                score:
                                  type: integer
        '401':
          description: Unauthorized
        '403':
          description: Not horse owner
        '404':
          description: Horse not found
```

### ES Module Requirements

- All files use `.mjs` extension
- `import/export` only — no `require/module.exports`
- Include `.mjs` in all import paths
- `jest.unstable_mockModule()` for mocking in tests (NOT `jest.mock()`)

### Security Patterns

- `queryRateLimiter` on GET endpoints
- `requireOwnership('horse')` validates horse belongs to authenticated user
- `validateHorseId` validates param format
- No user input reaches gait data — read-only endpoint

### Project Structure Notes

**Existing module structure:**

```
backend/modules/horses/
├── controllers/
│   ├── horseController.mjs      ← ADD getGaits here (after getConformationAnalysis)
│   └── ...
├── routes/
│   └── horseRoutes.mjs          ← ADD GET /:id/gaits route (before GET /:id)
└── services/
    ├── conformationService.mjs
    └── gaitService.mjs          ← NOT needed by this endpoint
```

**New files to create:**

1. `backend/__tests__/gaitApiEndpoint.test.mjs` — unit tests

**Files to modify:**

1. `backend/modules/horses/controllers/horseController.mjs` — add `getGaits` function
2. `backend/modules/horses/routes/horseRoutes.mjs` — add route + import
3. `backend/docs/swagger.yaml` — add endpoint documentation

### References

- [Source: docs/epics-physical-systems.md#Story-31C-3] — Story acceptance criteria
- [Source: docs/epics-physical-systems.md#FR-17] — GET /api/v1/horses/:id/gaits requirement
- [Source: backend/modules/horses/controllers/horseController.mjs:656-700] — getConformation pattern to follow
- [Source: backend/modules/horses/routes/horseRoutes.mjs:363-403] — Conformation route pattern
- [Source: backend/__tests__/conformationApiEndpoints.test.mjs] — Test file pattern with mock setup
- [Source: _bmad-output/implementation-artifacts/31c-1-gait-score-generation.md] — Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — all tests passed on first run.

### Completion Notes List

- All 4 tasks completed: controller, route, tests (7/7 pass), Swagger docs
- Follows conformation endpoint pattern exactly (controller structure, route middleware, test mock setup)
- Route placed BEFORE `GET /:id` catch-all to prevent Express route shadowing
- Pre-existing failures in `nextActionsController.test.mjs` (5 tests) unrelated to gait changes — cooldown/competition logic
- Full regression: 238 suites passed, 4049 tests passed, 0 regressions introduced

### File List

- `backend/modules/horses/controllers/horseController.mjs` — Added `getGaits` export function
- `backend/modules/horses/routes/horseRoutes.mjs` — Added `getGaits` import + `GET /:id/gaits` route
- `backend/__tests__/gaitApiEndpoint.test.mjs` — New file, 7 unit tests
- `backend/docs/swagger.yaml` — Added `GET /api/v1/horses/{id}/gaits` endpoint documentation
