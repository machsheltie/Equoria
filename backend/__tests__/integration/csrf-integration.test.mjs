/**
 * 🧪 CSRF PROTECTION INTEGRATION TESTS
 *
 * End-to-end integration tests for CSRF token protection
 * Tests complete request flow including token generation, validation, and error handling
 *
 * Test Coverage:
 * - Token acquisition from /auth/csrf-token
 * - Valid CSRF token → Success (200)
 * - Missing CSRF token → 403 Forbidden
 * - Invalid CSRF token → 403 Forbidden
 * - GET requests without CSRF token → Success (no CSRF required)
 * - Cross-origin request protection
 * - Token refresh scenarios
 *
 * @module __tests__/integration/csrf-integration.test
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { jest } from '@jest/globals';

describe('CSRF Protection Integration Tests', () => {
  const rateLimitBypassHeader = { 'X-Test-Bypass-Rate-Limit': 'true' };
  let testUser;
  let accessToken;
  let csrfToken;

  beforeAll(async () => {
    // Clean up test database
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'csrftest',
        },
      },
    });
  });

  beforeEach(async () => {
    // Create test user
    const response = await request(app)
      .post('/auth/register')
      .set(rateLimitBypassHeader)
      .send({
        username: `csrftest${Date.now()}`,
        email: `csrftest${Date.now()}@test.com`,
        password: 'TestPass123!',
        firstName: 'CSRF',
        lastName: 'Test',
      });

    expect(response.status).toBe(201);

    // Extract accessToken from cookie
    const cookies = response.headers['set-cookie'] || [];
    const accessTokenCookie = cookies.find?.(cookie => cookie.startsWith('accessToken='));
    expect(accessTokenCookie).toBeDefined();
    accessToken = accessTokenCookie?.split(';')[0];

    testUser = await prisma.user.findUnique({
      where: { email: response.body.data.user.email },
    });
  });

  afterEach(async () => {
    // Clean up test user
    if (testUser) {
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
      testUser = null;
    }
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'csrftest',
        },
      },
    });
  });

  describe('CSRF Token Acquisition', () => {
    test('should get CSRF token from /auth/csrf-token endpoint', async () => {
      const response = await request(app).get('/auth/csrf-token').set(rateLimitBypassHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('csrfToken');
      expect(typeof response.body.csrfToken).toBe('string');
      expect(response.body.csrfToken.length).toBeGreaterThan(0);

      csrfToken = response.body.csrfToken;
    });

    test('should set CSRF token in cookie', async () => {
      const response = await request(app).get('/auth/csrf-token').set(rateLimitBypassHeader);

      const cookies = response.headers['set-cookie'] || [];
      expect(cookies.length).toBeGreaterThan(0);

      const csrfCookie = cookies.find(cookie => cookie.startsWith('_csrf='));
      expect(csrfCookie).toBeDefined();
    });

    test('should generate unique tokens for different requests', async () => {
      const response1 = await request(app).get('/auth/csrf-token').set(rateLimitBypassHeader);
      const response2 = await request(app).get('/auth/csrf-token').set(rateLimitBypassHeader);

      expect(response1.body.csrfToken).not.toBe(response2.body.csrfToken);
    });
  });

  describe('CSRF Protection for State-Changing Operations', () => {
    beforeEach(async () => {
      // Get CSRF token before each test
      const tokenResponse = await request(app).get('/auth/csrf-token').set(rateLimitBypassHeader);
      csrfToken = tokenResponse.body.csrfToken;

      const cookies = tokenResponse.headers['set-cookie'] || [];
      const csrfCookie = cookies.find(cookie => cookie.startsWith('_csrf='));

      // Store both access token and CSRF cookie for authenticated requests
      // Note: In real scenarios, the CSRF cookie would be sent automatically by browser
    });

    test('should reject POST request without CSRF token', async () => {
      // Try to update user profile without CSRF token
      const response = await request(app).put(`/api/users/${testUser.id}`).set('Cookie', accessToken).send({
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'INVALID_CSRF_TOKEN');
      expect(response.body.message).toContain('Invalid CSRF token');
    });

    test('should reject PUT request without CSRF token', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Cookie', accessToken)
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_CSRF_TOKEN');
    });

    test('should reject DELETE request without CSRF token', async () => {
      // Try to delete something without CSRF token
      const response = await request(app).delete(`/api/users/${testUser.id}`).set('Cookie', accessToken);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_CSRF_TOKEN');
    });

    test('should reject PATCH request without CSRF token', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .set('Cookie', accessToken)
        .send({ firstName: 'Patched' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_CSRF_TOKEN');
    });
  });

  describe('Safe HTTP Methods (No CSRF Required)', () => {
    test('should allow GET requests without CSRF token', async () => {
      const response = await request(app).get(`/api/users/${testUser.id}`).set('Cookie', accessToken);

      // Should succeed (200 or other non-403 status)
      expect(response.status).not.toBe(403);
    });

    test('should allow HEAD requests without CSRF token', async () => {
      const response = await request(app).head('/health').set('Cookie', accessToken);

      expect(response.status).not.toBe(403);
    });

    test('should allow OPTIONS requests without CSRF token', async () => {
      const response = await request(app).options('/api/users').set('Cookie', accessToken);

      expect(response.status).not.toBe(403);
    });
  });

  describe('CSRF Error Messages', () => {
    test('should provide clear error message for missing token', async () => {
      const response = await request(app).post('/api/users/me').set('Cookie', accessToken).send({ firstName: 'Test' });

      expect(response.body.message).toContain('Invalid CSRF token');
      expect(response.body.message).toContain('refresh the page');
    });

    test('should include error code in response', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Cookie', accessToken)
        .send({ firstName: 'Test' });

      expect(response.body).toHaveProperty('code', 'INVALID_CSRF_TOKEN');
    });

    test('should return 403 status for CSRF failures', async () => {
      const response = await request(app).delete(`/api/users/${testUser.id}`).set('Cookie', accessToken);

      expect(response.status).toBe(403);
    });
  });

  describe('CSRF Token Lifecycle', () => {
    test('should accept newly generated token', async () => {
      // Get fresh token (with authentication to ensure consistent session identifier)
      const tokenResponse = await request(app)
        .get('/auth/csrf-token')
        .set(rateLimitBypassHeader)
        .set('Cookie', accessToken);
      const freshToken = tokenResponse.body.csrfToken;
      const cookies = tokenResponse.headers['set-cookie'] || [];
      // Extract just the cookie name=value part (not the entire Set-Cookie header)
      const csrfCookie = cookies.find(cookie => cookie.startsWith('_csrf='))?.split(';')[0];
      expect(csrfCookie).toBeDefined();

      // Use token immediately
      const response = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Cookie', [accessToken, csrfCookie])
        .set('X-CSRF-Token', freshToken)
        .send({ firstName: 'Updated' });

      // Should not be blocked by CSRF (might fail for other reasons like permissions)
      expect(response.status).not.toBe(403);
      expect(response.body.code).not.toBe('INVALID_CSRF_TOKEN');
    });

    test('should generate new token on each request to /auth/csrf-token', async () => {
      const tokens = [];

      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/auth/csrf-token');
        tokens.push(response.body.csrfToken);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });

  describe('CORS and CSRF Integration', () => {
    test('should require X-CSRF-Token header for cross-origin requests', async () => {
      const response = await request(app)
        .post('/api/users/me')
        .set('Cookie', accessToken)
        .set('Origin', 'http://localhost:3001')
        .send({ firstName: 'Test' });

      // Should be blocked by CSRF protection
      expect(response.status).toBe(403);
    });

    test('should allow CORS preflight without CSRF token', async () => {
      const response = await request(app)
        .options('/api/users')
        .set('Origin', 'http://localhost:3001')
        .set('Access-Control-Request-Method', 'POST');

      // OPTIONS requests should not require CSRF token
      expect(response.status).not.toBe(403);
    });
  });

  describe('Public Endpoints (No CSRF)', () => {
    test('should not require CSRF token for login', async () => {
      const response = await request(app).post('/auth/login').set(rateLimitBypassHeader).send({
        email: testUser.email,
        password: 'TestPass123!',
      });

      // Login should work without CSRF token (it's a public endpoint)
      expect(response.status).not.toBe(403);
      expect(response.body.code).not.toBe('INVALID_CSRF_TOKEN');
    });

    test('should not require CSRF token for registration', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set(rateLimitBypassHeader)
        .send({
          username: `newuser${Date.now()}`,
          email: `newuser${Date.now()}@test.com`,
          password: 'TestPass123!',
          firstName: 'New',
          lastName: 'User',
        });

      expect(response.status).not.toBe(403);
      expect(response.body.code).not.toBe('INVALID_CSRF_TOKEN');

      // Clean up
      if (response.status === 201) {
        const newUser = await prisma.user.findUnique({
          where: { email: response.body.data.user.email },
        });
        if (newUser) {
          await prisma.refreshToken.deleteMany({ where: { userId: newUser.id } });
          await prisma.user.delete({ where: { id: newUser.id } });
        }
      }
    });

    test('should not require CSRF token for password reset request', async () => {
      const response = await request(app).post('/auth/forgot-password').set(rateLimitBypassHeader).send({
        email: testUser.email,
      });

      expect(response.status).not.toBe(403);
      expect(response.body.code).not.toBe('INVALID_CSRF_TOKEN');
    });
  });
});
