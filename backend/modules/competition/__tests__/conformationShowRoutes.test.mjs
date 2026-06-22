/**
 * conformationShowRoutes — router unit tests (Equoria-rr7)
 *
 * Verifies the router is wired correctly and that the express-validator
 * chains reject invalid bodies/params with 400 before reaching the controller.
 *
 * Mounts the real router on a minimal express app and exercises each declared
 * route. The router OWNS its auth guard (Equoria-jk9oj.2:
 * `router.use(authenticateToken)` at the top of conformationShowRoutes.mjs —
 * defence-in-depth, not relying on the parent authRouter mount), so the
 * validator chains are only reachable AFTER authentication. This suite
 * therefore authenticates with a REAL JWT for a REAL user (Equoria-hk739: real
 * DB, no bypass headers — per CLAUDE.md §3) so the validator-rejection
 * assertions exercise what they claim. Without the token every request would
 * 401 at the auth guard before any validator ran.
 *
 * Rate limiters are real but the tests stay well below their thresholds.
 *
 * The route file (modules/competition/routes/conformationShowRoutes.mjs)
 * is mostly imports + validator chain declarations + 4 router.post/get
 * calls — exercising any 400/non-400 path proves the wiring loads and
 * the chains run.
 *
 * Note: the full HTTP path (real app.mjs mount, CSRF, ownership against a real
 * owned horse) is covered separately by conformationShowRoutesHttp.integration.test.mjs.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import conformationShowRoutes from '../routes/conformationShowRoutes.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const FIXTURE_PREFIX = 'TestFixture-conformation-routes-unit';

let token;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const created = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  token = created.token;
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

// Build a minimal app that mounts the router with a catch-all error handler so
// internal errors return 500 cleanly. Auth is enforced by the router itself
// (router.use(authenticateToken)); requests must carry a real Bearer token.
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/conformation', conformationShowRoutes);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err?.message ?? 'error' });
  });
  return app;
}

// Helper: attach the real Bearer token to a supertest request so it clears the
// router's authenticateToken guard and reaches the validator chains.
const auth = req => req.set('Authorization', `Bearer ${token}`);

describe('conformationShowRoutes', () => {
  it('exports an Express router', () => {
    expect(conformationShowRoutes).toBeDefined();
    expect(typeof conformationShowRoutes).toBe('function');
    // express.Router() returns a function with a stack property
    expect(conformationShowRoutes.stack).toBeDefined();
    expect(Array.isArray(conformationShowRoutes.stack)).toBe(true);
  });

  it('registers the four expected routes', () => {
    // The router's stack contains middleware + each route layer
    const paths = conformationShowRoutes.stack
      .filter(layer => layer.route)
      .map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

    expect(paths).toContain('POST /enter');
    expect(paths).toContain('GET /eligibility/:horseId');
    expect(paths).toContain('POST /execute');
    expect(paths).toContain('GET /titles/:horseId');
  });

  it('rejects unauthenticated requests with 401 before validation runs', async () => {
    // Sentinel for the router-owned auth guard (Equoria-jk9oj.2): a request
    // with NO token must 401 at authenticateToken, not fall through to the
    // validators. This proves the guard is wired ahead of the validator chains.
    const app = makeApp();
    const res = await request(app).post('/conformation/enter').send({});
    expect(res.status).toBe(401);
  });

  describe('POST /enter validation', () => {
    it('rejects missing fields with 400', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/enter')).send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid horseId (non-int)', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/enter')).send({
        horseId: 'not-a-number',
        groomId: 1,
        showId: 1,
        className: 'Mares',
      });
      expect(res.status).toBe(400);
    });

    it('rejects horseId < 1', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/enter')).send({
        horseId: 0,
        groomId: 1,
        showId: 1,
        className: 'Mares',
      });
      expect(res.status).toBe(400);
    });

    it('rejects empty className', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/enter')).send({
        horseId: 1,
        groomId: 1,
        showId: 1,
        className: '',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing groomId', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/enter')).send({
        horseId: 1,
        showId: 1,
        className: 'Mares',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /eligibility/:horseId validation', () => {
    it('rejects non-integer horseId param with 400', async () => {
      const app = makeApp();
      const res = await auth(request(app).get('/conformation/eligibility/abc'));
      expect(res.status).toBe(400);
    });

    it('rejects horseId param of 0 with 400', async () => {
      const app = makeApp();
      const res = await auth(request(app).get('/conformation/eligibility/0'));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /execute validation', () => {
    it('rejects missing showId with 400', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/execute')).send({});
      expect(res.status).toBe(400);
    });

    it('rejects non-integer showId with 400', async () => {
      const app = makeApp();
      const res = await auth(request(app).post('/conformation/execute')).send({ showId: 'oops' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /titles/:horseId validation', () => {
    it('rejects non-integer horseId param with 400', async () => {
      const app = makeApp();
      const res = await auth(request(app).get('/conformation/titles/xyz'));
      expect(res.status).toBe(400);
    });

    it('accepts well-formed horseId (passes validation; controller/ownership may 403/404/500)', async () => {
      // We don't assert success — just that validation does not reject. The
      // request passes the validator chain (horseId is a positive int), then
      // requireOwnership runs a real DB lookup for a horse the test user does
      // not own, so the response is 403/404 (not 400). That proves the
      // validator chain itself accepted the input.
      const app = makeApp();
      const res = await auth(request(app).get('/conformation/titles/123'));
      expect(res.status).not.toBe(400);
    });
  });
});
