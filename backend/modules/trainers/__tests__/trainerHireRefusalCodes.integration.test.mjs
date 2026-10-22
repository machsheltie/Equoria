/**
 * POST /api/v1/trainers/marketplace/hire — refusals carry a machine-readable code
 * (Equoria-dosig)
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

const fixturePrefix = 'TestFixture-dosig-trainer';
const offerRate = 50;
const hiringCost = offerRate * 4; // the backend charges four sessions up front

const createdUserIds = [];
const cleanup = createCleanupTracker();

async function makeUser({ level, money }) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
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

async function seedTrainers(userId, active) {
  for (let i = 0; i < active; i++) {
    await prisma.trainer.create({
      data: {
        userId,
        firstName: 'Seed',
        lastName: `Trainer${randomBytes(3).toString('hex')}`,
        personality: 'patient',
        skillLevel: 'expert',
        speciality: 'Dressage',
        sessionRate: offerRate,
      },
    });
  }
}

async function seedMarketplace(userId, count) {
  const ids = Array.from({ length: count }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = ids.map((marketplaceId, i) => ({
    marketplaceId,
    firstName: 'Offer',
    lastName: `Trainer${i}`,
    personality: 'patient',
    skillLevel: 'expert',
    speciality: 'Dressage',
    sessionRate: offerRate,
    experience: 5,
    bio: 'refusal-code fixture',
  }));
  await prisma.staffMarketplaceState.create({ data: { userId, staffType: 'trainer', offers, refreshCount: 0 } });
  return ids;
}

async function hire(token, marketplaceId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/trainers/marketplace/hire')
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
      return prisma.trainer.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'trainer');
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

describe('POST /api/v1/trainers/marketplace/hire — refusal codes (Equoria-dosig)', () => {
  it('a full roster answers 400 with code rosterCapReached and the cap counts', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedTrainers(user.id, 1); // level 1 -> cap 1
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('rosterCapReached');
    expect(res.body.data).toEqual({ currentCount: 1, maxAllowed: 1 });
    expect(await moneyOf(user.id)).toBe(1000);
  });

  it('an unaffordable hire answers 400 with code insufficientFunds and no debit', async () => {
    const { user, token } = await makeUser({ level: 1, money: hiringCost - 1 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    expect(res.body.data).toEqual({ required: hiringCost, available: hiringCost - 1 });
    expect(await moneyOf(user.id)).toBe(hiringCost - 1);
    expect(await prisma.trainer.count({ where: { userId: user.id } })).toBe(0);
  });

  it('a racing hire that loses the last slot still carries rosterCapReached', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    const ids = await seedMarketplace(user.id, 2); // one slot, two competing hires

    const results = await Promise.all(ids.map(mid => hire(token, mid)));
    const rejected = results.filter(r => r.status === 400);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body.code).toBe('rosterCapReached');
  });
});
