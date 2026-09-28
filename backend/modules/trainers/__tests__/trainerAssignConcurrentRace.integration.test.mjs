/**
 * POST /api/trainers/assignments — concurrent-assign race (Equoria-bvddn.8).
 *
 * The defect: `assignTrainer` read "does this trainer already have an active
 * assignment?" (`prisma.trainerAssignment.findFirst({ where: { trainerId,
 * isActive: true } })`) and then wrote (deactivate-on-this-horse + create) as
 * TWO separate, unwrapped statements outside any transaction. Two concurrent
 * assign requests for the SAME trainer but DIFFERENT horses can both read
 * "no active assignment" before either commits its create, and both insert —
 * leaving the trainer with two simultaneously-active assignments, which the
 * DB cannot catch because the only DB constraint
 * (`trainer_assignments_active_trainerId_horseId_key`, Equoria-kccmt) is a
 * partial unique index scoped to the (trainerId, horseId) PAIR, not to
 * trainerId alone — it only stops double-booking the SAME horse, not the
 * trainer being active on two different horses at once.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-bvddn8-trainer';
const N_ATTEMPTS = 6;

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser() {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-owner-${suffix}`,
      email: `${FIXTURE_PREFIX}-owner-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Bvddn8',
      lastName: 'TrainerOwner',
      money: 0,
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId, label) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${label}-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
    },
  });
}

async function makeTrainer(ownerId) {
  return prisma.trainer.create({
    data: {
      firstName: 'TestFixture',
      lastName: `Bvddn8-${tag()}`,
      personality: 'focused',
      skillLevel: 'expert',
      speciality: 'Dressage',
      sessionRate: 150,
      level: 3,
      userId: ownerId,
    },
  });
}

function assignTrainerRequest(token, trainerId, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post('/api/v1/trainers/assignments')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId, horseId }),
  );
}

describe('trainer assign concurrency (Equoria-bvddn.8)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let trainer;
  let horses;

  beforeEach(async () => {
    owner = await makeUser();
    trainer = await makeTrainer(owner.id);
    horses = await Promise.all(Array.from({ length: N_ATTEMPTS }, (_, i) => makeHorse(owner.id, String(i))));

    const horseIds = horses.map(h => h.id);
    cleanup.add(() => prisma.trainerAssignment.deleteMany({ where: { trainerId: trainer.id } }), 'trainerAssignment');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: trainer.id } }), 'trainer');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('never leaves one trainer with two simultaneously-active assignments under concurrent assign requests to different horses', async () => {
    const responses = await Promise.all(horses.map(horse => assignTrainerRequest(owner.token, trainer.id, horse.id)));

    const succeeded = responses.filter(r => r.status === 201);
    const rejected = responses.filter(r => r.status === 400);

    // Every response must be either a success or the documented
    // "already assigned elsewhere" business rejection — never a 500.
    expect(succeeded.length + rejected.length).toBe(N_ATTEMPTS);

    const activeRows = await prisma.trainerAssignment.findMany({
      where: { trainerId: trainer.id, isActive: true },
    });

    // The invariant under test: at most ONE active assignment for this
    // trainer, no matter how many concurrent requests raced for it.
    expect(activeRows).toHaveLength(1);
    expect(succeeded).toHaveLength(1);
  }, 60000);
});
