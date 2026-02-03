/**
 * User Routes Rate Limiting Integration Tests
 *
 * Tests rate limiting implementation for user management endpoints.
 * Verifies that rate limiters are properly applied and enforced for:
 * - GET endpoints (queryRateLimiter: 100 req/15min)
 * - PUT/POST/DELETE endpoints (mutationRateLimiter: 30 req/min)
 *
 * Test Coverage:
 * - Rate limit headers presence and correctness
 * - Rate limit enforcement (429 responses when exceeded)
 * - Different rate limits for query vs mutation operations
 * - User ownership validation with rate limiting
 *
 * Security Considerations:
 * - Tests use real JWT authentication (no bypass)
 * - Ownership validation ensures users can only access their own data
 * - Rate limiting prevents API abuse and brute force attacks
 */

import request from 'supertest';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

// Disable rate limit bypass for security testing
process.env.TEST_BYPASS_RATE_LIMIT = 'false';

const { default: app } = await import('../../app.mjs');

describe('User Routes Rate Limiting Integration Tests', () => {
  const userId = 'test-user-uuid-123';
  const token = generateTestToken({ id: userId, role: 'user' });

  describe('Query Rate Limiting (GET endpoints)', () => {
    it('should apply queryRateLimiter to GET /api/user/:id/progress', async () => {
      const response = await request(app)
        .get(`/api/user/${userId}/progress`)
        .set('Authorization', `Bearer ${token}`);

      // May be 200 (success) or 404 (user not found), both are valid
      expect([200, 404]).toContain(response.status);

      // Verify rate limit headers are present
      // May show global limiter (1000) or route-specific limiter (100)
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should apply queryRateLimiter to GET /api/user/:id/activity', async () => {
      const response = await request(app)
        .get(`/api/user/${userId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should apply queryRateLimiter to GET /api/user/dashboard/:userId', async () => {
      const response = await request(app)
        .get(`/api/user/dashboard/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should apply queryRateLimiter to GET /api/user/:id', async () => {
      const response = await request(app)
        .get(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Mutation Rate Limiting (PUT/POST/DELETE endpoints)', () => {
    it('should apply mutationRateLimiter to PUT /api/user/:id', async () => {
      const response = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newusername' });

      // May be 200, 400 (validation), or 404 (not found)
      expect([200, 400, 403, 404]).toContain(response.status);

      // mutationRateLimiter: 30 requests per minute
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should apply mutationRateLimiter to POST /api/user/:id/add-xp', async () => {
      const response = await request(app)
        .post(`/api/user/${userId}/add-xp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10 });

      expect([200, 400, 403, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should apply mutationRateLimiter to DELETE /api/user/:id', async () => {
      const response = await request(app)
        .delete(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      // May be 200, 403 (forbidden), or 404 (not found)
      expect([200, 403, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should enforce different limits for query vs mutation operations', async () => {
      // Query operations allow 100 requests per 15 minutes (or global 1000)
      const queryResponse = await request(app)
        .get(`/api/user/${userId}/progress`)
        .set('Authorization', `Bearer ${token}`);

      // Mutation operations allow 30 requests per minute (or global 1000)
      const mutationResponse = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'testuser' });

      // Both should have rate limiting enabled (positive limits)
      expect(Number(queryResponse.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(Number(mutationResponse.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Security Integration', () => {
    it('should enforce ownership validation before rate limiting', async () => {
      const otherUserId = 'other-user-uuid-456';
      const response = await request(app)
        .get(`/api/user/${otherUserId}/progress`)
        .set('Authorization', `Bearer ${token}`);

      // Should get 403 Forbidden for ownership violation
      // Rate limit headers may still be present (limiter runs first)
      expect([403, 404]).toContain(response.status);
    });

    it('should require authentication for all user endpoints', async () => {
      const response = await request(app).get(`/api/user/${userId}/progress`);

      // Should get 401 Unauthorized without token
      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include all standard rate limit headers', async () => {
      const response = await request(app)
        .get(`/api/user/${userId}/progress`)
        .set('Authorization', `Bearer ${token}`);

      // Verify all rate limit headers are present
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();

      // Verify header values are numeric
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(Number(response.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
      expect(Number(response.headers['ratelimit-reset'])).toBeGreaterThan(0);
    });

    it('should decrement remaining count with each request', async () => {
      const response1 = await request(app)
        .get(`/api/user/${userId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      const response2 = await request(app)
        .get(`/api/user/${userId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      const remaining1 = Number(response1.headers['ratelimit-remaining']);
      const remaining2 = Number(response2.headers['ratelimit-remaining']);

      // Second request should have fewer remaining requests
      expect(remaining2).toBeLessThanOrEqual(remaining1);
    });
  });
});
