/**
 * Unit Tests for Trait Helper Functions
 *
 * Testing Sprint Day 1 - Helper Functions & Critical Logic
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - getTierStyle (tier styling classes)
 * - getEpigeneticFlagDisplay (flag display properties)
 * - getDiscoveryStatusDisplay (status display properties)
 * - calculateTotalImpact (sum discipline impacts)
 * - getBestDisciplines (top 3 positive impacts)
 * - getImpactColor (color class based on modifier)
 * - formatImpactModifier (modifier formatting with +/- prefix)
 * - calculateDiscoveryProgress (percentage calculation)
 * - getTierDisplayName (tier name with icon)
 * - sortTraitsByTier (exotic→common sorting)
 * - groupTraitsByTier (Map of grouped traits)
 * - checkSynergy (synergy bonus checking)
 * - calculateTotalImpactWithSynergies (impact with synergies)
 */

import { describe, it, expect } from 'vitest';
import type {
  TraitTier,
  CompetitionImpact,
  TraitDiscoveryStatus,
  EpigeneticTrait,
} from '../traits';
import {
  getTierStyle,
  getEpigeneticFlagDisplay,
  getDiscoveryStatusDisplay,
  calculateTotalImpact,
  getBestDisciplines,
  getImpactColor,
  formatImpactModifier,
  calculateDiscoveryProgress,
  getTierDisplayName,
  sortTraitsByTier,
  groupTraitsByTier,
  checkSynergy,
  calculateTotalImpactWithSynergies,
} from '../traits';

describe('getTierStyle', () => {
  it('should return exotic tier styling', () => {
    const style = getTierStyle('exotic');
    expect(style.borderColor).toBe('border-purple-400');
    expect(style.bgColor).toBe('bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50');
    expect(style.textColor).toBe('text-purple-700');
    expect(style.badgeColor).toBe('bg-purple-600 text-white');
  });

  it('should return ultra-rare tier styling', () => {
    const style = getTierStyle('ultra-rare');
    expect(style.borderColor).toBe('border-amber-400');
    expect(style.bgColor).toBe('bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50');
    expect(style.textColor).toBe('text-amber-700');
    expect(style.badgeColor).toBe('bg-amber-600 text-white');
  });

  it('should return rare tier styling', () => {
    const style = getTierStyle('rare');
    expect(style.borderColor).toBe('border-blue-300');
    expect(style.bgColor).toBe('bg-gradient-to-br from-blue-50 to-cyan-50');
    expect(style.textColor).toBe('text-blue-700');
    expect(style.badgeColor).toBe('bg-blue-600 text-white');
  });

  it('should return uncommon tier styling', () => {
    const style = getTierStyle('uncommon');
    expect(style.borderColor).toBe('border-green-300');
    expect(style.bgColor).toBe('bg-gradient-to-br from-green-50 to-emerald-50');
    expect(style.textColor).toBe('text-green-700');
    expect(style.badgeColor).toBe('bg-green-600 text-white');
  });

  it('should return common tier styling', () => {
    const style = getTierStyle('common');
    expect(style.borderColor).toBe('border-slate-300');
    expect(style.bgColor).toBe('bg-gradient-to-br from-slate-50 to-gray-50');
    expect(style.textColor).toBe('text-slate-700');
    expect(style.badgeColor).toBe('bg-slate-600 text-white');
  });
});

describe('getEpigeneticFlagDisplay', () => {
  it('should return genetic-only flag display', () => {
    const display = getEpigeneticFlagDisplay('genetic-only');
    expect(display.label).toBe('Genetic');
    expect(display.color).toBe('text-green-600 bg-green-50 border-green-200');
    expect(display.icon).toBe('🧬');
    expect(display.tooltip).toContain('inherited');
  });

  it('should return care-influenced flag display', () => {
    const display = getEpigeneticFlagDisplay('care-influenced');
    expect(display.label).toBe('Care-Influenced');
    expect(display.color).toBe('text-blue-600 bg-blue-50 border-blue-200');
    expect(display.icon).toBe('❤️');
    expect(display.tooltip).toContain('care quality');
  });

  it('should return stress-induced flag display', () => {
    const display = getEpigeneticFlagDisplay('stress-induced');
    expect(display.label).toBe('Stress-Induced');
    expect(display.color).toBe('text-amber-600 bg-amber-50 border-amber-200');
    expect(display.icon).toBe('⚡');
    expect(display.tooltip).toContain('stress');
  });

  it('should return milestone-triggered flag display', () => {
    const display = getEpigeneticFlagDisplay('milestone-triggered');
    expect(display.label).toBe('Milestone-Triggered');
    expect(display.color).toBe('text-purple-600 bg-purple-50 border-purple-200');
    expect(display.icon).toBe('🎯');
    expect(display.tooltip).toContain('milestone');
  });
});

describe('getDiscoveryStatusDisplay', () => {
  it('should return discovered status display', () => {
    const display = getDiscoveryStatusDisplay('discovered');
    expect(display.label).toBe('Discovered');
    expect(display.color).toBe('text-green-600');
    expect(display.icon).toBe('✓');
  });

  it('should return partially_discovered status display', () => {
    const display = getDiscoveryStatusDisplay('partially_discovered');
    expect(display.label).toBe('Partially Discovered');
    expect(display.color).toBe('text-yellow-600');
    expect(display.icon).toBe('◐');
  });

  it('should return hidden status display', () => {
    const display = getDiscoveryStatusDisplay('hidden');
    expect(display.label).toBe('Hidden');
    expect(display.color).toBe('text-slate-400');
    expect(display.icon).toBe('?');
  });
});

describe('calculateTotalImpact', () => {
  it('should sum all positive discipline impacts', () => {
    const impact: CompetitionImpact = {
      dressage: 3,
      show_jumping: 5,
      cross_country: 4,
      endurance: 3,
      racing: 4,
      western: 2,
    };
    expect(calculateTotalImpact(impact)).toBe(21);
  });

  it('should handle mixed positive and negative impacts', () => {
    const impact: CompetitionImpact = {
      dressage: 3,
      show_jumping: -2,
      cross_country: 4,
      endurance: -1,
      racing: 0,
      western: 2,
    };
    expect(calculateTotalImpact(impact)).toBe(6);
  });

  it('should handle all zero impacts', () => {
    const impact: CompetitionImpact = {
      dressage: 0,
      show_jumping: 0,
      cross_country: 0,
      endurance: 0,
      racing: 0,
      western: 0,
    };
    expect(calculateTotalImpact(impact)).toBe(0);
  });

  it('should handle all negative impacts', () => {
    const impact: CompetitionImpact = {
      dressage: -1,
      show_jumping: -2,
      cross_country: -3,
      endurance: -1,
      racing: -2,
      western: -1,
    };
    expect(calculateTotalImpact(impact)).toBe(-10);
  });
});

describe('getBestDisciplines', () => {
  it('should return top 3 disciplines sorted by modifier', () => {
    const impact: CompetitionImpact = {
      dressage: 3,
      show_jumping: 5,
      cross_country: 4,
      endurance: 3,
      racing: 4,
      western: 2,
    };
    const best = getBestDisciplines(impact);
    expect(best).toHaveLength(3);
    expect(best[0].discipline).toBe('Show Jumping');
    expect(best[0].modifier).toBe(5);
    expect(best[1].discipline).toBe('Cross Country');
    expect(best[1].modifier).toBe(4);
    expect(best[2].discipline).toBe('Racing');
    expect(best[2].modifier).toBe(4);
  });

  it('should only return positive impacts', () => {
    const impact: CompetitionImpact = {
      dressage: 5,
      show_jumping: -2,
      cross_country: 3,
      endurance: -1,
      racing: 0,
      western: 1,
    };
    const best = getBestDisciplines(impact);
    expect(best).toHaveLength(3);
    expect(best.every((d) => d.modifier > 0)).toBe(true);
    expect(best[0].modifier).toBe(5);
    expect(best[1].modifier).toBe(3);
    expect(best[2].modifier).toBe(1);
  });

  it('should return empty array when no positive impacts', () => {
    const impact: CompetitionImpact = {
      dressage: -1,
      show_jumping: -2,
      cross_country: 0,
      endurance: -1,
      racing: 0,
      western: -1,
    };
    const best = getBestDisciplines(impact);
    expect(best).toHaveLength(0);
  });

  it('should handle fewer than 3 positive impacts', () => {
    const impact: CompetitionImpact = {
      dressage: 5,
      show_jumping: 3,
      cross_country: 0,
      endurance: -1,
      racing: 0,
      western: -1,
    };
    const best = getBestDisciplines(impact);
    expect(best).toHaveLength(2);
    expect(best[0].modifier).toBe(5);
    expect(best[1].modifier).toBe(3);
  });

  it('should handle ties in modifiers', () => {
    const impact: CompetitionImpact = {
      dressage: 5,
      show_jumping: 5,
      cross_country: 5,
      endurance: 3,
      racing: 3,
      western: 3,
    };
    const best = getBestDisciplines(impact);
    expect(best).toHaveLength(3);
    expect(best.every((d) => d.modifier === 5)).toBe(true);
  });
});

describe('getImpactColor', () => {
  it('should return text-green-600 for modifiers >= 5', () => {
    expect(getImpactColor(5)).toBe('text-green-600');
    expect(getImpactColor(10)).toBe('text-green-600');
  });

  it('should return text-green-500 for modifiers 2-4', () => {
    expect(getImpactColor(2)).toBe('text-green-500');
    expect(getImpactColor(4)).toBe('text-green-500');
  });

  it('should return text-blue-500 for modifiers 1', () => {
    expect(getImpactColor(1)).toBe('text-blue-500');
  });

  it('should return text-slate-400 for zero modifier', () => {
    expect(getImpactColor(0)).toBe('text-slate-400');
  });

  it('should return text-amber-500 for modifiers -1 to -2', () => {
    expect(getImpactColor(-1)).toBe('text-amber-500');
    expect(getImpactColor(-2)).toBe('text-amber-500');
  });

  it('should return text-orange-500 for modifiers -3 to -5', () => {
    expect(getImpactColor(-3)).toBe('text-orange-500');
    expect(getImpactColor(-5)).toBe('text-orange-500');
  });

  it('should return text-red-600 for modifiers < -5', () => {
    expect(getImpactColor(-6)).toBe('text-red-600');
    expect(getImpactColor(-10)).toBe('text-red-600');
  });
});

describe('formatImpactModifier', () => {
  it('should format positive modifiers with + prefix', () => {
    expect(formatImpactModifier(5)).toBe('+5');
    expect(formatImpactModifier(1)).toBe('+1');
    expect(formatImpactModifier(10)).toBe('+10');
  });

  it('should format negative modifiers without extra prefix', () => {
    expect(formatImpactModifier(-5)).toBe('-5');
    expect(formatImpactModifier(-1)).toBe('-1');
    expect(formatImpactModifier(-10)).toBe('-10');
  });

  it('should format zero as 0', () => {
    expect(formatImpactModifier(0)).toBe('0');
  });
});

describe('calculateDiscoveryProgress', () => {
  it('should calculate percentage correctly', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 3,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 6,
      discoveryProgress: 0, // Will be calculated
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(35); // (3 + 0.5*1) / 10 * 100
  });

  it('should handle 0% discovery', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 0,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 10,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(0);
  });

  it('should handle 100% discovery', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 10,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 0,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(100);
  });

  it('should handle partial discoveries correctly', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 5,
      partiallyDiscoveredTraits: 4,
      hiddenTraits: 1,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(70); // (5 + 0.5*4) / 10 * 100
  });

  it('should round to nearest integer', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 3,
      discoveredTraits: 1,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 1,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(50); // (1 + 0.5*1) / 3 * 100 = 50
  });

  it('should handle zero total traits', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 0,
      discoveredTraits: 0,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 0,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(0);
  });
});

describe('getTierDisplayName', () => {
  it('should return exotic tier name with icon', () => {
    expect(getTierDisplayName('exotic')).toBe('👑 Exotic');
  });

  it('should return ultra-rare tier name with icon', () => {
    expect(getTierDisplayName('ultra-rare')).toBe('✨ Ultra-Rare');
  });

  it('should return rare tier name with icon', () => {
    expect(getTierDisplayName('rare')).toBe('💎 Rare');
  });

  it('should return uncommon tier name with icon', () => {
    expect(getTierDisplayName('uncommon')).toBe('🔹 Uncommon');
  });

  it('should return common tier name with icon', () => {
    expect(getTierDisplayName('common')).toBe('⚪ Common');
  });
});

describe('sortTraitsByTier', () => {
  const createTrait = (id: string, tier: TraitTier): EpigeneticTrait => ({
    id,
    name: `Trait ${id}`,
    tier,
    category: 'Physical',
    description: 'Test trait',
    discoveryStatus: 'discovered',
    epigeneticFlags: [],
    competitionImpact: {
      dressage: 0,
      show_jumping: 0,
      cross_country: 0,
      endurance: 0,
      racing: 0,
      western: 0,
    },
    isPositive: true,
  });

  it('should sort traits from exotic to common', () => {
    const traits: EpigeneticTrait[] = [
      createTrait('1', 'common'),
      createTrait('2', 'exotic'),
      createTrait('3', 'rare'),
      createTrait('4', 'uncommon'),
      createTrait('5', 'ultra-rare'),
    ];
    const sorted = sortTraitsByTier(traits);
    expect(sorted[0].tier).toBe('exotic');
    expect(sorted[1].tier).toBe('ultra-rare');
    expect(sorted[2].tier).toBe('rare');
    expect(sorted[3].tier).toBe('uncommon');
    expect(sorted[4].tier).toBe('common');
  });

  it('should handle all same tier', () => {
    const traits: EpigeneticTrait[] = [
      createTrait('1', 'rare'),
      createTrait('2', 'rare'),
      createTrait('3', 'rare'),
    ];
    const sorted = sortTraitsByTier(traits);
    expect(sorted).toHaveLength(3);
    expect(sorted.every((t) => t.tier === 'rare')).toBe(true);
  });

  it('should handle empty array', () => {
    const sorted = sortTraitsByTier([]);
    expect(sorted).toHaveLength(0);
  });

  it('should not mutate original array', () => {
    const traits: EpigeneticTrait[] = [createTrait('1', 'common'), createTrait('2', 'exotic')];
    const original = [...traits];
    sortTraitsByTier(traits);
    expect(traits).toEqual(original);
  });
});

describe('groupTraitsByTier', () => {
  const createTrait = (id: string, tier: TraitTier): EpigeneticTrait => ({
    id,
    name: `Trait ${id}`,
    tier,
    category: 'Physical',
    description: 'Test trait',
    discoveryStatus: 'discovered',
    epigeneticFlags: [],
    competitionImpact: {
      dressage: 0,
      show_jumping: 0,
      cross_country: 0,
      endurance: 0,
      racing: 0,
      western: 0,
    },
    isPositive: true,
  });

  it('should group traits by tier into Map', () => {
    const traits: EpigeneticTrait[] = [
      createTrait('1', 'common'),
      createTrait('2', 'exotic'),
      createTrait('3', 'rare'),
      createTrait('4', 'common'),
      createTrait('5', 'exotic'),
    ];
    const grouped = groupTraitsByTier(traits);
    expect(grouped.get('common')).toHaveLength(2);
    expect(grouped.get('exotic')).toHaveLength(2);
    expect(grouped.get('rare')).toHaveLength(1);
    expect(grouped.get('uncommon')).toBeUndefined();
    expect(grouped.get('ultra-rare')).toBeUndefined();
  });

  it('should handle empty array', () => {
    const grouped = groupTraitsByTier([]);
    expect(grouped.size).toBe(0);
  });

  it('should handle single tier', () => {
    const traits: EpigeneticTrait[] = [
      createTrait('1', 'rare'),
      createTrait('2', 'rare'),
      createTrait('3', 'rare'),
    ];
    const grouped = groupTraitsByTier(traits);
    expect(grouped.size).toBe(1);
    expect(grouped.get('rare')).toHaveLength(3);
  });

  it('should handle all tiers', () => {
    const traits: EpigeneticTrait[] = [
      createTrait('1', 'common'),
      createTrait('2', 'uncommon'),
      createTrait('3', 'rare'),
      createTrait('4', 'ultra-rare'),
      createTrait('5', 'exotic'),
    ];
    const grouped = groupTraitsByTier(traits);
    expect(grouped.size).toBe(5);
    expect(grouped.get('common')).toHaveLength(1);
    expect(grouped.get('uncommon')).toHaveLength(1);
    expect(grouped.get('rare')).toHaveLength(1);
    expect(grouped.get('ultra-rare')).toHaveLength(1);
    expect(grouped.get('exotic')).toHaveLength(1);
  });
});

describe('checkSynergy', () => {
  it('should return matching synergy when all required traits present', () => {
    const trait: EpigeneticTrait = {
      id: 'phoenix-born',
      name: 'Phoenix-Born',
      tier: 'exotic',
      category: 'Mental',
      description: 'Test trait',
      discoveryStatus: 'discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 7,
        show_jumping: 8,
        cross_country: 9,
        endurance: 7,
        racing: 8,
        western: 6,
        synergyBonuses: [
          {
            requiredTraitIds: ['resilient-spirit', 'athletic-prowess'],
            bonusDisciplines: ['show_jumping', 'cross_country'],
            bonusAmount: 3,
            description: 'Perfect Storm',
          },
        ],
      },
      isPositive: true,
    };
    const otherTraitIds = ['resilient-spirit', 'athletic-prowess', 'calm-temperament'];
    const synergy = checkSynergy(trait, otherTraitIds);
    expect(synergy).not.toBeNull();
    expect(synergy?.description).toBe('Perfect Storm');
  });

  it('should return null when required traits missing', () => {
    const trait: EpigeneticTrait = {
      id: 'phoenix-born',
      name: 'Phoenix-Born',
      tier: 'exotic',
      category: 'Mental',
      description: 'Test trait',
      discoveryStatus: 'discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 7,
        show_jumping: 8,
        cross_country: 9,
        endurance: 7,
        racing: 8,
        western: 6,
        synergyBonuses: [
          {
            requiredTraitIds: ['resilient-spirit', 'athletic-prowess'],
            bonusDisciplines: ['show_jumping', 'cross_country'],
            bonusAmount: 3,
            description: 'Perfect Storm',
          },
        ],
      },
      isPositive: true,
    };
    const otherTraitIds = ['resilient-spirit']; // Missing 'athletic-prowess'
    const synergy = checkSynergy(trait, otherTraitIds);
    expect(synergy).toBeNull();
  });

  it('should return null when no synergy bonuses defined', () => {
    const trait: EpigeneticTrait = {
      id: 'basic-trait',
      name: 'Basic Trait',
      tier: 'common',
      category: 'Physical',
      description: 'Test trait',
      discoveryStatus: 'discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 1,
        show_jumping: 0,
        cross_country: 0,
        endurance: 0,
        racing: 0,
        western: 0,
      },
      isPositive: true,
    };
    const otherTraitIds = ['some-other-trait'];
    const synergy = checkSynergy(trait, otherTraitIds);
    expect(synergy).toBeNull();
  });

  it('should return first matching synergy when multiple present', () => {
    const trait: EpigeneticTrait = {
      id: 'multi-synergy',
      name: 'Multi Synergy',
      tier: 'rare',
      category: 'Mental',
      description: 'Test trait',
      discoveryStatus: 'discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 3,
        show_jumping: 3,
        cross_country: 3,
        endurance: 3,
        racing: 3,
        western: 3,
        synergyBonuses: [
          {
            requiredTraitIds: ['trait-a'],
            bonusDisciplines: ['dressage'],
            bonusAmount: 2,
            description: 'Synergy A',
          },
          {
            requiredTraitIds: ['trait-b'],
            bonusDisciplines: ['racing'],
            bonusAmount: 3,
            description: 'Synergy B',
          },
        ],
      },
      isPositive: true,
    };
    const otherTraitIds = ['trait-a', 'trait-b'];
    const synergy = checkSynergy(trait, otherTraitIds);
    expect(synergy).not.toBeNull();
    expect(synergy?.description).toBe('Synergy A'); // Returns first match
  });
});

describe('calculateTotalImpactWithSynergies', () => {
  const createBasicTrait = (id: string): EpigeneticTrait => ({
    id,
    name: `Trait ${id}`,
    tier: 'common',
    category: 'Physical',
    description: 'Test trait',
    discoveryStatus: 'discovered',
    epigeneticFlags: [],
    competitionImpact: {
      dressage: 0,
      show_jumping: 0,
      cross_country: 0,
      endurance: 0,
      racing: 0,
      western: 0,
    },
    isPositive: true,
  });

  it('should return base impact without synergies', () => {
    const trait: EpigeneticTrait = {
      ...createBasicTrait('test'),
      competitionImpact: {
        dressage: 3,
        show_jumping: 5,
        cross_country: 4,
        endurance: 3,
        racing: 4,
        western: 2,
      },
    };
    const otherTraits: EpigeneticTrait[] = [];
    const impact = calculateTotalImpactWithSynergies(trait, otherTraits);
    expect(impact.dressage).toBe(3);
    expect(impact.show_jumping).toBe(5);
    expect(impact.cross_country).toBe(4);
    expect(impact.endurance).toBe(3);
    expect(impact.racing).toBe(4);
    expect(impact.western).toBe(2);
  });

  it('should add synergy bonuses when conditions met', () => {
    const trait: EpigeneticTrait = {
      ...createBasicTrait('phoenix-born'),
      competitionImpact: {
        dressage: 7,
        show_jumping: 8,
        cross_country: 9,
        endurance: 7,
        racing: 8,
        western: 6,
        synergyBonuses: [
          {
            requiredTraitIds: ['resilient-spirit', 'athletic-prowess'],
            bonusDisciplines: ['show_jumping', 'cross_country'],
            bonusAmount: 3,
            description: 'Perfect Storm',
          },
        ],
      },
    };
    const otherTraits: EpigeneticTrait[] = [
      createBasicTrait('resilient-spirit'),
      createBasicTrait('athletic-prowess'),
    ];
    const impact = calculateTotalImpactWithSynergies(trait, otherTraits);
    expect(impact.dressage).toBe(7);
    expect(impact.show_jumping).toBe(11); // 8 + 3 synergy
    expect(impact.cross_country).toBe(12); // 9 + 3 synergy
    expect(impact.endurance).toBe(7);
    expect(impact.racing).toBe(8);
    expect(impact.western).toBe(6);
  });

  it('should not add synergy bonuses when conditions not met', () => {
    const trait: EpigeneticTrait = {
      ...createBasicTrait('phoenix-born'),
      competitionImpact: {
        dressage: 7,
        show_jumping: 8,
        cross_country: 9,
        endurance: 7,
        racing: 8,
        western: 6,
        synergyBonuses: [
          {
            requiredTraitIds: ['resilient-spirit', 'athletic-prowess'],
            bonusDisciplines: ['show_jumping', 'cross_country'],
            bonusAmount: 3,
            description: 'Perfect Storm',
          },
        ],
      },
    };
    const otherTraits: EpigeneticTrait[] = [
      createBasicTrait('resilient-spirit'),
      // Missing 'athletic-prowess'
    ];
    const impact = calculateTotalImpactWithSynergies(trait, otherTraits);
    expect(impact.dressage).toBe(7);
    expect(impact.show_jumping).toBe(8); // No synergy
    expect(impact.cross_country).toBe(9); // No synergy
    expect(impact.endurance).toBe(7);
    expect(impact.racing).toBe(8);
    expect(impact.western).toBe(6);
  });

  it('should handle first matching synergy only', () => {
    const trait: EpigeneticTrait = {
      ...createBasicTrait('multi-synergy'),
      competitionImpact: {
        dressage: 5,
        show_jumping: 5,
        cross_country: 5,
        endurance: 5,
        racing: 5,
        western: 5,
        synergyBonuses: [
          {
            requiredTraitIds: ['trait-a'],
            bonusDisciplines: ['dressage', 'show_jumping'],
            bonusAmount: 2,
            description: 'Synergy A',
          },
          {
            requiredTraitIds: ['trait-b'],
            bonusDisciplines: ['racing', 'western'],
            bonusAmount: 3,
            description: 'Synergy B',
          },
        ],
      },
    };
    const otherTraits: EpigeneticTrait[] = [
      createBasicTrait('trait-a'),
      createBasicTrait('trait-b'),
    ];
    const impact = calculateTotalImpactWithSynergies(trait, otherTraits);
    // Only first matching synergy (Synergy A) is applied
    expect(impact.dressage).toBe(7); // 5 + 2
    expect(impact.show_jumping).toBe(7); // 5 + 2
    expect(impact.cross_country).toBe(5);
    expect(impact.endurance).toBe(5);
    expect(impact.racing).toBe(5); // No Synergy B applied
    expect(impact.western).toBe(5); // No Synergy B applied
  });

  it('should handle empty other traits array', () => {
    const trait: EpigeneticTrait = {
      ...createBasicTrait('test'),
      competitionImpact: {
        dressage: 3,
        show_jumping: 5,
        cross_country: 4,
        endurance: 3,
        racing: 4,
        western: 2,
      },
    };
    const impact = calculateTotalImpactWithSynergies(trait, []);
    expect(impact.dressage).toBe(3);
    expect(impact.show_jumping).toBe(5);
    expect(impact.cross_country).toBe(4);
  });
});
