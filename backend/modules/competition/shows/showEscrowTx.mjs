/**
 * Show money-movement transactions (extracted from showController for
 * testability + file-size discipline — Equoria-8pb6w).
 *
 * Houses the two escrow-touching transactions whose tx-internal invariants the
 * Equoria-8pb6w sentinels exercise deterministically:
 *   - enterShowAtomicTx     — the canonical POST /shows/:id/enter entry tx.
 *   - settleShowFeeEscrow   — the executeClosedShows fee-settlement tx.
 * plus refundUnpaidPrizeShareInTx, the unpaid-prize-share refund that runs
 * inside the executor's first-place payout tx (Equoria-w7fnz).
 *
 * Both are pulled out of showController so a test can call them directly
 * (enterShowAtomicTx with a stale `show` snapshot; settleShowFeeEscrow with an
 * injectable Prisma client) rather than racing an HTTP call against the cron.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { checkEntryEligibility } from '../services/entryEligibility.mjs';
import {
  systemAccountShowEscrow,
  systemAccountBurn,
  creditSystemAccount,
  debitSystemAccountOrThrow,
  recordTransaction,
} from '../../economy/index.mjs';

/**
 * The Show row filter that is true only while a show takes entries: still
 * `open`, past its openDate and before its closeDate (Equoria-mwjst). A null
 * date leaves that side unbounded, exactly as the callers' pre-transaction
 * checks have always read it. It is the WHERE of the status-scoped feeEscrow
 * increment in BOTH entry transactions (this file's enterShowAtomicTx and
 * services/competitionRouteQueries.enterShowDeferredTx), so the entry window is
 * enforced atomically with the debit and the entry, not only by an earlier read.
 *
 * @param {number} showId
 * @param {Date} [now]
 */
export function openForEntriesWhere(showId, now = new Date()) {
  return {
    id: showId,
    status: 'open',
    AND: [
      { OR: [{ openDate: null }, { openDate: { lte: now } }] },
      { OR: [{ closeDate: null }, { closeDate: { gt: now } }] },
    ],
  };
}

/**
 * The ONE show-entry transaction (Equoria-mwjst: both entry routes — POST
 * /api/v1/shows/:id/enter via enterShowAtomicTx, POST /api/v1/competition/enter
 * and the conformation entry via competitionRouteQueries.enterShowDeferredTx —
 * run this body, so a fix can never land on one path only). Debits the entrant
 * the entryFee, credits SystemAccount[showEscrow], increments the per-show
 * feeEscrow, creates the ShowEntry and writes the entrant's debit ledger row
 * with the balance after it — all in one transaction, so a fee can never be
 * debited without the escrow credit, the entry row and its ledger record.
 *
 * Takes the pre-read `show` snapshot as a parameter; the DB status is
 * re-asserted INSIDE the tx (see the Equoria-8pb6w guard) so a stale snapshot
 * cannot let an entry land on a show the executor has already claimed.
 *
 * `prepareEntry(tx)`, when given, runs after the shared entry rules and before
 * any money moves, and returns extra ShowEntry fields; the conformation entry
 * passes its in-transaction rules here and gets back the presenting groom.
 *
 * Throws an EntryRefusalError (the shared entry rules, Equoria-576c0 B9, or
 * prepareEntry's), `insufficientFunds` or `entryClosed` (mapped to HTTP by
 * the caller).
 *
 * @param {object} input
 * @param {object} input.show
 * @param {number} input.showId
 * @param {number} input.horseId
 * @param {string} input.userId
 * @param {(tx: object) => Promise<{ groomId?: number, groomSnapshot?: object }>} [input.prepareEntry]
 * @param {string} [busyMessage] - the 503 message when the transaction cannot get through
 */
export function enterShowTx(
  { show, showId, horseId, userId, prepareEntry = null },
  busyMessage = 'Show entry service is busy right now, please retry in a moment.',
) {
  return withRetryableTxMapping(
    prisma.$transaction(
      async tx => {
        // Equoria-576c0 B9: the shared entry rules, FIRST — before any money
        // moves — so a refusal leaves the wallet untouched and creates no
        // ShowEntry; INSIDE the tx so the reads are atomic with the entry.
        await checkEntryEligibility(tx, { show, showId, horseId, userId });
        // Lock order (Equoria-qc7cx): the show row BEFORE the presenting groom
        // prepareEntry locks, as the conformation settlement claims the show
        // and then locks the grooms presenting in it. Taken after the groom, an
        // entry at the close with a groom already presenting in this show held
        // the groom while it waited for the claimed show, and the settlement
        // waited for the groom: a deadlock. This only takes the lock (the mode
        // the status-scoped update below takes); that update still decides
        // whether the show takes entries, so the refusals keep their order.
        // Its window is judged on the clock read here, before the entry can
        // queue on the show: an entry queued before the close and let through
        // while the show is still open is in, as when it queued on that update
        // (Equoria-fzmiy).
        const enteredAt = new Date();
        await tx.$queryRaw`SELECT "id" FROM "shows" WHERE "id" = ${showId} FOR NO KEY UPDATE`;
        const extra = prepareEntry ? await prepareEntry(tx) : {};
        if (show.entryFee > 0) {
          const debited = await tx.user.updateMany({
            where: { id: userId, money: { gte: show.entryFee } },
            data: { money: { decrement: show.entryFee } },
          });
          if (debited.count === 0) {
            throw new Error('insufficientFunds');
          }
        }
        // Equoria-8pb6w: atomic entry-window guard. A status-scoped conditional
        // updateMany (increment == entryFee, which is 0 for a free show) BOTH
        // applies the feeEscrow increment AND re-checks status='open' INSIDE the
        // tx, taking a row lock. count===0 => the executor already claimed the
        // show ('open' -> 'executing') between the pre-tx guard and now => throw
        // entryClosed to roll back the fee debit + entry (surfaced as HTTP 409).
        // Free shows (entryFee 0) carry no natural increment, so the increment:0
        // no-op still performs the status-scoped lock + recheck — without it a
        // free entry would silently bypass the guard.
        // Equoria-mwjst: the same predicate re-checks the open/close window.
        //
        // Lock order (Equoria-ifnhc): the show row (locked above) BEFORE the
        // escrow account, as every settlement takes them (its show claim or show
        // row, then the escrow account). Taken after it, an entry landing at the
        // close held the escrow account while it waited for the show the
        // settlement had claimed, and the settlement waited for the escrow
        // account: deadlock.
        const stillOpen = await tx.show.updateMany({
          where: openForEntriesWhere(showId, enteredAt),
          data: { feeEscrow: { increment: show.entryFee } },
        });
        if (stillOpen.count === 0) {
          throw new Error('entryClosed');
        }
        if (show.entryFee > 0) {
          // Equoria-si69u: route the entry fee to SystemAccount[showEscrow]
          // instead of directly to the creator's wallet. At show execute time
          // the accumulated feeEscrow is paid out to the creator IF they
          // still exist; otherwise it's burned via SystemAccount[burn]. This
          // makes account deletion mid-show economically safe — money is
          // never silently lost to a null counterparty.
          //
          // Self-entry (entrant === creator) is still recorded into escrow.
          // Pre-si69u we skipped the round-trip because the same wallet
          // owned both sides of the move; post-si69u the escrow is a
          // DIFFERENT counterparty (SystemAccount), so the self-entry
          // really is a transfer worth recording — the creator paid their
          // own fee into escrow and will get it back at execute time IF
          // they're still around.
          await creditSystemAccount(tx, systemAccountShowEscrow, show.entryFee, {
            category: 'showEntryFeeEscrow',
            description: `Entry fee for show ${showId}`,
            linkedUserId: userId,
            metadata: { showId, horseId },
          });
        }

        // groomId/groomSnapshot: the conformation entry's presenting groom and its
        // scoring fields as entered (absent for ridden; a Json column takes no
        // plain null, so the snapshot is omitted rather than passed as null).
        const entry = await tx.showEntry.create({
          data: {
            showId,
            horseId,
            userId,
            feePaid: show.entryFee,
            groomId: extra.groomId ?? null,
            ...(extra.groomSnapshot ? { groomSnapshot: extra.groomSnapshot } : {}),
          },
        });

        // The entrant's own record of the fee, with the balance it left
        // (Equoria-mwjst: both routes write it; before, only one did).
        if (show.entryFee > 0) {
          const after = await tx.user.findUnique({
            where: { id: userId },
            select: { money: true },
          });
          await recordTransaction(
            {
              userId,
              type: 'debit',
              amount: show.entryFee,
              category: 'competitionEntry',
              description: `Entry fee for show ${showId}`,
              balanceAfter: after.money,
              metadata: { horseId, showId, entryId: entry.id },
            },
            tx,
          );
        }
        return entry;
      },
      { timeout: 30000 },
    ),
    { message: busyMessage },
  );
}

/**
 * POST /api/v1/shows/:id/enter's name for the one entry transaction (kept so
 * the Equoria-8pb6w sentinels and the show controller call it unchanged).
 */
export function enterShowAtomicTx({ show, showId, horseId, userId }) {
  return enterShowTx(
    { show, showId, horseId, userId },
    'Show service is busy right now, please retry in a moment.',
  );
}

/**
 * Settle a completed show's accumulated entry-fee escrow (extracted from
 * executeClosedShows for testability — Equoria-8pb6w). If the creator still
 * exists, the accumulated fees move from SystemAccount[showEscrow] into their
 * User.money; if the creator was GDPR-deleted, they move into
 * SystemAccount[burn]. Either path keeps money conservation constant.
 *
 * Exactly once (Equoria-mwjst.1, Codex #1): recovery does not claim the show,
 * so an admin run and the nightly run can settle the same show at once. The
 * read before the transaction is only a fast path; inside the transaction the
 * show row is locked and feeEscrow re-read, and only what is still there is
 * settled, by a decrement that cannot take the column below zero. A second
 * settlement queues on the lock, then finds nothing left: a no-op, not an
 * error. It never settles more than the fast path read, so an increment that
 * raced in after that read stays in the column for a later pass
 * (Equoria-8pb6w). The `client` param defaults to the shared prisma singleton
 * and is injectable so a test can interpose a concurrent increment.
 *
 * Lock order: the creator's User row, then the show row, then the escrow
 * account, as the entry takes the entrant's User row, then the show, then the
 * escrow account (Equoria-ifnhc).
 */
export async function settleShowFeeEscrow(showId, client = prisma) {
  const read = await readUnsettledFeeEscrow(client, showId);
  if (!read) {
    return;
  }
  await client.$transaction(async tx => {
    await lockUserRowTx(tx, read.createdByUserId);
    await settleLockedFeeEscrow(tx, showId, read.feeEscrow);
  });
}

/**
 * The same fee-escrow settlement, run inside the CALLER's transaction
 * (Equoria-mwjst). The conformation settlement pays the escrow in the same
 * transaction as its claim and rewards, so a failure anywhere in it leaves the
 * escrow unsettled and the show open — never paid-but-unscored. Settles
 * whatever the locked show row holds (Equoria-mwjst.1).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {number} showId
 */
export async function settleShowFeeEscrowInTx(tx, showId) {
  await settleLockedFeeEscrow(tx, showId, Number.POSITIVE_INFINITY);
}

/**
 * Lock a player's User row for the rest of the transaction, as an UPDATE of it
 * would (FOR NO KEY UPDATE: rows that only reference the player are not held
 * up). A settlement takes it BEFORE its show, horse and groom rows, so it runs
 * in the entry's order, User first (Equoria-mwjst.1, Codex #2). No-op for a
 * null id (an erased creator, or a seeded show).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string|null|undefined} userId
 */
export async function lockUserRowTx(tx, userId) {
  if (userId) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
  }
}

/**
 * Lock several players' User rows, in ascending id order, so two settlements
 * that pay the same players never take them crosswise (Equoria-ifnhc). The
 * ridden placement payout and the owner's Run Show both lock through this, each
 * before its show row and horses (Run Show only since Equoria-mwjst.2: it used
 * to claim the show first and lock the players FOR UPDATE, which deadlocked with
 * a conformation settlement holding one of their horses). Null ids and repeats
 * are skipped.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {Array<string|null|undefined>} userIds
 */
export async function lockUserRowsTx(tx, userIds) {
  for (const userId of [...new Set(userIds.filter(Boolean))].sort()) {
    await lockUserRowTx(tx, userId);
  }
}

/**
 * Refund a show's unpaid prize share to its creator (Equoria-w7fnz; owner ruling
 * 2026-10-19: with fewer than 3 entrants the unpaid share goes back to the
 * creator). Runs inside the caller's payout transaction: decrements the show's
 * prizeEscrow, debits SystemAccount[showEscrow] and credits the creator by
 * `amount`, all with `tx`.
 *
 * The decrement is guarded (Equoria-mwjst.1, as Equoria-law5w guards a prize):
 * it takes the whole amount only while the live prizeEscrow still holds it, so
 * two settlements that both decide to refund pay it once and the escrow never
 * goes below zero. One that finds it gone moves nothing.
 *
 * No creator (a GDPR-erased creator, or a seeded show) is unruled: the amount is
 * left where it is.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ showId: number, creatorId: string|null, amount: number }} refund
 */
export async function refundUnpaidPrizeShareInTx(tx, { showId, creatorId, amount }) {
  if (!creatorId || amount <= 0) {
    return;
  }
  const taken = await tx.show.updateMany({
    where: { id: showId, prizeEscrow: { gte: amount } },
    data: { prizeEscrow: { decrement: amount } },
  });
  if (taken.count !== 1) {
    logger.warn(
      `[showEscrowTx] Show ${showId}: escrow no longer holds the ${amount}-coin unpaid prize share; nothing refunded`,
    );
    return;
  }
  await debitSystemAccountOrThrow(tx, systemAccountShowEscrow, amount, {
    category: 'showRefundUnpaidPrize',
    description: `Unpaid prize share refund for show ${showId}`,
    linkedUserId: creatorId,
    metadata: { showId },
  });
  await creditCreatorInTx(tx, {
    userId: creatorId,
    amount,
    category: 'showUnpaidPrizeRefund',
    description: `Unpaid prize share returned for show ${showId}`,
    metadata: { showId },
  });
}

/**
 * Credit a show creator's wallet and write their own credit ledger row with the
 * balance the credit produced, on the caller's transaction (Equoria-mwjst).
 * The escrow-side row written by debitSystemAccountOrThrow records the system
 * account's side of the move; this one is the player's.
 */
async function creditCreatorInTx(tx, { userId, amount, category, description, metadata }) {
  const credited = await tx.user.update({
    where: { id: userId },
    data: { money: { increment: amount } },
    select: { money: true },
  });
  await recordTransaction(
    {
      userId,
      type: 'credit',
      amount,
      category,
      description,
      balanceAfter: credited.money,
      metadata,
    },
    tx,
  );
}

/** The show's fee escrow and creator as last committed, or null when there is nothing to settle. */
async function readUnsettledFeeEscrow(client, showId) {
  const settled = await client.show.findUnique({
    where: { id: showId },
    select: { feeEscrow: true, createdByUserId: true },
  });
  if (!settled || settled.feeEscrow <= 0) {
    return null;
  }
  return settled;
}

/**
 * Lock the show row, re-read its feeEscrow and creator, and settle what it
 * still holds, up to `limit` (Equoria-mwjst.1). The decrement is guarded as
 * well as locked, so the column can never go below zero. Every write uses `tx`.
 */
async function settleLockedFeeEscrow(tx, showId, limit) {
  const rows = await tx.$queryRaw`
    SELECT "feeEscrow", "createdByUserId" FROM "shows" WHERE "id" = ${showId} FOR NO KEY UPDATE`;
  if (rows.length !== 1) {
    return;
  }
  const amount = Math.min(Number(rows[0].feeEscrow), limit);
  if (!(amount > 0)) {
    return; // a settlement that held the lock first already paid it
  }
  const taken = await tx.show.updateMany({
    where: { id: showId, feeEscrow: { gte: amount } },
    data: { feeEscrow: { decrement: amount } },
  });
  if (taken.count !== 1) {
    return;
  }
  await moveFeeEscrow(tx, showId, { feeEscrow: amount, createdByUserId: rows[0].createdByUserId });
}

/**
 * Move `settled.feeEscrow`, already taken off the show's feeEscrow, out of
 * SystemAccount[showEscrow] to the creator (or to SystemAccount[burn] when the
 * creator was GDPR-deleted). Every write uses `tx`.
 */
async function moveFeeEscrow(tx, showId, settled) {
  // Always debit the escrow account by the full settled amount.
  await debitSystemAccountOrThrow(tx, systemAccountShowEscrow, settled.feeEscrow, {
    category: settled.createdByUserId ? 'showSettleFeesToCreator' : 'showSettleFeesToBurn',
    description: `Fee settlement for show ${showId}`,
    linkedUserId: settled.createdByUserId ?? null,
    metadata: { showId, creatorPresent: !!settled.createdByUserId },
  });
  if (settled.createdByUserId) {
    // Creator still exists → pay them the accumulated fees.
    await creditCreatorInTx(tx, {
      userId: settled.createdByUserId,
      amount: settled.feeEscrow,
      category: 'showEntryFeesReceived',
      description: `Entry fees received for show ${showId}`,
      metadata: { showId },
    });
  } else {
    // Creator GDPR-deleted → move the escrow into the burn account.
    // System-to-system move; no linkedUserId so no ledger row, but
    // the SystemAccount.balance mutations themselves form the audit
    // pair (escrow.balance -= X, burn.balance += X).
    await creditSystemAccount(tx, systemAccountBurn, settled.feeEscrow, {
      category: 'showBurnOrphanedFees',
      description: `Burn orphaned fees for show ${showId} (creator GDPR-deleted)`,
    });
  }
}
