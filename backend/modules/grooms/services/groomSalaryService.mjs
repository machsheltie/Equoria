/**
 * Groom Salary Service — the WEEKLY FEE that sustains an engagement.
 *
 * Equoria-ypb7d.3, implementing the owner's ruling of 2026-09-09 (Equoria-m0w8n,
 * answering Equoria-0aybn):
 *
 *   "They are HIRED by players and charged a weekly fee. ... A groom is working
 *    for a player and so long as they pay their weekly fee, they keep the groom
 *    on their staff. If they fail to pay for a groom for a week, the groom goes
 *    back to the Grooms for hire section of the marketplace and can be hired by
 *    other players. So for clarity, a player gets one weeks grace period. The
 *    groom can't groom horse until paid for that week but they don't officially
 *    lose the groom once until they fail to pay for a whole week."
 *
 * TWO THINGS CHANGED HERE, AND BOTH ARE VISIBLE TO PLAYERS:
 *
 *   1. THE FEE BASIS. Owner ruling 2026-10-28 (q228, Equoria-nawn5): each groom
 *      on a player's staff is paid their star level's price per week, however many
 *      horses they look after, like a rider:
 *
 *        weekly fee for a groom = their star level's price (100-500)
 *
 *      This replaces the 70-per-horse basis of Equoria-95yrv (owner ruling
 *      2026-09-14). The per-groom horse cap (`MAX_HORSES_PER_GROOM`) is still
 *      enforced where assignments are made.
 *
 *   2. NON-PAYMENT. `terminateGroomsForNonPayment` is GONE. It had never once
 *      worked: it wrote `terminationReason` to `GroomAssignment`, which has no
 *      such column, so Prisma rejected the first statement and the function's own
 *      catch swallowed the throw — a player who could not pay kept their grooms
 *      silently, forever (Equoria-0aybn). It is replaced by the ruling's actual
 *      mechanic, which is per-GROOM and measured in PAY WEEKS:
 *
 *        week 1 unpaid  -> `Groom.feeUnpaidSince` = that pay week's Sunday.
 *                          The groom stays on staff and CANNOT GROOM
 *                          (groomEngagementService.checkGroomMayWork). The player
 *                          is told, in the same transaction.
 *        week 2 unpaid  -> a full week has gone by unpaid: the engagement ends,
 *                          `Groom.userId` is cleared, active assignments are
 *                          ENDED (never deleted), and the groom joins the
 *                          grooms-for-hire pool where anyone may hire them. The
 *                          player is told, in the same transaction.
 *        paid           -> `feeUnpaidSince` cleared; the groom works again.
 *
 *      Grace is measured by comparing PAY WEEKS, not elapsed milliseconds: this
 *      job runs at 09:00 Eastern on Mondays, and a `now > graceStart + 7 days` test
 *      decided a player's staff on seconds of cron jitter.
 *
 * Equoria-7r67q (hjtys follow-up #3): the per-user payment block in
 * `processWeeklySalaries` was rewritten to:
 *   1. Wrap the user-level debit + groomSalaryPayment.create loop in a single
 *      `prisma.$transaction(async tx => ...)` — fixes the autocommit drift
 *      where a partial loop failure left the user debited and only some
 *      payment rows persisted.
 *   2. Replace the stale TOCTOU pre-check (`if (user.money < userGroup.totalSalary)`
 *      → `prisma.user.update({ money: { decrement } })`) with the atomic
 *      `debitMoneyOrThrow` predicate. The pre-check raced against concurrent
 *      cron runs / player purchases between the top-level findMany read and
 *      the unconditional update at the bottom — a perfect TOCTOU window the
 *      cron processor was wide-open to because it runs unattended.
 *   3. Pair every successful user debit with
 *      `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, totalSalary, ...)` so the
 *      destroyed money satisfies the conservation invariant
 *        sum(User.money) + sum(SystemAccount.balance) = const
 *      that Equoria-si69u / Equoria-en1ab established for the other sinks.
 *
 * The `InsufficientFundsError` path routes to `handleUnpaidFees(userId, unpaid,
 * payWeekStart)` (Equoria-ypb7d.3 — it replaced `handleInsufficientFunds`),
 * triggered by the typed exception from `debitMoneyOrThrow` rather than by a
 * stale-read pre-check.
 *
 * Equoria-icqqm: `processWeeklySalaries` is now IDEMPOTENT per pay week.
 * Each per-user transaction (1) takes a per-(user, payWeek) advisory xact
 * lock, (2) reads which grooms already have a 'paid' weeklySalary row
 * dated inside the pay week ([Sunday 00:00 Eastern, +7 game days) — `getPayWeekStart`),
 * and (3) debits ONLY the unpaid grooms' salaries. A same-week re-run is a
 * no-op reported via `results.skipped`; a new pay week always pays.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  gameDateKey,
  gameDayIndex,
  startOfGameDayIndex,
  startOfGameWeek,
} from '../../../utils/gameTime.mjs';
import logger from '../../../utils/logger.mjs';
import { InsufficientFundsError } from '../../economy/index.mjs';
// Equoria-hc96y: the collection (lock, idempotency read, debit, paid rows, grace
// cleared) is shared with the player's Pay Groom button.
import { collectGroomFeesTx } from './groomFeeCollection.mjs';
// Equoria-ypb7d.3: what happens when the money is not there — one week of grace,
// then release to the grooms-for-hire pool. Replaces the never-working
// `handleInsufficientFunds` + `terminateGroomsForNonPayment` pair.
import { handleUnpaidFees, recordUncollectedFees } from './groomFeeArrearsService.mjs';
import { groomPayrollFailureRecorder } from './groomPayrollFailures.mjs';
// Equoria-nawn5 / Equoria-bgdfb: WHAT a groom costs, the horse cap, and what an
// unpaid week becomes. Defined next door so this file stays the COLLECTION of the
// fee; re-exported below so every existing importer of this module is unchanged.
import {
  MAX_HORSES_PER_GROOM,
  arrearsOwedStatuses,
  arrearsSettledStatus,
  arrearsWrittenOffStatus,
  calculateWeeklyFee,
  countActiveAssignments,
} from './groomFeeBasisService.mjs';

// Equoria-95yrv: the two reads over the rows this pass writes live next door, for
// the same reason the retirement statistics do. Re-exported so nothing moves.
export { getSalaryPaymentHistory, calculateUserSalaryCost } from './groomSalaryReadService.mjs';

export {
  MAX_HORSES_PER_GROOM,
  arrearsOwedStatuses,
  arrearsSettledStatus,
  arrearsWrittenOffStatus,
  calculateWeeklyFee,
  countActiveAssignments,
};

// Salary configuration
export const SALARY_CONFIG = {
  MAX_HORSES_PER_GROOM,

  // The day a pay week starts (0 = Sunday). Owner ruling 2026-10-29 (q268, Equoria-hc96y):
  // players pay any time during the week, and the week ends Sunday midnight Eastern — the
  // same Sunday-to-Sunday game week as the Hall of Fame (q265). Old contract: Monday.
  PAYMENT_DAY: 0,

  // Equoria-ypb7d.3: the owner's grace period is ONE PAY WEEK, and it is now
  // measured in pay weeks per groom (`Groom.feeUnpaidSince` vs the pay week being
  // processed — see `hasFullUnpaidWeek`), not in days from a user-level timestamp.
  // This constant is retained ONLY because `groomSalaryController.getSalarySummary`
  // renders `gracePeriodDaysRemaining` from `User.groomSalaryGracePeriod` + 7 days,
  // which is the same seven days. Nothing in the release decision reads it.
  GRACE_PERIOD_DAYS: 7,

  // Minimum balance required to keep grooms
  MINIMUM_BALANCE: 0,
};

/**
 * Equoria-icqqm: compute the start of the pay week containing `now`.
 *
 * The pay week is the half-open interval [start, start + 7 days), where
 * `start` is 00:00 Eastern (the game clock) of the most recent
 * SALARY_CONFIG.PAYMENT_DAY (Sunday) at-or-before `now`. Date-only game-day
 * arithmetic means time-of-day on `now` never shifts the week boundary.
 *
 * @param {Date} [now]
 * @returns {Date} Eastern midnight of the pay week's Sunday
 */
export function getPayWeekStart(now = new Date()) {
  return startOfGameWeek(now, SALARY_CONFIG.PAYMENT_DAY);
}

/**
 * Process the weekly fee for every groom on a player's staff.
 *
 * THE BASIS IS THE GROOM (owner ruling 2026-10-28, q228). The selection below reads
 * GROOMS with a `userId` (everyone on someone's staff), because staff is who is
 * billed and who may enter grace; each groom's fee is their star level's price,
 * whatever horses they are working. Retired grooms are excluded: `retired: false` — a
 * retired groom keeps its `userId` so the player can still read their history
 * (see the field comment in schema.prisma), and billing them would be charging
 * for a career that has ended.
 *
 * Equoria-icqqm — PAY-WEEK IDEMPOTENCY: a re-run in the same pay week is a
 * no-op for every groom that already has a `status: 'paid'` weeklySalary
 * payment row dated inside the pay week. Grooms without one (fresh run,
 * partial-run recovery, groom hired after the cron fired) are still paid,
 * and ONLY their fees are debited. A run in a NEW pay week always pays.
 * Guarded users are reported via `results.skipped`.
 *
 * Race safety: the "already paid?" read and the debit share a per-(user,
 * payWeek) transaction-scoped Postgres advisory lock (`pg_advisory_xact_lock`)
 * acquired as the FIRST statement of the per-user transaction. Two concurrent
 * runs (cron + manual trigger, double-tick) serialize on that lock; the loser
 * proceeds only after the winner's COMMIT and — because READ COMMITTED takes
 * a fresh snapshot per statement — then SEES the winner's committed payment
 * rows and skips. If the winner ROLLS BACK, the loser sees no rows and pays:
 * correct either way. The lock auto-releases with the transaction (commit or
 * rollback), so no stale-lock leakage is possible.
 *
 * @param {Date} [now] - Injection point for the pay-week clock (tests /
 *   backfills). Production callers pass nothing.
 * @param {Object} [options]
 * @param {string|null} [options.userId] - Scope the pass to ONE player.
 *   Equoria-ypb7d.3 added this, and it is not cosmetic. Before this story a
 *   non-payment was a silent no-op (`terminateGroomsForNonPayment` threw on a
 *   column that does not exist and swallowed it), so an unscoped test run against
 *   the shared development database was harmless. It is not any more: an unscoped
 *   run now puts every underfunded player's grooms into the grace period and
 *   RELEASES the ones already in it. Tests must scope to their own fixture user.
 *   Mirrors `processWeeklyCareerProgression(userId)`. Production passes nothing.
 * @returns {Object} Processing results
 */
export async function processWeeklySalaries(now = new Date(), { userId: scopeUserId = null } = {}) {
  try {
    logger.info('[groomSalaryService] Starting weekly groom fee processing...');

    // Every groom currently on a player's staff. See the note above on why this is
    // a groom read and not an assignment read.
    const staffWhere = { userId: { not: null }, retired: false, isActive: true };
    if (scopeUserId) {
      staffWhere.userId = scopeUserId;
    }
    const staff = await prisma.groom.findMany({
      where: staffWhere,
      select: {
        id: true,
        name: true,
        userId: true,
        skillLevel: true,
        starLevel: true,
        speciality: true,
        feeUnpaidSince: true,
        user: { select: { id: true, username: true } },
      },
    });

    // Equoria-icqqm: pay-week window for the idempotency predicate.
    const payWeekStart = getPayWeekStart(now);
    const payWeekEnd = startOfGameDayIndex(gameDayIndex(payWeekStart) + 7);
    const weekKey = gameDateKey(payWeekStart);
    // Equoria-brh8c: every groom this payday fails for is recorded for the owner.
    const recordFailure = groomPayrollFailureRecorder('manualPayroll', payWeekStart);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0, // Equoria-icqqm: users fully paid for this pay week already
      graced: 0, // Equoria-ypb7d.3: grooms that entered the one-week grace period
      arrearsCollected: 0, // Equoria-bgdfb: owed weeks settled by this pass
      uncollected: 0, // Equoria-2ti1j: grooms whose fee a THROW (not lack of funds) left uncollected
      released: 0, // Equoria-ypb7d.3: grooms returned to the grooms-for-hire pool
      terminated: 0, // retained key name; now counts the same as `released`
      totalAmount: 0,
      errors: [],
    };

    // Group by the employing player so one debit covers their whole staff.
    const userGroups = {};
    for (const groom of staff) {
      const { userId } = groom;
      // `Groom.userId` is `String?`; the where clause excludes NULL, so this is a
      // belt-and-braces guard rather than a live branch.
      if (!userId) {
        continue;
      }
      if (!userGroups[userId]) {
        userGroups[userId] = {
          user: groom.user ?? { id: userId, username: userId },
          assignments: [],
          totalSalary: 0,
        };
      }

      // Owner ruling 2026-10-28 (q228): the groom's star level's price.
      const salary = calculateWeeklyFee(groom);
      // The key stays `assignments` so every existing reader of this shape
      // (handleUnpaidFees, the tests) keeps working; each entry is one GROOM on staff.
      userGroups[userId].assignments.push({ groom, salary });
      userGroups[userId].totalSalary += salary;
    }

    // Process payments for each user
    for (const [userId, userGroup] of Object.entries(userGroups)) {
      try {
        results.processed++;

        const { user } = userGroup;

        // Equoria-7r67q (hjtys #3): wrap the user-level debit + payment-row
        // writes in a single $transaction so a mid-loop failure rolls BOTH
        // back together (no orphan debit, no orphan payment rows).
        //
        // The atomic `debitMoneyOrThrow` predicate (`money >= totalSalary`)
        // replaces the historical TOCTOU shape (findMany at top-of-fn →
        // pre-check `user.money < totalSalary` → unconditional decrement),
        // which raced against concurrent cron runs and concurrent player
        // purchases. On count===0 it throws `InsufficientFundsError` which
        // we catch and route to the existing insufficient-funds branch.
        //
        // The user debit is paired with `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`
        // inside the same tx so money-conservation holds:
        //   sum(User.money) + sum(SystemAccount.balance) is invariant
        // across the salary move (paralleling Equoria-en1ab / si69u).
        // Equoria-icqqm: the unpaid subset is computed INSIDE the tx (under
        // the advisory lock) but the insufficient-funds handler needs it AFTER
        // the tx aborted — hoisted here, conservatively covering everything.
        // Equoria-hc96y: the collection itself lives in groomFeeCollection.mjs,
        // shared with the player's Pay Groom button; it sets `collected.unpaid`.
        const collected = { unpaid: userGroup.assignments };

        let txOutcome;
        try {
          txOutcome = await prisma.$transaction(
            async tx =>
              collectGroomFeesTx(tx, {
                userId,
                username: user.username,
                entries: userGroup.assignments,
                payWeekStart,
                payWeekEnd,
                weekKey,
                now,
                description: `Groom salary weekly run — user ${user.username}`,
                state: collected,
              }),
            { timeout: 30000 }, // 30s — guard against 5s default under load
          );
        } catch (txError) {
          // Equoria-h7518: the paid-week unique refused a second paid row (tx rolled back).
          if (txError?.code === 'P2002') {
            logger.warn(`[groomSalaryService] Week ${weekKey} already paid: ${user.username}`);
            results.skipped++;
            continue;
          }
          if (txError instanceof InsufficientFundsError) {
            // Insufficient funds — enter grace, or release after a full week.
            // The handler operates OUTSIDE the aborted tx and opens its own
            // per-groom transactions; its writes are independent of, and
            // idempotent with respect to, the rolled-back debit.
            // Equoria-icqqm: only the UNPAID subset — grooms already paid this
            // week were not part of the failed debit and must not be logged as
            // missed.
            //
            // NOTE, because it is a real product consequence and not a bug: the
            // debit is ONE total for the player's whole staff, so a player who
            // cannot afford ALL their grooms pays for NONE of them and every one
            // enters grace together. That is the pre-existing behaviour, kept
            // deliberately; paying for as many as affordable would be a new rule
            // and is the owner's to make.
            const outcome = await handleUnpaidFees(userId, collected.unpaid, payWeekStart, {
              onFailure: recordFailure,
            });
            results.graced += outcome.graced;
            results.released += outcome.released;
            results.terminated += outcome.released;
            results.failed++;
            results.errors.push(`User ${user.username} could not pay this week's groom fees`);
            continue;
          }
          // Equoria-2ti1j: any OTHER throw used to propagate to the outer catch,
          // which counted a per-user failure and did nothing else — the week passed
          // as though it had been paid. Fail CLOSED instead: record it as uncollected
          // so the groom stops working and the week is on the record. Release is
          // deliberately NOT escalated here; see recordUncollectedFees.
          for (const { groom } of collected.unpaid) {
            await recordFailure(groom, txError, userId);
          }
          const out = await recordUncollectedFees(userId, collected.unpaid, payWeekStart, txError);
          results.uncollected += out.recorded;
          results.graced += out.graced;
          results.failed++;
          results.errors.push(`User ${user.username}: fees uncollected — ${txError.message}`);
          continue;
        }

        if (txOutcome.skipped) {
          results.skipped++;
          logger.info(
            `[groomSalaryService] Skipped user ${user.username} — all grooms already paid for pay week starting ${payWeekStart.toISOString()}`,
          );
          continue;
        }

        results.successful++;
        results.totalAmount += txOutcome.amount;
        results.arrearsCollected += txOutcome.arrears;

        logger.info(
          `[groomSalaryService] Processed $${txOutcome.amount} in salaries for user ${user.username}`,
        );
      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing salaries for user ${userId}: ${error.message}`);
        for (const { groom } of userGroup.assignments) {
          await recordFailure(groom, error, userId);
        }
        logger.error(
          `[groomSalaryService] Error processing salaries for user ${userId}: ${error.message}`,
        );
      }
    }

    logger.info(
      `[groomSalaryService] Weekly salary processing complete. Processed: ${results.processed}, Successful: ${results.successful}, Skipped (already paid): ${results.skipped}, Failed: ${results.failed}, Total: $${results.totalAmount}`,
    );

    return results;
  } catch (error) {
    logger.error(`[groomSalaryService] Error in weekly salary processing: ${error.message}`);
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      uncollected: 0,
      arrearsCollected: 0,
      terminated: 0,
      totalAmount: 0,
      errors: [error.message],
    };
  }
}
