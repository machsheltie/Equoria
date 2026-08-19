# Design-System Exception Registry

Explicit, owned, **expiring** exceptions to the design-system source audit
(`scripts/design-audit/check-design-system.mjs`). A matching unexpired row
excludes its matches from the audit counts; an **expired row fails the audit
outright** — renew it consciously or fix the code.

**Authority:** Exceptions are subordinate to `PRODUCT.md`, `DESIGN.md`, and
`DECISIONS.md`. An exception may temporarily suppress a mechanically detected
violation; it cannot approve a rejected dependency, generic page structure, or
new design direction. “Existing code,” “the package is installed,” and
“industry standard” are not valid justifications.

The data-visualization rows below are **non-renewing migration grace through
2026-09-01**, not chart approval. Recharts, Chart.js, and SaaS-shaped analytics
remain rejected for player-facing use. Any row that still wants renewal must be
brought to the owner with the replacement design and a concrete reason.

Rule ids: `palette-classes`, `text-opacity`, `unsupported-radius`,
`page-local-blur`, `outer-width-wrapper`, `fixed-overlay`, `window-confirm`,
`deprecated-imports`, `usd-game-currency`, `pagehero-allowlist`.

| rule-id         | file-or-glob                                             | owner       | justification                                                                               | expiry     |
| --------------- | -------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- | ---------- |
| palette-classes | components/leaderboard/RankHistoryChart.tsx              | machsheltie | Non-renewing legacy chart palette; replace with an Equoria season/history presentation      | 2026-09-01 |
| palette-classes | components/competition/ScoreBreakdownChart.tsx           | machsheltie | Non-renewing legacy chart palette; replace with an Equoria results presentation             | 2026-09-01 |
| palette-classes | components/competition/ScoreBreakdownRadar.tsx           | machsheltie | Non-renewing legacy radar palette; replace with discipline-specific scoring presentation    | 2026-09-01 |
| palette-classes | components/breeding/ColorPredictionChart.tsx             | machsheltie | Temporary review of literal coat-color encoding; does not approve generic chart composition | 2026-09-01 |
| palette-classes | pages/horse-detail/genetics/GeneticOverviewCard.tsx      | machsheltie | Time-boxed raw tier palette; migrate to semantic tokens plus non-color meaning              | 2026-09-01 |
| palette-classes | pages/horse-detail/genetics/LineageSection.tsx           | machsheltie | Time-boxed lineage colors; migrate to a purpose-built family tree with non-color meaning    | 2026-09-01 |
| palette-classes | pages/horse-detail/genetics/TraitInteractionsSection.tsx | machsheltie | Time-boxed trait-class palette; migrate to semantic tokens plus icon/text meaning           | 2026-09-01 |
| palette-classes | pages/horse-detail/genetics/TraitTimelineSection.tsx     | machsheltie | Time-boxed timeline palette; migrate to semantic tokens plus readable phase labels          | 2026-09-01 |

<!-- Add rows above. file-or-glob is relative to frontend/src and supports * and **. -->
