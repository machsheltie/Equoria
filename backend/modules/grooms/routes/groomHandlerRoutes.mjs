/**
 * Groom Handler Routes
 * The horse's show handler: its groom (Equoria-4fa7s).
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';
import { getHorseHandler } from '../controllers/groomHandlerController.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[groomHandlerRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/groom-handlers/horse/:horseId
 * Get the assigned handler for a horse
 *
 * Security: Validates horse ownership before returning handler information
 */
router.get(
  '/horse/:horseId',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'horseId' }),
  getHorseHandler,
);

// GET /eligibility/:horseId/:className, GET /config and GET /disciplines were
// removed (Equoria-4fa7s; owner ruling 2026-10-28 q154): a show handler is the
// horse's groom, any groom may handle in any class, and grooms handle only
// conformation shows and parades, so no per-class check or per-discipline
// handler bonus applies. GET /statistics was removed earlier (owner ruling
// 2026-10-27: the groom reputation/performance system is retired; Equoria-a7f1p).

export default router;
