# Equoria Frontend Architecture

**Generated:** 2026-05-15 (full rescan; supersedes 2026-03-19)
**Framework:** React 19 + TypeScript
**Build Tool:** Vite 5.2
**Styling:** TailwindCSS 3.4 + CSS custom properties (tokens.css)
**Theme:** Celestial Night (deep blue/gold)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VITE DEV SERVER / PRODUCTION                        │
│                    HMR in dev · express.static in prod                      │
│                    Port 3000 → Proxy /api → 3001                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REACT 19 APP                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     App.tsx (Root)                                    │   │
│  │  SentryErrorBoundary → QueryClientProvider → AuthProvider            │   │
│  │  → BrowserRouter → CelestialThemeProvider → DashboardLayout          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                      ROUTING (react-router-dom)                       │  │
│  │  6 public routes (auth pages)                                         │  │
│  │  31 nav-items routes (11 main nav + 20 sub-location/route-only)       │  │
│  │  3 explicit App.tsx routes (/horses/:id, /horses/:id/equip, /foals/:id)│ │
│  │  All pages lazy-loaded (React.lazy + Suspense)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         COMPONENT LAYER                               │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │  │
│  │  │ 40 page components   │  │ 242 component files across 18        │  │  │
│  │  │ (lazy-loaded chunks) │  │ domain folders + root                 │  │  │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │  │
│  │  │ 25 UI primitives     │  │ Custom: GallopingLoader, FenceJump   │  │  │
│  │  │ (shadcn/Radix-based) │  │ Bar, CinematicMoment, GlassPanel ... │  │  │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         STATE MANAGEMENT                              │  │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │  │
│  │  │ React Query       │  │ 2 Contexts       │  │ URL State          │  │  │
│  │  │ 57 API hooks      │  │ Auth + Feature   │  │ useSearchParams    │  │  │
│  │  │ Server state      │  │ Flags            │  │ Filters/sort       │  │  │
│  │  └──────────────────┘  └─────────────────┘  └────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         API CLIENT                                    │  │
│  │  api-client.ts: typed endpoint methods across 17+ domain namespaces   │  │
│  │  fetchWithAuth auto-unwraps data.data → hooks receive clean types     │  │
│  │  All endpoints use /api/v1/ prefix                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
frontend/src/
├── App.tsx                          # Root: providers, router, layout
├── main.tsx                         # Entry point
├── nav-items.tsx                    # 31 route definitions (11 nav + 20 sub-location/route-only)
├── index.css                        # 20+ animation keyframes, .btn-cobalt horseshoe borders
├── styles/
│   ├── tokens.css                   # CSS custom properties: colors, z-index, spacing
│   └── fonts.css                    # @font-face declarations
├── contexts/
│   ├── AuthContext.tsx               # JWT auth state, login/logout/refresh
│   └── FeatureFlagContext.tsx        # Runtime feature flag toggles
├── lib/                             # Utility modules
│   ├── api-client.ts                # Typed API methods, fetchWithAuth
│   ├── api/                         # Domain-namespaced API helpers
│   ├── sentry.ts                    # Sentry init + ErrorBoundary
│   ├── utils.ts                     # cn() classname merge
│   ├── utils/                       # Additional utility helpers
│   ├── constants.ts                 # App-wide constants
│   ├── featureFlags.tsx             # Feature flag definitions
│   ├── validation-schemas.ts        # Zod/form schemas
│   ├── validations/                 # Per-domain validation schemas
│   ├── xp-utils.ts                  # XP calculation helpers
│   ├── currency-utils.ts            # Currency formatting
│   ├── activity-utils.ts            # Activity feed helpers
│   ├── statistics-utils.ts          # Stat display helpers
│   ├── authSessionState.ts          # Auth session storage helpers
│   ├── breed-images.ts              # Breed asset map
│   └── soundManager.ts              # Sound effect playback
├── hooks/
│   ├── useAuth.ts                   # Auth convenience hook
│   ├── useSessionGuard.ts           # Session expiry guard
│   ├── useRoleGuard.ts              # Role-based access
│   ├── useHorseFilters.ts           # Horse list filter logic
│   ├── useHorseGenetics.ts          # Genetics display logic
│   ├── useHorseCoatGenetics.ts      # Coat-color genetics helpers
│   ├── useResponsiveBackground.ts   # Responsive bg sizing
│   ├── useMediaQuery.ts             # Tailwind breakpoint media queries
│   ├── useSound.ts                  # Sound playback hook
│   └── api/                         # 57 React Query hooks (see below)
├── types/                           # Domain TypeScript types
│   ├── breeding.ts                  # Breeding-related types
│   ├── foal.ts                      # Foal/lifecycle types
│   ├── horse.ts                     # Core horse type
│   ├── traits.ts                    # Trait definitions
│   ├── groomBonusTrait.ts           # Groom bonus trait types
│   ├── groomCareer.ts               # Groom career/XP types
│   ├── groomLegacy.ts               # Groom legacy/retirement types
│   ├── groomPersonality.ts          # Groom personality types
│   ├── groomShowHandler.ts          # Groom show-handler types
│   ├── groomTalent.ts               # Groom talent-tree types
│   ├── groomTasks.ts                # Groom task definitions
│   ├── riderCareer.ts               # Rider career types
│   ├── riderDiscovery.ts            # Rider discovery types
│   └── riderPersonality.ts          # Rider personality types
├── pages/                           # 40 page components (all lazy-loaded)
│   ├── Index.tsx                    # Home / Hub dashboard
│   ├── StableView.tsx               # Stable management
│   ├── TrainingPage.tsx             # Training hub
│   ├── BreedingPage.tsx             # Breeding hub
│   ├── CompetitionBrowserPage.tsx   # Competition discovery
│   ├── ConformationShowsPage.tsx    # Conformation show entry surface
│   ├── WorldHubPage.tsx             # 9 location cards
│   ├── HorseDetailPage.tsx          # Tabbed horse detail
│   ├── FoalDetailPage.tsx           # Foal lifecycle detail page
│   ├── LoginPage.tsx                # Auth: login
│   ├── RegisterPage.tsx             # Auth: register
│   ├── OnboardingPage.tsx           # 3-step new player wizard
│   ├── ProfilePage.tsx              # User profile
│   ├── SettingsPage.tsx             # Account/Notifications/Display settings
│   ├── BankPage.tsx                 # Balance, weekly claim, transactions
│   ├── InventoryPage.tsx            # Item grid, equip flow
│   ├── MyStablePage.tsx             # Stable profile + Hall of Fame
│   ├── CommunityPage.tsx            # Community hub
│   ├── MessageBoardPage.tsx         # Forum threads (5 sections)
│   ├── MessageThreadPage.tsx        # Individual forum thread view
│   ├── ClubsPage.tsx                # Clubs + elections
│   ├── MessagesPage.tsx             # Inbox/Sent DMs
│   ├── GroomsPage.tsx               # Groom management
│   ├── RidersPage.tsx               # Rider system
│   ├── TrainersPage.tsx             # Trainer hire/manage
│   ├── LeaderboardsPage.tsx         # Leaderboard categories
│   ├── VeterinarianPage.tsx         # Vet clinic
│   ├── FarrierPage.tsx              # Farrier services
│   ├── FeedShopPage.tsx             # Feed purchases
│   ├── TackShopPage.tsx             # Tack equipment
│   ├── CraftingPage.tsx             # Leathersmith crafting workshop
│   ├── MarketplaceHubPage.tsx       # Marketplace hub (Epic 21)
│   ├── MarketplacePage.tsx          # General marketplace
│   ├── HorseMarketplacePage.tsx     # Horse trading
│   ├── HorseTraderPage.tsx          # Horse Trader sub-route
│   ├── CompetitionResultsPage.tsx   # Results display
│   ├── PrizeHistoryPage.tsx         # Prize transaction log
│   ├── VerifyEmailPage.tsx          # Email verification
│   ├── ForgotPasswordPage.tsx       # Password reset request
│   ├── ResetPasswordPage.tsx        # Password reset form
│   ├── breeding/                    # Breeding flow sub-pages
│   ├── horse-detail/                # Horse-detail tabs/sub-pages
│   └── horses/                      # Horse-related page modules
└── components/                      # 242 component files (excluding tests)
    ├── (root — 28 files)            # Top-level feature components incl. Fantasy* legacy
    ├── auth/ (8)                    # Auth guards + layout
    ├── breeding/ (12)               # Breeding center, selectors, predictions
    ├── common/ (4)                  # BaseModal, CooldownTimer, shared primitives
    ├── competition/ (20)            # Cards, modals, charts, prize display
    ├── feedback/ (7)                # CinematicMoment, LevelUp, XP badges
    ├── foal/ (17)                   # Milestones, enrichment, evaluation
    ├── groom/ (9)                   # Talent tree, career, personality
    ├── horse/ (21)                  # Filters, progression, XP bars, charts
    ├── hub/ (3)                     # NextActionsBar, WhileYouWereGone
    ├── layout/ (12)                 # DashboardLayout, StarfieldBackground, NavPanel
    ├── leaderboard/ (8)             # Leaderboard tabs, tables, badges
    ├── onboarding/ (2)              # OnboardingSpotlight, BreedSelector
    ├── rider/ (5)                   # Personality, career, assignment
    ├── theme/ (1)                   # CelestialThemeProvider
    ├── trainer/ (5)                 # Personality, career, assignment
    ├── training/ (25)               # Dashboard, modals, charts, trait modifiers
    ├── traits/ (7)                  # Epigenetic display, competition impact
    └── ui/ (25)                     # shadcn primitives + custom UI (incl. game/)
```

---

## Routing

**Library:** react-router-dom v6

**Total routes:** 40

- 6 public routes (login, register, verify-email, forgot-password, reset-password, onboarding)
- 31 routes declared in `nav-items.tsx` and wrapped in `<ProtectedRoute>` + `<DashboardLayout>`
  - 11 main nav routes (Home, My Stable, Inventory, Breeding, Competitions, World, Marketplace, Riders, Leaderboards, Settings, Profile)
  - 20 sub-location / route-only entries (Grooms, Vet, Farrier, Feed Shop, Tack Shop, Crafting, Bank, Training, My Stable detail, Trainers, Marketplace sub-routes, Competition Results, Conformation Shows, Prizes, Community, Message Board, Message Thread, Clubs, Messages)
- 3 explicit `<Route>` declarations in `App.tsx` for parameterized detail pages: `/horses/:id`, `/horses/:id/equip`, `/foals/:id`

Note: "Training" is registered as a route-only entry (not in the main nav bar) — main-nav visibility was removed after the feed-system redesign.

All pages are lazy-loaded via `React.lazy()` with `<Suspense fallback={<GallopingLoader />}>`.

---

## State Management

### Server State: React Query (TanStack Query)

57 API hook files in `hooks/api/` providing typed queries and mutations:

| Domain          | Hooks                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Horses**      | useHorses, useHorseAge, useHorseStats, useHorseXP, useHorseLevelInfo, useHorseEligibility, useHorsePrizeSummary, useHorseCompetitionHistory          |
| **Training**    | useTraining                                                                                                                                          |
| **Breeding**    | useBreeding, useBreedingPrediction, useBreeds, useConformation, useConformationShow, useColorPrediction                                              |
| **Genetics**    | useGaits, useTemperamentDefinitions                                                                                                                  |
| **Competition** | useCompetitions, useCompetitionsFiltered, useCompetitionDetails, useCompetitionResults, useEnterCompetition, useClaimPrizes, useUserCompetitionStats |
| **Prizes/XP**   | usePrizeHistory, useXpHistory, useAddXp                                                                                                              |
| **Leaderboard** | useLeaderboard, useLeaderboardRefresh, useUserRankSummary                                                                                            |
| **Staff**       | useGrooms, useRiders, useTrainers                                                                                                                    |
| **Community**   | useForum, useMessages, useClubs, useGameNotifications                                                                                                |
| **Commerce**    | useInventory, useTackShop, useFeedShop, useFarrier, useVet, useMarketplace, useHorseTrader, useCrafting, useEquippable, useEquipFeed, useFeedHorse   |
| **User**        | useUserProgress, useProgression, useOnboarding, useUserBalance, useTransactionHistory, useUpdatePreferences                                          |
| **Hub**         | useNextActions, useWhileYouWereGone                                                                                                                  |

**Cache strategy:**

| Data Type            | staleTime | Refetch on Focus |
| -------------------- | --------- | ---------------- |
| Leaderboards         | 5 min     | No               |
| Competition list     | 1 min     | Yes              |
| Results (historical) | 10 min    | No               |
| User balance         | 30 sec    | Yes              |
| Horse details        | 2 min     | Yes              |

### Auth State: AuthContext

- JWT access + refresh tokens (HttpOnly cookies)
- `useAuth()` convenience hook
- `ProtectedRoute` wrapper for authenticated routes
- `RoleProtectedRoute` for admin/mod access
- `OnboardingGuard` redirects new users to /onboarding

### Feature Flags: FeatureFlagContext

- Runtime feature flag toggles
- Debug overlay in development (z-index 9999)

### URL State

- `useSearchParams` for filter/sort persistence (shareable URLs, back/forward navigation)

---

## API Integration

### api-client.ts

- Typed endpoint methods organized by domain namespace (horsesApi, trainingApi, breedingApi, competitionsApi, etc.)
- All endpoints use `/api/v1/` prefix
- `fetchWithAuth()` auto-unwraps `data.data` — hooks receive clean typed responses
- `VITE_API_URL ?? ''` for relative URLs in production (embedded SPA)
- Automatic token refresh on 401 responses

### Proxy Configuration (Development)

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Vite proxies `/api/*` requests to backend

---

## Component Library

### shadcn/ui Primitives (25 files in `ui/`)

Includes a `ui/game/` sub-folder (~12 files) holding game-themed UI primitives (e.g. cobalt buttons, parchment cards) used by the Celestial Night theme.

| Component   | File              | Purpose                      |
| ----------- | ----------------- | ---------------------------- |
| Button      | `button.tsx`      | Action buttons with variants |
| Card        | `card.tsx`        | Content containers           |
| Dialog      | `dialog.tsx`      | Modal dialogs                |
| Tabs        | `tabs.tsx`        | Tab navigation               |
| Tooltip     | `tooltip.tsx`     | Hover tooltips               |
| Input       | `input.tsx`       | Form text inputs             |
| Label       | `label.tsx`       | Form labels                  |
| Badge       | `badge.tsx`       | Status badges                |
| Checkbox    | `checkbox.tsx`    | Form checkboxes              |
| Collapsible | `collapsible.tsx` | Expandable sections          |
| Progress    | `progress.tsx`    | Progress bars                |
| ScrollArea  | `scroll-area.tsx` | Custom scroll containers     |
| Textarea    | `textarea.tsx`    | Multi-line text input        |
| Sonner      | `sonner.tsx`      | Toast notifications          |

### Custom UI Components

| Component               | File                                   | Purpose                                                 |
| ----------------------- | -------------------------------------- | ------------------------------------------------------- |
| GallopingLoader         | `ui/GallopingLoader.tsx`               | Animated horse Suspense fallback                        |
| FenceJumpBar            | `ui/FenceJumpBar.tsx`                  | XP progress bar with fence markers + jumping horse      |
| GlassPanel              | `ui/GlassPanel.tsx`                    | Glassmorphism wrapper with optional blur                |
| StatBar                 | `ui/StatBar.tsx`                       | Accessible progress bar for stats                       |
| SkeletonCard            | `ui/SkeletonCard.tsx`                  | Loading skeletons (horse, location, trait badge)        |
| EmptyState              | `ui/EmptyState.tsx`                    | Empty data placeholder                                  |
| ErrorCard               | `ui/ErrorCard.tsx`                     | Error display card                                      |
| GoldBorderFrame         | `ui/GoldBorderFrame.tsx`               | Decorative gold border wrapper                          |
| LocationCard            | `LocationCard.tsx`                     | 3-layer atmospheric card with painting gradient         |
| CinematicMoment         | `feedback/CinematicMoment.tsx`         | Fullscreen overlay (trait-discovery/foal-birth/cup-win) |
| LevelUpCelebrationModal | `feedback/LevelUpCelebrationModal.tsx` | Ribbon unfurl trophy banner                             |
| BaseModal               | `common/BaseModal.tsx`                 | Reusable modal with focus trap + portal                 |
| CooldownTimer           | `common/CooldownTimer.tsx`             | Real-time countdown display                             |

### Fantasy-Themed Components (Root, legacy)

Four `Fantasy*` components remain at the root of `components/`. These predate the Celestial Night theme and are scheduled for replacement with `Celestial*` equivalents under bd issue Equoria-1nlw. New work should NOT add additional `Fantasy*` components — prefer `ui/` primitives or `theme/` wrappers.

| Component     | Purpose                        |
| ------------- | ------------------------------ |
| FantasyButton | Styled action buttons (legacy) |
| FantasyForm   | Themed form wrapper (legacy)   |
| FantasyModal  | Styled modal dialogs (legacy)  |
| FantasyTabs   | Themed tab navigation (legacy) |

---

## Design System

### Theme: Celestial Night

- Deep blue backgrounds with gold accents
- CSS custom properties defined in `styles/tokens.css`
- `CelestialThemeProvider` applies `body.celestial` class
- Reads `?theme=` URL param + localStorage for persistence

### Z-Index Token System

Defined in `tokens.css` and consumed via `z-[var(--z-*)]` in Tailwind:

| Token             | Value | Usage                            |
| ----------------- | ----- | -------------------------------- |
| `--z-raised`      | 10    | Sticky headers, badges, overlays |
| `--z-sticky`      | 20    | Sticky bars, close buttons       |
| `--z-dropdown`    | 40    | Menus, dropdowns                 |
| `--z-modal`       | 70    | Modal dialogs                    |
| `--z-celebration` | 90    | CinematicMoment overlays         |

### Animation System

20+ keyframes defined in `index.css`:

- `skeleton-sweep` — Loading skeleton shimmer
- `onboarding-ring-pulse` — Spotlight ring animation
- `gallop` — Horse loader animation
- Horseshoe borders (`.btn-cobalt::before/::after`) — Gold arcs with hover transition
- Various celebration/confetti animations for level-up and prize moments

---

## Onboarding System

### New Player Flow

1. `OnboardingGuard` detects `completedOnboarding === false` and redirects to `/onboarding`
2. `OnboardingPage` — 3-step wizard (Welcome, Starter Kit, Ready)
3. "Let's Go!" calls `advanceOnboarding()` (step 0 to 1) and navigates to `/bank`

### Guided Tour (10 Steps)

- `OnboardingSpotlight` renders when `completedOnboarding === false && onboardingStep >= 1`
- Pulsing ring via `getBoundingClientRect` highlights target elements (`data-onboarding-target`)
- Wrong-route detection shows floating chip with navigation button
- "Skip tutorial" calls `completeOnboarding()` to finish immediately

---

## Performance

### Code Splitting

- All 40 pages lazy-loaded via `React.lazy()` + `<Suspense>`
- Initial chunk: ~321 KB
- `rollup-plugin-visualizer` generates `dist/bundle-stats.html`

### Optimization

- React Query caching reduces redundant API calls
- `React.memo` on expensive renders
- `useMemo`/`useCallback` for computed values
- Vite tree-shaking + minification in production

### Production Build

- Multi-stage Docker: `frontend-builder` (Vite) then `production` (Express + embedded SPA)
- `express.static(public/)` + SPA `index.html` fallback
- Lighthouse CI thresholds: a11y >= 0.85, perf >= 0.6

---

## Testing

### Framework

- **Unit/Component:** Vitest + React Testing Library
- **Mocking:** MSW (Mock Service Worker) with `onUnhandledRequest: 'error'` strict mode
- **E2E:** Playwright (core-game-flows, auth, breeding suites)

### Patterns

- `within()` scoping for duplicate `data-testid` values
- Container/presentational separation for testable pure components
- MSW handlers mirror real API responses for integration tests

### Test Files

- Page tests in `pages/__tests__/` (15+ test files)
- Component tests in `components/__tests__/`
- Breeding tests in `pages/breeding/__tests__/`

---

## Key Integration Points

### Data Flow

```
api-client.ts (typed endpoints across 17+ domains)
    → React Query hooks (typed queries/mutations, cache keys)
        → Feature components (consume data, show loading/error states)
            → Mutations invalidate relevant cache keys
            → Errors bubble to toasts (Sonner) or inline states
            → Loading via GallopingLoader / SkeletonCard
```

### API Domains Covered

- **Auth:** register, login, refresh, profile, onboarding, advance-onboarding
- **Horses:** list, detail, stats, genetics, conformation, XP, level
- **Training:** check-eligibility, train, status, trainable-horses
- **Breeding:** breed, pairs, predictions, foal development, enrichment, traits, color prediction
- **Competition:** list, enter, results, prizes, claim, leaderboards
- **Staff:** grooms (hire/assign/interact), riders, trainers
- **Community:** forums (threads/posts), DMs (inbox/sent), clubs (join/leave/elections), in-game notifications
- **Commerce:** inventory (equip/unequip), tack shop, feed shop, farrier, vet, marketplace, horse trader, crafting
- **User:** progress, dashboard, bank (balance/claim/transactions), preferences
