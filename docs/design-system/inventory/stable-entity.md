# Design-System Inventory — stable-entity Family

The **stable-entity** family covers the five routed pages that form the player's primary horse-management loop: the hub dashboard (`Index.tsx` at `/`), the full stable browser (`StableView.tsx` at `/stable`), the stable profile & hall-of-fame (`MyStablePage.tsx` at `/my-stable`), the individual horse detail view (`HorseDetailPage.tsx` at `/horses/:id`), and the foal detail view (`FoalDetailPage.tsx` at `/foals/:id`), plus the supporting sub-files in `pages/horse-detail/` and `pages/horses/HorseEquipPage.tsx`. The family reveals three pervasive tensions: (1) **duplicate stable entry-points** — `/stable` (StableView) and `/my-stable` (MyStablePage) both render "My Stable" as their H1 while serving distinct but overlapping concerns, confusing routing and titling; (2) **bespoke per-page headers** — every page in the family invents its own header structure rather than using a shared `PageHero`, with the two exceptions (MyStablePage and HorseEquipPage) using `PageHero` inconsistently; and (3) **HorseActionBar's `fixed bottom-0` portal** — it collides with BottomNav on mobile viewports while the parent page adds a compensating `pb-20` rather than using a shared safe-area token.

---

## Summary Table

| Page / File                         | Header Type                                     | Container `max-w-*`                                            | Outer px-\*                      | Tabs                                        | Dialogs                                                      | Raw palette hits (approx.)                     | Backdrop-blur                                |
| ----------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- | -------------------------------- | ------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------- |
| `Index.tsx`                         | Bespoke `<header>` h1                           | none (fills layout)                                            | `py-6` only                      | none                                        | none                                                         | ~10 rgba() inline                              | 3 `[backdrop-filter]` inline                 |
| `StableView.tsx`                    | Bespoke `<header>` h1, atmospheric glow divider | `max-w-7xl` (header only)                                      | `px-4 sm:px-6 lg:px-8` in header | CelestialTabs                               | none                                                         | ~3 rgba() inline                               | 1 `[backdrop-filter:var(--glass-bg-filter)]` |
| `MyStablePage.tsx`                  | PageHero (`mood="golden"`)                      | `max-w-5xl`                                                    | `px-4 sm:px-6 lg:px-8`           | CelestialTabs                               | none                                                         | ~26 `text-white/NN` + palette                  | 0                                            |
| `HorseDetailPage.tsx`               | Bespoke back-button + HorseProfileCard          | `max-w-7xl` (main), `max-w-6xl` (skeleton), `max-w-md` (error) | `p-4 md:p-6`                     | 13-tab manual button-row (`role="tablist"`) | ListForSaleModal (page-local), RiderPickerModal (page-local) | ~1 `text-red-400`                              | 0 in page; 2 in portaled modals              |
| `FoalDetailPage.tsx`                | None (back link only)                           | none                                                           | none                             | none                                        | none                                                         | ~2 `text-red-400`, 2 rgba() inline             | 0                                            |
| `horse-detail/HorseProfileCard.tsx` | (sub-component)                                 | none                                                           | none                             | none                                        | none                                                         | ~1 `text-emerald-400` (from statHelpers)       | 0                                            |
| `horse-detail/HorseActionBar.tsx`   | —                                               | `max-w-7xl`                                                    | `px-4 py-3`                      | none                                        | —                                                            | 0                                              | 1 `backdrop-blur-sm` (fixed bar)             |
| `horse-detail/ListForSaleModal.tsx` | page-local overlay                              | `max-w-sm`                                                     | `p-6`                            | none                                        | page-local `fixed inset-0`                                   | ~7 `text-white/NN`                             | 1 `backdrop-blur-sm`                         |
| `horse-detail/RiderPickerModal.tsx` | page-local overlay                              | `max-w-sm`                                                     | `p-6`                            | none                                        | page-local `fixed inset-0`                                   | ~2 `text-white/NN`                             | 1 `backdrop-blur-sm`                         |
| `horse-detail/GeneticsTab.tsx`      | (sub-component)                                 | none                                                           | none                             | none                                        | none                                                         | ~5 `rgb()`, 3 `text-red-400`, 2 `text-emerald` | 0                                            |
| `horse-detail/genetics/*`           | (sub-components)                                | none                                                           | none                             | none                                        | none                                                         | ~40+ `rgb()`, `rgba()` inline                  | 0                                            |
| `horses/HorseEquipPage.tsx`         | PageHero                                        | `max-w-5xl`                                                    | `px-4 sm:px-6 lg:px-8`           | none                                        | GameDialog (shared)                                          | 0                                              | 0                                            |

---

## Index.tsx (`/` — Hub Dashboard)

### 1. Header

Bespoke `<header>` element (line 325) containing an `<h1>` with inline `textShadow` style. No `PageHero`. Title hard-coded as "My Stable". This conflicts with `StableView.tsx` which uses the same title at a different route.

```
className="text-[var(--text-h1)] font-semibold text-[var(--gold-primary)]"
style={{ fontFamily: 'var(--font-heading)', textShadow: '0 0 30px rgba(200,168,78,0.25)' }}
```

### 2. Container

No `max-w-*` wrapper — the page root is `<div className="py-6 space-y-6">` (line 323), relying entirely on `DashboardLayout`'s `max-w-[1440px] mx-auto px-4 md:px-8` gutter.

### 3. Outer Padding

`py-6` on the root div (line 323). No lateral `px-*` added at the page level — correct.

### 4. Background

No `PageBackground` import. Uses `DashboardLayout`'s scene-based background (`scene: 'hub'`).

### 5. Surfaces

`HorseCard` (line 83): fully bespoke glass card with inline `[backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)]`. This is a **local re-implementation of the glass-card surface**, not using the shared `glass-panel` CSS class. `GettingStartedCard` (line 183): same pattern with the same inline backdrop-filter. `DayOneGettingStarted` action links (line 275): third bespoke glass surface with `[backdrop-filter:blur(10px)]`.

There is also a **second horse-card implementation in Index.tsx** (`HorseCard` at line 36–178) distinct from the shared `HorseCard` component imported in `StableView.tsx` from `@/components/horse/HorseCard`. These two card implementations diverge in layout and feature set.

### 6. Radii

Mixed: `rounded-[var(--radius-lg)]` (cards), `rounded-[var(--radius-md)]` (portrait), `rounded-[var(--radius-sm)]` (chips), `rounded-xl` (day-one action links, line 275), `rounded-lg` (icon badge, line 277), `rounded-2xl` (empty state icon, line 391), `rounded-full` (glow orbs).

### 7. Buttons

Shared `<Button>` component used for CTAs (lines 215, 218, 357, 403). One raw `<button>` with custom classes for the "Dismiss" action in `DayOneGettingStarted` (line 261). Not a command button — functional dismiss. Count of raw command buttons: **1**.

### 8. Tabs

None.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading**: `animate-pulse` skeleton grid (line 375–381) — custom, not `SkeletonBase`.
- **Error**: `<ErrorCard>` shared component (line 384).
- **Empty**: Custom bespoke card with inline styles (lines 390–406).

### 12. Direct Colors

~10 raw `rgba()` inline values (lines 83, 99, 141, 183, 189, 197, 275, 277, 331, 391). No palette class violations (`text-emerald-*` etc.) in the main page. One `border-slate-400/[0.08]` at line 157.

### 13. Mobile Fixed Elements

None directly in Index.tsx. HorseActionBar (portaled) applies to HorseDetailPage, not Index.

---

## StableView.tsx (`/stable`)

### 1. Header

Bespoke `<header>` with `relative overflow-hidden` wrapper (line 380), two radial-gradient ambient glow `<div>`s (lines 383–397), and an `<h1>` at line 401–408 with inline `textShadow`. **No PageHero**. Title: "My Stable" — duplicates Index.tsx's title and /my-stable's PageHero title.

A gold accent divider `<div>` (line 474–482) uses an inline `linear-gradient` with raw `rgba(58,111,221,0.2)` — not a CSS variable.

### 2. Container

Header content: `max-w-7xl mx-auto` with `px-4 sm:px-6 lg:px-8` (line 399). Tab content has no explicit max-width — uses `CelestialTabs` full-width.

### 3. Outer Padding

The header adds its own `px-4 sm:px-6 lg:px-8` (line 399) **in addition to** `DashboardLayout`'s `px-4 md:px-8` — **double gutter on desktop**. The main content area's `p-4` inside `renderHorseList` (line 163) also contributes.

### 4. Background

No `PageBackground` import. `DashboardLayout` provides `STATIC_BG['/stable'] = '/images/bg-stable.webp'`.

### 5. Surfaces

Player info strip (line 411): inline glass card with `[backdrop-filter:var(--glass-bg-filter)]` — this correctly uses a CSS variable rather than inline `blur()` values. Empty state icon container (line 124): inline `style={{ background: 'linear-gradient(135deg, var(--glass-glow), var(--bg-deep-space))' }}` — bespoke surface. Pagination buttons are raw `<button>` elements styled without `glass-panel`.

### 6. Radii

`rounded-xl` (player info strip), `rounded-2xl` (empty-state icon), `rounded-[var(--radius-sm)]` (view-toggle buttons, pagination), `rounded-full` (avatar in list view), `rounded-[var(--radius-lg)]` (skeleton card).

### 7. Buttons

Shared `<Button>` for Breeding/Marketplace CTAs (lines 147–151). **Multiple raw `<button>` elements** for view-toggle (lines 171–196), all list-row items (line 245–279), and all pagination controls (lines 285–338). These are **~15+ raw styled `<button>` elements**. None use the shared Button component. The list-row buttons have hover/active classes but no focus-ring consistency.

### 8. Tabs

`CelestialTabs` (shared, imported from `@/components/ui/game`) — correct canonical usage (line 487).

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading**: `SkeletonHorseCard` using shared `SkeletonBase` (line 49).
- **Error**: `<ErrorCard>` shared component (line 99–104).
- **Empty**: Bespoke centered div with inline gradient style (lines 121–154).

### 12. Direct Colors

`rgba(58,111,221,0.06)` (line 395 — ambient glow), `rgba(58,111,221,0.2)` (line 480 — divider). No palette class violations.

### 13. Mobile Fixed Elements

None in the component itself. `DashboardLayout` manages `BottomNav`.

---

## MyStablePage.tsx (`/my-stable`)

### 1. Header

`PageHero` imported and used (lines 16, 401–415) with `title="My Stable"`, `subtitle="Your stable profile and legacy hall of fame"`, `mood="golden"`. **This is the only stable-family page that uses PageHero** — inconsistent with StableView and Index both having bespoke headers for the same conceptual "My Stable" title.

### 2. Container

`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8` (line 417). This re-adds horizontal padding that DashboardLayout already provides at `px-4 md:px-8` — **double gutter duplication**.

### 3. Outer Padding

`pb-8` on the container div (line 417). PageHero handles its own top padding.

### 4. Background

No `PageBackground` import. `DashboardLayout` provides `STATIC_BG['/my-stable'] = '/images/bg-stable.webp'`.

### 5. Surfaces

Extensively uses `glass-panel` CSS class throughout sub-components: stable banner (line 87), quick-link panel (line 170), each `StatBlock` (line 190), hall-of-fame cards (line 236), info panel (line 453). `HallOfFameCard` (line 264) uses `bg-white/5 rounded-lg` for career stat cells — **bespoke nested mini-cards inside glass-panel**. `GoldBorderFrame` correctly wraps champion cards.

### 6. Radii

`rounded-full` (rank badge, line 241), `rounded-lg` (career stat cells, line 260–268), `rounded-xl` (info panel + GoldBorderFrame wrapper, lines 288, 453).

### 7. Buttons

Shared `<Button>` used throughout (lines 108, 114, 119, 147–151, 176, 270). One raw `<input>` for stable name editing (line 100–105) with bespoke `rounded-lg bg-white/10 border border-white/20 px-3 py-2` — uses `text-white/NN` opacity pattern instead of design tokens.

### 8. Tabs

`CelestialTabs` (shared) — controlled mode with `value`/`onValueChange` (line 420). Two tabs: "Stable Profile" and "Hall of Fame". Correct canonical usage.

### 9. Forms

Inline stable-name edit `<input>` (line 100–105) with raw `bg-white/10 border border-white/20` classes — not using a shared `celestial-input` or form component. StudSaleTab analogy: the stud-fee `<input>` in `StudSaleTab.tsx` uses similar raw classes.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading**: Inline text "Loading stable records..." inside bio paragraph (line 95). No spinner or skeleton.
- **Error**: Inline `<p className="text-sm text-amber-400/80">` for competition stats error (line 131) — uses raw `text-amber-400/80` not a token.
- **Empty** (Hall of Fame): Bespoke centered layout with `text-white/NN` opacities (lines 206–211).

### 12. Direct Colors

26+ `text-white/NN` opacity instances across sub-components (lines 92–272). Semantic icon colors: `text-rose-400` (Heart icon), `text-orange-400` (Flame), `text-violet-400` (Star earnings), `text-pink-400` (Heart breeding pairs), `text-celestial-gold` (Trophy, Award). Error state: `text-amber-400/80`. HallOfFameCard career stat cells: `bg-white/5`. This is the **highest raw-palette concentration in the family**.

### 13. Mobile Fixed Elements

None.

---

## HorseDetailPage.tsx (`/horses/:id`)

### 1. Header

No `PageHero`. Bespoke back-button `<button>` (line 416–420) followed by `HorseProfileCard` sub-component. The back-button uses raw `text-[var(--text-secondary)]` — not a shared back-nav component. The page has no formal page title element — the horse's name is the H1 inside `HorseProfileCard`.

### 2. Container

Main content: `max-w-7xl mx-auto p-4 md:p-6` (line 413). Skeleton loading state uses `max-w-6xl mx-auto px-4 py-8` (line 185) — **different max-width than the main render** (6xl vs 7xl). Error state uses `max-w-md` (line 218).

### 3. Outer Padding

`p-4 md:p-6` on the content div (line 413) adds lateral padding **on top of** DashboardLayout's `px-4 md:px-8` — double gutter.

### 4. Background

No `PageBackground` import. `DashboardLayout` provides horse-detail static background `/images/bg-horse-detail.webp`.

### 5. Surfaces

`glass-panel` CSS class: tab container (line 464), error state panel (line 218), profile card wrapper in `HorseProfileCard.tsx` (line 69). The tab container also adds `rounded-lg` redundantly. A **panel-inside-panel** anti-pattern appears: the outer `glass-panel` tab container (line 464) wraps tab content that itself uses `bg-[var(--bg-midnight)]` cards inside OverviewTab, HealthVetTab, PedigreeTab, etc. — effectively nested surfaces.

`HorseProfileCard` quick-stats grid (line 223–236): uses `bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]` — a bespoke stat cell, not `glass-panel`.

### 6. Radii

`rounded-lg` (tab container, profile card, multiple tab cells), `rounded-full` (trait chips in OverviewTab), `rounded-xl` (tab content cells in Genetics).

### 7. Buttons

Shared `<Button>` for CTAs: Train, Enter Competition, View Parents (lines 443–461). **Bespoke manual tab buttons**: 13 tabs rendered via `{tabs.map((tab) => <button ... className="...">)}` (lines 471–487) with `role="tab"` attributes — correct ARIA but NOT using CelestialTabs. This is the **only page in the family that uses a manual button-row tab system** instead of CelestialTabs.

Back-button (line 416–420): raw `<button>` with custom styles. The edit-name button in `HorseProfileCard` (line 192–200) is also a raw `<button>`. Count of raw command buttons in this family file: **~4** (back, edit-name trigger, cancel-edit, temperament-reference).

Multiple primary actions co-exist on the same surface (Train + Enter Competition + View Parents all at the same level, lines 442–461).

### 8. Tabs

**Manual button-row with `role="tablist"`** (line 467) — 13 tabs. Does NOT use CelestialTabs. Inconsistent with StableView and MyStablePage.

### 9. Forms

Inline rename form in `HorseProfileCard` (line 89–104): raw `<input>` styled with `fantasy-title text-2xl ... bg-[var(--glass-bg)] border border-burnished-gold/40 rounded-lg px-3 py-1`. Not a shared input component.

### 10. Dialogs/Modals

- `ListForSaleModal` (horse-detail/ListForSaleModal.tsx): **page-local** `fixed inset-0` overlay with `glass-panel-heavy`. Not `GameDialog`.
- `RiderPickerModal` (horse-detail/RiderPickerModal.tsx): **page-local** `fixed inset-0` overlay with `glass-panel-heavy`. Not `GameDialog`.
- `TemperamentReferenceModal` (shared component from `@/components/horse/TemperamentReferenceModal`).

### 11. Async States

- **Loading**: Full-page skeleton using `SkeletonBase` (lines 183–211). Lazy-tab loading: `<Loader2 className="w-8 h-8 animate-spin text-burnished-gold">` inline for Genetics, Coat, Training tabs (lines 500–530) — uses raw `text-burnished-gold` palette class.
- **Error**: Bespoke `glass-panel` panel with `text-red-400` icon (line 218–240).
- **Empty**: Tab-specific empty states inside individual tab components.

### 12. Direct Colors

`text-red-400` (error icon, line 219). `text-burnished-gold` in Suspense fallbacks (lines 503, 514, 528). `bg-emerald-900/30 border border-emerald-500/40 text-emerald-400` for "For Sale" badge in HorseProfileCard (line 184). `border-burnished-gold/40` for rename input. Raw `pb-20` bottom padding (line 403) compensating for HorseActionBar height.

### 13. Mobile Fixed Elements

`HorseActionBar` (portaled via `createPortal` to `document.body`) renders `fixed bottom-0 left-0 right-0 z-[var(--z-modal)]` (HorseActionBar.tsx line 74). The page root compensates with `pb-20` (line 403). The `z-[var(--z-modal)]` z-index is the same as the modal stack, potentially conflicting. On mobile, this **collides with BottomNav** which is also `fixed bottom-0`.

---

## FoalDetailPage.tsx (`/foals/:id`)

### 1. Header

None. Back link is an `<a>/<Link>` element (line 86–91), not a styled header. No `PageHero`, no `<h1>` at the page level — the foal's name is an `<h1>` inside the summary card (line 96–98).

### 2. Container

No `max-w-*` wrapper. Root is `<div className="space-y-5">` (line 84) — relies entirely on DashboardLayout gutters.

### 3. Outer Padding

None added at page level — correct.

### 4. Background

No `PageBackground` import. `DashboardLayout` derives `scene: 'breeding'` for `/foals/*`.

### 5. Surfaces

`glass-panel rounded-2xl` for all state panels (error states lines 40, 68; data panels lines 95, 117). All four panels have an explicit `border` override on top of `glass-panel` — `border border-red-500/30`, `border border-[rgba(201,162,39,0.2)]`, `border border-[rgba(201,162,39,0.15)]`. This overrides the shared component's border, fragmenting visual consistency.

### 6. Radii

`rounded-2xl` on all panels (inconsistent with most other family members using `rounded-lg` or `rounded-[var(--radius-lg)]`).

### 7. Buttons

No buttons in the page itself. `FoalDevelopmentTracker` component (imported) handles all actions.

### 8. Tabs

None.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading**: Centered `<Loader2>` spinner (line 59) with `text-[var(--gold-400)]` — uses CSS variable correctly.
- **Error**: `glass-panel rounded-2xl border border-red-500/30` with `text-red-400` icon (lines 40–52, 68–80).
- **Invalid ID**: Same `glass-panel` error pattern (lines 40–52).

### 12. Direct Colors

`text-red-400` (2 instances for AlertCircle icons, lines 42, 70). Raw `rgba(201,162,39,0.2)` and `rgba(201,162,39,0.15)` in border overrides (lines 95, 117).

### 13. Mobile Fixed Elements

None.

---

## horse-detail/HorseActionBar.tsx

### Fixed Bottom Bar

Renders via `createPortal(…, document.body)` as `fixed bottom-0 left-0 right-0 z-[var(--z-modal)]` (line 74). Uses `backdrop-blur-sm`. Contains **9 action buttons**, all using the shared `<Button size="sm">` component — correct button usage. Inner container is `max-w-7xl mx-auto px-4 py-3`.

**Critical collision**: On mobile (< 768px), this bar sits at the same bottom-0 position as `BottomNav`. The parent page uses `pb-20` as a manual compensation, but there is no shared CSS variable (like `--bottom-nav-height`) accounting for the compound height of both bars stacked. The `z-[var(--z-modal)]` z-index means the action bar draws above modals when both are present.

---

## horse-detail/ListForSaleModal.tsx

### Dialog Implementation

Page-local `fixed inset-0` overlay (line 38) with `backdrop-blur-sm`. Container: `max-w-sm glass-panel-heavy rounded-xl`. Title: raw `text-white/90`. Label: raw `text-white/50`. Input: raw `bg-white/5 border border-white/20 text-white/90` — no shared form component. Uses shared `<Button>` for Cancel/Confirm. **Should use `GameDialog`** (as HorseEquipPage does) for consistency.

---

## horse-detail/RiderPickerModal.tsx

### Dialog Implementation

Page-local `fixed inset-0` overlay (line 36) with `backdrop-blur-sm`. Container: `glass-panel-heavy rounded-xl max-w-sm`. Rider list items: raw `<button className="w-full text-left glass-panel hover:border-burnished-gold/40">` — raw command button (count: ~N per rider). Uses shared `<Button>` for Cancel. **Should use `GameDialog`** for consistency.

---

## horse-detail/GeneticsTab.tsx and genetics/ sub-components

### Color Usage

The Genetics subtree is the most egregious palette offender in the family. Sub-components use **raw `rgb()` and `rgba()` literals** throughout instead of CSS variables:

- `text-[rgb(220,235,255)]` — section headings and body text (replaces `var(--text-primary)` / `var(--cream)`)
- `text-[rgb(160,175,200)]` — muted text (replaces `var(--text-secondary)` / `var(--text-muted)`)
- `bg-[rgba(15,35,70,0.4)]` and `bg-[rgba(15,35,70,0.5)]` — card backgrounds (replaces `var(--bg-midnight)`)
- `bg-[rgba(37,99,235,0.08)]`, `border border-[rgba(37,99,235,0.2)]` — blue tint borders (no token equivalent)
- `text-red-400`, `border border-red-500/30`, `bg-red-500/10` — error states
- `text-emerald-400`, `border border-emerald-500/30`, `bg-emerald-500/10` — success states
- `border-purple-500/30` in TraitInteractionsSection (line 26)

Approximate count of raw `rgb()/rgba()` in genetics subtree: **~40+ distinct usages**.

### Tab Note

No tab system inside GeneticsTab itself — it is a tab panel rendered by the parent's manual tablist.

---

## horse-detail/TrainingTab.tsx

### Color Usage

Same `rgb()` / `rgba()` literal pattern as the genetics subtree: `text-[rgb(220,235,255)]`, `text-[rgb(160,175,200)]`, `bg-[rgba(15,35,70,0.4)]`, `border border-[rgba(37,99,235,0.2)]` (lines 228–236).

### Surface

`glass-panel border border-red-500/30 rounded-lg` for error states, `glass-panel rounded-lg` for session panels.

---

## horses/HorseEquipPage.tsx (`/horses/:id/equip`)

### 1. Header

`PageHero` with `title="Equip"` and `subtitle="Tack and feed available for this horse"` (line 103). Back-button rendered as a raw `<button>` inside PageHero's children slot (line 104–110).

### 2. Container

`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8` (line 113) — re-adds lateral padding on top of DashboardLayout gutters (**double gutter duplication**).

### 3. Background

No `PageBackground`. DashboardLayout resolves `/horses/:id/equip` to `'horse-detail'` scene.

### 4. Surfaces

Shared `CardGrid` and `ItemCard` components. One `glass-panel` for empty feed state (line 224). Loading/error states use raw `<div>` without glass-panel.

### 5. Dialogs

Uses `GameDialog` / `GameDialogContent` / `GameDialogHeader` (shared, lines 330–339) — **the only horse-entity page to use GameDialog correctly**.

### 6. Async States

- **Loading**: Raw `<Loader2>` centered (line 84–87).
- **Error**: Raw `<AlertCircle>` + `<p>` (line 91–96). No ErrorCard, no glass-panel.

### 7. Direct Colors

None found (0 raw palette classes or rgb/rgba literals in this file).

---

## Cross-Cutting Findings

### /stable vs /my-stable Route Duplication

- `StableView.tsx` at `/stable`: bespoke header, CelestialTabs, horse grid. Title: "My Stable".
- `MyStablePage.tsx` at `/my-stable`: PageHero, CelestialTabs, stable profile/HOF. Title: "My Stable".
- Both appear in `ASIDE_ROUTES` in DashboardLayout (line 21).
- Index.tsx at `/` ALSO renders an H1 of "My Stable".
- Three distinct pages share the same user-facing title. The conceptual split (horse browser vs stable profile) is not communicated by the title.

### HorseCard Duplication

Two separate horse-card implementations exist in the family:

1. `frontend/src/pages/Index.tsx` — `HorseCard` local function (lines 36–178), 143-line bespoke card.
2. `frontend/src/components/horse/HorseCard.tsx` — shared card imported in `StableView.tsx`.

These produce inconsistent visual output and diverge in maintenance.

### Tab System Inconsistency

- `StableView.tsx`: CelestialTabs ✓
- `MyStablePage.tsx`: CelestialTabs (controlled) ✓
- `HorseDetailPage.tsx`: manual `role="tablist"` button-row ✗ (13 tabs)

### Modal Inconsistency

- `HorseEquipPage.tsx`: GameDialog ✓
- `ListForSaleModal.tsx`: page-local `fixed inset-0` ✗
- `RiderPickerModal.tsx`: page-local `fixed inset-0` ✗

### Container Width Fragmentation

Five distinct container widths in use: `max-w-5xl` (MyStablePage content, HorseEquipPage), `max-w-6xl` (HorseDetailPage skeleton), `max-w-7xl` (HorseDetailPage main, StableView header, HorseActionBar), `max-w-md` (HorseDetailPage error panel), `max-w-sm` (modals). No unified container token for page-level content.

### Outer Padding Duplication

`DashboardLayout` already applies `px-4 md:px-8` to all page content. Pages that add their own `px-4 sm:px-6 lg:px-8`:

- `StableView.tsx` header (line 399)
- `MyStablePage.tsx` content wrapper (line 417)
- `HorseEquipPage.tsx` content wrapper (line 113)

This creates double gutters of 32px+ on tablet/desktop.

### Backdrop-Blur Usage Outside Shared Primitives

6 total usages:

1. `Index.tsx` line 83 — `[backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)]` inline
2. `Index.tsx` line 183 — same inline
3. `Index.tsx` line 275 — `[backdrop-filter:blur(10px)]` inline
4. `StableView.tsx` line 411 — `[backdrop-filter:var(--glass-bg-filter)]` (tokenised, acceptable)
5. `HorseActionBar.tsx` line 74 — `backdrop-blur-sm`
6. `ListForSaleModal.tsx` line 38 — `backdrop-blur-sm`
7. `RiderPickerModal.tsx` line 36 — `backdrop-blur-sm`

Usages 1–3 and 5–7 are outside shared primitives.

### Raw Palette Color Hotspots

| File                                      | Approximate raw color hits               |
| ----------------------------------------- | ---------------------------------------- |
| `MyStablePage.tsx` (incl. sub-components) | 26+ `text-white/NN`, 5 named icon colors |
| `horse-detail/genetics/*`                 | 40+ `rgb()`, `rgba()` literals           |
| `horse-detail/GeneticsTab.tsx`            | 8 `rgb()` literals                       |
| `horse-detail/TrainingTab.tsx`            | 4 `rgb()`/`rgba()` literals              |
| `horse-detail/ListForSaleModal.tsx`       | 7 `text-white/NN`                        |
| `Index.tsx`                               | 10 `rgba()` inline                       |
