# Story 21S-4: Wire `/my-stable` Career Stats to Real Competition APIs

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change C / Finding P0-6
**Owner:** FrontendSpecialistAgent

## Problem

`/my-stable` is classified `beta-live`, but `frontend/src/pages/MyStablePage.tsx:272-311` hardcodes every career and stable statistic to zero:

```ts
career: { competitions: 0, wins: 0, earnings: <real> }
stats: {
  totalHorses: <real>, activeRacers: <real>,
  competitionsEntered: 0,
  firstPlaceFinishes: 0,
  totalEarnings: <real>, breedingPairs: <real>,
}
```

Backend already exposes:

- `GET /api/users/:userId/competition-stats`
- `GET /api/horses/:horseId/competition-history`

Neither is called from the page. This is mock-by-another-name: a tester sees 0 wins, 0 competitions regardless of reality.

## Acceptance Criteria

- [ ] For each retired horse (age ≥ 21), fetch `GET /api/horses/:horseId/competition-history` (prefer existing `useHorseCompetitionHistory` hook) and populate `career.competitions` and `career.wins` with real values.
- [ ] For stable stats, fetch `GET /api/users/:userId/competition-stats` and populate `competitionsEntered`, `firstPlaceFinishes`, and optionally verify `totalEarnings` matches server aggregation.
- [ ] Loading, empty, and error states rendered using existing page patterns.
- [ ] Parallel fetching for Hall of Fame career data — do not N+1 serialize on first paint.
- [ ] Tests under `frontend/src/pages/__tests__/MyStablePage.test.tsx` covering:
  - loading skeleton visible before data arrives
  - empty state when no retired horses
  - populated state where career numbers match the mocked API response (mocked at the React Query level, not at the API-client level)
  - error state when either endpoint fails

## Verification

- [ ] Manual beta test: navigate to `/my-stable` with a tester account that has non-zero competition history — every stat renders a non-zero value.
- [ ] `grep -n "competitions: 0, wins: 0" frontend/src/pages/MyStablePage.tsx` returns 0 matches.
- [ ] `grep -n "competitionsEntered: 0\|firstPlaceFinishes: 0" frontend/src/pages/MyStablePage.tsx` returns 0 matches.

## Out of Scope

- Epic 29 (Player Profile redesign) — this story is the wiring fix only.
- Pagination on Hall of Fame — defer to a later story if > 50 retired horses.
