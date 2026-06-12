/**
 * Daily documentation-coverage snapshot job descriptor (Equoria-qr114).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * `recordDocCoverageSnapshot()`, which records ONE DocCoverageSnapshot row
 * (Equoria-zr9kl) and then purges expired rows (scoped DELETE) so the table
 * stays bounded.
 *
 * Schedule: 04:00 UTC — a low-traffic time AFTER the existing nightly cluster
 * (nightlyShowExecution 03:00, auditLogRetention 03:30, hoofConditionDecay
 * 03:45) so the heaviest jobs don't overlap.
 *
 * advisory-locked (so exactly one replica records per day), runWithHeartbeat
 * (so /api/admin/cron/health surfaces staleness + the recorded/purged summary).
 *
 * Appended at the END of CRON_JOB_REGISTRY so the pre-existing job order — and
 * therefore getStatus()/getHealth() iteration order for the original 10 jobs —
 * is unchanged.
 */

export default Object.freeze({
  jobName: 'docCoverageSnapshot',
  // Runs daily at 04:00 UTC.
  schedule: '0 4 * * *',
  applyLock: true,
  // Daily job: 24h period + 6h tolerance (mirrors the other daily budgets).
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.recordDocCoverageSnapshot(),
});
