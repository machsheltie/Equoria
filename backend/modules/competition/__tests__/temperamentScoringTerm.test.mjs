/**
 * temperamentScoringTerm.test.mjs (Equoria-576c0 B6)
 *
 * Owner rulings R1 + C2: the horse's temperament is a percent term (+5 / 0 /
 * -5, from the Matrix sheet) summed once with luck and the rider percent:
 * final = round(base x (1 + (luck + rider + temperament) / 100)).
 *
 * Interim behaviour approved for O5 (controller, 2026-10-17): a null or
 * unknown-name temperament contributes 0 (what every horse got before B6) and
 * is logged; the horse is still scored.
 *
 * Dressage, all ten stats equal so the base is that value (B4a); luck pinned to
 * the lowest roll, +1% (rng 0). Pure function over real horse-shaped rows.
 */

import { describe, it, expect } from '@jest/globals';
import { careForHealth } from '../../../__tests__/helpers/healthFixture.mjs';
import { scoreShowEntries } from '../services/competitionScoring.mjs';

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
// experienced +3%, prestige 60 +2.4%, no affinity = +5.4%. The rider's level adds
// nothing: owner ruling 2026-10-28 (q244, Equoria-nawn5/xlw03) — stars give no bonus
// for now, so every rider scores at career level 1. Old contract: level 10 added +3.6%
// (+9% in all, 115 below).
const experiencedRider = { skillLevel: 'experienced', level: 10, prestige: 60, personality: 'gentle' };

function score(base, temperament, { discipline = 'Dressage', rider = null } = {}) {
  const [{ score: s }] = scoreShowEntries({
    show: { id: 0, discipline },
    entries: [
      {
        horseId: 1,
        horse: {
          id: 1,
          name: 'TestFixture-b6',
          temperament,
          // Owner ruling 2026-10-23 (decision C, Equoria-k1p62): health is a percent
          // term in every score; Good health is 0%, so this test still isolates the
          // temperament term. Old fixture: no health fields (then: no health term).
          ...careForHealth('Good'),
          lastFedDate: new Date(),
          ...flat(base),
        },
      },
    ],
    assignmentByHorseId: new Map(rider ? [[1, { rider }]] : []),
    rng: () => 0,
  });
  return s;
}

describe('temperament is one percent term in the summed modifiers (R1, C2)', () => {
  it('a Positive temperament adds 5%', () => {
    // Dressage x Calm = Positive: 100 x (1 + 0.01 + 0.05) = 106
    expect(score(100, 'Calm')).toBe(106);
  });

  it('a Neutral temperament adds 0', () => {
    // Dressage x Spirited = Neutral: 100 x 1.01 = 101
    expect(score(100, 'Spirited')).toBe(101);
  });

  it('a Negative temperament subtracts 5%', () => {
    // Dressage x Nervous = Negative: 100 x (1 + 0.01 - 0.05) = 96
    expect(score(100, 'Nervous')).toBe(96);
  });

  it('is summed with luck and the rider, applied once', () => {
    // 100 x (1 + 0.01 + 0.054 + 0.05) = 111.4 -> 111 (separate multiplications would
    // give 100 x 1.01 x 1.054 x 1.05 = 111.78 -> 112)
    expect(score(100, 'Calm', { rider: experiencedRider })).toBe(111);
  });

  it('follows the discipline: the same temperament differs by discipline', () => {
    // Show Jumping x Nervous = Negative (O4 cell): 80 x (1 + 0.01 - 0.05) = 76.8 -> 77
    expect(score(80, 'Nervous', { discipline: 'Show Jumping' })).toBe(77);
    // Western Pleasure x Lazy = Positive: 70 x 1.06 = 74.2 -> 74
    expect(score(70, 'Lazy', { discipline: 'Western Pleasure' })).toBe(74);
    // Racing x Lazy = Negative: 90 x 0.96 = 86.4 -> 86
    expect(score(90, 'Lazy', { discipline: 'Racing' })).toBe(86);
  });

  it('a null or unknown temperament contributes 0 and the horse is still scored (O5 interim)', () => {
    expect(score(100, null)).toBe(101);
    expect(score(100, 'Grumpy')).toBe(101);
  });

  it('a legacy discipline outside the 24 has no matrix row, so temperament contributes 0', () => {
    expect(score(50, 'Calm', { discipline: 'Obedience Training' })).toBe(51); // 50.5 -> 51
  });
});
