# Story 21S-7: Delete Dead Code `MultiHorseComparison.tsx`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P1
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change F / Finding P1-8
**Owner:** FrontendSpecialistAgent

## Problem

`frontend/src/components/MultiHorseComparison.tsx:222-234` contains three buttons (`exportToPDF`, `exportToCSV`, `saveComparison`) whose `onClick` handlers only call `console.log(...)`. The component is not imported anywhere (`grep -rn "MultiHorseComparison" frontend/src --include=*.tsx --include=*.ts` returns only the file itself). Dead code with permanent placeholder actions.

## Acceptance Criteria

- [ ] Delete `frontend/src/components/MultiHorseComparison.tsx`.
- [ ] Delete any colocated test file or story for the component.
- [ ] Remove any index re-exports.
- [ ] `npm --prefix frontend run typecheck` passes.
- [ ] `npm --prefix frontend run lint` passes.
- [ ] Full frontend test suite still passes.

## Verification

```bash
find frontend -name "MultiHorseComparison*"
# Expected: no matches
```

## Out of Scope

- Building a real multi-horse comparison feature — if desired, create a new story with proper requirements rather than reviving the dead component.
