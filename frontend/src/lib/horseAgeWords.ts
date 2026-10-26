/**
 * A horse's age in words, on the game clock (Equoria-q4uzh, Equoria-jaeot).
 *
 * One horse page serves a horse for life (owner ruling 2026-10-16), so it must
 * say a two-day-old foal's age honestly: 7 Eastern game days make one game
 * year, and a horse under 3 is counted in days as well, since its groom's
 * activities change with those days. The old foal page printed whole game
 * years times seven, so a two-day-old foal read "0 days".
 *
 * Mirrors backend/utils/horseAge.mjs getHorseAgeDays: whole Eastern game days
 * from the stored birth date (a calendar date) to today.
 */

import { gameDayIndex } from '@/lib/gameTime';

export const daysPerGameYear = 7;
/** Under 3 game years: the foal years, when grooms choose a daily activity. */
export const youngHorseDays = 3 * daysPerGameYear;

/** Whole game days since birth; null when the birth date is missing or unreadable. */
export function horseAgeDays(
  dateOfBirth: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const birthIndex =
    Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()) / 86_400_000;
  const days = gameDayIndex(now) - birthIndex;
  return days > 0 ? days : 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "2 days old", "1 year old (9 days)", "5 years old". Under 3 the days are
 * counted from the birth date; from 3 on the server's age in years is used.
 */
export function horseAgeWords(
  ageYears: number | null | undefined,
  dateOfBirth: string | null | undefined,
  now: Date = new Date()
): string {
  const days = horseAgeDays(dateOfBirth, now);
  if (days !== null && days < youngHorseDays) {
    if (days < daysPerGameYear) return `${plural(days, 'day')} old`;
    return `${plural(Math.floor(days / daysPerGameYear), 'year')} old (${plural(days, 'day')})`;
  }
  if (typeof ageYears === 'number') return `${plural(ageYears, 'year')} old`;
  if (days !== null) return `${plural(Math.floor(days / daysPerGameYear), 'year')} old`;
  return 'Age not recorded';
}

/**
 * The compact form for the identity line: "2 days", "1 year (9 days)", "5".
 * From 3 on the bare number, as the identity line always read.
 */
export function horseAgeShort(
  ageYears: number | null | undefined,
  dateOfBirth: string | null | undefined,
  now: Date = new Date()
): string {
  const days = horseAgeDays(dateOfBirth, now);
  if (days !== null && days < youngHorseDays) {
    return horseAgeWords(ageYears, dateOfBirth, now).replace(' old', '');
  }
  if (typeof ageYears === 'number') return String(ageYears);
  return days !== null ? String(Math.floor(days / daysPerGameYear)) : '—';
}
