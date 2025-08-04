/**
 * Groom Rare Trait Perk System
 * Manages rare trait booster perks for grooms and their influence on ultra-rare/exotic trait acquisition
 * Implements the perk revelation mechanics and bonus calculations
 */

import prisma from '../db/index.mjs';
import logger from './logger.mjs';
import { ULTRA_RARE_TRAITS, EXOTIC_TRAITS } from './ultraRareTraits.mjs';

/**
 * Rare trait booster perk definitions
 * Maps groom personality/skill combinations to trait boost capabilities
 */
export const RARE_TRAIT_BOOSTER_PERKS = {
  // Ultra-rare trait boosters
  'phoenix-born-booster': {
    name: 'Phoenix Whisperer',
    description: 'Exceptional ability to guide horses through adversity and recovery',
    targetTrait: 'phoenix-born',
    baseBonus: 0.25, // +25% if base chance exists
    stackedBonus: 0.15, // +15% if multiple conditions met
    requiredTags: ['mindful', 'guardian'],
    requiredExperience: 5, // Years of experience
    revealCondition: 'after_2_successful_triggers',
  },

  'iron-will-forger': {
    name: 'Iron Will Forger',
    description: 'Masters the art of building unbreakable mental fortitude',
    targetTrait: 'iron-willed',
    baseBonus: 0.25,
    stackedBonus: 0.15,
    requiredTags: ['methodical', 'detail-oriented'],
    requiredExperience: 7,
    revealCondition: 'after_2_successful_triggers',
  },

  'empathy-weaver': {
    name: 'Empathy Weaver',
    description: 'Creates profound emotional connections between horse and handler',
    targetTrait: 'empathic-mirror',
    baseBonus: 0.25,
    stackedBonus: 0.15,
    requiredTags: ['soft-hearted', 'affectionate'],
    requiredExperience: 4,
    revealCondition: 'after_2_successful_triggers',
  },

  'leadership-cultivator': {
    name: 'Leadership Cultivator',
    description: 'Recognizes and nurtures natural leadership qualities',
    targetTrait: 'born-leader',
    baseBonus: 0.25,
    stackedBonus: 0.15,
    requiredTags: ['confident-leader'],
    requiredExperience: 6,
    revealCondition: 'after_2_successful_triggers',
  },

  'storm-caller': {
    name: 'Storm Caller',
    description: 'Channels chaotic energy into extraordinary potential',
    targetTrait: 'stormtouched',
    baseBonus: 0.25,
    stackedBonus: 0.15,
    requiredTags: ['novelty-trainer', 'reserved'],
    requiredExperience: 8,
    revealCondition: 'after_2_successful_triggers',
  },

  // Exotic trait boosters
  'shadow-guide': {
    name: 'Shadow Guide',
    description: 'Specializes in reaching isolated and withdrawn horses',
    targetTrait: 'shadow-follower',
    baseBonus: 0.2, // Lower bonus for exotic traits
    stackedBonus: 0.1,
    requiredTags: ['guardian-instinct'],
    requiredExperience: 6,
    revealCondition: 'after_2_successful_triggers',
  },

  'soul-binder': {
    name: 'Soul Binder',
    description: 'Creates transcendent bonds that last a lifetime',
    targetTrait: 'soulbonded',
    baseBonus: 0.2,
    stackedBonus: 0.1,
    requiredTags: ['bondsmith'],
    requiredExperience: 10,
    revealCondition: 'after_2_successful_triggers',
  },

  'fey-touched': {
    name: 'Fey-Touched',
    description: 'Blessed with otherworldly insight and mystical abilities',
    targetTrait: 'fey-kissed',
    baseBonus: 0.15, // Lower bonus due to extreme rarity
    stackedBonus: 0.08,
    requiredTags: ['any-with-3-rare-bonuses'],
    requiredExperience: 12,
    revealCondition: 'lineage_analysis_or_2_triggers',
  },

  'twin-harmonizer': {
    name: 'Twin Harmonizer',
    description: 'Understands and nurtures the mystical bond between twins',
    targetTrait: 'dreamtwin',
    baseBonus: 0.2,
    stackedBonus: 0.1,
    requiredTags: ['playful', 'soft-spoken'],
    requiredExperience: 5,
    revealCondition: 'after_2_successful_triggers',
  },
};

/**
 * Assign rare trait booster perks to a groom based on their characteristics
 * @param {number} groomId - ID of the groom
 * @param {Object} groomData - Groom data including personality, experience, etc.
 * @returns {Promise<Object>} Assigned perks
 */
export async function assignRareTraitBoosterPerks(groomId, groomData) {
  try {
    logger.info(`[groomRareTraitPerks] Assigning rare trait booster perks for groom ${groomId}`);

    const assignedPerks = {};

    // Evaluate each perk for assignment
    for (const [perkKey, perkDef] of Object.entries(RARE_TRAIT_BOOSTER_PERKS)) {
      const isEligible = evaluatePerkEligibility(groomData, perkDef);

      if (isEligible) {
        assignedPerks[perkKey] = {
          ...perkDef,
          assignedAt: new Date(),
          revealed: false, // Initially hidden
          triggerCount: 0,
        };

        logger.info(`[groomRareTraitPerks] Assigned perk: ${perkDef.name} to groom ${groomId}`);
      }
    }

    // Update groom's rare trait perks in database
    await prisma.groom.update({
      where: { id: groomId },
      data: {
        rareTraitPerks: assignedPerks,
      },
    });

    return assignedPerks;
  } catch (error) {
    logger.error(`[groomRareTraitPerks] Error assigning perks: ${error.message}`);
    throw error;
  }
}

/**
 * Evaluate if a groom is eligible for a specific rare trait booster perk
 * @param {Object} groomData - Groom characteristics
 * @param {Object} perkDef - Perk definition
 * @returns {boolean} True if eligible
 */
function evaluatePerkEligibility(groomData, perkDef) {
  // Check experience requirement
  if (groomData.experience < perkDef.requiredExperience) {
    return false;
  }

  // Check required tags
  const groomTags = groomData.personality?.tags || [];
  const { requiredTags } = perkDef;

  if (requiredTags.includes('any-with-3-rare-bonuses')) {
    // Special case: groom needs 3+ rare trait bonuses
    const rareTraitBonuses = Object.keys(groomData.bonusTraitMap || {}).filter(trait =>
      isRareTraitBonus(trait),
    );
    return rareTraitBonuses.length >= 3;
  }

  // Check if groom has all required tags
  return requiredTags.every(tag => groomTags.includes(tag));
}

/**
 * Check if a trait bonus is considered rare
 * @param {string} traitName - Name of the trait
 * @returns {boolean} True if rare
 */
function isRareTraitBonus(traitName) {
  const normalizedName = traitName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return Object.keys(ULTRA_RARE_TRAITS).includes(normalizedName) ||
         Object.keys(EXOTIC_TRAITS).includes(normalizedName);
}

/**
 * Apply rare trait booster effects to trait probability calculations
 * @param {string} traitName - Name of the trait being evaluated
 * @param {number} baseChance - Base probability of trait acquisition
 * @param {Object} groomData - Groom data with perks
 * @param {Object} conditions - Trigger conditions met
 * @returns {Object} Modified probability and perk info
 */
export function applyRareTraitBoosterEffects(traitName, baseChance, groomData, conditions = {}) {
  try {
    const normalizedTraitName = traitName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const groomPerks = groomData.rareTraitPerks || {};

    let modifiedChance = baseChance;
    const appliedPerks = [];

    // Find applicable perks for this trait
    for (const [perkKey, perkData] of Object.entries(groomPerks)) {
      const perkDef = RARE_TRAIT_BOOSTER_PERKS[perkKey];

      if (perkDef && perkDef.targetTrait === normalizedTraitName) {
        // Apply base bonus if base chance exists
        if (baseChance > 0) {
          modifiedChance += perkDef.baseBonus;
          appliedPerks.push({
            name: perkDef.name,
            bonus: perkDef.baseBonus,
            type: 'base_bonus',
          });
        }

        // Apply stacked bonus if multiple conditions are met
        const conditionCount = Object.values(conditions).filter(Boolean).length;
        if (conditionCount >= 2) {
          modifiedChance += perkDef.stackedBonus;
          appliedPerks.push({
            name: perkDef.name,
            bonus: perkDef.stackedBonus,
            type: 'stacked_bonus',
          });
        }

        // Track perk usage for revelation mechanics
        perkData.triggerCount = (perkData.triggerCount || 0) + 1;

        // Check if perk should be revealed
        if (!perkData.revealed && shouldRevealPerk(perkData, perkDef)) {
          perkData.revealed = true;
          logger.info(`[groomRareTraitPerks] Perk revealed: ${perkDef.name} for groom ${groomData.id}`);
        }
      }
    }

    // Cap the final probability at 100%
    modifiedChance = Math.min(modifiedChance, 1.0);

    return {
      originalChance: baseChance,
      modifiedChance,
      appliedPerks,
      perkBonus: modifiedChance - baseChance,
    };
  } catch (error) {
    logger.error(`[groomRareTraitPerks] Error applying booster effects: ${error.message}`);
    return {
      originalChance: baseChance,
      modifiedChance: baseChance,
      appliedPerks: [],
      perkBonus: 0,
    };
  }
}

/**
 * Check if a perk should be revealed to the player
 * @param {Object} perkData - Current perk data
 * @param {Object} perkDef - Perk definition
 * @returns {boolean} True if should be revealed
 */
function shouldRevealPerk(perkData, perkDef) {
  const triggerCount = perkData.triggerCount || 0;

  switch (perkDef.revealCondition) {
    case 'after_2_successful_triggers':
      return triggerCount >= 2;

    case 'lineage_analysis_or_2_triggers':
      // For now, just use trigger count (lineage analysis would be a future feature)
      return triggerCount >= 2;

    default:
      return triggerCount >= 2;
  }
}

/**
 * Get revealed perks for a groom
 * @param {number} groomId - ID of the groom
 * @returns {Promise<Array>} Array of revealed perks
 */
export async function getRevealedPerks(groomId) {
  try {
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: { rareTraitPerks: true },
    });

    if (!groom || !groom.rareTraitPerks) {
      return [];
    }

    const revealedPerks = [];

    for (const [perkKey, perkData] of Object.entries(groom.rareTraitPerks)) {
      if (perkData.revealed) {
        const perkDef = RARE_TRAIT_BOOSTER_PERKS[perkKey];
        revealedPerks.push({
          key: perkKey,
          name: perkDef.name,
          description: perkDef.description,
          targetTrait: perkDef.targetTrait,
          triggerCount: perkData.triggerCount,
          assignedAt: perkData.assignedAt,
        });
      }
    }

    return revealedPerks;
  } catch (error) {
    logger.error(`[groomRareTraitPerks] Error getting revealed perks: ${error.message}`);
    return [];
  }
}
