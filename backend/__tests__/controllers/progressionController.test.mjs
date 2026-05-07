import { describe, it, expect } from '@jest/globals';
import { getLevelFromXp, calculateXpForLevel } from '../../modules/users/controllers/progressionController.mjs';

// ─── calculateXpForLevel ─────────────────────────────────────────────────────

describe('calculateXpForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(calculateXpForLevel(1)).toBe(0);
  });

  it('returns 0 for level 0', () => {
    expect(calculateXpForLevel(0)).toBe(0);
  });

  it('returns 0 for negative level', () => {
    expect(calculateXpForLevel(-5)).toBe(0);
  });

  it('returns 400 for level 2', () => {
    // 2^2 * 100 = 400
    expect(calculateXpForLevel(2)).toBe(400);
  });

  it('returns 900 for level 3', () => {
    // 3^2 * 100 = 900
    expect(calculateXpForLevel(3)).toBe(900);
  });

  it('returns 1600 for level 4', () => {
    // 4^2 * 100 = 1600
    expect(calculateXpForLevel(4)).toBe(1600);
  });

  it('returns 2500 for level 5', () => {
    expect(calculateXpForLevel(5)).toBe(2500);
  });

  it('returns 10000 for level 10', () => {
    expect(calculateXpForLevel(10)).toBe(10000);
  });

  it('returns progressively larger values as level increases', () => {
    const vals = [2, 3, 4, 5, 6].map(calculateXpForLevel);
    for (let i = 0; i < vals.length - 1; i++) {
      expect(vals[i]).toBeLessThan(vals[i + 1]);
    }
  });

  it('returns a number', () => {
    expect(typeof calculateXpForLevel(5)).toBe('number');
  });
});

// ─── getLevelFromXp ──────────────────────────────────────────────────────────

describe('getLevelFromXp', () => {
  it('returns 1 for xp = 0', () => {
    expect(getLevelFromXp(0)).toBe(1);
  });

  it('returns 1 for xp < 400', () => {
    expect(getLevelFromXp(399)).toBe(1);
    expect(getLevelFromXp(1)).toBe(1);
    expect(getLevelFromXp(200)).toBe(1);
  });

  it('returns 2 for xp = 400', () => {
    // sqrt(400/100) = sqrt(4) = 2
    expect(getLevelFromXp(400)).toBe(2);
  });

  it('returns 3 for xp = 900', () => {
    expect(getLevelFromXp(900)).toBe(3);
  });

  it('returns 4 for xp = 1600', () => {
    expect(getLevelFromXp(1600)).toBe(4);
  });

  it('returns 5 for xp = 2500', () => {
    expect(getLevelFromXp(2500)).toBe(5);
  });

  it('returns 10 for xp = 10000', () => {
    expect(getLevelFromXp(10000)).toBe(10);
  });

  it('is consistent with calculateXpForLevel: getLevelFromXp(calculateXpForLevel(n)) === n', () => {
    for (const level of [2, 3, 4, 5, 6, 7, 8, 10]) {
      const xp = calculateXpForLevel(level);
      expect(getLevelFromXp(xp)).toBe(level);
    }
  });

  it('returns integer (Math.floor) for fractional XP amounts', () => {
    // xp = 450 → sqrt(450/100) = sqrt(4.5) ≈ 2.12 → floor = 2
    expect(getLevelFromXp(450)).toBe(2);
  });

  it('returns a number', () => {
    expect(typeof getLevelFromXp(1000)).toBe('number');
  });
});
