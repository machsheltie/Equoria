/**
 * The hidden traits a Horse Trader (store) horse carries (Equoria-i366a).
 *
 * Owner rulings:
 *   - 2026-10-22: a store horse is bought at age 3 with a real carried trait
 *     roster, every trait hidden. The player learns the line only by breeding
 *     descendants and developing them before age 3; nothing reveals a store
 *     horse's own traits.
 *   - 2026-10-28 (q174): the player may know HOW MANY hidden traits a horse
 *     carries, never which ones.
 *   - 2026-10-27 (q117): only the twenty roster traits exist.
 *   - 2026-10-28 (q241, q246): each roster trait rolls its own chance by its
 *     rarity tier (config/storeHorseTraitSettings.mjs), at most 5 traits, and
 *     every store horse carries at least 1: if no trait came up, roll again
 *     until one does.
 *
 * Each roll visits the roster in a freshly shuffled order, so when the cap of
 * 5 or a conflict (confident/fearful, resilient/fragile) turns a trait away,
 * no trait is favoured by its place in the roster. A trait that conflicts with
 * one already carried is skipped, so a carried set is never self-contradictory.
 *
 * Pure: the caller passes the random source (`rng`, returns [0, 1)) so tests
 * can seed it. Nothing here touches the database.
 */

import { checkTraitConflict, traitRosterIds } from '../../../utils/epigeneticTraits.mjs';
import { storeHorseTraitSettings } from '../config/storeHorseTraitSettings.mjs';

/**
 * A pass that turns up no trait happens about 1% of the time with a fair
 * random source, so this many in a row means the source is broken. Fail loud
 * rather than hang the purchase.
 */
const maxRolls = 1000;

function shuffled(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One pass over the roster: each trait rolls its tier's chance. */
function rollOnce(rng) {
  const { tierChance, traitRarity, maxTraits } = storeHorseTraitSettings;
  const carried = [];
  for (const trait of shuffled(traitRosterIds, rng)) {
    if (carried.length >= maxTraits) {
      break;
    }
    if (rng() >= tierChance[traitRarity[trait]]) {
      continue;
    }
    if (!carried.some(held => checkTraitConflict(held, trait))) {
      carried.push(trait);
    }
  }
  return carried;
}

/**
 * Draw a store horse's carried traits.
 *
 * @param {() => number} [rng] - random source in [0, 1); Math.random by default
 * @returns {{ positive: string[], negative: string[], hidden: string[] }} the
 *   horse's epigeneticModifiers: every drawn trait hidden, none visible
 */
export function generateStoreHorseTraitRoster(rng = Math.random) {
  for (let roll = 0; roll < maxRolls; roll++) {
    const hidden = rollOnce(rng);
    if (hidden.length >= storeHorseTraitSettings.minTraits) {
      return { positive: [], negative: [], hidden };
    }
  }
  throw new Error(`generateStoreHorseTraitRoster: no trait came up in ${maxRolls} rolls`);
}
