/**
 * A trainer is required to train (owner ruling 2026-10-26, Equoria-r8a6h, q81).
 *
 * The train call refuses a horse with no assigned trainer, with an authored
 * message and the coded refusal `trainerRequired`, and writes nothing (no fee,
 * no XP, no cooldown, no log). The eligibility verdict says the same on every
 * surface: the trainable-horses list, canTrain, the status call and the horse
 * overview's canTrainNow, so none of them calls ready a horse the train call
 * refuses.
 *
 * Real DB and real HTTP. No mocks; id-scoped, fail-loud cleanup.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { canTrain } from '../controllers/trainingController.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

const TAG = randomBytes(4).toString('hex');
const PREFIX = `TestFixture-r8a6h-${TAG}`;
// Owner ruling 2026-10-28 (q226): the fee is the trainer's star level price (Rookie, 100).
const FEE = 100;

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

/** trainer: 'active' | 'none' | 'ended' (assignment inactive) | 'retired' */
async function stable({ trainer }) {
  seq += 1;
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${seq}@test.com`,
      username: `tr8a6h${TAG}${seq}`,
      password: 'irrelevant-hash',
      firstName: 'Trainer',
      lastName: 'Required',
      money: 1000,
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
      lastVettedDate: new Date(),
      trainingCooldown: null,
      userId: user.id,
    },
  });
  horseIds.push(horse.id);
  if (trainer !== 'none') {
    const hired = await prisma.trainer.create({
      data: {
        userId: user.id,
        firstName: 'Avery',
        lastName: `Req${seq}`,
        personality: 'focused',
        skillLevel: 'novice',
        starLevel: 'rookie',
        speciality: 'Dressage',
        sessionRate: FEE,
        retired: trainer === 'retired',
        bio: 'fixture',
      },
    });
    trainerIds.push(hired.id);
    await prisma.trainerAssignment.create({
      data: {
        trainerId: hired.id,
        horseId: horse.id,
        userId: user.id,
        isActive: trainer === 'active' || trainer === 'retired',
      },
    });
  }
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  const authed = req => req.set('Authorization', `Bearer ${token}`).set('Origin', 'http://localhost:3000');
  const train = () =>
    authed(request(app).post('/api/v1/training/train'))
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });
  const trainable = () => authed(request(app).get(`/api/v1/training/trainable/${user.id}`));
  const status = () => authed(request(app).get(`/api/v1/training/status/${horse.id}/Dressage`));
  const overview = () => authed(request(app).get(`/api/v1/horses/${horse.id}/overview`));
  return { user, horse, train, trainable, status, overview };
}

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);

describe('train call without a trainer (Equoria-r8a6h q81)', () => {
  it.each(['none', 'ended', 'retired'])(
    'refuses a horse whose trainer state is %s, coded, and writes nothing',
    async state => {
      const s = await stable({ trainer: state === 'retired' ? 'retired' : state });
      const res = await s.train();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('trainerRequired');
      expect(res.body.message).toMatch(/needs a trainer/i);
      expect(await moneyOf(s.user.id)).toBe(1000);
      expect(await prisma.trainingLog.count({ where: { horseId: s.horse.id } })).toBe(0);
      const horse = await prisma.horse.findUnique({ where: { id: s.horse.id } });
      expect(horse.trainingCooldown).toBeNull();
    },
    60000,
  );

  it('trains, and charges the fee once, when a trainer is assigned', async () => {
    const s = await stable({ trainer: 'active' });
    const res = await s.train();

    expect(res.status).toBe(200);
    expect(res.body.trainingFee).toBe(FEE);
    expect(await moneyOf(s.user.id)).toBe(1000 - FEE);
  }, 60000);
});

describe('every verdict surface agrees with the train call (Equoria-r8a6h q81)', () => {
  it('a horse with no trainer: list, canTrain, status and overview all say it cannot train', async () => {
    const s = await stable({ trainer: 'none' });

    const listRes = await s.trainable();
    expect(listRes.status).toBe(200);
    const row = listRes.body.data.find(h => h.id === s.horse.id);
    expect(row.canTrain).toBe(false);
    expect(row.ineligibleCode).toBe('trainerRequired');
    expect(row.ineligibleReason).toMatch(/needs a trainer/i);

    const verdict = await canTrain(s.horse.id, 'Dressage');
    expect(verdict).toMatchObject({ eligible: false, code: 'trainerRequired' });
    expect(row.ineligibleReason).toBe(verdict.reason);

    const statusRes = await s.status();
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.eligible).toBe(false);
    expect(statusRes.body.data.code).toBe('trainerRequired');

    const overviewRes = await s.overview();
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.canTrainNow).toBe(false);
  }, 60000);

  it('a horse with a trainer: every surface says it can train', async () => {
    const s = await stable({ trainer: 'active' });

    const row = (await s.trainable()).body.data.find(h => h.id === s.horse.id);
    expect(row.canTrain).toBe(true);
    expect(row.ineligibleReason).toBeNull();
    expect((await canTrain(s.horse.id, 'Dressage')).eligible).toBe(true);
    expect((await s.status()).body.data.eligible).toBe(true);
    expect((await s.overview()).body.data.canTrainNow).toBe(true);
  }, 60000);
});
