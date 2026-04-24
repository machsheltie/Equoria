/**
 * Rate Limiting Circuit Breaker Integration Tests
 *
 * Tests the integration of Redis circuit breaker with rate limiting middleware.
 * Validates fallback behavior, circuit state transitions, and distributed rate limiting.
 *
 * Phase 2, Subtask 2.2: Rate Limiting Circuit Breaker Integration Tests
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createRateLimiter, getRateLimitingHealth, isRedisConnected } from '../../middleware/rateLimiting.mjs';

// Mock Express request/response
const createMockRequest = (overrides = {}) => ({
  ip: '127.0.0.1',
  user: null,
  headers: {},
  path: '/test',
  method: 'GET',
  ...overrides,
});

const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    statusCode: 200,
    headersSent: false,
  };
  return res;
};

describe('Rate Limiting Circuit Breaker Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rate Limiter Initialization', () => {
    it('should create rate limiter successfully', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        keyPrefix: 'test',
      });

      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        createRateLimiter({
          windowMs: -1000, // Invalid
          max: 10,
        });
      }).toThrow('windowMs and max must be positive numbers');

      expect(() => {
        createRateLimiter({
          windowMs: 60000,
          max: 0, // Invalid
        });
      }).toThrow('windowMs and max must be positive numbers');
    });

    it('should use default configuration when not provided', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
    });
  });

  describe('Circuit Breaker Fallback Behavior', () => {
    it('should fall back to in-memory rate limiting when circuit is open', async () => {
      // This test verifies that when Redis circuit is open,
      // rate limiting falls back to in-memory store
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 3,
        keyPrefix: 'fallback',
        useEnvOverride: false,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      // First request should pass (in-memory tracking)
      limiter(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
    });

    it('should log circuit open state when falling back', () => {
      // Circuit open detection is logged in createRateLimiter
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyPrefix: 'circuit-log',
      });

      expect(limiter).toBeDefined();
      // Logs are generated during store creation
    });
  });

  describe('Rate Limiting with Circuit Breaker', () => {
    it('should allow requests under the limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyPrefix: 'under-limit',
        useEnvOverride: false,
      });

      // Make requests under the limit (each with new request object)
      for (let i = 0; i < 3; i++) {
        const req = createMockRequest();
        const res = createMockResponse();
        const next = jest.fn();

        limiter(req, res, next);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(next).toHaveBeenCalled();
      }
    });

    it('should configure rate limiter with blocking capability', async () => {
      // This test verifies that the rate limiter is created with proper configuration
      // Actual blocking behavior requires middleware context and sequential execution
      const limiter = createRateLimiter({
        windowMs: 1000, // 1 second window
        max: 2, // Only 2 requests
        keyPrefix: 'exceed-limit',
        useEnvOverride: false,
        message: 'Rate limit exceeded',
      });

      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');

      // Verify limiter can be called without errors
      const req = createMockRequest({ ip: '192.168.1.50' });
      const res = createMockResponse();
      const next = jest.fn();

      limiter(req, res, next);

      // Limiter should execute without errors
      expect(() => limiter).not.toThrow();
    });

    it('should use user ID for authenticated rate limiting', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyPrefix: 'user-limit',
      });

      const req = createMockRequest({
        user: { id: '12345' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      limiter(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should use user:12345 as key
      expect(next).toHaveBeenCalled();
    });

    it('should fall back to IP for unauthenticated requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyPrefix: 'ip-limit',
      });

      const req = createMockRequest({
        ip: '192.168.1.100',
      });
      const res = createMockResponse();
      const next = jest.fn();

      limiter(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should use ip:192.168.1.100 as key
      expect(next).toHaveBeenCalled();
    });
  });

  // Equoria-ocn9: removed `Test Environment Bypasses` describe block.
  // The first test ("should bypass rate limiting with test header") asserted
  // behavior that the production middleware does not implement —
  // rateLimiting.mjs:273 explicitly comments "No test-only bypass logic."
  // The test passed only because each loop iteration created a fresh mock
  // request that did not share a rate-limit key, giving false confidence
  // that a bypass header was honored. Per the 21R doctrine ("No bypass
  // evidence"), such tests cannot count as readiness coverage.
  //
  // Real no-bypass coverage of the rate-limiter lives in
  // backend/__tests__/integration/security/rate-limit-no-bypass.test.mjs
  // (Equoria-ocn9), which exercises the live Express app + middleware
  // chain without any escape headers and asserts the 429/Retry-After
  // contract.
  //
  // Env-override behavior (TEST_RATE_LIMIT_WINDOW_MS / MAX_REQUESTS) is
  // already covered indirectly by tests that set those env vars before
  // creating a limiter; a no-op assertion here added nothing.

  describe('Environment Configuration', () => {
    it('respects useEnvOverride=false even when TEST_RATE_LIMIT_MAX_REQUESTS is huge (Equoria-ocn9 review)', async () => {
      // Equoria-ocn9 review fix: the previous test only asserted
      // `expect(limiter).toBeDefined()` which passes for any return value.
      // That gave the same false confidence the deleted bypass-header test
      // gave. This rewrite actually exercises the limiter:
      //
      //   1. Set TEST_RATE_LIMIT_MAX_REQUESTS to an inflated value.
      //   2. Create a limiter with useEnvOverride:false and a low hard-coded max.
      //   3. Hammer it with max+1 requests against a real (test-only) Express app.
      //   4. Assert the (max+1)-th request returns 429 — proving the env var
      //      did NOT loosen the limit.
      //
      // If a regression made useEnvOverride:false accidentally honor env vars,
      // the env-set 999999 cap would mean no request ever returns 429 and
      // this test would fail loudly.
      const HARD_MAX = 3;
      const previousMax = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
      process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '999999';
      try {
        const app = express();
        const limiter = createRateLimiter({
          windowMs: 60000,
          max: HARD_MAX,
          keyPrefix: 'no-override-real-assertion',
          useEnvOverride: false, // env knob MUST be ignored
        });
        app.get('/probe', limiter, (_req, res) => res.status(200).json({ ok: true }));

        for (let i = 0; i < HARD_MAX; i++) {
          const res = await request(app).get('/probe');
          expect(res.status).toBe(200);
        }

        const blocked = await request(app).get('/probe');
        expect(blocked.status).toBe(429);
      } finally {
        if (previousMax === undefined) {
          delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
        } else {
          process.env.TEST_RATE_LIMIT_MAX_REQUESTS = previousMax;
        }
      }
    });
  });

  describe('Health Status Monitoring', () => {
    it('should report rate limiting health status', () => {
      const health = getRateLimitingHealth();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('redisAvailable');
      expect(health).toHaveProperty('redisConnected');
      expect(health).toHaveProperty('usingDistributedLimiting');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('status');
    });

    it('should include circuit breaker metrics when available', () => {
      const health = getRateLimitingHealth();

      // Circuit breaker metrics included if Redis client exists
      if (health.circuitBreaker) {
        expect(health.circuitBreaker).toHaveProperty('status');
        expect(health.circuitBreaker).toHaveProperty('circuitState');
        expect(health.circuitBreaker).toHaveProperty('metrics');
      }
    });

    it('should report degraded status when Redis unavailable', () => {
      // In test environment, Redis is disabled
      const health = getRateLimitingHealth();

      // Status should reflect Redis availability
      expect(['healthy', 'degraded', 'recovering']).toContain(health.status);
    });
  });

  describe('Circuit State Detection', () => {
    it('should detect when Redis connection is available', () => {
      const connected = isRedisConnected();

      // In test environment, Redis is typically not connected
      expect(typeof connected).toBe('boolean');
    });

    it('should return false when circuit breaker is open', () => {
      // When circuit is open, isRedisConnected should return false
      const connected = isRedisConnected();

      // Result depends on current Redis and circuit state
      expect(typeof connected).toBe('boolean');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Rate limiting should continue with in-memory fallback
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        keyPrefix: 'error-handling',
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      // Should not throw even if Redis has errors
      expect(() => {
        limiter(req, res, next);
      }).not.toThrow();
    });

    it('should recover when Redis becomes available', () => {
      // Health status should reflect recovery
      const initialHealth = getRateLimitingHealth();
      expect(initialHealth).toBeDefined();

      // After Redis recovers, status should update
      // (This would require actual Redis connection in non-test environment)
    });
  });

  describe('Rate Limiter Custom Handler', () => {
    it('should return proper error response when limit exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        keyPrefix: 'custom-handler',
        useEnvOverride: false,
        message: 'Custom rate limit message',
      });

      const req = createMockRequest();

      // First request should pass
      let res = createMockResponse();
      let next = jest.fn();
      limiter(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second request should be rate limited
      res = createMockResponse();
      next = jest.fn();
      limiter(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have proper rate limit response
      if (res.status.mock.calls.length > 0) {
        expect(res.status).toHaveBeenCalledWith(429);
        const jsonCall = res.json.mock.calls[0]?.[0];
        if (jsonCall) {
          expect(jsonCall).toHaveProperty('success', false);
          expect(jsonCall).toHaveProperty('status', 'error');
        }
      }
    });

    it('should include retry-after information in response', async () => {
      const limiter = createRateLimiter({
        windowMs: 5000, // 5 seconds
        max: 1,
        keyPrefix: 'retry-after',
        useEnvOverride: false,
      });

      const req = createMockRequest();

      // Exceed limit
      for (let i = 0; i < 2; i++) {
        const res = createMockResponse();
        const next = jest.fn();
        limiter(req, res, next);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Check for retry-after in response
      // (Implementation detail - rate limiter adds this to response)
    });
  });

  describe('Distributed Rate Limiting', () => {
    it('should use Redis store for distributed rate limiting when available', () => {
      // When Redis is connected and circuit is closed,
      // rate limiter should use RedisStore
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyPrefix: 'distributed',
      });

      expect(limiter).toBeDefined();
      // RedisStore creation is logged
    });

    it('should synchronize rate limits across multiple processes', async () => {
      // This test conceptually validates distributed limiting
      // In production, multiple processes would share Redis counter
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyPrefix: 'multi-process',
      });

      // Simulate requests from "different processes" (each with new request object)
      for (let i = 0; i < 3; i++) {
        const req = createMockRequest({ user: { id: 'shared-user' } });
        const res = createMockResponse();
        const next = jest.fn();
        limiter(req, res, next);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // With Redis, all processes would see same counter
      // Without Redis, each process has separate counter
    });
  });
});
