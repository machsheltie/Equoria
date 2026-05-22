# Apply Epigenetic Traits at Birth

> **Accuracy note (2026-05-22):** This document was rewritten to match the
> canonical at-birth epigenetics implementation as it actually exists in the
> codebase: `backend/utils/applyEpigeneticTraitsAtBirth.mjs`, wired into
> `backend/modules/horses/services/foalingService.mjs#createFoalFromPregnancy`.
> Property and field names below reflect the real code (e.g. `peopleTrusting`
> camelCase, `epigeneticModifiers` JSONB field). This is the ONLY canonical
> at-birth trait path; there is no other competing implementation.

## Overview

The `applyEpigeneticTraitsAtBirth()` function assigns epigenetic traits to a
foal at birth based on the mare's condition, lineage analysis, and breeding
circumstances. It is **synchronous** (no database calls of its own) and is
called once during foal materialization by the foaling service.

- **Implementation:** `backend/utils/applyEpigeneticTraitsAtBirth.mjs`
- **Caller:** `backend/modules/horses/services/foalingService.mjs#createFoalFromPregnancy`
- **Tests:** `backend/tests/applyEpigeneticTraitsAtBirth.test.mjs`,
  `backend/tests/applyEpigeneticTraitsAtBirthUnit.test.mjs`

## Function Signature

```javascript
applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality, stressLevel });
```

### Parameters

- **mare** (Object, required): Mare object. Used for `mare.stressLevel` as a
  fallback when the explicit `stressLevel` argument is not provided. Throws if
  `mare` is missing.
- **lineage** (Array, optional): Array of ancestor objects with discipline
  information. Used for inbreeding and discipline-specialization analysis.
- **feedQuality** (number, optional): Feed quality score (0-100). Defaults to
  `50` when undefined.
- **stressLevel** (number, optional): Mare's stress level override (0-100).
  When undefined, falls back to `mare.stressLevel`, then to `50`.

### Returns

```javascript
{
  positive: string[],  // Array of positive trait names
  negative: string[]   // Array of negative trait names
}
```

Duplicates are removed from each array before returning.

## Trait Assignment Logic

### 1. Low Stress + Premium Feed Conditions

**Conditions**: Mare stress ≤ 20 AND feed quality ≥ 80

**Traits Assigned**:

- `resilient` (75% chance) — Stress resistance and recovery bonuses
- `peopleTrusting` (60% chance) — Enhanced bonding and handler cooperation

### 2. Inbreeding Detection

**Detection**: Common ancestors appearing more than once in `lineage`
(matched by ancestor `id`). Severity is keyed on the maximum repeat count of
any single ancestor.

**Severity Levels**:

- **High**: an ancestor appears 4+ times
- **Moderate**: an ancestor appears exactly 3 times
- **Low**: an ancestor appears exactly 2 times

**Traits Assigned** (negative):

- `fragile` — Higher injury risk, slower recovery
  - High: 80% · Moderate: 50% · Low: 25%
- `reactive` — Increased stress sensitivity and unpredictability
  - High: 70% · Moderate: 40% · Low: 20%
- `low_immunity` — Weakened immune system and health issues
  - High: 60% · Moderate: 35% · Low: 15%

### 3. Discipline Specialization

**Conditions**: 3+ ancestors share the same discipline.

**Detection Methods** (each contributes a count per ancestor):

1. Direct `discipline` field on the ancestor object.
2. `mostCompetedDiscipline` field on the ancestor object.
3. Highest-scoring discipline from the ancestor's `disciplineScores` object.

> Note: the foaling service's `gatherLineage()` derives each ancestor's
> `discipline` as the top-scoring entry of that ancestor's `disciplineScores`,
> and also passes through the raw `disciplineScores`. `mostCompetedDiscipline`
> is supported by the analyzer but is not currently populated by
> `gatherLineage()`.

**Traits Assigned** (positive):

- `discipline_affinity_<discipline>` (70% chance) — discipline name is
  lowercased with spaces replaced by underscores (e.g. a `Show Jumping`
  specialization yields `discipline_affinity_show_jumping`).
- `legacy_talent` (40% chance) — only when 4+ ancestors share the discipline.

### 4. Additional Stress / Nutrition Effects

- **High stress** (≥ 80): 40% chance for `nervous` (skipped if `reactive` was
  already added during inbreeding analysis).
- **Poor nutrition** (feed quality ≤ 30): 30% chance for `low_immunity`
  (skipped if `low_immunity` was already added).

## How It Is Wired (Real Pipeline)

`createFoalFromPregnancy({ damId, options })` in `foalingService.mjs` is the
canonical caller. The relevant flow:

1. Load the in-foal mare (`dam`) and the recorded pregnancy sire.
2. Build `mareStats` from the dam: `stressLevel` (default 50), `bondScore`
   (default 50), `healthStatus` (default `'Good'`).
3. `lineage = await gatherLineage(sireId, damId, 3)` — walks up to 3
   generations of ancestry (cycle-guarded), deriving each ancestor's primary
   discipline from its `disciplineScores`.
4. `feedQuality = assessFeedQualityFromMare(mareStats)` — maps the mare's
   `healthStatus` to a base score (Excellent 90 / Good 75 / Fair 55 / Poor 30 /
   Critical 15), then adjusts ±10/±5 by `bondScore`, clamped to 0-100.
5. Call `applyEpigeneticTraitsAtBirth({ mare: mareStats, lineage, feedQuality, stressLevel })`.
6. **Pregnancy bonus rolls (B5):** the foaling job may pass
   `options.positiveTraitChance` / `options.negativeTraitChance` (0-100
   percent points) plus an optional `options.rng`. Independent rolls may append
   one bonus trait from the pregnancy bonus pools on top of the at-birth result.
7. The combined positive/negative arrays are written to the new foal's
   `epigeneticModifiers` JSONB field as `{ positive, negative, hidden: [] }`.

```javascript
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';

const epigeneticTraits = applyEpigeneticTraitsAtBirth({
  mare: mareStats,
  lineage,
  feedQuality,
  stressLevel,
});

// later, written into the created horse:
const horseData = {
  // ...
  epigeneticModifiers: {
    positive: positiveTraits, // at-birth positives (+ any pregnancy bonus)
    negative: negativeTraits, // at-birth negatives (+ any pregnancy bonus)
    hidden: [],
  },
};
```

`createFoalFromPregnancy` returns `{ foal, appliedTraits, breedingAnalysis }`,
where `breedingAnalysis` exposes `mareStress`, `feedQuality`, `lineageCount`,
and the pregnancy bonus chances for diagnostics.

## Usage Examples

### Direct Function Call

```javascript
import { applyEpigeneticTraitsAtBirth } from '../utils/applyEpigeneticTraitsAtBirth.mjs';

const mare = { id: 1, stressLevel: 15, healthStatus: 'Excellent' };

const result = applyEpigeneticTraitsAtBirth({
  mare,
  feedQuality: 85,
  stressLevel: 15,
});

console.log(result);
// e.g. { positive: ['resilient', 'peopleTrusting'], negative: [] }
```

### With Lineage Specialization

```javascript
const lineage = [
  { id: 1, discipline: 'Racing' },
  { id: 2, discipline: 'Racing' },
  { id: 3, discipline: 'Racing' },
  { id: 4, discipline: 'Dressage' },
];

const result = applyEpigeneticTraitsAtBirth({
  mare,
  lineage,
  feedQuality: 60,
  stressLevel: 30,
});
// Possible result: { positive: ['discipline_affinity_racing'], negative: [] }
```

### With Inbreeding

```javascript
const inbredLineage = [
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' }, // 4 repeats → high severity
  { id: 101, name: 'Other Horse' },
];

const result = applyEpigeneticTraitsAtBirth({
  mare,
  lineage: inbredLineage,
  feedQuality: 50,
  stressLevel: 50,
});
// Possible result: { positive: [], negative: ['fragile', 'reactive', 'low_immunity'] }
```

## Trait Vocabulary

### Positive Traits

- **resilient**: Stress resistance, faster recovery, competition bonuses
- **peopleTrusting**: Enhanced bonding, handler cooperation, crowd comfort
- **legacy_talent**: Exceptional inherited talent (strong shared lineage)
- **discipline*affinity*\<discipline\>**: Specialization bonus for the
  inherited discipline (e.g. `discipline_affinity_racing`,
  `discipline_affinity_dressage`, `discipline_affinity_show_jumping`)

### Negative Traits

- **fragile**: Higher injury risk, performance inconsistency
- **reactive**: Stress sensitivity, unpredictable behavior
- **low_immunity**: Health vulnerabilities, slower recovery
- **nervous**: Stress accumulation, performance penalties

## Database Storage

Traits are persisted on the foal's `epigeneticModifiers` JSONB field (camelCase
in the Prisma model):

```javascript
epigeneticModifiers: {
  positive,
  negative,
  hidden: [], // some traits may be revealed later via discovery
}
```

## Key Characteristics

1. **Probabilistic**: traits are rolled, not guaranteed.
2. **Duplicate-safe**: each output array is de-duplicated.
3. **Graceful inputs**: missing/empty lineage and missing discipline data are
   handled without throwing (only a missing `mare` throws).
4. **Multiple discipline-detection paths**: `discipline`,
   `mostCompetedDiscipline`, and `disciplineScores`.
5. **Severity-scaled inbreeding effects**.
6. **Synchronous and fast**: no DB calls; suitable for the real-time foaling
   workflow. Lineage analysis is O(n) in the number of ancestors.
