/**
 * Shared roster-cap error for staff hire paths (Equoria-oey96.8).
 *
 * Mirrors the SHAPE of the grooms-module `CapExceededError`
 * (backend/modules/grooms/groomErrors.mjs, Equoria-n4m5j / hduc5) but lives in
 * the top-level shared `backend/errors/` because it is thrown by TWO domain
 * modules (riders AND trainers) — no single module owns it, and a cross-module
 * import of another module's internal error would violate the module-barrel
 * boundary (backend/eslint.config.mjs, Equoria-v8l96.4). Both
 * riderMarketplaceController and trainerMarketplaceController throw this ONE
 * type from inside their hire `$transaction` after the authoritative post-lock
 * re-count; the local catch maps it to the roster-cap HTTP 400.
 *
 * `withRetryableTxMapping` leaves it unchanged (it only maps Prisma P2028
 * interactive-transaction timeouts to 503), so a thrown RosterCapExceededError
 * propagates out of the wrapped transaction to the controller catch intact.
 */
export class RosterCapExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RosterCapExceededError';
    this.statusCode = 400;
  }
}

export default RosterCapExceededError;
