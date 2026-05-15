/**
 * temperamentRoutesHttp.integration.test.mjs
 *
 * HTTP-level integration test for GET /api/v1/horses/temperament-definitions
 * (Equoria-ei5u — 31D-5 follow-up).
 *
 * Story 31D-5 shipped the endpoint with controller-only unit tests
 * (temperamentApiEndpoints.test.mjs) that construct synthetic req/res
 * objects and call getTemperamentDefinitions() directly. That bypasses
 * the route's middleware stack and — more importantly — does NOT verify
 * the static path `/temperament-definitions` is registered BEFORE
 * `/:id/conformation` in horseRoutes.mjs. If a future refactor reordered
 * those routes, Express would treat "temperament-definitions" as the
 * `:id` parameter and the existing unit tests would still pass.
 *
 * This file is the parallel of gaitRoutesHttp.integration.test.mjs
 * (Equoria-2zia) for the temperament endpoint — full bound-route coverage
 * via supertest, real auth, real DB, no bypass headers.
 *
 * Route ordering sentinel:
 *   GET /horses/temperament-definitions is public (no auth required, no
 *   ownership middleware) and returns the canonical 11-temperament catalog.
 *   If the route is moved AFTER /:id/* routes, the request would be
 *   misrouted to a numeric-id handler (validateHorseId 400 or 401/404
 *   from auth/ownership) instead of returning 200 with the catalog.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const ENDPOINT = '/api/v1/horses/temperament-definitions';
const FIXTURE_PREFIX = 'TestFixture-temp-http';

let userToken;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const u = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  userToken = u.token;
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/horses/temperament-definitions (HTTP chain)', () => {
  it('returns 200 + full catalog when authenticated (mounted on authRouter)', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.count).toBe(11);
    expect(Array.isArray(res.body.data.definitions)).toBe(true);
    expect(res.body.data.definitions.length).toBe(11);
  });

  it('returns 401 when no Authorization header is sent (authRouter contract)', async () => {
    const res = await request(app).get(ENDPOINT).set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('each definition has the full typed shape (name, description, prevalenceNote, modifiers, bestGroomPersonalities)', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);

    for (const def of res.body.data.definitions) {
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);

      expect(typeof def.description).toBe('string');
      expect(typeof def.prevalenceNote).toBe('string');

      expect(def.trainingModifiers).toBeTruthy();
      expect(typeof def.trainingModifiers.xpModifier).toBe('number');
      expect(typeof def.trainingModifiers.scoreModifier).toBe('number');

      expect(def.competitionModifiers).toBeTruthy();
      expect(typeof def.competitionModifiers.riddenModifier).toBe('number');
      expect(typeof def.competitionModifiers.conformationModifier).toBe('number');

      expect(Array.isArray(def.bestGroomPersonalities)).toBe(true);
    }
  });

  // Route-ordering sentinel — this is the whole reason this file exists.
  //
  // Express matches routes in declaration order. If a careless refactor moves
  // `router.get('/temperament-definitions', ...)` AFTER `router.get('/:id', ...)`
  // or `router.get('/:id/conformation', ...)`, the string "temperament-definitions"
  // would be captured as the :id param. validateHorseId would then 400 on
  // non-numeric input, OR (without validateHorseId on a different :id route)
  // we'd hit the auth/ownership chain and get 401/404. Either way, NOT 200,
  // and the response body would NOT contain `data.count === 11`.
  //
  // The two assertions below — public-200 and exact catalog count — together
  // prove the static path is winning. If either fails after a refactor, this
  // test fails loudly and CI blocks the merge.
  it('static path resolves to getTemperamentDefinitions (route-ordering sentinel)', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Origin', 'http://localhost:3000');

    // If misrouted to a numeric-id handler:
    //   - validateHorseId would 400 with "Invalid horse ID"
    //   - auth middleware would 401 with "No token provided"
    //   - ownership middleware would 404 with "Horse not found"
    // None of those produce `{ success: true, data: { count: 11, ... } }`.
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        count: 11,
      },
    });
    // Specifically guard against the "treated as :id" failure modes:
    expect(res.body.message).not.toMatch(/invalid horse id/i);
    expect(res.body.message).not.toMatch(/no token provided/i);
    expect(res.body.message).not.toMatch(/horse not found/i);
  });

  it('queryRateLimiter is bound (response includes rate-limit headers)', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    // express-rate-limit with standardHeaders:true emits RateLimit-* (RFC).
    // The presence of any of these proves the limiter middleware ran on this
    // route. We don't assert specific values — rate-limit counters drift with
    // real DB and parallel test runs — only that the middleware is wired.
    const headerKeys = Object.keys(res.headers);
    const hasRateLimitHeader = headerKeys.some(k => /^ratelimit/i.test(k));
    expect(hasRateLimitHeader).toBe(true);
  });
});
