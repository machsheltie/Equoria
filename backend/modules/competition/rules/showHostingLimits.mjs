/**
 * Limits on hosting player-run shows (Equoria-whfj4, owner ruling 2026-10-23).
 *
 * A basic player may create up to ten shows a week. Future premium tiers
 * (unnamed, undesigned) will allow 15, 20 or 25; they extend
 * `weeklyShowCreationLimit` and nothing else, so no caller ever holds the
 * number. The week is a game-time week: it begins Monday 00:00 US Eastern
 * (utils/gameTime.mjs), never UTC.
 */

import { startOfGameWeek } from '../../../utils/gameTime.mjs';

/** What a basic player may create in one game-time week. */
export const basicWeeklyShowCreationLimit = 10;

/** Monday, as `startOfGameWeek` numbers days (0 = Sunday). */
const showWeekStartDay = 1;

/**
 * How many shows this player may create in one game-time week. The single
 * lookup a future premium tier extends.
 *
 * @param {{ role?: string }|null|undefined} _user - the host; unused until a
 *   premium tier exists
 * @returns {number}
 */
export function weeklyShowCreationLimit(_user) {
  return basicWeeklyShowCreationLimit;
}

/**
 * The instant the game-time week containing `now` began.
 *
 * @param {Date} [now]
 * @returns {Date}
 */
export function startOfShowWeek(now = new Date()) {
  return startOfGameWeek(now, showWeekStartDay);
}
