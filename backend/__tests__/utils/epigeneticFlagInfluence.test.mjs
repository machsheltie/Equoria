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

// ---------------------------------------------------------------------------
// Branch-coverage additions (Equoria-jkht)
// Targets remaining uncovered branches in epigeneticFlagInfluence.mjs
// ---------------------------------------------------------------------------

describe('applyFlagInfluencesToTraitWeights — unknown flag warn (lines 37-38)', () => {
  it('skips and returns weights unchanged for an unrecognised flag name', () => {
    const base = { resilient: 0.5 };
    const result = applyFlagInfluencesToTraitWeights(['nonexistent_xyz_flag'], base);
    expect(result).toEqual({ resilient: 0.5 });
  });
});

describe('applyFlagInfluencesToTraitWeights — catch block (lines 62-63)', () => {
  it('returns original baseTraitWeights when forEach throws', () => {
    const evilFlags = {
      length: 1,
      forEach() {
        throw new Error('bomb');
      },
    };
    const base = { resilient: 0.5 };
    const result = applyFlagInfluencesToTraitWeights(evilFlags, base);
    expect(result).toBe(base);
  });
});

describe('calculateBehaviorModifiers — catch block (lines 104-107)', () => {
  it('returns empty object when forEach throws', () => {
    const evilFlags = {
      length: 1,
      forEach() {
        throw new Error('bomb');
      },
    };
    const result = calculateBehaviorModifiers(evilFlags);
    expect(result).toEqual({});
  });
});

describe('applyFlagInfluencesToCompetition — catch block (lines 170-173)', () => {
  it('returns fallback when arithmetic throws (Symbol baseScore)', () => {
    const bad = Symbol('bad');
    const result = applyFlagInfluencesToCompetition(bad, [BRAVE], 'Racing');
    expect(result.appliedModifiers).toEqual({});
    expect(result.totalModifier).toBe(0);
  });
});

describe('applyFlagInfluencesToTraining — bondingRate branch (lines 209-211)', () => {
  it('applies bondingRate bonus when affectionate flag is present', () => {
    const result = applyFlagInfluencesToTraining(0.5, [AFFECTIONATE]);
    expect(result.appliedModifiers).toHaveProperty('bondingBonus');
    expect(result.modifiedEfficiency).toBeGreaterThan(0.5);
  });
});

describe('applyFlagInfluencesToTraining — bondingResistance branch (lines 215-217)', () => {
  it('applies bondingResistance penalty when aloof flag is present', () => {
    const result = applyFlagInfluencesToTraining(0.8, ['aloof']);
    expect(result.appliedModifiers).toHaveProperty('bondingPenalty');
    expect(result.modifiedEfficiency).toBeLessThan(0.8);
  });
});

describe('applyFlagInfluencesToTraining — catch block (lines 232-233)', () => {
  it('returns fallback when arithmetic throws (Symbol baseEfficiency)', () => {
    const bad = Symbol('bad');
    const result = applyFlagInfluencesToTraining(bad, [CONFIDENT]);
    expect(result.appliedModifiers).toEqual({});
    expect(result.totalModifier).toBe(0);
  });
});

describe('applyFlagInfluencesToBonding — bondingResistance branch (lines 269-271)', () => {
  it('applies bondingResistance modifier when aloof flag is present', () => {
    const result = applyFlagInfluencesToBonding(10, ['aloof']);
    expect(result.appliedModifiers).toHaveProperty('bondingResistance');
    expect(result.modifiedBondingChange).toBeLessThan(10);
  });
});

describe('applyFlagInfluencesToBonding — catch block (lines 292-293)', () => {
  it('returns fallback when arithmetic throws (Symbol baseBondingChange)', () => {
    const bad = Symbol('bad');
    const result = applyFlagInfluencesToBonding(bad, [AFFECTIONATE]);
    expect(result.appliedModifiers).toEqual({});
    expect(result.totalModifier).toBe(0);
  });
});

describe('getFlagInfluenceSummary — catch block (lines 365-366)', () => {
  it('returns error summary when map() throws', () => {
    const evilFlags = {
      length: 2,
      map() {
        throw new Error('bomb');
      },
    };
    const result = getFlagInfluenceSummary(evilFlags);
    expect(result.summary).toBe('Error generating summary');
    expect(result.flags).toEqual([]);
    expect(result.flagCount).toBe(2);
  });
});

// ── Line 51 FALSE branch: modifier <= 0 → '' in logger.debug ternary (Equoria-jkht) ──
// `affectionate` has traitWeightModifiers: { antisocial: -0.4, withdrawn: -0.3, ... }
// Passing { antisocial: 0.5 } as baseTraitWeights ensures `modifiedWeights[traitName]`
// is defined, the logger.debug fires, and the ternary `modifier > 0 ? '+' : ''` takes
// its FALSE arm (-0.4 is not > 0 → '').

describe('applyFlagInfluencesToTraitWeights — logger.debug ternary FALSE arm (line 51) (Equoria-jkht)', () => {
  it("emits '' prefix (not +) in logger.debug when modifier is negative (affectionate antisocial=-0.4)", () => {
    // affectionate.traitWeightModifiers.antisocial = -0.4 → modifier <= 0 → FALSE arm
    const result = applyFlagInfluencesToTraitWeights(['affectionate'], { antisocial: 0.5 });
    // antisocial weight reduced by 0.4: max(0, 0.5 - 0.4) = 0.1
    expect(result.antisocial).toBeCloseTo(0.1, 5);
  });
});

// ── Line 274 both branches: groomEffectiveness present (TRUE) and absent (FALSE) ──
// TRUE arm: `affectionate` has groomEffectiveness:0.15 → if-body fires, property set.
// FALSE arm: `brave` has NO groomEffectiveness → condition is undefined (falsy) → if skipped.

describe('applyFlagInfluencesToBonding — groomEffectiveness branch TRUE + FALSE arms (line 274) (Equoria-jkht)', () => {
  it('sets appliedModifiers.groomEffectiveness when affectionate flag is present (TRUE arm)', () => {
    const result = applyFlagInfluencesToBonding(10, ['affectionate']);
    expect(result.appliedModifiers).toHaveProperty('groomEffectiveness');
    expect(result.appliedModifiers.groomEffectiveness).toBeCloseTo(10 * 0.15, 5);
  });

  it('does not set groomEffectiveness when brave flag is present (FALSE arm — brave has no groomEffectiveness)', () => {
    // brave.behaviorModifiers: { stressReduction, competitionBonus, statRecoveryBonus, stressResistance }
    // No groomEffectiveness → `if (behaviorModifiers.groomEffectiveness)` is false → skipped
    const result = applyFlagInfluencesToBonding(10, [BRAVE]);
    expect(result.appliedModifiers).not.toHaveProperty('groomEffectiveness');
    // modifiedBondingChange unchanged (brave has no bonding-specific modifiers)
    expect(result.modifiedBondingChange).toBe(10);
  });
});
