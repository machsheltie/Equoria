/**
 * tackScoring.mjs (Equoria-k1p62.2)
 *
 * How a horse's tack scores in a ridden discipline show. Owner decision A and
 * decision D (Stacey, 2026-10-23, epic Equoria-k1p62; the competition bible
 * left tack values OPEN):
 *   - only the saddle and bridle slots carry a score bonus, one of each;
 *   - discipline tack gives +5 each, ONLY in its own discipline (0 in any other);
 *   - All Purpose tack gives +2 each, in any discipline;
 *   - flat score points, not a percent, so tack adds at most +10;
 *   - decorations never score in a discipline show (parade presentation only).
 *
 * An item's own disciplines come from its definition: the tack shop
 * catalogue's `disciplines` list, or a crafted item's recipe. An empty list
 * means All Purpose. A crafted item whose discipline is ambiguous carries an
 * empty list until the owner classifies it (k1p62 audit note), so it counts as
 * All Purpose. The `saddleBonus` / `bridleBonus` numbers stored beside the item
 * ids are a shop-purchase mirror of the old per-item numericBonus and are not
 * read here: the item in the slot decides.
 */

import { TACK_INVENTORY } from '../../economy/index.mjs';
import { CRAFTING_RECIPES } from '../../crafting/index.mjs';
import { isKnownDiscipline } from './disciplineRules.mjs';

/** Points for each discipline saddle or bridle in its own discipline (decision A). */
export const DISCIPLINE_TACK_POINTS = 5;
/** Points for each All Purpose saddle or bridle, in any discipline (decision A). */
export const ALL_PURPOSE_TACK_POINTS = 2;

/** The Horse.tack slots that score, one item each. */
const SCORING_TACK_SLOTS = Object.freeze(['saddle', 'bridle']);

const disciplinesOf = definition =>
  Array.isArray(definition.disciplines) ? definition.disciplines : [];

/**
 * The disciplines an item in a scoring slot was made for.
 *
 * @param {string} slot - 'saddle' or 'bridle'.
 * @param {unknown} itemId - The id stored in Horse.tack[slot].
 * @returns {string[]|null} Its disciplines ([] = All Purpose), or null when the
 *   slot does not score or the id is not a saddle/bridle of that slot.
 */
export function tackItemDisciplines(slot, itemId) {
  if (!SCORING_TACK_SLOTS.includes(slot) || typeof itemId !== 'string') {
    return null;
  }
  const shopItem = TACK_INVENTORY.find(item => item.id === itemId && item.category === slot);
  if (shopItem) {
    return disciplinesOf(shopItem);
  }
  const recipe = CRAFTING_RECIPES.find(r => r.result === itemId && r.resultCategory === slot);
  return recipe ? disciplinesOf(recipe) : null;
}

/**
 * The flat tack points a horse earns in a ridden discipline show.
 *
 * @param {unknown} tack - Horse.tack (JSONB): { saddle?: id, bridle?: id, ... }.
 * @param {string} discipline - The show's discipline.
 * @returns {number} 0..10; 0 outside the 24 competition disciplines.
 */
export function tackPoints(tack, discipline) {
  if (
    !isKnownDiscipline(discipline) ||
    tack === null ||
    typeof tack !== 'object' ||
    Array.isArray(tack)
  ) {
    return 0;
  }
  let points = 0;
  for (const slot of SCORING_TACK_SLOTS) {
    const disciplines = tackItemDisciplines(slot, tack[slot]);
    if (disciplines === null) {
      continue;
    }
    if (disciplines.length === 0) {
      points += ALL_PURPOSE_TACK_POINTS;
    } else if (disciplines.includes(discipline)) {
      points += DISCIPLINE_TACK_POINTS;
    }
  }
  return points;
}
