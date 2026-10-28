/**
 * Store (Horse Trader) horse trait settings (Equoria-i366a). One object, read by
 * modules/traits/services/storeHorseTraitRoster.mjs.
 *
 * Owner rulings 2026-10-28:
 *   - q241: store traits are weighted by rarity: Common 25%, Uncommon 20%,
 *     Rare 15%, Ultra Rare 10%, Legendary 5%.
 *   - q246: each roster trait rolls its own chance by its tier; a store horse
 *     carries at most 5 traits; every store horse carries at least 1 (if none
 *     came up, keep rolling until one is generated).
 *   - q174: the player may know how many hidden traits a horse carries, never
 *     which ones.
 *
 * Each trait's tier is its ruled rarity (q134), read from the roster table in
 * utils/epigeneticTraits.mjs through traitRevealSettings.traitRarity.
 */

import { traitRarities, traitRevealSettings } from './traitRevealSettings.mjs';

/** Chance each roster trait of a tier is carried, per roll (q241, q246). */
const tierChance = Object.freeze({
  common: 0.25,
  uncommon: 0.2,
  rare: 0.15,
  ultraRare: 0.1,
  legendary: 0.05,
});

if (traitRarities.some(rarity => typeof tierChance[rarity] !== 'number')) {
  throw new Error('storeHorseTraitSettings: every trait rarity needs a store chance');
}

export const storeHorseTraitSettings = Object.freeze({
  tierChance,

  /** At least one trait, at most five (q246). */
  minTraits: 1,
  maxTraits: 5,

  /** Each roster trait's tier (q134). */
  traitRarity: traitRevealSettings.traitRarity,
});

export default storeHorseTraitSettings;
