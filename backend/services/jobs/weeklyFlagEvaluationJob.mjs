/**
 * Weekly epigenetic-flag-evaluation job descriptor (Equoria-fx4e7 split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `evaluateWeeklyFlags()` impl (called directly on the singleton by
 * weeklyFlagEvaluationCron.*.test.mjs).
 *
 * Behaviour identical to the pre-split inline `cron.schedule('30 0 * * 1', ...)`
 * (Equoria-yzqhj.2): every Monday at 00:30 UTC (after the weekly rider/trainer
 * career tick at 00:15), advisory-locked, runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'weeklyFlagEvaluation',
  // Runs every Monday at 00:30 UTC.
  schedule: '30 0 * * 1',
  applyLock: true,
  // Weekly cadence → 192h budget (168h period + 24h tolerance).
  staleAfterMs: 192 * 60 * 60 * 1000,
  run: service => service.evaluateWeeklyFlags(),
});
