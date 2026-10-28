/**
 * gaitedBreed.mjs (Equoria-uszhf)
 *
 * Owner ruling 2026-10-19: Gaited is a breed property. A horse of a gaited
 * breed (breeds.breedGeneticProfile.ratingProfiles.isGaitedBreed) may train
 * and show Gaited; a horse of any other breed never may, whatever traits it
 * carries. This is the one rule every Gaited gate reads: training
 * eligibility, the trainable-disciplines list, show entry and the show
 * eligibility summary, and the birth discipline.
 */

import { DISCIPLINES } from '../constants/schema.mjs';

const gaitedDiscipline = DISCIPLINES.GAITED;

/**
 * @param {unknown} breedGeneticProfile - breeds.breedGeneticProfile (JSONB).
 * @returns {boolean} Whether the profile marks the breed gaited.
 */
export function isGaitedBreedProfile(breedGeneticProfile) {
  return breedGeneticProfile?.ratingProfiles?.isGaitedBreed === true;
}

/**
 * @param {{ breedGeneticProfile?: unknown }|null|undefined} breed - a breeds row.
 * @returns {boolean} Whether the breed is gaited.
 */
export function isGaitedBreed(breed) {
  return isGaitedBreedProfile(breed?.breedGeneticProfile);
}

/**
 * Whether a horse of `breed` may train or show in `discipline`. Only Gaited is
 * breed-gated; every other discipline is open to every breed.
 *
 * @param {{ breedGeneticProfile?: unknown }|null|undefined} breed
 * @param {string} discipline
 * @returns {boolean}
 */
export function breedAllowsDiscipline(breed, discipline) {
  return discipline !== gaitedDiscipline || isGaitedBreed(breed);
}
