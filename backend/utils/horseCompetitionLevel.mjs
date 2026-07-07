/**
 * Horse competition level + show level-bracket eligibility (Equoria-g8qg0).
 *
 * The Horse model has NO `level` column — progression is tracked as `horseXp`
 * (packages/database/prisma/schema.prisma). Shows advertise a level bracket
 * (Show.levelMin / Show.levelMax, Equoria-nx8t1 R1) but, until g8qg0, neither
 * entry path enforced it.
 *
 * USER DECISION (2026-07-07, on Equoria-g8qg0) — MAPPING PINNED:
 *   horseLevel = floor(horseXp / 100) + 1
 * This mirrors the user XP "100 XP = a level" curve chosen at smqn7 so the game
 * has ONE consistent leveling model. Do NOT substitute the discipline-relative
 * `calculateHorseLevel(horse, discipline)` from competitionLogic.mjs here — that
 * is a DIFFERENT concept (a per-discipline competitive rating), not the
 * XP-bracket level the show bracket is enforced against.
 *
 * Both server entry paths (showController.enterShow via showEscrowTx, and
 * POST /api/v1/competition/enter via competitionRouteQueries) share these
 * helpers so the two paths can never drift on the formula or the comparison.
 */

// The pinned XP-per-level constant. floor(horseXp / 100) + 1.
export const HORSE_XP_PER_LEVEL = 100;

/**
 * Compute a horse's XP-bracket level from its cumulative horseXp.
 * horseXp is a non-null Int (@default(0)) at the schema layer; the guard below
 * only defends against a caller passing a non-finite / negative value so the
 * level can never be NaN or < 1.
 *
 * @param {number} horseXp - Cumulative horse XP.
 * @returns {number} The 1-based level: floor(max(0,horseXp) / 100) + 1.
 */
export function getHorseXpLevel(horseXp) {
  const xp = Number.isFinite(horseXp) && horseXp > 0 ? horseXp : 0;
  return Math.floor(xp / HORSE_XP_PER_LEVEL) + 1;
}

/**
 * True when horseLevel falls inside the show's advertised bracket
 * (levelMin <= horseLevel <= levelMax, inclusive on both ends).
 *
 * levelMin/levelMax are non-null Int on Show. If a caller ever passes a
 * non-number (defensive — legacy row / partial select), that end is treated as
 * unbounded so the guard fails OPEN only for a genuinely-absent bound, never
 * silently rejecting a valid entry.
 *
 * @param {number} horseLevel - The horse's XP-bracket level (from getHorseXpLevel).
 * @param {number} levelMin - Show.levelMin.
 * @param {number} levelMax - Show.levelMax.
 * @returns {boolean} Whether the horse is eligible for the bracket.
 */
export function isHorseWithinLevelBracket(horseLevel, levelMin, levelMax) {
  const min = typeof levelMin === 'number' ? levelMin : Number.NEGATIVE_INFINITY;
  const max = typeof levelMax === 'number' ? levelMax : Number.POSITIVE_INFINITY;
  return horseLevel >= min && horseLevel <= max;
}
