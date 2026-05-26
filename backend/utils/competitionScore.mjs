import logger from './logger.mjs';
import { getTemperamentCompetitionModifiers } from '../modules/horses/services/temperamentService.mjs';
import { applyFlagInfluencesToCompetition } from './epigeneticFlagInfluence.mjs';

/**
 * Calculate competition score for a horse in a specific event type
 * @param {Object} horse - Horse object with stats and traits
 * @param {string} eventType - Competition discipline (e.g., 'Racing', 'Show Jumping', 'Dressage')
 * @param {string} [showType='ridden'] - Competition show type: 'ridden' (Racing, Show Jumping,
 *   Dressage, Cross Country), 'conformation' (halter/in-hand shows), or 'parade' (presentation-
 *   style ridden work — uses ridden temperament modifier per Equoria-f0bv). Unrecognized values
 *   default to 'ridden' with a warning logged.
 * @returns {number} Final rounded competition score (minimum 0)
 */
export function calculateCompetitionScore(
  horse,
  eventType,
  showType = 'ridden',
  _luckFn = Math.random,
) {
  // Delegate to the detailed variant and return only the rounded score so
  // existing callers keep their behaviour. Equoria-hv1y added the detailed
  // calculator for runEnhancedCompetition; this is the back-compat shim.
  return calculateCompetitionScoreDetailed(horse, eventType, showType, _luckFn).finalScore;
}

/**
 * Same scoring as calculateCompetitionScore, but returns the full breakdown
 * including the temperament impact (Equoria-hv1y, prerequisite for
 * Equoria-pkga frontend display). The returned shape:
 *   {
 *     finalScore: <rounded integer ≥ 0>,
 *     temperamentImpact: {
 *       temperament: <string|null>,    // horse.temperament or null
 *       modifier:    <number>,         // clamped applied modifier, e.g. 0.05
 *       appliedAs:   'ridden' | 'conformation' | 'parade',
 *     } | null
 *   }
 * temperamentImpact is null when horse has no temperament field (legacy data).
 */
export function calculateCompetitionScoreDetailed(
  horse,
  eventType,
  showType = 'ridden',
  _luckFn = Math.random,
) {
  try {
    // Input validation
    if (!horse || typeof horse !== 'object') {
      throw new Error('Horse object is required');
    }

    if (!eventType || typeof eventType !== 'string') {
      throw new Error('Event type is required and must be a string');
    }

    // Normalize event type for consistency
    const normalizedEventType = eventType.trim();
    if (!normalizedEventType) {
      throw new Error('Event type cannot be blank after trimming');
    }

    // Calculate base score based on discipline-specific stat contributions
    let baseScore = 0;

    switch (normalizedEventType) {
      case 'Racing':
        baseScore = (horse.speed || 0) + (horse.stamina || 0) + (horse.intelligence || 0);
        break;

      case 'Show Jumping':
      case 'Jumping':
        // Use ?? so precision=0 is honoured; only fall back to agility when precision is null/undefined
        baseScore =
          (horse.precision ?? horse.agility ?? 0) + (horse.focus || 0) + (horse.stamina || 0);
        break;

      case 'Dressage':
        baseScore = (horse.precision || 0) + (horse.focus || 0) + (horse.obedience || 0);
        break;

      case 'Cross Country':
        baseScore = (horse.stamina || 0) + (horse.agility || 0) + (horse.boldness || 0);
        break;

      default:
        logger.warn(
          `[calculateCompetitionScore] Unknown event type: ${normalizedEventType}, using default calculation`,
        );
        baseScore = (horse.speed || 0) + (horse.stamina || 0) + (horse.intelligence || 0);
    }

    // Guard against non-finite stats (e.g. Infinity from corrupted data)
    if (!isFinite(baseScore)) {
      logger.warn(
        `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Non-finite base score (${baseScore}) — clamped to 0`,
      );
      baseScore = 0;
    }

    logger.info(
      `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Base score for ${normalizedEventType}: ${baseScore}`,
    );

    // Check for matching discipline affinity trait
    let traitBonus = 0;
    const epigeneticModifiers = horse.epigeneticModifiers;

    if (epigeneticModifiers?.positive && Array.isArray(epigeneticModifiers.positive)) {
      // Convert event type to trait name format
      const traitName = convertEventTypeToTraitName(normalizedEventType);

      if (epigeneticModifiers.positive.includes(traitName)) {
        traitBonus = 5;
        logger.info(
          `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Discipline affinity bonus applied for ${traitName} (+${traitBonus} points)`,
        );
      }
    }

    // Apply trait bonus
    const scoreWithTraitBonus = baseScore + traitBonus;

    // Validate showType — normalize unrecognized values to 'ridden' (default behavior).
    // Equoria-f0bv: 'parade' is a recognized showType (per Show.showType in schema) that
    // uses the ridden temperament modifier — parade is presentation-style ridden work, so
    // calm/steady horses benefit and nervous/reactive horses are penalized, consistent with
    // other ridden disciplines. No separate paradeModifier column is needed.
    let effectiveShowType = showType;
    if (showType !== 'ridden' && showType !== 'conformation' && showType !== 'parade') {
      logger.warn(
        `[calculateCompetitionScore] Unrecognized showType "${showType}" — defaulting to ridden modifier`,
      );
      effectiveShowType = 'ridden';
    }

    // Apply temperament modifier (pre-luck, per PRD-03 §7.5).
    // 'ridden' and 'parade' both consume riddenModifier; only 'conformation' uses conformationModifier.
    const temperamentMods = getTemperamentCompetitionModifiers(horse.temperament);
    const tempMod =
      effectiveShowType === 'conformation'
        ? temperamentMods.conformationModifier
        : temperamentMods.riddenModifier;
    // Clamp modifier to [-1, 1] to guard against corrupted data (all valid values are ≤ ±0.1)
    const clampedTempMod = Math.max(-1, Math.min(1, tempMod));
    const scoreAfterTemperament = scoreWithTraitBonus * (1 + clampedTempMod);

    if (clampedTempMod !== 0) {
      logger.info(
        `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Temperament "${horse.temperament}" ${effectiveShowType} modifier: ${(clampedTempMod * 100).toFixed(1)}%`,
      );
    }

    // Apply epigenetic FLAG influence (Equoria-yzqhj.1).
    // Behavioral flags (brave/confident/fearful/...) earned from 0-3yr foal
    // care now modify competition outcome. Applied pre-luck so the influence
    // is part of the deterministic, testable score. This is the single live
    // competition consumer of the flag-influence module — the inline
    // enhancedMilestoneEvaluation function is trait-WEIGHT-only (birth-time
    // trait generation), a distinct concern, so there is no double-counting.
    const flagInfluence = applyFlagInfluencesToCompetition(
      scoreAfterTemperament,
      Array.isArray(horse.epigeneticFlags) ? horse.epigeneticFlags : [],
      normalizedEventType,
    );
    const scoreAfterFlags = flagInfluence.modifiedScore;
    if (flagInfluence.totalModifier !== 0) {
      logger.info(
        `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Epigenetic flag influence ${flagInfluence.totalModifier > 0 ? '+' : ''}${flagInfluence.totalModifier.toFixed(1)} from ${(Array.isArray(horse.epigeneticFlags) ? horse.epigeneticFlags : []).length} flags`,
      );
    }

    // Apply ±9% random luck modifier
    // Ensure the range is exactly -0.09 to +0.09 (±9%)
    const randomValue = _luckFn(); // 0 to 1
    const luckModifier = randomValue * 0.18 - 0.09; // Range: -0.09 to +0.09 (±9%)

    // Clamp to ensure we never exceed ±9% due to floating point precision
    const clampedLuckModifier = Math.max(-0.09, Math.min(0.09, luckModifier));
    const luckAdjustment = scoreAfterFlags * clampedLuckModifier;

    logger.info(
      `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Luck modifier: ${(clampedLuckModifier * 100).toFixed(1)}%, adjustment: ${luckAdjustment.toFixed(1)}`,
    );

    // Calculate final score — clamped to minimum 0
    const finalScore = scoreAfterFlags + luckAdjustment;
    const roundedScore = Math.max(0, Math.round(finalScore));

    logger.info(
      `[calculateCompetitionScore] Horse ${horse.name || horse.id || '(unknown)'}: Final score: ${roundedScore} (base: ${baseScore}, trait: +${traitBonus}, temperament: ${(clampedTempMod * 100).toFixed(1)}%, luck: ${luckAdjustment.toFixed(1)})`,
    );

    // Equoria-hv1y — surface per-horse temperament impact for the response
    // envelope so frontend can render "Bold temperament: +5% ridden score".
    // Returns null when horse has no temperament (legacy data) so callers can
    // distinguish "no impact applied" from "impact was 0%".
    const temperamentImpact = horse.temperament
      ? {
          temperament: horse.temperament,
          modifier: clampedTempMod,
          appliedAs: effectiveShowType,
        }
      : null;

    // Equoria-yzqhj.1 — surface per-horse epigenetic-flag impact for the
    // response envelope (point delta + which behavior modifiers fired).
    // null when the horse has no flags so callers distinguish "no flags"
    // from "flags applied with 0 net effect".
    const hasFlags = Array.isArray(horse.epigeneticFlags) && horse.epigeneticFlags.length > 0;
    const flagImpact = hasFlags
      ? {
          flags: horse.epigeneticFlags,
          totalModifier: flagInfluence.totalModifier,
          appliedModifiers: flagInfluence.appliedModifiers,
        }
      : null;

    return { finalScore: roundedScore, temperamentImpact, flagImpact };
  } catch (error) {
    logger.error(
      `[calculateCompetitionScore] Error calculating score for horse ${horse?.name || horse?.id || '(unknown)'}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Convert event type to discipline affinity trait name
 * @param {string} eventType - Competition discipline
 * @returns {string} Trait name in format discipline_affinity_<type>
 */
function convertEventTypeToTraitName(eventType) {
  const eventTypeMap = {
    Racing: 'discipline_affinity_racing',
    'Show Jumping': 'discipline_affinity_show_jumping',
    Jumping: 'discipline_affinity_show_jumping',
    Dressage: 'discipline_affinity_dressage',
    'Cross Country': 'discipline_affinity_cross_country',
  };

  return (
    eventTypeMap[eventType] || `discipline_affinity_${eventType.toLowerCase().replace(/\s+/g, '_')}`
  );
}

/**
 * Get discipline-specific stat weights for scoring
 * @param {string} eventType - Competition discipline
 * @returns {Object} Object with stat names and their weights
 */
export function getDisciplineStatWeights(eventType) {
  const weights = {
    Racing: {
      speed: 1.0,
      stamina: 1.0,
      intelligence: 1.0,
    },
    'Show Jumping': {
      precision: 1.0,
      focus: 1.0,
      stamina: 1.0,
    },
    Jumping: {
      precision: 1.0,
      focus: 1.0,
      stamina: 1.0,
    },
    Dressage: {
      precision: 1.0,
      focus: 1.0,
      obedience: 1.0,
    },
    'Cross Country': {
      stamina: 1.0,
      agility: 1.0,
      boldness: 1.0,
    },
  };

  return weights[eventType] || weights['Racing']; // Default to Racing weights
}

/**
 * Validate horse object has required stats for competition
 * @param {Object} horse - Horse object to validate
 * @param {string} eventType - Competition discipline
 * @returns {boolean} True if horse has required stats
 */
export function validateHorseForCompetition(horse, eventType) {
  if (!horse || typeof horse !== 'object') {
    return false;
  }

  const requiredStats = getDisciplineStatWeights(eventType);

  // Check if horse has at least one of the required stats
  return Object.keys(requiredStats).some(stat => {
    const value = horse[stat];
    return typeof value === 'number' && value >= 0;
  });
}

export default calculateCompetitionScore;
