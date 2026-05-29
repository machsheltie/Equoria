/**
 * 🛡️ MFA Within-Window Replay Protection Service (Equoria-y932s)
 *
 * Otplib's `authenticator.verify({ window: 1 })` accepts the SAME 6-digit code
 * for the full ±1-step (~60-90s) validity window. otplib has no notion of
 * "this code has already been consumed." If the second-factor channel is
 * compromised (XSS, MITM, network logger, shoulder-surf), an attacker can
 * replay a captured code within seconds and authenticate as the victim — the
 * second factor's entire value (single-use) is voided.
 *
 * This service adds the missing single-use property:
 *   1. Caller calls `hasBeenUsed(userId, token)` BEFORE accepting otplib's
 *      verification result.
 *   2. On a successful verifyToken, caller calls
 *      `recordSuccessfulVerification(userId, token)` to mark the code as
 *      consumed.
 *   3. Any subsequent `hasBeenUsed(userId, token)` within the TTL returns true
 *      — the controller treats the verify as failed and increments the
 *      mfaLockoutService failure counter (defence-in-depth: combined with
 *      kg7i2's 5-failures-in-5min cap, a brute-replay attack is bounded to a
 *      handful of attempts before the user is locked out).
 *
 * Storage:
 *   - In-memory Map (per-process). Same trade-off and design as
 *     `mfaLockoutService.mjs` — the cache must be reset on a controller-
 *     level success/failure decision, not a middleware decision, and the
 *     existing distributed authRateLimiter already caps cross-worker spread.
 *   - Lazy sweep on every read/write (no setInterval — keeps the event loop
 *     clean in tests).
 *   - The key is `userId + ':' + sha256(token)`. We never store the raw
 *     6-digit code, so a heap dump or accidental log emission of the cache
 *     does not leak in-flight codes.
 *
 * Horizontal-scaling consideration (documented per AC):
 *   On a single Node process the cache is authoritative. With horizontal
 *   scaling (PM2 cluster or multi-node), an attacker spreading replays
 *   across workers could land up to N-1 replays before the user's cache
 *   propagates. Mitigations already in place:
 *     - mfaLockoutService (Equoria-kg7i2): 5 failed-MFA / 5min / userId.
 *       A successful replay is NOT a failure, so it does not increment the
 *       counter directly — but the surrounding authRateLimiter caps the
 *       attack at 200 requests/15min/IP and the suspicious-activity
 *       detector flags rapid-fire bursts.
 *     - For multi-node deployments, this Map should be promoted to a
 *       Redis-backed cache with TTL keys (`SET key value EX ttl NX` for
 *       atomic check-and-set). That migration is a future spike — single-
 *       node beta does not require it.
 *
 * Sentinel coverage:
 *   backend/modules/auth/__tests__/mfaReplayProtection.test.mjs
 *
 * @module backend/modules/auth/services/mfaReplayProtectionService
 */

import crypto from 'crypto';

// TTL of 90 seconds — slightly wider than otplib's ±1-step window (60s) to
// cover boundary cases where the code is valid for the partial step at the
// edge of acceptance. A code captured at second 0 of step N could still be
// replayed at second 30 of step N+1; the 90s TTL covers the entire arc.
const REPLAY_TTL_MS = 90 * 1000;

// userId-scoped key → expiresAt epoch-ms
// Keying with sha256(token) (not raw token) keeps the cache scrub-safe.
const _used = new Map();

function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function _validKey(userId, token) {
  if (typeof userId !== 'string' || userId.length === 0) {
    return null;
  }
  if (typeof token !== 'string') {
    return null;
  }
  const normalized = token.trim();
  if (normalized.length === 0) {
    return null;
  }
  return `${userId}:${_hashToken(normalized)}`;
}

/**
 * Lazy sweep of expired entries on every read/write. Map churn is bounded
 * by (active MFA-enabled users) × (codes/window) so memory pressure is
 * trivial. No setInterval — that would keep the Jest event loop alive and
 * trigger --detectOpenHandles warnings.
 */
function _sweep(now) {
  for (const [key, expiresAt] of _used) {
    if (expiresAt <= now) {
      _used.delete(key);
    }
  }
}

/**
 * Returns true if (userId, token) has been successfully verified within the
 * last REPLAY_TTL_MS. The caller — after otplib says the code is valid —
 * MUST consult this and treat a `true` return as a verification failure
 * (replay detected).
 *
 * @param {string} userId
 * @param {string} token
 * @returns {boolean}
 */
export function hasBeenUsed(userId, token) {
  const key = _validKey(userId, token);
  if (!key) {
    return false;
  }
  const now = Date.now();
  _sweep(now);
  const expiresAt = _used.get(key);
  if (!expiresAt) {
    return false;
  }
  if (expiresAt <= now) {
    _used.delete(key);
    return false;
  }
  return true;
}

/**
 * Mark (userId, token) as consumed. Idempotent — re-recording the same
 * (userId, token) refreshes the TTL. Callers invoke this immediately AFTER
 * a successful otplib verifyToken AND a successful hasBeenUsed=false check.
 *
 * @param {string} userId
 * @param {string} token
 * @param {number} [nowMs] - test-only clock override; defaults to Date.now()
 */
export function recordSuccessfulVerification(userId, token, nowMs) {
  const key = _validKey(userId, token);
  if (!key) {
    return;
  }
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  _sweep(Date.now()); // sweep against real clock — test-clock entries expire on real-clock sweep too
  _used.set(key, now + REPLAY_TTL_MS);
}

/**
 * Test-only: drop all entries. NOT exported via service surface — callers
 * use this only from the dedicated test file.
 */
export function __resetForTests() {
  _used.clear();
}

/**
 * Test-only: force the lazy sweep so an entry recorded with a back-dated
 * `nowMs` (making expiresAt in the past) is cleared.
 */
export function __sweepExpiredForTests() {
  _sweep(Date.now());
}

/**
 * Test-only export of the TTL constant so the sentinel test can future-proof
 * against accidental TTL shortening to zero.
 */
export const __TTL_MS = REPLAY_TTL_MS;
