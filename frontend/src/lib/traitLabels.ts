/**
 * Authored labels for the words a trait definition carries (Equoria-bdpvw).
 *
 * Owner ruling 2026-10-23: players never see a stored code name. The category
 * the trait definitions store is shown through this map; a value the map has
 * not been taught reads as a generic authored phrase. Rarity is never shown to
 * players (owner ruling 2026-10-27, q112), so it has no label here.
 */

const traitCategoryLabels: Readonly<Record<string, string>> = Object.freeze({
  epigenetic: 'Care Trait',
  bond: 'Bond Trait',
  situational: 'Situational Trait',
});

export function traitCategoryLabel(category: string | null | undefined): string {
  if (typeof category !== 'string') return 'Trait';
  return traitCategoryLabels[category.trim().toLowerCase()] ?? 'Trait';
}

/** Exported so the test can prove every stored value is covered. */
export const knownTraitCategoryLabels = traitCategoryLabels;
