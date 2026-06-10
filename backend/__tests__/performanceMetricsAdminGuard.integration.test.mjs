/**
 * performanceMetricsAdminGuard.integration.test.mjs
 *
 * Equoria-xfqy4 (SECURITY P1): GET /api/v1/performance/metrics exposed process
 * uptime, node version, platform, arch, PID, memory usage, and cache stats —
 * operational/reconnaissance data, NOT a player feature and NOT a liveness
 * probe. It was mounted at app level (backend/app.mjs) with NO authentication,
 * so any anonymous caller could read process-internal diagnostics.
 *
 * The mount-level fix in backend/app.mjs gates the WHOLE /api/v1/performance
 * mount behind authenticateToken + requireRole('admin'), mirroring the
 * Equoria-rvmse fix for /optimization + /memory. Because this mount lives at
 * app level (not on authRouter, which already carries authenticateToken), the
 * fix supplies BOTH middlewares:
 *   app.use('/api/v1/performance', authenticateToken, requireRole('admin'),
 *           performanceMetricsRouter);
 *
 * This suite proves the gate against the REAL app composition (app.mjs), not
 * the router handler in isolation:
 *   - unauthenticated         → 401 (authenticateToken — closes the public hole)
 *   - authenticated non-admin → 403 (requireRole('admin') — THE fix)
 *   - authenticated admin     → 200 (gate passes, metrics returned)
 *
 * It ALSO asserts that the lightweight PUBLIC health/readiness signals
 * (/health, /ready) remain unauthenticated and return 200 without a token —
 * the AC requires "health/readiness endpoints remain lightweight and public".
 * That is the sentinel proving the fix gated the reconnaissance payload WITHOUT
 * collaterally locking the liveness probes.
 *
 * GET reads, so no CSRF token is involved (csrfProtection only gates
 * state-changing verbs). Real-DB integration test — no mocks. The non-admin
 * token carries no embedded role, so requireRole resolves the real DB row; the
 * admin user is a real role=admin row.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';
import { createTestUser, cleanupTestData } from '../tests/helpers/testAuth.mjs';

const ORIGIN = 'http://localhost:3000';

const METRICS_ROUTE = '/api/v1/performance/metrics';
const PUBLIC_HEALTH_ROUTES = ['/health', '/ready'];

describe('INTEGRATION: performance metrics admin guard (Equoria-xfqy4)', () => {
  let regularToken;
  let adminToken;

  beforeAll(async () => {
    const ts = Date.now();
    const regular = await createTestUser({
      username: `perfmetrics_regular_${ts}`,
      email: `perfmetrics_regular_${ts}@test.com`,
    });
    regularToken = regular.token;

    const admin = await createTestUser({
      username: `perfmetrics_admin_${ts}`,
      email: `perfmetrics_admin_${ts}@test.com`,
      role: 'admin',
    });
    adminToken = admin.token;
  }, 120000); // 120s — DB ops can be slow under full-suite --runInBand load

  afterAll(async () => {
    await cleanupTestData();
  }, 120000);

  describe('anonymous → 401 (THE fix: detailed metrics no longer public)', () => {
    it(`GET ${METRICS_ROUTE} returns 401 without a token`, async () => {
      const res = await request(app).get(METRICS_ROUTE).set('Origin', ORIGIN);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      // Sentinel: the reconnaissance payload must NOT leak to an anonymous caller.
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('authenticated NON-admin → 403 (requireRole admin)', () => {
    it(`GET ${METRICS_ROUTE} returns 403 for a non-admin user`, async () => {
      const res = await request(app)
        .get(METRICS_ROUTE)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      // requireRole('admin') rejects with "Insufficient permissions" (auth.mjs).
      expect(String(res.body.message)).toMatch(/insufficient permissions/i);
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('authenticated admin → 200 (gate passes, metrics returned)', () => {
    it(`GET ${METRICS_ROUTE} returns 200 with the metrics payload for an admin`, async () => {
      const res = await request(app)
        .get(METRICS_ROUTE)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // The detailed (admin-only) payload shape is intact behind the gate.
      expect(res.body.data).toBeDefined();
      expect(res.body.data.system).toBeDefined();
      expect(typeof res.body.data.system.nodeVersion).toBe('string');
      expect(res.body.data.memory).toBeDefined();
      expect(res.body.data.cache).toBeDefined();
    });
  });

  describe('lightweight public health/readiness remain public (AC: not collaterally gated)', () => {
    it.each(PUBLIC_HEALTH_ROUTES)('GET %s returns 200 without a token', async route => {
      const res = await request(app).get(route).set('Origin', ORIGIN);
      // /health and /ready are intentionally unauthenticated liveness/readiness
      // probes. /ready may report 503 if the DB ping fails, but it must NEVER
      // be auth-gated (401/403) — that is the regression this asserts against.
      expect([200, 503]).toContain(res.status);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
