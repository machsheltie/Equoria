/**
 * Anonymous /ping/health and /ping/health/redis carry no internal detail
 * (Equoria-xxu52).
 *
 * Defect: the ping router is mounted on the public router, yet /ping/health
 * sent `environment` (NODE_ENV), `version` (npm_package_version) and, on a DB
 * failure, the raw driver message (which names host:port); /ping/health/redis
 * sent circuit-breaker metrics, cache hit/miss/error counters and Redis server
 * internals. Owner ruling 2026-10-22: lock both down like /health and /ready
 * (Equoria-ht7qz) — no environment, version, error text or cache internals for
 * anonymous callers.
 *
 * The healthy-path cases drive the real app through supertest. The failure
 * case gives the real health-check handler a real PrismaClient pointed at a
 * port nothing listens on, so the DB ping genuinely fails — no mocked Prisma.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../app.mjs';
import { PrismaClient } from '../../packages/database/prismaClient.mjs';
import { createHealthCheckHandler } from '../modules/health/controllers/pingController.mjs';

const ORIGIN = 'http://localhost:3000';
const unreachableUrl = 'postgresql://probe:probe@127.0.0.1:1/equoria_unreachable?connect_timeout=2';

describe('anonymous /ping health payloads (Equoria-xxu52)', () => {
  const unreachableClient = new PrismaClient({
    datasources: { db: { url: unreachableUrl } },
    log: [],
    errorFormat: 'minimal',
  });

  afterAll(async () => {
    await unreachableClient.$disconnect();
  });

  it('GET /ping/health omits environment, version and Redis internals', async () => {
    const res = await request(app).get('/ping/health').set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toHaveProperty('environment');
    expect(res.body.data).not.toHaveProperty('version');
    expect(res.body.data.services.database.status).toBe('healthy');
    expect(Object.keys(res.body.data.services.redis).sort()).toEqual(['available', 'status']);
  });

  it('GET /ping/health/redis omits cache counters, circuit metrics and Redis info', async () => {
    const res = await request(app).get('/ping/health/redis').set('Origin', ORIGIN);

    // Redis is skipped under test, so the probe reports unavailable (503).
    expect([200, 503]).toContain(res.status);
    expect(Object.keys(res.body.data).sort()).toEqual(['redis', 'status', 'timestamp']);
    expect(Object.keys(res.body.data.redis).sort()).toEqual(['available', 'connected']);
  });

  it('a failed /ping/health DB ping answers 503 with no driver error text', async () => {
    const probeApp = express();
    probeApp.get('/ping/health', createHealthCheckHandler({ db: unreachableClient }));

    const res = await request(probeApp).get('/ping/health');

    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Service unhealthy');
    expect(res.body.data.services.database).toEqual({ status: 'unhealthy' });
    expect(res.body.data).not.toHaveProperty('environment');
    expect(res.body.data).not.toHaveProperty('version');
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
  }, 30000);
});
