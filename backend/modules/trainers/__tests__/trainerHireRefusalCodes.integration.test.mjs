/**
 * POST /api/v1/trainers/marketplace/hire — refusals carry a machine-readable code
 * (Equoria-dosig)
 *
 * A full roster and an unaffordable hire both answer 400, so the hire dialog
 * could not say which one stopped the player. Each now carries a `code`
 * (rosterCapReached / insufficientFunds) beside the existing message and
 * data. Real app, real DB, id-scoped fail-loud cleanup.
 *
 * Equoria-3kegj. OLD CONTRACT: the hire charged four sessions up front, so a
 * player with less than that got 400 insufficientFunds. NEW RULING (owner,
 * 2026-10-22): hiring a trainer is free (the trainer's fee is charged per
 * training instead), so a trainer hire never refuses for money: a player with
 * no coins hires and is charged nothing. rosterCapReached is the only refusal.
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

// Owner ruling 2026-10-28 (q222, Equoria-asmsy) raised the stable-level-1 trainer cap
// from 1 to 2; these cases now seat one more trainer to reach it.
describe('POST /api/v1/trainers/marketplace/hire — refusal codes (Equoria-dosig)', () => {
  it('a full roster answers 400 with code rosterCapReached and the cap counts', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedTrainers(user.id, 2); // level 1 -> cap 2
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('rosterCapReached');
    expect(res.body.data).toEqual({ currentCount: 2, maxAllowed: 2 });
    expect(await moneyOf(user.id)).toBe(1000);
  });

  it('a player with no coins hires a trainer for free (Equoria-3kegj)', async () => {
    const { user, token } = await makeUser({ level: 1, money: 0 });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(0);
    expect(await moneyOf(user.id)).toBe(0);
    expect(await prisma.trainer.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.userTransaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it('a racing hire that loses the last slot still carries rosterCapReached', async () => {
    const { user, token } = await makeUser({ level: 1, money: 1000 });
    await seedTrainers(user.id, 1); // level 1 -> cap 2: one slot left
    const ids = await seedMarketplace(user.id, 2); // one slot, two competing hires

    const results = await Promise.all(ids.map(mid => hire(token, mid)));
    const rejected = results.filter(r => r.status === 400);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body.code).toBe('rosterCapReached');
  });
});
