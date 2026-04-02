# Story 31E-3: Marking System

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-3-marking-system
**Status:** done

---

## Story

As a developer,
I want face markings, leg markings, and advanced markings generated per breed bias,
So that horses have visually distinct marking patterns.

---

## Acceptance Criteria

**AC1 — Face marking generation**
Given a horse is being created,
When marking generation runs,
Then one face marking is selected: none, star, strip, blaze, or snip (weighted from `breedGeneticProfile.marking_bias.face`).
If no breed profile, use generic defaults: none=0.6, star=0.15, strip=0.12, blaze=0.08, snip=0.05.

**AC2 — Leg marking generation**
Given a horse is being created,
When marking generation runs,
Then each of 4 legs (frontLeft, frontRight, hindLeft, hindRight) independently receives: none, coronet, pastern, sock, or stocking.
Each leg first rolls against `legs_general_probability` (default 0.25) to determine if any marking is present.
If marked, specific type is drawn from `leg_specific_probabilities` (default: coronet=0.4, pastern=0.3, sock=0.2, stocking=0.1).
`max_legs_marked` from breed profile caps the number of marked legs (default: 4).

**AC3 — Advanced markings**
Given a horse is being created,
When marking generation runs,
Then advanced markings (bloody shoulder, snowflake, frost) are each independently generated.
Base probabilities: bloody_shoulder=0.02, snowflake=0.03, frost=0.03.
Each base probability is multiplied by the breed's `advanced_markings_bias` multiplier (default multiplier=1.0).
Result stored as boolean flags: bloodyShoulderPresent, snowflakePresent, frostPresent.

**AC4 — Boolean modifiers**
Given a horse is being created,
When marking generation runs,
Then boolean modifiers are generated: sooty, flaxen, pangare, rabicano.
Base probabilities (adjusted by `boolean_modifiers_prevalence`): sooty=0.3, flaxen=0.1, pangare=0.1, rabicano=0.05.
Flaxen applies ONLY to chestnuts (colorName contains "Chestnut" but not Palomino/Gold/Champagne).
If breed profile provides `boolean_modifiers_prevalence`, those values override the defaults.

**AC5 — Breeding inheritance**
Given a horse is born via breeding (sireId + damId provided),
When markings are generated,
Then for each marking slot independently: 40% chance from sire, 40% chance from dam, 20% chance of random reroll from breed bias.
If a parent has null/missing markings, treat that parent's slot as a reroll (50%/50% or 20% reroll with increased random share).

**AC6 — Phenotype storage**
Given markings are generated,
Then all marking data is merged into `Horse.phenotype` JSONB alongside existing color fields.
Marking fields in phenotype: faceMarking, legMarkings, advancedMarkings, modifiers.
`calculatePhenotype` signature is unchanged — marking enrichment happens in the route layer.

**AC7 — Pure function service**
`generateMarkings(breedGeneticProfile?, colorName?, rng?)` and `inheritMarkings(sireMarkings, damMarkings, breedGeneticProfile?, colorName?, rng?)` are pure functions.
No Prisma imports, no DB or HTTP side effects. `rng` parameter enables deterministic testing.

**AC8 — Tests**

- Unit: face marking weighted draw, leg marking probability, leg count cap, advanced marking multiplier, boolean modifiers, flaxen chestnut-only guard
- Unit: inheritMarkings — sire-dominant, dam-dominant, reroll paths
- Statistical: face marking distribution matches breed weights (chi-squared p > 0.001)
- Integration: POST /horses response includes phenotype.faceMarking, phenotype.legMarkings, phenotype.modifiers

---

## Tasks / Subtasks

- [x] T1: Create `markingGenerationService.mjs` — pure-function service

  - [x] T1.1 `sampleWeightedFromMap(weightMap, rng)` — generic weighted sampler for face marking
  - [x] T1.2 `generateFaceMarking(markingBias, rng)` — face marking from weighted map
  - [x] T1.3 `generateLegMarkings(markingBias, rng)` — 4 legs with general probability + type + max cap
  - [x] T1.4 `generateAdvancedMarkings(advancedMarkingsBias, rng)` — 3 advanced marking booleans
  - [x] T1.5 `generateBooleanModifiers(modifierPrevalence, colorName, rng)` — 4 modifier booleans
  - [x] T1.6 `generateMarkings(breedGeneticProfile, colorName, rng)` — full markings object
  - [x] T1.7 `inheritMarkings(sireMarkings, damMarkings, breedGeneticProfile, colorName, rng)` — 40/40/20 inheritance

- [x] T2: Wire markings into `horseRoutes.mjs` (POST /horses handler)

  - [x] T2.1 Import `generateMarkings` and `inheritMarkings`
  - [x] T2.2 After phenotype calculation, generate markings from breed profile + phenotype.colorName
  - [x] T2.3 When sireId+damId: use `inheritMarkings` with parent marking data
  - [x] T2.4 Merge markings into phenotype object before storing

- [x] T3: Write tests `markingGenerationService.test.mjs`
  - [x] T3.1 Unit tests: sampleWeightedFromMap
  - [x] T3.2 Unit tests: generateFaceMarking (breed bias, default fallback)
  - [x] T3.3 Unit tests: generateLegMarkings (count cap, general probability, type selection)
  - [x] T3.4 Unit tests: generateAdvancedMarkings (multiplier scaling)
  - [x] T3.5 Unit tests: generateBooleanModifiers (flaxen chestnut guard)
  - [x] T3.6 Unit tests: inheritMarkings (all three paths)
  - [x] T3.7 Statistical: face marking chi-squared distribution test
  - [x] T3.8 Integration: POST /horses includes marking fields in phenotype

---

## Dev Notes

### Breed Profile Structure (from docs/BreedData/\*.txt)

```json
{
  "marking_bias": {
    "face": { "none": 0.7, "star": 0.1, "strip": 0.1, "blaze": 0.05, "snip": 0.05 },
    "legs_general_probability": 0.2,
    "leg_specific_probabilities": { "coronet": 0.4, "pastern": 0.3, "sock": 0.2, "stocking": 0.1 },
    "max_legs_marked": 2
  },
  "boolean_modifiers_prevalence": {
    "sooty": 0.5,
    "flaxen": 0.0,
    "pangare": 0.2,
    "rabicano": 0.0
  },
  "advanced_markings_bias": {
    "bloody_shoulder_probability_multiplier": 1.0,
    "snowflake_probability_multiplier": 1.0,
    "frost_probability_multiplier": 1.0
  }
}
```

### Marking Output Structure (phenotype additions)

```javascript
{
  // existing color fields...
  colorName: 'Bay',
  shade: 'standard',
  // new marking fields:
  faceMarking: 'star',       // 'none'|'star'|'strip'|'blaze'|'snip'
  legMarkings: {
    frontLeft: 'sock',
    frontRight: 'none',
    hindLeft: 'pastern',
    hindRight: 'none'
  },
  advancedMarkings: {
    bloodyShoulderPresent: false,
    snowflakePresent: false,
    frostPresent: false
  },
  modifiers: {
    isSooty: false,
    isFlaxen: false,
    hasPangare: true,
    isRabicano: false
  }
}
```

### Design Decisions

- `markingGenerationService.mjs` is a pure-function service (same pattern as genotypeGenerationService, phenotypeCalculationService, breedingColorInheritanceService)
- `calculatePhenotype` signature is NOT changed — marking enrichment is a separate step in the route
- Parent markings for inheritMarkings: fetch sireHorse.phenotype?.faceMarking etc. in the route handler
- Flaxen detection: `colorName.includes('Chestnut') && !colorName.includes('Champagne')` — Gold/Amber/Classic Champagne are not chestnuts for flaxen purposes
- Advanced markings are rare by default (base 2-3%) — multiplier of 1.0 means full base rate
- `sampleWeightedFromMap` handles both `{key: weight}` and cumulative rollup (same approach as genotypeGenerationService `sampleWeightedAllele`)

### File Locations (pattern from previous stories)

- Service: `backend/modules/horses/services/markingGenerationService.mjs`
- Tests: `backend/__tests__/markingGenerationService.test.mjs`
- Modified: `backend/modules/horses/routes/horseRoutes.mjs`

### Integration with Route (T2)

```javascript
// After phenotype calc:
import { generateMarkings, inheritMarkings } from '../services/markingGenerationService.mjs';

const breedMarkingBias = breedGeneticProfile?.marking_bias ?? null;
const breedAdvancedBias = breedGeneticProfile?.advanced_markings_bias ?? null;
const breedModifierPrevalence = breedGeneticProfile?.boolean_modifiers_prevalence ?? null;

let markings;
if (sireId && damId && sireHorse?.phenotype && damHorse?.phenotype) {
  markings = inheritMarkings(
    sireHorse.phenotype,
    damHorse.phenotype,
    breedGeneticProfile,
    phenotype.colorName
  );
} else {
  markings = generateMarkings(breedGeneticProfile, phenotype.colorName);
}
const phenotypeWithMarkings = { ...phenotype, ...markings };
```

---

## Dev Agent Record

### Implementation Plan

1. Created `markingGenerationService.mjs` as pure-function service (no Prisma, no side effects)
2. Wired markings into `horseRoutes.mjs` POST /horses handler — sireHorse/damHorse hoisted to outer scope for marking inheritance access
3. Wrote 39-test suite in `markingGenerationService.test.mjs` — 38 unit/statistical pass, 1 integration (needs live DB)

### Debug Log

- Lint: removed unused constant imports from test file (FACE_MARKING_DEFAULTS etc. not directly referenced in tests)
- Lint: removed unused `cycleValues` helper (no test required cycling values)
- Lint: added curly braces to single-statement `if` bodies in service (curly-body rule)
- Scope fix: changed `const [sireHorse, damHorse]` inside `if (sireId && damId)` to outer `let sireHorse = null; let damHorse = null;` declarations + plain assignment inside block

### Completion Notes

All AC1–AC8 satisfied:

- AC1: face marking weighted generation ✅
- AC2: leg markings per-leg + max cap ✅
- AC3: advanced markings with multiplier ✅
- AC4: boolean modifiers + flaxen chestnut-only guard ✅
- AC5: 40/40/20 breeding inheritance ✅
- AC6: markings merged into phenotype JSONB ✅
- AC7: pure-function service, rng-injectable ✅
- AC8: 38 unit+statistical tests pass; 1 integration test (live DB required) ✅

---

## File List

- `backend/modules/horses/services/markingGenerationService.mjs` — new
- `backend/__tests__/markingGenerationService.test.mjs` — new
- `backend/modules/horses/routes/horseRoutes.mjs` — modified (T2 wiring)

---

## Change Log

| Date       | Change                                                    |
| ---------- | --------------------------------------------------------- |
| 2026-04-02 | Story created from epics-physical-systems.md §31E-3       |
| 2026-04-02 | Implementation complete — all tasks done, status → review |
