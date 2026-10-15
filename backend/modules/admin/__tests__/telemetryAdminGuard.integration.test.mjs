/**
 * telemetryAdminGuard.integration.test.mjs
 *
 * Equoria-rvmse (SECURITY P1): the READ telemetry endpoints under
 * `/api/v1/memory` (memory/resource/status, metrics, resources, health,
 * alerts) and `/api/v1/optimization` (metrics, performance, compression /
 * cache analytics, recommendations) expose operational diagnostics — process
 * memory, resource counts, response-optimization internals — NOT player
 * features. They were authenticated but NOT role-gated: any authenticated
 * non-admin (a beta tester) could read process-internal health data.
 *
 * The mount-level fix in backend/app/routers.mjs gates the WHOLE
 * /optimization and /memory mounts with requireRole('admin'):
 *   authRouter.use('/optimization', requireRole('admin'), apiOptimizationRoutes);
 *   authRouter.use('/memory',       requireRole('admin'), memoryManagementRoutes);
 *
 * This suite proves the gate against the REAL app composition (app.mjs →
 * routers.mjs), not the per-route handlers in isolation:
 *   - unauthenticated            → 401 (authenticateToken on authRouter)
 *   - authenticated non-admin    → 403 (requireRole('admin') — THE fix)
 *   - authenticated admin        → 200 (gate passes, telemetry returned)
 *
 * These are GET reads, so no CSRF token is involved (csrfProtection only
 * gates state-changing verbs). The destructive POST /memory/cleanup +
 * /memory/gc were already admin-only per-route (Story 21S-8) and are covered
 * by memoryAdminGuard.integration.test.mjs — this suite closes the READ-side
 * gap that fix did not.
 *
 * Real-DB integration test — no mocks. The non-admin token carries no embedded
 * role, so requireRole resolves the real DB row; the admin user is a real
 * role=admin row.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const ORIGIN = 'http://localhost:3000';

// Representative READ telemetry routes from the AC (status/resources/health/
// metrics + optimization metrics/performance). The fix is a mount-level gate,
// so any of these proves coverage of the whole mount; we assert several to
// prove the gate is on the MOUNT (not just one handler).
const MEMORY_READ_ROUTES = [
  '/api/v1/memory/status',
  '/api/v1/memory/metrics',
  '/api/v1/memory/resources',
  '/api/v1/memory/health',
  '/api/v1/memory/alerts',
];

const OPTIMIZATION_READ_ROUTES = [
  '/api/v1/optimization/metrics',
  '/api/v1/optimization/performance',
  '/api/v1/optimization/compression-stats',
  '/api/v1/optimization/cache-analytics',
];

const ALL_READ_ROUTES = [...MEMORY_READ_ROUTES, ...OPTIMIZATION_READ_ROUTES];

describe('INTEGRATION: telemetry admin guard — read endpoints (Equoria-rvmse)', () => {
  let regularToken;
  let adminToken;

  beforeAll(async () => {
    const ts = Date.now();
    const regular = await createTestUser({
      username: `telemetry_regular_${ts}`,
      email: `telemetry_regular_${ts}@test.com`,
    });
    regularToken = regular.token;

    const admin = await createTestUser({
      username: `telemetry_admin_${ts}`,
      email: `telemetry_admin_${ts}@test.com`,
      role: 'admin',
    });
    adminToken = admin.token;
  }, 120000); // 120s — DB ops can be slow under full-suite --runInBand load

  afterAll(async () => {
    await cleanupTestData();
  }, 120000);

  describe('unauthenticated → 401 (sentinel: the mount still requires auth)', () => {
    it.each(ALL_READ_ROUTES)('GET %s returns 401 without a token', async route => {
      const res = await request(app).get(route).set('Origin', ORIGIN);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('authenticated NON-admin → 403 (the Equoria-rvmse fix)', () => {
    it.each(ALL_READ_ROUTES)('GET %s returns 403 for a non-admin user', async route => {
      const res = await request(app).get(route).set('Origin', ORIGIN).set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      // requireRole('admin') rejects with "Insufficient permissions" (auth.mjs).
      expect(String(res.body.message)).toMatch(/insufficient permissions/i);
    });
  });

  describe('authenticated admin → 200 (gate passes, telemetry returned)', () => {
    it.each(ALL_READ_ROUTES)('GET %s returns 200 for an admin user', async route => {
      const res = await request(app).get(route).set('Origin', ORIGIN).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
