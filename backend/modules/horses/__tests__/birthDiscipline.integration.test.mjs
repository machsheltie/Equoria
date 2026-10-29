/**
 * Every horse is born with a discipline at +5 trained value (Equoria-tl5l8).
 *
 * OWNER RULING 2026-10-28: each horse is born with a discipline and starts
 * with +5 in it, the same +5 a week of training gives, counted wherever the
 * trained value is used. The value is Horse.disciplineScores[discipline], the
 * field training writes and show scoring reads (disciplineTrainingPoints).
 *
 * Store and starter horses take their breed's default: Gaited for a gaited
 * breed (ruling 2026-10-19); a non-gaited breed's default comes from
 * breeds.defaultTrait, the owner's approved per-breed list (q232, Equoria-cdmk1;
 * Thoroughbred is Racing). Old contract (placeholder 'Trait' for every breed):
 * a non-gaited store horse was born with no discipline. Bred foals (owner rulings 2026-10-28): a gaited breed's foal
 * is always born Gaited (q219); any other foal follows the 2026-10-19/10-21
 * rulings (parents' training sessions, then a parent's own discipline, then the
 * breed default), confirmed by q216.
 *
 * Real database, real HTTP for the store, real foaling service. The starter
 * horse paths are pinned in modules/auth/__tests__/starterHorseBirthDiscipline.
 * No mocks. Fixtures are test-owned and removed by id, fail-loud.
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
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import {
  breedDefaultDiscipline,
  birthDisciplineScores,
  pickFoalBirthDisciplineFromParents,
} from '../services/birthDiscipline.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const dayMs = 24 * 60 * 60 * 1000;
const tag = randomBytes(4).toString('hex');
const prefix = `TestFixture-tl5l8-${tag}`;
const gaitedBreedName = 'American Saddlebred';
const plainBreedName = 'Thoroughbred';

const gaitedProfile = { ratingProfiles: { isGaitedBreed: true } };
const plainProfile = { ratingProfiles: { isGaitedBreed: false } };

const userIds = [];
const cleanup = createCleanupTracker();
let gaitedBreed;
let plainBreed;

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

beforeAll(async () => {
  gaitedBreed = await prisma.breed.findUnique({ where: { name: gaitedBreedName } });
  plainBreed = await prisma.breed.findUnique({ where: { name: plainBreedName } });
  if (!gaitedBreed || !plainBreed) {
    throw new Error(
      `birthDiscipline needs the seeded breeds ${gaitedBreedName} and ${plainBreedName}; refusing to skip.`,
    );
  }
  if (gaitedBreed.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== true) {
    throw new Error(`${gaitedBreedName} is expected to be gaited in the seeded data.`);
  }
  if (plainBreed.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== false) {
    throw new Error(`${plainBreedName} is expected to be non-gaited in the seeded data.`);
  }
}, 30000);

afterAll(async () => {
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds }, age: 0 } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds } } }), 'horses');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }), 'refreshTokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  await cleanup.run();
}, 60000);

describe('breed default discipline (Equoria-tl5l8)', () => {
  it('is Gaited for a gaited breed, whatever defaultTrait says', () => {
    expect(breedDefaultDiscipline({ breedGeneticProfile: gaitedProfile, defaultTrait: 'Trait' })).toBe('Gaited');
    expect(breedDefaultDiscipline({ breedGeneticProfile: gaitedProfile, defaultTrait: 'Dressage' })).toBe('Gaited');
  });

  it('is the discipline named in defaultTrait for a non-gaited breed', () => {
    expect(breedDefaultDiscipline({ breedGeneticProfile: plainProfile, defaultTrait: 'Dressage' })).toBe('Dressage');
  });

  it('is never Gaited for a non-gaited breed, and none for the placeholder or a missing breed', () => {
    expect(breedDefaultDiscipline({ breedGeneticProfile: plainProfile, defaultTrait: 'Gaited' })).toBeNull();
    expect(breedDefaultDiscipline({ breedGeneticProfile: plainProfile, defaultTrait: 'Trait' })).toBeNull();
    expect(breedDefaultDiscipline({ breedGeneticProfile: null, defaultTrait: null })).toBeNull();
    expect(breedDefaultDiscipline(null)).toBeNull();
  });

  it('is born as +5 trained value, the same +5 one week of training gives', () => {
    expect(birthDisciplineScores('Gaited')).toEqual({ Gaited: 5 });
    expect(birthDisciplineScores(null)).toBeUndefined();
    expect(birthDisciplineScores('Trait')).toBeUndefined();
  });
});

describe('foal birth discipline from the parents (rulings 2026-10-19/10-21, q216, q219)', () => {
  const plainFoal = { breedGeneticProfile: plainProfile, defaultTrait: 'Trait' };
  const gaitedFoal = { breedGeneticProfile: gaitedProfile, defaultTrait: 'Trait' };

  it('weights the parents’ trained disciplines by training sessions', () => {
    const sessionsByDiscipline = { Hunter: 3, Dressage: 1 };
    // Sorted [Dressage (1), Hunter (3)] over 4 sessions.
    const pick = roll =>
      pickFoalBirthDisciplineFromParents({ sessionsByDiscipline, foalBreed: plainFoal, rng: () => roll });
    expect(pick(0.1)).toBe('Dressage');
    expect(pick(0.24)).toBe('Dressage');
    expect(pick(0.26)).toBe('Hunter');
    expect(pick(0.99)).toBe('Hunter');
  });

  it('never gives a non-gaited foal Gaited, even from trained parents', () => {
    expect(
      pickFoalBirthDisciplineFromParents({
        sessionsByDiscipline: { Gaited: 9, Dressage: 1 },
        foalBreed: plainFoal,
        rng: () => 0,
      }),
    ).toBe('Dressage');
    expect(
      pickFoalBirthDisciplineFromParents({
        sessionsByDiscipline: {},
        sireDisciplineScores: { Gaited: 5 },
        damDisciplineScores: { Gaited: 5 },
        foalBreed: plainFoal,
      }),
    ).toBeNull();
  });

  it('falls back 50/50 to the sire’s or the dam’s own discipline when neither trained', () => {
    const input = {
      sessionsByDiscipline: {},
      sireDisciplineScores: { Endurance: 5 },
      damDisciplineScores: { Dressage: 5 },
      foalBreed: plainFoal,
    };
    expect(pickFoalBirthDisciplineFromParents({ ...input, rng: () => 0.2 })).toBe('Endurance');
    expect(pickFoalBirthDisciplineFromParents({ ...input, rng: () => 0.7 })).toBe('Dressage');
    expect(pickFoalBirthDisciplineFromParents({ ...input, sireDisciplineScores: null, rng: () => 0.2 })).toBe(
      'Dressage',
    );
  });

  // q219 (owner ruling 2026-10-28): old contract let a gaited foal inherit its parents'
  // trained discipline; now a gaited breed's foal is always born Gaited.
  it('a gaited foal is always Gaited, whatever its parents trained or hold', () => {
    expect(
      pickFoalBirthDisciplineFromParents({
        sessionsByDiscipline: { Dressage: 9, Saddleseat: 3 },
        sireDisciplineScores: { Dressage: 40 },
        damDisciplineScores: { Saddleseat: 30 },
        foalBreed: gaitedFoal,
        rng: () => 0,
      }),
    ).toBe('Gaited');
  });

  it('falls back to the breed default last (Gaited for a gaited foal)', () => {
    expect(pickFoalBirthDisciplineFromParents({ sessionsByDiscipline: {}, foalBreed: gaitedFoal })).toBe('Gaited');
    expect(pickFoalBirthDisciplineFromParents({ sessionsByDiscipline: {}, foalBreed: plainFoal })).toBeNull();
  });
});

describe('store purchase (buyStoreHorse)', () => {
  it('a gaited breed is born with Gaited at +5', async () => {
    const { user, post } = await makeUser('store');
    const res = await post('/api/v1/marketplace/store/buy', { breedId: gaitedBreed.id, sex: 'Mare' });
    expect(res.status).toBe(201);

    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { disciplineScores: true } });
    expect(horse.disciplineScores).toEqual({ Gaited: 5 });
  });

  it('a non-gaited breed is born with its approved default discipline at +5 (q232)', async () => {
    const { user, post } = await makeUser('storeplain');
    const res = await post('/api/v1/marketplace/store/buy', { breedId: plainBreed.id, sex: 'Stallion' });
    expect(res.status).toBe(201);

    const horse = await prisma.horse.findFirst({ where: { userId: user.id }, select: { disciplineScores: true } });
    expect(horse.disciplineScores).toEqual({ Racing: 5 });
  });
});

describe('foaling (createFoalFromPregnancy)', () => {
  let owner;

  beforeAll(async () => {
    ({ user: owner } = await makeUser('foal'));
  }, 30000);

  async function pregnantPair(label, breed, { sireScores = null, damScores = null } = {}) {
    const dob = gameCalendarDate(new Date(), -5 * 365);
    const base = {
      ...fixtureColor(),
      dateOfBirth: dob,
      age: 5,
      breedId: breed.id,
      userId: owner.id,
      healthStatus: 'Good',
    };
    const sire = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...base,
        name: `${prefix}-Sire-${label}`,
        sex: 'Stallion',
        ...(sireScores && { disciplineScores: sireScores }),
      }),
    });
    const dam = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...base,
        name: `${prefix}-Dam-${label}`,
        sex: 'Mare',
        ...(damScores && { disciplineScores: damScores }),
        inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
        pregnancySireId: sire.id,
        pendingFoalName: `${prefix}-Foal-${label}`,
      }),
    });
    return { sire, dam };
  }

  async function foalScores(damId) {
    const { foal } = await createFoalFromPregnancy({ damId });
    const row = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: { damId: true, disciplineScores: true },
    });
    expect(row.damId).toBe(damId);
    return row.disciplineScores;
  }

  it('a gaited foal of untrained parents with no recorded discipline gets its breed default, Gaited', async () => {
    const { dam } = await pregnantPair('gaitednone', gaitedBreed);
    const scores = await foalScores(dam.id);
    expect(scores).toEqual({ Gaited: 5 });
  });

  // q219 (owner ruling 2026-10-28). Old contract: "a gaited foal inherits the
  // discipline its parents trained in" ({ Saddleseat: 5 }). Now always Gaited.
  it('a gaited foal is always born Gaited, even when its parents trained in another discipline', async () => {
    const { sire, dam } = await pregnantPair('gaitedtrained', gaitedBreed);
    await prisma.trainingLog.create({ data: { horseId: sire.id, discipline: 'Saddleseat' } });
    await prisma.trainingLog.create({ data: { horseId: dam.id, discipline: 'Saddleseat' } });
    expect(await foalScores(dam.id)).toEqual({ Gaited: 5 });
  });

  it('a non-gaited foal never inherits Gaited from its parents’ training', async () => {
    const { sire, dam } = await pregnantPair('plaintrained', plainBreed);
    await prisma.trainingLog.create({ data: { horseId: sire.id, discipline: 'Gaited' } });
    await prisma.trainingLog.create({ data: { horseId: dam.id, discipline: 'Gaited' } });
    await prisma.trainingLog.create({ data: { horseId: dam.id, discipline: 'Dressage' } });
    expect(await foalScores(dam.id)).toEqual({ Dressage: 5 });
  });

  it('a foal of untrained parents takes a parent’s own birth discipline', async () => {
    const { dam } = await pregnantPair('plainown', plainBreed, {
      sireScores: { Endurance: 5 },
      damScores: { Endurance: 5 },
    });
    expect(await foalScores(dam.id)).toEqual({ Endurance: 5 });
  });

  // q232: old contract "no approved breed default has no discipline"; with the
  // approved list the last fallback is the breed default (Thoroughbred: Racing).
  it('a non-gaited foal with nothing to inherit falls back to its breed default', async () => {
    const { dam } = await pregnantPair('plainnone', plainBreed);
    expect(await foalScores(dam.id)).toEqual({ Racing: 5 });
  });
});
