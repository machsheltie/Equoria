/**
 * breedProfileValidator.mjs (Equoria-hdyum)
 *
 * Runtime validator for breed genetic profiles. Originally lived in
 * backend/seed/populateBreedGeneticProfiles.mjs alongside the 12-canonical-
 * breed seed; extracted here when that seed was deleted as redundant against
 * populateBreedsFromSql.mjs (which seeds all 312 profiles from
 * backend/data/breeds/).
 *
 * Used by:
 *   - backend/modules/horses/__tests__/breedProfileData.test.mjs
 *     (every breed in backend/data/breedProfiles.json is well-formed)
 *
 * Future work: this validator could be wired into populateBreedsFromSql.mjs
 * as a pre-import gate so a malformed sample file is caught before the DB
 * receives it.
 */

/**
 * Canonical conformation regions every breed profile must carry.
 *
 * Equoria-f8qew (2026-06-02) added `topline` as the 8th region across all
 * 312 backend/data/breeds/*.txt source files. This list is the single
 * source of truth for "what regions a complete profile has" — exported
 * (Equoria-9cpop) so the source-completeness sentinel
 * (breedSourceConformationRegions.sentinel.test.mjs) asserts the .txt
 * files against the SAME list this runtime validator uses, rather than
 * duplicating the eight strings (which would re-introduce the drift class
 * the sentinel exists to catch).
 *
 * @type {readonly string[]}
 */
export const EXPECTED_CONFORMATION_REGIONS = Object.freeze([
  'head',
  'neck',
  'shoulders',
  'back',
  'hindquarters',
  'legs',
  'hooves',
  'topline',
]);

/**
 * Canonical core gaits every breed profile must carry, each with a finite
 * mean. (`gaiting` is the OPTIONAL 5th gait key — present-and-scored for
 * gaited breeds, null for non-gaited — and is therefore NOT in this required
 * set; its presence/nullness is governed by isGaitedBreed below.)
 *
 * Exported (Equoria-4xwj1) so the source-completeness sentinel
 * (breedSourceGaitsTemperament.sentinel.test.mjs) asserts the 312
 * backend/data/breeds/*.txt source files against the SAME list this runtime
 * validator uses, rather than duplicating the four strings (which would
 * re-introduce the drift class the sentinel exists to catch). Sibling of
 * EXPECTED_CONFORMATION_REGIONS (Equoria-9cpop).
 *
 * @type {readonly string[]}
 */
export const EXPECTED_GAITS = Object.freeze(['walk', 'trot', 'canter', 'gallop']);

/**
 * Canonical temperamentWeights keys every breed profile must carry. All 312
 * source files store exactly these 12 keys, each an integer, summing to 100
 * (verified 2026-06-02, Equoria-4xwj1 source audit; owner ruling 2026-10-21
 * renamed Playful to Driven and added Willing). These are the same 12
 * temperament categories the game's temperament system uses.
 *
 * Exported (Equoria-4xwj1) so the source-completeness sentinel shares ONE
 * source of truth with the runtime validator's temperament-weights check
 * below. EXPECTED_TEMPERAMENT_WEIGHT_KEYS.length is the canonical replacement
 * for the previously-private EXPECTED_TEMPERAMENT_COUNT magic number.
 *
 * @type {readonly string[]}
 */
export const EXPECTED_TEMPERAMENT_WEIGHT_KEYS = Object.freeze([
  'Spirited',
  'Nervous',
  'Calm',
  'Bold',
  'Steady',
  'Willing',
  'Independent',
  'Reactive',
  'Stubborn',
  'Driven',
  'Lazy',
  'Aggressive',
]);

/**
 * Sum every temperamentWeights map must equal (verified across all 312
 * source files). Exported so the sentinel asserts the same invariant the
 * runtime validator enforces.
 *
 * @type {number}
 */
export const EXPECTED_TEMPERAMENT_WEIGHT_SUM = 100;

/**
 * Validates a breed genetic profile object at runtime.
 * Returns an array of error strings; empty array means the profile is valid.
 *
 * Checks:
 *   - profile is a non-null object
 *   - ratingProfiles.conformation has the 8 expected regions, each with
 *     finite mean (0-100) and finite stdDev
 *   - ratingProfiles.gaits has the 4 required gaits (walk/trot/canter/gallop)
 *     with finite means; gaiting score required for isGaitedBreed=true and
 *     forbidden for isGaitedBreed=false
 *   - temperamentWeights is a 12-key map of integers summing to 100
 *
 * @param {number} _breedId - reserved for future breed-specific rules
 * @param {object} profile  - the profile to validate
 * @returns {string[]} - empty array on success; populated with one string per
 *   validation failure on error
 */
export function validateProfile(_breedId, profile) {
  const errors = [];

  if (profile === null || profile === undefined || typeof profile !== 'object') {
    errors.push('profile is null, undefined, or not an object');
    return errors;
  }

  if (!profile.ratingProfiles) {
    errors.push('missing ratingProfiles');
    return errors;
  }

  const rp = profile.ratingProfiles;

  // ── Conformation ────────────────────────────────────────────────────────
  // EXPECTED_CONFORMATION_REGIONS is the module-level exported constant
  // (Equoria-9cpop) — shared with the source-completeness sentinel so both
  // validate against one canonical list.
  const conformation = rp.conformation ?? {};
  const conformationKeys = Object.keys(conformation);

  if (conformationKeys.length !== EXPECTED_CONFORMATION_REGIONS.length) {
    errors.push(
      `conformation has ${conformationKeys.length} regions, expected ${EXPECTED_CONFORMATION_REGIONS.length}`,
    );
  }

  for (const region of EXPECTED_CONFORMATION_REGIONS) {
    if (!conformation[region]) {
      errors.push(`missing conformation region: ${region}`);
      continue;
    }
    const { mean, stdDev } = conformation[region];
    if (!Number.isFinite(mean)) {
      errors.push(`conformation.${region}.mean is not a finite number`);
    } else if (mean < 0 || mean > 100) {
      errors.push(`conformation.${region}.mean out of range (got ${mean})`);
    }
    if (!Number.isFinite(stdDev)) {
      errors.push(`conformation.${region}.stdDev is not a finite number`);
    }
  }

  // ── Gaits ────────────────────────────────────────────────────────────────
  // EXPECTED_GAITS is the module-level exported constant (Equoria-4xwj1) —
  // shared with the source-completeness sentinel so both validate against one
  // canonical list. `gaiting` is intentionally NOT in this set; its
  // presence/nullness is governed by isGaitedBreed just below.
  const gaits = rp.gaits ?? {};
  const isGaited = rp.isGaitedBreed === true;

  for (const gait of EXPECTED_GAITS) {
    if (!gaits[gait]) {
      errors.push(`missing gait: ${gait}`);
      continue;
    }
    if (!Number.isFinite(gaits[gait].mean)) {
      errors.push(`gaits.${gait}.mean is not a finite number`);
    }
  }

  if (isGaited) {
    if (gaits.gaiting === null || gaits.gaiting === undefined) {
      errors.push('gaited breed must have non-null gaiting score');
    }
    if (!Array.isArray(rp.gaitedGaitRegistry) || rp.gaitedGaitRegistry.length === 0) {
      errors.push('gaited breed must have non-empty gaitedGaitRegistry');
    }
  } else if (gaits.gaiting !== null && gaits.gaiting !== undefined) {
    errors.push('non-gaited breed must have null gaiting score');
  }

  // ── Temperament weights ──────────────────────────────────────────────────
  // EXPECTED_TEMPERAMENT_WEIGHT_KEYS / _SUM are the module-level exported
  // constants (Equoria-4xwj1) — shared with the source-completeness sentinel.
  const tw = profile.temperamentWeights ?? {};
  const twKeys = Object.keys(tw);

  if (twKeys.length !== EXPECTED_TEMPERAMENT_WEIGHT_KEYS.length) {
    errors.push(
      `temperamentWeights has ${twKeys.length} keys, expected ${EXPECTED_TEMPERAMENT_WEIGHT_KEYS.length}`,
    );
  }

  let twSum = 0;
  for (const [key, val] of Object.entries(tw)) {
    if (!Number.isInteger(val)) {
      errors.push(`temperamentWeights.${key} is not an integer`);
    }
    twSum += val;
  }

  if (twSum !== EXPECTED_TEMPERAMENT_WEIGHT_SUM) {
    errors.push(`temperament weights sum to ${twSum}, expected ${EXPECTED_TEMPERAMENT_WEIGHT_SUM}`);
  }

  return errors;
}
