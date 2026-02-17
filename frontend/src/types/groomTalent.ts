/**
 * Groom Talent Tree Types for Story 7-6 (Talent Tree Visualization)
 *
 * Defines types and constants for the groom talent system,
 * mirroring backend groomTalentService.mjs.
 *
 * Talent Tree Rules:
 * - 3 tiers: Tier 1 (level 3+), Tier 2 (level 5+), Tier 3 (level 8+)
 * - Each tier has 2 talent choices (Tier 3 may have 1)
 * - Only one talent can be selected per tier
 * - Selections are permanent (no respec)
 * - Must select lower tiers before higher tiers
 */

export interface TalentEffect {
  [key: string]: number;
}

export interface Talent {
  id: string;
  name: string;
  description: string;
  effect: TalentEffect;
}

export interface TalentTier {
  tier1: Talent[];
  tier2: Talent[];
  tier3: Talent[];
}

export interface TalentSelections {
  tier1?: string | null; // Selected talent ID for tier 1
  tier2?: string | null;
  tier3?: string | null;
}

export interface TalentWithState extends Talent {
  isSelected: boolean;
  isAvailable: boolean; // Level requirement met
  isLocked: boolean; // Prerequisite tier not yet selected
}

export interface TalentTierWithState {
  tierKey: 'tier1' | 'tier2' | 'tier3';
  label: string;
  minLevel: number;
  talents: TalentWithState[];
  isUnlocked: boolean; // Level meets minimum requirement
  selectedTalentId: string | null;
  prerequisiteMet: boolean; // Lower tiers selected
}

export interface GroomTalentData {
  id: number;
  name: string;
  level: number;
  groomPersonality: string;
  talentSelections: TalentSelections | null;
}

/** Talent tier requirements mirroring backend groomTalentService.mjs */
export const TALENT_REQUIREMENTS = {
  tier1: { minLevel: 3, label: 'Tier 1 — Apprentice', prerequisite: null },
  tier2: { minLevel: 5, label: 'Tier 2 — Journeyman', prerequisite: 'tier1' as const },
  tier3: { minLevel: 8, label: 'Tier 3 — Master', prerequisite: 'tier2' as const },
} as const;

/**
 * All talent trees by personality type.
 * Mirrors TALENT_TREES in backend groomTalentService.mjs.
 */
export const TALENT_TREES: Record<string, TalentTier> = {
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
 * Get the talent tier list for a given personality, resolved with state.
 * Determines which talents are available, locked, or selected.
 */
export function getTalentTiersWithState(
  personality: string,
  level: number,
  selections: TalentSelections | null
): TalentTierWithState[] {
  const tree = TALENT_TREES[personality];
  if (!tree) return [];

  const tiers: Array<'tier1' | 'tier2' | 'tier3'> = ['tier1', 'tier2', 'tier3'];

  return tiers.map((tierKey) => {
    const req = TALENT_REQUIREMENTS[tierKey];
    const isUnlocked = level >= req.minLevel;
    const prerequisite = req.prerequisite;
    const prerequisiteMet = prerequisite === null || !!(selections && selections[prerequisite]);

    const selectedTalentId = selections?.[tierKey] ?? null;

    const talents: TalentWithState[] = (tree[tierKey] ?? []).map((talent) => ({
      ...talent,
      isSelected: selectedTalentId === talent.id,
      isAvailable: isUnlocked && prerequisiteMet && !selectedTalentId,
      isLocked: !isUnlocked || !prerequisiteMet,
    }));

    return {
      tierKey,
      label: req.label,
      minLevel: req.minLevel,
      talents,
      isUnlocked,
      selectedTalentId,
      prerequisiteMet,
    };
  });
}

/**
 * Format a talent effect for display.
 * e.g. { bondingBonus: 0.05 } → '+5% Bonding Bonus'
 */
export function formatTalentEffect(key: string, value: number): string {
  const percent = Math.round(value * 100);
  const sign = value >= 0 ? '+' : '';
  const label = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
  return `${sign}${percent}% ${label}`;
}

/**
 * Count total talent points allocated for a groom.
 */
export function countAllocatedTalents(selections: TalentSelections | null): number {
  if (!selections) return 0;
  return [selections.tier1, selections.tier2, selections.tier3].filter(Boolean).length;
}
