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

    // Check age eligibility
    const ageInYears = (evaluationDate - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25);

    if (ageInYears < FLAG_EVALUATION_AGE_RANGE.MIN || ageInYears >= FLAG_EVALUATION_AGE_RANGE.MAX) {
      return {
        success: false,
        reason: `Horse age ${ageInYears.toFixed(2)} years is outside evaluation range (${FLAG_EVALUATION_AGE_RANGE.MIN}-${FLAG_EVALUATION_AGE_RANGE.MAX} years)`,
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
      if (evaluation.triggered && (currentFlags.length + newFlags.length) < MAX_FLAGS_PER_HORSE) {
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

      logger.info(`[flagEvaluationEngine] Assigned ${newFlags.length} new flags to horse ${horseId}: ${newFlags.join(', ')}`);
    }

    return {
      success: true,
      horseId,
      horseName: horse.name,
      ageInYears: ageInYears.toFixed(2),
      currentFlags,
      newFlags,
      totalFlags: currentFlags.length + newFlags.length,
      careAnalysis,
      flagEvaluations,
      evaluationDate,
    };

  } catch (error) {
    logger.error(`[flagEvaluationEngine] Error evaluating flags for horse ${horseId}: ${error.message}`);
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
  const score = conditionCount > 0 ? (metConditions / conditionCount) : 0;

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
      logger.error(`[flagEvaluationEngine] Error in batch evaluation for horse ${horseId}: ${error.message}`);
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
    const minBirthDate = new Date(evaluationDate.getTime() - (FLAG_EVALUATION_AGE_RANGE.MAX * 365.25 * 24 * 60 * 60 * 1000));
    const maxBirthDate = new Date(evaluationDate.getTime() - (FLAG_EVALUATION_AGE_RANGE.MIN * 365.25 * 24 * 60 * 60 * 1000));

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
    const filteredHorses = eligibleHorses.filter(horse =>
      (horse.epigeneticFlags || []).length < MAX_FLAGS_PER_HORSE,
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
