/**
 * ultraRareMechanicalEffects — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required. Uses real trait definitions from ultraRareTraits.mjs.
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyUltraRareStressEffects,
  applyUltraRareStressDecayEffects,
  applyUltraRareTrainingEffects,
  applyUltraRareCompetitionEffects,
  applyUltraRareBondingEffects,
  applyUltraRareBurnoutEffects,
  applyUltraRareStatEffects,
  hasUltraRareAbility,
} from '../../../utils/ultraRareMechanicalEffects.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const noTraits = () => ({ ultraRareTraits: { ultraRare: [], exotic: [] } });
const withUltraRare = (...names) => ({
  ultraRareTraits: { ultraRare: names.map(n => ({ name: n })), exotic: [] },
});
const withExotic = (...names) => ({
  ultraRareTraits: { ultraRare: [], exotic: names.map(n => ({ name: n })) },
});

// ---------------------------------------------------------------------------
// applyUltraRareStressEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareStressEffects', () => {
  it('returns result with expected shape', () => {
    const result = applyUltraRareStressEffects(noTraits(), 50);
    expect(result).toHaveProperty('originalStress');
    expect(result).toHaveProperty('modifiedStress');
    expect(result).toHaveProperty('appliedEffects');
    expect(result).toHaveProperty('totalReduction');
  });

  it('no traits → stress unchanged, no applied effects', () => {
    const result = applyUltraRareStressEffects(noTraits(), 100);
    expect(result.modifiedStress).toBe(100);
    expect(result.appliedEffects).toEqual([]);
    expect(result.totalReduction).toBe(0);
  });

  it('missing ultraRareTraits field → stress unchanged', () => {
    const result = applyUltraRareStressEffects({}, 80);
    expect(result.modifiedStress).toBe(80);
    expect(result.appliedEffects).toEqual([]);
  });

  it('phoenix-born stressResistance reduces stress by 20%', () => {
    const horse = withUltraRare('phoenix-born');
    const result = applyUltraRareStressEffects(horse, 100);
    // stressResistance: 0.2 → reduction = 100 * 0.2 = 20
    expect(result.modifiedStress).toBe(80);
    expect(result.totalReduction).toBe(20);
    expect(result.appliedEffects.some(e => e.effect === 'stress_resistance')).toBe(true);
  });

  it('stormtouched stressGainMultiplier doubles stress', () => {
    const horse = withUltraRare('stormtouched');
    const result = applyUltraRareStressEffects(horse, 100);
    // stressGainMultiplier: 2.0 → increase = 100 * (2.0-1) = 100 → modifiedStress = 200
    expect(result.modifiedStress).toBe(200);
    expect(result.totalReduction).toBe(-100);
    expect(result.appliedEffects.some(e => e.effect === 'stress_gain_multiplier')).toBe(true);
  });

  it('ghostwalker stressImmunity zeros out stress', () => {
    const horse = withExotic('ghostwalker');
    const result = applyUltraRareStressEffects(horse, 75);
    expect(result.modifiedStress).toBe(0);
    expect(result.totalReduction).toBe(75);
    expect(result.appliedEffects.some(e => e.effect === 'stress_immunity')).toBe(true);
  });

  it('iron-willed competitionStressResistance applies only for competition source', () => {
    const horse = withUltraRare('iron-willed');
    const generalResult = applyUltraRareStressEffects(horse, 100, 'general');
    const compResult = applyUltraRareStressEffects(horse, 100, 'competition');
    // competitionStressResistance: 0.5 → 50% reduction on competition
    expect(compResult.modifiedStress).toBeLessThan(generalResult.modifiedStress);
    expect(compResult.appliedEffects.some(e => e.effect === 'competition_stress_resistance')).toBe(true);
  });

  it('stress cannot go below 0', () => {
    const horse = withUltraRare('phoenix-born');
    const result = applyUltraRareStressEffects(horse, 0);
    expect(result.modifiedStress).toBe(0);
  });

  it('unknown trait name is skipped gracefully', () => {
    const horse = { ultraRareTraits: { ultraRare: [{ name: 'nonexistent-trait' }], exotic: [] } };
    const result = applyUltraRareStressEffects(horse, 50);
    expect(result.modifiedStress).toBe(50);
    expect(result.appliedEffects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyUltraRareStressDecayEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareStressDecayEffects', () => {
  it('no traits → decay unchanged', () => {
    const result = applyUltraRareStressDecayEffects(noTraits(), 10);
    expect(result.modifiedDecay).toBe(10);
    expect(result.totalBonus).toBe(0);
    expect(result.appliedEffects).toEqual([]);
  });

  it('phoenix-born stressDecayMultiplier adds 30% bonus decay', () => {
    const horse = withUltraRare('phoenix-born');
    const result = applyUltraRareStressDecayEffects(horse, 10);
    // stressDecayMultiplier: 1.3 → bonus = 10 * (1.3-1) = 3
    expect(result.modifiedDecay).toBe(13);
    expect(result.totalBonus).toBe(3);
    expect(result.appliedEffects.some(e => e.effect === 'stress_decay_multiplier')).toBe(true);
  });

  it('returns shape with originalDecay and appliedEffects', () => {
    const result = applyUltraRareStressDecayEffects(noTraits(), 5);
    expect(result).toHaveProperty('originalDecay', 5);
    expect(result).toHaveProperty('modifiedDecay');
    expect(result).toHaveProperty('appliedEffects');
    expect(result).toHaveProperty('totalBonus');
  });
});

// ---------------------------------------------------------------------------
// applyUltraRareTrainingEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareTrainingEffects', () => {
  it('no traits → training data unchanged', () => {
    const data = { stat: 'speed', amount: 2 };
    const result = applyUltraRareTrainingEffects(noTraits(), data);
    expect(result.modifiedTrainingData).toEqual(data);
    expect(result.appliedEffects).toEqual([]);
  });

  it('iron-willed grants trainingFatigueImmunity', () => {
    const horse = withUltraRare('iron-willed');
    const result = applyUltraRareTrainingEffects(horse, {});
    expect(result.modifiedTrainingData.fatigueImmune).toBe(true);
    expect(result.appliedEffects.some(e => e.effect === 'training_fatigue_immunity')).toBe(true);
  });

  it('iron-willed adds trainingConsistencyBonus 0.25', () => {
    const horse = withUltraRare('iron-willed');
    const result = applyUltraRareTrainingEffects(horse, {});
    expect(result.modifiedTrainingData.consistencyBonus).toBe(0.25);
  });

  it('stormtouched adds statGrowthBonus 0.1', () => {
    const horse = withUltraRare('stormtouched');
    const result = applyUltraRareTrainingEffects(horse, {});
    expect(result.modifiedTrainingData.statGrowthBonus).toBe(0.1);
    expect(result.appliedEffects.some(e => e.effect === 'stat_growth_bonus')).toBe(true);
  });

  it('born-leader groupTrainingBonus only applies when isGroupTraining=true', () => {
    const horse = withUltraRare('born-leader');
    const noGroup = applyUltraRareTrainingEffects(horse, { isGroupTraining: false });
    const withGroup = applyUltraRareTrainingEffects(horse, { isGroupTraining: true });
    expect(noGroup.modifiedTrainingData.groupBonus).toBeUndefined();
    expect(withGroup.modifiedTrainingData.groupBonus).toBe(2);
  });

  it('dreamtwin doubleTraining bonus only applies when withTwin=true', () => {
    const horse = withExotic('dreamtwin');
    const noTwin = applyUltraRareTrainingEffects(horse, { withTwin: false });
    const hasTwin = applyUltraRareTrainingEffects(horse, { withTwin: true });
    expect(noTwin.modifiedTrainingData.twinBonus).toBeUndefined();
    expect(hasTwin.modifiedTrainingData.twinBonus).toBe(0.5);
  });

  it('result has originalTrainingData, modifiedTrainingData, appliedEffects', () => {
    const data = { stat: 'speed' };
    const result = applyUltraRareTrainingEffects(noTraits(), data);
    expect(result).toHaveProperty('originalTrainingData');
    expect(result).toHaveProperty('modifiedTrainingData');
    expect(result).toHaveProperty('appliedEffects');
  });
});

// ---------------------------------------------------------------------------
// applyUltraRareCompetitionEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareCompetitionEffects', () => {
  it('no traits → score unchanged', () => {
    const result = applyUltraRareCompetitionEffects(noTraits(), 100);
    expect(result.modifiedScore).toBe(100);
    expect(result.totalBonus).toBe(0);
    expect(result.appliedEffects).toEqual([]);
  });

  it('phoenix-born competitionScoreModifier adds 4%', () => {
    const horse = withUltraRare('phoenix-born');
    const result = applyUltraRareCompetitionEffects(horse, 100);
    expect(result.modifiedScore).toBeCloseTo(104);
    expect(result.totalBonus).toBeCloseTo(4);
    expect(result.appliedEffects.some(e => e.effect === 'competition_score_modifier')).toBe(true);
  });

  it('fey-kissed presenceBonus adds 6%', () => {
    const horse = withExotic('fey-kissed');
    const result = applyUltraRareCompetitionEffects(horse, 100);
    expect(result.modifiedScore).toBeCloseTo(106);
  });

  it('born-leader competitionPresence adds 3%', () => {
    const horse = withUltraRare('born-leader');
    const result = applyUltraRareCompetitionEffects(horse, 100);
    expect(result.modifiedScore).toBeCloseTo(103);
    expect(result.appliedEffects.some(e => e.effect === 'competition_presence')).toBe(true);
  });

  it('empathic-mirror pairEventBonus only when isPairEvent=true', () => {
    const horse = withUltraRare('empathic-mirror');
    const noPair = applyUltraRareCompetitionEffects(horse, 100, {});
    const isPair = applyUltraRareCompetitionEffects(horse, 100, { isPairEvent: true });
    expect(noPair.modifiedScore).toBe(100);
    expect(isPair.modifiedScore).toBeCloseTo(105);
  });

  it('ghostwalker independenceBonus only when workingAlone=true', () => {
    const horse = withExotic('ghostwalker');
    const notAlone = applyUltraRareCompetitionEffects(horse, 100, {});
    const alone = applyUltraRareCompetitionEffects(horse, 100, { workingAlone: true });
    expect(notAlone.modifiedScore).toBe(100);
    expect(alone.modifiedScore).toBeCloseTo(110);
  });

  it('shadow-follower loyaltyBonus only when withBondedHandler=true', () => {
    const horse = withExotic('shadow-follower');
    const result = applyUltraRareCompetitionEffects(horse, 100, { withBondedHandler: true });
    expect(result.modifiedScore).toBeCloseTo(112);
  });

  it('soulbonded sameGroomPerformanceBonus only when withSameGroom=true', () => {
    const horse = withExotic('soulbonded');
    const result = applyUltraRareCompetitionEffects(horse, 100, { withSameGroom: true });
    expect(result.modifiedScore).toBeCloseTo(110);
  });

  it('stormtouched noveltyBonus only when newExperience=true', () => {
    const horse = withUltraRare('stormtouched');
    const result = applyUltraRareCompetitionEffects(horse, 100, { newExperience: true });
    expect(result.modifiedScore).toBeCloseTo(108);
  });

  it('result has originalScore, modifiedScore, appliedEffects, totalBonus', () => {
    const result = applyUltraRareCompetitionEffects(noTraits(), 80);
    expect(result).toHaveProperty('originalScore', 80);
    expect(result).toHaveProperty('modifiedScore');
    expect(result).toHaveProperty('appliedEffects');
    expect(result).toHaveProperty('totalBonus');
  });
});

// ---------------------------------------------------------------------------
// applyUltraRareBondingEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareBondingEffects', () => {
  it('no traits → bond change unchanged', () => {
    const result = applyUltraRareBondingEffects(noTraits(), 10);
    expect(result.modifiedBondChange).toBe(10);
    expect(result.totalModification).toBe(0);
  });

  it('empathic-mirror bondingRateMultiplier adds 40% to bond change', () => {
    const horse = withUltraRare('empathic-mirror');
    const result = applyUltraRareBondingEffects(horse, 10);
    // bonus = 10 * (1.4 - 1) = 4 → modifiedBondChange = 14
    expect(result.modifiedBondChange).toBe(14);
    expect(result.totalModification).toBe(4);
  });

  it('shadow-follower firstHandlerBondBonus adds 10 when isFirstHandler=true', () => {
    const horse = withExotic('shadow-follower');
    const result = applyUltraRareBondingEffects(horse, 5, { isFirstHandler: true });
    expect(result.modifiedBondChange).toBe(15);
    expect(result.appliedEffects.some(e => e.effect === 'first_handler_bond_bonus')).toBe(true);
  });

  it('shadow-follower otherHandlerPenalty applies 20% reduction when not first handler', () => {
    const horse = withExotic('shadow-follower');
    const result = applyUltraRareBondingEffects(horse, 10, { isFirstHandler: false });
    // penalty = 10 * (-0.2) = -2 → modifiedBondChange = 8
    expect(result.modifiedBondChange).toBe(8);
    expect(result.appliedEffects.some(e => e.effect === 'other_handler_penalty')).toBe(true);
  });

  it('ghostwalker bondCap limits bond change when near cap', () => {
    const horse = { ...withExotic('ghostwalker'), bondScore: 55 };
    // bondCap: 60; maxAllowedChange = 60-55 = 5; modifiedBondChange 10 → capped to 5
    const result = applyUltraRareBondingEffects(horse, 10);
    expect(result.modifiedBondChange).toBe(5);
    expect(result.appliedEffects.some(e => e.effect === 'bond_cap')).toBe(true);
  });

  it('ghostwalker bondCap does not cap when already under cap', () => {
    const horse = { ...withExotic('ghostwalker'), bondScore: 30 };
    // maxAllowedChange = 60-30 = 30; modifiedBondChange 10 → not capped
    const result = applyUltraRareBondingEffects(horse, 10);
    expect(result.modifiedBondChange).toBe(10);
  });

  it('result has originalBondChange, modifiedBondChange, appliedEffects, totalModification', () => {
    const result = applyUltraRareBondingEffects(noTraits(), 5);
    expect(result).toHaveProperty('originalBondChange', 5);
    expect(result).toHaveProperty('modifiedBondChange');
    expect(result).toHaveProperty('appliedEffects');
    expect(result).toHaveProperty('totalModification');
  });
});

// ---------------------------------------------------------------------------
// applyUltraRareBurnoutEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareBurnoutEffects', () => {
  it('no traits → burnout days unchanged', () => {
    const result = applyUltraRareBurnoutEffects(noTraits(), 7);
    expect(result.modifiedBurnoutDays).toBe(7);
    expect(result.totalReduction).toBe(0);
  });

  it('iron-willed burnoutImmunity zeros out burnout days', () => {
    const horse = withUltraRare('iron-willed');
    const result = applyUltraRareBurnoutEffects(horse, 7);
    expect(result.modifiedBurnoutDays).toBe(0);
    expect(result.totalReduction).toBe(7);
    expect(result.appliedEffects.some(e => e.effect === 'burnout_immunity')).toBe(true);
  });

  it('phoenix-born burnoutRecoveryBonus reduces burnout by 57%', () => {
    const horse = withUltraRare('phoenix-born');
    const result = applyUltraRareBurnoutEffects(horse, 7);
    // reduction = 7 * 0.57 = 3.99 → modifiedBurnoutDays ≈ 3.01
    expect(result.modifiedBurnoutDays).toBeCloseTo(7 * (1 - 0.57));
    expect(result.appliedEffects.some(e => e.effect === 'burnout_recovery_bonus')).toBe(true);
  });

  it('burnout days cannot go below 0', () => {
    const horse = withUltraRare('phoenix-born');
    const result = applyUltraRareBurnoutEffects(horse, 0);
    expect(result.modifiedBurnoutDays).toBe(0);
  });

  it('result has originalBurnoutDays, modifiedBurnoutDays, appliedEffects, totalReduction', () => {
    const result = applyUltraRareBurnoutEffects(noTraits(), 5);
    expect(result).toHaveProperty('originalBurnoutDays', 5);
    expect(result).toHaveProperty('modifiedBurnoutDays');
    expect(result).toHaveProperty('appliedEffects');
    expect(result).toHaveProperty('totalReduction');
  });
});

// ---------------------------------------------------------------------------
// applyUltraRareStatEffects
// ---------------------------------------------------------------------------
describe('applyUltraRareStatEffects', () => {
  const baseStats = { speed: 50, stamina: 50, agility: 50 };

  it('no traits → stats unchanged', () => {
    const result = applyUltraRareStatEffects(noTraits(), baseStats);
    expect(result.modifiedStats).toEqual(baseStats);
    expect(result.appliedEffects).toEqual([]);
  });

  it('iron-willed adds staminaBonus +5', () => {
    const horse = withUltraRare('iron-willed');
    const result = applyUltraRareStatEffects(horse, { stamina: 50 });
    expect(result.modifiedStats.stamina).toBe(55);
    expect(result.appliedEffects.some(e => e.effect === 'stamina_bonus')).toBe(true);
  });

  it('fey-kissed adds +3 to all 10 stats', () => {
    const horse = withExotic('fey-kissed');
    const stats = {
      speed: 50,
      stamina: 50,
      agility: 50,
      balance: 50,
      precision: 50,
      intelligence: 50,
      boldness: 50,
      flexibility: 50,
      obedience: 50,
      focus: 50,
    };
    const result = applyUltraRareStatEffects(horse, stats);
    for (const key of Object.keys(stats)) {
      expect(result.modifiedStats[key]).toBe(53);
    }
    expect(result.appliedEffects.some(e => e.effect === 'all_stat_bonus')).toBe(true);
  });

  it('fey-kissed allStatBonus initialises missing stat from 0', () => {
    const horse = withExotic('fey-kissed');
    const result = applyUltraRareStatEffects(horse, {});
    // speed should be 0 + 3 = 3
    expect(result.modifiedStats.speed).toBe(3);
  });

  it('result has originalStats, modifiedStats, appliedEffects', () => {
    const result = applyUltraRareStatEffects(noTraits(), { speed: 40 });
    expect(result).toHaveProperty('originalStats');
    expect(result).toHaveProperty('modifiedStats');
    expect(result).toHaveProperty('appliedEffects');
  });
});

// ---------------------------------------------------------------------------
// hasUltraRareAbility
// ---------------------------------------------------------------------------
describe('hasUltraRareAbility', () => {
  it('returns false when horse has no traits', () => {
    expect(hasUltraRareAbility(noTraits(), 'stress_immunity')).toBe(false);
    expect(hasUltraRareAbility(noTraits(), 'burnout_immunity')).toBe(false);
  });

  it('ghostwalker has stress_immunity', () => {
    expect(hasUltraRareAbility(withExotic('ghostwalker'), 'stress_immunity')).toBe(true);
  });

  it('iron-willed has burnout_immunity', () => {
    expect(hasUltraRareAbility(withUltraRare('iron-willed'), 'burnout_immunity')).toBe(true);
  });

  it('iron-willed has training_fatigue_immunity', () => {
    expect(hasUltraRareAbility(withUltraRare('iron-willed'), 'training_fatigue_immunity')).toBe(true);
  });

  it('fey-kissed has weather_immunity', () => {
    expect(hasUltraRareAbility(withExotic('fey-kissed'), 'weather_immunity')).toBe(true);
  });

  it('ghostwalker has reassignment_impossible', () => {
    expect(hasUltraRareAbility(withExotic('ghostwalker'), 'reassignment_impossible')).toBe(true);
  });

  it('shadow-follower has exclusive_bonding', () => {
    expect(hasUltraRareAbility(withExotic('shadow-follower'), 'exclusive_bonding')).toBe(true);
  });

  it('fey-kissed has mystical_resilience', () => {
    expect(hasUltraRareAbility(withExotic('fey-kissed'), 'mystical_resilience')).toBe(true);
  });

  it('returns false for unknown ability type', () => {
    expect(hasUltraRareAbility(withExotic('ghostwalker'), 'unknown_ability')).toBe(false);
  });

  it('returns false when ability exists but horse lacks it', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'burnout_immunity')).toBe(false);
  });

  it('missing ultraRareTraits field returns false', () => {
    expect(hasUltraRareAbility({}, 'stress_immunity')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// null-horse catch blocks — one test per exported function (lines 92-93,
// 144-147, 241-242, 377-380, 471-472, 538-539, 611-612, 682-683)
// ---------------------------------------------------------------------------
describe('null-horse catch blocks', () => {
  it('applyUltraRareStressEffects — catch (92-93): returns safe default when horse is null', () => {
    const result = applyUltraRareStressEffects(null, 50);
    expect(result.originalStress).toBe(50);
    expect(result.modifiedStress).toBe(50);
    expect(result.appliedEffects).toEqual([]);
    expect(result.totalReduction).toBe(0);
  });

  it('applyUltraRareStressDecayEffects — catch (144-147): returns safe default when horse is null', () => {
    const result = applyUltraRareStressDecayEffects(null, 10);
    expect(result.originalDecay).toBe(10);
    expect(result.modifiedDecay).toBe(10);
    expect(result.appliedEffects).toEqual([]);
    expect(result.totalBonus).toBe(0);
  });

  it('applyUltraRareTrainingEffects — catch (241-242): returns safe default when horse is null', () => {
    const trainingData = { success: false };
    const result = applyUltraRareTrainingEffects(null, trainingData);
    expect(result.originalTrainingData).toBe(trainingData);
    expect(result.modifiedTrainingData).toBe(trainingData);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareCompetitionEffects — catch (377-380): returns safe default when horse is null', () => {
    const result = applyUltraRareCompetitionEffects(null, 70);
    expect(result.originalScore).toBe(70);
    expect(result.modifiedScore).toBe(70);
    expect(result.appliedEffects).toEqual([]);
    expect(result.totalBonus).toBe(0);
  });

  it('applyUltraRareBondingEffects — catch (471-472): returns safe default when horse is null', () => {
    const result = applyUltraRareBondingEffects(null, 5);
    expect(result.originalBondChange).toBe(5);
    expect(result.modifiedBondChange).toBe(5);
    expect(result.appliedEffects).toEqual([]);
    expect(result.totalModification).toBe(0);
  });

  it('applyUltraRareBurnoutEffects — catch (538-539): returns safe default when horse is null', () => {
    const result = applyUltraRareBurnoutEffects(null, 7);
    expect(result.originalBurnoutDays).toBe(7);
    expect(result.modifiedBurnoutDays).toBe(7);
    expect(result.appliedEffects).toEqual([]);
    expect(result.totalReduction).toBe(0);
  });

  it('applyUltraRareStatEffects — catch (611-612): returns safe default when horse is null', () => {
    const baseStats = { speed: 50 };
    const result = applyUltraRareStatEffects(null, baseStats);
    expect(result.originalStats).toBe(baseStats);
    expect(result.modifiedStats).toBe(baseStats);
    expect(result.appliedEffects).toEqual([]);
  });

  it('hasUltraRareAbility — catch (682-683): returns false when horse is null', () => {
    expect(hasUltraRareAbility(null, 'stress_immunity')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// phantom-trait continue branches — trait with no definition skips loop body
// (lines 119, 173, 268, 407, 498, 565, 634)
// ---------------------------------------------------------------------------
describe('phantom-trait continue branches (no trait definition found)', () => {
  const phantomHorse = {
    ultraRareTraits: {
      ultraRare: [{ name: 'nonexistent_trait_xyz_phantom' }],
      exotic: [],
    },
  };

  it('applyUltraRareStressDecayEffects continue (119): phantom trait skips loop body', () => {
    const result = applyUltraRareStressDecayEffects(phantomHorse, 10);
    expect(result.modifiedDecay).toBe(10);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareTrainingEffects continue (173): phantom trait skips loop body', () => {
    const result = applyUltraRareTrainingEffects(phantomHorse, { success: true });
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareCompetitionEffects continue (268): phantom trait skips loop body', () => {
    const result = applyUltraRareCompetitionEffects(phantomHorse, 70);
    expect(result.modifiedScore).toBe(70);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareBondingEffects continue (407): phantom trait skips loop body', () => {
    const result = applyUltraRareBondingEffects(phantomHorse, 5);
    expect(result.modifiedBondChange).toBe(5);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareBurnoutEffects continue (498): phantom trait skips loop body', () => {
    const result = applyUltraRareBurnoutEffects(phantomHorse, 7);
    expect(result.modifiedBurnoutDays).toBe(7);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareStatEffects continue (565): phantom trait skips loop body', () => {
    const result = applyUltraRareStatEffects(phantomHorse, { speed: 50 });
    expect(result.modifiedStats.speed).toBe(50);
    expect(result.appliedEffects).toEqual([]);
  });

  it('hasUltraRareAbility continue (634): phantom trait skips loop body → returns false', () => {
    expect(hasUltraRareAbility(phantomHorse, 'stress_immunity')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasUltraRareAbility switch break branches — trait has mechanicalEffects
// but not the specific ability checked (lines 644, 654, 659, 664, 669, 674)
// ---------------------------------------------------------------------------
describe('hasUltraRareAbility — switch break branches', () => {
  it('stress_immunity break (644): phoenix-born lacks stressImmunity → returns false', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'stress_immunity')).toBe(false);
  });

  it('training_fatigue_immunity break (654): phoenix-born lacks trainingFatigueImmunity → returns false', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'training_fatigue_immunity')).toBe(false);
  });

  it('weather_immunity break (659): phoenix-born lacks weatherImmunity → returns false', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'weather_immunity')).toBe(false);
  });

  it('mystical_resilience break (664): phoenix-born lacks mysticalResilience → returns false', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'mystical_resilience')).toBe(false);
  });

  it('exclusive_bonding break (669): phoenix-born lacks exclusiveBonding → returns false', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'exclusive_bonding')).toBe(false);
  });

  it('reassignment_impossible break (674): phoenix-born lacks reassignmentImpossible → returns false', () => {
    expect(hasUltraRareAbility(withUltraRare('phoenix-born'), 'reassignment_impossible')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// || fallback branches — horse missing ultraRareTraits field (Equoria-jkht)
// Lines 110, 164, 259, 398, 489, 556 (line 19/628 already covered by existing tests)
// ---------------------------------------------------------------------------
describe('missing-ultraRareTraits || fallback branches (Equoria-jkht)', () => {
  it('applyUltraRareStressDecayEffects (line 110): {} horse uses [] fallback, decay unchanged', () => {
    const result = applyUltraRareStressDecayEffects({}, 10);
    expect(result.modifiedDecay).toBe(10);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareTrainingEffects (line 164): {} horse uses [] fallback, no effects applied', () => {
    const result = applyUltraRareTrainingEffects({}, { success: true });
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareCompetitionEffects (line 259): {} horse uses [] fallback, score unchanged', () => {
    const result = applyUltraRareCompetitionEffects({}, 70);
    expect(result.modifiedScore).toBe(70);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareBondingEffects (line 398): {} horse uses [] fallback, bond unchanged', () => {
    const result = applyUltraRareBondingEffects({}, 5);
    expect(result.modifiedBondChange).toBe(5);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareBurnoutEffects (line 489): {} horse uses [] fallback, burnout unchanged', () => {
    const result = applyUltraRareBurnoutEffects({}, 7);
    expect(result.modifiedBurnoutDays).toBe(7);
    expect(result.appliedEffects).toEqual([]);
  });

  it('applyUltraRareStatEffects (line 556): {} horse uses [] fallback, stats unchanged', () => {
    const result = applyUltraRareStatEffects({}, { speed: 50 });
    expect(result.modifiedStats.speed).toBe(50);
    expect(result.appliedEffects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// if-condition FALSE branches — trait has mechanicalEffects but lacks the checked field
// Line 125: stressDecayMultiplier FALSE
// Line 450: bondCap FALSE
// Line 516: burnoutRecoveryBonus FALSE
// Line 572: (modifiedStats.stamina || 0) RIGHT branch when stamina is undefined
// ---------------------------------------------------------------------------
describe('if-condition FALSE branches — field absent despite mechanicalEffects (Equoria-jkht)', () => {
  it('line 125 FALSE: iron-willed has mechanicalEffects but no stressDecayMultiplier → no multiplier', () => {
    const result = applyUltraRareStressDecayEffects(withUltraRare('iron-willed'), 10);
    expect(result.modifiedDecay).toBe(10);
    expect(result.appliedEffects.some(e => e.effect === 'stress_decay_multiplier')).toBe(false);
  });

  it('line 450 FALSE: iron-willed has mechanicalEffects but no bondCap → no cap applied', () => {
    const result = applyUltraRareBondingEffects(withUltraRare('iron-willed'), 5);
    expect(result.appliedEffects.some(e => e.effect === 'bond_cap')).toBe(false);
  });

  it('line 516 FALSE: empathic-mirror has mechanicalEffects but no burnoutRecoveryBonus → days unchanged', () => {
    const result = applyUltraRareBurnoutEffects(withUltraRare('empathic-mirror'), 7);
    expect(result.modifiedBurnoutDays).toBe(7);
    expect(result.appliedEffects.some(e => e.effect === 'burnout_recovery_bonus')).toBe(false);
  });

  it('line 572 RIGHT || branch: iron-willed staminaBonus with undefined stamina initialises from 0', () => {
    const result = applyUltraRareStatEffects(withUltraRare('iron-willed'), { speed: 50 });
    expect(result.modifiedStats.stamina).toBe(5); // undefined || 0 → 0 + 5 = 5
  });

  it('line 450 RIGHT || branch: ghostwalker bondCap with no bondScore uses 0 as currentBond', () => {
    // horse has no bondScore → horse.bondScore || 0 = undefined || 0 = 0 (RIGHT branch)
    const horse = { ...withExotic('ghostwalker') }; // no bondScore property
    // maxAllowedChange = Math.max(0, 60-0) = 60; baseBondChange 70 > 60 → capped
    const result = applyUltraRareBondingEffects(horse, 70);
    expect(result.modifiedBondChange).toBe(60);
    expect(result.appliedEffects.some(e => e.effect === 'bond_cap')).toBe(true);
  });
});
