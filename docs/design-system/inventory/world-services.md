# World-Services Family — Design-System Inventory

**Scope:** All routed pages under the World hub that are located in-game services or shops.
Files audited: `VeterinarianPage.tsx`, `FarrierPage.tsx`, `FeedShopPage.tsx`, `TackShopPage.tsx` (+ `tack-shop/` sub-folder: `ShopTab.tsx`, `HorsesTackTab.tsx`, `TackItemCard.tsx`, `DecorationsPanel.tsx`, `constants.ts`), `GroomsPage.tsx`, `RidersPage.tsx`, `TrainersPage.tsx`, `CraftingPage.tsx`, `WorldHubPage.tsx`.

The world-services family is largely well-converged on shared primitives: every page uses `PageHero` for its title block, `CelestialTabs` or an explicit hand-rolled tab row (Grooms/Riders/Trainers), `glass-panel` for info panels, and `ItemCard`/`HorseCard`/`CardGrid` for item grids. The four service-booking pages (Vet, Farrier, TackShop, FeedShop) share an identical banner-image wrapper pattern using `max-w-[52rem]`. The main inconsistencies are: the staff-hire pages (Grooms, Riders, Trainers) use a bespoke `bg-white/5` button-row tab instead of `CelestialTabs`; `FeedShopPage` uses a different content container width (`max-w-5xl`) than the surrounding layout; `CraftingPage` uses raw Tailwind palette colors extensively for recipe-status badging; and `FeedShopPage`'s quantity/buy buttons are hand-styled gold-gradient `<button>` elements instead of the shared `Button` component.

---

## Summary Table

| Page                       | Header                        | Content max-w                             | Banner                | Tabs                 | Raw palette colors        | Hand-styled cmd buttons | Backdrop-blur |
| -------------------------- | ----------------------------- | ----------------------------------------- | --------------------- | -------------------- | ------------------------- | ----------------------- | ------------- |
| VeterinarianPage           | PageHero (mood="nature")      | max-w-7xl (tabs) + max-w-[52rem] (banner) | Yes — glass card      | CelestialTabs        | 0                         | ~4 (booking panel)      | 2             |
| FarrierPage                | PageHero (mood="nature")      | max-w-7xl + max-w-[52rem]                 | Yes — glass card      | CelestialTabs        | 0                         | ~4 (service actions)    | 1             |
| FeedShopPage               | PageHero (mood="nature")      | max-w-5xl + max-w-[52rem]                 | Yes — glass card      | None (single-screen) | 0                         | 3 (qty −/+ and Buy)     | 1             |
| TackShopPage               | PageHero (mood="golden")      | max-w-7xl + max-w-[52rem]                 | Yes — glass card      | CelestialTabs        | 0 (page) / ~6 (sub-files) | ~3 (ShopTab)            | 1             |
| GroomsPage                 | PageHero (mood="nature")      | max-w-7xl                                 | None                  | Manual button-row    | 4 (text-white/NN)         | 2 tab buttons           | 0             |
| RidersPage                 | PageHero (mood="competitive") | max-w-7xl                                 | None                  | Manual button-row    | 4 (text-white/NN)         | 2 tab buttons           | 0             |
| TrainersPage               | PageHero (mood="default")     | max-w-7xl                                 | None                  | Manual button-row    | 4 (text-white/NN)         | 2 tab buttons           | 0             |
| CraftingPage               | PageHero (mood="default")     | max-w-5xl                                 | None                  | None (single-screen) | ~13                       | 0 (uses Button)         | 0             |
| WorldHubPage               | PageHero (mood="default")     | max-w-7xl                                 | None (location cards) | None                 | 0 (inline rgba in JS)     | 0                       | 0             |
| tack-shop/ShopTab          | — (sub-component)             | (inherits)                                | —                     | —                    | ~3                        | ~2                      | 0             |
| tack-shop/HorsesTackTab    | —                             | (inherits)                                | —                     | —                    | 1 (text-red-400/60)       | 1                       | 0             |
| tack-shop/TackItemCard     | —                             | (inherits)                                | —                     | —                    | 2 (purple, see constants) | 1                       | 0             |
| tack-shop/constants        | —                             | —                                         | —                     | —                    | 6 (tier badge classes)    | —                       | —             |
| tack-shop/DecorationsPanel | —                             | (inherits)                                | —                     | —                    | 0                         | 1 (Unequip)             | 0             |

---

## VeterinarianPage.tsx

### 1. Header

`PageHero` with `title="Vet Clinic"`, `subtitle="Health checks, treatments, and genetics analysis for your horses"`, `mood="nature"`, `icon={<Leaf .../>}`. Breadcrumb child passed as `children`. Consistent with family.

### 2. Container

Two distinct wrappers on the same page:

- **Line 325:** `max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4` — banner image block.
- **Line 335:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8` — tabs + info panel.

The banner and the tab content have **different** max-widths. The banner sits narrower than the card grid below it, causing a visual width jump.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` is added at both wrapper `<div>`s directly (lines 325, 335). If `DashboardLayout` already provides horizontal gutters these are duplicating them.

### 4. Background

No `PageBackground`. No page-local gradient. Banner image in a glass card.

### 5. Surfaces

- **Line 131:** Booking panel — `rounded-xl border border-[var(--gold-dim)] bg-[var(--glass-bg)] backdrop-blur-sm p-5` (bespoke, not `glass-panel`).
- **Line 326:** Banner wrapper — `p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20` (bespoke).
- **Line 368:** Info panel — `glass-panel` class (canonical).
- Notable: the booking panel (line 131) uses `border-[var(--gold-dim)]` instead of `border-[var(--glass-border)]` — inconsistent border token vs. the banner wrapper.
- Nested surface: booking panel (glass-bg surface) sits inside the max-w-7xl wrapper that is itself inside the page. Not nested panel-in-panel, but the booking panel IS inside a tab panel which is inside a `CelestialTabs` container.

### 6. Radii

`rounded-xl` (booking panel, info panel, image), `rounded-2xl` (banner wrapper), `rounded-lg` (service booking buttons, empty-state CTA).

### 7. Buttons

- **Line 151–174:** Service booking buttons in the booking panel are raw `<button>` with full inline class strings including conditional color logic. Approximately **4 raw command buttons** per service card (one per service, rendered in a grid). These are NOT using the shared `Button` component.
- Empty-state CTA at line 100–105: raw `<button>`-styled `<Link>` with `bg-[var(--status-success)]/10 ... rounded-lg`.
- No shared `Button` import in this file.
- Multiple primary actions on one surface: yes — the booking panel shows one booking button per service (potentially 6+ at once for the same horse).

### 8. Tabs

`CelestialTabs` (canonical), controlled mode, two tabs: "My Horses" and "Services". Line 336.

### 9. Forms

No form inputs. Service selection is via button clicks only.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading:** Spinner (`Loader2 animate-spin`) + text label. Lines 64–69, 196–200.
- **Error:** `AlertCircle` icon + paragraph. Lines 72–84, 203–215.
- **Empty:** Icon + heading + description + CTA link. Lines 86–108, 217–230.
  No shared `ErrorCard` component used.

### 12. Direct Colors

**0 raw Tailwind palette classes** in this file. All colors via CSS vars or opacity modifiers on CSS vars. `text-[var(--gold-400)]`, `text-[var(--status-danger)]/60` etc.
The `shadow-black/20` on line 326 uses the Tailwind `black` color token (not a palette color per se but an opaque utility).

### 13. Mobile Fixed Elements

None.

---

## FarrierPage.tsx

### 1. Header

`PageHero` with `title="The Farrier"`, `subtitle="Hoof trimming, shoeing, and corrective care for your horses"`, `mood="nature"`, `icon={<Leaf .../>}`. Breadcrumb child. Matches Vet Clinic pattern exactly.

### 2. Container

- **Line 342:** `max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4` — banner.
- **Line 352:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8` — tabs + info.

Same dual-width split as `VeterinarianPage`.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on both wrappers (lines 342, 352). Same duplication concern as Vet.

### 4. Background

No `PageBackground`. Banner image in glass card.

### 5. Surfaces

- **Line 343:** Banner wrapper — `p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20` (bespoke, identical to Vet's banner).
- **Line 354–357:** Booking success banner — `p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20` (inline bespoke).
- **Line 361–363:** Error banner — `p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20` (inline bespoke).
- **Line 402:** Info panel — `glass-panel` (canonical).
- **Lines 98–111:** Selection confirmation banner — `p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20`.
- **Lines 194–206:** "no horse selected" nudge — `p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]`.
- **Lines 208–213:** Booking context bar — `p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20`.

All the inline status banners are structurally identical but repeated in code — no shared alert/banner component.

### 6. Radii

`rounded-xl` (banners, info panel), `rounded-2xl` (banner wrapper), `rounded-lg` (buttons), `rounded-lg` (fallback icon placeholder at line 256).

### 7. Buttons

- **Line 103–109:** "View Services" button — raw `<button>` with `px-4 py-1.5 bg-[var(--status-success)]/10 ... rounded-lg`.
- **Line 198–205:** "My Horses" nav button — raw `<button>`.
- **Lines 224–245:** Service "Book" button in `ServicesTab` — raw `<button>` with inline conditional class string (canBook/isBooking states). Approximately **1 button per service card** = many raw command buttons.
- No `Button` component imported or used.
- Multiple primary actions: one Book button per service card when a horse is selected.

### 8. Tabs

`CelestialTabs` (canonical), controlled mode, two tabs: "My Horses" and "Services". Lines 367–399.
Notable: "View Services" and "My Horses" navigation buttons within tab content programmatically switch tabs by calling `setActiveTab` — this cross-tab affordance is a useful pattern.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading:** `Loader2` spinner + text. Lines 49–55, 150–155.
- **Error:** `AlertCircle` + paragraph. Lines 57–69, 158–169.
- **Empty:** Icon + heading + description + stable link. Lines 71–93, 172–187.

### 12. Direct Colors

**0 raw Tailwind palette classes** in this file. All via CSS vars.

### 13. Mobile Fixed Elements

None.

---

## FeedShopPage.tsx

### 1. Header

`PageHero` with `title="Feed Shop"`, `subtitle="Buy feed in 100-unit packs..."`, `mood="nature"`, `icon={<Leaf .../>}`. Breadcrumb child. Consistent with Vet/Farrier.

### 2. Container

- **Line 73:** `max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4` — banner.
- **Line 83:** `max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6` — catalog grid.

The catalog uses `max-w-5xl` while Vet/Farrier/TackShop use `max-w-7xl` for their tab area. **Inconsistent content width** within the family.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on both wrappers. Same duplication concern.

### 4. Background

No `PageBackground`. Banner image in glass card.

### 5. Surfaces

- **Line 74:** Banner wrapper — `p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20` (identical to Vet/Farrier banner pattern).
- **Lines 90–96:** Error alert — `p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20`.
- Individual `ItemCard` instances via `CardGrid`.
- No `glass-panel` info panel at the bottom (unlike Vet/Farrier/TackShop/Grooms/Riders/Trainers — this page **omits the info panel**).

### 6. Radii

`rounded-2xl` (banner wrapper), `rounded-xl` (error alert), `rounded-lg` (qty buttons, buy button, item card image).

### 7. Buttons

- **Lines 110–121:** Decrement `−` button — raw `<button>` with full gold-gradient class: `w-8 h-8 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-bold shadow-[0_2px_10px_rgba(201,162,39,0.35)] hover:brightness-110 ...`.
- **Lines 128–133:** Increment `+` button — identical raw `<button>` with gold gradient.
- **Lines 141–155:** Buy button — raw `<button>` with `btn-cobalt` utility class AND a full `bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]` inline style; also includes `shadow-[0_4px_20px_rgba(201,162,39,0.4)]`.

**3 raw command buttons per feed tier card** (− / + / Buy). The Buy button uses both `btn-cobalt` class AND redundant inline gradient classes, suggesting incomplete migration from the old gold-button component. No `Button` component used.

### 8. Tabs

None — single-screen layout.

### 9. Forms

None. Quantity selection via `+/-` buttons, not `<input>`.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading:** `Loader2` only (no text label). Line 85–87. `text-white/30` — raw opacity color.
- **Error:** `AlertCircle` + error message. Lines 89–96.
- **Empty:** Not explicitly handled (catalog renders when data is present).

### 12. Direct Colors

- **Line 87:** `text-white/30` — raw `white` Tailwind opacity pattern.
- Otherwise 0 raw palette classes. = **1 raw color token** in this file.

### 13. Mobile Fixed Elements

None.

---

## TackShopPage.tsx

### 1. Header

`PageHero` with `title="Tack Shop"`, `subtitle="Saddles, bridles, and specialist gear to boost your horses in competition"`, `mood="golden"`, `icon={<ShoppingBag .../>}`. Breadcrumb child. Uses `mood="golden"` — different from Vet/Farrier (`"nature"`).

### 2. Container

- **Line 60:** `max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4` — banner.
- **Line 70:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8` — tabs + info.

Matches Vet/Farrier container pattern.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on both wrappers (lines 60, 70).

### 4. Background

No `PageBackground`. Banner image in glass card.

### 5. Surfaces

- **Line 61:** Banner wrapper — `p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20` (canonical banner pattern).
- **Line 105:** Info panel — `glass-panel` (canonical).
- Sub-components own their own surfaces (see ShopTab, HorsesTackTab, DecorationsPanel).

### 6. Radii

`rounded-2xl` (banner), `rounded-xl` (info panel).

### 7. Buttons

The page-level file itself has no raw command buttons. All action buttons delegate to sub-components.

### 8. Tabs

`CelestialTabs` (canonical), controlled mode, two tabs: "My Horses" and "Shop". Line 74.

### 9. Forms

None at page level.

### 10. Dialogs/Modals

None.

### 11. Async States

Delegated entirely to `ShopTab` and `HorsesTackTab`.

### 12. Direct Colors

**0** in page file.

### 13. Mobile Fixed Elements

None.

---

## tack-shop/ShopTab.tsx

### Surfaces

- **Lines 106–113:** Selected horse banner — `p-3 rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20`.
- **Lines 119–128:** No-horse banner — `p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]`.
- **Lines 157–162:** Success banner — `p-3 rounded-lg bg-[var(--status-success)]/10 ...`.
- **Lines 166–170:** Error banner — `p-3 rounded-lg bg-[var(--status-danger)]/10 ...`.

### Buttons / Forms

- **Line 111:** "Change horse" — raw `<button>` with `text-[var(--gold-400)] hover:text-[var(--cream)] underline text-xs`.
- **Line 125:** "Select horse" — raw `<button>`, same classes.
- **Lines 147–152:** "Clear filter" — raw `<button>`.
- **Line 134–145:** Discipline filter — raw `<select>` with inline `bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--cream)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--gold-400)]` — **no shared input component**.
- **Line 230:** Seasonal heading uses `text-amber-400` — raw palette class.
- **Line 94:** Error state uses `text-red-400/60` — raw palette class (though opacity-modified).

### Direct Colors

`text-amber-400` (line 230), `text-red-400/60` (line 94) = **~2 raw palette instances**.

---

## tack-shop/HorsesTackTab.tsx

### Surfaces

- **Line 46, 94:** Error/loading states use `text-red-400/60` — raw palette class.

### Buttons

- **Lines 104–111:** "Continue to Shop" — raw `<button>` with `bg-[var(--status-success)]/10 ... rounded-lg`.

### Direct Colors

`text-red-400/60` (lines 46) = **1 raw palette instance**.

---

## tack-shop/TackItemCard.tsx

### Surfaces

Delegates entirely to `ItemCard`. Media placeholder uses `bg-black/20`.

### Buttons

- **Lines 76–99:** Purchase action — raw `<button>` with full conditional class string.

### Direct Colors

- **Line 68:** Age restriction badge — `bg-purple-500/20 text-purple-300` = **2 raw palette instances**.
- Tier badge colors come from `constants.ts` TIER_COLORS map.

---

## tack-shop/constants.ts

### Direct Colors (TIER_COLORS map)

- `bg-slate-500/20 text-slate-300` (basic)
- `bg-blue-500/20 text-blue-300` (quality)
- `bg-amber-500/20 text-amber-300` (premium)
  = **6 raw palette class references** in constant definitions.

These are the most concentrated palette-color usage in the tack-shop sub-folder; they are defined as data-driven constants rather than scattered in JSX, which is somewhat better but still not using semantic CSS vars.

---

## tack-shop/DecorationsPanel.tsx

### Surfaces

- **Line 47:** `p-4 rounded-xl glass-panel` (canonical).
- **Line 65:** Decoration row — `p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]`.

### Buttons

- **Lines 68–76:** Unequip button — raw `<button>` with `bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] ... rounded-md`.

### Direct Colors

**0** raw palette classes. All via CSS vars.

---

## GroomsPage.tsx

### 1. Header

`PageHero` with `title="Groom Quarters"`, `subtitle="Hire and manage grooms for daily horse care"`, `mood="nature"`, `icon={<Leaf .../>}`. Breadcrumb child.

### 2. Container

- **Line 46:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8` — single container for tabs + info.
- **No** banner image section. No `max-w-[52rem]` block.

Missing the banner pattern that Vet/Farrier/FeedShop/TackShop all share.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on the content wrapper (line 46).

### 4. Background

No `PageBackground`, no banner, no background image.

### 5. Surfaces

- **Lines 48–82:** Tab row — `div` with `bg-white/5 border border-white/10 rounded-xl` — **raw white opacity** classes (not CSS vars).
- **Line 94:** Info panel — `glass-panel` (canonical).
- No bespoke surface cards at page level; delegates to `MyGroomsDashboard` and `GroomList`.

### 6. Radii

`rounded-xl` (tab row), `rounded-lg` (tab buttons).

### 7. Buttons

- **Lines 53–67:** "Manage Grooms" tab button — raw `<button role="tab">` with conditional `bg-white/10 text-white/90` vs. `text-white/40 hover:text-white/70`. **Raw white opacity** classes.
- **Lines 68–81:** "Hire Grooms" tab button — same pattern.
  = **2 raw command-style tab buttons**.
- No `Button` component; no `CelestialTabs`.

### 8. Tabs

**Manual button-row** (`div[role="tablist"]` + two `button[role="tab"]`). Uses `bg-white/5 border border-white/10` pill container. This is the **primary design-system violation** for this page: should use `CelestialTabs`.

### 9. Forms

None.

### 10. Dialogs/Modals

None at page level.

### 11. Async States

Delegated to `MyGroomsDashboard` and `GroomList`.

### 12. Direct Colors

`bg-white/5`, `border border-white/10`, `bg-white/10`, `text-white/90`, `text-white/40`, `hover:text-white/70` — **4 distinct white-opacity patterns** in the tab buttons (lines 49, 59–60, 73–74). No raw Tailwind named-color classes.

### 13. Mobile Fixed Elements

None.

---

## RidersPage.tsx

### 1. Header

`PageHero` with `title="Rider Hall"`, `subtitle="Hire and manage riders for your competition horses"`, `mood="competitive"`, `icon={<Swords .../>}`. Different mood (`"competitive"`) than Grooms (`"nature"`).

### 2. Container

- **Line 46:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8`.

### 3. Outer Padding

Same pattern as Grooms.

### 4. Background

No banner image (unlike Vet/Farrier/FeedShop/TackShop).

### 5. Surfaces

- **Lines 48–82:** Tab row — `div bg-white/5 border border-white/10 rounded-xl` — identical raw-white pattern as `GroomsPage`.
- **Line 94:** Info panel — `glass-panel`.

### 6. Radii

`rounded-xl` (tab row), `rounded-lg` (tab buttons).

### 7. Buttons

- **Lines 53–67:** "Manage Riders" — raw `<button role="tab">` with `bg-white/10 text-white/90` / `text-white/40` conditional.
- **Lines 68–81:** "Hire Riders" — same.
  = **2 raw tab buttons**, no `Button` component, no `CelestialTabs`.

### 8. Tabs

**Manual button-row** — exact copy of `GroomsPage` tab implementation (copy-pasted pattern).

### 9. Forms / Dialogs / Async

Same as Grooms — all delegated to sub-components.

### 12. Direct Colors

`bg-white/5`, `border-white/10`, `bg-white/10`, `text-white/90`, `text-white/40`, `hover:text-white/70` — **4 distinct raw white-opacity patterns** (lines 49, 59–60, 73–74).

### 13. Mobile Fixed Elements

None.

---

## TrainersPage.tsx

### 1. Header

`PageHero` with `title="Trainer Academy"`, `subtitle="Hire and manage trainers to coach your horses"`, `mood="default"`, `icon={<GraduationCap .../>}`. Different mood (`"default"`) than Riders (`"competitive"`) and Grooms (`"nature"`).

### 2. Container

- **Line 46:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8`.

### 3. Outer Padding

Same pattern.

### 4. Background

No banner image.

### 5. Surfaces

- **Lines 48–82:** Tab row — `div bg-white/5 border border-white/10 rounded-xl` — same raw-white pattern as Grooms/Riders.
- **Line 93:** Info panel — `glass-panel`.

### 6. Radii

Same as Grooms/Riders.

### 7. Buttons

- **Lines 53–67, 68–80:** Two raw `<button role="tab">` with `bg-white/10 text-white/90` / `text-white/40` conditional. **Exact copy** of GroomsPage/RidersPage tab code.

### 8. Tabs

**Manual button-row** — third identical copy across Grooms/Riders/Trainers.

### 12. Direct Colors

`bg-white/5`, `border-white/10`, `bg-white/10`, `text-white/90`, `text-white/40`, `hover:text-white/70` — same 4 white-opacity patterns (lines 49, 59–60, 73–74).

### 13. Mobile Fixed Elements

None.

---

## CraftingPage.tsx

### 1. Header

`PageHero` with `title="Leathersmith Workshop"`, `subtitle="Craft custom tack from raw materials..."`, `mood="default"`, no breadcrumb child (no `Link` or breadcrumb passed).

### 2. Container

- **Line 220:** `max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8`.

Matches `FeedShopPage` container (`max-w-5xl`), not the `max-w-7xl` used by service pages.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on the single wrapper (line 220).

### 4. Background

No banner image, no `PageBackground`.

### 5. Surfaces

- **Line 237:** Workshop tier banner — `glass-panel` class (used as wrapper, canonical). Contains `flex items-center justify-between`.
- **Line 49–56:** `MaterialChip` — `bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-2` (bespoke, uses semantic vars).
- **Lines 92–99:** `RecipeCard` — `rounded-xl border p-4` with conditional border/bg: `border-amber-600/40 bg-amber-950/20` for affordable, `border-[var(--border-subtle)] bg-[var(--bg-card)]` for others, `opacity-60` for locked — **raw palette classes** for the affordable state.
- **Lines 228–229:** Error state — `p-4 rounded-xl bg-red-950/30 border border-red-800/40 text-red-300` — **raw red palette** (not CSS var).

### 6. Radii

`rounded-xl` (recipe cards, error block), `rounded-lg` (workshop tier badge, material chips), `rounded` (small badges in recipe cards).

### 7. Buttons

- `Button` component from `@/components/ui/button` is imported and **used** (lines 155, 167, 174, 177) — `<Button size="sm">` and `<Button variant="secondary" size="sm">`. This is the **only page in the family** that correctly uses the shared `Button`.
- Confirm/Cancel two-button row in `RecipeCard` (lines 154–169) — two `Button` components: "Confirm Craft" (primary) and "Cancel" (secondary). Legitimate two-action surface.

### 8. Tabs

None — single-screen layout by tier sections.

### 9. Forms

None.

### 10. Dialogs/Modals

No modal — uses inline confirm/cancel within the same card (`confirming` state on each `RecipeCard`). Avoids modals by design.

### 11. Async States

- **Loading:** `Loader2` only, no text label (line 222–224).
- **Error:** `AlertCircle` + text, with **raw red palette** `bg-red-950/30 border border-red-800/40 text-red-300` (lines 228–229).
- **Empty recipes:** Centered icon + text (lines 271–275).

### 12. Direct Colors

`TIER_BADGE_COLORS` record (lines 30–34): `bg-gray-700 text-gray-300`, `bg-amber-900/60 text-amber-300`, `bg-sky-900/60 text-sky-300`, `bg-purple-900/60 text-purple-300`.
`text-red-400` in `MaterialRequirement` (line 65).
`border-amber-600/40 bg-amber-950/20` in `RecipeCard` affordable state (line 97).
`bg-purple-900/40 text-purple-300` cosmetic badge (line 109).
`bg-emerald-900/40 text-emerald-300` bonus badge (line 113).
`text-emerald-400` icon (line 123).
`text-amber-400` cost label (line 129).
`text-amber-500/80` lock reason (line 144).
`text-red-400` deficit (line 148).
`bg-red-950/30 border border-red-800/40 text-red-300` error block (line 228).
`text-amber-600/60` workshop icon (line 246).

Total distinct raw palette hits: **≈ 13 unique class references** across the file.

### 13. Mobile Fixed Elements

None.

---

## WorldHubPage.tsx

### 1. Header

`PageHero` with `title="The World of Equoria"`, `subtitle="Explore the realm — visit locations..."`, `mood="default"`, `icon={<Globe .../>}`. No breadcrumb (hub is top-level).

### 2. Container

- **Line 128:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12`.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on the single wrapper.

### 4. Background

No `PageBackground`. Location cards each receive per-card `paintingGradient` and `backgroundImage` props passed inline as JS data (not as Tailwind classes). Gradients are `linear-gradient` values with `rgba()` inline color literals — **10 distinct rgba gradient strings** in the `worldLocations` array (lines 22–115), but these are JS object values passed as props, not JSX class strings.

### 5. Surfaces

The `<section>` contains `LocationCard` components only; no wrapper surface. The `LocationCard` component handles its own glass/gradient surface internally.

### 6. Radii

None applied at page level (delegated to `LocationCard`).

### 7. Buttons

None at page level.

### 8. Tabs

None.

### 9. Forms / Dialogs

None.

### 11. Async States

None — purely static routing map.

### 12. Direct Colors

**0 raw Tailwind palette classes** in this file. The `rgba()` values in `paintingGradient` strings are inline JS, not Tailwind classes.

### 13. Mobile Fixed Elements

None.

---

## Cross-Cutting Findings

### Tab Implementation Split

Three pages (GroomsPage, RidersPage, TrainersPage) use an **identical copy-pasted manual button-row tab** (`div bg-white/5 ... + button[role="tab"]`) instead of `CelestialTabs`. The code is duplicated verbatim across all three files with only labels/icons differing. The four service pages (Vet, Farrier, TackShop, FeedShop) correctly use `CelestialTabs`. FeedShop and CraftingPage use no tabs (single-screen).

### Banner Pattern

Vet, Farrier, FeedShop, and TackShop all share an **identical** banner wrapper:

```
max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4
  └── p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20
        └── <img className="w-full h-auto rounded-xl" />
```

Grooms, Riders, Trainers, Crafting, and WorldHub have no banner. This pattern is a good candidate for extraction into a shared `ServiceBanner` component.

### Info Panel Consistency

All pages except `FeedShopPage` and `WorldHubPage` end with a `glass-panel` info bullet list. `FeedShopPage` is the only service page that omits this pattern.

### Currency Rendering

- Vet/Farrier/TackShop: `$${service.cost.toLocaleString()}` — dollar prefix.
- FeedShop: `coins` text suffix (e.g. `{totalCost} coins`), subtitle `${tier.packPrice} coins / 100-unit pack`.
- Crafting: `💰 {recipe.cost} coins` — emoji prefix + "coins" suffix.
  Three different currency presentation styles in one family.

### Container Width Inconsistency

| Page                                                       | Content max-w   |
| ---------------------------------------------------------- | --------------- |
| Vet, Farrier, TackShop, Grooms, Riders, Trainers, WorldHub | `max-w-7xl`     |
| FeedShop, Crafting                                         | `max-w-5xl`     |
| Banner block (Vet, Farrier, FeedShop, TackShop)            | `max-w-[52rem]` |

### Backdrop-blur Outside Shared Primitives

- `VeterinarianPage` line 131: booking panel (`backdrop-blur-sm`).
- `VeterinarianPage` line 326: banner wrapper (`backdrop-blur-sm`).
- `FarrierPage` line 343: banner wrapper (`backdrop-blur-sm`).
- `FeedShopPage` line 74: banner wrapper (`backdrop-blur-sm`).
- `TackShopPage` line 61: banner wrapper (`backdrop-blur-sm`).

The banner wrapper `backdrop-blur-sm` appears on 4 pages identically — another candidate for a shared component.

### Raw Button Implementations (Not Using `Button`)

| Page / File                | Count  | Description                              |
| -------------------------- | ------ | ---------------------------------------- |
| VeterinarianPage           | ~4+    | Inline booking buttons per service       |
| FarrierPage                | ~4+    | Booking/nav buttons                      |
| FeedShopPage               | 3/card | Gold-gradient qty and buy buttons        |
| tack-shop/ShopTab          | 3      | Change horse, select horse, clear filter |
| tack-shop/HorsesTackTab    | 1      | Continue to Shop                         |
| tack-shop/TackItemCard     | 1      | Purchase button                          |
| tack-shop/DecorationsPanel | 1      | Unequip button                           |
| GroomsPage                 | 2      | Tab buttons                              |
| RidersPage                 | 2      | Tab buttons                              |
| TrainersPage               | 2      | Tab buttons                              |

Only `CraftingPage` uses the shared `Button` component.

### Raw Palette Color Concentration

`CraftingPage` is the highest-offender with ~13 raw Tailwind palette class references. `tack-shop/constants.ts` contributes 6 tier-badge color class definitions. The staff-hire pages (Grooms/Riders/Trainers) contribute 4 white-opacity patterns each via the manual tab buttons.
