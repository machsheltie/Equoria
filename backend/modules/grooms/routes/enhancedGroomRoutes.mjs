/**
 * Enhanced Groom Routes
 * API routes for advanced groom-horse interaction system
 *
 * GET /interactions/types, GET /relationship-levels and GET /special-events were
 * removed (Equoria-a7f1p): they were the catalogue of the retired enhanced
 * interaction door (POST /interact, below). "Groom horse" is the only way to
 * groom (owner rulings 2026-10-20 and 2026-10-26, q87), so the variations,
 * bonus multipliers and special-event odds they listed describe nothing a
 * player can do, and no screen read them.
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';
import {
  getEnhancedInteractions,
  getRelationshipDetails,
} from '../controllers/enhancedGroomController.mjs';
import { retiredGroomDoor } from '../controllers/groomCareController.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[enhancedGroomRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/grooms/enhanced/interactions/:groomId/:horseId
 * Get available enhanced interactions for a specific groom-horse pair
 *
 * Security: Validates both groom and horse ownership before returning interactions
 */
router.get(
  '/interactions/:groomId/:horseId',
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  requireOwnership('horse', { idParam: 'horseId' }),
  getEnhancedInteractions,
);

/**
 * POST /api/grooms/enhanced/interact — retired. "Groom horse" (POST
 * /api/grooms/care/:horseId/groom) is the only way to groom; this answers 410.
 */
router.post('/interact', retiredGroomDoor);

/**
 * GET /api/grooms/enhanced/relationship/:groomId/:horseId
 * Get detailed relationship information between groom and horse
 *
 * Security: Validates both groom and horse ownership before returning relationship data
 */
router.get(
  '/relationship/:groomId/:horseId',
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  requireOwnership('horse', { idParam: 'horseId' }),
  getRelationshipDetails,
);

export default router;
