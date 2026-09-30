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
 *
 * Equoria-bvddn.15 / Equoria-cmw85.8 (owner ruling 2026-09-30): minutes shifted from :00/:15/:30/:45 to
 * :03/:18/:33/:48 (same 15-minute cadence) so it no longer starts in the same
 * minute as the daily/weekly locked jobs; see cronScheduleCollision sentinel.
 */

export default Object.freeze({
  jobName: 'electionStatusTransition',
  // Runs every 15 minutes. Old: '*/15 * * * *'.
  schedule: '3,18,33,48 * * * *',
  applyLock: true,
  // 15-minute cadence → 30min budget (15min period + 15min tolerance).
  staleAfterMs: 30 * 60 * 1000,
  run: service => service.transitionElectionStatuses(),
});
