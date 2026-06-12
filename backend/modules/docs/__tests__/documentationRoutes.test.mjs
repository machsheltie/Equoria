/**
 * 🧪 Documentation Routes Tests
 *
 * Comprehensive test suite for documentation management API endpoints including:
 * - Documentation health and metrics retrieval
 * - Specification validation and generation
 * - Endpoint and schema registration
 * - Coverage analysis and analytics
 * - Documentation management operations
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real API endpoint testing with authentication
 * - Authentic documentation service integration
 * - Genuine OpenAPI specification handling
 * - Production-like documentation scenarios
 */

// jest import removed - not used in this file
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { cpSync, mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import documentationRoutes from '../../../routes/documentationRoutes.mjs';
import { responseHandler } from '../../../utils/apiResponse.mjs';
// authenticateToken import removed - not used in this file
import { getApiDocumentationService } from '../../../services/apiDocumentationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('Documentation Routes', () => {
  let testApp;
  let testUser;
  let authToken;
  let docService;
  let tempDir;
  let originalSwaggerPath;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'docTestUser',
        email: 'docs@test.com',
        password: 'testPassword123',
        firstName: 'Doc',
        lastName: 'Test',
      },
    });

    // Generate auth token
    authToken = jwt.sign({ id: testUser.id, username: testUser.username }, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h',
    });

    // Create test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use(responseHandler);
    testApp.use('/api/docs', documentationRoutes);

    // Get documentation service
    docService = getApiDocumentationService();

    // Redirect the service to a temp copy of swagger.yaml so test-driven
    // regeneration (POST /api/docs/generate) does not mutate the curated
    // backend/docs/swagger.yaml on disk. Resolve the canonical path from
    // the backend layout rather than trusting the singleton's current
    // swaggerPath, which may have been redirected by earlier tests.
    const canonicalSwaggerPath = join(process.cwd(), 'docs', 'swagger.yaml');
    const fallbackSwaggerPath = existsSync(canonicalSwaggerPath) ? canonicalSwaggerPath : docService.swaggerPath;
    originalSwaggerPath = docService.swaggerPath;
    tempDir = mkdtempSync(join(os.tmpdir(), 'equoria-docs-test-'));
    const testSwaggerPath = join(tempDir, 'swagger.yaml');
    cpSync(fallbackSwaggerPath, testSwaggerPath);
    docService.swaggerPath = testSwaggerPath;
  }, 180000); // 180s — user create + file-system cpSync can be slow under full-suite load

  afterAll(async () => {
    // Restore service pointer and clean temp copy.
    if (docService) {
      docService.swaggerPath = originalSwaggerPath;
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }

    // Cleanup test data
    await prisma.user.deleteMany({
      where: { id: testUser?.id },
    });
  });

  beforeEach(() => {
    // Clear service state before each test
    docService.endpointRegistry.clear();
    docService.schemaRegistry.clear();
  });

  describe('GET /api/docs/health', () => {
    test('retrieves documentation health successfully', async () => {
      const response = await request(testApp)
        .get('/api/docs/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('health');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBeDefined();
      expect(['healthy', 'needs_attention']).toContain(response.body.data.status);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.validation).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
    });

    test('requires authentication', async () => {
      const response = await request(testApp).get('/api/docs/health').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('GET /api/docs/metrics', () => {
    test('retrieves documentation metrics successfully', async () => {
      const response = await request(testApp)
        .get('/api/docs/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.analytics).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();

      const { metrics } = response.body.data;
      expect(metrics.totalEndpoints).toBeDefined();
      expect(metrics.documentedEndpoints).toBeDefined();
      expect(metrics.coverage).toBeDefined();
      expect(metrics.lastUpdated).toBeDefined();

      const { analytics } = response.body.data;
      expect(analytics.coverageGrade).toBeDefined();
      expect(analytics.completionStatus).toBeDefined();
      expect(analytics.qualityScore).toBeDefined();
    });

    test('provides meaningful analytics data', async () => {
      // Add some test endpoints to get meaningful data
      docService.registerEndpoint('GET', '/api/test', {
        summary: 'Test endpoint',
        description: 'A test endpoint',
        tags: ['Test'],
        responses: { 200: { description: 'Success' } },
      });

      const response = await request(testApp)
        .get('/api/docs/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { analytics } = response.body.data;
      expect(['A', 'B', 'C', 'D', 'F']).toContain(analytics.coverageGrade);
      expect(['complete', 'mostly_complete', 'in_progress', 'incomplete']).toContain(analytics.completionStatus);
      expect(analytics.qualityScore).toBeGreaterThanOrEqual(0);
      expect(analytics.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/docs/validation', () => {
    test('validates OpenAPI specification successfully', async () => {
      const response = await request(testApp)
        .get('/api/docs/validation')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation).toBeDefined();
      expect(response.body.data.summary).toBeDefined();

      const { validation } = response.body.data;
      expect(validation.valid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(validation.timestamp).toBeDefined();

      const { summary } = response.body.data;
      expect(summary.isValid).toBeDefined();
      expect(summary.errorCount).toBeDefined();
      expect(['none', 'low', 'medium', 'high']).toContain(summary.severity);
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });
  });

  // Equoria-7osu4: the state-changing documentation endpoints were RELOCATED
  // off this PUBLIC router to the admin router (POST /api/v1/admin/docs/{generate,
  // endpoints,schemas}). On THIS public-mount test app they must no longer exist
  // as POST routes — only the GET reads remain. These sentinel-positive tests
  // assert the public mutation surface is gone (so re-adding a public POST here
  // would fail CI). Admin-path success + anon/non-admin rejection are proven in
  // backend/__tests__/docsMutationsAdminAuth.integration.test.mjs against the
  // real composed app.
  describe('Removed public mutation endpoints (Equoria-7osu4)', () => {
    test('POST /api/docs/generate is no longer a public route (404)', async () => {
      const response = await request(testApp)
        .post('/api/docs/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(response.status).toBe(404);
    });

    test('POST /api/docs/endpoints is no longer a public route (404)', async () => {
      const response = await request(testApp)
        .post('/api/docs/endpoints')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ method: 'POST', path: '/api/horses', summary: 'Create horse' });
      expect(response.status).toBe(404);
    });

    test('POST /api/docs/schemas is no longer a public route (404)', async () => {
      const response = await request(testApp)
        .post('/api/docs/schemas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Horse', schema: { type: 'object' } });
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/docs/coverage', () => {
    test('retrieves coverage analysis successfully', async () => {
      // Add some test data for meaningful coverage analysis
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        description: 'Get all users',
        tags: ['Users'],
        responses: { 200: { description: 'Success' } },
      });

      docService.registerEndpoint('POST', '/api/users', {
        summary: 'Create user',
        // Missing description for partial coverage
        tags: ['Users'],
        responses: { 201: { description: 'Created' } },
      });

      const response = await request(testApp)
        .get('/api/docs/coverage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.byTag).toBeDefined();
      expect(response.body.data.missing).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();

      const { overall } = response.body.data;
      expect(overall.percentage).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'F']).toContain(overall.grade);
      expect(overall.documented).toBeDefined();
      expect(overall.total).toBeDefined();

      expect(Array.isArray(response.body.data.missing)).toBe(true);
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });
  });

  describe('GET /api/docs/analytics', () => {
    test('retrieves analytics with default timeframe', async () => {
      const response = await request(testApp)
        .get('/api/docs/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.insights).toBeDefined();

      const { summary } = response.body.data;
      expect(summary.totalEndpoints).toBeDefined();
      expect(summary.documentedEndpoints).toBeDefined();
      expect(summary.coverage).toBeDefined();
      expect(summary.qualityScore).toBeDefined();
      expect(['healthy', 'needs_attention']).toContain(summary.healthStatus);

      const { trends } = response.body.data;
      expect(trends.timeframe).toBe('30d');
      // Equoria-7osu4: trends are NOT tracked (no historical-coverage store).
      // The route must report the honest not-tracked state, NOT a fabricated
      // 'stable'/'improving' literal.
      expect(trends.tracked).toBe(false);
      expect(trends.coverageTrend).toBeNull();
      expect(trends.qualityTrend).toBeNull();
      expect(typeof trends.note).toBe('string');

      const { insights } = response.body.data;
      expect(Array.isArray(insights.strengths)).toBe(true);
      expect(Array.isArray(insights.improvements)).toBe(true);
      expect(Array.isArray(insights.priorities)).toBe(true);
    });

    test('accepts different timeframe parameters', async () => {
      const timeframes = ['1d', '7d', '30d'];

      for (const timeframe of timeframes) {
        const response = await request(testApp)
          .get(`/api/docs/analytics?timeframe=${timeframe}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.trends.timeframe).toBe(timeframe);
      }
    });

    test('validates timeframe parameter', async () => {
      const response = await request(testApp)
        .get('/api/docs/analytics?timeframe=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid authentication tokens', async () => {
      const response = await request(testApp)
        .get('/api/docs/health')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('handles missing authorization header', async () => {
      const response = await request(testApp).get('/api/docs/health').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Integration with Documentation Service', () => {
    // Equoria-7osu4: registration/generation now happen through the admin
    // surface (proven end-to-end in docsMutationsAdminAuth.integration.test.mjs).
    // Here we exercise the PUBLIC GET reads against real service state that the
    // test sets up directly on the service singleton (the public router no
    // longer exposes the POST mutations).
    test('endpoints registration reflects in metrics (read path)', async () => {
      // Register multiple endpoints directly on the real service.
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        description: 'Get all users',
        tags: ['Users'],
        responses: { 200: { description: 'Success' } },
      });
      docService.registerEndpoint('POST', '/api/users', {
        summary: 'Create user',
        description: 'Create new user',
        tags: ['Users'],
        responses: { 201: { description: 'Created' } },
      });
      docService.registerEndpoint('GET', '/api/horses', {
        summary: 'List horses',
        description: 'Get all horses',
        tags: ['Horses'],
        responses: { 200: { description: 'Success' } },
      });

      // Persist the registry into the spec so updateMetrics (which reads the
      // spec) reflects them, then read metrics via the public GET route.
      docService.generateDocumentation();

      const response = await request(testApp)
        .get('/api/docs/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { metrics } = response.body.data;
      expect(metrics.totalEndpoints).toBeGreaterThanOrEqual(3);
    });

    test('schema registration reflects in generation (service path)', async () => {
      docService.registerSchema('User', {
        type: 'object',
        properties: { id: { type: 'string' } },
      });
      docService.registerSchema('Horse', {
        type: 'object',
        properties: { id: { type: 'string' } },
      });

      const spec = docService.generateDocumentation();
      expect(Object.keys(spec.components.schemas)).toEqual(expect.arrayContaining(['User', 'Horse']));
    });
  });
});
