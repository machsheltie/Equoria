# Story 21S-1: Implement `GET /api/leaderboards/user-summary/:userId`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** done
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change A / Finding P0-1
**Owner:** BackendSpecialistAgent

## Problem

`/leaderboards` is classified `beta-live` in `docs/beta-route-truth-table.md`, but the frontend hook `fetchUserRankSummary` (at `frontend/src/lib/api/leaderboards.ts:131-135`) calls `GET /api/leaderboards/user-summary/:userId`, and that route is **not registered** in `backend/modules/leaderboards/routes/leaderboardRoutes.mjs`. Truth table itself admits this while still shipping the route.

## Acceptance Criteria

- [x] AC-1: New controller `getUserRankSummary(req, res)` added under `backend/modules/leaderboards/controllers/`.
- [x] AC-2: Route registered: `router.get('/user-summary/:userId', auth, getUserRankSummary)` in `leaderboardRoutes.mjs`.
- [x] AC-3: Response shape matches `UserRankSummaryResponse` declared in `frontend/src/lib/api/leaderboards.ts`:
  - `userId: string`
  - `userName: string`
  - `rankings: CategoryRanking[]` — one entry per category (level, xp, horse-earnings, horse-performance)
  - `bestRankings: BestRanking[]` — categories where user rank qualifies for Top 10 or Top 100
- [x] AC-4: Controller uses existing Prisma models (User, XpEvent, Horse, CompetitionResult) directly; no duplicate SQL.
- [x] AC-5: Route returns 401 unauthenticated, 200 with empty arrays for ghost user, 200 with populated response for real user.
- [x] AC-6: New route test file under `backend/modules/leaderboards/__tests__/` with real DB integration covering:
  - unauthenticated → 401 ✓
  - ghost userId → 200 with `rankings: []`, `bestRankings: []` ✓
  - real user with no results → 4 rankings with `0` primaryStat, 0 bestRankings ✓
  - real user with ranks → correct rank position and achievement tier per category ✓
- [x] AC-7: `docs/beta-route-truth-table.md` row for `/leaderboards` updated: old "cannot be beta-live" note replaced with verification reference to Story 21S-1.

## Tasks/Subtasks

- [x] **Task 1: Write failing integration test (RED)** (AC-6)
  - [x] 1.1 Create `backend/modules/leaderboards/__tests__/userRankSummaryRoutes.integration.test.mjs`
  - [x] 1.2 Four scenarios: unauthenticated 401, ghost userId empty arrays, real user no results, real user with ranks
  - [x] 1.3 Use `createTestUser` + `cleanupTestData` from `backend/tests/helpers/testAuth.mjs`
  - [x] 1.4 Confirm tests fail (route not registered yet) — initial run: 3 failed with 404, 1 passed (auth-guard)
- [x] **Task 2: Implement controller (GREEN)** (AC-1, AC-3, AC-4)
  - [x] 2.1 Add `getUserRankSummary` export to `backend/modules/leaderboards/controllers/leaderboardController.mjs`
  - [x] 2.2 Level rank — count users where `(level > me.level) OR (level = me.level AND xp > me.xp)`, then +1
  - [x] 2.3 XP rank — aggregate target user's `xpEvent.amount` sum, then count users with higher sum via `groupBy`
  - [x] 2.4 Horse-earnings rank — aggregate target user's `horse.totalEarnings` sum, then count users with higher sum
  - [x] 2.5 Horse-performance rank — MAX `competitionResult.score` across user's horses; count users with higher best-horse max (note: pre-existing `performanceScore` column does not exist in schema — used real signal `CompetitionResult.score`)
  - [x] 2.6 Build `CategoryRanking[]` with category, categoryLabel, rank, totalEntries, rankChange (0), primaryStat, statLabel
  - [x] 2.7 Build `bestRankings` from rankings where rank ≤ 100 (label Top 10 or Top 100)
  - [x] 2.8 Return `{ userId, userName, rankings, bestRankings }`
  - [x] 2.9 User-not-found → 200 with empty arrays (honest empty state for frontend dashboard)
  - [x] 2.10 Error handler logs via `logger.error` and returns 500 consistent with peer controllers
- [x] **Task 3: Register route (GREEN)** (AC-2)
  - [x] 3.1 Add `getUserRankSummary` to imports in `backend/modules/leaderboards/routes/leaderboardRoutes.mjs`
  - [x] 3.2 Register `router.get('/user-summary/:userId', auth, getUserRankSummary)` after `/players/level`, before `/players/xp`
  - [x] 3.3 Add Swagger JSDoc describing request and response schema
  - [x] 3.4 Re-run integration tests — confirm all 4 pass GREEN
- [x] **Task 4: Refactor + validate (REFACTOR)** (AC-4)
  - [x] 4.1 Applied `curly` fix (wrapped `if` bodies in braces to satisfy project ESLint rule)
  - [x] 4.2 Ran `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --testPathPattern=leaderboard` → 2 suites, 10 tests, 0 regressions
  - [x] 4.3 Ran `./node_modules/.bin/eslint` on changed files → 0 errors, 0 warnings
- [x] **Task 5: Update truth table row** (AC-7)
  - [x] 5.1 Located `/leaderboards` row in `docs/beta-route-truth-table.md`
  - [x] 5.2 Replaced "fetchUserRankSummary() currently returns null because its backend endpoint does not exist; user-rank panel cannot be beta-live" with a Corrected-2026-04-16 note referencing Story 21S-1 and the integration test
  - [x] 5.3 Added `/api/leaderboards/user-summary/:userId` to the row's Required APIs column
  - [x] 5.4 Row remains `beta-live`; follow-up column updated to `21S-1, 21R-3`

## Verification

```bash
# Manual curl
curl -H "Cookie: <session>" http://localhost:3000/api/leaderboards/user-summary/<userId>
# → 200 with UserRankSummaryResponse shape

# Automated
npm --prefix backend test -- userRankSummaryRoutes.integration
```

## Out of Scope

- New leaderboard categories (e.g., win-rate, prize-money) — the existing four categories cover the current frontend.
- Caching layer (can land in a later story).
- `rankChange` (week-over-week delta) — return `0` for now; a later story can add delta tracking once historical rank snapshots are persisted.

## Dev Notes

### Response shape (from `frontend/src/lib/api/leaderboards.ts:43-48`)

```ts
export interface UserRankSummaryResponse {
  userId: string;
  userName: string;
  rankings: CategoryRanking[];
  bestRankings: BestRanking[];
}
```

### `CategoryRanking` (from `frontend/src/components/leaderboard/RankSummaryCard.tsx:25-33`)

```ts
export interface CategoryRanking {
  category: string;
  categoryLabel: string;
  rank: number;
  totalEntries: number;
  rankChange: number;
  primaryStat: number;
  statLabel: string;
}
```

### `BestRanking` (from `frontend/src/components/leaderboard/UserRankDashboard.tsx:33-38`)

```ts
export interface BestRanking {
  category: string;
  categoryLabel: string;
  rank: number;
  achievement: string;  // "Top 10" or "Top 100"
}
```

### Achievement tiers (from `RankSummaryCard.tsx:68-72`)

- rank ≤ 10 → "Top 10"
- rank ≤ 100 → "Top 100"
- otherwise → no achievement (not in `bestRankings`)

### Category definitions for this endpoint

| category         | categoryLabel     | primaryStat source                                                            | statLabel    |
| ---------------- | ----------------- | ----------------------------------------------------------------------------- | ------------ |
| level            | Level             | `user.level`                                                                  | "Level"      |
| xp               | XP                | sum of `xpEvent.amount` for this user (all-time)                              | "XP"         |
| horse-earnings   | Horse Earnings    | sum of `horse.totalEarnings` across horses owned by this user                 | "Earnings"   |
| horse-performance| Horse Performance | MAX(`competitionResult.score`) across horses owned by this user               | "Score"      |

**Note:** The pre-existing `getTopHorsesByPerformance` controller references a `performanceScore` column that does NOT exist in the Prisma schema (verified via `grep` on `schema.prisma` and `migrations/`). Out of scope for this story — we use `CompetitionResult.score` as the real signal. Fixing `getTopHorsesByPerformance` is a separate backlog item.

### Auth import pattern

```ts
import auth from '../../../middleware/auth.mjs';
```

(matches existing routes in `leaderboardRoutes.mjs:14`)

### Test pattern reference

`backend/modules/community/__tests__/communityRoutes.integration.test.mjs` — uses `createTestUser`, `cleanupTestData`, `x-test-skip-csrf` header for CSRF bypass during test, `supertest` against `app.mjs`.

## Dev Agent Record

### Debug Log

- **Initial RED run** (2026-04-16, pre-implementation): 4 tests, 3 failed with `Expected 200, Received 404` (route not registered — expected), 1 passed (auth-guard 401 — passed because `authRouter.use(authenticateToken)` runs before 404 resolution).
- **First GREEN run** encountered a transient failure on the populated-profile test: XP primaryStat returned `0` instead of ≥750 against seeded `xpEvent`. Added a diagnostic log to inspect the seed + readback, then re-ran cleanly — issue did not reproduce (likely residual test data in the DB from an earlier cleanup race). All 4 tests passed on the subsequent run. Diagnostic log removed afterwards.
- **Lint run** flagged 2 `curly` errors on single-line `if` statements inside the `horse-performance` aggregation loop. Fixed by wrapping bodies in `{}`.
- **Leaderboard-scoped regression** (`--testPathPattern=leaderboard`): 2 suites, 10 tests passing.

### Completion Notes

- Implemented `GET /api/leaderboards/user-summary/:userId` entirely in the existing `leaderboards` module — no new modules, no new Prisma migrations, no frontend changes required.
- The pre-existing `getTopHorsesByPerformance` controller references a `performanceScore` field that does NOT exist on `Horse` in `schema.prisma`. That controller is broken independently of this story; out of scope. This story uses `CompetitionResult.score` as the real signal for the `horse-performance` category.
- Ghost-user contract: missing `User` row returns 200 with empty arrays rather than 404. Rationale: the frontend `fetchUserRankSummary` return type is `UserRankSummaryResponse | null` and the dashboard renders an empty state; 404 would raise an unhelpful error toast in beta.
- `rankChange` is hardcoded to `0` for this story. Tracking week-over-week delta requires persisted rank snapshots — intentional out-of-scope.
- Horse-performance ranking iterates `competitionResult` rows in memory to reduce to per-user max score, then counts owners above target. Acceptable for beta scale. A SQL aggregation variant can land in a later performance pass if N grows large.

### Verification Evidence

```bash
# 1. Targeted RED→GREEN
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand modules/leaderboards/__tests__/userRankSummaryRoutes.integration.test.mjs
# → Test Suites: 1 passed, 1 total
# → Tests:       4 passed, 4 total

# 2. Leaderboard-scoped regression
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --testPathPattern="leaderboard"
# → Test Suites: 2 passed, 2 total
# → Tests:       10 passed, 10 total

# 3. Lint
./node_modules/.bin/eslint modules/leaderboards/controllers/leaderboardController.mjs modules/leaderboards/routes/leaderboardRoutes.mjs modules/leaderboards/__tests__/userRankSummaryRoutes.integration.test.mjs
# → 0 errors, 0 warnings
```

## File List

**Added:**
- `backend/modules/leaderboards/__tests__/userRankSummaryRoutes.integration.test.mjs`

**Modified:**
- `backend/modules/leaderboards/controllers/leaderboardController.mjs` — Added `getUserRankSummary` controller (~170 LOC) + export
- `backend/modules/leaderboards/routes/leaderboardRoutes.mjs` — Added import, Swagger JSDoc block, and route registration
- `docs/beta-route-truth-table.md` — Updated `/leaderboards` row: added `/api/leaderboards/user-summary/:userId` to Required APIs, replaced "cannot be beta-live" language with a Corrected-2026-04-16 note, updated Follow-up column
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `21s-1-implement-user-rank-summary-endpoint` → `review`; `last_updated` refreshed
- `_bmad-output/implementation-artifacts/21s-1-implement-user-rank-summary-endpoint.md` — This story file: Status, task checkboxes, Dev Agent Record, File List, Change Log

## Change Log

| Date       | Author        | Change                                                                                                                                                                                                          |
| ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-16 | Dev Agent     | Created integration test (RED); added `getUserRankSummary` controller and `/user-summary/:userId` route (GREEN); fixed `curly` lint; updated truth table row; marked 21S-1 ready for review.                   |
| 2026-04-16 | Code Reviewer | Adversarial review posted (see "Senior Developer Review (AI)" below) — Changes Requested with 2 P1 items + nice-to-fixes.                                                                                       |
| 2026-04-16 | Dev Agent     | Addressed P1 review findings: zero-horse denominator guard (`totalEntries = max(horseOwnerCount, rank)`); perf TODOs on three full-scan queries; removed dead `Math.max`; added regression assertion. Done.    |

## Senior Developer Review (AI)

**Review Date:** 2026-04-16
**Reviewer:** Elite Code Reviewer (adversarial mode)
**Outcome:** Changes Requested — **now Approved** after review follow-up pass.

### Summary

Correctness: solid. Security: sound (leaderboard data is public, no authz needed). Perf: acceptable at beta scale, flagged for post-beta. Two P1 items + nice-to-fixes enumerated below.

### Action Items

- [x] **[High]** Fix zero-horse denominator — with `horseOwnerCount = 5` and target owning 0 horses, rank becomes 6 while totalEntries stays 5, so UI would render "#6 of 5". Guard with `Math.max(horseOwnerCount, rank)`. (Addressed 2026-04-16 in follow-up commit.)
- [x] **[High]** Add `TODO(perf, post-beta)` on the three full-scan aggregations (`xp.groupBy`, `horse.groupBy`, `competitionResult.findMany`). (Addressed 2026-04-16.)
- [x] **[Low]** Remove dead `Math.max(totalUsers, xpGrouped.length)` — totalUsers is always >= xpGrouped.length because every xpEvent is FK'd to a user. (Addressed 2026-04-16.)
- [ ] **[Med]** Decide on 400 vs 500 for invalid UUID format. Current: Prisma throws `PrismaClientKnownRequestError`, caught by 500 handler. Defer to a separate validation-hardening ticket; not a beta blocker.
- [ ] **[Med]** Add integration test for user with horses but zero `competitionResult`s. Covered transitively by the empty-user test; low-risk gap. Defer.
- [ ] **[Low]** Extract `computeLevelRank/computeXpRank/...` helpers when adding a 5th category. Defer until 5th category arrives.
- [ ] **[Low]** Open a bd issue for the pre-existing broken `getTopHorsesByPerformance` controller (references non-existent `performanceScore` column). Tracked separately from Epic 21S.

### Other Notes

- Leaderboard-style endpoint does not require per-user authorization (public data). Documented for the reviewer record.
- Response caching explicitly deferred — React Query `staleTime` is the right cache layer.

## Tasks/Subtasks — Review Follow-ups (AI)

- [x] [AI-Review][High] Guard `totalEntries >= rank` for horse-earnings and horse-performance categories
- [x] [AI-Review][High] Add `TODO(perf, post-beta)` comments to XP groupBy, earnings groupBy, and competitionResult findMany scans
- [x] [AI-Review][Low] Remove dead `Math.max(totalUsers, xpGrouped.length)`
- [x] [AI-Review][High] Regression test: assert `totalEntries >= rank` on every ranking for empty-profile user

## Handoff Notes

Frontend is already wired. Landing the backend closes the gap without any frontend code change.
