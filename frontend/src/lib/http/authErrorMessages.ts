/**
 * User-safe copy for the two steps of signing in (Finding 7, Equoria-6p398.7).
 *
 * FRONTEND_ASYNC_STATE_DOCTRINE §4 forbids rendering a raw server error string.
 * The shared `userMessageFor` mapper is the right tool almost everywhere, but
 * its 401 branch answers "Your session expired — log in again", which is true
 * for a protected request and wrong on the login surface: the player has no
 * session yet, and a 401 there means the credentials — or the second factor —
 * were refused. These two mappers keep the taxonomy discipline (classify by
 * `ApiError.statusCode`, never echo `error.message`) with copy that fits the
 * step the player is actually standing on.
 *
 * Both are total, pure functions over `ApiError | null`, mirroring
 * `userMessageFor`'s contract. They live beside it rather than inside
 * `LoginPage` so the second-factor copy travels with `SecondFactorForm` to any
 * future step-up surface.
 */

import type { ApiError } from './types.js';

/** Copy for a refused email/password submission. */
export function credentialsMessage(error: ApiError | null | undefined): string | null {
  if (!error) return null;
  const status = error.statusCode;

  // Network / offline — apiClient normalizes a rejected fetch to statusCode 0.
  if (status === 0) {
    return "Can't reach the stable. Check your connection and try again.";
  }
  if (status === 400) {
    return 'Check your email and password, then try again.';
  }
  // Deliberately does not distinguish "no such account" from "wrong password";
  // the backend already answers both with one generic 401 to avoid an account
  // enumeration oracle (Equoria-gm4fg), and the copy must not undo that.
  if (status === 401) {
    return "That email and password don't match an account.";
  }
  if (status === 429) {
    return 'Too many sign-in attempts. Wait a few minutes, then try again.';
  }
  if (status >= 500) {
    return 'Something went wrong on our end. Try again in a moment.';
  }
  return "That didn't work. Check your details and try again.";
}

/**
 * Copy for a refused second factor.
 *
 * A refused code and an aged-out challenge are indistinguishable on the wire —
 * `mfaController.mfaChallenge` answers both with a bare 401 — so the 401 copy
 * names both remedies, and the caller keeps the way back to the credentials
 * form on screen.
 */
export function secondFactorMessage(error: ApiError | null | undefined): string | null {
  if (!error) return null;
  const status = error.statusCode;

  if (status === 0) {
    return "Can't reach the stable. Check your connection and try again.";
  }
  if (status === 400) {
    return 'Enter the six digits from your authenticator app, or one of your recovery codes.';
  }
  if (status === 401) {
    return "That code wasn't accepted. Enter the code showing now — or go back and sign in again if you have been waiting a while.";
  }
  if (status >= 500) {
    return 'Something went wrong on our end. Try again in a moment.';
  }
  return "That code wasn't accepted. Try again.";
}

/**
 * Copy for a refused recovery-address change request (Finding 9,
 * Equoria-6p398.11).
 *
 * `emailChangeService.requestEmailChange` answers a wrong password and a
 * missing/invalid TOTP with the SAME bare 401, so the 401 copy cannot name one
 * cause on its own. `secondFactorRequired` — read from
 * `GET /auth/email-change/status`, not guessed — is what lets the copy name the
 * two things the player actually typed instead of blaming the wrong one.
 *
 * 429 covers both throttles on that endpoint: the MFA lockout and the
 * five-minute resend cooldown. Both are a wait, not a lockout of the account,
 * and the backend's own `retryAfter` seconds are rendered when present so the
 * player is not told to guess.
 */
export function recoveryAddressMessage(
  error: ApiError | null | undefined,
  options: { secondFactorRequired?: boolean } = {}
): string | null {
  if (!error) return null;
  const status = error.statusCode;

  if (status === 0) {
    return "Can't reach the stable. Check your connection and try again.";
  }
  if (status === 400) {
    // Also the "already the address on this account" and pending-cap refusals.
    return 'Check the address you entered, then try again. If several changes are already waiting, confirm or let them lapse first.';
  }
  if (status === 401) {
    return options.secondFactorRequired
      ? "That password or code wasn't accepted. Re-enter your password and the code showing now."
      : "That password wasn't accepted. Enter your current Equoria password and try again.";
  }
  if (status === 409) {
    return 'That address already belongs to another stable. Choose a different one.';
  }
  if (status === 429) {
    const seconds = typeof error.retryAfter === 'number' ? error.retryAfter : null;
    if (!seconds || seconds <= 0) {
      return 'Too many attempts. Wait a few minutes, then try again.';
    }
    const minutes = Math.ceil(seconds / 60);
    return `Too many attempts. Wait about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, then try again.`;
  }
  if (status === 502) {
    // The change IS staged; only the letter failed. Saying otherwise would lie.
    return "Your change is waiting, but we couldn't send the letter. Try again in a moment to send a new one.";
  }
  if (status >= 500) {
    return 'Something went wrong on our end. Try again in a moment.';
  }
  return "That didn't work. Check your details and try again.";
}

/**
 * Copy for a refused confirmation link.
 *
 * Every unusable link — unknown, expired, already used, superseded by a newer
 * request, wrong purpose, wrong account — is deliberately the same 400 on the
 * backend so a holder cannot probe other people's pending changes
 * (emailChangeService.INVALID_LINK_MESSAGE). The copy respects that: it names
 * the remedy, not the cause.
 */
export function confirmRecoveryAddressMessage(error: ApiError | null | undefined): string | null {
  if (!error) return null;
  const status = error.statusCode;

  if (status === 0) {
    return "Can't reach the stable. Check your connection and try again.";
  }
  if (status === 400) {
    return 'This link is no longer good. A confirmation link lasts 24 hours, works once, and is replaced whenever a newer change is requested. Ask for a fresh one from your settings.';
  }
  if (status === 409) {
    return 'That address already belongs to another stable, so it cannot become yours. Choose a different one from your settings.';
  }
  if (status === 429) {
    return 'Too many attempts. Wait a few minutes, then open the link again.';
  }
  if (status >= 500) {
    return 'Something went wrong on our end. Try the link again in a moment.';
  }
  return 'This link could not be used. Ask for a fresh one from your settings.';
}
