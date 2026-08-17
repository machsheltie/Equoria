# Community Hub Stats — Gap Manifest (Equoria-r4cyk)

**Date:** 2026-08-17
**Scope:** every fabricated value/badge that was on `frontend/src/pages/CommunityPage.tsx`
**Ruling implemented:** wire real data and build backend endpoints where needed; anything
that cannot be wired because the underlying content/feature/data does not exist is
catalogued here for the user to generate content against.

## Result summary

**Zero hard gaps.** Every fabricated surface on the community hub was wireable to real
data — either through an existing endpoint, a newly built community-module endpoint, or
by reusing MyStablePage's real Hall of Fame queries. Nothing had to be removed for lack
of underlying data, and no "coming soon" surface was invented.

## Inventory and disposition

| #   | Surface (pre-fix location)                                                  | Was                                                                         | Disposition                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Message Board card — "Sections: 5" (`CommunityPage.tsx:75`)                 | Hardcoded `'5'` literal                                                     | **Wired to config** — `FORUM_SECTIONS.length` from `frontend/src/lib/api/forum.ts`, mirroring backend `VALID_SECTIONS` (`forumRoutes.mjs`). Static app config, not fetched data. |
| 2   | Message Board card — "Active threads" (`:76`)                               | `total > 0 ? total : '…'` (loading/zero/error conflation)                   | **Wired-existing** — `useThreads()` total, four-state rendered (skeleton / error "—" + retry / real value incl. 0).                                                              |
| 3   | Clubs card — "Discipline clubs" / "Breed clubs" (`:87–88`)                  | Same ellipsis-on-zero conflation                                            | **Wired-existing** — `useClubs()`, four-state rendered.                                                                                                                          |
| 4   | Clubs card — **"Elections open" badge** (`:90`)                             | Unconditional (always shown)                                                | **Endpoint built** — `GET /api/v1/clubs/elections/open-count`; badge renders only when the caller's clubs have ≥1 genuinely open election (success-gated).                       |
| 5   | Messages card — "Unread" (`:100`)                                           | Real query but `?? 0` fabricated a 0 during loading/error                   | **Wired-existing** — `useUnreadCount()`, four-state rendered.                                                                                                                    |
| 6   | Messages card — "Conversations" (`:101`)                                    | Permanent `'…'`, no query                                                   | **Endpoint built** — `GET /api/v1/messages/conversations-count` (distinct correspondents, either direction, deduplicated).                                                       |
| 7   | Hall of Fame card — "Inductees" (`:112`)                                    | Permanent `'…'`, no query                                                   | **Wired-existing** — count of the caller's retired horses (`ageYears >= 21`), identical definition to MyStablePage's Hall of Fame tab, via `useHorses()`.                        |
| 8   | Hall of Fame card — "Total wins" (`:113`)                                   | Permanent `'…'`, no query                                                   | **Wired-existing** — sum of the inductees' real career wins via the same per-horse `GET /api/v1/horses/:id/competition-history` queries (shared query keys with MyStablePage).   |
| 9   | Stats banner — Active Threads / Discipline Clubs / Breed Clubs (`:183–193`) | Ellipsis-on-zero conflation                                                 | **Wired-existing** — same four-state stats as #2/#3.                                                                                                                             |
| 10  | Activity feed section (`:220`)                                              | Failed fetch rendered the "community is quiet" empty state (error-as-empty) | **Wired-existing** — `useCommunityActivity()` error now renders `ErrorState` with a wired `refetch` retry.                                                                       |

## New endpoint contracts (built in this change)

### `GET /api/v1/messages/conversations-count` (auth required)

```json
{ "success": true, "data": { "count": 2 } }
```

`count` = number of distinct users the caller has exchanged at least one
`DirectMessage` with, in either direction. Sending to AND receiving from the same
user counts once. Implementation: `messageController.getConversationsCount`
(two `distinct` selects unioned in a Set). Registered before the `/:id` catch-all.

### `GET /api/v1/clubs/elections/open-count` (auth required)

```json
{ "success": true, "data": { "count": 1 } }
```

`count` = elections where the caller has a `ClubMembership` row AND the election is
genuinely open — `status != 'closed' AND startsAt <= now < endsAt` — the exact DB-side
mirror of `resolveElectionStatus()`. Implementation:
`clubController.getOpenElectionsCount`. Registered in the static `/elections/*` block.

## Definitional notes for the user (not gaps, but choices you may want to revisit)

1. **"Conversations" semantics.** The messages system has no threaded-conversation
   model (`DirectMessage` rows are flat inbox/sent). The stat is defined as _distinct
   correspondents_. If you later build true conversation threads, the endpoint contract
   above can be re-pointed at a `count of threads` without changing the frontend.
2. **Hall of Fame aggregation is client-side.** Inductees/wins reuse MyStablePage's
   real queries (1 horse-list fetch + one history fetch per retired horse, cached and
   shared). If stables grow large, a dedicated backend aggregate would be cleaner.
   Proposed contract for that future endpoint (NOT built — lives in `modules/horses`,
   outside this change's authorized scope):

   ```
   GET /api/v1/horses/hall-of-fame-summary   (auth)
   → { "success": true, "data": { "inductees": 3, "totalWins": 17 } }
   inductees = caller's horses with age >= 21 (horseAgePolicy retirement age)
   totalWins = SUM of those horses' 1st-place CompetitionResult rows
   ```
