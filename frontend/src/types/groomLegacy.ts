/**
 * Groom Legacy System Types for Story 7-5 (Legacy System UI)
 *
 * Defines types and constants for the groom mentorship/legacy system.
 *
 * Legacy perks are NOT defined here (Equoria-gghoi): the backend's LEGACY_PERKS in
 * groomLegacyService.mjs is the only perk table, and the frontend shows only the perks
 * its responses carry - GET /api/v1/grooms/:id/legacy/eligibility `availablePerks` and
 * GET /api/v1/grooms/legacy/history `inheritedPerkDetail` - by their authored name and
 * description. A frontend copy drifted (different methodical perks, extra personalities
 * the game never defines) and showed perks the game never grants.
 *
 * Legacy Rules:
 * - Only retired grooms at Advanced or above can mentor (the star level equivalent to
 *   the old level 7, owner ruling 2026-10-28, q229). Stars give no mentoring for now
 *   (q244): see staffCareerStarLevel in lib/staffLevels.
 * - Each retired groom can create one protégé
 * - Protégés inherit one perk from mentor's personality type
 */

import { staffCareerStarLevel, staffLevelAtLeast } from '@/lib/staffLevels';

/** A legacy perk as the backend sends it to players: authored labels only. */
export interface LegacyPerk {
  id: string;
  name: string;
  description: string;
}

export interface GroomLegacyData {
  id: number;
  name: string;
  starLevel: string;
  retired: boolean;
  groomPersonality: string;
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
} as const;

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
