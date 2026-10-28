/**
 * Hall of Fame rounds job descriptor (Equoria-vb1n0, owner rulings 2026-10-28).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * `runHallOfFameRounds()` method (modules/community: hallOfFameService): every
 * round whose time is up is decided (induction, or a one-game-day run-off of
 * the tied horses), then this Eastern game week's round opens with last week's
 * nominations.
 *
 * Schedule: hourly at :13, so a run-off (one game day from the moment it opens)
 * is decided within the hour after it ends, and the Sunday 00:00 Eastern week
 * turn within 13 minutes; :13 is a minute no other job in either registry
 * starts on (cronScheduleCollision sentinel). Advisory-locked; the guarded
 * round claim and the unique weekStart keep a re-run from deciding or opening
 * a round twice. Hourly cadence: 2h staleness budget.
 */

export default Object.freeze({
  jobName: 'hallOfFameRounds',
  schedule: '13 * * * *',
  applyLock: true,
  staleAfterMs: 2 * 60 * 60 * 1000,
  run: service => service.runHallOfFameRounds(),
});
