/**
 * neutralTemperament.mjs (Equoria-576c0.5)
 *
 * Every horse has a temperament (NOT NULL), and the ridden scorer refuses one
 * outside the owner's matrix. A scoring test that isolates another term gives
 * its horse a temperament worth 0% in the show's discipline. A discipline
 * outside the 24 has no matrix row; any temperament is fine there, so this
 * returns 'Calm'.
 */

import { temperamentPercent } from '../../modules/competition/rules/disciplineRules.mjs';
import { horseTemperamentValues } from '../../constants/schema.mjs';

/**
 * @param {string} discipline
 * @returns {string} a temperament scoring 0% in that discipline
 */
export function neutralTemperament(discipline) {
  if (horseTemperamentValues.every(t => temperamentPercent(discipline, t) === null)) {
    return 'Calm';
  }
  const neutral = horseTemperamentValues.find(t => temperamentPercent(discipline, t) === 0);
  if (!neutral) {
    throw new Error(`neutralTemperament: the ${discipline} row has no 0% temperament`);
  }
  return neutral;
}

export default neutralTemperament;
