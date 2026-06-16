/**
 * Nightly cron-run-log-retention-purge job descriptor (Equoria-2tx16).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * `purgeExpiredCronRunLogs()` method (a scoped DELETE of cron_run_logs rows older
 * than the retention window) so the runWithHeartbeat() writer that fills the
 * table can't grow it unbounded.
 *
 * Schedule: 04:15 UTC — after docCoverageSnapshot (04:00) so the nightly
 * maintenance jobs don't overlap; advisory-locked so the cluster-wide DELETE runs
 * EXACTLY ONCE; runWithHeartbeat so /api/admin/cron/health surfaces the purge
 * summary + staleness. Mirrors auditLogRetention / docCoverageSnapshot.
 */

export default Object.freeze({
  jobName: 'cronRunLogRetention',
  // Runs nightly at 04:15 UTC.
  schedule: '15 4 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.purgeExpiredCronRunLogs(),
});
