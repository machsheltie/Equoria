/**
 * 🧪 REGRESSION: POST /api/v1/users/:id/add-xp is closed (Equoria-bvddn.1)
 *
 * Audit finding (2026-09-25): the self-service add-xp route was gated only by
 * `requireSelfAccess()`. Its `body('amount').isInt({ min: 1 })` rule never
 * fired because the validation-result check lives inside `validateUserId`,
 * which runs BEFORE the `amount` rule is appended to the middleware array —
 * so any authenticated player could POST an arbitrary amount (including
 * absurd values) against their own account and have it applied verbatim by
 * `addXpToUser`. User XP/level feeds public leaderboards
 * (leaderboardService.mjs) and the trainer roster cap
 * (trainerMarketplaceController.mjs), so this was a self-serve progression
 * faucet — the same shape as the horse XP faucet closed under
 * Equoria-6p398.3.
 *
 * This suite proves, against the real database:
 * - A self-service call is 410 Gone and leaves `User.xp` / `User.level`
 *   completely unchanged (the audited exploit is dead).
 * - An anonymous caller still gets 401 (route-level auth untouched).
 * - A cross-user id also gets 410 (the closure no longer runs a self-access
 *   check at all — every authenticated caller is refused alike).
 *
 * Before the fix, the first test in this file fails: the route answers 200
 * and `User.xp` increases by the requested amount.
 */

import { randomUUID } from 'crypto';
import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const app = (await import('../../../app.mjs')).default;

describe('🔒 REGRESSION: POST /api/v1/users/:id/add-xp is closed (Equoria-bvddn.1)', () => {
  let testUser;
  let authToken;
  let otherUser;
  let createdUserIds;

  beforeEach(async () => {
    createdUserIds = [];

    const ownerResult = await createTestUser({
      username: `xpclosed_owner_${randomUUID().slice(0, 8)}`,
      email: `xpclosed_owner_${randomUUID().slice(0, 8)}@test.com`,
      money: 1000,
      xp: 100,
      level: 2,
    });
    testUser = ownerResult.user;
    authToken = ownerResult.token;
    createdUserIds.push(testUser.id);

    const otherResult = await createTestUser({
      username: `xpclosed_other_${randomUUID().slice(0, 8)}`,
      email: `xpclosed_other_${randomUUID().slice(0, 8)}@test.com`,
      money: 1000,
      xp: 0,
      level: 1,
    });
    otherUser = otherResult.user;
    createdUserIds.push(otherUser.id);
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('refuses a self-service XP grant with 410 and leaves xp/level unchanged', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    const response = await request(app)
      .post(`/api/v1/users/${testUser.id}/add-xp`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 2000000000 });

    expect(response.status).toBe(410);
    expect(response.body.success).toBe(false);

    const persisted = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { xp: true, level: true },
    });
    expect(persisted.xp).toBe(100);
    expect(persisted.level).toBe(2);
  });

  it('returns 401 for an anonymous caller (no DB change)', async () => {
    const csrf = await fetchCsrf(app);

    const response = await request(app)
      .post(`/api/v1/users/${testUser.id}/add-xp`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50 });

    expect(response.status).toBe(401);

    const persisted = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { xp: true },
    });
    expect(persisted.xp).toBe(100);
  });

  it('returns 410 for a cross-user id too (no self-access check runs)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    const response = await request(app)
      .post(`/api/v1/users/${otherUser.id}/add-xp`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50 });

    expect(response.status).toBe(410);

    const persisted = await prisma.user.findUnique({
      where: { id: otherUser.id },
      select: { xp: true },
    });
    expect(persisted.xp).toBe(0);
  });
});
