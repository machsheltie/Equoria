# Story 21S-11: Scrub "Hide / Defer / Read-Only" Language from `beta-route-truth-table.md`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P2
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change J / Finding P2-12
**Owner:** LeadArchitect / Docs

## Problem

`docs/beta-route-truth-table.md` still contains sentences that describe routes as "cannot be beta-live", "must still be verified", or similar hedging language while the same row is classified `beta-live`. The 2026-04-14 Change F began this scrub; this story finishes it so future agents cannot use the doc to justify deferring or hiding exposed beta-live behavior.

## Acceptance Criteria

For every row classified `beta-live`:

- [ ] The "Known Blockers" cell must state either:
  - "None — verified by <story-id> / <spec file>", OR
  - "Tracked by <specific story ID>" that references a concrete implementation task that will close the gap.
- [ ] Remove language like "cannot be beta-live", "hide write actions", "beta-excluded", "do not advertise persistence in beta", "read-only substitute".
- [ ] Routes that the product team legitimately wants out of beta scope must be explicitly removed from `BETA_SCOPE` in `frontend/src/config/betaRouteScope.ts` and from the truth table — not left labelled `beta-live` with hedged notes.
- [ ] Row for `/leaderboards` updated (close when Story 21S-1 lands).
- [ ] Row for `/settings` updated (close when Story 21S-5 lands).
- [ ] Row for `/my-stable` updated (close when Story 21S-4 lands).
- [ ] Policy block at top of the doc adds: "If a route's gap cannot be closed before beta, it must be removed from `BETA_SCOPE`. Leaving a row `beta-live` with hedged notes is prohibited."

## Verification

```powershell
rg -n "cannot be beta-live|beta-excluded|hide write|read-only substitute|do not advertise persistence" docs/beta-route-truth-table.md
# Expected: 0 matches
```

## Dependencies

- Stories 21S-1, 21S-4, 21S-5 must land before their rows can be truthfully updated. This story closes **after** those three.

## Out of Scope

- Restructuring the table format.
