# Story 21S-4: Wire `/my-stable` Career Stats to Real Competition APIs

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** done
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change C / Finding P0-6
**Owner:** FrontendSpecialistAgent + BackendSpecialistAgent
**Scope note:** Discovery during Dev Agent session — backend endpoints `GET /api/users/:userId/competition-stats` and `GET /api/horses/:horseId/competition-history` don't exist, only the frontend hooks. Same pattern as 21S-1. Landing both backend endpoints + frontend wiring in this story.

## Problem

`/my-stable` is classified `beta-live`, but `frontend/src/pages/MyStablePage.tsx:272-311` hardcodes every career / stable statistic to zero:

```ts
career: { competitions: 0, wins: 0, earnings: <real> }
stats: {
  totalHorses: <real>, activeRacers: <real>,
  competitionsEntered: 0,
  firstPlaceFinishes: 0,
  totalEarnings: <real>, breedingPairs: <real>,
}
```

Frontend hooks `useUserCompetitionStats` and `useHorseCompetitionHistory` exist and expect:
- `GET /api/users/:userId/competition-stats`
- `GET /api/horses/:horseId/competition-history`

**Neither route is registered in the backend** (verified via grep on `backend/modules/**/routes`). Same pattern as 21S-1 — mock-by-another-name, a tester sees 0 wins / 0 competitions regardless of reality.

## Acceptance Criteria

### Backend

- [x] AC-B1: New controller `getUserCompetitionStats` exported from `backend/modules/users/controllers/userController.mjs`. Aggregates `CompetitionResult` across all horses owned by `:userId`; matches `UserCompetitionStats` shape.
- [x] AC-B2: New controller `getHorseCompetitionHistory` exported from `backend/modules/horses/controllers/horseController.mjs`. Returns per-horse history + `HorseCompetitionStatistics`; matches `CompetitionHistoryData` shape.
- [x] AC-B3: Routes registered:
  - `GET /api/users/:userId/competition-stats` — `userRoutes.mjs`, `authenticateToken` + `queryRateLimiter` + UUID param validation.
  - `GET /api/horses/:horseId/competition-history` — `horseRoutes.mjs`, `authenticateToken` + `queryRateLimiter` + int validation + `requireOwnership('horse', { idParam: 'horseId' })`.
- [x] AC-B4: Real-DB integration tests passing — 6/6 across both suites. 401 unauthenticated, empty horse/user → zeroed statistics, populated → correct aggregation (totals, winRate, bestPlacement, mostSuccessfulDiscipline).

### Frontend

- [x] AC-F1: `MyStablePage.tsx` now calls `useUserCompetitionStats(user.id)` and derives `competitionsEntered` / `firstPlaceFinishes` from `totalCompetitions` / `totalWins`.
- [x] AC-F2: Hall of Fame parallel-fetches per-horse history via `useQueries` + `fetchHorseCompetitionHistory`; populates `career.competitions` / `career.wins` from real `statistics.totalCompetitions` / `statistics.wins`.
- [x] AC-F3: Loading / empty / error states preserved (existing `isLoading` gate + empty-retired-horse messaging); zero-fallback while hook is pending is explicitly real data, not a mock.
- [x] AC-F4: `grep -n "competitions: 0, wins: 0" frontend/src/pages/MyStablePage.tsx` → 0 matches.
- [x] AC-F5: `grep -nE "competitionsEntered: 0|firstPlaceFinishes: 0" frontend/src/pages/MyStablePage.tsx` → 0 matches.
- [x] AC-F6: `frontend/src/pages/__tests__/MyStablePage.careerStats.test.tsx` — 3 vitest cases covering populated stats from user-competition-stats, zero-state, and Hall of Fame per-horse career population. All passing.

### Doc

- [x] AC-D1: Truth-table row for `/my-stable` updated with the two new endpoints and a Corrected-2026-04-20 note referencing this story.

## Tasks/Subtasks

- [x] **Task 1 (RED)**: Backend integration test for GET /api/users/:userId/competition-stats — created `competitionStatsRoutes.integration.test.mjs`; initial run: 1 failed with 404 + 1 auth-guard pass.
- [x] **Task 2 (RED)**: Backend integration test for GET /api/horses/:horseId/competition-history — created `competitionHistoryRoutes.integration.test.mjs`; initial run: 3 failed with 404 + 1 auth-guard pass.
- [x] **Task 3 (GREEN)**: Implemented `getUserCompetitionStats` + placement parser helper in `userController.mjs`.
- [x] **Task 4 (GREEN)**: Implemented `getHorseCompetitionHistory` + local `parseCompetitionPlacement` helper in `horseController.mjs`.
- [x] **Task 5 (GREEN)**: Registered both routes with auth + validation + ownership; imports added.
- [x] **Task 6 (RED+GREEN)**: Frontend vitest suite — 3/3 passing after lint auto-format.
- [x] **Task 7 (GREEN)**: MyStablePage wired — replaced hardcoded zeros with `useUserCompetitionStats` + `useQueries`/`fetchHorseCompetitionHistory`.
- [x] **Task 8 (REFACTOR)**: Backend lint fixed pre-existing indentation nits via `--fix`; frontend lint auto-fixed prettier violations. Re-ran backend 6/6 + frontend 3/3 after lint — still green.
- [x] **Task 9 (DOC)**: Truth table updated.

## Verification

```bash
# Backend
curl -H "Cookie: <session>" http://localhost:3001/api/users/<userId>/competition-stats
curl -H "Cookie: <session>" http://localhost:3001/api/horses/<horseId>/competition-history

# Grep checks (should be 0 matches)
grep -n "competitions: 0, wins: 0" frontend/src/pages/MyStablePage.tsx
grep -n "competitionsEntered: 0\|firstPlaceFinishes: 0" frontend/src/pages/MyStablePage.tsx
```

## Out of Scope

- Epic 29 Player Profile redesign.
- Pagination on Hall of Fame (defer until > 50 retired horses becomes realistic).
- Backfilling historical `CompetitionResult.xpGained` / `bestPlacement` if the field isn't present yet — controller falls back to sensible defaults.

## Dev Agent Record

### Completion Notes

- **Discovered scope expansion on Day 1:** frontend hooks `useUserCompetitionStats` and `useHorseCompetitionHistory` were already coded, but both backend endpoints were unregistered (same pattern as 21S-1). Story scope expanded to land both endpoints + the frontend wiring together.
- `getUserCompetitionStats` response builds `recentCompetitions` from the 5 most recent `CompetitionResult`s in descending `runDate`. `mostSuccessfulDiscipline` uses count-by-discipline with an alphabetical tie-break.
- `getHorseCompetitionHistory` enforces ownership via `requireOwnership('horse', { idParam: 'horseId' })` — the idParam override matters because the default is `id` and the route uses `:horseId`.
- `parseCompetitionPlacement` duplicated across both controllers intentionally — extracting to a shared util can land in a follow-up refactor once a third consumer shows up.
- `competitionsEntered: 0` and `career.competitions: 0` fall through to zero only while the React Query hook is pending. Once resolved, they reflect real backend data, so grep-check semantic holds.
- `xpGained` / `totalXpGained` / `totalParticipants` return 0 in the response shape — the underlying data model doesn't track these yet, and the frontend types are permissive. Adding real values is out of scope for this story.

### Verification Evidence

```bash
# Backend integration (RED → GREEN)
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand \
  modules/users/__tests__/competitionStatsRoutes.integration.test.mjs \
  modules/horses/__tests__/competitionHistoryRoutes.integration.test.mjs
# → 2 suites, 6 tests passed

# Frontend vitest
./node_modules/.bin/vitest run src/pages/__tests__/MyStablePage.careerStats.test.tsx
# → 1 file, 3 tests passed

# Lint
cd backend && ./node_modules/.bin/eslint modules/users/... modules/horses/...
cd frontend && npx eslint src/pages/MyStablePage.tsx src/pages/__tests__/MyStablePage.careerStats.test.tsx
# → 0 errors on both

# Grep gates
grep -n "competitions: 0, wins: 0" frontend/src/pages/MyStablePage.tsx             # → 0 matches
grep -nE "competitionsEntered: 0|firstPlaceFinishes: 0" frontend/src/pages/MyStablePage.tsx  # → 0 matches
```

## File List

**Added:**
- `backend/modules/users/__tests__/competitionStatsRoutes.integration.test.mjs`
- `backend/modules/horses/__tests__/competitionHistoryRoutes.integration.test.mjs`
- `frontend/src/pages/__tests__/MyStablePage.careerStats.test.tsx`

**Modified:**
- `backend/modules/users/controllers/userController.mjs` — added `getUserCompetitionStats` + `placementToNumber` helper
- `backend/modules/users/routes/userRoutes.mjs` — import + `GET /:userId/competition-stats` route
- `backend/modules/horses/controllers/horseController.mjs` — added `getHorseCompetitionHistory` + `parseCompetitionPlacement` helper
- `backend/modules/horses/routes/horseRoutes.mjs` — import + `GET /:horseId/competition-history` route with ownership guard
- `frontend/src/pages/MyStablePage.tsx` — replaced hardcoded zeros with `useUserCompetitionStats` and per-horse `useQueries` fetching real competition history
- `docs/beta-route-truth-table.md` — `/my-stable` row updated (new endpoints in Required APIs, Corrected-2026-04-20 note, follow-up column shows `21S-4, 21R-3`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `21s-4-wire-my-stable-career-stats-to-real-apis` → `done`

## Change Log

| Date       | Author    | Change                                                                                                                                                                                                            |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | Dev Agent | Discovered missing backend endpoints. Landed two new route handlers + integration tests (6/6) + MyStablePage wiring + 3/3 focused vitest + lint clean + truth-table update.                                       |
