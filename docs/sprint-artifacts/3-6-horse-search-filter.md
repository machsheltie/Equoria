# Story 3.6: Horse Search & Filter

Status: ⚠️ ready-for-dev
Created Date: 2026-01-29
Priority: P1
Epic: 3 (Horse Management)
FR: FR-H5

## Story

As a **player**,
I want to **search and filter my horses**,
So that **I can quickly find specific horses**.

## Acceptance Criteria

**Given** I am on the horses page
**When** I use search or filters
**Then** results update in real-time

**And** search works on name, breed, traits
**And** filters include: age range, discipline, breed, training status
**And** filters persist in URL for bookmarking
**And** clear filters button resets all

**Prerequisites:** Story 3.1 (Horse List View) ✅ Complete

---

## 🎯 Ultimate Context Engine Analysis

### Epic Context

**Epic 3: Horse Management** (P0 - Nearly Complete)
- **Goal:** Allow users to view, manage, and search their horses with full attribute visibility
- **Status:** Stories 3-1 through 3-5 completed; 3-6 (this story) final story before epic completion
- **FRs Covered:** FR-H1, FR-H2, FR-H3, FR-H4, FR-H5 (this story)

### Story Foundation

**Business Value:**
- Enables players to efficiently manage large stables of horses
- Search and filter are critical for finding horses for specific purposes (breeding, training, competition)
- URL persistence allows bookmarking and sharing filtered views
- Real-time updates provide immediate feedback during filtering

**User Flow:**
1. User views horse list page (Story 3-1 foundation ✅)
2. User enters search term or applies filters
3. Results update in real-time without page reload
4. Filters are reflected in URL for bookmarking
5. User can clear all filters with one click
6. User clicks on horse to view details (Story 3-2 ✅)

---

## 🔬 Previous Story Intelligence

### Story 3-1: Horse List View (Completed)

**Key Learnings:**
- ✅ HorseListView component exists with grid layout
- ✅ Uses React Query with useHorses hook for data fetching
- ✅ Displays horse cards with basic info
- ✅ Pattern: Responsive grid (1/2/3/4 cols based on screen size)
- ✅ Location: `frontend/src/components/HorseListView.tsx`

**Components Created:**
- HorseListView with loading/error states
- HorseCard for individual horse display
- Grid layout with responsive breakpoints

**Technical Patterns Established:**
```typescript
// React Query pattern from Story 3-1
const { data: horses, isLoading, error } = useHorses();

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
```

### Story 3-5: Conformation Scoring UI (Just Completed)

**Key Learnings:**
- ✅ Frontend-first approach with mock data works well
- ✅ React Query hooks with proper caching (staleTime, gcTime)
- ✅ Comprehensive test coverage (100+ tests)
- ✅ Component patterns: loading states, error handling, retry buttons
- ✅ URL state management can be added with React Router's useSearchParams

---

## 📋 Architecture Requirements

### Technology Stack

**Required:**
- React 19 with TypeScript strict mode
- React Query (TanStack Query) for state management
- React Router v6 for URL state management (useSearchParams)
- TailwindCSS 3.4 for styling
- Vitest + React Testing Library for testing
- Lucide React for icons

**Forbidden:**
- ❌ Redux, Zustand, or other state management (use React Query only)
- ❌ Inline styles (use TailwindCSS classes)
- ❌ `any` types (use proper TypeScript types)

### File Organization

```
frontend/src/
├── components/
│   ├── horse/
│   │   ├── HorseSearchBar.tsx (NEW)
│   │   ├── HorseFilters.tsx (NEW)
│   │   └── __tests__/
│   │       ├── HorseSearchBar.test.tsx (NEW)
│   │       └── HorseFilters.test.tsx (NEW)
│   ├── HorseListView.tsx (MODIFY - add search/filter)
│   └── __tests__/
│       └── HorseListView.test.tsx (MODIFY - add search/filter tests)
├── hooks/
│   ├── api/
│   │   └── useHorses.ts (REVIEW - may need filtering support)
│   ├── useHorseFilters.ts (NEW - URL state management)
│   └── __tests__/
│       └── useHorseFilters.test.tsx (NEW)
├── lib/
│   └── utils/
│       ├── horse-filter-utils.ts (NEW - filter logic)
│       └── __tests__/
│           └── horse-filter-utils.test.ts (NEW)
└── pages/
    └── StableView.tsx (REVIEW - uses HorseListView)
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
- 100% test coverage for new utilities
- 80%+ coverage for new components
- Test user interactions (click, type, select)
- Test URL state persistence
- Test edge cases (empty results, invalid filters)

**Accessibility Requirements:**
- ARIA labels for all interactive elements
- Keyboard navigation support (Tab, Enter, Escape)
- Screen reader friendly
- Focus management

---

## 🎨 Design System & Visual Requirements

### Search Bar Component

**Features:**
- Text input with search icon
- Placeholder: "Search horses by name, breed, or traits..."
- Clear button (X) appears when text is entered
- Debounced search (300ms delay)
- Keyboard shortcuts: Escape to clear

**Visual Design:**
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
  <input
    type="text"
    placeholder="Search horses by name, breed, or traits..."
    className="w-full pl-10 pr-10 py-3 border rounded-lg"
  />
  {hasText && (
    <button className="absolute right-3 top-1/2 -translate-y-1/2">
      <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
    </button>
  )}
</div>
```

### Filters Component

**Filter Types:**

1. **Age Range** (slider or number inputs)
   - Min age: 0-30
   - Max age: 0-30
   - Default: No filter (all ages)

2. **Breed** (dropdown select)
   - Options: All breeds from database
   - Multi-select or single select
   - Default: All breeds

3. **Discipline** (checkbox group or dropdown)
   - Racing, Dressage, Show Jumping, Eventing, Endurance, Trail
   - Default: All disciplines

4. **Training Status** (radio buttons or dropdown)
   - Options: Trained, Untrained, In Training, All
   - Default: All

**Visual Layout:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <AgeRangeFilter />
  <BreedFilter />
  <DisciplineFilter />
  <TrainingStatusFilter />
</div>
<div className="flex justify-end mt-4">
  <button className="text-sm text-blue-600 hover:text-blue-700">
    Clear all filters
  </button>
</div>
```

### Results Display

**Visual Feedback:**
- Results count: "Showing X of Y horses"
- Empty state: "No horses match your search"
- Loading state: Skeleton cards
- Error state: Retry button

---

## 🔌 Backend API Integration

### Expected API Endpoints

**Option 1: Client-side filtering (Frontend-first approach)**
```
GET /api/horses
Returns: All horses for user
Filter logic: Implemented in frontend
```

**Option 2: Server-side filtering (Future optimization)**
```
GET /api/horses?search=thunder&breed=arabian&minAge=3&maxAge=10&discipline=racing
Returns: Filtered horses
```

**Frontend-First Strategy:**
- Fetch all horses with `useHorses` hook
- Filter client-side using filter utilities
- Document server-side filtering for future optimization
- Monitor performance with large horse counts

---

## 📋 Implementation Plan

### Task 1: Create Filter Utilities (AC: Filter logic)
**Time Estimate:** 1-2 hours
**Priority:** P0 (Foundation)

**File:** `frontend/src/lib/utils/horse-filter-utils.ts`

**Functions to Implement:**
```typescript
// Filter horses by search term
export function filterBySearch(
  horses: Horse[],
  searchTerm: string
): Horse[]

// Filter horses by age range
export function filterByAgeRange(
  horses: Horse[],
  minAge?: number,
  maxAge?: number
): Horse[]

// Filter horses by breed
export function filterByBreed(
  horses: Horse[],
  breedIds: string[]
): Horse[]

// Filter horses by discipline
export function filterByDiscipline(
  horses: Horse[],
  disciplines: string[]
): Horse[]

// Filter horses by training status
export function filterByTrainingStatus(
  horses: Horse[],
  status: 'trained' | 'untrained' | 'in_training' | 'all'
): Horse[]

// Apply all filters
export function applyFilters(
  horses: Horse[],
  filters: HorseFilters
): Horse[]
```

**Test File:** `frontend/src/lib/utils/__tests__/horse-filter-utils.test.ts`
- Test each filter function independently
- Test combined filters
- Test edge cases (empty arrays, null values)
- Target: 100% coverage (30+ tests)

---

### Task 2: Create URL State Management Hook (AC: URL persistence)
**Time Estimate:** 1-2 hours
**Priority:** P0 (Core functionality)

**File:** `frontend/src/hooks/useHorseFilters.ts`

**Hook Implementation:**
```typescript
export interface HorseFilters {
  search: string;
  minAge?: number;
  maxAge?: number;
  breedIds: string[];
  disciplines: string[];
  trainingStatus: 'all' | 'trained' | 'untrained' | 'in_training';
}

export function useHorseFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: HorseFilters = {
    search: searchParams.get('search') || '',
    minAge: parseIntOrUndefined(searchParams.get('minAge')),
    maxAge: parseIntOrUndefined(searchParams.get('maxAge')),
    breedIds: searchParams.get('breeds')?.split(',') || [],
    disciplines: searchParams.get('disciplines')?.split(',') || [],
    trainingStatus: (searchParams.get('status') as any) || 'all',
  };

  const setFilters = (newFilters: Partial<HorseFilters>) => {
    // Update URL search params
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  return { filters, setFilters, clearFilters };
}
```

**Test File:** `frontend/src/hooks/__tests__/useHorseFilters.test.tsx`
- Test reading filters from URL
- Test updating filters (URL updates)
- Test clearing filters
- Test default values
- Target: 20+ tests

---

### Task 3: Create HorseSearchBar Component (AC: Search functionality)
**Time Estimate:** 2-3 hours
**Priority:** P0 (Core UI)

**File:** `frontend/src/components/horse/HorseSearchBar.tsx`

**Component Features:**
- Debounced search input (300ms delay)
- Clear button when text is present
- Search icon on left
- Keyboard support (Escape to clear)
- Accessible with ARIA labels

**Test File:** `frontend/src/components/horse/__tests__/HorseSearchBar.test.tsx`
- Test typing triggers onChange with debounce
- Test clear button appears/works
- Test Escape key clears input
- Test accessibility
- Target: 25+ tests

---

### Task 4: Create HorseFilters Component (AC: Filter UI)
**Time Estimate:** 3-4 hours
**Priority:** P0 (Core UI)

**File:** `frontend/src/components/horse/HorseFilters.tsx`

**Component Features:**
- Age range inputs (min/max)
- Breed dropdown/select
- Discipline checkboxes
- Training status radio/select
- Clear all filters button
- Responsive layout

**Test File:** `frontend/src/components/horse/__tests__/HorseFilters.test.tsx`
- Test each filter input works
- Test clear all filters
- Test filter combinations
- Test accessibility
- Target: 35+ tests

---

### Task 5: Integrate Search & Filters into HorseListView (AC: All)
**Time Estimate:** 2-3 hours
**Priority:** P0 (Integration)

**File:** `frontend/src/components/HorseListView.tsx` (MODIFY)

**Changes:**
- Add HorseSearchBar at top
- Add HorseFilters below search
- Apply filters to horses list
- Display results count
- Handle empty results state

**Test File:** `frontend/src/components/__tests__/HorseListView.test.tsx` (MODIFY)
- Test search updates results
- Test filters update results
- Test URL state persistence
- Test clear filters
- Test empty results
- Target: Add 30+ new tests

---

### Task 6: Testing & Documentation (AC: Quality)
**Time Estimate:** 2-3 hours
**Priority:** P1 (Quality assurance)

**Activities:**
- Run all tests and verify 100% pass rate
- Test user flows end-to-end
- Verify URL bookmarking works
- Check accessibility with screen reader
- Performance test with 100+ horses
- Update component documentation

**Acceptance Criteria:**
- [ ] All tests passing (100+ new tests)
- [ ] URL persistence verified
- [ ] Accessibility audit passed
- [ ] Performance acceptable with large datasets
- [ ] Documentation updated

---

## 🎯 Definition of Done

- [ ] All acceptance criteria met
- [ ] Search works on name, breed, traits
- [ ] Filters work: age, breed, discipline, training status
- [ ] Results update in real-time
- [ ] Filters persist in URL
- [ ] Clear filters button works
- [ ] 100+ tests passing
- [ ] Accessibility compliant (WCAG 2.1 AA)
- [ ] Mobile responsive
- [ ] Documentation updated

---

## 🔗 References

- [Source: docs/epics.md#Story-3.6] - Story definition
- [Component: frontend/src/components/HorseListView.tsx] - Integration point
- [Hook: frontend/src/hooks/api/useHorses.ts] - Data fetching
- FR-H5: Horse search and filter requirement

---

**Created:** 2026-01-29
**Status:** Ready for Development
**Prerequisites:** Story 3.1 ✅ Complete
**Estimated Effort:** 11-17 hours total
