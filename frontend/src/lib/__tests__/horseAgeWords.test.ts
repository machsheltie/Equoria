/**
 * horseAgeWords — a horse's age on the game clock (Equoria-q4uzh, Equoria-jaeot).
 *
 * The old foal page printed whole game years times seven, so a two-day-old foal
 * read "0 days". One horse page for life now says the age in days while a horse
 * is under 3 (21 game days), counted in Eastern game days from the birth date.
 */

import { describe, it, expect } from 'vitest';
import { horseAgeDays, horseAgeShort, horseAgeWords } from '../horseAgeWords';

// 2026-10-26 15:00 UTC is 11:00 on 2026-10-26 in Eastern time.
const now = new Date('2026-10-26T15:00:00Z');

describe('horseAgeWords (Equoria-q4uzh)', () => {
  it('counts a two-day-old foal as 2 days, not 0', () => {
    expect(horseAgeDays('2026-10-24', now)).toBe(2);
    expect(horseAgeWords(0, '2026-10-24', now)).toBe('2 days old');
    expect(horseAgeShort(0, '2026-10-24', now)).toBe('2 days');
  });

  it('says a newborn is 0 days old and a one-day-old 1 day old', () => {
    expect(horseAgeWords(0, '2026-10-26', now)).toBe('0 days old');
    expect(horseAgeWords(0, '2026-10-25', now)).toBe('1 day old');
  });

  it('gives years and days between 7 and 20 days', () => {
    expect(horseAgeWords(1, '2026-10-17', now)).toBe('1 year old (9 days)');
    expect(horseAgeWords(2, '2026-10-06', now)).toBe('2 years old (20 days)');
    expect(horseAgeShort(2, '2026-10-06', now)).toBe('2 years (20 days)');
  });

  it("uses the server's years from age 3", () => {
    expect(horseAgeWords(3, '2026-10-05', now)).toBe('3 years old');
    expect(horseAgeWords(5, '2021-01-01', now)).toBe('5 years old');
    expect(horseAgeShort(5, '2021-01-01', now)).toBe('5');
  });

  it('is honest about a missing birth date', () => {
    expect(horseAgeDays(null, now)).toBeNull();
    expect(horseAgeWords(4, null, now)).toBe('4 years old');
    expect(horseAgeWords(undefined, undefined, now)).toBe('Age not recorded');
  });
});
