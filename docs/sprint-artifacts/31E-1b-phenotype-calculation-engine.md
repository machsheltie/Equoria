# Story 31E-1b: Phenotype Calculation Engine

**Epic:** 31E — Coat Color Genetics
**Status:** review
**Prerequisites:** 31E-1a ✅ (colorGenotype generation + migration complete)
**Blocks:** 31E-4 (GET /genetics endpoint), 31E-5 (breeding color prediction)

---

## Goal

Implement a deterministic phenotype calculation engine that converts any horse's `colorGenotype`
(produced by 31E-1a) into a display color name, shade variant, and pattern flags — and persists
the result to `Horse.phenotype` JSONB at creation time.

**Scope boundary:** Base color + dilutions + pattern overlays + shade selection only.
Markings (face/leg/boolean) are Story 31E-3.

---

## Acceptance Criteria

**AC1 — Base color from Extension + Agouti**

- `E_Extension = e/e` → Chestnut base (regardless of Agouti)
- `E_Extension = E/e` or `E/E` AND `A_Agouti = a/a` → Black base
- `E_Extension = E/e` or `E/E` AND `A_Agouti = A/A` or `A/a` → Bay base

**AC2 — Dilutions applied in priority order**

Order: Cream → Dun → Silver → Champagne → Pearl → Mushroom

Cream (`Cr_Cream`):

- `Cr/n` single dilute: Chestnut→Palomino, Bay→Buckskin, Black→Smoky Black
- `Cr/Cr` double dilute: Chestnut→Cremello, Bay→Perlino, Black→Smoky Cream

Dun (`D_Dun`):

- `D/nd2` or `nd1/nd2` (dun active): Chestnut→Red Dun, Bay→Bay Dun, Black→Grulla
- Cream+Dun stacking:
  - Palomino+Dun → Gold Dun (treated as "Palomino Dun" in display, mapped to Gold Dun Champagne only if Ch also present)
  - Buckskin+Dun → Dunskin → "Bay Dun" with Cream note in shade
  - Cremello+Dun → "Cremello Dun" (use "Gold Cream Dun Champagne" if Ch present, else "Cremello")
  - Grulla+Cream(single) → "Smoky Grulla" (map to "Silver Grulla")
- Note: `nd2/nd2` and `nd1/nd1` = non-dun (no dun expression)

Silver (`Z_Silver`):

- `Z/n` only affects black-based pigment (eumelanin):
  - Black base → Silver Black
  - Bay base → Silver Bay
  - Chestnut base → no visible change (Z/n on chestnut = same color name)
- Combined: Silver Black + Dun → Silver Grulla; Silver Bay + Cream → Silver Buckskin

Champagne (`Ch_Champagne`):

- `Ch/n` (single or homozygous):
  - Chestnut base → Gold Champagne
  - Bay base → Amber Champagne
  - Black base → Classic Champagne
  - - Cream/n → add "Cream" to name: Gold Cream Champagne, Amber Cream Champagne, Classic Cream Champagne
  - - Dun → add "Dun": Gold Dun Champagne, Amber Dun Champagne, Classic Dun Champagne
  - - Cream + Dun → Gold Cream Dun Champagne, Amber Cream Dun Champagne, Classic Cream Dun Champagne
  - - Silver → Silver Gold Champagne → mapped to "Silver Amber Dun Champagne" (Silver only modifies black-based, but Champagne includes)

Pearl (`Prl_Pearl`):

- `prl/prl` (homozygous) → dilutes like single Cream:
  - Chestnut → Chestnut Pearl
  - Bay → Bay Pearl
  - Black → Black Pearl
- `prl/n` + `Cr/n` (pseudo-double-dilute) → same effect as `Cr/Cr`:
  - Chestnut → Cremello → "Palomino Pearl"
  - Bay → Perlino → "Buckskin Pearl"
  - Black → Smoky Cream → "Smoky Black Pearl" → mapped to "Smoky Black Pearl"

Mushroom (`MFSD12_Mushroom`):

- `M/N` only on chestnut base → "Mushroom Chestnut"
- No effect on bay or black

**AC3 — Pattern overlays applied after dilutions**

Priority order: Dominant White > Gray > Roan > Appaloosa > Tobiano > Frame Overo > Sabino > Splash White > Brindle

Gray (`G_Gray`):

- `G/g` or `G/G` → horse displays as graying-out pattern
- Display name based on shade_bias gray variants:
  - Young/dark: "Rose Gray", "Steel Gray"
  - Mid: "Rose Dark Dapple Gray", "Steel Dark Dapple Gray", "Rose Light Dapple Gray", "Steel Light Dapple Gray"
  - Light: "White Gray", "Fleabitten Gray"
  - Use genotypeHash to select sub-type from shade_bias["Steel Gray"] or "Rose Gray" etc.
- `isGray: true` in output

Roan (`Rn_Roan`):

- `Rn/rn` adds roan pattern to base color:
  - Chestnut base → Strawberry Roan
  - Bay base → Red Roan (or "Bay Roan" — use "Red Roan" as canonical)
  - Black base → Blue Roan
  - Silver Black → "Varnish Roan" (edge case)
- `isRoan: true` in output

Leopard Complex (`LP_LeopardComplex` + `PATN1_Pattern1`):

- `LP/lp` (heterozy only — `lp/lp` = no pattern):
  - Without PATN1 (`patn1/patn1`): Varnish Roan, Fewspot Leopard, Snowcap (genotypeHash-driven)
  - With `PATN1/patn1`: Blanket, Leopard, Heavy Snowflake Leopard, Light Snowflake Leopard, Moderate Snowflake Leopard, Heavy Frost Roan Varnish, Light Frost Roan Varnish, Moderate Frost Roan Varnish (genotypeHash-driven selection from shade_bias)
- `isAppaloosa: true` in output

Dominant White (`W_DominantWhite`):

- Any non-`w/w` allele (e.g. `W20/w`): "Dominant White"
- `isWhite: true` in output

Tobiano (`TO_Tobiano`):

- `TO/to` or `TO/TO`: adds "Tobiano" flag to output
- Does NOT change color name (e.g. "Bay Tobiano" is not a separate color; color = Bay, hasTobiano = true)

Frame Overo (`O_FrameOvero`):

- `O/n`: adds frame overo flag
- `hasFrameOvero: true` in output

Sabino1 (`SB1_Sabino1`):

- `SB1/n`: adds sabino flag
- `hasSabino: true` in output

Splash White (`SW_SplashWhite`):

- Any non-`n/n` allele: adds splash flag
- `hasSplash: true` in output

Brindle (`BR1_Brindle1`):

- `BR1/n`: "Brindle (Female)" (stored as display color in shade_bias)
- `isBrindle: true` in output

**AC4 — Shade selection (deterministic)**

- If the resolved `colorName` exists as a key in `shadeBias` (from breed profile), select a shade
  variant using a deterministic hash derived from the genotype (not random):
  `genotypeHash = djb2(JSON.stringify(sortedGenotype))`
  Then `shadeIndex = genotypeHash % shadeBias[colorName].length`
  (where shadeBias[colorName] is treated as weighted array — expand weights to array first)
- If `colorName` is not in `shadeBias`, `shade = 'standard'`
- Result stored as `phenotype.shade`

**AC5 — Phenotype structure**

```javascript
{
  colorName: 'Buckskin',          // string — primary display color
  shade: 'dark',                  // string — variant within color
  isGray: false,                  // boolean
  isRoan: false,                  // boolean
  isAppaloosa: false,             // boolean
  isWhite: false,                 // boolean
  hasTobiano: false,              // boolean
  hasFrameOvero: false,           // boolean
  hasSabino: false,               // boolean
  hasSplash: false,               // boolean
  isBrindle: false,               // boolean
}
```

**AC6 — Service is a pure function**

- `calculatePhenotype(genotype, shadeBias?)` takes genotype object + optional shadeBias map
- Returns phenotype object — no DB imports, no side effects
- Deterministic: same genotype + same shadeBias always returns same result

**AC7 — Integration into horse creation**

- `horseRoutes.mjs` POST / calls `calculatePhenotype(colorGenotype, breedProfile?.shade_bias)`
  immediately after `generateGenotype()`
- `phenotype` added to `horseData` object
- `horseModel.mjs` persists `phenotype` alongside `colorGenotype`
- Existing horses without `phenotype` are unaffected (field is nullable)

**AC8 — Tests**

- Unit tests: base color determination (all 3 base colors), each dilution, each pattern flag, null shadeBias fallback, deterministic output
- Integration test: POST /api/v1/horses response includes `phenotype.colorName` string and all boolean pattern fields

---

## Implementation Plan

### Step 1: Create phenotypeCalculationService.mjs

**File:** `backend/modules/horses/services/phenotypeCalculationService.mjs`

Design as a rule-driven engine:

```javascript
/**
 * phenotypeCalculationService.mjs
 *
 * Pure-function service for calculating horse coat color phenotype from genotype.
 * Deterministic: same genotype always produces same phenotype output.
 *
 * Used by: horseRoutes.mjs (POST /horses)
 * Story: 31E-1b — Phenotype Calculation Engine
 */

/**
 * djb2 hash for deterministic shade selection from genotype.
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0xFFFFFFFF; // keep 32-bit
  }
  return Math.abs(hash);
}

/**
 * Expand shade_bias weighted object to a flat array for index selection.
 * E.g. { dark: 0.3, light: 0.3, standard: 0.4 } → ['dark','dark','dark','light','light','light','standard','standard','standard','standard']
 * Uses 10 slots (multiply each weight by 10, round to integer slots).
 */
function expandShadesToArray(shadeObj) { ... }

/**
 * Determine base color from Extension + Agouti.
 */
function getBaseColor(genotype) {
  const ext = genotype.E_Extension;
  const ag = genotype.A_Agouti;
  if (ext === 'e/e') return 'chestnut';
  // black base (E present)
  if (ag === 'a/a') return 'black';
  return 'bay';
}

/**
 * Apply dilutions to base color in priority order.
 * Returns { colorName, dilutionFlags }
 */
function applyDilutions(baseColor, genotype) { ... }

/**
 * Apply pattern overlays, returning updated phenotype flags.
 */
function applyPatterns(genotype, phenotype) { ... }

/**
 * Select shade deterministically from breed shade_bias.
 */
function selectShade(colorName, shadeBias, genotypeHash) { ... }

/**
 * Main export: calculate full phenotype from genotype.
 *
 * @param {Object} genotype - colorGenotype from genotypeGenerationService
 * @param {Object|null} shadeBias - breed's shade_bias map (from breedGeneticProfile.shade_bias)
 * @returns {Object} phenotype
 */
export function calculatePhenotype(genotype, shadeBias = null) { ... }
```

### Step 2: Wire into horseRoutes.mjs POST /

In POST / handler, after `generateGenotype()`:

```javascript
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';

// Generate coat color genotype + phenotype (31E-1a + 31E-1b)
const colorGenotype = generateGenotype(breedGeneticProfile);
const phenotype = calculatePhenotype(colorGenotype, breedGeneticProfile?.shade_bias ?? null);
```

Add `phenotype` to `horseData`.

### Step 3: Update horseModel.mjs

Add `phenotype` to destructuring (after `colorGenotype`):

```javascript
colorGenotype,
phenotype,
```

Add to `prisma.horse.create` data (after colorGenotype line):

```javascript
...(phenotype && { phenotype }),
```

### Step 4: Write tests

**File:** `backend/__tests__/phenotypeCalculationService.test.mjs`

Test groups:

1. `getBaseColor` (via `calculatePhenotype` or exported helper) — all 3 base colors
2. Cream dilution — single (palomino, buckskin, smoky black), double (cremello, perlino, smoky cream)
3. Dun dilution — red dun, bay dun (grulla), grulla
4. Silver dilution — silver black, silver bay, silver grulla
5. Champagne — gold, amber, classic, + cream combinations
6. Pearl — homozygous and pseudo-double-dilute
7. Mushroom — only on chestnut
8. Pattern flags — gray, roan, appaloosa, tobiano, frame overo, sabino, splash, dominant white, brindle
9. `shade` — returns 'standard' when no shadeBias provided; uses deterministic hash when provided
10. Determinism — same genotype called twice returns identical result
11. Null genotype fallback — all-defaults genotype produces a valid colorName
12. Integration: POST /api/v1/horses response includes `phenotype.colorName` (string) and all boolean pattern fields

---

## Genotype → Color Name Reference Table

| E_Extension | A_Agouti | Cr_Cream | D_Dun   | Z_Silver | Ch_Champagne | Prl_Pearl | Result            |
| ----------- | -------- | -------- | ------- | -------- | ------------ | --------- | ----------------- |
| e/e         | any      | n/n      | nd2/nd2 | n/n      | n/n          | n/n       | Chestnut          |
| E/\*        | A/\*     | n/n      | nd2/nd2 | n/n      | n/n          | n/n       | Bay               |
| E/\*        | a/a      | n/n      | nd2/nd2 | n/n      | n/n          | n/n       | Black             |
| e/e         | any      | Cr/n     | nd2/nd2 | n/n      | n/n          | n/n       | Palomino          |
| E/\*        | A/\*     | Cr/n     | nd2/nd2 | n/n      | n/n          | n/n       | Buckskin          |
| E/\*        | a/a      | Cr/n     | nd2/nd2 | n/n      | n/n          | n/n       | Smoky Black       |
| e/e         | any      | Cr/Cr    | nd2/nd2 | n/n      | n/n          | n/n       | Cremello          |
| E/\*        | A/\*     | Cr/Cr    | nd2/nd2 | n/n      | n/n          | n/n       | Perlino           |
| E/\*        | a/a      | Cr/Cr    | nd2/nd2 | n/n      | n/n          | n/n       | Smoky Cream       |
| e/e         | any      | n/n      | D/nd2   | n/n      | n/n          | n/n       | Red Dun           |
| E/\*        | A/\*     | n/n      | D/nd2   | n/n      | n/n          | n/n       | Bay Dun           |
| E/\*        | a/a      | n/n      | D/nd2   | n/n      | n/n          | n/n       | Grulla            |
| E/\*        | a/a      | n/n      | nd2/nd2 | Z/n      | n/n          | n/n       | Silver Black      |
| E/\*        | A/\*     | n/n      | nd2/nd2 | Z/n      | n/n          | n/n       | Silver Bay        |
| e/e         | any      | n/n      | nd2/nd2 | n/n      | Ch/n         | n/n       | Gold Champagne    |
| E/\*        | A/\*     | n/n      | nd2/nd2 | n/n      | Ch/n         | n/n       | Amber Champagne   |
| E/\*        | a/a      | n/n      | nd2/nd2 | n/n      | Ch/n         | n/n       | Classic Champagne |
| e/e         | any      | n/n      | nd2/nd2 | n/n      | n/n          | prl/prl   | Chestnut Pearl    |
| E/\*        | A/\*     | n/n      | nd2/nd2 | n/n      | n/n          | prl/prl   | Bay Pearl         |
| E/\*        | a/a      | n/n      | nd2/nd2 | n/n      | n/n          | prl/prl   | Black Pearl       |
| e/e         | any      | n/n      | nd2/nd2 | n/n      | n/n          | n/n (M/N) | Mushroom Chestnut |

_Combined dilutions follow the rules in AC2. Use the shade_bias color name keys as the canonical color name list._

---

## Files to Create / Modify

| Action | File                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| CREATE | `backend/modules/horses/services/phenotypeCalculationService.mjs`                  |
| MODIFY | `backend/modules/horses/routes/horseRoutes.mjs` (import + call calculatePhenotype) |
| MODIFY | `backend/models/horseModel.mjs` (destructure + persist phenotype)                  |
| CREATE | `backend/__tests__/phenotypeCalculationService.test.mjs`                           |

---

## Dev Notes

- `shade_bias` is a map from color name → `{ shadeVariant: weight, ... }`. Both snake_case and
  space-separated variants appear in the data. Normalize keys when comparing.
- Gray horses are born with their underlying base color + gray gene; the display evolves in-game.
  For 31E-1b: `isGray = true` and `colorName` reflects the gray progression stage selected by
  genotypeHash (e.g. "Steel Gray", "Rose Gray", "White Gray").
- Appaloosa colors (Blanket, Leopard, Varnish Roan, Snowcap, etc.) are determined by
  `LP/lp` presence + `PATN1` presence — use genotypeHash to select the specific subtype from
  the shade_bias group (keys containing "Leopard", "Blanket", "Snowcap", "Varnish Roan",
  "Frost Roan Varnish", "Snowflake Leopard").
- The `EDXW` locus is an extension modifier — treat like `E_Extension = e/e` override when
  `EDXW1/EDXW2` or similar non-`n/n` allele is present.
- Do NOT implement `phenotype.markings` here — that is Story 31E-3.
- Do NOT implement breeding color probability prediction — that is Story 31E-5.
- `W_DominantWhite` non-`w/w` takes priority over all other patterns (horse appears white).
- Brindle is rare and sex-limited in most breeds; implement the flag but do not require sex validation in 31E-1b (that can be added in 31E-3).

---

## Tasks/Subtasks

- [x] Task 1: Create `phenotypeCalculationService.mjs` with `calculatePhenotype` + helpers
- [x] Task 2: Wire `calculatePhenotype` into POST /horses route (horseRoutes.mjs)
- [x] Task 3: Add `phenotype` to `horseModel.mjs` create destructuring + persistence
- [x] Task 4: Write unit tests covering all dilutions, patterns, shade, determinism
- [x] Task 5: Write integration test (POST /horses response includes phenotype fields)
- [x] Task 6: Lint check all changed files

---

## Dev Agent Record

### Implementation Notes (2026-04-01)

**AC1–AC3 — Phenotype engine:** `phenotypeCalculationService.mjs` implements the full rule chain:

1. `getBaseColor()` — Extension + Agouti → chestnut / bay / black
2. `applyDilutions()` — Cream (single/double), Dun, Silver, Champagne, Pearl, Mushroom in priority order
3. `resolveChampagneColor()` — champagne naming with cream/dun/silver stacking
4. `applyPatterns()` — Dominant White, Appaloosa (LP+PATN1), Gray, Roan, Tobiano, Frame Overo, Sabino, Splash, Brindle

**AC4 — Shade selection:** `djb2Hash(JSON.stringify(sortedGenotype))` seeds deterministic index into expanded shade_bias array. Same genotype → same hash → same shade always.

**AC5 — Phenotype structure:** Returns `{ colorName, shade, isGray, isRoan, isAppaloosa, isWhite, hasTobiano, hasFrameOvero, hasSabino, hasSplash, isBrindle }`.

**AC6 — Pure function:** No Prisma imports. No side effects. Deterministic given genotype + shadeBias.

**AC7 — Integration:** Wired in `horseRoutes.mjs` POST / after `generateGenotype()`. Uses `breedGeneticProfile?.shade_bias` from the same DB query already fetched for genotype. `phenotype` added to `horseData` and persisted via `horseModel.mjs`.

**AC8 — Tests:** 62/62 passing. 61 unit tests (base color × 5, cream × 6, dun × 4, silver × 4, champagne × 5, pearl × 6, mushroom × 3, gray × 3, roan × 4, appaloosa × 3, dominant white × 3, patterns × 6, shade × 4, determinism × 2, null fallback × 3) + 1 integration test.

### Completion Notes

All 8 ACs satisfied. 62 tests passing. 77 combined genotype+phenotype tests passing. Lint clean.

### Change Log

- 2026-04-01: Story 31E-1b implemented — phenotype calculation engine, horse creation wiring, 62 tests
