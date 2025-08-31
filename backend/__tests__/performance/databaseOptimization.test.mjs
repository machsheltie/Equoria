/**
 * Database Query Optimization Tests
 * 
 * Tests for database performance optimization including:
 * - Query performance analysis and benchmarking
 * - Index optimization for epigenetic queries
 * - Connection pooling and caching strategy
 * - Complex query optimization (JSONB, joins, aggregations)
 * 
 * Following TDD with NO MOCKING approach for authentic performance validation
 * Target: < 100ms response times, 100+ concurrent users, 99.9% uptime
 */

import { jest } from '@jest/globals';
import prisma from '../../db/index.mjs';
import {
  analyzeQueryPerformance,
  optimizeEpigeneticQueries,
  implementConnectionPooling,
  setupQueryCaching,
  createOptimizedIndexes,
  benchmarkDatabaseOperations
} from '../../services/databaseOptimizationService.mjs';

describe('Database Query Optimization', () => {
  let testUserId;
  let testHorseIds = [];
  let performanceBaseline = {};

  beforeAll(async () => {
    // Create test data for performance testing
    const testUser = await prisma.user.create({
      data: {
        username: 'perftest_user',
        email: 'perftest@example.com',
        password: 'hashedpassword',
        firstName: 'Performance',
        lastName: 'Test',
      },
    });
    testUserId = testUser.id;

    // Create a test breed if it doesn't exist
    await prisma.breed.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: 'Test Breed',
        description: 'Test breed for performance testing',
        characteristics: {},
      },
    });

    // Create test horses with complex data
    for (let i = 0; i < 50; i++) {
      const age = Math.floor(Math.random() * 15) + 3;
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - age);

      const horse = await prisma.horse.create({
        data: {
          name: `TestHorse${i}`,
          user: {
            connect: { id: testUserId }
          },
          breed: {
            connect: { id: 1 }
          },
          sex: i % 2 === 0 ? 'stallion' : 'mare',
          age: age,
          dateOfBirth: birthDate,
          epigeneticFlags: ['BRAVE', 'INTELLIGENT', 'ATHLETIC'],
          disciplineScores: {
            Racing: Math.floor(Math.random() * 100),
            Dressage: Math.floor(Math.random() * 100),
            ShowJumping: Math.floor(Math.random() * 100),
          },
          epigeneticModifiers: {
            positive: ['resilient', 'focused'],
            negative: ['nervous'],
            hidden: ['potential_champion'],
          },
          speed: Math.floor(Math.random() * 100),
          stamina: Math.floor(Math.random() * 100),
          agility: Math.floor(Math.random() * 100),
          intelligence: Math.floor(Math.random() * 100),
          precision: Math.floor(Math.random() * 100),
          balance: Math.floor(Math.random() * 100),
          boldness: Math.floor(Math.random() * 100),
          flexibility: Math.floor(Math.random() * 100),
          obedience: Math.floor(Math.random() * 100),
          focus: Math.floor(Math.random() * 100),
        },
      });
      testHorseIds.push(horse.id);
    }

    // Establish performance baseline
    performanceBaseline = await benchmarkDatabaseOperations();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.horse.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('Query Performance Analysis', () => {
    test('analyzes complex epigenetic queries for performance bottlenecks', async () => {
      const startTime = Date.now();
      
      const analysis = await analyzeQueryPerformance({
        queryType: 'epigenetic_trait_search',
        userId: testUserId,
        filters: {
          traits: ['BRAVE', 'INTELLIGENT'],
          minAge: 3,
          disciplines: ['Racing', 'Dressage'],
        },
      });

      const executionTime = Date.now() - startTime;

      expect(analysis).toBeDefined();
      expect(analysis.executionTime).toBeLessThan(100); // < 100ms target
      expect(analysis.queryPlan).toBeDefined();
      expect(analysis.indexUsage).toBeDefined();
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(executionTime).toBeLessThan(100);
    });

    test('identifies slow JSONB queries and optimization opportunities', async () => {
      const analysis = await analyzeQueryPerformance({
        queryType: 'jsonb_discipline_scores',
        userId: testUserId,
        filters: {
          minScore: 80,
          disciplines: ['Racing', 'Dressage', 'ShowJumping'],
        },
      });

      expect(analysis.jsonbOptimizations).toBeDefined();
      expect(analysis.indexRecommendations).toContain('GIN index on disciplineScores');
      expect(analysis.queryComplexity).toBeLessThan(1000); // Complexity score
    });

    test('benchmarks multi-table join performance', async () => {
      const startTime = Date.now();

      const analysis = await analyzeQueryPerformance({
        queryType: 'user_horses_with_results',
        userId: testUserId,
        includeRelations: ['breed', 'competitionResults', 'trainingLogs'],
      });

      const executionTime = Date.now() - startTime;

      expect(analysis.joinOptimizations).toBeDefined();
      expect(analysis.nPlusOneRisks).toBeInstanceOf(Array);
      expect(executionTime).toBeLessThan(150); // Slightly higher for complex joins
    });
  });

  describe('Index Optimization', () => {
    test('creates optimized indexes for epigenetic queries', async () => {
      const indexResults = await createOptimizedIndexes({
        tables: ['horses'],
        queryPatterns: [
          'epigenetic_flags_search',
          'discipline_scores_filter',
          'age_and_training_status',
          'user_horse_lookup',
        ],
      });

      expect(indexResults.created).toBeInstanceOf(Array);
      expect(indexResults.created.length).toBeGreaterThan(0);
      expect(indexResults.performanceImpact).toBeDefined();
      
      // Verify indexes were actually created
      for (const index of indexResults.created) {
        expect(index.status).toBe('created');
        expect(index.estimatedSpeedup).toBeGreaterThan(1);
      }
    });

    test('optimizes JSONB indexes for trait and score queries', async () => {
      const jsonbIndexes = await createOptimizedIndexes({
        tables: ['horses'],
        jsonbFields: [
          'epigeneticModifiers',
          'disciplineScores',
          'stats',
          'ultraRareTraits',
        ],
        indexTypes: ['GIN', 'BTREE'],
      });

      expect(jsonbIndexes.ginIndexes).toBeInstanceOf(Array);
      expect(jsonbIndexes.btreeIndexes).toBeInstanceOf(Array);
      expect(jsonbIndexes.performanceGains).toBeDefined();
    });

    test('creates composite indexes for common query patterns', async () => {
      const compositeIndexes = await createOptimizedIndexes({
        compositePatterns: [
          ['userId', 'age', 'trainingCooldown'],
          ['breedId', 'age'],
          ['userId', 'createdAt'],
          ['ownerId', 'stableId'],
        ],
      });

      expect(compositeIndexes.created).toBeInstanceOf(Array);
      expect(compositeIndexes.queryPatternsCovered).toBeGreaterThan(5);
    });
  });

  describe('Connection Pooling Optimization', () => {
    test('implements efficient connection pooling strategy', async () => {
      const poolConfig = await implementConnectionPooling({
        maxConnections: 20,
        minConnections: 5,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 600000,
        reapIntervalMillis: 1000,
      });

      expect(poolConfig.status).toBe('configured');
      expect(poolConfig.activeConnections).toBeLessThanOrEqual(20);
      expect(poolConfig.idleConnections).toBeGreaterThanOrEqual(0);
      expect(poolConfig.performanceMetrics).toBeDefined();
    });

    test('handles concurrent connection requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 50 }, (_, i) =>
        prisma.horse.findMany({
          where: { userId: testUserId },
          take: 10,
          skip: i * 10,
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(executionTime).toBeLessThan(2000); // < 2 seconds for 50 concurrent requests
      
      // Verify no connection pool exhaustion
      const poolStatus = await implementConnectionPooling({ action: 'status' });
      expect(poolStatus.errors).toHaveLength(0);
    });

    test('manages connection lifecycle properly', async () => {
      const lifecycle = await implementConnectionPooling({
        action: 'lifecycle_test',
        testDuration: 5000, // 5 seconds
      });

      expect(lifecycle.connectionsCreated).toBeGreaterThan(0);
      expect(lifecycle.connectionsDestroyed).toBeGreaterThan(0);
      expect(lifecycle.leakedConnections).toBe(0);
      expect(lifecycle.averageConnectionTime).toBeLessThan(100);
    });
  });

  describe('Query Caching Strategy', () => {
    test('implements Redis-based query caching', async () => {
      const cacheConfig = await setupQueryCaching({
        provider: 'redis',
        ttl: 300, // 5 minutes
        maxMemory: '100mb',
        evictionPolicy: 'allkeys-lru',
      });

      expect(cacheConfig.status).toBe('active');
      expect(cacheConfig.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheConfig.memoryUsage).toBeLessThan(100 * 1024 * 1024); // < 100MB
    });

    test('caches expensive epigenetic analysis queries', async () => {
      const cacheKey = `epigenetic_analysis_${testUserId}`;
      
      // First request (cache miss)
      const startTime1 = Date.now();
      const result1 = await optimizeEpigeneticQueries({
        userId: testUserId,
        analysisType: 'comprehensive',
        useCache: true,
      });
      const time1 = Date.now() - startTime1;

      // Second request (cache hit)
      const startTime2 = Date.now();
      const result2 = await optimizeEpigeneticQueries({
        userId: testUserId,
        analysisType: 'comprehensive',
        useCache: true,
      });
      const time2 = Date.now() - startTime2;

      expect(result1).toEqual(result2);
      expect(time2).toBeLessThan(time1 * 0.1); // Cache should be 10x faster
      expect(result2.fromCache).toBe(true);
    });

    test('invalidates cache on data updates', async () => {
      const cacheKey = `horse_data_${testHorseIds[0]}`;
      
      // Cache initial data
      await optimizeEpigeneticQueries({
        horseId: testHorseIds[0],
        useCache: true,
      });

      // Update horse data
      await prisma.horse.update({
        where: { id: testHorseIds[0] },
        data: { bondScore: 95 },
      });

      // Verify cache invalidation
      const result = await optimizeEpigeneticQueries({
        horseId: testHorseIds[0],
        useCache: true,
      });

      expect(result.fromCache).toBe(false);
      expect(result.data.bondScore).toBe(95);
    });
  });

  describe('Performance Benchmarking', () => {
    test('meets response time targets for common operations', async () => {
      const benchmarks = await benchmarkDatabaseOperations({
        operations: [
          'user_horses_list',
          'horse_detail_view',
          'trait_discovery',
          'competition_results',
          'training_status',
        ],
        iterations: 100,
      });

      for (const [operation, metrics] of Object.entries(benchmarks)) {
        expect(metrics.averageTime).toBeLessThan(100); // < 100ms
        expect(metrics.p95Time).toBeLessThan(200); // 95th percentile < 200ms
        expect(metrics.errorRate).toBe(0);
      }
    });

    test('handles high concurrent load efficiently', async () => {
      const loadTest = await benchmarkDatabaseOperations({
        concurrentUsers: 100,
        requestsPerUser: 10,
        duration: 30000, // 30 seconds
      });

      expect(loadTest.totalRequests).toBe(1000);
      expect(loadTest.successRate).toBeGreaterThanOrEqual(0.999); // 99.9% success
      expect(loadTest.averageResponseTime).toBeLessThan(100);
      expect(loadTest.throughput).toBeGreaterThan(30); // > 30 requests/second
    });

    test('maintains performance under memory pressure', async () => {
      const memoryTest = await benchmarkDatabaseOperations({
        memoryPressure: true,
        largeDataSets: true,
        duration: 60000, // 1 minute
      });

      expect(memoryTest.memoryUsage.peak).toBeLessThan(512 * 1024 * 1024); // < 512MB
      expect(memoryTest.performanceDegradation).toBeLessThan(0.2); // < 20% slower
      expect(memoryTest.memoryLeaks).toBe(0);
    });
  });

  describe('Query Optimization Results', () => {
    test('improves epigenetic query performance significantly', async () => {
      const beforeOptimization = await benchmarkDatabaseOperations({
        operation: 'epigenetic_trait_search',
        optimizations: false,
      });

      const afterOptimization = await benchmarkDatabaseOperations({
        operation: 'epigenetic_trait_search',
        optimizations: true,
      });

      const improvement = (beforeOptimization.averageTime - afterOptimization.averageTime) / beforeOptimization.averageTime;
      
      expect(improvement).toBeGreaterThan(0.5); // > 50% improvement
      expect(afterOptimization.averageTime).toBeLessThan(50); // < 50ms optimized
    });

    test('reduces database load and resource usage', async () => {
      const resourceUsage = await benchmarkDatabaseOperations({
        operation: 'resource_monitoring',
        duration: 30000,
      });

      expect(resourceUsage.cpuUsage.average).toBeLessThan(0.7); // < 70% CPU
      expect(resourceUsage.memoryUsage.average).toBeLessThan(0.8); // < 80% memory
      expect(resourceUsage.diskIO.average).toBeLessThan(100); // < 100 MB/s
      expect(resourceUsage.connectionUtilization).toBeLessThan(0.8); // < 80% connections
    });

    test('validates production readiness metrics', async () => {
      const productionMetrics = await benchmarkDatabaseOperations({
        scenario: 'production_simulation',
        duration: 300000, // 5 minutes
        users: 200,
        peakLoad: true,
      });

      expect(productionMetrics.uptime).toBeGreaterThanOrEqual(0.999); // 99.9% uptime
      expect(productionMetrics.responseTime.p99).toBeLessThan(500); // 99th percentile < 500ms
      expect(productionMetrics.errorRate).toBeLessThan(0.001); // < 0.1% errors
      expect(productionMetrics.throughput).toBeGreaterThan(100); // > 100 req/sec
    });
  });
});
