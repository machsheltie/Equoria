// Temperament assignment service.
// Assigns one of 12 temperaments to a horse at birth using breed-weighted random selection.
//
// Temperament-permanence invariant (Equoria-8vwly, 2026-05-28):
// Temperament is permanent — assigned ONCE and never modified afterward. The
// permanence boundary is BREED FINALIZATION, not the literal row-creation:
//   - For foals: breed is fixed at birth (foalingService), so the assigned-at-
//     birth temperament IS the permanent one.
//   - For starter horses: registration creates a placeholder row using the
//     default-breed ('Thoroughbred') weights BEFORE the user has chosen a
//     breed in onboarding. That placeholder is invisible to the user. When
//     onboarding completes (advanceOnboarding) and the breed is finalized,
//     the temperament is REASSIGNED from the chosen breed's distribution —
//     this is still "assigned once" because the user's first observed
//     temperament is the breed-correct one.
// Re-assignment after onboarding completion is forbidden (training, breeding,
// or any post-onboarding flow MUST NOT mutate the column).
//
// Also provides the groom bond synergy lookup. Owner ruling 2026-10-21: a
// temperament has no training modifier and no ridden/conformation score
// modifier; outside the show matrix (competition rules) it matters only for
// groom bond synergy (here) and trainer fit (trainers/services/trainerModifiers.mjs).

import { TEMPERAMENT_TYPES } from '../data/temperamentTypes.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Decimal multipliers applied to daily bond gain during grooming sessions.
 * Values per PRD-03 §7.6. Applied as: DAILY_BOND_GAIN * (1 + synergyModifier).
 * Calm and Steady use `_any` key for universal matching with any personality.
 * Owner ruling 2026-10-21: Driven keeps Playful's energetic +0.15; Willing
 * (eager to please) bonds best with gentle and patient grooms.
 * @type {Object.<string, Object.<string, number>>}
 */
export const TEMPERAMENT_GROOM_SYNERGY = Object.freeze({
  Spirited: Object.freeze({ energetic: 0.2 }),
  Nervous: Object.freeze({ patient: 0.25, gentle: 0.25, strict: -0.15 }),
  Calm: Object.freeze({ _any: 0.1 }),
  Bold: Object.freeze({ energetic: 0.15, strict: 0.15 }),
  Steady: Object.freeze({ _any: 0.1 }),
  Willing: Object.freeze({ gentle: 0.15, patient: 0.1 }),
  Independent: Object.freeze({ patient: 0.15 }),
  Reactive: Object.freeze({ patient: 0.2, gentle: 0.2 }),
  Stubborn: Object.freeze({ strict: 0.15 }),
  Driven: Object.freeze({ energetic: 0.15 }),
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
 * Uses weighted random selection from the breed's temperamentWeights in breedProfiles.json
 * (via getBreedProfile). Throws if the breed is unknown or its profile lacks temperamentWeights.
 * If the weighted-selection result is not one of the 12 canonical temperament types (e.g. a
 * misspelled key in the JSON), falls back to a uniformly-random valid type.
 *
 * @param {string} breedName - Breed display name
 * @returns {string} One of the 12 temperament types
 * @throws {Error} if the breed is missing from breedProfiles.json or lacks temperamentWeights
 */
export function generateTemperament(breedName) {
  const profile = getBreedProfile(breedName);

  const weights = profile.temperamentWeights;
  if (!weights || typeof weights !== 'object' || Object.keys(weights).length === 0) {
    throw new Error(`breedProfiles.json entry for "${breedName}" is missing temperamentWeights.`);
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

/**
 * Default breed whose temperamentWeights are used when a horse has no breed
 * (e.g. the registration starter horse) or an unknown breed. Thoroughbred is
 * the canonical default elsewhere in the codebase (generateTemperament(1)).
 */
export const DEFAULT_TEMPERAMENT_BREED = 'Thoroughbred';

/**
 * Generate a temperament, falling back to a default breed's weights when the
 * horse has no breed or an unrecognised breed. Creation paths where a breed
 * may be absent (starter horse, backfill of legacy breedless rows) use this
 * instead of generateTemperament so they never throw and never leave the
 * column NULL.
 *
 * @param {string|number|null|undefined} breedName - Breed display name, legacy
 *   numeric id, or null/undefined for a breedless horse.
 * @returns {string} One of the 12 canonical temperament types.
 */
export function generateTemperamentWithDefault(breedName) {
  if (breedName !== null && breedName !== undefined && breedName !== '') {
    try {
      return generateTemperament(breedName);
    } catch (err) {
      logger.warn(
        `[temperamentService] No usable profile for breed "${breedName}" — falling back to default breed "${DEFAULT_TEMPERAMENT_BREED}": ${err.message}`,
      );
    }
  }
  return generateTemperament(DEFAULT_TEMPERAMENT_BREED);
}
