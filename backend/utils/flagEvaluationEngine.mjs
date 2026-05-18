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

import prisma from '../db/index.mjs';
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
 * Evaluate flags for a specific horse
 * @param {number} horseId - ID of the horse to evaluate
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Object} Evaluation results with newly assigned flags
 */
export async function evaluateHorseFlags(horseId, evaluationDate = new Date()) {
  try {
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
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

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

      // Evaluate trigger conditions
      const evaluation = evaluateFlagTriggers(flagDef, careAnalysis.patterns);
      flagEvaluations.push({
        flagName: flagDef.name,
        flagType: flagDef.type,
        triggered: evaluation.triggered,
        score: evaluation.score,
        conditions: evaluation.conditions,
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
  } catch (error) {
    logger.error(
      `[flagEvaluationEngine] Error evaluating flags for horse ${horseId}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Evaluate trigger conditions for a specific flag
 * @param {Object} flagDefinition - Flag definition object
 * @param {Object} carePatterns - Care pattern analysis results
 * @returns {Object} Evaluation result with trigger status and score
 */
function evaluateFlagTriggers(flagDefinition, carePatterns) {
  const conditions = flagDefinition.triggerConditions;
  const evaluationResults = {};
  const _totalScore = 0;
  const _maxScore = 0;
  let triggered = false;

  // Evaluate each trigger condition based on flag type
  switch (flagDefinition.name) {
    case 'brave':
      triggered = evaluateBraveTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'confident':
      triggered = evaluateConfidentTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'affectionate':
      triggered = evaluateAffectionateTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'resilient':
      triggered = evaluateResilientTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'fearful':
      triggered = evaluateFearfulTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'insecure':
      triggered = evaluateInsecureTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'aloof':
      triggered = evaluateAloofTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'skittish':
      triggered = evaluateSkittishTriggers(conditions, carePatterns, evaluationResults);
      break;
    case 'fragile':
      triggered = evaluateFragileTriggers(conditions, carePatterns, evaluationResults);
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

// Flag-specific trigger evaluation functions
function evaluateBraveTriggers(conditions, patterns, results) {
  results.noveltyExposure = patterns.noveltyExposure.meetsBraveThreshold;
  results.bondScore = patterns.bondingPatterns.currentBondScore >= 30;
  results.calmGroomPresent = patterns.noveltyExposure.calmGroomPresent;

  return results.noveltyExposure && results.bondScore && results.calmGroomPresent;
}

function evaluateConfidentTriggers(conditions, patterns, results) {
  results.consistentCare = patterns.consistentCare.meetsConsistentCareThreshold;
  results.positiveInteractions = patterns.bondingPatterns.meetsConfidentThreshold;

  return results.consistentCare && results.positiveInteractions;
}

function evaluateAffectionateTriggers(conditions, patterns, results) {
  results.dailyGrooming = patterns.bondingPatterns.meetsAffectionateThreshold;
  results.humanInteraction = patterns.consistentCare.qualityInteractions >= 5;

  return results.dailyGrooming && results.humanInteraction;
}

function evaluateResilientTriggers(conditions, patterns, results) {
  results.stressRecovery = patterns.stressManagement.meetsResilientThreshold;
  results.moderateStress = patterns.stressManagement.stressEvents >= 2;

  return results.stressRecovery && results.moderateStress;
}

function evaluateFearfulTriggers(conditions, patterns, results) {
  results.fearEvents = patterns.noveltyExposure.fearEvents >= 2;
  results.lowBond = patterns.bondingPatterns.currentBondScore <= 20;
  results.noSupport = patterns.noveltyExposure.noveltyWithSupport === 0;

  return results.fearEvents && results.lowBond && results.noSupport;
}

function evaluateInsecureTriggers(conditions, patterns, results) {
  results.neglect = patterns.neglectPatterns.meetsInsecureThreshold;
  results.inconsistentCare = patterns.neglectPatterns.poorQualityInteractions >= 3;

  return results.neglect || results.inconsistentCare;
}

function evaluateAloofTriggers(conditions, patterns, results) {
  results.limitedInteraction = patterns.neglectPatterns.meetsAloofThreshold;
  results.lowEngagement = patterns.bondingPatterns.positiveInteractions <= 2;

  return results.limitedInteraction && results.lowEngagement;
}

function evaluateSkittishTriggers(conditions, patterns, results) {
  results.startleEvents = patterns.environmentalFactors.meetsSkittishThreshold;
  results.noGroomPresent = patterns.noveltyExposure.noveltyWithSupport === 0;
  results.lowBond = patterns.bondingPatterns.currentBondScore <= 25;

  return results.startleEvents && (results.noGroomPresent || results.lowBond);
}

function evaluateFragileTriggers(conditions, patterns, results) {
  results.multipleStressSpikes = patterns.stressManagement.meetsFragileThreshold;
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
  try {
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
  } catch (error) {
    logger.error(`[flagEvaluationEngine] Error getting eligible horses: ${error.message}`);
    throw error;
  }
}

export default {
  evaluateHorseFlags,
  batchEvaluateFlags,
  getEligibleHorses,
  evaluateFlagTriggers,
};
