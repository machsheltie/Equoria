/**
 * Authored labels for a tack item's category (Equoria-q4pb8).
 *
 * Owner ruling 2026-10-23: players never see a stored code name. The tack
 * catalogue stores categories as codes (a saddle pad is stored snake-cased today and
 * will be camelCased by Equoria-pjvp8); every place that names one routes it through
 * this map, which accepts either spelling, and a category the map has not been taught
 * reads as a generic authored word, never the stored value.
 */

const tackCategoryLabels: Readonly<Record<string, string>> = Object.freeze({
  saddle: 'Saddle',
  bridle: 'Bridle',
  halter: 'Halter',
  saddlePad: 'Saddle Pad',
  legWraps: 'Leg Wraps',
  reins: 'Reins',
  girth: 'Girth',
  breastplate: 'Breastplate',
  decorative: 'Decorative',
});

/** A tack category as a title-cased word. */
export function tackCategoryLabel(category: string | null | undefined): string {
  if (typeof category !== 'string') return 'Tack';
  const key = category
    .trim()
    .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return tackCategoryLabels[key] ?? 'Tack';
}

/** Exported so the test can prove every stored category is covered. */
export const knownTackCategoryLabels = tackCategoryLabels;
