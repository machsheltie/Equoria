import { describe, it, expect } from '@jest/globals';
import { createRedisCircuitBreaker } from '../utils/redisCircuitBreaker.mjs';

// Import DEFAULT_CIRCUIT_OPTIONS by importing the module directly
// redisCircuitBreaker.mjs exports it as a named export
import * as circuitBreakerModule from '../utils/redisCircuitBreaker.mjs';

const DEFAULT_CIRCUIT_OPTIONS = circuitBreakerModule.DEFAULT_CIRCUIT_OPTIONS;

// ─── DEFAULT_CIRCUIT_OPTIONS ──────────────────────────────────────────────────

describe('DEFAULT_CIRCUIT_OPTIONS', () => {
  it('is an object', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS).toBe('object');
    expect(DEFAULT_CIRCUIT_OPTIONS).not.toBeNull();
  });

  it('has errorThresholdPercentage as a number', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS.errorThresholdPercentage).toBe('number');
    expect(DEFAULT_CIRCUIT_OPTIONS.errorThresholdPercentage).toBeGreaterThan(0);
    expect(DEFAULT_CIRCUIT_OPTIONS.errorThresholdPercentage).toBeLessThanOrEqual(100);
  });

  it('has resetTimeout as a positive number', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS.resetTimeout).toBe('number');
    expect(DEFAULT_CIRCUIT_OPTIONS.resetTimeout).toBeGreaterThan(0);
  });

  it('has timeout as a positive number', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS.timeout).toBe('number');
    expect(DEFAULT_CIRCUIT_OPTIONS.timeout).toBeGreaterThan(0);
  });

  it('has volumeThreshold as a positive number', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS.volumeThreshold).toBe('number');
    expect(DEFAULT_CIRCUIT_OPTIONS.volumeThreshold).toBeGreaterThan(0);
  });

  it('has halfOpenRequests as a positive number', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS.halfOpenRequests).toBe('number');
    expect(DEFAULT_CIRCUIT_OPTIONS.halfOpenRequests).toBeGreaterThan(0);
  });

  it('has errorFilter as a function', () => {
    expect(typeof DEFAULT_CIRCUIT_OPTIONS.errorFilter).toBe('function');
  });
});

// ─── errorFilter (test-mode behavior) ────────────────────────────────────────

describe('DEFAULT_CIRCUIT_OPTIONS.errorFilter (test mode)', () => {
  const { errorFilter } = DEFAULT_CIRCUIT_OPTIONS;

  it('returns true (filtered/ignored) for non-ECONNREFUSED errors in test mode', () => {
    const err = new Error('some other error');
    err.code = 'ETIMEDOUT';
    expect(errorFilter(err)).toBe(true);
  });

  it('returns false (counted as failure) for ECONNREFUSED in test mode', () => {
    const err = new Error('connection refused');
    err.code = 'ECONNREFUSED';
    expect(errorFilter(err)).toBe(false);
  });

  it('returns true for errors with no code in test mode', () => {
    const err = new Error('generic error');
    expect(errorFilter(err)).toBe(true);
  });

  it('returns true for null error (safe default) in test mode', () => {
    expect(errorFilter(null)).toBe(true);
  });

  it('returns true for undefined error in test mode', () => {
    expect(errorFilter(undefined)).toBe(true);
  });

  it('returns true for ENOTFOUND in test mode', () => {
    const err = new Error('not found');
    err.code = 'ENOTFOUND';
    expect(errorFilter(err)).toBe(true);
  });

  it('returns true for ECONNRESET in test mode', () => {
    const err = new Error('connection reset');
    err.code = 'ECONNRESET';
    expect(errorFilter(err)).toBe(true);
  });

  it('returns a boolean (not truthy/falsy)', () => {
    const err = new Error('test');
    err.code = 'ECONNREFUSED';
    expect(typeof errorFilter(err)).toBe('boolean');
  });
});

// ─── createRedisCircuitBreaker ────────────────────────────────────────────────

describe('createRedisCircuitBreaker', () => {
  it('is a function', () => {
    expect(typeof createRedisCircuitBreaker).toBe('function');
  });

  it('returns an object (circuit breaker) when called with a stub client', () => {
    const stubClient = {
      ping: () => Promise.resolve('PONG'),
      on: () => {},
    };
    const breaker = createRedisCircuitBreaker(stubClient);
    expect(typeof breaker).toBe('object');
    expect(breaker).not.toBeNull();
  });

  it('returned object has operations map', () => {
    const stubClient = {
      get: () => Promise.resolve('val'),
      set: () => Promise.resolve('OK'),
      on: () => {},
    };
    const result = createRedisCircuitBreaker(stubClient);
    expect(typeof result.operations).toBe('object');
    expect(result.operations).not.toBeNull();
  });

  it('returned object has getHealthStatus function', () => {
    const stubClient = { get: () => Promise.resolve(null), on: () => {} };
    const result = createRedisCircuitBreaker(stubClient);
    expect(typeof result.getHealthStatus).toBe('function');
  });

  it('getHealthStatus returns an object with status field', () => {
    const stubClient = { get: () => Promise.resolve(null), on: () => {} };
    const result = createRedisCircuitBreaker(stubClient);
    const health = result.getHealthStatus();
    expect(typeof health).toBe('object');
    expect(typeof health.status).toBe('string');
    expect(health.circuitState).toBe('CLOSED');
  });

  it('returned object has getMetrics function', () => {
    const stubClient = { get: () => Promise.resolve(null), on: () => {} };
    const result = createRedisCircuitBreaker(stubClient);
    expect(typeof result.getMetrics).toBe('function');
  });

  it('returned object has isCircuitOpen function', () => {
    const stubClient = { get: () => Promise.resolve(null), on: () => {} };
    const result = createRedisCircuitBreaker(stubClient);
    expect(typeof result.isCircuitOpen).toBe('function');
    expect(result.isCircuitOpen()).toBe(false);
  });

  it('returned object has resetCircuit function', () => {
    const stubClient = { get: () => Promise.resolve(null), on: () => {} };
    const result = createRedisCircuitBreaker(stubClient);
    expect(typeof result.resetCircuit).toBe('function');
  });

  it('returned object exposes rawClient', () => {
    const stubClient = { get: () => Promise.resolve(null), on: () => {} };
    const result = createRedisCircuitBreaker(stubClient);
    expect(result.rawClient).toBe(stubClient);
  });

  it('accepts custom options', () => {
    const stubClient = {
      ping: () => Promise.resolve('PONG'),
      on: () => {},
    };
    expect(() => createRedisCircuitBreaker(stubClient, { timeout: 1000, volumeThreshold: 5 })).not.toThrow();
  });
});

// ─── errorFilter — production env (line 44) ──────────────────────────────────

describe('DEFAULT_CIRCUIT_OPTIONS.errorFilter (production env)', () => {
  it('returns false for any error code when NODE_ENV is not test', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const e1 = new Error('timeout');
      e1.code = 'ETIMEDOUT';
      expect(DEFAULT_CIRCUIT_OPTIONS.errorFilter(e1)).toBe(false);

      const e2 = new Error('conn');
      e2.code = 'ECONNREFUSED';
      expect(DEFAULT_CIRCUIT_OPTIONS.errorFilter(e2)).toBe(false);

      expect(DEFAULT_CIRCUIT_OPTIONS.errorFilter(null)).toBe(false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

// ─── getMetrics() — body coverage ────────────────────────────────────────────

describe('getMetrics()', () => {
  it('returns raw stats object with all expected keys at initial state', () => {
    const stub = { get: () => Promise.resolve(null), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    const m = cb.getMetrics();
    expect(typeof m).toBe('object');
    expect(m.successCount).toBe(0);
    expect(m.failureCount).toBe(0);
    expect(m.timeoutCount).toBe(0);
    expect(m.fallbackCount).toBe(0);
    expect(m.circuitOpenCount).toBe(0);
    expect(m.circuitCloseCount).toBe(0);
    expect(m.circuitHalfOpenCount).toBe(0);
    expect(m.currentState).toBe('CLOSED');
    expect(m.lastStateChange).toBeNull();
  });

  it('returns a snapshot (not a live reference) of stats', () => {
    const stub = { get: () => Promise.resolve(null), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    const snapshot1 = cb.getMetrics();
    cb.operations.get.emit('success');
    const snapshot2 = cb.getMetrics();
    expect(snapshot1.successCount).toBe(0);
    expect(snapshot2.successCount).toBe(1);
  });
});

// ─── resetCircuit() — body coverage ──────────────────────────────────────────

describe('resetCircuit()', () => {
  it('resets all metrics to zero without throwing', () => {
    const stub = { get: () => Promise.resolve(null), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    cb.operations.get.emit('success');
    cb.operations.get.emit('failure', new Error('boom'));
    cb.operations.get.emit('timeout');
    cb.resetCircuit();
    const m = cb.getMetrics();
    expect(m.successCount).toBe(0);
    expect(m.failureCount).toBe(0);
    expect(m.timeoutCount).toBe(0);
    expect(m.currentState).toBe('CLOSED');
  });

  it('isCircuitOpen() returns false after resetCircuit()', () => {
    const stub = { get: () => Promise.resolve(null), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    cb.operations.get.emit('open');
    expect(cb.isCircuitOpen()).toBe(true);
    cb.resetCircuit();
    expect(cb.isCircuitOpen()).toBe(false);
  });
});

// ─── CircuitMetrics — event-handler paths ────────────────────────────────────

function makeBreaker() {
  const stub = {};
  ['get', 'set', 'setex', 'del', 'keys', 'flushdb', 'expire', 'ttl', 'exists'].forEach(k => {
    stub[k] = () => Promise.resolve(null);
  });
  stub.on = () => {};
  const cb = createRedisCircuitBreaker(stub);
  return { cb, breaker: cb.operations.get };
}

describe('CircuitMetrics — event handlers cover incrementSuccess/Failure/Timeout/Fallback/updateState', () => {
  it('emitting "success" increments successCount (lines 178-179)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('success');
    expect(cb.getMetrics().successCount).toBe(1);
  });

  it('emitting "failure" increments failureCount (lines 184-185)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('failure', new Error('oops'));
    expect(cb.getMetrics().failureCount).toBe(1);
  });

  it('emitting "timeout" increments timeoutCount (lines 193-194)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('timeout');
    expect(cb.getMetrics().timeoutCount).toBe(1);
  });

  it('emitting "fallback" increments fallbackCount (lines 201-202)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('fallback');
    expect(cb.getMetrics().fallbackCount).toBe(1);
  });

  it('emitting "open" sets state to OPEN, increments circuitOpenCount, sets lastStateChange (lines 152-153, 87-88)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('open');
    const m = cb.getMetrics();
    expect(m.currentState).toBe('OPEN');
    expect(m.circuitOpenCount).toBe(1);
    expect(m.lastStateChange).not.toBeNull();
    expect(cb.isCircuitOpen()).toBe(true);
  });

  it('emitting "halfOpen" sets state to HALF_OPEN and increments circuitHalfOpenCount (lines 162-163, 91-92)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('halfOpen');
    const m = cb.getMetrics();
    expect(m.currentState).toBe('HALF_OPEN');
    expect(m.circuitHalfOpenCount).toBe(1);
    expect(cb.isCircuitOpen()).toBe(false);
  });

  it('emitting "close" sets state to CLOSED and increments circuitCloseCount (lines 170-171, 89-90)', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('open');
    breaker.emit('close');
    const m = cb.getMetrics();
    expect(m.currentState).toBe('CLOSED');
    expect(m.circuitCloseCount).toBe(1);
  });

  it('getHealthStatus reports degraded + correct errorRate after open event', () => {
    const { cb, breaker } = makeBreaker();
    breaker.emit('success');
    breaker.emit('failure', new Error('test'));
    breaker.emit('open');
    const h = cb.getHealthStatus();
    expect(h.status).toBe('degraded');
    expect(h.circuitState).toBe('OPEN');
    expect(h.metrics.totalRequests).toBe(2);
    expect(h.metrics.errorRate).toBe('50.00%');
    expect(h.circuitHistory.openCount).toBe(1);
  });

  it('getHealthStatus uses 0 errorRate when no requests have been made', () => {
    const stub = { get: () => Promise.resolve(null), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    const h = cb.getHealthStatus();
    expect(h.metrics.errorRate).toBe('0%');
    expect(h.metrics.totalRequests).toBe(0);
  });
});

// ─── fire() — executes the wrapped action (line 147) ─────────────────────────

describe('fire() — executes wrapped Redis operation', () => {
  it('returns the value from the underlying client', async () => {
    const stub = { get: () => Promise.resolve('cache-hit'), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    const val = await cb.operations.get.fire('my-key');
    expect(val).toBe('cache-hit');
  });

  it('fire() on set operation returns OK from stub', async () => {
    const stub = {
      set: () => Promise.resolve('OK'),
      get: () => Promise.resolve(null),
      on: () => {},
    };
    const cb = createRedisCircuitBreaker(stub);
    const val = await cb.operations.set.fire('key', 'value');
    expect(val).toBe('OK');
  });

  it('after fire() succeeds, successCount is incremented via automatic success event', async () => {
    const stub = { get: () => Promise.resolve('val'), on: () => {} };
    const cb = createRedisCircuitBreaker(stub);
    await cb.operations.get.fire('k');
    expect(cb.getMetrics().successCount).toBeGreaterThan(0);
  });
});
