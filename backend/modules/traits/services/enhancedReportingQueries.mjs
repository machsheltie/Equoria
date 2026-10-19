/**
 * Enhanced reporting route data-access helpers
 *
 * Wraps the seven prisma calls used by enhancedReportingRoutes.mjs so
 * the routes layer no longer imports prisma directly (Equoria-becrm).
 *
 * Every trait-history read here feeds a response, so each leaves out rows
 * naming a trait still hidden on the horse (Equoria-6dace,
 * visibleTraitHistory.mjs).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { visibleTraitHistoryWhere, withVisibleTraitHistoryLogs } from './visibleTraitHistory.mjs';

/**
 * Fetch a trait-history log filtered by the caller's where-conditions
 * (horseId plus sourceType / timestamp range), newest first. Rows naming a
 * trait still hidden on the horse are left out (Equoria-6dace).
 */
export async function findTraitHistoryByWhere(whereConditions) {
  return prisma.traitHistoryLog.findMany({
    where: await visibleTraitHistoryWhere(whereConditions),
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
export async function getHorseWithTraitHistoryLogs(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      traitHistoryLogs: { orderBy: { timestamp: 'desc' } },
    },
  });
  return withVisibleTraitHistoryLogs(horse);
}

/**
 * Fetch trait history (oldest first) for timeline building.
 *
 * @param {number} horseId
 */
export async function findTraitHistoryForTimeline(horseId) {
  return prisma.traitHistoryLog.findMany({
    where: await visibleTraitHistoryWhere({ horseId }),
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
export async function findUserHorsesWithTraitLogs(userId) {
  const horses = await prisma.horse.findMany({
    where: { userId },
    include: { traitHistoryLogs: true },
  });
  return horses.map(withVisibleTraitHistoryLogs);
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
  return horses.length === horseIds.length ? horses.map(withVisibleTraitHistoryLogs) : null;
}
