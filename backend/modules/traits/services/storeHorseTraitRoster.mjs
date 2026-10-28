/**
 * The hidden traits a Horse Trader (store) horse carries (Equoria-i366a).
 *
 * Owner rulings:
 *   - 2026-10-22: a store horse is bought at age 3 with a real carried trait
 *     roster, every trait hidden. The player learns the line only by breeding
 *     descendants and developing them before age 3; nothing reveals a store
 *     horse's own traits.
 *   - 2026-10-28 (q174): a random number of traits, up to 5. The player may
 *     know HOW MANY hidden traits a horse carries, never which ones.
 *   - 2026-10-27 (q117): only the twenty roster traits exist.
 *
 * The traits are drawn without repeats from the roster, skipping any trait
 * that conflicts with one already drawn (confident/fearful,
 * resilient/fragile), so a carried set is never self-contradictory. Every
 * roster trait has the same chance of being drawn; no per-tier store odds have
 * been ruled. The count is a whole number from storeHorseTraitCount.min to
 * storeHorseTraitCount.max, each equally likely.
 *
 * Pure: the caller passes the random source (`rng`, returns [0, 1)) so tests
 * can seed it. Nothing here touches the database.
 */

import { checkTraitConflict, traitRosterIds } from '../../../utils/epigeneticTraits.mjs';

/** How many hidden traits a store horse carries (q174: up to 5). */
export const storeHorseTraitCount = Object.freeze({ min: 1, max: 5 });

/**
 * Draw a store horse's carried traits.
 *
 * @param {() => number} [rng] - random source in [0, 1); Math.random by default
 * @returns {{ positive: string[], negative: string[], hidden: string[] }} the
 *   horse's epigeneticModifiers: every drawn trait hidden, none visible
 */
export function generateStoreHorseTraitRoster(rng = Math.random) {
  const { min, max } = storeHorseTraitCount;
  const count = min + Math.floor(rng() * (max - min + 1));

  const pool = [...traitRosterIds];
  const hidden = [];
  while (hidden.length < count && pool.length > 0) {
    const [trait] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (!hidden.some(drawn => checkTraitConflict(drawn, trait))) {
      hidden.push(trait);
    }
  }

  return { positive: [], negative: [], hidden };
}
