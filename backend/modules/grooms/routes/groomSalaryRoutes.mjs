/**
 * Groom Salary Routes
 *
 * API endpoints for groom salary management
 */

import express from 'express';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { satisfiesRole } from '../../staff/index.mjs';
import {
  getUserSalaryCost,
  triggerSalaryProcessingEndpoint,
  getCronStatus,
  getSalarySummary,
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
 * GET /api/groom-salaries/status
 * Get cron job status information
 */
router.get('/status', getCronStatus);

/**
 * POST /api/groom-salaries/process
 * Manually trigger salary processing (admin only)
 */
router.post(
  '/process',
  (req, res, next) => {
    if (!req.user || !satisfiesRole(req.user.role, 'admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  },
  triggerSalaryProcessingEndpoint,
);

export default router;
