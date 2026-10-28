/**
 * Trait History Service
 *
 * Logs trait development history for horses (TraitHistoryLog rows).
 *
 * Equoria-1vep2: the history readers (getTraitHistoryPage, getTraitHistory,
 * getTraitDevelopmentSummary, analyzeTraitPatterns) and cleanupTraitHistory
 * lost their last route with the trait reports (owner ruling 2026-10-28,
 * q152: no trait reports for players) and were deleted, with the read-time
 * hidden-trait filter (visibleTraitHistory.mjs) that only they used.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

/**
 * Logs a trait assignment to the history
 * @param {Object} traitData - Data about the trait assignment
 * @param {Object} [client] - Prisma client or interactive transaction; pass the
 *   caller's tx so the history row commits with the trait it records.
 * @returns {Object} Created trait history log entry
 */
export async function logTraitAssignment(traitData, client = prisma) {
  const {
    horseId,
    traitName,
    sourceType, // 'groom', 'milestone', 'environmental', 'genetic'
    sourceId,
    influenceScore = 0,
    isEpigenetic = false,
    groomId = null,
    bondScore = null,
  } = traitData;

  // Calculate horse age in days
  const horse = await client.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true },
  });

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  const ageInDays = getHorseAgeDays(horse.dateOfBirth);

  // Create the trait history log entry
  const historyEntry = await client.traitHistoryLog.create({
    data: {
      horseId,
      traitName,
      sourceType,
      sourceId: sourceId?.toString(),
      influenceScore,
      isEpigenetic,
      groomId,
      bondScore,
      ageInDays,
      timestamp: new Date(),
    },
    include: {
      horse: {
        select: { name: true, dateOfBirth: true },
      },
      groom: {
        select: { name: true, epigeneticInfluenceType: true },
      },
    },
  });

  return historyEntry;
}
