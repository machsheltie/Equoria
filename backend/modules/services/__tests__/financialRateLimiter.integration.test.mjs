/**
 * Financial / economy mutation rate limiter — real-DB integration (Equoria-ftjm)
 *
 * Equoria-ftjm decision (b): bank/transaction/economy mutation routes get a
 * dedicated stricter per-user limiter (`financialRateLimiter`, 20 mutations
 * / 15 min, keyed on `user:${req.user.id}`) instead of relying only on the
 * global 100/15min apiLimiter. The economy-abuse threat (coin-grind /
 * mass-purchase / transaction-flood scripts) is the rationale — see the
 * limiter's doc-comment in backend/middleware/rateLimiting.mjs and
 * .claude/rules/SECURITY.md.
 *
 * This suite proves, against the REAL test DB with REAL JWT auth + REAL
 * CSRF and the REAL middleware chain (no mocks, no bypass headers):
 *
 *  1. Under the cap (≤20 financial mutations) requests pass through to the
 *     controller (200 on first claim / 400 cooldown thereafter — NOT 429).
 *  2. The 21st financial mutation in the window → 429 with the canonical
 *     rate-limit envelope ({ success:false, status:'error', message,
 *     retryAfter, limit, window }).
 *  3. The limit is PER-USER: user B is unaffected when user A is capped
 *     (proves keyGenerator keys on the JWT user id, not just the IP — both
 *     users share ::1 / 127.0.0.1 under supertest).
 *  4. Read endpoints (GET /bank/claim-status, /bank/transactions) are NOT
 *     gated by the financial limiter — they keep working after the
 *     mutation cap is hit.
 *
 * Test-env cap control (NOT a bypass): the repo's jest setup sets
 * TEST_RATE_LIMIT_MAX_REQUESTS=1000 process-wide so suites don't
 * 429-cascade. That env knob is the project's SANCTIONED test control for
 * limiter caps (see backend/middleware/rateLimiting.mjs lines ~331-334:
 * "Test suites control rate-limit pressure via the TEST_RATE_LIMIT_* env
 * knobs ... NOT via per-request header escape hatches"). It is explicitly
 * NOT a bypass header and does NOT disable the limiter — it only sets the
 * numeric cap. This suite overrides it to the limiter's REAL configured
 * value (20) for THIS isolated jest file process ONLY (each test file runs
 * in its own worker; restored in afterAll), so the REAL exported
 * financialRateLimiter enforces on the REAL /api/v1/bank/claim route chain
 * at its production-intent cap. We set it BEFORE importing app.mjs because
 * createRateLimiter resolves max() per-request from this env var.
 *
 * POST /bank/claim is the probe: the first call succeeds (200, +500),
 * every subsequent call is a cooldown 400, and skipSuccessfulRequests:false
 * counts BOTH toward the cap, so the 21st request trips the limiter
 * regardless of controller outcome.
 *
 * Real DB. Real prisma. Real HTTP chain via supertest. Real CSRF.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

const FINANCIAL_CAP = 20; // financialRateLimiter real configured max / 15-min

// Sanctioned test-env cap control (see header doc). Must be set BEFORE the
// app.mjs import below so the limiter's per-request max() reads it. This is
// the limiter's REAL configured value — we are not weakening or bypassing
// the limiter, we are exercising it at its production-intent cap inside the
// jest env that otherwise loosens ALL useEnvOverride limiters to 1000.
const __ORIGINAL_TEST_RL_MAX = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
process.env.TEST_RATE_LIMIT_MAX_REQUESTS = String(FINANCIAL_CAP);

const { default: app } = await import('../../../app.mjs');
const { default: prisma } = await import('../../../../packages/database/prismaClient.mjs');
const { createTestUser, cleanupTestData } = await import('../../../tests/helpers/testAuth.mjs');
const { fetchCsrf } = await import('../../../tests/helpers/csrfHelper.mjs');

const FIXTURE_PREFIX = 'TestFixture-finrl-ftjm';
const ORIGIN = 'http://localhost:3000';

let userA;
let tokenA;
let userB;
let tokenB;

/**
 * CSRF-protected mutating request. Mirrors bankWeeklyClaim.integration.test
 * (no intermediate await of the supertest chain — it is itself a thenable).
 */
async function postClaim(token) {
  const c = await fetchCsrf(app, { origin: ORIGIN });
  return request(app)
    .post('/api/v1/bank/claim')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send({});
}

beforeAll(async () => {
  const tagA = randomBytes(4).toString('hex');
  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-A-${tagA}`,
    email: `${FIXTURE_PREFIX}-A-${tagA}@example.com`,
    money: 1000,
  });
  userA = a.user;
  tokenA = a.token;

  const tagB = randomBytes(4).toString('hex');
  const b = await createTestUser({
    username: `${FIXTURE_PREFIX}-B-${tagB}`,
    email: `${FIXTURE_PREFIX}-B-${tagB}@example.com`,
    money: 1000,
  });
  userB = b.user;
  tokenB = b.token;

  // Clean weekly-claim slate for both.
  await prisma.user.update({ where: { id: userA.id }, data: { money: 1000, settings: {} } });
  await prisma.user.update({ where: { id: userB.id }, data: { money: 1000, settings: {} } });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
  // Restore the process-wide jest cap so any teardown / shared state is
  // unaffected (each test file is its own worker, but be tidy regardless).
  if (__ORIGINAL_TEST_RL_MAX === undefined) {
    delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
  } else {
    process.env.TEST_RATE_LIMIT_MAX_REQUESTS = __ORIGINAL_TEST_RL_MAX;
  }
});

describe('financialRateLimiter — dedicated per-user economy limiter (Equoria-ftjm)', () => {
  it('lets the first claim through and stays under the cap for the next 19 mutations (no 429)', async () => {
    // 1st: success (200, +500). Requests 2..20: cooldown 400. None are 429.
    for (let i = 1; i <= FINANCIAL_CAP; i += 1) {
      const res = await postClaim(tokenA);
      expect(res.status).not.toBe(429);
      if (i === 1) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      } else {
        // cooldown rejection — proves the request reached the controller,
        // i.e. the limiter let it through (not gated below the cap).
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already claimed/i);
      }
    }
  }, 120000);

  it('returns 429 with the canonical envelope on the 21st financial mutation', async () => {
    const res = await postClaim(tokenA);

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      success: false,
      status: 'error',
      message: expect.stringMatching(/financial action limit exceeded/i),
    });
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(res.body.limit).toBe(FINANCIAL_CAP);
    expect(res.body.window).toBeGreaterThan(0);
    // RFC standardHeaders are emitted by the shared createRateLimiter.
    expect(res.headers['ratelimit-limit']).toBeDefined();
  }, 60000);

  it('is per-user: user B is NOT blocked while user A is capped (same IP, different JWT)', async () => {
    // User A is over the cap from the previous test. User B shares the
    // supertest source IP but has a distinct JWT user id, so the limiter
    // key (`user:<id>`) differs — B must still reach the controller.
    const res = await postClaim(tokenB);

    expect(res.status).not.toBe(429);
    // B has never claimed → first claim succeeds.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // A is still capped (sanity: the cap is sticky within the window).
    const aStill = await postClaim(tokenA);
    expect(aStill.status).toBe(429);
  }, 60000);

  it('does NOT gate read endpoints — claim-status & transactions still work after the cap', async () => {
    // User A is rate-limited for financial MUTATIONS but the financial
    // limiter is only mounted on the coin-moving POSTs. GET reads inherit
    // the global apiLimiter only and must remain available.
    const statusRes = await request(app)
      .get('/api/v1/bank/claim-status')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', ORIGIN);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.success).toBe(true);

    const txRes = await request(app)
      .get('/api/v1/bank/transactions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', ORIGIN);
    expect(txRes.status).toBe(200);
    expect(txRes.body.success).toBe(true);
  }, 60000);
});
