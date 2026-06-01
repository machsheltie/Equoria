import { describe, it, expect } from '@jest/globals';
import {
  isRedisConnected,
  getRedisClient,
  getRateLimitingHealth,
  createRateLimiter,
  authRateLimiter,
  trainingRateLimiter,
  queryRateLimiter,
  profileRateLimiter,
  mutationRateLimiter,
  adminRateLimiter,
  foalRateLimiter,
  breedingRateLimiter,
  competitionRateLimiter,
} from '../middleware/rateLimiting.mjs';

import {
  createAuthRateLimiter,
  resetAuthRateLimit,
  resetAllAuthRateLimits,
  getAuthRateLimitStore,
} from '../middleware/authRateLimiter.mjs';

import { trainingLimiter } from '../middleware/trainingRateLimit.mjs';

// ─── rateLimiting.mjs — connection helpers ────────────────────────────────────

describe('isRedisConnected (test mode)', () => {
  it('returns false in test mode (Redis not initialized)', () => {
    expect(isRedisConnected()).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof isRedisConnected()).toBe('boolean');
  });
});

describe('getRedisClient (test mode)', () => {
  it('returns null in test mode', () => {
    expect(getRedisClient()).toBeNull();
  });
});

describe('getRateLimitingHealth', () => {
  it('returns an object', () => {
    const health = getRateLimitingHealth();
    expect(typeof health).toBe('object');
    expect(health).not.toBeNull();
  });

  it('has redisAvailable field', () => {
    const health = getRateLimitingHealth();
    expect(health).toHaveProperty('redisAvailable');
  });

  it('has usingDistributedLimiting field', () => {
    const health = getRateLimitingHealth();
    expect(health).toHaveProperty('usingDistributedLimiting');
  });

  it('has status field', () => {
    const health = getRateLimitingHealth();
    expect(typeof health.status).toBe('string');
  });

  it('has message field', () => {
    const health = getRateLimitingHealth();
    expect(typeof health.message).toBe('string');
  });

  it('has timestamp field (ISO string)', () => {
    const health = getRateLimitingHealth();
    expect(typeof health.timestamp).toBe('string');
    expect(() => new Date(health.timestamp)).not.toThrow();
  });

  it('redisAvailable is false in test mode', () => {
    const health = getRateLimitingHealth();
    expect(health.redisAvailable).toBe(false);
  });

  it('usingDistributedLimiting is false in test mode', () => {
    const health = getRateLimitingHealth();
    expect(health.usingDistributedLimiting).toBe(false);
  });

  it('circuitBreaker is null when Redis not initialized', () => {
    const health = getRateLimitingHealth();
    expect(health.circuitBreaker).toBeNull();
  });

  it('status is "degraded" when Redis not connected', () => {
    const health = getRateLimitingHealth();
    expect(health.status).toBe('degraded');
  });
});

describe('createRateLimiter', () => {
  it('returns a function (middleware)', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 100 });
    expect(typeof limiter).toBe('function');
  });

  it('returns a function with default options', () => {
    const limiter = createRateLimiter();
    expect(typeof limiter).toBe('function');
  });

  it('returned middleware accepts req, res, next', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1000 });
    const req = {
      ip: '127.0.0.1',
      headers: {},
      method: 'GET',
      url: '/test',
      path: '/test',
    };
    const res = {
      statusCode: 200,
      set: () => {},
      setHeader: () => {},
      getHeader: () => null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: () => {},
      send: () => {},
    };
    expect(() => limiter(req, res, () => {})).not.toThrow();
  });
});

// ─── Pre-built rate limiters ──────────────────────────────────────────────────

describe('Pre-built rate limiters', () => {
  it('authRateLimiter is a function', () => {
    expect(typeof authRateLimiter).toBe('function');
  });

  it('trainingRateLimiter is a function', () => {
    expect(typeof trainingRateLimiter).toBe('function');
  });

  it('queryRateLimiter is a function', () => {
    expect(typeof queryRateLimiter).toBe('function');
  });

  it('profileRateLimiter is a function', () => {
    expect(typeof profileRateLimiter).toBe('function');
  });

  it('mutationRateLimiter is a function', () => {
    expect(typeof mutationRateLimiter).toBe('function');
  });

  it('adminRateLimiter is a function', () => {
    expect(typeof adminRateLimiter).toBe('function');
  });

  it('foalRateLimiter is a function', () => {
    expect(typeof foalRateLimiter).toBe('function');
  });

  it('breedingRateLimiter is a function', () => {
    expect(typeof breedingRateLimiter).toBe('function');
  });

  it('competitionRateLimiter is a function', () => {
    expect(typeof competitionRateLimiter).toBe('function');
  });
});

// ─── authRateLimiter.mjs (legacy adapter) ────────────────────────────────────

describe('authRateLimiter.mjs legacy adapter', () => {
  it('createAuthRateLimiter returns a function', () => {
    const result = createAuthRateLimiter();
    expect(typeof result).toBe('function');
  });

  it('createAuthRateLimiter with options returns a function', () => {
    const result = createAuthRateLimiter({ max: 10 });
    expect(typeof result).toBe('function');
  });

  it('resetAuthRateLimit does not throw', () => {
    expect(() => resetAuthRateLimit('192.168.1.1')).not.toThrow();
  });

  it('resetAllAuthRateLimits does not throw', () => {
    expect(() => resetAllAuthRateLimits()).not.toThrow();
  });

  it('getAuthRateLimitStore returns null', () => {
    expect(getAuthRateLimitStore()).toBeNull();
  });
});

// ─── trainingRateLimit.mjs (legacy adapter) ───────────────────────────────────

describe('trainingRateLimit.mjs', () => {
  it('trainingLimiter is a function', () => {
    expect(typeof trainingLimiter).toBe('function');
  });
});
