/**
 * 🛡️ MFA Challenge Lockout Service (Equoria-kg7i2)
 *
 * Per-userId failed-attempt counter for POST /auth/mfa/challenge. The shared
 * authRateLimiter caps at 200 failures / 15min across ALL auth endpoints,
 * which is FAR too permissive for the 10^6 TOTP search space: a stolen
 * password + ~200 guesses per IP rotation gives realistic odds. This
 * service adds a dedicated cap (5 failures per userId per 5min window).
 *
 * On the 5th failure, the userId is "locked": any further mfa/challenge
 * request — even with a freshly-issued mfaChallengeToken from a new login —
 * is rejected with HTTP 429 until the lockout TTL elapses. The user must
 * wait, then log in again. A successful challenge resets the counter so
 * a single typo does not penalise legitimate users.
 *
 * Storage:
 *   - In-memory Map (per-process). The express-rate-limit RedisStore is
 *     not a good fit here because: (a) the counter is keyed by the userId
 *     decoded from the mfaChallengeToken in the request body, not by the
 *     authenticated session (req.user is undefined on this public endpoint);
 *     (b) the counter must be reset by a successful TOTP verification,
 *     which is a controller-level decision, not a middleware decision.
 *   - In-memory state is acceptable defence-in-depth on top of the existing
 *     authRateLimiter (which IS distributed via Redis): an attacker spreading
 *     guesses across multiple PM2 workers would still hit the 200/15min cap
 *     much earlier than 5 * workers per userId.
 *
 * Sentinel test:
 *   backend/modules/auth/__tests__/mfaChallengeLockout.integration.test.mjs
 *
 * @module backend/modules/auth/services/mfaLockoutService
 */

import logger from '../../../utils/logger.mjs';

const MAX_FAILURES = 5;
const LOCKOUT_TTL_MS = 5 * 60 * 1000; // matches the 5min mfaChallengeToken expiry

// userId → { count: number, lockedUntil: number | null }
// lockedUntil is an absolute epoch-ms cutoff (Date.now() comparison).
const _failures = new Map();

/**
 * Lazy sweep of expired entries on every read/write. Keeps the Map bounded
 * without a setInterval (which would keep the event loop alive in tests).
 * The map churn rate is bounded by total live MFA-enabled users * 5min
 * window — well under any realistic memory pressure even at scale.
 */
function _sweep(now) {
  for (const [userId, entry] of _failures) {
    // An entry can be cleared when EITHER the lockout has expired OR the
    // last failure is older than LOCKOUT_TTL_MS (so the counter naturally
    // decays even before reaching the cap).
    const lastTouchedAt = entry.lockedUntil ?? entry.firstFailureAt ?? 0;
    if (lastTouchedAt + LOCKOUT_TTL_MS <= now) {
      _failures.delete(userId);
    }
  }
}

/**
 * Check whether userId is currently locked out.
 * Returns { locked: boolean, retryAfterSec: number }.
 *
 * @param {string} userId
 * @returns {{ locked: boolean, retryAfterSec: number }}
 */
export function isLocked(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    return { locked: false, retryAfterSec: 0 };
  }
  const now = Date.now();
  _sweep(now);
  const entry = _failures.get(userId);
  if (!entry || !entry.lockedUntil) {
    return { locked: false, retryAfterSec: 0 };
  }
  if (entry.lockedUntil <= now) {
    // TTL elapsed; auto-clear.
    _failures.delete(userId);
    return { locked: false, retryAfterSec: 0 };
  }
  return {
    locked: true,
    retryAfterSec: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
  };
}

/**
 * Increment the failure counter for userId. Returns the new state, including
 * whether this failure crossed the lockout threshold.
 *
 * @param {string} userId
 * @returns {{ count: number, justLocked: boolean, lockedUntil: number | null }}
 */
export function recordFailure(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    return { count: 0, justLocked: false, lockedUntil: null };
  }
  const now = Date.now();
  _sweep(now);
  const existing = _failures.get(userId);
  const count = (existing?.count ?? 0) + 1;
  const firstFailureAt = existing?.firstFailureAt ?? now;
  let lockedUntil = existing?.lockedUntil ?? null;
  let justLocked = false;
  if (count >= MAX_FAILURES && !lockedUntil) {
    lockedUntil = now + LOCKOUT_TTL_MS;
    justLocked = true;
    logger.warn('[mfaLockoutService] User locked out of MFA challenge', {
      userId,
      count,
      lockoutTtlMs: LOCKOUT_TTL_MS,
    });
  }
  _failures.set(userId, { count, firstFailureAt, lockedUntil });
  return { count, justLocked, lockedUntil };
}

/**
 * Clear the failure counter for userId. Called after a successful TOTP
 * verification so a single typo before success does not penalise the user.
 *
 * @param {string} userId
 */
export function recordSuccess(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    return;
  }
  _failures.delete(userId);
}

/**
 * Test-only helper to drain in-memory state between describes. Exported with
 * an underscore prefix to make the test-only intent obvious at import sites.
 */
export function _resetMfaLockoutsForTest() {
  _failures.clear();
}

/**
 * Test-only inspection of the in-memory state. Returns a defensive copy
 * so callers cannot mutate the live Map.
 */
export function _peekMfaLockoutStateForTest(userId) {
  const entry = _failures.get(userId);
  if (!entry) {
    return null;
  }
  return { ...entry };
}

export const _config = Object.freeze({
  MAX_FAILURES,
  LOCKOUT_TTL_MS,
});
