/**
 * Weekly rider/trainer career-week tick job descriptor (Equoria-fx4e7 split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `tickRiderTrainerCareerWeeks()` impl.
 *
 * Behaviour identical to the pre-split inline `cron.schedule('15 0 * * 1', ...)`
 * (Equoria-r1nr): every Monday at 00:15 UTC, advisory-locked, runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'weeklyRiderTrainerCareerWeeks',
  // Runs every Monday at 00:15 UTC.
  schedule: '15 0 * * 1',
  applyLock: true,
  // Weekly cadence → 192h budget (168h period + 24h tolerance).
  staleAfterMs: 192 * 60 * 60 * 1000,
  run: service => service.tickRiderTrainerCareerWeeks(),
});
