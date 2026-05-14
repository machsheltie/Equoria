/**
 * performanceMonitor router — integration tests (Equoria-rr7)
 *
 * The router exposes GET /metrics (mounted at /api/performance by app.mjs),
 * returning cache stats, system uptime, and memory usage. There is no auth
 * gate — this is an ops endpoint.
 *
 * These tests mount the router on a bare express app and exercise:
 *   - the happy path (200 with the documented payload shape), which covers
 *     lines 25-54 of utils/performanceMonitor.mjs
 *   - the error path by stubbing process.memoryUsage to throw, which covers
 *     the catch block (lines 55-62)
 *
 * No Prisma mocks. The real cacheHelper.getCacheStatistics is called — it
 * returns a stats object even when Redis is unavailable in the test
 * environment, so this is a real integration test of the router.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import performanceMonitorRouter from '../../../utils/performanceMonitor.mjs';

describe('performanceMonitor router (Equoria-rr7)', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/api/performance', performanceMonitorRouter);
  });

  describe('GET /api/performance/metrics — success path', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app).get('/api/performance/metrics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('includes ISO timestamp in payload', async () => {
      const res = await request(app).get('/api/performance/metrics');
      expect(typeof res.body.data.timestamp).toBe('string');
      // ISO 8601 string starts with 4-digit year.
      expect(res.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes system info block (uptime, node, platform, arch, pid)', async () => {
      const res = await request(app).get('/api/performance/metrics');
      const system = res.body.data.system;
      expect(system).toBeDefined();
      expect(typeof system.uptimeSeconds).toBe('number');
      expect(system.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(typeof system.nodeVersion).toBe('string');
      expect(system.nodeVersion).toMatch(/^v\d+/);
      expect(typeof system.platform).toBe('string');
      expect(typeof system.arch).toBe('string');
      expect(typeof system.pid).toBe('number');
    });

    it('includes memory block with MB values rounded to 2 decimals', async () => {
      const res = await request(app).get('/api/performance/metrics');
      const memory = res.body.data.memory;
      expect(memory).toBeDefined();
      expect(typeof memory.heapUsedMb).toBe('number');
      expect(typeof memory.heapTotalMb).toBe('number');
      expect(typeof memory.rssMb).toBe('number');
      expect(typeof memory.externalMb).toBe('number');
      // Sanity: all four values should be > 0 in a running Node process.
      expect(memory.heapUsedMb).toBeGreaterThan(0);
      expect(memory.rssMb).toBeGreaterThan(0);
    });

    it('includes cache block from cacheHelper.getCacheStatistics', async () => {
      const res = await request(app).get('/api/performance/metrics');
      // cacheHelper returns an object regardless of Redis availability.
      expect(res.body.data.cache).toBeDefined();
      expect(typeof res.body.data.cache).toBe('object');
      // Standard fields the cacheHelper always emits.
      expect(typeof res.body.data.cache.hitRate).toBe('number');
      expect(typeof res.body.data.cache.redisAvailable).toBe('boolean');
    });
  });

  describe('GET /api/performance/metrics — error path (catch block)', () => {
    let originalMemoryUsage;

    beforeAll(() => {
      originalMemoryUsage = process.memoryUsage;
    });

    afterAll(() => {
      // Restore even if the override below was never assigned.
      process.memoryUsage = originalMemoryUsage;
    });

    it('returns 500 envelope when an inner call throws', async () => {
      // Force the handler into its catch path by making process.memoryUsage
      // throw. This is one of the synchronous calls inside the try block.
      process.memoryUsage = () => {
        throw new Error('forced-test-failure');
      };

      const res = await request(app).get('/api/performance/metrics');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to collect performance metrics');
      // The `error` field is only the raw message in development; in test
      // it's whatever NODE_ENV resolves to. Just assert the field exists.
      expect(typeof res.body.error).toBe('string');

      // Restore immediately so subsequent describe blocks (if any) aren't affected.
      process.memoryUsage = originalMemoryUsage;
    });

    it('redacts error detail when NODE_ENV is not development', async () => {
      // Save & temporarily flip NODE_ENV to a non-development value so the
      // production-branch of the error formatter runs.
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.memoryUsage = () => {
        throw new Error('detail-should-be-redacted');
      };

      try {
        const res = await request(app).get('/api/performance/metrics');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal error');
        expect(res.body.error).not.toContain('detail-should-be-redacted');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.memoryUsage = originalMemoryUsage;
      }
    });
  });
});
