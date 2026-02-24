/**
 * Rider Routes
 * All rider endpoints under /api/riders including marketplace sub-routes.
 *
 * Path summary:
 *   GET  /marketplace             → get marketplace listing
 *   POST /marketplace/hire        → hire a rider from marketplace
 *   POST /marketplace/refresh     → refresh marketplace listing
 *   GET  /user/:userId            → get user's hired riders
 *   GET  /assignments             → get all active assignments for current user
 *   POST /assignments             → assign a rider to a horse
 *   DELETE /assignments/:id       → remove a rider assignment
 *   GET  /:id/discovery           → get rider discovery slots
 *   DELETE /:id/dismiss           → dismiss (retire) a rider
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import {
  getRiderMarketplace,
  refreshRiderMarketplace,
  hireRiderFromMarketplace,
} from '../controllers/riderMarketplaceController.mjs';
import {
  getUserRiders,
  getRiderAssignments,
  assignRider,
  deleteRiderAssignment,
  getRiderDiscovery,
  dismissRider,
} from '../controllers/riderController.mjs';

const router = express.Router();

/**
 * Validation error handler middleware.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[riderRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

// ── Marketplace routes (must come before /:id to avoid conflicts) ────────────

/**
 * GET /api/riders/marketplace
 * Returns the current marketplace listing for the authenticated user.
 */
router.get('/marketplace', getRiderMarketplace);

/**
 * POST /api/riders/marketplace/hire
 * Hire a rider from the marketplace.
 * Body: { marketplaceId: string }
 */
router.post(
  '/marketplace/hire',
  [
    body('marketplaceId').notEmpty().withMessage('marketplaceId is required'),
    handleValidationErrors,
  ],
  hireRiderFromMarketplace,
);

/**
 * POST /api/riders/marketplace/refresh
 * Refresh the marketplace listing.
 * Body: { force?: boolean }
 */
router.post(
  '/marketplace/refresh',
  [
    body('force').optional().isBoolean().withMessage('force must be a boolean'),
    handleValidationErrors,
  ],
  refreshRiderMarketplace,
);

// ── Assignment routes ────────────────────────────────────────────────────────

/**
 * GET /api/riders/assignments
 * Returns all active assignments for the authenticated user.
 */
router.get('/assignments', getRiderAssignments);

/**
 * POST /api/riders/assignments
 * Assign a rider to a horse.
 * Body: { riderId, horseId, notes? }
 */
router.post(
  '/assignments',
  [
    body('riderId').isInt({ min: 1 }).withMessage('riderId must be a positive integer'),
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('notes must be 500 characters or less'),
    handleValidationErrors,
  ],
  assignRider,
);

/**
 * DELETE /api/riders/assignments/:id
 * Remove (deactivate) a rider assignment.
 */
router.delete(
  '/assignments/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('assignment id must be a positive integer'),
    handleValidationErrors,
  ],
  deleteRiderAssignment,
);

// ── User riders route ────────────────────────────────────────────────────────

/**
 * GET /api/riders/user/:userId
 * Returns all riders hired by the specified user.
 * IDOR: only allows access to own riders.
 */
router.get(
  '/user/:userId',
  [param('userId').notEmpty().withMessage('userId is required'), handleValidationErrors],
  (req, res, next) => {
    const targetUserId = req.params.userId;
    const authenticatedUserId = req.user.id;
    if (authenticatedUserId !== targetUserId) {
      logger.warn(
        `[riderRoutes] Self-access violation: user ${authenticatedUserId} → ${targetUserId}`,
      );
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    next();
  },
  getUserRiders,
);

// ── Per-rider routes ─────────────────────────────────────────────────────────

/**
 * GET /api/riders/:id/discovery
 * Returns discovery slots for a rider.
 */
router.get(
  '/:id/discovery',
  [
    param('id').isInt({ min: 1 }).withMessage('rider id must be a positive integer'),
    handleValidationErrors,
  ],
  getRiderDiscovery,
);

/**
 * DELETE /api/riders/:id/dismiss
 * Dismiss (retire) a rider.
 */
router.delete(
  '/:id/dismiss',
  [
    param('id').isInt({ min: 1 }).withMessage('rider id must be a positive integer'),
    handleValidationErrors,
  ],
  dismissRider,
);

export default router;
