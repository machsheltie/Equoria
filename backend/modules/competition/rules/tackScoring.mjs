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

import { tackCatalogItems } from '../../economy/index.mjs';
import { craftedItemRecipes } from '../../crafting/index.mjs';
import { isKnownDiscipline } from './disciplineRules.mjs';

/** Points for each discipline saddle or bridle in its own discipline (decision A). */
export const disciplineTackPoints = 5;
/** Points for each All Purpose saddle or bridle, in any discipline (decision A). */
export const allPurposeTackPoints = 2;

/**
 * The player-facing bonus label for a saddle or bridle, derived from the same
 * disciplines list the score reads (Equoria-k1p62.4), so the shop, the crafted
 * item and the inventory say what the score really does with it.
 *
 * @param {string[]} disciplines - The item's disciplines ([] = All Purpose).
 * @returns {string} '+2 all disciplines' or '+5 in A, B and C shows'.
 */
export function tackBonusLabel(disciplines) {
  if (disciplines.length === 0) {
    return `+${allPurposeTackPoints} all disciplines`;
  }
  const names =
    disciplines.length === 1
      ? disciplines[0]
      : `${disciplines.slice(0, -1).join(', ')} and ${disciplines[disciplines.length - 1]}`;
  return `+${disciplineTackPoints} in ${names} shows`;
}

/** The Horse.tack slots that score, one item each. */
const scoringTackSlots = Object.freeze(['saddle', 'bridle']);

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
  if (!scoringTackSlots.includes(slot) || typeof itemId !== 'string') {
    return null;
  }
  const shopItem = tackCatalogItems(slot).find(item => item.id === itemId);
  if (shopItem) {
    return disciplinesOf(shopItem);
  }
  const recipe = craftedItemRecipes(slot).find(r => r.result === itemId);
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
  for (const slot of scoringTackSlots) {
    const disciplines = tackItemDisciplines(slot, tack[slot]);
    if (disciplines === null) {
      continue;
    }
    if (disciplines.length === 0) {
      points += allPurposeTackPoints;
    } else if (disciplines.includes(discipline)) {
      points += disciplineTackPoints;
    }
  }
  return points;
}
