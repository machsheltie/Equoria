/**
 * Groom Salary Routes
 *
 * API endpoints for groom salary management
 */

import express from 'express';
import { param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { handleValidationErrors } from '../middleware/validationErrorHandler.mjs';
import {
  getUserSalaryCost,
  getSalaryHistory,
  getGroomSalary,
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

/**
 * GET /api/groom-salaries/history
 * Get salary payment history for the authenticated user
 */
router.get(
  '/history',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  handleValidationErrors,
  getSalaryHistory,
);

/**
 * GET /api/groom-salaries/groom/:groomId/salary
 * Get weekly salary for a specific groom
 */
router.get(
  '/groom/:groomId/salary',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
  ],
  handleValidationErrors,
  getGroomSalary,
);

/**
 * GET /api/groom-salaries/status
 * Get cron job status information
 */
router.get('/status', getCronStatus);

/**
 * POST /api/groom-salaries/process
 * Manually trigger salary processing (for testing/admin use)
 */
router.post('/process', triggerSalaryProcessingEndpoint);

export default router;
