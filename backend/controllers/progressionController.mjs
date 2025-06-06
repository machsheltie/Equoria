/**
 * Progression Controller
 * Handles user progression, leveling, and advancement logic
 */

import { logger } from '../utils/logger.mjs';
import { getUserById, addXpToUser as modelAddXpToUser } from '../models/userModel.mjs';

/**
 * Get user progression data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function getUserProgression(req, res, next) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Calculate progression data
    const currentLevel = user.level;
    const currentXp = user.xp;
    const xpForNextLevel = calculateXpForLevel(currentLevel + 1);
    const xpForCurrentLevel = calculateXpForLevel(currentLevel);
    const xpProgress = currentXp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - currentXp;
    const progressPercentage = Math.round(
      (xpProgress / (xpForNextLevel - xpForCurrentLevel)) * 100,
    );

    const progressionData = {
      currentLevel,
      currentXp,
      xpForNextLevel,
      xpProgress,
      xpNeeded,
      progressPercentage: Math.max(0, Math.min(100, progressPercentage)),
      totalEarnings: user.money || 0,
    };

    logger.info(
      `[progressionController.getUserProgression] Retrieved progression for user ${userId}`,
    );

    res.json({
      success: true,
      message: 'User progression retrieved successfully',
      data: progressionData,
    });
  } catch (error) {
    logger.error(
      `[progressionController.getUserProgression] Error getting progression for user ${req.params.userId}: ${error.message}`,
    );
    next(error);
  }
}

/**
 * Award XP to user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function awardXp(req, res, next) {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid XP amount is required',
      });
    }

    const result = await modelAddXpToUser(userId, amount, reason);

    logger.info(
      `[progressionController.awardXp] Awarded ${amount} XP to user ${userId}: ${reason || 'No reason provided'}`,
    );

    res.json({
      success: true,
      message: `Successfully awarded ${amount} XP`,
      data: result,
    });
  } catch (error) {
    logger.error(
      `[progressionController.awardXp] Error awarding XP to user ${req.params.userId}: ${error.message}`,
    );
    next(error);
  }
}

/**
 * Calculate XP required for a specific level
 * @param {number} level - Target level
 * @returns {number} XP required for that level
 */
function calculateXpForLevel(level) {
  if (level <= 1) {
    return 0;
  }

  // Progressive XP requirement: level^2 * 100
  // Level 2: 400 XP, Level 3: 900 XP, Level 4: 1600 XP, etc.
  return Math.floor(Math.pow(level, 2) * 100);
}

/**
 * Get level from XP amount
 * @param {number} xp - Current XP
 * @returns {number} Current level based on XP
 */
export function getLevelFromXp(xp) {
  if (xp < 400) {
    return 1;
  }

  // Reverse calculation: level = sqrt(xp / 100)
  return Math.floor(Math.sqrt(xp / 100));
}

/**
 * Check if user should level up
 * @param {string} userId - User ID
 * @returns {Object} Level up information
 */
export async function checkLevelUp(userId) {
  try {
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const currentLevel = user.level;
    const calculatedLevel = getLevelFromXp(user.xp);

    if (calculatedLevel > currentLevel) {
      const levelsGained = calculatedLevel - currentLevel;

      logger.info(
        `[progressionController.checkLevelUp] User ${userId} leveled up! ${currentLevel} → ${calculatedLevel}`,
      );

      return {
        leveledUp: true,
        oldLevel: currentLevel,
        newLevel: calculatedLevel,
        levelsGained,
        message: `Congratulations! You reached level ${calculatedLevel}!`,
      };
    }

    return {
      leveledUp: false,
      currentLevel,
      message: 'No level up',
    };
  } catch (error) {
    logger.error(
      `[progressionController.checkLevelUp] Error checking level up for user ${userId}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Add XP to user (direct function for testing)
 * @param {string} userId - User ID
 * @param {number} amount - XP amount to add
 * @returns {Object} Updated user data
 */
export async function addXpToUser(userId, amount) {
  try {
    if (!userId) {
      throw new Error('User ID is required.');
    }

    if (!amount || amount <= 0) {
      throw new Error('XP amount must be a positive number.');
    }

    const result = await modelAddXpToUser(userId, amount);
    return result;
  } catch (error) {
    logger.error(`[progressionController.addXpToUser] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get user progress (direct function for testing)
 * @param {string} userId - User ID
 * @returns {Object} User progress data
 */
export async function getUserProgress(userId) {
  try {
    if (!userId) {
      throw new Error('Progress fetch failed: Lookup failed: User ID is required.');
    }

    const user = await getUserById(userId);

    if (!user) {
      throw new Error('Progress fetch failed: User not found.');
    }

    return {
      valid: true,
      userId: user.id,
      level: user.level,
      xp: user.xp,
      money: user.money || 0,
    };
  } catch (error) {
    logger.error(`[progressionController.getUserProgress] Error: ${error.message}`);
    throw error;
  }
}

export { calculateXpForLevel };
