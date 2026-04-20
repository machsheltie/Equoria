# Story 21S-7: Delete Dead Code `MultiHorseComparison.tsx`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P1
**Status:** done
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change F / Finding P1-8
**Owner:** FrontendSpecialistAgent

## Problem

`frontend/src/components/MultiHorseComparison.tsx` contained three buttons (`exportToPDF`, `exportToCSV`, `saveComparison`) whose `onClick` handlers only invoked `console.log(...)`. The component had **zero importers** elsewhere in the codebase — dead code with permanent placeholder actions.

## Acceptance Criteria

- [x] AC-1: Delete `frontend/src/components/MultiHorseComparison.tsx`.
- [x] AC-2: Delete the colocated test file `frontend/src/components/__tests__/MultiHorseComparison.test.tsx` (it didn't import the production file — it defined its own mock component in-test — so it was doubly orphaned).
- [x] AC-3: `npm --prefix frontend run typecheck` passes after deletion (`npx tsc --noEmit` runs clean).
- [x] AC-4: `npx eslint src/components/` introduces no new MultiHorseComparison-related errors.
- [x] AC-5: `find frontend -name "MultiHorseComparison*"` returns no matches.

## Verification

```bash
find frontend -name "MultiHorseComparison*"
# → no matches

cd frontend && npx tsc --noEmit
# → clean (no broken imports anywhere)

grep -rn "MultiHorseComparison" frontend/src
# → no matches
```

## Dev Agent Record

### Completion Notes

- The test file defined its own mock `MultiHorseComparison` component inline (line 29 of the test); it never imported the production file. Deleting both left a clean hole — no dangling references.
- The three `console.log` export-stub buttons lived in dead code for months. Removing them also removes their future lint noise.
- `npx tsc --noEmit` is the authoritative check: if anything still needed the component, the typecheck would have failed. It didn't.

## File List

**Deleted:**
- `frontend/src/components/MultiHorseComparison.tsx` (883 lines of unused UI + 3 console.log stubs)
- `frontend/src/components/__tests__/MultiHorseComparison.test.tsx` (~350 lines of tests against an inline mock)

**Modified:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `21s-7` → `done`

## Change Log

| Date       | Author    | Change                                                                                                                               |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-04-20 | Dev Agent | Deleted dead `MultiHorseComparison.tsx` (zero importers) and its orphaned colocated test. Typecheck clean; no regressions elsewhere. |

## Out of Scope

- Building a real multi-horse comparison feature — if that's wanted, a new story should spec requirements. The dead code should not come back.
