/**
 * Enhanced Groom Controller
 * Handles advanced groom-horse interactions with rich relationship mechanics
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { MS_PER_WEEK } from '../../../constants/time.mjs';
import {
  getAvailableInteractions,
  calculateRelationshipLevel,
} from '../services/enhancedGroomInteractions.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

// POST /api/grooms/enhanced/interact (performEnhancedInteraction) was retired:
// "groom horse" (groomCareService) is the only way to groom (owner rulings
// 2026-10-20, 2026-10-26).

/**
 * GET /api/grooms/enhanced/interactions/:groomId/:horseId
 * Get available enhanced interactions for a specific groom-horse pair
 */
export async function getEnhancedInteractions(req, res) {
  try {
    const { groomId, horseId } = req.params;

    logger.info(
      `[enhancedGroomController] Getting enhanced interactions for groom ${groomId} and horse ${horseId}`,
    );

    // Validate IDs
    if (!groomId || !horseId) {
      return res.status(400).json({
        success: false,
        message: 'Groom ID and Horse ID are required',
        data: null,
      });
    }

    // Use validated resources from middleware (ownership already verified by requireOwnership middleware)
    // Fetch full groom and horse data with all needed fields
    const [groom, horse] = await Promise.all([
      prisma.groom.findUnique({
        where: { id: parseInt(groomId) },
        select: {
          id: true,
          name: true,
          speciality: true,
          skillLevel: true,
          personality: true,
          sessionRate: true,
        },
      }),
      prisma.horse.findUnique({
        where: { id: parseInt(horseId) },
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          // Equoria-ogmu: load Horse.age (game-years per Equoria-son6) so the
          // response can expose it directly; previously the controller
          // overwrote a non-loaded field with ageInDays.
          age: true,
          bondScore: true,
        },
      }),
    ]);

    // Resources are guaranteed to exist and be owned by user due to middleware validation
    // No additional checks needed

    // Equoria-yny4: horse.age is game-years (post Equoria-son6) and
    // enhancedGroomInteractions.mjs now reads it as game-years. The shadow
    // `horseForDayConsumers` object is no longer needed — pass horse directly.
    // ageInDays is still computed for API response consumers that want a
    // day-granular field alongside game-years.
    const ageInDays = getHorseAgeDays(horse.dateOfBirth);

    // Get relationship level
    const relationshipLevel = calculateRelationshipLevel(horse.bondScore || 0);

    // Get available interactions
    const availableInteractions = getAvailableInteractions(groom, horse);

    // Get interaction history for this pair
    const recentInteractions = await prisma.groomInteraction.findMany({
      where: {
        groomId: parseInt(groomId),
        foalId: parseInt(horseId),
        timestamp: {
          gte: new Date(Date.now() - MS_PER_WEEK), // Last 7 days
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        interactionType: true,
        quality: true,
        bondingChange: true,
        timestamp: true,
        notes: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Enhanced interactions retrieved successfully',
      data: {
        groom: {
          id: groom.id,
          name: groom.name,
          speciality: groom.speciality,
          skillLevel: groom.skillLevel,
          personality: groom.personality,
          sessionRate: groom.sessionRate,
        },
        horse: {
          id: horse.id,
          name: horse.name,
          // Equoria-ogmu: `age` is game-years (DB value, unmutated);
          // `ageInDays` is the day-granular value for clients that need it.
          age: horse.age,
          ageInDays,
          bondScore: horse.bondScore,
        },
        relationship: {
          level: relationshipLevel.name,
          levelNumber: relationshipLevel.level,
          bondingPoints: horse.bondScore || 0,
          nextThreshold: getNextThreshold(relationshipLevel.level),
          multiplier: relationshipLevel.multiplier,
        },
        availableInteractions,
        recentInteractions,
        recommendations: generateInteractionRecommendations(groom, horse, relationshipLevel),
      },
    });
  } catch (error) {
    logger.error(`[enhancedGroomController] Error getting enhanced interactions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * GET /api/grooms/enhanced/relationship/:groomId/:horseId
 * Get detailed relationship information between groom and horse
 */
export async function getRelationshipDetails(req, res) {
  try {
    const { groomId, horseId } = req.params;
    const userId = req.user?.id;

    // Get interaction history
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        groomId: parseInt(groomId),
        foalId: parseInt(horseId),
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    // Get current horse data.
    //
    // CWE-639 hardening: ownership is enforced upstream by both
    // requireOwnership('groom', { idParam: 'groomId' }) and
    // requireOwnership('horse', { idParam: 'horseId' }) in
    // enhancedGroomRoutes.mjs:101-102. By the time we reach this handler,
    // the horse is guaranteed to exist AND be OWNED by req.user, and the groom to
    // exist AND be ON req.user's STAFF (Equoria-ypb7d.2 — the two relations are
    // different: horses are owned, grooms are engaged).
    // The previous defensive 'Horse not found or not owned by user' branch
    // was dead code; we keep a defense-in-depth 404 fall-through (without
    // the 'or not owned' wording) in case middleware is ever bypassed.
    const horse = await prisma.horse.findUnique({
      where: { id: parseInt(horseId) },
      select: { bondScore: true, name: true, userId: true },
    });

    if (!horse || horse.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
        data: null,
      });
    }

    const relationshipLevel = calculateRelationshipLevel(horse.bondScore || 0);

    // Calculate relationship statistics
    const stats = calculateRelationshipStats(interactions);

    res.status(200).json({
      success: true,
      message: 'Relationship details retrieved successfully',
      data: {
        relationship: {
          level: relationshipLevel.name,
          levelNumber: relationshipLevel.level,
          bondingPoints: horse.bondScore || 0,
          nextThreshold: getNextThreshold(relationshipLevel.level),
          multiplier: relationshipLevel.multiplier,
        },
        statistics: stats,
        recentInteractions: interactions.slice(0, 10),
        milestones: generateRelationshipMilestones(interactions, relationshipLevel),
      },
    });
  } catch (error) {
    logger.error(`[enhancedGroomController] Error getting relationship details: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

// Helper functions

function getNextThreshold(currentLevel) {
  const levels = [0, 20, 50, 100, 200, 350, 500];
  return levels[currentLevel + 1] || null;
}

export function generateInteractionRecommendations(groom, horse, relationshipLevel) {
  const recommendations = [];

  // Based on relationship level
  if (relationshipLevel.level < 2) {
    recommendations.push({
      type: 'daily_care',
      variation: 'Thorough Inspection',
      reason: 'Build familiarity through consistent care',
    });
  }

  // Based on groom specialty
  // Equoria-9ty8: horse.age is game-years (post Equoria-son6). Previously
  // compared against 1095 (the day-count for 3 years), which after the son6
  // migration was always true (every horse < 1095 years), causing the foalCare
  // recommendation to fire for adult horses too. Foal-care window = 0-3 years.
  if (groom.speciality === 'foalCare' && horse.age < 3) {
    recommendations.push({
      type: 'enrichment',
      variation: 'Sensory Exploration',
      reason: 'Perfect match for foal care specialist',
    });
  }

  return recommendations;
}

function calculateRelationshipStats(interactions) {
  const totalInteractions = interactions.length;
  const totalBonding = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0);
  const averageQuality =
    interactions.length > 0 ? interactions.filter(i => i.quality).length / interactions.length : 0;

  const qualityDistribution = interactions.reduce((dist, i) => {
    if (i.quality) {
      dist[i.quality] = (dist[i.quality] || 0) + 1;
    }
    return dist;
  }, {});

  return {
    totalInteractions,
    totalBonding,
    averageQuality: Math.round(averageQuality * 100),
    qualityDistribution,
    firstInteraction: interactions[interactions.length - 1]?.timestamp || null,
    lastInteraction: interactions[0]?.timestamp || null,
  };
}

function generateRelationshipMilestones(interactions, currentLevel) {
  const milestones = [];

  if (interactions.length >= 1) {
    milestones.push({
      name: 'First Meeting',
      description: 'The beginning of a beautiful friendship',
      achieved: true,
      date: interactions[interactions.length - 1]?.timestamp,
    });
  }

  if (interactions.length >= 10) {
    milestones.push({
      name: 'Getting to Know Each Other',
      description: '10 interactions completed',
      achieved: true,
      date: interactions[interactions.length - 10]?.timestamp,
    });
  }

  if (currentLevel.level >= 3) {
    milestones.push({
      name: 'Trusted Companion',
      description: 'Reached trusted relationship level',
      achieved: true,
      date: null, // Would need to track when level was reached
    });
  }

  return milestones;
}
