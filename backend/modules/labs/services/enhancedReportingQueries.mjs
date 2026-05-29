/**
 * Enhanced reporting route data-access helpers
 *
 * Wraps the seven prisma calls used by enhancedReportingRoutes.mjs so
 * the routes layer no longer imports prisma directly (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Fetch a trait-history log filtered by the caller's where-conditions
 * (trait type / sourceType / timestamp range), newest first.
 */
export function findTraitHistoryByWhere(whereConditions) {
  return prisma.traitHistoryLog.findMany({
    where: whereConditions,
    orderBy: { timestamp: 'desc' },
  });
}

/**
 * Fetch a horse + its traitHistoryLogs (newest first), used by the
 * epigenetic-insights and export-report endpoints.
 *
 * @param {number} horseId
 * @returns {Promise<object|null>}
 */
export function getHorseWithTraitHistoryLogs(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      traitHistoryLogs: { orderBy: { timestamp: 'desc' } },
    },
  });
}

/**
 * Fetch trait history (oldest first) for timeline building.
 *
 * @param {number} horseId
 */
export function findTraitHistoryForTimeline(horseId) {
  return prisma.traitHistoryLog.findMany({
    where: { horseId },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Fetch groom interactions (oldest first) with the per-groom name +
 * influence-type included.
 *
 * @param {number} horseId
 */
export function findGroomInteractionsForTimeline(horseId) {
  return prisma.groomInteraction.findMany({
    where: { foalId: horseId },
    orderBy: { createdAt: 'asc' },
    include: {
      groom: {
        select: { name: true, epigeneticInfluenceType: true },
      },
    },
  });
}

/**
 * Fetch every horse owned by `userId` + each horse's traitHistoryLogs,
 * used by the stable-report endpoint.
 *
 * @param {string|number} userId
 */
export function findUserHorsesWithTraitLogs(userId) {
  return prisma.horse.findMany({
    where: { userId },
    include: { traitHistoryLogs: true },
  });
}

/**
 * Batch-fetch a horse-comparison set: returns rows ONLY when `userId`
 * owns every id in `horseIds`. Caller maps a partial-ownership length
 * mismatch to HTTP 404 (CWE-639).
 *
 * @param {number[]} horseIds
 * @param {number|string} userId
 * @returns {Promise<Array<object>|null>}
 */
export async function findOwnedHorsesWithTraitLogs(horseIds, userId) {
  const horses = await prisma.horse.findMany({
    where: {
      id: { in: horseIds },
      userId,
    },
    include: { traitHistoryLogs: true },
  });
  return horses.length === horseIds.length ? horses : null;
}
