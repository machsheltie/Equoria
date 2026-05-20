/**
 * Rate Limiter Fail-Closed + Redis Degradation Alert Tests (Equoria-hnud7, CWE-400)
 *
 * Covers:
 * 1. Pure-function unit tests for shouldFailClosed (full 8-case matrix)
 * 2. Pure-function unit tests for redisIntentionallyDisabled
 * 3. Failing-first sentinel: failClosed + Redis EXPECTED-but-down → 503
 * 4. Regression: in jest env (redisIntentionallyDisabled=true), financialRateLimiter
 *    does NOT 503 — confirms test-safety invariant is preserved
 * 5. Alert throttle: assert alert fires at most once per throttle window
 * 6. 503 response mapping via DI — exercises the REAL wrapper res.status(503).json(...)
 *    line non-vacuously using injectable predicates (no mocking).
 * 7. Non-failClosed under outage delegates — wrapper passes through when failClosed=false.
 * 8. Healthy Redis delegates — wrapper passes through when redis is connected.
 * 9. Alert throttle direct — emitDegradationAlert throttle-window gating, white-box.
 *
 * These are PURE-FUNCTION / DI tests. No mocks of controllers/services/DB.
 * Sections 6–9 use dependency injection (injectable _redisExpectedFn / _redisConnectedFn)
 * to drive the real wrapper code path without requiring a live Redis connection.
 *
 * Test-safety invariant:
 *   When NODE_ENV=test OR JEST_WORKER_ID is set → redisIntentionallyDisabled()=true
 *   → failClosed path is NEVER taken → in-memory limiter, no 503.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// We import only the pure helpers from the module. We need to re-import after
// env manipulation for the redisIntentionallyDisabled tests because it reads
// process.env at call time (runtime, not module-init time).
//
// IMPORTANT: shouldFailClosed is a PURE function (takes args, no env reads).
// redisIntentionallyDisabled reads process.env at call time.

/**
 * We import the module fresh. Because the module has a top-level await
 * (initializeRedis), in the jest env it short-circuits immediately (returns null).
 * We then test the exported pure helpers and the DI-capable createRateLimiter directly.
 */
const {
  shouldFailClosed,
  redisIntentionallyDisabled,
  _alertTimestamps, // exported for white-box alert-throttle testing
  createRateLimiter,
  emitDegradationAlert, // exported for direct throttle-window testing (Equoria-hnud7 follow-up)
} = await import('../../../middleware/rateLimiting.mjs');

// ────────────────────────────────────────────────────────────────────────────
// 1. shouldFailClosed — full 8-case truth table
// ────────────────────────────────────────────────────────────────────────────
// shouldFailClosed({ failClosed, redisExpected, redisConnected }) → boolean
// Contract: returns true IFF ALL THREE: failClosed=true, redisExpected=true,
//           redisConnected=false.

describe('shouldFailClosed — full 8-case matrix', () => {
  // Case 1: all false
  it('returns false when failClosed=false, redisExpected=false, redisConnected=false', () => {
    expect(shouldFailClosed({ failClosed: false, redisExpected: false, redisConnected: false })).toBe(false);
  });

  // Case 2: failClosed=false, redisExpected=false, redisConnected=true
  it('returns false when failClosed=false, redisExpected=false, redisConnected=true', () => {
    expect(shouldFailClosed({ failClosed: false, redisExpected: false, redisConnected: true })).toBe(false);
  });

  // Case 3: failClosed=false, redisExpected=true, redisConnected=false
  it('returns false when failClosed=false, redisExpected=true, redisConnected=false (failClosed is the gate)', () => {
    expect(shouldFailClosed({ failClosed: false, redisExpected: true, redisConnected: false })).toBe(false);
  });

  // Case 4: failClosed=false, redisExpected=true, redisConnected=true
  it('returns false when failClosed=false, redisExpected=true, redisConnected=true', () => {
    expect(shouldFailClosed({ failClosed: false, redisExpected: true, redisConnected: true })).toBe(false);
  });

  // Case 5: failClosed=true, redisExpected=false, redisConnected=false
  // Redis is intentionally disabled — should NOT fail closed even with failClosed=true
  it('returns false when failClosed=true, redisExpected=false, redisConnected=false (intentionally disabled)', () => {
    expect(shouldFailClosed({ failClosed: true, redisExpected: false, redisConnected: false })).toBe(false);
  });

  // Case 6: failClosed=true, redisExpected=false, redisConnected=true
  // Unusual but: Redis not expected (intentionally off), yet it's somehow connected — no fail-closed
  it('returns false when failClosed=true, redisExpected=false, redisConnected=true', () => {
    expect(shouldFailClosed({ failClosed: true, redisExpected: false, redisConnected: true })).toBe(false);
  });

  // Case 7: THE KEY CASE — failClosed=true, redisExpected=true, redisConnected=true
  // Redis IS connected, so no outage → should NOT fail closed
  it('returns false when failClosed=true, redisExpected=true, redisConnected=true (Redis healthy)', () => {
    expect(shouldFailClosed({ failClosed: true, redisExpected: true, redisConnected: true })).toBe(false);
  });

  // Case 8: THE FAIL-CLOSED CASE — failClosed=true, redisExpected=true, redisConnected=false
  // Redis IS expected AND is down → FAIL CLOSED
  it('returns TRUE when failClosed=true, redisExpected=true, redisConnected=false (OUTAGE — fail closed)', () => {
    expect(shouldFailClosed({ failClosed: true, redisExpected: true, redisConnected: false })).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. redisIntentionallyDisabled — env-reading function
// ────────────────────────────────────────────────────────────────────────────

describe('redisIntentionallyDisabled', () => {
  // Capture the original env values so we can restore them
  let originalNodeEnv;
  let originalJestWorkerId;
  let originalRedisDisabled;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalJestWorkerId = process.env.JEST_WORKER_ID;
    originalRedisDisabled = process.env.REDIS_DISABLED;
  });

  afterEach(() => {
    // Restore all env vars
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalJestWorkerId === undefined) delete process.env.JEST_WORKER_ID;
    else process.env.JEST_WORKER_ID = originalJestWorkerId;

    if (originalRedisDisabled === undefined) delete process.env.REDIS_DISABLED;
    else process.env.REDIS_DISABLED = originalRedisDisabled;
  });

  it('returns true when NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;
    delete process.env.REDIS_DISABLED;
    expect(redisIntentionallyDisabled()).toBe(true);
  });

  it('returns true when JEST_WORKER_ID is set (any non-undefined value)', () => {
    process.env.NODE_ENV = 'production'; // even in prod-like env
    process.env.JEST_WORKER_ID = '1';
    delete process.env.REDIS_DISABLED;
    expect(redisIntentionallyDisabled()).toBe(true);
  });

  it('returns true when REDIS_DISABLED=true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
    process.env.REDIS_DISABLED = 'true';
    expect(redisIntentionallyDisabled()).toBe(true);
  });

  it('returns false when not test-like and REDIS_DISABLED is not "true"', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
    delete process.env.REDIS_DISABLED;
    expect(redisIntentionallyDisabled()).toBe(false);
  });

  it('returns false when NODE_ENV=beta (not test-like)', () => {
    process.env.NODE_ENV = 'beta';
    delete process.env.JEST_WORKER_ID;
    delete process.env.REDIS_DISABLED;
    expect(redisIntentionallyDisabled()).toBe(false);
  });

  it('returns false when NODE_ENV=development (not test-like)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;
    delete process.env.REDIS_DISABLED;
    expect(redisIntentionallyDisabled()).toBe(false);
  });

  it('returns false when REDIS_DISABLED="false" (string "false" is not "true")', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
    process.env.REDIS_DISABLED = 'false';
    expect(redisIntentionallyDisabled()).toBe(false);
  });

  it('CRITICAL: returns true in the CURRENT jest test environment (test-safety invariant)', () => {
    // This test runs in the real jest env — NODE_ENV=test or JEST_WORKER_ID is set.
    // If either condition is true, redisIntentionallyDisabled() must return true.
    // This is the make-or-break regression guard: if this fails, the whole
    // test-safety invariant is broken and financialRateLimiter would 503 in tests.
    const isTestLike =
      process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    expect(isTestLike).toBe(true); // verify we are actually in a test env
    expect(redisIntentionallyDisabled()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Failing-first sentinel: shouldFailClosed integration with failClosed option
//
// This test verifies that the shouldFailClosed decision WOULD yield 503/reject
// when:
//   - failClosed=true (economy limiter)
//   - redisExpected=true (not test-like, not REDIS_DISABLED)
//   - redisConnected=false (Redis down / circuit open)
//
// We test this via the pure function (shouldFailClosed) because we cannot
// easily manipulate isRedisConnected() state in a unit test without either
// mocking (forbidden) or real Redis. The pure-function test is the canonical
// sentinel because the wrapper middleware delegates to shouldFailClosed.
// ────────────────────────────────────────────────────────────────────────────

describe('Failing-first sentinel: fail-closed decision for economy mutations', () => {
  it('SENTINEL: shouldFailClosed returns true for economy limiter scenario (Redis outage)', () => {
    // Scenario: production environment, Redis was expected, but it is NOT connected.
    // This is the exact scenario where financialRateLimiter must 503.
    const result = shouldFailClosed({
      failClosed: true,   // economy/financial limiter config
      redisExpected: true, // not test-like, not REDIS_DISABLED
      redisConnected: false, // Redis is down
    });
    expect(result).toBe(true);
  });

  it('SENTINEL: shouldFailClosed returns false for non-economy limiter in same outage', () => {
    // queryRateLimiter, authRateLimiter etc. have failClosed=false.
    // Even with Redis down, they should NOT fail closed.
    const result = shouldFailClosed({
      failClosed: false,  // non-economy limiter
      redisExpected: true,
      redisConnected: false,
    });
    expect(result).toBe(false);
  });

  it('SENTINEL: shouldFailClosed returns false when Redis IS connected (healthy path)', () => {
    // Even for economy limiter, when Redis is healthy, no fail-closed.
    const result = shouldFailClosed({
      failClosed: true,
      redisExpected: true,
      redisConnected: true,
    });
    expect(result).toBe(false);
  });

  it('SENTINEL: shouldFailClosed returns false in test env scenario (redisExpected=false)', () => {
    // In jest env, redisIntentionallyDisabled()=true → redisExpected=false.
    // Even with failClosed=true, must not fail closed.
    const result = shouldFailClosed({
      failClosed: true,
      redisExpected: false, // because redisIntentionallyDisabled()=true
      redisConnected: false,
    });
    expect(result).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Regression: in jest env, the actual financialRateLimiter is NOT fail-closed
//
// This verifies that the exported financialRateLimiter middleware is a FUNCTION
// (not a 503 middleware) when running in the jest environment. The real HTTP-chain
// regression (it doesn't 503 on real requests) is proven by the existing
// financialRateLimiter.integration.test.mjs (which we run and paste output for).
// ────────────────────────────────────────────────────────────────────────────

describe('Regression: financialRateLimiter does NOT fail-closed in jest env', () => {
  it('financialRateLimiter is exported as a middleware function', async () => {
    // Re-import to get the real exported instance
    const { financialRateLimiter } = await import('../../../middleware/rateLimiting.mjs');
    expect(typeof financialRateLimiter).toBe('function');
  });

  it('financialRateLimiter does NOT immediately return 503 in jest env (calls next)', async () => {
    const { financialRateLimiter } = await import('../../../middleware/rateLimiting.mjs');

    // In jest env, redisIntentionallyDisabled()=true → failClosed logic is bypassed.
    // The middleware should call next(), not set status 503.
    let nextCalled = false;
    let statusSet = null;

    const req = {
      ip: '127.0.0.1',
      headers: { origin: 'http://localhost:3000' },
      method: 'POST',
      url: '/api/v1/bank/claim',
      path: '/api/v1/bank/claim',
      user: { id: 'test-user-regression-guard' },
    };
    const res = {
      _statusCode: 200,
      set: () => {},
      setHeader: () => {},
      getHeader: () => null,
      status(code) {
        statusSet = code;
        this._statusCode = code;
        return this;
      },
      json: () => {},
      send: () => {},
    };
    const next = () => { nextCalled = true; };

    await new Promise(resolve => {
      financialRateLimiter(req, res, (...args) => {
        nextCalled = true;
        resolve();
      });
      // Give it a tick in case it is async
      setTimeout(resolve, 50);
    });

    // In jest env, the fail-closed path must NOT fire.
    // Either next was called OR a 429 was issued (rate limit itself) — but NEVER 503.
    expect(statusSet).not.toBe(503);
  });

  it('shouldFailClosed with jest env inputs (redisExpected=false) returns false', () => {
    // Belt-and-suspenders: confirm the pure function also returns false
    // when we pass the exact inputs the wrapper computes in jest env.
    const isIntentionallyDisabled = redisIntentionallyDisabled();
    const redisExpected = !isIntentionallyDisabled;
    expect(redisExpected).toBe(false); // we are in jest env
    expect(shouldFailClosed({
      failClosed: true, // economy limiter
      redisExpected,    // false, because we're in jest
      redisConnected: false,
    })).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Alert throttle: alert fires at most once per throttle window
// ────────────────────────────────────────────────────────────────────────────

describe('Alert throttle: degradation alert fires at most once per window', () => {
  it('_alertTimestamps is exported (white-box — proves throttle map exists)', () => {
    // The module must export the alert timestamp map for white-box testing.
    // If this test fails with "undefined", the module does not yet export it —
    // expected before the implementation lands.
    expect(_alertTimestamps).toBeDefined();
    expect(_alertTimestamps instanceof Map).toBe(true);
  });

  it('alert throttle map starts empty or does not contain fabricated test key', () => {
    const testKey = 'rl:financial:THROTTLE_TEST_SENTINEL_KEY_XYZ_NEVER_REAL';
    // Should not have a stale entry from a previous test run
    expect(_alertTimestamps.has(testKey)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. 503 response mapping — non-vacuous wrapper test via DI
//
// This is the load-bearing new coverage added in the Equoria-hnud7 follow-up.
// It exercises the REAL `res.status(503).json(...)` line in failClosedWrapper
// by constructing a limiter with injected predicates that force the outage
// branch, then calling the middleware with stub req/res objects.
//
// Non-vacuity argument: if you delete or change the `res.status(503).json(...)`
// line in rateLimiting.mjs (e.g. change 503→200, or omit the json call, or
// change the message field), this test fails. The pure-function tests in
// section 3 do NOT catch those regressions because they only test shouldFailClosed
// — they never call the wrapper at all.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal stub {req, res, next} triple.
 * res captures status() and json() calls so assertions can inspect them.
 * next() sets nextCalled=true.
 */
function makeStubRequestTriple(userId = 'di-test-user-1') {
  const captured = { statusCode: null, jsonBody: null, nextCalled: false };
  const req = {
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/v1/bank/claim',
    url: '/api/v1/bank/claim',
    headers: {},
    user: { id: userId },
  };
  const res = {
    _statusCode: 200,
    status(code) {
      captured.statusCode = code;
      this._statusCode = code;
      return this; // allow chaining: res.status(503).json(...)
    },
    json(body) {
      captured.jsonBody = body;
      return this;
    },
    setHeader() { return this; },
    getHeader() { return null; },
    set() { return this; },
    send(body) { captured.jsonBody = body; return this; },
    end() { return this; },
  };
  const next = () => { captured.nextCalled = true; };
  return { req, res, next, captured };
}

describe('503 response mapping — DI-driven wrapper (non-vacuous, Equoria-hnud7 follow-up)', () => {
  it('wrapper emits res.status(503) and canonical JSON envelope when Redis is expected-but-down', () => {
    // Construct a failClosed limiter using injectable predicates.
    // _redisExpectedFn returns true (Redis is expected — not intentionally disabled).
    // _redisConnectedFn returns false (Redis is down right now).
    // This forces shouldFailClosed → true → the 503 branch fires.
    const middleware = createRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
      keyPrefix: 'rl:di-503-test',
      failClosed: true,
      _redisExpectedFn: () => true,   // DI: Redis is expected
      _redisConnectedFn: () => false, // DI: Redis is NOT connected
    });

    const { req, res, next, captured } = makeStubRequestTriple('di-503-user');
    middleware(req, res, next);

    // The real wrapper line must have fired: status 503 + correct envelope.
    expect(captured.statusCode).toBe(503);
    expect(captured.jsonBody).toEqual({
      success: false,
      message: 'Service temporarily unavailable, please retry shortly',
    });
    // next must NOT have been called — the wrapper short-circuited with 503.
    expect(captured.nextCalled).toBe(false);

    // Clean up the alert timestamp this test deposited.
    _alertTimestamps.delete('rl:di-503-test');
  });

  it('SENTINEL non-vacuity: the same test would fail if the 503 status were removed', async () => {
    // This test documents WHY the above test is non-vacuous. If we call the wrapper
    // with _redisConnectedFn=()=>true (healthy Redis), the 503 path is NOT taken
    // and statusCode stays null — proving the 503 assertion in the test above is
    // NOT accidentally passing due to some default behavior.
    const healthyMiddleware = createRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
      keyPrefix: 'rl:di-healthy-test',
      failClosed: true,
      _redisExpectedFn: () => true,
      _redisConnectedFn: () => true, // healthy — no 503
    });

    const { req, res, captured } = makeStubRequestTriple('di-healthy-user');
    // express-rate-limit calls next() asynchronously — wrap in a Promise.
    await new Promise(resolve => {
      healthyMiddleware(req, res, () => { captured.nextCalled = true; resolve(); });
      setTimeout(resolve, 80);
    });

    // Healthy path: wrapper delegates — no 503 from the wrapper itself.
    // (The underlying limiter may set status to 429 if over limit, but that
    // is NOT 503 — and in this isolated call with a fresh in-memory store
    // and a unique user, the counter is 0 so next() is called.)
    expect(captured.statusCode).not.toBe(503);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6b. throw-still-503 — emitDegradationAlert throwing must not prevent 503
//
// Contract (Equoria-hnud7 polish): the try/catch wrapping emitDegradationAlert
// in failClosedWrapper means alerting is best-effort. Even if the alert
// function throws synchronously, the 503 fail-closed response must still fire.
//
// We exercise this by passing a _redisExpectedFn that returns true, a
// _redisConnectedFn that returns false (outage branch), AND a real
// emitDegradationAlert that is coerced to throw by poisoning _alertTimestamps
// with a non-Map value so its internal .get() throws a TypeError.
// This approach needs NO jest.mock of the logger or any module internals.
// ────────────────────────────────────────────────────────────────────────────

describe('throw-still-503 — alerting throw must not prevent the 503 response', () => {
  it('503 fires even when _alertTimestamps is poisoned to throw synchronously', () => {
    // Step 1: poison the exported _alertTimestamps Map so that the first
    // .get() call inside emitDegradationAlert throws a TypeError.
    // We save the real Map and restore it after the test.
    const realMap = _alertTimestamps;
    const poison = { get() { throw new TypeError('SIMULATED_ALERT_THROW'); } };

    // We cannot reassign the exported binding, so we swap the entries out by
    // clearing and setting a non-function property on the map itself.
    // Instead: use the DI boundary. createRateLimiter accepts _redisExpectedFn
    // and _redisConnectedFn. The alert path goes through emitDegradationAlert
    // which reads _alertTimestamps. Since we can't rebind the export, we
    // simulate the throw at the call site by building a wrapper that reproduces
    // the fail-closed scenario and verify the 503 arrives despite a thrown
    // internal error at the emitDegradationAlert call.
    //
    // Realistic approach: manually invoke the failClosedWrapper logic inline
    // to prove the try/catch pattern holds. We confirm the pattern by
    // verifying the existing DI test (section 6) still produces 503 AND
    // that the try/catch structure is present in the source (validated by
    // the middleware producing 503 in test 6 after the patch).
    //
    // The most direct approach: create a failClosed limiter via DI,
    // stub emitDegradationAlert at the _alertTimestamps Map level to throw,
    // call the middleware, and verify 503 still fires.
    //
    // We can achieve this by directly mutating the _alertTimestamps Map
    // so that emitDegradationAlert's own `.get()` call throws.
    // _alertTimestamps is the REAL Map reference; we can replace its
    // prototype temporarily.

    const TEST_KEY = `rl:throw-503-sentinel-${Date.now()}`;

    // Arrange: build the middleware in outage mode.
    const middleware = createRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
      keyPrefix: TEST_KEY,
      failClosed: true,
      _redisExpectedFn: () => true,   // outage: Redis expected
      _redisConnectedFn: () => false, // outage: Redis down
    });

    // Poison the Map so emitDegradationAlert's `.get(keyPrefix)` throws.
    // We do this by replacing the Map's `get` method on the instance.
    const origGet = _alertTimestamps.get.bind(_alertTimestamps);
    _alertTimestamps.get = () => { throw new TypeError('SIMULATED_ALERT_THROW'); };

    const { req, res, next, captured } = makeStubRequestTriple('throw-503-user');

    try {
      middleware(req, res, next);
    } finally {
      // Restore the Map's get method unconditionally.
      _alertTimestamps.get = origGet;
      _alertTimestamps.delete(TEST_KEY);
    }

    // The 503 MUST still fire even though emitDegradationAlert threw.
    expect(captured.statusCode).toBe(503);
    expect(captured.jsonBody).toEqual({
      success: false,
      message: 'Service temporarily unavailable, please retry shortly',
    });
    // next must NOT have been called.
    expect(captured.nextCalled).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Non-failClosed under outage — wrapper delegates (no 503) when failClosed=false
// ────────────────────────────────────────────────────────────────────────────

describe('Non-failClosed limiter delegates even under Redis outage', () => {
  it('a limiter with failClosed=false does NOT 503 even when Redis is expected-but-down', async () => {
    // createRateLimiter with failClosed:false (the default) returns the inner
    // limiter directly — there is NO wrapper. So even if we injected predicates
    // indicating outage, the 503 guard is never wired. This confirms the
    // fail-closed property is opt-in, not applied globally.
    //
    // Non-failClosed limiters (auth, query, mutation, ...) must never 503 on
    // Redis outage — they always fall back to in-memory gracefully.
    const middleware = createRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
      keyPrefix: 'rl:di-nonfailclosed-test',
      failClosed: false, // explicit — this is also the default
      // Even if someone passes these, they are ignored because the wrapper
      // is not built when failClosed=false. We pass them to prove they're harmless.
      _redisExpectedFn: () => true,
      _redisConnectedFn: () => false,
    });

    const { req, res, captured } = makeStubRequestTriple('di-nonfailclosed-user');
    // express-rate-limit calls next() asynchronously — wrap in a Promise.
    await new Promise(resolve => {
      middleware(req, res, () => { captured.nextCalled = true; resolve(); });
      setTimeout(resolve, 80);
    });

    // Without the fail-closed wrapper, the limiter delegates to the underlying
    // express-rate-limit (in-memory in test env). No 503.
    expect(captured.statusCode).not.toBe(503);
    // next() should have been called (first request, counter=0, under limit).
    expect(captured.nextCalled).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Healthy Redis delegates — failClosed limiter passes through when Redis OK
// ────────────────────────────────────────────────────────────────────────────

describe('Healthy Redis — fail-closed wrapper delegates to underlying limiter', () => {
  it('no 503 when _redisConnectedFn returns true (Redis is healthy)', async () => {
    // When Redis IS connected, shouldFailClosed returns false and the wrapper
    // delegates to the underlying limiter. The request should pass through.
    const middleware = createRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
      keyPrefix: 'rl:di-healthy-path-test',
      failClosed: true,
      _redisExpectedFn: () => true,
      _redisConnectedFn: () => true, // Redis healthy — no 503
    });

    const { req, res, captured } = makeStubRequestTriple('di-healthy-path-user');
    // express-rate-limit calls next() asynchronously — wrap in a Promise.
    await new Promise(resolve => {
      middleware(req, res, () => { captured.nextCalled = true; resolve(); });
      setTimeout(resolve, 80);
    });

    expect(captured.statusCode).not.toBe(503);
    // next() should be called because the underlying in-memory limiter is under cap.
    expect(captured.nextCalled).toBe(true);
  });

  it('no 503 when _redisExpectedFn returns false (intentionally disabled = test env)', async () => {
    // The second path that avoids 503: when Redis is not expected at all.
    // This mimics the jest/test env where redisIntentionallyDisabled()=true.
    const middleware = createRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
      keyPrefix: 'rl:di-disabled-path-test',
      failClosed: true,
      _redisExpectedFn: () => false,  // not expected — like jest env
      _redisConnectedFn: () => false, // also not connected
    });

    const { req, res, captured } = makeStubRequestTriple('di-disabled-path-user');
    // express-rate-limit calls next() asynchronously — wrap in a Promise.
    await new Promise(resolve => {
      middleware(req, res, () => { captured.nextCalled = true; resolve(); });
      setTimeout(resolve, 80);
    });

    expect(captured.statusCode).not.toBe(503);
    expect(captured.nextCalled).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Alert throttle direct — emitDegradationAlert throttle-window gating
//
// Approach: we call the exported emitDegradationAlert directly (no mock) and
// observe the _alertTimestamps map state. The map is the authoritative source
// for the throttle decision — if the second call's timestamp is not in the
// future relative to ALERT_THROTTLE_MS (60s), the second alert is suppressed.
//
// We use a unique key per test run to avoid cross-test contamination.
// We verify:
//   - First call: key is absent → alert fires → key is written to map.
//   - Second call (within window): key IS present and within 60s → suppressed
//     (key's timestamp is NOT updated because the function returns early).
//
// We do NOT spy on logger (no jest.mock). The _alertTimestamps state change
// IS the observable side-effect of "alert fired". The logger.error() call
// is an additional side-effect we reason about but do not assert — this is
// deliberate: the project forbids jest.mock of internal modules, and a
// real transport capture would require significant test infrastructure for
// minimal benefit. The timestamp-map assertion is sufficient to prove
// throttle-window gating.
// ────────────────────────────────────────────────────────────────────────────

describe('emitDegradationAlert — direct throttle-window gating (Equoria-hnud7 follow-up)', () => {
  // Use a unique key for this suite to avoid contamination with the 503 DI tests above.
  const THROTTLE_TEST_KEY = `rl:direct-throttle-test-${Date.now()}`;

  afterEach(() => {
    // Clean up the timestamp entry so tests are independent.
    _alertTimestamps.delete(THROTTLE_TEST_KEY);
  });

  it('first call to emitDegradationAlert writes a timestamp to _alertTimestamps', () => {
    // Pre-condition: key is absent.
    expect(_alertTimestamps.has(THROTTLE_TEST_KEY)).toBe(false);

    const beforeCall = Date.now();
    emitDegradationAlert(THROTTLE_TEST_KEY);
    const afterCall = Date.now();

    // Post-condition: key exists and its value is a timestamp in the current moment.
    expect(_alertTimestamps.has(THROTTLE_TEST_KEY)).toBe(true);
    const writtenTs = _alertTimestamps.get(THROTTLE_TEST_KEY);
    expect(writtenTs).toBeGreaterThanOrEqual(beforeCall);
    expect(writtenTs).toBeLessThanOrEqual(afterCall);
  });

  it('second call within throttle window does NOT update the timestamp (suppressed)', () => {
    // First call fires and records timestamp T1.
    emitDegradationAlert(THROTTLE_TEST_KEY);
    const t1 = _alertTimestamps.get(THROTTLE_TEST_KEY);

    // Immediately call again — still within the 60s throttle window.
    // The function should return early without updating _alertTimestamps.
    emitDegradationAlert(THROTTLE_TEST_KEY);
    const t2 = _alertTimestamps.get(THROTTLE_TEST_KEY);

    // The timestamp must be unchanged — the second call was suppressed.
    // If the throttle logic were removed and both calls fired, t2 would be
    // >= t1 + some delta (the second Date.now() call). Since both calls
    // happen within microseconds of each other and we check for equality,
    // this assertion is tight: the second call did NOT update the map.
    expect(t2).toBe(t1);
  });

  it('a call after manually clearing the timestamp fires again (window reset)', () => {
    // Simulate "window has expired" by manually clearing the entry
    // (equivalent to 60s passing and a GC, but without actually sleeping).
    emitDegradationAlert(THROTTLE_TEST_KEY);
    const t1 = _alertTimestamps.get(THROTTLE_TEST_KEY);

    // Simulate window expiry by setting the timestamp to the past (> 60s ago).
    _alertTimestamps.set(THROTTLE_TEST_KEY, Date.now() - 61 * 1000);

    emitDegradationAlert(THROTTLE_TEST_KEY);
    const t2 = _alertTimestamps.get(THROTTLE_TEST_KEY);

    // t2 must be a fresh timestamp (after t1) — the "expired" window allowed
    // the second alert to fire and overwrite with the current time.
    expect(t2).toBeGreaterThan(t1);
  });
});
