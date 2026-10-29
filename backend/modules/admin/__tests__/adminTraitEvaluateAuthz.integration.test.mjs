/**
 * Equoria-olt5x — a player cannot reach the admin trait routes.
 *
 * Owner ruling 2026-10-21 (Q13): POST /admin/traits/evaluate and POST
 * /flags/batch-evaluate may stay for now, so long as a player cannot find and
 * exploit them. Since then POST /flags/batch-evaluate was removed outright
 * (owner ruling 2026-10-28, q203); retiredTraitAdviceRoutes pins its 404 for a
 * player and the admin alike. This file pins the one that remains.
 *
 * POST /api/v1/admin/traits/evaluate runs the foal trait evaluation for EVERY
 * foal in the game. Its only guard is the admin router's
 * authenticateToken + requireRole('admin') (app/routers.mjs), so:
 *   - no token            -> 401, never the handler;
 *   - a player            -> 403 'Insufficient permissions', even with a valid
 *                            CSRF pair (the role gate, not CSRF, refuses it);
 *   - a moderator         -> 403 likewise (only admins and the owner);
 *   - the admin           -> passes the role gate: with no CSRF pair it is the
 *                            CSRF layer, AFTER the role gate, that answers.
 * The admin's full 200 is pinned by cronJobsIntegration ("should manually
 * trigger trait evaluation"); it is not repeated here because it runs the
 * game-wide evaluation against the shared database.
 *
 * Mutation evidence: with requireRole('admin') removed from the admin router,
 * the player and moderator cases fail (the request reaches the handler).
 *
 * Real Express app, real JWT, real CSRF flow. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { checkedInDeviceCookie } from '../../../tests/helpers/staffDeviceFixture.mjs';

const origin = 'http://localhost:3000';
const route = '/api/v1/admin/traits/evaluate';
const fixturePrefix = 'TestFixture-olt5x';

async function makeAccount(role) {
  const tag = randomBytes(6).toString('hex');
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${fixturePrefix}-${role}-${tag}@example.com`,
      username: `${fixturePrefix}-${role}-${tag}`.slice(0, 30),
      password: 'irrelevant-not-a-login-test',
      firstName: 'Trait',
      lastName: role,
      role,
      money: 0,
      settings: {},
    },
  });
  return { user, token: generateTestToken({ id: user.id, email: user.email, role }) };
}

async function postWithCsrf(token) {
  const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(route)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({});
}

describe('Equoria-olt5x — POST /admin/traits/evaluate is closed to players', () => {
  const cleanup = createCleanupTracker();
  const accounts = {};

  beforeAll(async () => {
    for (const role of ['user', 'moderator', 'admin']) {
      accounts[role] = await makeAccount(role);
      const userId = accounts[role].user.id;
      cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), `${role} account`);
    }
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('refuses a request with no token (401)', async () => {
    const res = await request(app).post(route).set('Origin', origin).send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it.each([
    ['a player', 'user'],
    ['a moderator', 'moderator'],
  ])('refuses %s at the role gate (403), even with a valid CSRF pair', async (_who, role) => {
    const res = await postWithCsrf(accounts[role].token);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, message: 'Insufficient permissions' });
    expect(res.body.message).not.toMatch(/trait evaluation/i);
  });

  it('lets the admin past the role gate (the CSRF layer behind it answers a request without a pair)', async () => {
    // Equoria-n256i (owner ruling q289): admin tools need the emailed staff check-in.
    const device = await checkedInDeviceCookie(accounts.admin.user.id);
    const res = await request(app)
      .post(route)
      .set('Authorization', `Bearer ${accounts.admin.token}`)
      .set('Cookie', device)
      .set('Origin', origin)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid CSRF token. Please refresh the page and try again.');
  });
});
