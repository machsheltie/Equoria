# UX Implementation Roadmap

**Created:** 2026-03-11
**Input:** `docs/ux-design-specification.md` (complete, 14 steps, 2021 lines)
**Goal:** Transform the UX spec into implementable work via Tech Spec → Wireframes → Epics & Stories

---

## Phase 1: Frontend Tech Spec

**Workflow:** `/bmad:bmm:workflows:create-tech-spec`
**Depends on:** UX Design Spec (done)
**Estimated effort:** 1 session (conversational BMM workflow)

### What this produces

A technical architecture document covering HOW to implement the UX spec:

- [ ] **1.1 State Management Architecture** — What holds the hub-and-spoke state? React Query cache strategy for competitions (7-day entry windows), foal development (0-2yr tracker), cooldown timers. NextActionsBar suggestion engine data flow.
- [ ] **1.2 Component Architecture** — How the 13 new custom components (Section 11.3) compose with shadcn/Radix foundation. File structure, naming conventions, prop interfaces.
- [ ] **1.3 Design Token Implementation** — How `tokens.css` maps to Tailwind config. StarfieldBackground CSS-only approach. Cinzel/Inter font loading strategy.
- [ ] **1.4 API Integration Plan** — Which existing `/api/v1/` endpoints serve each journey. New endpoints needed (WhileYouWereGone data aggregation, NextActions suggestion engine, competition field scouting). WebSocket vs polling for cooldown timers.
- [ ] **1.5 Data Flow Architecture** — How competition results arrive (overnight execution → next login). How foal development milestones trigger CinematicMoment on return. How BreedSelector loads all breeds with stat tendencies.
- [ ] **1.6 Performance Budget** — Current: 321KB initial chunk. Target after adding StarfieldBackground, Cinzel font, 13 new components. Code splitting strategy for Phase 2/3 components.
- [ ] **1.7 Testing Strategy** — Vitest component tests for custom components. Playwright E2E for critical journey flows. MSW mocks for competition results, WYAG data, compatibility preview.
- [ ] **1.8 Migration Plan** — How to transition from current generic UI to Celestial Night without breaking existing functionality. Feature flag strategy for progressive rollout.

### Key decisions to make during this step

1. **WhileYouWereGone backend:** New aggregation endpoint or client-side assembly from multiple existing endpoints?
2. **NextActionsBar engine:** Server-side suggestion computation or client-side logic from cached data?
3. **Competition field data:** Real-time polling during 7-day window or fetch-on-view?
4. **CinematicMoment triggers:** Server sends "first-ever win" flag in results payload, or client tracks locally?
5. **Foal development tracker:** Existing `/api/foals/:id/development` sufficient, or need new milestone-aware endpoint?

---

## Phase 2: Wireframes

**Workflow:** `/bmad:bmm:workflows:create-excalidraw-wireframe` (or HTML/CSS like direction mockups)
**Depends on:** Phase 1 Tech Spec (component names, data flow, responsive breakpoints)
**Estimated effort:** 1-2 sessions

### Pages to wireframe (mobile + desktop for each)

#### Priority 1 — Hub & Core Loop

- [ ] **2.1 Hub Dashboard** — NextActionsBar, stable card grid with NarrativeChip, aside panel (desktop) / bottom sheet (mobile), CooldownTimer placements
- [ ] **2.2 WhileYouWereGone Overlay** — Prioritized item list, surprise element placement, dismiss interaction, 8-item layout

#### Priority 2 — Journey-Critical Pages

- [ ] **2.3 Onboarding Wizard** — BreedSelector layout (grid vs list toggle), gender selection, naming input with preview
- [ ] **2.4 Training Page** — Horse selector (eligible first), DisciplineSelector (top 5 recommendations + expandable), training result display
- [ ] **2.5 Competition Page** — Show browse (filters, closing dates), CompetitionFieldPreview (scouting view), entry confirmation, results page with ScoreBreakdownRadar
- [ ] **2.6 Breeding Page** — Bidirectional entry (mare/stallion/horse-detail), CompatibilityPreview (stat ranges + traits + pedigree tabs), cost breakdown, foal birth flow

#### Priority 3 — Depth & Detail

- [ ] **2.7 Horse Detail Page** — Tabbed sections (Stats, Pedigree, Health, Stud/Sale), bottom action bar, CareStatusStrip, DevelopmentTracker (for foals 0-2yr)
- [ ] **2.8 Foal Development Tracker** — Timeline view (desktop) vs card view (mobile), age-appropriate activity list, milestone history, trait status
- [ ] **2.9 Global Navigation** — Hamburger menu (mobile), top bar (coins + bell + avatar), breadcrumbs, StarfieldBackground integration

### Wireframe deliverables

- Desktop (1024px+) wireframe per page — shows aside panel, full grids, expanded previews
- Mobile (375px) wireframe per page — shows bottom sheet, single column, horizontal scroll bars
- Annotation notes: component names from Tech Spec, data sources, interactive states

---

## Phase 3: Epics & Stories

**Workflow:** `/bmad:bmm:workflows:create-epics-and-stories`
**Depends on:** Phase 1 Tech Spec + Phase 2 Wireframes
**Estimated effort:** 1-2 sessions

### Expected epic breakdown (preliminary — refined during workflow)

- [ ] **3.1 Epic 22: Celestial Night Foundation** — StarfieldBackground, design token migration (hex → CSS custom properties for ALL remaining files), Cinzel/Inter font loading, global body restyle, shadcn theme override
- [ ] **3.2 Epic 23: Hub & Daily Loop** — NextActionsBar, NarrativeChip, hub dashboard rebuild, aside panel / bottom sheet, Day-1 "Getting Started" mode
- [ ] **3.3 Epic 24: WhileYouWereGone** — Backend aggregation endpoint, overlay component, return detection (4hr threshold), priority sorting, surprise element system
- [ ] **3.4 Epic 25: Onboarding Rebuild** — BreedSelector component, onboarding wizard restyle to Celestial Night, breed preview with stat tendencies
- [ ] **3.5 Epic 26: Training Flow Redesign** — DisciplineSelector with recommendations, training result display, CooldownTimer integration, stat prediction preview
- [ ] **3.6 Epic 27: Competition Flow Redesign** — CompetitionFieldPreview (scouting), 7-day entry window UX, overnight results delivery, ScoreBreakdownRadar, personal best tracking
- [ ] **3.7 Epic 28: Breeding Flow Redesign** — CompatibilityPreview (stat ranges + traits + inbreeding + pedigree), bidirectional entry, cost breakdown, CinematicMoment scaling for repeat breeders
- [ ] **3.8 Epic 29: Foal Development Overhaul** — DevelopmentTracker (0-2yr timeline), age-appropriate activity system, milestone-based CinematicMoment triggers, graduation transition at age 3
- [ ] **3.9 Epic 30: Polish & Consistency** — GoldBorderFrame, ErrorCard, RewardToast (meaningful-only), button hierarchy enforcement, empty state illustrations, sound system (off by default)

### Story structure (each epic)

- Story per component (with acceptance criteria from UX spec Sections 11-13)
- Story per journey flow (with acceptance criteria from UX spec Section 10)
- Story per responsive breakpoint validation
- Story per accessibility audit checkpoint

---

## Dependency Graph

```
UX Design Spec (DONE)
  │
  ├──► Phase 1: Tech Spec
  │       │
  │       ├──► Phase 2: Wireframes
  │       │       │
  │       │       └──► Phase 3: Epics & Stories
  │       │               │
  │       │               └──► Implementation Sprints
  │       │
  │       └──► (informs wireframe component names & data flow)
  │
  └──► (referenced by all phases)
```

---

## Blockers & Notes

- **Beads DB corrupted:** `bd` commands fail due to orphaned labels + version 0.28.0 (latest: 0.59.0). Run `brew upgrade bd` or reinstall before creating issues for Phase 1-3 tasks.
- **Art assets:** BreedSelector needs breed preview images. Currently `placeholder.svg` exists as fallback. Owner (Heirr) creates art assets — no external dependency.
- **Competition model change:** PRD says instant simulation but UX spec corrects to player-created shows with 7-day windows + overnight execution. Tech spec must reconcile this with current backend implementation.
- **Foal development model change:** PRD says 6-day development but UX spec corrects to 0-2 years with age-evolving groom activities. Tech spec must reconcile with current backend.
- **Sound system:** OFF by default, opt-in. Needs Settings page toggle (Settings page exists from Epic 9B, toggle is new).

---

## Quick Start

When ready to begin:

```bash
# Phase 1 — run the BMM tech spec workflow
# Input: docs/ux-design-specification.md
/bmad:bmm:workflows:create-tech-spec

# Phase 2 — after tech spec is complete
/bmad:bmm:workflows:create-excalidraw-wireframe

# Phase 3 — after wireframes are complete
/bmad:bmm:workflows:create-epics-and-stories
```
