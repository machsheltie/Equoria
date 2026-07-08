/**
 * 🛡️ MFA Challenge/Disable Lockout Service (Equoria-kg7i2 / Equoria-uqq8n / Equoria-mwi6k)
 *
 * Per-userId failed-attempt counter for the two brute-forceable TOTP endpoints:
 *   - POST /auth/mfa/challenge  (public — second factor of login)
 *   - POST /auth/mfa/disable    (authenticated)
 *
 * The shared authRateLimiter caps at 200 failures / 15min across ALL auth
 * endpoints, which is FAR too permissive for the 10^6 TOTP search space: a
 * stolen password + ~200 guesses per IP rotation gives realistic odds. This
 * service adds a dedicated cap (5 failures per userId per 5min window).
 *
 * On the 5th failure, the userId is "locked": any further mfa/challenge or
 * mfa/disable request — even with a freshly-issued mfaChallengeToken from a
 * new login — is rejected with HTTP 429 until the lockout TTL elapses. The
 * user must wait, then log in again. A successful challenge/disable resets the
 * counter so a single typo does not penalise legitimate users.
 *
 * Storage — DISTRIBUTED (Equoria-mwi6k, USER DECISION 2026-07-07):
 *   - REDIS-BACKED when the shared rate-limiter Redis client is connected, so
 *     the 5/5-min bound holds ACROSS NODES. The counter reuses the SAME Redis
 *     connection the rate limiters already own (getRedisClient /
 *     isRedisConnected from middleware/rateLimiting.mjs) — no new client is
 *     opened. It is keyed by the userId decoded from the mfaChallengeToken
 *     (challenge) or req.user.id (disable).
 *   - IN-MEMORY FALLBACK (per-process Map) only when Redis is intentionally
 *     disabled (test/jest, beta-readiness) or a transient Redis command error
 *     occurs. Both /mfa/challenge and /mfa/disable sit behind the
 *     authRateLimiter, which fails CLOSED (503) on a SUSTAINED Redis outage
 *     (Equoria-dzit3) — so during a real outage the request never reaches this
 *     service, and the in-memory fallback covers only the
 *     Redis-intentionally-disabled case (tests) and transient hiccups.
 *
 * Sentinel tests:
 *   - backend/modules/auth/__tests__/mfaChallengeLockout.integration.test.mjs
 *   - backend/modules/auth/__tests__/mfaDisableLockout.integration.test.mjs
 *   - backend/modules/auth/__tests__/mfaLockoutStore.redis.test.mjs (cross-node)
 *
 * @module backend/modules/auth/services/mfaLockoutService
 */

import logger from '../../../utils/logger.mjs';
// Equoria-mwi6k: reuse the SAME Redis connection the rate limiters already own
// (no new client). middleware/rateLimiting.mjs is the single owner of the
// shared distributed store; module→middleware imports are an established,
// ESLint-clean pattern (authSessionService, createHorseService). We only READ
// the connection here — rateLimiting.mjs is not modified.
import { getRedisClient, isRedisConnected } from '../../../middleware/rateLimiting.mjs';

const MAX_FAILURES = 5;
const LOCKOUT_TTL_MS = 5 * 60 * 1000; // matches the 5min mfaChallengeToken expiry
const REDIS_KEY_PREFIX = 'mfa:lockout:'; // namespaced away from the rl:* limiter keys

function redisKey(userId) {
  return `${REDIS_KEY_PREFIX}${userId}`;
}

/**
 * Build a lockout store. Dependencies are injected so tests can drive the
 * distributed path with a fake shared Redis client + forced connection state
 * (mirrors how rateLimitFailClosed.test.mjs injects predicates). Production
 * wires the real shared rate-limiter Redis client via the default singleton
 * exported below.
 *
 * @param {Object} [deps]
 * @param {Function} [deps.getRedisClient] - returns the shared Redis client or null
 * @param {Function} [deps.isRedisConnected] - returns true when Redis is usable
 * @returns {{ isLocked: Function, recordFailure: Function, recordSuccess: Function,
 *            _resetForTest: Function, _peekForTest: Function }}
 */
export function createMfaLockoutStore(deps = {}) {
  // Injected (test) or real (production) accessors for the shared Redis client.
  const resolveRedisClient = deps.getRedisClient ?? getRedisClient;
  const resolveRedisConnected = deps.isRedisConnected ?? isRedisConnected;

  // Per-process in-memory fallback (the pre-Equoria-mwi6k behavior). Used only
  // when Redis is unavailable for a given call.
  // userId → { count: number, firstFailureAt: number, lockedUntil: number | null }
  // lockedUntil is an absolute epoch-ms cutoff (Date.now() comparison).
  const _failures = new Map();

  /**
   * Lazy sweep of expired entries on every read/write. Keeps the Map bounded
   * without a setInterval (which would keep the event loop alive in tests).
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

  function _memIsLocked(userId) {
    const now = Date.now();
    _sweep(now);
    const entry = _failures.get(userId);
    if (!entry || !entry.lockedUntil) {
      return { locked: false, retryAfterSec: 0 };
    }
    if (entry.lockedUntil <= now) {
      _failures.delete(userId);
      return { locked: false, retryAfterSec: 0 };
    }
    return {
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
    };
  }

  function _memRecordFailure(userId) {
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
      logger.warn('[mfaLockoutService] User locked out of MFA (in-memory)', {
        userId,
        count,
        lockoutTtlMs: LOCKOUT_TTL_MS,
      });
    }
    _failures.set(userId, { count, firstFailureAt, lockedUntil });
    return { count, justLocked, lockedUntil };
  }

  function _memRecordSuccess(userId) {
    _failures.delete(userId);
  }

  // ── Redis-backed path (Equoria-mwi6k) ──────────────────────────────────────
  // Single-key model: `mfa:lockout:<userId>` holds the failure count.
  //   - The window is anchored to the first failure (PEXPIRE set when
  //     INCR returns 1) — a fixed 5-min window matching the in-memory
  //     firstFailureAt sweep.
  //   - Crossing the cap (INCR returns exactly MAX_FAILURES) re-arms PEXPIRE so
  //     the lockout lasts a full LOCKOUT_TTL_MS from the moment of locking
  //     (mirrors lockedUntil = now + TTL). The exact `=== MAX_FAILURES` check
  //     gives the in-memory `!lockedUntil` NX behavior for free: INCR is
  //     atomic, so exactly one caller (even across nodes) observes the crossing
  //     value, so subsequent failures never re-extend the lock.
  //   - `locked` is derived from count >= MAX_FAILURES AND a live TTL.

  /** Is the shared Redis store usable for this call? */
  function redisActive() {
    try {
      return resolveRedisConnected() === true && Boolean(resolveRedisClient());
    } catch {
      return false;
    }
  }

  /** Redis commands are all-string args; sendCommand mirrors the RedisStore wrapper. */
  function cmd(client, args) {
    return client.sendCommand(args.map(String));
  }

  async function _redisIsLocked(client, userId) {
    const key = redisKey(userId);
    const raw = await cmd(client, ['GET', key]);
    const count = raw === null || raw === undefined ? 0 : Number(raw);
    if (!Number.isFinite(count) || count < MAX_FAILURES) {
      return { locked: false, retryAfterSec: 0 };
    }
    const pttl = Number(await cmd(client, ['PTTL', key]));
    if (!Number.isFinite(pttl) || pttl <= 0) {
      // Key expired between GET and PTTL — treat as unlocked (mirrors the
      // in-memory `lockedUntil <= now` auto-clear branch).
      return { locked: false, retryAfterSec: 0 };
    }
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil(pttl / 1000)) };
  }

  async function _redisRecordFailure(client, userId) {
    const key = redisKey(userId);
    const count = Number(await cmd(client, ['INCR', key]));
    if (count === 1) {
      // First failure — anchor the fixed counting window.
      await cmd(client, ['PEXPIRE', key, LOCKOUT_TTL_MS]);
    }
    let justLocked = false;
    if (count === MAX_FAILURES) {
      // Threshold crossing — re-arm TTL so the lock lasts TTL from this moment.
      await cmd(client, ['PEXPIRE', key, LOCKOUT_TTL_MS]);
      justLocked = true;
      logger.warn('[mfaLockoutService] User locked out of MFA (Redis)', {
        userId,
        count,
        lockoutTtlMs: LOCKOUT_TTL_MS,
      });
    }
    const lockedUntil = count >= MAX_FAILURES ? Date.now() + LOCKOUT_TTL_MS : null;
    return { count, justLocked, lockedUntil };
  }

  async function _redisRecordSuccess(client, userId) {
    await cmd(client, ['DEL', redisKey(userId)]);
  }

  async function isLocked(userId) {
    if (typeof userId !== 'string' || userId.length === 0) {
      return { locked: false, retryAfterSec: 0 };
    }
    if (redisActive()) {
      try {
        return await _redisIsLocked(resolveRedisClient(), userId);
      } catch (err) {
        // Graceful degradation: a transient Redis error must not 500 the MFA
        // endpoint. A SUSTAINED outage is handled upstream — /mfa/challenge and
        // /mfa/disable sit behind the authRateLimiter, which fails CLOSED (503)
        // on a real outage (Equoria-dzit3) — so this fallback covers only
        // transient command hiccups.
        logger.warn('[mfaLockoutService] Redis isLocked failed — using in-memory fallback', {
          error: err?.message,
        });
      }
    }
    return _memIsLocked(userId);
  }

  async function recordFailure(userId) {
    if (typeof userId !== 'string' || userId.length === 0) {
      return { count: 0, justLocked: false, lockedUntil: null };
    }
    if (redisActive()) {
      try {
        return await _redisRecordFailure(resolveRedisClient(), userId);
      } catch (err) {
        logger.warn('[mfaLockoutService] Redis recordFailure failed — using in-memory fallback', {
          error: err?.message,
        });
      }
    }
    return _memRecordFailure(userId);
  }

  async function recordSuccess(userId) {
    if (typeof userId !== 'string' || userId.length === 0) {
      return;
    }
    if (redisActive()) {
      try {
        await _redisRecordSuccess(resolveRedisClient(), userId);
        return;
      } catch (err) {
        logger.warn('[mfaLockoutService] Redis recordSuccess failed — using in-memory fallback', {
          error: err?.message,
        });
      }
    }
    _memRecordSuccess(userId);
  }

  function _resetForTest() {
    _failures.clear();
  }

  function _peekForTest(userId) {
    const entry = _failures.get(userId);
    if (!entry) {
      return null;
    }
    return { ...entry };
  }

  return { isLocked, recordFailure, recordSuccess, _resetForTest, _peekForTest };
}

// ─── Default singleton wired to the shared rate-limiter Redis connection ─────
const _defaultStore = createMfaLockoutStore();

/**
 * Check whether userId is currently locked out.
 * @param {string} userId
 * @returns {Promise<{ locked: boolean, retryAfterSec: number }>}
 */
export function isLocked(userId) {
  return _defaultStore.isLocked(userId);
}

/**
 * Increment the failure counter for userId. Returns the new state, including
 * whether this failure crossed the lockout threshold.
 * @param {string} userId
 * @returns {Promise<{ count: number, justLocked: boolean, lockedUntil: number | null }>}
 */
export function recordFailure(userId) {
  return _defaultStore.recordFailure(userId);
}

/**
 * Clear the failure counter for userId. Called after a successful TOTP
 * verification so a single typo before success does not penalise the user.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export function recordSuccess(userId) {
  return _defaultStore.recordSuccess(userId);
}

/**
 * Test-only helper to drain the in-memory fallback state between describes.
 * Synchronous (callers do not await) — safe because tests run with Redis
 * intentionally disabled, so all state lives in the in-memory Map.
 */
export function _resetMfaLockoutsForTest() {
  _defaultStore._resetForTest();
}

/**
 * Test-only inspection of the in-memory fallback state. Returns a defensive
 * copy so callers cannot mutate the live Map.
 */
export function _peekMfaLockoutStateForTest(userId) {
  return _defaultStore._peekForTest(userId);
}

export const _config = Object.freeze({
  MAX_FAILURES,
  LOCKOUT_TTL_MS,
});
