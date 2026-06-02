/**
 * Crafting route security-pipeline integration test (Equoria-rg1r).
 *
 * sprint-change-proposal-2026-04-15.md §4.3 double-check requirement.
 * craftingController.craftItem assumes req.user.id and persists via
 * prisma.user.update — so /api/v1/crafting/* MUST pass through the standard
 * auth + CSRF (mutations) + prototype-pollution guard chain.
 *
 * Pipeline evidence (backend/app.mjs):
 *   - 461: express.json({ verify: verifyJsonBody })          (global, pre-router)
 *   - 463: app.use(rejectPollutedRequestBody)                 (global, pre-router)
 *   - 467: app.use(rejectPollutedRequestQuery)                (global, pre-router)
 *   - 158: authRouter.use(authenticateToken)
 *   - 160: authRouter.use(csrfProtection)
 *   - 209: authRouter.use('/crafting', craftingRoutes)        (inherits 158+160)
 *   - 660: app.use('/api/v1', authRouter)                     (after pollution guards)
 *
 * These tests assert the chain actually rejects, not just that it is wired.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

function uniqueEmail() {
  return `rg1r-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername() {
  return `rg1r${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

describe('Equoria-rg1r: /api/v1/crafting/* security pipeline', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Rg1r',
        lastName: 'Sec',
        money: 10000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys). The per-test user owns no
    // horses (created via prisma.user.create, not the registration route), so
    // a single id-scoped delete with no FK predecessors. A fresh tracker per
    // cycle keeps the fail-loud contract (a failed delete fails the test).
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    await cleanup.run();
  }, 30000);

  describe('auth guard (authenticateToken @ app.mjs:158)', () => {
    it('rejects unauthenticated POST /api/v1/crafting/craft with 401', async () => {
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .send({ recipeId: 'anything' });
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated GET /api/v1/crafting/materials with 401', async () => {
      const res = await request(app).get('/api/v1/crafting/materials').set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated GET /api/v1/crafting/recipes with 401', async () => {
      const res = await request(app).get('/api/v1/crafting/recipes').set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    });
  });

  describe('CSRF guard (csrfProtection @ app.mjs:160)', () => {
    it('rejects authenticated POST /api/v1/crafting/craft WITHOUT a CSRF token with 403', async () => {
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN)
        .send({ recipeId: 'anything' });
      expect(res.status).toBe(403);
    });

    it('accepts authenticated POST with a valid CSRF token (chain passes through to handler)', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ recipeId: '__definitely_not_a_real_recipe__' });
      // Chain passed auth+CSRF; handler rejects the bogus recipe (not 401/403).
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect([400, 404, 422]).toContain(res.status);
    });
  });

  describe('prototype-pollution guard (rejectPollutedRequestBody @ app.mjs:463)', () => {
    it('rejects a polluted craft body (__proto__) with 400 before the handler runs', async () => {
      const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
      // Send the raw JSON bytes so the literal `__proto__` key reaches the
      // server (supertest's object serializer would drop a __proto__ key —
      // JSON.parse stores it as a prototype mutation, not an own property).
      const res = await request(app)
        .post('/api/v1/crafting/craft')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .set('Content-Type', 'application/json')
        .send('{"recipeId":"x","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
    });
  });
});
