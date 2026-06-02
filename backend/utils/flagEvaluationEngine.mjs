/**
 * Flag Evaluation Engine
 * Core engine for evaluating and assigning epigenetic flags based on care patterns
 *
 * 🎯 PURPOSE:
 * Runs weekly evaluation between birth and age 3 to determine which epigenetic flags
 * should be assigned based on cumulative care patterns and trigger conditions.
 *
 * 📋 BUSINESS RULES:
 * - Evaluates horses aged 0-3 years only
 * - Maximum 5 flags per horse
 * - Flags are permanent once assigned
 * - Weekly evaluation cycles
 * - Trigger conditions must be met for flag assignment
 * - Flags can stack but cannot be overwritten
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
import {
  EPIGENETIC_FLAG_DEFINITIONS,
  MAX_FLAGS_PER_HORSE,
  FLAG_EVALUATION_AGE_RANGE,
} from '../config/epigeneticFlagDefinitions.mjs';
import { analyzeCarePatterns } from './carePatternAnalysis.mjs';
import { getHorseAgeYears } from './horseAge.mjs';

// Equoria-wpqr: FLAG_EVALUATION_AGE_RANGE is expressed in canonical
// game-years (1 game-week = 1 game-year = 7 real days). The DB-level
// getEligibleHorses() window needs a real-day delta, so convert the
// game-year bound to real days here rather than the old `* 365.25`
// calendar-year constant. This duplicates DAYS_PER_GAME_YEAR from
// backend/utils/horseAge.mjs (kept module-private there) as a named
// constant rather than widening that module's API for one caller.
const REAL_DAYS_PER_GAME_YEAR = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Equoria-yzqhj.4 — Parent → foal epigenetic FLAG inheritance (PREDISPOSITION model).
 *
 * Foals are NOT born with inherited flags. Behavioral flags still come ONLY from
 * 0-3yr care patterns (the canonical path in evaluateHorseFlags). Predisposition
 * means: a flag present in EITHER parent biases the foal's care-evaluation so that
 * the SAME care pattern is slightly more likely to trigger that one flag. It is a
 * nudge, never an auto-grant — a predisposed foal with no qualifying care still
 * develops nothing.
 *
 * Inheritance rule chosen: UNION of sire + dam flags (a flag in EITHER parent
 * predisposes the foal). This is the broadest sensible reading of "the parents'
 * behavioral profile" and avoids requiring both parents to share a flag (which
 * would make inheritance vanishingly rare given max 5 flags each).
 *
 * Bias mechanism (single named constant, conservative): when a flag is in the
 * foal's predisposed set, the NUMERIC care-pattern thresholds for THAT flag are
 * relaxed by FLAG_PREDISPOSITION_BIAS (a multiplier on `>=` minimums and a
 * reciprocal widening on `<=` maximums). 0.85 = a 15% reduction in the required
 * care-pattern strength. Non-predisposed flags are evaluated with the unchanged
 * thresholds, so a foal with no parents / no parent flags behaves EXACTLY as
 * before (regression-safe). Predisposition only ever lowers a bar; it never
 * raises one and never sets `triggered` true on its own.
 */
export const FLAG_PREDISPOSITION_BIAS = 0.85;

/**
 * Relax a `>=` minimum threshold for a predisposed flag.
 * @param {number} threshold - The normal minimum required value.
 * @param {boolean} predisposed - Whether the foal is predisposed to this flag.
 * @returns {number} The (possibly relaxed) minimum. Predisposition lowers it.
 */
function relaxMin(threshold, predisposed) {
  return predisposed ? threshold * FLAG_PREDISPOSITION_BIAS : threshold;
}

/**
 * Relax a `<=` maximum threshold for a predisposed flag (negative-flag bars).
 * Predisposition makes a negative flag slightly easier to reach too, by widening
 * the ceiling the same 15%.
 * @param {number} threshold - The normal maximum allowed value.
 * @param {boolean} predisposed - Whether the foal is predisposed to this flag.
 * @returns {number} The (possibly widened) maximum.
 */
function relaxMax(threshold, predisposed) {
  return predisposed ? threshold / FLAG_PREDISPOSITION_BIAS : threshold;
}

/**
 * Derive the foal's predisposed-flag Set from its parents' epigeneticFlags.
 * Loads sire + dam in a single query (filtering nulls). Returns the UNION of
 * both parents' flag arrays as a lowercase Set. A foal with no parents, or
 * parents with no flags, yields an empty Set (regression-safe no-op).
 * @param {number|null} sireId
 * @param {number|null} damId
 * @returns {Promise<Set<string>>}
 */
async function getPredisposedFlags(sireId, damId) {
  const parentIds = [sireId, damId].filter(id => id !== null && id !== undefined);
  if (parentIds.length === 0) {
    return new Set();
  }

  const parents = await prisma.horse.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, epigeneticFlags: true },
  });

  const predisposed = new Set();
  for (const parent of parents) {
    const flags = Array.isArray(parent.epigeneticFlags) ? parent.epigeneticFlags : [];
    for (const flag of flags) {
      if (typeof flag === 'string' && flag.length > 0) {
        predisposed.add(flag.toLowerCase());
      }
    }
  }
  return predisposed;
}

/**
 * Evaluate flags for a specific horse
 * @param {number} horseId - ID of the horse to evaluate
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Object} Evaluation results with newly assigned flags
 */
export async function evaluateHorseFlags(horseId, evaluationDate = new Date()) {
  logger.info(`[flagEvaluationEngine] Starting flag evaluation for horse ${horseId}`);

  // Get horse with current flags
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      epigeneticFlags: true,
      bondScore: true,
      stressLevel: true,
      // Equoria-yzqhj.4: parents reachable for live predisposition derivation.
      sireId: true,
      damId: true,
    },
  });

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  // Equoria-yzqhj.4: derive the foal's predisposed-flag set LIVE from its
  // parents' epigeneticFlags (union of sire + dam). No schema column, no
  // birth-time snapshot — a single inheritance path applied at the canonical
  // 0-3yr flag evaluation. Empty set for parentless foals → no bias.
  const predisposedFlags = await getPredisposedFlags(horse.sireId, horse.damId);

  // Equoria-wpqr: canonical game-years (1 game-week = 1 game-year,
  // floor(ageDays / 7), date-only UTC) via the single-source-of-truth
  // helper, NOT raw calendar `/ 365.25` math. The calendar reading made
  // the FLAG_EVALUATION_AGE_RANGE gate below effectively never reject
  // real game-aged horses: a 35-real-day-old horse is 5 game-years
  // (canonically OUT of the 0-3 range) but the old math computed
  // ageInYears ≈ 0.10 and wrongly treated it as in-range. Mirrors
  // Equoria-z183 (carePatternAnalysis) / Equoria-8qu4 / Equoria-rkld.
  const ageInYears = getHorseAgeYears(horse.dateOfBirth, evaluationDate);

  if (ageInYears < FLAG_EVALUATION_AGE_RANGE.MIN || ageInYears >= FLAG_EVALUATION_AGE_RANGE.MAX) {
    return {
      success: false,
      reason: `Horse age ${ageInYears} game-years is outside evaluation range (${FLAG_EVALUATION_AGE_RANGE.MIN}-${FLAG_EVALUATION_AGE_RANGE.MAX} game-years)`,
      horseId,
      horseName: horse.name,
      currentFlags: horse.epigeneticFlags || [],
      newFlags: [],
    };
  }

  // Check flag limit
  const currentFlags = horse.epigeneticFlags || [];
  if (currentFlags.length >= MAX_FLAGS_PER_HORSE) {
    return {
      success: false,
      reason: `Horse already has maximum number of flags (${MAX_FLAGS_PER_HORSE})`,
      horseId,
      horseName: horse.name,
      currentFlags,
      newFlags: [],
    };
  }

  // Analyze care patterns
  const careAnalysis = await analyzeCarePatterns(horseId, evaluationDate);

  if (!careAnalysis.eligible) {
    return {
      success: false,
      reason: careAnalysis.reason,
      horseId,
      horseName: horse.name,
      currentFlags,
      newFlags: [],
    };
  }

  // Evaluate each flag definition against care patterns
  const flagEvaluations = [];
  const newFlags = [];

  for (const [_flagKey, flagDef] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
    // Skip if horse already has this flag
    if (currentFlags.includes(flagDef.name)) {
      continue;
    }

    // Evaluate trigger conditions. Equoria-yzqhj.4: pass whether the foal is
    // predisposed to THIS specific flag (parent inheritance) so the per-flag
    // trigger fns relax only that flag's numeric thresholds.
    const predisposed = predisposedFlags.has(flagDef.name.toLowerCase());
    const evaluation = evaluateFlagTriggers(flagDef, careAnalysis.patterns, predisposed);
    flagEvaluations.push({
      flagName: flagDef.name,
      flagType: flagDef.type,
      triggered: evaluation.triggered,
      score: evaluation.score,
      conditions: evaluation.conditions,
      // Equoria-yzqhj.4: surface whether parent predisposition was in effect.
      predisposed,
    });

    // If triggered and we haven't reached the limit, assign the flag
    if (evaluation.triggered && currentFlags.length + newFlags.length < MAX_FLAGS_PER_HORSE) {
      newFlags.push(flagDef.name);
      logger.info(`[flagEvaluationEngine] Flag '${flagDef.name}' triggered for horse ${horseId}`);
    }
  }

  // Update horse with new flags if any were assigned
  if (newFlags.length > 0) {
    const updatedFlags = [...currentFlags, ...newFlags];
    await prisma.horse.update({
      where: { id: horseId },
      data: {
        epigeneticFlags: updatedFlags,
      },
    });

    logger.info(
      `[flagEvaluationEngine] Assigned ${newFlags.length} new flags to horse ${horseId}: ${newFlags.join(', ')}`,
    );
  }

  return {
    success: true,
    horseId,
    horseName: horse.name,
    // Equoria-wpqr: integer canonical game-years (was .toFixed(2) on the
    // old fractional calendar value — now an integer from getHorseAgeYears).
    ageInYears,
    currentFlags,
    newFlags,
    totalFlags: currentFlags.length + newFlags.length,
    careAnalysis,
    flagEvaluations,
    evaluationDate,
  };
}

/**
 * Evaluate trigger conditions for a specific flag
 * @param {Object} flagDefinition - Flag definition object
 * @param {Object} carePatterns - Care pattern analysis results
 * @param {boolean} [predisposed=false] - Equoria-yzqhj.4: whether the foal is
 *   predisposed to this flag via parent inheritance. When true, this flag's
 *   numeric care thresholds are relaxed by FLAG_PREDISPOSITION_BIAS. Defaults to
 *   false so every existing caller (and unknown-flag path) is unchanged.
 * @returns {Object} Evaluation result with trigger status and score
 */
function evaluateFlagTriggers(flagDefinition, carePatterns, predisposed = false) {
  const conditions = flagDefinition.triggerConditions;
  const evaluationResults = {};
  const _totalScore = 0;
  const _maxScore = 0;
  let triggered = false;

  // Evaluate each trigger condition based on flag type
  switch (flagDefinition.name) {
    case 'brave':
      triggered = evaluateBraveTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    case 'confident':
      triggered = evaluateConfidentTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'affectionate':
      triggered = evaluateAffectionateTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'resilient':
      triggered = evaluateResilientTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'fearful':
      triggered = evaluateFearfulTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    case 'insecure':
      triggered = evaluateInsecureTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'aloof':
      triggered = evaluateAloofTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    case 'skittish':
      triggered = evaluateSkittishTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'fragile':
      triggered = evaluateFragileTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    default:
      logger.warn(`[flagEvaluationEngine] Unknown flag type: ${flagDefinition.name}`);
  }

  // Calculate overall score
  const conditionCount = Object.keys(evaluationResults).length;
  const metConditions = Object.values(evaluationResults).filter(Boolean).length;
  const score = conditionCount > 0 ? metConditions / conditionCount : 0;

  return {
    triggered,
    score,
    conditions: evaluationResults,
  };
}

// Flag-specific trigger evaluation functions.
//
// Equoria-yzqhj.4: each takes a `predisposed` flag. When false (the default for
// every existing caller and parentless foals), the NUMERIC comparisons below
// reproduce the EXACT canonical thresholds from carePatternAnalysis.mjs — so
// behavior is byte-identical to before this change. When true, the relevant
// `>=` minimums are relaxed via relaxMin() (predisposed foals need ~15% less
// care strength) and `<=` maximums widened via relaxMax(). Predisposition only
// lowers a bar; it never sets `triggered` true on its own (care must still
// drive the qualifying inputs — e.g. brave still requires a calm groom present
// and at least one novelty-with-support event).
//
// Canonical threshold sources (mirrored here so the bias can scale them):
//   brave        novelty noveltyWithSupport >= 3, bondScore >= 30
//   confident    positiveInteractions >= 10, bondScore >= 40; consecutiveDays >= 7, bondScore >= 40
//   affectionate daysWithInteraction >= 7, bondScore >= 50; qualityInteractions >= 5
//   resilient    stressWithSupport >= 3; stressEvents >= 2
//   fearful      fearEvents >= 2; bondScore <= 20; noveltyWithSupport === 0
//   insecure     daysWithoutCare >= 4 & bondScore <= 25; OR poorQualityInteractions >= 3
//   aloof        interactions < 3 & bondScore <= 30; positiveInteractions <= 2
//   skittish     startleEvents >= 2; (noveltyWithSupport === 0 OR bondScore <= 25)
//   fragile      stressEvents >= 3 & stressWithSupport === 0; recoveryEvents === 0

function evaluateBraveTriggers(conditions, patterns, results, predisposed = false) {
  results.noveltyExposure =
    patterns.noveltyExposure.noveltyWithSupport >= relaxMin(3, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(30, predisposed);
  results.bondScore = patterns.bondingPatterns.currentBondScore >= relaxMin(30, predisposed);
  results.calmGroomPresent = patterns.noveltyExposure.calmGroomPresent;

  return results.noveltyExposure && results.bondScore && results.calmGroomPresent;
}

function evaluateConfidentTriggers(conditions, patterns, results, predisposed = false) {
  results.consistentCare =
    patterns.consistentCare.consecutiveDaysWithCare >= relaxMin(7, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(40, predisposed);
  results.positiveInteractions =
    patterns.bondingPatterns.positiveInteractions >= relaxMin(10, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(40, predisposed);

  return results.consistentCare && results.positiveInteractions;
}

function evaluateAffectionateTriggers(conditions, patterns, results, predisposed = false) {
  results.dailyGrooming =
    patterns.bondingPatterns.daysWithInteraction >= relaxMin(7, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(50, predisposed);
  results.humanInteraction =
    patterns.consistentCare.qualityInteractions >= relaxMin(5, predisposed);

  return results.dailyGrooming && results.humanInteraction;
}

function evaluateResilientTriggers(conditions, patterns, results, predisposed = false) {
  results.stressRecovery = patterns.stressManagement.stressWithSupport >= relaxMin(3, predisposed);
  results.moderateStress = patterns.stressManagement.stressEvents >= relaxMin(2, predisposed);

  return results.stressRecovery && results.moderateStress;
}

function evaluateFearfulTriggers(conditions, patterns, results, predisposed = false) {
  results.fearEvents = patterns.noveltyExposure.fearEvents >= relaxMin(2, predisposed);
  results.lowBond = patterns.bondingPatterns.currentBondScore <= relaxMax(20, predisposed);
  results.noSupport = patterns.noveltyExposure.noveltyWithSupport === 0;

  return results.fearEvents && results.lowBond && results.noSupport;
}

function evaluateInsecureTriggers(conditions, patterns, results, predisposed = false) {
  results.neglect =
    patterns.neglectPatterns.maxConsecutiveDaysWithoutCare >= relaxMin(4, predisposed) &&
    patterns.neglectPatterns.currentBondScore <= relaxMax(25, predisposed);
  results.inconsistentCare =
    patterns.neglectPatterns.poorQualityInteractions >= relaxMin(3, predisposed);

  return results.neglect || results.inconsistentCare;
}

function evaluateAloofTriggers(conditions, patterns, results, predisposed = false) {
  // Canonical meetsAloofThreshold = totalInteractions < 3 && bondScore <= 30.
  // A `< N` ceiling is widened for predisposition the same way a `<= N` ceiling
  // is (relaxMax), so a predisposed foal tolerates slightly more interaction.
  results.limitedInteraction =
    patterns.consistentCare.totalInteractions < relaxMax(3, predisposed) &&
    patterns.neglectPatterns.currentBondScore <= relaxMax(30, predisposed);
  results.lowEngagement = patterns.bondingPatterns.positiveInteractions <= relaxMax(2, predisposed);

  return results.limitedInteraction && results.lowEngagement;
}

function evaluateSkittishTriggers(conditions, patterns, results, predisposed = false) {
  results.startleEvents = patterns.environmentalFactors.startleEvents >= relaxMin(2, predisposed);
  results.noGroomPresent = patterns.noveltyExposure.noveltyWithSupport === 0;
  results.lowBond = patterns.bondingPatterns.currentBondScore <= relaxMax(25, predisposed);

  return results.startleEvents && (results.noGroomPresent || results.lowBond);
}

function evaluateFragileTriggers(conditions, patterns, results, predisposed = false) {
  results.multipleStressSpikes =
    patterns.stressManagement.stressEvents >= relaxMin(3, predisposed) &&
    patterns.stressManagement.stressWithSupport === 0;
  results.inadequateSupport = patterns.stressManagement.recoveryEvents === 0;

  return results.multipleStressSpikes && results.inadequateSupport;
}

/**
 * Batch evaluate flags for multiple horses
 * @param {Array} horseIds - Array of horse IDs to evaluate
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Array} Array of evaluation results
 */
export async function batchEvaluateFlags(horseIds, evaluationDate = new Date()) {
  const results = [];

  for (const horseId of horseIds) {
    try {
      const result = await evaluateHorseFlags(horseId, evaluationDate);
      results.push(result);
    } catch (error) {
      logger.error(
        `[flagEvaluationEngine] Error in batch evaluation for horse ${horseId}: ${error.message}`,
      );
      results.push({
        success: false,
        horseId,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get horses eligible for flag evaluation
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Array} Array of eligible horse IDs
 */
export async function getEligibleHorses(evaluationDate = new Date()) {
  // Equoria-wpqr: derive the birthdate window from canonical game-years,
  // not calendar `* 365.25` years. MAX game-years maps to
  // MAX * 7 real days; a horse born more than that many real days ago is
  // past the developmental window. MIN game-years (0) maps to "born now
  // or earlier". Without this conversion a 35-real-day-old horse
  // (5 game-years, out of range) fell inside a ~3-calendar-year window
  // and was wrongly returned as eligible. This is a coarse DB pre-filter;
  // evaluateHorseFlags re-checks each horse with the authoritative
  // getHorseAgeYears gate.
  const minBirthDate = new Date(
    evaluationDate.getTime() -
      FLAG_EVALUATION_AGE_RANGE.MAX * REAL_DAYS_PER_GAME_YEAR * MS_PER_DAY,
  );
  const maxBirthDate = new Date(
    evaluationDate.getTime() -
      FLAG_EVALUATION_AGE_RANGE.MIN * REAL_DAYS_PER_GAME_YEAR * MS_PER_DAY,
  );

  const eligibleHorses = await prisma.horse.findMany({
    where: {
      dateOfBirth: {
        gte: minBirthDate,
        lte: maxBirthDate,
      },
    },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      epigeneticFlags: true,
    },
  });

  // Filter horses with less than max flags in JavaScript
  const filteredHorses = eligibleHorses.filter(
    horse => (horse.epigeneticFlags || []).length < MAX_FLAGS_PER_HORSE,
  );

  return filteredHorses.map(horse => horse.id);
}

export default {
  evaluateHorseFlags,
  batchEvaluateFlags,
  getEligibleHorses,
  evaluateFlagTriggers,
};
