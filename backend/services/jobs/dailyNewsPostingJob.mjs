/**
 * Daily News posting job descriptor (Equoria-wbt8l, owner rulings 2026-10-23).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the
 * service's `postDailyNews()` method, which posts the game-written News
 * entries due at the start of the Eastern game day (club news, new store
 * items) through the news module (modules/news/services/dailyNewsEntries.mjs).
 *
 * Schedule: 00:02 Eastern, at the start of the game day, on a minute no other
 * job in either registry starts on (cronScheduleCollision sentinel).
 * Advisory-locked so only one replica runs it; the UNIQUE sourceKey keeps a
 * re-run from posting anything twice. 30h staleness, like the other daily jobs.
 */

export default Object.freeze({
  jobName: 'dailyNewsPosting',
  schedule: '2 0 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.postDailyNews(),
});
