/**
 * The owner's tools for a quarantined show (Equoria-ehlbj, Equoria-yqi49; owner
 * rulings 2026-10-23 q29, q30, q41).
 *
 * A show is quarantined after three failed executions (the reaper, Equoria-
 * c7mx0.1) or when its half-settled payout cannot be finished after three
 * nightly tries (Equoria-o1vns). Only the Owner sees it. Her tools:
 *
 *   - Diagnose (showQuarantineDiagnosis.mjs): a plain-text report she copies
 *     and hands to Claude Code or Codex.
 *   - testRunQuarantinedShow: runs the REAL settlement inside a transaction that
 *     is always rolled back, and reports what would happen: placements, prizes,
 *     entry fees, the coin count check, or the error. The result is recorded
 *     (staff action log) with the commit the server runs.
 *   - runQuarantinedShow: allowed only when the latest tool use on the show is a
 *     passed test run on the commit the server runs now, and the show is still
 *     exactly as it was tested. Settles once, in ONE transaction: the first
 *     write flips quarantined -> completed (a guarded updateMany), so a second
 *     run or a concurrent one finds nothing to claim. Coins are counted before
 *     and after; a mismatch aborts and rolls everything back. A failure leaves
 *     the show quarantined and is added to the diagnosis.
 *
 * Two kinds of quarantined show, told apart by what the show already did:
 *   - unexecuted: crashed before it paid anyone (no executedAt, no results). The
 *     staged ordering is replayed; with none usable it is scored fresh at test
 *     run time and staged then (the only write a test run keeps), so Run Show
 *     pays exactly the placings she saw instead of rolling luck again.
 *   - half-settled: it was 'completed' and paid some placings. Only the staged
 *     placements with no result row are paid, like the nightly re-drive.
 */

import { createHash } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import logger from '../../../utils/logger.mjs';
import { recordStaffActionTx, recordStaffFailure } from '../../staff/index.mjs';
import { systemAccountBurn, systemAccountShowEscrow } from '../../economy/index.mjs';
import { refundUnpaidPrizeShareInTx, settleShowFeeEscrowInTx } from './showEscrowTx.mjs';
import { announceSettledEntry, settleEntryInTx } from './showExecutionService.mjs';
import { scoreOrdering, scoringHorseSelect } from './showOrdering.mjs';
import {
  clearStagedOrdering,
  planPlacementPayouts,
  readRecoverableOrdering,
} from './showSettlementRecovery.mjs';
import { readStagedOrdering } from '../services/competitionScoring.mjs';
import { recordShowFailure } from './showFailureLog.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';

/** The one owner-only capability behind every quarantine tool. */
export const quarantineResolveCapability = 'shows.quarantine.resolve';

/** The `after.action` of the two recorded tool uses. */
export const testRunAction = 'testRun';
export const runShowAction = 'runShow';

/** A settlement of a whole field in one transaction is allowed this long. */
const settlementTimeoutMs = 120_000;

/** Thrown inside a test run's transaction so that it always rolls back. */
const rollbackTestRun = Symbol('rollbackTestRun');

function refusal(message, statusCode, code) {
  const error = new AppError(message, statusCode);
  error.code = code;
  return error;
}

export async function loadQuarantinedShow(client, showId) {
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

/** The digest of what a plan pays, so Run Show only runs what was tested. */
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

/** Every account the settlement can pay: the placings' owners and the host. */
function settlementUserIds(show, plan) {
  const userIds = new Set(plan.pending.map(p => p.staged.userId));
  if (show.createdByUserId) {
    userIds.add(show.createdByUserId);
  }
  return [...userIds].sort();
}

/** Lock every row the settlement writes or counts (lock order: User, Horse, then system accounts). */
async function lockSettlementRows(tx, userIds, plan) {
  for (const id of userIds) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
  }
  for (const horseId of plan.pending.map(p => p.staged.horseId).sort((a, b) => a - b)) {
    await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;
  }
  for (const name of [systemAccountBurn, systemAccountShowEscrow].sort()) {
    await tx.$queryRaw`SELECT "name" FROM "system_accounts" WHERE "name" = ${name} FOR UPDATE`;
  }
}

/** The coins the settlement can move: the accounts it pays and the escrow and burn accounts. */
async function countCoins(tx, userIds, showId) {
  const [users, accounts, show] = await Promise.all([
    tx.user.findMany({ where: { id: { in: userIds } }, select: { money: true } }),
    tx.systemAccount.findMany({
      where: { name: { in: [systemAccountShowEscrow, systemAccountBurn] } },
      select: { name: true, balance: true },
    }),
    tx.show.findUnique({ where: { id: showId }, select: { prizeEscrow: true, feeEscrow: true } }),
  ]);
  const balance = name => accounts.find(a => a.name === name)?.balance ?? 0;
  return {
    players: users.reduce((sum, u) => sum + u.money, 0),
    escrowAccount: balance(systemAccountShowEscrow),
    burnAccount: balance(systemAccountBurn),
    showEscrow: show.prizeEscrow + show.feeEscrow,
  };
}

/**
 * Coins in = coins out: the total across the paid accounts, the escrow account
 * and the burn account is unchanged, and the escrow account lost exactly what
 * this show's escrow columns lost.
 */
function checkConservation(before, after) {
  const total = c => c.players + c.escrowAccount + c.burnAccount;
  const escrowOut = before.escrowAccount - after.escrowAccount;
  const showEscrowOut = before.showEscrow - after.showEscrow;
  const balanced = total(before) === total(after) && escrowOut === showEscrowOut;
  return {
    balanced,
    coinsIn: escrowOut,
    coinsOut: after.players - before.players + (after.burnAccount - before.burnAccount),
    showEscrowOut,
  };
}

/**
 * The settlement both tools run, inside the caller's transaction.
 *
 * @param {object} tx
 * @param {number} showId
 * @param {{ expectedDigest?: string, now: Date, statGainRng?: () => number,
 *   afterSettle?: (tx: object) => Promise<void> }} options `afterSettle` is a test
 *   seam that runs after the payouts and before the coin count.
 */
async function settleQuarantinedInTx(
  tx,
  showId,
  { expectedDigest, now, statGainRng, afterSettle },
) {
  const live = await loadQuarantinedShow(tx, showId);
  const plan = planQuarantinedSettlement(live);
  if (!plan.ordering) {
    throw refusal(
      'The staged placements of this show cannot be read. Use Diagnose and hand the report to Claude Code or Codex.',
      422,
      'stagedOrderingUnreadable',
    );
  }
  const digest = planDigest(live, plan);
  if (expectedDigest !== undefined && digest !== expectedDigest) {
    throw refusal('The show changed since its test run. Test run it again.', 409, 'testRunStale');
  }
  // The guard: only one run can flip quarantined -> completed.
  const claimed = await tx.show.updateMany({
    where: { id: showId, status: 'quarantined' },
    data: { status: 'completed', executedAt: live.executedAt ?? now, claimedAt: null },
  });
  if (claimed.count !== 1) {
    throw refusal('This show was already run', 409, 'showNotQuarantined');
  }
  const userIds = settlementUserIds(live, plan);
  await lockSettlementRows(tx, userIds, plan);
  const coinsBefore = await countCoins(tx, userIds, showId);

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
  if (afterSettle) {
    await afterSettle(tx);
  }

  const conservation = checkConservation(coinsBefore, await countCoins(tx, userIds, showId));
  if (!conservation.balanced) {
    const error = new Error(
      `Coin count mismatch: ${conservation.coinsIn} coins left escrow (${conservation.showEscrowOut} from this show) but ${conservation.coinsOut} reached players or the burn account`,
    );
    error.code = 'conservationMismatch';
    throw error;
  }
  return { live, plan, digest, paidByHorse, conservation };
}

/** What a settlement did, in the shape the owner's page shows. */
async function describeSettlement({ live, plan, paidByHorse, conservation }, client) {
  const owners = await client.user.findMany({
    where: { id: { in: [...new Set(plan.pending.map(p => p.staged.userId))] } },
    select: { id: true, username: true },
  });
  const ownerNames = new Map(owners.map(u => [u.id, u.username]));
  return {
    name: live.name,
    kind: plan.kind,
    attempts: live.executionAttempts,
    entryCount: live.entries.length,
    placements: plan.pending.map(({ staged }) => ({
      placement: staged.placement,
      horseId: staged.horseId,
      horseName: staged.horseName,
      ownerName: ownerNames.get(staged.userId) ?? null,
      score: staged.score,
      prize: paidByHorse.get(staged.horseId) ?? 0,
    })),
    prizeToPlacings: [...paidByHorse.values()].reduce((sum, paid) => sum + paid, 0),
    unpaidPrizeShareToHost: plan.unpaidPrizeShare + plan.prizeRefund,
    entryFeesToHost: plan.feesToCreator,
    coinsIn: conservation.coinsIn,
    coinsOut: conservation.coinsOut,
  };
}

/** Record a failed tool use: in the staff action log, and in the show's failures. */
async function recordToolFailure(showId, actor, action, error) {
  const commitSha = deployedCommitSha();
  await recordShowFailure(showId, { source: action, error });
  await recordStaffFailure({
    actorId: actor.id,
    actorRole: actor.role,
    capability: quarantineResolveCapability,
    targetType: 'show',
    targetId: String(showId),
    after: { action, commitSha },
    error: error.message,
  }).catch(logError =>
    logger.error(`[showQuarantineResolution] Could not record the failure: ${logError.message}`),
  );
}

/**
 * Stage a fresh scoring for an unexecuted show with no usable ordering, so the
 * test run and Run Show settle the same placings. Guarded on 'quarantined'.
 */
async function stageOrderingIfMissing(showId, { scoreRng, now }) {
  const show = await loadQuarantinedShow(prisma, showId);
  const plan = planQuarantinedSettlement(show);
  if (plan.kind !== 'unexecuted' || plan.ordering) {
    return false;
  }
  const ordering = await scoreOrdering(show, show.entries, scoreRng, now);
  const staged = await prisma.show.updateMany({
    where: { id: showId, status: 'quarantined' },
    data: { stagedOrdering: ordering },
  });
  if (staged.count !== 1) {
    throw refusal('This show is no longer quarantined', 409, 'showNotQuarantined');
  }
  return true;
}

/**
 * Test run: the real settlement, in a transaction that is always rolled back.
 *
 * @param {number} showId
 * @param {{ actor: { id: string, role: string }, now?: Date, scoreRng?: () => number,
 *   statGainRng?: () => number, afterSettle?: (tx: object) => Promise<void> }} params
 * @returns {Promise<object>} `{ passed: true, ... }` with what would happen, or
 *   `{ passed: false, error }`. Refusals (not found, not quarantined, unreadable
 *   placements) are thrown.
 */
export async function testRunQuarantinedShow(
  showId,
  { actor, now = new Date(), scoreRng, statGainRng, afterSettle },
) {
  const stagedNow = await stageOrderingIfMissing(showId, { scoreRng, now });
  const commitSha = deployedCommitSha();
  let outcome = null;
  try {
    await prisma.$transaction(
      async tx => {
        const settled = await settleQuarantinedInTx(tx, showId, { now, statGainRng, afterSettle });
        outcome = { settled, described: await describeSettlement(settled, tx) };
        throw rollbackTestRun;
      },
      { timeout: settlementTimeoutMs, maxWait: 10_000 },
    );
  } catch (error) {
    if (error !== rollbackTestRun) {
      if (AppError.isAppError(error)) {
        throw error;
      }
      logger.error(
        `[showQuarantineResolution] Test run of show ${showId} failed: ${error.message}`,
      );
      await recordToolFailure(showId, actor, testRunAction, error);
      return { showId, passed: false, error: error.message, commitSha, stagedNow };
    }
  }
  const testedAt = new Date();
  await recordStaffActionTx(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    capability: quarantineResolveCapability,
    targetType: 'show',
    targetId: String(showId),
    after: {
      action: testRunAction,
      commitSha,
      testedAt: testedAt.toISOString(),
      digest: outcome.settled.digest,
      prizeToPlacings: outcome.described.prizeToPlacings,
      entryFeesToHost: outcome.described.entryFeesToHost,
    },
  });
  return {
    showId,
    passed: true,
    stagedNow,
    commitSha,
    testedAt: testedAt.toISOString(),
    ...outcome.described,
  };
}

/** The latest tool use on a show, or null. */
export function latestToolUse(showId, client = prisma) {
  return client.staffActionLog.findFirst({
    where: {
      capability: quarantineResolveCapability,
      targetType: 'show',
      targetId: String(showId),
    },
    orderBy: { id: 'desc' },
    select: { id: true, outcome: true, after: true, createdAt: true },
  });
}

/** Refuse unless the latest tool use is a passed test run on the commit running now. */
async function requireFreshTestRun(showId) {
  const last = await latestToolUse(showId);
  const after = last?.after && typeof last.after === 'object' ? last.after : {};
  if (!last || after.action !== testRunAction || last.outcome !== 'succeeded') {
    throw refusal(
      'Test run this show first; Run Show unlocks when it passes.',
      409,
      'testRunRequired',
    );
  }
  if ((after.commitSha ?? null) !== deployedCommitSha()) {
    throw refusal(
      'The game was updated since the last test run. Test run it again.',
      409,
      'testRunStale',
    );
  }
  return after.digest;
}

/**
 * Run Show: settle the quarantined show once, in one transaction.
 *
 * @param {number} showId
 * @param {{ actor: { id: string, role: string }, now?: Date, statGainRng?: () => number,
 *   afterSettle?: (tx: object) => Promise<void> }} params
 * @returns {Promise<{ showId: number, status: 'completed', settled: number }>}
 */
export async function runQuarantinedShow(
  showId,
  { actor, now = new Date(), statGainRng, afterSettle },
) {
  await loadQuarantinedShow(prisma, showId);
  const expectedDigest = await requireFreshTestRun(showId);

  let settled;
  try {
    settled = await prisma.$transaction(
      async tx => {
        const result = await settleQuarantinedInTx(tx, showId, {
          expectedDigest,
          now,
          statGainRng,
          afterSettle,
        });
        await recordStaffActionTx(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          capability: quarantineResolveCapability,
          targetType: 'show',
          targetId: String(showId),
          before: {
            status: 'quarantined',
            executionAttempts: result.live.executionAttempts,
            kind: result.plan.kind,
          },
          after: {
            action: runShowAction,
            status: 'completed',
            commitSha: deployedCommitSha(),
            settledPlacements: result.plan.pending.map(p => ({
              placement: p.staged.placement,
              horseId: p.staged.horseId,
              prize: result.paidByHorse.get(p.staged.horseId),
            })),
            entryFeesToHost: result.plan.feesToCreator,
            coinsIn: result.conservation.coinsIn,
            coinsOut: result.conservation.coinsOut,
            digest: result.digest,
          },
        });
        return result;
      },
      { timeout: settlementTimeoutMs, maxWait: 10_000 },
    );
  } catch (error) {
    if (AppError.isAppError(error)) {
      throw error;
    }
    logger.error(`[showQuarantineResolution] Show ${showId} did not settle: ${error.message}`);
    await recordToolFailure(showId, actor, runShowAction, error);
    throw refusal(
      `The show did not settle and nothing was changed: ${error.message}`,
      500,
      'settlementFailed',
    );
  }

  // Committed. Caches and notifications are fail-soft, outside the transaction.
  for (const { staged } of settled.plan.pending) {
    await announceSettledEntry(settled.live, staged, settled.paidByHorse.get(staged.horseId));
  }
  return { showId, status: 'completed', settled: settled.plan.pending.length };
}
