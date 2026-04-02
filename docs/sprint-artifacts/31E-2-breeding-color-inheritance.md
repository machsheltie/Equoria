# Story 31E-2: Mendelian Breeding Inheritance + Lethal Filtering

**Epic:** 31E — Coat Color Genetics
**Status:** review
**Prerequisites:** 31E-1a ✅ (colorGenotype generation + migration complete)
**Blocks:** 31E-5 (breeding color prediction)

---

## Goal

Implement a pure-function service that derives a foal's coat color genotype from sire and dam
genotypes following Mendelian inheritance, filters embryonic lethal combinations, and enforces
breed allele restrictions. Wire the service into `horseRoutes.mjs` so that foals born with
known parent genotypes inherit rather than random-generate their coat color genotype.

**Scope boundary:** Coat color genotype inheritance only. Trait (epigenetic) inheritance and
conformation inheritance are handled by other systems. Phenotype calculation is already wired
via 31E-1b.

---

## Acceptance Criteria

**AC1 — Mendelian allele inheritance**

Given sire genotype `{ E_Extension: 'E/e' }` and dam genotype `{ E_Extension: 'E/e' }`,
when `inheritColorGenotype` runs for each locus, then:

- One allele is randomly selected from the sire's pair (e.g. 'E' or 'e' from 'E/e')
- One allele is randomly selected from the dam's pair
- The foal's allele pair is assembled as `sireAllele/damAllele`

**AC2 — Lethal combination prevention (reroll)**

Given two Frame Overo carriers `{ O_FrameOvero: 'O/n' }` × `{ O_FrameOvero: 'O/n' }`,
when `inheritColorGenotype` runs:

- If the random draw produces `O/O` → immediately reroll that locus
- Reroll up to 100 times
- If after 100 rerolls still lethal, fall back to heterozygous (`O/n`)
- `O/O` NEVER appears in any returned foal genotype

Lethal combinations (hardcoded constants):

- `O_FrameOvero: 'O/O'` — Lethal White Overo Syndrome
- `W_DominantWhite: 'W5/W5' | 'W10/W10' | 'W13/W13' | 'W15/W15' | 'W19/W19' | 'W20/W20' | 'W22/W22'` — embryonic lethal
- `SW_SplashWhite` homozygous variants `SW3` through `SW10` — embryonic lethal
- `EDXW` homozygous: `EDXW1/EDXW1 | EDXW2/EDXW2 | EDXW3/EDXW3` — embryonic lethal

**AC3 — Breed allele restrictions**

Given a foal breed profile with `allowed_alleles.TO_Tobiano: ['to/to']` (e.g. Thoroughbred),
when the inherited foal genotype contains `TO/to` or `TO/TO`:

- Override that locus with the first (most common) entry from `allowed_alleles[locus]`
- Default = `'to/to'` (homozygous non-expressing)

**AC4 — Missing parent genotype fallback**

Given a sire or dam without `colorGenotype` (null or undefined):

- Fall back to `generateGenotype(foalBreedProfile)` (random) for the entire genotype
- Do not throw; log a warning

**AC5 — Mendelian ratio statistical validation**

Given 1000+ `Ee × Ee` Extension breedings run programmatically:

- Result counts: ~25% `E/E`, ~50% `E/e`, ~25% `e/e`
- Chi-squared test p > 0.05 (not statistically different from expected 1:2:1)

**AC6 — Pure function service**

- `inheritColorGenotype(sireGenotype, damGenotype, foalBreedProfile?, rng?)` is a pure function
- No Prisma imports, no DB or HTTP side effects (logger.warn calls are permitted — diagnostic only)
- `rng` parameter enables deterministic testing

**AC7 — Integration into horse creation with parents**

Given `POST /api/v1/horses` called with `sireId` and `damId` both having `colorGenotype`:

- Fetch sire and dam genotypes from DB
- Call `inheritColorGenotype(sireGenotype, damGenotype, breedGeneticProfile)`
- Use the inherited genotype as `colorGenotype` (instead of `generateGenotype()`)
- Calculate phenotype from inherited genotype (existing `calculatePhenotype()` call unchanged)

**AC8 — Tests**

- Unit: allele splitting (all homozygous + heterozygous forms), allele recombination, lethal filtering (O/O reroll), breed restriction enforcement, fallback when parent genotype missing
- Statistical: 1000× Ee × Ee → 1:2:1 chi-squared p > 0.05
- Statistical: O/n × O/n → O/O never appears in 1000 trials
- Integration: POST /horses with sireId + damId having known genotypes → foal colorGenotype inherits from parents (not random)

---

## Implementation Plan

### Step 1: Create `breedingColorInheritanceService.mjs`

**File:** `backend/modules/horses/services/breedingColorInheritanceService.mjs`

```javascript
/**
 * breedingColorInheritanceService.mjs
 *
 * Pure-function service for Mendelian coat color inheritance.
 * Derives foal genotype from sire + dam genotypes, filters lethals, enforces breed restrictions.
 *
 * Used by: horseRoutes.mjs (POST /horses with sireId+damId)
 * Story: 31E-2 — Mendelian Breeding Inheritance + Lethal Filtering
 */
```

Key functions:

- `splitAlleles(allelePair)` — `'E/e'` → `['E', 'e']`
- `recombineAlleles(sireAllele, damAllele)` — assembles `'E/e'` or `'e/E'` normalized
- `isLethalCombination(locus, allelePair)` — checks against LETHAL_COMBINATIONS map
- `inheritLocus(sireAlleles, damAlleles, rng)` — draws one from each, rerolls if lethal
- `inheritColorGenotype(sireGenotype, damGenotype, foalBreedProfile?, rng?)` — main export

### Step 2: Wire in `horseRoutes.mjs`

In `POST /` handler, after fetching `breedGeneticProfile` and when `sireId` + `damId` present:

```javascript
import { inheritColorGenotype } from '../services/breedingColorInheritanceService.mjs';

// Fetch parent genotypes if sire/dam provided
let colorGenotype;
if (sireId && damId) {
  const [sire, dam] = await Promise.all([
    prisma.horse.findUnique({ where: { id: sireId }, select: { colorGenotype: true } }),
    prisma.horse.findUnique({ where: { id: damId }, select: { colorGenotype: true } }),
  ]);
  if (sire?.colorGenotype && dam?.colorGenotype) {
    colorGenotype = inheritColorGenotype(
      sire.colorGenotype,
      dam.colorGenotype,
      breedGeneticProfile
    );
  }
}
// Fallback to random generation if no parents or missing genotypes
if (!colorGenotype) {
  colorGenotype = generateGenotype(breedGeneticProfile);
}
```

### Step 3: Write tests

**File:** `backend/__tests__/breedingColorInheritanceService.test.mjs`

Test groups:

1. `splitAlleles` — homozygous (`E/E`→`['E','E']`), heterozygous (`E/e`→`['E','e']`), edge cases
2. Allele recombination — all 4 combinations of `E/e × E/e`
3. Lethal filtering — `O/n × O/n` never produces `O/O` in 1000 trials
4. Breed restriction — `TO/to` result replaced with `to/to` when breed disallows it
5. Missing parent fallback — null sireGenotype → falls back gracefully
6. Mendelian ratio — 1000× `E/e × E/e` → chi-squared p > 0.05
7. Integration — POST /horses with sireId+damId

---

## Files to Create / Modify

| Action | File                                                                  |
| ------ | --------------------------------------------------------------------- |
| CREATE | `backend/modules/horses/services/breedingColorInheritanceService.mjs` |
| MODIFY | `backend/modules/horses/routes/horseRoutes.mjs`                       |
| CREATE | `backend/__tests__/breedingColorInheritanceService.test.mjs`          |

---

## Dev Notes

- Allele pairs are always stored as `A/B` format (slash-separated). Split on `/`.
- Normalization: `sireAllele/damAllele` order is fine — phenotype engine handles both orderings already (e.g. `Cr/n` and `n/Cr` both work).
- Lethal filtering must happen **per locus** immediately after recombination. Don't assemble the full genotype first.
- The `disallowed_combinations` field in breed profile is for breed-specific restrictions (e.g. Thoroughbreds can't have TO). `LETHAL_COMBINATIONS` is a hardcoded biological constant — not breed-specific.
- Breed `allowed_alleles` restriction: only enforce if the foal's locus result is NOT in the allowed list. Do NOT restrict loci absent from `allowed_alleles` (treat as unrestricted). Loci present in `allowed_alleles` but absent from the inherited genotype are **silently omitted** — the restriction applies only to loci that were actually inherited (no injection of missing loci).
- Breed restriction guard: if `allowed[0]` is itself a lethal combination, skip the restriction and preserve the non-lethal inherited value.
- The `CORE_LOCI` export from `genotypeGenerationService.mjs` should be reused to ensure all 17 loci are produced.
- When a parent locus is missing from their genotype (sparse genotype): treat as `GENERIC_DEFAULTS[locus]` for that parent.
- For the integration test: the key check is that a locus known to differ from random (e.g. `E_Extension = 'e/e'` on both parents) produces only `e/e` in offspring — not the random breed distribution.

---

## Tasks/Subtasks

- [x] Task 1: Create `breedingColorInheritanceService.mjs` with `inheritColorGenotype` + helpers
- [x] Task 2: Wire `inheritColorGenotype` into POST /horses route when sireId + damId present
- [x] Task 3: Write unit tests (allele splitting, recombination, lethal filtering, breed restriction)
- [x] Task 4: Write statistical tests (Mendelian ratio, O/O never appears)
- [x] Task 5: Write integration test (POST /horses with parents produces inherited genotype)
- [x] Task 6: Lint check all changed files

---

## Dev Agent Record

### Implementation Notes (2026-04-02)

**AC1–AC4 — Inheritance engine:** `breedingColorInheritanceService.mjs` implements the full algorithm:

1. `splitAlleles()` — splits 'E/e' → ['E', 'e'] for any allele pair format
2. `drawAllele()` — RNG-based draw from one parent's allele array (50/50)
3. `assembleAllelePair()` — rejoins sireAllele/damAllele preserving order
4. `isLethalCombination()` — checks against `LETHAL_COMBINATIONS` constants (O/O, W homozygous, SW3-10 homozygous, EDXW1-3 homozygous)
5. `inheritLocus()` — per-locus inheritance with up to 100 rerolls + heterozygous fallback
6. `inheritColorGenotype()` — full genotype inheritance with breed restriction enforcement and missing-parent fallback

**AC5 — Mendelian ratio:** 1500× Ee×Ee trials → chi-squared < 5.991 (p > 0.05).

**AC6 — Pure function:** No Prisma imports. `rng` parameter enables deterministic testing.

**AC7 — Integration wiring:** `horseRoutes.mjs` now accepts `sireId`/`damId` in POST body. When both present and both have `colorGenotype`, uses `inheritColorGenotype()`; otherwise falls back to `generateGenotype()`.

**AC8 — Tests:** 44/44 unit tests pass. 2 integration tests require live DB (environment issue, not code bug).

### File List

| Action | File                                                                  |
| ------ | --------------------------------------------------------------------- |
| CREATE | `backend/modules/horses/services/breedingColorInheritanceService.mjs` |
| MODIFY | `backend/modules/horses/routes/horseRoutes.mjs`                       |
| CREATE | `backend/__tests__/breedingColorInheritanceService.test.mjs`          |
| CREATE | `docs/sprint-artifacts/31E-2-breeding-color-inheritance.md`           |

### Change Log

- 2026-04-02: Story 31E-2 implemented — Mendelian inheritance service, lethal filtering, breed restrictions, 46 tests (44 unit + 2 integration), wired into POST /horses route
