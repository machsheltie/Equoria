# Story 3-4: XP & Progression Display - API Investigation

**Date:** 2025-12-09
**Status:** Task 0 - Backend API Analysis Complete

## Summary

Investigated backend API endpoints for XP and progression data. Found partial coverage - XP system endpoints exist, but stat history tracking needs to be created or exposed through existing training/XP history.

## Available Backend API Endpoints

### ✅ XP System Endpoints (horseXpController.mjs)

#### 1. GET /api/horses/:id/xp
**Purpose:** Get current XP status and progression info
**Auth Required:** Yes (horse owner only)
**Response Structure:**
```typescript
{
  success: true,
  data: {
    horseId: number;
    horseName: string;
    currentXP: number;
    availableStatPoints: number;
    nextStatPointAt: number;       // XP value for next stat point
    xpToNextStatPoint: number;     // How much XP needed
  }
}
```
**Notes:**
- XP to stat point conversion: 100 XP = 1 stat point
- This partially satisfies AC1 (XP progress bar data)

#### 2. GET /api/horses/:id/xp-history
**Purpose:** Get paginated XP event history
**Auth Required:** Yes (horse owner only)
**Query Params:**
- `limit` (number, default 50, max 100)
- `offset` (number, default 0)

**Response Structure:**
```typescript
{
  success: true,
  data: {
    events: Array<{
      // Event structure from horseXpModel
      // Likely includes: id, horseId, amount, reason, timestamp
    }>;
    count: number;            // Total events
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }
}
```
**Notes:**
- This partially provides data for AC2 (stat history) if XP events include stat changes
- Need to verify event structure in horseXpModel.mjs

#### 3. POST /api/horses/:id/allocate-stat
**Purpose:** Allocate a stat point to a specific stat
**Auth Required:** Yes (horse owner only)
**Request Body:**
```typescript
{
  statName: string; // Valid: speed, stamina, agility, balance, precision,
                    //        intelligence, boldness, flexibility, obedience, focus
}
```
**Response Structure:**
```typescript
{
  success: true,
  data: {
    statName: string;
    newStatValue: number;
    remainingStatPoints: number;
  }
}
```
**Notes:**
- This will be used for interactive stat allocation in the UI
- Not directly needed for progression display, but useful context

#### 4. POST /api/horses/:id/award-xp
**Purpose:** Award XP to horse (admin/system use)
**Auth Required:** Yes (horse owner only)
**Request Body:**
```typescript
{
  amount: number;    // Must be positive
  reason: string;    // Required
}
```
**Response Structure:**
```typescript
{
  success: true,
  data: {
    currentXP: number;
    availableStatPoints: number;
    xpGained: number;
    statPointsGained: number;
  }
}
```
**Notes:** System/testing use only - not needed for UI display

### ✅ Horse Overview & History (horseRoutes.mjs)

#### 5. GET /horses/:id/overview
**Purpose:** Comprehensive horse overview
**Auth Required:** Yes (horse owner only)
**Response:** Unknown (need to check horseController.getHorseOverview)
**Notes:** May contain useful progression data - needs investigation

#### 6. GET /horses/:id/history
**Purpose:** Competition history
**Auth Required:** Yes (horse owner only)
**Response:** Unknown (need to check horseController.getHorseHistory)
**Notes:** Competition-focused, not stat progression

#### 7. GET /horses/trait-trends
**Purpose:** Trait development trends across user's horses
**Auth Required:** Yes
**Query Params:**
- `userId` (string, required, must match authenticated user)
- `timeframe` (number, optional, 1-365 days, default 30)
**Response Structure:**
```typescript
{
  success: true,
  data: {
    trends: Array<any>;       // Currently empty in implementation
    patterns: object;         // Currently empty
    predictions: object;      // Currently empty
    timeframe: number;
    analysisDate: Date;
  }
}
```
**Notes:**
- Route exists but analysis functions are "mock functions for now" (line 173)
- Queries traitHistoryLog table which tracks trait changes over time
- This could be enhanced to provide stat history data
- **POTENTIAL:** This endpoint could be expanded for AC2 (stat progression graph)

## Missing/Needed Endpoints

### ❌ GET /api/horses/:id/stats/history
**Status:** NOT FOUND
**Purpose:** Get stat progression over time (AC2)
**Needed For:** StatProgressionChart component
**Proposed Response:**
```typescript
{
  success: true,
  data: Array<{
    date: string;
    stats: {
      speed: number;
      stamina: number;
      agility: number;
      balance: number;
      precision: number;
      intelligence: number;
      boldness: number;
      flexibility: number;
      obedience: number;
      focus: number;
    };
  }>
}
```
**Implementation Options:**
1. Create new endpoint by querying training history + stat allocations
2. Enhance `/horses/trait-trends` to return actual stat history
3. Use `/horses/:id/xp-history` if it includes stat allocation events

### ❌ GET /api/horses/:id/stats/recent
**Status:** NOT FOUND
**Purpose:** Get recent stat gains (last 30 days) (AC2)
**Needed For:** RecentGains component
**Proposed Response:**
```typescript
{
  success: true,
  data: Array<{
    date: string;
    stat: 'speed' | 'stamina' | ... ;
    change: number;
    source: string;
    sourceType: 'training' | 'competition' | 'age_up' | 'allocation' | 'other';
  }>
}
```
**Implementation Options:**
1. Query training results for stat increases
2. Query XP history for stat allocations
3. Combine both sources

### ❌ GET /api/horses/:id/age-progression
**Status:** NOT FOUND
**Purpose:** Get age progression and upcoming milestones (AC3)
**Needed For:** AgeUpCounter component
**Proposed Response:**
```typescript
{
  success: true,
  data: {
    currentAge: {
      years: number;
      months: number;
    };
    nextMilestone: {
      age: number;
      name: string;
      daysUntil: number;
    };
    expectedStatChanges: {
      speed: number;
      stamina: number;
      // ... other stats
    };
  }
}
```
**Implementation Notes:**
- Horse table has `dateOfBirth` field
- Can calculate age from dateOfBirth
- Age milestones logic needs to be defined (1yr, 2yr, 3yr, etc.)

### ❌ GET /api/horses/:id/recommendations
**Status:** NOT FOUND
**Purpose:** Get training recommendations based on potential (AC4)
**Needed For:** TrainingRecommendations component
**Proposed Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    stat: string;
    currentValue: number;
    potentialValue: number;
    gap: number;
    suggestedTraining: string[];
    reasoning: string;
  }>
}
```
**Implementation Notes:**
- Requires "potential" values to be defined (breed-based? genetics?)
- Needs training discipline to stat mapping
- Could use trait system to determine recommendations

## Database Tables Available

From investigation of route files and Prisma imports:

1. **Horse** - Main horse data with stats
2. **TraitHistoryLog** - Tracks trait changes over time (used by trait-trends)
3. **XP Events** (table name unknown) - Stores XP event history

**Need to investigate:**
- Does training system log stat changes?
- Does XP history include stat allocation events?
- Is there a stat history log table?

## Gap Analysis

| Acceptance Criteria | Backend Support | Gap |
|---------------------|----------------|-----|
| AC1: XP Progress Bar | ✅ COMPLETE | GET /api/horses/:id/xp provides all needed data |
| AC2: Stat History Graph | ⚠️ PARTIAL | XP history exists, stat history needs creation or exposure |
| AC3: Age-Up Prediction | ❌ MISSING | Need to create endpoint with age calculation logic |
| AC4: Training Recommendations | ❌ MISSING | Need to create endpoint with recommendation logic |

## Next Steps for Task 0

1. ✅ **COMPLETE:** Investigate backend API endpoints
2. ✅ **COMPLETE:** Document available vs needed endpoints
3. **TODO:** Verify XP history event structure includes stat allocations
4. **TODO:** Make charting library decision (Chart.js recommended)
5. **TODO:** Create backend task for missing endpoints (if needed) OR
6. **TODO:** Decide to implement frontend with mock data first

## Recommendation

**Option A: Frontend-First Approach**
- Implement frontend components with mock data
- Complete all 4 acceptance criteria with realistic mocks
- Request backend team to create missing endpoints in parallel
- Integrate real API once endpoints are ready

**Pros:**
- Unblocked - can continue Story 3-4 immediately
- Clear API contract defined for backend team
- Components can be tested independently
- Faster initial delivery

**Cons:**
- Need to update components when real API is ready
- Mock data may not match real data structure exactly

**Option B: Backend-First Approach**
- Create missing backend endpoints first
- Then implement frontend components with real data
- No mocks needed

**Pros:**
- No rework needed
- Real data from start
- More accurate development

**Cons:**
- Blocked on backend development (estimated 8-12 hours)
- Story 3-4 timeline extended significantly

**RECOMMENDED:** Option A (Frontend-First) - Story can complete in 19-27 hours as planned, backend endpoints can be added in Epic 4 or maintenance sprint.

## Charting Library Selection

**Chart.js** (RECOMMENDED)
- Bundle size: ~50KB gzipped
- Well-documented React wrapper: react-chartjs-2
- Good performance for typical data volumes
- Simple API for line charts
- Widely used, stable

**Installation:**
```bash
npm install chart.js react-chartjs-2
```

**Example Usage:**
```typescript
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);

<Line data={data} options={options} />
```

## Updated Data Structures

Based on actual backend response structures:

### HorseXP (from GET /api/horses/:id/xp)
```typescript
interface HorseXP {
  horseId: number;
  horseName: string;
  currentXP: number;
  availableStatPoints: number;
  nextStatPointAt: number;      // XP value for next stat point (100, 200, 300, etc.)
  xpToNextStatPoint: number;    // Remaining XP needed

  // Calculated on frontend:
  currentLevel: number;          // Math.floor(currentXP / 100)
  xpToNextLevel: number;         // Same as xpToNextStatPoint
  totalXP: number;               // Same as currentXP
  xpSources?: {                  // From xp-history if available
    training: number;
    competitions: number;
    breeding: number;
    other: number;
  };
}
```

### XPHistoryEvent (from GET /api/horses/:id/xp-history)
```typescript
interface XPHistoryEvent {
  id: number;
  horseId: number;
  amount: number;
  reason: string;
  timestamp: string;
  // Possibly more fields - need to check horseXpModel.mjs
}
```

## Files to Investigate Next

1. `backend/models/horseXpModel.mjs` - Verify XP event structure
2. `backend/controllers/horseController.mjs` - Check getHorseOverview response
3. `backend/schema.prisma` - Verify database tables and relationships
4. `backend/routes/trainingRoutes.mjs` - Check if stat history is tracked

## Task 0 Status

- [x] Create story file with analysis and plan
- [x] Investigate backend API for progression endpoints
- [x] Document data structures for XP/stats
- [x] Document available vs needed endpoints
- [ ] Make charting library decision → **RECOMMENDATION: Chart.js**
- [ ] Verify XP history includes stat allocations
- [ ] Decide on implementation approach → **RECOMMENDATION: Frontend-First**

**Estimated Remaining:** 30 minutes (verify XP event structure, finalize decisions, update story file)
