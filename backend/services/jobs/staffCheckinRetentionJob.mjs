/**
 * Nightly staff check-in retention job descriptor (STAFF-CR-18).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * `purgeStaleStaffCheckins()` method: deletes staff check-in codes used or
 * expired more than 1 day ago and trusted devices expired or revoked more than
 * 30 days ago (modules/staff/services/staffCheckinRetentionService.mjs), and
 * (STAFF-CR-10) staff email-outbox rows sent or cancelled more than 30 days
 * ago or failed more than 90 days ago (ticketEmailOutbox.mjs).
 *
 * Schedule: 03:50 Eastern — a free minute between hoofConditionDecay (03:45)
 * and docCoverageSnapshot (04:00); advisory-locked so the DELETE runs exactly
 * once cluster-wide; runWithHeartbeat so /api/admin/cron/health shows the
 * purge summary. The purge is idempotent, so a missed or repeated night is
 * harmless.
 */

export default Object.freeze({
  jobName: 'staffCheckinRetention',
  // Runs nightly at 03:50 Eastern.
  schedule: '50 3 * * *',
  applyLock: true,
  staleAfterMs: 30 * 60 * 60 * 1000,
  run: service => service.purgeStaleStaffCheckins(),
});
