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
} from '../../../utils/groomPersonalityEffects.mjs';

// ---------------------------------------------------------------------------
// GROOM_PERSONALITY_EFFECTS constant
// ---------------------------------------------------------------------------
describe('GROOM_PERSONALITY_EFFECTS', () => {
  it('contains at least 6 personality types', () => {
    expect(Object.keys(GROOM_PERSONALITY_EFFECTS).length).toBeGreaterThanOrEqual(6);
  });

  it('includes gentle, playful, firm, patient, highEnergy, aloof', () => {
    expect(GROOM_PERSONALITY_EFFECTS.gentle).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.playful).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.firm).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.patient).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.highEnergy).toBeDefined();
    expect(GROOM_PERSONALITY_EFFECTS.aloof).toBeDefined();
  });

  it('each personality has required numeric modifier fields', () => {
    for (const [, config] of Object.entries(GROOM_PERSONALITY_EFFECTS)) {
      expect(typeof config.successRateModifier).toBe('number');
      expect(typeof config.bondingModifier).toBe('number');
      expect(typeof config.streakGrowthModifier).toBe('number');
      // Equoria-0d4wa: there is no burnout, so no personality carries a burnout modifier.
      expect(config.burnoutRiskModifier).toBeUndefined();
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
    successRate: 0.85,
    streakGrowth: 1,
    traitInfluence: 5,
  };

  it('returns baseEffects unchanged for unknown personality', () => {
    const groom = { personality: 'telekinetic' };
    const result = calculatePersonalityEffects(groom, {}, 'brushing', baseEffects);
    expect(result).toBe(baseEffects);
  });

  it('gentle: increases bondingChange by 1.2 multiplier', () => {
    const groom = { personality: 'gentle' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'stallCare', baseEffects);
    expect(result.bondingChange).toBe(Math.round(10 * 1.2));
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
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddleTraining', baseEffects);
    expect(result.personalityEffects.taskBonus).toBe(false);
  });

  it('playful + foal age: gets age-based bonusBonding', () => {
    const groom = { personality: 'playful' };
    // Equoria-xggat: horse.age is game-years; under 3 is the foal range. Old contract:
    // the range was [0, 1095], so a 100-year-old horse counted as a foal.
    const foal = { traits: [], age: 2 };
    const adult = { traits: [], age: 3 }; // game age 3 is outside the range
    const foalResult = calculatePersonalityEffects(groom, foal, 'groomingGame', baseEffects);
    const adultResult = calculatePersonalityEffects(groom, adult, 'groomingGame', baseEffects);
    expect(foalResult.bondingChange).toBeGreaterThan(adultResult.bondingChange);
    expect(foalResult.personalityEffects.specialConditionMet).toBe(true);
  });

  it('patient + enrichment task: gets bonusSuccessRate from taskCategories', () => {
    const groom = { personality: 'patient' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddleTraining', baseEffects);
    // puddleTraining → 'enrichment' category which matches patient's taskCategories
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
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'leadingPractice', baseEffects);
    // traitInfluenceModifier: 1.3
    expect(result.traitInfluence).toBe(Math.round(5 * 1.3));
  });

  it('applies streakGrowth modification', () => {
    const groom = { personality: 'playful' };
    const result = calculatePersonalityEffects(groom, { traits: [], age: 2000 }, 'groomingGame', baseEffects);
    // streakGrowthModifier: 1.15
    expect(result.streakGrowth).toBe(Math.round(1 * 1.15));
  });

  it('handles baseEffects without optional fields gracefully', () => {
    const groom = { personality: 'gentle' };
    const minimal = { bondingChange: 5, successRate: 0.85 };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'brushing', minimal);
    expect(result.bondingChange).toBeDefined();
    expect(result.successRate).toBeDefined();
  });

  it('successRate is capped at 0.99', () => {
    const groom = { personality: 'patient' };
    const highBase = { ...baseEffects, successRate: 0.98 };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddleTraining', highBase);
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
    expect(result.modifiers).toHaveProperty('successRate');
  });

  it('taskBonus is true for bonus task', () => {
    const result = getPersonalityEffectSummary('gentle', 'brushing');
    expect(result.taskBonus).toBe(true);
  });

  it('taskBonus is false for non-bonus task', () => {
    const result = getPersonalityEffectSummary('gentle', 'obstacleCourse');
    expect(result.taskBonus).toBe(false);
  });

  it('modifiers contain numeric values', () => {
    const result = getPersonalityEffectSummary('patient', 'puddleTraining');
    expect(typeof result.modifiers.bonding).toBe('number');
    expect(result.modifiers.burnoutRisk).toBeUndefined(); // Equoria-0d4wa: no burnout
  });
});

// ─── calculatePersonalityEffects — additional branch coverage ─────────────────

describe('calculatePersonalityEffects — additional branches', () => {
  const baseEffects = {
    bondingChange: 10,
    successRate: 0.85,
    streakGrowth: 1,
    traitInfluence: 5,
  };

  it('highEnergy personality: applies extraTraitPoints branch (traitInfluence += 1)', () => {
    const groom = { personality: 'highEnergy' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'obstacleCourse', baseEffects);
    // highEnergy traitInfluenceModifier=1.4, +1 extra = round(5*1.4)+1 = 8
    expect(result.traitInfluence).toBe(Math.round(5 * 1.4) + 1);
    expect(result.personalityEffects.bonusesApplied).toContain('extraTraitPoints');
  });

  it('firm + stubborn horse: hasMatchingTrait=true but bonusSuccessRate is absent (false branch)', () => {
    const groom = { personality: 'firm' };
    const stubbornHorse = { traits: [{ name: 'stubborn' }] };
    const result = calculatePersonalityEffects(groom, stubbornHorse, 'leadingPractice', baseEffects);
    // firm has horseTraits: ['stubborn',...] but no bonusSuccessRate → bonusSuccessRate false branch
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.personalityEffects.bonusesApplied).toContain('traitMatch');
  });

  it('gentle + horse without .traits property: horseTraits false branch when horse.traits absent', () => {
    const groom = { personality: 'gentle' };
    const noTraitsHorse = {}; // no .traits key at all
    const result = calculatePersonalityEffects(groom, noTraitsHorse, 'brushing', baseEffects);
    // specialConditions.horseTraits exists but horse.traits is undefined → condition is false
    expect(result.personalityEffects.specialConditionMet).toBe(false);
  });

  it('patient + leadingPractice: categorizeTaskForPersonality returns "training" → taskCategories match', () => {
    const groom = { personality: 'patient' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'leadingPractice', baseEffects);
    // patient taskCategories includes 'training'; leadingPractice maps to 'training'
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.personalityEffects.bonusesApplied).toContain('categoryMatch');
  });

  it('patient + jumping: categorizeTaskForPersonality returns "general" → taskCategories no match', () => {
    const groom = { personality: 'patient' };
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'jumping', baseEffects);
    // 'jumping' not in any task list → 'general' → not in patient's taskCategories
    expect(result.personalityEffects.specialConditionMet).toBe(false);
  });

  it('playful + horse age 0: a newborn gets the age bonus (Equoria-fjgzp; age 0 is not falsy-skipped)', () => {
    // Old contract: `specialConditions.ageRange && horse.age` skipped age 0.
    const groom = { personality: 'playful' };
    const newbornHorse = { traits: [], age: 0 };
    const result = calculatePersonalityEffects(groom, newbornHorse, 'groomingGame', baseEffects);
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.personalityEffects.bonusesApplied.length).toBeGreaterThan(0);
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
    const baseWithoutRate = { bondingChange: 10 };
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
      streakGrowthModifier: 1.0,
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
    const baseEffects = { successRate: 0.85, bondingChange: 10 };

    const result = calculatePersonalityEffects(groom, horse, 'brushing', baseEffects);

    // bonusBonding=0.5 → bondingChange += round(10 * 0.5) = 5 → final 15
    expect(result.bondingChange).toBe(15);
    expect(result.personalityEffects.bonusesApplied).toContain('traitMatch');
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityEffects — specialConditions FALSE branches (lines 204, 237, 252)
// ---------------------------------------------------------------------------
describe('calculatePersonalityEffects — specialConditions FALSE branches (lines 204, 237, 252)', () => {
  const baseEffects = {
    bondingChange: 10,
    successRate: 0.85,
    streakGrowth: 1,
    traitInfluence: 5,
  };

  beforeAll(() => {
    // line 204 FALSE: personality with no specialConditions key
    GROOM_PERSONALITY_EFFECTS._testNoSpecialConditions = {
      bonusTasks: [],
      effect: 'test only — no specialConditions',
      successRateModifier: 1.0,
      bondingModifier: 1.0,
      streakGrowthModifier: 1.0,
      traitInfluenceModifier: 1.0,
      // intentionally omitted: specialConditions
    };

    // line 237 FALSE: personality with ageRange but no bonusBonding
    GROOM_PERSONALITY_EFFECTS._testAgeRangeNoBonusBonding = {
      bonusTasks: [],
      effect: 'test only — ageRange, no bonusBonding',
      successRateModifier: 1.0,
      bondingModifier: 1.0,
      streakGrowthModifier: 1.0,
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
      streakGrowthModifier: 1.0,
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
    // puddleTraining → 'enrichment' → matches taskCategories: ['enrichment']
    const result = calculatePersonalityEffects(groom, { traits: [] }, 'puddleTraining', baseEffects);
    expect(result.personalityEffects.specialConditionMet).toBe(true);
    expect(result.successRate).toBeCloseTo(baseEffects.successRate); // no bonusSuccessRate added
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact per-personality config values and the bonusesApplied / specialConditionMet
// behavioral fields not asserted by the tests above.
describe('groomPersonalityEffects — exact config & bonusesApplied (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const mkGroom = personality => ({
    id: 'g',
    name: 'Test Groom',
    personality,
    speciality: 'foalCare',
    skillLevel: 'intermediate',
    experience: 5,
  });
  const mkHorse = (overrides = {}) => ({
    id: 'h',
    name: 'Test Horse',
    age: 365,
    bondScore: 50,
    traits: [
      { name: 'nervous', type: 'behavioral' },
      { name: 'curious', type: 'mental' },
    ],
    ...overrides,
  });
  const baseEffects = () => ({
    bondingChange: 5,
    cost: 25.0,
    quality: 'good',
    errorOccurred: false,
    successRate: 0.85,
    traitInfluence: 1,
    streakGrowth: 1,
    modifiers: { specialty: 1.2, skillLevel: 1.1, personality: 1.2, experience: 1 },
  });

  describe('exact config values', () => {
    it('gentle has exact bonding 1.2 and a nervous specialCondition + 0.1 bonus', () => {
      const { gentle } = GROOM_PERSONALITY_EFFECTS;
      expect(gentle.bonusTasks).toContain('brushing');
      expect(gentle.bonusTasks).toContain('stallCare');
      expect(gentle.bondingModifier).toBe(1.2);
      expect(gentle.specialConditions.horseTraits).toContain('nervous');
      expect(gentle.specialConditions.bonusSuccessRate).toBe(0.1);
    });

    it('aloof penalty config: penalty true, empty bonusTasks, bonding<1.0, streakGrowth<1.0', () => {
      const { aloof } = GROOM_PERSONALITY_EFFECTS;
      expect(aloof.penalty).toBe(true);
      expect(aloof.bonusTasks).toEqual([]);
      expect(aloof.bondingModifier).toBeLessThan(1.0);
      expect(aloof.streakGrowthModifier).toBeLessThan(1.0);
    });
  });

  describe('bonusesApplied / specialConditionMet behavioral fields', () => {
    it('gentle + nervous horse + brushing: taskSpecialty + traitMatch applied', () => {
      const result = calculatePersonalityEffects(mkGroom('gentle'), mkHorse(), 'brushing', baseEffects());
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.specialConditionMet).toBe(true);
      expect(result.personalityEffects.bonusesApplied).toContain('taskSpecialty');
      expect(result.personalityEffects.bonusesApplied).toContain('traitMatch');
    });

    it('playful + young horse: ageMatch applied, streakGrowth × 1.15', () => {
      const result = calculatePersonalityEffects(
        mkGroom('playful'),
        // Equoria-xggat: age is game-years; 2 is under 3 (old contract: 500 inside [0, 1095])
        mkHorse({ age: 2 }),
        'groomingGame',
        baseEffects(),
      );
      expect(result.personalityEffects.bonusesApplied).toContain('taskSpecialty');
      expect(result.personalityEffects.bonusesApplied).toContain('ageMatch');
      expect(result.streakGrowth).toBe(Math.round(baseEffects().streakGrowth * 1.15));
    });

    it('firm + stubborn horse: traitMatch applied, traitInfluence × 1.3', () => {
      const horse = mkHorse({ traits: [{ name: 'stubborn', type: 'behavioral' }] });
      const result = calculatePersonalityEffects(mkGroom('firm'), horse, 'handWalking', baseEffects());
      expect(result.personalityEffects.bonusesApplied).toContain('traitMatch');
      expect(result.traitInfluence).toBe(Math.round(baseEffects().traitInfluence * 1.3));
    });

    // Owner ruling 2026-10-22 (Equoria-0d4wa) replaced the old contract (patient
    // lowered and highEnergy raised a burnout risk): there is no burnout, so no
    // personality produces or scales a burnoutRisk.
    it('patient + enrichment task: categoryMatch applied, no burnoutRisk', () => {
      const result = calculatePersonalityEffects(mkGroom('patient'), mkHorse(), 'puddleTraining', baseEffects());
      expect(result.personalityEffects.bonusesApplied).toContain('categoryMatch');
      expect(result.burnoutRisk).toBeUndefined();
    });

    it('highEnergy: extraTraitPoints (× 1.4 + 1), no burnoutRisk', () => {
      const result = calculatePersonalityEffects(mkGroom('highEnergy'), mkHorse(), 'obstacleCourse', baseEffects());
      expect(result.personalityEffects.bonusesApplied).toContain('extraTraitPoints');
      expect(result.traitInfluence).toBe(Math.round(baseEffects().traitInfluence * 1.4) + 1);
      expect(result.burnoutRisk).toBeUndefined();
    });

    it('aloof: taskBonus false, specialConditionMet false, bonding × 0.8, success × 0.9', () => {
      const result = calculatePersonalityEffects(mkGroom('aloof'), mkHorse(), 'brushing', baseEffects());
      expect(result.personalityEffects.taskBonus).toBe(false);
      expect(result.personalityEffects.specialConditionMet).toBe(false);
      expect(result.bondingChange).toBe(Math.round(baseEffects().bondingChange * 0.8));
      expect(result.successRate).toBe(baseEffects().successRate * 0.9);
      expect(result.streakGrowth).toBe(Math.round(baseEffects().streakGrowth * 0.9));
    });
  });

  describe('getPersonalityEffectSummary — exact gentle summary', () => {
    it('gentle + brushing summary has bonding 1.2 and nervous specialCondition', () => {
      const summary = getPersonalityEffectSummary('gentle', 'brushing');
      expect(summary.hasEffect).toBe(true);
      expect(summary.taskBonus).toBe(true);
      expect(summary.modifiers.bonding).toBe(1.2);
      expect(summary.specialConditions.horseTraits).toContain('nervous');
    });
  });
});
