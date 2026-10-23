/**
 * Competition route data-access helpers
 *
 * Wraps the prisma calls used by competitionRoutes.mjs so the routes layer
 * no longer imports prisma directly (Equoria-becrm).
 *
 * `enterShowDeferredTx` is this route's name for the one show-entry
 * transaction, shows/showEscrowTx.enterShowTx (consolidated in Equoria-mwjst).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { enterShowTx } from '../shows/showEscrowTx.mjs';
import { toShowListItem } from './showListView.mjs';

export async function listShowsPaginated({ where, skip, take }) {
  const [shows, total] = await Promise.all([
    prisma.show.findMany({
      where,
      orderBy: [{ runDate: 'asc' }, { id: 'asc' }],
      skip,
      take,
      include: { _count: { select: { entries: true } } },
    }),
    prisma.show.count({ where }),
  ]);
  return { shows: shows.map(toShowListItem), total };
}

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

// A conformation entry needs a groom (validated only by the conformation entry
// route); a groomless entry would fail settlement for the whole show.
export const CONFORMATION_ENTRY_ONLY_MESSAGE =
  'Conformation shows take entries through the conformation entry, where a groom presents the horse.';

export function getShowForEntry(showId) {
  return prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      showType: true,
      // Equoria-576c0 B9: C12 (Gaited shows need gaiting).
      discipline: true,
      status: true,
      closeDate: true,
      entryFee: true,
      createdByUserId: true,
      // Equoria-g8qg0: the advertised level bracket, enforced at entry.
      levelMin: true,
      levelMax: true,
    },
  });
}

export async function hasExistingShowEntry(showId, horseId) {
  const row = await prisma.showEntry.findFirst({
    where: { showId, horseId },
    select: { id: true },
  });
  return row !== null;
}

/**
 * POST /api/v1/competition/enter's (and the conformation entry's) name for the
 * one show-entry transaction, showEscrowTx.enterShowTx (Equoria-mwjst: both
 * entry routes run the same body, so wallet debit, escrow credit, feeEscrow,
 * feePaid, the ShowEntry and both ledger rows are identical on either path).
 *
 * `prepareEntry(tx)` is the conformation entry's in-transaction rules; it
 * returns the presenting groom (Equoria-mwjst).
 */
export function enterShowDeferredTx({ show, showId, horseId, userId, prepareEntry = null }) {
  return enterShowTx({ show, showId, horseId, userId, prepareEntry });
}
