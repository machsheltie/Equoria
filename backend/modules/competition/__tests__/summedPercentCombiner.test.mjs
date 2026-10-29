/**
 * summedPercentCombiner.test.mjs (Equoria-576c0 B5)
 *
 * Owner rulings 2026-10-16:
 *   C1: luck is +1..+10% in whole percents, never negative, one roll per horse
 *       per competition.
 *   C2: compute each modifier, sum the percentages, apply ONCE to the base:
 *       final = round(base x (1 + sum%)), x.5 or more rounds up, at the end.
 *   The rider's percent (bonus - penalty) is one term of that sum, not a
 *   second multiplication.
 * Before B5 the nightly scorer added ±9 luck POINTS to the base and then
 * multiplied by (1 + rider bonus - rider penalty).
 *
 * Every horse here is in a Dressage show with all ten stats equal, so the
 * base is that value (B4a). A base of 100 makes the final score 100 + sum%.
 * Pure function over real horse-shaped rows and real riderBonus math; the
 * only seam is scoreShowEntries' luck rng.
 */

import { describe, it, expect } from '@jest/globals';
import { careForHealth } from '../../../__tests__/helpers/healthFixture.mjs';
import { scoreShowEntries } from '../services/competitionScoring.mjs';
import { neutralTemperament } from '../../../__tests__/helpers/neutralTemperament.mjs';

const flat = v => ({
  speed: v,
  stamina: v,
  agility: v,
  balance: v,
  precision: v,
  intelligence: v,
  boldness: v,
  flexibility: v,
  obedience: v,
  focus: v,
});
// Owner rulings 2026-10-28: q229 dropped the old 1-10 level column, and q244 says stars
// give no bonus for now, so every rider/trainer is at the old level 1 (staffCareerLevel)
// and the level term adds nothing.
// These fixtures used to reach 9% and the 10% cap through that level term.
// Owner ruling 2026-10-29 (q282) retired the riders' old skill word, so these fixtures
// lost its 'experienced' +3% (RIDER_9 was +9%, RIDER_RETIRED -5%).
// computeRiderModifiers: prestige 100 +4%, methodical/Dressage +2% = +6%.
const RIDER_6 = { prestige: 100, personality: 'methodical' };
// retired -8% penalty, no bonus = -8%.
const RIDER_RETIRED = { prestige: 0, personality: 'gentle', retired: true };

// Owner ruling 2026-10-23 (decision C, Equoria-k1p62): health is a percent term in
// every score. Good health (fed today, Good vet finding) is 0%, so this test still
// isolates its own factor. Old fixture: no health fields (then: no health term).
const goodHealth = careForHealth('Good');

function score(base, { rng = () => 0, rider = null, discipline = 'Dressage' } = {}) {
  const [{ score: s }] = scoreShowEntries({
    show: { id: 0, discipline },
    // Every horse has a temperament (Equoria-576c0.5); a 0% one isolates the term under test.
    entries: [
      {
        horseId: 1,
        horse: { name: 'TestFixture-b5', temperament: neutralTemperament(discipline), ...goodHealth, ...flat(base) },
      },
    ],
    assignmentByHorseId: new Map(rider ? [[1, { rider }]] : []),
    rng,
  });
  return s;
}

describe('luck is +1..+10% in whole percents (C1)', () => {
  it('the lowest roll is +1% and the highest is +10%', () => {
    expect(score(100, { rng: () => 0 })).toBe(101);
    expect(score(100, { rng: () => 0.999999 })).toBe(110);
  });

  it('every roll is a whole percent from 1 to 10, never zero or negative, each one reachable', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) {
      const luck = score(100, { rng: () => i / 1000 }) - 100;
      expect(Number.isInteger(luck)).toBe(true);
      expect(luck).toBeGreaterThanOrEqual(1);
      expect(luck).toBeLessThanOrEqual(10);
      seen.add(luck);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('rolls once per horse per competition', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0.5;
    };
    scoreShowEntries({
      show: { id: 0, discipline: 'Dressage' },
      entries: [1, 2, 3].map(horseId => ({
        horseId,
        horse: { name: `h${horseId}`, temperament: neutralTemperament('Dressage'), ...flat(60) },
      })),
      assignmentByHorseId: new Map(),
      rng,
    });
    expect(calls).toBe(3);
  });
});

describe('modifiers are summed and applied once (C2)', () => {
  it('the rider percent is added to luck, not multiplied after it', () => {
    // 100 x (1 + 0.01 + 0.06) = 107. (Old: (100 - 6) x 1.06 = 99.64 -> 100.)
    expect(score(100, { rng: () => 0, rider: RIDER_6 })).toBe(107);
    // 100 x (1 + 0.10 + 0.06) = 116; applying the two separately would give 100 x 1.1 x 1.06 = 116.6 -> 117.
    expect(score(100, { rng: () => 0.999999, rider: RIDER_6 })).toBe(116);
  });

  it('a rider penalty is a negative term in the same sum', () => {
    // 100 x (1 + 0.01 - 0.08) = 93
    expect(score(100, { rng: () => 0, rider: RIDER_RETIRED })).toBe(93);
  });

  it('the final score rounds x.5 up and x.4 down, once, at the end', () => {
    expect(score(50, { rng: () => 0 })).toBe(51); // 50 x 1.01 = 50.5
    expect(score(40, { rng: () => 0 })).toBe(40); // 40 x 1.01 = 40.4
    expect(score(250, { rng: () => 0 })).toBe(253); // 252.5
  });

  it('a legacy discipline keeps its flat base and gets the same combiner', () => {
    // flat base 50 (B4a fallback) x 1.01 = 50.5 -> 51
    expect(score(50, { rng: () => 0, discipline: 'Obedience Training' })).toBe(51);
  });
});
