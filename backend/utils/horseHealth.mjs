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
import {
  calendarDateDayIndex,
  gameDayIndex,
  sameGameClockDaysLater,
  startOfGameDay,
} from './gameTime.mjs';
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

/** The last day of each hunger level, best first: Excellent..Fair (9+ is Bad). */
const hungerDayLimits = Object.freeze([2, 4, 6, 8]);

/**
 * Hunger (the horse's feed health), owner ruling 2026-10-23 (Equoria-qwz60):
 * Eastern game days since the hunger clock, which is `hungerSince` when set and
 * `lastFedDate` otherwise (a feeding below Excellent back-dates `hungerSince`,
 * see hungerFeedingPlan):
 *   0-2 -> Excellent, 3-4 -> Very Good, 5-6 -> Good, 7-8 -> Fair, 9+ -> Bad.
 *
 * Special: age >= 21 -> 'retired'; never fed -> Bad.
 *
 * @param {{ age?: number, lastFedDate?: Date|string|null, hungerSince?: Date|string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'Excellent'|'Very Good'|'Good'|'Fair'|'Bad'|'retired'}
 */
export function getFeedHealth(horse, now = new Date()) {
  if (isRetiredAge(horse)) {
    return retiredHealth;
  }
  const clock = horse.hungerSince ?? horse.lastFedDate;
  if (!clock) {
    return 'Bad';
  }

  const days = gameDayIndex(now) - gameDayIndex(clock);
  const level = hungerDayLimits.findIndex(limit => days <= limit);
  return level === -1 ? 'Bad' : healthWords[level];
}

/**
 * What one feeding does to a horse's hunger (owner ruling 2026-10-23). Hunger
 * is a fill bar: a feeding raises it ONE level. Below Excellent a horse may be
 * fed again and again until it is Excellent; at Excellent it is fed once per
 * Eastern game day.
 *
 * `hungerSince` is the clock the feeding writes: now at Excellent, otherwise
 * the oldest day of the next level up.
 *
 * @param {{ lastFedDate?: Date|string|null, hungerSince?: Date|string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {{ canFeed: boolean, hungerSince: Date }}
 */
export function hungerFeedingPlan(horse, now = new Date()) {
  const level = healthWords.indexOf(getFeedHealth({ ...horse, age: null }, now));
  if (level <= 0) {
    return { canFeed: !alreadyFedToday(horse.lastFedDate, now), hungerSince: now };
  }
  return { canFeed: true, hungerSince: sameGameClockDaysLater(now, -hungerDayLimits[level - 1]) };
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

/** The last day of each vet-health level, best first: Excellent..Fair (29+ is Bad). */
const vetDayLimits = Object.freeze([7, 14, 21, 28]);

/**
 * Vet health (owner ruling 2026-10-23): Eastern game days since the last vet
 * visit, with a non-band `healthStatus` as a vet-finding override.
 *
 *   - age >= 21 -> 'retired'
 *   - healthStatus that is not one of the four good words (Poor, Critical,
 *     Injured, any free-form finding) -> Bad. The stored words Excellent, Very
 *     Good, Good and Fair no longer override the days: health comes from days
 *     since the vet (the column defaults to 'Excellent', which would otherwise
 *     hide the decay for every horse).
 *   - lastVettedDate null -> Bad
 *   - otherwise: 0-7 Excellent, 8-14 Very Good, 15-21 Good, 22-28 Fair, 29+ Bad
 *
 * @param {{ age?: number, lastVettedDate?: Date|string|null, healthStatus?: string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'Excellent'|'Very Good'|'Good'|'Fair'|'Bad'|'retired'}
 */
export function getVetHealth(horse, now = new Date()) {
  if (isRetiredAge(horse)) {
    return retiredHealth;
  }
  if (
    horse.healthStatus !== null &&
    horse.healthStatus !== undefined &&
    healthGradeOf(horse.healthStatus) === 'bad'
  ) {
    return 'Bad';
  }
  if (!horse.lastVettedDate) {
    return 'Bad';
  }

  // lastVettedDate is a date-only column: read it as the calendar date it is.
  const days = gameDayIndex(now) - calendarDateDayIndex(horse.lastVettedDate);
  const level = vetDayLimits.findIndex(limit => days <= limit);
  return level === -1 ? 'Bad' : healthWords[level];
}

/**
 * Health after hunger: hunger Fair lowers health one level, hunger Bad two;
 * the floor is Bad (owner ruling 2026-10-23).
 *
 * @param {string} vetWord - a health word
 * @param {string} hungerWord - a health word
 * @returns {'Excellent'|'Very Good'|'Good'|'Fair'|'Bad'}
 */
function healthAfterHunger(vetWord, hungerWord) {
  const penalty = { Fair: 1, Bad: 2 }[toHealthWord(hungerWord)] ?? 0;
  const level = healthGradeOrder.indexOf(healthGradeOf(vetWord));
  return wordByGrade[healthGradeOrder[Math.min(healthGradeOrder.length - 1, level + penalty)]];
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
  const vet = getVetHealth(horse, now);
  if (vet === retiredHealth) {
    return retiredHealth;
  }
  return healthAfterHunger(vet, getFeedHealth(horse, now));
}

/**
 * A horse's health state: its vet health lowered by hunger, graded. Retirement
 * is not a health state, so a retired horse is graded on the care underneath it.
 *
 * @param {{ age?: number|null, lastFedDate?: Date|string|null, hungerSince?: Date|string|null,
 *   lastVettedDate?: Date|string|null, healthStatus?: string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'excellent'|'veryGood'|'good'|'fair'|'bad'}
 */
export function horseHealthGrade(horse, now = new Date()) {
  const care = { ...horse, age: null };
  return healthGradeOf(healthAfterHunger(getVetHealth(care, now), getFeedHealth(care, now)));
}

/**
 * How a mare's health at foaling scales EVERY negative foal-trait roll (owner
 * rulings 2026-10-23, Equoria-w4ivy, and 2026-10-26, Equoria-pw7cm): a Fair mare
 * multiplies the chance by 1.25, a Bad mare by 1.5; Excellent, Very Good and
 * Good leave it alone. A multiplier on the chance as it already stands, nothing
 * else about the odds.
 *
 * @param {'excellent'|'veryGood'|'good'|'fair'|'bad'} grade - horseHealthGrade of the mare
 * @returns {number}
 */
export function negativeTraitChanceMultiplier(grade) {
  return { fair: 1.25, bad: 1.5 }[grade] ?? 1;
}

/**
 * The health gate for breeding, training and every show entry (owner ruling
 * 2026-10-23): true when the horse's displayed health is Bad, i.e. it is NOT
 * Fair or better. A retired horse is left to the age rules.
 *
 * Requires `age`, `lastFedDate`, `hungerSince`, `lastVettedDate` and `healthStatus`.
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
