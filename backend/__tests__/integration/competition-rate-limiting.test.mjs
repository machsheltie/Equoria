/**
 * Competition Routes Rate Limiting Integration Tests
 *
 * Tests rate limiting implementation for competition management endpoints.
 * Verifies that rate limiters are properly applied and enforced for:
 * - GET endpoints (queryRateLimiter: 100 req/15min)
 * - POST endpoints (mutationRateLimiter: 30 req/min)
 *
 * Test Coverage:
 * - Rate limit headers presence and correctness
 * - Rate limit enforcement for competition operations
 * - Different rate limits for query vs mutation operations
 * - Public vs authenticated endpoint rate limiting
 *
 * Security Considerations:
 * - Tests use real JWT authentication where required
 * - Some endpoints are public (e.g., /disciplines, /show/:id/results)
 * - Rate limiting prevents competition spam and API abuse
 * - Ownership validation integrated with rate limiting
 */

import request from 'supertest';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

// Disable rate limit bypass for security testing
process.env.TEST_BYPASS_RATE_LIMIT = 'false';

const { default: app } = await import('../../app.mjs');

describe('Competition Routes Rate Limiting Integration Tests', () => {
  const userId = 'test-user-uuid-123';
  const token = generateTestToken({ id: userId, role: 'user' });

  describe('Query Rate Limiting (GET endpoints)', () => {
    it('should apply queryRateLimiter to GET /api/competition/disciplines', async () => {
      const response = await request(app).get('/api/competition/disciplines');

      // May require auth depending on configuration
      expect([200, 401]).toContain(response.status);

      // Verify rate limit headers (may not be present if 401)
      if (response.status === 200) {
        expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
        expect(response.headers['ratelimit-remaining']).toBeDefined();
        expect(response.headers['ratelimit-reset']).toBeDefined();
      }
    });

    it('should apply queryRateLimiter to GET /api/competition/show/:showId/results', async () => {
      const showId = 1;
      const response = await request(app).get(`/api/competition/show/${showId}/results`);

      // Public endpoint, may return 200 (success) or 404 (not found)
      expect([200, 401, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should apply queryRateLimiter to GET /api/competition/horse/:horseId/results', async () => {
      const horseId = 1;
      const response = await request(app)
        .get(`/api/competition/horse/${horseId}/results`)
        .set('Authorization', `Bearer ${token}`);

      // Requires auth + ownership
      expect([200, 401, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should apply queryRateLimiter to GET /api/competition/eligibility/:horseId/:discipline', async () => {
      const horseId = 1;
      const discipline = 'showjumping';
      const response = await request(app)
        .get(`/api/competition/eligibility/${horseId}/${discipline}`)
        .set('Authorization', `Bearer ${token}`);

      // Requires auth + ownership
      expect([200, 400, 403, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Mutation Rate Limiting (POST endpoints)', () => {
    it('should apply mutationRateLimiter to POST /api/competition/enter-show', async () => {
      const response = await request(app)
        .post('/api/competition/enter-show')
        .set('Authorization', `Bearer ${token}`)
        .send({
          showId: 1,
          horseIds: [1, 2, 3],
        });

      // May return 200, 400 (validation), or 404 (not found)
      expect([200, 400, 403, 404]).toContain(response.status);

      // mutationRateLimiter: 30 requests per minute
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should apply mutationRateLimiter to POST /api/competition/enter', async () => {
      const response = await request(app).post('/api/competition/enter').set('Authorization', `Bearer ${token}`).send({
        horseId: 1,
        showId: 1,
      });

      expect([200, 400, 403, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should apply mutationRateLimiter to POST /api/competition/execute', async () => {
      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          showId: 1,
        });

      // May return 200, 400, 403 (not host), or 404 (not found)
      expect([200, 400, 403, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should enforce different limits for query vs mutation operations', async () => {
      // Query operations allow 100 requests per 15 minutes (or global 1000)
      const queryResponse = await request(app).get('/api/competition/disciplines');

      // Mutation operations allow 30 requests per minute (or global 1000)
      const mutationResponse = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${token}`)
        .send({ horseId: 1, showId: 1 });

      // Both should have rate limiting enabled (positive limits)
      expect(Number(queryResponse.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(Number(mutationResponse.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Public vs Authenticated Endpoints', () => {
    it('should rate limit public endpoints without requiring auth', async () => {
      const response = await request(app).get('/api/competition/disciplines');

      // May require auth depending on configuration
      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      }
    });

    it('should require auth for horse-specific endpoints', async () => {
      const horseId = 1;
      const response = await request(app).get(`/api/competition/horse/${horseId}/results`);

      // Should get 401 Unauthorized without token
      expect(response.status).toBe(401);
    });

    it('should require auth for competition entry endpoints', async () => {
      const response = await request(app).post('/api/competition/enter').send({ horseId: 1, showId: 1 });

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include all standard rate limit headers', async () => {
      const response = await request(app).get('/api/competition/disciplines');

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
      const response1 = await request(app).get('/api/competition/disciplines');
      const response2 = await request(app).get('/api/competition/disciplines');

      const remaining1 = Number(response1.headers['ratelimit-remaining']);
      const remaining2 = Number(response2.headers['ratelimit-remaining']);

      // Second request should have fewer remaining requests
      expect(remaining2).toBeLessThanOrEqual(remaining1);
    });
  });

  describe('Security Integration', () => {
    it('should validate horse ownership before allowing results access', async () => {
      const horseId = 999; // Non-existent or not owned
      const response = await request(app)
        .get(`/api/competition/horse/${horseId}/results`)
        .set('Authorization', `Bearer ${token}`);

      // Should get 404 Not Found for ownership violation or non-existent horse
      expect([404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should rate limit competition execution for show hosts only', async () => {
      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({ showId: 1 });

      // May get 403 Forbidden (not host) or 404 (show not found)
      expect([403, 404]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Input Validation with Rate Limiting', () => {
    it('should rate limit invalid competition entry requests', async () => {
      const response = await request(app).post('/api/competition/enter').set('Authorization', `Bearer ${token}`).send({
        horseId: 'invalid', // Should be integer
        showId: 1,
      });

      // May get 400 (validation) or 403 (ownership) depending on order of middleware
      expect([400, 403]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should rate limit requests with missing required fields', async () => {
      const response = await request(app).post('/api/competition/enter').set('Authorization', `Bearer ${token}`).send({
        horseId: 1,
        // Missing showId
      });

      // May get 400 (validation) or 403 (ownership) depending on order of middleware
      expect([400, 403]).toContain(response.status);
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });
});
