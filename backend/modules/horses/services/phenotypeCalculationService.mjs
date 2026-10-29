/**
 * phenotypeCalculationService.mjs
 *
 * Pure-function service for calculating horse coat color phenotype from genotype.
 * Deterministic: same genotype always produces same phenotype output.
 *
 * Used by: horseRoutes.mjs (POST /horses)
 * Story: 31E-1b — Phenotype Calculation Engine
 */

import { selectShade } from './coatShade.mjs';
import { dilutedColorName, dominantWhiteName, familyShadeName } from './coatColorNaming.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * djb2 hash for deterministic shade selection derived from genotype.
 * Returns a non-negative 32-bit integer.
 *
 * @param {string} str
 * @returns {number}
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & 0xffffffff; // keep 32-bit
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Pattern overlays
// ---------------------------------------------------------------------------

/** Appaloosa names for the full LP pattern (LP + PATN1), chosen by genotype hash. */
export const appaloosaPatternNames = Object.freeze([
  'Blanket',
  'Leopard',
  'Heavy Snowflake Leopard',
  'Light Snowflake Leopard',
  'Moderate Snowflake Leopard',
  'Heavy Frost Roan Varnish',
  'Light Frost Roan Varnish',
  'Moderate Frost Roan Varnish',
]);
/** Appaloosa names for the minimal LP pattern (LP without PATN1). */
export const appaloosaMinimalNames = Object.freeze(['Varnish Roan', 'Fewspot Leopard', 'Snowcap']);
/**
 * Grey names, chosen by genotype hash. Equoria-erfm: the first is the early-stage
 * default. Owner rulings q311 (2026-10-29): the owner's names, spelled grey; the
 * dark dapples merge into dapple grey and rose grey (portrait match q269). The
 * list keeps all nine slots so each genotype keeps the grey it had.
 */
export const greyColorNames = Object.freeze([
  'Dapple Grey',
  'Steel Grey',
  'Rose Grey',
  'White Grey',
  'Fleabitten Grey',
  'Dapple Grey',
  'Light Dapple Grey',
  'Rose Grey',
  'Rose Grey',
]);

/**
 * Apply pattern overlays to the phenotype and name the color.
 * Patterns add boolean flags and may override colorName (dominant white, appaloosa,
 * grey, brindle). Roan is part of the diluted name (coatColorNaming.mjs) unless grey
 * or appaloosa hides it.
 *
 * @param {Object} genotype
 * @param {number} genotypeHash - deterministic hash for subtype selection
 * @returns {Object} { colorName, isGrey, isRoan, isAppaloosa, isWhite, hasTobiano, hasFrameOvero, hasSabino, hasSplash, isBrindle, isFemaleOnly }
 */
function applyPatterns(genotype, genotypeHash) {
  const result = {
    colorName: 'Unknown',
    isGrey: false,
    isRoan: false,
    isAppaloosa: false,
    isWhite: false,
    hasTobiano: false,
    hasFrameOvero: false,
    hasSabino: false,
    hasSplash: false,
    isBrindle: false,
    isFemaleOnly: false, // Equoria-er4n: split out of colorName parenthetical
  };

  // --- Dominant White (highest priority; q315 names) ---
  const whiteName = dominantWhiteName(genotype.W_DominantWhite);
  if (whiteName) {
    result.colorName = whiteName;
    result.isWhite = true;
    return result; // White overrides all other patterns
  }

  // --- Appaloosa (LP_LeopardComplex) ---
  const lp = genotype.LP_LeopardComplex ?? 'lp/lp';
  const patn1 = genotype.PATN1_Pattern1 ?? 'patn1/patn1';
  const hasLP = lp === 'LP/lp' || lp === 'LP/LP';
  const hasPATN1 = patn1 === 'PATN1/patn1' || patn1 === 'PATN1/PATN1';

  // --- Grey --- (equal-weighted subtypes via hash)
  const g = genotype.G_Gray ?? 'g/g';
  const hasGrey = g === 'G/g' || g === 'G/G';

  // --- Roan: shows unless grey or appaloosa hides it ---
  const rn = genotype.Rn_Roan ?? 'rn/rn';
  result.isRoan = (rn === 'Rn/rn' || rn === 'Rn/Rn') && !hasGrey && !hasLP;

  if (hasGrey) {
    result.isGrey = true;
    result.isAppaloosa = hasLP;
    result.colorName = greyColorNames[genotypeHash % greyColorNames.length];
  } else if (hasLP) {
    result.isAppaloosa = true;
    const names = hasPATN1 ? appaloosaPatternNames : appaloosaMinimalNames;
    result.colorName = names[genotypeHash % names.length];
  } else {
    result.colorName = dilutedColorName(genotype, result.isRoan);
  }

  // --- Tobiano ---
  const to = genotype.TO_Tobiano ?? 'to/to';
  if (to === 'TO/to' || to === 'TO/TO') {
    result.hasTobiano = true;
  }

  // --- Frame Overo ---
  const o = genotype.O_FrameOvero ?? 'n/n';
  if (o === 'O/n' || o === 'O/O') {
    result.hasFrameOvero = true;
  }

  // --- Sabino1 ---
  const sb1 = genotype.SB1_Sabino1 ?? 'n/n';
  if (sb1 === 'SB1/n' || sb1 === 'SB1/SB1') {
    result.hasSabino = true;
  }

  // --- Splash White ---
  const sw = genotype.SW_SplashWhite ?? 'n/n';
  if (sw !== 'n/n') {
    result.hasSplash = true;
  }

  // --- Brindle ---
  // Equoria-er4n: '(Female)' parenthetical metadata moved out of colorName
  // into the isFemaleOnly flag — colorName is now just 'Brindle'.
  const br1 = genotype.BR1_Brindle1 ?? 'n/n';
  if (br1 !== 'n/n' && !result.isWhite) {
    result.isBrindle = true;
    result.isFemaleOnly = true;
    result.colorName = 'Brindle';
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculate the full coat color phenotype from a horse's color genotype.
 * Deterministic: same genotype + same shadeBias always returns identical output,
 * unless a shadeRng is passed, which rolls the shade by its shadeBias weights.
 *
 * @param {Object} genotype - colorGenotype from genotypeGenerationService
 * @param {Object|null} shadeBias - breed's shadeBias map (from breedGeneticProfile.shadeBias)
 * @param {(() => number)|null} [shadeRng] - rolls the shade by weight (new horses)
 * @returns {Object} phenotype
 */
export function calculatePhenotype(genotype, shadeBias = null, shadeRng = null) {
  // Equoria-liy7c: full four-part JSONB guard. Adding the !Array.isArray check
  // (typeof [] === 'object') ensures an array-shaped colorGenotype on a legacy
  // row resolves to the safe 'Unknown' phenotype rather than silently reading
  // undefined locus keys off the array.
  if (
    !genotype ||
    typeof genotype !== 'object' ||
    Array.isArray(genotype) ||
    Object.keys(genotype).length === 0
  ) {
    return {
      colorName: 'Unknown',
      shade: 'standard',
      isGrey: false,
      isRoan: false,
      isAppaloosa: false,
      isWhite: false,
      hasTobiano: false,
      hasFrameOvero: false,
      hasSabino: false,
      hasSplash: false,
      isBrindle: false,
      isFemaleOnly: false,
    };
  }

  // Deterministic hash from sorted genotype for subtype selection
  const sortedKeys = Object.keys(genotype).sort();
  const sortedGenotype = {};
  for (const k of sortedKeys) {
    sortedGenotype[k] = genotype[k];
  }
  const genotypeHash = djb2Hash(JSON.stringify(sortedGenotype));

  // 1. Name the color: base, dilutions and pattern overlays
  const patterns = applyPatterns(genotype, genotypeHash);

  // 2. Select shade; a color family's shade picks the owner's name (Bay + dark = Mahogany Bay)
  const rolledShade = selectShade(patterns.colorName, shadeBias, genotypeHash, shadeRng);
  const { colorName, shade } = familyShadeName(patterns.colorName, rolledShade, genotypeHash);

  return {
    colorName,
    shade,
    isGrey: patterns.isGrey,
    isRoan: patterns.isRoan,
    isAppaloosa: patterns.isAppaloosa,
    isWhite: patterns.isWhite,
    hasTobiano: patterns.hasTobiano,
    hasFrameOvero: patterns.hasFrameOvero,
    hasSabino: patterns.hasSabino,
    hasSplash: patterns.hasSplash,
    isBrindle: patterns.isBrindle,
    isFemaleOnly: patterns.isFemaleOnly,
  };
}

/**
 * calculatePhenotype for a new horse of a breed: its shade is rolled by the breed's
 * shade weights (owner ruling q277, 2026-10-29: every breed rolls shades by its
 * stated odds; the genotype hash followed a breed's few common genotypes instead).
 *
 * @param {Object} genotype
 * @param {Object|null} breedGeneticProfile
 * @param {() => number} [rng]
 * @returns {Object} phenotype
 */
export function calculateBreedPhenotype(genotype, breedGeneticProfile, rng = Math.random) {
  return calculatePhenotype(genotype, breedGeneticProfile?.shadeBias ?? null, rng);
}
