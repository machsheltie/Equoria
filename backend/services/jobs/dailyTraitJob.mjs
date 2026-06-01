/**
 * Daily foal trait-evaluation job descriptor (Equoria-fx4e7 cronJobs split).
 *
 * Registry entry consumed by CronJobService.start(). Carries the schedule
 * string, the cross-replica advisory-lock policy, the heartbeat staleness
 * budget, and the `run` thunk that invokes the service's existing
 * `evaluateDailyFoalTraits()` impl. The impl itself remains an instance method
 * on CronJobService (its `this.evaluateFoalTraits` / `this.logTraitRevelation`
 * / `this.notifyTraitRevelation` / `this.advanceFoalDevelopmentDay` cluster is
 * called directly on the singleton by integration tests, so it cannot move to
 * a free function without breaking that contract — see fx4e7 notes).
 *
 * Behaviour is identical to the pre-split inline `cron.schedule('0 0 * * *', ...)`
 * registration: midnight UTC, advisory-locked, wrapped in runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'dailyTraitEvaluation',
  // Daily trait evaluation — runs at midnight UTC.
  schedule: '0 0 * * *',
  applyLock: true,
  // Daily cadence → 30h budget (24h period + 6h tolerance).
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.evaluateDailyFoalTraits(),
});
