/**
 * Show execution service — the overnight show executor (Epic BACKEND-A, BA-4).
 *
 * Equoria-q4uem.4 (WS4 S4, review M2): executeClosedShows and its private helper
 * clearStagedOrdering moved here VERBATIM from ./showController.mjs. Nothing else
 * changed: same (req, res) signature, same body, same log prefix. The barrel
 * (../index.mjs) exports it from this file; the nightly jobs
 * (services/jobs/impl/retentionMaintenance.mjs, showExecutionReaper.mjs) call it with
 * no req/res or a synthetic `{ body: { showIds } }`; POST /api/v1/shows/execute
 * (./showRoutes.mjs) wires it as the admin-triggered handler. HTTP controllers are
 * not domain capabilities (spec), which is why the executor is a service.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';
// Equoria-si69u: show money now routes through a named system-account escrow
// so creator account deletion can never sink entry fees mid-flight. See the
// si69u close note for the full design + the money-conservation sentinel.
import { SYSTEM_ACCOUNT_SHOW_ESCROW, debitSystemAccountOrThrow } from '../../economy/index.mjs';
// Equoria-8pb6w: the two escrow-touching transactions live in a sibling module
// (extracted for deterministic testability + file-size discipline).
import { refundUnpaidPrizeShareInTx, settleShowFeeEscrow } from './showEscrowTx.mjs';
import { settleDueConformationShows } from '../services/conformationShowService.mjs';
import {
  clearStagedOrdering,
  findPartiallySettledShowIds,
  planPlacementPayouts,
  readRecoverableOrdering,
  recordFailedSettlementAttempt,
} from './showSettlementRecovery.mjs';
// Equoria-c7mx0: scoring extracted verbatim to the shared scoring service;
// readStagedOrdering implements the 2026-07-06 staged-ordering replay contract.
import { readStagedOrdering } from '../services/competitionScoring.mjs';
// Equoria-ehlbj: the scoring helpers moved to ./showOrdering.mjs so the owner's
// quarantine tools score through the same code.
import { scoreOrdering, scoringHorseSelect } from './showOrdering.mjs';
// Equoria-oey96.4: horse XP / owner XP / stat gains — the executor's progression
// gap (it paid prize + rider XP but zero player/horse progression). Tx-aware helper
// so the awards run INSIDE the per-entry tx below without a nested transaction.
import { awardPlacementProgression } from '../services/competitionAwards.mjs';
import {
  buildRiddenResultRow,
  recordProgressionOnResult,
} from '../services/competitionResultRecord.mjs';
// Equoria-o26xc: sibling-fix of Equoria-pi4nk for the cron-driven executor.
// executeClosedShows previously never wrote competitionPlacement
// notifications — owners of winning horses got zero UI signal that their
// horses had placed. Mirrors the pi4nk pattern from enterAndRunShow:
// fire-and-forget OUTSIDE the prize-payout tx (fail-soft).
import { createNotification } from '../../../utils/notificationService.mjs';
import { recordRiddenResultTotals } from '../../../utils/monthlyTotals.mjs';
import { invalidateHorseXpCaches } from '../../horses/index.mjs';

// ── BA-4: Overnight show execution ────────────────────────────────────────────

/**
 * Settle one staged placement — a pure REPLAY of the ordering persisted at
 * claim time (Equoria-c7mx0): identity, score and placement come from the
 * staging, the prize from the staged placement through the untouched 50/30/20
 * slots. The competitionResult.create + escrow payout + (if 1st) unpaid-share
 * refund and firstWin milestone + rider stats + progression are ONE
 * $transaction (Equoria-koodu AC): if any leg fails (deadlock, connection drop,
 * server crash), the result row rolls back with it, so a result is never
 * recorded with its money unpaid. The placement notification stays OUTSIDE
 * the tx because it is fail-soft (existing contract — it must never block show
 * execution or undo a payout).
 */
export async function settleEntryInTx(
  tx,
  show,
  staged,
  { prize, unpaidPrizeShare, now, statGainRng },
) {
  const { horseId, userId, horseName, placement, riderId } = staged;

  // Create competition result (row shape owned by competitionResultRecord)
  await tx.competitionResult.create({
    data: buildRiddenResultRow({ show, staged, prize, now }),
  });

  // Equoria-si69u: pay the winner from SystemAccount[showEscrow]
  // (which was credited at createShow), decrement Show.prizeEscrow
  // by the same amount, and credit the winner's User.money. All in
  // the same tx so a failure in any leg rolls back the whole prize
  // payout and the competitionResult.create above.
  //
  // Backwards compat for the cohort of shows created BEFORE the
  // si69u migration (or for test fixtures that build a Show row
  // directly via prisma.show.create rather than through createShow):
  // those rows have prizeEscrow = 0 even though the prize was
  // notionally funded under the legacy "system implicitly mints
  // at payout" model. Detect that case via `show.prizeEscrow >=
  // prize` and skip the escrow debit. The winner is still paid
  // under the legacy path so in-flight shows can drain. New shows
  // always go through the escrow path.
  if (prize > 0) {
    if (show.prizeEscrow >= prize) {
      await debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, prize, {
        category: 'showPayoutPrize',
        description: `Prize payout for show ${show.id}, placement ${placement}`,
        linkedUserId: userId,
        metadata: { showId: show.id, placement },
      });
      await tx.show.update({
        where: { id: show.id },
        data: { prizeEscrow: { decrement: prize } },
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: { money: { increment: prize } },
    });
    // Equoria-xal4m: the horse's lifetime winnings (Horse.totalEarnings, read
    // by the earnings leaderboard and horse pages) grow with the same prize,
    // in the same tx, so totalEarnings == SUM(prizeWon) of its results.
    // User before Horse, as everywhere (lock order).
    await tx.horse.update({
      where: { id: horseId },
      data: { totalEarnings: { increment: prize } },
    });
  }
  if (placement === 1) {
    await refundUnpaidPrizeShareInTx(tx, {
      showId: show.id,
      creatorId: show.createdByUserId,
      amount: unpaidPrizeShare,
    });
  }

  // Set firstEverWin milestone if 1st place
  if (placement === 1) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const settings = user?.settings ?? {};
    const milestones = settings.milestones ?? {};
    if (!milestones.firstWin) {
      // Finding 1 (Equoria-6p398.1): `milestones` path only.
      await updateUserSettingsPaths(tx, userId, {
        set: { milestones: { ...milestones, firstWin: now.toISOString() } },
      });
    }
  }

  // Increment rider competition stats using the staged riderId (the
  // active assignment resolved at claim time — Equoria-5bkh).
  if (riderId) {
    await tx.rider.update({
      where: { id: riderId },
      data: {
        totalCompetitions: { increment: 1 },
        ...(placement === 1 ? { totalWins: { increment: 1 } } : {}),
      },
    });
  }

  // Equoria-oey96.4: award horse XP (ALL entrants) + owner XP & a
  // chance-gated stat gain (top-3) via tx-aware cores, INSIDE this tx — a
  // crash mid-award rolls back result+prize+XP together (AC5).
  // competitionResult.create stays the FIRST write so [showId,horseId]
  // uniqueness is the idempotency token; placement-at-END keeps lock order.
  const progression = await awardPlacementProgression(tx, {
    horseId,
    ownerId: userId,
    placementNumber: placement,
    discipline: show.discipline,
    horseName,
    showId: show.id,
    ...(statGainRng ? { rng: statGainRng } : {}),
  });
  // Equoria-q4uem.10 (owner ruling R6): the result records what it awarded.
  await recordProgressionOnResult(tx, { showId: show.id, horseId }, progression);
  // Equoria-y3nia: the Monthly boards, after the result create (a replay is refused first).
  await recordRiddenResultTotals(tx, { show, staged, prize, now });
}

/**
 * What follows a committed placement settlement (Equoria-ehlbj: split out of
 * settleEntry so the owner's single-transaction settlement can run it after its
 * commit). Fail-soft: neither the cache drop nor the notification may undo a payout.
 */
export async function announceSettledEntry(show, staged, prize) {
  const { horseId, userId, horseName, placement } = staged;

  // Equoria-7vhgr: the horse XP routes cache a horse's XP status and history
  // for 60s. The award above has committed, so drop them now and the owner sees
  // the new Horse Points at once. Fail-soft, like the notification below.
  try {
    await invalidateHorseXpCaches(horseId);
  } catch (cacheErr) {
    logger.error(
      `[showExecutionService] Failed to invalidate XP caches for horse ${horseId}: ${cacheErr.message}`,
    );
  }

  // Riders are fixed NPCs: no XP (Equoria-dea06) and no prestige from wins
  // (owner ruling 2026-10-22, Equoria-0d4wa).

  // Equoria-o26xc / sibling-fix of Equoria-pi4nk: fire a
  // competitionPlacement notification on every top-3 finish for the
  // cron-driven executor (the canonical post-toqet path). OUTSIDE the
  // tx and wrapped in try/catch — a notification-subsystem failure
  // must NEVER roll back the prize payout or block show execution.
  // Ordinal labels match the enterAndRunShow convention (`1st`/`2nd`/
  // `3rd`) so the frontend renders the same payload shape regardless
  // of which executor path produced the row.
  if (placement <= 3) {
    try {
      const placementLabel = placement === 1 ? '1st' : placement === 2 ? '2nd' : '3rd';
      await createNotification(userId, 'competitionPlacement', {
        horseName,
        placement: placementLabel,
        discipline: show.discipline,
        showName: show.name,
        prizeWon: prize,
      });
    } catch (notifErr) {
      logger.error(
        `[showController] Failed to create competitionPlacement notification for user ${userId} (horse ${horseId}): ${notifErr.message}`,
      );
    }
  }
}

async function settleEntry(show, staged, options) {
  await prisma.$transaction(tx => settleEntryInTx(tx, show, staged, options));
  await announceSettledEntry(show, staged, options.prize);
}

/**
 * The entries a claimed show settles, and the ordering to pay (Equoria-fzmiy).
 *
 * The ordering staged by the claim was scored from the entries read BEFORE it.
 * An entry transaction already inside the entry window when the show closed
 * can commit after that read and before the claim: its status-scoped guard
 * (Equoria-8pb6w) still saw 'open', so its fee was taken and its row created,
 * yet the snapshot never held it. Once the claim has committed that guard
 * refuses every later entry, so the entries read now are the final set. When
 * they differ from the staged ordering, the final set is scored and its
 * ordering replaces the staged one (nothing is paid until the 'completed'
 * write that follows, so no placement has been settled yet).
 *
 * @returns {Promise<{ entries: Array, stagedOrdering: Array }>}
 */
async function finalEntriesAndOrdering(show, claimedOrdering, scoreRng, now) {
  const finalEntries = await prisma.showEntry.findMany({
    where: { showId: show.id },
    select: { horseId: true },
  });
  const claimedHorseIds = new Set(claimedOrdering.map(s => s.horseId));
  const unchanged =
    finalEntries.length === claimedOrdering.length &&
    finalEntries.every(e => claimedHorseIds.has(e.horseId));
  if (unchanged) {
    return { entries: show.entries, stagedOrdering: claimedOrdering };
  }

  const entries = await prisma.showEntry.findMany({
    where: { showId: show.id },
    include: { horse: { select: scoringHorseSelect } },
  });
  const stagedOrdering = await scoreOrdering(show, entries, scoreRng, now);
  const restaged = await prisma.show.updateMany({
    where: { id: show.id, status: 'executing' },
    data: { stagedOrdering },
  });
  if (restaged.count !== 1) {
    throw new Error(`Show ${show.id} left 'executing' while its final entries were scored`);
  }
  logger.warn(
    `[showExecutionService] Show ${show.id}: entries changed between the read and the claim (${claimedOrdering.length} -> ${entries.length}); scored the final set`,
  );
  return { entries, stagedOrdering };
}

/**
 * Pay the staged placements not in `settledHorseIds`, settle the fee escrow,
 * and discard the staged ordering once nothing failed. Returns the errors of
 * the entries whose transaction rolled back.
 *
 * Equoria-wmwbr + Equoria-cmw85.1: entries settle ONE AT A TIME and each failure
 * is held, not fatal: a Promise.all fan-out filled the three-connection pool, and
 * its first rejection skipped the fee settlement with the show already
 * 'completed'. A failed entry's prize stays in escrow and the show keeps its
 * staged ordering; the next run re-drives it (Equoria-cmw85.2).
 */
async function payOutPlacements(show, stagedOrdering, settledHorseIds, { now, statGainRng }) {
  const { pending, unpaidPrizeShare } = planPlacementPayouts(show, stagedOrdering, settledHorseIds);
  const failures = [];
  for (const { staged, prize } of pending) {
    try {
      await settleEntry(show, staged, { prize, unpaidPrizeShare, now, statGainRng });
    } catch (error) {
      logger.error(
        `[showExecutionService] Show ${show.id}: settlement of horse ${staged.horseId} (placement ${staged.placement}) failed and rolled back: ${error.message}`,
      );
      failures.push(error);
    }
  }

  // Equoria-si69u: the fees are the creator's whatever became of the entries
  // (Equoria-wmwbr); a no-op once the escrow has drained (Equoria-8pb6w).
  await settleShowFeeEscrow(show.id);

  // Equoria-c7mx0: only a fully settled show discards its staged ordering.
  if (failures.length === 0) {
    await clearStagedOrdering(show.id);
  } else {
    // Equoria-o1vns: a run that left a placing unpaid is one failed try; the third quarantines.
    await recordFailedSettlementAttempt(show.id);
  }
  return failures;
}

/**
 * Finish a 'completed' show that still holds its staged ordering
 * (Equoria-cmw85.2): pay the staged placements with no result row. The result
 * row is the first write of an entry's own transaction, so a row means that
 * entry settled whole and the rest rolled back (or the process died), so each
 * is paid exactly once; the unique [showId, horseId] guard backstops a collision.
 * Returns `{ executed, failures }` like settleRiddenShow.
 */
async function recoverPartiallySettledShow(show, { now, statGainRng }) {
  const stagedOrdering = readRecoverableOrdering(show);
  if (!stagedOrdering) {
    await recordFailedSettlementAttempt(show.id); // Equoria-o1vns: a failed try like any other
    throw new Error(`Show ${show.id} is half-settled but its staged ordering is unreadable`);
  }
  const results = await prisma.competitionResult.findMany({
    where: { showId: show.id },
    select: { horseId: true },
  });
  const skipped = new Set(results.map(r => r.horseId));
  // An entrant erased since the run (horse deleted) has no entry left to pay.
  const stillEntered = new Set(show.entries.map(e => e.horseId));
  for (const staged of stagedOrdering) {
    if (!stillEntered.has(staged.horseId)) {
      skipped.add(staged.horseId);
    }
  }
  const unpaid = stagedOrdering.length - stagedOrdering.filter(s => skipped.has(s.horseId)).length;

  const failures = await payOutPlacements(show, stagedOrdering, skipped, { now, statGainRng });
  logger.info(
    `Recovered show ${show.name} (id=${show.id}): ${unpaid} unpaid, ${failures.length} failed`,
  );
  return { executed: unpaid > 0 && failures.length < unpaid, failures };
}

/**
 * Settle one due ridden show: claim it, replay (or score and stage) its
 * ordering, settle each entry, then settle its entry-fee escrow.
 *
 * Returns `{ executed, failures }`. `executed` is false when a concurrent
 * executor won the claim, and for a show nobody entered (counted that way
 * before too). `failures` holds the error of every entry whose settlement
 * transaction failed and rolled back (Equoria-wmwbr).
 */
async function settleRiddenShow(show, { now, scoreRng, statGainRng }) {
  // Equoria-c7mx0 (2026-07-06 approved decision): determine the ordering
  // to execute BEFORE claiming. A crashed prior claim leaves its scored
  // ordering persisted on the row (the reaper's release preserves it) and
  // it is replayed VERBATIM below — recovery pays exactly the placements
  // scored at the original claim, never a re-roll. NULL/invalid staging
  // (fresh show, or a stranding predating the staging migration) scores
  // fresh; readStagedOrdering carries the JSONB shape guards.
  const claimedOrdering =
    readStagedOrdering(show, show.entries) ??
    (await scoreOrdering(show, show.entries, scoreRng, now));

  // Equoria-dyj3y: ATOMICALLY claim the show. A conditional updateMany
  // scoped to the still-open status performs read-and-claim in a single
  // atomic DB statement: the first caller flips 'open' → 'executing'
  // (count === 1) and proceeds; a concurrent loser sees count === 0 and
  // skips (its wasted scoring pass is discarded with its claim) — this is
  // what prevents duplicate results / double pay. Equoria-c7mx0: the SAME
  // statement persists claimedAt + the scored ordering, so a persisted
  // 'executing' always carries the ordering its recovery must replay (or, if
  // an entry slipped in before the claim, one readStagedOrdering rejects as a
  // roster mismatch until finalEntriesAndOrdering restages it — Equoria-fzmiy).
  const claimed = await prisma.show.updateMany({
    where: { id: show.id, status: 'open' },
    data: { status: 'executing', claimedAt: now, stagedOrdering: claimedOrdering },
  });
  if (claimed.count !== 1) {
    logger.info(
      `Skipping show ${show.id} (${show.name}) — already claimed by a concurrent executor`,
    );
    return { executed: false, failures: [] };
  }

  const { entries, stagedOrdering } = await finalEntriesAndOrdering(
    show,
    claimedOrdering,
    scoreRng,
    now,
  );

  if (entries.length === 0) {
    // Equoria-w7fnz fix round 1 (owner ruling 2026-10-19): no entrants =>
    // the full prize escrow goes back to the creator, in the same tx as the
    // completion. The status-scoped claim (executing -> completed) and the
    // live prizeEscrow read make a re-run refund nothing more.
    await prisma.$transaction(async tx => {
      const completed = await tx.show.updateMany({
        where: { id: show.id, status: 'executing' },
        data: { status: 'completed', executedAt: now, claimedAt: null },
      });
      if (completed.count !== 1) {
        return;
      }
      const live = await tx.show.findUnique({
        where: { id: show.id },
        select: { prizeEscrow: true, createdByUserId: true },
      });
      await refundUnpaidPrizeShareInTx(tx, {
        showId: show.id,
        creatorId: live.createdByUserId,
        amount: live.prizeEscrow,
      });
    });
    await clearStagedOrdering(show.id);
    return { executed: false, failures: [] };
  }

  // Equoria-koodu: CLAIM-THEN-PROCESS. Mark the show 'completed' BEFORE paying
  // its entries, so the 'open' scan never re-runs it and cannot double-pay; the
  // @@unique([showId, horseId]) result guard backstops any bypass. stagedOrdering
  // outlives the payout phase: a show that ends with it still set is half-settled
  // and recoverPartiallySettledShow finishes it (Equoria-cmw85.2).
  await prisma.show.update({
    where: { id: show.id },
    data: { status: 'completed', executedAt: now, claimedAt: null },
  });

  const failures = await payOutPlacements(show, stagedOrdering, new Set(), { now, statGainRng });

  const failedNote = failures.length > 0 ? `, ${failures.length} failed to settle` : '';
  logger.info(
    `Executed show: ${show.name} (id=${show.id}), ${entries.length} entries${failedNote}`,
  );
  return { executed: true, failures };
}

/**
 * Executes due shows (closeDate <= now, 'open'), and finishes half-settled ones
 * (Equoria-cmw85.2): sets 'completed' and executedAt, awards prizes and XP, sets firstEverWin. Conformation shows settle first
 * on their own scorer (titles, no prize), isolated from the ridden batch (Equoria-mwjst):
 * each batch is attempted even if the other fails, and any failure is rethrown to cron.
 * Within the ridden batch each show is attempted even if an earlier one failed
 * (Equoria-wmwbr); every failure is logged and the first is rethrown.
 *
 * Called by the nightly cron (no req/res) or POST /api/v1/shows/execute (admin).
 *
 * Equoria-rsss0 (test-isolation): an OPTIONAL `req.body.showIds` array narrows the scan
 * to those ids (still gated on status 'open' AND closeDate <= now), so a test settles
 * only its own shows. Production callers pass no req, so the scan stays global.
 *
 * `options.statGainRng` and `options.scoreRng` (in-process callers only; the
 * HTTP route's third argument is Express's `next`, which carries no such
 * property) are handed to awardPlacementProgression as its stat-gain RNG and
 * to scoreShowEntries as its luck RNG, so a test can force the rolls. Omitted,
 * both use Math.random as before (Equoria-576c0 B3 review, B4a).
 */
export async function executeClosedShows(req, res, options) {
  const statGainRng = typeof options?.statGainRng === 'function' ? options.statGainRng : undefined;
  const scoreRng = typeof options?.scoreRng === 'function' ? options.scoreRng : undefined;
  try {
    const now = new Date();

    // Optional, test-only scoping filter (see fn doc). A valid array of
    // numeric ids narrows the scan; anything else (undefined, null, empty,
    // non-array, no numeric members) leaves the scan global — identical to
    // the pre-existing production behaviour.
    const rawShowIds = req?.body?.showIds;
    const scopedShowIds = Array.isArray(rawShowIds)
      ? rawShowIds.filter(id => Number.isInteger(id))
      : null;

    // Conformation first, failure held: a ridden failure below cannot strand these shows.
    const conformation = await settleDueConformationShows({ now, showIds: scopedShowIds }).then(
      executed => ({ executed }),
      error => ({ error }),
    );

    const where = { status: 'open', closeDate: { lte: now }, showType: { not: 'conformation' } };
    if (scopedShowIds && scopedShowIds.length > 0) {
      where.id = { in: scopedShowIds };
    }

    // Find all shows ready to execute
    const shows = await prisma.show.findMany({
      where,
      include: { entries: { include: { horse: { select: scoringHorseSelect } } } },
    });

    // Equoria-cmw85.2: shows an earlier run left half-settled are finished too.
    const recoverableIds = await findPartiallySettledShowIds({ now, showIds: scopedShowIds });
    const recoverable = recoverableIds.length
      ? await prisma.show.findMany({
          where: { id: { in: recoverableIds } },
          include: { entries: { select: { horseId: true } } },
        })
      : [];

    let totalExecuted = conformation.executed ?? 0;
    const failures = [];
    const batch = [
      ...shows.map(show => ({ show, settle: settleRiddenShow })),
      ...recoverable.map(show => ({ show, settle: recoverPartiallySettledShow })),
    ];
    for (const { show, settle } of batch) {
      try {
        const outcome = await settle(show, { now, scoreRng, statGainRng });
        totalExecuted += outcome.executed ? 1 : 0;
        failures.push(...outcome.failures);
      } catch (error) {
        // Equoria-wmwbr: one show's failure does not hold back the rest of the batch.
        logger.error(
          `[showExecutionService] Show ${show.id} (${show.name}) did not settle: ${error.message}`,
        );
        failures.push(error);
      }
    }

    if (conformation.error) {
      throw conformation.error; // the ridden batch ran; surface the held conformation failure
    }
    if (failures.length > 0) {
      throw failures[0]; // every failure is logged above; the run must still record as failed
    }

    const message = `Executed ${totalExecuted} show(s)`;
    logger.info(message);

    if (res) {
      return res.status(200).json({ success: true, data: { executed: totalExecuted, message } });
    }
  } catch (error) {
    logger.error('showController.executeClosedShows error:', error);
    if (res) {
      return res.status(500).json({ success: false, message: 'Execution failed' });
    }
    throw error; // cron/reaper callers: unfinished shows must record as a failure
  }
}
