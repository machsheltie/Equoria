/**
 * Enhanced Groom Controller
 * Handles advanced groom-horse interactions with rich relationship mechanics
 */

import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import {
  calculateEnhancedEffects,
  getAvailableInteractions,
  calculateRelationshipLevel,
  ENHANCED_INTERACTIONS,
} from '../../../services/enhancedGroomInteractions.mjs';
import { updateGroomSynergy } from '../../../services/groomProgressionService.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

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
          stressLevel: true,
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
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        interactionType: true,
        quality: true,
        bondingChange: true,
        stressChange: true,
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
          stressLevel: horse.stressLevel,
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
 * POST /api/grooms/enhanced/interact
 * Perform an enhanced interaction between groom and horse
 */
export async function performEnhancedInteraction(req, res) {
  try {
    const { groomId, horseId, interactionType, variation, duration, notes } = req.body;
    const userId = req.user?.id;

    logger.info(`[enhancedGroomController] Performing enhanced ${interactionType} interaction`);

    // Validate required fields
    if (!groomId || !horseId || !interactionType || !variation || !duration) {
      return res.status(400).json({
        success: false,
        message: 'groomId, horseId, interactionType, variation, and duration are required',
        data: null,
      });
    }

    // Validate interaction type
    const interactionKey = interactionType.toUpperCase();
    if (!ENHANCED_INTERACTIONS[interactionKey]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interaction type',
        data: null,
      });
    }

    // Check daily interaction limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysInteractions = await prisma.groomInteraction.findMany({
      where: {
        foalId: parseInt(horseId),
        timestamp: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (todaysInteractions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Horse has already had a groom interaction today',
        data: {
          dailyLimitReached: true,
          lastInteraction: todaysInteractions[todaysInteractions.length - 1],
        },
      });
    }

    // Validate groom ownership (atomic single-query validation)
    const groom = await findOwnedResource('groom', parseInt(groomId), userId);
    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found or not owned by user',
        data: null,
      });
    }

    // Validate horse ownership and fetch needed fields (atomic single-query validation)
    const horse = await prisma.horse.findFirst({
      where: {
        id: parseInt(horseId),
        userId,
      },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        // Equoria-ogmu: load Horse.age so consumers needing game-years see
        // the real DB value (not a day-count overwrite as in the pre-fix bug).
        age: true,
        bondScore: true,
        stressLevel: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found or not owned by user',
        data: null,
      });
    }

    // Equoria-yny4: horse.age is game-years (post Equoria-son6) and
    // enhancedGroomInteractions.mjs now reads it as game-years. The shadow
    // `horseForDayConsumers` object is no longer needed — pass horse directly.
    // The SELECT clause loads Horse.age so the service receives the real
    // game-year value.

    // Calculate enhanced effects
    const effects = calculateEnhancedEffects(groom, horse, interactionType, variation, duration);

    // Record the interaction
    const interaction = await prisma.groomInteraction.create({
      data: {
        foalId: parseInt(horseId),
        groomId: parseInt(groomId),
        interactionType: `${interactionType}_${variation.replace(/\s+/g, '_').toLowerCase()}`,
        duration,
        bondingChange: effects.bondingChange,
        stressChange: effects.stressChange,
        quality: effects.quality,
        cost: effects.cost,
        notes:
          notes ||
          `Enhanced ${interactionType}: ${variation}${effects.specialEvent ? ` - ${effects.specialEvent.name}!` : ''}`,
      },
    });

    // Update horse's bond score and stress level
    const newBondScore = Math.max(
      0,
      Math.min(100, (horse.bondScore || 50) + effects.bondingChange),
    );
    const newStressLevel = Math.max(
      0,
      Math.min(100, (horse.stressLevel || 0) + effects.stressChange),
    );

    await prisma.horse.update({
      where: { id: parseInt(horseId) },
      data: {
        bondScore: newBondScore,
        stressLevel: newStressLevel,
      },
    });

    // Equoria-5tjf: mirror Equoria-5v6g — every enhanced interaction also
    // increments sessionsTogether and (every 4th session) bumps synergyScore.
    try {
      await updateGroomSynergy(parseInt(groomId), parseInt(horseId), 'interaction_completed');
    } catch (synergyError) {
      logger.error(
        `[enhancedGroomController] Failed to update synergy for groom ${groomId} / horse ${horseId}: ${synergyError.message}`,
      );
    }

    // Check for relationship level change
    const oldLevel = calculateRelationshipLevel(horse.bondScore || 0);
    const newLevel = calculateRelationshipLevel(newBondScore);
    const levelUp = newLevel.level > oldLevel.level;

    logger.info(
      `[enhancedGroomController] Enhanced interaction completed: +${effects.bondingChange} bonding, ${effects.stressChange} stress`,
    );

    if (effects.specialEvent) {
      logger.info(`[enhancedGroomController] Special event occurred: ${effects.specialEvent.name}`);
    }

    if (levelUp) {
      logger.info(
        `[enhancedGroomController] Relationship level increased: ${oldLevel.name} -> ${newLevel.name}`,
      );
    }

    res.status(201).json({
      success: true,
      message: 'Enhanced interaction completed successfully',
      data: {
        interaction: {
          id: interaction.id,
          type: interactionType,
          variation: effects.variation,
          quality: effects.quality,
          duration,
          cost: effects.cost,
        },
        effects: {
          bondingChange: effects.bondingChange,
          stressChange: effects.stressChange,
          newBondScore,
          newStressLevel,
        },
        relationship: {
          oldLevel: oldLevel.name,
          newLevel: newLevel.name,
          levelUp,
          currentPoints: newBondScore,
          nextThreshold: getNextThreshold(newLevel.level),
        },
        specialEvent: effects.specialEvent,
        horse: {
          id: horse.id,
          name: horse.name,
          bondScore: newBondScore,
          stressLevel: newStressLevel,
        },
      },
    });
  } catch (error) {
    logger.error(
      `[enhancedGroomController] Error performing enhanced interaction: ${error.message}`,
    );
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
    // both groom and horse are guaranteed to exist AND be owned by req.user.
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

  // Based on stress level
  if (horse.stressLevel > 60) {
    recommendations.push({
      type: 'bonding_time',
      variation: 'Quiet Companionship',
      reason: 'High stress levels - calming interaction recommended',
    });
  }

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
