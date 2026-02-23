# Epic 9C: Rider System

**Status:** Complete
**Completed:** 2026-02-23
**Branch:** cleanup-session-2026-01-30

---

## Overview

Rider System frontend for Equoria — mirrors the Groom system (Epic 7) and follows the
"Hire → Assign → Discover → Retire" staff pattern. Riders must be assigned before a horse
can enter competitions. Competing reveals hidden affinities through a progressive discovery
system.

**Design philosophy:** Level = Visibility, not Quality. A rookie rider may secretly excel.

---

## Stories

### 9C-1: Rider Type System & Personality Framework

- 4 personality types: `daring`, `methodical`, `intuitive`, `competitive`
- 3 skill levels with progressive stat visibility: `rookie` (hidden), `developing` (partial), `experienced` (full)
- `RIDER_PERSONALITY_DATA` record with display metadata, discipline affinities, temperament compatibility
- Helper functions: `getRiderPersonalityInfo()`, `riderCompatibilityLabel()`, `riderCompatibilityColorClass()`

**Files:**

- `frontend/src/types/riderPersonality.ts`
- `frontend/src/components/rider/RiderPersonalityBadge.tsx`
- `frontend/src/components/rider/RiderPersonalityDisplay.tsx`

---

### 9C-2: Rider Dashboard & Assignment Management

- Slot counter with pip visualization ("3 of 5 rider slots used")
- Rider cards: level, wins, career weeks quick stats
- Expandable Career & Discovery section tabs per card
- Warning banners: unassigned riders, approaching retirement
- `AssignRiderModal` for assigning riders to horses

**Files:**

- `frontend/src/components/MyRidersDashboard.tsx`
- `frontend/src/components/AssignRiderModal.tsx`
- `frontend/src/components/rider/RiderAssignmentCard.tsx`

---

### 9C-3: Career Lifecycle & Discovery Panels

- XP/level progress bar with milestone checklist
- Retirement warning at < 3 weeks remaining (mandatory at 104w)
- Legacy contract badge (prestige ≥ 80 or wins ≥ 50)
- 3 discovery categories: Discipline Affinities, Temperament Compatibility, Gait Affinity
- 6 total discovery slots (2 per category), revealed progressively through competition

**Files:**

- `frontend/src/types/riderCareer.ts`
- `frontend/src/types/riderDiscovery.ts`
- `frontend/src/components/rider/RiderCareerPanel.tsx`
- `frontend/src/components/rider/RiderDiscoveryPanel.tsx`

---

### 9C-4: Rider Marketplace (Hire Tab)

- Marketplace listing with personality + skill level filters
- 4-week upfront cost calculation per hire
- Known affinities visible only for `experienced` riders
- Low balance warning, empty state with retry button
- Mirrors GroomList.tsx pattern

**Files:**

- `frontend/src/components/RiderList.tsx`
- `frontend/src/pages/RidersPage.tsx`

---

### 9C-5: Wire Rider Hooks to Live API

**Status: Deferred** — Backend rider endpoints do not yet exist.
Only `riderBonus.mjs` utility exists on backend; no `/api/riders/*` routes.
Frontend is built with mock-ready hooks pointing at expected API paths.

---

## API Hooks & Types

**Files:**

- `frontend/src/hooks/api/useRiders.ts` — query/mutation hooks
- `frontend/src/lib/api-client.ts` — `ridersApi` export + Rider interfaces added

**API paths (expected, not yet implemented):**

```
GET  /api/riders/user/:userId
GET  /api/riders/assignments
GET  /api/riders/marketplace
POST /api/riders/marketplace/hire
POST /api/riders/marketplace/refresh
POST /api/riders/assignments
DELETE /api/riders/assignments/:id
GET  /api/riders/:id/discovery
```

---

## Navigation Integration

- `/riders` route added to `nav-items.tsx`
- `MainNavigation.tsx` Riders link added
- `WorldHubPage.tsx` Riders card `href` updated from `/competitions` → `/riders`

---

## Key Constants

```typescript
MANDATORY_RETIREMENT_WEEKS = 104
RETIREMENT_NOTICE_WEEKS = 3
LEVEL_CAP = 10
XP per level: 100 * level * (level - 1) / 2  // mirrors groom formula
LEGACY_THRESHOLD: prestige >= 80 || wins >= 50
RIDER_SLOT_CAP = 5 (default)
```

---

## Acceptance Criteria Status

- [x] `/riders` route renders `RidersPage`
- [x] World Hub Riders card links to `/riders`
- [x] Hire / Manage tab toggle with `role="tablist"`
- [x] RiderList shows marketplace with filter + sort
- [x] Hire flow calculates 4-week upfront cost
- [x] MyRidersDashboard shows slot counter, warning banners
- [x] Rider cards show personality badge, level, wins, career weeks
- [x] Expandable Career panel with XP progress + milestones
- [x] Expandable Discovery panel with 6 slots across 3 categories
- [x] AssignRiderModal lists unassigned riders with confirm/cancel
- [x] TypeScript: 0 errors in rider files
- [x] ESLint: 0 errors/warnings in rider files

---

## Notes

- No backend exists yet for riders — this is forward-looking UI
- Beads tracker broken (DB-JSONL mismatch) during this session; used Task tool instead
- All Celestial Night theme tokens used consistently (no parchment/forest-green)
