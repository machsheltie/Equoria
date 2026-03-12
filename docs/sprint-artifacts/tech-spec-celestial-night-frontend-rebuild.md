# Tech-Spec: Celestial Night Frontend Rebuild + Backend Model Updates

**Created:** 2026-03-11
**Status:** Ready for Development
**Input Documents:**

- `docs/ux-design-specification.md` (complete, 14 steps, 2021 lines)
- `docs/plans/2026-03-11-ux-implementation-roadmap.md` (3-phase plan)
- `docs/product/PRD-02-Core-Features.md`, `PRD-03-Gameplay-Systems.md`, `PRD-07-Player-Guide.md`

---

## Overview

### Problem Statement

Equoria's frontend is production-complete (Epics 1-21, 80+ components, 29 pages) but uses generic Tailwind/shadcn styling that looks like a corporate dashboard, not a fantasy horse breeding game. The UX Design Specification defines a comprehensive "Celestial Night" visual identity — deep navy gradients, frosted glass panels, gold accents, serif typography — that must replace the current aesthetic across the entire application.

Additionally, two core backend gameplay models diverge from the UX spec's design intent:

1. **Competition model** — currently instant simulation; spec requires player-created shows with 7-day entry windows and overnight execution
2. **Foal development model** — currently 6-day enrichment; spec requires 0-2 year lifecycle with age-evolving groom activities

### Solution

A progressive, page-by-page restyle using a **Feature-Flag Hybrid** migration strategy:

- `<body class="celestial">` CSS class scoping (zero-JS theming toggle)
- `?theme=celestial` URL param for QA testing (persists in localStorage)
- Page-by-page conversion: new Celestial pages coexist with legacy pages until cutover
- Backend model updates delivered in parallel with frontend foundation work

### Scope

#### In Scope

- Complete frontend visual rebuild (all 29 pages, 80+ components)
- 13 shadcn component restylings (Button, Card, Dialog, Tabs, Badge, Input, Textarea, Progress, Checkbox, Label, Tooltip, ScrollArea, Collapsible)
- 13 new custom components (see Section: New Components)
- Hub dashboard rebuild with NextActionsBar constellation model
- WhileYouWereGone return overlay system
- Onboarding wizard rebuild with BreedSelector
- Backend: Competition model rewrite (7-day windows, overnight execution, show creation)
- Backend: Foal development model expansion (0-2 year lifecycle)
- Backend: 3 new endpoints (WYAG aggregation, NextActions, milestones)
- Backend: User.settings.milestones JSONB field
- Font migration (Yeseva One/Cormorant Garamond/Jost → Cinzel Decorative/Cinzel/Inter)
- Design token updates in tokens.css
- Responsive design (mobile-first: 375px → tablet: 768px → desktop: 1024px+)
- WCAG 2.1 Level AA compliance throughout
- `prefers-reduced-motion` support on all new animations

#### Out of Scope

- Art asset creation (owner-created by Heirr — placeholder.svg fallback exists)
- Sound system implementation (OFF by default; Settings toggle is new but deferred)
- Real-time WebSocket features (use polling/React Query refetch)
- Native mobile app
- Payment/monetization systems
- Social media integration

---

## Context for Development

### Current Tech Stack

| Layer         | Technology                      | Version                 | Notes                                    |
| ------------- | ------------------------------- | ----------------------- | ---------------------------------------- |
| Framework     | React                           | 19.1.0                  | Strict mode enabled                      |
| Language      | TypeScript                      | 5.2.2                   | `strict: false` in tsconfig              |
| Build         | Vite                            | 7.2.7                   | Dev port 3000, proxy /api → :3001        |
| Styling       | Tailwind CSS                    | 3.4.1                   | `darkMode: 'class'`, tailwindcss-animate |
| Server State  | TanStack React Query            | 5.x                     | Hooks in `hooks/api/`, strict MSW        |
| Routing       | React Router                    | 6.x                     | Lazy-loaded, v7 future flags enabled     |
| UI Primitives | shadcn/ui (Radix)               | 14 components           | + 6 custom primitives                    |
| Icons         | Lucide React                    | 0.460                   | 20+ icons in nav                         |
| Charts        | Recharts + Chart.js             | 3.7 / 4.5               | Separate vendor chunk                    |
| Toasts        | Sonner                          | 2.x                     | —                                        |
| Validation    | Zod                             | 4.x                     | Auth schemas                             |
| Monitoring    | Sentry                          | 10.x                    | Error boundary + perf                    |
| Backend       | Node.js + Express               | ES Modules              | 18 domain modules                        |
| Database      | PostgreSQL + Prisma             | —                       | JSONB for settings/traits                |
| Testing       | Vitest + RTL + MSW + Playwright | 4.x / 16.x / 2.x / 1.55 | Strict MSW mode                          |

### Codebase Patterns

#### Component Architecture

- **Domain folders**: `components/{domain}/` (breeding, training, competition, groom, rider, trainer, etc.)
- **Props**: TypeScript interfaces, optional with `?`, event handlers as `on*`
- **State**: React Query for server state, `useState` for local UI, `AuthContext` for auth
- **Styling**: Tailwind utilities + CSS custom properties from `tokens.css`. No raw hex/rgba in components.
- **Modals**: `BaseModal` component (5 sizes, focus trap, escape handling, portal rendering)
- **Glassmorphism**: Single-blur-layer rule — only ONE `backdrop-filter: blur()` per viewport stack
- **Lazy loading**: All pages via `React.lazy()` in `nav-items.tsx` with `<Suspense fallback={<GallopingLoader />}>`

#### API Integration

- **Client**: `frontend/src/lib/api-client.ts` — native `fetch`, httpOnly cookies, auto-refresh on 401, rate-limit handling
- **Hooks**: `frontend/src/hooks/api/` — one file per resource, exports query keys + `useQuery` + `useMutation`
- **Response shape**: `{ success: boolean, message?: string, data?: T }`
- **Pagination**: `{ pagination: { page, limit, total, totalPages } }`
- **Cache strategy**: Per data type (30s balance → 5min leaderboards → 10min results)

#### Design Token System (tokens.css — 380+ lines)

Already has comprehensive token coverage:

- **Navy scale**: `--celestial-navy-950` to `-100`
- **Gold scale**: `--gold-700` to `-300`
- **Electric blue**: `--electric-blue-700` to `-300`
- **Glass surfaces**: `--glass-surface-bg`, `--glass-blur`, `--glass-border`
- **Typography**: `--font-display` (Cinzel Decorative), `--font-heading` (Cinzel), `--font-body` (Jost currently → Inter)
- **Z-index**: `--z-below` (-1) to `--z-above-all` (100)
- **Animation**: `--duration-instant` (50ms) to `--duration-cinematic` (1200ms)
- **Accessibility**: `prefers-reduced-motion` media query zeros all durations
- **Forced colors**: `forced-colors: active` media query provides high-contrast fallbacks

#### Testing Patterns

- **Vitest config**: `frontend/vitest.config.ts` — jsdom, globals, 10s timeout, forks pool
- **MSW handlers**: `frontend/src/test/msw/handlers.ts` — 25+ endpoint mocks, `onUnhandledRequest: 'error'`
- **Component tests**: `vi.mock('@/hooks/api/...')`, `QueryClientProvider` wrapper with `retry: false`
- **E2E**: Playwright with `storageState` auth persistence, global-setup seeds test data
- **Scoping**: `within()` for duplicate testids (Pattern Library AI-7-3)

### Files to Reference

#### Foundation Files (Modify)

| File                             | What Changes                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `frontend/src/styles/tokens.css` | Update `--font-body` from Jost → Inter; add StarfieldBackground tokens; refine glass surface values         |
| `frontend/src/index.css`         | Update body gradient; add `.celestial` class scope; update `.glass-panel`, `.btn-cobalt`; add new keyframes |
| `frontend/tailwind.config.ts`    | Update fontFamily (Cinzel/Inter), add Celestial Night color aliases                                         |
| `frontend/src/App.tsx`           | Add CelestialThemeProvider (CSS class toggle), WhileYouWereGone overlay mount point                         |
| `frontend/src/main.tsx`          | Add Google Fonts link (Cinzel, Cinzel Decorative, Inter) or preload                                         |
| `frontend/src/lib/api-client.ts` | Add WYAG, NextActions, milestones API methods                                                               |
| `frontend/src/nav-items.tsx`     | Update nav structure for hub-and-spoke model                                                                |

#### shadcn Components to Restyle (13 files)

| File                            | Restyle Focus                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `components/ui/button.tsx`      | Gold primary, frosted secondary, text tertiary, destructive red; horseshoe arcs on primary |
| `components/ui/card.tsx`        | Glass surface bg, gold border on hover, shadow-card → shadow-card-hover                    |
| `components/ui/dialog.tsx`      | Dark overlay (0.85 opacity), glass panel content, gold header accent                       |
| `components/ui/tabs.tsx`        | Underline indicator (gold), frosted tab bar, active text color                             |
| `components/ui/badge.tsx`       | Discipline-specific accent colors, rounded-pill, small-caps                                |
| `components/ui/input.tsx`       | `.celestial-input` class (navy bg, blue border, focus ring)                                |
| `components/ui/textarea.tsx`    | Match input styling                                                                        |
| `components/ui/progress.tsx`    | Gold fill gradient, navy track, glow on completion                                         |
| `components/ui/checkbox.tsx`    | Gold checkmark, navy bg, electric-blue focus ring                                          |
| `components/ui/label.tsx`       | Inter font, cream color, small-caps variant                                                |
| `components/ui/tooltip.tsx`     | Glass panel tooltip, gold border, navy bg                                                  |
| `components/ui/scroll-area.tsx` | Thin gold scrollbar thumb, transparent track                                               |
| `components/ui/collapsible.tsx` | Chevron rotation animation, glass panel content area                                       |

#### New Custom Components (13 to build)

| Component                   | Location                                             | Priority | Description                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **StarfieldBackground**     | `components/layout/StarfieldBackground.tsx`          | P1       | CSS-only animated starfield replacing current StarField; parallax layers, shooting stars, `prefers-reduced-motion` safe                                             |
| **NextActionsBar**          | `components/hub/NextActionsBar.tsx`                  | P1       | Constellation-model suggestion bar; server-seeded actions with client narrative text; priority ordering                                                             |
| **WhileYouWereGone**        | `components/hub/WhileYouWereGone.tsx`                | P1       | Return overlay (trigger: 4+ hours away); prioritized item list (competition results → foal milestones → messages → club activity); max 8 items; dismiss interaction |
| **BreedSelector**           | `components/onboarding/BreedSelector.tsx`            | P1       | Grid/list toggle breed picker; breed preview with stat tendencies; gender selection; name input with preview                                                        |
| **NarrativeChip**           | `components/hub/NarrativeChip.tsx`                   | P2       | Contextual micro-story chip on horse/stable cards ("Ready to compete!", "Foal developing well")                                                                     |
| **CooldownTimer**           | `components/common/CooldownTimer.tsx`                | P2       | Real-time countdown display; training/breeding cooldowns; "Ready!" state with glow                                                                                  |
| **DisciplineSelector**      | `components/training/DisciplineSelector.tsx`         | P2       | Top 5 recommendations (server-ranked by horse aptitude) + expandable full list; stat impact preview                                                                 |
| **CompetitionFieldPreview** | `components/competition/CompetitionFieldPreview.tsx` | P2       | Scouting view of entered horses; stat comparison radar; entry count; closing date countdown                                                                         |
| **CompatibilityPreview**    | `components/breeding/CompatibilityPreview.tsx`       | P2       | Tabbed preview (stat ranges, traits, inbreeding coefficient, pedigree overlap); bidirectional entry                                                                 |
| **DevelopmentTracker**      | `components/foal/DevelopmentTracker.tsx`             | P2       | 0-2yr timeline (desktop) / card view (mobile); age-appropriate activity list; milestone history; trait status                                                       |
| **ScoreBreakdownRadar**     | `components/competition/ScoreBreakdownRadar.tsx`     | P3       | Recharts radar chart with Celestial Night styling; personal best overlay                                                                                            |
| **RewardToast**             | `components/feedback/RewardToast.tsx`                | P3       | Meaningful-only toast (not for every click); gold accent, icon by type, 4s auto-dismiss                                                                             |
| **GoldBorderFrame**         | `components/ui/GoldBorderFrame.tsx`                  | P3       | Decorative frame for hero panels, achievement cards; animated corner flourishes                                                                                     |

#### Backend Files to Create/Modify

| File                                                                | Action            | Description                                                                             |
| ------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `backend/modules/competition/controllers/competitionController.mjs` | **Major rewrite** | Add show creation, 7-day window management, overnight execution scheduler               |
| `backend/modules/competition/routes/competitionRoutes.mjs`          | **Major rewrite** | New endpoints: create-show, browse-shows, enter-show, show-results                      |
| `backend/modules/breeding/controllers/foalController.mjs`           | **Expand**        | 0-2yr lifecycle, age-based activity calculation, milestone detection                    |
| `backend/modules/breeding/routes/foalRoutes.mjs`                    | **Expand**        | New: GET milestone-aware development, POST age-appropriate activity                     |
| `backend/modules/auth/controllers/authController.mjs`               | **Modify**        | Add `milestones` to User.settings JSONB; `firstEverWin`, `firstBreedingSuccess`, etc.   |
| `backend/controllers/wyagController.mjs`                            | **New**           | WhileYouWereGone aggregation endpoint                                                   |
| `backend/routes/wyagRoutes.mjs`                                     | **New**           | `GET /api/v1/while-you-were-gone?since=timestamp`                                       |
| `backend/controllers/nextActionsController.mjs`                     | **New**           | NextActions suggestion engine                                                           |
| `backend/routes/nextActionsRoutes.mjs`                              | **New**           | `GET /api/v1/next-actions`                                                              |
| `packages/database/prisma/schema.prisma`                            | **Modify**        | Add Show model fields (openDate, closeDate, executedAt, status), expand FoalDevelopment |

### Technical Decisions (ADRs from Step 1)

#### ADR-1: WhileYouWereGone — Server Aggregation Endpoint

**Decision:** New `GET /api/v1/while-you-were-gone?since=<ISO-timestamp>` endpoint
**Rationale:** Client-side assembly from 6+ endpoints would require 6 parallel fetches on every return visit. Single aggregation endpoint returns prioritized list in one RTT.
**Shape:**

```typescript
interface WYAGResponse {
  items: Array<{
    type:
      | 'competition-result'
      | 'foal-milestone'
      | 'message'
      | 'club-activity'
      | 'training-complete'
      | 'market-sale';
    priority: number; // 1 = highest
    title: string;
    description: string;
    timestamp: string; // ISO
    actionUrl?: string; // deep link
    metadata?: Record<string, unknown>;
  }>;
  since: string;
  hasMore: boolean;
}
```

#### ADR-2: NextActionsBar — Hybrid (Server Seeds + Client Narrative)

**Decision:** Server computes action priorities; client formats narrative text
**Rationale:** Server knows cooldown states, pending results, foal ages. Client adds personality ("Your foal Luna is ready for her weekly enrichment!"). Keeps server logic simple, client copy flexible.
**Shape:**

```typescript
interface NextAction {
  type:
    | 'train'
    | 'compete'
    | 'breed'
    | 'groom-foal'
    | 'claim-prize'
    | 'check-results'
    | 'visit-vet';
  priority: number;
  horseId?: number;
  horseName?: string;
  metadata?: Record<string, unknown>; // cooldownEndsAt, foalAge, showId, etc.
}
```

#### ADR-3: Competition Field Scouting — Fetch-on-View

**Decision:** Fetch competition field data when user opens scouting view, not real-time polling
**Rationale:** 7-day entry windows don't need real-time. React Query with 5min `staleTime` provides freshness without unnecessary load.

#### ADR-4: CinematicMoment Triggers — Server Milestone Flags

**Decision:** Server tracks lifetime-first achievements in `User.settings.milestones` JSONB
**Rationale:** Client can't reliably track "first ever" across sessions/devices. Server sets `firstEverWin: true` in competition result response when User.settings.milestones.firstWin is null; client triggers CinematicMoment on that flag.
**Reserved CinematicMoment events (lifetime-first ONLY):**

- First competition win
- First breeding success (foal born)
- First trait discovery
- First legendary trait
- First horse reaches max level
  **NOT triggered for:** Regular 1st-place finishes (players enter hundreds of shows)

#### ADR-5: Foal Development Tracker — Expand Existing Endpoint

**Decision:** Expand `GET /api/v1/foals/:id/development` to include age-aware milestones
**Rationale:** Endpoint exists and works. Add `ageInWeeks`, `ageStage` (newborn/weanling/yearling/two-year-old), `availableActivities` (filtered by age), `completedMilestones` to response.

---

## Implementation Plan

### Migration Strategy: Feature-Flag Hybrid (Path C)

**Mechanism:**

```css
/* All new styles scoped under .celestial */
.celestial .glass-panel {
  /* updated styles */
}
.celestial .btn-primary {
  /* gold gradient */
}

/* Legacy styles remain untouched until page is converted */
```

**Toggle:**

- `<body class="celestial">` added by `CelestialThemeProvider`
- `?theme=celestial` URL param for QA (persists in localStorage)
- Default: ON for converted pages, OFF for unconverted
- Kill switch: remove class to instantly revert

**CelestialThemeProvider** (NOT React Context — pure CSS class):

```typescript
// In App.tsx or main.tsx
useEffect(() => {
  const stored = localStorage.getItem('theme');
  const param = new URLSearchParams(window.location.search).get('theme');
  if (param === 'celestial' || stored === 'celestial' || !stored) {
    document.body.classList.add('celestial');
    localStorage.setItem('theme', 'celestial');
  }
}, []);
```

### Critical Path & Task Ordering

```
Epic 22: Foundation ──────────────────────────┐
  (tokens, fonts, body restyle, StarfieldBg,  │
   glass panel updates, button hierarchy,      │
   CelestialThemeProvider, ?theme=celestial)   │
                                                │
Epic 23: Hub & Daily Loop ────────────────────┤ ← depends on Foundation
  (NextActionsBar, NarrativeChip,              │
   hub dashboard rebuild, aside/bottom sheet)  │
                                                │
┌─ Epic 24: WYAG ─────────────────────────────┤ ← depends on Hub
│  (backend aggregation, overlay component,    │
│   return detection, priority sorting)        │
│                                               │
│  Epic BACKEND-A: Competition Model ──────────┤ ← parallel with Hub
│  (7-day windows, overnight execution,        │
│   show creation, milestones JSONB)           │
│                                               │
├─ Epic 25: Onboarding ───────────────────────┤ ← depends on Foundation
│  (BreedSelector, wizard restyle,             │
│   breed preview with stat tendencies)        │
│                                               │
├─ Epic 26: Training Flow ────────────────────┤ ← depends on Foundation
│  (DisciplineSelector, CooldownTimer,        │
│   training result display restyle)           │
│                                               │
├─ Epic 27: Competition Flow ─────────────────┤ ← depends on BACKEND-A
│  (CompetitionFieldPreview, 7-day UX,        │
│   overnight results, ScoreBreakdownRadar)   │
│                                               │
│  Epic BACKEND-B: Foal Development Model ─────┤ ← parallel with Training
│  (0-2yr lifecycle, age-evolving activities,  │
│   milestone detection)                       │
│                                               │
├─ Epic 28: Breeding Flow ────────────────────┤ ← depends on Foundation
│  (CompatibilityPreview, bidirectional entry, │
│   cost breakdown, CinematicMoment scaling)  │
│                                               │
├─ Epic 29: Foal Development ─────────────────┤ ← depends on BACKEND-B
│  (DevelopmentTracker, 0-2yr timeline,       │
│   age-appropriate activities, milestones)    │
│                                               │
└─ Epic 30: Polish & Consistency ─────────────┘ ← last
   (GoldBorderFrame, ErrorCard restyle,
    RewardToast, empty states, a11y audit)
```

### Tasks

#### Epic 22: Celestial Night Foundation

- [ ] **22-1: Font Migration** — Replace Yeseva One/Cormorant Garamond/Jost with Cinzel Decorative/Cinzel/Inter. Update `tokens.css` (`--font-display`, `--font-heading`, `--font-body`), `tailwind.config.ts` (fontFamily), `index.html` (Google Fonts preload). Verify all 29 pages render with new fonts.
- [ ] **22-2: CelestialThemeProvider** — Add `<body class="celestial">` toggle. `?theme=celestial` URL param persists to localStorage. Add `.celestial` CSS scope to `index.css`. Zero-JS: pure CSS class, no React Context.
- [ ] **22-3: StarfieldBackground Upgrade** — Replace current `StarField` component in `components/layout/` with CSS-only `StarfieldBackground`. 3 parallax layers (near/mid/far stars), optional shooting stars (CSS animation), `prefers-reduced-motion` safe (static dots only). Mount in `App.tsx` at `z-[var(--z-below)]`.
- [ ] **22-4: Glass Panel & Surface Updates** — Update `.glass-panel` in `index.css` for `.celestial` scope. Refine `--glass-surface-bg` opacity values. Add `.glass-panel-heavy` variant for modals. Ensure single-blur-layer rule documented in component JSDoc.
- [ ] **22-5: Button Hierarchy** — Restyle `components/ui/button.tsx` variants: Primary (gold gradient, horseshoe arcs), Secondary (frosted glass, navy border), Tertiary (text-only, underline on hover), Destructive (red with dark bg). All under `.celestial` scope.
- [ ] **22-6: shadcn Component Restyling** — Restyle remaining 12 shadcn components (Card, Dialog, Tabs, Badge, Input, Textarea, Progress, Checkbox, Label, Tooltip, ScrollArea, Collapsible) to Celestial Night under `.celestial` scope. One PR per 4 components.
- [ ] **22-7: Body & Page Chrome** — Update body background gradient (deep navy + gold/blue radial accents). Update `DashboardLayout` (if used). Update `MainNavigation` colors/fonts. Update `AuthLayout` for login/register pages.

#### Epic 23: Hub & Daily Loop

- [ ] **23-1: NextActionsBar Component** — Build `components/hub/NextActionsBar.tsx`. Server-seeded actions + client narrative text. Priority-ordered constellation layout (horizontal scroll on mobile, grid on desktop). Gold accent on top-priority action. Hook: `useNextActions()` calling `GET /api/v1/next-actions`.
- [ ] **23-2: NarrativeChip Component** — Build `components/hub/NarrativeChip.tsx`. Small contextual chip ("Ready to train!", "2 foals developing"). Attach to HorseCard and stable summary cards. Data-driven from horse state (cooldowns, age, health).
- [ ] **23-3: Hub Dashboard Rebuild** — Rewrite `pages/Index.tsx` / `UserDashboard.tsx` as hub-and-spoke constellation. NextActionsBar at top, stable card grid with NarrativeChips, aside panel (desktop 1024px+) / bottom sheet (mobile) for quick details. Day-1 "Getting Started" mode for new users.
- [ ] **23-4: Backend — NextActions Endpoint** — Create `GET /api/v1/next-actions`. Returns prioritized action list based on: training cooldowns, pending competition results, foal ages, unclaimed prizes, unread messages. Auth required.

#### Epic 24: WhileYouWereGone

- [ ] **24-1: Backend — WYAG Aggregation Endpoint** — Create `GET /api/v1/while-you-were-gone?since=<timestamp>`. Aggregates: competition results, foal milestones, messages, club activity, training completions, market sales. Max 8 items, priority-sorted. Auth required.
- [ ] **24-2: WhileYouWereGone Component** — Build `components/hub/WhileYouWereGone.tsx`. Glass panel overlay, prioritized item list, dismiss interaction, surprise element placement. Trigger: `lastVisit` stored in localStorage, threshold: 4+ hours. Mount in `App.tsx` above routes.
- [ ] **24-3: Return Detection** — Store `lastVisit` timestamp in localStorage on `beforeunload`. On app mount, compare to current time. If delta > 4 hours, fetch WYAG endpoint and show overlay. Skip if `completedOnboarding === false`.

#### Epic 25: Onboarding Rebuild

- [ ] **25-1: BreedSelector Component** — Build `components/onboarding/BreedSelector.tsx`. Grid (mobile) / list (desktop) toggle. Breed cards with portrait placeholder, name, stat tendency radar, lore blurb. Gender selection (Mare/Stallion). Name input with live preview.
- [ ] **25-2: Onboarding Wizard Restyle** — Restyle `pages/OnboardingPage.tsx` to Celestial Night. 3 steps: Welcome (atmospheric intro) → Choose Your Horse (BreedSelector) → Ready (stable preview). StarfieldBackground visible behind wizard.
- [ ] **25-3: Breed Data Integration** — Wire BreedSelector to `GET /api/v1/breeds`. Add stat tendencies to breed response if not present (min/max ranges per stat). Cache with 10min staleTime.

#### Epic 26: Training Flow Redesign

- [ ] **26-1: DisciplineSelector Component** — Build `components/training/DisciplineSelector.tsx`. Top 5 server-ranked recommendations (by horse aptitude) + expandable full list of all 24 disciplines. Stat impact preview (which stats affected, predicted gain range).
- [ ] **26-2: CooldownTimer Component** — Build `components/common/CooldownTimer.tsx`. Real-time countdown (days/hours/minutes). Green "Ready!" glow state when cooldown expires. Used for training cooldown (7 days) and breeding cooldown (30 days mare / 14 days stallion).
- [ ] **26-3: Training Page Restyle** — Restyle `pages/TrainingPage.tsx` with DisciplineSelector, CooldownTimer integration, Celestial Night glass panels. Training result display with stat change visualization.

#### Epic BACKEND-A: Competition Model Rewrite

- [ ] **BA-1: Show Model Expansion** — Add to Prisma schema: `Show.status` (enum: open/closed/executing/completed), `Show.openDate`, `Show.closeDate` (7 days after open), `Show.executedAt`, `Show.createdByUserId`, `Show.createdByClubId`. Migration.
- [ ] **BA-2: Show Creation Endpoint** — `POST /api/v1/shows/create`. Body: `{ name, discipline, entryFee?, maxEntries?, description }`. Sets `openDate = now`, `closeDate = now + 7 days`, `status = 'open'`. Auth required. Validation: valid discipline, reasonable entry fee.
- [ ] **BA-3: Show Browse & Entry** — `GET /api/v1/shows?status=open&discipline=...` (paginated browse). `POST /api/v1/shows/:id/enter` (enter horse). Validation: show is open, horse eligible, not already entered, entry fee paid.
- [ ] **BA-4: Overnight Execution Scheduler** — Cron job or scheduled task: find shows where `closeDate <= now && status === 'open'`. Execute competition scoring. Update `status = 'completed'`, set `executedAt`. Award prizes, XP, stat gains. Set `firstEverWin` milestone flag on User.settings.milestones if applicable.
- [ ] **BA-5: Milestones JSONB** — Add `milestones` to User.settings: `{ firstWin?: ISO, firstBreed?: ISO, firstTrait?: ISO, firstLegendary?: ISO, firstMaxLevel?: ISO }`. Set on first occurrence only. Expose in profile response. Competition result response includes `isFirstEverWin: boolean`.

#### Epic 27: Competition Flow Redesign

- [ ] **27-1: CompetitionFieldPreview Component** — Build `components/competition/CompetitionFieldPreview.tsx`. Shows entered horses with stat comparison radar. Entry count / max entries. Closing date CooldownTimer. "Scout the Field" interaction.
- [ ] **27-2: Competition Page Restyle** — Restyle `pages/CompetitionBrowserPage.tsx`. Show browse with filters (discipline, closing date, entry fee range). Entry confirmation with fee breakdown. 7-day entry window UX (progress bar to close date).
- [ ] **27-3: Results Page Restyle** — Restyle `pages/CompetitionResultsPage.tsx`. ScoreBreakdownRadar for each horse. Personal best tracking. Results delivered via WYAG (not instant). Milestone CinematicMoment for lifetime-first win.
- [ ] **27-4: ScoreBreakdownRadar Component** — Build `components/competition/ScoreBreakdownRadar.tsx`. Recharts RadarChart with Celestial Night styling (navy bg, gold data line, electric-blue reference line for personal best).

#### Epic BACKEND-B: Foal Development Model Expansion

- [ ] **BB-1: Age-Based Development** — Expand `FoalDevelopment` model: add `birthDate`, `ageInWeeks` (computed), `ageStage` enum (newborn 0-4wk / weanling 4-26wk / yearling 26-52wk / two-year-old 52-104wk). Compute from `Horse.dateOfBirth`.
- [ ] **BB-2: Age-Evolving Activities** — Define activity sets per age stage. Newborn: imprinting, gentle handling. Weanling: desensitization, social exposure. Yearling: ground work, basic obstacles. Two-year-old: intro to tack, first lead walks. Return available activities in GET endpoint.
- [ ] **BB-3: Milestone Detection** — Define milestones: first bond level 25/50/75/100, first trait discovery, graduation at age 3 (development window closes). Track in FoalDevelopment. Include `completedMilestones` in GET response.
- [ ] **BB-4: Graduation Transition** — At age 3, foal development window closes. Horse becomes "adult" — eligible for training and competition. Trigger graduation CinematicMoment (lifetime-first only). Clear from groom assignments.

#### Epic 28: Breeding Flow Redesign

- [ ] **28-1: CompatibilityPreview Component** — Build `components/breeding/CompatibilityPreview.tsx`. 4 tabs: Stat Ranges (min/max/average predicted), Traits (inheritance probability), Inbreeding (coefficient with warning threshold), Pedigree (ancestor overlap). Bidirectional entry (start from mare OR stallion OR horse detail page).
- [ ] **28-2: Breeding Page Restyle** — Restyle `pages/BreedingPage.tsx` and `pages/breeding/BreedingPairSelection.tsx`. Glass panels, gold accents, CompatibilityPreview integration. Cost breakdown (stud fee + breeding fee). CinematicMoment on foal birth (lifetime-first only; repeat breeders get toast instead).
- [ ] **28-3: CinematicMoment Scaling** — First breeding success → full CinematicMoment ('foal-birth' variant). Subsequent births → RewardToast with foal name + breed. Keyed on `User.settings.milestones.firstBreed`.

#### Epic 29: Foal Development Overhaul

- [ ] **29-1: DevelopmentTracker Component** — Build `components/foal/DevelopmentTracker.tsx`. Timeline view (desktop: horizontal timeline with milestone markers) / card view (mobile: stacked age-stage cards). Shows: current age, stage, available activities, completed milestones, trait status.
- [ ] **29-2: Age-Appropriate Activity UI** — Restyle foal activity selection. Group by age stage. Show age requirements. Disable activities outside current stage. Activity result display with bond/stress changes.
- [ ] **29-3: Milestone CinematicMoment** — Trigger CinematicMoment for lifetime-first trait discovery during foal care. Subsequent discoveries → toast. Graduation at age 3 → CinematicMoment (lifetime-first horse graduating).

#### Epic 30: Polish & Consistency

- [ ] **30-1: GoldBorderFrame Component** — Build `components/ui/GoldBorderFrame.tsx`. Decorative frame with animated corner flourishes. Used on hero panels, achievement displays, Hall of Fame entries.
- [ ] **30-2: ErrorCard Restyle** — Update `components/ui/ErrorCard.tsx` to Celestial Night (dark bg, gold retry button, atmospheric error message).
- [ ] **30-3: RewardToast** — Build `components/feedback/RewardToast.tsx`. Meaningful-only policy (not for every mutation). Gold accent, icon by reward type (coin, star, trophy, heart), 4s auto-dismiss. Replace current Sonner toast styling.
- [ ] **30-4: Empty State Illustrations** — Add atmospheric empty state components for: no horses, no competitions, no messages, no results. Use placeholder.svg as base, add Celestial Night styling.
- [ ] **30-5: Accessibility Audit** — Full WCAG 2.1 AA pass on all converted pages. Color contrast (4.5:1 text, 3:1 UI), keyboard navigation, focus indicators, screen reader testing, `prefers-reduced-motion` verification.
- [ ] **30-6: Bundle Size Audit** — Verify Cinzel/Inter font loading strategy (swap, preload). Check new component impact on chunk sizes. Target: <400KB initial (currently 321KB). Code-split Phase 2/3 components if needed.

### Acceptance Criteria

#### Foundation (Epic 22)

- [ ] AC-F1: `<body class="celestial">` applies Celestial Night theme; removing class reverts to legacy
- [ ] AC-F2: `?theme=celestial` URL param toggles theme and persists in localStorage
- [ ] AC-F3: All text renders in Cinzel (headings) / Inter (body) when `.celestial` is active
- [ ] AC-F4: StarfieldBackground renders 3 parallax star layers; static dots only when `prefers-reduced-motion` is set
- [ ] AC-F5: Button hierarchy renders correctly: gold primary, frosted secondary, text tertiary, red destructive
- [ ] AC-F6: All 13 shadcn components visually match Celestial Night under `.celestial` scope
- [ ] AC-F7: Glass panels use single-blur-layer (no stacked blurs)
- [ ] AC-F8: Body gradient is deep navy with subtle gold/blue radial accents

#### Hub (Epic 23)

- [ ] AC-H1: NextActionsBar shows top-priority actions; gold accent on highest priority
- [ ] AC-H2: Hub dashboard renders as constellation layout with stable card grid
- [ ] AC-H3: Aside panel visible on desktop (1024px+); bottom sheet on mobile
- [ ] AC-H4: NarrativeChips show contextual micro-stories on horse cards
- [ ] AC-H5: New users see "Getting Started" mode with onboarding-aware actions

#### WhileYouWereGone (Epic 24)

- [ ] AC-W1: WYAG overlay appears on return after 4+ hours away
- [ ] AC-W2: Items are priority-sorted (competition results highest)
- [ ] AC-W3: Max 8 items displayed; "View all" link if more
- [ ] AC-W4: Overlay dismissible via click, Escape key, or "Continue" button
- [ ] AC-W5: Does NOT appear for new users (completedOnboarding === false)

#### Competition Backend (Epic BACKEND-A)

- [ ] AC-BA1: Shows can be created with name, discipline, entry fee
- [ ] AC-BA2: Shows automatically close after 7 days
- [ ] AC-BA3: Overnight execution scores all entries and distributes prizes
- [ ] AC-BA4: `firstEverWin` milestone set on User.settings on first-ever win
- [ ] AC-BA5: Competition result response includes `isFirstEverWin: boolean`

#### Foal Development Backend (Epic BACKEND-B)

- [ ] AC-BB1: `GET /api/v1/foals/:id/development` returns `ageInWeeks`, `ageStage`, `availableActivities`
- [ ] AC-BB2: Activities are filtered by age stage (newborn activities unavailable for yearling)
- [ ] AC-BB3: Development window closes at age 3 (activities return empty, graduation milestone set)
- [ ] AC-BB4: Milestones tracked: bond 25/50/75/100, first trait, graduation

#### Accessibility (Cross-cutting)

- [ ] AC-A1: Color contrast ≥ 4.5:1 for all text, ≥ 3:1 for UI components
- [ ] AC-A2: All interactive elements keyboard-accessible with visible focus indicators
- [ ] AC-A3: Screen reader announces all state changes (live regions)
- [ ] AC-A4: `prefers-reduced-motion` disables all motion animations
- [ ] AC-A5: Touch targets ≥ 44×44px on mobile

#### Performance (Cross-cutting)

- [ ] AC-P1: Initial bundle < 400KB (currently 321KB)
- [ ] AC-P2: Fonts load with `font-display: swap` (no FOIT)
- [ ] AC-P3: LCP < 2.5s on 4G connection
- [ ] AC-P4: New components lazy-loaded where possible (Phase 2/3 components)

---

## Additional Context

### Dependencies

#### NPM Packages (New)

| Package       | Purpose                                                                        | Estimated Size |
| ------------- | ------------------------------------------------------------------------------ | -------------- |
| None required | All new components built with existing deps (React, Tailwind, Radix, Recharts) | —              |

**Font Loading:** Cinzel, Cinzel Decorative, Inter via Google Fonts `<link>` in `index.html` with `font-display: swap`. No new npm package needed.

#### Backend Dependencies (New)

| Package                        | Purpose                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `node-cron` or `node-schedule` | Overnight competition execution scheduler (if not using external cron) |

### Testing Strategy

#### Component Tests (Vitest + RTL)

- Each new component gets a test file in `__tests__/` sibling directory
- Test rendering, user interactions, accessibility attributes
- Mock API hooks with `vi.mock()`
- Test `prefers-reduced-motion` behavior via `matchMedia` mock
- Test `.celestial` class scoping (render with/without class)

#### Integration Tests (MSW)

- Add MSW handlers for new endpoints: WYAG, NextActions, show creation, show entry
- Test WYAG overlay trigger logic (4hr threshold)
- Test CinematicMoment milestone triggering

#### E2E Tests (Playwright)

- New E2E flows:
  - Hub dashboard loads with NextActionsBar
  - WYAG overlay appears after simulated absence
  - Competition creation → entry → results flow (7-day window)
  - Onboarding wizard with BreedSelector
  - Foal development timeline navigation
- Screenshot regression for Celestial Night visual consistency

#### Backend Tests

- Unit tests for competition scheduler (mock Date.now for overnight execution)
- Integration tests for show lifecycle (create → enter → close → execute → results)
- Integration tests for WYAG aggregation (multiple event types)
- Integration tests for foal age-based activity filtering

### Notes

#### Font Strategy

- **Cinzel Decorative**: Display/hero text only (horse names, page titles, celebration moments)
- **Cinzel**: All headings (h1-h6), card titles, nav items
- **Inter**: All body text, form labels, descriptions, data values
- Load via Google Fonts with `preconnect` and `font-display: swap`
- Subset to Latin (covers English; expand later if needed)

#### CinematicMoment Policy

- **ONLY** for lifetime-first achievements (tracked in User.settings.milestones)
- Players enter hundreds of shows — CinematicMoment for every win is impractical and annoying
- Repeat events use RewardToast instead
- Reserved events: first win, first breed, first trait, first legendary, first max level, first horse graduating

#### Competition Model Transition

- Current instant-simulation code in `competitionController.mjs` should be preserved as `executeCompetitionScoring()` internal function
- New show lifecycle wraps around existing scoring: create → collect entries → close → execute scoring → distribute results
- Backward compatibility: existing test suite should still pass for scoring logic

#### Sound System

- OFF by default (user has misophonia)
- Settings page toggle (new; Settings page exists from Epic 9B)
- Deferred to post-launch or Epic 30+ — not blocking for Celestial Night

#### Performance Budget

- Current: 321KB initial chunk (5 vendor chunks)
- New fonts: ~60KB (Cinzel + Inter, WOFF2, Latin subset)
- StarfieldBackground: CSS-only, 0KB JS
- New components: lazy-loaded where possible
- Target: < 400KB initial load
- Recharts already in separate `vendor-charts` chunk

#### Player Personas (for QA testing)

1. **Alex (Collector)**: 50+ horses, browses marketplace, cares about breeding genetics
2. **Emma (Enthusiast)**: 5 horses, daily player, loves foal development and grooming
3. **Mike (Competitor)**: 10 horses, enters every competition, tracks personal bests
4. **Sarah (Breeder)**: 20 horses, specializes in lineage, maximizes trait inheritance
