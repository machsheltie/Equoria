/**
 * Fixture care that puts a horse in a chosen health state under the owner's
 * 2026-10-23 rule (Equoria-qwz60): health comes from days since the vet (0-7
 * Excellent, 8-14 Very Good, 15-21 Good, 22-28 Fair, 29+ Bad), lowered by
 * hunger. A stored healthStatus word no longer sets the band, so a fixture that
 * means "a Good horse" gives the vet days and a feeding today.
 */

import { gameCalendarDate } from '../../utils/gameTime.mjs';

const vetDaysByHealth = Object.freeze({
  Excellent: 0,
  'Very Good': 8,
  Good: 15,
  Fair: 22,
  Bad: 29,
});

/**
 * @param {'Excellent'|'Very Good'|'Good'|'Fair'|'Bad'} word
 * @param {Date} [now]
 * @returns {{ healthStatus: string, lastVettedDate: Date, lastFedDate: Date }}
 */
export function careForHealth(word, now = new Date()) {
  const days = vetDaysByHealth[word];
  if (days === undefined) {
    throw new Error(`careForHealth: unknown health word ${word}`);
  }
  return {
    healthStatus: 'Excellent',
    lastVettedDate: gameCalendarDate(now, -days),
    lastFedDate: now,
  };
}
