/**
 * The game clock (owner ruling 2026-10-09): Equoria runs on US Eastern time,
 * following daylight saving like a wall clock. Mirrors backend/utils/gameTime.mjs;
 * use it wherever the UI decides what "today" is, whatever the player's own zone.
 */

export const gameTimeZone = 'America/New_York';

// en-CA formats a date as YYYY-MM-DD.
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: gameTimeZone,
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

const wallFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: gameTimeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** An instant's Eastern wall-clock reading, written as a UTC instant (ms). */
function easternWallMs(ms: number): number {
  const parts: Record<string, number> = {};
  for (const { type, value } of wallFormatter.formatToParts(ms)) parts[type] = Number(value);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

/**
 * How many times the Eastern clock read a wall time 'YYYY-MM-DDTHH:mm' (as a
 * datetime-local field gives it): 0 for a time the clocks skip (2:xx a.m. the
 * night they spring forward), 2 for one they repeat (1:xx a.m. the night they
 * go back), otherwise 1; null for anything else. Mirrors the server's
 * easternWallTimeInstants (backend/modules/staff/services/timeBackService.mjs).
 */
export function easternWallTimeCount(text: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallMs = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(wallMs)) return null;
  // The Eastern offsets in force a day either side: at most one clock change lies between.
  const offsets = new Set(
    [-86_400_000, 86_400_000].map((d) => easternWallMs(wallMs + d) - (wallMs + d))
  );
  return [...offsets].filter((offset) => easternWallMs(wallMs - offset) === wallMs).length;
}
