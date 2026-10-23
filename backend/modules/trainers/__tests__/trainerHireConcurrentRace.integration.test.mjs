/**
 * POST /api/trainers/marketplace/hire — concurrent-race sentinel (Equoria-kyrqo).
 *
 * Sibling of Equoria-zz1ii (buyHorseConcurrentRace.integration.test.mjs). The
 * fix replaced the unconditional tx.user.update with a conditional
 * tx.user.updateMany({ where: { id, money: { gte: hiringCost } } }) inside the
 * existing $transaction, plus added mutationRateLimiter to the route.
 *
 * This sentinel fires N concurrent hire requests for the SAME marketplaceId
 * from N DIFFERENT buyers (each with EXACTLY hiringCost in their wallet) and
 * asserts:
 *   - Multiple successes are POSSIBLE here because the trainer marketplace is
 *     a per-user offer list (each user has their own staffMarketplaceState),
 *     so two buyers can each hire their own copy of "marketplaceId X". The
 *     TOCTOU we actually guard against is the SAME user firing two concurrent
 *     hires that would otherwise double-debit. That's tested below by spawning
 *     N concurrent hires from the SAME buyer for DIFFERENT marketplaceIds when
 *     money only covers one.
 *   - The buyer's money never goes negative.
 *   - At most floor(initialMoney / hiringCost) hires succeed.
 *
 * Equoria-3kegj. OLD CONTRACT: each hire cost sessionRate * 4, the buyer held
 * exactly one hire's worth, and the money debit was the guard. NEW RULING
 * (owner, 2026-10-22): hiring a trainer is free. The same-buyer race is now
 * guarded by the roster cap re-count under the User row lock: a level-1 buyer
 * (cap 1) firing N concurrent hires gets at most one trainer, and no coins move.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import config from '../../../config/config.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-kyrqo-trainer';
const N_HIRES = 4;

let buyer;
let buyerToken;
let marketplaceIds;
const createdUserIds = [];
const createdMarketplaceStateIds = [];
const cleanup = createCleanupTracker();

async function makeUser(suffix, money) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Hire',
      lastName: suffix,
      money,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: '1h',
  });
  return { user, token };
}

beforeAll(async () => {
  // A level-1 buyer (trainer roster cap 1) with no coins: hiring is free.
  ({ user: buyer, token: buyerToken } = await makeUser('buyer', 0));

  marketplaceIds = Array.from({ length: N_HIRES }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = marketplaceIds.map((mid, i) => ({
    marketplaceId: mid,
    firstName: 'Race',
    lastName: `Trainer${i}`,
    personality: 'cheerful',
    skillLevel: 'experienced',
    speciality: 'Dressage',
    sessionRate: 100,
    bio: 'race fixture',
  }));

  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId: buyer.id, staffType: 'trainer' } },
    create: { userId: buyer.id, staffType: 'trainer', offers, refreshCount: 0 },
    update: { offers },
  });
  createdMarketplaceStateIds.push(state.id);

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: the trainers the hire
  // path created (scoped to buyer.id) and the per-id marketplace-state rows
  // BEFORE the user rows. No horses are created by the hire flow, so there is
  // no Horse.userId (onDelete:Restrict) row to delete first. A failed delete
  // fails the suite instead of being swallowed and leaking a fixture into the
  // canonical DB.
  cleanup.add(() => {
    if (buyer) {
      return prisma.trainer.deleteMany({ where: { userId: buyer.id } });
    }
    return undefined;
  }, 'trainer');
  cleanup.add(
    () => Promise.all(createdMarketplaceStateIds.map(id => prisma.staffMarketplaceState.delete({ where: { id } }))),
    'staffMarketplaceState',
  );
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
}, 60000);

afterAll(() => cleanup.run(), 30000);

describe('POST /api/trainers/marketplace/hire — concurrent-race sentinel (Equoria-kyrqo)', () => {
  it('SENTINEL: N parallel hires from a cap-1 buyer: at most one trainer, no coins move', async () => {
    // Fire N concurrent hire requests for N different marketplaceIds.
    // The buyer's roster cap is 1 — only ONE may succeed.
    // Each request needs a CSRF token (real production middleware, no bypass).
    const csrfPerReq = await Promise.all(marketplaceIds.map(() => fetchCsrf(app)));
    const results = await Promise.all(
      marketplaceIds.map((mid, i) =>
        request(app)
          .post('/api/v1/trainers/marketplace/hire')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${buyerToken}`)
          .set('Cookie', csrfPerReq[i].cookieHeader)
          .set('X-CSRF-Token', csrfPerReq[i].csrfToken)
          .send({ marketplaceId: mid })
          .then(res => ({ status: res.status, body: res.body }))
          .catch(err => ({ status: 0, error: err.message })),
      ),
    );

    const successes = results.filter(r => r.status === 201);
    // At most one 201 — a second would exceed the roster cap.
    expect(successes.length).toBeLessThanOrEqual(1);

    // All non-success responses are 4xx (400 roster cap, 409 stale offer,
    // 429 rate-limit). Never 500, never 201 beyond the cap.
    for (const r of results) {
      expect(r.status === 201 || (r.status >= 400 && r.status < 500)).toBe(true);
    }

    // Hiring is free: the buyer's coins never move and no ledger row is written.
    const after = await prisma.user.findUnique({
      where: { id: buyer.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(0);
    expect(await prisma.userTransaction.count({ where: { userId: buyer.id } })).toBe(0);

    // Number of trainer rows created == number of successes.
    const trainerCount = await prisma.trainer.count({ where: { userId: buyer.id } });
    expect(trainerCount).toBe(successes.length);
  });
});
