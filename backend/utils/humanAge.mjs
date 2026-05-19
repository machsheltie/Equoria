/**
 * humanAge.mjs (Equoria-iqzn — COPPA age verification)
 *
 * Canonical age math for REAL HUMANS (account holders), as distinct from
 * `horseAge.mjs` which uses the game-year convention (7 real days = 1
 * game-year). COPPA is a real-world legal threshold: it must be measured in
 * real calendar years, never game-years.
 *
 * AGE COMPUTATION:
 *   getHumanAgeYears(dob, now) returns the number of full calendar years
 *   elapsed between `dob` and `now`. A person born 2013-05-18 is exactly 13
 *   on 2013-05-18 + 13y (their 13th birthday), and 12 the day before.
 *
 *   The calculation is the standard "year delta, minus one if the
 *   month/day anniversary has not yet occurred this year" — the same rule a
 *   human uses to state their age. It is leap-year safe (a Feb-29-born
 *   person turns N on Mar 1 in non-leap years, which is the legally common
 *   convention and what the date arithmetic naturally yields here).
 *
 * SAFETY (mirrors horseAge.mjs tolerance rules):
 * - null / undefined / missing dob → null (caller MUST treat as "unknown",
 *   not "0" — a missing DOB must be rejected by the COPPA gate, never
 *   silently allowed as a 0-year-old or an adult).
 * - Invalid Date (unparseable string) → null
 * - dob in the future → null (clock drift / bad data — caller rejects)
 *
 * Returning `null` (not 0) for bad input is deliberate: the COPPA gate
 * fails closed. `getHumanAgeYears` never returns a number that would let an
 * unknown-age request through the age check.
 */

const COPPA_MIN_AGE_YEARS = 13;

/**
 * Compute a person's age in full real-world calendar years.
 *
 * @param {Date|string|null|undefined} dateOfBirth
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {number|null} Whole years old, or null if dob is missing, invalid,
 *   or in the future.
 */
export function getHumanAgeYears(dateOfBirth, now = new Date()) {
  if (dateOfBirth === null || dateOfBirth === undefined || dateOfBirth === '') {
    return null;
  }
  const birthDate = new Date(dateOfBirth);
  const birthTime = birthDate.getTime();
  if (Number.isNaN(birthTime)) {
    return null;
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowTime = nowDate.getTime();
  if (Number.isNaN(nowTime)) {
    return null;
  }
  if (birthTime > nowTime) {
    // DOB in the future — bad data / clock drift. Fail closed.
    return null;
  }

  let age = nowDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = nowDate.getUTCMonth() - birthDate.getUTCMonth();
  const dayDelta = nowDate.getUTCDate() - birthDate.getUTCDate();
  // Subtract a year if this year's birthday hasn't occurred yet.
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

/**
 * True iff the given DOB corresponds to someone old enough to register
 * under COPPA (>= 13 real years). Returns false for any missing / invalid /
 * future / under-threshold input — i.e. it fails closed.
 *
 * @param {Date|string|null|undefined} dateOfBirth
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function meetsCoppaMinimumAge(dateOfBirth, now = new Date()) {
  const age = getHumanAgeYears(dateOfBirth, now);
  if (age === null) {
    return false;
  }
  return age >= COPPA_MIN_AGE_YEARS;
}

export { COPPA_MIN_AGE_YEARS };
