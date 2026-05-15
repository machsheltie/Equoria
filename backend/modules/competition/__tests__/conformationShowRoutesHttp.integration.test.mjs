/**
 * conformationShowRoutesHttp.integration.test.mjs
 *
 * HTTP-level sentinel-positive integration test for the conformation
 * sub-router. Companion to Equoria-pety (route-wiring fix) and
 * Equoria-jbll (sentinel test).
 *
 * Background:
 *   backend/modules/competition/routes/conformationShowRoutes.mjs exposes
 *     POST /enter
 *     GET  /eligibility/:horseId
 *     POST /execute
 *     GET  /titles/:horseId
 *   …but as of Equoria-pety it is NOT imported or mounted into
 *   competitionRoutes.mjs, so every endpoint returns 404 in production
 *   despite the 16 controller-level tests passing.
 *
 * Sentinel contract (OPTIMAL_FIX_DISCIPLINE.md §2):
 *   These tests MUST fail (404) before the route mount lands and MUST pass
 *   once it does. They prove that the HTTP path is reachable — they do NOT
 *   re-test controller behaviour (that's owned by conformationShowEntry/
 *   Execution/Scoring/Service unit suites).
 *
 * Doctrine:
 *   - Real express app from backend/app.mjs (no isolated harness).
 *   - Real auth (createTestUser issues a real JWT).
 *   - Real DB via createTestHorse/cleanupTestData.
 *   - No bypass headers, no mocks, no test.skip.
 *   - Fixture names prefixed `TestFixture-conformation-routes-http-` so
 *     cleanup is scoped.
 *
 * Assertion model:
 *   We assert `status !== 404`. We do NOT pin to 200 — these endpoints have
 *   their own auth/validation/eligibility paths and the controllers may
 *   legitimately return 400/403/409/etc. for a synthetic fixture. The
 *   wiring defect we're guarding against is the 404 from an unmounted
 *   sub-router, which 404 alone proves.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const FIXTURE_PREFIX = 'TestFixture-conformation-routes-http';

let owner;
let token;
let horse;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const created = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = created.user;
  token = created.token;

  horse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Horse-${tag}`,
    userId: owner.id,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('conformation sub-router HTTP mount (Equoria-pety sentinel)', () => {
  // ── Sentinel: GET endpoints prove the sub-router is mounted ─────────────
  //
  // Why only GETs are used as wiring sentinels here:
  //
  //   POST routes on authRouter pass through `authenticateToken` and then
  //   `csrfProtection` BEFORE express's route matcher runs. An authenticated
  //   POST without a CSRF token therefore returns 403 from the CSRF guard
  //   regardless of whether the sub-router is mounted — so a POST status of
  //   "not 404" cannot distinguish mounted-but-CSRF-blocked from
  //   not-mounted-but-CSRF-blocked. Using a POST as a wiring sentinel would
  //   produce a vacuously-passing test (OPTIMAL_FIX_DISCIPLINE.md §2).
  //
  //   GETs do NOT trigger csrfProtection's reject path. Auth passes, then
  //   express runs the route matcher. If the sub-router isn't mounted,
  //   the unmatched path falls through to the global 404 handler. If it
  //   IS mounted, the GET reaches validation/controller and returns
  //   something other than 404 (200/400/etc.). That's a real sentinel.
  //
  //   Controller behaviour for the four endpoints remains covered by
  //   conformationShowEntry/Execution/Scoring/Service unit suites.

  it('GET /api/v1/competition/conformation/eligibility/:horseId is reachable (status !== 404)', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/conformation/eligibility/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    // Router-not-mounted manifests as a plain 404 from the global no-match
    // handler. Any other status — 200/400/500 — proves the request reached
    // the sub-router stack.
    expect(res.status).not.toBe(404);
  });

  it('GET /api/v1/competition/conformation/titles/:horseId is reachable (status !== 404)', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/conformation/titles/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).not.toBe(404);
  });

  // ── Control: confirm the global 404 handler still fires for true
  //   non-routes under the same mount point. This stops a future refactor
  //   from "fixing" the sentinel by adding a catch-all.

  it('an unknown conformation sub-path still returns 404 (control)', async () => {
    const res = await request(app)
      .get('/api/v1/competition/conformation/this-path-does-not-exist')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
  });
});
