# Story 8.3: Horse Management Live

Status: complete

## Story

As a **player**,
I want to **see and manage my real horses**,
so that **I can plan training and breeding with accurate data**.

## Acceptance Criteria

1. **Given** I am authenticated **When** I navigate to the horses page **Then** I see my actual horses fetched from `GET /api/horses` — list renders correct names, breeds, and attributes

2. **And** the horse detail page loads real attributes, stats (speed/stamina/agility/strength/intelligence/health), discipline scores, traits, and parent IDs from `GET /api/horses/:id`

3. **And** search and filter interactions in `HorseListView` operate against the data returned from the real API (already implemented client-side via `useHorseFilters` + `applyFilters`)

4. **And** conformation scores load from real data (tab already calls `ConformationTab` with `horseId`)

5. **And** horse XP and progression data is accurate (XP tab renders via `XPProgressBar`, `StatProgressionChart`, `RecentGains`, `AgeUpCounter` — all call `horsesApi` sub-endpoints)

6. **And** loading states render while data is fetching (existing `isLoading` states in both pages)

7. **And** error state renders "Horse Not Found" or "Error Loading Horse" on API failure (existing error handling in `HorseDetailPage`)

8. **And** `useHorses()` staleTime is `0` (always refetch on mount — already correct, intentional design for fresh stable view)

9. **And** `useHorse()` staleTime is `60 * 1000` (1 minute for individual horse — already correct)

## Tasks / Subtasks

- [x]Task 1: Fix `GET /api/horses` MSW handler to return full `HorseSummary` shape (AC: 1, 3)

  - [x]1.1: Audit current handler (line 184 in `handlers.ts`) — returns only `{id, name, breed, gender}` but `HorseSummary` requires `age`, `dateOfBirth`, `healthStatus`, `stats`, `disciplineScores`
  - [x]1.2: Replace minimal response with two full `HorseSummary` fixture objects matching the interface
  - [x]1.3: Include `disciplineScores: { dressage: 45, show_jumping: 30 }` (non-empty so filter tests have data)
  - [x]1.4: Include `stats: { speed: 60, stamina: 55, agility: 50, strength: 45, intelligence: 70, health: 65 }`

- [x]Task 2: Add missing `GET /api/horses/:id` MSW handler (AC: 2, 6, 7)

  - [x]2.1: Add `http.get(${base}/api/horses/:id, ...)` handler to `handlers.ts`
  - [x]2.2: Return full `HorseSummary` for id `'1'` (Thunder / Storm Runner)
  - [x]2.3: Return `404` for id `'999'` (consistent with `useHorseCompetitionHistory` test pattern at line 667-669 in handlers.ts)
  - [x]2.4: Place BEFORE the sub-route handlers (`:id/training-history`, etc.) — but AFTER `GET /api/horses` (no sub-route conflict since `:id` is numeric segment)
  - [x]**WARNING**: Handler path must match `horsesApi.get()` URL which appends `?t=${Date.now()}` — MSW matches on pathname so query params are ignored automatically ✅

- [x]Task 3: Write hook tests for `useHorses.ts` (AC: 1, 2, 8, 9)

  - [x]3.1: Write `frontend/src/hooks/api/__tests__/useHorses.story-8-3.test.tsx`
  - [x]3.2: Test `useHorses()` — returns array of horses, each has `id`, `name`, `breed`, `stats`, `disciplineScores` from MSW mock (5 tests)
  - [x]3.3: Test `useHorse(horseId)` — returns single horse with full `HorseSummary` from new `:id` handler (5 tests)
  - [x]3.4: Test `useHorse(999)` — surfaces 404 error (2 tests)
  - [x]3.5: Test `useHorseTrainingHistory(horseId)` — returns `trainingHistory` array (3 tests)
  - [x]3.6: Test `horseQueryKeys` — correct key structure `['horses']`, `['horses', id]`, `['horses', id, 'training-history']` (3 tests)

- [x]Task 4: Write `HorseListView` integration tests (AC: 1, 3, 6)

  - [x]4.1: Write `frontend/src/components/__tests__/HorseListView.story-8-3.test.tsx`
  - [x]4.2: Test: list renders horse names from API (`Storm Runner`, `Midnight Dream`)
  - [x]4.3: Test: loading state renders while data fetches
  - [x]4.4: Test: empty state renders when API returns `[]`
  - [x]4.5: Test: search filter reduces visible horses by name match

- [x]Task 5: Write `HorseDetailPage` integration tests (AC: 2, 6, 7)

  - [x]5.1: Write `frontend/src/components/__tests__/HorseDetailPage.story-8-3.test.tsx`
  - [x]5.2: Test: renders horse name from `useHorse(1)` API response
  - [x]5.3: Test: renders breed, age, gender, healthStatus
  - [x]5.4: Test: loading spinner renders while data fetches
  - [x]5.5: Test: error state renders "Horse Not Found" for id 999

## Dev Notes

### CRITICAL: This Is a Wiring Verification Story — Components Are Already Built

The UI infrastructure is **fully complete** and wired to the API client:

- `frontend/src/hooks/api/useHorses.ts` — `useHorses()`, `useHorse(id)`, `useHorseTrainingHistory(id)` implemented using `horsesApi`
- `frontend/src/components/HorseListView.tsx` — already calls `useHorses()`; filtering via `useHorseFilters` + `applyFilters` is client-side
- `frontend/src/pages/HorseDetailPage.tsx` — already calls `useHorse(Number(id))`; tabs for overview, disciplines, genetics, conformation, progression, training all built
- `frontend/src/lib/api-client.ts` lines 747-768 — `horsesApi` with correct URLs

**The work is:**

1. Fix the `GET /api/horses` MSW handler (currently returns incomplete data)
2. Add the missing `GET /api/horses/:id` MSW handler (causes `onUnhandledRequest: 'error'` failures in any test that navigates to a horse detail)
3. Write tests proving the wiring is correct

**DO NOT** rewrite `HorseListView`, `HorseDetailPage`, `useHorses.ts`, or `horsesApi` beyond the two handler fixes above.

---

### Bug: `GET /api/horses` Handler Returns Incomplete `HorseSummary`

In `frontend/src/test/msw/handlers.ts` (line 184):

```typescript
// CURRENT (broken — HorseSummary interface requires more fields):
http.get(`${base}/api/horses`, () =>
  HttpResponse.json({
    success: true,
    data: [
      { id: 1, name: 'Storm Runner', breed: 'Thoroughbred', gender: 'stallion' },
      { id: 2, name: 'Midnight Dream', breed: 'Arabian', gender: 'mare' },
    ],
  })
),

// FIX (full HorseSummary shape):
http.get(`${base}/api/horses`, () =>
  HttpResponse.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Storm Runner',
        breed: 'Thoroughbred',
        gender: 'stallion',
        age: 5,
        dateOfBirth: '2020-01-01T00:00:00Z',
        healthStatus: 'Good',
        imageUrl: undefined,
        stats: { speed: 75, stamina: 70, agility: 65, strength: 60, intelligence: 55, health: 80 },
        disciplineScores: { dressage: 45, show_jumping: 55 },
        traits: ['Bold', 'Athletic'],
        description: 'A spirited thoroughbred with excellent racing potential.',
        parentIds: { sireId: 10, damId: 11 },
      },
      {
        id: 2,
        name: 'Midnight Dream',
        breed: 'Arabian',
        gender: 'mare',
        age: 4,
        dateOfBirth: '2021-03-15T00:00:00Z',
        healthStatus: 'Excellent',
        imageUrl: undefined,
        stats: { speed: 80, stamina: 75, agility: 85, strength: 55, intelligence: 90, health: 85 },
        disciplineScores: { dressage: 65, endurance: 70 },
        traits: ['Intelligent', 'Agile'],
        description: 'An elegant Arabian with exceptional endurance.',
        parentIds: {},
      },
    ],
  })
),
```

---

### Missing MSW Handler to Add (Task 2)

Add after the `GET /api/horses` list handler and before `GET /api/horses/:id/training-history` (line 193):

```typescript
// Single horse detail (used by useHorse hook → HorseDetailPage)
http.get(`${base}/api/horses/:id`, ({ params }) => {
  if (params.id === '999') {
    return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
  }
  return HttpResponse.json({
    success: true,
    data: {
      id: Number(params.id),
      name: 'Storm Runner',
      breed: 'Thoroughbred',
      gender: 'stallion',
      age: 5,
      dateOfBirth: '2020-01-01T00:00:00Z',
      healthStatus: 'Good',
      imageUrl: undefined,
      stats: { speed: 75, stamina: 70, agility: 65, strength: 60, intelligence: 55, health: 80 },
      disciplineScores: { dressage: 45, show_jumping: 55 },
      traits: ['Bold', 'Athletic'],
      description: 'A spirited thoroughbred with excellent racing potential.',
      parentIds: { sireId: 10, damId: 11 },
    },
  });
}),
```

**Warning:** This handler MUST appear AFTER `GET /api/horses` (exact match) and BEFORE `GET /api/horses/:id/training-history` (sub-route). MSW matches in registration order; the sub-routes won't be captured by `:id` because MSW matches the most specific route. However, to be safe, ensure ordering is:

```
1. GET /api/horses           (exact list)
2. GET /api/horses/:id       (single horse — NEW)
3. GET /api/horses/:id/training-history   (sub-routes)
4. ... other sub-routes
```

---

### API URLs — Confirmed Correct

From `frontend/src/lib/api-client.ts` (lines 747-768):

```typescript
export const horsesApi = {
  list: () => apiClient.get<HorseSummary[]>(`/api/horses?t=${Date.now()}`),
  get: (horseId: number) => apiClient.get<HorseSummary>(`/api/horses/${horseId}?t=${Date.now()}`),
  getTrainingHistory: (horseId: number) =>
    apiClient.get<HorseTrainingAnalytics>(`/api/horses/${horseId}/training-history`),
  // ... other sub-endpoints
};
```

Note: `?t=${Date.now()}` cache-busting is appended to `list()` and `get()`. MSW ignores query params when matching routes — no special handling needed in handlers.

---

### `HorseSummary` Interface (api-client.ts lines 148-168)

```typescript
interface HorseSummary {
  id: number;
  name: string;
  breed: string;
  age: number;
  ageYears?: number;
  gender: string;
  sex?: string;
  level?: number;
  dateOfBirth: string;
  healthStatus: string;
  imageUrl?: string;
  stats: SimpleHorseStats; // { speed, stamina, agility, strength, intelligence, health }
  disciplineScores: Record<string, number>;
  traits?: string[];
  description?: string;
  parentIds?: { sireId?: number; damId?: number };
}
```

---

### Horse Data Flow

```
HorseListView
  └── useHorses() → GET /api/horses
        Returns: HorseSummary[]
        Renders: name, breed, age, level, stats, disciplineScores
        Client-side: useHorseFilters + applyFilters (search, breed, age, eligibility)
        Client-side: pagination (computed from filtered array)

HorseDetailPage(id)
  ├── useHorse(Number(id)) → GET /api/horses/:id
  │     Returns: HorseSummary
  │     Renders: profile header, stats grid, 7-tab interface
  │
  ├── Tab: Genetics → useHorseEpigeneticInsights, useHorseTraitInteractions, useHorseTraitTimeline
  ├── Tab: Conformation → ConformationTab(horseId)
  ├── Tab: Progression → XPProgressBar, StatProgressionChart, RecentGains, AgeUpCounter, ScoreProgressionPanel
  └── Tab: Training → DisciplinePicker, TrainingConfirmModal, TrainingResultModal (via useTrainHorse)
```

---

### Test Render Helper Pattern for Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

it('returns list of horses', async () => {
  const { result } = renderHook(() => useHorses(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(2);
  expect(result.current.data?.[0].name).toBe('Storm Runner');
});
```

---

### Test Render Helper Pattern for HorseListView

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import HorseListView from '../HorseListView';

function renderHorseListView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HorseListView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

it('renders horse names from API', async () => {
  renderHorseListView();
  await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
  expect(screen.getByText('Midnight Dream')).toBeInTheDocument();
});
```

---

### Test Render Helper Pattern for HorseDetailPage

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HorseDetailPage from '../../pages/HorseDetailPage';

function renderHorseDetailPage(id = '1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/horses/${id}`]}>
        <Routes>
          <Route path="/horses/:id" element={<HorseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

it('renders horse name from API', async () => {
  renderHorseDetailPage('1');
  await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
});
```

---

### Test File Naming Convention

Follow existing patterns (from Story 8.2):

```
frontend/src/hooks/api/__tests__/useHorses.story-8-3.test.tsx
frontend/src/components/__tests__/HorseListView.story-8-3.test.tsx
frontend/src/components/__tests__/HorseDetailPage.story-8-3.test.tsx
```

---

### Backend Endpoints (Confirmed Present)

```
GET /api/horses            → horsesController.list()       (returns HorseSummary[])
GET /api/horses/:id        → horsesController.get()        (returns HorseSummary)
```

All endpoints return `{ success: true, data: { ... } }` format.
`api-client.ts:fetchWithAuth()` extracts `.data` automatically (line 583).

---

### staleTime Values

| Hook                          | staleTime            | Rationale                                                             |
| ----------------------------- | -------------------- | --------------------------------------------------------------------- |
| `useHorses()`                 | `0` (always refetch) | List must be current — horse count can change after transactions      |
| `useHorse(id)`                | `60 * 1000` (1 min)  | Individual detail is stable enough; invalidated by training mutations |
| `useHorseTrainingHistory(id)` | `30 * 1000` (30s)    | Training history freshness important for cooldown display             |

All values are **already correct** — no staleTime fixes needed for this story.

---

### Pre-Existing Test Failures (Not This Story's Problem)

22+ frontend test files fail pre-existing (Epic 6/7 BreedingPage, UserDashboard fixtures, etc.).
Story 8.3 tests should be isolated and not touch Epic 6/7 test files.

---

### References

- [Source: frontend/src/hooks/api/useHorses.ts] — hook implementations, staleTime values
- [Source: frontend/src/components/HorseListView.tsx] — list component using `useHorses()`
- [Source: frontend/src/pages/HorseDetailPage.tsx] — detail page using `useHorse(Number(id))`
- [Source: frontend/src/lib/api-client.ts#L148-168] — `HorseSummary` interface
- [Source: frontend/src/lib/api-client.ts#L747-768] — `horsesApi` URL surface
- [Source: frontend/src/test/msw/handlers.ts#L184-192] — existing incomplete `GET /api/horses` handler
- [Source: frontend/src/test/setup.ts#L24] — `onUnhandledRequest: 'error'` — new `/api/horses/:id` handler required
- [Source: docs/epics.md#Story-8.3] — Acceptance criteria

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

- All 29 Story 8.3 tests passing (18 hook + 5 HorseListView + 6 HorseDetailPage)
- Fixed GET /api/horses MSW handler to return full HorseSummary shape (Task 1)
- Added GET /api/horses/:id MSW handler with 404 for id 999 (Task 2)
- Key insight: jsdom window.innerWidth=1024 → isMobile=false → desktop table view always renders in tests; data-testid="horse-card-\*" never appears
- Key insight: HorseFilters expanded by default renders breed <span> elements; use { selector: 'div' } to target table cell uniquely
- Key insight: Use exact strings ('Breed: Thoroughbred') not regexes to avoid matching ancestor elements in HorseDetailPage assertions
- Key insight: search filter 300ms debounce requires final assertion wrapped in waitFor

### File List

- frontend/src/test/msw/handlers.ts (updated GET /api/horses handler + added GET /api/horses/:id handler)
- frontend/src/hooks/api/**tests**/useHorses.story-8-3.test.tsx (created, 18 tests)
- frontend/src/components/**tests**/HorseListView.story-8-3.test.tsx (created, 5 tests)
- frontend/src/components/**tests**/HorseDetailPage.story-8-3.test.tsx (created, 6 tests)
