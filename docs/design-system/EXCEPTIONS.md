# Design-System Exception Registry (Equoria-o5hub.23, handoff §16.2)

Explicit, owned, **expiring** exceptions to the design-system source audit
(`scripts/design-audit/check-design-system.mjs`). A matching unexpired row
excludes its matches from the audit counts; an **expired row fails the audit
outright** — renew it consciously or fix the code.

Rule ids: `palette-classes`, `text-opacity`, `unsupported-radius`,
`page-local-blur`, `outer-width-wrapper`, `fixed-overlay`, `window-confirm`,
`deprecated-imports`, `usd-game-currency`, `pagehero-allowlist`.

| rule-id         | file-or-glob    | owner       | justification                                                           | expiry     |
| --------------- | --------------- | ----------- | ----------------------------------------------------------------------- | ---------- |
| palette-classes | pages/Index.tsx | machsheltie | Landing page bespoke art direction; migrates with the final polish pass | 2026-08-01 |

<!-- Add rows above. file-or-glob is relative to frontend/src and supports * and **. -->
