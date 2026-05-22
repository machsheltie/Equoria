/**
 * Progression Controller
 * Handles user progression, leveling, and advancement logic
 */

import logger from '../../../utils/logger.mjs';
import { getUserById, addXpToUser as modelAddXpToUser } from '../../../models/userModel.mjs';

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

// Canonical user-leveling curve (Equoria-8bvwo): LINEAR cumulative.
// This is the SINGLE source of truth shared with backend/models/userModel.mjs
// (`xpThreshold(level) = 100 * level`, applied via a cumulative `while` loop
// over the user's never-reset `xp`). It is also what the live
// `/api/users/:id/progress` endpoint serves (userController.getUserProgressAPI
// uses `level * 100`) and what `userProgressAPI.integration.test.mjs` asserts.
//
// The former QUADRATIC curve here (calculateXpForLevel = level^2*100;
// getLevelFromXp = floor(sqrt(xp/100))) reported a DIFFERENT level than
// userModel for the same XP (e.g. xp=10000 → controller said 10, model said
// 100). That controller curve was orphaned — none of these exports are wired
// to any production route — so it was reconciled to the linear curve rather
// than the reverse.
const DEFAULT_XP_PER_LEVEL = 100;

/**
 * Calculate the cumulative XP entry threshold for a specific level.
 * Mirrors userModel.xpThreshold: a user is level N once their cumulative XP
 * reaches 100 * N. Level 1 is the starting level (0 XP).
 * @param {number} level - Target level
 * @returns {number} Cumulative XP required to BE that level
 */
function calculateXpForLevel(level) {
  if (level <= 1) {
    return 0;
  }

  // Linear cumulative: Level 2 → 200, Level 3 → 300, Level 10 → 1000.
  return DEFAULT_XP_PER_LEVEL * level;
}

/**
 * Get level from cumulative XP amount.
 * Re-implements the userModel.addXpToUser cumulative threshold loop so the
 * controller and the model never disagree on the level for a given XP.
 * @param {number} xp - Current cumulative XP
 * @returns {number} Current level based on XP
 */
export function getLevelFromXp(xp) {
  let level = 1;
  while (xp >= calculateXpForLevel(level + 1)) {
    level++;
  }
  return level;
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
