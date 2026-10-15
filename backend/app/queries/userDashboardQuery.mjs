/**
 * User dashboard read (application query layer, Equoria-q4uem.4 / WS4 S3).
 *
 * Composes the user row with horse counts, trainable horses (Training), shows, results and training
 * logs, so it lives above the domain modules: Users must not import Training. Moved verbatim from
 * backend/modules/users/controllers/userController.mjs; behaviour, responses, status codes and the
 * `user:dashboard:<id>` cache key (still invalidated by updateUserController) are unchanged.
 */
import { getTrainableHorses } from '../../modules/training/index.mjs';
import { getCachedQuery } from '../../utils/cacheHelper.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';
import AppError from '../../errors/AppError.mjs';

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
