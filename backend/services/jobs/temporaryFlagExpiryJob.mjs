/**
 * Daily temporary-flag-expiry-sweep job descriptor (Equoria-fx4e7 split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `sweepExpiredTemporaryFlags()` impl.
 *
 * Behaviour identical to the pre-split inline `cron.schedule('20 0 * * *', ...)`
 * (Equoria-yzqhj.5): 00:20 UTC (after dailyFoalMilestoneEvaluation at 00:10,
 * before the staggered 03:xx nightly jobs), advisory-locked, runWithHeartbeat.
 * Idempotent — a second run with the same clock is a no-op.
 */

export default Object.freeze({
  jobName: 'temporaryFlagExpiry',
  // Runs daily at 00:20 UTC.
  schedule: '20 0 * * *',
  applyLock: true,
  // Daily cadence → 30h budget (24h period + 6h tolerance).
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.sweepExpiredTemporaryFlags(),
});
