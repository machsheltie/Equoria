/**
 * Environmental — Horse data access service
 *
 * Thin data-access layer for environmental-impact endpoints. Extracted from
 * environmentalRoutes.mjs so the routes layer never touches prisma directly
 * (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Fetch a user's horses by id with the column subset needed by
 * environmental-impact calculations, and verify the user owns every
 * requested id. Returns null if any requested horse is missing or not
 * owned by the user (caller maps to HTTP 404 — see CWE-639 note in the
 * route handler).
 *
 * @param {number[]} horseIds - integer horse ids
 * @param {number} userId - owning user id
 * @returns {Promise<Array<object>|null>}
 */
export async function fetchOwnedHorsesForEnvironmentalImpact(horseIds, userId) {
  const ids = horseIds.map(id => parseInt(id, 10));
  const horses = await prisma.horse.findMany({
    where: {
      id: { in: ids },
      userId,
    },
    select: {
      id: true,
      name: true,
      age: true,
      epigeneticModifiers: true,
      speed: true,
      stamina: true,
      agility: true,
      intelligence: true,
    },
  });

  if (horses.length !== ids.length) {
    return null;
  }
  return horses;
}
