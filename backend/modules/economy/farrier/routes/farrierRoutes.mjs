/**
 * Farrier Routes
 * All farrier endpoints under /api/v1/farrier.
 *
 * Path summary:
 *   GET  /shoe-types -> the shoe types (data)
 *   GET  /horses     -> the player's horses under 21 with shod state
 *   POST /shoe-horse  -> shoe a horse (once a week)
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../../utils/logger.mjs';
import {
  getFarrierServices,
  getFarrierHorses,
  shoeHorse,
} from '../controllers/farrierController.mjs';
// Equoria-ftjm: dedicated stricter per-user economy-mutation limiter.
import { financialRateLimiter } from '../../../../middleware/rateLimiting.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[farrierRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/shoe-types', getFarrierServices);
router.get('/horses', getFarrierHorses);

router.post(
  '/shoe-horse',
  financialRateLimiter,
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('serviceId').optional().isString().withMessage('serviceId must be a string'),
    handleValidationErrors,
  ],
  shoeHorse,
);

export default router;
