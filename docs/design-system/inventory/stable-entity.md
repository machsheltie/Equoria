# Stable and Horse-Identity Implementation Inventory

**Load only when:** changing Stable, horse/foal detail, horse equipment,
lineage, genetics, traits, care history, or horse identity presentation.

## Purpose and authority

This is an implementation and migration map for the game's emotional center.
It is subordinate to `PRODUCT.md`, `DESIGN.md`, and `../DECISIONS.md`.
Existing entity headers, tabs, cards, and data sections are not an approved
CRM-style horse template.

## Experience guardrail

The horse leads; the dossier supports her. Portrait, name, condition,
relationship, family, and current story establish identity before statistics.
Lineage, genotype, traits, training, care, and competition records remain
legible through structures that feel like bloodline, journal, record, or
stable life—not database inspection.

- Stable is an inhabited home and roster, not an index dashboard.
- Horse and foal pages may share accessible behavior without sharing a rigid
  `EntityHeader + KPI strip + thirteen tabs` silhouette.
- Genetics must preserve probability precision and non-color meaning while
  avoiding analytics-dashboard charts.
- Sale, retirement, breeding, naming, discovery, and achievement differ in
  emotional weight; do not give them identical modal choreography.

## Current implementation map

- Routed pages and focused sections live in `frontend/src/pages/`, especially
  `HorseDetailPage.tsx`, `FoalDetailPage.tsx`, `StableView.tsx`, and
  `pages/horse-detail/`.
- Reusable horse presentation lives under `frontend/src/components/horse/`
  and related feature directories.
- Shared headers, tabs, surfaces, and dialogs record current implementation;
  inspect their consumers before changing behavior.

## Active cleanup concerns

The horse-detail genetics files named in `../EXCEPTIONS.md` have temporary,
non-renewing palette grace. They require purpose-built lineage, trait, and
probability presentation with semantic tokens and non-color meaning. The
exception does not approve the present gradients or card composition.

The `outer-width-wrapper` audit hit in `HorseDetailPage.tsx` is currently a
comment documenting removed code, not live layout debt. Verify rather than
copying its old wrapper.

## Verification

```bash
node scripts/design-audit/check-design-system.mjs --report
npm run typecheck
```
