# Story 8.5: Training & Competition Live

Status: complete

## Story

As a **player**,
I want to **train my horses and enter competitions with real results**,
so that **my horses actually progress and earn prizes**.

## Acceptance Criteria

1. **Given** I am authenticated with eligible horses **When** I initiate a training session **Then** `POST /api/training/train` fires and returns real results

2. **And** training eligibility (`POST /api/training/check-eligibility`) reflects real backend validation

3. **And** trainable horses load from real `GET /api/training/trainable/:userId`

4. **And** training overview loads from `GET /api/training/status/:horseId`

5. **And** competition list loads from real `GET /api/competition`

6. **And** competition entry calls real `POST /api/competition/enter`

7. **And** loading states render while data fetches

8. **And** `useCompetitions` staleTime is `5 * 60 * 1000`

## Tasks / Subtasks

- [x] Task 1: Add missing `/api/competition` MSW handlers (AC: 5, 6)

  - [x] 1.1: Add `GET /api/competition` → returns `Competition[]` fixture (3 competitions)
  - [x] 1.2: Add `GET /api/competition/disciplines` → returns disciplines list
  - [x] 1.3: Add `GET /api/competition/eligibility/:horseId/:discipline` → returns eligibility
  - [x] 1.4: Add `POST /api/competition/enter` → returns `{ success: true, data: { entryId: 101 } }`

- [x] Task 2: Write training hook tests `useTraining.story-8-5.test.tsx` (AC: 1–4)

  - [x] 2.1: `useTrainableHorses` — returns `TrainableHorse[]` for a userId (3 tests)
  - [x] 2.2: `useTrainingOverview` — returns `DisciplineStatus[]` for a horseId (2 tests)
  - [x] 2.3: `useTrainingStatus` — returns `DisciplineStatus` for horseId + discipline (2 tests)
  - [x] 2.4: `useTrainingEligibility` — returns eligibility object (2 tests)
  - [x] 2.5: `useTrainHorse` mutation — succeeds and returns training result (2 tests)
  - [x] 2.6: `trainingQueryKeys` — correct query key structure (3 tests)

- [x] Task 3: Write competition hook tests `useCompetitions.story-8-5.test.tsx` (AC: 5–8)

  - [x] 3.1: `useCompetitions` — returns `Competition[]` (3 tests)
  - [x] 3.2: `useEnterCompetition` mutation — succeeds (2 tests)
  - [x] 3.3: `competitionKeys` — correct query key structure (2 tests)

## Dev Notes

### CRITICAL: This Is a Wiring Verification Story — Hooks Are Already Built

The hooks in `frontend/src/hooks/api/useTraining.ts` and `frontend/src/hooks/api/useCompetitions.ts`
are already implemented. The work is:

1. Fix missing MSW handlers for the competition API (uses `/api/competition` singular — NOT `/api/competitions`)
2. Write tests proving each hook returns correct data shapes

**DO NOT** rewrite the hook files — they already work correctly.

---

### CRITICAL: URL Path Mismatch (Competition Hooks)

The existing MSW handlers for competitions are at **wrong paths**:

```
MSW handlers at:           competitionsApi calls:
GET /api/competitions      GET /api/competition      ← MISSING
POST /api/competitions/enter  POST /api/competition/enter  ← MISSING
```

The competition hooks use `competitionsApi` which calls `/api/competition` (singular).
The existing MSW `/api/competitions` (plural) handlers serve other components (CompetitionBrowser)
and must NOT be removed. Add new handlers at the correct paths.

---

### Actual API URLs (from api-client.ts)

```typescript
export const trainingApi = {
  getTrainableHorses: (userId) => GET  `/api/training/trainable/${userId}`
  checkEligibility:   (payload) => POST `/api/training/check-eligibility`
  train:              (payload) => POST `/api/training/train`
  getDisciplineStatus:(id, disc) => GET `/api/training/status/${id}/${discipline}`
  getHorseStatus:     (id)      => GET  `/api/training/status/${id}`
};

export const competitionsApi = {
  list:            ()             => GET  `/api/competition`
  getDisciplines:  ()             => GET  `/api/competition/disciplines`
  checkEligibility:(id, disc)    => GET  `/api/competition/eligibility/${id}/${discipline}`
  enter:           (data)         => POST `/api/competition/enter`
};
```

---

### Interface Shapes (api-client.ts)

```typescript
interface TrainableHorse {
  id: number;
  name: string;
  level?: number;
  breed?: string;
  bestDisciplines?: string[];
  nextEligibleAt?: string | null;
}

interface TrainingRequest {
  horseId: number;
  discipline: string;
}

interface TrainingEligibility {
  eligible: boolean;
  reason?: string;
  cooldownEndsAt?: string | null;
}

interface DisciplineStatus {
  discipline: string;
  score?: number;
  nextEligibleDate?: string | null;
  lastTrainedAt?: string | null;
}

interface TrainingResult {
  success: boolean;
  updatedHorse: { id: number; name: string; discipline_scores?: Record<string, number> } | null;
  message: string;
  nextEligible: string | null;
  // Backward-compat fields added by trainingApi.train():
  updatedScore: number;
  nextEligibleDate: string;
  discipline: string;
  horseId: number;
}

interface Competition {
  id: number;
  name: string;
  discipline: string;
  date: string;
  entryFee: number;
  prizePool: number;
  status: string;
  maxEntries?: number;
  currentEntries?: number;
  location?: string;
}

interface EligibilityResult {
  eligible: boolean;
  reasons?: string[];
}
```

---

### Current MSW Handler State

**Training handlers — ALREADY CORRECT (no changes needed):**

```typescript
POST /api/training/check-eligibility → { success: true, data: { eligible: true, reason: null } }
POST /api/training/train             → training result object
GET  /api/training/status/:id/:disc  → DisciplineStatus
GET  /api/training/status/:id        → DisciplineStatus[]
GET  /api/training/trainable/:userId → TrainableHorse[]
```

**Competition handlers — MISSING at correct paths:**

```typescript
// These exist at /api/competitions (plural) — wrong path for competitionsApi hooks
// Need new handlers at /api/competition (singular):
GET  /api/competition                          ← MISSING
GET  /api/competition/disciplines              ← MISSING
GET  /api/competition/eligibility/:id/:disc   ← MISSING
POST /api/competition/enter                   ← MISSING
```

---

### Fixture Data to Use

**Competition fixture:**

```typescript
[
  {
    id: 1,
    name: 'Spring Dressage Championship',
    discipline: 'dressage',
    date: '2026-03-15T10:00:00Z',
    entryFee: 50,
    prizePool: 5000,
    status: 'open',
    maxEntries: 20,
    currentEntries: 12,
    location: 'Central Arena',
  },
  {
    id: 2,
    name: 'Weekly Jumping Series',
    discipline: 'jumping',
    date: '2026-02-10T14:00:00Z',
    entryFee: 25,
    prizePool: 2500,
    status: 'open',
    maxEntries: 30,
    currentEntries: 28,
  },
  {
    id: 3,
    name: 'Free Training Show',
    discipline: 'eventing',
    date: '2026-02-05T09:00:00Z',
    entryFee: 0,
    prizePool: 0,
    status: 'open',
    maxEntries: 50,
    currentEntries: 15,
  },
];
```

---

### Test File Locations

```
frontend/src/hooks/api/__tests__/useTraining.story-8-5.test.tsx
frontend/src/hooks/api/__tests__/useCompetitions.story-8-5.test.tsx
```

Pattern follows Story 8.3 `useHorses.story-8-3.test.tsx` and Story 8.4 `useGrooms.story-8-4.test.tsx`.

---

### References

- [Source: frontend/src/hooks/api/useTraining.ts] — training hook implementations
- [Source: frontend/src/hooks/api/useCompetitions.ts] — competition hook implementations
- [Source: frontend/src/lib/api-client.ts] — trainingApi and competitionsApi URL surfaces
- [Source: frontend/src/test/msw/handlers.ts] — existing handlers (training OK, competition wrong path)
- [Source: frontend/src/test/setup.ts] — `onUnhandledRequest: 'error'`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

- 21/21 tests passing (useTrainableHorses x3, useTrainingOverview x2, useTrainingStatus x2, useTrainingEligibility x2, useTrainHorse x2, trainingQueryKeys x3, useCompetitions x3, useEnterCompetition x2, competitionKeys x2)
- Training hooks had working MSW handlers already — no handler changes needed for training
- Competition hooks call `/api/competition` (singular) but all existing MSW handlers were at `/api/competitions` (plural) — added 4 new handlers at correct singular paths
- Existing `/api/competitions` handlers preserved (serve CompetitionBrowser and other components)
- No changes to hook files — hooks were already correct
- Story 8.3 and 8.4 regression confirmed: all 35 prior tests still pass

### File List

- frontend/src/test/msw/handlers.ts (modified — added 4 /api/competition singular handlers)
- frontend/src/hooks/api/**tests**/useTraining.story-8-5.test.tsx (created — 14 tests)
- frontend/src/hooks/api/**tests**/useCompetitions.story-8-5.test.tsx (created — 7 tests)
