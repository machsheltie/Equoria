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
import documentationRoutes from '../../routes/documentationRoutes.mjs';
import { responseHandler } from '../../utils/apiResponse.mjs';
// authenticateToken import removed - not used in this file
import { getApiDocumentationService } from '../../services/apiDocumentationService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

describe('Documentation Routes', () => {
  let testApp;
  let testUser;
  let authToken;
  let docService;

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
    authToken = jwt.sign(
      { id: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    // Create test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use(responseHandler);
    testApp.use('/api/docs', documentationRoutes);

    // Get documentation service
    docService = getApiDocumentationService();
  });

  afterAll(async () => {
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
      const response = await request(testApp)
        .get('/api/docs/health')
        .set('x-test-require-auth', 'true')
        .expect(401);

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
        responses: { '200': { description: 'Success' } },
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

  describe('POST /api/docs/generate', () => {
    test('generates documentation successfully', async () => {
      // Register some test endpoints
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        description: 'Get all users',
        tags: ['Users'],
        responses: { '200': { description: 'Success' } },
      });

      docService.registerSchema('User', {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      });

      const response = await request(testApp)
        .post('/api/docs/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpointsGenerated).toBeDefined();
      expect(response.body.data.schemasGenerated).toBeDefined();
      expect(response.body.data.coverage).toBeDefined();
      expect(response.body.data.generatedAt).toBeDefined();
      expect(response.body.data.specificationVersion).toBeDefined();
    });
  });

  describe('POST /api/docs/endpoints', () => {
    test('registers endpoint successfully', async () => {
      const endpointData = {
        method: 'POST',
        path: '/api/horses',
        summary: 'Create horse',
        description: 'Create a new horse',
        tags: ['Horses'],
        parameters: [],
        responses: {
          '201': { description: 'Horse created' },
          '400': { description: 'Validation error' },
        },
      };

      const response = await request(testApp)
        .post('/api/docs/endpoints')
        .set('Authorization', `Bearer ${authToken}`)
        .send(endpointData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.method).toBe('POST');
      expect(response.body.data.path).toBe('/api/horses');
      expect(response.body.data.summary).toBe('Create horse');
      expect(response.body.data.registeredAt).toBeDefined();
    });

    test('validates endpoint data', async () => {
      const invalidData = {
        method: 'INVALID',
        path: '',
        summary: '',
      };

      const response = await request(testApp)
        .post('/api/docs/endpoints')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    test('accepts valid HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const endpointData = {
          method,
          path: `/api/test-${method.toLowerCase()}`,
          summary: `Test ${method}`,
        };

        const response = await request(testApp)
          .post('/api/docs/endpoints')
          .set('Authorization', `Bearer ${authToken}`)
          .send(endpointData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.method).toBe(method);
      }
    });
  });

  describe('POST /api/docs/schemas', () => {
    test('registers schema successfully', async () => {
      const schemaData = {
        name: 'Horse',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            breed: { type: 'string' },
            age: { type: 'integer', minimum: 0 },
          },
          required: ['id', 'name', 'breed'],
        },
      };

      const response = await request(testApp)
        .post('/api/docs/schemas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(schemaData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Horse');
      expect(response.body.data.registeredAt).toBeDefined();
    });

    test('validates schema data', async () => {
      const invalidData = {
        name: '',
        schema: 'not an object',
      };

      const response = await request(testApp)
        .post('/api/docs/schemas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/docs/coverage', () => {
    test('retrieves coverage analysis successfully', async () => {
      // Add some test data for meaningful coverage analysis
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        description: 'Get all users',
        tags: ['Users'],
        responses: { '200': { description: 'Success' } },
      });

      docService.registerEndpoint('POST', '/api/users', {
        summary: 'Create user',
        // Missing description for partial coverage
        tags: ['Users'],
        responses: { '201': { description: 'Created' } },
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
      expect(trends.coverageTrend).toBeDefined();
      expect(trends.qualityTrend).toBeDefined();

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
      const response = await request(testApp)
        .get('/api/docs/health')
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Integration with Documentation Service', () => {
    test('endpoints registration reflects in metrics', async () => {
      // Register multiple endpoints
      const endpoints = [
        { method: 'GET', path: '/api/users', summary: 'List users', description: 'Get all users', tags: ['Users'] },
        { method: 'POST', path: '/api/users', summary: 'Create user', description: 'Create new user', tags: ['Users'] },
        { method: 'GET', path: '/api/horses', summary: 'List horses', description: 'Get all horses', tags: ['Horses'] },
      ];

      for (const endpoint of endpoints) {
        await request(testApp)
          .post('/api/docs/endpoints')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...endpoint,
            responses: { '200': { description: 'Success' } },
          })
          .expect(201);
      }

      // Check metrics reflect the registered endpoints
      const response = await request(testApp)
        .get('/api/docs/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { metrics } = response.body.data;
      expect(metrics.totalEndpoints).toBeGreaterThanOrEqual(3);
    });

    test('schema registration reflects in generation', async () => {
      // Register schemas
      await request(testApp)
        .post('/api/docs/schemas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'User',
          schema: { type: 'object', properties: { id: { type: 'string' } } },
        })
        .expect(201);

      await request(testApp)
        .post('/api/docs/schemas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Horse',
          schema: { type: 'object', properties: { id: { type: 'string' } } },
        })
        .expect(201);

      // Generate documentation
      const response = await request(testApp)
        .post('/api/docs/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.schemasGenerated).toBeGreaterThanOrEqual(2);
    });
  });
});
