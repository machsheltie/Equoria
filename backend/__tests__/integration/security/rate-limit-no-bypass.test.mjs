/**
 * Integration Tests: Rate Limit Real-Path Coverage (No Bypass)
 *
 * Equoria-ocn9 — adversarial-audit Finding 4 fix.
 *
 * The audit identified that `rate-limit-circuit-breaker.test.mjs:211`
 * asserted behavior for the `x-test-bypass-rate-limit` header — a header
 * the production middleware (`rateLimiting.mjs:273`) explicitly does NOT
 * implement. That test gave false confidence ("the bypass works") when
 * really the limiter never tripped because each mock request had a
 * different rate-limit key.
 *
 * This file is the replacement: real Express app, real createRateLimiter,
 * real HTTP requests via supertest, fixed source IP. We prove three things:
 *
 *   1. The limiter actually returns HTTP 429 after the configured `max`
 *      requests, with a standard Retry-After / RateLimit-* header set.
 *
 *   2. Sending `x-test-bypass-rate-limit: true` does NOT increase the
 *      allowance — the bypass header is a no-op in production code.
 *
 *   3. Sending `x-test-bypass-auth: true` and other historical bypass
 *      headers also do not increase the allowance — proves the limiter
 *      doesn't honor any of the audit-flagged bypass headers.
 *
 * No bypass headers, no environment escape hatches, no mocking of the
 * limiter's internals. This is the readiness-evidence shape the 21R
 * doctrine requires.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../../middleware/rateLimiting.mjs';

const TEST_LIMITER_MAX = 3;
const TEST_LIMITER_WINDOW_MS = 60_000;

/**
 * Build a minimal Express app with a real createRateLimiter mounted on a
 * single test route. Using a fresh app (and a unique keyPrefix per test)
 * isolates rate-limit state between tests so they can run in any order.
 */
function buildAppWithLimiter(keyPrefix) {
  const app = express();
  // No Trust Proxy — supertest's req.ip will be 127.0.0.1 consistently,
  // which gives us a stable rate-limit key.
  const limiter = createRateLimiter({
    windowMs: TEST_LIMITER_WINDOW_MS,
    max: TEST_LIMITER_MAX,
    keyPrefix, // unique per test → no cross-test bleed
    useEnvOverride: false, // env knobs cannot loosen this limit
    message: 'Rate limit exceeded',
  });
  app.get('/probe', limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('Rate Limit — Real Path Without Bypass (Equoria-ocn9)', () => {
  describe('Hard limit enforcement', () => {
    it(`returns 429 after exactly ${TEST_LIMITER_MAX} requests, with rate-limit headers`, async () => {
      const app = buildAppWithLimiter('rl-no-bypass-hard');

      // First TEST_LIMITER_MAX requests should succeed.
      for (let i = 0; i < TEST_LIMITER_MAX; i++) {
        const res = await request(app).get('/probe');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
      }

      // The next request must be rejected with 429.
      const blocked = await request(app).get('/probe');
      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
      expect(blocked.body.message).toMatch(/rate limit exceeded/i);

      // RFC-compliant rate-limit headers must be present so clients know
      // when to retry. express-rate-limit standardHeaders=true emits
      // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset.
      expect(blocked.headers['ratelimit-limit']).toBeDefined();
      expect(blocked.headers['ratelimit-remaining']).toBe('0');
      expect(blocked.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Bypass headers are no-ops in production code', () => {
    const bypassHeaderCases = [
      'x-test-bypass-rate-limit',
      'x-test-skip-csrf',
      'x-test-bypass-auth',
      'x-test-bypass-ownership',
      'x-test-user',
    ];

    it.each(bypassHeaderCases)('sending %s does NOT extend the allowance beyond the configured max', async header => {
      const app = buildAppWithLimiter(`rl-no-bypass-${header}`);

      // Burn the entire allowance with the bypass header set.
      for (let i = 0; i < TEST_LIMITER_MAX; i++) {
        const res = await request(app).get('/probe').set(header, 'true');
        expect(res.status).toBe(200);
      }

      // Next request — also with the bypass header — must still be 429.
      // If the bypass were honored, this would return 200.
      const blocked = await request(app).get('/probe').set(header, 'true');
      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
    });

    it('sending all known bypass headers together does NOT extend the allowance', async () => {
      const app = buildAppWithLimiter('rl-no-bypass-combined');

      const headerSetter = req => {
        for (const h of bypassHeaderCases) {
          req = req.set(h, 'true');
        }
        return req;
      };

      for (let i = 0; i < TEST_LIMITER_MAX; i++) {
        const res = await headerSetter(request(app).get('/probe'));
        expect(res.status).toBe(200);
      }

      const blocked = await headerSetter(request(app).get('/probe'));
      expect(blocked.status).toBe(429);
    });
  });

  describe('Limiter survives an empty body / unauthenticated request', () => {
    // Reflects the most common attack shape: anonymous floods. There are
    // no auth headers or cookies — the limiter must still trip purely on IP.
    it('rejects anonymous flood with 429', async () => {
      const app = buildAppWithLimiter('rl-no-bypass-anon');

      for (let i = 0; i < TEST_LIMITER_MAX; i++) {
        const res = await request(app).get('/probe');
        expect(res.status).toBe(200);
      }
      const blocked = await request(app).get('/probe');
      expect(blocked.status).toBe(429);
    });
  });
});
