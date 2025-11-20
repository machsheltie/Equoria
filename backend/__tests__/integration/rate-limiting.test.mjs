/**
 * Integration Tests: Rate Limiting System
 *
 * Tests comprehensive rate limiting for authentication endpoints
 * Implements brute force protection as per Phase 1, Day 3
 *
 * IMPORTANT: These tests are DESIGNED TO FAIL until rate limiting is implemented
 *
 * Expected Implementation:
 * - 5 failed login attempts per 15 minutes per IP
 * - Rate limit headers in all responses
 * - Rate limit reset after time window
 * - Successful auth resets failure count
 * - Test environment bypass mechanism
 *
 * Phase 1, Day 3: Rate Limiting Implementation
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  createTestUser,
  cleanupTestUser,
  createUserData,
  sleep,
  expectRateLimitHeaders,
  expectRateLimitExceeded,
  resetRateLimitStore,
} from '../config/test-helpers.mjs';

describe('Rate Limiting System', () => {
  let testUser;

  beforeAll(async () => {
    // Create test user for authentication tests
    testUser = await createTestUser({
      username: 'ratelimituser',
      email: 'ratelimit@example.com',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestUser(testUser?.id);
    await prisma.$disconnect();
  });

  // Reset rate limits before each test to prevent interference
  beforeEach(async () => {
    await resetRateLimitStore();
  });

  describe('Login Rate Limiting (Brute Force Protection)', () => {
    it('should_allow_up_to_5_failed_login_attempts', async () => {
      // Attempt 1-5: Should be allowed but fail authentication
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          });

        // Should fail authentication (401) but NOT rate limit (429)
        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('Invalid'),
        });

        // Should include rate limit headers
        expectRateLimitHeaders(response);
        expect(response.headers['ratelimit-remaining']).toBe(String(5 - i));
      }
    });

    it('should_block_6th_failed_login_attempt_with_429', async () => {
      // First 5 attempts (exhaust limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          });
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expectRateLimitExceeded(response);
      expect(response.body.retryAfter).toBeGreaterThan(0);
    });

    it('should_reset_rate_limit_after_successful_authentication', async () => {
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // Successful login should reset counter
      const successResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.plainPassword,
        })
        .expect(200);

      expect(successResponse.body.status).toBe('success');

      // Should be able to attempt again (counter reset)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          });

        expect(response.status).toBe(401); // Not 429
      }
    });

    it('should_include_retry_after_in_rate_limit_response', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('retryAfter');
      expect(response.body.retryAfter).toBeGreaterThan(0);
      expect(response.body.retryAfter).toBeLessThanOrEqual(900); // 15 minutes max
    });

    it('should_track_rate_limits_per_ip_address', async () => {
      // Exhaust rate limit from IP 1
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '192.168.1.1')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          });
      }

      // IP 1 should be blocked
      const ip1Response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(ip1Response.status).toBe(429);

      // IP 2 should still be allowed
      const ip2Response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.2')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(ip2Response.status).toBe(401); // Auth fail, not rate limit
    });
  });

  describe('Registration Rate Limiting', () => {
    it('should_rate_limit_registration_attempts', async () => {
      const baseData = createUserData();

      // First 5 registrations should succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...baseData,
            email: `reg_${i}_${Date.now()}@example.com`,
            username: `reguser_${i}_${Date.now()}`,
          });

        expect(response.status).toBe(201);
      }

      // 6th registration should be rate limited
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...baseData,
          email: `reg_6_${Date.now()}@example.com`,
          username: `reguser_6_${Date.now()}`,
        });

      expectRateLimitExceeded(response);
    });

    it('should_include_rate_limit_headers_on_registration', async () => {
      const userData = createUserData();

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expectRateLimitHeaders(response);
      expect(response.headers['ratelimit-limit']).toBe('5');
    });
  });

  describe('Token Refresh Rate Limiting', () => {
    let refreshToken;

    beforeAll(async () => {
      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.plainPassword,
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      refreshToken = cookies.find(c => c.startsWith('refreshToken='));
    });

    it('should_rate_limit_token_refresh_attempts', async () => {
      // First 5 refresh attempts should succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/refresh-token')
          .set('Cookie', [refreshToken]);

        expect(response.status).toBe(200);
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', [refreshToken]);

      expectRateLimitExceeded(response);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should_include_standard_rate_limit_headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      // Standard rate limit headers (RFC draft)
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');

      // Should NOT include legacy X-RateLimit-* headers
      expect(response.headers).not.toHaveProperty('x-ratelimit-limit');
      expect(response.headers).not.toHaveProperty('x-ratelimit-remaining');
    });

    it('should_update_ratelimit_remaining_with_each_request', async () => {
      const responses = [];

      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          });

        responses.push(response);
      }

      // Remaining should decrease
      expect(parseInt(responses[0].headers['ratelimit-remaining'])).toBeGreaterThan(
        parseInt(responses[1].headers['ratelimit-remaining'])
      );
      expect(parseInt(responses[1].headers['ratelimit-remaining'])).toBeGreaterThan(
        parseInt(responses[2].headers['ratelimit-remaining'])
      );
    });

    it('should_provide_accurate_reset_timestamp', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      const resetTimestamp = parseInt(response.headers['ratelimit-reset']);
      const now = Math.floor(Date.now() / 1000);

      // Reset should be in the future
      expect(resetTimestamp).toBeGreaterThan(now);

      // Reset should be within 15 minutes
      expect(resetTimestamp).toBeLessThanOrEqual(now + 900);
    });
  });

  describe('Rate Limit Reset Mechanism', () => {
    it('should_reset_rate_limit_after_time_window', async () => {
      // This test requires waiting for the rate limit window to reset
      // In test environment, window is 2 seconds

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          });
      }

      // Should be blocked
      const blockedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(blockedResponse.status).toBe(429);

      // Wait for window to reset (in test env, should be shorter)
      // TODO: Configure test window to 1 second for faster tests
      await sleep(2000); // 2 seconds

      // Should be allowed again
      const allowedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(allowedResponse.status).toBe(401); // Auth fail, not rate limit
    }, 30000);
  });

  describe('Concurrent Request Handling', () => {
    it('should_handle_concurrent_requests_correctly', async () => {
      // Send 10 concurrent requests
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: testUser.email,
              password: 'WrongPassword123!',
            })
        );

      const responses = await Promise.all(promises);

      // First 5 should succeed (401 auth failure)
      const authFailures = responses.filter(r => r.status === 401);
      expect(authFailures.length).toBe(5);

      // Remaining 5 should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should_handle_missing_ip_address_gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      // Should still apply rate limiting (default IP)
      expect(response.status).toBeOneOf([401, 429]);
      expectRateLimitHeaders(response);
    });

    it('should_handle_malformed_requests_with_rate_limiting', async () => {
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            // Missing password
            email: testUser.email,
          });

        if (i < 5) {
          expect(response.status).toBe(400); // Validation error
        } else {
          expect(response.status).toBe(429); // Rate limited
        }
      }
    });

    it('should_not_leak_user_existence_through_rate_limiting', async () => {
      // Rate limit for non-existent user
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'WrongPassword123!',
          });

        if (i < 5) {
          expect(response.status).toBe(401);
          expect(response.body.message).not.toContain('user not found');
          expect(response.body.message).toContain('Invalid credentials');
        } else {
          expect(response.status).toBe(429);
        }
      }
    });
  });

  describe('Test Environment Configuration', () => {
    it('should_respect_test_environment_rate_limit_config', () => {
      // This test verifies that test environment can bypass or modify rate limits
      expect(process.env.NODE_ENV).toBe('test');

      // In test environment, rate limits should be configurable
      // Either disabled or set to very high values
      const testConfig = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000,
      };

      // Test environment should have lenient limits
      expect(testConfig.max).toBeGreaterThan(100);
    });
  });
});

/**
 * Custom Jest Matcher Extension
 */
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected}`
          : `expected ${received} to be one of ${expected}`,
    };
  },
});
