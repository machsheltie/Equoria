/**
 * databaseOptimizationService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * All tests are pure-path: real DB, non-existent IDs (queries return empty, not throw).
 * No DB fixture required — Redis is always disabled in test environment
 * (NODE_ENV=test bypasses initializeRedis).
 *
 * analyzeQueryPerformance:
 *   'epigenetic_trait_search' → analyzeEpigeneticTraitQuery path
 *   'jsonb_discipline_scores' → analyzeJsonbQuery path
 *   'user_horses_with_results' → analyzeComplexJoinQuery path
 *   unknown queryType → throws 'Unknown query type'
 *
 * createOptimizedIndexes:
 *   queryPatterns only → creates B-tree indexes per pattern
 *   jsonbFields only → creates GIN indexes via fieldMapping
 *   compositePatterns only → creates composite indexes
 *   all three options → all three index types created
 *   empty options → returns empty created array
 *
 * implementConnectionPooling:
 *   action='status' → returns active/idle connection counts
 *   action='lifecycle_test' → returns lifecycle stats
 *   default (configure) → returns status='configured'
 *
 * setupQueryCaching:
 *   in test env → Redis always disabled → status='disabled', redisAvailable=false
 *
 * optimizeEpigeneticQueries:
 *   userId branch → calls executeUserEpigeneticAnalysis
 *   horseId branch → calls executeHorseEpigeneticAnalysis
 *   useCache=true with no redisClient → skips cache, executes query
 *
 * benchmarkDatabaseOperations:
 *   operations array → benchmarks each operation
 *   concurrentUsers → benchmarkConcurrentLoad
 *   scenario='production_simulation' → benchmarkProductionScenario
 *   default (no options) → default benchmark stats
 */

import { describe, it, expect } from '@jest/globals';
import {
  analyzeQueryPerformance,
  createOptimizedIndexes,
  implementConnectionPooling,
  setupQueryCaching,
  optimizeEpigeneticQueries,
  benchmarkDatabaseOperations,
} from '../services/databaseOptimizationService.mjs';

// ── analyzeQueryPerformance ───────────────────────────────────────────────────

describe('analyzeQueryPerformance — epigenetic_trait_search branch', () => {
  it('returns result without throwing for non-existent userId', async () => {
    const result = await analyzeQueryPerformance({
      queryType: 'epigenetic_trait_search',
      userId: '00000000-0000-0000-0000-000000000000',
      filters: { minAge: 3, traits: ['BRAVE'] },
    });
    expect(result.queryType).toBe('epigenetic_trait_search');
    expect(typeof result.executionTime).toBe('number');
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.indexUsage).toBeDefined();
  });
});

describe('analyzeQueryPerformance — jsonb_discipline_scores branch', () => {
  it('returns result with JSONB optimization info', async () => {
    const result = await analyzeQueryPerformance({
      queryType: 'jsonb_discipline_scores',
      userId: '00000000-0000-0000-0000-000000000000',
      filters: { minScore: 50 },
    });
    expect(result.queryType).toBe('jsonb_discipline_scores');
    expect(Array.isArray(result.jsonbOptimizations)).toBe(true);
    expect(Array.isArray(result.indexRecommendations)).toBe(true);
    expect(typeof result.queryComplexity).toBe('number');
  });
});

describe('analyzeQueryPerformance — user_horses_with_results branch', () => {
  it('returns result with join optimization info', async () => {
    const result = await analyzeQueryPerformance({
      queryType: 'user_horses_with_results',
      userId: '00000000-0000-0000-0000-000000000000',
      includeRelations: ['breed'],
    });
    expect(result.queryType).toBe('user_horses_with_results');
    expect(Array.isArray(result.joinOptimizations)).toBe(true);
    expect(Array.isArray(result.nPlusOneRisks)).toBe(true);
  });
});

describe('analyzeQueryPerformance — unknown queryType', () => {
  it('throws for unknown queryType', async () => {
    await expect(analyzeQueryPerformance({ queryType: 'unknown_type' })).rejects.toThrow('Unknown query type');
  });
});

// ── analyzeQueryPerformance — calculateAverageTime existing-entry branch (line 513) ──

describe('analyzeQueryPerformance — calculateAverageTime existing-entry branch', () => {
  it('returns valid result on second call for same queryType (hits averaged-time path)', async () => {
    // Second call for 'epigenetic_trait_search' — performanceMetrics already has an entry
    // from the earlier describe block, so calculateAverageTime hits the else branch (line 513)
    const result = await analyzeQueryPerformance({
      queryType: 'epigenetic_trait_search',
      userId: '00000000-0000-0000-0000-000000000000',
      filters: { minAge: 0 },
    });
    expect(result.queryType).toBe('epigenetic_trait_search');
    expect(typeof result.executionTime).toBe('number');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});

// ── createOptimizedIndexes ────────────────────────────────────────────────────

describe('createOptimizedIndexes — queryPatterns branch', () => {
  it('creates B-tree indexes from queryPatterns', async () => {
    // Equoria-gyxfd schema-drift fix: queryPatterns are semantic LABELS
    // mapped (via QUERY_PATTERN_INDEX) to CREATE INDEX statements against
    // REAL `horses` columns — they are NOT raw column names. `'name'` is
    // not a mapped label (the old assertion silently produced 0 indexes).
    // Use `user_horse_lookup`, the canonical B-tree label that targets the
    // real owning FK column `"userId"`.
    const result = await createOptimizedIndexes({
      queryPatterns: ['user_horse_lookup'],
    });
    expect(Array.isArray(result.created)).toBe(true);
    expect(result.created.length).toBeGreaterThanOrEqual(1);
    const statuses = result.created.map(i => i.status);
    expect(statuses.every(s => s === 'created' || s === 'failed')).toBe(true);
    expect(result.queryPatternsCovered).toBe(1);
  });
});

describe('createOptimizedIndexes — jsonbFields branch', () => {
  it('creates GIN indexes from jsonbFields (fieldMapping applied)', async () => {
    const result = await createOptimizedIndexes({
      jsonbFields: ['epigenetic_flags', 'discipline_scores'],
    });
    const ginIndexes = result.ginIndexes;
    expect(Array.isArray(ginIndexes)).toBe(true);
    expect(ginIndexes.length).toBeGreaterThanOrEqual(1);
    expect(ginIndexes[0].query).toContain('GIN');
  });
});

describe('createOptimizedIndexes — compositePatterns branch', () => {
  it('creates composite indexes from compositePatterns', async () => {
    const result = await createOptimizedIndexes({
      compositePatterns: [['userId', 'age']],
    });
    const btreeIndexes = result.btreeIndexes;
    expect(Array.isArray(btreeIndexes)).toBe(true);
    // Equoria-gyxfd schema-drift fix: the Horse owning FK is `userId`, NOT
    // `ownerId`. The columnMapping now resolves the `userId`/`ownerId`
    // label aliases to the REAL quoted column `"userId"`, so the emitted
    // composite index targets `"userId"` (not the non-existent `ownerId`).
    const hasComposite = btreeIndexes.some(i => i.query.includes('userId'));
    expect(hasComposite).toBe(true);
  });
});

describe('createOptimizedIndexes — empty options', () => {
  it('returns empty created array when no options provided', async () => {
    const result = await createOptimizedIndexes({});
    expect(result.created).toHaveLength(0);
    expect(result.queryPatternsCovered).toBe(0);
  });
});

describe('createOptimizedIndexes — all three options', () => {
  it('creates all index types and returns performanceGains', async () => {
    const result = await createOptimizedIndexes({
      // Equoria-gyxfd: use a mapped pattern label (not the raw column name
      // `'name'`, which maps to nothing) so the queryPatterns branch
      // actually emits an index and the three-types-each ≥3 count holds.
      queryPatterns: ['user_horse_lookup'],
      jsonbFields: ['epigenetic_flags'],
      compositePatterns: [['userId', 'age']],
    });
    expect(result.created.length).toBeGreaterThanOrEqual(3);
    expect(result.performanceImpact).toBeDefined();
    expect(result.performanceGains).toBeDefined();
    expect(typeof result.performanceGains.querySpeedup).toBe('string');
  });
});

// ── implementConnectionPooling ────────────────────────────────────────────────

describe('implementConnectionPooling — status branch', () => {
  it('returns connection counts for action="status"', async () => {
    const result = await implementConnectionPooling({ action: 'status' });
    expect(result.activeConnections).toBe(5);
    expect(result.idleConnections).toBe(3);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

describe('implementConnectionPooling — lifecycle_test branch', () => {
  it('returns lifecycle stats for action="lifecycle_test"', async () => {
    const result = await implementConnectionPooling({ action: 'lifecycle_test' });
    expect(result.connectionsCreated).toBe(10);
    expect(result.connectionsDestroyed).toBe(8);
    expect(result.leakedConnections).toBe(0);
    expect(typeof result.averageConnectionTime).toBe('number');
  });
});

describe('implementConnectionPooling — default configure branch', () => {
  it('returns status="configured" with pool metrics', async () => {
    const result = await implementConnectionPooling({ maxConnections: 15, minConnections: 3 });
    expect(result.status).toBe('configured');
    expect(result.activeConnections).toBe(5);
    expect(typeof result.performanceMetrics.poolEfficiency).toBe('number');
  });
});

// ── setupQueryCaching ─────────────────────────────────────────────────────────

describe('setupQueryCaching — Redis disabled in test environment', () => {
  it('returns status="disabled" when Redis is unavailable (NODE_ENV=test)', async () => {
    const result = await setupQueryCaching({ ttl: 300 });
    expect(result.status).toBe('disabled');
    expect(result.redisAvailable).toBe(false);
    expect(result.hitRate).toBe(0);
    expect(result.memoryUsage).toBe(0);
  });

  it('uses provided ttl when Redis disabled', async () => {
    const result = await setupQueryCaching({ ttl: 600 });
    expect(result.ttl).toBe(600);
  });
});

// ── optimizeEpigeneticQueries ─────────────────────────────────────────────────

describe('optimizeEpigeneticQueries — userId branch', () => {
  it('calls executeUserEpigeneticAnalysis for userId option', async () => {
    const result = await optimizeEpigeneticQueries({ userId: '00000000-0000-0000-0000-000000000000' });
    expect(result.fromCache).toBe(false);
    expect(typeof result.executionTime).toBe('number');
    expect(result.data).toBeDefined();
    expect(result.data.analysisType).toBe('user_epigenetic');
    expect(Array.isArray(result.data.horses)).toBe(true);
  });
});

describe('optimizeEpigeneticQueries — horseId branch', () => {
  it('calls executeHorseEpigeneticAnalysis for horseId option', async () => {
    const result = await optimizeEpigeneticQueries({ horseId: 999999999 });
    expect(result.fromCache).toBe(false);
    expect(result.data.analysisType).toBe('horse_epigenetic');
    // horse=null for non-existent ID; structure still returned
    expect(Object.prototype.hasOwnProperty.call(result.data, 'horse')).toBe(true);
  });
});

describe('optimizeEpigeneticQueries — useCache=true with no redisClient', () => {
  it('skips cache path and executes query normally (redisClient=null in test env)', async () => {
    const result = await optimizeEpigeneticQueries({ userId: '00000000-0000-0000-0000-000000000000', useCache: true });
    // No Redis in test env → fromCache=false, still executes query
    expect(result.fromCache).toBe(false);
    expect(result.data.analysisType).toBe('user_epigenetic');
  });
});

// ── benchmarkDatabaseOperations ───────────────────────────────────────────────

describe('benchmarkDatabaseOperations — operations array branch', () => {
  it('benchmarks each operation and returns results map', async () => {
    const result = await benchmarkDatabaseOperations({
      operations: ['count'],
      iterations: 2,
    });
    expect(result.count).toBeDefined();
    expect(result.count.operation).toBe('count');
    expect(typeof result.count.averageTime).toBe('number');
    expect(result.count.errorRate).toBe(0);
  });
});

describe('benchmarkDatabaseOperations — concurrentUsers branch', () => {
  it('returns concurrent load stats for concurrentUsers option', async () => {
    const result = await benchmarkDatabaseOperations({
      concurrentUsers: 5,
      requestsPerUser: 4,
    });
    expect(result.totalRequests).toBe(20); // 5 * 4
    expect(result.successRate).toBeCloseTo(0.999);
    expect(typeof result.averageResponseTime).toBe('number');
  });
});

describe('benchmarkDatabaseOperations — production_simulation branch', () => {
  it('returns production scenario stats', async () => {
    const result = await benchmarkDatabaseOperations({
      scenario: 'production_simulation',
    });
    expect(result.scenario).toBe('production_simulation');
    expect(result.uptime).toBeGreaterThan(0.99);
    expect(result.responseTime.p99).toBeDefined();
    expect(result.resourceUtilization.cpu.average).toBeDefined();
  });
});

describe('benchmarkDatabaseOperations — default (no options)', () => {
  it('returns default benchmark stats when called with no options', async () => {
    const result = await benchmarkDatabaseOperations();
    expect(typeof result.averageQueryTime).toBe('number');
    expect(typeof result.p95QueryTime).toBe('number');
    expect(typeof result.p99QueryTime).toBe('number');
    expect(result.errorRate).toBe(0);
  });
});

// == Equoria-qhogt: prototype-chain bypass sentinel (SECURITY) ==
//
// These tests prove that prototype-inherited keys ('constructor', '__proto__')
// can NEVER bypass the allowlist checks and produce injected DDL.
//
// Tests operate ENTIRELY on return values -- they NEVER execute malicious
// SQL against the DB. The fix must skip prototype keys at generation time,
// before any query is pushed to indexQueries[].

describe('createOptimizedIndexes -- prototype-chain bypass sentinel (Equoria-qhogt)', () => {
  // compositePatterns path
  it('compositePatterns: skips constructor key -- no injected function in query string', async () => {
    const result = await createOptimizedIndexes({
      compositePatterns: [['constructor']],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  it('compositePatterns: skips __proto__ key -- no injected content in query string', async () => {
    const result = await createOptimizedIndexes({
      compositePatterns: [['__proto__']],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  it('compositePatterns: mixed real+prototype -- whole pattern skipped, no injected content', async () => {
    const result = await createOptimizedIndexes({
      compositePatterns: [['userId', 'constructor']],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  // jsonbFields path
  it('jsonbFields: skips constructor key -- no injected function in GIN query string', async () => {
    const result = await createOptimizedIndexes({
      jsonbFields: ['constructor'],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  it('jsonbFields: skips __proto__ key -- no injected content in GIN query string', async () => {
    const result = await createOptimizedIndexes({
      jsonbFields: ['__proto__'],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  it('jsonbFields: mixed real+prototype -- real field succeeds, prototype key is skipped', async () => {
    const result = await createOptimizedIndexes({
      jsonbFields: ['epigeneticFlags', 'constructor'],
    });
    const ginEntries = result.created.filter(e => (e.query || '').includes('GIN'));
    expect(ginEntries.length).toBeGreaterThanOrEqual(1);
    expect(ginEntries[0].query).toContain('"epigeneticFlags"');
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
  });

  // queryPatterns path
  it('queryPatterns: skips __proto__ key -- no injected object content in query string', async () => {
    const result = await createOptimizedIndexes({
      queryPatterns: ['__proto__'],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype') ||
        (entry.query || '').includes('[object'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  it('queryPatterns: skips constructor key -- no injected function in query string', async () => {
    const result = await createOptimizedIndexes({
      queryPatterns: ['constructor'],
    });
    const badEntries = result.created.filter(
      entry =>
        (entry.query || '').includes('function') ||
        (entry.query || '').includes('[native code]') ||
        (entry.query || '').includes('prototype'),
    );
    expect(badEntries).toHaveLength(0);
    expect(result.created).toHaveLength(0);
  });

  // positive regression: real columns/patterns still work
  it('positive regression: jsonbFields epigeneticFlags still generates valid GIN index', async () => {
    const result = await createOptimizedIndexes({
      jsonbFields: ['epigeneticFlags'],
    });
    expect(result.created.length).toBeGreaterThanOrEqual(1);
    const gin = result.created.find(e => (e.query || '').includes('GIN'));
    expect(gin).toBeDefined();
    expect(gin.query).toContain('"epigeneticFlags"');
    expect(gin.query).not.toMatch(/function|native code|prototype/);
  });

  it('positive regression: compositePatterns userId+breedId still generates valid composite index', async () => {
    const result = await createOptimizedIndexes({
      compositePatterns: [['userId', 'breedId']],
    });
    expect(result.created.length).toBeGreaterThanOrEqual(1);
    const composite = result.created.find(e => (e.query || '').includes('"userId"'));
    expect(composite).toBeDefined();
    expect(composite.query).toContain('"breedId"');
    expect(composite.query).not.toMatch(/function|native code|prototype/);
  });

  it('positive regression: queryPattern user_horse_lookup still generates valid B-tree index', async () => {
    const result = await createOptimizedIndexes({
      queryPatterns: ['user_horse_lookup'],
    });
    expect(result.created.length).toBeGreaterThanOrEqual(1);
    const idx = result.created.find(e => (e.query || '').includes('user_horse_lookup'));
    expect(idx).toBeDefined();
    expect(idx.query).toContain('"userId"');
    expect(idx.query).not.toMatch(/function|native code|prototype/);
  });
});
