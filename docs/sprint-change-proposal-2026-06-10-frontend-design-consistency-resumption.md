# Sprint Change Proposal — Frontend Design Consistency Program Resumption

**Date:** 2026-06-10
**Workflow:** bmad-correct-course
**Trigger:** Adversarial review (codex review-adversarial-general) of the prior session's execution of `docs/frontend-design-consistency-remediation-plan.md` found the repository-wide migration incomplete. Findings and the corrected execution plan are recorded in `docs/frontend-design-consistency-remaining-work-handoff.md`.
**Epic:** `Equoria-o5hub` (IN_PROGRESS, 9/28 children complete at review time)

---

## 1. Issue Summary

The previous execution built the canonical primitives (PageContainer, PageHeader/EntityHeader, Surface, semantic tokens, Button/IconButton, form controls + FormField, canonical tabs, GameDialog, Currency, async-state primitives, AuthLayout) and verified them with focused tests — but stopped at "primitive + pilot" slices. The application still runs two design systems in parallel:

- 31 of 40 page files still reference `PageHero`; only 4 use `PageContainer`.
- 82 raw `<button>` occurrences in pages; 31 page-local `fixed inset-0` overlays; 4 `window.confirm()`.
- 344 direct palette/text-opacity matches in pages; 41 unsupported outer-width patterns; 43 unsupported radii; 41 direct blur declarations.
- Canonical `Currency` has one consumer; `Surface` has zero page consumers.
- Baseline screenshots (`Equoria-o5hub.1`) were skipped despite being a plan prerequisite.
- Known defects exist in canonical primitives themselves (header `truncate`, Button pending-state override, asChild+pending anchor navigation).

Root cause (per the handoff §3): primitive completion was confused with program completion; migration issues lacked file-complete gates; no enforcement ratchet existed during migration; inventories went stale.

## 2. Impact Analysis

- **Epic impact:** `Equoria-o5hub` remains open. Child issues `.11`, `.12`, `.13` are in progress with documented remaining-consumer scope; `.1`, `.4`, `.5`, `.8`, `.9`, `.17`–`.26`, `.28` are open.
- **Story impact:** No new stories needed — the handoff maps cleanly onto the existing child issues. Defect fixes to already-closed foundations (`.3` headers, `.10` button) are net-new work and get a fresh child issue rather than reopening closed ones.
- **Artifact conflicts:** `docs/design-system/inventory/*` describe pre-migration state and must be updated per family migration. `DECISIONS.md` remains the source of truth; two items (#8 dialog policy — resolved to GameDialog; #10 stable naming) stay user-ratifiable.
- **Technical impact:** Frontend only. No schema, backend, or deployment changes.

## 3. Recommended Approach

**Direct Adjustment** — adopt `docs/frontend-design-consistency-remaining-work-handoff.md` as the plan-of-record for the remainder of `Equoria-o5hub`, with its Stage A → B → C execution order and its Agent Operating Contract (§4) governing every slice:

1. **Stage A** — restore trustworthy prerequisites: fix canonical primitive defects (headers, Button pending), finish `.11` tabs / `.12` forms / `.13` dialogs from their remaining-consumer lists, implement `.8` typography+IconBox, `.9` motion policy, `.5` bottom surfaces, capture `.1` baseline screenshots.
2. **Stage B** — page-family migrations `.17` → `.18` → `.19` → `.20` → `.21` → `.22` using the §7 template (inventory → migrate → residue scan → evidence → bd notes).
3. **Stage C** — enforcement ratchet + legacy deletion under `.23`; epic closes only when the Global Definition of Done (§18) holds.

Completion criteria per issue: behavioral + build + visual + residue evidence (§4.6). Issues stay open while any declared consumer remains. Anything discovered out of scope is filed as a new bd issue immediately (CLAUDE.md Principle 5 deferral channel).

## 4. Detailed Change Proposals

- **New child issue:** "Stage A primitive defect fixes" covering: (a) remove h1 `truncate` from PageHeader/EntityHeader in favor of safe wrapping; (b) make Button `pending` always win over caller props and give `asChild pending` real behavioral prevention (aria-disabled + click/keyboard suppression); (c) IconButton inherits the contract. Tests for each.
- **No text changes to existing child issues** — their descriptions already match the handoff scope; bd notes already carry remaining-consumer lists.
- **DECISIONS.md** — unchanged; agent-adopted decisions remain flagged for user ratification.

## 5. Implementation Handoff

- **Scope classification:** Moderate (backlog already organized; execution is multi-session).
- **Route:** development (this session, continuing autonomously per user goal directive) working child issues in Stage order, one slice per commit, pushed same-session per Constitution §1/§5.
- **Success criteria:** handoff §18 Global Definition of Done; per-issue closure gates as written in handoff §6–§16. Closure of bd issues is recommended-with-evidence; the user retains final closure authority (Constitution §6).
