/**
 * Vet Routes
 * All vet endpoints under /api/vet.
 *
 * Path summary:
 *   GET  /services           → list available vet services
 *   POST /book-appointment   → book an appointment for a horse
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import { getVetServices, bookVetAppointment } from '../controllers/vetController.mjs';

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

router.post(
  '/book-appointment',
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('serviceId').notEmpty().withMessage('serviceId is required'),
    handleValidationErrors,
  ],
  bookVetAppointment,
);

export default router;
