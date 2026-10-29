/**
 * Every horse is created with a temperament and gait scores (Equoria-576c0.5).
 *
 * OWNER RULING 2026-10-19 (decision 4 / O5, option A): temperament and gaitScores
 * become required. A new horse's temperament is rolled from its breed's temperament
 * weights (the 12 temperaments, owner ruling 2026-10-21) and its gaits from the
 * breed's gait ranges, with special gaits only for a gaited breed (owner rulings
 * 2026-10-28, q210 / q211). A breed with no weights or ranges is refused, never
 * given a guessed value.
 *
 * One test per real creation path: the createHorse funnel (when a caller omits the
 * two values), the horse-creation request service, the Horse Trader over HTTP,
 * foaling, the registration starter horse, the onboarding wizard over HTTP, and
 * the two shared test-fixture factories. Real database, real services, no mocks.
 * Fixtures are test-owned and removed by id, fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { createTestHorse as createAuthTestHorse } from '../../tests/helpers/testAuth.mjs';
import { createTestHorse, testHorseData } from '../helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';
import { birthDateForAge } from '../../utils/horseAge.mjs';
import { createHorse } from '../../modules/horses/services/horseCreation.mjs';
import { createHorseFromRequest } from '../../modules/horses/services/createHorseService.mjs';
import { createFoalFromPregnancy } from '../../modules/horses/services/foalingService.mjs';
import { createStarterHorseForNewUser } from '../../modules/auth/services/onboardingService.mjs';
import { horseTemperamentValues } from '../../constants/schema.mjs';

const ORIGIN = 'http://localhost:3000';
const standardGaits = ['walk', 'trot', 'canter', 'gallop'];
const dayMs = 24 * 60 * 60 * 1000;
const tag = randomBytes(4).toString('hex');
const prefix = `TestFixture-576c05-${tag}`;
const gaitedBreedName = 'American Saddlebred';
const plainBreedName = 'Thoroughbred';

const userIds = [];
const horseIds = [];
const breedIds = [];
const cleanup = createCleanupTracker();
let gaitedBreed;
let plainBreed;

async function makeUser(label, settings = {}) {
  const suffix = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `t576-${label}-${suffix}@test.invalid`,
      username: `t576${label}${suffix}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Temper',
      lastName: 'Gaits',
      emailVerified: true,
      money: 10000,
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

async function storedRow(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: { temperament: true, gaitScores: true },
  });
}

/** The stored pair is a canonical temperament and breed-shaped gait scores. */
function expectBreedRolled(row, { gaited }) {
  expect(row).not.toBeNull();
  expect(horseTemperamentValues).toContain(row.temperament);
  expect(row.gaitScores).not.toBeNull();
  for (const gait of standardGaits) {
    expect(Number.isInteger(row.gaitScores[gait])).toBe(true);
  }
  if (gaited) {
    expect(Array.isArray(row.gaitScores.gaiting)).toBe(true);
    expect(row.gaitScores.gaiting.length).toBeGreaterThan(0);
  } else {
    expect(row.gaitScores.gaiting).toBeNull();
  }
}

beforeAll(async () => {
  gaitedBreed = await prisma.breed.findUnique({ where: { name: gaitedBreedName } });
  plainBreed = await prisma.breed.findUnique({ where: { name: plainBreedName } });
  if (!gaitedBreed || !plainBreed) {
    throw new Error(
      `horseTemperamentGaitsOnEveryPath needs the seeded breeds ${gaitedBreedName} and ${plainBreedName}; refusing to skip.`,
    );
  }
  if (gaitedBreed.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== true) {
    throw new Error(`${gaitedBreedName} is expected to be gaited in the seeded data.`);
  }
}, 30000);

afterAll(async () => {
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds }, age: 0 } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds } } }), 'horses');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'ownerless horses');
  cleanup.add(() => prisma.breed.deleteMany({ where: { id: { in: breedIds } } }), 'breeds');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }), 'refreshTokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  await cleanup.run();
}, 60000);

describe('createHorse, the funnel every acquisition path uses', () => {
  it('rolls both from a non-gaited breed when the caller omits them', async () => {
    const horse = await createHorse({
      name: `${prefix}-funnel-plain`,
      age: 3,
      sex: 'Mare',
      dateOfBirth: birthDateForAge(3),
      breedId: plainBreed.id,
    });
    horseIds.push(horse.id);
    expectBreedRolled(await storedRow(horse.id), { gaited: false });
  });

  it('rolls special gaits for a gaited breed when the caller omits them', async () => {
    const horse = await createHorse({
      name: `${prefix}-funnel-gaited`,
      age: 3,
      sex: 'Stallion',
      dateOfBirth: birthDateForAge(3),
      breed: { connect: { id: gaitedBreed.id } },
    });
    horseIds.push(horse.id);
    expectBreedRolled(await storedRow(horse.id), { gaited: true });
  });

  it('keeps a caller-supplied temperament and gaits', async () => {
    const gaitScores = { walk: 61, trot: 62, canter: 63, gallop: 64, gaiting: null };
    const horse = await createHorse({
      name: `${prefix}-funnel-given`,
      age: 3,
      sex: 'Mare',
      dateOfBirth: birthDateForAge(3),
      breedId: plainBreed.id,
      temperament: 'Willing',
      gaitScores,
    });
    horseIds.push(horse.id);
    expect(await storedRow(horse.id)).toEqual({ temperament: 'Willing', gaitScores });
  });

  it('refuses a breed with no temperament weights or gait ranges: no horse, no guess', async () => {
    const bare = await prisma.breed.create({
      data: { name: `${prefix}-bare-breed`, description: 'no profile' },
    });
    breedIds.push(bare.id);
    const name = `${prefix}-funnel-bare`;
    await expect(
      createHorse({ name, age: 3, sex: 'Mare', dateOfBirth: birthDateForAge(3), breedId: bare.id }),
    ).rejects.toThrow(/No (profile|breedProfiles.json entry) for breed/);
    expect(await prisma.horse.count({ where: { name } })).toBe(0);
  });
});

describe('horse-creation request service (createHorseFromRequest)', () => {
  it('creates the horse with both rolled from its breed', async () => {
    const { user } = await makeUser('req');
    const res = await createHorseFromRequest(
      { name: `${prefix}-request`, breedId: gaitedBreed.id, age: 3, sex: 'mare' },
      user.id,
    );
    expect(res.status).toBe(201);
    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { id: true } });
    expectBreedRolled(await storedRow(horse.id), { gaited: true });
  });
});

describe('Horse Trader purchase over HTTP', () => {
  it('a store horse is born with both from its breed', async () => {
    const { user, post } = await makeUser('store');
    const res = await post('/api/v1/marketplace/store/buy', { breedId: plainBreed.id, sex: 'Mare' });
    expect(res.status).toBe(201);
    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { id: true } });
    expectBreedRolled(await storedRow(horse.id), { gaited: false });
  });
});

describe('foaling (createFoalFromPregnancy)', () => {
  it('a foal is born with both, even when its parents have none recorded', async () => {
    const { user: owner } = await makeUser('foal');
    const base = {
      ...fixtureColor(),
      dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
      age: 5,
      breedId: gaitedBreed.id,
      userId: owner.id,
      healthStatus: 'Good',
    };
    const sire = await prisma.horse.create({
      data: await testHorseData(prisma, { ...base, name: `${prefix}-Sire`, sex: 'Stallion' }),
    });
    const dam = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...base,
        name: `${prefix}-Dam`,
        sex: 'Mare',
        inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
        pregnancySireId: sire.id,
        pendingFoalName: `${prefix}-Foal`,
      }),
    });
    const { foal } = await createFoalFromPregnancy({ damId: dam.id });
    expectBreedRolled(await storedRow(foal.id), { gaited: true });
  });
});

describe('registration starter horse (createStarterHorseForNewUser)', () => {
  it('is created with both from the starter breed', async () => {
    const { user } = await makeUser('reg');
    await createStarterHorseForNewUser(user, { breedName: gaitedBreedName });
    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { id: true } });
    expect(horse).not.toBeNull();
    expectBreedRolled(await storedRow(horse.id), { gaited: true });
  });
});

describe('onboarding wizard over HTTP', () => {
  it('a brand-new wizard horse is born with both from the chosen breed', async () => {
    const { user, post } = await makeUser('onb', { completedOnboarding: false, onboardingStep: 0 });
    const res = await post('/api/v1/auth/advance-onboarding', {
      horseName: 'Lantern Walk',
      breedId: gaitedBreed.id,
      gender: 'Mare',
    });
    expect(res.status).toBe(200);
    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { id: true } });
    expectBreedRolled(await storedRow(horse.id), { gaited: true });
  });
});

describe('shared test-fixture factories', () => {
  it('createTestHorse rolls both from the fixture breed when the test omits them', async () => {
    const { user } = await makeUser('fixture');
    const horse = await createTestHorse(
      prisma,
      {
        name: `${prefix}-fixture`,
        sex: 'Mare',
        dateOfBirth: new Date(),
        userId: user.id,
        breedId: gaitedBreed.id,
      },
      horseIds,
    );
    expectBreedRolled(await storedRow(horse.id), { gaited: true });
  });

  it('testAuth createTestHorse is born with both from its Thoroughbred default', async () => {
    const { user } = await makeUser('authfix');
    const horse = await createAuthTestHorse({ userId: user.id });
    horseIds.push(horse.id);
    expectBreedRolled(await storedRow(horse.id), { gaited: false });
  });
});
