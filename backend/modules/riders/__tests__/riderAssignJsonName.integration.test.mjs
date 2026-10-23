/**
 * POST /api/v1/riders/assignments — the horse.rider JSONB carries the rider's
 * name (Equoria-oey96.50).
 *
 * assignRider wrote `name: rider.name` into the horse's `rider` JSON, but the
 * Rider row has firstName/lastName and no `name` column, so the stored name was
 * undefined and JSON serialization dropped the key. Every reader of
 * `horse.rider` (the horse overview among them) got no name. The write now joins
 * firstName and lastName, the way getUserRiders builds its display name.
 *
 * Real DB, no mocks, id-scoped fail-loud cleanup.
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

const FIXTURE_PREFIX = 'TestFixture-oey96_50-riderName';

const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function makeUser() {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Assign',
      lastName: 'Guard',
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function seedRider(userId, { retired }) {
  return prisma.rider.create({
    data: {
      userId,
      firstName: 'Seed',
      lastName: `Rider${randomBytes(3).toString('hex')}`,
      personality: 'calm',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      weeklyRate: 100,
      retired,
    },
  });
}

async function seedHorse(userId) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `${FIXTURE_PREFIX}-horse-${randomBytes(3).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01T00:00:00.000Z'),
      userId,
    },
    createdHorseIds,
  );
  return horse;
}

async function assign(token, { riderId, horseId }) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/riders/assignments')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ riderId, horseId });
}

beforeAll(() => {
  // FK-safe, id-scoped cleanup. Assignments cascade-delete with the rider/horse,
  // but delete them explicitly first so an ordering surprise fails loud, not silent.
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.riderAssignment.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'riderAssignment');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.rider.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'rider');
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horse');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('POST /api/v1/riders/assignments — horse.rider name (Equoria-oey96.50)', () => {
  it('stores the rider full name, id, level and speciality in horse.rider', async () => {
    const { user, token } = await makeUser();
    const rider = await seedRider(user.id, { retired: false });
    const horse = await seedHorse(user.id);

    const res = await assign(token, { riderId: rider.id, horseId: horse.id });
    expect(res.status).toBe(201);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { rider: true },
    });
    expect(after.rider).toEqual({
      id: rider.id,
      name: `${rider.firstName} ${rider.lastName}`,
      level: rider.level,
      speciality: rider.speciality,
    });
  });
});
