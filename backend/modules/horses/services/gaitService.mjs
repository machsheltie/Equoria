// Gait quality score generation service.
// Generates 4 standard gait scores + breed-specific gaited gaits for a horse.
// Gait scores are permanent movement quality attributes generated at birth.
// Scores are influenced by conformation regions via a mapping formula.

import { normalRandom, clampScore } from './conformationService.mjs';
import { BREED_GENETIC_PROFILES } from '../data/breedGeneticProfiles.mjs';
import logger from '../../../utils/logger.mjs';

// The 4 standard gaits every horse has
export const STANDARD_GAITS = ['walk', 'trot', 'canter', 'gallop'];

// Maps each gait to the conformation regions that influence it
export const CONFORMATION_GAIT_MAPPING = {
  walk: ['shoulders', 'back'],
  trot: ['shoulders', 'hindquarters'],
  canter: ['back', 'hindquarters'],
  gallop: ['legs', 'hindquarters'],
  gaiting: ['legs', 'back', 'hindquarters'],
};

// Default gait scores for unknown breeds (score 50 per gait, no gaiting)
const DEFAULT_UNKNOWN_BREED_GAIT_SCORES = Object.freeze({
  walk: 50,
  trot: 50,
  canter: 50,
  gallop: 50,
  gaiting: null,
});

/**
 * Calculate the conformation bonus for a specific gait.
 * Bonus = (average of mapped conformation regions - 70) * 0.15
 * Missing regions fall back to 70 (neutral, zero bonus contribution).
 * @param {Object} conformationScores - Horse's 8 conformation region scores
 * @param {string} gaitKey - Gait to calculate bonus for (walk/trot/canter/gallop/gaiting)
 * @returns {number} Conformation bonus (can be positive or negative)
 */
export function calculateConformationBonus(conformationScores, gaitKey) {
  const regions = CONFORMATION_GAIT_MAPPING[gaitKey];
  if (!regions || !conformationScores) {
    return 0;
  }
  const avg = regions.reduce((sum, r) => sum + (conformationScores[r] ?? 70), 0) / regions.length;
  return (avg - 70) * 0.15;
}

/**
 * Check whether a gait scores object has at least one valid numeric standard gait score.
 * Used to distinguish real parent gait data from empty objects or corrupted data.
 * @param {Object|null|undefined} scores - Gait scores object to validate
 * @returns {boolean} True if the object has at least one finite numeric standard gait score
 */
export function hasValidGaitScores(scores) {
  if (!scores || typeof scores !== 'object') {
    return false;
  }
  return STANDARD_GAITS.some(gait => Number.isFinite(scores[gait]));
}

/**
 * Validate and normalize a gait scores object for database persistence.
 * Ensures all 4 standard gaits are present as integers in [0, 100] and gaiting is valid.
 * @param {Object} scores - Raw gait scores object
 * @returns {Object} Validated object with walk/trot/canter/gallop + gaiting
 */
export function validateGaitScores(scores) {
  if (!scores || typeof scores !== 'object') {
    logger.warn('[gaitService] validateGaitScores received invalid input, using defaults');
    return { ...DEFAULT_UNKNOWN_BREED_GAIT_SCORES };
  }

  const validated = {};
  for (const gait of STANDARD_GAITS) {
    const val = scores[gait];
    validated[gait] = Number.isFinite(val) ? clampScore(val) : 50;
  }

  // Preserve gaiting array if valid, otherwise null
  if (Array.isArray(scores.gaiting) && scores.gaiting.length > 0) {
    validated.gaiting = scores.gaiting.map(entry => ({
      name: typeof entry.name === 'string' ? entry.name : 'Unknown Gait',
      score: Number.isFinite(entry.score) ? clampScore(entry.score) : 50,
    }));
  } else {
    validated.gaiting = null;
  }

  return validated;
}

/**
 * Generate gait scores for a horse based on breed genetics and conformation influence.
 * @param {number} breedId - The breed ID to look up genetic profiles
 * @param {Object} conformationScores - Horse's conformation scores for bonus calculation
 * @returns {Object} Object with walk/trot/canter/gallop (integers 0-100) and gaiting (array or null)
 */
export function generateGaitScores(breedId, conformationScores) {
  const profile = BREED_GENETIC_PROFILES[breedId];
  if (!profile) {
    logger.warn(`[gaitService] No genetic profile found for breed ID ${breedId}, using defaults`);
    return { ...DEFAULT_UNKNOWN_BREED_GAIT_SCORES };
  }

  // GAIT-1: use optional chaining consistent with conformationService
  const gaits = profile.rating_profiles?.gaits;
  if (!gaits) {
    logger.warn(`[gaitService] Breed ID ${breedId} profile missing gaits data, using defaults`);
    return { ...DEFAULT_UNKNOWN_BREED_GAIT_SCORES };
  }
  const scores = {};

  // Generate 4 standard gait scores
  for (const gait of STANDARD_GAITS) {
    const gaitProfile = gaits[gait];
    // CONF-1 (gait side): guard against null/missing gait entry in manually-maintained breed data
    if (!gaitProfile || !Number.isFinite(gaitProfile.mean)) {
      logger.warn(
        `[gaitService] Missing profile for gait "${gait}" on breed ${breedId}, using neutral defaults`,
      );
      scores[gait] = clampScore(normalRandom(50, 8));
      continue;
    }
    const bonus = calculateConformationBonus(conformationScores, gait);
    const rawScore = normalRandom(gaitProfile.mean, gaitProfile.std_dev) + bonus;
    scores[gait] = clampScore(rawScore);
  }

  // Generate gaited gait entries for gaited breeds — each named gait gets an independent roll
  if (profile.rating_profiles.is_gaited_breed && gaits.gaiting) {
    const gaitingProfile = gaits.gaiting;
    const bonus = calculateConformationBonus(conformationScores, 'gaiting');

    const gaitedNames = profile.rating_profiles.gaited_gait_registry || [];
    scores.gaiting = gaitedNames.map(name => {
      const rawScore = normalRandom(gaitingProfile.mean, gaitingProfile.std_dev) + bonus;
      return { name, score: clampScore(rawScore) };
    });
  } else {
    scores.gaiting = null;
  }

  return scores;
}

/**
 * Generate inherited gait scores for a foal based on parent gait scores, breed genetics,
 * and conformation influence.
 * Formula per gait: baseValue = (parentAvg * 0.6 + breedMean * 0.4) + conformationBonus
 * Falls back to breed-only generation if either parent's gait scores are null/missing.
 * @param {number} breedId - The breed ID for genetic profile lookup
 * @param {Object|null} sireGaitScores - Sire's gait scores
 * @param {Object|null} damGaitScores - Dam's gait scores
 * @param {Object} conformationScores - Foal's conformation scores for bonus calculation
 * @returns {Object} Object with walk/trot/canter/gallop (integers 0-100) and gaiting (array or null)
 */
export function generateInheritedGaitScores(
  breedId,
  sireGaitScores,
  damGaitScores,
  conformationScores,
) {
  // Fall back to breed-only generation if either parent's scores are missing
  if (!sireGaitScores || !damGaitScores) {
    logger.info(
      `[gaitService] Missing parent gait scores, falling back to breed-only generation for breed ${breedId}`,
    );
    return generateGaitScores(breedId, conformationScores);
  }

  const profile = BREED_GENETIC_PROFILES[breedId];
  if (!profile) {
    logger.warn(`[gaitService] No genetic profile found for breed ID ${breedId}, using defaults`);
    return { ...DEFAULT_UNKNOWN_BREED_GAIT_SCORES };
  }

  // GAIT-1 (inherited path): use optional chaining consistent with generateGaitScores
  const gaits = profile.rating_profiles?.gaits;
  if (!gaits) {
    logger.warn(
      `[gaitService] Breed ID ${breedId} profile missing gaits data (inherited), using defaults`,
    );
    return { ...DEFAULT_UNKNOWN_BREED_GAIT_SCORES };
  }
  const scores = {};

  // Generate 4 standard gait scores with inheritance
  for (const gait of STANDARD_GAITS) {
    const gaitProfile = gaits[gait];
    // CONF-1 (gait inherited): guard against null/missing gait entry
    if (!gaitProfile || !Number.isFinite(gaitProfile.mean)) {
      logger.warn(
        `[gaitService] Missing profile for gait "${gait}" on breed ${breedId} (inherited), using neutral defaults`,
      );
      scores[gait] = clampScore(normalRandom(50, 8));
      continue;
    }
    // Guard against NaN/non-finite parent scores from corrupted DB data
    const sireVal = Number.isFinite(sireGaitScores[gait]) ? sireGaitScores[gait] : undefined;
    const damVal = Number.isFinite(damGaitScores[gait]) ? damGaitScores[gait] : undefined;

    if (sireVal === undefined || damVal === undefined) {
      logger.warn(
        `[gaitService] Missing/invalid parent ${gait} score (sire=${sireGaitScores[gait]}, dam=${damGaitScores[gait]}), using breed mean fallback`,
      );
    }

    const parentAvg = ((sireVal ?? gaitProfile.mean) + (damVal ?? gaitProfile.mean)) / 2;
    const baseValue = parentAvg * 0.6 + gaitProfile.mean * 0.4;
    const bonus = calculateConformationBonus(conformationScores, gait);
    scores[gait] = clampScore(normalRandom(baseValue, gaitProfile.std_dev) + bonus);
  }

  // Gaited gait availability depends on FOAL's breed, not parents
  // Each named gait gets an independent variance roll
  if (profile.rating_profiles.is_gaited_breed && gaits.gaiting) {
    const gaitingProfile = gaits.gaiting;
    const bonus = calculateConformationBonus(conformationScores, 'gaiting');

    // GAIT-2: average ALL named gaiting scores per parent rather than using only index 0.
    // Breeds with multiple named gaits (e.g. American Saddlebred: Slow Gait + Rack) would
    // otherwise skew the inherited base value toward only the first-registered gait.
    const sireGaiting =
      sireGaitScores.gaiting && sireGaitScores.gaiting.length > 0
        ? sireGaitScores.gaiting.reduce((sum, e) => sum + e.score, 0) /
          sireGaitScores.gaiting.length
        : null;
    const damGaiting =
      damGaitScores.gaiting && damGaitScores.gaiting.length > 0
        ? damGaitScores.gaiting.reduce((sum, e) => sum + e.score, 0) / damGaitScores.gaiting.length
        : null;

    let inheritedBaseValue;
    if (
      sireGaiting !== null &&
      damGaiting !== null &&
      Number.isFinite(sireGaiting) &&
      Number.isFinite(damGaiting)
    ) {
      const parentAvg = (sireGaiting + damGaiting) / 2;
      inheritedBaseValue = parentAvg * 0.6 + gaitingProfile.mean * 0.4;
    } else {
      inheritedBaseValue = gaitingProfile.mean;
    }

    const gaitedNames = profile.rating_profiles.gaited_gait_registry || [];
    scores.gaiting = gaitedNames.map(name => {
      const gaitingScore = clampScore(
        normalRandom(inheritedBaseValue, gaitingProfile.std_dev) + bonus,
      );
      return { name, score: gaitingScore };
    });
  } else {
    scores.gaiting = null;
  }

  return scores;
}
