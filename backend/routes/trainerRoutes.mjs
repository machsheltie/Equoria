/**
 * Trainer Routes
 * All trainer endpoints under /api/trainers including marketplace sub-routes.
 *
 * Path summary:
 *   GET  /marketplace             → get marketplace listing
 *   POST /marketplace/hire        → hire a trainer from marketplace
 *   POST /marketplace/refresh     → refresh marketplace listing
 *   GET  /user/:userId            → get user's hired trainers
 *   GET  /assignments             → get all active assignments for current user
 *   POST /assignments             → assign a trainer to a horse
 *   DELETE /assignments/:id       → remove a trainer assignment
 *   DELETE /:id/dismiss           → dismiss (retire) a trainer
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import {
  getTrainerMarketplace,
  refreshTrainerMarketplace,
  hireTrainerFromMarketplace,
} from '../controllers/trainerMarketplaceController.mjs';
import {
  getUserTrainers,
  getTrainerAssignments,
  assignTrainer,
  deleteTrainerAssignment,
  dismissTrainer,
} from '../controllers/trainerController.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[trainerRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

// ── Marketplace routes ───────────────────────────────────────────────────────

router.get('/marketplace', getTrainerMarketplace);

router.post(
  '/marketplace/hire',
  [
    body('marketplaceId').notEmpty().withMessage('marketplaceId is required'),
    handleValidationErrors,
  ],
  hireTrainerFromMarketplace,
);

router.post(
  '/marketplace/refresh',
  [
    body('force').optional().isBoolean().withMessage('force must be a boolean'),
    handleValidationErrors,
  ],
  refreshTrainerMarketplace,
);

// ── Assignment routes ────────────────────────────────────────────────────────

router.get('/assignments', getTrainerAssignments);

router.post(
  '/assignments',
  [
    body('trainerId').isInt({ min: 1 }).withMessage('trainerId must be a positive integer'),
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('notes must be 500 characters or less'),
    handleValidationErrors,
  ],
  assignTrainer,
);

router.delete(
  '/assignments/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('assignment id must be a positive integer'),
    handleValidationErrors,
  ],
  deleteTrainerAssignment,
);

// ── User trainers route ──────────────────────────────────────────────────────

router.get(
  '/user/:userId',
  [param('userId').notEmpty().withMessage('userId is required'), handleValidationErrors],
  (req, res, next) => {
    if (req.user.id !== req.params.userId) {
      logger.warn(`[trainerRoutes] Self-access violation: ${req.user.id} → ${req.params.userId}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    next();
  },
  getUserTrainers,
);

// ── Per-trainer routes ───────────────────────────────────────────────────────

router.delete(
  '/:id/dismiss',
  [
    param('id').isInt({ min: 1 }).withMessage('trainer id must be a positive integer'),
    handleValidationErrors,
  ],
  dismissTrainer,
);

export default router;
