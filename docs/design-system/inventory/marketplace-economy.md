# Design-System Inventory: marketplace-economy Family

The **marketplace-economy** family covers every page where a player spends, earns, browses, or manages virtual currency and goods: the hub that routes to the two marketplace sub-sites (`MarketplaceHubPage`), the groom hiring marketplace (`MarketplacePage`), the user-to-user horse exchange (`HorseMarketplacePage`), the game-store horse shop (`HorseTraderPage`), the bank/vault (`BankPage`), the player inventory (`InventoryPage`), and the competition prize history (`PrizeHistoryPage`). The family is visually split between two competing idioms: pages rebuilt during Epic 21 and later (MarketplaceHub, HorseMarketplace, HorseTrader, Bank, Inventory) that lean on CSS-variable tokens and the shared `Button` component, and older pages (MarketplacePage, PrizeHistoryPage) that reach directly for `rgb()`/`rgba()` literals and raw palette classes. Container widths span five distinct values (`max-w-2xl` through `max-w-7xl`), tab implementations mix three different patterns, and dialog/modal approaches split three ways across the seven files. Currency is rendered without a unified formatter — at least four different display conventions are in use.

---

## Summary Table

| Page                 | Header            | Container | Outer px             | Backdrop-blur               | Tabs                             | Dialog/Modal             | Raw palette colors (approx) |
| -------------------- | ----------------- | --------- | -------------------- | --------------------------- | -------------------------------- | ------------------------ | --------------------------- |
| MarketplaceHubPage   | PageHero (golden) | max-w-7xl | px-4 sm:px-6 lg:px-8 | none                        | none                             | none                     | 0                           |
| MarketplacePage      | PageHero (nature) | max-w-7xl | px-4 sm:px-6 lg:px-8 | none                        | none                             | page-local fixed overlay | ~30                         |
| HorseMarketplacePage | PageHero (golden) | max-w-4xl | px-4 sm:px-6 lg:px-8 | backdrop-blur-sm (modal)    | manual button-row (role=tablist) | page-local fixed overlay | ~5                          |
| HorseTraderPage      | PageHero (golden) | max-w-2xl | px-4 sm:px-6         | backdropFilter inline style | none                             | none                     | 0                           |
| BankPage             | PageHero (golden) | max-w-4xl | px-4 sm:px-6 lg:px-8 | none                        | none                             | none                     | 0                           |
| InventoryPage        | PageHero (golden) | max-w-5xl | px-4 sm:px-6 lg:px-8 | none                        | CelestialTabs                    | GameDialog               | 0                           |
| PrizeHistoryPage     | PageHero (golden) | max-w-7xl | px-4 sm:px-6 lg:px-8 | none                        | none                             | none                     | ~15                         |

---

## MarketplaceHubPage

**File:** `frontend/src/pages/MarketplaceHubPage.tsx`

### 1. Header

Uses `<PageHero>` (line 58–63) with `title="Marketplace"`, `subtitle="Buy horses from the store or trade with other players."`, `mood="golden"`, and a `ShoppingCart` Lucide icon colored `text-[var(--gold-400)]`. No bespoke title structure.

### 2. Container

`max-w-7xl mx-auto` (line 66). The only container in the file.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` applied on the inner wrapper div (line 66). DashboardLayout already provides `px-4 md:px-8`, so this is additive outer padding applied on top of shell gutters.

### 4. Background

None. No `PageBackground`, no background image, no page-local gradient. `LocationCard` props carry bespoke `paintingGradient` values:

- Horse Trader: `linear-gradient(160deg, rgba(30,60,20,0.85) 0%, …)` (line 51)
- Horse Marketplace: `linear-gradient(160deg, rgba(14,50,100,0.85) 0%, …)` (line 31)

### 5. Surfaces

`LocationCard` components only — no direct panel markup in this file.

### 6. Radii

None directly applied; delegated to `LocationCard`.

### 7. Buttons

No buttons rendered directly by this page; navigation is via card `href` links.

### 8. Tabs

None.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

Loading: falls back gracefully via `breeds.length > 0` conditional in `buildHorseTraderDescription` (line 35–39). No spinner or skeleton. Error: not handled explicitly — hook errors are silently absorbed. Empty state: not applicable.

### 12. Direct Colors

Zero raw Tailwind palette classes or rgb/rgba literals on JSX elements. The `rgba()` values at lines 31 and 51 are passed as `paintingGradient` prop strings (inside `LocationCardProps` objects), not applied as Tailwind classes directly on rendered elements.

### 13. Mobile Fixed Elements

None.

---

## MarketplacePage (Groom Marketplace)

**File:** `frontend/src/pages/MarketplacePage.tsx`

### 1. Header

Uses `<PageHero>` (line 419–423) with `title="Groom Marketplace"`, `mood="nature"`, icon `<Users>` colored `text-[var(--gold-400)]`. Notably, `mood="nature"` is the only file in this family to deviate from `mood="golden"`.

### 2. Container

`max-w-7xl mx-auto` (line 426). Widest container in the family — appropriate given the 3-column groom grid.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` (line 426). Adds to DashboardLayout's own `px-4 md:px-8` gutters.

### 4. Background

None. No `PageBackground`.

### 5. Surfaces

Heavy use of `glass-panel` throughout:

- GroomCard root: `glass-panel p-6` (line 99) with inline hover border `rgba(37,99,235,0.5)`
- Stats sub-cells inside GroomCard: inline `style={{ background: 'var(--glass-surface-subtle-bg)', border: 'var(--glass-border-dim)' }}` (lines 121–123, 135–137, 150–152, etc.)
- Balance header: `glass-panel p-6 mb-8` (line 428)
- Stats metric cards: `glass-panel p-4` (line 486)
- Refresh card: `glass-panel p-4` (line 498)
- Empty state: `glass-panel p-12` (line 528)
- **Nested glass:** GroomCard details modal (lines 201–293) contains a `glass-panel` div nested inside a `fixed inset-0` overlay, itself containing inner sub-cells styled with `var(--glass-surface-subtle-bg)` — three levels of glass nesting.
- Error state uses `glass-panel` (line 409).

### 6. Radii

`rounded-full` (skill badge line 109, close button line 209), `rounded-lg` (stat sub-cells line 119/134/150/225/242/254, notification banner line 456), `rounded-xl` (notification line 456).

### 7. Buttons

Imports `Button` from `@/components/ui/button` (line 13). `Button` is used for Details, Hire, Refresh (lines 176–193, 281–291, 499–511, 534–543). One raw `<button>` for the modal close icon (line 207–212) styled with `hover:bg-[rgba(37,99,235,0.2)]`. **Approximate raw command button count: 1.**

### 8. Tabs

None.

### 9. Forms

No `<form>`. No shared input components used. `window.confirm()` is used for refresh cost confirmation (line 389) — a native browser dialog, not a design-system modal. This is a notable violation.

### 10. Dialogs/Modals

Page-local fixed overlay pattern (lines 199–294): `fixed inset-0 z-[var(--z-modal)]` backdrop div + `absolute inset-0 bg-black/60` click-away layer + `glass-panel` content panel. No `GameDialog` or `BaseModal`. No `backdrop-blur` on this overlay (unlike HorseMarketplacePage).

### 11. Async States

- Loading: full-screen centered `<RefreshCw animate-spin>` + text (lines 396–403) — custom, not a shared spinner.
- Error: `glass-panel` centered panel with `XCircle` icon (lines 406–415) — custom, not `ErrorCard`.
- Empty state: `glass-panel p-12` with icon (lines 527–544).
- Hire/refresh pending: handled via mutation `isPending` flag — no dedicated skeleton.

### 12. Direct Colors

Heavy use of raw `rgb()`/`rgba()` literals — approximately **30** direct color usages:

- Gold: `rgb(212,168,67)` — 9 usages (icons, prices, headers)
- Blue: `rgb(37,99,235)` — 5 usages (borders, hover states, loading spinner)
- Silver: `rgb(100,130,165)` — 6 usages (labels)
- Text: `rgb(220,235,255)` — 6 usages (values)
- Skill badge `rgba()` inline styles (lines 38–58)
- Notification: `bg-green-900/30 border border-green-500/40` / `bg-red-900/30 border border-red-500/40` (lines 458–459)
- Raw palette: `text-blue-400`, `text-orange-400`, `text-green-400`, `text-red-400`, `text-slate-400` (personality color returns, lines 69–77)
- Error state: `text-red-400` (lines 410–411)
- Notification text: `text-green-300`, `text-red-300` (line 467)
- `text-slate-400` used 4 times (lines 77, 106, 156, 400, 533)

### 13. Mobile Fixed Elements

None.

---

## HorseMarketplacePage

**File:** `frontend/src/pages/HorseMarketplacePage.tsx`

### 1. Header

Uses `<PageHero>` (lines 550–564) with `title="Marketplace"`, `mood="golden"`, icon `<ShoppingCart>` at `text-[var(--gold-400)]`. The hero's children slot contains a breadcrumb (`<Link>Home</Link> / Marketplace`) rendered directly without using a shared `<Breadcrumb>` component.

### 2. Container

`max-w-4xl mx-auto` (line 566). Narrower than MarketplacePage's `max-w-7xl`, which creates visible width discontinuity when navigating between the hub (max-7xl) and this page (max-4xl).

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` (line 566). Duplicates DashboardLayout gutters.

### 4. Background

None. No `PageBackground`.

### 5. Surfaces

- Listing cards: `glass-panel` as a `<button>` element (line 74) — interactive panel.
- Skeleton: `animate-pulse glass-panel` (line 50).
- Detail modal content: `glass-panel-heavy rounded-2xl` (line 135) — notably uses the `glass-panel-heavy` variant (only occurrence in this family).
- Confirm step inner ledger: `space-y-2 glass-panel` (line 218) — a glass-panel nested inside the modal glass-panel-heavy (two levels of glass).
- Advanced filter panel: `glass-panel grid` (line 325).
- My Listings tab items: `glass-panel flex items-center gap-4` (line 444).
- History items: raw `bg-white/5 border border-white/10 rounded-xl` (line 505) — **not glass-panel**.
- `backdrop-blur-sm` on the modal overlay (line 134): one blur usage in this family for modals.

### 6. Radii

`rounded-2xl` (modal panel line 135, image line 162), `rounded-xl` (tab bar line 569, history rows line 505, listing image line 77), `rounded-lg` (tab buttons line 584, filter inputs lines 294/301/344, stats grid cells line 183, pagination buttons lines 381/392), `rounded` (close button hover line 152).

### 7. Buttons

Imports `Button` from `@/components/ui/button` (line 23).

- `Button` used: Buy Now (line 198), Cancel/Confirm Purchase pair (lines 235/243), Delist (line 461).
- Raw `<button>` elements:
  - `ListingCard` is itself a `<button>` (line 71) with raw classes — **one hand-styled interactive card/button**.
  - Modal Back chevron `<button>` (line 138) with raw `text-white/50` classes.
  - Modal close `<button>` (line 148) with `hover:bg-white/10`.
  - Filter toggle `<button>` (line 309) with conditional raw class string.
  - Pagination prev/next `<button>` pair (lines 377/388) with raw `bg-white/5 border border-white/10` classes.
  - Tab `<button>` elements ×3 (line 578) with raw conditional class strings — no CelestialTabs.
- **Approximate raw command button count: 7** (tab buttons, pagination ×2, filter toggle, back, close, ListingCard itself).
- Two primary actions on modal surface: "Buy Now" and modal close coexist; confirm step has Cancel + "Confirm Purchase" pair.

### 8. Tabs

Manual button-row with `role="tablist"` / `role="tab"` ARIA (lines 568–593). Styled with raw classes: `bg-white/5 border border-white/10 rounded-xl` for the container, and conditional `bg-white/10 text-white/90 shadow-sm` vs `text-white/40 hover:text-white/70` for active/inactive. Does **not** use `CelestialTabs` or `GoldTabs`.

### 9. Forms

Raw `<input type="text">` for breed filter (line 289) styled with `bg-white/5 border border-white/10 rounded-lg text-white/80 placeholder:text-white/30` — no shared input component.
Raw `<select>` for sort (line 297) styled with `bg-white/5 border border-white/10 rounded-lg text-white/70`.
Raw `<input type="number">` ×4 for advanced filters (line 337) styled with `bg-white/5 border border-white/10 text-white/80`.

### 10. Dialogs/Modals

Page-local fixed overlay (lines 133–256): `fixed inset-0 z-[var(--z-modal)] bg-black/70 backdrop-blur-sm`. Content panel uses `glass-panel-heavy rounded-2xl`. Multi-step (detail → confirm) managed by local `step` state. No `GameDialog`, no `BaseModal`.

### 11. Async States

- Loading (browse): `ListingCardSkeleton` ×4 (lines 352–356) — custom skeleton with `animate-pulse glass-panel`.
- Loading (my listings): `ListingCardSkeleton` ×2 (lines 422–427).
- Loading (history): inline `animate-pulse h-16 bg-white/5 rounded-xl` (lines 483–486).
- Error: no explicit error state shown for listings fetch (hook error is silently dropped).
- Empty states: inline flex-centered `<div>` with icon + text — custom per tab, not shared `ErrorCard`.

### 12. Direct Colors

Approximately **5** direct raw palette usages:

- `text-emerald-400` — price display in listing card (line 89), modal price (line 174), confirm spend amount (line 214), my-listings price (line 457)
- `text-red-400` — insufficient funds (line 193), debit line (line 225), conditional remaining balance (line 229), history sold/bought (line 521)
- `bg-emerald-400` / `bg-blue-400` — history dot indicators (line 508)
- `text-white/NN` opacity pattern used extensively (~30+ instances) throughout all sub-components.

### 13. Mobile Fixed Elements

None.

---

## HorseTraderPage

**File:** `frontend/src/pages/HorseTraderPage.tsx`

### 1. Header

Uses `<PageHero>` (lines 88–96) with `title="Horse Trader"`, `mood="golden"`, icon `<ShoppingBag>` at `text-[var(--gold-400)]`. Subtitle is data-driven from live breed count. No breadcrumb.

### 2. Container

`max-w-2xl mx-auto` (line 98). Narrowest container in the family — appropriate for a single-card purchase form.

### 3. Outer Padding

`px-4 sm:px-6 py-8` (line 98). Note `py-8` adds top padding; other pages use `pb-*` only, relying on PageHero for top spacing. `lg:px-8` is absent (other pages include it), an inconsistency.

### 4. Background

None. No `PageBackground`.

### 5. Surfaces

Main purchase card (lines 101–223): **not** using `glass-panel` utility class. Instead, hand-coded:

```
rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6
```

with `style={{ backdropFilter: 'blur(8px)' }}` — an inline `backdropFilter` style rather than the `backdrop-blur-sm` Tailwind class or a shared `glass-panel` token. This is a surface inconsistency.

Sub-cells (breed search container, price row): `border border-[var(--glass-border)] bg-[var(--bg-card)] rounded-lg` (lines 116, 174).

Success feedback: `border border-green-600 bg-green-900/30` (line 200).
Error feedback: `border border-red-600 bg-red-900/30` (line 217).

### 6. Radii

`rounded-xl` (main card line 101), `rounded-lg` (inputs lines 116/127/161/174), no `rounded-2xl`.

### 7. Buttons

- No `Button` component import — this page does **not** import `@/components/ui/button`.
- Buy button (line 187–195): raw `<button>` with class `btn-cobalt w-full rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide` — a hand-styled primary command button using a `btn-cobalt` custom class.
- Sex toggle buttons ×2 (lines 157–169): raw `<button>` with conditional gold/muted styling.
- Breed dropdown option buttons (line 132–139): raw `<button>` elements inside a `<ul>`.
- **Approximate raw command buttons: 1 primary action** (`Buy Horse` using `btn-cobalt`), plus 2 sex-toggle buttons (semantic controls) and N breed-dropdown items.

### 8. Tabs

None.

### 9. Forms

Breed search: raw `<input type="text">` (line 113) styled with `border border-[var(--glass-border)] bg-[var(--bg-card)] rounded-lg focus:ring-2 focus:ring-[var(--gold-400)]`. Uses design tokens for border/bg, but not a shared `celestial-input` component.

### 10. Dialogs/Modals

None.

### 11. Async States

- Loading (breeds): input is `disabled` with placeholder `'Loading breeds…'` (line 118).
- Success: inline green feedback div (lines 198–213) with `<Link>` to stable.
- Error: inline red feedback div (lines 215–221).
- No loading spinner/skeleton for the main page load.

### 12. Direct Colors

Zero raw Tailwind palette classes on JSX. One raw `text-red-400` at line 179 for insufficient funds. Success/error feedback uses `border-green-600 bg-green-900/30 text-green-300` and `border-red-600 bg-red-900/30 text-red-300` (lines 200–220) — raw palette.

### 13. Mobile Fixed Elements

None.

---

## BankPage

**File:** `frontend/src/pages/BankPage.tsx`

### 1. Header

Uses `<PageHero>` (lines 75–89) with `title="The Vault"`, `mood="golden"`, icon `<Coins>` at `text-[var(--gold-400)]`. The hero children slot renders a breadcrumb (Home / Bank) built from `<Link>` and `<span>` — no shared `<Breadcrumb>` component, but uses CSS-variable tokens throughout.

### 2. Container

`max-w-4xl mx-auto` (line 91).

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8 pb-12` (line 91). Duplicates DashboardLayout gutters.

### 4. Background

None. The balance card has a decorative radial gradient glow via inline `style={{ background: 'radial-gradient(circle, var(--glass-glow) 0%, transparent 60%)' }}` (line 101–103) but this uses a CSS variable, not a raw color value.

### 5. Surfaces

- Balance card: `glass-panel rounded-2xl p-8` (line 94).
- Weekly reward section: `glass-panel rounded-2xl p-6` (line 121).
- Transaction rows: `glass-panel-subtle rounded-xl` (line 196) — good use of the subtle variant.
- Loading/empty transaction state: `glass-panel-subtle rounded-xl p-6` (lines 181, 186).
- Info panel: `glass-panel-subtle rounded-xl p-5` (line 244).
- No nested glass panels.

### 6. Radii

`rounded-2xl` (balance card line 94, reward section line 121), `rounded-xl` (transaction rows line 196, loading/empty lines 181/186, icon containers line 124), `rounded-full` (glow orb line 99, gold accent bar line 174), `rounded-lg` (tx type icon square line 201).

### 7. Buttons

- Weekly claim `<button>` (lines 138–166): raw `<button>` with inline conditional class string — gradient gold vs disabled glass style. This is a **hand-styled primary action button**, not using the shared `Button` component. Uses `bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)]` — a bespoke gradient button.
- No `Button` import.
- **Approximate raw command button count: 1** (the claim button).

### 8. Tabs

None.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- Loading (transactions): `glass-panel-subtle` with text "Loading transactions..." (line 181–183).
- Empty state: `glass-panel-subtle` with explanatory text (lines 185–191).
- Claim error: inline `<p className="text-xs text-[var(--status-error)]">` (line 168).
- No spinner or skeleton component — text-only loading.

### 12. Direct Colors

Zero raw Tailwind palette classes or rgb/rgba literals on page JSX elements. All colors go through CSS variables (`var(--gold-400)`, `var(--status-success)`, `var(--status-error)`, etc.). This is the most token-compliant page in the family.

### 13. Mobile Fixed Elements

None.

---

## InventoryPage

**File:** `frontend/src/pages/InventoryPage.tsx`

### 1. Header

Uses `<PageHero>` (lines 273–293) with `title="Inventory"`, `mood="golden"`, icon `<Package>` at `text-[var(--gold-400)]`. The children slot renders a flex row containing a breadcrumb (via raw `<Link>/<span>`) plus an item-count badge using `glass-panel rounded-lg`.

### 2. Container

`max-w-5xl mx-auto` (line 295). Mid-width choice — sits between BankPage's `max-w-4xl` and MarketplacePage's `max-w-7xl`.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8 pb-8` (line 295). Duplicates DashboardLayout gutters.

### 4. Background

None. No `PageBackground`.

### 5. Surfaces

- Item-count badge in hero: `glass-panel rounded-lg` (line 287) — a glass panel nested inside PageHero.
- About Inventory info section: `glass-panel rounded-xl` (line 300).
- Empty/error state containers: raw `flex flex-col items-center` divs — no glass surface.
- `ItemCard` and `CardGrid` are shared components that carry their own surface treatment.
- No deeply nested glass panels in page-level markup.

### 6. Radii

`rounded-lg` (item count badge line 287), `rounded-xl` (info section line 300). Most radii are delegated to `ItemCard`/`CardGrid`.

### 7. Buttons

Imports `Button` from `@/components/ui/button` (line 25). The only button rendered at page level is the "Unequip" `Button` inside `InventoryCard`'s action slot (line 135). All other interactions are delegated to `ItemCard` `onClick`. **Approximate raw command buttons: 0** at the page level.

### 8. Tabs

Uses `CelestialTabs` from `@/components/ui/game` (lines 28, 297) — the only page in this family to use the shared tab component. Tabs are configured via the `tabs` array (lines 263–268). This is the correct pattern.

### 9. Forms

None.

### 10. Dialogs/Modals

Uses `GameDialog` / `GameDialogContent` / `GameDialogHeader` / `GameDialogTitle` / `GameDialogDescription` from `@/components/ui/game/GameDialog` (lines 30–35, 318–327) — the only page in this family to use the shared dialog component. This is the correct pattern.

### 11. Async States

- Loading: centered `<Loader2 animate-spin text-white/30>` (lines 208–211).
- Error: centered `<AlertCircle text-red-400/50>` with text (lines 215–224). Uses raw `text-red-400/50` — a Tailwind palette opacity modifier, not a CSS variable.
- Empty state: centered `<AlertCircle text-white/20>` with text (lines 230–244) — uses `text-white/NN` opacity pattern.

### 12. Direct Colors

Approximately **2** direct color instances at page level: `text-red-400/50` (error icon line 220), `text-white/30` (spinner line 210), plus the `text-white/NN` pattern in empty states. The `var(--gold-primary)` for the equipped star (line 62) is tokenized correctly.

### 13. Mobile Fixed Elements

None.

---

## PrizeHistoryPage

**File:** `frontend/src/pages/PrizeHistoryPage.tsx`

### 1. Header

Uses `<PageHero>` (lines 282–288) with `title="Prize History"`, `mood="golden"`, icon `<DollarSign>` at `text-[var(--gold-400)]`. The hero children slot renders `<Breadcrumbs>` — a memo-ized local component (lines 145–159) built with `<nav>`, `<Link>`, `<ChevronRight>` — no shared `<Breadcrumb>` component.

### 2. Container

`max-w-7xl mx-auto` (line 290) — widest variant in the family, matching MarketplaceHubPage and MarketplacePage.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8 pb-8` (line 290). Uses a `<main>` element as the wrapper (correct semantic choice). Duplicates DashboardLayout gutters.

### 4. Background

None. No `PageBackground`.

### 5. Surfaces

`StatCard` (lines 97–110): uses `bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.3)]` — raw `rgba()` values, **not** a `glass-panel` token. This is the most significant surface inconsistency in the family.
`StatCardSkeleton` (lines 62–73): same `bg-[rgba(15,35,70,0.4)]` approach.
`StatsError` (lines 119–138): `bg-[rgba(239,68,68,0.1)] border border-red-500/30`.
No glass-panel class anywhere in PrizeHistoryPage.

### 6. Radii

`rounded-lg` (stat cards lines 62/97, error panel line 120, retry button line 130), `rounded-full` (icon containers line 105, skeleton icon line 70).

### 7. Buttons

No `Button` import. One raw `<button>` for the retry action (lines 128–135) styled with:

```
inline-flex items-center px-3 py-1 bg-[rgba(239,68,68,0.1)] text-red-400 text-sm font-medium rounded hover:bg-[rgba(239,68,68,0.2)] focus:outline-none focus:ring-2 focus:ring-red-500
```

This is a hand-styled command button with raw `rgba()` and `text-red-400`. **Approximate raw command buttons: 1.**

Claim button inside `PrizeTransactionHistory` is delegated to that component.

### 8. Tabs

None on this page. `PrizeTransactionHistory` component (separate file) handles its own filtering UI.

### 9. Forms

None at page level; filter forms are inside `PrizeTransactionHistory`.

### 10. Dialogs/Modals

None.

### 11. Async States

- Loading: `StatCardSkeleton` ×4 via grid (lines 302–305) — `animate-pulse` skeleton with `rgba()` backgrounds.
- Error: `StatsError` component (lines 292–295) — custom, uses `bg-[rgba(239,68,68,0.1)]`.
- Empty: delegated to `PrizeTransactionHistory`.

### 12. Direct Colors

Approximately **15** direct color usages:

- `bg-[rgba(15,35,70,0.4)]` / `border border-[rgba(37,99,235,0.3)]` — stat card surface (lines 62, 97)
- `bg-[rgba(15,35,70,0.5)]` — skeleton fill (lines 67, 68, 70)
- `text-[rgb(220,235,255)]` — stat value text (line 103)
- `bg-[rgba(239,68,68,0.1)]` / `border border-red-500/30` / `text-red-400` — error state (lines 120, 130)
- `bg-[rgba(16,185,129,0.1)]` / `text-emerald-400` — prize money icon bg/color (lines 314–315)
- `bg-[rgba(37,99,235,0.1)]` / `text-blue-400` — XP icon (lines 322–323)
- `bg-purple-900/30` / `text-purple-400` — competitions icon (lines 330–331)
- `bg-orange-900/30` / `text-orange-400` — win rate icon (lines 338–339)
- `text-slate-400` — breadcrumb / stat label (lines 102, 146)
- `hover:text-[rgb(220,235,255)]` — breadcrumb hover (lines 147, 152)
- `text-[rgb(220,235,255)]` — active breadcrumb (line 156)
- `hover:bg-[rgba(239,68,68,0.2)]` / `focus:ring-red-500` — retry button hover (line 130)

Currency uses `Intl.NumberFormat` with `style: 'currency', currency: 'USD'` (lines 49–55) — the only page in the family to use a proper currency formatter. However, the icon for this is `<DollarSign>` while other pages use coin emoji (🪙) or "coins" text, creating a semantic mismatch.

### 13. Mobile Fixed Elements

None.

---

## Cross-Family Notable Findings

1. **Five different container widths** across seven pages: `max-w-2xl` (HorseTrader), `max-w-4xl` (HorseMarketplace, Bank), `max-w-5xl` (Inventory), `max-w-7xl` (MarketplaceHub, MarketplacePage, PrizeHistory) — no documented width rationale in the design system.

2. **All seven pages duplicate DashboardLayout gutters.** DashboardLayout line 100 already applies `px-4 md:px-8`. Every page adds `px-4 sm:px-6 lg:px-8` on its own content wrapper, creating doubled left/right padding on larger viewports.

3. **Three different tab implementations:** `CelestialTabs` (InventoryPage only — correct), manual `role="tablist"` button row (HorseMarketplacePage — inconsistent), and no tabs at all (others). HorseMarketplacePage should migrate to `CelestialTabs`.

4. **Three different dialog/modal implementations:** `GameDialog` (InventoryPage only — correct), page-local `fixed inset-0` overlay without shared component (MarketplacePage, HorseMarketplacePage), and `window.confirm()` native browser dialog (MarketplacePage line 389 — accessibility violation).

5. **MarketplacePage has ~30 raw rgb()/rgba() color literals** hardcoded inline and in `getSkillBadgeStyle`/`getPersonalityColor` functions. None use CSS variables. This is the highest direct-color count in the family and indicates the page predates the token system.

6. **PrizeHistoryPage stat cards** use `bg-[rgba(15,35,70,0.4)]` with raw `rgba()` border — bypassing the `glass-panel` token entirely. Every other family member uses `glass-panel` for card surfaces.

7. **HorseTraderPage does not import `Button`** and uses `btn-cobalt` — a custom class not present in other family pages. It also uses an inline `backdropFilter` style instead of a Tailwind `backdrop-blur-*` class.

8. **Currency rendering is inconsistent across the family:**
   - BankPage: `balance.toLocaleString()` + " Equoria Coins" label
   - MarketplacePage: `$${hiringCost}` (dollar sign prefix)
   - HorseMarketplacePage: `listing.salePrice.toLocaleString() + ' 🪙'` (coin emoji suffix)
   - HorseTraderPage: "1,000 coins" (hardcoded string)
   - PrizeHistoryPage: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` (USD formatting)

9. **Four pages add their own breadcrumb** inside the PageHero children slot (HorseMarketplace, HorseTrader lacks one, Bank, Inventory, PrizeHistory), but all use bespoke `<Link>/<span>/<ChevronRight>` constructions rather than a shared `<Breadcrumb>` component, despite `Breadcrumb.tsx` existing in the layout directory.

10. **`mood="nature"` in MarketplacePage** (groom marketplace) vs `mood="golden"` everywhere else. Whether intentional or an oversight, it creates visual inconsistency at the hub level where both cards lead to pages with different hero moods.
