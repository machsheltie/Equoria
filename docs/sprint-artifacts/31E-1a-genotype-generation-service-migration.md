# Story 31E-1a: Genotype Generation Service + Migration

**Epic:** 31E — Coat Color Genetics
**Status:** review
**Prerequisites:** 31A-1-populate-breed-genetic-profile-data ✅ (complete)
**Parallel with:** 31B, 31D (independent)
**Blocks:** 31E-1b, 31E-2, 31E-3, 31E-4, 31E-5

---

## Goal

Add a `colorGenotype` JSONB field to the Horse model via migration, and implement a
`genotypeGenerationService.mjs` that generates a breed-specific allele profile across 17+
genetic loci at horse creation — drawing from the `allowed_alleles` and `allele_weights`
already stored in `breedGeneticProfile` for every breed.

---

## Acceptance Criteria

**AC1 — Migration**

- Prisma migration adds `colorGenotype Json?` and `phenotype Json?` to the Horse model
- Both nullable for backward compatibility with existing 15 000+ horses

**AC2 — Genotype structure**

- Generated genotype is a JSONB object with one key per locus:
  `{ E_Extension: "E/e", A_Agouti: "A/A", Cr_Cream: "n/n", ... }`
- All 17 core loci must be present (see Locus List below)
- Additional loci present in the breed's `allowed_alleles` are also generated

**AC3 — Allele weight sampling**

- Each allele pair is drawn independently using the breed's `allele_weights[locus]` probability distribution
- No allele outside `allowed_alleles[locus]` is ever selected
- If a breed has no `allele_weights` for a locus, default to the most common allele in `allowed_alleles` (index 0)

**AC4 — Unknown breed fallback**

- If horse has no `breedId`, or `breedGeneticProfile` is null, use a permissive generic
  profile that allows common alleles at every locus (no crash)

**AC5 — Service is a pure function**

- `generateGenotype(breedGeneticProfile)` takes the JSONB profile, returns a genotype object
- No Prisma imports inside the service — caller handles persistence
- Deterministic when seeded (accepts optional RNG for testability)

**AC6 — Integration into horse creation**

- `backend/modules/horses/routes/horseRoutes.mjs` calls `generateGenotype` after
  breed profile fetch and persists result in `colorGenotype`
- Existing horses without `colorGenotype` are unaffected (field is nullable)

**AC7 — Tests**

- Unit tests cover: weighted sampling, allowed_alleles enforcement, fallback for missing locus
- 1000-sample statistical test: Ee × Ee sampling produces ~50% Ee pairs (±10%)
- Integration test: horse created via POST `/api/v1/horses` includes `colorGenotype` in response

---

## Locus List (17 core)

```
E_Extension, A_Agouti, Cr_Cream, D_Dun, Z_Silver, Ch_Champagne,
G_Gray, Rn_Roan, W_DominantWhite, TO_Tobiano, O_FrameOvero,
SB1_Sabino1, SW_SplashWhite, LP_LeopardComplex, PATN1_Pattern1,
EDXW, MFSD12_Mushroom
```

Additional loci read from breed profile if present: `Prl_Pearl`, `BR1_Brindle1`

---

## Tasks/Subtasks

- [x] Task 1: Create Prisma migration adding colorGenotype + phenotype columns
- [x] Task 2: Update schema.prisma and run migrate deploy + generate
- [x] Task 3: Create genotypeGenerationService.mjs (pure function)
- [x] Task 4: Wire generateGenotype into POST /horses route (horseRoutes.mjs)
- [x] Task 5: Add colorGenotype to horseModel.mjs create destructuring
- [x] Task 6: Write unit + statistical + integration tests (15/15 passing)
- [x] Task 7: Lint check all changed files

---

## Implementation Plan

### Step 1: Prisma migration

Edit `packages/database/prisma/schema.prisma` — add to Horse model:

```prisma
colorGenotype Json?   // Allele pairs per locus: { E_Extension: "E/e", ... }
phenotype     Json?   // Calculated phenotype: { color, shade, markings, ... }
```

Create migration `20260401010000_add_horse_color_genotype`:

```sql
ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "colorGenotype" JSONB;
ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "phenotype"     JSONB;
```

Run `npx prisma migrate deploy` from `packages/database/`.

### Step 2: Genotype generation service

**File:** `backend/modules/horses/services/genotypeGenerationService.mjs`

```javascript
/**
 * genotypeGenerationService.mjs
 * Pure-function service for generating horse coat color genotypes.
 * Reads breed allele weights from breedGeneticProfile JSONB.
 */

// Core 17 loci always present in output
export const CORE_LOCI = [
  'E_Extension',
  'A_Agouti',
  'Cr_Cream',
  'D_Dun',
  'Z_Silver',
  'Ch_Champagne',
  'G_Gray',
  'Rn_Roan',
  'W_DominantWhite',
  'TO_Tobiano',
  'O_FrameOvero',
  'SB1_Sabino1',
  'SW_SplashWhite',
  'LP_LeopardComplex',
  'PATN1_Pattern1',
  'EDXW',
  'MFSD12_Mushroom',
];

// Generic fallback alleles when breed has no profile
const GENERIC_DEFAULTS = {
  E_Extension: 'E/e',
  A_Agouti: 'A/a',
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'n/n',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  TO_Tobiano: 'to/to',
  O_FrameOvero: 'n/n',
  SB1_Sabino1: 'n/n',
  SW_SplashWhite: 'n/n',
  LP_LeopardComplex: 'lp/lp',
  PATN1_Pattern1: 'patn1/patn1',
  EDXW: 'n/n',
  MFSD12_Mushroom: 'N/N',
};
```

### Step 3: Wire into horse creation

In `backend/modules/horses/routes/horseRoutes.mjs`, POST / handler:

```javascript
import { generateGenotype } from '../services/genotypeGenerationService.mjs';

// Fetch breed profile then generate genotype
let breedGeneticProfile = null;
if (req.body.breedId) {
  const breed = await prisma.breed.findUnique({
    where: { id: req.body.breedId },
    select: { breedGeneticProfile: true },
  });
  breedGeneticProfile = breed?.breedGeneticProfile ?? null;
}
const colorGenotype = generateGenotype(breedGeneticProfile);
// ... add colorGenotype to horseData
```

### Step 4: Tests

**File:** `backend/__tests__/genotypeGenerationService.test.mjs`

---

## Files to Create / Modify

| Action | File                                                                                        |
| ------ | ------------------------------------------------------------------------------------------- |
| CREATE | `packages/database/prisma/migrations/20260401010000_add_horse_color_genotype/migration.sql` |
| MODIFY | `packages/database/prisma/schema.prisma` (added colorGenotype/phenotype to Horse)           |
| CREATE | `backend/modules/horses/services/genotypeGenerationService.mjs`                             |
| MODIFY | `backend/modules/horses/routes/horseRoutes.mjs` (import + generate colorGenotype)           |
| MODIFY | `backend/models/horseModel.mjs` (destructure + persist colorGenotype)                       |
| CREATE | `backend/__tests__/genotypeGenerationService.test.mjs`                                      |

---

## Dev Notes

- The `sampleWeightedAllele` function is a pure utility — test it exhaustively
- Breed profiles store `allele_weights` as `{ "E/e": 0.4, "E/E": 0.2, "e/e": 0.4 }` — weights are per genotype pair, not per allele (already paired)
- Arabian has 20 loci in its profile (17 core + `Prl_Pearl`, `BR1_Brindle1`, plus extras)
- The horse controller already fetches breed in some paths — confirm it's available before calling `generateGenotype`
- `colorGenotype` is nullable — don't break existing GET horse routes that don't return it yet (31E-4 handles that)
- Do NOT implement phenotype calculation here — that's Story 31E-1b
- Do NOT implement breeding inheritance here — that's Story 31E-2

---

## Dev Agent Record

### Implementation Notes (2026-04-01)

**AC1 — Migration:** Created `20260401010000_add_horse_color_genotype/migration.sql`. Table in DB is `horses` (lowercase plural, not `Horse`). Migration applied successfully via `prisma migrate deploy`. Note: `prisma generate` was blocked by background test process holding the DLL — not blocking (DB columns live, runtime works).

**AC2 — Genotype structure:** `generateGenotype()` returns object with all 17 CORE_LOCI plus extra loci from breed profile. Arabian adds `Prl_Pearl` and `BR1_Brindle1` (19 total loci for Arabian).

**AC3 — Weighted sampling:** `sampleWeightedAllele(weights, rng)` uses cumulative probability walk. Floating-point safety: last entry returned if roll exceeds sum.

**AC4 — Fallback:** `GENERIC_DEFAULTS` used when `breedGeneticProfile` is null/undefined. Covers all 17 CORE_LOCI.

**AC5 — Pure function:** No Prisma imports in service. Accepts optional `rng` param for deterministic testing.

**AC6 — Wiring:** Wired in `horseRoutes.mjs` POST / handler. Fetches `breedGeneticProfile` from DB (1 extra query per horse creation). Added `colorGenotype` to `horseModel.mjs` create data.

**AC7 — Tests:** 15/15 passing. 14 unit/statistical tests + 1 integration test. Integration test uses dynamic breed ID lookup (test DB has different IDs from dev DB).

### Completion Notes

All 7 ACs satisfied. 15 tests passing. No regressions in 57 related horse tests. Lint clean.

### Change Log

- 2026-04-01: Story 31E-1a implemented — genotype generation service, migration, horse creation wiring, 15 tests
