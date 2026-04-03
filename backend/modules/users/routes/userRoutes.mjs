/**
 * User Routes
 * API endpoints for user-related operations
 */

import express from 'express';
import { param, body, validationResult } from 'express-validator';
import {
  getUserProgressAPI,
  getUserActivity,
  getDashboardData,
  getUser,
  createUserController,
  updateUserController,
  deleteUserController,
  addXpController,
  searchUsers,
} from '../controllers/userController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware for user ID parameter
 */
const validateUserId = [
  param('id') // For /:id/progress route
    .isUUID()
    .withMessage('User ID must be a valid UUID')
    .notEmpty()
    .withMessage('User ID is required'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`[userRoutes] Validation errors for /:id: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateDashboardUserId = [
  param('userId') // For /dashboard/:userId route
    .isUUID()
    .withMessage('User ID must be a valid UUID')
    .notEmpty()
    .withMessage('User ID is required'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[userRoutes] Validation errors for /dashboard/:userId: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * Self-access validation middleware
 * Ensures users can only access their own data (prevents CWE-639)
 */
const requireSelfAccess = (idParam = 'id') => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      logger.warn('[userRoutes] Missing authenticated user for self-access check');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Extract target user ID from params
    const targetUserId = req.params[idParam];
    if (!targetUserId) {
      logger.warn(`[userRoutes] Missing ${idParam} parameter for self-access check`);
      return res.status(400).json({
        success: false,
        message: 'User ID required',
      });
    }

    // Validate self-access: authenticated user can only access their own data
    if (req.user.id !== targetUserId) {
      logger.warn(
        `[userRoutes] Self-access violation: user ${req.user.id} attempted to access user ${targetUserId}`,
      );
      return res.status(403).json({
        success: false,
        message: 'You can only access your own user data',
      });
    }

    logger.info(`[userRoutes] Self-access validated: user ${req.user.id} accessing own data`);
    next();
  };
};

/** GET /api/users/search?username= — find users by username prefix (max 10) */
router.get('/search', queryRateLimiter, authenticateToken, async (req, res) => {
  const q = (req.query.username ?? '').trim();
  if (!q || q.length < 2) {
    return res
      .status(400)
      .json({ success: false, message: 'username query must be at least 2 chars' });
  }
  try {
    const users = await searchUsers(q);
    return res.json({ success: true, data: { users } });
  } catch {
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
});

/**
 * @swagger
 * /api/user/{id}/progress:
 *   get:
 *     summary: Get user progress information
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User progress retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User progress retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Alex"
 *                     level:
 *                       type: integer
 *                       example: 4
 *                     xp:
 *                       type: integer
 *                       example: 230
 *                     xpToNextLevel:
 *                       type: integer
 *                       example: 70
 *       400:
 *         description: Validation error or Invalid User ID format
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/progress',
  queryRateLimiter,
  authenticateToken,
  validateUserId,
  requireSelfAccess(),
  getUserProgressAPI,
);
router.get(
  '/:id/activity',
  queryRateLimiter,
  authenticateToken,
  validateUserId,
  requireSelfAccess(),
  getUserActivity,
);

/**
 * @swagger
 * /api/user/dashboard/{userId}:
 *   get:
 *     summary: Get user dashboard data
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dashboard data retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "User Name"
 *                         level:
 *                           type: integer
 *                           example: 5
 *                         xp:
 *                           type: integer
 *                           example: 550
 *                         money:
 *                           type: integer
 *                           example: 10000
 *                     horses:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         trainable:
 *                           type: integer
 *                           example: 3
 *                     shows:
 *                       type: object
 *                       properties:
 *                         upcomingEntries:
 *                           type: integer
 *                           example: 2
 *                         nextShowRuns:
 *                           type: array
 *                           items:
 *                             type: string
 *                             format: date-time
 *                           example: ["2024-08-01T10:00:00Z", "2024-08-05T14:00:00Z"]
 *                     activity:
 *                       type: object
 *                       properties:
 *                         lastTrained:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           example: "2024-07-20T15:30:00Z"
 *                         lastShowPlaced:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             horseName:
 *                               type: string
 *                               example: "Champion Stallion"
 *                             placement:
 *                               type: string
 *                               example: "1st"
 *                             show:
 *                               type: string
 *                               example: "Grand Prix"
 *       400:
 *         description: Validation error or Invalid User ID format
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/dashboard/:userId',
  queryRateLimiter,
  authenticateToken,
  validateDashboardUserId,
  requireSelfAccess('userId'),
  getDashboardData,
);

// CRUD routes for user management
router.get(
  '/:id',
  queryRateLimiter,
  authenticateToken,
  validateUserId,
  requireSelfAccess(),
  getUser,
);
router.post(
  '/',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }
      next();
    },
  ],
  createUserController,
);

router.put(
  '/:id',
  mutationRateLimiter,
  authenticateToken,
  validateUserId,
  requireSelfAccess(),
  updateUserController,
);
router.delete(
  '/:id',
  mutationRateLimiter,
  authenticateToken,
  validateUserId,
  requireSelfAccess(),
  deleteUserController,
);

/**
 * GET /api/users/:userId/prize-history
 * Retrieve paginated competition prize history for a user.
 * Returns competition results where a horse owned by the user placed.
 *
 * Query params: limit (default 20, max 100), offset (default 0)
 * Security: User can only access their own prize history.
 */
router.get(
  '/:userId/prize-history',
  queryRateLimiter,
  [
    param('userId')
      .isUUID()
      .withMessage('User ID must be a valid UUID')
      .notEmpty()
      .withMessage('User ID is required'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[userRoutes] Validation errors for /:userId/prize-history: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }
      next();
    },
  ],
  authenticateToken,
  requireSelfAccess('userId'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);

      // Dynamically import prisma to keep consistent with the rest of the module
      const { default: prisma } = await import('../../../db/index.mjs');

      // Count total for pagination
      const total = await prisma.competitionResult.count({
        where: {
          horse: { userId },
        },
      });

      const results = await prisma.competitionResult.findMany({
        where: {
          horse: { userId },
        },
        orderBy: { runDate: 'desc' },
        take: limit,
        skip: offset,
        include: {
          horse: {
            select: { id: true, name: true },
          },
        },
      });

      const formatted = results.map(r => ({
        competitionResultId: r.id,
        competitionName: r.showName,
        horseName: r.horse.name,
        horseId: r.horse.id,
        placement: r.placement,
        prizeMoney: Number(r.prizeWon) || 0,
        discipline: r.discipline,
        runDate: r.runDate,
      }));

      logger.info(
        `[userRoutes.GET /:userId/prize-history] Retrieved ${formatted.length} results for user ${userId}`,
      );

      return res.json({
        success: true,
        data: {
          prizeHistory: formatted,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      });
    } catch (error) {
      logger.error(`[userRoutes.GET /:userId/prize-history] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
);

// XP management
router.post(
  '/:id/add-xp',
  mutationRateLimiter,
  [
    authenticateToken,
    ...validateUserId,
    requireSelfAccess(),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  ],
  addXpController,
);

export default router;
