/**
 * Crafting Routes
 * All crafting endpoints under /api/v1/crafting.
 *
 * Path summary:
 *   GET  /materials  → player's material stockpile + workshop tier
 *   GET  /recipes    → all recipes with locked/unlocked status
 *   POST /craft      → craft an item (deduct materials + coins, add to inventory)
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';
import {
  getMaterials_endpoint,
  getRecipes,
  craftItem,
} from '../controllers/craftingController.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[craftingRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/materials', getMaterials_endpoint);

router.get('/recipes', getRecipes);

router.post(
  '/craft',
  [body('recipeId').notEmpty().withMessage('recipeId is required'), handleValidationErrors],
  craftItem,
);

export default router;
