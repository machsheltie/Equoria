/**
 * The server's verdict on grooming a horse today, for the horse page's "Last
 * Groomed" line (Equoria-0l0tq). It asks the groom action's own rule (one groom
 * interaction per horse per Eastern game day, utils/groomSystem.mjs), so the
 * page never recomputes it.
 */

import { validateFoalInteractionLimits } from '../../../utils/groomSystem.mjs';

/**
 * @param {number} horseId
 * @returns {Promise<boolean>} true when the horse has had no groom interaction today
 */
export async function canGroomToday(horseId) {
  const verdict = await validateFoalInteractionLimits(horseId);
  return verdict.canInteract;
}
