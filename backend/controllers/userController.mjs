/**
 * 🎯 USER CONTROLLER - Comprehensive User Progress & Dashboard Management
 *
 * This controller handles all user-related API endpoints with focus on progress tracking,
 * level progression, and dashboard functionality integration.
 *
 * 📋 FEATURES PROVIDED:
 * - Complete user progress tracking with XP, levels, and progress percentages
 * - Consistent XP calculation using userModel.getUserProgress() for accuracy
 * - Comprehensive dashboard data including horses, shows, and activity
 * - Proper error handling and validation for all endpoints
 * - Integration with training system and XP progression
 *
 * 🔧 TECHNICAL APPROACH:
 * - Uses userModel.getUserProgress() for consistent XP threshold calculations
 * - Calculates progress percentage within current level (0-100%)
 * - Provides detailed progress data for frontend progress bars and UI
 * - Integrates with authentication middleware for secure access
 * - Follows RESTful API patterns with proper HTTP status codes
 *
 * 🎮 BUSINESS LOGIC:
 * - Level progression: 100 XP per level (Level 1: 0 XP, Level 2: 100 XP, etc.)
 * - Progress percentage: (current level progress / XP needed for next level) * 100
 * - Dashboard aggregates: horse counts, training status, show participation
 * - Activity tracking: last training, last competition placement
 *
 * ✅ QUALITY STANDARDS:
 * - Comprehensive error handling with proper HTTP status codes
 * - Detailed logging for debugging and monitoring
 * - Input validation and sanitization
 * - Consistent response format across all endpoints
 */

import { getTrainableHorses } from '../controllers/trainingController.mjs';
import {
  getUserProgress,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  addXpToUser,
} from '../models/userModel.mjs';
import { getCachedQuery, invalidateCache } from '../utils/cacheHelper.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import AppError from '../errors/AppError.mjs';

/**
 * Get comprehensive user progress information
 * Returns detailed progress data including level, XP, progress percentage, and thresholds
 *
 * @route GET /user/:id/progress
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getUserProgressAPI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = id; // UUID string, no parsing needed

    if (!userId) {
      logger.warn(`[userController.getUserProgressAPI] Missing user ID: ${id}`);
      return next(new AppError('User ID is required', 400));
    }

    const cacheKey = `user:progress:${userId}`;
    const data = await getCachedQuery(
      cacheKey,
      async () => {
        logger.info(
          `[userController.getUserProgressAPI] Cache MISS - Getting comprehensive progress for user ${userId}`,
        );

        // Use userModel.getUserProgress for consistent XP calculations
        const progressData = await getUserProgress(userId);

        // Get additional user data for complete response
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, money: true },
        });

        if (!user) {
          return null;
        }

        // Calculate progress percentage within current level
        const xpForCurrentLevel = progressData.level === 1 ? 0 : progressData.level * 100;
        const xpProgressInLevel = progressData.xp - xpForCurrentLevel;
        const xpNeededForLevel = progressData.level === 1 ? 200 : 100;
        const progressPercentage = Math.round((xpProgressInLevel / xpNeededForLevel) * 100);

        // Prepare comprehensive response data
        return {
          userId: user.id,
          username: user.username,
          level: progressData.level,
          xp: progressData.xp,
          xpToNextLevel: progressData.xpToNextLevel,
          xpForNextLevel: progressData.xpForNextLevel,
          xpForCurrentLevel,
          progressPercentage: Math.max(0, Math.min(100, progressPercentage)),
          totalEarnings: user.money,
        };
      },
      60,
    );

    if (!data) {
      logger.warn(`[userController.getUserProgressAPI] User ${userId} not found`);
      return next(new AppError('User not found', 404));
    }

    res.json({
      success: true,
      message: 'User progress retrieved successfully',
      data,
    });
  } catch (error) {
    logger.error(
      `[userController.getUserProgressAPI] Error getting user progress: ${error.message}`,
    );
    next(error); // Pass to global error handler
  }
};

/**
 * Get dashboard data for a user
 * Returns user info, horse counts, upcoming shows, and recent activity
 *
 * @route GET /dashboard/:userId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getDashboardData = async (req, res, next) => {
  const { userId } = req.params; // UUID string, no parsing needed

  if (!userId) {
    logger.warn(`[userController.getDashboardData] Missing user ID: ${userId}`);
    return next(new AppError('User ID is required', 400));
  }

  const cacheKey = `user:dashboard:${userId}`;

  try {
    const data = await getCachedQuery(
      cacheKey,
      async () => {
        logger.info(
          `[userController.getDashboardData] Cache MISS - Getting dashboard for user ${userId}`,
        );

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, level: true, xp: true, money: true },
        });

        if (!user) {
          return null;
        }

        // Get horse counts
        const totalHorses = await prisma.horse.count({
          where: { userId },
        });

        // Get trainable horses count
        let trainableHorsesCount = 0;
        try {
          const trainableHorsesResult = await getTrainableHorses(userId);
          trainableHorsesCount = Array.isArray(trainableHorsesResult)
            ? trainableHorsesResult.length
            : 0;
        } catch (error) {
          logger.error(
            `[userController.getDashboardData] Error getting trainable horses for user ${userId}: ${error.message}`,
            { error },
          );
        }

        // Get upcoming shows that user's horses could enter
        const upcomingShows = await prisma.show.findMany({
          where: {
            runDate: {
              gt: new Date(),
            },
          },
          orderBy: {
            runDate: 'asc',
          },
          take: 5,
        });

        // Count upcoming entries (shows user's horses are entered in)
        const upcomingEntries = await prisma.competitionResult.count({
          where: {
            horse: {
              userId,
            },
            runDate: {
              gt: new Date(),
            },
          },
        });

        const nextShowRuns = upcomingShows.slice(0, 2).map(show => show.runDate);

        let lastTrained = 'never';
        try {
          const recentTraining = await prisma.trainingLog.findFirst({
            where: {
              horse: {
                userId,
              },
            },
            orderBy: {
              trainedAt: 'desc',
            },
          });
          lastTrained = recentTraining?.trainedAt
            ? recentTraining.trainedAt.toISOString()
            : 'never';
        } catch (error) {
          logger.warn(
            `[userController.getDashboardData] Error getting recent training for user ${userId}: ${error.message}`,
          );
        }

        let lastShowPlaced = 'never';
        try {
          const recentPlacement = await prisma.competitionResult.findFirst({
            where: {
              horse: {
                userId,
              },
              placement: {
                in: ['1st', '2nd', '3rd'],
              },
            },
            include: {
              horse: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              runDate: 'desc',
            },
          });

          if (recentPlacement) {
            lastShowPlaced = {
              horseName: recentPlacement.horse.name,
              placement: recentPlacement.placement,
              show: recentPlacement.showName,
            };
          }
        } catch (error) {
          logger.warn(
            `[userController.getDashboardData] Error getting recent placement for user ${userId}: ${error.message}`,
          );
        }

        return {
          user: {
            id: user.id,
            username: user.username,
            level: user.level,
            xp: user.xp,
            money: user.money,
          },
          horses: {
            total: totalHorses,
            trainable: trainableHorsesCount,
          },
          shows: {
            upcomingEntries,
            nextShowRuns,
          },
          activity: {
            lastTrained: lastTrained || 'never',
            lastShowPlaced: lastShowPlaced || 'never',
          },
        };
      },
      60,
    );

    if (!data) {
      logger.warn(`[userController.getDashboardData] User ${userId} not found`);
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data,
    });
  } catch (error) {
    logger.error(
      `[userController.getDashboardData] Error getting dashboard data for user ${userId}: ${error.message}`,
      { stack: error.stack },
    );
    next(error);
  }
};

/**
 * Get unified activity feed for a user
 * Combines XP events and other activities
 *
 * @route GET /api/users/:id/activity
 */
export const getUserActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = id;

    if (!userId) {
      return next(new AppError('User ID is required', 400));
    }

    // Fetch recent XP events as activities
    const xpEvents = await prisma.xpEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    // Map to activity format expected by frontend
    const activities = xpEvents.map(event => ({
      id: event.id,
      userId: event.userId,
      type: 'XP_GAIN',
      description: event.reason,
      timestamp: event.timestamp,
      metadata: { amount: event.amount },
    }));

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error(`[userController.getUserActivity] Error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user by ID
 * @route GET /api/user/:id
 */
export const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`[userController.getUser] Getting user ${id}`);

    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get horse count for stable limit check
    const totalHorses = await prisma.horse.count({
      where: { userId: id },
    });

    const userData = {
      ...user,
      currentHorses: totalHorses,
      stableLimit: 10 + user.level * 2, // Example formula for stable limit
    };

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: userData,
    });
  } catch (error) {
    logger.error(`[userController.getUser] Error: ${error.message}`);
    next(error);
  }
};

/**
 * Create new user
 * @route POST /api/user
 */
export const createUserController = async (req, res, next) => {
  try {
    const userData = req.body;

    logger.info(`[userController.createUser] Creating user ${userData.username}`);

    const user = await createUser(userData);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  } catch (error) {
    logger.error(`[userController.createUser] Error: ${error.message}`);
    if (error.message.includes('required') || error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Update user
 * @route PUT /api/user/:id
 */
export const updateUserController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    logger.info(`[userController.updateUser] Updating user ${id}`);

    const user = await updateUser(id, updates);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Invalidate user caches
    await invalidateCache(`user:progress:${id}`);
    await invalidateCache(`user:dashboard:${id}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    logger.error(`[userController.updateUser] Error: ${error.message}`);
    next(error);
  }
};

/**
 * Delete user
 * @route DELETE /api/user/:id
 */
export const deleteUserController = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`[userController.deleteUser] Deleting user ${id}`);

    const result = await deleteUser(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Invalidate user caches
    await invalidateCache(`user:progress:${id}`);
    await invalidateCache(`user:dashboard:${id}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error(`[userController.deleteUser] Error: ${error.message}`);
    next(error);
  }
};

/**
 * Add XP to user
 * @route POST /api/user/:id/add-xp
 */
export const addXpController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    logger.info(`[userController.addXp] Adding ${amount} XP to user ${id}`);

    const user = await addXpToUser(id, amount);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Invalidate user caches
    await invalidateCache(`user:progress:${id}`);
    await invalidateCache(`user:dashboard:${id}`);

    res.status(200).json({
      success: true,
      message: 'XP added successfully',
      data: user,
    });
  } catch (error) {
    logger.error(`[userController.addXp] Error: ${error.message}`);
    next(error);
  }
};
