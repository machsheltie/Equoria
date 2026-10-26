/**
 * Daily care routes, mounted at /grooms/care (see the care CONTRACT.md).
 *
 *   GET  /ungroomed-today   the player's horses with a groom not yet groomed today
 *   GET  /:horseId          the horse's care status
 *   POST /:horseId/groom    "groom horse" (body { activity } for a foal)
 *
 * The static path is registered before the :horseId routes.
 */

import express from 'express';
import { body, param } from 'express-validator';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';
import {
  getHorseCareStatus,
  getUngroomedToday,
  postGroomHorse,
} from '../controllers/groomCareController.mjs';

const router = express.Router();

const horseIdParam = param('horseId')
  .isInt({ min: 1 })
  .withMessage('horseId must be a positive integer');

router.get('/ungroomed-today', getUngroomedToday);

router.get(
  '/:horseId',
  [horseIdParam, handleValidationErrors],
  requireOwnership('horse', { idParam: 'horseId' }),
  getHorseCareStatus,
);

router.post(
  '/:horseId/groom',
  [
    horseIdParam,
    body('activity')
      .optional({ values: 'null' })
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('activity must be a short text value'),
    handleValidationErrors,
  ],
  requireOwnership('horse', { idParam: 'horseId' }),
  postGroomHorse,
);

export default router;
