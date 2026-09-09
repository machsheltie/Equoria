/**
 * Free-agent hire interleaving seam (Equoria-ypb7d.2, fix round 3).
 *
 * WHY THIS EXISTS. `hireFreeAgent` refuses a double hire with a guarded conditional
 * update: `updateMany` on the pool predicate, then `claimed.count !== 1` throws
 * `FreeAgentUnavailableError`, which the catch maps to **409**. That refusal was
 * asserted only by a two-caller `Promise.all` race, and the loser's status in that race
 * depends purely on whether its 404 pre-read resolves before or after the winner's
 * commit — so the assertion was flaky (measured at roughly 3-in-5 on this machine), and
 * loosening it to "404 or 409" left the 409 mapping asserted by nothing in the tree. A
 * re-review proved the cost: with `claimed.count !== 1` deleted from the controller, the
 * race case still passed four runs in six.
 *
 * The fix is not a stricter race; it is to stop racing. This seam suspends ONE in-flight
 * request between the pre-read and the claim, so a test can let the pre-read succeed,
 * claim the groom underneath it, release, and get 409 **every** time.
 *
 * WHY THE PAUSE IS SAFE HERE. The awaited call sits OUTSIDE `prisma.$transaction`, after
 * the pre-read and before the transaction opens. A suspended request therefore holds no
 * row locks and no pooled connection, which is exactly the failure that defeated the
 * mid-transaction rollback attempt in task-19 §7.2 (holding a transaction open starved
 * the test Prisma pool). Nothing about the transaction's own behaviour is simulated: the
 * debit, the guarded claim, the cap re-count and the rollback are all the real ones.
 *
 * WHAT THIS SEAM MAY DO: delay, or abort. It receives a stage name and a read-only
 * context and awaits whatever the test hands back; a rejection propagates out of
 * `hireFreeAgent`'s try block. It never supplies a query result, never fabricates data,
 * and never changes what SQL any statement runs.
 *
 * Safety, following `backend/modules/marketplace/services/marketplaceRaceBarrier.mjs`
 * (Equoria-6p398.4), which established this pattern in this codebase:
 *   - `__TESTING_ONLY_setGroomHireRaceBarrier` THROWS outside `NODE_ENV === 'test'`, so
 *     the barrier can never be armed by a deployed process.
 *   - Unarmed — always, in production — `__TESTING_ONLY_awaitGroomHireRaceBarrier`
 *     returns immediately without touching the database.
 *   - This module is deliberately NOT re-exported from `backend/modules/grooms/index.mjs`:
 *     it is a same-module internal, not part of the grooms public API.
 *
 * Naming: both exports carry the `__TESTING_ONLY_` prefix so
 * `scripts/doctrine-checks/check-no-test-only-imports.mjs` can see every consumer,
 * including the one production call site that awaits it. That file is registered in the
 * check's `PERMITTED_TEST_ONLY_IMPORTS` allow-list with the reason above; the check flags
 * every OTHER `__TESTING_ONLY_` import, so the seam stays visible rather than passing by
 * naming omission.
 *
 * Tests MUST clear the barrier in a `finally` (or `afterEach`) so a failed assertion
 * cannot leave a later suite suspended.
 */

let armedBarrier = null;

/**
 * Arm (or, with `null`, disarm) the interleaving barrier. Test-only.
 *
 * @param {null | ((stage: string, context: object) => Promise<void>|void)} barrier
 */
export function __TESTING_ONLY_setGroomHireRaceBarrier(barrier) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__TESTING_ONLY_setGroomHireRaceBarrier is a test-only seam');
  }
  armedBarrier = typeof barrier === 'function' ? barrier : null;
}

/**
 * Await the armed barrier, if any. No-op in production.
 *
 * @param {string} stage — call-site identity, e.g. 'hireFreeAgent:afterPoolPreRead'
 * @param {object} context — read-only identifiers so a test can target one request
 */
export async function __TESTING_ONLY_awaitGroomHireRaceBarrier(stage, context) {
  if (armedBarrier === null || process.env.NODE_ENV !== 'test') {
    return;
  }
  await armedBarrier(stage, context);
}
