/**
 * horseAge.mjs (Equoria-m2mg)
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
 * - backend/utils/foalAgeUtils.mjs.computeAgeStage uses a real-time
 *   weeks reading. Reconciliation between weekly-anniversary aging and
 *   foal stage windows is tracked separately in Equoria-5msz.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_GAME_YEAR = 7;

/**
 * Compute a horse's age in real-world days since dateOfBirth.
 *
 * @param {Date|string|null|undefined} dateOfBirth - Horse birth date.
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {number} Age in days. 0 if dateOfBirth is missing, invalid, or in the future.
 */
export function getHorseAgeDays(dateOfBirth, now = new Date()) {
  if (dateOfBirth === null || dateOfBirth === undefined) {
    return 0;
  }
  const birthTime = new Date(dateOfBirth).getTime();
  if (Number.isNaN(birthTime)) {
    return 0;
  }
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(nowTime)) {
    return 0;
  }
  const diffMs = nowTime - birthTime;
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / MS_PER_DAY);
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
