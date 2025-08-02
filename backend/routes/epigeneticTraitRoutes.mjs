/**
 * Epigenetic Trait Routes
 *
 * API endpoints for managing the enhanced epigenetic trait system,
 * including milestone evaluation, trait history, and breeding insights.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { evaluateEnhancedMilestone } from '../utils/enhancedMilestoneEvaluation.mjs';
import {
  logTraitAssignment,
  getTraitHistory,
  getTraitDevelopmentSummary,
  getBreedingInsights,
  cleanupTraitHistory,
} from '../services/traitHistoryService.mjs';
import { EPIGENETIC_FLAGS, GROOM_PERSONALITIES } from '../utils/epigeneticFlags.mjs';
import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/epigenetic-traits/definitions
 * Get all epigenetic flag and groom personality definitions
 */
router.get('/definitions', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        epigeneticFlags: EPIGENETIC_FLAGS,
        groomPersonalities: GROOM_PERSONALITIES,
        flagCount: Object.keys(EPIGENETIC_FLAGS).length,
        personalityCount: Object.keys(GROOM_PERSONALITIES).length,
      },
    });
  } catch (error) {
    console.error('Error fetching epigenetic trait definitions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch definitions',
    });
  }
});

/**
 * POST /api/epigenetic-traits/evaluate-milestone/:horseId
 * Evaluate enhanced milestone with epigenetic factors
 */
router.post('/evaluate-milestone/:horseId',
  authenticateToken,
  [
    param('horseId').isInt().withMessage('Horse ID must be an integer'),
    body('milestoneData').optional().isObject().withMessage('Milestone data must be an object'),
    body('includeHistory').optional().isBoolean().withMessage('Include history must be boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { horseId } = req.params;
      const { milestoneData = {}, includeHistory = true } = req.body;
      const userId = req.user.id;

      // Verify horse ownership
      const horse = await prisma.horse.findFirst({
        where: {
          id: parseInt(horseId),
          ownerId: userId,
        },
        include: {
          groomAssignments: {
            where: { isActive: true },
            include: {
              groom: {
                select: {
                  id: true,
                  name: true,
                  groomPersonality: true,
                  speciality: true,
                  experience: true,
                },
              },
            },
          },
        },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          error: 'Horse not found or not owned by user',
        });
      }

      // Get groom care history
      let groomCareHistory = {};
      if (includeHistory) {
        groomCareHistory = await getGroomCareHistory(parseInt(horseId));
      }

      // Get current groom
      const currentGroom = horse.groomAssignments[0]?.groom || null;

      // Evaluate enhanced milestone
      const milestoneResult = await evaluateEnhancedMilestone(
        horse,
        groomCareHistory,
        currentGroom,
        milestoneData,
      );

      res.json({
        success: true,
        data: {
          horseId: parseInt(horseId),
          horseName: horse.name,
          currentGroom: currentGroom?.name || 'None assigned',
          milestoneResult,
          careHistoryIncluded: includeHistory,
        },
      });

    } catch (error) {
      console.error('Error evaluating enhanced milestone:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to evaluate milestone',
      });
    }
  },
);

/**
 * POST /api/epigenetic-traits/log-trait
 * Log a trait assignment to history
 */
router.post('/log-trait',
  authenticateToken,
  [
    body('horseId').isInt().withMessage('Horse ID must be an integer'),
    body('traitName').isString().notEmpty().withMessage('Trait name is required'),
    body('sourceType').isIn(['groom', 'milestone', 'environmental', 'genetic']).withMessage('Invalid source type'),
    body('sourceId').optional().isString(),
    body('influenceScore').optional().isFloat({ min: -10, max: 10 }).withMessage('Influence score must be between -10 and 10'),
    body('isEpigenetic').optional().isBoolean(),
    body('groomId').optional().isInt(),
    body('bondScore').optional().isInt({ min: 0, max: 100 }),
    body('stressLevel').optional().isInt({ min: 0, max: 10 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const userId = req.user.id;
      const { horseId } = req.body;

      // Verify horse ownership
      const horse = await prisma.horse.findFirst({
        where: {
          id: horseId,
          ownerId: userId,
        },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          error: 'Horse not found or not owned by user',
        });
      }

      // Log the trait assignment
      const historyEntry = await logTraitAssignment(req.body);

      res.status(201).json({
        success: true,
        data: historyEntry,
      });

    } catch (error) {
      console.error('Error logging trait assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to log trait assignment',
      });
    }
  },
);

/**
 * GET /api/epigenetic-traits/history/:horseId
 * Get trait development history for a horse
 */
router.get('/history/:horseId',
  authenticateToken,
  [
    param('horseId').isInt().withMessage('Horse ID must be an integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('sourceType').optional().isIn(['groom', 'milestone', 'environmental', 'genetic']),
    query('isEpigenetic').optional().isBoolean(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { horseId } = req.params;
      const userId = req.user.id;

      // Verify horse ownership
      const horse = await prisma.horse.findFirst({
        where: {
          id: parseInt(horseId),
          ownerId: userId,
        },
        select: { id: true, name: true },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          error: 'Horse not found or not owned by user',
        });
      }

      // Get trait history
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        sourceType: req.query.sourceType || null,
        isEpigenetic: req.query.isEpigenetic ? req.query.isEpigenetic === 'true' : null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      };

      const history = await getTraitHistory(parseInt(horseId), options);

      res.json({
        success: true,
        data: {
          horseId: parseInt(horseId),
          horseName: horse.name,
          history,
          totalEntries: history.length,
          options,
        },
      });

    } catch (error) {
      console.error('Error fetching trait history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trait history',
      });
    }
  },
);

/**
 * GET /api/epigenetic-traits/summary/:horseId
 * Get trait development summary for a horse
 */
router.get('/summary/:horseId',
  authenticateToken,
  [
    param('horseId').isInt().withMessage('Horse ID must be an integer'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { horseId } = req.params;
      const userId = req.user.id;

      // Verify horse ownership
      const horse = await prisma.horse.findFirst({
        where: {
          id: parseInt(horseId),
          ownerId: userId,
        },
        select: { id: true, name: true },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          error: 'Horse not found or not owned by user',
        });
      }

      // Get development summary
      const summary = await getTraitDevelopmentSummary(parseInt(horseId));

      res.json({
        success: true,
        data: {
          horseName: horse.name,
          summary,
        },
      });

    } catch (error) {
      console.error('Error fetching trait development summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch development summary',
      });
    }
  },
);

/**
 * GET /api/epigenetic-traits/breeding-insights/:horseId
 * Get breeding insights based on trait development
 */
router.get('/breeding-insights/:horseId',
  authenticateToken,
  [
    param('horseId').isInt().withMessage('Horse ID must be an integer'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { horseId } = req.params;
      const userId = req.user.id;

      // Verify horse ownership
      const horse = await prisma.horse.findFirst({
        where: {
          id: parseInt(horseId),
          ownerId: userId,
        },
        select: { id: true, name: true },
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          error: 'Horse not found or not owned by user',
        });
      }

      // Get breeding insights
      const insights = await getBreedingInsights(parseInt(horseId));

      res.json({
        success: true,
        data: {
          horseName: horse.name,
          insights,
        },
      });

    } catch (error) {
      console.error('Error fetching breeding insights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch breeding insights',
      });
    }
  },
);

/**
 * Helper function to get groom care history
 */
async function getGroomCareHistory(horseId) {
  const interactions = await prisma.groomInteraction.findMany({
    where: { foalId: horseId },
    include: {
      groom: {
        select: {
          id: true,
          name: true,
          groomPersonality: true,
          speciality: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: 100, // Last 100 interactions
  });

  const assignments = await prisma.groomAssignment.findMany({
    where: { foalId: horseId },
    include: {
      groom: {
        select: {
          id: true,
          name: true,
          groomPersonality: true,
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  return {
    interactions,
    assignments,
    bondHistory: [], // Would be populated from bond tracking
    stressHistory: [], // Would be populated from stress tracking
  };
}

/**
 * Development/testing cleanup endpoint
 */
if (process.env.NODE_ENV !== 'production') {
  router.delete('/test/cleanup',
    authenticateToken,
    async (req, res) => {
      try {
        const userId = req.user.id;
        const result = await cleanupTraitHistory(userId);

        res.json({
          success: true,
          message: 'Trait history cleaned up successfully',
          data: result,
        });
      } catch (error) {
        console.error('Error cleaning up trait history:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to cleanup trait history',
        });
      }
    },
  );
}

export default router;
