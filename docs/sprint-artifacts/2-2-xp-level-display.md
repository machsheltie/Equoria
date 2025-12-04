# Story 2.2: XP & Level Display

Status: in_progress

## Story

As a **player**,
I want to **see my current level and XP progress**,
so that **I understand my progression in the game**.

## Acceptance Criteria

1. **AC-1: Level Display**
   - Current level shown prominently
   - Level badge/icon with level number
   - Fantasy-themed styling consistent with app

2. **AC-2: XP Progress Bar**
   - Progress bar shows XP towards next level
   - Displays current XP / XP needed
   - Animated progress fill
   - Percentage shown

3. **AC-3: XP Calculations**
   - Level formula: `Math.floor(totalXP / 100) + 1`
   - XP for next level: `currentLevel * 100`
   - Progress %: `((totalXP % 100) / 100) * 100`
   - Handles edge cases (level 1, max level)

4. **AC-4: Level Up Notification** (P2 - Future)
   - Celebration animation on level up
   - Toast notification with new level

5. **AC-5: Loading & Error States**
   - Loading skeleton while fetching data
   - Graceful handling of missing XP data
   - Default to level 1 if no data

6. **AC-6: Integration**
   - Component displayed on ProfilePage
   - Reusable for Dashboard integration

## Tasks / Subtasks

- [x] **Task 1: Story File** (AC: Foundation)
  - [x] Create story file with acceptance criteria

- [ ] **Task 2: XP Calculation Utilities** (AC: 3)
  - [ ] Create `lib/xp-utils.ts` with calculation functions
  - [ ] Write unit tests for XP calculations

- [ ] **Task 3: XPLevelDisplay Component Tests** (AC: 1, 2, 5)
  - [ ] Create `components/__tests__/XPLevelDisplay.test.tsx`
  - [ ] Test level badge display
  - [ ] Test XP progress bar
  - [ ] Test loading state
  - [ ] Test edge cases

- [ ] **Task 4: XPLevelDisplay Component** (AC: 1, 2, 5)
  - [ ] Create `components/XPLevelDisplay.tsx`
  - [ ] Level badge with number
  - [ ] Animated progress bar
  - [ ] XP text display

- [ ] **Task 5: ProfilePage Integration** (AC: 6)
  - [ ] Add XPLevelDisplay to ProfilePage
  - [ ] Position appropriately in layout

## Dev Notes

### XP Calculation Formula

```typescript
// lib/xp-utils.ts
export function calculateLevel(totalXP: number): number {
  return Math.floor(totalXP / 100) + 1;
}

export function getXPForNextLevel(level: number): number {
  return level * 100;
}

export function getXPProgress(totalXP: number): number {
  return totalXP % 100;
}

export function getXPProgressPercent(totalXP: number): number {
  return ((totalXP % 100) / 100) * 100;
}
```

### Component Props

```typescript
interface XPLevelDisplayProps {
  level?: number;
  xp?: number;
  isLoading?: boolean;
  showLevelBadge?: boolean;
  showProgressText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

### References

- [Source: docs/epics.md#Story-2.2] - Story definition
- [Source: docs/archive/api-contracts-backend.md] - XP formula
- FR-U6: User level/XP progression system

## Dev Agent Record

### Context Reference

- docs/epics.md - Epic 2, Story 2.2 definition
- docs/sprint-artifacts/sprint-status.yaml - Sprint tracking
- frontend/src/hooks/useAuth.ts - User interface with level/xp

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

**To Create:**
- `frontend/src/lib/xp-utils.ts`
- `frontend/src/lib/__tests__/xp-utils.test.ts`
- `frontend/src/components/XPLevelDisplay.tsx`
- `frontend/src/components/__tests__/XPLevelDisplay.test.tsx`

**To Modify:**
- `frontend/src/pages/ProfilePage.tsx` - Add XPLevelDisplay
