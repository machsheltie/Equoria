/**
 * groomPersonalityEffects — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  GROOM_PERSONALITY_EFFECTS,
  calculatePersonalityEffects,
  getPersonalityEffectSummary,
  getAllPersonalityTypes,
} from '../../utils/groomPersonalityEffects.mjs';

// ---------------------------------------------------------------------------
// GROOM_PERSONALITY_EFFECTS constant
// ---------------------------------------------------------------------------
describe('GROOM_PERSONALITY_EFFECTS', () => {
  it('contains at least 6 personality types', () => {
    expect(Object.keys(GROOM_PERSONALITY_EFFECTS).length).toBeGreaterThanOrEqual(6);
  });

  it('includes gentle, playful, firm, patient, high_energy, aloof', () => {
    expect(GROOM_PERSONALITY_EFFECTS.gentle).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.playful).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.firm).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.patient).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.high_energy).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.aloof).toBeDefined();
  });

  it('each personality has required numeric modifier fields', () => {
    for (const [, config] of Object.entries(GROOM_PERSONALITY_EFFECTS)) {
      expect(typeof config.successRateModifier).toBe('number');
      expect(typeof config.bondingModifier).toBe('number');
      expect(typeof config.stressReductionModifier).toBe('number');
      expect(typeof config.streakGrowthModifier).toBe('number');
      expect(typeof config.burnoutRiskModifier).toBe('number');
      expect(typeof config.traitInfluenceModifier).toBe('number');
    }
  });

  it('each personality has bonusTasks array', () => {
    for (const [, config] of Object.entries(GROOM_PERSONALITY_EFFECTS)) {
      expect(Array.isArray(config.bonusTasks)).toBe(true);
    }
  });

  it('gentle has brushing in bonusTasks', () => {
    expect(GROOM_PERSONALITY_EFFECTS.gentle.bonusTasks).toContain('brushing');
  });

  it('aloof is flagged as penalty', () => {
    expect(GROOM_PERSONALITY_EFFECTS.aloof.penalty).toBe(true);
  });

  it('aloof has lower bondingModifier than gentle', () => {
    expect(GROOM_PERSONALITY_EFFECTS.aloof.bondingModifier).toBeLessThan(
      GROOM_PERSONALITY_EFFECTS.gentle.bondingModifier,
    );
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityEffects
// ---------------------------------------------------------------------------
describe('calculatePersonalityEffects', () => {
  const baseEffects = {
    bondingChange: 10,
    stressChange: -5,
    successRate: 0.85,
    streakGrowth: 1,
    burnoutRisk: 0.1,
    traitInfluence: 5,
  };

  it('returns baseEffects unchanged for unknown personality', () => {
    const groom = { personality: 'telekinetic' };
    const result = calculatePersonalityEffects(groom, {}, 'brushing', baseEffects);
    expect(result).toBe(baseEffects);
  });

  it('gentle: increases bondingChange by 1.2 multiplier', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'stall_care', baseEffects);
    expect(result.bondingChange).toBe(Math.round(10 * 1.2));
  });

  it('gentle: amplifies stressReduction (multiplies stressChange by 1.4)', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.stressChange).toBe(Math.round(-5 * 1.4));
  });

  it('gentle: applies successRateModifier 1.1', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.successRate).toBeCloseTo(Math.min(0.99, 0.85 * 1.1));
  });

  it('gentle + nervous horse: gets bonus successRate from specialConditions', () => {
    const groom = { personality: 'gentle' };
    const nervousHorse = { traits: [{ name: 'nervous' }] };
    const calmHorse = { traits: [] };
    const withNervous = calculatePersonalityEffects(groom, nervousHorse, 'brushing', baseEffects);
    const withCalm = calculatePersonalityEffects(groom, calmHorse, 'brushing', baseEffects);
    expect(withNervous.successRate).toBeGreaterThan(withCalm.successRate);
    expect(withNervous.personalityEffects.specialConditionMet).toBe(true);
  });

  it('gentle: brushing is a bonus task', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.personalityEffects.taskBonus).toBe(true);
  });

  it('gentle: non-bonus task does not set taskBonus', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddle_training', baseEffects);
    expect(result.personalityEffects.taskBonus).toBe(false);
  });

  it('playful + foal age: gets age-based bonusBonding', () => {
    const groom = { personality: 'playful' };
    const foal = { traits: [], age: 100 }; // within [0, 1095]
    const adult = { traits: [], age: 2000 }; // outside age range
    const foalResult = calculatePersonalityEffects(groom, foal, 'grooming_game', baseEffects);
    const adultResult = calculatePersonalityEffects(groom, adult, 'grooming_game', baseEffects);
    expect(foalResult.bondingChange).toBeGreaterThan(adultResult.bondingChange);
    expect(foalResult.personalityEffects.specialConditionMet).toBe(true);
  });

  it('patient + enrichment task: gets bonusSuccessRate from taskCategories', () => {
    const groom = { personality: 'patient' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddle_training', baseEffects);
    // puddle_training → 'enrichment' category which matches patient's taskCategories
    expect(result.personalityEffects.specialConditionMet).toBe(true);
  });

  it('aloof: reduces bonding below base', () => {
    const groom = { personality: 'aloof' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.bondingChange).toBeLessThan(10);
  });

  it('aloof has no bonus tasks: taskBonus always false', () => {
    const groom = { personality: 'aloof' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.personalityEffects.taskBonus).toBe(false);
  });

  it('result includes personalityEffects with personality, bonusesApplied, description', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.personalityEffects).toHaveProperty('personality', 'gentle');
    expect(Array.isArray(result.personalityEffects.bonusesApplied)).toBe(true);
    expect(typeof result.personalityEffects.description).toBe('string');
  });

  it('applies traitInfluence modification', () => {
    const groom = { personality: 'firm' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'leading_practice', baseEffects);
    // traitInfluenceModifier: 1.3
    expect(result.traitInfluence).toBe(Math.round(5 * 1.3));
  });

  it('applies streakGrowth modification', () => {
    const groom = { personality: 'playful' };
    const result = calculatePersonalityEffects(groom, { traits: [], age: 2000 }, 'grooming_game', baseEffects);
    // streakGrowthModifier: 1.15
    expect(result.streakGrowth).toBe(Math.round(1 * 1.15));
  });

  it('handles baseEffects without optional fields gracefully', () => {
    const groom = { personality: 'gentle' };
    const minimal = { bondingChange: 5, stressChange: -3, successRate: 0.85 };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', minimal);
    expect(result.bondingChange).toBeDefined();
    expect(result.successRate).toBeDefined();
  });

  it('successRate is capped at 0.99', () => {
    const groom = { personality: 'patient' };
    const highBase = { ...baseEffects, successRate: 0.98 };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddle_training', highBase);
    expect(result.successRate).toBeLessThanOrEqual(0.99);
  });
});

// ---------------------------------------------------------------------------
// getPersonalityEffectSummary
// ---------------------------------------------------------------------------
describe('getPersonalityEffectSummary', () => {
  it('returns hasEffect: false for unknown personality', () => {
    const result = getPersonalityEffectSummary('mysterious', 'brushing');
    expect(result.hasEffect).toBe(false);
    expect(result.description).toBeDefined();
  });

  it('returns hasEffect: true for known personality', () => {
    const result = getPersonalityEffectSummary('gentle', 'brushing');
    expect(result.hasEffect).toBe(true);
  });

  it('includes personality, taskBonus, effect, modifiers', () => {
    const result = getPersonalityEffectSummary('gentle', 'brushing');
    expect(result.personality).toBe('gentle');
    expect(typeof result.taskBonus).toBe('boolean');
    expect(typeof result.effect).toBe('string');
    expect(result.modifiers).toHaveProperty('bonding');
    expect(result.modifiers).toHaveProperty('stressReduction');
    expect(result.modifiers).toHaveProperty('successRate');
  });

  it('taskBonus is true for bonus task', () => {
    const result = getPersonalityEffectSummary('gentle', 'brushing');
    expect(result.taskBonus).toBe(true);
  });

  it('taskBonus is false for non-bonus task', () => {
    const result = getPersonalityEffectSummary('gentle', 'obstacle_course');
    expect(result.taskBonus).toBe(false);
  });

  it('modifiers contain numeric values', () => {
    const result = getPersonalityEffectSummary('patient', 'puddle_training');
    expect(typeof result.modifiers.bonding).toBe('number');
    expect(typeof result.modifiers.burnoutRisk).toBe('number');
  });
});

// ─── calculatePersonalityEffects — additional branch coverage ─────────────────

describe('calculatePersonalityEffects — additional branches', () => {
  const baseEffects = {
    bondingChange: 10,
    stressChange: -5,
    successRate: 0.85,
    streakGrowth: 1,
    burnoutRisk: 0.1,
    traitInfluence: 5,
  };

  it('high_energy personality: applies extraTraitPoints branch (traitInfluence += 1)', () => {
    const groom = { personality: 'high_energy' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'obstacle_course', baseEffects);
    // high_energy traitInfluenceModifier=1.4, +1 extra = round(5*1.4)+1 = 8
    expect(result.traitInfluence).toBe(Math.round(5 * 1.4) + 1);
    expect(result.personalityEffects.bonusesApplied).toContain('extra_trait_points');
  });

  it('firm + stubborn horse: hasMatchingTrait=true but bonusSuccessRate is absent (false branch)', () => {
    const groom = { personality: 'firm' };
    const stubbornHorse = { traits: [{ name: 'stubborn' }] };
    const result = calculatePersonalityEffects(groom, stubbornHorse, 'leading_practice', baseEffects);
    // firm has horseTraits: ['stubborn',...] but no bonusSuccessRate → bonusSuccessRate false branch
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.personalityEffects.bonusesApplied).toContain('trait_match');
  });

  it('gentle + horse without .traits property: horseTraits false branch when horse.traits absent', () => {
    const groom = { personality: 'gentle' };
    const noTraitsHorse = {}; // no .traits key at all
    const result = calculatePersonalityEffects(groom, noTraitsHorse, 'brushing', baseEffects);
    // specialConditions.horseTraits exists but horse.traits is undefined → condition is false
    expect(result.personalityEffects.specialConditionMet).toBe(false);
  });

  it('patient + leading_practice: categorizeTaskForPersonality returns "training" → taskCategories match', () => {
    const groom = { personality: 'patient' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'leading_practice', baseEffects);
    // patient taskCategories includes 'training'; leading_practice maps to 'training'
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.personalityEffects.bonusesApplied).toContain('category_match');
  });

  it('patient + jumping: categorizeTaskForPersonality returns "general" → taskCategories no match', () => {
    const groom = { personality: 'patient' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'jumping', baseEffects);
    // 'jumping' not in any task list → 'general' → not in patient's taskCategories
    expect(result.personalityEffects.specialConditionMet).toBe(false);
  });

  it('playful + horse age 0: ageRange branch is false when age is 0 (falsy)', () => {
    const groom = { personality: 'playful' };
    const newbornHorse = { traits: [], age: 0 };
    const result = calculatePersonalityEffects(groom, newbornHorse, 'grooming_game', baseEffects);
    // specialConditions.ageRange && horse.age → false when age=0 (falsy)
    expect(result.personalityEffects.specialConditionMet).toBe(false);
  });

  it('null groom triggers catch block and returns baseEffects unchanged', () => {
    // null groom → const { personality } = null throws TypeError → catch returns baseEffects
    const result = calculatePersonalityEffects(null, { traits: [] }, 'brushing', baseEffects);
    expect(result).toBe(baseEffects);
  });

  it('patient + brushing: categorizeTaskForPersonality returns "grooming" (line 350)', () => {
    const groom = { personality: 'patient' };
    // brushing is in groomingTasks → categorizeTaskForPersonality returns 'grooming'
    // patient taskCategories does not include 'grooming' → specialConditionMet false
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.personalityEffects.specialConditionMet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAllPersonalityTypes
// ---------------------------------------------------------------------------
describe('getAllPersonalityTypes', () => {
  it('returns an array', () => {
    expect(Array.isArray(getAllPersonalityTypes())).toBe(true);
  });

  it('has at least 6 entries', () => {
    expect(getAllPersonalityTypes().length).toBeGreaterThanOrEqual(6);
  });

  it('each entry has type, name, effect, bonusTasks, isPenalty', () => {
    for (const item of getAllPersonalityTypes()) {
      expect(typeof item.type).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.effect).toBe('string');
      expect(Array.isArray(item.bonusTasks)).toBe(true);
      expect(typeof item.isPenalty).toBe('boolean');
    }
  });

  it('aloof is marked as isPenalty: true', () => {
    const aloof = getAllPersonalityTypes().find(p => p.type === 'aloof');
    expect(aloof).toBeDefined();
    expect(aloof.isPenalty).toBe(true);
  });

  it('gentle is not marked as isPenalty', () => {
    const gentle = getAllPersonalityTypes().find(p => p.type === 'gentle');
    expect(gentle).toBeDefined();
    expect(gentle.isPenalty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityEffects — successRate || 0.85 fallback (line 196)
// ---------------------------------------------------------------------------
describe('calculatePersonalityEffects — successRate || 0.85 fallback (line 196)', () => {
  it('baseEffects without successRate uses 0.85 default (|| right-branch covered)', () => {
    const groom = { personality: 'gentle' };
    const baseWithoutRate = { bondingChange: 10, stressChange: -5 };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseWithoutRate);
    // successRate was undefined → 0.85 default → min(0.99, 0.85 * 1.1) = 0.935
    expect(result.successRate).toBeCloseTo(Math.min(0.99, 0.85 * 1.1));
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityEffects — trait bonusBonding path (line 223)
//
// No built-in personality has BOTH horseTraits AND bonusBonding.
// We temporarily inject a synthetic personality to reach that branch,
// then clean up so other suites see the original config.
// ---------------------------------------------------------------------------
describe('calculatePersonalityEffects — trait bonusBonding branch (line 223)', () => {
  beforeAll(() => {
    GROOM_PERSONALITY_EFFECTS._testTraitBonding = {
      bonusTasks: [],
      effect: 'test only',
      successRateModifier: 1.0,
      bondingModifier: 1.0,
      stressReductionModifier: 1.0,
      streakGrowthModifier: 1.0,
      burnoutRiskModifier: 1.0,
      traitInfluenceModifier: 1.0,
      specialConditions: {
        horseTraits: ['docile'],
        bonusBonding: 0.5, // triggers line 223 when horse has 'docile' trait
      },
    };
  });

  afterAll(() => {
    delete GROOM_PERSONALITY_EFFECTS._testTraitBonding;
  });

  it('horse with matching trait and bonusBonding applies bondingChange bonus (line 223 covered)', () => {
    const groom = { personality: '_testTraitBonding' };
    const horse = { traits: ['docile'], age: 500 };
    const baseEffects = { successRate: 0.85, bondingChange: 10, stressChange: -5 };

    const result = calculatePersonalityEffects(groom, horse, 'brushing', baseEffects);

    // bonusBonding=0.5 → bondingChange += round(10 * 0.5) = 5 → final 15
    expect(result.bondingChange).toBe(15);
    expect(result.personalityEffects.bonusesApplied).toContain('trait_match');
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityEffects — specialConditions FALSE branches (lines 204, 237, 252)
// ---------------------------------------------------------------------------
describe('calculatePersonalityEffects — specialConditions FALSE branches (lines 204, 237, 252)', () => {
  const baseEffects = {
    bondingChange: 10,
    stressChange: -5,
    successRate: 0.85,
    streakGrowth: 1,
    burnoutRisk: 0.1,
    traitInfluence: 5,
  };

  beforeAll(() => {
    // line 204 FALSE: personality with no specialConditions key
    GROOM_PERSONALITY_EFFECTS._testNoSpecialConditions = {
      bonusTasks: [],
      effect: 'test only — no specialConditions',
      successRateModifier: 1.0,
      bondingModifier: 1.0,
      stressReductionModifier: 1.0,
      streakGrowthModifier: 1.0,
      burnoutRiskModifier: 1.0,
      traitInfluenceModifier: 1.0,
      // intentionally omitted: specialConditions
    };

    // line 237 FALSE: personality with ageRange but no bonusBonding
    GROOM_PERSONALITY_EFFECTS._testAgeRangeNoBonusBonding = {
      bonusTasks: [],
      effect: 'test only — ageRange, no bonusBonding',
      successRateModifier: 1.0,
      bondingModifier: 1.0,
      stressReductionModifier: 1.0,
      streakGrowthModifier: 1.0,
      burnoutRiskModifier: 1.0,
      traitInfluenceModifier: 1.0,
      specialConditions: {
        ageRange: [0, 9999],
        // intentionally omitted: bonusBonding
      },
    };

    // line 252 FALSE: personality with taskCategories match but no bonusSuccessRate
    GROOM_PERSONALITY_EFFECTS._testTaskCatNoBonusRate = {
      bonusTasks: [],
      effect: 'test only — taskCategories, no bonusSuccessRate',
      successRateModifier: 1.0,
      bondingModifier: 1.0,
      stressReductionModifier: 1.0,
      streakGrowthModifier: 1.0,
      burnoutRiskModifier: 1.0,
      traitInfluenceModifier: 1.0,
      specialConditions: {
        taskCategories: ['enrichment'],
        // intentionally omitted: bonusSuccessRate
      },
    };
  });

  afterAll(() => {
    delete GROOM_PERSONALITY_EFFECTS._testNoSpecialConditions;
    delete GROOM_PERSONALITY_EFFECTS._testAgeRangeNoBonusBonding;
    delete GROOM_PERSONALITY_EFFECTS._testTaskCatNoBonusRate;
  });

  it('no specialConditions: skips entire specialConditions block (line 204 FALSE branch)', () => {
    const groom = { personality: '_testNoSpecialConditions' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', baseEffects);
    expect(result.personalityEffects.specialConditionMet).toBe(false);
    expect(result.personalityEffects.bonusesApplied).toHaveLength(0);
  });

  it('ageRange matches but no bonusBonding: skips bondingChange bonus (line 237 FALSE branch)', () => {
    const groom = { personality: '_testAgeRangeNoBonusBonding' };
    const foal = { traits: [], age: 100 }; // within [0, 9999]
    const result = calculatePersonalityEffects(groom, foal, 'brushing', baseEffects);
    // specialConditionMet=true (age matched), but bondingChange unchanged (no bonusBonding)
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.bondingChange).toBe(baseEffects.bondingChange); // no bonus applied
  });

  it('taskCategory matches but no bonusSuccessRate: skips rate bonus (line 252 FALSE branch)', () => {
    const groom = { personality: '_testTaskCatNoBonusRate' };
    // puddle_training → 'enrichment' → matches taskCategories: ['enrichment']
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddle_training', baseEffects);
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.successRate).toBeCloseTo(baseEffects.successRate); // no bonusSuccessRate added
  });
});
