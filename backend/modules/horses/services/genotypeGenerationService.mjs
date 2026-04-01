/**
 * genotypeGenerationService.mjs
 *
 * Pure-function service for generating horse coat color genotypes.
 * Reads breed allele weights and allowed alleles from the breedGeneticProfile JSONB.
 * No Prisma imports — caller handles DB persistence.
 *
 * Used by: horseRoutes.mjs (POST /horses), horseController.mjs (createFoal)
 * Story: 31E-1a — Genotype Generation Service + Migration
 */

// Core 17 loci always present in generated genotype output
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

/**
 * Generic fallback alleles used when the breed has no profile or a locus is absent.
 * These represent the most common "wild-type" or homozygous non-expressing states.
 */
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

/**
 * Select a weighted random allele pair from a weight map.
 * Weights are keyed by genotype pair (e.g. "E/e": 0.4, "E/E": 0.2, "e/e": 0.4).
 * Weights should sum to ~1.0; floating-point safety: last entry is the fallback.
 *
 * @param {Object} weights - { "genotypePair": probability }
 * @param {Function} rng - random number generator (defaults to Math.random for testability)
 * @returns {string} selected allele pair
 */
export function sampleWeightedAllele(weights, rng = Math.random) {
  const entries = Object.entries(weights);
  if (entries.length === 0) {
    return null;
  }

  const roll = rng();
  let cumulative = 0;

  for (const [allele, prob] of entries) {
    cumulative += prob;
    if (roll <= cumulative) {
      return allele;
    }
  }

  // Floating-point safety: return last entry if roll > sum due to rounding
  return entries[entries.length - 1][0];
}

/**
 * Generate a complete coat color genotype for a horse given its breed genetic profile.
 * Always includes all 17 CORE_LOCI plus any additional loci present in the breed profile.
 *
 * Selection priority per locus:
 *   1. allele_weights[locus] present → weighted random sampling
 *   2. allowed_alleles[locus] present (no weights) → first entry (most common by convention)
 *   3. Neither present → GENERIC_DEFAULTS fallback
 *
 * @param {Object|null} breedGeneticProfile - the breed's JSONB profile from DB
 * @param {Function} rng - optional RNG for deterministic testing
 * @returns {Object} genotype: { E_Extension: "E/e", A_Agouti: "A/A", ... }
 */
export function generateGenotype(breedGeneticProfile, rng = Math.random) {
  const allowedAlleles = breedGeneticProfile?.allowed_alleles ?? {};
  const alleleWeights = breedGeneticProfile?.allele_weights ?? {};

  // Union of core loci + any extra loci in the breed profile
  const profileLoci = Object.keys(allowedAlleles);
  const allLoci = [...new Set([...CORE_LOCI, ...profileLoci])];

  const genotype = {};

  for (const locus of allLoci) {
    const weights = alleleWeights[locus];
    const allowed = allowedAlleles[locus];

    if (weights && Object.keys(weights).length > 0) {
      // Weighted sampling from breed-specific distribution
      genotype[locus] = sampleWeightedAllele(weights, rng);
    } else if (allowed && allowed.length > 0) {
      // Equal-weight fallback: first entry is most common by convention
      genotype[locus] = allowed[0];
    } else {
      // Unknown locus with no breed data: use generic default
      genotype[locus] = GENERIC_DEFAULTS[locus] ?? 'n/n';
    }
  }

  return genotype;
}
