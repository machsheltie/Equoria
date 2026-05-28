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
 * - `.claude/rules/PATTERN_LIBRARY.md` § "Horse Age — Date-Only UTC
 *   Arithmetic Convention" (Equoria-vdw5) for the broader date-math
 *   convention that established the 7-day game-year cadence.
 * - `backend/utils/horseAge.mjs` for the canonical age-math helpers
 *   that operate on UTC calendar days (this file is for millisecond
 *   arithmetic where calendar-day math is overkill).
 */

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Equoria game-year cadence: 7 real-time days = 1 game year. See the
 * horseAge convention in PATTERN_LIBRARY.md. Numerically identical to
 * MS_PER_WEEK by design; this alias exists so the call site can name
 * "this is game-year math" vs "this is week math."
 */
export const MS_PER_GAME_YEAR = MS_PER_WEEK;

/**
 * Equine gestation in the game: 7 real-time days (= 1 game year). Used
 * by the breeding system for foal due dates. Numerically identical to
 * MS_PER_WEEK / MS_PER_GAME_YEAR by design.
 */
export const GESTATION_DAYS = 7;
export const GESTATION_MS = GESTATION_DAYS * MS_PER_DAY;
