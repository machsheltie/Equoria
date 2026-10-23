/**
 * healthScoring.mjs (Equoria-k1p62.7)
 *
 * The health term of a ridden show score. Owner rulings 2026-10-23 (decision
 * C, epic Equoria-k1p62): the competition bible's table, applied as a percent
 * summed with the luck, rider and temperament terms:
 *   Excellent +5%, Very Good +3%, Good 0, Fair -3%, Bad -5%.
 * The horse's state comes from the one health mapping, horseHealthGrade
 * (utils/horseHealth.mjs), so the score and every gate read the same health.
 */

import { horseHealthGrade } from '../../../utils/horseHealth.mjs';

/** Percent per health grade (decision C). */
export const healthScorePercents = Object.freeze({
  excellent: 5,
  veryGood: 3,
  good: 0,
  fair: -3,
  bad: -5,
});

/**
 * The health percent term for a horse at settlement time.
 *
 * @param {{ age?: number|null, healthStatus?: string|null,
 *   lastFedDate?: Date|string|null, lastVettedDate?: Date|string|null }} horse
 * @param {Date} [now]
 * @returns {number} +5, +3, 0, -3 or -5.
 */
export function healthScorePercent(horse, now = new Date()) {
  return healthScorePercents[horseHealthGrade(horse, now)];
}
