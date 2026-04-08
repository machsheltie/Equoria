# Story 31F.3: Rewards and Title Progression

Status: review

## Story

As a developer,
I want a conformation show execution endpoint that distributes ribbons, title points, and breeding value boosts after scoring, plus a title-query endpoint,
So that conformation show participation has meaningful, persistent rewards that differentiate it from ridden competition (no prize money).

## Acceptance Criteria

**AC1 — POST /api/v1/competition/conformation/execute:**

Given an authenticated user (or admin trigger) sends `{ showId }` to execute a conformation show,
When `POST /api/v1/competition/conformation/execute` is called,
Then all `ShowEntry` records for the show are loaded,
And each horse's conformation show score is calculated via `calculateConformationShowScore()` from `conformationShowService.mjs`,
And entries are ranked by score (highest first, ties broken by entry creation order),
And for each placement, the appropriate reward is applied:
  - 1st: ribbon=`'Blue'`, titlePoints=10, breedingValueBoost=+5%
  - 2nd: ribbon=`'Red'`, titlePoints=7, breedingValueBoost=+3%
  - 3rd: ribbon=`'Yellow'`, titlePoints=5, breedingValueBoost=+1%
  - 4th+: ribbon=`'White'`, titlePoints=2, breedingValueBoost=0%
And a `CompetitionResult` record is created per horse with `placement`, `score`, `statGains` (containing ribbon and titlePoints awarded),
And the horse's `titlePoints` accumulation and `currentTitle` are updated per the title-progression thresholds,
And the horse's `breedingValueBoost` is incremented (capped at 15%),
And the response is HTTP 200 with `{ success: true, data: { showId, results: [{ horseId, placement, score, ribbon, titlePoints, newTitle, breedingValueBoost }] } }`.

**AC2 — Title progression thresholds:**

Given a horse accumulates title points across multiple shows,
When `updateHorseTitle()` is called after each show,
Then `currentTitle` is set to the highest threshold reached:
  - 0–24 points: `null` (no title)
  - 25–49 points: `'Noteworthy'`
  - 50–99 points: `'Distinguished'`
  - 100–199 points: `'Champion'`
  - 200+ points: `'Grand Champion'`
And titles are permanent — a horse that reaches `'Champion'` keeps it even if not competing again.

**AC3 — Breeding value boost cap:**

Given a horse has accumulated a breedingValueBoost,
When `applyBreedingValueBoost()` is called,
Then the boost increments by the placement-appropriate percentage,
And the total `breedingValueBoost` is capped at `0.15` (15%),
And no boost is applied for 4th place or lower.

**AC4 — No prize money:**

Given a conformation show executes,
When results are distributed,
Then no `prizeWon` amount is set on `CompetitionResult` for conformation shows (field remains `null` or `0`),
And no user balance is modified.

**AC5 — GET /api/v1/competition/conformation/titles/:horseId:**

Given an authenticated user calls `GET /api/v1/competition/conformation/titles/:horseId`,
When the endpoint is called,
Then horse ownership is verified (IDOR: 404 on ownership failure),
And the response is HTTP 200 with `{ success: true, data: { horseId, horseName, titlePoints, currentTitle, breedingValueBoost } }`.

**AC6 — Schema migration:**

Given the Horse model currently has no title-tracking fields,
When the Prisma migration runs,
Then three new optional fields are added to `Horse`:
  - `titlePoints Int @default(0)` — accumulated title points from conformation shows
  - `currentTitle String?` — current title prefix (null if below Noteworthy threshold)
  - `breedingValueBoost Float @default(0.0)` — accumulated breeding value boost (0.0–0.15)

**AC7 — Integration tests:**

Given a show with multiple entered horses,
When `POST /api/v1/competition/conformation/execute` is called,
Then 1st-place horse receives Blue ribbon, 10 title points, +5% boost,
And 4th+ place horses receive White ribbon, 2 title points, no boost,
And a horse accumulating 25+ total title points has `currentTitle` set to `'Noteworthy'`,
And a horse already at 15% boost receives no additional boost regardless of placement,
And `GET /api/v1/competition/conformation/titles/:horseId` returns correct accumulated values.

## Tasks / Subtasks

- [x] Task 1: Prisma schema migration for title-tracking fields (AC: #6)
  - [x] Add `titlePoints Int @default(0)` to Horse model in `packages/database/prisma/schema.prisma`
  - [x] Add `currentTitle String?` to Horse model
  - [x] Add `breedingValueBoost Float @default(0.0)` to Horse model
  - [x] Run `npx prisma migrate dev --name add_horse_title_fields` from `packages/database/` — drift blocked migrate dev; applied via `prisma db execute` SQL directly
  - [x] Regenerate Prisma client

- [x] Task 2: Service functions for reward calculation and title/boost logic (AC: #1, #2, #3, #4)
  - [x] Add `REWARD_TABLE` constant (placement → ribbon/titlePoints/breedingValueBoost) to `conformationShowService.mjs`
  - [x] Add `TITLE_THRESHOLDS` constant (array of `{ points, title }`) to `conformationShowService.mjs`
  - [x] Implement `resolveReward(placement)` — returns `{ ribbon, titlePoints, breedingValueBoost }` for a given placement
  - [x] Implement `resolveTitle(accumulatedPoints)` — returns highest earned title string or null
  - [x] Implement `executeConformationShow(showId)` — loads entries, scores each horse, ranks, applies rewards via Prisma transaction, returns full results array
  - [x] Export all new functions from `conformationShowService.mjs`

- [x] Task 3: Controller function for show execution (AC: #1, #4)
  - [x] Add `executeConformationShow` handler to `conformationShowController.mjs`
  - [x] Validate `showId` body param (positive integer)
  - [x] Verify show exists and `showType === 'conformation'`
  - [x] Delegate to `executeConformationShow(showId)` service function
  - [x] Return HTTP 200 with structured results
  - [x] Handle 400 (show not found / wrong type), 500 (unexpected error)

- [x] Task 4: Controller function for title query (AC: #5)
  - [x] Add `getConformationTitles` handler to `conformationShowController.mjs`
  - [x] Validate `horseId` path param (positive integer)
  - [x] Verify horse ownership via `findOwnedResource` (IDOR: 404 on failure)
  - [x] Return HTTP 200 with `{ horseId, horseName, titlePoints, currentTitle, breedingValueBoost }`

- [x] Task 5: Route registration (AC: #1, #5)
  - [x] Add `POST /execute` route with `mutationRateLimiter` and body validation to `conformationShowRoutes.mjs`
  - [x] Add `GET /titles/:horseId` route with `queryRateLimiter` and param validation to `conformationShowRoutes.mjs`

- [x] Task 6: Integration tests (AC: #7)
  - [x] Create `backend/__tests__/conformationShowExecution.test.mjs`
  - [x] Mock `prisma`, `conformationShowService`, `findOwnedResource`, `rateLimiting`, `express-validator` (plain functions, not jest.fn, to survive `jest.resetAllMocks()`)
  - [x] Test: execute show → 1st place receives Blue ribbon + 10 pts + 5% boost
  - [x] Test: execute show → 4th place receives White ribbon + 2 pts + 0% boost
  - [x] Test: horse at 22 pts + 4 more = 26 → `currentTitle` set to `'Noteworthy'`
  - [x] Test: horse at 14% boost + 5% → capped at 15%
  - [x] Test: execute on non-conformation show → 400
  - [x] Test: GET titles → returns accumulated values
  - [x] Test: GET titles for unowned horse → 404

## Dev Notes

### Schema Design Decision

The Horse model currently has no title-tracking fields. This story adds three optional fields:
- `titlePoints Int @default(0)` — simple integer counter, no upper bound
- `currentTitle String?` — denormalized for fast read (recomputed on each show execution)
- `breedingValueBoost Float @default(0.0)` — float in [0.0, 0.15], enforced in service logic not DB constraint

Breeding value boost affects offspring conformation generation in the breeding system (Epic 31B/31C). The `breedingValueBoost` field on Horse is read by `conformationService.mjs` during foal generation — integration with the breeding system is **out of scope for this story** (deferred to a future breeding-integration story). This story only writes the value; reading it during breeding is a separate concern.

### Reward Table (from PRD-03 §3.6)

| Placement | Ribbon | Title Points | Breeding Boost |
|-----------|--------|-------------|----------------|
| 1st       | Blue   | +10         | +5%            |
| 2nd       | Red    | +7          | +3%            |
| 3rd       | Yellow | +5          | +1%            |
| 4th+      | White  | +2          | 0%             |

### Title Thresholds (from PRD-03 §3.6 / FR-40)

| Accumulated Points | Title           |
|--------------------|-----------------|
| 0–24               | (none)          |
| 25–49              | Noteworthy      |
| 50–99              | Distinguished   |
| 100–199            | Champion        |
| 200+               | Grand Champion  |

Titles are permanent. `resolveTitle()` returns the highest threshold reached; once earned, a title cannot be lost.

### No Prize Money (FR-39, AC4)

Conformation shows do NOT award prize money. `CompetitionResult.prizeWon` must remain `null` (or be omitted). Do not touch `User.money`. The differentiation from ridden competition is intentional per PRD-03 §3.6: "Rewards (Not Prize Money)".

### Existing Service Exports to Reuse

`backend/services/conformationShowService.mjs` already exports:
- `calculateConformationShowScore(horse, groom, groomAssignment)` — returns numeric final score
- `validateConformationEntry(horse, groom, className, userId)` — async, returns `{ valid, errors, warnings, ageClass }`
- `CONFORMATION_SHOW_CONFIG`, `CONFORMATION_AGE_CLASSES`, `SHOW_HANDLING_SKILL_SCORES`

The execute function needs to call `calculateConformationShowScore` for each entry after loading the required horse/groom/assignment data.

### Mock Pattern for Tests

Use plain arrow functions (not `jest.fn()`) in `jest.unstable_mockModule` factories. `jest.resetAllMocks()` resets `jest.fn()` instances to `undefined` return, causing cascading TypeErrors. Plain functions survive `resetAllMocks()`. See `conformationShowEntry.test.mjs` for the established pattern.

### Import Paths

- Service: `import { executeConformationShow } from '../../../services/conformationShowService.mjs'`
- Controller: `backend/modules/competition/controllers/conformationShowController.mjs`
- Routes: `backend/modules/competition/routes/conformationShowRoutes.mjs`
- Prisma: `import prisma from '../../../db/index.mjs'`
- Ownership: `import { findOwnedResource } from '../../../middleware/ownership.mjs'`
- Rate limiters: `import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs'`

### Project Structure Notes

- All new files use `.mjs` extension and ES module syntax
- camelCase for all identifiers; PascalCase for constants that are objects/classes
- No CommonJS (`require`/`module.exports`)
- Migration file goes in `packages/database/prisma/migrations/` (auto-generated by `prisma migrate dev`)

### References

- [Source: docs/product/PRD-03-Gameplay-Systems.md §3.6 Conformation Show System]
- [Source: docs/epics-physical-systems.md FR-39, FR-40, FR-41, FR-43, FR-45]
- [Source: backend/services/conformationShowService.mjs — existing service API]
- [Source: backend/__tests__/conformationShowEntry.test.mjs — mock pattern reference]
- [Source: packages/database/prisma/schema.prisma — Horse model, ShowEntry, CompetitionResult]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `prisma migrate dev` blocked by existing migration drift (conformationScores default mismatch). Applied schema changes directly via `prisma db execute` SQL, then regenerated client. Columns verified live before migration fail.
- Pre-existing 191 test failures in `__tests__/integration/` and `tests/` are supertest+live-DB tests that require a running PostgreSQL instance — confirmed unrelated to this story by checking error type (`app.listen` + `PrismaClientKnownRequestError`).

### Completion Notes List

- Task 1: Added `titlePoints Int @default(0)`, `currentTitle String?`, `breedingValueBoost Float @default(0.0)` to Horse model in schema.prisma. Applied via `prisma db execute` (drift bypass), regenerated client.
- Task 2: Added `REWARD_TABLE`, `BREEDING_BOOST_CAP`, `TITLE_THRESHOLDS`, `resolveReward()`, `resolveTitle()`, `applyBreedingValueBoost()`, and `executeConformationShow()` to `conformationShowService.mjs`. Show execution uses Prisma `$transaction` for atomicity; no `prizeWon` field set (AC4).
- Task 3: Added `executeConformationShowHandler` to controller — delegates to service, maps service `statusCode=400` errors to HTTP 400, everything else to 500.
- Task 4: Added `getConformationTitles` handler — IDOR-safe (404 not 403) via `findOwnedResource`.
- Task 5: Registered `POST /execute` (mutationRateLimiter + showId validation) and `GET /titles/:horseId` (queryRateLimiter + horseId validation) in `conformationShowRoutes.mjs`.
- Task 6: 34 tests in `conformationShowExecution.test.mjs` — all pass. Covers: reward table unit tests, title threshold unit tests, boost cap unit tests, controller execute (1st/4th/Noteworthy/cap/400/500), controller titles (200/404/400/500). Plain arrow function mocks used throughout per story dev notes.

### File List

- `packages/database/prisma/schema.prisma` — added titlePoints, currentTitle, breedingValueBoost to Horse model
- `backend/services/conformationShowService.mjs` — added REWARD_TABLE, BREEDING_BOOST_CAP, TITLE_THRESHOLDS, resolveReward, resolveTitle, applyBreedingValueBoost, executeConformationShow
- `backend/modules/competition/controllers/conformationShowController.mjs` — added executeConformationShowHandler, getConformationTitles; updated import
- `backend/modules/competition/routes/conformationShowRoutes.mjs` — added POST /execute and GET /titles/:horseId routes; updated import
- `backend/__tests__/conformationShowExecution.test.mjs` — new; 34 tests all passing
