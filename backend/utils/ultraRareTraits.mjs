/**
 * Ultra-Rare & Exotic Traits System
 * Defines and manages ultra-rare and exotic traits with complex trigger conditions
 * and unique mechanical effects for prestige gameplay elements
 */

import logger from './logger.mjs';

/**
 * Ultra-Rare Traits Registry
 * These traits have <3% base chance and require specific conditions
 */
export const ULTRA_RARE_TRAITS = {
  'phoenix-born': {
    name: 'Phoenix-Born',
    rarity: 'ultra-rare',
    type: 'resilience',
    baseChance: 0.02, // 2% base chance
    description: 'Rises from adversity with extraordinary resilience and recovery abilities',

    // Trigger conditions
    triggerConditions: {
      minStressEvents: 3,
      minSuccessfulRecoveries: 2,
      evaluationWindow: 'birth_to_age_3',
    },

    // Mechanical effects
    mechanicalEffects: {
      stressDecayMultiplier: 1.3, // 30% faster stress decay
      burnoutRecoveryBonus: 0.57, // 4 days instead of 7 (57% reduction)
      stressResistance: 0.2, // 20% less stress from all sources
      competitionScoreModifier: 0.04, // +4% competition score
    },

    // Groom bonus tags that can boost this trait
    groomBonusTags: ['mindful', 'guardian'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['fragile', 'nervous'],
    stacksWith: ['resilient', 'calm'],
  },

  'iron-willed': {
    name: 'Iron-Willed',
    rarity: 'ultra-rare',
    type: 'mental',
    baseChance: 0.015, // 1.5% base chance
    description: 'Unbreakable mental fortitude and unwavering determination',

    // Trigger conditions
    triggerConditions: {
      noSkippedMilestones: true,
      noNegativeTraitsByAge3: true,
      minBondConsistency: 0.8,
    },

    // Mechanical effects
    mechanicalEffects: {
      burnoutImmunity: true, // Cannot be burned out
      trainingFatigueImmunity: true, // Ignores training fatigue
      staminaBonus: 5, // +5 stamina stat
      competitionStressResistance: 0.5, // 50% less stress in competitions
      trainingConsistencyBonus: 0.25, // 25% more consistent training
    },

    // Groom bonus tags
    groomBonusTags: ['methodical', 'detail-oriented'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['nervous', 'fragile', 'lazy'],
    stacksWith: ['disciplined', 'focused'],
  },

  'empathic-mirror': {
    name: 'Empathic Mirror',
    rarity: 'ultra-rare',
    type: 'social',
    baseChance: 0.025, // 2.5% base chance
    description: 'Forms deep emotional connections and mirrors the mood of companions',

    // Trigger conditions
    triggerConditions: {
      sameGroomFromBirth: true,
      highBondEntireTime: true,
      minBondScore: 80,
      ageRange: 'birth_to_age_3',
    },

    // Mechanical effects
    mechanicalEffects: {
      moodMirroring: true, // Adopts mood states of rider/companion
      pairEventBonus: 0.05, // +5% bonus in pair/team events
      bondingRateMultiplier: 1.4, // 40% faster bonding
      empathyBonus: true, // Special empathy interactions
      stressTransfer: 0.1, // Can absorb 10% of companion's stress
    },

    // Groom bonus tags
    groomBonusTags: ['soft-hearted', 'affectionate'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['antisocial', 'aggressive'],
    stacksWith: ['social', 'gentle'],
  },

  'born-leader': {
    name: 'Born Leader',
    rarity: 'ultra-rare',
    type: 'leadership',
    baseChance: 0.02, // 2% base chance
    description: 'Natural leadership abilities that inspire and guide other horses',

    // Trigger conditions
    triggerConditions: {
      topBondScore: true,
      steadyOrAssertiveTemperament: true,
      top3ConformationPlacements: true,
      leadershipMoments: 2,
    },

    // Mechanical effects
    mechanicalEffects: {
      groupTrainingBonus: 2, // +2 discipline to nearby horses in group training
      leadershipAura: true, // Provides bonuses to other horses
      confidenceBonus: 0.15, // +15% confidence in all situations
      competitionPresence: 0.03, // +3% score from commanding presence
      herdInfluence: true, // Can influence herd dynamics
    },

    // Groom bonus tags
    groomBonusTags: ['confident-leader'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['submissive', 'nervous'],
    stacksWith: ['confident', 'assertive'],
  },

  'stormtouched': {
    name: 'Stormtouched',
    rarity: 'ultra-rare',
    type: 'volatile',
    baseChance: 0.018, // 1.8% base chance
    description: 'Touched by chaos, bringing both great potential and increased volatility',

    // Trigger conditions
    triggerConditions: {
      reactiveTemperament: true,
      missedWeekOfCare: true,
      noveltyInteractionEvent: true,
      stressSpikes: 2,
    },

    // Mechanical effects
    mechanicalEffects: {
      statGrowthBonus: 0.1, // +10% stat growth in rider-assigned discipline
      stressGainMultiplier: 2.0, // 2x stress gain (double stress)
      performanceVolatility: 0.3, // 30% more variable performance
      noveltyBonus: 0.08, // +8% bonus with new experiences
      weatherSensitivity: true, // Affected by weather conditions
    },

    // Groom bonus tags
    groomBonusTags: ['novelty-trainer', 'reserved'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['calm', 'steady'],
    stacksWith: ['reactive', 'sensitive'],
  },
};

/**
 * Exotic Traits Registry
 * These traits require complex multi-factor conditions to unlock
 */
export const EXOTIC_TRAITS = {
  'shadow-follower': {
    name: 'Shadow-Follower',
    rarity: 'exotic',
    type: 'attachment',
    description: 'Forms intense but selective bonds, following one chosen companion',

    // Unlock conditions
    unlockConditions: {
      missedSocializationEvents: 2,
      lateBondFormation: true, // After age 2
      isolationPeriod: true,
      firstBondStrength: 'intense',
    },

    // Mechanical effects
    mechanicalEffects: {
      firstHandlerBondBonus: 10, // +10 bond growth with first bonded handler
      otherHandlerPenalty: -0.2, // -20% bond growth with others
      loyaltyBonus: 0.12, // +12% performance with bonded handler
      separationAnxiety: true, // Stress when separated from bonded handler
      exclusiveBonding: true, // Can only truly bond with one person
    },

    // Groom bonus tags
    groomBonusTags: ['guardian-instinct'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['social', 'outgoing'],
    stacksWith: ['loyal', 'selective'],
  },

  'ghostwalker': {
    name: 'Ghostwalker',
    rarity: 'exotic',
    type: 'detachment',
    description: 'Exists in emotional isolation, immune to stress but unable to form deep bonds',

    // Unlock conditions
    unlockConditions: {
      lowBondThroughoutYouth: true, // Bond < 30 throughout youth
      resilientFlag: true,
      emotionalDetachment: true,
      survivalMode: true,
    },

    // Mechanical effects
    mechanicalEffects: {
      stressImmunity: true, // Immune to stress
      bondCap: 60, // Cannot gain bond past 60
      reassignmentImpossible: true, // Cannot be reassigned once bonded
      emotionalDetachment: true, // Reduced emotional responses
      independenceBonus: 0.1, // +10% performance when working alone
    },

    // Groom bonus tags
    groomBonusTags: ['reserved', 'iron-willed-groom'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['social', 'empathic-mirror'],
    stacksWith: ['independent', 'resilient'],
  },

  'soulbonded': {
    name: 'Soulbonded',
    rarity: 'exotic',
    type: 'spiritual',
    description: 'Forms a transcendent bond with a single groom, achieving perfect harmony',

    // Unlock conditions
    unlockConditions: {
      sameGroomAllMilestones: true, // Same groom for all 4 milestones
      highBondAllMilestones: true, // >90 bond during each milestone
      perfectCareHistory: true,
      spiritualConnection: true,
    },

    // Mechanical effects
    mechanicalEffects: {
      sameGroomPerformanceBonus: 0.1, // +10% show performance with same groom/rider
      perfectHarmony: true, // Special harmony bonuses
      bondTranscendence: true, // Bond can exceed normal limits
      spiritualResilience: 0.25, // 25% stress resistance with bonded groom
      empathicHealing: true, // Can heal stress through bond
    },

    // Groom bonus tags
    groomBonusTags: ['bondsmith'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['antisocial', 'detached'],
    stacksWith: ['empathic-mirror', 'loyal'],
  },

  'fey-kissed': {
    name: 'Fey-Kissed',
    rarity: 'exotic',
    type: 'magical',
    description: 'Touched by otherworldly forces, radiating an ethereal presence and enhanced abilities',

    // Unlock conditions
    unlockConditions: {
      bothParentsUltraRare: true, // Both parents carry at least one ultra-rare trait
      perfectGroomingHistory: true, // Perfect grooming history in foal stage
      lineagePurity: true,
      mysticalAlignment: true,
    },

    // Mechanical effects
    mechanicalEffects: {
      allStatBonus: 3, // +3 to all base stats
      etherealAura: true, // Visual glowing aura effect
      mysticalResilience: 0.3, // 30% resistance to all negative effects
      feyMagic: true, // Special magical interactions
      presenceBonus: 0.06, // +6% competition score from ethereal presence
      weatherImmunity: true, // Immune to weather effects
    },

    // Groom bonus tags
    groomBonusTags: ['any-with-3-rare-bonuses'], // Any groom with 3+ rare trait bonuses

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: [], // No conflicts - transcends normal limitations
    stacksWith: ['all'], // Stacks with all other traits
  },

  'dreamtwin': {
    name: 'Dreamtwin',
    rarity: 'exotic',
    type: 'psychic',
    description: 'Shares a mystical connection with twin sibling, experiencing mirrored development',

    // Unlock conditions
    unlockConditions: {
      twinBirth: true, // Must be born as twin
      raisedTogether: true, // Raised together
      sameGroom: true, // Same groom for both twins
      matchingFlags: true, // Matching epigenetic flags
      psychicResonance: true,
    },

    // Mechanical effects
    mechanicalEffects: {
      mirroredStress: true, // Stress changes mirror between twins
      mirroredStats: true, // Stat changes mirror between twins
      mirroredBond: true, // Bond changes mirror between twins
      separationWeakening: true, // Weakened if separated from twin
      twinTelepathy: true, // Special twin communication
      doubleTraining: 0.5, // 50% bonus when training together
    },

    // Groom bonus tags
    groomBonusTags: ['playful', 'soft-spoken'],

    // Trait metadata
    category: 'epigenetic',
    isEpigenetic: true,
    conflicts: ['loner', 'independent'],
    stacksWith: ['social', 'empathic'],
  },
};

/**
 * Get trait definition by name from both ultra-rare and exotic registries
 * @param {string} traitName - Name of the trait to retrieve
 * @returns {Object|null} Trait definition or null if not found
 */
export function getUltraRareTraitDefinition(traitName) {
  const normalizedName = traitName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Check ultra-rare traits first
  if (ULTRA_RARE_TRAITS[normalizedName]) {
    return {
      ...ULTRA_RARE_TRAITS[normalizedName],
      tier: 'ultra-rare',
    };
  }

  // Check exotic traits
  if (EXOTIC_TRAITS[normalizedName]) {
    return {
      ...EXOTIC_TRAITS[normalizedName],
      tier: 'exotic',
    };
  }

  return null;
}

/**
 * Get all ultra-rare traits
 * @returns {Object} All ultra-rare trait definitions
 */
export function getAllUltraRareTraits() {
  return ULTRA_RARE_TRAITS;
}

/**
 * Get all exotic traits
 * @returns {Object} All exotic trait definitions
 */
export function getAllExoticTraits() {
  return EXOTIC_TRAITS;
}

/**
 * Check if a trait is ultra-rare or exotic
 * @param {string} traitName - Name of the trait to check
 * @returns {boolean} True if the trait is ultra-rare or exotic
 */
export function isUltraRareOrExotic(traitName) {
  return getUltraRareTraitDefinition(traitName) !== null;
}

/**
 * Get trait rarity tier
 * @param {string} traitName - Name of the trait
 * @returns {string|null} 'ultra-rare', 'exotic', or null if not found
 */
export function getTraitRarityTier(traitName) {
  const definition = getUltraRareTraitDefinition(traitName);
  return definition ? definition.tier : null;
}
