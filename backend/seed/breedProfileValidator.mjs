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
 *   - backend/modules/horses/__tests__/breedGeneticProfiles.test.mjs
 *     (validates the 12 canonical hand-authored profiles in
 *     breedGeneticProfiles.mjs are still well-formed; this assertion is
 *     orthogonal to the DB seeding pipeline and stays after the 12-only
 *     seed is gone)
 *
 * Future work: this validator could be wired into populateBreedsFromSql.mjs
 * as a pre-import gate so a malformed sample file is caught before the
 * canonical DB receives it. Filed as a separate concern under Equoria-fc78a's
 * follow-ups when the canonical-12 in-memory map is deprecated.
 */

/**
 * Validates a breed genetic profile object at runtime.
 * Returns an array of error strings; empty array means the profile is valid.
 *
 * Checks:
 *   - profile is a non-null object
 *   - rating_profiles.conformation has the 8 expected regions, each with
 *     finite mean (0-100) and finite std_dev
 *   - rating_profiles.gaits has the 4 required gaits (walk/trot/canter/gallop)
 *     with finite means; gaiting score required for is_gaited_breed=true and
 *     forbidden for is_gaited_breed=false
 *   - temperament_weights is an 11-key map of integers summing to 100
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

  if (!profile.rating_profiles) {
    errors.push('missing rating_profiles');
    return errors;
  }

  const rp = profile.rating_profiles;

  // ── Conformation ────────────────────────────────────────────────────────
  const EXPECTED_CONFORMATION_REGIONS = [
    'head',
    'neck',
    'shoulders',
    'back',
    'hindquarters',
    'legs',
    'hooves',
    'topline',
  ];
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
    const { mean, std_dev } = conformation[region];
    if (!Number.isFinite(mean)) {
      errors.push(`conformation.${region}.mean is not a finite number`);
    } else if (mean < 0 || mean > 100) {
      errors.push(`conformation.${region}.mean out of range (got ${mean})`);
    }
    if (!Number.isFinite(std_dev)) {
      errors.push(`conformation.${region}.std_dev is not a finite number`);
    }
  }

  // ── Gaits ────────────────────────────────────────────────────────────────
  const REQUIRED_GAITS = ['walk', 'trot', 'canter', 'gallop'];
  const gaits = rp.gaits ?? {};
  const isGaited = rp.is_gaited_breed === true;

  for (const gait of REQUIRED_GAITS) {
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
    if (!Array.isArray(rp.gaited_gait_registry) || rp.gaited_gait_registry.length === 0) {
      errors.push('gaited breed must have non-empty gaited_gait_registry');
    }
  } else if (gaits.gaiting !== null && gaits.gaiting !== undefined) {
    errors.push('non-gaited breed must have null gaiting score');
  }

  // ── Temperament weights ──────────────────────────────────────────────────
  const EXPECTED_TEMPERAMENT_COUNT = 11;
  const tw = profile.temperament_weights ?? {};
  const twKeys = Object.keys(tw);

  if (twKeys.length !== EXPECTED_TEMPERAMENT_COUNT) {
    errors.push(
      `temperament_weights has ${twKeys.length} keys, expected ${EXPECTED_TEMPERAMENT_COUNT}`,
    );
  }

  let twSum = 0;
  for (const [key, val] of Object.entries(tw)) {
    if (!Number.isInteger(val)) {
      errors.push(`temperament_weights.${key} is not an integer`);
    }
    twSum += val;
  }

  if (twSum !== 100) {
    errors.push(`temperament weights sum to ${twSum}, expected 100`);
  }

  return errors;
}
