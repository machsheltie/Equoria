/**
 * epigeneticFlagInfluence — unit tests (Equoria-rr7)
 *
 * Pure sync functions that consume getFlagDefinition from config.
 * No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyFlagInfluencesToTraitWeights,
  calculateBehaviorModifiers,
  applyFlagInfluencesToCompetition,
  applyFlagInfluencesToTraining,
  applyFlagInfluencesToBonding,
  getFlagInfluenceSummary,
} from '../../utils/epigeneticFlagInfluence.mjs';

// Known valid flag names from epigeneticFlagDefinitions:
//   brave      → competitionBonus: 0.15
//   confident  → competitionBonus: 0.10, trainingEfficiency: 0.05
//   affectionate → bondingRate: 0.15
//   fearful    → negative flag
const BRAVE = 'brave';
const CONFIDENT = 'confident';
const AFFECTIONATE = 'affectionate';
const FEARFUL = 'fearful';

// ---------------------------------------------------------------------------
// calculateBehaviorModifiers
// ---------------------------------------------------------------------------
describe('calculateBehaviorModifiers', () => {
  it('returns empty object for empty flags', () => {
    expect(calculateBehaviorModifiers([])).toEqual({});
  });

  it('returns empty object for null flags', () => {
    expect(calculateBehaviorModifiers(null)).toEqual({});
  });

  it('returns behavior modifiers for a known flag', () => {
    const mods = calculateBehaviorModifiers([BRAVE]);
    expect(typeof mods).toBe('object');
    expect(mods.competitionBonus).toBeGreaterThan(0);
  });

  it('stacks modifiers from multiple flags', () => {
    const single = calculateBehaviorModifiers([BRAVE]);
    const double = calculateBehaviorModifiers([BRAVE, CONFIDENT]);
    // Both have competitionBonus — double should be higher
    expect(double.competitionBonus).toBeGreaterThan(single.competitionBonus);
  });

  it('gracefully ignores unknown flags', () => {
    const mods = calculateBehaviorModifiers(['totally_made_up_flag']);
    expect(typeof mods).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// applyFlagInfluencesToTraitWeights
// ---------------------------------------------------------------------------
describe('applyFlagInfluencesToTraitWeights', () => {
  it('returns baseTraitWeights unchanged when no flags', () => {
    const weights = { resilient: 0.5, bold: 0.3 };
    expect(applyFlagInfluencesToTraitWeights([], weights)).toEqual(weights);
  });

  it('returns baseTraitWeights unchanged for null flags', () => {
    const weights = { resilient: 0.5 };
    expect(applyFlagInfluencesToTraitWeights(null, weights)).toEqual(weights);
  });

  it('returns an object (possibly modified) when valid flags given', () => {
    const weights = { resilient: 0.4, bold: 0.3 };
    const result = applyFlagInfluencesToTraitWeights([BRAVE], weights);
    expect(typeof result).toBe('object');
  });

  it('clamps modified weights to [0, 1]', () => {
    const weights = { resilient: 0.99 };
    const result = applyFlagInfluencesToTraitWeights([BRAVE], weights);
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('does not mutate the original weights', () => {
    const weights = { resilient: 0.5 };
    applyFlagInfluencesToTraitWeights([BRAVE], weights);
    expect(weights.resilient).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// applyFlagInfluencesToCompetition
// ---------------------------------------------------------------------------
describe('applyFlagInfluencesToCompetition', () => {
  it('returns base score unmodified when no flags', () => {
    const result = applyFlagInfluencesToCompetition(70, [], 'Racing');
    expect(result.modifiedScore).toBe(70);
    expect(result.totalModifier).toBe(0);
  });

  it('returns base score unmodified for null flags', () => {
    const result = applyFlagInfluencesToCompetition(70, null, 'Racing');
    expect(result.modifiedScore).toBe(70);
  });

  it('applies competition bonus from brave flag', () => {
    const result = applyFlagInfluencesToCompetition(100, [BRAVE], 'Racing');
    expect(result.modifiedScore).toBeGreaterThan(100);
    expect(result.totalModifier).toBeGreaterThan(0);
  });

  it('modifiedScore is never negative', () => {
    const result = applyFlagInfluencesToCompetition(0, [FEARFUL], 'Racing');
    expect(result.modifiedScore).toBeGreaterThanOrEqual(0);
  });

  it('returns shape with modifiedScore, appliedModifiers, totalModifier', () => {
    const result = applyFlagInfluencesToCompetition(50, [BRAVE], 'Racing');
    expect(result).toHaveProperty('modifiedScore');
    expect(result).toHaveProperty('appliedModifiers');
    expect(result).toHaveProperty('totalModifier');
  });
});

// ---------------------------------------------------------------------------
// applyFlagInfluencesToTraining
// ---------------------------------------------------------------------------
describe('applyFlagInfluencesToTraining', () => {
  it('returns base efficiency unmodified when no flags', () => {
    const result = applyFlagInfluencesToTraining(0.8, []);
    expect(result.modifiedEfficiency).toBe(0.8);
    expect(result.totalModifier).toBe(0);
  });

  it('applies training efficiency from confident flag', () => {
    const result = applyFlagInfluencesToTraining(0.5, [CONFIDENT]);
    expect(result.modifiedEfficiency).toBeGreaterThan(0.5);
  });

  it('modifiedEfficiency is clamped to [0, 1]', () => {
    const result = applyFlagInfluencesToTraining(0.99, [CONFIDENT]);
    expect(result.modifiedEfficiency).toBeLessThanOrEqual(1);
    const result2 = applyFlagInfluencesToTraining(0, [FEARFUL]);
    expect(result2.modifiedEfficiency).toBeGreaterThanOrEqual(0);
  });

  it('returns shape with modifiedEfficiency, appliedModifiers, totalModifier', () => {
    const result = applyFlagInfluencesToTraining(0.5, [CONFIDENT]);
    expect(result).toHaveProperty('modifiedEfficiency');
    expect(result).toHaveProperty('appliedModifiers');
    expect(result).toHaveProperty('totalModifier');
  });
});

// ---------------------------------------------------------------------------
// applyFlagInfluencesToBonding
// ---------------------------------------------------------------------------
describe('applyFlagInfluencesToBonding', () => {
  it('returns base bonding change unmodified when no flags', () => {
    const result = applyFlagInfluencesToBonding(5, []);
    expect(result.modifiedBondingChange).toBe(5);
  });

  it('applies bondingRate from affectionate flag', () => {
    const result = applyFlagInfluencesToBonding(10, [AFFECTIONATE]);
    expect(result.modifiedBondingChange).toBeGreaterThan(10);
  });

  it('returns shape with modifiedBondingChange, appliedModifiers, totalModifier', () => {
    const result = applyFlagInfluencesToBonding(5, [AFFECTIONATE]);
    expect(result).toHaveProperty('modifiedBondingChange');
    expect(result).toHaveProperty('appliedModifiers');
    expect(result).toHaveProperty('totalModifier');
  });

  it('returns base change for null flags', () => {
    const result = applyFlagInfluencesToBonding(3, null);
    expect(result.modifiedBondingChange).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getFlagInfluenceSummary
// ---------------------------------------------------------------------------
describe('getFlagInfluenceSummary', () => {
  it('returns zero-state summary for empty flags', () => {
    const summary = getFlagInfluenceSummary([]);
    expect(summary.flagCount).toBe(0);
    expect(summary.flags).toHaveLength(0);
    expect(typeof summary.summary).toBe('string');
  });

  it('returns zero-state summary for null', () => {
    const summary = getFlagInfluenceSummary(null);
    expect(summary.flagCount).toBe(0);
  });

  it('returns correct flagCount for known flags', () => {
    const summary = getFlagInfluenceSummary([BRAVE, FEARFUL]);
    expect(summary.flagCount).toBe(2);
  });

  it('returns shape with flagCount, flags, traitInfluences, behaviorModifiers, summary', () => {
    const summary = getFlagInfluenceSummary([BRAVE]);
    expect(summary).toHaveProperty('flagCount');
    expect(summary).toHaveProperty('flags');
    expect(summary).toHaveProperty('traitInfluences');
    expect(summary).toHaveProperty('behaviorModifiers');
    expect(summary).toHaveProperty('summary');
  });

  it('handles unknown flags gracefully (type: unknown)', () => {
    const summary = getFlagInfluenceSummary(['nonexistent_flag']);
    expect(summary.flagCount).toBe(1);
    expect(summary.flags[0].type).toBe('unknown');
  });
});
