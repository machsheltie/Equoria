/**
 * 🧪 API Response Optimization Tests
 *
 * Comprehensive test suite for API response optimization system including:
 * - Response compression and encoding
 * - Pagination services (cursor and offset-based)
 * - Data serialization optimization
 * - Lazy loading functionality
 * - Response caching with ETags
 * - Performance monitoring and metrics
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real compression testing with actual data
 * - Authentic pagination with database operations
 * - Genuine serialization performance validation
 * - Real cache behavior testing
 * - Production-like performance scenarios
 */

// jest import removed - not used in this file
import request from 'supertest';
import express from 'express';
import {
  PaginationService,
  SerializationService,
  LazyLoadingService,
  ResponseCacheService,
  getPerformanceMetrics,
} from '../../services/apiResponseOptimizationService.mjs';
import {
  responseOptimization,
  paginationMiddleware,
  lazyLoadingMiddleware,
  performanceMonitoring,
} from '../../middleware/responseOptimization.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

describe('API Response Optimization System', () => {
  let testUserId;
  const testHorseIds = [];
  let testApp;
  const testRunId = `apiopt_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const testBreedName = `Optimization Test Breed ${testRunId}`;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `optimizationTestUser_${testRunId}`,
        email: `optimization_${testRunId}@test.com`,
        password: 'testPassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    testUserId = testUser.id;

    // Create test breed
    const testBreed = await prisma.breed.create({
      data: {
        name: testBreedName,
        description: 'Test breed for optimization testing',
      },
    });

    // Create test horses for pagination testing
    for (let i = 0; i < 25; i++) {
      const horse = await prisma.horse.create({
        data: {
          name: `OptimizationHorse${i}`,
          user: { connect: { id: testUserId } },
          breed: { connect: { id: testBreed.id } },
          sex: i % 2 === 0 ? 'Stallion' : 'Mare',
          age: 3 + (i % 10),
          dateOfBirth: new Date(Date.now() - (3 + (i % 10)) * 365 * 24 * 60 * 60 * 1000),
          healthStatus: 'Good',
          temperament: 'confident',
          epigeneticFlags: ['BRAVE', 'INTELLIGENT'],
          disciplineScores: {
            Racing: 50 + (i % 50),
            Dressage: 40 + (i % 60),
          },
          speed: 50 + (i % 50),
          stamina: 50 + (i % 50),
          agility: 50 + (i % 50),
          intelligence: 50 + (i % 50),
          precision: 50 + (i % 50),
          balance: 50 + (i % 50),
          boldness: 50 + (i % 50),
          flexibility: 50 + (i % 50),
          obedience: 50 + (i % 50),
          focus: 50 + (i % 50),
        },
      });
      testHorseIds.push(horse.id);
    }

    // Create test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use(responseOptimization());
    testApp.use(paginationMiddleware());
    testApp.use(lazyLoadingMiddleware());
    testApp.use(performanceMonitoring());

    // Test routes
    testApp.get('/test/horses', async (req, res) => {
      const horses = await prisma.horse.findMany({
        where: { userId: testUserId }, // Matches schema field
        take: req.pagination.limit,
        skip: req.pagination.offset,
      });

      const totalCount = await prisma.horse.count({
        where: { userId: testUserId }, // Matches schema field
      });

      const paginatedResult = PaginationService.createOffsetPagination({
        data: horses,
        page: req.pagination.page,
        limit: req.pagination.limit,
        totalCount,
      });

      res.json({
        success: true,
        message: 'Horses retrieved successfully',
        ...paginatedResult,
      });
    });

    testApp.get('/test/large-data', (req, res) => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'A'.repeat(100), // 100 character description
        metadata: {
          tags: ['tag1', 'tag2', 'tag3'],
          properties: {
            value: Math.random() * 100,
            category: `Category ${i % 10}`,
          },
        },
      }));

      res.json({
        success: true,
        message: 'Large dataset retrieved',
        data: largeData,
      });
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.horse.deleteMany({
        where: { userId: testUserId }, // Matches schema field
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
    await prisma.breed.deleteMany({
      where: { name: testBreedName },
    });
  });

  describe('Pagination Service', () => {
    test('creates offset-based pagination correctly', () => {
      const testData = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

      const result = PaginationService.createOffsetPagination({
        data: testData,
        page: 1,
        limit: 5,
        totalCount: 25,
      });

      expect(result.data).toHaveLength(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.totalCount).toBe(25);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    test('creates cursor-based pagination correctly', () => {
      const testData = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

      const result = PaginationService.createCursorPagination({
        data: testData,
        limit: 5,
        orderBy: 'id',
        totalCount: 25,
      });

      expect(result.data).toHaveLength(5);
      expect(result.pagination.cursor.next).toBe(5);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);
      expect(result.pagination.limit).toBe(5);
    });

    test('generates optimized Prisma query for cursor pagination', () => {
      const query = PaginationService.generateCursorQuery({
        cursor: 10,
        limit: 20,
        orderBy: 'createdAt',
        orderDirection: 'desc',
        where: { ownerId: testUserId },
      });

      expect(query.where.ownerId).toBe(testUserId);
      expect(query.orderBy.createdAt).toBe('desc');
      expect(query.take).toBe(20);
      expect(query.cursor.createdAt).toBe(10);
      expect(query.skip).toBe(1);
    });
  });

  describe('Serialization Service', () => {
    test('optimizes response data correctly', () => {
      const testData = {
        id: 1,
        name: 'Test Horse',
        description: 'A test horse',
        metadata: null,
        emptyArray: [],
        nestedData: {
          value: 'test',
          nullValue: null,
        },
      };

      const optimized = SerializationService.optimizeResponse(testData, { compress: true });

      expect(optimized.id).toBe(1);
      expect(optimized.name).toBe('Test Horse');
      // Null is a valid API response value and should be preserved
      expect(optimized.metadata).toBeNull();
      expect(optimized.nestedData.nullValue).toBeNull();
    });

    test('selects specific fields correctly', () => {
      const testData = [
        { id: 1, name: 'Horse 1', age: 5, description: 'Test horse 1' },
        { id: 2, name: 'Horse 2', age: 7, description: 'Test horse 2' },
      ];

      const result = SerializationService.selectFields(testData, ['id', 'name']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Horse 1' });
      expect(result[1]).toEqual({ id: 2, name: 'Horse 2' });
      expect(result[0].age).toBeUndefined();
      expect(result[0].description).toBeUndefined();
    });

    test('excludes specific fields correctly', () => {
      const testData = {
        id: 1,
        name: 'Test Horse',
        sensitiveData: 'secret',
        publicData: 'public',
      };

      const result = SerializationService.excludeFields(testData, ['sensitiveData']);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Horse');
      expect(result.publicData).toBe('public');
      expect(result.sensitiveData).toBeUndefined();
    });

    test('handles nested field selection', () => {
      const testData = {
        id: 1,
        user: {
          id: 100,
          name: 'Test User',
          email: 'test@example.com',
        },
        metadata: {
          tags: ['tag1', 'tag2'],
          category: 'test',
        },
      };

      const result = SerializationService.selectFields(testData, ['id', 'user.name', 'metadata.tags']);

      expect(result.id).toBe(1);
      expect(result.user.name).toBe('Test User');
      expect(result.user.email).toBeUndefined();
      expect(result.metadata.tags).toEqual(['tag1', 'tag2']);
      expect(result.metadata.category).toBeUndefined();
    });
  });

  describe('Response Cache Service', () => {
    test('generates consistent ETags for same data', () => {
      const testData = { id: 1, name: 'Test' };

      const etag1 = ResponseCacheService.generateETag(testData);
      const etag2 = ResponseCacheService.generateETag(testData);

      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
    });

    test('generates different ETags for different data', () => {
      const testData1 = { id: 1, name: 'Test 1' };
      const testData2 = { id: 2, name: 'Test 2' };

      const etag1 = ResponseCacheService.generateETag(testData1);
      const etag2 = ResponseCacheService.generateETag(testData2);

      expect(etag1).not.toBe(etag2);
    });

    test('determines cacheable requests correctly', () => {
      const mockReq = { method: 'GET' };
      const mockRes = { statusCode: 200, getHeader: () => null };

      expect(ResponseCacheService.shouldCache(mockReq, mockRes)).toBe(true);

      mockReq.method = 'POST';
      expect(ResponseCacheService.shouldCache(mockReq, mockRes)).toBe(false);

      mockReq.method = 'GET';
      mockRes.statusCode = 404;
      expect(ResponseCacheService.shouldCache(mockReq, mockRes)).toBe(false);
    });
  });

  describe('Lazy Loading Service', () => {
    test('creates lazy loading configuration', () => {
      const baseQuery = {
        where: { id: 1 },
        include: {
          user: true,
          comments: true,
          metadata: true,
        },
      };

      const lazyConfig = LazyLoadingService.createLazyConfig(baseQuery, ['comments', 'metadata']);

      expect(lazyConfig.where.id).toBe(1);
      expect(lazyConfig.include.user).toBe(true);
      expect(lazyConfig.include.comments).toBeUndefined();
      expect(lazyConfig.include.metadata).toBeUndefined();
    });

    test('loads related data on demand', async () => {
      const relations = ['breed'];
      const relatedData = await LazyLoadingService.loadRelatedData('horse', testHorseIds[0], relations, prisma);

      expect(relatedData.breed).toBeDefined();
      expect(relatedData.breed.name).toBe(testBreedName);
    });
  });

  describe('Middleware Integration', () => {
    test('handles pagination middleware correctly', async () => {
      const response = await request(testApp).get('/test/horses?page=1&limit=10').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.hasNextPage).toBe(true);
    });

    test('handles field selection via query parameters', async () => {
      const response = await request(testApp).get('/test/horses?fields=id,name&limit=5').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);

      // Check that only selected fields are present
      response.body.data.forEach(horse => {
        expect(horse.id).toBeDefined();
        expect(horse.name).toBeDefined();
        expect(horse.age).toBeUndefined();
        expect(horse.breed).toBeUndefined();
      });
    });

    test('adds performance headers to responses', async () => {
      const response = await request(testApp).get('/test/horses?limit=5').expect(200);

      expect(response.headers['x-processing-time']).toBeDefined();
      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-timestamp']).toBeDefined();
    });

    test('handles large response optimization', async () => {
      const response = await request(testApp).get('/test/large-data').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1000);
      expect(response.headers['x-response-size']).toBeDefined();

      const responseSize = parseInt(response.headers['x-response-size']);
      expect(responseSize).toBeGreaterThan(0);
    });

    test('supports debug mode with optimization info', async () => {
      const response = await request(testApp).get('/test/horses?debug=true&fields=id,name&limit=3').expect(200);

      expect(response.body.meta.optimization).toBeDefined();
      expect(response.body.meta.optimization.fieldsSelected).toBe(true);
      expect(response.body.meta.optimization.processingTime).toBeDefined();
      expect(response.body.meta.optimization.compressed).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('tracks performance metrics correctly', () => {
      const metrics = getPerformanceMetrics();

      expect(metrics).toHaveProperty('compressionRatio');
      expect(metrics).toHaveProperty('responseSize');
      expect(metrics).toHaveProperty('serializationTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('totalRequests');

      expect(typeof metrics.cacheHitRate).toBe('number');
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('ETag and Caching', () => {
    test('generates and validates ETags correctly', async () => {
      const testData = { id: 1, name: 'Test Data' };
      ResponseCacheService.generateETag(testData);

      // Create a test route that uses ETags
      testApp.get('/test/etag', (req, res) => {
        const responseData = { success: true, data: testData };
        const generatedETag = ResponseCacheService.generateETag(responseData);

        if (req.headers['if-none-match'] === generatedETag) {
          return res.status(304).end();
        }

        res.setHeader('ETag', generatedETag);
        res.json(responseData);
      });

      // First request should return 200 with ETag
      const response1 = await request(testApp).get('/test/etag').expect(200);

      expect(response1.headers.etag).toBeDefined();

      // Second request with ETag should return 304
      const response2 = await request(testApp)
        .get('/test/etag')
        .set('If-None-Match', response1.headers.etag)
        .expect(304);

      expect(response2.body).toEqual({});
    });
  });

  describe('Response Size Monitoring', () => {
    test('monitors and warns about large responses', async () => {
      // This test verifies that large responses are properly monitored
      const response = await request(testApp).get('/test/large-data').expect(200);

      expect(response.headers['x-response-size']).toBeDefined();
      const responseSize = parseInt(response.headers['x-response-size']);
      expect(responseSize).toBeGreaterThan(10000); // Large response
    });

    test('handles response size limits', async () => {
      // Create a test app with very small size limit
      const limitedApp = express();
      limitedApp.use(express.json());
      limitedApp.use(responseOptimization({ maxResponseSize: 1000 })); // 1KB limit

      limitedApp.get('/test/oversized', (req, res) => {
        const largeData = Array.from({ length: 100 }, (_, i) => ({
          id: i,
          description: 'A'.repeat(100), // This will exceed 1KB
        }));

        res.json({
          success: true,
          data: largeData,
        });
      });

      const response = await request(limitedApp).get('/test/oversized').expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('payload too large');
    });
  });
});
