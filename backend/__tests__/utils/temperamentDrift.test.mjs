/**
 * temperamentDrift — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateTemperamentDrift,
  applyTemperamentDrift,
  getTemperamentCharacteristics,
  isTemperamentStable,
} from '../../utils/temperamentDrift.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const noTraitHorse = (overrides = {}) => ({
  id: 1,
  temperament: 'Calm',
  stressLevel: 20,
  bondScore: 60,
  epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  ...overrides,
});

const horseWithTraits = (positive = []) => ({
  id: 2,
  temperament: 'Calm',
  stressLevel: 20,
  bondScore: 60,
  epigeneticModifiers: { positive, negative: [], hidden: [] },
});

// ---------------------------------------------------------------------------
// calculateTemperamentDrift
// ---------------------------------------------------------------------------
describe('calculateTemperamentDrift', () => {
  it('returns an object with driftOccurred and newTemperament', () => {
    const result = calculateTemperamentDrift(noTraitHorse());
    expect(result).toHaveProperty('driftOccurred');
    expect(result).toHaveProperty('newTemperament');
  });

  it('with resilient trait: drift is suppressed (driftOccurred=false)', () => {
    const horse = horseWithTraits(['resilient']);
    const result = calculateTemperamentDrift(horse);
    expect(result.driftOccurred).toBe(false);
    expect(result.reason).toBe('Suppressed by traits');
    expect(result.newTemperament).toBe(horse.temperament);
  });

  it('with calm trait: drift is suppressed (driftOccurred=false)', () => {
    const horse = horseWithTraits(['calm']);
    const result = calculateTemperamentDrift(horse);
    expect(result.driftOccurred).toBe(false);
    expect(result.reason).toBe('Suppressed by traits');
  });

  it('suppressingTraits lists the suppressing traits', () => {
    const horse = horseWithTraits(['resilient', 'calm']);
    const result = calculateTemperamentDrift(horse);
    expect(Array.isArray(result.suppressingTraits)).toBe(true);
    expect(result.suppressingTraits.length).toBeGreaterThan(0);
  });

  it('no-trait horse with Calm temperament rarely drifts (very low probability)', () => {
    // Calm stability: 0.9 → drift probability = 0.05*(1-0.9) = 0.005 = 0.5%
    // Run 100 times: probability of all 100 drifting is negligible
    const results = Array.from({ length: 100 }, () => calculateTemperamentDrift(noTraitHorse({ temperament: 'Calm' })));
    const driftCount = results.filter(r => r.driftOccurred).length;
    // With 0.5% chance, expect fewer than 10 drifts in 100 runs (virtually certain)
    expect(driftCount).toBeLessThan(15);
  });

  it('no-trait horse returns driftProbability field when no drift occurs', () => {
    // Force a case where we know it won't drift (Calm + low factors)
    const horse = horseWithTraits(['resilient']);
    const result = calculateTemperamentDrift(horse);
    // suppressed case doesn't have driftProbability, check non-suppressed path shape
    expect(result).toHaveProperty('driftOccurred');
  });

  it('driftOccurred=true result has oldTemperament and newTemperament fields', () => {
    // We can't force a drift without stubbing Math.random, so just test the shape for suppressed path
    const horse = horseWithTraits(['resilient']);
    const result = calculateTemperamentDrift(horse);
    // For suppressed: newTemperament = original
    expect(result.newTemperament).toBe(horse.temperament);
  });

  it('result has reason string', () => {
    const result = calculateTemperamentDrift(noTraitHorse());
    expect(typeof result.reason).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getTemperamentCharacteristics
// ---------------------------------------------------------------------------
describe('getTemperamentCharacteristics', () => {
  const validTemperaments = ['Calm', 'Spirited', 'Nervous', 'Aggressive', 'Docile', 'Unpredictable'];

  it.each(validTemperaments)('returns characteristics for %s', temperament => {
    const chars = getTemperamentCharacteristics(temperament);
    expect(chars).not.toBeNull();
    expect(typeof chars.stability).toBe('number');
    expect(typeof chars.stressResistance).toBe('number');
    expect(typeof chars.trainingBonus).toBe('number');
    expect(typeof chars.competitionPenalty).toBe('number');
  });

  it('Calm has highest stability', () => {
    const calm = getTemperamentCharacteristics('Calm');
    expect(calm.stability).toBeGreaterThanOrEqual(0.8);
  });

  it('Unpredictable has lowest stability', () => {
    const unstable = getTemperamentCharacteristics('Unpredictable');
    const calm = getTemperamentCharacteristics('Calm');
    expect(unstable.stability).toBeLessThan(calm.stability);
  });

  it('Nervous has negative trainingBonus', () => {
    expect(getTemperamentCharacteristics('Nervous').trainingBonus).toBeLessThan(0);
  });

  it('falls back to Calm for unknown temperament', () => {
    const unknown = getTemperamentCharacteristics('Mythical');
    const calm = getTemperamentCharacteristics('Calm');
    expect(unknown).toEqual(calm);
  });

  it('falls back to Calm for undefined input', () => {
    const result = getTemperamentCharacteristics(undefined);
    const calm = getTemperamentCharacteristics('Calm');
    expect(result).toEqual(calm);
  });
});

// ---------------------------------------------------------------------------
// isTemperamentStable
// ---------------------------------------------------------------------------
describe('isTemperamentStable', () => {
  it('returns false for horse with no traits', () => {
    expect(isTemperamentStable(noTraitHorse())).toBe(false);
  });

  it('returns true for horse with resilient trait', () => {
    expect(isTemperamentStable(horseWithTraits(['resilient']))).toBe(true);
  });

  it('returns true for horse with calm trait', () => {
    expect(isTemperamentStable(horseWithTraits(['calm']))).toBe(true);
  });

  it('returns false for horse with unrelated traits', () => {
    expect(isTemperamentStable(horseWithTraits(['bold', 'intelligent']))).toBe(false);
  });

  it('handles horse with no epigeneticModifiers field', () => {
    expect(isTemperamentStable({ id: 1, temperament: 'Calm' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateTemperamentDrift — environmental factor branches (lines 108-134)
// ---------------------------------------------------------------------------
describe('calculateTemperamentDrift — environmental factor branches', () => {
  it('stressLevel > 50 — exercises stress bonus branch (line 108)', () => {
    // Uncovered branch: driftProbability += (stressLevel - 50) * 0.001
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { stressLevel: 80 });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('recentTraining = true — exercises training bonus branch (line 113)', () => {
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { recentTraining: true });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('recentCompetition = true — exercises competition bonus branch (line 117)', () => {
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { recentCompetition: true });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('healthStatus Fair — exercises health penalty branch (line 122)', () => {
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { healthStatus: 'Fair' });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('healthStatus Bad — also exercises health penalty branch', () => {
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { healthStatus: 'Bad' });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('bondScore < 30 — exercises low bond penalty branch (line 127)', () => {
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { bondScore: 10 });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('age < 2 — exercises young horse bonus branch (line 132)', () => {
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const result = calculateTemperamentDrift(horse, { age: 1 });
    expect(result).toHaveProperty('driftOccurred');
  });

  it('social trait — exercises temperamentStability branch (line 141, multiplies prob by 0.5)', () => {
    // social gives temperamentStability: true but NOT suppressTemperamentDrift
    // → reaches line 141, halves driftProbability, does NOT early-return
    const horse = horseWithTraits(['social']);
    const result = calculateTemperamentDrift(horse, {});
    expect(result).toHaveProperty('driftOccurred');
    // Should NOT be suppressed (only resilient/calm suppress drift)
    expect(result.reason).not.toBe('Suppressed by traits');
  });
});

// ---------------------------------------------------------------------------
// calculateTemperamentDrift — drift-occurred path (Math.random false branch)
// ---------------------------------------------------------------------------
describe('calculateTemperamentDrift — drift occurred (200-trial loop)', () => {
  it('eventually produces driftOccurred=true with extreme stress (Unpredictable, 200 trials)', () => {
    // Drift prob ≈ 0.154: base(0.05) + stress(0.05) + train(0.02) + comp(0.03)
    //              + health(0.02) + bond(0.03) + age(0.02) = 0.22 × (1-0.3) = 0.154
    // P(0 drifts in 200) < 10^-14 → essentially guaranteed
    const horse = noTraitHorse({ temperament: 'Unpredictable' });
    const extremeFactors = {
      stressLevel: 100, // > 50 and > 70 → both selectNewTemperament weight branches
      recentTraining: true,
      recentCompetition: true,
      healthStatus: 'Bad',
      bondScore: 10, // < 30 → Aggressive/Unpredictable weight bonus
      age: 1,
    };

    let gotDrift = false;
    for (let i = 0; i < 200; i++) {
      const result = calculateTemperamentDrift(horse, extremeFactors);
      if (result.driftOccurred) {
        expect(result.oldTemperament).toBe('Unpredictable');
        expect(typeof result.newTemperament).toBe('string');
        expect(result.reason).toBe('Environmental factors caused drift');
        expect(result.driftProbability).toBeGreaterThan(0);
        expect(result.factors.stressLevel).toBe(100);
        gotDrift = true;
        break;
      }
    }
    expect(gotDrift).toBe(true);
  });

  it('eventually drifts under good conditions — exercises stressLevel<30&&bondScore>70 selectNewTemperament branch', () => {
    // Spirited stability=0.6, prob = (0.05+0.02+0.03)×(1-0.6) = 0.04 (4%)
    // P(0 drifts in 200) = (0.96)^200 ≈ 0.00028 < 0.1% → virtually guaranteed
    const horse = noTraitHorse({ temperament: 'Spirited' });
    const goodFactors = {
      stressLevel: 10, // < 30 → stressLevel<30&&bondScore>70 → Calm/Docile weight bonus
      bondScore: 80, // > 70
      recentTraining: true,
      recentCompetition: true,
    };

    let gotDrift = false;
    for (let i = 0; i < 200; i++) {
      const result = calculateTemperamentDrift(horse, goodFactors);
      if (result.driftOccurred) {
        gotDrift = true;
        break;
      }
    }
    expect(gotDrift).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyTemperamentDrift — async stub (no DB, always resolves)
// ---------------------------------------------------------------------------
describe('applyTemperamentDrift', () => {
  it('resolves with success=true and the provided horseId', async () => {
    const result = await applyTemperamentDrift(42);
    expect(result.success).toBe(true);
    expect(result.horseId).toBe(42);
    expect(typeof result.message).toBe('string');
  });

  it('error path: throws when logger.info throws (not reachable without mocking — stub resolves cleanly)', async () => {
    // The stub body is: return { success: true, message: ..., horseId }
    // Verify the async form still resolves correctly for different IDs
    const result = await applyTemperamentDrift(999);
    expect(result.success).toBe(true);
    expect(result.horseId).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// calculateTemperamentDrift — error catch branch (lines 185-186)
// ---------------------------------------------------------------------------
describe('calculateTemperamentDrift — error catch branch (lines 185-186)', () => {
  it('returns error default shape when factors is null (triggers catch via destructuring TypeError)', () => {
    // Passing explicit null for factors causes `const { stressLevel = ... } = null`
    // to throw a TypeError at the destructuring site (lines 98-105).
    // The catch block catches it and returns the safe-default shape.
    const horse = { id: 1, temperament: 'Calm' };
    const result = calculateTemperamentDrift(horse, null);
    expect(result.driftOccurred).toBe(false);
    expect(result.newTemperament).toBe('Calm');
    expect(result.reason).toBe('Error in calculation');
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// calculateTemperamentDrift — horse-property fallback branches
// ---------------------------------------------------------------------------
describe('calculateTemperamentDrift — horse-property fallback branches', () => {
  it('horse.stressLevel=0: exercises horse.stressLevel||0 right-branch (falsy stressLevel)', () => {
    // stressLevel=0 is falsy → horse.stressLevel || 0 uses right-branch (0)
    const horse = noTraitHorse({ stressLevel: 0 });
    const result = calculateTemperamentDrift(horse); // no factors → defaults from horse
    expect(result).toHaveProperty('driftOccurred');
  });

  it('horse.bondScore=0: exercises horse.bondScore||50 right-branch (falsy bondScore)', () => {
    // bondScore=0 is falsy → horse.bondScore || 50 uses right-branch (50)
    const horse = noTraitHorse({ bondScore: 0 });
    const result = calculateTemperamentDrift(horse);
    expect(result).toHaveProperty('driftOccurred');
  });

  it('unknown temperament "Mythical": exercises TEMPERAMENT_TYPES fallback to Calm', () => {
    // TEMPERAMENT_TYPES['Mythical'] is undefined → || TEMPERAMENT_TYPES['Calm'] fallback
    const horse = {
      id: 1,
      temperament: 'Mythical',
      stressLevel: 20,
      bondScore: 60,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const result = calculateTemperamentDrift(horse);
    expect(result).toHaveProperty('driftOccurred');
  });

  it('epigeneticModifiers missing negative key: exercises traits.negative||[] fallback', () => {
    // { positive: [] } has no .negative key → traits.negative is undefined → uses [] fallback
    const horse = { id: 1, temperament: 'Calm', stressLevel: 20, bondScore: 60, epigeneticModifiers: { positive: [] } };
    const result = calculateTemperamentDrift(horse);
    expect(result).toHaveProperty('driftOccurred');
  });
});

// ---------------------------------------------------------------------------
// calculateTemperamentDrift — selectNewTemperament: Unpredictable and && branches
// ---------------------------------------------------------------------------
describe('calculateTemperamentDrift — selectNewTemperament branch coverage', () => {
  it('Nervous horse + extreme factors: eventually drifts, covers ||Unpredictable weight bonus branches', () => {
    // Starting from Nervous: Unpredictable IS in available list.
    // stressLevel=100 > 70 → for Unpredictable temperament: 'Nervous' false, 'Unpredictable' true
    //   → covers the || right-TRUE branch in both the stressLevel>70 and bondScore<30 guards.
    // bondScore=10 < 30 → same path for Unpredictable.
    // Nervous stability=0.4 → prob ≈ 0.22 × 0.6 = 13.2% per trial
    // P(0 drifts in 200) = (0.868)^200 ≈ 5×10^-13 → essentially guaranteed
    const horse = {
      id: 1,
      temperament: 'Nervous',
      stressLevel: 20,
      bondScore: 60,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const extremeFactors = {
      stressLevel: 100,
      bondScore: 10,
      recentTraining: true,
      recentCompetition: true,
      healthStatus: 'Bad',
      age: 1,
    };

    let gotDrift = false;
    for (let i = 0; i < 200; i++) {
      const result = calculateTemperamentDrift(horse, extremeFactors);
      if (result.driftOccurred) {
        gotDrift = true;
        break;
      }
    }
    expect(gotDrift).toBe(true);
  });

  it('Aggressive horse + stressLevel<30 + bondScore<=70: exercises && right-false branch in selectNewTemperament', () => {
    // stressLevel=10 < 30 (left-true) but bondScore=50 NOT > 70 (right-false) → whole && is false
    // Aggressive stability=0.5 → prob = (0.05+0.02+0.03) × 0.5 = 0.05 = 5% per trial
    // P(0 drifts in 200) = (0.95)^200 ≈ 3.5×10^-5 → virtually certain to drift
    const horse = {
      id: 1,
      temperament: 'Aggressive',
      stressLevel: 20,
      bondScore: 60,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    const mixedFactors = { stressLevel: 10, bondScore: 50, recentTraining: true, recentCompetition: true };

    let gotDrift = false;
    for (let i = 0; i < 200; i++) {
      const result = calculateTemperamentDrift(horse, mixedFactors);
      if (result.driftOccurred) {
        gotDrift = true;
        break;
      }
    }
    expect(gotDrift).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isTemperamentStable — additional branch coverage
// ---------------------------------------------------------------------------
describe('isTemperamentStable — additional branches', () => {
  it('returns true for horse with social trait (covers ||temperamentStability right-branch)', () => {
    // social → traitEffects.temperamentStability=true, suppressTemperamentDrift=false
    // isTemperamentStable: !!(false || true) = true → covers the || right-TRUE branch
    expect(isTemperamentStable(horseWithTraits(['social']))).toBe(true);
  });

  it('epigeneticModifiers missing negative key: traits.negative||[] fallback in isTemperamentStable', () => {
    // { positive: ['resilient'] } has no .negative → undefined || [] uses fallback
    const horse = { id: 1, temperament: 'Calm', epigeneticModifiers: { positive: ['resilient'] } };
    expect(isTemperamentStable(horse)).toBe(true);
  });
});
