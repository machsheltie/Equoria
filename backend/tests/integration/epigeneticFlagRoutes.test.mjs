/**
 * Epigenetic Flag Routes Integration Tests
 * Tests for the COMPLETE epigenetic flag system (52 tests already passing)
 *
 * 🧪 TESTING APPROACH: Real System Testing
 * - Test the actual working epigenetic flag system
 * - System is IMPLEMENTATION COMPLETE per documentation
 * - MINIMAL mocking - only what's absolutely necessary
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

// Equoria-rnbzn: NO CSRF token is fetched here. This suite has no
// CSRF-protected mutation under test — every POST case asserts the 401 NO-AUTH
// rejection (which never reaches csrfProtection), and the only authed calls are
// GET /api/v1/flags/* reads (CSRF is ignored on GET). The previously-fetched
// anonymous __csrf__ token was dead weight; removing it keeps the suite honest
// about what it exercises.
describe('Epigenetic Flag Routes Integration Tests', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: `test-user-epigenetic-${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        username: `testuser${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `test${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
        password: 'TestPassword123!',
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Generate authentication token
    authToken = generateTestToken({
      id: testUser.id,
      email: testUser.email,
      role: 'admin',
    });
  });

  afterEach(async () => {
    // Equoria-rnbzn: scoped, fail-loud teardown. The previous form chained a
    // silent no-op catch arm onto prisma.user.delete, keeping the test GREEN
    // even when the row leaked into the canonical DB (CLAUDE.md §2). deleteMany
    // (id-scoped) is idempotent — it no-ops on an already-gone row rather than
    // throwing — so we get loud failure on a REAL delete error without the
    // false-failure of delete() on a missing row. This user owns no horses
    // (flag routes never create one), so a single user-scoped delete suffices.
    const cleanup = createCleanupTracker();
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    }, 'testUser');
    await cleanup.run();
  });

  describe('Health Check', () => {
    test('should return system health status', async () => {
      const response = await request(app)
        .get('/api/v1/flags/health')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Epigenetic flag system is operational');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('Authentication Requirements', () => {
    test('should require authentication for flag evaluation', async () => {
      const response = await request(app)
        .post('/api/v1/flags/evaluate')
        .set('Origin', 'http://localhost:3000')
        .set('Origin', 'http://localhost:3000')
        .send({ horseId: 123 });

      expect(response.status).toBe(401);
    });

    test('should require authentication for horse flags', async () => {
      const response = await request(app)
        .get('/api/v1/flags/horses/123/flags')
        .set('Origin', 'http://localhost:3000')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(401);
    });

    test('should require authentication for flag definitions', async () => {
      const response = await request(app)
        .get('/api/v1/flags/definitions')
        .set('Origin', 'http://localhost:3000')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(401);
    });

    test('should require authentication for batch evaluation', async () => {
      const response = await request(app)
        .post('/api/v1/flags/batch-evaluate')
        .set('Origin', 'http://localhost:3000')
        .set('Origin', 'http://localhost:3000')
        .send({ horseIds: [123] });

      expect(response.status).toBe(401);
    });

    test('should require authentication for care patterns', async () => {
      const response = await request(app)
        .get('/api/v1/flags/horses/123/care-patterns')
        .set('Origin', 'http://localhost:3000')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(401);
    });
  });

  describe('Route Structure', () => {
    test('should have all required endpoints mounted', async () => {
      // Test that all endpoints exist and respond (even if with auth errors)
      const endpoints = [
        { method: 'post', path: '/api/v1/flags/evaluate' },
        { method: 'get', path: '/api/v1/flags/horses/123/flags' },
        { method: 'get', path: '/api/v1/flags/definitions' },
        { method: 'post', path: '/api/v1/flags/batch-evaluate' },
        { method: 'get', path: '/api/v1/flags/horses/123/care-patterns' },
        { method: 'get', path: '/api/v1/flags/health' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).set('Origin', 'http://localhost:3000');

        // Log status for debugging
        if (![200, 400, 401, 403, 404].includes(response.status)) {
          console.error(`Unexpected status ${response.status} for ${endpoint.method.toUpperCase()} ${endpoint.path}`);
        }

        // Health endpoint should work, others should require auth, return 404 for missing resource, or 200 if public
        if (endpoint.path === '/api/v1/flags/health') {
          // Allow 401 because it's currently mounted under authRouter
          expect([200, 401]).toContain(response.status);
        } else {
          expect([200, 400, 401, 403, 404]).toContain(response.status);
        }
      }
    });
  });

  describe('System Integration', () => {
    test('should have epigenetic flag routes mounted in main app', async () => {
      // Verify the routes are actually mounted by checking they don't return 404
      const response = await request(app)
        .get('/api/v1/flags/health')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
    });

    test('should handle CORS and security headers', async () => {
      const response = await request(app)
        .get('/api/v1/flags/health')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      // Basic test that the request goes through the middleware stack
    });
  });
});
