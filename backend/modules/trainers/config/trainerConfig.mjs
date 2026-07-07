/**
 * Trainer module configuration (Equoria-oey96.8).
 *
 * SINGLE source of truth for the trainer roster cap. Enforced on the hire path
 * (trainerMarketplaceController.hireTrainerFromMarketplace) via a pre-tx
 * fast-path count PLUS an authoritative post-lock in-tx re-count of NON-retired
 * trainers, mirroring the landed groom pattern (Equoria-n4m5j / hduc5).
 *
 * The cap SCALES BY STABLE LEVEL (user decision 2026-07-07, ratified curve in
 * docs/design/2026-07-07-game-balance-formulas.md §3). Stable level derives
 * from User.level via the single exported getStableLevel() in the users module
 * — never inline `ceil(level/4)` at call sites.
 *
 * Trainers run one below riders at every stable level: every horse can carry a
 * rider AND a trainer, but trainers multi-assign across horses while riders are
 * the per-entry competition surface, so riders need slightly more room.
 */

/**
 * Maximum NON-retired trainers a user may hold, keyed by stable level (1–5).
 */
export const TRAINER_ROSTER_CAP_BY_STABLE_LEVEL = Object.freeze({
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
});

/**
 * Resolve the trainer roster cap for a given stable level (1–5).
 * Defensive fallback to the SL1 cap for any out-of-range input.
 *
 * @param {number} stableLevel - Clamped stable level (1–5).
 * @returns {number} Max non-retired trainers allowed.
 */
export function getTrainerRosterCap(stableLevel) {
  return TRAINER_ROSTER_CAP_BY_STABLE_LEVEL[stableLevel] ?? TRAINER_ROSTER_CAP_BY_STABLE_LEVEL[1];
}
