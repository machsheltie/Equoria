/**
 * Lineage stat bonus rules (Equoria-fq9ob; owner rulings 2026-10-20 Q1,
 * 2026-10-21 Q6, 2026-10-28): 3+ distinct ancestors within 3 generations sharing
 * a most-competed discipline give the foal 2% of its parents' average on each of
 * the 12 stats, rounded to the nearest whole number.
 *
 * Pure functions; the real-foaling path is in foalLineageStatBonus.integration.test.mjs.
 */

import { describe, expect, it } from '@jest/globals';
import {
  horseStatNames as horseStats,
  lineageQualifies,
  lineageStatBonus,
  topCompetedDisciplines,
} from '../services/foalLineageStatBonus.mjs';

describe('topCompetedDisciplines', () => {
  it('is the discipline with the most results', () => {
    expect(topCompetedDisciplines({ Dressage: 3, Hunter: 1 })).toEqual(['Dressage']);
  });

  it('is every tied top discipline (controller ruling)', () => {
    expect(topCompetedDisciplines({ Hunter: 2, Dressage: 2, Racing: 1 })).toEqual(['Dressage', 'Hunter']);
  });

  it('is empty for a horse with no results', () => {
    expect(topCompetedDisciplines({})).toEqual([]);
    expect(topCompetedDisciplines(undefined)).toEqual([]);
  });
});

describe('lineageQualifies', () => {
  const dressage = id => ({ id, countsByDiscipline: { Dressage: 2, Hunter: 1 } });

  it('qualifies with 3 distinct ancestors sharing a most-competed discipline', () => {
    expect(lineageQualifies([dressage(1), dressage(2), dressage(3)])).toBe(true);
  });

  it('does not qualify with only 2', () => {
    expect(lineageQualifies([dressage(1), dressage(2)])).toBe(false);
  });

  it('counts a repeated ancestor once', () => {
    expect(lineageQualifies([dressage(1), dressage(1), dressage(2)])).toBe(false);
  });

  it('does not count ancestors with no results', () => {
    expect(lineageQualifies([dressage(1), dressage(2), { id: 3, countsByDiscipline: {} }, { id: 4 }])).toBe(false);
  });

  it('counts a discipline the ancestor only shares through a tie', () => {
    expect(
      lineageQualifies([dressage(1), dressage(2), { id: 3, countsByDiscipline: { Racing: 4, Dressage: 4 } }]),
    ).toBe(true);
  });

  it('needs the same discipline: a discipline that is not the top one does not count', () => {
    expect(
      lineageQualifies([dressage(1), dressage(2), { id: 3, countsByDiscipline: { Racing: 4, Dressage: 1 } }]),
    ).toBe(false);
  });

  it('a short pedigree (parents only) cannot reach 3', () => {
    expect(lineageQualifies([dressage(1), dressage(2)])).toBe(false);
    expect(lineageQualifies([])).toBe(false);
  });
});

describe('lineageStatBonus', () => {
  it('is 2% of the parents’ average on each of the 12 stats, rounded to the nearest whole number', () => {
    const sire = Object.fromEntries(horseStats.map(stat => [stat, 100]));
    const dam = Object.fromEntries(horseStats.map(stat => [stat, 100]));
    sire.stamina = 30;
    dam.stamina = 30;
    sire.agility = 20;
    dam.agility = 20;
    sire.speed = 100;
    dam.speed = 50;
    const bonus = lineageStatBonus(sire, dam);
    expect(Object.keys(bonus).sort()).toEqual([...horseStats].sort());
    expect(bonus.precision).toBe(2); // 100 -> +2
    expect(bonus.stamina).toBe(1); // 30 -> 0.6 -> +1
    expect(bonus.agility).toBe(0); // 20 -> 0.4 -> +0
    expect(bonus.speed).toBe(2); // average 75 -> 1.5 -> +2
  });

  it('an exact half rounds up (average 25 -> +1)', () => {
    expect(lineageStatBonus({ focus: 25 }, { focus: 25 }).focus).toBe(1);
  });

  it('a missing parent stat counts as 0', () => {
    expect(lineageStatBonus({ boldness: 100 }, null).boldness).toBe(1);
  });
});
