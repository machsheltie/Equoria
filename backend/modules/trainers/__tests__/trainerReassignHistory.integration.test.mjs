/**
 * Trainer re-assignment history and the ACTIVE-only unique invariant
 * (Equoria-kccmt, closing the owner decision Equoria-6p398.10).
 *
 * Same defect and same fix as the rider suite, on the trainer table.
 * `trainer_assignments` carried `@@unique([trainerId, horseId, isActive])`,
 * which capped assignment HISTORY for a pair at one row and made
 * `assignTrainer`'s unguarded `updateMany({ horseId, isActive: true } -> false)`
 * (`trainerController.mjs:130-133`) raise P2002 -> HTTP 500 on the sequence
 * assign T -> assign T2 -> assign T -> assign T3.
 *
 * The replacement is the partial unique index created in migration
 * 20260907120000_kccmt_partial_unique_active_staff_assignments
 * (`trainer_assignments_active_trainerId_horseId_key ... WHERE "isActive"`).
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
const FIXTURE_PREFIX = 'TestFixture-kccmt-trainer';

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
      firstName: 'Kccmt',
      lastName: 'TrainerOwner',
      money: 0,
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
    },
  });
}

async function makeTrainer(ownerId, label) {
  return prisma.trainer.create({
    data: {
      firstName: 'TestFixture',
      lastName: `${label}-${tag()}`,
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

describe('trainer re-assignment history (Equoria-kccmt)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let horse;
  let trainerA;
  let trainerB;
  let trainerC;

  beforeEach(async () => {
    owner = await makeUser();
    horse = await makeHorse(owner.id);
    trainerA = await makeTrainer(owner.id, 'TrainerA');
    trainerB = await makeTrainer(owner.id, 'TrainerB');
    trainerC = await makeTrainer(owner.id, 'TrainerC');

    const trainerIds = [trainerA.id, trainerB.id, trainerC.id];
    cleanup.add(() => prisma.trainerAssignment.deleteMany({ where: { horseId: horse.id } }), 'trainerAssignment');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: { in: trainerIds } } }), 'trainer');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('survives assign A -> B -> A -> C on one horse and keeps every historical row', async () => {
    const first = await assignTrainerRequest(owner.token, trainerA.id, horse.id);
    expect(first.status).toBe(201);
    const firstAssignmentId = first.body.data.id;

    const second = await assignTrainerRequest(owner.token, trainerB.id, horse.id);
    expect(second.status).toBe(201);

    const third = await assignTrainerRequest(owner.token, trainerA.id, horse.id);
    expect(third.status).toBe(201);
    const thirdAssignmentId = third.body.data.id;
    expect(thirdAssignmentId).not.toBe(firstAssignmentId);

    const fourth = await assignTrainerRequest(owner.token, trainerC.id, horse.id);
    expect(fourth.status).toBe(201);

    const rows = await prisma.trainerAssignment.findMany({
      where: { horseId: horse.id },
      select: { id: true, trainerId: true, isActive: true },
      orderBy: { id: 'asc' },
    });

    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.id)).toEqual(expect.arrayContaining([firstAssignmentId, thirdAssignmentId]));

    const trainerARows = rows.filter(r => r.trainerId === trainerA.id);
    expect(trainerARows).toHaveLength(2);
    expect(trainerARows.every(r => r.isActive === false)).toBe(true);

    const active = rows.filter(r => r.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].trainerId).toBe(trainerC.id);
  }, 60000);

  it('still refuses two ACTIVE rows for the same trainer and horse under concurrent writers', async () => {
    const insertActive = () =>
      prisma.$transaction(tx =>
        tx.trainerAssignment.create({
          data: { trainerId: trainerA.id, horseId: horse.id, userId: owner.id, isActive: true },
        }),
      );

    const results = await Promise.allSettled([insertActive(), insertActive()]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('P2002');

    expect(
      await prisma.trainerAssignment.count({
        where: { trainerId: trainerA.id, horseId: horse.id, isActive: true },
      }),
    ).toBe(1);
  }, 60000);

  it('permits many INACTIVE rows for the same trainer and horse', async () => {
    for (let i = 0; i < 3; i += 1) {
      await prisma.trainerAssignment.create({
        data: { trainerId: trainerA.id, horseId: horse.id, userId: owner.id, isActive: false },
      });
    }

    expect(
      await prisma.trainerAssignment.count({
        where: { trainerId: trainerA.id, horseId: horse.id, isActive: false },
      }),
    ).toBe(3);
  }, 60000);
});
