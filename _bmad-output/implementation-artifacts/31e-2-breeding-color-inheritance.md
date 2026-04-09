# Story 31E-2: Mendelian Breeding Inheritance + Lethal Filtering

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-2-breeding-color-inheritance
**Status:** done

---

## Story

As a developer,
I want foal genotypes to follow standard Mendelian inheritance with lethal combination prevention,
So that breeding produces genetically accurate offspring with no lethal white foals.

---

## Acceptance Criteria

**AC1 — Mendelian inheritance per locus**
Given two horses are breeding,
When the foal's genotype is generated,
Then for each locus: one random allele from sire + one random allele from dam.

**AC2 — Mendelian ratio validation**
Given 1000+ Ee × Ee breedings,
When offspring genotypes are tallied,
Then approximately 25% EE, 50% Ee/eE, 25% ee (chi-squared p > 0.001).

**AC3 — Lethal combination prevention**
Given two Frame Overo carriers (O/n × O/n) breed,
When foal genotype is generated,
Then O/O (lethal white) never appears — always rerolled,
With up to 100 reroll attempts, then fallback to carrier heterozygous (O/n).

**AC4 — Multiple lethal combinations**
Given genotypes containing W20/W20, SW3/SW3, or EDXW1/EDXW1,
When checked via `isLethalCombination()`,
Then they are correctly identified as lethal.

**AC5 — Breed restriction enforcement**
Given the foal's breed has `allowed_alleles` restrictions,
When the foal genotype is generated,
Then restricted alleles are replaced with the breed's default (allowed[0]).

**AC6 — Missing parent fallback**
Given one or both parents have null/undefined/empty genotype,
When `inheritColorGenotype()` is called,
Then it falls back gracefully without throwing.

---

## Tasks / Subtasks

- [x] T1: Create `breedingColorInheritanceService.mjs`
  - [x] T1.1: `splitAlleles(allelePair)` — parse "E/e" → ["E", "e"]
  - [x] T1.2: `drawAllele(allelePair, rng)` — pick one allele with 50/50 probability
  - [x] T1.3: `assembleAllelePair(sireAllele, damAllele)` — combine into pair string
  - [x] T1.4: `LETHAL_COMBINATIONS` — define lethal genotype patterns (O/O, W20/W20, SW3/SW3, EDXW1/EDXW1, etc.)
  - [x] T1.5: `isLethalCombination(genotype)` — check full genotype against lethal list
  - [x] T1.6: `inheritLocus(sireAllelePair, damAllelePair, rng, maxRerolls)` — per-locus inheritance with lethal reroll
  - [x] T1.7: `inheritColorGenotype(sireGenotype, damGenotype, foalBreedProfile, rng)` — full inheritance pipeline
- [x] T2: Wire `inheritColorGenotype` into foal creation path (POST /api/v1/horses with sireId/damId)
- [x] T3: Write tests (~54)
  - [x] T3.1: `splitAlleles` — 8 tests covering heterozygous, homozygous, multi-char alleles
  - [x] T3.2: `drawAllele` — 3 tests (first allele, second allele, boundary rng)
  - [x] T3.3: `assembleAllelePair` — 3 tests
  - [x] T3.4: `inheritLocus` — produces all 4 combinations from E/e × E/e
  - [x] T3.5: `isLethalCombination` — O/O lethal, W20/W20 lethal, SW3/SW3 lethal, EDXW1/EDXW1 lethal, O/n not lethal
  - [x] T3.6: `inheritLocus` — never returns O/O for O/n × O/n (lethal reroll)
  - [x] T3.7: `inheritLocus` — heterozygous fallback after 100 reroll exhaustion → O/n
  - [x] T3.8: `inheritColorGenotype` — foal never contains O/O when parents are O/n
  - [x] T3.9: Statistical — O/O never appears in 1000 trials (property test)
  - [x] T3.10: Statistical — Ee × Ee → ~25/50/25 (chi-squared p > 0.001)
  - [x] T3.11: Breed restrictions — TO_Tobiano overridden to to/to for restricted breed
  - [x] T3.12: Breed restrictions — loci not in allowed_alleles left alone
  - [x] T3.13: Missing parent fallbacks — null/undefined/empty genotype handled
  - [x] T3.14: Integration — foal inherits Extension from e/e × e/e parents

---

## Dev Notes

### Lethal Combination List

Key lethal patterns (homozygous):
- `O/O` — Frame Overo lethal white
- `W20/W20`, `W5/W5` — Dominant White homozygous lethals
- `SW3/SW3` — Splash White lethal
- `EDXW1/EDXW1` — Extended Dominant White lethal

The `LETHAL_COMBINATIONS` constant is exported from this service and reused by `breedingColorPredictionService.mjs`.

### Reroll Strategy

```
for attempt in range(100):
  offspringAllele = drawAllele(sire) + drawAllele(dam)
  if not isLethalCombination({ [locus]: offspringAllele, ...rest }):
    return offspringAllele
return makeCombinedHeterozygous(sire, dam)  # carrier fallback
```

### File Locations

- Service: `backend/modules/horses/services/breedingColorInheritanceService.mjs`
- Tests: `backend/__tests__/breedingColorInheritanceService.test.mjs`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: Per-locus Mendelian inheritance with 50/50 allele draw
- AC2: Statistical chi-squared test confirms Mendelian ratios (p > 0.001)
- AC3: O/O lethal white never produced — 1000-trial property test confirms
- AC4: All 4 lethal combination types identified correctly
- AC5: Breed restrictions enforce allowed_alleles per locus
- AC6: Null/undefined parent genotype handled gracefully

### File List

- `backend/modules/horses/services/breedingColorInheritanceService.mjs` — new (pure-function service)
- `backend/__tests__/breedingColorInheritanceService.test.mjs` — new (~54 tests)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-02 | Implementation complete — Mendelian inheritance, lethal filtering, breed restrictions, statistical tests |

---

*Note: This artifact was reconstructed from the TEA:TR report and epic specification on 2026-04-09 as part of the Epic 31E retrospective story-preservation action item. The original story file was not saved to implementation-artifacts/ during development.*
