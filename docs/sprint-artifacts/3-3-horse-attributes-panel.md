# Story 3.3: Horse Attributes Panel

Status: ⚠️ in_progress
Started Date: 2025-12-05

## Story

As a **player**,
I want to **see all horse attributes including genetics and traits**,
So that **I can make informed breeding and training decisions**.

## Acceptance Criteria

**Given** I am viewing a horse's detail page
**When** I view the attributes tab
**Then** I see all stats, discipline scores, genetic traits

**And** genetic traits show inheritance information
**And** epigenetic traits show with discovery status
**And** stats show with visual bars and numeric values

**Prerequisites:** Story 3.2 ✅ Complete

## Current Implementation Status

### 📊 Analysis Complete

**Existing Components:**
- ✅ HorseDetailPage exists (frontend/src/pages/HorseDetailPage.tsx)
- ✅ Genetics tab implemented (lines 412-463) with basic functionality:
  - Traits displayed as simple badges
  - Lineage section with parent links
  - Placeholder text for genetic analysis
- ✅ Overview tab shows stats with visual elements
- ✅ Disciplines tab shows discipline scores with progress bars

**Current Genetics Tab (Lines 412-463):**
- Basic trait display as badges (line 420-433)
- Parent links for sire and dam (line 437-460)
- Generic placeholder text (line 415-418)

**Missing Features:**
- ❌ Genetic alleles and phenotypes display
- ❌ Trait cards with detailed tooltips
- ❌ Color-coded trait categories (genetic, epigenetic, rare, common)
- ❌ Inheritance information (which parent passed the trait)
- ❌ Epigenetic traits with discovery status
- ❌ Trait interaction indicators
- ❌ Genetic strength/quality indicators

**Backend API Support:**
- ✅ Main endpoint: GET /api/horses/:id (backend/routes/horseRoutes.mjs:203)
  - Returns basic horse data with traits array
- ✅ Advanced genetics endpoints available:
  - `/api/horses/:id/trait-interactions` (advancedEpigeneticRoutes.mjs:305)
  - `/api/horses/:id/trait-matrix` (advancedEpigeneticRoutes.mjs:345)
  - `/api/horses/:id/enhanced-trait-history` (enhancedReportingRoutes.mjs:113)
  - `/api/horses/:id/epigenetic-insights` (enhancedReportingRoutes.mjs:182)
  - `/api/horses/:id/trait-timeline` (enhancedReportingRoutes.mjs:249)

### 🎯 Implementation Plan

#### Task 1: Design Enhanced Trait Card Component (AC: All)
**Time Estimate:** 2-3 hours
- Create `TraitCard.tsx` component
- Support multiple trait types (genetic, epigenetic)
- Include tooltip on hover showing:
  - Trait description
  - Inheritance source (sire, dam, mutation)
  - Discovery date (for epigenetic)
  - Rarity level
  - Impact on stats/disciplines
- Color coding by trait category:
  - Genetic traits: Blue border
  - Epigenetic traits: Purple border
  - Rare traits: Gold accent
  - Common traits: Gray accent
  - Legendary traits: Rainbow gradient

#### Task 2: Fetch Enhanced Genetic Data (AC: All)
**Time Estimate:** 2-3 hours
- Add React Query hooks for advanced endpoints:
  - `useHorseTraitInteractions(horseId)`
  - `useHorseEpigeneticInsights(horseId)`
  - `useHorseTraitTimeline(horseId)`
- Transform API data to component-friendly format
- Handle loading and error states
- Cache genetic data appropriately

#### Task 3: Replace Current Genetics Tab (AC: All)
**Time Estimate:** 3-4 hours
- Replace simple badge display with TraitCard grid
- Add section for genetic alleles display
- Add section for epigenetic traits with discovery status
- Add section for trait interactions
- Add filtering options:
  - By trait type (genetic/epigenetic)
  - By rarity (common/rare/legendary)
  - By source (inherited/discovered)
- Add sorting options:
  - Alphabetical
  - By discovery date
  - By rarity
  - By impact strength

#### Task 4: Add Genetic Strength Indicators (AC: All)
**Time Estimate:** 2-3 hours
- Add visual indicators for trait strength/quality
- Show genetic potential (0-100 scale)
- Display trait stability indicators
- Add breeding value indicators
- Show optimal trait combinations

#### Task 5: Implement Inheritance Visualization (AC: Inheritance info)
**Time Estimate:** 2-3 hours
- Add parent badge to each inherited trait
- Create inheritance tree visualization (optional)
- Show mutation indicators for non-inherited traits
- Display genetic contribution percentages
- Link to parent horse profiles

#### Task 6: Add Epigenetic Discovery Status (AC: Epigenetic traits)
**Time Estimate:** 2-3 hours
- Display discovery date for each epigenetic trait
- Show activation status (active/dormant)
- Add environmental trigger information
- Display discovery circumstances tooltip
- Show trait maturity/development level

#### Task 7: Write Comprehensive Tests (AC: All)
**Time Estimate:** 3-4 hours
- TraitCard component tests (rendering, tooltips, colors)
- Data fetching tests (React Query hooks)
- Enhanced Genetics tab tests (filtering, sorting, display)
- Inheritance visualization tests
- Epigenetic discovery status tests
- Integration tests for complete attributes panel
- Accessibility tests (keyboard navigation, screen readers)

#### Task 8: Integration and Polish (AC: All)
**Time Estimate:** 2-3 hours
- Verify all three ACs are met
- Test with real API data
- Mobile responsive adjustments
- Loading skeleton states
- Error handling polish
- Performance optimization (lazy loading for large trait lists)
- Accessibility compliance (ARIA labels, focus management)

## Tasks / Subtasks

- [x] **Task 0: Story File Creation** (AC: Foundation)
  - [x] Create story file with analysis and plan
  - [x] Analyze existing HorseDetailPage implementation
  - [x] Review backend API endpoints for genetics
  - [x] Document current Genetics tab implementation

- [ ] **Task 1: TraitCard Component** (AC: All)
  - [ ] Create TraitCard.tsx component
  - [ ] Implement tooltip system
  - [ ] Add color coding for trait categories
  - [ ] Add rarity indicators
  - [ ] Add inheritance badges

- [ ] **Task 2: Data Fetching Layer** (AC: All)
  - [ ] Create React Query hooks for genetics endpoints
  - [ ] Add useHorseTraitInteractions hook
  - [ ] Add useHorseEpigeneticInsights hook
  - [ ] Add useHorseTraitTimeline hook
  - [ ] Transform API data to UI format

- [ ] **Task 3: Enhanced Genetics Tab** (AC: All)
  - [ ] Replace badge display with TraitCard grid
  - [ ] Add genetic alleles section
  - [ ] Add epigenetic traits section
  - [ ] Add trait interactions section
  - [ ] Implement filtering system
  - [ ] Implement sorting system

- [ ] **Task 4: Genetic Strength Display** (AC: All)
  - [ ] Add trait strength indicators
  - [ ] Add genetic potential display
  - [ ] Add trait stability visualization
  - [ ] Add breeding value indicators
  - [ ] Show optimal combinations

- [ ] **Task 5: Inheritance Visualization** (AC: Inheritance)
  - [ ] Add parent badges to inherited traits
  - [ ] Create inheritance tree (optional)
  - [ ] Add mutation indicators
  - [ ] Show genetic contribution percentages
  - [ ] Link to parent profiles

- [ ] **Task 6: Epigenetic Discovery** (AC: Epigenetic)
  - [ ] Display discovery dates
  - [ ] Show activation status
  - [ ] Add environmental trigger info
  - [ ] Display discovery circumstances
  - [ ] Show trait maturity level

- [ ] **Task 7: Testing** (AC: All)
  - [ ] TraitCard component tests
  - [ ] Data fetching tests
  - [ ] Enhanced Genetics tab tests
  - [ ] Filter and sort tests
  - [ ] Inheritance visualization tests
  - [ ] Epigenetic discovery tests
  - [ ] Integration tests
  - [ ] Accessibility tests

- [ ] **Task 8: Integration & Polish** (AC: All)
  - [ ] Verify all ACs met
  - [ ] Test with real API
  - [ ] Mobile responsive adjustments
  - [ ] Performance optimization
  - [ ] Accessibility compliance

## Technical Notes

### API Integration

**Primary Data Source:**
```typescript
GET /api/horses/:id
Response: {
  success: true,
  data: {
    id: number,
    traits: string[], // Basic traits array
    // ... other horse data
  }
}
```

**Enhanced Genetics Data:**
```typescript
GET /api/horses/:id/trait-interactions
Response: {
  success: true,
  data: {
    interactions: Array<{
      trait1: string,
      trait2: string,
      effect: string,
      strength: number
    }>
  }
}

GET /api/horses/:id/epigenetic-insights
Response: {
  success: true,
  data: {
    traits: Array<{
      name: string,
      type: 'genetic' | 'epigenetic',
      discoveryDate?: string,
      isActive: boolean,
      source: 'sire' | 'dam' | 'mutation',
      rarity: 'common' | 'rare' | 'legendary',
      strength: number,
      impact: {
        stats: Record<string, number>,
        disciplines: Record<string, number>
      }
    }>
  }
}
```

### Component Architecture

```typescript
// New Components
TraitCard
├── TraitBadge (icon, name, rarity indicator)
├── TraitTooltip (detailed information)
├── InheritanceBadge (parent indicator)
└── StrengthMeter (visual strength indicator)

// Enhanced Genetics Tab Structure
GeneticsTab
├── TraitFilters (type, rarity, source)
├── TraitSorting (dropdown)
├── GeneticAlleles Section
│   └── TraitCard Grid
├── EpigeneticTraits Section
│   └── TraitCard Grid (with discovery info)
├── TraitInteractions Section
│   └── Interaction Cards
└── Lineage Section (existing parent links)
```

### TraitCard Component API

```typescript
interface TraitCardProps {
  trait: {
    name: string;
    type: 'genetic' | 'epigenetic';
    description: string;
    source?: 'sire' | 'dam' | 'mutation';
    discoveryDate?: string;
    isActive?: boolean;
    rarity: 'common' | 'rare' | 'legendary';
    strength: number; // 0-100
    impact: {
      stats?: Record<string, number>;
      disciplines?: Record<string, number>;
    };
  };
  onViewParent?: (parentId: number) => void;
  showTooltip?: boolean;
}
```

### Color Scheme

**Trait Categories:**
- Genetic traits: `border-blue-500` with `bg-blue-50`
- Epigenetic traits: `border-purple-500` with `bg-purple-50`
- Rare traits: `border-gold-500` with gold sparkle effect
- Legendary traits: `border-gradient` with rainbow animation

**Strength Indicators:**
- 0-25: `text-mystic-silver` (Low)
- 26-50: `text-aged-bronze` (Medium)
- 51-75: `text-forest-green` (High)
- 76-100: `text-burnished-gold` (Exceptional)

### Reusable Patterns

**Stats Display (from Overview tab):**
```typescript
// Stat icon and color patterns already established
const getStatIcon = (statName: string) => { /* existing */ };
const getStatColor = (value: number) => { /* existing */ };
```

**Progress Bar Pattern (from Disciplines tab):**
```typescript
// Reuse for trait strength visualization
<div className="h-3 bg-parchment rounded-full overflow-hidden border border-aged-bronze">
  <div className={`h-full ${getStatColor(strength)}`} style={{ width: `${strength}%` }} />
</div>
```

## Dependencies

- Story 3.2 (Horse Detail View) ✅ Complete
- Backend genetics endpoints ✅ Available
- React Query ✅ Already configured
- Tooltip component library (or custom implementation)
- Icon library (Lucide React) ✅ Available

## Success Metrics

- [ ] All 3 acceptance criteria met
- [ ] Genetic traits show inheritance information
- [ ] Epigenetic traits show discovery status
- [ ] Stats and disciplines show visual bars
- [ ] Test coverage maintains 80%+
- [ ] Component renders in <500ms with 50+ traits
- [ ] Mobile and desktop views functional
- [ ] Accessible via keyboard navigation
- [ ] Tooltips work on hover and focus

## References

- [Source: docs/epics.md#Story-3.3] - Story definition (lines 609-631)
- [Component: frontend/src/pages/HorseDetailPage.tsx] - Existing Genetics tab (lines 412-463)
- [API: backend/routes/horseRoutes.mjs:203] - Main horse endpoint
- [API: backend/routes/advancedEpigeneticRoutes.mjs] - Advanced genetics endpoints
- [API: backend/routes/enhancedReportingRoutes.mjs] - Trait reporting endpoints
- FR-H1: Horse management requirement

## Dev Agent Record

### Context Reference

- docs/epics.md - Epic 3, Story 3.3 definition (lines 609-631)
- docs/sprint-artifacts/sprint-status.yaml - Sprint tracking
- docs/sprint-artifacts/3-2-horse-detail-view.md - Prerequisite story
- frontend/src/pages/HorseDetailPage.tsx - Existing Genetics tab (lines 412-463)
- backend/routes/horseRoutes.mjs - Main horse API
- backend/routes/advancedEpigeneticRoutes.mjs - Advanced genetics APIs
- backend/routes/enhancedReportingRoutes.mjs - Trait reporting APIs

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### File List

**Existing Files (Reference):**
- `frontend/src/pages/HorseDetailPage.tsx` (475 lines) - Contains current Genetics tab
- `backend/routes/horseRoutes.mjs` (line 203) - Main horse API endpoint
- `backend/routes/advancedEpigeneticRoutes.mjs` - Advanced genetics endpoints
- `backend/routes/enhancedReportingRoutes.mjs` - Trait reporting endpoints

**To Create:**
- `frontend/src/components/TraitCard.tsx` - Enhanced trait card with tooltip
- `frontend/src/components/__tests__/TraitCard.test.tsx` - TraitCard tests
- `frontend/src/hooks/useHorseGenetics.ts` - React Query hooks for genetics data
- `frontend/src/hooks/__tests__/useHorseGenetics.test.ts` - Genetics hooks tests

**To Modify:**
- `frontend/src/pages/HorseDetailPage.tsx` - Replace current GeneticsTab (lines 412-463)
- `frontend/src/pages/__tests__/HorseDetailPage.test.tsx` - Add genetics tab tests

## Estimated Effort

- **Total:** 19-27 hours
  - TraitCard Component: 2-3 hours
  - Data Fetching Layer: 2-3 hours
  - Enhanced Genetics Tab: 3-4 hours
  - Genetic Strength Display: 2-3 hours
  - Inheritance Visualization: 2-3 hours
  - Epigenetic Discovery: 2-3 hours
  - Testing: 3-4 hours
  - Integration & Polish: 2-3 hours

---

**Created:** 2025-12-05
**Status:** In Progress
**Prerequisites:** Story 3-2 ✅ Complete
