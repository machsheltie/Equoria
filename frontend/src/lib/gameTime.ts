/**
 * The game clock (owner ruling 2026-10-09): Equoria runs on US Eastern time,
 * following daylight saving like a wall clock. Mirrors backend/utils/gameTime.mjs;
 * use it wherever the UI decides what "today" is, whatever the player's own zone.
 */

export const GAME_TIME_ZONE = 'America/New_York';

// en-CA formats a date as YYYY-MM-DD.
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: GAME_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Eastern game date of an instant, as 'YYYY-MM-DD'. */
export function gameDateKey(date: Date | string | number): string {
  return dateKeyFormatter.format(new Date(date));
}

/**
 * Whole-day index of the instant's Eastern game date. Subtracting two indexes
 * gives the number of game days between them (DST days count as one).
 */
export function gameDayIndex(date: Date | string | number): number {
  return Date.parse(`${gameDateKey(date)}T00:00:00Z`) / 86_400_000;
}
