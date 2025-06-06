/**
 * Horse XP Routes
 *
 * RESTful API routes for horse experience point management and stat allocation.
 * All routes require authentication and enforce horse ownership authorization.
 *
 * Routes:
 * - GET /api/horses/:horseId/xp - Get horse XP status
 * - POST /api/horses/:horseId/allocate-stat - Allocate stat point
 * - GET /api/horses/:horseId/xp-history - Get horse XP history
 * - POST /api/horses/:horseId/award-xp - Award XP (admin/system use)
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';

const router = express.Router();

// All horse XP routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/horses/:horseId/xp
 * @desc Get horse XP status and progression information
 * @access Private (horse owner only)
 * @param {number} horseId - Horse ID
 * @returns {Object} Horse XP status with current XP, available stat points, and progression info
 */
router.get('/:horseId/xp', horseXpController.getHorseXpStatus);

/**
 * @route POST /api/horses/:horseId/allocate-stat
 * @desc Allocate a stat point to a specific horse stat
 * @access Private (horse owner only)
 * @param {number} horseId - Horse ID
 * @body {string} statName - Name of the stat to increase (speed, stamina, etc.)
 * @returns {Object} Updated stat value and remaining stat points
 */
router.post('/:horseId/allocate-stat', horseXpController.allocateStatPoint);

/**
 * @route GET /api/horses/:horseId/xp-history
 * @desc Get horse XP event history with pagination
 * @access Private (horse owner only)
 * @param {number} horseId - Horse ID
 * @query {number} limit - Number of events to return (default: 50, max: 100)
 * @query {number} offset - Number of events to skip (default: 0)
 * @returns {Object} Paginated list of horse XP events
 */
router.get('/:horseId/xp-history', horseXpController.getHorseXpHistory);

/**
 * @route POST /api/horses/:horseId/award-xp
 * @desc Award XP to a horse (for system/admin use)
 * @access Private (horse owner only)
 * @param {number} horseId - Horse ID
 * @body {number} amount - Amount of XP to award (must be positive)
 * @body {string} reason - Reason for XP award
 * @returns {Object} Updated horse XP status
 */
router.post('/:horseId/award-xp', horseXpController.awardXpToHorse);

export default router;
