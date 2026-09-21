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

The data-visualization rows below were **non-renewing migration grace through
2026-09-01**, not chart approval. They expired, and on **2026-09-11 the owner
granted one dated extension** to 2026-10-23, naming the replacement for each —
which is what the sentence above requires of any row that still wants renewal.
Recorded plainly as a renewal rather than presented as anything else.

The extension buys build time; it approves nothing. Recharts, Chart.js, and
SaaS-shaped analytics remain rejected for player-facing use, and the named
successors are statements of intent, not finished direction: each one still
comes back to the owner before it is built. When a successor lands, delete its
row — do not re-date it. A second extension needs the owner again.

Rule ids: `palette-classes`, `text-opacity`, `unsupported-radius`,
`page-local-blur`, `outer-width-wrapper`, `fixed-overlay`, `window-confirm`,
`deprecated-imports`, `usd-game-currency`, `pagehero-allowlist`.

| rule-id | file-or-glob | owner | justification | expiry |
| ------- | ------------ | ----- | ------------- | ------ |

<!-- Add rows above. file-or-glob is relative to frontend/src and supports * and **. -->
