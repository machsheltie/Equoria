/**
 * compatibilityAdminGuard.integration.test.mjs (Equoria-oey96.37)
 *
 * OWNER RULING 2026-07-07: endpoint clusters no screen uses are admin-gated,
 * not left open as an unspecified player surface. `/api/v1/compatibility`
 * (dynamicCompatibilityRoutes) has no frontend consumer, so the whole mount is
 * gated with requireRole('admin') in backend/app/routers.mjs. The routes and
 * their tables stay (owner q143 parks the compatibility tables); only who may
 * call them changes.
 *
 * Proven against the real app composition (app.mjs -> routers.mjs):
 *   - unauthenticated         -> 401
 *   - authenticated player    -> 403 (the fix; was 200)
 *   - authenticated admin     -> 200
 *
 * GET reads only, so CSRF cannot produce a vacuous 403. Real-DB users, no mocks;
 * the player token carries no role, so requireRole resolves the real DB row.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const ORIGIN = 'http://localhost:3000';

// Two reads on the mount: the gate is on the MOUNT, not one handler. The factors
// route's ids need not exist — a player must be refused before any lookup.
const readRoutes = ['/api/v1/compatibility/config', '/api/v1/compatibility/factors/1/1'];

describe('INTEGRATION: /compatibility is admin-only (Equoria-oey96.37)', () => {
  let playerToken;
  let adminToken;

  beforeAll(async () => {
    const ts = Date.now();
    const player = await createTestUser({
      username: `compatGuardPlayer${ts}`,
      email: `compatGuardPlayer${ts}@test.com`,
    });
    playerToken = player.token;

    const admin = await createTestUser({
      username: `compatGuardAdmin${ts}`,
      email: `compatGuardAdmin${ts}@test.com`,
      role: 'admin',
    });
    adminToken = admin.token;
  }, 120000);

  afterAll(async () => {
    await cleanupTestData();
  }, 120000);

  it.each(readRoutes)('GET %s returns 401 without a token', async route => {
    const res = await request(app).get(route).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it.each(readRoutes)('GET %s returns 403 for a player', async route => {
    const res = await request(app).get(route).set('Origin', ORIGIN).set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/insufficient permissions/i);
  });

  it('GET /api/v1/compatibility/config returns 200 for an admin', async () => {
    const res = await request(app)
      .get('/api/v1/compatibility/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
