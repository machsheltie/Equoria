# Story 31D.2: Training Temperament Modifiers

Status: done

## Story

As a developer,
I want temperament to modify training XP and discipline score gains,
So that horse personality meaningfully impacts training progression.

## Acceptance Criteria

1. **Given** a horse with temperament "Stubborn" trains, **When** the training session completes, **Then** XP gained is reduced by 15% and discipline score gain is reduced by 10%
2. **Given** a horse with temperament "Calm" trains, **When** the training session completes, **Then** XP gained is increased by 5% and discipline score gain is increased by 10%
3. **And** all 11 temperament modifiers are applied per PRD-03 §7.4 table:
   - Spirited: +10% XP, +5% score
   - Nervous: -10% XP, -5% score
   - Calm: +5% XP, +10% score
   - Bold: +5% XP, +5% score
   - Steady: +5% XP, +10% score
   - Independent: -5% XP, 0% score
   - Reactive: 0% XP, -5% score
   - Stubborn: -15% XP, -10% score
   - Playful: +5% XP, -5% score
   - Lazy: -20% XP, -15% score
   - Aggressive: -10% XP, -5% score
4. **And** horses without temperament (null) receive no modifier (backward compatible)
5. **And** modifiers are applied as multipliers after base calculation (not flat additions)
6. **And** temperament modifiers stack multiplicatively with existing trait effects (both apply independently)
7. **And** minimum discipline score gain of 1 is preserved after all modifiers
8. **And** minimum XP gain of 1 is preserved after all modifiers

## Tasks / Subtasks

- [x] Task 1: Create temperament training modifier lookup (AC: #3, #4)
  - [x] 1.1 Add `TEMPERAMENT_TRAINING_MODIFIERS` constant to `temperamentService.mjs` — object mapping all 11 types to `{ xpModifier, scoreModifier }` decimal values
  - [x] 1.2 Add `getTemperamentTrainingModifiers(temperament)` function — returns `{ xpModifier, scoreModifier }` or `{ xpModifier: 0, scoreModifier: 0 }` for null/unknown
  - [x] 1.3 Export both the constant and function
- [x] Task 2: Integrate into training controller (AC: #1, #2, #5, #6, #7, #8)
  - [x] 2.1 Import `getTemperamentTrainingModifiers` in `trainingController.mjs`
  - [x] 2.2 After trait effects are applied to `disciplineScoreIncrease` (line ~201), apply temperament score modifier: `disciplineScoreIncrease = Math.round(disciplineScoreIncrease * (1 + scoreModifier))`
  - [x] 2.3 After trait effects are applied to `baseXp` (line ~295), apply temperament XP modifier: `baseXp = Math.round(baseXp * (1 + xpModifier))`
  - [x] 2.4 Ensure `Math.max(1, ...)` floor is applied AFTER temperament modifier (preserve existing min-1 logic)
  - [x] 2.5 Add logger.info for temperament modifier application (follow existing pattern)
  - [x] 2.6 Include temperament modifier details in the training response `traitEffects` or a new `temperamentEffects` field
- [x] Task 3: Write comprehensive tests (AC: #1-#8)
  - [x] 3.1 Unit tests for `getTemperamentTrainingModifiers()` — all 11 types return correct values
  - [x] 3.2 Unit test — null temperament returns zero modifiers
  - [x] 3.3 Unit test — unknown string temperament returns zero modifiers
  - [x] 3.4 Integration test — Stubborn horse gets -15% XP, -10% score (AC #1)
  - [x] 3.5 Integration test — Calm horse gets +5% XP, +10% score (AC #2)
  - [x] 3.6 Integration test — Lazy horse (worst penalties) still gets minimum 1 XP and 1 score
  - [x] 3.7 Integration test — temperament modifier stacks with trait effects (both apply)
  - [x] 3.8 Integration test — null temperament horse trains with no modifier (backward compat)
  - [x] 3.9 Data integrity test — all 11 types in `TEMPERAMENT_TRAINING_MODIFIERS` match `TEMPERAMENT_TYPES` array

## Dev Notes

### CRITICAL: Modifier Application Order

The training controller applies modifiers in this order:

1. Base value calculated (disciplineScore = 5, XP = 5)
2. Trait effects applied via `traitEffects.trainingXpModifier` (existing, lines 191-198 and 293-295)
3. **NEW: Temperament modifier applied** (multiply again after trait effects)
4. `Math.max(1, ...)` floor applied (existing, line 200 and implicit for XP)

Temperament and trait modifiers are **independent multipliers** — they do NOT combine into one modifier. Apply them sequentially. Example for a Lazy horse (+eager_learner trait):

- Base: 5
- Trait effect: 5 \* (1 + 0.25) = 6.25 → 6
- Temperament: 6 \* (1 + (-0.20)) = 4.8 → 5
- Floor: max(1, 5) = 5

### CRITICAL: Do NOT Modify traitEffects.mjs

The trait effects system (`backend/utils/traitEffects.mjs`) handles epigenetic trait modifiers. Temperament is a **separate system**. Do NOT add temperament modifiers to `traitEffects.mjs` or mix them into `getCombinedTraitEffects()`. Keep the systems independent.

### CRITICAL: Horse Object Already Has Temperament

The horse object fetched in `trainHorse()` at line ~156 already includes `horse.temperament` from the database. No additional query is needed. Just read `horse.temperament` and pass it to `getTemperamentTrainingModifiers()`.

### Modifier Values as Decimals

Store modifiers as decimals for direct multiplication:

```javascript
const TEMPERAMENT_TRAINING_MODIFIERS = {
  Spirited: { xpModifier: 0.1, scoreModifier: 0.05 },
  Nervous: { xpModifier: -0.1, scoreModifier: -0.05 },
  Calm: { xpModifier: 0.05, scoreModifier: 0.1 },
  Bold: { xpModifier: 0.05, scoreModifier: 0.05 },
  Steady: { xpModifier: 0.05, scoreModifier: 0.1 },
  Independent: { xpModifier: -0.05, scoreModifier: 0.0 },
  Reactive: { xpModifier: 0.0, scoreModifier: -0.05 },
  Stubborn: { xpModifier: -0.15, scoreModifier: -0.1 },
  Playful: { xpModifier: 0.05, scoreModifier: -0.05 },
  Lazy: { xpModifier: -0.2, scoreModifier: -0.15 },
  Aggressive: { xpModifier: -0.1, scoreModifier: -0.05 },
};
```

### Integration Points (Exact Locations)

**File:** `backend/modules/training/controllers/trainingController.mjs`

**Import:** Add at top with other imports:

```javascript
import { getTemperamentTrainingModifiers } from '../../horses/services/temperamentService.mjs';
```

**Discipline Score Modifier** — Insert after line ~201 (after trait effects, before `Math.max(1, ...)`):

```javascript
// Apply temperament modifier to discipline score
const temperamentMods = getTemperamentTrainingModifiers(horse.temperament);
if (temperamentMods.scoreModifier !== 0) {
  disciplineScoreIncrease = Math.round(
    disciplineScoreIncrease * (1 + temperamentMods.scoreModifier)
  );
  logger.info(
    `[trainingController.trainHorse] Temperament "${horse.temperament}" score modifier: ${(temperamentMods.scoreModifier * 100).toFixed(0)}%`
  );
}
// Ensure minimum gain of 1 point (existing line)
disciplineScoreIncrease = Math.max(1, disciplineScoreIncrease);
```

**XP Modifier** — Insert after line ~295 (after trait XP modifier):

```javascript
// Apply temperament modifier to XP
if (temperamentMods.xpModifier !== 0) {
  baseXp = Math.round(baseXp * (1 + temperamentMods.xpModifier));
  logger.info(
    `[trainingController.trainHorse] Temperament "${horse.temperament}" XP modifier: ${(temperamentMods.xpModifier * 100).toFixed(0)}%`
  );
}
baseXp = Math.max(1, baseXp);
```

**Response Enhancement** — Add temperament effects to the return object (line ~350+):

```javascript
temperamentEffects: horse.temperament ? {
  temperament: horse.temperament,
  xpModifier: temperamentMods.xpModifier,
  scoreModifier: temperamentMods.scoreModifier,
} : null,
```

### Service Pattern (temperamentService.mjs)

Add to the existing `backend/modules/horses/services/temperamentService.mjs` file created in 31D-1. Do NOT create a new file. The service already exports `generateTemperament` and `weightedRandomSelect`. Add the new exports alongside them.

### Test File Pattern

Follow `backend/__tests__/temperamentAssignment.test.mjs` structure from 31D-1:

- File: `backend/__tests__/temperamentTrainingModifiers.test.mjs`
- Mock: Prisma client, logger, horseModel, userModel (for `addXpToUser`)
- Test real service logic with real modifier values
- For integration tests, mock the training controller's dependencies but use real temperament modifier logic

### Files to Create

| File                                                      | Purpose                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `backend/__tests__/temperamentTrainingModifiers.test.mjs` | Unit + integration tests for temperament training modifiers |

### Files to Modify

| File                                                          | Change                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `backend/modules/horses/services/temperamentService.mjs`      | Add `TEMPERAMENT_TRAINING_MODIFIERS` constant + `getTemperamentTrainingModifiers()` function |
| `backend/modules/training/controllers/trainingController.mjs` | Import + apply temperament modifiers to discipline score and XP                              |

### Files NOT to Modify

| File                                                   | Reason                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `backend/utils/traitEffects.mjs`                       | Separate system — do not mix temperament into trait effects |
| `backend/modules/horses/data/breedGeneticProfiles.mjs` | Data already complete from 31A/31D-1                        |
| `backend/models/horseModel.mjs`                        | No schema changes needed                                    |
| `backend/utils/temperamentDrift.mjs`                   | Legacy — do not touch                                       |

### Project Structure Notes

- New function added to existing service at `backend/modules/horses/services/temperamentService.mjs`
- New test file at `backend/__tests__/temperamentTrainingModifiers.test.mjs`
- ES modules only (`.mjs` extension, import/export)
- All imports must include `.mjs` extension
- The `temperamentMods` variable should be computed once and reused for both score and XP modifiers

### Previous Story Intelligence (31D-1)

- `temperamentService.mjs` already imports `BREED_GENETIC_PROFILES` and `TEMPERAMENT_TYPES` from `breedGeneticProfiles.mjs`
- 27 tests pass in `temperamentAssignment.test.mjs` — do not break them
- ESLint requires `_` prefix for unused destructured variables (e.g., `[_type, weight]`)
- Jest requires `--experimental-vm-modules` flag for ESM
- Pre-existing test suite failures (6 suites) are unrelated to our work

### References

- [Source: docs/epics-physical-systems.md — Epic 31D, Story 31D-2] FR-20
- [Source: docs/epics-physical-systems.md — Epic 31D, Story 31D-2] PRD-03 §7.4 training modifier table
- [Source: backend/modules/training/controllers/trainingController.mjs] Training flow: lines 187-322
- [Source: backend/utils/traitEffects.mjs] Existing trait modifier system (do NOT modify)
- [Source: backend/modules/horses/services/temperamentService.mjs] 31D-1 temperament service (extend this file)
- [Source: _bmad-output/implementation-artifacts/31d-1-temperament-data-model-and-assignment.md] Previous story learnings

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Added `TEMPERAMENT_TRAINING_MODIFIERS` constant and `getTemperamentTrainingModifiers()` function to `temperamentService.mjs`. All 11 types mapped to decimal XP/score modifiers per PRD-03 §7.4. Null/unknown temperament returns zero modifiers (backward compatible).
- Integrated into `trainingController.mjs`: temperament modifier applied after trait effects for both discipline score and XP. Both use `Math.round()` then `Math.max(1, ...)` floor. New `temperamentEffects` field added to training response.
- 31 tests pass across unit and integration test suites. Pre-existing test suite failures (chi-squared flakiness in temperamentAssignment) confirmed unrelated to this story.

### Change Log

- 2026-03-27: Implemented Story 31D-2 — temperament training modifiers. Added constant + function to temperamentService, integrated into trainingController, 31 tests written and passing.

### File List

- `backend/modules/horses/services/temperamentService.mjs` (modified — added `TEMPERAMENT_TRAINING_MODIFIERS`, `getTemperamentTrainingModifiers`)
- `backend/modules/training/controllers/trainingController.mjs` (modified — import + apply temperament modifiers to score and XP; added `temperamentEffects` to response)
- `backend/__tests__/temperamentTrainingModifiers.test.mjs` (created — 31 unit + integration tests)
