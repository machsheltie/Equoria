/**
 * Competition Score Calculation Tests
 *
 * Tests calculateCompetitionScore / getDisciplineStatWeights /
 * validateHorseForCompetition against real function logic. No mocks of any kind.
 *
 * Controlled-randomness tests use the built-in `_luckFn` parameter of
 * calculateCompetitionScore (4th argument) instead of mocking Math.random.
 * This is the function's own injection point for deterministic testing.
 *
 * Formula reference:
 *   base = stat1 + stat2 + stat3
 *   luck = _luckFn() * 0.18 - 0.09   (range: -0.09 to +0.09, i.e. ±9%)
 *   final = round(max(0, (base + traitBonus) * (1 + tempMod) * (1 + luck)))
 *
 * Test horses use temperament: null, which produces tempMod = 0 (neutral).
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateCompetitionScore,
  getDisciplineStatWeights,
  validateHorseForCompetition,
} from '../utils/competitionScore.mjs';

// ─── helpers ─────────────────────────────────────────────────────────────────

const NEUTRAL_LUCK = () => 0.5; // _luckFn returns 0.5 → luckModifier = 0

function mkHorse(stats = {}, positiveTraits = []) {
  return {
    id: 1,
    name: 'Test Horse',
    speed: 70,
    stamina: 60,
    focus: 50,
    agility: 60,
    precision: 55,
    balance: 55,
    boldness: 50,
    temperament: null, // neutral — tempMod = 0
    epigeneticModifiers: {
      positive: positiveTraits,
      negative: [],
      hidden: [],
    },
    ...stats,
  };
}

// ─── calculateCompetitionScore — basic scoring ────────────────────────────────

describe('calculateCompetitionScore — base scoring per discipline', () => {
  it('Racing: uses speed + stamina + intelligence (tolerance ±9%)', () => {
    const horse = mkHorse({ speed: 80, stamina: 70, intelligence: 60 });
    const score = calculateCompetitionScore(horse, 'Racing');

    // Base = 210, ±9% range = [191, 229]
    expect(score).toBeGreaterThanOrEqual(191);
    expect(score).toBeLessThanOrEqual(229);
  });

  it('Show Jumping: uses precision + focus + stamina (tolerance ±9%)', () => {
    const horse = mkHorse({ precision: 80, focus: 70, stamina: 60 });
    const score = calculateCompetitionScore(horse, 'Show Jumping');

    expect(score).toBeGreaterThanOrEqual(191);
    expect(score).toBeLessThanOrEqual(229);
  });

  it('Dressage: uses precision + focus + obedience (tolerance ±9%)', () => {
    const horse = mkHorse({ precision: 80, focus: 70, obedience: 60 });
    const score = calculateCompetitionScore(horse, 'Dressage');

    expect(score).toBeGreaterThanOrEqual(191);
    expect(score).toBeLessThanOrEqual(229);
  });

  it('Cross Country: uses stamina + agility + boldness (tolerance ±9%)', () => {
    const horse = mkHorse({ stamina: 80, agility: 70, boldness: 60 });
    const score = calculateCompetitionScore(horse, 'Cross Country');

    expect(score).toBeGreaterThanOrEqual(191);
    expect(score).toBeLessThanOrEqual(229);
  });

  it('missing stats default to 0', () => {
    const horse = mkHorse({ speed: undefined, stamina: null, intelligence: 80 });
    const score = calculateCompetitionScore(horse, 'Racing');

    // Base = 0 + 0 + 80 = 80, ±9% range = [73, 88]
    expect(score).toBeGreaterThanOrEqual(73);
    expect(score).toBeLessThanOrEqual(88);
  });

  it('returns an integer', () => {
    const score = calculateCompetitionScore(mkHorse(), 'Racing');
    expect(Number.isInteger(score)).toBe(true);
  });

  it('handles unknown event type without throwing (defaults to Racing stats)', () => {
    const horse = mkHorse({ speed: 70, stamina: 60, intelligence: 50 });

    expect(() => calculateCompetitionScore(horse, 'Unknown Event')).not.toThrow();

    const score = calculateCompetitionScore(horse, 'Unknown Event');
    expect(typeof score).toBe('number');
  });

  it('handles missing epigeneticModifiers without throwing', () => {
    const horse = { id: 1, name: 'No Mods', speed: 70, stamina: 60, intelligence: 50, temperament: null };

    expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
    expect(typeof calculateCompetitionScore(horse, 'Racing')).toBe('number');
  });

  it('handles null epigeneticModifiers.positive without throwing', () => {
    const horse = mkHorse();
    horse.epigeneticModifiers.positive = null;

    expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
  });
});

// ─── calculateCompetitionScore — input validation ─────────────────────────────

describe('calculateCompetitionScore — input validation', () => {
  it('throws for null horse', () => {
    expect(() => calculateCompetitionScore(null, 'Racing')).toThrow('Horse object is required');
  });

  it('throws for undefined horse', () => {
    expect(() => calculateCompetitionScore(undefined, 'Racing')).toThrow('Horse object is required');
  });

  it('throws for non-object horse', () => {
    expect(() => calculateCompetitionScore('invalid', 'Racing')).toThrow('Horse object is required');
  });

  it('throws for null event type', () => {
    expect(() => calculateCompetitionScore(mkHorse(), null)).toThrow('Event type is required and must be a string');
  });

  it('throws for missing event type', () => {
    expect(() => calculateCompetitionScore(mkHorse())).toThrow('Event type is required and must be a string');
  });

  it('throws for numeric event type', () => {
    expect(() => calculateCompetitionScore(mkHorse(), 123)).toThrow('Event type is required and must be a string');
  });
});

// ─── trait bonus — deterministic via _luckFn ─────────────────────────────────

describe('trait bonus (+5) — deterministic via _luckFn injection', () => {
  it('trait horse scores exactly 5 more than regular horse when luck is neutral', () => {
    const stats = { speed: 70, stamina: 60, intelligence: 50 };
    const traitHorse = mkHorse(stats, ['discipline_affinity_racing']);
    const regularHorse = mkHorse(stats);

    const traitScore = calculateCompetitionScore(traitHorse, 'Racing', 'ridden', NEUTRAL_LUCK);
    const regularScore = calculateCompetitionScore(regularHorse, 'Racing', 'ridden', NEUTRAL_LUCK);

    expect(traitScore - regularScore).toBe(5);
  });

  it('non-matching trait gives 0 bonus when luck is neutral', () => {
    const stats = { speed: 70, stamina: 60, intelligence: 50 };
    const wrongTraitHorse = mkHorse(stats, ['discipline_affinity_dressage']);
    const regularHorse = mkHorse(stats);

    const wrongScore = calculateCompetitionScore(wrongTraitHorse, 'Racing', 'ridden', NEUTRAL_LUCK);
    const regularScore = calculateCompetitionScore(regularHorse, 'Racing', 'ridden', NEUTRAL_LUCK);

    expect(wrongScore - regularScore).toBe(0);
  });

  it('Racing base 180 with neutral luck = 180 (no trait)', () => {
    const horse = mkHorse({ speed: 70, stamina: 60, intelligence: 50 });
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', NEUTRAL_LUCK);

    expect(score).toBe(180);
  });

  it('Racing base 180 + trait = 185 with neutral luck', () => {
    const horse = mkHorse({ speed: 70, stamina: 60, intelligence: 50 }, ['discipline_affinity_racing']);
    const score = calculateCompetitionScore(horse, 'Racing', 'ridden', NEUTRAL_LUCK);

    expect(score).toBe(185);
  });

  it('applies +5 bonus for each discipline when luck is neutral', () => {
    const disciplineConfigs = [
      { name: 'Racing', trait: 'discipline_affinity_racing', stats: { speed: 70, stamina: 60, intelligence: 50 } },
      {
        name: 'Show Jumping',
        trait: 'discipline_affinity_show_jumping',
        stats: { precision: 70, focus: 60, stamina: 50 },
      },
      { name: 'Dressage', trait: 'discipline_affinity_dressage', stats: { precision: 70, focus: 60, obedience: 50 } },
      {
        name: 'Cross Country',
        trait: 'discipline_affinity_cross_country',
        stats: { stamina: 70, agility: 60, boldness: 50 },
      },
    ];

    for (const { name, trait, stats } of disciplineConfigs) {
      const traitHorse = mkHorse(stats, [trait]);
      const regularHorse = mkHorse(stats);

      const diff =
        calculateCompetitionScore(traitHorse, name, 'ridden', NEUTRAL_LUCK) -
        calculateCompetitionScore(regularHorse, name, 'ridden', NEUTRAL_LUCK);

      expect(diff).toBe(5);
    }
  });
});

// ─── luck modifier — deterministic via _luckFn ────────────────────────────────

describe('luck modifier — deterministic via _luckFn injection', () => {
  const horse300 = mkHorse({ speed: 100, stamina: 100, intelligence: 100 });

  it('minimum luck (_luckFn = 0) applies -9%: 300 → 273', () => {
    const score = calculateCompetitionScore(horse300, 'Racing', 'ridden', () => 0);
    expect(score).toBe(273); // 300 * 0.91 = 273
  });

  it('maximum luck (_luckFn = 1) applies +9%: 300 → 327', () => {
    const score = calculateCompetitionScore(horse300, 'Racing', 'ridden', () => 1);
    expect(score).toBe(327); // 300 * 1.09 = 327
  });

  it('neutral luck (_luckFn = 0.5) applies 0%: 300 → 300', () => {
    const score = calculateCompetitionScore(horse300, 'Racing', 'ridden', NEUTRAL_LUCK);
    expect(score).toBe(300);
  });

  it('real Math.random produces scores within [273, 327] for base=300 over 50 runs', () => {
    const scores = Array.from({ length: 50 }, () => calculateCompetitionScore(horse300, 'Racing'));

    const min = Math.min(...scores);
    const max = Math.max(...scores);

    expect(min).toBeGreaterThanOrEqual(273);
    expect(max).toBeLessThanOrEqual(327);
    expect(max).toBeGreaterThan(min); // variance exists
  });
});

// ─── getDisciplineStatWeights ─────────────────────────────────────────────────

describe('getDisciplineStatWeights', () => {
  it('returns correct weights for Racing', () => {
    expect(getDisciplineStatWeights('Racing')).toEqual({
      speed: 1.0,
      stamina: 1.0,
      intelligence: 1.0,
    });
  });

  it('returns correct weights for Show Jumping', () => {
    expect(getDisciplineStatWeights('Show Jumping')).toEqual({
      precision: 1.0,
      focus: 1.0,
      stamina: 1.0,
    });
  });

  it('returns correct weights for Dressage', () => {
    expect(getDisciplineStatWeights('Dressage')).toEqual({
      precision: 1.0,
      focus: 1.0,
      obedience: 1.0,
    });
  });

  it('returns correct weights for Cross Country', () => {
    expect(getDisciplineStatWeights('Cross Country')).toEqual({
      stamina: 1.0,
      agility: 1.0,
      boldness: 1.0,
    });
  });

  it('returns Racing weights for unknown discipline', () => {
    expect(getDisciplineStatWeights('Unknown')).toEqual({
      speed: 1.0,
      stamina: 1.0,
      intelligence: 1.0,
    });
  });
});

// ─── validateHorseForCompetition ─────────────────────────────────────────────

describe('validateHorseForCompetition', () => {
  it('returns true for a valid horse with all required stats', () => {
    expect(validateHorseForCompetition(mkHorse({ speed: 70, stamina: 60, intelligence: 50 }), 'Racing')).toBe(true);
  });

  it('returns false for null horse', () => {
    expect(validateHorseForCompetition(null, 'Racing')).toBe(false);
  });

  it('returns false for undefined horse', () => {
    expect(validateHorseForCompetition(undefined, 'Racing')).toBe(false);
  });

  it('returns false for non-object horse', () => {
    expect(validateHorseForCompetition('invalid', 'Racing')).toBe(false);
  });

  it('returns true if horse has at least one required stat', () => {
    expect(validateHorseForCompetition({ speed: 70 }, 'Racing')).toBe(true);
  });

  it('returns false if horse has none of the required stats', () => {
    expect(validateHorseForCompetition({ name: 'Test' }, 'Racing')).toBe(false);
  });
});
