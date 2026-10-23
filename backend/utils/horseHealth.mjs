/**
 * Horse health — the ONE health vocabulary and the ONE health gate.
 *
 * Owner rulings 2026-10-23 (Stacey, Equoria-u0jop):
 *   - Health is exactly Excellent, Very Good, Good, Fair, Bad. Poor, Bad and
 *     Critical all become Bad. ONE mapping, healthGradeOf (shared with show
 *     scoring, epic Equoria-k1p62), turns any health word into one of the five
 *     states; toHealthWord words it for players. Feed, vet and displayed
 *     health, every gate and every serializer read health through it, so no
 *     two places compute it differently.
 *   - A horse must be Fair or better to breed, train or enter a show (ridden
 *     or conformation): Bad blocks all three (hasBadHealth). Bad health is the
 *     only consequence system.
 *   - The show-score modifier (+5/+3/0/-3/-5 %) reads horseHealthGrade, in
 *     modules/competition/rules/healthScoring.mjs.
 *
 * Old contract: lowercase bands excellent / good / fair / poor / critical, and
 * only 'critical' blocked.
 *
 * Contract: docs/features/feed-system.md § Health contract.
 */

// Days here are Eastern game days (owner ruling 2026-10-09; utils/gameTime.mjs).
import { calendarDateDayIndex, gameDayIndex, startOfGameDay } from './gameTime.mjs';
import { retirementAgeYears } from '../constants/horseAgePolicy.mjs';

// Re-exported for the feed path's "not yet fed today" SQL cutoff.
export { startOfGameDay };

/** The health vocabulary, best first. */
export const healthWords = Object.freeze(['Excellent', 'Very Good', 'Good', 'Fair', 'Bad']);

/**
 * Retirement (age 21+) is a terminal state, not a health word: a retired
 * horse's feed/vet/displayed health reads 'retired', and the age rules — not
 * the health gate — refuse it.
 */
export const retiredHealth = 'retired';

/**
 * The owner's five health states, best first (owner rulings 2026-10-23,
 * epic Equoria-k1p62): Excellent, Very Good, Good, Fair, Bad.
 */
const healthGradeOrder = Object.freeze(['excellent', 'veryGood', 'good', 'fair', 'bad']);

/** Any health word, lower-cased with spaces removed, to its state. */
const healthGradeByWord = Object.freeze({
  excellent: 'excellent',
  verygood: 'veryGood',
  good: 'good',
  fair: 'fair',
  // Owner ruling 2026-10-23: the care vocabulary's Poor, and Critical, are Bad.
  poor: 'bad',
  bad: 'bad',
  critical: 'bad',
});

/**
 * THE health mapping (owner rulings 2026-10-23): any health word - the care
 * bands, a vet finding, the owner's own vocabulary - to one of the five
 * states. Poor, Bad and Critical are all Bad. A word it does not know (a free
 * vet finding such as 'Lameness') is Bad, as worseOf already reads it.
 * Spaces, underscores and hyphens are ignored ('very-good' is Very Good).
 *
 * @param {unknown} word
 * @returns {'excellent'|'veryGood'|'good'|'fair'|'bad'}
 */
export function healthGradeOf(word) {
  const key = typeof word === 'string' ? word.replace(/[\s_-]+/g, '').toLowerCase() : '';
  return Object.hasOwn(healthGradeByWord, key) ? healthGradeByWord[key] : 'bad';
}

/** The word players read for each state (Equoria-u0jop). */
const wordByGrade = Object.freeze({
  excellent: 'Excellent',
  veryGood: 'Very Good',
  good: 'Good',
  fair: 'Fair',
  bad: 'Bad',
});

/**
 * Any stored or derived health value as one of the five health words players
 * read: healthGradeOf, worded. Poor, Bad and Critical are Bad; a free-form vet
 * finding ('Injured', 'Lameness') or a missing value is Bad — the
 * conservative reading the feed-system contract always gave an unknown
 * finding.
 *
 * @param {unknown} raw
 * @returns {'Excellent'|'Very Good'|'Good'|'Fair'|'Bad'}
 */
export function toHealthWord(raw) {
  return wordByGrade[healthGradeOf(raw)];
}

const isRetiredAge = horse =>
  horse.age !== null && horse.age !== undefined && horse.age >= retirementAgeYears;

/**
 * Has the horse been fed on the same Eastern game day as `now`?
 * @param {Date|string|null|undefined} lastFedDate
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function alreadyFedToday(lastFedDate, now = new Date()) {
  if (!lastFedDate) {
    return false;
  }
  return gameDayIndex(lastFedDate) === gameDayIndex(now);
}

/**
 * Feed health derived from horse.lastFedDate.
 *
 * Eastern game days since last feeding:
 *   0-2 → Excellent
 *   3-4 → Good
 *   5-6 → Fair
 *   7+  → Bad (7-8 was 'poor' and 9+ 'critical' before 2026-10-23)
 *
 * Special: age >= 21 → 'retired'; never fed → Bad.
 *
 * @param {{ age?: number, lastFedDate?: Date|string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'Excellent'|'Good'|'Fair'|'Bad'|'retired'}
 */
export function getFeedHealth(horse, now = new Date()) {
  if (isRetiredAge(horse)) {
    return retiredHealth;
  }
  if (!horse.lastFedDate) {
    return 'Bad';
  }

  const days = gameDayIndex(now) - gameDayIndex(horse.lastFedDate);
  if (days <= 2) {
    return 'Excellent';
  }
  if (days <= 4) {
    return 'Good';
  }
  if (days <= 6) {
    return 'Fair';
  }
  return 'Bad';
}

/**
 * Return the worse of two health values, each read through toHealthWord (so
 * an unknown free-form finding counts as Bad). 'retired' wins over everything:
 * retirement is a terminal state, not a degradation.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function worseOf(a, b) {
  if (a === retiredHealth || b === retiredHealth) {
    return retiredHealth;
  }
  const ai = healthGradeOrder.indexOf(healthGradeOf(a));
  const bi = healthGradeOrder.indexOf(healthGradeOf(b));
  return wordByGrade[healthGradeOrder[Math.max(ai, bi)]];
}

/**
 * Vet health derived from lastVettedDate (weekly decay), with healthStatus as
 * a vet-finding override.
 *
 *   - age >= 21 → 'retired'
 *   - healthStatus non-null → toHealthWord(healthStatus) (override wins)
 *   - lastVettedDate null → Bad
 *   - otherwise Eastern game days since the visit:
 *       ≤7    → Excellent
 *       8-14  → Good
 *       15-21 → Fair
 *       22+   → Bad (22-28 was 'poor' and 29+ 'critical' before 2026-10-23)
 *
 * @param {{ age?: number, lastVettedDate?: Date|string|null, healthStatus?: string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'Excellent'|'Very Good'|'Good'|'Fair'|'Bad'|'retired'}
 */
export function getVetHealth(horse, now = new Date()) {
  if (isRetiredAge(horse)) {
    return retiredHealth;
  }
  if (horse.healthStatus !== null && horse.healthStatus !== undefined) {
    return toHealthWord(horse.healthStatus);
  }
  if (!horse.lastVettedDate) {
    return 'Bad';
  }

  // lastVettedDate is a date-only column: read it as the calendar date it is.
  const days = gameDayIndex(now) - calendarDateDayIndex(horse.lastVettedDate);
  if (days <= 7) {
    return 'Excellent';
  }
  if (days <= 14) {
    return 'Good';
  }
  if (days <= 21) {
    return 'Fair';
  }
  return 'Bad';
}

/**
 * Displayed health — the worse of feed health and vet health. This is what
 * every gate checks and what every screen shows.
 *
 * @param {object} horse
 * @param {Date} [now=new Date()]
 * @returns {string} one of healthWords, or 'retired'
 */
export function getDisplayedHealth(horse, now = new Date()) {
  return worseOf(getFeedHealth(horse, now), getVetHealth(horse, now));
}

/**
 * A horse's health state: the worse of its feed and vet health, each graded
 * by healthGradeOf. For the five care bands this is exactly the graded
 * displayed health; it also keeps a 'Very Good' vet finding, which the care
 * bands do not know. Retirement is not a health state, so a retired horse is
 * graded on the care underneath it.
 *
 * @param {{ age?: number|null, lastFedDate?: Date|string|null,
 *   lastVettedDate?: Date|string|null, healthStatus?: string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'excellent'|'veryGood'|'good'|'fair'|'bad'}
 */
export function horseHealthGrade(horse, now = new Date()) {
  const care = { ...horse, age: null };
  const feed = healthGradeOrder.indexOf(healthGradeOf(getFeedHealth(care, now)));
  const vet = healthGradeOrder.indexOf(healthGradeOf(getVetHealth(care, now)));
  return healthGradeOrder[Math.max(feed, vet)];
}

/**
 * The health gate for breeding, training and every show entry (owner ruling
 * 2026-10-23): true when the horse's displayed health is Bad, i.e. it is NOT
 * Fair or better. A retired horse is left to the age rules.
 *
 * Requires `age`, `lastFedDate`, `lastVettedDate` and `healthStatus`.
 *
 * @param {object} horse
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function hasBadHealth(horse, now = new Date()) {
  return getDisplayedHealth(horse, now) === 'Bad';
}

/**
 * The player-facing refusal for a horse in Bad health.
 *
 * @param {string} horseName
 * @param {string} action - what was refused, e.g. 'breed', 'train', 'enter competitions'
 * @returns {string}
 */
export function badHealthMessage(horseName, action) {
  return `${horseName} is in Bad health and cannot ${action}. A horse must be in Fair health or better to breed, train or enter a show. Feed and vet to restore health.`;
}

/**
 * Decorate a horse plain-object with the three derived health values. Used
 * by horse-read serializers (list, overview, etc.) so the frontend doesn't
 * have to recompute. Pure: does not mutate the input.
 *
 * Requires the input to carry `age`, `lastFedDate`, `lastVettedDate`, and
 * `healthStatus` — Prisma `select` clauses that omit any of these will
 * yield values derived from `undefined` (treated as null per helper rules).
 *
 * @template T
 * @param {T & { age?: number, lastFedDate?: Date|string|null, lastVettedDate?: Date|string|null, healthStatus?: string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {T & { feedHealth: string, vetHealth: string, displayedHealth: string }}
 */
export function withHealth(horse, now = new Date()) {
  if (!horse || typeof horse !== 'object') {
    return horse;
  }
  return {
    ...horse,
    feedHealth: getFeedHealth(horse, now),
    vetHealth: getVetHealth(horse, now),
    displayedHealth: getDisplayedHealth(horse, now),
  };
}
