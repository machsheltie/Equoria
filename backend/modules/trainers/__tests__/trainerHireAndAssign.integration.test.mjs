/**
 * POST /api/v1/trainers/marketplace/hire with a horseId — hire and assign in one step
 * (Equoria-1poxi, owner ruling q14 2026-10-23: the trainer listing's "Assign Trainer"
 * hires and assigns in one step; hiring is free).
 *
 * The hire and the assignment commit in ONE transaction, so a failure can never leave a
 * hired-but-unassigned trainer. Real app, real DB, id-scoped fail-loud cleanup.
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
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const fixturePrefix = 'TestFixture-1poxi-hireassign';

const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function makeUser({ level = 5 } = {}) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${fixturePrefix}-${tag}`,
      email: `${fixturePrefix}-${tag}@example.com`,
      password: pw,
      firstName: 'Hire',
      lastName: 'Assign',
      level,
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function seedHorse(userId, dateOfBirth = new Date('2020-01-01T00:00:00.000Z')) {
  return createTestHorse(
    prisma,
    {
      name: `${fixturePrefix}-horse-${randomBytes(3).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth,
      userId,
    },
    createdHorseIds,
  );
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
    sessionRate: 50,
    experience: 5,
    bio: 'hire-and-assign fixture',
  }));
  await prisma.staffMarketplaceState.create({
    data: { userId, staffType: 'trainer', offers, refreshCount: 0 },
  });
  return ids;
}

async function hire(token, body) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/trainers/marketplace/hire')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

beforeAll(() => {
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.trainerAssignment.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'trainerAssignment');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.trainer.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'trainer');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'staffMarketplaceState');
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horse');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('POST /api/v1/trainers/marketplace/hire with horseId (Equoria-1poxi)', () => {
  it('hires the trainer and assigns it to the horse in one request', async () => {
    const { user, token } = await makeUser();
    const horse = await seedHorse(user.id);
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, { marketplaceId: mid, horseId: horse.id });

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(0);
    expect(res.body.data.assignment.horseId).toBe(horse.id);
    const trainer = await prisma.trainer.findFirst({ where: { userId: user.id } });
    expect(trainer).not.toBeNull();
    const active = await prisma.trainerAssignment.findMany({
      where: { horseId: horse.id, isActive: true },
    });
    expect(active).toHaveLength(1);
    expect(active[0].trainerId).toBe(trainer.id);
  });

  it('replaces the previous trainer on the horse (one trainer per horse)', async () => {
    const { user, token } = await makeUser();
    const horse = await seedHorse(user.id);
    const [first, second] = await seedMarketplace(user.id, 2);

    expect((await hire(token, { marketplaceId: first, horseId: horse.id })).status).toBe(201);
    expect((await hire(token, { marketplaceId: second, horseId: horse.id })).status).toBe(201);

    const active = await prisma.trainerAssignment.count({
      where: { horseId: horse.id, isActive: true },
    });
    expect(active).toBe(1);
  });

  it("a horse that is not the player's is refused 404 and nothing is hired", async () => {
    const { user, token } = await makeUser();
    const other = await makeUser();
    const foreignHorse = await seedHorse(other.user.id);
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, { marketplaceId: mid, horseId: foreignHorse.id });

    expect(res.status).toBe(404);
    expect(await prisma.trainer.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.trainerAssignment.count({ where: { userId: user.id } })).toBe(0);
    const state = await prisma.staffMarketplaceState.findFirst({
      where: { userId: user.id, staffType: 'trainer' },
    });
    expect(state.offers).toHaveLength(1);
  });

  it('a retired horse is refused and nothing is hired', async () => {
    const { user, token } = await makeUser();
    const retired = await seedHorse(user.id, new Date('2000-01-01T00:00:00.000Z'));
    // The nightly aging pass stores the age; 22 is retired (21+, not in foal).
    await prisma.horse.update({ where: { id: retired.id }, data: { age: 22 } });
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, { marketplaceId: mid, horseId: retired.id });

    expect(res.status).toBe(400);
    expect(await prisma.trainer.count({ where: { userId: user.id } })).toBe(0);
  });

  it('without a horseId the hire still hires only (no assignment)', async () => {
    const { user, token } = await makeUser();
    const [mid] = await seedMarketplace(user.id, 1);

    const res = await hire(token, { marketplaceId: mid });

    expect(res.status).toBe(201);
    expect(res.body.data.assignment).toBeUndefined();
    expect(await prisma.trainerAssignment.count({ where: { userId: user.id } })).toBe(0);
  });
});
