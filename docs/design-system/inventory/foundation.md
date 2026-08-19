# Foundation Implementation Inventory

**Load only when:** changing shared shell, global navigation, scene backgrounds,
layout/UI primitives, or design-audit infrastructure.

## Purpose and authority

This file maps the shared frontend foundation so migration work begins in the
right place. It records what exists; it does not make existing components the
approved shape of every route. `PRODUCT.md`, `DESIGN.md`, and
`../DECISIONS.md` govern the result.

## Current implementation map

- Shell and navigation: `frontend/src/components/layout/DashboardLayout.tsx`,
  `NavPanel.tsx`, and related layout components.
- Scene composition: `PageBackground.tsx` and `ArtStage.tsx`.
- Layout helpers: `PageContainer.tsx`, `PageHeader.tsx`, `EntityHeader.tsx`,
  and the narrowly allow-listed `PageHero.tsx`.
- Shared UI: `frontend/src/components/ui/`, including `Surface`, buttons,
  form/state primitives, `CanonicalTabs`, and `GameDialog`.
- Tokens and utilities: `frontend/src/styles/tokens.css`, shared style sheets,
  and Tailwind configuration.
- Enforcement: `scripts/design-audit/check-design-system.mjs`,
  `scripts/design-audit/baseline.json`, and `../EXCEPTIONS.md`.

## Binding interpretation

- `DashboardLayout` and its sidebar/mobile navigation are legacy migration
  state, not an approved final app shell.
- `PageContainer`, header primitives, `CanonicalTabs`, `Surface`, and
  `GameDialog` provide reusable behavior. Their existence does not authorize
  `header → tabs → cards → modal` as a route template.
- Native semantic HTML is preferred when it provides the required behavior.
  Do not add shadcn, Radix, Sonner, Recharts, Chart.js, or substitute premade
  UI/notification/chart kits without an explicit owner decision.
- Shared accessibility belongs in primitives; route silhouette, hierarchy,
  atmosphere, and event choreography remain route-specific.
- A new shared primitive requires evidence that behavior truly repeats. Visual
  similarity alone is not sufficient.

## Active cleanup concerns

Use the live audit report before naming residue. Its `fixed-overlay` baseline
includes both legitimate pattern owners (`GameDialog`, full-screen art/loading
layers) and migration candidates such as hand-rolled celebration or picker
overlays. Classify behavior before replacing it; an authored game moment is not
automatically an ordinary dialog.

The existing shell needs owner-reviewed replacement direction. Foundation work
may improve correctness, accessibility, and debt without silently selecting a
new generic app shell.

## Verification

```bash
node scripts/design-audit/check-design-system.mjs --report
bash scripts/doctrine-checks/run-all.sh
```
