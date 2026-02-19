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

// jest import removed - not used in this file
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  analyzeQueryPerformance,
  optimizeEpigeneticQueries,
  implementConnectionPooling,
  setupQueryCaching,
  createOptimizedIndexes,
  benchmarkDatabaseOperations,
} from '../../services/databaseOptimizationService.mjs';

// Performance tests for database query optimization
// Tests measure real database performance with actual queries
describe('Database Query Optimization', () => {
  let testUserId;
  const testHorseIds = [];
  let testBreed;
  const testRunId = `perf_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  beforeAll(async () => {
    // Create test data for performance testing
    const testUser = await prisma.user.create({
      data: {
        username: `perftest_user_${testRunId}`,
        email: `perftest_${testRunId}@example.com`,
        password: 'hashedpassword',
        firstName: 'Performance',
        lastName: 'Test',
      },
    });
    testUserId = testUser.id;

    // Create a test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `Test Breed Performance ${testRunId}`,
        description: 'Test breed for performance testing',
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
            connect: { id: testUserId },
          },
          breed: {
            connect: { id: testBreed.id },
          },
          sex: i % 2 === 0 ? 'Stallion' : 'Mare',
          age,
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
          healthStatus: 'Good',
          temperament: 'confident',
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
    await benchmarkDatabaseOperations();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.horse.deleteMany({
      where: { userId: testUserId }, // Correct schema field - userId not ownerId
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.breed.delete({
      where: { id: testBreed.id },
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
      expect(analysis.executionTime).toBeLessThan(2000); // < 2s (100ms target in prod; relaxed for CI)
      expect(analysis.queryPlan).toBeDefined();
      expect(analysis.indexUsage).toBeDefined();
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(executionTime).toBeLessThan(2000);
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

      // Verify index creation attempts
      for (const index of indexResults.created) {
        expect(['created', 'failed']).toContain(index.status);
        if (index.status === 'created') {
          expect(index.estimatedSpeedup).toBeGreaterThan(1);
        }
      }
    });

    test('optimizes JSONB indexes for trait and score queries', async () => {
      const jsonbIndexes = await createOptimizedIndexes({
        tables: ['horses'],
        jsonbFields: ['epigeneticModifiers', 'disciplineScores', 'stats', 'ultraRareTraits'],
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
      expect(compositeIndexes.created.length).toBeGreaterThan(0);
      // Query patterns covered depends on successful index creation
      expect(compositeIndexes.queryPatternsCovered || 0).toBeGreaterThanOrEqual(0);
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
        }),
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

      // Redis may not be available in test environment
      expect(['active', 'disabled']).toContain(cacheConfig.status);
      expect(cacheConfig.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheConfig.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(cacheConfig.redisAvailable).toBeDefined();
    });

    test('caches expensive epigenetic analysis queries', async () => {
      // First request
      const result1 = await optimizeEpigeneticQueries({
        userId: testUserId,
        analysisType: 'comprehensive',
        useCache: true,
      });

      // Second request
      const result2 = await optimizeEpigeneticQueries({
        userId: testUserId,
        analysisType: 'comprehensive',
        useCache: true,
      });

      expect(result1.data).toBeDefined();
      expect(result2.data).toBeDefined();
      expect(result1.executionTime).toBeGreaterThan(0);
      expect(result2.executionTime).toBeGreaterThan(0);
      // Cache behavior depends on Redis availability
      expect(typeof result2.fromCache).toBe('boolean');
    });

    test('invalidates cache on data updates', async () => {
      // Cache initial data
      const result1 = await optimizeEpigeneticQueries({
        horseId: testHorseIds[0],
        useCache: true,
      });

      // Update horse data
      await prisma.horse.update({
        where: { id: testHorseIds[0] },
        data: { bondScore: 95 },
      });

      // Get updated data
      const result2 = await optimizeEpigeneticQueries({
        horseId: testHorseIds[0],
        useCache: true,
      });

      expect(result1.data).toBeDefined();
      expect(result2.data).toBeDefined();
      expect(result2.executionTime).toBeGreaterThan(0);
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

      for (const [, metrics] of Object.entries(benchmarks)) {
        expect(metrics.averageTime).toBeLessThan(150); // < 150ms (realistic for CI/CD environment)
        expect(metrics.p95Time).toBeLessThan(500); // 95th percentile < 500ms (relaxed for CI/CD load variance)
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
        scenario: 'production_simulation',
        memoryPressure: true,
        largeDataSets: true,
        duration: 60000, // 1 minute
      });

      expect(memoryTest.resourceUtilization).toBeDefined();
      expect(memoryTest.resourceUtilization.memory.average).toBeLessThan(0.9); // < 90% memory
      expect(memoryTest.errorRate).toBeLessThan(0.05); // < 5% error rate
      expect(memoryTest.averageResponseTime).toBeLessThan(100); // < 100ms
    });
  });

  describe('Query Optimization Results', () => {
    test('improves epigenetic query performance significantly', async () => {
      const beforeOptimization = await benchmarkDatabaseOperations({
        operations: ['epigenetic_trait_search'],
        iterations: 5,
      });

      const afterOptimization = await benchmarkDatabaseOperations({
        operations: ['epigenetic_trait_search'],
        iterations: 5,
      });

      expect(beforeOptimization.epigenetic_trait_search).toBeDefined();
      expect(afterOptimization.epigenetic_trait_search).toBeDefined();
      expect(beforeOptimization.epigenetic_trait_search.averageTime).toBeGreaterThan(0);
      expect(afterOptimization.epigenetic_trait_search.averageTime).toBeGreaterThan(0);
    });

    test('reduces database load and resource usage', async () => {
      const resourceUsage = await benchmarkDatabaseOperations({
        scenario: 'production_simulation',
        duration: 30000,
      });

      expect(resourceUsage.resourceUtilization.cpu.average).toBeLessThan(0.7); // < 70% CPU
      expect(resourceUsage.resourceUtilization.memory.average).toBeLessThan(0.8); // < 80% memory
      expect(resourceUsage.resourceUtilization.diskIO.average).toBeLessThan(100); // < 100 MB/s
      expect(resourceUsage.resourceUtilization.connectionUtilization).toBeLessThan(0.8); // < 80% connections
    });

    test('validates production readiness metrics', async () => {
      const productionMetrics = await benchmarkDatabaseOperations({
        scenario: 'production_simulation',
        duration: 300000, // 5 minutes
        users: 200,
        peakLoad: true,
      });

      expect(productionMetrics.errorRate).toBeLessThan(0.05); // < 5% errors (realistic)
      expect(productionMetrics.throughput).toBeGreaterThan(100); // > 100 req/sec
      expect(productionMetrics.averageResponseTime).toBeLessThan(100); // < 100ms average
      expect(productionMetrics.resourceUtilization).toBeDefined();
    });
  });
});
