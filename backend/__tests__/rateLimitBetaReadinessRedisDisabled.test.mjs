/**
 * Beta-Readiness "Redis intentionally disabled" sentinel (Equoria-kunx5)
 *
 * ── Root cause ────────────────────────────────────────────────────────────
 * The beta-readiness gate (playwright.beta-readiness.config.ts + CI
 * .github/workflows/test.yml `beta-readiness-gate`) runs the backend under
 * NODE_ENV=beta-readiness with Postgres ONLY — no Redis service, and
 * REDIS_DISABLED unset. Before the kunx5 fix, `redisIntentionallyDisabled()`
 * recognised only NODE_ENV==='test' (or JEST_WORKER_ID / REDIS_DISABLED), so
 * under 'beta-readiness' it returned false → redisExpected=true while Redis was
 * down → the failClosed economy limiter `financialRateLimiter` (and its five
 * sibling routes: crafting/craft, farrier/book, feedShop/purchase,
 * tackShop/purchase, vet/book) returned HTTP 503 on EVERY economy mutation.
 * The E2E surfaced it first at POST /api/v1/bank/claim — the first economy
 * mutation the readiness suite hits (route-families.spec.ts:73,
 * bank-claim-reward.spec.ts:41).
 *
 * ── The fix ───────────────────────────────────────────────────────────────
 * `redisIntentionallyDisabled()` returns true for NODE_ENV==='beta-readiness'
 * (like 'test') — the gate is a single-process, no-Redis profile whose
 * documented intent (env.beta-readiness.example: "Same as env.test but
 * NODE_ENV=beta-readiness") is to behave like test w.r.t. infrastructure it
 * does not provision. This makes redisExpected=false → no fail-closed 503.
 *
 * ── SECURITY INVARIANT (the crux — this touches a fail-closed control) ─────
 * production AND beta MUST STILL fail closed on a real Redis outage. The fix
 * exempts ONLY the two single-process, no-Redis gate envs (test,
 * beta-readiness). This file's most important assertions are the two that
 * prove production + beta are UNCHANGED.
 *
 * Pure-function + DI tests. No mocks of controllers/services/DB (Constitution §3).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const { redisIntentionallyDisabled, shouldFailClosed, isRedisConnected, financialRateLimiter } =
  await import('../middleware/rateLimiting.mjs');

// The real per-request decision the failClosedWrapper computes:
//   redisExpected  = !redisIntentionallyDisabled()
//   redisConnected =  isRedisConnected()   (false in jest — no Redis ever connected)
//   fail-closed    =  shouldFailClosed({ failClosed:true, redisExpected, redisConnected })
// We drive it purely through NODE_ENV so the test exercises the REAL functions,
// not a re-implementation of their logic.
function failsClosedUnderEnv(nodeEnv) {
  process.env.NODE_ENV = nodeEnv;
  delete process.env.JEST_WORKER_ID; // else redisIntentionallyDisabled() is true for any env
  delete process.env.REDIS_DISABLED; // isolate the NODE_ENV signal
  const redisExpected = !redisIntentionallyDisabled();
  const redisConnected = isRedisConnected(); // false in jest (no Redis client)
  return shouldFailClosed({ failClosed: true, redisExpected, redisConnected });
}

describe('Equoria-kunx5 — beta-readiness Redis-intentionally-disabled matrix', () => {
  let savedNodeEnv;
  let savedJestWorkerId;
  let savedRedisDisabled;

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
    savedJestWorkerId = process.env.JEST_WORKER_ID;
    savedRedisDisabled = process.env.REDIS_DISABLED;
  });

  afterEach(() => {
    // Restore the jest env exactly so no cross-test / cross-file leakage.
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
    if (savedJestWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = savedJestWorkerId;
    }
    if (savedRedisDisabled === undefined) {
      delete process.env.REDIS_DISABLED;
    } else {
      process.env.REDIS_DISABLED = savedRedisDisabled;
    }
  });

  // ── SECURITY PRESERVED: production + beta STILL fail closed on Redis outage ──
  it('production + failClosed + Redis down → STILL fail-closed (503) [security preserved]', () => {
    // failsClosedUnderEnv sets NODE_ENV=production and clears JEST_WORKER_ID /
    // REDIS_DISABLED, so the post-call redisIntentionallyDisabled() reads production.
    expect(failsClosedUnderEnv('production')).toBe(true);
    expect(redisIntentionallyDisabled()).toBe(false); // production is NOT exempt
  });

  it('beta + failClosed + Redis down → STILL fail-closed (503) [security preserved]', () => {
    expect(failsClosedUnderEnv('beta')).toBe(true);
    expect(redisIntentionallyDisabled()).toBe(false); // beta is NOT exempt — real Redis expected
  });

  // ── THE FIX: beta-readiness is exempt (no Redis in the gate) ────────────────
  it('beta-readiness + failClosed + Redis down → NOT fail-closed [the kunx5 fix]', () => {
    expect(failsClosedUnderEnv('beta-readiness')).toBe(false);
    expect(redisIntentionallyDisabled()).toBe(true); // beta-readiness IS exempt
  });

  // ── UNCHANGED: test env stays exempt ────────────────────────────────────────
  it('test + failClosed + Redis down → NOT fail-closed [unchanged]', () => {
    expect(failsClosedUnderEnv('test')).toBe(false);
    expect(redisIntentionallyDisabled()).toBe(true);
  });

  // ── Non-vacuity: the probe distinguishes exempt from non-exempt envs ────────
  it('the matrix is non-vacuous: exempt envs differ from non-exempt envs', () => {
    // If the fix were a no-op (beta-readiness not added), beta-readiness would
    // match production (both true) and this contrast would collapse.
    expect(failsClosedUnderEnv('beta-readiness')).not.toBe(failsClosedUnderEnv('production'));
    expect(failsClosedUnderEnv('test')).not.toBe(failsClosedUnderEnv('beta'));
  });
});

// ── Real exported financialRateLimiter through the HTTP chain (supertest) ──────
// Exercises the ACTUAL exported middleware (not a DI-constructed clone). The
// failClosedWrapper evaluates _redisExpectedFn()=!redisIntentionallyDisabled()
// PER REQUEST, so flipping NODE_ENV changes the real decision at request time.
// isRedisConnected() is false throughout (no Redis client in jest) — the "outage"
// condition — so this proves the env gate, not a Redis presence artifact.
describe('Equoria-kunx5 — real financialRateLimiter HTTP behavior by env', () => {
  let savedNodeEnv;
  let savedJestWorkerId;
  let savedRedisDisabled;

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    // Unique user id per request so the in-memory limiter counter never
    // approaches its 20/15min cap across arms (keeps 429 out of the picture).
    let n = 0;
    app.use((req, _res, next) => {
      req.user = { id: `kunx5-http-${Date.now()}-${n++}` };
      next();
    });
    app.post('/claim', financialRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    return app;
  };

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
    savedJestWorkerId = process.env.JEST_WORKER_ID;
    savedRedisDisabled = process.env.REDIS_DISABLED;
  });

  afterEach(() => {
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
    if (savedJestWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = savedJestWorkerId;
    }
    if (savedRedisDisabled === undefined) {
      delete process.env.REDIS_DISABLED;
    } else {
      process.env.REDIS_DISABLED = savedRedisDisabled;
    }
  });

  it('beta-readiness: real financialRateLimiter does NOT 503 (delegates → 200) [the fix]', async () => {
    process.env.NODE_ENV = 'beta-readiness';
    delete process.env.JEST_WORKER_ID;
    delete process.env.REDIS_DISABLED;

    const res = await request(makeApp()).post('/claim').send({});
    expect(res.status).not.toBe(503);
    expect(res.status).toBe(200);
  });

  it('production: real financialRateLimiter STILL 503s on Redis outage [security preserved]', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
    delete process.env.REDIS_DISABLED;

    const res = await request(makeApp()).post('/claim').send({});
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      message: 'Service temporarily unavailable, please retry shortly',
    });
  });
});
