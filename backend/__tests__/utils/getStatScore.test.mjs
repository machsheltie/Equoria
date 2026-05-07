/**
 * getStatScore — unit tests (Equoria-rr7)
 *
 * Pure calculation, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { getStatScore } from '../../utils/getStatScore.mjs';

const makeHorse = (overrides = {}) => ({
  speed: 80,
  stamina: 70,
  agility: 60,
  balance: 50,
  precision: 40,
  intelligence: 30,
  boldness: 20,
  flexibility: 10,
  obedience: 15,
  focus: 25,
  ...overrides,
});

describe('getStatScore', () => {
  it('throws when horse is null', () => {
    expect(() => getStatScore(null, 'Racing')).toThrow('Horse object is required');
  });

  it('throws when discipline is falsy', () => {
    expect(() => getStatScore(makeHorse(), '')).toThrow('Discipline is required');
  });

  it('throws for unknown discipline', () => {
    expect(() => getStatScore(makeHorse(), 'Underwater Polo')).toThrow('Unknown discipline: Underwater Polo');
  });

  it('calculates weighted score for Racing (speed/stamina/focus all 100)', () => {
    // Racing uses speed (primary), stamina (secondary), focus (tertiary)
    const horse = makeHorse({ speed: 100, stamina: 100, focus: 100 });
    const score = getStatScore(horse, 'Racing');
    // 100*0.5 + 100*0.3 + 100*0.2 = 100
    expect(score).toBe(100);
  });

  it('calculates correct weighted formula: 50% primary, 30% secondary, 20% tertiary', () => {
    // Racing: speed=50, stamina=0, focus=0 → 50*0.5 = 25
    const horse = makeHorse({ speed: 50, stamina: 0, focus: 0 });
    const score = getStatScore(horse, 'Racing');
    expect(score).toBeCloseTo(25);
  });

  it('defaults missing stats to 0', () => {
    const horse = { speed: 60 };
    const score = getStatScore(horse, 'Racing');
    // speed=60 (primary), stamina=undefined→0 (secondary), focus=undefined→0 (tertiary)
    // 60*0.5 + 0*0.3 + 0*0.2 = 30
    expect(score).toBeCloseTo(30);
  });

  it('returns 0 when all relevant stats are 0', () => {
    // Racing: speed, stamina, focus
    const horse = makeHorse({ speed: 0, stamina: 0, focus: 0 });
    expect(getStatScore(horse, 'Racing')).toBe(0);
  });

  it('handles non-Racing discipline (Show Jumping)', () => {
    const horse = makeHorse({ agility: 100, boldness: 100, balance: 100 });
    const score = getStatScore(horse, 'Show Jumping');
    expect(score).toBeGreaterThan(0);
  });
});
