/**
 * Groom Legacy System Types for Story 7-5 (Legacy System UI)
 *
 * Defines types and constants for the groom mentorship/legacy system,
 * mirroring backend groomLegacyService.mjs.
 *
 * Legacy Rules:
 * - Only retired grooms at Advanced or above can mentor (the star level equivalent to
 *   the old level 7, owner ruling 2026-10-28, q229). Stars give no mentoring for now
 *   (q244): see staffCareerStarLevel in lib/staffLevels.
 * - Each retired groom can create one protégé
 * - Protégés inherit one perk from mentor's personality type
 * - Protégés start with bonus experience and skill bonus
 */

import { staffCareerStarLevel, staffLevelAtLeast } from '@/lib/staffLevels';

export interface LegacyPerk {
  id: string;
  name: string;
  description: string;
  effect: Record<string, number>;
}

export interface GroomLegacyData {
  id: number;
  name: string;
  starLevel: string;
  retired: boolean;
  groomPersonality: string; // 'calm', 'energetic', 'methodical', 'playful', 'strict'
  experience: number;
}

export interface MentorInfo {
  mentorId: number;
  mentorName: string;
  mentorStarLevel: string; // the mentor's star level
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
  MINIMUM_MENTOR_STAR_LEVEL: 'advanced',
  PROTEGE_EXPERIENCE_BONUS: 50,
  PROTEGE_SKILL_BONUS_PERCENT: 10, // 10% bonus to starting skills
} as const;

/**
 * All legacy perks organized by personality type.
 * Mirrors LEGACY_PERKS in backend groomLegacyService.mjs.
 */
export const LEGACY_PERKS_BY_PERSONALITY: Record<string, LegacyPerk[]> = {
  calm: [
    {
      id: 'gentleHands',
      name: 'Gentle Hands',
      description: 'Inherited gentle touch technique',
      effect: { bondingBonus: 0.05 },
    },
    {
      id: 'empathicSync',
      name: 'Empathic Sync',
      description: 'Natural ability to read horse emotions',
      effect: { milestoneAccuracy: 0.1, reactiveHorseBonus: 0.15 },
    },
    {
      id: 'patienceMastery',
      name: 'Patience Mastery',
      description: 'Exceptional patience with difficult horses',
      effect: { consistencyBonus: 0.1 },
    },
  ],
  energetic: [
    {
      id: 'playtimePro',
      name: 'Playtime Pro',
      description: 'Expert at engaging horses through play',
      effect: { milestoneVariety: 0.1, curiosityBonus: 0.15 },
    },
    {
      id: 'fearBuster',
      name: 'Fear Buster',
      description: 'Specialized in building horse confidence',
      effect: { braveryChance: 0.15, confidenceBonus: 0.2 },
    },
    {
      id: 'energyChanneling',
      name: 'Energy Channeling',
      description: 'Ability to direct horse energy positively',
      effect: { hyperactiveBonus: 0.2, focusImprovement: 0.1 },
    },
  ],
  methodical: [
    {
      id: 'dataDriven',
      name: 'Data Driven',
      description: 'Systematic approach to trait development',
      effect: { traitAccuracy: 0.05, analysisBonus: 0.1 },
    },
    {
      id: 'routineMastery',
      name: 'Routine Mastery',
      description: 'Perfect consistency in grooming routines',
      effect: { consistencyBonus: 0.15, taskEfficiency: 0.1 },
    },
    {
      id: 'precisionTouch',
      name: 'Precision Touch',
      description: 'Exact and careful handling technique',
      effect: { groomingQuality: 0.15, injuryPrevention: 0.1 },
    },
  ],
  playful: [
    {
      id: 'enrichmentExpert',
      name: 'Enrichment Expert',
      description: 'Master of fun and stimulating activities',
      effect: { enrichmentBonus: 0.2, bondingSpeed: 0.1 },
    },
    {
      id: 'curiositySpark',
      name: 'Curiosity Spark',
      description: 'Encourages natural horse curiosity',
      effect: { explorationBonus: 0.15, learningRate: 0.1 },
    },
    {
      id: 'joyOfWork',
      name: 'Joy of Work',
      description: 'Infectious enthusiasm for horse care',
      effect: { wellbeingBonus: 0.15, motivationBonus: 0.1 },
    },
  ],
  strict: [
    {
      id: 'disciplineFocus',
      name: 'Discipline Focus',
      description: 'Clear boundaries and structure for horses',
      effect: { obedienceBonus: 0.2, structureBonus: 0.1 },
    },
    {
      id: 'excellenceStandard',
      name: 'Excellence Standard',
      description: 'High standards in all grooming activities',
      effect: { qualityBonus: 0.15, showReadiness: 0.15 },
    },
    {
      id: 'performancePush',
      name: 'Performance Push',
      description: 'Drives horses to achieve peak performance',
      effect: { competitionBonus: 0.15, peakPerformance: 0.1 },
    },
  ],
};

/**
 * Check if a groom is eligible to create a legacy protégé.
 * Must be retired and at Advanced or above; the level read is staffCareerStarLevel
 * (q244: stars give no mentoring for now).
 */
export function checkLegacyEligibility(
  groom: GroomLegacyData,
  hasExistingProtégé: boolean
): LegacyEligibilityStatus {
  const reasons: string[] = [];

  if (!groom.retired) {
    reasons.push('Must be retired to mentor a protégé');
  }
  if (!staffLevelAtLeast(staffCareerStarLevel, LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL)) {
    reasons.push('Mentoring is not open yet');
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
