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
// Equoria-ftjm: dedicated stricter per-user economy-mutation limiter.
import { financialRateLimiter } from '../../../middleware/rateLimiting.mjs';
// Equoria-jk9oj.2: declare auth at the router that OWNS these mutations rather
// than inferring it from the authRouter mount comment. Idempotent with the
// mount-level authenticateToken; the guard travels with the file if re-mounted.
import { authenticateToken } from '../../../middleware/auth.mjs';

const router = express.Router();
router.use(authenticateToken);

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
  financialRateLimiter,
  [body('recipeId').notEmpty().withMessage('recipeId is required'), handleValidationErrors],
  craftItem,
);

export default router;
