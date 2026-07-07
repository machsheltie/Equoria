/**
 * E2E-only rate-limit ceiling override — sentinel + sentinel-positive (Equoria-jz9v2)
 *
 * Context: the Playwright E2E CI job runs the whole suite (~27 min as of
 * 2026-07) from a single CI IP under NODE_ENV=beta with the REAL rate-limit
 * middleware + Redis in the path (Equoria-obwp intent). The aggregate request
 * volume exceeds the beta apiLimiter default (RATE_LIMIT_MAX_BY_ENV.beta =
 * 3000 / 15 min, sized for a ~7-min suite) within the rolling 15-min window,
 * producing a 429 cascade that fails unrelated auth/breeding/community/
 * conformation/feed specs (Equoria-jz9v2).
 *
 * Fix: an EXPLICIT, non-prod-only override env var (E2E_RATE_LIMIT_MAX) resolved
 * by `resolveE2eRateLimitMax` and wired into the app.mjs apiLimiter — WITHOUT
 * touching RATE_LIMIT_MAX_BY_ENV (whose defaults betaReadinessEnvSentinel
 * pins). This suite proves:
 *
 *   1. PURE RESOLUTION — the override is honored ONLY when explicitly set AND
 *      only in non-prod (beta/test/beta-readiness), never production, and only
 *      for a valid positive integer. Unset ⇒ env default (real-deploy path).
 *
 *   2. SOURCE PIN — app.mjs actually wires resolveE2eRateLimitMax into the
 *      apiLimiter with E2E_RATE_LIMIT_MAX + the RATE_LIMIT_MAX_BY_ENV default,
 *      and does NOT mutate the pinned map values. A future edit that drops the
 *      override (or hardcodes a bypass) fails here.
 *
 *   3. SENTINEL-POSITIVE (OPTIMAL_FIX_DISCIPLINE §2) — the override is a SCOPED
 *      CALIBRATION, not a blanket disable. A LOW override under a non-prod env
 *      produces a limiter that STILL FIRES 429 at that low ceiling (proving the
 *      limiter is real, not turned off), and a production env IGNORES the
 *      override at the HTTP level (the limiter uses the configured default, not
 *      the low override).
 *
 * The limiter-fires tests mirror the apiLimiter's real construction exactly:
 * `createRateLimiter({ ..., useEnvOverride: false })`, so the resolved `max` is
 * the effective cap (the TEST_RATE_LIMIT_* jest knobs do NOT apply when
 * useEnvOverride:false — same as the production apiLimiter). Real Express +
 * supertest + the real in-memory limiter store (jest disables Redis by design);
 * no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../middleware/rateLimiting.mjs';
import { resolveE2eRateLimitMax } from '../middleware/e2eRateLimitOverride.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const read = relPath => readFileSync(resolve(REPO_ROOT, relPath), 'utf8');

// The env-default caps used by app.mjs (RATE_LIMIT_MAX_BY_ENV). Referenced here
// only as the `configuredMax` the helper falls back to — NOT redefining them.
const BETA_DEFAULT = 3000;
const PROD_DEFAULT = 100;

describe('resolveE2eRateLimitMax — pure resolution (Equoria-jz9v2)', () => {
  describe('unset override ⇒ env default (every real deploy path)', () => {
    for (const nodeEnv of ['beta', 'test', 'beta-readiness', 'production', 'development']) {
      it(`${nodeEnv}: undefined envValue returns configuredMax unchanged`, () => {
        expect(resolveE2eRateLimitMax({ nodeEnv, envValue: undefined, configuredMax: 777 })).toBe(777);
      });
    }
    it('null / empty / whitespace-only envValue returns configuredMax', () => {
      expect(resolveE2eRateLimitMax({ nodeEnv: 'beta', envValue: null, configuredMax: BETA_DEFAULT })).toBe(
        BETA_DEFAULT,
      );
      expect(resolveE2eRateLimitMax({ nodeEnv: 'beta', envValue: '', configuredMax: BETA_DEFAULT })).toBe(BETA_DEFAULT);
      expect(resolveE2eRateLimitMax({ nodeEnv: 'beta', envValue: '   ', configuredMax: BETA_DEFAULT })).toBe(
        BETA_DEFAULT,
      );
    });
  });

  describe('explicit override honored in non-prod overridable envs', () => {
    for (const nodeEnv of ['beta', 'test', 'beta-readiness']) {
      it(`${nodeEnv}: '100000' returns 100000`, () => {
        expect(resolveE2eRateLimitMax({ nodeEnv, envValue: '100000', configuredMax: BETA_DEFAULT })).toBe(100000);
      });
      it(`${nodeEnv}: a LOW '2' returns 2 (override can lower as well as raise)`, () => {
        expect(resolveE2eRateLimitMax({ nodeEnv, envValue: '2', configuredMax: BETA_DEFAULT })).toBe(2);
      });
      it(`${nodeEnv}: whitespace-padded ' 5 ' parses to 5`, () => {
        expect(resolveE2eRateLimitMax({ nodeEnv, envValue: ' 5 ', configuredMax: BETA_DEFAULT })).toBe(5);
      });
    }
  });

  describe('production is NEVER overridable (posture unchanged by construction)', () => {
    it("production: '2' is ignored, returns configuredMax", () => {
      expect(resolveE2eRateLimitMax({ nodeEnv: 'production', envValue: '2', configuredMax: PROD_DEFAULT })).toBe(
        PROD_DEFAULT,
      );
    });
    it("production: '100000' is ignored, returns configuredMax", () => {
      expect(resolveE2eRateLimitMax({ nodeEnv: 'production', envValue: '100000', configuredMax: PROD_DEFAULT })).toBe(
        PROD_DEFAULT,
      );
    });
  });

  describe('non-overridable envs (development, unknown) ignore the override', () => {
    it("development: '100000' ignored (E2E runs under beta, not development)", () => {
      expect(resolveE2eRateLimitMax({ nodeEnv: 'development', envValue: '100000', configuredMax: 500 })).toBe(500);
    });
    it("unknown env: '100000' ignored", () => {
      expect(resolveE2eRateLimitMax({ nodeEnv: 'staging', envValue: '100000', configuredMax: 42 })).toBe(42);
    });
  });

  describe('invalid override values are ignored (fall back to configuredMax)', () => {
    for (const bad of ['abc', '0', '-5', '10.5', '3000abc', 'NaN', 'Infinity', '1e999']) {
      it(`beta: '${bad}' is rejected, returns configuredMax`, () => {
        expect(resolveE2eRateLimitMax({ nodeEnv: 'beta', envValue: bad, configuredMax: BETA_DEFAULT })).toBe(
          BETA_DEFAULT,
        );
      });
    }
  });
});

describe('apiLimiter override wiring — app.mjs source pin (Equoria-jz9v2)', () => {
  const appSrc = read('backend/app.mjs');

  it('app.mjs imports resolveE2eRateLimitMax from the e2e-override middleware', () => {
    expect(appSrc).toMatch(
      /import\s*\{[^}]*resolveE2eRateLimitMax[^}]*\}\s*from\s*'\.\/middleware\/e2eRateLimitOverride\.mjs'/,
    );
  });

  it('the apiLimiter max is resolved through resolveE2eRateLimitMax with E2E_RATE_LIMIT_MAX', () => {
    expect(appSrc).toMatch(/max:\s*resolveE2eRateLimitMax\(/);
    expect(appSrc).toContain('envValue: process.env.E2E_RATE_LIMIT_MAX');
    // The fallback default MUST remain the RATE_LIMIT_MAX_BY_ENV lookup — not a
    // hardcoded high number (that would be a bypass, not a scoped override).
    expect(appSrc).toMatch(/configuredMax:\s*RATE_LIMIT_MAX_BY_ENV\[process\.env\.NODE_ENV\]\s*\?\?\s*100/);
  });

  it('does NOT change the pinned RATE_LIMIT_MAX_BY_ENV defaults (beta 3000 / prod fallback 100)', () => {
    expect(appSrc).toMatch(/beta:\s*3000/);
    expect(appSrc).toMatch(/'beta-readiness':\s*1000/);
    // The override lives at the apiLimiter call site, not inside the map.
    expect(appSrc).not.toMatch(/beta:\s*100000/);
  });
});

describe('SENTINEL-POSITIVE: overridden limiter STILL FIRES (not a blanket disable)', () => {
  // Build a mini Express app whose limiter's max is resolved via the SAME
  // helper + SAME createRateLimiter construction as the real apiLimiter
  // (useEnvOverride:false), then drive real HTTP requests through it.
  function appWithLimiter(resolvedMax, keyPrefix) {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: resolvedMax,
      keyPrefix,
      useEnvOverride: false, // mirrors the real apiLimiter — TEST_RATE_LIMIT_* knobs do not apply
    });
    const app = express();
    app.get('/probe', limiter, (_req, res) => res.status(200).json({ ok: true }));
    return app;
  }

  it('(b) LOW override under NODE_ENV=beta → limiter 429s at the low ceiling', async () => {
    // Resolve exactly as app.mjs would, with a deliberately tiny override.
    const resolved = resolveE2eRateLimitMax({ nodeEnv: 'beta', envValue: '2', configuredMax: BETA_DEFAULT });
    expect(resolved).toBe(2); // sanity: override applied

    const app = appWithLimiter(resolved, 'rl:test-e2e-override-low');
    const r1 = await request(app).get('/probe');
    const r2 = await request(app).get('/probe');
    const r3 = await request(app).get('/probe');

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // The limiter is REAL: the 3rd request over the max=2 ceiling is rejected.
    expect(r3.status).toBe(429);
    expect(r3.body).toMatchObject({ success: false });
  });

  it('(c) production IGNORES the override → limiter uses the configured default, not the low override', async () => {
    // Same low '2' override value, but NODE_ENV=production ⇒ ignored ⇒ max=4.
    const resolved = resolveE2eRateLimitMax({ nodeEnv: 'production', envValue: '2', configuredMax: 4 });
    expect(resolved).toBe(4); // override ignored in production

    const app = appWithLimiter(resolved, 'rl:test-e2e-override-prod');
    // If the override had (wrongly) applied, the 3rd request would 429. It must
    // NOT — the first 4 requests pass (proving max=4, the configured default).
    for (let i = 1; i <= 4; i++) {
      const r = await request(app).get('/probe');
      expect(r.status).toBe(200);
    }
    // The 5th trips the real limiter at the configured default of 4.
    const r5 = await request(app).get('/probe');
    expect(r5.status).toBe(429);
  });
});
