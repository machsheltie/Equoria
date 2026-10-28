/**
 * POST /api/v1/riders/marketplace/hire — refusals carry a machine-readable code
 * (Equoria-dosig) and the charge is ONE week's pay (owner ruling 2026-10-22,
 * Equoria-yw6w1).
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

const fixturePrefix = 'TestFixture-dosig-rider';
const offerRate = 100; // hiringCost = weeklyRate (one week, never four)

const createdUserIds = [];
const cleanup = createCleanupTracker();

async function makeUser({ level, money }) {
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
      level,
      money,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function seedRiders(userId, active) {
  for (let i = 0; i < active; i++) {
    await prisma.rider.create({
      data: {
        userId,
        firstName: 'Seed',
        lastName: `Rider${randomBytes(3).toString('hex')}`,
        personality: 'calm',
        skillLevel: 'experienced',
        speciality: 'Show Jumping',
        weeklyRate: offerRate,
      },
    });
  }
}

async function seedMarketplace(userId, count) {
  const ids = Array.from({ length: count }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = ids.map((marketplaceId, i) => ({
    marketplaceId,
    firstName: 'Offer',
    lastName: `Rider${i}`,
    personality: 'calm',
    skillLevel: 'rookie',
    // Owner ruling 2026-10-28 (q226): the hire charges the offer's star level price.
    starLevel: 'rookie',
    speciality: 'Show Jumping',
    weeklyRate: offerRate,
    experience: 5,
    bio: 'refusal-code fixture',
  }));
  await prisma.staffMarketplaceState.create({ data: { userId, staffType: 'rider', offers, refreshCount: 0 } });
  return ids;
}

async function hire(token, marketplaceId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/riders/marketplace/hire')
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
      return prisma.rider.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'rider');
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

describe('POST /api/v1/riders/marketplace/hire — refusal codes (Equoria-dosig)', () => {
  it('a full roster answers 400 with code rosterCapReached and the cap counts', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedRiders(user.id, 2); // level 1 -> cap 2
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('rosterCapReached');
    expect(res.body.data).toEqual({ currentCount: 2, maxAllowed: 2 });
    expect(await moneyOf(user.id)).toBe(1000);
  });

  it('an unaffordable hire answers 400 with code insufficientFunds and no debit', async () => {
    const { user, token } = await makeUser({ level: 1, money: offerRate - 1 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    expect(res.body.data).toEqual({ required: offerRate, available: offerRate - 1 });
    expect(await moneyOf(user.id)).toBe(offerRate - 1);
    expect(await prisma.rider.count({ where: { userId: user.id } })).toBe(0);
  });

  it('a racing hire that loses the last slot still carries rosterCapReached', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedRiders(user.id, 1); // one slot left, two competing hires
    const ids = await seedMarketplace(user.id, 2);

    const results = await Promise.all(ids.map(mid => hire(token, mid)));
    const rejected = results.filter(r => r.status === 400);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body.code).toBe('rosterCapReached');
  });

  it('one week of pay is enough: a player holding exactly the weekly rate can hire', async () => {
    const { user, token } = await makeUser({ level: 1, money: offerRate });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(offerRate);
    expect(await moneyOf(user.id)).toBe(0);
  });
});
