/**
 * Groom Legacy System Types for Story 7-5 (Legacy System UI)
 *
 * Defines types and constants for the groom mentorship/legacy system,
 * mirroring backend groomLegacyService.mjs.
 *
 * Legacy Rules:
 * - Only retired grooms at level 7+ can mentor
 * - Each retired groom can create one protégé
 * - Protégés inherit one perk from mentor's personality type
 * - Protégés start with bonus XP, level, and skill bonus
 */

export interface LegacyPerk {
  id: string;
  name: string;
  description: string;
  effect: Record<string, number>;
}

export interface GroomLegacyData {
  id: number;
  name: string;
  level: number;
  retired: boolean;
  groomPersonality: string; // 'calm', 'energetic', 'methodical', 'playful', 'strict'
  experience: number;
}

export interface MentorInfo {
  mentorId: number;
  mentorName: string;
  mentorLevel: number; // Level of mentor at time of mentorship
  mentorPersonality: string;
  inheritedPerk: LegacyPerk;
  mentorshipDate: string; // ISO timestamp
}

export interface ProtégéInfo {
  protégéId: number;
  protégéName: string;
  inheritedPerk: LegacyPerk;
  createdAt: string; // ISO timestamp
}

export interface LegacyEligibilityStatus {
  isEligible: boolean;
  reasons: string[]; // Why ineligible (if any)
  hasCreatedProtégé: boolean;
}

/** Legacy system constants mirroring backend groomLegacyService.mjs */
export const LEGACY_CONSTANTS = {
  MINIMUM_MENTOR_LEVEL: 7,
  PROTEGE_EXPERIENCE_BONUS: 50,
  PROTEGE_LEVEL_BONUS: 1,
  PROTEGE_SKILL_BONUS_PERCENT: 10, // 10% bonus to starting skills
} as const;

/**
 * All legacy perks organized by personality type.
 * Mirrors LEGACY_PERKS in backend groomLegacyService.mjs.
 */
export const LEGACY_PERKS_BY_PERSONALITY: Record<string, LegacyPerk[]> = {
  calm: [
    {
      id: 'gentle_hands',
      name: 'Gentle Hands',
      description: 'Inherited gentle touch technique',
      effect: { bondingBonus: 0.05, stressReduction: 0.1 },
    },
    {
      id: 'empathic_sync',
      name: 'Empathic Sync',
      description: 'Natural ability to read horse emotions',
      effect: { milestoneAccuracy: 0.1, reactiveHorseBonus: 0.15 },
    },
    {
      id: 'patience_mastery',
      name: 'Patience Mastery',
      description: 'Exceptional patience with difficult horses',
      effect: { burnoutResistance: 0.2, consistencyBonus: 0.1 },
    },
  ],
  energetic: [
    {
      id: 'playtime_pro',
      name: 'Playtime Pro',
      description: 'Expert at engaging horses through play',
      effect: { milestoneVariety: 0.1, curiosityBonus: 0.15 },
    },
    {
      id: 'fear_buster',
      name: 'Fear Buster',
      description: 'Specialized in building horse confidence',
      effect: { braveryChance: 0.15, confidenceBonus: 0.2 },
    },
    {
      id: 'energy_channeling',
      name: 'Energy Channeling',
      description: 'Ability to direct horse energy positively',
      effect: { hyperactiveBonus: 0.2, focusImprovement: 0.1 },
    },
  ],
  methodical: [
    {
      id: 'data_driven',
      name: 'Data Driven',
      description: 'Systematic approach to trait development',
      effect: { traitAccuracy: 0.05, analysisBonus: 0.1 },
    },
    {
      id: 'routine_mastery',
      name: 'Routine Mastery',
      description: 'Perfect consistency in grooming routines',
      effect: { consistencyBonus: 0.15, taskEfficiency: 0.1 },
    },
    {
      id: 'precision_touch',
      name: 'Precision Touch',
      description: 'Exact and careful handling technique',
      effect: { groomingQuality: 0.15, injuryPrevention: 0.1 },
    },
  ],
  playful: [
    {
      id: 'enrichment_expert',
      name: 'Enrichment Expert',
      description: 'Master of fun and stimulating activities',
      effect: { enrichmentBonus: 0.2, bondingSpeed: 0.1 },
    },
    {
      id: 'curiosity_spark',
      name: 'Curiosity Spark',
      description: 'Encourages natural horse curiosity',
      effect: { explorationBonus: 0.15, learningRate: 0.1 },
    },
    {
      id: 'joy_of_work',
      name: 'Joy of Work',
      description: 'Infectious enthusiasm for horse care',
      effect: { wellbeingBonus: 0.15, motivationBonus: 0.1 },
    },
  ],
  strict: [
    {
      id: 'discipline_focus',
      name: 'Discipline Focus',
      description: 'Clear boundaries and structure for horses',
      effect: { obedienceBonus: 0.2, structureBonus: 0.1 },
    },
    {
      id: 'excellence_standard',
      name: 'Excellence Standard',
      description: 'High standards in all grooming activities',
      effect: { qualityBonus: 0.15, showReadiness: 0.15 },
    },
    {
      id: 'performance_push',
      name: 'Performance Push',
      description: 'Drives horses to achieve peak performance',
      effect: { competitionBonus: 0.15, peakPerformance: 0.1 },
    },
  ],
};

/**
 * Check if a groom is eligible to create a legacy protégé.
 * Must be retired and at level 7+.
 */
export function checkLegacyEligibility(
  groom: GroomLegacyData,
  hasExistingProtégé: boolean
): LegacyEligibilityStatus {
  const reasons: string[] = [];

  if (!groom.retired) {
    reasons.push('Must be retired to mentor a protégé');
  }
  if (groom.level < LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL) {
    reasons.push(`Must reach Level ${LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL} to mentor`);
  }
  if (hasExistingProtégé) {
    reasons.push('Already mentored a protégé');
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
    hasCreatedProtégé: hasExistingProtégé,
  };
}

/**
 * Get the available perks a groom could pass to a protégé
 * based on their personality type.
 */
export function getAvailablePerksForPersonality(personality: string): LegacyPerk[] {
  return LEGACY_PERKS_BY_PERSONALITY[personality] ?? [];
}

/**
 * Format a perk effect for display.
 * e.g. { bondingBonus: 0.05 } → '+5% Bonding'
 */
export function formatPerkEffect(key: string, value: number): string {
  const percent = Math.round(value * 100);
  const sign = value >= 0 ? '+' : '';
  const label = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
  return `${sign}${percent}% ${label}`;
}
