/**
 * Anonymous /health and /ready payloads carry no internal detail
 * (Equoria-ht7qz).
 *
 * Defect: both probes are on the public router, yet /health and /ready sent
 * `environment` (NODE_ENV) and the Redis server version, and /ready on a DB
 * failure sent the raw driver message (which names host:port). Railway and CI
 * only read the status code, so none of that detail is needed by a caller.
 *
 * The healthy-path cases drive the real app through supertest. The failure
 * case gives the real readiness handler a real PrismaClient pointed at a port
 * nothing listens on, so the DB ping genuinely fails — no mocked Prisma.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../app.mjs';
import { PrismaClient } from '../../packages/database/prismaClient.mjs';
import { createReadyHandler } from '../config/healthHandlers.mjs';

const ORIGIN = 'http://localhost:3000';
const unreachableUrl = 'postgresql://probe:probe@127.0.0.1:1/equoria_unreachable?connect_timeout=2';

// The only fields an anonymous caller may see in the Redis block.
const allowedRedisKeys = ['connected', 'status'];

describe('anonymous health payloads (Equoria-ht7qz)', () => {
  const unreachableClient = new PrismaClient({
    datasources: { db: { url: unreachableUrl } },
    log: [],
    errorFormat: 'minimal',
  });

  afterAll(async () => {
    await unreachableClient.$disconnect();
  });

  it('GET /health omits environment and Redis version/error detail', async () => {
    const res = await request(app).get('/health').set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).not.toHaveProperty('environment');
    expect(Object.keys(res.body.services.redis).sort()).toEqual(allowedRedisKeys);
  });

  it('GET /ready omits environment and Redis version/error detail', async () => {
    const res = await request(app).get('/ready').set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body).not.toHaveProperty('environment');
    expect(Object.keys(res.body.services.redis).sort()).toEqual(allowedRedisKeys);
  });

  it('a failed readiness ping answers 503 with no driver error text', async () => {
    const probeApp = express();
    probeApp.get('/ready', createReadyHandler({ db: unreachableClient }));

    const res = await request(probeApp).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Database unreachable');
    expect(res.body.services.database).toEqual({ status: 'unhealthy' });
    expect(res.body).not.toHaveProperty('environment');
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
  }, 30000);
});
