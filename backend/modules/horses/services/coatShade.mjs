/**
 * Coat shade selection (split out of phenotypeCalculationService.mjs, Equoria-de7ts).
 *
 * A breed's shadeBias maps each color to { shade: weight }. The shade is either
 * picked from the genotype hash (deterministic; the default) or, for a breed
 * whose profile says "shadeSelection": "rolled", rolled by the weights.
 */

/**
 * Expand a shadeBias weight map into a flat array of shade strings for index-based selection.
 * Weights are scaled to 10 slots (0.1 precision).
 * E.g. { dark: 0.3, light: 0.3, standard: 0.4 } → 3×'dark', 3×'light', 4×'standard'
 *
 * @param {Object} shadeObj - { shadeName: probability }
 * @returns {string[]}
 */
function expandShadesToArray(shadeObj) {
  const arr = [];
  for (const [shade, weight] of Object.entries(shadeObj)) {
    const slots = Math.max(1, Math.round(weight * 10));
    for (let i = 0; i < slots; i++) {
      arr.push(shade);
    }
  }
  return arr;
}

/**
 * Select the shade from breed shadeBias for the given colorName: by shadeRng when
 * given (rolled by weight), else by genotypeHash (deterministic).
 *
 * @param {string} colorName
 * @param {Object|null} shadeBias - breed's shadeBias map
 * @param {number} genotypeHash
 * @param {(() => number)|null} [shadeRng]
 * @returns {string} shade string
 */
export function selectShade(colorName, shadeBias, genotypeHash, shadeRng) {
  if (!shadeBias || typeof shadeBias !== 'object') {
    return 'standard';
  }

  const shadeObj = shadeBias[colorName];
  if (!shadeObj || typeof shadeObj !== 'object') {
    return 'standard';
  }

  const shadeArray = expandShadesToArray(shadeObj);
  if (shadeArray.length === 0) {
    return 'standard';
  }

  // Equoria-de7ts: a rolled shade follows the weights. The genotype hash cannot:
  // a breed's few common genotypes each fix one shade, so some shades of a color
  // came up almost never (one Bay shade 23 times in ~20,000 Saddlebred bays).
  const index =
    typeof shadeRng === 'function'
      ? Math.min(shadeArray.length - 1, Math.floor(shadeRng() * shadeArray.length))
      : genotypeHash % shadeArray.length;
  return shadeArray[index];
}

/**
 * The shade roll for a new horse of this breed, or null to keep the genotype-hash
 * shade. Only a breed whose profile says "shadeSelection": "rolled" rolls its
 * shades (American Saddlebred, Equoria-de7ts); other breeds are unchanged until
 * the owner decides.
 *
 * @param {Object|null} breedGeneticProfile
 * @param {() => number} [rng]
 * @returns {(() => number)|null}
 */
export function shadeRollFor(breedGeneticProfile, rng = Math.random) {
  return breedGeneticProfile?.shadeSelection === 'rolled' ? rng : null;
}
