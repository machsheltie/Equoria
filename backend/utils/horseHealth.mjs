/**
 * Horse health helpers (feed-system redesign 2026-04-29).
 *
 * Phase A scope: feed-derived health. getVetHealth + getDisplayedHealth land in Task A4.
 *
 * Spec: docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md §5.4.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Truncate a Date to UTC midnight (00:00:00.000 UTC of the same calendar day).
 * @param {Date|string} date
 * @returns {Date}
 */
export function startOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Has the horse been fed in the same UTC calendar day as `now`?
 * @param {Date|string|null|undefined} lastFedDate
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function alreadyFedToday(lastFedDate, now = new Date()) {
  if (!lastFedDate) return false;
  return startOfUtcDay(lastFedDate).getTime() === startOfUtcDay(now).getTime();
}

/**
 * Feed-health band derived from horse.lastFedDate.
 *
 * Bands (UTC calendar days since last feeding):
 *   0-2  → excellent
 *   3-4  → good
 *   5-6  → fair
 *   7-8  → poor
 *   9+   → critical
 *
 * Special:
 *   age >= 21 → 'retired' (overrides feed timing)
 *   lastFedDate null/undefined → 'critical'
 *
 * @param {{ age?: number, lastFedDate?: Date|string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'excellent'|'good'|'fair'|'poor'|'critical'|'retired'}
 */
export function getFeedHealth(horse, now = new Date()) {
  if (horse.age != null && horse.age >= 21) return 'retired';
  if (!horse.lastFedDate) return 'critical';

  const days = Math.floor(
    (startOfUtcDay(now).getTime() - startOfUtcDay(horse.lastFedDate).getTime()) / MS_PER_DAY,
  );
  if (days <= 2) return 'excellent';
  if (days <= 4) return 'good';
  if (days <= 6) return 'fair';
  if (days <= 8) return 'poor';
  return 'critical';
}

const BAND_ORDER = ['excellent', 'good', 'fair', 'poor', 'critical'];

/**
 * Return the worse (closer to 'critical') of two bands.
 *
 * 'retired' is special — if either is 'retired', the result is 'retired'
 * (retirement is a terminal state, not a degradation).
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function worseOf(a, b) {
  if (a === 'retired' || b === 'retired') return 'retired';
  const ai = BAND_ORDER.indexOf(a);
  const bi = BAND_ORDER.indexOf(b);
  return BAND_ORDER[Math.max(ai, bi)];
}

/**
 * Vet-health band derived from lastVettedDate (weekly decay), with
 * healthStatus as a vet-finding override.
 *
 *   - age >= 21 → 'retired'
 *   - healthStatus non-null → that value (vet-finding override takes priority)
 *   - lastVettedDate null → 'critical'
 *   - otherwise weekly decay from lastVettedDate (UTC calendar days):
 *       ≤7  → excellent
 *       8-14 → good
 *       15-21 → fair
 *       22-28 → poor
 *       29+  → critical
 *
 * @param {{ age?: number, lastVettedDate?: Date|string|null, healthStatus?: string|null }} horse
 * @param {Date} [now=new Date()]
 * @returns {'excellent'|'good'|'fair'|'poor'|'critical'|'retired'}
 */
export function getVetHealth(horse, now = new Date()) {
  if (horse.age != null && horse.age >= 21) return 'retired';
  if (horse.healthStatus != null) return horse.healthStatus;
  if (!horse.lastVettedDate) return 'critical';

  const days = Math.floor(
    (startOfUtcDay(now).getTime() - startOfUtcDay(horse.lastVettedDate).getTime()) / MS_PER_DAY,
  );
  if (days <= 7) return 'excellent';
  if (days <= 14) return 'good';
  if (days <= 21) return 'fair';
  if (days <= 28) return 'poor';
  return 'critical';
}

/**
 * Final displayed health — worse of feed-derived and vet-derived.
 * This is what gates check (breeding, competition entry) and what the UI shows.
 *
 * @param {object} horse
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function getDisplayedHealth(horse, now = new Date()) {
  return worseOf(getFeedHealth(horse, now), getVetHealth(horse, now));
}
