/**
 * allelePairRules.mjs
 *
 * Allele-pair rules shared by coat colour generation and inheritance: lethal
 * pairs, breed-disallowed pairs, the canonical spelling of a pair, and an
 * order-free key for comparing pairs. Pure functions, no imports, so both
 * genotypeGenerationService and breedingColorInheritanceService can use them
 * without a circular import (Equoria-piiof).
 */

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
export const lethalCombinations = {
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

/**
 * Build a per-locus Set of breed-disallowed allele pairs from a breed profile's
 * `disallowedCombinations` (Equoria-26qjf.2).
 *
 * Shape: `{ locus: Set<allelePairKey> }` (order-free keys). A breed may
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
  const disallowed = breedProfile.disallowedCombinations;
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
      // Equoria-i5ah4: order-free keys, so 'W20/W4' matches a rule written 'W4/W20'.
      map[locus] = new Set(pairs.map(allelePairKey));
    }
  }
  return map;
}

/**
 * Check whether an allele pair is forbidden for the given locus by the breed's
 * disallowedCombinations map (Equoria-26qjf.2).
 *
 * @param {Object} disallowedMap - output of buildDisallowedMap()
 * @param {string} locus - locus key
 * @param {string} allelePair - assembled pair
 * @returns {boolean}
 */
export function isDisallowedCombination(disallowedMap, locus, allelePair) {
  const set = disallowedMap?.[locus];
  return set ? set.has(allelePairKey(allelePair)) : false;
}

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
 * NOTE (Equoria-k8d7, 2026-05-15): Every entry in lethalCombinations is currently
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
  const lethalSet = lethalCombinations[locus];
  if (!lethalSet) {
    return false;
  }
  return lethalSet.has(allelePair);
}

/**
 * Per-locus allele order, most dominant first (Equoria-yp4sa). An allele not
 * listed for its locus (a W, SW or EDXW variant, Mushroom M/Mu, Brindle br1,
 * Pearl's cr) ranks ahead of every listed allele, so the wild-type always goes
 * second. Phenotype reads the dominant-first spelling (Z/n, Ch/n, G/g, TO/to).
 */
const alleleDominanceOrder = {
  E_Extension: ['E', 'e'],
  A_Agouti: ['A', 'At', 'a'],
  Cr_Cream: ['Cr', 'n'],
  D_Dun: ['D', 'nd1', 'nd2'],
  Z_Silver: ['Z', 'n'],
  Ch_Champagne: ['Ch', 'n'],
  G_Gray: ['G', 'g'],
  Rn_Roan: ['Rn', 'rn'],
  W_DominantWhite: ['w'],
  TO_Tobiano: ['TO', 'to'],
  O_FrameOvero: ['O', 'n'],
  SB1_Sabino1: ['SB1', 'n'],
  SW_SplashWhite: ['n'],
  LP_LeopardComplex: ['LP', 'lp'],
  PATN1_Pattern1: ['PATN1', 'patn1'],
  EDXW: ['n'],
  MFSD12_Mushroom: ['N'],
  Prl_Pearl: ['prl', 'n'],
  BR1_Brindle1: ['n'],
};

/** Wild-type order for a locus with no entry above. */
const unknownLocusOrder = ['n', 'N'];

function alleleRank(order, allele) {
  return order.indexOf(allele);
}

/**
 * The one spelling of an allele pair for its locus: dominant allele first
 * (Equoria-yp4sa), so a foal's pair never depends on which parent gave which
 * allele. Ties between two unlisted alleles sort by name (W4/W20, not W20/W4).
 *
 * @param {string} locus
 * @param {string} pair - e.g. 'n/Z'
 * @returns {string} e.g. 'Z/n'
 */
export function canonicalAllelePair(locus, pair) {
  const [first, second] = splitAlleles(pair);
  const order = alleleDominanceOrder[locus] ?? unknownLocusOrder;
  const firstRank = alleleRank(order, first);
  const secondRank = alleleRank(order, second);
  let swap;
  if (firstRank === secondRank) {
    swap = first.localeCompare(second, 'en', { numeric: true }) > 0;
  } else {
    // -1 (unlisted) ranks ahead of any listed allele.
    swap = firstRank !== -1 && (secondRank === -1 || secondRank < firstRank);
  }
  return swap ? `${second}/${first}` : `${first}/${second}`;
}

/**
 * An order-free key for comparing pairs (Equoria-i5ah4): 'a/A' and 'A/a' match.
 *
 * @param {string} pair
 * @returns {string}
 */
export function allelePairKey(pair) {
  return splitAlleles(pair).slice().sort().join('/');
}
