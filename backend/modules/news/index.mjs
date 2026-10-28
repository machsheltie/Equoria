/**
 * news module public API (named-export service contract, Equoria-wbt8l).
 *
 * Lists exactly the names other modules and the shared job layer import: the
 * nightly job's entry points (postGameNewsEntries is the one door for any
 * game-written entry type, e.g. the future seasonal-competition scheduler)
 * and the account-data hooks the users module's GDPR export and erasure call.
 * Route modules are wired only by backend/app/routers.mjs and controllers are
 * never exported here.
 */

export { postDailyNewsEntries, postGameNewsEntries } from './services/dailyNewsEntries.mjs';
export { scrubNewsSignaturesForErasureTx } from './services/newsAccountRecords.mjs';
