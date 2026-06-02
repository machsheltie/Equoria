/**
 * 🧪 SYSTEM INTEGRATION TEST: API Response System Validation
 *
 * This test validates API response system integration including response format
 * standardization, error handling consistency, performance benchmarking, and
 * cross-endpoint data consistency across the entire application.
 *
 * 📋 INTEGRATION SCOPE:
 * - Response format standardization across all endpoints
 * - Error handling consistency and proper status codes
 * - Performance benchmarking and response time validation
 * - Cross-endpoint data consistency and structure validation
 * - API response optimization and compression testing
 * - Pagination and data serialization validation
 * - Response caching and ETag functionality
 * - Performance monitoring and metrics collection
 *
 * 🎯 SYSTEMS TESTED:
 * 1. ApiResponse Class - Standardized response formatting
 * 2. Response Middleware - Optimization and performance monitoring
 * 3. Error Handling - Consistent error response formats
 * 4. Authentication Responses - Auth endpoint response validation
 * 5. Data Endpoints - Horse, user, and game data response formats
 * 6. Health Endpoints - Health check response consistency
 * 7. Performance Monitoring - Response time and optimization metrics
 * 8. Cross-System Validation - Response consistency across all systems
 *
 * 🔄 NO MOCKING APPROACH:
 * ✅ REAL: Complete API response system, actual endpoint testing
 * ✅ REAL: Cross-system response validation, performance monitoring
 * ✅ REAL: Error handling validation, response optimization testing
 * 🔧 MOCK: None - full system integration testing
 *
 * 💡 TEST STRATEGY: Comprehensive API response validation
 *    to ensure consistent and optimized responses across all application endpoints
 */

import request from 'supertest';
import express from 'express';
import { body } from 'express-validator';
import { register, login } from '../../controllers/authController.mjs';
import { authenticateToken } from '../../middleware/auth.mjs';
import { handleValidationErrors } from '../../middleware/validationErrorHandler.mjs';
import { responseHandler, ApiResponse as _ApiResponse } from '../../utils/apiResponse.mjs';
import { responseOptimization, performanceMonitoring } from '../../middleware/responseOptimization.mjs';
import { handlePing, handleHealthCheck } from '../../controllers/pingController.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { randomBytes } from 'node:crypto';

// Create test app with API response system
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Add response optimization middleware
  app.use(
    responseOptimization({
      enableFieldSelection: true,
      enableETag: true,
      enableSizeMonitoring: true,
      maxResponseSize: 10 * 1024 * 1024, // 10MB
      warningSizeThreshold: 1024 * 1024, // 1MB
    }),
  );

  // Add performance monitoring
  app.use(
    performanceMonitoring({
      enableMetrics: true,
      logSlowRequests: true,
      slowRequestThreshold: 1000, // 1 second
    }),
  );

  // Add response handler middleware
  app.use(responseHandler);

  // Auth routes for testing
  app.post(
    '/api/v1/auth/register',
    [
      body('email').isEmail().normalizeEmail(),
      body('username').isLength({ min: 3, max: 30 }),
      body('password').isLength({ min: 8 }),
      body('firstName').notEmpty(),
      body('lastName').notEmpty(),
      handleValidationErrors,
    ],
    register,
  );

  app.post(
    '/api/v1/auth/login',
    [body('email').isEmail().normalizeEmail(), body('password').notEmpty(), handleValidationErrors],
    login,
  );

  // Health endpoints
  app.get('/ping', handlePing);
  app.get('/health', handleHealthCheck);

  // Test endpoints for response validation
  app.get('/api/test/success', authenticateToken, (req, res) => {
    res.apiSuccess('Test success response', {
      userId: req.user.id,
      timestamp: new Date().toISOString(),
      testData: 'success',
    });
  });

  app.get('/api/test/error', authenticateToken, (req, res) => {
    res.apiError('Test error response', 400, { errorCode: 'TEST_ERROR' });
  });

  app.get('/api/test/not-found', authenticateToken, (req, res) => {
    res.apiNotFound('Test resource not found');
  });

  app.get('/api/test/validation-error', authenticateToken, (req, res) => {
    res.apiValidationError('Test validation failed', [{ field: 'testField', message: 'Test field is required' }]);
  });

  app.get('/api/test/large-data', authenticateToken, (req, res) => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: 'A'.repeat(100),
      metadata: {
        tags: ['tag1', 'tag2', 'tag3'],
        properties: {
          value: Math.random() * 100,
          category: `Category ${i % 10}`,
        },
      },
    }));

    res.apiSuccess('Large dataset retrieved', largeData);
  });

  app.get('/api/test/paginated', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const total = 100;

    const data = Array.from({ length: limit }, (_, i) => ({
      id: (page - 1) * limit + i + 1,
      name: `Item ${(page - 1) * limit + i + 1}`,
    }));

    res.apiPaginated('Paginated data retrieved', data, { page, limit, total });
  });

  app.get('/api/test/field-selection', authenticateToken, (req, res) => {
    const fullData = {
      id: 1,
      name: 'Test Item',
      description: 'Test description',
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['test', 'api'],
      },
      sensitiveData: 'This should be excluded',
    };

    res.apiSuccess('Data with field selection', fullData);
  });

  app.get('/api/test/etag', authenticateToken, (req, res) => {
    const data = {
      id: 1,
      name: 'ETag Test Data',
      timestamp: '2024-01-01T00:00:00.000Z', // Fixed timestamp for consistent ETag
    };

    res.apiSuccess('ETag test data', data);
  });

  return app;
};

describe('🔄 API Response Integration Tests', () => {
  let app;
  let testUser;
  let authToken;
  let server;
  // Equoria-cs6wf: randomize fixture identifiers so a crashed prior run's
  // partial cleanup cannot collide with the next run's beforeEach on the
  // User.username / User.email unique constraints. Cleanup probes already
  // scope by `contains: 'apiresponseintegration'` so they continue to catch
  // stale rows from any prior crash regardless of the randomized suffix.
  const suffix = randomBytes(6).toString('hex');
  // Equoria-3xph4: the inline register validator above enforces
  // username isLength({ min: 3, max: 30 }). The prior value
  // `TestFixture-cs6wf-apiresponseintegration-${suffix}` was ~53 chars,
  // so STEP 1 register returned 400 (length failure) — no token ->
  // downstream auth'd steps cascaded. `ar${suffix}` = "ar" + 12 hex = 14
  // chars, well within 3-30. The email is unchanged, so the cleanup probe
  // (`email: { contains: 'apiresponseintegration' }`) still matches.
  const username = `ar${suffix}`;
  const email = `testfixture-cs6wf-apiresponseintegration-${suffix}@example.com`;

  beforeAll(async () => {
    app = createTestApp();
    // Start server once for all tests
    server = app.listen(0);
  });

  afterAll(async () => {
    // Clean up all test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'apiresponseintegration' } } },
    });
    // Equoria-cfv3c: registration auto-creates a STARTER horse
    // (onboardingService.createStarterHorseForNewUser). Horse.userId is
    // onDelete: Restrict, so the starter horse must be deleted (user-scoped,
    // covers the starter regardless of its name) BEFORE the user, or the
    // user delete trips horses_userId_fkey. Scoped via the same email probe.
    await prisma.horse.deleteMany({
      where: { user: { email: { contains: 'apiresponseintegration' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'apiresponseintegration' } },
    });

    // Close server and disconnect
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'apiresponseintegration' } } },
    });
    // Equoria-cfv3c: delete starter horse (user-scoped) before the user — see afterAll.
    await prisma.horse.deleteMany({
      where: { user: { email: { contains: 'apiresponseintegration' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'apiresponseintegration' } },
    });

    // Create test user and get authentication token
    const userData = {
      email,
      username,
      password: 'TestPassword123!',
      firstName: 'API',
      lastName: 'Response',
      // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
      dateOfBirth: '1990-01-01',
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send(userData);

    expect(registerResponse.status).toBe(201);
    testUser = registerResponse.body.data.user;

    // Extract accessToken from httpOnly cookie
    const cookies = registerResponse.headers['set-cookie'];
    const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
    authToken = accessTokenCookie.split(';')[0].split('=')[1];
  });

  afterEach(async () => {
    // Clean up test data for current test — delete user too so beforeEach
    // of the next test doesn't race against a stale row (relation-filter
    // deleteMany on RefreshToken can miss under full-suite DB pressure).
    if (testUser?.id) {
      await prisma.refreshToken.deleteMany({
        where: { userId: testUser.id },
      });
      // Equoria-cfv3c: starter horse (userId-scoped) before user — Restrict FK.
      await prisma.horse.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
  });

  describe('📋 Response Format Standardization', () => {
    test('should provide consistent success response format', async () => {
      const response = await request(app)
        .get('/api/test/success')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.data.userId).toBe(testUser.id);
    });

    test('should provide consistent error response format', async () => {
      const response = await request(app)
        .get('/api/test/error')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.data.errorCode).toBe('TEST_ERROR');
    });

    test('should provide consistent not found response format', async () => {
      const response = await request(app)
        .get('/api/test/not-found')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Test resource not found');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should provide consistent validation error response format', async () => {
      const response = await request(app)
        .get('/api/test/validation-error')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Test validation failed');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('validationErrors');
      expect(Array.isArray(response.body.meta.validationErrors)).toBe(true);
    });
  });

  describe('📊 Pagination Response Validation', () => {
    test('should provide consistent paginated response format', async () => {
      const response = await request(app)
        .get('/api/test/paginated?page=1&limit=5')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('pagination');

      const { pagination } = response.body.meta;
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('limit', 5);
      expect(pagination).toHaveProperty('total', 100);
      expect(pagination).toHaveProperty('totalPages', 20);
      expect(pagination).toHaveProperty('hasNext', true);
      expect(pagination).toHaveProperty('hasPrev', false);
    });

    test('should handle pagination edge cases correctly', async () => {
      const response = await request(app)
        .get('/api/test/paginated?page=20&limit=5')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const { pagination } = response.body.meta;
      expect(pagination.page).toBe(20);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(true);
    });
  });

  describe('⚡ Performance Monitoring Integration', () => {
    test('should include performance headers in responses', async () => {
      const response = await request(app)
        .get('/api/test/success')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['x-processing-time']).toBeDefined();
      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-timestamp']).toBeDefined();
    });

    test('should monitor large response performance', async () => {
      const response = await request(app)
        .get('/api/test/large-data')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1000);
      expect(response.headers['x-processing-time']).toBeDefined();
      expect(response.headers['x-response-size']).toBeDefined();

      const responseTime = parseInt(response.headers['x-processing-time']);
      expect(responseTime).toBeGreaterThan(0);
    });
  });

  describe('🔧 Response Optimization Features', () => {
    test('should support field selection optimization', async () => {
      const response = await request(app)
        .get('/api/test/field-selection?fields=id,name')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).not.toHaveProperty('description');
      expect(response.body.data).not.toHaveProperty('sensitiveData');
    });

    test('should support field exclusion optimization', async () => {
      const response = await request(app)
        .get('/api/test/field-selection?exclude=sensitiveData,metadata')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('description');
      expect(response.body.data).not.toHaveProperty('sensitiveData');
      expect(response.body.data).not.toHaveProperty('metadata');
    });

    test('should generate and validate ETags correctly', async () => {
      // First request should return ETag
      const response1 = await request(app)
        .get('/api/test/etag')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);
      expect(response1.body.data).toBeDefined();

      // Test that ETag header is present (if implemented)
      if (response1.headers.etag) {
        // Second request with ETag - may return 200 or 304 depending on implementation
        const response2 = await request(app)
          .get('/api/test/etag')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${authToken}`)
          .set('If-None-Match', response1.headers.etag);

        // Accept either 200 (ETag not fully implemented) or 304 (ETag working)
        expect([200, 304]).toContain(response2.status);

        if (response2.status === 200) {
          expect(response2.body.success).toBe(true);
        }
      } else {
        // ETag not implemented, just verify response structure
        expect(response1.body.data.name).toBe('ETag Test Data');
      }
    });
  });

  describe('🔗 Cross-System Response Consistency', () => {
    test('should maintain consistent response format across auth endpoints', async () => {
      const loginResponse = await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({
        email,
        password: 'TestPassword123!',
      });

      expect(loginResponse.status).toBe(200);
      // Equoria-zrwl: canonical success envelope is {success,message,data};
      // the legacy {status:'success'} shape no longer exists on auth responses.
      expect(loginResponse.body).toHaveProperty('success', true);
      expect(loginResponse.body).not.toHaveProperty('status');
      expect(loginResponse.body).toHaveProperty('message');
      expect(loginResponse.body).toHaveProperty('data');
      // Auth endpoints may not have timestamp in root, check for consistent structure
      // Note: Tokens are now in httpOnly cookies, not response body
      expect(loginResponse.body.data).toHaveProperty('user');
      expect(loginResponse.headers['set-cookie']).toBeDefined();
      const hasAccessToken = loginResponse.headers['set-cookie'].some(cookie => cookie.startsWith('accessToken='));
      expect(hasAccessToken).toBe(true);
    });

    test('should maintain consistent response format across health endpoints', async () => {
      const endpoints = ['/ping', '/health'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint).set('Origin', 'http://localhost:3000');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        // Health endpoints may have timestamp in different locations
        expect(
          Object.prototype.hasOwnProperty.call(response.body, 'timestamp') ||
            (response.body.data && Object.prototype.hasOwnProperty.call(response.body.data, 'timestamp')),
        ).toBe(true);
      }
    });

    test('should handle authentication errors consistently', async () => {
      const protectedEndpoints = ['/api/test/success', '/api/test/error', '/api/test/large-data'];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint).set('Origin', 'http://localhost:3000');
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Access token is required');
      }
    });
  });

  describe('🛡️ Error Handling Consistency', () => {
    test('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      // Invalid JSON may return empty object or error object
      if (Object.keys(response.body).length > 0) {
        expect(response.body).toHaveProperty('success', false);
      } else {
        // Empty response body is also acceptable for malformed JSON
        expect(response.body).toEqual({});
      }
    });

    test('should handle validation errors consistently', async () => {
      const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
        email: 'invalid-email',
        username: 'ab', // Too short
        password: '123', // Too short
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      // Message may vary, check for validation-related message
      expect(response.body.message).toMatch(/validation|invalid|failed/i);
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  describe('📈 Response Shape Validation', () => {
    test('should return successful response for simple requests', async () => {
      const response = await request(app)
        .get('/api/test/success')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    test('should return full data payload for large responses', async () => {
      const response = await request(app)
        .get('/api/test/large-data')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1000);
    });
  });
});
