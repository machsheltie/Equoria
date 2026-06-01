/**
 * Nightly hoof-condition-decay job descriptor (Equoria-fx4e7 split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `decayHoofConditions()` impl.
 *
 * Behaviour identical to the pre-split inline `cron.schedule('45 3 * * *', ...)`
 * (Equoria-gg3v): 03:45 UTC (after auditLogRetention at 03:30 so nightly jobs
 * stay staggered), advisory-locked, runWithHeartbeat. Decay is idempotent.
 */

export default Object.freeze({
  jobName: 'hoofConditionDecay',
  // Runs nightly at 03:45 UTC.
  schedule: '45 3 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.decayHoofConditions(),
});
