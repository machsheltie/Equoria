/**
 * Collect groom weekly fees inside a caller's transaction (Equoria-hc96y).
 *
 * Moved verbatim out of `processWeeklySalaries` so the owner's manual payday
 * (q262) and the player's Pay Groom button (owner ruling 2026-10-28; q268) take
 * money by ONE definition: the per-(user, pay week) advisory lock first, the
 * paid-this-week idempotency read, this week first and then any owed weeks
 * (Equoria-bgdfb), the paid rows, and the grace marker cleared.
 *
 * Throws `InsufficientFundsError` when this week's fee itself cannot be paid.
 * `state.unpaid` is set to the entries still unpaid for the week (read under the
 * lock), so a caller can name them after the transaction aborts.
 */

import logger from '../../../utils/logger.mjs';
import {
  debitMoneyOrThrow,
  InsufficientFundsError,
  systemAccountBurn,
} from '../../economy/index.mjs';
import { acquirePayWeekLockTx, ensureEngagementsTx } from './groomEngagementService.mjs';
import { arrearsOwedStatuses, arrearsSettledStatus } from './groomFeeBasisService.mjs';

/**
 * @param {Object} tx - Prisma transaction client
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.username - for the ledger description and logs
 * @param {Array<{groom: Object, salary: number}>} params.entries - grooms to pay
 * @param {Date} params.payWeekStart
 * @param {Date} params.payWeekEnd
 * @param {string} params.weekKey
 * @param {Date} params.now - the paid rows' paymentDate
 * @param {string} params.description - the ledger line
 * @param {{unpaid?: Array}} [params.state]
 * @returns {Promise<{skipped: boolean, amount: number, arrears?: number}>}
 */
export async function collectGroomFeesTx(tx, params) {
  const {
    userId,
    username,
    entries,
    payWeekStart,
    payWeekEnd,
    weekKey,
    now,
    description,
    state = {},
  } = params;
  let arrearsTotal;

  // Equoria-icqqm: serialize concurrent runs per (user, payWeek).
  // MUST be the first statement — the idempotency read below is
  // only race-safe while this xact-scoped lock is held.
  // Equoria-ypb7d.3 fix round 1 (F2): the key is now built in ONE
  // place, `acquirePayWeekLockTx`, because the arrears handler has to
  // take the SAME lock and a restated key string would drift.
  await acquirePayWeekLockTx(tx, userId, payWeekStart);

  // Idempotency predicate: which grooms already have a committed
  // 'paid' weekly-salary row inside this pay week? Per-groom
  // granularity heals partial-run recovery: a re-run pays ONLY
  // the grooms the crashed run never reached.
  const paidRows = await tx.groomSalaryPayment.findMany({
    where: {
      userId,
      paymentType: 'weeklySalary',
      status: 'paid',
      paymentDate: { gte: payWeekStart, lt: payWeekEnd },
    },
    select: { groomId: true },
  });
  const paidGroomIds = new Set(paidRows.map(row => row.groomId));

  const unpaidAssignments = entries.filter(({ groom }) => !paidGroomIds.has(groom.id));
  state.unpaid = unpaidAssignments;
  if (unpaidAssignments.length === 0) {
    // Everything already paid for this pay week — a re-run must
    // be a no-op, not a second debit.
    return { skipped: true, amount: 0 };
  }
  const unpaidTotal = unpaidAssignments.reduce((sum, entry) => sum + entry.salary, 0);

  // Equoria-bgdfb: what these grooms still OWE from earlier pay weeks.
  // `paymentDate` on a missed row is that week's start (see
  // groomFeeArrearsService), so `lt: payWeekStart` is an exact "an
  // EARLIER week" test and can never pick up a failure from THIS week —
  // which would charge the same week twice.
  const owedRows = await tx.groomSalaryPayment.findMany({
    where: {
      userId,
      paymentType: 'weeklySalary',
      status: { in: [...arrearsOwedStatuses] },
      groomId: { in: unpaidAssignments.map(entry => entry.groom.id) },
      paymentDate: { lt: payWeekStart },
    },
    select: { id: true, amount: true },
  });
  arrearsTotal = owedRows.reduce((sum, row) => sum + row.amount, 0);

  // Equoria-kl16c: the SystemAccount.burn credit is now PAIRED
  // INTERNALLY by debitMoneyOrThrow (systemAccount/category
  // required). supplying linkedUserId via the helper attributes a
  // paired ledger row to the user (so their transaction history
  // reflects the move) while the SystemAccount.balance is mutated
  // authoritatively in the same tx. A separate creditSystemAccount
  // call here would double-credit the burn.
  //
  // Equoria-95yrv: a player whose whole staff is idle owes nothing this
  // week. `debitMoneyOrThrow` rejects a non-positive amount (by design —
  // an unpaired zero-debit is meaningless), so the move is skipped rather
  // than faked; per-groom rows are still written, at 0, to record the week.
  //
  // Equoria-bgdfb (F2): THIS WEEK FIRST, THEN THE DEBT. Try week + arrears in
  // ONE debit (it cannot half-succeed); if the wallet cannot cover both, fall
  // back to this week alone so the groom keeps working and the arrears stay
  // owed. The fallback is legal inside this transaction: debitMoneyOrThrow
  // throws on a zero-row updateMany (a JS decision), so the tx is not aborted.
  const chargeAttempts = [];
  if (unpaidTotal + arrearsTotal > 0) {
    chargeAttempts.push({ amount: unpaidTotal + arrearsTotal, withArrears: true });
  }
  if (arrearsTotal > 0 && unpaidTotal > 0) {
    chargeAttempts.push({ amount: unpaidTotal, withArrears: false });
  }

  let arrearsSettledNow = false;
  for (const [index, attempt] of chargeAttempts.entries()) {
    try {
      await debitMoneyOrThrow(tx, {
        userId,
        amount: attempt.amount,
        systemAccount: systemAccountBurn,
        category: 'groomSalaryBurn',
        description,
        metadata: {
          groomCount: unpaidAssignments.length,
          totalSalary: unpaidTotal,
          // Equoria-bgdfb: the owed weeks settled by THIS debit — 0 when
          // the wallet only covered the current week.
          arrears: attempt.withArrears ? arrearsTotal : 0,
          paymentType: 'weeklySalary',
          payWeekStart: payWeekStart.toISOString(), // Equoria-icqqm audit key
        },
      });
      arrearsSettledNow = attempt.withArrears;
      break;
    } catch (debitError) {
      const isLastAttempt = index === chargeAttempts.length - 1;
      if (!(debitError instanceof InsufficientFundsError) || isLastAttempt) {
        // Nothing left to fall back to: this week itself is unaffordable,
        // which is the grace/release path the caller already handles.
        throw debitError;
      }
    }
  }
  arrearsTotal = arrearsSettledNow ? arrearsTotal : 0;

  // Equoria-bgdfb: the owed weeks are now paid. Marked INSIDE the same
  // transaction as the debit, so a rollback leaves them owed — a week can
  // be settled only by money actually having moved. Skipped entirely when
  // only the current week was affordable: those weeks are still owed.
  if (arrearsSettledNow && owedRows.length > 0) {
    await tx.groomSalaryPayment.updateMany({
      where: { id: { in: owedRows.map(row => row.id) } },
      data: { status: arrearsSettledStatus },
    });
  }

  // Per-groom payment rows. INSIDE the tx so a partial failure
  // rolls back the debit + SystemAccount credit together with
  // the payment rows — no orphan ledger drift. paymentDate uses
  // the run's `now` so the row lands inside the pay-week window
  // the idempotency predicate queries.
  //
  // Equoria-cmw85.37: written in two statements for the whole staff
  // (engagement backstop, then one createMany), so the statement count
  // per player does not grow with the number of grooms.
  //
  // Equoria-ypb7d.2 backstop: a groom on staff since before
  // `groom_engagements` existed has no engagement row, and the
  // migration deliberately backfills none. Open one now, inside the
  // fee transaction that proves the engagement is live. Idempotent,
  // and the partial unique index means a concurrent second attempt
  // aborts this transaction rather than creating a second open row.
  await ensureEngagementsTx(
    tx,
    unpaidAssignments.map(({ groom }) => groom.id),
    userId,
  );

  await tx.groomSalaryPayment.createMany({
    data: unpaidAssignments.map(({ groom, salary }) => ({
      groomId: groom.id,
      userId,
      amount: salary,
      paymentDate: now,
      weekKey,
      paymentType: 'weeklySalary',
      status: 'paid',
    })),
  });

  for (const { groom, salary } of unpaidAssignments) {
    logger.info(
      `[groomSalaryService] Paid $${salary} weekly fee for groom ${groom.name} (user ${username})`,
    );
  }

  // Equoria-ypb7d.3: paying clears the grace marker, so a groom who
  // could not work last week works again this week. Guarded on
  // `not: null` so the statement is a no-op in the ordinary case.
  await tx.groom.updateMany({
    where: {
      id: { in: unpaidAssignments.map(entry => entry.groom.id) },
      feeUnpaidSince: { not: null },
    },
    data: { feeUnpaidSince: null },
  });

  // And the user-level pointer the salary summary renders
  // (`inGracePeriod`) is cleared once NOTHING of theirs is in arrears.
  const stillUnpaid = await tx.groom.count({
    where: { userId, retired: false, feeUnpaidSince: { not: null } },
  });
  if (stillUnpaid === 0) {
    await tx.user.updateMany({
      where: { id: userId, groomSalaryGracePeriod: { not: null } },
      data: { groomSalaryGracePeriod: null },
    });
  }

  return {
    skipped: false,
    amount: unpaidTotal + arrearsTotal,
    arrears: arrearsTotal,
  };
}
