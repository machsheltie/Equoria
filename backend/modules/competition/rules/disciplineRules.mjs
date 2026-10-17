/**
 * disciplineRules.mjs (Equoria-576c0 B3)
 *
 * The one owner of the competition discipline stat map. Owner ruling R8
 * (Stacey, 2026-10-15): it is the competition bible's 23-discipline table
 * (docs/features/13_Competitions_shows_Event_Scoring_DEEP.md, "Discipline stat
 * model"), each discipline weighted 50% / 30% / 20% across a primary, secondary
 * and tertiary stat. Ruling C6 (2026-10-16): Racing's tertiary stat is Focus,
 * as the bible table says.
 *
 * A name outside the table is an unknown discipline and an error; nothing falls
 * back to the Racing stats. 'Obedience Training' is a training discipline, not a
 * competition one.
 */

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
});

/** The 23 competition disciplines, in bible order. */
export const COMPETITION_DISCIPLINES = Object.freeze(Object.keys(DISCIPLINE_STATS));

/**
 * @param {string} discipline
 * @returns {boolean} Whether `discipline` is one of the 23 (exact, case-sensitive name).
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
