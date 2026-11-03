/**
 * backend/constants/time.mjs — canonical millisecond durations.
 *
 * Equoria-maint: prior to this file, the literal `7 * 24 * 60 * 60 * 1000`
 * appeared in 8+ production sites with at least three distinct semantic
 * meanings — "1 week" (sessions / training cooldown / weekly settlement),
 * "1 game year" (horse aging, where 7 real days = 1 game year per the
 * project convention), and "gestation duration" (breeding). The meaning
 * was invisible at the call site; refactoring one site without the
 * others risked drift in only one semantic.
 *
 * The constants below have IDENTICAL numeric values for week/game-year/
 * gestation — that's the project's intentional design (a game year IS
 * one real week). The named exports let each call site read what it
 * means semantically.
 *
 * Cross-reference:
 * - `backend/utils/horseAge.mjs` for the canonical age-math helpers
 *   that operate on Eastern game-calendar days (this file is for millisecond
 *   arithmetic where calendar-day math is overkill).
 */

export const msPerSecond = 1000;
export const msPerMinute = 60 * msPerSecond;
export const msPerHour = 60 * msPerMinute;
export const msPerDay = 24 * msPerHour;
/** One real week in ms. */
export const msPerWeek = 7 * msPerDay;

/**
 * Equoria game-year cadence: 7 real-time days = 1 game year. Numerically
 * identical to msPerWeek by design; this alias lets the call site name
 * "game-year math" rather than an undifferentiated week.
 */
export const msPerGameYear = msPerWeek;

/**
 * Equine gestation in the game: 7 real-time days (= 1 game year). Used
 * by the breeding system for foal due dates. Numerically identical to
 * msPerWeek / msPerGameYear by design.
 */
export const gestationDays = 7;
export const gestationMs = gestationDays * msPerDay;
