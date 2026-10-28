// A horse's conformation and gaits, rolled from its breed's ranges.
//
// Owner request 2026-10-28 (Equoria-vqz4b, Equoria-17zgu): Horse Trader horses and
// onboarding starter horses are generated from their breed's conformation and gait
// ranges, each region and each gait scored individually from its own range, never one
// generic value across the board. Before this, those paths passed nothing and got the
// flat-20 conformation placeholder and no gaits at all.
//
// The rolls are the same generators foaling uses for a horse with no parent scores:
// all 8 conformation regions (and the overall score), then walk, trot, canter and
// gallop, plus one roll per named special gait for a gaited breed. Gaits come only from
// the breed's gait ranges; conformation does not nudge them (owner ruling 2026-10-28,
// q210).

import AppError from '../../../errors/AppError.mjs';
import { generateConformationScores } from './conformationService.mjs';
import { generateGaitScores } from './gaitService.mjs';
import logger from '../../../utils/logger.mjs';

/** Error code of the refusal when a breed has no conformation or gait ranges (q211). */
export const breedScoresMissingCode = 'breedScoresMissing';

/**
 * Roll a horse's conformation and gaits from its breed's ranges.
 *
 * @param {string} breedName - Breed display name
 * @param {{ random?: () => number }} [options] - `random` is the uniform [0, 1) source
 *   (default Math.random); tests pass a seeded one
 * @returns {{ conformationScores: object, gaitScores: object }}
 * @throws {Error} when the breed has no usable conformation or gait ranges
 */
export function generateBreedPhysique(breedName, { random = Math.random } = {}) {
  const conformationScores = generateConformationScores(breedName, { random });
  const gaitScores = generateGaitScores(breedName, { random });
  return { conformationScores, gaitScores };
}

/**
 * The same roll for a path that creates a horse for a player (Horse Trader,
 * registration, onboarding). A breed with no conformation or gait ranges is refused:
 * the horse is not created and the fault is logged at error level (owner ruling
 * 2026-10-28, q211: no fallback scores).
 *
 * A breed-profile source that failed to load (an error with a `cause`) is an
 * infrastructure fault, not a missing breed, and is rethrown unchanged.
 *
 * @param {string} breedName
 * @param {{ random?: () => number, context?: string }} [options]
 * @returns {{ conformationScores: object, gaitScores: object }}
 * @throws {AppError} 422 with `code === breedScoresMissingCode` when the breed has no ranges
 */
export function generateBreedPhysiqueOrRefuse(
  breedName,
  { random = Math.random, context = '' } = {},
) {
  try {
    return generateBreedPhysique(breedName, { random });
  } catch (err) {
    if (err?.cause) {
      throw err;
    }
    logger.error(
      `[breedPhysique] No usable conformation/gait ranges for breed "${breedName}"${context ? ` (${context})` : ''}; the horse is not created: ${err.message}`,
    );
    const refusal = new AppError(
      'This breed cannot be created right now. Please choose another breed.',
      422,
    );
    refusal.code = breedScoresMissingCode;
    throw refusal;
  }
}
