/**
 * Feed Shop Routes
 * All feed shop endpoints under /api/feed-shop.
 *
 * Path summary:
 *   GET  /catalog   → list 5-tier catalog
 *   POST /purchase  → bulk-pack purchase ({feedTier, packs}); inventory pooled per user
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';
import { getFeedCatalog, purchaseFeed } from '../controllers/feedShopController.mjs';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[feedShopRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/catalog', getFeedCatalog);

router.post(
  '/purchase',
  [
    body('feedTier').isString().notEmpty().withMessage('feedTier is required'),
    body('packs').isInt({ min: 1 }).withMessage('packs must be an integer ≥ 1'),
    handleValidationErrors,
  ],
  purchaseFeed,
);

export default router;
