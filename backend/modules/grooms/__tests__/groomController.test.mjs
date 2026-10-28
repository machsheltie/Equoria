/**
 * groomController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getUserGrooms. (hireGroom and its POST /grooms/hire cases were retired by
 * Equoria-bvddn.7; the definitions and assignments/:foalId cases went with those
 * duplicate lookups, Equoria-a7f1p (owner ruling 2026-10-28, q151).)
 * Real DB, real auth — no bypass headers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

function uniqueEmail(prefix = 'gc') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'gc') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

describe('groomController integration', () => {
  let user;
  let token;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: uniqueEmail('groomctrl'),
        username: uniqueUsername('groomctrl'),
        password: 'irrelevant-hash',
        firstName: 'Groom',
        lastName: 'Tester',
        money: 5000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys). Grooms (userId-scoped) before
    // the user row. run() drains the queue this cycle and a failed delete fails
    // the suite instead of being swallowed and leaking a fixture into the
    // canonical DB. Runs after the nested horse afterEach (afterEach is
    // inner-first), so the per-test horse is already gone before the user delete.
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    await cleanup.run();
  }, 30000);

  // ─── GET /api/grooms/user/:userId ─────────────────────────────────────────

  describe('GET /api/grooms/user/:userId', () => {
    it('returns 200 with empty grooms for a brand-new user', async () => {
      const res = await request(app)
        .get(`/api/v1/grooms/user/${user.id}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.grooms)).toBe(true);
      expect(res.body.totalGrooms).toBe(0);
    });

    it("returns 404 when requesting another user's grooms (IDOR protection)", async () => {
      const otherUser = await prisma.user.create({
        data: {
          emailVerified: true,
          email: uniqueEmail('groomidor'),
          username: uniqueUsername('groomidor'),
          password: 'hash',
          firstName: 'Other',
          lastName: 'User',
          money: 0,
        },
      });

      const res = await request(app)
        .get(`/api/v1/grooms/user/${otherUser.id}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);

      // Scoped, fail-loud cleanup (Equoria-1ohys). otherUser owns no horse, so a
      // direct delete is correct here. Placed after the assertion (not in a
      // finally) so a cleanup failure cannot mask a test-body failure. No
      // swallowing .catch.
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/grooms/user/${user.id}`).set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });
});
