/**
 * Unit Tests for Breeding Helper Functions
 *
 * Testing Sprint Day 1 - Helper Functions & Critical Logic
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover 6 client-side prediction helper functions:
 * - Trait probability calculations (2 functions)
 * - Lineage quality scoring (1 function)
 * - Prediction confidence (1 function)
 * - Display formatting (2 functions)
 */

import { describe, it, expect } from 'vitest';
import type { Horse } from '../breeding';
import {
  calculateTraitProbability,
  getTraitSource,
  calculateLineageQuality,
  getPredictionConfidence,
  formatProbability,
  getProbabilityColor,
} from '../breeding';

// Helper to create test horse
const createHorse = (overrides: Partial<Horse> = {}): Horse => ({
  id: 1,
  name: 'Test Horse',
  breedId: 1,
  sex: 'male',
  ...overrides,
});

describe('calculateTraitProbability', () => {
  it('should return 95% when both parents have the trait', () => {
    const sireTraits = ['strength', 'speed', 'agility'];
    const damTraits = ['speed', 'endurance', 'intelligence'];
    expect(calculateTraitProbability('speed', sireTraits, damTraits)).toBe(95);
  });

  it('should return 70% when only sire has the trait', () => {
    const sireTraits = ['strength', 'speed'];
    const damTraits = ['endurance', 'intelligence'];
    expect(calculateTraitProbability('speed', sireTraits, damTraits)).toBe(70);
  });

  it('should return 70% when only dam has the trait', () => {
    const sireTraits = ['strength', 'agility'];
    const damTraits = ['speed', 'endurance'];
    expect(calculateTraitProbability('speed', sireTraits, damTraits)).toBe(70);
  });

  it('should return 10% when neither parent has the trait', () => {
    const sireTraits = ['strength', 'agility'];
    const damTraits = ['endurance', 'intelligence'];
    expect(calculateTraitProbability('speed', sireTraits, damTraits)).toBe(10);
  });

  it('should handle empty trait arrays', () => {
    expect(calculateTraitProbability('speed', [], [])).toBe(10);
  });

  it('should be case-sensitive for trait names', () => {
    const sireTraits = ['Speed'];
    const damTraits = ['speed'];
    expect(calculateTraitProbability('speed', sireTraits, damTraits)).toBe(70); // Only dam matches
  });
});

describe('getTraitSource', () => {
  it('should return "both" when both parents have the trait', () => {
    const sireTraits = ['strength', 'speed'];
    const damTraits = ['speed', 'endurance'];
    expect(getTraitSource('speed', sireTraits, damTraits)).toBe('both');
  });

  it('should return "sire" when only sire has the trait', () => {
    const sireTraits = ['strength', 'speed'];
    const damTraits = ['endurance', 'intelligence'];
    expect(getTraitSource('speed', sireTraits, damTraits)).toBe('sire');
  });

  it('should return "dam" when only dam has the trait', () => {
    const sireTraits = ['strength', 'agility'];
    const damTraits = ['speed', 'endurance'];
    expect(getTraitSource('speed', sireTraits, damTraits)).toBe('dam');
  });

  it('should return "random" when neither parent has the trait', () => {
    const sireTraits = ['strength', 'agility'];
    const damTraits = ['endurance', 'intelligence'];
    expect(getTraitSource('speed', sireTraits, damTraits)).toBe('random');
  });

  it('should handle empty trait arrays', () => {
    expect(getTraitSource('speed', [], [])).toBe('random');
  });

  it('should prioritize "both" over individual parents', () => {
    const sireTraits = ['speed'];
    const damTraits = ['speed'];
    expect(getTraitSource('speed', sireTraits, damTraits)).toBe('both');
  });
});

describe('calculateLineageQuality', () => {
  it('should return base score 50 when no stats, level, or traits', () => {
    const sire = createHorse();
    const dam = createHorse();
    expect(calculateLineageQuality(sire, dam)).toBe(50);
  });

  it('should add up to +50 from average stats', () => {
    const sire = createHorse({
      stats: { speed: 100, stamina: 100, agility: 100 },
    });
    const dam = createHorse({
      stats: { speed: 100, stamina: 100, agility: 100 },
    });
    const score = calculateLineageQuality(sire, dam);
    // Base 50 + (100+100)/4 = 50 + 50 = 100
    expect(score).toBe(100);
  });

  it('should add up to +20 from levels (capped at 10 per parent)', () => {
    const sire = createHorse({ level: 15 });
    const dam = createHorse({ level: 20 });
    const score = calculateLineageQuality(sire, dam);
    // Base 50 + 10 (sire capped) + 10 (dam capped) = 70
    expect(score).toBe(70);
  });

  it('should add up to +15 from trait count', () => {
    const sire = createHorse({
      traits: ['speed', 'strength', 'agility', 'endurance', 'intelligence'],
    });
    const dam = createHorse({
      traits: [
        'speed',
        'stamina',
        'boldness',
        'focus',
        'obedience',
        'flexibility',
        'precision',
        'balance',
        'temperament',
        'reactivity',
      ],
    });
    const score = calculateLineageQuality(sire, dam);
    // Base 50 + 15 (capped at 15 traits) = 65
    expect(score).toBe(65);
  });

  it('should combine all factors correctly', () => {
    const sire = createHorse({
      stats: { speed: 80, stamina: 80, agility: 80 },
      level: 5,
      traits: ['speed', 'strength'],
    });
    const dam = createHorse({
      stats: { speed: 60, stamina: 60, agility: 60 },
      level: 8,
      traits: ['endurance', 'intelligence', 'boldness'],
    });
    const score = calculateLineageQuality(sire, dam);
    // Base 50
    // Stats: (80+60)/4 = 35
    // Levels: 5 + 8 = 13
    // Traits: 2 + 3 = 5
    // Total: 50 + 35 + 13 + 5 = 103, capped at 100
    expect(score).toBe(100);
  });

  it('should cap score at 100', () => {
    const sire = createHorse({
      stats: { speed: 100, stamina: 100, agility: 100, balance: 100, precision: 100 },
      level: 20,
      traits: ['speed', 'strength', 'agility', 'endurance', 'intelligence', 'boldness'],
    });
    const dam = createHorse({
      stats: { speed: 100, stamina: 100, agility: 100, balance: 100, precision: 100 },
      level: 20,
      traits: ['speed', 'strength', 'agility', 'endurance', 'intelligence', 'boldness'],
    });
    const score = calculateLineageQuality(sire, dam);
    expect(score).toBe(100);
  });

  it('should handle partial data (only stats)', () => {
    const sire = createHorse({
      stats: { speed: 50, stamina: 50 },
    });
    const dam = createHorse({
      stats: { speed: 50, stamina: 50 },
    });
    const score = calculateLineageQuality(sire, dam);
    // Base 50 + (50+50)/4 = 50 + 25 = 75
    expect(score).toBe(75);
  });

  it('should handle partial data (only levels)', () => {
    const sire = createHorse({ level: 7 });
    const dam = createHorse({ level: 9 });
    const score = calculateLineageQuality(sire, dam);
    // Base 50 + 7 + 9 = 66
    expect(score).toBe(66);
  });

  it('should handle partial data (only traits)', () => {
    const sire = createHorse({ traits: ['speed', 'strength'] });
    const dam = createHorse({ traits: ['endurance'] });
    const score = calculateLineageQuality(sire, dam);
    // Base 50 + 3 traits = 53
    expect(score).toBe(53);
  });

  it('should ensure score never goes below 0', () => {
    const sire = createHorse();
    const dam = createHorse();
    const score = calculateLineageQuality(sire, dam);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('getPredictionConfidence', () => {
  it('should return high confidence (85%) for 8+ total traits', () => {
    const result = getPredictionConfidence(5, 4);
    expect(result.level).toBe('high');
    expect(result.percentage).toBe(85);
  });

  it('should return high confidence for exactly 8 traits', () => {
    const result = getPredictionConfidence(4, 4);
    expect(result.level).toBe('high');
    expect(result.percentage).toBe(85);
  });

  it('should return medium confidence (65%) for 4-7 total traits', () => {
    const result = getPredictionConfidence(2, 3);
    expect(result.level).toBe('medium');
    expect(result.percentage).toBe(65);
  });

  it('should return medium confidence for exactly 4 traits', () => {
    const result = getPredictionConfidence(2, 2);
    expect(result.level).toBe('medium');
    expect(result.percentage).toBe(65);
  });

  it('should return low confidence (40%) for fewer than 4 traits', () => {
    const result = getPredictionConfidence(1, 2);
    expect(result.level).toBe('low');
    expect(result.percentage).toBe(40);
  });

  it('should return low confidence for 0 traits', () => {
    const result = getPredictionConfidence(0, 0);
    expect(result.level).toBe('low');
    expect(result.percentage).toBe(40);
  });

  it('should handle asymmetric trait counts', () => {
    const result = getPredictionConfidence(0, 5);
    expect(result.level).toBe('medium');
    expect(result.percentage).toBe(65);
  });
});

describe('formatProbability', () => {
  it('should format integer probabilities', () => {
    expect(formatProbability(50)).toBe('50%');
    expect(formatProbability(100)).toBe('100%');
    expect(formatProbability(0)).toBe('0%');
  });

  it('should round decimal probabilities', () => {
    expect(formatProbability(45.3)).toBe('45%');
    expect(formatProbability(45.7)).toBe('46%');
    expect(formatProbability(99.5)).toBe('100%');
  });

  it('should handle very small decimals', () => {
    expect(formatProbability(0.1)).toBe('0%');
    expect(formatProbability(0.9)).toBe('1%');
  });

  it('should handle very large probabilities', () => {
    expect(formatProbability(150)).toBe('150%'); // No capping in formatting
  });
});

describe('getProbabilityColor', () => {
  it('should return green for probability >= 80%', () => {
    expect(getProbabilityColor(80)).toBe('text-green-600 bg-green-50 border-green-200');
    expect(getProbabilityColor(100)).toBe('text-green-600 bg-green-50 border-green-200');
  });

  it('should return blue for probability 60-79%', () => {
    expect(getProbabilityColor(60)).toBe('text-blue-600 bg-blue-50 border-blue-200');
    expect(getProbabilityColor(79)).toBe('text-blue-600 bg-blue-50 border-blue-200');
  });

  it('should return yellow for probability 40-59%', () => {
    expect(getProbabilityColor(40)).toBe('text-yellow-600 bg-yellow-50 border-yellow-200');
    expect(getProbabilityColor(59)).toBe('text-yellow-600 bg-yellow-50 border-yellow-200');
  });

  it('should return amber for probability < 40%', () => {
    expect(getProbabilityColor(39)).toBe('text-amber-600 bg-amber-50 border-amber-200');
    expect(getProbabilityColor(0)).toBe('text-amber-600 bg-amber-50 border-amber-200');
  });

  it('should handle edge cases', () => {
    expect(getProbabilityColor(80)).toBe('text-green-600 bg-green-50 border-green-200');
    expect(getProbabilityColor(60)).toBe('text-blue-600 bg-blue-50 border-blue-200');
    expect(getProbabilityColor(40)).toBe('text-yellow-600 bg-yellow-50 border-yellow-200');
  });
});
