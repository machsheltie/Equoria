# Story 8.6: Breeding Live

Status: complete

## Story

As a **player**,
I want to **breed horses and raise foals using real game mechanics**,
so that **foal development and trait discovery are genuine gameplay**.

## Acceptance Criteria

1. **Given** I am authenticated with eligible horses **When** I initiate breeding **Then** `POST /api/horses/foals` fires and a foal is created with real genetics

2. **And** foal data loads from real `GET /api/foals/:id`

3. **And** foal development loads from real `GET /api/foals/:id/development`

4. **And** foal activities load from real `GET /api/foals/:id/activities`

5. **And** enrichment activities call real `POST /api/foals/:id/enrich`

6. **And** trait discovery calls real `POST /api/foals/:id/reveal-traits`

7. **And** breeding predictions load from real `POST /api/genetics/inbreeding-analysis`, `GET /api/breeding/lineage-analysis/:s/:m`, `POST /api/breeding/genetic-probability`, `POST /api/genetics/breeding-compatibility`

8. **And** loading states render while data fetches

## Tasks / Subtasks

- [x] Task 1: Add missing MSW handlers for breeding endpoints (AC: 1, 7)

  - [x] 1.1: Add `POST /api/horses/foals` → `{ success: true, foalId: 10, message: 'Foal created' }`
  - [x] 1.2: Add `GET /api/horses/:id/breeding-data` → horse breeding data fixture
  - [x] 1.3: Add `POST /api/genetics/inbreeding-analysis` → inbreeding result fixture
  - [x] 1.4: Add `GET /api/breeding/lineage-analysis/:stallionId/:mareId` → lineage fixture
  - [x] 1.5: Add `POST /api/breeding/genetic-probability` → genetic probability fixture
  - [x] 1.6: Add `POST /api/genetics/breeding-compatibility` → compatibility fixture

- [x] Task 2: Write breeding hook tests `useBreeding.story-8-6.test.tsx` (AC: 1–6)

  - [x] 2.1: `useBreedFoal` mutation — succeeds and returns foalId (2 tests)
  - [x] 2.2: `useFoal` — returns Foal with id and name (2 tests)
  - [x] 2.3: `useFoalDevelopment` — returns FoalDevelopment with stage/progress (2 tests)
  - [x] 2.4: `useFoalActivities` — returns FoalActivity[] (2 tests)
  - [x] 2.5: `useEnrichFoal` mutation — succeeds (2 tests)
  - [x] 2.6: `useRevealFoalTraits` mutation — succeeds and returns traits[] (2 tests)
  - [x] 2.7: `breedingQueryKeys` — correct query key structure (3 tests)

- [x] Task 3: Write breeding prediction hook tests `useBreedingPrediction.story-8-6.test.tsx` (AC: 7)

  - [x] 3.1: `useHorseBreedingData` — returns data for a horseId (2 tests)
  - [x] 3.2: `useInbreedingAnalysis` — returns result for stallionId + mareId (2 tests)
  - [x] 3.3: `useLineageAnalysis` — returns lineage data (2 tests)
  - [x] 3.4: `useGeneticProbability` — returns genetic data (2 tests)
  - [x] 3.5: `useBreedingCompatibility` — returns compatibility score (2 tests)

## Dev Notes

### CRITICAL: This Is a Wiring Verification Story — Hooks Are Already Built

The hooks in `frontend/src/hooks/api/useBreeding.ts` and `frontend/src/hooks/api/useBreedingPrediction.ts`
are already implemented. The work is:

1. Add missing MSW handlers for breeding endpoints
2. Write tests proving each hook returns correct data shapes

**DO NOT** rewrite the hook files — they already work correctly.

---

### Actual API URLs (from api-client.ts)

```typescript
export const breedingApi = {
  breedFoal:          (payload)  => POST `/api/horses/foals`
  getFoal:            (foalId)   => GET  `/api/foals/${foalId}`
  getFoalDevelopment: (foalId)   => GET  `/api/foals/${foalId}/development`
  getFoalActivities:  (foalId)   => GET  `/api/foals/${foalId}/activities`
  logFoalActivity:    (id, act)  => POST `/api/foals/${foalId}/activity`
  enrichFoal:         (id, act)  => POST `/api/foals/${foalId}/enrich`
  revealTraits:       (foalId)   => POST `/api/foals/${foalId}/reveal-traits`
  developFoal:        (id, upd)  => PUT  `/api/foals/${foalId}/develop`
};

export const horsesApi = {
  getBreedingData:    (horseId)  => GET  `/api/horses/${horseId}/breeding-data`
};

export const breedingPredictionApi = {
  getInbreedingAnalysis:    (p)      => POST `/api/genetics/inbreeding-analysis`
  getLineageAnalysis:       (s, m)   => GET  `/api/breeding/lineage-analysis/${s}/${m}`
  getGeneticProbability:    (p)      => POST `/api/breeding/genetic-probability`
  getBreedingCompatibility: (p)      => POST `/api/genetics/breeding-compatibility`
};
```

---

### Interface Shapes (api-client.ts)

```typescript
interface BreedRequest {
  sireId: number;
  damId: number;
  userId?: string;
}

interface BreedResponse {
  success?: boolean;
  message?: string;
  foalId?: number;
  foal?: Foal;
}

interface Foal {
  id: number;
  name?: string;
  sireId?: number;
  damId?: number;
  ageDays?: number;
  traits?: string[];
}

interface FoalDevelopment {
  stage?: string;
  progress?: number;
  bonding?: number;
  stress?: number;
  enrichmentLevel?: number;
  currentDay: number;
  bondingLevel: number;
  stressLevel: number;
  completedActivities: { [day: number]: string[] };
  maxDay: number;
}

interface FoalActivity {
  id?: number;
  activity: string;
  duration?: number;
  createdAt?: string;
}
```

---

### Current MSW Handler State

**Breeding handlers — ALREADY CORRECT:**

```typescript
GET  /api/foals/:id             → Foal fixture ✓
GET  /api/foals/:id/development → FoalDevelopment ✓
GET  /api/foals/:id/activities  → FoalActivity[] ✓
POST /api/foals/:id/activity    → activity result ✓
POST /api/foals/:id/enrich      → enrichment result ✓
POST /api/foals/:id/reveal-traits → { traits: [...] } ✓
PUT  /api/foals/:id/develop     → development update ✓
```

**Missing handlers (need adding):**

```typescript
POST /api/horses/foals                              ← MISSING (breedFoal uses this)
GET  /api/horses/:id/breeding-data                  ← MISSING
POST /api/genetics/inbreeding-analysis              ← MISSING
GET  /api/breeding/lineage-analysis/:s/:m           ← MISSING
POST /api/breeding/genetic-probability              ← MISSING
POST /api/genetics/breeding-compatibility           ← MISSING
```

Note: Handler at `POST /api/foals/breeding/breed` exists but is the WRONG path for breedingApi.breedFoal.
Do NOT remove it (may be used by other components). Just ADD the correct handler.

---

### References

- [Source: frontend/src/hooks/api/useBreeding.ts] — breeding hook implementations
- [Source: frontend/src/hooks/api/useBreedingPrediction.ts] — prediction hook implementations
- [Source: frontend/src/lib/api-client.ts] — breedingApi, horsesApi, breedingPredictionApi
- [Source: frontend/src/test/msw/handlers.ts] — existing handlers
- [Source: frontend/src/test/setup.ts] — `onUnhandledRequest: 'error'`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

N/A — All 25 tests passed on first run.

### Completion Notes List

- Added 6 missing MSW handlers: `POST /api/horses/foals` (correct breedFoal path), `GET /api/horses/:id/breeding-data`, `POST /api/genetics/inbreeding-analysis`, `GET /api/breeding/lineage-analysis/:stallionId/:mareId`, `POST /api/breeding/genetic-probability`, `POST /api/genetics/breeding-compatibility`
- Preserved existing `POST /api/foals/breeding/breed` handler (wrong path but may be used elsewhere)
- 15/15 tests pass in useBreeding.story-8-6.test.tsx (AC: 1–6)
- 10/10 tests pass in useBreedingPrediction.story-8-6.test.tsx (AC: 7)
- Total: 25/25 tests

### File List

- `frontend/src/test/msw/handlers.ts` — 6 new handlers added
- `frontend/src/hooks/api/__tests__/useBreeding.story-8-6.test.tsx` — created (15 tests)
- `frontend/src/hooks/api/__tests__/useBreedingPrediction.story-8-6.test.tsx` — created (10 tests)
