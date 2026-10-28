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
 * The level of a marketplace offer and what hiring it costs.
 *
 * An offer generated since this ruling carries `starLevel`; hiring it costs that
 * level's price. An offer still sitting in a player's marketplace from before carries
 * only its advertised price, which is what the player was shown, so that is what it
 * costs; its level is placed from its old skill word.
 *
 * @param {'rider'|'trainer'|'groom'} staffType
 * @param {{ starLevel?: string, skillLevel?: string, experience?: number }} offer
 * @param {number} advertisedPrice - the old offer's price for one week / one session
 * @param {number} [legacyMeasure] - see legacyStaffLevel (defaults to advertisedPrice)
 * @returns {{ starLevel: string, fee: number }}
 */
export function offerLevelAndFee(
  staffType,
  offer,
  advertisedPrice,
  legacyMeasure = advertisedPrice,
) {
  if (isStaffLevel(offer?.starLevel)) {
    return { starLevel: offer.starLevel, fee: staffLevelFee(offer.starLevel) };
  }
  return {
    starLevel: legacyStaffLevel(staffType, offer?.skillLevel, legacyMeasure),
    fee: Number(advertisedPrice),
  };
}

/**
 * OWNER QUESTION q226 (open, 2026-10-28): do staff hired before the star levels switch
 * to their level's price?
 *
 * Until the owner answers, staff already hired keep the price they were hired at.
 * Staff hired since the ruling were hired at their level's price, so for them both
 * answers give the same number. To switch everyone to the level price, set this to
 * false; nothing else changes.
 */
export const alreadyHiredStaffKeepTheirPrice = true;

/**
 * What a hired rider costs per week, or a hired trainer per session.
 *
 * @param {{ starLevel?: string }} staff - the hired rider or trainer row
 * @param {number|null|undefined} priceAtHire - Rider.weeklyRate / Trainer.sessionRate
 * @returns {number}
 */
export function hiredStaffFee(staff, priceAtHire) {
  const atHire = Number(priceAtHire);
  if (alreadyHiredStaffKeepTheirPrice && Number.isFinite(atHire) && atHire > 0) {
    return atHire;
  }
  if (isStaffLevel(staff?.starLevel)) {
    return staffLevelFee(staff.starLevel);
  }
  return Number.isFinite(atHire) && atHire > 0 ? atHire : 0;
}
