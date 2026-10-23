/**
 * disciplineRules.mjs (Equoria-576c0 B3)
 *
 * The one owner of the competition discipline stat map. Owner ruling R8
 * (Stacey, 2026-10-15): it is the competition bible's 24-discipline table
 * (docs/features/13_Competitions_shows_Event_Scoring_DEEP.md, "Discipline stat
 * model"), each discipline weighted 50% / 30% / 20% across a primary, secondary
 * and tertiary stat. Ruling C6 (2026-10-16): Racing's tertiary stat is Focus,
 * as the bible table says. Pleasure Driving (Obedience / Balance / Focus) was
 * added by the owner on 2026-10-21.
 *
 * A name outside the table is an unknown discipline and an error; nothing falls
 * back to the Racing stats. 'Obedience Training' is a training discipline, not a
 * competition one.
 */

import { HORSE_TEMPERAMENT_VALUES } from '../../../constants/schema.mjs';
import {
  disciplineAffinityKey,
  normalizeEpigeneticModifiers,
} from '../../../utils/epigeneticTraitKeyMap.mjs';

/** [50% primary, 30% secondary, 20% tertiary] per competition discipline. */
export const DISCIPLINE_STATS = Object.freeze({
  'Western Pleasure': Object.freeze(['focus', 'obedience', 'intelligence']),
  Reining: Object.freeze(['agility', 'precision', 'focus']),
  Cutting: Object.freeze(['intelligence', 'agility', 'boldness']),
  'Barrel Racing': Object.freeze(['speed', 'agility', 'obedience']),
  Roping: Object.freeze(['precision', 'focus', 'speed']),
  'Team Penning': Object.freeze(['intelligence', 'agility', 'stamina']),
  Rodeo: Object.freeze(['boldness', 'agility', 'stamina']),
  Hunter: Object.freeze(['balance', 'precision', 'intelligence']),
  Saddleseat: Object.freeze(['flexibility', 'balance', 'obedience']),
  Endurance: Object.freeze(['stamina', 'intelligence', 'speed']),
  Eventing: Object.freeze(['stamina', 'boldness', 'agility']),
  Dressage: Object.freeze(['precision', 'focus', 'obedience']),
  'Show Jumping': Object.freeze(['balance', 'agility', 'boldness']),
  Vaulting: Object.freeze(['flexibility', 'balance', 'obedience']),
  Polo: Object.freeze(['speed', 'boldness', 'agility']),
  'Cross Country': Object.freeze(['stamina', 'boldness', 'intelligence']),
  'Combined Driving': Object.freeze(['obedience', 'stamina', 'focus']),
  'Fine Harness': Object.freeze(['flexibility', 'precision', 'balance']),
  Gaited: Object.freeze(['flexibility', 'balance', 'obedience']),
  Gymkhana: Object.freeze(['speed', 'flexibility', 'focus']),
  Steeplechase: Object.freeze(['stamina', 'boldness', 'balance']),
  Racing: Object.freeze(['speed', 'stamina', 'focus']),
  'Harness Racing': Object.freeze(['speed', 'precision', 'stamina']),
  'Pleasure Driving': Object.freeze(['obedience', 'balance', 'focus']),
});

/** The 24 competition disciplines, in bible order. */
export const COMPETITION_DISCIPLINES = Object.freeze(Object.keys(DISCIPLINE_STATS));

/**
 * @param {string} discipline
 * @returns {boolean} Whether `discipline` is one of the 24 (exact, case-sensitive name).
 */
export function isKnownDiscipline(discipline) {
  return typeof discipline === 'string' && Object.hasOwn(DISCIPLINE_STATS, discipline);
}

/**
 * The [primary, secondary, tertiary] stats of a competition discipline.
 *
 * @param {string} discipline
 * @returns {readonly string[]}
 * @throws {Error} For a name outside the table (no Racing fallback).
 */
export function getDisciplineStats(discipline) {
  if (!isKnownDiscipline(discipline)) {
    throw new Error(`Unknown competition discipline: ${discipline}`);
  }
  return DISCIPLINE_STATS[discipline];
}

/**
 * The 12 temperaments, in the column order of the owner's matrix
 * (EquoriaBible/RelevantFiles/Equoria_Temperament_Competition_Matrix.xlsx).
 * The one list is constants/schema.mjs HORSE_TEMPERAMENT.
 */
export const TEMPERAMENTS = HORSE_TEMPERAMENT_VALUES;

/**
 * Temperament effect per ridden discipline: 1 Positive, 0 Neutral, -1 Negative.
 * Owner ruling R1 (2026-10-15); the cells of the matrix's "Matrix" sheet
 * govern (O4, 2026-10-16), generated from the xlsx on 2026-10-17 (Equoria-576c0
 * B6). Conformation and parade rows are not in the sheet yet (O3). Owner
 * ruling 2026-10-21: Playful became Driven, Willing was added, and every row
 * (Pleasure Driving included) was regenerated from her updated sheet.
 */
// prettier-ignore
export const TEMPERAMENT_MATRIX = Object.freeze({
  'Western Pleasure': Object.freeze({ Spirited: 0, Nervous: -1, Calm: 1, Bold: 0, Steady: 1, Willing: 1, Independent: -1, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: 1, Aggressive: -1 }),
  Reining: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 1, Willing: 1, Independent: 0, Reactive: 0, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  Cutting: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 1, Bold: 1, Steady: 0, Willing: 0, Independent: 1, Reactive: 1, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: 0 }),
  'Barrel Racing': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 1, Independent: 1, Reactive: 0, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: -1 }),
  Roping: Object.freeze({ Spirited: 0, Nervous: -1, Calm: 1, Bold: 1, Steady: 1, Willing: 1, Independent: 1, Reactive: 0, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  'Team Penning': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 0, Independent: 1, Reactive: 0, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  Rodeo: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 1, Willing: 0, Independent: 0, Reactive: -1, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: -1 }),
  Hunter: Object.freeze({ Spirited: -1, Nervous: -1, Calm: 1, Bold: 0, Steady: 1, Willing: 1, Independent: 0, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: 0, Aggressive: -1 }),
  Saddleseat: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 1, Independent: -1, Reactive: 0, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  Endurance: Object.freeze({ Spirited: 0, Nervous: -1, Calm: 1, Bold: 1, Steady: 1, Willing: 0, Independent: 1, Reactive: -1, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: -1 }),
  Eventing: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 1, Bold: 1, Steady: 0, Willing: 1, Independent: 1, Reactive: -1, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  Dressage: Object.freeze({ Spirited: 0, Nervous: -1, Calm: 1, Bold: 0, Steady: 1, Willing: 1, Independent: -1, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: 0, Aggressive: -1 }),
  'Show Jumping': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 1, Independent: 0, Reactive: 0, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  Vaulting: Object.freeze({ Spirited: -1, Nervous: -1, Calm: 1, Bold: 0, Steady: 1, Willing: 1, Independent: 0, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: 0, Aggressive: -1 }),
  Polo: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 0, Independent: 1, Reactive: 0, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: 0 }),
  'Cross Country': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 1, Independent: 1, Reactive: -1, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: -1 }),
  'Combined Driving': Object.freeze({ Spirited: 0, Nervous: -1, Calm: 1, Bold: 1, Steady: 1, Willing: 1, Independent: -1, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: -1, Aggressive: -1 }),
  'Fine Harness': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 1, Independent: -1, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: -1, Aggressive: -1 }),
  Gaited: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 1, Bold: 1, Steady: 0, Willing: 1, Independent: 0, Reactive: -1, Stubborn: -1, Driven: 0, Lazy: -1, Aggressive: -1 }),
  Gymkhana: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 1, Bold: 1, Steady: 0, Willing: 1, Independent: 0, Reactive: 0, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: -1 }),
  Steeplechase: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 0, Independent: 1, Reactive: -1, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: 0 }),
  'Harness Racing': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 0, Steady: 1, Willing: 0, Independent: 0, Reactive: -1, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: 0 }),
  Racing: Object.freeze({ Spirited: 1, Nervous: -1, Calm: 0, Bold: 1, Steady: 0, Willing: 0, Independent: 0, Reactive: 0, Stubborn: -1, Driven: 1, Lazy: -1, Aggressive: 0 }),
  'Pleasure Driving': Object.freeze({ Spirited: 1, Nervous: -1, Calm: 1, Bold: 1, Steady: 1, Willing: 1, Independent: 0, Reactive: -1, Stubborn: -1, Driven: -1, Lazy: 0, Aggressive: -1 }),
});

/** Percent per matrix effect (R1): Positive +5, Neutral 0, Negative -5. */
const TEMPERAMENT_EFFECT_PERCENT = 5;

/**
 * The temperament percent term for a ridden discipline.
 *
 * @param {string} discipline - One of the 24 competition disciplines.
 * @param {string|null|undefined} temperament - One of the 12 (exact name).
 * @returns {number|null} +5, 0 or -5; null when the temperament is missing or
 *   not one of the 12, or the discipline has no matrix row. The caller decides
 *   what null means; nothing here invents a temperament.
 */
export function temperamentPercent(discipline, temperament) {
  if (!isKnownDiscipline(discipline) || typeof temperament !== 'string') {
    return null;
  }
  const row = TEMPERAMENT_MATRIX[discipline];
  if (!Object.hasOwn(row, temperament)) {
    return null;
  }
  return row[temperament] * TEMPERAMENT_EFFECT_PERCENT;
}

/**
 * Flat score points for a horse whose discipline trait matches the show's
 * discipline: owner rulings 2026-10-19/20 (+5, added to the base before the
 * luck, rider and temperament percentages) and decision D (2026-10-23, epic
 * Equoria-k1p62: flat points, not a percent).
 */
export const matchingTraitBonus = 5;

/**
 * The matching-trait points for a ridden discipline (Equoria-k1p62.1).
 *
 * The owner's discipline trait replaces the 23 disciplineAffinity<Discipline>
 * traits, and until it has storage of its own that trait is how a horse carries
 * it. Only a revealed trait (epigeneticModifiers.positive) counts: a hidden
 * trait is inert until revealed (owner ruling 2026-10-19). Legacy snake-case
 * keys are normalized first.
 *
 * @param {unknown} epigeneticModifiers - Horse.epigeneticModifiers (JSONB).
 * @param {string} discipline - The show's discipline.
 * @returns {number} matchingTraitBonus or 0 (also 0 outside the 24).
 */
export function matchingTraitPoints(epigeneticModifiers, discipline) {
  if (!isKnownDiscipline(discipline)) {
    return 0;
  }
  const { positive } = normalizeEpigeneticModifiers(epigeneticModifiers);
  return positive.includes(disciplineAffinityKey(discipline)) ? matchingTraitBonus : 0;
}
