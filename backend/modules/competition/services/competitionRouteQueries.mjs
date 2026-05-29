/**
 * Competition route data-access helpers
 *
 * Wraps the prisma calls used by competitionRoutes.mjs so the routes layer
 * no longer imports prisma directly (Equoria-becrm).
 *
 * Note: the enter-show transaction (`enterShowDeferredTx`) is intentionally
 * kept here rather than pushed into the existing show services because the
 * route's semantics — debit/credit + ShowEntry create + ledger record in a
 * single tx — are specific to this deferred-entry endpoint and mirror
 * `showController.enterShow` only at the route layer. Future consolidation
 * with the canonical enterShow should be tracked separately.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

/**
 * Paginated list of open shows + total count, used by `GET /api/competition`.
 *
 * @param {object} params
 * @param {object} params.where - prisma where-filter (caller supplies status:'open')
 * @param {number} params.skip
 * @param {number} params.take
 * @returns {Promise<{ shows: Array<object>, total: number }>}
 */
export async function listShowsPaginated({ where, skip, take }) {
  const [shows, total] = await Promise.all([
    prisma.show.findMany({
      where,
      orderBy: { runDate: 'asc' },
      skip,
      take,
    }),
    prisma.show.count({ where }),
  ]);
  return { shows, total };
}

/**
 * Fetch a show summary (id + metadata) used by the entries-preview endpoint.
 *
 * @param {number} showId
 * @returns {Promise<object|null>}
 */
export function getShowMetadata(showId) {
  return prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      name: true,
      discipline: true,
      entryFee: true,
      maxEntries: true,
      status: true,
      closeDate: true,
    },
  });
}

/**
 * Fetch every entry for a show with the full per-horse stat snapshot the
 * preview endpoint needs.
 *
 * @param {number} showId
 * @returns {Promise<Array<object>>}
 */
export function getShowEntriesWithHorseStats(showId) {
  return prisma.showEntry.findMany({
    where: { showId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      horse: {
        select: {
          id: true,
          name: true,
          epigeneticModifiers: true,
          breed: { select: { name: true } },
          user: { select: { id: true, username: true } },
          precision: true,
          strength: true,
          speed: true,
          agility: true,
          endurance: true,
          intelligence: true,
          stamina: true,
          balance: true,
          boldness: true,
          flexibility: true,
          obedience: true,
          focus: true,
        },
      },
    },
  });
}

/**
 * Fetch the entry-validation row for the enter-show endpoint: returns
 * status / closeDate / entryFee / createdByUserId for window checks +
 * debit/credit accounting.
 *
 * @param {number} showId
 * @returns {Promise<object|null>}
 */
export function getShowForEntry(showId) {
  return prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      status: true,
      closeDate: true,
      entryFee: true,
      createdByUserId: true,
    },
  });
}

/**
 * Check whether a horse already has a ShowEntry row for a given show.
 *
 * @param {number} showId
 * @param {number} horseId
 * @returns {Promise<boolean>}
 */
export async function hasExistingShowEntry(showId, horseId) {
  const row = await prisma.showEntry.findFirst({
    where: { showId, horseId },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Atomic deferred-entry transaction (Equoria-nx8t1 R7):
 *   - Debit entrant the show fee (if any), guarded by a conditional
 *     updateMany money>=fee → throws Error('INSUFFICIENT_FUNDS').
 *   - Credit the show creator the same amount (unless self-entry or no
 *     creator on legacy/system shows).
 *   - Create the canonical ShowEntry row.
 *   - Record a debit ledger transaction with the post-debit balance.
 *
 * Caller maps:
 *   error.message === 'INSUFFICIENT_FUNDS' → HTTP 402
 *   error.code    === 'P2002'              → HTTP 409 (already entered)
 *
 * @param {{ show: object, showId: number, horseId: number, userId: number }} params
 * @returns {Promise<object>} the created ShowEntry row
 */
export function enterShowDeferredTx({ show, showId, horseId, userId }) {
  return prisma.$transaction(
    async tx => {
      if (show.entryFee > 0) {
        const debited = await tx.user.updateMany({
          where: { id: userId, money: { gte: show.entryFee } },
          data: { money: { decrement: show.entryFee } },
        });
        if (debited.count === 0) {
          throw new Error('INSUFFICIENT_FUNDS');
        }
        if (show.createdByUserId && show.createdByUserId !== userId) {
          await tx.user.update({
            where: { id: show.createdByUserId },
            data: { money: { increment: show.entryFee } },
          });
        }
      }

      const createdEntry = await tx.showEntry.create({
        data: { showId, horseId, userId, feePaid: show.entryFee },
      });

      if (show.entryFee > 0) {
        const refreshed = await tx.user.findUnique({
          where: { id: userId },
          select: { money: true },
        });
        await recordTransaction(
          {
            userId,
            type: 'debit',
            amount: show.entryFee,
            category: 'competition_entry',
            description: `Entry fee for show ${showId}`,
            balanceAfter: refreshed?.money ?? 0,
            metadata: {
              horseId,
              showId,
              entryId: createdEntry.id,
            },
          },
          tx,
        );
      }

      return createdEntry;
    },
    { timeout: 30000 },
  );
}

/**
 * Fetch a competition result row with the joined horse id/name/userId,
 * used by the prize-claim endpoint to verify ownership.
 *
 * @param {number} competitionId
 * @returns {Promise<object|null>}
 */
export function getCompetitionResultWithHorseOwner(competitionId) {
  return prisma.competitionResult.findUnique({
    where: { id: competitionId },
    include: {
      horse: {
        select: { id: true, name: true, userId: true },
      },
    },
  });
}
