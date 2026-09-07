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
