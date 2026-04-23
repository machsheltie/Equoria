// Conformation score generation service.
// Generates 8 conformation region scores for a horse using breed rating profiles.
// Scores are permanent physical structure attributes generated at birth.
//
// Per-breed profiles come from backend/data/breedProfiles.json via
// breedProfileLoader. Every breed in the DB must have an entry.

import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import logger from '../../../utils/logger.mjs';

// The 8 conformation regions in canonical order
const CONFORMATION_REGIONS = [
  'head',
  'neck',
  'shoulders',
  'back',
  'hindquarters',
  'legs',
  'hooves',
  'topline',
];

/**
 * Box-Muller transform — generates a normally distributed random value.
 * @param {number} mean - Center of the distribution
 * @param {number} stdDev - Standard deviation
 * @returns {number} A normally distributed random value
 */
export function normalRandom(mean, stdDev) {
  // Avoid Math.log(0) = -Infinity by clamping u1 away from 0
  let u1 = Math.random();
  if (u1 === 0) {
    u1 = Number.EPSILON;
  }
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  // Guard against negative std_dev from corrupted profile data
  return mean + z * Math.abs(stdDev);
}

/**
 * Clamp and round a score to the valid range [0, 100].
 * @param {number} value - Raw score value
 * @returns {number} Integer clamped to [0, 100]
 */
export function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 50;
  } // Fallback for NaN/Infinity
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Calculate overall conformation as the arithmetic mean of all 8 region scores.
 * @param {Object} scores - Object with 8 region scores
 * @returns {number} Integer arithmetic mean of all regions
 */
export function calculateOverallConformation(scores) {
  // CONF-2: return neutral midpoint (50) not 0 — a score of 0 is a real competitive value
  // and would permanently disadvantage any horse created with corrupted scores
  if (!scores || typeof scores !== 'object') {
    return 50;
  }
  const values = CONFORMATION_REGIONS.map(region => scores[region] ?? 0);
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / CONFORMATION_REGIONS.length);
}

/**
 * Generate conformation scores for a horse based on its breed's genetic profile.
 * Each region score is drawn from a normal distribution using the breed's mean and std_dev.
 * @param {number} breedId - The breed ID to look up genetic profiles
 * @returns {Object} Object with 8 region scores (integers 0-100) and overallConformation
 */
export function generateConformationScores(breedName) {
  const profile = getBreedProfile(breedName);
  const conformation = profile.rating_profiles?.conformation;
  if (!conformation) {
    throw new Error(
      `breedProfiles.json entry for "${breedName}" is missing rating_profiles.conformation. ` +
        'Regenerate via backend/scripts/generateBreedProfiles.mjs or fix the hand-tuned entry.',
    );
  }

  const scores = {};

  for (const region of CONFORMATION_REGIONS) {
    const regionProfile = conformation[region];
    // Every region must be present. An incomplete profile is a data bug.
    if (!regionProfile || !Number.isFinite(regionProfile.mean)) {
      throw new Error(
        `breedProfiles.json entry for "${breedName}" is missing region "${region}" ` +
          'in rating_profiles.conformation. All 8 regions are required.',
      );
    }
    const rawScore = normalRandom(regionProfile.mean, regionProfile.std_dev);
    scores[region] = clampScore(rawScore);
  }

  scores.overallConformation = calculateOverallConformation(scores);

  return scores;
}

/**
 * Generate inherited conformation scores for a foal based on parent scores and breed genetics.
 * Formula per region: baseValue = (sireScore * 0.5 + damScore * 0.5) * 0.6 + breedMean * 0.4
 * Final score: clampScore(normalRandom(baseValue, breedStdDev))
 * Falls back to breed-only generation if either parent's scores are null/missing.
 * @param {number} breedId - The breed ID for genetic profile lookup
 * @param {Object|null} sireScores - Sire's conformation scores (8 regions)
 * @param {Object|null} damScores - Dam's conformation scores (8 regions)
 * @returns {Object} Object with 8 region scores (integers 0-100) and overallConformation
 */
export function generateInheritedConformationScores(breedName, sireScores, damScores) {
  // Fall back to breed-only generation if either parent's scores are null/missing
  if (!sireScores || !damScores) {
    logger.info(
      `[conformationService] Missing parent conformation scores, falling back to breed-only generation for breed "${breedName}"`,
    );
    return generateConformationScores(breedName);
  }

  const profile = getBreedProfile(breedName);
  const conformation = profile.rating_profiles?.conformation;
  if (!conformation) {
    throw new Error(
      `breedProfiles.json entry for "${breedName}" is missing rating_profiles.conformation.`,
    );
  }

  const scores = {};

  for (const region of CONFORMATION_REGIONS) {
    const regionProfile = conformation[region];
    if (!regionProfile || !Number.isFinite(regionProfile.mean)) {
      throw new Error(
        `breedProfiles.json entry for "${breedName}" missing region "${region}" ` +
          'in rating_profiles.conformation (inherited path).',
      );
    }
    // Guard against NaN/non-finite parent scores from corrupted DB data
    const sireVal = Number.isFinite(sireScores[region]) ? sireScores[region] : undefined;
    const damVal = Number.isFinite(damScores[region]) ? damScores[region] : undefined;
    if (sireVal === undefined || damVal === undefined) {
      logger.warn(
        `[conformationService] Missing/invalid parent ${region} score (sire=${sireScores[region]}, dam=${damScores[region]}), using breed mean fallback`,
      );
    }
    const parentAvg = (sireVal ?? regionProfile.mean) * 0.5 + (damVal ?? regionProfile.mean) * 0.5;
    const baseValue = parentAvg * 0.6 + regionProfile.mean * 0.4;
    scores[region] = clampScore(normalRandom(baseValue, regionProfile.std_dev));
  }

  scores.overallConformation = calculateOverallConformation(scores);

  return scores;
}

/**
 * Check whether a conformation scores object has at least one valid numeric region score.
 * Used to distinguish real parent scores from empty objects or corrupted data.
 * @param {Object|null|undefined} scores - Conformation scores object to validate
 * @returns {boolean} True if the object has at least one finite numeric region score
 */
export function hasValidConformationScores(scores) {
  if (!scores || typeof scores !== 'object') {
    return false;
  }
  return CONFORMATION_REGIONS.some(region => Number.isFinite(scores[region]));
}

/**
 * Validate and normalize a conformation scores object for database persistence.
 * Ensures all 8 regions are present as integers in [0, 100] and overallConformation is set.
 * @param {Object} scores - Raw conformation scores object
 * @returns {Object} Validated object with all 8 regions + overallConformation
 */
export function validateConformationScores(scores) {
  if (!scores || typeof scores !== 'object') {
    logger.warn(
      '[conformationService] validateConformationScores received invalid input, using neutral 50 defaults',
    );
    const defaults = {};
    for (const region of CONFORMATION_REGIONS) {
      defaults[region] = 50;
    }
    defaults.overallConformation = 50;
    return defaults;
  }

  const validated = {};
  for (const region of CONFORMATION_REGIONS) {
    const val = scores[region];
    validated[region] = Number.isFinite(val) ? clampScore(val) : 50;
  }
  validated.overallConformation = calculateOverallConformation(validated);
  return validated;
}

export { CONFORMATION_REGIONS };
