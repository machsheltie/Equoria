/**
 * Enhanced Groom Routes
 * API routes for advanced groom-horse interaction system
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import logger from '../utils/logger.mjs';
import {
  getEnhancedInteractions,
  performEnhancedInteraction,
  getRelationshipDetails,
} from '../controllers/enhancedGroomController.mjs';

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
 */
router.get(
  '/interactions/:groomId/:horseId',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
  ],
  handleValidationErrors,
  getEnhancedInteractions,
);

/**
 * POST /api/grooms/enhanced/interact
 * Perform an enhanced interaction between groom and horse
 */
router.post(
  '/interact',
  [
    body('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    body('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    body('interactionType')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Interaction type must be a non-empty string (max 50 characters)'),
    body('variation')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Variation must be a non-empty string (max 100 characters)'),
    body('duration')
      .isInt({ min: 5, max: 180 })
      .withMessage('Duration must be between 5 and 180 minutes'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Notes must be a string (max 500 characters)'),
  ],
  handleValidationErrors,
  performEnhancedInteraction,
);

/**
 * GET /api/grooms/enhanced/relationship/:groomId/:horseId
 * Get detailed relationship information between groom and horse
 */
router.get(
  '/relationship/:groomId/:horseId',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
  ],
  handleValidationErrors,
  getRelationshipDetails,
);

/**
 * GET /api/grooms/enhanced/interactions/types
 * Get all available interaction types and their details
 */
router.get('/interactions/types', async (req, res) => {
  try {
    const { ENHANCED_INTERACTIONS } = await import('../services/enhancedGroomInteractions.mjs');

    const interactionTypes = Object.entries(ENHANCED_INTERACTIONS).map(([_key, interaction]) => ({
      id: interaction.id,
      name: interaction.name,
      category: interaction.category,
      baseTime: interaction.baseTime,
      variations: interaction.variations.map(v => ({
        name: v.name,
        context: v.context,
        bonusMultiplier: v.bonusMultiplier,
        description: generateVariationDescription(v.name, v.context),
      })),
    }));

    res.status(200).json({
      success: true,
      message: 'Interaction types retrieved successfully',
      data: {
        interactionTypes,
        categories: {
          care: 'Basic daily care and maintenance',
          enrichment: 'Mental and physical stimulation activities',
          training: 'Training support and skill development',
          medical: 'Health assessment and medical care',
          bonding: 'Relationship building and trust exercises',
        },
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving interaction types',
      data: null,
    });
  }
});

/**
 * GET /api/grooms/enhanced/relationship-levels
 * Get information about relationship levels
 */
router.get('/relationship-levels', async (req, res) => {
  try {
    const { RELATIONSHIP_LEVELS } = await import('../services/enhancedGroomInteractions.mjs');

    const levels = Object.values(RELATIONSHIP_LEVELS).map(level => ({
      level: level.level,
      name: level.name,
      threshold: level.threshold,
      multiplier: level.multiplier,
      description: generateLevelDescription(level.name, level.level),
    }));

    res.status(200).json({
      success: true,
      message: 'Relationship levels retrieved successfully',
      data: {
        levels,
        progression: {
          description: 'Relationship levels improve through consistent, quality interactions',
          benefits: [
            'Higher bonding multipliers',
            'Increased interaction effectiveness',
            'Access to special events',
            'Better groom performance',
          ],
        },
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving relationship levels',
      data: null,
    });
  }
});

/**
 * GET /api/grooms/enhanced/special-events
 * Get information about special events that can occur
 */
router.get('/special-events', async (req, res) => {
  try {
    const { SPECIAL_EVENTS } = await import('../services/enhancedGroomInteractions.mjs');

    const events = Object.entries(SPECIAL_EVENTS).map(([id, event]) => ({
      id,
      name: event.name,
      probability: `${(event.probability * 100).toFixed(1)}%`,
      conditions: event.conditions,
      effects: event.effects,
      description: generateEventDescription(event.name, event.effects),
    }));

    res.status(200).json({
      success: true,
      message: 'Special events retrieved successfully',
      data: {
        events,
        mechanics: {
          description: 'Special events can occur during interactions based on various conditions',
          factors: [
            'Relationship level',
            'Horse stress level',
            'Horse age',
            'Groom specialty match',
            'Random chance',
          ],
        },
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving special events',
      data: null,
    });
  }
});

// Helper functions for generating descriptions

function generateVariationDescription(name, context) {
  const descriptions = {
    'Morning Routine': 'Start the day with gentle, energizing care',
    'Evening Care': 'Wind down with calming end-of-day attention',
    'Thorough Inspection': 'Detailed examination and comprehensive care',
    'Puzzle Feeding': 'Mental stimulation through problem-solving activities',
    'Sensory Exploration': 'Introduce new textures, sounds, and experiences',
    'Social Play': 'Interactive games and social bonding activities',
    'Pre-Training Prep': 'Prepare horse mentally and physically for training',
    'Post-Training Care': 'Recovery and relaxation after training sessions',
    'Skill Reinforcement': 'Practice and reinforce learned behaviors',
    'Routine Check': 'Standard health assessment and monitoring',
    'Detailed Examination': 'Comprehensive health evaluation',
    'Preventive Care': 'Proactive health maintenance and prevention',
    'Quiet Companionship': 'Peaceful time together building trust',
    'Trust Building': 'Focused exercises to develop mutual trust',
    'Confidence Building': 'Activities to boost horse\'s self-assurance',
  };

  return descriptions[name] || `${context}-focused interaction`;
}

function generateLevelDescription(name, level) {
  const descriptions = {
    'Stranger': 'Initial unfamiliarity - building basic recognition',
    'Acquaintance': 'Basic familiarity established - routine interactions',
    'Familiar': 'Comfortable relationship - predictable positive responses',
    'Trusted': 'Strong trust developed - horse seeks groom\'s presence',
    'Bonded': 'Deep emotional connection - exceptional cooperation',
    'Devoted': 'Profound mutual attachment - intuitive understanding',
    'Soulmate': 'Perfect harmony - telepathic-like communication',
  };

  return descriptions[name] || `Relationship level ${level}`;
}

function generateEventDescription(name, _effects) {
  const descriptions = {
    'Breakthrough Moment': 'A sudden moment of understanding creates a lasting positive memory',
    'Perfect Harmony': 'Groom and horse work in perfect synchronization',
    'Learning Moment': 'Young horse gains valuable life experience',
    'Comfort in Distress': 'Groom provides exactly the right comfort when needed',
    'Playful Moment': 'Spontaneous play brings joy to both groom and horse',
  };

  return descriptions[name] || 'A special moment occurs during the interaction';
}

export default router;
