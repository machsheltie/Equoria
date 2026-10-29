/**
 * neutralTemperament.mjs (Equoria-576c0.5)
 *
 * Every horse has a temperament (NOT NULL), and the ridden scorer refuses one
 * outside the owner's matrix. A scoring test that isolates another term gives
 * its horse a temperament worth 0% in the show's discipline, the first such
 * entry in the matrix row. A discipline outside the 24 has no row; any
 * temperament is fine there, so this returns 'Calm'.
 */

import { TEMPERAMENT_MATRIX } from '../../modules/competition/rules/disciplineRules.mjs';

/**
 * @param {string} discipline
 * @returns {string} a temperament scoring 0% in that discipline
 */
export function neutralTemperament(discipline) {
  const row = TEMPERAMENT_MATRIX[discipline];
  if (!row) {
    return 'Calm';
  }
  const entry = Object.entries(row).find(([, effect]) => effect === 0);
  if (!entry) {
    throw new Error(`neutralTemperament: the ${discipline} row has no 0% temperament`);
  }
  return entry[0];
}

export default neutralTemperament;
