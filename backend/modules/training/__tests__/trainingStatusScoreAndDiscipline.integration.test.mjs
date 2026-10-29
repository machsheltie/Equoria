/**
 * trainingStatusScoreAndDiscipline.integration.test.mjs
 * (Equoria-t6rdk audit TRAIN-04; Equoria-e131q audit TRAIN-02)
 *
 * TRAIN-04 defect: GET /api/v1/training/status/:horseId/:discipline sent no score,
 * so the training popup previewed "Current: 0 + 5" for a horse that already had
 * points in that discipline. Contract: the status carries the horse's own
 * Horse.disciplineScores value for the discipline (0 when it has none yet).
 *
 * TRAIN-02 contract: a discipline that is not in the game (Swimming) is refused
 * by the eligibility check and by the train call, and the train call writes
 * nothing: no cooldown, no score, no log, no XP.
 *
 * Real DB, real Express app via supertest, seeded breeds; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import app from '../../../app.mjs';
import config from '../../../config/config.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const rand = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let token;
let breed;

async function makeHorse(disciplineScores = undefined) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-t6rdk-${rand()}`,
      dateOfBirth: gameCalendarDate(new Date(), -(6 * 7 + 1)),
      age: 6,
      sex: 'Mare',
      userId: user.id,
      breedId: breed.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      ...(disciplineScores ? { disciplineScores } : {}),
    },
  });
  horseIds.push(horse.id);
  await assignTestTrainer(horse);
  return horse;
}

async function post(path, body) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(path)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

const getStatus = (horseId, discipline) =>
  request(app)
    .get(`/api/v1/training/status/${horseId}/${encodeURIComponent(discipline)}`)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  breed = await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } });
  if (!breed) {
    throw new Error('Needs the seeded Thoroughbred breed; refusing to skip.');
  }
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TestFixture-t6rdk-${rand()}`,
      email: `testfixture-t6rdk-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Score',
      lastName: 'Preview',
      money: 100000,
    },
  });
  token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  cleanup.add(() => cleanupTestTrainers(), 'trainers');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'training logs');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: user.id } }), 'xp events');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('training status carries the real discipline score (Equoria-t6rdk)', () => {
  it("returns the horse's stored score for the discipline, whatever spelling was asked", async () => {
    const horse = await makeHorse({ Dressage: 20, 'Show Jumping': 35 });

    const dressage = await getStatus(horse.id, 'Dressage');
    expect(dressage.status).toBe(200);
    expect(dressage.body.data.score).toBe(20);

    const jumping = await getStatus(horse.id, 'show-jumping');
    expect(jumping.status).toBe(200);
    expect(jumping.body.data.score).toBe(35);
  });

  it('returns 0 for a discipline the horse has never trained', async () => {
    const horse = await makeHorse({ Dressage: 20 });
    const res = await getStatus(horse.id, 'Western Pleasure');
    expect(res.status).toBe(200);
    expect(res.body.data.score).toBe(0);
  });

  it('every discipline in the all-disciplines status carries its score', async () => {
    const horse = await makeHorse({ Dressage: 20 });
    const res = await request(app)
      .get(`/api/v1/training/status/${horse.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.Dressage.score).toBe(20);
    expect(res.body.data['Show Jumping'].score).toBe(0);
  });
});

describe('a discipline that is not in the game is refused (Equoria-e131q)', () => {
  it("check-eligibility says 'Swimming' is not trainable", async () => {
    const horse = await makeHorse();
    const res = await post('/api/v1/training/check-eligibility', {
      horseId: horse.id,
      discipline: 'Swimming',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      eligible: false,
      reason: 'That is not a discipline a horse can train in',
    });
  });

  it("the train call refuses 'Swimming' and writes nothing", async () => {
    const horse = await makeHorse();
    const res = await post('/api/v1/training/train', { horseId: horse.id, discipline: 'Swimming' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a discipline a horse can train in/);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { trainingCooldown: true, disciplineScores: true },
    });
    expect(after.trainingCooldown).toBeNull();
    expect(after.disciplineScores ?? {}).not.toHaveProperty('Swimming');
    expect(await prisma.trainingLog.count({ where: { horseId: horse.id } })).toBe(0);
    expect(await prisma.xpEvent.count({ where: { userId: user.id } })).toBe(0);
  });
});
