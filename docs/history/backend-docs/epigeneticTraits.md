# Epigenetic Trait Definitions & `calculateEpigeneticTraits` (legacy calculator)

> **Accuracy note (2026-05-22, Equoria-hw8cr):** This document was reconciled
> with the code as it actually exists. The key correction: the
> `calculateEpigeneticTraits()` function in `backend/utils/epigeneticTraits.mjs`
> is **NOT the production breeding/at-birth path.** It has no production
> caller — only `backend/examples/` and tests invoke it. The live at-birth
> trait path is `applyEpigeneticTraitsAtBirth()` (a different model entirely).
> The only parts of `epigeneticTraits.mjs` wired into production are its
> definition lookups (`getTraitDefinition`, `getTraitsByType`), consumed by the
> trait-definitions API in `traitController`.
>
> See **["Canonical / related systems"](#canonical--related-systems)** below
> for where the real behavior lives.

## What this module actually is

`backend/utils/epigeneticTraits.mjs` provides two things:

1. **`TRAIT_DEFINITIONS`** — a static map of trait metadata (type, rarity,
   conflicts, description, category). This IS used in production: the
   trait-definitions endpoint (`getTraitDefinitions` in
   `backend/modules/traits/controllers/traitController.mjs`) serves these to
   the API via `getTraitsByType` + `getTraitDefinition`.
2. **`calculateEpigeneticTraits(params)`** — a legacy pure-function breeding
   calculator. **It is not called from any production code path.** The live
   foal-birth trait assignment uses `applyEpigeneticTraitsAtBirth()` instead
   (see the canonical doc cross-linked below). Treat the
   `calculateEpigeneticTraits` description in this file as documentation of a
   dormant utility, not the shipping breeding mechanic.

## Canonical / related systems

The epigenetics behavior the game actually runs is spread across several
modules. This doc covers only the definition map + legacy calculator; the
real behavior is documented elsewhere:

- **At-birth trait assignment (CANONICAL live path):**
  `backend/utils/applyEpigeneticTraitsAtBirth.mjs`, wired into
  `backend/modules/horses/services/foalingService.mjs#createFoalFromPregnancy`.
  Model: mare stress + feed quality, 3-generation lineage **inbreeding**
  analysis, and **discipline-specialization** affinity
  (`discipline_affinity_<discipline>`, `legacy_talent`). Documented in
  `docs/history/backend-docs/apply-epigenetic-traits-at-birth.md`
  (Equoria-pe6rb). That doc is the single source of truth for at-birth traits.
- **Post-birth trait revelation (LIVE):**
  `backend/utils/traitEvaluation.mjs#evaluateTraitRevelation`, invoked nightly
  by `backend/services/cronJobs.mjs` (`evaluateFoalTraits`). This is what
  reveals hidden rare traits as a foal develops, and persists them onto
  `horse.epigeneticModifiers`.
- **Ultra-rare / exotic traits (LIVE):** `backend/utils/ultraRareTraits.mjs`
  (e.g. `phoenix-born`, `iron-willed`, `empathic-mirror`, `fey-kissed`) with
  mechanical effects in `backend/utils/ultraRareMechanicalEffects.mjs`.
- **Behavioral epigenetic-flag layer (LIVE):**
  `backend/config/epigeneticFlagDefinitions.mjs` +
  `backend/utils/epigeneticFlags.mjs` /
  `backend/utils/epigeneticFlagInfluence.mjs` (tracked by Equoria-yzqhj).
- **Competition trait scoring (LIVE):**
  `backend/utils/traitCompetitionImpact.mjs` and
  `backend/utils/traitEffects.mjs`, both consumed by
  `backend/logic/simulateCompetition.mjs`.

## Trait vocabulary (camelCase project standard)

The project standard is **camelCase** trait keys. `TRAIT_DEFINITIONS` in this
module follows it (`trainabilityBoost`, `legendaryBloodline`,
`weatherImmunity`, `eagerLearner`, `easilyOverwhelmed`, …).

> **Known casing drift (tracked by Equoria-9o3n7 / Equoria-6s4p5):** the rare
> traits are spelled inconsistently across the parallel maps — e.g.
> `weatherImmunity`/`legendaryBloodline` (camelCase) here, but
> `weather_immunity`/`legendary_bloodline` (snake_case) in
> `traitEvaluation.mjs` and partly in `traitCompetitionImpact.mjs` /
> `traitEffects.mjs`. Because the live emit→score path uses the snake spelling,
> a camelCase trait stored on a horse may not earn the matching competition
> bonus. Unifying the spelling is owned by Equoria-9o3n7; the current state is
> locked by the sentinel
> `backend/modules/traits/__tests__/rareTraitRoster.sentinel.test.mjs`.

### Trait categories in `TRAIT_DEFINITIONS`

#### Positive traits (examples)

- **resilient**: Faster stress recovery, improved training consistency
- **calm**: Reduced stress accumulation, improved focus
- **intelligent**: Accelerated learning, improved skill retention
- **bold** / **confident**: Enhanced competition performance, adaptability
- **eagerLearner**: Training efficiency bonus
- **trainabilityBoost**: Major training efficiency bonus (rare)

#### Negative traits (examples)

- **nervous**: Increased stress sensitivity
- **fragile**: Higher injury risk
- **lazy**: Reduced training efficiency
- **fearful**: Spook-prone behavior under stress
- **easilyOverwhelmed**: Slower recovery from chaotic settings

#### Rare traits

- **legendaryBloodline**: Exceptional heritage (legendary rarity)
- **weatherImmunity**: Environmental/weather resistance (rare)
- **trainabilityBoost**: Training efficiency bonus (rare)

> **Removed (2026-05-22, Equoria-6s4p5 / hw8cr):** `fire_resistance`,
> `water_phobia`, and `night_vision` were previously listed here as rare
> traits. `fire_resistance` and `water_phobia` exist in **no code anywhere** —
> they were doc-only ghosts and are removed. `night_vision` exists only as a
> snake_case key in `traitEvaluation.mjs` + `traitCompetitionImpact.mjs` (the
> revelation/competition path); it is NOT part of this module's
> `TRAIT_DEFINITIONS` and is therefore not documented here. (A historical
> `DEV_NOTES` entry — "Environmental Trait Cleanup: Removed game-inappropriate
> traits weatherImmunity, fireResistance, waterPhobia, nightVision" — was never
> fully carried out across all maps; weatherImmunity and the snake-case
> night_vision survived. Full unification is Equoria-9o3n7.)

### Trait properties

Each entry in `TRAIT_DEFINITIONS` has:

- **type**: `positive` | `negative`
- **rarity**: `common` | `rare` | `legendary`
- **conflicts**: array of incompatible trait keys
- **description**: human-readable text
- **category**: e.g. `epigenetic`

## Legacy calculator: `calculateEpigeneticTraits(params)`

> Reminder: dormant utility — **not** wired into the breeding path. Documented
> for completeness of the module surface only.

### Parameters

```javascript
{
  damTraits: string[],        // Dam's traits (required)
  sireTraits: string[],       // Sire's traits (required)
  damBondScore: number,       // Dam's bonding score 0-100 (required)
  damStressLevel: number,     // Dam's stress level 0-100 (required)
  seed?: number               // Optional seed for deterministic results
}
```

### Returns

```javascript
{
  positive: string[],         // Visible positive traits
  negative: string[],         // Visible negative traits
  hidden: string[]            // Hidden traits (to be discovered later)
}
```

### Behavior summary

- Common traits ~50% base chance, rare ~15%, legendary ~5%.
- Bonding score and stress level shift positive/negative probabilities.
- Environmental trait pools (`ENVIRONMENTAL_TRAITS`) can emit extra traits when
  `(bondScore - stressLevel)` is strongly positive or negative.
- Conflicts are auto-resolved (e.g. `calm` vs `nervous`, `resilient` vs
  `fragile`, `bold` vs `nervous`).

The exact thresholds in code (`epigeneticTraits.mjs`) are the authority; the
ranges above are descriptive. Validation throws on missing/out-of-range params.

## Live utility functions (consumed by `traitController`)

### `getTraitDefinition(trait)`

Returns the `TRAIT_DEFINITIONS` entry for a trait (type, rarity, conflicts,
description, category) or `null`.

```javascript
const def = getTraitDefinition('resilient');
// { type: 'positive', rarity: 'common', conflicts: ['fragile'], ... }
```

### `getTraitsByType(type)`

Returns all trait keys of the given type (`'positive' | 'negative' | 'all'`).

```javascript
const positiveTraits = getTraitsByType('positive');
```

### `checkTraitConflict(trait1, trait2)`

Returns whether two traits conflict.

## Database integration

Traits are stored on the horse's `epigeneticModifiers` JSONB field
(`{ positive, negative, hidden }`). Reads of this field must guard against
`null` / non-array shapes per `.claude/rules/CONTRIBUTING.md` (the JSONB type
guard pattern). The legacy snippet that referenced an `epigeneticTraits`
column has been removed — the canonical field name is `epigeneticModifiers`.

## Testing

- Legacy calculator tests: `backend/tests/epigeneticTraits.test.mjs`.
- Rare-trait roster single-source-of-truth sentinel:
  `backend/modules/traits/__tests__/rareTraitRoster.sentinel.test.mjs`
  (Equoria-6s4p5) — asserts the doc-only ghosts have zero code presence and
  pins the known casing split.
- For the LIVE at-birth and revelation behavior, see the test suites listed in
  the canonical docs cross-linked above.
