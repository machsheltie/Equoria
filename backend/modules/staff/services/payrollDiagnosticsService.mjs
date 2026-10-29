/**
 * The owner's payroll diagnostics (Equoria-brh8c, owner ruling 2026-10-28 q158).
 *
 * Owner only (payroll.diagnose), behind the emailed staff check-in. She picks
 * groom or rider, searches by name, and sees every logged payroll failure of
 * that staff member (payrollFailureLog.mjs). Her tools, the same safeguards as
 * the held-show tools (Equoria-yqi49):
 *
 *   - Diagnose (payrollDiagnosis.mjs): a report to copy for Claude Code or Codex.
 *   - Test run: replays the failed pass for this one staff member inside a
 *     transaction that is always rolled back, and says what a re-run would do, or
 *     that it failed. Recorded in the staff action log with the deployed commit.
 *   - Re-run: allowed only when the newest tool use on this staff member is a
 *     passed test run of the same failure on the commit the server runs now, and
 *     the replay still does exactly what was tested. One transaction, all money in
 *     it; idempotent per staff member and pay week through the payroll guards, so
 *     a second re-run changes nothing. A failure is recorded and locks Re-run until
 *     a new test run passes.
 *
 * The replays themselves are the grooms and riders modules', reached through
 * payrollReplayPort.mjs.
 */

import { createHash } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import logger from '../../../utils/logger.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';
import {
  payrollFailureCounts,
  payrollStaffTypes,
  readPayrollFailure,
  readPayrollFailures,
  recordPayrollFailure,
  replayableSources,
} from './payrollFailureLog.mjs';
import { payrollReplay } from './payrollReplayPort.mjs';
import { recordStaffActionTx, recordStaffFailure } from './staffActionLogService.mjs';

/** The one owner-only capability behind every payroll diagnostics tool. */
export const payrollDiagnoseCapability = 'payroll.diagnose';

/** The `after.action` of the two recorded tool uses. */
export const payrollTestRunAction = 'testRun';
export const payrollRerunAction = 'rerun';

/** How many staff members a search lists. */
export const payrollSearchLimit = 25;

const replayTimeoutMs = 30_000;

/** Thrown inside a test run's transaction so that it always rolls back. */
const rollbackTestRun = Symbol('rollbackTestRun');

function refusal(message, statusCode, code) {
  const error = new AppError(message, statusCode);
  error.code = code;
  return error;
}

/** @returns {'groom'|'rider'} */
export function parseStaffType(value) {
  if (!payrollStaffTypes.includes(value)) {
    throw refusal('Choose groom or rider', 400, 'staffTypeInvalid');
  }
  return value;
}

const groomSelect = {
  id: true,
  name: true,
  starLevel: true,
  userId: true,
  retired: true,
  isActive: true,
  feeUnpaidSince: true,
  user: { select: { username: true } },
};
const riderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  starLevel: true,
  userId: true,
  retired: true,
  feeUnpaidSince: true,
  user: { select: { username: true } },
};

function describeStaff(staffType, row) {
  const name =
    staffType === 'groom' ? row.name : `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
  return {
    staffType,
    id: row.id,
    name,
    starLevel: row.starLevel,
    employerId: row.userId,
    employerName: row.user?.username ?? null,
    onStaff: row.userId !== null && !row.retired && row.isActive !== false,
    unpaidSince: row.feeUnpaidSince,
  };
}

/** One groom or rider as the owner's page shows them. Refuses when there is none. */
export async function loadPayrollStaff(staffType, staffId) {
  const row =
    staffType === 'groom'
      ? await prisma.groom.findUnique({ where: { id: staffId }, select: groomSelect })
      : await prisma.rider.findUnique({ where: { id: staffId }, select: riderSelect });
  if (!row) {
    throw refusal(`That ${staffType} is not there`, 404, 'staffNotFound');
  }
  return describeStaff(staffType, row);
}

/**
 * Search grooms or riders by name. With no name, the staff members with a logged
 * payroll failure, latest first.
 *
 * @param {'groom'|'rider'} staffType
 * @param {string} [query]
 */
export async function searchPayrollStaff(staffType, query = '') {
  const counts = await payrollFailureCounts(staffType);
  const text = typeof query === 'string' ? query.trim().slice(0, 60) : '';
  let rows;
  if (text === '') {
    const ids = [...counts.keys()].slice(0, payrollSearchLimit);
    rows =
      staffType === 'groom'
        ? await prisma.groom.findMany({ where: { id: { in: ids } }, select: groomSelect })
        : await prisma.rider.findMany({ where: { id: { in: ids } }, select: riderSelect });
    rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  } else {
    const contains = { contains: text, mode: 'insensitive' };
    rows =
      staffType === 'groom'
        ? await prisma.groom.findMany({
            where: { name: contains },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            take: payrollSearchLimit,
            select: groomSelect,
          })
        : await prisma.rider.findMany({
            where: { OR: [{ firstName: contains }, { lastName: contains }] },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
            take: payrollSearchLimit,
            select: riderSelect,
          });
  }
  return rows.map(row => ({
    ...describeStaff(staffType, row),
    failureCount: counts.get(row.id)?.count ?? 0,
    lastFailureAt: counts.get(row.id)?.lastAt ?? null,
  }));
}

/** The newest tool use on a staff member, or null. */
export function latestPayrollToolUse(staffType, staffId, client = prisma) {
  return client.staffActionLog.findFirst({
    where: {
      capability: payrollDiagnoseCapability,
      targetType: staffType,
      targetId: String(staffId),
    },
    orderBy: { id: 'desc' },
    select: { id: true, outcome: true, after: true, createdAt: true },
  });
}

function toolState(latest) {
  const after = latest?.after && typeof latest.after === 'object' ? latest.after : {};
  if (!latest || after.action !== payrollTestRunAction) {
    return { lastTestRun: null, rerunReadyFailureId: null };
  }
  const passed = latest.outcome === 'succeeded';
  const sameCommit = (after.commitSha ?? null) === deployedCommitSha();
  return {
    lastTestRun: {
      failureId: after.failureId ?? null,
      testedAt: latest.createdAt,
      passed,
      sameCommit,
      outcome: after.outcome ?? null,
    },
    rerunReadyFailureId: passed && sameCommit ? (after.failureId ?? null) : null,
  };
}

/**
 * A staff member's logged failures, with whether each can be re-run and which
 * one (if any) a passed test run has unlocked.
 */
export async function payrollFailuresFor(staffType, staffId) {
  const staffMember = await loadPayrollStaff(staffType, staffId);
  const [failures, latest] = await Promise.all([
    readPayrollFailures(staffType, staffId),
    latestPayrollToolUse(staffType, staffId),
  ]);
  return {
    staffMember,
    failures: failures.map(failure => ({
      id: failure.id,
      at: failure.at,
      source: failure.source,
      weekKey: failure.weekKey,
      message: failure.message,
      replayable: replayableSources.includes(failure.source),
    })),
    ...toolState(latest),
  };
}

async function loadReplayableFailure(staffType, staffId, failureId) {
  const failure = await readPayrollFailure(staffType, staffId, failureId);
  if (!failure) {
    throw refusal('That failure is not on record', 404, 'failureNotFound');
  }
  if (!replayableSources.includes(failure.source) || !failure.weekStart || !failure.userId) {
    throw refusal('That failure cannot be re-run', 409, 'failureNotReplayable');
  }
  return failure;
}

/** The digest of what a replay did, so a re-run only does what was tested. */
function replayDigest(failure, result) {
  return createHash('sha256')
    .update(JSON.stringify([failure.id, result.outcome, result.amount]))
    .digest('hex');
}

function replayInTx(tx, staffType, staffId, failure, now) {
  return payrollReplay(staffType)(tx, {
    staffId,
    userId: failure.userId,
    source: failure.source,
    weekStart: new Date(failure.weekStart),
    now,
  });
}

/** Record a failed tool use: in the staff action log, and in the staff member's failures. */
async function recordToolFailure({ staffType, staffId, failure, actor, action, error }) {
  await recordPayrollFailure({
    staffType,
    staffId,
    userId: failure.userId,
    source: action,
    weekStart: failure.weekStart,
    weekKey: failure.weekKey,
    error,
    detail: { failureId: failure.id },
  });
  await recordStaffFailure({
    actorId: actor.id,
    actorRole: actor.role,
    capability: payrollDiagnoseCapability,
    targetType: staffType,
    targetId: String(staffId),
    after: { action, failureId: failure.id, commitSha: deployedCommitSha() },
    error: error.message,
  }).catch(logError =>
    logger.error(`[payrollDiagnostics] Could not record the failure: ${logError.message}`),
  );
}

/**
 * Test run: replay the failed pass for this staff member, always rolled back.
 *
 * @param {'groom'|'rider'} staffType
 * @param {number} staffId
 * @param {number} failureId
 * @param {{ actor: { id: string, role: string }, now?: Date,
 *   afterReplay?: (tx: object) => Promise<void> }} params `afterReplay` is a test seam
 *   that runs inside the transaction after the replay.
 * @returns {Promise<object>} `{ passed: true, outcome, amount }` or `{ passed: false, error }`
 */
export async function testRunPayrollFailure(
  staffType,
  staffId,
  failureId,
  { actor, now = new Date(), afterReplay },
) {
  await loadPayrollStaff(staffType, staffId);
  const failure = await loadReplayableFailure(staffType, staffId, failureId);
  const commitSha = deployedCommitSha();
  let result = null;
  try {
    await prisma.$transaction(
      async tx => {
        result = await replayInTx(tx, staffType, staffId, failure, now);
        if (afterReplay) {
          await afterReplay(tx);
        }
        throw rollbackTestRun;
      },
      { timeout: replayTimeoutMs, maxWait: 10_000 },
    );
  } catch (error) {
    if (error !== rollbackTestRun) {
      logger.error(
        `[payrollDiagnostics] Test run of ${staffType} ${staffId} failed: ${error.message}`,
      );
      await recordToolFailure({
        staffType,
        staffId,
        failure,
        actor,
        action: payrollTestRunAction,
        error,
      });
      return { failureId, passed: false, error: error.message, commitSha };
    }
  }
  const testedAt = new Date();
  await recordStaffActionTx(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    capability: payrollDiagnoseCapability,
    targetType: staffType,
    targetId: String(staffId),
    after: {
      action: payrollTestRunAction,
      failureId,
      commitSha,
      testedAt: testedAt.toISOString(),
      outcome: result.outcome,
      amount: result.amount,
      digest: replayDigest(failure, result),
    },
  });
  return {
    failureId,
    passed: true,
    commitSha,
    testedAt: testedAt.toISOString(),
    outcome: result.outcome,
    amount: result.amount,
  };
}

/** Refuse unless the newest tool use is a passed test run of this failure on this commit. */
async function requireFreshTestRun(staffType, staffId, failureId) {
  const last = await latestPayrollToolUse(staffType, staffId);
  const after = last?.after && typeof last.after === 'object' ? last.after : {};
  if (
    !last ||
    after.action !== payrollTestRunAction ||
    last.outcome !== 'succeeded' ||
    after.failureId !== failureId
  ) {
    throw refusal(
      'Test run this failure first; Re-run unlocks when it passes.',
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
 * Re-run: replay the failed pass for this staff member once, in one transaction.
 *
 * @param {'groom'|'rider'} staffType
 * @param {number} staffId
 * @param {number} failureId
 * @param {{ actor: { id: string, role: string }, now?: Date,
 *   afterReplay?: (tx: object) => Promise<void> }} params
 * @returns {Promise<{ failureId: number, outcome: string, amount: number }>}
 */
export async function rerunPayrollFailure(
  staffType,
  staffId,
  failureId,
  { actor, now = new Date(), afterReplay },
) {
  await loadPayrollStaff(staffType, staffId);
  const failure = await loadReplayableFailure(staffType, staffId, failureId);
  const expectedDigest = await requireFreshTestRun(staffType, staffId, failureId);

  let result;
  try {
    result = await prisma.$transaction(
      async tx => {
        const replayed = await replayInTx(tx, staffType, staffId, failure, now);
        if (afterReplay) {
          await afterReplay(tx);
        }
        if (replayDigest(failure, replayed) !== expectedDigest) {
          throw refusal(
            'This would now do something different from its test run. Test run it again.',
            409,
            'testRunStale',
          );
        }
        await recordStaffActionTx(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          capability: payrollDiagnoseCapability,
          targetType: staffType,
          targetId: String(staffId),
          after: {
            action: payrollRerunAction,
            failureId,
            commitSha: deployedCommitSha(),
            outcome: replayed.outcome,
            amount: replayed.amount,
            digest: expectedDigest,
          },
        });
        return replayed;
      },
      { timeout: replayTimeoutMs, maxWait: 10_000 },
    );
  } catch (error) {
    if (AppError.isAppError(error)) {
      throw error;
    }
    logger.error(`[payrollDiagnostics] Re-run of ${staffType} ${staffId} failed: ${error.message}`);
    await recordToolFailure({
      staffType,
      staffId,
      failure,
      actor,
      action: payrollRerunAction,
      error,
    });
    throw refusal(
      `The re-run failed and nothing was changed: ${error.message}`,
      500,
      'rerunFailed',
    );
  }
  // Committed. The player's notice (if any) is fail-soft, after the commit.
  if (result.afterCommit) {
    result.afterCommit();
  }
  return { failureId, outcome: result.outcome, amount: result.amount };
}
