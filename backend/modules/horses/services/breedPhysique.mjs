// A horse's conformation and gaits, rolled from its breed's ranges.
//
// Owner request 2026-10-28 (Equoria-vqz4b, Equoria-17zgu): Horse Trader horses and
// onboarding starter horses are generated from their breed's conformation and gait
// ranges, each region and each gait scored individually from its own range, never one
// generic value across the board. Before this, those paths passed nothing and got the
// flat-20 conformation placeholder and no gaits at all.
//
// The rolls are the same generators foaling uses for a horse with no parent scores:
// all 8 conformation regions (and the overall score) first, then walk, trot, canter and
// gallop, plus one roll per named special gait for a gaited breed. Gaits are rolled from
// the conformation just rolled, so the existing conformation-to-gait adjustment applies
// unchanged (an open owner question, q210; not decided here).

import { generateConformationScores } from './conformationService.mjs';
import { generateGaitScores } from './gaitService.mjs';
import logger from '../../../utils/logger.mjs';

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
  const gaitScores = generateGaitScores(breedName, conformationScores, { random });
  return { conformationScores, gaitScores };
}

/**
 * The same roll for a path that must not fail when a breed has no ranges (onboarding:
 * its stats and temperament already fall back for such a breed). Returns null and logs
 * at error level so the caller leaves the horse's existing scores alone. Whether a horse
 * without breed scores should be refused instead is an open owner question (q211).
 *
 * A breed-profile source that failed to load (an error with a `cause`) is an
 * infrastructure fault, not a missing breed, and is rethrown.
 *
 * @param {string} breedName
 * @param {{ random?: () => number, context?: string }} [options]
 * @returns {{ conformationScores: object, gaitScores: object } | null}
 */
export function generateBreedPhysiqueOrNull(
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
      `[breedPhysique] No usable conformation/gait ranges for breed "${breedName}"${context ? ` (${context})` : ''}; the horse keeps its existing scores: ${err.message}`,
    );
    return null;
  }
}
