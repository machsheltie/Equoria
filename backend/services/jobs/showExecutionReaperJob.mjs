/**
 * Show-execution reaper job descriptor (Equoria-c7mx0 crash recovery).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the
 * service's `reapStaleExecutingShows()` (impl/showExecutionReaper.mjs),
 * which releases shows stranded in 'executing' by an executor crash back to
 * 'open' and re-drives them through the real executeClosedShows path.
 *
 * Time constants (correlated set — see impl/showExecutionReaper.mjs):
 * runs every 30 minutes; the impl's staleness threshold is 2h, so a
 * stranded show is recovered at most ~2.5h after its claim; staleAfterMs
 * (heartbeat budget) is 1h — 2x the schedule period, so one missed tick
 * does not false-alarm but a dead job surfaces within the hour.
 */

export default Object.freeze({
  jobName: 'showExecutionReaper',
  // Every 30 minutes (UTC) — frequent enough that a stranded show's escrow
  // is unfrozen within ~2.5h of the crash, cheap enough that the usual
  // zero-stale scan is a single indexed query (shows_status_claimed_at_idx).
  schedule: '*/30 * * * *',
  applyLock: true,
  staleAfterMs: 60 * 60 * 1000,
  run: service => service.reapStaleExecutingShows(),
});
