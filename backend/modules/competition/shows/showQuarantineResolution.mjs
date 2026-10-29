/**
 * The owner's tools for a quarantined show (Equoria-ehlbj, owner rulings
 * 2026-10-23 q29, q30, q41).
 *
 * A show is quarantined after three failed executions (the reaper, Equoria-
 * c7mx0.1) or when its half-settled payout cannot be finished after three
 * nightly tries (Equoria-o1vns). Only the Owner sees it. Three actions:
 *
 *   - diagnoseQuarantinedShow: one export she can hand to Claude Code or Codex:
 *     the show, its entries, the staged placements, the attempt count, the last
 *     errors the cron records hold and the show's ledger rows. Nothing about the
 *     game is redacted; no secret is in it (no email, password hash or token).
 *   - previewQuarantinedShow: computes placements and prize money and moves
 *     nothing. It returns a `previewDigest` naming exactly what it computed.
 *   - runQuarantinedShow: settles the show once, in ONE transaction, only if the
 *     show is still quarantined and the digest still matches what she saw. The
 *     first statement flips quarantined -> completed (a guarded updateMany), so a
 *     second run, or a concurrent one, finds nothing to claim and changes
 *     nothing. The staff audit record commits with the settlement.
 *
 * Two kinds of quarantined show, told apart by what the show already did:
 *   - unexecuted: crashed before it paid anyone (no executedAt, no results). The
 *     staged ordering is replayed; with none usable it is scored fresh at
 *     preview time and staged then, so the confirm replays what she saw.
 *   - half-settled: it was 'completed' and paid some placings. Only the staged
 *     placements with no result row are paid, like the nightly re-drive.
 */

import { createHash } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import logger from '../../../utils/logger.mjs';
import { recordStaffActionTx, recordStaffFailure } from '../../staff/index.mjs';
import { refundUnpaidPrizeShareInTx, settleShowFeeEscrowInTx } from './showEscrowTx.mjs';
import { announceSettledEntry, settleEntryInTx } from './showExecutionService.mjs';
import { scoreOrdering, scoringHorseSelect } from './showOrdering.mjs';
import {
  clearStagedOrdering,
  planPlacementPayouts,
  readRecoverableOrdering,
} from './showSettlementRecovery.mjs';
import { readStagedOrdering } from '../services/competitionScoring.mjs';

/** The one owner-only capability behind every quarantine tool. */
export const quarantineResolveCapability = 'shows.quarantine.resolve';

/** A settlement of a whole field in one transaction is allowed this long. */
const settlementTimeoutMs = 120_000;

/** How many failed cron runs the diagnosis carries. */
const diagnosisCronRuns = 10;

/** Cron jobs whose records can hold a quarantined show's errors. */
const showCronJobNames = ['showExecutionReaper', 'nightlyShowExecution'];

function refusal(message, statusCode, code) {
  const error = new AppError(message, statusCode);
  error.code = code;
  return error;
}

async function loadQuarantinedShow(client, showId) {
  const show = await client.show.findUnique({
    where: { id: showId },
    include: {
      entries: { include: { horse: { select: scoringHorseSelect } } },
      competitionResults: { select: { horseId: true } },
    },
  });
  if (!show) {
    throw refusal('Show not found', 404, 'showNotFound');
  }
  if (show.status !== 'quarantined') {
    throw refusal('This show is not quarantined', 409, 'showNotQuarantined');
  }
  return show;
}

/**
 * What settling this show would do, from the show as read. Pure over its input.
 *
 * @returns {{ kind: string, ordering: Array|null, pending: Array<{ staged: object, prize: number }>,
 *   unpaidPrizeShare: number, prizeRefund: number, feesToCreator: number }}
 */
export function planQuarantinedSettlement(show) {
  const results = show.competitionResults ?? [];
  const kind = show.executedAt || results.length > 0 ? 'halfSettled' : 'unexecuted';
  const base = { kind, prizeRefund: 0, feesToCreator: show.feeEscrow };
  if (kind === 'halfSettled') {
    const ordering = readRecoverableOrdering(show);
    if (!ordering) {
      return { ...base, ordering: null, pending: [], unpaidPrizeShare: 0 };
    }
    // An entrant erased since the run has no entry left to pay.
    const stillEntered = new Set(show.entries.map(e => e.horseId));
    const skipped = new Set(results.map(r => r.horseId));
    for (const staged of ordering) {
      if (!stillEntered.has(staged.horseId)) {
        skipped.add(staged.horseId);
      }
    }
    return { ...base, ordering, ...planPlacementPayouts(show, ordering, skipped) };
  }
  if (show.entries.length === 0) {
    // Nobody entered: the whole prize goes back to the host, like the executor.
    return {
      ...base,
      ordering: [],
      pending: [],
      unpaidPrizeShare: 0,
      prizeRefund: show.prizeEscrow,
    };
  }
  const ordering = readStagedOrdering(show, show.entries);
  return {
    ...base,
    ordering,
    ...(ordering
      ? planPlacementPayouts(show, ordering, new Set())
      : { pending: [], unpaidPrizeShare: 0 }),
  };
}

/** The digest of what a plan pays, so a confirm can only run what was previewed. */
function planDigest(show, plan) {
  const payload = JSON.stringify({
    showId: show.id,
    kind: plan.kind,
    placements: plan.pending.map(p => [p.staged.horseId, p.staged.placement, p.prize]),
    unpaidPrizeShare: plan.unpaidPrizeShare,
    prizeRefund: plan.prizeRefund,
    feesToCreator: plan.feesToCreator,
    prizeEscrow: show.prizeEscrow,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Step 1 of Run Show: compute placements and prize money; move nothing.
 *
 * Only an unexecuted show with no usable staged ordering is touched, and only
 * its staging column: the fresh scoring is staged (guarded on 'quarantined') so
 * the confirm replays this very ordering instead of rolling luck again.
 *
 * @param {number} showId
 * @param {{ scoreRng?: () => number, now?: Date }} [options] test seams
 */
export async function previewQuarantinedShow(showId, { scoreRng, now = new Date() } = {}) {
  let show = await loadQuarantinedShow(prisma, showId);
  let plan = planQuarantinedSettlement(show);
  let stagedNow = false;
  if (plan.kind === 'unexecuted' && !plan.ordering) {
    const ordering = await scoreOrdering(show, show.entries, scoreRng, now);
    const staged = await prisma.show.updateMany({
      where: { id: showId, status: 'quarantined' },
      data: { stagedOrdering: ordering },
    });
    if (staged.count !== 1) {
      throw refusal('This show is no longer quarantined', 409, 'showNotQuarantined');
    }
    stagedNow = true;
    show = await loadQuarantinedShow(prisma, showId);
    plan = planQuarantinedSettlement(show);
  }
  if (!plan.ordering) {
    throw refusal(
      'The staged placements of this show cannot be read. Use Diagnose and hand the export to Claude Code or Codex.',
      422,
      'stagedOrderingUnreadable',
    );
  }
  const owners = await prisma.user.findMany({
    where: { id: { in: [...new Set(plan.pending.map(p => p.staged.userId))] } },
    select: { id: true, username: true },
  });
  const ownerNames = new Map(owners.map(u => [u.id, u.username]));
  return {
    showId,
    name: show.name,
    kind: plan.kind,
    stagedNow,
    attempts: show.executionAttempts,
    entryCount: show.entries.length,
    placements: plan.pending.map(({ staged, prize }) => ({
      placement: staged.placement,
      horseId: staged.horseId,
      horseName: staged.horseName,
      ownerId: staged.userId,
      ownerName: ownerNames.get(staged.userId) ?? null,
      score: staged.score,
      prize,
    })),
    prizeToPlacings: plan.pending.reduce((sum, p) => sum + p.prize, 0),
    unpaidPrizeShareToHost: plan.unpaidPrizeShare + plan.prizeRefund,
    entryFeesToHost: plan.feesToCreator,
    previewDigest: planDigest(show, plan),
  };
}

/** Lock every account and horse the settlement writes, ascending (lock order). */
async function lockSettlementRows(tx, show, plan) {
  const userIds = new Set(plan.pending.map(p => p.staged.userId));
  if (show.createdByUserId) {
    userIds.add(show.createdByUserId);
  }
  for (const id of [...userIds].sort()) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
  }
  for (const horseId of plan.pending.map(p => p.staged.horseId).sort((a, b) => a - b)) {
    await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;
  }
}

/**
 * Step 2 of Run Show: settle the quarantined show once, in one transaction.
 *
 * @param {number} showId
 * @param {{ actor: { id: string, role: string }, previewDigest: string, now?: Date, statGainRng?: () => number }} params
 * @returns {Promise<{ showId: number, status: 'completed', settled: number }>}
 */
export async function runQuarantinedShow(
  showId,
  { actor, previewDigest, now = new Date(), statGainRng },
) {
  if (typeof previewDigest !== 'string' || previewDigest === '') {
    throw refusal('Preview this show first, then confirm.', 400, 'previewRequired');
  }
  const before = await loadQuarantinedShow(prisma, showId);
  const beforePlan = planQuarantinedSettlement(before);
  if (!beforePlan.ordering) {
    throw refusal('Preview this show first, then confirm.', 409, 'previewRequired');
  }
  if (planDigest(before, beforePlan) !== previewDigest) {
    throw refusal('The show changed since the preview. Preview it again.', 409, 'previewStale');
  }

  let settledPlan;
  try {
    settledPlan = await prisma.$transaction(
      async tx => {
        // What is paid is exactly what she previewed: the same read, plan and digest,
        // taken before the claim (the claim stamps executedAt, which would change
        // the show's kind).
        const live = await loadQuarantinedShow(tx, showId);
        const plan = planQuarantinedSettlement(live);
        if (!plan.ordering || planDigest(live, plan) !== previewDigest) {
          throw refusal(
            'The show changed since the preview. Preview it again.',
            409,
            'previewStale',
          );
        }
        // The guard: only one run can flip quarantined -> completed.
        const claimed = await tx.show.updateMany({
          where: { id: showId, status: 'quarantined' },
          data: { status: 'completed', executedAt: before.executedAt ?? now, claimedAt: null },
        });
        if (claimed.count !== 1) {
          throw refusal('This show was already run', 409, 'showNotQuarantined');
        }
        await lockSettlementRows(tx, live, plan);
        // Equoria-law5w: what each placing was really paid (escrow only).
        const paidByHorse = new Map();
        for (const { staged, prize } of plan.pending) {
          const paid = await settleEntryInTx(tx, live, staged, {
            prize,
            unpaidPrizeShare: plan.unpaidPrizeShare,
            now,
            statGainRng,
          });
          paidByHorse.set(staged.horseId, paid);
        }
        if (plan.prizeRefund > 0) {
          await refundUnpaidPrizeShareInTx(tx, {
            showId,
            creatorId: live.createdByUserId,
            amount: plan.prizeRefund,
          });
        }
        await settleShowFeeEscrowInTx(tx, showId);
        await clearStagedOrdering(showId, tx);
        await recordStaffActionTx(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          capability: quarantineResolveCapability,
          targetType: 'show',
          targetId: String(showId),
          before: {
            status: 'quarantined',
            executionAttempts: live.executionAttempts,
            kind: plan.kind,
          },
          after: {
            status: 'completed',
            settledPlacements: plan.pending.map(p => ({
              placement: p.staged.placement,
              horseId: p.staged.horseId,
              prize: paidByHorse.get(p.staged.horseId),
            })),
            entryFeesToHost: plan.feesToCreator,
            previewDigest,
          },
        });
        return { plan, live, paidByHorse };
      },
      { timeout: settlementTimeoutMs, maxWait: 10_000 },
    );
  } catch (error) {
    if (AppError.isAppError(error)) {
      throw error;
    }
    logger.error(`[showQuarantineResolution] Show ${showId} did not settle: ${error.message}`);
    await recordStaffFailure({
      actorId: actor.id,
      actorRole: actor.role,
      capability: quarantineResolveCapability,
      targetType: 'show',
      targetId: String(showId),
      error: error.message,
    }).catch(logError =>
      logger.error(`[showQuarantineResolution] Could not record the failure: ${logError.message}`),
    );
    throw refusal(
      `The show did not settle and nothing was changed: ${error.message}`,
      500,
      'settlementFailed',
    );
  }

  // Committed. Caches and notifications are fail-soft, outside the transaction.
  for (const { staged } of settledPlan.plan.pending) {
    await announceSettledEntry(
      settledPlan.live,
      staged,
      settledPlan.paidByHorse.get(staged.horseId),
    );
  }
  return { showId, status: 'completed', settled: settledPlan.plan.pending.length };
}

/**
 * The export the owner hands to Claude Code or Codex. Read-only. Nothing about
 * the game is redacted; accounts appear as id and username only.
 *
 * @param {number} showId
 * @returns {Promise<object>}
 */
export async function diagnoseQuarantinedShow(showId) {
  const show = await loadQuarantinedShow(prisma, showId);
  const plan = planQuarantinedSettlement(show);
  const [results, cronRuns, ledger, escrowAccount] = await Promise.all([
    // Owner-only export (shows.quarantine.view), so it deliberately names
    // scoreInputs: the Owner may see score breakdowns (q01, Equoria-4q02c).
    prisma.competitionResult.findMany({
      where: { showId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        score: true,
        placement: true,
        discipline: true,
        runDate: true,
        showName: true,
        prizeWon: true,
        statGains: true,
        horsePointsAwarded: true,
        scoreInputs: true,
        horseId: true,
        showId: true,
        createdAt: true,
        viewedAt: true,
      },
    }),
    prisma.cronRunLog.findMany({
      where: { jobName: { in: showCronJobNames }, status: 'error' },
      orderBy: { startedAt: 'desc' },
      take: diagnosisCronRuns,
      select: {
        id: true,
        jobName: true,
        startedAt: true,
        finishedAt: true,
        errorsCount: true,
        errorMessage: true,
        summary: true,
      },
    }),
    prisma.userTransaction.findMany({
      where: {
        OR: [
          { metadata: { path: ['showId'], equals: showId } },
          ...(show.createdByUserId
            ? [
                {
                  userId: show.createdByUserId,
                  category: 'showCreatePrizeEscrow',
                  description: { contains: `"${show.name}"` },
                },
              ]
            : []),
        ],
      },
      orderBy: { id: 'asc' },
    }),
    prisma.systemAccount.findUnique({ where: { name: 'showEscrow' } }),
  ]);
  const { entries, competitionResults: _resultStubs, ...showRow } = show;
  return {
    format: 'equoria-quarantined-show-diagnosis/1',
    exportedAt: new Date().toISOString(),
    show: showRow,
    kind: plan.kind,
    attempts: show.executionAttempts,
    entries: entries.map(({ horse, ...entry }) => ({
      ...entry,
      horse: { id: horse.id, name: horse.name, userId: horse.userId },
    })),
    stagedPlacements: show.stagedOrdering,
    results,
    settlementPlan: {
      orderingReadable: plan.ordering !== null,
      placementsStillToPay: plan.pending.map(p => ({
        placement: p.staged.placement,
        horseId: p.staged.horseId,
        prize: p.prize,
      })),
      unpaidPrizeShare: plan.unpaidPrizeShare,
      prizeRefund: plan.prizeRefund,
      entryFeesToHost: plan.feesToCreator,
    },
    lastCronErrors: cronRuns,
    ledger,
    showEscrowAccountBalance: escrowAccount?.balance ?? null,
  };
}
