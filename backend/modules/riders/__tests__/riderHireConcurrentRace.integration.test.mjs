/**
 * POST /api/riders/marketplace/hire — concurrent-race sentinel (Equoria-kyrqo).
 *
 * Sibling of trainerHireConcurrentRace.integration.test.mjs. The rider fix
 * additionally wrapped rider.create + conditional money debit in a single
 * transaction (previously two unrelated writes — rider could persist with no
 * debit on failure).
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

const FIXTURE_PREFIX = 'TestFixture-kyrqo-rider';
const N_HIRES = 4;

let buyer;
let buyerToken;
let marketplaceIds;
let hiringCost;
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
  ({ user: buyer, token: buyerToken } = await makeUser('buyer', 0));

  // weeklyRate = hiringCost (controller line 191). Use 100.
  hiringCost = 100;
  await prisma.user.update({ where: { id: buyer.id }, data: { money: hiringCost } });

  marketplaceIds = Array.from({ length: N_HIRES }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = marketplaceIds.map((mid, i) => ({
    marketplaceId: mid,
    firstName: 'Race',
    lastName: `Rider${i}`,
    personality: 'calm',
    skillLevel: 'experienced',
    speciality: 'Show Jumping',
    weeklyRate: 100,
    experience: 5,
    bio: 'race fixture',
  }));

  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId: buyer.id, staffType: 'rider' } },
    create: { userId: buyer.id, staffType: 'rider', offers, refreshCount: 0 },
    update: { offers },
  });
  createdMarketplaceStateIds.push(state.id);

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: the riders the hire
  // path created (scoped to buyer.id) and the per-id marketplace-state rows
  // BEFORE the user rows. No horses are created by the hire flow, so there is
  // no Horse.userId (onDelete:Restrict) row to delete first. A failed delete
  // fails the suite instead of being swallowed and leaking a fixture into the
  // canonical DB.
  cleanup.add(() => {
    if (buyer) {
      return prisma.rider.deleteMany({ where: { userId: buyer.id } });
    }
    return undefined;
  }, 'rider');
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

describe('POST /api/riders/marketplace/hire — concurrent-race sentinel (Equoria-kyrqo)', () => {
  it('SENTINEL: N parallel hires from same buyer with only ONE hire of money, never goes negative + tx atomic', async () => {
    const csrfPerReq = await Promise.all(marketplaceIds.map(() => fetchCsrf(app)));
    const results = await Promise.all(
      marketplaceIds.map((mid, i) =>
        request(app)
          .post('/api/riders/marketplace/hire')
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
    expect(successes.length).toBeLessThanOrEqual(1);

    for (const r of results) {
      expect(r.status === 201 || (r.status >= 400 && r.status < 500)).toBe(true);
    }

    const after = await prisma.user.findUnique({
      where: { id: buyer.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBeGreaterThanOrEqual(0);
    expect([0, hiringCost]).toContain(Number(after.money));

    // Tx atomic: rider rows == successes (no orphan rider with no debit).
    const riderCount = await prisma.rider.count({ where: { userId: buyer.id } });
    expect(riderCount).toBe(successes.length);
  });
});
