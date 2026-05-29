/**
 * Epigenetic trait route data-access helpers
 *
 * Wraps the three prisma calls used by epigeneticTraitRoutes.mjs so the
 * routes layer no longer imports prisma directly (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Fetch a horse with the active-groom-assignment include needed by the
 * milestone-evaluation endpoint. Returns `null` if the row no longer
 * exists.
 *
 * @param {number} horseId
 * @returns {Promise<object|null>}
 */
export async function getHorseWithActiveGroomAssignments(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      groomAssignments: {
        where: { isActive: true },
        include: {
          groom: {
            select: {
              id: true,
              name: true,
              epigeneticInfluenceType: true,
              speciality: true,
              experience: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Fetch the groom-care history (last 100 interactions + all assignments)
 * for a horse, used to feed enhanced milestone evaluation.
 *
 * @param {number} horseId
 * @returns {Promise<{ interactions: Array, assignments: Array, bondHistory: Array, stressHistory: Array }>}
 */
export async function getGroomCareHistoryForHorse(horseId) {
  const [interactions, assignments] = await Promise.all([
    prisma.groomInteraction.findMany({
      where: { foalId: horseId },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            epigeneticInfluenceType: true,
            speciality: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100, // Last 100 interactions
    }),
    prisma.groomAssignment.findMany({
      where: { foalId: horseId },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            epigeneticInfluenceType: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  return {
    interactions,
    assignments,
    bondHistory: [], // Would be populated from bond tracking
    stressHistory: [], // Would be populated from stress tracking
  };
}
