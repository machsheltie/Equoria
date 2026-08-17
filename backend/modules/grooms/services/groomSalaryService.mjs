/**
 * Groom Salary Service
 *
 * Handles weekly salary deductions for hired grooms
 * Implements automatic salary processing and payment tracking
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
 * The `InsufficientFundsError` path routes to the existing
 * `handleInsufficientFunds(userId, userGroup)` branch — unchanged, but now
 * triggered by the typed exception from `debitMoneyOrThrow` instead of a
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

  // Grace period before termination (days)
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
 * (Monday) at-or-before `now`. Date-only UTC arithmetic, mirroring the
 * horse-age convention (.claude/rules/PATTERN_LIBRARY.md, Equoria-vdw5):
 * time-of-day on `now` never shifts the week boundary.
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
 * Process weekly salary payments for all active grooms.
 *
 * Equoria-icqqm — PAY-WEEK IDEMPOTENCY: a re-run in the same pay week is a
 * no-op for every groom that already has a `status: 'paid'` weekly_salary
 * payment row dated inside the pay week. Grooms without one (fresh run,
 * partial-run recovery, groom hired after the cron fired) are still paid,
 * and ONLY their salaries are debited. A run in a NEW pay week always pays.
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
 * @returns {Object} Processing results
 */
export async function processWeeklySalaries(now = new Date()) {
  try {
    logger.info('[groomSalaryService] Starting weekly salary processing...');

    // Get all active groom assignments
    const activeAssignments = await prisma.groomAssignment.findMany({
      where: {
        isActive: true,
      },
      include: {
        groom: true,
        user: true,
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
      terminated: 0,
      totalAmount: 0,
      errors: [],
    };

    // Group assignments by user to batch process payments
    const userGroups = {};
    for (const assignment of activeAssignments) {
      const { userId } = assignment;
      // Defensive: groom assignments may have userId = null per schema
      // (GroomAssignment.userId is String?). Skip those — they have no
      // wallet to debit and represent a stale / orphaned assignment that
      // should be addressed by data-cleanup, not silently double-paid.
      if (!userId) {
        continue;
      }
      if (!userGroups[userId]) {
        userGroups[userId] = {
          user: assignment.user,
          assignments: [],
          totalSalary: 0,
        };
      }

      const salary = calculateWeeklySalary(assignment.groom);
      userGroups[userId].assignments.push({
        assignment,
        groom: assignment.groom,
        salary,
      });
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
              for (const { assignment: _assignment, groom, salary } of unpaidAssignments) {
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
                  `[groomSalaryService] Paid $${salary} salary to groom ${groom.name} for user ${user.username}`,
                );
              }

              return { skipped: false, amount: unpaidTotal };
            },
            { timeout: 30000 }, // 30s — guard against 5s default under load
          );
        } catch (txError) {
          if (txError instanceof InsufficientFundsError) {
            // Insufficient funds — start grace period or terminate.
            // The handler operates OUTSIDE the tx (using the autocommit
            // client) because the tx already aborted; its own writes are
            // independent and idempotent w.r.t. the rolled-back debit.
            // Equoria-icqqm: report only the UNPAID subset — grooms already
            // paid this week were not part of the failed debit and must not
            // be logged as missed.
            await handleInsufficientFunds(userId, {
              ...userGroup,
              assignments: unpaidAssignments,
              totalSalary: unpaidTotal,
            });
            results.failed++;
            results.errors.push(`User ${user.username} has insufficient funds for groom salaries`);
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
 * Handle insufficient funds for groom salaries
 * @param {string} userId - User ID
 * @param {Object} userGroup - User group with assignments and total salary
 */
async function handleInsufficientFunds(userId, userGroup) {
  try {
    // Re-read the user row to get the current grace-period state. The
    // userGroup.user snapshot from the top-of-function findMany may be
    // stale by the time we get here (especially in the InsufficientFunds
    // branch where a concurrent op drained the wallet).
    const freshUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, groomSalaryGracePeriod: true },
    });
    const user = freshUser ?? userGroup.user;
    const gracePeriodStart = user?.groomSalaryGracePeriod ?? null;

    if (!gracePeriodStart) {
      // Start grace period
      await prisma.user.update({
        where: { id: userId },
        data: {
          groomSalaryGracePeriod: new Date(),
        },
      });

      logger.warn(
        `[groomSalaryService] Started grace period for user ${user.username} - insufficient funds for groom salaries`,
      );

      // Log missed payment
      for (const { groom, salary } of userGroup.assignments) {
        await prisma.groomSalaryPayment.create({
          data: {
            groomId: groom.id,
            userId,
            amount: salary,
            paymentDate: new Date(),
            paymentType: 'weekly_salary',
            status: 'missed_insufficient_funds',
          },
        });
      }
    } else {
      // Check if grace period has expired
      const gracePeriodEnd = new Date(gracePeriodStart);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + SALARY_CONFIG.GRACE_PERIOD_DAYS);

      if (new Date() > gracePeriodEnd) {
        // Grace period expired - terminate all groom assignments
        await terminateGroomsForNonPayment(userId, userGroup);
        logger.warn(
          `[groomSalaryService] Terminated all grooms for user ${user.username} - grace period expired`,
        );
      } else {
        // Still in grace period
        logger.warn(
          `[groomSalaryService] User ${user.username} still in grace period for groom salary payments`,
        );

        // Log missed payment
        for (const { groom, salary } of userGroup.assignments) {
          await prisma.groomSalaryPayment.create({
            data: {
              groomId: groom.id,
              userId,
              amount: salary,
              paymentDate: new Date(),
              paymentType: 'weekly_salary',
              status: 'missed_grace_period',
            },
          });
        }
      }
    }
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error handling insufficient funds for user ${userId}: ${error.message}`,
    );
  }
}

/**
 * Terminate all groom assignments for a user due to non-payment
 * @param {string} userId - User ID
 * @param {Object} userGroup - User group with assignments
 */
async function terminateGroomsForNonPayment(userId, userGroup) {
  try {
    // Deactivate all groom assignments
    await prisma.groomAssignment.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        endDate: new Date(),
        terminationReason: 'non_payment',
      },
    });

    // Clear grace period
    await prisma.user.update({
      where: { id: userId },
      data: {
        groomSalaryGracePeriod: null,
      },
    });

    // Log termination payments
    for (const { groom, salary } of userGroup.assignments) {
      await prisma.groomSalaryPayment.create({
        data: {
          groomId: groom.id,
          userId,
          amount: salary,
          paymentDate: new Date(),
          paymentType: 'weekly_salary',
          status: 'terminated_non_payment',
        },
      });
    }

    logger.info(
      `[groomSalaryService] Terminated ${userGroup.assignments.length} groom assignments for user ${userId} due to non-payment`,
    );
  } catch (error) {
    logger.error(
      `[groomSalaryService] Error terminating grooms for user ${userId}: ${error.message}`,
    );
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
 * Calculate total weekly salary cost for a user
 * @param {string} userId - User ID
 * @returns {Object} Salary cost breakdown
 */
export async function calculateUserSalaryCost(userId) {
  try {
    const activeAssignments = await prisma.groomAssignment.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        groom: true,
      },
    });

    let totalWeeklyCost = 0;
    const breakdown = [];

    for (const assignment of activeAssignments) {
      const salary = calculateWeeklySalary(assignment.groom);
      totalWeeklyCost += salary;

      breakdown.push({
        groomId: assignment.groom.id,
        groomName: assignment.groom.name,
        skillLevel: assignment.groom.skillLevel,
        speciality: assignment.groom.speciality,
        weeklySalary: salary,
      });
    }

    return {
      totalWeeklyCost,
      groomCount: activeAssignments.length,
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
