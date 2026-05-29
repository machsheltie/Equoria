// Tests for breeding color prediction API endpoint (Story 31E-5, T4.7) — real DB
//
// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
// jest.unstable_mockModule of db + logger to a real-DB integration test.
// Each test creates real users + horses with controlled genotype JSON,
// calls the real controller, and asserts on the real response.

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getBreedingColorPrediction } from '../controllers/horseController.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const SUITE_PREFIX = 'bcpa';

const MOCK_GENOTYPE = {
  E_Extension: 'E/e',
  A_Agouti: 'A/a',
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'n/n',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  TO_Tobiano: 'to/to',
  O_FrameOvero: 'n/n',
  SB1_Sabino1: 'n/n',
  SW_SplashWhite: 'n/n',
  LP_LeopardComplex: 'lp/lp',
  PATN1_Pattern1: 'patn1/patn1',
  EDXW: 'n/n',
  MFSD12_Mushroom: 'N/N',
};

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Bcpa',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createBreed() {
  return prisma.breed.create({
    data: {
      name: `${SUITE_PREFIX}-breed-${randomBytes(4).toString('hex')}`,
    },
  });
}

async function createHorse(userId, breedId, colorGenotype, sex = 'Mare') {
  return prisma.horse.create({
    data: {
      // fixtureColor() gives a non-null phenotype (sentinel-safe); the
      // explicit colorGenotype param then overrides for the prediction test.
      ...fixtureColor(),
      name: `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex,
      dateOfBirth: new Date('2020-01-01'),
      colorGenotype,
      user: { connect: { id: userId } },
      breed: { connect: { id: breedId } },
    },
  });
}

function makeReq(userId, sireId, damId) {
  return {
    body: { sireId, damId },
    user: { id: userId },
  };
}

function makeRes() {
  let _status = 200;
  let _body = null;
  return {
    status(code) {
      _status = code;
      return this;
    },
    json(body) {
      _body = body;
      return this;
    },
    get statusValue() {
      return _status;
    },
    get jsonValue() {
      return _body;
    },
  };
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length > 0) {
    const userIds = users.map(u => u.id);
    await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.breed.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
}

describe('getBreedingColorPrediction controller (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  test('returns 200 with prediction data for valid owned horses with genotypes', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const sire = await createHorse(user.id, breed.id, MOCK_GENOTYPE, 'Stallion');
    const dam = await createHorse(user.id, breed.id, MOCK_GENOTYPE, 'Mare');

    const res = makeRes();
    await getBreedingColorPrediction(makeReq(user.id, sire.id, dam.id), res);

    expect(res.statusValue).toBe(200);
    const body = res.jsonValue;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('sireId', sire.id);
    expect(body.data).toHaveProperty('damId', dam.id);
    expect(body.data).toHaveProperty('possibleColors');
    expect(body.data).toHaveProperty('totalCombinations');
    expect(body.data).toHaveProperty('lethalCombinationsFiltered');
    expect(Array.isArray(body.data.possibleColors)).toBe(true);
    expect(body.data.possibleColors.length).toBeGreaterThan(0);
  });

  test('AC5: returns 404 when sire does not exist', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const dam = await createHorse(user.id, breed.id, MOCK_GENOTYPE, 'Mare');

    const res = makeRes();
    await getBreedingColorPrediction(makeReq(user.id, 999999999, dam.id), res);

    expect(res.statusValue).toBe(404);
    expect(res.jsonValue.success).toBe(false);
  });

  test('AC5: returns 404 when sire belongs to another user', async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const breed = await createBreed();
    const sire = await createHorse(owner.id, breed.id, MOCK_GENOTYPE, 'Stallion');
    const dam = await createHorse(otherUser.id, breed.id, MOCK_GENOTYPE, 'Mare');

    const res = makeRes();
    // Calling user is `otherUser` who owns dam but NOT sire — sire access denied → 404
    await getBreedingColorPrediction(makeReq(otherUser.id, sire.id, dam.id), res);

    expect(res.statusValue).toBe(404);
  });

  test('AC5: returns 404 when dam belongs to another user', async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const breed = await createBreed();
    const sire = await createHorse(otherUser.id, breed.id, MOCK_GENOTYPE, 'Stallion');
    const dam = await createHorse(owner.id, breed.id, MOCK_GENOTYPE, 'Mare');

    const res = makeRes();
    // Calling user is `otherUser` who owns sire but NOT dam → 404
    await getBreedingColorPrediction(makeReq(otherUser.id, sire.id, dam.id), res);

    expect(res.statusValue).toBe(404);
  });

  test('AC6: returns 200 null when sire has no genotype (legacy horse)', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const sire = await createHorse(user.id, breed.id, null, 'Stallion');
    const dam = await createHorse(user.id, breed.id, MOCK_GENOTYPE, 'Mare');

    const res = makeRes();
    await getBreedingColorPrediction(makeReq(user.id, sire.id, dam.id), res);

    expect(res.statusValue).toBe(200);
    const body = res.jsonValue;
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
    expect(body.message).toBe('Color prediction requires both parents to have genetics data');
  });

  test('AC6: returns 200 null when dam genotype is an array (JSONB guard)', async () => {
    const user = await createUser();
    const breed = await createBreed();
    const sire = await createHorse(user.id, breed.id, MOCK_GENOTYPE, 'Stallion');
    // Postgres JSONB accepts arrays; the controller's JSONB-shape guard
    // should reject this and return null data.
    const dam = await createHorse(user.id, breed.id, ['E', 'e'], 'Mare');

    const res = makeRes();
    await getBreedingColorPrediction(makeReq(user.id, sire.id, dam.id), res);

    expect(res.statusValue).toBe(200);
    expect(res.jsonValue.data).toBeNull();
  });
});
