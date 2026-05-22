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
 * Exported so that breedingColorInheritanceService can use the correct per-locus default
 * when a parent's sparse genotype is missing a locus (instead of hardcoding 'n/n').
 */
export const GENERIC_DEFAULTS = {
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
 * GENERIC_STARTER_WEIGHTS (Equoria-mvrvb)
 *
 * Realistic population-level allele-pair frequencies used when NO breed genetic
 * profile is available (e.g. the starter horse minted at user registration, and
 * the fixtureColor() default path). Sampling from these instead of the fixed
 * GENERIC_DEFAULTS set is what gives starter horses a varied, plausible coat-color
 * distribution instead of a 100%-Bay monoculture.
 *
 * WHY a separate map (not a change to GENERIC_DEFAULTS):
 *   GENERIC_DEFAULTS is the per-locus WILD-TYPE fill that
 *   breedingColorInheritanceService uses for sparse parents — it MUST stay fixed
 *   and non-random. This map is only consumed by the no-profile generation path.
 *
 * Design notes (frequencies are illustrative of real domestic-horse populations,
 * not breed-specific):
 *   - E_Extension / A_Agouti drive the base color (chestnut vs bay/seal/black).
 *     Chestnut (e/e) is intentionally common so starters are not black-base-only.
 *   - Dilutions (Cream/Dun/Silver/Champagne/Pearl) and Gray/Roan are kept at modest
 *     real-world rates so most starters are solid base colors, with occasional
 *     palominos, buckskins, grays, roans, duns.
 *   - Pattern loci (white-spotting, leopard complex, dominant white, etc.) are
 *     held at near-wild-type so starter horses don't spawn rare pinto/appaloosa
 *     patterns; pattern variety is reserved for bred horses with real profiles.
 *   - Every weight map's keys are valid allele pairs for that locus (mirrors the
 *     allowed-allele vocabulary the breed profiles use).
 */
export const GENERIC_STARTER_WEIGHTS = Object.freeze({
  E_Extension: { 'E/e': 0.4, 'e/e': 0.4, 'E/E': 0.2 },
  A_Agouti: { 'A/a': 0.4, 'A/A': 0.3, 'a/a': 0.3 },
  Cr_Cream: { 'n/n': 0.86, 'Cr/n': 0.12, 'Cr/Cr': 0.02 },
  D_Dun: { 'nd2/nd2': 0.9, 'nd1/nd2': 0.06, 'D/nd2': 0.04 },
  Z_Silver: { 'n/n': 0.97, 'Z/n': 0.03 },
  Ch_Champagne: { 'n/n': 0.98, 'Ch/n': 0.02 },
  G_Gray: { 'g/g': 0.85, 'G/g': 0.15 },
  Rn_Roan: { 'rn/rn': 0.92, 'Rn/rn': 0.08 },
  W_DominantWhite: { 'w/w': 0.995, 'W20/w': 0.005 },
  TO_Tobiano: { 'to/to': 0.95, 'TO/to': 0.05 },
  O_FrameOvero: { 'n/n': 0.97, 'O/n': 0.03 },
  SB1_Sabino1: { 'n/n': 0.9, 'SB1/n': 0.1 },
  SW_SplashWhite: { 'n/n': 0.95, 'SW1/n': 0.05 },
  LP_LeopardComplex: { 'lp/lp': 0.98, 'LP/lp': 0.02 },
  PATN1_Pattern1: { 'patn1/patn1': 0.97, 'PATN1/patn1': 0.03 },
  EDXW: { 'n/n': 1.0 },
  MFSD12_Mushroom: { 'N/N': 0.98, 'M/N': 0.02 },
});

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
 * No-profile path (Equoria-mvrvb): when breedGeneticProfile is null/undefined,
 * the generic GENERIC_STARTER_WEIGHTS distribution is used so starter / fixture
 * horses get a varied, realistic coat color instead of always resolving to Bay.
 *
 * @param {Object|null} breedGeneticProfile - the breed's JSONB profile from DB
 * @param {Function} rng - optional RNG for deterministic testing
 * @returns {Object} genotype: { E_Extension: "E/e", A_Agouti: "A/A", ... }
 */
export function generateGenotype(breedGeneticProfile, rng = Math.random) {
  // No breed profile → sample from the generic starter distribution rather than
  // the fixed GENERIC_DEFAULTS (which always yields Bay). Synthesizing a profile
  // keeps a single weighted-sampling code path below.
  const effectiveProfile =
    breedGeneticProfile &&
    typeof breedGeneticProfile === 'object' &&
    !Array.isArray(breedGeneticProfile)
      ? breedGeneticProfile
      : { allele_weights: GENERIC_STARTER_WEIGHTS };

  const allowedAlleles = effectiveProfile?.allowed_alleles ?? {};
  const alleleWeights = effectiveProfile?.allele_weights ?? {};

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
