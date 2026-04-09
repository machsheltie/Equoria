# Story 31E-1b: Phenotype Calculation Engine

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-1b-phenotype-calculation-engine
**Status:** done

---

## Story

As a developer,
I want a deterministic phenotype calculation engine that converts any genotype into a display color, shade, and pattern description,
So that genotypes produce accurate, consistent coat color names.

---

## Acceptance Criteria

**AC1 — Base color from Extension + Agouti**
Given a complete genotype,
When the phenotype calculation engine runs,
Then base color is determined from Extension + Agouti interaction (Bay, Black, Chestnut).

**AC2 — Dilution hierarchy**
Given a base color,
When dilutions are applied,
Then they are applied in order: Cream → Dun → Silver → Champagne → Pearl → Mushroom,
Producing 40+ named color possibilities.

**AC3 — Pattern overlays**
Given a diluted base color,
When pattern overlays are applied,
Then: Gray, Roan, Tobiano, Frame Overo, Sabino, Splash White, Leopard Complex + PATN1, Dominant White, Brindle are applied.

**AC4 — Shade selection**
Given the color name is determined,
When a shade variant is selected,
Then it is drawn from breed-specific `shade_bias` probabilities.

**AC5 — Storage**
Given phenotype calculation completes,
When the horse record is saved,
Then phenotype is stored in `Horse.phenotype` JSONB.

**AC6 — Determinism**
Given the same genotype input,
When `calculatePhenotype()` is called multiple times,
Then it always produces the same phenotype object (idempotent).

---

## Tasks / Subtasks

- [x] T1: Create `phenotypeCalculationService.mjs` with `calculatePhenotype(genotype, shadeBias?)`
  - [x] T1.1: Implement Extension + Agouti base color resolution (Bay/Black/Chestnut)
  - [x] T1.2: Cream dilution (Palomino, Buckskin, Cremello, Perlino, Smoky Black, Smoky Cream)
  - [x] T1.3: Dun dilution (Red Dun, Dun, Grulla, Dunalino, Dunskin)
  - [x] T1.4: Silver dilution (Silver Bay, Silver Black, Silver Dapple, etc.)
  - [x] T1.5: Champagne dilution (Amber Champagne, Classic Champagne, Gold Champagne, etc.)
  - [x] T1.6: Pearl dilution (Apricot, Pale Gold, Pearl Black)
  - [x] T1.7: Mushroom dilution
  - [x] T1.8: Gray pattern overlay
  - [x] T1.9: Roan pattern overlay
  - [x] T1.10: Tobiano, Frame Overo, Sabino, Splash White pinto pattern overlays
  - [x] T1.11: Leopard Complex (LP) + PATN1 Appaloosa patterns
  - [x] T1.12: Dominant White pattern
  - [x] T1.13: Brindle pattern
  - [x] T1.14: Pinto/pattern flags in phenotype JSONB
  - [x] T1.15: Shade selection from shade_bias
  - [x] T1.16: Null/empty genotype fallback (returns "Unknown" or generic)
- [x] T2: Wire phenotype calculation into horse creation alongside genotype
- [x] T3: Write tests (~65)

---

## Dev Notes

### Epistatic Priority Order

Dilutions are applied in a fixed priority order. Later dilutions in the chain do not override earlier ones that are already dominant:

```
Base → Cream → Dun → Silver → Champagne → Pearl → Mushroom
```

Pattern overlays are applied after dilutions. Gray is dominant over all other patterns. Roan does not apply to Gray horses.

### Color Name Examples (40+ required by AC2)

Bay, Black, Chestnut, Palomino, Buckskin, Cremello, Perlino, Smoky Black, Smoky Cream, Red Dun, Dun, Grulla, Dunalino, Dunskin, Smoky Grulla, Silver Bay, Silver Black, Silver Dapple, Amber Champagne, Classic Champagne, Gold Champagne, Ivory Champagne, Sable Champagne, Champagne Dun, Apricot, Pale Gold, Pearl Black, Liver Chestnut, Seal Brown, Blue Roan, Red Roan, Bay Roan, Tobiano, Sabino, Splash White, Frame Overo, Leopard, Blanket, Snowflake, Frost, Varnish Roan, Brindle, Gray, Dominant White.

### Determinism Requirement

`calculatePhenotype` must be a pure function — given the same genotype, it always returns the same result. No `Math.random()` calls inside the function. Shade selection uses the `shadeBias` parameter or a deterministic default.

### File Locations

- Service: `backend/modules/horses/services/phenotypeCalculationService.mjs`
- Tests: `backend/__tests__/phenotypeCalculationService.test.mjs`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: Extension + Agouti interaction produces Bay/Black/Chestnut correctly
- AC2: Full dilution chain implemented — 40+ named colors confirmed in tests
- AC3: All 9 pattern overlays implemented with correct epistatic relationships
- AC4: Shade selection deterministic from shade_bias parameter
- AC5: Phenotype stored in Horse.phenotype JSONB at creation
- AC6: Determinism explicitly verified in tests — same genotype always produces identical output

### File List

- `backend/modules/horses/services/phenotypeCalculationService.mjs` — new (~65 tests cover 40+ color paths)
- `backend/__tests__/phenotypeCalculationService.test.mjs` — new (~65 tests)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-01 | Implementation complete — phenotype engine, all dilution + pattern paths, integration wired |

---

*Note: This artifact was reconstructed from the TEA:TR report and epic specification on 2026-04-09 as part of the Epic 31E retrospective story-preservation action item. The original story file was not saved to implementation-artifacts/ during development.*
