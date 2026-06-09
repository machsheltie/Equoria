# Design-System Inventory — Workflow Pages Family

The **workflow-pages** family covers the five primary gameplay-action surfaces in Equoria: training, breeding (shell + pair-selection sub-component + predictions panel), competition browsing, competition results, conformation shows redirect, and leaderboards. All six routed pages use `PageHero` as their header component and `max-w-7xl` as their primary container width, which gives the family a high degree of structural consistency. The main friction points are: (1) `CompetitionResultsPage` contains a cluster of raw Tailwind palette colors (blue, red, yellow, emerald, purple) in inline stat-card and empty-state components that bypass the CSS-variable token system; (2) `BreedingPredictionsPanel` uses a legacy theme (`midnight-ink`, `forest-green`, `saddle-leather`) that predates Celestial Night; (3) `CompetitionBrowserPage` implements its tab bar with hand-rolled `<button>` elements instead of a shared tab primitive; (4) `LeaderboardsPage` uses a `rgba(239,68,68,0.1)` raw inline hex/rgba value for its error card instead of a semantic token; and (5) `BreedingPairSelection` contains a hand-styled primary CTA `<button>` instead of the shared `Button` component.

---

## Summary Table

| Page / File              | Header                  | Container                            | Outer Padding        | Tabs                    | Raw Palette Colors                       | Hand-styled Buttons  | Modals                                                         |
| ------------------------ | ----------------------- | ------------------------------------ | -------------------- | ----------------------- | ---------------------------------------- | -------------------- | -------------------------------------------------------------- |
| TrainingPage             | PageHero (default mood) | max-w-7xl / max-w-6xl (guard states) | px-4 sm:px-6 lg:px-8 | None                    | 0                                        | 0                    | None                                                           |
| BreedingPage             | PageHero (mystic mood)  | max-w-7xl                            | px-4 sm:px-6 lg:px-8 | None                    | 0                                        | 0                    | None (delegates)                                               |
| BreedingPairSelection    | None (sub-component)    | None (space-y-5 wrapper)             | None                 | None                    | ~6 (red, emerald)                        | 2                    | BreedingConfirmationModal (BaseModal), CinematicMoment         |
| BreedingPredictionsPanel | None (sub-component)    | None                                 | None                 | None                    | ~4 (red, blue) + legacy tokens           | 0                    | None                                                           |
| CompetitionBrowserPage   | PageHero (competitive)  | max-w-7xl                            | px-4 sm:px-6 lg:px-8 | Manual `<button>` row   | 0                                        | 2 (tab buttons)      | CompetitionDetailModal (BaseModal)                             |
| CompetitionResultsPage   | PageHero (competitive)  | max-w-7xl                            | px-4 sm:px-6 lg:px-8 | GoldTabs                | ~14 (blue, yellow, emerald, purple, red) | 2 (retry + CTA link) | CompetitionResultsModal (BaseModal), PerformanceBreakdownPanel |
| ConformationShowsPage    | None (redirect)         | N/A                                  | N/A                  | N/A                     | 0                                        | 0                    | None                                                           |
| LeaderboardsPage         | PageHero (competitive)  | max-w-7xl                            | px-4 sm:px-6 lg:px-8 | None (filter component) | ~3 (red) + 1 rgba                        | 1 (retry)            | LeaderboardHorseDetailModal (BaseModal)                        |

---

## TrainingPage

**File:** `frontend/src/pages/TrainingPage.tsx`

### 1. Header

Uses `PageHero` with `mood="default"`, `title="Training Grounds"`, and a `subtitle`. An icon (`<Swords>`) and a breadcrumb child slot (World / Training Grounds) are passed. The breadcrumb uses `text-[var(--cream)]/60` opacity-on-cream pattern. No bespoke header.

### 2. Container

- Main content: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8` (line 65)
- Guard/loading states use a narrower `mx-auto max-w-6xl px-4 py-12` (lines 23, 36)
- Two distinct widths for the same page — inconsistency between unauthenticated guard and main layout.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` applied at the content wrapper (line 65). Guard states add `px-4 py-12`. These are page-level padding additions that may double-up on any surrounding `DashboardLayout` gutters.

### 4. Background

No `PageBackground` import or usage. No local background images. Relies on the inherited app background.

### 5. Surfaces

- `glass-panel-subtle rounded-xl p-8` for loading state (line 24)
- `glass-panel rounded-xl p-8` for unauthenticated state (line 37)
- `glass-panel rounded-xl p-5` for the info panel at the bottom (line 70)
- No nested cards (panel-in-panel).

### 6. Radii

`rounded-xl` (lines 24, 37, 70). No `rounded-2xl` or `rounded-lg`.

### 7. Buttons

No `<button>` or `<Button>` elements in this shell page. All interactive controls live in `TrainingDashboard`.

### 8. Tabs

None in this shell.

### 9. Forms

None.

### 10. Dialogs/Modals

None in this shell; any modals are inside `TrainingDashboard`.

### 11. Async States

- Loading: custom spinner (border-animate) + text inside `glass-panel-subtle` (line 22–32)
- Unauthenticated guard: custom panel with icon + text (line 34–45)
- No dedicated error state at page level

### 12. Direct Colors

Zero raw Tailwind palette classes. Uses CSS variables exclusively (`var(--gold-400)`, `var(--text-muted)`, `var(--cream)`).

### 13. Mobile Fixed Elements

None.

---

## BreedingPage

**File:** `frontend/src/pages/BreedingPage.tsx`

### 1. Header

`PageHero` with `mood="mystic"`, `title="Breeding Hall"`. No decoration or breadcrumb child slot. Clean delegation.

### 2. Container

- Main content: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12` (line 51)
- Guard states: `mx-auto max-w-7xl px-4 py-12` (lines 18, 31) — same width as main; consistent.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` at the content wrapper (line 51). Guard states add `px-4 py-12`.

### 4. Background

No `PageBackground`. No local images or gradients.

### 5. Surfaces

- `glass-panel-subtle rounded-xl p-8` for loading guard (line 19)
- `glass-panel rounded-xl p-8` for unauthenticated guard (line 32)
- All deeper surfaces are inside `BreedingPairSelection` sub-component.

### 6. Radii

`rounded-xl` in guard states. Sub-component uses `rounded-2xl` consistently.

### 7. Buttons

None in shell; delegates to sub-component.

### 8. Tabs

None in shell.

### 9. Forms

None in shell.

### 10. Dialogs/Modals

Delegates to sub-component.

### 11. Async States

- Loading: spinner + text in glass-panel-subtle
- Unauthenticated: icon + text in glass-panel

### 12. Direct Colors

Zero raw palette classes. CSS variables only.

### 13. Mobile Fixed Elements

None.

---

## BreedingPairSelection (Sub-Component)

**File:** `frontend/src/pages/breeding/BreedingPairSelection.tsx`

This is the functional heart of the Breeding Hall. It renders inside `BreedingPage`'s container — it has no own container/padding wrapper.

### 1. Header

None — this is a sub-component, not a routed page shell.

### 2. Container

Root element is `<div className="space-y-5">`. No `max-w-*` or `mx-auto`.

### 3. Outer Padding

None — relies on parent `BreedingPage` container.

### 4. Background

One gradient on the CTA button: `bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)]` (line 517). No page-level backgrounds.

### 5. Surfaces

Heavy use of `glass-panel rounded-2xl` with various border tokens:

- `border-[var(--status-success)]/25` — success banner (line 346)
- `border-red-500/30` — error state (line 329) and error banner (line 356)
- `border-[var(--dialog-header-border)]` — compatibility warning (line 366)
- `border-[var(--btn-glass-border)]` — horse selector cards (lines 378, 390, 430, 446)
- `border-[var(--glass-border)]` — cost breakdown (line 473)
- `border-red-500/40` — genetic-prediction error (line 410)

All cards are `rounded-2xl`. No panel-in-panel nesting beyond the Predictions collapsible's inner content area.

### 6. Radii

`rounded-2xl` throughout (primary surface). `rounded-full` for the CTA button (line 516) and the loading spinner (line 318).

### 7. Buttons

- **Hand-styled primary CTA** (line 511–525): raw `<button>` with custom `bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)]`, hover/disabled states — does not use shared `Button`. **Violation: 1 raw command button.**
- **Collapsible toggle** (line 447–463): raw `<button>` with `hover:bg-[var(--dialog-close-hover-bg)]` — this is a disclosure toggle, not a command button, but still hand-styled. **1 additional hand-styled button.**
- Total raw command buttons: **1** (the primary CTA). The collapsible toggle is arguably a disclosure pattern.

### 8. Tabs

None directly. `CompatibilityPreview` renders its own 4-tab UI (imported component).

### 9. Forms

No form elements (`<input>`, `<select>`, `<textarea>`). Horse selection is delegated to `HorseSelector` component.

### 10. Dialogs/Modals

- `BreedingConfirmationModal` from `@/components/breeding/BreedingConfirmationModal` — uses `BaseModal` internally (line 530).
- `CinematicMoment` from `@/components/feedback/CinematicMoment` — lifetime-first breed only (line 546).

### 11. Async States

- Loading (horses): centered spinner + text, no glass surface wrapper (lines 314–325)
- Error (horses): `glass-panel rounded-2xl border-red-500/30` with icon + text (lines 327–338)
- Compatibility warning (non-fatal): inline alert banner using `glass-panel rounded-2xl` (lines 365–374)
- Genetic prediction error: `glass-panel rounded-2xl border-red-500/40` (lines 407–417)
- Success: `glass-panel rounded-2xl border-[var(--status-success)]/25` banner (lines 345–352)

### 12. Direct Colors

Approximately 6 raw palette instances:

- `text-red-400` (lines 331, 358) — error icons
- `text-emerald-400` (line 348) — success icon
- `text-red-300` (line 410) — genetic error text
- `border-red-500/30` (lines 329, 356) — error surfaces
- `border-red-500/40` (line 410) — genetic error border

### 13. Mobile Fixed Elements

None.

---

## BreedingPredictionsPanel (Sub-Component)

**File:** `frontend/src/pages/breeding/BreedingPredictionsPanel.tsx`

### 1. Header

None — sub-component.

### 2. Container

Root is `<div className="space-y-6">`. No width constraints.

### 3. Outer Padding

None; rendered inside parent's glass-panel.

### 4. Background

None.

### 5. Surfaces

- Error state: raw `rounded-lg border border-red-500/30 bg-red-500/10 p-6` — **does not use glass-panel** (line 66)
- Header card: `rounded-lg border border-forest-green/20 bg-saddle-leather/40 p-6 shadow-sm` — **uses a legacy pre-Celestial-Night theme** (line 89). These tokens (`forest-green`, `saddle-leather`, `midnight-ink`) are from an older design layer inconsistent with the rest of the workflow family.

### 6. Radii

`rounded-lg` throughout. Inconsistent with the parent component's `rounded-2xl`.

### 7. Buttons

None.

### 8. Tabs

None.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- Loading: bare spinner with no surface wrapper (lines 52–61)
- Error: raw div with `border-red-500/30 bg-red-500/10` (lines 63–79)
- Empty (no horses): `return null` (line 83–84)

### 12. Direct Colors

Approximately 4 raw palette instances:

- `border-red-500/30 bg-red-500/10` — error container (line 66)
- `text-red-400` (lines 70, 73) — error icon and message
- `text-blue-400` (line 91) — sparkles icon

**Legacy tokens (not raw Tailwind palette but not Celestial Night tokens):**

- `border-forest-green/20` (line 89)
- `bg-saddle-leather/40` (line 89)
- `text-midnight-ink` (lines 72, 93, 94)

These suggest this component was never migrated to Celestial Night.

### 13. Mobile Fixed Elements

None.

---

## CompetitionBrowserPage

**File:** `frontend/src/pages/CompetitionBrowserPage.tsx`

### 1. Header

`PageHero` with `mood="competitive"`, `title="Competition Arena"`, subtitle, and `<Trophy>` icon. No breadcrumb child. Used in all three render paths (loading, error, success) — correct.

### 2. Container

`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` used as `<main>` in both error (line 253) and success (line 286) states. Loading state: `className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"` (line 226). Consistent `max-w-7xl` across all states.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on the main content wrapper. Loading has `py-8`, success has `pb-12`.

### 4. Background

None.

### 5. Surfaces

- Loading spinner: `glass-panel rounded-2xl p-12` (line 234)
- Error: `glass-panel rounded-2xl border-[var(--status-danger)]/30 p-8 text-center` (line 256)
- Filters and list delegate to `CompetitionFilters` and `CompetitionList` components.

### 6. Radii

`rounded-2xl` for page-level surfaces.

### 7. Buttons

- **Tab buttons** (lines 184–212): Two raw `<button role="tab">` with hand-crafted `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors` plus conditional gold/muted color classes. These are a bespoke tab implementation that bypasses shared tab primitives (`GoldTabs`, `CelestialTabs`). **2 raw hand-styled tab-nav buttons.**
- Error retry: uses shared `<Button type="button" onClick={() => refetch()} size="lg">` (line 267). Correct.

### 8. Tabs

**Manual `<button>` row tab bar** (lines 177–213) with `role="tablist"` / `role="tab"` ARIA attributes. Active state: `border-[var(--gold-400)] text-[var(--cream)]`. Inactive: `border-transparent text-[var(--text-muted)]`. No `GoldTabs` or `CelestialTabs` — bespoke implementation. Tab state lives in `?tab=` URL search param.

### 9. Forms

None directly; filters delegated to `CompetitionFilters`.

### 10. Dialogs/Modals

`CompetitionDetailModal` from `@/components/competition/CompetitionDetailModal` — uses `BaseModal` internally (line 321).

### 11. Async States

- Loading (ridden tab): glass-panel spinner with text (lines 216–241)
- Error (ridden tab): glass-panel error card with shared `Button` retry (lines 244–274)
- Conformation panel self-manages its own async states
- Empty state: delegated to `CompetitionList`

### 12. Direct Colors

Zero raw palette colors. CSS variables used throughout.

### 13. Mobile Fixed Elements

None.

---

## CompetitionResultsPage

**File:** `frontend/src/pages/CompetitionResultsPage.tsx`

This page has the highest raw-palette color count in the family due to inline sub-components (`StatCard`, `EmptyStateBanner`, `StatsError`) that use Tailwind palette classes directly instead of CSS-variable tokens.

### 1. Header

`PageHero` with `mood="competitive"`, `title="Competition Results"`. Children slot contains `<Breadcrumbs>` + `<BalanceUpdateIndicator>` + "View Prize History" link row (lines 310–334).

### 2. Container

`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8` on `<main>` (line 336). Consistent with family.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on main content. Within `EmptyStateBanner`, `max-w-md mx-auto` constrains the description text (line 138) — acceptable internal constraint.

### 4. Background

None.

### 5. Surfaces

- `StatCardSkeleton`: `glass-panel rounded-lg p-6 animate-pulse` (line 76)
- `StatCard`: `glass-panel rounded-lg p-6` (line 108)
- `EmptyStateBanner`: `glass-panel-subtle rounded-lg p-8 text-center mb-8` (line 129)
- `StatsError`: `bg-[var(--badge-danger-bg)] border border-[var(--status-danger)]/30 rounded-lg p-4` (line 155) — uses tokens correctly
- No panel-in-panel nesting.

### 6. Radii

`rounded-lg` for all stat/state cards. `rounded-full` for icon containers (line 114). Inconsistent with the `rounded-2xl` pattern used in `BreedingPairSelection`; `CompetitionBrowserPage` uses `rounded-2xl`. This family has both `rounded-lg` and `rounded-2xl` for glass surfaces.

### 7. Buttons

- `EmptyStateBanner` CTA (lines 139–145): hand-styled `<a>` / `<Link>` with `px-6 py-3 bg-blue-600 ... rounded-lg` — **raw palette color on a primary action, does not use shared Button**. **1 raw command "button" (as Link).**
- `StatsError` retry (lines 164–170): hand-styled `<button>` with `bg-red-500/20 text-red-300 ... rounded` — does not use shared `Button`. **1 raw command button.**
- Total: **2 raw command buttons** that bypass the shared Button component.

### 8. Tabs

Uses `GoldTabs` / `GoldTabsList` / `GoldTabsTrigger` / `GoldTabsContent` from `@/components/ui/game` (lines 405–423). Correct shared primitive. Note: the `GoldTabsList` currently has only one tab trigger (`my-results`); the `browse` tab state variable exists but no corresponding `GoldTabsTrigger` is rendered — suggesting an incomplete or stripped-down tab configuration.

### 9. Forms

None.

### 10. Dialogs/Modals

- `CompetitionResultsModal` via `@/components/competition/CompetitionResultsModal` — uses `BaseModal` (line 426).
- `PerformanceBreakdownPanel` rendered inline below main content (not a modal/overlay) (line 439).

### 11. Async States

- Stats loading: `StatCardSkeleton` grid (pulse animation) (lines 350–359)
- Stats error: `StatsError` component (lines 343–348)
- Empty: `EmptyStateBanner` (line 402)
- Results list loading/error: delegated to `CompetitionResultsList`

### 12. Direct Colors

Approximately 14 raw Tailwind palette instances — the highest count in the family:

- `text-blue-400` (line 132) — empty state icon
- `bg-blue-600` (line 141) — empty state CTA background
- `focus:ring-blue-500` (line 141)
- `text-red-400` (line 161) — stats error icon
- `text-red-300` (line 162) — stats error text
- `bg-red-500/20` (line 166) — retry button background
- `text-red-300` (line 166) — retry button text
- `hover:bg-red-500/30` (line 166)
- `focus:ring-red-500` (line 166)
- `iconBgColor="bg-blue-500/20"` / `iconColor="text-blue-400"` (lines 369–370)
- `iconBgColor="bg-yellow-500/20"` / `iconColor="text-yellow-400"` (lines 377–378)
- `iconBgColor="bg-emerald-500/20"` / `iconColor="text-emerald-400"` (lines 385–386)
- `iconBgColor="bg-purple-500/20"` / `iconColor="text-purple-400"` (lines 393–394)

These palette colors are passed as props into `StatCard`, making each stat icon a different semantic color (blue=total, yellow=wins, emerald=win-rate, purple=prize-money) without going through CSS variable tokens.

### 13. Mobile Fixed Elements

None.

---

## ConformationShowsPage

**File:** `frontend/src/pages/ConformationShowsPage.tsx`

This page is a pure thin redirect:

```tsx
const ConformationShowsPage = (): JSX.Element => (
  <Navigate to="/competitions?tab=conformation" replace />
);
```

It has no layout, no header, no container, no colors, and no UI primitives. It exists solely to preserve the legacy `/conformation-shows` URL. The real UI lives in `ConformationShowsPanel` rendered inside `CompetitionBrowserPage`.

All design-system fields are N/A.

---

## LeaderboardsPage

**File:** `frontend/src/pages/LeaderboardsPage.tsx`

### 1. Header

`PageHero` with `mood="competitive"`, `title="Leaderboards"`. No breadcrumb or child slot.

### 2. Container

`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8` (line 269). Consistent with family.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` on the content div.

### 4. Background

None.

### 5. Surfaces

No page-level glass surfaces. Error state uses raw div (see below). All list/card surfaces are inside sub-components (`LeaderboardTable`, `UserRankDashboard`, etc.).

### 6. Radii

`rounded-lg` on the error card (line 304). Sub-components manage their own radii.

### 7. Buttons

- Error retry button (line 311–315): raw `<button>` with `px-4 py-2 bg-red-600 text-[var(--text-primary)] ... rounded-lg hover:bg-red-700` — does not use shared `Button`. **1 raw command button.**

### 8. Tabs

None directly in this page shell. Category/period/discipline filtering is handled by `LeaderboardCategorySelector` which manages its own tab-like UI.

### 9. Forms

None.

### 10. Dialogs/Modals

`LeaderboardHorseDetailModal` from `@/components/leaderboard/LeaderboardHorseDetailModal` — uses `BaseModal` internally (line 341).

### 11. Async States

- Leaderboard loading: delegated to `LeaderboardTable` (shows skeletons internally)
- User rank loading: delegated to `UserRankDashboard`
- Error: page-level inline error card (lines 302–319)
- Empty: delegated to `LeaderboardTable`

### 12. Direct Colors

Approximately 3–4 raw palette instances:

- `text-red-400` (line 307) — error heading text
- `text-red-500/80` (line 308) — error sub-text
- `bg-red-600 ... hover:bg-red-700` (line 312) — retry button
- `bg-[rgba(239,68,68,0.1)]` (line 304) — **raw rgba value** for error background instead of `bg-[var(--badge-danger-bg)]` or similar token

### 13. Mobile Fixed Elements

None.

---

## Cross-Cutting Findings

### Container Width Inconsistency — Guard States vs Main

`TrainingPage` uses `max-w-6xl` for its loading/unauthenticated guard states (lines 23, 36) but `max-w-7xl` for the authenticated main view (line 65). All other pages use `max-w-7xl` throughout.

### Tab Implementation Split

The family uses three different tab implementations:

1. `GoldTabs` / `GoldTabsList` (CompetitionResultsPage) — shared primitive, correct
2. Manual `<button role="tab">` row (CompetitionBrowserPage) — bespoke, no shared primitive
3. No tabs (TrainingPage, BreedingPage, LeaderboardsPage)

### Raw Color Cluster in CompetitionResultsPage

The four stat cards in `CompetitionResultsPage` use semantic-color props (`iconBgColor`, `iconColor`) with raw Tailwind palette strings (`bg-blue-500/20`, `text-yellow-400`, etc.) passed at the call site. These should be replaced with CSS-variable-based semantic tokens or the `StatCard` component should define its own variant system.

### BreedingPredictionsPanel Legacy Theme

`BreedingPredictionsPanel` uses `forest-green`, `saddle-leather`, and `midnight-ink` tokens — a pre-Celestial-Night theme. These tokens produce light-mode-era visuals (e.g., `text-midnight-ink` renders dark text on what may be a dark glass surface) and are inconsistent with every other surface in the breeding flow. The component should be migrated to Celestial Night tokens or replaced.

### All Modals Use BaseModal

Every modal in the family delegates to `BaseModal` from `@/components/common/BaseModal`. No page-local `fixed inset-0` overlays are constructed at the page level. This is correct and consistent.

### No PageBackground in Workflow Family

None of the workflow pages use `PageBackground`. Auth pages (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`) do use it. The workflow pages rely on the inherited DashboardLayout background.

### No Mobile Fixed Elements

None of the workflow pages introduce fixed bottom bars or sticky toolbars at the page level (the `HorseActionBar` does, but it belongs to the horse-detail family).

### backdrop-blur Absent from Workflow Family

Zero `backdrop-blur` usages in any of the six routed workflow pages or their two breeding sub-components. This is consistent — backdrop-blur in the codebase is confined to modal overlays (other page families) and a few shop-page cards.
