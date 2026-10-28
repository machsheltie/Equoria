/**
 * Groom Handler Routes
 * API routes for competition handler management
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';
import {
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  HANDLER_SKILL_BONUSES,
} from '../services/groomHandlerService.mjs';
import {
  getHorseHandler,
  checkHandlerEligibility,
  getHandlerConfig,
} from '../controllers/groomHandlerController.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[groomHandlerRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
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
 * GET /api/groom-handlers/horse/:horseId
 * Get the assigned handler for a horse
 *
 * Security: Validates horse ownership before returning handler information
 */
router.get(
  '/horse/:horseId',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'horseId' }),
  getHorseHandler,
);

/**
 * GET /api/groom-handlers/eligibility/:horseId/:className
 * Check handler eligibility for a specific conformation class
 *
 * Security: Validates horse ownership before checking eligibility
 */
router.get(
  '/eligibility/:horseId/:className',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    param('className')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Class name must be a valid string'),
  ],
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'horseId' }),
  checkHandlerEligibility,
);

/**
 * GET /api/groom-handlers/config
 * Get handler configuration and bonuses
 */
router.get('/config', getHandlerConfig);

// GET /statistics was removed (owner ruling 2026-10-27: the groom reputation/performance system is retired; Equoria-a7f1p).

/**
 * GET /api/groom-handlers/disciplines
 * Get all disciplines with handler bonus information
 */
router.get('/disciplines', async (req, res) => {
  try {
    logger.info('[groomHandlerRoutes] Getting disciplines with handler information');

    // Import discipline data
    const { getAllDisciplines } = await import('../../../utils/competitionLogic.mjs');
    const disciplines = getAllDisciplines();

    // Add handler bonus information to each discipline
    const disciplinesWithHandlerInfo = disciplines.map(discipline => {
      // Find personality synergies
      const personalitySynergies = Object.entries(PERSONALITY_DISCIPLINE_SYNERGY)
        .filter(([_personality, config]) => config.beneficial.includes(discipline.name))
        .map(([personality, config]) => ({
          personality,
          bonus: config.bonus,
        }));

      // Find specialty bonuses
      const specialtyBonuses = Object.entries(SPECIALTY_DISCIPLINE_BONUSES)
        .filter(([_specialty, config]) => config.disciplines.includes(discipline.name))
        .map(([specialty, config]) => ({
          specialty,
          bonus: config.bonus,
        }));

      return {
        ...discipline,
        handlerBonuses: {
          personalitySynergies,
          specialtyBonuses,
          maxPossibleBonus:
            Math.max(
              ...personalitySynergies.map(p => p.bonus),
              ...specialtyBonuses.map(s => s.bonus),
              0,
            ) + HANDLER_SKILL_BONUSES.master.maxBonus, // Add max skill bonus
        },
      };
    });

    res.status(200).json({
      success: true,
      message: 'Disciplines with handler information retrieved successfully',
      data: {
        disciplines: disciplinesWithHandlerInfo,
        totalDisciplines: disciplinesWithHandlerInfo.length,
      },
    });
  } catch (error) {
    logger.error(`[groomHandlerRoutes] Error getting disciplines: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error retrieving disciplines',
      data: null,
    });
  }
});

export default router;
