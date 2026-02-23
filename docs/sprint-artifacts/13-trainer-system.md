# Epic 13: Trainer System

**Status:** Complete (Stories 13-1 through 13-4; 13-5 deferred)
**Completed:** 2026-02-23
**Branch:** cleanup-session-2026-01-30

---

## Overview

Third and final staff pillar following the identical **Hire → Assign → Discover → Retire** pattern
as Grooms (Epic 7) and Riders (Epic 9C).

Trainers are hired from a marketplace, assigned to horses to boost training session results, and
their hidden specializations are progressively revealed through training activity.

All pages use the **Celestial Night** theme consistent with other World sub-locations.

Story 13-5 (Wire to Live API) is deferred — no `/api/trainers/*` backend routes exist yet.
All data uses `MOCK_*` constants clearly labelled for replacement.

---

## New Files

### `frontend/src/pages/TrainersPage.tsx`

- Route: `/trainers`
- Two-tab layout: Manage Trainers / Hire Trainers
- Breadcrumb: World → Trainers
- ArrowLeft back button to `/world`
- Tab testids: `data-testid="manage-tab"`, `data-testid="hire-tab"`
- Info panel listing trainer system rules

---

### `frontend/src/components/TrainerList.tsx` (Story 13-1)

- Marketplace interface at the "Hire" tab
- `MOCK_AVAILABLE_TRAINERS` — 6 trainers (labelled for `/api/trainers/marketplace`)
- Three skill levels: `novice` | `developing` | `expert`
  - Novice: stats hidden, cheap
  - Developing: some specializations revealed
  - Expert: all specializations visible
- Filter controls: skill level, personality, sort (`data-testid="trainer-filters"`)
- Trainer cards: `data-testid="trainer-card-{id}"`
- **Hire buttons disabled** — pending auth wire-up (Story 13-5) — `data-testid="hire-button-{id}"`
- "Level = Information, not quality" transparency note

---

### `frontend/src/components/MyTrainersDashboard.tsx` (Story 13-2)

- Management dashboard at the "Manage" tab
- `MOCK_MY_TRAINERS` — 2 hired trainers (labelled for `/api/trainers/user/:userId`)
- `MOCK_ASSIGNMENTS` — 3 assignments (labelled for `/api/trainers/assignments`)
- Slot counter: "N of 4 trainer slots used" with dot indicators
- Warning: unassigned trainers highlighted in amber
- Trainer cards: `data-testid="trainer-card-{id}"`
  - Quick stats: Level, Sessions, Career Weeks
  - Assignment list with `TrainerAssignmentCard`
  - **Assign button disabled** — `data-testid="assign-button-{id}"`
  - Expandable section: Career / Discovery — `data-testid="expand-toggle-{id}"`

---

### `frontend/src/components/trainer/` (Sub-components)

#### `TrainerPersonalityBadge.tsx` (Story 13-1)

- 5 personality types: `focused` 🎯, `encouraging` 💪, `technical` ⚙️, `competitive` 🏆, `patient` 🌿
- Coloured chip with icon + label
- `data-testid="trainer-personality-badge"`
- Exported: `TRAINER_PERSONALITIES`, `getTrainerPersonalityInfo()`

#### `TrainerPersonalityDisplay.tsx` (Story 13-1)

- Full personality breakdown (compact + full modes)
- Discipline Tendencies per personality (5 disciplines each)
- Horse Temperament Compatibility (4 temperaments each)
- Level 5+ unlocks veteran note
- `data-testid="trainer-personality-display"`

#### `TrainerAssignmentCard.tsx` (Story 13-2)

- Compact card showing assigned horse + start date
- Trash icon unassign button (disabled pending auth)
- `data-testid="assignment-card-{id}"`

#### `TrainerCareerPanel.tsx` (Story 13-4)

- XP/level progress bar using same formula as Grooms/Riders:
  `XP at level L start = 100 * L * (L-1) / 2`
- Career stats: Sessions, Horses Trained, Career Weeks
- Retirement: mandatory at 80w, warning at 72w
- Legacy certification eligible at Level 7+
- 7 career milestones (hired → first session → L3 → 12w → L6 → 50 sessions → L9)
- `data-testid="trainer-career-panel"`, `data-testid="xp-progress-bar"`

#### `TrainerDiscoveryPanel.tsx` (Story 13-3)

- 3 discovery categories × 2 slots each = 6 total hidden traits:
  - 🏆 Discipline Specialization (which disciplines they secretly excel at)
  - 📋 Training Method (how they structure sessions)
  - 🐴 Horse Compatibility (which temperaments they click with)
- Undiscovered slots show "?" placeholder
- `buildEmptyTrainerDiscoveryProfile(trainerId)` helper
- `data-testid="trainer-discovery-panel"`

---

## Modified Files

### `frontend/src/nav-items.tsx`

- Added `TrainersPage` import under "Epic 13 — Trainer System"
- Added route entry: `{ title: 'Trainers', to: '/trainers', icon: null, page: <TrainersPage /> }`
- `icon: null` — World sub-location only (not in main nav bar)

### `frontend/src/pages/WorldHubPage.tsx`

- Added 9th location card: **Trainers** (`id: 'trainers'`)
  - Icon: 🎓, href: `/trainers`
  - Violet accent: `border-violet-400/40`

---

## Acceptance Criteria Status

- [x] `/trainers` renders with Manage / Hire tabs
- [x] Hire tab shows 6 mock trainers with personality badges and skill levels
- [x] Filter controls for skill level, personality, sort
- [x] Hire buttons visible but disabled (pending auth)
- [x] "Level = visibility, not quality" transparency note displayed
- [x] Manage tab shows 2 hired trainers with assignment cards
- [x] Expandable career section shows XP bar and milestones
- [x] Expandable discovery section shows 3 categories × 2 undiscovered slots
- [x] TrainerPersonalityBadge: 5 personalities with distinct colours
- [x] TrainerPersonalityDisplay: discipline tendencies + horse compatibility
- [x] TrainerCareerPanel: retirement warning at 72w+, legacy badge at L7+
- [x] Trainers location card added to WorldHubPage (9th location)
- [x] `/trainers` route registered in nav-items.tsx (icon: null)
- [x] Breadcrumb: World → Trainers with ArrowLeft back button
- [x] TypeScript: 0 new errors in Epic 13 files
- [x] ESLint: 0 errors/warnings in all Epic 13 files

---

## Notes

- Story 13-5 (Wire to API) deferred — no backend `/api/trainers/*` routes yet
- `MOCK_AVAILABLE_TRAINERS` labelled for `/api/trainers/marketplace` replacement
- `MOCK_MY_TRAINERS` labelled for `/api/trainers/user/:userId` replacement
- `MOCK_ASSIGNMENTS` labelled for `/api/trainers/assignments` replacement
- All hire/assign/unassign buttons disabled with `title="Sign in to..."` tooltips
- XP formula identical to Grooms + Riders: `100 * L * (L-1) / 2`
- Retirement mechanics: mandatory 80w (shorter than Riders 104w), warning 8w before
- Legacy threshold: Level 7 (same as Grooms/Riders)
- Discovery: 6 slots across 3 categories (same total as Riders)
- Celestial Night theme: `celestial-gold`, `bg-white/5`, `border-white/10`, `text-white/70`
