/**
 * Daily horse-aging job descriptor (Equoria-fx4e7 cronJobs split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `processHorseAging()` impl (which stays an instance method —
 * `manualHorseAging` and the aging integration tests call it on the singleton).
 *
 * Behaviour identical to the pre-split inline `cron.schedule('5 0 * * *', ...)`:
 * 00:05 UTC (after trait evaluation), advisory-locked, runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'dailyHorseAging',
  // Runs at 00:05 UTC, after the trait evaluation at 00:00.
  schedule: '5 0 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.processHorseAging(),
});
