/**
 * Grooms-module domain errors.
 *
 * Equoria-hduc5: `CapExceededError` was originally controller-local to
 * groomRosterController (Equoria-n4m5j), whose direct hire was retired by
 * Equoria-bvddn.7. Marketplace hire
 * (groomMarketplaceController.hireFromMarketplace) throws it. The hire
 * transaction catches it and maps it to the roster-cap 400, and
 * `withRetryableTxMapping` leaves it unchanged (it is not a P2028 timeout).
 * Rider/trainer roster caps (Equoria-v9s0r) can reuse this type or mirror its
 * shape when those caps are implemented.
 */
export class CapExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CapExceededError';
    this.statusCode = 400;
  }
}
