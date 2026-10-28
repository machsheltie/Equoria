/**
 * A starter horse arrives in Excellent health and fully fed (Equoria-fd3f2).
 *
 * OWNER RULING 2026-10-28: a Horse Trader horse is in Excellent health and
 * fully fed at the moment the player gets it; the issue extends the same
 * arrival care to the onboarding starter horse, which the game also hands the
 * player. Old contract: the starter horse was never fed, so its hunger read
 * Bad from the first minute and lowered its displayed health two levels.
 *
 * Both creation paths are covered: the registration starter
 * (createStarterHorseForNewUser) and the onboarding wizard's brand-new horse
 * (POST /api/v1/auth/advance-onboarding with no placeholder).
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures removed by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createStarterHorseForNewUser } from '../services/onboardingService.mjs';
import { alreadyFedToday } from '../../../utils/horseHealth.mjs';

const ORIGIN = 'http://localhost:3000';

const userIds = [];
const cleanup = createCleanupTracker();
let wizardBreed;

async function makeUser(label, settings = {}) {
  const suffix = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `fd3f2-${label}-${suffix}@test.invalid`,
      username: `fd3f2${label}${suffix}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Starter',
      lastName: 'Arrival',
      emailVerified: true,
      settings,
    },
  });
  userIds.push(user.id);
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  return { user, token };
}

async function expectArrivedExcellentAndFed(userId, token) {
  const horse = await prisma.horse.findFirst({
    where: { userId },
    select: { id: true, lastFedDate: true },
  });
  expect(horse).not.toBeNull();
  expect(alreadyFedToday(horse.lastFedDate)).toBe(true);

  const res = await request(app).get(`/api/v1/horses/${horse.id}`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({
    vetHealth: 'Excellent',
    feedHealth: 'Excellent',
    displayedHealth: 'Excellent',
  });
}

beforeAll(async () => {
  wizardBreed = await prisma.breed.findUnique({ where: { name: 'Morgan USA' }, select: { id: true } });
  if (!wizardBreed) {
    throw new Error('Seeded breed "Morgan USA" is missing; run npm run seed:breeds.');
  }
}, 30000);

afterAll(async () => {
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds } } }), 'horses');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }), 'refreshTokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  await cleanup.run();
}, 60000);

describe('starter horse arrival care (Equoria-fd3f2)', () => {
  it('the registration starter arrives Excellent and fed', async () => {
    const { user, token } = await makeUser('reg');
    await createStarterHorseForNewUser(user);
    await expectArrivedExcellentAndFed(user.id, token);
  });

  it('the onboarding wizard’s brand-new horse arrives Excellent and fed', async () => {
    const { user, token } = await makeUser('onb', { completedOnboarding: false, onboardingStep: 0 });
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseName: 'Morning Arrival', breedId: wizardBreed.id, gender: 'Mare' });
    expect(res.status).toBe(200);
    await expectArrivedExcellentAndFed(user.id, token);
  });
});
