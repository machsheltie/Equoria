/**
 * Training with an assigned trainer charges the trainer's advertised fee once
 * per weekly session (Equoria-3kegj).
 *
 * Owner ruling 2026-10-22: hiring a trainer is free. Each week the player picks
 * a discipline, clicks train, and is charged ONCE the trainer's advertised
 * per-training fee (Trainer.sessionRate); the horse trains only once that week;
 * a double-click or retry never charges twice or trains twice.
 *
 * Before this ruling a session charged no trainer fee at all. The fee is taken
 * inside the session transaction (lock order User -> Horse -> staff), before the
 * cooldown claim, so a request that loses the claim rolls its debit back.
 *
 * Real DB and real HTTP (POST /api/v1/training/train). No mocks; id-scoped,
 * fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

const TAG = randomBytes(4).toString('hex');
const PREFIX = `TestFixture-3kegj-${TAG}`;
// Owner ruling 2026-10-28 (q226, Equoria-nawn5): the fee is the trainer's star level
// price; the fixture trainer is a Novice (2 stars, 200).
const FEE = 200;
const parallelRequests = 5;

const userIds = [];
const horseIds = [];
const trainerIds = [];
let seq = 0;

const cleanup = createCleanupTracker();
cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'trainingLogs');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.trainer.deleteMany({ where: { id: { in: trainerIds } } }), 'trainers');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 60000);

/**
 * A player with `money` coins owning one adult, healthy, fed horse that is off
 * cooldown; with `trainer: true` the horse has an active assigned trainer whose
 * advertised fee is FEE.
 */
async function stable({ money, trainer = true }) {
  seq += 1;
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${PREFIX}-${seq}@test.com`,
      username: `tf3kegj${TAG}${seq}`,
      password: 'irrelevant-hash',
      firstName: 'Fee',
      lastName: 'Payer',
      money,
    },
  });
  userIds.push(user.id);
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${seq}`,
      sex: 'Mare',
      dateOfBirth: birthDateForAge(6),
      age: 6,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      trainingCooldown: null,
      userId: user.id,
    },
  });
  horseIds.push(horse.id);
  let hired = null;
  if (trainer) {
    hired = await prisma.trainer.create({
      data: {
        userId: user.id,
        firstName: 'Avery',
        lastName: `Fee${seq}`,
        personality: 'focused',
        skillLevel: 'novice',
        starLevel: 'novice',
        speciality: 'Dressage',
        sessionRate: FEE,
        bio: 'fixture',
      },
    });
    trainerIds.push(hired.id);
    await prisma.trainerAssignment.create({
      data: { trainerId: hired.id, horseId: horse.id, userId: user.id },
    });
  }
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  const train = (discipline = 'Dressage') =>
    request(app)
      .post('/api/v1/training/train')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline });
  return { user, horse, trainer: hired, train };
}

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);
const feeRows = userId => prisma.userTransaction.findMany({ where: { userId, category: 'trainingFee' } });
const logsOf = horseId => prisma.trainingLog.findMany({ where: { horseId } });

describe('trainer fee at train time (Equoria-3kegj)', () => {
  let s;
  beforeAll(async () => {
    s = await stable({ money: 1000 });
  }, 60000);

  it("charges the trainer's advertised fee once and trains the horse once", async () => {
    const res = await s.train('Dressage');

    expect(res.status).toBe(200);
    expect(res.body.trainingFee).toBe(FEE);
    expect(await moneyOf(s.user.id)).toBe(1000 - FEE);
    const rows = await feeRows(s.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'debit', amount: FEE, balanceAfter: 1000 - FEE });
    expect(rows[0].metadata).toMatchObject({ trainerId: s.trainer.id, horseId: s.horse.id, discipline: 'Dressage' });
    expect(await logsOf(s.horse.id)).toHaveLength(1);
  });

  it('a second click the same week, even in another discipline, neither trains nor charges', async () => {
    const res = await s.train('Show Jumping');

    expect(res.status).toBe(400);
    expect(await moneyOf(s.user.id)).toBe(1000 - FEE);
    expect(await feeRows(s.user.id)).toHaveLength(1);
    expect(await logsOf(s.horse.id)).toHaveLength(1);
  });
});

describe('double-click / retry race (Equoria-3kegj)', () => {
  it(`${parallelRequests} concurrent train requests: one 200, one charge, one training`, async () => {
    const s = await stable({ money: 1000 });

    const results = await Promise.all(Array.from({ length: parallelRequests }, () => s.train('Dressage')));

    const ok = results.filter(r => r.status === 200);
    expect(ok).toHaveLength(1);
    for (const r of results.filter(x => x.status !== 200)) {
      expect(r.status).toBe(400);
    }
    expect(await moneyOf(s.user.id)).toBe(1000 - FEE);
    expect(await feeRows(s.user.id)).toHaveLength(1);
    expect(await logsOf(s.horse.id)).toHaveLength(1);
  });
});

describe('a player who cannot pay the fee (Equoria-3kegj)', () => {
  it('is refused with nothing written: no training, no cooldown, no charge', async () => {
    const s = await stable({ money: FEE - 1 });

    const res = await s.train('Dressage');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/training fee/i);
    expect(await moneyOf(s.user.id)).toBe(FEE - 1);
    expect(await feeRows(s.user.id)).toHaveLength(0);
    expect(await logsOf(s.horse.id)).toHaveLength(0);
    const horse = await prisma.horse.findUnique({ where: { id: s.horse.id }, select: { trainingCooldown: true } });
    expect(horse.trainingCooldown).toBeNull();
  });
});

// Old contract (Equoria-3kegj): a horse with no trainer trained free. Owner ruling
// 2026-10-26 (Equoria-r8a6h q81): a trainer is required, so it is refused instead,
// and still charges nothing (the refusal itself is pinned in trainerRequired.integration.test.mjs).
describe('training without a trainer (Equoria-3kegj, Equoria-r8a6h)', () => {
  it('is refused and charges nothing', async () => {
    const s = await stable({ money: 1000, trainer: false });

    const res = await s.train('Dressage');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('trainerRequired');
    expect(await moneyOf(s.user.id)).toBe(1000);
    expect(await feeRows(s.user.id)).toHaveLength(0);
    expect(await logsOf(s.horse.id)).toHaveLength(0);
  });
});
