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
 * means All Purpose. Each discipline item is for exactly one discipline (owner
 * ruling q02, 2026-10-23). The item in the slot decides: no per-item number is stored or
 * read (the old `numericBonus` and the `saddleBonus` / `bridleBonus` mirrors were
 * retired, Equoria-lsudd; a mirror still stored on an older horse is ignored).
 */

import {
  allPurposeTackPoints,
  disciplineTackPoints,
  tackBonusLabel,
  tackCatalogItems,
} from '../../economy/index.mjs';
import { craftedItemRecipes } from '../../crafting/index.mjs';
import { isKnownDiscipline } from './disciplineRules.mjs';

export { allPurposeTackPoints, disciplineTackPoints, tackBonusLabel };

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
