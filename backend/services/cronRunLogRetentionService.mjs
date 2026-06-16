/**
 * CronRunLog Retention Service (Equoria-2tx16, g48ng part 3 / qr114 sibling)
 *
 * The cron_run_logs table (model CronRunLog, Equoria-9wby) persists ONE row per
 * cron cycle (success / error / skipped-locked), written by
 * CronJobService.runWithHeartbeat() on every job run. With ~11 scheduled jobs
 * firing daily (some every 15 minutes), the table grows unbounded — exactly the
 * unbounded-observability-table class already closed for audit_logs
 * (Equoria-54qq8) and doc_coverage_snapshots (Equoria-qr114).
 *
 * This service implements a time-based retention purge: a scoped DELETE of
 * cron_run_logs rows whose startedAt is older than the configured retention
 * window. It deliberately mirrors docCoverageSnapshotRetentionService.mjs /
 * auditLogRetentionService.mjs so all three observability-history surfaces behave
 * identically: env-overridable window, hard minimum floor, scoped DELETE only.
 *
 * Design decisions:
 *   - Time-based scoped DELETE (NOT keep-last-N). Mirrors the established
 *     retention pattern. "Keep the last 90 days of cron history" is a meaningful
 *     ops-forensics horizon; keep-last-N would couple retention to the (highly
 *     variable, every-15-min for some jobs) recording cadence.
 *   - Purges by `startedAt` — the domain "when the run happened" timestamp
 *     (CronRunLog also has createdAt @default(now()); startedAt is the
 *     handler-set cycle start and is the field /api/admin/cron/health orders by).
 *     The two are written within milliseconds of each other, so either bounds the
 *     table; startedAt is the semantically correct retention axis.
 *   - Retention default 90 days — matches the auditLog/docCoverage defaults so the
 *     three observability windows stay consistent.
 *   - Sourced from CRON_RUN_LOG_RETENTION_DAYS env if set, clamped to a 7-day
 *     floor so a misconfigured env can never effectively disable the history or
 *     wipe it near-instantly.
 *   - Scoped DELETE only: `where: { startedAt: { lt: cutoff } }`. NEVER an
 *     unscoped deleteMany() (forbidden by CLAUDE.md real-DB rule #2). Recent rows
 *     are always retained so the cron-health last-N view still has data.
 *   - The cron handler re-throws so the heartbeat layer records failures, but a
 *     purge failure never crashes the process (mirrors every CronJobService
 *     handler).
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

/** Floor so a misconfigured env can never wipe near-current cron history. */
export const MIN_RETENTION_DAYS = 7;

/** Default retention window (days) — aligned with the audit/doc-coverage defaults. */
export const DEFAULT_RETENTION_DAYS = 90;

/**
 * Resolve the effective retention window in days.
 *
 * Reads CRON_RUN_LOG_RETENTION_DAYS; falls back to DEFAULT_RETENTION_DAYS.
 * Non-numeric / non-positive values fall back to the default. The result is
 * clamped to MIN_RETENTION_DAYS so the history can never be effectively disabled
 * or wiped near-instantly by env misconfiguration.
 *
 * @returns {number} retention window in whole days, >= MIN_RETENTION_DAYS
 */
export function getRetentionDays() {
  const raw = process.env.CRON_RUN_LOG_RETENTION_DAYS;
  const parsed = Number.parseInt(raw, 10);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
  return Math.max(MIN_RETENTION_DAYS, days);
}

/**
 * Compute the cutoff Date: rows with startedAt strictly older than this are
 * purged. Exposed for testability (deterministic cutoff with an injected now).
 *
 * @param {number} retentionDays
 * @param {Date} [now=new Date()]
 * @returns {Date}
 */
export function computeCutoff(retentionDays, now = new Date()) {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff;
}

/**
 * Purge cron_run_logs rows older than the retention window.
 *
 * Scoped DELETE — only rows with startedAt < cutoff are removed. Recent rows are
 * always retained. Returns a summary for the cron heartbeat.
 *
 * @param {Object} [opts]
 * @param {number} [opts.retentionDays] override the resolved retention window
 * @param {Date}   [opts.now] inject "now" for deterministic tests
 * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
 */
export async function purgeExpiredCronRunLogs({ retentionDays, now } = {}) {
  const effectiveRetentionDays =
    Number.isFinite(retentionDays) && retentionDays > 0
      ? Math.max(MIN_RETENTION_DAYS, retentionDays)
      : getRetentionDays();
  const cutoff = computeCutoff(effectiveRetentionDays, now);

  // Scoped DELETE — never unscoped (CLAUDE.md real-DB rule). startedAt is the
  // leading-second column of @@index([jobName, startedAt DESC]); a maintenance
  // purge tolerates the scan even without a standalone startedAt index.
  const { count } = await prisma.cronRunLog.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });

  logger.info(
    `[cronRunLogRetention] Purged ${count} cron_run_logs row(s) older than ` +
      `${effectiveRetentionDays}d (cutoff ${cutoff.toISOString()})`,
  );

  return {
    deletedCount: count,
    retentionDays: effectiveRetentionDays,
    cutoff: cutoff.toISOString(),
  };
}
