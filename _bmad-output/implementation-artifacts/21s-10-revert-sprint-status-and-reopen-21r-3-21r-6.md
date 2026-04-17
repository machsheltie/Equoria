# Story 21S-10: Revert Sprint Status to Blocked and Reopen 21R-3 / 21R-6

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P2 (administrative; must complete before beta deploy)
**Status:** done-on-creation (handled by this correct-course pass — see note)
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change I / Finding P2-11
**Owner:** LeadArchitect / ScrumMaster

## Problem

`_bmad-output/implementation-artifacts/sprint-status.yaml` claims:

- `beta-deployment-readiness: ready-for-signoff`
- `21r-3-remove-e2e-skips-and-test-only-bypasses-from-beta-critical-flows: done`
- `21r-6-add-beta-deployment-readiness-gate: done`
- `epic-21r: in-progress` (correct, since the work is not truly complete)

None of the three `done` claims survive contact with the code. Readiness must revert to blocked, and the two stories reopen.

## Acceptance Criteria

- [x] `beta-deployment-readiness: blocked` with inline note `Re-blocked 2026-04-16 — adversarial review found incomplete 21R-3 and 21R-6; Epic 21S opened to close gaps.`
- [x] `21r-3-remove-e2e-skips-and-test-only-bypasses-from-beta-critical-flows: in-progress` (reopened; will transition back to `done` when Story 21S-2 verification passes).
- [x] `21r-6-add-beta-deployment-readiness-gate: in-progress` (reopened; closes when Story 21S-6 verification passes).
- [x] New block for Epic 21S added with all 11 stories listed.
- [x] `last_updated` and header comment updated to 2026-04-16.

## Status Note

This story is administrative and was executed as part of the correct-course workflow (`/bmad-correct-course`) that created the rest of Epic 21S. Marked `done` immediately upon creation. Verification is in `sprint-status.yaml` itself.

## Verification

```bash
grep "beta-deployment-readiness" _bmad-output/implementation-artifacts/sprint-status.yaml
# Expected: blocked

grep -E "21r-3-|21r-6-" _bmad-output/implementation-artifacts/sprint-status.yaml
# Expected: in-progress for both
```

## Out of Scope

- Changes to other epic/story statuses.
