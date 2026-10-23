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
import { findKeysetPage } from '../../../utils/paginationHelper.mjs';

/**
 * One page of shows, soonest first, on the keyset convention (Equoria-cmw85.19):
 * ties on runDate are broken by id, so shows that run at the same moment keep
 * their places between requests. A `cursor` continues after the previous page's
 * last show; without one, `skip` is the legacy offset. `total` stays as it was,
 * for the numbered-page client. Each show is mapped to the fields the Arena cards
 * read, with its real entry count (Equoria-fyoca).
 *
 * @throws {InvalidCursorError} on a cursor that cannot be decoded
 */
export async function listShowsPaginated({ where, skip, limit, cursor }) {
  const [{ items: shows, pageInfo }, total] = await Promise.all([
    findKeysetPage(args => prisma.show.findMany(args), {
      where,
      sort: [
        { key: 'runDate', dir: 'asc', type: 'date' },
        { key: 'id', dir: 'asc', type: 'int' },
      ],
      limit,
      skip,
      cursor,
      extra: { include: { _count: { select: { entries: true } } } },
    }),
    prisma.show.count({ where }),
  ]);
  return { shows: shows.map(toShowListItem), total, pageInfo };
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
