/**
 * The server's verdict on training a horse right now, for the horse page's
 * "Last Trained" line (Equoria-0l0tq). It applies exactly what the train call
 * applies (services/trainingEligibility.mjs: age window, injury, Fair-or-better
 * health, an assigned trainer, and the weekly cooldown), so the page never recomputes it.
 */

import { liveHorseAgeYears } from '../../../utils/horseAge.mjs';
import { activeTrainingCooldownEnd, getAnyRecentTraining } from './trainingModelService.mjs';
import { trainerRefusalReason, trainingRefusalReason } from './trainingEligibility.mjs';

/**
 * @param {{ id: number, age?: number|null, dateOfBirth?: Date|string|null }} horse
 *   a full horse row (the fields hasBadHealth reads, and trainingCooldown, included)
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ lastTrainedAt: Date|null, canTrainNow: boolean }>}
 */
export async function getTrainingVerdict(horse, now = new Date()) {
  const lastTrainedAt = await getAnyRecentTraining(horse.id);
  // The live age (Equoria-5b2nj), the same rule the train call applies.
  const effectiveAge = liveHorseAgeYears(horse, now);
  const canTrainNow =
    trainingRefusalReason(horse, effectiveAge) === null &&
    (await trainerRefusalReason(horse)) === null &&
    activeTrainingCooldownEnd(horse.trainingCooldown, now) === null;
  return { lastTrainedAt, canTrainNow };
}
