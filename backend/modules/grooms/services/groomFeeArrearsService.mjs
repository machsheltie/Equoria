/**
 * Groom Fee Arrears — the consequence when a weekly fee goes unpaid.
 *
 * Equoria-ypb7d.3, answering Equoria-0aybn. Split out of groomSalaryService.mjs
 * because that file reached its 600-line cap, and because the split is the right
 * shape: the salary service decides WHAT IS OWED and takes the money; this file
 * owns WHAT HAPPENS WHEN THE MONEY IS NOT THERE, which is a lifecycle rule rather
 * than an accounting one.
 *
 * Deliberately NOT in the grooms barrel: its only caller is groomSalaryService.mjs
 * in the same module, and nothing outside the module should be able to release a
 * player's groom.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { finalizeNotificationAfterCommit } from '../../../utils/notificationService.mjs';
import {
  ENGAGEMENT_END_REASONS,
  GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
  GROOM_RELEASED_NOTIFICATION_TYPE,
  acquirePayWeekLockTx,
  enterFeeGraceTx,
  hasFullUnpaidWeek,
  releaseGroomTx,
} from './groomEngagementService.mjs';

/**
 * The non-payment consequence, per groom. Equoria-ypb7d.3 / Equoria-0aybn.
 *
 * This is the whole of the owner's ruling on non-payment, and it REPLACES
 * `handleInsufficientFunds` + `terminateGroomsForNonPayment`. The pair it replaces
 * had never worked: the termination wrote `terminationReason` to
 * `GroomAssignment`, a column that does not exist, so Prisma rejected its first
 * statement and its own `catch` swallowed the throw. No assignment was ever
 * deactivated, the grace period was never cleared, and no `terminated_non_payment`
 * row was ever written — a player who could not pay kept every groom, silently.
 *
 * Per unpaid groom, exactly one of three things happens:
 *
 *   already unpaid for a STRICTLY EARLIER pay week
 *     -> RELEASE. A full week has gone unpaid, so the engagement ends, the groom
 *        becomes a free agent, their active assignments are ENDED (never deleted)
 *        and the player is told — all in one transaction, so the player cannot
 *        lose a groom without the notice that says so.
 *   not yet marked unpaid
 *     -> ENTER GRACE. `feeUnpaidSince` is stamped with this pay week, the groom
 *        stays on staff but cannot groom, and the player is told. Also stamps the
 *        user-level `groomSalaryGracePeriod` the salary summary already renders.
 *   marked unpaid for THIS pay week already
 *     -> nothing but a `missed_grace_period` audit row. Reachable only if a second
 *        run in the same pay week reaches the debit and fails again; the player is
 *        not told twice.
 *
 * Each groom gets its OWN transaction rather than one for the whole player. That is
 * deliberate: releasing four grooms should not be all-or-nothing, and a per-groom
 * failure (a concurrent re-hire winning the guarded update, say) must leave the
 * other three correctly handled. Per-groom errors are logged and counted, never
 * rethrown, because the caller has already recorded this user as failed.
 *
 * LOCK AND WRITE ORDER (fix round 1, finding F2 — the first version got both wrong).
 *   Every transaction below takes `acquirePayWeekLockTx` as its FIRST statement. The
 *   payment transaction in `processWeeklySalaries` holds that same lock, but it was
 *   RELEASED when the failed debit's transaction aborted — so this handler ran
 *   serialized against nothing.
 *
 *   And the grace transaction wrote `grooms` before `User`, inverting the campaign's
 *   User-before-staff order. Together those two facts were a real deadlock: an
 *   overlapping second pass whose debit succeeded (the player topped up between runs)
 *   held the `User` row and wanted the `Groom` row, while this handler held the
 *   `Groom` row and wanted the `User` row. Postgres aborts one side with 40P01, and
 *   the loss is silent — either the grace entry is swallowed by the per-groom catch
 *   below (the groom works that week for free and the player is never told) or the
 *   other pass's whole payroll for that player fails.
 *
 *   So: the lock first, and then `User` before `grooms`. The `User` write is now
 *   unconditional rather than gated on whether THIS groom newly entered grace — it is
 *   guarded on `groomSalaryGracePeriod: null` so it can never move an existing grace
 *   start forward, and reaching this handler at all means the player is in arrears
 *   whichever groom triggered it.
 *
 * @param {string} userId
 * @param {Array<{groom: Object, salary: number}>} unpaid - the grooms whose fee
 *   this pay week's debit did not cover
 * @param {Date} payWeekStart
 * @returns {Promise<{graced: number, released: number}>}
 */
export async function handleUnpaidFees(userId, unpaid, payWeekStart) {
  const outcome = { graced: 0, released: 0 };

  for (const { groom, salary } of unpaid) {
    try {
      if (hasFullUnpaidWeek(groom.feeUnpaidSince, payWeekStart)) {
        const released = await prisma.$transaction(async tx => {
          // F2: the same lock the payment transaction takes, first, so an
          // overlapping pass for this player cannot interleave with the release.
          await acquirePayWeekLockTx(tx, userId, payWeekStart);
          const result = await releaseGroomTx(tx, {
            groomId: groom.id,
            userId,
            reason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
            notificationPayloadExtras: {
              weeklyFee: salary,
              unpaidSince: new Date(groom.feeUnpaidSince).toISOString(),
              payWeekStart: payWeekStart.toISOString(),
            },
          });
          // The audit row, in the same transaction as the release it records.
          await tx.groomSalaryPayment.create({
            data: {
              groomId: groom.id,
              userId,
              amount: salary,
              paymentDate: new Date(),
              paymentType: 'weekly_salary',
              status: 'terminated_non_payment',
            },
          });
          return result;
        });

        // Post-commit, in ADR-011 / ADR-007 order: the real-time nudge and the
        // retention prune follow the durable write. Never throws.
        finalizeNotificationAfterCommit(
          userId,
          GROOM_RELEASED_NOTIFICATION_TYPE,
          released.notificationPayload,
        );
        outcome.released++;
        logger.warn(
          `[groomSalaryService] Released groom ${groom.name} (${groom.id}) from user ${userId} ` +
            `to the grooms-for-hire pool: a full pay week unpaid (${released.endedAssignmentCount} ` +
            'assignment(s) ended)',
        );
        continue;
      }

      // Fix round 2, residual B. Round 1's reordering for F2 made the `User` write
      // UNCONDITIONAL, where before it was gated on `entered.entered`. That was a
      // behaviour change riding along with a lock-order fix, described only by a comment
      // and pinned by no test — so it is decided here, and pinned by the
      // "already in grace" case in groomEngagementLifecycle.integration.
      //
      // THE DECISION: restore the condition, but decide it BEFORE the write so the
      // User-before-staff order survives. `groom.feeUnpaidSince` comes from the same
      // snapshot that chose the grace branch over the release branch two lines up, so
      // "this groom is not yet in grace" is known without reading anything new: null
      // means grace is about to BEGIN and the player-level pointer belongs with it,
      // non-null means grace began in an earlier run and the pointer was set then.
      //
      // Why not keep it unconditional: the pointer is what
      // `groomSalaryController.getSalarySummary` renders as `inGracePeriod` and
      // `gracePeriodDaysRemaining`. Setting it when no groom actually entered grace
      // would tell a player they are inside a grace period they are not in — a lie
      // about state, which PRODUCT.md principle 7 forbids, and the reachable case is
      // real: a groom whose row stopped matching between the snapshot and the write.
      const graceBeginsForThisGroom = groom.feeUnpaidSince === null;

      const graced = await prisma.$transaction(async tx => {
        // F2, in this exact order and for the reason in the docblock above:
        //   1. the shared per-(user, pay week) advisory lock;
        //   2. the USER row — the user-level pointer the salary summary renders,
        //      guarded on `null` so an existing grace start is never pushed forward;
        //   3. only then the GROOM row.
        // User before staff. Reversing these two is the deadlock F2 describes, and the
        // advisory lock alone does not make the order safe: `hireFreeAgent` debits the
        // User row and then claims a Groom row WITHOUT this lock, so a staff-then-User
        // grace transaction could still cycle against it.
        await acquirePayWeekLockTx(tx, userId, payWeekStart);

        if (graceBeginsForThisGroom) {
          await tx.user.updateMany({
            where: { id: userId, groomSalaryGracePeriod: null },
            data: { groomSalaryGracePeriod: payWeekStart },
          });
        }

        const entered = await enterFeeGraceTx(tx, {
          groomId: groom.id,
          userId,
          payWeekStart,
          fee: salary,
        });
        await tx.groomSalaryPayment.create({
          data: {
            groomId: groom.id,
            userId,
            amount: salary,
            paymentDate: new Date(),
            paymentType: 'weekly_salary',
            // The distinction the existing vocabulary already draws: the week the
            // fee was first missed, versus a later failure inside the same week.
            status: entered.entered ? 'missed_insufficient_funds' : 'missed_grace_period',
          },
        });
        return entered;
      });

      if (graced.entered) {
        finalizeNotificationAfterCommit(
          userId,
          GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
          graced.notificationPayload,
        );
        outcome.graced++;
        logger.warn(
          `[groomSalaryService] Groom ${groom.name} (${groom.id}) cannot work for user ${userId}: ` +
            `this week's fee of $${salary} is unpaid. One week of grace; released after a full week.`,
        );
      }
    } catch (error) {
      // Counted by the caller as a user-level failure already; logged here so the
      // groom that could not be handled is named. Never rethrown — one groom must
      // not stop the rest of this player's staff being handled correctly.
      logger.error(
        `[groomSalaryService] Failed to apply the non-payment consequence to groom ${groom.id} ` +
          `for user ${userId}: ${error.message}`,
      );
    }
  }

  return outcome;
}

export default { handleUnpaidFees };
