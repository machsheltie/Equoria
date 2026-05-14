/**
 * conformationShowRoutes — router unit tests (Equoria-rr7)
 *
 * Verifies the router is wired correctly and that the express-validator
 * chains reject invalid bodies/params with 400 before reaching the controller.
 *
 * Mounts the real router on a minimal express app (no auth middleware) and
 * exercises each declared route. Rate limiters are real but the tests stay
 * well below their thresholds.
 *
 * The route file (modules/competition/routes/conformationShowRoutes.mjs)
 * is mostly imports + validator chain declarations + 4 router.post/get
 * calls — exercising any 400/non-400 path proves the wiring loads and
 * the chains run.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import conformationShowRoutes from '../routes/conformationShowRoutes.mjs';

// Build a minimal app that mounts the router with no auth and a
// catch-all error handler so internal errors return 500 cleanly.
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/conformation', conformationShowRoutes);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err?.message ?? 'error' });
  });
  return app;
}

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

  describe('POST /enter validation', () => {
    it('rejects missing fields with 400', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/enter').send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid horseId (non-int)', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/enter').send({
        horseId: 'not-a-number',
        groomId: 1,
        showId: 1,
        className: 'Mares',
      });
      expect(res.status).toBe(400);
    });

    it('rejects horseId < 1', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/enter').send({
        horseId: 0,
        groomId: 1,
        showId: 1,
        className: 'Mares',
      });
      expect(res.status).toBe(400);
    });

    it('rejects empty className', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/enter').send({
        horseId: 1,
        groomId: 1,
        showId: 1,
        className: '',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing groomId', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/enter').send({
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
      const res = await request(app).get('/conformation/eligibility/abc');
      expect(res.status).toBe(400);
    });

    it('rejects horseId param of 0 with 400', async () => {
      const app = makeApp();
      const res = await request(app).get('/conformation/eligibility/0');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /execute validation', () => {
    it('rejects missing showId with 400', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/execute').send({});
      expect(res.status).toBe(400);
    });

    it('rejects non-integer showId with 400', async () => {
      const app = makeApp();
      const res = await request(app).post('/conformation/execute').send({ showId: 'oops' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /titles/:horseId validation', () => {
    it('rejects non-integer horseId param with 400', async () => {
      const app = makeApp();
      const res = await request(app).get('/conformation/titles/xyz');
      expect(res.status).toBe(400);
    });

    it('accepts well-formed horseId (passes validation; controller may 401/500)', async () => {
      // We don't assert success — just that validation does not reject. The
      // controller will fail downstream (no auth, etc.) but that proves the
      // validator chain itself accepted the input.
      const app = makeApp();
      const res = await request(app).get('/conformation/titles/123');
      expect(res.status).not.toBe(400);
    });
  });
});
