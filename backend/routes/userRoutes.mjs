/**
 * User Routes
 * API endpoints for user-related operations
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { getUserProgressAPI, getDashboardData } from '../controllers/userController.mjs'; // Updated import
import { authenticateToken } from '../middleware/auth.mjs';
import logger from '../utils/logger.mjs';

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
router.get('/:id/progress', authenticateToken, validateUserId, getUserProgressAPI);

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
router.get('/dashboard/:userId', authenticateToken, validateDashboardUserId, getDashboardData);

export default router;
