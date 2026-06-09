# Foundation Design-System Inventory

The **foundation family** covers the global shell and all cross-cutting primitives that every routed page inherits or shares. It encompasses: `App.tsx` (router tree and global providers), `DashboardLayout.tsx` (authenticated shell), the layout sub-components (`PageHero`, `PageBackground`, `BottomNav`, `SidebarNav`, `ArtStage`, `navItems.ts`), `AuthLayout.tsx` and the five public auth pages (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `VerifyEmailPage`, `ResetPasswordPage`), the global stylesheet (`index.css`), the token system (`styles/tokens.css`), the shared `Button` component, and the two tab primitives (`GoldTabs`, `CelestialTabs`). The foundation is largely well-structured: the token system is comprehensive, the single-blur-layer rule is documented and enforced in `index.css`, and DashboardLayout provides a consistent `max-w-[1440px] mx-auto px-4 md:px-8` gutter. However, the five auth pages **do not use `AuthLayout.tsx`** — each re-implements its own shell pattern inline. Direct `rgb()`/`rgba()` colour literals and raw Tailwind palette classes (`text-red-400`, `text-slate-400`, `text-white`) appear throughout the auth pages and `CelestialTabs.tsx` in violation of the token rules defined in `tokens.css`.

---

## Summary Table

| File / Page         | Header        | Max-w Container | Outer Padding Issue | Surfaces                               | Direct Colors       |
| ------------------- | ------------- | --------------- | ------------------- | -------------------------------------- | ------------------- |
| App.tsx             | none          | none            | none                | none                                   | 0                   |
| DashboardLayout.tsx | none          | max-w-[1440px]  | none                | footer inline blur (violation)         | 0                   |
| PageHero.tsx        | header+h1     | max-w-7xl       | own px-4/6/8        | none                                   | ~18 rgba literals   |
| PageBackground.tsx  | none          | none            | none                | none                                   | 2 hex literals      |
| BottomNav.tsx       | none          | none            | none                | glass-surface-heavy + backdrop-blur-xl | 0                   |
| SidebarNav.tsx      | none          | none            | none                | bg-sidebar                             | 0                   |
| ArtStage.tsx        | none          | none            | none                | gradient overlay                       | 0                   |
| navItems.ts         | none          | none            | none                | none                                   | 0                   |
| AuthLayout.tsx      | AuthHeader h1 | max-w-md        | none                | glass-panel                            | 2 raw               |
| button.tsx          | none          | none            | none                | glass-panel (glass variant)            | 0                   |
| CelestialTabs.tsx   | none          | none            | none                | glass-panel (content)                  | ~14                 |
| GoldTabs.tsx        | none          | none            | none                | transparent                            | 0                   |
| index.css           | none          | none            | none                | glass-panel/heavy/subtle defs          | several in defs     |
| tokens.css          | none          | none            | none                | none                                   | all defs (expected) |
| LoginPage           | h1+h2 bespoke | max-w-sm        | px-4 content div    | glass-panel                            | ~5                  |
| RegisterPage        | h1+h2 bespoke | max-w-sm        | px-4 content div    | glass-panel                            | ~6                  |
| ForgotPasswordPage  | h1+h2 bespoke | max-w-sm        | px-4 content div    | glass-panel                            | ~13                 |
| VerifyEmailPage     | h1+h2 bespoke | max-w-sm        | px-4 content div    | glass-panel                            | ~18                 |
| ResetPasswordPage   | h1+h2 bespoke | max-w-sm        | px-4 content div    | glass-panel                            | ~8                  |

---

## App.tsx

### Overview

Global provider tree + BrowserRouter route tree. All authenticated routes nest under a single `<Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>` wrapper. Public auth routes are bare (no layout wrapper).

### Route List

**Public routes (no layout shell):**

- `/onboarding` -> OnboardingPage (lazy)
- `/login` -> LoginPage (lazy)
- `/register` -> RegisterPage (lazy)
- `/verify-email` -> VerifyEmailPage (lazy)
- `/forgot-password` -> ForgotPasswordPage (lazy)
- `/reset-password` -> ResetPasswordPage (lazy)

**Authenticated routes (wrapped in ProtectedRoute -> DashboardLayout):**

- `/horses/:id` -> HorseDetailPage (lazy)
- `/horses/:id/equip` -> HorseEquipPage (lazy)
- `/foals/:id` -> FoalDetailPage (lazy)
- All items from navItems (see nav-items.tsx): `/`, `/stable`, `/inventory`, `/breeding`, `/competitions`, `/world`, `/marketplace`, `/riders`, `/leaderboards`, `/settings`, `/profile`, `/grooms`, `/vet`, `/farrier`, `/feed-shop`, `/tack-shop`, `/crafting`, `/bank`, `/training`, `/my-stable`, `/trainers`, `/marketplace/horses`, `/marketplace/horse-trader`, `/competition-results`, `/conformation-shows`, `/prizes`, `/community`, `/message-board`, `/message-board/:threadId`, `/clubs`, `/messages`

### Notable Findings

- Global providers: `SentryErrorBoundary`, `QueryClientProvider`, `AuthProvider`, `GameTooltipProvider`, `StarfieldBackground`, `Sonner`, `RewardToastProvider`, `CelestialThemeProvider`, `OnboardingGuard`, `WhileYouWereGone` (lazy), `OnboardingSpotlight` (lazy).
- `GallopingLoader` used as Suspense fallback for all routes.
- The error fallback (line 44) uses `text-[var(--text-primary)]` — correctly tokenised.

---

## DashboardLayout.tsx

### 1. Header

No `PageHero` rendered by DashboardLayout itself. Each child route is responsible for its own header. The layout provides `<MainNavigation>` (top bar) and optionally `<AsidePanel>`.

### 2. Container

- **Line 100:** `max-w-[1440px] mx-auto w-full px-4 md:px-8` — the authoritative outer container and gutter.
- Content area is `flex gap-6` with `<main>` (`flex-1 min-w-0`) and optional `<AsidePanel>`.
- Aside panel rendered for routes `/`, `/stable`, `/my-stable` only.

### 3. Outer Padding

DashboardLayout owns `px-4 md:px-8` on the inner content div (line 100). Child pages that add their own outer `px-*` are duplicating gutters.

### 4. Background

- Uses `usePageBackground()` hook — returns CSSProperties applied to root `<div className="min-h-screen relative flex">` via inline `style={bgStyle}`.
- STATIC_BG map: `/stable`, `/my-stable` -> `bg-stable.webp`; `/farrier` -> `farrier.webp`; `/vet` -> `equinehospital.webp`; `/feed-shop` -> `feedstore2.webp`; `/tack-shop` -> `tackstore.webp`.
- Horse-detail routes: `/images/bg-horse-detail.webp` unconditionally.
- All other routes: `getSceneForPath()` -> `useResponsiveBackground()` scene system.

### 5. Surfaces

- Footer (lines 109-141): **VIOLATION** — applies `backdropFilter: 'blur(10px) saturate(1.3) brightness(1.1)'` and `WebkitBackdropFilter` as inline styles outside the class system. This is an extra blur layer bypassing the `.glass-panel` hierarchy.
- Footer bg: `background: 'var(--footer-bg)'` — tokenised.
- Footer border: `border-t border-[var(--glass-border)]` — tokenised.

### 6. Fixed Elements

- `<BottomNav>`: `fixed bottom-0 left-0 right-0 z-[var(--z-nav)]` — mobile only (md:hidden).
- `<SidebarNav>`: `sticky top-0 h-screen` — desktop only (>= 1024px).
- Skip-to-content: `focus:fixed focus:top-2 focus:left-2` — accessibility.

### Notable Violations

- **Line 113-114:** Footer `backdropFilter` inline style bypasses the `.glass-panel` class system and the documented single-blur-layer rule. Should use `.glass-panel-heavy` or similar.

---

## PageHero.tsx

### API

```
interface PageHeroProps {
  title: string;
  subtitle?: string;
  mood?: 'default' | 'golden' | 'mystic' | 'competitive' | 'nature';
  icon?: React.ReactNode;
  backgroundImage?: string;     // covers entire hero area
  decoration?: React.ReactNode; // desktop-only right-side element (hidden lg:flex)
  children?: React.ReactNode;   // stat pills, action buttons
}
```

### Orb Decoration Props

The `decoration` prop renders inside `hidden lg:flex items-center flex-shrink-0 opacity-60`. Ambient glow orbs are implemented as mood-driven inline background gradients on two `absolute inset-0` pointer-events-none divs. The `mood` prop selects from `moodConfig` which defines `orb1` (radial-gradient, lower-left bias), `orb2` (radial-gradient, upper-right bias), and `accentLine` (gold/blue linear gradient for bottom divider).

### Container

Inner content at line 107: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`. This is a second max-w constraint inside DashboardLayout's max-w-[1440px]. PageHero's container is narrower (7xl = 1280px) than the shell (1440px) — pages using PageHero are effectively capped at 1280px.

### Direct Color Violations (approximately 18)

All rgba() literals in `moodConfig` are hardcoded:

- Line 33: `rgba(58, 111, 221, 0.15)` (cobalt, should be --celestial-primary based)
- Line 33: `rgba(201, 162, 39, 0.1)` (gold, should be --gold-primary based)
- Lines 34-60: Multiple rgba() across all 5 mood variants
- Line 113: `rgba(201, 162, 39, 0.3)` and `rgba(201, 162, 39, 0.15)` on icon container
- Lines 128-129: `rgba(0,0,0,1)` and `rgba(201,162,39,0.3)` in h1 textShadow
- Line 136: `rgba(0,0,0,1)` in subtitle textShadow

---

## PageBackground.tsx

### API (two consumption patterns)

1. `<PageBackground scene="auth" />` — renders fixed full-viewport div at `z-[var(--z-below)]` (-1)
2. `usePageBackground({ scene?, src? })` — returns CSSProperties for callers that paint their own root div

### Notable Findings

- Lines 37-40: Two hardcoded hex literals in `LOADING_GRADIENT` (`#0a0e1a`, `#111827`) and VEIL (`rgba(5,10,20,0.45)`). Match `--bg-deep-space` and `--bg-night-sky` but not using tokens. Minor.
- All 5 auth pages call both `usePageBackground()` AND render `<PageBackground />` — double-painting the same background.

---

## BottomNav.tsx

### API

```
interface BottomNavProps { onMoreClick: () => void; }
```

Uses `BOTTOM_NAV_ITEMS` (5 items: Home, Horses, Compete, Breed, More). "More" opens NavPanel overlay.

### Notable Violations

- **Line 29:** `backdrop-blur-xl` — uses Tailwind blur class rather than a token or `.glass-panel-heavy`. Should be `backdrop-blur-[var(--glass-blur-heavy)]` or the `.glass-panel-heavy` class.
- Z-index: `z-[var(--z-nav)]` — tokenised.
- Height: `h-[var(--bottom-nav-height)]` — tokenised.
- Active gold dot: `bg-[var(--gold-primary)]` — tokenised.

---

## SidebarNav.tsx

### Notable Findings

- Width: `w-16` (collapsed) / `w-64` (expanded). Token `--sidebar-width: 280px` (11rem) does not match `w-64` (16rem = 256px). Minor inconsistency.
- Background: `bg-[var(--bg-sidebar)]` — tokenised.
- Active state: `bg-[var(--glass-border-gold-subtle)] border-l-2 border-l-[var(--gold-primary)]` — tokenised.
- Font label: inline `style={{ fontFamily: 'var(--font-heading)' }}` — tokenised but inline.
- No backdrop-blur — compliant with single-blur-layer rule.

---

## ArtStage.tsx

### API

```
interface ArtStageProps extends React.HTMLAttributes<HTMLDivElement> {
  artSrc?: string;
  artAlt?: string;
  variant?: 'fullscreen' | 'hero' | 'card' | 'sidebar';
  overlay?: boolean;
}
```

### Notable Findings

- **Line 62:** `bg-gradient-to-t from-deep-space` — uses Tailwind custom config class `from-deep-space`. This is a legacy config colour and should be replaced with `from-[var(--bg-deep-space)]`.
- `variant='fullscreen'` sets `fixed inset-0 z-[-1]` which competes with `PageBackground` and `StarfieldBackground` at similar z-indices.
- **Line 66:** Noise texture overlay `bg-[url('/assets/noise.png')] opacity-[0.03]` — cosmetic, acceptable.

---

## navItems.ts

Clean data-only module. Exports `NAV_SECTIONS` (14 items: Home, My Stable, Inventory, Competitions, Breeding, Riders, World, Marketplace, Leaderboards, Community, Messages, Bank, Profile, Settings), `BOTTOM_NAV_ITEMS` (5 items), and `isRouteActive()` helper. No styling concerns.

---

## AuthLayout.tsx

### API

```
interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  icon?: ReactNode;
  cardClassName?: string;
  testId?: string;
}
```

Sub-components exported: `AuthHeader`, `AuthFooter`, `AuthCardHeader`, `AuthError`, `AuthFooterLink`

### Pages Using AuthLayout

**Zero auth pages import or use AuthLayout.** The component exists and is re-exported from `components/auth/index.ts`, but none of the six public auth pages import it. Each page builds its own nearly-identical inline shell. This is a significant consistency gap.

### Notable Violations

- **Line 112-113 (AuthError):** `bg-[rgba(239,68,68,0.1)] border border-red-500/30` — raw rgba() + Tailwind palette class. Should use `--status-error`-based tokens.
- **Line 113:** `text-red-400` — raw palette class.
- Card: `glass-panel p-6` — uses shared surface class correctly.
- Container: `max-w-md` (448px vs auth pages' max-w-sm 384px — inconsistency).

---

## button.tsx

### Base Classes

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium
transition-all duration-150 focus-visible:outline-none focus-visible:ring-2
focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2
focus-visible:ring-offset-[var(--bg-deep-space)]
disabled:pointer-events-none disabled:opacity-40 disabled:text-[var(--text-muted)]
font-[var(--font-body)]
```

Key: `rounded-full` on the base — all buttons are pill-shaped by default.

### Variants

| Variant           | Key Classes                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| default (primary) | `btn-cobalt bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] font-[var(--font-heading)]` |
| secondary         | `glass-panel-subtle border border-[var(--btn-secondary-border)]`                                           |
| outline           | `border border-[var(--celestial-navy-100)]` (uses legacy compat token)                                     |
| ghost             | `text-[var(--gold-light)] hover:underline`                                                                 |
| link              | `text-[var(--gold-light)] underline rounded-none px-0`                                                     |
| destructive       | `bg-[var(--btn-destructive-bg)] border border-[var(--status-error)]`                                       |
| glass             | `glass-panel hover:[transform:none]` (suppresses lift on buttons)                                          |

### Sizes

`default`(h-11/44px), `sm`(h-9 + after:-inset-1 expanded hit), `lg`(h-12), `xl`(h-14), `icon`(h-11 w-11)

### Notable Findings

- All colours use CSS custom properties — zero raw Tailwind palette classes.
- `outline` variant uses `--celestial-navy-100` (legacy compat alias). Should migrate to `--glass-border` or a spec token.
- `btn-cobalt` horseshoe arc pseudo-elements (index.css lines 297-329) use `var(--gold-primary, #c8a84e)` with hex fallback — acceptable.

---

## CelestialTabs.tsx

### API

```
interface CelestialTabsProps {
  tabs: Array<{ value: string; label: string; icon?: ReactNode; content: ReactNode; }>;
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
  value?: string;            // controlled mode
  onValueChange?: (value: string) => void;
}
```

Wraps `GoldTabs` (Radix Tabs) with array-based API plus controlled/uncontrolled state. Also exports `CelestialAccordion` using `GameCollapsible`.

### Direct Color Violations (approximately 14)

CelestialTabs.tsx has the most direct colour violations in the foundation family:

- **Line 70:** `text-slate-400` — raw Tailwind palette (should be `text-[var(--text-muted)]`)
- **Line 70:** `bg-[rgba(15,35,70,0.5)]` — raw rgba (should use `--glass-bg` or `--bg-twilight`)
- **Line 71:** `data-[state=active]:text-[rgb(220,235,255)]` — raw rgb (should be `var(--text-primary)`)
- **Line 71:** `data-[state=active]:bg-[rgba(37,99,235,0.2)]` — raw rgba (should be `--celestial-primary` based)
- **Line 71:** `data-[state=active]:border-[rgba(212,168,67,0.5)]` — raw rgba gold (should be `--gold-primary` based)
- **Line 73:** Multiple hover rgba() literals
- **Line 92:** `via-burnished-gold` — legacy Tailwind config token
- **Line 97:** `bg-[rgba(37,99,235,0.2)]` divider
- **Line 108:** `border border-[rgba(37,99,235,0.2)]` content panel
- **Lines 181, 201:** `text-[rgb(220,235,255)]` in accordion

### Notable Findings

- The trigger styling (lines 69-74) was written before the token system matured and uses pre-token patterns throughout.
- Content panels use `glass-panel` correctly but their border overrides use raw rgba().

---

## GoldTabs.tsx

### API

Thin styled wrappers over Radix `Tabs` primitives:

- `GoldTabs` = Tabs (re-export)
- `GoldTabsList` — `border-b border-[var(--dialog-header-border)] bg-transparent`
- `GoldTabsTrigger` — inactive: `text-[var(--text-muted)]`; active: `data-[state=active]:text-[var(--gold-400)]` + 2px `bg-[var(--gold-500)]` underline via `::after`
- `GoldTabsContent` — `mt-4`, transparent

### Notable Findings

- Uses `--dialog-header-border` as the tabs list border. Functional but semantically mismatched — intended for dialog borders. A `--tabs-border` token would be cleaner.
- `--gold-400` and `--gold-500` are legacy compat aliases for `--gold-light` and `--gold-primary` respectively.
- All colours tokenised — zero raw palette classes.

---

## index.css

### .glass-panel Hover Rule (lines 191-196)

```css
.glass-panel:hover {
  border-color: var(--glass-hover);
  box-shadow: var(--glow-gold);
  transform: translateY(-2px);
}
```

The `translateY(-2px)` hover lift is suppressed for button-context usage via `hover:[transform:none]` in the `glass` Button variant.

### Single-Blur-Layer Rule (documented at lines 159-174)

Only ONE `backdrop-filter: blur()` may be active per viewport stack.

- `.glass-panel` -> base: solid dark; +.celestial scope: `blur(12px) saturate(1.3) brightness(1.2)` via `--glass-bg-filter`
- `.glass-panel-heavy` -> base: opaque; +.celestial scope: `blur(16px)` via `--glass-blur-heavy`
- `.glass-panel-subtle` -> NEVER blurs — solid semi-transparent, nested-safe
- `.no-blur` utility overrides backdrop-filter: none globally

**Violations found in foundation:**

1. DashboardLayout.tsx footer (line 113): inline `backdropFilter: 'blur(10px)...'` outside class system
2. BottomNav.tsx (line 29): `backdrop-blur-xl` Tailwind class directly

### Semantic Classes Defined

- `.glass-panel`, `.glass-panel-heavy`, `.glass-panel-subtle`
- `.parchment-texture`, `.gold-border` (legacy aliases)
- `.magical-glow` (cobalt blue box-shadow — uses hardcoded rgba)
- `.shimmer-effect`, `.scroll-entrance` (animations)
- `.celestial-input` (form input — shared class)
- `.btn-cobalt` (primary button horseshoe arcs)
- `.btn-outline-celestial` (LEGACY — bypasses Button component, has multiple raw rgba violations)
- `.fantasy-title`, `.fantasy-header`, `.fantasy-body`, `.fantasy-caption`, `.stat-value` (typography)
- `.scroll-area-celestial` (custom scrollbar)

### Notable Violations

- **Line 123 (.fantasy-title):** `color: rgb(212, 168, 67)` — raw rgb, should be `var(--gold-primary)`.
- **Line 244 (.gold-border):** `border: 1px solid rgba(212, 168, 67, 0.4)` — raw rgba.
- **Line 249 (.magical-glow):** `rgba(37, 99, 235, 0.5/0.2)` — raw rgba.
- **Lines 332-350 (.btn-outline-celestial):** Multiple raw rgba() values — legacy class, should be removed.

---

## styles/tokens.css

### Full Token Inventory

**Background layers:** `--bg-deep-space` (#0a0e1a), `--bg-night-sky` (#111827), `--bg-midnight` (#1a2236), `--bg-twilight` (#243154), `--bg-surface` (#1e293b)

**Frosted Glass:** `--glass-bg` (rgba 15,23,42,0.6), `--glass-blur` (12px), `--glass-bg-filter`, `--glass-border` (rgba 148,163,184,0.2), `--glass-hover`, `--glass-glow`, `--glass-shadow`

**Gold scale:** `--gold-primary` (#c8a84e / 4.2:1), `--gold-light` (#e8d48b / 7.1:1), `--gold-dim` (#8b7635 / 2.8:1), `--gold-bright` (#f5e6a3 / 9.4:1); legacy: `--gold-700/500/400/300`

**Text (contrast verified):** `--text-primary` (#e2e8f0 / 11.5:1 AAA), `--text-secondary` (#94a3b8 / 5.2:1 AA), `--text-muted` (#64748b / 3.1:1 AA large), `--text-gold` (#c8a84e)

**Status:** `--status-success` (#22c55e), `--status-warning` (#f59e0b), `--status-danger`/`--status-error` (#ef4444), `--status-info` (#3b82f6), `--status-rare` (#a78bfa), `--status-legendary` (#f5e6a3)

**Button tokens:** `--btn-primary-bg/border`, `--btn-gold-bg/border`, `--btn-secondary-border/-border-hover/-bg-hover`, `--btn-glass-border/-border-hover`, `--btn-destructive-bg/-bg-hover`, `--btn-default-shadow/-shadow-hover`

**Gradients:** `--gradient-night-sky`, `--gradient-glass-panel`, `--gradient-gold-accent`, `--gradient-stat-bar`, `--gradient-celebration`

**Spacing (8px base):** `--space-1` (4px) through `--space-8` (64px); extended: `--space-10` through `--space-24` (96px)

**Border radius:** `--radius-sm` (6px), `--radius-md` (12px), `--radius-lg` (16px), `--radius-xl` (24px), `--radius-full` (9999px); aliases: `--radius-none/badge/card/panel/modal/pill/button/circle`

**Shadows:** `--shadow-subtle/raised/floating`, `--glow-gold/gold-strong/celestial`, `--shadow-panel/button/modal/card/card-hover/dropdown`; glow extras: `--glow-gold-intense/electric/electric-hover/atmospheric/none`, `--error-glow`, `--success-glow`

**Typography:** `--font-display` (Cinzel Decorative — wordmark only), `--font-heading` (Cinzel), `--font-body` (Inter), `--font-mono` (JetBrains Mono); type scale `--text-display` through `--text-5xl`; weights `--weight-normal/medium/semibold/bold`; leading, tracking tokens

**Component sizes:** `--sidebar-width` (280px), `--topbar-height` (60px), `--bottom-nav-height` (56px), `--horse-card-width/height`, `--horse-portrait-hero` (800px), `--touch-target-min` (44px)

**Z-index scale:** `--z-starfield` (-2), `--z-below` (-1), `--z-base` (0), `--z-raised` (10), `--z-sticky` (20), `--z-nav` (30), `--z-dropdown` (40), `--z-tooltip` (50), `--z-overlay` (60), `--z-modal` (70), `--z-toast` (80), `--z-celebration` (90), `--z-above-all` (100)

**Animation:** `--duration-instant/fast/normal/slow/reveal/cinematic`; `--ease-default/in/out/bounce/linear`; shorthand transitions: `--transition-hover/color/transform/opacity/all`

**Semantic aliases:** `--celestial-primary` (focus rings, active nav), `--celestial-primary-hover/pressed`, `--bg-page/sidebar/card/overlay`, `--text-accent/link`, `--icon-accent`, `--link-gold`, `--border-default/active/muted/error`

**Discipline accents (action buttons ONLY):** `--discipline-dressage/showjumping/racing/crosscountry/western/endurance-primary/glow` (forbidden in nav/sidebar/breadcrumbs)

**Rarity:** `--rarity-common/uncommon/rare/ultra-rare/legendary`

**Backward-compat:** `--parchment/saddle-leather/midnight-ink/burnished-gold/aged-bronze/forest-green/mystic-silver` palette aliases; `--celestial-navy-950/900/800/700/600/100`; `--electric-blue-700/500/400/300`; `--cream` (alias for `--text-primary`)

**Game component tokens:** `--badge-gold/danger/success/warning/info/common/rare/ultra-rare/legendary-bg`, `--stat-bar-track-border`, `--glow-stat-max`, `--dialog-header/footer-border`, `--dialog-close-hover-bg`, `--checkbox-border-color`

**Footer:** `--footer-bg`, `--footer-divider-gold`, `--footer-gold-glow`

**Breakpoints (reference only):** `--bp-sm/md/lg/xl/2xl`

**Skeleton:** `--skeleton-base`, `--skeleton-shimmer-from/via/to`, `--skeleton-shimmer-duration`

**Glass surface compat:** `--glass-surface-bg/heavy-bg/subtle-bg`, `--glass-blur-heavy/light`, `--glass-border-gold-subtle`, `--glass-border-shorthand/bright/dim`

### Notable Findings

- Token file is comprehensive and well-commented. The backward-compat section is clearly labelled "DO NOT use in new code".
- `CelestialTabs.tsx` still references `burnished-gold` and `aged-bronze` Tailwind config tokens rather than CSS custom property equivalents.
- `--fantasy-title` CSS class in index.css uses `color: rgb(212, 168, 67)` instead of `var(--gold-primary)` — the class-level violation means every `.fantasy-title` element bypasses the token system.

---

## Auth Pages (LoginPage, RegisterPage, ForgotPasswordPage, VerifyEmailPage, ResetPasswordPage)

### Structural Pattern (all 5 pages — identical shell, not using AuthLayout)

```jsx
<div
  className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden [py-8]"
  style={bgStyle /* usePageBackground({ scene: 'auth' }) */}
>
  <PageBackground scene="auth" /> {/* redundant fixed div — double background */}
  <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-8">
    <h1 className="fantasy-title text-5xl tracking-widest">Equoria</h1> {/* or Link */}
    <div className="glass-panel w-full px-6 py-7 ...">
      <h2 className="fantasy-header text-xl">Page Title</h2>
      {/* page-specific content */}
    </div>
    <p>Copyright footer</p>
  </div>
</div>
```

### 1. Header

None use `PageHero`. Each has:

- `<h1 className="fantasy-title text-5xl tracking-widest">` — EQUORIA wordmark (plain div on LoginPage, `<Link to="/">` on the others)
- `<h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>` — page title inside the card
  Note: `--gold-500` is a legacy compat alias for `--gold-primary`. Should use `--gold-primary` directly.

### 2. Container

`max-w-sm` (384px) content wrapper, inside `px-4` padding — consistent across all 5 pages. AuthLayout uses `max-w-md` (448px) — inconsistency if the two are ever reconciled.

### 3. Outer Padding

`px-4` applied on the content div. DashboardLayout does not wrap these pages so no shell duplication. Each page independently applies the same outer padding.

### 4. Background

- `usePageBackground({ scene: 'auth' })` applied to root div inline style
- `<PageBackground scene="auth" />` also rendered as a fixed positioned div
- **Double background rendering** on all 5 auth pages. The fixed div (z=-1) is entirely redundant since the inline style already paints the background on the root div.

### 5. Surfaces

Single `glass-panel` card div on each page. No nested panels. Compliant with single-blur-layer rule.

### 6. Radii

- Card: `glass-panel` -> `--radius-md` (12px)
- RegisterPage lines 174, 195, 249: inline `style={{ borderRadius: '0.5rem' }}` on individual inputs — duplicates what `celestial-input` class already provides.

### 7. Buttons

All 5 pages use the shared `<Button>` component (default or secondary variant) for primary actions.
**Password-toggle buttons** are bare `<button type="button">` elements with hand-styled classes:
`text-[var(--icon-accent)] hover:text-white transition-colors`

- `hover:text-white` is a direct palette class — should be `hover:text-[var(--text-primary)]`
- Count: ~2 per page with password fields (~8 total across auth pages)

### 8. Forms

All inputs use `className="celestial-input"` (shared class from index.css) — correct.

### 9. Async States

- Loading: Button text change + `disabled` prop. No spinner component used (except VerifyEmailPage which uses `<Loader2 animate-spin>`).
- Error: Raw `<p className="text-red-400 text-sm text-center">` inline — not using shared ErrorCard or `AuthError` component.
- VerifyEmailPage has a gold icon container with Loader2 spinner for the verifying state.

### 10. Dialogs/Modals

None on auth pages.

### 11. Direct Colors Summary

| Page                   | Violations                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LoginPage.tsx          | `text-red-400` (L89, L118, L153), `hover:text-white` (L146, L163 approx), `color:'var(--gold-500)'` (legacy alias)                                                                                                       |
| RegisterPage.tsx       | `text-red-400` (L149, L176, L201, L227, L279, L391+), `hover:text-white` (L304, L373), `--gold-500` legacy                                                                                                               |
| ForgotPasswordPage.tsx | `text-red-400` (L133, L162), `text-slate-400` (L87, L114, L127, L173), `rgb(100,130,165)` (L148, L186), `rgb(212,168,67)` (L177), `rgba(30,55,100,0.5)` border (L172)                                                    |
| VerifyEmailPage.tsx    | `text-red-400` (L242, L302), `text-slate-400` (L219, L248), `rgb(220,235,255)` (×5 instances), `rgb(100,130,165)` (L90)                                                                                                  |
| ResetPasswordPage.tsx  | `text-red-400` (L199, L236, L279), `text-slate-400` (L194, L209, L318), `rgb(100,130,165)` (L214, L285, L300), `rgb(212,168,67)` (L321), `rgba(30,55,100,0.5)` (L317), `text-forest-green` (L87-88, legacy config class) |

**Total across all auth pages: approximately 45 direct color violations**

### Notable Auth-Page Violations

- **ResetPasswordPage.tsx line 88:** `text-forest-green` — a legacy Tailwind config class (= `--forest-green` = cobalt blue). Should be `text-[var(--status-success)]` per token rules.
- **ForgotPasswordPage.tsx line 148:** `text-[rgb(100,130,165)]` inline rgb for icon — should be `text-[var(--icon-accent)]`.
- **All pages:** Error state uses `text-red-400` not `text-[var(--status-error)]` or `text-[var(--status-danger)]`.
- **All pages:** `style={{ color: 'var(--gold-500)' }}` uses legacy alias — should use `var(--gold-primary)`.
- **VerifyEmailPage.tsx line 90:** `text-[rgb(100,130,165)]` footer copyright — should be `text-[var(--icon-accent)]`.

---

## Cross-Cutting Findings

### 1. AuthLayout Orphan

`AuthLayout.tsx` was designed as the canonical auth page shell but is imported by zero pages. All 5 auth pages independently implement the same shell pattern. Either migrate all 5 pages to use `AuthLayout`, or remove `AuthLayout.tsx` to avoid maintenance confusion. The `AuthLayout` card uses `max-w-md` while pages use `max-w-sm` — an additional inconsistency to resolve.

### 2. Backdrop-Blur Outside Class System

Two foundation components apply backdrop-filter outside `.glass-panel` class hierarchy:

1. `DashboardLayout.tsx` line 113: `backdropFilter: 'blur(10px) saturate(1.3) brightness(1.1)'` inline on footer
2. `BottomNav.tsx` line 29: `backdrop-blur-xl` Tailwind class on nav bar

Both should use `.glass-panel-heavy` class or `backdrop-blur-[var(--glass-blur-heavy)]`.

### 3. Double Background on Auth Pages

All 5 auth pages render both `usePageBackground()` on the root div AND `<PageBackground scene="auth" />` as a fixed child. The fixed div is redundant — remove `<PageBackground>` from auth pages since the inline background already handles the root div.

### 4. Container Width Fragmentation

- DashboardLayout content: `max-w-[1440px]`
- PageHero inner content: `max-w-7xl` (1280px) — a nested constraint
- Auth pages: `max-w-sm` (384px)
- AuthLayout (unused): `max-w-md` (448px)
- No `max-w-[52rem]` or other arbitrary widths found in foundation files.

### 5. CelestialTabs vs GoldTabs Recommendation

- `GoldTabs` is the correct low-level primitive (styled Radix Tabs, all colours tokenised)
- `CelestialTabs` is a higher-level array API wrapping GoldTabs — convenient but encodes ~14 raw colour literals in trigger styling
- New implementations should use `GoldTabs` directly; `CelestialTabs` trigger classes need migration to tokens

### 6. .btn-outline-celestial Legacy Class (index.css lines 332-350)

A CSS-only button style with multiple hardcoded rgba() values that bypasses the `Button` component entirely. Should be removed; consumers migrated to `<Button variant="outline">` or `<Button variant="secondary">`.

### 7. .fantasy-title Class Token Violation (index.css line 123)

The `.fantasy-title` typography utility hardcodes `color: rgb(212, 168, 67)` instead of `var(--gold-primary)`. Every element using this class effectively bypasses the token system for its colour. All five auth page h1 EQUORIA wordmarks are affected.

### 8. Tab API Summary

| Component              | API Style                        | Radix backed       | Colours tokenised   | Recommendation                    |
| ---------------------- | -------------------------------- | ------------------ | ------------------- | --------------------------------- |
| GoldTabs               | Radix component API (forwardRef) | Yes                | Yes                 | Use for new implementations       |
| CelestialTabs          | Array-based (tabs prop)          | Yes (via GoldTabs) | No (~14 violations) | Migrate trigger colours to tokens |
| Manual button-row tabs | N/A                              | No                 | Varies              | Replace with GoldTabs             |
