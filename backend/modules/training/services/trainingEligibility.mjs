/**
 * Why a horse may not be trained, by age and health (Equoria-du9bn).
 *
 * The one place these refusals are decided: the train call's eligibility check
 * (trainingController.canTrain) and the trainable-horses list both ask here, so
 * the list can never call a horse ready that the train call refuses. Cooldown
 * and discipline requirements are separate and stay with their callers.
 *
 * Rules (owner rulings 2026-10-23): the active-age window is 3-20 inclusive
 * (constants/horseAgePolicy.mjs; retirement at 21), an injured horse does not
 * train, and a horse must be Fair or better to train (hasBadHealth, the same
 * gate as breeding and every show entry).
 */

import { minActiveAgeYears, maxActiveAgeYears } from '../../../constants/horseAgePolicy.mjs';
import { badHealthMessage, hasBadHealth } from '../../../utils/horseHealth.mjs';

/**
 * @param {{ name?: string|null, healthStatus?: string|null }} horse - with the
 *   fields hasBadHealth reads (age, lastFedDate, lastVettedDate, healthStatus)
 * @param {number} effectiveAge - the horse's age in game-years
 * @returns {string|null} the player-facing reason it cannot train, or null
 */
export function trainingRefusalReason(horse, effectiveAge) {
  if (effectiveAge < minActiveAgeYears) {
    return 'Horse is under age';
  }
  if (effectiveAge > maxActiveAgeYears) {
    return 'Horse is too old to train';
  }
  // Case-insensitive against healthStatus casing drift; a null status is not injured.
  if (
    String(horse.healthStatus ?? '')
      .trim()
      .toLowerCase() === 'injured'
  ) {
    return 'Horse is injured and cannot train';
  }
  if (hasBadHealth(horse)) {
    return badHealthMessage(horse.name ?? 'This horse', 'train');
  }
  return null;
}
