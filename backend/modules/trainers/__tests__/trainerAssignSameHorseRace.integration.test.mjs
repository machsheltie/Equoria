/**
 * POST /api/v1/trainers/assignments: two DIFFERENT trainers assigned to the
 * SAME horse at once leave exactly one active trainer on it (Equoria-j8s5c).
 *
 * Assigning a trainer replaces whoever trains the horse: the handler
 * deactivates the horse's active assignment and creates the new one. Since
 * Equoria-bvddn.8 the transaction serialises on the TRAINER row, which closes
 * one-trainer/two-horses but not two-trainers/one-horse: the two transactions
 * lock different trainer rows, both find no active assignment on the horse to
 * deactivate, and both insert. The partial unique index is per (trainerId,
 * horseId), so the database accepts both.
 *
 * HOW THE RACE IS FORCED: a dedicated client holds the horse row FOR UPDATE.
 * Both requests are started and observed queued behind it (pre-fix they queue
 * at their assignment insert, whose foreign key needs a share lock on the
 * horse, after their deactivate step already ran; post-fix they queue at the
 * horse lock the transaction takes first). Then the barrier is released.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, horseRowLock, raceBehindLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-j8s5c-trainer';
const tag = () => randomBytes(6).toString('hex');
const barrierClient = createBarrierClient();

describe('trainer assign: two trainers, one horse (Equoria-j8s5c)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let token;
  let horse;
  let trainers;

  beforeEach(async () => {
    const suffix = tag();
    owner = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'J8s5c',
        lastName: 'Owner',
        money: 0,
      },
    });
    token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-horse-${suffix}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        userId: owner.id,
        healthStatus: 'Excellent',
      },
    });
    trainers = [];
    for (const label of ['a', 'b']) {
      trainers.push(
        await prisma.trainer.create({
          data: {
            firstName: 'TestFixture',
            lastName: `J8s5c-${label}-${tag()}`,
            personality: 'focused',
            skillLevel: 'expert',
            speciality: 'Dressage',
            sessionRate: 150,
            userId: owner.id,
          },
        }),
      );
    }
    cleanup.add(() => prisma.trainerAssignment.deleteMany({ where: { horseId: horse.id } }), 'trainerAssignment');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { userId: owner.id } }), 'trainers');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);
  afterAll(() => barrierClient.$disconnect(), 30000);

  const assign = trainerId => async () => {
    const csrf = await fetchCsrf(app);
    return request(app)
      .post('/api/v1/trainers/assignments')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId, horseId: horse.id });
  };

  it('leaves exactly one active trainer on the horse', async () => {
    const responses = await raceBehindLock(
      barrierClient,
      horseRowLock(horse.id),
      trainers.map(t => assign(t.id)),
    );
    expect(responses.map(r => r.status)).toEqual([201, 201]);

    const active = await prisma.trainerAssignment.findMany({
      where: { horseId: horse.id, isActive: true },
    });
    expect(active).toHaveLength(1);
  }, 60000);
});
