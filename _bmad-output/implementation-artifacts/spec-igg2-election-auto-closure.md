---
title: 'igg2: Election auto-closure via read-time status resolution'
type: 'bugfix'
created: '2026-05-13'
status: 'done'
baseline_commit: 'f6e5d4fd7fd2a3aa33a738addb0d2c3b1123cdae'
context:
  - '.claude/rules/EDGE_CASE_FIX_DISCIPLINE.md'
  - '.claude/rules/OPTIMAL_FIX_DISCIPLINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `ClubElection.status` is set once at creation and never updated — elections remain `open` indefinitely past `endsAt`, allowing members to cast votes after the deadline. The `upcoming → open` transition is equally broken: elections with `startsAt` in the past stay `upcoming` forever.

**Approach:** Add a `resolveElectionStatus(election)` pure helper that derives the effective status from `startsAt`/`endsAt` at read time without writing to the DB. Apply it to all read and write paths in `clubController.mjs`.

## Boundaries & Constraints

**Always:**
- No Prisma writes to `status` — status is resolved dynamically at read time, DB value is the base state only.
- Guard logic in `nominate` and `vote` must use the resolved status, not `election.status`.
- `resolveElectionStatus` must respect a manually-closed election (`status === 'closed'` → always `closed`, even if `endsAt` is in the future).
- All tests use the real DB (no mocks of Prisma, per project doctrine).
- Tests must prove the sentinel: an election past `endsAt` must reject votes (400) — not just that a valid vote succeeds.

**Ask First:**
- If schema lacks `startsAt`/`endsAt` on elections returned by existing Prisma selects, a field addition to the select is needed — confirm before any schema-level change.

**Never:**
- No cron jobs, no background workers, no DB status migration.
- No `test.skip`, no bypass headers.
- Do not change the `ElectionStatus` enum or add new enum values.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Active election | `startsAt` < now, `endsAt` > now, `status = open` | Resolved status: `open`; vote/nominate accepted | — |
| Upcoming auto-opens | `startsAt` < now, `endsAt` > now, `status = upcoming` | Resolved status: `open`; vote now accepted | — |
| Election expired | `startsAt` < now, `endsAt` < now, `status = open` | Resolved status: `closed`; vote returns 400 | `{ success: false, message: 'Election is not open' }` |
| Manually closed | `status = closed`, `endsAt` > now | Resolved status: `closed`; vote returns 400 | `{ success: false, message: 'Election is not open' }` |
| Upcoming not yet started | `startsAt` > now, `endsAt` > now, `status = upcoming` | Resolved status: `upcoming`; vote returns 400 | `{ success: false, message: 'Election is not open' }` |
| `getElections` read | Mixed elections in DB | Each election in response has resolved `status` | — |
| `getElectionResults` read | Expired election | Returns results with resolved `status: 'closed'` | — |
| Nominate in expired | `endsAt` < now, `status = open` | 400 — election is closed | `{ success: false, message: 'Election is closed' }` |

</frozen-after-approval>

## Code Map

- `backend/modules/community/controllers/clubController.mjs` — single-file controller with all election logic; add helper + update 5 functions
- `backend/modules/community/__tests__/clubController.test.mjs` — real-DB integration tests (799 lines); add sentinel tests for expired/auto-open paths
- `packages/database/prisma/schema.prisma` — confirms `startsAt`, `endsAt` fields on `ClubElection`; read-only reference

## Tasks & Acceptance

**Execution:**
- [x] `backend/modules/community/controllers/clubController.mjs` -- Add `resolveElectionStatus(election)` pure helper above `createElection`. Logic: if `status === 'closed'` → `'closed'`; else if `endsAt < now` → `'closed'`; else if `startsAt <= now` → `'open'`; else → `'upcoming'`. Ensure `startsAt` and `endsAt` are included in any Prisma `select` that feeds this helper.
- [x] `backend/modules/community/controllers/clubController.mjs` -- Update `getElections`: map each returned election through `resolveElectionStatus` so the `status` field in the response reflects the resolved value.
- [x] `backend/modules/community/controllers/clubController.mjs` -- Update `getElectionResults`: return resolved status alongside results.
- [x] `backend/modules/community/controllers/clubController.mjs` -- Update `nominate`: replace `election.status === 'closed'` guard with `resolveElectionStatus(election) === 'closed'`.
- [x] `backend/modules/community/controllers/clubController.mjs` -- Update `vote`: replace `election.status !== 'open'` guard with `resolveElectionStatus(election) !== 'open'`.
- [x] `backend/modules/community/__tests__/clubController.test.mjs` -- Add sentinel tests: (1) `vote` on expired election returns 400; (2) `vote` on auto-opened election (upcoming + startsAt past) returns 201; (3) `nominate` on expired election returns 400; (4) `getElections` returns `closed` for expired, `open` for auto-opened; (5) `getElectionResults` returns resolved status.

**Acceptance Criteria:**
- Given an election where `endsAt` is in the past and `status = open`, when a member POSTs to vote, then the response is 400 with message `'Election is not open'`.
- Given an election where `startsAt` is in the past, `endsAt` is in the future, and `status = upcoming`, when a member POSTs to vote, then the response is 201 (vote accepted — auto-opened).
- Given an election where `endsAt` is in the past, when `GET /api/clubs/:id/elections` is called, then the returned election has `status: 'closed'`.
- Given a manually-closed election (`status = closed` in DB) with `endsAt` in the future, when `GET /api/clubs/:id/elections` is called, then `status` is still `'closed'`.
- Given an election where `endsAt` is in the past, when a member POSTs to nominate, then the response is 400.
- All 5 sentinel tests pass; no existing tests broken.

## Design Notes

`resolveElectionStatus` reads `election.startsAt` and `election.endsAt` — both must be present in every Prisma select that feeds it. The Prisma selects in `getElections`, `getElectionResults`, `nominate`, and `vote` currently use `select` objects; verify each includes `startsAt` and `endsAt` before applying the helper. If any select omits them, add the fields to that select only (no schema change required — they already exist on the model).

The helper is a pure function (no DB calls, no side effects) — safe to call multiple times, easy to unit-test, and does not risk N+1 issues.

## Verification

**Commands:**
- `cd backend && node --experimental-vm-modules node_modules/.bin/jest modules/community/__tests__/clubController.test.mjs --no-coverage 2>&1` -- expected: all tests pass including new sentinel tests
- `cd backend && npx eslint modules/community/controllers/clubController.mjs` -- expected: no errors

## Spec Change Log

### 2026-05-13 — review patch applied

**Change:** `resolveElectionStatus` boundary condition tightened: `election.endsAt < now` → `election.endsAt <= now`.

**Reason:** At the exact closing instant (`endsAt === now`), the original `<` comparison returned `'open'` rather than `'closed'`, allowing votes to be cast on the closing millisecond. The `<=` fix closes that 1-ms window so the election is immediately `closed` at `endsAt`.

**Impact:** No test changes required — sentinel tests already covered the expired case with `endsAt` set well in the past. No schema or Prisma changes.

## Suggested Review Order

**Core logic**

- Pure helper; understand this first — determines resolved status for every read path
  [`clubController.mjs:189`](../../backend/modules/community/controllers/clubController.mjs#L189)

- `getElections` mapping: raw elections shaped through helper so list response carries resolved status
  [`clubController.mjs:177`](../../backend/modules/community/controllers/clubController.mjs#L177)

- `nominate` guard: uses `resolveElectionStatus` instead of raw `election.status`; fixes expired-nomination gap
  [`clubController.mjs:248`](../../backend/modules/community/controllers/clubController.mjs#L248)

- `vote` guard: `!== 'open'` now correctly rejects both expired and not-yet-started elections
  [`clubController.mjs:291`](../../backend/modules/community/controllers/clubController.mjs#L291)

- `getElectionResults`: resolved status spread into returned election object for consistency
  [`clubController.mjs:348`](../../backend/modules/community/controllers/clubController.mjs#L348)

**Sentinel tests**

- `getElections` expired + auto-open sentinels: verify resolved status surfaced in list endpoint
  [`clubController.test.mjs:387`](../../backend/modules/community/__tests__/clubController.test.mjs#L387)

- `nominate` expired sentinel: confirms closed guard fires on time-expired elections
  [`clubController.test.mjs:542`](../../backend/modules/community/__tests__/clubController.test.mjs#L542)

- `vote` expired + auto-open sentinels: primary correctness sentinels for the bug fix
  [`clubController.test.mjs:606`](../../backend/modules/community/__tests__/clubController.test.mjs#L606)

- `getElectionResults` expired sentinel: verifies resolved status in results endpoint response
  [`clubController.test.mjs:765`](../../backend/modules/community/__tests__/clubController.test.mjs#L765)
