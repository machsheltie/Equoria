/**
 * Vet Routes
 * All vet endpoints under /api/vet.
 *
 * Path summary:
 *   GET  /services           → the two vet services
 *   GET  /horses             → the player's horses under 21 with vetted / tested state
 *   POST /book-appointment   → book an appointment for a horse
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../../utils/logger.mjs';
import { getVetServices, getVetHorses, bookVetAppointment } from '../controllers/vetController.mjs';
// Equoria-ftjm: dedicated stricter per-user economy-mutation limiter.
import { financialRateLimiter } from '../../../../middleware/rateLimiting.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[vetRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/services', getVetServices);
router.get('/horses', getVetHorses);

router.post(
  '/book-appointment',
  financialRateLimiter,
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('serviceId').notEmpty().withMessage('serviceId is required'),
    handleValidationErrors,
  ],
  bookVetAppointment,
);

export default router;
