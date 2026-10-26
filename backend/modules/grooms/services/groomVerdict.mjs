/**
 * The server's verdict on grooming a horse today, for the horse page's "Last
 * Groomed" line (Equoria-0l0tq). It asks the "groom horse" action's own rule
 * (groomCareService: once per horse per Eastern game day, with a groom who can
 * work), so the page never recomputes it and never disagrees with the action.
 */

import { canGroomHorseToday } from './groomCareService.mjs';

/**
 * @param {number} horseId
 * @returns {Promise<boolean>} true when "groom horse" would succeed right now
 */
export async function canGroomToday(horseId) {
  return canGroomHorseToday(horseId);
}
