/**
 * Nightly trait reveal job descriptor (Equoria-2d55z, owner rulings 2026-10-27).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the
 * service's `revealTraitsFromCare()` method, which runs the trait reveal engine
 * (modules/traits/services/traitRevealEngine.mjs): every completed day of a
 * foal's first 21 days of life is rolled once against its grooming record.
 *
 * Schedule: 00:40 Eastern, after the game day has ended, on a minute no other
 * job in either registry starts on (cronScheduleCollision sentinel).
 * Advisory-locked so only one replica runs it; the per-horse progress key and
 * row lock keep a re-run from rolling a day twice. 30h staleness, like the
 * other daily jobs.
 */

export default Object.freeze({
  jobName: 'nightlyTraitReveal',
  schedule: '40 0 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.revealTraitsFromCare(),
});
