/**
 * Trainer training-modifier computation (Equoria-oey96.7).
 *
 * Mirrors the shape of computeRiderModifiers (backend/utils/riderBonus.mjs): a
 * defensive, pure, capped function that derives a { bonusPercent, penaltyPercent }
 * pair from a Trainer row + the training discipline + the horse's temperament.
 *
 * The training controller applies the NET (bonusPercent − penaltyPercent) to the
 * DISCIPLINE-SCORE gain only — never to user XP and never to the stat-gain
 * chance (the owner-ratified single-lever design). This module, its controller
 * integration, and focused tests own the implemented contract.
 *
 * Formula:
 *   bonus   = SKILL_BONUS[skillLevel]                    // novice .02 | developing .05 | expert .10
 *           + (clamp(level,1,10) − 1) · 0.005            // +0.5%/level above 1, max +4.5%
 *           + (speciality === discipline ? 0.05 : 0)     // discipline match
 *           + max(0,  COMPAT[personality][temperament])  // positive compat
 *   penalty = max(0, −COMPAT[personality][temperament])  // negative compat
 *   caps:   bonus ≤ TRAINER_BONUS_CAP (0.20), penalty ≤ TRAINER_PENALTY_CAP (0.08)
 *
 * Retired trainers are a defensive dead-end → { 0, penalty cap }. The focused
 * regression contract requires "never net-positive / no bonus retention".
 * Leaving the bonus intact (up to +0.20) against a −0.08 penalty would be
 * net-POSITIVE, which
 * contradicts that contract; so a retired trainer retains no bonus. (The
 * assign-time guard against staffing a retired trainer is oey96.24; this is the
 * scoring-time backstop.)
 *
 * Canonical-set guard (PATTERN_LIBRARY "Universal Selector" pattern): the
 * personality and temperament are validated against their canonical sets BEFORE
 * the compat lookup, so a typo silently contributes 0 — never a stealth bonus or
 * penalty. (The matrix has no wildcard sentinel, so a typo already misses every
 * cell; the guard makes that explicit and logs genuine data errors.)
 *
 * Defensive: null / malformed trainer → { 0, 0 } (the no-trainer path — an
 * unstaffed horse trains exactly as it did before this feature shipped).
 */

import logger from '../../../utils/logger.mjs';

// Caps (decimals). The cap VALUES are tunable (game balance); the presence of a
// cap and the { bonusPercent, penaltyPercent } shape are structural.
export const TRAINER_BONUS_CAP = 0.2; // 20%
export const TRAINER_PENALTY_CAP = 0.08; // 8%

// Skill-level base bonus (marketplace skill tiers: novice | developing | expert).
export const TRAINER_SKILL_BONUS = Object.freeze({
  novice: 0.02,
  developing: 0.05,
  expert: 0.1,
});

// personality × temperament compatibility, decimals in [−0.04, +0.04].
// Unlisted (valid) pairs = 0. Every cell is explicit — NO wildcard sentinel —
// so an unknown key can never leak a value. Focused tests pin every cell and
// the defensive unknown-key behavior.
export const TRAINER_COMPATIBILITY = Object.freeze({
  focused: Object.freeze({ Playful: 0.03, Spirited: 0.02, Reactive: 0.02, Lazy: -0.02 }),
  encouraging: Object.freeze({ Nervous: 0.04, Lazy: 0.03, Playful: 0.02, Aggressive: -0.02 }),
  technical: Object.freeze({
    Calm: 0.03,
    Steady: 0.03,
    Independent: 0.02,
    Reactive: -0.03,
    Nervous: -0.02,
  }),
  competitive: Object.freeze({
    Bold: 0.04,
    Spirited: 0.03,
    Aggressive: 0.02,
    Nervous: -0.04, // the PRD-06 §3 worked example
    Reactive: -0.02,
  }),
  patient: Object.freeze({ Stubborn: 0.04, Nervous: 0.03, Reactive: 0.03, Aggressive: 0.02 }),
});

// Canonical trainer personalities (the 5 marketplace personalities) — derived
// from the matrix keys, so the two can never drift apart.
const CANONICAL_TRAINER_PERSONALITIES = new Set(Object.keys(TRAINER_COMPATIBILITY));

// Canonical horse temperaments (the 11). Intentionally duplicated from the
// horses module's TEMPERAMENT_TYPES to keep this trainer service a LEAF (no
// heavyweight cross-module barrel import for a validation list) — the same
// rationale riderBonus.mjs uses for duplicating RIDER_PERSONALITY_DATA. Drift is
// guarded by a sentinel test asserting this set === horses-module
// TEMPERAMENT_TYPES.
export const TRAINER_CANONICAL_TEMPERAMENTS = Object.freeze([
  'Spirited',
  'Nervous',
  'Calm',
  'Bold',
  'Steady',
  'Independent',
  'Reactive',
  'Stubborn',
  'Playful',
  'Lazy',
  'Aggressive',
]);
const CANONICAL_TEMPERAMENT_SET = new Set(TRAINER_CANONICAL_TEMPERAMENTS);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute a trainer's training bonus/penalty percentages.
 *
 * @param {Object} params
 * @param {Object|null} params.trainer - Trainer row (skillLevel, level,
 *   speciality, personality, retired) or null.
 * @param {string} params.discipline - The training discipline (e.g. "Dressage").
 * @param {string|null} params.horseTemperament - One of the 11 temperaments, or null.
 * @returns {{ bonusPercent: number, penaltyPercent: number }} Both ≥ 0, capped.
 */
export function computeTrainerModifiers({ trainer, discipline, horseTemperament } = {}) {
  if (!trainer || typeof trainer !== 'object') {
    return { bonusPercent: 0, penaltyPercent: 0 };
  }

  // Retired → defensive dead-end: no bonus retained, penalty at cap, net −8%.
  if (trainer.retired === true) {
    return { bonusPercent: 0, penaltyPercent: TRAINER_PENALTY_CAP };
  }

  let bonus = 0;
  let penalty = 0;

  // ── skill base ──────────────────────────────────────────────────────────
  const skillLevel =
    typeof trainer.skillLevel === 'string' ? trainer.skillLevel.trim().toLowerCase() : '';
  bonus += TRAINER_SKILL_BONUS[skillLevel] ?? 0;

  // ── level (1–10): +0.5%/level above 1 (this term maxes at +4.5%) ─────────
  const level = Number.isFinite(trainer.level) ? clamp(trainer.level, 1, 10) : 1;
  bonus += (level - 1) * 0.005;

  // ── discipline speciality match ──────────────────────────────────────────
  if (
    typeof trainer.speciality === 'string' &&
    typeof discipline === 'string' &&
    trainer.speciality === discipline
  ) {
    bonus += 0.05;
  }

  // ── personality × temperament compatibility (canonical-set guarded) ──────
  const personality =
    typeof trainer.personality === 'string' ? trainer.personality.trim().toLowerCase() : '';
  const temperament = typeof horseTemperament === 'string' ? horseTemperament.trim() : '';
  const personalityOk = CANONICAL_TRAINER_PERSONALITIES.has(personality);
  const temperamentOk = CANONICAL_TEMPERAMENT_SET.has(temperament);

  if (personalityOk && temperamentOk) {
    const compat = TRAINER_COMPATIBILITY[personality][temperament] ?? 0;
    bonus += Math.max(0, compat);
    penalty += Math.max(0, -compat);
  } else {
    // Only warn for a genuinely non-canonical value — a VALID temperament that
    // simply has no compat entry is legitimate (0), not a data error.
    if (personality && !personalityOk) {
      logger.warn(
        `[trainerModifiers] Non-canonical trainer personality "${trainer.personality}" — compat contributes 0`,
      );
    }
    if (temperament && !temperamentOk) {
      logger.warn(
        `[trainerModifiers] Non-canonical horse temperament "${horseTemperament}" — compat contributes 0`,
      );
    }
  }

  bonus = clamp(bonus, 0, TRAINER_BONUS_CAP);
  penalty = clamp(penalty, 0, TRAINER_PENALTY_CAP);

  return { bonusPercent: bonus, penaltyPercent: penalty };
}

export default computeTrainerModifiers;
