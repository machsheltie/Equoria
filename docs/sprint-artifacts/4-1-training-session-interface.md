# Story 4.1: Training Session Interface

Status: ✅ completed
Created Date: 2026-01-29
Completed Date: 2026-01-30
Priority: P0
Epic: 4 (Training System)
FR: FR-T1

## Story

As a **player**,
I want to **train my horse in a discipline**,
So that **they can improve their competitive scores**.

## Acceptance Criteria

**Given** I am on the training page for an eligible horse
**When** I select a discipline and start training
**Then** training session executes and I see the results

**And** I can select from 23 disciplines (4 categories)
**And** session shows score gain (+5 base + modifiers)
**And** trait bonuses/penalties are clearly displayed
**And** confirmation before starting session

**Prerequisites:** Epic 3 complete ✅

---

## 🎯 Ultimate Context Engine Analysis

### Epic Context

**Epic 4: Training System** (P0)
- **Goal:** Enable players to train horses to improve discipline scores and stats
- **Status:** Stories 4-1 through 4-5 planned; 4-1 (this story) is first
- **FRs Covered:** FR-T1, FR-T2, FR-T3, FR-T4, FR-T5

### Story Foundation

**Business Value:**
- Core gameplay mechanic - training is primary way to improve horses
- 23 disciplines provide variety and strategic depth
- Trait system integration makes training personalized per horse
- Cooldown system prevents abuse while maintaining engagement

**User Flow:**
1. User navigates to horse detail page (Epic 3 foundation ✅)
2. User clicks "Train" button or navigates to training tab
3. User selects discipline from categorized list
4. User reviews expected score gain and trait modifiers
5. User confirms training session
6. System executes training and displays results
7. User sees updated discipline score and next eligible date

---

## 🔬 Previous Story Intelligence

### Epic 3 Patterns (Just Completed)

**Key Learnings:**
- ✅ React Query hooks with proper caching work well
- ✅ Frontend-first approach with mock data accelerates development
- ✅ Component composition: small, focused components
- ✅ Comprehensive test coverage (100% for utilities)
- ✅ URL state management using React Router's useSearchParams
- ✅ TailwindCSS 3.4 for all styling
- ✅ Lucide React for icons

**Components Pattern:**
```typescript
// Utility functions → Hooks → Components → Integration
horse-filter-utils.ts → useHorseFilters.ts → HorseSearchBar.tsx → HorseListView.tsx
```

**Testing Pattern:**
- Unit tests for utilities (100% coverage)
- Component tests with React Testing Library
- Integration tests for user flows
- Target: 90%+ test pass rate

---

## 📋 Architecture Requirements

### Technology Stack

**Required:**
- React 19 with TypeScript strict mode
- React Query (TanStack Query) for state management
- React Router v6 for navigation
- TailwindCSS 3.4 for styling
- Vitest + React Testing Library for testing
- Lucide React for icons

**Forbidden:**
- ❌ Redux, Zustand (use React Query only)
- ❌ Inline styles (use TailwindCSS classes)
- ❌ `any` types (use proper TypeScript types)

### File Organization

```
frontend/src/
├── components/
│   ├── training/
│   │   ├── DisciplinePicker.tsx (NEW)
│   │   ├── TrainingConfirmModal.tsx (NEW)
│   │   ├── TrainingResultModal.tsx (NEW)
│   │   └── __tests__/
│   │       ├── DisciplinePicker.test.tsx (NEW)
│   │       ├── TrainingConfirmModal.test.tsx (NEW)
│   │       └── TrainingResultModal.test.tsx (NEW)
│   └── HorseDetailPage.tsx (MODIFY - add training tab)
├── hooks/
│   ├── api/
│   │   ├── useTraining.ts (NEW)
│   │   └── __tests__/
│   │       └── useTraining.test.ts (NEW)
│   └── useTrainingSession.ts (NEW - session state management)
├── lib/
│   └── utils/
│       ├── training-utils.ts (NEW - discipline data, calculations)
│       └── __tests__/
│           └── training-utils.test.ts (NEW)
└── types/
    └── training.ts (NEW - TypeScript interfaces)
```

### Code Standards

**Naming Conventions:**
- camelCase for variables, functions, properties
- PascalCase for components, types, interfaces
- kebab-case for file names

**TypeScript Requirements:**
- Strict mode enabled
- No `any` types
- Explicit return types for functions
- Interface for component props

**Testing Requirements:**
- 100% test coverage for utilities
- 80%+ coverage for components
- Test user interactions
- Test API integration
- Test error states

**Accessibility Requirements:**
- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus management in modals

---

## 🎨 Design System & Visual Requirements

### Discipline Picker Component

**Layout:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <DisciplineCategory title="Western" disciplines={westernDisciplines} />
  <DisciplineCategory title="English" disciplines={englishDisciplines} />
  <DisciplineCategory title="Specialized" disciplines={specializedDisciplines} />
  <DisciplineCategory title="Racing" disciplines={racingDisciplines} />
</div>
```

**Discipline Button:**
- Displays discipline name
- Shows current score (e.g., "Dressage: 45")
- Hover effect
- Disabled state if on cooldown
- Click to select

**Visual States:**
- Default: White background, gray border
- Hover: Blue border
- Selected: Blue background, white text
- Disabled: Gray background, not clickable

### Training Confirm Modal

**Content:**
```
Training Session
────────────────
Horse: Thunder
Discipline: Dressage

Expected Outcome:
• Base Score Gain: +5
• Current Score: 45 → 50
• Trait Modifiers: +1 (Focused)

Next Training: 7 days

[Cancel] [Confirm Training]
```

**Features:**
- Modal overlay (semi-transparent black)
- Centered modal (max-width 500px)
- Close button (X) in top-right
- Escape key to close
- Click outside to close

### Training Result Modal

**Content:**
```
Training Complete! 🎉
────────────────────
Discipline: Dressage
Score Gain: +6 (+5 base, +1 trait bonus)

New Score: 51

Additional Gains:
• Precision: +2
• Focus: +1
• XP: +5

Next Training Available: Jan 6, 2026

[Close]
```

**Features:**
- Success animation (optional)
- Celebration styling
- Clear breakdown of gains
- Next training date prominently displayed

---

## 🔌 Backend API Integration

### Training Endpoints

**Check Eligibility:**
```
POST /api/training/check-eligibility
Body: { horseId: number }
Response: {
  eligible: boolean,
  reason?: string,
  nextEligibleDate?: string
}
```

**Execute Training:**
```
POST /api/training/train
Body: {
  horseId: number,
  discipline: string
}
Response: {
  success: boolean,
  message: string,
  scoreGain: number,
  newScore: number,
  statGains?: { [stat: string]: number },
  xpGain: number,
  nextEligibleDate: string
}
```

**Get Training Status:**
```
GET /api/training/horse/:horseId/all-status
Response: {
  horseId: number,
  trainingCooldown: string | null,
  nextEligibleDate: string | null,
  disciplineScores: { [discipline: string]: number }
}
```

### Frontend-First Strategy

**Phase 1 (This Story):**
- Implement with mock data and simulated API responses
- Focus on UI/UX and user flows
- Complete component and integration testing

**Phase 2 (Future Sprint):**
- Connect to real backend API
- Replace mock data with API calls
- Add error handling for API failures

---

## 📋 Implementation Plan

### Task 1: Create Training Utilities (AC: Discipline data, calculations)
**Time Estimate:** 1-2 hours
**Priority:** P0 (Foundation)

**File:** `frontend/src/lib/utils/training-utils.ts`

**Data Structures:**
```typescript
export interface Discipline {
  id: string;
  name: string;
  category: 'Western' | 'English' | 'Specialized' | 'Racing';
  description: string;
  primaryStats: string[];
}

export const DISCIPLINES: Discipline[] = [
  // Western (7)
  { id: 'western-pleasure', name: 'Western Pleasure', category: 'Western', ... },
  { id: 'reining', name: 'Reining', category: 'Western', ... },
  { id: 'cutting', name: 'Cutting', category: 'Western', ... },
  { id: 'barrel-racing', name: 'Barrel Racing', category: 'Western', ... },
  { id: 'roping', name: 'Roping', category: 'Western', ... },
  { id: 'team-penning', name: 'Team Penning', category: 'Western', ... },
  { id: 'rodeo', name: 'Rodeo', category: 'Western', ... },

  // English (6)
  { id: 'hunter', name: 'Hunter', category: 'English', ... },
  { id: 'saddleseat', name: 'Saddleseat', category: 'English', ... },
  { id: 'dressage', name: 'Dressage', category: 'English', ... },
  { id: 'show-jumping', name: 'Show Jumping', category: 'English', ... },
  { id: 'eventing', name: 'Eventing', category: 'English', ... },
  { id: 'cross-country', name: 'Cross Country', category: 'English', ... },

  // Specialized (7)
  { id: 'endurance', name: 'Endurance', category: 'Specialized', ... },
  { id: 'vaulting', name: 'Vaulting', category: 'Specialized', ... },
  { id: 'polo', name: 'Polo', category: 'Specialized', ... },
  { id: 'combined-driving', name: 'Combined Driving', category: 'Specialized', ... },
  { id: 'fine-harness', name: 'Fine Harness', category: 'Specialized', ... },
  { id: 'gaited', name: 'Gaited', category: 'Specialized', ... },
  { id: 'gymkhana', name: 'Gymkhana', category: 'Specialized', ... },

  // Racing (3)
  { id: 'racing', name: 'Racing', category: 'Racing', ... },
  { id: 'steeplechase', name: 'Steeplechase', category: 'Racing', ... },
  { id: 'harness-racing', name: 'Harness Racing', category: 'Racing', ... },
];
```

**Functions:**
```typescript
// Get disciplines by category
export function getDisciplinesByCategory(category: string): Discipline[]

// Calculate expected score gain
export function calculateExpectedGain(
  baseGain: number,
  traitModifiers: number[]
): number

// Format discipline name for display
export function formatDisciplineName(id: string): string

// Check if training is available
export function canTrain(
  horse: Horse,
  cooldownDate?: string
): boolean
```

**Test File:** `frontend/src/lib/utils/__tests__/training-utils.test.ts`
- Test discipline data structure
- Test category filtering
- Test score gain calculations
- Test training eligibility checks
- Target: 100% coverage (40+ tests)

---

### Task 2: Create Training API Hook (AC: API integration)
**Time Estimate:** 1-2 hours
**Priority:** P0 (Core functionality)

**File:** `frontend/src/hooks/api/useTraining.ts`

**Hook Implementation:**
```typescript
export interface TrainingRequest {
  horseId: number;
  discipline: string;
}

export interface TrainingResult {
  success: boolean;
  message: string;
  scoreGain: number;
  newScore: number;
  statGains?: { [stat: string]: number };
  xpGain: number;
  nextEligibleDate: string;
}

export function useTrainHorse() {
  return useMutation<TrainingResult, Error, TrainingRequest>({
    mutationFn: async (request) => {
      // Phase 1: Mock implementation
      // Phase 2: Real API call
      return mockTrainingResult(request);
    },
    onSuccess: (data) => {
      // Invalidate horse query to refetch updated data
      queryClient.invalidateQueries(['horse', data.horseId]);
    },
  });
}

export function useTrainingStatus(horseId: number) {
  return useQuery({
    queryKey: ['training-status', horseId],
    queryFn: async () => {
      // Phase 1: Mock data
      // Phase 2: GET /api/training/horse/:horseId/all-status
      return mockTrainingStatus(horseId);
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}
```

**Test File:** `frontend/src/hooks/api/__tests__/useTraining.test.ts`
- Test mutation success
- Test mutation error handling
- Test query data fetching
- Test cache invalidation
- Target: 25+ tests

---

### Task 3: Create DisciplinePicker Component (AC: 23 disciplines, 4 categories)
**Time Estimate:** 2-3 hours
**Priority:** P0 (Core UI)

**File:** `frontend/src/components/training/DisciplinePicker.tsx`

**Component Features:**
- Grid layout with 4 category sections
- Discipline buttons with current scores
- Visual feedback for selection
- Disabled state for cooldown disciplines
- Responsive design (1/2/4 columns)

**Test File:** `frontend/src/components/training/__tests__/DisciplinePicker.test.tsx`
- Test rendering all 23 disciplines
- Test category grouping
- Test discipline selection
- Test disabled state
- Test accessibility
- Target: 30+ tests

---

### Task 4: Create TrainingConfirmModal Component (AC: Confirmation before training)
**Time Estimate:** 2-3 hours
**Priority:** P0 (Core UI)

**File:** `frontend/src/components/training/TrainingConfirmModal.tsx`

**Component Features:**
- Modal overlay with backdrop
- Training details (horse, discipline, expected gain)
- Trait modifier display
- Confirm/Cancel buttons
- Keyboard support (Escape to close)
- Click outside to close

**Test File:** `frontend/src/components/training/__tests__/TrainingConfirmModal.test.tsx`
- Test modal rendering
- Test confirm action
- Test cancel action
- Test Escape key
- Test accessibility
- Target: 25+ tests

---

### Task 5: Create TrainingResultModal Component (AC: Display results)
**Time Estimate:** 2-3 hours
**Priority:** P0 (Core UI)

**File:** `frontend/src/components/training/TrainingResultModal.tsx`

**Component Features:**
- Success message with celebration styling
- Score gain breakdown
- Stat gains display (if any)
- XP gain display
- Next training date
- Close button

**Test File:** `frontend/src/components/training/__tests__/TrainingResultModal.test.tsx`
- Test result display
- Test score breakdown
- Test stat gains
- Test close action
- Test accessibility
- Target: 20+ tests

---

### Task 6: Integrate Training Tab into HorseDetailPage (AC: All)
**Time Estimate:** 2-3 hours
**Priority:** P0 (Integration)

**File:** `frontend/src/components/HorseDetailPage.tsx` (MODIFY)

**Changes:**
- Add "Training" tab to existing tab navigation
- Create TrainingTab component
- Integrate DisciplinePicker, modals
- Handle training session flow
- Update horse data after training

**Test File:** `frontend/src/components/__tests__/HorseDetailPage.Training.test.tsx` (NEW)
- Test training tab visibility
- Test discipline selection
- Test confirmation flow
- Test result display
- Test cooldown display
- Target: 35+ tests

---

### Task 7: Testing & Documentation (AC: Quality)
**Time Estimate:** 2-3 hours
**Priority:** P1 (Quality assurance)

**Activities:**
- Run all tests and verify 100% pass rate
- Test complete training flow end-to-end
- Verify modal interactions
- Check accessibility with keyboard navigation
- Performance test with many disciplines
- Update component documentation

**Acceptance Criteria:**
- [ ] All tests passing (150+ new tests)
- [ ] Training flow works seamlessly
- [ ] Modals accessible and keyboard-friendly
- [ ] Performance acceptable
- [ ] Documentation updated

---

## 🎯 Definition of Done

- [x] All acceptance criteria met
- [x] 23 disciplines available in 4 categories
- [x] Discipline selection interface complete
- [x] Confirmation modal works
- [x] Training execution and result display
- [x] Trait modifiers displayed
- [x] 259 tests passing (exceeds 150+ target by 73%)
- [x] Accessibility compliant (WCAG 2.1 AA)
- [x] Mobile responsive
- [x] Documentation updated (inline with components)

## ✅ Completion Summary

**Completed:** 2026-01-30
**Total Tests:** 259 passing (100% pass rate for Story 4-1)
**Overall Frontend Tests:** 2016 tests (1997 passing, 99.06% - 19 pre-existing failures)

### Files Created (11 files)
1. `frontend/src/lib/utils/training-utils.ts` (370 lines) - 23 disciplines, eligibility checks, score calculations
2. `frontend/src/lib/utils/__tests__/training-utils.test.ts` (464 lines, 64 tests)
3. `frontend/src/hooks/api/useTraining.ts` (186 lines) - 5 React Query hooks
4. `frontend/src/hooks/api/__tests__/useTraining.test.tsx` (543 lines, 30 tests)
5. `frontend/src/components/training/DisciplinePicker.tsx` (186 lines) - Responsive grid layout
6. `frontend/src/components/training/__tests__/DisciplinePicker.test.tsx` (732 lines, 42 tests)
7. `frontend/src/components/training/TrainingConfirmModal.tsx` (278 lines) - Modal with training details
8. `frontend/src/components/training/__tests__/TrainingConfirmModal.test.tsx` (1045 lines, 45 tests)
9. `frontend/src/components/training/TrainingResultModal.tsx` (267 lines) - Success display with celebration
10. `frontend/src/components/training/__tests__/TrainingResultModal.test.tsx` (1014 lines, 43 tests)
11. `frontend/src/pages/__tests__/HorseDetailPage.Training.test.tsx` (652 lines, 35 tests)

### Files Modified (1 file)
1. `frontend/src/pages/HorseDetailPage.tsx` - Added Training tab with complete training flow integration

### Implementation Highlights
- **Frontend-First Approach:** All components use mock data, ready for Phase 2 backend integration
- **Comprehensive Testing:** 259 tests covering all functionality, interactions, accessibility, edge cases
- **Accessibility:** Full WCAG 2.1 AA compliance with ARIA labels, keyboard navigation, focus management
- **Responsive Design:** Grid layouts adapt from 1 column (mobile) to 4 columns (desktop)
- **Complete User Flow:** Select discipline → Confirm with details → Execute training → View results → Close
- **Error Handling:** Graceful error states with retry capability
- **State Management:** React Query for API state, local useState for UI flow
- **Visual Design:** TailwindCSS 3.4 with color-coded modifiers, celebration styling, clear visual hierarchy

---

## 🔗 References

- [Source: docs/epics.md#Story-4.1] - Story definition
- [API: docs/api-contracts-backend/training-endpoints.md] - Backend API
- [System: docs/history/claude-docs/systems/training-system.md] - Training system docs
- FR-T1: Training session interface requirement

---

**Created:** 2026-01-29
**Status:** Ready for Development
**Prerequisites:** Epic 3 ✅ Complete
**Estimated Effort:** 12-19 hours total
