/**
 * horseAge.mjs (Equoria-m2mg, Equoria-vdw5)
 *
 * Canonical age math for horses.
 *
 * GAME-YEAR CONVENTION:
 *   The Equoria horse aging system uses a "1 game-week = 1 game-year" cadence:
 *   - 0 game-days old  → 0 game-years (just born)
 *   - 7 game-days old  → 1 game-year (after first weekly anniversary)
 *   - 14 game-days old → 2 game-years
 *   - 21 game-days old → 3 game-years (training-eligible)
 *   - 147 game-days old → 21 game-years (retirement age)
 *
 * Example: a horse with dateOfBirth = today - 21 days has ageYears === 3.
 *
 * DATE-ONLY ARITHMETIC ON THE EASTERN GAME CLOCK (Equoria-vdw5; owner
 * ruling 2026-10-09 — the game runs on the owner's Eastern time):
 *   Age is the number of calendar days between the birth date and today's
 *   Eastern date, NOT the real-time millisecond delta:
 *     ageDays  = gameDayIndex(now) - calendarDateDayIndex(dob)
 *     ageYears = floor(ageDays / 7)
 *
 *   Horse.dateOfBirth is a date-only column (`@db.Date`): it already IS a
 *   calendar date, read as-is; writers store the Eastern birth date
 *   (gameCalendarDate in utils/gameTime.mjs). A horse born May 4 is 7 days old
 *   for all of May 11 Eastern, and the daily aging cron (00:05 Eastern) sees
 *   the new day. A 23- or 25-hour daylight-saving day still counts as one day.
 *
 * This module is the single source of truth for converting dateOfBirth into
 * age units. Every caller that previously did
 *   Math.floor((Date.now() - new Date(dob)) / 86400000)
 * should call getHorseAgeDays() instead. Anything that wants game-years
 * (e.g. eligibility gates, API responses) should call getHorseAgeYears().
 *
 * SAFETY:
 * - null / undefined / missing dateOfBirth → 0 (treat as just-born)
 * - dateOfBirth in the future → 0 (clock drift / bad data tolerance)
 * - Invalid Date (e.g. unparseable string) → 0
 *
 * Cross-reference:
 * - backend/utils/horseAgingSystem.mjs (cron) writes to Horse.age. After
 *   Equoria-son6 lands, that column stores game-years and this helper
 *   matches it.
 * - backend/utils/foalAgeUtils.mjs.isFoalByBirthDate decides "still a foal"
 *   on THIS game-year clock via getHorseAgeYears (Equoria-oey96.16), so the
 *   foal window closes exactly at the age-3 training gate (21 real days).
 */

import { calendarDateDayIndex, gameCalendarDate, gameDayIndex } from './gameTime.mjs';

const DAYS_PER_GAME_YEAR = 7;

/**
 * Compute a horse's age in real-world days since dateOfBirth.
 *
 * Uses date-only arithmetic on the Eastern game clock (Equoria-vdw5): the
 * result is the number of whole Eastern calendar days between dob and now,
 * ignoring time-of-day on both sides.
 *
 * @param {Date|string|null|undefined} dateOfBirth - Horse birth date.
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {number} Age in days. 0 if dateOfBirth is missing, invalid, or in the future.
 */
export function getHorseAgeDays(dateOfBirth, now = new Date()) {
  if (dateOfBirth === null || dateOfBirth === undefined) {
    return 0;
  }
  const birthDate = new Date(dateOfBirth);
  const birthTime = birthDate.getTime();
  if (Number.isNaN(birthTime)) {
    return 0;
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowTime = nowDate.getTime();
  if (Number.isNaN(nowTime)) {
    return 0;
  }
  if (nowTime <= birthTime) {
    return 0;
  }
  // Equoria-vdw5: whole Eastern calendar days between the two instants.
  const days = gameDayIndex(nowDate) - calendarDateDayIndex(birthDate);
  return days > 0 ? days : 0;
}

/**
 * Compute a horse's age in game-years.
 *
 * Equoria convention: 1 game-week (7 real days) = 1 game-year. So a horse
 * is "ageYears = floor(ageDays / 7)".
 *
 * @param {Date|string|null|undefined} dateOfBirth - Horse birth date.
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {number} Age in game-years. 0 if dateOfBirth is missing, invalid, or in the future.
 */
export function getHorseAgeYears(dateOfBirth, now = new Date()) {
  const days = getHorseAgeDays(dateOfBirth, now);
  return Math.floor(days / DAYS_PER_GAME_YEAR);
}

/**
 * The dateOfBirth to store for a horse that is `ageYears` game-years old
 * today: the Eastern calendar date ageYears x 7 days back (date-only column).
 * The inverse of getHorseAgeYears — a horse created with it reads exactly
 * ageYears (fractional ages round to whole days).
 *
 * @param {number} ageYears
 * @param {Date} [now=new Date()]
 * @returns {Date}
 */
export function birthDateForAge(ageYears, now = new Date()) {
  return gameCalendarDate(now, -Math.round(ageYears * DAYS_PER_GAME_YEAR));
}

/**
 * Convert an already-known age-in-days value to canonical game-years.
 *
 * Equoria-fe9k: some callers do not have a `dateOfBirth` — they hold a
 * pre-computed days count (e.g. `traitHistory.ageInDays` from the DB, or a
 * config constant like `AGE_CUTOFF_DAYS`) and only need the days→game-years
 * conversion for *display*. Those sites historically divided by 365
 * (calendar-year math), which drifts from the canonical game-year cadence
 * (1 game-week = 1 game-year). This helper is the single source of truth
 * for that conversion so no caller re-derives `/ 7` or regresses to `/ 365`.
 *
 * @param {number} ageInDays - Age already expressed in (game-)days.
 * @returns {number} Age in game-years (floor(days / 7)). 0 for non-finite
 *   or negative input (defensive: bad data should not surface a negative age).
 */
export function gameYearsFromDays(ageInDays) {
  if (typeof ageInDays !== 'number' || !Number.isFinite(ageInDays) || ageInDays < 0) {
    return 0;
  }
  return Math.floor(ageInDays / DAYS_PER_GAME_YEAR);
}

/**
 * Decorate a horse plain-object with `ageYears` computed from `dateOfBirth`.
 *
 * Used by horse-read serializers (list, overview, single) so the frontend
 * receives a stable game-year unit without recomputing client-side. The
 * frontend currently reads `horse.ageYears ?? horse.age` (HorseCard,
 * StableView, MyStablePage, BreedingPairSelection) — this decorator
 * supplies the primary path. Pure: does not mutate the input.
 *
 * Requires the input to carry `dateOfBirth` (Prisma `select` clauses must
 * include it). If `dateOfBirth` is missing, `ageYears` defaults to 0 per
 * the underlying helper's null-safety rules.
 *
 * @template T
 * @param {T & { dateOfBirth?: Date|string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {T & { ageYears: number }}
 */
export function withAgeYears(horse, now = new Date()) {
  if (!horse || typeof horse !== 'object') {
    return horse;
  }
  return {
    ...horse,
    ageYears: getHorseAgeYears(horse.dateOfBirth, now),
  };
}

/**
 * A horse's age RIGHT NOW in game-years, for the age gates (training 3..20,
 * retirement at 21, no rider before 3). Equoria-5b2nj, Equoria-y2ksc.
 *
 * `Horse.age` is written by the nightly birthday job (00:05 Eastern), so from
 * midnight until that run a horse whose birthday it is still holds yesterday's age
 * while `dateOfBirth` already says the new one. That pending birthday counts at
 * once: when the dateOfBirth age is exactly one more than the stored age, it is
 * the live age. Any other disagreement is not a pending birthday (a legacy row
 * whose dateOfBirth was never back-dated, or one dated in real-world years), and
 * the stored age stands, as before.
 *
 * @param {{ age?: number|null, dateOfBirth?: Date|string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {number} age in whole game-years
 */
export function liveHorseAgeYears(horse, now = new Date()) {
  const fromBirthDate = getHorseAgeYears(horse?.dateOfBirth, now);
  if (!Number.isFinite(horse?.age)) {
    return fromBirthDate;
  }
  return fromBirthDate === horse.age + 1 ? fromBirthDate : horse.age;
}

/**
 * Prisma `OR` clauses matching exactly the horses whose liveHorseAgeYears at
 * `now` is below `years` (Equoria-66qkj), for list/count queries that cannot
 * call the helper row by row (e.g. "not retired" = below 21, "foal" = below 3).
 *
 * The live age is the dateOfBirth age when there is no stored age, the stored
 * age otherwise, except that a birthday the nightly job has not recorded yet
 * (dateOfBirth age = stored age + 1) counts at once. With the Eastern birth
 * date cut-offs `bornAfter` (dateOfBirth age below `years` exactly when
 * dateOfBirth > bornAfter) and `bornAfterOneMore` (the same for years + 1):
 *  - no stored age: dateOfBirth > bornAfter;
 *  - stored age below years - 1: always (a pending birthday stays below years);
 *  - stored age years - 1: unless the birthday to `years` is pending, i.e. not
 *    bornAfterOneMore < dateOfBirth <= bornAfter;
 *  - stored age years or more: never.
 * Horse.dateOfBirth is a non-null date-only column.
 *
 * Spread into a where's OR, alongside any extra alternatives:
 *   where: { userId, OR: [...liveAgeBelowClauses(21, now), { inFoalSinceDate: { not: null } }] }
 *
 * @param {number} years - whole game-years
 * @param {Date} [now=new Date()]
 * @returns {object[]}
 */
export function liveAgeBelowClauses(years, now = new Date()) {
  const bornAfter = birthDateForAge(years, now);
  const bornAfterOneMore = birthDateForAge(years + 1, now);
  return [
    { age: null, dateOfBirth: { gt: bornAfter } },
    { age: { lt: years - 1 } },
    {
      age: years - 1,
      OR: [{ dateOfBirth: { gt: bornAfter } }, { dateOfBirth: { lte: bornAfterOneMore } }],
    },
  ];
}
