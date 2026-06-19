/**
 * createSequentially — serialize an array of insert/create thunks.
 *
 * Equoria-w5n8c / Equoria-jpmza (connection-contention root cause:
 * Equoria-jpmza / Equoria-fefh2.15).
 *
 * Runs an array of async thunks ONE AT A TIME instead of `Promise.all`.
 * A `Promise.all([ ...prisma.X.create() ])` fires all N inserts
 * concurrently — under heavy in-band jest file batches the prior files in
 * the same process may not have drained their connection-pool slots yet, so
 * a concentrated create burst can exceed the available connections and throw
 * a Prisma request error (the observed 1-in-8 flake). Serialising the
 * arrange-step inserts uses one connection at a time and removes the burst.
 *
 * This is NOT a retry and NOT a timeout bump — it only changes the
 * concurrency of the arrange-burst (serial instead of parallel). Test
 * behaviour, assertions, and fixtures are otherwise unchanged.
 *
 * jpmza fixed this in dashboardRoutes.test.mjs with a local copy; w5n8c
 * promotes it to this shared helper and migrates the sibling suites.
 *
 * @template T
 * @param {Array<() => Promise<T>>} thunks - array of zero-arg async factories,
 *   each typically `() => prisma.X.create({ ... })`.
 * @returns {Promise<T[]>} results in the same order as `thunks`.
 */
export async function createSequentially(thunks) {
  const created = [];
  for (const thunk of thunks) {
    created.push(await thunk());
  }
  return created;
}

export default createSequentially;
