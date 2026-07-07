/**
 * POST /api/v1/trainers/assignments — retired-trainer assign guard (Equoria-oey96.24).
 *
 * Audit finding P2-14: retired trainers can still be ASSIGNED via direct API.
 * PRD-06 §2.3: "Retired riders/trainers cannot be assigned." getUserTrainers
 * filters retired:false so the UI hides them, but assignTrainer only checked
 * ownership (findFirst { id, userId }) — a direct POST assigns a retired
 * trainer. This is the assign-time complement to the roster-cap guard
 * (oey96.8, which already excludes retired trainers from the cap count).
 *
 * The fix returns 400 (a business-rule rejection, matching the sibling
 * "already assigned to another horse" 400 in the same controller) rather than
 * folding retired into the 404 not-found path — a retired trainer the player
 * owns IS found; the honest message is "this trainer is retired", not "not
 * found". Unlike riders, trainer assignment does not sync a horse JSONB field,
 * so the persistence assertion is limited to "no trainerAssignment row".
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

const FIXTURE_PREFIX = 'TestFixture-oey96_24-trainer';

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

async function seedTrainer(userId, { retired }) {
  return prisma.trainer.create({
    data: {
      userId,
      firstName: 'Seed',
      lastName: `Trainer${randomBytes(3).toString('hex')}`,
      personality: 'focused',
      skillLevel: 'expert',
      speciality: 'Dressage',
      sessionRate: 150,
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

async function assign(token, { trainerId, horseId }) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/trainers/assignments')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ trainerId, horseId });
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
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horse');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('POST /api/v1/trainers/assignments — retired guard (Equoria-oey96.24)', () => {
  it('REJECTS a RETIRED trainer: 400, no assignment row created', async () => {
    const { user, token } = await makeUser();
    const trainer = await seedTrainer(user.id, { retired: true });
    const horse = await seedHorse(user.id);

    const res = await assign(token, { trainerId: trainer.id, horseId: horse.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message).toLowerCase()).toContain('retired');

    const rows = await prisma.trainerAssignment.count({ where: { trainerId: trainer.id } });
    expect(rows).toBe(0);
  });

  it('CONTROL: a NON-retired trainer assigns fine (201, assignment row created)', async () => {
    const { user, token } = await makeUser();
    const trainer = await seedTrainer(user.id, { retired: false });
    const horse = await seedHorse(user.id);

    const res = await assign(token, { trainerId: trainer.id, horseId: horse.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const rows = await prisma.trainerAssignment.count({
      where: { trainerId: trainer.id, isActive: true },
    });
    expect(rows).toBe(1);
  });
});
