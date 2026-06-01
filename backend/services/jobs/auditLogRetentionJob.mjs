/**
 * Nightly audit-log-retention-purge job descriptor (Equoria-fx4e7 split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `purgeExpiredAuditLogs()` impl.
 *
 * Behaviour identical to the pre-split inline `cron.schedule('30 3 * * *', ...)`
 * (Equoria-54qq8, OWASP A09 follow-up): 03:30 UTC (after nightlyShowExecution
 * at 03:00 so the two heaviest nightly jobs don't overlap), advisory-locked,
 * runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'auditLogRetention',
  // Runs nightly at 03:30 UTC.
  schedule: '30 3 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.purgeExpiredAuditLogs(),
});
