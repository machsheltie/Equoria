/**
 * Every failed try of a show, recorded when it fails (Equoria-yqi49, owner
 * ruling q29): the owner's Diagnose hands these to Claude Code or Codex, so each
 * try keeps its time, where it failed, the error message and the stack.
 *
 * Stored in cron_run_logs, one row per failure, under its own job name. Those
 * rows are written by the nightly show run and the reaper (both cron jobs), and
 * the owner's Test run and Run Show add theirs, so one place holds the whole
 * story of a show. The cron health view reads only registered job names, so
 * these rows never appear there. `summary` holds { showId, source, stack,
 * commitSha, detail }. Kept 90 days like every cron row.
 *
 * Writing is fail-soft: a failure log must never break the run it describes.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';

/** The cron_run_logs job name of a show failure row. */
export const showFailureJobName = 'showFailure';

/** A stack is cut to this many characters (a full Prisma stack is far shorter). */
const maxStackLength = 8000;

/** How many failures of one show Diagnose reads, newest first. */
export const showFailureReadLimit = 25;

/**
 * Record one failed try of a show.
 *
 * @param {number} showId
 * @param {{ source: string, error?: unknown, message?: string, detail?: object }} failure
 *   `source` names where it failed (nightlyRun, nightlyPayout, reaperStranded,
 *   testRun, runShow); `error` is the caught error, or `message` when nothing was thrown.
 * @returns {Promise<void>}
 */
export async function recordShowFailure(showId, { source, error, message, detail } = {}) {
  try {
    const now = new Date();
    // Duck-typed, not instanceof: a Prisma error can come from another realm.
    const isError =
      error !== null && typeof error === 'object' && typeof error.message === 'string';
    const text = isError ? error.message : (message ?? String(error ?? 'unknown'));
    const stack = isError && typeof error.stack === 'string' ? error.stack : null;
    await prisma.cronRunLog.create({
      data: {
        jobName: showFailureJobName,
        startedAt: now,
        finishedAt: now,
        status: 'error',
        errorsCount: 1,
        errorMessage: text.slice(0, 2000),
        summary: {
          showId,
          source,
          stack: stack ? stack.slice(0, maxStackLength) : null,
          commitSha: deployedCommitSha(),
          ...(detail ? { detail } : {}),
        },
      },
    });
  } catch (logError) {
    logger.error(
      `[showFailureLog] Could not record a failure of show ${showId}: ${logError.message}`,
    );
  }
}

/**
 * The recorded failures of one show, newest first.
 *
 * @param {number} showId
 * @returns {Promise<Array<{ id: number, at: Date, source: string|null, message: string|null, stack: string|null, commitSha: string|null, detail: object|null }>>}
 */
export async function readShowFailures(showId) {
  const rows = await prisma.cronRunLog.findMany({
    where: { jobName: showFailureJobName, summary: { path: ['showId'], equals: showId } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: showFailureReadLimit,
    select: { id: true, startedAt: true, errorMessage: true, summary: true },
  });
  return rows.map(row => {
    const summary = row.summary && typeof row.summary === 'object' ? row.summary : {};
    return {
      id: row.id,
      at: row.startedAt,
      source: summary.source ?? null,
      message: row.errorMessage,
      stack: summary.stack ?? null,
      commitSha: summary.commitSha ?? null,
      detail: summary.detail ?? null,
    };
  });
}
