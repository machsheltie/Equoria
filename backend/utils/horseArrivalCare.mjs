import { gameCalendarDate } from './gameTime.mjs';

/**
 * The care state a horse arrives in when a player acquires it from the game
 * itself: a Horse Trader purchase or the onboarding starter horse.
 *
 * Owner ruling 2026-10-28 (Equoria-fd3f2): at the moment of purchase a store
 * horse is in Excellent health and fully fed. Vet health counts days from
 * lastVettedDate (an Eastern game date) and hunger counts days from
 * hungerSince/lastFedDate (utils/horseHealth.mjs), so both clocks start at
 * the moment of arrival: vetted today, fed now. Being fed now also means the
 * horse has had today's feeding, exactly as if the player had fed it.
 *
 * @param {Date} [now=new Date()]
 * @returns {{ healthStatus: 'Excellent', lastVettedDate: Date, lastFedDate: Date, hungerSince: Date }}
 */
export function horseArrivalCare(now = new Date()) {
  return {
    healthStatus: 'Excellent',
    lastVettedDate: gameCalendarDate(now),
    lastFedDate: now,
    hungerSince: now,
  };
}
