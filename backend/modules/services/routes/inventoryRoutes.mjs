/**
 * Inventory Routes
 * All inventory endpoints under /api/inventory.
 *
 * Path summary:
 *   GET  /           → list owned items with equipped state
 *   POST /equip      → equip item to a horse
 *   POST /unequip    → remove item from a horse
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';
import { getInventory, equipItem, unequipItem } from '../controllers/inventoryController.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[inventoryRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/', getInventory);

router.post(
  '/equip',
  [
    body('inventoryItemId').notEmpty().withMessage('inventoryItemId is required'),
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    handleValidationErrors,
  ],
  equipItem,
);

router.post(
  '/unequip',
  [
    body('inventoryItemId').notEmpty().withMessage('inventoryItemId is required'),
    handleValidationErrors,
  ],
  unequipItem,
);

export default router;
