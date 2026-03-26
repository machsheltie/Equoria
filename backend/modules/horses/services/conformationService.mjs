// Conformation score generation service.
// Generates 8 conformation region scores for a horse using breed genetic profiles.
// Scores are permanent physical structure attributes generated at birth.

import { BREED_GENETIC_PROFILES } from '../data/breedGeneticProfiles.mjs';
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
  if (u1 === 0) u1 = Number.EPSILON;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Clamp and round a score to the valid range [0, 100].
 * @param {number} value - Raw score value
 * @returns {number} Integer clamped to [0, 100]
 */
export function clampScore(value) {
  if (!Number.isFinite(value)) return 50; // Fallback for NaN/Infinity
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Calculate overall conformation as the arithmetic mean of all 8 region scores.
 * @param {Object} scores - Object with 8 region scores
 * @returns {number} Integer arithmetic mean of all regions
 */
export function calculateOverallConformation(scores) {
  const values = CONFORMATION_REGIONS.map(region => scores[region]);
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / CONFORMATION_REGIONS.length);
}

/**
 * Generate conformation scores for a horse based on its breed's genetic profile.
 * Each region score is drawn from a normal distribution using the breed's mean and std_dev.
 * @param {number} breedId - The breed ID to look up genetic profiles
 * @returns {Object} Object with 8 region scores (integers 0-100) and overallConformation
 */
export function generateConformationScores(breedId) {
  const profile = BREED_GENETIC_PROFILES[breedId];
  if (!profile) {
    logger.warn(
      `[conformationService] No genetic profile found for breed ID ${breedId}, using defaults`,
    );
    // Return default scores if breed profile not found
    return {
      head: 50,
      neck: 50,
      shoulders: 50,
      back: 50,
      hindquarters: 50,
      legs: 50,
      hooves: 50,
      topline: 50,
      overallConformation: 50,
    };
  }

  const conformation = profile.rating_profiles.conformation;
  const scores = {};

  for (const region of CONFORMATION_REGIONS) {
    const regionProfile = conformation[region];
    const rawScore = normalRandom(regionProfile.mean, regionProfile.std_dev);
    scores[region] = clampScore(rawScore);
  }

  scores.overallConformation = calculateOverallConformation(scores);

  return scores;
}

export { CONFORMATION_REGIONS };
