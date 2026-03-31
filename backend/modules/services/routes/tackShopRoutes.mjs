/**
 * Tack Shop Routes
 * All tack shop endpoints under /api/tack-shop.
 *
 * Path summary:
 *   GET  /inventory   → list available tack items
 *   POST /purchase    → purchase an item for a horse
 *   POST /repair      → repair a tack item (restore condition to 100)
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';
import {
  getTackInventory,
  purchaseTackItem,
  repairTackItem,
  unequipDecoration,
} from '../controllers/tackShopController.mjs';

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

router.post(
  '/repair',
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('category').notEmpty().withMessage('category is required'),
    handleValidationErrors,
  ],
  repairTackItem,
);

router.post(
  '/unequip-decoration',
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    body('itemId').notEmpty().withMessage('itemId is required'),
    handleValidationErrors,
  ],
  unequipDecoration,
);

export default router;
