/**
 * Bypass-header hardening sentinel — Equoria-v0d6
 *
 * Confirms that x-test-skip-csrf and x-test-bypass-rate-limit are
 * completely hardened out of the CSRF and rate-limiting middleware.
 *
 * Complements rate-limit-no-bypass.test.mjs (full real-app path).
 * This file tests the middleware functions directly — structural
 * source-code assertions PLUS behavioural at the handler level.
 *
 * 6 tests:
 *   1. Structural: csrf.mjs contains no x-test-skip-csrf reference
 *   2. Behavioural: POST with x-test-skip-csrf:1 but no token → 403
 *   3. Behavioural positive control: valid CSRF token allows the request
 *   4. Structural: rateLimiting.mjs contains no x-test-bypass-rate-limit reference
 *   5. Behavioural: x-test-bypass-rate-limit:1 does not prevent counter decrement
 *   6. Behavioural positive control: TEST_RATE_LIMIT_MAX_REQUESTS env-knob caps requests
 *
 * @module __tests__/middleware/bypassHeaderHardening
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

import { csrfProtection, csrfErrorHandler, issueCsrfToken } from '../../middleware/csrf.mjs';
import { createRateLimiter } from '../../middleware/rateLimiting.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIDDLEWARE_DIR = join(__dirname, '../../middleware');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCsrfApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  // Issue a real CSRF token so tests can acquire one when needed
  app.get('/csrf-token', (req, res) => {
    const token = issueCsrfToken(req, res);
    res.json({ csrfToken: token });
  });
  app.post('/protected', csrfProtection, (_req, res) => {
    res.json({ success: true });
  });
  app.use(csrfErrorHandler);
  return app;
}

// 24-bit FNV-1a hash across RFC 5737 test ranges → per-test unique rate-limit bucket
const TEST_NET_RANGES = ['192.0.2', '198.51.100', '203.0.113'];
function uniqueTestIp(label) {
  let hash = 2166136261;
  for (let i = 0; i < label.length; i++) {
    hash = Math.imul(hash ^ label.charCodeAt(i), 16777619) >>> 0;
  }
  const range = TEST_NET_RANGES[hash % TEST_NET_RANGES.length];
  const o3 = (hash >>> 8) & 0xff;
  const o4 = (((hash >>> 16) & 0xff) % 254) + 1;
  return `${range}.${o3}.${o4}`;
}

function buildRateLimitApp(limiter) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.get('/probe', limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

// ─── 1. CSRF structural ───────────────────────────────────────────────────────

describe('csrf.mjs — structural: no bypass-header awareness in source (Equoria-v0d6)', () => {
  it('csrf.mjs source contains no x-test-skip-csrf or any bypass path', () => {
    const src = readFileSync(join(MIDDLEWARE_DIR, 'csrf.mjs'), 'utf8');
    expect(src).not.toContain('x-test-skip-csrf');
    expect(src).not.toContain('skipCsrf');
    expect(src).not.toContain('bypassCsrf');
    expect(src).not.toContain('NODE_ENV');
  });
});

// ─── 2 & 3. CSRF behavioural ─────────────────────────────────────────────────

describe('csrfProtection — x-test-skip-csrf header is ignored (Equoria-v0d6)', () => {
  it('POST with x-test-skip-csrf:1 but no CSRF token is rejected 403 (beta/production parity)', async () => {
    const app = buildCsrfApp();
    const res = await request(app).post('/protected').set('x-test-skip-csrf', '1').send({ action: 'test' });
    expect(res.status).toBe(403);
  });

  it('positive control: POST with valid CSRF cookie + token succeeds', async () => {
    const app = buildCsrfApp();
    const agent = request.agent(app);

    const tokenRes = await agent.get('/csrf-token');
    expect(tokenRes.status).toBe(200);
    const { csrfToken } = tokenRes.body;
    expect(typeof csrfToken).toBe('string');
    expect(csrfToken.length).toBeGreaterThan(0);

    const res = await agent.post('/protected').set('x-csrf-token', csrfToken).send({ action: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── 4. Rate-limit structural ─────────────────────────────────────────────────

describe('rateLimiting.mjs — structural: no x-test-bypass-rate-limit in source (Equoria-v0d6)', () => {
  it('rateLimiting.mjs source contains no x-test-bypass-rate-limit or per-request bypass logic', () => {
    const src = readFileSync(join(MIDDLEWARE_DIR, 'rateLimiting.mjs'), 'utf8');
    expect(src).not.toContain('x-test-bypass-rate-limit');
    expect(src).not.toContain('bypassRateLimit');
    // Per-request bypass via headers would need to read the header — confirm absent
    expect(src).not.toContain("headers['x-test-");
    expect(src).not.toContain('headers["x-test-');
  });
});

// ─── 5 & 6. Rate-limit behavioural ───────────────────────────────────────────

describe('createRateLimiter — x-test-bypass-rate-limit header is ignored (Equoria-v0d6)', () => {
  let prevMax;
  let prevWindow;

  beforeEach(() => {
    prevMax = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
    prevWindow = process.env.TEST_RATE_LIMIT_WINDOW_MS;
    process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '5';
    process.env.TEST_RATE_LIMIT_WINDOW_MS = '60000';
  });

  afterEach(() => {
    if (prevMax === undefined) {
      delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.TEST_RATE_LIMIT_MAX_REQUESTS = prevMax;
    }
    if (prevWindow === undefined) {
      delete process.env.TEST_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.TEST_RATE_LIMIT_WINDOW_MS = prevWindow;
    }
  });

  it('x-test-bypass-rate-limit:1 does not prevent the rate-limit counter from decrementing', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1000, keyPrefix: 'bharden-bypass' });
    const app = buildRateLimitApp(limiter);
    const ip = uniqueTestIp('bharden-bypass-decrement');

    // Request 1 — no bypass header, establishes baseline
    const r1 = await request(app).get('/probe').set('X-Forwarded-For', ip);
    expect(r1.status).toBe(200);
    const remaining1 = parseInt(r1.headers['ratelimit-remaining'], 10);
    expect(Number.isFinite(remaining1)).toBe(true);

    // Request 2 — WITH bypass header, must still decrement
    const r2 = await request(app).get('/probe').set('X-Forwarded-For', ip).set('x-test-bypass-rate-limit', '1');
    expect(r2.status).toBe(200);
    const remaining2 = parseInt(r2.headers['ratelimit-remaining'], 10);
    expect(Number.isFinite(remaining2)).toBe(true);

    // If the bypass header had any effect, remaining2 would not decrease
    expect(remaining2).toBeLessThan(remaining1);
  });

  it('TEST_RATE_LIMIT_MAX_REQUESTS=5 caps requests to 5 (positive control for env-knob)', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10000, keyPrefix: 'bharden-posctrl' });
    const app = buildRateLimitApp(limiter);
    const ip = uniqueTestIp('bharden-posctrl-env-knob');

    let blocked = null;
    for (let i = 0; i < 9; i++) {
      const r = await request(app).get('/probe').set('X-Forwarded-For', ip);
      if (r.status === 429) {
        blocked = r;
        break;
      }
    }
    expect(blocked).not.toBeNull();
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  });
});
