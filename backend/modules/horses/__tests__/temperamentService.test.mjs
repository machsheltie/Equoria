/**
 * temperamentService — unit tests (Equoria-rr7)
 *
 * Tests pure-function helpers and breed-backed generator.
 * File-based breed profiles (breedProfiles.json), no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import * as temperamentService from '../services/temperamentService.mjs';
import {
  TEMPERAMENT_GROOM_SYNERGY,
  getTemperamentGroomSynergy,
  weightedRandomSelect,
  generateTemperament,
  generateTemperamentWithDefault,
  DEFAULT_TEMPERAMENT_BREED,
} from '../services/temperamentService.mjs';
import { TEMPERAMENT_TYPES } from '../data/temperamentTypes.mjs';

// ---------------------------------------------------------------------------
// Owner ruling 2026-10-21: a temperament has no training modifier and no
// ridden/conformation modifier. Old contract: TEMPERAMENT_TRAINING_MODIFIERS
// (xp/score per temperament, e.g. Lazy -0.2 XP) and
// TEMPERAMENT_COMPETITION_MODIFIERS (ridden/conformation per temperament, e.g.
// Bold +0.05 ridden), with getTemperamentTrainingModifiers /
// getTemperamentCompetitionModifiers lookups. All four are gone.
// ---------------------------------------------------------------------------
describe('no training or ridden/conformation temperament modifiers (owner ruling 2026-10-21)', () => {
  it('exports none of the removed tables or lookups', () => {
    expect(temperamentService).not.toHaveProperty('TEMPERAMENT_TRAINING_MODIFIERS');
    expect(temperamentService).not.toHaveProperty('TEMPERAMENT_COMPETITION_MODIFIERS');
    expect(temperamentService).not.toHaveProperty('getTemperamentTrainingModifiers');
    expect(temperamentService).not.toHaveProperty('getTemperamentCompetitionModifiers');
  });
});

// ---------------------------------------------------------------------------
// TEMPERAMENT_GROOM_SYNERGY
// ---------------------------------------------------------------------------
describe('TEMPERAMENT_GROOM_SYNERGY', () => {
  // Old contract: 11. Owner ruling 2026-10-21: Playful renamed Driven, Willing added.
  it('has entries for all 12 temperament types', () => {
    expect(Object.keys(TEMPERAMENT_GROOM_SYNERGY)).toHaveLength(12);
  });

  it('Calm uses _any for universal synergy', () => {
    expect(TEMPERAMENT_GROOM_SYNERGY.Calm._any).toBeDefined();
  });

  it('Nervous has a negative synergy with strict personality', () => {
    expect(TEMPERAMENT_GROOM_SYNERGY.Nervous.strict).toBeLessThan(0);
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

// ---------------------------------------------------------------------------
// generateTemperamentWithDefault (Equoria-f5372 — breedless fallback)
// ---------------------------------------------------------------------------
describe('generateTemperamentWithDefault', () => {
  const valid = new Set(TEMPERAMENT_TYPES);

  it('exposes Thoroughbred as the default breed', () => {
    expect(DEFAULT_TEMPERAMENT_BREED).toBe('Thoroughbred');
  });

  it('returns a valid type for null (breedless starter horse)', () => {
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateTemperamentWithDefault(null))).toBe(true);
    }
  });

  it('returns a valid type for undefined and empty string', () => {
    expect(valid.has(generateTemperamentWithDefault(undefined))).toBe(true);
    expect(valid.has(generateTemperamentWithDefault(''))).toBe(true);
  });

  it('uses the breed weights when a real breed is supplied', () => {
    expect(valid.has(generateTemperamentWithDefault('Arabian'))).toBe(true);
  });

  it('does NOT throw for an unknown breed — falls back to the default', () => {
    let result;
    expect(() => {
      result = generateTemperamentWithDefault('NotARealBreed_xyz');
    }).not.toThrow();
    expect(valid.has(result)).toBe(true);
  });
});
