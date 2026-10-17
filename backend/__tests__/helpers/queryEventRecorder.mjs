/**
 * Attribute Prisma query events to the call that issued them (Equoria-hajbq).
 *
 * Read-count suites observe a REAL PrismaClient created with
 * `log: [{ emit: 'event', level: 'query' }]`. Prisma delivers each query event
 * through the engine's log callback, which is a separate native-to-JS delivery
 * from the one that resolves the query's promise; nothing orders the two. On a
 * loaded runner the awaiting code can resume first, so "reset, await, read"
 * counted 0 for a call and the late event landed in the next test's window
 * (CI run 39020787961: 0 then 2).
 *
 * The log callback itself is one FIFO queue: events arrive in the order the
 * engine ran the statements. measure() therefore brackets the call with two
 * barrier statements and waits until each barrier's OWN event has arrived.
 * Every statement the call ran was executed before the closing barrier, so
 * its event has arrived by then; nothing from before the opening barrier can
 * fall inside. The statements between the two barriers are exactly the
 * call's (plus anything else that ran on the client concurrently, as before).
 *
 * Usage: create once per client, before any measured call, then
 *   const { result, statements } = await recorder.measure(() => work());
 * measure() calls must not overlap.
 */

const BARRIER_TIMEOUT_MS = 10000;
let barrierSequence = 0;

/**
 * @param {{ $on: Function, $queryRawUnsafe: Function }} client a PrismaClient
 *   created with query-event logging
 * @returns {{ measure: (fn: () => any) => Promise<{ result: any, statements: string[] }> }}
 */
export function createQueryEventRecorder(client) {
  const log = [];
  const pendingBarriers = new Map();

  client.$on('query', event => {
    log.push(event.query);
    const arrived = pendingBarriers.get(event.query);
    if (arrived) {
      pendingBarriers.delete(event.query);
      arrived(log.length - 1);
    }
  });

  /** Runs one barrier statement; resolves with the index of its event in `log`. */
  async function barrier() {
    barrierSequence += 1;
    const sql = `SELECT ${barrierSequence} AS "query_event_recorder_barrier"`;
    const arrival = new Promise(resolve => pendingBarriers.set(sql, resolve));
    let timer;
    try {
      await client.$queryRawUnsafe(sql);
      const missing = new Promise((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `queryEventRecorder: no query event for "${sql}" within ${BARRIER_TIMEOUT_MS} ms; ` +
                  "was the client created with log: [{ emit: 'event', level: 'query' }]?",
              ),
            ),
          BARRIER_TIMEOUT_MS,
        );
      });
      return await Promise.race([arrival, missing]);
    } finally {
      clearTimeout(timer);
      pendingBarriers.delete(sql);
    }
  }

  return {
    async measure(fn) {
      const start = await barrier();
      const result = await fn();
      const end = await barrier();
      const statements = log.slice(start + 1, end);
      log.length = 0;
      return { result, statements };
    },
  };
}
