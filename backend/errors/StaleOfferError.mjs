/**
 * Shared stale-marketplace-offer error for staff hire paths (Equoria-bvddn.19).
 *
 * Mirrors the SHAPE of `RosterCapExceededError` (backend/errors/RosterCapExceededError.mjs,
 * Equoria-oey96.8) but lives in the same top-level shared `backend/errors/` because it is
 * thrown by THREE domain modules (grooms, riders AND trainers) — no single module owns it.
 * Each hire controller throws this ONE type from inside its hire `$transaction` when
 * `removeMarketplaceOfferCas` (backend/utils/staffMarketplaceOfferCas.mjs) reports the
 * offer list changed since the pre-transaction read: a concurrent hire of the same offer,
 * a concurrent hire of a different offer, or a marketplace refresh. The local catch maps
 * it to HTTP 409 — the hire transaction has already rolled back (no staff row, no charge,
 * no ledger entry).
 *
 * `withRetryableTxMapping` leaves it unchanged (it only maps Prisma P2028 interactive-
 * transaction timeouts to 503), so a thrown StaleOfferError propagates out of the wrapped
 * transaction to the controller catch intact.
 */
export class StaleOfferError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StaleOfferError';
    this.statusCode = 409;
  }
}

export default StaleOfferError;
