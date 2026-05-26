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

/**
 * Build a per-locus Set of breed-disallowed allele pairs from a breed profile's
 * `disallowed_combinations` (Equoria-26qjf.2).
 *
 * Shape mirrors LETHAL_COMBINATIONS: `{ locus: Set<allelePair> }`. A breed may
 * forbid genotypes that are not biologically lethal (e.g. AQH forbids the
 * dominant-white homozygotes W4/W4 and W20/W20 because the breed registry does
 * not recognise those). These are enforced exactly like lethals during
 * inheritance (reroll, then non-disallowed fallback).
 *
 * @param {Object|null} breedProfile - foal breed's breedGeneticProfile JSONB
 * @returns {Object} map of locus → Set of disallowed pairs (empty {} when none)
 */
export function buildDisallowedMap(breedProfile) {
  // JSONB type guard (CONTRIBUTING §1): null / non-object / array → no rules.
  if (
    breedProfile === null ||
    breedProfile === undefined ||
    typeof breedProfile !== 'object' ||
    Array.isArray(breedProfile)
  ) {
    return {};
  }
  const disallowed = breedProfile.disallowed_combinations;
  if (
    disallowed === null ||
    disallowed === undefined ||
    typeof disallowed !== 'object' ||
    Array.isArray(disallowed)
  ) {
    return {};
  }

  const map = {};
  for (const [locus, pairs] of Object.entries(disallowed)) {
    if (Array.isArray(pairs) && pairs.length > 0) {
      map[locus] = new Set(pairs);
    }
  }
  return map;
}

/**
 * Check whether an allele pair is forbidden for the given locus by the breed's
 * disallowed_combinations map (Equoria-26qjf.2).
 *
 * @param {Object} disallowedMap - output of buildDisallowedMap()
 * @param {string} locus - locus key
 * @param {string} allelePair - assembled pair
 * @returns {boolean}
 */
export function isDisallowedCombination(disallowedMap, locus, allelePair) {
  const set = disallowedMap?.[locus];
  return set ? set.has(allelePair) : false;
}

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
 *
 * NOTE (Equoria-k8d7, 2026-05-15): Every entry in LETHAL_COMBINATIONS is currently
 * a symmetric homozygous pair (e.g. 'O/O', 'W20/W20'). The reversed-pair check
 * that previously lived here was dead code under the current biological model.
 * If an asymmetric lethal becomes biologically known, restore reversed-ordering
 * logic with:
 *   const [a, b] = allelePair.split('/');
 *   if (lethalSet.has(`${b}/${a}`)) return true;
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
  return lethalSet.has(allelePair);
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
 * otherwise places the lethal allele first and the parent's wild-type partner second
 * (canonical carrier form: `O/n`, `W20/w`, etc.).
 *
 * Equoria-xb5k: The wild-type partner is derived from the parents' actual allele
 * pairs so loci with non-'n' wild-types (e.g. W_DominantWhite uses 'w', LP uses 'lp')
 * produce the correct carrier form rather than a hardcoded '/n'.
 *
 * @param {string[]} sireAlleles - splitAlleles result for sire
 * @param {string[]} damAlleles - splitAlleles result for dam
 * @returns {string}
 */
function buildHeterozygousFallback(sireAlleles, damAlleles) {
  const sireA = sireAlleles[0];
  const damA = damAlleles[0];
  if (sireA !== damA) {
    return `${sireA}/${damA}`;
  }
  // Both first alleles are the same lethal — find the wild-type partner from either parent's pair.
  // Prefer the sire's other allele; fall back to dam's; finally to 'n' if neither parent is a carrier.
  const sireWild = sireAlleles.find(a => a !== sireA);
  const damWild = damAlleles.find(a => a !== damA);
  const wildType = sireWild ?? damWild ?? 'n';
  return `${sireA}/${wildType}`;
}

// ---------------------------------------------------------------------------
// Per-locus inheritance
// ---------------------------------------------------------------------------

/**
 * Inherit a single locus from sire and dam alleles.
 * Rerolls up to MAX_REROLL_ATTEMPTS times if the result is a lethal combination.
 * Falls back to a non-lethal heterozygous form after exhausted attempts.
 *
 * Equoria-26qjf.2: an optional `disallowedSet` (breed-forbidden pairs for this
 * locus) is treated exactly like a lethal — rerolled, then avoided in fallback.
 *
 * @param {string} locus - locus key (e.g. 'O_FrameOvero')
 * @param {string} sireAllelePair - e.g. 'O/n'
 * @param {string} damAllelePair - e.g. 'O/n'
 * @param {Function} rng - random number generator
 * @param {Set<string>|undefined} disallowedSet - breed-disallowed pairs for this locus
 * @returns {string} foal allele pair
 */
export function inheritLocus(locus, sireAllelePair, damAllelePair, rng, disallowedSet) {
  const sireAlleles = splitAlleles(sireAllelePair);
  const damAlleles = splitAlleles(damAllelePair);

  const isForbidden = pair =>
    isLethalCombination(locus, pair) || (disallowedSet ? disallowedSet.has(pair) : false);

  for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
    const sireAllele = drawAllele(sireAlleles, rng);
    const damAllele = drawAllele(damAlleles, rng);
    const pair = assembleAllelePair(sireAllele, damAllele);

    if (!isForbidden(pair)) {
      return pair;
    }
  }

  // Fallback: could not produce a non-forbidden result in MAX_REROLL_ATTEMPTS attempts.
  logger.warn(
    `[breedingColorInheritanceService] Locus ${locus}: exhausted ${MAX_REROLL_ATTEMPTS} reroll attempts — using heterozygous fallback`,
  );
  const fallback = buildHeterozygousFallback(sireAlleles, damAlleles);
  // If even the heterozygous fallback is forbidden (e.g. both parents homozygous
  // for a disallowed/lethal allele), the post-inheritance enforceBreedRestrictions
  // pass will replace it with an allowed allele. Returning it here keeps inheritLocus
  // pure; the genotype-level guard is the authoritative final correction.
  return fallback;
}

// ---------------------------------------------------------------------------
// Breed restriction enforcement
// ---------------------------------------------------------------------------

/**
 * Enforce breed allele restrictions on the foal genotype.
 * Any locus whose value is not in `allowed_alleles[locus]` is replaced with
 * the first (most common by convention) allowed allele.
 *
 * Equoria-26qjf.2: after the allowed_alleles pass, any locus value still matching
 * the breed's disallowed_combinations is replaced with the first allowed allele
 * that is neither lethal nor disallowed. This is the authoritative final guard —
 * it catches the rare case where inheritLocus's reroll exhausted into a forbidden
 * heterozygous fallback, and the case where the inherited value is disallowed but
 * happened to be in allowed_alleles (a self-inconsistent profile).
 *
 * @param {Object} foalGenotype - the inherited genotype
 * @param {Object|null} foalBreedProfile - breed's breedGeneticProfile JSONB
 * @param {Object} disallowedMap - output of buildDisallowedMap() (per-locus Sets)
 * @returns {Object} genotype with breed restrictions applied
 */
function enforceBreedRestrictions(foalGenotype, foalBreedProfile, disallowedMap = {}) {
  const allowedAlleles = foalBreedProfile?.allowed_alleles ?? null;
  const restricted = { ...foalGenotype };

  // Pass 1 — allowed_alleles whitelist (unchanged behavior).
  if (allowedAlleles) {
    for (const [locus, allowed] of Object.entries(allowedAlleles)) {
      if (!Array.isArray(allowed) || allowed.length === 0) {
        continue;
      }
      if (restricted[locus] !== undefined && !allowed.includes(restricted[locus])) {
        // Equoria-tr50: Try each allowed allele in order, picking the first non-lethal one.
        // Equoria-26qjf.2: also skip allowed entries that are breed-disallowed, so the
        // whitelist replacement never re-introduces a forbidden genotype.
        let replacement = null;
        for (const candidate of allowed) {
          if (
            !isLethalCombination(locus, candidate) &&
            !isDisallowedCombination(disallowedMap, locus, candidate)
          ) {
            replacement = candidate;
            break;
          }
        }
        if (replacement === null) {
          logger.warn(
            `[breedingColorInheritanceService] enforceBreedRestrictions: every allowed allele for locus '${locus}' is lethal/disallowed — restriction skipped to preserve genotype`,
          );
          continue;
        }
        restricted[locus] = replacement;
      }
      // Loci in allowed_alleles but absent from the foal's inherited genotype are silently
      // omitted — the restriction only applies to loci that were actually inherited.
    }
  }

  // Pass 2 — disallowed_combinations blacklist (Equoria-26qjf.2). Authoritative final
  // guard: any surviving disallowed pair is replaced with the first allowed allele that
  // is itself neither lethal nor disallowed.
  for (const [locus, set] of Object.entries(disallowedMap)) {
    const value = restricted[locus];
    if (value === undefined || !set.has(value)) {
      continue;
    }
    const allowed = allowedAlleles?.[locus];
    let replacement = null;
    if (Array.isArray(allowed)) {
      for (const candidate of allowed) {
        if (
          !isLethalCombination(locus, candidate) &&
          !isDisallowedCombination(disallowedMap, locus, candidate)
        ) {
          replacement = candidate;
          break;
        }
      }
    }
    if (replacement === null) {
      // No usable allowed allele declared — fall back to the per-locus wild-type
      // (GENERIC_DEFAULTS), which is non-lethal and effectively never disallowed.
      const wildType = GENERIC_DEFAULTS[locus] ?? 'n/n';
      replacement =
        !isDisallowedCombination(disallowedMap, locus, wildType) &&
        !isLethalCombination(locus, wildType)
          ? wildType
          : null;
    }
    if (replacement === null) {
      logger.warn(
        `[breedingColorInheritanceService] enforceBreedRestrictions: no non-disallowed replacement for locus '${locus}' — leaving inherited value`,
      );
      continue;
    }
    restricted[locus] = replacement;
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

  // Equoria-26qjf.2: breed-disallowed pairs, treated like lethals during inheritance.
  const disallowedMap = buildDisallowedMap(foalBreedProfile);

  const foalGenotype = {};

  for (const locus of allLoci) {
    // If a locus is missing from a parent, use the per-locus GENERIC_DEFAULTS wild-type value
    // (e.g. D_Dun → 'nd2/nd2', not 'n/n'). Fall back to 'n/n' only for unknown loci.
    const locusDefault = GENERIC_DEFAULTS[locus] ?? 'n/n';
    const sireAllelePair = sireGenotype[locus] ?? locusDefault;
    const damAllelePair = damGenotype[locus] ?? locusDefault;

    foalGenotype[locus] = inheritLocus(
      locus,
      sireAllelePair,
      damAllelePair,
      rng,
      disallowedMap[locus],
    );
  }

  // Enforce foal breed restrictions (allowed_alleles whitelist + disallowed blacklist)
  return enforceBreedRestrictions(foalGenotype, foalBreedProfile, disallowedMap);
}
