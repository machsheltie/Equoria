/**
 * Audit-Log Retention Service (Equoria-54qq8 — OWASP A09 follow-up)
 *
 * The audit_logs table (model AuditLog) persists one row per sensitive
 * mutation (auth / bank / breeding / training / admin / grooms) via
 * backend/middleware/auditLog.mjs#storeAuditLog. Without a retention policy
 * the table grows unbounded — the MEDIUM residual risk noted in SECURITY.md
 * A09 after Equoria-jw10w shipped the DB-backed trail.
 *
 * This service implements a time-based retention purge: a scoped DELETE of
 * rows whose createdAt is older than the configured retention window. It is
 * invoked nightly by the cron service (CronJobService).
 *
 * Design decisions:
 *   - Time-based purge (scoped DELETE) over table partitioning. Partitioning
 *     is the higher-throughput option but requires a migration that converts
 *     audit_logs to a partitioned table + a partition-maintenance job; that
 *     is materially more invasive than the volume of a single-instance beta
 *     warrants. A scoped DELETE with the existing `createdAt DESC` index is
 *     correct and sufficient at current scale. If volume grows past what a
 *     nightly DELETE can clear, switching to partitioning is filed as a
 *     future spike rather than pre-built (avoids speculative complexity).
 *   - Retention default 90 days: matches the existing 90-day audit-report
 *     retention already documented in SECURITY.md (A06 CI section) so the
 *     DB trail and the CI artifact retention windows are consistent. The
 *     value is sourced from AUDIT_LOG_RETENTION_DAYS env var if set (clamped
 *     to a sane floor of 7 days so a misconfigured env can never effectively
 *     disable the trail or wipe it near-instantly).
 *   - Scoped DELETE only: `where: { createdAt: { lt: cutoff } }`. NEVER an
 *     unscoped deleteMany() (forbidden by CLAUDE.md real-DB rule #2). Recent
 *     rows are always retained.
 *   - Best-effort / fail-soft at the cron layer: a purge failure is logged
 *     and re-thrown so the heartbeat layer records it, but it never crashes
 *     the process (mirrors every other CronJobService handler).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/** Floor so a misconfigured env can never wipe near-current audit history. */
export const MIN_RETENTION_DAYS = 7;

/** Default retention window (days) — aligned with the 90-day CI audit-report retention. */
export const DEFAULT_RETENTION_DAYS = 90;

/**
 * Resolve the effective retention window in days.
 *
 * Reads AUDIT_LOG_RETENTION_DAYS; falls back to DEFAULT_RETENTION_DAYS.
 * Non-numeric / non-positive values fall back to the default. The result is
 * clamped to MIN_RETENTION_DAYS so the trail can never be effectively
 * disabled or wiped near-instantly by env misconfiguration.
 *
 * @returns {number} retention window in whole days, >= MIN_RETENTION_DAYS
 */
export function getRetentionDays() {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  const parsed = Number.parseInt(raw, 10);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
  return Math.max(MIN_RETENTION_DAYS, days);
}

/**
 * Compute the cutoff Date: rows with createdAt strictly older than this are
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
 * Purge audit_logs rows older than the retention window.
 *
 * Scoped DELETE — only rows with createdAt < cutoff are removed. Recent rows
 * are always retained. Returns a summary for the cron heartbeat.
 *
 * @param {Object} [opts]
 * @param {number} [opts.retentionDays] override the resolved retention window
 * @param {Date}   [opts.now] inject "now" for deterministic tests
 * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
 */
export async function purgeExpiredAuditLogs({ retentionDays, now } = {}) {
  const effectiveRetentionDays =
    Number.isFinite(retentionDays) && retentionDays > 0
      ? Math.max(MIN_RETENTION_DAYS, retentionDays)
      : getRetentionDays();
  const cutoff = computeCutoff(effectiveRetentionDays, now);

  // Scoped DELETE — never unscoped (CLAUDE.md real-DB rule). The
  // [createdAt DESC] index on audit_logs backs this range predicate.
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  logger.info(
    `[auditLogRetention] Purged ${count} audit_logs row(s) older than ` +
      `${effectiveRetentionDays}d (cutoff ${cutoff.toISOString()})`,
  );

  return {
    deletedCount: count,
    retentionDays: effectiveRetentionDays,
    cutoff: cutoff.toISOString(),
  };
}
