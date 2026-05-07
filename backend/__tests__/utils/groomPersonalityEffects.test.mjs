/**
 * groomPersonalityEffects — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
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
