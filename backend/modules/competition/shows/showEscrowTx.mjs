/**
 * Show money-movement transactions (extracted from showController for
 * testability + file-size discipline — Equoria-8pb6w).
 *
 * Houses the two escrow-touching transactions whose tx-internal invariants the
 * Equoria-8pb6w sentinels exercise deterministically:
 *   - enterShowAtomicTx     — the canonical POST /shows/:id/enter entry tx.
 *   - settleShowFeeEscrow   — the executeClosedShows fee-settlement tx.
 *
 * Both are pulled out of showController so a test can call them directly
 * (enterShowAtomicTx with a stale `show` snapshot; settleShowFeeEscrow with an
 * injectable Prisma client) rather than racing an HTTP call against the cron.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { isHorseWithinLevelBracket } from '../../../utils/horseCompetitionLevel.mjs';
import {
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  SYSTEM_ACCOUNT_BURN,
  creditSystemAccount,
  debitSystemAccountOrThrow,
} from '../../economy/index.mjs';

/**
 * Atomic show-entry transaction (extracted from enterShow for testability —
 * Equoria-8pb6w). Debits the entrant the entryFee, credits
 * SystemAccount[show_escrow], increments the per-show feeEscrow, and creates
 * the ShowEntry — all in one transaction so a fee can never be debited without
 * (a) the escrow being credited and (b) the entry row existing.
 *
 * Takes the pre-read `show` snapshot as a parameter; the DB status is
 * re-asserted INSIDE the tx (see the Equoria-8pb6w guard) so a stale snapshot
 * cannot let an entry land on a show the executor has already claimed. Throws
 * `OUT_OF_BRACKET`, `INSUFFICIENT_FUNDS`, or `ENTRY_CLOSED` (mapped to HTTP
 * 400 / 402 / 409 by the caller).
 *
 * `horseLevel` (the entrant's XP-bracket level, floor(horseXp/100)+1 per the
 * Equoria-g8qg0 pinned mapping) is computed by the caller and passed in;
 * `show.levelMin`/`show.levelMax` come from the caller's show snapshot.
 */
export function enterShowAtomicTx({ show, showId, horseId, userId, horseLevel }) {
  return withRetryableTxMapping(
    prisma.$transaction(async tx => {
      // Equoria-g8qg0: enforce the show's advertised level bracket. A horse may
      // only enter the bracket matching its level (levelMin <= horseLevel <=
      // levelMax). Checked FIRST — before any money moves — so an out-of-bracket
      // attempt leaves the wallet untouched and creates no ShowEntry (the tx
      // never gets to the debit/escrow/entry writes). Kept INSIDE the tx,
      // alongside the Equoria-8pb6w status predicate below, so the eligibility
      // gate is atomic with the entry rather than a detachable pre-check.
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
        // Equoria-si69u: route the entry fee to SystemAccount[show_escrow]
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
        await creditSystemAccount(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, show.entryFee, {
          category: 'show_entry_fee_escrow',
          description: `Entry fee for show ${showId}`,
          linkedUserId: userId,
          metadata: { showId, horseId },
        });
      }
      // Equoria-8pb6w: atomic entry-window guard. A status-scoped conditional
      // updateMany (increment == entryFee, which is 0 for a free show) BOTH
      // applies the feeEscrow increment AND re-checks status='open' INSIDE the
      // tx, taking a row lock. count===0 => the executor already claimed the
      // show ('open' -> 'executing') between the pre-tx guard and now => throw
      // ENTRY_CLOSED to roll back the fee debit + escrow credit + entry
      // (surfaced as HTTP 409). Free shows (entryFee 0) carry no natural
      // increment, so the increment:0 no-op still performs the status-scoped
      // lock + recheck — without it a free entry would silently bypass the guard.
      const stillOpen = await tx.show.updateMany({
        where: { id: showId, status: 'open' },
        data: { feeEscrow: { increment: show.entryFee } },
      });
      if (stillOpen.count === 0) {
        throw new Error('ENTRY_CLOSED');
      }
      return tx.showEntry.create({
        data: { showId, horseId, userId, feePaid: show.entryFee },
      });
    }),
    { message: 'Show service is busy right now, please retry in a moment.' },
  );
}

/**
 * Settle a completed show's accumulated entry-fee escrow (extracted from
 * executeClosedShows for testability — Equoria-8pb6w). If the creator still
 * exists, the accumulated fees move from SystemAccount[show_escrow] into their
 * User.money; if the creator was GDPR-deleted, they move into
 * SystemAccount[burn]. Either path keeps money conservation constant.
 *
 * The feeEscrow read and the settlement write are separate DB round-trips; the
 * write must use a RELATIVE decrement (not an absolute reset) so an increment
 * that raced in between read and write is preserved rather than erased. The
 * `client` param defaults to the shared prisma singleton and is injectable so a
 * test can interpose a concurrent increment between the two.
 */
export async function settleShowFeeEscrow(showId, client = prisma) {
  const settled = await client.show.findUnique({
    where: { id: showId },
    select: { feeEscrow: true, createdByUserId: true },
  });
  if (!settled || settled.feeEscrow <= 0) {
    return;
  }
  await client.$transaction(async tx => {
    // Always debit the escrow account by the full feeEscrow amount.
    await debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, settled.feeEscrow, {
      category: settled.createdByUserId
        ? 'show_settle_fees_to_creator'
        : 'show_settle_fees_to_burn',
      description: `Fee settlement for show ${showId}`,
      linkedUserId: settled.createdByUserId ?? null,
      metadata: { showId, creatorPresent: !!settled.createdByUserId },
    });
    if (settled.createdByUserId) {
      // Creator still exists → pay them the accumulated fees.
      await tx.user.update({
        where: { id: settled.createdByUserId },
        data: { money: { increment: settled.feeEscrow } },
      });
    } else {
      // Creator GDPR-deleted → move the escrow into the burn account.
      // System-to-system move; no linkedUserId so no ledger row, but
      // the SystemAccount.balance mutations themselves form the audit
      // pair (escrow.balance -= X, burn.balance += X).
      await creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, settled.feeEscrow, {
        category: 'show_burn_orphaned_fees',
        description: `Burn orphaned fees for show ${showId} (creator GDPR-deleted)`,
      });
    }
    // Equoria-8pb6w: decrement by the amount we READ + settled, NOT an absolute
    // reset to 0. The read (above) and this write are separate round-trips; an
    // absolute `feeEscrow: 0` would erase any increment that raced in between,
    // breaking the SystemAccount[show_escrow] == SUM(prizeEscrow + feeEscrow)
    // reconciliation invariant. A relative decrement leaves the raced residual
    // in the column for a later settlement pass.
    await tx.show.update({
      where: { id: showId },
      data: { feeEscrow: { decrement: settled.feeEscrow } },
    });
  });
}
