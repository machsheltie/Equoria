# Story 4.5: Training Dashboard

**Created:** 2026-01-30
**Status:** ready-for-dev
**Epic:** 4 - Training System
**FR:** FR-T5
**Priority:** P1

---

## 📋 Story

As a **player**,
I want to **see a training overview for all my horses**,
So that **I can efficiently manage training schedules**.

---

## ✅ Acceptance Criteria

**Given** I am on the training dashboard
**When** the page loads
**Then** I see all horses with training status at a glance

**And** dashboard shows: ready to train, in cooldown, ineligible
**And** quick-train buttons for eligible horses
**And** bulk training recommendations
**And** weekly training calendar view

---

## 🎯 Business Context

**Story Purpose:**
Create a comprehensive training management dashboard that consolidates all training-related functionality from Stories 4.1-4.4 into a unified command center. This dashboard enables players to:
- Quickly identify which horses are ready for training
- See cooldown timers at a glance
- Access quick-train actions without navigating to individual horse pages
- Understand their overall training capacity across the stable
- Make strategic training decisions based on comprehensive data

**Value Proposition:**
- **Efficiency:** Reduces clicks/navigation time by 80% for training management
- **Strategy:** Enables informed decision-making with at-a-glance status
- **Engagement:** Creates a central hub that encourages regular training activity
- **Retention:** Reduces friction in core gameplay loop

**Epic 4 Completion:**
This is the final story in Epic 4. Upon completion, Epic 4 (Training System) will be 100% complete with all 5 stories delivered.

---

## 🔧 Technical Requirements

### Core Functionality

**Dashboard Components:**
1. **Training Status Overview**
   - Summary cards: Ready (count), Cooldown (count), Ineligible (count)
   - Percentage breakdown of stable training capacity
   - Visual status indicators (green/yellow/red)

2. **Horse List View**
   - Filterable by status (ready/cooldown/ineligible)
   - Sortable by: name, age, next available training, discipline scores
   - Each horse card shows:
     - Name, age, thumbnail
     - Training status with icon
     - Cooldown countdown (if applicable)
     - Quick-train button (if eligible)
     - Link to full horse detail page

3. **Quick-Train Modal**
   - Discipline selector (reuses DisciplineSelector from 4.1)
   - Trait modifiers display (reuses TraitModifierList from 4.4)
   - Expected score gain
   - Confirm/Cancel actions
   - Success notification with updated cooldown

4. **Bulk Training Recommendations**
   - Algorithm suggests optimal training schedule
   - Shows "Train Now" horses with discipline recommendations
   - "Train Soon" horses with countdown
   - "Next Week" horses organized by availability

5. **Weekly Calendar View (P2 - Nice to have)**
   - 7-day training schedule
   - Visual timeline of cooldowns
   - Drag-drop to plan future sessions (frontend only, no backend)

### API Integration

**Endpoints to Use:**
- `GET /api/v1/training/dashboard` - Get all horses with training status
- `POST /api/v1/training/sessions` - Quick-train action (existing endpoint)
- `GET /api/v1/horses/:id/training-history` - For detail tooltips

**Data Structures:**
```typescript
interface TrainingDashboardData {
  summary: {
    readyCount: number;
    cooldownCount: number;
    ineligibleCount: number;
    totalHorses: number;
  };
  horses: DashboardHorse[];
  recommendations: TrainingRecommendation[];
}

interface DashboardHorse {
  id: number;
  name: string;
  age: number;
  thumbnail?: string;
  trainingStatus: 'ready' | 'cooldown' | 'ineligible';
  statusReason?: string; // "Too young", "Too old", "7-day cooldown active"
  cooldownEndsAt?: string; // ISO timestamp
  nextAvailableTraining?: string; // Formatted date
  topDisciplines: {
    disciplineId: string;
    score: number;
  }[];
  traits: string[]; // For trait modifier preview
}

interface TrainingRecommendation {
  horseId: number;
  horseName: string;
  recommendedDiscipline: string;
  reason: string; // "Low score, high potential", "Trait bonus available", etc.
  priority: 'high' | 'medium' | 'low';
}
```

---

## 🏗️ Architecture Compliance

### Frontend Architecture (React 19 + TypeScript)

**Component Hierarchy:**
```
TrainingDashboardPage.tsx (Page)
├── TrainingSummaryCards.tsx (NEW - Status summary)
├── TrainingDashboardTable.tsx (NEW - Main horse list)
│   ├── DashboardHorseCard.tsx (NEW - Individual horse card)
│   │   ├── EligibilityIndicator.tsx (REUSE from 4.2)
│   │   ├── QuickTrainButton.tsx (NEW - Quick action)
│   │   └── CooldownCountdown.tsx (NEW - Timer display)
│   └── DashboardFilters.tsx (NEW - Status filters)
├── QuickTrainModal.tsx (NEW - Inline training)
│   ├── DisciplineSelector.tsx (REUSE from 4.1)
│   ├── TraitModifierList.tsx (REUSE from 4.4)
│   └── TrainingSessionModal.tsx patterns (REUSE logic from 4.1)
└── TrainingRecommendations.tsx (NEW - AI suggestions)
```

**State Management:**
- React Query for server state (dashboard data, training actions)
- Local state (useState) for filters, modals
- useMemo for computed values (filtered horses, summary stats)

**Responsive Design:**
- Mobile: Single column card layout
- Tablet: 2-column grid
- Desktop: Table view with expandable details

**Accessibility:**
- WCAG 2.1 AA compliance
- Keyboard navigation for all actions
- Screen reader announcements for status changes
- Focus management for modals

---

## 📚 Library & Framework Requirements

### Core Dependencies (Already in Project)
- **React 19** - Component framework
- **TypeScript** - Type safety
- **React Query (TanStack Query)** - Server state management
- **React Router v6** - Navigation
- **TailwindCSS 3.4** - Styling
- **Lucide React** - Icons
- **Vitest + React Testing Library** - Testing

### No New Dependencies Required
All functionality can be built with existing dependencies. Component patterns established in Stories 4.1-4.4 provide everything needed.

### Icon Usage (Lucide React)
```typescript
import {
  CheckCircle2,  // Ready status
  Clock,          // Cooldown status
  XCircle,        // Ineligible status
  Calendar,       // Calendar view
  Zap,            // Quick-train button
  Filter,         // Filter controls
  TrendingUp,     // Recommendations
  AlertCircle     // Warnings
} from 'lucide-react';
```

---

## 📁 File Structure Requirements

### Files to CREATE (10 new files)

**Pages:**
1. `frontend/src/pages/TrainingDashboardPage.tsx`
   - Main dashboard page component
   - Integrates all sub-components
   - Handles routing and data fetching

**Components:**
2. `frontend/src/components/training/TrainingSummaryCards.tsx`
   - Status summary (Ready/Cooldown/Ineligible counts)
   - Visual status indicators
   - Percentage calculations

3. `frontend/src/components/training/TrainingDashboardTable.tsx`
   - Main horse list display
   - Filtering and sorting logic
   - Responsive table/card toggle

4. `frontend/src/components/training/DashboardHorseCard.tsx`
   - Individual horse card in list
   - Status indicators
   - Quick-train button
   - Cooldown countdown

5. `frontend/src/components/training/QuickTrainButton.tsx`
   - Quick-train action button
   - Opens QuickTrainModal
   - Disabled state handling

6. `frontend/src/components/training/QuickTrainModal.tsx`
   - Inline training modal
   - Discipline selection
   - Trait modifier preview
   - Confirm/cancel actions

7. `frontend/src/components/training/DashboardFilters.tsx`
   - Status filter controls (All/Ready/Cooldown/Ineligible)
   - Search by horse name
   - Sort controls

8. `frontend/src/components/training/CooldownCountdown.tsx`
   - Real-time countdown display
   - Formats time remaining (e.g., "5d 3h remaining")
   - Updates every minute

9. `frontend/src/components/training/TrainingRecommendations.tsx`
   - Training suggestions panel
   - Priority-based recommendations
   - Quick action buttons

**Test Files:**
10. `frontend/src/pages/__tests__/TrainingDashboardPage.test.tsx`
11. `frontend/src/components/training/__tests__/TrainingSummaryCards.test.tsx`
12. `frontend/src/components/training/__tests__/TrainingDashboardTable.test.tsx`
13. `frontend/src/components/training/__tests__/DashboardHorseCard.test.tsx`
14. `frontend/src/components/training/__tests__/QuickTrainButton.test.tsx`
15. `frontend/src/components/training/__tests__/QuickTrainModal.test.tsx`
16. `frontend/src/components/training/__tests__/DashboardFilters.test.tsx`
17. `frontend/src/components/training/__tests__/CooldownCountdown.test.tsx`
18. `frontend/src/components/training/__tests__/TrainingRecommendations.test.tsx`

### Files to REUSE (from previous stories)
- `DisciplineSelector.tsx` (Story 4.1)
- `EligibilityIndicator.tsx` (Story 4.2)
- `TraitModifierList.tsx` (Story 4.4)
- `training-utils.ts` (Stories 4.1, 4.4)

### Files to MODIFY
- `frontend/src/App.tsx` or router configuration - Add TrainingDashboardPage route
- `frontend/src/lib/utils/training-utils.ts` - Add dashboard utility functions

---

## 🧪 Testing Requirements

### Test Coverage Target: 150+ new tests

**Testing Strategy:**
- TDD approach (write tests first)
- Component isolation with React Testing Library
- Integration tests for user flows
- Accessibility tests for keyboard navigation
- Mock data for training status scenarios

### Test Breakdown by Component

**TrainingDashboardPage.tsx (25 tests):**
- Page rendering with loading state
- Data fetching and display
- Navigation and routing
- Filter/sort interactions
- Quick-train flow end-to-end

**TrainingSummaryCards.tsx (18 tests):**
- Summary calculations
- Status distribution display
- Visual indicators
- Responsive layout
- Edge cases (no horses, all ready, all cooldown)

**TrainingDashboardTable.tsx (30 tests):**
- Horse list rendering
- Filtering (by status, search)
- Sorting (name, age, availability)
- Pagination (if implemented)
- Responsive table/card toggle
- Empty states

**DashboardHorseCard.tsx (25 tests):**
- Horse data display
- Status indicators
- Quick-train button states
- Cooldown countdown integration
- Click actions
- Accessibility

**QuickTrainButton.tsx (15 tests):**
- Button rendering
- Enabled/disabled states
- Click handling
- Modal trigger
- Loading states

**QuickTrainModal.tsx (35 tests):**
- Modal open/close
- Discipline selection
- Trait modifier display
- Form validation
- Submit/cancel actions
- Success/error handling
- Integration with TrainingSessionModal logic

**DashboardFilters.tsx (20 tests):**
- Filter controls rendering
- Status filter toggling
- Search functionality
- Sort controls
- Filter combinations
- Clear filters

**CooldownCountdown.tsx (18 tests):**
- Countdown display
- Time formatting (days, hours, minutes)
- Real-time updates
- Countdown expiration
- Edge cases (expired, future date)

**TrainingRecommendations.tsx (20 tests):**
- Recommendations display
- Priority sorting
- Quick action buttons
- Algorithm logic testing
- Empty state (no recommendations)

### Testing Best Practices
- Use `describe` blocks for logical grouping
- Test user behavior, not implementation details
- Mock API calls with MSW or React Query mock
- Test accessibility with `getByRole`, `getByLabelText`
- Test keyboard navigation
- Test error boundaries and fallbacks

---

## 🎓 Previous Story Intelligence

### Story 4.1: Training Session Interface
**Key Learnings:**
- `DisciplineSelector` component with 23 disciplines grouped by category
- `TrainingSessionModal` with confirmation flow
- Mock discipline data structure in `training-utils.ts`
- API integration with `POST /api/v1/training/sessions`
- Success/error handling patterns with React Query
- **Files Created:** TrainingSessionModal.tsx, DisciplineSelector.tsx
- **Test Count:** 105 tests (100% pass rate)

**Patterns to Reuse:**
- Discipline grouping by category (Western, English, Racing, Specialty)
- Modal open/close state management
- Confirmation before action pattern
- Success notification display

### Story 4.2: Training Eligibility Display
**Key Learnings:**
- `EligibilityIndicator` component with 4 states (ready, cooldown, too-young, too-old)
- `EligibilityFilter` for filtering horses by status
- Cooldown countdown logic
- Age requirement validation (3-20 years)
- **Files Created:** EligibilityIndicator.tsx, EligibilityFilter.tsx, TrainingDashboard.tsx
- **Test Count:** 190 tests (100% pass rate)

**Patterns to Reuse:**
- Eligibility status enum and color-coding
- Countdown timer calculation
- Filter component architecture
- Status icon mapping

### Story 4.3: Score Progression Display
**Key Learnings:**
- Recharts library for radar chart visualization
- `ScoreRadarChart` for 23-axis discipline display
- `TrainingHistoryTable` with sorting and pagination
- Mock training history data structure
- **Files Created:** ScoreRadarChart.tsx, TrainingHistoryTable.tsx, ScoreProgressionPanel.tsx
- **Test Count:** 137 tests (100% pass rate)

**Patterns to Reuse:**
- Data visualization patterns
- Sorting logic
- Pagination implementation
- Mock data generation

### Story 4.4: Trait Bonus Integration
**Key Learnings:**
- `TraitModifierBadge` with color-coded indicators (green/red/gray)
- `TraitModifierTooltip` with hover/focus behavior
- `TraitModifierList` with category grouping
- Net effect calculation utilities
- Discipline-specific trait filtering
- **Files Created:** TraitModifierBadge.tsx, TraitModifierTooltip.tsx, TraitModifierList.tsx
- **Test Count:** 253 tests (100% pass rate)

**Patterns to Reuse:**
- Badge/tooltip component composition
- Net effect calculation function
- Category grouping logic
- Mock trait data structure

### Common Patterns Across All Stories
1. **Component Composition:** Small, focused components composed into larger features
2. **useMemo Optimization:** Performance optimization for calculated values
3. **WCAG 2.1 AA Compliance:** Full keyboard navigation, ARIA labels, screen reader support
4. **Responsive Design:** Mobile-first approach with Tailwind grid/flex
5. **TDD Methodology:** Tests written first, 100% pass rate achieved
6. **Mock Data Strategy:** Frontend-first with realistic mock data
7. **TypeScript Strict Mode:** Comprehensive type safety throughout

---

## 🔍 Git Intelligence Summary

**Recent Frontend Patterns (from git log):**
- Feature commits use prefix `feat(frontend):`
- Fix commits use prefix `fix(tests):` or `fix(frontend):`
- Database changes: removed `ownerId` field, now using `userId`
- Performance fixes: schema field corrections
- Test suite emphasis: 98-100% pass rate consistently maintained

**Code Quality Standards:**
- ESLint and Prettier enforcement
- No TypeScript errors tolerated
- 100% test pass rate before commit
- Descriptive commit messages with context

**Current State:**
- Frontend test count: 2454 tests passing (100%)
- Backend test count: 468+ tests (90.1% pass rate)
- React 19 fully adopted
- TypeScript strict mode enabled

---

## 📊 Epic 4 Summary (Context for Completion)

**Epic 4 Progress:**
- Story 4.1 ✅ Training Session Interface (105 tests)
- Story 4.2 ✅ Training Eligibility Display (190 tests)
- Story 4.3 ✅ Score Progression Display (137 tests)
- Story 4.4 ✅ Trait Bonus Integration (253 tests)
- Story 4.5 ⏳ Training Dashboard (this story)

**Total Epic 4 Tests (stories 4.1-4.4):** 685 tests passing

**Epic 4 Completion Criteria:**
This story completes Epic 4. Upon completion, all training system functionality will be:
- ✅ Fully integrated and accessible
- ✅ Comprehensively tested (850+ tests projected)
- ✅ Production-ready
- ✅ Documented and maintainable

---

## 🚀 Implementation Tasks

### Task 1: Core Dashboard Page Setup
**Time Estimate:** 2-3 hours
**Priority:** P0 (Foundation)

**Activities:**
- Create `TrainingDashboardPage.tsx` with routing
- Set up React Query hook for dashboard data
- Implement loading/error states
- Add basic layout structure
- Create placeholder components

**Acceptance Criteria:**
- [ ] Page renders with loading spinner
- [ ] Navigation routes correctly
- [ ] Error boundary handles failures
- [ ] Basic layout structure in place
- [ ] 25 tests passing for page component

### Task 2: Summary Cards Component
**Time Estimate:** 1-2 hours
**Priority:** P0 (Core feature)

**File:** `TrainingSummaryCards.tsx` (CREATE)

**Activities:**
- Create summary cards component
- Calculate status distribution
- Implement visual indicators (green/yellow/red)
- Add percentage calculations
- Style with Tailwind (responsive grid)

**Acceptance Criteria:**
- [ ] Shows Ready/Cooldown/Ineligible counts
- [ ] Displays percentage of total
- [ ] Visual status colors applied
- [ ] Responsive on mobile/tablet/desktop
- [ ] 18 tests passing

### Task 3: Dashboard Table/List View
**Time Estimate:** 3-4 hours
**Priority:** P0 (Core feature)

**Files:**
- `TrainingDashboardTable.tsx` (CREATE)
- `DashboardHorseCard.tsx` (CREATE)

**Activities:**
- Create table component with horse list
- Implement horse card component
- Add status indicators (reuse EligibilityIndicator)
- Create responsive table/card toggle
- Add sorting logic (name, age, availability)

**Acceptance Criteria:**
- [ ] All horses displayed with status
- [ ] Status indicators show correct state
- [ ] Responsive: table (desktop), cards (mobile)
- [ ] Sorting works for all columns
- [ ] 55 tests passing (30 table + 25 card)

### Task 4: Filtering System
**Time Estimate:** 2 hours
**Priority:** P0 (Core feature)

**File:** `DashboardFilters.tsx` (CREATE)

**Activities:**
- Create filter controls
- Implement status filter (All/Ready/Cooldown/Ineligible)
- Add search by horse name
- Add sort direction controls
- Connect filters to table data

**Acceptance Criteria:**
- [ ] Filter buttons toggle correctly
- [ ] Search filters horse list
- [ ] Sort controls work
- [ ] Filters combine properly
- [ ] Clear filters resets state
- [ ] 20 tests passing

### Task 5: Cooldown Countdown Timer
**Time Estimate:** 1-2 hours
**Priority:** P0 (Core feature)

**File:** `CooldownCountdown.tsx` (CREATE)

**Activities:**
- Create countdown component
- Calculate time remaining
- Format display (days, hours, minutes)
- Implement real-time updates (useEffect with interval)
- Handle countdown expiration

**Acceptance Criteria:**
- [ ] Shows accurate time remaining
- [ ] Updates every minute
- [ ] Formats correctly (5d 3h, 2h 45m, etc.)
- [ ] Handles expiration gracefully
- [ ] 18 tests passing

### Task 6: Quick-Train Feature
**Time Estimate:** 3-4 hours
**Priority:** P0 (Core feature)

**Files:**
- `QuickTrainButton.tsx` (CREATE)
- `QuickTrainModal.tsx` (CREATE)

**Activities:**
- Create quick-train button component
- Create quick-train modal component
- Integrate DisciplineSelector (from 4.1)
- Integrate TraitModifierList (from 4.4)
- Implement training submission
- Handle success/error states

**Acceptance Criteria:**
- [ ] Button opens modal
- [ ] Modal shows discipline selector
- [ ] Trait modifiers display correctly
- [ ] Training submission works
- [ ] Success notification shows
- [ ] Cooldown updates after training
- [ ] 50 tests passing (15 button + 35 modal)

### Task 7: Training Recommendations
**Time Estimate:** 2-3 hours
**Priority:** P1 (Enhanced feature)

**File:** `TrainingRecommendations.tsx` (CREATE)

**Activities:**
- Create recommendations component
- Implement recommendation algorithm
- Prioritize suggestions (high/medium/low)
- Add quick action buttons
- Style recommendations panel

**Acceptance Criteria:**
- [ ] Shows relevant training suggestions
- [ ] Prioritizes correctly
- [ ] Quick action buttons work
- [ ] Empty state handled
- [ ] 20 tests passing

### Task 8: Testing & Integration
**Time Estimate:** 2-3 hours
**Priority:** P0 (Quality assurance)

**Activities:**
- Run full test suite
- Fix any test failures
- Test end-to-end user flows
- Verify accessibility (keyboard navigation)
- Check responsive design on all breakpoints
- Update component documentation

**Acceptance Criteria:**
- [ ] All 150+ tests passing
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Full WCAG 2.1 AA compliance
- [ ] Mobile/tablet/desktop tested
- [ ] Documentation updated

---

## 🎯 Definition of Done

- [ ] All 8 tasks complete
- [ ] 150+ tests passing (target: 200+)
- [ ] Dashboard displays all horses with status
- [ ] Filtering and sorting work correctly
- [ ] Quick-train feature functional
- [ ] Cooldown countdowns accurate
- [ ] Recommendations panel displays
- [ ] WCAG 2.1 AA accessibility compliant
- [ ] Responsive on mobile/tablet/desktop
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Component documentation complete
- [ ] Epic 4 marked as complete

---

## 🔗 References

### Epic & Story Sources
- [Source: docs/epics.md#Epic-4] - Epic 4: Training System
- [Source: docs/epics.md#Story-4.5] - Story 4.5 requirements

### Previous Story Files
- [Story 4.1: docs/sprint-artifacts/4-1-training-session-interface.md] - TrainingSessionModal patterns
- [Story 4.2: docs/sprint-artifacts/4-2-training-eligibility-display.md] - EligibilityIndicator patterns
- [Story 4.3: docs/sprint-artifacts/4-3-score-progression-display.md] - Data visualization patterns
- [Story 4.4: docs/sprint-artifacts/4-4-trait-bonus-integration.md] - Trait modifier patterns

### Architecture Documents
- [Architecture: docs/architecture-frontend.md] - Frontend architecture standards
- [API Contracts: docs/api-contracts-backend/training-endpoints.md] - Training API documentation
- [Testing: docs/product/PRD-06-Testing-Strategy/] - Testing standards

### Component Dependencies
- [Component: frontend/src/components/training/DisciplineSelector.tsx] - Reuse from Story 4.1
- [Component: frontend/src/components/training/EligibilityIndicator.tsx] - Reuse from Story 4.2
- [Component: frontend/src/components/training/TraitModifierList.tsx] - Reuse from Story 4.4
- [Utilities: frontend/src/lib/utils/training-utils.ts] - Shared training utilities

---

**Status:** ready-for-dev ✅
**Prerequisites:** Stories 4.1 ✅, 4.2 ✅, 4.3 ✅, 4.4 ✅
**Estimated Effort:** 16-22 hours total
**Next Steps:** Run `dev-story 4-5-training-dashboard` to begin implementation

---

_Ultimate BMad Method STORY CONTEXT CREATED - Comprehensive developer guide with all patterns, intelligence, and guardrails from previous stories. The developer has everything needed for flawless implementation!_
