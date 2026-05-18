/**
 * JWT signing-key rotation key-ring.
 *
 * Problem (Equoria-gjdj): JWT secrets were read directly from a single static
 * env var at every sign/verify call site. Rotating `JWT_SECRET` (or
 * `JWT_REFRESH_SECRET`) instantly invalidated every live session because the
 * old, still-unexpired tokens no longer verified.
 *
 * This module introduces a two-key ring per token kind:
 *
 *   - Sign ALWAYS with the CURRENT secret.
 *   - Verify against the CURRENT secret first, then — only if a signature
 *     mismatch — against an OPTIONAL PREVIOUS secret.
 *
 * Operationally this gives a rotation overlap window:
 *
 *   1. Set `JWT_SECRET_PREVIOUS` = old secret, `JWT_SECRET` = new secret.
 *      New tokens are signed with the new secret; old tokens still verify
 *      against the previous secret. No forced logout.
 *   2. After the longest token lifetime has elapsed (so no old-secret tokens
 *      can still be live), unset `JWT_SECRET_PREVIOUS`. The window closes;
 *      old-secret tokens are now rejected.
 *
 * Security invariants (locked by unit + sentinel tests):
 *   - The previous secret is NEVER used for signing.
 *   - `TokenExpiredError` / `NotBeforeError` / algorithm errors are propagated
 *     immediately — they do NOT fall through to the previous-key attempt
 *     (an expired token must read as expired, not be silently re-verified).
 *   - An unknown secret is rejected even when a previous secret is configured.
 *
 * @module utils/jwtKeyRing
 */

import jwt from 'jsonwebtoken';

/**
 * Env-var names per token kind. The "current" var is the one the rest of the
 * codebase already used; "previous" is the new, optional overlap-window var.
 */
const KEY_ENV = Object.freeze({
  access: { current: 'JWT_SECRET', previous: 'JWT_SECRET_PREVIOUS' },
  refresh: { current: 'JWT_REFRESH_SECRET', previous: 'JWT_REFRESH_SECRET_PREVIOUS' },
});

function envNames(kind) {
  const names = KEY_ENV[kind];
  if (!names) {
    throw new Error(
      `[jwtKeyRing] Unknown token kind "${kind}". Expected one of: ${Object.keys(KEY_ENV).join(', ')}.`,
    );
  }
  return names;
}

/**
 * The CURRENT secret for the given kind. Used for signing AND as the first
 * verification attempt. Throws if unset — fail-closed, never sign/verify with
 * an empty key.
 *
 * @param {'access'|'refresh'} kind
 * @returns {string}
 */
export function getSigningSecret(kind) {
  const { current } = envNames(kind);
  const value = process.env[current];
  if (!value || value.trim() === '') {
    throw new Error(`[jwtKeyRing] ${current} is not configured.`);
  }
  return value;
}

/**
 * The optional PREVIOUS secret for the given kind, or null if the rotation
 * overlap window is not open. NEVER used for signing.
 *
 * @param {'access'|'refresh'} kind
 * @returns {string|null}
 */
export function getPreviousSecret(kind) {
  const { previous } = envNames(kind);
  const value = process.env[previous];
  if (!value || value.trim() === '') {
    return null;
  }
  return value;
}

/**
 * Whether a rotation overlap window is currently open for this kind.
 *
 * @param {'access'|'refresh'} kind
 * @returns {boolean}
 */
export function hasPreviousSecret(kind) {
  return getPreviousSecret(kind) !== null;
}

/**
 * Verify a token against the key ring for the given kind.
 *
 * Tries the CURRENT secret first. Only on a *signature* failure
 * (`JsonWebTokenError` — e.g. "invalid signature") does it retry against the
 * PREVIOUS secret, if one is configured. Expiry / not-before / malformed /
 * algorithm errors are propagated immediately and are NOT retried against the
 * previous key.
 *
 * @param {string} token
 * @param {'access'|'refresh'} kind
 * @param {import('jsonwebtoken').VerifyOptions} [options]
 * @returns {object} the decoded payload
 * @throws the underlying jsonwebtoken error if no key in the ring verifies it
 */
export function verifyWithKeyRing(token, kind, options = {}) {
  const currentSecret = getSigningSecret(kind);

  try {
    return jwt.verify(token, currentSecret, options);
  } catch (currentErr) {
    // Only a pure signature/format mismatch is eligible for the previous-key
    // retry. An expired-but-otherwise-valid token signed with the CURRENT key
    // must surface as expired — NOT be re-checked against the previous key.
    const isSignatureError = currentErr && currentErr.name === 'JsonWebTokenError';

    if (!isSignatureError) {
      throw currentErr;
    }

    const previousSecret = getPreviousSecret(kind);
    if (!previousSecret) {
      // Window closed (or never opened): the current-key error stands.
      throw currentErr;
    }

    // Retry against the previous secret. If this also fails, the previous
    // error is the most informative one to surface.
    return jwt.verify(token, previousSecret, options);
  }
}

export default {
  getSigningSecret,
  getPreviousSecret,
  hasPreviousSecret,
  verifyWithKeyRing,
};
