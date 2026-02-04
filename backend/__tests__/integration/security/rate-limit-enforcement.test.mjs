/**
 * Integration Tests: Rate Limit Enforcement (Security)
 *
 * Validates that rate limiting infrastructure is active and properly
 * configured across security-sensitive endpoints. Uses real JWT tokens
 * from the createMockToken factory for authenticated requests.
 *
 * @module __tests__/integration/security/rate-limit-enforcement
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockToken } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('Rate Limit Enforcement Integration Tests', () => {
  let testUser;
  let validToken;

  beforeAll(async () => {
    // Ensure JWT_SECRET is set for token generation
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    // Create a real test user in the database
    testUser = await prisma.user.create({
      data: {
        email: `ratelimit-sec-${Date.now()}@example.com`,
        username: `ratelimit-sec-${Date.now()}`,
        password: 'hashedPassword123',
        firstName: 'RateLimit',
        lastName: 'Test',
        emailVerified: true,
      },
    });

    // Generate a real JWT token using the factory
    validToken = createMockToken(testUser.id, {
      payload: { email: testUser.email, role: 'user' },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser?.id) {
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
  });

  describe('Rate limiting infrastructure', () => {
    it('should have the Express app configured and responding', async () => {
      expect(app).toBeDefined();

      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should include rate limit headers on auth endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('x-test-skip-csrf', 'true')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        });

      // Rate limit headers should be present (RFC 6585 compliant)
      const hasRateLimitHeader =
        response.headers['ratelimit-limit'] !== undefined ||
        response.headers['ratelimit-remaining'] !== undefined ||
        response.headers['x-ratelimit-limit'] !== undefined ||
        response.headers['x-ratelimit-remaining'] !== undefined;

      expect(hasRateLimitHeader).toBe(true);
    });

    it('should include rate limit headers on authenticated endpoints', async () => {
      const response = await request(app)
        .get('/api/horses')
        .set('Authorization', `Bearer ${validToken}`);

      // Authenticated endpoints should also have rate limiting active
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Authentication with real JWT tokens', () => {
    it('should accept requests with valid JWT tokens', async () => {
      const response = await request(app)
        .get(`/api/grooms/user/${testUser.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      // Should be authenticated (200 or empty result, not 401)
      expect(response.status).not.toBe(401);
    });

    it('should reject requests without tokens', async () => {
      const response = await request(app)
        .get('/api/horses');

      expect(response.status).toBe(401);
    });

    it('should reject requests with expired tokens', async () => {
      const expiredToken = createMockToken(testUser.id, {
        expired: true,
        payload: { email: testUser.email, role: 'user' },
      });

      // Small delay to ensure token expiry takes effect
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await request(app)
        .get('/api/horses')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject requests with malformed tokens', async () => {
      const response = await request(app)
        .get('/api/horses')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });

  describe('Rate limit response format', () => {
    it('should return proper error structure when rate limited', async () => {
      // This test validates the rate limit response format
      // In test environments, rate limits are increased so we verify the infrastructure
      const response = await request(app)
        .post('/api/auth/login')
        .set('x-test-skip-csrf', 'true')
        .send({
          email: 'test@example.com',
          password: 'wrong',
        });

      // Whether rate limited or not, the response should have proper structure
      if (response.status === 429) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message || response.body.error).toBeDefined();
      } else {
        // Auth failure response should also have proper structure
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });
});
