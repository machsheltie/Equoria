# Equoria Frontend Pattern Library

**Status:** Updated 2026-02-05 (Epic 5 Retrospective)
**Purpose:** Central reference for established frontend patterns
**Action Items:** AI-5-5 (Complete Pattern Documentation), AI-4-6 (Epic 3 patterns)

---

## Table of Contents

1. [Modal Patterns](#modal-patterns)
2. [React Query Patterns](#react-query-patterns)
3. [Component Composition](#component-composition-patterns)
4. [Epic 3 Patterns](#epic-3-patterns-horse-management)
5. [Epic 4 Patterns](#epic-4-patterns-training-system)
6. [Epic 5 Patterns](#epic-5-patterns-competition-system)

---

## Modal Patterns

### BaseModal Component (Epic 5 - AI-5-1)

**Pattern:** Reusable modal foundation with all common functionality

**When to Use:**
- Any modal dialog in the application
- Dialogs requiring focus management
- Confirmation modals
- Form modals
- Detail display modals

**Implementation:**

```tsx
import BaseModal from '@/components/common/BaseModal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Modal Title"
      size="md"
      footer={
        <>
          <button onClick={() => setIsOpen(false)}>Cancel</button>
          <button onClick={handleSubmit}>Submit</button>
        </>
      }
    >
      <p>Modal content</p>
    </BaseModal>
  );
}
```

**Features Provided:**
- ✅ Portal rendering
- ✅ Focus trap and restoration
- ✅ Escape key handling
- ✅ Body scroll lock
- ✅ Backdrop click to close
- ✅ ARIA attributes
- ✅ 5 size options (sm, md, lg, xl, full)
- ✅ Loading state support

**Pitfalls to Avoid:**
- ❌ Don't create new modal variants - use BaseModal
- ❌ Don't duplicate focus management logic
- ❌ Don't forget to provide meaningful titles
- ❌ Don't put action buttons in content - use footer prop

**Related Components:**
- `CompetitionDetailModal` - Uses BaseModal (to be refactored)
- `PrizeNotificationModal` - Uses BaseModal (to be refactored)
- All Epic 6 modals - Must use BaseModal

**Documentation:** `frontend/src/components/common/README.md`

---

## React Query Patterns

### Data Fetching with useQuery (Epic 5)

**Pattern:** Consistent data fetching with caching, loading, and error states

**When to Use:**
- Fetching data from API
- Need caching and automatic refetching
- Want loading/error state management
- Optimistic updates

**Implementation:**

```tsx
import { useQuery } from '@tanstack/react-query';

function useCompetitions(filters?: CompetitionFilters) {
  return useQuery({
    queryKey: ['competitions', filters],
    queryFn: () => fetchCompetitions(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
  });
}

function CompetitionList() {
  const { data, isLoading, error } = useCompetitions({ discipline: 'Dressage' });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {data.map(competition => (
        <CompetitionCard key={competition.id} competition={competition} />
      ))}
    </div>
  );
}
```

**Cache Strategy (Epic 5):**

| Data Type | staleTime | gcTime | Refetch on Focus | Use Case |
|-----------|-----------|--------|------------------|----------|
| **Leaderboards** | 5 minutes | 10 minutes | No | Story 5-5: Leaderboards change frequently but not real-time |
| **Competition List** | 1 minute | 5 minutes | Yes | Story 5-1: Users browse actively, keep fresh |
| **Results** | 10 minutes | 30 minutes | No | Story 5-2: Historical data, rarely changes |
| **User Balance** | 30 seconds | 2 minutes | Yes | Story 5-3: Financial data, must be current |
| **Horse Details** | 2 minutes | 10 minutes | Yes | Universal: Core entity, moderate update frequency |

**Key Principles:**
1. **staleTime** = How long data is considered fresh (no refetch)
2. **gcTime** = How long unused data stays in cache
3. **refetchOnWindowFocus** = true for critical data, false for static data
4. **queryKey** = Include all variables that affect the query

**Pitfalls to Avoid:**
- ❌ Don't use different cache times for the same data type
- ❌ Don't forget to include filter variables in queryKey
- ❌ Don't use staleTime: Infinity (data will never update)
- ❌ Don't fetch on every render (use proper cache strategy)

**Related Patterns:**
- useMutation for write operations
- useQueryClient for cache invalidation
- Optimistic updates for better UX

---

### Mutation Pattern (Epic 5)

**Pattern:** Data updates with optimistic updates and cache invalidation

**When to Use:**
- Creating, updating, or deleting data
- Need to invalidate related queries
- Want optimistic UI updates

**Implementation:**

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useEnterCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { competitionId: number; horseId: number }) =>
      enterCompetition(data),
    onSuccess: () => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'balance'] });
    },
    onError: (error) => {
      toast.error(`Failed to enter competition: ${error.message}`);
    },
  });
}

function EntryButton({ competitionId, horseId }: Props) {
  const mutation = useEnterCompetition();

  const handleEnter = () => {
    mutation.mutate({ competitionId, horseId });
  };

  return (
    <button
      onClick={handleEnter}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Entering...' : 'Enter Competition'}
    </button>
  );
}
```

**Optimistic Updates:**

```tsx
function useEnterCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: enterCompetition,
    onMutate: async (newEntry) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['competitions'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['competitions']);

      // Optimistically update
      queryClient.setQueryData(['competitions'], (old: Competition[]) => [
        ...old,
        { ...newEntry, status: 'pending' }
      ]);

      return { previousData };
    },
    onError: (err, newEntry, context) => {
      // Rollback on error
      queryClient.setQueryData(['competitions'], context?.previousData);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    },
  });
}
```

**Pitfalls to Avoid:**
- ❌ Don't forget to invalidate related queries
- ❌ Don't over-invalidate (refetch only what changed)
- ❌ Don't use optimistic updates for critical operations (payments, deletions)
- ❌ Don't forget error handling

---

## Component Composition Patterns

### Container/Presentational Pattern (Epic 5)

**Pattern:** Separate data fetching (container) from presentation (component)

**When to Use:**
- Complex components with data fetching
- Want to test presentation logic separately
- Need to reuse presentational component with different data sources

**Implementation:**

```tsx
// Presentational Component (pure, testable)
interface CompetitionCardProps {
  competition: Competition;
  onEnter: (id: number) => void;
  isEntering?: boolean;
}

export function CompetitionCard({ competition, onEnter, isEntering }: CompetitionCardProps) {
  return (
    <div className="card">
      <h3>{competition.name}</h3>
      <p>{competition.discipline}</p>
      <button onClick={() => onEnter(competition.id)} disabled={isEntering}>
        {isEntering ? 'Entering...' : 'Enter'}
      </button>
    </div>
  );
}

// Container Component (data logic)
export function CompetitionCardContainer({ competitionId }: { competitionId: number }) {
  const { data: competition, isLoading } = useCompetition(competitionId);
  const mutation = useEnterCompetition();

  if (isLoading) return <Skeleton />;
  if (!competition) return null;

  return (
    <CompetitionCard
      competition={competition}
      onEnter={mutation.mutate}
      isEntering={mutation.isPending}
    />
  );
}
```

**Benefits:**
- ✅ Easier to test (presentational component is pure)
- ✅ Better separation of concerns
- ✅ Reusable presentational components

**Pitfalls to Avoid:**
- ❌ Don't over-engineer - simple components don't need this pattern
- ❌ Don't create container for every component
- ❌ Don't put business logic in presentational component

---

### Compound Components Pattern (Epic 5 - Leaderboards)

**Pattern:** Components that work together to form a cohesive UI

**When to Use:**
- Complex components with multiple sub-parts
- Want flexible composition
- Need to share state between sub-components

**Implementation:**

```tsx
// Parent component manages shared state
interface LeaderboardContextValue {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);

function Leaderboard({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState('top-earners');

  return (
    <LeaderboardContext.Provider value={{ selectedCategory, setSelectedCategory }}>
      <div className="leaderboard">{children}</div>
    </LeaderboardContext.Provider>
  );
}

// Sub-components use shared context
function LeaderboardTabs() {
  const context = useContext(LeaderboardContext);
  // Render tabs using context
}

function LeaderboardContent() {
  const context = useContext(LeaderboardContext);
  // Render content based on selected category
}

// Usage
<Leaderboard>
  <LeaderboardTabs />
  <LeaderboardContent />
</Leaderboard>
```

**Benefits:**
- ✅ Flexible composition
- ✅ Shared state without prop drilling
- ✅ Clear parent-child relationships

**Pitfalls to Avoid:**
- ❌ Don't use for simple components
- ❌ Don't forget context validation
- ❌ Don't put too much logic in context

---

## Epic 3 Patterns (Horse Management)

### IIFE for Complex JSX Calculations (Story 3-3)

**Pattern:** Immediately Invoked Function Expression for complex calculations in JSX

**When to Use:**
- Complex conditional logic in JSX
- Multiple steps to determine what to render
- Avoid messy nested ternaries

**Implementation:**

```tsx
function HorseStatDisplay({ horse }: Props) {
  return (
    <div>
      {(() => {
        // Complex calculation
        const avgStat = calculateAverageStats(horse);
        const rating = getRating(avgStat);
        const color = getColorForRating(rating);

        return (
          <span style={{ color }}>
            {rating} ({avgStat.toFixed(1)})
          </span>
        );
      })()}
    </div>
  );
}
```

**Pitfalls to Avoid:**
- ❌ Don't use for simple conditional rendering
- ❌ Don't put side effects in IIFE
- ❌ Consider extracting to separate function if logic is reused

---

### URL State Management (Story 3-6)

**Pattern:** Store filter/sort state in URL using useSearchParams

**When to Use:**
- Filters, sorting, pagination
- Want shareable URLs
- Need browser back/forward to work

**Implementation:**

```tsx
import { useSearchParams } from 'react-router-dom';

function HorseList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const discipline = searchParams.get('discipline') || 'all';
  const sortBy = searchParams.get('sort') || 'name';

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    setSearchParams(newParams);
  };

  return (
    <div>
      <select
        value={discipline}
        onChange={(e) => updateFilter('discipline', e.target.value)}
      >
        <option value="all">All Disciplines</option>
        <option value="dressage">Dressage</option>
      </select>
      {/* Horse list */}
    </div>
  );
}
```

**Benefits:**
- ✅ Shareable URLs
- ✅ Browser back/forward works
- ✅ State persists on refresh

---

### View Toggle with localStorage (Story 3-1)

**Pattern:** Persist user view preference (grid/list) in localStorage

**When to Use:**
- User preferences that should persist
- Simple key-value storage
- Non-critical data

**Implementation:**

```tsx
function HorseList() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('horseViewMode') as 'grid' | 'list') || 'grid';
  });

  const handleViewChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('horseViewMode', mode);
  };

  return (
    <div>
      <button onClick={() => handleViewChange('grid')}>Grid</button>
      <button onClick={() => handleViewChange('list')}>List</button>
      {viewMode === 'grid' ? <GridView /> : <ListView />}
    </div>
  );
}
```

---

### Responsive Grid Layouts (Stories 3-1, 3-5)

**Pattern:** Mobile-first responsive grid with Tailwind

**When to Use:**
- Card layouts
- Data grids
- Responsive design needs

**Implementation:**

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {horses.map(horse => (
    <HorseCard key={horse.id} horse={horse} />
  ))}
</div>

// Breakdown:
// - Mobile (default): 1 column
// - Tablet (sm: 640px): 2 columns
// - Desktop (lg: 1024px): 3 columns
// - Large Desktop (xl: 1280px): 4 columns
```

---

## Epic 4 Patterns (Training System)

### Countdown Timer Component (Story 4-1)

**Pattern:** Real-time countdown display with automatic updates

**When to Use:**
- Training cooldowns
- Competition deadlines
- Time-sensitive actions

**Implementation:**

```tsx
function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeRemaining.total <= 0) {
    return <span className="text-green-600">Ready!</span>;
  }

  return (
    <span className="text-gray-600">
      {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
    </span>
  );
}

function calculateTimeRemaining(targetDate: Date) {
  const total = targetDate.getTime() - Date.now();
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
  };
}
```

---

### Eligibility Indicators (Story 4-2)

**Pattern:** Visual indicators for eligibility status with tooltips

**When to Use:**
- Complex eligibility rules
- Need to show why something is disabled
- Visual status indicators

**Implementation:**

```tsx
function EligibilityIndicator({ horse, competition }: Props) {
  const eligibility = checkEligibility(horse, competition);

  return (
    <Tooltip content={eligibility.reason}>
      <span className={`badge ${eligibility.eligible ? 'bg-green-500' : 'bg-red-500'}`}>
        {eligibility.eligible ? '✓ Eligible' : '✗ Not Eligible'}
      </span>
    </Tooltip>
  );
}
```

---

## Epic 5 Patterns (Competition System)

### Quick Actions Menu (Story 5-1)

**Pattern:** Dropdown menu with common actions on list items

**When to Use:**
- Multiple actions per list item
- Want to save horizontal space
- Common in data tables

**Implementation:**

```tsx
import { MoreVertical } from 'lucide-react';

function CompetitionRow({ competition }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <tr>
      <td>{competition.name}</td>
      <td>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger>
            <MoreVertical className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleView(competition)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEnter(competition)}>
              Enter Competition
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleShare(competition)}>
              Share
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
```

---

### Recharts Integration (Stories 5-2, 5-4)

**Pattern:** Reusable chart components with Recharts

**When to Use:**
- Data visualization
- Score breakdowns
- Statistical displays

**Implementation:**

```tsx
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

function ScoreBreakdownChart({ scores }: { scores: ScoreData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={scores}>
        <PolarGrid />
        <PolarAngleAxis dataKey="category" />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.6}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Data format
const scores = [
  { category: 'Speed', value: 85 },
  { category: 'Stamina', value: 92 },
  { category: 'Agility', value: 78 },
];
```

---

## Best Practices Summary

### When to Create a New Pattern

✅ **Do** create a pattern when:
- Same code appears in 3+ places
- Complex logic that needs explanation
- Common UI pattern across the app
- Something that trips up developers

❌ **Don't** create a pattern for:
- One-off implementations
- Simple code that doesn't repeat
- Over-engineered abstractions

### Pattern Documentation Checklist

When documenting a new pattern:
- [ ] Clear pattern name
- [ ] When to use / when not to use
- [ ] Code example
- [ ] Common pitfalls
- [ ] Related patterns
- [ ] Location in codebase (example file)

---

## Pattern Evolution

### Deprecated Patterns

None yet - all patterns are current and maintained.

### Upcoming Patterns (Epic 6)

Based on Epic 6 scope (Breeding & Foal Development):
- Timeline visualization patterns
- Milestone tracking components
- Breeding prediction displays
- Genetic inheritance visualizations

---

---

## TypeScript Patterns (Epic 7+)

### Underscore Prefix for Unused Function Type Parameters (AI-7-2)

**Pattern:** Function type parameters in interfaces and type aliases **MUST** use an `_` prefix when the parameter name is required by TypeScript syntax but the value itself is unused.

**When to Use:**
- Defining a callback/function type in an interface where param names are required but unused
- Any interface property typed as a function where ESLint would flag `no-unused-vars`
- Talent tree, groom, or any system that passes callbacks by type signature only

**Implementation:**

```tsx
// ✅ CORRECT — underscore prefix silences no-unused-vars on type params
interface TalentTreeConfig {
  onTierUnlock: (_tier: number) => void;
  onTalentSelect: (_talentId: string, _tier: number) => boolean;
  getNodeStatus: (_nodeId: string) => 'locked' | 'available' | 'unlocked';
}

// ❌ WRONG — ESLint will flag 'tier' and 'talentId' as unused
interface TalentTreeConfig {
  onTierUnlock: (tier: number) => void;
  onTalentSelect: (talentId: string, tier: number) => boolean;
}
```

**Why This Matters:**
- ESLint `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'` treats `_x` params as intentionally unused
- Without the prefix, the linter errors — even though the param name is required by TS syntax
- **Rule applies to interfaces only** — in actual function implementations, use `_param` only if you genuinely don't use the value

**Pitfalls to Avoid:**
- ❌ Don't prefix params in actual implementations unless they are truly unused
- ❌ Don't forget: this is a linter convention, not a TypeScript feature
- ✅ Always prefix when the type param is decorative (name required, value unused)

**ESLint Config Required:**
```json
{
  "@typescript-eslint/no-unused-vars": ["error", {
    "argsIgnorePattern": "^_",
    "varsIgnorePattern": "^_"
  }]
}
```

---

## Testing Patterns (Epic 7+)

### `within()` Scoping for Duplicate TestIDs (AI-7-3)

**Pattern:** When a `data-testid` appears in multiple sections of the DOM, use `within(section)` to scope queries to the correct container.

**When to Use:**
- A testid like `groom-name` appears in both a list row AND a detail panel
- A form rendered inside a modal that also exists on the main page
- Any component repeated N times where you need to target a specific instance

**Implementation:**

```tsx
import { screen, within } from '@testing-library/react';

// ❌ WRONG — fails with "Found multiple elements with testid groom-name"
const groomName = screen.getByTestId('groom-name');

// ✅ CORRECT — scope to the specific section first
const detailPanel = screen.getByTestId('groom-detail-panel');
const groomName = within(detailPanel).getByTestId('groom-name');

// ✅ CORRECT — scope to a specific list row
const listRows = screen.getAllByTestId('groom-list-row');
const firstRowName = within(listRows[0]).getByTestId('groom-name');
```

**Real-World Example (Epic 7 — Groom System):**

```tsx
// Groom career dashboard has stats in both a summary card AND a detail section
it('shows XP in the career detail section', () => {
  render(<GroomCareerDashboard groom={mockGroom} />);

  const careerSection = screen.getByTestId('career-detail-section');
  // This won't clash with the summary card's xp-display testid
  expect(within(careerSection).getByTestId('xp-display')).toHaveTextContent('250 XP');
});
```

**Pitfalls to Avoid:**
- ❌ Don't use `getAllByTestId()[0]` when you mean "the one in section X" — be explicit
- ❌ Don't add unique testids to every repeated element just to avoid `within()` — that bloats testids
- ✅ Use `within()` + a semantically named section testid as the anchor

**Related Patterns:**
- `screen.getAllByTestId()` — when you genuinely need all instances
- `screen.getByRole()` within a section — role-based queries are preferred over testid when possible

---

## Session Workflow Patterns (Epic 7+)

### Session Start Checklist (AI-7-4)

**Pattern:** Begin every development session with `bd ready` to find the next available work item before doing anything else.

**When to Use:** Always — at the start of every development session.

**Workflow:**

```bash
# 1. Check what's available
bd ready

# 2. Review the top issue in detail
bd show <id>

# 3. Claim it
bd update <id> --status=in_progress

# 4. Now start coding
```

**Why:** Prevents working on already-assigned or blocked issues, and keeps the beads board accurate for sprint tracking.

---

---

## Backend Algorithm Patterns (Epic 31E+)

### Per-Locus Probability — Multi-Locus Genetics Calculation (31E-5)

**Pattern:** Calculate offspring genotype probabilities using per-locus Punnett squares combined via Cartesian product, then aggregate by phenotype.

**When to Use:**
- Any system requiring "probability distribution of possible offspring outcomes" across independent loci
- Coat color breeding prediction (implemented in `breedingColorPredictionService.mjs`)
- Future trait genetics, behavioral genetics inheritance probability displays
- Any Mendelian multi-locus calculation where brute-force enumeration is computationally infeasible

**Why Not Brute Force:**
With N loci, brute-force enumerates 2^N × 2^N parent combinations. At 17 loci: 17 billion combinations — infeasible at <500ms. Per-locus approach scales as O(N × 4) — constant per locus.

**Implementation:**

```javascript
// Step 1: Per-locus Punnett square (at most 4 outcomes per locus)
function generateLocusProbabilities(sireAllelePair, damAllelePair) {
  const sireAlleles = splitAlleles(sireAllelePair); // ["E", "e"]
  const damAlleles = splitAlleles(damAllelePair);   // ["E", "e"]

  const outcomes = {};
  for (const sa of sireAlleles) {
    for (const da of damAlleles) {
      const key = [sa, da].sort().join('/'); // normalize "e/E" → "E/e"
      outcomes[key] = (outcomes[key] ?? 0) + 0.25;
    }
  }
  return outcomes; // { "E/E": 0.25, "E/e": 0.50, "e/e": 0.25 }
}

// Step 2: Cartesian product across all loci
function generateAllGenotypeProbabilities(sireGenotype, damGenotype) {
  let genotypeProbabilities = [{ genotype: {}, probability: 1.0 }];

  for (const locus of CORE_LOCI) {
    const locusDist = generateLocusProbabilities(
      sireGenotype[locus],
      damGenotype[locus]
    );
    const expanded = [];
    for (const existing of genotypeProbabilities) {
      for (const [allelePair, prob] of Object.entries(locusDist)) {
        expanded.push({
          genotype: { ...existing.genotype, [locus]: allelePair },
          probability: existing.probability * prob,
        });
      }
    }
    genotypeProbabilities = expanded;
  }
  return genotypeProbabilities;
}

// Step 3: Filter lethals + renormalize
function filterLethalGenotypes(genotypeProbabilities) {
  const filtered = genotypeProbabilities.filter(
    ({ genotype }) => !isLethalCombination(genotype)
  );
  const totalRemaining = filtered.reduce((sum, g) => sum + g.probability, 0);
  if (totalRemaining <= 0) return []; // all-lethal edge case
  return filtered.map(g => ({
    ...g,
    probability: Math.min(1, g.probability / totalRemaining), // cap at 1.0 for float safety
  }));
}

// Step 4: Aggregate by phenotype
function aggregateByPhenotype(genotypeProbabilities) {
  const byColor = {};
  for (const { genotype, probability } of genotypeProbabilities) {
    const { colorName } = calculatePhenotype(genotype);
    byColor[colorName] = (byColor[colorName] ?? 0) + probability;
  }
  return Object.entries(byColor)
    .map(([colorName, probability]) => ({
      colorName,
      probability,
      percentage: `${(probability * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.probability - a.probability);
}
```

**Key Design Decisions:**
- Allele pairs stored as `"E/e"` strings — use `splitAlleles()` to parse
- Lethal combinations filtered BEFORE phenotype aggregation — probabilities renormalized after removal
- `Math.min(1, probability / total)` caps renormalized values — guards against floating-point over 1.0
- Self-cross guard in controller: check `sireId === damId` → 400 before any DB work

**Files:**
- Service: `backend/modules/horses/services/breedingColorPredictionService.mjs`
- Tests: `backend/modules/horses/__tests__/breedingColorPredictionService.test.mjs`
- HTTP integration tests: `backend/tests/integration/breedingColorPredictionRoute.test.mjs`
- Controller function: `horseController.mjs#getBreedingColorPrediction`

**Pitfalls to Avoid:**
- Never brute-force enumerate 2^N combinations for N > 10 loci
- Always renormalize probabilities after lethal filtering — otherwise chart doesn't sum to 100%
- Always handle the all-lethal edge case (empty array after filtering) — return empty `possibleColors`
- Controller must use static imports for the prediction service (not dynamic) to avoid circular dependency issues

---

### Universal Selector in Lookup Tables — `_any` sentinel + canonical set (31D-4)

**Pattern:** When a lookup table needs to express "this row applies to ALL valid keys" without enumerating every key, use the literal key `_any` as a sentinel AND keep a `CANONICAL_*` set that valid keys must belong to. Look up the sentinel only after validating the input against the canonical set — otherwise a typo'd or non-canonical key would silently receive the universal bonus.

**When to Use:**
- A table that maps (Group → SubKey → modifier) where some groups apply uniformly to every sub-key (Calm/Steady horse temperaments apply +10% bond gain regardless of groom personality).
- Any "universal trait", "universal discipline", or "universal class" modifier in a config table.
- Anywhere enumerating "all the keys" would duplicate config and drift across migrations.

**When NOT to Use:**
- If the universal value is the *common case* and per-key overrides are rare, invert the structure: store a default value at the top level and only list exceptions. The `_any` sentinel is for the *rare* case of universal-on-this-group.
- If the lookup is performance-critical, the canonical-set membership check adds an extra step. Profile first.

**Implementation:**

```javascript
// backend/modules/horses/services/temperamentService.mjs:101-152

// Lookup table: temperament → personality → modifier. `_any` means
// "this temperament applies uniformly to every canonical personality".
export const TEMPERAMENT_GROOM_SYNERGY = Object.freeze({
  Spirited: Object.freeze({ energetic: 0.2 }),
  Nervous: Object.freeze({ patient: 0.25, gentle: 0.25, strict: -0.15 }),
  Calm: Object.freeze({ _any: 0.1 }),   // universal +10% for any canonical personality
  Steady: Object.freeze({ _any: 0.1 }), // universal +10% for any canonical personality
  // ... per-personality overrides for the other temperaments
});

// Canonical key set — guards against typos / non-canonical personalities
// silently receiving the universal bonus via the _any sentinel.
const CANONICAL_GROOM_PERSONALITIES = new Set(['gentle', 'energetic', 'patient', 'strict']);

export function getTemperamentGroomSynergy(temperament, groomPersonality) {
  if (!temperament || typeof temperament !== 'string') return 0;
  if (!groomPersonality || typeof groomPersonality !== 'string') return 0;

  const synergyMap = TEMPERAMENT_GROOM_SYNERGY[temperament.trim()];
  if (!synergyMap) return 0;

  const normalized = groomPersonality.trim().toLowerCase();

  // CRITICAL: validate against canonical set BEFORE checking _any.
  // Without this, "energetig" (typo) would still match the _any rule for
  // Calm/Steady and silently receive +10% — a class of stealth-bonus bug.
  if (!CANONICAL_GROOM_PERSONALITIES.has(normalized)) {
    return 0;
  }

  if ('_any' in synergyMap) {
    return synergyMap._any;
  }
  return synergyMap[normalized] ?? 0;
}
```

**Key Design Decisions:**
- `_any` is a string literal prefixed with `_` so it cannot collide with any real key (real keys are lowercase letters).
- The canonical set is `new Set()` for O(1) membership lookup.
- Validation happens BEFORE the `_any` check. Reordering these two checks reintroduces the stealth-bonus bug — write a test for the typo case.
- The set lives next to the table it guards. Keep them physically adjacent in source so future contributors update both together.

**Sentinel-Positive Test (required):**

```javascript
test('non-canonical personality returns 0 even when temperament has _any', () => {
  // Calm has _any: 0.1 — a typo'd personality must NOT trigger it.
  expect(getTemperamentGroomSynergy('Calm', 'energetig')).toBe(0);
});

test('canonical personality receives _any bonus', () => {
  // All 4 canonical personalities should get the universal +10% for Calm.
  for (const p of ['gentle', 'energetic', 'patient', 'strict']) {
    expect(getTemperamentGroomSynergy('Calm', p)).toBe(0.1);
  }
});
```

**Files:**
- Service: `backend/modules/horses/services/temperamentService.mjs:101-152`
- Tests: `backend/__tests__/temperamentService.test.mjs`
- Source: Epic 31D-4 retro action item (2026-03-31, "Pattern Library update")

**Pitfalls to Avoid:**
- ❌ Look up `_any` before validating against canonical set → typo'd keys silently receive the bonus.
- ❌ Use a non-`_`-prefixed sentinel (e.g., `any`, `default`, `*`) → collides with a future legitimate key.
- ❌ Store the canonical set in a separate file from the table → contributors update one, not the other; the set drifts.
- ✅ Pair every `_any`-using table with a `CANONICAL_*` set co-located in the same file.
- ✅ Write the typo-test alongside the happy-path test so future refactors can't reorder the checks.

---

## Pattern Evolution

### Deprecated Patterns

None yet - all patterns are current and maintained.

### Upcoming Patterns (Epic 9B+)

Based on Epic 9B scope (Navigation & World Hub):
- World Hub location card patterns
- Horse Care Status Strip display patterns
- Place-based navigation patterns

---

**Last Updated:** 2026-04-09 (Epic 31E — per-locus probability genetics pattern added)
**Maintainer:** Frontend + Backend Team
**Review Schedule:** After each epic completion
