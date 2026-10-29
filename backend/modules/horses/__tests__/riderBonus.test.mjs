import { describe, it, expect } from '@jest/globals';
import { applyRiderModifiers, computeRiderModifiers, riderStarLevelBonus } from '../../../utils/riderBonus.mjs';

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

  // Owner rulings 2026-10-29: q282 retired the riders' old skill word; q302 put a star
  // level bonus in its place. Old contract: rookie -1% penalty, developing neutral,
  // experienced +3% bonus.
  it('q302: the star level adds +0 / +1 / +2 / +3 / +4 % from Rookie to Expert', () => {
    const levels = ['rookie', 'novice', 'intermediate', 'advanced', 'expert'];
    expect(levels.map(riderStarLevelBonus)).toEqual([0, 0.01, 0.02, 0.03, 0.04]);
    for (const [i, starLevel] of levels.entries()) {
      const rider = { personality: 'methodical', starLevel, prestige: 0 };
      const result = computeRiderModifiers({ rider, discipline: 'Endurance' });
      expect(result.bonusPercent).toBeCloseTo(i * 0.01);
      expect(result.penaltyPercent).toBe(0);
    }
  });

  it('q302: an unknown or missing star level adds nothing', () => {
    for (const starLevel of [undefined, null, 'master', 'Expert']) {
      expect(riderStarLevelBonus(starLevel)).toBe(0);
    }
  });

  it('no skill-word term: a stray old rookie / developing / experienced word adds nothing', () => {
    for (const skillLevel of ['rookie', 'developing', 'experienced']) {
      const rider = { personality: 'methodical', skillLevel, prestige: 0 };
      expect(computeRiderModifiers({ rider, discipline: 'Endurance' })).toEqual({
        bonusPercent: 0,
        penaltyPercent: 0,
      });
    }
  });

  // Owner rulings 2026-10-28: q229 dropped the old 1-10 level column, and q244 says stars
  // give no bonus for now, so every rider/trainer is at the old level 1
  // (staffCareerLevel) and the level term adds nothing.
  // This case used to assert that level 10 gave +3.6%; the rulings changed it. (It also
  // checked that an Expert added nothing, until q302 gave the star level its own bonus.)
  it('no old career-level term: a stray old level 10 adds nothing', () => {
    const rider = { personality: 'methodical', prestige: 0, level: 10 };
    expect(computeRiderModifiers({ rider, discipline: 'Endurance' })).toEqual({
      bonusPercent: 0,
      penaltyPercent: 0,
    });
  });

  it('prestige 100 contributes +4% bonus', () => {
    const rider = { personality: 'methodical', prestige: 100 };
    const result = computeRiderModifiers({ rider, discipline: 'Endurance' });
    expect(result.bonusPercent).toBeCloseTo(0.04);
  });

  it('high-affinity discipline match grants +2% bonus', () => {
    // methodical + Dressage = high (+2%)
    const rider = { personality: 'methodical', prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Dressage' }).bonusPercent).toBeCloseTo(0.02);
  });

  it('medium-affinity discipline match grants +1% bonus', () => {
    // methodical + Reining = medium (+1%)
    const rider = { personality: 'methodical', prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Reining' }).bonusPercent).toBeCloseTo(0.01);
  });

  it('no discipline-personality match grants no affinity bonus', () => {
    const rider = { personality: 'methodical', prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Racing' }).bonusPercent).toBe(0);
  });

  it('elite rider (max all categories) sums to 10%, exactly BONUS_CAP', () => {
    // Expert (+0.04, q302) + prestige 100 (+0.04) + high affinity (+0.02) = 0.10. The old
    // career-level term adds nothing (q229/q244). Old contract: experienced +0.03 in
    // place of the star level, for 0.09.
    const rider = {
      personality: 'methodical',
      starLevel: 'expert',
      prestige: 100,
    };
    const result = computeRiderModifiers({ rider, discipline: 'Dressage' });
    expect(result.bonusPercent).toBeCloseTo(0.1);
    expect(result.penaltyPercent).toBe(0);
  });

  it('retired rider receives full penalty regardless of other stats', () => {
    const rider = {
      personality: 'methodical',
      starLevel: 'expert',
      prestige: 100,
      retired: true,
    };
    const result = computeRiderModifiers({ rider, discipline: 'Dressage' });
    expect(result.penaltyPercent).toBe(0.08);
  });

  it('output is always safe to pass to applyRiderModifiers', () => {
    const rider = {
      personality: 'daring',
      starLevel: 'expert',
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
    const rider = { personality: 'METHODICAL', prestige: 0 };
    expect(computeRiderModifiers({ rider, discipline: 'Dressage' }).bonusPercent).toBeCloseTo(0.02);
  });
});
