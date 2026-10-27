/**
 * Trait reveal settings (Equoria-2d55z). One object, read by
 * modules/traits/services/traitRevealEngine.mjs.
 *
 * Owner rulings 2026-10-27 (q113-q116, q118, q139):
 *   - Rarity gates: 3 / 6 / 12 / 16 / 19 groomed days for Common / Uncommon /
 *     Rare / Ultra Rare / Legendary. From the groomed day that opens a gate
 *     (that day included, q139) every groomed day rolls a chance for each trait
 *     at or below it. Reaching the next gate adds the rarer traits; the
 *     commoner ones keep rolling. Neglect mirrors this for negative traits.
 *   - A flat 25% chance per qualifying day, whatever the rarity.
 *   - The first 21 days of life only. The birth day is day 1.
 *   - Switching a trait off needs the same day counts of the opposite care,
 *     and grooming can switch off any active negative trait.
 *
 *   - Each trait's rarity (q134) and polarity (q135) are read from the roster
 *     table in utils/epigeneticTraits.mjs, their one source. A trait with no
 *     ruled rarity or polarity would never be touched by the engine.
 */

import { getTraitDefinition, traitRosterIds } from '../../../utils/epigeneticTraits.mjs';

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

/** One entry per roster trait, read from its definition (null when not ruled). */
const perTrait = field =>
  Object.freeze(
    Object.fromEntries(traitRosterIds.map(id => [id, getTraitDefinition(id)?.[field] ?? null])),
  );

export const traitRevealSettings = Object.freeze({
  /**
   * Days of grooming (positive traits) or of neglect (negative traits) that open
   * a rarity's gate. The qualifying day that reaches the gate rolls, and so does
   * every qualifying day after it (q139).
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
   * Whether each roster trait acts positively or negatively (q135): 'positive'
   * or 'negative'.
   */
  traitPolarity: perTrait('type'),

  /**
   * Rarity of each roster trait (q134): one of traitRarities. Players never see
   * it (q112).
   */
  traitRarity: perTrait('rarity'),
});

export default traitRevealSettings;
