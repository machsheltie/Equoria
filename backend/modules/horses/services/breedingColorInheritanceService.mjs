/**
 * breedingColorInheritanceService.mjs
 *
 * Pure-function service for Mendelian coat color inheritance.
 * Derives a foal's colorGenotype from sire + dam genotypes following standard
 * Mendelian inheritance: one random allele from each parent per locus.
 *
 * Lethal combinations (embryonic lethal) are detected immediately and rerolled
 * up to 100 times; heterozygous fallback used if still lethal after 100 attempts.
 *
 * Breed allele restrictions are enforced: loci producing allele pairs outside the
 * foal breed's `allowed_alleles` are overridden with the most common allowed allele.
 *
 * Used by: horseRoutes.mjs (POST /horses with sireId + damId)
 * Story: 31E-2 — Mendelian Breeding Inheritance + Lethal Filtering
 */

import { CORE_LOCI, GENERIC_DEFAULTS, generateGenotype } from './genotypeGenerationService.mjs';
import logger from '../../../utils/logger.mjs';

// ---------------------------------------------------------------------------
// Lethal combination constants (biological — not breed-specific)
// ---------------------------------------------------------------------------

/**
 * Map of locus → Set of lethal allele pairs.
 * These genotypes cause embryonic death or severe disease and must never appear
 * in a live foal's genotype. The reroll mechanism prevents them.
 *
 * Sources (PRD-02 §3.3):
 *   - O/O        : Lethal White Overo Syndrome (Frame Overo)
 *   - W5/W5 etc. : Embryonic lethal dominant white homozygotes
 *   - SW3-SW10 homozygous : Splash White embryonic lethal
 *   - EDXW1-EDXW3 homozygous : Extended dominant white embryonic lethal
 */
export const LETHAL_COMBINATIONS = {
  O_FrameOvero: new Set(['O/O']),
  W_DominantWhite: new Set([
    'W5/W5',
    'W10/W10',
    'W13/W13',
    'W15/W15',
    'W19/W19',
    'W20/W20',
    'W22/W22',
  ]),
  SW_SplashWhite: new Set([
    'SW3/SW3',
    'SW4/SW4',
    'SW5/SW5',
    'SW6/SW6',
    'SW7/SW7',
    'SW8/SW8',
    'SW9/SW9',
    'SW10/SW10',
  ]),
  EDXW: new Set(['EDXW1/EDXW1', 'EDXW2/EDXW2', 'EDXW3/EDXW3']),
};

/** Maximum reroll attempts before using the heterozygous fallback. */
const MAX_REROLL_ATTEMPTS = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split an allele pair string into a two-element array.
 * Handles homozygous (`E/E` → `['E', 'E']`) and heterozygous (`E/e` → `['E', 'e']`).
 *
 * @param {string} allelePair - e.g. 'E/e', 'Cr/n', 'nd2/nd2'
 * @returns {[string, string]} array of two alleles
 */
export function splitAlleles(allelePair) {
  if (!allelePair || typeof allelePair !== 'string') {
    return ['n', 'n'];
  }
  const parts = allelePair.split('/');
  if (parts.length !== 2) {
    // Edge case: malformed allele pair — treat as homozygous wild-type
    return [allelePair, allelePair];
  }
  return [parts[0], parts[1]];
}

/**
 * Check whether an allele pair is lethal for the given locus.
 * Checks both `A/B` and the reversed `B/A` form so that order-insensitive
 * asymmetric lethals are caught if added to LETHAL_COMBINATIONS in the future.
 *
 * @param {string} locus - genotype locus key (e.g. 'O_FrameOvero')
 * @param {string} allelePair - assembled pair (e.g. 'O/O')
 * @returns {boolean}
 */
export function isLethalCombination(locus, allelePair) {
  const lethalSet = LETHAL_COMBINATIONS[locus];
  if (!lethalSet) {
    return false;
  }
  if (lethalSet.has(allelePair)) {
    return true;
  }
  // Also check reversed ordering (B/A) so asymmetric future lethals are caught regardless of
  // sire/dam draw order.
  const parts = allelePair.split('/');
  if (parts.length === 2) {
    return lethalSet.has(`${parts[1]}/${parts[0]}`);
  }
  return false;
}

/**
 * Draw one allele from a parent's allele pair using the provided RNG.
 *
 * @param {string[]} alleles - two-element array from splitAlleles()
 * @param {Function} rng - random number generator (0 ≤ rng() < 1)
 * @returns {string}
 */
export function drawAllele(alleles, rng) {
  return rng() < 0.5 ? alleles[0] : alleles[1];
}

/**
 * Assemble a canonical allele pair from two individual alleles.
 * Order: sireAllele/damAllele (no sorting — downstream phenotype handles both orders).
 *
 * @param {string} sireAllele
 * @param {string} damAllele
 * @returns {string}
 */
export function assembleAllelePair(sireAllele, damAllele) {
  return `${sireAllele}/${damAllele}`;
}

/**
 * Build the heterozygous fallback for a locus when lethal rerolls are exhausted.
 * Uses the sire allele and dam allele directly in heterozygous form if they differ,
 * otherwise places the lethal allele first and the wild-type `n` second
 * (canonical carrier form: `O/n`, `W5/n`, etc.) matching the spec's specified fallback.
 *
 * @param {string} sireAllele
 * @param {string} damAllele
 * @returns {string}
 */
function buildHeterozygousFallback(sireAllele, damAllele) {
  if (sireAllele !== damAllele) {
    return `${sireAllele}/${damAllele}`;
  }
  // Both are the same lethal allele — carrier form: lethal allele first, wild-type n second
  return `${sireAllele}/n`;
}

// ---------------------------------------------------------------------------
// Per-locus inheritance
// ---------------------------------------------------------------------------

/**
 * Inherit a single locus from sire and dam alleles.
 * Rerolls up to MAX_REROLL_ATTEMPTS times if the result is a lethal combination.
 * Falls back to a non-lethal heterozygous form after exhausted attempts.
 *
 * @param {string} locus - locus key (e.g. 'O_FrameOvero')
 * @param {string} sireAllelePair - e.g. 'O/n'
 * @param {string} damAllelePair - e.g. 'O/n'
 * @param {Function} rng - random number generator
 * @returns {string} foal allele pair
 */
export function inheritLocus(locus, sireAllelePair, damAllelePair, rng) {
  const sireAlleles = splitAlleles(sireAllelePair);
  const damAlleles = splitAlleles(damAllelePair);

  for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
    const sireAllele = drawAllele(sireAlleles, rng);
    const damAllele = drawAllele(damAlleles, rng);
    const pair = assembleAllelePair(sireAllele, damAllele);

    if (!isLethalCombination(locus, pair)) {
      return pair;
    }
  }

  // Fallback: could not produce non-lethal result in MAX_REROLL_ATTEMPTS attempts
  logger.warn(
    `[breedingColorInheritanceService] Locus ${locus}: exhausted ${MAX_REROLL_ATTEMPTS} reroll attempts — using heterozygous fallback`,
  );
  return buildHeterozygousFallback(sireAlleles[0], damAlleles[0]);
}

// ---------------------------------------------------------------------------
// Breed restriction enforcement
// ---------------------------------------------------------------------------

/**
 * Enforce breed allele restrictions on the foal genotype.
 * Any locus whose value is not in `allowed_alleles[locus]` is replaced with
 * the first (most common by convention) allowed allele.
 *
 * @param {Object} foalGenotype - the inherited genotype
 * @param {Object|null} foalBreedProfile - breed's breedGeneticProfile JSONB
 * @returns {Object} genotype with breed restrictions applied
 */
function enforceBreedRestrictions(foalGenotype, foalBreedProfile) {
  if (!foalBreedProfile?.allowed_alleles) {
    return foalGenotype;
  }

  const allowedAlleles = foalBreedProfile.allowed_alleles;
  const restricted = { ...foalGenotype };

  for (const [locus, allowed] of Object.entries(allowedAlleles)) {
    if (!Array.isArray(allowed) || allowed.length === 0) {
      continue;
    }
    if (restricted[locus] !== undefined && !allowed.includes(restricted[locus])) {
      const replacement = allowed[0];
      // Guard: never install a lethal allele pair via breed restriction
      // (would bypass the reroll mechanism entirely).
      if (isLethalCombination(locus, replacement)) {
        logger.warn(
          `[breedingColorInheritanceService] enforceBreedRestrictions: breed profile requires lethal allele '${replacement}' for locus '${locus}' — restriction skipped to preserve non-lethal genotype`,
        );
        continue;
      }
      restricted[locus] = replacement;
    }
    // Loci in allowed_alleles but absent from the foal's inherited genotype are silently
    // omitted — the restriction only applies to loci that were actually inherited.
  }

  return restricted;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Derive a foal's coat color genotype via Mendelian inheritance from both parents.
 *
 * Algorithm per locus:
 *   1. Draw one allele randomly from the sire's pair
 *   2. Draw one allele randomly from the dam's pair
 *   3. Assemble as 'sireAllele/damAllele'
 *   4. If lethal → reroll up to 100 times, then heterozygous fallback
 *   5. After all loci: enforce foal breed's allowed_alleles restrictions
 *
 * Fallback: if either parent's colorGenotype is null/missing, delegates to
 * `generateGenotype()` for random breed-based generation.
 *
 * @param {Object|null} sireGenotype - sire's colorGenotype JSONB (or null)
 * @param {Object|null} damGenotype - dam's colorGenotype JSONB (or null)
 * @param {Object|null} foalBreedProfile - foal breed's breedGeneticProfile JSONB (or null)
 * @param {Function} rng - random number generator (defaults to Math.random)
 * @returns {Object} foal genotype: { E_Extension: "E/e", ... }
 */
export function inheritColorGenotype(
  sireGenotype,
  damGenotype,
  foalBreedProfile = null,
  rng = Math.random,
) {
  // Fallback: missing parent genotype → random generation
  if (!sireGenotype || typeof sireGenotype !== 'object' || Object.keys(sireGenotype).length === 0) {
    logger.warn(
      '[breedingColorInheritanceService] Sire colorGenotype missing — falling back to random generation',
    );
    return generateGenotype(foalBreedProfile, rng);
  }

  if (!damGenotype || typeof damGenotype !== 'object' || Object.keys(damGenotype).length === 0) {
    logger.warn(
      '[breedingColorInheritanceService] Dam colorGenotype missing — falling back to random generation',
    );
    return generateGenotype(foalBreedProfile, rng);
  }

  // Union of core loci + any extra loci from either parent
  const allLoci = [
    ...new Set([...CORE_LOCI, ...Object.keys(sireGenotype), ...Object.keys(damGenotype)]),
  ];

  const foalGenotype = {};

  for (const locus of allLoci) {
    // If a locus is missing from a parent, use the per-locus GENERIC_DEFAULTS wild-type value
    // (e.g. D_Dun → 'nd2/nd2', not 'n/n'). Fall back to 'n/n' only for unknown loci.
    const locusDefault = GENERIC_DEFAULTS[locus] ?? 'n/n';
    const sireAllelePair = sireGenotype[locus] ?? locusDefault;
    const damAllelePair = damGenotype[locus] ?? locusDefault;

    foalGenotype[locus] = inheritLocus(locus, sireAllelePair, damAllelePair, rng);
  }

  // Enforce foal breed restrictions
  return enforceBreedRestrictions(foalGenotype, foalBreedProfile);
}
