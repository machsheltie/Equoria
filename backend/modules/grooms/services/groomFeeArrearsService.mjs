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

      const graced = await prisma.$transaction(async tx => {
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
        if (entered.entered) {
          // Keep the user-level pointer the salary summary renders in step. Guarded
          // on `null` so an existing grace start is never pushed forward.
          await tx.user.updateMany({
            where: { id: userId, groomSalaryGracePeriod: null },
            data: { groomSalaryGracePeriod: payWeekStart },
          });
        }
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
