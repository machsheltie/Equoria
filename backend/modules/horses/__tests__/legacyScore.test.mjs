/**
 * legacyScoreCalculator + legacyScoreTraitCalculator — unit tests for pure-function exports (Equoria-rr7)
 *
 * Only tests the pure data-getter functions — no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { getLegacyScoreDefinitions } from '../services/legacyScoreCalculator.mjs';
import { getTraitScoringDefinitions } from '../../traits/index.mjs';

// ---------------------------------------------------------------------------
// getLegacyScoreDefinitions
// ---------------------------------------------------------------------------
describe('getLegacyScoreDefinitions', () => {
  it('returns an object with maxScores, grades, and components', () => {
    const defs = getLegacyScoreDefinitions();
    expect(defs).toHaveProperty('maxScores');
    expect(defs).toHaveProperty('grades');
    expect(defs).toHaveProperty('components');
  });

  it('maxScores has expected keys', () => {
    const { maxScores } = getLegacyScoreDefinitions();
    expect(maxScores).toHaveProperty('baseStats');
    expect(maxScores).toHaveProperty('achievements');
    expect(maxScores).toHaveProperty('traitScore');
    expect(maxScores).toHaveProperty('breedingValue');
    expect(maxScores).toHaveProperty('total');
  });

  it('max total is 100', () => {
    const { maxScores } = getLegacyScoreDefinitions();
    expect(maxScores.total).toBe(100);
  });

  it('component scores sum to total', () => {
    const { maxScores } = getLegacyScoreDefinitions();
    const sum = maxScores.baseStats + maxScores.achievements + maxScores.traitScore + maxScores.breedingValue;
    expect(sum).toBe(maxScores.total);
  });

  it('grades has S, A, B, C, D, F entries', () => {
    const { grades } = getLegacyScoreDefinitions();
    for (const grade of ['S', 'A', 'B', 'C', 'D', 'F']) {
      expect(grades[grade]).toBeDefined();
      expect(grades[grade]).toHaveProperty('min');
      expect(grades[grade]).toHaveProperty('name');
      expect(grades[grade]).toHaveProperty('description');
    }
  });

  it('grade S has highest min threshold', () => {
    const { grades } = getLegacyScoreDefinitions();
    expect(grades.S.min).toBeGreaterThan(grades.A.min);
    expect(grades.A.min).toBeGreaterThan(grades.B.min);
    expect(grades.B.min).toBeGreaterThan(grades.C.min);
  });

  it('grade F has min 0', () => {
    const { grades } = getLegacyScoreDefinitions();
    expect(grades.F.min).toBe(0);
  });

  it('components has baseStats, achievements, traitScore, breedingValue descriptions', () => {
    const { components } = getLegacyScoreDefinitions();
    expect(typeof components.baseStats).toBe('string');
    expect(typeof components.achievements).toBe('string');
    expect(typeof components.traitScore).toBe('string');
    expect(typeof components.breedingValue).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getTraitScoringDefinitions
// ---------------------------------------------------------------------------
describe('getTraitScoringDefinitions', () => {
  it('returns an object with maxScores, ageCutoff, rareTraits, negativeTraits, scoringRules', () => {
    const defs = getTraitScoringDefinitions();
    expect(defs).toHaveProperty('maxScores');
    expect(defs).toHaveProperty('ageCutoff');
    expect(defs).toHaveProperty('rareTraits');
    expect(defs).toHaveProperty('negativeTraits');
    expect(defs).toHaveProperty('scoringRules');
  });

  it('maxScores has expected keys', () => {
    const { maxScores } = getTraitScoringDefinitions();
    expect(maxScores).toHaveProperty('traitCount');
    expect(maxScores).toHaveProperty('diversity');
    expect(maxScores).toHaveProperty('rareTraits');
    expect(maxScores).toHaveProperty('groomCare');
    expect(maxScores).toHaveProperty('total');
  });

  it('total equals sum of individual maximums', () => {
    const { maxScores } = getTraitScoringDefinitions();
    const expected = maxScores.traitCount + maxScores.diversity + maxScores.rareTraits + maxScores.groomCare;
    expect(maxScores.total).toBe(expected);
  });

  it('ageCutoff has days and years fields', () => {
    const { ageCutoff } = getTraitScoringDefinitions();
    expect(typeof ageCutoff.days).toBe('number');
    expect(typeof ageCutoff.years).toBe('number');
  });

  // Equoria-fe9k: ageCutoff.years must use canonical game-years
  // (floor(days / 7)), NOT calendar-years (days / 365). 1460 days /7 = 208.
  it('ageCutoff.years is game-years (floor(days/7)), not calendar-years (days/365)', () => {
    const { ageCutoff } = getTraitScoringDefinitions();
    expect(ageCutoff.years).toBe(Math.floor(ageCutoff.days / 7));
    // Sentinel-positive: the OLD /365 calendar result differs — proves the
    // fix actually changed the output (1460/365 ≈ 4 vs 1460/7 = 208).
    expect(ageCutoff.years).not.toBe(Math.floor(ageCutoff.days / 365));
    expect(ageCutoff.years).toBe(208);
  });

  it('rareTraits is an array of strings', () => {
    const { rareTraits } = getTraitScoringDefinitions();
    expect(Array.isArray(rareTraits)).toBe(true);
    expect(rareTraits.length).toBeGreaterThan(0);
  });

  it('negativeTraits is an array of strings', () => {
    const { negativeTraits } = getTraitScoringDefinitions();
    expect(Array.isArray(negativeTraits)).toBe(true);
  });

  it('scoringRules has string descriptions', () => {
    const { scoringRules } = getTraitScoringDefinitions();
    expect(typeof scoringRules.traitCount).toBe('string');
    expect(typeof scoringRules.rareTraits).toBe('string');
  });
});
