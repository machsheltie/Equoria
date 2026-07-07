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
import {
  recordTransaction,
  creditSystemAccount,
  SYSTEM_ACCOUNT_SHOW_ESCROW,
} from '../../economy/index.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { isHorseWithinLevelBracket } from '../../../utils/horseCompetitionLevel.mjs';

export async function listShowsPaginated({ where, skip, take }) {
  const [shows, total] = await Promise.all([
    prisma.show.findMany({ where, orderBy: { runDate: 'asc' }, skip, take }),
    prisma.show.count({ where }),
  ]);
  return { shows, total };
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

export function getShowForEntry(showId) {
  return prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
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
 * Atomic deferred-entry transaction (Equoria-nx8t1 R7 + Equoria-jnk6r escrow).
 *
 * Equoria-jnk6r (sibling of si69u): routes the entry fee through
 * SystemAccount[show_escrow] + per-show feeEscrow column instead of crediting
 * the creator's wallet directly. The /api/competition/enter route (used by
 * the live frontend competitionsApi.enter) shared the pre-si69u bypass:
 * GDPR-deleting the creator mid-show silently destroyed fee money with no
 * audit row, and the show executor (which expects feeEscrow > 0 to pay
 * creator OR burn) had nothing to settle. The post-fix path is byte-identical
 * to showController.enterShow.
 */
export function enterShowDeferredTx({ show, showId, horseId, userId, horseLevel }) {
  return withRetryableTxMapping(
    prisma.$transaction(
      async tx => {
        // Equoria-g8qg0: enforce the show's advertised level bracket (levelMin
        // <= horseLevel <= levelMax; horseLevel = floor(horseXp/100)+1 per the
        // pinned mapping). Checked FIRST — before any money moves — so an
        // out-of-bracket attempt leaves the wallet untouched and creates no
        // ShowEntry. INSIDE the tx alongside the 8pb6w status predicate below,
        // byte-identical to showController.enterShowAtomicTx.
        if (!isHorseWithinLevelBracket(horseLevel, show.levelMin, show.levelMax)) {
          throw new Error('OUT_OF_BRACKET');
        }
        if (show.entryFee > 0) {
          const debited = await tx.user.updateMany({
            where: { id: userId, money: { gte: show.entryFee } },
            data: { money: { decrement: show.entryFee } },
          });
          if (debited.count === 0) {
            throw new Error('INSUFFICIENT_FUNDS');
          }
          // Equoria-jnk6r: route the entry fee to SystemAccount[show_escrow]
          // instead of directly to the creator's wallet. At show execute time
          // the accumulated feeEscrow is paid out to the creator IF they still
          // exist; otherwise it's burned via SystemAccount[burn] (handled by
          // showController.executeClosedShows). Self-entry is still recorded
          // into escrow — the escrow is a different counterparty, so the
          // self-entry really is a transfer worth recording.
          await creditSystemAccount(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, show.entryFee, {
            category: 'show_entry_fee_escrow',
            description: `Entry fee for show ${showId}`,
            linkedUserId: userId,
            metadata: { showId, horseId },
          });
        }

        // Equoria-8pb6w: atomic entry-window guard (byte-identical to
        // showController.enterShowAtomicTx). A status-scoped conditional
        // updateMany (increment == entryFee, 0 for a free show) BOTH applies the
        // feeEscrow increment AND re-checks status='open' INSIDE the tx, taking a
        // row lock. count===0 => the executor already claimed the show
        // ('open' -> 'executing') between the pre-tx guard and now => throw
        // ENTRY_CLOSED to roll back the fee debit + escrow credit + entry
        // (surfaced as HTTP 409 by the route). Free shows carry no natural
        // increment, so increment:0 still performs the status-scoped lock+recheck.
        const stillOpen = await tx.show.updateMany({
          where: { id: showId, status: 'open' },
          data: { feeEscrow: { increment: show.entryFee } },
        });
        if (stillOpen.count === 0) {
          throw new Error('ENTRY_CLOSED');
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
              metadata: { horseId, showId, entryId: createdEntry.id },
            },
            tx,
          );
        }

        return createdEntry;
      },
      { timeout: 30000 },
    ),
    { message: 'Show entry service is busy right now, please retry in a moment.' },
  );
}
