# Stable / Dashboard / Entity Family — Post-Migration Completion Record

**Status:** Migrated
**Pages:** Index (dashboard), StableView, MyStablePage, HorseDetailPage (+ `horse-detail/`), FoalDetailPage, HorseEquipPage
**Replaces:** the 2026-06-09 pre-migration scan (every page invented a bespoke header, three surfaces titled "My Stable", 13-tab manual button-row, page-local sale/rider modals).

## What is canonical now

- **Containers:** all six pages use `PageContainer` (verified by import grep).
- **Headers:** Index, StableView, MyStablePage, HorseEquipPage use
  `PageHeader`; HorseDetailPage and FoalDetailPage use `EntityHeader`
  (identity-centered detail header, DECISIONS §2).
- **Naming (DECISIONS §10):** the "three pages titled My Stable" ambiguity is
  resolved — `StableView` is titled **"Stable"** (`StableView.tsx:383`) and
  `MyStablePage` is **"Stable Profile"** (`MyStablePage.tsx:411`); both routes
  retained.
- **Tabs:** HorseDetail's 13-tab manual `role="tablist"` row and the
  StableView/MyStable CelestialTabs are now `CanonicalTabs`.
- **Dialogs:** `horse-detail/ListForSaleModal` and
  `horse-detail/RiderPickerModal` are on `GameDialog` (their page-local
  `fixed inset-0` overlays are gone).
- **Async/empty states:** StableView and the detail pages use `ui/state` +
  `EmptyState` (e.g. "Your stable is empty") instead of bespoke markup.

## Family commit

`7801a8ccd` — stable/dashboard/entity family migration + D-27 naming
(Equoria-o5hub.20, .24, .25).

## Remaining known residue (baseline-tracked)

- `pages/horse-detail/genetics/*` — the largest palette cluster (~19 matches
  across GeneticOverviewCard, LineageSection, TraitInteractionsSection,
  TraitTimelineSection): probability-tier gradients and sire/dam lineage
  color-coding. Data-viz-shaped; candidates for either tokenization or a
  DECISIONS §7 chart-exception row in `../EXCEPTIONS.md` during burn-down.
- `pages/HorseDetailPage.tsx:434` — `outer-width-wrapper` match on a
  **comment** documenting the old `max-w-7xl` wrapper's removal; false
  positive held in the baseline.
- `components/horse/HealthBadge.tsx:38` — `bg-white/10 text-white/60`
  unknown-band fallback (text-opacity).

## Pointers

DECISIONS §1/§2/§10 (`../DECISIONS.md`) · `../MOTION.md` · `../EXCEPTIONS.md` ·
`node scripts/design-audit/check-design-system.mjs --report`
