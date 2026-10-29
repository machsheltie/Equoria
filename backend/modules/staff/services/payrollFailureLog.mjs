/**
 * Every payroll failure, per groom or rider, recorded when it fails
 * (Equoria-brh8c, owner ruling 2026-10-28 q158).
 *
 * Since payday became a player action (Equoria-hc96y) the game itself runs two
 * payroll passes: the weekly settlement just after Sunday midnight Eastern (it
 * takes no money; an unpaid week becomes owed, or the groom or rider leaves) and
 * the owner's manual groom payday (q262). When either fails for one staff member
 * the owner sees it in the Steward's Office, can copy a report for Claude Code or
 * Codex, and can re-run it once a test run passes on the deployed commit.
 *
 * Stored in cron_run_logs, one row per staff member per failure, under its own
 * job name (the show tools do the same; no migration). The cron health view
 * reads only registered job names, so these rows never appear there. `summary`
 * holds { staffType, staffId, userId, source, weekKey, weekStart, stack,
 * commitSha, detail }. Kept 90 days like every cron row.
 *
 * Writing is fail-soft: a failure log must never break the pass it describes.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';

/** The cron_run_logs job name of a payroll failure row. */
export const payrollFailureJobName = 'payrollFailure';

/** The two staff kinds the owner can pick. */
export const payrollStaffTypes = Object.freeze(['groom', 'rider']);

/** The passes whose failures can be re-run; the owner's own tool failures cannot. */
export const replayableSources = Object.freeze(['weeklySettlement', 'manualPayroll']);

const maxStackLength = 8000;

/** How many failures of one staff member are read, newest first. */
export const payrollFailureReadLimit = 25;

function describeError(error, message) {
  // Duck-typed, not instanceof: a Prisma error can come from another realm.
  const isError = error !== null && typeof error === 'object' && typeof error.message === 'string';
  return {
    text: isError ? error.message : (message ?? String(error ?? 'unknown')),
    stack: isError && typeof error.stack === 'string' ? error.stack.slice(0, maxStackLength) : null,
  };
}

/**
 * Record one payroll failure for one groom or rider.
 *
 * @param {{ staffType: 'groom'|'rider', staffId: number, userId?: string|null,
 *   source: string, weekStart?: Date|null, weekKey?: string|null, error?: unknown,
 *   message?: string, detail?: object }} failure
 * @returns {Promise<void>}
 */
export async function recordPayrollFailure({
  staffType,
  staffId,
  userId = null,
  source,
  weekStart = null,
  weekKey = null,
  error,
  message,
  detail,
}) {
  try {
    const now = new Date();
    const { text, stack } = describeError(error, message);
    await prisma.cronRunLog.create({
      data: {
        jobName: payrollFailureJobName,
        startedAt: now,
        finishedAt: now,
        status: 'error',
        errorsCount: 1,
        errorMessage: text.slice(0, 2000),
        summary: {
          staffType,
          staffId,
          userId,
          source,
          weekKey,
          weekStart: weekStart ? new Date(weekStart).toISOString() : null,
          stack,
          commitSha: deployedCommitSha(),
          ...(detail ? { detail } : {}),
        },
      },
    });
  } catch (logError) {
    logger.error(
      `[payrollFailureLog] Could not record a payroll failure of ${staffType} ${staffId}: ${logError.message}`,
    );
  }
}

function toFailure(row) {
  const summary = row.summary && typeof row.summary === 'object' ? row.summary : {};
  return {
    id: row.id,
    at: row.startedAt,
    staffType: summary.staffType ?? null,
    staffId: summary.staffId ?? null,
    userId: summary.userId ?? null,
    source: summary.source ?? null,
    weekKey: summary.weekKey ?? null,
    weekStart: summary.weekStart ?? null,
    message: row.errorMessage,
    stack: summary.stack ?? null,
    commitSha: summary.commitSha ?? null,
    detail: summary.detail ?? null,
  };
}

const failureSelect = { id: true, startedAt: true, errorMessage: true, summary: true };

/**
 * The recorded failures of one groom or rider, newest first.
 *
 * @param {'groom'|'rider'} staffType
 * @param {number} staffId
 */
export async function readPayrollFailures(staffType, staffId) {
  const rows = await prisma.cronRunLog.findMany({
    where: {
      jobName: payrollFailureJobName,
      AND: [
        { summary: { path: ['staffType'], equals: staffType } },
        { summary: { path: ['staffId'], equals: staffId } },
      ],
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: payrollFailureReadLimit,
    select: failureSelect,
  });
  return rows.map(toFailure);
}

/** One recorded failure by id, or null when it is not this staff member's. */
export async function readPayrollFailure(staffType, staffId, failureId) {
  const row = await prisma.cronRunLog.findFirst({
    where: { id: failureId, jobName: payrollFailureJobName },
    select: failureSelect,
  });
  if (!row) {
    return null;
  }
  const failure = toFailure(row);
  return failure.staffType === staffType && failure.staffId === staffId ? failure : null;
}

/**
 * How many failures each staff member of a kind has on record (newest 1000 rows),
 * and when the latest was, for the owner's search list.
 *
 * @param {'groom'|'rider'} staffType
 * @returns {Promise<Map<number, { count: number, lastAt: Date }>>}
 */
export async function payrollFailureCounts(staffType) {
  const rows = await prisma.cronRunLog.findMany({
    where: { jobName: payrollFailureJobName, summary: { path: ['staffType'], equals: staffType } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: 1000,
    select: { startedAt: true, summary: true },
  });
  const counts = new Map();
  for (const row of rows) {
    const staffId = row.summary?.staffId;
    if (!Number.isInteger(staffId)) {
      continue;
    }
    const entry = counts.get(staffId);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(staffId, { count: 1, lastAt: row.startedAt });
    }
  }
  return counts;
}
