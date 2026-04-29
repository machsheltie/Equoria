/**
 * Redis Circuit Breaker Integration Tests
 *
 * Comprehensive tests for the Redis circuit breaker implementation using opossum.
 * Tests circuit state transitions, failure scenarios, fallback strategies, and metrics.
 *
 * Test Coverage:
 * - Circuit state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Redis failure scenarios (connection refused, timeout, intermittent failures)
 * - Fallback to in-memory cache when circuit is open
 * - Metrics accuracy and health monitoring
 * - Concurrent request handling during failures
 *
 * ── Timing technique ──────────────────────────────────────────────────────────
 * All tests use jest.useFakeTimers() so that opossum's internal resetTimeout
 * (30 s by default) can be advanced instantly with jest.advanceTimersByTime().
 * setImmediate/nextTick/performance are NOT faked so Node.js async plumbing works.
 *
 * ── Error types ───────────────────────────────────────────────────────────────
 * DEFAULT_CIRCUIT_OPTIONS.errorFilter behaviour in test env:
 *   - ECONNREFUSED errors → returns false (not filtered) → counted as failure → can trip circuit
 *   - Plain errors (no code) → returns true (filtered) → treated as success → do NOT count
 *
 * Therefore: always use connRefusedError() when you need the circuit to count a failure.
 * Use plain new Error() only when testing that filtered errors are propagated but not counted.
 */

import { jest, describe, beforeAll, beforeEach, afterEach, it, expect } from '@jest/globals';

// 21R-SEC-3-A: ESM mocking pattern. jest.unstable_mockModule resolves
// paths relative to __tests__/setup.mjs (the setupFilesAfterEnv file),
// hence ../utils/logger.mjs (1-level-up from __tests__/) rather than the
// ../../utils/... that would be relative to this test file. The dynamic
// import below uses the test-file-relative path, which DOES resolve.
let createRedisCircuitBreaker;
let DEFAULT_CIRCUIT_OPTIONS;

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeAll(async () => {
  ({ createRedisCircuitBreaker, DEFAULT_CIRCUIT_OPTIONS } = await import('../../utils/redisCircuitBreaker.mjs'));
});

// ── Module-scope helpers ───────────────────────────────────────────────────────

/**
 * Drain residual microtasks.
 * opossum's EventEmitter callbacks are synchronous within the microtask chain,
 * so two Promise.resolve() ticks are enough to let metrics settle.
 */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Fire one circuit-breaker operation and wait for metrics to settle.
 * Swallows the rejection so callers don't need try/catch.
 */
async function fire(breaker, key = 'k') {
  await breaker.fire(key).catch(() => {});
  await flushMicrotasks();
}

/**
 * Open a circuit by firing `count` consecutive failures.
 * count must exceed the breaker's volumeThreshold.
 */
async function openCircuit(circuitBreaker, operation = 'get', count = 12) {
  for (let i = 0; i < count; i++) {
    await fire(circuitBreaker.operations[operation]);
  }
}

/**
 * Create an ECONNREFUSED error that is counted as a real failure in test env.
 *
 * DEFAULT_CIRCUIT_OPTIONS.errorFilter in test env:
 *   ECONNREFUSED → err.code !== 'ECONNREFUSED' = false → NOT filtered → counted as failure
 *   plain error  → err.code !== 'ECONNREFUSED' = true  → filtered    → treated as success
 *
 * Always use connRefusedError() when you need failureCount to increment.
 */
function connRefusedError(msg = 'Connection refused') {
  const err = new Error(msg);
  err.code = 'ECONNREFUSED';
  return err;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Redis Circuit Breaker Integration Tests', () => {
  let mockRedisClient;
  let circuitBreaker;

  beforeEach(() => {
    // Fake timers — setImmediate/nextTick/performance left real so async plumbing works.
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

  // ── Circuit Breaker Initialization ─────────────────────────────────────────

  describe('Circuit Breaker Initialization', () => {
    it('should create circuit breaker with default configuration', () => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);

      expect(circuitBreaker).toBeDefined();
      expect(circuitBreaker.operations).toBeDefined();
      expect(circuitBreaker.getHealthStatus).toBeDefined();
      expect(circuitBreaker.getMetrics).toBeDefined();
      expect(circuitBreaker.isCircuitOpen).toBeDefined();
      expect(circuitBreaker.resetCircuit).toBeDefined();
      expect(circuitBreaker.rawClient).toBe(mockRedisClient);
    });

    it('should create circuit breaker with custom configuration', () => {
      const customConfig = {
        errorThresholdPercentage: 60,
        resetTimeout: 60000,
        timeout: 5000,
      };

      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, customConfig);

      const healthStatus = circuitBreaker.getHealthStatus();
      expect(healthStatus.configuration.errorThreshold).toBe('60%');
      expect(healthStatus.configuration.resetTimeout).toBe('60000ms');
      expect(healthStatus.configuration.operationTimeout).toBe('5000ms');
    });

    it('should wrap all Redis operations with circuit breaker', () => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);

      const expectedOperations = ['get', 'set', 'setex', 'del', 'keys', 'flushdb', 'expire', 'ttl', 'exists'];
      expectedOperations.forEach(operation => {
        expect(circuitBreaker.operations[operation]).toBeDefined();
      });
    });
  });

  // ── Circuit State Transitions ───────────────────────────────────────────────

  describe('Circuit State Transitions', () => {
    it('should start in CLOSED state', () => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.currentState).toBe('CLOSED');
      expect(circuitBreaker.isCircuitOpen()).toBe(false);
    });

    it('should open circuit after 50% error rate over 10 requests (default threshold)', async () => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        errorThresholdPercentage: 50,
        volumeThreshold: 10,
        timeout: 3000,
      });

      // ECONNREFUSED errors are counted as failures in test env (errorFilter returns false).
      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));

      // 11 failures → exceeds volumeThreshold=10 at 100% error rate → circuit opens.
      await openCircuit(circuitBreaker, 'get', 11);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBeGreaterThanOrEqual(10);
      expect(metrics.currentState).toBe('OPEN');
      expect(circuitBreaker.isCircuitOpen()).toBe(true);
    });

    it('should enter HALF_OPEN state after reset timeout', async () => {
      const resetTimeout = 500;
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        errorThresholdPercentage: 50,
        resetTimeout,
        volumeThreshold: 5,
      });

      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));
      await openCircuit(circuitBreaker, 'get', 6); // exceed volumeThreshold=5
      expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

      // Advance past resetTimeout — fires opossum's internal _halfOpen timer synchronously.
      jest.advanceTimersByTime(resetTimeout + 100);
      await flushMicrotasks();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.currentState).toBe('HALF_OPEN');
      expect(metrics.circuitHalfOpenCount).toBeGreaterThanOrEqual(1);
    });

    it('should close circuit after successful recovery in HALF_OPEN state', async () => {
      const resetTimeout = 500;
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        errorThresholdPercentage: 50,
        resetTimeout,
        volumeThreshold: 5,
        halfOpenRequests: 3,
      });

      // Force OPEN
      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));
      await openCircuit(circuitBreaker, 'get', 6);
      expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

      // Advance to HALF_OPEN
      jest.advanceTimersByTime(resetTimeout + 100);
      await flushMicrotasks();
      expect(circuitBreaker.getMetrics().currentState).toBe('HALF_OPEN');

      // Succeed in HALF_OPEN → CLOSED
      mockRedisClient.get.mockResolvedValue('recovered');
      for (let i = 0; i < 3; i++) {
        await fire(circuitBreaker.operations.get);
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.currentState).toBe('CLOSED');
      expect(metrics.circuitOpenCount).toBeGreaterThanOrEqual(1);
      expect(metrics.circuitHalfOpenCount).toBeGreaterThanOrEqual(1);
      expect(metrics.circuitCloseCount).toBeGreaterThanOrEqual(1);
      expect(metrics.successCount).toBeGreaterThan(0);
    });
  });

  // ── Redis Failure Scenarios ─────────────────────────────────────────────────

  describe('Redis Failure Scenarios', () => {
    beforeEach(() => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);
    });

    it('should handle Redis connection refused errors', async () => {
      // In test env, ECONNREFUSED errors ARE counted as failures (errorFilter returns false).
      // The error is re-thrown to the caller AND increments failureCount.
      // The circuit does not open yet because default volumeThreshold=10 requires more failures.
      const connectionError = connRefusedError('Connection refused');
      mockRedisClient.get.mockRejectedValue(connectionError);

      // Error is propagated to the caller.
      await expect(circuitBreaker.operations.get.fire('test-key')).rejects.toThrow('Connection refused');
      await flushMicrotasks();

      // ECONNREFUSED is counted as a failure (not filtered) in test env.
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBeGreaterThan(0);
      expect(metrics.successCount).toBe(0);
      expect(circuitBreaker.isCircuitOpen()).toBe(false); // only 1 failure, need 10 to open
    });

    it('should handle Redis operation timeout (> 3s)', async () => {
      // DEFAULT_CIRCUIT_OPTIONS.timeout = 3000 ms.
      // With fake timers: start the operation, advance time past the timeout,
      // then await the rejection so metrics settle.
      let timeoutHandle;
      mockRedisClient.get.mockImplementation(() => {
        return new Promise(resolve => {
          // 5 s — deliberately longer than opossum's 3 s timeout.
          timeoutHandle = setTimeout(() => resolve('too-slow'), 5000);
        });
      });

      const firePromise = circuitBreaker.operations.get.fire('test-key');
      jest.advanceTimersByTime(3100); // fire opossum's 3 000 ms timeout synchronously
      await firePromise.catch(() => {});
      await flushMicrotasks();

      // Cancel the mock's 5 s timer (still in fake-timer queue, not yet fired).
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.timeoutCount).toBeGreaterThan(0);
    });

    it('should handle intermittent Redis failures', async () => {
      // ECONNREFUSED errors are counted as failures in test env.
      mockRedisClient.get
        .mockResolvedValueOnce('success1')
        .mockRejectedValueOnce(connRefusedError('Intermittent failure'))
        .mockResolvedValueOnce('success2')
        .mockRejectedValueOnce(connRefusedError('Intermittent failure'));

      const result1 = await circuitBreaker.operations.get.fire('key1');
      expect(result1).toBe('success1');
      await flushMicrotasks();

      await expect(circuitBreaker.operations.get.fire('key2')).rejects.toThrow('Intermittent failure');
      await flushMicrotasks();

      const result3 = await circuitBreaker.operations.get.fire('key3');
      expect(result3).toBe('success2');
      await flushMicrotasks();

      await expect(circuitBreaker.operations.get.fire('key4')).rejects.toThrow('Intermittent failure');
      await flushMicrotasks();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(2);
    });

    it('should handle multiple operation types failing simultaneously', async () => {
      mockRedisClient.get.mockRejectedValue(connRefusedError('Get failed'));
      mockRedisClient.set.mockRejectedValue(connRefusedError('Set failed'));
      mockRedisClient.del.mockRejectedValue(connRefusedError('Del failed'));

      await expect(circuitBreaker.operations.get.fire('key')).rejects.toThrow('Get failed');
      await flushMicrotasks();

      await expect(circuitBreaker.operations.set.fire('key', 'value')).rejects.toThrow('Set failed');
      await flushMicrotasks();

      await expect(circuitBreaker.operations.del.fire('key')).rejects.toThrow('Del failed');
      await flushMicrotasks();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(3);
    });
  });

  // ── Fallback Strategies ─────────────────────────────────────────────────────

  describe('Fallback Strategies', () => {
    beforeEach(() => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        errorThresholdPercentage: 50,
        volumeThreshold: 5,
      });
    });

    it('should allow operations to fail when circuit is CLOSED', async () => {
      mockRedisClient.get.mockRejectedValue(connRefusedError('Redis error'));

      await expect(circuitBreaker.operations.get.fire('test-key')).rejects.toThrow('Redis error');
      await flushMicrotasks();

      // One failure is not enough to open with volumeThreshold=5.
      expect(circuitBreaker.isCircuitOpen()).toBe(false);
    });

    it('should reject operations immediately when circuit is OPEN', async () => {
      // Open the circuit with ECONNREFUSED failures (counted in test env).
      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));
      await openCircuit(circuitBreaker, 'get', 6); // exceed volumeThreshold=5

      expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

      // Track Redis call count before the next attempt.
      const callsBefore = mockRedisClient.get.mock.calls.length;

      // An operation fired at OPEN is short-circuited — Redis is NOT called.
      await fire(circuitBreaker.operations.get);

      // Redis was not called (request was rejected by open circuit, not forwarded).
      expect(mockRedisClient.get.mock.calls.length).toBe(callsBefore);
      // Circuit remains open (no fallback function registered, so no auto-recovery here).
      expect(circuitBreaker.isCircuitOpen()).toBe(true);
    });

    it('should remain OPEN and keep rejecting when circuit is open', async () => {
      // Open circuit.
      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));
      await openCircuit(circuitBreaker, 'get', 6);
      expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

      // Fire 3 more times — circuit stays OPEN, Redis is never called.
      const callsBefore = mockRedisClient.get.mock.calls.length;
      for (let i = 0; i < 3; i++) {
        await fire(circuitBreaker.operations.get);
      }
      expect(mockRedisClient.get.mock.calls.length).toBe(callsBefore);
      expect(circuitBreaker.isCircuitOpen()).toBe(true);
    });
  });

  // ── Concurrent Request Handling ─────────────────────────────────────────────

  describe('Concurrent Request Handling', () => {
    beforeEach(() => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);
    });

    it('should handle concurrent successful requests', async () => {
      mockRedisClient.get.mockResolvedValue('success');

      // 10 concurrent fires — all resolve immediately.
      const promises = Array(10)
        .fill(null)
        .map((_, i) => circuitBreaker.operations.get.fire(`key${i}`));

      const results = await Promise.all(promises);
      await flushMicrotasks();

      expect(results.every(r => r === 'success')).toBe(true);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(10);
    });

    it('should handle concurrent requests during circuit opening', async () => {
      // First 5 calls fail (ECONNREFUSED = counted); remainder succeed.
      let callCount = 0;
      mockRedisClient.get.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) {
          return Promise.reject(connRefusedError('Connection failed'));
        }
        return Promise.resolve('success');
      });

      const promises = Array(10)
        .fill(null)
        .map((_, i) => circuitBreaker.operations.get.fire(`key${i}`).catch(e => e.message));

      await Promise.all(promises);
      await flushMicrotasks();

      const metrics = circuitBreaker.getMetrics();
      // Some mix of failures, successes, and possibly fallbacks (if circuit opened mid-batch).
      expect(metrics.failureCount + metrics.successCount + metrics.fallbackCount).toBeGreaterThan(0);
    });
  });

  // ── Metrics and Health Monitoring ───────────────────────────────────────────

  describe('Metrics and Health Monitoring', () => {
    beforeEach(() => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);
    });

    it('should accurately track success count', async () => {
      mockRedisClient.get.mockResolvedValue('success');

      await fire(circuitBreaker.operations.get);
      await fire(circuitBreaker.operations.get);
      await fire(circuitBreaker.operations.get);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(3);
    });

    it('should accurately track failure count', async () => {
      // Fresh circuit with high threshold so it stays CLOSED throughout.
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        volumeThreshold: 20,
        errorThresholdPercentage: 90,
      });

      // ECONNREFUSED = counted as failure in test env.
      mockRedisClient.get.mockRejectedValue(connRefusedError('Redis error'));

      for (let i = 0; i < 4; i++) {
        await fire(circuitBreaker.operations.get);
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(4);
      expect(metrics.successCount).toBe(0);
    });

    it('should calculate error rate correctly', async () => {
      // Fresh circuit with high thresholds so it stays CLOSED.
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        volumeThreshold: 20,
        errorThresholdPercentage: 90,
      });

      // 3 successes, 2 failures → 40% error rate.
      mockRedisClient.get
        .mockResolvedValueOnce('success1')
        .mockResolvedValueOnce('success2')
        .mockRejectedValueOnce(connRefusedError('failure1'))
        .mockResolvedValueOnce('success3')
        .mockRejectedValueOnce(connRefusedError('failure2'));

      await fire(circuitBreaker.operations.get);
      await fire(circuitBreaker.operations.get);
      await fire(circuitBreaker.operations.get);
      await fire(circuitBreaker.operations.get);
      await fire(circuitBreaker.operations.get);

      const healthStatus = circuitBreaker.getHealthStatus();
      expect(healthStatus.metrics.successCount + healthStatus.metrics.failureCount).toBe(5);
      expect(healthStatus.metrics.totalRequests).toBe(5);
      expect(healthStatus.metrics.errorRate).toBe('40.00%');
    });

    it('should return correct health status based on circuit state', () => {
      const healthStatus = circuitBreaker.getHealthStatus();

      expect(healthStatus.status).toBe('healthy'); // CLOSED state
      expect(healthStatus.circuitState).toBe('CLOSED');
      expect(healthStatus.metrics).toBeDefined();
      expect(healthStatus.circuitHistory).toBeDefined();
      expect(healthStatus.configuration).toBeDefined();
    });

    it('should return degraded health status when circuit is OPEN', async () => {
      // Custom low threshold so few failures open the circuit.
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        errorThresholdPercentage: 50,
        volumeThreshold: 3,
        timeout: 1000,
      });

      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));
      await openCircuit(circuitBreaker, 'get', 4); // 4 > volumeThreshold=3

      const healthStatus = circuitBreaker.getHealthStatus();
      expect(healthStatus.status).toBe('degraded');
      expect(healthStatus.circuitState).toBe('OPEN');
      expect(healthStatus.metrics.failureCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Manual Circuit Control ──────────────────────────────────────────────────

  describe('Manual Circuit Control', () => {
    beforeEach(() => {
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient);
    });

    it('should allow manual circuit reset', async () => {
      // Create circuit breaker with low threshold and open it.
      circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
        errorThresholdPercentage: 50,
        volumeThreshold: 3,
      });

      mockRedisClient.get.mockRejectedValue(connRefusedError('Connection failed'));
      await openCircuit(circuitBreaker, 'get', 4); // open with 4 failures
      expect(circuitBreaker.getMetrics().failureCount).toBeGreaterThan(0);
      expect(circuitBreaker.getMetrics().currentState).toBe('OPEN');

      // Manually reset circuit.
      circuitBreaker.resetCircuit();
      await flushMicrotasks();

      // Circuit should be CLOSED and all metrics zeroed.
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.currentState).toBe('CLOSED');
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
    });

    it('should access raw Redis client for unwrapped operations', () => {
      expect(circuitBreaker.rawClient).toBe(mockRedisClient);
      expect(typeof circuitBreaker.rawClient.get).toBe('function');
    });
  });

  // ── Error Filtering ─────────────────────────────────────────────────────────

  describe('Error Filtering', () => {
    it('should count ECONNREFUSED errors as failures in test environment', () => {
      // In test env, errorFilter returns false for ECONNREFUSED:
      //   err.code !== 'ECONNREFUSED' → 'ECONNREFUSED' !== 'ECONNREFUSED' → false
      // opossum: false = "not filtered" = counted as failure (contributes to threshold)
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'test';

        const errorFilter = DEFAULT_CIRCUIT_OPTIONS.errorFilter;
        const testError = new Error('Connection refused');
        testError.code = 'ECONNREFUSED';

        expect(errorFilter(testError)).toBe(false); // not filtered → counted as failure
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should filter plain errors as successes in test environment', () => {
      // In test env, errorFilter returns true for errors without ECONNREFUSED code:
      //   err.code !== 'ECONNREFUSED' → undefined !== 'ECONNREFUSED' → true
      // opossum: true = "filtered" = treated as success (does not count toward threshold)
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'test';

        const errorFilter = DEFAULT_CIRCUIT_OPTIONS.errorFilter;
        const testError = new Error('Some other error'); // no .code property

        expect(errorFilter(testError)).toBe(true); // filtered → treated as success
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should count all errors as failures in production environment', () => {
      // In production, errorFilter always returns false (not filtered = counted as failure).
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const errorFilter = DEFAULT_CIRCUIT_OPTIONS.errorFilter;
        const testError = new Error('Connection refused');
        testError.code = 'ECONNREFUSED';

        expect(errorFilter(testError)).toBe(false); // not filtered → counted as failure
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
