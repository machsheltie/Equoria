/**
 * The server's verdict on training a horse right now, for the horse page's
 * "Last Trained" line (Equoria-0l0tq). It applies exactly what the train call
 * applies (services/trainingEligibility.mjs: age window, injury, Fair-or-better
 * health, and the weekly cooldown), so the page never recomputes it.
 */

import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { activeTrainingCooldownEnd, getAnyRecentTraining } from './trainingModelService.mjs';
import { trainingRefusalReason } from './trainingEligibility.mjs';

/**
 * @param {{ id: number, age?: number|null, dateOfBirth?: Date|string|null }} horse
 *   a full horse row (the fields hasBadHealth reads, and trainingCooldown, included)
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ lastTrainedAt: Date|null, canTrainNow: boolean }>}
 */
export async function getTrainingVerdict(horse, now = new Date()) {
  const lastTrainedAt = await getAnyRecentTraining(horse.id);
  const effectiveAge =
    horse.age !== null && horse.age !== undefined
      ? horse.age
      : (getHorseAgeYears(horse.dateOfBirth) ?? 0);
  const canTrainNow =
    trainingRefusalReason(horse, effectiveAge) === null &&
    activeTrainingCooldownEnd(horse.trainingCooldown, now) === null;
  return { lastTrainedAt, canTrainNow };
}
