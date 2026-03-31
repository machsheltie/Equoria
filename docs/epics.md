# Equoria - Epic Breakdown: Celestial Night Frontend Rebuild

**Author:** Heirr
**Date:** 2026-03-11
**Project Level:** Brownfield (Epics 1-21 complete, backend 100%, frontend functional)
**Target Scale:** Full visual transformation + backend model updates + UX flow redesign

---

## Overview

This document provides the complete epic and story breakdown for the Celestial Night frontend rebuild phase, transforming Equoria from generic developer UI into an immersive fantasy horse breeding game experience.

**Prior Work:** Epics 1-21 delivered the complete game backend (3,651 tests, 229 suites) and functional frontend (80+ components, 29 pages, 44+ React Query hooks). The game works — it just doesn't _feel_ like a game yet.

**This Phase:** Epics 22-30 + 2 backend epics deliver:

- Complete "Celestial Night" visual identity (deep navy, frosted glass, gold accents, serif typography)
- Hub-and-spoke dashboard with intelligent action suggestions
- WhileYouWereGone return experience
- Competition model rewrite (7-day entry windows, overnight execution)
- Foal development expansion (0-2 year lifecycle)
- 13 new custom feature components + 12 game components (components/ui/game/) + button.tsx restyled
- WCAG 2.1 AA accessibility throughout

**Epics:** 11 total (22-30 frontend + BACKEND-A competition + BACKEND-B foal development)
**Stories:** 35 total

---

## Context Validation

### Prerequisites Verified

| Document         | Status   | Content Summary                                                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| **PRD**          | ✅ Found | 5 documents (PRD-00 through PRD-04) covering brief, overview, core features, gameplay systems, advanced systems |
| **Architecture** | ✅ Found | ARCH-01-Overview.md — 18 domain modules, 229 test suites, CI/CD pipeline                                        |
| **UX Design**    | ✅ Found | Complete 14-step UX specification with Celestial Night design system, 2,021 lines                               |
| **Tech Spec**    | ✅ Found | tech-spec-celestial-night-frontend-rebuild.md — 5 ADRs, implementation plan, 35 tasks                           |
| **Wireframes**   | ✅ Found | wireframe-2026-03-11.excalidraw — 1,104 elements, 18 wireframes (9 screens × 2 breakpoints)                     |

### Documents Analyzed

**PRD Documents:**

1. **PRD-00-Brief.md** — Product purpose, personas, core value, constraints
2. **PRD-01-Overview.md** — Vision, metrics, personas, feature priority framework
3. **PRD-02-Core-Features.md** — User management, horse management, XP/stat progression
4. **PRD-03-Gameplay-Systems.md** — Training (23 disciplines), competition, grooms, breeding, economy
5. **PRD-04-Advanced-Systems.md** — Epigenetics, flags, ultra-rare traits, discovery system

**Architecture:** ARCH-01-Overview.md — 18 domain modules under `backend/modules/`, versioned `/api/v1`, Prisma/PostgreSQL, Railway deploy

**UX Design:** Complete Celestial Night specification — design tokens, 8 core components, page-by-page transformation plan, implementation layers, pre-mortem risk prevention

**Tech Spec:** Feature-Flag Hybrid migration strategy, 5 ADRs (WYAG server aggregation, NextActions hybrid, competition fetch-on-view, CinematicMoment server milestones, foal endpoint expansion), critical path dependency graph

---

## Functional Requirements Inventory

### NEW Functional Requirements (Celestial Night Phase)

These FRs are specific to the visual transformation and UX redesign. They supplement the original PRD FRs (which are fully implemented in Epics 1-21).

| FR ID       | Category               | Requirement                                                                                                                                                                                                                                                                                                                                                              | Source                                     |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **FR-CN1**  | Visual Identity        | Complete Celestial Night theme: deep navy gradients, frosted glass panels, gold accents, serif typography across all 29 pages                                                                                                                                                                                                                                            | UX Spec §1-3                               |
| **FR-CN2**  | Design System          | 12 core game components as real TypeScript files in `components/ui/game/`: FrostedPanel, GameDialog, GoldTabs, GameBadge, GlassInput, GlassTextarea, StatBar, GameCheckbox, GameLabel, GameTooltip, GameScrollArea, GameCollapsible — covering 90% of surfaces. No shadcn visual styling. 12 corresponding shadcn files stripped to naked Radix accessibility skeletons. | UX Spec §11.3                              |
| **FR-CN3**  | Font System            | Cinzel Decorative (display), Cinzel (headings), Inter (body) replacing current fonts; preloaded, swap, Latin subset                                                                                                                                                                                                                                                      | UX Spec §1, Tech Spec                      |
| **FR-CN4**  | Feature Toggle         | `.celestial` CSS class scoping for progressive migration; `?theme=celestial` QA toggle                                                                                                                                                                                                                                                                                   | Tech Spec ADR                              |
| **FR-CN5**  | Hub Dashboard          | Hub-and-spoke constellation layout with NextActionsBar, NarrativeChips, stable card grid, aside/bottom sheet                                                                                                                                                                                                                                                             | UX Spec §5-6, Wireframe 1                  |
| **FR-CN6**  | WhileYouWereGone       | Return overlay after 4+ hours absence; priority-sorted items (max 8); competition results highest priority                                                                                                                                                                                                                                                               | UX Spec §6, Tech Spec ADR-1                |
| **FR-CN7**  | Next Actions           | Server-seeded action priority list with client narrative formatting; guides daily gameplay loop                                                                                                                                                                                                                                                                          | UX Spec §5, Tech Spec ADR-2                |
| **FR-CN8**  | Competition Model      | Player/club-created shows with 7-day entry windows; overnight execution; browse-and-enter UX                                                                                                                                                                                                                                                                             | UX Spec §10.4, Tech Spec BA-1 through BA-5 |
| **FR-CN9**  | Foal Development       | 0-2 year lifecycle with age-evolving groom activities; milestone tracking; graduation at age 3                                                                                                                                                                                                                                                                           | UX Spec §10.6, Tech Spec BB-1 through BB-4 |
| **FR-CN10** | Cinematic Moments      | Lifetime-first achievements only (first win, first breed, first trait, first legendary, first max level, first graduation); repeat events use toast                                                                                                                                                                                                                      | UX Spec §12, Tech Spec ADR-4               |
| **FR-CN11** | Onboarding Rebuild     | BreedSelector with grid/list toggle, breed previews with stat tendencies, gender selection, name input with preview                                                                                                                                                                                                                                                      | UX Spec §10.1, Wireframe 3                 |
| **FR-CN12** | Training Flow          | DisciplineSelector with top-5 server-ranked recommendations; CooldownTimer real-time countdown; stat impact preview                                                                                                                                                                                                                                                      | UX Spec §10.3, Wireframe 4                 |
| **FR-CN13** | Competition Flow       | CompetitionFieldPreview (scouting), 7-day entry window UX, ScoreBreakdownRadar, results via WYAG                                                                                                                                                                                                                                                                         | UX Spec §10.4, Wireframe 5                 |
| **FR-CN14** | Breeding Flow          | CompatibilityPreview (4-tab: stats/traits/inbreeding/pedigree), bidirectional entry, cost breakdown                                                                                                                                                                                                                                                                      | UX Spec §10.5, Wireframe 6                 |
| **FR-CN15** | Horse Detail           | 10 stat bars with numeric overlays, trait badges, CareStatusStrip, tabbed sections, action bar                                                                                                                                                                                                                                                                           | UX Spec §10.7, Wireframe 7                 |
| **FR-CN16** | Navigation             | Sidebar (desktop), hamburger + bottom nav (mobile), breadcrumbs, StarfieldBackground integration                                                                                                                                                                                                                                                                         | UX Spec §10.8, Wireframe 9                 |
| **FR-CN17** | Accessibility          | WCAG 2.1 AA throughout: 4.5:1 text contrast, 44px touch targets, keyboard navigation, `prefers-reduced-motion`, screen reader support                                                                                                                                                                                                                                    | UX Spec §7                                 |
| **FR-CN18** | Performance            | Initial bundle < 400KB; fonts load with `font-display: swap`; LCP < 2.5s on 4G; lazy loading for Phase 2/3 components                                                                                                                                                                                                                                                    | Tech Spec §Performance                     |
| **FR-CN19** | Game Component Library | `button.tsx` restyled with `.celestial` scope; 12 shadcn files stripped to naked Radix accessibility skeletons; 12 game components built in `components/ui/game/` (FrostedPanel, GameDialog, GoldTabs, GameBadge, GlassInput, GlassTextarea, StatBar, GameCheckbox, GameLabel, GameTooltip, GameScrollArea, GameCollapsible)                                             | Tech Spec §game-components                 |
| **FR-CN20** | Milestones System      | `User.settings.milestones` JSONB tracking lifetime-first achievements; server-set, exposed in profile and competition responses                                                                                                                                                                                                                                          | Tech Spec ADR-4                            |

### Inherited PRD FRs (Already Implemented — Referenced for Coverage)

| PRD Section                  | Status      | Stories That Touch These                                  |
| ---------------------------- | ----------- | --------------------------------------------------------- |
| PRD-02 §1.1 Authentication   | ✅ Complete | Epic 22 restyles auth pages                               |
| PRD-02 §1.2 User Progression | ✅ Complete | Epic 23 adds NarrativeChips on XP                         |
| PRD-02 §2.1 Horse CRUD       | ✅ Complete | Epic 22 restyles horse cards; Epic 29 expands foal detail |
| PRD-03 §1 Training System    | ✅ Complete | Epic 26 redesigns training flow UX                        |
| PRD-03 §2 Competition System | ✅ Backend  | Epic BACKEND-A rewrites model; Epic 27 redesigns flow     |
| PRD-03 §3 Groom System       | ✅ Complete | Epic 29 integrates grooms with foal development           |
| PRD-03 §4 Breeding System    | ✅ Complete | Epic 28 redesigns breeding flow UX                        |
| PRD-04 §1-7 Trait Systems    | ✅ Complete | Epic 29 adds trait discovery CinematicMoment              |

---

## Epic Structure Plan

### Dependency Graph

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

### Epic Summary Table

| Epic          | Title                            | User Value Statement                                                                                                                                                                                                                 | FRs Covered                             | Dependencies                  |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------- |
| **22**        | Celestial Night Foundation       | Players see a transformed game world the moment they open Equoria — deep navy skies, gold accents, serif typography, animated starfield. The game stops looking like a dashboard and starts feeling like a fantasy world.            | FR-CN1, FR-CN2, FR-CN3, FR-CN4, FR-CN19 | None (entry point)            |
| **23**        | Hub & Daily Loop                 | Players land on an intelligent hub that answers "What should I do next?" — no more wandering between pages guessing. The NextActionsBar guides them through training, competing, and breeding with contextual suggestions.           | FR-CN5, FR-CN7                          | Epic 22                       |
| **24**        | WhileYouWereGone                 | Returning players see what happened while they were away — competition results, foal milestones, messages — in one prioritized overlay. No more manually checking 6 different pages after being offline.                             | FR-CN6                                  | Epic 23                       |
| **BACKEND-A** | Competition Model Rewrite        | Players can create their own shows, browse open competitions with 7-day entry windows, scout the field before entering, and receive results after overnight execution. Competitions become strategic decisions, not instant buttons. | FR-CN8, FR-CN20                         | None (parallel with Hub)      |
| **25**        | Onboarding Rebuild               | New players choose their first horse from a beautiful breed selector with stat previews and lore — not a dropdown. The first 5 minutes set the fantasy tone.                                                                         | FR-CN11                                 | Epic 22                       |
| **26**        | Training Flow Redesign           | Players see intelligent discipline recommendations ranked by their horse's aptitude, with real-time cooldown timers and stat impact previews. Training becomes informed strategy, not guesswork.                                     | FR-CN12                                 | Epic 22                       |
| **27**        | Competition Flow Redesign        | Players browse live competitions with entry windows, scout the field to evaluate competition strength, and receive beautifully presented results with score breakdowns. Competition entry feels like a strategic commitment.         | FR-CN13, FR-CN10                        | Epic BACKEND-A                |
| **BACKEND-B** | Foal Development Model Expansion | Foal development expands from 6 days to a realistic 0-2 year lifecycle with age-appropriate activities, milestone tracking, and graduation at age 3. Raising foals becomes a meaningful long-term journey.                           | FR-CN9                                  | None (parallel with Training) |
| **28**        | Breeding Flow Redesign           | Players see comprehensive compatibility previews (stat ranges, trait inheritance, inbreeding risk, pedigree overlap) before committing to a breeding. First foal birth triggers a cinematic celebration.                             | FR-CN14, FR-CN10                        | Epic 22                       |
| **29**        | Foal Development Overhaul        | Players follow their foals through a 0-2 year timeline with age-evolving activities, milestone celebrations, and trait discovery moments. Foal care becomes the emotional heart of the game.                                         | FR-CN9, FR-CN10, FR-CN15                | Epic BACKEND-B                |
| **30**        | Polish & Consistency             | Every surface in the game meets the same quality bar — decorative gold frames, atmospheric empty states, meaningful-only reward toasts, and verified WCAG 2.1 AA accessibility. No page feels like it belongs to a different app.    | FR-CN17, FR-CN18, FR-CN2                | All previous epics            |

### Technical Context per Epic

| Epic   | Architecture Sections Referenced                                                                                                                                    | UX Sections Referenced                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **22** | tokens.css (380+ lines), tailwind.config.ts, index.css, App.tsx, components/ui/game/ (12 new), button.tsx (restyled), 12 shadcn files (stripped to Radix skeletons) | UX §1 (Design Tokens), §3 (Typography), §11.3 (Components) |
| **23** | `backend/modules/` (auth, horses, training, competition for next-actions data), api-client.ts                                                                       | UX §5 (Hub), §6 (NextActions), Wireframe 1                 |
| **24** | New WYAG endpoint (aggregation across 6 modules), localStorage for lastVisit                                                                                        | UX §6 (WYAG), Tech Spec ADR-1                              |
| **BA** | `backend/modules/competition/`, Prisma schema (Show model), cron/scheduler                                                                                          | Tech Spec ADR-3, ADR-4; PRD-03 §2                          |
| **25** | `backend/modules/horses/` (breeds endpoint), OnboardingPage.tsx, BreedSelector                                                                                      | UX §10.1, Wireframe 3                                      |
| **26** | `backend/modules/training/` (eligibility, cooldowns), DisciplineSelector, CooldownTimer                                                                             | UX §10.3, Wireframe 4                                      |
| **27** | New show endpoints (browse, enter, results), CompetitionFieldPreview, ScoreBreakdownRadar                                                                           | UX §10.4, Wireframe 5                                      |
| **BB** | `backend/modules/breeding/` (foal controller), Prisma schema (FoalDevelopment), milestones                                                                          | Tech Spec ADR-5; PRD-03 §4                                 |
| **28** | `backend/modules/breeding/` (compatibility endpoint), CompatibilityPreview, CinematicMoment                                                                         | UX §10.5, Wireframe 6                                      |
| **29** | Expanded foal development endpoint, DevelopmentTracker, age-stage activities                                                                                        | UX §10.6, Wireframe 8                                      |
| **30** | All modules (visual audit), GoldBorderFrame, RewardToast, Lighthouse CI                                                                                             | UX §7 (Accessibility), §13 (Empty States)                  |

---

## Epic 22: Celestial Night Foundation

**Goal:** Transform Equoria's visual identity from generic developer UI to an immersive Celestial Night fantasy world. Every page should feel like a game the moment this epic ships — deep navy skies, gold accents, serif typography, animated starfield. This is the foundation that every subsequent epic builds upon.

**User Value:** Players open Equoria and immediately feel they've entered a fantasy world — not a dashboard. The atmosphere is established before any UX flow changes.

**FRs Covered:** FR-CN1, FR-CN2, FR-CN3, FR-CN4, FR-CN19

**Dependencies:** None (entry point)

### Story 22.1: Font Migration

As a player,
I want all text in Equoria to render in fantasy-appropriate fonts (Cinzel for headings, Inter for body),
So that the typography signals "game world" instead of "web app."

**Acceptance Criteria:**

**Given** the `.celestial` class is active on `<body>`
**When** any page loads
**Then** all `h1`-`h6` elements render in Cinzel font
**And** all body text, form labels, and data values render in Inter font
**And** hero text (horse names on detail pages, page titles) renders in Cinzel Decorative
**And** fonts load with `font-display: swap` (no Flash of Invisible Text)
**And** font files are preloaded via `<link rel="preconnect">` to Google Fonts
**And** total font payload transferred from Google Fonts CDN is ≤ 60KB (WOFF2, Latin subset, measured in DevTools Network tab)
**And** `prefers-reduced-motion` has no impact (fonts are static)
**And** fallback system fonts (Georgia, system-ui) are specified in font stack
**And** the existing Yeseva One and Cormorant Garamond `<link>` elements are removed from `frontend/index.html` (no orphaned CDN requests)
**And** the file has zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Technical Notes:**

- Update `frontend/src/styles/tokens.css`: `--font-display` → `'Cinzel Decorative'`, `--font-heading` → `'Cinzel'`, `--font-body` → `'Inter'` (currently Jost)
- Update `frontend/tailwind.config.ts`: `fontFamily` section with Cinzel/Inter
- Add Google Fonts `<link>` to `frontend/index.html` with `preconnect` + `font-display=swap`
- Verify all 29 pages render correctly with new fonts (no layout shifts from different metrics)

**Prerequisites:** None

---

### Story 22.2: CelestialThemeProvider

As a developer,
I want a zero-JS CSS class toggle (`<body class="celestial">`) with a QA URL param,
So that Celestial Night styles can be progressively applied and instantly reverted.

**Acceptance Criteria:**

**Given** the app loads
**When** `localStorage.getItem('equoria-theme')` returns `'celestial'` OR no theme is stored (default)
**Then** `<body>` has `class="celestial"` applied
**And** all `.celestial`-scoped CSS rules activate

**Given** a QA tester visits `?theme=celestial`
**When** the page loads
**Then** the celestial class is applied and persisted to localStorage
**And** subsequent visits (without the param) retain the celestial theme

**Given** a QA tester visits `?theme=default`
**When** the page loads
**Then** the celestial class is removed and `localStorage.setItem('equoria-theme', 'default')` is called
**And** the original unstyled Tailwind layout is visible

**And** NO React Context is created (pure CSS class, zero state management)
**And** the implementation uses `document.body.classList.add/remove` — either directly in `App.tsx` or in a dedicated `CelestialThemeProvider.tsx` rendered inside the `<Router>` boundary (required because `useSearchParams` needs Router context)
**And** removing the class reverts ALL Celestial Night styles (kill switch)
**And** existing users with no `equoria-theme` key in localStorage (pre-Epic-22 players) receive celestial on first load — an in-app toast displays once: "Equoria has a new look! Use ?theme=default in the URL to revert."
**And** the file has zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Technical Notes:**

- `CelestialThemeProvider.tsx` must be rendered inside `<BrowserRouter>` in `App.tsx` because it uses `useSearchParams` (React Router hook). This is acceptable — it is a CSS-class manager, not a React Context provider.
- localStorage key: `'equoria-theme'`, values: `'celestial'` (theme on) | `'default'` (theme off)
- FR-CN2 custom game components (`FrostedPanel`, `GlassInput`, `GoldTabs`, etc.) are implemented as **real component files** in `frontend/src/components/ui/game/` — see Story 22.6 for full specification. They are not CSS class names.
- Add `.celestial` scope prefix to `frontend/src/index.css` for new style blocks
- Test: render with/without `.celestial` class, verify visual difference

**Prerequisites:** None

---

### Story 22.3: Painted Background System

As a player,
I want each area of the game to display a hand-painted background scene behind the content,
So that every page feels visually distinct and immersive — not a uniform repeating texture.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** any page loads
**Then** a full-viewport background image renders behind all content at `z-[var(--z-below)]`
**And** the image is the hand-painted scene for that page context (see scene map below)
**And** the image uses `object-fit: cover` to fill all viewport sizes without distortion
**And** a deep navy gradient fallback (`#0a0e1a → #111827`) displays while the image loads
**And** content readability is preserved — a semi-transparent overlay (`rgba(5,10,20,0.45)`) sits between the background and content
**And** `prefers-reduced-motion` has no impact (images are static)
**And** background images are lazy-loaded on non-critical pages (hub and auth pages are preloaded; all others use `loading="lazy"`)
**And** background images are served in WebP format with a JPEG fallback via `<picture>`

**Scene Map (asset paths):**

| Scene key      | Pages using it                         | Asset path                              |
| -------------- | -------------------------------------- | --------------------------------------- |
| `auth`         | Login, Register, Forgot Password       | `/assets/backgrounds/auth.webp`         |
| `hub`          | Dashboard (`/`)                        | `/assets/backgrounds/hub.webp`          |
| `stable`       | My Stable, Horse List                  | `/assets/backgrounds/stable.webp`       |
| `horse-detail` | Horse Detail page                      | `/assets/backgrounds/horse-detail.webp` |
| `training`     | Training pages                         | `/assets/backgrounds/training.webp`     |
| `competition`  | Competition browser, results           | `/assets/backgrounds/competition.webp`  |
| `breeding`     | Breeding pages, Foal Development       | `/assets/backgrounds/breeding.webp`     |
| `world`        | World Hub, Community, Clubs            | `/assets/backgrounds/world.webp`        |
| `default`      | All other pages (settings, bank, etc.) | `/assets/backgrounds/default.webp`      |

**Technical Notes:**

- `useResponsiveBackground` hook **already exists** at `frontend/src/hooks/useResponsiveBackground.ts` — selects the closest-ratio webp from 6 aspect variants (21:9, 16:9, 3:2, 4:3, 1:1, 9:16), re-evaluates on resize. **Do not recreate this logic.**
- Extend the hook to accept an optional `scene?: SceneKey` parameter. When provided, resolve paths as `/images/backgrounds/{scene}/bg-{ratio}.webp`. When absent, fall back to the current generic `/images/bg-{ratio}.webp` paths — backward-compatible.
- Replace `components/layout/StarField.tsx` and `components/layout/StarfieldBackground.tsx` with a single `components/layout/PageBackground.tsx`
- Props: `{ scene?: SceneKey }` — when omitted, the generic aspect-ratio backgrounds are used
- Mount in the root layout; pass `scene` based on current route (see scene map above)
- `PageBackground` renders as a fixed-position `<div>` at `z-[var(--z-below)]` (-1) with `backgroundImage: url(bgPath)`, `backgroundSize: cover`, `backgroundPosition: center`
- Readability veil: an `::after` pseudo-element covering the full layer with `rgba(5,10,20,0.45)`
- Fallback: `backgroundColor: var(--bg-deep-space)` (`#0a0e1a`) when asset doesn't yet exist
- Existing assets already in place: generic ratio set at `/images/bg-*.webp`; `/images/bg-horse-detail.webp` and `/images/bg-stable.webp` map to `horse-detail` and `stable` scenes. `equorialogin.png` is the current login background — use it for `auth` scene until a WebP export is ready.
- As new Photoshop scenes are painted, export as WebP and commit to `/images/backgrounds/{scene}/bg-{ratio}.webp`
- Remove all `.starfield-*` CSS classes and `starfield-drift-*` keyframes from `index.css` once `PageBackground` is live

**Prerequisites:** Story 22.2 (CelestialThemeProvider)

---

### Story 22.4: Glass Panel & Surface Updates

As a player,
I want all content containers to have a frosted glass appearance with subtle borders,
So that the UI feels like looking through celestial ice — not flat white cards.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** any `.glass-panel` element renders
**Then** it has `backdrop-filter: blur(12px)` with `rgba(15, 23, 42, 0.6)` background
**And** a subtle border (`rgba(148, 163, 184, 0.2)`) with `border-radius: 12px`
**And** hover state brightens the border to `rgba(148, 163, 184, 0.3)`

**And** a `.glass-panel-heavy` variant exists for modals (higher opacity, stronger blur)
**And** a `.glass-panel-subtle` variant exists for nested/secondary surfaces — uses solid `rgba` bg with NO `backdrop-filter`, gold border at 0.1 opacity. This is the approved third visual level that does not add a blur layer.
**And** only ONE `backdrop-filter: blur()` is active per viewport stack (single-blur-layer rule)
**And** nested glass panels use solid semi-transparent bg (no stacked blurs)
**And** the single-blur-layer rule is documented in a CSS comment
**And** a visual regression screenshot test exists covering a page where `.glass-panel`, `.glass-panel-heavy`, and `.glass-panel-subtle` all appear simultaneously, verifying no blur stacking occurs
**And** the file has zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Technical Notes:**

- Update `.glass-panel` in `frontend/src/index.css` under `.celestial` scope
- Add `.glass-panel-heavy` variant for Dialog/Modal content
- Add `.glass-panel-subtle` variant: solid `rgba(15, 23, 42, 0.4)` bg, `border: 1px solid rgba(200, 168, 78, 0.1)`, NO `backdrop-filter` — for use inside FrostedPanel or other blurred containers
- Refine `--glass-surface-bg` opacity values in `tokens.css`
- Audit existing components for nested blur violations

**Prerequisites:** Story 22.2

---

### Story 22.5: Button Hierarchy

As a player,
I want buttons to have distinct visual hierarchy — gold for primary actions, frosted for secondary, text for tertiary,
So that I always know which button is the most important action on any screen.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** a Primary button renders (default variant)
**Then** it has a gold gradient background with horseshoe arc decorations (existing `::before/::after`)
**And** gold text, rounded corners, subtle glow on hover

**When** a Secondary button renders (variant="secondary")
**Then** it has a frosted glass background, navy border, cream text
**And** border brightens on hover

**When** a Tertiary/Ghost button renders (variant="ghost")
**Then** it has no background, `--gold-light` colored text (contrast ratio ≥ 7.1:1 on `--bg-deep-space`), underline on hover
**Note:** `--gold-primary` (4.2:1) is reserved for large text (≥ 18px) and decorative elements only; it MUST NOT be used for body-size or small link text.

**When** a Destructive button renders (variant="destructive")
**Then** it has a dark red background, lighter red text, no gold accents

**And** the `default` size variant has minimum height `h-11` (44px) — never `h-10` (40px)
**And** the `sm` size variant uses `h-9` (36px) but is accompanied by an invisible touch-target padding expanding the interactive zone to 44px
**And** all buttons have minimum 44×44px touch targets at runtime
**And** two additional variants are defined: `outline` (navy border, cream text, gold border on hover — for tertiary back/dismiss actions) and `glass` (glass panel surface, cream text, gold border hover — for nav items and contextual overlay actions)
**And** focus indicators use gold `box-shadow` ring (not browser default)
**And** disabled state uses `--text-muted` color with reduced opacity
**And** contrast ratio of ghost/link variant text (`--gold-light` on `--bg-deep-space`) is ≥ 4.5:1
**And** the file has zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Technical Notes:**

- Restyle `frontend/src/components/ui/button.tsx` variants under `.celestial` scope
- Horseshoe arcs already exist in `index.css` (`.btn-cobalt::before/::after` from Epic 18-5)
- cva variants: `default`→gold gradient (min `h-11`), `secondary`→frosted glass, `ghost`→transparent + `--gold-light` text, `outline`→navy border + cream text, `glass`→glass surface + cream text, `destructive`→red-tinted glass
- Size table: `default` = `h-11 px-4 py-2`, `sm` = `h-9 px-3`, `lg` = `h-12 px-8`, `icon` = `h-11 w-11`
- `--gold-light` (7.1:1 contrast) for ghost/link text; `--gold-primary` (4.2:1) for large display text ≥ 18px only

**Prerequisites:** Story 22.2

---

### Story 22.6: Custom Game Component Library

As a player,
I want every UI element (panels, dialogs, tabs, badges, inputs, tooltips) to have purposefully crafted game aesthetics — not restyled corporate components,
So that the interface feels native to Equoria's world with no residual dashboard DNA.

**Context:** This is Equoria — a fantasy horse breeding game, not a SaaS dashboard. All game-native visual components are built from scratch in `frontend/src/components/ui/game/`. The existing shadcn files in `frontend/src/components/ui/` are retained as Radix accessibility skeletons only — stripped of all visual styling. Game components provide the visuals by composing over the naked Radix primitives.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** any of the following 12 game components render:

| Game Component      | File                       | Replaces (Radix skeleton) | Visual Description                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FrostedPanel**    | `game/FrostedPanel.tsx`    | `card.tsx`                | Glass surface container — not a "card". `backdrop-filter: blur(12px)`, `rgba(15,23,42,0.6)` bg, gold border on hover, `border-radius: 12px`.                                                                                                                                                                                                                                                            |
| **GameDialog**      | `game/GameDialog.tsx`      | `dialog.tsx`              | Cinematic overlay. Dark velvet backdrop (`rgba(0,0,0,0.85)`), `.glass-panel-heavy` content area, Cinzel title in `--text-gold`, animated entrance (scale + fade).                                                                                                                                                                                                                                       |
| **GoldTabs**        | `game/GoldTabs.tsx`        | `tabs.tsx`                | Transparent bg tab list. Active tab: `--text-gold` + animated 2px gold underline (200ms ease). Inactive: `--text-secondary`. Font: Cinzel. No background-fill on active.                                                                                                                                                                                                                                |
| **GameBadge**       | `game/GameBadge.tsx`       | `badge.tsx`               | Rarity-aware. `common`: `--bg-twilight` bg. `rare`: purple-tinted glass + `--status-rare` text. `legendary`: gold-tinted glass + `--status-legendary` text. `rounded-full` pill.                                                                                                                                                                                                                        |
| **GlassInput**      | `game/GlassInput.tsx`      | `input.tsx`               | `--glass-bg` background, `--glass-border` border. Focus: gold ring. Placeholder: `--text-muted`.                                                                                                                                                                                                                                                                                                        |
| **GlassTextarea**   | `game/GlassTextarea.tsx`   | `textarea.tsx`            | Matches GlassInput styling exactly. Resizable vertically only.                                                                                                                                                                                                                                                                                                                                          |
| **StatBar**         | `game/StatBar.tsx`         | `progress.tsx`            | Audit existing component against these three criteria: (1) fill uses a gold gradient (`from-[var(--gold-primary)] to-[var(--gold-light)]`), not a flat color; (2) track uses `var(--bg-midnight)` or `var(--celestial-navy-900)`; (3) a glow (`box-shadow`) activates when value ≥ 100. If all three pass, no change needed — document the audit result in a code comment. If any fail, patch to match. |
| **GameCheckbox**    | `game/GameCheckbox.tsx`    | `checkbox.tsx`            | Gold checkmark SVG on check. Navy bg, `--electric-blue` focus ring. Radix skeleton underneath.                                                                                                                                                                                                                                                                                                          |
| **GameLabel**       | `game/GameLabel.tsx`       | `label.tsx`               | Inter font, `--text-secondary` color, optional `smallCaps` prop adds `font-variant: small-caps`.                                                                                                                                                                                                                                                                                                        |
| **GameTooltip**     | `game/GameTooltip.tsx`     | `tooltip.tsx`             | Glass panel: `--bg-midnight` bg, `--gold-dim` border, `--text-primary` text. No `backdrop-filter` (single-blur rule).                                                                                                                                                                                                                                                                                   |
| **GameScrollArea**  | `game/GameScrollArea.tsx`  | `scroll-area.tsx`         | Gold scrollbar thumb (`--gold-dim`, hover → `--gold-primary`), transparent track.                                                                                                                                                                                                                                                                                                                       |
| **GameCollapsible** | `game/GameCollapsible.tsx` | `collapsible.tsx`         | Chevron icon rotates 180° on open (CSS 200ms). Content area is `.glass-panel-subtle`.                                                                                                                                                                                                                                                                                                                   |

**Then** each game component visually matches the Celestial Night design tokens
**And** all game components compose over their corresponding Radix primitive for accessibility attributes (aria-\*, data-state, keyboard handling)
**And** the 12 shadcn source files (`card.tsx`, `dialog.tsx`, `tabs.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `progress.tsx`, `checkbox.tsx`, `label.tsx`, `tooltip.tsx`, `scroll-area.tsx`, `collapsible.tsx`) are stripped of all visual `className` defaults — they become naked Radix wrappers only
**And** WCAG 2.1 AA is maintained: ≥ 4.5:1 for text, ≥ 3:1 for UI component boundaries
**And** all interactive game components are keyboard-accessible (Tab/Enter/Space/Escape) via the Radix skeleton
**And** each game component has a Vitest/RTL test file covering: (a) renders with correct token-based class names, (b) keyboard interaction (Tab/Enter/Space/Escape) reaches the expected state, (c) `data-state` attribute reflects open/closed/checked correctly
**And** no raw hex or rgba literals appear in any game component file (`grep -r "rgba\|#[0-9a-f]" frontend/src/components/ui/game/` returns zero matches)
**And** the files have zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Technical Notes:**

- All 12 game components live in `frontend/src/components/ui/game/` (new folder)
- Export a barrel file: `frontend/src/components/ui/game/index.ts`
- Shadcn files in `frontend/src/components/ui/` become pure Radix forwarders — remove all `cn(...)` visual class strings. Keep: ref forwarding, `displayName`, Radix import, `data-slot` attributes
- **Sub-PR order (respects inter-component dependencies):** (1) GameLabel, FrostedPanel, GoldTabs, GameBadge — GameLabel must precede GameDialog since dialogs contain labels; GoldTabs depends on Story 22.1 font tokens being confirmed — (2) GlassInput, GlassTextarea, GameCheckbox, GameDialog — GameDialog uses `.glass-panel-heavy` (Story 22.4) and GameLabel (sub-PR 1) — (3) StatBar (audit), GameTooltip, GameScrollArea, GameCollapsible
- Use only CSS custom properties from `tokens.css` — no raw hex or rgba literals in component files
- Keep Radix `data-state` attribute selectors for state-driven CSS (open/closed, checked/unchecked)
- **14th shadcn component:** The current stack has 14 shadcn components (`select.tsx` is the 14th beyond the 13 explicitly handled). `select.tsx` is NOT stripped to skeleton — it retains its existing Radix styling as a functional fallback used in admin/settings forms. Add a code comment to `select.tsx`: "Not part of the game component library — retained as-is for admin/settings use."
- **Google Fonts / privacy decision (ADR-6):** Fonts are self-hosted to avoid transmitting user IPs to Google servers on every page load (GDPR risk for EU/UK users). Export Cinzel, Cinzel Decorative, and Inter as WOFF2 files from Google Fonts, commit to `frontend/public/fonts/`, update `index.html` to use `<link rel="preload">` from `/fonts/`. Remove Google Fonts CDN links entirely.

**Prerequisites:** Stories 22.1, 22.2, 22.4, 22.5

---

### Story 22.7: Body & Page Chrome

As a player,
I want the entire page background, navigation, and authentication pages to feel celestial,
So that the atmosphere is consistent from login through gameplay.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** any page loads
**Then** the body background is a deep navy gradient (`#0a0e1a` → `#111827`) with subtle gold/blue radial accents
**And** the `MainNavigation` component uses Celestial Night colors (navy bg, gold icons, Cinzel font for logo)
**And** the active nav item has a gold border indicator (bottom on mobile, left on desktop)
**And** auth pages (login/register) display the StarfieldBackground with a centered glass panel
**And** the page feels immersive at all breakpoints (375px mobile through 1440px desktop)

**Technical Notes:**

- Update body gradient in `frontend/src/index.css` under `.celestial` scope
- Update `MainNavigation.tsx` colors (currently uses `--celestial-navy-*` tokens — verify)
- Update `frontend/src/components/layout/AuthLayout.tsx` for login/register pages
- Verify DashboardLayout wrapper (if used) integrates with `.celestial` scope

**And** Playwright E2E screenshot test covers the login page at 375px and 1440px breakpoints, confirming StarfieldBackground visible and glass panel centered
**And** the file has zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Prerequisites:** Stories 22.1, 22.2, 22.3, 22.4, 22.5

---

### Story 22.8: Navigation Structure (Sidebar / Hamburger / Bottom Nav)

As a player,
I want the navigation to feel native to the game with a sidebar on desktop and a hamburger + bottom nav on mobile,
So that the layout chrome matches the fantasy world at every viewport.

**Acceptance Criteria:**

**Given** the `.celestial` class is active on a desktop viewport (≥ 1024px)
**When** any page loads
**Then** a collapsible left sidebar renders with Celestial Night styling (navy bg, gold icon accents, Cinzel font for nav labels)
**And** the active route item has a 2px gold left-border indicator
**And** the sidebar can collapse to an icon-only rail (64px wide) via a toggle button
**And** the sidebar toggle state persists to localStorage (`equoria-sidebar-collapsed`)

**Given** the `.celestial` class is active on a mobile viewport (< 768px)
**When** any page loads
**Then** a hamburger menu icon renders in the top header bar
**And** tapping the hamburger opens a full-height slide-in nav panel (300ms ease, from left)
**And** a bottom navigation bar renders with 5 icon items: Home, Horses, Compete, Breed, More
**And** the active tab has a gold dot indicator below the icon
**And** tapping an item closes the hamburger panel if open

**And** breadcrumbs render on all pages (except the hub root `/`) showing the current path with Celestial Night styling (`--text-muted` / `--text-gold` for the active crumb)
**And** keyboard navigation: sidebar/hamburger toggle reachable via Tab; Escape closes the open hamburger panel
**And** PageBackground (`scene` prop) is passed based on the current route in the root layout
**And** Playwright E2E test covers: sidebar toggle on desktop, hamburger open/close on mobile (375px viewport), bottom nav active state
**And** the file has zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

**Technical Notes:**

- Refactor `MainNavigation.tsx` into two layouts: `SidebarNav.tsx` (desktop) and `MobileNav.tsx` (hamburger + bottom bar)
- Root layout component (create `DashboardLayout.tsx` if it doesn't exist) renders the correct nav based on a `useMediaQuery('(min-width: 1024px)')` hook
- Sidebar collapse: toggle button uses `ChevronLeft` / `ChevronRight` from Lucide; icon-only state hides label text with `opacity-0 w-0 overflow-hidden` transition
- Bottom nav items: Home (`/`), Horses (`/horses`), Compete (`/competition`), Breed (`/breeding`), More (opens slide-up drawer with remaining nav links)
- Breadcrumbs: `components/layout/Breadcrumbs.tsx` — reads from `react-router-dom` `useMatches()` hook; renders as `<nav aria-label="breadcrumb">`
- `PageBackground` scene routing: add a `routeSceneMap` in `DashboardLayout.tsx` mapping path prefixes to `SceneKey` values

**Prerequisites:** Stories 22.1, 22.2, 22.3, 22.4, 22.5

---

**Epic 22 Complete: Celestial Night Foundation**

Stories Created: 8
FR Coverage: FR-CN1, FR-CN2, FR-CN3, FR-CN4, FR-CN16, FR-CN19
Technical Context: tokens.css, tailwind.config.ts, index.css, App.tsx, frontend/src/components/ui/game/ (12 new files), PageBackground.tsx, SidebarNav.tsx, MobileNav.tsx, Breadcrumbs.tsx, button.tsx (existing — gold standard confirmed), fonts self-hosted in `public/fonts/`
UX Patterns: UX §1 (Design Tokens), §3 (Typography), §10.8 (Navigation), §11.3 (Core Components)
No shadcn visual styling — Radix primitives used as accessibility skeletons only. All game visuals in components/ui/game/.
Background: Hand-painted scenes replace CSS starfield — assets owner-provided as WebP/JPEG pairs in `public/assets/backgrounds/`.
Buttons: Gold gradient + horseshoe arc pattern already live on login page — Story 22.5 extends this consistently to all surfaces.

---

## Epic 23: Hub & Daily Loop

**Goal:** Replace the generic dashboard with an intelligent hub that answers "What should I do next?" through server-seeded action suggestions and contextual horse status chips. The hub becomes the gravitational center of the daily gameplay loop.

**User Value:** Players never wonder what to do — the NextActionsBar guides them through training, competing, breeding, and caring for foals with personalized, priority-ordered suggestions.

**FRs Covered:** FR-CN5, FR-CN7

**Dependencies:** Epic 22 (Foundation)

### Story 23.1: NextActionsBar Component

As a player,
I want to see a priority-ordered bar of suggested actions when I land on the hub,
So that I immediately know which horse needs training, which competition is closing soon, or which foal needs attention.

**Acceptance Criteria:**

**Given** I am logged in and on the hub dashboard
**When** the page loads
**Then** a NextActionsBar renders at the top of the page
**And** it shows up to 5 suggested actions, priority-ordered (highest priority = gold accent)
**And** each action shows: icon, horse name (if applicable), narrative text ("Luna is ready to train!"), and a CTA button
**And** clicking a CTA navigates to the relevant page (training, competition, breeding, foal care)
**And** on mobile (< 768px), actions display as horizontal scroll cards
**And** on desktop (≥ 1024px), actions display as a grid row
**And** if no actions are available, the bar shows "Your stable is resting — check back soon"
**And** data refreshes every 60 seconds via React Query `refetchInterval`

**Technical Notes:**

- Create `frontend/src/components/hub/NextActionsBar.tsx`
- Create `frontend/src/hooks/api/useNextActions.ts` with `queryKey: ['next-actions']`
- Server provides `NextAction[]` (type, priority, horseId, horseName, metadata); client formats narrative text
- Action types: train, compete, breed, groom-foal, claim-prize, check-results, visit-vet

**Prerequisites:** Epic 22 complete

---

### Story 23.2: NarrativeChip Component

As a player,
I want small contextual chips on my horse cards ("Ready to compete!", "Foal developing well", "Cooldown: 3d 4h"),
So that I can quickly scan my stable and see each horse's status at a glance.

**Acceptance Criteria:**

**Given** a HorseCard renders on the hub dashboard
**When** the horse has a notable status
**Then** a NarrativeChip appears below the horse name
**And** chip text is data-driven from horse state:

- Training cooldown active → "Cooldown: Xd Xh" (amber)
- Ready to train → "Ready to train!" (green)
- In competition → "Entered: [show name]" (blue)
- Foal (age < 3) → "Age: X months — [stage]" (purple)
- Injured → "Recovering" (red)
  **And** chip color matches the status severity (tokens from `tokens.css`)
  **And** chip is a `<span>` with `role="status"` for screen readers

**Technical Notes:**

- Create `frontend/src/components/hub/NarrativeChip.tsx`
- Props: `{ status: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral' }`
- Integrate into existing `HorseCard` component as optional `narrativeChip` prop or child slot

**Prerequisites:** Epic 22 complete

---

### Story 23.3: Hub Dashboard Rebuild

As a player,
I want the main dashboard to be a hub-and-spoke constellation layout with my stable, actions, and quick details,
So that everything I need is one click away from home base.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the home page (`/`)
**Then** the hub renders with:

1. **NextActionsBar** at the top (from Story 23.1)
2. **Stable card grid** in the center — all my horses with NarrativeChips (from Story 23.2)
3. **Aside panel** (desktop 1024px+) showing quick details for the selected horse (stats summary, next action, CareStatusStrip)
4. **Bottom sheet** (mobile < 768px) replacing aside panel — swipe up to see horse details

**And** new users (completedOnboarding recently) see a "Getting Started" variant with guided actions
**And** horses are sorted: actionable first (ready to train/compete), then by name
**And** the grid is responsive: 1 col mobile, 2 col tablet, 3-4 col desktop
**And** selecting a horse in the grid updates the aside/bottom sheet without page navigation
**And** the page loads in < 1 second with existing cached data (React Query)

**Technical Notes:**

- Rewrite `frontend/src/pages/Index.tsx` or `UserDashboard.tsx`
- Aside panel: new component, conditionally rendered at `lg:` breakpoint
- Bottom sheet: use Radix `Sheet` or custom component, triggered by horse card tap on mobile
- "Getting Started" mode: check `profile.onboardingStep` or `completedOnboarding` timestamp recency

**Prerequisites:** Stories 23.1, 23.2

---

### Story 23.4: Backend — NextActions Endpoint

As a frontend developer,
I want a `GET /api/v1/next-actions` endpoint that returns prioritized action suggestions,
So that the NextActionsBar can display intelligent, server-computed recommendations.

**Acceptance Criteria:**

**Given** an authenticated user calls `GET /api/v1/next-actions`
**When** the server processes the request
**Then** it returns an array of `NextAction` objects, priority-sorted (1 = highest):

| Priority | Condition                                                        | Action Type     |
| -------- | ---------------------------------------------------------------- | --------------- |
| 1        | Unclaimed competition prizes                                     | `claim-prize`   |
| 2        | Competition results available (not yet viewed)                   | `check-results` |
| 3        | Horse ready to train (cooldown expired)                          | `train`         |
| 4        | Open competition closing within 24h (horse eligible)             | `compete`       |
| 5        | Mare/stallion off breeding cooldown                              | `breed`         |
| 6        | Foal needs enrichment activity (age-appropriate, not done today) | `groom-foal`    |
| 7        | Horse health concern (if vet system active)                      | `visit-vet`     |

**And** max 10 actions returned
**And** each action includes: `type`, `priority`, `horseId`, `horseName`, `metadata` (cooldownEndsAt, showId, foalAge, etc.)
**And** response time < 200ms
**And** unauthenticated requests return 401

**Technical Notes:**

- Create `backend/controllers/nextActionsController.mjs` and `backend/routes/nextActionsRoutes.mjs`
- Query across: training cooldowns (horses table), competition entries (CompetitionResult), breeding cooldowns, foal ages, unread messages
- Use single aggregation query where possible (avoid N+1)
- Register route in `backend/app.mjs` under `/api/v1/next-actions`
- Add `nextActionsApi` methods to `frontend/src/lib/api-client.ts`

**Prerequisites:** None (backend-only, can develop in parallel with frontend)

---

**Epic 23 Complete: Hub & Daily Loop**

Stories Created: 4
FR Coverage: FR-CN5 (hub dashboard), FR-CN7 (next actions)
Technical Context: Index.tsx/UserDashboard.tsx rewrite, new NextActions endpoint, HorseCard integration
UX Patterns: UX §5 (Hub), §6 (NextActions), Wireframe 1 (Hub Dashboard)

---

## Epic 24: WhileYouWereGone

**Goal:** Create a delightful return experience that catches players up on everything that happened while they were away — competition results, foal milestones, messages, and more — in one prioritized overlay.

**User Value:** Returning players instantly know what happened without manually checking 6 different pages. The surprise element builds anticipation for logging back in.

**FRs Covered:** FR-CN6

**Dependencies:** Epic 22 (Foundation) + Story 24.1 (WYAG backend)

### Story 24.1: Backend — WYAG Aggregation Endpoint

As a frontend developer,
I want a `GET /api/v1/while-you-were-gone?since=<timestamp>` endpoint that aggregates all events since my last visit,
So that the WYAG overlay can show prioritized updates in a single request.

**Acceptance Criteria:**

**Given** an authenticated user calls `GET /api/v1/while-you-were-gone?since=2026-03-10T08:00:00Z`
**When** the server processes the request
**Then** it returns a `WYAGResponse` with:

- `items[]`: up to 8 events, priority-sorted
- `since`: the requested timestamp
- `hasMore`: true if more than 8 events exist

**And** event types aggregated (highest to lowest priority):

1. `competition-result` — wins, placements, prizes earned
2. `foal-milestone` — trait discoveries, bond milestones, graduation
3. `message` — unread direct messages
4. `club-activity` — election results, new members
5. `training-complete` — cooldowns that expired (horse ready to train)
6. `market-sale` — stud fee income, marketplace transactions

**And** each item includes: `type`, `priority`, `title`, `description`, `timestamp`, `actionUrl` (deep link), optional `metadata`
**And** response time < 300ms
**And** unauthenticated requests return 401

**Technical Notes:**

- Create `backend/controllers/wyagController.mjs` and `backend/routes/wyagRoutes.mjs`
- Aggregation queries across: CompetitionResult, FoalDevelopment/traits, DirectMessage, Club\*, training cooldowns, marketplace
- Use `WHERE createdAt > $since` filters
- Register route in `backend/app.mjs` under `/api/v1/while-you-were-gone`
- Add `wyagApi` methods to `frontend/src/lib/api-client.ts`

**Prerequisites:** None (backend-only)

---

### Story 24.2: WhileYouWereGone Component

As a returning player,
I want a glass panel overlay showing me what happened while I was away,
So that I feel caught up and excited to continue playing.

**Acceptance Criteria:**

**Given** I return to Equoria after 4+ hours away
**When** the app loads
**Then** a glass panel overlay appears above all content (z-index: `--z-modal`)
**And** it shows a title "While You Were Gone..." in Cinzel Decorative
**And** items are listed in priority order with icons per type:

- 🏆 Competition results (gold border if 1st place)
- 🐴 Foal milestones (star icon)
- 💬 Messages (envelope icon)
- 🏛️ Club activity (building icon)
- ⏱️ Training ready (clock icon)
- 💰 Market activity (coin icon)
  **And** max 8 items visible; "View all activity →" link if `hasMore` is true
  **And** each item is clickable → navigates to `actionUrl`
  **And** overlay dismisses on: "Continue to Stable" button click, Escape key, backdrop click
  **And** overlay does NOT appear for new users (`completedOnboarding === false`)
  **And** overlay does NOT appear if away < 4 hours

**Technical Notes:**

- Create `frontend/src/components/hub/WhileYouWereGone.tsx`
- Create `frontend/src/hooks/api/useWYAG.ts`
- Mount in `App.tsx` above `<Routes>`, conditionally rendered
- Use `createPortal` to `document.body` for z-index isolation
- Dismiss state: `useState(false)` — once dismissed, don't show again until next qualifying return

**Prerequisites:** Story 24.1 (backend endpoint), Epic 22 (glass panel styling)

---

### Story 24.3: Return Detection

As a system,
I want to detect when a player returns after 4+ hours away,
So that the WYAG overlay triggers automatically.

**Acceptance Criteria:**

**Given** a player is using the app
**When** they close the tab or navigate away
**Then** the current timestamp is stored in `localStorage.lastVisit`

**Given** a player opens Equoria
**When** `localStorage.lastVisit` exists AND `Date.now() - lastVisit > 4 hours`
**Then** the WYAG endpoint is called with `since=lastVisit`
**And** the WhileYouWereGone overlay is shown with the response data
**And** `localStorage.lastVisit` is updated to current time after overlay dismissal

**And** if `localStorage.lastVisit` does not exist (first visit), no overlay is shown
**And** if user is not authenticated, no overlay is shown
**And** if `completedOnboarding === false`, no overlay is shown

**Technical Notes:**

- Store `lastVisit` via `beforeunload` event listener in `App.tsx`
- On mount: check delta, if > 4h AND authenticated AND onboarded → fetch WYAG → show overlay
- Threshold constant: `WYAG_THRESHOLD_MS = 4 * 60 * 60 * 1000`

**Prerequisites:** Story 24.2

---

**Epic 24 Complete: WhileYouWereGone**

Stories Created: 3
FR Coverage: FR-CN6 (return experience)
Technical Context: New WYAG endpoint, localStorage return detection, App.tsx overlay mount
UX Patterns: UX §6 (WYAG), Wireframe 2 (WhileYouWereGone)

---

## Epic BACKEND-A: Competition Model Rewrite

**Goal:** Transform competitions from instant simulation into player-created shows with 7-day entry windows and overnight execution. This is a fundamental gameplay model change that makes competition entry a strategic commitment rather than an instant button press.

**User Value:** Players create their own shows, browse open competitions, scout the field before entering, and receive results after overnight execution. Competitions become social, strategic events — not solo button clicks.

**FRs Covered:** FR-CN8, FR-CN20

**Dependencies:** None (parallel with frontend epics)

### Story BA.1: Show Model Expansion

As a developer,
I want the Prisma schema updated to support show lifecycle states and ownership,
So that competitions have entry windows, execution dates, and creator attribution.

**Acceptance Criteria:**

**Given** the database schema is updated
**When** a migration runs
**Then** the `Show` model has new fields:

- `status` — enum: `open`, `closed`, `executing`, `completed` (default: `open`)
- `openDate` — DateTime (when show was created/opened for entries)
- `closeDate` — DateTime (7 days after openDate)
- `executedAt` — DateTime? (null until overnight execution runs)
- `createdByUserId` — UUID? (player who created the show)
- `createdByClubId` — Int? (club that created the show, nullable)
- `maxEntries` — Int? (cap on entries, nullable = unlimited)
- `entryFee` — Int (default: 0)

**And** existing shows are migrated with `status: 'completed'`, `openDate = createdAt`, `closeDate = createdAt`
**And** all existing tests pass without modification (backward compatibility)
**And** the Prisma client regenerates successfully

**Technical Notes:**

- Update `packages/database/prisma/schema.prisma`
- Create migration: `npx prisma migrate dev --name add-show-lifecycle`
- Run against test DB: `DATABASE_URL=...equoria_test npx prisma migrate deploy`
- Add `ShowStatus` enum to schema

**Prerequisites:** None

---

### Story BA.2: Show Creation Endpoint

As a player,
I want to create my own competition shows with a name, discipline, and optional entry fee,
So that I can organize events for the community.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I call `POST /api/v1/shows/create` with `{ name, discipline, entryFee?, maxEntries?, description? }`
**Then** a new Show is created with:

- `status: 'open'`
- `openDate: now`
- `closeDate: now + 7 days`
- `createdByUserId: me`
  **And** the response includes the created show object with `id`, `closeDate`, `status`
  **And** validation rejects: invalid discipline, negative entry fee, entry fee > 10000, name < 3 or > 100 chars
  **And** unauthenticated requests return 401

**Technical Notes:**

- Add `createShow` to `backend/modules/competition/controllers/competitionController.mjs`
- Add `POST /api/v1/shows/create` route
- Reuse existing discipline validation logic
- Add `showsApi.create()` to `frontend/src/lib/api-client.ts`

**Prerequisites:** Story BA.1

---

### Story BA.3: Show Browse & Entry

As a player,
I want to browse open competitions and enter my eligible horses,
So that I can find the right shows for my horses' disciplines and skill levels.

**Acceptance Criteria:**

**Given** I call `GET /api/v1/shows?status=open`
**When** open shows exist
**Then** I receive a paginated list with: name, discipline, entryFee, closeDate, entryCount, maxEntries, createdBy
**And** I can filter by: discipline, closing within 24h, entry fee range
**And** results are sorted by closeDate ascending (closing soonest first)

**Given** I call `POST /api/v1/shows/:id/enter` with `{ horseId }`
**When** the show is open AND horse is eligible AND not already entered AND I can afford the fee
**Then** the entry is recorded, entry fee deducted, entry count incremented
**And** response includes updated show info and confirmation

**And** validation rejects: closed show, ineligible horse (age/health/discipline), duplicate entry, insufficient funds
**And** each rejection returns a specific error message explaining why

**Technical Notes:**

- Add `browseShows` and `enterShow` to competition controller
- Reuse existing `checkEligibility` logic for horse validation
- Money deduction via existing balance transaction pattern
- Paginate with existing pagination helper

**Prerequisites:** Story BA.1

---

### Story BA.4: Overnight Execution Scheduler

As a system,
I want shows to automatically execute overnight after their entry window closes,
So that results are available when players log in the next morning.

**Acceptance Criteria:**

**Given** a cron job or scheduled task runs (e.g., every hour, or daily at 2 AM)
**When** it finds shows where `closeDate <= now AND status === 'open'`
**Then** for each qualifying show:

1. Set `status = 'closed'` (prevent new entries)
2. Execute competition scoring using existing `executeCompetitionScoring()` logic
3. Distribute prizes per placement (existing prize distribution)
4. Award XP to horses and users (existing XP award logic)
5. Apply stat gains per placement (existing stat gain logic)
6. Set `status = 'completed'` and `executedAt = now`

**And** if a show has < 2 entries, it is cancelled (`status = 'cancelled'`) and entry fees refunded
**And** execution is idempotent (re-running on already-completed shows is a no-op)
**And** errors during execution are logged but don't block other shows from executing
**And** all competition results are queryable via existing results endpoints

**Technical Notes:**

- Preserve existing `executeCompetitionScoring()` as internal function — wrap with show lifecycle
- Use `node-cron` or `node-schedule` for scheduling (or Railway cron if available)
- Add `executeOverdueShows()` function to competition controller
- Create startup hook in `app.mjs` to schedule the cron job
- Test: mock Date.now for overnight execution, verify full lifecycle

**Prerequisites:** Stories BA.1, BA.2, BA.3

---

### Story BA.5: Milestones JSONB

As a system,
I want to track lifetime-first achievements in `User.settings.milestones`,
So that CinematicMoments trigger only for truly special moments.

**Acceptance Criteria:**

**Given** a player wins their first-ever competition
**When** prize distribution runs
**Then** `User.settings.milestones.firstWin` is set to the ISO timestamp (if currently null/undefined)
**And** the competition result response includes `isFirstEverWin: true`

**And** the same pattern applies for:

- `firstBreed` — set on first foal birth
- `firstTrait` — set on first trait discovery
- `firstLegendary` — set on first ultra-rare/exotic trait
- `firstMaxLevel` — set on first horse reaching max level
- `firstGraduation` — set on first foal graduating at age 3

**And** milestones are WRITE-ONCE (if already set, never overwritten)
**And** `GET /api/v1/auth/profile` includes `milestones` in the response
**And** existing tests pass (milestones field is optional, defaults to `{}`)

**Technical Notes:**

- User.settings is existing JSONB — add `milestones` key
- Modify prize distribution in competition controller: check `!user.settings.milestones?.firstWin` before setting
- Modify breeding controller: check `!user.settings.milestones?.firstBreed` on foal creation
- Modify trait controller: similar pattern for firstTrait/firstLegendary
- Expose in `getProfile` response (auth controller)

**Prerequisites:** Story BA.1

---

**Epic BACKEND-A Complete: Competition Model Rewrite**

Stories Created: 5
FR Coverage: FR-CN8 (competition model), FR-CN20 (milestones)
Technical Context: Prisma schema, competitionController, cron scheduling, User.settings JSONB
Architecture Sections: `backend/modules/competition/`, `packages/database/prisma/schema.prisma`

---

## Epic 25: Onboarding Rebuild

**Goal:** Transform the new player's first 5 minutes from a functional 3-step wizard into an atmospheric breed selection experience that sets the fantasy tone.

**User Value:** New players choose their first horse from a beautiful, informative breed selector — not a dropdown. They see stat tendencies, lore, and a preview before committing. The first impression is "this game cares about its world."

**FRs Covered:** FR-CN11

**Dependencies:** Epic 22 (Foundation)

### Story 25.1: BreedSelector Component

As a new player,
I want to browse horse breeds with previews showing stat tendencies and lore,
So that I can make an informed, exciting choice for my first horse.

**Acceptance Criteria:**

**Given** I am on the onboarding wizard (Step 2: Choose Your Horse)
**When** the BreedSelector renders
**Then** all available breeds display as cards with:

- Breed name (Cinzel font)
- Portrait placeholder (placeholder.svg silhouette)
- Stat tendency mini-radar (3-4 key stats: speed/stamina/agility/intelligence)
- One-line lore blurb ("Bred for speed on open plains")
  **And** I can toggle between grid view (mobile default) and list view (desktop default)
  **And** selecting a breed highlights it with gold border and shows expanded info
  **And** I can choose gender: Mare or Stallion (toggle buttons)
  **And** I can enter a name (2-50 chars) with live preview of "Your horse: [name] the [breed] [gender]"
  **And** the "Continue" button is disabled until breed + gender + valid name are selected

**Technical Notes:**

- Create `frontend/src/components/onboarding/BreedSelector.tsx`
- Wire to `GET /api/v1/breeds` endpoint (existing)
- Stat tendency radar: simplified Recharts RadarChart or CSS-only bar comparison
- Grid/list toggle: persist to localStorage (existing pattern from Epic 3)

**Prerequisites:** Epic 22 complete

---

### Story 25.2: Onboarding Wizard Restyle

As a new player,
I want the onboarding wizard to feel like entering a fantasy world,
So that my first experience of Equoria matches the celestial atmosphere.

**Acceptance Criteria:**

**Given** I am a new user (`completedOnboarding === false`)
**When** I land on `/onboarding`
**Then** the wizard renders with 3 Celestial Night styled steps:

1. **Welcome** — StarfieldBackground visible, atmospheric intro text in Cinzel, "Begin Your Journey" gold button
2. **Choose Your Horse** — BreedSelector (from Story 25.1) in glass panels
3. **Ready** — Stable preview showing my chosen horse card with NarrativeChip, "Enter the World" gold button
   **And** step indicators show gold progress (filled dots for completed, outlined for upcoming)
   **And** the wizard is full-height on mobile (no scrolling within steps)
   **And** the existing `POST /api/auth/complete-onboarding` flow is preserved

**Technical Notes:**

- Restyle `frontend/src/pages/OnboardingPage.tsx` with `.celestial` scope
- Replace generic buttons with CelestialButton variants
- Step indicators: use existing Progress component (restyled in 22.6) or custom dots
- Ensure OnboardingGuard redirect still works

**Prerequisites:** Story 25.1, Epic 22

---

### Story 25.3: Breed Data Integration

As a system,
I want the breeds endpoint to include stat tendencies for each breed,
So that the BreedSelector can show meaningful stat previews.

**Acceptance Criteria:**

**Given** `GET /api/v1/breeds` is called
**When** breeds are returned
**Then** each breed includes `statTendencies`: min/max ranges for key stats (speed, stamina, agility, intelligence, obedience, boldness)
**And** tendencies are based on breed base stats from the database
**And** response is cached by React Query with `staleTime: 10 * 60 * 1000` (10 minutes)
**And** existing breed endpoint consumers are not broken (tendencies are additive)

**Technical Notes:**

- Modify `backend/modules/horses/controllers/` breed handler to include stat ranges
- If base stats aren't per-breed in schema, derive from breed characteristics or hardcode initial values
- Add `statTendencies` to breed TypeScript interface in frontend

**Prerequisites:** None (backend-only)

---

**Epic 25 Complete: Onboarding Rebuild**

Stories Created: 3
FR Coverage: FR-CN11 (onboarding)
Technical Context: OnboardingPage.tsx restyle, new BreedSelector, breeds endpoint enhancement
UX Patterns: UX §10.1 (Onboarding), Wireframe 3 (Onboarding Wizard)

---

## Epic 26: Training Flow Redesign

**Goal:** Transform training from "pick a discipline from a dropdown" into an intelligent, guided experience where the game recommends disciplines based on horse aptitude and shows real-time impact previews.

**User Value:** Players see smart discipline recommendations ranked by their horse's natural talents, real-time cooldown countdowns, and predicted stat gains — making training an informed strategic choice.

**FRs Covered:** FR-CN12

**Dependencies:** Epic 22 (Foundation)

### Story 26.1: DisciplineSelector Component

As a player training a horse,
I want to see the top 5 recommended disciplines for this horse, with stat impact previews,
So that I make informed training decisions that play to my horse's strengths.

**Acceptance Criteria:**

**Given** I am on the training page with an eligible horse selected
**When** the DisciplineSelector renders
**Then** the top 5 disciplines are shown prominently, ranked by horse aptitude:

- Discipline name + icon
- Match score (e.g., "92% match" based on primary stat alignment)
- Stat impact preview: "Speed +5, Stamina +3 (15% chance)"
- "Recommended" badge on the #1 match
  **And** an "All Disciplines" expandable section shows all 23 disciplines below
  **And** disciplines the horse is ineligible for are grayed out with a reason tooltip ("Requires Gaited trait")
  **And** selecting a discipline highlights it with gold accent and enables the "Train" button

**Technical Notes:**

- Create `frontend/src/components/training/DisciplineSelector.tsx`
- Aptitude ranking: compute client-side from horse stats × discipline primary stat weights (weights from PRD-03 §1.2)
- Stat impact: reference base gain (+5 discipline score, 15% stat chance) from PRD-03 §1.1
- Trait integration: show bonus/penalty indicators per PRD-03 §1.3

**Prerequisites:** Epic 22 complete

---

### Story 26.2: CooldownTimer Component

As a player,
I want to see a real-time countdown for training and breeding cooldowns,
So that I know exactly when my horse will be available again.

**Acceptance Criteria:**

**Given** a horse has an active training cooldown
**When** the CooldownTimer renders
**Then** it shows a real-time countdown: "Xd Xh Xm" updating every minute
**And** when the countdown reaches zero, it transitions to a glowing green "Ready!" state
**And** the timer works for both training cooldowns (7 days) and breeding cooldowns (30d mare / 14d stallion)
**And** `prefers-reduced-motion` users see the glow as a static green state (no pulse animation)
**And** the component uses `setInterval` with 60-second tick (not 1-second — unnecessary precision)
**And** the component accepts a `targetDate: Date` prop and is reusable across pages

**Technical Notes:**

- Create `frontend/src/components/common/CooldownTimer.tsx`
- Pattern matches existing countdown timer pattern from Epic 4 (Pattern Library)
- Clear interval on unmount
- Use `aria-label` for screen reader: "Training cooldown: 3 days 4 hours remaining"

**Prerequisites:** None (reusable component)

---

### Story 26.3: Training Page Restyle

As a player,
I want the training page to use Celestial Night styling with intelligent discipline selection and cooldown timers,
So that training feels like a strategic coaching session, not a form submission.

**Acceptance Criteria:**

**Given** I navigate to `/training`
**When** the page loads
**Then** the layout shows:

1. **Horse selector** — eligible horses first (sorted by "ready to train"), each with CooldownTimer if on cooldown
2. **DisciplineSelector** (from Story 26.1) — appears after horse selection
3. **Training confirmation** — glass panel showing: horse name, discipline, predicted gains, "Train" gold button
4. **Training result** — after submission: stat changes visualization, XP gained, cooldown set
   **And** all elements use Celestial Night glass panels, gold accents, Cinzel headings
   **And** horse selector shows NarrativeChips for status context
   **And** the "Train" button is disabled with explanation if horse is on cooldown or ineligible

**Technical Notes:**

- Restyle `frontend/src/pages/TrainingPage.tsx`
- Integrate DisciplineSelector and CooldownTimer components
- Training result display: highlight changed stats with gold flash animation
- Preserve existing training mutation hook (`useTrainHorse` or similar)

**Prerequisites:** Stories 26.1, 26.2, Epic 22

---

**Epic 26 Complete: Training Flow Redesign**

Stories Created: 3
FR Coverage: FR-CN12 (training flow)
Technical Context: TrainingPage.tsx restyle, new DisciplineSelector, CooldownTimer
UX Patterns: UX §10.3 (Training), Wireframe 4 (Training Page)

---

## Epic 27: Competition Flow Redesign

**Goal:** Transform the competition page from instant-entry to a strategic browse-scout-enter flow with 7-day windows, field scouting, and beautifully presented results with score breakdowns.

**User Value:** Players browse competitions like scouting a field — they see who's entered, evaluate the competition, make a strategic entry decision, and receive results overnight with detailed score breakdowns.

**FRs Covered:** FR-CN13, FR-CN10

**Dependencies:** Epic BACKEND-A (competition model must be live)

### Story 27.1: CompetitionFieldPreview Component

As a player evaluating a competition,
I want to scout the field — see who's entered, how strong they are, and how much time is left,
So that I can make an informed decision about entering my horse.

**Acceptance Criteria:**

**Given** I click into a specific open competition
**When** the CompetitionFieldPreview renders
**Then** I see:

- Entry count / max entries (e.g., "7 / 12 entries")
- CooldownTimer counting down to `closeDate`
- List of entered horses with: name, breed, owner, level badge
- Stat comparison radar chart showing average field strength vs my horse (if I select one)
- "Enter [Horse Name]" gold button
  **And** the preview refreshes on focus (React Query `refetchOnWindowFocus`)
  **And** if the show is closed/completed, a "Results" view replaces the entry form
  **And** data is fetched via `GET /api/v1/shows/:id` (with entries populated)

**Technical Notes:**

- Create `frontend/src/components/competition/CompetitionFieldPreview.tsx`
- Radar chart: reuse Recharts RadarChart pattern from existing ScoreBreakdownChart
- Horse selection: dropdown or card picker from user's eligible horses
- Fetch entries via new endpoint or extended show detail endpoint

**Prerequisites:** Epic BACKEND-A complete

---

### Story 27.2: Competition Page Restyle

As a player,
I want to browse open competitions with filters, see entry windows, and enter with confidence,
So that finding and joining competitions is enjoyable and strategic.

**Acceptance Criteria:**

**Given** I navigate to `/competitions`
**When** the page loads
**Then** I see a grid/list of open shows with:

- Show name, discipline badge, entry fee, entry count
- CooldownTimer showing time until close (gold accent if < 24h)
- Creator name (player or club)
- "View & Enter" button
  **And** I can filter by: discipline, closing within 24h, entry fee range (free / paid)
  **And** results are sorted: closing soonest first
  **And** clicking a show opens CompetitionFieldPreview (from Story 27.1) in a detail panel or modal
  **And** a "Create Show" gold button allows me to create my own competition (calls BA.2 endpoint)
  **And** all elements use Celestial Night styling

**Technical Notes:**

- Restyle `frontend/src/pages/CompetitionBrowserPage.tsx` (or equivalent)
- Wire filters to `GET /api/v1/shows?status=open&discipline=...` query params
- Create show modal: simple form (name, discipline, entry fee, description)

**Prerequisites:** Story 27.1, Epic 22

---

### Story 27.3: Results Page Restyle

As a player,
I want to see detailed competition results with score breakdowns and personal bests,
So that I understand how my horse performed and what to improve.

**Acceptance Criteria:**

**Given** I view a completed competition's results
**When** the results page renders
**Then** I see:

- Placement list: position, horse name, owner, final score, prize earned
- My horse highlighted with gold border (if I entered)
- ScoreBreakdownRadar (from Story 27.4) for each horse I own in the results
- Personal best tracking: "New personal best in Dressage!" indicator if score exceeds previous best
  **And** if this is my first-ever win (`isFirstEverWin: true` in response), CinematicMoment triggers ('cup-win' variant)
  **And** subsequent wins show a RewardToast instead (not CinematicMoment)
  **And** results are accessible via WYAG overlay (returning players see results there first)

**Technical Notes:**

- Restyle `frontend/src/pages/CompetitionResultsPage.tsx` (or create new)
- CinematicMoment trigger: check `isFirstEverWin` flag in competition result response
- Personal best: compare against `horse.disciplineScores[discipline]` or track in localStorage

**Prerequisites:** Story 27.4, Epic BACKEND-A (BA.4 for overnight results, BA.5 for milestones)

---

### Story 27.4: ScoreBreakdownRadar Component

As a player reviewing results,
I want a radar chart showing how my horse scored across stat categories,
So that I can see strengths and weaknesses visually.

**Acceptance Criteria:**

**Given** a competition result for my horse
**When** the ScoreBreakdownRadar renders
**Then** a Recharts RadarChart displays with:

- Celestial Night styling: navy background, gold data line, gold-filled area (0.3 opacity)
- 6-8 stat axes matching the discipline's primary/secondary stats
- My horse's scores on each axis
- Optional: electric-blue reference line for personal best overlay
  **And** chart is responsive (shrinks gracefully on mobile)
  **And** axes have readable labels (Inter font, cream color)
  **And** tooltip shows exact values on hover

**Technical Notes:**

- Create `frontend/src/components/competition/ScoreBreakdownRadar.tsx`
- Use existing Recharts dependency (already in vendor-charts chunk)
- Style: `<PolarGrid stroke="var(--glass-border)">` (maps to `rgba(148,163,184,0.2)` via token); `<Radar fill="var(--gold-radar-fill)">` where `--gold-radar-fill` is a new token in `tokens.css` defined as `rgba(200,168,78,0.3)` — **no raw rgba/hex literals in the component file**
- Props: `{ scores: Array<{category: string, value: number}>, personalBest?: Array<...> }`
- Add `--gold-radar-fill: rgba(200,168,78,0.3)` to the tokens.css navy/gold section

**Prerequisites:** Epic 22 (styling foundation)

---

**Epic 27 Complete: Competition Flow Redesign**

Stories Created: 4
FR Coverage: FR-CN13 (competition flow), FR-CN10 (CinematicMoment for first win)
Technical Context: CompetitionBrowserPage restyle, new CompetitionFieldPreview, ScoreBreakdownRadar
UX Patterns: UX §10.4 (Competition), Wireframe 5 (Competition Page)

---

## Epic BACKEND-B: Foal Development Model Expansion

**Goal:** Expand foal development from a 6-day enrichment window to a realistic 0-2 year lifecycle with age-evolving groom activities, milestone tracking, and graduation at age 3. Foal care becomes a meaningful long-term journey.

**User Value:** Players raise their foals through distinct life stages (newborn → weanling → yearling → two-year-old) with age-appropriate activities at each stage. Milestones celebrate progress, and graduation at age 3 marks the transition to an adult horse ready for training and competition.

**FRs Covered:** FR-CN9

**Dependencies:** None (parallel with frontend epics)

### Story BB.1: Age-Based Development

As a developer,
I want foal development to be age-aware with computed stages,
So that the system knows what activities and milestones are appropriate for each foal.

**Acceptance Criteria:**

**Given** a foal exists with `Horse.dateOfBirth`
**When** `GET /api/v1/foals/:id/development` is called
**Then** the response includes:

- `ageInWeeks`: computed from `dateOfBirth` to now
- `ageStage`: enum based on weeks:
  - `newborn`: 0-4 weeks
  - `weanling`: 5-26 weeks
  - `yearling`: 27-52 weeks
  - `two-year-old`: 53-104 weeks
  - `graduated`: 105+ weeks (age 3+)
- `birthDate`: ISO string
- All existing development fields preserved

**And** the `ageStage` computation is a pure function (testable without DB)
**And** existing foal development consumers are not broken (new fields are additive)

**Technical Notes:**

- Modify foal controller in `backend/modules/breeding/controllers/` (or `backend/modules/horses/`)
- Add `computeAgeStage(birthDate)` utility function
- No schema migration needed (computed from existing `dateOfBirth`)
- Add tests for boundary conditions (exactly 4 weeks, 26 weeks, 52 weeks, 104 weeks)

**Prerequisites:** None

---

### Story BB.2: Age-Evolving Activities

As a player caring for a foal,
I want age-appropriate activities that evolve as my foal grows,
So that care feels realistic and I can't just repeat the same task forever.

**Acceptance Criteria:**

**Given** `GET /api/v1/foals/:id/development` is called
**When** the foal is in a specific age stage
**Then** `availableActivities` returns only activities appropriate for that stage:

| Stage                       | Activities                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- |
| **Newborn** (0-4wk)         | Imprinting, gentle handling, first touch, mare bonding                        |
| **Weanling** (5-26wk)       | Desensitization, social exposure, halter introduction, paddock exploration    |
| **Yearling** (27-52wk)      | Ground work, basic obstacles, leading practice, hoof handling                 |
| **Two-year-old** (53-104wk) | Intro to tack, first lead walks, confidence building, pre-training assessment |
| **Graduated** (105+wk)      | Empty array (development window closed)                                       |

**And** each activity includes: `id`, `name`, `description`, `ageStage`, `bondImpact`, `stressImpact`
**And** POST to perform an activity validates the foal is in the correct age stage
**And** activities performed today are excluded (one per day limit, existing pattern)

**Technical Notes:**

- Define activity sets as constants (or database-seeded)
- Filter `availableActivities` by `ageStage` before returning
- Reuse existing groom interaction validation for daily limits
- Add activities to existing enrichment endpoint or create new `POST /api/v1/foals/:id/activity`

**Prerequisites:** Story BB.1

---

### Story BB.3: Milestone Detection

As a system,
I want to detect and record developmental milestones as foals grow,
So that players can celebrate progress and the system can trigger CinematicMoments.

**Acceptance Criteria:**

**Given** a foal's development progresses
**When** a milestone condition is met
**Then** it is recorded in the foal's development data:

| Milestone            | Condition                                 | One-time? |
| -------------------- | ----------------------------------------- | --------- |
| `bond-25`            | Bond level reaches 25                     | Yes       |
| `bond-50`            | Bond level reaches 50                     | Yes       |
| `bond-75`            | Bond level reaches 75                     | Yes       |
| `bond-100`           | Bond level reaches 100                    | Yes       |
| `first-trait`        | First epigenetic trait discovered         | Yes       |
| `stage-weanling`     | Foal enters weanling stage (5 weeks)      | Yes       |
| `stage-yearling`     | Foal enters yearling stage (27 weeks)     | Yes       |
| `stage-two-year-old` | Foal enters two-year-old stage (53 weeks) | Yes       |
| `graduation`         | Foal reaches age 3 (105 weeks)            | Yes       |

**And** `GET /api/v1/foals/:id/development` includes `completedMilestones: Array<{ id, timestamp }>`
**And** milestones are never duplicated (check before recording)
**And** milestone detection runs after every activity/interaction and on age check

**Technical Notes:**

- Add `milestones` JSONB array to FoalDevelopment (or Horse) record
- Check milestones after: groom interaction, enrichment activity, and age computation
- Milestone event structure: `{ id: string, achievedAt: ISO }`

**Prerequisites:** Story BB.1

---

### Story BB.4: Graduation Transition

As a player,
I want my foal to "graduate" at age 3, becoming an adult horse eligible for training and competition,
So that raising a foal has a clear, satisfying endpoint.

**Acceptance Criteria:**

**Given** a foal reaches age 3 (105+ weeks)
**When** the system detects this
**Then** the `graduation` milestone is recorded
**And** `availableActivities` returns empty array (development window closed)
**And** the horse becomes eligible for training (existing age check: ≥ 3 years)
**And** the horse becomes eligible for competition (existing age check: ≥ 3 years)
**And** groom assignments for foal care are flagged for reassignment
**And** the graduation milestone flag is set for CinematicMoment triggering (checked via BA.5 milestones)
**And** `User.settings.milestones.firstGraduation` is set if this is the user's first foal to graduate

**Technical Notes:**

- Graduation detection: part of `computeAgeStage()` — when stage transitions to `graduated`
- Training/competition eligibility already uses age checks (≥ 3 years) — no change needed
- CinematicMoment: set `firstGraduation` in User.settings.milestones (pattern from BA.5)
- Groom reassignment: flag or clear foal-specific assignments

**Prerequisites:** Stories BB.1, BB.3, BA.5

---

**Epic BACKEND-B Complete: Foal Development Model Expansion**

Stories Created: 4
FR Coverage: FR-CN9 (foal development)
Technical Context: Foal controller expansion, age computation, activity filtering, milestone detection
Architecture Sections: `backend/modules/breeding/`, `packages/database/prisma/schema.prisma`

---

## Epic 28: Breeding Flow Redesign

**Goal:** Transform breeding from a simple pair-and-click into a strategic decision supported by comprehensive compatibility previews showing stat ranges, trait inheritance, inbreeding risk, and pedigree overlap.

**User Value:** Players make informed breeding decisions by seeing predicted offspring stat ranges, trait inheritance probabilities, and inbreeding warnings before committing. First foal birth triggers a cinematic celebration — repeat births get a respectful toast.

**FRs Covered:** FR-CN14, FR-CN10

**Dependencies:** Epic 22 (Foundation)

### Story 28.1: CompatibilityPreview Component

As a player evaluating a breeding pair,
I want to see a comprehensive compatibility preview with stats, traits, inbreeding, and pedigree,
So that I can make strategic breeding decisions based on data.

**Acceptance Criteria:**

**Given** I have selected a mare and stallion (or am viewing a horse detail's "Breed" action)
**When** the CompatibilityPreview renders
**Then** it shows 4 tabbed sections:

| Tab             | Content                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Stat Ranges** | Predicted offspring min/max/average for all 10 stats, based on parent stats                    |
| **Traits**      | Inherited trait probability per trait (parent traits, epigenetic flags, personality influence) |
| **Inbreeding**  | Inbreeding coefficient (3-generation check); warning banner if coefficient > 6.25%             |
| **Pedigree**    | Ancestor overlap visualization (shared ancestors highlighted in gold)                          |

**And** tabs use GoldTabs styling (from Epic 22)
**And** entry is bidirectional: can start from mare page, stallion page, or dedicated breeding page
**And** stat ranges render as horizontal range bars (min–max with average marker)
**And** loading state shows skeleton while data fetches

**Technical Notes:**

- Create `frontend/src/components/breeding/CompatibilityPreview.tsx`
- Stat prediction: client-side computation from parent stats (average ± variance)
- Trait inheritance: from `GET /api/v1/epigenetic-traits/breeding-insights/:horseId` (existing)
- Inbreeding: compute from pedigree data (existing sire/dam chain)
- Pedigree overlap: traverse 3-generation lineage from both parents

**Prerequisites:** Epic 22 complete

---

### Story 28.2: Breeding Page Restyle

As a player,
I want the breeding page to use Celestial Night styling with the CompatibilityPreview integrated,
So that breeding decisions feel strategic and the experience is immersive.

**Acceptance Criteria:**

**Given** I navigate to `/breeding` or use the "Breed" action from a horse detail page
**When** the page loads
**Then** I see:

1. **Mare selector** — glass panel with my mares, CooldownTimer if on cooldown
2. **Stallion selector** — glass panel with my stallions + public stud stallions
3. **CompatibilityPreview** (from Story 28.1) — appears after both are selected
4. **Cost breakdown** — stud fee + breeding fee, gold accent on total
5. **"Breed" gold button** — disabled until pair selected and funds sufficient

**And** all elements use Celestial Night glass panels, gold accents
**And** CooldownTimer shows mare cooldown (30 days) and stallion cooldown (14 days)
**And** the page supports bidirectional entry (deep-link with `?mare=123` or `?stallion=456`)

**Technical Notes:**

- Restyle `frontend/src/pages/breeding/BreedingPairSelection.tsx`
- Integrate CompatibilityPreview and CooldownTimer
- Bidirectional: check URL search params on mount, pre-select horse
- Preserve existing breeding mutation hook

**Prerequisites:** Story 28.1, Epic 22

---

### Story 28.3: CinematicMoment Scaling

As a player,
I want my first-ever foal birth to trigger a full cinematic celebration, but repeat births to use a respectful toast,
So that special moments feel special without becoming annoying.

**Acceptance Criteria:**

**Given** a breeding succeeds and a foal is born
**When** the result is displayed
**Then** IF `User.settings.milestones.firstBreed` is null/undefined:

- CinematicMoment renders with 'foal-birth' variant (fullscreen overlay, shooting stars, gold text)
- `firstBreed` milestone is set to current timestamp
  **And** IF `User.settings.milestones.firstBreed` already exists:
- RewardToast renders instead ("Foal born: [name] the [breed]!", horse icon, gold accent, 4s auto-dismiss)
- No CinematicMoment

**And** the same scaling pattern applies to all CinematicMoment events (tech spec policy):

- First-ever → CinematicMoment
- Repeat → RewardToast
  **And** CinematicMoment uses existing component from Epic 18 (`CinematicMoment.tsx`)

**Technical Notes:**

- Modify `frontend/src/pages/breeding/BreedingPairSelection.tsx` breeding success handler
- Check milestones from profile data (cached in React Query: `['profile']`)
- CinematicMoment already exists with 3 variants (trait-discovery, foal-birth, cup-win)
- RewardToast: new component (built in Epic 30, or build minimal version here)

**Prerequisites:** Epic BACKEND-A Story BA.5 (milestones JSONB), Epic 22

---

**Epic 28 Complete: Breeding Flow Redesign**

Stories Created: 3
FR Coverage: FR-CN14 (breeding flow), FR-CN10 (CinematicMoment scaling)
Technical Context: BreedingPairSelection.tsx restyle, new CompatibilityPreview, milestone-based CinematicMoment
UX Patterns: UX §10.5 (Breeding), Wireframe 6 (Breeding Page)

---

## Epic 29: Foal Development Overhaul

**Goal:** Transform foal care from a simple daily task list into a long-term developmental journey with a visual timeline, age-stage activities, milestone celebrations, and trait discovery moments. This is the emotional heart of the game.

**User Value:** Players follow their foals through a 0-2 year timeline, watching them grow through distinct life stages. Each milestone — first trait, first bond level, graduation — feels like a parenting triumph. Players will screenshot these moments and share them.

**FRs Covered:** FR-CN9, FR-CN10, FR-CN15

**Dependencies:** Epic BACKEND-B (foal development model)

### Story 29.1: DevelopmentTracker Component

As a player raising a foal,
I want a visual timeline showing my foal's development journey from birth to graduation,
So that I can see where they are, what they've achieved, and what's coming next.

**Acceptance Criteria:**

**Given** I view a foal's development page
**When** the DevelopmentTracker renders
**Then** on **desktop** (≥ 1024px): horizontal timeline with milestone markers:

- Birth → Weanling (5wk) → Yearling (27wk) → Two-year-old (53wk) → Graduation (105wk)
- Completed milestones shown as gold stars
- Current position shown as glowing marker with age label
- Upcoming milestones shown as dim outlined circles

**And** on **mobile** (< 768px): stacked card view:

- One card per age stage (completed, current, upcoming)
- Current stage expanded with activities and progress
- Completed stages collapsed with milestone count

**And** below the timeline: current age stage name, available activities, completed milestones list
**And** bond progress bar (0-100) with milestone markers at 25/50/75/100
**And** trait status: discovered traits shown as badges, hidden traits as "?" placeholders

**Technical Notes:**

- Create `frontend/src/components/foal/DevelopmentTracker.tsx`
- Wire to `GET /api/v1/foals/:id/development` (expanded in BACKEND-B)
- Timeline: CSS flexbox with positioned markers, or Recharts timeline
- Responsive: `useMediaQuery` or Tailwind breakpoints for desktop/mobile switch

**Prerequisites:** Epic BACKEND-B complete, Epic 22

---

### Story 29.2: Age-Appropriate Activity UI

As a player,
I want to see and perform age-appropriate activities for my foal's current life stage,
So that caring for my foal feels realistic and each stage has unique interactions.

**Acceptance Criteria:**

**Given** I am viewing my foal's development page
**When** the activity section renders
**Then** activities are grouped by the current age stage
**And** each activity shows: name, description, bond impact (+X), stress impact (-Y), icon
**And** activities outside the current stage are not shown (no spoilers for future stages)
**And** activities already performed today are marked with a checkmark and disabled
**And** clicking an activity triggers the groom interaction endpoint
**And** after completion: bond/stress changes are shown with animation, NarrativeChip updates

**And** if the foal has graduated (age 3+), the activity section shows:

- "Your foal has graduated! Ready for training and competition."
- Link to training page

**Technical Notes:**

- Modify existing foal activity UI or create new section in DevelopmentTracker
- Wire to `POST /api/v1/foals/:id/activity` (or existing enrichment endpoint)
- Activity completion: invalidate `['foal', foalId, 'development']` query
- Bond/stress animation: use existing stat change pattern from training results

**Prerequisites:** Story 29.1, Epic BACKEND-B (BB.2 for age-filtered activities)

---

### Story 29.3: Milestone CinematicMoment

As a player,
I want cinematic celebrations for my foal's first-ever trait discovery and graduation,
So that raising foals has emotionally satisfying payoff moments.

**Acceptance Criteria:**

**Given** an activity triggers a trait discovery
**When** it is the user's first-ever trait discovery (`User.settings.milestones.firstTrait === null`)
**Then** CinematicMoment renders with 'trait-discovery' variant (constellation forming animation)
**And** `firstTrait` milestone is set

**And** for subsequent trait discoveries: RewardToast ("Trait Discovered: [trait name]!", star icon)

**Given** a foal reaches age 3 (graduation)
**When** it is the user's first-ever graduation (`User.settings.milestones.firstGraduation === null`)
**Then** CinematicMoment renders with a graduation variant (gold burst, "Your foal has grown up!")
**And** `firstGraduation` milestone is set

**And** for subsequent graduations: RewardToast ("[horse name] has graduated!", trophy icon)
**And** all CinematicMoment triggers respect `prefers-reduced-motion` (static overlay, no animation)

**Technical Notes:**

- Modify `frontend/src/components/foal/FoalDevelopmentTracker.tsx` (or DevelopmentTracker from 29.1)
- Check milestones from cached profile data
- Graduation detection: poll development endpoint or detect `ageStage === 'graduated'` transition
- CinematicMoment already has 3 variants — may need to add 'graduation' variant or reuse 'foal-birth'

**Prerequisites:** Stories 29.1, 29.2, Epic BACKEND-A Story BA.5 (milestones)

---

### Story 29.4: Adult Horse Detail Page Restyle

As a player,
I want the horse detail page to display my horse's stats, traits, and history in full Celestial Night style,
So that the most important page in the game matches the atmosphere of the rest of the redesign.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** I navigate to a horse detail page (`/horses/:id`)
**Then** 10 stat bars render as `StatBar` game components with numeric overlay values
**And** trait badges render as `GameBadge` components with rarity-appropriate styling
**And** the `CareStatusStrip` renders below the horse name with the appropriate `NarrativeChip` variant
**And** the tabbed sections (Overview, Pedigree, Health & Vet, Training History, Stud/Sale) use `GoldTabs`
**And** the sticky bottom action bar (Feed / Train / Breed / Assign / List) uses the gold `default` button variant
**And** the horse name hero text renders in Cinzel Decorative (`--font-display`) at ≥ 28px
**And** the `PageBackground` scene is `horse-detail`
**And** the page is responsive: stat bars stack vertically on mobile, display in two columns on desktop
**And** the file has zero ESLint errors

**Technical Notes:**

- Target file: `frontend/src/pages/HorseDetailPage.tsx` (existing)
- Replace `Card` with `FrostedPanel`, `Tabs` with `GoldTabs`, `Badge` with `GameBadge`, `Progress` with `StatBar`
- CareStatusStrip and NarrativeChip already exist — wire them in if not yet connected
- Sticky action bar: `position: sticky; bottom: 0` within the page scroll container; uses `.glass-panel-heavy` background to float above content

**Prerequisites:** Story 29.1, Epic 22

---

**Epic 29 Complete: Foal Development Overhaul**

Stories Created: 4
FR Coverage: FR-CN9 (foal development), FR-CN10 (CinematicMoment), FR-CN15 (horse detail — foal detail 29.1 + adult detail 29.4)
Technical Context: New DevelopmentTracker, activity UI integration, milestone CinematicMoment, HorseDetailPage restyle
UX Patterns: UX §10.6 (Foal Development), §10.7 (Horse Detail), Wireframe 7, Wireframe 8

---

## Epic 30: Polish & Consistency

**Goal:** Ensure every surface in the game meets the Celestial Night quality bar — decorative frames, atmospheric empty states, meaningful-only reward toasts, and verified WCAG 2.1 AA accessibility across all pages.

**User Value:** No page feels like it belongs to a different app. Empty states are beautiful, not broken. Rewards are meaningful, not spammy. The game is accessible to all players.

**FRs Covered:** FR-CN17, FR-CN18, FR-CN2

**Dependencies:** All previous epics (final pass)

### Story 30.1: GoldBorderFrame Component

As a player viewing hero content (achievements, hall of fame, horse portraits),
I want decorative gold frames that make these displays feel premium,
So that important content is visually elevated above normal UI.

**Acceptance Criteria:**

**Given** the `.celestial` class is active
**When** a GoldBorderFrame wraps content
**Then** an ornate gold border renders with animated corner flourishes
**And** the frame uses CSS custom properties for gold color (`--gold-primary`, `--gold-light`)
**And** corner flourishes are SVG or CSS pseudo-elements (not image files)
**And** `prefers-reduced-motion` disables corner animation (static flourishes)
**And** the frame component accepts `children` and optional `size` prop (sm/md/lg)

**Technical Notes:**

- Create `frontend/src/components/ui/GoldBorderFrame.tsx`
- Use `::before`/`::after` for corner accents with `border-image` or positioned pseudo-elements
- Apply to: hero panels on HorseDetailPage, achievement displays, Hall of Fame entries

**Prerequisites:** Epic 22

---

### Story 30.2: ErrorCard Restyle

As a player encountering an error,
I want error messages to feel atmospheric and provide clear recovery actions,
So that errors don't break the fantasy immersion.

**Acceptance Criteria:**

**Given** an error occurs (API failure, missing data, etc.)
**When** an ErrorCard renders
**Then** it uses Celestial Night styling: dark bg, red accent border (subtle, not alarming), cream text
**And** the error message is human-readable (not stack traces)
**And** a gold "Try Again" button is prominently displayed
**And** optional "Go Home" secondary button returns to hub
**And** the card integrates with Sentry (existing error boundary, no new setup)

**Technical Notes:**

- Restyle existing `frontend/src/components/ui/ErrorCard.tsx`
- Apply `.celestial` scoped styles
- Ensure all existing error boundary catch points render the restyled card

**Prerequisites:** Epic 22

---

### Story 30.3: RewardToast

As a player performing actions throughout the game,
I want meaningful-only reward toasts that celebrate real achievements without spamming every click,
So that notifications feel rewarding, not noisy.

**Acceptance Criteria:**

**Given** a meaningful event occurs (competition win, trait discovery, foal milestone, level up)
**When** a RewardToast triggers
**Then** it renders with:

- Gold accent border, glass panel background
- Icon by type: 🏆 (win), ⭐ (trait), 🐴 (foal), 💰 (money), 📈 (level)
- Brief message: "[Achievement]: [detail]"
- 4-second auto-dismiss with fade-out animation
- Click to dismiss immediately

**And** toasts do NOT fire for:

- Routine mutations (save settings, equip item)
- Navigation events
- Form submissions (use inline success states instead)

**And** max 3 toasts visible simultaneously (queue additional)
**And** `prefers-reduced-motion` users see instant appear/disappear (no fade)
**And** toasts stack vertically (bottom-right desktop, bottom-center mobile)

**Technical Notes:**

- Create `frontend/src/components/feedback/RewardToast.tsx`
- Replace or extend current Sonner toast usage for game events
- Meaningful-only policy: trigger from specific hooks (useTrainHorse, useEnterCompetition, etc.), not generic mutation callbacks
- Use `createPortal` to body for consistent stacking context

**Prerequisites:** Epic 22

---

### Story 30.4: Empty State Illustrations

As a player viewing a page with no data yet,
I want atmospheric empty states with Celestial Night visuals and helpful guidance,
So that empty pages feel intentional and guide me toward the next action.

**Acceptance Criteria:**

**Given** a page has no data (no horses, no competitions, no messages, no results)
**When** the empty state renders
**Then** it shows:

- Horse silhouette illustration (using `placeholder.svg` as base)
- Atmospheric message in Cinzel: "No horses in your stable yet" / "No competitions entered" / etc.
- Helpful subtext in Inter: "Visit the market to find your first horse" / "Browse open shows to enter"
- CTA gold button linking to the relevant page
  **And** empty states exist for: My Horses, Competitions, Messages, Results, Inventory, Breeding

**Technical Notes:**

- Create `frontend/src/components/common/EmptyState.tsx` (reusable)
- Props: `{ icon?: ReactNode, title: string, description: string, ctaLabel?: string, ctaHref?: string }`
- Apply to all pages that currently show bare "No data" text
- Use existing `placeholder.svg` with CSS filter for tinting

**Prerequisites:** Epic 22

---

### Story 30.5: Accessibility Audit

As all players,
I want the entire game to meet WCAG 2.1 AA accessibility standards,
So that Equoria is playable by everyone regardless of ability.

**Acceptance Criteria:**

**Given** the Celestial Night restyle is complete across all pages
**When** an accessibility audit is performed
**Then** the following pass:

| Check               | Standard   | Requirement                                                             |
| ------------------- | ---------- | ----------------------------------------------------------------------- |
| Color contrast      | WCAG 1.4.3 | ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components         |
| Touch targets       | WCAG 2.5.5 | ≥ 44×44px for all interactive elements on mobile                        |
| Keyboard navigation | WCAG 2.1.1 | All interactive elements reachable via Tab, operable via Enter/Space    |
| Focus indicators    | WCAG 2.4.7 | Visible gold `box-shadow` focus ring on all focusable elements          |
| Screen reader       | WCAG 4.1.2 | ARIA labels on all interactive elements; live regions for state changes |
| Reduced motion      | WCAG 2.3.3 | All animations disabled when `prefers-reduced-motion` is set            |
| Forced colors       | Windows HC | Visible borders/outlines in `forced-colors: active` mode                |

**And** Lighthouse accessibility score ≥ 0.85 on all pages
**And** keyboard-only navigation completes all core flows: login → hub → train → compete → breed
**And** audit findings documented with fix locations

**Technical Notes:**

- Run axe-core or Lighthouse on every page
- Use Chrome DevTools "Rendering" tab to test `prefers-reduced-motion` and `forced-colors`
- Test with NVDA or VoiceOver for screen reader flows
- Fix findings in the relevant component files (not a separate a11y layer)
- Update `.lighthouserc.yml` if thresholds need adjustment

**Prerequisites:** All previous epics complete

---

### Story 30.6: Bundle Size Audit

As a developer,
I want to verify the Celestial Night additions stay within the performance budget,
So that the game loads fast on all devices including mobile on 4G.

**Acceptance Criteria:**

**Given** all Celestial Night components are implemented
**When** `npx vite build` is run
**Then** initial bundle size is < 400KB (currently 321KB; budget allows 79KB growth)
**And** fonts (Cinzel + Inter WOFF2) add ≤ 60KB
**And** new components are lazy-loaded where possible (DevelopmentTracker, CompetitionFieldPreview, CompatibilityPreview)
**And** LCP < 2.5s on simulated 4G connection (Lighthouse)
**And** font loading uses `font-display: swap` (verified: no FOIT)
**And** the `dist/bundle-stats.html` visualizer shows no unexpected large additions

**Technical Notes:**

- Run `npx vite build` and check `dist/` output
- Open `dist/bundle-stats.html` (rollup-plugin-visualizer from Epic 14)
- Check if Recharts usage in ScoreBreakdownRadar increases vendor-charts chunk
- If over budget: identify candidates for lazy-loading or code splitting

**Prerequisites:** All previous epics complete

---

**Epic 30 Complete: Polish & Consistency**

Stories Created: 6
FR Coverage: FR-CN17 (accessibility), FR-CN18 (performance)
Technical Context: All component files, Lighthouse CI, bundle analysis
UX Patterns: UX §7 (Accessibility), §13 (Empty States), Pre-mortem risk prevention

---

## FR Coverage Matrix

| FR ID   | Requirement                                                                                                                         | Epic(s)        | Story(ies)                                            | Status     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- | ---------- |
| FR-CN1  | Complete Celestial Night theme across all 29 pages                                                                                  | 22, 30         | 22.1-22.7, 30.5                                       | ✅ Covered |
| FR-CN2  | 12 core game components in `components/ui/game/`; 12 shadcn files stripped to Radix skeletons                                       | 22             | 22.5, 22.6                                            | ✅ Covered |
| FR-CN3  | Cinzel/Inter font system                                                                                                            | 22             | 22.1                                                  | ✅ Covered |
| FR-CN4  | `.celestial` CSS class scoping + QA toggle                                                                                          | 22             | 22.2                                                  | ✅ Covered |
| FR-CN5  | Hub dashboard with NextActionsBar                                                                                                   | 23             | 23.1, 23.3                                            | ✅ Covered |
| FR-CN6  | WhileYouWereGone return overlay                                                                                                     | 24             | 24.1, 24.2, 24.3                                      | ✅ Covered |
| FR-CN7  | Server-seeded next actions                                                                                                          | 23             | 23.1, 23.4                                            | ✅ Covered |
| FR-CN8  | Competition model: 7-day windows + overnight execution                                                                              | BA             | BA.1-BA.4                                             | ✅ Covered |
| FR-CN9  | Foal development: 0-2yr lifecycle                                                                                                   | BB, 29         | BB.1-BB.4, 29.1-29.2                                  | ✅ Covered |
| FR-CN10 | CinematicMoment: lifetime-first only                                                                                                | BA, 27, 28, 29 | BA.5, 27.3, 28.3, 29.3                                | ✅ Covered |
| FR-CN11 | Onboarding rebuild with BreedSelector                                                                                               | 25             | 25.1-25.3                                             | ✅ Covered |
| FR-CN12 | Training flow with DisciplineSelector + CooldownTimer                                                                               | 26             | 26.1-26.3                                             | ✅ Covered |
| FR-CN13 | Competition flow with scouting + results                                                                                            | 27             | 27.1-27.4                                             | ✅ Covered |
| FR-CN14 | Breeding flow with CompatibilityPreview                                                                                             | 28             | 28.1-28.2                                             | ✅ Covered |
| FR-CN15 | Horse detail with stat bars + tabs + action bar (adult horses); foal detail integration                                             | 29             | 29.1 (foal detail), 29.4 (adult horse detail restyle) | ✅ Covered |
| FR-CN16 | Navigation: sidebar/hamburger/bottom nav, breadcrumbs, PageBackground integration                                                   | 22             | 22.8                                                  | ✅ Covered |
| FR-CN17 | WCAG 2.1 AA accessibility                                                                                                           | 30             | 30.5                                                  | ✅ Covered |
| FR-CN18 | Performance: < 400KB, LCP < 2.5s                                                                                                    | 30             | 30.6                                                  | ✅ Covered |
| FR-CN19 | Game Component Library: button.tsx restyled; 12 game components in components/ui/game/; 12 shadcn files stripped to Radix skeletons | 22             | 22.5, 22.6                                            | ✅ Covered |
| FR-CN20 | User.settings.milestones JSONB                                                                                                      | BA             | BA.5                                                  | ✅ Covered |

**Coverage: 20/20 FRs mapped to specific stories (100%)**

---

## Architecture Integration Validation

| Architecture Decision                      | Stories Implementing                     | Status |
| ------------------------------------------ | ---------------------------------------- | ------ |
| Feature-Flag Hybrid (.celestial CSS class) | 22.2                                     | ✅     |
| tokens.css design token system             | 22.1, 22.4, 22.5                         | ✅     |
| 18 backend domain modules structure        | BA.1-BA.5, BB.1-BB.4, 23.4, 24.1         | ✅     |
| Prisma/PostgreSQL schema updates           | BA.1 (Show lifecycle), BB.3 (milestones) | ✅     |
| API versioning (/api/v1/)                  | All backend stories                      | ✅     |
| React Query caching strategy               | 23.1, 23.3, 25.3, 27.1                   | ✅     |
| Lazy loading (React.lazy)                  | 30.6 (audit)                             | ✅     |
| Vitest + MSW testing                       | All component stories (test in AC)       | ✅     |
| Playwright E2E                             | 30.5 (accessibility flows)               | ✅     |

## UX Integration Validation

| UX Design Section                  | Stories Implementing                                                            | Status    |
| ---------------------------------- | ------------------------------------------------------------------------------- | --------- |
| §1 Design Tokens (colors, spacing) | 22.1-22.7                                                                       | ✅        |
| §3 Typography (Cinzel/Inter)       | 22.1                                                                            | ✅        |
| §5 Hub Dashboard                   | 23.1, 23.3                                                                      | ✅        |
| §6 NextActions + WYAG              | 23.4, 24.1-24.3                                                                 | ✅        |
| §7 Accessibility                   | 30.5                                                                            | ✅        |
| §10.1 Onboarding                   | 25.1-25.3                                                                       | ✅        |
| §10.3 Training                     | 26.1-26.3                                                                       | ✅        |
| §10.4 Competition                  | 27.1-27.4                                                                       | ✅        |
| §10.5 Breeding                     | 28.1-28.3                                                                       | ✅        |
| §10.6 Foal Development             | 29.1-29.3                                                                       | ✅        |
| §10.7 Horse Detail                 | 29.1 (foal detail)                                                              | ✅        |
| §10.8 Navigation                   | 22.7                                                                            | ✅        |
| §11.3 New Components               | 22.3-22.6, 23.1-23.2, 24.2, 25.1, 26.1-26.2, 27.1, 27.4, 28.1, 29.1, 30.1, 30.3 | ✅ All 13 |
| §12 CinematicMoment Policy         | 27.3, 28.3, 29.3                                                                | ✅        |
| §13 Empty States                   | 30.4                                                                            | ✅        |

## Story Quality Validation

| Check                                     | Result                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Each epic delivers user value?            | ✅ All 11 epics have clear user value statements                                     |
| All 20 FRs covered?                       | ✅ 20/20 (100%)                                                                      |
| Stories implement architecture decisions? | ✅ All ADRs from tech spec covered                                                   |
| Stories follow UX design patterns?        | ✅ All 14 UX sections mapped                                                         |
| Stories sized for single dev session?     | ✅ Max story is 22.6 (12 game components) — split into 3 sub-PRs in dependency order |
| No forward dependencies?                  | ✅ All prerequisites reference only prior stories/epics                              |
| Foundation enables all subsequent work?   | ✅ Epic 22 is the single entry point                                                 |
| Acceptance criteria are testable?         | ✅ BDD format with Given/When/Then throughout                                        |

---

## Summary

| Metric                    | Value                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total Epics**           | 11 (22-30 frontend + BACKEND-A + BACKEND-B)                                                                                                                                                                      |
| **Total Stories**         | 37 (+Story 22.8 navigation, +Story 29.4 adult horse detail)                                                                                                                                                      |
| **FR Coverage**           | 20/20 (100%)                                                                                                                                                                                                     |
| **New Components**        | 13 custom feature components + 12 game components (components/ui/game/) + PageBackground.tsx + SidebarNav.tsx + MobileNav.tsx + Breadcrumbs.tsx; button.tsx already live (gold standard confirmed on login page) |
| **New Backend Endpoints** | 5 (NextActions, WYAG, show create/browse/enter)                                                                                                                                                                  |
| **Schema Changes**        | 2 (Show lifecycle, milestones JSONB)                                                                                                                                                                             |
| **Parallelizable Epics**  | BACKEND-A, BACKEND-B, 25, 26, 28 (all only depend on Epic 22)                                                                                                                                                    |
| **Critical Path**         | Epic 22 → 23 → 24 (hub flow); Epic 22 + BA → 27 (competition); Epic 22 + BB → 29 (foal)                                                                                                                          |
| **Entry Point**           | Epic 22 (no dependencies)                                                                                                                                                                                        |
| **Final Gate**            | Epic 30 (a11y audit + bundle audit)                                                                                                                                                                              |

**Ready for Phase 4: Sprint Planning and Development Implementation**

---

_For implementation: Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown._
