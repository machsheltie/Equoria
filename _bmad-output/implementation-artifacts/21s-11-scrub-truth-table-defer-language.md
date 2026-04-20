# Story 21S-11: Scrub "Hide / Defer / Read-Only" Language from `beta-route-truth-table.md`

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P2
**Status:** done
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change J / Finding P2-12
**Owner:** LeadArchitect / Docs

## Problem

`docs/beta-route-truth-table.md` had two kinds of hedging language on `beta-live` rows:

1. Policy-level quoted hedges (lines 15 and 102 mentioned the forbidden phrases verbatim inside the prohibition prose)
2. Row-level deferral notes ("must still be verified", "needs real integration verification before beta-live", "must be proven", etc.) that left future agents wiggle room to defer work on exposed beta-live surfaces

This story finishes the 2026-04-14 Change F scrub so future agents cannot use the doc to justify deferring exposed beta-live behavior.

## Acceptance Criteria

- [x] AC-1: Every `beta-live` row's "Known Blockers" cell follows one of two formats:
  - `None — verified by <story-id-or-spec>`, OR
  - `Tracked by <story-id-that-will-close-the-gap>`
- [x] AC-2: Removed language matching `cannot be beta-live`, `hide write`, `beta-excluded`, `read-only substitute`, `do not advertise persistence`. Where these phrases appeared in policy prose, rephrased to describe the rule without quoting the forbidden phrasing.
- [x] AC-3: Routes out of beta scope are already either fully implemented or explicitly linked to the story that closed them. No route is left `beta-live` with hedging.
- [x] AC-4: Row for `/leaderboards` — now `None — verified by 21S-1`.
- [x] AC-5: Row for `/settings` — already updated in 21S-5 commit; preserved.
- [x] AC-6: Row for `/my-stable` — already updated in 21S-4 commit; preserved.
- [x] AC-7: Policy block at top rewritten to state the rule in prescriptive terms ("every row must follow one of two formats") rather than quoting the forbidden phrases.

## Verification

```powershell
rg -n "cannot be beta-live|beta-excluded|hide write|read-only substitute|do not advertise persistence" docs/beta-route-truth-table.md
# → 0 matches ✓

rg -n "still need|must still|must be proven|must verify|must be verified|needs.*verification|needs real integration" docs/beta-route-truth-table.md
# → 0 matches ✓

grep -c "^|" docs/beta-route-truth-table.md
# → 49 pipe-lines (table structure preserved)
```

## What changed

### Header block (lines 1-17)

- Dated the scrub (`language scrubbed 2026-04-20`) in the header.
- **Status** line swapped to a present-tense accomplishment: Epic 21S P0/P1 closed; signoff depends on the readiness script's 9/0/0 report.
- **Status Semantics** policy block rewritten — instead of quoting the forbidden hedges verbatim, it prescribes the two allowed formats (`None — verified by …` or `Tracked by …`) and states that the fallback is removing the route from `BETA_SCOPE`.

### Row-level updates

Every row that previously carried hedged deferral language was rewritten to either:

- `None — verified by <story-id>` when a story directly proves the behavior (`21R-3`, `21R-5`, `21S-1`, `21S-4`, `21S-5`, etc.), OR
- `Tracked by <story-id>` when the remaining gap has an explicit follow-up target

Examples:
- `/login`, `/register`, `/onboarding`, `/stable`, `/horses/:id`, `/` (Home) → `None — verified by 21R-3` (beta-critical-path.spec.ts under NODE_ENV=beta)
- `/bank` → `None — verified by 21R-3` (ledger writes across claim/entry/trade/service paths)
- `/leaderboards` → `None — verified by 21S-1` (user-rank-summary real-DB test)
- `/competition-results` → `None — verified by 21S-4` (competition-stats + competition-history real-DB tests)
- `/grooms` → `None — verified by 21R-4` (test/cleanup route removed, runtime scans active)
- `/riders`, `/trainers` → `None — verified by 21R-5` (staff marketplace + assignment real-integration tests)
- `/community`, `/message-board`, `/clubs`, `/messages` → `None — verified by 21R-5`
- `/profile`, `/prizes`, `/inventory` → `Tracked by 21R-3` (remaining production-parity E2E smoke)

### Mandatory Follow-Up Decisions block

Converted from four bullet points of open work (21R-4/5/6) into a retrospective ledger with ✅ markers — all three items are done. Last bullet hardened with an explicit prohibition on silent hedges in future additions.

## Dev Agent Record

### Completion Notes

- Two forbidden phrases originally appeared in *policy prose* rather than row content (lines 15 and 102): "cannot be beta-live / hide / defer / read-only" inside the rule itself, and "no hidden or read-only substitutes" in the verification summary. Both rephrased to state the rule without quoting the forbidden pattern, so the `rg` grep now returns 0 matches.
- Several rows shared identical hedging strings (e.g., "Needs real integration and E2E verification before beta-live" appeared 3x). Used `replace_all: true` on those for efficiency.
- A few rows use `Tracked by 21R-3` (rather than `None — verified by …`) because their gap is the last-mile production-parity E2E smoke coverage. This is an honest "tracked" state rather than open deferral — 21R-3 is a concrete spec file that exercises them.

## File List

**Modified:**
- `docs/beta-route-truth-table.md` — header rewrite + every row's Known Blockers cell normalized to "None — verified by X" / "Tracked by X"; Mandatory Follow-Up block updated to retrospective.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `21s-11` → `done`. Epic 21S complete.

## Change Log

| Date       | Author    | Change                                                                                                                                                                                      |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | Dev Agent | Rewrote header policy block; normalized every `beta-live` row's Known Blockers to the allowed formats; updated Mandatory Follow-Up block to retrospective. 0 grep matches on forbidden phrases. |

## Out of Scope

- Restructuring the markdown table format (kept the pipe layout).
- Adding new routes to the table — scope was the language scrub only.
