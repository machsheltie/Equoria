/**
 * Foal Task Log Manager
 * Utility functions for managing foal task logs and streak data
 *
 * 🎯 PURPOSE:
 * Provides functions to manage foal task repetition history and streak tracking
 * for trait evaluation and burnout immunity mechanics.
 *
 * 📋 BUSINESS RULES:
 * - Task log stores task repetition counts as JSON: {"desensitization": 3, "early_touch": 5}
 * - Consecutive days tracking for streak-based bonuses and burnout immunity
 * - Last care date enables grace period calculations (2-day grace period)
 * - Task history supports trait evaluation and epigenetic development
 * - Streak data supports 7-day burnout immunity mechanics
 *
 * 🔧 INTEGRATION:
 * - Works with existing Horse model fields: taskLog, lastGroomed, daysGroomedInARow
 * - Integrates with task influence configuration for trait evaluation
 * - Supports daily task exclusivity enforcement
 * - Compatible with groom bonding system
 *
 * 💡 FUTURE ENHANCEMENT:
 * - When consecutiveDaysFoalCare field is added, these functions can be updated
 * - Currently uses daysGroomedInARow as a proxy for foal care streaks
 */

import { logger } from './logger.mjs';

/**
 * Initialize empty task log for a foal
 * @returns {Object} Empty task log object
 */
export function initializeTaskLog() {
  return {};
}

/**
 * Add or increment a task in the foal's task log
 * @param {Object} currentTaskLog - Current task log object
 * @param {string} taskName - Name of the task to increment
 * @param {number} increment - Amount to increment (default: 1)
 * @returns {Object} Updated task log object
 */
export function incrementTaskCount(currentTaskLog, taskName, increment = 1) {
  try {
    if (taskName === null || taskName === undefined) {
      throw new Error('Task name cannot be null or undefined');
    }

    if (typeof taskName !== 'string') {
      throw new Error('Task name must be a string');
    }

    const taskLog = currentTaskLog || {};
    const currentCount = taskLog[taskName] || 0;

    return {
      ...taskLog,
      [taskName]: currentCount + increment,
    };
  } catch (error) {
    logger.error(`[foalTaskLogManager.incrementTaskCount] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get task count for a specific task
 * @param {Object} taskLog - Task log object
 * @param {string} taskName - Name of the task
 * @returns {number} Count of task completions
 */
export function getTaskCount(taskLog, taskName) {
  if (!taskLog || typeof taskLog !== 'object') {
    return 0;
  }
  return taskLog[taskName] || 0;
}

/**
 * Get total task completions across all tasks
 * @param {Object} taskLog - Task log object
 * @returns {number} Total task completions
 */
export function getTotalTaskCount(taskLog) {
  if (!taskLog || typeof taskLog !== 'object') {
    return 0;
  }

  return Object.values(taskLog).reduce((total, count) => {
    return total + (typeof count === 'number' ? count : 0);
  }, 0);
}

/**
 * Get all tasks that have been completed at least once
 * @param {Object} taskLog - Task log object
 * @returns {string[]} Array of task names that have been completed
 */
export function getCompletedTasks(taskLog) {
  if (!taskLog || typeof taskLog !== 'object') {
    return [];
  }

  return Object.entries(taskLog)
    .filter(([_, count]) => typeof count === 'number' && count > 0)
    .map(([taskName, _]) => taskName);
}

/**
 * Calculate consecutive days of foal care based on last care date
 * @param {Date|null} lastCareDate - Last care date
 * @param {Date} currentDate - Current date (default: now)
 * @param {number} gracePeriodDays - Grace period in days (default: 2)
 * @returns {Object} Streak information
 */
export function calculateStreakFromLastCareDate(
  lastCareDate,
  currentDate = new Date(),
  gracePeriodDays = 2,
) {
  try {
    if (!lastCareDate) {
      return {
        isStreakActive: false,
        daysSinceLastCare: null,
        isWithinGracePeriod: false,
        streakBroken: false,
      };
    }

    const lastCare = new Date(lastCareDate);
    const current = new Date(currentDate);

    // Check for invalid dates
    if (isNaN(lastCare.getTime())) {
      throw new Error('Invalid lastCareDate provided');
    }

    if (isNaN(current.getTime())) {
      throw new Error('Invalid currentDate provided');
    }

    // Calculate days difference
    const timeDiff = current.getTime() - lastCare.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    const isWithinGracePeriod = daysDiff <= gracePeriodDays;
    const streakBroken = daysDiff > gracePeriodDays;

    return {
      isStreakActive: !streakBroken,
      daysSinceLastCare: daysDiff,
      isWithinGracePeriod,
      streakBroken,
    };
  } catch (error) {
    logger.error(`[foalTaskLogManager.calculateStreakFromLastCareDate] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Determine if foal has burnout immunity based on consecutive days
 * @param {number} consecutiveDays - Number of consecutive days of care
 * @param {number} immunityThreshold - Days needed for immunity (default: 7)
 * @returns {boolean} Whether foal has burnout immunity
 */
export function hasBurnoutImmunity(consecutiveDays, immunityThreshold = 7) {
  return typeof consecutiveDays === 'number' && consecutiveDays >= immunityThreshold;
}

/**
 * Update foal care data with new task completion
 * @param {Object} currentData - Current foal data
 * @param {string} taskName - Name of completed task
 * @param {Date} careDate - Date of care (default: now)
 * @returns {Object} Updated foal data
 */
export function updateFoalCareData(currentData, taskName, careDate = new Date()) {
  try {
    const updatedTaskLog = incrementTaskCount(currentData.taskLog, taskName);

    // Calculate streak information
    const streakInfo = calculateStreakFromLastCareDate(currentData.lastGroomed, careDate);

    // Update consecutive days (using daysGroomedInARow as proxy)
    let consecutiveDays = currentData.daysGroomedInARow || 0;

    if (streakInfo.isStreakActive) {
      // Continue or start streak
      if (streakInfo.daysSinceLastCare === 0) {
        // Same day - don't increment (keep current value)
        // consecutiveDays remains unchanged
      } else {
        // Different day within grace period - increment
        consecutiveDays = consecutiveDays + 1;
      }
    } else if (streakInfo.streakBroken) {
      // Reset streak
      consecutiveDays = 1; // Start new streak
    } else {
      // First time care
      consecutiveDays = 1;
    }

    return {
      taskLog: updatedTaskLog,
      lastGroomed: careDate,
      daysGroomedInARow: consecutiveDays,
      // Future: consecutiveDaysFoalCare: consecutiveDays
    };
  } catch (error) {
    logger.error(`[foalTaskLogManager.updateFoalCareData] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Validate task log structure
 * @param {Object} taskLog - Task log to validate
 * @returns {Object} Validation result
 */
export function validateTaskLog(taskLog) {
  const errors = [];

  if (taskLog === null || taskLog === undefined) {
    return { isValid: true, errors: [] }; // Null/undefined is valid
  }

  if (typeof taskLog !== 'object') {
    errors.push('Task log must be an object');
    return { isValid: false, errors };
  }

  // Check each entry
  Object.entries(taskLog).forEach(([taskName, count]) => {
    if (typeof taskName !== 'string' || taskName.length === 0) {
      errors.push(`Invalid task name: ${taskName}`);
    }

    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      errors.push(`Invalid count for task ${taskName}: ${count}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get foal care summary statistics
 * @param {Object} foalData - Foal data with task log and care information
 * @returns {Object} Care summary statistics
 */
export function getFoalCareSummary(foalData) {
  try {
    const taskLog = foalData.taskLog || {};
    const totalTasks = getTotalTaskCount(taskLog);
    const completedTaskTypes = getCompletedTasks(taskLog);
    const consecutiveDays = foalData.daysGroomedInARow || 0;
    const hasImmunity = hasBurnoutImmunity(consecutiveDays);

    const streakInfo = calculateStreakFromLastCareDate(foalData.lastGroomed);

    return {
      totalTaskCompletions: totalTasks,
      uniqueTasksCompleted: completedTaskTypes.length,
      completedTaskTypes,
      consecutiveDaysOfCare: consecutiveDays,
      hasBurnoutImmunity: hasImmunity,
      lastCareDate: foalData.lastGroomed,
      streakStatus: {
        isActive: streakInfo.isStreakActive,
        daysSinceLastCare: streakInfo.daysSinceLastCare,
        isWithinGracePeriod: streakInfo.isWithinGracePeriod,
      },
    };
  } catch (error) {
    logger.error(`[foalTaskLogManager.getFoalCareSummary] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Reset foal care streak (for missed days beyond grace period)
 * @param {Object} currentData - Current foal data
 * @returns {Object} Updated foal data with reset streak
 */
export function resetFoalCareStreak(currentData) {
  return {
    ...currentData,
    daysGroomedInARow: 0,
    // Future: consecutiveDaysFoalCare: 0
  };
}

export default {
  initializeTaskLog,
  incrementTaskCount,
  getTaskCount,
  getTotalTaskCount,
  getCompletedTasks,
  calculateStreakFromLastCareDate,
  hasBurnoutImmunity,
  updateFoalCareData,
  validateTaskLog,
  getFoalCareSummary,
  resetFoalCareStreak,
};
