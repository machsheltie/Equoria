/**
 * Starter horses are born with their breed's discipline at +5 (Equoria-tl5l8).
 *
 * OWNER RULING 2026-10-28: every horse is born with a discipline and starts
 * with +5 trained value in it (Horse.disciplineScores, the field training
 * writes and show scoring reads). Starter horses take their breed's default:
 * Gaited for a gaited breed (ruling 2026-10-19). A non-gaited breed's default
 * waits on the owner's per-breed list (Equoria-cdmk1), so the Thoroughbred
 * registration placeholder is born without one. The rules themselves are
 * pinned in modules/horses/__tests__/birthDiscipline.integration.test.mjs.
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

const ORIGIN = 'http://localhost:3000';
const gaitedBreedName = 'American Saddlebred';

const userIds = [];
const cleanup = createCleanupTracker();
let gaitedBreed;

async function makeUser(label, settings = {}) {
  const suffix = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `tl5l8-${label}-${suffix}@test.invalid`,
      username: `tl5l8${label}${suffix}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Birth',
      lastName: 'Discipline',
      emailVerified: true,
      settings,
    },
  });
  userIds.push(user.id);
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  const post = (path, body) =>
    request(app)
      .post(path)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  return { user, post };
}

beforeAll(async () => {
  gaitedBreed = await prisma.breed.findUnique({ where: { name: gaitedBreedName } });
  if (gaitedBreed?.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== true) {
    throw new Error(`starterHorseBirthDiscipline needs the seeded gaited breed ${gaitedBreedName}; refusing to skip.`);
  }
}, 30000);

afterAll(async () => {
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds } } }), 'horses');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }), 'refreshTokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  await cleanup.run();
}, 60000);

describe('onboarding starter horse', () => {
  it('the wizard’s chosen gaited breed replaces the registration placeholder with Gaited at +5', async () => {
    const { user, post } = await makeUser('onb', { completedOnboarding: false, onboardingStep: 0 });
    // The registration placeholder (Thoroughbred, no default yet).
    await createStarterHorseForNewUser(user);
    const placeholder = await prisma.horse.findFirst({ where: { userId: user.id } });
    expect(placeholder).not.toBeNull();
    expect(placeholder.disciplineScores).toBeNull();

    const res = await post('/api/v1/auth/advance-onboarding', {
      horseName: 'Saddle Song',
      breedId: gaitedBreed.id,
      gender: 'Mare',
    });
    expect(res.status).toBe(200);

    const horses = await prisma.horse.findMany({
      where: { userId: user.id },
      select: { id: true, breedId: true, disciplineScores: true },
    });
    expect(horses).toHaveLength(1);
    expect(horses[0]).toEqual({ id: placeholder.id, breedId: gaitedBreed.id, disciplineScores: { Gaited: 5 } });
  });

  it('a brand-new wizard horse of a gaited breed is born with Gaited at +5', async () => {
    const { user, post } = await makeUser('onbnew', { completedOnboarding: false, onboardingStep: 0 });
    const res = await post('/api/v1/auth/advance-onboarding', {
      horseName: 'Evening Walker',
      breedId: gaitedBreed.id,
      gender: 'Stallion',
    });
    expect(res.status).toBe(200);

    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { disciplineScores: true } });
    expect(horse.disciplineScores).toEqual({ Gaited: 5 });
  });

  it('the registration starter of a gaited breed is born with Gaited at +5', async () => {
    const { user } = await makeUser('reg');
    await createStarterHorseForNewUser(user, { breedName: gaitedBreedName });

    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { disciplineScores: true } });
    expect(horse.disciplineScores).toEqual({ Gaited: 5 });
  });
});
