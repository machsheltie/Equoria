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
 *                an Expert shows everything. Level-ups by shows completed: Rookie to
 *                Novice 100, Novice to Intermediate 200, Intermediate to Advanced 300,
 *                Advanced to Expert 400. A fired or unpaid staff member returns to the
 *                hiring pool at its current level with its reveals intact.
 *   q235         The price follows the new star level from the next payday after a
 *                level-up (the weekly pass charges `hiredStaffFee`, which reads the
 *                current star level; a level-up itself charges nothing).
 *   q244         Stars give no bonus for now, so the hidden modifiers' effects on
 *                scores are NOT applied: see `staffGrowthModifierEffectsEnabled`.
 *
 * Shows per step are counted from the last level-up ("to go from rookie to novice ...
 * 100 shows, novice to intermediate 200 shows ..."): each step needs that many MORE
 * shows, so a Rookie reaches Novice at 100 shows, Intermediate at 300, Advanced at 600
 * and Expert at 1000 in all.
 *
 * Trainers are not covered by this ruling and do not grow.
 *
 * This file is pure data and arithmetic: no database.
 */

import { staffLevels, isStaffLevel } from './staffLevels.mjs';

/**
 * THE SWITCH. Owner ruling q244: stars give no bonus for now, and the effect sizes of
 * the hidden modifiers have not been ruled. While this is false no score, training or
 * care calculation may read a growth item. Turning it on needs the owner's numbers
 * first (`staffGrowthModifierBonus` refuses to run without them).
 */
export const staffGrowthModifierEffectsEnabled = false;

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

/** Shows completed at a level that take a staff member to the next one. */
const showsPerStep = Object.freeze({
  rookie: 100,
  novice: 200,
  intermediate: 300,
  advanced: 400,
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

/**
 * The effect of a staff member's hidden items on a score. Owner ruling q244: none for
 * now. While `staffGrowthModifierEffectsEnabled` is false this is always 0; turning
 * the switch on without the owner's effect sizes is refused loudly.
 *
 * @returns {number}
 */
export function staffGrowthModifierBonus() {
  if (!staffGrowthModifierEffectsEnabled) {
    return 0;
  }
  throw new Error('Staff growth modifier effects are switched on but no effect sizes are ruled');
}
