/**
 * Ultra-Rare & Exotic Traits API Routes
 * Handles API endpoints for ultra-rare and exotic trait management
 * Includes trait discovery, groom perk assignment, and trait effect queries
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { evaluateUltraRareTriggers, evaluateExoticUnlocks } from '../utils/ultraRareTriggerEngine.mjs';
import { assignRareTraitBoosterPerks, getRevealedPerks, applyRareTraitBoosterEffects } from '../utils/groomRareTraitPerks.mjs';
import { getAllUltraRareTraits, getAllExoticTraits, getUltraRareTraitDefinition } from '../utils/ultraRareTraits.mjs';
import { applyUltraRareStressEffects, applyUltraRareCompetitionEffects, hasUltraRareAbility } from '../utils/ultraRareMechanicalEffects.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * Simple validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * GET /api/ultra-rare-traits/definitions
 * Get all ultra-rare and exotic trait definitions
 */
router.get('/definitions', async (req, res) => {
  try {
    const ultraRareTraits = getAllUltraRareTraits();
    const exoticTraits = getAllExoticTraits();

    res.json({
      success: true,
      data: {
        ultraRare: ultraRareTraits,
        exotic: exoticTraits,
        totalCount: Object.keys(ultraRareTraits).length + Object.keys(exoticTraits).length,
      },
    });
  } catch (error) {
    logger.error(`[ultraRareTraitRoutes] Error getting trait definitions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trait definitions',
      error: error.message,
    });
  }
});

/**
 * POST /api/ultra-rare-traits/evaluate/:horseId
 * Evaluate ultra-rare and exotic trait triggers for a horse
 */
router.post('/evaluate/:horseId',
  authenticateToken,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('evaluationContext').optional().isObject().withMessage('Evaluation context must be an object'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseId } = req.params;
      const { evaluationContext = {} } = req.body;

      // Verify horse ownership
      const horse = await prisma.horse.findUnique({
        where: { id: parseInt(horseId) },
        select: { id: true, userId: true, name: true },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      if (horse.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this horse',
        });
      }

      // Evaluate ultra-rare triggers
      const ultraRareResults = await evaluateUltraRareTriggers(parseInt(horseId), evaluationContext);

      // Evaluate exotic unlocks
      const exoticResults = await evaluateExoticUnlocks(parseInt(horseId), evaluationContext);

      // Log evaluation events
      const allResults = [...ultraRareResults, ...exoticResults];
      for (const result of allResults) {
        await prisma.ultraRareTraitEvent.create({
          data: {
            horseId: parseInt(horseId),
            traitName: result.name,
            traitTier: result.tier,
            eventType: 'evaluation_triggered',
            baseChance: result.baseChance || null,
            finalChance: result.baseChance || null, // Would be modified by groom perks
            triggerConditions: evaluationContext,
            success: true,
            notes: `Trait ${result.tier} evaluation completed`,
          },
        });
      }

      res.json({
        success: true,
        data: {
          ultraRareResults,
          exoticResults,
          totalTriggered: allResults.length,
          evaluationContext,
        },
      });
    } catch (error) {
      logger.error(`[ultraRareTraitRoutes] Error evaluating traits: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate ultra-rare traits',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/ultra-rare-traits/horse/:horseId
 * Get ultra-rare and exotic traits for a specific horse
 */
router.get('/horse/:horseId',
  authenticateToken,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseId } = req.params;

      // Get horse with ultra-rare traits
      const horse = await prisma.horse.findUnique({
        where: { id: parseInt(horseId) },
        select: {
          id: true,
          name: true,
          userId: true,
          ultraRareTraits: true,
          ultraRareTraitEvents: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      if (horse.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this horse',
        });
      }

      // Enrich trait data with definitions
      const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
      const enrichedTraits = {
        ultraRare: ultraRareTraits.ultraRare.map(trait => ({
          ...trait,
          definition: getUltraRareTraitDefinition(trait.name),
        })),
        exotic: ultraRareTraits.exotic.map(trait => ({
          ...trait,
          definition: getUltraRareTraitDefinition(trait.name),
        })),
      };

      res.json({
        success: true,
        data: {
          horse: {
            id: horse.id,
            name: horse.name,
          },
          traits: enrichedTraits,
          recentEvents: horse.ultraRareTraitEvents,
          totalTraits: enrichedTraits.ultraRare.length + enrichedTraits.exotic.length,
        },
      });
    } catch (error) {
      logger.error(`[ultraRareTraitRoutes] Error getting horse traits: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve horse ultra-rare traits',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/ultra-rare-traits/groom/:groomId/assign-perks
 * Assign rare trait booster perks to a groom
 */
router.post('/groom/:groomId/assign-perks',
  authenticateToken,
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { groomId } = req.params;

      // Verify groom ownership
      const groom = await prisma.groom.findUnique({
        where: { id: parseInt(groomId) },
        select: {
          id: true,
          name: true,
          userId: true,
          experience: true,
          personality: true,
          groomPersonality: true,
          bonusTraitMap: true,
        },
      });

      if (!groom) {
        return res.status(404).json({
          success: false,
          message: 'Groom not found',
        });
      }

      if (groom.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this groom',
        });
      }

      // Assign rare trait booster perks
      const assignedPerks = await assignRareTraitBoosterPerks(parseInt(groomId), groom);

      res.json({
        success: true,
        data: {
          groom: {
            id: groom.id,
            name: groom.name,
          },
          assignedPerks,
          perkCount: Object.keys(assignedPerks).length,
        },
      });
    } catch (error) {
      logger.error(`[ultraRareTraitRoutes] Error assigning groom perks: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to assign rare trait booster perks',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/ultra-rare-traits/groom/:groomId/perks
 * Get revealed rare trait booster perks for a groom
 */
router.get('/groom/:groomId/perks',
  authenticateToken,
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { groomId } = req.params;

      // Verify groom ownership
      const groom = await prisma.groom.findUnique({
        where: { id: parseInt(groomId) },
        select: { id: true, name: true, userId: true },
      });

      if (!groom) {
        return res.status(404).json({
          success: false,
          message: 'Groom not found',
        });
      }

      if (groom.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this groom',
        });
      }

      // Get revealed perks
      const revealedPerks = await getRevealedPerks(parseInt(groomId));

      res.json({
        success: true,
        data: {
          groom: {
            id: groom.id,
            name: groom.name,
          },
          revealedPerks,
          perkCount: revealedPerks.length,
        },
      });
    } catch (error) {
      logger.error(`[ultraRareTraitRoutes] Error getting groom perks: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve groom perks',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/ultra-rare-traits/effects/calculate
 * Calculate ultra-rare trait effects for various scenarios
 */
router.post('/effects/calculate',
  authenticateToken,
  [
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('effectType').isIn(['stress', 'competition', 'bonding', 'training']).withMessage('Invalid effect type'),
    body('baseValue').isNumeric().withMessage('Base value must be numeric'),
    body('context').optional().isObject().withMessage('Context must be an object'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseId, effectType, baseValue, context = {} } = req.body;

      // Get horse with ultra-rare traits
      const horse = await prisma.horse.findUnique({
        where: { id: parseInt(horseId) },
        select: {
          id: true,
          name: true,
          userId: true,
          ultraRareTraits: true,
          bondScore: true,
        },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      if (horse.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this horse',
        });
      }

      let effectResult;

      switch (effectType) {
        case 'stress':
          effectResult = applyUltraRareStressEffects(horse, parseFloat(baseValue), context.stressSource);
          break;
        case 'competition':
          effectResult = applyUltraRareCompetitionEffects(horse, parseFloat(baseValue), context);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Effect type not yet implemented',
          });
      }

      res.json({
        success: true,
        data: {
          horse: {
            id: horse.id,
            name: horse.name,
          },
          effectType,
          baseValue: parseFloat(baseValue),
          context,
          result: effectResult,
        },
      });
    } catch (error) {
      logger.error(`[ultraRareTraitRoutes] Error calculating effects: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate ultra-rare trait effects',
        error: error.message,
      });
    }
  },
);

export default router;
