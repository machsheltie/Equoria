# Story 21S-1: Implement `GET /api/leaderboards/user-summary/:userId`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change A / Finding P0-1
**Owner:** BackendSpecialistAgent

## Problem

`/leaderboards` is classified `beta-live` in `docs/beta-route-truth-table.md`, but the frontend hook `fetchUserRankSummary` (at `frontend/src/lib/api/leaderboards.ts:131-135`) calls `GET /api/leaderboards/user-summary/:userId`, and that route is **not registered** in `backend/modules/leaderboards/routes/leaderboardRoutes.mjs`. Truth table itself admits this while still shipping the route.

## Acceptance Criteria

- [ ] New controller `getUserRankSummary(req, res)` added under `backend/modules/leaderboards/controllers/`.
- [ ] Route registered: `router.get('/user-summary/:userId', auth, getUserRankSummary)` in `leaderboardRoutes.mjs`.
- [ ] Response shape matches `UserRankSummaryResponse` declared in `frontend/src/lib/api/leaderboards.ts`:
  - `userName: string`
  - `rankings: CategoryRanking[]` — one entry per category (level, xp, horse-earnings, horse-performance)
  - `bestRankings: BestRanking[]` — categories where user rank qualifies for achievement tier
- [ ] Controller computes rank by reusing existing per-category leaderboard queries; no duplicate SQL.
- [ ] Route returns 401 unauthenticated, 404 or empty-arrays for ghost user, populated response for real user.
- [ ] New route test file under `backend/modules/leaderboards/__tests__/` with real DB integration:
  - unauthenticated → 401
  - ghost userId → 404 or `rankings: []`
  - real user with no results → `rankings: []`, `bestRankings: []`
  - real user with ranks → correct rank position and achievement tier per category
- [ ] `docs/beta-route-truth-table.md` row for `/leaderboards` updated: remove "cannot be beta-live" note; add verification reference.

## Verification

```bash
curl -H "Cookie: <session>" http://localhost:3000/api/leaderboards/user-summary/<userId>
# → 200 with UserRankSummaryResponse shape
```

## Out of Scope

- New leaderboard categories.
- Caching layer (can land in a later story).

## Handoff Notes

Frontend is already wired. Landing the backend closes the gap without any frontend code change.
