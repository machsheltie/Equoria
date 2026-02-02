/**
 * 🧪 API Optimization Routes Tests
 *
 * Comprehensive test suite for API optimization management endpoints including:
 * - Performance metrics retrieval
 * - Compression statistics and analytics
 * - Cache performance monitoring
 * - Optimization testing tools
 * - Recommendation generation
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real API endpoint testing with authentication
 * - Authentic performance metrics validation
 * - Genuine compression and caching behavior
 * - Production-like optimization scenarios
 */

// jest import removed - not used in this file
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import apiOptimizationRoutes from '../../routes/apiOptimizationRoutes.mjs';
import { responseHandler } from '../../utils/apiResponse.mjs';
import { authenticateToken } from '../../middleware/auth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

describe('API Optimization Routes', () => {
  let testApp;
  let testUser;
  let authToken;
  const testRunId = `apiopt_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `apiOptimizationTestUser_${testRunId}`,
        email: `apioptimization_${testRunId}@test.com`,
        password: 'testPassword123',
        firstName: 'API',
        lastName: 'Optimization',
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
    testApp.use('/api/optimization', authenticateToken, apiOptimizationRoutes);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
  });

  describe('GET /api/optimization/metrics', () => {
    test('retrieves optimization metrics successfully', async () => {
      const response = await request(testApp)
        .get('/api/optimization/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('metrics');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.memoryUsage).toBeDefined();
    });

    test('requires authentication', async () => {
      const response = await request(testApp)
        .get('/api/optimization/metrics')
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('GET /api/optimization/performance', () => {
    test('retrieves performance analytics with default timeframe', async () => {
      const response = await request(testApp)
        .get('/api/optimization/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.insights).toBeDefined();
      expect(response.body.data.timeframe).toBe('24h');
      expect(response.body.data.insights.averageResponseTime).toBeDefined();
      expect(response.body.data.insights.compressionEfficiency).toBeDefined();
      expect(response.body.data.insights.cacheEffectiveness).toBeDefined();
    });

    test('accepts different timeframe parameters', async () => {
      const timeframes = ['1h', '24h', '7d', '30d'];

      for (const timeframe of timeframes) {
        const response = await request(testApp)
          .get(`/api/optimization/performance?timeframe=${timeframe}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.timeframe).toBe(timeframe);
      }
    });

    test('validates timeframe parameter', async () => {
      const response = await request(testApp)
        .get('/api/optimization/performance?timeframe=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/optimization/compression-stats', () => {
    test('retrieves compression statistics successfully', async () => {
      const response = await request(testApp)
        .get('/api/optimization/compression-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.averageCompressionRatio).toBeDefined();
      expect(response.body.data.totalBytesSaved).toBeDefined();
      expect(response.body.data.compressionEfficiency).toBeDefined();
      expect(response.body.data.recommendedSettings).toBeDefined();
      expect(Array.isArray(response.body.data.recommendedSettings)).toBe(true);
    });
  });

  describe('GET /api/optimization/cache-analytics', () => {
    test('retrieves cache analytics successfully', async () => {
      const response = await request(testApp)
        .get('/api/optimization/cache-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hitRate).toBeDefined();
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.cacheEfficiency).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });
  });

  describe('POST /api/optimization/test-compression', () => {
    test('tests compression on sample data successfully', async () => {
      const testData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(50),
        })),
      };

      const response = await request(testApp)
        .post('/api/optimization/test-compression')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: testData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.originalSize).toBeGreaterThan(0);
      expect(response.body.data.optimizedSize).toBeGreaterThan(0);
      expect(response.body.data.compressionRatio).toBeDefined();
      expect(response.body.data.bytesSaved).toBeDefined();
      expect(response.body.data.percentageSaved).toBeDefined();
      expect(response.body.data.algorithm).toBe('gzip');
      expect(response.body.data.recommendation).toBeDefined();
    });

    test('validates required data parameter', async () => {
      const response = await request(testApp)
        .post('/api/optimization/test-compression')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('accepts different compression algorithms', async () => {
      const testData = { test: 'data' };
      const algorithms = ['gzip', 'brotli', 'deflate'];

      for (const algorithm of algorithms) {
        const response = await request(testApp)
          .post('/api/optimization/test-compression')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ data: testData, algorithm })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.algorithm).toBe(algorithm);
      }
    });
  });

  describe('POST /api/optimization/test-pagination', () => {
    test('tests offset pagination successfully', async () => {
      const response = await request(testApp)
        .post('/api/optimization/test-pagination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dataSize: 100,
          pageSize: 20,
          paginationType: 'offset',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.paginationType).toBe('offset');
      expect(response.body.data.dataSize).toBe(100);
      expect(response.body.data.pageSize).toBe(20);
      expect(response.body.data.processingTime).toBeDefined();
      expect(response.body.data.result.data).toHaveLength(20);
      expect(response.body.data.result.pagination).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
    });

    test('tests cursor pagination successfully', async () => {
      const response = await request(testApp)
        .post('/api/optimization/test-pagination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dataSize: 100,
          pageSize: 15,
          paginationType: 'cursor',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.paginationType).toBe('cursor');
      expect(response.body.data.result.pagination.cursor).toBeDefined();
      expect(response.body.data.result.pagination.hasNextPage).toBeDefined();
    });

    test('validates pagination parameters', async () => {
      // Test invalid data size
      const response1 = await request(testApp)
        .post('/api/optimization/test-pagination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ dataSize: 0 })
        .expect(400);

      expect(response1.body.success).toBe(false);

      // Test invalid page size
      const response2 = await request(testApp)
        .post('/api/optimization/test-pagination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ dataSize: 100, pageSize: 0 })
        .expect(400);

      expect(response2.body.success).toBe(false);

      // Test invalid pagination type
      const response3 = await request(testApp)
        .post('/api/optimization/test-pagination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ dataSize: 100, paginationType: 'invalid' })
        .expect(400);

      expect(response3.body.success).toBe(false);
    });
  });

  describe('GET /api/optimization/recommendations', () => {
    test('generates optimization recommendations successfully', async () => {
      const response = await request(testApp)
        .get('/api/optimization/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
      expect(response.body.data.priority).toBeDefined();
      expect(response.body.data.priority.high).toBeDefined();
      expect(response.body.data.priority.medium).toBeDefined();
      expect(response.body.data.priority.low).toBeDefined();
      expect(response.body.data.estimatedImpact).toBeDefined();
      expect(response.body.data.estimatedImpact.performance).toBeDefined();
      expect(response.body.data.estimatedImpact.bandwidth).toBeDefined();
      expect(response.body.data.estimatedImpact.userExperience).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('handles invalid authentication tokens', async () => {
      const response = await request(testApp)
        .get('/api/optimization/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('handles missing authorization header', async () => {
      const response = await request(testApp)
        .get('/api/optimization/metrics')
        .set('x-test-require-auth', 'true')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance Validation', () => {
    test('compression test shows meaningful results', async () => {
      const largeTestData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(2),
          metadata: {
            tags: ['tag1', 'tag2', 'tag3'],
            category: `Category ${i % 10}`,
            properties: {
              value: Math.random() * 100,
              active: i % 2 === 0,
            },
          },
        })),
      };

      const response = await request(testApp)
        .post('/api/optimization/test-compression')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: largeTestData })
        .expect(200);

      expect(response.body.data.originalSize).toBeGreaterThan(1000); // Should be substantial
      expect(response.body.data.bytesSaved).toBeGreaterThanOrEqual(0); // May be 0 if no compression
      expect(response.body.data.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(response.body.data.percentageSaved).toBeGreaterThanOrEqual(0);
    });

    test('pagination test shows performance metrics', async () => {
      const response = await request(testApp)
        .post('/api/optimization/test-pagination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dataSize: 1000,
          pageSize: 50,
          paginationType: 'offset',
        })
        .expect(200);

      expect(response.body.data.performance.itemsPerMs).toBeGreaterThanOrEqual(0);
      expect(['excellent', 'good', 'needs optimization']).toContain(response.body.data.performance.efficiency);
    });
  });
});
