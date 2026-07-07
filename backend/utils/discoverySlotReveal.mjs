/**
 * Discovery-slot reveal cadence (Equoria-oey96.25)
 *
 * Riders and trainers each have 6 career-affinity discovery slots that reveal
 * progressively as the NPC's career level climbs. Career level caps at 10 (see
 * `riderTrainerProgressionService.calculateLevel` / `LEVEL_CAP` and the schema
 * `level Int 1–10`).
 *
 * The prior cadence — `Math.min(Math.floor(level / 2), 6)` — topped out at
 * `floor(10 / 2) = 5` revealed slots, so the 6th slot required level >= 12 and
 * was PERMANENTLY unreachable at the level-10 cap (audit finding P2-15). This
 * helper replaces that formula with an explicit stepped threshold table so all
 * 6 slots become revealable by level 10, while preserving "level 1 → 0 slots".
 *
 * Level → revealed count:
 *   L1  → 0    (no slot yet — matches "rookie/novice at level 1 sees 0 slots")
 *   L2  → 1    L3 → 1
 *   L4  → 2    L5 → 2
 *   L6  → 3    L7 → 3
 *   L8  → 4
 *   L9  → 5
 *   L10 → 6    (all slots revealed at the cap — matches the PRD-05/PRD-06 AC)
 *
 * Reveal is monotonic (thresholds only increase) and naturally capped at 6 (the
 * table has exactly 6 entries). Shared by both the rider and trainer discovery
 * controllers so the two modules cannot drift apart on the cadence.
 */

/**
 * Career level at which discovery slot index 0..5 becomes visible.
 * Index i in this array is the level required to reveal the (i+1)th slot.
 * @type {readonly number[]}
 */
export const DISCOVERY_REVEAL_LEVEL_THRESHOLDS = Object.freeze([2, 4, 6, 8, 9, 10]);

/** Total number of discovery slots (3 categories × 2 slots). */
export const TOTAL_DISCOVERY_SLOTS = DISCOVERY_REVEAL_LEVEL_THRESHOLDS.length;

/**
 * Number of discovery slots revealed at a given career level.
 *
 * @param {number} level - NPC career level (expected 1..10). Non-numeric,
 *   non-finite, or < 1 defensively returns 0.
 * @returns {number} revealed count in the range [0, TOTAL_DISCOVERY_SLOTS]
 */
export function getRevealedDiscoveryCount(level) {
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) {
    return 0;
  }
  let count = 0;
  for (const threshold of DISCOVERY_REVEAL_LEVEL_THRESHOLDS) {
    if (level >= threshold) {
      count += 1;
    }
  }
  return count;
}

/**
 * Level at which the NEXT slot reveals, or null if all slots are already
 * revealed. Given the current revealed count, the next slot's threshold is the
 * entry at that index in DISCOVERY_REVEAL_LEVEL_THRESHOLDS.
 *
 * @param {number} revealedCount - current revealed count (0..TOTAL_DISCOVERY_SLOTS)
 * @returns {number|null} next reveal level, or null when fully revealed
 */
export function getNextDiscoveryRevealLevel(revealedCount) {
  if (typeof revealedCount !== 'number' || revealedCount >= TOTAL_DISCOVERY_SLOTS) {
    return null;
  }
  const idx = Math.max(0, Math.floor(revealedCount));
  return DISCOVERY_REVEAL_LEVEL_THRESHOLDS[idx] ?? null;
}
