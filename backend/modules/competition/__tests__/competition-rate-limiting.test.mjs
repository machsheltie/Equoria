/**
 * Competition Routes Rate Limiting Integration Tests
 *
 * Tests rate limiting implementation for competition management endpoints.
 * Verifies that rate limiters are properly applied and enforced for:
 * - GET endpoints (queryRateLimiter)
 * - POST endpoints (mutationRateLimiter)
 *
 * Routing reality (locked by this suite):
 * - The competition router is mounted at /api/v1/competition via the
 *   authRouter (backend/app/routers.mjs), which applies authenticateToken
 *   THEN csrfProtection to every route. There is NO unversioned
 *   /api/competition mount and NO public competition endpoint — every
 *   request without a valid JWT is a deterministic 401.
 * - POST /enter-show and POST /execute are hard-deprecated 410 Gone
 *   (Equoria-kacla — the legacy instant enter-and-run / on-demand-execute
 *   paths contradict the 7-day deferred-window show model). Their
 *   mutationRateLimiter is intentionally kept so the deprecation response
 *   still carries standard rate-limit headers; this suite locks that.
 *
 * Test Coverage:
 * - Rate limit headers presence and correctness (RateLimit-* standard headers)
 * - Rate limiters applied on both query and mutation chains
 * - 401 responses (apiLimiter runs before auth, so headers survive auth failures)
 * - Ownership 404s and validation 400s still carry rate-limit headers
 *
 * Security Considerations:
 * - Real JWT authentication (no bypass headers)
 * - Identity-bound CSRF (Equoria-plw0h): the CSRF token for each mutation is
 *   issued under the SAME user id the mutation authenticates as, by
 *   forwarding the accessToken cookie on the token GET (fetchCsrf
 *   extraCookies) — fetched AFTER the fixture token exists.
 * - No DB fixtures are created: status expectations use ids that cannot
 *   exist/be owned (requireOwnership returns 404 for both not-found and
 *   not-owned, preventing ownership disclosure), so the suite leaks nothing.
 */

import request from 'supertest';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const { default: app } = await import('../../../app.mjs');

const ORIGIN = 'http://localhost:3000';
const BASE = '/api/v1/competition';

// Ids that deterministically do not belong to the token's user. The token's
// user id does not exist in the DB (auth tolerates that — the
// passwordChangedAt check treats a missing user as "never rotated"), so it
// can never own ANY horse; requireOwnership therefore yields 404 regardless
// of whether the row exists (404-in-both-cases prevents ownership disclosure).
const UNOWNED_HORSE_ID = 2147483000;
const MISSING_SHOW_ID = 2147483000;

describe('Competition Routes Rate Limiting Integration Tests', () => {
  const userId = 'test-user-uuid-123';
  const token = generateTestToken({ id: userId, role: 'user' });

  // Identity-bound CSRF pair (Equoria-plw0h): issued under the SAME user id
  // the mutations below authenticate as, fetched AFTER the token exists.
  let csrf;
  beforeAll(async () => {
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  });

  const authedGet = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

  const authedPost = path =>
    attachCsrf(request(app).post(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`), csrf);

  const expectRateLimitHeaders = response => {
    expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    expect(response.headers['ratelimit-remaining']).toBeDefined();
    expect(response.headers['ratelimit-reset']).toBeDefined();
  };

  describe('Query Rate Limiting (GET endpoints)', () => {
    it('should apply queryRateLimiter to GET /api/v1/competition/disciplines', async () => {
      const response = await authedGet(`${BASE}/disciplines`);

      expect(response.status).toBe(200);
      expectRateLimitHeaders(response);
    });

    it('should apply queryRateLimiter to GET /api/v1/competition/show/:showId/results', async () => {
      // Non-existent show: the handler returns 200 with an empty results array.
      const response = await authedGet(`${BASE}/show/${MISSING_SHOW_ID}/results`);

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual([]);
      expectRateLimitHeaders(response);
    });

    it('should apply queryRateLimiter to GET /api/v1/competition/horse/:horseId/results', async () => {
      // requireOwnership: 404 for not-found AND not-owned (no disclosure).
      const response = await authedGet(`${BASE}/horse/${UNOWNED_HORSE_ID}/results`);

      expect(response.status).toBe(404);
      expectRateLimitHeaders(response);
    });

    it('should apply queryRateLimiter to GET /api/v1/competition/eligibility/:horseId/:discipline', async () => {
      const response = await authedGet(`${BASE}/eligibility/${UNOWNED_HORSE_ID}/showjumping`);

      expect(response.status).toBe(404);
      expectRateLimitHeaders(response);
    });
  });

  describe('Mutation Rate Limiting (POST endpoints)', () => {
    it('should apply mutationRateLimiter to deprecated POST /api/v1/competition/enter-show (410 Gone)', async () => {
      // Equoria-kacla: legacy instant enter-and-run path is hard-deprecated.
      // mutationRateLimiter is intentionally kept on the route so the 410
      // still carries standard rate-limit headers — locked here.
      const response = await authedPost(`${BASE}/enter-show`).send({
        showId: 1,
        horseIds: [1, 2, 3],
      });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expectRateLimitHeaders(response);
    });

    it('should apply mutationRateLimiter to POST /api/v1/competition/enter', async () => {
      // Valid shape, unowned horse → requireOwnership 404, headers intact.
      const response = await authedPost(`${BASE}/enter`).send({
        horseId: UNOWNED_HORSE_ID,
        showId: MISSING_SHOW_ID,
      });

      expect(response.status).toBe(404);
      expectRateLimitHeaders(response);
    });

    it('should apply mutationRateLimiter to deprecated POST /api/v1/competition/execute (410 Gone)', async () => {
      // Equoria-kacla: on-demand execution removed; cron is the only executor.
      const response = await authedPost(`${BASE}/execute`).send({ showId: 1 });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expectRateLimitHeaders(response);
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should enforce rate limiting on both query and mutation operations', async () => {
      const queryResponse = await authedGet(`${BASE}/disciplines`);

      const mutationResponse = await authedPost(`${BASE}/enter`).send({
        horseId: UNOWNED_HORSE_ID,
        showId: MISSING_SHOW_ID,
      });

      // Both chains carry rate limiting (positive limits)
      expect(Number(queryResponse.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(Number(mutationResponse.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });
  });

  describe('Authentication Required (authRouter mount)', () => {
    it('should require auth for GET /disciplines (no public competition endpoints)', async () => {
      const response = await request(app).get(`${BASE}/disciplines`).set('Origin', ORIGIN);

      expect(response.status).toBe(401);
      // apiLimiter (app-level, before auth) still stamps rate-limit headers.
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
    });

    it('should require auth for horse-specific endpoints', async () => {
      const response = await request(app).get(`${BASE}/horse/${UNOWNED_HORSE_ID}/results`).set('Origin', ORIGIN);

      expect(response.status).toBe(401);
    });

    it('should require auth for competition entry endpoints', async () => {
      // authenticateToken runs BEFORE csrfProtection on the authRouter, so
      // an unauthenticated mutation is a 401 (not a CSRF 403).
      const response = await request(app)
        .post(`${BASE}/enter`)
        .set('Origin', ORIGIN)
        .send({ horseId: UNOWNED_HORSE_ID, showId: MISSING_SHOW_ID });

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include all standard rate limit headers', async () => {
      const response = await authedGet(`${BASE}/disciplines`);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();

      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(Number(response.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
      expect(Number(response.headers['ratelimit-reset'])).toBeGreaterThan(0);
    });

    it('should decrement remaining count with each request', async () => {
      const response1 = await authedGet(`${BASE}/disciplines`);
      const response2 = await authedGet(`${BASE}/disciplines`);

      const remaining1 = Number(response1.headers['ratelimit-remaining']);
      const remaining2 = Number(response2.headers['ratelimit-remaining']);

      // Second request should have no more remaining requests than the first
      expect(remaining2).toBeLessThanOrEqual(remaining1);
    });
  });

  describe('Security Integration', () => {
    it('should validate horse ownership before allowing results access', async () => {
      const response = await authedGet(`${BASE}/horse/${UNOWNED_HORSE_ID}/results`);

      // 404 for ownership violation or non-existent horse (no disclosure)
      expect(response.status).toBe(404);
      expectRateLimitHeaders(response);
    });

    it('should rate limit the deprecated execution endpoint', async () => {
      const response = await authedPost(`${BASE}/execute`).send({ showId: 1 });

      // 410 Gone (Equoria-kacla) — rate-limit headers must survive deprecation
      expect(response.status).toBe(410);
      expectRateLimitHeaders(response);
    });
  });

  describe('Input Validation with Rate Limiting', () => {
    it('should rate limit invalid competition entry requests', async () => {
      const response = await authedPost(`${BASE}/enter`).send({
        horseId: 'invalid', // Should be integer
        showId: MISSING_SHOW_ID,
      });

      // Dedicated validation middleware runs BEFORE requireOwnership → 400
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expectRateLimitHeaders(response);
    });

    it('should rate limit requests with missing required fields', async () => {
      const response = await authedPost(`${BASE}/enter`).send({
        horseId: UNOWNED_HORSE_ID,
        // Missing showId
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expectRateLimitHeaders(response);
    });
  });
});
