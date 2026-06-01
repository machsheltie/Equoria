/**
 * Election status-transition job descriptor (Equoria-fx4e7 cronJobs split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `transitionElectionStatuses()` impl (called directly on the
 * singleton by the cronJobs integration tests).
 *
 * Behaviour identical to the pre-split inline `cron.schedule('*\/15 * * * *', ...)`:
 * every 15 minutes (upcoming→open, open→closed), advisory-locked,
 * runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'electionStatusTransition',
  // Runs every 15 minutes.
  schedule: '*/15 * * * *',
  applyLock: true,
  // 15-minute cadence → 30min budget (15min period + 15min tolerance).
  staleAfterMs: 30 * 60 * 1000,
  run: service => service.transitionElectionStatuses(),
});
