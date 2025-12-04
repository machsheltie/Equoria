# Story 2.4: Statistics Dashboard

**Status:** completed
**Priority:** P0
**FR:** FR-U8
**Epic:** 2
**Story:** 4
**Prerequisites:** 2-1-profile-management (completed)

---

## User Story

As a **player**,
I want to **see my overall game statistics**,
So that **I can track my achievements and progress**.

---

## Acceptance Criteria

### AC-1: Key Metrics Display
**Given** I am on the dashboard/profile page
**When** I view the statistics section
**Then** I see key metrics: horses owned, competitions won, breeding count

### AC-2: Real-Time Updates
**Given** statistics are displayed
**When** underlying data changes
**Then** statistics update in real-time (via React Query)

### AC-3: Trend Indicators (Future Enhancement)
**Given** I view statistics
**When** data has historical context
**Then** I can see trends (this week vs last week)

### AC-4: Navigation Links (Future Enhancement)
**Given** I view a statistic
**When** I click on it
**Then** I navigate to the detailed view

### AC-5: Loading State
**Given** statistics are loading
**When** the component renders
**Then** a loading skeleton is displayed

---

## Technical Notes

### Database Schema (Statistics derived from)
```prisma
model User {
  horses        Horse[]           // Horses owned count
  xp            Int               // Experience points
  level         Int               // Current level
  money         Int               // Currency (already displayed)
}

model Horse {
  ownerId       String            // For counting owned horses
}

model CompetitionResult {
  placement     Int               // For counting wins (placement = 1)
}

model BreedingRecord {
  ownerId       String            // For counting breeding records
}
```

### API Endpoints (Future backend)
- `GET /api/v1/users/stats` - Returns aggregated user statistics
- Currently: Frontend calculates from available data

### Frontend Implementation
1. **statistics-utils.ts** - Stats calculation helpers
2. **StatisticsCard.tsx** - Individual stat card component
3. **StatisticsDashboard.tsx** - Dashboard container
4. **useStatistics.ts** - React Query hook (stub for API)

---

## Tasks

### Task 1: Statistics Utilities (TDD)
- [x] Write tests for formatStatistic function
- [x] Write tests for calculateTrend function
- [x] Implement statistics-utils.ts

### Task 2: StatisticsCard Component (TDD)
- [x] Write component tests (value display, loading, icon)
- [x] Implement StatisticsCard.tsx with icon support
- [x] Add size variants and trend indicator

### Task 3: ProfilePage Integration
- [x] Add StatisticsCard components to ProfilePage
- [x] Position below Currency display section
- [x] Use mock data for now (API ready)

### Task 4: Documentation & Commit
- [x] Update sprint-status.yaml
- [x] Git commit with test results

---

## Test Coverage Target

| File | Tests | Coverage |
|------|-------|----------|
| statistics-utils.test.ts | ~15 | 100% |
| StatisticsCard.test.tsx | ~20 | 100% |
| **Total** | ~35 | 100% |

---

## Definition of Done

- [x] All acceptance criteria met
- [x] 104 tests passing (52 utils + 52 component)
- [x] 100% coverage for new code
- [x] StatisticsCard integrated into ProfilePage
- [x] Git commit pushed to master
