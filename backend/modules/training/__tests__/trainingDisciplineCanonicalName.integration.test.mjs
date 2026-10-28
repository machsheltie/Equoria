/**
 * trainingDisciplineCanonicalName.integration.test.mjs (Equoria-i42xr, audit TRAIN-01)
 *
 * Defect: the horse page sends the discipline's slug ('gaited', 'show-jumping').
 * The Gaited breed gate compared it with 'Gaited', so a non-gaited horse could
 * train Gaited, and the score was written under the slug key, not the
 * discipline's name.
 *
 * Contract: POST /api/v1/training/train accepts a discipline in any case or
 * separator, applies every gate to the canonical name, and writes the score
 * under it; a name that is no discipline is refused.
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
let plainBreed;

async function makeHorse() {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-i42xr-${rand()}`,
      dateOfBirth: gameCalendarDate(new Date(), -(6 * 7 + 1)),
      age: 6,
      sex: 'Mare',
      userId: user.id,
      breedId: plainBreed.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
    },
  });
  horseIds.push(horse.id);
  await assignTestTrainer(horse);
  return horse;
}

async function train(horseId, discipline) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/training/train')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId, discipline });
}

beforeAll(async () => {
  plainBreed = await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } });
  if (plainBreed?.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== false) {
    throw new Error('Needs the seeded non-gaited Thoroughbred breed; refusing to skip.');
  }
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TestFixture-i42xr-${rand()}`,
      email: `testfixture-i42xr-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Slug',
      lastName: 'Gate',
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

describe('POST /train uses the canonical discipline name (Equoria-i42xr)', () => {
  it("refuses 'gaited' for a horse of a non-gaited breed and writes nothing", async () => {
    const horse = await makeHorse();
    const res = await train(horse.id, 'gaited');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only gaited breeds can train in Gaited/);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { disciplineScores: true, trainingCooldown: true },
    });
    expect(after.trainingCooldown).toBeNull();
    expect(after.disciplineScores ?? {}).not.toHaveProperty('gaited');
  });

  it("trains 'show-jumping' as Show Jumping and stores the score under that name", async () => {
    const horse = await makeHorse();
    const res = await train(horse.id, 'show-jumping');
    expect(res.status).toBe(200);
    expect(res.body.updatedScore).toBe(5);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { disciplineScores: true },
    });
    expect(after.disciplineScores).toEqual({ 'Show Jumping': 5 });
    const log = await prisma.trainingLog.findFirst({ where: { horseId: horse.id } });
    expect(log.discipline).toBe('Show Jumping');
  });

  it('refuses a name that is no discipline', async () => {
    const horse = await makeHorse();
    const res = await train(horse.id, 'Underwater Polo');
    expect(res.status).toBe(400);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { trainingCooldown: true },
    });
    expect(after.trainingCooldown).toBeNull();
  });
});
