# Story 31D.3: Competition Temperament Modifiers

Status: review

## Story

As a developer,
I want temperament to modify competition final scores,
So that horse personality affects performance in the ring.

## Acceptance Criteria

1. **Given** a horse with temperament "Bold" enters a ridden competition, **When** the competition score is calculated, **Then** the final score is increased by 5%
2. **Given** a horse with temperament "Nervous" enters any competition, **When** the competition score is calculated, **Then** the final score is decreased by 5%
3. **And** all 11 temperament modifiers are applied per PRD-03 §7.5 table, distinguishing between ridden and conformation competitions:
   - Spirited: +3% ridden, -2% conformation
   - Nervous: -5% ridden, -5% conformation
   - Calm: +2% ridden, +5% conformation
   - Bold: +5% ridden, +2% conformation
   - Steady: +3% ridden, +3% conformation
   - Independent: -2% ridden, -3% conformation
   - Reactive: -3% ridden, -4% conformation
   - Stubborn: -4% ridden, -3% conformation
   - Playful: +1% ridden, -1% conformation
   - Lazy: -5% ridden, 0% conformation
   - Aggressive: -3% ridden, -5% conformation
4. **And** modifiers are applied as percentage adjustment to the pre-luck score (after trait bonus, before the ±9% luck roll)
5. **And** horses without temperament (null) receive no modifier (backward compatible)
6. **And** temperament modifier stacks with existing trait bonus independently (both apply)
7. **And** minimum score preserved at 0 (existing `Math.max(0, ...)` clamp handles this)

## Tasks / Subtasks

- [x] Task 1: Create temperament competition modifier lookup (AC: #3, #5)
  - [x] 1.1 Add `TEMPERAMENT_COMPETITION_MODIFIERS` constant to `temperamentService.mjs` — object mapping all 11 types to `{ riddenModifier, conformationModifier }` decimal values
  - [x] 1.2 Add `getTemperamentCompetitionModifiers(temperament)` function — returns `{ riddenModifier, conformationModifier }` or `{ riddenModifier: 0, conformationModifier: 0 }` for null/unknown
  - [x] 1.3 Export both the constant and function
- [x] Task 2: Integrate into competition score function (AC: #1, #2, #4, #5, #6)
  - [x] 2.1 Import `getTemperamentCompetitionModifiers` in `competitionScore.mjs`
  - [x] 2.2 Add optional third parameter `showType = 'ridden'` to `calculateCompetitionScore(horse, eventType, showType = 'ridden')`
  - [x] 2.3 After `scoreWithTraitBonus` is computed (line ~78) but BEFORE the luck modifier (line ~82), apply the temperament modifier: `const scoreAfterTemperament = scoreWithTraitBonus * (1 + tempMod);`
  - [x] 2.4 Use `scoreAfterTemperament` instead of `scoreWithTraitBonus` for the luck adjustment calculation
  - [x] 2.5 Add `logger.info` for temperament modifier application (follow existing log pattern)
  - [x] 2.6 Update the final log line to include temperament modifier info
- [x] Task 3: Write comprehensive tests (AC: #1-#7)
  - [x] 3.1 Unit tests for `getTemperamentCompetitionModifiers()` — all 11 types return correct ridden and conformation values
  - [x] 3.2 Unit test — null temperament returns zero modifiers
  - [x] 3.3 Unit test — unknown string returns zero modifiers
  - [x] 3.4 Integration test — Bold horse (ridden): final score increased by 5% (AC #1)
  - [x] 3.5 Integration test — Nervous horse (ridden): final score decreased by 5% (AC #2)
  - [x] 3.6 Integration test — null temperament: score unchanged vs base (AC #5)
  - [x] 3.7 Integration test — conformation showType: Spirited gets -2% not +3%
  - [x] 3.8 Integration test — modifier stacks with trait bonus: both applied independently (AC #6)
  - [x] 3.9 Data integrity test — all 11 keys in `TEMPERAMENT_COMPETITION_MODIFIERS` match `TEMPERAMENT_TYPES`

## Dev Notes

### CRITICAL: Correct Integration File

**DO NOT modify `backend/utils/competitionLogic.mjs`**. The canonical competition scoring function is:

```
backend/utils/competitionScore.mjs
```

`calculateCompetitionScore(horse, eventType)` — takes the whole horse object, not 4 separate args.

**Pre-existing known issue (DO NOT fix as part of this story):** `competitionController.mjs` imports `calculateCompetitionScore` from `competitionLogic.mjs` instead of `competitionScore.mjs`. This is an existing mismatch unrelated to this story. The integration tests and `init-databases.mjs` correctly import from `competitionScore.mjs`.

### CRITICAL: Application Point — Pre-Luck

The scoring flow in `competitionScore.mjs` (lines 77-103):

```javascript
// After trait bonus (existing)
const scoreWithTraitBonus = baseScore + traitBonus; // ← trait bonus already added

// *** NEW: Apply temperament modifier HERE (pre-luck) ***
const temperamentMods = getTemperamentCompetitionModifiers(horse.temperament);
const tempMod =
  showType === 'conformation'
    ? temperamentMods.conformationModifier
    : temperamentMods.riddenModifier;
const scoreAfterTemperament = scoreWithTraitBonus * (1 + tempMod);

if (tempMod !== 0) {
  logger.info(
    `[calculateCompetitionScore] Horse ${horse.name || horse.id}: Temperament "${horse.temperament}" ${showType} modifier: ${(tempMod * 100).toFixed(0)}%`
  );
}

// Existing luck modifier — uses scoreAfterTemperament instead of scoreWithTraitBonus
const luckAdjustment = scoreAfterTemperament * clampedLuckModifier;
const finalScore = scoreAfterTemperament + luckAdjustment;
```

### Modifier Values as Decimals

```javascript
export const TEMPERAMENT_COMPETITION_MODIFIERS = {
  Spirited: { riddenModifier: 0.03, conformationModifier: -0.02 },
  Nervous: { riddenModifier: -0.05, conformationModifier: -0.05 },
  Calm: { riddenModifier: 0.02, conformationModifier: 0.05 },
  Bold: { riddenModifier: 0.05, conformationModifier: 0.02 },
  Steady: { riddenModifier: 0.03, conformationModifier: 0.03 },
  Independent: { riddenModifier: -0.02, conformationModifier: -0.03 },
  Reactive: { riddenModifier: -0.03, conformationModifier: -0.04 },
  Stubborn: { riddenModifier: -0.04, conformationModifier: -0.03 },
  Playful: { riddenModifier: 0.01, conformationModifier: -0.01 },
  Lazy: { riddenModifier: -0.05, conformationModifier: 0.0 },
  Aggressive: { riddenModifier: -0.03, conformationModifier: -0.05 },
};
```

### Import to Add in competitionScore.mjs

```javascript
import { getTemperamentCompetitionModifiers } from '../modules/horses/services/temperamentService.mjs';
```

The path from `backend/utils/competitionScore.mjs` to the service is:
`../modules/horses/services/temperamentService.mjs`

### Function Signature Change (Backward Compatible)

```javascript
// Before
export function calculateCompetitionScore(horse, eventType) {

// After
export function calculateCompetitionScore(horse, eventType, showType = 'ridden') {
```

`showType` defaults to `'ridden'` — all existing callers continue to work unchanged.

### Test Strategy: Math.random = 0.5 → Zero Luck

The existing `competitionScore.test.mjs` mocks `Math.random` to control luck. Use the same pattern.

With `Math.random = 0.5`:

- `luckModifier = 0.5 * 0.18 - 0.09 = 0` → zero luck adjustment

This makes temperament effects cleanly measurable. Example with `speed = stamina = intelligence = 30`:

- Base score: 90
- No traits → `scoreWithTraitBonus = 90`
- Bold (+5% ridden): `scoreAfterTemperament = 90 * 1.05 = 94.5` → final = 95
- Nervous (-5% ridden): `scoreAfterTemperament = 90 * 0.95 = 85.5` → final = 86
- null: `scoreAfterTemperament = 90` → final = 90

Tests verify these exact values when `Math.random` is mocked to 0.5.

### Test File Pattern

Follow `backend/__tests__/temperamentTrainingModifiers.test.mjs` structure from 31D-2:

- File: `backend/__tests__/temperamentCompetitionModifiers.test.mjs`
- Mock: `../utils/logger.mjs` only (competitionScore.mjs has no other external deps)
- NO Prisma mock needed (competitionScore.mjs is pure — no DB calls)
- Use `jest.spyOn(Math, 'random').mockReturnValue(0.5)` in `beforeEach`

### Files to Create

| File                                                         | Purpose                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `backend/__tests__/temperamentCompetitionModifiers.test.mjs` | Unit + integration tests for temperament competition modifiers |

### Files to Modify

| File                                                     | Change                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `backend/modules/horses/services/temperamentService.mjs` | Add `TEMPERAMENT_COMPETITION_MODIFIERS` constant + `getTemperamentCompetitionModifiers()` function |
| `backend/utils/competitionScore.mjs`                     | Import + add optional `showType` param + apply temperament modifier pre-luck                       |

### Files NOT to Modify

| File                                                                | Reason                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `backend/utils/competitionLogic.mjs`                                | Different function signature — separate legacy code, do not mix in temperament |
| `backend/modules/competition/controllers/competitionController.mjs` | Pre-existing import mismatch is out-of-scope for this story                    |
| `backend/utils/traitEffects.mjs`                                    | Separate epigenetic trait system — keep independent                            |

### Project Structure Notes

- New exports added to existing service at `backend/modules/horses/services/temperamentService.mjs` (extends 31D-1 + 31D-2)
- `temperamentService.mjs` now exports: `weightedRandomSelect`, `generateTemperament`, `TEMPERAMENT_TRAINING_MODIFIERS`, `getTemperamentTrainingModifiers`, `TEMPERAMENT_COMPETITION_MODIFIERS`, `getTemperamentCompetitionModifiers`
- ES modules only (`.mjs` extension, import/export)
- All imports must include `.mjs` extension

### Previous Story Intelligence (31D-2)

- `jest.unstable_mockModule()` must be called BEFORE any dynamic `await import()` statements
- All mock variables must be declared (`const mockFn = jest.fn()`) BEFORE `jest.unstable_mockModule()` calls
- Run tests with: `node --experimental-vm-modules ./node_modules/jest-cli/bin/jest.js __tests__/temperamentCompetitionModifiers.test.mjs --no-coverage`
- ESLint: `_` prefix for unused destructured vars in `Object.entries().map()` callbacks (e.g., `[_key, mods]`)
- The existing 31 tests in `temperamentTrainingModifiers.test.mjs` must not regress

### References

- [Source: docs/epics-physical-systems.md — Epic 31D, Story 31D-3] FR-21
- [Source: docs/product/PRD-03-Gameplay-Systems.md §7.5] Competition modifier table (11 types × ridden/conformation)
- [Source: backend/utils/competitionScore.mjs] Canonical competition scoring function — integration target
- [Source: backend/__tests__/temperamentTrainingModifiers.test.mjs] Test pattern reference from 31D-2
- [Source: backend/tests/competitionScore.test.mjs] Existing competition score test pattern (Math.random mock)
- [Source: _bmad-output/implementation-artifacts/31d-2-temperament-training-modifiers.md] Previous story learnings

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_No blockers. All 30 tests passed on first run. 17 competition/temperament suites (296 tests) — zero regressions._

### Completion Notes List

- Implemented `TEMPERAMENT_COMPETITION_MODIFIERS` (11 types × `{riddenModifier, conformationModifier}`) and `getTemperamentCompetitionModifiers()` in `temperamentService.mjs`
- Integrated into `calculateCompetitionScore()` in `competitionScore.mjs`: added optional `showType = 'ridden'` param (backward-compatible), applied modifier as `scoreWithTraitBonus * (1 + tempMod)` post-trait-bonus, pre-luck
- Luck adjustment now applies to `scoreAfterTemperament` (not `scoreWithTraitBonus`)
- 30 tests written and passing: unit coverage of all 11 types, null/unknown guards, ridden/conformation integration, trait stacking
- All ACs satisfied

### File List

- `backend/modules/horses/services/temperamentService.mjs` — modified
- `backend/utils/competitionScore.mjs` — modified
- `backend/__tests__/temperamentCompetitionModifiers.test.mjs` — created

## Change Log

- 2026-03-30: Story 31D-3 implemented. Added competition temperament modifiers to `temperamentService.mjs` and integrated into `calculateCompetitionScore()` with `showType` param. 30 tests added, 0 regressions.
