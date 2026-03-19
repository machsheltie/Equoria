# Equoria Frontend Architecture

**Generated:** 2026-03-19 (full rescan)
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
│  │  25 authenticated routes via navItems + /horses/:id                   │  │
│  │  All pages lazy-loaded (React.lazy + Suspense)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         COMPONENT LAYER                               │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │  │
│  │  │ 37 Page components   │  │ 198 Component files across 17        │  │  │
│  │  │ (lazy-loaded chunks) │  │ domain folders + root                 │  │  │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │  │
│  │  │ 22 UI primitives     │  │ Custom: GallopingLoader, FenceJump   │  │  │
│  │  │ (shadcn/Radix-based) │  │ Bar, CinematicMoment, GlassPanel ... │  │  │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         STATE MANAGEMENT                              │  │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │  │
│  │  │ React Query       │  │ 2 Contexts       │  │ URL State          │  │  │
│  │  │ 44 API hooks      │  │ Auth + Feature   │  │ useSearchParams    │  │  │
│  │  │ Server state      │  │ Flags            │  │ Filters/sort       │  │  │
│  │  └──────────────────┘  └─────────────────┘  └────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         API CLIENT                                    │  │
│  │  api-client.ts: 57 typed endpoint methods                             │  │
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
├── nav-items.tsx                    # 25 route definitions (11 nav + 14 sub-location)
├── index.css                        # 20+ animation keyframes, .btn-cobalt horseshoe borders
├── styles/
│   └── tokens.css                   # CSS custom properties: colors, z-index, spacing
├── contexts/
│   ├── AuthContext.tsx               # JWT auth state, login/logout/refresh
│   └── FeatureFlagContext.tsx        # Runtime feature flag toggles
├── lib/                             # 10 utility modules
│   ├── api-client.ts                # 57 typed API methods, fetchWithAuth
│   ├── sentry.ts                    # Sentry init + ErrorBoundary
│   ├── utils.ts                     # cn() classname merge
│   ├── constants.ts                 # App-wide constants
│   ├── featureFlags.tsx             # Feature flag definitions
│   ├── validation-schemas.ts        # Zod/form schemas
│   ├── xp-utils.ts                  # XP calculation helpers
│   ├── currency-utils.ts            # Currency formatting
│   ├── activity-utils.ts            # Activity feed helpers
│   └── statistics-utils.ts          # Stat display helpers
├── hooks/
│   ├── useAuth.ts                   # Auth convenience hook
│   ├── useSessionGuard.ts           # Session expiry guard
│   ├── useRoleGuard.ts              # Role-based access
│   ├── useHorseFilters.ts           # Horse list filter logic
│   ├── useHorseGenetics.ts          # Genetics display logic
│   ├── useResponsiveBackground.ts   # Responsive bg sizing
│   └── api/                         # 44 React Query hooks (see below)
├── pages/                           # 37 page components (all lazy-loaded)
│   ├── Index.tsx                    # Home / Hub dashboard
│   ├── StableView.tsx               # Stable management
│   ├── TrainingPage.tsx             # Training hub
│   ├── BreedingPage.tsx             # Breeding hub
│   ├── CompetitionBrowserPage.tsx   # Competition discovery
│   ├── WorldHubPage.tsx             # 9 location cards
│   ├── HorseDetailPage.tsx          # Tabbed horse detail (Overview/Stats/Pedigree/Health/Stud)
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
│   ├── MarketplacePage.tsx          # General marketplace
│   ├── HorseMarketplacePage.tsx     # Horse trading
│   ├── CompetitionResultsPage.tsx   # Results display
│   ├── PrizeHistoryPage.tsx         # Prize transaction log
│   ├── TrainingDashboardPage.tsx    # Training overview
│   ├── VerifyEmailPage.tsx          # Email verification
│   ├── ForgotPasswordPage.tsx       # Password reset request
│   ├── ResetPasswordPage.tsx        # Password reset form
│   └── breeding/
│       ├── BreedingPairSelection.tsx # Pair selector with CinematicMoment
│       └── BreedingPredictionsPanel.tsx # Trait predictions
└── components/                      # 198 component files
    ├── (root — 35 files)            # Top-level feature components
    ├── auth/ (5)                    # Auth guards + layout
    ├── breeding/ (10)               # Breeding center, selectors, predictions
    ├── common/ (2)                  # BaseModal, CooldownTimer
    ├── competition/ (17)            # Cards, modals, charts, prize display
    ├── feedback/ (6)                # CinematicMoment, LevelUp, XP badges
    ├── foal/ (17)                   # Milestones, enrichment, evaluation
    ├── groom/ (9)                   # Talent tree, career, personality
    ├── horse/ (17)                  # Filters, progression, XP bars, charts
    ├── hub/ (3)                     # NextActionsBar, WhileYouWereGone
    ├── layout/ (10)                 # DashboardLayout, StarfieldBackground, NavPanel
    ├── onboarding/ (2)              # OnboardingSpotlight, BreedSelector
    ├── rider/ (5)                   # Personality, career, assignment
    ├── theme/ (1)                   # CelestialThemeProvider
    ├── trainer/ (5)                 # Personality, career, assignment
    ├── training/ (25)               # Dashboard, modals, charts, trait modifiers
    ├── traits/ (7)                  # Epigenetic display, competition impact
    └── ui/ (22)                     # shadcn primitives + custom UI
```

---

## Routing

**Library:** react-router-dom v6

**Total routes:** 31

- 6 public routes (login, register, verify-email, forgot-password, reset-password, onboarding)
- 25 authenticated routes wrapped in `<ProtectedRoute>` + `<DashboardLayout>`
  - 11 main nav routes (Home, Stable, Training, Breeding, Competitions, World, Marketplace, Riders, Leaderboards, Settings, Profile)
  - 14 sub-location routes (Grooms, Vet, Farrier, Feed Shop, Tack Shop, Bank, Inventory, My Stable, Trainers, Community, Message Board, Clubs, Messages, Horse Detail)

All pages are lazy-loaded via `React.lazy()` with `<Suspense fallback={<GallopingLoader />}>`.

---

## State Management

### Server State: React Query (TanStack Query)

44 API hook files in `hooks/api/` providing typed queries and mutations:

| Domain          | Hooks                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Horses**      | useHorses, useHorseAge, useHorseStats, useHorseXP, useHorseLevelInfo, useHorseEligibility, useHorsePrizeSummary, useHorseCompetitionHistory          |
| **Training**    | useTraining                                                                                                                                          |
| **Breeding**    | useBreeding, useBreedingPrediction, useBreeds, useConformation                                                                                       |
| **Competition** | useCompetitions, useCompetitionsFiltered, useCompetitionDetails, useCompetitionResults, useEnterCompetition, useClaimPrizes, useUserCompetitionStats |
| **Prizes/XP**   | usePrizeHistory, useXpHistory, useAddXp                                                                                                              |
| **Leaderboard** | useLeaderboard, useLeaderboardRefresh, useUserRankSummary                                                                                            |
| **Staff**       | useGrooms, useRiders, useTrainers                                                                                                                    |
| **Community**   | useForum, useMessages, useClubs                                                                                                                      |
| **Commerce**    | useInventory, useTackShop, useFeedShop, useFarrier, useVet, useMarketplace                                                                           |
| **User**        | useUserProgress, useProgression, useOnboarding                                                                                                       |
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

- 57 typed endpoint methods organized by domain namespace (horsesApi, trainingApi, breedingApi, competitionsApi, etc.)
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

### shadcn/ui Primitives (22 files in ui/)

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

### Fantasy-Themed Components (Root)

| Component     | Purpose               |
| ------------- | --------------------- |
| FantasyButton | Styled action buttons |
| FantasyForm   | Themed form wrapper   |
| FantasyModal  | Styled modal dialogs  |
| FantasyTabs   | Themed tab navigation |

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

- All 37 pages lazy-loaded via `React.lazy()` + `<Suspense>`
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
api-client.ts (57 endpoints)
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
- **Breeding:** breed, pairs, predictions, foal development, enrichment, traits
- **Competition:** list, enter, results, prizes, claim, leaderboards
- **Staff:** grooms (hire/assign/interact), riders, trainers
- **Community:** forums (threads/posts), DMs (inbox/sent), clubs (join/leave/elections)
- **Commerce:** inventory (equip/unequip), tack shop, feed shop, farrier, vet, marketplace
- **User:** progress, dashboard, bank (balance/claim/transactions)
