/**
 * Shared recovery-identity policy for `User.email` (Equoria-6p398.5, Finding 5).
 *
 * The audit found that `PUT /api/v1/auth/profile` replaced `User.email`
 * outright — keeping `emailVerified` / `emailVerifiedAt` — with nothing but the
 * current session and a CSRF token, and that the sibling `PUT /api/v1/users/:id`
 * was an alternate write path with its own (weaker) rule. The email address IS
 * the account-recovery identity: whoever controls it can drive
 * `POST /auth/forgot-password` to lasting access. A stolen session must not be
 * able to move it.
 *
 * This module is deliberately tiny, dependency-light and DB-free so BOTH
 * controllers (auth module and users module) can enforce the SAME rule without
 * a cross-module barrel import: ordinary profile writes may never carry a
 * changed recovery address. The staged request/confirm flow that CAN move it
 * lives in `backend/modules/auth/services/emailChangeService.mjs`.
 *
 * Normalization matches the existing signup/login behavior rather than
 * inventing new rules: the route validators run express-validator's
 * `normalizeEmail()` (register: authRoutes.mjs) and `getUserByEmail` looks up
 * with `.toLowerCase()`. This helper only trims and lower-cases so that a
 * differently-cased spelling of the SAME stored address is recognised as the
 * no-op it is. No provider-specific (dot/subaddress) rules are added here.
 */

import AppError from '../errors/AppError.mjs';

/** Machine-readable code carried on the rejection so clients can route to the flow. */
export const EMAIL_CHANGE_REQUIRES_CONFIRMATION = 'EMAIL_CHANGE_REQUIRES_CONFIRMATION';

export const EMAIL_CHANGE_REQUIRES_CONFIRMATION_MESSAGE =
  'Changing your email address changes how you recover this account, so it cannot be done from an ordinary profile update. ' +
  'Start the change at POST /api/v1/auth/email-change/request (current password required) and confirm the link sent to the new address.';

/**
 * Trim + lower-case an address for comparison. Returns `null` for anything
 * that is not a usable string, so callers can distinguish "not supplied" from
 * "supplied and different".
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeEmailAddress(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Mask an address for a read surface (Equoria-6p398.11, Finding 9).
 *
 * A pending recovery-address change is reported back to the account's own
 * session, but reporting it in full would make any read of that surface a
 * clear-text copy of an address the player may not have finished proving she
 * controls — and the same shape is what a leaked screenshot or a shoulder
 * would carry. Keeping the first character of the local part plus the whole
 * domain is enough for the owner to recognise "yes, that is the address I
 * typed" without reprinting it.
 *
 * Lives here rather than in the email-change service because it is the same
 * class of dependency-free, DB-free address rule as `normalizeEmailAddress`,
 * and any other read surface that needs it can import it without pulling in
 * Prisma. (Grep-checked 2026-09-07: no masking helper existed anywhere in
 * `backend/utils` or `backend/modules` before this one.)
 *
 * @param {unknown} raw
 * @returns {string|null} `j***@example.com`, `***` for an unusable shape, or
 *   `null` when there was no address at all.
 */
export function maskEmailAddress(raw) {
  const normalized = normalizeEmailAddress(raw);
  if (!normalized) {
    return null;
  }
  const at = normalized.lastIndexOf('@');
  // No local part, no domain, or no separator at all: reveal nothing rather
  // than guessing at a shape we do not recognise.
  if (at <= 0 || at === normalized.length - 1) {
    return '***';
  }
  // Code points, not UTF-16 units: `slice(0, 1)` would cut an astral first
  // character in half and emit a lone surrogate.
  const [firstCharacter] = Array.from(normalized.slice(0, at));
  return `${firstCharacter}***${normalized.slice(at)}`;
}

/**
 * The authoritative guard for every ordinary profile-update surface.
 *
 * - Address absent / empty  → nothing to do.
 * - Address equal (after normalization) to the stored one → a NO-OP. It must
 *   NOT reset `emailVerified` / `emailVerifiedAt`; the caller simply drops the
 *   field from its update payload.
 * - Address different → rejected with HTTP 403. Neither the address nor the
 *   verification columns are touched, so a stolen session leaves no trace.
 *
 * @param {{ requestedEmail: unknown, currentEmail: unknown }} params
 * @returns {{ changed: false, supplied: boolean, normalized: string|null }}
 * @throws {AppError} 403 when the request would move the recovery identity.
 */
export function assertNoDirectEmailWrite({ requestedEmail, currentEmail }) {
  const requested = normalizeEmailAddress(requestedEmail);
  if (requested === null) {
    return { changed: false, supplied: false, normalized: null };
  }

  const current = normalizeEmailAddress(currentEmail);
  if (requested === current) {
    return { changed: false, supplied: true, normalized: requested };
  }

  const error = new AppError(EMAIL_CHANGE_REQUIRES_CONFIRMATION_MESSAGE, 403);
  error.code = EMAIL_CHANGE_REQUIRES_CONFIRMATION;
  throw error;
}
