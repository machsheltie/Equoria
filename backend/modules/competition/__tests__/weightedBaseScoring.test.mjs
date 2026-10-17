/**
 * weightedBaseScoring.test.mjs (Equoria-576c0 B4a)
 *
 * Owner ruling R8 + BIBLE 13:45-73: a ridden show's base is the discipline's
 * stats weighted 50% primary / 30% secondary / 20% tertiary (the table in
 * rules/disciplineRules.mjs). Before B4a the nightly scorer used a flat
 * average of speed, stamina, agility, precision and boldness for every
 * discipline.
 *
 * Luck is neutralized through scoreShowEntries' rng seam: rng() = 0.5 gives
 * luck (0.5 - 0.5) * 18 = 0, so the score is the rounded base. No rider is
 * assigned. The score is rounded once, at the end: x.4 or less down, x.5 or
 * more up (owner).
 *
 * Pure function over real horse-shaped rows; no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { scoreShowEntries } from '../services/competitionScoring.mjs';
import { DISCIPLINE_STATS } from '../rules/disciplineRules.mjs';

const NO_LUCK = () => 0.5;
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
    rng: NO_LUCK,
  });
  return score;
}

describe('nightly scorer base: 50/30/20 of the discipline stats (B4a)', () => {
  it('Dressage weighs precision 50%, focus 30%, obedience 20%', () => {
    // 0.5*90 + 0.3*80 + 0.2*70 = 45 + 24 + 14 = 83 (old flat average: 34)
    const h = horse({ precision: 90, focus: 80, obedience: 70, speed: 20, stamina: 20, agility: 20, boldness: 20 });
    expect(scoreOf('Dressage', h)).toBe(83);
  });

  it('Racing weighs speed, stamina and focus (C6)', () => {
    // 0.5*95 + 0.3*85 + 0.2*40 = 47.5 + 25.5 + 8 = 81
    const h = horse({ speed: 95, stamina: 85, focus: 40, agility: 60, precision: 30, boldness: 60 });
    expect(scoreOf('Racing', h)).toBe(81);
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
    // Western Pleasure: 0.5*88 + 0.3*77 + 0.2*66 = 44 + 23.1 + 13.2 = 80.3 -> 80
    expect(scoreOf('Western Pleasure', h)).toBe(80);
    // Show Jumping (balance, agility, boldness): 0.5*50 + 0.3*10 + 0.2*10 = 30
    expect(scoreOf('Show Jumping', h)).toBe(30);
  });

  it('a base of exactly x.5 rounds up (no floating-point x.4999)', () => {
    // 0.5*75 + 0.3*70 + 0.2*70 = 72.5 -> 73
    expect(scoreOf('Dressage', horse({ precision: 75, focus: 70, obedience: 70 }))).toBe(73);
  });

  it('a base of x.4 rounds down', () => {
    // 0.5*74 + 0.3*72 + 0.2*69 = 37 + 21.6 + 13.8 = 72.4 -> 72
    expect(scoreOf('Dressage', horse({ precision: 74, focus: 72, obedience: 69 }))).toBe(72);
  });

  it('every one of the 23 disciplines scores its own weighted triple', () => {
    for (const [discipline, [p, s, t]] of Object.entries(DISCIPLINE_STATS)) {
      const h = horse({ [p]: 100, [s]: 60, [t]: 20 });
      // 50 + 18 + 4 = 72 whatever the other stats are (they are all 50).
      expect([discipline, scoreOf(discipline, h)]).toEqual([discipline, 72]);
    }
  });

  it('a legacy discipline outside the 23 keeps today’s flat 5-stat average instead of failing the show', () => {
    // (20 + 20 + 20 + 90 + 20) / 5 = 34, the pre-B4a base.
    const h = horse({ precision: 90, focus: 80, obedience: 70, speed: 20, stamina: 20, agility: 20, boldness: 20 });
    expect(scoreOf('Obedience Training', h)).toBe(34);
  });
});
