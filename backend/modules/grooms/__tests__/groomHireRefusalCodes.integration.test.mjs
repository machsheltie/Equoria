/**
 * POST /api/v1/groom-marketplace/hire — refusals carry a machine-readable code
 * (Equoria-dosig).
 *
 * A full roster and an unaffordable hire both answer 400, so the hire dialog
 * could not say which one stopped the player. Each now carries a `code`
 * (rosterCapReached / insufficientFunds) beside the existing message and
 * data. Real app, real DB, id-scoped fail-loud cleanup.
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

// Mirrors the roster cap in config/groomConfig.mjs, named in camelCase for the naming ratchet.
const maxGroomsPerUser = 10;
const fixturePrefix = 'TestFixture-dosig-groom';
const offerRate = 100;
// Owner ruling 2026-10-28 (q226): one week at the offer's star level price (Advanced).
const hiringCost = 400;

const createdUserIds = [];
const cleanup = createCleanupTracker();

async function makeUser(money) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${fixturePrefix}-${tag}`,
      email: `${fixturePrefix}-${tag}@example.com`,
      password: pw,
      firstName: 'Code',
      lastName: 'Buyer',
      money,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function seedGrooms(userId, count) {
  for (let i = 0; i < count; i++) {
    await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-seed-${i}-${randomBytes(3).toString('hex')}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId,
      },
    });
  }
}

async function seedMarketplace(userId, count) {
  const ids = Array.from({ length: count }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = ids.map((marketplaceId, i) => ({
    marketplaceId,
    firstName: 'Offer',
    lastName: `Groom${i}`,
    specialty: 'general',
    skillLevel: 'experienced',
    starLevel: 'advanced',
    personality: 'gentle',
    experience: 5,
    sessionRate: offerRate,
    bio: 'refusal-code fixture',
  }));
  await prisma.staffMarketplaceState.create({ data: { userId, staffType: 'groom', offers, refreshCount: 0 } });
  return ids;
}

async function hire(token, marketplaceId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/groom-marketplace/hire')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ marketplaceId });
}

async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

beforeAll(() => {
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.groom.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'groom');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.userTransaction.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'userTransaction');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'staffMarketplaceState');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
});

afterAll(() => cleanup.run(), 30000);

describe('POST /api/v1/groom-marketplace/hire — refusal codes (Equoria-dosig)', () => {
  it('a full roster answers 400 with code rosterCapReached and the cap counts', async () => {
    const { user, token } = await makeUser(hiringCost * 3);
    await seedGrooms(user.id, maxGroomsPerUser);
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('rosterCapReached');
    expect(res.body.data).toEqual({
      currentCount: maxGroomsPerUser,
      maxAllowed: maxGroomsPerUser,
    });
    expect(await moneyOf(user.id)).toBe(hiringCost * 3);
  });

  it('an unaffordable hire answers 400 with code insufficientFunds and no debit', async () => {
    const { user, token } = await makeUser(hiringCost - 1);
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    expect(res.body.data).toMatchObject({ required: hiringCost });
    expect(await moneyOf(user.id)).toBe(hiringCost - 1);
    expect(await prisma.groom.count({ where: { userId: user.id } })).toBe(0);
  });

  it('a racing hire that loses the last slot still carries rosterCapReached', async () => {
    const { user, token } = await makeUser(hiringCost * 5);
    await seedGrooms(user.id, maxGroomsPerUser - 1); // one slot left, two competing hires
    const ids = await seedMarketplace(user.id, 2);

    const results = await Promise.all(ids.map(mid => hire(token, mid)));
    const rejected = results.filter(r => r.status === 400);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body.code).toBe('rosterCapReached');
  });
});
