/**
 * Daily foal-milestone-evaluation job descriptor (Equoria-fx4e7 cronJobs split).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * existing `processFoalMilestones()` impl.
 *
 * Behaviour identical to the pre-split inline `cron.schedule('10 0 * * *', ...)`
 * (Equoria-3yxz): 00:10 UTC (after aging so today's age increments are
 * visible), advisory-locked, runWithHeartbeat.
 */

export default Object.freeze({
  jobName: 'dailyFoalMilestoneEvaluation',
  // Runs at 00:10 UTC, after aging at 00:05.
  schedule: '10 0 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.processFoalMilestones(),
});
