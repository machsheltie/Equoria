# Story 7.3: Task Assignment UI

**Status:** completed
**Completed Date:** 2026-02-17
**FR:** FR-G3
**Epic:** 7 (Groom System)
**Priority:** P0

---

## User Story

As a **player**,
I want to **assign grooms to specific tasks**,
So that **my horses receive appropriate care**.

---

## Acceptance Criteria

### AC1: Grooms are assigned and begin work ✅

**Given** I have hired grooms and horses
**When** I assign tasks
**Then** grooms are assigned and begin work

- `GroomAssignmentCard` displays current groom assignment with all groom details
- Empty state shown when no groom assigned with "Assign Groom" button
- Button triggers the existing `AssignGroomModal` for groom selection
- Assignment shows groom name, skill level, personality, experience, bond score

### AC2: Tasks vary by horse age (foal enrichment, adult grooming) ✅

**And** tasks vary by horse age (foal enrichment, adult grooming)

- Age 0–2: Foal Enrichment tasks only (desensitization, trust_building, etc.)
- Age 1–3: Both Foal Enrichment + Foal Grooming (hoof_handling, tying_practice, etc.)
- Age 3: Foal Grooming + Adult Grooming overlap
- Age 3+: General Grooming tasks (brushing, bathing, stall_care, etc.)
- Age label displayed in panel header ("Under 1 year", "1 year old", "X years old")
- Task categories shown with icons: 🌱 Foal Enrichment, ✨ Foal Grooming, 🪮 Adult Grooming

### AC3: Task duration and effects are displayed ✅

**And** task duration and effects are displayed

- Each task card shows: name, duration badge (e.g. "30m", "1h"), effect chips
- Positive effects shown in green; neutral effects in gray
- Task description shown in full mode (hidden in compact mode)
- Mutual exclusivity note: "Only one enrichment or grooming task may be performed per day"
- Duration format: Xm for under 60min, Xh or Xh Ym for longer durations

### AC4: Can reassign grooms as needed ✅

**And** I can reassign grooms as needed

- "Change" button visible on current assignment card
- Button calls `onAssign` callback to trigger groom reassignment modal
- Empty state has "Assign Groom" button for initial assignment
- Primary assignment shown with amber "Primary" badge
- Assignment notes displayed when present

### AC5: Task completion notifications ✅

**And** task completion notifications

- `lastTaskCompletedAt` prop shows "Last task completed" notice with timestamp
- Notice styled with green background and CheckCircle icon
- Accessible `role="status"` for screen readers
- Notice only shown when a task has actually been completed (not always visible)

---

## Implementation

### Files

| File                                                    | Status      | Notes                                        |
| ------------------------------------------------------- | ----------- | -------------------------------------------- |
| `frontend/src/types/groomTasks.ts`                      | ✅ Complete | Task data, age thresholds, helper functions  |
| `frontend/src/components/groom/GroomTaskPanel.tsx`      | ✅ Complete | Age-based task display with effects/duration |
| `frontend/src/components/groom/GroomAssignmentCard.tsx` | ✅ Complete | Current assignment + reassign + task panel   |

### Tests

| Test File                                    | Tests | Status                           |
| -------------------------------------------- | ----- | -------------------------------- |
| `GroomTaskPanel.story-7-3.test.tsx`          | 54/54 | ✅ All passing                   |
| `GroomPersonalityDisplay.story-7-2.test.tsx` | 51/51 | ✅ Still passing (no regression) |
| `GroomHiringInterface.story-7-1.test.tsx`    | 25/25 | ✅ Still passing (no regression) |

**Total tests for Story 7-3:** 54 passing (130 combined with Stories 7-1 and 7-2)

---

## Completion Notes

- `groomTasks.ts`: 19 tasks across 3 categories, age thresholds mirror `backend/config/groomConfig.mjs`
- `GroomTaskPanel`: Pure display component — accepts `horseAge` and `compact` props
- `GroomAssignmentCard`: Composes `GroomPersonalityBadge`, `GroomTaskPanel`, and bond score bar
- `formatDuration`, `getTasksForAge`, `getTasksByCategory`, `getAvailableCategories` all tested inline
- Compact mode hides task descriptions and mutual exclusivity note (for use in tight layouts)
- Bond score bar uses color coding: green (70+), amber (40–69), red (<40)
- Task completion notifications use ISO timestamp — formatted via `toLocaleString` for display
