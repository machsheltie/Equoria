/**
 * Authored labels for the words a trait definition carries (Equoria-bdpvw).
 *
 * Owner ruling 2026-10-23: players never see a stored code name. The rarity and
 * category the trait definitions store are shown through these maps; a value
 * the maps have not been taught reads as a generic authored phrase.
 */

const TRAIT_RARITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
});

const TRAIT_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  epigenetic: 'Care Trait',
  bond: 'Bond Trait',
  situational: 'Situational Trait',
});

export function traitRarityLabel(rarity: string | null | undefined): string {
  if (typeof rarity !== 'string') return 'Unrecorded';
  return TRAIT_RARITY_LABELS[rarity.trim().toLowerCase()] ?? 'Unrecorded';
}

export function traitCategoryLabel(category: string | null | undefined): string {
  if (typeof category !== 'string') return 'Trait';
  return TRAIT_CATEGORY_LABELS[category.trim().toLowerCase()] ?? 'Trait';
}

/** Exported so the test can prove every stored value is covered. */
export const KNOWN_TRAIT_RARITY_LABELS = TRAIT_RARITY_LABELS;
export const KNOWN_TRAIT_CATEGORY_LABELS = TRAIT_CATEGORY_LABELS;
