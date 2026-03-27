// Temperament assignment service.
// Assigns one of 11 temperaments to a horse at birth using breed-weighted random selection.
// Temperament is permanent — assigned once at creation and never modified.

import { BREED_GENETIC_PROFILES, TEMPERAMENT_TYPES } from '../data/breedGeneticProfiles.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Select a value from a weighted distribution.
 * @param {Object} weights - Object mapping names to integer weights (must sum > 0)
 * @returns {string} The selected key
 * @throws {Error} If weights is empty or all weights are zero
 */
export function weightedRandomSelect(weights) {
  const entries = Object.entries(weights);
  if (entries.length === 0) {
    throw new Error('weightedRandomSelect: weights object is empty');
  }

  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) {
    throw new Error('weightedRandomSelect: total weight must be greater than zero');
  }

  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }

  // Fallback for floating-point edge cases
  return entries[entries.length - 1][0];
}

/**
 * Generate a temperament for a horse based on its breed's temperament weights.
 * Uses weighted random selection from BREED_GENETIC_PROFILES[breedId].temperament_weights.
 *
 * @param {number} breedId - The breed ID (1-12)
 * @returns {string} One of the 11 temperament types
 * @throws {Error} If breedId is invalid or breed lacks temperament_weights
 */
export function generateTemperament(breedId) {
  const profile = BREED_GENETIC_PROFILES[breedId];
  if (!profile) {
    throw new Error(`generateTemperament: no breed genetic profile found for breedId ${breedId}`);
  }

  const weights = profile.temperament_weights;
  if (!weights || typeof weights !== 'object' || Object.keys(weights).length === 0) {
    throw new Error(
      `generateTemperament: breed ${breedId} has no temperament_weights in genetic profile`,
    );
  }

  const temperament = weightedRandomSelect(weights);

  // Validate the result is a known temperament type
  if (!TEMPERAMENT_TYPES.includes(temperament)) {
    logger.warn(
      `[temperamentService] Generated unknown temperament "${temperament}" for breed ${breedId} — returning anyway`,
    );
  }

  logger.debug(`[temperamentService] Assigned temperament "${temperament}" to breed ${breedId}`);

  return temperament;
}
