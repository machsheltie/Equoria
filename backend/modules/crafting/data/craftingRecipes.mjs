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
 *   - bonus: human-readable bonus description
 *   - numericBonus: numeric stat bonus (0 for cosmetic)
 *   - isCosmetic: true if no stat bonus
 */

export const CRAFTING_RECIPES = [
  // ── Tier 0 — Basic cosmetic tack ─────────────────────────────────────────
  {
    id: 'simple-bridle',
    name: 'Simple Bridle',
    description: 'A hand-stitched leather bridle. Functional and elegant.',
    tier: 0,
    cost: 100,
    materials: { leather: 1, cloth: 0, dye: 1, metal: 0, thread: 0 },
    result: 'crafted-simple-bridle',
    resultName: 'Handcrafted Bridle',
    resultCategory: 'bridle',
    bonus: 'Cosmetic — no stat bonus',
    numericBonus: 0,
    isCosmetic: true,
  },
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
    bonus: 'Cosmetic — no stat bonus',
    numericBonus: 0,
    isCosmetic: true,
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
    bonus: 'Cosmetic — no stat bonus',
    numericBonus: 0,
    isCosmetic: true,
  },

  // ── Tier 1 — Basic workshop (rare colorations & functional gear) ──────────
  {
    id: 'dyed-bridle',
    name: 'Dyed Leather Bridle',
    description: 'A bridle with rich custom-dyed leather. Available only at a proper workshop.',
    tier: 1,
    cost: 220,
    materials: { leather: 1, cloth: 0, dye: 2, metal: 0, thread: 0 },
    result: 'crafted-dyed-bridle',
    resultName: 'Dyed Leather Bridle',
    resultCategory: 'bridle',
    bonus: '+1 all disciplines',
    numericBonus: 1,
    isCosmetic: false,
  },
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
    bonus: '+1 dressage score',
    numericBonus: 1,
    isCosmetic: false,
  },

  // ── Tier 2 — Upgraded workshop (stat-enhancing gear) ─────────────────────
  {
    id: 'event-saddle',
    name: 'Event Saddle',
    description:
      'A masterwork saddle crafted for multi-discipline events. Improves agility through superior fit.',
    tier: 2,
    cost: 350,
    materials: { leather: 2, cloth: 1, dye: 0, metal: 1, thread: 0 },
    result: 'crafted-event-saddle',
    resultName: 'Artisan Event Saddle',
    resultCategory: 'saddle',
    bonus: '+1 agility',
    numericBonus: 1,
    isCosmetic: false,
  },
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
    bonus: '+2 dressage score',
    numericBonus: 2,
    isCosmetic: false,
  },

  // ── Tier 3 — Master workshop (legacy prestige items) ─────────────────────
  {
    id: 'legacy-tack-set',
    name: 'Legacy Tack Set',
    description:
      'A complete matching set of legacy-grade tack. Awarded only to masters of the craft. The golden thread glows faintly.',
    tier: 3,
    cost: 1000,
    materials: { leather: 2, cloth: 0, dye: 0, metal: 0, thread: 2 },
    result: 'crafted-legacy-tack-set',
    resultName: 'Legacy Tack Set',
    resultCategory: 'saddle',
    bonus: '+2 prestige + visual glow',
    numericBonus: 2,
    isCosmetic: false,
  },
];

/**
 * Returns a recipe by id, or undefined if not found.
 * @param {string} recipeId
 */
export function findRecipe(recipeId) {
  return CRAFTING_RECIPES.find(r => r.id === recipeId);
}
