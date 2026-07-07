/**
 * Rider module configuration (Equoria-oey96.8).
 *
 * SINGLE source of truth for the rider roster cap. Enforced on the hire path
 * (riderMarketplaceController.hireRiderFromMarketplace) via a pre-tx fast-path
 * count PLUS an authoritative post-lock in-tx re-count of NON-retired riders,
 * mirroring the landed groom pattern (Equoria-n4m5j / hduc5).
 *
 * The cap SCALES BY STABLE LEVEL (user decision 2026-07-07, ratified curve in
 * docs/design/2026-07-07-game-balance-formulas.md §3). Stable level derives
 * from User.level via the single exported getStableLevel() in the users module
 * — never inline `ceil(level/4)` at call sites (that is how display and
 * enforcement drift).
 *
 * This map is the CANONICAL source; the frontend display map
 * `RIDER_CAREER_CONSTANTS.SLOT_CAP_BY_STABLE_LEVEL` (frontend/src/types/
 * riderCareer.ts) mirrors these values for UI purposes only.
 */

/**
 * Maximum NON-retired riders a user may hold, keyed by stable level (1–5).
 * Adopts the (previously orphaned) frontend SLOT_CAP_BY_STABLE_LEVEL map.
 */
export const RIDER_ROSTER_CAP_BY_STABLE_LEVEL = Object.freeze({
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
});

/**
 * Resolve the rider roster cap for a given stable level (1–5).
 * Defensive fallback to the SL1 cap for any out-of-range input — the caller
 * always passes a clamped getStableLevel() result, so the fallback is a
 * belt-and-braces guard, not an expected path.
 *
 * @param {number} stableLevel - Clamped stable level (1–5).
 * @returns {number} Max non-retired riders allowed.
 */
export function getRiderRosterCap(stableLevel) {
  return RIDER_ROSTER_CAP_BY_STABLE_LEVEL[stableLevel] ?? RIDER_ROSTER_CAP_BY_STABLE_LEVEL[1];
}
