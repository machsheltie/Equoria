/**
 * Staff growth — riders and grooms earn star levels by shows and reveal hidden
 * modifiers as they climb (Equoria-xlw03).
 *
 * Owner rulings 2026-10-28 (Stacey):
 *   q160 / q177  Every rider and groom is generated as a Rookie with hidden, active
 *                modifiers: a personality; 4 horse traits, each + or -; 4 disciplines,
 *                each + or -; 2 temperaments, each + or -; 2 favorite breeds (positive
 *                only); everything else neutral. A Rookie shows its personality only.
 *                Each level-up reveals 3 random hidden items (no ordering preference);
 *                an Expert shows everything. A fired or unpaid staff member returns to
 *                the hiring pool at its current level with its reveals intact.
 *   q235         The price follows the new star level from the next payday after a
 *                level-up (the weekly pass charges `hiredStaffFee`, which reads the
 *                current star level; a level-up itself charges nothing).
 *   q244         Stars give no bonus. (The hidden modifiers' effects were held back until
 *                q331, 2026-11-18, below.)
 *
 * Owner rulings 2026-10-29 (Equoria-waqkr):
 *   q279         The thresholds are running totals of shows: a Rookie reaches Novice at
 *                100 shows, Intermediate at 200, Advanced at 300 and Expert at 400 in
 *                all. Each step is therefore 100 more shows than the last level-up.
 *                (This replaces the 2026-10-28 reading of 100 / 200 / 300 / 400 MORE
 *                shows per step.)
 *   q280         One show is one horse ridden or presented: a rider or groom who takes
 *                3 horses into one show counts 3 (the callers record one per entry).
 *
 * Owner ruling 2026-11-18 (q331, "use the proposal as written"): the hidden items now
 * act, flat points like tack, hidden or revealed alike (10-28). Players are never shown
 * the numbers.
 *   Riders (on the horse's show score while they ride it): a discipline item +2 / -2 on
 *     that discipline's show; a temperament item +2 / -2 for a horse of that
 *     temperament; a favorite breed +2 for a horse of that breed; a trait item +1 / -1
 *     for a horse that has that trait.
 *   Grooms (per grooming): a + temperament or a favorite breed gives +1 extra bond; a -
 *     temperament -1.
 * See `riderGrowthPoints` and `groomGrowthBondPoints`.
 *
 * Trainers are not covered by this ruling and do not grow.
 *
 * This file is pure data and arithmetic: no database.
 */

import { staffLevels, isStaffLevel } from './staffLevels.mjs';

/** Flat show-score points a rider's matching hidden item gives (owner ruling q331). */
export const riderGrowthEffectPoints = Object.freeze({
  discipline: 2,
  temperament: 2,
  breed: 2,
  trait: 1,
});

/** Extra bond per grooming a groom's matching hidden item gives (owner ruling q331). */
export const groomGrowthBondPointsPerItem = 1;

/** How many hidden items of each kind a new rider or groom is drawn with. */
export const growthItemCounts = Object.freeze({
  trait: 4,
  discipline: 4,
  temperament: 2,
  breed: 2,
});

/** The kinds in display order. */
export const growthItemKinds = Object.freeze(['trait', 'discipline', 'temperament', 'breed']);

/** Total hidden items: 12. */
export const growthItemTotal = Object.values(growthItemCounts).reduce((a, b) => a + b, 0);

/** Hidden items revealed by each level-up. */
export const growthRevealsPerLevelUp = 3;

/**
 * Shows completed at a level that take a staff member to the next one: 100 each, so the
 * running totals are 100 / 200 / 300 / 400 (q279).
 */
const showsPerStep = Object.freeze({
  rookie: 100,
  novice: 100,
  intermediate: 100,
  advanced: 100,
});

/**
 * Shows needed at `level` to reach the next level, or null at Expert.
 * @param {string} level
 * @returns {number|null}
 */
export function growthShowsForNextLevel(level) {
  return Object.hasOwn(showsPerStep, level) ? showsPerStep[level] : null;
}

/** @param {string} level @returns {string|null} the level above, or null at Expert */
export function nextStaffLevel(level) {
  const i = staffLevels.indexOf(level);
  return i >= 0 && i < staffLevels.length - 1 ? staffLevels[i + 1] : null;
}

/**
 * How many hidden items a staff member at `level` shows: none for a Rookie, 3 more per
 * level, all at Expert. Used when a profile is first made for a staff member already
 * above Rookie (hired before growth existed, or a groom made by mentoring).
 *
 * @param {string} level
 * @returns {number}
 */
export function growthRevealedCountForLevel(level) {
  if (!isStaffLevel(level)) {
    return 0;
  }
  if (level === 'expert') {
    return growthItemTotal;
  }
  return Math.min(growthItemTotal, staffLevels.indexOf(level) * growthRevealsPerLevelUp);
}

function pickDistinct(pool, count, random) {
  const left = [...pool];
  const picked = [];
  while (picked.length < count && left.length > 0) {
    const i = Math.min(left.length - 1, Math.floor(random() * left.length));
    picked.push(left.splice(i, 1)[0]);
  }
  return picked;
}

const randomSign = random => (random() < 0.5 ? 'positive' : 'negative');

/**
 * Draw a new staff member's twelve hidden items, none revealed.
 *
 * @param {{ traits: string[], disciplines: string[], temperaments: string[],
 *   breedIds: number[] }} pools - what each kind is drawn from
 * @param {() => number} [random]
 * @returns {Array<{ kind: string, value: string|number, sign: string, revealed: boolean }>}
 */
export function drawGrowthItems(pools, random = Math.random) {
  const items = [];
  const add = (kind, pool, signed) => {
    for (const value of pickDistinct(pool, growthItemCounts[kind], random)) {
      items.push({ kind, value, sign: signed ? randomSign(random) : 'positive', revealed: false });
    }
  };
  add('trait', pools.traits, true);
  add('discipline', pools.disciplines, true);
  add('temperament', pools.temperaments, true);
  add('breed', pools.breedIds, false);
  return items;
}

/**
 * Reveal `count` random hidden items (no ordering preference). Returns a new array.
 * @param {Array<{ revealed: boolean }>} items
 * @param {number} count
 * @param {() => number} [random]
 */
export function revealRandomGrowthItems(items, count, random = Math.random) {
  const next = items.map(item => ({ ...item }));
  const hidden = next.filter(item => !item.revealed);
  for (const item of pickDistinct(hidden, count, random)) {
    item.revealed = true;
  }
  return next;
}

/** Reveal everything (Expert). */
export function revealAllGrowthItems(items) {
  return items.map(item => ({ ...item, revealed: true }));
}

/**
 * Add completed shows to a staff member and apply every level-up they earn: each step
 * resets the count at the new level and reveals 3 random items; reaching Expert reveals
 * all. Shows past the Expert step are not kept.
 *
 * @param {{ starLevel: string, showsAtLevel: number, items: Array }} state
 * @param {number} shows - shows completed now (>= 0)
 * @param {() => number} [random]
 * @returns {{ starLevel: string, showsAtLevel: number, items: Array, levelsGained: string[] }}
 */
export function applyGrowthShows(state, shows, random = Math.random) {
  let { starLevel, items } = state;
  let showsAtLevel = (state.showsAtLevel ?? 0) + shows;
  const levelsGained = [];
  for (;;) {
    const needed = growthShowsForNextLevel(starLevel);
    if (needed === null) {
      showsAtLevel = 0;
      break;
    }
    if (showsAtLevel < needed) {
      break;
    }
    showsAtLevel -= needed;
    starLevel = nextStaffLevel(starLevel);
    levelsGained.push(starLevel);
    items =
      starLevel === 'expert'
        ? revealAllGrowthItems(items)
        : revealRandomGrowthItems(items, growthRevealsPerLevelUp, random);
  }
  return { starLevel, showsAtLevel, items, levelsGained };
}

const growthItemList = items => (Array.isArray(items) ? items : []);
const isPositiveItem = item => item.sign === 'positive';

/**
 * The flat show-score points a rider's hidden items give on one horse in one show
 * (owner ruling q331). Every item counts, revealed or not. A + item adds its points, a -
 * item subtracts them; an item that does not match the horse or the show adds nothing.
 *
 * @param {Array<{ kind: string, value: string|number, sign: string }>} items
 * @param {{ discipline: string, temperament: string|null, breedId: number|null,
 *   traitKeys: string[] }} context - the show's discipline and the horse
 * @returns {number}
 */
export function riderGrowthPoints(items, { discipline, temperament, breedId, traitKeys }) {
  let points = 0;
  for (const item of growthItemList(items)) {
    let matches = false;
    if (item.kind === 'discipline') {
      matches = item.value === discipline;
    } else if (item.kind === 'temperament') {
      matches = item.value === temperament;
    } else if (item.kind === 'breed') {
      matches = Number.isInteger(breedId) && item.value === breedId;
    } else if (item.kind === 'trait') {
      matches = Array.isArray(traitKeys) && traitKeys.includes(item.value);
    }
    if (matches) {
      points += (isPositiveItem(item) ? 1 : -1) * riderGrowthEffectPoints[item.kind];
    }
  }
  return points;
}

/**
 * The extra bond a groom's hidden items give on one grooming (owner ruling q331): +1 for
 * each + temperament item the horse has and each favorite breed it is, -1 for each -
 * temperament item. Traits and disciplines do nothing for a groom.
 *
 * @param {Array<{ kind: string, value: string|number, sign: string }>} items
 * @param {{ temperament: string|null, breedId: number|null }} horse
 * @returns {number}
 */
export function groomGrowthBondPoints(items, { temperament, breedId }) {
  let points = 0;
  for (const item of growthItemList(items)) {
    if (item.kind === 'temperament' && item.value === temperament) {
      points += (isPositiveItem(item) ? 1 : -1) * groomGrowthBondPointsPerItem;
    } else if (item.kind === 'breed' && Number.isInteger(breedId) && item.value === breedId) {
      points += groomGrowthBondPointsPerItem;
    }
  }
  return points;
}
