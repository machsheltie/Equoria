/**
 * @fileoverview Milestone Trait Evaluation System for Horse Development
 *
 * @description
 * Evaluates and assigns permanent traits to horses at milestone ages (1, 2, and 3 years)
 * based on their accumulated task history. Processes task logs to calculate net trait
 * influence scores and applies traits when thresholds are met (+3/-3). Ensures traits
 * applied before age 3 are marked as epigenetic for proper developmental tracking.
 *
 * @features
 * - Milestone evaluation at ages 1, 2, and 3 years only
 * - Net trait influence scoring from complete task history
 * - Trait assignment at +3 threshold, resistance traits at -3 threshold
 * - Epigenetic trait marking for early development (before age 3)
 * - Milestone completion tracking to prevent re-evaluation
 * - Integration with existing task log JSON format
 * - Duplicate trait prevention and conflict resolution
 * - Comprehensive logging for trait assignment tracking
 *
 * @dependencies
 * - taskTraitInfluenceMap: Task-to-trait influence mapping system
 * - traitEvaluation: Trait application and management utilities
 * - logger: Winston logger for milestone evaluation tracking
 * - prisma: Database operations for trait persistence
 *
 * @usage
 * Called during horse aging events at milestone ages or weekly age threshold checks.
 * Standalone utility that can be tested independently before aging system integration.
 * Returns updated horse object with new traits and milestone completion flags.
 *
 * @author Equoria Development Team
 * @since 1.2.0
 * @lastModified 2025-01-02 - Initial milestone trait evaluation implementation
 */

import { TASK_TRAIT_INFLUENCE_MAP } from './taskTraitInfluenceMap.mjs';
import logger from './logger.mjs';

/**
 * Milestone ages for trait evaluation
 */
const MILESTONE_AGES = [1, 2, 3];

/**
 * Trait scoring thresholds
 */
const TRAIT_THRESHOLDS = {
  POSITIVE_THRESHOLD: 3, // Apply trait when score >= 3
  NEGATIVE_THRESHOLD: -3, // Apply resistance trait when score <= -3
};

/**
 * Evaluates trait milestones for a horse based on accumulated task logs
 *
 * @param {Object} horse - Complete horse object with age, task_log, and trait_milestones
 * @returns {Object} Result object with updated traits, milestones, and evaluation summary
 */
export function evaluateTraitMilestones(horse) {
  try {
    logger.info(
      `[milestoneTraitEvaluator.evaluateTraitMilestones] Starting evaluation for horse ${horse.id} at age ${horse.age}`,
    );

    const milestoneAge = Math.floor(horse.age / 365); // Convert days to years

    // Check if this is a milestone age
    if (!MILESTONE_AGES.includes(milestoneAge)) {
      logger.debug(
        `[milestoneTraitEvaluator.evaluateTraitMilestones] Age ${milestoneAge} is not a milestone age, skipping`,
      );
      return {
        success: false,
        reason: 'not_milestone_age',
        milestoneAge,
        traitsApplied: [],
        evaluationPerformed: false,
      };
    }

    // Check if milestone already evaluated
    const milestoneKey = `age_${milestoneAge}`;
    const alreadyEvaluated = horse.trait_milestones?.[milestoneKey];

    if (alreadyEvaluated) {
      logger.info(
        `[milestoneTraitEvaluator.evaluateTraitMilestones] Milestone ${milestoneKey} already evaluated, skipping`,
      );
      return {
        success: false,
        reason: 'already_evaluated',
        milestoneAge,
        traitsApplied: [],
        evaluationPerformed: false,
      };
    }

    // Process task log to calculate trait scores
    const traitScores = calculateTraitScores(horse.task_log || []);

    logger.info(
      `[milestoneTraitEvaluator.evaluateTraitMilestones] Calculated trait scores: ${JSON.stringify(traitScores)}`,
    );

    // Apply traits based on scores
    const traitsApplied = [];
    const isEpigenetic = milestoneAge < 3;

    for (const [traitName, score] of Object.entries(traitScores)) {
      if (score >= TRAIT_THRESHOLDS.POSITIVE_THRESHOLD) {
        // Apply positive trait
        const traitResult = applyTraitToHorse(horse, traitName, {
          epigenetic: isEpigenetic,
          source: 'milestone_evaluation',
          milestoneAge,
          score,
        });

        if (traitResult.applied) {
          traitsApplied.push({
            name: traitName,
            type: 'positive',
            score,
            epigenetic: isEpigenetic,
          });
        }
      } else if (score <= TRAIT_THRESHOLDS.NEGATIVE_THRESHOLD) {
        // Apply resistance trait
        const resistanceTraitName = `resists_${traitName}`;
        const traitResult = applyTraitToHorse(horse, resistanceTraitName, {
          epigenetic: isEpigenetic,
          source: 'milestone_evaluation',
          milestoneAge,
          score,
        });

        if (traitResult.applied) {
          traitsApplied.push({
            name: resistanceTraitName,
            type: 'resistance',
            score,
            epigenetic: isEpigenetic,
          });
        }
      }
    }

    // Mark milestone as completed
    const updatedMilestones = {
      ...horse.trait_milestones,
      [milestoneKey]: true,
    };

    logger.info(
      `[milestoneTraitEvaluator.evaluateTraitMilestones] Completed milestone ${milestoneKey}, applied ${traitsApplied.length} traits`,
    );

    return {
      success: true,
      milestoneAge,
      traitsApplied,
      traitScores,
      updatedMilestones,
      evaluationPerformed: true,
      isEpigenetic,
    };
  } catch (error) {
    logger.error(
      `[milestoneTraitEvaluator.evaluateTraitMilestones] Error evaluating milestones: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Calculate net trait influence scores from task log
 *
 * @param {Array} taskLog - Array of task log entries
 * @returns {Object} Object with trait names as keys and net scores as values
 */
function calculateTraitScores(taskLog) {
  const traitScores = {};

  for (const logEntry of taskLog) {
    const taskType = logEntry.task;
    const influence = TASK_TRAIT_INFLUENCE_MAP[taskType];

    if (!influence) {
      logger.debug(
        `[milestoneTraitEvaluator.calculateTraitScores] No influence found for task: ${taskType}`,
      );
      continue;
    }

    // Add positive influences
    for (const trait of influence.encourages || []) {
      traitScores[trait] = (traitScores[trait] || 0) + 1;
    }

    // Add negative influences
    for (const trait of influence.discourages || []) {
      traitScores[trait] = (traitScores[trait] || 0) - 1;
    }
  }

  return traitScores;
}

/**
 * Check if a trait already exists in horse's epigenetic modifiers
 *
 * @param {string} traitName - Name of trait to check
 * @param {Object} epigeneticModifiers - Horse's current epigenetic modifiers
 * @returns {boolean} Whether trait already exists
 */
function hasExistingTraitInHorse(traitName, epigeneticModifiers) {
  if (!epigeneticModifiers || typeof epigeneticModifiers !== 'object') {
    return false;
  }

  // Check all trait categories
  const allTraits = [
    ...(epigeneticModifiers.positive || []),
    ...(epigeneticModifiers.negative || []),
    ...(epigeneticModifiers.hidden || []),
    ...(epigeneticModifiers.epigenetic || []),
  ];

  return allTraits.some(trait => {
    // Handle both string traits and object traits
    const traitKey = typeof trait === 'string' ? trait : trait.name;
    return traitKey === traitName;
  });
}

/**
 * Apply a trait to a horse with proper validation and duplicate prevention
 *
 * @param {Object} horse - Horse object to modify
 * @param {string} traitName - Name of trait to apply
 * @param {Object} metadata - Trait metadata (epigenetic, source, etc.)
 * @returns {Object} Result object indicating if trait was applied
 */
function applyTraitToHorse(horse, traitName, metadata = {}) {
  try {
    // Check for existing trait to prevent duplicates
    if (hasExistingTraitInHorse(traitName, horse.epigeneticModifiers)) {
      logger.info(
        `[milestoneTraitEvaluator.applyTraitToHorse] Trait ${traitName} already exists, skipping`,
      );
      return { applied: false, reason: 'duplicate_trait' };
    }

    // Create trait object
    const traitObject = {
      name: traitName,
      epigenetic: metadata.epigenetic || false,
      source: metadata.source || 'milestone_evaluation',
      milestoneAge: metadata.milestoneAge,
      score: metadata.score,
      appliedAt: new Date().toISOString(),
    };

    // Apply trait to appropriate category
    const currentModifiers = horse.epigeneticModifiers || {
      positive: [],
      negative: [],
      hidden: [],
      epigenetic: [],
    };

    if (metadata.epigenetic) {
      currentModifiers.epigenetic.push(traitObject);
    } else if (traitName.startsWith('resists_')) {
      currentModifiers.negative.push(traitName);
    } else {
      currentModifiers.positive.push(traitName);
    }

    // Update horse object
    horse.epigeneticModifiers = currentModifiers;

    logger.info(
      `[milestoneTraitEvaluator.applyTraitToHorse] Applied trait ${traitName} (epigenetic: ${metadata.epigenetic})`,
    );

    return { applied: true, trait: traitObject };
  } catch (error) {
    logger.error(
      `[milestoneTraitEvaluator.applyTraitToHorse] Error applying trait ${traitName}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Check if a horse is eligible for milestone evaluation
 *
 * @param {Object} horse - Horse object to check
 * @returns {Object} Eligibility result with details
 */
export function checkMilestoneEligibility(horse) {
  const milestoneAge = Math.floor(horse.age / 365);
  const milestoneKey = `age_${milestoneAge}`;
  const alreadyEvaluated = horse.trait_milestones?.[milestoneKey];

  return {
    eligible: MILESTONE_AGES.includes(milestoneAge) && !alreadyEvaluated,
    milestoneAge,
    isMilestoneAge: MILESTONE_AGES.includes(milestoneAge),
    alreadyEvaluated,
    milestoneKey,
  };
}

/**
 * Get summary of all milestone evaluations for a horse
 *
 * @param {Object} horse - Horse object to analyze
 * @returns {Object} Summary of milestone completion status
 */
export function getMilestoneSummary(horse) {
  const milestones = horse.trait_milestones || {};
  const currentAge = Math.floor(horse.age / 365);

  return {
    currentAge,
    completedMilestones: Object.keys(milestones).filter(key => milestones[key]),
    pendingMilestones: MILESTONE_AGES.filter(
      age => age <= currentAge && !milestones[`age_${age}`],
    ).map(age => `age_${age}`),
    nextMilestone: MILESTONE_AGES.find(age => age > currentAge),
    allMilestonesComplete: MILESTONE_AGES.filter(age => age <= currentAge).every(
      age => milestones[`age_${age}`],
    ),
  };
}

export { MILESTONE_AGES, TRAIT_THRESHOLDS, calculateTraitScores, applyTraitToHorse };
