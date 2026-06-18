/**
 * Shared retryable-transaction mapping (Equoria-7x9po, extracted from the
 * Equoria-55m83 feedHorse fix).
 *
 * An interactive `prisma.$transaction` can fail TWO transient, RETRYABLE ways
 * under heavy contention + a small connection pool, both surfaced by Prisma as
 * `PrismaClientKnownRequestError` code `P2028` ("Transaction API error"):
 *   - "Unable to start a transaction in the given time." (maxWait pool-acquire)
 *   - "Transaction already closed: … the timeout for this transaction was
 *     5000 ms, however N ms passed …" (interactive timeout exceeded)
 * Both mean "the server was momentarily too busy to finish the transaction" —
 * a retryable condition that should map to HTTP 503 ("busy, retry shortly"),
 * NOT 500 (500 wrongly signals a permanent fault and tells clients NOT to
 * retry). The CI Load Contention advisory job surfaced exactly these.
 *
 * This util exists so the ~30 interactive-$transaction call sites across
 * backend/modules + backend/services can map P2028 -> 503 through ONE place
 * instead of copy-pasting the classifier + catch into each (OPTIMAL_FIX_
 * DISCIPLINE §5 architectural alternative). feedHorse is the proof-of-pattern
 * consumer; the remaining sites migrate incrementally (Equoria-<follow-up>).
 *
 * @module utils/retryableTransaction
 */

/**
 * Classify a thrown error as a TRANSIENT, RETRYABLE Prisma interactive-
 * transaction timeout (vs. a genuine fault).
 *
 * MUST stay narrow: genuine pre-condition errors (404/400 thrown inside the
 * txn) and other Prisma faults (e.g. P2002) MUST return false so they keep
 * surfacing as their own status / 500 — masking a real bug behind a 503 is the
 * failure mode this guard must never introduce (CLAUDE.md §3). Primary signal
 * is the P2028 code; the message regex is a belt-and-braces fallback for the
 * two known timeout phrasings in case a driver/version surfaces them without
 * the code.
 *
 * @param {unknown} err
 * @returns {boolean} true iff `err` is a retryable transaction-timeout error
 */
export function isRetryableTxError(err) {
  if (!err || typeof err !== 'object') {
    return false;
  }
  if (err.code === 'P2028') {
    return true;
  }
  const message = typeof err.message === 'string' ? err.message : '';
  return /unable to start a transaction|transaction already closed|transaction api error/i.test(
    message,
  );
}

/**
 * Await `promise` (typically the result of an interactive `prisma.$transaction`
 * call/chain) and, if it rejects with a retryable transaction-timeout, rethrow
 * a fresh Error carrying `status = 503` and a caller-supplied client message.
 * Any NON-retryable error rethrows UNCHANGED so genuine faults keep their own
 * status / surface as 500 (never masked behind a 503).
 *
 * @template T
 * @param {Promise<T>} promise - the transaction promise (or a chain off it)
 * @param {object} [opts]
 * @param {string} [opts.message] - client-facing 503 message for the retryable case
 * @param {number} [opts.status] - status to stamp (default 503); override only with reason
 * @returns {Promise<T>}
 */
export async function withRetryableTxMapping(promise, opts = {}) {
  const { message = 'The server is busy right now, please retry in a moment.', status = 503 } =
    opts;
  try {
    return await promise;
  } catch (err) {
    if (isRetryableTxError(err)) {
      const e = new Error(message);
      e.status = status;
      throw e;
    }
    throw err;
  }
}
