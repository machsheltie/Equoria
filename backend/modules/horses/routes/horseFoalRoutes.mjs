/**
 * Horses foal-creation sub-router (Equoria-y8u2j god-file split).
 *
 * Mounted under the parent `horseRoutes.mjs` at `/horses`, so the route below
 * resolves to:
 *   POST /horses/foals
 *
 * `/foals` is a specific (single-segment) sibling of the parent's `GET /:id`
 * but they differ by VERB (POST vs GET) so Express will not confuse them.
 * Mount order between this sub-router and the parent's `/:id` is therefore
 * not load-bearing.
 *
 * Security: dual ownership validation on sireId + damId via
 * `findOwnedResource` (CWE-284 Equoria-b4q6 + CWE-639 disclosure resistance —
 * same 404 'Sire not found' / 'Dam not found' for both not-found and
 * not-owned cases). Mirrors the dual-ownership pattern at
 * groomRoutes.mjs `POST /assign`.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import { foalRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware for foal creation.
 *
 * Kept inline (rather than moved to `_validators.mjs`) because the
 * `isValidHorseSex` / `HORSE_SEX_VALUES` imports are dynamic — moving them to
 * `_validators.mjs` would force every other validator in that file to load
 * the schema constants for no gain.
 */
const validateFoalCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('sireId').isInt({ min: 1 }).withMessage('Sire ID must be a positive integer'),
  body('damId').isInt({ min: 1 }).withMessage('Dam ID must be a positive integer'),
  body('sex')
    .optional()
    .custom(async value => {
      const { isValidHorseSex } = await import('../../../constants/schema.mjs');
      if (value && !isValidHorseSex(value)) {
        const { HORSE_SEX_VALUES } = await import('../../../constants/schema.mjs');
        throw new Error(`Sex must be one of: ${HORSE_SEX_VALUES.join(', ')}`);
      }
      return true;
    }),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  body('stableId').optional().isInt({ min: 1 }).withMessage('Stable ID must be a positive integer'),
  body('healthStatus')
    .optional()
    .isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Critical'])
    .withMessage('Health status must be one of: Excellent, Good, Fair, Poor, Critical'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * POST /horses/foals
 * Create a new foal with epigenetic traits applied at birth.
 */
router.post(
  '/foals',
  foalRateLimiter,
  authenticateToken,
  validateFoalCreation,
  // Dual ownership validation middleware (CWE-284 + CWE-639)
  async (req, res, next) => {
    try {
      const { sireId, damId } = req.body;
      const userId = req.user.id;

      // Validate sire ownership — 404 byte-identical for both not-found and
      // cross-user (CWE-639 disclosure resistance).
      const sire = await findOwnedResource('horse', sireId, userId);
      if (!sire) {
        return res.status(404).json({
          success: false,
          message: 'Sire not found',
        });
      }

      // Validate dam ownership.
      const dam = await findOwnedResource('horse', damId, userId);
      if (!dam) {
        return res.status(404).json({
          success: false,
          message: 'Dam not found',
        });
      }

      // Attach validated resources for the controller (createFoal still
      // re-fetches via getHorseById for breed checks etc., but having them
      // here lets future refactors skip the re-fetch).
      req.sire = sire;
      req.dam = dam;
      next();
      return null;
    } catch (error) {
      logger.error('[horseFoalRoutes POST /foals] ownership validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
  async (req, res) => {
    try {
      // Set the owner from the authenticated user
      req.body.userId = req.user.id;

      // Dynamic import for ES module (matches pre-extraction shape; static
      // import here would create a circular path through horseController.mjs).
      const { createFoal } = await import('../controllers/horseController.mjs');
      await createFoal(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error during foal creation',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

export default router;
