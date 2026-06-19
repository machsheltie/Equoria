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
 * This util exists so the ~24 interactive-$transaction call sites across
 * backend/modules + backend/services can map P2028 -> 503 through ONE place
 * instead of copy-pasting the classifier + catch into each (OPTIMAL_FIX_
 * DISCIPLINE §5 architectural alternative). feedHorse is the proof-of-pattern
 * consumer; the user-facing-mutation sites migrate to it under Equoria-7x9po.
 *
 * ── Why the retryable error is an AppError subclass carrying numeric
 *    `status` AND `statusCode` (Equoria-7x9po §1 audit finding) ──────────────
 * The migration is only correct if the 503 actually REACHES the client. The
 * controllers in this codebase surface a thrown error's status through THREE
 * different idioms, so the retryable error must satisfy all of them at once:
 *   1. Local catch reading numeric `error.status`
 *      (e.g. horseFeedController, feedShopController:
 *       `if (error.status) return res.status(error.status)…`).
 *   2. Local catch reading numeric `error.statusCode`
 *      (e.g. marketplaceController: `if (err.statusCode) res.status(err.statusCode)…`).
 *   3. `next(error)` to the central error handler
 *      (backend/middleware/errorHandler.mjs), which forwards via
 *      `res.status(error.statusCode || 500)` and — at several auth sites —
 *      only forwards UNCHANGED when `AppError.isAppError(error)` is true,
 *      else re-wraps as a generic 500.
 * `RetryableTransactionError extends AppError` makes `AppError.isAppError()`
 * true (idiom 3) and gives `statusCode = 503` (idioms 2 & 3). AppError's base
 * constructor sets the human `status` string ('error'); we OVERRIDE it to the
 * numeric `503` so idiom 1 reads the right HTTP code. (The base class is
 * untouched — only THIS subclass's instances carry a numeric `status`.)
 *
 * NOTE: a controller whose catch HARDCODES `res.status(500)` with no status
 * inspection will still swallow the 503 — those sites get a one-line
 * `if (error?.status === 503)` (or statusCode) guard added at migration time;
 * the error shape here cannot rescue a catch that never looks at it.
 *
 * @module utils/retryableTransaction
 */

import { AppError } from '../errors/index.mjs';

/**
 * Retryable transaction-timeout error. Subclass of AppError so the central
 * error handler's `AppError.isAppError()` forwards it unchanged and reads its
 * `statusCode`; the numeric `status` override serves local catches that read
 * `error.status` directly. `isOperational: true` (default) — this is an
 * expected, client-recoverable condition, not a programmer bug.
 */
export class RetryableTransactionError extends AppError {
  constructor(message, statusCode = 503) {
    super(message, statusCode);
    // AppError sets `this.status` to the human string ('error'/'fail').
    // Override to the NUMERIC HTTP code so controllers that surface a thrown
    // error via `res.status(error.status)` (feedHorse/feedShop idiom) send 503,
    // not the string 'error'. `statusCode` is already numeric from AppError.
    this.status = statusCode;
    this.name = 'RetryableTransactionError';
  }
}

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
 * a `RetryableTransactionError` carrying `status = statusCode = 503` and a
 * caller-supplied client message. Any NON-retryable error rethrows UNCHANGED so
 * genuine faults keep their own status / surface as 500 (never masked behind a
 * 503).
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
      throw new RetryableTransactionError(message, status);
    }
    throw err;
  }
}

/**
 * Ergonomic wrapper around `prisma.$transaction(fn, opts)` that applies the
 * retryable-503 mapping. Equivalent to
 * `withRetryableTxMapping(prismaClient.$transaction(fn, txOpts), { message })`
 * but reads more naturally at a call site that builds the transaction inline.
 *
 * The interactive form (`fn` is a function) is the one subject to P2028
 * timeouts; the batch-array form is generally read-only and not the target of
 * this fix, so this helper only accepts a callback.
 *
 * @template T
 * @param {{ $transaction: Function }} prismaClient - prisma (or a tx-capable client)
 * @param {(tx: any) => Promise<T>} fn - the interactive transaction callback
 * @param {object} [opts]
 * @param {string} [opts.message] - client-facing 503 message for the retryable case
 * @param {number} [opts.status] - status to stamp on the retryable error (default 503)
 * @param {object} [opts.txOptions] - forwarded to prisma.$transaction (timeout/maxWait/isolationLevel)
 * @returns {Promise<T>}
 */
export async function runRetryableTransaction(prismaClient, fn, opts = {}) {
  const { message, status, txOptions } = opts;
  const txPromise = txOptions
    ? prismaClient.$transaction(fn, txOptions)
    : prismaClient.$transaction(fn);
  return withRetryableTxMapping(txPromise, { message, status });
}
