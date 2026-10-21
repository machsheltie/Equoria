/**
 * weightedBaseScoring.test.mjs (Equoria-576c0 B4a)
 *
 * Owner ruling R8 + BIBLE 13:45-73: a ridden show's base is the discipline's
 * stats weighted 50% primary / 30% secondary / 20% tertiary (the table in
 * rules/disciplineRules.mjs). Before B4a the nightly scorer used a flat
 * average of speed, stamina, agility, precision and boldness for every
 * discipline.
 *
 * Owner rulings C1/C2 (2026-10-16, Equoria-576c0 B5): luck is never zero, so scores go through
 * scoreShowEntries with the lowest roll, rng() = 0 => luck +1%, and equal
 * round(base x 1.01). The exact-tenths base itself is checked through
 * weightedDisciplineBase. (Old contract: rng() = 0.5 gave luck 0, so the
 * score was the rounded base.) No rider is
 * assigned. The score is rounded once, at the end: x.4 or less down, x.5 or
 * more up (owner).
 *
 * Pure function over real horse-shaped rows; no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { scoreShowEntries, weightedDisciplineBase } from '../services/competitionScoring.mjs';
import { DISCIPLINE_STATS } from '../rules/disciplineRules.mjs';

const LUCK_1 = () => 0;
const STATS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];
const horse = (overrides = {}) => ({
  name: 'TestFixture-b4a',
  epigeneticFlags: null,
  ...Object.fromEntries(STATS.map(s => [s, 50])),
  ...overrides,
});

function scoreOf(discipline, h) {
  const [{ score }] = scoreShowEntries({
    show: { discipline },
    entries: [{ horseId: 1, horse: h }],
    assignmentByHorseId: new Map(),
    rng: LUCK_1,
  });
  return score;
}

describe('nightly scorer base: 50/30/20 of the discipline stats (B4a)', () => {
  it('Dressage weighs precision 50%, focus 30%, obedience 20%', () => {
    // 0.5*90 + 0.3*80 + 0.2*70 = 45 + 24 + 14 = 83 (old flat average: 34); x 1.01 = 83.83
    const h = horse({ precision: 90, focus: 80, obedience: 70, speed: 20, stamina: 20, agility: 20, boldness: 20 });
    expect(scoreOf('Dressage', h)).toBe(84);
  });

  it('Racing weighs speed, stamina and focus (C6)', () => {
    // 0.5*95 + 0.3*85 + 0.2*40 = 47.5 + 25.5 + 8 = 81; x 1.01 = 81.81
    const h = horse({ speed: 95, stamina: 85, focus: 40, agility: 60, precision: 30, boldness: 60 });
    expect(scoreOf('Racing', h)).toBe(82);
  });

  it('the same horse scores differently by discipline', () => {
    const h = horse({
      focus: 88,
      obedience: 77,
      intelligence: 66,
      speed: 10,
      stamina: 10,
      agility: 10,
      precision: 10,
      boldness: 10,
    });
    // Western Pleasure: 0.5*88 + 0.3*77 + 0.2*66 = 44 + 23.1 + 13.2 = 80.3; x 1.01 = 81.103 -> 81
    expect(scoreOf('Western Pleasure', h)).toBe(81);
    // Show Jumping (balance, agility, boldness): 0.5*50 + 0.3*10 + 0.2*10 = 30; x 1.01 = 30.3
    expect(scoreOf('Show Jumping', h)).toBe(30);
  });

  // Old contract: these two asserted the rounded score at luck 0. The base is
  // not rounded; the final score's rounding is pinned in summedPercentCombiner.
  it('the base is exact tenths: 72.5 stays 72.5 (no floating-point x.4999)', () => {
    // 0.5*75 + 0.3*70 + 0.2*70 = 72.5
    expect(weightedDisciplineBase(horse({ precision: 75, focus: 70, obedience: 70 }), 'Dressage')).toBe(72.5);
  });

  it('the base is exact tenths: 72.4 stays 72.4', () => {
    // 0.5*74 + 0.3*72 + 0.2*69 = 37 + 21.6 + 13.8 = 72.4
    expect(weightedDisciplineBase(horse({ precision: 74, focus: 72, obedience: 69 }), 'Dressage')).toBe(72.4);
  });

  it('every one of the 24 disciplines scores its own weighted triple', () => {
    for (const [discipline, [p, s, t]] of Object.entries(DISCIPLINE_STATS)) {
      const h = horse({ [p]: 100, [s]: 60, [t]: 20 });
      // 50 + 18 + 4 = 72 whatever the other stats are (they are all 50); x 1.01 = 72.72.
      expect([discipline, scoreOf(discipline, h)]).toEqual([discipline, 73]);
    }
  });

  it('a legacy discipline outside the 23 keeps today’s flat 5-stat average instead of failing the show', () => {
    // (20 + 20 + 20 + 90 + 20) / 5 = 34, the pre-B4a base; x 1.01 = 34.34.
    const h = horse({ precision: 90, focus: 80, obedience: 70, speed: 20, stamina: 20, agility: 20, boldness: 20 });
    expect(scoreOf('Obedience Training', h)).toBe(34);
  });
});
