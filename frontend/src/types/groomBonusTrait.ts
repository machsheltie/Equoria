/**
 * Groom Bonus Trait Types for Story 7-7 (Show Handling & Rare Traits)
 *
 * Types and constants for the groom bonus trait system,
 * mirroring backend groomBonusTraitService.mjs.
 *
 * FR-R1: Display up to 3 bonus traits with names
 * FR-R2: Show bonus percentage per trait (max 30%)
 * FR-R3: Show eligibility requirements (bond > 60, coverage > 75%)
 * FR-R4: Display total rare trait probability bonus
 *
 * Business Rules:
 * - Maximum 3 bonus traits per groom
 * - Maximum 30% bonus per individual trait
 * - Bonus traits only apply to randomized traits (not guaranteed)
 * - Bonuses require bond > 60 and 75% assignment window coverage
 */

/** Map of trait name → bonus decimal (0 to 0.30) */
export type BonusTraitMap = Record<string, number>;

export interface GroomBonusTraitData {
  id: number;
  name: string;
  bonusTraitMap: BonusTraitMap | null;
}

export interface BonusTraitEntry {
  traitName: string;
  bonusDecimal: number; // 0 to 0.30
  bonusPercent: number; // 0 to 30
}

export interface BonusEligibility {
  eligible: boolean;
  averageBondScore: number; // needs >= 60
  coveragePercentage: number; // needs >= 0.75 (75%)
  reason: string;
}

/** Bonus trait system constraints (mirrors backend groomBonusTraitService.mjs) */
export const BONUS_TRAIT_CONSTANTS = {
  MAX_BONUS_TRAITS: 3,
  MAX_TRAIT_BONUS_DECIMAL: 0.3, // 30%
  MIN_BOND_SCORE: 60,
  MIN_COVERAGE_PERCENTAGE: 0.75, // 75%
} as const;

/**
 * Convert a BonusTraitMap to an array of BonusTraitEntry.
 */
export function getBonusTraitEntries(bonusTraitMap: BonusTraitMap | null): BonusTraitEntry[] {
  if (!bonusTraitMap) return [];
  return Object.entries(bonusTraitMap).map(([traitName, bonusDecimal]) => ({
    traitName,
    bonusDecimal,
    bonusPercent: Math.round(bonusDecimal * 100),
  }));
}

/**
 * Count how many bonus traits are assigned.
 */
export function countBonusTraits(bonusTraitMap: BonusTraitMap | null): number {
  if (!bonusTraitMap) return 0;
  return Object.keys(bonusTraitMap).length;
}

/**
 * Calculate total bonus probability across all assigned traits.
 */
export function getTotalBonusPercent(bonusTraitMap: BonusTraitMap | null): number {
  if (!bonusTraitMap) return 0;
  const total = Object.values(bonusTraitMap).reduce((sum, v) => sum + v, 0);
  return Math.round(total * 100);
}

/**
 * Format a bonus decimal as "+X%" string.
 */
export function formatBonusPercent(decimal: number): string {
  const pct = Math.round(decimal * 100);
  return `+${pct}%`;
}

/**
 * Check whether a bond score meets the minimum requirement.
 */
export function meetsBondRequirement(bondScore: number): boolean {
  return bondScore >= BONUS_TRAIT_CONSTANTS.MIN_BOND_SCORE;
}

/**
 * Check whether a coverage percentage meets the minimum requirement.
 */
export function meetsCoverageRequirement(coverageDecimal: number): boolean {
  return coverageDecimal >= BONUS_TRAIT_CONSTANTS.MIN_COVERAGE_PERCENTAGE;
}

/**
 * Get how many empty bonus trait slots remain.
 */
export function getRemainingSlots(bonusTraitMap: BonusTraitMap | null): number {
  return BONUS_TRAIT_CONSTANTS.MAX_BONUS_TRAITS - countBonusTraits(bonusTraitMap);
}

/**
 * Format coverage percentage for display (e.g. 0.85 → "85%").
 */
export function formatCoverage(coverageDecimal: number): string {
  return `${Math.round(coverageDecimal * 100)}%`;
}
