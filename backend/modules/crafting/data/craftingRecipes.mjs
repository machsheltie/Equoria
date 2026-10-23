/**
 * Crafting Recipe Catalog
 * Defines all available recipes for the Leathersmith Workshop crafting system.
 *
 * Each recipe specifies:
 *   - id: unique recipe identifier
 *   - name: display name
 *   - description: flavor text
 *   - tier: minimum Leathersmith Workshop tier required (0-3)
 *   - cost: coin cost to craft
 *   - materials: { leather, cloth, dye, metal, thread } quantities required
 *   - result: the inventory item produced (matches TACK_INVENTORY id or is crafting-only)
 *   - resultName: display name of produced item
 *   - resultCategory: tack category (saddle|bridle|halter|blanket|cosmetic)
 *   - bonus (saddles and bridles only): what the item scores, from the same
 *     label the tack shop uses. Only saddles and bridles score (owner decision A);
 *     any other crafted item has no effect text.
 *   - comingSoon: true for crafted items that do not score yet (owner ruling q32,
 *     2026-10-23); the client says "Coming soon" and no effect.
 *   - isCosmetic: true if no stat bonus
 *   - disciplines (saddles and bridles only): the disciplines the item is made
 *     for, as in the tack shop catalogue; empty = All Purpose. Ridden show
 *     scoring reads it (owner decision A, Equoria-k1p62): discipline tack +5 in
 *     its own discipline, All Purpose +2 anywhere.
 */

import { tackBonusLabel } from '../../economy/index.mjs';

const recipes = [
  // ── Tier 0 — Basic cosmetic tack ─────────────────────────────────────────
  {
    id: 'basic-halter',
    name: 'Basic Halter',
    description: 'A simple leather halter, well-made and durable.',
    tier: 0,
    cost: 75,
    materials: { leather: 1, cloth: 0, dye: 0, metal: 0, thread: 0 },
    result: 'crafted-basic-halter',
    resultName: 'Handcrafted Halter',
    resultCategory: 'halter',
    isCosmetic: true,
    comingSoon: true,
  },
  {
    id: 'cloth-blanket',
    name: 'Cloth Blanket',
    description: 'A soft woven stable blanket to keep your horse warm and cozy.',
    tier: 0,
    cost: 120,
    materials: { leather: 0, cloth: 2, dye: 1, metal: 0, thread: 1 },
    result: 'crafted-cloth-blanket',
    resultName: 'Handwoven Blanket',
    resultCategory: 'blanket',
    isCosmetic: true,
    comingSoon: true,
  },

  // ── Tier 1 — Basic workshop ───────────────────────────────────────────────
  {
    id: 'overlay-saddle-pad',
    name: 'Overlay Saddle Pad',
    description:
      'A thick quilted saddle pad with decorative overlays. Adds a flair of artisanal craftsmanship.',
    tier: 1,
    cost: 280,
    materials: { leather: 0, cloth: 3, dye: 2, metal: 0, thread: 2 },
    result: 'crafted-overlay-saddle-pad',
    resultName: 'Artisan Saddle Pad',
    resultCategory: 'blanket',
    isCosmetic: false,
    comingSoon: true,
  },

  // ── Tier 2 — Upgraded workshop (stat-enhancing gear) ─────────────────────
  {
    id: 'precision-bridle',
    name: 'Precision Bridle',
    description:
      'Engineered for exact control. Metal fittings and premium leather for optimal response.',
    tier: 2,
    cost: 400,
    materials: { leather: 2, cloth: 0, dye: 1, metal: 2, thread: 0 },
    result: 'crafted-precision-bridle',
    resultName: 'Artisan Precision Bridle',
    resultCategory: 'bridle',
    bonus: tackBonusLabel(['Dressage']),
    isCosmetic: false,
    disciplines: ['Dressage'],
  },
];

/**
 * Returns a recipe by id, or undefined if not found.
 * @param {string} recipeId
 */
export function findRecipe(recipeId) {
  return recipes.find(r => r.id === recipeId);
}

/**
 * The recipes whose crafted item goes in one tack category. Ridden show
 * scoring reads a crafted saddle's or bridle's `disciplines` through this
 * (competition/rules/tackScoring.mjs, Equoria-k1p62.2).
 * @param {string} resultCategory - e.g. 'saddle', 'bridle'.
 * @returns {Array<object>}
 */
export function craftedItemRecipes(resultCategory) {
  return recipes.filter(r => r.resultCategory === resultCategory);
}

// The recipe list keeps its snake-case export name for its current consumers
// until the camelCase conversion renames them (Equoria-pjvp8).
export { recipes as CRAFTING_RECIPES };
