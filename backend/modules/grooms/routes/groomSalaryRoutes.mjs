/**
 * Groom Salary Routes
 *
 * API endpoints for groom salary management
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import {
  getUserSalaryCost,
  getCronStatus,
  getSalarySummary,
  getGroomPayStatusHandler,
  payGroomHandler,
} from '../controllers/groomSalaryController.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/groom-salaries/summary
 * Get comprehensive salary summary for user
 */
router.get('/summary', getSalarySummary);

/**
 * GET /api/groom-salaries/cost
 * Get current weekly salary cost for the authenticated user
 */
router.get('/cost', getUserSalaryCost);

// GET /history and GET /groom/:groomId/salary were removed with the duplicate
// lookups (owner ruling 2026-10-28, q151, Equoria-a7f1p): the Staff page reads GET /groom-salaries/cost.

/**
 * GET /api/groom-salaries/pay-status
 * This week's pay for each groom on staff: fee, paid or not, what Pay Groom takes.
 */
router.get('/pay-status', getGroomPayStatusHandler);

/**
 * POST /api/groom-salaries/grooms/:groomId/pay
 * Pay Groom (owner ruling 2026-10-28; q268, Equoria-hc96y): payday is a player action.
 */
router.post(
  '/grooms/:groomId/pay',
  mutationRateLimiter,
  param('groomId').isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    return next();
  },
  payGroomHandler,
);

/**
 * GET /api/groom-salaries/status
 * Get cron job status information
 */
router.get('/status', getCronStatus);

// POST /process (the manual payday) moved to the Steward's Office, owner only behind
// the emailed check-in (owner ruling 2026-10-28, q262, Equoria-opdt7):
// POST /api/v1/staff/payroll/grooms/run.

export default router;
