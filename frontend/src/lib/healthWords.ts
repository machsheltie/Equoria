/**
 * The one health vocabulary on screen (owner ruling 2026-10-23, Equoria-u0jop):
 * Excellent, Very Good, Good, Fair, Bad. Poor, Bad and Critical all show as Bad.
 *
 * The server already sends these words for feedHealth / vetHealth /
 * displayedHealth (backend/utils/horseHealth.mjs toHealthWord). This formatter
 * is the single place a screen turns any health value — including a raw stored
 * healthStatus or an older lowercase band — into the word it shows, so no two
 * screens can word health differently.
 */

export type HealthWord = 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Bad';

/** What the server sends for feedHealth / vetHealth / displayedHealth. */
export type HealthBand = HealthWord | 'retired';

/** The five health words, best first. */
export const healthWords: readonly HealthWord[] = Object.freeze([
  'Excellent',
  'Very Good',
  'Good',
  'Fair',
  'Bad',
]);

const wordByKey: Readonly<Record<string, HealthWord>> = Object.freeze({
  excellent: 'Excellent',
  'very good': 'Very Good',
  good: 'Good',
  fair: 'Fair',
  poor: 'Bad',
  bad: 'Bad',
  critical: 'Bad',
});

/**
 * The health word for a value, or null when there is no health to show (a
 * missing value, or 'retired' — retirement is not a health word). A free-form
 * vet finding ('Injured') shows as Bad, as the server ranks it.
 */
export function formatHealth(raw: string | null | undefined): HealthWord | null {
  if (raw === null || raw === undefined) return null;
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  if (key === '' || key === 'retired') return null;
  return wordByKey[key] ?? 'Bad';
}

/** True when a value shows as Bad: the horse cannot breed, train or enter a show. */
export function isBadHealth(raw: string | null | undefined): boolean {
  return formatHealth(raw) === 'Bad';
}

/**
 * What a screen prints for a health value: the health word, 'Retired' for a
 * retired horse, or an em dash when health is unknown (never a fake word).
 */
export function healthLabel(raw: string | null | undefined): HealthWord | 'Retired' | '—' {
  if (raw?.trim().toLowerCase() === 'retired') return 'Retired';
  return formatHealth(raw) ?? '—';
}
