import { describe, it, expect } from '@jest/globals';
import { applyRiderModifiers, computeRiderModifiers } from '../../../utils/riderBonus.mjs';

describe('applyRiderModifiers', () => {
  it('returns score unchanged when both bonus and penalty are 0', () => {
    expect(applyRiderModifiers(100, 0, 0)).toBe(100);
  });

  it('applies bonus correctly', () => {
    // 100 * (1 + 0.10 - 0) = 110
    expect(applyRiderModifiers(100, 0.1, 0)).toBeCloseTo(110);
  });

  it('applies penalty correctly', () => {
    // 100 * (1 + 0 - 0.08) = 92
    expect(applyRiderModifiers(100, 0, 0.08)).toBeCloseTo(92);
  });

  it('applies bonus and penalty together', () => {
    // 100 * (1 + 0.05 - 0.03) = 102
    expect(applyRiderModifiers(100, 0.05, 0.03)).toBeCloseTo(102);
  });

  it('uses default 0 for optional parameters', () => {
    expect(applyRiderModifiers(50)).toBeCloseTo(50);
  });

  it('works with non-integer scores', () => {
    expect(applyRiderModifiers(75.5, 0.1, 0)).toBeCloseTo(83.05);
  });

  it('throws for negative score', () => {
    expect(() => applyRiderModifiers(-1, 0, 0)).toThrow('Score must be a non-negative number');
  });

  it('throws for non-number score', () => {
    expect(() => applyRiderModifiers('100', 0, 0)).toThrow('Score must be a non-negative number');
  });

  it('throws when bonus exceeds 0.10', () => {
    expect(() => applyRiderModifiers(100, 0.11, 0)).toThrow('Bonus percent must be between');
  });

  it('throws for negative bonus', () => {
    expect(() => applyRiderModifiers(100, -0.01, 0)).toThrow('Bonus percent must be between');
  });

  it('throws when penalty exceeds 0.08', () => {
    expect(() => applyRiderModifiers(100, 0, 0.09)).toThrow('Penalty percent must be between');
  });

  it('throws for negative penalty', () => {
    expect(() => applyRiderModifiers(100, 0, -0.01)).toThrow('Penalty percent must be between');
  });

  it('accepts zero score', () => {
    expect(applyRiderModifiers(0, 0.1, 0)).toBe(0);
  });

  it('accepts max valid bonus 0.10 and penalty 0.08', () => {
    // 200 * (1 + 0.10 - 0.08) = 200 * 1.02 = 204
    expect(applyRiderModifiers(200, 0.1, 0.08)).toBeCloseTo(204);
  });
});

describe('computeRiderModifiers (Equoria-5bkh)', () => {
  it('returns 0/0 for null rider', () => {
    expect(computeRiderModifiers({ rider: null, discipline: 'Dressage' })).toEqual({
      bonusPercent: 0,
      penaltyPercent: 0,
    });
  });

  it('returns 0/0 when called with no arguments', () => {
    expect(computeRiderModifiers()).toEqual({ bonusPercent: 0, penaltyPercent: 0 });
  });

  it('returns 0/0 for malformed rider input', () => {
    expect(computeRiderModifiers({ rider: 'not-an-object', discipline: 'Dressage' })).toEqual({
      bonusPercent: 0,
      penaltyPercent: 0,
    });
  });

  it('rookie skillLevel applies small penalty, no other bonuses', () => {
    const rider = { personality: 'methodical', skillLevel: 'rookie', level: 1, prestige: 0 };
    const result = computeRiderModifiers({ rider, discipline: 'Dressage' });
    // skillLevel: rookie => +0.01 penalty. discipline match Dressage/methodical => +0.02 bonus
    expect(result.penaltyPercent).toBeCloseTo(0.01);
    expect(result.bonusPercent).toBeCloseTo(0.02);
  });

  it('developing skillLevel is neutral (no bonus, no penalty)', () => {
    const rider = { personality: 'methodical', skillLevel: 'developing', level: 1, prestige: 0 };
    const result = computeRiderModifiers({ rider, discipline: 'Endurance' });
    // No discipline match for methodical+Endurance, no level/prestige
    expect(result).toEqual({ bonusPercent: 0, penaltyPercent: 0 });
  });

  it('experienced rider contributes +3% bonus', () => {
    const rider = { personality: 'methodical', skillLevel: 'experienced', level: 1, prestige: 0 };
    const result = computeRiderModifiers({ rider, discipline: 'Endurance' });
    expect(result.bonusPercent).toBeCloseTo(0.03);
    expect(result.penaltyPercent).toBe(0);
  });

  it('level 10 contributes +3.6% bonus', () => {
    const rider = { personality: 'methodical', skillLevel: 'developing', level: 10, prestige: 0 };
    const result = computeRiderModifiers({ rider, discipline: 'Endurance' });
    expect(result.bonusPercent).toBeCloseTo(0.036);
  });

  it('prestige 100 contributes +4% bonus', () => {
    const rider = { personality: 'methodical', skillLevel: 'developing', level: 1, prestige: 100 };
    const result = computeRiderModifiers({ rider, discipline: 'Endurance' });
    expect(result.bonusPercent).toBeCloseTo(0.04);
  });

  it('high-affinity discipline match grants +2% bonus', () => {
    // methodical + Dressage = high (+2%)
    const rider = { personality: 'methodical', skillLevel: 'developing', level: 1, prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Dressage' }).bonusPercent).toBeCloseTo(0.02);
  });

  it('medium-affinity discipline match grants +1% bonus', () => {
    // methodical + Reining = medium (+1%)
    const rider = { personality: 'methodical', skillLevel: 'developing', level: 1, prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Reining' }).bonusPercent).toBeCloseTo(0.01);
  });

  it('no discipline-personality match grants no affinity bonus', () => {
    const rider = { personality: 'methodical', skillLevel: 'developing', level: 1, prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Racing' }).bonusPercent).toBe(0);
  });

  it('elite rider (max all categories) caps at BONUS_CAP 10%', () => {
    // experienced (+0.03) + level 10 (+0.036) + prestige 100 (+0.04) + high affinity (+0.02)
    // = 0.126, capped to 0.10
    const rider = {
      personality: 'methodical',
      skillLevel: 'experienced',
      level: 10,
      prestige: 100,
    };
    const result = computeRiderModifiers({ rider, discipline: 'Dressage' });
    expect(result.bonusPercent).toBe(0.1);
    expect(result.penaltyPercent).toBe(0);
  });

  it('retired rider receives full penalty regardless of other stats', () => {
    const rider = {
      personality: 'methodical',
      skillLevel: 'experienced',
      level: 10,
      prestige: 100,
      retired: true,
    };
    const result = computeRiderModifiers({ rider, discipline: 'Dressage' });
    expect(result.penaltyPercent).toBe(0.08);
  });

  it('output is always safe to pass to applyRiderModifiers', () => {
    const rider = {
      personality: 'daring',
      skillLevel: 'experienced',
      level: 10,
      prestige: 100,
      retired: true,
    };
    const { bonusPercent, penaltyPercent } = computeRiderModifiers({
      rider,
      discipline: 'Racing',
    });
    // Must NOT throw — that's the safety contract
    expect(() => applyRiderModifiers(100, bonusPercent, penaltyPercent)).not.toThrow();
  });

  it('case-insensitive personality match', () => {
    const rider = { personality: 'METHODICAL', skillLevel: 'developing', level: 1, prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Dressage' }).bonusPercent).toBeCloseTo(0.02);
  });
});
