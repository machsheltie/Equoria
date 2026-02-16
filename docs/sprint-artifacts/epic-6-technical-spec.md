# Epic 6: Breeding & Foal Development - Technical Specification

**Version:** 1.0
**Created:** 2026-02-06
**Status:** 📋 Planning
**Approach:** Sequential (Option A)
**Quality Bar:** Comprehensive Implementation
**Testing Strategy:** Tests alongside development

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Technical Architecture](#technical-architecture)
3. [Story 6-1: Breeding Pair Selection](#story-6-1-breeding-pair-selection)
4. [Story 6-2: Foal Milestone Timeline](#story-6-2-foal-milestone-timeline)
5. [Story 6-3: Enrichment Activity UI](#story-6-3-enrichment-activity-ui)
6. [Story 6-4: Milestone Evaluation Display](#story-6-4-milestone-evaluation-display)
7. [Story 6-5: Breeding Predictions](#story-6-5-breeding-predictions-p1)
8. [Story 6-6: Epigenetic Trait System](#story-6-6-epigenetic-trait-system)
9. [Cross-Story Patterns](#cross-story-patterns)
10. [Testing Strategy](#testing-strategy)
11. [Success Criteria](#success-criteria)

---

## Epic Overview

### Goals
Implement the breeding gameplay loop frontend, connecting to fully-implemented backend APIs. Enable players to:
- Select breeding pairs and initiate breeding
- Track foal development through 5 milestones
- Perform enrichment activities during critical development period
- View milestone evaluation results and trait development
- Analyze breeding predictions (P1 stretch)
- View and manage epigenetic trait systems

### Constraints
- Backend: ✅ 100% Complete (no backend changes needed)
- Frontend: Pure UI/integration work
- All APIs tested and documented
- Must use Recharts for visualizations (per ADR-004)
- Must use BaseModal for dialogs (per AI-5-1)
- Must follow pattern library guidelines (per AI-5-5)

### Dependencies
- Epic 3: Horse Management (completed)
- Prep Sprint deliverables (completed)
- Backend APIs: All available and tested

---

## Technical Architecture

### Frontend Stack
- **Framework:** React 19 + TypeScript
- **State Management:** React Query (with documented cache strategies)
- **Routing:** React Router
- **UI Components:** Custom components + BaseModal
- **Charts:** Recharts (standardized per ADR-004)
- **Styling:** Tailwind CSS
- **Testing:** Vitest + React Testing Library

### Component Hierarchy (Epic-Level)

```
Epic 6 Routes
├── /breeding
│   ├── BreedingPairSelection (6-1)
│   └── BreedingPredictions (6-5)
├── /foals/:id
│   ├── FoalDevelopmentDashboard
│   │   ├── FoalMilestoneTimeline (6-2)
│   │   ├── EnrichmentActivityPanel (6-3)
│   │   └── MilestoneEvaluationHistory (6-4)
│   └── FoalProfile
│       └── EpigeneticTraitDisplay (6-6)
└── /horses/:id
    └── HorseProfile
        └── EpigeneticTraitDisplay (6-6)
```

### API Integration Patterns

**React Query Strategy:**
```typescript
// Foal data (changes frequently during development)
const foalQuery = useQuery({
  queryKey: ['foal', foalId],
  queryFn: () => fetchFoalDevelopment(foalId),
  staleTime: 30000, // 30 seconds
  gcTime: 120000,    // 2 minutes
  refetchOnFocus: true
});

// Trait definitions (static reference data)
const traitDefsQuery = useQuery({
  queryKey: ['trait-definitions'],
  queryFn: fetchTraitDefinitions,
  staleTime: 600000,  // 10 minutes
  gcTime: 1800000,    // 30 minutes
  refetchOnFocus: false
});
```

### Shared Types (Epic-Level)

```typescript
// types/breeding.ts
export interface BreedingPair {
  sire: Horse;
  dam: Horse;
  compatibility: CompatibilityAnalysis;
  studFee?: number;
  canBreed: boolean;
  cooldownDays?: number;
}

export interface CompatibilityAnalysis {
  overall: number; // 0-100
  temperamentMatch: number;
  traitSynergy: number;
  geneticDiversity: number;
  recommendations: string[];
}

// types/foal.ts
export interface Foal extends Horse {
  birthDate: string;
  ageInDays: number;
  currentMilestone: MilestoneType | null;
  completedMilestones: MilestoneType[];
  developmentStage: 'newborn' | 'week1' | 'week2' | 'week3' | 'week4' | 'mature';
}

export interface Milestone {
  type: MilestoneType;
  name: string;
  ageWindow: { min: number; max: number }; // days
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  evaluationDate?: string;
  score?: number;
  traitsConfirmed?: string[];
}

export type MilestoneType =
  | 'imprinting'
  | 'socialization'
  | 'curiosity_play'
  | 'trust_handling'
  | 'confidence_reactivity';

// types/enrichment.ts
export interface EnrichmentActivity {
  id: string;
  name: string;
  description: string;
  category: 'trust' | 'desensitization' | 'exposure' | 'habituation';
  benefits: string[];
  duration: number; // minutes
  cooldown: number; // hours
  minAge: number;   // days
  maxAge: number;   // days
  icon: string;
}

export interface EnrichmentCompletion {
  activityId: string;
  completedAt: string;
  foalId: string;
  impact: {
    bondIncrease: number;
    traitProgress: { [key: string]: number };
  };
}

// types/traits.ts
export interface EpigeneticTrait {
  id: string;
  name: string;
  category: 'behavioral' | 'conditional' | 'temporary' | 'ultra-rare' | 'exotic';
  tier?: 'ultra-rare' | 'exotic';
  description: string;
  effects: TraitEffect[];
  developedAt?: string;
  source?: 'groom' | 'milestone' | 'competition';
  hidden: boolean;
}

export interface TraitEffect {
  type: 'stat' | 'bonus' | 'penalty' | 'special';
  target: string;
  value: number;
  description: string;
}

export interface EpigeneticFlag {
  id: string;
  name: string;
  category: 'confidence' | 'social' | 'resilience';
  effect: string;
  trigger: string;
  assignedAt?: string;
}
```

---

## Story 6-1: Breeding Pair Selection

**Priority:** P0
**Estimate:** 1 day
**Prerequisites:** Epic 3 (Horse Management)
**Backend:** ✅ Complete

### User Stories

**US-6-1-1:** As a player, I want to select a sire and dam from my horses so I can initiate breeding.

**US-6-1-2:** As a player, I want to see breeding compatibility analysis so I can make informed breeding decisions.

**US-6-1-3:** As a player, I want to see breeding cooldown status so I know which horses are available for breeding.

**US-6-1-4:** As a player, I want to confirm breeding with a clear summary so I understand the commitment.

### Acceptance Criteria

**AC-6-1-1:** Breeding pair selection
- [ ] User can access breeding page from horse management
- [ ] User can select sire from owned horses (male, 3+ years old)
- [ ] User can select dam from owned horses (female, 3+ years old)
- [ ] System validates minimum age (3 years) for both parents
- [ ] System displays error if horse is on breeding cooldown
- [ ] System displays error if horse is injured or in poor health

**AC-6-1-2:** Compatibility display
- [ ] System displays overall compatibility score (0-100)
- [ ] System shows temperament match analysis
- [ ] System shows trait synergy score
- [ ] System shows genetic diversity score
- [ ] System provides breeding recommendations

**AC-6-1-3:** Breeding confirmation
- [ ] User sees breeding summary modal (use BaseModal)
- [ ] Summary displays both parent details
- [ ] Summary shows expected gestation period
- [ ] Summary shows stud fee if applicable
- [ ] Summary shows 30-day breeding cooldown notice
- [ ] User can confirm or cancel breeding
- [ ] On confirm: System creates foal record
- [ ] On confirm: System deducts stud fee from user balance
- [ ] On confirm: System applies breeding cooldown to both parents

**AC-6-1-4:** Error handling
- [ ] Display clear error if insufficient funds for stud fee
- [ ] Display clear error if horse is on cooldown (show days remaining)
- [ ] Display clear error if horse is injured
- [ ] Display clear error if breeding attempt fails
- [ ] All errors use consistent error notification pattern

### Component Specification

#### BreedingPairSelection Component

**Location:** `frontend/src/pages/breeding/BreedingPairSelection.tsx`

**Props:**
```typescript
interface BreedingPairSelectionProps {
  userId: string;
}
```

**State Management:**
```typescript
const [selectedSire, setSelectedSire] = useState<Horse | null>(null);
const [selectedDam, setSelectedDam] = useState<Horse | null>(null);
const [showConfirmation, setShowConfirmation] = useState(false);
const [isBreeding, setIsBreeding] = useState(false);

// React Query
const { data: userHorses } = useQuery({
  queryKey: ['horses', userId],
  queryFn: () => fetchUserHorses(userId)
});

const { data: compatibility, isLoading: loadingCompatibility } = useQuery({
  queryKey: ['breeding-compatibility', selectedSire?.id, selectedDam?.id],
  queryFn: () => fetchBreedingCompatibility(selectedSire!.id, selectedDam!.id),
  enabled: !!(selectedSire && selectedDam),
  staleTime: 60000
});

const breedingMutation = useMutation({
  mutationFn: (pair: BreedingPair) => initiateBreeding(pair),
  onSuccess: (foal) => {
    queryClient.invalidateQueries({ queryKey: ['horses', userId] });
    queryClient.invalidateQueries({ queryKey: ['foals'] });
    // Navigate to foal development page
    navigate(`/foals/${foal.id}`);
  }
});
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Breeding Pair Selection                           [Help]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐      ┌─────────────────┐          │
│  │  Select Sire    │      │  Select Dam     │          │
│  │  ┌───────────┐  │      │  ┌───────────┐  │          │
│  │  │ [Search]  │  │      │  │ [Search]  │  │          │
│  │  └───────────┘  │      │  └───────────┘  │          │
│  │                 │      │                 │          │
│  │  [Horse List]   │      │  [Horse List]   │          │
│  │  ☑ Thunder      │      │  ☑ Lightning    │          │
│  │  ☐ Storm        │      │  ☐ Sunshine     │          │
│  │  ☐ Blaze        │      │  ☐ Moonbeam     │          │
│  │    (Cooldown)   │      │    (Injured)    │          │
│  └─────────────────┘      └─────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Compatibility Analysis                             │ │
│  │                                                    │ │
│  │  Overall Score: ████████░░ 85/100                 │ │
│  │                                                    │ │
│  │  Temperament Match:    ████████░░ 82/100          │ │
│  │  Trait Synergy:        █████████░ 90/100          │ │
│  │  Genetic Diversity:    ███████░░░ 78/100          │ │
│  │                                                    │ │
│  │  💡 Recommendations:                               │ │
│  │  • Excellent temperament match                    │ │
│  │  • Strong athletic trait synergy                  │ │
│  │  • Moderate genetic diversity                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Stud Fee: $500          Cooldown: 30 days              │
│                                                          │
│                [Cancel]  [Initiate Breeding]            │
└─────────────────────────────────────────────────────────┘
```

**Subcomponents:**

1. **HorseSelector**
   ```typescript
   interface HorseSelectorProps {
     horses: Horse[];
     selectedHorse: Horse | null;
     onSelect: (horse: Horse) => void;
     filter: 'male' | 'female';
     title: string;
   }
   ```
   - Displays filterable/searchable horse list
   - Shows horse age, health status, breeding cooldown
   - Disables horses that can't breed (age, cooldown, health)
   - Highlights selected horse

2. **CompatibilityDisplay**
   ```typescript
   interface CompatibilityDisplayProps {
     compatibility: CompatibilityAnalysis | null;
     isLoading: boolean;
   }
   ```
   - Shows 4 compatibility scores with progress bars
   - Displays color-coded overall score (green >80, yellow 60-80, red <60)
   - Lists breeding recommendations
   - Shows "Select both parents to see analysis" placeholder

3. **BreedingConfirmationModal** (uses BaseModal)
   ```typescript
   interface BreedingConfirmationModalProps {
     isOpen: boolean;
     onClose: () => void;
     sire: Horse;
     dam: Horse;
     compatibility: CompatibilityAnalysis;
     studFee: number;
     onConfirm: () => void;
     isSubmitting: boolean;
   }
   ```
   - Displays both parent cards with key stats
   - Shows compatibility summary
   - Displays cost breakdown
   - Shows 30-day cooldown warning
   - Confirm/Cancel buttons

### API Integration

**Endpoints Used:**
```typescript
// Get user's horses
GET /api/horses?userId={userId}

// Check breeding compatibility (hypothetical - may need backend)
GET /api/breeding/compatibility?sire={sireId}&dam={damId}
// Note: If this doesn't exist, calculate client-side based on horse data

// Initiate breeding
POST /api/horses/foals
Body: {
  sireId: string;
  damId: string;
  userId: string;
  studFee?: number;
}
Response: {
  foal: Foal;
  message: string;
}
```

**Error Responses:**
```typescript
400 Bad Request:
- "Sire must be at least 3 years old"
- "Dam must be at least 3 years old"
- "Sire is on breeding cooldown (X days remaining)"
- "Dam is on breeding cooldown (X days remaining)"
- "Insufficient funds for stud fee"
- "Sire is injured"
- "Dam is injured"

404 Not Found:
- "Horse not found"
- "User does not own this horse"

500 Server Error:
- "Failed to create foal record"
```

### Testing Requirements

**Unit Tests:**
```typescript
// BreedingPairSelection.test.tsx
describe('BreedingPairSelection', () => {
  describe('Horse Selection', () => {
    it('should display user horses filtered by sex', () => {});
    it('should allow selecting a sire from male horses', () => {});
    it('should allow selecting a dam from female horses', () => {});
    it('should disable horses under 3 years old', () => {});
    it('should disable horses on breeding cooldown', () => {});
    it('should disable injured horses', () => {});
  });

  describe('Compatibility Display', () => {
    it('should show placeholder when no horses selected', () => {});
    it('should fetch compatibility when both horses selected', () => {});
    it('should display compatibility scores with color coding', () => {});
    it('should show breeding recommendations', () => {});
  });

  describe('Breeding Initiation', () => {
    it('should open confirmation modal when breed button clicked', () => {});
    it('should display breeding summary in modal', () => {});
    it('should initiate breeding on confirm', () => {});
    it('should close modal on cancel', () => {});
    it('should navigate to foal page on success', () => {});
  });

  describe('Error Handling', () => {
    it('should display error if insufficient funds', () => {});
    it('should display error if horse on cooldown', () => {});
    it('should display error if horse injured', () => {});
    it('should display error if breeding fails', () => {});
  });
});

// HorseSelector.test.tsx
describe('HorseSelector', () => {
  it('should render horse list filtered by sex', () => {});
  it('should filter horses by search query', () => {});
  it('should disable invalid horses', () => {});
  it('should highlight selected horse', () => {});
  it('should call onSelect when horse clicked', () => {});
});

// CompatibilityDisplay.test.tsx
describe('CompatibilityDisplay', () => {
  it('should show loading state', () => {});
  it('should display compatibility scores', () => {});
  it('should color-code overall score', () => {});
  it('should render recommendations list', () => {});
});
```

**Integration Tests:**
```typescript
describe('Breeding Flow Integration', () => {
  it('should complete full breeding process', async () => {
    // 1. Render breeding page
    // 2. Select sire
    // 3. Select dam
    // 4. Verify compatibility loads
    // 5. Click breed button
    // 6. Verify modal opens
    // 7. Click confirm
    // 8. Verify API called
    // 9. Verify navigation to foal page
  });
});
```

### Success Criteria

- [ ] All acceptance criteria met
- [ ] All unit tests passing (target: 15+ tests)
- [ ] Integration test passing
- [ ] Component renders correctly on mobile and desktop
- [ ] Breeding successfully creates foal record
- [ ] Error states handled gracefully
- [ ] Loading states provide good UX
- [ ] Follows pattern library guidelines
- [ ] Uses BaseModal for confirmation
- [ ] Code review completed

---

## Story 6-2: Foal Milestone Timeline

**Priority:** P0
**Estimate:** 1 day
**Prerequisites:** Story 6-1
**Backend:** ✅ Complete

### User Stories

**US-6-2-1:** As a player, I want to see my foal's development timeline so I understand their growth stages.

**US-6-2-2:** As a player, I want to see which milestones are completed and which are pending so I can plan care activities.

**US-6-2-3:** As a player, I want to see days until next milestone so I know when to check back.

**US-6-2-4:** As a player, I want to visualize the development progress so I can track foal growth at a glance.

### Acceptance Criteria

**AC-6-2-1:** Timeline visualization
- [ ] Display foal age in days prominently
- [ ] Display all 5 milestones in chronological order
- [ ] Use Recharts for timeline visualization
- [ ] Show milestone markers at appropriate positions
- [ ] Indicate current development stage
- [ ] Use color coding: completed (green), in-progress (blue), pending (gray)

**AC-6-2-2:** Milestone details
- [ ] Display milestone name and age window
- [ ] Show milestone description
- [ ] Indicate completion status
- [ ] Show evaluation score if completed
- [ ] Display traits confirmed if evaluation complete

**AC-6-2-3:** Progress tracking
- [ ] Show days until next milestone
- [ ] Display progress bar for current milestone
- [ ] Show overall development progress (0-100%)
- [ ] Update in real-time as foal ages

**AC-6-2-4:** Responsive design
- [ ] Timeline renders correctly on mobile
- [ ] Timeline renders correctly on tablet
- [ ] Timeline renders correctly on desktop
- [ ] Touch interactions work on mobile

### Component Specification

#### FoalMilestoneTimeline Component

**Location:** `frontend/src/components/foal/FoalMilestoneTimeline.tsx`

**Props:**
```typescript
interface FoalMilestoneTimelineProps {
  foal: Foal;
  milestones: Milestone[];
}
```

**State Management:**
```typescript
const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

// React Query - foal data refreshes frequently
const { data: foalDevelopment } = useQuery({
  queryKey: ['foal-development', foal.id],
  queryFn: () => fetchFoalDevelopment(foal.id),
  staleTime: 30000,  // 30 seconds
  refetchInterval: 60000, // Refresh every minute for age updates
  refetchOnFocus: true
});

// Milestone definitions (static)
const { data: milestoneDefinitions } = useQuery({
  queryKey: ['milestone-definitions'],
  queryFn: fetchMilestoneDefinitions,
  staleTime: 600000,
  refetchOnFocus: false
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Foal Development Timeline                              [Help] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Thunder Jr. (Colt) - Age: 12 days old                       │
│  Born: Feb 1, 2026                                            │
│                                                               │
│  Development Progress: ████████░░ 40%                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                 Timeline Visualization                    ││
│  │  (Recharts ComposedChart)                                ││
│  │                                                           ││
│  │  Day 1    Week 1   Week 2   Week 3   Week 4              ││
│  │    ●─────────●─────────●─────────○─────────○             ││
│  │    ✓        ✓         ▶        ...       ...            ││
│  │                                                           ││
│  │  ✓ = Completed   ▶ = Current   ○ = Pending              ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Current Milestone: Curiosity & Play                       ││
│  │ Age Window: 7-14 days                                     ││
│  │ Days Remaining: 2 days                                    ││
│  │                                                           ││
│  │ 🎯 Focus: Exploration and play behavior development      ││
│  │                                                           ││
│  │ Progress: ████████░░ 71% (Day 12 of 14)                  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Milestone History                                      │  │
│  │                                                        │  │
│  │ ✅ Day 1: Imprinting (Completed)                       │  │
│  │    Score: +4  Trait: peopleOriented confirmed         │  │
│  │                                                        │  │
│  │ ✅ Week 1: Socialization (Completed)                   │  │
│  │    Score: +3  Trait: confident confirmed              │  │
│  │                                                        │  │
│  │ ▶️ Week 2: Curiosity & Play (In Progress)             │  │
│  │    Enrichment activities: 3/5 completed                │  │
│  │                                                        │  │
│  │ ⏳ Week 3: Trust & Handling (Upcoming)                 │  │
│  │    Begins in: 2 days                                   │  │
│  │                                                        │  │
│  │ ⏳ Week 4: Confidence vs Reactivity (Future)          │  │
│  │    Begins in: 9 days                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Recharts Implementation:**
```typescript
<ResponsiveContainer width="100%" height={300}>
  <ComposedChart
    data={milestoneData}
    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
  >
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis
      dataKey="name"
      tick={{ fontSize: 12 }}
      interval={0}
    />
    <YAxis hide />
    <Tooltip content={<MilestoneTooltip />} />
    <Line
      type="monotone"
      dataKey="progress"
      stroke="#3b82f6"
      strokeWidth={3}
      dot={<MilestoneDot />}
      activeDot={{ r: 8 }}
    />
    <Scatter
      dataKey="status"
      fill="#10b981"
      shape={<MilestoneMarker />}
    />
    {/* Reference lines for age windows */}
    <ReferenceLine
      x={currentMilestone}
      stroke="#3b82f6"
      strokeDasharray="3 3"
      label="Current"
    />
  </ComposedChart>
</ResponsiveContainer>
```

**Milestone Data Structure:**
```typescript
const milestoneData = milestones.map(milestone => ({
  name: milestone.name,
  ageDay: milestone.ageWindow.min,
  progress: calculateProgress(milestone, foal.ageInDays),
  status: getMilestoneStatus(milestone, foal),
  completed: milestone.status === 'completed',
  current: milestone === currentMilestone,
  traits: milestone.traitsConfirmed || []
}));

function calculateProgress(milestone: Milestone, foalAge: number): number {
  if (milestone.status === 'completed') return 100;
  if (foalAge < milestone.ageWindow.min) return 0;

  const window = milestone.ageWindow.max - milestone.ageWindow.min;
  const elapsed = foalAge - milestone.ageWindow.min;
  return Math.min(100, (elapsed / window) * 100);
}
```

**Subcomponents:**

1. **MilestoneDot** (Custom Recharts Component)
   ```typescript
   const MilestoneDot = (props: any) => {
     const { cx, cy, payload } = props;

     let fill = '#9ca3af'; // gray - pending
     if (payload.completed) fill = '#10b981'; // green - completed
     else if (payload.current) fill = '#3b82f6'; // blue - current

     return (
       <circle
         cx={cx}
         cy={cy}
         r={6}
         fill={fill}
         stroke="#fff"
         strokeWidth={2}
       />
     );
   };
   ```

2. **MilestoneTooltip** (Custom Recharts Tooltip)
   ```typescript
   const MilestoneTooltip = ({ active, payload }: any) => {
     if (!active || !payload || !payload.length) return null;

     const data = payload[0].payload;

     return (
       <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
         <p className="font-semibold">{data.name}</p>
         <p className="text-sm text-gray-600">Age: {data.ageDay} days</p>
         <p className="text-sm text-gray-600">Progress: {data.progress}%</p>
         {data.traits.length > 0 && (
           <p className="text-sm text-green-600 mt-1">
             Traits: {data.traits.join(', ')}
           </p>
         )}
       </div>
     );
   };
   ```

3. **MilestoneCard**
   ```typescript
   interface MilestoneCardProps {
     milestone: Milestone;
     foalAge: number;
     onClick: () => void;
     isCurrent: boolean;
   }
   ```
   - Displays milestone name, age window, description
   - Shows completion status icon
   - Shows evaluation score if completed
   - Lists traits confirmed if available
   - Highlights current milestone
   - Clickable to show more details

4. **CurrentMilestonePanel**
   ```typescript
   interface CurrentMilestonePanelProps {
     milestone: Milestone;
     foalAge: number;
     daysRemaining: number;
   }
   ```
   - Displays current milestone focus
   - Shows days remaining in window
   - Displays progress bar
   - Shows enrichment activity count
   - Provides context-specific guidance

### API Integration

**Endpoints Used:**
```typescript
// Get foal development status
GET /api/foals/:id/development
Response: {
  foal: Foal;
  milestones: Milestone[];
  currentMilestone: MilestoneType | null;
  nextMilestone: MilestoneType | null;
  developmentProgress: number; // 0-100
}

// Get milestone definitions (static data)
GET /api/traits/milestone-definitions
Response: {
  milestones: Array<{
    type: MilestoneType;
    name: string;
    description: string;
    ageWindow: { min: number; max: number };
    focus: string;
    traitCategories: string[];
  }>;
}

// Get milestone status for specific foal
GET /api/traits/milestone-status/:horseId
Response: {
  completedMilestones: MilestoneType[];
  currentMilestone: MilestoneType | null;
  evaluations: Array<{
    milestone: MilestoneType;
    score: number;
    traitsConfirmed: string[];
    evaluatedAt: string;
  }>;
}
```

### Testing Requirements

**Unit Tests:**
```typescript
// FoalMilestoneTimeline.test.tsx
describe('FoalMilestoneTimeline', () => {
  describe('Timeline Rendering', () => {
    it('should render all 5 milestones', () => {});
    it('should render Recharts timeline', () => {});
    it('should show completed milestones in green', () => {});
    it('should show current milestone in blue', () => {});
    it('should show pending milestones in gray', () => {});
  });

  describe('Foal Age Display', () => {
    it('should display foal age in days', () => {});
    it('should display birth date', () => {});
    it('should show overall development progress', () => {});
  });

  describe('Current Milestone Panel', () => {
    it('should display current milestone details', () => {});
    it('should show days remaining', () => {});
    it('should display progress bar', () => {});
    it('should show enrichment activity count', () => {});
  });

  describe('Milestone History', () => {
    it('should list all milestones in order', () => {});
    it('should show evaluation scores for completed milestones', () => {});
    it('should display traits confirmed', () => {});
    it('should show upcoming milestone info', () => {});
  });

  describe('Interactive Features', () => {
    it('should allow clicking milestones for details', () => {});
    it('should highlight selected milestone', () => {});
    it('should show milestone tooltip on hover', () => {});
  });

  describe('Real-time Updates', () => {
    it('should update age display every minute', () => {});
    it('should recalculate progress when age changes', () => {});
    it('should transition to next milestone when age window reached', () => {});
  });

  describe('Responsive Design', () => {
    it('should render correctly on mobile', () => {});
    it('should render correctly on tablet', () => {});
    it('should render correctly on desktop', () => {});
  });
});

// MilestoneCard.test.tsx
describe('MilestoneCard', () => {
  it('should display milestone name and age window', () => {});
  it('should show completion icon for completed milestones', () => {});
  it('should highlight current milestone', () => {});
  it('should display evaluation score', () => {});
  it('should list traits confirmed', () => {});
  it('should call onClick when clicked', () => {});
});
```

**Visual Regression Tests:**
```typescript
describe('Timeline Visual Tests', () => {
  it('should match snapshot for newborn foal', () => {});
  it('should match snapshot for foal with 2 milestones complete', () => {});
  it('should match snapshot for foal with all milestones complete', () => {});
});
```

### Success Criteria

- [ ] All acceptance criteria met
- [ ] All unit tests passing (target: 20+ tests)
- [ ] Visual regression tests passing
- [ ] Timeline renders using Recharts correctly
- [ ] Progress updates in real-time
- [ ] Mobile/tablet/desktop responsive
- [ ] Milestone click interactions work
- [ ] Tooltips provide useful information
- [ ] Code review completed

---

## Story 6-3: Enrichment Activity UI

**Priority:** P0
**Estimate:** 1 day
**Prerequisites:** Story 6-2
**Backend:** ✅ Complete

### User Stories

**US-6-3-1:** As a player, I want to see available enrichment activities so I can support my foal's development.

**US-6-3-2:** As a player, I want to perform enrichment activities so I can influence trait development.

**US-6-3-3:** As a player, I want to see enrichment activity cooldowns so I know when I can perform them again.

**US-6-3-4:** As a player, I want to see the benefits of activities so I can make informed choices.

### Acceptance Criteria

**AC-6-3-1:** Activity display
- [ ] Display all available enrichment activities
- [ ] Group activities by category (trust, desensitization, exposure, habituation)
- [ ] Show activity name, description, and icon
- [ ] Display activity benefits list
- [ ] Show duration and cooldown period
- [ ] Indicate age requirements

**AC-6-3-2:** Activity execution
- [ ] User can click activity to perform it
- [ ] System validates foal age requirements
- [ ] System validates activity cooldown
- [ ] System shows confirmation before executing
- [ ] System executes activity via API
- [ ] System displays success notification with impact
- [ ] System updates foal development status

**AC-6-3-3:** Activity history
- [ ] Display completed activities list
- [ ] Show completion timestamps
- [ ] Display impact of each activity (bond increase, trait progress)
- [ ] Allow filtering by category
- [ ] Show total activities completed

**AC-6-3-4:** Cooldown management
- [ ] Show cooldown timer for recently completed activities
- [ ] Disable activities on cooldown
- [ ] Display "Available in X hours" for cooldown activities
- [ ] Update cooldowns in real-time

### Component Specification

#### EnrichmentActivityPanel Component

**Location:** `frontend/src/components/foal/EnrichmentActivityPanel.tsx`

**Props:**
```typescript
interface EnrichmentActivityPanelProps {
  foalId: string;
  foalAge: number; // days
}
```

**State Management:**
```typescript
const [selectedActivity, setSelectedActivity] = useState<EnrichmentActivity | null>(null);
const [showConfirmation, setShowConfirmation] = useState(false);
const [categoryFilter, setCategoryFilter] = useState<string>('all');

// Activity definitions (static)
const { data: activities } = useQuery({
  queryKey: ['enrichment-activities'],
  queryFn: fetchEnrichmentActivities,
  staleTime: 600000, // 10 minutes
  refetchOnFocus: false
});

// Activity history (dynamic)
const { data: activityHistory } = useQuery({
  queryKey: ['enrichment-history', foalId],
  queryFn: () => fetchEnrichmentHistory(foalId),
  staleTime: 30000,
  refetchOnFocus: true
});

// Perform activity mutation
const activityMutation = useMutation({
  mutationFn: (activityId: string) =>
    performEnrichmentActivity(foalId, activityId),
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ['enrichment-history', foalId] });
    queryClient.invalidateQueries({ queryKey: ['foal-development', foalId] });
    // Show success notification with impact
    toast.success(`Activity completed! Bond +${result.impact.bondIncrease}`);
    setShowConfirmation(false);
    setSelectedActivity(null);
  }
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Enrichment Activities                                [Filter] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Categories: [All] [Trust] [Desensitization] [Exposure]      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Trust Building Activities                              │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐             │  │
│  │  │ 🤝 Gentle Touch │  │ 🎯 Lead Training│             │  │
│  │  │ Duration: 15min │  │ Duration: 20min │             │  │
│  │  │ Cooldown: 4hrs  │  │ Cooldown: 6hrs  │             │  │
│  │  │                 │  │                 │             │  │
│  │  │ Benefits:       │  │ Benefits:       │             │  │
│  │  │ • Bond +5       │  │ • Trust +10     │             │  │
│  │  │ • Trust +8      │  │ • peopleOrient. │             │  │
│  │  │                 │  │                 │             │  │
│  │  │ [Perform]       │  │ [4h cooldown]   │             │  │
│  │  └─────────────────┘  └─────────────────┘             │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Desensitization Activities                             │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  ┌─────────────────┐  ┌─────────────────┐             │  │
│  │  │ 🎺 Sound Exposure│ │ 🎪 Novel Objects│             │  │
│  │  │ ...              │  │ ...              │             │  │
│  │  └─────────────────┘  └─────────────────┘             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Activity History (Last 7 days)                         │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  ✅ Gentle Touch - 2 hours ago                         │  │
│  │     Impact: Bond +5, Trust +8                          │  │
│  │                                                        │  │
│  │  ✅ Showground Exposure - 1 day ago                    │  │
│  │     Impact: Confidence +10, crowdReady progress        │  │
│  │                                                        │  │
│  │  ✅ Sound Exposure - 2 days ago                        │  │
│  │     Impact: desensitized progress +15%                 │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Total Activities: 12 | This Week: 3                          │
└───────────────────────────────────────────────────────────────┘
```

**Subcomponents:**

1. **ActivityCard**
   ```typescript
   interface ActivityCardProps {
     activity: EnrichmentActivity;
     foalAge: number;
     lastPerformed?: Date;
     onPerform: (activity: EnrichmentActivity) => void;
   }
   ```
   - Displays activity icon, name, description
   - Shows duration and cooldown
   - Lists benefits with icons
   - Shows cooldown timer if on cooldown
   - Disables if foal age doesn't meet requirements
   - Disables if on cooldown
   - "Perform" button triggers confirmation

2. **ActivityConfirmationModal** (uses BaseModal)
   ```typescript
   interface ActivityConfirmationModalProps {
     isOpen: boolean;
     onClose: () => void;
     activity: EnrichmentActivity;
     foalName: string;
     onConfirm: () => void;
     isSubmitting: boolean;
   }
   ```
   - Shows activity details
   - Lists expected benefits
   - Shows duration commitment
   - Displays cooldown notice
   - Confirm/Cancel buttons

3. **ActivityHistoryList**
   ```typescript
   interface ActivityHistoryListProps {
     history: EnrichmentCompletion[];
     filter?: string;
   }
   ```
   - Lists completed activities chronologically
   - Shows timestamp (relative: "2 hours ago")
   - Displays impact for each activity
   - Allows filtering by category
   - Shows empty state if no history

4. **CategoryFilter**
   ```typescript
   interface CategoryFilterProps {
     categories: string[];
     selected: string;
     onSelect: (category: string) => void;
   }
   ```
   - Displays category buttons
   - Highlights selected category
   - Shows activity count per category
   - "All" option shows all categories

### API Integration

**Endpoints Used:**
```typescript
// Get enrichment activity definitions
GET /api/enrichment/activities
Response: {
  activities: EnrichmentActivity[];
}

// Perform enrichment activity
POST /api/foals/:id/enrichment
Body: {
  activityId: string;
  foalId: string;
}
Response: {
  success: boolean;
  impact: {
    bondIncrease: number;
    traitProgress: { [traitName: string]: number };
  };
  message: string;
}

// Get enrichment history
GET /api/foals/:id/enrichment/history
Response: {
  history: EnrichmentCompletion[];
  totalCount: number;
  thisWeekCount: number;
}
```

**Error Responses:**
```typescript
400 Bad Request:
- "Foal is too young for this activity (min age: X days)"
- "Activity is on cooldown (available in X hours)"
- "Foal has reached maximum activities for today"

404 Not Found:
- "Activity not found"
- "Foal not found"

500 Server Error:
- "Failed to record enrichment activity"
```

### Testing Requirements

**Unit Tests:**
```typescript
// EnrichmentActivityPanel.test.tsx
describe('EnrichmentActivityPanel', () => {
  describe('Activity Display', () => {
    it('should render all enrichment activities', () => {});
    it('should group activities by category', () => {});
    it('should filter activities by selected category', () => {});
    it('should show activity benefits', () => {});
  });

  describe('Activity Execution', () => {
    it('should open confirmation modal when perform clicked', () => {});
    it('should validate foal age before performing', () => {});
    it('should validate cooldown before performing', () => {});
    it('should call API on confirmation', () => {});
    it('should display success notification on completion', () => {});
    it('should invalidate queries after completion', () => {});
  });

  describe('Cooldown Management', () => {
    it('should disable activities on cooldown', () => {});
    it('should display cooldown timer', () => {});
    it('should update cooldown in real-time', () => {});
    it('should enable activity when cooldown expires', () => {});
  });

  describe('Activity History', () => {
    it('should display activity history', () => {});
    it('should show impact for each activity', () => {});
    it('should display relative timestamps', () => {});
    it('should show empty state when no history', () => {});
  });

  describe('Error Handling', () => {
    it('should display error if foal too young', () => {});
    it('should display error if on cooldown', () => {});
    it('should display error if activity fails', () => {});
  });
});

// ActivityCard.test.tsx
describe('ActivityCard', () => {
  it('should render activity details', () => {});
  it('should show benefits list', () => {});
  it('should disable if on cooldown', () => {});
  it('should disable if foal too young', () => {});
  it('should show cooldown timer', () => {});
  it('should call onPerform when clicked', () => {});
});
```

### Success Criteria

- [ ] All acceptance criteria met
- [ ] All unit tests passing (target: 15+ tests)
- [ ] Activities display correctly grouped by category
- [ ] Activity execution triggers API correctly
- [ ] Cooldowns display and update in real-time
- [ ] Success notifications show impact
- [ ] Activity history displays accurately
- [ ] Error states handled gracefully
- [ ] Uses BaseModal for confirmation
- [ ] Code review completed

---

## Story 6-4: Milestone Evaluation Display

**Priority:** P0
**Estimate:** 1 day
**Prerequisites:** Story 6-2
**Backend:** ✅ Complete

### User Stories

**US-6-4-1:** As a player, I want to see milestone evaluation results so I understand how my care affected my foal.

**US-6-4-2:** As a player, I want to see the scoring breakdown so I understand what influenced the outcome.

**US-6-4-3:** As a player, I want to see which traits were confirmed so I know my foal's personality.

**US-6-4-4:** As a player, I want to see evaluation history so I can track my foal's complete development journey.

### Acceptance Criteria

**AC-6-4-1:** Evaluation display
- [ ] System automatically shows evaluation results when milestone completes
- [ ] Display milestone name and completion date
- [ ] Show total evaluation score (-10 to +10 scale)
- [ ] Color code score (green >3, yellow 0-3, red <0)
- [ ] Display evaluation category (Excellent, Good, Neutral, Poor)

**AC-6-4-2:** Scoring breakdown
- [ ] Show Bond Modifier contribution (-2 to +2)
- [ ] Show Task Consistency contribution (0 to +3)
- [ ] Show Care Quality contribution (groom bonuses)
- [ ] Display score calculation explanation
- [ ] Show which factors helped/hurt score

**AC-6-4-3:** Trait confirmation
- [ ] Display traits confirmed by this evaluation
- [ ] Show trait type (positive/negative)
- [ ] Display trait effects and benefits
- [ ] Explain why trait was confirmed (score ≥3 or ≤-3)
- [ ] Show randomized trait if score neutral (-2 to +2)

**AC-6-4-4:** Evaluation history
- [ ] List all completed milestone evaluations
- [ ] Display chronologically (newest first)
- [ ] Show score and traits for each
- [ ] Allow expanding for full details
- [ ] Show progress through development stages

### Component Specification

#### MilestoneEvaluationDisplay Component

**Location:** `frontend/src/components/foal/MilestoneEvaluationDisplay.tsx`

**Props:**
```typescript
interface MilestoneEvaluationDisplayProps {
  foalId: string;
  milestoneType?: MilestoneType; // If showing specific evaluation
  showHistory?: boolean;
}
```

**State Management:**
```typescript
const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);

// Milestone evaluations
const { data: evaluations } = useQuery({
  queryKey: ['milestone-evaluations', foalId],
  queryFn: () => fetchMilestoneEvaluations(foalId),
  staleTime: 60000,
  refetchOnFocus: true
});

// Latest evaluation (for automatic display)
const latestEvaluation = evaluations?.[0];

// Trait definitions for displaying trait details
const { data: traitDefs } = useQuery({
  queryKey: ['trait-definitions'],
  queryFn: fetchTraitDefinitions,
  staleTime: 600000
});
```

**Layout (Evaluation Modal):**
```
┌──────────────────────────────────────────────────────────────┐
│ Milestone Evaluation Results                           [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  🎉 Socialization Milestone Complete!                        │
│  Completed: Feb 8, 2026 (Age: 7 days)                        │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Overall Score: +4                         │  │
│  │              ████████░░ Excellent                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Score Breakdown                                        │  │
│  │                                                        │  │
│  │  Bond Modifier:        +2  ████████████████████████   │  │
│  │  (Excellent bond with groom)                           │  │
│  │                                                        │  │
│  │  Task Consistency:     +2  ████████████████████░░░░   │  │
│  │  (Regular care for 7 days)                             │  │
│  │                                                        │  │
│  │  Care Quality:         +0  ░░░░░░░░░░░░░░░░░░░░░░░░   │  │
│  │  (No special groom bonuses)                            │  │
│  │                                                        │  │
│  │  Total Score: +4                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Traits Confirmed                                       │  │
│  │                                                        │  │
│  │  ✅ peopleOriented (Positive Trait)                    │  │
│  │                                                        │  │
│  │  Effect: Bonds quickly with handlers                   │  │
│  │  Benefit: +15% XP gain from training                   │  │
│  │                                                        │  │
│  │  Why: Score ≥3 confirms positive social development    │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ What This Means                                        │  │
│  │                                                        │  │
│  │  Your excellent care during the socialization window   │  │
│  │  has resulted in strong social development. Your foal  │  │
│  │  will bond quickly with handlers and respond well to   │  │
│  │  training throughout their life.                       │  │
│  │                                                        │  │
│  │  Continue providing consistent, high-quality care to   │  │
│  │  maximize future milestone evaluations!                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│                              [Continue]                       │
└───────────────────────────────────────────────────────────────┘
```

**Layout (Evaluation History):**
```
┌──────────────────────────────────────────────────────────────┐
│ Milestone Evaluation History                                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Week 2: Curiosity & Play - Feb 12, 2026               │  │
│  │ Score: +3 (Good) | Trait: explorative                 │  │
│  │                                         [View Details] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Week 1: Socialization - Feb 8, 2026                   │  │
│  │ Score: +4 (Excellent) | Trait: peopleOriented         │  │
│  │                                         [View Details] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Day 1: Imprinting - Feb 1, 2026                       │  │
│  │ Score: +2 (Good) | Trait: confident                   │  │
│  │                                         [View Details] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Subcomponents:**

1. **EvaluationScoreDisplay**
   ```typescript
   interface EvaluationScoreDisplayProps {
     score: number; // -10 to +10
   }
   ```
   - Displays numerical score
   - Shows visual indicator (progress bar/gauge)
   - Color codes based on score:
     - Green: +3 to +10 (Excellent/Good)
     - Yellow: 0 to +2 (Neutral/Fair)
     - Red: -10 to -1 (Poor/Bad)
   - Displays category label (Excellent, Good, Neutral, Poor)

2. **ScoreBreakdownPanel**
   ```typescript
   interface ScoreBreakdownPanelProps {
     bondModifier: number;
     taskConsistency: number;
     careQuality: number;
     totalScore: number;
   }
   ```
   - Shows each scoring component with value
   - Displays progress bars for visual representation
   - Shows explanation text for each component
   - Highlights which factors helped/hurt
   - Displays calculation: bond + tasks + quality = total

3. **TraitConfirmationCard**
   ```typescript
   interface TraitConfirmationCardProps {
     trait: EpigeneticTrait;
     score: number;
     reason: string;
   }
   ```
   - Displays trait name with icon
   - Shows trait type (positive/negative) with color coding
   - Lists trait effects and benefits
   - Explains confirmation reason
   - Shows trait tier if ultra-rare/exotic

4. **EvaluationHistoryItem**
   ```typescript
   interface EvaluationHistoryItemProps {
     evaluation: MilestoneEvaluation;
     onViewDetails: () => void;
   }
   ```
   - Displays milestone name and date
   - Shows score with color coding
   - Lists traits confirmed (comma-separated)
   - "View Details" button expands full evaluation
   - Collapsible for detailed view

5. **EvaluationExplanation**
   ```typescript
   interface EvaluationExplanationProps {
     score: number;
     milestone: MilestoneType;
     traits: string[];
   }
   ```
   - Provides context-specific explanation
   - Explains what the score means
   - Describes how traits will affect horse
   - Gives guidance for future care
   - Positive, encouraging tone

### API Integration

**Endpoints Used:**
```typescript
// Evaluate milestone (triggered when age window expires)
POST /api/traits/evaluate-milestone
Body: {
  horseId: string;
  milestoneType: MilestoneType;
}
Response: {
  evaluation: {
    milestoneType: MilestoneType;
    score: number;
    scoreBreakdown: {
      bondModifier: number;
      taskConsistency: number;
      careQuality: number;
    };
    traitsConfirmed: string[];
    evaluatedAt: string;
  };
  message: string;
}

// Get milestone evaluation history
GET /api/traits/milestone-status/:horseId
Response: {
  evaluations: Array<{
    milestoneType: MilestoneType;
    score: number;
    scoreBreakdown: {
      bondModifier: number;
      taskConsistency: number;
      careQuality: number;
    };
    traitsConfirmed: string[];
    evaluatedAt: string;
  }>;
  completedMilestones: MilestoneType[];
  currentMilestone: MilestoneType | null;
}

// Get trait definitions (for displaying trait details)
GET /api/traits/definitions
Response: {
  traits: Array<{
    id: string;
    name: string;
    category: string;
    tier?: string;
    description: string;
    effects: TraitEffect[];
  }>;
}
```

**Evaluation Logic (Frontend):**
```typescript
function getEvaluationCategory(score: number): string {
  if (score >= 5) return 'Excellent';
  if (score >= 3) return 'Good';
  if (score >= 0) return 'Neutral';
  if (score >= -3) return 'Poor';
  return 'Bad';
}

function getEvaluationColor(score: number): string {
  if (score >= 3) return 'text-green-600';
  if (score >= 0) return 'text-yellow-600';
  return 'text-red-600';
}

function getTraitConfirmationReason(score: number): string {
  if (score >= 3) return 'Score ≥3 confirms positive trait';
  if (score <= -3) return 'Score ≤-3 confirms negative trait';
  return 'Neutral score: trait randomized';
}
```

### Testing Requirements

**Unit Tests:**
```typescript
// MilestoneEvaluationDisplay.test.tsx
describe('MilestoneEvaluationDisplay', () => {
  describe('Evaluation Display', () => {
    it('should render evaluation results', () => {});
    it('should display milestone name and date', () => {});
    it('should show overall score', () => {});
    it('should color code score correctly', () => {});
    it('should display evaluation category', () => {});
  });

  describe('Score Breakdown', () => {
    it('should display bond modifier', () => {});
    it('should display task consistency', () => {});
    it('should display care quality', () => {});
    it('should show score calculation', () => {});
    it('should highlight positive/negative factors', () => {});
  });

  describe('Trait Confirmation', () => {
    it('should display confirmed traits', () => {});
    it('should show trait effects', () => {});
    it('should explain confirmation reason', () => {});
    it('should color code trait type', () => {});
  });

  describe('Evaluation History', () => {
    it('should list all evaluations', () => {});
    it('should sort evaluations chronologically', () => {});
    it('should allow expanding evaluation details', () => {});
    it('should show empty state if no evaluations', () => {});
  });

  describe('Automatic Display', () => {
    it('should automatically show when milestone completes', () => {});
    it('should display as modal using BaseModal', () => {});
    it('should allow dismissing modal', () => {});
  });
});

// EvaluationScoreDisplay.test.tsx
describe('EvaluationScoreDisplay', () => {
  it('should display score numerically', () => {});
  it('should show visual score indicator', () => {});
  it('should color code green for high scores', () => {});
  it('should color code yellow for neutral scores', () => {});
  it('should color code red for low scores', () => {});
  it('should display category label', () => {});
});

// TraitConfirmationCard.test.tsx
describe('TraitConfirmationCard', () => {
  it('should display trait name', () => {});
  it('should show trait type', () => {});
  it('should list trait effects', () => {});
  it('should explain confirmation reason', () => {});
  it('should highlight ultra-rare/exotic tiers', () => {});
});
```

### Success Criteria

- [ ] All acceptance criteria met
- [ ] All unit tests passing (target: 20+ tests)
- [ ] Evaluation displays automatically when milestone completes
- [ ] Score breakdown clear and understandable
- [ ] Trait confirmation explanations helpful
- [ ] Evaluation history displays correctly
- [ ] Uses BaseModal for evaluation display
- [ ] Color coding intuitive
- [ ] Explanations positive and encouraging
- [ ] Code review completed

---

## Story 6-5: Breeding Predictions (P1)

**Priority:** P1 (Stretch Goal)
**Estimate:** 1 day
**Prerequisites:** Story 6-1
**Backend:** ⚠️ Partial

### User Stories

**US-6-5-1:** As a player, I want to see predicted offspring traits so I can make informed breeding decisions.

**US-6-5-2:** As a player, I want to see trait inheritance probabilities so I understand what to expect.

**US-6-5-3:** As a player, I want to see ultra-rare trait potential so I can plan valuable breedings.

**US-6-5-4:** As a player, I want to see breeding insights so I can optimize my breeding program.

### Acceptance Criteria

**AC-6-5-1:** Prediction display
- [ ] Display predicted traits from both parents
- [ ] Show trait inheritance probabilities (%)
- [ ] Display dominant vs recessive traits
- [ ] Show temperament predictions
- [ ] Indicate prediction confidence level

**AC-6-5-2:** Ultra-rare trait analysis
- [ ] Display ultra-rare trait potential
- [ ] Show required conditions for ultra-rare traits
- [ ] Indicate if breeding pair meets conditions
- [ ] Display exotic trait possibilities
- [ ] Show groom influence on trait chances

**AC-6-5-3:** Breeding insights
- [ ] Provide breeding recommendations
- [ ] Highlight strong genetic combinations
- [ ] Warn about negative trait risks
- [ ] Suggest optimal care strategies for foal
- [ ] Display lineage quality score

**AC-6-5-4:** Comparison tool
- [ ] Allow comparing multiple breeding pairs
- [ ] Show side-by-side predictions
- [ ] Highlight best combination
- [ ] Display trade-offs between pairs

### Component Specification

#### BreedingPredictionsPanel Component

**Location:** `frontend/src/pages/breeding/BreedingPredictionsPanel.tsx`

**Props:**
```typescript
interface BreedingPredictionsPanelProps {
  sireId: string;
  damId: string;
}
```

**State Management:**
```typescript
// Breeding insights (if available from backend)
const { data: breedingInsights, isLoading } = useQuery({
  queryKey: ['breeding-insights', sireId, damId],
  queryFn: () => fetchBreedingInsights(sireId, damId),
  enabled: !!(sireId && damId),
  staleTime: 300000 // 5 minutes
});

// Parent horses (for displaying current traits)
const { data: sire } = useQuery({
  queryKey: ['horse', sireId],
  queryFn: () => fetchHorse(sireId)
});

const { data: dam } = useQuery({
  queryKey: ['horse', damId],
  queryFn: () => fetchHorse(damId)
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Breeding Predictions                              [Refresh]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Thunder (Sire) × Lightning (Dam)                            │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Trait Inheritance Predictions                          │  │
│  │                                                        │  │
│  │  peopleOriented (from Sire)     ████████░░ 85%        │  │
│  │  confident (from Dam)            ███████░░░ 75%        │  │
│  │  athletic (from both)            █████████░ 95%        │  │
│  │  resilient (from Sire)           █████░░░░░ 60%        │  │
│  │  explorative (from Dam)          ████░░░░░░ 50%        │  │
│  │                                                        │  │
│  │  Prediction Confidence: High (80%)                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Ultra-Rare Trait Potential                             │  │
│  │                                                        │  │
│  │  Phoenix-Born Potential:        ████░░░░░░ 45%        │  │
│  │  Requires: 3+ stress events + 2 recoveries            │  │
│  │  Status: ⚠️ Requires specific care pattern            │  │
│  │                                                        │  │
│  │  Iron-Willed Potential:         ██░░░░░░░░ 25%        │  │
│  │  Requires: No skipped milestones + no negative traits │  │
│  │  Status: ✅ Achievable with perfect care              │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Breeding Insights                                      │  │
│  │                                                        │  │
│  │  💡 Strong Combination Detected                        │  │
│  │  This breeding pair has excellent athletic trait       │  │
│  │  synergy (95% chance of athletic foal).                │  │
│  │                                                        │  │
│  │  ✅ Recommendations:                                   │  │
│  │  • Assign Mindful Handler groom for Phoenix-Born      │  │
│  │  • Maintain perfect milestone schedule for Iron-Will  │  │
│  │  • Focus on trust-building enrichment activities      │  │
│  │                                                        │  │
│  │  ⚠️ Considerations:                                    │  │
│  │  • 50% chance of explorative (requires extra care)    │  │
│  │  • Monitor stress levels for optimal trait dev.       │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Lineage Quality Score: ████████░░ 82/100                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Note:** This is a P1 stretch goal. If backend API not fully available, implement with client-side calculations based on parent trait data.

### API Integration

**Endpoints Used:**
```typescript
// Get breeding insights (if available)
GET /api/epigenetic-traits/breeding-insights/:horseId
// May need to be called for both sire and dam

// Fallback: Get parent horse details with traits
GET /api/horses/:id
GET /api/traits/horse/:id
```

**Client-Side Prediction Logic (if backend not available):**
```typescript
function calculateTraitInheritance(
  sire: Horse,
  dam: Horse
): TraitPrediction[] {
  const sireTraits = sire.traits || [];
  const damTraits = dam.traits || [];

  // Combine traits from both parents
  const allTraits = [...sireTraits, ...damTraits];

  // Calculate probabilities
  return allTraits.map(trait => ({
    traitName: trait.name,
    probability: calculateProbability(trait, sireTraits, damTraits),
    source: getTraitSource(trait, sireTraits, damTraits)
  }));
}

function calculateProbability(
  trait: Trait,
  sireTraits: Trait[],
  damTraits: Trait[]
): number {
  const inSire = sireTraits.some(t => t.name === trait.name);
  const inDam = damTraits.some(t => t.name === trait.name);

  if (inSire && inDam) return 0.95; // Both parents: 95%
  if (inSire || inDam) return 0.70; // One parent: 70%
  return 0.10; // Neither parent: 10%
}
```

### Testing Requirements

**Unit Tests (Minimal - P1):**
```typescript
describe('BreedingPredictionsPanel', () => {
  it('should display trait inheritance predictions', () => {});
  it('should show probability bars', () => {});
  it('should display ultra-rare trait potential', () => {});
  it('should show breeding insights', () => {});
  it('should calculate client-side if API unavailable', () => {});
});
```

### Success Criteria (P1 - Only if time permits)

- [ ] All acceptance criteria met OR client-side calculations implemented
- [ ] Basic unit tests passing (target: 5+ tests)
- [ ] Predictions display correctly
- [ ] Probabilities visualized clearly
- [ ] Insights provide value to players
- [ ] Code review completed

---

## Story 6-6: Epigenetic Trait System

**Priority:** P0
**Estimate:** 2 days (largest story)
**Prerequisites:** Epic 3, Story 6-4
**Backend:** ✅ 100% Complete (advanced implementation)

### User Stories

**US-6-6-1:** As a player, I want to see my horse's epigenetic traits so I understand their unique characteristics.

**US-6-6-2:** As a player, I want to see trait effects and benefits so I know how they impact performance.

**US-6-6-3:** As a player, I want to see trait discovery status so I know which traits are hidden.

**US-6-6-4:** As a player, I want to see epigenetic flags so I understand my horse's behavioral tendencies.

**US-6-6-5:** As a player, I want to see trait development history so I understand how my horse developed.

**US-6-6-6:** As a player, I want to see ultra-rare/exotic traits with special styling so I recognize their prestige.

**US-6-6-7:** As a player, I want to see trait competition impact so I can optimize discipline selection.

### Acceptance Criteria

**AC-6-6-1:** Trait display
- [ ] Display all visible epigenetic traits
- [ ] Group traits by category (behavioral, conditional, temporary)
- [ ] Show ultra-rare traits with gold border
- [ ] Show exotic traits with purple border
- [ ] Display hidden trait indicators (🔒 icon)
- [ ] Show trait discovery progress

**AC-6-6-2:** Trait effects
- [ ] Display trait name and description
- [ ] List all trait effects with icons
- [ ] Show numerical bonuses/penalties
- [ ] Indicate which stats are affected
- [ ] Display special abilities if applicable

**AC-6-6-3:** Epigenetic flags
- [ ] Display all assigned flags
- [ ] Group flags by category (confidence, social, resilience)
- [ ] Show flag effects clearly
- [ ] Display assignment date
- [ ] Indicate flag trigger/source

**AC-6-6-4:** Trait discovery
- [ ] Show locked/hidden traits
- [ ] Display discovery methods
- [ ] Show progress toward discovery
- [ ] Trigger discovery notifications
- [ ] Update display when traits revealed

**AC-6-6-5:** Trait history
- [ ] Display trait development timeline
- [ ] Show when each trait was acquired
- [ ] Display source (groom, milestone, competition)
- [ ] Show influence score for development
- [ ] Allow filtering by category/source

**AC-6-6-6:** Competition impact
- [ ] Display trait effects by discipline
- [ ] Show bonuses/penalties per discipline
- [ ] Compare impact across disciplines
- [ ] Highlight best disciplines for horse
- [ ] Display trait synergies

**AC-6-6-7:** Special trait styling
- [ ] Ultra-rare traits: Gold border, special icon, rarity indicator
- [ ] Exotic traits: Purple border, special icon, rarity indicator
- [ ] Animated effects on hover (subtle)
- [ ] Distinct visual hierarchy
- [ ] Prestige tooltips

### Component Specification

#### EpigeneticTraitDisplay Component

**Location:** `frontend/src/components/traits/EpigeneticTraitDisplay.tsx`

**Props:**
```typescript
interface EpigeneticTraitDisplayProps {
  horseId: string;
  showHistory?: boolean;
  showCompetitionImpact?: boolean;
  expandedView?: boolean; // For horse profile vs compact view
}
```

**State Management:**
```typescript
const [selectedTrait, setSelectedTrait] = useState<EpigeneticTrait | null>(null);
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [categoryFilter, setCategoryFilter] = useState<string>('all');

// Horse traits
const { data: traits } = useQuery({
  queryKey: ['horse-traits', horseId],
  queryFn: () => fetchHorseTraits(horseId),
  staleTime: 60000,
  refetchOnFocus: true
});

// Trait definitions (static)
const { data: traitDefs } = useQuery({
  queryKey: ['trait-definitions'],
  queryFn: fetchTraitDefinitions,
  staleTime: 600000
});

// Epigenetic flags
const { data: flags } = useQuery({
  queryKey: ['horse-flags', horseId],
  queryFn: () => fetchHorseFlags(horseId),
  staleTime: 60000
});

// Trait history
const { data: history } = useQuery({
  queryKey: ['trait-history', horseId],
  queryFn: () => fetchTraitHistory(horseId),
  enabled: !!showHistory,
  staleTime: 300000
});

// Competition impact
const { data: competitionImpact } = useQuery({
  queryKey: ['trait-competition-impact', horseId],
  queryFn: () => fetchTraitCompetitionImpact(horseId),
  enabled: !!showCompetitionImpact,
  staleTime: 300000
});
```

**Layout (Expanded View):**
```
┌──────────────────────────────────────────────────────────────┐
│ Epigenetic Traits & Flags                  [Grid] [List] [?] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Categories: [All] [Behavioral] [Conditional] [Temporary]    │
│              [Ultra-Rare] [Exotic] [Hidden]                  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Active Traits (5/6 slots)                              │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │🌟 Confident  │  │💪 Athletic   │  │🎯 peopleOri. │ │  │
│  │  │              │  │              │  │              │ │  │
│  │  │Training XP   │  │Stamina +25%  │  │Bond speed    │ │  │
│  │  │Bonus: +25%   │  │Physical +20% │  │Bonus: +15%   │ │  │
│  │  │              │  │              │  │              │ │  │
│  │  │[View Impact] │  │[View Impact] │  │[View Impact] │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐                   │  │
│  │  │🔥 explorative│  │💎 resilient  │                   │  │
│  │  │              │  │              │                   │  │
│  │  │Trail bonus   │  │Stress rec.   │                   │  │
│  │  │+10% XP       │  │+25% faster   │                   │  │
│  │  │              │  │              │                   │  │
│  │  │[View Impact] │  │[View Impact] │                   │  │
│  │  └──────────────┘  └──────────────┘                   │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Ultra-Rare Traits                                      │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  ╔══════════════════════════════════════════════════╗  │  │
│  │  ║ 🔱 Phoenix-Born (Ultra-Rare)                     ║  │  │
│  │  ║                                                  ║  │  │
│  │  ║ "Rises from adversity stronger than before"     ║  │  │
│  │  ║                                                  ║  │  │
│  │  ║ Effects:                                         ║  │  │
│  │  ║ • Stress decay +30%                             ║  │  │
│  │  ║ • Burnout recovery: 3 days (vs 7 days)         ║  │  │
│  │  ║ • Cannot be broken by stress                    ║  │  │
│  │  ║                                                  ║  │  │
│  │  ║ Acquired: Age 2 years (Milestone stress event)  ║  │  │
│  │  ║                               [View Full Lore]  ║  │  │
│  │  ╚══════════════════════════════════════════════════╝  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Epigenetic Flags                                       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  💪 CONFIDENT (Confidence)                             │  │
│  │  Effect: Training XP bonus +15%                        │  │
│  │  Assigned: Feb 8, 2026 (Socialization milestone)      │  │
│  │                                                        │  │
│  │  ❤️ AFFECTIONATE (Social)                              │  │
│  │  Effect: Bond speed bonus +20%                         │  │
│  │  Assigned: Feb 1, 2026 (Gentle groom influence)       │  │
│  │                                                        │  │
│  │  🛡️ RESILIENT (Resilience)                            │  │
│  │  Effect: Stress recovery +25%                          │  │
│  │  Assigned: Feb 15, 2026 (Stress event survived)       │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Hidden Traits (2)                                      │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  🔒 Hidden Trait #1                                    │  │
│  │  Unlock via: Veterinary Evaluation                     │  │
│  │  Progress: ████░░░░░░ 45%                              │  │
│  │                                                        │  │
│  │  🔒 Hidden Trait #2                                    │  │
│  │  Unlock via: Lineage Analysis                          │  │
│  │  Progress: ██░░░░░░░░ 20%                              │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Layout (Competition Impact View):**
```
┌──────────────────────────────────────────────────────────────┐
│ Trait Competition Impact Analysis                    [Close] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Analyzing traits for: Thunder                               │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Best Disciplines for This Horse                        │  │
│  │                                                        │  │
│  │  1. Dressage           ████████░░ +35% total           │  │
│  │     confident: +10%                                    │  │
│  │     resilient: +5%                                     │  │
│  │     peopleOriented: +10%                               │  │
│  │     athletic: +10%                                     │  │
│  │                                                        │  │
│  │  2. Show Jumping       ████████░░ +30% total           │  │
│  │     athletic: +15%                                     │  │
│  │     confident: +10%                                    │  │
│  │     explorative: +5%                                   │  │
│  │                                                        │  │
│  │  3. Eventing           ███████░░░ +28% total           │  │
│  │     athletic: +12%                                     │  │
│  │     resilient: +8%                                     │  │
│  │     explorative: +8%                                   │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Trait Effects by Discipline                            │  │
│  │                                                        │  │
│  │  Discipline          confident  athletic  resilient    │  │
│  │  ──────────────────────────────────────────────────    │  │
│  │  Dressage            +10%       +10%      +5%          │  │
│  │  Show Jumping        +10%       +15%      0%           │  │
│  │  Eventing            +5%        +12%      +8%          │  │
│  │  Racing              0%         +20%      +3%          │  │
│  │  Western Pleasure    +8%        +5%       +5%          │  │
│  │  ...                                                   │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  💡 Recommendation: Focus on Dressage and Show Jumping       │
│  for maximum trait synergy and competition success.          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Subcomponents:**

1. **TraitCard**
   ```typescript
   interface TraitCardProps {
     trait: EpigeneticTrait;
     variant: 'normal' | 'ultra-rare' | 'exotic';
     onClick: () => void;
   }
   ```
   - Displays trait name with appropriate icon
   - Shows tier badge (ultra-rare gold, exotic purple)
   - Lists key effects (truncated in grid view)
   - Special border styling based on variant
   - Hover effects (subtle animation)
   - Click to expand full details

2. **TraitDetailModal** (uses BaseModal)
   ```typescript
   interface TraitDetailModalProps {
     isOpen: boolean;
     onClose: () => void;
     trait: EpigeneticTrait;
     horseId: string;
   }
   ```
   - Full trait description
   - Complete effects list
   - Acquisition details (source, date, influence score)
   - Lore text for ultra-rare/exotic traits
   - Competition impact breakdown
   - Related traits/synergies

3. **EpigeneticFlagBadge**
   ```typescript
   interface EpigeneticFlagBadgeProps {
     flag: EpigeneticFlag;
     compact?: boolean;
   }
   ```
   - Displays flag name with category icon
   - Shows effect text
   - Displays assignment date
   - Explains trigger/source
   - Color coded by category

4. **HiddenTraitIndicator**
   ```typescript
   interface HiddenTraitIndicatorProps {
     discoveryMethod: string;
     progress: number;
     onDiscover?: () => void;
   }
   ```
   - Shows locked icon
   - Displays discovery method
   - Shows progress bar
   - "Discover" button if conditions met
   - Tooltip with requirements

5. **TraitHistoryTimeline**
   ```typescript
   interface TraitHistoryTimelineProps {
     history: TraitHistoryEntry[];
   }
   ```
   - Chronological timeline of trait development
   - Shows acquisition dates with icons
   - Displays source for each trait
   - Shows influence scores
   - Allows filtering by source/category

6. **CompetitionImpactPanel**
   ```typescript
   interface CompetitionImpactPanelProps {
     horseId: string;
     traits: EpigeneticTrait[];
   }
   ```
   - Lists best disciplines for horse
   - Shows trait bonuses by discipline
   - Displays total impact per discipline
   - Provides recommendations
   - Sortable by total impact

### API Integration

**Endpoints Used:**
```typescript
// Get horse traits
GET /api/traits/horse/:horseId
Response: {
  traits: EpigeneticTrait[];
  visibleCount: number;
  hiddenCount: number;
  maxSlots: number;
}

// Get trait definitions
GET /api/traits/definitions
Response: {
  traits: Array<{
    id: string;
    name: string;
    category: string;
    tier?: string;
    description: string;
    lore?: string;
    effects: TraitEffect[];
  }>;
}

// Get horse epigenetic flags
GET /api/horses/:id/flags
Response: {
  flags: EpigeneticFlag[];
}

// Get flag definitions
GET /api/flags/definitions
Response: {
  flags: Array<{
    id: string;
    name: string;
    category: string;
    effect: string;
    trigger: string;
  }>;
}

// Get trait history
GET /api/epigenetic-traits/history/:horseId
Response: {
  history: Array<{
    traitId: string;
    traitName: string;
    assignedAt: string;
    source: string;
    horseAge: number;
    influenceScore: number;
    flagsAtTime: string[];
  }>;
}

// Get trait summary
GET /api/epigenetic-traits/summary/:horseId
Response: {
  totalTraits: number;
  behavioralTraits: number;
  conditionalTraits: number;
  ultraRareTraits: number;
  exoticTraits: number;
  developmentScore: number;
}

// Get competition impact
GET /api/traits/competition-impact/:horseId
Query: ?discipline=dressage
Response: {
  discipline: string;
  totalImpact: number;
  traitEffects: Array<{
    traitName: string;
    effect: string;
    value: number;
  }>;
}

// Get competition comparison (all disciplines)
GET /api/traits/competition-comparison/:horseId
Response: {
  bestDisciplines: Array<{
    discipline: string;
    totalImpact: number;
    traitBreakdown: { [traitName: string]: number };
  }>;
  allDisciplines: Array<{
    discipline: string;
    impact: number;
  }>;
}

// Get ultra-rare traits
GET /api/ultra-rare-traits/:horseId
Response: {
  ultraRareTraits: Array<{
    traitId: string;
    traitName: string;
    tier: 'ultra-rare' | 'exotic';
    mechanicalPerks: string[];
    lore: string;
    acquiredAt: string;
  }>;
}

// Trigger trait discovery
POST /api/traits/discover/:horseId
Response: {
  discovered: string[];
  message: string;
}
```

### Testing Requirements

**Unit Tests:**
```typescript
// EpigeneticTraitDisplay.test.tsx (Comprehensive)
describe('EpigeneticTraitDisplay', () => {
  describe('Trait Display', () => {
    it('should render all visible traits', () => {});
    it('should group traits by category', () => {});
    it('should filter traits by selected category', () => {});
    it('should show trait count and max slots', () => {});
  });

  describe('Trait Styling', () => {
    it('should render ultra-rare traits with gold border', () => {});
    it('should render exotic traits with purple border', () => {});
    it('should render normal traits with standard styling', () => {});
    it('should apply hover effects', () => {});
  });

  describe('Trait Details', () => {
    it('should open detail modal on trait click', () => {});
    it('should display complete trait information', () => {});
    it('should show acquisition details', () => {});
    it('should display lore for ultra-rare/exotic traits', () => {});
  });

  describe('Epigenetic Flags', () => {
    it('should display all assigned flags', () => {});
    it('should group flags by category', () => {});
    it('should show flag effects', () => {});
    it('should display assignment dates', () => {});
  });

  describe('Hidden Traits', () => {
    it('should display locked trait indicators', () => {});
    it('should show discovery methods', () => {});
    it('should display progress bars', () => {});
    it('should trigger discovery when conditions met', () => {});
  });

  describe('Trait History', () => {
    it('should render trait timeline', () => {});
    it('should show acquisition dates', () => {});
    it('should display trait sources', () => {});
    it('should allow filtering history', () => {});
  });

  describe('Competition Impact', () => {
    it('should display best disciplines', () => {});
    it('should show trait bonuses by discipline', () => {});
    it('should calculate total impact', () => {});
    it('should provide recommendations', () => {});
  });

  describe('View Modes', () => {
    it('should toggle between grid and list view', () => {});
    it('should render correctly in compact mode', () => {});
    it('should render correctly in expanded mode', () => {});
  });

  describe('Real-time Updates', () => {
    it('should update when new trait acquired', () => {});
    it('should update when trait discovered', () => {});
    it('should update when flag assigned', () => {});
  });
});

// TraitCard.test.tsx
describe('TraitCard', () => {
  it('should render trait name and icon', () => {});
  it('should show trait effects', () => {});
  it('should apply correct variant styling', () => {});
  it('should handle click events', () => {});
  it('should show tier badge for special traits', () => {});
});

// CompetitionImpactPanel.test.tsx
describe('CompetitionImpactPanel', () => {
  it('should fetch competition impact data', () => {});
  it('should display top disciplines', () => {});
  it('should show trait breakdown per discipline', () => {});
  it('should calculate total impact correctly', () => {});
  it('should provide actionable recommendations', () => {});
});
```

**Integration Tests:**
```typescript
describe('Trait System Integration', () => {
  it('should display traits from API correctly', () => {});
  it('should handle trait discovery flow', () => {});
  it('should update display when milestone evaluates', () => {});
  it('should show competition impact analysis', () => {});
});
```

### Success Criteria

- [ ] All acceptance criteria met
- [ ] All unit tests passing (target: 30+ tests)
- [ ] Traits display with correct styling by tier
- [ ] Ultra-rare/exotic traits have special borders
- [ ] Epigenetic flags display correctly
- [ ] Hidden traits show discovery progress
- [ ] Trait history timeline renders correctly
- [ ] Competition impact analysis accurate
- [ ] Click interactions work smoothly
- [ ] Uses BaseModal for detail views
- [ ] Responsive design works on all devices
- [ ] Code review completed

---

## Cross-Story Patterns

### Shared Components

**1. LoadingSpinner**
```typescript
// Used across all stories for loading states
<LoadingSpinner size="md" text="Loading foal data..." />
```

**2. ErrorDisplay**
```typescript
// Consistent error handling
<ErrorDisplay
  error={error}
  retry={() => refetch()}
  variant="inline"
/>
```

**3. EmptyState**
```typescript
// Consistent empty states
<EmptyState
  icon={<FoalIcon />}
  title="No foals yet"
  description="Breed your first foal to get started"
  action={<Button onClick={navigateToBreeding}>Start Breeding</Button>}
/>
```

**4. SuccessNotification**
```typescript
// Consistent success feedback (using toast library)
toast.success('Breeding initiated successfully!', {
  description: 'Your foal will be born shortly.',
  action: {
    label: 'View Foal',
    onClick: () => navigate(`/foals/${foalId}`)
  }
});
```

### Shared Utilities

**1. Date Formatting**
```typescript
// utils/date.ts
export function formatRelativeTime(date: Date): string {
  // "2 hours ago", "3 days ago", etc.
}

export function formatAge(ageInDays: number): string {
  // "12 days old", "2 weeks old", etc.
}

export function calculateDaysRemaining(
  currentAge: number,
  targetAge: number
): number {
  return Math.max(0, targetAge - currentAge);
}
```

**2. Color Utilities**
```typescript
// utils/colors.ts
export function getScoreColor(score: number): string {
  if (score >= 3) return 'text-green-600';
  if (score >= 0) return 'text-yellow-600';
  return 'text-red-600';
}

export function getProgressBarColor(percentage: number): string {
  if (percentage >= 80) return 'bg-green-500';
  if (percentage >= 50) return 'bg-blue-500';
  if (percentage >= 20) return 'bg-yellow-500';
  return 'bg-red-500';
}
```

**3. API Error Handling**
```typescript
// utils/api.ts
export function handleAPIError(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

export function isNetworkError(error: any): boolean {
  return !error.response && error.message === 'Network Error';
}
```

**4. Cache Invalidation Helper**
```typescript
// utils/cache.ts
export function invalidateBreedingQueries(
  queryClient: QueryClient,
  userId: string,
  foalId?: string
) {
  queryClient.invalidateQueries({ queryKey: ['horses', userId] });
  queryClient.invalidateQueries({ queryKey: ['foals'] });

  if (foalId) {
    queryClient.invalidateQueries({ queryKey: ['foal-development', foalId] });
  }
}
```

### Consistent Styling

**Tailwind CSS Patterns:**
```typescript
// Card styling
const cardClasses = "bg-white rounded-lg border border-gray-200 p-4 shadow-sm";

// Button primary
const btnPrimaryClasses = "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";

// Button secondary
const btnSecondaryClasses = "px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100";

// Progress bar
const progressBarClasses = "w-full bg-gray-200 rounded-full h-2.5";
const progressFillClasses = "bg-blue-600 h-2.5 rounded-full transition-all duration-300";

// Badge
const badgeClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

// Ultra-rare border (gold)
const ultraRareBorderClasses = "border-4 border-yellow-400 shadow-lg shadow-yellow-200";

// Exotic border (purple)
const exoticBorderClasses = "border-4 border-purple-400 shadow-lg shadow-purple-200";
```

---

## Testing Strategy

### Test Structure Per Story

Each story follows this testing hierarchy:

1. **Unit Tests** (Component-level)
   - Component rendering
   - Props handling
   - Event handling
   - Conditional rendering
   - Error states
   - Loading states

2. **Integration Tests** (Feature-level)
   - API integration
   - React Query integration
   - Multi-component interactions
   - User workflows

3. **Visual Tests** (Snapshot)
   - Component snapshots
   - Responsive layouts
   - Special states (loading, error, empty)

### Test Coverage Targets

- **Overall Coverage:** 80%+
- **Critical Paths:** 100% (breeding, milestone evaluation)
- **UI Components:** 70%+
- **Utilities:** 90%+

### Testing Patterns

**1. Mock API Responses:**
```typescript
// test/mocks/api.ts
export const mockFoal = {
  id: 'foal-1',
  name: 'Thunder Jr.',
  ageInDays: 12,
  currentMilestone: 'curiosity_play',
  completedMilestones: ['imprinting', 'socialization'],
  // ...
};

export const mockMilestoneEvaluation = {
  milestoneType: 'socialization',
  score: 4,
  scoreBreakdown: {
    bondModifier: 2,
    taskConsistency: 2,
    careQuality: 0
  },
  traitsConfirmed: ['peopleOriented'],
  evaluatedAt: '2026-02-08T12:00:00Z'
};
```

**2. React Query Testing Setup:**
```typescript
// test/utils/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });
}

export function renderWithQueryClient(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

**3. User Event Testing:**
```typescript
// Use @testing-library/user-event for interactions
import userEvent from '@testing-library/user-event';

it('should complete breeding flow', async () => {
  const user = userEvent.setup();

  render(<BreedingPairSelection userId="user-1" />);

  // Select sire
  await user.click(screen.getByText('Thunder'));

  // Select dam
  await user.click(screen.getByText('Lightning'));

  // Verify compatibility loads
  await waitFor(() => {
    expect(screen.getByText(/Overall Score:/)).toBeInTheDocument();
  });

  // Initiate breeding
  await user.click(screen.getByText('Initiate Breeding'));

  // Confirm
  await user.click(screen.getByText('Confirm'));

  // Verify success
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/foals/new-foal-id');
  });
});
```

**4. Recharts Testing:**
```typescript
// Recharts components require special handling
it('should render milestone timeline chart', () => {
  render(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);

  // Check for ResponsiveContainer
  expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();

  // Check for milestone labels
  expect(screen.getByText('Imprinting')).toBeInTheDocument();
  expect(screen.getByText('Socialization')).toBeInTheDocument();
});
```

### Continuous Testing

**During Development:**
```bash
# Watch mode for active development
npm test -- --watch

# Run tests for specific story
npm test -- 6-1

# Run tests with coverage
npm test -- --coverage
```

**Pre-Commit:**
```bash
# Run all tests
npm test

# Lint check
npm run lint

# Type check
npm run type-check
```

---

## Success Criteria

### Story-Level Success

Each story is considered complete when:
- [ ] All acceptance criteria met
- [ ] All unit tests passing (minimum targets met)
- [ ] Integration tests passing
- [ ] Component renders correctly on mobile, tablet, desktop
- [ ] API integration working correctly
- [ ] Error states handled gracefully
- [ ] Loading states provide good UX
- [ ] Follows pattern library guidelines
- [ ] Uses BaseModal where appropriate (confirmations, details)
- [ ] Uses Recharts for visualizations where appropriate
- [ ] Code review completed by peer
- [ ] No console errors or warnings

### Epic-Level Success

Epic 6 is considered complete when:
- [ ] All P0 stories complete (6-1, 6-2, 6-3, 6-4, 6-6)
- [ ] P1 story attempted if time permits (6-5)
- [ ] All tests passing (target: 100+ tests)
- [ ] Test coverage ≥80%
- [ ] No critical bugs
- [ ] Performance acceptable (page loads <2s, interactions <200ms)
- [ ] Breeding gameplay loop functional end-to-end:
  - User can select breeding pair
  - User can initiate breeding
  - Foal is created and displayed
  - User can view foal development timeline
  - User can perform enrichment activities
  - Milestones evaluate automatically
  - Traits are confirmed and displayed
  - User can view complete trait system
- [ ] Documentation updated
- [ ] Epic 6 retrospective scheduled

### Quality Gates

**Before marking story complete:**
1. ✅ All tests green
2. ✅ No TypeScript errors
3. ✅ No ESLint errors
4. ✅ Component documented (JSDoc)
5. ✅ Accessibility checked (keyboard nav, ARIA labels)
6. ✅ Mobile responsiveness verified
7. ✅ Error handling comprehensive
8. ✅ Loading states pleasant
9. ✅ Success feedback clear
10. ✅ Code reviewed and approved

---

## Next Steps

1. **Review This Specification**
   - Read through all stories
   - Identify any questions or concerns
   - Clarify any ambiguous requirements

2. **Set Up Development Environment**
   - Create Epic 6 feature branch
   - Install any missing dependencies
   - Verify backend APIs accessible

3. **Begin Story 6-1: Breeding Pair Selection**
   - Create component structure
   - Implement UI layout
   - Connect to API
   - Write tests alongside development
   - Test and refine

4. **Sequential Execution**
   - Complete 6-1 → 6-2 → 6-3 → 6-4 → 6-6
   - Attempt 6-5 if time permits
   - Test continuously
   - Review after each story

5. **Epic Completion**
   - Final integration testing
   - Performance testing
   - Documentation update
   - Epic 6 retrospective

---

**Ready to proceed with Story 6-1?**

Let me know if you have any questions about this technical specification, or if you'd like me to clarify any aspects before we begin implementation!
