/**
 * POST /api/v1/groom-marketplace/hire — refusals carry a machine-readable code
 * (Equoria-dosig).
 *
 * A full roster and an unaffordable hire both answer 400, so the hire dialog
 * could not say which one stopped the player. Each now carries a `code`
 * (ROSTER_CAP_REACHED / INSUFFICIENT_FUNDS) beside the existing message and
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
import { MAX_GROOMS_PER_USER } from '../../../config/groomConfig.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-dosig-groom';
const SESSION_RATE = 100;
const HIRING_COST = SESSION_RATE * 7; // one week upfront

const createdUserIds = [];
const cleanup = createCleanupTracker();

async function makeUser(money) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
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
        name: `${FIXTURE_PREFIX}-seed-${i}-${randomBytes(3).toString('hex')}`,
        speciality: 'foal_care',
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
    personality: 'gentle',
    experience: 5,
    sessionRate: SESSION_RATE,
    bio: 'refusal-code fixture',
  }));
  await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'groom' } },
    create: { userId, staffType: 'groom', offers, refreshCount: 0 },
    update: { offers },
  });
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
  it('a full roster answers 400 with code ROSTER_CAP_REACHED and the cap counts', async () => {
    const { user, token } = await makeUser(HIRING_COST * 3);
    await seedGrooms(user.id, MAX_GROOMS_PER_USER);
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ROSTER_CAP_REACHED');
    expect(res.body.data).toEqual({
      currentCount: MAX_GROOMS_PER_USER,
      maxAllowed: MAX_GROOMS_PER_USER,
    });
    expect(await moneyOf(user.id)).toBe(HIRING_COST * 3);
  });

  it('an unaffordable hire answers 400 with code INSUFFICIENT_FUNDS and no debit', async () => {
    const { user, token } = await makeUser(HIRING_COST - 1);
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, mid);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
    expect(res.body.data).toMatchObject({ required: HIRING_COST });
    expect(await moneyOf(user.id)).toBe(HIRING_COST - 1);
    expect(await prisma.groom.count({ where: { userId: user.id } })).toBe(0);
  });

  it('a racing hire that loses the last slot still carries ROSTER_CAP_REACHED', async () => {
    const { user, token } = await makeUser(HIRING_COST * 5);
    await seedGrooms(user.id, MAX_GROOMS_PER_USER - 1); // one slot left, two competing hires
    const ids = await seedMarketplace(user.id, 2);

    const results = await Promise.all(ids.map(mid => hire(token, mid)));
    const rejected = results.filter(r => r.status === 400);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body.code).toBe('ROSTER_CAP_REACHED');
  });
});
