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

import { getTrainableHorses } from '../../../controllers/trainingController.mjs';
import {
  getUserProgress,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  addXpToUser,
} from '../../../models/userModel.mjs';
import { getCachedQuery, invalidateCache } from '../../../utils/cacheHelper.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import AppError from '../../../errors/AppError.mjs';
import { validateSettingsPayload } from '../services/settingsValidation.mjs';

// Safe field selection for user search results — id and username (social handle) only.
// firstName/lastName are real-name PII; they must NOT be returned from a search endpoint
// that any authenticated user can query (CWE-200/CWE-359, Equoria-o7c0x L3).
const USER_SEARCH_SELECT = { id: true, username: true };

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
 * Get global community activity feed
 * Aggregates public events from across the game
 *
 * @route GET /api/users/community/activity
 */
export const getCommunityActivity = async (req, res, next) => {
  try {
    // 1. Get latest forum threads
    const threads = await prisma.forumThread.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { author: { select: { username: true } } },
    });

    // 2. Get latest clubs
    const clubs = await prisma.club.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 3. Get latest top competition wins (1st place)
    const wins = await prisma.competitionResult.findMany({
      where: { placement: { in: ['1', '1st'] } },
      orderBy: { runDate: 'desc' },
      take: 5,
      include: { horse: { select: { name: true, user: { select: { username: true } } } } },
    });

    // Map all to common activity format
    const activities = [
      ...threads.map(t => ({
        id: `thread-${t.id}`,
        type: 'FORUM_POST',
        description: `${t.author.username} started a new thread: "${t.title}"`,
        timestamp: t.createdAt,
        metadata: { threadId: t.id, section: t.section },
      })),
      ...clubs.map(c => ({
        id: `club-${c.id}`,
        type: 'CLUB_CREATED',
        description: `New club formed: ${c.name}`,
        timestamp: c.createdAt,
        metadata: { clubId: c.id, type: c.type },
      })),
      ...wins.map(w => ({
        id: `win-${w.id}`,
        type: 'COMPETITION_WIN',
        description: `${w.horse.user?.username || 'Someone'}'s horse ${w.horse.name} won the ${w.showName}!`,
        timestamp: w.runDate,
        metadata: { horseId: w.horseId, score: w.score },
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: activities.slice(0, 20),
    });
  } catch (error) {
    logger.error(`[userController.getCommunityActivity] Error: ${error.message}`);
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
 * Fields a user is permitted to update on their own profile via
 * PUT /api/v1/users/:id.
 *
 * SECURITY (Equoria-qia4j, CWE-915 / CWE-269): This allowlist is the ONLY
 * fields that may pass through to Prisma. Everything else in req.body is
 * silently dropped at this boundary. Do NOT add privileged fields here
 * (role, money, level, xp, password, mfa*, emailVerified*, etc.) — those
 * each have dedicated, properly-gated endpoints.
 */
const USER_UPDATE_ALLOWLIST = ['username', 'email', 'firstName', 'lastName', 'settings'];

/**
 * Fields that are sensitive/privileged enough that their presence in a
 * self-update request body should be logged as a security warning.
 * (Still stripped — this list triggers the warning only.)
 */
const SENSITIVE_BLOCKED_FIELDS = new Set([
  'role',
  'money',
  'level',
  'xp',
  'password',
  'mfaSecret',
  'mfaEnabled',
  'mfaRecoveryCodes',
  'emailVerified',
  'emailVerifiedAt',
  'passwordChangedAt',
]);

/**
 * Update user
 * @route PUT /api/v1/users/:id
 *
 * SECURITY (Equoria-qia4j): Applies a strict server-side allowlist before
 * passing data to the model. Only USER_UPDATE_ALLOWLIST fields may be set
 * via this endpoint. If `email` changes, emailVerified/emailVerifiedAt are
 * also reset inside the same update (prevents pre-verified-email pivot
 * attacks). Any sensitive/privileged field in the request body triggers a
 * security warning log but the request is still processed (strip-and-proceed
 * for forward-compatibility).
 */
export const updateUserController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};

    // ── Step 1: Detect any attempt to set protected/privileged fields ───────
    const presentSensitiveFields = Object.keys(rawBody).filter(k =>
      SENSITIVE_BLOCKED_FIELDS.has(k),
    );
    if (presentSensitiveFields.length > 0) {
      logger.warn(
        `[userController.updateUser] SECURITY: user ${id} attempted to set protected field(s) via self-update: [${presentSensitiveFields.join(', ')}] — stripped before DB write`,
      );
    }

    // ── Step 2: Build the allowlisted update object ──────────────────────────
    const updates = {};
    for (const key of USER_UPDATE_ALLOWLIST) {
      if (Object.prototype.hasOwnProperty.call(rawBody, key)) {
        updates[key] = rawBody[key];
      }
    }

    // ── Step 2b: Shape-validate `settings` contents (Equoria-bddjw) ──────────
    // The top-level `settings` key is allow-listed, but its CONTENTS were
    // previously written verbatim — letting a client inject arbitrary nested
    // keys / oversized blobs and clobber server-owned state (economy,
    // onboarding, milestones, inventory). Constrain the client-writable
    // surface to the SAME known-key allowlist the sibling /auth/profile +
    // /auth/profile/preferences paths enforce (shared ALLOWED_PREFERENCE_KEYS),
    // then MERGE into the stored settings so server-owned keys are preserved.
    if (updates.settings !== undefined) {
      const validatedSettings = validateSettingsPayload(updates.settings);
      const currentUser = await prisma.user.findUnique({
        where: { id },
        select: { settings: true },
      });
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      const currentSettings =
        typeof currentUser.settings === 'object' && currentUser.settings !== null
          ? currentUser.settings
          : {};
      // Shallow-merge each validated top-level key into existing settings so
      // server-owned keys (onboarding/milestones/inventory/economy) survive.
      const mergedSettings = { ...currentSettings };
      for (const [key, value] of Object.entries(validatedSettings)) {
        mergedSettings[key] = {
          ...(typeof currentSettings[key] === 'object' && currentSettings[key] !== null
            ? currentSettings[key]
            : {}),
          ...value,
        };
      }
      updates.settings = mergedSettings;
    }

    // ── Step 3: If email is changing, reset verification flags in same write ─
    if (updates.email !== undefined) {
      // Compare against the current stored email so we only reset when the
      // value is actually different (avoids resetting on a no-op PUT).
      const currentUser = await prisma.user.findUnique({
        where: { id },
        select: { email: true },
      });
      if (currentUser && updates.email !== currentUser.email) {
        updates.emailVerified = false;
        updates.emailVerifiedAt = null;
      }
    }

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
 * GET /api/users/:userId/competition-stats
 *
 * Aggregates competition results across all horses owned by :userId and
 * returns a `UserCompetitionStats` shape (see
 * frontend/src/lib/api/competitionResults.ts) for the /my-stable page.
 *
 * Story 21S-4: closes the missing backend endpoint that the
 * `useUserCompetitionStats` frontend hook has been 404-ing against.
 */
export const getUserCompetitionStats = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Pull all competition results for horses owned by this user
    const results = await prisma.competitionResult.findMany({
      where: { horse: { userId } },
      select: {
        id: true,
        score: true,
        placement: true,
        discipline: true,
        runDate: true,
        showName: true,
        prizeWon: true,
        showId: true,
        horse: { select: { id: true, name: true } },
        show: {
          select: {
            id: true,
            name: true,
            _count: { select: { competitionResults: true } },
          },
        },
      },
      orderBy: { runDate: 'desc' },
    });

    const totalCompetitions = results.length;

    if (totalCompetitions === 0) {
      return res.json({
        userId,
        totalCompetitions: 0,
        totalWins: 0,
        totalTop3: 0,
        winRate: 0,
        totalPrizeMoney: 0,
        // totalXpGained: omitted — not stored in CompetitionResult (Equoria-aenc)
        bestPlacement: 0,
        mostSuccessfulDiscipline: '',
        recentCompetitions: [],
      });
    }

    let totalWins = 0;
    let totalTop3 = 0;
    let totalPrizeMoney = 0;
    let bestPlacement = Number.POSITIVE_INFINITY;
    const disciplineCounts = {};

    for (const r of results) {
      const placementNum = placementToNumber(r.placement);
      if (placementNum === 1) {
        totalWins += 1;
      }
      if (placementNum > 0 && placementNum <= 3) {
        totalTop3 += 1;
      }
      if (placementNum > 0 && placementNum < bestPlacement) {
        bestPlacement = placementNum;
      }
      totalPrizeMoney += Number(r.prizeWon ?? 0);
      disciplineCounts[r.discipline] = (disciplineCounts[r.discipline] ?? 0) + 1;
    }

    if (bestPlacement === Number.POSITIVE_INFINITY) {
      bestPlacement = 0;
    }

    const mostSuccessfulDiscipline =
      Object.keys(disciplineCounts).length > 0
        ? Object.entries(disciplineCounts).sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
          )[0][0]
        : '';

    const winRate = totalCompetitions > 0 ? (totalWins / totalCompetitions) * 100 : 0;

    const recentCompetitions = results.slice(0, 5).map(r => ({
      competitionId: r.showId,
      competitionName: r.show?.name ?? r.showName,
      discipline: r.discipline,
      date: r.runDate,
      placement: placementToNumber(r.placement),
      // Derive participant count from results recorded for this show (actual field size).
      totalParticipants: r.show?._count?.competitionResults ?? 0,
      finalScore: Number(r.score),
      prizeMoney: Number(r.prizeWon ?? 0),
      // xpGained: omitted — not stored in CompetitionResult and cannot be reliably
      // derived without a schema change (Equoria-aenc). Remove the misleading zero.
    }));

    return res.json({
      userId,
      totalCompetitions,
      totalWins,
      totalTop3,
      winRate: Math.round(winRate * 100) / 100,
      totalPrizeMoney,
      // totalXpGained: omitted — not stored in CompetitionResult (Equoria-aenc).
      // Remove the misleading zero rather than report false data.
      bestPlacement,
      mostSuccessfulDiscipline,
      recentCompetitions,
    });
  } catch (error) {
    logger.error(`[userController.getUserCompetitionStats] Error: ${error.message}`);
    return next(error);
  }
};

/**
 * Parse a placement string like "1st", "3rd", "5th", or "4" into its
 * numeric rank. Returns 0 when no numeric prefix is found.
 */
function placementToNumber(placement) {
  if (placement === null || placement === undefined) {
    return 0;
  }
  if (typeof placement === 'number') {
    return placement;
  }
  const str = String(placement).trim();
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

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

/**
 * Search users by username prefix (case-insensitive).
 * Accepts optional pagination params for route handlers to control result size.
 *
 * @param {string} q - Search query (username prefix)
 * @param {Object} options - Pagination options
 * @param {number} options.limit - Max results to return (default 10, max 50)
 * @param {number} options.skip - Number of results to skip (default 0)
 * @returns {Promise<{users: Array, total: number}>} Matching users with total count
 */
export async function searchUsers(q, { limit = 10, skip = 0 } = {}) {
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const safeSkip = Math.max(0, skip);

  // Use startsWith (prefix) rather than contains (substring) to limit harvest
  // potential — a substring match over all usernames with a 2-char query would
  // allow an authenticated user to enumerate the full user table.
  // (CWE-200/CWE-359, Equoria-o7c0x L3)
  const where = { username: { startsWith: q, mode: 'insensitive' } };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: safeLimit,
      skip: safeSkip,
      select: USER_SEARCH_SELECT,
      orderBy: { username: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

/**
 * GET /api/v1/users/me/game-notifications
 *
 * Returns the authenticated user's game notification array from the
 * Notification table plus an unreadCount.
 */
export async function getGameNotifications(req, res) {
  try {
    const userId = req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    logger.error(`[userController.getGameNotifications] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch game notifications' });
  }
}

/**
 * PATCH /api/v1/users/me/game-notifications/read-all
 *
 * Marks every unread Notification row for the user as read.
 */
export async function markGameNotificationsRead(req, res) {
  try {
    const userId = req.user.id;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[userController.markGameNotificationsRead] ${error.message}`);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to mark game notifications as read' });
  }
}
