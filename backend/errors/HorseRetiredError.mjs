/**
 * A retired horse is given no new staff (Equoria-6p398.14 follow-up).
 *
 * Owner ruling 2026-10-23 (Stacey): assigning a NEW groom, rider or trainer to a
 * retired horse — 21 or over and not in foal — is refused with a clear message.
 * The horses module decides who is retired (horseRetirementStaff.mjs); the groom,
 * rider and trainer assign paths throw this one type, so it lives in the shared
 * `backend/errors/` like RosterCapExceededError (no module owns all three doors).
 *
 * It carries both spellings of the HTTP status the assign catch blocks read
 * (`status` for the rider/trainer controllers, `statusCode` for the groom ones)
 * and a machine-readable `code` the response body repeats for client branching.
 * `withRetryableTxMapping` leaves it unchanged, so it reaches those catches intact.
 */

/** Machine-readable refusal code; camelCase like every name Equoria controls. */
export const horseRetiredCode = 'horseRetired';

export class HorseRetiredError extends Error {
  constructor(
    message = 'This horse has retired. Horses aged 21 and over cannot be given a new groom, rider or trainer.',
  ) {
    super(message);
    this.name = 'HorseRetiredError';
    this.status = 400;
    this.statusCode = 400;
    this.code = horseRetiredCode;
  }
}

export default HorseRetiredError;
