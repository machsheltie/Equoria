/**
 * temperamentService — unit tests (Equoria-rr7)
 *
 * Tests pure-function helpers and breed-backed generator.
 * File-based breed profiles (breedProfiles.json), no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  TEMPERAMENT_TRAINING_MODIFIERS,
  TEMPERAMENT_COMPETITION_MODIFIERS,
  TEMPERAMENT_GROOM_SYNERGY,
  getTemperamentTrainingModifiers,
  getTemperamentCompetitionModifiers,
  getTemperamentGroomSynergy,
  weightedRandomSelect,
  generateTemperament,
} from '../../modules/horses/services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../../modules/horses/data/breedGeneticProfiles.mjs';

// ---------------------------------------------------------------------------
// TEMPERAMENT_TRAINING_MODIFIERS
// ---------------------------------------------------------------------------
describe('TEMPERAMENT_TRAINING_MODIFIERS', () => {
  it('has entries for all 11 temperament types', () => {
    expect(Object.keys(TEMPERAMENT_TRAINING_MODIFIERS)).toHaveLength(11);
  });

  it('each entry has xpModifier and scoreModifier', () => {
    for (const [, mods] of Object.entries(TEMPERAMENT_TRAINING_MODIFIERS)) {
      expect(typeof mods.xpModifier).toBe('number');
      expect(typeof mods.scoreModifier).toBe('number');
    }
  });

  it('Lazy has the most negative xpModifier (-0.2)', () => {
    expect(TEMPERAMENT_TRAINING_MODIFIERS.Lazy.xpModifier).toBe(-0.2);
  });

  it('Spirited has a positive xpModifier', () => {
    expect(TEMPERAMENT_TRAINING_MODIFIERS.Spirited.xpModifier).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TEMPERAMENT_COMPETITION_MODIFIERS
// ---------------------------------------------------------------------------
describe('TEMPERAMENT_COMPETITION_MODIFIERS', () => {
  it('has entries for all 11 temperament types', () => {
    expect(Object.keys(TEMPERAMENT_COMPETITION_MODIFIERS)).toHaveLength(11);
  });

  it('each entry has riddenModifier and conformationModifier', () => {
    for (const [, mods] of Object.entries(TEMPERAMENT_COMPETITION_MODIFIERS)) {
      expect(typeof mods.riddenModifier).toBe('number');
      expect(typeof mods.conformationModifier).toBe('number');
    }
  });

  it('Bold has the highest riddenModifier (0.05)', () => {
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Bold.riddenModifier).toBe(0.05);
  });

  it('Calm has the highest conformationModifier (0.05)', () => {
    expect(TEMPERAMENT_COMPETITION_MODIFIERS.Calm.conformationModifier).toBe(0.05);
  });
});

// ---------------------------------------------------------------------------
// TEMPERAMENT_GROOM_SYNERGY
// ---------------------------------------------------------------------------
describe('TEMPERAMENT_GROOM_SYNERGY', () => {
  it('has entries for all 11 temperament types', () => {
    expect(Object.keys(TEMPERAMENT_GROOM_SYNERGY)).toHaveLength(11);
  });

  it('Calm uses _any for universal synergy', () => {
    expect(TEMPERAMENT_GROOM_SYNERGY.Calm._any).toBeDefined();
  });

  it('Nervous has a negative synergy with strict personality', () => {
    expect(TEMPERAMENT_GROOM_SYNERGY.Nervous.strict).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// getTemperamentTrainingModifiers
// ---------------------------------------------------------------------------
describe('getTemperamentTrainingModifiers', () => {
  it('returns zero modifiers for null', () => {
    const result = getTemperamentTrainingModifiers(null);
    expect(result.xpModifier).toBe(0);
    expect(result.scoreModifier).toBe(0);
  });

  it('returns zero modifiers for undefined', () => {
    const result = getTemperamentTrainingModifiers(undefined);
    expect(result.xpModifier).toBe(0);
    expect(result.scoreModifier).toBe(0);
  });

  it('returns zero modifiers for unknown temperament', () => {
    const result = getTemperamentTrainingModifiers('UnknownTemperament');
    expect(result.xpModifier).toBe(0);
    expect(result.scoreModifier).toBe(0);
  });

  it('returns correct modifiers for Lazy', () => {
    const result = getTemperamentTrainingModifiers('Lazy');
    expect(result.xpModifier).toBe(-0.2);
    expect(result.scoreModifier).toBe(-0.15);
  });

  it('returns correct modifiers for Calm', () => {
    const result = getTemperamentTrainingModifiers('Calm');
    expect(result.xpModifier).toBe(0.05);
    expect(result.scoreModifier).toBe(0.1);
  });

  it('handles whitespace via trim', () => {
    const result = getTemperamentTrainingModifiers('  Calm  ');
    expect(result.xpModifier).toBe(0.05);
  });

  it('returns a copy (not the frozen original)', () => {
    const result = getTemperamentTrainingModifiers('Spirited');
    expect(() => {
      result.xpModifier = 999;
    }).not.toThrow();
    expect(TEMPERAMENT_TRAINING_MODIFIERS.Spirited.xpModifier).not.toBe(999);
  });
});

// ---------------------------------------------------------------------------
// getTemperamentCompetitionModifiers
// ---------------------------------------------------------------------------
describe('getTemperamentCompetitionModifiers', () => {
  it('returns zero modifiers for null', () => {
    const result = getTemperamentCompetitionModifiers(null);
    expect(result.riddenModifier).toBe(0);
    expect(result.conformationModifier).toBe(0);
  });

  it('returns zero modifiers for unknown temperament', () => {
    const result = getTemperamentCompetitionModifiers('Unknown');
    expect(result.riddenModifier).toBe(0);
    expect(result.conformationModifier).toBe(0);
  });

  it('returns correct modifiers for Bold', () => {
    const result = getTemperamentCompetitionModifiers('Bold');
    expect(result.riddenModifier).toBe(0.05);
    expect(result.conformationModifier).toBe(0.02);
  });

  it('returns correct modifiers for Nervous', () => {
    const result = getTemperamentCompetitionModifiers('Nervous');
    expect(result.riddenModifier).toBe(-0.05);
    expect(result.conformationModifier).toBe(-0.05);
  });

  it('handles whitespace via trim', () => {
    const result = getTemperamentCompetitionModifiers('  Bold  ');
    expect(result.riddenModifier).toBe(0.05);
  });
});

// ---------------------------------------------------------------------------
// getTemperamentGroomSynergy
// ---------------------------------------------------------------------------
describe('getTemperamentGroomSynergy', () => {
  it('returns 0 for null temperament', () => {
    expect(getTemperamentGroomSynergy(null, 'patient')).toBe(0);
  });

  it('returns 0 for null groom personality', () => {
    expect(getTemperamentGroomSynergy('Nervous', null)).toBe(0);
  });

  it('returns 0 for unknown temperament', () => {
    expect(getTemperamentGroomSynergy('UnknownTemp', 'patient')).toBe(0);
  });

  it('returns 0 for unrecognised groom personality', () => {
    expect(getTemperamentGroomSynergy('Calm', 'badpersonality')).toBe(0);
  });

  it('Nervous + patient returns 0.25', () => {
    expect(getTemperamentGroomSynergy('Nervous', 'patient')).toBe(0.25);
  });

  it('Nervous + strict returns -0.15', () => {
    expect(getTemperamentGroomSynergy('Nervous', 'strict')).toBe(-0.15);
  });

  it('Calm + any canonical personality returns _any value (0.1)', () => {
    for (const personality of ['gentle', 'energetic', 'patient', 'strict']) {
      expect(getTemperamentGroomSynergy('Calm', personality)).toBe(0.1);
    }
  });

  it('Spirited + energetic returns 0.2', () => {
    expect(getTemperamentGroomSynergy('Spirited', 'energetic')).toBe(0.2);
  });

  it('Spirited + patient returns 0 (no synergy entry)', () => {
    expect(getTemperamentGroomSynergy('Spirited', 'patient')).toBe(0);
  });

  it('handles whitespace in inputs via trim + toLowerCase', () => {
    expect(getTemperamentGroomSynergy('Calm', '  patient  ')).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// weightedRandomSelect
// ---------------------------------------------------------------------------
describe('weightedRandomSelect', () => {
  it('throws for empty weights object', () => {
    expect(() => weightedRandomSelect({})).toThrow();
  });

  it('throws when all weights are zero', () => {
    expect(() => weightedRandomSelect({ a: 0, b: 0 })).toThrow();
  });

  it('throws for negative weight', () => {
    expect(() => weightedRandomSelect({ a: -1 })).toThrow(/negative weight/i);
  });

  it('always returns the only key for single-entry map', () => {
    for (let i = 0; i < 20; i++) {
      expect(weightedRandomSelect({ only: 1 })).toBe('only');
    }
  });

  it('returns only the valid key when one has 100% weight', () => {
    for (let i = 0; i < 20; i++) {
      const result = weightedRandomSelect({ a: 0, b: 100 });
      expect(result).toBe('b');
    }
  });

  it('returns a valid key from a multi-entry map', () => {
    const valid = new Set(['Calm', 'Spirited', 'Nervous']);
    for (let i = 0; i < 30; i++) {
      expect(valid.has(weightedRandomSelect({ Calm: 5, Spirited: 3, Nervous: 2 }))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateTemperament (breed-profile backed)
// ---------------------------------------------------------------------------
describe('generateTemperament', () => {
  it('returns a string', () => {
    expect(typeof generateTemperament('Thoroughbred')).toBe('string');
  });

  it('returns one of the 11 canonical temperament types', () => {
    const valid = new Set(TEMPERAMENT_TYPES);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateTemperament('Thoroughbred'))).toBe(true);
    }
  });

  it('works for Arabian', () => {
    const valid = new Set(TEMPERAMENT_TYPES);
    const result = generateTemperament('Arabian');
    expect(valid.has(result)).toBe(true);
  });

  it('works for American Quarter Horse', () => {
    const valid = new Set(TEMPERAMENT_TYPES);
    expect(valid.has(generateTemperament('American Quarter Horse'))).toBe(true);
  });

  it('throws for unknown breed', () => {
    expect(() => generateTemperament('NotARealBreed_xyz')).toThrow();
  });
});
