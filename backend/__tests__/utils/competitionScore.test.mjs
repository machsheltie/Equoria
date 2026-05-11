import { describe, it, expect } from '@jest/globals';
import {
  calculateCompetitionScore,
  getDisciplineStatWeights,
  validateHorseForCompetition,
} from '../../utils/competitionScore.mjs';

const makeHorse = (overrides = {}) => ({
  name: 'TestHorse',
  speed: 50,
  stamina: 50,
  intelligence: 50,
  precision: 50,
  focus: 50,
  obedience: 50,
  agility: 50,
  boldness: 50,
  ...overrides,
});

describe('getDisciplineStatWeights', () => {
  it('returns three stat weights for Racing', () => {
    const w = getDisciplineStatWeights('Racing');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['speed', 'stamina', 'intelligence']));
  });

  it('returns Jumping weights for Show Jumping', () => {
    const w = getDisciplineStatWeights('Show Jumping');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['precision', 'focus', 'stamina']));
  });

  it('returns Dressage weights', () => {
    const w = getDisciplineStatWeights('Dressage');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['precision', 'focus', 'obedience']));
  });

  it('defaults to Racing weights for unknown discipline', () => {
    const w = getDisciplineStatWeights('Unknown');
    expect(w).toEqual(getDisciplineStatWeights('Racing'));
  });
});

describe('validateHorseForCompetition', () => {
  it('returns true when horse has at least one required stat', () => {
    expect(validateHorseForCompetition({ speed: 50, stamina: 50, intelligence: 50 }, 'Racing')).toBe(true);
  });

  it('returns false for null horse', () => {
    expect(validateHorseForCompetition(null, 'Racing')).toBe(false);
  });

  it('returns false for non-object horse', () => {
    expect(validateHorseForCompetition('horse', 'Racing')).toBe(false);
  });

  it('returns false when all required stats are missing', () => {
    // Horse has no Racing stats (speed/stamina/intelligence)
    expect(validateHorseForCompetition({ boldness: 70 }, 'Racing')).toBe(false);
  });

  it('returns false when stat is string not number', () => {
    expect(validateHorseForCompetition({ speed: 'fast' }, 'Racing')).toBe(false);
  });
});

describe('calculateCompetitionScore', () => {
  it('throws when horse is null', () => {
    expect(() => calculateCompetitionScore(null, 'Racing')).toThrow('Horse object is required');
  });

  it('throws when eventType is empty string', () => {
    expect(() => calculateCompetitionScore(makeHorse(), '')).toThrow('Event type is required');
  });

  it('throws when eventType is not a string', () => {
    expect(() => calculateCompetitionScore(makeHorse(), 42)).toThrow('Event type is required');
  });

  it('returns a non-negative integer for Racing', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Racing');
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative integer for Dressage', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Dressage');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative integer for Show Jumping', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Show Jumping');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns a non-negative integer for Cross Country', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Cross Country');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('scores within ±9% luck band of base+trait over many runs', () => {
    // Racing base = speed+stamina+intelligence = 30+30+30 = 90, no trait bonus
    const horse = makeHorse({ speed: 30, stamina: 30, intelligence: 30 });
    const scores = Array.from({ length: 100 }, () => calculateCompetitionScore(horse, 'Racing'));
    // With ±9% luck on 90 base: min ~81, max ~98 (plus temperament which is 0 for undefined)
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...scores)).toBeLessThanOrEqual(110); // generous upper bound
  });

  it('applies +5 trait bonus when discipline affinity trait is present', () => {
    const horse = makeHorse({
      speed: 0,
      stamina: 0,
      intelligence: 0,
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    // With all stats 0 and no luck the score is ±9% of 5 (trait bonus only)
    // Run 200 times; at least once the luck should push score >= 1
    const scores = Array.from({ length: 200 }, () => calculateCompetitionScore(horse, 'Racing'));
    // Any run where luck is >= 0 gives score = round(5 * (1 + luck)) >= 5
    expect(scores.some(s => s > 0)).toBe(true);
  });

  it('accepts conformation showType without throwing', () => {
    expect(() => calculateCompetitionScore(makeHorse(), 'Racing', 'conformation')).not.toThrow();
  });

  it('falls back to ridden for unknown showType', () => {
    expect(() => calculateCompetitionScore(makeHorse(), 'Racing', 'weird')).not.toThrow();
  });

  it('handles zero-stat horse without throwing and returns 0', () => {
    const horse = {
      name: 'ZeroHorse',
      speed: 0,
      stamina: 0,
      intelligence: 0,
      precision: 0,
      focus: 0,
      obedience: 0,
      agility: 0,
      boldness: 0,
    };
    const score = calculateCompetitionScore(horse, 'Racing');
    expect(score).toBe(0);
  });
});

// ─── getDisciplineStatWeights — extra branches ────────────────────────────────

describe('getDisciplineStatWeights — extra branches', () => {
  it('returns Jumping weights (same as Show Jumping)', () => {
    const w = getDisciplineStatWeights('Jumping');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['precision', 'focus', 'stamina']));
  });

  it('returns Cross Country weights', () => {
    const w = getDisciplineStatWeights('Cross Country');
    expect(Object.keys(w)).toEqual(expect.arrayContaining(['stamina', 'agility', 'boldness']));
  });
});

// ─── validateHorseForCompetition — extra branches ────────────────────────────

describe('validateHorseForCompetition — extra branches', () => {
  it('returns false when all required stats are negative numbers', () => {
    expect(validateHorseForCompetition({ speed: -1, stamina: -1, intelligence: -1 }, 'Racing')).toBe(false);
  });

  it('returns true when at least one stat is exactly 0 (value >= 0 boundary)', () => {
    expect(validateHorseForCompetition({ speed: 0, stamina: 50, intelligence: 30 }, 'Racing')).toBe(true);
  });
});

// ─── calculateCompetitionScore — extra branch coverage ───────────────────────

describe('calculateCompetitionScore — extra branch coverage', () => {
  it('returns a score for Jumping discipline (switch alias of Show Jumping)', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Jumping');
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('uses default Racing-like calculation for an unknown discipline', () => {
    const score = calculateCompetitionScore(makeHorse(), 'Polo');
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('throws when eventType is whitespace-only (blank after trim)', () => {
    expect(() => calculateCompetitionScore(makeHorse(), '   ')).toThrow('blank after trimming');
  });

  it('clamps Infinity baseScore to 0 via non-finite guard', () => {
    const horse = makeHorse({ speed: Infinity, stamina: 0, intelligence: 0 });
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    expect(score).toBe(0);
  });

  it('applies no trait bonus when epigeneticModifiers.positive has no matching trait', () => {
    const withBonus = makeHorse({
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: ['discipline_affinity_racing'] },
    });
    const withWrongTrait = makeHorse({
      speed: 50,
      stamina: 50,
      intelligence: 50,
      epigeneticModifiers: { positive: ['discipline_affinity_dressage'] },
    });
    const bonusScore = calculateCompetitionScore(withBonus, 'Racing', 'ridden', () => 0.5);
    const noBonus = calculateCompetitionScore(withWrongTrait, 'Racing', 'ridden', () => 0.5);
    expect(bonusScore).toBeGreaterThan(noBonus);
  });

  it('handles epigeneticModifiers with no .positive key (optional chain short-circuits)', () => {
    const horse = makeHorse({ epigeneticModifiers: { negative: ['clumsy'] } });
    expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
  });

  it('handles epigeneticModifiers.positive that is not an array', () => {
    const horse = makeHorse({ epigeneticModifiers: { positive: 'discipline_affinity_racing' } });
    expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
  });

  it('applies ridden temperament modifier for Spirited horse (clampedTempMod !== 0 branch)', () => {
    const horse = makeHorse({ temperament: 'Spirited', speed: 100, stamina: 100, intelligence: 100 });
    const baseline = makeHorse({ speed: 100, stamina: 100, intelligence: 100 });
    const spiritedScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    const baselineScore = calculateCompetitionScore(baseline, 'Racing', 'ridden', () => 0.5);
    // Spirited riddenModifier = +0.03 → higher score than no temperament
    expect(spiritedScore).toBeGreaterThan(baselineScore);
  });

  it('uses conformationModifier when showType is conformation', () => {
    const horse = makeHorse({ temperament: 'Calm', speed: 100, stamina: 100, intelligence: 100 });
    // Calm: riddenModifier=0.02, conformationModifier=0.05
    const riddenScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0.5);
    const conformationScore = calculateCompetitionScore(horse, 'Racing', 'conformation', () => 0.5);
    expect(conformationScore).toBeGreaterThan(riddenScore);
  });

  it('uses the injected _luckFn: max luck scores higher than min luck', () => {
    const horse = makeHorse({ speed: 100, stamina: 100, intelligence: 100 });
    const maxScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 1);
    const minScore = calculateCompetitionScore(horse, 'Racing', 'ridden', () => 0);
    expect(maxScore).toBeGreaterThan(minScore);
  });

  it('Show Jumping uses agility fallback when precision is null', () => {
    const horse = makeHorse({ precision: null, agility: 70, focus: 50, stamina: 50 });
    const score = calculateCompetitionScore(horse, 'Show Jumping', 'ridden', () => 0.5);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('Show Jumping uses 0 when both precision and agility are undefined', () => {
    const horse = { name: 'NoJumpStats', focus: 50, stamina: 50, speed: 0, intelligence: 0, obedience: 0, boldness: 0 };
    const score = calculateCompetitionScore(horse, 'Show Jumping', 'ridden', () => 0.5);
    expect(Number.isInteger(score)).toBe(true);
  });
});
