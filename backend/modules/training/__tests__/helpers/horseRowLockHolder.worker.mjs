/**
 * Worker-thread helper for trainingAtomicWrites.integration.test.mjs
 * (Equoria-bvddn.17): a REAL, independent database writer that interleaves
 * deterministically with trainHorse.
 *
 * Why a worker thread: the lost-update window in a read-then-write stat update
 * is between a SELECT and an UPDATE issued by the same async function. To land
 * a concurrent write exactly inside that window, the main thread blocks
 * synchronously (Atomics.wait) while this worker — which has its own event loop
 * and its own pg connection — takes the horse row lock. Nothing in Equoria is
 * mocked; this is simply a second Postgres session.
 *
 * Protocol (workerData: { connectionString, horseId, stat, amount, flag }):
 *   1. On message 'lock': BEGIN; SELECT ... FOR UPDATE on the horse row; then
 *      set flag[0] = 1 and notify (the main thread resumes).
 *   2. Poll until some other session is blocked by this one
 *      (pg_blocking_pids) — i.e. trainHorse is waiting on the row lock.
 *   3. UPDATE horses SET <stat> = <stat> + amount; COMMIT.
 *   4. Post { done: true, sawWaiter } to the parent.
 */
import { parentPort, workerData } from 'node:worker_threads';
import pg from 'pg';

const { connectionString, horseId, stat, amount, flag } = workerData;
const flagView = new Int32Array(flag);

// Only stat columns this test uses — the identifier is interpolated, so it is
// allow-listed rather than taken from arbitrary input.
const ALLOWED_STATS = new Set(['speed', 'stamina', 'intelligence']);

async function run() {
  if (!ALLOWED_STATS.has(stat)) {
    throw new Error(`rowLockHolder: stat ${stat} not allow-listed`);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  let sawWaiter = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM horses WHERE id = $1 FOR UPDATE', [horseId]);
    Atomics.store(flagView, 0, 1);
    Atomics.notify(flagView, 0);

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const { rows } = await client.query(
        'SELECT count(*)::int AS n FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))',
      );
      if (rows[0].n > 0) {
        sawWaiter = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    await client.query(`UPDATE horses SET "${stat}" = "${stat}" + $1 WHERE id = $2`, [
      amount,
      horseId,
    ]);
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
  return sawWaiter;
}

parentPort.once('message', msg => {
  if (msg !== 'lock') {
    return;
  }
  run().then(
    sawWaiter => parentPort.postMessage({ done: true, sawWaiter }),
    err => {
      // Unblock the main thread so a setup failure surfaces as a test failure
      // instead of an Atomics.wait timeout.
      Atomics.store(flagView, 0, -1);
      Atomics.notify(flagView, 0);
      parentPort.postMessage({ done: false, error: err.message });
    },
  );
});
