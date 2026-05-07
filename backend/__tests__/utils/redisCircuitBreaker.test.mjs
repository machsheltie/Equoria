import { describe, it, expect } from '@jest/globals';
import { createRedisCircuitBreaker } from '../../utils/redisCircuitBreaker.mjs';

// Import DEFAULT_CIRCUIT_OPTIONS by importing the module directly
// redisCircuitBreaker.mjs exports it as a named export
import * as circuitBreakerModule from '../../utils/redisCircuitBreaker.mjs';

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
