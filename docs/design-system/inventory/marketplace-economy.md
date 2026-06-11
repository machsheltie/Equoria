# Marketplace-Economy Family — Post-Migration Completion Record

**Status:** Migrated — **zero matches in the current audit report**
**Pages:** MarketplaceHubPage, MarketplacePage, HorseMarketplacePage, HorseTraderPage, BankPage, InventoryPage, PrizeHistoryPage
**Replaces:** the 2026-06-09 pre-migration scan (five distinct container widths, three modal idioms, a native `window.confirm()`, four currency display conventions).

## What is canonical now

- **Containers/headers:** all seven pages use `PageContainer` + `PageHeader`
  (verified by import grep across the family).
- **Currency:** every price, balance, and prize renders through `Currency`
  (Bank, HorseMarketplace, HorseTrader, Marketplace, PrizeHistory verified;
  the family was the `Currency` pilot — BankPage first). The
  `usd-game-currency` audit rule counts **0**.
- **Dialogs:** the page-local `fixed inset-0` overlays and the MarketplacePage
  `window.confirm()` are gone — Marketplace, HorseMarketplace, Inventory,
  `horse-detail/ListForSaleModal`, and `horse-detail/RiderPickerModal` all use
  `GameDialog`. `window.confirm` audit rule counts **0** (remaining grep hits
  are comments documenting the replacement).
- **Tabs:** HorseMarketplace and Inventory use `CanonicalTabs` (replacing the
  manual `role=tablist` button-rows).
- **Async states:** Marketplace, HorseMarketplace, Bank, Inventory, and
  PrizeHistory use `ui/state` (ErrorState/EmptyState/SectionLoading et al.)
  instead of bespoke loading/error markup.

## Family commits

`be5cb2f4d` — marketplace-economy family migration (Equoria-o5hub.18) ·
`346311dcf` — Currency component + Bank pilot (Equoria-o5hub.14) ·
`3c9579457` — GameDialog migration completing the overlay/`window.confirm`
removals (Equoria-o5hub.13).

## Remaining known residue

None — no marketplace-economy file appears in
`node scripts/design-audit/check-design-system.mjs --report` and the family
has no `EXCEPTIONS.md` rows.

## Pointers

DECISIONS §1/§2/§8/§9 (`../DECISIONS.md`) · `../MOTION.md` ·
`../EXCEPTIONS.md` · the audit script above.
