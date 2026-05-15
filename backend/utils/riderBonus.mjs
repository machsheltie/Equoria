/**
 * Rider scoring modifiers for the Equoria competition system.
 *
 * Per docs/data-models.md, the canonical scoring formula is:
 *
 *     FinalScore = subtotal * (1 + RiderBonusPercent - RiderPenaltyPercent)
 *
 * where `subtotal = base + luck` (or, in the richer simulateCompetition path,
 * `subtotal = baseStatScore + traitBonuses + trainingScore + tackBonuses`).
 *
 * This module exposes two helpers:
 *
 *   - `applyRiderModifiers(score, bonusPercent, penaltyPercent)`
 *       Pure math primitive. Validates ranges and returns the modified score.
 *
 *   - `computeRiderModifiers({ rider, discipline })`
 *       Derives `{ bonusPercent, penaltyPercent }` from a Rider row
 *       (`personality`, `skillLevel`, `level`, `prestige`) plus the
 *       competition discipline. Caps results at the validated ranges.
 *
 * Formula for computeRiderModifiers (Equoria-5bkh):
 *   - skillLevel: rookie=-2%, developing=0%, experienced=+3% (bonus)
 *   - level (1–10): +0.4% per level above 1, capped at +3.6% bonus
 *   - prestige (0–100): +0.04% per prestige point, capped at +4% bonus
 *   - discipline-personality affinity (from RIDER_PERSONALITY_DATA):
 *       high match: +2% bonus
 *       medium match: +1% bonus
 *       no match: 0% bonus
 *   - retired rider: -8% penalty (max). Otherwise penalty stays at 0 unless
 *     skillLevel === 'rookie' (in which case penalty = 1%).
 *
 * The function CAPS bonus at 0.10 (10%) and penalty at 0.08 (8%) so it can
 * always be safely passed to `applyRiderModifiers` (which enforces those
 * ranges and throws otherwise).
 *
 * Design notes:
 *   - Defensive: returns `{ bonusPercent: 0, penaltyPercent: 0 }` for null/
 *     malformed input rather than throwing. Scoring code calls this on every
 *     entry and a malformed Rider row should never crash the entire show.
 *   - The discipline-affinity table is intentionally duplicated here from the
 *     frontend `RIDER_PERSONALITY_DATA` to avoid a frontend→backend import.
 *     A follow-up issue can extract it into a shared package.
 */

const BONUS_CAP = 0.1; // 10%
const PENALTY_CAP = 0.08; // 8%

// Discipline → personality → magnitude affinity. Mirrors
// frontend/src/types/riderPersonality.ts RIDER_PERSONALITY_DATA.
// Magnitudes: 'high' (+2%), 'medium' (+1%), 'low' (0%).
const RIDER_DISCIPLINE_AFFINITY = Object.freeze({
  daring: Object.freeze({
    Racing: 'high',
    'Show Jumping': 'high',
    'Cross Country': 'medium',
  }),
  methodical: Object.freeze({
    Dressage: 'high',
    'Western Pleasure': 'high',
    Reining: 'medium',
  }),
  intuitive: Object.freeze({
    'Trail Riding': 'high',
    Endurance: 'high',
    'Natural Horsemanship': 'high',
  }),
  competitive: Object.freeze({
    'Stadium Jumping': 'high',
    'Show Jumping': 'high',
    'Barrel Racing': 'high',
    Cutting: 'medium',
  }),
});

const AFFINITY_BONUS = Object.freeze({ high: 0.02, medium: 0.01 });

/**
 * Apply rider modifiers (bonus and penalty) to a competition score.
 *
 * @param {number} score - The base score before rider modifiers
 * @param {number} bonusPercent - Rider bonus as decimal (0-0.10 for 0-10%)
 * @param {number} penaltyPercent - Rider penalty as decimal (0-0.08 for 0-8%)
 * @returns {number} - Modified score with rider effects applied
 */
function applyRiderModifiers(score, bonusPercent = 0, penaltyPercent = 0) {
  if (typeof score !== 'number' || score < 0) {
    throw new Error('Score must be a non-negative number');
  }

  if (typeof bonusPercent !== 'number' || bonusPercent < 0 || bonusPercent > BONUS_CAP) {
    throw new Error('Bonus percent must be between 0 and 0.10 (10%)');
  }

  if (typeof penaltyPercent !== 'number' || penaltyPercent < 0 || penaltyPercent > PENALTY_CAP) {
    throw new Error('Penalty percent must be between 0 and 0.08 (8%)');
  }

  return score * (1 + bonusPercent - penaltyPercent);
}

/**
 * Compute rider bonus/penalty percentages from a Rider row + discipline.
 *
 * Returns `{ bonusPercent: 0, penaltyPercent: 0 }` for missing/invalid input.
 * Output is always within `applyRiderModifiers`' validated range.
 *
 * @param {Object} params
 * @param {Object|null} params.rider - Rider row (personality, skillLevel, level, prestige, retired)
 * @param {string} params.discipline - The show's discipline (e.g. "Dressage")
 * @returns {{ bonusPercent: number, penaltyPercent: number }}
 */
function computeRiderModifiers({ rider, discipline } = {}) {
  if (!rider || typeof rider !== 'object') {
    return { bonusPercent: 0, penaltyPercent: 0 };
  }

  let bonus = 0;
  let penalty = 0;

  // ── skillLevel contribution ─────────────────────────────────────────────
  const skillLevel = typeof rider.skillLevel === 'string' ? rider.skillLevel.toLowerCase() : '';
  if (skillLevel === 'experienced') {
    bonus += 0.03;
  } else if (skillLevel === 'rookie') {
    // Rookies have a small penalty — they don't bring stat advantage yet.
    penalty += 0.01;
  }
  // 'developing' = neutral

  // ── level (1–10) contribution: +0.4% per level above 1, max +3.6% ─────
  const level = Number.isFinite(rider.level) ? Math.max(1, Math.min(10, rider.level)) : 1;
  bonus += (level - 1) * 0.004;

  // ── prestige (0–100) contribution: +0.04% per point, max +4% ──────────
  const prestige = Number.isFinite(rider.prestige) ? Math.max(0, Math.min(100, rider.prestige)) : 0;
  bonus += prestige * 0.0004;

  // ── discipline-personality affinity ─────────────────────────────────────
  const personality = typeof rider.personality === 'string' ? rider.personality.toLowerCase() : '';
  const personalityMap = RIDER_DISCIPLINE_AFFINITY[personality];
  if (personalityMap && typeof discipline === 'string') {
    const magnitude = personalityMap[discipline];
    if (magnitude && AFFINITY_BONUS[magnitude]) {
      bonus += AFFINITY_BONUS[magnitude];
    }
  }

  // ── retired riders incur full penalty ──────────────────────────────────
  if (rider.retired === true) {
    penalty = PENALTY_CAP;
  }

  // ── clamp to validated ranges so applyRiderModifiers cannot throw ─────
  bonus = Math.max(0, Math.min(BONUS_CAP, bonus));
  penalty = Math.max(0, Math.min(PENALTY_CAP, penalty));

  return { bonusPercent: bonus, penaltyPercent: penalty };
}

export { applyRiderModifiers, computeRiderModifiers };
