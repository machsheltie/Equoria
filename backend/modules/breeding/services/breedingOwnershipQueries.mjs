/**
 * Breeding — Horse ownership query helpers
 *
 * Data-access layer for advancedBreedingGeneticsRoutes.mjs ownership
 * lookups. Extracted so the routes layer never imports prisma directly
 * (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Batch-validate that `userId` owns EVERY horse id in `horseIds`. Returns
 * the matched horse rows when ownership is complete, or `null` when even
 * one id is missing/foreign. Single-query atomic check (CWE-639 friendly:
 * caller maps null → 404 rather than 403, so an attacker cannot
 * distinguish "not yours" from "doesn't exist").
 *
 * @param {number[]|number|string|string[]} horseIds
 * @param {number} userId
 * @returns {Promise<Array<object>|null>}
 */
export async function validateBatchHorseOwnership(horseIds, userId) {
  const horseIdsInt = Array.isArray(horseIds)
    ? horseIds.map(id => parseInt(id, 10))
    : [parseInt(horseIds, 10)];

  const horses = await prisma.horse.findMany({
    where: {
      id: { in: horseIdsInt },
      userId,
    },
  });

  return horses.length === horseIdsInt.length ? horses : null;
}

/**
 * Return the ids of every horse owned by `userId`. Used by the
 * diversity-report and population-health endpoints which then feed the
 * id list into downstream genetics services.
 *
 * @param {number|string} userId
 * @returns {Promise<number[]>}
 */
export async function getUserHorseIds(userId) {
  const horses = await prisma.horse.findMany({
    where: { userId: parseInt(userId, 10) },
    select: { id: true },
  });
  return horses.map(h => h.id);
}
