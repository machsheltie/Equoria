# Story 31E-1a: Genotype Generation Service + Migration

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-1a-genotype-generation-and-migration
**Status:** done

---

## Story

As a developer,
I want a service that generates a complete genotype across 17+ loci for a horse based on breed allele weights,
So that every horse has a genetically valid allele profile stored at creation.

---

## Acceptance Criteria

**AC1 — Genotype generation from breed allele weights**
Given a horse is being created (new horse or non-breeding foal),
When the genotype generation service runs,
Then allele pairs are generated for all 17+ loci using the breed's `allele_weights` probability distribution,
And breed allele restrictions are enforced — no alleles outside `allowed_alleles` appear.

**AC2 — Storage in colorGenotype JSONB**
Given genotype generation completes,
When the horse record is saved,
Then the genotype is stored in `Horse.colorGenotype` JSONB: `{ E_Extension: "E/e", A_Agouti: "A/A", ... }`.

**AC3 — Prisma migration**
Given `colorGenotype` and `phenotype` fields do not yet exist on the Horse model,
When the migration is applied,
Then `colorGenotype Json?` and `phenotype Json?` are added (nullable for existing horses).

**AC4 — GENERIC_DEFAULTS fallback**
Given a horse's breed has no genetic profile (null/undefined),
When genotype generation runs,
Then GENERIC_DEFAULTS are used for all loci.

**AC5 — Deterministic RNG**
Given the service accepts an `rng` parameter,
When the same seed is used,
Then the same genotype is produced (enables deterministic testing).

---

## Tasks / Subtasks

- [x] T1: Create Prisma migration for `colorGenotype Json?` and `phenotype Json?` fields on Horse model
- [x] T2: Create `genotypeGenerationService.mjs` with `CORE_LOCI`, `GENERIC_DEFAULTS`, and `generateGenotype(breedProfile, rng)`
  - [x] T2.1: Define `CORE_LOCI` array (17 loci minimum)
  - [x] T2.2: Define `GENERIC_DEFAULTS` for all loci (wildtype/most common allele)
  - [x] T2.3: Implement allele selection from breed `allele_weights` with fallback to GENERIC_DEFAULTS
  - [x] T2.4: Enforce `allowed_alleles` restrictions per locus
  - [x] T2.5: Extra loci in breed profile included beyond CORE_LOCI minimum
- [x] T3: Wire genotype generation into horse creation (`POST /api/v1/horses`)
- [x] T4: Write tests (~15)
  - [x] T4.1: `generateGenotype` returns object with all 17 CORE_LOCI
  - [x] T4.2: `CORE_LOCI` array has exactly 17 entries
  - [x] T4.3: Extra loci from breed profile included (Prl_Pearl, BR1_Brindle1)
  - [x] T4.4: GENERIC_DEFAULTS used when breedGeneticProfile is null/undefined
  - [x] T4.5: Deterministic RNG produces same output for same seed
  - [x] T4.6: Selects only alleles from `allowed_alleles` for each locus
  - [x] T4.7: Falls back to first allowed_allele when no weight defined
  - [x] T4.8: Integration — `POST /api/v1/horses` created horse includes `colorGenotype` with all 17 CORE_LOCI

---

## Dev Notes

### Prisma Migration Required

Unlike 31D, `colorGenotype` and `phenotype` do NOT already exist on the Horse model. This migration must run cleanly against both dev and test DBs.

```prisma
model Horse {
  colorGenotype  Json?
  phenotype      Json?
}
```

### Service Pattern

Follows established pattern from `conformationService.mjs`, `gaitService.mjs`, `temperamentService.mjs`:
- Pure function — no Prisma imports
- `rng` parameter for deterministic testing
- All breed profile data passed in (no DB calls inside service)

### Allele Pair Format

All allele pairs stored as `"allele1/allele2"` strings: `"E/e"`, `"Cr/Cr"`, `"nd2/nd2"`.

### File Locations

- Service: `backend/modules/horses/services/genotypeGenerationService.mjs`
- Tests: `backend/__tests__/genotypeGenerationService.test.mjs`
- Migration: `packages/database/prisma/migrations/`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: Allele generation from breed allele_weights with weighted probability selection
- AC2: colorGenotype stored as JSONB at horse creation
- AC3: Prisma migration applied cleanly to dev and test DBs
- AC4: GENERIC_DEFAULTS fallback for null/undefined breed profiles
- AC5: Deterministic RNG via seeded random function parameter

### File List

- `backend/modules/horses/services/genotypeGenerationService.mjs` — new (pure-function service)
- `backend/__tests__/genotypeGenerationService.test.mjs` — new (~15 tests)
- `packages/database/prisma/migrations/{timestamp}_add-color-genotype-phenotype/migration.sql` — new

### Change Log

| Date | Change |
|------|--------|
| 2026-04-01 | Implementation complete — Prisma migration, service, horse creation wired, tests passing |

---

*Note: This artifact was reconstructed from the TEA:TR report and epic specification on 2026-04-09 as part of the Epic 31E retrospective story-preservation action item. The original story file was not saved to implementation-artifacts/ during development.*
