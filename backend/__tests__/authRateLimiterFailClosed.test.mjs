/**
 * Auth Rate Limiter Fail-Closed Tests (Equoria-dzit3, CWE-636 fail-open)
 *
 * USER DECISION (2026-07-07): the auth brute-force limiter must FAIL CLOSED on a
 * Redis outage. A Redis outage on the auth path returns 503 instead of degrading
 * brute-force protection to per-process in-memory counters (which, in a multi-node
 * deploy, multiplies the effective cap by node count and resets on every deploy).
 * Non-security limiters (query / profile / …) KEEP their graceful-degradation
 * (fail-open) posture — this change is scoped to the auth/brute-force boundary.
 *
 * These are the same PURE-FUNCTION / DI-driven tests used by rateLimitFailClosed
 * .test.mjs (Equoria-hnud7 / 8ukii) — no mocks of controllers/services/DB, no live
 * Redis. Redis state is injected via the createRateLimiter DI seams
 * (_redisExpectedFn / _redisConnectedFn) so the real failClosedWrapper 503 path is
 * exercised without a live Redis connection.
 *
 * Coverage:
 *  1. EXPORT-WIRING sentinel — the REAL exported authRateLimiter is fail-closed-
 *     wrapped (RED before the fix, GREEN after). Scoped-to-auth control: the real
 *     query/profile limiters are NOT wrapped (still fail-open).
 *  2. DI BEHAVIOR — an rl:auth-prefixed failClosed limiter 503s on a simulated
 *     Redis outage across an over-limit burst (never 200), and delegates cleanly
 *     when Redis is healthy.
 *  3. SCOPED-TO-AUTH — an rl:query-prefixed limiter with failClosed:false STILL
 *     degrades gracefully (never 503) under the SAME simulated outage.
 *  4. JEST-ENV REGRESSION — the real exported authRateLimiter does NOT 503 in the
 *     jest env (redisIntentionallyDisabled()=true) — proves the flip cannot brick
 *     login in tests.
 */

import { describe, it, expect } from '@jest/globals';

const {
  createRateLimiter,
  _alertTimestamps,
  // Real exported limiters. authRateLimiter must be fail-closed-wrapped after
  // the dzit3 fix; the non-security limiters must remain unwrapped (fail-open).
  authRateLimiter,
  queryRateLimiter,
  profileRateLimiter,
  mutationRateLimiter, // non-security control — must stay unwrapped
} = await import('../middleware/rateLimiting.mjs');

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers (mirrors rateLimitFailClosed.test.mjs — kept local for test
// isolation; test helpers are not cross-imported in this suite family).
// ────────────────────────────────────────────────────────────────────────────

/**
 * A failClosed-wrapped limiter is a plain arrow fn with NO .resetKey/.getKey.
 * A raw express-rate-limit middleware (failClosed:false) DOES expose .resetKey +
 * .getKey. This is the same non-vacuous probe the 8ukii export-wiring sentinel
 * uses: it distinguishes the wrapper from the raw limiter by structure, so it
 * flips exactly when `failClosed` is added/removed on the export.
 */
const isFailClosedWrapped = mw =>
  typeof mw === 'function' && typeof mw.resetKey !== 'function' && typeof mw.getKey !== 'function';

/**
 * Build a minimal stub {req, res, next} triple that captures status()/json()
 * calls and whether next() was invoked. res.status() returns `this` so the real
 * `res.status(503).json(...)` chain in failClosedWrapper works unmodified.
 */
function makeStubRequestTriple(userId = 'auth-di-user') {
  const captured = { statusCode: null, jsonBody: null, nextCalled: false };
  const req = {
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/v1/auth/login',
    url: '/api/v1/auth/login',
    headers: {},
    user: { id: userId },
  };
  const res = {
    _statusCode: 200,
    status(code) {
      captured.statusCode = code;
      this._statusCode = code;
      return this;
    },
    json(body) {
      captured.jsonBody = body;
      return this;
    },
    setHeader() {
      return this;
    },
    getHeader() {
      return null;
    },
    set() {
      return this;
    },
    send(body) {
      captured.jsonBody = body;
      return this;
    },
    end() {
      return this;
    },
  };
  const next = () => {
    captured.nextCalled = true;
  };
  return { req, res, next, captured };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. EXPORT-WIRING sentinel — the AC proof (RED before fix, GREEN after)
// ────────────────────────────────────────────────────────────────────────────

describe('Equoria-dzit3 — authRateLimiter is fail-closed-wrapped (export-wiring sentinel)', () => {
  it('SENTINEL: authRateLimiter is fail-closed-wrapped (fails if failClosed removed)', () => {
    // Before the dzit3 fix, authRateLimiter has no `failClosed` (defaults false),
    // so createRateLimiter returns the RAW express-rate-limit middleware which
    // exposes .resetKey/.getKey → isFailClosedWrapped() === false → this FAILS.
    // After adding `failClosed: true`, createRateLimiter returns the
    // failClosedWrapper arrow fn (no .resetKey) → isFailClosedWrapped() === true.
    expect(isFailClosedWrapped(authRateLimiter)).toBe(true);
  });

  it('SCOPED-TO-AUTH: queryRateLimiter is NOT fail-closed-wrapped (still fail-open)', () => {
    // Non-security read/query limiter must keep graceful-degradation. If someone
    // over-extends failClosed to it, this fails.
    expect(isFailClosedWrapped(queryRateLimiter)).toBe(false);
  });

  it('SCOPED-TO-AUTH: profileRateLimiter is NOT fail-closed-wrapped (still fail-open)', () => {
    expect(isFailClosedWrapped(profileRateLimiter)).toBe(false);
  });

  it('NON-VACUITY: mutationRateLimiter is NOT wrapped (proves the probe distinguishes)', () => {
    // mutationRateLimiter has failClosed:false (default) → raw limiter with
    // .resetKey. Proves isFailClosedWrapped is not trivially true for every
    // middleware, so the authRateLimiter assertion above is meaningful.
    expect(isFailClosedWrapped(mutationRateLimiter)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. DI BEHAVIOR — rl:auth failClosed limiter 503s on a simulated Redis outage
//    across an over-limit burst (AC: over-limit auth burst returns 503, not 200)
// ────────────────────────────────────────────────────────────────────────────

describe('Equoria-dzit3 — auth-prefixed failClosed limiter under Redis outage (DI)', () => {
  it('over-limit auth burst returns 503 on EVERY request (never 200) when Redis expected-but-down', () => {
    // Mirror the real authRateLimiter config (max: 200, skipSuccessfulRequests),
    // but with injected outage predicates so the fail-closed 503 branch fires.
    // Under a genuine Redis outage the wrapper rejects BEFORE the counter is even
    // consulted — so the AC's "over-limit burst returns 503 not 200" holds a
    // fortiori (every request 503s, not just those past the cap).
    const KEY = 'rl:auth-di-503-test';
    const middleware = createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 200,
      keyPrefix: KEY,
      skipSuccessfulRequests: true,
      failClosed: true,
      _redisExpectedFn: () => true, // outage: Redis expected (not intentionally disabled)
      _redisConnectedFn: () => false, // outage: Redis down right now
    });

    // Drive a burst — including well past the 200 cap — and assert none is 200.
    const BURST = 205;
    let saw503 = 0;
    let saw200 = 0;
    for (let i = 0; i < BURST; i += 1) {
      const { req, res, next, captured } = makeStubRequestTriple(`auth-burst-${i}`);
      middleware(req, res, next);
      if (captured.statusCode === 503) {
        saw503 += 1;
        expect(captured.jsonBody).toEqual({
          success: false,
          message: 'Service temporarily unavailable, please retry shortly',
        });
        expect(captured.nextCalled).toBe(false);
      }
      if (captured.statusCode === 200 || captured.nextCalled) {
        saw200 += 1;
      }
    }

    // Fail-closed: every request in the burst returned 503; none fell through.
    expect(saw503).toBe(BURST);
    expect(saw200).toBe(0);

    _alertTimestamps.delete(KEY);
  });

  it('auth-prefixed failClosed limiter does NOT 503 when Redis is healthy (delegates)', async () => {
    const middleware = createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 200,
      keyPrefix: 'rl:auth-di-healthy-test',
      skipSuccessfulRequests: true,
      failClosed: true,
      _redisExpectedFn: () => true,
      _redisConnectedFn: () => true, // healthy — no 503
    });

    const { req, res, captured } = makeStubRequestTriple('auth-di-healthy-user');
    await new Promise(resolve => {
      middleware(req, res, () => {
        captured.nextCalled = true;
        resolve();
      });
      setTimeout(resolve, 80);
    });

    expect(captured.statusCode).not.toBe(503);
    expect(captured.nextCalled).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. SCOPED-TO-AUTH — a non-security (query) limiter STILL degrades gracefully
//    under the SAME simulated outage. Proves the flip is scoped to the auth
//    boundary, not a blanket fail-closed of the whole limiter fleet.
// ────────────────────────────────────────────────────────────────────────────

describe('Equoria-dzit3 — non-security limiter still degrades gracefully (scoped-to-auth proof)', () => {
  it('a query-prefixed failClosed:false limiter NEVER 503s under the same Redis outage', async () => {
    // Same injected outage as the auth burst above (Redis expected, down), but
    // failClosed:false (the query limiter's real posture) → NO wrapper is built,
    // so the outage predicates are inert and the limiter falls back to in-memory
    // gracefully. This is the exact "non-security limiters keep graceful
    // degradation" guarantee the user's decision preserved.
    const middleware = createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
      keyPrefix: 'rl:query-di-graceful-test',
      skipSuccessfulRequests: false,
      failClosed: false, // non-security posture — graceful degradation
      _redisExpectedFn: () => true, // even under a real outage...
      _redisConnectedFn: () => false, // ...Redis down...
    });

    // Drive a small burst; every request must delegate (never 503).
    for (let i = 0; i < 5; i += 1) {
      const { req, res, captured } = makeStubRequestTriple(`query-graceful-${i}`);

      await new Promise(resolve => {
        middleware(req, res, () => {
          captured.nextCalled = true;
          resolve();
        });
        setTimeout(resolve, 80);
      });
      expect(captured.statusCode).not.toBe(503);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. JEST-ENV REGRESSION — the real exported authRateLimiter does NOT 503 in the
//    jest env (redisIntentionallyDisabled()=true → fail-closed path never taken).
//    Proves adding failClosed:true cannot brick login in the test environment.
// ────────────────────────────────────────────────────────────────────────────

describe('Equoria-dzit3 — real exported authRateLimiter does NOT 503 in jest env', () => {
  it('authRateLimiter calls next() (no 503) in jest env', async () => {
    const { req, res, captured } = makeStubRequestTriple('auth-jest-regression-user');
    await new Promise(resolve => {
      authRateLimiter(req, res, () => {
        captured.nextCalled = true;
        resolve();
      });
      setTimeout(resolve, 80);
    });
    expect(captured.statusCode).not.toBe(503);
    expect(captured.nextCalled).toBe(true);
  });
});
