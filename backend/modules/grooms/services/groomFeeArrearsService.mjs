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
// Equoria-bgdfb: what an unpaid week becomes, and the two ways it stops being owed.
import { ARREARS_OWED_STATUSES, ARREARS_WRITTEN_OFF_STATUS } from './groomFeeBasisService.mjs';
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
 *   So: the lock first, and then `User` before `grooms`.
 *
 *   ROUND 1 ALSO MADE THAT `User` WRITE UNCONDITIONAL, and this docblock argued for it.
 *   Round 2 reversed that, and round 3 is deleting the argument, because it survived the
 *   code it described by sixty lines — the tenth claim in this campaign to outlive its
 *   fact, and the second time in this task that a corrected behaviour left its own
 *   explanation standing. What the code does now: the write is gated on
 *   `graceBeginsForThisGroom`, taken from the same snapshot that chose the grace branch,
 *   so it is decided BEFORE the write and the User-before-staff order still holds. The
 *   reason is at that line and not repeated here — one explanation, next to the code.
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
              paymentDate: payWeekStart,
              paymentType: 'weekly_salary',
              status: 'terminated_non_payment',
            },
          });
          // Equoria-bgdfb: the debt does not outlive the groom. Losing them to the
          // grooms-for-hire pool IS the penalty for a full unpaid week; carrying the
          // owed weeks forward would charge the player for a groom they no longer
          // have, and the next player to hire this groom owes nothing for the last
          // player's arrears. Written off rather than deleted, so the weeks stay on
          // the record. In the same transaction as the release, so a rollback leaves
          // both the engagement and the debt exactly as they were.
          await tx.groomSalaryPayment.updateMany({
            where: {
              groomId: groom.id,
              userId,
              paymentType: 'weekly_salary',
              status: { in: [...ARREARS_OWED_STATUSES] },
            },
            data: { status: ARREARS_WRITTEN_OFF_STATUS },
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
      // and pinned by no test — so it is decided here, and pinned by
      // groomFeeArrears.integration's case "a SECOND failure in the SAME pay week: no
      // second notice, no moved marker, no new pointer". (Round 3 corrected this
      // reference: it named a file the split had moved the case out of, and a case title
      // that never existed.)
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
            // Equoria-bgdfb: dated with the PAY WEEK this row records, not with the
            // moment it was written. The next collection settles the weeks strictly
            // BEFORE the one it is charging, and that test is only exact if the row
            // says which week it is. (A `missed_grace_period` row is not owed — its
            // week is already recorded by the `missed_insufficient_funds` row.)
            paymentDate: payWeekStart,
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

/**
 * Equoria-2ti1j — THE WEEK WAS NOT COLLECTED, AND THE FAULT WAS OURS.
 *
 * `handleUnpaidFees` above is the consequence of a player having no money. This is
 * the consequence of the fee transaction throwing for ANY OTHER reason: a dropped
 * connection, a deadlock, a constraint the code did not expect, a transaction
 * timeout. Before this function existed, that throw was counted as a per-user
 * failure and nothing else happened — the player was neither charged nor put into
 * grace, their grooms worked the whole week, and the next pass is a NEW pay week so
 * the missed one was never revisited. An infrastructure fault produced a strictly
 * better outcome for the player than paying would have. That is failing open on a
 * revenue path, and the campaign's standing principle is fail closed.
 *
 * WHAT THIS COMMITS TO, deliberately narrow:
 *   - The pay week is RECORDED as uncollected: one `missed_collection_error` audit
 *     row per groom, so the week is visible to a human and to any later pass rather
 *     than vanishing.
 *   - The groom ENTERS GRACE (`feeUnpaidSince` = this pay week) and therefore stops
 *     working, because the player did not in fact pay. Same marker, same guard, same
 *     player notice as the insufficient-funds path — the player-visible fact ("this
 *     week's fee is unpaid, this groom cannot work") is true either way.
 *
 * WHAT THIS DELIBERATELY DOES NOT COMMIT TO:
 *   - RELEASE. Even when the groom is already in grace from a strictly earlier pay
 *     week — the state that makes `handleUnpaidFees` release them — this path never
 *     releases. Losing a groom is the penalty for a player not paying for a whole
 *     week; it is not a penalty to hand out because our own transaction threw. The
 *     groom stays on staff, cannot work, and the audit row records the week.
 *   - RELEASE, as above. (ARREARS is no longer open: Equoria-bgdfb was ruled on
 *     2026-09-14 — "It's owed." The `missed_collection_error` row this writes is in
 *     `ARREARS_OWED_STATUSES`, so the next successful collection takes it along with
 *     that week's fee. Because this path never releases, its uncollected weeks can
 *     accumulate across weeks — each owed once and settled once, never doubled.)
 *
 * The knock-on this path DOES accept, stated rather than hidden: a groom put into
 * grace by a collection error in week 1 whose week 2 fee then genuinely cannot be
 * paid is released by `handleUnpaidFees` in week 2, one week earlier than if week 1
 * had been collected cleanly. Softening that would mean recording WHY a week went
 * unpaid on the groom row, which is a schema change and a ruling; it is not smuggled
 * in here.
 *
 * @param {string} userId
 * @param {Array<{groom: Object, salary: number}>} unpaid - the grooms whose fee this
 *   pay week's transaction failed to take
 * @param {Date} payWeekStart
 * @param {Error} cause - the throw that aborted the fee transaction, for the log
 * @returns {Promise<{recorded: number, graced: number}>} `recorded` counts grooms
 *   whose uncollected week was written down; `graced` counts the subset that newly
 *   stopped working because of it.
 */
export async function recordUncollectedFees(userId, unpaid, payWeekStart, cause) {
  const outcome = { recorded: 0, graced: 0 };

  for (const { groom, salary } of unpaid) {
    try {
      const marked = await prisma.$transaction(async tx => {
        // The same lock and the same User-before-staff write order as the grace path
        // above, for the reasons in that docblock's LOCK AND WRITE ORDER section.
        await acquirePayWeekLockTx(tx, userId, payWeekStart);

        if (groom.feeUnpaidSince === null || groom.feeUnpaidSince === undefined) {
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
            // Equoria-bgdfb: the pay week this row records — see the note in
            // handleUnpaidFees. This week is OWED, and a later collection settles it.
            paymentDate: payWeekStart,
            paymentType: 'weekly_salary',
            // A status of its own, because "we could not take the money" is not the
            // same event as "the player did not have it", and a reader of this table
            // has to be able to tell them apart.
            status: 'missed_collection_error',
          },
        });
        return entered;
      });

      outcome.recorded++;
      if (marked.entered) {
        finalizeNotificationAfterCommit(
          userId,
          GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
          marked.notificationPayload,
        );
        outcome.graced++;
      }
      logger.error(
        `[groomSalaryService] Groom ${groom.name} (${groom.id}) fee of $${salary} for user ` +
          `${userId} could NOT be collected for pay week ${payWeekStart.toISOString()}: ` +
          `${cause?.message ?? 'unknown error'}. The week is recorded as uncollected and the ` +
          "groom cannot work; not released, because the fault was not the player's.",
      );
    } catch (error) {
      // The caller has already recorded this user as failed. Naming the groom whose
      // week could not even be written down is the most this level can honestly do;
      // one groom must not stop the rest of the staff being recorded.
      logger.error(
        `[groomSalaryService] Failed to record the uncollected fee for groom ${groom.id} ` +
          `(user ${userId}): ${error.message}`,
      );
    }
  }

  return outcome;
}

export default { handleUnpaidFees, recordUncollectedFees };
