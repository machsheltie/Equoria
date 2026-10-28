/**
 * Trainer module configuration (Equoria-oey96.8).
 *
 * SINGLE source of truth for the trainer roster cap. Enforced on the hire path
 * (trainerMarketplaceController.hireTrainerFromMarketplace) via a pre-tx
 * fast-path count PLUS an authoritative post-lock in-tx re-count of NON-retired
 * trainers, mirroring the landed groom pattern (Equoria-n4m5j / hduc5).
 *
 * The cap SCALES BY STABLE LEVEL. Stable level derives from User.level via the single
 * exported getStableLevel() in the users module — never inline `ceil(level/4)` at call
 * sites.
 *
 * Owner ruling 2026-10-28 (q222, Equoria-asmsy): "2 for level 1, then +1 per level, up
 * to 10." This replaces the 2026-07-07 table (1/2/3/4/5). The trainer page reads the
 * same number from GET /api/v1/trainers/roster-cap, so the page and the hire refusal
 * can never disagree.
 */

/** The most trainers any player may hold (q222). */
export const trainerRosterCapMax = 10;

/**
 * Resolve the trainer roster cap for a stable level: 2 at level 1, one more per level,
 * never more than 10. Any out-of-range or non-numeric input counts as level 1.
 *
 * @param {number} stableLevel
 * @returns {number} Max non-retired trainers allowed.
 */
export function getTrainerRosterCap(stableLevel) {
  const level = Number.isInteger(stableLevel) && stableLevel >= 1 ? stableLevel : 1;
  return Math.min(trainerRosterCapMax, level + 1);
}
