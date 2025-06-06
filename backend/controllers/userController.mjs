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
import { getUserProgress } from '../models/userModel.mjs';
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

    logger.info(
      `[userController.getUserProgressAPI] Getting comprehensive progress for user ${userId}`,
    );

    // Use userModel.getUserProgress for consistent XP calculations
    const progressData = await getUserProgress(userId);

    // Get additional user data for complete response
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, money: true },
    });

    if (!user) {
      logger.warn(`[userController.getUserProgressAPI] User ${userId} not found`);
      return next(new AppError('User not found', 404));
    }

    // Calculate progress percentage within current level
    // Level thresholds: Level 1=0, Level 2=200, Level 3=300, Level 4=400, Level 5=500
    // Level 1: 0-199 XP (200 XP range), Level 2+: 100 XP ranges each
    const xpForCurrentLevel = progressData.level === 1 ? 0 : progressData.level * 100;
    const xpProgressInLevel = progressData.xp - xpForCurrentLevel;
    const xpNeededForLevel = progressData.level === 1 ? 200 : 100; // Level 1: 200 XP, others: 100 XP
    const progressPercentage = Math.round((xpProgressInLevel / xpNeededForLevel) * 100);

    // Prepare comprehensive response data
    const completeProgressData = {
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

    logger.info(
      `[userController.getUserProgressAPI] Successfully retrieved progress for user ${user.username} (Level ${progressData.level}, XP: ${progressData.xp}/${progressData.xpForNextLevel}, ${progressPercentage}% progress)`,
    );

    res.json({
      success: true,
      message: 'User progress retrieved successfully',
      data: completeProgressData,
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

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, level: true, xp: true, money: true },
    });

    if (!user) {
      logger.warn(`[userController.getDashboardData] User ${userId} not found`);
      return next(new AppError('User not found', 404));
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
      // Not critical, proceed with 0, but log error.
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

    let lastTrained = null;
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
      lastTrained = recentTraining?.trainedAt || null;
    } catch (error) {
      logger.warn(
        `[userController.getDashboardData] Error getting recent training for user ${userId}: ${error.message}`,
      );
    }

    let lastShowPlaced = null;
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

    const dashboardData = {
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
        lastTrained,
        lastShowPlaced,
      },
    };

    logger.info(
      `[userController.getDashboardData] Successfully retrieved dashboard data for user ${user.name} (${totalHorses} horses, ${trainableHorsesCount} trainable)`,
    );

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboardData,
    });
  } catch (error) {
    logger.error(
      `[userController.getDashboardData] Error getting dashboard data for user ${userId}: ${error.message}`,
      { stack: error.stack },
    );
    next(error);
  }
};
