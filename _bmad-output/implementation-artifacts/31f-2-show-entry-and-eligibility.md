# Story 31F.2: Show Entry and Eligibility

Status: done

## Story

As a developer,
I want HTTP endpoints to register a horse entry into a conformation show and check eligibility,
So that players can enter conformation shows through the game API with clear feedback on any blocking issues.

## Acceptance Criteria

**AC1 — POST /api/v1/competition/conformation/enter:**

Given an authenticated user sends `{ horseId, groomId, showId, className }`,
When `POST /api/v1/competition/conformation/enter` is called,
Then the request is validated using `validateConformationEntry` from `conformationShowService.mjs`,
And if any validation fails, the response is HTTP 400 with `{ success: false, errors: [...] }`,
And if the horse is already entered in the show, the response is HTTP 409 with a duplicate-entry error,
And if the show does not exist or `show.showType !== 'conformation'`, the response is HTTP 400 with a descriptive error,
And if all checks pass, a `ShowEntry` record is created (`showId, horseId, userId, feePaid: 0`),
And the response is HTTP 201 with `{ success: true, data: { entryId, horseId, showId, ageClass, className, warnings } }`.

**AC2 — GET /api/v1/competition/conformation/eligibility/:horseId:**

Given an authenticated user calls `GET /api/v1/competition/conformation/eligibility/:horseId`,
When the endpoint is called,
Then the horse is loaded from the DB (ownership verified — user must own the horse),
And the horse's active groom assignment is fetched via `prisma.groomAssignment.findFirst`,
And `validateConformationEntry` is called with the horse, active groom (or null if none), a placeholder class, and userId,
And the response is HTTP 200 with `{ success: true, data: { horseId, horseName, eligible, errors, warnings, ageClass, groomAssigned } }`,
Where `groomAssigned` is `true` if an active assignment exists, `false` otherwise.

**AC3 — conformation show type guard:**

Given a show exists in the DB,
When `POST /api/v1/competition/conformation/enter` is called with that show's ID,
Then if `show.showType !== 'conformation'`, the entry is rejected with HTTP 400 (`'Show is not a conformation show'`).

**AC4 — Auth and ownership:**

Given an unauthenticated request,
When either endpoint is called,
Then HTTP 401 is returned (enforced by `authRouter` middleware — no extra guard needed in controller).

Given an authenticated user does not own the horse,
When POST enter or GET eligibility is called with that horseId,
Then HTTP 404 is returned (ownership disclosed as "not found" per IDOR security pattern).

**AC5 — Integration tests:**

Given the service layer functions from 31F-1 are complete,
When tests run,
Then POST enter with a valid request returns 201 with entry data,
And POST enter with an ineligible horse (no groom, bad health, wrong show type) returns 400 with reasons,
And POST enter for a duplicate entry returns 409,
And GET eligibility for an eligible horse returns `{ eligible: true }`,
And GET eligibility for a horse with no groom returns `{ eligible: false, groomAssigned: false }`.

## Tasks / Subtasks

- [x] Task 1: Create `backend/modules/competition/controllers/conformationShowController.mjs`
  - [x] 1.1 Implement `enterConformationShow(req, res)`:
    - Validate `horseId, groomId, showId, className` from `req.body` (all required)
    - Verify horse ownership via `findOwnedResource('horse', horseId, userId)` (returns 404 on fail)
    - Verify groom ownership via `prisma.groom.findFirst({ where: { id: groomId, userId } })` (returns 400 if not owned)
    - Load show via `prisma.show.findUnique({ where: { id: showId } })` — return 404 if missing
    - Guard: `show.showType !== 'conformation'` → return 400
    - Guard: duplicate entry via `prisma.showEntry.findFirst({ where: { showId, horseId } })` → 409
    - Call `validateConformationEntry(horse, groom, className, userId)` from `conformationShowService.mjs`
    - If `!result.valid` → return 400 with `{ success: false, errors: result.errors, warnings: result.warnings }`
    - Create `ShowEntry`: `prisma.showEntry.create({ data: { showId, horseId, userId, feePaid: 0 } })`
    - Return 201 with `{ success: true, data: { entryId: entry.id, horseId, showId, ageClass: result.ageClass, className, warnings: result.warnings } }`

  - [x] 1.2 Implement `checkConformationEligibility(req, res)`:
    - Parse `horseId` from `req.params.horseId` (integer)
    - Verify ownership via `findOwnedResource('horse', horseId, userId)` → 404 on fail
    - Fetch active groom assignment: `prisma.groomAssignment.findFirst({ where: { foalId: horseId, userId, isActive: true } })`
    - If assignment exists, fetch groom: `prisma.groom.findUnique({ where: { id: assignment.groomId } })`
    - Call `validateConformationEntry(horse, groom ?? null, 'Mares', userId)` — use placeholder class; eligibility check doesn't need real class
    - Return 200 with `{ success: true, data: { horseId, horseName: horse.name, eligible: result.valid, errors: result.errors, warnings: result.warnings, ageClass: result.ageClass, groomAssigned: !!assignment } }`

- [x] Task 2: Create `backend/modules/competition/routes/conformationShowRoutes.mjs`
  - [x] 2.1 Import controller functions and rate limiters
  - [x] 2.2 Add express-validator middleware for POST `/enter` (body: horseId, groomId, showId, className)
  - [x] 2.3 Add express-validator for GET `/eligibility/:horseId` (param: positive integer)
  - [x] 2.4 Mount: `router.post('/enter', mutationRateLimiter, validateEnterBody, enterConformationShow)`
  - [x] 2.5 Mount: `router.get('/eligibility/:horseId', queryRateLimiter, validateHorseIdParam, checkConformationEligibility)`
  - [x] 2.6 Export router

- [x] Task 3: Wire conformation routes into the competition router
  - [x] 3.1 In `backend/modules/competition/routes/competitionRoutes.mjs`, import conformationShowRoutes
  - [x] 3.2 Mount: `router.use('/conformation', conformationShowRoutes)` (ABOVE any parameterised routes)
  - [x] Final path: `POST /api/v1/competition/conformation/enter` and `GET /api/v1/competition/conformation/eligibility/:horseId`

- [x] Task 4: Write integration tests in `backend/__tests__/conformationShowEntry.test.mjs`
  - [x] 4.1 Mock: `prisma` (external DB), `logger` (suppress output) — use balanced mocking
  - [x] 4.2 Test `enterConformationShow`: valid request → 201 + entryId + ageClass
  - [x] 4.3 Test `enterConformationShow`: ineligible (no groom assignment) → 400 with reason
  - [x] 4.4 Test `enterConformationShow`: wrong show type → 400 `'Show is not a conformation show'`
  - [x] 4.5 Test `enterConformationShow`: duplicate entry → 409
  - [x] 4.6 Test `enterConformationShow`: horse not owned → 404
  - [x] 4.7 Test `checkConformationEligibility`: eligible horse + groom → `{ eligible: true, groomAssigned: true }`
  - [x] 4.8 Test `checkConformationEligibility`: no groom assignment → `{ eligible: false, groomAssigned: false }`
  - [x] 4.9 Test `checkConformationEligibility`: unhealthy horse → `{ eligible: false }` with health error
  - [x] 4.10 Test `checkConformationEligibility`: unowned horse → 404

### Review Findings

- [x] [Review][Patch] Show not found returns 404 — AC1 requires HTTP 400 [conformationShowController.mjs:~68; conformationShowEntry.test.mjs:~195]
- [x] [Review][Patch] No POST /enter test for unhealthy horse (AC5 gap — bad health → 400 not covered) [conformationShowEntry.test.mjs]
- [x] [Review][Patch] Express-validator 400 branch not actually exercised — validationResult cannot be triggered without middleware chain [conformationShowEntry.test.mjs]

#### Pass 2 Review Findings (2026-04-07)

- [x] [Review][Patch] Dead `validationResult` import in conformationShowRoutes.mjs — imported but never called [conformationShowRoutes.mjs:13]
- [x] [Review][Patch] `className` validator missing `.trim()` — whitespace-only strings like `' '` pass validation [conformationShowRoutes.mjs]

## Dev Notes

### ⚠️ Story Naming Discrepancy (informational only)

The sprint-status key `31f-2-show-entry-and-eligibility` names this story differently from the epic file's "Story 31F-2: Rewards, Titles, and Breeding Value Boost". The epic file's 31F-2 (rewards/titles) maps to sprint-status key `31f-3-rewards-and-title-progression`. This story implements the **entry + eligibility endpoints** (from epic FR-42 and FR-44) rather than the rewards system (FR-39/40/41) which is story 31F-3.

### Previous Story 31F-1 — What Already Exists

`backend/services/conformationShowService.mjs` is **complete and tested**. Do NOT re-implement anything from it.

Exports to IMPORT and REUSE (do not duplicate):

| Function/Constant | Use |
|---|---|
| `validateConformationEntry(horse, groom, className, userId)` | Core validation for both endpoints |
| `CONFORMATION_CLASSES` (from `schema.mjs` via service) | Use `CONFORMATION_CLASSES.MARES` as placeholder in eligibility check |
| `getConformationAgeClass(age)` | Already called inside `validateConformationEntry` — age class is in `result.ageClass` |

Import path from `backend/modules/competition/controllers/`:
```js
import { validateConformationEntry } from '../../../services/conformationShowService.mjs';
```

### Schema — Existing Models (no migrations needed)

**ShowEntry** (`show_entries` table) — use this to persist conformation entries:
```prisma
model ShowEntry {
  id        Int      @id @default(autoincrement())
  showId    Int
  horseId   Int
  userId    String
  feePaid   Int      @default(0)
  createdAt DateTime @default(now())
  @@unique([showId, horseId])   // prevents duplicate entries automatically
}
```

**Show** (`shows` table) — has `showType String @default("ridden")`. Conformation shows have `showType: 'conformation'`. Guard this in `enterConformationShow`.

**No schema migrations needed for 31F-2.** The `ageClass` and `className` are returned in the API response; they do NOT need to be stored in `ShowEntry` for this story. The execution story (31F-3) will look up groom assignment dynamically at run time.

### Routing Architecture

The existing routing chain:
```
app.use('/api/v1', authRouter)           ← app.mjs
authRouter.use('/competition', competitionRoutes)   ← app.mjs
```
`backend/routes/competitionRoutes.mjs` is a **shim** — it re-exports from `backend/modules/competition/routes/competitionRoutes.mjs`. Add the conformation sub-router to the modules file, NOT the shim.

Add to `backend/modules/competition/routes/competitionRoutes.mjs`:
```js
import conformationShowRoutes from './conformationShowRoutes.mjs';
// BEFORE any /:id parameterised routes to avoid route shadowing:
router.use('/conformation', conformationShowRoutes);
```

Final endpoint paths (both prefixes work due to dual mount in app.mjs):
- `POST /api/v1/competition/conformation/enter`
- `GET /api/v1/competition/conformation/eligibility/:horseId`

### File Locations

| File | Action |
|---|---|
| `backend/modules/competition/controllers/conformationShowController.mjs` | CREATE |
| `backend/modules/competition/routes/conformationShowRoutes.mjs` | CREATE |
| `backend/modules/competition/routes/competitionRoutes.mjs` | MODIFY — add `router.use('/conformation', ...)` |
| `backend/services/conformationShowService.mjs` | READ-ONLY — import from it, do NOT modify |
| `backend/__tests__/conformationShowEntry.test.mjs` | CREATE |
| `backend/routes/competitionRoutes.mjs` | READ-ONLY shim — do NOT modify |

### Ownership Pattern (copy from existing competition routes)

Use `findOwnedResource` from `backend/middleware/ownership.mjs` — it returns the horse object or null:
```js
import { findOwnedResource } from '../../../middleware/ownership.mjs';

const horse = await findOwnedResource('horse', horseId, userId);
if (!horse) {
  return res.status(404).json({ success: false, message: 'Horse not found' });
}
```

Per SECURITY.md IDOR policy: always return 404 (not 403) when ownership check fails to avoid disclosing resource existence.

### Groom Lookup in the Eligibility Check

The eligibility check endpoint doesn't accept `groomId` in the URL — it checks the horse's **currently active** groom assignment automatically:

```js
const assignment = await prisma.groomAssignment.findFirst({
  where: { foalId: horseId, userId, isActive: true },
});
const groom = assignment
  ? await prisma.groom.findUnique({ where: { id: assignment.groomId } })
  : null;
// Pass groom (or null) to validateConformationEntry
```

`validateConformationEntry` already handles `groom = null` by adding the error `'Groom must be assigned to this horse before entering conformation shows'`.

### express-validator Patterns (copy from competitionRoutes.mjs)

```js
import { body, param, validationResult } from 'express-validator';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';

const validateEnterBody = [
  body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
  body('groomId').isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
  body('showId').isInt({ min: 1 }).withMessage('showId must be a positive integer'),
  body('className').isString().notEmpty().withMessage('className is required'),
];

const validateHorseIdParam = [
  param('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
];
```

Always check `validationResult(req)` at the start of each handler and return 400 if not empty.

### Testing Standards — Balanced Mocking

Mock only external dependencies per project testing philosophy:
- **Mock**: `prisma` (DB), `logger` (suppress noise)
- **DO NOT mock**: `validateConformationEntry`, `getConformationAgeClass`, `calculateSynergy` — test real business logic

Test file skeleton:
```js
import { jest } from '@jest/globals';

// Mock prisma and logger
const mockPrisma = { horse: {}, groom: {}, groomAssignment: {}, showEntry: {}, show: {} };
jest.unstable_mockModule('../../../db/index.mjs', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../../../utils/logger.mjs', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Import after mocking
const { enterConformationShow, checkConformationEligibility } = await import(
  '../modules/competition/controllers/conformationShowController.mjs'
);
```

Reference existing integration test patterns from:
- `backend/__tests__/conformationShowScoring.test.mjs` (31F-1 — same service)
- `backend/__tests__/temperamentApiEndpoints.test.mjs` (endpoint test pattern with express-validator mocking)

### `prisma.showEntry` — Note on Prisma Client Access

The Prisma client uses camelCase model names. The model `ShowEntry` is accessed as `prisma.showEntry` (not `prisma.show_entries`). The `@@unique([showId, horseId])` constraint will throw a Prisma unique constraint error (`P2002`) on duplicate entry — catch this and return 409.

```js
try {
  const entry = await prisma.showEntry.create({ data: { showId, horseId, userId, feePaid: 0 } });
} catch (err) {
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Horse is already entered in this show' });
  }
  throw err;
}
```

### Architecture Compliance

- AR-01: New controller goes in `backend/modules/competition/controllers/` (module domain pattern)
- AR-02: ES modules only — `.mjs`, `import`/`export`
- AR-03: Import logger from `backend/utils/logger.mjs`, prefix log entries with `[conformationShowController]`
- AR-04: No new Prisma migrations needed — uses existing `ShowEntry` + `Show` models
- AR-05: Rate limiters required — `mutationRateLimiter` on POST, `queryRateLimiter` on GET
- AR-06: Do NOT modify `conformationShowService.mjs` — it is the 31F-1 output, read-only for this story

### References

- [Source: docs/epics-physical-systems.md#Epic 31F Story 31F-3] — FR-42, FR-44 are the ACs implemented here
- [Source: backend/services/conformationShowService.mjs] — `validateConformationEntry` to reuse
- [Source: backend/modules/competition/routes/competitionRoutes.mjs] — express-validator + rate limiter patterns
- [Source: backend/middleware/ownership.mjs] — `findOwnedResource` IDOR-safe ownership check
- [Source: packages/database/prisma/schema.prisma#ShowEntry] — `show_entries` table (line 1280)
- [Source: packages/database/prisma/schema.prisma#Show.showType] — `showType` field (line 400)
- [Source: backend/__tests__/conformationShowScoring.test.mjs] — 31F-1 test patterns to follow

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **Mock queue leakage (resolved)**: `jest.clearAllMocks()` does not reset `mockResolvedValueOnce` queues; switching to `jest.resetAllMocks()` in `beforeEach` eliminated stale-value leakage between eligibility tests.
- **Groom error regex (resolved)**: When `groom=null`, `validateConformationEntry` returns `'Horse and groom are required'` (early guard), not the assignment-specific message. Widened test regex from `/groom.*assigned/i` to `/groom/i`.
- **Jest invocation on Windows**: `node_modules/.bin/jest` failed; used `node --experimental-vm-modules node_modules/jest/bin/jest.js` (matches `package.json` test script).

### Completion Notes List

- All 4 tasks and 10 sub-tasks completed as specified.
- Controller implements both `enterConformationShow` (POST) and `checkConformationEligibility` (GET) with full ownership, validation, duplicate-entry, and service-layer integration.
- Routes mounted at `/conformation` sub-router before any parameterised routes in `competitionRoutes.mjs`.
- 14 integration tests written and passing; broader regression (51 suites, 986 tests) all green.
- No Prisma schema migrations required — existing `ShowEntry` and `Show` models used as-is.
- `ageClass` and `className` returned in API response only; not persisted to DB (per story spec).
- IDOR security pattern applied: ownership failures return 404, not 403.
- Prisma P2002 unique constraint violation caught and mapped to HTTP 409 as a race-condition safety net (in addition to the explicit duplicate guard earlier in the flow).

### File List

- `backend/modules/competition/controllers/conformationShowController.mjs` — CREATED
- `backend/modules/competition/routes/conformationShowRoutes.mjs` — CREATED
- `backend/modules/competition/routes/competitionRoutes.mjs` — MODIFIED (added `router.use('/conformation', conformationShowRoutes)`)
- `backend/__tests__/conformationShowEntry.test.mjs` — CREATED (14 tests)
- `_bmad-output/implementation-artifacts/31f-2-show-entry-and-eligibility.md` — CREATED/UPDATED
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATED (status → review)

### Change Log

- 2026-04-06: Story implemented end-to-end by claude-sonnet-4-6.
  - Created controller with `enterConformationShow` and `checkConformationEligibility`.
  - Created route file with express-validator and rate limiter middleware.
  - Wired conformation sub-router into competition router.
  - Wrote 14 integration tests; resolved mock queue leakage and regex issues.
  - All tests passing (14/14 new + 986 regression tests green).
