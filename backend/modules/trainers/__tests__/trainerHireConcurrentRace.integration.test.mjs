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

const FIXTURE_PREFIX = 'TestFixture-kyrqo-trainer';
const N_HIRES = 4;

let buyer;
let buyerToken;
let marketplaceIds;
let hiringCost;
const createdUserIds = [];
const createdTrainerIds = [];
const createdMarketplaceStateIds = [];

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
  ({ user: buyer, token: buyerToken } = await makeUser('buyer', 0));

  // Build a marketplace with N trainer offers each costing the same.
  // sessionRate * 4 = hiringCost (controller line 191). Use 100 → 400 each.
  hiringCost = 100 * 4;
  // Seed buyer with EXACTLY one hire's worth — if any race lets two through,
  // money would go negative.
  await prisma.user.update({ where: { id: buyer.id }, data: { money: hiringCost } });

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
}, 60000);

afterAll(async () => {
  // Clean up any trainers the test created (scoped by userId).
  if (buyer) {
    await prisma.trainer.deleteMany({ where: { userId: buyer.id } }).catch(() => {});
  }
  for (const id of createdMarketplaceStateIds) {
    await prisma.staffMarketplaceState.delete({ where: { id } }).catch(() => {});
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
}, 30000);

describe('POST /api/trainers/marketplace/hire — concurrent-race sentinel (Equoria-kyrqo)', () => {
  it('SENTINEL: N parallel hires from same buyer with only ONE hire of money, never goes negative', async () => {
    // Fire N concurrent hire requests for N different marketplaceIds.
    // Buyer has exactly hiringCost in wallet — only ONE may succeed.
    // Each request needs a CSRF token (real production middleware, no bypass).
    const csrfPerReq = await Promise.all(marketplaceIds.map(() => fetchCsrf(app)));
    const results = await Promise.all(
      marketplaceIds.map((mid, i) =>
        request(app)
          .post('/api/trainers/marketplace/hire')
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
    // At most one 201 — buyer only had hiringCost; second would go negative.
    expect(successes.length).toBeLessThanOrEqual(1);

    // All non-success responses are 4xx (400 insufficient funds, 429 rate-limit,
    // or 404). Never 500, never 201 beyond the cap.
    for (const r of results) {
      expect(r.status === 201 || (r.status >= 400 && r.status < 500)).toBe(true);
    }

    // Final money state: if 0 successes (all lost), money == hiringCost. If
    // 1 success, money == 0. NEVER negative.
    const after = await prisma.user.findUnique({
      where: { id: buyer.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
    expect([0, hiringCost]).toContain(Number(after.money));

    // Number of trainer rows created == number of successes.
    const trainerCount = await prisma.trainer.count({ where: { userId: buyer.id } });
    expect(trainerCount).toBe(successes.length);
  });
});
