/**
 * Marketplace interleaving seam (Equoria-6p398.4 / audit finding 4).
 *
 * The stale-listing defect this exists to prove lives ENTIRELY INSIDE one
 * `buyHorse` transaction: the authoritative listing is read, and only later is
 * ownership claimed. Reproducing "buyer B pauses after reading the listing
 * while buyer C buys and relists" therefore needs a way to suspend ONE
 * in-flight request between those two statements.
 *
 * What this seam is allowed to do: DELAY, or ABORT. It receives a stage name
 * and a read-only context and awaits whatever the test hands back; if that
 * throws, the rejection propagates out of the surrounding transaction and rolls
 * it back. It never supplies a query result, never fabricates data, and never
 * changes what SQL a statement runs — every read and write that executes in
 * `buyHorse` is the real one, against the real database, in the real
 * transaction. An abort ends the transaction where it stands; it does not
 * re-route it down a different branch.
 *
 * The abort form exists for one thing a rejected purchase cannot demonstrate:
 * that writes made LATE in the transaction (the tack return and staff
 * reconciliation, `horseTransfer:afterReconciliation`) roll back with it. Every
 * ordinary rejection — insufficient funds, a stale listing — fails BEFORE those
 * writes, so it proves nothing about them.
 *
 * Safety:
 *   - `__TESTING_ONLY_setMarketplaceRaceBarrier` throws outside
 *     `NODE_ENV === 'test'`, so the barrier can never be armed by a deployed
 *     process.
 *   - Unarmed (always, in production) `__TESTING_ONLY_awaitMarketplaceRaceBarrier`
 *     returns immediately without touching the database.
 *   - This module is deliberately NOT re-exported from
 *     `backend/modules/marketplace/index.mjs`: it is a same-module internal,
 *     not part of the marketplace public API.
 *
 * Naming (Equoria-6p398.4): both exports carry the `__TESTING_ONLY_` prefix so
 * `scripts/doctrine-checks/check-no-test-only-imports.mjs` can see every
 * consumer of this seam, including the two production call sites that await
 * it. Those two files are registered in that check's permitted-import
 * allow-list with the reason this file documents above — the check flags
 * every OTHER `__TESTING_ONLY_` import, so the seam stays visible rather than
 * passing by naming omission.
 *
 * Tests MUST clear the barrier in a `finally` (or `afterEach`) so a failed
 * assertion cannot leave a later suite suspended.
 */

let armedBarrier = null;

/**
 * Arm (or, with `null`, disarm) the interleaving barrier. Test-only.
 *
 * @param {null | ((stage: string, context: object) => Promise<void>|void)} barrier
 */
export function __TESTING_ONLY_setMarketplaceRaceBarrier(barrier) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__TESTING_ONLY_setMarketplaceRaceBarrier is a test-only seam');
  }
  armedBarrier = typeof barrier === 'function' ? barrier : null;
}

/**
 * Await the armed barrier, if any. No-op in production.
 *
 * @param {string} stage — call-site identity, e.g. 'buyHorse:afterListingRead'
 * @param {object} context — read-only identifiers so a test can target one request
 */
export async function __TESTING_ONLY_awaitMarketplaceRaceBarrier(stage, context) {
  if (armedBarrier === null || process.env.NODE_ENV !== 'test') {
    return;
  }
  await armedBarrier(stage, context);
}
