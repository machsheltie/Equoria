/**
 * Trait reveal settings (Equoria-2d55z). One object, read by
 * modules/traits/services/traitRevealEngine.mjs.
 *
 * Owner rulings 2026-10-27 (q113-q116, q118):
 *   - Rarity gates: 3 / 6 / 12 / 16 / 19 groomed days for Common / Uncommon /
 *     Rare / Ultra Rare / Legendary. Reaching a gate is not a reveal: every
 *     groomed day AFTER the gate rolls a chance for each trait at or below it.
 *     Reaching the next gate adds the rarer traits; the commoner ones keep
 *     rolling. Neglect mirrors this for negative traits.
 *   - A flat 25% chance per qualifying day, whatever the rarity.
 *   - The first 21 days of life only. The birth day is day 1.
 *   - Switching a trait off needs the same day counts of the opposite care,
 *     and grooming can switch off any active negative trait.
 *
 * NOT YET RULED (asked of the owner): the rarity of each of the 20 roster
 * traits, and whether each acts positively or negatively. Until both are
 * filled for a trait the engine never touches it, and while no trait has both
 * the nightly job does nothing at all (it returns `skipped: 'noTraitsRuled'`).
 */

import { traitRosterIds } from '../../../utils/epigeneticTraits.mjs';

/** Rarity names the owner ruled (q98), as stored in this file. */
export const traitRarities = Object.freeze([
  'common',
  'uncommon',
  'rare',
  'ultraRare',
  'legendary',
]);

/** Groomed (or neglected) days that open each rarity's gate (q113). */
const gateDays = Object.freeze({ common: 3, uncommon: 6, rare: 12, ultraRare: 16, legendary: 19 });

/** One null entry per roster trait: a value the owner has not ruled yet. */
const pendingPerTrait = () =>
  Object.freeze(Object.fromEntries(traitRosterIds.map(id => [id, null])));

export const traitRevealSettings = Object.freeze({
  /**
   * Days of grooming (positive traits) or of neglect (negative traits) that open
   * a rarity's gate. Rolls start on the qualifying day after the gate is reached.
   */
  revealDays: Object.freeze({ positive: gateDays, negative: gateDays }),

  /** The same counts of the opposite care switch an active trait off (q116). */
  switchOffDays: Object.freeze({ positive: gateDays, negative: gateDays }),

  /** Chance rolled on each qualifying day, for every rarity (q114). */
  dailyChance: Object.freeze({
    common: 0.25,
    uncommon: 0.25,
    rare: 0.25,
    ultraRare: 0.25,
    legendary: 0.25,
  }),

  /** The last day of life evaluated; the birth day is day 1 (q115). */
  lastDayOfLife: 21,

  /**
   * Whether each roster trait acts positively or negatively: 'positive',
   * 'negative' or null (not ruled yet; the trait is never evaluated).
   */
  traitPolarity: pendingPerTrait(),

  /**
   * Rarity of each roster trait: one of traitRarities, or null (not ruled yet;
   * the trait is never evaluated).
   */
  traitRarity: pendingPerTrait(),
});

export default traitRevealSettings;
