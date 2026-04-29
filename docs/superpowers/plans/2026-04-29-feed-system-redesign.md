# Feed System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current per-horse feed-purchase model with an inventory-backed manual daily-feeding loop, dual-source derived health (vet + feed), critical-health gates on breeding and competition, and a delayed-pregnancy mechanic with feed-driven epigenetic outcomes.

**Architecture:** Two phases. Phase A ships the full feed loop, Equip page, and health gates independently — no dependency on pregnancy mechanics. Phase B refactors `createFoal` from instant foal creation to a 7-day delayed foaling job, integrates the per-feeding pregnancy counter, and applies the weighted-bonus formula at birth.

**Tech Stack:** Node.js + Express (ESM `.mjs`), Prisma + PostgreSQL, React 19 + Vite, Tailwind, React Query, Jest (backend integration with real DB), Vitest (frontend unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md` (commits `533d42da` + `086569df`).

---

## File Structure

### Backend — new files

| Path                                                             | Responsibility                                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/utils/horseHealth.mjs`                                  | `getVetHealth(horse)`, `getFeedHealth(horse)`, `getDisplayedHealth(horse)`, `worseOf(a, b)`, `startOfUtcDay(d)`, `alreadyFedToday(date)`. Pure functions, no DB.                                    |
| `backend/__tests__/utils/horseHealth.test.mjs`                   | Unit tests for the above.                                                                                                                                                                           |
| `backend/modules/horses/services/horseFeedService.mjs`           | `feedHorse(userId, horseId, rng)` — transactional. Reads inventory + horse, validates, decrements unit, sets lastFedDate, rolls stat boost, increments pregnancy counter (Phase B), returns result. |
| `backend/__tests__/integration/feedHorseService.test.mjs`        | Real-DB integration tests for feedHorseService.                                                                                                                                                     |
| `backend/modules/horses/controllers/horseFeedController.mjs`     | HTTP handlers: `feedHorseHandler`, `equipFeedHandler`, `unequipFeedHandler`, `getEquippableHandler`. Thin layer over service.                                                                       |
| `backend/__tests__/integration/feedHorseEndpoint.test.mjs`       | HTTP integration: ownership, errors, success shapes.                                                                                                                                                |
| `backend/__tests__/integration/equipFeedEndpoint.test.mjs`       | HTTP integration: equip/unequip happy paths + 400s.                                                                                                                                                 |
| `backend/__tests__/integration/equippableEndpoint.test.mjs`      | HTTP integration: tack filter + feed list.                                                                                                                                                          |
| `backend/__tests__/integration/feedShopBulkPurchase.test.mjs`    | HTTP integration: bulk purchase, balance check, accumulation.                                                                                                                                       |
| `backend/__tests__/integration/competitionCriticalGate.test.mjs` | HTTP integration: critical horse blocked from `enterConformationShow`.                                                                                                                              |
| `frontend/src/pages/horses/HorseEquipPage.tsx`                   | New page at `/horses/:id/equip`. Tack filtering + feed picker.                                                                                                                                      |
| `frontend/src/components/horse/HealthBadge.tsx`                  | Color-coded badge with pulse animation for critical.                                                                                                                                                |
| `frontend/src/components/horse/PregnancyFeedingPanel.tsx`        | Phase B. Shows in-foal mare feed history + projected chances.                                                                                                                                       |
| `frontend/src/hooks/api/useFeedHorse.ts`                         | React Query mutation.                                                                                                                                                                               |
| `frontend/src/hooks/api/useEquipFeed.ts`                         | React Query mutations (equip + unequip).                                                                                                                                                            |
| `frontend/src/hooks/api/useEquippable.ts`                        | React Query query.                                                                                                                                                                                  |
| `tests/e2e/feed-system.spec.ts`                                  | Playwright E2E for full feed loop.                                                                                                                                                                  |
| `tests/e2e/feed-critical-gate.spec.ts`                           | Playwright E2E for breeding/competition gate.                                                                                                                                                       |

### Backend — modified files

| Path                                                                        | Change                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                                    | Drop `coordination`, `currentFeed`, `energyLevel` from `Horse`. Add `equippedFeedType`, `inFoalSinceDate` (Phase B), `pregnancySireId` (Phase B), `pregnancyFeedingsByTier` (Phase B). |
| `packages/database/prisma/migrations/<ts>_feed_phase_a/migration.sql`       | New Phase A migration.                                                                                                                                                                 |
| `packages/database/prisma/migrations/<ts>_feed_phase_b/migration.sql`       | New Phase B migration.                                                                                                                                                                 |
| `backend/modules/services/controllers/feedShopController.mjs`               | Replace `FEED_CATALOG` with 5-tier. Replace per-horse `purchaseFeed` with bulk `purchasePack`.                                                                                         |
| `backend/modules/horses/routes/horseRoutes.mjs`                             | Wire `POST /:id/feed`, `POST /:id/equip-feed`, `POST /:id/unequip-feed`, `GET /:id/equippable`.                                                                                        |
| `backend/modules/competition/controllers/conformationShowController.mjs:36` | Add `getDisplayedHealth(horse) === 'critical'` pre-flight in `enterConformationShow`.                                                                                                  |
| `backend/modules/horses/controllers/horseController.mjs:234`                | Phase B: refactor `createFoal` to set `inFoalSinceDate` instead of creating foal directly.                                                                                             |
| Horse-read serializer(s)                                                    | Inject `feedHealth`, `vetHealth`, `displayedHealth` into JSON. Locate during Task A10.                                                                                                 |

### Frontend — modified files

| Path                                     | Change                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/lib/nav-items.tsx`         | Add Inventory link, remove Training link.                                                                            |
| `frontend/src/lib/api-client.ts`         | Add `feedHorse`, `equipFeed`, `unequipFeed`, `getEquippable`. Refactor `purchaseFeed` signature.                     |
| `frontend/src/hooks/api/useFeedShop.ts`  | Refactor `usePurchaseFeed` to bulk shape. Remove per-horse purchase logic.                                           |
| `frontend/src/pages/FeedShopPage.tsx`    | Strip `HorsesNutritionTab`. Single-screen 5-card bulk purchase UI.                                                   |
| `frontend/src/pages/HorseDetailPage.tsx` | Feed button → `useFeedHorse` mutation. Equip Tack → rename + reroute to `/horses/:id/equip`. Health badge in header. |
| `frontend/src/pages/InventoryPage.tsx`   | Add `Feed` category tab.                                                                                             |
| `frontend/src/App.tsx`                   | Register `/horses/:id/equip` route.                                                                                  |

---

## Phase A — Core Feed System (ships independently)

### Task A1: Phase A schema migration

**Files:**

- Modify: `packages/database/prisma/schema.prisma:103-228` (Horse model)
- Create: `packages/database/prisma/migrations/<timestamp>_feed_phase_a/migration.sql`

- [ ] **Step A1.1: Pre-flight grep audit for `coordination`**

```bash
grep -rn "coordination" backend frontend --include="*.mjs" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=__tests__/legacy
```

Record every hit. These will need cleanup in subsequent tasks. Paste the list into your scratch notes.

- [ ] **Step A1.2: Edit `schema.prisma` Horse model**

In `packages/database/prisma/schema.prisma`, in the `model Horse {` block (line 103):

Remove these three lines:

```prisma
  /// Feed Shop fields
  currentFeed             String?               @default("basic")
  energyLevel             Int?                  @default(100)
```

Keep `lastFedDate` (the line between them).

Remove this line (in the "Additional competition stats" block, line 140):

```prisma
  coordination            Int?                  @default(0)
```

Add this line in the "Feed Shop fields" section (where `currentFeed` was):

```prisma
  /// Feed Shop fields (redesign 2026-04-29)
  equippedFeedType        String?
  lastFedDate             DateTime?
```

- [ ] **Step A1.3: Create the migration**

Run:

```bash
cd packages/database
npx prisma migrate dev --name feed_phase_a --create-only
```

This creates `packages/database/prisma/migrations/<timestamp>_feed_phase_a/migration.sql`. Open it and verify it contains (in order):

```sql
ALTER TABLE "horses" DROP COLUMN "currentFeed";
ALTER TABLE "horses" DROP COLUMN "energyLevel";
ALTER TABLE "horses" DROP COLUMN "coordination";
ALTER TABLE "horses" ADD COLUMN "equippedFeedType" TEXT;
```

If extra lines appear (e.g., index changes), confirm they match the schema and aren't unintended.

- [ ] **Step A1.4: Apply the migration**

```bash
cd packages/database
npx prisma migrate dev
```

Expected: migration runs cleanly. If existing data has `coordination` references, the column drop will succeed but downstream code (cleaned up later in this plan) will be broken until those tasks land.

- [ ] **Step A1.5: Regenerate Prisma client**

```bash
cd packages/database
npx prisma generate
```

- [ ] **Step A1.6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(schema): Phase A — drop coordination, currentFeed, energyLevel; add equippedFeedType (feed-system redesign)"
```

---

### Task A2: `coordination` cleanup

**Files:** every file from the A1.1 grep audit. Common candidates (not exhaustive):

- `backend/utils/breedStatRanges.mjs`
- `backend/modules/horses/services/breedStarterStatsService.mjs`
- `backend/seed/`
- Test fixtures in `backend/__tests__/`
- Frontend stat displays in `frontend/src/pages/HorseDetailPage.tsx` (stats panel)
- Type definitions in `frontend/src/lib/api-client.ts`

- [ ] **Step A2.1: Remove every read/write of `coordination` in production code**

For each hit from A1.1, delete or rewrite the line so no code references the column. If a default-value seed (e.g., `coordination: 0`) appears in a horse-create payload, just delete that key.

- [ ] **Step A2.2: Remove from frontend type definitions**

In `frontend/src/lib/api-client.ts`, find any `Horse` or `HorseSummary` type that includes `coordination: number`. Remove the line.

- [ ] **Step A2.3: Update test fixtures**

Find test fixtures that build a horse object literal with `coordination`. Remove the key. Run the affected test files individually to confirm they still build a valid horse.

- [ ] **Step A2.4: Confirm grep is clean**

Run again:

```bash
grep -rn "coordination" backend frontend --include="*.mjs" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=__tests__/legacy
```

Expected: zero hits, OR only legacy/historical doc hits (e.g., `docs/`, archived tests).

- [ ] **Step A2.5: Run backend test suite to catch any missed reads**

```bash
cd backend && npm test -- --silent 2>&1 | tail -30
```

Expected: any new failures are in test files referencing `coordination`. Update those.

- [ ] **Step A2.6: Commit**

```bash
git add -A
git commit -m "chore(horses): remove coordination column references (recon Finding 1 → B)"
```

---

### Task A3: `feedHealth` helper — TDD

**Files:**

- Create: `backend/utils/horseHealth.mjs`
- Create: `backend/__tests__/utils/horseHealth.test.mjs`

- [ ] **Step A3.1: Write the failing test**

Create `backend/__tests__/utils/horseHealth.test.mjs`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { getFeedHealth, startOfUtcDay, alreadyFedToday } from '../../utils/horseHealth.mjs';

describe('getFeedHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns retired for age >= 21', () => {
    expect(getFeedHealth({ age: 21, lastFedDate: NOW }, NOW)).toBe('retired');
    expect(getFeedHealth({ age: 25, lastFedDate: NOW }, NOW)).toBe('retired');
  });

  it('returns critical when lastFedDate is null', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: null }, NOW)).toBe('critical');
    expect(getFeedHealth({ age: 5 }, NOW)).toBe('critical');
  });

  it('returns excellent for 0-2 day gap (UTC calendar)', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-29T00:00:00Z') }, NOW)).toBe(
      'excellent'
    );
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-28T00:00:00Z') }, NOW)).toBe(
      'excellent'
    );
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-27T00:00:00Z') }, NOW)).toBe(
      'excellent'
    );
  });

  it('returns good for 3-4 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-26T00:00:00Z') }, NOW)).toBe(
      'good'
    );
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-25T00:00:00Z') }, NOW)).toBe(
      'good'
    );
  });

  it('returns fair for 5-6 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-24T00:00:00Z') }, NOW)).toBe(
      'fair'
    );
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-23T00:00:00Z') }, NOW)).toBe(
      'fair'
    );
  });

  it('returns poor for 7-8 day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-22T00:00:00Z') }, NOW)).toBe(
      'poor'
    );
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-21T00:00:00Z') }, NOW)).toBe(
      'poor'
    );
  });

  it('returns critical for 9+ day gap', () => {
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-20T00:00:00Z') }, NOW)).toBe(
      'critical'
    );
    expect(getFeedHealth({ age: 5, lastFedDate: new Date('2026-04-01T00:00:00Z') }, NOW)).toBe(
      'critical'
    );
  });
});

describe('startOfUtcDay', () => {
  it('truncates to UTC midnight', () => {
    expect(startOfUtcDay(new Date('2026-04-29T15:30:45.999Z')).toISOString()).toBe(
      '2026-04-29T00:00:00.000Z'
    );
  });
});

describe('alreadyFedToday', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns false when lastFedDate is null', () => {
    expect(alreadyFedToday(null, NOW)).toBe(false);
  });

  it('returns true when fed earlier today UTC', () => {
    expect(alreadyFedToday(new Date('2026-04-29T01:00:00Z'), NOW)).toBe(true);
    expect(alreadyFedToday(new Date('2026-04-29T23:59:59Z'), NOW)).toBe(true);
  });

  it('returns false when fed yesterday UTC', () => {
    expect(alreadyFedToday(new Date('2026-04-28T23:59:59Z'), NOW)).toBe(false);
  });
});
```

- [ ] **Step A3.2: Run test, verify RED**

```bash
cd backend && npm test -- --testPathPattern="utils/horseHealth" --no-coverage 2>&1 | tail -20
```

Expected: `Cannot find module '../../utils/horseHealth.mjs'` — the file doesn't exist yet.

- [ ] **Step A3.3: Implement `horseHealth.mjs`**

Create `backend/utils/horseHealth.mjs`:

```javascript
/**
 * Horse health helpers (feed-system redesign 2026-04-29).
 *
 * Two derived health concepts (recon Finding 2 → α):
 *   - feedHealth: from `lastFedDate`, daily decay.
 *   - vetHealth:  from `lastVettedDate` (weekly decay), overridden by
 *     `healthStatus` when non-null (vet-finding outcome).
 *   - displayedHealth: worseOf(feedHealth, vetHealth). What the gates and UI use.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Truncate to UTC midnight.
 */
export function startOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Has the horse been fed in the same UTC calendar day as `now`?
 */
export function alreadyFedToday(lastFedDate, now = new Date()) {
  if (!lastFedDate) return false;
  return startOfUtcDay(lastFedDate).getTime() === startOfUtcDay(now).getTime();
}

/**
 * Feed-health band derived from horse.lastFedDate.
 * Bands: ≤2 days excellent, 3-4 good, 5-6 fair, 7-8 poor, 9+ critical.
 * Special: age >= 21 returns 'retired'; null lastFedDate returns 'critical'.
 */
export function getFeedHealth(horse, now = new Date()) {
  if (horse.age != null && horse.age >= 21) return 'retired';
  if (!horse.lastFedDate) return 'critical';

  const days = Math.floor(
    (startOfUtcDay(now).getTime() - startOfUtcDay(horse.lastFedDate).getTime()) / MS_PER_DAY
  );
  if (days <= 2) return 'excellent';
  if (days <= 4) return 'good';
  if (days <= 6) return 'fair';
  if (days <= 8) return 'poor';
  return 'critical';
}
```

- [ ] **Step A3.4: Run test, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="utils/horseHealth" --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step A3.5: Commit**

```bash
git add backend/utils/horseHealth.mjs backend/__tests__/utils/horseHealth.test.mjs
git commit -m "feat(horses): add getFeedHealth helper with UTC calendar bands"
```

---

### Task A4: `vetHealth` and `displayedHealth` — TDD

**Files:**

- Modify: `backend/utils/horseHealth.mjs`
- Modify: `backend/__tests__/utils/horseHealth.test.mjs`

- [ ] **Step A4.1: Add failing tests**

Append to `backend/__tests__/utils/horseHealth.test.mjs`:

```javascript
import { getVetHealth, getDisplayedHealth, worseOf } from '../../utils/horseHealth.mjs';

describe('getVetHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns retired for age >= 21', () => {
    expect(getVetHealth({ age: 21, lastVettedDate: NOW }, NOW)).toBe('retired');
  });

  it('returns critical when lastVettedDate is null and no override', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: null }, NOW)).toBe('critical');
  });

  it('returns healthStatus override when non-null', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: NOW, healthStatus: 'critical' }, NOW)).toBe(
      'critical'
    );
    expect(
      getVetHealth(
        { age: 5, lastVettedDate: new Date('2026-01-01T00:00:00Z'), healthStatus: 'excellent' },
        NOW
      )
    ).toBe('excellent');
  });

  it('returns excellent for ≤7 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-22T00:00:00Z') }, NOW)).toBe(
      'excellent'
    );
  });

  it('returns good for 8-14 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-21T00:00:00Z') }, NOW)).toBe(
      'good'
    );
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-15T00:00:00Z') }, NOW)).toBe(
      'good'
    );
  });

  it('returns fair for 15-21 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-14T00:00:00Z') }, NOW)).toBe(
      'fair'
    );
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-08T00:00:00Z') }, NOW)).toBe(
      'fair'
    );
  });

  it('returns poor for 22-28 day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-07T00:00:00Z') }, NOW)).toBe(
      'poor'
    );
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-04-01T00:00:00Z') }, NOW)).toBe(
      'poor'
    );
  });

  it('returns critical for 29+ day gap', () => {
    expect(getVetHealth({ age: 5, lastVettedDate: new Date('2026-03-31T00:00:00Z') }, NOW)).toBe(
      'critical'
    );
  });
});

describe('worseOf', () => {
  it('picks the worse band', () => {
    expect(worseOf('excellent', 'good')).toBe('good');
    expect(worseOf('good', 'excellent')).toBe('good');
    expect(worseOf('fair', 'critical')).toBe('critical');
    expect(worseOf('excellent', 'excellent')).toBe('excellent');
  });

  it('retired overrides everything', () => {
    expect(worseOf('retired', 'critical')).toBe('retired');
    expect(worseOf('critical', 'retired')).toBe('retired');
  });
});

describe('getDisplayedHealth', () => {
  const NOW = new Date('2026-04-29T15:30:00Z');

  it('returns the worse of feed and vet', () => {
    const horse = {
      age: 5,
      lastFedDate: new Date('2026-04-28T00:00:00Z'), // excellent feed
      lastVettedDate: new Date('2026-04-08T00:00:00Z'), // fair vet (21 days)
    };
    expect(getDisplayedHealth(horse, NOW)).toBe('fair');
  });

  it('returns critical when feed is critical', () => {
    const horse = {
      age: 5,
      lastFedDate: new Date('2026-04-15T00:00:00Z'), // critical feed (14 days)
      lastVettedDate: NOW, // excellent vet
    };
    expect(getDisplayedHealth(horse, NOW)).toBe('critical');
  });

  it('returns retired for age >= 21 even if vet/feed are critical', () => {
    expect(getDisplayedHealth({ age: 22 }, NOW)).toBe('retired');
  });
});
```

- [ ] **Step A4.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="utils/horseHealth" --no-coverage 2>&1 | tail -15
```

Expected: tests fail with "getVetHealth is not a function" (or similar).

- [ ] **Step A4.3: Implement vetHealth, worseOf, getDisplayedHealth**

Append to `backend/utils/horseHealth.mjs`:

```javascript
const BAND_ORDER = ['excellent', 'good', 'fair', 'poor', 'critical'];

/**
 * Return the worse (closer to 'critical') of two bands.
 * 'retired' is special — if either is 'retired', the result is 'retired'
 * (retirement is a terminal state, not a degradation).
 */
export function worseOf(a, b) {
  if (a === 'retired' || b === 'retired') return 'retired';
  const ai = BAND_ORDER.indexOf(a);
  const bi = BAND_ORDER.indexOf(b);
  return BAND_ORDER[Math.max(ai, bi)];
}

/**
 * Vet-health band:
 *   - age >= 21 → 'retired'
 *   - healthStatus non-null → that value (vet-finding override)
 *   - lastVettedDate null → 'critical'
 *   - otherwise weekly decay from lastVettedDate.
 *
 * Bands: ≤7 excellent, 8-14 good, 15-21 fair, 22-28 poor, 29+ critical.
 */
export function getVetHealth(horse, now = new Date()) {
  if (horse.age != null && horse.age >= 21) return 'retired';
  if (horse.healthStatus != null) return horse.healthStatus;
  if (!horse.lastVettedDate) return 'critical';

  const days = Math.floor(
    (startOfUtcDay(now).getTime() - startOfUtcDay(horse.lastVettedDate).getTime()) / MS_PER_DAY
  );
  if (days <= 7) return 'excellent';
  if (days <= 14) return 'good';
  if (days <= 21) return 'fair';
  if (days <= 28) return 'poor';
  return 'critical';
}

/**
 * Final displayed health — worse of feed and vet.
 * This is what gates check and what the UI shows.
 */
export function getDisplayedHealth(horse, now = new Date()) {
  return worseOf(getFeedHealth(horse, now), getVetHealth(horse, now));
}
```

- [ ] **Step A4.4: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="utils/horseHealth" --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step A4.5: Commit**

```bash
git add backend/utils/horseHealth.mjs backend/__tests__/utils/horseHealth.test.mjs
git commit -m "feat(horses): add getVetHealth + getDisplayedHealth (recon Finding 2 → α)"
```

---

### Task A5: Replace FEED_CATALOG constant

**Files:**

- Modify: `backend/modules/services/controllers/feedShopController.mjs:17-58`

- [ ] **Step A5.1: Replace `FEED_CATALOG`**

In `backend/modules/services/controllers/feedShopController.mjs`, replace the entire `FEED_CATALOG` constant (lines 17-58) with:

```javascript
// 5-tier feed catalog (feed-system redesign 2026-04-29).
// All packs sold in 100-unit increments only.
export const FEED_CATALOG = [
  {
    id: 'basic',
    name: 'Basic Feed',
    description: 'Standard hay-and-grain mix. Prevents the no-feed penalty. No bonus.',
    packPrice: 100,
    perUnit: 1.0,
    statRollPct: 0,
    pregnancyBonusPct: 0,
  },
  {
    id: 'performance',
    name: 'Performance Feed',
    description:
      'Active-rider blend with electrolytes. 10% chance per feeding to boost a random stat by 1.',
    packPrice: 125,
    perUnit: 1.25,
    statRollPct: 10,
    pregnancyBonusPct: 5,
  },
  {
    id: 'performancePlus',
    name: 'Performance Plus Feed',
    description: 'Enriched protein blend. 15% chance per feeding to boost a random stat by 1.',
    packPrice: 150,
    perUnit: 1.5,
    statRollPct: 15,
    pregnancyBonusPct: 10,
  },
  {
    id: 'highPerformance',
    name: 'High Performance Feed',
    description: 'Competition-grade nutrition. 20% chance per feeding to boost a random stat by 1.',
    packPrice: 175,
    perUnit: 1.75,
    statRollPct: 20,
    pregnancyBonusPct: 15,
  },
  {
    id: 'elite',
    name: 'Elite Feed',
    description: 'Top-tier specialised blend. 25% chance per feeding to boost a random stat by 1.',
    packPrice: 200,
    perUnit: 2.0,
    statRollPct: 25,
    pregnancyBonusPct: 20,
  },
];
```

- [ ] **Step A5.2: Verify the file still parses**

```bash
cd backend && node --check modules/services/controllers/feedShopController.mjs && echo "syntax ok"
```

(The `purchaseFeed` function below still references the OLD shape — that's expected; A6 rewrites it.)

- [ ] **Step A5.3: Commit**

```bash
git add backend/modules/services/controllers/feedShopController.mjs
git commit -m "feat(feed-shop): replace catalog with 5-tier (basic, performance, performancePlus, highPerformance, elite)"
```

---

### Task A6: Bulk purchase endpoint — TDD

**Files:**

- Modify: `backend/modules/services/controllers/feedShopController.mjs`
- Modify: `backend/modules/services/routes/feedShopRoutes.mjs`
- Create: `backend/__tests__/integration/feedShopBulkPurchase.test.mjs`

- [ ] **Step A6.1: Write the failing test**

Create `backend/__tests__/integration/feedShopBulkPurchase.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('POST /api/feed-shop/purchase (bulk pack purchase)', () => {
  let token, userId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `feed-bulk-${Date.now()}@test.com`,
        username: `feedbulk${Date.now()}`,
        password: 'irrelevant-test-hash',
        money: 1000,
        settings: {},
      },
    });
    userId = user.id;
    token = generateAuthToken(user);
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('purchases 1 pack of basic feed: debits 100 coins, adds 100 units to inventory', async () => {
    const res = await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'basic', packs: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.remainingMoney).toBe(900);
    expect(res.body.data.inventoryItem).toMatchObject({
      itemId: 'basic',
      category: 'feed',
      quantity: 100,
    });

    const fresh = await prisma.user.findUnique({ where: { id: userId } });
    expect(fresh.money).toBe(900);
    expect(fresh.settings.inventory).toContainEqual(
      expect.objectContaining({ id: 'feed-basic', quantity: 100 })
    );
  });

  it('purchases 3 packs of elite feed: debits 600 coins, adds 300 units', async () => {
    await prisma.user.update({ where: { id: userId }, data: { money: 1000 } });

    const res = await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'elite', packs: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingMoney).toBe(400);
    expect(res.body.data.inventoryItem.quantity).toBe(300);
  });

  it('accumulates quantity on existing inventory row', async () => {
    await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'basic', packs: 1 });
    const res = await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'basic', packs: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.inventoryItem.quantity).toBe(300);

    const fresh = await prisma.user.findUnique({ where: { id: userId } });
    const basicRow = fresh.settings.inventory.filter((i) => i.id === 'feed-basic');
    expect(basicRow).toHaveLength(1);
    expect(basicRow[0].quantity).toBe(300);
  });

  it('rejects insufficient funds', async () => {
    await prisma.user.update({ where: { id: userId }, data: { money: 50 } });
    const res = await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'basic', packs: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  it('rejects unknown tier', async () => {
    const res = await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'platinum', packs: 1 });
    expect(res.status).toBe(404);
  });

  it('rejects packs < 1', async () => {
    const res = await request(app)
      .post('/api/feed-shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedTier: 'basic', packs: 0 });
    expect(res.status).toBe(400);
  });
});
```

(`backend/__tests__/helpers/authHelper.mjs` should already exist — confirm and adjust import path if needed.)

- [ ] **Step A6.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="feedShopBulkPurchase" --no-coverage 2>&1 | tail -15
```

Expected: failures because endpoint still uses old per-horse shape.

- [ ] **Step A6.3: Replace the `purchaseFeed` controller**

In `backend/modules/services/controllers/feedShopController.mjs`, replace the existing `purchaseFeed` function (currently lines 75-162) with:

```javascript
/**
 * POST /api/feed-shop/purchase
 * Body: { feedTier, packs }
 *
 * Bulk pack purchase. Each pack = 100 units. No per-horse application.
 * Inventory is pooled in User.settings.inventory.
 */
export async function purchaseFeed(req, res) {
  try {
    const userId = req.user.id;
    const { feedTier, packs } = req.body;

    const tier = FEED_CATALOG.find((f) => f.id === feedTier);
    if (!tier) {
      return res
        .status(404)
        .json({ success: false, message: 'Feed tier not found in catalog', data: null });
    }

    if (!Number.isInteger(packs) || packs < 1) {
      return res
        .status(400)
        .json({ success: false, message: 'packs must be an integer ≥ 1', data: null });
    }

    const totalCost = tier.packPrice * packs;
    const totalUnits = 100 * packs;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { money: true, settings: true },
      });
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }
      if (user.money < totalCost) {
        const err = new Error(
          `Insufficient funds. ${packs} pack(s) of ${tier.name} cost ${totalCost} coins.`
        );
        err.status = 400;
        throw err;
      }

      const settings = user.settings && typeof user.settings === 'object' ? user.settings : {};
      const inventory = Array.isArray(settings.inventory) ? [...settings.inventory] : [];
      const existingIdx = inventory.findIndex((item) => item.id === `feed-${tier.id}`);

      let inventoryItem;
      if (existingIdx >= 0) {
        inventoryItem = {
          ...inventory[existingIdx],
          quantity: inventory[existingIdx].quantity + totalUnits,
        };
        inventory[existingIdx] = inventoryItem;
      } else {
        inventoryItem = {
          id: `feed-${tier.id}`,
          itemId: tier.id,
          category: 'feed',
          name: tier.name,
          quantity: totalUnits,
        };
        inventory.push(inventoryItem);
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          money: { decrement: totalCost },
          settings: { ...settings, inventory },
        },
        select: { money: true },
      });

      await recordTransaction(
        {
          userId,
          type: 'debit',
          amount: totalCost,
          category: 'feed_purchase',
          description: `${packs} pack(s) of ${tier.name}`,
          balanceAfter: updated.money,
          metadata: { feedTier: tier.id, packs, totalUnits },
        },
        tx
      );

      return { remainingMoney: updated.money, inventoryItem };
    });

    res.status(200).json({
      success: true,
      message: `Purchased ${totalUnits} units of ${tier.name}.`,
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[feedShopController] purchaseFeed error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase feed', data: null });
  }
}
```

- [ ] **Step A6.4: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="feedShopBulkPurchase" --no-coverage 2>&1 | tail -15
```

Expected: all 6 tests pass.

- [ ] **Step A6.5: Commit**

```bash
git add backend/modules/services/controllers/feedShopController.mjs backend/__tests__/integration/feedShopBulkPurchase.test.mjs
git commit -m "feat(feed-shop): bulk pack purchase API (replaces per-horse purchase)"
```

---

### Task A7: `equip-feed` and `unequip-feed` endpoints — TDD

**Files:**

- Create: `backend/modules/horses/controllers/horseFeedController.mjs`
- Modify: `backend/modules/horses/routes/horseRoutes.mjs`
- Create: `backend/__tests__/integration/equipFeedEndpoint.test.mjs`

- [ ] **Step A7.1: Write failing test**

Create `backend/__tests__/integration/equipFeedEndpoint.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('Equip / Unequip feed endpoints', () => {
  let token, userId, horseId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `equip-feed-${Date.now()}@test.com`,
        username: `eqfeed${Date.now()}`,
        password: 'hash',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 50,
            },
          ],
        },
      },
    });
    userId = user.id;
    token = generateAuthToken(user);
    const horse = await prisma.horse.create({
      data: {
        name: `EqHorse${Date.now()}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('equip-feed sets equippedFeedType', async () => {
    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ feedType: 'elite' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBe('elite');
  });

  it('equip-feed rejects when user has 0 units of the tier', async () => {
    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ feedType: 'basic' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/don't own|out of/i);
  });

  it('unequip-feed clears equippedFeedType', async () => {
    await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ feedType: 'elite' });
    const res = await request(app)
      .post(`/api/horses/${horseId}/unequip-feed`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
  });

  it('rejects equip on horse owned by different user', async () => {
    const other = await prisma.user.create({
      data: {
        email: `other-${Date.now()}@t.com`,
        username: `o${Date.now()}`,
        password: 'h',
        money: 0,
        settings: {},
      },
    });
    const otherToken = generateAuthToken(other);
    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ feedType: 'elite' });
    expect(res.status).toBe(403);
    await prisma.user.delete({ where: { id: other.id } });
  });
});
```

- [ ] **Step A7.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="equipFeedEndpoint" --no-coverage 2>&1 | tail -10
```

Expected: 404 (route doesn't exist).

- [ ] **Step A7.3: Create the controller**

Create `backend/modules/horses/controllers/horseFeedController.mjs`:

```javascript
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { FEED_CATALOG } from '../../services/controllers/feedShopController.mjs';

const VALID_TIERS = new Set(FEED_CATALOG.map((t) => t.id));

function getInventory(settings) {
  if (!settings || typeof settings !== 'object') return [];
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

async function ownerCheck(horseId, userId) {
  const horse = await prisma.horse.findUnique({ where: { id: Number(horseId) } });
  if (!horse) return { error: { status: 404, message: 'Horse not found' } };
  if (horse.userId !== userId)
    return { error: { status: 403, message: 'Not the owner of this horse' } };
  return { horse };
}

export async function equipFeedHandler(req, res) {
  try {
    const userId = req.user.id;
    const { feedType } = req.body;
    if (!VALID_TIERS.has(feedType)) {
      return res.status(400).json({ success: false, message: 'Invalid feed tier', data: null });
    }
    const check = await ownerCheck(req.params.id, userId);
    if (check.error)
      return res
        .status(check.error.status)
        .json({ success: false, message: check.error.message, data: null });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const inventory = getInventory(user.settings);
    const owned = inventory.find((i) => i.id === `feed-${feedType}`);
    if (!owned || owned.quantity < 1) {
      return res
        .status(400)
        .json({ success: false, message: `You don't own any ${feedType} feed.`, data: null });
    }

    await prisma.horse.update({
      where: { id: check.horse.id },
      data: { equippedFeedType: feedType },
    });
    res
      .status(200)
      .json({
        success: true,
        message: `Equipped ${feedType}`,
        data: { horseId: check.horse.id, equippedFeedType: feedType },
      });
  } catch (error) {
    logger.error(`[horseFeedController.equipFeed] ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to equip feed', data: null });
  }
}

export async function unequipFeedHandler(req, res) {
  try {
    const userId = req.user.id;
    const check = await ownerCheck(req.params.id, userId);
    if (check.error)
      return res
        .status(check.error.status)
        .json({ success: false, message: check.error.message, data: null });

    await prisma.horse.update({ where: { id: check.horse.id }, data: { equippedFeedType: null } });
    res
      .status(200)
      .json({
        success: true,
        message: 'Unequipped feed',
        data: { horseId: check.horse.id, equippedFeedType: null },
      });
  } catch (error) {
    logger.error(`[horseFeedController.unequipFeed] ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unequip feed', data: null });
  }
}
```

- [ ] **Step A7.4: Wire routes**

Open `backend/modules/horses/routes/horseRoutes.mjs`. Add at the top with other imports:

```javascript
import { equipFeedHandler, unequipFeedHandler } from '../controllers/horseFeedController.mjs';
```

Add near other authenticated POST routes (you'll see the pattern already in the file):

```javascript
router.post('/:id/equip-feed', authenticateToken, equipFeedHandler);
router.post('/:id/unequip-feed', authenticateToken, unequipFeedHandler);
```

- [ ] **Step A7.5: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="equipFeedEndpoint" --no-coverage 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step A7.6: Commit**

```bash
git add backend/modules/horses/controllers/horseFeedController.mjs backend/modules/horses/routes/horseRoutes.mjs backend/__tests__/integration/equipFeedEndpoint.test.mjs
git commit -m "feat(horses): equip-feed and unequip-feed endpoints"
```

---

### Task A8: `feed` action service + endpoint — TDD

**Files:**

- Create: `backend/modules/horses/services/horseFeedService.mjs`
- Modify: `backend/modules/horses/controllers/horseFeedController.mjs`
- Modify: `backend/modules/horses/routes/horseRoutes.mjs`
- Create: `backend/__tests__/integration/feedHorseEndpoint.test.mjs`

- [ ] **Step A8.1: Write failing test**

Create `backend/__tests__/integration/feedHorseEndpoint.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('POST /api/horses/:id/feed', () => {
  let token, userId, horseId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `feed-${Date.now()}@t.com`,
        username: `feed${Date.now()}`,
        password: 'h',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 5,
            },
          ],
        },
      },
    });
    userId = user.id;
    token = generateAuthToken(user);
    const horse = await prisma.horse.create({
      data: {
        name: `Fed${Date.now()}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        speed: 50,
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('happy path: decrements unit, sets lastFedDate, returns horse', async () => {
    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.data.horse.lastFedDate).toBeTruthy();
    expect(res.body.data.feed.tier).toBe('elite');
    expect(res.body.data.remainingUnits).toBe(4);

    const u = await prisma.user.findUnique({ where: { id: userId } });
    const inv = u.settings.inventory.find((i) => i.id === 'feed-elite');
    expect(inv.quantity).toBe(4);
  });

  it('rejects when no feed equipped', async () => {
    await prisma.horse.update({ where: { id: horseId }, data: { equippedFeedType: null } });
    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no feed currently selected/i);
  });

  it('rejects when out of feed (auto-clears equippedFeedType)', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 0,
            },
          ],
        },
      },
    });
    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/out of/i);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
  });

  it('rejects already-fed-today', async () => {
    await prisma.horse.update({ where: { id: horseId }, data: { lastFedDate: new Date() } });
    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already fed today/i);
  });

  it('retired horse (age >= 21): no-op success, no decrement', async () => {
    await prisma.horse.update({ where: { id: horseId }, data: { age: 22 } });
    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.data.skipped).toBe('retired');

    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u.settings.inventory.find((i) => i.id === 'feed-elite').quantity).toBe(5);
  });
});

describe('Stat-boost roll determinism (POST /api/horses/:id/feed)', () => {
  // The service accepts an optional rng for testability. The controller
  // uses Math.random; to test boost outcomes deterministically we exercise
  // the service directly in service-level tests (Task A9), not via HTTP.
  it.todo('moved to feedHorseService.test.mjs');
});
```

- [ ] **Step A8.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="feedHorseEndpoint" --no-coverage 2>&1 | tail -10
```

Expected: 404 — endpoint doesn't exist yet.

- [ ] **Step A8.3: Create the service**

Create `backend/modules/horses/services/horseFeedService.mjs`:

```javascript
import prisma from '../../../../packages/database/prismaClient.mjs';
import { FEED_CATALOG } from '../../services/controllers/feedShopController.mjs';
import { alreadyFedToday } from '../../../utils/horseHealth.mjs';

// 12-stat boost pool (recon Finding 1 → B: coordination removed).
// Names match Horse schema fields exactly.
const STATS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

const TIER_BY_ID = Object.fromEntries(FEED_CATALOG.map((t) => [t.id, t]));

function getInventory(settings) {
  if (!settings || typeof settings !== 'object') return [];
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

/**
 * Roll for a stat boost.
 * @param {string} feedTier
 * @param {() => number} rng — random number 0..1, default Math.random.
 * @returns {{ stat: string, amount: number } | null}
 */
export function rollStatBoost(feedTier, rng = Math.random) {
  const tier = TIER_BY_ID[feedTier];
  if (!tier || tier.statRollPct === 0) return null;
  if (rng() * 100 >= tier.statRollPct) return null;
  const stat = STATS[Math.floor(rng() * STATS.length)];
  return { stat, amount: 1 };
}

/**
 * Feed a horse. Transactional. Validates, decrements inventory, sets
 * lastFedDate, rolls stat boost, returns full result envelope.
 *
 * Pre-conditions checked HERE (not in controller) so service is the one
 * source of truth:
 *   - horse exists and belongs to user
 *   - age < 21 (else 'retired' skip)
 *   - equippedFeedType is set
 *   - alreadyFedToday returns false
 *   - inventory has ≥ 1 unit of equipped tier
 *
 * On 0-units-after-decrement: prunes the inventory row AND clears
 * horse.equippedFeedType (mirrors spec §6.2 step 6a).
 */
export async function feedHorse({ userId, horseId, rng = Math.random }) {
  return prisma.$transaction(async (tx) => {
    const horse = await tx.horse.findUnique({ where: { id: Number(horseId) } });
    if (!horse) {
      const e = new Error('Horse not found');
      e.status = 404;
      throw e;
    }
    if (horse.userId !== userId) {
      const e = new Error('Not the owner');
      e.status = 403;
      throw e;
    }
    if (horse.age != null && horse.age >= 21) {
      return { skipped: 'retired', horse };
    }
    if (!horse.equippedFeedType) {
      const e = new Error(
        'No feed currently selected. Please purchase feed from the feed store and equip it to your horse.'
      );
      e.status = 400;
      throw e;
    }
    if (alreadyFedToday(horse.lastFedDate)) {
      const e = new Error('Already fed today. Try again tomorrow.');
      e.status = 400;
      throw e;
    }

    const tier = TIER_BY_ID[horse.equippedFeedType];
    const user = await tx.user.findUnique({ where: { id: userId }, select: { settings: true } });
    const settings = user.settings && typeof user.settings === 'object' ? user.settings : {};
    const inventory = getInventory(settings).map((i) => ({ ...i }));
    const idx = inventory.findIndex((i) => i.id === `feed-${tier.id}`);

    if (idx < 0 || inventory[idx].quantity < 1) {
      // Auto-clear equippedFeedType so UI returns to empty state.
      await tx.horse.update({ where: { id: horse.id }, data: { equippedFeedType: null } });
      const e = new Error(`Out of ${tier.name}. Purchase more from the feed shop.`);
      e.status = 400;
      throw e;
    }

    inventory[idx].quantity -= 1;
    let equippedFeedClearedDueToEmpty = false;
    if (inventory[idx].quantity <= 0) {
      inventory.splice(idx, 1);
      equippedFeedClearedDueToEmpty = true;
    }

    const horseUpdate = {
      lastFedDate: new Date(),
    };
    if (equippedFeedClearedDueToEmpty) horseUpdate.equippedFeedType = null;

    const statBoost = rollStatBoost(tier.id, rng);
    if (statBoost) {
      horseUpdate[statBoost.stat] = { increment: statBoost.amount };
    }

    const updatedHorse = await tx.horse.update({ where: { id: horse.id }, data: horseUpdate });
    await tx.user.update({ where: { id: userId }, data: { settings: { ...settings, inventory } } });

    const remainingUnits = idx >= 0 && !equippedFeedClearedDueToEmpty ? inventory[idx].quantity : 0;

    return {
      horse: updatedHorse,
      feed: { tier: tier.id, name: tier.name },
      remainingUnits,
      statBoost,
      equippedFeedClearedDueToEmpty,
    };
  });
}
```

- [ ] **Step A8.4: Add the controller handler**

Append to `backend/modules/horses/controllers/horseFeedController.mjs`:

```javascript
import { feedHorse } from '../services/horseFeedService.mjs';

export async function feedHorseHandler(req, res) {
  try {
    const result = await feedHorse({ userId: req.user.id, horseId: req.params.id });
    if (result.skipped === 'retired') {
      return res.status(200).json({
        success: true,
        message: `${result.horse.name} is retired and doesn't need to be fed.`,
        data: { skipped: 'retired', horse: result.horse },
      });
    }
    res.status(200).json({
      success: true,
      message: `Fed ${result.horse.name} with ${result.feed.name}.`,
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[horseFeedController.feedHorse] ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to feed horse', data: null });
  }
}
```

(`logger` is imported at the top of the file from Task A7.3.)

- [ ] **Step A8.5: Wire the route**

In `backend/modules/horses/routes/horseRoutes.mjs`, add to the imports from `horseFeedController.mjs`:

```javascript
import {
  equipFeedHandler,
  unequipFeedHandler,
  feedHorseHandler,
} from '../controllers/horseFeedController.mjs';
```

Add the route alongside the other two from A7.4:

```javascript
router.post('/:id/feed', authenticateToken, feedHorseHandler);
```

- [ ] **Step A8.6: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="feedHorseEndpoint" --no-coverage 2>&1 | tail -15
```

Expected: 5 tests pass (the `it.todo` doesn't fail).

- [ ] **Step A8.7: Commit**

```bash
git add backend/modules/horses/services/horseFeedService.mjs backend/modules/horses/controllers/horseFeedController.mjs backend/modules/horses/routes/horseRoutes.mjs backend/__tests__/integration/feedHorseEndpoint.test.mjs
git commit -m "feat(horses): POST /api/horses/:id/feed — daily feed action with stat-boost roll"
```

---

### Task A9: Stat-boost roll determinism — service-level TDD

**Files:**

- Create: `backend/__tests__/integration/feedHorseService.test.mjs`

- [ ] **Step A9.1: Write failing test**

Create `backend/__tests__/integration/feedHorseService.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { feedHorse, rollStatBoost } from '../../modules/horses/services/horseFeedService.mjs';

describe('rollStatBoost (deterministic via injected rng)', () => {
  it('basic tier never rolls', () => {
    expect(rollStatBoost('basic', () => 0)).toBeNull();
    expect(rollStatBoost('basic', () => 0.99)).toBeNull();
  });

  it('elite tier rolls when rng produces value < 0.25', () => {
    const result = rollStatBoost('elite', () => 0.1);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(1);
    expect(typeof result.stat).toBe('string');
  });

  it('elite tier does NOT roll when rng produces value >= 0.25', () => {
    expect(rollStatBoost('elite', () => 0.3)).toBeNull();
  });

  it('does not pick `coordination` (recon Finding 1 → B)', () => {
    // Force the second rng() (stat picker) to extreme values; verify result.stat is never 'coordination'.
    let call = 0;
    const seq = [0.001, 0.999]; // first roll succeeds, second picks last stat
    const rng = () => seq[call++ % seq.length];
    const result = rollStatBoost('elite', rng);
    expect(result.stat).not.toBe('coordination');
  });
});

describe('feedHorse service — stat-boost integration', () => {
  let userId, horseId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `svc-${Date.now()}@t.com`,
        username: `svc${Date.now()}`,
        password: 'h',
        money: 0,
        settings: {
          inventory: [
            { id: 'feed-elite', itemId: 'elite', category: 'feed', name: 'Elite', quantity: 1 },
          ],
        },
      },
    });
    userId = user.id;
    const horse = await prisma.horse.create({
      data: {
        name: `S${Date.now()}`,
        sex: 'gelding',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        speed: 50,
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('applies stat boost to the horse when rng triggers', async () => {
    // Force speed to be picked: rng = [0.01 (roll succeeds), 2/12 (picks index 2 = 'speed')]
    let call = 0;
    const seq = [0.01, 2 / 12];
    const result = await feedHorse({ userId, horseId, rng: () => seq[call++ % seq.length] });

    expect(result.statBoost).toEqual({ stat: 'speed', amount: 1 });
    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.speed).toBe(51);
  });

  it('no stat boost when rng misses', async () => {
    const result = await feedHorse({ userId, horseId, rng: () => 0.99 });
    expect(result.statBoost).toBeNull();
    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.speed).toBe(50);
  });
});
```

- [ ] **Step A9.2: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="feedHorseService" --no-coverage 2>&1 | tail -15
```

Expected: all tests pass on the first run because the service is already implemented (A8.3).

- [ ] **Step A9.3: Commit**

```bash
git add backend/__tests__/integration/feedHorseService.test.mjs
git commit -m "test(horses): deterministic stat-boost roll tests for feedHorse service"
```

---

### Task A10: `equippable` view endpoint — TDD

**Files:**

- Modify: `backend/modules/horses/controllers/horseFeedController.mjs`
- Modify: `backend/modules/horses/routes/horseRoutes.mjs`
- Create: `backend/__tests__/integration/equippableEndpoint.test.mjs`

- [ ] **Step A10.1: Write failing test**

Create `backend/__tests__/integration/equippableEndpoint.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('GET /api/horses/:id/equippable', () => {
  let token, userId, horseAId, horseBId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `eq-${Date.now()}@t.com`,
        username: `eq${Date.now()}`,
        password: 'h',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'tack-saddle-basic',
              itemId: 'saddle-basic',
              category: 'saddle',
              name: 'Basic Saddle',
              quantity: 1,
              equippedToHorseId: null,
            },
            {
              id: 'tack-saddle-pro',
              itemId: 'saddle-pro',
              category: 'saddle',
              name: 'Pro Saddle',
              quantity: 1,
              equippedToHorseId: null,
            }, // will equip to B
            {
              id: 'feed-basic',
              itemId: 'basic',
              category: 'feed',
              name: 'Basic Feed',
              quantity: 100,
            },
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 50,
            },
          ],
        },
      },
    });
    userId = user.id;
    token = generateAuthToken(user);

    const a = await prisma.horse.create({
      data: { name: 'A', sex: 'mare', dateOfBirth: new Date('2020-01-01'), age: 5, userId },
    });
    const b = await prisma.horse.create({
      data: { name: 'B', sex: 'mare', dateOfBirth: new Date('2020-01-01'), age: 5, userId },
    });
    horseAId = a.id;
    horseBId = b.id;

    // Mark Pro Saddle equipped to B (simulate what equip flow does).
    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: {
          inventory: [
            {
              id: 'tack-saddle-basic',
              itemId: 'saddle-basic',
              category: 'saddle',
              name: 'Basic Saddle',
              quantity: 1,
              equippedToHorseId: null,
            },
            {
              id: 'tack-saddle-pro',
              itemId: 'saddle-pro',
              category: 'saddle',
              name: 'Pro Saddle',
              quantity: 1,
              equippedToHorseId: horseBId,
            },
            {
              id: 'feed-basic',
              itemId: 'basic',
              category: 'feed',
              name: 'Basic Feed',
              quantity: 100,
            },
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 50,
            },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    await prisma.horse.deleteMany({ where: { id: { in: [horseAId, horseBId] } } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('returns tack equipped to nobody + tack equipped to this horse; excludes tack equipped to other horses', async () => {
    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const tackIds = res.body.data.tack.map((t) => t.id);
    expect(tackIds).toContain('tack-saddle-basic'); // nobody's
    expect(tackIds).not.toContain('tack-saddle-pro'); // B's
  });

  it('returns ALL feed items regardless of which horse uses them', async () => {
    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Authorization', `Bearer ${token}`);
    const feedIds = res.body.data.feed.map((f) => f.feedType);
    expect(feedIds).toEqual(expect.arrayContaining(['basic', 'elite']));
  });

  it('flags isCurrentlyEquippedToThisHorse on feed', async () => {
    await prisma.horse.update({ where: { id: horseAId }, data: { equippedFeedType: 'elite' } });
    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Authorization', `Bearer ${token}`);
    const elite = res.body.data.feed.find((f) => f.feedType === 'elite');
    expect(elite.isCurrentlyEquippedToThisHorse).toBe(true);
    const basic = res.body.data.feed.find((f) => f.feedType === 'basic');
    expect(basic.isCurrentlyEquippedToThisHorse).toBe(false);
  });
});
```

- [ ] **Step A10.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="equippableEndpoint" --no-coverage 2>&1 | tail -10
```

- [ ] **Step A10.3: Implement the handler**

Append to `backend/modules/horses/controllers/horseFeedController.mjs`:

```javascript
export async function getEquippableHandler(req, res) {
  try {
    const userId = req.user.id;
    const check = await ownerCheck(req.params.id, userId);
    if (check.error)
      return res
        .status(check.error.status)
        .json({ success: false, message: check.error.message, data: null });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const inventory = getInventory(user.settings);

    const tack = inventory
      .filter((i) => i.category !== 'feed')
      .filter((i) => i.equippedToHorseId == null || i.equippedToHorseId === check.horse.id);

    const feed = inventory
      .filter((i) => i.category === 'feed')
      .filter((i) => (i.quantity ?? 0) > 0)
      .map((i) => ({
        feedType: i.itemId,
        name: i.name,
        quantity: i.quantity,
        isCurrentlyEquippedToThisHorse: check.horse.equippedFeedType === i.itemId,
      }));

    res.status(200).json({ success: true, message: 'Equippable items', data: { tack, feed } });
  } catch (error) {
    logger.error(`[horseFeedController.getEquippable] ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load equippable items', data: null });
  }
}
```

- [ ] **Step A10.4: Wire route**

In `backend/modules/horses/routes/horseRoutes.mjs`:

- Update import: `import { equipFeedHandler, unequipFeedHandler, feedHorseHandler, getEquippableHandler } from '../controllers/horseFeedController.mjs';`
- Add: `router.get('/:id/equippable', authenticateToken, getEquippableHandler);`

- [ ] **Step A10.5: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="equippableEndpoint" --no-coverage 2>&1 | tail -10
```

- [ ] **Step A10.6: Commit**

```bash
git add backend/modules/horses/controllers/horseFeedController.mjs backend/modules/horses/routes/horseRoutes.mjs backend/__tests__/integration/equippableEndpoint.test.mjs
git commit -m "feat(horses): GET /api/horses/:id/equippable — combined tack + feed list"
```

---

### Task A11: Inject `feedHealth` / `vetHealth` / `displayedHealth` into horse JSON

**Files:**

- Locate horse-read serializer(s) (start with `backend/models/horseModel.mjs`, also check `backend/modules/horses/controllers/horseController.mjs` for response shaping).
- Modify the chosen serializer(s).

- [ ] **Step A11.1: Locate the read serializer**

```bash
grep -rn "select:\s*{[^}]*name" backend/modules/horses --include="*.mjs" | head -10
grep -rn "select:\s*{[^}]*healthStatus" backend --include="*.mjs" | grep -v __tests__ | head -10
```

The most-used Horse fetch path likely lives in `backend/models/horseModel.mjs` or `backend/modules/horses/controllers/horseController.mjs`. Pick the one that handles `GET /api/horses/:id` and `GET /api/horses` list responses.

- [ ] **Step A11.2: Add the three derived fields to responses**

In each location that returns a horse object to a client, after the DB read:

```javascript
import { getFeedHealth, getVetHealth, getDisplayedHealth } from '../../utils/horseHealth.mjs';
// (Adjust relative path based on file location.)

// after fetching `horse` (or `horses` array):
function withHealth(horse) {
  return {
    ...horse,
    feedHealth: getFeedHealth(horse),
    vetHealth: getVetHealth(horse),
    displayedHealth: getDisplayedHealth(horse),
  };
}

// For single horse: return res.json({ ..., data: withHealth(horse) })
// For list: horses.map(withHealth)
```

- [ ] **Step A11.3: Add an integration test**

Create `backend/__tests__/integration/horseHealthInResponse.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('Horse JSON includes feedHealth / vetHealth / displayedHealth', () => {
  let token, userId, horseId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `h-${Date.now()}@t.com`,
        username: `h${Date.now()}`,
        password: 'p',
        money: 0,
        settings: {},
      },
    });
    userId = user.id;
    token = generateAuthToken(user);
    const horse = await prisma.horse.create({
      data: {
        name: 'HealthTest',
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        lastFedDate: new Date(),
        lastVettedDate: new Date(),
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('GET /api/horses/:id returns the three derived bands', async () => {
    const res = await request(app)
      .get(`/api/horses/${horseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.feedHealth).toBe('excellent');
    expect(res.body.data.vetHealth).toBe('excellent');
    expect(res.body.data.displayedHealth).toBe('excellent');
  });

  it('reflects stale lastFedDate', async () => {
    await prisma.horse.update({
      where: { id: horseId },
      data: { lastFedDate: new Date(Date.now() - 10 * 86400000) },
    });
    const res = await request(app)
      .get(`/api/horses/${horseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.feedHealth).toBe('critical');
    expect(res.body.data.displayedHealth).toBe('critical');
  });
});
```

- [ ] **Step A11.4: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="horseHealthInResponse" --no-coverage 2>&1 | tail -10
```

- [ ] **Step A11.5: Commit**

```bash
git add backend/
git commit -m "feat(horses): inject feedHealth/vetHealth/displayedHealth into horse JSON"
```

---

### Task A12: Critical-health gate on competition entry — TDD

**Files:**

- Modify: `backend/modules/competition/controllers/conformationShowController.mjs:36` (`enterConformationShow`)
- Create: `backend/__tests__/integration/competitionCriticalGate.test.mjs`

- [ ] **Step A12.1: Write failing test**

Create `backend/__tests__/integration/competitionCriticalGate.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('Critical-health gate on conformation show entry', () => {
  let token, userId, horseId, showId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `c-${Date.now()}@t.com`,
        username: `c${Date.now()}`,
        password: 'p',
        money: 1000,
        settings: {},
      },
    });
    userId = user.id;
    token = generateAuthToken(user);

    // Create a horse 10 days un-fed → feedHealth=critical.
    const horse = await prisma.horse.create({
      data: {
        name: 'CritHorse',
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        lastFedDate: new Date(Date.now() - 10 * 86400000),
        lastVettedDate: new Date(),
      },
    });
    horseId = horse.id;

    // Create a show. The exact required Show fields depend on schema —
    // copy from an existing show-fixture helper in the repo.
    const show = await prisma.show.create({
      data: {
        name: `TestShow${Date.now()}`,
        discipline: 'Conformation',
        levelMin: 1,
        levelMax: 10,
        entryFee: 50,
        prize: 500,
        runDate: new Date(Date.now() + 86400000),
      },
    });
    showId = show.id;
  });

  afterEach(async () => {
    await prisma.showEntry.deleteMany({ where: { horseId } }).catch(() => {});
    await prisma.show.delete({ where: { id: showId } }).catch(() => {});
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('rejects entry when displayedHealth is critical', async () => {
    const res = await request(app)
      .post('/api/conformation-shows/enter')
      .set('Authorization', `Bearer ${token}`)
      .send({ showId, horseId });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/critical health|cannot enter/i);
  });

  it('accepts entry when health is good', async () => {
    await prisma.horse.update({ where: { id: horseId }, data: { lastFedDate: new Date() } });
    const res = await request(app)
      .post('/api/conformation-shows/enter')
      .set('Authorization', `Bearer ${token}`)
      .send({ showId, horseId });
    // Don't assert success status — there may be other validation. Just assert the gate didn't fire.
    expect(res.body.message ?? '').not.toMatch(/critical health/i);
  });
});
```

- [ ] **Step A12.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="competitionCriticalGate" --no-coverage 2>&1 | tail -15
```

(If the test fails because `Show` schema is different, adjust the fixture to match. Use an existing test that creates a show as reference.)

- [ ] **Step A12.3: Add the gate**

In `backend/modules/competition/controllers/conformationShowController.mjs`, in `enterConformationShow` (line 36), find the place where the horse object has been fetched. Immediately after fetch, add:

```javascript
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';

// ... inside enterConformationShow, after fetching the horse:
if (getDisplayedHealth(horse) === 'critical') {
  return res.status(400).json({
    success: false,
    message: `${horse.name} is in critical health and cannot enter competitions. Feed and vet to restore health.`,
    data: null,
  });
}
```

- [ ] **Step A12.4: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="competitionCriticalGate" --no-coverage 2>&1 | tail -10
```

- [ ] **Step A12.5: Commit**

```bash
git add backend/modules/competition/controllers/conformationShowController.mjs backend/__tests__/integration/competitionCriticalGate.test.mjs
git commit -m "feat(competition): block critical-health horses from entering shows"
```

---

### Task A13: Frontend nav + API client + hooks

**Files:**

- Modify: `frontend/src/lib/nav-items.tsx`
- Modify: `frontend/src/lib/api-client.ts`
- Modify: `frontend/src/hooks/api/useFeedShop.ts`
- Create: `frontend/src/hooks/api/useFeedHorse.ts`
- Create: `frontend/src/hooks/api/useEquipFeed.ts`
- Create: `frontend/src/hooks/api/useEquippable.ts`

- [ ] **Step A13.1: Update sidebar (`nav-items.tsx`)**

Open `frontend/src/lib/nav-items.tsx`. Find the Training entry — remove the line. Add an Inventory entry near other top-level routes:

```tsx
{ path: '/inventory', label: 'Inventory', icon: Package, sidebar: true },
```

(Match the existing import for `Package` from `lucide-react` if not already imported.)

- [ ] **Step A13.2: Add API methods**

In `frontend/src/lib/api-client.ts`, add to the appropriate object (likely `horsesApi`):

```typescript
export interface FeedHorseResponse {
  horse: HorseSummary;
  feed: { tier: string; name: string };
  remainingUnits: number;
  statBoost: { stat: string; amount: number } | null;
  equippedFeedClearedDueToEmpty: boolean;
  skipped?: 'retired';
}

export interface EquippableResponse {
  tack: InventoryItem[];
  feed: Array<{
    feedType: string;
    name: string;
    quantity: number;
    isCurrentlyEquippedToThisHorse: boolean;
  }>;
}

export const horseFeedApi = {
  feed: (horseId: number): Promise<FeedHorseResponse> =>
    apiPost(`/api/horses/${horseId}/feed`).then((r) => r.data),
  equipFeed: (horseId: number, feedType: string) =>
    apiPost(`/api/horses/${horseId}/equip-feed`, { feedType }).then((r) => r.data),
  unequipFeed: (horseId: number) =>
    apiPost(`/api/horses/${horseId}/unequip-feed`).then((r) => r.data),
  getEquippable: (horseId: number): Promise<EquippableResponse> =>
    apiGet(`/api/horses/${horseId}/equippable`).then((r) => r.data),
};
```

(`apiPost` and `apiGet` are existing helpers — match the pattern of other API calls in the same file.)

Also update the existing `feedShopApi.purchase` to use the new bulk shape:

```typescript
purchase: (feedTier: string, packs: number) =>
  apiPost('/api/feed-shop/purchase', { feedTier, packs }).then(r => r.data),
```

- [ ] **Step A13.3: Refactor `useFeedShop.ts`**

In `frontend/src/hooks/api/useFeedShop.ts`, replace the `usePurchaseFeed` hook signature:

```typescript
export function usePurchaseFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ feedTier, packs }: { feedTier: string; packs: number }) =>
      feedShopApi.purchase(feedTier, packs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'balance'] });
    },
  });
}
```

- [ ] **Step A13.4: Create new hooks**

`frontend/src/hooks/api/useFeedHorse.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horseFeedApi, FeedHorseResponse } from '@/lib/api-client';

export function useFeedHorse(horseId: number) {
  const queryClient = useQueryClient();
  return useMutation<FeedHorseResponse, Error, void>({
    mutationFn: () => horseFeedApi.feed(horseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}
```

`frontend/src/hooks/api/useEquipFeed.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horseFeedApi } from '@/lib/api-client';

export function useEquipFeed(horseId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedType: string) => horseFeedApi.equipFeed(horseId, feedType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}

export function useUnequipFeed(horseId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => horseFeedApi.unequipFeed(horseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}
```

`frontend/src/hooks/api/useEquippable.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { horseFeedApi, EquippableResponse } from '@/lib/api-client';

export function useEquippable(horseId: number) {
  return useQuery<EquippableResponse>({
    queryKey: ['equippable', horseId],
    queryFn: () => horseFeedApi.getEquippable(horseId),
    staleTime: 30_000,
  });
}
```

- [ ] **Step A13.5: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | tail -20
```

Fix any type errors that arise from the API client edits before continuing.

- [ ] **Step A13.6: Commit**

```bash
git add frontend/src/lib/nav-items.tsx frontend/src/lib/api-client.ts frontend/src/hooks/api/
git commit -m "feat(frontend): add Inventory to sidebar; new feed-horse / equip / equippable hooks"
```

---

### Task A14: Rewrite `FeedShopPage`

**Files:**

- Modify: `frontend/src/pages/FeedShopPage.tsx`
- Delete: any sub-components used only by the removed "My Horses" tab.

- [ ] **Step A14.1: Replace the page**

Replace the entire `frontend/src/pages/FeedShopPage.tsx` with a single-screen bulk-purchase UI. Strip the `HorsesNutritionTab` and tab navigation entirely.

```tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useFeedCatalog, usePurchaseFeed, FeedItem } from '@/hooks/api/useFeedShop';

const FeedShopPage: React.FC = () => {
  const { data: catalog, isLoading, isError, error } = useFeedCatalog();
  const purchase = usePurchaseFeed();
  const [packsByTier, setPacksByTier] = useState<Record<string, number>>({});

  const handlePurchase = (tier: FeedItem) => {
    const packs = packsByTier[tier.id] ?? 1;
    purchase.mutate(
      { feedTier: tier.id, packs },
      {
        onSuccess: () => toast.success(`Purchased ${100 * packs} units of ${tier.name}.`),
        onError: (err) => toast.error((err as { message?: string })?.message ?? 'Purchase failed.'),
      }
    );
  };

  return (
    <div>
      <PageHero
        title="Feed Shop"
        subtitle="Buy feed in 100-unit packs. Stocked feed lives in your inventory; equip it to a horse from the horse page."
        mood="nature"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Feed Shop</span>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          </div>
        )}
        {isError && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] text-sm"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{error?.message ?? 'Could not load the feed catalog.'}</span>
          </div>
        )}

        {catalog && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalog.map((tier) => {
              const packs = packsByTier[tier.id] ?? 1;
              const totalCost = (tier.packPrice ?? 0) * packs;
              const totalUnits = 100 * packs;
              return (
                <div
                  key={tier.id}
                  className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5"
                  data-testid={`feed-tier-${tier.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-[var(--cream)]">{tier.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {tier.packPrice} coins / 100-unit pack
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">{tier.description}</p>
                  <div className="text-xs text-[var(--text-muted)] mb-3 space-y-0.5">
                    <div>
                      Stat-boost roll: <strong>{tier.statRollPct}%</strong>
                    </div>
                    <div>
                      Pregnancy bonus: <strong>+{tier.pregnancyBonusPct}%</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setPacksByTier((p) => ({ ...p, [tier.id]: Math.max(1, packs - 1) }))
                      }
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                      aria-label="Decrease packs"
                    >
                      −
                    </button>
                    <span
                      className="px-3 text-sm font-medium text-[var(--cream)]"
                      data-testid={`pack-count-${tier.id}`}
                    >
                      {packs}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPacksByTier((p) => ({ ...p, [tier.id]: packs + 1 }))}
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                      aria-label="Increase packs"
                    >
                      +
                    </button>
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      Total: {totalCost} coins
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePurchase(tier)}
                    disabled={purchase.isPending}
                    className="w-full py-2 rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                    data-testid={`buy-${tier.id}`}
                    data-onboarding-target={
                      tier.id === 'basic' ? 'feed-shop-purchase-button' : undefined
                    }
                  >
                    {purchase.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    ) : (
                      `Buy ${totalUnits} units (${totalCost} coins)`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedShopPage;
```

- [ ] **Step A14.2: Update `FeedItem` type**

In `frontend/src/hooks/api/useFeedShop.ts` (where `FeedItem` is exported), update its shape:

```typescript
export interface FeedItem {
  id: string;
  name: string;
  description: string;
  packPrice: number;
  perUnit: number;
  statRollPct: number;
  pregnancyBonusPct: number;
}
```

- [ ] **Step A14.3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Step A14.4: Manual smoke**

Run dev servers, navigate to `/feed-shop`, verify the 5-tier UI renders, pack-count steppers work.

- [ ] **Step A14.5: Commit**

```bash
git add frontend/src/pages/FeedShopPage.tsx frontend/src/hooks/api/useFeedShop.ts
git commit -m "feat(feed-shop): single-screen bulk-purchase UI (5 tiers, no per-horse tab)"
```

---

### Task A15: New `HorseEquipPage`

**Files:**

- Create: `frontend/src/pages/horses/HorseEquipPage.tsx`
- Modify: `frontend/src/App.tsx` (register route)

- [ ] **Step A15.1: Create the page**

Create `frontend/src/pages/horses/HorseEquipPage.tsx`:

```tsx
import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useEquippable } from '@/hooks/api/useEquippable';
import { useEquipFeed, useUnequipFeed } from '@/hooks/api/useEquipFeed';

const HorseEquipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const horseId = Number(id);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useEquippable(horseId);
  const equipFeed = useEquipFeed(horseId);
  const unequipFeed = useUnequipFeed(horseId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-8" role="alert">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p>Could not load equippable items.</p>
      </div>
    );
  }

  const currentlyEquippedFeed = data.feed.find((f) => f.isCurrentlyEquippedToThisHorse);

  return (
    <div>
      <PageHero title="Equip" subtitle="Tack and feed available for this horse">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-[var(--cream)]/60 hover:text-[var(--cream)]"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </PageHero>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Tack section */}
        <section>
          <h2 className="text-lg font-bold text-[var(--cream)] mb-3">Tack</h2>
          {data.tack.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No tack available. Visit the Tack Shop.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.tack.map((item) => (
                <li
                  key={item.id}
                  className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-4 flex items-center justify-between"
                  data-testid={`tack-item-${item.id}`}
                >
                  <div>
                    <p className="font-bold text-[var(--cream)] text-sm">{item.name}</p>
                    {item.bonus && (
                      <p className="text-xs text-violet-400/80 mt-0.5">{item.bonus}</p>
                    )}
                  </div>
                  {/* Tack equip uses the existing inventory equip flow; that endpoint already exists. */}
                  <Link
                    to="/inventory"
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400/80 hover:bg-violet-600/20"
                  >
                    Equip from Inventory
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Feed section */}
        <section>
          <h2 className="text-lg font-bold text-[var(--cream)] mb-3">Feed</h2>
          {!currentlyEquippedFeed && data.feed.length === 0 && (
            <div
              className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-5 text-center"
              data-testid="no-feed-empty-state"
            >
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                No feed currently selected. Please purchase feed from the feed store and equip it to
                your horse.
              </p>
              <Link
                to="/feed-shop"
                className="inline-block px-4 py-2 rounded-lg bg-[var(--status-success)]/20 border border-[var(--status-success)]/30 text-[var(--status-success)] text-sm font-medium"
              >
                Go to Feed Shop
              </Link>
            </div>
          )}
          {currentlyEquippedFeed && (
            <div
              className="bg-[var(--status-success)]/10 border border-[var(--status-success)]/30 rounded-lg p-4 mb-3 flex items-center justify-between"
              data-testid="equipped-feed-card"
            >
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  Currently equipped
                </p>
                <p className="font-bold text-[var(--cream)]">{currentlyEquippedFeed.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {currentlyEquippedFeed.quantity} units in stock
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  unequipFeed.mutate(undefined, { onSuccess: () => toast.success('Unequipped.') })
                }
                disabled={unequipFeed.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white/90"
              >
                {unequipFeed.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Unequip'}
              </button>
            </div>
          )}
          {data.feed.length > 0 && (
            <ul className="space-y-2">
              {data.feed
                .filter((f) => !f.isCurrentlyEquippedToThisHorse)
                .map((f) => (
                  <li
                    key={f.feedType}
                    className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-4 flex items-center justify-between"
                    data-testid={`feed-item-${f.feedType}`}
                  >
                    <div>
                      <p className="font-bold text-[var(--cream)] text-sm">{f.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {f.quantity} units in stock
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        equipFeed.mutate(f.feedType, {
                          onSuccess: () => toast.success(`Equipped ${f.name}.`),
                        })
                      }
                      disabled={equipFeed.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20"
                    >
                      Equip
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default HorseEquipPage;
```

- [ ] **Step A15.2: Register route in `App.tsx`**

In `frontend/src/App.tsx`, add:

```tsx
import HorseEquipPage from '@/pages/horses/HorseEquipPage';
```

In the route table, add:

```tsx
<Route path="/horses/:id/equip" element={<HorseEquipPage />} />
```

- [ ] **Step A15.3: Type-check + manual smoke**

```bash
cd frontend && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step A15.4: Commit**

```bash
git add frontend/src/pages/horses/HorseEquipPage.tsx frontend/src/App.tsx
git commit -m "feat(horses): new HorseEquipPage at /horses/:id/equip (tack + feed)"
```

---

### Task A16: HorseDetailPage Feed button + Equip button + HealthBadge

**Files:**

- Create: `frontend/src/components/horse/HealthBadge.tsx`
- Modify: `frontend/src/pages/HorseDetailPage.tsx`

- [ ] **Step A16.1: Create HealthBadge component**

Create `frontend/src/components/horse/HealthBadge.tsx`:

```tsx
import React from 'react';

const COLOR_BY_BAND: Record<string, string> = {
  excellent: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
  good: 'bg-green-500/20 border-green-400/40 text-green-300',
  fair: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300',
  poor: 'bg-orange-500/20 border-orange-400/40 text-orange-300',
  critical: 'bg-red-500/20 border-red-400/50 text-red-300 animate-pulse',
  retired: 'bg-purple-500/20 border-purple-400/40 text-purple-300',
};

interface HealthBadgeProps {
  band: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired';
  label?: string;
  showCriticalWarning?: boolean;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({
  band,
  label,
  showCriticalWarning = false,
}) => {
  const cls = COLOR_BY_BAND[band] ?? 'bg-white/10 text-white/60';
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${cls}`}
        data-testid="health-badge"
      >
        {label ?? band}
      </span>
      {showCriticalWarning && band === 'critical' && (
        <span className="text-xs text-red-400" data-testid="critical-warning">
          Cannot breed or compete until fed.
        </span>
      )}
    </div>
  );
};
```

- [ ] **Step A16.2: Modify Feed button in HorseDetailPage**

Open `frontend/src/pages/HorseDetailPage.tsx`. Find the Feed button (the recon located it at ~line 669-683). Replace with:

```tsx
// At top of file, with other imports:
import { useFeedHorse } from '@/hooks/api/useFeedHorse';
import { HealthBadge } from '@/components/horse/HealthBadge';

// In component body, where other hooks are:
const feedHorse = useFeedHorse(horse.id);
const isAlreadyFedToday = horse.lastFedDate
  ? new Date(horse.lastFedDate).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
  : false;
const feedDisabledReason = !horse.equippedFeedType
  ? 'No feed selected. Click Equip first.'
  : isAlreadyFedToday
    ? 'Fed today. Available again at UTC midnight.'
    : horse.feedHealth === 'retired'
      ? 'Retired.'
      : null;

const handleFeed = () => {
  feedHorse.mutate(undefined, {
    onSuccess: (result) => {
      if (result.skipped === 'retired') {
        toast.info(`${horse.name} is retired and doesn't need to be fed.`);
        return;
      }
      toast.success(
        `Fed ${result.horse.name} with ${result.feed.name}. ${result.remainingUnits} units left.`
      );
      if (result.statBoost) {
        toast.success(`+1 ${result.statBoost.stat}!`, { duration: 4000 });
      }
    },
    onError: (err) => toast.error((err as { message?: string })?.message ?? 'Feeding failed.'),
  });
};

// Replace the Feed button JSX:
<button
  type="button"
  onClick={handleFeed}
  disabled={feedDisabledReason !== null || feedHorse.isPending}
  title={feedDisabledReason ?? 'Feed this horse'}
  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
  style={{
    background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
    color: 'var(--bg-deep-space)',
  }}
  data-testid="action-feed"
>
  <span aria-hidden="true">🌾</span>
  {feedHorse.isPending ? 'Feeding…' : 'Feed'}
</button>;
```

- [ ] **Step A16.3: Find and update the Equip Tack button**

Search the file for `Equip Tack` or any button that navigates to the tack shop (`navigate('/tack-shop')` etc.):

```bash
grep -n "Equip Tack\|tack-shop\|TackShop" frontend/src/pages/HorseDetailPage.tsx
```

Replace the button label and click handler:

```tsx
<button
  onClick={() => navigate(`/horses/${horse.id}/equip`)}
  // ... existing className
  data-testid="action-equip"
>
  <span aria-hidden="true">🎒</span>
  Equip
</button>
```

- [ ] **Step A16.4: Add HealthBadge to header**

Find where the horse name is rendered at the top of the page. Adjacent to the name, add:

```tsx
<HealthBadge
  band={horse.displayedHealth ?? 'excellent'}
  showCriticalWarning={horse.displayedHealth === 'critical'}
/>
```

- [ ] **Step A16.5: Type-check + manual smoke**

```bash
cd frontend && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step A16.6: Commit**

```bash
git add frontend/src/components/horse/HealthBadge.tsx frontend/src/pages/HorseDetailPage.tsx
git commit -m "feat(horse-detail): Feed button calls feed mutation; Equip routes to /horses/:id/equip; health badge"
```

---

### Task A17: InventoryPage Feed category

**Files:**

- Modify: `frontend/src/pages/InventoryPage.tsx`

- [ ] **Step A17.1: Add `feed` to category list**

In `frontend/src/pages/InventoryPage.tsx`:

```tsx
type InventoryCategory = 'all' | 'saddle' | 'bridle' | 'feed' | 'consumables' | 'special';

const categoryIcons: Record<InventoryCategory, React.ReactNode> = {
  all: <Package className="w-4 h-4" />,
  saddle: <Shield className="w-4 h-4" />,
  bridle: <Shield className="w-4 h-4" />,
  feed: <Leaf className="w-4 h-4" />,
  consumables: <Leaf className="w-4 h-4" />,
  special: <Sparkles className="w-4 h-4" />,
};

const categoryLabels: Record<InventoryCategory, string> = {
  all: 'All Items',
  saddle: 'Saddles',
  bridle: 'Bridles',
  feed: 'Feed',
  consumables: 'Consumables',
  special: 'Special',
};

const categories: InventoryCategory[] = [
  'all',
  'saddle',
  'bridle',
  'feed',
  'consumables',
  'special',
];
```

- [ ] **Step A17.2: Render feed rows differently**

In the inventory grid, when `item.category === 'feed'`, render without an Equip button:

```tsx
{item.category === 'feed' ? (
  <div className="text-xs text-[var(--text-muted)]">
    Equipped via the horse's Equip page.
  </div>
) : (
  // ... existing equip/unequip JSX
)}
```

- [ ] **Step A17.3: Type-check + manual smoke**

- [ ] **Step A17.4: Commit**

```bash
git add frontend/src/pages/InventoryPage.tsx
git commit -m "feat(inventory): add Feed category tab"
```

---

### Task A18: Phase A E2E smoke

**Files:**

- Create: `tests/e2e/feed-system-phase-a.spec.ts`

- [ ] **Step A18.1: Write Playwright spec**

Create `tests/e2e/feed-system-phase-a.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser, ensureCleanState } from './helpers/auth';

test.describe('Feed System Phase A — full loop', () => {
  test('buy → equip → feed → see remaining count', async ({ page }) => {
    await ensureCleanState(page);
    await loginAsTestUser(page);

    // Step 1: navigate to feed shop, buy a pack of basic
    await page.goto('/feed-shop');
    await expect(page.getByTestId('feed-tier-basic')).toBeVisible();
    await page.getByTestId('buy-basic').click();
    await expect(page.getByText(/Purchased 100 units of Basic Feed/)).toBeVisible();

    // Step 2: navigate to a horse → click Equip → equip basic
    await page.goto('/horses');
    await page.locator('[data-testid^="horse-card-"]').first().click();
    await page.getByTestId('action-equip').click();
    await expect(page).toHaveURL(/\/horses\/\d+\/equip$/);
    await page.getByTestId('feed-item-basic').getByRole('button', { name: 'Equip' }).click();
    await expect(page.getByText(/Equipped Basic Feed/)).toBeVisible();

    // Step 3: navigate back to horse, click Feed
    await page.goBack();
    await page.getByTestId('action-feed').click();
    await expect(page.getByText(/Fed .+ with Basic Feed.+99 units left/)).toBeVisible();

    // Step 4: clicking Feed again should be disabled (already fed today)
    await expect(page.getByTestId('action-feed')).toBeDisabled();
  });

  test('empty-state: equip page shows empty-state copy when no feed in inventory', async ({
    page,
  }) => {
    await ensureCleanState(page);
    await loginAsTestUser(page);
    await page.goto('/horses');
    await page.locator('[data-testid^="horse-card-"]').first().click();
    await page.getByTestId('action-equip').click();
    await expect(page.getByTestId('no-feed-empty-state')).toContainText(
      /No feed currently selected\. Please purchase feed from the feed store and equip it to your horse\./
    );
    await page.getByRole('link', { name: 'Go to Feed Shop' }).click();
    await expect(page).toHaveURL('/feed-shop');
  });
});
```

(`ensureCleanState` and `loginAsTestUser` are existing helpers; locate and adjust paths.)

- [ ] **Step A18.2: Run Playwright**

```bash
cd frontend && npx playwright test feed-system-phase-a 2>&1 | tail -30
```

- [ ] **Step A18.3: Commit**

```bash
git add tests/e2e/feed-system-phase-a.spec.ts
git commit -m "test(e2e): Phase A feed loop smoke test"
```

---

## Phase B — Pregnancy Mechanic (depends on Phase A)

> **Phase B note:** Phase B refactors `createFoal` from instant foal creation to delayed (7-day) foaling. This is a significant change to the breeding system. The implementation is more exploratory than Phase A — the implementer should read `backend/modules/horses/controllers/horseController.mjs:234-420` thoroughly before starting B3, and read whichever scheduled-job pattern the codebase uses (look for any existing cron / poller).

### Task B1: Phase B schema migration

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<ts>_feed_phase_b/migration.sql`

- [ ] **Step B1.1: Add columns to Horse model**

In `schema.prisma`, in the `Horse` model, add (near `lastBredDate`):

```prisma
  /// In-foal state (Phase B — feed-system pregnancy)
  inFoalSinceDate         DateTime?
  pregnancySireId         Int?
  pregnancyFeedingsByTier Json     @default("{}")
```

- [ ] **Step B1.2: Generate + apply migration**

```bash
cd packages/database
npx prisma migrate dev --name feed_phase_b
npx prisma generate
```

- [ ] **Step B1.3: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(schema): Phase B — inFoalSinceDate + pregnancySireId + pregnancyFeedingsByTier"
```

---

### Task B2: Pregnancy bonus formula — TDD

**Files:**

- Create: `backend/utils/pregnancyBonus.mjs`
- Create: `backend/__tests__/utils/pregnancyBonus.test.mjs`

- [ ] **Step B2.1: Write failing test**

Create `backend/__tests__/utils/pregnancyBonus.test.mjs`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { calculatePregnancyEpigeneticChances } from '../../utils/pregnancyBonus.mjs';

describe('calculatePregnancyEpigeneticChances', () => {
  it('7× elite → 20% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 7 });
    expect(r.positive_chance).toBeCloseTo(20, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('4× elite + 3× basic → ~11.4% positive, 0% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 4, basic: 3 });
    expect(r.positive_chance).toBeCloseTo(80 / 7, 5);
    expect(r.negative_chance).toBe(0);
  });

  it('5× elite + 2 unfed → ~14.3% positive, 10% negative', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 5 });
    expect(r.positive_chance).toBeCloseTo(100 / 7, 5);
    expect(r.negative_chance).toBe(10);
  });

  it('0 feedings → 0% positive, 35% negative', () => {
    const r = calculatePregnancyEpigeneticChances({});
    expect(r.positive_chance).toBe(0);
    expect(r.negative_chance).toBe(35);
  });

  it('8 feedings (edge case) caps divisor at max(7, total)', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 8 });
    expect(r.positive_chance).toBeCloseTo(160 / 8, 5); // = 20%, not 22.86%
  });

  it('ignores unknown tier keys gracefully', () => {
    const r = calculatePregnancyEpigeneticChances({ elite: 3, garbage: 99 });
    expect(r.positive_chance).toBeCloseTo(60 / 7, 5);
  });
});
```

- [ ] **Step B2.2: Run, verify RED**

```bash
cd backend && npm test -- --testPathPattern="pregnancyBonus" --no-coverage 2>&1 | tail -10
```

- [ ] **Step B2.3: Implement**

Create `backend/utils/pregnancyBonus.mjs`:

```javascript
const PREGNANCY_BONUS_PCT = {
  basic: 0,
  performance: 5,
  performancePlus: 10,
  highPerformance: 15,
  elite: 20,
};
const NEG_PER_MISSED_DAY = 5;
const GESTATION_DAYS = 7;

export function calculatePregnancyEpigeneticChances(feedingsByTier) {
  const counters = feedingsByTier ?? {};
  const totalFeedings = Object.entries(counters)
    .filter(([k]) => PREGNANCY_BONUS_PCT[k] != null)
    .reduce((sum, [, n]) => sum + (Number(n) || 0), 0);

  const divisor = Math.max(GESTATION_DAYS, totalFeedings);

  const weightedSum = Object.entries(counters)
    .filter(([k]) => PREGNANCY_BONUS_PCT[k] != null)
    .reduce((sum, [k, n]) => sum + (Number(n) || 0) * PREGNANCY_BONUS_PCT[k], 0);

  const positive_chance = weightedSum / divisor;
  const unfed_days = Math.max(0, GESTATION_DAYS - totalFeedings);
  const negative_chance = unfed_days * NEG_PER_MISSED_DAY;

  return { positive_chance, negative_chance };
}

export { PREGNANCY_BONUS_PCT, GESTATION_DAYS, NEG_PER_MISSED_DAY };
```

- [ ] **Step B2.4: Verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="pregnancyBonus" --no-coverage 2>&1 | tail -10
```

- [ ] **Step B2.5: Commit**

```bash
git add backend/utils/pregnancyBonus.mjs backend/__tests__/utils/pregnancyBonus.test.mjs
git commit -m "feat(breeding): pregnancy bonus formula (linear weighted average)"
```

---

### Task B3: Refactor `createFoal` to delayed foaling

**Files:**

- Modify: `backend/modules/horses/controllers/horseController.mjs:234` (`createFoal`)
- Create: `backend/modules/horses/services/foalingService.mjs`

This is the largest task in Phase B. The implementer should:

1. Read the existing `createFoal` (lines 234–420) end to end before editing.
2. Identify what is "breeding setup" (validate sire/dam, check breeding cooldown, deduct stud fee) vs "foal creation" (call `createFoalRecord`, generate genetics, etc.).
3. The breeding-setup portion stays in `createFoal`. The foal-creation portion moves to a new `foalingService.mjs::createFoalFromPregnancy(damId)` function.
4. `createFoal` now ends by setting `dam.inFoalSinceDate = now`, `dam.pregnancySireId = sireId` and returning a "pregnancy started" response — no foal record yet.
5. `foalingService.createFoalFromPregnancy(damId)` is invoked when the foaling cron/poll fires. It reads the dam's `pregnancyFeedingsByTier`, computes the epigenetic chances, generates the foal exactly as the existing logic does (move that code over), applies positive/negative trait rolls, then resets the dam's pregnancy columns.

- [ ] **Step B3.1: Write failing integration test for delayed creation**

Create `backend/__tests__/integration/breedingDelay.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateAuthToken } from '../helpers/authHelper.mjs';

describe('createFoal — delayed pregnancy', () => {
  let token, userId, sireId, damId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `b-${Date.now()}@t.com`,
        username: `b${Date.now()}`,
        password: 'p',
        money: 10000,
        settings: {},
      },
    });
    userId = user.id;
    token = generateAuthToken(user);
    const sire = await prisma.horse.create({
      data: { name: 'Sire', sex: 'stallion', dateOfBirth: new Date('2020-01-01'), age: 5, userId },
    });
    const dam = await prisma.horse.create({
      data: { name: 'Dam', sex: 'mare', dateOfBirth: new Date('2020-01-01'), age: 5, userId },
    });
    sireId = sire.id;
    damId = dam.id;
  });

  afterEach(async () => {
    await prisma.horse
      .deleteMany({ where: { OR: [{ damId }, { sireId }, { id: { in: [sireId, damId] } }] } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('breeding sets inFoalSinceDate and pregnancySireId; does NOT create foal yet', async () => {
    const before = await prisma.horse.count({ where: { damId } });
    expect(before).toBe(0);

    const res = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Foal', sireId, damId });

    // Expected new behavior: 200 with pregnancy-started response, NOT a foal record.
    expect(res.status).toBe(200);
    expect(res.body.data.pregnancyStarted).toBe(true);

    const dam = await prisma.horse.findUnique({ where: { id: damId } });
    expect(dam.inFoalSinceDate).toBeTruthy();
    expect(dam.pregnancySireId).toBe(sireId);

    const foalCount = await prisma.horse.count({ where: { damId } });
    expect(foalCount).toBe(0); // no foal yet
  });
});
```

- [ ] **Step B3.2: Run, verify RED**

- [ ] **Step B3.3: Refactor `createFoal`**

Read `backend/modules/horses/controllers/horseController.mjs:234-420` carefully. Identify the existing flow:

- Validation block (lines ~250-295)
- Genetics + epigenetic + conformation + gait generation (lines ~300-380)
- DB insert (~390)
- Response (~400-415)

Move the block from "validation passes" through the response into two phases:

```javascript
// In horseController.mjs createFoal:
// After validation, instead of generating + creating foal:
const dam = await prisma.horse.findUnique({ where: { id: damId } });
if (dam.inFoalSinceDate) {
  return res
    .status(400)
    .json({ success: false, message: 'This mare is already in foal.', data: null });
}

await prisma.horse.update({
  where: { id: damId },
  data: {
    inFoalSinceDate: new Date(),
    pregnancySireId: sireId,
    pregnancyFeedingsByTier: {},
    lastBredDate: new Date(),
  },
});

return res.status(200).json({
  success: true,
  message: `${dam.name} is now in foal. The foal will be born in 7 days.`,
  data: { pregnancyStarted: true, damId, sireId, foalDueDate: new Date(Date.now() + 7 * 86400000) },
});
```

Move all the foal-generation code (genetics, epigenetic seeding, conformation, gait, the actual `prisma.horse.create`) to `backend/modules/horses/services/foalingService.mjs` as `createFoalFromPregnancy(dam, sire)`.

- [ ] **Step B3.4: Run, verify GREEN**

```bash
cd backend && npm test -- --testPathPattern="breedingDelay" --no-coverage 2>&1 | tail -10
```

- [ ] **Step B3.5: Commit**

```bash
git add backend/modules/horses/controllers/horseController.mjs backend/modules/horses/services/foalingService.mjs backend/__tests__/integration/breedingDelay.test.mjs
git commit -m "feat(breeding): refactor createFoal to delayed pregnancy (Phase B)"
```

---

### Task B4: Increment pregnancy counter in feed action

**Files:**

- Modify: `backend/modules/horses/services/horseFeedService.mjs`

- [ ] **Step B4.1: Write failing integration test**

Append to `backend/__tests__/integration/feedHorseService.test.mjs`:

```javascript
describe('feedHorse — pregnancy counter', () => {
  let userId, damId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `pf-${Date.now()}@t.com`,
        username: `pf${Date.now()}`,
        password: 'p',
        money: 0,
        settings: {
          inventory: [
            { id: 'feed-elite', itemId: 'elite', category: 'feed', name: 'Elite', quantity: 5 },
          ],
        },
      },
    });
    userId = user.id;
    const dam = await prisma.horse.create({
      data: {
        name: `D${Date.now()}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        inFoalSinceDate: new Date(),
        pregnancyFeedingsByTier: {},
      },
    });
    damId = dam.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: damId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('increments pregnancyFeedingsByTier[elite] by 1 when in-foal mare is fed elite', async () => {
    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });
    const fresh = await prisma.horse.findUnique({ where: { id: damId } });
    expect(fresh.pregnancyFeedingsByTier).toEqual({ elite: 1 });
  });

  it('does NOT increment counter when not in-foal', async () => {
    await prisma.horse.update({ where: { id: damId }, data: { inFoalSinceDate: null } });
    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });
    const fresh = await prisma.horse.findUnique({ where: { id: damId } });
    expect(fresh.pregnancyFeedingsByTier).toEqual({});
  });
});
```

- [ ] **Step B4.2: Run, verify RED**

- [ ] **Step B4.3: Update `feedHorse` service**

In `backend/modules/horses/services/horseFeedService.mjs`, in the transaction where `horseUpdate` is built, add:

```javascript
// Pregnancy counter (Phase B)
if (horse.inFoalSinceDate) {
  const counters =
    horse.pregnancyFeedingsByTier && typeof horse.pregnancyFeedingsByTier === 'object'
      ? { ...horse.pregnancyFeedingsByTier }
      : {};
  counters[tier.id] = (counters[tier.id] ?? 0) + 1;
  horseUpdate.pregnancyFeedingsByTier = counters;
}
```

- [ ] **Step B4.4: Run, verify GREEN**

- [ ] **Step B4.5: Commit**

```bash
git add backend/modules/horses/services/horseFeedService.mjs backend/__tests__/integration/feedHorseService.test.mjs
git commit -m "feat(horses): feedHorse increments pregnancyFeedingsByTier when mare is in-foal"
```

---

### Task B5: Foaling job — apply formula at +7 days

**Files:**

- Modify: `backend/modules/horses/services/foalingService.mjs` (created in B3)
- Locate the existing scheduled-job pattern in the codebase. If there's a polling mechanism, hook into it; otherwise, add a simple endpoint `/api/admin/run-foaling-job` for now and document it.

- [ ] **Step B5.1: Write failing test**

Create `backend/__tests__/integration/foalingJob.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { runFoalingJob } from '../../modules/horses/services/foalingService.mjs';

describe('runFoalingJob', () => {
  let userId, damId, sireId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `f-${Date.now()}@t.com`,
        username: `f${Date.now()}`,
        password: 'p',
        money: 0,
        settings: {},
      },
    });
    userId = user.id;
    const sire = await prisma.horse.create({
      data: { name: 'Sire', sex: 'stallion', dateOfBirth: new Date('2020-01-01'), age: 5, userId },
    });
    const dam = await prisma.horse.create({
      data: {
        name: 'Dam',
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        inFoalSinceDate: new Date(Date.now() - 8 * 86400000), // 8 days ago — past due
        pregnancySireId: sire.id,
        pregnancyFeedingsByTier: { elite: 5, performance: 2 },
      },
    });
    sireId = sire.id;
    damId = dam.id;
  });

  afterEach(async () => {
    await prisma.horse
      .deleteMany({ where: { OR: [{ damId }, { sireId }, { id: { in: [sireId, damId] } }] } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('creates foal and resets dam pregnancy columns when gestation complete', async () => {
    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const dam = await prisma.horse.findUnique({ where: { id: damId } });
    expect(dam.inFoalSinceDate).toBeNull();
    expect(dam.pregnancySireId).toBeNull();
    expect(dam.pregnancyFeedingsByTier).toEqual({});

    const foals = await prisma.horse.findMany({ where: { damId, sireId } });
    expect(foals.length).toBe(1);
  });

  it('does NOT foal mares whose gestation is incomplete', async () => {
    await prisma.horse.update({
      where: { id: damId },
      data: { inFoalSinceDate: new Date(Date.now() - 3 * 86400000) }, // 3 days ago — too early
    });
    const result = await runFoalingJob();
    expect(result.foalsBorn).toBe(0);
    const dam = await prisma.horse.findUnique({ where: { id: damId } });
    expect(dam.inFoalSinceDate).not.toBeNull();
  });
});
```

- [ ] **Step B5.2: Implement `runFoalingJob`**

In `backend/modules/horses/services/foalingService.mjs`:

```javascript
import prisma from '../../../../packages/database/prismaClient.mjs';
import { calculatePregnancyEpigeneticChances } from '../../../utils/pregnancyBonus.mjs';

const GESTATION_MS = 7 * 86_400_000;

/**
 * Find all mares whose gestation is complete and create their foals.
 * Returns count of foals born.
 */
export async function runFoalingJob({ now = new Date(), rng = Math.random } = {}) {
  const cutoff = new Date(now.getTime() - GESTATION_MS);
  const dueMares = await prisma.horse.findMany({
    where: {
      inFoalSinceDate: { lte: cutoff },
    },
  });

  let foalsBorn = 0;
  for (const dam of dueMares) {
    if (!dam.pregnancySireId) continue; // bad data — skip
    const sire = await prisma.horse.findUnique({ where: { id: dam.pregnancySireId } });
    if (!sire) continue;

    const { positive_chance, negative_chance } = calculatePregnancyEpigeneticChances(
      dam.pregnancyFeedingsByTier
    );

    // Roll positive and negative independently.
    const positiveRoll = rng() * 100 < positive_chance;
    const negativeRoll = rng() * 100 < negative_chance;

    // Call the existing foal-creation logic (factored out from the old createFoal in B3).
    await createFoalFromPregnancy({ dam, sire, positiveRoll, negativeRoll });

    // Reset dam's pregnancy columns.
    await prisma.horse.update({
      where: { id: dam.id },
      data: {
        inFoalSinceDate: null,
        pregnancySireId: null,
        pregnancyFeedingsByTier: {},
      },
    });
    foalsBorn += 1;
  }
  return { foalsBorn };
}

/**
 * Create the foal record for a completed pregnancy. Encapsulates the
 * genetics / conformation / gait / epigenetic-flag generation moved
 * over from the original createFoal endpoint in Task B3.
 */
export async function createFoalFromPregnancy({ dam, sire, positiveRoll, negativeRoll }) {
  // The body of this function is the foal-generation code lifted from
  // backend/modules/horses/controllers/horseController.mjs createFoal
  // (Task B3.3). The positiveRoll/negativeRoll flags determine whether
  // a positive / negative epigenetic trait is added during seeding.
  // Implementer: paste the lifted code here, with the new flag inputs
  // wired into the epigenetic-trait selection step.
  // ...
}
```

(B5.2's `createFoalFromPregnancy` body is intentionally a porting task — the implementer copies the existing genetics/foal-create logic from B3.3 here and adds two flag-controlled trait insertions.)

- [ ] **Step B5.3: Run, verify GREEN**

- [ ] **Step B5.4: Wire a manual trigger endpoint (or scheduled job)**

If the codebase has an existing job runner, register `runFoalingJob` to run every 1 hour. Otherwise, add an admin-gated endpoint `POST /api/admin/run-foaling-job` so operators (and tests) can trigger it. Match whichever pattern exists.

- [ ] **Step B5.5: Commit**

```bash
git add backend/modules/horses/services/foalingService.mjs backend/__tests__/integration/foalingJob.test.mjs
git commit -m "feat(breeding): foaling job applies pregnancy bonus formula and creates delayed foals"
```

---

### Task B6: Frontend `PregnancyFeedingPanel`

**Files:**

- Create: `frontend/src/components/horse/PregnancyFeedingPanel.tsx`
- Modify: `frontend/src/pages/HorseDetailPage.tsx` (render the panel for in-foal mares)

- [ ] **Step B6.1: Create the panel**

Create `frontend/src/components/horse/PregnancyFeedingPanel.tsx`:

```tsx
import React from 'react';

interface PregnancyFeedingPanelProps {
  inFoalSinceDate: string | null;
  feedings: Record<string, number>;
}

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  performance: 'Performance',
  performancePlus: 'Performance Plus',
  highPerformance: 'High Performance',
  elite: 'Elite',
};
const TIER_BONUS_PCT: Record<string, number> = {
  basic: 0,
  performance: 5,
  performancePlus: 10,
  highPerformance: 15,
  elite: 20,
};
const GESTATION_DAYS = 7;
const NEG_PER_MISSED = 5;

export const PregnancyFeedingPanel: React.FC<PregnancyFeedingPanelProps> = ({
  inFoalSinceDate,
  feedings,
}) => {
  if (!inFoalSinceDate) return null;

  const days = Math.floor((Date.now() - new Date(inFoalSinceDate).getTime()) / 86400000);
  const dayLabel = Math.min(days + 1, GESTATION_DAYS);

  const total = Object.values(feedings).reduce((a, b) => a + b, 0);
  const divisor = Math.max(GESTATION_DAYS, total);
  const weighted = Object.entries(feedings).reduce(
    (s, [k, n]) => s + (TIER_BONUS_PCT[k] ?? 0) * n,
    0
  );
  const positivePct = weighted / divisor;
  const unfedDays = Math.max(0, GESTATION_DAYS - total);
  const negativePct = unfedDays * NEG_PER_MISSED;

  return (
    <div
      className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5"
      data-testid="pregnancy-feeding-panel"
    >
      <h3 className="font-bold text-[var(--cream)] mb-1">
        In foal — gestation day {dayLabel} of {GESTATION_DAYS}
      </h3>
      <p className="text-xs text-[var(--text-muted)] mb-3">Feedings so far:</p>
      <ul className="space-y-1 text-sm text-[var(--text-secondary)] mb-3">
        {Object.entries(feedings).map(([tier, count]) => (
          <li key={tier}>
            • {TIER_LABELS[tier] ?? tier} × {count}
          </li>
        ))}
        {unfedDays > 0 && <li className="text-orange-400/80">• Missed × {unfedDays}</li>}
      </ul>
      <div className="text-xs text-[var(--text-muted)] space-y-0.5">
        <div>
          Projected positive trait chance: <strong>{positivePct.toFixed(1)}%</strong>
        </div>
        <div>
          Projected negative trait chance: <strong>{negativePct.toFixed(0)}%</strong>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step B6.2: Render in HorseDetailPage**

In `HorseDetailPage.tsx`, where breeding/health information is shown:

```tsx
{
  horse.sex === 'mare' && horse.inFoalSinceDate && (
    <PregnancyFeedingPanel
      inFoalSinceDate={horse.inFoalSinceDate}
      feedings={horse.pregnancyFeedingsByTier ?? {}}
    />
  );
}
```

- [ ] **Step B6.3: Update Horse type in api-client**

In `frontend/src/lib/api-client.ts`, add to the Horse type:

```typescript
inFoalSinceDate?: string | null;
pregnancyFeedingsByTier?: Record<string, number>;
```

- [ ] **Step B6.4: Type-check**

- [ ] **Step B6.5: Commit**

```bash
git add frontend/src/components/horse/PregnancyFeedingPanel.tsx frontend/src/pages/HorseDetailPage.tsx frontend/src/lib/api-client.ts
git commit -m "feat(horse-detail): pregnancy feeding panel for in-foal mares"
```

---

## Cleanup

### Task C1: Documentation updates

**Files:**

- Modify: `PROJECT_MILESTONES.md`
- Modify: `DEV_NOTES.md`
- Modify: `TODO.md` (move feed-system items to "Recently Completed")

- [ ] **Step C1.1: Append to PROJECT_MILESTONES.md**

```markdown
## 2026-04-29 — Feed System Redesign (Phases A + B)

Replaced the per-horse feed-purchase model with a separate inventory + manual
daily-feeding loop. 5-tier catalog (Basic / Performance / Performance Plus /
High Performance / Elite) sold in 100-unit packs at the Feed Shop. Daily Feed
button on horse page consumes 1 unit of equipped feed; rolls a stat-boost
chance per tier (10/15/20/25%) and increments pregnancy counter for in-foal
mares. Health bands derived from `lastFedDate` (daily decay) and
`lastVettedDate` (weekly decay), combined as `worseOf(feedHealth, vetHealth)`.
Critical-health gates breeding and competition entry. `coordination` stat
removed entirely. `createFoal` refactored to set `inFoalSinceDate` instead of
instant foal creation; foaling job creates the foal at +7 days using the
weighted-average pregnancy bonus formula.

Spec: `docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md`
Plan: `docs/superpowers/plans/2026-04-29-feed-system-redesign.md`
```

- [ ] **Step C1.2: Append to DEV_NOTES.md**

Add a new dated section. Required content:

```markdown
### 2026-04-29 — Feed System Redesign Implementation Notes

**Pregnancy formula divisor (`max(7, totalFeedings)`):** the gestation window
can span 8 UTC calendar days when the breeding moment and foaling moment fall
on different times of day (e.g., bred 11pm Mon, due 11pm Mon next week =
8 distinct UTC midnights, allowing up to 8 daily feedings). Without the
`max()`, 8× elite would overshoot the 20% ceiling at 22.86%. The divisor
caps the bonus at the design ceiling regardless of count.

**Two-derived health (recon Finding 2 → α):** vetHealth and feedHealth are
both DERIVED from their respective dates; the existing `healthStatus` column
is treated as a vet-finding override (non-null beats lastVettedDate decay).
displayedHealth = worseOf(vetHealth, feedHealth). Gates check displayedHealth.

**`coordination` removal (Finding 1 → B):** the stat was dropped from the
schema and the boost-roll pool. Pre-flight grep audit identified all
production reads/writes; tests and seed fixtures updated. Boost pool is
now 12 stats, names match schema.prisma exactly.

**`createFoal` refactor (Phase B):** the original endpoint created foals
synchronously. New flow: breed → set `inFoalSinceDate` + `pregnancySireId`
→ scheduled `runFoalingJob` polls every hour for due mares → creates foal
using lifted genetics/conformation/gait code from the original endpoint,
applies pregnancy-bonus formula to seed positive/negative epigenetic flags.

**Stat-boost RNG:** server-side only via `feedHorse({ rng })` injection.
Tests inject deterministic sequences. Production uses Math.random.
```

- [ ] **Step C1.3: Commit**

```bash
git add PROJECT_MILESTONES.md DEV_NOTES.md TODO.md
git commit -m "docs: feed system redesign milestone + dev notes"
```

---

### Task C2: Final smoke + readiness gate

- [ ] **Step C2.1: Full backend test suite**

```bash
cd backend && npm test -- --silent 2>&1 | tail -10
```

Expected: pass count up by ~30 tests; fail count unchanged from baseline (excluding any flaky pre-existing failures).

- [ ] **Step C2.2: Frontend lint + typecheck**

```bash
cd frontend && npm run lint && npx tsc --noEmit
```

- [ ] **Step C2.3: E2E suite**

```bash
cd frontend && npx playwright test 2>&1 | tail -20
```

- [ ] **Step C2.4: Beta-readiness gate**

```bash
bash scripts/check-beta-readiness.sh
```

Per spec §9.4 (option B): the readiness gate runs against the new feed surface. Any failures must be fixed before signoff.

- [ ] **Step C2.5: Final commit + ready for review**

```bash
git status
# Verify clean working tree.
git log --oneline -30
# Audit the commit chain — every task should have its own commit.
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** every spec section is mapped to a task above. If you find a spec requirement with no task, it's a plan bug — surface to the user before implementing.
- **Recon Findings:** all four are baked into the plan. Finding 1 (drop coordination) → Tasks A1, A2. Finding 2 (vet+feed combined) → Tasks A3, A4. Finding 3 (pregnancy on Horse columns) → Task B1. Finding 4 (createFoal refactor) → Task B3.
- **TDD discipline:** every backend task has a failing-test step before implementation. If a step says "verify GREEN" without a "verify RED" preceding it, that's a plan bug — write the test first.
- **No bypasses:** zero `it.skip`, zero `continue-on-error`, zero `x-test-*` headers in any task. The spec rules from CLAUDE.md apply.
- **Commit cadence:** one commit per task at minimum; some tasks have intermediate sub-commits where natural.
