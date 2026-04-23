// Temperament assignment service.
// Assigns one of 11 temperaments to a horse at birth using breed-weighted random selection.
// Temperament is permanent — assigned once at creation and never modified.
// Also provides training and competition modifier lookups used by trainingController and competitionScore.

import { TEMPERAMENT_TYPES } from '../data/breedGeneticProfiles.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Decimal multipliers applied to discipline score and XP during training.
 * Values per PRD-03 §7.4. Applied as: value * (1 + modifier).
 * @type {Object.<string, {xpModifier: number, scoreModifier: number}>}
 */
export const TEMPERAMENT_TRAINING_MODIFIERS = Object.freeze({
  Spirited: Object.freeze({ xpModifier: 0.1, scoreModifier: 0.05 }),
  Nervous: Object.freeze({ xpModifier: -0.1, scoreModifier: -0.05 }),
  Calm: Object.freeze({ xpModifier: 0.05, scoreModifier: 0.1 }),
  Bold: Object.freeze({ xpModifier: 0.05, scoreModifier: 0.05 }),
  Steady: Object.freeze({ xpModifier: 0.05, scoreModifier: 0.1 }),
  Independent: Object.freeze({ xpModifier: -0.05, scoreModifier: 0 }),
  Reactive: Object.freeze({ xpModifier: 0, scoreModifier: -0.05 }),
  Stubborn: Object.freeze({ xpModifier: -0.15, scoreModifier: -0.1 }),
  Playful: Object.freeze({ xpModifier: 0.05, scoreModifier: -0.05 }),
  Lazy: Object.freeze({ xpModifier: -0.2, scoreModifier: -0.15 }),
  Aggressive: Object.freeze({ xpModifier: -0.1, scoreModifier: -0.05 }),
});

/**
 * Return the training modifiers for a given temperament.
 * Returns zero modifiers for null, undefined, or unknown temperament strings
 * (backward compatible — horses without temperament are unaffected).
 *
 * @param {string|null} temperament - One of the 11 temperament types, or null
 * @returns {{ xpModifier: number, scoreModifier: number }}
 */
export function getTemperamentTrainingModifiers(temperament) {
  if (!temperament || typeof temperament !== 'string') {
    return { xpModifier: 0, scoreModifier: 0 };
  }
  // TEMP-1: trim to match competition modifier's defensive behaviour; prevents whitespace in DB values silently zeroing training modifiers
  const mods = TEMPERAMENT_TRAINING_MODIFIERS[temperament.trim()];
  if (!mods) {
    logger.warn(
      `[temperamentService] Unknown temperament "${temperament}" — returning zero modifiers`,
    );
    return { xpModifier: 0, scoreModifier: 0 };
  }
  return { ...mods };
}

/**
 * Decimal multipliers applied to competition scores (pre-luck).
 * Values per PRD-03 §7.5. Applied as: scoreWithTraitBonus * (1 + modifier).
 * Ridden modifier: applies to ridden competitions (Racing, Show Jumping, Dressage, Cross Country).
 * Conformation modifier: applies to conformation shows.
 * @type {Object.<string, {riddenModifier: number, conformationModifier: number}>}
 */
export const TEMPERAMENT_COMPETITION_MODIFIERS = Object.freeze({
  Spirited: Object.freeze({ riddenModifier: 0.03, conformationModifier: -0.02 }),
  Nervous: Object.freeze({ riddenModifier: -0.05, conformationModifier: -0.05 }),
  Calm: Object.freeze({ riddenModifier: 0.02, conformationModifier: 0.05 }),
  Bold: Object.freeze({ riddenModifier: 0.05, conformationModifier: 0.02 }),
  Steady: Object.freeze({ riddenModifier: 0.03, conformationModifier: 0.03 }),
  Independent: Object.freeze({ riddenModifier: -0.02, conformationModifier: -0.03 }),
  Reactive: Object.freeze({ riddenModifier: -0.03, conformationModifier: -0.04 }),
  Stubborn: Object.freeze({ riddenModifier: -0.04, conformationModifier: -0.03 }),
  Playful: Object.freeze({ riddenModifier: 0.01, conformationModifier: -0.01 }),
  Lazy: Object.freeze({ riddenModifier: -0.05, conformationModifier: 0 }),
  Aggressive: Object.freeze({ riddenModifier: -0.03, conformationModifier: -0.05 }),
});

/**
 * Return the competition modifiers for a given temperament.
 * Returns zero modifiers for null, undefined, or unknown temperament strings
 * (backward compatible — horses without temperament are unaffected).
 *
 * @param {string|null} temperament - One of the 11 temperament types, or null
 * @returns {{ riddenModifier: number, conformationModifier: number }}
 */
export function getTemperamentCompetitionModifiers(temperament) {
  if (!temperament || typeof temperament !== 'string') {
    return { riddenModifier: 0, conformationModifier: 0 };
  }
  const mods = TEMPERAMENT_COMPETITION_MODIFIERS[temperament.trim()];
  if (!mods) {
    logger.warn(
      `[temperamentService] Unknown temperament "${temperament}" — returning zero competition modifiers`,
    );
    return { riddenModifier: 0, conformationModifier: 0 };
  }
  return { ...mods };
}

/**
 * Decimal multipliers applied to daily bond gain during grooming sessions.
 * Values per PRD-03 §7.6. Applied as: DAILY_BOND_GAIN * (1 + synergyModifier).
 * Calm and Steady use `_any` key for universal matching with any personality.
 * @type {Object.<string, Object.<string, number>>}
 */
export const TEMPERAMENT_GROOM_SYNERGY = Object.freeze({
  Spirited: Object.freeze({ energetic: 0.2 }),
  Nervous: Object.freeze({ patient: 0.25, gentle: 0.25, strict: -0.15 }),
  Calm: Object.freeze({ _any: 0.1 }),
  Bold: Object.freeze({ energetic: 0.15, strict: 0.15 }),
  Steady: Object.freeze({ _any: 0.1 }),
  Independent: Object.freeze({ patient: 0.15 }),
  Reactive: Object.freeze({ patient: 0.2, gentle: 0.2 }),
  Stubborn: Object.freeze({ strict: 0.15 }),
  Playful: Object.freeze({ energetic: 0.15 }),
  Lazy: Object.freeze({ energetic: 0.1, strict: 0.1 }),
  Aggressive: Object.freeze({ strict: 0.1, patient: 0.1 }),
});

/**
 * Return the groom synergy modifier for a given temperament/personality combination.
 * Returns 0 for null/unknown inputs (backward compatible).
 *
 * @param {string|null} temperament - Horse temperament, or null
 * @param {string|null} groomPersonality - Groom personality (gentle/energetic/patient/strict), or null
 * @returns {number} Decimal modifier (e.g., 0.25 = +25%) or 0 for no synergy
 */
// Canonical groom personalities — used to validate inputs before synergy lookup.
const CANONICAL_GROOM_PERSONALITIES = new Set(['gentle', 'energetic', 'patient', 'strict']);

export function getTemperamentGroomSynergy(temperament, groomPersonality) {
  if (!temperament || typeof temperament !== 'string') {
    return 0;
  }
  if (!groomPersonality || typeof groomPersonality !== 'string') {
    return 0;
  }

  const synergyMap = TEMPERAMENT_GROOM_SYNERGY[temperament.trim()];
  if (!synergyMap) {
    logger.warn(
      `[temperamentService] Unknown temperament "${temperament}" — returning zero groom synergy`,
    );
    return 0;
  }

  const normalizedPersonality = groomPersonality.trim().toLowerCase();

  // TEMP-5: warn when personality is not canonical so DB data errors surface in logs
  // (an unrecognised personality silently returns 0 for Calm/Steady _any synergy without this)
  if (!CANONICAL_GROOM_PERSONALITIES.has(normalizedPersonality)) {
    logger.warn(
      `[temperamentService] Unrecognised groom personality "${groomPersonality}" — not in canonical set, returning zero synergy`,
    );
    return 0;
  }

  // Calm and Steady: universal bonus for any VALID canonical personality
  if ('_any' in synergyMap) {
    return synergyMap._any;
  }

  // Specific personality match
  const modifier = synergyMap[normalizedPersonality];
  return modifier !== undefined ? modifier : 0;
}

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

  // TEMP-2: guard against negative weights which would skew the distribution without throwing
  const negativeEntry = entries.find(([, w]) => w < 0);
  if (negativeEntry) {
    throw new Error(
      `weightedRandomSelect: negative weight detected for key "${negativeEntry[0]}" (${negativeEntry[1]})`,
    );
  }

  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) {
    throw new Error('weightedRandomSelect: total weight must be greater than zero');
  }

  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return type;
    }
  }

  // Fallback for floating-point edge cases
  return entries[entries.length - 1][0];
}

/**
 * Generate a temperament for a horse based on its breed's temperament weights.
 * Uses weighted random selection from BREED_GENETIC_PROFILES[breedId].temperament_weights.
 * Falls back to uniform random selection from TEMPERAMENT_TYPES for unknown breed IDs,
 * matching the graceful-degradation pattern of conformationService and gaitService.
 *
 * @param {number} breedId - The breed ID (1-12)
 * @returns {string} One of the 11 temperament types
 */
export function generateTemperament(breedName) {
  const profile = getBreedProfile(breedName);

  const weights = profile.temperament_weights;
  if (!weights || typeof weights !== 'object' || Object.keys(weights).length === 0) {
    throw new Error(`breedProfiles.json entry for "${breedName}" is missing temperament_weights.`);
  }

  const temperament = weightedRandomSelect(weights);

  // TEMP-4: if weights contain a misspelled key, fall back to a valid type rather than
  // persisting an unknown string that would silently zero all modifiers on every request
  if (!TEMPERAMENT_TYPES.includes(temperament)) {
    const fallback = TEMPERAMENT_TYPES[Math.floor(Math.random() * TEMPERAMENT_TYPES.length)];
    logger.warn(
      `[temperamentService] Generated unknown temperament "${temperament}" for breed "${breedName}" — falling back to "${fallback}"`,
    );
    return fallback;
  }

  logger.debug(
    `[temperamentService] Assigned temperament "${temperament}" to breed "${breedName}"`,
  );

  return temperament;
}
