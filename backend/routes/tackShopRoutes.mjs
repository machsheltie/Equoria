/**
 * Tack Shop Routes
 * All tack shop endpoints under /api/tack-shop.
 *
 * Path summary:
 *   GET  /inventory   → list available tack items
 *   POST /purchase    → purchase an item for a horse
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import { getTackInventory, purchaseTackItem } from '../controllers/tackShopController.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[tackShopRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/inventory', getTackInventory);

router.post(
  '/purchase',
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('itemId').notEmpty().withMessage('itemId is required'),
    handleValidationErrors,
  ],
  purchaseTackItem,
);

export default router;
