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
 * gate as breeding and every show entry). A trainer is required (owner ruling
 * 2026-10-26, Equoria-r8a6h): a horse with no assigned trainer does not train,
 * and every surface says so with the same coded refusal.
 */

import { minActiveAgeYears, maxActiveAgeYears } from '../../../constants/horseAgePolicy.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
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

/** Machine-readable `code` for a refused training session; for branching, never shown. */
export const trainingRefusal = Object.freeze({
  trainerRequired: 'trainerRequired',
});

/** The authored reason a horse with no assigned trainer cannot train. */
export const trainerRequiredReason = horseName =>
  `${horseName ?? 'This horse'} needs a trainer before training. Assign a trainer first.`;

/**
 * The horses among `horseIds` that have an active, not-retired assigned
 * trainer. One query, used by the train call, the verdict and the list alike.
 *
 * @param {number[]} horseIds
 * @returns {Promise<Set<number>>}
 */
export async function horseIdsWithTrainer(horseIds) {
  if (horseIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.trainerAssignment.findMany({
    where: { horseId: { in: horseIds }, isActive: true, trainer: { retired: false } },
    select: { horseId: true },
  });
  return new Set(rows.map(r => r.horseId));
}

/**
 * @param {{ id: number, name?: string|null }} horse
 * @returns {Promise<string|null>} the player-facing reason, or null when a trainer is assigned
 */
export async function trainerRefusalReason(horse) {
  const withTrainer = await horseIdsWithTrainer([horse.id]);
  return withTrainer.has(horse.id) ? null : trainerRequiredReason(horse.name);
}
