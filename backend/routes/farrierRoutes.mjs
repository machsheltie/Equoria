/**
 * Farrier Routes
 * All farrier endpoints under /api/farrier.
 *
 * Path summary:
 *   GET  /services      → list available farrier services
 *   POST /book-service  → book a service for a horse
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import { getFarrierServices, bookFarrierService } from '../controllers/farrierController.mjs';

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

router.get('/services', getFarrierServices);

router.post(
  '/book-service',
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('serviceId').notEmpty().withMessage('serviceId is required'),
    handleValidationErrors,
  ],
  bookFarrierService,
);

export default router;
