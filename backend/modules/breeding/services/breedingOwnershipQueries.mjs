/**
 * Breeding — Horse ownership query helpers
 *
 * Data-access layer for advancedBreedingGeneticsRoutes.mjs ownership
 * lookups. Extracted so the routes layer never imports prisma directly
 * (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { toPredictionView } from './predictionHorseView.mjs';

/**
 * Owner ruling S9 (Stacey, 2026-10-15): predictions are allowed for a stallion
 * at public AND at private stud. Any other stallion must be the caller's own.
 */
const PREDICTABLE_STUD_STATUSES = Object.freeze(['At Public Stud', 'At Private Stud']);

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
 * @param {string} userId  User.id is a UUID (String); Horse.userId is String.
 * @returns {Promise<number[]>}
 */
export async function getUserHorseIds(userId) {
  // Equoria-emkv6: User.id is a UUID String and Horse.userId is String — the old
  // `parseInt(userId, 10)` produced NaN for a UUID -> Prisma type error -> 500 on
  // the diversity-report endpoint. Match the userId String directly.
  const horses = await prisma.horse.findMany({
    where: { userId },
    select: { id: true },
  });
  return horses.map(h => h.id);
}

/**
 * Access for the pair predictions (Equoria-q4uem.9 slice 4): the MARE must be
 * the caller's; the STALLION must be the caller's or listed at stud (public or
 * private, ruling S9). Anything else is null, which callers answer with the
 * same 404 a missing horse gets (CWE-639). Both rows come back through
 * toPredictionView (no unrevealed hidden traits, S-Q9; no competition records
 * of a horse the caller does not own, design §0) and in a fixed order — the
 * findMany above does not promise one, and destructuring it as
 * [stallion, mare] could swap them.
 *
 * @param {number|string} stallionId
 * @param {number|string} mareId
 * @param {string} userId
 * @returns {Promise<{ stallion: object, mare: object, stallionOwned: boolean } | null>}
 */
export async function resolveBreedingPairAccess(stallionId, mareId, userId) {
  const [stallion, mare] = await Promise.all([
    prisma.horse.findUnique({ where: { id: parseInt(stallionId, 10) } }),
    prisma.horse.findUnique({ where: { id: parseInt(mareId, 10) } }),
  ]);
  if (!mare || mare.userId !== userId || !stallion || stallion.id === mare.id) {
    return null;
  }
  const stallionOwned = stallion.userId === userId;
  if (!stallionOwned && !PREDICTABLE_STUD_STATUSES.includes(stallion.studStatus)) {
    return null;
  }
  return {
    stallion: toPredictionView(stallion, { viewerId: userId }),
    mare: toPredictionView(mare, { viewerId: userId }),
    stallionOwned,
  };
}
