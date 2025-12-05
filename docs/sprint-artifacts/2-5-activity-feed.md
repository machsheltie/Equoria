# Story 2.5: Activity Feed

**Status:** completed
**Completed Date:** 2025-12-05
**Priority:** P0
**FR:** FR-U8
**Epic:** 2
**Story:** 5
**Prerequisites:** 2-4-statistics-dashboard (completed)

---

## User Story

As a **player**,
I want to **see my recent game activities**,
So that **I can track what I've been doing and stay engaged**.

---

## Acceptance Criteria

### AC-1: Activity List Display
**Given** I am on the dashboard/profile page
**When** I view the activity feed section
**Then** I see a list of my recent activities with icons and timestamps

### AC-2: Activity Types
**Given** activities are displayed
**When** I look at each activity
**Then** I can distinguish between types (breeding, training, competition, purchase, achievement)

### AC-3: Time Formatting
**Given** activities have timestamps
**When** I view an activity
**Then** I see human-readable relative time (e.g., "2 hours ago", "Yesterday")

### AC-4: Loading State
**Given** activities are loading
**When** the component renders
**Then** a loading skeleton is displayed

### AC-5: Empty State
**Given** I have no recent activities
**When** the activity feed loads
**Then** I see a friendly empty state message

### AC-6: Activity Icon Mapping (Future Enhancement)
**Given** each activity type
**When** displayed
**Then** appropriate icon is shown (trophy for competition, heart for breeding, etc.)

---

## Technical Notes

### Database Schema (Activity derived from)
```prisma
model User {
  horses        Horse[]           // Breeding activities
  // Training sessions would be tracked
  // Competition results would be tracked
}

// Activities are aggregated from multiple sources
// Backend endpoint will aggregate these into activity feed
```

### Activity Types
```typescript
enum ActivityType {
  BREEDING = 'breeding',
  TRAINING = 'training',
  COMPETITION = 'competition',
  PURCHASE = 'purchase',
  ACHIEVEMENT = 'achievement',
  LEVEL_UP = 'level_up',
}
```

### API Endpoints (Future backend)
- `GET /api/v1/users/activities` - Returns paginated activity feed
- Currently: Frontend uses mock data

### Frontend Implementation
1. **activity-utils.ts** - Time formatting, activity type helpers
2. **ActivityFeedItem.tsx** - Individual activity item component
3. **ActivityFeed.tsx** - Activity feed container with list
4. **useActivities.ts** - React Query hook (stub for API)

---

## Tasks

### Task 1: Activity Utilities (TDD) ✅
- [x] Write tests for formatRelativeTime function
- [x] Write tests for getActivityIcon function
- [x] Write tests for getActivityLabel function
- [x] Implement activity-utils.ts

### Task 2: ActivityFeedItem Component (TDD) ✅
- [x] Write component tests (activity display, icon, timestamp)
- [x] Implement ActivityFeedItem.tsx with icon support
- [x] Add activity type styling

### Task 3: ActivityFeed Component (TDD) ✅
- [x] Write container tests (list rendering, loading, empty state)
- [x] Implement ActivityFeed.tsx with list
- [x] Add loading skeleton and empty state

### Task 4: ProfilePage Integration ✅
- [x] Add ActivityFeed component to ProfilePage
- [x] Position below Statistics Dashboard section
- [x] Use mock data for now (API ready)

### Task 5: Documentation & Commit ✅
- [x] Update sprint-status.yaml
- [x] Git commit with test results

---

## Test Coverage Achieved

| File | Tests | Coverage |
|------|-------|----------|
| activity-utils.test.ts | 60 | 100% |
| ActivityFeedItem.test.tsx | 36 | 100% |
| ActivityFeed.test.tsx | 31 | 100% |
| **Total** | **127** | 100% |

---

## Definition of Done

- [x] All acceptance criteria met
- [x] 127 tests passing (exceeded target of 50)
- [x] 100% coverage for new code
- [x] ActivityFeed integrated into ProfilePage
- [x] Git commit pushed to master
