# World-Services Family — Post-Migration Completion Record

**Status:** Migrated
**Pages:** VeterinarianPage, FarrierPage, FeedShopPage, TackShopPage (+ `tack-shop/`), GroomsPage, RidersPage, TrainersPage, CraftingPage, WorldHubPage
**Replaces:** the 2026-06-09 pre-migration scan (bespoke staff-tab rows, `max-w-[52rem]` banner wrappers, gold-gradient raw buttons, Crafting palette badges).

## What is canonical now

- **Containers:** every service page sits in `PageContainer` (verified:
  Vet/Farrier/FeedShop/TackShop/Grooms/Riders/Trainers/Crafting all import it).
- **Headers:** the genuinely image-backed location pages keep the demoted
  `PageHero` per the audit script's `PAGEHERO_ALLOWLIST` (Vet, Farrier,
  FeedShop, TackShop, Crafting, WorldMap, WorldHub); Grooms/Riders/Trainers
  use `PageHeader`.
- **Tabs:** the copy-pasted `bg-white/5` staff-hire button-rows are gone —
  Grooms/Riders/Trainers/Vet/Farrier/TackShop use `CanonicalTabs`.
- **Buttons:** FeedShop's hand-styled gold-gradient quantity/buy `<button>`s
  are now shared `Button` (zero `bg-gradient` left in FeedShopPage).
- **Currency:** prices/balances via `Currency` (Vet, Farrier, FeedShop,
  Crafting, tack-shop `TackItemCard`).
- **Async states:** `ui/state` SectionLoading/ErrorState + `EmptyState`
  (e.g., CraftingPage imports all three).

## Family commit

`81c9f0b9d` — world-services family migration (Equoria-o5hub.17).

## Remaining known residue (baseline-tracked)

- `pages/WorldHubPage.tsx:128` — body still wraps in
  `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (outer-width-wrapper; the only
  real page-wrapper left in the tree).
- `components/MyRidersDashboard.tsx` / `MyTrainersDashboard.tsx` — the
  largest `text-opacity` cluster (~40 `text-white/NN` matches) plus
  hand-rolled `fixed inset-0` horse-picker overlays (fixed-overlay). These
  staff dashboards are the bulk of the remaining burn-down.
- `components/hub/WhileYouWereGone.tsx` — celebration overlay with
  `fixed inset-0` + `text-white/NN` close affordance.

## Pointers

DECISIONS §1/§2/§6 (`../DECISIONS.md`) · `../MOTION.md` · `../EXCEPTIONS.md` ·
`node scripts/design-audit/check-design-system.mjs --report`
