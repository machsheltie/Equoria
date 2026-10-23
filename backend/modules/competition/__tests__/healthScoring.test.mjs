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

describe('horseHealthGrade: the horse’s displayed health, graded', () => {
  it('is the worse of feed and vet health', () => {
    expect(horseHealthGrade({ age: 7, healthStatus: 'Excellent', lastFedDate: now }, now)).toBe('excellent');
    expect(horseHealthGrade({ age: 7, healthStatus: 'Good', lastFedDate: now }, now)).toBe('good');
    // A Very Good vet finding is the owner's fifth state, not an unknown word.
    expect(horseHealthGrade({ age: 7, healthStatus: 'Very Good', lastFedDate: now }, now)).toBe('veryGood');
    // Fed 5 days ago: feed health fair.
    expect(horseHealthGrade({ age: 7, healthStatus: 'Excellent', lastFedDate: daysAgo(5) }, now)).toBe('fair');
    // Fed 7 days ago: feed health poor, which is Bad.
    expect(horseHealthGrade({ age: 7, healthStatus: 'Excellent', lastFedDate: daysAgo(7) }, now)).toBe('bad');
    // Never fed: critical, which is Bad.
    expect(horseHealthGrade({ age: 7, healthStatus: 'Excellent', lastFedDate: null }, now)).toBe('bad');
  });

  it('grades the care underneath retirement: retired is not a health state', () => {
    expect(horseHealthGrade({ age: 21, healthStatus: 'Excellent', lastFedDate: now }, now)).toBe('excellent');
    expect(horseHealthGrade({ age: 21, healthStatus: 'Fair', lastFedDate: now }, now)).toBe('fair');
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
    const horse = health => ({ age: 7, lastFedDate: now, ...health });
    expect(healthScorePercent(horse({ healthStatus: 'Excellent' }), now)).toBe(5);
    expect(healthScorePercent(horse({ healthStatus: 'Very Good' }), now)).toBe(3);
    expect(healthScorePercent(horse({ healthStatus: 'Good' }), now)).toBe(0);
    expect(healthScorePercent(horse({ healthStatus: 'Fair' }), now)).toBe(-3);
    expect(healthScorePercent(horse({ healthStatus: 'Poor' }), now)).toBe(-5);
    expect(healthScorePercent(horse({ healthStatus: 'Critical' }), now)).toBe(-5);
    expect(healthScorePercent({ age: 7, healthStatus: 'Excellent', lastFedDate: null }, now)).toBe(-5);
  });
});
