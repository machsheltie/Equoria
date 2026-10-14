/**
 * Email-outbox delivery job descriptor (STAFF-CR-10).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the
 * service's `deliverEmailOutbox()` method: delivers queued staff-ticket emails
 * the post-commit kick did not (process restart, mail service down, a worker
 * that died mid-send), retrying with backoff and ending a row as `failed`
 * after its last attempt (modules/staff/services/ticketEmailOutbox.mjs).
 *
 * Schedule: every 5 minutes at :01, :06, ... :56 — minutes no other job in
 * either registry starts on (cronScheduleCollision sentinel). Advisory-locked
 * so only one replica runs it; the per-row claim (FOR UPDATE SKIP LOCKED)
 * also keeps the kick and the job from sending the same row twice.
 * runWithHeartbeat puts each run's sent/retrying/failed counts on
 * /api/admin/cron/health. staleAfterMs is three periods.
 */

export default Object.freeze({
  jobName: 'emailOutboxDelivery',
  schedule: '1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
  applyLock: true,
  staleAfterMs: 15 * 60 * 1000,
  run: service => service.deliverEmailOutbox(),
});
