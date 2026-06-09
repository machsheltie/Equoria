# Phase 0 Route/Design Inventory — Synthesis

**Generated:** 2026-06-09 (8 parallel audit agents; every routed page read in full)
**Plan:** `docs/frontend-design-consistency-remediation-plan.md` §8 Phase 0
**Decisions informed:** `docs/design-system/DECISIONS.md`
**Tracking epic:** `Equoria-o5hub`

Per-family detail (one file each, with per-page sections, line-number
citations, and summary tables):

| File                                             | Pages covered                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [foundation.md](foundation.md)                   | App.tsx routes, DashboardLayout, PageHero, PageBackground, BottomNav, SidebarNav, ArtStage, AuthLayout, Button, CelestialTabs/GoldTabs, index.css, tokens.css |
| [auth.md](auth.md)                               | Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Onboarding + components/auth/                                                                    |
| [world-services.md](world-services.md)           | Vet, Farrier, FeedShop, TackShop (+tack-shop/), Grooms, Riders, Trainers, Crafting, WorldHub                                                                  |
| [marketplace-economy.md](marketplace-economy.md) | MarketplaceHub, Marketplace (grooms), HorseMarketplace, HorseTrader, Bank, Inventory, PrizeHistory                                                            |
| [community-messaging.md](community-messaging.md) | Community, Clubs (+clubs/), MessageBoard, MessageThread, Messages (+messages/)                                                                                |
| [stable-entity.md](stable-entity.md)             | Index (dashboard), StableView, MyStable, HorseDetail (+horse-detail/), FoalDetail, HorseEquip                                                                 |
| [workflow-pages.md](workflow-pages.md)           | Training, Breeding (+breeding/), CompetitionBrowser, CompetitionResults, ConformationShows, Leaderboards                                                      |
| [settings-profile.md](settings-profile.md)       | Settings (+settings/ sections), Profile                                                                                                                       |

## Cross-cutting findings (the evidence behind the D-register)

### Headers (D-01, D-20)

- World-services, workflow-pages, settings-profile: consistent `PageHero` usage (with mood/orb decoration — the D-20 target).
- Stable-entity: every page invents a bespoke header; three different surfaces title themselves "My Stable" (dashboard, StableView, MyStablePage).
- Auth: **zero pages use `AuthLayout`** — all six build inline shells; 3 pages hardcode `© 2025`; a `pageShell` helper is copy-pasted identically into two pages.
- `PageHero` self-constrains to `max-w-7xl px-4 sm:px-6 lg:px-8`, so hero and body edges misalign on any page whose body uses a different width.

### Containers and padding (D-02, D-03)

- Shell (`DashboardLayout`) owns `max-w-[1440px] mx-auto px-4 md:px-8`.
- Page wrappers found: `max-w-7xl`, `max-w-6xl`, `max-w-5xl`, `max-w-4xl`, `max-w-2xl`, `max-w-[52rem]`, `max-w-md`, `max-w-sm` — frequently with their own `px-4 sm:px-6 lg:px-8` duplicating shell gutters.
- Marketplace family alone spans five distinct widths.

### Surfaces and blur (D-05, D-06, D-22)

- `.glass-panel:hover` lifts/glows globally (static panels animate).
- Blur violations even in the shell: DashboardLayout footer applies inline `backdropFilter` (line ~113); BottomNav uses `backdrop-blur-xl`; page-local overlays add `backdrop-blur-sm`.
- Nested glass panels common in marketplace/bank/settings.

### Buttons (D-07, D-08, D-09)

- Shared `Button` is fully tokenized but base is `rounded-full` (pill default, `--radius-button: var(--radius-full)`).
- Hand-styled command buttons: FeedShop quantity/buy (gold-gradient raw `<button>`), BreedingPairSelection primary CTA, rider-list rows, staff-hire tab rows, `.btn-outline-celestial` legacy CSS class.
- Dual gold primary CTAs on LoginPage ("Enter" + "Create an Account").

### Tabs (D-10)

Four concurrent systems: `GoldTabs` (Radix, tokenized), `CelestialTabs` (wrapper, ~14 raw color literals), manual `role=tablist` button-rows (Grooms/Riders/Trainers — identical copy-paste; CompetitionBrowser; HorseDetail's 13-tab row; Onboarding progress dots).

### Colors and text (D-11, D-12)

- Approx. direct-color counts by family: foundation ~67, auth ~62, plus heavy clusters in CompetitionResults (palette stat-cards), Crafting (recipe badges), MyStablePage (~26 `text-white/NN`), CelestialTabs (~14), PageHero moodConfig (~18 rgba).
- `index.css` `.fantasy-title` hardcodes `rgb(212,168,67)` — every wordmark bypasses tokens.
- Legacy pre-Celestial theme (`midnight-ink`, `forest-green`, `saddle-leather`) survives in BreedingPredictionsPanel; `PasswordStrength` uses blue-600 for met-state in a gold UI.

### Dialogs (D-14)

Three-way split: `GameDialog` (Radix; only InventoryPage + HorseEquipPage), `BaseModal` (hand-rolled portal; ~8 component modals), page-local `fixed inset-0` overlays (ListForSaleModal, RiderPickerModal, MarketplacePage, HorseMarketplacePage, DeleteAccountModal), plus a native `window.confirm()` on MarketplacePage.

### Forms (D-13)

`celestial-input` (auth, Profile) vs raw `<input>` with inline Tailwind (Settings AccountSection) vs bespoke `Toggle` `button[role=switch]` (Settings) — no shared FormField/Select/Switch primitives in use.

### Currency (D-23)

At least four display conventions in the economy family alone.

### Backgrounds (D-21)

All five auth pages double-paint the background (`usePageBackground()` AND `<PageBackground/>`); Onboarding uses scene `default` while the rest of the funnel uses `auth`.

### Mobile fixed surfaces (D-24)

`HorseActionBar` (`fixed bottom-0`, `max-w-7xl`) collides with `BottomNav`; the page compensates with a hardcoded `pb-20`.

## Known gaps in this baseline

- **Screenshots not yet captured** — tracked as `Equoria-o5hub.1` (requires the running app with real credentials; no bypass headers).
- Counts marked "~" are grep-derived approximations; the per-family files cite exact locations for everything load-bearing.
