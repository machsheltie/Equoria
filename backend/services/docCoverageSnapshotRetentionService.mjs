/**
 * Doc-Coverage-Snapshot Retention Service (Equoria-qr114)
 *
 * The doc_coverage_snapshots table (model DocCoverageSnapshot, Equoria-zr9kl)
 * persists one row per recorded documentation-coverage snapshot. Once the
 * snapshot is recorded on a schedule (the cron wired in CronJobService for
 * Equoria-qr114), the table would otherwise grow unbounded — one row per day,
 * forever.
 *
 * This service implements a time-based retention purge: a scoped DELETE of
 * snapshot rows whose capturedAt is older than the configured retention window.
 * It deliberately mirrors backend/modules/admin/services/auditLogRetentionService.mjs
 * (Equoria-54qq8) so the two retention surfaces behave identically: env-overridable
 * window, hard minimum floor, scoped DELETE only.
 *
 * Design decisions:
 *   - Time-based scoped DELETE (NOT keep-last-N). The auditLogRetention pattern
 *     this AC asks us to mirror is time-based, and a time window is the honest
 *     unit for a trend feature: "keep the last 90 days of coverage history" is
 *     a meaningful trend horizon; "keep the last N rows" couples retention to
 *     the (variable) recording cadence. A future cadence change (e.g. hourly)
 *     would silently shrink the time horizon under keep-last-N.
 *   - Retention default 90 days — matches the auditLogRetention default so the
 *     two observability-history windows are consistent.
 *   - Sourced from DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS env if set, clamped to a
 *     7-day floor so a misconfigured env can never effectively disable the trend
 *     history or wipe it near-instantly.
 *   - Scoped DELETE only: `where: { capturedAt: { lt: cutoff } }`. NEVER an
 *     unscoped deleteMany() (forbidden by CLAUDE.md real-DB rule #2). Recent
 *     snapshots are always retained, so deriveCoverageTrend() still has data.
 *   - The cron handler re-throws so the heartbeat layer records failures, but a
 *     purge failure never crashes the process (mirrors every CronJobService
 *     handler).
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

/** Floor so a misconfigured env can never wipe near-current trend history. */
export const MIN_RETENTION_DAYS = 7;

/** Default retention window (days) — aligned with the auditLogRetention default. */
export const DEFAULT_RETENTION_DAYS = 90;

/**
 * Resolve the effective retention window in days.
 *
 * Reads DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS; falls back to
 * DEFAULT_RETENTION_DAYS. Non-numeric / non-positive values fall back to the
 * default. The result is clamped to MIN_RETENTION_DAYS so the trend history can
 * never be effectively disabled or wiped near-instantly by env misconfiguration.
 *
 * @returns {number} retention window in whole days, >= MIN_RETENTION_DAYS
 */
export function getRetentionDays() {
  const raw = process.env.DOC_COVERAGE_SNAPSHOT_RETENTION_DAYS;
  const parsed = Number.parseInt(raw, 10);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
  return Math.max(MIN_RETENTION_DAYS, days);
}

/**
 * Compute the cutoff Date: rows with capturedAt strictly older than this are
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
 * Purge doc_coverage_snapshots rows older than the retention window.
 *
 * Scoped DELETE — only rows with capturedAt < cutoff are removed. Recent rows
 * are always retained. Returns a summary for the cron heartbeat.
 *
 * @param {Object} [opts]
 * @param {number} [opts.retentionDays] override the resolved retention window
 * @param {Date}   [opts.now] inject "now" for deterministic tests
 * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
 */
export async function purgeExpiredDocCoverageSnapshots({ retentionDays, now } = {}) {
  const effectiveRetentionDays =
    Number.isFinite(retentionDays) && retentionDays > 0
      ? Math.max(MIN_RETENTION_DAYS, retentionDays)
      : getRetentionDays();
  const cutoff = computeCutoff(effectiveRetentionDays, now);

  // Scoped DELETE — never unscoped (CLAUDE.md real-DB rule). The
  // [capturedAt DESC] index on doc_coverage_snapshots backs this range predicate.
  const { count } = await prisma.docCoverageSnapshot.deleteMany({
    where: { capturedAt: { lt: cutoff } },
  });

  logger.info(
    `[docCoverageSnapshotRetention] Purged ${count} doc_coverage_snapshots row(s) older than ` +
      `${effectiveRetentionDays}d (cutoff ${cutoff.toISOString()})`,
  );

  return {
    deletedCount: count,
    retentionDays: effectiveRetentionDays,
    cutoff: cutoff.toISOString(),
  };
}
