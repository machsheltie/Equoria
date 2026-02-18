# Story 8.4: Groom System Live

Status: complete

## Story

As a **player**,
I want to **hire, assign, and manage grooms using real data**,
so that **groom actions have real effects on my stable**.

## Acceptance Criteria

1. **Given** I am authenticated **When** I open the groom marketplace **Then** I see available grooms fetched from `GET /api/groom-marketplace`

2. **And** hiring a groom calls real `POST /api/groom-marketplace/hire` and returns updated groom + cost

3. **And** my grooms list reflects real hired grooms from `GET /api/grooms/user/:userId`

4. **And** assigning a groom calls real `POST /api/groom-assignments`

5. **And** groom assignments load from real `GET /api/groom-assignments`

6. **And** salary summary loads from real `GET /api/groom-salaries/summary`

7. **And** loading states render while data fetches

8. **And** `useGroomMarketplace` staleTime is `60 * 1000` (already correct)

## Tasks / Subtasks

- [x] Task 1: Fix `GET /api/groom-marketplace` MSW handler (AC: 1)

  - [x] 1.1: Current handler returns `data: []` — wrong shape. `MarketplaceData` requires `{ grooms: MarketplaceGroom[], lastRefresh, nextFreeRefresh, refreshCost, canRefreshFree, refreshCount }`
  - [x] 1.2: Replace with full fixture returning 2 `MarketplaceGroom` objects
  - [x] 1.3: `MarketplaceGroom` fields: `{ marketplaceId, firstName, lastName, specialty, skillLevel, personality, experience, sessionRate, bio, availability }`

- [x] Task 2: Fix `GET /api/grooms/user/:userId` MSW handler (AC: 3)

  - [x] 2.1: Current handler returns `data: []` — should return `Groom[]` with real fixture
  - [x] 2.2: `Groom` fields: `{ id, name, skillLevel, specialty, personality, experience, sessionRate, isActive, availableSlots, currentAssignments, maxAssignments }`
  - [x] 2.3: Return 1 hired groom fixture for all userId values

- [x] Task 3: Add missing POST MSW handlers (AC: 2, 4)

  - [x] 3.1: `POST /api/groom-marketplace/hire` → return `{ success: true, data: { groom: Groom, cost: number, remainingMoney: number } }`
  - [x] 3.2: `POST /api/groom-marketplace/refresh` → return updated `MarketplaceData`
  - [x] 3.3: `POST /api/groom-assignments` → return `{ success: true }`

- [x] Task 4: Write hook tests `useGrooms.story-8-4.test.tsx` (AC: 1–8)

  - [x] 4.1: `useGroomMarketplace` — returns `MarketplaceData` with `grooms` array (3 tests)
  - [x] 4.2: `useUserGrooms` — returns `Groom[]` for a userId (3 tests)
  - [x] 4.3: `useGroomAssignments` — returns `GroomAssignment[]` (2 tests)
  - [x] 4.4: `useGroomSalaries` — returns `SalarySummary` (2 tests)
  - [x] 4.5: `useHireGroom` mutation — succeeds and invalidates queries (2 tests)
  - [x] 4.6: `useAssignGroom` mutation — succeeds and invalidates queries (2 tests)
  - [x] 4.7: `groomKeys` query key structure (3 tests)

## Dev Notes

### CRITICAL: This Is a Wiring Verification Story — Hooks Are Already Built

The hooks in `frontend/src/hooks/api/useGrooms.ts` are already implemented and point to real API
client endpoints in `frontend/src/lib/api-client.ts`. The work is:

1. Fix broken/incomplete MSW handlers so tests can run against them
2. Add missing POST handlers so mutations can be tested
3. Write tests proving each hook returns correct data shapes

**DO NOT** rewrite `useGrooms.ts` or `groomsApi` — they already work correctly.

---

### Actual API URLs (from groomsApi in api-client.ts)

Note: Some URL names differ from the original epics.md spec — the client uses these actual paths:

```typescript
export const groomsApi = {
  getUserGrooms:    (userId) => GET  `/api/grooms/user/${userId}`
  getAssignments:   ()       => GET  `/api/groom-assignments`
  getSalarySummary: ()       => GET  `/api/groom-salaries/summary`
  getMarketplace:   ()       => GET  `/api/groom-marketplace`
  getMarketplaceStats: ()    => GET  `/api/groom-marketplace/stats`
  hireGroom:        (id)     => POST `/api/groom-marketplace/hire`
  refreshMarketplace: (f)    => POST `/api/groom-marketplace/refresh`
  assignGroom:      (data)   => POST `/api/groom-assignments`
  deleteAssignment: (id)     => DEL  `/api/groom-assignments/:id`
};
```

---

### Interface Shapes (api-client.ts lines 308–380)

```typescript
interface Groom {
  id: number;
  name: string;
  skillLevel: string;
  specialty: string;
  personality: string;
  experience: number;
  sessionRate: number;
  isActive: boolean;
  availableSlots: number;
  currentAssignments: number;
  maxAssignments: number;
}

interface MarketplaceGroom {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  skillLevel: string;
  personality: string;
  experience: number;
  sessionRate: number;
  bio: string;
  availability: boolean;
}

interface MarketplaceData {
  grooms: MarketplaceGroom[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
  refreshCount: number;
}

interface GroomAssignment {
  id: number;
  groomId: number;
  horseId: number;
  priority: number;
  notes?: string;
  isActive: boolean;
  startDate: string;
}

interface SalarySummary {
  totalMonthlyCost: number;
  totalWeeklyCost: number;
  groomCount: number;
  breakdown: Array<{
    groomId: number;
    groomName: string;
    weeklyCost: number;
    assignmentCount: number;
  }>;
}
```

---

### Current MSW Handler State (handlers.ts)

**Broken handlers (need fixing):**

```typescript
// Returns wrong shape — data should be MarketplaceData, not []
http.get(`${base}/api/groom-marketplace`, () => HttpResponse.json({ success: true, data: [] }));

// Returns empty — should have Groom[] fixture
http.get(`${base}/api/grooms/user/:userId`, () => HttpResponse.json({ success: true, data: [] }));
```

**Missing handlers (need adding):**

```typescript
// Not present at all:
POST / api / groom - marketplace / hire;
POST / api / groom - marketplace / refresh;
POST / api / groom - assignments;
```

---

### Fixture Data to Use

**Marketplace fixture:**

```typescript
const marketplaceFixture: MarketplaceData = {
  grooms: [
    {
      marketplaceId: 'mp-001',
      firstName: 'Alice',
      lastName: 'Thornton',
      specialty: 'Dressage',
      skillLevel: 'Expert',
      personality: 'Calm',
      experience: 8,
      sessionRate: 150,
      bio: 'Experienced dressage specialist.',
      availability: true,
    },
    {
      marketplaceId: 'mp-002',
      firstName: 'Ben',
      lastName: 'Marsh',
      specialty: 'Show Jumping',
      skillLevel: 'Intermediate',
      personality: 'Energetic',
      experience: 4,
      sessionRate: 100,
      bio: 'Show jumping enthusiast.',
      availability: true,
    },
  ],
  lastRefresh: '2026-02-18T00:00:00Z',
  nextFreeRefresh: '2026-02-25T00:00:00Z',
  refreshCost: 500,
  canRefreshFree: false,
  refreshCount: 3,
};
```

**User grooms fixture:**

```typescript
const userGroomFixture: Groom = {
  id: 10,
  name: 'Alice Thornton',
  skillLevel: 'Expert',
  specialty: 'Dressage',
  personality: 'Calm',
  experience: 8,
  sessionRate: 150,
  isActive: true,
  availableSlots: 2,
  currentAssignments: 1,
  maxAssignments: 3,
};
```

**Salary fixture:**

```typescript
const salaryFixture: SalarySummary = {
  totalMonthlyCost: 600,
  totalWeeklyCost: 150,
  groomCount: 1,
  breakdown: [{ groomId: 10, groomName: 'Alice Thornton', weeklyCost: 150, assignmentCount: 1 }],
};
```

---

### Test File Location

```
frontend/src/hooks/api/__tests__/useGrooms.story-8-4.test.tsx
```

Pattern follows Story 8.3 `useHorses.story-8-3.test.tsx`.

---

### References

- [Source: frontend/src/hooks/api/useGrooms.ts] — hook implementations
- [Source: frontend/src/lib/api-client.ts#L308-380] — Groom interfaces
- [Source: frontend/src/lib/api-client.ts#L774-796] — groomsApi URL surface
- [Source: frontend/src/test/msw/handlers.ts] — existing handlers (broken/incomplete)
- [Source: frontend/src/test/setup.ts] — `onUnhandledRequest: 'error'`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

- 17/17 tests passing (useGroomMarketplace x3, useUserGrooms x3, useGroomAssignments x2, useGroomSalaries x2, useHireGroom x2, useAssignGroom x2, groomKeys x3)
- Fixed 4 broken/empty MSW handlers: GET /api/groom-marketplace, GET /api/grooms/user/:userId, GET /api/groom-assignments, GET /api/groom-salaries/summary
- Added 3 missing POST handlers: POST /api/groom-marketplace/hire, POST /api/groom-marketplace/refresh, POST /api/groom-assignments
- No changes to useGrooms.ts or api-client.ts — hooks were already correct
- Story 8.3 regression confirmed: all 29 tests still pass

### File List

- frontend/src/test/msw/handlers.ts (modified — fixed groom handlers, added POST handlers)
- frontend/src/hooks/api/**tests**/useGrooms.story-8-4.test.tsx (created — 17 tests)
