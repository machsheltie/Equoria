/**
 * Groom Talent Service
 *
 * This service handles the talent tree system where grooms can select
 * personality-based perks across 3 tiers to enhance their abilities.
 *
 * Talent Tree Rules:
 * - 3 tiers: Tier 1 (level 3+), Tier 2 (level 5+), Tier 3 (level 8+)
 * - Each tier has 2-3 talent choices per personality type
 * - Only one talent can be selected per tier
 * - Selections are permanent (no respec)
 * - Talents provide passive bonuses to groom interactions
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

/**
 * Talent tree requirements
 */
export const TALENT_REQUIREMENTS = {
  tier1: { minLevel: 3 },
  tier2: { minLevel: 5 },
  tier3: { minLevel: 8 },
};

/**
 * Talent tree definitions by personality type
 */
export const TALENT_TREES = {
  calm: {
    tier1: [
      {
        id: 'gentle_hands',
        name: 'Gentle Hands',
        description: '+5% bond gain from all interactions',
        effect: { bondingBonus: 0.05 },
      },
      {
        id: 'patience_virtue',
        name: 'Patience Virtue',
        description: '+10% consistency, reduced burnout chance',
        effect: { consistencyBonus: 0.1, burnoutResistance: 0.15 },
      },
    ],
    tier2: [
      {
        id: 'empathic_sync',
        name: 'Empathic Sync',
        description: 'Reduced stress in reactive foals, +15% milestone accuracy',
        effect: { reactiveHorseBonus: 0.15, milestoneAccuracy: 0.1 },
      },
      {
        id: 'stress_whisperer',
        name: 'Stress Whisperer',
        description: '+20% stress reduction effectiveness',
        effect: { stressReduction: 0.2 },
      },
    ],
    tier3: [
      {
        id: 'master_bonding',
        name: 'Master Bonding',
        description: '+10% bond gain, +25% synergy building rate',
        effect: { bondingBonus: 0.1, synergyRate: 0.25 },
      },
    ],
  },
  energetic: {
    tier1: [
      {
        id: 'playtime_pro',
        name: 'Playtime Pro',
        description: '+10% milestone variety score',
        effect: { milestoneVariety: 0.1 },
      },
      {
        id: 'enthusiasm_boost',
        name: 'Enthusiasm Boost',
        description: '+15% interaction quality, +5% XP gain',
        effect: { qualityBonus: 0.15, xpBonus: 0.05 },
      },
    ],
    tier2: [
      {
        id: 'fear_buster',
        name: 'Fear Buster',
        description: '+15% bravery trait chance, +20% confidence building',
        effect: { braveryChance: 0.15, confidenceBonus: 0.2 },
      },
      {
        id: 'energy_channeling',
        name: 'Energy Channeling',
        description: '+20% effectiveness with hyperactive horses',
        effect: { hyperactiveBonus: 0.2, focusImprovement: 0.1 },
      },
    ],
    tier3: [
      {
        id: 'inspiration_master',
        name: 'Inspiration Master',
        description: '+30% chance for exceptional interaction outcomes',
        effect: { exceptionalChance: 0.3, motivationBonus: 0.2 },
      },
    ],
  },
  methodical: {
    tier1: [
      {
        id: 'data_driven',
        name: 'Data Driven',
        description: '+5% trait shaping accuracy',
        effect: { traitAccuracy: 0.05 },
      },
      {
        id: 'systematic_approach',
        name: 'Systematic Approach',
        description: '+10% task completion efficiency',
        effect: { taskEfficiency: 0.1, timeBonus: 0.05 },
      },
    ],
    tier2: [
      {
        id: 'memory_builder',
        name: 'Memory Builder',
        description: '+20% synergy building rate, improved pattern recognition',
        effect: { synergyRate: 0.2, memoryBonus: 0.15 },
      },
      {
        id: 'precision_training',
        name: 'Precision Training',
        description: '+10% interaction quality, +15% precision bonus',
        effect: { taskQuality: 0.1, precisionBonus: 0.15 },
      },
    ],
    tier3: [
      {
        id: 'analytical_mastery',
        name: 'Analytical Mastery',
        description: '+15% trait accuracy, +25% milestone evaluation precision',
        effect: { traitAccuracy: 0.15, milestoneAccuracy: 0.25 },
      },
    ],
  },
};

/**
 * Get talent tree definitions for all personality types
 * @returns {Object} Complete talent tree structure
 */
export function getTalentTreeDefinitions() {
  return TALENT_TREES;
}

/**
 * Get talent selections for a specific groom
 * @param {number} groomId - ID of the groom
 * @returns {Promise<Object|null>} Talent selections or null if none exist
 */
export async function getGroomTalentSelections(groomId) {
  try {
    const selections = await prisma.groomTalentSelections.findUnique({
      where: { groomId },
    });

    return selections;
  } catch (error) {
    logger.error(`Error getting talent selections for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Validate a talent selection
 * @param {number} groomId - ID of the groom
 * @param {string} tier - Tier to select (tier1, tier2, tier3)
 * @param {string} talentId - ID of the talent to select
 * @returns {Promise<Object>} Validation result
 */
export async function validateTalentSelection(groomId, tier, talentId) {
  try {
    // Get groom details
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      include: {
        groomTalentSelections: true,
      },
    });

    if (!groom) {
      return {
        valid: false,
        reason: 'groom_not_found',
      };
    }

    // Check level requirements
    const requiredLevel = TALENT_REQUIREMENTS[tier]?.minLevel;
    if (!requiredLevel) {
      return {
        valid: false,
        reason: 'invalid_tier',
      };
    }

    if (groom.level < requiredLevel) {
      return {
        valid: false,
        reason: 'insufficient_level',
        groomLevel: groom.level,
        requiredLevel,
      };
    }

    // Check if talent exists for groom's personality
    const personalityTree = TALENT_TREES[groom.personality];
    if (!personalityTree || !personalityTree[tier]) {
      return {
        valid: false,
        reason: 'invalid_personality_tier',
      };
    }

    const availableTalents = personalityTree[tier];
    const talentExists = availableTalents.some(talent => talent.id === talentId);
    if (!talentExists) {
      return {
        valid: false,
        reason: 'invalid_talent',
      };
    }

    // Check if tier already selected
    const selections = groom.groomTalentSelections;
    if (selections && selections[tier]) {
      return {
        valid: false,
        reason: 'tier_already_selected',
        currentSelection: selections[tier],
      };
    }

    // Check prerequisites (must select lower tiers first)
    if (tier === 'tier2' && (!selections || !selections.tier1)) {
      return {
        valid: false,
        reason: 'prerequisite_required',
        prerequisite: 'tier1',
      };
    }

    if (tier === 'tier3' && (!selections || !selections.tier1 || !selections.tier2)) {
      return {
        valid: false,
        reason: 'prerequisite_required',
        prerequisite: selections?.tier1 ? 'tier2' : 'tier1',
      };
    }

    return {
      valid: true,
      groomLevel: groom.level,
      requiredLevel,
      talent: availableTalents.find(t => t.id === talentId),
    };

  } catch (error) {
    logger.error(`Error validating talent selection for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Select a talent for a groom
 * @param {number} groomId - ID of the groom
 * @param {string} tier - Tier to select (tier1, tier2, tier3)
 * @param {string} talentId - ID of the talent to select
 * @returns {Promise<Object>} Selection result
 */
export async function selectTalent(groomId, tier, talentId) {
  try {
    // Validate selection first
    const validation = await validateTalentSelection(groomId, tier, talentId);
    if (!validation.valid) {
      throw new Error(`Invalid talent selection: ${validation.reason}`);
    }

    // Create or update talent selections
    const selection = await prisma.groomTalentSelections.upsert({
      where: { groomId },
      update: {
        [tier]: talentId,
      },
      create: {
        groomId,
        [tier]: talentId,
      },
    });

    logger.info(`Groom ${groomId} selected talent ${talentId} for ${tier}`);

    return {
      success: true,
      selection,
      talent: validation.talent,
    };

  } catch (error) {
    logger.error(`Error selecting talent for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Apply talent effects to a groom interaction
 * @param {number} groomId - ID of the groom
 * @param {Object} baseInteraction - Base interaction data
 * @returns {Promise<Object>} Enhanced interaction with talent bonuses
 */
export async function applyTalentEffects(groomId, baseInteraction) {
  try {
    const selections = await getGroomTalentSelections(groomId);
    if (!selections) {
      return {
        ...baseInteraction,
        talentBonuses: [],
      };
    }

    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: { personality: true },
    });

    const personalityTree = TALENT_TREES[groom.personality];
    const talentBonuses = [];
    const enhancedInteraction = { ...baseInteraction };

    // Apply effects from each selected talent
    ['tier1', 'tier2', 'tier3'].forEach(tier => {
      const selectedTalentId = selections[tier];
      if (selectedTalentId && personalityTree[tier]) {
        const talent = personalityTree[tier].find(t => t.id === selectedTalentId);
        if (talent) {
          talentBonuses.push({
            tier,
            talentId: selectedTalentId,
            talentName: talent.name,
            effects: talent.effect,
          });

          // Apply bonding bonus
          if (talent.effect.bondingBonus) {
            const bonus = Math.ceil(enhancedInteraction.bondingChange * talent.effect.bondingBonus);
            enhancedInteraction.bondingChange += bonus;
          }

          // Apply stress reduction (make stress change more negative)
          if (talent.effect.stressReduction) {
            const reduction = Math.ceil(Math.abs(enhancedInteraction.stressChange) * talent.effect.stressReduction);
            enhancedInteraction.stressChange -= reduction;
          }

          // Apply quality bonus
          if (talent.effect.qualityBonus || talent.effect.taskQuality) {
            const qualityBonus = talent.effect.qualityBonus || talent.effect.taskQuality;
            // Quality improvement logic would be implemented here
            enhancedInteraction.qualityModifier = (enhancedInteraction.qualityModifier || 1) + qualityBonus;
          }
        }
      }
    });

    enhancedInteraction.talentBonuses = talentBonuses;
    return enhancedInteraction;

  } catch (error) {
    logger.error(`Error applying talent effects for groom ${groomId}:`, error);
    throw error;
  }
}

export default {
  getTalentTreeDefinitions,
  getGroomTalentSelections,
  selectTalent,
  validateTalentSelection,
  applyTalentEffects,
  TALENT_TREES,
  TALENT_REQUIREMENTS,
};
