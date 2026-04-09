# Story 31E-3: Marking System

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-3-marking-system
**Status:** done

---

## Story

As a developer,
I want face markings, leg markings, and advanced markings generated per breed bias,
So that horses have visually distinct marking patterns stored alongside their coat color.

---

## Acceptance Criteria

**AC1 — Face marking**
Given a horse is being created,
When the marking generation runs,
Then one face marking is selected: none, star, strip, blaze, or snip — from breed `marking_bias.face`.

**AC2 — Leg markings**
Given a horse is being created,
When leg markings are generated,
Then each of 4 legs independently receives: none, coronet, pastern, sock, or stocking — from `marking_bias.legs_general_probability` and `leg_specific_probabilities`.

**AC3 — Advanced markings**
Given the horse's breed has advanced marking probabilities,
When advanced markings are generated,
Then bloody shoulder, snowflake, frost are generated using breed probability multipliers.

**AC4 — Breeding inheritance**
Given a foal is born via breeding,
When markings are generated,
Then 40% chance of inheriting sire's marking, 40% chance of dam's marking, 20% random reroll from breed bias.

**AC5 — Boolean modifiers**
Given a horse's color is determined,
When boolean modifiers are applied,
Then sooty (30% default), flaxen (10% default — chestnuts only), pangare (10% default), rabicano (5% default) are generated — adjusted by breed-specific prevalence.

**AC6 — Storage**
Given all markings are generated,
When the horse record is saved,
Then all marking data is stored in `Horse.phenotype` JSONB alongside color data.

---

## Tasks / Subtasks

- [x] T1: Create `markingGenerationService.mjs`
  - [x] T1.1: `sampleWeightedFromMap(weightMap, rng)` — weighted random selection from a probability map
  - [x] T1.2: `generateFaceMarking(breedProfile, rng)` — breed-biased face marking selection
  - [x] T1.3: `generateLegMarkings(breedProfile, rng)` — 4 independent leg markings with general probability + specific weights + max_legs_marked cap
  - [x] T1.4: `generateAdvancedMarkings(breedProfile, rng)` — bloody shoulder, snowflake, frost with breed multipliers
  - [x] T1.5: `generateBooleanModifiers(colorName, breedProfile, rng)` — sooty, flaxen (chestnut-only), pangare, rabicano with breed prevalence
  - [x] T1.6: `generateMarkings(breedProfile, colorName, rng)` — full marking generation pipeline
  - [x] T1.7: `inheritMarkings(sireMarkings, damMarkings, breedProfile, rng)` — 40/40/20 inheritance
- [x] T2: Wire `generateMarkings` / `inheritMarkings` into horse creation
- [x] T3: Write tests (~43)
  - [x] T3.1: `sampleWeightedFromMap` — 6 tests (key selection, rng boundaries, normalisation)
  - [x] T3.2: `generateFaceMarking` — 4 tests (valid marking, breed bias, high-star weight distribution, statistical chi-squared)
  - [x] T3.3: `generateLegMarkings` — 6 tests (4 legs generated, valid types, general-probability=0 = none, max_legs_marked cap)
  - [x] T3.4: `generateAdvancedMarkings` — 6 tests (all 3 flags, multiplier=0, rng=0, rng=1, negative clamp, amplification)
  - [x] T3.5: `generateMarkings` — 4 tests (all required fields, null breed profile, undefined colorName)
  - [x] T3.6: `inheritMarkings` — 8 tests (sire inherit <0.4, dam inherit 0.4–0.8, random reroll ≥0.8, isFlaxen propagation, null parent fallback)
  - [x] T3.7: `generateBooleanModifiers` — sooty, flaxen constraints, pangare, rabicano, breed prevalence overrides
  - [x] T3.8: Integration — `POST /api/v1/horses` phenotype includes faceMarking, legMarkings, advancedMarkings, modifiers

---

## Dev Notes

### Discovered During Development

- **lint-staged + Windows stash pop failure with rollup.win32-x64-msvc.node.** Workaround: ensure all files linted before committing (no unstaged changes during commit). This recurred in 31E-4 as well. Root cause: native binary file locked by running process during git stash pop.
- **eqeqeq**: Use strict equality (`!==`, `===`) — ESLint enforces this. Loose `!=` triggers lint error.
- **catch (error)**: Reference `error.message` in logger call. Do NOT use `catch (_error)` — triggers no-unused-vars.

### isFlaxen Constraint

`isFlaxen` must ONLY be `true` for horses whose `colorName` contains "Chestnut" (case-sensitive substring check). If a parent is chestnut with `isFlaxen: true`, a non-chestnut foal must NOT inherit `isFlaxen: true` — the modifier resets to false if the foal's color is not chestnut.

### File Locations

- Service: `backend/modules/horses/services/markingGenerationService.mjs`
- Tests: `backend/__tests__/markingGenerationService.test.mjs`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: Face marking selected from breed bias (5 options)
- AC2: 4 independent leg markings with general-probability gate + specific weights + max_legs_marked cap
- AC3: Advanced markings with multiplier-based probability (bloody shoulder, snowflake, frost)
- AC4: 40/40/20 inheritance distribution tested and validated
- AC5: Boolean modifiers with chestnut-only constraint for flaxen
- AC6: All marking data stored in Horse.phenotype JSONB

### File List

- `backend/modules/horses/services/markingGenerationService.mjs` — new (pure-function service)
- `backend/__tests__/markingGenerationService.test.mjs` — new (~43 tests)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-02 | Implementation complete — marking generation, inheritance, boolean modifiers, statistical validation |

---

*Note: This artifact was reconstructed from the TEA:TR report and epic specification on 2026-04-09 as part of the Epic 31E retrospective story-preservation action item. The original story file was not saved to implementation-artifacts/ during development.*
