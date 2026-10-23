/**
 * healthScoring.test.mjs (Equoria-k1p62)
 *
 * Owner rulings 2026-10-23 (decision C, epic Equoria-k1p62): health has
 * exactly five states, Excellent / Very Good / Good / Fair / Bad, and the care
 * vocabulary's Poor, Bad and Critical are all Bad. ONE mapping function turns
 * any health word into one of the five (utils/horseHealth.mjs healthGradeOf),
 * and the show score modifier reads it: +5 / +3 / 0 / -3 / -5 %.
 * Pure: no database.
 */

import { describe, it, expect } from '@jest/globals';
import { healthGradeOf, horseHealthGrade } from '../../../utils/horseHealth.mjs';
import { healthScorePercent, healthScorePercents } from '../rules/healthScoring.mjs';

const now = new Date('2026-10-23T16:00:00.000Z');
const daysAgo = days => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe('healthGradeOf: the one health mapping', () => {
  it('maps the owner vocabulary, any case or spacing', () => {
    expect(healthGradeOf('Excellent')).toBe('excellent');
    expect(healthGradeOf('Very Good')).toBe('veryGood');
    expect(healthGradeOf('very good')).toBe('veryGood');
    expect(healthGradeOf('veryGood')).toBe('veryGood');
    expect(healthGradeOf('Good')).toBe('good');
    expect(healthGradeOf('Fair')).toBe('fair');
    expect(healthGradeOf('Bad')).toBe('bad');
  });

  it('maps the care vocabulary: Poor, Bad and Critical are all Bad', () => {
    expect(healthGradeOf('excellent')).toBe('excellent');
    expect(healthGradeOf('good')).toBe('good');
    expect(healthGradeOf('fair')).toBe('fair');
    expect(healthGradeOf('poor')).toBe('bad');
    expect(healthGradeOf('Poor')).toBe('bad');
    expect(healthGradeOf('critical')).toBe('bad');
    expect(healthGradeOf('Critical')).toBe('bad');
  });

  it('reads anything it does not know as Bad, as displayed health does', () => {
    for (const word of ['Lameness', 'injured', '', null, undefined, 42]) {
      expect(healthGradeOf(word)).toBe('bad');
    }
  });
});

// Owner ruling 2026-10-23 (Equoria-qwz60): health comes from days since the vet
// (0-7 Excellent, 8-14 Very Good, 15-21 Good, 22-28 Fair, 29+ Bad) and hunger
// lowers it (Fair one level, Bad two). Old contract: the worse of feed and vet
// health, with a stored healthStatus word overriding the vet days.
const vettedDaysAgo = days => new Date(Date.UTC(2026, 9, 23 - days));
const care = (vetDays, fedDaysAgo = 0) => ({
  age: 7,
  lastVettedDate: vettedDaysAgo(vetDays),
  lastFedDate: fedDaysAgo === null ? null : daysAgo(fedDaysAgo),
});

describe('horseHealthGrade: the horse’s displayed health, graded', () => {
  it('grades by days since the vet when the horse is well fed', () => {
    expect(horseHealthGrade(care(0), now)).toBe('excellent');
    expect(horseHealthGrade(care(8), now)).toBe('veryGood');
    expect(horseHealthGrade(care(15), now)).toBe('good');
    expect(horseHealthGrade(care(22), now)).toBe('fair');
    expect(horseHealthGrade(care(29), now)).toBe('bad');
  });

  it('lowers health one level for Fair hunger and two for Bad hunger, never below Bad', () => {
    expect(horseHealthGrade(care(0, 5), now)).toBe('excellent');
    expect(horseHealthGrade(care(0, 7), now)).toBe('veryGood');
    expect(horseHealthGrade(care(0, 9), now)).toBe('good');
    expect(horseHealthGrade(care(0, null), now)).toBe('good');
    expect(horseHealthGrade(care(22, 9), now)).toBe('bad');
    expect(horseHealthGrade(care(29, 9), now)).toBe('bad');
  });

  it('grades the care underneath retirement: retired is not a health state', () => {
    expect(horseHealthGrade({ ...care(0), age: 21 }, now)).toBe('excellent');
    expect(horseHealthGrade({ ...care(22), age: 21 }, now)).toBe('fair');
  });
});

describe('healthScorePercent: the show score modifier', () => {
  it('pins the bible table', () => {
    expect(healthScorePercents).toEqual({
      excellent: 5,
      veryGood: 3,
      good: 0,
      fair: -3,
      bad: -5,
    });
  });

  it('reads the horse’s graded health', () => {
    expect(healthScorePercent(care(0), now)).toBe(5);
    expect(healthScorePercent(care(8), now)).toBe(3);
    expect(healthScorePercent(care(15), now)).toBe(0);
    expect(healthScorePercent(care(22), now)).toBe(-3);
    expect(healthScorePercent(care(29), now)).toBe(-5);
    // A stored Poor or Critical vet finding is Bad whatever the vet days.
    expect(healthScorePercent({ ...care(0), healthStatus: 'Poor' }, now)).toBe(-5);
    expect(healthScorePercent({ ...care(0), healthStatus: 'Critical' }, now)).toBe(-5);
  });
});
