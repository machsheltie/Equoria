/**
 * redis-circuit-breaker.at.test.mjs
 *
 * ATDD Acceptance Tests — Story 21-2: Fix Redis Circuit Breaker Flaky Tests
 *
 * These tests define the DESIRED behaviour of the circuit breaker when timing is
 * controlled with jest.useFakeTimers(). They are written BEFORE the DS step so that:
 *
 *   1. They document exactly what the DS must achieve (deterministic state transitions).
 *   2. They provide a passing reference implementation demonstrating the fake-timer
 *      technique so the DS can apply it to the full test file.
 *   3. They PASS once the correct technique is applied (fake timers + no real delays).
 *
 * AC coverage:
 *   AC1 — no .skip in main file  (enforced by DS removing all .skip annotations)
 *   AC2 — full CLOSED→OPEN→HALF_OPEN→CLOSED cycle (AT-04)
 *   AC3 — no real setTimeout for synchronisation (every test here uses fake timers only)
 *   AC4 — deterministic: each AT must pass consistently
 *   AC5 — no regressions; suite remains green
 *
 * ── Key insight: why EventEmitter + Promise.then() works without extra flushes ──
 *
 * opossum emits 'open', 'failure', etc. via EventEmitter.emit() which is
 * *synchronous*. The emit call happens inside the `.catch()` handler that runs as a
 * microtask after the wrapped promise settles. By the time `await breaker.fire(...).catch()`
 * resumes our test, the entire synchronous chain — including EventEmitter listeners and
 * metrics updates — has already executed. No extra flush is required.
 *
 * For resetTimeout-based transitions (OPEN → HALF_OPEN) we advance fake timers:
 *   jest.advanceTimersByTime(resetTimeout + 10)
 * This fires opossum's internal `setTimeout(() => _halfOpen, resetTimeout)` synchronously,
 * which calls `circuit.emit('halfOpen')` synchronously. A single `await Promise.resolve()`
 * is enough to let any residual microtasks drain.
 *
 * ── Important: errorFilter and error types ──
 *
 * DEFAULT_CIRCUIT_OPTIONS.errorFilter (redisCircuitBreaker.mjs):
 *   - ECONNREFUSED errors → returns false (not filtered) → counted as FAILURE → can trip circuit
 *   - Plain errors (no code) → returns true (filtered) → treated as SUCCESS → do NOT count
 *
 * Therefore: always use connRefusedError() when you need the circuit to count a failure.
 * Use plain new Error() only when testing that filtered errors are propagated but not counted.
 */

import { jest, describe, beforeAll, beforeEach, afterEach, it, expect } from '@jest/globals';

let createRedisCircuitBreaker;

jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeAll(async () => {
  ({ createRedisCircuitBreaker } = await import('../../utils/redisCircuitBreaker.mjs'));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a connection-refused error that the errorFilter will count as a failure.
 * In test env, only ECONNREFUSED errors are counted (not filtered) by the circuit breaker.
 */
function connRefusedError(msg = 'Connection refused') {
  const err = new Error(msg);
  err.code = 'ECONNREFUSED';
  return err;
}

/**
 * Drain residual microtasks.
 * Opossum's EventEmitter callbacks are synchronous, but an occasional
 * extra microtask level may appear after complex transitions.
 */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Fire a circuit-breaker operation and wait for all synchronous side-effects
 * (metrics, state changes) to have settled.
 */
async function fire(breaker, key = 'k') {
  await breaker.fire(key).catch(() => {});
  // EventEmitter callbacks are synchronous within the same microtask chain.
  // By the time the above line returns, metrics are already updated.
  // The extra flush handles any edge-case nested microtasks.
  await flushMicrotasks();
}

/**
 * Open the circuit by exceeding volumeThreshold with 100% failures.
 * @param {object} circuitBreaker - the breaker returned by createRedisCircuitBreaker
 * @param {string} operation - redis operation name, default 'get'
 * @param {number} count - number of failure calls, must exceed volumeThreshold
 */
async function openCircuit(circuitBreaker, operation = 'get', count = 4) {
  for (let i = 0; i < count; i++) {
    await fire(circuitBreaker.operations[operation]);
  }
}

// ── Test setup ────────────────────────────────────────────────────────────────

let mockRedisClient;
let circuitBreaker;

beforeEach(() => {
  // doNotFake setImmediate/nextTick so that internal Node.js async plumbing
  // still works; we only need to fake setTimeout for resetTimeout control.
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'performance'] });

  mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    flushdb: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    exists: jest.fn(),
  };

  jest.clearAllMocks();
});

afterEach(async () => {
  if (circuitBreaker) {
    circuitBreaker.resetCircuit();
    circuitBreaker = null;
  }
  jest.useRealTimers();
});

// ── AT-01: OPEN state after threshold exceeded ────────────────────────────────

describe('AT-01: CLOSED → OPEN transition', () => {
  it('opens circuit after failure rate exceeds threshold', async () => {
    circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
      resetTimeout: 5000,
      timeout: 1000,
    });

    mockRedisClient.get.mockRejectedValue(connRefusedError());

    // Fire 4 requests (> volumeThreshold=3) all failing → should open
    await openCircuit(circuitBreaker, 'get', 4);

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.failureCount).toBeGreaterThanOrEqual(3);
    expect(metrics.currentState).toBe('OPEN');
    expect(circuitBreaker.isCircuitOpen()).toBe(true);
  });
});

// ── AT-02: HALF_OPEN state after resetTimeout ─────────────────────────────────

describe('AT-02: OPEN → HALF_OPEN transition via resetTimeout', () => {
  it('enters HALF_OPEN state after resetTimeout elapses', async () => {
    const resetTimeout = 5000;

    circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
      resetTimeout,
      timeout: 1000,
    });

    mockRedisClient.get.mockRejectedValue(connRefusedError());

    // Open the circuit
    await openCircuit(circuitBreaker, 'get', 4);
    expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

    // Advance past resetTimeout — fires opossum's internal _halfOpen timer synchronously
    jest.advanceTimersByTime(resetTimeout + 100);
    await flushMicrotasks();

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.currentState).toBe('HALF_OPEN');
    expect(metrics.circuitHalfOpenCount).toBeGreaterThanOrEqual(1);
  });
});

// ── AT-03: Failure count accuracy ────────────────────────────────────────────

describe('AT-03: Failure count is tracked accurately', () => {
  it('increments failureCount exactly once per rejected operation', async () => {
    circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
      volumeThreshold: 20, // Keep circuit CLOSED so no state changes interfere
      errorThresholdPercentage: 90,
    });

    mockRedisClient.get.mockRejectedValue(connRefusedError('Redis connection refused'));

    for (let i = 0; i < 4; i++) {
      await fire(circuitBreaker.operations.get);
    }

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.failureCount).toBe(4);
    expect(metrics.successCount).toBe(0);
  });
});

// ── AT-04: Full CLOSED→OPEN→HALF_OPEN→CLOSED cycle ───────────────────────────

describe('AT-04: Full state cycle CLOSED → OPEN → HALF_OPEN → CLOSED', () => {
  it('traverses the complete circuit state machine deterministically', async () => {
    const resetTimeout = 5000;

    circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
      resetTimeout,
      halfOpenRequests: 2,
      timeout: 1000,
    });

    // ① Start CLOSED
    expect(circuitBreaker.getMetrics().currentState).toBe('CLOSED');

    // ② Fail until OPEN
    mockRedisClient.get.mockRejectedValue(connRefusedError());
    await openCircuit(circuitBreaker, 'get', 4);
    expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

    // ③ Advance time → HALF_OPEN
    jest.advanceTimersByTime(resetTimeout + 100);
    await flushMicrotasks();
    expect(circuitBreaker.getMetrics().currentState).toBe('HALF_OPEN');

    // ④ Succeed in HALF_OPEN → triggers CLOSED
    mockRedisClient.get.mockResolvedValue('recovered');
    for (let i = 0; i < 3; i++) {
      await fire(circuitBreaker.operations.get);
    }

    const finalMetrics = circuitBreaker.getMetrics();
    expect(finalMetrics.currentState).toBe('CLOSED');
    expect(finalMetrics.circuitOpenCount).toBeGreaterThanOrEqual(1);
    expect(finalMetrics.circuitHalfOpenCount).toBeGreaterThanOrEqual(1);
    expect(finalMetrics.circuitCloseCount).toBeGreaterThanOrEqual(1);
    expect(finalMetrics.successCount).toBeGreaterThan(0);
  });
});

// ── AT-05: Intermittent failure tracking ─────────────────────────────────────

describe('AT-05: Intermittent failures tracked correctly (success + failure mix)', () => {
  it('tracks both successes and failures accurately in a mixed sequence', async () => {
    circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
      volumeThreshold: 20, // Keep circuit CLOSED throughout
      errorThresholdPercentage: 90,
    });

    mockRedisClient.get
      .mockResolvedValueOnce('ok1')
      .mockRejectedValueOnce(connRefusedError('fail1'))
      .mockResolvedValueOnce('ok2')
      .mockRejectedValueOnce(connRefusedError('fail2'));

    await fire(circuitBreaker.operations.get); // success
    await fire(circuitBreaker.operations.get); // failure
    await fire(circuitBreaker.operations.get); // success
    await fire(circuitBreaker.operations.get); // failure

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.successCount).toBe(2);
    expect(metrics.failureCount).toBe(2);
  });
});
