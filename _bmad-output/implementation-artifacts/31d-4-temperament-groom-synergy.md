# Story 31D.4: Groom Temperament Synergy

Status: done

## Story

As a player,
I want my horse's temperament to influence how well different groom personalities bond with it,
So that matching the right groom to my horse's temperament is a meaningful strategic decision.

## Acceptance Criteria

1. **Given** a horse with temperament "Nervous" is assigned a groom with personality "patient", **When** a bonding grooming interaction occurs, **Then** the bonding speed is increased by 25% (effective daily gain = 2.5 instead of 2)
2. **Given** a horse with temperament "Nervous" is assigned a groom with personality "strict", **When** a bonding grooming interaction occurs, **Then** the bonding speed is decreased by 15% (effective daily gain = 1.7 instead of 2) — within the PRD-specified 10–20% reduction range
3. **And** all temperament-personality synergy modifiers from PRD-03 §7.6 are applied per the table below:

| Temperament | Personality | Modifier |
| ----------- | ----------- | -------- |
| Spirited    | energetic   | +20%     |
| Nervous     | patient     | +25%     |
| Nervous     | gentle      | +25%     |
| Nervous     | strict      | -15%     |
| Calm        | any         | +10%     |
| Bold        | energetic   | +15%     |
| Bold        | strict      | +15%     |
| Steady      | any         | +10%     |
| Independent | patient     | +15%     |
| Reactive    | patient     | +20%     |
| Reactive    | gentle      | +20%     |
| Stubborn    | strict      | +15%     |
| Playful     | energetic   | +15%     |
| Lazy        | energetic   | +10%     |
| Lazy        | strict      | +10%     |
| Aggressive  | strict      | +10%     |
| Aggressive  | patient     | +10%     |

4. **And** synergy modifiers are applied by multiplying `DAILY_BOND_GAIN` before the bond cap: `effectiveGain = DAILY_BOND_GAIN * (1 + synergyModifier)`
5. **And** horses with null temperament receive zero synergy modifier (backward compatible)
6. **And** grooms with null/unknown personality receive zero synergy modifier (backward compatible)
7. **And** the existing `calculateBondingEffects(currentBondScore, groomingTask)` 2-arg call still returns bondChange=2 (no regression)

## Tasks / Subtasks

- [x] Task 1: Add synergy lookup to temperamentService (AC: #3, #5, #6)

  - [x] 1.1 Add `TEMPERAMENT_GROOM_SYNERGY` constant to `backend/modules/horses/services/temperamentService.mjs` — nested frozen object: temperament → personality → decimal modifier. Calm and Steady use `_any: 0.10` key for universal matching.
  - [x] 1.2 Add `getTemperamentGroomSynergy(temperament, groomPersonality)` function — returns decimal modifier (e.g., 0.25 = +25%) or 0 for null/unknown inputs. Handles `_any` key for Calm/Steady.
  - [x] 1.3 Export both the constant and function

- [x] Task 2: Integrate synergy into `calculateBondingEffects` (AC: #1, #2, #4, #5, #6, #7)

  - [x] 2.1 Import `getTemperamentGroomSynergy` in `backend/utils/groomBondingSystem.mjs`
  - [x] 2.2 Add two optional params to `calculateBondingEffects`: `groomPersonality = null` and `horseTemperament = null` (backward-compatible — existing 2-arg callers unaffected)
  - [x] 2.3 After the task category eligibility check, compute: `const synergyMod = getTemperamentGroomSynergy(horseTemperament, groomPersonality)`
  - [x] 2.4 Apply synergy to daily gain: `const effectiveGain = GROOM_CONFIG.DAILY_BOND_GAIN * (1 + synergyMod)`
  - [x] 2.5 Replace `GROOM_CONFIG.DAILY_BOND_GAIN` with `effectiveGain` in the `potentialNewScore` calculation
  - [x] 2.6 Add `logger.info` when `synergyMod !== 0`: log temperament, personality, modifier%, and effective gain
  - [x] 2.7 Add `synergyModifier: synergyMod` to the returned object (does not break existing callers — additive field)

- [x] Task 3: Wire up in `processGroomingSession` (AC: #4)

  - [x] 3.1 In `processGroomingSession`, rename `_groomId` param to `groomId` (it is now used)
  - [x] 3.2 Fetch groom personality: `const groom = await prisma.groom.findUnique({ where: { id: groomId }, select: { personality: true } })` — handle null (groom not found = no synergy)
  - [x] 3.3 Add `temperament: true` to the existing horse `findUnique` select in `processGroomingSession`
  - [x] 3.4 Pass personality and temperament to `calculateBondingEffects`: `calculateBondingEffects(horse.bondScore || 0, groomingTask, groom?.personality ?? null, horse.temperament ?? null)`

- [x] Task 4: Tests (AC: #1–#7)
  - [x] 4.1 Unit tests for `getTemperamentGroomSynergy()` — all 17 explicit pairings from AC3 table return correct decimal modifier
  - [x] 4.2 Unit test — Calm + any personality returns +0.10 (all 4 valid personalities)
  - [x] 4.3 Unit test — Steady + any personality returns +0.10
  - [x] 4.4 Unit test — null temperament returns 0
  - [x] 4.5 Unit test — null groomPersonality returns 0
  - [x] 4.6 Unit test — unknown temperament string returns 0 + logs warn
  - [x] 4.7 Unit test — unknown personality string returns 0 (no error)
  - [x] 4.8 Integration test — `calculateBondingEffects(20, 'brushing', 'patient', 'Nervous')`: bondChange ≈ 2.5, newBondScore ≈ 22.5, synergyModifier = 0.25 (AC #1)
  - [x] 4.9 Integration test — `calculateBondingEffects(20, 'brushing', 'strict', 'Nervous')`: bondChange ≈ 1.7, synergyModifier = -0.15 (AC #2)
  - [x] 4.10 Regression test — `calculateBondingEffects(20, 'brushing')` (2-arg): bondChange = 2, newBondScore = 22 (AC #7)
  - [x] 4.11 Integration test — `calculateBondingEffects(20, 'brushing', null, null)`: bondChange = 2 (null inputs = neutral)
  - [x] 4.12 Enrichment task still returns bondChange=0 when synergy supplied: `calculateBondingEffects(20, 'desensitization', 'patient', 'Nervous')` → ineligible
  - [x] 4.13 Data integrity test — all 11 keys in `TEMPERAMENT_GROOM_SYNERGY` match `TEMPERAMENT_TYPES` array from `breedGeneticProfiles.mjs`

## Dev Notes

### CRITICAL: PRD "Firm" = `strict` in Code

The PRD-03 §7.6 table uses the personality name "Firm". In the canonical `GROOM_PERSONALITIES` enum (`backend/constants/schema.mjs`), this maps to `strict` (value: `'strict'`). Some older test files use `'firm'` but the schema enum is authoritative:

```javascript
// backend/constants/schema.mjs
export const GROOM_PERSONALITIES = {
  GENTLE: 'gentle',
  ENERGETIC: 'energetic',
  PATIENT: 'patient',
  STRICT: 'strict', // ← PRD "Firm"
};
```

Use `strict` in `TEMPERAMENT_GROOM_SYNERGY` keys, not `firm`.

### CRITICAL: Which Groom Field to Use

The `Groom` Prisma model has TWO personality fields:

- `personality` (`String`) — main personality type: `gentle | energetic | patient | strict` ← **USE THIS**
- `groomPersonality` (`String @default("balanced")`) — epigenetic trait system field: `calm | energetic | methodical | balanced` ← DO NOT USE for synergy

Story 31D-4 targets the `personality` field (the one validated by `GROOM_PERSONALITY_VALUES`). The `groomPersonality` field drives the separate epigenetic trait system.

### Synergy Constant Design

```javascript
// In temperamentService.mjs
export const TEMPERAMENT_GROOM_SYNERGY = Object.freeze({
  Spirited: Object.freeze({ energetic: 0.2 }),
  Nervous: Object.freeze({ patient: 0.25, gentle: 0.25, strict: -0.15 }),
  Calm: Object.freeze({ _any: 0.1 }), // universal +10% with any personality
  Bold: Object.freeze({ energetic: 0.15, strict: 0.15 }),
  Steady: Object.freeze({ _any: 0.1 }), // universal +10% with any personality
  Independent: Object.freeze({ patient: 0.15 }),
  Reactive: Object.freeze({ patient: 0.2, gentle: 0.2 }),
  Stubborn: Object.freeze({ strict: 0.15 }),
  Playful: Object.freeze({ energetic: 0.15 }),
  Lazy: Object.freeze({ energetic: 0.1, strict: 0.1 }),
  Aggressive: Object.freeze({ strict: 0.1, patient: 0.1 }),
});
```

`_any` is a sentinel key — not a real personality value. The function handles it specially.

### Synergy Function Logic

```javascript
export function getTemperamentGroomSynergy(temperament, groomPersonality) {
  if (!temperament || typeof temperament !== 'string') return 0;
  if (!groomPersonality || typeof groomPersonality !== 'string') return 0;

  const synergyMap = TEMPERAMENT_GROOM_SYNERGY[temperament];
  if (!synergyMap) {
    logger.warn(
      `[temperamentService] Unknown temperament "${temperament}" — returning zero groom synergy`
    );
    return 0;
  }

  // Calm and Steady: universal bonus for any valid personality
  if ('_any' in synergyMap) {
    return synergyMap._any;
  }

  // Specific personality match (use lowercase comparison for robustness)
  const modifier = synergyMap[groomPersonality.toLowerCase()];
  return modifier !== undefined ? modifier : 0; // 0 = neutral
}
```

### calculateBondingEffects Integration Point

Current signature (line 118 in `groomBondingSystem.mjs`):

```javascript
export function calculateBondingEffects(currentBondScore, groomingTask) {
```

New signature (backward-compatible, 2-arg callers unaffected):

```javascript
export function calculateBondingEffects(
  currentBondScore,
  groomingTask,
  groomPersonality = null,
  horseTemperament = null
) {
```

Current bonding calc (lines 130–133):

```javascript
const potentialNewScore = currentBondScore + GROOM_CONFIG.DAILY_BOND_GAIN;
const newBondScore = Math.min(potentialNewScore, GROOM_CONFIG.BOND_SCORE_MAX);
const actualBondChange = newBondScore - currentBondScore;
```

After change:

```javascript
const synergyMod = getTemperamentGroomSynergy(horseTemperament, groomPersonality);
const effectiveGain = GROOM_CONFIG.DAILY_BOND_GAIN * (1 + synergyMod);

if (synergyMod !== 0) {
  logger.info(
    `[calculateBondingEffects] Temperament "${horseTemperament}" × groom "${groomPersonality}": synergy ${(synergyMod * 100).toFixed(0)}% → effective gain ${effectiveGain.toFixed(2)}`
  );
}

const potentialNewScore = currentBondScore + effectiveGain;
const newBondScore = Math.min(potentialNewScore, GROOM_CONFIG.BOND_SCORE_MAX);
const actualBondChange = newBondScore - currentBondScore;
```

Return object adds `synergyModifier: synergyMod` — additive, no breaking change.

### processGroomingSession Wiring

Current signature (line 259 in `groomBondingSystem.mjs`):

```javascript
export async function processGroomingSession(horseId, _groomId, groomingTask, _duration) {
```

Note `_groomId` and `_duration` are currently prefixed with `_` (unused). For this story, `groomId` becomes used. `_duration` remains unused.

Current horse query (line 263):

```javascript
const horse = await prisma.horse.findUnique({
  where: { id: horseId },
  select: {
    id: true,
    name: true,
    age: true,
    bondScore: true,
    daysGroomedInARow: true,
    burnoutStatus: true,
  },
});
```

Add `temperament: true` to horse select.

Add after horse fetch (before eligibility check):

```javascript
const groom = groomId
  ? await prisma.groom.findUnique({
      where: { id: groomId },
      select: { personality: true },
    })
  : null;
```

Update calculateBondingEffects call:

```javascript
const bondingEffects = calculateBondingEffects(
  horse.bondScore || 0,
  groomingTask,
  groom?.personality ?? null,
  horse.temperament ?? null
);
```

### Test File Pattern — Pure Function Tests (No Prisma Mock)

`getTemperamentGroomSynergy` and `calculateBondingEffects` (for 2- and 4-arg forms) are pure functions — no DB calls. No Prisma mock needed for those tests.

`processGroomingSession` does use Prisma, but its tests in this story focus on unit testing the functions, not the async orchestration. Leave `processGroomingSession` integration to the existing groom integration tests.

Test file: `backend/__tests__/temperamentGroomSynergy.test.mjs`

Mock pattern:

```javascript
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const { getTemperamentGroomSynergy, TEMPERAMENT_GROOM_SYNERGY } = await import(
  '../modules/horses/services/temperamentService.mjs'
);
const { calculateBondingEffects } = await import('../utils/groomBondingSystem.mjs');
const { GROOM_CONFIG } = await import('../config/groomConfig.mjs');
```

Note: `jest.unstable_mockModule()` MUST be called BEFORE `await import()` (same pattern as 31D-2 and 31D-3).

Run tests: `node --experimental-vm-modules ./node_modules/jest-cli/bin/jest.js __tests__/temperamentGroomSynergy.test.mjs --no-coverage`

### Test Math Reference

`DAILY_BOND_GAIN = 2` (from groomConfig.mjs)

| Scenario             | synergyMod | effectiveGain | bondChange (from score=20) |
| -------------------- | ---------- | ------------- | -------------------------- |
| Nervous + patient    | +0.25      | 2.50          | 2.50                       |
| Nervous + strict     | -0.15      | 1.70          | 1.70                       |
| null + anything      | 0          | 2.00          | 2.00                       |
| Calm + energetic     | +0.10      | 2.20          | 2.20                       |
| Spirited + energetic | +0.20      | 2.40          | 2.40                       |

Note: `bondChange` is a decimal (no rounding at service layer). Rounding/display is the UI concern.

### Existing Tests NOT to Break

`backend/tests/groomBondingSystem.test.mjs` — 8 tests calling `calculateBondingEffects(score, task)` with 2 args. With `groomPersonality = null, horseTemperament = null`, `synergyMod = 0`, `effectiveGain = 2`. ✓ All pass unchanged.

`backend/tests/utils/groomBondingSystem.comprehensive.test.mjs` — same 2-arg pattern. ✓ All pass unchanged.

### Files to Create

| File                                                 | Purpose                                  |
| ---------------------------------------------------- | ---------------------------------------- |
| `backend/__tests__/temperamentGroomSynergy.test.mjs` | All unit + integration tests for synergy |

### Files to Modify

| File                                                     | Change                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/modules/horses/services/temperamentService.mjs` | Add `TEMPERAMENT_GROOM_SYNERGY` constant + `getTemperamentGroomSynergy()` function                            |
| `backend/utils/groomBondingSystem.mjs`                   | Import synergy function; add optional params to `calculateBondingEffects`; wire into `processGroomingSession` |

### Files NOT to Modify

| File                                               | Reason                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `backend/constants/schema.mjs`                     | `GROOM_PERSONALITIES` already has the canonical values; no changes needed |
| `backend/config/groomConfig.mjs`                   | DO NOT MODIFY — marked "DO NOT MODIFY: Configuration locked"              |
| `backend/utils/groomSystem.mjs`                    | Separate legacy groom system; no synergy integration here                 |
| `backend/services/groomPersonalityTraits.mjs`      | Separate epigenetic/trait system; unrelated to bonding speed              |
| `backend/services/dynamicCompatibilityScoring.mjs` | Separate compatibility scoring system; unrelated to this story            |

### Project Structure Notes

- `temperamentService.mjs` now exports: `weightedRandomSelect`, `generateTemperament`, `TEMPERAMENT_TRAINING_MODIFIERS`, `getTemperamentTrainingModifiers`, `TEMPERAMENT_COMPETITION_MODIFIERS`, `getTemperamentCompetitionModifiers`, **`TEMPERAMENT_GROOM_SYNERGY`**, **`getTemperamentGroomSynergy`**
- ES modules only (`.mjs` extension, import/export)
- All imports must include `.mjs` extension

### Previous Story Intelligence (31D-3)

- `jest.unstable_mockModule()` must be called BEFORE any `await import()` — non-negotiable
- All mock variables (`const mockFn = jest.fn()`) must be declared BEFORE `jest.unstable_mockModule()` calls
- ESLint: use `_` prefix for unused destructured vars in `.map()` callbacks
- The existing 30 tests in `temperamentCompetitionModifiers.test.mjs` must not regress
- The existing 31 tests in `temperamentTrainingModifiers.test.mjs` must not regress
- `Object.freeze()` on both the top-level constant and all nested objects (same pattern as TEMPERAMENT_TRAINING_MODIFIERS and TEMPERAMENT_COMPETITION_MODIFIERS)

### References

- [Source: docs/epics-physical-systems.md — Epic 31D, Story 31D-4]
- [Source: docs/product/PRD-03-Gameplay-Systems.md §7.6] Groom synergy table
- [Source: backend/modules/horses/services/temperamentService.mjs] Service file to extend (31D-1/2/3 patterns)
- [Source: backend/utils/groomBondingSystem.mjs:118] `calculateBondingEffects` — integration target
- [Source: backend/utils/groomBondingSystem.mjs:259] `processGroomingSession` — wiring target (`_groomId` → `groomId`)
- [Source: backend/constants/schema.mjs:147] `GROOM_PERSONALITIES` — canonical personality enum (gentle/energetic/patient/strict)
- [Source: backend/config/groomConfig.mjs:39] `DAILY_BOND_GAIN = 2` — base multiplied by synergy
- [Source: _bmad-output/implementation-artifacts/31d-3-temperament-competition-modifiers.md] Previous story patterns
- [Source: backend/__tests__/temperamentCompetitionModifiers.test.mjs] Test structure reference

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks completed cleanly on first pass.

### Completion Notes List

- Added `TEMPERAMENT_GROOM_SYNERGY` frozen constant (11 temperaments × personality modifiers) and `getTemperamentGroomSynergy()` function to `temperamentService.mjs`.
- `getTemperamentGroomSynergy()` handles `_any` sentinel key for Calm/Steady universal bonuses, null/unknown inputs (returns 0), and logs warn for unknown temperaments.
- Extended `calculateBondingEffects()` with optional `groomPersonality` and `horseTemperament` params (backward-compatible). Computes `effectiveGain = DAILY_BOND_GAIN * (1 + synergyMod)` and returns `synergyModifier` field.
- Updated `processGroomingSession()`: renamed `_groomId` → `groomId`, adds groom personality fetch and horse `temperament` select, wires both to `calculateBondingEffects`.
- Test file `backend/__tests__/temperamentGroomSynergy.test.mjs` covers 37 tests: all 17 explicit AC pairings, Calm/Steady universal, null/unknown guards, integration with bondChange math, 2-arg regression, enrichment task ineligibility, data integrity.
- All 37 new tests pass. All 159 temperament tests pass. All 43 existing groomBondingSystem tests pass.

### File List

- `backend/modules/horses/services/temperamentService.mjs` (modified)
- `backend/utils/groomBondingSystem.mjs` (modified)
- `backend/__tests__/temperamentGroomSynergy.test.mjs` (created)

## Change Log

- 2026-03-30: Implemented Story 31D.4 — added TEMPERAMENT_GROOM_SYNERGY constant + getTemperamentGroomSynergy() to temperamentService; extended calculateBondingEffects() with backward-compatible synergy params; wired processGroomingSession() to fetch and apply groom personality + horse temperament; added 37-test suite covering all ACs.
- 2026-03-31: Code review fixes — added CANONICAL_GROOM_PERSONALITIES set to validate personality before \_any return (Calm/Steady no longer grant bonus to non-canonical personalities); added .trim() to both temperament and personality normalisation for robustness; added 6 new tests (cap boundary with synergy, \_any bypass with invalid personality, whitespace normalisation). 43 tests total, 0 regressions.
