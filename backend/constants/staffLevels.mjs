/**
 * Staff star levels — the ONE level, star count, label and price table for riders,
 * trainers and grooms (Equoria-nawn5).
 *
 * Owner ruling 2026-10-28 (Stacey): riders, trainers and grooms all use the same five
 * levels with stars, so players understand them easily:
 *
 *   Rookie 1 star 100 · Novice 2 stars 200 · Intermediate 3 stars 300 ·
 *   Advanced 4 stars 400 · Expert 5 stars 500
 *
 * Riders and grooms are priced per WEEK (hire charges one week; weekly payday);
 * trainers per training SESSION. The price comes from the level, never a random
 * draw. Staff are fixed NPCs (owner ruling 2026-10-21): a staff member's star level is
 * drawn once, when the game generates them, and never changes.
 *
 * The stored value is `starLevel` on riders, trainers and grooms (migration
 * 20261028120000_staff_star_levels). The older per-type `skillLevel` words stay as they
 * are: they still feed each type's existing modifiers, which the ruling did not change.
 * New staff draw their old tier with the old odds and then a star level inside it
 * (`drawStaffLevel`), so the two never disagree.
 *
 * This file is pure data and arithmetic: no database, no module imports.
 */

/** The five levels, lowest first. Stored values are camelCase words. */
export const staffLevels = Object.freeze([
  'rookie',
  'novice',
  'intermediate',
  'advanced',
  'expert',
]);

const staffLevelTable = Object.freeze({
  rookie: Object.freeze({ stars: 1, label: 'Rookie', fee: 100 }),
  novice: Object.freeze({ stars: 2, label: 'Novice', fee: 200 }),
  intermediate: Object.freeze({ stars: 3, label: 'Intermediate', fee: 300 }),
  advanced: Object.freeze({ stars: 4, label: 'Advanced', fee: 400 }),
  expert: Object.freeze({ stars: 5, label: 'Expert', fee: 500 }),
});

/** @param {unknown} value @returns {boolean} */
export function isStaffLevel(value) {
  return typeof value === 'string' && Object.hasOwn(staffLevelTable, value);
}

/**
 * The price of a level: per week for riders and grooms, per session for trainers.
 * @param {string} level - one of `staffLevels`
 * @returns {number}
 */
export function staffLevelFee(level) {
  if (!isStaffLevel(level)) {
    throw new Error(`Unknown staff level: ${String(level)}`);
  }
  return staffLevelTable[level].fee;
}

/** @param {string} level @returns {number} 1-5 */
export function staffLevelStars(level) {
  return isStaffLevel(level) ? staffLevelTable[level].stars : 0;
}

/** @param {string} level @returns {string} the authored label, e.g. "Advanced" */
export function staffLevelLabel(level) {
  return isStaffLevel(level) ? staffLevelTable[level].label : 'Unrated';
}

/**
 * The career level the rider, trainer and groom modifiers, the discovery-slot reveal,
 * the groom talent tree and groom mentoring use: the old bottom level, 1, for every
 * rider, trainer and groom.
 *
 * Owner ruling 2026-10-28 (q244): stars give no bonus for now, so nothing changes from
 * before the old 1-10 level column was dropped (q229), when every game-made rider,
 * trainer and groom sat at level 1. That level term therefore adds no show bonus, no
 * training bonus, no revealed discovery slot, no open talent tier and no mentoring.
 * Staff growth (Equoria-xlw03) replaces this.
 */
export const staffCareerLevel = 1;

/**
 * `staffCareerLevel` on the star scale: the old levels sit two to a star (old 1-2
 * Rookie, 3-4 Novice, 5-6 Intermediate, 7-8 Advanced, 9-10 Expert), so old level 1 is
 * a Rookie. Gates that used to read an old level (groom talent tiers, groom mentoring)
 * are written as the equivalent star level and compared against this.
 */
export const staffCareerStarLevel = 'rookie';

/**
 * Whether `level` is at or above `minLevel` on the five-level scale. An unknown word
 * is below every level.
 *
 * @param {string} level
 * @param {string} minLevel - one of `staffLevels`
 * @returns {boolean}
 */
export function staffLevelAtLeast(level, minLevel) {
  if (!isStaffLevel(minLevel)) {
    throw new Error(`Unknown staff level: ${String(minLevel)}`);
  }
  return staffLevelStars(level) >= staffLevelStars(minLevel);
}

/**
 * How each staff type's older skill words sit on the five levels. A tier with two
 * levels is split: new staff draw one of the two evenly, and existing staff are placed
 * by where their old price sat in that tier's old price range (`splitAt`): below it the
 * lower level, at or above it the higher. Kept in step with the backfill in migration
 * 20261028120000_staff_star_levels.
 *
 * Riders   (old odds 45/40/15, weekly rates 150-300 / 300-500 / 500-800)
 * Trainers (old odds 45/40/15, session rates 100-200 / 200-350 / 350-600)
 * Grooms   (old odds 40/35/20/5; novice grooms split by years of experience, 1-3)
 */
const legacyTiers = Object.freeze({
  rider: Object.freeze({
    rookie: Object.freeze({ odds: 45, levels: ['rookie', 'novice'], splitAt: 225 }),
    developing: Object.freeze({ odds: 40, levels: ['intermediate', 'advanced'], splitAt: 400 }),
    experienced: Object.freeze({ odds: 15, levels: ['expert'] }),
  }),
  trainer: Object.freeze({
    novice: Object.freeze({ odds: 45, levels: ['rookie', 'novice'], splitAt: 150 }),
    developing: Object.freeze({ odds: 40, levels: ['intermediate', 'advanced'], splitAt: 275 }),
    expert: Object.freeze({ odds: 15, levels: ['expert'] }),
  }),
  groom: Object.freeze({
    novice: Object.freeze({ odds: 40, levels: ['rookie', 'novice'], splitAt: 3 }),
    intermediate: Object.freeze({ odds: 35, levels: ['intermediate'] }),
    expert: Object.freeze({ odds: 20, levels: ['advanced'] }),
    master: Object.freeze({ odds: 5, levels: ['expert'] }),
  }),
});

function tiersFor(staffType) {
  const tiers = legacyTiers[staffType];
  if (!tiers) {
    throw new Error(`Unknown staff type: ${String(staffType)}`);
  }
  return tiers;
}

/**
 * A staff type's old skill words and the odds (out of 100) the game draws them with.
 * @param {'rider'|'trainer'|'groom'} staffType
 * @returns {Readonly<Record<string, number>>}
 */
export function staffSkillOdds(staffType) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(tiersFor(staffType)).map(([name, tier]) => [name, tier.odds]),
    ),
  );
}

/**
 * Draw the star level of a new staff member whose old skill word is already drawn:
 * evenly among that tier's levels.
 *
 * @param {'rider'|'trainer'|'groom'} staffType
 * @param {string} skillLevel
 * @param {() => number} [random] - returns [0, 1)
 * @returns {string}
 */
export function drawStarLevelInTier(staffType, skillLevel, random = Math.random) {
  const tiers = tiersFor(staffType);
  if (!Object.hasOwn(tiers, skillLevel)) {
    return 'rookie';
  }
  const { levels } = tiers[skillLevel];
  return levels[Math.min(levels.length - 1, Math.floor(random() * levels.length))];
}

/**
 * Draw a new staff member's old skill tier (with that type's existing odds) and the
 * star level inside it.
 *
 * @param {'rider'|'trainer'|'groom'} staffType
 * @param {() => number} [random] - returns [0, 1)
 * @returns {{ skillLevel: string, starLevel: string }}
 */
export function drawStaffLevel(staffType, random = Math.random) {
  const tiers = tiersFor(staffType);
  const entries = Object.entries(tiers);
  const total = entries.reduce((sum, [, tier]) => sum + tier.odds, 0);
  let roll = random() * total;
  let skillLevel = entries[entries.length - 1][0];
  for (const [name, tier] of entries) {
    if (roll < tier.odds) {
      skillLevel = name;
      break;
    }
    roll -= tier.odds;
  }
  return { skillLevel, starLevel: drawStarLevelInTier(staffType, skillLevel, random) };
}

/**
 * The star level of a staff member written before star levels existed: from its old
 * skill word and, inside a two-level tier, its old price (riders: weekly rate;
 * trainers: session rate; grooms: years of experience). An unknown skill word is a
 * Rookie.
 *
 * @param {'rider'|'trainer'|'groom'} staffType
 * @param {string|null|undefined} skillLevel
 * @param {number|null|undefined} measure - the old price (or groom experience)
 * @returns {string}
 */
export function legacyStaffLevel(staffType, skillLevel, measure) {
  const tiers = tiersFor(staffType);
  const tier =
    typeof skillLevel === 'string' && Object.hasOwn(tiers, skillLevel) ? tiers[skillLevel] : null;
  if (!tier) {
    return 'rookie';
  }
  if (tier.levels.length === 1) {
    return tier.levels[0];
  }
  return Number(measure) >= tier.splitAt ? tier.levels[1] : tier.levels[0];
}

/**
 * The level of a marketplace offer and what hiring it costs: always the level's price
 * (owner ruling 2026-10-28, q226: "change it now").
 *
 * An offer generated since star levels carries `starLevel`. An offer still sitting in a
 * player's marketplace from before carries only its old skill word (and its old price,
 * or for grooms years of experience), which places it on a level the same way the
 * backfill placed hired staff.
 *
 * @param {'rider'|'trainer'|'groom'} staffType
 * @param {{ starLevel?: string, skillLevel?: string }} offer
 * @param {number} [legacyMeasure] - see legacyStaffLevel; only read for an old offer
 * @returns {{ starLevel: string, fee: number }}
 */
export function offerLevelAndFee(staffType, offer, legacyMeasure) {
  const starLevel = isStaffLevel(offer?.starLevel)
    ? offer.starLevel
    : legacyStaffLevel(staffType, offer?.skillLevel, legacyMeasure);
  return { starLevel, fee: staffLevelFee(starLevel) };
}

/**
 * A marketplace offer as a player sees it: its star level and, in `priceField`, the
 * price hiring it will actually charge (offerLevelAndFee). An offer generated before
 * star levels still advertises its old price in storage; the list must show the price
 * the hire charges, never the stale one.
 *
 * @param {'rider'|'trainer'|'groom'} staffType
 * @param {Object} offer
 * @param {'weeklyRate'|'sessionRate'|'weeklyFee'} priceField
 * @param {number} [legacyMeasure] - see legacyStaffLevel
 * @returns {Object}
 */
export function offerAtLevelPrice(staffType, offer, priceField, legacyMeasure) {
  const { starLevel, fee } = offerLevelAndFee(staffType, offer, legacyMeasure);
  return { ...offer, starLevel, [priceField]: fee };
}

/**
 * What a hired rider or groom costs per week, or a hired trainer per session: its star
 * level's price. Owner ruling 2026-10-28 (q226): staff hired before star levels pay
 * their level's price too; nobody keeps an older rate.
 *
 * Throws for a row without a valid `starLevel` (the column is NOT NULL and CHECKed),
 * so a read that forgot to select it fails loudly instead of charging nothing.
 *
 * @param {{ starLevel?: string }} staff - the hired rider, trainer or groom row
 * @returns {number}
 */
export function hiredStaffFee(staff) {
  return staffLevelFee(staff?.starLevel);
}
