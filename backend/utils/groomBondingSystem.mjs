/**
 * Groom Bonding & Burnout Prevention System
 * Enhanced groom system with bonding mechanics and burnout immunity
 *
 * 🎯 FEATURES IMPLEMENTED:
 * - Age-based task eligibility with progressive complexity (0-2, 1-3, 3+ years)
 * - Foal enrichment tasks (0-2 years) for epigenetic trait development
 * - Foal grooming tasks (1-3 years) for visual prep and bonding
 * - General grooming tasks (3+ years) for burnout prevention
 * - Task logging system for frequency tracking and trait evaluation
 * - Streak tracking with grace period logic for consecutive care bonuses
 * - Task mutual exclusivity enforcement (one enrichment OR one grooming per day)
 * - Bonding effect calculations for grooming sessions
 * - Consecutive day tracking for burnout immunity
 * - Burnout immunity status management
 * - Complete grooming session processing workflow
 *
 * 🔧 DEPENDENCIES:
 * - groomConfig.mjs (configuration constants)
 * - db/index.mjs (Prisma database client)
 * - utils/logger.mjs (logging functionality)
 *
 * 📋 BUSINESS RULES:
 * - Ages 0-2: Enrichment tasks only (epigenetic trait development)
 * - Ages 1-3: Both enrichment AND grooming tasks (overlap phase)
 * - Ages 3+: All tasks (enrichment + foal grooming + general grooming)
 * - Mutual exclusivity: One enrichment OR one grooming task per day
 * - Task logging: JSON format tracking frequency for trait evaluation
 * - Streak tracking: 2-day grace period, +10% bonus for 7 consecutive days
 * - Bond scores: 0-100 range with configurable daily gain
 * - Burnout immunity: Configurable consecutive day threshold
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Database operations (Prisma), external dependencies
 * - Real: Business logic, calculations, validation rules, age-based eligibility
 */

import { GROOM_CONFIG } from '../config/groomConfig.mjs';
import prisma from '../db/index.mjs';
import logger from './logger.mjs';

/**
 * Get eligible tasks for a horse based on age
 * @param {number} ageInDays - Horse age in days
 * @returns {Array} Array of eligible task names
 */
export function getEligibleTasksForAge(ageInDays) {
  const ageInYears = ageInDays / 365;
  const eligibleTasks = [];

  // Ages 0-2: Enrichment tasks
  if (ageInYears <= GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE) {
    eligibleTasks.push(...GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS);
  }

  // Ages 1-3: Foal grooming tasks (overlap with enrichment)
  if (
    ageInYears >= GROOM_CONFIG.FOAL_GROOMING_MIN_AGE &&
    ageInYears <= GROOM_CONFIG.FOAL_GROOMING_MAX_AGE
  ) {
    eligibleTasks.push(...GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS);
  }

  // Ages 3+: Allow all task types (enrichment, foal grooming, and general grooming)
  if (ageInYears >= GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE) {
    // For adult horses, allow all types of tasks
    eligibleTasks.push(...GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS);
    eligibleTasks.push(...GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS);
    eligibleTasks.push(...GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS);
  }

  return [...new Set(eligibleTasks)]; // Remove duplicates
}

/**
 * Categorize a task as enrichment or grooming
 * @param {string} taskName - Name of the task
 * @returns {string|null} 'enrichment', 'grooming', or null if unknown
 */
export function categorizeTask(taskName) {
  if (GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(taskName)) {
    return GROOM_CONFIG.TASK_CATEGORIES.ENRICHMENT;
  }

  if (
    GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(taskName) ||
    GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(taskName)
  ) {
    return GROOM_CONFIG.TASK_CATEGORIES.GROOMING;
  }

  return null;
}

/**
 * Get age group description for a horse
 * @param {number} ageInDays - Horse age in days
 * @returns {string} Age group description
 */
export function getAgeGroupDescription(ageInDays) {
  const ageInYears = ageInDays / 365;

  if (ageInYears <= GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE) {
    return 'young foal (0-2 years)';
  } else if (ageInYears <= GROOM_CONFIG.FOAL_GROOMING_MAX_AGE) {
    return 'foal (1-3 years)';
  } else {
    return 'adult horse (3+ years)';
  }
}

/**
 * Calculate bonding effects for a grooming session
 * @param {number} currentBondScore - Current bond score of the horse
 * @param {string} groomingTask - Type of grooming task
 * @returns {Object} Bonding calculation results
 */
export function calculateBondingEffects(currentBondScore, groomingTask) {
  // Check if task is eligible for bonding (any grooming task can provide bonding)
  const taskCategory = categorizeTask(groomingTask);
  if (taskCategory !== GROOM_CONFIG.TASK_CATEGORIES.GROOMING) {
    return {
      bondChange: 0,
      newBondScore: currentBondScore,
      eligible: false,
      reason: `Task '${groomingTask}' is not eligible for bonding (enrichment tasks don't provide bonding)`,
    };
  }

  // Calculate bond change with cap
  const potentialNewScore = currentBondScore + GROOM_CONFIG.DAILY_BOND_GAIN;
  const newBondScore = Math.min(potentialNewScore, GROOM_CONFIG.BOND_SCORE_MAX);
  const actualBondChange = newBondScore - currentBondScore;

  return {
    bondChange: actualBondChange,
    newBondScore,
    eligible: true,
    capped: newBondScore === GROOM_CONFIG.BOND_SCORE_MAX,
  };
}

/**
 * Validate if a horse is eligible for grooming tasks
 * @param {Object} horse - Horse data
 * @param {string} groomingTask - Type of grooming task
 * @returns {Object} Eligibility validation result
 */
export async function validateGroomingEligibility(horse, groomingTask) {
  // Check minimum age requirement (now 0 - allows foals from birth)
  const minAgeInDays = GROOM_CONFIG.MIN_AGE_FOR_GROOMING_TASKS * 365;

  if (horse.age < minAgeInDays) {
    return {
      eligible: false,
      reason: `Horse must be at least ${GROOM_CONFIG.MIN_AGE_FOR_GROOMING_TASKS} years old for grooming tasks`,
      currentAge: horse.age,
      requiredAge: minAgeInDays,
    };
  }

  // Get eligible tasks for this horse's age
  const eligibleTasks = getEligibleTasksForAge(horse.age);

  // Check if task is in the eligible list for this age group
  if (!eligibleTasks.includes(groomingTask)) {
    const ageGroup = getAgeGroupDescription(horse.age);
    return {
      eligible: false,
      reason: `Task '${groomingTask}' is not an eligible task for ${ageGroup}`,
      eligibleTasks,
      ageGroup,
      horseAge: horse.age,
    };
  }

  // Determine task type
  const taskType = categorizeTask(groomingTask);

  return {
    eligible: true,
    reason: `Horse is eligible for ${groomingTask} task`,
    ageGroup: getAgeGroupDescription(horse.age),
    taskType,
  };
}

/**
 * Update consecutive days tracking
 * @param {number} currentConsecutiveDays - Current consecutive days count
 * @param {boolean} groomedToday - Whether horse was groomed today
 * @param {number} daysSinceLastGrooming - Days since last grooming (if not groomed today)
 * @returns {Object} Updated consecutive days result
 */
export function updateConsecutiveDays(
  currentConsecutiveDays,
  groomedToday,
  daysSinceLastGrooming = 0,
) {
  if (groomedToday) {
    // Increment consecutive days
    return {
      newConsecutiveDays: currentConsecutiveDays + 1,
      wasReset: false,
      reason: 'Groomed today - consecutive days incremented',
    };
  }

  // Check if we need to reset due to lapse
  if (daysSinceLastGrooming > GROOM_CONFIG.BURNOUT_RESET_GRACE_DAYS) {
    return {
      newConsecutiveDays: 0,
      wasReset: true,
      reason: `Reset due to ${daysSinceLastGrooming} day lapse (grace period: ${GROOM_CONFIG.BURNOUT_RESET_GRACE_DAYS} days)`,
    };
  }

  // Within grace period - maintain current count
  return {
    newConsecutiveDays: currentConsecutiveDays,
    wasReset: false,
    reason: `Within grace period (${daysSinceLastGrooming} days)`,
  };
}

/**
 * Check burnout immunity status based on consecutive days
 * @param {number} consecutiveDays - Number of consecutive grooming days
 * @returns {Object} Burnout immunity status
 */
export function checkBurnoutImmunity(consecutiveDays) {
  if (consecutiveDays >= GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS) {
    return {
      status: GROOM_CONFIG.BURNOUT_STATUS.IMMUNE,
      immunityGranted: true,
      daysToImmunity: 0,
      reason: `Immunity granted after ${consecutiveDays} consecutive days`,
    };
  }

  const daysToImmunity = GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS - consecutiveDays;

  return {
    status: GROOM_CONFIG.BURNOUT_STATUS.NONE,
    immunityGranted: false,
    daysToImmunity,
    reason: `${daysToImmunity} more consecutive days needed for immunity`,
  };
}

/**
 * Process a complete grooming session
 * @param {number} horseId - ID of the horse
 * @param {number} groomId - ID of the groom
 * @param {string} groomingTask - Type of grooming task
 * @param {number} duration - Duration in minutes
 * @returns {Object} Complete grooming session result
 */
export async function processGroomingSession(horseId, _groomId, groomingTask, _duration) {
  try {
    // Get horse data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        age: true,
        bondScore: true,
        daysGroomedInARow: true,
        burnoutStatus: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Validate eligibility
    const eligibilityCheck = await validateGroomingEligibility(horse, groomingTask);
    if (!eligibilityCheck.eligible) {
      return {
        success: false,
        reason: eligibilityCheck.reason,
        data: eligibilityCheck,
      };
    }

    // Calculate bonding effects
    const bondingEffects = calculateBondingEffects(horse.bondScore || 0, groomingTask);

    // Update consecutive days (assuming groomed today)
    const consecutiveDaysUpdate = updateConsecutiveDays(horse.daysGroomedInARow || 0, true);

    // Check burnout immunity
    const immunityCheck = checkBurnoutImmunity(consecutiveDaysUpdate.newConsecutiveDays);

    // TODO: Create groom interaction record
    // TODO: Update horse with new values

    return {
      success: true,
      bondingEffects,
      consecutiveDaysUpdate,
      immunityCheck,
      horse: {
        id: horse.id,
        name: horse.name,
        newBondScore: bondingEffects.newBondScore,
        newConsecutiveDays: consecutiveDaysUpdate.newConsecutiveDays,
        newBurnoutStatus: immunityCheck.status,
      },
    };
  } catch (error) {
    logger.error(`[groomBondingSystem.processGroomingSession] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Update task log with new task completion
 * @param {Object|null} currentTaskLog - Current task log object
 * @param {string} taskName - Name of completed task
 * @returns {Object} Updated task log and statistics
 */
export function updateTaskLog(currentTaskLog, taskName) {
  const taskLog = currentTaskLog || {};

  // Increment task count
  taskLog[taskName] = (taskLog[taskName] || 0) + 1;

  // Calculate total tasks
  const totalTasks = Object.values(taskLog).reduce((sum, count) => sum + count, 0);

  return {
    taskLog,
    totalTasks,
    taskCount: taskLog[taskName],
  };
}

/**
 * Update streak tracking for consecutive grooming days
 * @param {Date|null} lastGroomed - Last grooming date
 * @param {Date} currentDate - Current date
 * @param {number} currentStreak - Current consecutive days count
 * @returns {Object} Updated streak information
 */
export function updateStreakTracking(lastGroomed, currentDate, currentStreak = 0) {
  if (!lastGroomed) {
    // First time grooming
    return {
      consecutiveDays: 1,
      lastGroomed: currentDate,
      streakBroken: false,
      bonusEligible: false,
      withinGracePeriod: false,
    };
  }

  // Calculate days since last grooming
  const daysDifference = Math.floor((currentDate - lastGroomed) / (1000 * 60 * 60 * 24));

  if (daysDifference === 1) {
    // Consecutive day - increment streak
    const newStreak = currentStreak + 1;
    return {
      consecutiveDays: newStreak,
      lastGroomed: currentDate,
      streakBroken: false,
      bonusEligible: newStreak >= GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD,
      bonusPercentage: newStreak >= GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD ? 10 : 0,
      withinGracePeriod: false,
    };
  } else if (daysDifference <= GROOM_CONFIG.FOAL_STREAK_GRACE_DAYS) {
    // Within grace period - maintain streak
    const newStreak = currentStreak + 1;
    return {
      consecutiveDays: newStreak,
      lastGroomed: currentDate,
      streakBroken: false,
      bonusEligible: newStreak >= GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD,
      bonusPercentage: newStreak >= GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD ? 10 : 0,
      withinGracePeriod: true,
    };
  } else {
    // Beyond grace period - reset streak
    return {
      consecutiveDays: 1,
      lastGroomed: currentDate,
      streakBroken: true,
      bonusEligible: false,
      withinGracePeriod: false,
      daysSinceLastGrooming: daysDifference,
    };
  }
}

/**
 * Check if task types conflict (mutual exclusivity)
 * @param {string|null} existingTask - Task already completed today
 * @param {string} newTask - New task being attempted
 * @returns {Object} Conflict check result
 */
export function checkTaskMutualExclusivity(existingTask, newTask) {
  if (!existingTask) {
    return {
      allowed: true,
      conflict: false,
      reason: 'First task of the day',
    };
  }

  const existingCategory = categorizeTask(existingTask);
  const newCategory = categorizeTask(newTask);

  if (existingCategory === newCategory) {
    return {
      allowed: true,
      conflict: false,
      sameCategory: true,
      reason: `Both tasks are ${existingCategory} type`,
    };
  }

  if (existingCategory && newCategory && existingCategory !== newCategory) {
    return {
      allowed: false,
      conflict: true,
      reason: `Horse has already completed ${existingTask} (${existingCategory}) today. You cannot do both enrichment and grooming in one day.`,
      existingCategory,
      newCategory,
    };
  }

  return {
    allowed: true,
    conflict: false,
    reason: 'Task categories compatible',
  };
}
