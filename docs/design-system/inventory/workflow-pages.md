# Breeding, Training, and Competition Implementation Inventory

**Load only when:** changing Breeding, Training, Competition Browser,
Competition Results, Conformation Shows, or Leaderboards.

## Purpose and authority

This file maps active workflow-family migration concerns. It is subordinate to
`PRODUCT.md`, `DESIGN.md`, and `../DECISIONS.md`. Current headers, tabs,
dialogs, and charts are implementation facts, not approved route recipes.

## Experience guardrails

- Breeding is a pairing tableau: mare and stallion, family lines, inheritance,
  risk, and commitment belong in one comprehensible relationship.
- Training is time with a horse under an honest cooldown, not an optimization
  console.
- Competition begins as an arena program and entry journey; results culminate
  in placing, performance, and season story rather than analytics output.
- Leaderboards are public sporting records. They may be dense and scannable,
  but they must not resemble revenue rankings or business intelligence.
- Routine confirmation can use an accessible dialog. Podiums, championships,
  rare outcomes, and major rewards require authored game moments.

## Current implementation map

- Routed pages live in `frontend/src/pages/`; deeper breeding, training,
  competition, and leaderboard components live in their feature directories
  under `frontend/src/components/` and `frontend/src/pages/`.
- `CanonicalTabs`, `GameDialog`, `Currency`, and shared async/form primitives
  are present in existing flows. Reuse their behavior only where the route
  concept calls for it.

## Active cleanup concerns

`../EXCEPTIONS.md` grants temporary, non-renewing palette grace to legacy
rank-history, score-breakdown, radar, and color-prediction visualizations.
Those rows are migration deadlines, not approval for Recharts, Chart.js, a
generic chart silhouette, or literal palette reuse.

Before replacing a visualization, preserve the decision the player is making,
the exact data and uncertainty she needs, accessible non-color meaning, and a
downloadable/readable equivalent where appropriate. The owner must approve a
new presentation direction when it establishes a reusable visual pattern.

## Verification

```bash
node scripts/design-audit/check-design-system.mjs --report
npm run typecheck
```
