# Story 5.5: Leaderboards

**Created:** 2026-02-03
**Status:** completed
**Completed:** 2026-02-03
**Epic:** 5 - Competition System
**FR:** FR-C5
**Priority:** P1

---

## 📋 Story

As a **player**,
I want to **view leaderboards showing top performers**,
So that **I can compare my horses and achievements with other players**.

---

## ✅ Acceptance Criteria

**Given** I am viewing the leaderboards
**When** I select a leaderboard category
**Then** I see ranked lists of top performers

**And** I see multiple leaderboard types (Horse Level, Total Prize Money, Win Rate, Discipline-Specific)
**And** I can view my own ranking in each leaderboard
**And** I can filter by time period (All-Time, Monthly, Weekly, Daily)
**And** I can view detailed stats for top performers
**And** Leaderboards update in near real-time
**And** I can navigate between different leaderboard categories

---

## 🎯 Business Context

**Story Purpose:**
Display competitive rankings to encourage player engagement and provide social comparison. This completes the Competition System epic by adding competitive elements and community engagement features.

**Value Proposition:**
- **Engagement:** Players compete for top positions on leaderboards
- **Social:** Compare performance with other players
- **Strategy:** Identify top performers and learn from successful strategies
- **Retention:** Ongoing competition encourages continued participation

**Epic 5 Context:**
Story 5-5 builds upon:
- Story 5-1: Competition Entry (provides competition data)
- Story 5-2: Competition Results (provides performance metrics)
- Story 5-3: Prize Distribution (provides money/rewards data)
- Story 5-4: XP Awards (provides level/XP data)

---

## 🔧 Technical Requirements

### Core Functionality

**1. Leaderboard Categories**
- **Horse Level Leaderboard**: Top horses by level
- **Prize Money Leaderboard**: Top horses by total earnings
- **Win Rate Leaderboard**: Top horses by win percentage (min 10 competitions)
- **Discipline Leaderboards**: Top horses per discipline (23 disciplines)
- **Owner Leaderboard**: Top owners by total prize money
- **Recent Winners**: Latest competition winners (last 24 hours)

**2. Leaderboard Display**
- Ranked list (1-100) with pagination
- Display: Rank, Horse Name, Owner, Primary Stat
- Secondary stats: Level, Win Rate, Total Competitions, Prize Money
- User's horse highlighted in the list
- "Your Rank" indicator showing user's position
- Visual badges for top 3 positions (Gold/Silver/Bronze)
- Refresh button for manual updates

**3. Time Period Filters**
- **All-Time**: Complete historical data
- **Monthly**: Current month rankings
- **Weekly**: Current week rankings
- **Daily**: Today's rankings
- Filter persists in URL state
- Clear visual indication of selected period

**4. Horse Detail View from Leaderboard**
- Click on any horse to view detail modal
- Show horse stats, competition history, achievements
- Display owner information
- Link to horse profile page
- Option to challenge (future feature)

**5. User Rank Dashboard**
- Summary card showing user's ranks in all categories
- "Your Best Rankings" section
- Rank change indicators (↑ up, ↓ down, — unchanged)
- Historical rank tracking (future enhancement)

### API Integration

**Backend Endpoints:**
- `GET /api/leaderboards/:category` - Get leaderboard for category
- `GET /api/leaderboards/:category/user/:userId` - Get user's rank in category
- `GET /api/leaderboards/user-summary/:userId` - Get user's rankings across all categories

**Request Parameters:**
```typescript
interface LeaderboardParams {
  category: 'level' | 'prize-money' | 'win-rate' | 'discipline' | 'owner' | 'recent-winners';
  discipline?: string; // Required for discipline category
  period: 'all-time' | 'monthly' | 'weekly' | 'daily';
  page?: number; // Default: 1
  limit?: number; // Default: 50, Max: 100
}
```

**Response Data Structures:**

```typescript
interface LeaderboardEntry {
  rank: number;
  horseId?: number; // For horse leaderboards
  horseName?: string;
  ownerId: string;
  ownerName: string;
  primaryStat: number; // Level, money, win rate, etc.
  secondaryStats: {
    level?: number;
    totalCompetitions?: number;
    wins?: number;
    winRate?: number;
    totalPrizeMoney?: number;
  };
  isCurrentUser: boolean;
  rankChange?: number; // Positive = up, negative = down, 0 = no change
}

interface LeaderboardResponse {
  category: string;
  period: string;
  totalEntries: number;
  currentPage: number;
  totalPages: number;
  entries: LeaderboardEntry[];
  userRank?: {
    rank: number;
    entry: LeaderboardEntry;
  };
  lastUpdated: string;
}

interface UserRankSummary {
  userId: string;
  userName: string;
  rankings: {
    category: string;
    rank: number;
    totalEntries: number;
    rankChange: number;
    primaryStat: number;
  }[];
  bestRankings: {
    category: string;
    rank: number;
    achievement: string; // "Top 10", "Top 100", etc.
  }[];
}
```

---

## 📝 Implementation Tasks

### Task 1: Leaderboard Category Selector
**Priority:** P0 (Core feature)
**Target:** 20 tests

**File:** `LeaderboardCategorySelector.tsx` (CREATE)

**Activities:**
- Create category selector component
- Display leaderboard categories as tabs or buttons
- Show discipline selector for discipline leaderboards
- Implement time period filter (All-Time/Monthly/Weekly/Daily)
- Highlight selected category and period
- URL state persistence for category and period
- Responsive design (horizontal scroll on mobile)

**Acceptance Criteria:**
- [ ] All categories selectable
- [ ] Discipline selector appears for discipline category
- [ ] Time period filter works correctly
- [ ] URL state persists selections
- [ ] Active category highlighted
- [ ] Responsive on all devices
- [ ] 20 tests passing

### Task 2: Leaderboard Table Component
**Priority:** P0 (Core feature)
**Target:** 35 tests

**Files:**
- `LeaderboardTable.tsx` (CREATE)
- `LeaderboardEntry.tsx` (CREATE)
- `RankBadge.tsx` (CREATE)

**Activities:**
- Create leaderboard table component
- Display ranked entries with all stats
- Highlight user's horse in the list
- Create rank badge component (Gold/Silver/Bronze for top 3)
- Implement pagination
- Add rank change indicators (↑↓—)
- Show "Your Rank" sticky header when user scrolls past their entry
- Handle loading and error states

**Acceptance Criteria:**
- [ ] Table displays all entries
- [ ] User's entry highlighted
- [ ] Top 3 have special badges
- [ ] Pagination works correctly
- [ ] Rank change indicators displayed
- [ ] "Your Rank" sticky header works
- [ ] 35 tests passing

### Task 3: User Rank Dashboard
**Priority:** P1 (Enhanced feature)
**Target:** 25 tests

**Files:**
- `UserRankDashboard.tsx` (CREATE)
- `RankSummaryCard.tsx` (CREATE)

**Activities:**
- Create user rank dashboard component
- Display summary cards for each category
- Show user's rank and rank change for each leaderboard
- Create "Best Rankings" section
- Implement visual indicators for rank changes
- Add achievement badges (Top 10, Top 100, etc.)
- Link to full leaderboard for each category

**Acceptance Criteria:**
- [ ] Summary cards display all categories
- [ ] Rank changes shown with indicators
- [ ] "Best Rankings" section accurate
- [ ] Achievement badges displayed
- [ ] Links to full leaderboards work
- [ ] Empty state for new players
- [ ] 25 tests passing

### Task 4: Horse Detail Modal from Leaderboard
**Priority:** P1 (Enhanced feature)
**Target:** 20 tests

**File:** `LeaderboardHorseDetailModal.tsx` (CREATE)

**Activities:**
- Create horse detail modal
- Display horse stats and competition history
- Show owner information
- Display achievements and badges
- Link to full horse profile page
- Add comparison with user's horse (future)
- Implement responsive design

**Acceptance Criteria:**
- [ ] Modal opens from leaderboard entries
- [ ] Horse stats displayed correctly
- [ ] Competition history shown
- [ ] Owner information displayed
- [ ] Link to profile page works
- [ ] Responsive on all devices
- [ ] 20 tests passing

### Task 5: React Query Hooks for Leaderboards
**Priority:** P0 (Data layer)
**Target:** 30 tests

**Files:**
- `useLeaderboard.ts` (CREATE)
- `useUserRankSummary.ts` (CREATE)
- `useLeaderboardRefresh.ts` (CREATE)

**Activities:**
- Create `useLeaderboard(category, period, page)` hook
- Create `useUserRankSummary(userId)` hook
- Create `useLeaderboardRefresh()` hook for manual refresh
- Implement proper caching strategies (5 min staleTime)
- Add error handling for all hooks
- Implement optimistic updates for rank changes
- Set up cache invalidation on relevant mutations

**Acceptance Criteria:**
- [ ] All hooks functional
- [ ] Type-safe with TypeScript
- [ ] Caching works correctly (5 min staleTime)
- [ ] Error handling implemented
- [ ] Manual refresh works
- [ ] Cache invalidation correct
- [ ] 30 tests passing

### Task 6: Leaderboards Page Integration
**Priority:** P0 (Page component)
**Target:** 25 tests

**Files:**
- `LeaderboardsPage.tsx` (CREATE)
- `LeaderboardsPage.test.tsx` (CREATE)

**Activities:**
- Create leaderboards page component
- Integrate all leaderboard components
- Add navigation between categories
- Implement URL routing for categories and periods
- Add page header with title and description
- Create loading and error states
- Integrate with MSW for testing

**Acceptance Criteria:**
- [ ] Page displays correctly
- [ ] All components integrated
- [ ] Navigation works between categories
- [ ] URL routing functional
- [ ] Loading/error states work
- [ ] MSW handlers created
- [ ] 25 tests passing

### Task 7: MSW Handlers and Mock Data
**Priority:** P0 (Testing infrastructure)
**Target:** 15 tests

**Files:**
- `frontend/src/test/msw/handlers.ts` (MODIFY)
- `frontend/src/test/fixtures/leaderboards.ts` (CREATE)

**Activities:**
- Create leaderboard mock data fixtures
- Implement MSW handlers for all leaderboard endpoints
- Create realistic test data for all categories
- Add error scenario handlers
- Create user rank summary mock data
- Ensure mock data matches TypeScript interfaces

**Acceptance Criteria:**
- [ ] Mock data fixtures created
- [ ] All MSW handlers implemented
- [ ] Handlers match API contracts
- [ ] Error scenarios covered
- [ ] Test data realistic
- [ ] TypeScript types match
- [ ] 15 tests passing

### Task 8: Integration Testing and Documentation
**Priority:** P0 (Quality assurance)
**Target:** 20 tests

**Files:**
- `LeaderboardsIntegration.test.tsx` (CREATE)
- Update Story 5-5 completion notes

**Activities:**
- Create comprehensive integration tests
- Test complete leaderboard flow (category selection → view → user rank)
- Test time period filtering
- Test pagination
- Test URL state persistence
- Test error handling and edge cases
- Test accessibility (ARIA labels, keyboard navigation)
- Update story document with completion notes

**Acceptance Criteria:**
- [ ] Integration tests cover complete flows
- [ ] Category selection tested
- [ ] Time period filtering tested
- [ ] Pagination tested
- [ ] URL state persistence tested
- [ ] Accessibility verified
- [ ] All tests passing
- [ ] Story marked complete

---

## 📊 Test Coverage Summary

**Total Test Target:** 190+ tests

| Task | Component | Target Tests |
|------|-----------|--------------|
| 1 | LeaderboardCategorySelector | 20 |
| 2 | LeaderboardTable + Entry + RankBadge | 35 |
| 3 | UserRankDashboard + SummaryCard | 25 |
| 4 | LeaderboardHorseDetailModal | 20 |
| 5 | React Query hooks | 30 |
| 6 | LeaderboardsPage | 25 |
| 7 | MSW handlers and fixtures | 15 |
| 8 | Integration tests | 20 |
| **TOTAL** | **All components** | **190** |

---

## 🎨 Design Specifications

### Visual Design

**Leaderboard Categories:**
- Horizontal tab navigation on desktop
- Scrollable category selector on mobile
- Active category: Blue background (#3B82F6)
- Inactive categories: Gray background (#E5E7EB)

**Rank Badges:**
- 1st Place: Gold (#FFD700) with crown icon
- 2nd Place: Silver (#C0C0C0) with medal icon
- 3rd Place: Bronze (#CD7F32) with medal icon
- 4th-10th: Blue (#3B82F6)
- 11th+: Gray (#6B7280)

**User's Entry Highlight:**
- Background: Light blue (#DBEAFE)
- Border: 2px solid blue (#3B82F6)
- Bold font for user's name

**Rank Change Indicators:**
- Up: Green ↑ with +N positions
- Down: Red ↓ with -N positions
- No change: Gray —

### Responsive Design

**Desktop (≥1024px):**
- Full leaderboard table with all columns
- Category tabs horizontal
- 50 entries per page

**Tablet (768px - 1023px):**
- Condensed table (hide some secondary stats)
- Category tabs horizontal with scroll
- 25 entries per page

**Mobile (<768px):**
- Card-based layout instead of table
- Category selector with dropdown
- 20 entries per page
- Expandable details for each entry

---

## ♿ Accessibility Requirements

### WCAG 2.1 AA Compliance

**Keyboard Navigation:**
- Tab through all categories and entries
- Enter to select category
- Enter to open horse detail modal
- Escape to close modals
- Arrow keys to navigate table rows

**Screen Reader Support:**
- Announce current leaderboard category
- Announce user's rank when entering page
- Announce rank changes
- Announce pagination state
- Clear labels for all interactive elements

**Visual Accessibility:**
- Sufficient color contrast (4.5:1 minimum)
- Focus indicators on all interactive elements
- Non-color-dependent information (use icons + text)
- Readable font sizes (≥14px)

**ARIA Attributes:**
- `role="table"` on leaderboard table
- `role="tab"` on category selector
- `aria-current="page"` on active category
- `aria-label` on all buttons
- `aria-live="polite"` for rank updates

---

## 🔗 Integration Points

### Frontend Integration

**Navigation:**
- Add "Leaderboards" to main navigation menu
- Link from competition results page
- Link from horse profile pages
- Link from user dashboard

**Data Sources:**
- Competition results (Story 5-2)
- Prize money (Story 5-3)
- XP/Levels (Story 5-4)
- Horse stats (Epic 3)

**State Management:**
- URL state for category and period
- React Query for leaderboard data
- localStorage for user preferences (default category)

### Backend Integration (API Contracts)

**Required Endpoints:**
1. `GET /api/leaderboards/:category`
2. `GET /api/leaderboards/:category/user/:userId`
3. `GET /api/leaderboards/user-summary/:userId`

**Data Requirements:**
- Real-time or near real-time updates (max 5 min delay)
- Efficient ranking queries (indexed database columns)
- Pagination support for large leaderboards
- User rank calculation even if not in top 100

---

## 🚀 Implementation Strategy

### Development Approach: TDD + Frontend-First

**Phase 1: Setup and Infrastructure (Tasks 1, 5, 7)**
1. Create TypeScript interfaces and types
2. Create MSW handlers and mock data
3. Implement React Query hooks
4. Create category selector

**Phase 2: Core Components (Tasks 2, 3, 4)**
1. Build leaderboard table with pagination
2. Build user rank dashboard
3. Build horse detail modal

**Phase 3: Integration and Testing (Tasks 6, 8)**
1. Create leaderboards page
2. Integrate all components
3. Comprehensive integration testing
4. Accessibility verification

**Phase 4: Backend Integration (Future Sprint)**
1. Connect to real API endpoints
2. Implement caching strategies
3. Add real-time updates
4. Performance optimization

---

## 📋 Definition of Done

- [ ] All 8 tasks completed
- [ ] 190+ tests passing (100% pass rate)
- [ ] Full frontend test suite still passing
- [ ] All acceptance criteria met
- [ ] WCAG 2.1 AA compliance verified
- [ ] Responsive design on mobile/tablet/desktop
- [ ] MSW handlers for all endpoints
- [ ] TypeScript strict mode (zero errors)
- [ ] ESLint clean (zero errors/warnings)
- [ ] Integration tests passing
- [ ] Story marked complete in sprint-status.yaml
- [ ] Git commit with completion notes

---

## 🔮 Future Enhancements (Not in Scope)

- Historical rank tracking (rank over time graph)
- Challenge system (challenge top-ranked horses)
- Leaderboard achievements and badges
- Social features (follow top players)
- Customizable leaderboard views
- Export leaderboard data
- Clan/Guild leaderboards
- Regional leaderboards
- Seasonal leaderboards with resets

---

## 📚 References

**Related Stories:**
- Story 5-1: Competition Entry
- Story 5-2: Competition Results
- Story 5-3: Prize Distribution Display
- Story 5-4: XP Award Notifications

**Design Patterns:**
- Story 4-5: Training Dashboard (table patterns)
- Story 3-1: Horse List View (list/grid patterns)
- Epic 2: Statistics Dashboard (dashboard patterns)

**Technical Docs:**
- `docs/patterns/testing-patterns.md`
- `docs/patterns/form-patterns.md`
- `docs/api-contracts-backend/competition-endpoints.md`

---

## Story 5.5 COMPLETE - Leaderboards

**Completed:** 2026-02-03

### Implementation Summary

- **Components Created:** 9 (LeaderboardCategorySelector, LeaderboardTable, LeaderboardEntry, RankBadge, UserRankDashboard, RankSummaryCard, LeaderboardHorseDetailModal, LeaderboardsPage, leaderboards API client)
- **Hooks Created:** 3 (useLeaderboard, useUserRankSummary, useLeaderboardRefresh)
- **Tests Implemented:** 217 (exceeds 190+ target by 14%)
- **Test Pass Rate:** 100% (217/217)
- **Full Frontend Suite:** 3,680 tests passing (35 pre-existing failures in other stories)

### Features Delivered

**Leaderboard Categories:**
- Horse Level leaderboard with level rankings
- Prize Money leaderboard with earnings rankings
- Win Rate leaderboard with win percentage
- Discipline-specific leaderboards (23 disciplines)
- Owner leaderboard with stable rankings
- Recent Winners leaderboard (last 24 hours)

**User Experience:**
- User rank dashboard showing all rankings
- Category/period filters with URL persistence
- Pagination with URL sync
- Horse detail modal with full stats
- Rank change indicators (up/down/unchanged)
- Achievement badges (Top 10, Top 100)
- Responsive design (mobile/tablet/desktop)

**Technical Implementation:**
- React Query hooks with 5-minute caching
- URL state management via useSearchParams
- MSW handlers for all endpoints
- Comprehensive mock data fixtures
- WCAG 2.1 AA accessibility compliance
- TypeScript strict mode (zero errors)

### Test Coverage Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | LeaderboardCategorySelector | 22 |
| 2 | LeaderboardTable + Entry + RankBadge | 46 |
| 3 | UserRankDashboard + SummaryCard | 35 |
| 4 | LeaderboardHorseDetailModal | 20 |
| 5 | React Query hooks + API layer | 34 |
| 6 | LeaderboardsPage | 25 |
| 7 | MSW handlers + fixtures | 15 |
| 8 | Integration tests | 20 |
| **TOTAL** | **All components** | **217** |

### Quality Metrics

- All acceptance criteria met
- WCAG 2.1 AA compliant
- Responsive design verified
- TypeScript strict mode
- ESLint clean (zero errors/warnings)
- 100% test pass rate
- Zero regressions

### Integration Points

- Integrated into main navigation
- AuthContext for user identification
- React Router for navigation
- MSW for testing infrastructure
- Links to HorseDetailPage

### Integration Test Scenarios (Task 8)

| Scenario | Tests | Description |
|----------|-------|-------------|
| Category Selection Flow | 5 | Default load, category switch, discipline selector, period switch, multi-filter |
| Pagination Flow | 3 | Next page, back to page 1, disabled prev on page 1 |
| Horse Detail Modal Flow | 4 | Open modal, display details, view full profile, close modal |
| User Rankings Dashboard | 3 | Dashboard display, best rankings, card click navigation |
| URL State Persistence | 3 | Category from URL, period from URL, page from URL |
| Error Handling | 2 | Network error display, retry after error |

### Next Steps

- Backend API implementation (future sprint)
- Real-time leaderboard updates
- Historical rank tracking
- Challenge system integration
- Achievement system expansion
