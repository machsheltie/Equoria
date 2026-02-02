# Story 4.4: Trait Bonus Integration

Status: ⚠️ ready-for-dev
Created Date: 2026-01-30
Priority: P0
Epic: 4 (Training System)
FR: FR-T4

## Story

As a **player**,
I want to **understand how traits affect training outcomes**,
So that **I can leverage my horse's strengths**.

## Acceptance Criteria

**Given** I am about to train a horse
**When** I view the training preview
**Then** I see all trait modifiers that will apply

**And** positive traits show green bonus indicators
**And** negative traits show red penalty indicators
**And** net effect is calculated and displayed
**And** tooltip explains each trait's effect

**Prerequisites:** Story 4.1 ✅, Story 4.2 ✅, Story 4.3 ✅, Epic 6 (traits) - Partial (trait system exists in backend)

---

## 🎯 Ultimate Context Engine Analysis

### Epic Context

**Epic 4: Training System** (P0)
- **Goal:** Enable players to train horses to improve discipline scores and stats
- **Status:** Stories 4-1 ✅, 4-2 ✅, 4-3 ✅ Complete, Story 4-4 (this story) is next
- **FRs Covered:** FR-T1 ✅, FR-T2 ✅, FR-T3 ✅, FR-T4 (this story), FR-T5

### Story Foundation

**Business Value:**
- Helps players understand the strategic value of traits
- Enables informed training decisions based on horse genetics
- Creates engagement through strategic trait utilization
- Builds transparency in game mechanics
- Encourages trait discovery and breeding strategy

**User Flow:**
1. User navigates to Training modal/page for a horse
2. User selects a discipline to train
3. User sees training preview showing expected score gain
4. User sees list of trait modifiers that apply:
   - Green indicators for positive traits (+bonus)
   - Red indicators for negative traits (-penalty)
   - Neutral/gray for traits with no effect
5. User sees net effect calculation (base gain + bonuses - penalties)
6. User hovers over traits to see detailed explanations
7. User makes informed decision whether to train this discipline

---

## 🔬 Previous Story Intelligence

### Story 4-1 Patterns (Training Session Interface - Completed)

**Key Implementations:**
- ✅ **training-utils.ts** - Complete training utilities with DISCIPLINES array (23 disciplines)
- ✅ **useTraining.ts** - 5 React Query hooks for training operations
- ✅ **TrainingSessionModal.tsx** - Modal for conducting training sessions
- ✅ **DisciplinePicker.tsx** - Discipline selection component
- ✅ **TrainingResultModal.tsx** - Shows results after training
- ✅ **Frontend-first approach** - Mock data with type-safe interfaces

**Training Preview Structure (Exists in TrainingSessionModal):**
```typescript
// Current TrainingSessionModal shows basic training info
// We need to ADD trait modifiers display to this modal
interface TrainingPreview {
  horseId: number;
  discipline: string;
  baseGain: number; // Expected base score gain (typically +5)
  currentScore: number;
  newScore: number;
  // NEW: Need to add trait modifiers
  traitModifiers?: TraitModifier[];
  netGain?: number; // base + bonuses - penalties
}
```

**Component Pattern from Story 4-1:**
```
Utility functions (training-utils.ts)
  ↓
Hooks (useTraining.ts with React Query)
  ↓
Components (TraitModifierList, TraitBadge, etc.)
  ↓
Integration (TrainingSessionModal with trait preview)
```

### Story 4-2 Patterns (Training Eligibility Display - Completed)

**Visual Patterns:**
- Color-coded status displays (green/amber/gray/red)
- Compact and full variants for different contexts
- useMemo for performance optimization
- Responsive design with Tailwind grid
- WCAG 2.1 AA accessibility with ARIA labels

### Story 4-3 Patterns (Score Progression Display - Completed)

**Key Implementations:**
- ✅ **ScoreRadarChart.tsx** - Recharts integration for visualization
- ✅ **TrainingHistoryTable.tsx** - Sortable, paginated data display
- ✅ **ScoreProgressionPanel.tsx** - Integration component pattern
- ✅ **Responsive layouts** - Grid layouts with md:grid-cols-2
- ✅ **Loading/Error states** - Comprehensive state management

**Latest Completion (Story 4-3):**
- 137 new tests created (2295 total frontend tests)
- Components: ScoreRadarChart, TrainingHistoryTable, ScoreProgressionPanel
- All components follow React 19 + TypeScript strict mode patterns
- Recharts library integrated successfully

---

## 📋 Architecture Requirements

### Technology Stack

**Required:**
- React 19 with TypeScript strict mode
- React Query (TanStack Query) for state management
- React Router v6 for navigation
- TailwindCSS 3.4 for styling
- Vitest + React Testing Library for testing
- Lucide React for icons (Plus, Minus, Info, HelpCircle)
- **NO new dependencies** - use existing stack

**Forbidden:**
- ❌ Redux, Zustand (use React Query only)
- ❌ Inline styles (use TailwindCSS classes)
- ❌ `any` types (use proper TypeScript types)

### File Organization

```
frontend/src/
├── components/
│   ├── training/
│   │   ├── TraitModifierBadge.tsx (NEW)
│   │   ├── TraitModifierList.tsx (NEW)
│   │   ├── TraitModifierTooltip.tsx (NEW)
│   │   ├── TrainingSessionModal.tsx (MODIFY - add trait preview)
│   │   └── __tests__/
│   │       ├── TraitModifierBadge.test.tsx (NEW)
│   │       ├── TraitModifierList.test.tsx (NEW)
│   │       ├── TraitModifierTooltip.test.tsx (NEW)
│   │       └── TrainingSessionModal.test.tsx (UPDATE - add trait tests)
├── hooks/
│   └── api/
│       └── useTraining.ts (EXISTING - may need useTraitModifiers hook)
├── lib/
│   └── utils/
│       ├── training-utils.ts (EXISTING - may add trait calculation functions)
│       └── __tests__/
│           └── training-utils.test.ts (UPDATE - test trait calculations)
└── types/
    └── training.ts (UPDATE - add TraitModifier interface)
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
- 80%+ coverage for components
- Test user interactions
- Test tooltip displays
- Test calculations (net effect)
- Test error states

**Accessibility Requirements:**
- ARIA labels for all indicators and tooltips
- Semantic HTML for list structures
- Screen reader friendly descriptions
- Keyboard navigation for tooltips

---

## 🎨 Design System & Visual Requirements

### TraitModifierBadge Component

**Visual Design:**

**Positive Trait (+bonus):**
```tsx
<div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 border border-green-500 text-green-700">
  <Plus className="w-3 h-3" />
  <span className="text-xs font-medium">Athletic +3</span>
</div>
```

**Negative Trait (-penalty):**
```tsx
<div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 border border-red-500 text-red-700">
  <Minus className="w-3 h-3" />
  <span className="text-xs font-medium">Stubborn -2</span>
</div>
```

**Neutral Trait (no effect):**
```tsx
<div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-300 text-gray-600">
  <Info className="w-3 h-3" />
  <span className="text-xs font-medium">Calm</span>
</div>
```

**States:**
1. **Positive** - Green background, Plus icon, shows +bonus
2. **Negative** - Red background, Minus icon, shows -penalty
3. **Neutral** - Gray background, Info icon, no modifier shown

### TraitModifierList Component

**Layout Structure:**
```
┌─────────────────────────────────────────────────────┐
│  Trait Modifiers                          [Info]    │
│  ┌───────────────────────────────────────────────┐ │
│  │ 📊 Base Gain: +5                              │ │
│  │                                                │ │
│  │ Positive Traits:                              │ │
│  │  [+ Athletic +3] [+ Quick Learner +2]         │ │
│  │                                                │ │
│  │ Negative Traits:                              │ │
│  │  [- Stubborn -2]                              │ │
│  │                                                │ │
│  │ ─────────────────────────────────────────────│ │
│  │ 🎯 Net Effect: +8 (5 + 5 - 2)                │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Section headings for Positive/Negative traits
- Badges for each trait with appropriate styling
- Base gain displayed clearly
- Net effect calculation shown at bottom
- Info icon linking to trait documentation

### TraitModifierTooltip Component

**Tooltip Content:**
```
┌──────────────────────────────────────┐
│  Athletic                             │
│  ──────────────────────────────────  │
│  Effect: +3 to physical disciplines   │
│  Disciplines: Racing, Show Jumping,   │
│               Barrel Racing           │
│                                       │
│  This trait enhances performance in   │
│  disciplines requiring physical       │
│  prowess and agility.                 │
│                                       │
│  [Learn More →]                       │
└──────────────────────────────────────┘
```

**Tooltip Features:**
- Trait name as heading
- Effect description (e.g., "+3 to physical disciplines")
- List of affected disciplines
- Detailed explanation text
- Optional "Learn More" link to trait documentation
- Appears on hover or focus
- Keyboard accessible (Escape to close)

### Integration into TrainingSessionModal

**Updated Modal Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Train: [Discipline Dropdown]          [X]          │
│  ─────────────────────────────────────────────────  │
│  Current Score: 45                                  │
│  Expected New Score: 50                             │
│                                                      │
│  ✨ Trait Modifiers                    [Info]       │
│  ┌───────────────────────────────────────────────┐ │
│  │ 📊 Base Gain: +5                              │ │
│  │                                                │ │
│  │ Positive Traits:                              │ │
│  │  [+ Athletic +3] [+ Quick Learner +2]         │ │
│  │                                                │ │
│  │ Negative Traits:                              │ │
│  │  [- Stubborn -2]                              │ │
│  │                                                │ │
│  │ 🎯 Net Effect: +8                             │ │
│  └───────────────────────────────────────────────┘ │
│                                                      │
│  [Cancel]                    [Confirm Training →]   │
└─────────────────────────────────────────────────────┘
```

**Responsive Behavior:**
- Desktop: Full layout as shown
- Mobile: Trait badges wrap to multiple lines
- Tooltip: Adapts to screen size, doesn't overflow

---

## 🔌 Backend API Integration

### Trait Modifier Data Structure

**TraitModifier Interface:**
```typescript
interface TraitModifier {
  traitId: string; // e.g., "athletic"
  traitName: string; // e.g., "Athletic"
  effect: number; // +3, -2, 0
  description: string; // "Enhances physical disciplines"
  affectedDisciplines: string[]; // ["racing", "show-jumping"]
  category: 'positive' | 'negative' | 'neutral';
}
```

**Training Preview API (Expected):**
```
GET /api/training/preview/:horseId/:discipline
Response: {
  horseId: number;
  discipline: string;
  currentScore: number;
  baseGain: number; // Base score gain (typically 5)
  traitModifiers: TraitModifier[];
  netGain: number; // Calculated: baseGain + sum(positive) - sum(negative)
  newScore: number; // currentScore + netGain
  cooldownUntil: string; // After training cooldown date
}
```

**Frontend-First Strategy (Phase 1):**
- Create mock trait data matching TraitModifier interface
- Add trait modifiers to TrainingSessionModal display
- Calculate net effect in frontend using mock data
- Mock API returns trait modifiers for selected discipline
- Phase 2: Replace with real backend API integration

**Mock Trait Data Example:**
```typescript
const mockTraitModifiers: TraitModifier[] = [
  {
    traitId: 'athletic',
    traitName: 'Athletic',
    effect: 3,
    description: 'Enhances physical disciplines',
    affectedDisciplines: ['racing', 'show-jumping', 'barrel-racing'],
    category: 'positive'
  },
  {
    traitId: 'stubborn',
    traitName: 'Stubborn',
    effect: -2,
    description: 'Reduces training effectiveness',
    affectedDisciplines: ['all'],
    category: 'negative'
  }
];
```

---

## 📋 Implementation Plan

### Task 1: Create TraitModifierBadge Component ✅
**Time Estimate:** 1-2 hours
**Priority:** P0 (Foundation)
**Status:** Complete - 41 tests passing

**File:** `frontend/src/components/training/TraitModifierBadge.tsx`

**Component Props:**
```typescript
interface TraitModifierBadgeProps {
  modifier: TraitModifier;
  showTooltip?: boolean; // default: true
  size?: 'sm' | 'md' | 'lg'; // default: 'md'
  className?: string;
}
```

**Component Features:**
- Three visual variants: positive (green), negative (red), neutral (gray)
- Icon based on category: Plus, Minus, Info
- Shows trait name and effect (+3, -2, or nothing for neutral)
- Compact badge design with rounded corners
- Accessible with ARIA labels
- Optional tooltip integration (connect to TraitModifierTooltip)

**Test File:** `frontend/src/components/training/__tests__/TraitModifierBadge.test.tsx`
- Test positive trait renders with green styling
- Test negative trait renders with red styling
- Test neutral trait renders with gray styling
- Test correct icons for each category
- Test effect display (+3, -2)
- Test size variants (sm, md, lg)
- Test tooltip trigger
- Test accessibility attributes
- Target: 20+ tests

---

### Task 2: Create TraitModifierTooltip Component ✅
**Time Estimate:** 1-2 hours
**Priority:** P0 (User education)
**Status:** Complete - 30 tests passing

**File:** `frontend/src/components/training/TraitModifierTooltip.tsx`

**Component Props:**
```typescript
interface TraitModifierTooltipProps {
  modifier: TraitModifier;
  children: React.ReactNode; // Trigger element (e.g., badge)
  onLearnMore?: () => void; // Callback for "Learn More" link
}
```

**Component Features:**
- Tooltip appears on hover or focus
- Shows trait name, effect, affected disciplines, description
- Optional "Learn More" link
- Keyboard accessible (Escape to close)
- Portal-based rendering to avoid overflow issues
- Position calculation to stay within viewport
- Accessible with proper ARIA attributes

**Test File:** `frontend/src/components/training/__tests__/TraitModifierTooltip.test.tsx`
- Test tooltip appears on hover
- Test tooltip appears on focus
- Test tooltip closes on Escape key
- Test tooltip content displays correctly
- Test "Learn More" link callback
- Test positioning logic
- Test keyboard navigation
- Test accessibility attributes
- Target: 20+ tests

---

### Task 3: Create TraitModifierList Component ✅
**Time Estimate:** 2-3 hours
**Priority:** P0 (Core display)
**Status:** Complete - 34 tests passing

**File:** `frontend/src/components/training/TraitModifierList.tsx`

**Component Props:**
```typescript
interface TraitModifierListProps {
  modifiers: TraitModifier[];
  baseGain: number;
  showNetEffect?: boolean; // default: true
  onLearnMore?: () => void;
  className?: string;
}
```

**Component Features:**
- Groups modifiers by category (positive/negative/neutral)
- Displays base gain prominently
- Shows section headings for each category
- Renders TraitModifierBadge for each modifier
- Calculates and displays net effect at bottom
- Empty state when no modifiers
- Accessible with semantic HTML (ul, li)
- Info icon linking to trait documentation

**Calculation Logic:**
```typescript
const netEffect = baseGain +
  modifiers
    .filter(m => m.category === 'positive')
    .reduce((sum, m) => sum + m.effect, 0) -
  Math.abs(modifiers
    .filter(m => m.category === 'negative')
    .reduce((sum, m) => sum + Math.abs(m.effect), 0));
```

**Test File:** `frontend/src/components/training/__tests__/TraitModifierList.test.tsx`
- Test grouping by category
- Test net effect calculation
- Test base gain display
- Test empty state (no modifiers)
- Test only positive modifiers
- Test only negative modifiers
- Test mixed modifiers
- Test section headings
- Test badge rendering
- Test info icon
- Target: 25+ tests

---

### Task 4: Update TrainingSessionModal with Trait Display ✅
**Time Estimate:** 2-3 hours
**Priority:** P0 (Integration)
**Status:** Complete - 23 new tests passing (57 total for modal)

**File:** `frontend/src/components/training/TrainingSessionModal.tsx` (MODIFY)

**Changes:**
1. **Import TraitModifierList:**
   ```typescript
   import TraitModifierList from './TraitModifierList';
   ```

2. **Add Trait Modifiers Section:**
   - Add section after discipline selection
   - Display TraitModifierList with modifiers
   - Update expected score calculation to use net effect
   - Add "Learn More" link handler

3. **Mock Data Integration:**
   - Create mock trait modifiers based on selected discipline
   - Different modifiers for different disciplines
   - Include positive, negative, and neutral traits

4. **Update Score Display:**
   - Show net effect instead of just base gain
   - Update "Expected New Score" calculation
   - Visual feedback when net effect differs from base

**Test File:** `frontend/src/components/training/__tests__/TrainingSessionModal.test.tsx` (UPDATE)
- Test trait modifiers section appears
- Test modifiers update when discipline changes
- Test net effect affects expected score
- Test "Learn More" link works
- Test modal still functions without traits
- Add 15+ new tests for trait integration

---

### Task 5: Add Trait Calculation Utilities
**Time Estimate:** 1-2 hours
**Priority:** P1 (Supporting functions)

**File:** `frontend/src/lib/utils/training-utils.ts` (MODIFY)

**New Functions:**
```typescript
export function calculateNetEffect(
  baseGain: number,
  modifiers: TraitModifier[]
): number;

export function getTraitModifiersForDiscipline(
  horseTraits: string[],
  discipline: string
): TraitModifier[];

export function groupModifiersByCategory(
  modifiers: TraitModifier[]
): {
  positive: TraitModifier[];
  negative: TraitModifier[];
  neutral: TraitModifier[];
};
```

**Test File:** `frontend/src/lib/utils/__tests__/training-utils.test.ts` (UPDATE)
- Test calculateNetEffect with various modifier combinations
- Test getTraitModifiersForDiscipline matching
- Test groupModifiersByCategory sorting
- Test edge cases (empty arrays, zero effects)
- Add 15+ new tests for trait functions

---

### Task 6: Testing & Documentation
**Time Estimate:** 2-3 hours
**Priority:** P1 (Quality assurance)

**Activities:**
- Run all tests and verify 100% pass rate
- Test complete trait display flow end-to-end
- Test tooltip interactions
- Test net effect calculations
- Check accessibility with keyboard navigation
- Test with various trait combinations
- Update component documentation

**Acceptance Criteria:**
- [x] All tests passing (100+ new tests)
- [x] Trait modifiers display correctly
- [x] Tooltips work on all modifiers
- [x] Net effect calculation accurate
- [x] Accessible and keyboard-friendly
- [x] Documentation updated

**Status:** Complete - All 253 tests passing (41+30+34+57+91)

---

## 🎯 Definition of Done

- [x] All acceptance criteria met
- [x] Positive traits show green indicators with bonuses
- [x] Negative traits show red indicators with penalties
- [x] Net effect calculated and displayed accurately
- [x] Tooltips explain each trait's effect
- [x] Trait display integrated into TrainingSessionModal
- [x] 253 tests passing (target: 100+)
- [x] Accessibility compliant (WCAG 2.1 AA)
- [x] Mobile responsive
- [x] Documentation updated

---

## 🔗 References

- [Source: docs/epics.md#Story-4.4] - Story definition
- [Source: docs/sprint-artifacts/4-1-training-session-interface.md] - TrainingSessionModal implementation
- [Source: docs/sprint-artifacts/4-2-training-eligibility-display.md] - Visual indicator patterns
- [Source: docs/sprint-artifacts/4-3-score-progression-display.md] - Component composition patterns
- [API: docs/api-contracts-backend/training-endpoints.md] - Backend API
- [System: frontend/src/components/training/TrainingSessionModal.tsx] - Modal to modify
- FR-T4: Trait bonus integration requirement

---

**Created:** 2026-01-30
**Completed:** 2026-01-30
**Status:** ✅ Complete - Ready for Review
**Prerequisites:** Story 4.1 ✅, Story 4.2 ✅, Story 4.3 ✅
**Estimated Effort:** 10-15 hours total
**Actual Effort:** ~8 hours (efficient execution)

---

## 📊 Implementation Summary

### Files Created (5):
1. `frontend/src/components/training/TraitModifierBadge.tsx` - Visual trait indicator component
2. `frontend/src/components/training/TraitModifierTooltip.tsx` - Interactive tooltip component
3. `frontend/src/components/training/TraitModifierList.tsx` - Trait grouping and net effect display
4. `frontend/src/components/training/__tests__/TraitModifierBadge.test.tsx` - 41 tests
5. `frontend/src/components/training/__tests__/TraitModifierTooltip.test.tsx` - 30 tests
6. `frontend/src/components/training/__tests__/TraitModifierList.test.tsx` - 34 tests

### Files Modified (2):
1. `frontend/src/components/training/TrainingSessionModal.tsx` - Added trait modifier display section
2. `frontend/src/lib/utils/training-utils.ts` - Added trait calculation utilities

### Test Coverage:
- **Task 1**: TraitModifierBadge - 41 tests ✅
- **Task 2**: TraitModifierTooltip - 30 tests ✅
- **Task 3**: TraitModifierList - 34 tests ✅
- **Task 4**: TrainingSessionModal integration - 23 new tests (57 total) ✅
- **Task 5**: Trait calculation utilities - 28 new tests (91 total) ✅
- **Task 6**: Full test suite validation - 2454/2454 passing (100%) ✅

**Total New Tests:** 156 tests (exceeded target of 100+)
**Total Story Tests:** 253 tests (41+30+34+57+91)
**Pass Rate:** 100% (2454/2454 across entire frontend)

### Key Features Implemented:
- ✅ Color-coded trait badges (green/red/gray) with icons
- ✅ Interactive tooltips with trait descriptions
- ✅ Net effect calculation and display
- ✅ Discipline-specific trait filtering
- ✅ Category-based grouping (Positive/Negative/Other)
- ✅ Expected score display with breakdown
- ✅ Full keyboard accessibility (Tab, Enter, Escape)
- ✅ Mobile-responsive design
- ✅ WCAG 2.1 AA compliant

### Mock Data Strategy:
- Physical disciplines (Jumping, Dressage, etc.): Athletic (+3) + Stubborn (-2)
- Mental disciplines (Trail, Western Pleasure, etc.): Intelligent (+4) + Calm (0)
- Other disciplines: Quick Learner (+2)
- All traits include descriptions and affected discipline lists
