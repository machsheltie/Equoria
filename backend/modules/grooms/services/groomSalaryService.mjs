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
 *   1. THE FEE BASIS. It used to be charged per ACTIVE `GroomAssignment` — so a
 *      groom you had hired but not put on a horse cost nothing, and a groom on
 *      three horses cost three times. The ruling makes the fee what keeps a groom
 *      ON YOUR STAFF, so it is now charged ONCE per groom you employ, assigned or
 *      not. The RATES are unchanged (`SALARY_CONFIG` below, 50-165/week); only
 *      what is counted changed. This is an economy change and is reported as one
 *      — it is a consequence of the ruling, not a rebalance.
 *
 *   2. NON-PAYMENT. `terminateGroomsForNonPayment` is GONE. It had never once
 *      worked: it wrote `terminationReason` to `GroomAssignment`, which has no
 *      such column, so Prisma rejected the first statement and the function's own
 *      catch swallowed the throw — a player who could not pay kept their grooms
 *      silently, forever (Equoria-0aybn). It is replaced by the ruling's actual
 *      mechanic, which is per-GROOM and measured in PAY WEEKS:
 *
 *        week 1 unpaid  -> `Groom.feeUnpaidSince` = that pay week's Monday.
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
 *      job runs at 09:00 UTC on Mondays, and a `now > graceStart + 7 days` test
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
 * lock, (2) reads which grooms already have a 'paid' weekly_salary row
 * dated inside the pay week ([Monday 00:00 UTC, +7d) — `getPayWeekStart`),
 * and (3) debits ONLY the unpaid grooms' salaries. A same-week re-run is a
 * no-op reported via `results.skipped`; a new pay week always pays.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import {
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../economy/index.mjs';
// Equoria-ypb7d.2: a groom on staff since before `groom_engagements` existed gets
// its engagement row opened by the fee pass, which is the transaction that proves
// the engagement is live. The migration backfills none on purpose.
import { ensureEngagementTx } from './groomEngagementService.mjs';
// Equoria-ypb7d.3: what happens when the money is not there — one week of grace,
// then release to the grooms-for-hire pool. Replaces the never-working
// `handleInsufficientFunds` + `terminateGroomsForNonPayment` pair.
import { handleUnpaidFees } from './groomFeeArrearsService.mjs';

// Salary configuration
export const SALARY_CONFIG = {
  // Base weekly salaries by skill level
  WEEKLY_SALARIES: {
    novice: 50, // $50/week
    intermediate: 75, // $75/week
    expert: 100, // $100/week
    master: 150, // $150/week
  },

  // Specialty bonuses (added to base salary)
  SPECIALTY_BONUSES: {
    foalCare: 10, // +$10/week for foal care specialty
    showHandling: 15, // +$15/week for show handling specialty
    general: 0, // No bonus for general grooms
  },

  // Payment processing day (0 = Sunday, 1 = Monday, etc.)
  PAYMENT_DAY: 1, // Monday

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
 * Calculate weekly salary for a groom
 * @param {Object} groom - Groom object with skillLevel and speciality
 * @returns {number} Weekly salary amount
 */
export function calculateWeeklySalary(groom) {
  try {
    const baseSalary =
      SALARY_CONFIG.WEEKLY_SALARIES[groom.skillLevel] || SALARY_CONFIG.WEEKLY_SALARIES.novice;
    const specialtyBonus = SALARY_CONFIG.SPECIALTY_BONUSES[groom.speciality] || 0;

    return baseSalary + specialtyBonus;
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error calculating salary for groom ${groom.id}: ${error.message}`,
    );
    return SALARY_CONFIG.WEEKLY_SALARIES.novice; // Default to novice salary
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Equoria-icqqm: compute the UTC start of the pay week containing `now`.
 *
 * The pay week is the half-open interval [start, start + 7 days), where
 * `start` is 00:00 UTC of the most recent SALARY_CONFIG.PAYMENT_DAY
 * (Monday) at-or-before `now`. Date-only UTC arithmetic means time-of-day on
 * `now` never shifts the week boundary.
 *
 * @param {Date} [now]
 * @returns {Date} UTC midnight of the pay week's Monday
 */
export function getPayWeekStart(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = (d.getUTCDay() - SALARY_CONFIG.PAYMENT_DAY + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/**
 * Process the weekly fee for every groom on a player's staff.
 *
 * Equoria-ypb7d.3 — THE BASIS IS THE ENGAGEMENT, NOT THE ASSIGNMENT. The
 * selection below reads GROOMS with a `userId` (i.e. on someone's staff), not
 * active `GroomAssignment` rows. A groom you employ but have not put on a horse
 * is still on your staff and still costs the weekly fee; a groom on three horses
 * costs it once. That is what "so long as they pay their weekly fee, they keep the
 * groom on their staff" means. Retired grooms are excluded: `retired: false` — a
 * retired groom keeps its `userId` so the player can still read their history
 * (see the field comment in schema.prisma), and billing them would be charging
 * for a career that has ended.
 *
 * Equoria-icqqm — PAY-WEEK IDEMPOTENCY: a re-run in the same pay week is a
 * no-op for every groom that already has a `status: 'paid'` weekly_salary
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
        speciality: true,
        feeUnpaidSince: true,
        user: { select: { id: true, username: true } },
      },
    });

    // Equoria-icqqm: pay-week window for the idempotency predicate.
    const payWeekStart = getPayWeekStart(now);
    const payWeekEnd = new Date(payWeekStart.getTime() + 7 * MS_PER_DAY);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0, // Equoria-icqqm: users fully paid for this pay week already
      graced: 0, // Equoria-ypb7d.3: grooms that entered the one-week grace period
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

      const salary = calculateWeeklySalary(groom);
      // The key stays `assignments` so every existing reader of this shape
      // (handleUnpaidFees, the tests) keeps working; each entry is now one GROOM
      // on staff rather than one active assignment.
      userGroups[userId].assignments.push({ groom, salary });
      userGroups[userId].totalSalary += salary;
    }

    // Process payments for each user
    for (const [userId, userGroup] of Object.entries(userGroups)) {
      try {
        results.processed++;

        const { user } = userGroup;
        const { totalSalary } = userGroup;

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
        let unpaidAssignments = userGroup.assignments;
        let unpaidTotal = totalSalary;

        let txOutcome;
        try {
          txOutcome = await prisma.$transaction(
            async tx => {
              // Equoria-icqqm: serialize concurrent runs per (user, payWeek).
              // MUST be the first statement — the idempotency read below is
              // only race-safe while this xact-scoped lock is held. Blocking
              // variant (not try_): the loser WAITS for the winner's commit,
              // then re-reads and skips, instead of failing spuriously.
              // ($executeRaw, not $queryRaw: pg_advisory_xact_lock returns
              // `void`, which $queryRaw cannot deserialize as a column.)
              const lockKey = jobNameToLockKey(
                `groomSalary:${userId}:${payWeekStart.toISOString()}`,
              );
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

              // Idempotency predicate: which grooms already have a committed
              // 'paid' weekly-salary row inside this pay week? Per-groom
              // granularity heals partial-run recovery: a re-run pays ONLY
              // the grooms the crashed run never reached.
              const paidRows = await tx.groomSalaryPayment.findMany({
                where: {
                  userId,
                  paymentType: 'weekly_salary',
                  status: 'paid',
                  paymentDate: { gte: payWeekStart, lt: payWeekEnd },
                },
                select: { groomId: true },
              });
              const paidGroomIds = new Set(paidRows.map(row => row.groomId));

              unpaidAssignments = userGroup.assignments.filter(
                ({ groom }) => !paidGroomIds.has(groom.id),
              );
              if (unpaidAssignments.length === 0) {
                // Everything already paid for this pay week — a re-run must
                // be a no-op, not a second debit.
                return { skipped: true, amount: 0 };
              }
              unpaidTotal = unpaidAssignments.reduce((sum, entry) => sum + entry.salary, 0);

              // Equoria-kl16c: the SystemAccount.burn credit is now PAIRED
              // INTERNALLY by debitMoneyOrThrow (systemAccount/category
              // required). supplying linkedUserId via the helper attributes a
              // paired ledger row to the user (so their transaction history
              // reflects the move) while the SystemAccount.balance is mutated
              // authoritatively in the same tx. A separate creditSystemAccount
              // call here would double-credit the burn.
              await debitMoneyOrThrow(tx, {
                userId,
                amount: unpaidTotal,
                systemAccount: SYSTEM_ACCOUNT_BURN,
                category: 'groom_salary_burn',
                description: `Groom salary weekly run — user ${user.username}`,
                metadata: {
                  groomCount: unpaidAssignments.length,
                  totalSalary: unpaidTotal,
                  paymentType: 'weekly_salary',
                  payWeekStart: payWeekStart.toISOString(), // Equoria-icqqm audit key
                },
              });

              // Per-groom payment rows. INSIDE the tx so a partial failure
              // rolls back the debit + SystemAccount credit together with
              // the payment rows — no orphan ledger drift. paymentDate uses
              // the run's `now` so the row lands inside the pay-week window
              // the idempotency predicate queries.
              for (const { groom, salary } of unpaidAssignments) {
                // Equoria-ypb7d.2 backstop: a groom on staff since before
                // `groom_engagements` existed has no engagement row, and the
                // migration deliberately backfills none. Open one now, inside the
                // fee transaction that proves the engagement is live. Idempotent,
                // and the partial unique index means a concurrent second attempt
                // aborts this transaction rather than creating a second open row.
                await ensureEngagementTx(tx, groom.id, userId);

                await tx.groomSalaryPayment.create({
                  data: {
                    groomId: groom.id,
                    userId,
                    amount: salary,
                    paymentDate: now,
                    paymentType: 'weekly_salary',
                    status: 'paid',
                  },
                });

                logger.info(
                  `[groomSalaryService] Paid $${salary} weekly fee for groom ${groom.name} (user ${user.username})`,
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

              return { skipped: false, amount: unpaidTotal };
            },
            { timeout: 30000 }, // 30s — guard against 5s default under load
          );
        } catch (txError) {
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
            const outcome = await handleUnpaidFees(userId, unpaidAssignments, payWeekStart);
            results.graced += outcome.graced;
            results.released += outcome.released;
            results.terminated += outcome.released;
            results.failed++;
            results.errors.push(`User ${user.username} could not pay this week's groom fees`);
            continue;
          }
          // Any non-InsufficientFunds error propagates to the outer catch
          // so the caller sees a clean per-user failure with the original
          // message preserved.
          throw txError;
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

        logger.info(
          `[groomSalaryService] Processed $${txOutcome.amount} in salaries for user ${user.username}`,
        );
      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing salaries for user ${userId}: ${error.message}`);
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
      terminated: 0,
      totalAmount: 0,
      errors: [error.message],
    };
  }
}

/**
 * Get salary payment history for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of records to return (default: 50)
 * @returns {Array} Payment history
 */
export async function getSalaryPaymentHistory(userId, limit = 50) {
  try {
    const payments = await prisma.groomSalaryPayment.findMany({
      where: {
        userId,
      },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
            speciality: true,
          },
        },
      },
      orderBy: {
        paymentDate: 'desc',
      },
      take: limit,
    });

    return payments;
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error getting salary payment history for user ${userId}: ${error.message}`,
    );
    return [];
  }
}

/**
 * Calculate the total weekly fee a user owes for their groom staff.
 *
 * Equoria-ypb7d.3: this MUST match what `processWeeklySalaries` actually charges,
 * or the salary summary lies to the player about `weeksAffordable` — which
 * PRODUCT.md principle 7 forbids. So it counts the same thing the pass counts:
 * every groom on the player's staff (`Groom.userId`, not retired), assigned or
 * not, once each. It previously counted active `GroomAssignment` rows, which after
 * the basis change would have under-reported an unassigned groom as free and
 * over-reported a groom on three horses as triple.
 *
 * `feeUnpaidSince` is included in the breakdown because a groom in arrears still
 * costs the fee — that is what "one week of grace" means — and because the surface
 * needs to be able to say which groom cannot work.
 *
 * @param {string} userId - User ID
 * @returns {Object} Weekly fee breakdown
 */
export async function calculateUserSalaryCost(userId) {
  try {
    const staff = await prisma.groom.findMany({
      where: { userId, retired: false, isActive: true },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        speciality: true,
        feeUnpaidSince: true,
      },
    });

    let totalWeeklyCost = 0;
    const breakdown = [];

    for (const groom of staff) {
      const salary = calculateWeeklySalary(groom);
      totalWeeklyCost += salary;

      breakdown.push({
        groomId: groom.id,
        groomName: groom.name,
        skillLevel: groom.skillLevel,
        speciality: groom.speciality,
        weeklySalary: salary,
        feeUnpaid: groom.feeUnpaidSince !== null,
      });
    }

    return {
      totalWeeklyCost,
      groomCount: staff.length,
      breakdown,
    };
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error calculating salary cost for user ${userId}: ${error.message}`,
    );
    return {
      totalWeeklyCost: 0,
      groomCount: 0,
      breakdown: [],
    };
  }
}
