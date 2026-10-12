/**
 * Nightly overnight-show-execution job descriptor (Equoria-fx4e7 split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `executeOvernightShows()` impl (called directly on the singleton by
 * cronJobsOvernightShowExecution.test.mjs).
 *
 * Behaviour identical to the pre-split inline `cron.schedule('0 3 * * *', ...)`
 * (Equoria-aghl / FR-CN8): 03:00 Eastern, advisory-locked, runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'nightlyShowExecution',
  // Runs nightly at 03:00 Eastern.
  schedule: '0 3 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.executeOvernightShows(),
});
